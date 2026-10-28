/**
 * Hand-written to mirror supabase/migrations. Once the project is linked, regenerate with:
 *   SUPABASE_PROJECT_ID=xxxx pnpm --filter @experiencias/supabase gen:types
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Timestamps = { created_at: string; updated_at: string };

type AppRole = 'member' | 'provider' | 'admin';
type MembershipTier = 'emergente' | 'activo' | 'fundador';
type ProviderCategory =
  | 'guia_montana'
  | 'guia_cultural'
  | 'guia_nautico'
  | 'transporte_4x4'
  | 'alojamiento'
  | 'gastronomia'
  | 'artesanias'
  | 'fotografia'
  | 'bienestar_termas'
  | 'otro';
type ProviderApplicationStatus = 'pending' | 'approved' | 'rejected';
type ProviderStatus = 'active' | 'suspended';
type ExperienceStatus = 'draft' | 'published' | 'archived';
type ExperienceProviderRole = 'lead' | 'support';
type AvailabilitySlotStatus = 'open' | 'closed' | 'cancelled';
type BookingStatus = 'pending_payment' | 'confirmed' | 'cancelled' | 'completed';
type PayoutStatus = 'pending' | 'paid' | 'failed';
type WaitlistStatus = 'pending' | 'confirmed' | 'invited';

export interface Database {
  public: {
    Tables: {
      waitlist_members: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          interest: string | null;
          position: number;
          referral_code: string;
          status: WaitlistStatus;
          source: string;
          referred_by: string | null;
        } & Timestamps;
        Insert: never;
        Update: { status?: WaitlistStatus; full_name?: string | null; interest?: string | null };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          phone: string | null;
          role: AppRole;
          membership_tier: MembershipTier;
        } & Timestamps;
        Insert: never;
        Update: { full_name?: string | null; avatar_url?: string | null; phone?: string | null };
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          entity: string;
          entity_id: string | null;
          payload: Json;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      provider_applications: {
        Row: {
          id: string;
          user_id: string | null;
          email: string;
          full_name: string;
          phone: string | null;
          business_name: string | null;
          category: ProviderCategory;
          region: string;
          description: string;
          cuit: string | null;
          website: string | null;
          instagram_handle: string | null;
          status: ProviderApplicationStatus;
          reviewed_by: string | null;
          reviewed_at: string | null;
          rejection_reason: string | null;
        } & Timestamps;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      provider_profiles: {
        Row: {
          user_id: string;
          application_id: string | null;
          business_name: string;
          description: string | null;
          cuit: string | null;
          category: ProviderCategory;
          region: string;
          website: string | null;
          instagram_handle: string | null;
          whatsapp_number: string | null;
          logo_url: string | null;
          bank_alias_cbu: string | null;
          commission_percent: number;
          status: ProviderStatus;
        } & Timestamps;
        Insert: never;
        Update: {
          business_name?: string;
          description?: string | null;
          website?: string | null;
          instagram_handle?: string | null;
          whatsapp_number?: string | null;
          logo_url?: string | null;
          bank_alias_cbu?: string | null;
        };
        Relationships: [];
      };
      experiences: {
        Row: {
          id: string;
          slug: string;
          title: string;
          summary: string | null;
          description: string | null;
          region: string;
          category: ProviderCategory;
          duration_minutes: number | null;
          price_ars: number;
          capacity: number;
          cover_image_url: string | null;
          status: ExperienceStatus;
          created_by: string | null;
        } & Timestamps;
        Insert: {
          slug: string;
          title: string;
          summary?: string | null;
          description?: string | null;
          region: string;
          category: ProviderCategory;
          duration_minutes?: number | null;
          price_ars: number;
          capacity: number;
          cover_image_url?: string | null;
          status?: ExperienceStatus;
        };
        Update: Partial<Database['public']['Tables']['experiences']['Insert']>;
        Relationships: [];
      };
      experience_providers: {
        Row: {
          experience_id: string;
          provider_id: string;
          role: ExperienceProviderRole;
          created_at: string;
        };
        Insert: { experience_id: string; provider_id: string; role?: ExperienceProviderRole };
        Update: { role?: ExperienceProviderRole };
        Relationships: [];
      };
      availability_slots: {
        Row: {
          id: string;
          experience_id: string;
          starts_at: string;
          ends_at: string;
          capacity: number;
          booked_count: number;
          status: AvailabilitySlotStatus;
        } & Timestamps;
        Insert: {
          experience_id: string;
          starts_at: string;
          ends_at: string;
          capacity: number;
          status?: AvailabilitySlotStatus;
        };
        Update: {
          starts_at?: string;
          ends_at?: string;
          capacity?: number;
          status?: AvailabilitySlotStatus;
        };
        Relationships: [];
      };
      bookings: {
        Row: {
          id: string;
          slot_id: string;
          experience_id: string;
          member_id: string;
          seats: number;
          total_ars: number;
          status: BookingStatus;
          notes: string | null;
        } & Timestamps;
        Insert: never;
        Update: { status?: BookingStatus; notes?: string | null };
        Relationships: [];
      };
      provider_payouts: {
        Row: {
          id: string;
          provider_id: string;
          period_start: string;
          period_end: string;
          amount_ars: number;
          status: PayoutStatus;
          receipt_url: string | null;
          paid_at: string | null;
        } & Timestamps;
        Insert: {
          provider_id: string;
          period_start: string;
          period_end: string;
          amount_ars: number;
          status?: PayoutStatus;
          receipt_url?: string | null;
          paid_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['provider_payouts']['Insert']>;
        Relationships: [];
      };
    };
    Views: {
      waitlist_stats: {
        Row: {
          total_members: number;
          confirmed_members: number;
          invited_members: number;
          max_position: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      current_app_role: { Args: Record<string, never>; Returns: AppRole | null };
      join_waitlist: {
        Args: { p_email: string; p_full_name?: string; p_interest?: string; p_referred_by?: string };
        Returns: { position: number; referral_code: string }[];
      };
      submit_provider_application: {
        Args: {
          p_email: string;
          p_full_name: string;
          p_category: ProviderCategory;
          p_region: string;
          p_description: string;
          p_phone?: string;
          p_business_name?: string;
          p_cuit?: string;
          p_website?: string;
          p_instagram_handle?: string;
        };
        Returns: string;
      };
      admin_set_user_role: { Args: { p_user_id: string; p_role: AppRole }; Returns: undefined };
      admin_approve_provider_application: {
        Args: { p_application_id: string; p_user_id: string };
        Returns: undefined;
      };
      admin_reject_provider_application: {
        Args: { p_application_id: string; p_reason: string };
        Returns: undefined;
      };
      create_booking: { Args: { p_slot_id: string; p_seats: number }; Returns: string };
    };
    Enums: {
      app_role: AppRole;
      membership_tier: MembershipTier;
      provider_category: ProviderCategory;
      provider_application_status: ProviderApplicationStatus;
      provider_status: ProviderStatus;
      experience_status: ExperienceStatus;
      experience_provider_role: ExperienceProviderRole;
      availability_slot_status: AvailabilitySlotStatus;
      booking_status: BookingStatus;
      payout_status: PayoutStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];
