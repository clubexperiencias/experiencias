import { Injectable, computed, inject, signal } from '@angular/core';
import {
  MAX_PARTICIPANTS_PER_BOOKING,
  NewProviderExperience,
  NewTransferSubmission,
  ProviderExperience,
  RECEIPT_ACCEPTED_TYPES,
  RECEIPT_MAX_BYTES,
  TransferStatus,
  TransferSubmission,
  discountAmount,
  findDiscountCode,
} from '../models/bank-transfer.model';
import { TransactionalEmailService } from './transactional-email.service';
import { NewsletterService } from './newsletter.service';
import { ActivityHistoryService } from './activity-history.service';
import { CloudflareR2Service } from './cloudflare-r2.service';
import { SUPABASE_CLIENT, isSupabaseConfigured } from '../supabase/supabase.client';

const PROVIDER_CONTACT_EMAIL = 'prestadores@experiencias.club';
const SAMPLE_RECEIPT_URL = '/assets/images/comprobante-ejemplo.png';

function upcomingDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function validateReceiptFile(file: File): string | null {
  if (!(RECEIPT_ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    return 'Formato no admitido. Subí una imagen (JPG, PNG, WEBP) o un PDF.';
  }
  if (file.size > RECEIPT_MAX_BYTES) {
    return 'El archivo supera los 5 MB.';
  }
  return null;
}

const KAYAK_ID = 'exp-kayak';

const SEED_EXPERIENCES: ProviderExperience[] = [
  {
    id: KAYAK_ID,
    slug: 'kayak',
    title: 'Travesía en Kayak & Sunset en Las Pirquitas',
    shortTitle: 'Travesía en Kayak',
    tagline: 'Remada guiada al atardecer con brindis de productos catamarqueños.',
    description:
      'Remada guiada en kayak en aguas calmas rodeadas de quebradas y vegetación de yungas andinas. Presenciamos la caída del sol reflejada en el dique y cerramos con un brindis.',
    region: 'Valle Central y Ambato',
    meetingPoint: 'Club Náutico Dique El Jumeal',
    difficulty: 'Baja',
    durationLabel: '4 horas',
    priceArs: 65000,
    capacityPerDate: 12,
    dates: [upcomingDate(9), upcomingDate(16), upcomingDate(23)],
    status: 'publicada',
    createdAt: hoursAgo(24 * 30),
  },
];

const SEED_SUBMISSIONS: TransferSubmission[] = [
  {
    id: 'sub-1',
    reference: 'KAY-4F7Q',
    experienceId: KAYAK_ID,
    experienceTitle: SEED_EXPERIENCES[0].title,
    date: SEED_EXPERIENCES[0].dates[0],
    participants: 2,
    amountArs: 130000,
    fullName: 'Lucía Fernández',
    email: 'lucia.fernandez@ejemplo.com',
    dni: '32458190',
    phone: '+54 383 455 1290',
    receipt: {
      fileName: 'transferencia-lucia.png',
      mimeType: 'image/png',
      sizeBytes: 412_000,
      url: SAMPLE_RECEIPT_URL,
    },
    status: 'pendiente',
    submittedAt: hoursAgo(3),
  },
  {
    id: 'sub-2',
    reference: 'KAY-9M2D',
    experienceId: KAYAK_ID,
    experienceTitle: SEED_EXPERIENCES[0].title,
    date: SEED_EXPERIENCES[0].dates[0],
    participants: 1,
    amountArs: 65000,
    fullName: 'Martín Quiroga',
    email: 'mquiroga@ejemplo.com',
    dni: '28771034',
    phone: '+54 11 5021 7781',
    receipt: {
      fileName: 'comprobante.png',
      mimeType: 'image/png',
      sizeBytes: 388_000,
      url: SAMPLE_RECEIPT_URL,
    },
    status: 'pendiente',
    submittedAt: hoursAgo(20),
  },
  {
    id: 'sub-3',
    reference: 'KAY-2X8B',
    experienceId: KAYAK_ID,
    experienceTitle: SEED_EXPERIENCES[0].title,
    date: SEED_EXPERIENCES[0].dates[1],
    participants: 3,
    amountArs: 195000,
    fullName: 'Carla Ahumada',
    email: 'carla.ahumada@ejemplo.com',
    dni: '35120988',
    phone: '+54 383 412 0033',
    receipt: {
      fileName: 'pago-kayak.png',
      mimeType: 'image/png',
      sizeBytes: 401_000,
      url: SAMPLE_RECEIPT_URL,
    },
    status: 'aprobado',
    submittedAt: hoursAgo(52),
    reviewedAt: hoursAgo(48),
  },
];

/**
 * In-memory store shared by the public payment flow and the provider panel.
 * Will be replaced by Supabase (tables + Storage bucket for receipts) once the backend is set up.
 */
@Injectable({ providedIn: 'root' })
export class ProviderStoreService {
  private readonly emails = inject(TransactionalEmailService);
  private readonly newsletter = inject(NewsletterService);
  private readonly activities = inject(ActivityHistoryService);
  private readonly receiptStorage = inject(CloudflareR2Service);
  private readonly supabase = inject(SUPABASE_CLIENT);

  private readonly _experiences = signal<ProviderExperience[]>(SEED_EXPERIENCES);
  private readonly _submissions = signal<TransferSubmission[]>(SEED_SUBMISSIONS);

  readonly experiences = this._experiences.asReadonly();
  readonly submissions = computed(() =>
    [...this._submissions()].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
  );
  readonly pendingCount = computed(
    () => this._submissions().filter((s) => s.status === 'pendiente').length,
  );

  getExperienceBySlug(slug: string): ProviderExperience | undefined {
    return this._experiences().find((e) => e.slug === slug);
  }

  /** Pending and approved bookings both hold their seats until a provider rejects them. */
  reservedSeats(experienceId: string, date: string): number {
    return this._submissions()
      .filter((s) => s.experienceId === experienceId && s.date === date && s.status !== 'rechazado')
      .reduce((total, s) => total + s.participants, 0);
  }

  availableSeats(experience: ProviderExperience, date: string): number {
    return Math.max(0, experience.capacityPerDate - this.reservedSeats(experience.id, date));
  }

  submissionsFor(experienceId: string): TransferSubmission[] {
    return this._submissions().filter((s) => s.experienceId === experienceId);
  }

  createExperience(input: NewProviderExperience): ProviderExperience {
    const baseSlug = slugify(input.title) || 'experiencia';
    let slug = baseSlug;
    let suffix = 2;
    while (this._experiences().some((e) => e.slug === slug)) {
      slug = `${baseSlug}-${suffix++}`;
    }

    const experience: ProviderExperience = {
      ...input,
      id: `exp-${crypto.randomUUID()}`,
      slug,
      dates: [...input.dates].sort(),
      createdAt: new Date().toISOString(),
    };
    this._experiences.update((list) => [experience, ...list]);
    return experience;
  }

  setExperienceStatus(experienceId: string, status: ProviderExperience['status']): void {
    this._experiences.update((list) =>
      list.map((e) => (e.id === experienceId ? { ...e, status } : e)),
    );
  }

  async submitTransfer(input: NewTransferSubmission): Promise<TransferSubmission> {
    const experience = this._experiences().find((e) => e.id === input.experienceId);
    if (!experience || experience.status !== 'publicada') {
      throw new Error('La experiencia no está disponible.');
    }
    if (!experience.dates.includes(input.date)) {
      throw new Error('La fecha elegida no está disponible.');
    }
    if (
      !Number.isInteger(input.participants) ||
      input.participants < 1 ||
      input.participants > MAX_PARTICIPANTS_PER_BOOKING
    ) {
      throw new Error('Cantidad de personas inválida.');
    }
    if (input.participants > this.availableSeats(experience, input.date)) {
      throw new Error('No quedan cupos suficientes para esa fecha.');
    }
    const fileError = validateReceiptFile(input.receiptFile);
    if (fileError) {
      throw new Error(fileError);
    }
    const discount = input.discountCode
      ? (findDiscountCode(input.discountCode) ??
        this.newsletter.findMemberDiscount(input.discountCode))
      : undefined;
    if (input.discountCode && !discount) {
      throw new Error('El código de descuento no es válido.');
    }
    const subtotal = experience.priceArs * input.participants;
    const discountArs = discountAmount(subtotal, discount);
    const reference = this.buildReference(experience.slug);
    const receipt = await this.receiptStorage.uploadReceipt(input.receiptFile, reference);

    const submission: TransferSubmission = {
      id: `sub-${crypto.randomUUID()}`,
      reference,
      experienceId: experience.id,
      experienceTitle: experience.title,
      date: input.date,
      participants: input.participants,
      amountArs: subtotal - discountArs,
      ...(discount ? { discountCode: discount.code, discountArs } : {}),
      fullName: input.fullName.trim(),
      email: input.email.trim().toLowerCase(),
      dni: input.dni.trim(),
      phone: input.phone.trim(),
      receipt: {
        fileName: input.receiptFile.name,
        mimeType: input.receiptFile.type,
        sizeBytes: input.receiptFile.size,
        url: receipt.url,
        storageKey: receipt.storageKey,
        provider: receipt.provider,
      },
      status: 'pendiente',
      submittedAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      const { data, error } = await this.supabase.rpc('submit_experience_transfer', {
        p_reference: submission.reference,
        p_experience_id: submission.experienceId,
        p_experience_title: submission.experienceTitle,
        p_date: submission.date,
        p_participants: submission.participants,
        p_amount_ars: submission.amountArs,
        p_discount_code: submission.discountCode ?? null,
        p_discount_ars: submission.discountArs ?? 0,
        p_full_name: submission.fullName,
        p_email: submission.email,
        p_dni: submission.dni,
        p_phone: submission.phone,
        p_receipt_file_name: submission.receipt.fileName,
        p_receipt_mime_type: submission.receipt.mimeType,
        p_receipt_size_bytes: submission.receipt.sizeBytes,
        p_receipt_url: submission.receipt.url,
        p_receipt_storage_key: submission.receipt.storageKey ?? null,
        p_receipt_storage_provider: submission.receipt.provider ?? 'r2',
      });
      if (error) {
        throw new Error(`No pudimos registrar el comprobante: ${error.message}`);
      }
      const payload = data as { status?: string };
      if (payload?.status !== 'created') {
        throw new Error(
          payload?.status === 'no_seats_available'
            ? 'No quedan cupos suficientes para esa fecha.'
            : 'No pudimos registrar el comprobante. Intentá nuevamente.',
        );
      }
    }

    this._submissions.update((list) => [submission, ...list]);
    if (submission.discountCode) {
      this.newsletter.markMemberDiscountUsed(
        submission.discountCode,
        submission.reference,
        experience.title,
      );
    }
    this.recordMemberActivity(experience, submission);
    this.emails.notifyReceiptReceived(submission);
    this.emails.notifyProviderNewReceipt(submission, PROVIDER_CONTACT_EMAIL);
    return submission;
  }

  reviewSubmission(
    submissionId: string,
    status: Exclude<TransferStatus, 'pendiente'>,
    rejectionReason?: string,
  ): void {
    let reviewed: TransferSubmission | undefined;
    this._submissions.update((list) =>
      list.map((s) => {
        if (s.id !== submissionId) return s;
        reviewed = {
          ...s,
          status,
          rejectionReason:
            status === 'rechazado' ? rejectionReason?.trim() || undefined : undefined,
          reviewedAt: new Date().toISOString(),
        };
        return reviewed;
      }),
    );
    if (!reviewed) return;
    if (status === 'aprobado') {
      this.emails.notifyPaymentApproved(reviewed);
    } else {
      this.emails.notifyPaymentRejected(reviewed);
    }
  }

  private recordMemberActivity(
    experience: ProviderExperience,
    submission: TransferSubmission,
  ): void {
    const member = this.newsletter.currentMember();
    if (!member) return;
    const dateLabel = new Intl.DateTimeFormat('es-AR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(`${submission.date}T12:00:00`));
    this.activities.addActivity({
      id: `act_${submission.id}`,
      slug: `${experience.slug}-${submission.reference.toLowerCase()}`,
      userId: member.id,
      experienceId: experience.id,
      title: experience.title,
      region: experience.region,
      altitude: experience.meetingPoint,
      coverImage: '/assets/images/laguna_blanca.jpg',
      dateLabel,
      status: 'pendiente_pago',
      provider: {
        name: experience.shortTitle ?? experience.title,
        category: experience.difficulty,
        contactPhone: '',
      },
      receipt: {
        receiptNumber: submission.reference,
        transactionId: submission.id,
        gateway: 'custom',
        gatewayDisplayName: 'Transferencia bancaria',
        amountArs: submission.amountArs,
        amountUsd: 0,
        paidAt: new Date(submission.submittedAt).toLocaleString('es-AR'),
        paymentMethodSummary: 'Transferencia a CBU · comprobante en revisión',
        payerEmail: submission.email,
        payerName: submission.fullName,
        authCode: submission.reference,
        status: 'pendiente_verificacion',
        ...(submission.discountCode
          ? { discountCode: submission.discountCode, discountArs: submission.discountArs }
          : {}),
      },
      memoriesCount: 0,
      memoryPhotos: [],
    });
  }

  private buildReference(slug: string): string {
    const prefix = slug.replace(/-/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X');
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const random = crypto.getRandomValues(new Uint32Array(4));
    const code = Array.from(random, (n) => alphabet[n % alphabet.length]).join('');
    return `${prefix}-${code}`;
  }
}
