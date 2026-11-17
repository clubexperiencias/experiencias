import { Component, HostListener, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { NewsletterService } from '../../core/services/newsletter.service';
import { DiscountService } from '../../core/services/discount.service';
import { Discount } from '../../core/models/discount.model';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { HeaderComponent } from '../../shared/components/header/header.component';
import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../shared/components/breadcrumb/breadcrumb.component';
import { FounderAdComponent } from '../../shared/components/founder-ad/founder-ad.component';
import { ArsPipe } from '../../shared/pipes/format.pipes';

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
    ArsPipe,
  ],
  templateUrl: './subscription.component.html',
  styleUrl: './subscription.component.css',
})
export class SubscriptionComponent implements OnInit {
  readonly newsletter = inject(NewsletterService);
  readonly discountService = inject(DiscountService);
  readonly router = inject(Router);
  readonly route = inject(ActivatedRoute);

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Inicio', url: '/' },
    { label: 'Niveles de Socio', url: '/socios' },
    { label: 'Socios Plenos' },
  ];

  // Menús de navegación
  readonly mobileMenuOpen = signal(false);

  // Autenticación con Google
  readonly authReady = signal(!this.newsletter.isSupabaseConnected());
  readonly authError = signal<string | null>(null);
  readonly requiresGoogle = computed(() => !this.authReady());

  // Datos del Socio
  readonly fullName = signal('');
  readonly email = signal('');
  readonly authenticatedEmail = signal<string | null>(null);
  readonly documentNumber = signal('');
  readonly phone = signal('');
  readonly selectedExperiences = signal<string[]>([]);
  readonly otherExperience = signal('');

  // Cuota y Descuento
  readonly regularFeeArs = 23000;
  readonly discountCodeInput = signal('');
  readonly appliedDiscount = signal<Discount | null>(null);
  readonly discountAmountArs = signal<number>(0);
  readonly discountError = signal<string | null>(null);
  readonly isValidatingDiscount = signal(false);

  readonly totalToPayArs = computed(() =>
    Math.max(0, this.regularFeeArs - this.discountAmountArs()),
  );

  // Estados de proceso
  readonly isSubmitting = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly justActivated = signal(false);

  // Gestión de suscripción activa existente
  readonly manageModal = signal<ManageModalType>(null);
  readonly newSelectedMethod = signal('Tarjeta terminada en •••• 9210');

  readonly experiences = [
    { id: 'kayak', title: 'Kayak y aguas calmas en diques andinos' },
    { id: 'pissis', title: 'Trekking Balcón del Pissis y lagunas' },
    { id: 'termas', title: 'Termas de Fiambalá y valles secretos' },
    { id: 'otros', title: 'Otros (especificar a continuación)' },
  ];

  readonly highlights = [
    {
      title: 'Cuota Regular $23.000',
      description: 'Habilitada por el momento para personas elegidas por el Club.',
    },
    {
      title: '10% OFF & Prioridad',
      description: 'Descuento directo y cupo asegurado en salidas.',
    },
    {
      title: 'Salidas Exclusivas',
      description: 'Travesías especiales para socios plenos de mayor antigüedad.',
    },
  ];

  ngOnInit(): void {
    void this.refreshGoogleAccount();

    this.route.queryParams.subscribe((params) => {
      const codeParam = ((params['code'] as string) || (params['cupon'] as string) || '').trim();
      if (codeParam) {
        this.discountCodeInput.set(codeParam.toUpperCase());
        void this.applyDiscount(codeParam);
      }
    });
  }

  private async refreshGoogleAccount(): Promise<void> {
    const authenticatedEmail = await this.newsletter.getAuthenticatedEmail();
    if (authenticatedEmail) {
      const cleanAuthEmail = authenticatedEmail.trim().toLowerCase();
      this.email.set(cleanAuthEmail);
      this.authenticatedEmail.set(cleanAuthEmail);
      this.authReady.set(true);
      await this.newsletter.getAuthenticatedMember();
      const current = this.newsletter.currentMember();
      if (current?.email && current.email.trim().toLowerCase() === cleanAuthEmail) {
        if (current.fullName && !this.fullName()) {
          this.fullName.set(current.fullName);
        }
        const dni = current.dni || current.documentNumber;
        if (dni && !this.documentNumber()) {
          this.documentNumber.set(dni);
        }
        if (current.phone && !this.phone()) {
          this.phone.set(current.phone);
        }
        if (
          current.experiencesWishlist &&
          current.experiencesWishlist.length > 0 &&
          this.selectedExperiences().length === 0
        ) {
          this.selectedExperiences.set(current.experiencesWishlist);
        }
        if (current.experiencesOther && !this.otherExperience()) {
          this.otherExperience.set(current.experiencesOther);
          if (!this.selectedExperiences().includes('otros')) {
            this.selectedExperiences.update((list) => [...list, 'otros']);
          }
        }
      }
    } else {
      this.authReady.set(!this.newsletter.isSupabaseConnected());
      if (!this.newsletter.isSupabaseConnected()) {
        const current = this.newsletter.currentMember();
        if (current) {
          if (current.email && !this.email()) {
            this.email.set(current.email);
          }
          if (current.fullName && !this.fullName()) {
            this.fullName.set(current.fullName);
          }
          const dni = current.dni || current.documentNumber;
          if (dni && !this.documentNumber()) {
            this.documentNumber.set(dni);
          }
          if (current.phone && !this.phone()) {
            this.phone.set(current.phone);
          }
          if (
            current.experiencesWishlist &&
            current.experiencesWishlist.length > 0 &&
            this.selectedExperiences().length === 0
          ) {
            this.selectedExperiences.set(current.experiencesWishlist);
          }
          if (current.experiencesOther && !this.otherExperience()) {
            this.otherExperience.set(current.experiencesOther);
            if (!this.selectedExperiences().includes('otros')) {
              this.selectedExperiences.update((list) => [...list, 'otros']);
            }
          }
        }
      }
    }
  }

  async linkGoogleAccount(): Promise<void> {
    this.authError.set(null);
    const returnPath =
      typeof window !== 'undefined'
        ? window.location.pathname + window.location.search
        : '/socios/plenos';
    this.newsletter.saveAuthReturnUrl(returnPath);
    const result = await this.newsletter.signInWithGoogle(
      typeof window !== 'undefined' ? `${window.location.origin}${returnPath}` : undefined,
    );
    if (!result.success) {
      this.authError.set(result.message);
    }
  }

  async applyDiscount(rawCode?: string): Promise<void> {
    const code = (rawCode !== undefined ? rawCode : this.discountCodeInput()).trim().toUpperCase();
    if (!code) {
      this.discountError.set('Ingresá un código de descuento.');
      return;
    }

    this.isValidatingDiscount.set(true);
    this.discountError.set(null);

    try {
      const res = await this.discountService.validateDiscount(
        code,
        null,
        null,
        this.regularFeeArs,
        null,
        { isMembership: true },
      );

      this.isValidatingDiscount.set(false);
      if (res.valid && res.discount) {
        this.appliedDiscount.set(res.discount);
        this.discountAmountArs.set(res.discountArs || this.regularFeeArs);
        this.discountCodeInput.set(res.discount.code);
        this.discountError.set(null);
      } else {
        this.appliedDiscount.set(null);
        this.discountAmountArs.set(0);
        this.discountError.set(res.error || 'Código no válido o no aplicable para membresías.');
      }
    } catch {
      this.isValidatingDiscount.set(false);
      this.discountError.set('Error al verificar el cupón. Intentá de nuevo.');
    }
  }

  removeDiscount(): void {
    this.appliedDiscount.set(null);
    this.discountAmountArs.set(0);
    this.discountCodeInput.set('');
    this.discountError.set(null);
  }

  toggleExperience(id: string): void {
    const selected = this.selectedExperiences();
    this.selectedExperiences.set(
      selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id],
    );
  }

  isSelected(id: string): boolean {
    return this.selectedExperiences().includes(id);
  }

  async submit(): Promise<void> {
    if (this.requiresGoogle()) {
      this.submitError.set('Primero vinculá tu cuenta de Google para continuar.');
      return;
    }

    this.submitError.set(null);
    const name = this.fullName().trim();
    const cleanEmail = this.email().trim().toLowerCase();
    const dni = this.documentNumber().replace(/\D/g, '').slice(0, 9);
    const phone = this.phone().trim().slice(0, 25);

    if (!name) {
      this.submitError.set('Ingresá tu nombre y apellido.');
      return;
    }

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      this.submitError.set('Ingresá un correo electrónico válido.');
      return;
    }

    if (!dni || dni.length < 7 || dni.length > 9) {
      this.submitError.set('El DNI es obligatorio y debe contener entre 7 y 9 números.');
      return;
    }

    if (!phone) {
      this.submitError.set('El número de celular es obligatorio.');
      return;
    }

    if (!this.appliedDiscount() || this.totalToPayArs() > 0) {
      this.submitError.set(
        'Por el momento, la activación de Socio Pleno está habilitada para personas elegidas por el Club con código promocional.'
      );
      return;
    }

    const otherText = this.isSelected('otros') ? this.otherExperience().trim() : undefined;
    const discountCode = this.appliedDiscount()?.code || (this.discountAmountArs() > 0 ? this.discountCodeInput().trim() : undefined);

    this.isSubmitting.set(true);
    try {
      const result = await this.newsletter.activateSocioPleno({
        fullName: name,
        email: cleanEmail,
        dni,
        phone,
        discountCode,
        experiencesWishlist: this.selectedExperiences(),
        experiencesOther: otherText,
      });

      this.isSubmitting.set(false);
      if (result.success) {
        this.justActivated.set(true);
        setTimeout(() => {
          void this.router.navigate(['/perfil']);
        }, 1500);
      } else {
        this.submitError.set(result.message);
      }
    } catch {
      this.isSubmitting.set(false);
      this.submitError.set('Ocurrió un error al activar tu membresía. Por favor, reintentá.');
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
    void this.router.navigate(['/']);
  }
}
