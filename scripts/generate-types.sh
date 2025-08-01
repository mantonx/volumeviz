#!/bin/bash

# Generate TypeScript types from OpenAPI spec

echo "🔧 Generating TypeScript types from OpenAPI spec..."

# Check if server is running
if ! curl -s http://localhost:8080/swagger/doc.json > /dev/null 2>&1; then
    echo "❌ Server not running. Please start the VolumeViz server first:"
    echo "   go run ./cmd/server"
    exit 1
fi

# Create output directory
mkdir -p frontend/src/api/generated

# Generate TypeScript types using openapi-generator
cd frontend
npx @openapitools/openapi-generator-cli generate \
    -i http://localhost:8080/swagger/doc.json \
    -g typescript-fetch \
    -o src/api/generated \
    --additional-properties=typescriptThreePlus=true,supportsES6=true,npmName=volumeviz-api,npmVersion=1.0.0

echo "✅ TypeScript types generated in frontend/src/api/generated/"
echo "📖 Import example:"
echo "   import { DefaultApi, Configuration } from './api/generated'"
echo "   const api = new DefaultApi(new Configuration({ basePath: 'http://localhost:8080/api/v1' }))"