export type ExperienceStatus =
  | 'borrador'
  | 'pendiente_publicacion'
  | 'publicada'
  | 'pendiente_ocultar'
  | 'oculta'
  | 'pendiente_eliminar';

export interface ExperienceModerationLog {
  action: 'publicar' | 'ocultar' | 'eliminar';
  requestedAt: string;
  reason?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  adminNote?: string;
  status: 'pendiente' | 'aprobada' | 'rechazada';
}

export interface ProviderUser {
  id: string;
  email: string;
  name: string;
  agency: string;
  phone: string;
  cuitDni: string;
  cbuAlias: string;
  bankName: string;
  verified: boolean;
  role: 'prestador';
  avatar?: string;
  joinedAt: string;
}

export interface ProviderExperience {
  id: string;
  slug: string;
  title: string;
  shortTitle?: string;
  tagline: string;
  description: string;
  region: string;
  meetingPoint: string;
  difficulty: 'Baja' | 'Moderada' | 'Exigente' | 'Alta Montaña';
  durationLabel: string;
  priceArs: number;
  capacityPerDate: number;
  dates: string[];
  status: ExperienceStatus;
  moderation?: ExperienceModerationLog;
  providerId: string;
  providerName: string;
  coverImage?: string;
  createdAt: string;
  updatedAt?: string;
}

export type TransferStatus = 'pendiente' | 'aprobado' | 'rechazado';

export interface TransferReceipt {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  storageKey?: string;
  provider?: 'r2' | 'supabase' | 'local';
}

export interface TransferSubmission {
  id: string;
  reference: string;
  experienceId: string;
  experienceTitle: string;
  date: string;
  participants: number;
  amountArs: number;
  discountCode?: string;
  discountArs?: number;
  fullName: string;
  email: string;
  dni: string;
  phone: string;
  receipt: TransferReceipt;
  status: TransferStatus;
  rejectionReason?: string;
  submittedAt: string;
  reviewedAt?: string;
}

export interface NewTransferSubmission {
  experienceId: string;
  date: string;
  participants: number;
  fullName: string;
  email: string;
  dni: string;
  phone: string;
  discountCode?: string;
  receiptFile: File;
}

export interface DiscountCode {
  code: string;
  percentOff: number;
  label: string;
}

export const DISCOUNT_CODES: readonly DiscountCode[] = [
  { code: 'SOCIOFUNDADOR7', percentOff: 7, label: '7% socios fundadores' },
  { code: 'SOCIO10', percentOff: 10, label: '10% socios' },
  { code: 'FUNDADOR20', percentOff: 20, label: '20% socios fundadores' },
];

export function findDiscountCode(raw: string): DiscountCode | undefined {
  const normalized = raw.trim().toUpperCase();
  return DISCOUNT_CODES.find((d) => d.code === normalized);
}

export function discountAmount(subtotalArs: number, discount: DiscountCode | undefined): number {
  return discount ? Math.round((subtotalArs * discount.percentOff) / 100) : 0;
}

export type NewProviderExperience = Omit<ProviderExperience, 'id' | 'slug' | 'createdAt'>;

export const BANK_TRANSFER_DESTINATION = {
  cbu: '3840200500000056402423',
  accountHolder: 'Patricio Facundo Diaz Tillar',
  taxId: '20-38628297-9',
  entity: 'Uala Bank S.A.U',
} as const;

export const RECEIPT_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
export const MAX_PARTICIPANTS_PER_BOOKING = 6;
