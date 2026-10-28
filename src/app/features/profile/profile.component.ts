import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { NewsletterService } from '../../core/services/newsletter.service';
import { ActivityHistoryService } from '../../core/services/activity-history.service';
import { PaymentReceipt } from '../../core/models/activity-history.model';
import { ExperienceService } from '../../core/services/experience.service';
import { PaymentManagerService } from '../../core/services/payment/payment-manager.service';
import { Experience } from '../../core/models/experience.model';
import { PaymentGatewayType } from '../../core/models/payment.model';
import { ModalType } from '../waitlist/waitlist.component';
import { ReferralService } from '../../core/services/referral.service';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { HeaderComponent } from '../../shared/components/header/header.component';
import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../shared/components/breadcrumb/breadcrumb.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatIconModule,
    FooterComponent,
    HeaderComponent,
    BreadcrumbComponent,
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ProfileComponent implements OnInit {
  readonly newsletter = inject(NewsletterService);
  readonly activityService = inject(ActivityHistoryService);
  readonly experienceService = inject(ExperienceService);
  readonly paymentManager = inject(PaymentManagerService);
  readonly referralService = inject(ReferralService);
  readonly router = inject(Router);

  readonly breadcrumbs: BreadcrumbItem[] = [{ label: 'Inicio', url: '/' }, { label: 'Mi Perfil' }];

  readonly bg = signal('/assets/images/laguna_blanca.jpg');
  readonly copyStatus = signal<string | null>(null);
  readonly showSuccessNotification = signal(false);

  // Historial: Solo las últimas dos actividades en la vista previa del perfil
  readonly recentActivities = () => this.activityService.activities().slice(0, 2);

  ngOnInit(): void {
    if (this.newsletter.consumeLoginSuccessFlag()) {
      this.showSuccessNotification.set(true);
      this.newsletter.profileSuccessHighlight.set(true);
      setTimeout(() => {
        this.showSuccessNotification.set(false);
        this.newsletter.profileSuccessHighlight.set(false);
      }, 3000);
    }
  }

  // Menús de navegación idénticos a los de la landing /
  readonly mobileMenuOpen = signal(false);
  readonly profileMenuOpen = signal(false);

  // Modales interactivos en la misma página de perfil
  readonly activeModal = signal<ModalType>(null);
  readonly selectedExperience = signal<Experience | null>(null);

  // Pre-registro de Prestadores de Servicio
  readonly providerName = signal('');
  readonly providerEmail = signal('');
  readonly providerPhone = signal('');
  readonly providerWebsite = signal('');
  readonly providerCategory = signal('guia_montaña');
  readonly providerRegion = signal('Puna & Fiambalá');
  readonly providerSuccess = signal(false);

  // Postulación de Socio Fundador (Carta de Admisión)
  readonly founderName = signal('');
  readonly founderEmail = signal('');
  readonly founderPhone = signal('');
  readonly founderCity = signal('');
  readonly founderLetter = signal('');
  readonly founderAgreedToPrice = signal(false);
  readonly founderSuccess = signal(false);

  // Suscripción de Membresía Mensual
  readonly subscribingMembership = signal(false);
  readonly membershipPaymentSuccess = signal(false);

  // Acceso de Socios (Login Modal)
  readonly loginEmail = signal('');
  readonly loginError = signal<string | null>(null);

  openLoginModal(): void {
    this.loginError.set(null);
    this.loginEmail.set('');
    this.openModal('login');
  }

  submitLogin(): void {
    const email = this.loginEmail().trim().toLowerCase();
    if (!email) return;

    if (
      this.newsletter.isSubscribed() &&
      this.newsletter.currentMember()?.email?.toLowerCase() === email
    ) {
      this.closeModal();
      return;
    }

    this.newsletter
      .joinWaitlist({ email })
      .then(() => {
        this.closeModal();
      })
      .catch(() => {
        this.loginError.set('Ocurrió un error al ingresar. Intentá nuevamente.');
      });
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  toggleMobileMenu(event: Event): void {
    event.stopPropagation();
    this.profileMenuOpen.set(false);
    this.mobileMenuOpen.update((v) => !v);
  }

  toggleProfileMenu(event: Event): void {
    event.stopPropagation();
    this.mobileMenuOpen.set(false);
    this.profileMenuOpen.update((v) => !v);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.profileMenuOpen.set(false);
    this.mobileMenuOpen.set(false);
  }

  openModal(modal: ModalType, exp?: Experience): void {
    this.profileMenuOpen.set(false);
    this.mobileMenuOpen.set(false);
    this.activeModal.set(modal);
    if (exp) {
      this.selectedExperience.set(exp);
    }
  }

  closeModal(): void {
    this.activeModal.set(null);
    this.selectedExperience.set(null);
    this.activityService.closeReceipt();
  }

  @HostListener('window:keydown.escape')
  onEscape(): void {
    if (this.activeModal()) {
      this.closeModal();
    }
    this.profileMenuOpen.set(false);
    this.mobileMenuOpen.set(false);
  }

  toggleExperienceDetails(exp: Experience): void {
    if (this.selectedExperience()?.id === exp.id) {
      this.selectedExperience.set(null);
    } else {
      this.selectedExperience.set(exp);
    }
  }

  openMembershipPayment(tier?: string): void {
    this.openModal('payments');
  }

  selectGateway(type: PaymentGatewayType): void {
    this.paymentManager.setGateway(type);
  }

  async confirmMembershipPayment(): Promise<void> {
    this.subscribingMembership.set(true);
    await new Promise((resolve) => setTimeout(resolve, 800));

    const receiptNumber = 'REC-2026-CAT-' + Math.floor(1000 + Math.random() * 9000);

    this.activityService.addActivity({
      id: 'act_' + Date.now(),
      userId: this.newsletter.currentMember()?.id || 'user_current',
      experienceId: 'membership_monthly',
      title: 'Membresía Mensual · Socio Pleno (Temporada Inaugural)',
      region: 'Catamarca · Club de Experiencias',
      altitude: 'Sede Central',
      dateLabel: new Intl.DateTimeFormat('es-AR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date()),
      status: 'completada',
      coverImage: '/assets/images/laguna_blanca.jpg',
      provider: {
        name: 'EXPERIENCIAS.CLUB Oficial',
        category: 'Membresía & Cuota Social',
        contactPhone: '+54 9 3834 89-2104',
      },
      receipt: {
        receiptNumber,
        transactionId: 'SUB-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
        gateway: this.paymentManager.activeGatewayType(),
        gatewayDisplayName: this.paymentManager.activeGateway().displayName,
        amountArs: 12000,
        amountUsd: 12,
        paidAt: new Date().toLocaleString('es-AR'),
        paymentMethodSummary: `Cuota Mensual · ${this.paymentManager.activeGateway().displayName}`,
        payerEmail: this.newsletter.currentMember()?.email || 'socio@experiencias.club',
        payerName: this.newsletter.currentMember()?.fullName || 'Socio Pleno Catamarca',
        authCode: 'AUTH-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
        status: 'aprobado',
      },
      memoriesCount: 0,
      memoryPhotos: [],
    });

    this.subscribingMembership.set(false);
    this.membershipPaymentSuccess.set(true);
  }

  openFounderApplication(): void {
    const member = this.newsletter.currentMember();
    if (member) {
      if (!this.founderName().trim() && member.fullName) {
        this.founderName.set(member.fullName);
      }
      if (!this.founderEmail().trim() && member.email) {
        this.founderEmail.set(member.email);
      }
      if (!this.founderCity().trim() && member.nationality) {
        this.founderCity.set(member.nationality);
      }
    }
    this.openModal('founder_application');
  }

  submitFounderApplication(): void {
    if (
      !this.founderName().trim() ||
      !this.founderEmail().trim() ||
      !this.founderLetter().trim() ||
      !this.founderAgreedToPrice()
    ) {
      return;
    }
    this.founderSuccess.set(true);
  }

  submitProvider(): void {
    if (!this.providerEmail().trim() || !this.providerName().trim()) return;
    this.providerSuccess.set(true);
    setTimeout(() => {
      this.providerName.set('');
      this.providerEmail.set('');
      this.providerPhone.set('');
      this.providerSuccess.set(false);
      this.closeModal();
    }, 2800);
  }

  readonly wishlistExperiences = [
    { id: 'galan', icon: '🌋', title: 'Volcán Galán & Caldera Gigante' },
    { id: 'seismiles', icon: '🚙', title: 'Travesía 4x4 Paso San Francisco & Seismiles' },
    { id: 'kayak', icon: '🚣', title: 'Kayak & Aguas Calmas en Diques Andinos' },
    { id: 'pissis', icon: '🏔️', title: 'Trekking Balcón del Pissis & Lagunas' },
    { id: 'astroturismo', icon: '🌌', title: 'Astrofotografía & Cielos de la Puna' },
    { id: 'termas', icon: '🌿', title: 'Termas de Fiambalá & Valles Secretos' },
  ];

  readonly memberFullName = signal(this.newsletter.currentMember()?.fullName || '');
  readonly memberNationality = signal(this.newsletter.currentMember()?.nationality || '');
  readonly selectedExperiences = signal<string[]>(
    this.newsletter.currentMember()?.experiencesWishlist || [],
  );
  readonly memberNotes = signal(
    this.newsletter.currentMember()?.wishlistNotes || this.newsletter.currentMember()?.bio || '',
  );
  readonly profileSaved = signal(this.newsletter.currentMember()?.profileCompleted || false);

  toggleExperienceWishlist(id: string): void {
    const current = this.selectedExperiences();
    if (current.includes(id)) {
      this.selectedExperiences.set(current.filter((item) => item !== id));
    } else {
      this.selectedExperiences.set([...current, id]);
    }
  }

  isExperienceSelected(id: string): boolean {
    return this.selectedExperiences().includes(id);
  }

  getExperienceTitle(id: string): string {
    const found = this.wishlistExperiences.find((e) => e.id === id);
    return found ? `${found.icon} ${found.title}` : id;
  }

  saveMemberProfile(): void {
    if (!this.memberFullName().trim()) {
      return;
    }

    this.newsletter.updateMemberProfile({
      fullName: this.memberFullName().trim(),
      nationality: this.memberNationality().trim(),
      experiencesWishlist: this.selectedExperiences(),
      wishlistNotes: this.memberNotes().trim(),
      bio: this.memberNotes().trim(),
    });

    this.profileSaved.set(true);
  }

  editMemberProfile(): void {
    this.profileSaved.set(false);
  }

  copyLink(): void {
    const member = this.newsletter.currentMember();
    if (!member) return;
    const url = `${location.origin}?ref=${member.referralCode}`;
    navigator.clipboard
      ?.writeText(url)
      .then(() => {
        this.copyStatus.set('¡Enlace de invitación copiado!');
        setTimeout(() => this.copyStatus.set(null), 2500);
      })
      .catch(() => {
        this.copyStatus.set(url);
        setTimeout(() => this.copyStatus.set(null), 3000);
      });
  }

  shareWhatsApp(): void {
    const member = this.newsletter.currentMember();
    const text = encodeURIComponent(
      `Me sumé como Socio Emergente a EXPERIENCIAS.CLUB (Edición Catamarca), el club privado de expediciones andinas y náuticas. ¡Unite a la lista de espera antes del lanzamiento! ${location.origin}?ref=${member?.referralCode ?? ''}`,
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  }

  shareX(): void {
    const member = this.newsletter.currentMember();
    const text = encodeURIComponent(
      'Acabo de registrarme como Socio Emergente en EXPERIENCIAS.CLUB (Edición Catamarca) — expediciones andinas y travesías náuticas.',
    );
    const url = encodeURIComponent(`${location.origin}?ref=${member?.referralCode ?? ''}`);
    window.open(`https://x.com/intent/tweet?text=${text}&url=${url}`, '_blank');
  }

  logout(): void {
    this.newsletter.resetCurrentSubscription();
    this.profileMenuOpen.set(false);
    this.mobileMenuOpen.set(false);
    this.router.navigate(['/']);
  }

  openReceipt(receipt: PaymentReceipt, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.activityService.viewReceipt(receipt);
  }

  closeReceipt(): void {
    this.activityService.closeReceipt();
  }

  copyCoupon(code: string): void {
    navigator.clipboard
      ?.writeText(code)
      .then(() => {
        this.copyStatus.set(`¡Cupón ${code} (10% OFF) copiado!`);
        setTimeout(() => this.copyStatus.set(null), 3000);
      })
      .catch(() => {
        this.copyStatus.set(code);
        setTimeout(() => this.copyStatus.set(null), 3000);
      });
  }

  printReceipt(): void {
    window.print();
  }
}
