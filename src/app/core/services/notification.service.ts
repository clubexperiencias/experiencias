import { Injectable, inject, signal } from '@angular/core';
import { TransferSubmission } from '../models/bank-transfer.model';
import { SUPABASE_CLIENT, isSupabaseConfigured } from '../supabase/supabase.client';

export interface NotificationResult {
  success: boolean;
  type: string;
  results?: Array<{ target: string; id?: string; simulated?: boolean }>;
  error?: string;
}

export interface NotificationLogEntry {
  type: string;
  target: string;
  timestamp: string;
  success: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly supabase = inject(SUPABASE_CLIENT);
  private readonly _notificationsLog = signal<NotificationLogEntry[]>([]);
  readonly notificationsLog = this._notificationsLog.asReadonly();

  /**
   * Envía aviso de comprobante subido:
   * 1. Al socio: Confirmando que recibimos su transferencia.
   * 2. Al equipo administrador y prestador: Para su verificación.
   */
  async notifyPaymentSubmitted(
    submission: TransferSubmission,
    receiptUrl?: string,
    providerEmail?: string,
    providerPhone?: string,
  ): Promise<NotificationResult> {
    const payload = {
      type: 'PAYMENT_SUBMITTED',
      data: {
        reference: submission.reference,
        fullName: submission.fullName,
        email: submission.email,
        phone: submission.phone || '',
        dni: submission.dni || '',
        experienceTitle: submission.experienceTitle,
        date: submission.date,
        participants: submission.participants,
        amountArs: submission.amountArs,
        receiptUrl: receiptUrl || submission.receipt?.url || '',
        providerEmail: providerEmail || '',
        providerPhone: providerPhone || '',
      },
    };

    return this.postNotify(payload, submission.email);
  }

  /**
   * Envía confirmación de reserva aprobada (Voucher) al socio.
   */
  async notifyPaymentApproved(
    submission: TransferSubmission,
    options?: { meetingPoint?: string },
  ): Promise<NotificationResult> {
    const payload = {
      type: 'PAYMENT_APPROVED',
      data: {
        email: submission.email,
        fullName: submission.fullName,
        reference: submission.reference,
        experienceTitle: submission.experienceTitle,
        date: submission.date,
        participants: submission.participants,
        amountArs: submission.amountArs,
        meetingPoint: options?.meetingPoint || '',
      },
    };

    return this.postNotify(payload, submission.email);
  }

  /**
   * Envía notificación de comprobante observado / rechazado con el motivo.
   */
  async notifyPaymentRejected(
    submission: TransferSubmission,
    reason: string,
  ): Promise<NotificationResult> {
    const payload = {
      type: 'PAYMENT_REJECTED',
      data: {
        email: submission.email,
        fullName: submission.fullName,
        reference: submission.reference,
        experienceTitle: submission.experienceTitle,
        rejectionReason: reason,
      },
    };

    return this.postNotify(payload, submission.email);
  }

  /**
   * Envía correo de bienvenida a nuevo socio fundador / emergente.
   */
  async notifyWelcomeMember(member: {
    fullName: string;
    email: string;
    position?: number | string;
  }): Promise<NotificationResult> {
    const payload = {
      type: 'WELCOME_MEMBER',
      data: {
        email: member.email,
        fullName: member.fullName,
        position: member.position,
      },
    };

    return this.postNotify(payload, member.email);
  }

  /**
   * Envía aviso cuando un usuario que ya está registrado intenta registrarse nuevamente.
   */
  async notifyAlreadyRegistered(member: {
    email: string;
    fullName?: string;
    position?: number | string | null;
    tier?: string;
  }): Promise<NotificationResult> {
    const payload = {
      type: 'ALREADY_REGISTERED',
      data: {
        email: member.email,
        fullName: member.fullName || '',
        position: member.position,
        tier: member.tier,
      },
    };

    return this.postNotify(payload, member.email);
  }

  /**
   * Envía confirmación de registro en la lista de espera oficial (Waitlist),
   * avisando del próximo lanzamiento de Socios Plenos e invitando a sumarse como
   * Socio Emergente y reservar experiencias disponibles (Kayak).
   */
  async notifyWaitlistConfirmation(data: { email: string }): Promise<NotificationResult> {
    const payload = {
      type: 'WAITLIST_CONFIRMATION',
      data: {
        email: data.email,
      },
    };

    return this.postNotify(payload, data.email);
  }

  /**
   * Envía confirmación de postulación recibida al prestador y alerta a los administradores.
   */
  async notifyProviderApplicationSubmitted(data: {
    fullName: string;
    email: string;
    phone?: string;
    category?: string;
    region?: string;
    website?: string;
    description?: string;
  }): Promise<NotificationResult> {
    const payload = {
      type: 'PROVIDER_APPLICATION_SUBMITTED',
      data: {
        fullName: data.fullName,
        email: data.email,
        phone: data.phone || '',
        category: data.category || '',
        region: data.region || '',
        website: data.website || '',
        description: data.description || '',
      },
    };

    return this.postNotify(payload, data.email);
  }

  /**
   * Envía aviso de aprobación al prestador con instrucciones de ingreso al portal.
   */
  async notifyProviderApproved(provider: {
    fullName?: string;
    name?: string;
    email: string;
  }): Promise<NotificationResult> {
    const payload = {
      type: 'PROVIDER_APPROVED',
      data: {
        fullName: provider.fullName || provider.name || '',
        email: provider.email,
      },
    };

    return this.postNotify(payload, provider.email);
  }

  /**
   * Envía aviso de nueva propuesta de experiencia al prestador y administradores.
   */
  async notifyExperienceProposalSubmitted(data: {
    title: string;
    providerName: string;
    providerAgency?: string;
    providerEmail: string;
    providerPhone?: string;
    region?: string;
    difficulty?: string;
    duration?: string;
    priceArs: number;
    meetingPoint?: string;
    itinerary?: string;
  }): Promise<NotificationResult> {
    const payload = {
      type: 'EXPERIENCE_PROPOSAL_SUBMITTED',
      data: {
        title: data.title,
        providerName: data.providerName,
        providerAgency: data.providerAgency || '',
        providerEmail: data.providerEmail,
        providerPhone: data.providerPhone || '',
        region: data.region || 'Catamarca',
        difficulty: data.difficulty || 'Moderada',
        duration: data.duration || '4 horas',
        priceArs: data.priceArs,
        meetingPoint: data.meetingPoint || '',
        itinerary: data.itinerary || '',
      },
    };

    return this.postNotify(payload, data.providerEmail);
  }

  /**
   * Genera el enlace directo a WhatsApp con mensaje prearmado para avisar del pago.
   */
  getWhatsAppNotificationUrl(
    submission: TransferSubmission,
    customPhone?: string,
  ): string {
    const defaultPhone = '5493515490431';
    let clean = (customPhone || defaultPhone).replace(/\D/g, '');
    if (clean.startsWith('0')) {
      clean = clean.substring(1);
    }
    if (!clean.startsWith('54')) {
      clean = '549' + clean;
    } else if (clean.startsWith('54') && !clean.startsWith('549')) {
      clean = '549' + clean.substring(2);
    }
    const targetPhone = clean || defaultPhone;
    const formattedAmount = Number(submission.amountArs || 0).toLocaleString('es-AR');

    const msg =
      `¡Hola! Acabo de enviar el comprobante de transferencia para mi reserva en Experiencias Club:\n\n` +
      `* Experiencia: ${submission.experienceTitle}\n` +
      `* Código de Reserva: ${submission.reference}\n` +
      `* Pasajero: ${submission.fullName}\n` +
      `* Fecha: ${submission.date}\n` +
      `* Lugares: ${submission.participants}\n` +
      `* Monto: $${formattedAmount} ARS\n\n` +
      `¿Me confirman la acreditación cuando puedan? ¡Muchas gracias!`;

    return `https://wa.me/${targetPhone}?text=${encodeURIComponent(msg)}`;
  }

  private async postNotify(payload: any, targetEmail: string): Promise<NotificationResult> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (isSupabaseConfigured() && this.supabase) {
        try {
          const { data } = await this.supabase.auth.getSession();
          if (data?.session?.access_token) {
            headers['Authorization'] = `Bearer ${data.session.access_token}`;
          }
        } catch {
          // Si falla obtener la sesión, continuamos sin token de autorización
        }
      }

      const response = await fetch('/api/notify', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);
      const success = response.ok && !!data?.success;

      this.logNotification(payload.type, targetEmail, success);

      return {
        success,
        type: payload.type,
        results: data?.results,
        error: data?.error,
      };
    } catch (err: any) {
      console.warn('[NotificationService] No se pudo conectar con /api/notify:', err);
      this.logNotification(payload.type, targetEmail, false);
      return {
        success: false,
        type: payload.type,
        error: err?.message || 'Error de conexión',
      };
    }
  }

  private logNotification(type: string, target: string, success: boolean): void {
    this._notificationsLog.update((log) => [
      ...log,
      {
        type,
        target,
        timestamp: new Date().toISOString(),
        success,
      },
    ]);
  }
}

