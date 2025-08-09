#!/bin/bash

# Check for client drift between OpenAPI spec and generated TypeScript client
# This script should be run in CI to ensure the generated client is up to date

echo "🔍 Checking for client drift..."

# Store current state of generated client
if [ -f "frontend/src/api/generated/volumeviz-api.ts" ]; then
    cp frontend/src/api/generated/volumeviz-api.ts /tmp/client-before.ts
    echo "📁 Backed up current client"
else
    touch /tmp/client-before.ts
    echo "⚠️  No existing client found"
fi

# Regenerate client
echo "🔄 Regenerating TypeScript client..."
cd frontend
npx swagger-typescript-api generate \
    -p ../docs/openapi.yaml \
    -o src/api/generated \
    -n volumeviz-api.ts \
    --responses \
    --union-enums \
    --clean-output
cd ..

# Compare files
if diff -q /tmp/client-before.ts frontend/src/api/generated/volumeviz-api.ts > /dev/null; then
    echo "✅ No client drift detected - OpenAPI spec and generated client are in sync"
    exit 0
else
    echo "❌ Client drift detected!"
    echo "📋 The generated TypeScript client differs from the committed version."
    echo "🔧 This means the OpenAPI spec has changed but the client wasn't regenerated."
    echo ""
    echo "To fix this issue:"
    echo "  1. Run: npm run generate-types"
    echo "  2. Review the changes in frontend/src/api/generated/"
    echo "  3. Commit the updated client"
    echo ""
    echo "Diff summary:"
    diff --brief /tmp/client-before.ts frontend/src/api/generated/volumeviz-api.ts || true
    exit 1
fi