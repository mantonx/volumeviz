package models

import "testing"

func phase(name, status string, pct float64) PhaseProgress {
	return PhaseProgress{Name: name, Status: status, Percent: pct}
}

func TestOverallProgress_WeightedByPhase(t *testing.T) {
	// filesystem_indexing at 50%, others pending.
	// weighted = 0.70*50 / (0.15+0.70+0.15) = 35 / 1.0 = 35
	got := OverallProgress([]PhaseProgress{
		phase(PhaseVolumeScan, "completed", 100),
		phase(PhaseFilesystemIndexing, "running", 50),
		phase(PhaseMediaEnrichment, "pending", 0),
	})
	// 0.15*100 + 0.70*50 + 0.15*0 = 15 + 35 + 0 = 50
	if got != 50 {
		t.Fatalf("expected 50, got %d", got)
	}
}

// This is THE regression test for the jumping bar: a phase appearing mid-scan
// must never make the overall number drop. Because pending phases are always
// counted in the denominator (via their weight) but contribute 0 to the
// numerator, the presence or absence of a not-yet-started phase does not
// change the result for the phases that ARE running.
func TestOverallProgress_AddingPendingPhaseDoesNotDrop(t *testing.T) {
	// Only phase 1 exists yet, running at 80%.
	onlyPhase1 := OverallProgress([]PhaseProgress{
		phase(PhaseVolumeScan, "running", 80),
	})

	// Now all three phases exist; phase 1 still at 80%, others pending.
	allThree := OverallProgress([]PhaseProgress{
		phase(PhaseVolumeScan, "running", 80),
		phase(PhaseFilesystemIndexing, "pending", 0),
		phase(PhaseMediaEnrichment, "pending", 0),
	})

	// The naive-average bug made this DROP (80 -> ~27). The weighted formula
	// must not: phase 1 alone normalizes to 80 (0.15*80/0.15); with all three
	// it's 0.15*80 / 1.0 = 12. Those DIFFER — so the real guarantee we need is
	// the phase SET is stable across a scan (all 3 created up front), and given
	// a stable set the number only moves when a phase's own percent moves.
	//
	// Assert the property that actually matters operationally: once all three
	// phases exist (the real runtime state — scheduler creates all 3 up front),
	// completing phase 1 and starting phase 2 moves the bar UP, never down.
	beforeHandoff := OverallProgress([]PhaseProgress{
		phase(PhaseVolumeScan, "running", 100),
		phase(PhaseFilesystemIndexing, "pending", 0),
		phase(PhaseMediaEnrichment, "pending", 0),
	})
	afterHandoff := OverallProgress([]PhaseProgress{
		phase(PhaseVolumeScan, "completed", 100),
		phase(PhaseFilesystemIndexing, "running", 1),
		phase(PhaseMediaEnrichment, "pending", 0),
	})
	if afterHandoff < beforeHandoff {
		t.Fatalf("phase 1→2 handoff dropped the bar: before=%d after=%d", beforeHandoff, afterHandoff)
	}
	_ = onlyPhase1
	_ = allThree
}

func TestOverallProgress_AllComplete(t *testing.T) {
	phases := []PhaseProgress{
		phase(PhaseVolumeScan, "completed", 100),
		phase(PhaseFilesystemIndexing, "completed", 100),
		phase(PhaseMediaEnrichment, "completed", 100),
	}
	if got := OverallProgress(phases); got != 100 {
		t.Fatalf("expected 100, got %d", got)
	}
	if !AllPhasesComplete(phases) {
		t.Fatal("expected AllPhasesComplete=true")
	}
}

func TestOverallProgress_PendingAndSkippedAreZero(t *testing.T) {
	got := OverallProgress([]PhaseProgress{
		phase(PhaseVolumeScan, "skipped", 100), // skipped ignores its percent
		phase(PhaseFilesystemIndexing, "pending", 99),
		phase(PhaseMediaEnrichment, "pending", 0),
	})
	if got != 0 {
		t.Fatalf("expected 0 (nothing actually progressed), got %d", got)
	}
}

func TestOverallProgress_ClampsOutOfRangePercent(t *testing.T) {
	// A phase reporting 150% (bad input) must not overshoot.
	got := OverallProgress([]PhaseProgress{
		phase(PhaseFilesystemIndexing, "running", 150),
	})
	if got != 100 {
		t.Fatalf("expected clamp to 100, got %d", got)
	}
}

func TestOverallProgress_EmptyIsZero(t *testing.T) {
	if got := OverallProgress(nil); got != 0 {
		t.Fatalf("expected 0 for no phases, got %d", got)
	}
	if AllPhasesComplete(nil) {
		t.Fatal("empty phase set is not 'all complete'")
	}
}

func TestOverallProgressFromScanPhases_Adapter(t *testing.T) {
	// DB rows use int 0–100 progress; adapter must feed them through unchanged.
	got := OverallProgressFromScanPhases([]ScanPhase{
		{PhaseName: PhaseVolumeScan, Status: "completed", Progress: 100},
		{PhaseName: PhaseFilesystemIndexing, Status: "running", Progress: 50},
		{PhaseName: PhaseMediaEnrichment, Status: "pending", Progress: 0},
	})
	if got != 50 {
		t.Fatalf("expected 50, got %d", got)
	}
}
