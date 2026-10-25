import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { NewsletterService } from '../../core/services/newsletter.service';
import { ActivityHistoryService } from '../../core/services/activity-history.service';
import { PaymentReceipt } from '../../core/models/activity-history.model';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent {
  readonly newsletter = inject(NewsletterService);
  readonly activityService = inject(ActivityHistoryService);
  readonly router = inject(Router);

  readonly copyStatus = signal<string | null>(null);

  logout(): void {
    this.newsletter.resetCurrentSubscription();
    this.router.navigate(['/']);
  }

  copyReferralCode(): void {
    const code = this.newsletter.currentMember()?.referralCode || 'CAT-2026-EXP';
    navigator.clipboard?.writeText(code).then(() => {
      this.copyStatus.set('¡Código copiado al portapapeles!');
      setTimeout(() => this.copyStatus.set(null), 3000);
    }).catch(() => {
      this.copyStatus.set('Código: ' + code);
      setTimeout(() => this.copyStatus.set(null), 4000);
    });
  }

  openReceipt(receipt: PaymentReceipt, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.activityService.viewReceipt(receipt);
  }

  closeReceipt(): void {
    this.activityService.closeReceipt();
  }

  printReceipt(): void {
    window.print();
  }
}
