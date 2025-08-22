package rules

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/mantonx/volumeviz/internal/repo"
)

// TrackingRulesEngine evaluates rules against Docker mounts
type TrackingRulesEngine struct {
	rulesRepo   *repo.TrackingRulesRepository
	mountsRepo  *repo.MountCatalogRepository // We'll need this for mount data
}

// NewTrackingRulesEngine creates a new rules engine
func NewTrackingRulesEngine(rulesRepo *repo.TrackingRulesRepository, mountsRepo *repo.MountCatalogRepository) *TrackingRulesEngine {
	return &TrackingRulesEngine{
		rulesRepo:  rulesRepo,
		mountsRepo: mountsRepo,
	}
}

// MountInfo represents Docker mount information for rule evaluation
type MountInfo struct {
	ID                int64               `json:"id"`
	MountID           string              `json:"mount_id"`
	MountType         string              `json:"mount_type"`         // volume, bind, tmpfs
	Driver            string              `json:"driver"`             // local, nfs, etc.
	VolumeName        *string             `json:"volume_name"`        // Docker volume name
	HostPath          *string             `json:"host_path"`          // For bind mounts
	ContainerPath     string              `json:"container_path"`     // Mount destination
	ComposeProject    *string             `json:"compose_project"`    // Compose project name
	ComposeServices   []string            `json:"compose_services"`   // Compose service names
	ContainerID       *string             `json:"container_id"`       // Container using mount
	ContainerName     *string             `json:"container_name"`     // Container name
	ContainerImage    *string             `json:"container_image"`    // Container image
	ReadOnly          bool                `json:"read_only"`          // Read-only mount
	IsOrphaned        bool                `json:"is_orphaned"`        // No active containers
	CreatedAt         time.Time           `json:"created_at"`
	UpdatedAt         time.Time           `json:"updated_at"`
	Metadata          map[string]string   `json:"metadata"`           // Additional metadata
}

// RuleEvaluationResult represents the result of evaluating a single rule
type RuleEvaluationResult struct {
	RuleID            int64                  `json:"rule_id"`
	RuleName          string                 `json:"rule_name"`
	Action            string                 `json:"action"`
	Priority          int32                  `json:"priority"`
	Matched           bool                   `json:"matched"`
	MatchedConditions []ConditionResult      `json:"matched_conditions"`
	ExecutionTimeMs   int64                  `json:"execution_time_ms"`
	Error             error                  `json:"error,omitempty"`
}

// ConditionResult represents the result of evaluating a single condition
type ConditionResult struct {
	FieldName string `json:"field_name"`
	Operator  string `json:"operator"`
	Value     string `json:"value"`
	Matched   bool   `json:"matched"`
	Error     error  `json:"error,omitempty"`
}

// EvaluationContext contains context for rule evaluation
type EvaluationContext struct {
	EvaluationType string    `json:"evaluation_type"` // manual, scheduled, mount_discovery, api_request
	TriggeredBy    *string   `json:"triggered_by"`    // User ID or system component
	StartedAt      time.Time `json:"started_at"`
}

// EvaluateRulesForMount evaluates all enabled rules against a single mount
func (e *TrackingRulesEngine) EvaluateRulesForMount(ctx context.Context, mount *MountInfo, evalCtx *EvaluationContext) ([]*RuleEvaluationResult, error) {
	rules, err := e.rulesRepo.ListEnabledRules(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list enabled rules: %w", err)
	}

	results := make([]*RuleEvaluationResult, 0, len(rules))

	for _, rule := range rules {
		start := time.Now()
		result := &RuleEvaluationResult{
			RuleID:   rule.ID,
			RuleName: rule.Name,
			Action:   rule.Action,
			Priority: rule.Priority,
			Matched:  false,
		}

		matched, conditionResults, err := e.evaluateRule(rule, mount)
		if err != nil {
			result.Error = err
		} else {
			result.Matched = matched
			result.MatchedConditions = conditionResults
		}

		result.ExecutionTimeMs = time.Since(start).Milliseconds()
		results = append(results, result)
	}

	return results, nil
}

// EvaluateRulesForAllMounts evaluates all enabled rules against all mounts
func (e *TrackingRulesEngine) EvaluateRulesForAllMounts(ctx context.Context, evalCtx *EvaluationContext) (*FullEvaluationResult, error) {
	// Get all mounts (we'll need to implement this in mount catalog repo)
	mounts, err := e.getAllMounts(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get all mounts: %w", err)
	}

	rules, err := e.rulesRepo.ListEnabledRules(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list enabled rules: %w", err)
	}

	result := &FullEvaluationResult{
		EvaluationType:    evalCtx.EvaluationType,
		TriggeredBy:       evalCtx.TriggeredBy,
		StartedAt:         evalCtx.StartedAt,
		TotalMounts:       int32(len(mounts)),
		TotalRules:        int32(len(rules)),
		MountResults:      make(map[int64]*MountEvaluationResult),
		RulePerformance:   make([]*RulePerformanceResult, 0, len(rules)),
	}

	var totalMatched, totalIncluded, totalExcluded int32

	// Evaluate each mount against all rules
	for _, mount := range mounts {
		mountResult := &MountEvaluationResult{
			MountID:       mount.ID,
			MountName:     mount.MountID,
			RuleResults:   make([]*RuleEvaluationResult, 0, len(rules)),
			FinalAction:   "none",
			WinningRule:   nil,
		}

		var winningRule *RuleEvaluationResult
		highestPriority := int32(999999)

		// Evaluate against each rule in priority order
		for _, rule := range rules {
			ruleResult, err := e.EvaluateRulesForMount(ctx, mount, evalCtx)
			if err != nil {
				continue
			}

			if len(ruleResult) > 0 {
				mountResult.RuleResults = append(mountResult.RuleResults, ruleResult[0])
				
				// Check if this rule matches and has higher priority
				if ruleResult[0].Matched && rule.Priority < highestPriority {
					winningRule = ruleResult[0]
					highestPriority = rule.Priority
					mountResult.FinalAction = rule.Action
				}
			}
		}

		if winningRule != nil {
			mountResult.WinningRule = winningRule
			totalMatched++
			if winningRule.Action == "include" {
				totalIncluded++
			} else if winningRule.Action == "exclude" {
				totalExcluded++
			}
		}

		result.MountResults[mount.ID] = mountResult
	}

	result.MountsMatched = totalMatched
	result.MountsIncluded = totalIncluded
	result.MountsExcluded = totalExcluded
	result.CompletedAt = time.Now()
	result.ExecutionTimeMs = result.CompletedAt.Sub(result.StartedAt).Milliseconds()

	return result, nil
}

// evaluateRule evaluates a single rule against a mount
func (e *TrackingRulesEngine) evaluateRule(rule *repo.TrackingRule, mount *MountInfo) (bool, []ConditionResult, error) {
	if len(rule.Conditions) == 0 {
		return false, nil, fmt.Errorf("rule has no conditions")
	}

	conditionResults := make([]ConditionResult, 0, len(rule.Conditions))
	allMatched := true

	for _, condition := range rule.Conditions {
		result := ConditionResult{
			FieldName: condition.FieldName,
			Operator:  condition.Operator,
			Value:     getConditionValue(condition),
			Matched:   false,
		}

		matched, err := e.evaluateCondition(&condition, mount)
		if err != nil {
			result.Error = err
			allMatched = false
		} else {
			result.Matched = matched
			if !matched {
				allMatched = false
			}
		}

		conditionResults = append(conditionResults, result)
	}

	return allMatched, conditionResults, nil
}

// evaluateCondition evaluates a single condition against a mount
func (e *TrackingRulesEngine) evaluateCondition(condition *repo.TrackingCondition, mount *MountInfo) (bool, error) {
	fieldValue := e.extractFieldValue(condition.FieldName, mount)
	
	switch condition.Operator {
	case "equals":
		return e.evaluateEquals(fieldValue, condition.Value, condition.IsCaseSensitive), nil
	case "not_equals":
		return !e.evaluateEquals(fieldValue, condition.Value, condition.IsCaseSensitive), nil
	case "prefix":
		return e.evaluatePrefix(fieldValue, condition.Value, condition.IsCaseSensitive), nil
	case "suffix":
		return e.evaluateSuffix(fieldValue, condition.Value, condition.IsCaseSensitive), nil
	case "contains":
		return e.evaluateContains(fieldValue, condition.Value, condition.IsCaseSensitive), nil
	case "not_contains":
		return !e.evaluateContains(fieldValue, condition.Value, condition.IsCaseSensitive), nil
	case "regex":
		return e.evaluateRegex(fieldValue, condition.Value, condition.IsCaseSensitive)
	case "not_regex":
		matched, err := e.evaluateRegex(fieldValue, condition.Value, condition.IsCaseSensitive)
		return !matched, err
	case "glob":
		return e.evaluateGlob(fieldValue, condition.Value, condition.IsCaseSensitive), nil
	case "in":
		return e.evaluateIn(fieldValue, condition.Values, condition.IsCaseSensitive), nil
	case "not_in":
		return !e.evaluateIn(fieldValue, condition.Values, condition.IsCaseSensitive), nil
	default:
		return false, fmt.Errorf("unsupported operator: %s", condition.Operator)
	}
}

// extractFieldValue extracts the value of a field from mount info
func (e *TrackingRulesEngine) extractFieldValue(fieldName string, mount *MountInfo) string {
	switch fieldName {
	case "source_type", "mount_type":
		return mount.MountType
	case "driver":
		return mount.Driver
	case "docker_volume_name", "volume_name":
		if mount.VolumeName != nil {
			return *mount.VolumeName
		}
		return ""
	case "host_path":
		if mount.HostPath != nil {
			return *mount.HostPath
		}
		return ""
	case "container_path":
		return mount.ContainerPath
	case "compose_project":
		if mount.ComposeProject != nil {
			return *mount.ComposeProject
		}
		return ""
	case "compose_service":
		if len(mount.ComposeServices) > 0 {
			return strings.Join(mount.ComposeServices, ",")
		}
		return ""
	case "container_id":
		if mount.ContainerID != nil {
			return *mount.ContainerID
		}
		return ""
	case "container_name":
		if mount.ContainerName != nil {
			return *mount.ContainerName
		}
		return ""
	case "container_image":
		if mount.ContainerImage != nil {
			return *mount.ContainerImage
		}
		return ""
	case "read_only":
		if mount.ReadOnly {
			return "true"
		}
		return "false"
	case "is_orphaned":
		if mount.IsOrphaned {
			return "true"
		}
		return "false"
	default:
		// Check metadata for custom fields
		if mount.Metadata != nil {
			if value, exists := mount.Metadata[fieldName]; exists {
				return value
			}
		}
		return ""
	}
}

// Evaluation functions for different operators

func (e *TrackingRulesEngine) evaluateEquals(fieldValue string, conditionValue *string, caseSensitive bool) bool {
	if conditionValue == nil {
		return fieldValue == ""
	}
	
	if caseSensitive {
		return fieldValue == *conditionValue
	}
	return strings.EqualFold(fieldValue, *conditionValue)
}

func (e *TrackingRulesEngine) evaluatePrefix(fieldValue string, conditionValue *string, caseSensitive bool) bool {
	if conditionValue == nil {
		return true
	}
	
	if caseSensitive {
		return strings.HasPrefix(fieldValue, *conditionValue)
	}
	return strings.HasPrefix(strings.ToLower(fieldValue), strings.ToLower(*conditionValue))
}

func (e *TrackingRulesEngine) evaluateSuffix(fieldValue string, conditionValue *string, caseSensitive bool) bool {
	if conditionValue == nil {
		return true
	}
	
	if caseSensitive {
		return strings.HasSuffix(fieldValue, *conditionValue)
	}
	return strings.HasSuffix(strings.ToLower(fieldValue), strings.ToLower(*conditionValue))
}

func (e *TrackingRulesEngine) evaluateContains(fieldValue string, conditionValue *string, caseSensitive bool) bool {
	if conditionValue == nil {
		return true
	}
	
	if caseSensitive {
		return strings.Contains(fieldValue, *conditionValue)
	}
	return strings.Contains(strings.ToLower(fieldValue), strings.ToLower(*conditionValue))
}

func (e *TrackingRulesEngine) evaluateRegex(fieldValue string, conditionValue *string, caseSensitive bool) (bool, error) {
	if conditionValue == nil {
		return true, nil
	}
	
	pattern := *conditionValue
	if !caseSensitive {
		pattern = "(?i)" + pattern
	}
	
	regex, err := regexp.Compile(pattern)
	if err != nil {
		return false, fmt.Errorf("invalid regex pattern: %w", err)
	}
	
	return regex.MatchString(fieldValue), nil
}

func (e *TrackingRulesEngine) evaluateGlob(fieldValue string, conditionValue *string, caseSensitive bool) bool {
	if conditionValue == nil {
		return true
	}
	
	// Convert glob pattern to regex
	pattern := strings.ReplaceAll(*conditionValue, "*", ".*")
	pattern = strings.ReplaceAll(pattern, "?", ".")
	
	if !caseSensitive {
		pattern = "(?i)" + pattern
	}
	
	regex, err := regexp.Compile("^" + pattern + "$")
	if err != nil {
		return false
	}
	
	return regex.MatchString(fieldValue)
}

func (e *TrackingRulesEngine) evaluateIn(fieldValue string, conditionValues []string, caseSensitive bool) bool {
	if len(conditionValues) == 0 {
		return true
	}
	
	for _, value := range conditionValues {
		if caseSensitive {
			if fieldValue == value {
				return true
			}
		} else {
			if strings.EqualFold(fieldValue, value) {
				return true
			}
		}
	}
	return false
}

// Helper functions

func getConditionValue(condition repo.TrackingCondition) string {
	if condition.Value != nil {
		return *condition.Value
	}
	if len(condition.Values) > 0 {
		return strings.Join(condition.Values, ", ")
	}
	return ""
}

func (e *TrackingRulesEngine) getAllMounts(ctx context.Context) ([]*MountInfo, error) {
	catalogEntries, err := e.mountsRepo.ListAllMounts(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get all mounts from catalog: %w", err)
	}

	mounts := make([]*MountInfo, len(catalogEntries))
	for i, entry := range catalogEntries {
		mounts[i] = convertCatalogEntryToMountInfo(entry)
	}

	return mounts, nil
}

// convertCatalogEntryToMountInfo converts a catalog entry to mount info for rule evaluation
func convertCatalogEntryToMountInfo(entry *repo.MountCatalogEntry) *MountInfo {
	var driver string
	if entry.VolumeDriver != nil {
		driver = *entry.VolumeDriver
	} else {
		driver = "local" // Default driver for volumes
	}

	// For bind mounts, the SourcePath is the host path
	var hostPath *string
	if entry.MountType == "bind" {
		hostPath = &entry.SourcePath
	}

	return &MountInfo{
		ID:              entry.ID,
		MountID:         entry.MountID,
		MountType:       entry.MountType,
		Driver:          driver,
		VolumeName:      entry.VolumeName,
		HostPath:        hostPath,
		ContainerPath:   entry.SourcePath, // For volumes, this represents the container path
		ComposeProject:  entry.ComposeProject,
		ComposeServices: entry.ComposeServices,
		ReadOnly:        false, // Would need to get from mount attachments
		IsOrphaned:      entry.IsOrphaned,
		CreatedAt:       time.Time{}, // Initialize with zero time
		UpdatedAt:       time.Time{}, // Initialize with zero time
		Metadata:        entry.Metadata,
		// These fields would need to be populated from container information
		ContainerID:     nil,
		ContainerName:   nil,
		ContainerImage:  nil,
	}
}

// Result structures for full evaluation

type FullEvaluationResult struct {
	EvaluationType    string                            `json:"evaluation_type"`
	TriggeredBy       *string                           `json:"triggered_by"`
	StartedAt         time.Time                         `json:"started_at"`
	CompletedAt       time.Time                         `json:"completed_at"`
	ExecutionTimeMs   int64                             `json:"execution_time_ms"`
	TotalMounts       int32                             `json:"total_mounts"`
	TotalRules        int32                             `json:"total_rules"`
	MountsMatched     int32                             `json:"mounts_matched"`
	MountsIncluded    int32                             `json:"mounts_included"`
	MountsExcluded    int32                             `json:"mounts_excluded"`
	MountResults      map[int64]*MountEvaluationResult  `json:"mount_results"`
	RulePerformance   []*RulePerformanceResult          `json:"rule_performance"`
}

type MountEvaluationResult struct {
	MountID     int64                   `json:"mount_id"`
	MountName   string                  `json:"mount_name"`
	FinalAction string                  `json:"final_action"` // include, exclude, none
	WinningRule *RuleEvaluationResult   `json:"winning_rule"`
	RuleResults []*RuleEvaluationResult `json:"rule_results"`
}

type RulePerformanceResult struct {
	RuleID            int64   `json:"rule_id"`
	RuleName          string  `json:"rule_name"`
	MountsEvaluated   int32   `json:"mounts_evaluated"`
	MountsMatched     int32   `json:"mounts_matched"`
	AvgExecutionTimeMs int64  `json:"avg_execution_time_ms"`
	TotalExecutionTimeMs int64 `json:"total_execution_time_ms"`
}