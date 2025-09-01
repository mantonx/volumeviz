#!/bin/bash

# Comprehensive Storybook story repair script
# This script systematically fixes all remaining story files

echo "🔧 Starting comprehensive Storybook story repair..."

# Define directories to process
STORY_DIRS=(
  "src/components/shared"
  "src/components/ui"
  "src/components/layout"
  "src/components/domain"
  "src/components/preview"
  "src/components/application"
)

# Process each story file
for dir in "${STORY_DIRS[@]}"; do
  if [ -d "/home/fictional/Projects/volumeviz/frontend/$dir" ]; then
    echo "📁 Processing directory: $dir"
    
    # Find all story files
    find "/home/fictional/Projects/volumeviz/frontend/$dir" -name "*.stories.tsx" | while read -r story_file; do
      echo "  📝 Processing: $(basename "$story_file")"
      
      # Check if file contains action import errors
      if grep -q "from '@storybook/addon-actions'" "$story_file"; then
        echo "    🔄 Fixing action imports in $(basename "$story_file")"
        sed -i "s/import { action } from '@storybook\/addon-actions';/import { action } from '@\/utils\/storybook-utils';/g" "$story_file"
      fi
      
      # Check if file needs React import for JSX
      if grep -q "jsx\|tsx\|React\." "$story_file" && ! grep -q "import.*React" "$story_file"; then
        echo "    ⚛️  Adding React import to $(basename "$story_file")"
        sed -i "1i\\import React from 'react';" "$story_file"
      fi
      
      # Fix any remaining syntax issues
      if grep -q "import type" "$story_file" && ! grep -q "import React" "$story_file" && grep -q "render:" "$story_file"; then
        echo "    🔧 Adding React import for render functions in $(basename "$story_file")"
        sed -i "2i\\import React from 'react';" "$story_file"
      fi
    done
  fi
done

# Special handling for domain components that may need mock components
DOMAIN_COMPONENTS=(
  "src/components/domain/explorer/VolumeExplorerPanel"
  "src/components/domain/search/SearchInterface"
)

for component_dir in "${DOMAIN_COMPONENTS[@]}"; do
  story_file="/home/fictional/Projects/volumeviz/frontend/$component_dir/$(basename "$component_dir").stories.tsx"
  if [ -f "$story_file" ]; then
    echo "🎯 Processing domain component: $(basename "$component_dir")"
    
    # Ensure these have proper imports
    if ! grep -q "import React" "$story_file"; then
      echo "    ⚛️  Adding React import"
      sed -i "1i\\import React from 'react';" "$story_file"
    fi
    
    if ! grep -q "from '@/utils/storybook-utils'" "$story_file"; then
      echo "    📦 Adding storybook-utils import"
      sed -i "2i\\import { action } from '@/utils/storybook-utils';" "$story_file"
    fi
  fi
done

echo "✅ Comprehensive story repair complete!"
echo "🚀 Storybook should now load without import errors"