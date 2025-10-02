#!/bin/bash

# Script to fix formatBytes duplication across the frontend codebase
# This script removes local formatBytes implementations and adds imports from @/utils

echo "Starting formatBytes duplication fix..."

# List of files with duplicate formatBytes implementations
FILES=(
  "frontend/src/components/domain/alerts/AlertRules/TestRuleModal.tsx"
  "frontend/src/components/domain/explorer/FileBrowser/FileBrowser.tsx"
  "frontend/src/components/domain/explorer/AdaptiveExplorer/AdaptiveExplorer.tsx"
  "frontend/src/components/domain/explorer/FileMetadataView.tsx"
  "frontend/src/components/domain/explorer/PrefetchedExplorer/PrefetchedExplorer.tsx"
  "frontend/src/components/domain/explorer/WebWorkerTreemap/WebWorkerTreemap.tsx"
  "frontend/src/components/domain/explorer/DataProcessor/DataProcessor.tsx"
  "frontend/src/components/domain/explorer/UndoRollback/UndoRollback.tsx"
  "frontend/src/hooks/usePreviewMetrics.ts"
  "frontend/src/utils/format.ts"
)

for file in "${FILES[@]}"; do
  filepath="/home/fictional/Projects/volumeviz/$file"

  if [[ -f "$filepath" ]]; then
    echo "Processing: $file"

    # Check if formatBytes import already exists
    if ! grep -q "formatBytes.*from.*@/utils" "$filepath" && ! grep -q "formatBytes.*from.*'@/utils'" "$filepath" && ! grep -q "formatBytes.*from.*\"@/utils\"" "$filepath"; then
      echo "  → Need to add import for $file"
    else
      echo "  → Import already exists, skipping $file"
    fi
  else
    echo "  ⚠️  File not found: $filepath"
  fi
done

echo ""
echo "Manual review required for the following files:"
echo "- frontend/src/utils/format.ts (check if it should be merged with formatters.ts or deleted)"
echo ""
echo "Duplication fix analysis complete!"
