#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// List of unused components from our analysis
const unusedComponents = [
  // UI Components (safest to remove)
  'src/components/ui/ColumnConfig/ColumnConfig.tsx',
  'src/components/ui/DataGrid/DataGrid.tsx',
  'src/components/ui/FilterChips/FilterChips.tsx',
  'src/components/ui/FormField/FormField.tsx',
  'src/components/ui/KeyboardShortcutsHelp/KeyboardShortcutsHelp.tsx',
  'src/components/ui/Modal/Modal.tsx',
  'src/components/ui/Modal/components/ModalBody.tsx',
  'src/components/ui/Modal/components/ModalFooter.tsx',
  'src/components/ui/Modal/components/ModalHeader.tsx',
  'src/components/ui/Pagination/Pagination.tsx',
  'src/components/ui/PhaseTransitionNotification/PhaseTransitionNotification.tsx',
  'src/components/ui/PhaseTransitionToast/PhaseTransitionToast.tsx',
  'src/components/ui/ScanErrorState/ScanErrorState.tsx',
  'src/components/ui/Select/Select.tsx',
  'src/components/ui/SortSelector/SortSelector.tsx',
  
  // Organizations (likely future features)
  'src/components/organizations/OrganizationDashboard/OrganizationDashboard.tsx',
  'src/components/organizations/OrganizationSettings/OrganizationSettings.tsx',
  
  // Application level
  'src/components/application/ErrorBoundaries/APIErrorBoundary.tsx',
  'src/components/application/FilterViewsManager/FilterViewsManager.tsx',
  'src/components/application/Modals/VolumeDetailsModal.tsx',
  
  // Domain - Visualization (many unused charts)
  'src/components/domain/visualization/CapacityForecast/CapacityForecast.tsx',
  'src/components/domain/visualization/GrowthRateChart/GrowthRateChart.tsx',
  'src/components/domain/visualization/HistoricalDataDashboard/HistoricalDataDashboard.tsx',
  'src/components/domain/visualization/LiveVolumeChart/LiveVolumeChart.tsx',
  'src/components/domain/visualization/RealTimeDashboard/RealTimeDashboard.tsx',
  'src/components/domain/visualization/RealTimeLiveVolumeChart/RealTimeLiveVolumeChart.tsx',
  'src/components/domain/visualization/RealTimeStatusBar/RealTimeStatusBar.tsx',
  'src/components/domain/visualization/RealTimeVisualizationProvider/RealTimeVisualizationProvider.tsx',
  'src/components/domain/visualization/SizeComparisonChart/SizeComparisonChart.tsx',
  'src/components/domain/visualization/SystemOverview/SystemOverview.tsx',
  'src/components/domain/visualization/TopVolumesWidget/TopVolumesWidget.tsx',
  'src/components/domain/visualization/TrendAnalysisWidget/TrendAnalysisWidget.tsx',
  'src/components/domain/visualization/VisualizationErrorBoundary/VisualizationErrorBoundary.tsx',
  'src/components/domain/visualization/VolumeComparisonChart/VolumeComparisonChart.tsx',
  'src/components/domain/visualization/VolumeGrowthTimeline/VolumeGrowthTimeline.tsx',
  'src/components/domain/visualization/VolumeUsageTimeline/VolumeUsageTimeline.tsx',
];

const basePath = '/home/fictional/Projects/volumeviz/frontend';

function removeComponentAndRelatedFiles(componentPath) {
  const fullPath = path.join(basePath, componentPath);
  const componentDir = path.dirname(fullPath);
  const componentName = path.basename(componentPath, '.tsx');
  
  console.log(`🗑️  Removing: ${componentName}`);
  
  const filesToRemove = [];
  
  // Find all related files
  if (fs.existsSync(componentDir)) {
    const files = fs.readdirSync(componentDir);
    
    for (const file of files) {
      const filePath = path.join(componentDir, file);
      
      // Remove component files, types, stories, tests
      if (file.includes(componentName) || 
          file === 'index.ts' || 
          file === 'index.tsx' ||
          file.endsWith('.types.ts') ||
          file.endsWith('.test.tsx') ||
          file.endsWith('.stories.tsx')) {
        filesToRemove.push(filePath);
      }
    }
  }
  
  // Remove files
  let removedCount = 0;
  for (const filePath of filesToRemove) {
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        removedCount++;
        console.log(`   ✓ Removed: ${path.relative(basePath, filePath)}`);
      } catch (error) {
        console.error(`   ✗ Failed to remove ${filePath}: ${error.message}`);
      }
    }
  }
  
  // Remove empty directory if all files were removed
  if (fs.existsSync(componentDir)) {
    const remainingFiles = fs.readdirSync(componentDir);
    if (remainingFiles.length === 0) {
      try {
        fs.rmdirSync(componentDir);
        console.log(`   ✓ Removed empty directory: ${path.relative(basePath, componentDir)}`);
      } catch (error) {
        console.error(`   ✗ Failed to remove directory ${componentDir}: ${error.message}`);
      }
    }
  }
  
  return removedCount;
}

function updateBarrelExports() {
  console.log('\n📝 Updating barrel exports...');
  
  const indexFiles = [
    'src/components/ui/index.ts',
    'src/components/application/index.ts',
    'src/components/domain/index.ts',
    'src/components/organizations/index.ts',
    'src/components/shared/index.ts'
  ];
  
  for (const indexPath of indexFiles) {
    const fullIndexPath = path.join(basePath, indexPath);
    
    if (fs.existsSync(fullIndexPath)) {
      try {
        const content = fs.readFileSync(fullIndexPath, 'utf8');
        const lines = content.split('\n');
        const validLines = [];
        
        for (const line of lines) {
          const exportMatch = line.match(/export.*from.*['"]\.\/([^'"]*)['"]/);
          if (exportMatch) {
            const exportPath = exportMatch[1];
            const componentPath = path.join(path.dirname(fullIndexPath), exportPath);
            
            // Check if the component directory/file still exists
            if (fs.existsSync(componentPath) || 
                fs.existsSync(componentPath + '.tsx') || 
                fs.existsSync(componentPath + '/index.ts')) {
              validLines.push(line);
            } else {
              console.log(`   ✓ Removed export: ${line.trim()}`);
            }
          } else if (line.trim() === '' || line.startsWith('//')) {
            validLines.push(line);
          } else {
            // Keep other lines (named exports, etc.)
            validLines.push(line);
          }
        }
        
        fs.writeFileSync(fullIndexPath, validLines.join('\n'));
        console.log(`   ✓ Updated: ${indexPath}`);
      } catch (error) {
        console.error(`   ✗ Failed to update ${indexPath}: ${error.message}`);
      }
    }
  }
}

function main() {
  console.log('🧹 Removing unused components...\n');
  console.log('==================================\n');
  
  let totalRemoved = 0;
  
  for (const componentPath of unusedComponents) {
    const removed = removeComponentAndRelatedFiles(componentPath);
    totalRemoved += removed;
  }
  
  updateBarrelExports();
  
  console.log(`\n✅ Cleanup complete!`);
  console.log(`📊 Total files removed: ${totalRemoved}`);
  console.log(`💡 Component library is now much cleaner and focused on actually used components.`);
}

if (require.main === module) {
  main();
}