package models

// Canonical scan-progress aggregation.
//
// A single "scan" is three phases (volume_scan → filesystem_indexing →
// media_enrichment) run in sequence. This file is the ONE place that turns
// per-phase progress into a single 0–100 "overall" number.
//
// Why this exists: overall progress was historically computed in ~8 different
// places (three different weight tables, two naive averages, a global
// item-ratio, and a SQL view column), so the number the user saw depended on
// which subsystem happened to broadcast last — which is why the progress bar
// jumped backward at phase boundaries. Every emitter (WebSocket broadcaster,
// in-memory size-scanner, REST status handler, repo summary) must call into
// this file so they can never disagree again.
//
// PhaseWeights: filesystem indexing is by far the longest phase on a real
// volume (a large tree walk dominates wall-clock), so it carries most of the
// bar. The two short phases still get a non-trivial share each so the bar
// visibly moves during them instead of sitting at 0 and then snapping. These
// are the single source of truth for the weighting — do not reintroduce a
// second table elsewhere.
var PhaseWeights = map[string]float64{
	PhaseVolumeScan:         0.15,
	PhaseFilesystemIndexing: 0.70,
	PhaseMediaEnrichment:    0.15,
}

// Canonical phase names. Both the DB-facing ScanPhase and the in-memory
// scanner phase map key off these exact strings.
const (
	PhaseVolumeScan         = "volume_scan"
	PhaseFilesystemIndexing = "filesystem_indexing"
	PhaseMediaEnrichment    = "media_enrichment"
)

// PhaseProgress is the minimal shape the aggregation needs from any phase,
// regardless of whether it originated from a DB row (ScanPhase, progress
// 0–100 int) or the in-memory scanner (PhaseInfo, progress 0.0–1.0 float).
// Callers adapt their own type into this via the helpers below.
type PhaseProgress struct {
	Name     string
	Status   string  // pending | running | completed | failed | skipped
	Percent  float64 // 0–100
}

// OverallProgress computes the single canonical 0–100 overall percentage from
// a set of phases, weighted by PhaseWeights and status-aware:
//   - completed        → counts as 100% of its weight
//   - running / failed → counts its actual reported percent (partial credit)
//   - pending / skipped→ counts as 0%
//
// Phases not present in PhaseWeights are ignored. The denominator is the sum
// of weights actually seen, so a scan that only ever creates a subset of
// phases still normalizes correctly — and, crucially, adding a phase mid-scan
// cannot make the number drop, because a pending phase contributes 0 to the
// numerator AND its weight to the denominator from the moment it appears.
func OverallProgress(phases []PhaseProgress) int {
	totalWeight := 0.0
	weighted := 0.0

	for _, p := range phases {
		weight, ok := PhaseWeights[p.Name]
		if !ok {
			continue
		}
		totalWeight += weight

		var pct float64
		switch p.Status {
		case "completed":
			pct = 100.0
		case "running", "failed":
			pct = clampPercent(p.Percent)
		default: // pending, skipped, unknown
			pct = 0.0
		}
		weighted += weight * pct
	}

	if totalWeight == 0 {
		return 0
	}
	return int(weighted/totalWeight + 0.5) // round to nearest int
}

// AllPhasesComplete reports whether every weighted phase is completed, which
// callers use to force the bar to a clean 100% (and flip overall status).
func AllPhasesComplete(phases []PhaseProgress) bool {
	seen := 0
	for _, p := range phases {
		if _, ok := PhaseWeights[p.Name]; !ok {
			continue
		}
		seen++
		if p.Status != "completed" {
			return false
		}
	}
	return seen > 0
}

// OverallProgressFromScanPhases adapts DB-facing ScanPhase rows (int 0–100
// progress) into the canonical aggregation.
func OverallProgressFromScanPhases(phases []ScanPhase) int {
	pp := make([]PhaseProgress, 0, len(phases))
	for _, ph := range phases {
		pp = append(pp, PhaseProgress{
			Name:    ph.PhaseName,
			Status:  ph.Status,
			Percent: float64(ph.Progress),
		})
	}
	return OverallProgress(pp)
}

func clampPercent(v float64) float64 {
	if v < 0 {
		return 0
	}
	if v > 100 {
		return 100
	}
	return v
}
