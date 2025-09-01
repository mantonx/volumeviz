#!/bin/bash

echo "🔍 Checking for missing action imports in story files..."

# Find all story files
find /home/fictional/Projects/volumeviz/frontend/src -name "*.stories.tsx" | while read -r file; do
  # Check if file uses action( but doesn't import it
  if grep -q "action(" "$file"; then
    if ! grep -q "import.*action.*from.*storybook-utils" "$file"; then
      echo "🔧 Fixing missing action import in: $(basename "$file")"
      
      # Add the import after the first import statement or at the beginning
      if grep -q "^import" "$file"; then
        # Find the line number of the first import statement
        first_import_line=$(grep -n "^import" "$file" | head -1 | cut -d: -f1)
        
        # Insert the action import after the first import
        sed -i "${first_import_line}a\\import { action } from '@/utils/storybook-utils';" "$file"
      else
        # If no imports exist, add at the beginning
        sed -i "1i\\import { action } from '@/utils/storybook-utils';" "$file"
      fi
      
      echo "   ✅ Fixed: $(basename "$file")"
    fi
  fi
done

echo "✨ Action import check complete!"

# List all files that now have the action import
echo ""
echo "📊 Files with action import:"
grep -l "import.*action.*from.*storybook-utils" /home/fictional/Projects/volumeviz/frontend/src/**/*.stories.tsx 2>/dev/null | while read -r file; do
  echo "   ✓ $(basename "$file")"
done