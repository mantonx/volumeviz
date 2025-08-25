#!/bin/bash

# Filesystem Indexer: Folder Tree & File Records - Verification Script
# This script checks that all ticket requirements are implemented

echo "=== Filesystem Indexer: Folder Tree & File Records Verification ==="
echo

# Check 1: Database Schema
echo "✅ Checking Database Schema..."
echo "   Required tables: folders, files"
echo "   Required indexes: files(volume_id,folder_id,media_kind), files(hash_algo,hash), folders(volume_id,path_hash)"

# Check for folders table
grep -r "CREATE TABLE.*folders" migrations/ && echo "   ✓ folders table found" || echo "   ✗ folders table missing"

# Check for files table
grep -r "CREATE TABLE.*files" migrations/ && echo "   ✓ files table found" || echo "   ✗ files table missing"

# Check for required columns in folders
echo "   Checking folders table columns..."
grep -A 20 "CREATE TABLE.*folders" migrations/000004_create_filesystem_indexer.up.sql | grep -E "(parent_id|volume_id|name|path|path_hash|size_bytes_recursive|disk_usage_bytes_recursive|file_count|dir_count)" | wc -l | xargs -I {} echo "   ✓ Found {} of 9 required folders columns"

# Check for required columns in files
echo "   Checking files table columns..."
grep -A 30 "CREATE TABLE.*files" migrations/000004_create_filesystem_indexer.up.sql | grep -E "(folder_id|volume_id|name|path|extension|size_bytes|disk_usage_bytes|mtime|ctime|birthtime|uid|gid|mode|inode|device|is_symlink|symlink_target|mime|media_kind|encoding|hash_algo|hash)" | wc -l | xargs -I {} echo "   ✓ Found {} of 22 required files columns"

# Check for required indexes
grep -r "idx_files_volume_media_kind\|idx_files_hash_algo_hash\|idx_folders_volume_path_hash" migrations/ && echo "   ✓ Required indexes found" || echo "   ✗ Some required indexes missing"
echo

# Check 2: Configuration Options
echo "✅ Checking Configuration Options..."
grep -r "VV_ENABLE_HASHING" internal/config/ && echo "   ✓ VV_ENABLE_HASHING found" || echo "   ✗ VV_ENABLE_HASHING missing"
grep -r "VV_MAX_FILE_BYTES_FOR_HASH" internal/config/ && echo "   ✓ VV_MAX_FILE_BYTES_FOR_HASH found" || echo "   ✗ VV_MAX_FILE_BYTES_FOR_HASH missing"
grep -r "VV_HASH_ALGO" internal/config/ && echo "   ✓ VV_HASH_ALGO found" || echo "   ✗ VV_HASH_ALGO missing"
echo

# Check 3: Filesystem Indexer Implementation
echo "✅ Checking Filesystem Indexer Implementation..."
[ -f "internal/services/filesystem/filesystem_indexer.go" ] && echo "   ✓ FilesystemIndexer implementation found" || echo "   ✗ FilesystemIndexer implementation missing"

# Check streaming walker
grep -r "walk.*rootPath" internal/services/filesystem/ && echo "   ✓ Streaming filesystem walker found" || echo "   ✗ Streaming walker missing"

# Check skip rules
grep -r "shouldSkip.*SkipPatterns" internal/services/filesystem/ && echo "   ✓ Skip rules implementation found" || echo "   ✗ Skip rules implementation missing"
echo

# Check 4: MIME Detection & Media Kind Classification
echo "✅ Checking MIME Detection & Media Kind..."
grep -r "MimeDetector\|DetectFile" internal/services/filesystem/ && echo "   ✓ MIME detection implementation found" || echo "   ✗ MIME detection missing"
grep -r "media_kind\|classifyMediaKind" internal/services/filesystem/ && echo "   ✓ Media kind classification found" || echo "   ✗ Media kind classification missing"
echo

# Check 5: Hashing Implementation
echo "✅ Checking Optional Hashing..."
grep -r "EnableHashing\|calculateFileHash" internal/services/filesystem/ && echo "   ✓ File hashing implementation found" || echo "   ✗ File hashing missing"
grep -r "MaxFileBytesForHash\|HashAlgorithm" internal/services/filesystem/ && echo "   ✓ Hashing configuration found" || echo "   ✗ Hashing configuration missing"
echo

# Check 6: Repository Layer
echo "✅ Checking Repository Layer..."
[ -f "internal/repo/folders_repo.go" ] && echo "   ✓ FoldersRepo implementation found" || echo "   ✗ FoldersRepo missing"
[ -f "internal/repo/files_repo.go" ] && echo "   ✓ FilesRepo implementation found" || echo "   ✗ FilesRepo missing"

# Check delta vs full scan support
grep -r "deltaMode\|shouldUpdate" internal/services/filesystem/ && echo "   ✓ Delta scan support found" || echo "   ✗ Delta scan support missing"
echo

# Check 7: Path Hashing
echo "✅ Checking Path Hashing..."
grep -r "pathHash\|sha256.*Path" internal/repo/ && echo "   ✓ Path hashing implementation found" || echo "   ✗ Path hashing missing"
echo

# Check 8: Symlink Support
echo "✅ Checking Symlink Support..."
grep -r "is_symlink\|symlink_target\|IsSymlink" migrations/ internal/repo/ && echo "   ✓ Symlink support found" || echo "   ✗ Symlink support missing"
echo

# Check 9: Test Coverage
echo "✅ Checking Test Coverage..."
[ -f "internal/services/filesystem/filesystem_indexer_test.go" ] && echo "   ✓ Test coverage found" || echo "   ✗ Test coverage missing"
grep -r "TestMimeDetector\|TestIndexer" internal/services/filesystem/ && echo "   ✓ Key functionality tests found" || echo "   ✗ Key functionality tests missing"
echo

echo "=== Summary ==="
echo "The implementation should have:"
echo "- ✅ Enhanced folders & files tables with universal metadata"
echo "- ✅ Streaming filesystem walker with skip rules"
echo "- ✅ MIME detection with extension fallback"
echo "- ✅ Media kind classification"
echo "- ✅ Optional file hashing with configurable thresholds"
echo "- ✅ Path hashing for uniqueness per volume"
echo "- ✅ Symlink detection and target tracking"
echo "- ✅ Delta vs full scan support"
echo "- ✅ Required database indexes for performance"
