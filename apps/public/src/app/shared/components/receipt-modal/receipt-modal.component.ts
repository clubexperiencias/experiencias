import { Component, inject, signal } from '@angular/core';
import { ActivityHistoryService } from '../../../core/services/activity-history.service';
import { PaymentReceipt } from '../../../core/models/activity-history.model';
import { getStoredUsdExchangeRate } from '../../../core/models/club-profile.model';

@Component({
  selector: 'app-receipt-modal',
  standalone: true,
  templateUrl: './receipt-modal.component.html',
  styleUrl: './receipt-modal.component.css',
})
export class ReceiptModalComponent {
  readonly activityService = inject(ActivityHistoryService);
  readonly downloading = signal<boolean>(false);

  getReceiptAmountUsd(receipt?: PaymentReceipt | null): number {
    if (!receipt) return 0;
    if (receipt.amountUsd && receipt.amountUsd > 0) {
      return receipt.amountUsd;
    }
    const rate = getStoredUsdExchangeRate();
    return rate > 0 ? Math.round(receipt.amountArs / rate) : 0;
  }

  isUsableUrl(url?: string | null): boolean {
    if (!url) return false;
    const trimmed = url.trim();
    return (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('blob:') ||
      trimmed.startsWith('data:')
    );
  }

  async downloadReceiptFile(url?: string | null, fileName?: string): Promise<void> {
    if (!url || this.downloading()) return;
    this.downloading.set(true);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName || this.extractFileName(url) || 'comprobante.jpg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (err) {
      console.warn('[ReceiptModal] Error al descargar archivo directamente vía fetch:', err);
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.download = fileName || 'comprobante.jpg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      this.downloading.set(false);
    }
  }

  private extractFileName(url: string): string {
    try {
      const pathname = new URL(url).pathname;
      const lastPart = pathname.split('/').pop();
      return lastPart || 'comprobante.jpg';
    } catch {
      return 'comprobante.jpg';
    }
  }

  closeReceipt(): void {
    this.activityService.closeReceipt();
  }

  printReceipt(): void {
    this.activityService.downloadReceiptPrint();
  }
}
