import { Injectable, inject, signal } from '@angular/core';
import { TransferSubmission } from '../models/bank-transfer.model';
import { NotificationService } from './notification.service';

export type TransactionalEmailTemplate =
  | 'comprobante_recibido'
  | 'nuevo_comprobante_prestador'
  | 'pago_aprobado'
  | 'pago_rechazado';

export interface QueuedEmail {
  template: TransactionalEmailTemplate;
  to: string;
  submissionId: string;
  queuedAt: string;
}

/**
 * Servicio de emails transaccionales para reservas y comprobantes.
 * Conecta con NotificationService para despacho serverless a través de Resend API.
 */
@Injectable({ providedIn: 'root' })
export class TransactionalEmailService {
  private readonly notificationService = inject(NotificationService);
  private readonly _outbox = signal<QueuedEmail[]>([]);
  readonly outbox = this._outbox.asReadonly();

  notifyReceiptReceived(submission: TransferSubmission): void {
    this.queue('comprobante_recibido', submission.email, submission.id);
    this.notificationService
      .notifyPaymentSubmitted(submission, submission.receipt?.url)
      .catch((err) => {
        console.warn('[TransactionalEmail] Error enviando comprobante recibido:', err);
      });
  }

  notifyProviderNewReceipt(submission: TransferSubmission, providerEmail: string): void {
    this.queue('nuevo_comprobante_prestador', providerEmail, submission.id);
    // Nota: notifyPaymentSubmitted ya despacha alerta a la lista de administradores/prestadores
  }

  notifyPaymentApproved(submission: TransferSubmission): void {
    this.queue('pago_aprobado', submission.email, submission.id);
    this.notificationService.notifyPaymentApproved(submission).catch((err) => {
      console.warn('[TransactionalEmail] Error enviando pago aprobado:', err);
    });
  }

  notifyPaymentRejected(submission: TransferSubmission): void {
    this.queue('pago_rechazado', submission.email, submission.id);
    this.notificationService
      .notifyPaymentRejected(
        submission,
        submission.rejectionReason || 'No pudimos verificar la transferencia bancaria con los datos provistos.',
      )
      .catch((err) => {
        console.warn('[TransactionalEmail] Error enviando pago rechazado:', err);
      });
  }

  private queue(template: TransactionalEmailTemplate, to: string, submissionId: string): void {
    this._outbox.update((emails) => [
      ...emails,
      { template, to, submissionId, queuedAt: new Date().toISOString() },
    ]);
  }
}
