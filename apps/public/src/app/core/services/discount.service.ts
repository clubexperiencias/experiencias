import { Injectable, computed, inject, signal } from '@angular/core';
import { SUPABASE_CLIENT } from '../supabase/supabase.client';
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
        payload['experience_id'] = dto.scope === 'experience' ? dto.experienceId : null;
        payload['experience_slug'] = dto.scope === 'experience' ? dto.experienceSlug : null;
        payload['provider_id'] = dto.scope === 'provider' ? dto.providerId : null;
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
  getAutomaticDiscountForExperience(experienceId?: string | null, experienceSlug?: string | null): Discount | null {
    const list = this._discounts().filter((d) => d.active && d.isAutomatic);
    return (
      list.find((d) => {
        if (d.scope === 'experience') {
          if (experienceId && d.experienceId === experienceId) return true;
          if (experienceSlug && d.experienceSlug === experienceSlug) return true;
          return false;
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
  ): Promise<DiscountValidationResult> {
    const cleanCode = (rawCode || '').trim().toUpperCase();
    if (!cleanCode) {
      return { valid: false, discountArs: 0, error: 'Ingresá un código.' };
    }

    // 1. Buscar en cache local primero
    let discount = this._discounts().find((d) => d.code === cleanCode);

    // 2. Si no está en cache local o falta consultar Supabase, consultar directamente
    if (!discount && this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('descuentos')
          .select('*')
          .eq('code', cleanCode)
          .maybeSingle();

        if (!error && data) {
          discount = mapSupabaseDiscount(data);
          this._discounts.update((prev) => {
            const exists = prev.some((d) => d.id === discount!.id);
            return exists ? prev.map((d) => (d.id === discount!.id ? discount! : d)) : [discount!, ...prev];
          });
        }
      } catch (err) {
        console.warn('[DiscountService] Error consultando cupón:', err);
      }
    }

    if (!discount) {
      return { valid: false, discountArs: 0, error: 'Código de descuento no válido.' };
    }

    if (!discount.active) {
      return { valid: false, discountArs: 0, error: 'Este código de descuento no está activo.' };
    }

    // Validar vigencia de fechas
    const now = new Date();
    if (discount.startsAt && new Date(discount.startsAt) > now) {
      return { valid: false, discountArs: 0, error: 'Esta promoción aún no ha comenzado.' };
    }
    if (discount.endsAt && new Date(discount.endsAt) < now) {
      return { valid: false, discountArs: 0, error: 'Este código de descuento ha expirado.' };
    }

    // Validar límite de usos
    if (discount.maxUses != null && discount.usesCount >= discount.maxUses) {
      return { valid: false, discountArs: 0, error: 'Este código ha alcanzado el límite máximo de usos.' };
    }

    // Validar alcance (scope)
    if (discount.scope === 'experience') {
      const matchId = experienceId && discount.experienceId === experienceId;
      const matchSlug = experienceSlug && discount.experienceSlug === experienceSlug;
      if (!matchId && !matchSlug) {
        return {
          valid: false,
          discountArs: 0,
          error: 'Este código de descuento no aplica para la experiencia seleccionada.',
        };
      }
    }

    // Validar monto mínimo
    if (discount.minAmountArs > 0 && subtotalArs < discount.minAmountArs) {
      return {
        valid: false,
        discountArs: 0,
        error: `El monto mínimo de reserva para este cupón es de $${discount.minAmountArs.toLocaleString('es-AR')}.`,
      };
    }

    // Cálculo del descuento
    const discountArs = calculateDiscountAmount(subtotalArs, discount);

    return {
      valid: true,
      discount,
      discountArs,
    };
  }

  /**
   * Incrementa el contador de usos de un descuento tras confirmar un pago o reserva
   */
  async incrementDiscountUses(code: string): Promise<void> {
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode || !this.supabase) return;

    try {
      const current = this._discounts().find((d) => d.code === cleanCode);
      if (current) {
        const nextUses = current.usesCount + 1;
        await this.supabase
          .from('descuentos')
          .update({ uses_count: nextUses, updated_at: new Date().toISOString() })
          .eq('id', current.id);

        this._discounts.update((prev) =>
          prev.map((d) => (d.id === current.id ? { ...d, usesCount: nextUses } : d)),
        );
      } else {
        // Incremento directo por código
        const { data } = await this.supabase
          .from('descuentos')
          .select('id, uses_count')
          .eq('code', cleanCode)
          .maybeSingle();

        if (data) {
          const rowData = data as any;
          await this.supabase
            .from('descuentos')
            .update({ uses_count: (rowData.uses_count || 0) + 1, updated_at: new Date().toISOString() })
            .eq('id', rowData.id);
        }
      }
    } catch (err) {
      console.warn('[DiscountService] No se pudo incrementar el uso del cupón:', err);
    }
  }
}
