import { Injectable, signal } from '@angular/core';
import { ActivityRecord, PaymentReceipt } from '../models/activity-history.model';

const STORAGE_KEY = 'catamarca_club_activity_history';

@Injectable({
  providedIn: 'root'
})
export class ActivityHistoryService {
  private readonly defaultActivities: ActivityRecord[] = [
    {
      id: 'act_001',
      userId: 'user_current',
      experienceId: 'exp_kayak_pirquitas',
      title: 'Travesía en Kayak & Sunset en Las Pirquitas',
      region: 'Valle Central y Ambato',
      altitude: '850 msnm',
      coverImage: '/assets/images/catamarca_pomez.jpg',
      dateLabel: '18 de Octubre, 2026',
      status: 'completada',
      provider: {
        name: 'Travesías Náuticas Ambato (Guía Lucas Albarracín)',
        category: 'Kayak & Deportes Náuticos',
        contactPhone: '+54 9 3834 89-2104'
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
        status: 'aprobado'
      },
      memoriesCount: 8,
      memoryPhotos: ['/assets/images/catamarca_pomez.jpg'],
      userReview: {
        rating: 5,
        comment: 'Experiencia increíble al caer la tarde en el dique. Los kayaks impecables y la picada con quesos de cabra insuperable.'
      }
    },
    {
      id: 'act_002',
      userId: 'user_current',
      experienceId: 'exp_pomez',
      title: 'Campo de Piedra Pómez & Duna Gigante',
      region: 'Antofagasta de la Sierra',
      altitude: '3.300 msnm',
      coverImage: '/assets/images/catamarca_pomez.jpg',
      dateLabel: '24 de Noviembre, 2026 (Próxima salida)',
      status: 'confirmada',
      provider: {
        name: 'Expediciones Puna 4x4 (Mariano Carrizo)',
        category: 'Transporte & Guía 4x4',
        contactPhone: '+54 9 3834 55-9012'
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
        status: 'aprobado'
      },
      memoriesCount: 0,
      memoryPhotos: []
    }
  ];

  private readonly _activities = signal<ActivityRecord[]>(this.loadActivities());
  readonly activities = this._activities.asReadonly();

  readonly selectedReceipt = signal<PaymentReceipt | null>(null);

  viewReceipt(receipt: PaymentReceipt): void {
    this.selectedReceipt.set(receipt);
  }

  closeReceipt(): void {
    this.selectedReceipt.set(null);
  }

  downloadReceiptPrint(receiptNumber: string): void {
    window.print();
  }

  private loadActivities(): ActivityRecord[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }
    return this.defaultActivities;
  }

  addActivity(record: ActivityRecord): void {
    const updated = [record, ...this._activities()];
    this._activities.set(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  }
}
