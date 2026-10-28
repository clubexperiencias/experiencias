import { Component, inject } from '@angular/core';
import { ActivityHistoryService } from '../../../core/services/activity-history.service';

@Component({
  selector: 'app-receipt-modal',
  standalone: true,
  templateUrl: './receipt-modal.component.html',
  styleUrl: './receipt-modal.component.css'
})
export class ReceiptModalComponent {
  readonly activityService = inject(ActivityHistoryService);

  closeReceipt(): void {
    this.activityService.closeReceipt();
  }

  printReceipt(): void {
    this.activityService.downloadReceiptPrint();
  }
}
