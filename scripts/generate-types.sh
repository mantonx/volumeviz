#!/bin/bash

# Generate TypeScript types from OpenAPI spec

echo "🔧 Generating TypeScript types from OpenAPI spec..."

# Create output directory
mkdir -p frontend/src/api/generated

# Generate TypeScript types using swagger-typescript-api
cd frontend
npx swagger-typescript-api generate \
    -p ../docs/swagger.json \
    -o src/api/generated \
    -n volumeviz-api.ts \
    --responses \
    --union-enums

echo "✅ TypeScript types generated in frontend/src/api/generated/"
echo "📖 Import example:"
echo "   import { Api, VolumeListResponse, ScanResponse } from './api/generated/volumeviz-api'"
echo "   const api = new Api({ baseUrl: 'http://localhost:8080/api/v1' })"
echo "   const volumes = await api.volumes.volumesList()"