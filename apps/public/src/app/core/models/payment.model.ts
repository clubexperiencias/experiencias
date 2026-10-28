export type CurrencyCode = 'ARS' | 'USD';

export type PaymentGatewayType = 'custom' | 'mercadopago' | 'stripe';

export type PaymentStatus = 'pending' | 'processing' | 'approved' | 'rejected' | 'refunded';

export interface PaymentItem {
  id: string;
  title: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  currency: CurrencyCode;
  category: 'experience_deposit' | 'experience_full' | 'merch' | 'membership_club';
}

export interface PaymentRequest {
  orderId: string;
  customer: {
    fullName: string;
    email: string;
    identificationNumber?: string; // DNI o Pasaporte
    phone?: string;
  };
  items: PaymentItem[];
  totalAmount: number;
  currency: CurrencyCode;
  installments?: number; // Cuotas (común en Argentina)
  metadata?: Record<string, unknown>;
  customPaymentMethod?: 'transferencia_bancaria' | 'crypto_usdt' | 'tarjeta_directa';
}

export interface PaymentResult {
  transactionId: string;
  orderId: string;
  gateway: PaymentGatewayType;
  status: PaymentStatus;
  amount: number;
  currency: CurrencyCode;
  paidAt: Date;
  receiptUrl?: string;
  authorizationCode?: string;
  paymentInstructions?: {
    aliasCbu?: string;
    cbu?: string;
    bankName?: string;
    qrPayload?: string;
    transferProofRequired?: boolean;
    notes?: string;
  };
  errorMessage?: string;
}

export interface IPaymentGateway {
  readonly gatewayType: PaymentGatewayType;
  readonly displayName: string;
  
  isAvailable(): boolean;
  getSupportedCurrencies(): CurrencyCode[];
  processPayment(request: PaymentRequest): Promise<PaymentResult>;
  verifyPayment(transactionId: string): Promise<PaymentResult>;
}
