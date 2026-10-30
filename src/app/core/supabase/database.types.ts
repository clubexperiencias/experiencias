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

      /**
       * Tabla 5: Experiencias Oficiales del Club
       */
      experiencias_club: {
        Row: {
          id: string;
          slug: string;
          title: string;
          short_title: string | null;
          tagline: string;
          description: string;
          region: string;
          meeting_point: string;
          difficulty: 'Baja' | 'Moderada' | 'Exigente' | 'Alta Montaña';
          duration_label: string;
          price_ars: number;
          capacity_per_date: number;
          dates: string[];
          status: 'borrador' | 'publicada';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          slug: string;
          title: string;
          short_title?: string | null;
          tagline?: string;
          description?: string;
          region?: string;
          meeting_point?: string;
          difficulty?: 'Baja' | 'Moderada' | 'Exigente' | 'Alta Montaña';
          duration_label?: string;
          price_ars?: number;
          capacity_per_date?: number;
          dates?: string[];
          status?: 'borrador' | 'publicada';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          slug?: string;
          title?: string;
          short_title?: string | null;
          tagline?: string;
          description?: string;
          region?: string;
          meeting_point?: string;
          difficulty?: 'Baja' | 'Moderada' | 'Exigente' | 'Alta Montaña';
          duration_label?: string;
          price_ars?: number;
          capacity_per_date?: number;
          dates?: string[];
          status?: 'borrador' | 'publicada';
          updated_at?: string;
        };
        Relationships: [];
      };

      /**
       * Tabla 6: Pagos por Transferencia & Comprobantes en Cloudflare R2
       */
      pagos_transferencias: {
        Row: {
          id: string;
          reference: string;
          experience_id: string;
          experience_title: string;
          date: string;
          participants: number;
          amount_ars: number;
          discount_code: string | null;
          discount_ars: number | null;
          full_name: string;
          email: string;
          dni: string;
          phone: string;
          socio_id: string | null;
          receipt_file_name: string;
          receipt_mime_type: string;
          receipt_size_bytes: number;
          receipt_url: string;
          receipt_storage_key: string | null;
          receipt_storage_provider: 'r2' | 'supabase' | 'local';
          status: 'pendiente' | 'aprobado' | 'rechazado';
          rejection_reason: string | null;
          submitted_at: string;
          reviewed_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reference: string;
          experience_id: string;
          experience_title: string;
          date: string;
          participants: number;
          amount_ars: number;
          discount_code?: string | null;
          discount_ars?: number | null;
          full_name: string;
          email: string;
          dni: string;
          phone: string;
          socio_id?: string | null;
          receipt_file_name: string;
          receipt_mime_type: string;
          receipt_size_bytes: number;
          receipt_url: string;
          receipt_storage_key?: string | null;
          receipt_storage_provider?: 'r2' | 'supabase' | 'local';
          status?: 'pendiente' | 'aprobado' | 'rechazado';
          rejection_reason?: string | null;
          submitted_at?: string;
          reviewed_at?: string | null;
          updated_at?: string;
        };
        Update: {
          status?: 'pendiente' | 'aprobado' | 'rechazado';
          rejection_reason?: string | null;
          reviewed_at?: string | null;
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
      submit_experience_transfer: {
        Args: {
          p_reference: string;
          p_experience_id: string;
          p_experience_title: string;
          p_date: string;
          p_participants: number;
          p_amount_ars: number;
          p_discount_code?: string | null;
          p_discount_ars?: number;
          p_full_name?: string;
          p_email?: string;
          p_dni?: string;
          p_phone?: string;
          p_receipt_file_name?: string;
          p_receipt_mime_type?: string;
          p_receipt_size_bytes?: number;
          p_receipt_url?: string;
          p_receipt_storage_key?: string | null;
          p_receipt_storage_provider?: string;
        };
        Returns: Json;
      };
      get_reserved_seats_by_experience: {
        Args: {
          p_experience_id: string;
        };
        Returns: Json;
      };
      get_member_transfer_submissions: {
        Args: {
          p_email: string;
          p_registration_token?: string | null;
        };
        Returns: Json;
      };
      list_provider_transfer_submissions: {
        Args: Record<string, never>;
        Returns: Json;
      };
      review_transfer_submission: {
        Args: {
          p_submission_id: string;
          p_status: string;
          p_rejection_reason?: string | null;
        };
        Returns: Json;
      };
    };
    Enums: {
      membership_tier: MembershipTier;
    };
  };
}
