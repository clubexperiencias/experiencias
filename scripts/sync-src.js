const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const sourceDir = path.join(rootDir, 'apps', 'public', 'src');
const targetDir = path.join(rootDir, 'src');

if (!fs.existsSync(sourceDir)) {
  console.error('[sync-src] No se encontró apps/public/src');
  process.exit(1);
}

function syncRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const srcEntries = fs.readdirSync(src, { withFileTypes: true });
  const srcEntryNames = new Set(srcEntries.map((e) => e.name));

  for (const entry of srcEntries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      syncRecursive(srcPath, destPath);
    } else {
      let shouldCopy = true;
      if (fs.existsSync(destPath)) {
        const srcStat = fs.statSync(srcPath);
        const destStat = fs.statSync(destPath);
        if (srcStat.size === destStat.size) {
          const srcBuf = fs.readFileSync(srcPath);
          const destBuf = fs.readFileSync(destPath);
          if (srcBuf.equals(destBuf)) {
            shouldCopy = false;
          }
        }
      }
      if (shouldCopy) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  // Remove entries in dest that no longer exist in src
  if (fs.existsSync(dest)) {
    const destEntries = fs.readdirSync(dest, { withFileTypes: true });
    for (const entry of destEntries) {
      if (!srcEntryNames.has(entry.name)) {
        const removePath = path.join(dest, entry.name);
        fs.rmSync(removePath, { recursive: true, force: true });
      }
    }
  }
}

console.log('[sync-src] Sincronizando apps/public/src -> src...');
syncRecursive(sourceDir, targetDir);
console.log('[sync-src] ¡Sincronización completada con éxito!');

