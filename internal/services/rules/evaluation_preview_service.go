package rules

import (
	"context"
	"fmt"
	"sort"
	"time"

	"github.com/mantonx/volumeviz/internal/repo"
)

// EvaluationPreviewService provides functionality to preview rule evaluation results
type EvaluationPreviewService struct {
	rulesEngine *TrackingRulesEngine
	rulesRepo   *repo.TrackingRulesRepository
	mountsRepo  *repo.MountCatalogRepository
}

// NewEvaluationPreviewService creates a new evaluation preview service
func NewEvaluationPreviewService(
	rulesEngine *TrackingRulesEngine,
	rulesRepo *repo.TrackingRulesRepository,
	mountsRepo *repo.MountCatalogRepository,
) *EvaluationPreviewService {
	return &EvaluationPreviewService{
		rulesEngine: rulesEngine,
		rulesRepo:   rulesRepo,
		mountsRepo:  mountsRepo,
	}
}

// PreviewRequest represents a request to preview rule evaluation
type PreviewRequest struct {
	// RuleIDs to include in preview (if empty, all enabled rules are used)
	RuleIDs []int64 `json:"rule_ids,omitempty"`

	// MountIDs to limit preview to specific mounts (if empty, all mounts are evaluated)
	MountIDs []string `json:"mount_ids,omitempty"`

	// IncludeRuleDetails whether to include detailed rule condition matching info
	IncludeRuleDetails bool `json:"include_rule_details"`

	// IncludeUnmatched whether to include mounts that don't match any rules
	IncludeUnmatched bool `json:"include_unmatched"`

	// DryRun mode - if true, doesn't create evaluation records
	DryRun bool `json:"dry_run"`
}

// PreviewResponse represents the response from a rule evaluation preview
type PreviewResponse struct {
	PreviewID       string                   `json:"preview_id"`
	RequestedAt     time.Time                `json:"requested_at"`
	CompletedAt     time.Time                `json:"completed_at"`
	ExecutionTimeMs int64                    `json:"execution_time_ms"`
	Summary         *PreviewSummary          `json:"summary"`
	MountPreviews   []*MountPreview          `json:"mount_previews"`
	RulePerformance []*RulePerformanceResult `json:"rule_performance"`
	Warnings        []string                 `json:"warnings,omitempty"`
	Errors          []string                 `json:"errors,omitempty"`
}

// PreviewSummary provides high-level statistics about the preview
type PreviewSummary struct {
	TotalMounts      int32                      `json:"total_mounts"`
	MountsEvaluated  int32                      `json:"mounts_evaluated"`
	MountsMatched    int32                      `json:"mounts_matched"`
	MountsIncluded   int32                      `json:"mounts_included"`
	MountsExcluded   int32                      `json:"mounts_excluded"`
	MountsUnmatched  int32                      `json:"mounts_unmatched"`
	RulesEvaluated   int32                      `json:"rules_evaluated"`
	ActionBreakdown  map[string]int32           `json:"action_breakdown"`
	TypeBreakdown    map[string]ActionBreakdown `json:"type_breakdown"`
	ProjectBreakdown map[string]ActionBreakdown `json:"project_breakdown"`
}

// ActionBreakdown shows include/exclude counts for a category
type ActionBreakdown struct {
	Include   int32 `json:"include"`
	Exclude   int32 `json:"exclude"`
	Unmatched int32 `json:"unmatched"`
}

// MountPreview represents the preview result for a single mount
type MountPreview struct {
	Mount           *MountSummary       `json:"mount"`
	CurrentAction   string              `json:"current_action"`   // current tracking status
	PreviewAction   string              `json:"preview_action"`   // predicted action based on rules
	ActionChanged   bool                `json:"action_changed"`   // whether action would change
	WinningRule     *RuleMatchSummary   `json:"winning_rule"`     // highest priority matching rule
	AllMatches      []*RuleMatchSummary `json:"all_matches"`      // all matching rules (if detailed)
	ConflictDetails *ConflictAnalysis   `json:"conflict_details"` // rule conflicts if any
}

// MountSummary represents a simplified mount for preview
type MountSummary struct {
	ID              int64    `json:"id"`
	MountID         string   `json:"mount_id"`
	MountType       string   `json:"mount_type"`
	VolumeName      *string  `json:"volume_name,omitempty"`
	SourcePath      string   `json:"source_path"`
	ComposeProject  *string  `json:"compose_project,omitempty"`
	ComposeServices []string `json:"compose_services,omitempty"`
	IsOrphaned      bool     `json:"is_orphaned"`
	IsTracked       bool     `json:"is_tracked"`
	ContainerCount  int32    `json:"container_count"`
}

// RuleMatchSummary represents a rule match in the preview
type RuleMatchSummary struct {
	RuleID            int64             `json:"rule_id"`
	RuleName          string            `json:"rule_name"`
	Action            string            `json:"action"`
	Priority          int32             `json:"priority"`
	Matched           bool              `json:"matched"`
	MatchConfidence   float64           `json:"match_confidence"` // 0.0-1.0 based on condition matches
	MatchedConditions []ConditionResult `json:"matched_conditions,omitempty"`
	ExecutionTimeMs   int64             `json:"execution_time_ms"`
}

// ConflictAnalysis identifies potential rule conflicts
type ConflictAnalysis struct {
	HasConflicts     bool            `json:"has_conflicts"`
	ConflictingRules []*RuleConflict `json:"conflicting_rules,omitempty"`
	Resolution       string          `json:"resolution"` // how conflicts are resolved
}

// RuleConflict represents a conflict between rules
type RuleConflict struct {
	Rule1    *RuleMatchSummary `json:"rule1"`
	Rule2    *RuleMatchSummary `json:"rule2"`
	Conflict string            `json:"conflict"` // description of the conflict
}

// PreviewRuleEvaluation performs a preview of rule evaluation
func (s *EvaluationPreviewService) PreviewRuleEvaluation(ctx context.Context, req *PreviewRequest) (*PreviewResponse, error) {
	startTime := time.Now()
	previewID := fmt.Sprintf("preview_%d", startTime.Unix())

	response := &PreviewResponse{
		PreviewID:   previewID,
		RequestedAt: startTime,
		Summary:     &PreviewSummary{ActionBreakdown: make(map[string]int32)},
		Warnings:    []string{},
		Errors:      []string{},
	}

	// Get rules to evaluate
	rules, err := s.getRulesForPreview(ctx, req.RuleIDs)
	if err != nil {
		response.Errors = append(response.Errors, fmt.Sprintf("Failed to get rules: %v", err))
		return response, err
	}

	// Get mounts to evaluate
	mounts, err := s.getMountsForPreview(ctx, req.MountIDs)
	if err != nil {
		response.Errors = append(response.Errors, fmt.Sprintf("Failed to get mounts: %v", err))
		return response, err
	}

	response.Summary.TotalMounts = int32(len(mounts))
	response.Summary.RulesEvaluated = int32(len(rules))

	// Sort rules by priority for evaluation
	sort.Slice(rules, func(i, j int) bool {
		return rules[i].Priority < rules[j].Priority
	})

	// Evaluate each mount against rules
	mountPreviews := make([]*MountPreview, 0, len(mounts))
	rulePerformance := make(map[int64]*RulePerformanceResult)

	for _, mount := range mounts {
		mountInfo := convertCatalogEntryToMountInfo(mount)
		preview, err := s.evaluateMountPreview(ctx, mountInfo, rules, req.IncludeRuleDetails)
		if err != nil {
			response.Warnings = append(response.Warnings,
				fmt.Sprintf("Failed to evaluate mount %s: %v", mount.MountID, err))
			continue
		}

		// Update statistics
		response.Summary.MountsEvaluated++
		if preview.PreviewAction != "none" {
			response.Summary.MountsMatched++
			if preview.PreviewAction == "include" {
				response.Summary.MountsIncluded++
			} else if preview.PreviewAction == "exclude" {
				response.Summary.MountsExcluded++
			}
		} else {
			response.Summary.MountsUnmatched++
		}

		// Update breakdowns
		s.updateBreakdowns(response.Summary, preview)

		// Update rule performance
		for _, match := range preview.AllMatches {
			if perf, exists := rulePerformance[match.RuleID]; exists {
				perf.MountsEvaluated++
				if match.Matched {
					perf.MountsMatched++
				}
				perf.TotalExecutionTimeMs += match.ExecutionTimeMs
			} else {
				rulePerformance[match.RuleID] = &RulePerformanceResult{
					RuleID:               match.RuleID,
					RuleName:             match.RuleName,
					MountsEvaluated:      1,
					MountsMatched:        map[bool]int32{match.Matched: 1}[true],
					TotalExecutionTimeMs: match.ExecutionTimeMs,
				}
			}
		}

		// Include in response if requested or if matched
		if req.IncludeUnmatched || preview.PreviewAction != "none" {
			mountPreviews = append(mountPreviews, preview)
		}
	}

	// Convert rule performance map to slice
	for _, perf := range rulePerformance {
		if perf.MountsEvaluated > 0 {
			perf.AvgExecutionTimeMs = perf.TotalExecutionTimeMs / int64(perf.MountsEvaluated)
		}
		response.RulePerformance = append(response.RulePerformance, perf)
	}

	// Sort by performance
	sort.Slice(response.RulePerformance, func(i, j int) bool {
		return response.RulePerformance[i].TotalExecutionTimeMs > response.RulePerformance[j].TotalExecutionTimeMs
	})

	response.MountPreviews = mountPreviews
	response.CompletedAt = time.Now()
	response.ExecutionTimeMs = response.CompletedAt.Sub(startTime).Milliseconds()

	// Create evaluation record if not dry run
	if !req.DryRun {
		if err := s.createEvaluationRecord(ctx, response, rules); err != nil {
			response.Warnings = append(response.Warnings,
				fmt.Sprintf("Failed to create evaluation record: %v", err))
		}
	}

	return response, nil
}

// evaluateMountPreview evaluates a single mount against rules for preview
func (s *EvaluationPreviewService) evaluateMountPreview(
	ctx context.Context,
	mount *MountInfo,
	rules []*repo.TrackingRule,
	includeDetails bool,
) (*MountPreview, error) {

	preview := &MountPreview{
		Mount: &MountSummary{
			ID:              mount.ID,
			MountID:         mount.MountID,
			MountType:       mount.MountType,
			VolumeName:      mount.VolumeName,
			SourcePath:      mount.ContainerPath, // Use container path for display
			ComposeProject:  mount.ComposeProject,
			ComposeServices: mount.ComposeServices,
			IsOrphaned:      mount.IsOrphaned,
			IsTracked:       false, // Would need to query current tracking status
		},
		CurrentAction: "none",
		PreviewAction: "none",
		AllMatches:    []*RuleMatchSummary{},
	}

	var winningRule *RuleMatchSummary
	var highestPriority int32 = 999999

	// Evaluate against each rule
	for _, rule := range rules {
		ruleStart := time.Now()
		matched, conditionResults, err := s.rulesEngine.evaluateRule(rule, mount)
		executionTime := time.Since(ruleStart).Milliseconds()

		matchSummary := &RuleMatchSummary{
			RuleID:          rule.ID,
			RuleName:        rule.Name,
			Action:          rule.Action,
			Priority:        rule.Priority,
			Matched:         matched,
			ExecutionTimeMs: executionTime,
		}

		if includeDetails {
			matchSummary.MatchedConditions = conditionResults
		}

		// Calculate match confidence
		if len(conditionResults) > 0 {
			matchedCount := 0
			for _, condition := range conditionResults {
				if condition.Matched {
					matchedCount++
				}
			}
			matchSummary.MatchConfidence = float64(matchedCount) / float64(len(conditionResults))
		}

		if err != nil {
			matchSummary.MatchConfidence = 0.0
		}

		preview.AllMatches = append(preview.AllMatches, matchSummary)

		// Check if this rule wins (highest priority = lowest number)
		if matched && rule.Priority < highestPriority {
			winningRule = matchSummary
			highestPriority = rule.Priority
			preview.PreviewAction = rule.Action
		}
	}

	if winningRule != nil {
		preview.WinningRule = winningRule
	}

	// Analyze conflicts
	preview.ConflictDetails = s.analyzeConflicts(preview.AllMatches)

	// Check if action would change
	preview.ActionChanged = preview.CurrentAction != preview.PreviewAction

	return preview, nil
}

// analyzeConflicts identifies potential conflicts between rules
func (s *EvaluationPreviewService) analyzeConflicts(matches []*RuleMatchSummary) *ConflictAnalysis {
	analysis := &ConflictAnalysis{
		HasConflicts:     false,
		ConflictingRules: []*RuleConflict{},
		Resolution:       "no_conflicts",
	}

	// Find rules that match with different actions
	matchedRules := make([]*RuleMatchSummary, 0)
	for _, match := range matches {
		if match.Matched {
			matchedRules = append(matchedRules, match)
		}
	}

	if len(matchedRules) <= 1 {
		return analysis
	}

	// Check for action conflicts
	actions := make(map[string][]*RuleMatchSummary)
	for _, rule := range matchedRules {
		actions[rule.Action] = append(actions[rule.Action], rule)
	}

	if len(actions) > 1 {
		analysis.HasConflicts = true
		analysis.Resolution = "priority_based"

		// Create conflict records
		includeRules := actions["include"]
		excludeRules := actions["exclude"]

		for _, includeRule := range includeRules {
			for _, excludeRule := range excludeRules {
				conflict := &RuleConflict{
					Rule1:    includeRule,
					Rule2:    excludeRule,
					Conflict: fmt.Sprintf("Rule '%s' includes but rule '%s' excludes", includeRule.RuleName, excludeRule.RuleName),
				}
				analysis.ConflictingRules = append(analysis.ConflictingRules, conflict)
			}
		}
	}

	return analysis
}

// updateBreakdowns updates summary breakdowns with mount preview data
func (s *EvaluationPreviewService) updateBreakdowns(summary *PreviewSummary, preview *MountPreview) {
	// Action breakdown
	summary.ActionBreakdown[preview.PreviewAction]++

	// Type breakdown
	if summary.TypeBreakdown == nil {
		summary.TypeBreakdown = make(map[string]ActionBreakdown)
	}
	typeBreakdown := summary.TypeBreakdown[preview.Mount.MountType]
	switch preview.PreviewAction {
	case "include":
		typeBreakdown.Include++
	case "exclude":
		typeBreakdown.Exclude++
	default:
		typeBreakdown.Unmatched++
	}
	summary.TypeBreakdown[preview.Mount.MountType] = typeBreakdown

	// Project breakdown
	if summary.ProjectBreakdown == nil {
		summary.ProjectBreakdown = make(map[string]ActionBreakdown)
	}
	project := "no_project"
	if preview.Mount.ComposeProject != nil {
		project = *preview.Mount.ComposeProject
	}
	projectBreakdown := summary.ProjectBreakdown[project]
	switch preview.PreviewAction {
	case "include":
		projectBreakdown.Include++
	case "exclude":
		projectBreakdown.Exclude++
	default:
		projectBreakdown.Unmatched++
	}
	summary.ProjectBreakdown[project] = projectBreakdown
}

// getRulesForPreview gets rules to include in preview
func (s *EvaluationPreviewService) getRulesForPreview(ctx context.Context, ruleIDs []int64) ([]*repo.TrackingRule, error) {
	if len(ruleIDs) == 0 {
		// Get all enabled rules
		return s.rulesRepo.ListEnabledRules(ctx)
	}

	// Get specific rules
	rules := make([]*repo.TrackingRule, 0, len(ruleIDs))
	for _, id := range ruleIDs {
		rule, err := s.rulesRepo.GetRule(ctx, id)
		if err != nil {
			return nil, fmt.Errorf("failed to get rule %d: %w", id, err)
		}
		rules = append(rules, rule)
	}

	return rules, nil
}

// getMountsForPreview gets mounts to include in preview
func (s *EvaluationPreviewService) getMountsForPreview(ctx context.Context, mountIDs []string) ([]*repo.MountCatalogEntry, error) {
	if len(mountIDs) == 0 {
		// Get all mounts
		return s.mountsRepo.ListAllMounts(ctx)
	}

	// Get specific mounts
	mounts := make([]*repo.MountCatalogEntry, 0, len(mountIDs))
	for _, id := range mountIDs {
		mount, err := s.mountsRepo.GetMountByMountID(ctx, id)
		if err != nil {
			return nil, fmt.Errorf("failed to get mount %s: %w", id, err)
		}
		mounts = append(mounts, mount)
	}

	return mounts, nil
}

// createEvaluationRecord creates a database record of the evaluation
func (s *EvaluationPreviewService) createEvaluationRecord(
	ctx context.Context,
	response *PreviewResponse,
	rules []*repo.TrackingRule,
) error {
	// Create evaluation records for each rule
	for _, rule := range rules {
		evaluation := &repo.TrackingRuleEvaluation{
			RuleID:          rule.ID,
			EvaluationType:  "preview",
			TriggeredBy:     nil, // Could be populated with user ID
			Status:          "success",
			MountsEvaluated: response.Summary.MountsEvaluated,
			MountsMatched:   response.Summary.MountsMatched,
			MountsIncluded:  response.Summary.MountsIncluded,
			MountsExcluded:  response.Summary.MountsExcluded,
			ExecutionTimeMs: func() *int32 { ms := int32(response.ExecutionTimeMs); return &ms }(),
			StartedAt:       response.RequestedAt,
			CompletedAt:     &response.CompletedAt,
		}

		_, err := s.rulesRepo.CreateEvaluation(ctx, evaluation)
		if err != nil {
			return fmt.Errorf("failed to create evaluation record for rule %d: %w", rule.ID, err)
		}
	}

	return nil
}
