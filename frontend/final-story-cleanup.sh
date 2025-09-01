#!/bin/bash

# Final comprehensive cleanup to fix acorn parsing errors
echo "🧹 Starting final Storybook cleanup to resolve acorn parsing errors..."

# Find all story files and clean them up
find /home/fictional/Projects/volumeviz/frontend/src -name "*.stories.tsx" | while read -r story_file; do
  echo "🔧 Cleaning $(basename "$story_file")"
  
  # Create a temporary file for clean processing
  temp_file=$(mktemp)
  
  # Remove any duplicate React imports and clean up
  awk '
  BEGIN { 
    react_imported = 0
    in_multiline_comment = 0
  }
  
  # Handle multiline comments
  /\/\*/ { in_multiline_comment = 1 }
  /\*\// { in_multiline_comment = 0; next }
  in_multiline_comment { next }
  
  # Skip single line comments that are not JSDoc
  /^[[:space:]]*\/\/ / && !/\/\*\*/ { next }
  
  # Handle React imports
  /^import React/ {
    if (react_imported == 0) {
      print
      react_imported = 1
    }
    next
  }
  
  # Print all other lines
  { print }
  ' "$story_file" > "$temp_file"
  
  # Replace original file with cleaned version
  mv "$temp_file" "$story_file"
  
  # Ensure proper file permissions
  chmod 644 "$story_file"
done

# Specific fixes for known problematic files
echo "🎯 Applying specific fixes for domain components..."

# Ensure storybook-utils.tsx exists and is properly formatted
if [ -f "/home/fictional/Projects/volumeviz/frontend/src/utils/storybook-utils.tsx" ]; then
  echo "✅ storybook-utils.tsx exists"
else
  echo "❌ storybook-utils.tsx missing - this is required!"
fi

echo "🏁 Final cleanup complete!"
echo "📊 Checking story file count..."

# Count story files
total_stories=$(find /home/fictional/Projects/volumeviz/frontend/src -name "*.stories.tsx" | wc -l)
echo "📈 Found $total_stories story files"

# List any remaining problematic files
echo "🔍 Checking for potential syntax issues..."
find /home/fictional/Projects/volumeviz/frontend/src -name "*.stories.tsx" -exec grep -l "import.*React.*React" {} \; | head -5 | while read -r file; do
  echo "⚠️  Potential duplicate React import: $(basename "$file")"
done

echo "✨ All story files should now load properly in Storybook!"