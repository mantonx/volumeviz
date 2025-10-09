# File Age Analysis Component

Comprehensive file age analysis visualization for VolumeViz, providing insights into file modification patterns and helping identify cleanup opportunities.

## Features

### 📊 Multiple Visualizations

1. **Age Distribution Chart** - Bar chart showing file count distribution across age buckets
2. **Storage by Age Chart** - Bar chart showing storage consumption by age group
3. **Timeline Chart** - Area chart showing file modification activity over time
4. **Summary Card** - Key statistics and insights

### 🎯 Age Buckets

Files are categorized into 6 age buckets based on days since last modification:

- **Very Recent** (0-7 days): Green (#10B981)
- **Recent** (8-30 days): Lime (#84CC16)
- **Medium** (1-3 months): Yellow (#EAB308)
- **Old** (3-6 months): Orange (#F97316)
- **Very Old** (6-12 months): Red (#EF4444)
- **Ancient** (1+ years): Dark Red (#991B1B)

### 🔍 Key Insights

- Total file count and storage size
- Average and median file age
- Oldest and newest files with details
- Percentage of old files (6+ months)
- Cleanup recommendations when applicable

### ⚡ Interactive Features

- Click on age buckets to filter files
- Adjustable timeline ranges (30/90/180/365 days)
- Export to CSV or JSON
- Hover tooltips with detailed information
- Responsive design for all screen sizes

## Usage

### Basic Usage

```tsx
import { FileAgeAnalysis } from '@/components/domain/analytics/FileAgeAnalysis';

function MyComponent() {
  const [files, setFiles] = useState<FileItem[]>([]);

  return (
    <FileAgeAnalysis
      files={files}
      volumeId="my-volume"
      onFileClick={(file) => console.log('File clicked:', file)}
      onFilterByAge={(bucket) => console.log('Filter by:', bucket)}
    />
  );
}
```

### With File Filtering

```tsx
import { FileAgeAnalysis } from '@/components/domain/analytics/FileAgeAnalysis';
import { useState } from 'react';

function VolumeAnalytics() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<FileItem[]>(files);

  const handleFilterByAge = (bucket: AgeBucket) => {
    // Filter files to show only those in the selected age bucket
    const filtered = bucket.files;
    setFilteredFiles(filtered);
  };

  return (
    <>
      <FileAgeAnalysis
        files={files}
        volumeId="data-volume"
        onFilterByAge={handleFilterByAge}
      />
      <FileList files={filteredFiles} />
    </>
  );
}
```

## Props

### FileAgeAnalysis

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `files` | `FileItem[]` | Yes | Array of files to analyze |
| `volumeId` | `string` | No | Volume identifier for export metadata |
| `onFileClick` | `(file: FileItem) => void` | No | Callback when a file is clicked |
| `onFilterByAge` | `(bucket: AgeBucket) => void` | No | Callback when age bucket is clicked for filtering |
| `className` | `string` | No | Additional CSS classes |

### FileItem Interface

```typescript
interface FileItem {
  id?: number;
  name: string;
  path: string;
  size?: number;
  is_directory: boolean;
  modified_time?: string; // ISO 8601 format
  extension?: string;
  media_type?: string;
}
```

## Data Processing

### Age Calculation

```typescript
import { calculateFileAge, getAgeBucket } from './fileAgeUtils';

const age = calculateFileAge(file.modified_time);
// Returns: number of days since modification

const bucket = getAgeBucket(age);
// Returns: 'veryRecent' | 'recent' | 'medium' | 'old' | 'veryOld' | 'ancient'
```

### Analysis

```typescript
import { analyzeFilesByAge } from './fileAgeUtils';

const analysis = analyzeFilesByAge(files);
// Returns: AgeAnalysisData with buckets, statistics, and insights
```

### Timeline Generation

```typescript
import { generateTimelineData } from './fileAgeUtils';

const timeline = generateTimelineData(files, 30); // Last 30 days
// Returns: Array of TimelineDataPoint with daily/weekly/monthly buckets
```

## Export Formats

### CSV Export

```csv
File Age Analysis Report
Volume: my-volume
Generated: 2025-10-08T12:00:00Z
Total Files: 1,234
Total Size: 45.6 GB
Average Age: 128 days

Age Bucket,File Count,Total Size (GB),Percentage,Size Percentage
0-7 days,156,2.30,12.6%,5.0%
8-30 days,234,4.50,19.0%,9.9%
...
```

### JSON Export

```json
{
  "volumeId": "my-volume",
  "analyzedAt": "2025-10-08T12:00:00Z",
  "summary": {
    "totalFiles": 1234,
    "totalSize": 48991232,
    "averageAge": 128.5,
    "medianAge": 95
  },
  "buckets": [...],
  "distribution": {...}
}
```

## Components

### AgeDistributionChart

Bar chart showing file count distribution.

```tsx
<AgeDistributionChart
  buckets={analysisData.buckets}
  isDarkMode={false}
  onBucketClick={(bucket) => console.log(bucket)}
  height={300}
/>
```

### StorageByAgeChart

Bar chart showing storage size distribution.

```tsx
<StorageByAgeChart
  buckets={analysisData.buckets}
  isDarkMode={false}
  onBucketClick={(bucket) => console.log(bucket)}
  height={300}
/>
```

### AgeTimelineChart

Area chart showing modification activity over time.

```tsx
<AgeTimelineChart
  timelineData={timelineData}
  timeRange={30}
  isDarkMode={false}
  height={250}
/>
```

### AgeSummaryCard

Summary statistics and insights card.

```tsx
<AgeSummaryCard
  stats={summaryStats}
  onFileClick={(file) => console.log(file)}
/>
```

## Performance Considerations

- **Memoization**: All expensive calculations are memoized with `useMemo`
- **Large Datasets**: Optimized for 10,000+ files
- **Chart Rendering**: Uses Recharts with efficient re-rendering
- **Date Parsing**: Cached date calculations to avoid repeated parsing

## Edge Cases Handled

- **No modified_time**: Files without modification time are categorized as "Ancient"
- **Future dates**: Clock skew results in future dates being treated as "Very Recent"
- **Invalid dates**: Malformed dates are handled gracefully
- **Empty dataset**: Shows appropriate empty state message
- **Single age bucket**: Charts adjust to show meaningful data
- **Zero-size files**: Handled in size calculations

## Styling

- Fully supports dark mode
- Responsive grid layout
- Mobile-friendly charts with adjusted sizes
- Consistent color scheme across all visualizations
- Tailwind CSS classes for easy customization

## Integration with Explorer

The component is designed to integrate seamlessly with the ExplorerPage:

```tsx
// In ExplorerPage.tsx
import { FileAgeAnalysis } from '@/components/domain/analytics/FileAgeAnalysis';

<div className="grid grid-cols-12 gap-6">
  {viewMode === 'analytics' && (
    <div className="col-span-12">
      <FileAgeAnalysis
        files={filteredFiles}
        volumeId={volumeId}
        onFileClick={handleFileClick}
      />
    </div>
  )}
</div>
```

## Future Enhancements

- [ ] Compare age distributions across multiple volumes
- [ ] Trend analysis showing age distribution changes over time
- [ ] Automated cleanup recommendations with confidence scores
- [ ] Schedule periodic age analysis reports
- [ ] Integration with file archival workflows
- [ ] Custom age bucket configuration
- [ ] Advanced filtering (combine age with size, type, etc.)

## Contributing

When adding features or fixing bugs:

1. Maintain TypeScript type safety
2. Add appropriate tests
3. Update this README
4. Follow existing code patterns
5. Ensure dark mode compatibility

## License

Part of VolumeViz - Docker Volume Analytics Platform
