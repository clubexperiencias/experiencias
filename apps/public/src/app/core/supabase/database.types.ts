/**
 * Tipos de TypeScript para la base de datos de Supabase de EXPERIENCIAS.CLUB.
 * Esquema canónico en español: socios, prestadores, administradores, historial_bancario,
 * experiencias, postulaciones_fundadores y pagos_transferencias.
 * Sincronizado con supabase/schema.sql
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type MembershipTier = 'emergente' | 'activo' | 'fundador' | 'waitlist' | 'dado_de_baja';

export interface Database {
  public: {
    Tables: {
      prestadores: {
        Row: {
          id: string;
          email: string;
          name: string;
          agency: string;
          active: boolean;
          status: 'aprobado' | 'pendiente' | 'rechazado' | 'dado_de_baja';
          cbu_alias?: string;
          cuit_dni?: string;
          bank_name?: string;
          account_holder?: string;
          phone?: string;
          website?: string;
          social_media?: string;
          social_media_secondary?: string;
          slug?: string;
          bio?: string;
          avatar_url?: string;
          cover_url?: string;
          category?: string;
          region?: string;
          description?: string;
          notes?: string | null;
          tier?: 'emergente' | 'pleno' | 'fundador' | string;
          rubro?: string;
          rating_score?: number;
          rating_count?: number;
          verified?: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name?: string;
          agency?: string;
          active?: boolean;
          status?: 'aprobado' | 'pendiente' | 'rechazado' | 'dado_de_baja';
          cbu_alias?: string;
          cuit_dni?: string;
          bank_name?: string;
          account_holder?: string;
          phone?: string;
          website?: string;
          social_media?: string;
          social_media_secondary?: string;
          slug?: string;
          bio?: string;
          avatar_url?: string;
          cover_url?: string;
          category?: string;
          region?: string;
          description?: string;
          notes?: string | null;
          tier?: 'emergente' | 'pleno' | 'fundador' | string;
          rubro?: string;
          rating_score?: number;
          rating_count?: number;
          verified?: boolean;
          created_at?: string;
        };
        Update: {
          email?: string;
          name?: string;
          agency?: string;
          active?: boolean;
          status?: 'aprobado' | 'pendiente' | 'rechazado' | 'dado_de_baja';
          cbu_alias?: string;
          cuit_dni?: string;
          bank_name?: string;
          account_holder?: string;
          phone?: string;
          website?: string;
          social_media?: string;
          social_media_secondary?: string;
          slug?: string;
          bio?: string;
          avatar_url?: string;
          cover_url?: string;
          category?: string;
          region?: string;
          description?: string;
          notes?: string | null;
          tier?: 'emergente' | 'pleno' | 'fundador' | string;
          rubro?: string;
          rating_score?: number;
          rating_count?: number;
          verified?: boolean;
        };
        Relationships: [];
      };
      administradores: {
        Row: {
          id: string;
          email: string;
          name: string;
          role: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name?: string;
          role?: string;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          email?: string;
          name?: string;
          role?: string;
          active?: boolean;
        };
        Relationships: [];
      };
      historial_bancario: {
        Row: {
          id: string;
          provider_email: string;
          cbu_alias: string | null;
          cuit_dni: string | null;
          bank_name: string | null;
          account_holder: string | null;
          old_cbu_alias: string | null;
          new_cbu_alias: string | null;
          old_name: string | null;
          new_name: string | null;
          old_cuit_dni: string | null;
          new_cuit_dni: string | null;
          old_bank_name: string | null;
          new_bank_name: string | null;
          old_account_holder: string | null;
          new_account_holder: string | null;
          changed_by: string;
          changed_at: string;
        };
        Insert: {
          id?: string;
          provider_email: string;
          cbu_alias?: string | null;
          cuit_dni?: string | null;
          bank_name?: string | null;
          account_holder?: string | null;
          old_cbu_alias?: string | null;
          new_cbu_alias?: string | null;
          old_name?: string | null;
          new_name?: string | null;
          old_cuit_dni?: string | null;
          new_cuit_dni?: string | null;
          old_bank_name?: string | null;
          new_bank_name?: string | null;
          old_account_holder?: string | null;
          new_account_holder?: string | null;
          changed_by: string;
          changed_at?: string;
        };
        Update: {
          provider_email?: string;
          cbu_alias?: string | null;
          cuit_dni?: string | null;
          bank_name?: string | null;
          account_holder?: string | null;
          old_cbu_alias?: string | null;
          new_cbu_alias?: string | null;
          old_name?: string | null;
          new_name?: string | null;
          old_cuit_dni?: string | null;
          new_cuit_dni?: string | null;
          old_bank_name?: string | null;
          new_bank_name?: string | null;
          old_account_holder?: string | null;
          new_account_holder?: string | null;
          changed_by?: string;
          changed_at?: string;
        };
        Relationships: [];
      };
      historial_mp: {
        Row: {
          id: string;
          provider_email: string;
          action: 'connect' | 'disconnect' | 'update';
          collector_id: string | null;
          mp_nickname: string | null;
          mp_email: string | null;
          details: Record<string, any> | null;
          changed_by: string;
          changed_at: string;
        };
        Insert: {
          id?: string;
          provider_email: string;
          action: 'connect' | 'disconnect' | 'update';
          collector_id?: string | null;
          mp_nickname?: string | null;
          mp_email?: string | null;
          details?: Record<string, any> | null;
          changed_by: string;
          changed_at?: string;
        };
        Update: {
          id?: string;
          provider_email?: string;
          action?: 'connect' | 'disconnect' | 'update';
          collector_id?: string | null;
          mp_nickname?: string | null;
          mp_email?: string | null;
          details?: Record<string, any> | null;
          changed_by?: string;
          changed_at?: string;
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
          position: number | null;
          membership_tier: MembershipTier;
          auth_user_id: string | null;
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
          position?: number | null;
          membership_tier?: MembershipTier;
          auth_user_id?: string | null;
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
          position?: number | null;
          membership_tier?: MembershipTier;
          auth_user_id?: string | null;
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
       * Tabla: Experiencias Oficiales y Propuestas del Club (public.experiencias)
       */
      experiencias: {
        Row: {
          id: string;
          slug: string;
          title: string;
          short_title: string | null;
          tagline: string;
          description: string;
          region: string;
          meeting_point: string;
          meeting_point_url: string;
          cover_image: string;
          kicker?: string;
          video_url?: string;
          video_poster?: string;
          difficulty: 'Baja' | 'Moderada' | 'Exigente' | 'Alta Montaña' | 'Ninguna' | string;
          duration_label: string;
          altitude_meters?: number;
          best_season?: string;
          itinerary?: string;
          promos_and_pricing?: string;
          pricing_packs?: any;
          price_ars: number;
          price_usd?: number;
          capacity_per_date: number;
          dates: string[];
          highlights?: string[];
          included?: string[];
          not_included?: string[];
          status: 'borrador' | 'publicada' | 'oculta' | 'pendiente' | 'rechazada';
          public_url?: string;
          provider_id?: string | null;
          provider_name?: string | null;
          provider_agency?: string | null;
          provider_email?: string | null;
          provider_phone?: string | null;
          participant_requirements?: string | null;
          notes?: string | null;
          rejection_reason?: string | null;
          reviewed_at?: string | null;
          deleted_at?: string | null;
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
          meeting_point_url?: string;
          cover_image?: string;
          kicker?: string;
          video_url?: string;
          video_poster?: string;
          difficulty?: 'Baja' | 'Moderada' | 'Exigente' | 'Alta Montaña' | 'Ninguna' | string;
          duration_label?: string;
          altitude_meters?: number;
          best_season?: string;
          itinerary?: string;
          promos_and_pricing?: string;
          pricing_packs?: any;
          price_ars?: number;
          price_usd?: number;
          capacity_per_date?: number;
          dates?: string[];
          highlights?: string[];
          included?: string[];
          not_included?: string[];
          status?: 'borrador' | 'publicada' | 'oculta' | 'pendiente' | 'rechazada';
          public_url?: string;
          provider_id?: string | null;
          provider_name?: string | null;
          provider_agency?: string | null;
          provider_email?: string | null;
          provider_phone?: string | null;
          participant_requirements?: string | null;
          notes?: string | null;
          rejection_reason?: string | null;
          reviewed_at?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          title?: string;
          short_title?: string | null;
          tagline?: string;
          description?: string;
          region?: string;
          meeting_point?: string;
          meeting_point_url?: string;
          cover_image?: string;
          kicker?: string;
          video_url?: string;
          video_poster?: string;
          difficulty?: 'Baja' | 'Moderada' | 'Exigente' | 'Alta Montaña' | 'Ninguna' | string;
          duration_label?: string;
          altitude_meters?: number;
          best_season?: string;
          itinerary?: string;
          promos_and_pricing?: string;
          pricing_packs?: any;
          price_ars?: number;
          price_usd?: number;
          capacity_per_date?: number;
          dates?: string[];
          highlights?: string[];
          included?: string[];
          not_included?: string[];
          status?: 'borrador' | 'publicada' | 'oculta' | 'pendiente' | 'rechazada';
          public_url?: string;
          provider_id?: string | null;
          provider_name?: string | null;
          provider_agency?: string | null;
          provider_email?: string | null;
          provider_phone?: string | null;
          participant_requirements?: string | null;
          notes?: string | null;
          rejection_reason?: string | null;
          reviewed_at?: string | null;
          deleted_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };

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
          cover_image: string;
          difficulty: 'Baja' | 'Moderada' | 'Exigente' | 'Alta Montaña' | 'Ninguna';
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
          cover_image?: string;
          difficulty?: 'Baja' | 'Moderada' | 'Exigente' | 'Alta Montaña' | 'Ninguna';
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
          cover_image?: string;
          difficulty?: 'Baja' | 'Moderada' | 'Exigente' | 'Alta Montaña' | 'Ninguna';
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
       * Tabla 6: Pagos por Transferencia & Comprobantes en Supabase Storage
       */
      pagos_transferencias: {
        Row: {
          id: string;
          reference: string;
          experience_id: string;
          experience_title: string;
          provider_email?: string | null;
          date: string;
          selected_date?: string;
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
          receipt_storage_path?: string | null;
          receipt_storage_provider: 'supabase' | 'local' | string;
          status: 'pendiente' | 'aprobado' | 'rechazado';
          rejection_reason: string | null;
          submitted_at: string;
          created_at?: string;
          reviewed_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reference: string;
          experience_id: string;
          experience_title: string;
          provider_email?: string | null;
          date?: string;
          selected_date?: string;
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
          receipt_storage_path?: string | null;
          receipt_storage_provider?: 'supabase' | 'local' | string;
          status?: 'pendiente' | 'aprobado' | 'rechazado';
          rejection_reason?: string | null;
          submitted_at?: string;
          created_at?: string;
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

      calificaciones_prestadores: {
        Row: {
          id: string;
          prestador_id: string;
          socio_id: string | null;
          socio_email: string;
          score: number;
          comentario: string | null;
          experience_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          prestador_id: string;
          socio_id?: string | null;
          socio_email: string;
          score: number;
          comentario?: string | null;
          experience_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          prestador_id?: string;
          socio_id?: string | null;
          socio_email?: string;
          score?: number;
          comentario?: string | null;
          experience_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };

      experiencias_favoritas: {
        Row: {
          id: string;
          socio_id: string | null;
          socio_email: string;
          experience_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          socio_id?: string | null;
          socio_email: string;
          experience_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          socio_id?: string | null;
          socio_email?: string;
          experience_id?: string;
        };
        Relationships: [];
      };

      experiencias_favoritos: {
        Row: {
          id: string;
          socio_id: string | null;
          socio_email: string;
          experience_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          socio_id?: string | null;
          socio_email: string;
          experience_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          socio_id?: string | null;
          socio_email?: string;
          experience_id?: string;
        };
        Relationships: [];
      };

      descuentos: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string;
          discount_type: 'percentage' | 'fixed_amount';
          discount_value: number;
          scope: 'general' | 'experience' | 'provider' | 'membership';
          experience_id: string | null;
          experience_slug: string | null;
          provider_id: string | null;
          is_automatic: boolean;
          min_amount_ars: number;
          max_discount_ars: number | null;
          starts_at: string | null;
          ends_at: string | null;
          max_uses: number | null;
          uses_count: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          description?: string;
          discount_type: 'percentage' | 'fixed_amount';
          discount_value: number;
          scope?: 'general' | 'experience' | 'provider' | 'membership';
          experience_id?: string | null;
          experience_slug?: string | null;
          provider_id?: string | null;
          is_automatic?: boolean;
          min_amount_ars?: number;
          max_discount_ars?: number | null;
          starts_at?: string | null;
          ends_at?: string | null;
          max_uses?: number | null;
          uses_count?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          description?: string;
          discount_type?: 'percentage' | 'fixed_amount';
          discount_value?: number;
          scope?: 'general' | 'experience' | 'provider' | 'membership';
          experience_id?: string | null;
          experience_slug?: string | null;
          provider_id?: string | null;
          is_automatic?: boolean;
          min_amount_ars?: number;
          max_discount_ars?: number | null;
          starts_at?: string | null;
          ends_at?: string | null;
          max_uses?: number | null;
          uses_count?: number;
          active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      testimonios: {
        Row: {
          id: string;
          socio_id: string | null;
          email: string;
          full_name: string;
          membership_tier: 'fundador' | 'activo' | 'emergente' | 'waitlist';
          content: string;
          active: boolean;
          featured: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          socio_id?: string | null;
          email: string;
          full_name?: string;
          membership_tier?: 'fundador' | 'activo' | 'emergente' | 'waitlist';
          content: string;
          active?: boolean;
          featured?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          socio_id?: string | null;
          email?: string;
          full_name?: string;
          membership_tier?: 'fundador' | 'activo' | 'emergente' | 'waitlist';
          content?: string;
          active?: boolean;
          featured?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };

    Views: {
      estadisticas_socios: {
        Row: {
          total_members: number;
          max_position: number | null;
          total_socios: number;
          total_waitlist: number;
          total_fundadores: number;
          total_activos: number;
          total_emergentes: number;
          last_position: number | null;
        };
        Relationships: [];
      };
      perfiles_publicos: {
        Row: {
          id?: string;
          email: string;
          name: string;
          agency: string;
          slug: string;
          bio: string;
          phone: string;
          website: string;
          social_media: string;
          social_media_secondary: string;
          avatar_url: string;
          cover_url: string;
          active: boolean;
          status: string;
          tier?: string;
          rubro?: string;
          rating_score?: number;
          rating_count?: number;
          verified?: boolean;
        };
        Relationships: [];
      };
      v_prestadores_ranking: {
        Row: {
          id: string;
          name: string;
          agency: string;
          slug: string;
          tier: string;
          rubro: string;
          rating_score: number;
          rating_count: number;
          verified: boolean;
          active: boolean;
          total_experiencias_activas: number;
          avatar_url: string;
          cover_url: string;
        };
        Relationships: [];
      };
    };

    Functions: {
      activate_socio_pleno_atomic: {
        Args: {
          p_email: string;
          p_full_name: string;
          p_dni: string;
          p_phone: string;
          p_discount_code?: string | null;
          p_experiences_wishlist?: Json | null;
          p_experiences_other?: string | null;
        };
        Returns: Json;
      };
      admin_soft_delete_experience: {
        Args: {
          p_experience_id: string;
        };
        Returns: Json;
      };
      record_discount_redemption: {
        Args: {
          p_code: string;
          p_reference?: string | null;
        };
        Returns: Json;
      };
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
      check_provider_status: {
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
      register_socio_atomic: {
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
          p_stay_length?: number | null;
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
      get_admin_socios_roster: {
        Args: Record<string, never>;
        Returns: Json;
      };
      is_active_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      toggle_experiencia_favorita: {
        Args: {
          p_experience_id: string;
          p_socio_email?: string | null;
          p_is_favorite?: boolean | null;
        };
        Returns: Json;
      };
      toggle_experiencia_favorito: {
        Args: {
          p_experience_id: string;
          p_socio_email?: string | null;
          p_is_favorite?: boolean | null;
        };
        Returns: Json;
      };
      submit_socio_testimonio: {
        Args: {
          p_content: string;
          p_email?: string | null;
        };
        Returns: Json;
      };
      get_socios_testimonios: {
        Args: Record<string, never>;
        Returns: Json;
      };
      get_my_socio_testimonio: {
        Args: Record<string, never>;
        Returns: Json;
      };
    };
    Enums: {
      membership_tier: MembershipTier;
    };
  };
}
