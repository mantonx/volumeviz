#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function findComponentsAndStories() {
  const basePath = '/home/fictional/Projects/volumeviz/frontend/src/components';
  
  // Get all component files
  const components = new Map();
  const stories = new Set();
  
  function walkDirectory(dir) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      
      if (fs.statSync(fullPath).isDirectory()) {
        walkDirectory(fullPath);
      } else if (item.endsWith('.tsx')) {
        const relativePath = path.relative(basePath, fullPath);
        const componentName = path.basename(item, '.tsx');
        
        if (item.includes('.stories.')) {
          stories.add(componentName);
        } else if (!item.includes('.test.')) {
          // Only include actual components (not tests)
          const content = fs.readFileSync(fullPath, 'utf8');
          
          // Check if it exports a React component
          if (content.includes('export const ' + componentName) || 
              content.includes('export function ' + componentName) ||
              content.includes('export default')) {
            components.set(componentName, {
              name: componentName,
              path: relativePath,
              directory: path.dirname(relativePath),
              hasStory: stories.has(componentName)
            });
          }
        }
      }
    }
  }
  
  walkDirectory(basePath);
  
  // Update hasStory status after collecting all stories
  for (const [name, component] of components) {
    component.hasStory = stories.has(name);
  }
  
  return { components, stories };
}

function analyzeStorybook() {
  console.log('📚 Storybook Story Audit\n');
  console.log('========================\n');
  
  const { components, stories } = findComponentsAndStories();
  
  const withStories = [];
  const withoutStories = [];
  
  for (const [name, component] of components) {
    if (component.hasStory) {
      withStories.push(component);
    } else {
      withoutStories.push(component);
    }
  }
  
  console.log(`📊 Total Components: ${components.size}`);
  console.log(`📊 Components with Stories: ${withStories.length}`);
  console.log(`📊 Components without Stories: ${withoutStories.length}`);
  console.log(`📊 Story Coverage: ${Math.round((withStories.length / components.size) * 100)}%\n`);
  
  // Group components without stories by directory
  const byDirectory = new Map();
  
  for (const component of withoutStories) {
    const category = component.directory.split('/')[0]; // ui, domain, etc.
    if (!byDirectory.has(category)) {
      byDirectory.set(category, []);
    }
    byDirectory.get(category).push(component);
  }
  
  console.log('🔍 Components Missing Stories:\n');
  for (const [category, comps] of byDirectory) {
    console.log(`${category.toUpperCase()} (${comps.length} components):`);
    comps.forEach(c => {
      console.log(`  ❌ ${c.name} (${c.path})`);
    });
    console.log('');
  }
  
  console.log('✅ Components with Stories:\n');
  const withStoriesByDir = new Map();
  for (const component of withStories) {
    const category = component.directory.split('/')[0];
    if (!withStoriesByDir.has(category)) {
      withStoriesByDir.set(category, []);
    }
    withStoriesByDir.get(category).push(component);
  }
  
  for (const [category, comps] of withStoriesByDir) {
    console.log(`${category.toUpperCase()} (${comps.length} components):`);
    comps.forEach(c => {
      console.log(`  ✅ ${c.name}`);
    });
    console.log('');
  }
  
  return { components, withStories, withoutStories };
}

if (require.main === module) {
  analyzeStorybook();
}