const fs = require('fs');
const path = require('path');

// Normalizar búsqueda de variables en process.env (case-insensitive y prefijos habituales)
let supabaseUrl = '';
let supabaseAnonKey = '';

for (const [key, value] of Object.entries(process.env)) {
  const upper = key.toUpperCase();
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

console.log('[set-env] Analizando variables de entorno para Supabase...');

if (supabaseUrl && supabaseAnonKey) {
  console.log(`[set-env] Supabase URL detectada: ${supabaseUrl.substring(0, 15)}...`);
  console.log('[set-env] Supabase Anon Key detectada. Generando archivos de entorno...');

  const content = `export const environment = {
  production: true,

  supabase: {
    url: '${supabaseUrl}',
    anonKey: '${supabaseAnonKey}',
  },
};
`;

  const devContent = `export const environment = {
  production: false,

  supabase: {
    url: '${supabaseUrl}',
    anonKey: '${supabaseAnonKey}',
  },
};
`;

  const rootDir = path.resolve(__dirname, '..');
  const targets = [
    { file: path.join(rootDir, 'apps', 'public', 'src', 'environments', 'environment.prod.ts'), content },
    { file: path.join(rootDir, 'apps', 'public', 'src', 'environments', 'environment.ts'), content: devContent },
    { file: path.join(rootDir, 'src', 'environments', 'environment.prod.ts'), content },
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

  // También generar script runtime-env.js en las carpetas public para respaldo
  const runtimeScript = `window.__SUPABASE_CONFIG__ = {
  url: '${supabaseUrl}',
  anonKey: '${supabaseAnonKey}'
};
`;
  const publicDirs = [
    path.join(rootDir, 'apps', 'public', 'public'),
    path.join(rootDir, 'public'),
  ];

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
    '[set-env] ADVERTENCIA: No se detectaron SUPABASE_URL y/o SUPABASE_ANON_KEY en las variables de entorno de Vercel.',
  );
  console.warn(
    '[set-env] Asegurate de haberlas nombrado SUPABASE_URL y SUPABASE_ANON_KEY en Vercel -> Project Settings -> Environment Variables.',
  );
}
