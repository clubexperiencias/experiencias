import { Injectable, signal, computed } from '@angular/core';
import {
  IPaymentGateway,
  PaymentGatewayType,
  PaymentRequest,
  PaymentResult
} from '../../models/payment.model';
import { CustomPaymentGatewayService } from './custom-payment-gateway.service';
import { MercadoPagoGatewayService } from './mercadopago-gateway.service';
import { StripeGatewayService } from './stripe-gateway.service';

@Injectable({
  providedIn: 'root'
})
export class PaymentManagerService {
  private readonly gateways = new Map<PaymentGatewayType, IPaymentGateway>();

  // Pasarela actualmente activa: arranca con 'custom' (pasarela propia), pero es dinámicamente conmutable
  readonly activeGatewayType = signal<PaymentGatewayType>('custom');

  readonly availableGateways = signal<Array<{ type: PaymentGatewayType; name: string }>>([
    { type: 'custom', name: 'Pasarela Propia (Transferencia directa / CBU / Alias)' },
    { type: 'mercadopago', name: 'Mercado Pago (Cuotas, Tarjetas y Dinero en Cuenta)' },
    { type: 'stripe', name: 'Stripe (Tarjetas Internacionales y Apple Pay)' }
  ]);

  readonly activeGateway = computed<IPaymentGateway>(() => {
    const selected = this.gateways.get(this.activeGatewayType());
    if (!selected) {
      return this.gateways.get('custom')!;
    }
    return selected;
  });

  constructor(
    private readonly customGateway: CustomPaymentGatewayService,
    private readonly mpGateway: MercadoPagoGatewayService,
    private readonly stripeGateway: StripeGatewayService
  ) {
    this.gateways.set('custom', this.customGateway);
    this.gateways.set('mercadopago', this.mpGateway);
    this.gateways.set('stripe', this.stripeGateway);
  }

  setGateway(type: PaymentGatewayType): void {
    if (this.gateways.has(type)) {
      this.activeGatewayType.set(type);
    }
  }

  async executePayment(request: PaymentRequest): Promise<PaymentResult> {
    const gateway = this.activeGateway();
    return gateway.processPayment(request);
  }
}
