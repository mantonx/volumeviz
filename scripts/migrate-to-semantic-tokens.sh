#!/bin/bash

# Migration script to replace dark: Tailwind classes with semantic tokens
# Usage: ./scripts/migrate-to-semantic-tokens.sh <file-path>

FILE="$1"

if [ -z "$FILE" ]; then
  echo "Usage: $0 <file-path>"
  exit 1
fi

if [ ! -f "$FILE" ]; then
  echo "Error: File not found: $FILE"
  exit 1
fi

echo "Migrating $FILE to semantic tokens..."

# Create backup
cp "$FILE" "$FILE.backup"

# Text colors
sed -i 's/text-gray-900 dark:text-white/text-gray-900 dark:text-white/g' "$FILE"
sed -i 's/text-gray-900 dark:text-gray-50/text-gray-900 dark:text-gray-50/g' "$FILE"
sed -i 's/text-gray-800 dark:text-white/text-gray-800 dark:text-white/g' "$FILE"
sed -i 's/text-gray-700 dark:text-gray-200/text-gray-700 dark:text-gray-200/g' "$FILE"
sed -i 's/text-gray-700 dark:text-gray-300/text-gray-700 dark:text-gray-300/g' "$FILE"
sed -i 's/text-gray-600 dark:text-gray-300/text-gray-600 dark:text-gray-300/g' "$FILE"
sed -i 's/text-gray-600 dark:text-gray-400/text-gray-600 dark:text-gray-400/g' "$FILE"
sed -i 's/text-gray-500 dark:text-gray-400/text-gray-500 dark:text-gray-400/g' "$FILE"
sed -i 's/text-gray-500 dark:text-gray-500/text-gray-500 dark:text-gray-500/g' "$FILE"

# Backgrounds
sed -i 's/bg-white dark:bg-gray-900/bg-white dark:bg-gray-900/g' "$FILE"
sed -i 's/bg-white dark:bg-gray-800/bg-white dark:bg-gray-800/g' "$FILE"
sed -i 's/bg-gray-50 dark:bg-gray-900/bg-gray-50 dark:bg-gray-900/g' "$FILE"
sed -i 's/bg-gray-50 dark:bg-gray-800/bg-gray-50 dark:bg-gray-800/g' "$FILE"
sed -i 's/bg-gray-100 dark:bg-gray-900/bg-gray-100 dark:bg-gray-900/g' "$FILE"
sed -i 's/bg-gray-100 dark:bg-gray-800/bg-gray-100 dark:bg-gray-800/g' "$FILE"
sed -i 's/bg-gray-100 dark:bg-gray-700/bg-gray-100 dark:bg-gray-700/g' "$FILE"

# Borders
sed -i 's/border-gray-200 dark:border-gray-700/border-gray-200 dark:border-gray-700/g' "$FILE"
sed -i 's/border-gray-200 dark:border-gray-800/border-gray-200 dark:border-gray-800/g' "$FILE"
sed -i 's/border-gray-300 dark:border-gray-700/border-gray-300 dark:border-gray-700/g' "$FILE"
sed -i 's/border-gray-300 dark:border-gray-600/border-gray-300 dark:border-gray-600/g' "$FILE"

# Hover states
sed -i 's/hover:bg-gray-50 dark:hover:bg-gray-800/hover:bg-gray-50 dark:hover:bg-gray-800/g' "$FILE"
sed -i 's/hover:bg-gray-100 dark:hover:bg-gray-800/hover:bg-gray-100 dark:hover:bg-gray-800/g' "$FILE"
sed -i 's/hover:bg-gray-100 dark:hover:bg-gray-700/hover:bg-gray-100 dark:hover:bg-gray-700/g' "$FILE"

echo "Migration complete. Backup saved to $FILE.backup"
echo "Please review the changes manually."
