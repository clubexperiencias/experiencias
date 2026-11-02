const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

// Cargar .env.local y .env si existen (para desarrollo local sin dependencias externas)
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx <= 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch (err) {
    console.warn(`[set-env] No se pudo leer ${filePath}:`, err.message);
  }
}

loadEnvFile(path.join(rootDir, '.env.local'));
loadEnvFile(path.join(rootDir, '.env'));

// Normalizar búsqueda de variables en process.env
let supabaseUrl = '';
let supabaseAnonKey = '';
let supabaseDevUrl = '';
let supabaseDevAnonKey = '';
let supabaseProdUrl = '';
let supabaseProdAnonKey = '';

for (const [key, value] of Object.entries(process.env)) {
  const upper = key.toUpperCase();

  // Dev explicit overrides
  if (upper === 'SUPABASE_DEV_URL') supabaseDevUrl = value.trim();
  if (upper === 'SUPABASE_DEV_ANON_KEY') supabaseDevAnonKey = value.trim();

  // Prod explicit overrides
  if (upper === 'SUPABASE_PROD_URL') supabaseProdUrl = value.trim();
  if (upper === 'SUPABASE_PROD_ANON_KEY') supabaseProdAnonKey = value.trim();

  // General fallbacks
  if (
    upper === 'SUPABASE_URL' ||
    upper === 'NEXT_PUBLIC_SUPABASE_URL' ||
    upper === 'PUBLIC_SUPABASE_URL' ||
    upper === 'VITE_SUPABASE_URL' ||
    upper === 'NG_APP_SUPABASE_URL' ||
    upper.endsWith('_SUPABASE_URL')
  ) {
    if (value && value.trim()) {
      supabaseUrl = value.trim();
    }
  }

  if (
    upper === 'SUPABASE_ANON_KEY' ||
    upper === 'SUPABASE_KEY' ||
    upper === 'NEXT_PUBLIC_SUPABASE_ANON_KEY' ||
    upper === 'PUBLIC_SUPABASE_ANON_KEY' ||
    upper === 'VITE_SUPABASE_ANON_KEY' ||
    upper === 'NG_APP_SUPABASE_ANON_KEY' ||
    upper.endsWith('_SUPABASE_ANON_KEY') ||
    upper.endsWith('_SUPABASE_KEY')
  ) {
    if (value && value.trim()) {
      supabaseAnonKey = value.trim();
    }
  }
}

const activeProdUrl = supabaseProdUrl || supabaseUrl;
const activeProdAnonKey = supabaseProdAnonKey || supabaseAnonKey;
const activeDevUrl = supabaseDevUrl || supabaseUrl;
const activeDevAnonKey = supabaseDevAnonKey || supabaseAnonKey;

console.log('[set-env] Analizando variables de entorno para Supabase...');

if (activeProdUrl && activeProdAnonKey) {
  console.log(`[set-env] Supabase Prod URL: ${activeProdUrl.substring(0, 18)}...`);
  console.log(`[set-env] Supabase Dev URL: ${activeDevUrl.substring(0, 18)}...`);

  const prodContent = `export const environment = {
  production: true,

  supabase: {
    url: '${activeProdUrl}',
    anonKey: '${activeProdAnonKey}',
  },
};
`;

  const devContent = `export const environment = {
  production: false,

  supabase: {
    url: '${activeDevUrl}',
    anonKey: '${activeDevAnonKey}',
  },
};
`;

  const targets = [
    {
      file: path.join(rootDir, 'apps', 'public', 'src', 'environments', 'environment.prod.ts'),
      content: prodContent,
    },
    {
      file: path.join(rootDir, 'apps', 'public', 'src', 'environments', 'environment.ts'),
      content: devContent,
    },
    { file: path.join(rootDir, 'src', 'environments', 'environment.prod.ts'), content: prodContent },
    { file: path.join(rootDir, 'src', 'environments', 'environment.ts'), content: devContent },
  ];

  for (const { file, content: targetContent } of targets) {
    try {
      if (fs.existsSync(path.dirname(file))) {
        fs.writeFileSync(file, targetContent, 'utf8');
        console.log(`[set-env] Inyectado en: ${file}`);
      }
    } catch (err) {
      console.error(`[set-env] Error escribiendo ${file}:`, err);
    }
  }

  // Generar script runtime-env.js en las carpetas public para respaldo (evitando placeholders truthy)
  const safeRuntimeUrl =
    activeDevUrl && !activeDevUrl.includes('TU_PROYECTO') && !activeDevUrl.includes('tu-proyecto')
      ? activeDevUrl
      : '';
  const safeRuntimeKey =
    activeDevAnonKey && !activeDevAnonKey.includes('...') && safeRuntimeUrl ? activeDevAnonKey : '';

  const runtimeScript = `window.__SUPABASE_CONFIG__ = {
  url: '${safeRuntimeUrl}',
  anonKey: '${safeRuntimeKey}'
};
`;
  const publicDirs = [path.join(rootDir, 'apps', 'public', 'public'), path.join(rootDir, 'public')];

  for (const pDir of publicDirs) {
    try {
      if (fs.existsSync(pDir)) {
        fs.writeFileSync(path.join(pDir, 'runtime-env.js'), runtimeScript, 'utf8');
        console.log(`[set-env] Generado runtime-env.js en: ${pDir}`);
      }
    } catch (err) {
      console.error(`[set-env] Error escribiendo runtime-env.js:`, err);
    }
  }

  console.log('[set-env] ¡Configuración de Supabase inyectada con éxito!');
} else {
  console.warn(
    '[set-env] ADVERTENCIA: No se detectaron SUPABASE_URL y/o SUPABASE_ANON_KEY (ni en .env.local ni en process.env).',
  );
  console.warn(
    '[set-env] Para desarrollo local podés crear un archivo .env.local a partir de .env.example.',
  );
}
