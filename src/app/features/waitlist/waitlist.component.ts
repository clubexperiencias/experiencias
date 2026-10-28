import { Component, inject, signal, computed, HostListener } from '@angular/core';
import { NewsletterService } from '../../core/services/newsletter.service';
import { ExperienceService } from '../../core/services/experience.service';
import { PaymentManagerService } from '../../core/services/payment/payment-manager.service';
import { PaymentGatewayType } from '../../core/models/payment.model';
import { Experience } from '../../core/models/experience.model';

import { ActivityHistoryService } from '../../core/services/activity-history.service';
import { PaymentReceipt } from '../../core/models/activity-history.model';

import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { HeaderComponent } from '../../shared/components/header/header.component';
import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../shared/components/breadcrumb/breadcrumb.component';

export type ModalType =
  | 'roadmap'
  | 'experiences'
  | 'providers'
  | 'payments'
  | 'tiers'
  | 'history'
  | 'founder_application'
  | 'login'
  | null;

export interface LandscapeLocation {
  image: string;
  name: string;
  region: string;
  altitude: string;
  coordsText: string;
  description: string;
  officialUrl?: string;
}

@Component({
  selector: 'app-waitlist',
  standalone: true,
  imports: [MatIconModule, RouterLink, FooterComponent, HeaderComponent, BreadcrumbComponent],
  templateUrl: './waitlist.component.html',
  styleUrl: './waitlist.component.css',
})
export class WaitlistComponent {
  readonly breadcrumbs: BreadcrumbItem[] = [{ label: 'Inicio' }];
  readonly router = inject(Router);
  readonly route = inject(ActivatedRoute);
  readonly newsletter = inject(NewsletterService);
  readonly experienceService = inject(ExperienceService);
  readonly paymentManager = inject(PaymentManagerService);
  readonly activityService = inject(ActivityHistoryService);

  constructor() {
    this.route.queryParams.subscribe((params) => {
      const modal = params['modal'] as ModalType;
      if (
        modal &&
        [
          'roadmap',
          'experiences',
          'providers',
          'payments',
          'tiers',
          'history',
          'founder_application',
          'login',
        ].includes(modal)
      ) {
        this.openModal(modal);
      }
    });
  }

  // Email de suscripción socio emergente
  readonly email = signal('');
  readonly copyStatus = signal<string | null>(null);

  // Iniciar Sesión
  readonly loginEmail = signal('');
  readonly loginError = signal<string | null>(null);

  // Menú desplegable de perfil de usuario
  readonly profileMenuOpen = signal(false);

  // Menú hamburguesa móvil
  readonly mobileMenuOpen = signal(false);

  // Modales interactivos
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

  // Formulario Perfil de Socio Emergente
  readonly memberFullName = signal(this.newsletter.currentMember()?.fullName || '');
  readonly memberNationality = signal(this.newsletter.currentMember()?.nationality || '');
  readonly selectedExperiences = signal<string[]>(
    this.newsletter.currentMember()?.experiencesWishlist || [],
  );
  readonly memberBio = signal(this.newsletter.currentMember()?.bio || '');
  readonly memberNotes = signal(
    this.newsletter.currentMember()?.wishlistNotes || this.newsletter.currentMember()?.bio || '',
  );
  readonly profileSaved = signal(this.newsletter.currentMember()?.profileCompleted || false);

  readonly wishlistExperiences = [
    { id: 'galan', icon: '🌋', title: 'Volcán Galán & Caldera Gigante' },
    { id: 'seismiles', icon: '🚙', title: 'Travesía 4x4 Paso San Francisco & Seismiles' },
    { id: 'kayak', icon: '🚣', title: 'Kayak & Aguas Calmas en Diques Andinos' },
    { id: 'pissis', icon: '🏔️', title: 'Trekking Balcón del Pissis & Lagunas' },
    { id: 'astroturismo', icon: '🌌', title: 'Astrofotografía & Cielos de la Puna' },
    { id: 'termas', icon: '🌿', title: 'Termas de Fiambalá & Valles Secretos' },
  ];

  // Fondos fotográficos con geolocalización exacta de Catamarca
  readonly landscapes: LandscapeLocation[] = [
    {
      image: '/assets/images/laguna_blanca.jpg',
      name: 'Laguna Blanca',
      region: 'Belén · Reserva de Biósfera UNESCO, Catamarca',
      altitude: '3.200 msnm',
      coordsText: '26°32′S 66°56′O',
      description:
        'Pueblo andino de la Puna catamarqueña y santuario de vicuñas, distinguido en Best Tourism Villages por ONU Turismo.',
      officialUrl:
        'https://www.argentina.gob.ar/jefatura/turismo/best-tourism-villages-argentina/laguna-blanca-catamarca',
    },
    {
      image: '/assets/images/catamarca_pomez.jpg',
      name: 'Campo de Piedra Pómez',
      region: 'Antofagasta de la Sierra · Puna Catamarqueña',
      altitude: '3.300 msnm',
      coordsText: '26°42′S 67°30′O',
      description: 'Laberinto surrealista de roca volcánica blanca esculpida por el viento andino.',
    },
    {
      image: '/assets/images/catamarca_hero.jpg',
      name: 'Balcón del Pissis & Seismiles Sagrados',
      region: 'Fiambalá · Paso de San Francisco, Catamarca',
      altitude: '4.600 msnm',
      coordsText: '27°45′S 68°47′O',
      description:
        'Mirador panorámico de alta montaña hacia lagunas turquesas y volcanes de más de 6.000 metros.',
    },
  ];

  readonly bgIndex = signal(0);
  readonly currentLandscape = computed(() => this.landscapes[this.bgIndex()]);
  readonly bg = computed(() => this.currentLandscape().image);

  cycleBg(): void {
    this.bgIndex.set((this.bgIndex() + 1) % this.landscapes.length);
  }

  toggleProfileMenu(event: Event): void {
    event.stopPropagation();
    this.mobileMenuOpen.set(false);
    this.profileMenuOpen.update((v) => !v);
  }

  toggleMobileMenu(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.profileMenuOpen.set(false);
    this.mobileMenuOpen.update((v) => !v);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  logout(): void {
    this.newsletter.resetCurrentSubscription();
    this.profileMenuOpen.set(false);
    this.mobileMenuOpen.set(false);
  }

  private modalOpenTimestamp = 0;

  openModalFromProfile(modal: ModalType, event?: Event): void {
    console.log('[PROFILE] openModalFromProfile clicked:', modal);
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.openModal(modal);
  }

  cycleBgFromProfile(): void {
    this.cycleBg();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event?: MouseEvent): void {
    console.log('[DOCUMENT] click detected on:', event?.target);
    if (this.profileMenuOpen()) {
      this.profileMenuOpen.set(false);
    }
    if (this.mobileMenuOpen()) {
      this.mobileMenuOpen.set(false);
    }
  }

  openModal(modal: ModalType, exp?: Experience): void {
    console.log('[MODAL] openModal called with:', modal);
    this.profileMenuOpen.set(false);
    this.mobileMenuOpen.set(false);
    this.modalOpenTimestamp = Date.now();
    this.activeModal.set(modal);
    if (exp) {
      this.selectedExperience.set(exp);
    }
  }

  toggleExperienceDetails(exp: Experience): void {
    if (this.selectedExperience()?.id === exp.id) {
      this.selectedExperience.set(null);
    } else {
      this.selectedExperience.set(exp);
    }
  }

  closeModal(): void {
    if (Date.now() - this.modalOpenTimestamp < 400) {
      return;
    }
    this.activeModal.set(null);
    this.selectedExperience.set(null);
    this.activityService.closeReceipt();
  }

  @HostListener('window:keydown.escape')
  onEscape(): void {
    if (this.activeModal()) {
      this.activeModal.set(null);
      this.selectedExperience.set(null);
      this.activityService.closeReceipt();
    }
    this.profileMenuOpen.set(false);
    this.mobileMenuOpen.set(false);
  }

  onBackdropClick(event: MouseEvent): void {
    if (Date.now() - this.modalOpenTimestamp < 400) {
      return;
    }
    if (event.target === event.currentTarget) {
      this.closeModal();
    }
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

  printReceipt(): void {
    window.print();
  }

  goToHomeSubscribe(): void {
    this.closeModal();
    setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>('.pill-input');
      if (input) {
        input.focus();
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);
  }

  readonly subscribingMembership = signal(false);
  readonly membershipPaymentSuccess = signal(false);

  openMembershipPayment(tier: 'activo'): void {
    this.membershipPaymentSuccess.set(false);
    this.subscribingMembership.set(false);
    this.openModal('payments');
  }

  async confirmMembershipPayment(): Promise<void> {
    if (this.subscribingMembership()) return;
    this.subscribingMembership.set(true);

    await new Promise((resolve) => setTimeout(resolve, 650));

    const receiptNumber = 'REC-2026-CAT-0' + Math.floor(100 + Math.random() * 900);
    this.activityService.addActivity({
      id: 'act_' + Date.now(),
      userId: this.newsletter.currentMember()?.id || 'user_current',
      experienceId: 'membership_monthly',
      title: 'Membresía Mensual · Socio Pleno (Temporada Inaugural)',
      region: 'Catamarca · Club de Experiencias',
      altitude: 'Sede Central',
      coverImage: '/assets/images/laguna_blanca.jpg',
      dateLabel: new Intl.DateTimeFormat('es-AR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date()),
      status: 'completada',
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

  toggleExperienceWishlist(id: string): void {
    this.selectedExperiences.update((list) =>
      list.includes(id) ? list.filter((item) => item !== id) : [...list, id],
    );
  }

  isExperienceSelected(id: string): boolean {
    return this.selectedExperiences().includes(id);
  }

  getExperienceTitle(id: string): string {
    const found = this.wishlistExperiences.find((e) => e.id === id);
    return found ? `${found.icon} ${found.title}` : id;
  }

  saveMemberProfile(): void {
    if (
      !this.memberFullName().trim() ||
      !this.memberNationality().trim() ||
      this.selectedExperiences().length === 0
    ) {
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

  openLoginModal(): void {
    this.mobileMenuOpen.set(false);
    this.loginError.set(null);
    this.loginEmail.set('');
    this.openModal('login');
  }

  async submitLogin(): Promise<void> {
    const email = this.loginEmail().trim();
    if (!email || this.newsletter.isLoading()) return;

    const res = await this.newsletter.joinWaitlist({ email });
    if (res.success) {
      this.closeModal();
      this.router.navigate(['/perfil']);
    } else {
      this.loginError.set(res.message);
    }
  }

  async submit(): Promise<void> {
    if (!this.email().trim() || this.newsletter.isLoading()) return;

    const res = await this.newsletter.joinWaitlist({ email: this.email() });
    if (res.success) {
      this.email.set('');
      this.router.navigate(['/perfil']);
    }
  }

  copyLink(): void {
    const member = this.newsletter.currentMember();
    if (!member) return;
    const url = `${location.origin}?ref=${member.referralCode}`;
    navigator.clipboard.writeText(url).then(() => {
      this.copyStatus.set('¡Enlace de invitación copiado!');
      setTimeout(() => this.copyStatus.set(null), 2500);
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

  selectGateway(type: PaymentGatewayType): void {
    this.paymentManager.setGateway(type);
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
}
