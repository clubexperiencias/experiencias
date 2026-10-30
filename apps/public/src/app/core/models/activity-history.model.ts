export type ActivityStatus = 'completada' | 'confirmada' | 'pendiente_pago' | 'cancelada';

export interface PaymentReceipt {
  receiptNumber: string;        // Ej. REC-2026-CAT-0482
  transactionId: string;        // Ej. TX-PROP-784219 / MP-928174
  gateway: 'custom' | 'mercadopago' | 'stripe';
  gatewayDisplayName: string;   // Ej. "Mercado Pago (Transferencia & Débito)"
  amountArs: number;
  amountUsd: number;
  paidAt: string;
  paymentMethodSummary: string; // Ej. "Transferencia Inmediata CBU / Alias"
  cbuDestination?: string;
  payerEmail: string;
  payerName: string;
  authCode: string;
  status: 'aprobado' | 'pendiente_verificacion';
  discountCode?: string;
  discountArs?: number;
  receiptFileUrl?: string;
  receiptFileName?: string;
}

export interface CommunityPhoto {
  id: string;
  url: string;
  caption?: string;
  uploadedBy: string; // Ej. "Lucas A."
  uploadedAt: string;
}

export interface ActivityReview {
  id: string;
  authorSignature: string; // Ej. "Gonzalo G." (Nombre y la inicial del apellido)
  rating: number;          // 1 a 5 estrellas
  comment: string;
  createdAt: string;
}

export interface ActivityRecord {
  id: string;
  slug?: string;                 // Ej. 'kayak-las-pirquitas'
  userId: string;
  experienceId: string;
  title: string;
  region: string;
  altitude: string;
  coverImage: string;
  dateLabel: string;
  status: ActivityStatus;
  description?: string;
  provider: {
    name: string;
    category: string;
    contactPhone: string;
  };
  receipt: PaymentReceipt;
  memoriesCount: number;
  memoryPhotos: string[];
  communityPhotos?: CommunityPhoto[];
  reviews?: ActivityReview[];
  userReview?: {
    rating: number;
    comment: string;
    authorSignature?: string;
  };
}
