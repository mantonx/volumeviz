package filesystem

import (
	"sync"
	"testing"

	"github.com/mantonx/volumeviz/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// These tests cover walkQueue and IncrementalWalker's folderCache accessors
// in isolation — the parts of the filesystemWalkingPhase rewrite that don't
// need a real database. processDirectory/filesystemWalkingPhase themselves
// always need a real *repo.FoldersRepo/*repo.FilesRepo (concrete types
// backed by a real DBTX, not mockable interfaces — see the skip comments in
// resume_walker_test.go for the same pre-existing gap), so full end-to-end
// coverage of the walk phase against a real DB is not included here.

func TestWalkQueue_DrainsToEmpty(t *testing.T) {
	q := newWalkQueue("/root")

	task, ok := q.pop()
	require.True(t, ok)
	assert.Equal(t, "/root", task.path)
	assert.Equal(t, 0, task.depth)

	q.pushAll([]walkTask{{path: "/root/a", depth: 1}, {path: "/root/b", depth: 1}})
	q.done() // root task fully processed, its two children now enqueued

	seen := map[string]bool{}
	for i := 0; i < 2; i++ {
		task, ok := q.pop()
		require.True(t, ok, "expected a task, queue drained early")
		seen[task.path] = true
		q.done()
	}
	assert.True(t, seen["/root/a"])
	assert.True(t, seen["/root/b"])

	_, ok = q.pop()
	assert.False(t, ok, "queue should report drained once inFlight reaches zero")
}

func TestWalkQueue_ConcurrentProducersConsumers(t *testing.T) {
	// Simulates the real work-stealing pattern: N workers popping tasks,
	// each occasionally pushing more (simulating subdirectories found), then
	// marking done — verifies the queue neither deadlocks nor drops tasks
	// under real concurrent access. Run with -race to catch data races on
	// the queue's internal state.
	q := newWalkQueue("/root")
	const fanoutPerTask = 2
	const maxDepth = 4

	var processed int64
	var mu sync.Mutex

	var wg sync.WaitGroup
	workers := 8
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for {
				task, ok := q.pop()
				if !ok {
					return
				}

				mu.Lock()
				processed++
				mu.Unlock()

				var children []walkTask
				if task.depth < maxDepth {
					for j := 0; j < fanoutPerTask; j++ {
						children = append(children, walkTask{path: task.path + "/x", depth: task.depth + 1})
					}
				}
				q.pushAll(children)
				q.done()
			}
		}()
	}
	wg.Wait()

	// Total tasks in a fanoutPerTask-ary tree of depth maxDepth (root at
	// depth 0): sum_{d=0}^{maxDepth} fanoutPerTask^d.
	expected := int64(0)
	level := int64(1)
	for d := 0; d <= maxDepth; d++ {
		expected += level
		level *= fanoutPerTask
	}
	assert.Equal(t, expected, processed, "every generated task must be processed exactly once")
}

func TestWalkQueue_CloseOnErrUnblocksWaiters(t *testing.T) {
	q := newWalkQueue("/root")
	q.pop() // drain the initial root task, leaving inFlight=1 with no items queued

	done := make(chan struct{})
	go func() {
		_, ok := q.pop() // blocks: no items, inFlight still 1 (never called q.done())
		assert.False(t, ok)
		close(done)
	}()

	q.closeOnErr()
	<-done // must not hang
}

func TestIncrementalWalker_FolderCache_ConcurrentAccess(t *testing.T) {
	// folderCache is read (cachedFolder) and written (cacheFolder) from
	// multiple worker goroutines during filesystemWalkingPhase — this
	// exercises that concurrent access directly against the real accessor
	// methods rather than the map, so `go test -race` actually validates the
	// mutex usage added for this rewrite.
	w := &IncrementalWalker{folderCache: make(map[string]*models.Folder)}

	var wg sync.WaitGroup
	for i := 0; i < 16; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			path := "/vol/dir"
			w.cacheFolder(path, &models.Folder{ID: int64(n)})
			_, _ = w.cachedFolder(path)
		}(i)
	}
	wg.Wait()

	folder, ok := w.cachedFolder("/vol/dir")
	require.True(t, ok)
	assert.NotNil(t, folder)
}
