/**
 * File Age Analysis Utility Functions
 *
 * Functions for calculating file ages, categorizing into buckets,
 * and aggregating statistics.
 */

import type {
  FileItem,
  AgeBucket,
  AgeBucketType,
  AgeAnalysisData,
  TimelineDataPoint,
  AgeSummaryStats,
} from './FileAgeAnalysis.types';
import { AGE_BUCKET_CONFIG } from './FileAgeAnalysis.types';

/**
 * Calculate age in days from modified_time
 */
export function calculateFileAge(modifiedTime?: string): number {
  if (!modifiedTime) return -1; // Unknown age

  const now = new Date();
  const modified = new Date(modifiedTime);

  // Handle invalid dates
  if (isNaN(modified.getTime())) return -1;

  // Handle future dates (clock skew) - treat as very recent
  if (modified > now) return 0;

  const ageInMs = now.getTime() - modified.getTime();
  const ageInDays = Math.floor(ageInMs / (1000 * 60 * 60 * 24));

  return ageInDays;
}

/**
 * Determine which age bucket a file belongs to
 */
export function getAgeBucket(ageInDays: number): AgeBucketType {
  if (ageInDays < 0) return 'ancient'; // Unknown = treat as ancient

  if (ageInDays <= 7) return 'veryRecent';
  if (ageInDays <= 30) return 'recent';
  if (ageInDays <= 90) return 'medium';
  if (ageInDays <= 180) return 'old';
  if (ageInDays <= 365) return 'veryOld';
  return 'ancient';
}

/**
 * Analyze files and group them by age buckets
 */
export function analyzeFilesByAge(files: FileItem[]): AgeAnalysisData {
  // Initialize buckets
  const bucketMap = new Map<AgeBucketType, AgeBucket>();

  Object.entries(AGE_BUCKET_CONFIG).forEach(([id, config]) => {
    bucketMap.set(id as AgeBucketType, {
      id: id as AgeBucketType,
      label: config.label,
      description: config.description,
      ageRange: config.ageRange,
      fileCount: 0,
      totalSize: 0,
      percentage: 0,
      sizePercentage: 0,
      color: config.color,
      darkColor: config.darkColor,
      files: [],
    });
  });

  // Filter out directories and categorize files
  const fileItems = files.filter((file) => !file.is_directory);
  const totalFiles = fileItems.length;
  const totalSize = fileItems.reduce((sum, file) => sum + (file.size || 0), 0);

  // Calculate ages and categorize
  const agesArray: number[] = [];

  fileItems.forEach((file) => {
    const age = calculateFileAge(file.modified_time);
    if (age >= 0) {
      agesArray.push(age);
    }

    const bucketType = getAgeBucket(age);
    const bucket = bucketMap.get(bucketType);

    if (bucket) {
      bucket.fileCount++;
      bucket.totalSize += file.size || 0;
      bucket.files.push(file);
    }
  });

  // Calculate percentages
  bucketMap.forEach((bucket) => {
    bucket.percentage = totalFiles > 0 ? (bucket.fileCount / totalFiles) * 100 : 0;
    bucket.sizePercentage = totalSize > 0 ? (bucket.totalSize / totalSize) * 100 : 0;
  });

  // Convert to array and sort by age (youngest to oldest)
  const buckets = Array.from(bucketMap.values());

  // Calculate statistics
  const averageAge = agesArray.length > 0
    ? agesArray.reduce((sum, age) => sum + age, 0) / agesArray.length
    : 0;

  // Calculate median age
  const sortedAges = [...agesArray].sort((a, b) => a - b);
  const medianAge = sortedAges.length > 0
    ? sortedAges.length % 2 === 0
      ? (sortedAges[sortedAges.length / 2 - 1] + sortedAges[sortedAges.length / 2]) / 2
      : sortedAges[Math.floor(sortedAges.length / 2)]
    : 0;

  // Find oldest and newest files
  let oldestFile: FileItem | null = null;
  let oldestAge = -1;
  let newestFile: FileItem | null = null;
  let newestAge = Infinity;

  fileItems.forEach((file) => {
    const age = calculateFileAge(file.modified_time);
    if (age >= 0) {
      if (age > oldestAge) {
        oldestAge = age;
        oldestFile = file;
      }
      if (age < newestAge) {
        newestAge = age;
        newestFile = file;
      }
    }
  });

  // Build distribution map
  const distributionByAge: Record<AgeBucketType, number> = {
    veryRecent: bucketMap.get('veryRecent')?.percentage || 0,
    recent: bucketMap.get('recent')?.percentage || 0,
    medium: bucketMap.get('medium')?.percentage || 0,
    old: bucketMap.get('old')?.percentage || 0,
    veryOld: bucketMap.get('veryOld')?.percentage || 0,
    ancient: bucketMap.get('ancient')?.percentage || 0,
  };

  return {
    buckets,
    totalFiles,
    totalSize,
    averageAge,
    medianAge,
    oldestFile,
    newestFile,
    distributionByAge,
  };
}

/**
 * Generate timeline data for file modifications
 * Groups files by date buckets (day, week, or month depending on range)
 */
export function generateTimelineData(
  files: FileItem[],
  timeRange: number = 30,
): TimelineDataPoint[] {
  const now = new Date();
  const cutoffDate = new Date(now.getTime() - timeRange * 24 * 60 * 60 * 1000);

  // Determine bucket size based on time range
  const bucketSizeInDays = timeRange <= 30 ? 1 : timeRange <= 90 ? 7 : 30;

  // Create date buckets
  const bucketMap = new Map<string, { count: number; size: number }>();

  const fileItems = files.filter((file) => !file.is_directory);

  fileItems.forEach((file) => {
    if (!file.modified_time) return;

    const modifiedDate = new Date(file.modified_time);
    if (modifiedDate < cutoffDate || modifiedDate > now) return;

    // Calculate bucket key
    const bucketDate = new Date(modifiedDate);
    if (bucketSizeInDays === 1) {
      // Daily buckets
      bucketDate.setHours(0, 0, 0, 0);
    } else if (bucketSizeInDays === 7) {
      // Weekly buckets - start of week
      const dayOfWeek = bucketDate.getDay();
      bucketDate.setDate(bucketDate.getDate() - dayOfWeek);
      bucketDate.setHours(0, 0, 0, 0);
    } else {
      // Monthly buckets - start of month
      bucketDate.setDate(1);
      bucketDate.setHours(0, 0, 0, 0);
    }

    const bucketKey = bucketDate.toISOString().split('T')[0];

    const existing = bucketMap.get(bucketKey) || { count: 0, size: 0 };
    existing.count++;
    existing.size += file.size || 0;
    bucketMap.set(bucketKey, existing);
  });

  // Convert to array and fill gaps
  const timeline: TimelineDataPoint[] = [];
  const currentDate = new Date(cutoffDate);
  currentDate.setHours(0, 0, 0, 0);

  while (currentDate <= now) {
    const dateKey = currentDate.toISOString().split('T')[0];
    const data = bucketMap.get(dateKey) || { count: 0, size: 0 };

    timeline.push({
      date: dateKey,
      count: data.count,
      size: data.size,
      label: formatDateLabel(currentDate, bucketSizeInDays),
    });

    // Move to next bucket
    if (bucketSizeInDays === 1) {
      currentDate.setDate(currentDate.getDate() + 1);
    } else if (bucketSizeInDays === 7) {
      currentDate.setDate(currentDate.getDate() + 7);
    } else {
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
  }

  return timeline;
}

/**
 * Format date label based on bucket size
 */
function formatDateLabel(date: Date, bucketSizeInDays: number): string {
  if (bucketSizeInDays === 1) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } else if (bucketSizeInDays === 7) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
}

/**
 * Calculate summary statistics
 */
export function calculateAgeSummary(analysisData: AgeAnalysisData): AgeSummaryStats {
  const oldBuckets = ['old', 'veryOld', 'ancient'] as AgeBucketType[];
  const oldFilesCount = analysisData.buckets
    .filter((b) => oldBuckets.includes(b.id))
    .reduce((sum, b) => sum + b.fileCount, 0);

  const oldFilesSize = analysisData.buckets
    .filter((b) => oldBuckets.includes(b.id))
    .reduce((sum, b) => sum + b.totalSize, 0);

  const oldFilesPercentage =
    analysisData.totalFiles > 0 ? (oldFilesCount / analysisData.totalFiles) * 100 : 0;

  return {
    totalFiles: analysisData.totalFiles,
    totalSize: analysisData.totalSize,
    averageAge: analysisData.averageAge,
    medianAge: analysisData.medianAge,
    oldestFile: analysisData.oldestFile,
    newestFile: analysisData.newestFile,
    oldFilesCount,
    oldFilesSize,
    oldFilesPercentage,
  };
}

/**
 * Format file size to human-readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (!bytes || bytes < 0) return 'Unknown';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  if (i >= sizes.length) {
    return `${(bytes / Math.pow(k, sizes.length - 1)).toFixed(1)} ${sizes[sizes.length - 1]}`;
  }

  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Format percentage with proper precision
 */
export function formatPercentage(value: number): string {
  if (value === 0) return '0%';
  if (value < 0.1) return '<0.1%';
  if (value < 1) return value.toFixed(1) + '%';
  return value.toFixed(0) + '%';
}

/**
 * Format age in days to human-readable string
 */
export function formatAge(ageInDays: number): string {
  if (ageInDays < 0) return 'Unknown';
  if (ageInDays === 0) return 'Today';
  if (ageInDays === 1) return '1 day ago';
  if (ageInDays < 7) return `${ageInDays} days ago`;
  if (ageInDays < 30) {
    const weeks = Math.floor(ageInDays / 7);
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  }
  if (ageInDays < 365) {
    const months = Math.floor(ageInDays / 30);
    return `${months} month${months > 1 ? 's' : ''} ago`;
  }
  const years = Math.floor(ageInDays / 365);
  const remainingMonths = Math.floor((ageInDays % 365) / 30);
  if (remainingMonths > 0) {
    return `${years} year${years > 1 ? 's' : ''}, ${remainingMonths} month${remainingMonths > 1 ? 's' : ''} ago`;
  }
  return `${years} year${years > 1 ? 's' : ''} ago`;
}

/**
 * Export age analysis data to CSV
 */
export function exportToCSV(analysisData: AgeAnalysisData, volumeId?: string): string {
  const lines: string[] = [];

  // Header
  lines.push('File Age Analysis Report');
  lines.push(`Volume: ${volumeId || 'N/A'}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Total Files: ${analysisData.totalFiles}`);
  lines.push(`Total Size: ${formatFileSize(analysisData.totalSize)}`);
  lines.push(`Average Age: ${formatAge(Math.floor(analysisData.averageAge))}`);
  lines.push('');

  // Bucket summary
  lines.push('Age Bucket,File Count,Total Size (GB),Percentage,Size Percentage');
  analysisData.buckets.forEach((bucket) => {
    lines.push(
      `${bucket.label},${bucket.fileCount},${(bucket.totalSize / (1024 ** 3)).toFixed(2)},${formatPercentage(bucket.percentage)},${formatPercentage(bucket.sizePercentage)}`,
    );
  });

  return lines.join('\n');
}

/**
 * Export age analysis data to JSON
 */
export function exportToJSON(analysisData: AgeAnalysisData, volumeId?: string): string {
  const exportData = {
    volumeId: volumeId || 'unknown',
    analyzedAt: new Date().toISOString(),
    summary: {
      totalFiles: analysisData.totalFiles,
      totalSize: analysisData.totalSize,
      averageAge: analysisData.averageAge,
      medianAge: analysisData.medianAge,
    },
    oldestFile: analysisData.oldestFile
      ? {
          name: analysisData.oldestFile.name,
          path: analysisData.oldestFile.path,
          size: analysisData.oldestFile.size,
          modifiedTime: analysisData.oldestFile.modified_time,
          age: formatAge(calculateFileAge(analysisData.oldestFile.modified_time)),
        }
      : null,
    newestFile: analysisData.newestFile
      ? {
          name: analysisData.newestFile.name,
          path: analysisData.newestFile.path,
          size: analysisData.newestFile.size,
          modifiedTime: analysisData.newestFile.modified_time,
          age: formatAge(calculateFileAge(analysisData.newestFile.modified_time)),
        }
      : null,
    buckets: analysisData.buckets.map((bucket) => ({
      id: bucket.id,
      label: bucket.label,
      description: bucket.description,
      ageRange: bucket.ageRange,
      fileCount: bucket.fileCount,
      totalSize: bucket.totalSize,
      percentage: bucket.percentage,
      sizePercentage: bucket.sizePercentage,
    })),
    distribution: analysisData.distributionByAge,
  };

  return JSON.stringify(exportData, null, 2);
}
