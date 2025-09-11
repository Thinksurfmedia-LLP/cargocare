const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all data-points route files
const files = glob.sync('app/routes/data-points.*.tsx');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace the incorrect import patterns
  content = content.replace(
    /import pkg from "@react-router\/node";`nconst { json } = pkg;/g,
    'import pkg from "@react-router/node";\nconst { json } = pkg;'
  );
  
  content = content.replace(
    /import { json } from "@react-router\/node";/g,
    'import pkg from "@react-router/node";\nconst { json } = pkg;'
  );
  
  fs.writeFileSync(file, content);
  console.log(`Fixed imports in ${file}`);
});

console.log('All imports fixed!');
