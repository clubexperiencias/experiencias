import { Injectable, inject, signal } from '@angular/core';
import {
  ActivityRecord,
  PaymentReceipt,
  CommunityPhoto,
  ActivityReview,
} from '../models/activity-history.model';
import { SUPABASE_CLIENT, isSupabaseConfigured } from '../supabase/supabase.client';

const STORAGE_KEY = 'catamarca_club_activity_history';

@Injectable({
  providedIn: 'root',
})
export class ActivityHistoryService {
  private readonly supabase = inject(SUPABASE_CLIENT);
  private readonly _activities = signal<ActivityRecord[]>([]);
  readonly activities = this._activities.asReadonly();

  readonly selectedReceipt = signal<PaymentReceipt | null>(null);

  constructor() {
    if (isSupabaseConfigured()) {
      void this.refreshFromSupabase();
      this.supabase.auth.onAuthStateChange(() => {
        void this.refreshFromSupabase();
      });
    }
  }

  private async refreshFromSupabase(): Promise<void> {
    const { data: sessionData } = await this.supabase.auth.getSession();
    const email = sessionData.session?.user.email?.trim().toLowerCase();
    if (!email) {
      this._activities.set([]);
      return;
    }

    const [
      { data: payments, error: paymentsError },
      { data: experiences, error: experiencesError },
    ] = await Promise.all([
      this.supabase
        .from('pagos_transferencias')
        .select('*')
        .eq('email', email)
        .order('submitted_at', { ascending: false }),
      this.supabase.from('experiencias').select('*'),
    ]);

    if (paymentsError || experiencesError) {
      console.warn('[ActivityHistoryService] No se pudo cargar el historial remoto.', {
        paymentsError,
        experiencesError,
      });
      return;
    }

    const experienceById = new Map(
      (experiences ?? []).map((experience) => [experience.id, experience]),
    );
    this._activities.set(
      (payments ?? []).map((payment) => {
        const experience = experienceById.get(payment.experience_id);
        const dateLabel = new Intl.DateTimeFormat('es-AR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }).format(new Date(`${payment.date}T12:00:00`));

        return {
          id: `act_${payment.id}`,
          slug: `${experience?.slug ?? payment.experience_id}-${payment.reference.toLowerCase()}`,
          userId: payment.socio_id ?? email,
          experienceId: payment.experience_id,
          title: payment.experience_title,
          region: experience?.region ?? 'Catamarca',
          altitude: experience?.altitude_meters ? `${experience.altitude_meters} msnm` : '',
          coverImage: experience?.cover_image ?? '/assets/images/kayak-club-de-experiencias.jpg',
          dateLabel,
          status:
            payment.status === 'aprobado'
              ? 'confirmada'
              : payment.status === 'rechazado'
                ? 'cancelada'
                : 'pendiente_pago',
          description: experience?.description ?? undefined,
          provider: {
            name: experience?.short_title ?? payment.experience_title,
            category: experience?.difficulty ?? 'Experiencia',
            contactPhone: '',
          },
          receipt: {
            receiptNumber: payment.reference,
            transactionId: payment.id,
            gateway: 'custom',
            gatewayDisplayName: 'Transferencia bancaria',
            amountArs: payment.amount_ars,
            amountUsd: 0,
            paidAt: new Date(payment.submitted_at).toLocaleString('es-AR'),
            paymentMethodSummary: 'Transferencia a CBU · comprobante en revisión',
            payerEmail: payment.email,
            payerName: payment.full_name,
            authCode: payment.reference,
            status: payment.status === 'aprobado' ? 'aprobado' : 'pendiente_verificacion',
            receiptFileUrl: payment.receipt_url,
            receiptFileName: payment.receipt_file_name,
            ...(payment.discount_code
              ? { discountCode: payment.discount_code, discountArs: payment.discount_ars ?? 0 }
              : {}),
          },
          memoriesCount: 0,
          memoryPhotos: [],
          reviews: [],
        } satisfies ActivityRecord;
      }),
    );
  }

  viewReceipt(receipt: PaymentReceipt): void {
    this.selectedReceipt.set(receipt);
  }

  closeReceipt(): void {
    this.selectedReceipt.set(null);
  }

  downloadReceiptPrint(receiptNumber?: string): void {
    window.print();
  }

  getActivityBySlug(slug: string): ActivityRecord | undefined {
    return this._activities().find((a) => a.slug === slug || a.id === slug);
  }

  /**
   * Helper para formatear firma con Nombre y la inicial del Apellido
   * Ej: "Gonzalo Gramaglia" -> "Gonzalo G."
   * Si es una sola palabra: "Gonzalo G." o el string original
   */
  formatAuthorSignature(fullName: string): string {
    const clean = fullName.trim();
    if (!clean) return 'Socio C.';
    const parts = clean.split(/\s+/);
    if (parts.length === 1) {
      return `${parts[0]} ${parts[0].charAt(0).toUpperCase()}.`;
    }
    const firstName = parts[0];
    const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
    return `${firstName} ${lastInitial}.`;
  }

  /**
   * Agrega fotos subidas por el usuario a la galería comunitaria (máx 3)
   */
  uploadCommunityPhotos(
    slug: string,
    photos: { url: string; caption?: string }[],
    authorSignature: string,
  ): boolean {
    const list = this._activities();
    const index = list.findIndex((a) => a.slug === slug || a.id === slug);
    if (index === -1) return false;

    const activity = list[index];
    const newPhotos: CommunityPhoto[] = photos.slice(0, 3).map((p, i) => ({
      id: `photo_user_${Date.now()}_${i}`,
      url: p.url,
      caption: p.caption || `Foto de travesía subida por ${authorSignature}`,
      uploadedBy: authorSignature,
      uploadedAt: new Date().toLocaleDateString('es-AR'),
    }));

    const updatedActivity: ActivityRecord = {
      ...activity,
      communityPhotos: [...newPhotos, ...(activity.communityPhotos || [])],
      memoriesCount: (activity.memoriesCount || 0) + newPhotos.length,
    };

    const updatedList = [...list];
    updatedList[index] = updatedActivity;
    this.saveActivities(updatedList);
    return true;
  }

  /**
   * Agrega una reseña y votación de 1 a 5 estrellas firmada
   */
  addReview(
    slug: string,
    review: { rating: number; comment: string; authorSignature: string },
  ): boolean {
    const list = this._activities();
    const index = list.findIndex((a) => a.slug === slug || a.id === slug);
    if (index === -1) return false;

    const activity = list[index];
    const newReview: ActivityReview = {
      id: `rev_${Date.now()}`,
      authorSignature: review.authorSignature,
      rating: Math.min(5, Math.max(1, review.rating)),
      comment: review.comment.trim(),
      createdAt: new Date().toLocaleDateString('es-AR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    };

    const updatedActivity: ActivityRecord = {
      ...activity,
      reviews: [newReview, ...(activity.reviews || [])],
      userReview: {
        rating: newReview.rating,
        comment: newReview.comment,
        authorSignature: newReview.authorSignature,
      },
    };

    const updatedList = [...list];
    updatedList[index] = updatedActivity;
    this.saveActivities(updatedList);
    return true;
  }

  private saveActivities(list: ActivityRecord[]): void {
    this._activities.set(list);
  }

  addActivity(record: ActivityRecord): void {
    const slug =
      record.slug ||
      record.title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

    const completeRecord: ActivityRecord = {
      ...record,
      slug,
      communityPhotos: record.communityPhotos || [],
      reviews: record.reviews || [],
    };
    const updated = [completeRecord, ...this._activities()];
    this.saveActivities(updated);
  }
}
