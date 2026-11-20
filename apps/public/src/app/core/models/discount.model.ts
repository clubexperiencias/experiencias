export type DiscountType = 'percentage' | 'fixed_amount';
export type DiscountScope = 'general' | 'experience' | 'provider' | 'membership';

export interface Discount {
  id: string;
  code: string;
  name: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  scope: DiscountScope;
  experienceId?: string | null;
  experienceSlug?: string | null;
  providerId?: string | null;
  isAutomatic: boolean;
  minAmountArs: number;
  maxDiscountArs?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  maxUses?: number | null;
  usesCount: number;
  durationMonths?: number | null; // Duración en meses de Socio Pleno (ej. 1, 3, 6) para baja automática
  plenoOnly?: boolean; // Exclusivo para Socios Plenos activos (y Fundadores)
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CreateDiscountDto = Omit<Discount, 'id' | 'usesCount' | 'createdAt' | 'updatedAt'>;
export type UpdateDiscountDto = Partial<CreateDiscountDto>;

export interface DiscountValidationResult {
  valid: boolean;
  discount?: Discount;
  discountArs: number;
  error?: string;
  codeExists?: boolean;
}

/**
 * Mapeo de fila Supabase snake_case a Discount camelCase
 */
export function mapSupabaseDiscount(row: any): Discount {
  return {
    id: row.id,
    code: (row.code || '').toUpperCase().trim(),
    name: row.name || '',
    description: row.description || '',
    discountType: (row.discount_type || 'percentage') as DiscountType,
    discountValue: Number(row.discount_value) || 0,
    scope: (row.scope || 'general') as DiscountScope,
    experienceId: row.experience_id ?? null,
    experienceSlug: row.experience_slug ?? null,
    providerId: row.provider_id ?? null,
    isAutomatic: Boolean(row.is_automatic),
    minAmountArs: Number(row.min_amount_ars) || 0,
    maxDiscountArs: row.max_discount_ars != null ? Number(row.max_discount_ars) : null,
    startsAt: row.starts_at ?? null,
    endsAt: row.ends_at ?? null,
    maxUses: row.max_uses != null ? Number(row.max_uses) : null,
    usesCount: Number(row.uses_count) || 0,
    durationMonths: row.duration_months != null ? Number(row.duration_months) : null,
    plenoOnly: Boolean(row.pleno_only),
    active: row.active ?? true,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

/**
 * Calcula el monto a descontar en ARS
 */
export function calculateDiscountAmount(
  subtotalArs: number,
  discount?: Pick<Discount, 'discountType' | 'discountValue' | 'maxDiscountArs'> | null,
): number {
  if (!discount || subtotalArs <= 0) return 0;
  let amount = 0;
  if (discount.discountType === 'percentage') {
    amount = Math.round((subtotalArs * discount.discountValue) / 100);
    if (discount.maxDiscountArs && discount.maxDiscountArs > 0) {
      amount = Math.min(amount, discount.maxDiscountArs);
    }
  } else {
    amount = Math.round(discount.discountValue);
  }
  return Math.max(0, Math.min(amount, subtotalArs));
}

