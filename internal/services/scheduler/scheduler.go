package scheduler

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"
)

// Job represents a scheduled job
type Job interface {
	// Name returns the unique identifier for this job
	Name() string

	// Run executes the job
	Run(ctx context.Context) error

	// Description returns a human-readable description
	Description() string
}

// JobFunc is a function adapter for the Job interface
type JobFunc func(ctx context.Context) error

// SimpleJob wraps a function as a Job
type SimpleJob struct {
	name        string
	description string
	fn          JobFunc
}

func (j *SimpleJob) Name() string                       { return j.name }
func (j *SimpleJob) Description() string                { return j.description }
func (j *SimpleJob) Run(ctx context.Context) error      { return j.fn(ctx) }

// NewSimpleJob creates a new simple job from a function
func NewSimpleJob(name, description string, fn JobFunc) Job {
	return &SimpleJob{
		name:        name,
		description: description,
		fn:          fn,
	}
}

// JobSchedule defines when a job should run
type JobSchedule struct {
	Job          Job
	Interval     time.Duration
	RunOnStartup bool
	Enabled      bool
	ticker       *time.Ticker
	stop         chan bool
}

// JobStatus represents the current status of a job
type JobStatus struct {
	Name         string
	Description  string
	Enabled      bool
	Interval     time.Duration
	LastRun      time.Time
	LastDuration time.Duration
	LastError    error
	NextRun      time.Time
	RunCount     int64
	ErrorCount   int64
}

// Scheduler manages scheduled jobs
type Scheduler struct {
	schedules map[string]*JobSchedule
	statuses  map[string]*JobStatus
	mu        sync.RWMutex
	ctx       context.Context
	cancel    context.CancelFunc
	wg        sync.WaitGroup
}

// New creates a new scheduler
func New() *Scheduler {
	ctx, cancel := context.WithCancel(context.Background())
	return &Scheduler{
		schedules: make(map[string]*JobSchedule),
		statuses:  make(map[string]*JobStatus),
		ctx:       ctx,
		cancel:    cancel,
	}
}

// Register registers a job with the scheduler
func (s *Scheduler) Register(job Job, interval time.Duration, runOnStartup bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	name := job.Name()
	if _, exists := s.schedules[name]; exists {
		return fmt.Errorf("job %s already registered", name)
	}

	schedule := &JobSchedule{
		Job:          job,
		Interval:     interval,
		RunOnStartup: runOnStartup,
		Enabled:      true,
		stop:         make(chan bool),
	}

	status := &JobStatus{
		Name:        name,
		Description: job.Description(),
		Enabled:     true,
		Interval:    interval,
		NextRun:     time.Now().Add(interval),
	}

	if runOnStartup {
		status.NextRun = time.Now()
	}

	s.schedules[name] = schedule
	s.statuses[name] = status

	log.Printf("[Scheduler] Registered job: %s (interval: %v, run on startup: %v)",
		name, interval, runOnStartup)

	return nil
}

// RegisterSimple is a convenience method to register a simple function as a job
func (s *Scheduler) RegisterSimple(name, description string, interval time.Duration, runOnStartup bool, fn JobFunc) error {
	job := NewSimpleJob(name, description, fn)
	return s.Register(job, interval, runOnStartup)
}

// Start starts the scheduler and all registered jobs
func (s *Scheduler) Start() {
	s.mu.Lock()
	defer s.mu.Unlock()

	log.Println("[Scheduler] Starting scheduler...")

	for name, schedule := range s.schedules {
		if !schedule.Enabled {
			log.Printf("[Scheduler] Job %s is disabled, skipping", name)
			continue
		}

		s.wg.Add(1)
		go s.runJob(schedule)
	}

	log.Printf("[Scheduler] Started %d jobs", len(s.schedules))
}

// Stop stops the scheduler and all running jobs
func (s *Scheduler) Stop() {
	log.Println("[Scheduler] Stopping scheduler...")

	s.mu.Lock()
	for _, schedule := range s.schedules {
		if schedule.ticker != nil {
			schedule.ticker.Stop()
		}
		close(schedule.stop)
	}
	s.mu.Unlock()

	s.cancel()
	s.wg.Wait()

	log.Println("[Scheduler] Scheduler stopped")
}

// runJob runs a scheduled job
func (s *Scheduler) runJob(schedule *JobSchedule) {
	defer s.wg.Done()

	name := schedule.Job.Name()

	// Run immediately if configured
	if schedule.RunOnStartup {
		log.Printf("[Scheduler] Running job %s immediately (startup)", name)
		s.executeJob(schedule)
	}

	// Set up ticker for periodic execution
	schedule.ticker = time.NewTicker(schedule.Interval)
	defer schedule.ticker.Stop()

	for {
		select {
		case <-schedule.ticker.C:
			s.executeJob(schedule)
		case <-schedule.stop:
			log.Printf("[Scheduler] Job %s stopped", name)
			return
		case <-s.ctx.Done():
			log.Printf("[Scheduler] Job %s cancelled", name)
			return
		}
	}
}

// executeJob executes a single job and updates its status
func (s *Scheduler) executeJob(schedule *JobSchedule) {
	name := schedule.Job.Name()

	s.mu.Lock()
	status := s.statuses[name]
	status.LastRun = time.Now()
	status.NextRun = time.Now().Add(schedule.Interval)
	s.mu.Unlock()

	log.Printf("[Scheduler] Executing job: %s", name)

	startTime := time.Now()
	err := schedule.Job.Run(s.ctx)
	duration := time.Since(startTime)

	s.mu.Lock()
	status.LastDuration = duration
	status.LastError = err
	status.RunCount++
	if err != nil {
		status.ErrorCount++
		log.Printf("[Scheduler] Job %s failed (duration: %v): %v", name, duration, err)
	} else {
		log.Printf("[Scheduler] Job %s completed successfully (duration: %v)", name, duration)
	}
	s.mu.Unlock()
}

// RunNow manually triggers a job to run immediately
func (s *Scheduler) RunNow(jobName string) error {
	s.mu.RLock()
	schedule, exists := s.schedules[jobName]
	s.mu.RUnlock()

	if !exists {
		return fmt.Errorf("job %s not found", jobName)
	}

	log.Printf("[Scheduler] Manually triggering job: %s", jobName)
	s.executeJob(schedule)
	return nil
}

// GetStatus returns the status of a specific job
func (s *Scheduler) GetStatus(jobName string) (*JobStatus, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	status, exists := s.statuses[jobName]
	if !exists {
		return nil, fmt.Errorf("job %s not found", jobName)
	}

	// Return a copy to avoid race conditions
	statusCopy := *status
	return &statusCopy, nil
}

// GetAllStatuses returns the status of all jobs
func (s *Scheduler) GetAllStatuses() map[string]*JobStatus {
	s.mu.RLock()
	defer s.mu.RUnlock()

	statuses := make(map[string]*JobStatus, len(s.statuses))
	for name, status := range s.statuses {
		statusCopy := *status
		statuses[name] = &statusCopy
	}
	return statuses
}

// Enable enables a job
func (s *Scheduler) Enable(jobName string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	schedule, exists := s.schedules[jobName]
	if !exists {
		return fmt.Errorf("job %s not found", jobName)
	}

	schedule.Enabled = true
	s.statuses[jobName].Enabled = true
	log.Printf("[Scheduler] Job %s enabled", jobName)
	return nil
}

// Disable disables a job
func (s *Scheduler) Disable(jobName string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	schedule, exists := s.schedules[jobName]
	if !exists {
		return fmt.Errorf("job %s not found", jobName)
	}

	schedule.Enabled = false
	s.statuses[jobName].Enabled = false
	log.Printf("[Scheduler] Job %s disabled", jobName)
	return nil
}
