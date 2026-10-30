const fs = require('fs');
const path = require('path');

// Folders jinka code humein chahiye
const targetFolders = ['models', 'controllers', 'services', 'routes'];
const outputFile = 'project-structure.txt';

// Folders ko ignore karna hai
const ignoreDirs = ['node_modules', '.git', 'logs', 'uploads', 'public'];

let outputContent = "=== PROJECT STRUCTURE & CODE ===\n\n";

// 1. Function: Folder Tree Generate Karne Ke Liye
function generateTree(dir, prefix = '') {
  let items;
  try {
    items = fs.readdirSync(dir);
  } catch (err) {
    return;
  }

  items = items.filter(item => !ignoreDirs.includes(item));
  
  items.forEach((item, index) => {
    const isLast = index === items.length - 1;
    const fullPath = path.join(dir, item);
    const isDir = fs.statSync(fullPath).isDirectory();

    outputContent += `${prefix}${isLast ? '└── ' : '├── '}${item}${isDir ? '/' : ''}\n`;

    if (isDir) {
      generateTree(fullPath, `${prefix}${isLast ? '    ' : '│   '}`);
    }
  });
}

outputContent += "--- DIRECTORY TREE ---\n";
outputContent += ".\n";
generateTree(process.cwd());
outputContent += "\n\n";

// 2. Function: File Code Read Karne Ke Liye
function readFilesInDir(dirPath) {
  if (!fs.existsSync(dirPath)) return;

  const files = fs.readdirSync(dirPath);
  
  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      readFilesInDir(fullPath); // Nested folders ke liye
    } else if (file.endsWith('.js')) {
      outputContent += `\n========================================\n`;
      outputContent += `FILE: ${path.relative(process.cwd(), fullPath)}\n`;
      outputContent += `========================================\n\n`;
      
      const content = fs.readFileSync(fullPath, 'utf8');
      outputContent += content + "\n";
    }
  });
}

outputContent += "--- SOURCE CODE (Models, Controllers, Services, Routes) ---\n";

targetFolders.forEach(folder => {
  const folderPath = path.join(process.cwd(), folder);
  if (fs.existsSync(folderPath)) {
    readFilesInDir(folderPath);
  }
});

// 3. File Write Karo
fs.writeFileSync(outputFile, outputContent, 'utf8');
console.log(`\x1b[32m✔ Success!\x1b[0m File generated: \x1b[36m${outputFile}\x1b[0m`);
console.log(`Ab is file ka content copy karke paste kar do.`);