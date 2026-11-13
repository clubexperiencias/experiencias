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
import { AdminStoreService } from '../../../core/services/admin-store.service';
import { isClubExperience } from '../../../core/models/club-profile.model';
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
  MP_TRANSFER_RECEIPT,
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
  private readonly adminStore = inject(AdminStoreService);

  readonly paymentMethod = signal<'transfer' | 'mercadopago'>('transfer');

  readonly isMercadoPagoAvailable = computed(() => {
    const exp = this.experience();
    if (!exp) return false;
    if (isClubExperience(exp)) {
      return true;
    }
    const prov =
      (exp.providerId ? this.store.getProviderById(exp.providerId) : undefined) ||
      (exp.providerEmail ? this.store.getProviderByEmail(exp.providerEmail) : undefined) ||
      (exp.providerSlug ? this.store.getProviderBySlug(exp.providerSlug) : undefined);
    if (prov) {
      return Boolean(prov.mpConnected);
    }
    return Boolean(exp.mpConnected);
  });

  readonly mercadoPagoSurchargePct = computed(() => {
    return this.adminStore.clubProfile().mercadoPagoSurchargePercentage ?? 12;
  });

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
  readonly baseTotal = computed(() => this.subtotal() - this.discountArs());

  readonly mercadoPagoSurchargeArs = computed(() => {
    if (this.paymentMethod() !== 'mercadopago') return 0;
    const pct = this.mercadoPagoSurchargePct();
    return Math.round((this.baseTotal() * pct) / 100);
  });

  readonly total = computed(() => this.baseTotal() + this.mercadoPagoSurchargeArs());

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

  readonly canSubmit = computed(() => {
    if (this.paymentMethod() === 'mercadopago') {
      return this.formStatus() === 'VALID';
    }
    return this.formStatus() === 'VALID' && this.receiptFile() !== null;
  });

  async submitMercadoPago(): Promise<void> {
    if (this.form.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.submitError.set(null);

    const value = this.form.getRawValue();
    const exp = this.experience();
    if (!exp) {
      this.submitting.set(false);
      return;
    }

    // Revalidar disponibilidad y cupos de la experiencia reutilizando las validaciones del flujo de transferencias
    if (exp.status !== 'publicada') {
      this.submitError.set('La experiencia no está disponible.');
      this.submitting.set(false);
      return;
    }

    const participants = Number(value.participants);
    if (
      !Number.isInteger(participants) ||
      participants < 1 ||
      participants > MAX_PARTICIPANTS_PER_BOOKING
    ) {
      this.submitError.set('Cantidad de personas inválida.');
      this.submitting.set(false);
      return;
    }

    if (
      exp.dates &&
      exp.dates.length > 0 &&
      !exp.dates.includes(value.date) &&
      value.date !== 'A coordinar'
    ) {
      this.submitError.set('La fecha elegida no está disponible.');
      this.submitting.set(false);
      return;
    }

    if (value.date !== 'A coordinar' && this.store.isDateClosed(exp, value.date)) {
      this.submitError.set('La fecha elegida se encuentra cerrada para nuevas reservas.');
      this.submitting.set(false);
      return;
    }

    if (
      exp.dates &&
      exp.dates.length > 0 &&
      value.date !== 'A coordinar' &&
      participants > this.seatsForSelectedDate()
    ) {
      this.submitError.set('No quedan cupos suficientes para esa fecha.');
      this.submitting.set(false);
      return;
    }

    let bookingRef = '';
    try {
      const authenticatedMember = await this.newsletter.getAuthenticatedMember();
      const normalizedEmail = value.email.trim().toLowerCase();
      if (
        isSupabaseConfigured() &&
        (!authenticatedMember || authenticatedMember.email.toLowerCase() !== normalizedEmail)
      ) {
        this.submitError.set(
          'La sesión no coincide con el email de la reserva. Volvé a vincular Google e intentá nuevamente.',
        );
        this.submitting.set(false);
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
          this.submitting.set(false);
          return;
        }
        if (profileResult.entry) {
          this.checkoutMember.set(profileResult.entry);
        }
      }

      bookingRef = this.store.buildReference(exp.slug);

      // Si existía una reserva previa abandonada en la sesión actual, liberarla antes de generar una nueva
      try {
        const rawPrev = sessionStorage.getItem('mp_pending_booking');
        if (rawPrev) {
          const prevBooking = JSON.parse(rawPrev);
          if (prevBooking?.reference && prevBooking.reference !== bookingRef) {
            void this.store.releaseMercadoPagoPending(
              prevBooking.reference,
              'reemplazado_por_nuevo_checkout',
            );
          }
        }
      } catch {
        // ignore
      }

      // 1. Crear primero la preferencia en Mercado Pago para no bloquear cupos si la pasarela falla
      const res = await fetch('/api/mercadopago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-preference',
          experienceId: exp.id,
          experienceTitle: exp.title,
          experienceSlug: exp.slug,
          date: value.date,
          participants,
          baseAmountArs: this.baseTotal(),
          surchargeArs: this.mercadoPagoSurchargeArs(),
          totalAmountArs: this.total(),
          discountCode: this.appliedDiscount()?.code,
          bookingReference: bookingRef,
          payer: {
            name: value.fullName,
            email: value.email,
            phone: value.phone,
            dni: value.dni,
          },
          providerId: exp.providerId,
          providerCollectorId: exp.mpCollectorId,
        }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok || !data || !data.init_point) {
        throw new Error(
          data?.error || data?.message || 'No se pudo iniciar el checkout con Mercado Pago.',
        );
      }

      // 2. Con la preferencia confirmada, persistir la reserva pendiente en el servidor antes de redirigir
      await this.store.submitMercadoPagoPending({
        experienceId: exp.id,
        date: value.date,
        participants,
        amountArs: this.total(),
        baseAmountArs: this.baseTotal(),
        surchargeArs: this.mercadoPagoSurchargeArs(),
        discountCode: this.appliedDiscount()?.code,
        discountArs: this.discountArs(),
        fullName: value.fullName.trim(),
        email: (authenticatedMember?.email ?? normalizedEmail).trim().toLowerCase(),
        dni: value.dni.trim(),
        phone: value.phone.trim(),
        reference: bookingRef,
      });

      // 3. Guardar en sesión y redirigir al checkout oficial de Mercado Pago
      if (typeof window !== 'undefined') {
        const pendingBooking = {
          experienceId: exp.id,
          experienceTitle: exp.title,
          experienceSlug: exp.slug,
          date: value.date,
          participants,
          baseAmountArs: this.baseTotal(),
          surchargeArs: this.mercadoPagoSurchargeArs(),
          totalAmountArs: this.total(),
          discountCode: this.appliedDiscount()?.code,
          discountArs: this.discountArs(),
          fullName: value.fullName.trim(),
          email: (authenticatedMember?.email ?? normalizedEmail).trim().toLowerCase(),
          dni: value.dni.trim(),
          phone: value.phone.trim(),
          reference: bookingRef,
          preferenceId: data.preference_id,
        };
        try {
          sessionStorage.setItem('mp_pending_booking', JSON.stringify(pendingBooking));
        } catch {
          // ignore storage error
        }
        window.location.href = data.init_point;
      }
    } catch (err: unknown) {
      if (bookingRef) {
        void this.store.releaseMercadoPagoPending(bookingRef, 'error_inicio_checkout');
      }
      this.submitError.set(
        err instanceof Error
          ? err.message
          : 'Error al conectar con Mercado Pago. Podés abonar por transferencia.',
      );
      this.submitting.set(false);
    }
  }

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

    // Liberar reserva pendiente si el usuario cambia a transferencia bancaria
    effect(() => {
      const method = this.paymentMethod();
      if (method === 'transfer' && typeof window !== 'undefined') {
        try {
          const raw = sessionStorage.getItem('mp_pending_booking');
          if (raw) {
            const pending = JSON.parse(raw);
            if (pending?.reference) {
              void this.store.releaseMercadoPagoPending(pending.reference, 'cambio_a_transferencia');
            }
            sessionStorage.removeItem('mp_pending_booking');
          }
        } catch {
          // ignore
        }
      }
    });
  }

  ngOnInit(): void {
    void this.initializeCheckout();
  }

  private async initializeCheckout(): Promise<void> {
    if (!isSupabaseConfigured()) {
      this.authReady.set(true);
    }
    void this.store.releaseExpiredMercadoPagoPending();

    try {
      let member = null;
      if (isSupabaseConfigured()) {
        member = await this.newsletter.getAuthenticatedMember();
        this.checkoutMember.set(member);
        if (member && this.newsletter.consumeLoginSuccessFlag()) {
          this.triggerAuthSuccessFeedback();
        }
      }

      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const urlStatus = params.get('status') || params.get('collection_status');
        const collectionId = params.get('collection_id') || params.get('payment_id');

        if (urlStatus === 'rejected' || urlStatus === 'failure' || urlStatus === 'null') {
          let pendingBooking: any = null;
          try {
            const raw = sessionStorage.getItem('mp_pending_booking');
            if (raw) {
              pendingBooking = JSON.parse(raw);
            }
          } catch {
            pendingBooking = null;
          }

          if (pendingBooking?.reference) {
            void this.store.releaseMercadoPagoPending(
              pendingBooking.reference,
              urlStatus === 'rejected' ? 'rechazado_por_mercadopago' : 'cancelado_por_usuario',
            );
            try {
              sessionStorage.removeItem('mp_pending_booking');
            } catch {
              // ignore
            }
          }

          this.submitError.set('El pago fue cancelado o rechazado en Mercado Pago.');
          return;
        }

        if (collectionId) {
          const exp = this.experience();
          let pendingBooking: any = null;
          try {
            const raw = sessionStorage.getItem('mp_pending_booking');
            if (raw) {
              pendingBooking = JSON.parse(raw);
            }
          } catch {
            pendingBooking = null;
          }

          const targetExpId = exp?.id || pendingBooking?.experienceId;
          const targetExpSlug = exp?.slug || pendingBooking?.experienceSlug;
          const buyerEmail = (pendingBooking?.email || member?.email || '').trim().toLowerCase();

          // 1. Verificar el pago y su asociación a través del mecanismo del servidor
          let verifyData: any = null;
          try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            const buyerToken = await this.store.getAuthToken();
            if (buyerToken) {
              headers['Authorization'] = `Bearer ${buyerToken}`;
            }

            const verifyRes = await fetch('/api/mercadopago', {
              method: 'POST',
              headers,
              body: JSON.stringify({
                action: 'verify-payment',
                paymentId: collectionId,
                experienceId: targetExpId,
                experienceSlug: targetExpSlug,
                bookingReference: pendingBooking?.reference,
                email: buyerEmail,
              }),
            });

            verifyData = await verifyRes.json();
            if (!verifyRes.ok || !verifyData?.verified || verifyData?.status !== 'approved') {
              this.submitError.set(
                verifyData?.error ||
                  'No se pudo verificar la aprobación del pago. Si el importe fue debitado, contactanos para registrar tus cupos.',
              );
              return;
            }
          } catch (netErr) {
            console.warn('[ExperiencePayment] Error al verificar el pago con el servidor:', netErr);
            this.submitError.set(
              'No pudimos verificar el pago con el servidor. Por favor, recargá la página o comunicate con el Club.',
            );
            return;
          }

          // 2. Con el pago verificado por el servidor, reflejar la reserva confirmada por el servidor
          const targetDate =
            pendingBooking?.date ||
            (exp && exp.dates.length > 0 ? exp.dates[0] : 'A coordinar');
          const targetParticipants =
            Number(pendingBooking?.participants) || 1;
          const targetTotal =
            Number(verifyData?.amountArs) ||
            Number(pendingBooking?.totalAmountArs) ||
            (exp ? exp.priceArs * targetParticipants : 0);
          const targetBase =
            Number(pendingBooking?.baseAmountArs) || targetTotal;
          const targetSurcharge =
            Number(pendingBooking?.surchargeArs) || 0;
          const targetDiscountCode =
            pendingBooking?.discountCode;
          const targetDiscountArs =
            Number(pendingBooking?.discountArs) || 0;
          const targetFullName =
            pendingBooking?.fullName || member?.fullName || 'Explorador';
          const targetEmail =
            pendingBooking?.email || member?.email || '';
          const targetDni =
            pendingBooking?.dni || member?.dni || '';
          const targetPhone =
            pendingBooking?.phone || member?.phone || '';

          try {
            if (verifyData?.booking) {
              const b = verifyData.booking;
              const confirmedSubmission: TransferSubmission = {
                id: b.id ? `sub-${b.id}` : `mp-${collectionId}`,
                reference:
                  b.reference ||
                  pendingBooking?.reference ||
                  `MP-${collectionId}`,
                displayReference: `MP-${String(collectionId).slice(-6).toUpperCase()}`,
                experienceId: b.experience_id || targetExpId || 'exp',
                experienceTitle:
                  b.experience_title ||
                  exp?.title ||
                  pendingBooking?.experienceTitle ||
                  'Experiencia en Catamarca',
                date: b.selected_date || b.date || targetDate,
                participants: Number(b.participants) || targetParticipants,
                amountArs: targetTotal,
                discountCode: b.discount_code || targetDiscountCode,
                discountArs:
                  b.discount_ars !== undefined ? Number(b.discount_ars) : targetDiscountArs,
                surchargeArs: targetSurcharge,
                paymentMethod: 'mercadopago',
                mpPaymentId: collectionId,
                fullName: b.full_name || targetFullName,
                email: b.email || targetEmail,
                dni: b.dni || targetDni,
                phone: b.phone || targetPhone,
                receipt: {
                  fileName: b.receipt_file_name || MP_TRANSFER_RECEIPT.fileName,
                  mimeType: b.receipt_mime_type || MP_TRANSFER_RECEIPT.mimeType,
                  sizeBytes: Number(b.receipt_size_bytes) || 0,
                  url: b.receipt_url || MP_TRANSFER_RECEIPT.url,
                },
                status: 'aprobado',
                submittedAt: b.created_at || b.submitted_at || new Date().toISOString(),
                reviewedAt: b.reviewed_at || new Date().toISOString(),
              };

              this.store.recordConfirmedBooking(confirmedSubmission);
              this.confirmation.set(confirmedSubmission);
            } else {
              const submission = await this.store.registerMercadoPagoPayment({
                experienceId: targetExpId || 'exp',
                date: targetDate,
                participants: targetParticipants,
                amountArs: targetTotal,
                baseAmountArs: targetBase,
                surchargeArs: targetSurcharge,
                discountCode: targetDiscountCode,
                discountArs: targetDiscountArs,
                fullName: targetFullName,
                email: targetEmail,
                dni: targetDni,
                phone: targetPhone,
                collectionId,
                reference: pendingBooking?.reference,
              });
              this.confirmation.set(submission);
            }
            try {
              sessionStorage.removeItem('mp_pending_booking');
            } catch {
              // ignore
            }
          } catch (regErr) {
            console.warn('[ExperiencePayment] Error registrando pago MP verificado:', regErr);
            this.submitError.set(
              'El pago fue verificado y aprobado por Mercado Pago pero ocurrió un error al asentar la reserva. Por favor contactanos para registrar tus cupos.',
            );
          }
        }
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
