#!/bin/sh
# Generates a realistic, varied directory tree for VolumeViz demo mode.
# Designed to run inside a one-shot init container (see docker-compose.demo.yml)
# against an empty Docker volume, before the API scans it.
#
# Goals: enough depth/variety that the Explorer, TreeMap, and search pages
# have something real to show — without taking long to generate or bloating
# the image with a checked-in binary blob.

set -eu

ROOT="${DEMO_DATA_ROOT:-/data}"

echo "Generating demo data under $ROOT ..."

mkfile() {
  # mkfile <path> <size-in-bytes>
  path="$1"
  size="$2"
  mkdir -p "$(dirname "$path")"
  head -c "$size" /dev/urandom > "$path"
}

mktextfile() {
  # mktextfile <path> <line-count>
  path="$1"
  lines="$2"
  mkdir -p "$(dirname "$path")"
  i=0
  : > "$path"
  while [ "$i" -lt "$lines" ]; do
    echo "line $i: the quick brown fox jumps over the lazy dog" >> "$path"
    i=$((i + 1))
  done
}

# --- projects/ : source-control-style tree, lots of small text files ---
for proj in api web infra; do
  for sub in src docs tests; do
    for n in 1 2 3 4 5; do
      mktextfile "$ROOT/projects/$proj/$sub/file_$n.go" $((50 + n * 10))
    done
  done
  mktextfile "$ROOT/projects/$proj/README.md" 40
  mkfile "$ROOT/projects/$proj/.git/objects/pack/pack-demo.pack" $((512 * 1024))
done

# --- media/ : a handful of larger binary files, varied extensions ---
# Sized to be clearly the "big" files in the demo (for size-sort/TreeMap
# contrast) without making first-run generation slow or the volume huge.
mkfile "$ROOT/media/movies/sample_movie_1.mkv" $((25 * 1024 * 1024))
mkfile "$ROOT/media/movies/sample_movie_2.mp4" $((18 * 1024 * 1024))
mkfile "$ROOT/media/tv/show_a/season_01/episode_01.mkv" $((9 * 1024 * 1024))
mkfile "$ROOT/media/tv/show_a/season_01/episode_02.mkv" $((9 * 1024 * 1024))
mkfile "$ROOT/media/tv/show_b/season_01/episode_01.mp4" $((8 * 1024 * 1024))
mkfile "$ROOT/media/photos/2024/vacation/img_001.jpg" $((2 * 1024 * 1024))
mkfile "$ROOT/media/photos/2024/vacation/img_002.jpg" $((2 * 1024 * 1024))
mkfile "$ROOT/media/photos/2025/family/img_003.jpg" $((1 * 1024 * 1024))
mkfile "$ROOT/media/music/album_1/track_01.mp3" $((4 * 1024 * 1024))
mkfile "$ROOT/media/music/album_1/track_02.mp3" $((4 * 1024 * 1024))

# --- backups/ : the largest files in the tree, to exercise size sorting ---
mkfile "$ROOT/backups/db/full_backup_2025_01.sql.gz" $((40 * 1024 * 1024))
mkfile "$ROOT/backups/db/full_backup_2025_02.sql.gz" $((42 * 1024 * 1024))
mkfile "$ROOT/backups/configs/etc_snapshot.tar.gz" $((5 * 1024 * 1024))

# --- documents/ : many small files, deep nesting, for tree/search testing ---
for year in 2022 2023 2024 2025; do
  for q in q1 q2 q3 q4; do
    for n in 1 2 3; do
      mktextfile "$ROOT/documents/reports/$year/$q/report_$n.txt" 20
    done
  done
done

# --- logs/ : lots of tiny files, simulates churn-heavy directories ---
for n in $(seq 1 50); do
  mktextfile "$ROOT/logs/app/2025-06-$(printf '%02d' $((n % 28 + 1)))/service_$n.log" 5
done

echo "Demo data generation complete:"
echo "  Files:       $(find "$ROOT" -type f | wc -l)"
echo "  Directories: $(find "$ROOT" -type d | wc -l)"
echo "  Total size:  $(du -sh "$ROOT" 2>/dev/null | cut -f1)"
