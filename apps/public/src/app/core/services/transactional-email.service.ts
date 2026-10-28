import { Injectable, signal } from '@angular/core';
import { TransferSubmission } from '../models/bank-transfer.model';

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
 * Resend needs a secret API key, so sending must happen server-side (Supabase Edge Function).
 * Until that exists, emails are queued in memory so the UI flow can be built and reviewed.
 */
@Injectable({ providedIn: 'root' })
export class TransactionalEmailService {
  private readonly _outbox = signal<QueuedEmail[]>([]);
  readonly outbox = this._outbox.asReadonly();

  notifyReceiptReceived(submission: TransferSubmission): void {
    this.queue('comprobante_recibido', submission.email, submission.id);
  }

  notifyProviderNewReceipt(submission: TransferSubmission, providerEmail: string): void {
    this.queue('nuevo_comprobante_prestador', providerEmail, submission.id);
  }

  notifyPaymentApproved(submission: TransferSubmission): void {
    this.queue('pago_aprobado', submission.email, submission.id);
  }

  notifyPaymentRejected(submission: TransferSubmission): void {
    this.queue('pago_rechazado', submission.email, submission.id);
  }

  private queue(template: TransactionalEmailTemplate, to: string, submissionId: string): void {
    this._outbox.update((emails) => [
      ...emails,
      { template, to, submissionId, queuedAt: new Date().toISOString() },
    ]);
  }
}
