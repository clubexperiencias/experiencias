import { Injectable, computed, inject, signal } from '@angular/core';
import { SocioTestimonio, formatAuthorDisplay, formatTierLabel } from '../models/testimonial.model';
import { NewsletterService } from './newsletter.service';
import { SUPABASE_CLIENT, isSupabaseConfigured } from '../supabase/supabase.client';
import { MembershipTier } from '../models/waitlist.model';

const STORAGE_TESTIMONIOS_KEY = 'experiencias_club_testimonios_v1';

@Injectable({
  providedIn: 'root',
})
export class TestimoniosService {
  private readonly newsletter = inject(NewsletterService);
  private readonly supabase = inject(SUPABASE_CLIENT);

  readonly testimonios = signal<SocioTestimonio[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);
  readonly myTestimonio = signal<SocioTestimonio | null>(null);
  private loadGeneration = 0;

  /**
   * Testimonios destacados: exclusivamente de Socios Fundadores y Socios Plenos
   */
  readonly featuredTestimonios = computed(() => {
    return this.testimonios().filter(
      (t) => (t.membershipTier === 'fundador' || t.membershipTier === 'activo') && t.active
    );
  });

  /**
   * Muro de todos los testimonios ordenados según la jerarquía del club:
   * 1. Fundadores
   * 2. Plenos (activo)
   * 3. Emergentes
   * Desempate: mayor cantidad de experiencias reservadas/pagadas (paymentsCount DESC), luego fecha DESC.
   */
  readonly communityTestimonios = computed(() => {
    const tierPriority = (tier: string) => {
      switch (tier) {
        case 'fundador':
          return 1;
        case 'activo':
          return 2;
        case 'emergente':
          return 3;
        default:
          return 4;
      }
    };

    return [...this.testimonios()]
      .filter((t) => t.active)
      .sort((a, b) => {
        const priorityDiff = tierPriority(a.membershipTier) - tierPriority(b.membershipTier);
        if (priorityDiff !== 0) return priorityDiff;
        const paymentsDiff = (b.paymentsCount || 0) - (a.paymentsCount || 0);
        if (paymentsDiff !== 0) return paymentsDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  });

  constructor() {
    try {
      localStorage.removeItem(STORAGE_TESTIMONIOS_KEY);
    } catch {
      // no-op
    }
    this.loadTestimonios();
  }

  async loadTestimonios(): Promise<void> {
    const generation = ++this.loadGeneration;
    this.isLoading.set(true);
    try {
      if (isSupabaseConfigured() && this.supabase) {
        // 1. Intentar RPC get_socios_testimonios (proyección pública anónima sin email ni full_name)
        const { data, error } = await this.supabase.rpc('get_socios_testimonios');

        if (!error && Array.isArray(data)) {
          if (generation !== this.loadGeneration) return;

          const mapped: SocioTestimonio[] = data.map((row: any) => ({
            id: row.id,
            authorDisplay: row.author_display || 'Socio del Club',
            membershipTier: (row.membership_tier as MembershipTier) || 'emergente',
            tierLabel: row.tier_label || formatTierLabel(row.membership_tier),
            memberSince: row.member_since,
            content: row.content,
            paymentsCount: Number(row.payments_count) || 0,
            featured: Boolean(row.featured),
            active: row.active !== false,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }));

          this.testimonios.set(mapped);
          this.syncLocalUserTestimonio();
          return;
        }

        // 2. Fallback de lectura directa sobre la tabla restringido a columnas públicas no sensibles
        const { data: tableData, error: tableErr } = await (this.supabase
          .from('testimonios' as any) as any)
          .select('id, membership_tier, content, active, featured, created_at, updated_at')
          .eq('active', true)
          .order('created_at', { ascending: false });

        if (!tableErr && Array.isArray(tableData)) {
          if (generation !== this.loadGeneration) return;

          const mapped: SocioTestimonio[] = tableData.map((row: any) => ({
            id: row.id,
            authorDisplay: 'Socio del Club',
            membershipTier: (row.membership_tier as MembershipTier) || 'emergente',
            tierLabel: formatTierLabel(row.membership_tier),
            memberSince: row.created_at,
            content: row.content,
            paymentsCount: 0,
            featured: Boolean(row.featured),
            active: row.active !== false,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }));

          this.testimonios.set(mapped);
          this.syncLocalUserTestimonio();
          return;
        }
      }

      // Si no hay Supabase o no hay datos en la DB, la lista queda estrictamente vacía
      if (generation !== this.loadGeneration) return;
      this.testimonios.set([]);
    } catch {
      if (generation !== this.loadGeneration) return;
      this.testimonios.set([]);
    } finally {
      if (generation === this.loadGeneration) {
        this.isLoading.set(false);
      }
    }
  }

  async loadMyTestimonioFor(email?: string): Promise<SocioTestimonio | null> {
    const targetEmail = (email || this.newsletter.currentMember()?.email || '').toLowerCase().trim();
    if (!targetEmail) {
      this.myTestimonio.set(null);
      return null;
    }

    if (isSupabaseConfigured() && this.supabase) {
      try {
        // 1. Intentar RPC autenticada get_my_socio_testimonio
        const { data: rpcData, error: rpcErr } = await this.supabase.rpc('get_my_socio_testimonio');
        const rows = rpcData as any;
        if (!rpcErr && Array.isArray(rows) && rows.length > 0) {
          const row = rows[0];
          const item: SocioTestimonio = {
            id: row.id,
            socioId: row.socio_id,
            email: row.email,
            fullName: row.full_name || '',
            authorDisplay: row.author_display || formatAuthorDisplay(row.full_name),
            membershipTier: (row.membership_tier as MembershipTier) || 'emergente',
            tierLabel: row.tier_label || formatTierLabel(row.membership_tier),
            content: row.content,
            paymentsCount: 0,
            featured: Boolean(row.featured),
            active: row.active !== false,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          };
          this.myTestimonio.set(item);
          return item;
        }

        // 2. Fallback autenticado directo sobre la tabla (amparado por RLS de propietario)
        const { data, error } = await (this.supabase
          .from('testimonios' as any) as any)
          .select('*')
          .eq('email', targetEmail)
          .maybeSingle();

        if (!error && data) {
          const item: SocioTestimonio = {
            id: data.id,
            socioId: data.socio_id,
            email: data.email,
            fullName: data.full_name || '',
            authorDisplay: formatAuthorDisplay(data.full_name),
            membershipTier: (data.membership_tier as MembershipTier) || 'emergente',
            tierLabel: formatTierLabel(data.membership_tier),
            content: data.content,
            paymentsCount: 0,
            featured: Boolean(data.featured),
            active: data.active !== false,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          };
          this.myTestimonio.set(item);
          return item;
        }
      } catch {
        // silently fallback
      }
    }

    this.myTestimonio.set(null);
    return null;
  }

  async submitTestimonio(content: string): Promise<{ success: boolean; error?: string }> {
    const trimmed = (content || '').trim();
    if (trimmed.length < 10) {
      return { success: false, error: 'El testimonio debe tener al menos 10 caracteres.' };
    }
    if (trimmed.length > 1500) {
      return { success: false, error: 'El testimonio no puede superar los 1.500 caracteres.' };
    }

    const member = this.newsletter.currentMember();
    if (!member || !member.email) {
      return { success: false, error: 'Debes haber ingresado con tu cuenta de socio para publicar un testimonio.' };
    }

    this.isSubmitting.set(true);
    const email = member.email.toLowerCase().trim();
    const fullName = member.fullName || member.email.split('@')[0];
    const membershipTier = (member.membershipTier || 'emergente') as MembershipTier;
    const authorDisplay = formatAuthorDisplay(fullName);
    const tierLabel = formatTierLabel(membershipTier);

    try {
      if (isSupabaseConfigured() && this.supabase) {
        const { data, error } = await this.supabase.rpc('submit_socio_testimonio', {
          p_content: trimmed,
          p_email: email,
        });

        const resData = data as any;
        if (!error && resData) {
          if (!resData.success) {
            // Rechazo explícito de la RPC (ej. no es socio registrado o validación fallida).
            // Nunca se debe escribir a la base de datos tras una respuesta explícita success: false.
            return {
              success: false,
              error: resData.error || 'No se pudo registrar el testimonio.',
            };
          }
        } else if (error) {
          // Fallback únicamente si falló la invocación a la función RPC.
          // Antes de cualquier escritura directa, requerimos que exista la fila correspondiente en socios.
          const { data: socioRow, error: socioErr } = await (this.supabase
            .from('socios' as any) as any)
            .select('id, full_name, membership_tier')
            .eq('email', email)
            .maybeSingle();

          if (socioErr || !socioRow) {
            return {
              success: false,
              error: 'Solo los socios registrados pueden publicar un testimonio.',
            };
          }

          const { error: upsertErr } = await (this.supabase
            .from('testimonios' as any) as any)
            .upsert(
              {
                socio_id: socioRow.id,
                email,
                full_name: socioRow.full_name || fullName,
                membership_tier: (socioRow.membership_tier as MembershipTier) || membershipTier,
                content: trimmed,
                active: true,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'email' }
            );

          if (upsertErr) {
            return {
              success: false,
              error: upsertErr.message || 'Error al registrar el testimonio en la base de datos.',
            };
          }
        }
      } else {
        return { success: false, error: 'No hay conexión con la base de datos.' };
      }

      // Sincronizar desde la base de datos
      await this.loadTestimonios();
      await this.loadMyTestimonioFor(email);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error al guardar el testimonio.' };
    } finally {
      this.isSubmitting.set(false);
    }
  }

  private syncLocalUserTestimonio(): void {
    const member = this.newsletter.currentMember();
    if (!member || !member.email) return;
    void this.loadMyTestimonioFor(member.email);
  }
}

