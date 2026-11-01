const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

// Find the built browser files
const possibleSourceDirs = [
  path.join(rootDir, 'apps', 'public', 'dist', 'experiencias', 'browser'),
  path.join(rootDir, 'apps', 'public', 'dist', 'experiencias'),
  path.join(rootDir, 'dist', 'experiencias', 'browser'),
  path.join(rootDir, 'dist', 'experiencias'),
];

let sourceDir = null;
for (const dir of possibleSourceDirs) {
  if (fs.existsSync(path.join(dir, 'index.html'))) {
    sourceDir = dir;
    break;
  }
}

if (!sourceDir) {
  console.warn('[post-build] No se encontró index.html en ninguna de las rutas esperadas de dist.');
  process.exit(0);
}

console.log(`[post-build] Carpeta de build detectada: ${sourceDir}`);

// Targets where Vercel might look for output depending on project root settings
const targets = [
  path.join(rootDir, 'browser'),
  path.join(rootDir, 'apps', 'public', 'browser'),
  path.join(rootDir, 'dist', 'browser'),
  path.join(rootDir, 'apps', 'public', 'dist', 'browser'),
  path.join(rootDir, 'dist', 'experiencias', 'browser'),
];

function copyDirRecursive(src, dest) {
  if (path.resolve(src) === path.resolve(dest)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

for (const target of targets) {
  try {
    copyDirRecursive(sourceDir, target);
    console.log(`[post-build] Sincronizado en: ${target}`);
  } catch (err) {
    console.warn(`[post-build] Advertencia al copiar a ${target}:`, err.message);
  }
}

console.log('[post-build] ¡Post-build completado con éxito!');
