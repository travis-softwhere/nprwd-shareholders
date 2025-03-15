// Script to remove all console logging from the codebase
// This script can be run as a pre-build step for production deployments
// Usage: node cleanup-logging.js

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const readdirAsync = promisify(fs.readdir);
const statAsync = promisify(fs.stat);

// Regex patterns to match console logging statements
const CONSOLE_PATTERNS = [
  /console\.log\s*\([^)]*\);?/g,
  /console\.error\s*\([^)]*\);?/g,
  /console\.warn\s*\([^)]*\);?/g,
  /console\.info\s*\([^)]*\);?/g,
  /console\.debug\s*\([^)]*\);?/g
];

// File extensions to process
const FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

// Directories to exclude
const EXCLUDED_DIRS = ['node_modules', '.next', 'out', 'dist', '.git'];

// Function to recursively process directories
async function processDirectory(dirPath) {
  const entries = await readdirAsync(dirPath);
  
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry);
    
    // Skip excluded directories
    if (EXCLUDED_DIRS.includes(entry)) {
      console.log(`Skipping excluded directory: ${fullPath}`);
      continue;
    }
    
    const stats = await statAsync(fullPath);
    
    if (stats.isDirectory()) {
      await processDirectory(fullPath);
    } else if (stats.isFile() && FILE_EXTENSIONS.includes(path.extname(fullPath))) {
      await processFile(fullPath);
    }
  }
}

// Function to process a single file
async function processFile(filePath) {
  try {
    let content = await readFileAsync(filePath, 'utf8');
    let originalContent = content;
    
    // Apply all regex patterns to remove console statements
    CONSOLE_PATTERNS.forEach(pattern => {
      content = content.replace(pattern, '');
    });
    
    // If the content was modified, write the changes back to the file
    if (content !== originalContent) {
      await writeFileAsync(filePath, content, 'utf8');
      console.log(`Removed console logging from: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
  }
}

// Main function
async function main() {
  const rootDir = process.cwd();
  console.log(`Starting cleanup of console logging in: ${rootDir}`);
  
  try {
    await processDirectory(rootDir);
    console.log('Console logging cleanup completed successfully');
  } catch (error) {
    console.error('Error during console logging cleanup:', error);
    process.exit(1);
  }
}

// Run the script
main(); 