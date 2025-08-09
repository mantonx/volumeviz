/**
 * ESLint rule to enforce dependency version policies
 */

const fs = require('fs');
const path = require('path');

// Load policy configuration
let policyConfig;
try {
  const policyPath = path.join(process.cwd(), '.dependency-policy.json');
  policyConfig = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
} catch (error) {
  console.warn('Could not load .dependency-policy.json, using defaults');
  policyConfig = { dependencyPolicies: {}, versionRanges: {}, riskCategories: {}, customRules: [] };
}

/**
 * Check if a package matches any patterns in the list
 */
function matchesPatterns(packageName, patterns) {
  return patterns.some(pattern => {
    if (pattern === '*') return true;
    if (pattern.endsWith('*')) {
      return packageName.startsWith(pattern.slice(0, -1));
    }
    return packageName === pattern;
  });
}

/**
 * Determine update type from version string
 */
function getUpdateType(version) {
  if (version.includes('security') || version.includes('CVE')) return 'security';
  
  // Parse semver to determine if it's major/minor/patch
  const versionPattern = /^[\^~>=<]*(\d+)\.(\d+)\.(\d+)/;
  const match = version.match(versionPattern);
  
  if (!match) return 'unknown';
  
  // This is simplified - in reality you'd compare with current version
  // For now, we'll classify based on range prefix
  if (version.startsWith('^')) return 'minor';
  if (version.startsWith('~')) return 'patch';
  if (version.match(/^[>=<]/)) return 'major';
  
  return 'patch'; // default
}

/**
 * Get risk category for a package
 */
function getRiskCategory(packageName) {
  const { riskCategories } = policyConfig;
  
  for (const [category, config] of Object.entries(riskCategories)) {
    if (matchesPatterns(packageName, config.patterns)) {
      return category;
    }
  }
  
  return 'medium'; // default
}

/**
 * Validate version range format
 */
function validateVersionRange(packageName, version, depType) {
  const preferredRange = policyConfig.versionRanges[depType]?.preferred;
  if (!preferredRange) return null;
  
  if (preferredRange === 'exact' && version.match(/^[\^~>=<]/)) {
    return {
      message: `Package "${packageName}" should use exact version, got "${version}"`,
      severity: 'warn'
    };
  }
  
  if (preferredRange === '^' && !version.startsWith('^')) {
    return {
      message: `Package "${packageName}" should use caret range (^), got "${version}"`,
      severity: 'warn'
    };
  }
  
  return null;
}

/**
 * Main rule implementation
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce dependency version policies',
      category: 'Best Practices',
      recommended: true,
    },
    fixable: null,
    schema: [],
  },

  create(context) {
    return {
      Program(node) {
        const filename = context.getFilename();
        if (!filename.endsWith('package.json')) return;
        
        try {
          const sourceCode = context.getSourceCode();
          const packageJson = JSON.parse(sourceCode.getText());
          
          // Check all dependency types
          const depTypes = ['dependencies', 'devDependencies', 'peerDependencies'];
          
          depTypes.forEach(depType => {
            const deps = packageJson[depType];
            if (!deps) return;
            
            Object.entries(deps).forEach(([packageName, version]) => {
              // Check version range format
              const rangeError = validateVersionRange(packageName, version, depType);
              if (rangeError) {
                context.report({
                  node,
                  message: rangeError.message,
                });
              }
              
              // Check against custom rules
              policyConfig.customRules.forEach(rule => {
                if (rule.packages && rule.packages.includes(packageName)) {
                  const updateType = getUpdateType(version);
                  
                  if (rule.maxVersion === 'minor' && updateType === 'major') {
                    context.report({
                      node,
                      message: `Package "${packageName}" should not use major version updates (policy: ${rule.name})`,
                    });
                  }
                  
                  if (rule.versionRange === 'exact' && version.match(/^[\^~>=<]/)) {
                    context.report({
                      node,
                      message: `Package "${packageName}" should use exact version (policy: ${rule.name})`,
                    });
                  }
                }
              });
              
              // Check risk category and warn for high-risk packages
              const riskCategory = getRiskCategory(packageName);
              if (riskCategory === 'high' && getUpdateType(version) === 'major') {
                context.report({
                  node,
                  message: `High-risk package "${packageName}" with major version change requires manual review`,
                });
              }
            });
          });
          
        } catch (error) {
          context.report({
            node,
            message: `Error parsing package.json: ${error.message}`,
          });
        }
      },
    };
  },
};