const fs = require('fs');
const path = require('path');

const outputFile = 'project-full-code.txt';
// Folders jinka code humein chahiye (src ke andar)
const targetFolders = [
  'src/models', 
  'src/controllers', 
  'src/services', 
  'src/routes',
  'src/config',
  'src/middlewares'
];

let outputContent = "=== PROJECT FULL SOURCE CODE ===\n\n";

function readFilesInDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    console.log(`Folder nahi mila: ${dirPath}`);
    return;
  }

  const files = fs.readdirSync(dirPath);
  
  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      readFilesInDir(fullPath); // Nested folders ke liye recursive call
    } else if (file.endsWith('.js')) {
      outputContent += `\n========================================\n`;
      outputContent += `FILE: ${fullPath.replace(process.cwd(), '')}\n`;
      outputContent += `========================================\n\n`;
      
      const content = fs.readFileSync(fullPath, 'utf8');
      outputContent += content + "\n\n";
    }
  });
}

targetFolders.forEach(folder => {
  const folderPath = path.join(process.cwd(), folder);
  readFilesInDir(folderPath);
});

// File Write Karo
fs.writeFileSync(outputFile, outputContent, 'utf8');
console.log(`\x1b[32m✔ Success!\x1b[0m File generated: \x1b[36m${outputFile}\x1b[0m`);
console.log(`Ab is file ka content copy karke paste kar do.`);