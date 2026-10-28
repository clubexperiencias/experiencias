import { Injectable } from '@angular/core';
import {
  IPaymentGateway,
  PaymentGatewayType,
  PaymentRequest,
  PaymentResult,
  CurrencyCode
} from '../../models/payment.model';

@Injectable({
  providedIn: 'root'
})
export class MercadoPagoGatewayService implements IPaymentGateway {
  readonly gatewayType: PaymentGatewayType = 'mercadopago';
  readonly displayName = 'Mercado Pago (Tarjetas, Cuotas y Dinero en Cuenta)';

  isAvailable(): boolean {
    return true;
  }

  getSupportedCurrencies(): CurrencyCode[] {
    return ['ARS'];
  }

  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    await new Promise((resolve) => setTimeout(resolve, 900));

    const transactionId = 'MP-' + Math.floor(100000000 + Math.random() * 900000000);

    return {
      transactionId,
      orderId: request.orderId,
      gateway: this.gatewayType,
      status: 'approved',
      amount: request.totalAmount,
      currency: 'ARS',
      paidAt: new Date(),
      authorizationCode: 'AUTH-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      receiptUrl: `https://mercadopago.com.ar/comprobante/${transactionId}`
    };
  }

  async verifyPayment(transactionId: string): Promise<PaymentResult> {
    return {
      transactionId,
      orderId: 'ORD-' + transactionId.slice(-6),
      gateway: this.gatewayType,
      status: 'approved',
      amount: 150000,
      currency: 'ARS',
      paidAt: new Date()
    };
  }
}
