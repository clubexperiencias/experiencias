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
          google_linked: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          converted?: boolean;
          google_linked?: boolean;
          created_at?: string;
        };
        Update: {
          email?: string;
          converted?: boolean;
          google_linked?: boolean;
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
          google_linked: boolean;
          registration_token: string;
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
          google_linked?: boolean;
          registration_token?: string;
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
          google_linked?: boolean;
          registration_token?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      /**
       * Tabla 3: Postulaciones de Socios Fundadores (/socios/fundadores)
       */
      postulaciones_fundadores: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          phone: string;
          motivation_letter: string;
          agreed_to_protocol: boolean;
          status: 'en_evaluacion' | 'aprobada' | 'rechazada';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          email: string;
          phone: string;
          motivation_letter: string;
          agreed_to_protocol?: boolean;
          status?: 'en_evaluacion' | 'aprobada' | 'rechazada';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          full_name?: string;
          email?: string;
          phone?: string;
          motivation_letter?: string;
          agreed_to_protocol?: boolean;
          status?: 'en_evaluacion' | 'aprobada' | 'rechazada';
          updated_at?: string;
        };
        Relationships: [];
      };

      /**
       * Tabla 4: Postulaciones de Prestadores & Guías Locales (/experiencias/prestadores)
       */
      postulaciones_prestadores: {
        Row: {
          id: string;
          full_name: string;
          category: string;
          region: string;
          email: string;
          phone: string;
          website: string;
          description: string;
          status: 'pendiente' | 'aprobado' | 'rechazado';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          category?: string;
          region?: string;
          email: string;
          phone: string;
          website: string;
          description: string;
          status?: 'pendiente' | 'aprobado' | 'rechazado';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          full_name?: string;
          category?: string;
          region?: string;
          email?: string;
          phone?: string;
          website?: string;
          description?: string;
          status?: 'pendiente' | 'aprobado' | 'rechazado';
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

    Functions: {
      record_waitlist_email: {
        Args: {
          p_email: string;
          p_google_linked?: boolean;
        };
        Returns: Json;
      };
      check_email_registration_status: {
        Args: {
          p_email: string;
        };
        Returns: Json;
      };
      register_emergente_socio: {
        Args: {
          p_email: string;
          p_full_name: string;
          p_dni: string;
          p_phone: string;
          p_experiences_wishlist?: Json;
          p_experiences_other?: string | null;
        };
        Returns: Json;
      };
      get_socio_by_session_or_token: {
        Args: {
          p_email: string;
          p_registration_token?: string | null;
        };
        Returns: Json;
      };
      update_socio_profile_secure: {
        Args: {
          p_email: string;
          p_registration_token?: string | null;
          p_full_name?: string | null;
          p_dni?: string | null;
          p_phone?: string | null;
          p_experiences_wishlist?: Json | null;
          p_experiences_other?: string | null;
        };
        Returns: Json;
      };
    };
    Enums: {
      membership_tier: MembershipTier;
    };
  };
}
