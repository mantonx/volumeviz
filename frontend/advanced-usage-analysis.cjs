#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Enhanced analysis that tracks barrel exports and internal dependencies
function advancedComponentAnalysis() {
  const basePath = '/home/fictional/Projects/volumeviz/frontend';
  
  // Step 1: Get all component files and their exports
  const allComponents = new Map();
  const barrelExports = new Map(); // Track what's exported from index files
  const internalDependencies = new Map(); // Track component-to-component deps
  
  function scanDirectory(dir, componentMap) {
    const fullPath = path.join(basePath, dir);
    if (!fs.existsSync(fullPath)) return;
    
    const items = fs.readdirSync(fullPath);
    
    for (const item of items) {
      const itemPath = path.join(fullPath, item);
      const relativePath = path.join(dir, item);
      
      if (fs.statSync(itemPath).isDirectory()) {
        scanDirectory(relativePath, componentMap);
      } else if (item.endsWith('.tsx') || item.endsWith('.ts')) {
        if (item.includes('.test.') || item.includes('.stories.')) continue;
        
        const content = fs.readFileSync(itemPath, 'utf8');
        
        // Track barrel exports (index.ts files)
        if (item === 'index.ts' || item === 'index.tsx') {
          const exports = content.match(/export.*from.*['"]/g) || [];
          const namedExports = content.match(/export\s*\{([^}]*)\}/g) || [];
          
          exports.forEach(exp => {
            const match = exp.match(/export.*['"`](.*)['"`]/);
            if (match) {
              const fromPath = match[1];
              const dir = path.dirname(relativePath);
              barrelExports.set(dir, [...(barrelExports.get(dir) || []), fromPath]);
            }
          });
          
          namedExports.forEach(exp => {
            const match = exp.match(/\{([^}]*)\}/);
            if (match) {
              const names = match[1].split(',').map(n => n.trim().split(' as ')[0]);
              const dir = path.dirname(relativePath);
              names.forEach(name => {
                if (!barrelExports.has(dir)) barrelExports.set(dir, []);
                barrelExports.get(dir).push(name);
              });
            }
          });
        }
        
        // Track component files
        if (item.endsWith('.tsx')) {
          const componentName = item.replace('.tsx', '');
          componentMap.set(componentName, {
            name: componentName,
            path: relativePath,
            content: content,
            exports: []
          });
          
          // Extract component exports
          const componentExports = content.match(/export\s+(const|function|class)\s+(\w+)/g) || [];
          const namedExports = content.match(/export\s*\{([^}]*)\}/g) || [];
          
          componentExports.forEach(exp => {
            const match = exp.match(/export\s+(?:const|function|class)\s+(\w+)/);
            if (match) {
              componentMap.get(componentName).exports.push(match[1]);
            }
          });
          
          namedExports.forEach(exp => {
            const match = exp.match(/\{([^}]*)\}/);
            if (match) {
              const names = match[1].split(',').map(n => n.trim().split(' as ')[0]);
              componentMap.get(componentName).exports.push(...names);
            }
          });
          
          // Track internal component dependencies
          const imports = content.match(/import.*from.*@\/components/g) || [];
          imports.forEach(imp => {
            const match = imp.match(/import\s*\{([^}]*)\}.*from.*['"]/);
            if (match) {
              const importedNames = match[1].split(',').map(n => n.trim());
              if (!internalDependencies.has(componentName)) {
                internalDependencies.set(componentName, []);
              }
              internalDependencies.get(componentName).push(...importedNames);
            }
          });
        }
      }
    }
  }
  
  // Step 2: Scan all files for component usage
  const directImports = new Set(); // Direct imports from app code
  const allUsedNames = new Set(); // All component names that appear in imports
  
  function scanForUsage(dir) {
    const fullPath = path.join(basePath, dir);
    if (!fs.existsSync(fullPath)) return;
    
    const items = fs.readdirSync(fullPath);
    
    for (const item of items) {
      const itemPath = path.join(fullPath, item);
      const relativePath = path.join(dir, item);
      
      if (fs.statSync(itemPath).isDirectory()) {
        scanForUsage(relativePath);
      } else if ((item.endsWith('.tsx') || item.endsWith('.ts')) && 
                 !item.includes('.test.') && !item.includes('.stories.')) {
        const content = fs.readFileSync(itemPath, 'utf8');
        
        // Find component imports
        const imports = content.match(/import.*from.*@\/components.*$/gm) || [];
        
        imports.forEach(importLine => {
          // Named imports
          const namedMatch = importLine.match(/import\s*\{([^}]*)\}/);
          if (namedMatch) {
            const names = namedMatch[1].split(',').map(n => n.trim().split(' as ')[0]);
            names.forEach(name => {
              directImports.add(name);
              allUsedNames.add(name);
            });
          }
          
          // Default imports
          const defaultMatch = importLine.match(/import\s+(\w+)\s+from/);
          if (defaultMatch) {
            directImports.add(defaultMatch[1]);
            allUsedNames.add(defaultMatch[1]);
          }
        });
      }
    }
  }
  
  // Run analysis
  scanDirectory('src/components', allComponents);
  scanForUsage('src');
  
  // Step 3: Determine what's actually used
  const usedComponents = new Set();
  const unusedComponents = new Set();
  
  // Start with directly imported components
  for (const imported of directImports) {
    usedComponents.add(imported);
  }
  
  // Add components that are dependencies of used components
  function addDependencies(componentName) {
    if (internalDependencies.has(componentName)) {
      for (const dep of internalDependencies.get(componentName)) {
        if (!usedComponents.has(dep)) {
          usedComponents.add(dep);
          addDependencies(dep); // Recursive dependency resolution
        }
      }
    }
  }
  
  for (const used of Array.from(usedComponents)) {
    addDependencies(used);
  }
  
  // Check all components against usage
  for (const [componentName, componentInfo] of allComponents) {
    const isUsed = componentInfo.exports.some(exportName => usedComponents.has(exportName)) ||
                   usedComponents.has(componentName);
    
    if (isUsed) {
      usedComponents.add(componentName);
    } else {
      unusedComponents.add(componentName);
    }
  }
  
  // Step 4: Report findings
  console.log('🔍 Advanced Component Usage Analysis\n');
  console.log('=====================================\n');
  
  console.log(`📊 Total component files: ${allComponents.size}`);
  console.log(`📊 Direct imports found: ${directImports.size}`);
  console.log(`📊 Used components (including deps): ${usedComponents.size}`);
  console.log(`📊 Unused components: ${unusedComponents.size}\n`);
  
  // Show unused components grouped by category
  const unusedByCategory = new Map();
  
  for (const unused of unusedComponents) {
    const component = allComponents.get(unused);
    if (component) {
      const category = component.path.split('/')[2] || 'other'; // src/components/[category]
      if (!unusedByCategory.has(category)) {
        unusedByCategory.set(category, []);
      }
      unusedByCategory.get(category).push({
        name: unused,
        path: component.path,
        size: fs.statSync(path.join(basePath, component.path)).size
      });
    }
  }
  
  console.log('🗑️  Unused Components by Category:');
  console.log('===================================');
  
  let totalUnusedSize = 0;
  
  for (const [category, components] of unusedByCategory) {
    const categorySize = components.reduce((sum, c) => sum + c.size, 0);
    totalUnusedSize += categorySize;
    
    console.log(`\n${category.toUpperCase()} (${components.length} components, ${(categorySize / 1024).toFixed(1)}KB):`);
    components.forEach(c => {
      console.log(`  - ${c.name} (${(c.size / 1024).toFixed(1)}KB)`);
    });
  }
  
  console.log(`\n💡 Total unused code: ${(totalUnusedSize / 1024).toFixed(1)}KB`);
  console.log(`💡 Potential bundle reduction: ${Math.round((unusedComponents.size / allComponents.size) * 100)}%`);
  
  return {
    total: allComponents.size,
    used: usedComponents.size,
    unused: unusedComponents.size,
    unusedComponents: Array.from(unusedComponents).map(name => ({
      name,
      component: allComponents.get(name)
    })).filter(item => item.component),
    unusedSize: totalUnusedSize
  };
}

// Run the analysis
if (require.main === module) {
  advancedComponentAnalysis();
}