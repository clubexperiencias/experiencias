import { Component, HostListener, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { NewsletterService } from '../../core/services/newsletter.service';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { HeaderComponent } from '../../shared/components/header/header.component';
import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../shared/components/breadcrumb/breadcrumb.component';
import { FounderAdComponent } from '../../shared/components/founder-ad/founder-ad.component';

export type PaymentMethodChoice = 'card' | 'mercadopago' | 'transfer';
export type ManageModalType = 'change_payment' | 'pause_confirm' | 'cancel_confirm' | null;

@Component({
  selector: 'app-subscription',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    MatIconModule,
    FooterComponent,
    HeaderComponent,
    BreadcrumbComponent,
    FounderAdComponent,
  ],
  templateUrl: './subscription.component.html',
  styleUrl: './subscription.component.css',
})
export class SubscriptionComponent implements OnInit {
  readonly newsletter = inject(NewsletterService);
  readonly router = inject(Router);

  readonly bg = signal('/assets/images/laguna_blanca.jpg');

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Inicio', url: '/' },
    { label: 'Niveles de Socio', url: '/socios' },
    { label: 'Socios Plenos' },
  ];

  // Menús de navegación
  readonly mobileMenuOpen = signal(false);

  // Formulario de suscripción
  readonly subscriberEmail = signal('');
  readonly subscriberName = signal('');
  readonly selectedPaymentMethod = signal<PaymentMethodChoice>('card');

  // Campos de tarjeta
  readonly cardNumber = signal('');
  readonly cardExp = signal('');
  readonly cardCvc = signal('');
  readonly cardHolder = signal('');

  // Gestión de suscripción activa
  readonly manageModal = signal<ManageModalType>(null);
  readonly newSelectedMethod = signal('Tarjeta terminada en •••• 9210');

  // Estados de proceso
  readonly isProcessing = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly justActivated = signal(false);

  ngOnInit(): void {
    const current = this.newsletter.currentMember();
    if (current) {
      this.subscriberEmail.set(current.email);
      if (current.fullName) {
        this.subscriberName.set(current.fullName);
        this.cardHolder.set(current.fullName);
      }
    }
  }

  toggleMobileMenu(event: Event): void {
    event.stopPropagation();
    this.mobileMenuOpen.update((v) => !v);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.mobileMenuOpen.set(false);
  }

  setPaymentMethod(method: PaymentMethodChoice): void {
    this.selectedPaymentMethod.set(method);
    this.errorMessage.set(null);
  }

  openManageModal(modal: ManageModalType): void {
    this.manageModal.set(modal);
  }

  closeManageModal(): void {
    this.manageModal.set(null);
  }

  @HostListener('window:keydown.escape')
  onEscape(): void {
    this.closeManageModal();
    this.mobileMenuOpen.set(false);
  }

  async submitSubscription(): Promise<void> {
    const email = this.subscriberEmail().trim();
    if (!email) {
      this.errorMessage.set('Por favor, ingresá tu correo electrónico.');
      return;
    }

    this.isProcessing.set(true);
    this.errorMessage.set(null);

    let paymentMethodLabel =
      'Tarjeta de Crédito / Débito (•••• ' + (this.cardNumber().slice(-4) || '4821') + ')';
    if (this.selectedPaymentMethod() === 'mercadopago') {
      paymentMethodLabel = 'Mercado Pago (Débito en Cuenta)';
    } else if (this.selectedPaymentMethod() === 'transfer') {
      paymentMethodLabel = 'Transferencia Bancaria (CBU / Alias Oficial)';
    }

    try {
      const res = await this.newsletter.activateMonthlySubscription({
        email,
        fullName: this.subscriberName().trim(),
        paymentMethod: paymentMethodLabel,
      });

      this.isProcessing.set(false);
      if (res.success) {
        this.justActivated.set(true);
      } else {
        this.errorMessage.set(res.message);
      }
    } catch {
      this.isProcessing.set(false);
      this.errorMessage.set('Ocurrió un error al procesar el pago. Por favor, reintentá.');
    }
  }

  cancelSubscription(): void {
    this.newsletter.cancelMonthlySubscription();
    this.closeManageModal();
    this.justActivated.set(false);
  }

  pauseSubscription(): void {
    this.newsletter.pauseMonthlySubscription();
    this.closeManageModal();
  }

  resumeSubscription(): void {
    this.newsletter.resumeMonthlySubscription();
  }

  savePaymentMethod(): void {
    this.newsletter.updateSubscriptionPaymentMethod(this.newSelectedMethod());
    this.closeManageModal();
  }

  logout(): void {
    this.newsletter.resetCurrentSubscription();
    this.mobileMenuOpen.set(false);
    this.router.navigate(['/']);
  }
}
