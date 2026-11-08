import { Component, computed, effect, inject, signal, OnInit } from '@angular/core';
import {
  AUTH_SUCCESS_FEEDBACK_DURATION_MS,
  NewsletterService,
} from '../../../core/services/newsletter.service';
import { ArsPipe, FechaPipe } from '../../../shared/pipes/format.pipes';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { FooterComponent } from '../../../shared/components/footer/footer.component';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { FounderAdComponent } from '../../../shared/components/founder-ad/founder-ad.component';
import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../../shared/components/breadcrumb/breadcrumb.component';
import {
  ProviderStoreService,
  validateReceiptFile,
} from '../../../core/services/provider-store.service';
import { ExperienceService } from '../../../core/services/experience.service';
import { NotificationService } from '../../../core/services/notification.service';
import { isSupabaseConfigured } from '../../../core/supabase/supabase.client';
import {
  BANK_TRANSFER_DESTINATION,
  DiscountCode,
  ProviderExperience,
  PublicPaymentDestination,
  discountAmount,
  findDiscountCode,
  MAX_PARTICIPANTS_PER_BOOKING,
  RECEIPT_ACCEPTED_TYPES,
  TransferSubmission,
} from '../../../core/models/bank-transfer.model';

@Component({
  selector: 'app-experience-payment',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatIconModule,
    ArsPipe,
    FechaPipe,
    FooterComponent,
    FounderAdComponent,
    HeaderComponent,
    BreadcrumbComponent,
  ],
  templateUrl: './experience-payment.component.html',
  styleUrl: './experience-payment.component.css',
})
export class ExperiencePaymentComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(ProviderStoreService);
  private readonly expService = inject(ExperienceService);
  private readonly fb = inject(FormBuilder);
  private readonly newsletter = inject(NewsletterService);
  private readonly notificationService = inject(NotificationService);

  readonly acceptedTypes = RECEIPT_ACCEPTED_TYPES.join(',');
  readonly mobileMenuOpen = signal(false);
  readonly authReady = signal(!isSupabaseConfigured());
  readonly checkoutMember =
    signal<Awaited<ReturnType<NewsletterService['getAuthenticatedMember']>>>(null);
  readonly authError = signal<string | null>(null);
  readonly showAuthSuccessNotification = signal(false);
  private authSuccessTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly slug = toSignal(
    this.route.paramMap.pipe(
      map((params) => params.get('slug') ?? this.route.snapshot.data['slug'] ?? ''),
    ),
    {
      initialValue:
        this.route.snapshot.paramMap.get('slug') ?? this.route.snapshot.data['slug'] ?? '',
    },
  );

  readonly experience = computed<ProviderExperience | undefined>(() => {
    const slug = this.slug();
    const liveExp =
      this.expService.getPublishedExperienceBySlug(slug) ||
      this.expService.getExperienceBySlug(slug);
    const storeExp = this.store.getExperienceBySlug(slug);
    if (liveExp) {
      if (liveExp.status === 'publicada') {
        return {
          ...(storeExp || {}),
          id: liveExp.id,
          slug: liveExp.slug,
          title: liveExp.title,
          shortTitle: liveExp.shortTitle || liveExp.title,
          priceArs: liveExp.priceArs,
          priceUsd: liveExp.priceUsd,
          capacityPerDate: liveExp.maxSpotsPerGroup,
          dates: liveExp.dates || [],
          status: liveExp.status,
          providerId: liveExp.providerId || storeExp?.providerId || '',
          providerName: liveExp.providerName || storeExp?.providerName || '',
          providerEmail: liveExp.providerEmail || storeExp?.providerEmail,
          providerSlug: liveExp.providerSlug || storeExp?.providerSlug,
          providerPhone: liveExp.providerPhone || storeExp?.providerPhone,
          providerCbuAlias: liveExp.providerCbuAlias || storeExp?.providerCbuAlias,
          providerCuitDni: liveExp.providerCuitDni || storeExp?.providerCuitDni,
          providerBankName: liveExp.providerBankName || storeExp?.providerBankName,
        } as ProviderExperience;
      }
      return undefined;
    }

    if (this.expService.hasRemoteExperiences()) {
      return undefined;
    }

    return storeExp?.status === 'publicada' ? storeExp : undefined;
  });

  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => {
    const exp = this.experience();
    return [
      { label: 'Inicio', url: '/' },
      { label: 'Experiencias', url: '/experiencias' },
      ...(exp ? [{ label: exp.shortTitle ?? exp.title, url: `/experiencias/${exp.slug}` }] : []),
      { label: 'Pago' },
    ];
  });

  readonly form = this.fb.nonNullable.group({
    date: ['', Validators.required],
    participants: [
      1,
      [Validators.required, Validators.min(1), Validators.max(MAX_PARTICIPANTS_PER_BOOKING)],
    ],
    fullName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(160)]],
    dni: ['', [Validators.required, Validators.pattern(/^\d{7,9}$/)]],
    phone: ['', [Validators.required, Validators.pattern(/^[+\d\s()-]{8,20}$/)]],
  });

  readonly memberEmail = computed(() => this.newsletter.currentMember()?.email ?? null);
  readonly memberFullName = computed(
    () => this.newsletter.currentMember()?.fullName?.trim() || null,
  );
  readonly memberDni = computed(() => this.newsletter.currentMember()?.dni?.trim() || null);
  readonly memberPhone = computed(() => this.newsletter.currentMember()?.phone?.trim() || null);

  private readonly lockMemberFields = effect(() => {
    this.lockControl('email', this.memberEmail());
    this.fillControl('fullName', this.memberFullName());
    this.fillControl('dni', this.memberDni());
    this.fillControl('phone', this.memberPhone());
  });

  private lockControl(name: 'fullName' | 'email' | 'dni' | 'phone', value: string | null): void {
    const control = this.form.controls[name];
    if (value) {
      control.setValue(value);
      control.disable();
    } else if (control.disabled) {
      control.enable();
      control.setValue('');
    }
  }

  private fillControl(name: 'fullName' | 'dni' | 'phone', value: string | null): void {
    if (value && !this.form.controls[name].value) {
      this.form.controls[name].setValue(value);
    }
  }

  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  readonly dateOptions = computed(() => {
    const exp = this.experience();
    if (!exp) return [];
    const today = new Date().toISOString().split('T')[0];
    return (exp.dates || [])
      .filter((date) => date >= today && !this.store.isDateClosed(exp, date))
      .map((date) => {
        const available = this.store.availableSeats(exp, date);
        const capacity = this.store.capacityForDate(exp, date);
        const isUnlimited = capacity >= 999;
        return {
          date,
          available,
          isUnlimited,
          isSoldOut: available <= 0,
          isLowAvailability: !isUnlimited && available > 0 && available <= 3,
        };
      });
  });

  readonly hasNoFixedDates = computed(() => {
    const exp = this.experience();
    return Boolean(exp && (!exp.dates || exp.dates.length === 0));
  });

  readonly seatsForSelectedDate = computed(() => {
    const selected = this.formValue().date;
    if (this.hasNoFixedDates()) {
      const exp = this.experience();
      return exp?.capacityPerDate || MAX_PARTICIPANTS_PER_BOOKING;
    }
    return this.dateOptions().find((o) => o.date === selected)?.available ?? 0;
  });

  readonly participantOptions = computed(() => {
    const max = Math.min(
      MAX_PARTICIPANTS_PER_BOOKING,
      this.seatsForSelectedDate() || MAX_PARTICIPANTS_PER_BOOKING,
    );
    return Array.from({ length: max }, (_, i) => i + 1);
  });

  readonly subtotal = computed(
    () => (this.experience()?.priceArs ?? 0) * (Number(this.formValue().participants) || 1),
  );

  readonly discountInput = signal('');
  readonly appliedDiscount = signal<DiscountCode | undefined>(undefined);
  readonly discountError = signal<string | null>(null);
  readonly discountArs = computed(() => discountAmount(this.subtotal(), this.appliedDiscount()));
  readonly total = computed(() => this.subtotal() - this.discountArs());

  applyDiscount(): void {
    const raw = this.discountInput().trim();
    if (!raw) {
      this.discountError.set('Ingresá un código.');
      return;
    }
    const discount = findDiscountCode(raw) ?? this.newsletter.findMemberDiscount(raw);
    this.appliedDiscount.set(discount);
    this.discountError.set(discount ? null : 'Código inválido o vencido.');
    if (discount) this.discountInput.set('');
  }

  removeDiscount(): void {
    this.appliedDiscount.set(undefined);
    this.discountError.set(null);
  }

  onDiscountKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    this.applyDiscount();
  }

  readonly receiptFile = signal<File | null>(null);
  readonly receiptPreview = signal<string | null>(null);
  readonly receiptError = signal<string | null>(null);
  readonly isDragging = signal(false);
  readonly previewModalOpen = signal(false);

  private readonly formStatus = toSignal(this.form.statusChanges, {
    initialValue: this.form.status,
  });

  readonly canSubmit = computed(() => this.formStatus() === 'VALID' && this.receiptFile() !== null);

  readonly copied = signal<'cbu' | 'monto' | null>(null);
  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly confirmation = signal<TransferSubmission | null>(null);

  readonly computedTransferDestination = computed<PublicPaymentDestination>(() => {
    const exp = this.experience();
    const slug = this.slug();
    const liveExp =
      this.expService.getPublishedExperienceBySlug(slug) ||
      this.expService.getExperienceBySlug(slug);

    return this.store.getPublicPaymentDetails(exp || liveExp);
  });

  get transferDestination() {
    return this.computedTransferDestination();
  }

  get cbu(): string {
    return this.computedTransferDestination().cbu;
  }

  get cbuGroups(): string[] {
    const cbuVal = this.cbu;
    if (!/^\d{22}$/.test(cbuVal)) {
      return [cbuVal];
    }
    return cbuVal.match(/.{1,4}/g) ?? [cbuVal];
  }

  constructor() {
    effect(() => {
      const noFixed = this.hasNoFixedDates();
      const currentVal = this.form.controls.date.value;
      if (noFixed) {
        if (!currentVal) {
          this.form.controls.date.setValue('A coordinar');
        }
      } else if (currentVal === 'A coordinar') {
        this.form.controls.date.setValue('');
      }
    });
  }

  ngOnInit(): void {
    void this.initializeCheckout();
  }

  private async initializeCheckout(): Promise<void> {
    if (!isSupabaseConfigured()) {
      this.authReady.set(true);
      return;
    }

    try {
      const member = await this.newsletter.getAuthenticatedMember();
      this.checkoutMember.set(member);
      if (member && this.newsletter.consumeLoginSuccessFlag()) {
        this.triggerAuthSuccessFeedback();
      }
    } catch {
      this.authError.set('No pudimos verificar tu cuenta. Intentá nuevamente.');
    } finally {
      this.authReady.set(true);
    }
  }

  private triggerAuthSuccessFeedback(): void {
    if (this.authSuccessTimer) {
      clearTimeout(this.authSuccessTimer);
    }

    this.showAuthSuccessNotification.set(true);
    this.newsletter.profileSuccessHighlight.set(true);
    this.authSuccessTimer = setTimeout(() => {
      this.showAuthSuccessNotification.set(false);
      this.newsletter.profileSuccessHighlight.set(false);
      this.authSuccessTimer = null;
    }, AUTH_SUCCESS_FEEDBACK_DURATION_MS);
  }

  readonly requiresGoogle = computed(() => !this.checkoutMember());

  async linkGoogleAccount(): Promise<void> {
    this.authError.set(null);
    const exp = this.experience();
    const currentPath =
      typeof window !== 'undefined'
        ? window.location.pathname + window.location.search
        : exp?.slug
          ? `/experiencias/${exp.slug}/pago`
          : undefined;

    if (currentPath) {
      this.newsletter.saveAuthReturnUrl(currentPath);
    }

    const redirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}${currentPath || window.location.pathname}`
        : undefined;

    const result = await this.newsletter.signInWithGoogle(redirectTo);
    if (!result.success) {
      this.authError.set(result.message);
    } else {
      const member = await this.newsletter.getAuthenticatedMember();
      this.checkoutMember.set(member);
      if (member) {
        this.triggerAuthSuccessFeedback();
      }
    }
  }

  async copy(value: string, kind: 'cbu' | 'monto'): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      this.copied.set(kind);
      setTimeout(() => this.copied.set(null), 2000);
    } catch {
      this.copied.set(null);
    }
  }

  selectDate(date: string): void {
    this.form.controls.date.setValue(date);
    const available = this.seatsForSelectedDate();
    if (this.form.controls.participants.value > available) {
      this.form.controls.participants.setValue(Math.max(1, available));
    }
  }

  onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.setReceipt(input.files?.[0] ?? null);
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    this.setReceipt(event.dataTransfer?.files?.[0] ?? null);
  }

  removeReceipt(): void {
    const preview = this.receiptPreview();
    if (preview) URL.revokeObjectURL(preview);
    this.receiptFile.set(null);
    this.receiptPreview.set(null);
  }

  private setReceipt(file: File | null): void {
    if (!file) return;
    const error = validateReceiptFile(file);
    this.receiptError.set(error);
    if (error) return;
    this.removeReceipt();
    this.receiptFile.set(file);
    if (file.type.startsWith('image/') || file.type === 'application/pdf') {
      this.receiptPreview.set(URL.createObjectURL(file));
    }
  }

  fieldInvalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }

  formatSize(bytes: number): string {
    return bytes < 1024 * 1024
      ? `${Math.round(bytes / 1024)} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  async submit(): Promise<void> {
    this.submitError.set(null);
    this.form.markAllAsTouched();
    const exp = this.experience();
    const file = this.receiptFile();
    if (!file) {
      this.receiptError.set('Adjuntá el comprobante de la transferencia.');
    }
    if (!exp || this.form.invalid || !file) return;

    this.submitting.set(true);
    try {
      const value = this.form.getRawValue();
      const authenticatedMember = await this.newsletter.getAuthenticatedMember();
      const normalizedEmail = value.email.trim().toLowerCase();
      if (
        isSupabaseConfigured() &&
        (!authenticatedMember || authenticatedMember.email.toLowerCase() !== normalizedEmail)
      ) {
        this.submitError.set(
          'La sesión no coincide con el email de la reserva. Volvé a vincular Google e intentá nuevamente.',
        );
        return;
      }
      if (isSupabaseConfigured() && authenticatedMember) {
        const profileResult = await this.newsletter.updateMemberProfile({
          fullName: value.fullName,
          dni: value.dni,
          phone: value.phone,
          experiencesWishlist: authenticatedMember.experiencesWishlist,
          experiencesOther: authenticatedMember.experiencesOther,
        });
        if (!profileResult.success) {
          this.submitError.set(
            profileResult.message || 'No pudimos actualizar tus datos de perfil.',
          );
          return;
        }
        if (profileResult.entry) {
          this.checkoutMember.set(profileResult.entry);
        }
      }
      const submission = await this.store.submitTransfer({
        experienceId: exp.id,
        date: value.date,
        participants: Number(value.participants),
        fullName: value.fullName,
        email: authenticatedMember?.email ?? normalizedEmail,
        dni: value.dni,
        phone: value.phone,
        discountCode: this.appliedDiscount()?.code,
        receiptFile: file,
      });
      this.confirmation.set(submission);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      this.submitError.set(
        error instanceof Error
          ? error.message
          : 'No pudimos registrar el pago. Intentá nuevamente.',
      );
    } finally {
      this.submitting.set(false);
    }
  }

  openPreviewModal(): void {
    const file = this.receiptFile();
    if (file?.type === 'application/pdf') {
      const url = this.receiptPreview() || (typeof window !== 'undefined' ? URL.createObjectURL(file) : null);
      if (url && typeof window !== 'undefined') {
        window.open(url, '_blank');
      }
      return;
    }
    if (this.receiptPreview()) {
      this.previewModalOpen.set(true);
    }
  }

  closePreviewModal(): void {
    this.previewModalOpen.set(false);
  }

  readonly whatsAppInquiryUrl = computed(() => {
    const exp = this.experience();
    const phone = exp?.providerPhone || '+54 9 383 456-7890';
    const cleanPhone = (phone || '').replace(/\D/g, '') || '5493834567890';
    const msg = encodeURIComponent(
      `Hola! Quisiera consultar por próximas fechas o salidas para la experiencia: "${exp?.title || 'Experiencia'}"`,
    );
    return `https://wa.me/${cleanPhone}?text=${msg}`;
  });

  getWhatsAppUrl(sub: TransferSubmission): string {
    const exp = this.experience();
    const provider =
      (exp?.providerId ? this.store.getProviderById(exp.providerId) : undefined) ||
      (exp?.providerEmail ? this.store.getProviderByEmail(exp.providerEmail) : undefined);
    const customPhone = exp?.providerPhone || provider?.phone;
    return this.notificationService.getWhatsAppNotificationUrl(sub, customPhone);
  }
}
