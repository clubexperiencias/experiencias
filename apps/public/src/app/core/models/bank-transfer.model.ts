import type { ExperienceAlbumPhoto } from './experience.model';
export type { ExperienceAlbumPhoto };

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
  slug?: string;
  bio?: string;
  phone: string;
  website?: string;
  socialMedia?: string;
  socialMediaSecondary?: string;
  cuitDni: string;
  cbuAlias: string;
  bankName: string;
  accountHolder?: string;
  verified: boolean;
  active?: boolean;
  status?: 'aprobado' | 'pendiente' | 'rechazado' | 'dado_de_baja';
  role: 'prestador';
  avatar?: string;
  coverImage?: string;
  notes?: string;
  joinedAt: string;
  mpConnected?: boolean;
  mpCollectorId?: string;
  mpNickname?: string;
  mpEmail?: string;
}

export interface ExperienceDateSlot {
  date: string; // 'YYYY-MM-DD'
  capacity?: number; // Cupo específico o undefined para usar el cupo por defecto
  unlimited?: boolean; // True si no tiene límite de cupos
  closed?: boolean; // True si la fecha fue pausada/cerrada manualmente
  note?: string; // Nota descriptiva opcional
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
  dateSlots?: ExperienceDateSlot[];
  status: ExperienceStatus;
  moderation?: ExperienceModerationLog;
  publicUrl?: string;
  providerId: string;
  providerName: string;
  providerEmail?: string;
  providerSlug?: string;
  providerPhone?: string;
  providerCbuAlias?: string;
  providerCuitDni?: string;
  providerBankName?: string;
  mpConnected?: boolean;
  mpCollectorId?: string;
  coverImage?: string;
  albumPhotos?: ExperienceAlbumPhoto[];
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
  provider?: 'supabase' | 'local' | 'mercadopago';
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
  paymentMethod?: 'transfer' | 'mercadopago';
  surchargeArs?: number;
  mpPaymentId?: string;
  displayReference?: string;
  status: TransferStatus;
  rejectionReason?: string;
  submittedAt: string;
  reviewedAt?: string;
}

export const MP_TRANSFER_RECEIPT: TransferReceipt = {
  fileName: 'comprobante-mercadopago.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 0,
  url: 'https://www.mercadopago.com.ar',
  provider: 'local',
};

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
  paymentMethod?: 'transfer' | 'mercadopago';
  surchargeArs?: number;
}

export interface MercadoPagoPaymentInput {
  experienceId: string;
  date: string;
  participants: number;
  amountArs: number;
  baseAmountArs?: number;
  surchargeArs?: number;
  discountCode?: string;
  discountArs?: number;
  fullName: string;
  email: string;
  dni: string;
  phone: string;
  collectionId: string;
  reference?: string;
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

export interface PublicPaymentDestination {
  cbu: string;
  accountHolder: string;
  taxId: string;
  entity: string;
  isOfficialClub?: boolean;
}

export const BANK_TRANSFER_DESTINATION = {
  cbu: '3840200500000056402423',
  accountHolder: 'Patricio Facundo Diaz Tillar',
  taxId: '20-38628297-9',
  entity: 'Uala Bank S.A.U',
} as const;

export const RECEIPT_ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
export const MAX_PARTICIPANTS_PER_BOOKING = 6;
