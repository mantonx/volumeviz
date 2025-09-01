#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Get all component files
function getAllComponents(dir = 'src/components', basePath = '/home/fictional/Projects/volumeviz/frontend') {
  const components = new Map();
  
  function walkDirectory(currentPath, relativePath = '') {
    const items = fs.readdirSync(path.join(basePath, currentPath));
    
    for (const item of items) {
      const fullPath = path.join(basePath, currentPath, item);
      const relativeItemPath = path.join(relativePath, item);
      
      if (fs.statSync(fullPath).isDirectory()) {
        walkDirectory(path.join(currentPath, item), relativeItemPath);
      } else if (item.endsWith('.tsx') && !item.includes('.test.') && !item.includes('.stories.')) {
        const componentName = item.replace('.tsx', '');
        components.set(componentName, {
          path: path.join(currentPath, item),
          fullPath: fullPath,
          name: componentName
        });
      }
    }
  }
  
  walkDirectory(dir);
  return components;
}

// Get all imports from source files
function getAllImports(basePath = '/home/fictional/Projects/volumeviz/frontend') {
  const imports = new Set();
  
  function walkDirectory(currentPath) {
    const items = fs.readdirSync(path.join(basePath, currentPath));
    
    for (const item of items) {
      const fullPath = path.join(basePath, currentPath, item);
      
      if (fs.statSync(fullPath).isDirectory() && !item.includes('node_modules')) {
        walkDirectory(path.join(currentPath, item));
      } else if ((item.endsWith('.tsx') || item.endsWith('.ts')) && 
                 !item.includes('.test.') && 
                 !item.includes('.stories.')) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const importLines = content.match(/^import.*from.*@\/components.*$/gm) || [];
          
          for (const importLine of importLines) {
            // Extract component names from import statements
            const match = importLine.match(/import\s*\{([^}]*)\}|import\s+(\w+)/);
            if (match) {
              if (match[1]) {
                // Named imports: { ComponentA, ComponentB }
                const namedImports = match[1].split(',').map(s => s.trim().split(' ')[0]);
                namedImports.forEach(imp => imports.add(imp));
              } else if (match[2]) {
                // Default import
                imports.add(match[2]);
              }
            }
          }
        } catch (error) {
          console.error(`Error reading ${fullPath}:`, error.message);
        }
      }
    }
  }
  
  walkDirectory('src');
  return imports;
}

// Analyze component usage
function analyzeComponentUsage() {
  console.log('🔍 Analyzing component usage...\n');
  
  const components = getAllComponents();
  const imports = getAllImports();
  
  console.log(`📊 Found ${components.size} component files`);
  console.log(`📊 Found ${imports.size} unique imported components\n`);
  
  const unusedComponents = [];
  const usedComponents = [];
  
  // Check which components are used
  for (const [componentName, componentInfo] of components) {
    if (imports.has(componentName)) {
      usedComponents.push(componentInfo);
    } else {
      unusedComponents.push(componentInfo);
    }
  }
  
  console.log(`✅ Used components: ${usedComponents.length}`);
  console.log(`❌ Unused components: ${unusedComponents.length}\n`);
  
  if (unusedComponents.length > 0) {
    console.log('🗑️  Unused Components:');
    console.log('========================');
    unusedComponents.forEach(component => {
      console.log(`- ${component.name} (${component.path})`);
    });
    console.log('');
  }
  
  // Show import patterns
  const importsByPath = new Map();
  for (const imp of imports) {
    const component = components.get(imp);
    if (component) {
      const dir = path.dirname(component.path);
      if (!importsByPath.has(dir)) {
        importsByPath.set(dir, []);
      }
      importsByPath.get(dir).push(imp);
    }
  }
  
  console.log('📁 Component usage by directory:');
  console.log('================================');
  for (const [dir, comps] of importsByPath) {
    console.log(`${dir}: ${comps.length} used (${comps.join(', ')})`);
  }
  
  return {
    total: components.size,
    used: usedComponents.length,
    unused: unusedComponents.length,
    unusedComponents,
    usedComponents
  };
}

// Run analysis
if (require.main === module) {
  const results = analyzeComponentUsage();
  
  console.log('\n📈 Summary:');
  console.log(`Total Components: ${results.total}`);
  console.log(`Used Components: ${results.used} (${Math.round(results.used / results.total * 100)}%)`);
  console.log(`Unused Components: ${results.unused} (${Math.round(results.unused / results.total * 100)}%)`);
  
  if (results.unused > 0) {
    const potentialSavings = results.unused * 2; // Rough estimate of KB per component
    console.log(`\n💡 Potential bundle size reduction: ~${potentialSavings}KB`);
  }
}