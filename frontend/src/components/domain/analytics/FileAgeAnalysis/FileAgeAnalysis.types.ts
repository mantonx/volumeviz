/**
 * Type definitions for File Age Analysis
 */

export interface FileItem {
  id?: number;
  name: string;
  path: string;
  size?: number;
  is_directory: boolean;
  modified_time?: string;
  extension?: string;
  media_type?: string;
}

export type AgeBucketType = 'veryRecent' | 'recent' | 'medium' | 'old' | 'veryOld' | 'ancient';

export interface AgeBucket {
  id: AgeBucketType;
  label: string;
  description: string;
  ageRange: [number, number]; // [min days, max days]
  fileCount: number;
  totalSize: number;
  percentage: number;
  sizePercentage: number;
  color: string;
  darkColor: string;
  files: FileItem[];
}

export interface AgeAnalysisData {
  buckets: AgeBucket[];
  totalFiles: number;
  totalSize: number;
  averageAge: number; // days
  medianAge: number; // days
  oldestFile: FileItem | null;
  newestFile: FileItem | null;
  distributionByAge: Record<AgeBucketType, number>;
}

export interface TimelineDataPoint {
  date: string;
  count: number;
  size: number;
  label: string;
}

export interface FileAgeAnalysisProps {
  files: FileItem[];
  volumeId?: string;
  onFileClick?: (file: FileItem) => void;
  onFilterByAge?: (bucket: AgeBucket) => void;
  className?: string;
}

export type TimeRange = 30 | 90 | 180 | 365;

export interface AgeSummaryStats {
  totalFiles: number;
  totalSize: number;
  averageAge: number;
  medianAge: number;
  oldestFile: FileItem | null;
  newestFile: FileItem | null;
  oldFilesCount: number; // files older than 6 months
  oldFilesSize: number;
  oldFilesPercentage: number;
}

export const AGE_BUCKET_CONFIG: Record<AgeBucketType, {
  label: string;
  description: string;
  ageRange: [number, number];
  color: string;
  darkColor: string;
}> = {
  veryRecent: {
    label: '0-7 days',
    description: 'Very Recent',
    ageRange: [0, 7],
    color: '#10B981', // green-500
    darkColor: '#34D399', // green-400
  },
  recent: {
    label: '8-30 days',
    description: 'Recent',
    ageRange: [8, 30],
    color: '#84CC16', // lime-500
    darkColor: '#A3E635', // lime-400
  },
  medium: {
    label: '1-3 months',
    description: 'Medium Age',
    ageRange: [31, 90],
    color: '#EAB308', // yellow-500
    darkColor: '#FACC15', // yellow-400
  },
  old: {
    label: '3-6 months',
    description: 'Old',
    ageRange: [91, 180],
    color: '#F97316', // orange-500
    darkColor: '#FB923C', // orange-400
  },
  veryOld: {
    label: '6-12 months',
    description: 'Very Old',
    ageRange: [181, 365],
    color: '#EF4444', // red-500
    darkColor: '#F87171', // red-400
  },
  ancient: {
    label: '1+ years',
    description: 'Ancient',
    ageRange: [366, Infinity],
    color: '#991B1B', // red-800
    darkColor: '#DC2626', // red-600
  },
};
