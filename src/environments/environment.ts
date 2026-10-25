export const environment = {
  production: false,

  // ==============================
  // Supabase
  // ==============================
  // Reemplazá estos valores con los del proyecto en https://supabase.com/dashboard
  // Settings → API → Project URL / anon key
  supabase: {
    url: 'https://TU_PROYECTO.supabase.co',
    anonKey: 'TU_ANON_PUBLIC_KEY'
  },

  // ==============================
  // Cloudflare R2 (Storage para recuerdos y fotos de usuarios)
  // ==============================
  cloudflare: {
    r2PublicBaseUrl: 'https://cdn.catamarcasecreta.com', // dominio personalizado sobre R2
    r2BucketName: 'catamarca-memories'
  }
};
