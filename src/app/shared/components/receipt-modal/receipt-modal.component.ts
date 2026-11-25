import { Component, inject } from '@angular/core';
import { ActivityHistoryService } from '../../../core/services/activity-history.service';

@Component({
  selector: 'app-receipt-modal',
  standalone: true,
  templateUrl: './receipt-modal.component.html',
  styleUrl: './receipt-modal.component.css',
})
export class ReceiptModalComponent {
  readonly activityService = inject(ActivityHistoryService);

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

  closeReceipt(): void {
    this.activityService.closeReceipt();
  }

  printReceipt(): void {
    this.activityService.downloadReceiptPrint();
  }
}
