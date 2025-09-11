const fs = require('fs');
const path = require('path');

// Get all data-points route files
const routesDir = './app/routes';
const files = fs.readdirSync(routesDir).filter(f => f.startsWith('data-points.') && f.endsWith('.tsx'));

files.forEach(file => {
  const filePath = path.join(routesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Remove the incorrect json import
  content = content.replace(
    /import pkg from "@react-router\/node";\s*\nconst { json } = pkg;\s*\n/g,
    ''
  );
  
  // Replace json() calls with plain objects or Response.json()
  content = content.replace(/return json\(([^)]+)\);/g, 'return $1;');
  
  // For error responses with status, use Response.json()
  content = content.replace(
    /return ([^;]+), { status: (\d+) }\);/g,
    'return Response.json($1, { status: $2 });'
  );
  
  fs.writeFileSync(filePath, content);
  console.log(`Fixed ${file}`);
});

console.log('All files fixed!');
