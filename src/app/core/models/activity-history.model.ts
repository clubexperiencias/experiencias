export type ActivityStatus = 'completada' | 'confirmada' | 'pendiente_pago' | 'cancelada';

export interface PaymentReceipt {
  receiptNumber: string; // Ej. REC-2026-CAT-0482
  transactionId: string; // Ej. TX-PROP-784219 / MP-928174
  gateway: 'custom' | 'mercadopago' | 'stripe';
  gatewayDisplayName: string; // Ej. "Mercado Pago (Transferencia & Débito)"
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

export interface ActivityRecord {
  id: string;
  slug?: string; // Ej. 'kayak-las-jumeal'
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
}
