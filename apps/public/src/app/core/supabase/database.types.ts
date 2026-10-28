/**
 * Tipos generados automáticamente desde el schema de Supabase.
 *
 * Para regenerarlos cuando modifiques tu schema corrés:
 *   pnpm dlx supabase gen types typescript --project-id TU_PROJECT_ID > src/app/core/supabase/database.types.ts
 *
 * Por ahora se define manualmente el shape inicial de la Fase 1 (newsletter/waitlist).
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      /**
       * Lista de espera exclusiva para el Club de Experiencias Catamarca.
       * Habilitada con Row Level Security (RLS):
       *   - INSERT: todos los usuarios anónimos pueden insertarse.
       *   - SELECT: solo el propio registro (por email) o admins.
       */
      waitlist_members: {
        Row: {
          id: string;               // UUID generado por Supabase
          email: string;
          full_name: string | null;
          interest: string | null;  // 'puna_volcanes' | 'astroturismo_seismiles' | etc.
          position: number;         // Número secuencial de lista de espera (SERIAL)
          referral_code: string;    // Código único de invitación
          status: 'pending' | 'confirmed' | 'invited';
          source: string;           // 'web_minimal_landing' | 'referral' | etc.
          referred_by: string | null; // Referral code del invitador, si aplica
          created_at: string;       // ISO timestamp
          updated_at: string;
        };
        Insert: {
          email: string;
          full_name?: string | null;
          interest?: string | null;
          referral_code: string;
          status?: 'pending' | 'confirmed' | 'invited';
          source?: string;
          referred_by?: string | null;
        };
        Update: {
          status?: 'pending' | 'confirmed' | 'invited';
          full_name?: string | null;
          interest?: string | null;
        };
      };
    };
    Views: {
      /**
       * Vista pública para mostrar el contador de miembros sin exponer datos sensibles.
       */
      waitlist_stats: {
        Row: {
          total_members: number;
          confirmed_members: number;
          invited_members: number;
        };
      };
    };
    Functions: Record<string, never>;
    Enums: {
      experience_interest:
        | 'puna_volcanes'
        | 'astroturismo_seismiles'
        | 'dunas_sandboard'
        | 'termas_bienestar'
        | 'ruta_adobe_cultura'
        | 'gastronomia_vinos'
        | 'all';
      member_status: 'pending' | 'confirmed' | 'invited';
    };
  };
}
