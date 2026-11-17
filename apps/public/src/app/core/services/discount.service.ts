import { Injectable, computed, inject, signal } from '@angular/core';
import { SUPABASE_CLIENT } from '../supabase/supabase.client';
import { ExperienceService } from './experience.service';
import {
  Discount,
  CreateDiscountDto,
  UpdateDiscountDto,
  DiscountValidationResult,
  mapSupabaseDiscount,
  calculateDiscountAmount,
} from '../models/discount.model';

@Injectable({
  providedIn: 'root',
})
export class DiscountService {
  private readonly supabase = inject(SUPABASE_CLIENT, { optional: true });
  private readonly expService = inject(ExperienceService, { optional: true });

  private readonly _discounts = signal<Discount[]>([]);
  readonly discounts = this._discounts.asReadonly();

  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  readonly activeDiscounts = computed(() => this._discounts().filter((d) => d.active));
  readonly automaticDiscounts = computed(() => this._discounts().filter((d) => d.active && d.isAutomatic));

  constructor() {
    this.loadDiscounts();
  }

  /**
   * Carga todos los descuentos desde Supabase
   */
  async loadDiscounts(): Promise<Discount[]> {
    if (!this.supabase) {
      return this._discounts();
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const { data, error } = await this.supabase
        .from('descuentos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[DiscountService] Error al cargar descuentos:', error.message);
        this.error.set(error.message);
        return this._discounts();
      }

      if (data) {
        const mapped = data.map(mapSupabaseDiscount);
        this._discounts.set(mapped);
        return mapped;
      }
      return [];
    } catch (err: any) {
      console.error('[DiscountService] Excepción al cargar descuentos:', err);
      this.error.set(err?.message || 'Error de conexión');
      return this._discounts();
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Crea un nuevo descuento
   */
  async createDiscount(dto: CreateDiscountDto): Promise<Discount | null> {
    if (!this.supabase) return null;

    this.loading.set(true);
    try {
      const payload: Record<string, any> = {
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        description: (dto.description || '').trim(),
        discount_type: dto.discountType,
        discount_value: dto.discountValue,
        scope: dto.scope,
        experience_id: dto.scope === 'experience' ? dto.experienceId : null,
        experience_slug: dto.scope === 'experience' ? dto.experienceSlug : null,
        provider_id: dto.scope === 'provider' ? dto.providerId : null,
        is_automatic: dto.isAutomatic,
        min_amount_ars: dto.minAmountArs || 0,
        max_discount_ars: dto.maxDiscountArs || null,
        starts_at: dto.startsAt || null,
        ends_at: dto.endsAt || null,
        max_uses: dto.maxUses || null,
        active: dto.active,
      };

      const { data, error } = await this.supabase
        .from('descuentos')
        .insert(payload as any)
        .select()
        .single();

      if (error) {
        console.error('[DiscountService] Error al crear descuento:', error.message);
        throw error;
      }

      if (data) {
        const created = mapSupabaseDiscount(data);
        this._discounts.update((prev) => [created, ...prev]);
        return created;
      }
      return null;
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Actualiza un descuento existente
   */
  async updateDiscount(id: string, dto: UpdateDiscountDto): Promise<Discount | null> {
    if (!this.supabase) return null;

    this.loading.set(true);
    try {
      const payload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (dto.code !== undefined) payload['code'] = dto.code.trim().toUpperCase();
      if (dto.name !== undefined) payload['name'] = dto.name.trim();
      if (dto.description !== undefined) payload['description'] = dto.description.trim();
      if (dto.discountType !== undefined) payload['discount_type'] = dto.discountType;
      if (dto.discountValue !== undefined) payload['discount_value'] = dto.discountValue;
      if (dto.scope !== undefined) {
        payload['scope'] = dto.scope;
        if (dto.scope === 'general') {
          payload['experience_id'] = null;
          payload['experience_slug'] = null;
          payload['provider_id'] = null;
        } else if (dto.scope === 'experience') {
          payload['provider_id'] = null;
          if (dto.experienceId !== undefined) payload['experience_id'] = dto.experienceId;
          if (dto.experienceSlug !== undefined) payload['experience_slug'] = dto.experienceSlug;
        } else if (dto.scope === 'provider') {
          payload['experience_id'] = null;
          payload['experience_slug'] = null;
          if (dto.providerId !== undefined) payload['provider_id'] = dto.providerId;
        }
      } else {
        if (dto.experienceId !== undefined) payload['experience_id'] = dto.experienceId;
        if (dto.experienceSlug !== undefined) payload['experience_slug'] = dto.experienceSlug;
        if (dto.providerId !== undefined) payload['provider_id'] = dto.providerId;
      }
      if (dto.isAutomatic !== undefined) payload['is_automatic'] = dto.isAutomatic;
      if (dto.minAmountArs !== undefined) payload['min_amount_ars'] = dto.minAmountArs;
      if (dto.maxDiscountArs !== undefined) payload['max_discount_ars'] = dto.maxDiscountArs;
      if (dto.startsAt !== undefined) payload['starts_at'] = dto.startsAt;
      if (dto.endsAt !== undefined) payload['ends_at'] = dto.endsAt;
      if (dto.maxUses !== undefined) payload['max_uses'] = dto.maxUses;
      if (dto.active !== undefined) payload['active'] = dto.active;

      const { data, error } = await this.supabase
        .from('descuentos')
        .update(payload as any)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('[DiscountService] Error al actualizar descuento:', error.message);
        throw error;
      }

      if (data) {
        const updated = mapSupabaseDiscount(data);
        this._discounts.update((prev) => prev.map((d) => (d.id === id ? updated : d)));
        return updated;
      }
      return null;
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Cambia el estado activo/inactivo de un descuento
   */
  async toggleDiscountActive(id: string, active: boolean): Promise<boolean> {
    const updated = await this.updateDiscount(id, { active });
    return !!updated;
  }

  /**
   * Elimina un descuento
   */
  async deleteDiscount(id: string): Promise<boolean> {
    if (!this.supabase) return false;

    this.loading.set(true);
    try {
      const { error } = await this.supabase
        .from('descuentos')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[DiscountService] Error al eliminar descuento:', error.message);
        throw error;
      }

      this._discounts.update((prev) => prev.filter((d) => d.id !== id));
      return true;
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Obtiene descuento automático si existe para una experiencia específica
   */
  getAutomaticDiscountForExperience(
    experienceId?: string | null,
    experienceSlug?: string | null,
    providerId?: string | null,
  ): Discount | null {
    const now = new Date();
    const list = this._discounts().filter(
      (d) =>
        d.active &&
        d.isAutomatic &&
        (!d.startsAt || new Date(d.startsAt) <= now) &&
        (!d.endsAt || new Date(d.endsAt) >= now) &&
        (d.maxUses == null || d.usesCount < d.maxUses),
    );

    let resolvedProviderId = providerId || null;
    if (!resolvedProviderId && this.expService) {
      const exp =
        (experienceSlug ? this.expService.getExperienceBySlug(experienceSlug) : null) ||
        (experienceId ? this.expService.getExperienceById(experienceId) : null);
      if (exp?.providerId) {
        resolvedProviderId = exp.providerId;
      }
    }

    return (
      list.find((d) => {
        if (d.scope === 'experience') {
          if (experienceId && d.experienceId === experienceId) return true;
          if (experienceSlug && d.experienceSlug === experienceSlug) return true;
          return false;
        }
        if (d.scope === 'provider') {
          return Boolean(resolvedProviderId && d.providerId === resolvedProviderId);
        }
        if (d.scope === 'general') return true;
        return false;
      }) || null
    );
  }

  /**
   * Valida un cupón de descuento en tiempo real para el checkout
   */
  async validateDiscount(
    rawCode: string,
    experienceId?: string | null,
    experienceSlug?: string | null,
    subtotalArs: number = 0,
    providerId?: string | null,
    options?: { isMembership?: boolean },
  ): Promise<DiscountValidationResult> {
    const cleanCode = (rawCode || '').trim().toUpperCase();
    if (!cleanCode) {
      return { valid: false, discountArs: 0, error: 'Ingresá un código.', codeExists: false };
    }

    // 1. Si Supabase está disponible, consultar siempre el estado más reciente
    let discount: Discount | null = null;
    let fetchedFromRemote = false;

    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('descuentos')
          .select('*')
          .eq('code', cleanCode)
          .maybeSingle();

        if (!error) {
          fetchedFromRemote = true;
          if (data) {
            discount = mapSupabaseDiscount(data);
            this._discounts.update((prev) => {
              const exists = prev.some((d) => d.id === discount!.id);
              return exists ? prev.map((d) => (d.id === discount!.id ? discount! : d)) : [discount!, ...prev];
            });
          }
        }
      } catch (err) {
        console.warn('[DiscountService] Error consultando cupón fresco en Supabase:', err);
      }
    }

    // 2. Si no se pudo consultar de forma remota (sin Supabase o error), recurrir a cache local
    if (!fetchedFromRemote) {
      discount = this._discounts().find((d) => d.code === cleanCode) || null;
    }

    // 3. Fallback para membresía con códigos de adquisición predefinidos
    if (!discount && options?.isMembership) {
      if (
        ['PLENO100', 'SOCIO100', 'LANZAMIENTO100', 'BONIFICADO100', 'CLUB100', 'PLENO2027', 'INVITACION', 'FUNDADOR'].includes(
          cleanCode,
        )
      ) {
        const isPleno2027 = cleanCode === 'PLENO2027';
        discount = {
          id: `disc-${cleanCode.toLowerCase()}`,
          code: cleanCode,
          name: isPleno2027 ? 'Invitación Prestador Pleno 2027' : '100% Bonificado Socio Pleno',
          description: isPleno2027
            ? 'Invitación exclusiva para Prestador Pleno válida hasta 2027'
            : 'Membresía Socio Pleno bonificada con código promocional',
          discountType: 'percentage',
          discountValue: 100,
          scope: 'membership',
          isAutomatic: false,
          minAmountArs: 0,
          maxDiscountArs: null,
          startsAt: null,
          endsAt: isPleno2027 ? '2027-12-31T23:59:59.999Z' : '2026-12-31T23:59:59.999Z',
          maxUses: null,
          usesCount: 0,
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
    }

    if (!discount) {
      return { valid: false, discountArs: 0, error: 'Código de descuento no válido.', codeExists: false };
    }

    if (!discount.active) {
      return { valid: false, discount, discountArs: 0, error: 'Este código de descuento no está activo.', codeExists: true };
    }

    // Validar vigencia de fechas
    const now = new Date();
    if (discount.startsAt && new Date(discount.startsAt) > now) {
      return { valid: false, discount, discountArs: 0, error: 'Esta promoción aún no ha comenzado.', codeExists: true };
    }
    if (discount.endsAt && new Date(discount.endsAt) < now) {
      return { valid: false, discount, discountArs: 0, error: 'Este código de descuento ha expirado.', codeExists: true };
    }

    // Validar límite de usos
    if (discount.maxUses != null && discount.usesCount >= discount.maxUses) {
      return { valid: false, discount, discountArs: 0, error: 'Este código ha alcanzado el límite máximo de usos.', codeExists: true };
    }

    // Validar alcance (scope)
    if (options?.isMembership) {
      if (discount.scope !== 'general' && discount.scope !== 'membership') {
        return {
          valid: false,
          discount,
          discountArs: 0,
          error: 'Este código aplica solo para expediciones y no para la membresía de socio pleno.',
          codeExists: true,
        };
      }
    } else {
      if (discount.scope === 'membership') {
        return {
          valid: false,
          discount,
          discountArs: 0,
          error: 'Este código de descuento es exclusivo para la membresía mensual de Socio Pleno.',
          codeExists: true,
        };
      }

      if (discount.scope === 'experience') {
        const matchId = experienceId && discount.experienceId === experienceId;
        const matchSlug = experienceSlug && discount.experienceSlug === experienceSlug;
        if (!matchId && !matchSlug) {
          return {
            valid: false,
            discount,
            discountArs: 0,
            error: 'Este código de descuento no aplica para la experiencia seleccionada.',
            codeExists: true,
          };
        }
      } else if (discount.scope === 'provider') {
        let resolvedProviderId = providerId || null;

        if (!resolvedProviderId && this.expService) {
          const exp =
            (experienceSlug ? this.expService.getExperienceBySlug(experienceSlug) : null) ||
            (experienceId ? this.expService.getExperienceById(experienceId) : null);
          if (exp?.providerId) {
            resolvedProviderId = exp.providerId;
          }
        }

        if (!resolvedProviderId && this.supabase && (experienceId || experienceSlug)) {
          try {
            let query = this.supabase.from('experiencias').select('provider_id');
            if (experienceId) {
              query = query.eq('id', experienceId);
            } else if (experienceSlug) {
              query = query.eq('slug', experienceSlug);
            }
            const { data } = await query.maybeSingle();
            if (data && 'provider_id' in data && data.provider_id) {
              resolvedProviderId = (data as any).provider_id;
            }
          } catch (err) {
            console.warn('[DiscountService] Error resolviendo prestador de la experiencia:', err);
          }
        }

        if (!resolvedProviderId || resolvedProviderId !== discount.providerId) {
          return {
            valid: false,
            discount,
            discountArs: 0,
            error: 'Este código de descuento no aplica para el prestador de esta experiencia.',
            codeExists: true,
          };
        }
      }
    }

    // Validar monto mínimo
    if (discount.minAmountArs > 0 && subtotalArs < discount.minAmountArs) {
      return {
        valid: false,
        discount,
        discountArs: 0,
        error: `El monto mínimo de reserva para este cupón es de $${discount.minAmountArs.toLocaleString('es-AR')}.`,
        codeExists: true,
      };
    }

    // Cálculo del descuento
    const discountArs = calculateDiscountAmount(subtotalArs, discount);

    return {
      valid: true,
      discount,
      discountArs,
      codeExists: true,
    };
  }

  /**
   * Registra la redención de un cupón mediante operación backend autorizada tras confirmar un pago o reserva
   */
  async incrementDiscountUses(code: string, reservationReference?: string | null): Promise<boolean> {
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode || !this.supabase) return false;

    try {
      // 1. Invocar función RPC autorizada en el backend
      const { data, error } = await this.supabase.rpc('record_discount_redemption', {
        p_code: cleanCode,
        p_reference: reservationReference || null,
      });

      if (error) {
        console.warn('[DiscountService] Error al registrar redención de descuento en backend:', error.message);
        return false;
      }

      const res = data as any;
      if (res && res.status === 'ok') {
        const nextUses = Number(res.uses_count);
        const discountId = res.id;

        // 2. Confirmada la persistencia en el backend, actualizar estado local y cache
        this._discounts.update((prev) =>
          prev.map((d) => (d.code === cleanCode || d.id === discountId ? { ...d, usesCount: nextUses } : d)),
        );
        return true;
      }

      console.warn('[DiscountService] Redención no autorizada o cupón no válido en backend:', res?.status);
      return false;
    } catch (err) {
      console.warn('[DiscountService] Excepción al registrar redención de cupón:', err);
      return false;
    }
  }
}
