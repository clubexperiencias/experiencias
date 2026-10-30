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

    const [{ data: payments, error: paymentsError }, { data: experiences, error: experiencesError }] =
      await Promise.all([
        this.supabase
          .from('pagos_transferencias')
          .select('*')
          .eq('email', email)
          .order('submitted_at', { ascending: false }),
        this.supabase.from('experiencias_club').select('*'),
      ]);

    if (paymentsError || experiencesError) {
      console.warn('[ActivityHistoryService] No se pudo cargar el historial remoto.', {
        paymentsError,
        experiencesError,
      });
      return;
    }

    const experienceById = new Map((experiences ?? []).map((experience) => [experience.id, experience]));
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
          altitude: experience?.meeting_point ?? '',
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

  /*
    {
      id: 'act_001',
      slug: 'kayak-las-pirquitas',
      userId: 'user_current',
      experienceId: 'exp_kayak_pirquitas',
      title: 'Travesía en Kayak & Sunset en Las Pirquitas',
      region: 'Valle Central y Ambato',
      altitude: '850 msnm',
      coverImage: '/assets/images/kayak-club-de-experiencias.jpg',
      dateLabel: '18 de Octubre, 2026',
      status: 'completada',
      description:
        'Navegación silenciosa en kayak de travesía por el dique Las Pirquitas a 28 km de la capital provincial. Exploración de quebradas rojizas al atardecer, avistaje de aves acuáticas y cierre con tertulia y degustación de vinos de altura y quesos de cabra.',
      provider: {
        name: 'Travesías Náuticas Ambato (Guía Lucas Albarracín)',
        category: 'Kayak & Deportes Náuticos',
        contactPhone: '+54 9 3834 89-2104',
      },
      receipt: {
        receiptNumber: 'REC-2026-CAT-0104',
        transactionId: 'MP-9281748291',
        gateway: 'mercadopago',
        gatewayDisplayName: 'Mercado Pago (Dinero en Cuenta)',
        amountArs: 65000,
        amountUsd: 70,
        paidAt: '18/10/2026 14:32 hs',
        paymentMethodSummary: 'Mercado Pago · Tarjeta Débito / Saldo',
        payerEmail: 'socio.fundador@catamarca.ar',
        payerName: 'Socio Fundador Catamarca',
        authCode: 'AUTH-MP-89214',
        status: 'aprobado',
      },
      memoriesCount: 8,
      memoryPhotos: [
        '/assets/images/kayak-club-de-experiencias.jpg',
        '/assets/images/laguna_blanca.jpg',
      ],
      communityPhotos: [
        {
          id: 'photo_com_01',
          url: '/assets/images/kayak-club-de-experiencias.jpg',
          caption: 'Los kayaks ingresando al espejo de agua con el sol cayendo tras las sierras.',
          uploadedBy: 'Lucas A.',
          uploadedAt: '18/10/2026 18:45',
        },
        {
          id: 'photo_com_02',
          url: '/assets/images/catamarca_hero.jpg',
          caption: 'Panorámica de los paredones rojizos desde el agua en la quebrada oeste.',
          uploadedBy: 'Mariana T.',
          uploadedAt: '18/10/2026 19:10',
        },
        {
          id: 'photo_com_03',
          url: '/assets/images/laguna_blanca.jpg',
          caption: 'Brindis de cierre en el Club Náutico al anochecer.',
          uploadedBy: 'Ignacio B.',
          uploadedAt: '19/10/2026 09:15',
        },
      ],
      reviews: [
        {
          id: 'rev_com_01',
          authorSignature: 'Ignacio B.',
          rating: 5,
          comment:
            'Experiencia increíble al caer la tarde en el dique. Los kayaks impecables y la picada con quesos de cabra insuperable.',
          createdAt: '19 de Octubre, 2026',
        },
        {
          id: 'rev_com_02',
          authorSignature: 'Mariana T.',
          rating: 5,
          comment:
            'La paz del agua al atardecer no tiene comparación. Lucas el guía transmitió una seguridad absoluta.',
          createdAt: '20 de Octubre, 2026',
        },
      ],
      userReview: {
        rating: 5,
        comment:
          'Experiencia increíble al caer la tarde en el dique. Los kayaks impecables y la picada con quesos de cabra insuperable.',
        authorSignature: 'Ignacio B.',
      },
    },
    {
      id: 'act_002',
      slug: 'campo-de-piedra-pomez',
      userId: 'user_current',
      experienceId: 'exp_pomez',
      title: 'Campo de Piedra Pómez & Duna Gigante',
      region: 'Antofagasta de la Sierra',
      altitude: '3.300 msnm',
      coverImage: '/assets/images/piedra-pomez.png',
      dateLabel: '24 de Noviembre, 2026 (Próxima salida)',
      status: 'confirmada',
      description:
        'Expedición 4x4 cruzando el mar de piedra pómez más extenso del planeta. Laberintos de ceniza volcánica esculpidos por el viento puneño y ascenso a la duna gigante con vistas a los volcanes Antofagasta y Carachi Pampa.',
      provider: {
        name: 'Expediciones Puna 4x4 (Mariano Carrizo)',
        category: 'Transporte & Guía 4x4',
        contactPhone: '+54 9 3834 55-9012',
      },
      receipt: {
        receiptNumber: 'REC-2026-CAT-0238',
        transactionId: 'TX-PROP-849102',
        gateway: 'custom',
        gatewayDisplayName: 'Pasarela Propia · Transferencia Inmediata',
        amountArs: 185000,
        amountUsd: 190,
        paidAt: '20/10/2026 11:15 hs',
        paymentMethodSummary: 'Transferencia CBU Banco Nación a Club Catamarca',
        cbuDestination: '0110452330045298124012 (Alias: CLUB.CATAMARCA.VIAJES)',
        payerEmail: 'socio.fundador@catamarca.ar',
        payerName: 'Socio Fundador Catamarca',
        authCode: 'CBU-TRF-4910294',
        status: 'aprobado',
      },
      memoriesCount: 3,
      memoryPhotos: ['/assets/images/piedra-pomez.png'],
      communityPhotos: [
        {
          id: 'photo_com_04',
          url: '/assets/images/piedra-pomez.png',
          caption: 'Sombras alargadas sobre las formaciones de piedra pómez al mediodía.',
          uploadedBy: 'Carlos V.',
          uploadedAt: '15/09/2026 13:20',
        },
      ],
      reviews: [
        {
          id: 'rev_com_03',
          authorSignature: 'Carlos V.',
          rating: 5,
          comment:
            'Un paisaje lunar de otro planeta. La destreza del chofer en la arena es fundamental.',
          createdAt: '16 de Septiembre, 2026',
        },
      ],
    },
    {
      id: 'act_003',
      slug: 'ruta-de-los-seismiles',
      userId: 'user_current',
      experienceId: 'exp_seismiles',
      title: 'Ruta de los Seismiles & Laguna Verde',
      region: 'Fiambalá & Paso de San Francisco',
      altitude: '4.100 msnm',
      coverImage: '/assets/images/laguna-verde.jpg',
      dateLabel: '12 de Diciembre, 2026 (Planificada)',
      status: 'confirmada',
      description:
        'Travesía de alta montaña por la RN 60 hacia el Paso de San Francisco, custodiada por cumbres de más de 6.000 metros (Monte Pissis, Ojos del Salado, San Francisco) y descanso en las orillas de la Laguna Verde.',
      provider: {
        name: 'Guías de Cordillera Fiambalá (Valeria Morales)',
        category: 'Alta Montaña & Logística',
        contactPhone: '+54 9 3834 33-8911',
      },
      receipt: {
        receiptNumber: 'REC-2026-CAT-0319',
        transactionId: 'STRIPE-CH-918293',
        gateway: 'stripe',
        gatewayDisplayName: 'Stripe International (Tarjeta de Crédito)',
        amountArs: 140000,
        amountUsd: 145,
        paidAt: '22/10/2026 16:40 hs',
        paymentMethodSummary: 'Visa Platinum · Moneda Local',
        payerEmail: 'socio.fundador@catamarca.ar',
        payerName: 'Socio Fundador Catamarca',
        authCode: 'STRIPE-AUTH-7721',
        status: 'aprobado',
      },
      memoriesCount: 2,
      memoryPhotos: ['/assets/images/laguna-verde.jpg'],
      communityPhotos: [
        {
          id: 'photo_com_05',
          url: '/assets/images/laguna-verde.jpg',
          caption: 'El turquesa intenso de la Laguna Verde reflejando los seismiles.',
          uploadedBy: 'Valeria M.',
          uploadedAt: '05/10/2026 15:00',
        },
      ],
      reviews: [],
    },
  ];
  */

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
