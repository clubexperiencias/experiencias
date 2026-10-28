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
export class StripeGatewayService implements IPaymentGateway {
  readonly gatewayType: PaymentGatewayType = 'stripe';
  readonly displayName = 'Stripe (International Cards & Apple/Google Pay)';

  isAvailable(): boolean {
    return true;
  }

  getSupportedCurrencies(): CurrencyCode[] {
    return ['USD', 'ARS'];
  }

  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    await new Promise((resolve) => setTimeout(resolve, 850));

    const transactionId = 'ch_' + Math.random().toString(36).substring(2, 16);

    return {
      transactionId,
      orderId: request.orderId,
      gateway: this.gatewayType,
      status: 'approved',
      amount: request.totalAmount,
      currency: request.currency,
      paidAt: new Date(),
      authorizationCode: 'STRIPE-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      receiptUrl: `https://dashboard.stripe.com/receipts/${transactionId}`
    };
  }

  async verifyPayment(transactionId: string): Promise<PaymentResult> {
    return {
      transactionId,
      orderId: 'ORD-' + transactionId.slice(-6),
      gateway: this.gatewayType,
      status: 'approved',
      amount: 150,
      currency: 'USD',
      paidAt: new Date()
    };
  }
}
