export const environment = {
  production: true,

  // En Cloudflare Pages: agrega las variables en Dashboard → Settings → Environment Variables
  // El build de Angular reemplaza estas cadenas en tiempo de compilación mediante
  // Angular CLI file replacements. Para CI/CD usá @ngx-env/builder o similar.
  supabase: {
    url: 'https://TU_PROYECTO.supabase.co',
    anonKey: 'TU_ANON_PUBLIC_KEY_PRODUCCION'
  },

  cloudflare: {
    r2PublicBaseUrl: 'https://cdn.catamarcasecreta.com',
    r2BucketName: 'catamarca-memories'
  }
};
