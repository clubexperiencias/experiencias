/**
 * Tipos de TypeScript para la base de datos de Supabase de EXPERIENCIAS.CLUB.
 * Separación: 1. waitlist (prospectos) y 2. socios (miembros oficiales)
 * Sincronizado con supabase/migrations/002_waitlist_and_profiles.sql
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type MembershipTier = 'emergente' | 'activo' | 'fundador';

export interface Database {
  public: {
    Tables: {
      /**
       * Tabla 1: Recopilación ágil de correos desde la landing page (/)
       */
      waitlist: {
        Row: {
          id: string;
          email: string;
          converted: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          converted?: boolean;
          created_at?: string;
        };
        Update: {
          email?: string;
          converted?: boolean;
        };
        Relationships: [];
      };

      /**
       * Tabla 2: Socios Emergentes, Plenos y Fundadores
       */
      socios: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          dni: string;
          phone: string;
          experiences_wishlist: string[] | null;
          experiences_other: string | null;
          position: number;
          membership_tier: MembershipTier;
          auth_user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          full_name: string;
          dni: string;
          phone: string;
          experiences_wishlist?: string[] | null;
          experiences_other?: string | null;
          position?: number;
          membership_tier?: MembershipTier;
          auth_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string;
          full_name?: string;
          dni?: string;
          phone?: string;
          experiences_wishlist?: string[] | null;
          experiences_other?: string | null;
          membership_tier?: MembershipTier;
          auth_user_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };

    Views: {
      waitlist_stats: {
        Row: {
          total_members: number;
          max_position: number | null;
        };
        Relationships: [];
      };
    };

    Functions: Record<string, never>;
    Enums: {
      membership_tier: MembershipTier;
    };
  };
}
