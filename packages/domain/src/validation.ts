import { PROVIDER_CATEGORIES, type ProviderCategory } from './models';

export type ValidationErrors<T> = Partial<Record<keyof T, string>>;

export interface ValidationResult<T> {
  valid: boolean;
  errors: ValidationErrors<T>;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  return normalized.length <= 254 && EMAIL_PATTERN.test(normalized);
}

/** Validates an Argentine CUIT/CUIL (11 digits, mod-11 check digit). */
export function isValidCuit(value: string): boolean {
  const digits = value.replace(/[-\s]/g, '');
  if (!/^\d{11}$/.test(digits)) return false;

  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, weight, index) => acc + weight * Number(digits[index]), 0);
  const remainder = 11 - (sum % 11);
  const checkDigit = remainder === 11 ? 0 : remainder === 10 ? 9 : remainder;

  return checkDigit === Number(digits[10]);
}

export interface WaitlistSubmission {
  email: string;
  fullName?: string;
  interest?: string;
  referredBy?: string;
}

export function validateWaitlistSubmission(
  input: WaitlistSubmission,
): ValidationResult<WaitlistSubmission> {
  const errors: ValidationErrors<WaitlistSubmission> = {};

  if (!isValidEmail(input.email)) errors.email = 'Ingresá un email válido.';
  if (input.fullName && input.fullName.trim().length > 120) {
    errors.fullName = 'El nombre no puede superar los 120 caracteres.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export interface ProviderApplicationSubmission {
  email: string;
  fullName: string;
  phone?: string;
  businessName?: string;
  category: string;
  region: string;
  description: string;
  cuit?: string;
  website?: string;
  instagramHandle?: string;
}

export function isProviderCategory(value: string): value is ProviderCategory {
  return (PROVIDER_CATEGORIES as readonly string[]).includes(value);
}

export function validateProviderApplication(
  input: ProviderApplicationSubmission,
): ValidationResult<ProviderApplicationSubmission> {
  const errors: ValidationErrors<ProviderApplicationSubmission> = {};

  if (!isValidEmail(input.email)) errors.email = 'Ingresá un email válido.';

  const fullName = input.fullName.trim();
  if (fullName.length < 2 || fullName.length > 120) {
    errors.fullName = 'El nombre debe tener entre 2 y 120 caracteres.';
  }

  if (!isProviderCategory(input.category)) errors.category = 'Seleccioná una categoría válida.';
  if (input.region.trim().length < 2) errors.region = 'Indicá tu zona de operación.';

  const description = input.description.trim();
  if (description.length < 20 || description.length > 2000) {
    errors.description = 'La descripción debe tener entre 20 y 2000 caracteres.';
  }

  if (input.cuit && !isValidCuit(input.cuit)) errors.cuit = 'El CUIT/CUIL no es válido.';

  return { valid: Object.keys(errors).length === 0, errors };
}
