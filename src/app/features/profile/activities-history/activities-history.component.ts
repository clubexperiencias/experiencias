import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivityHistoryService } from '../../../core/services/activity-history.service';
import { ActivityRecord, PaymentReceipt } from '../../../core/models/activity-history.model';
import { BreadcrumbComponent, BreadcrumbItem } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { FooterComponent } from '../../../shared/components/footer/footer.component';
import { ReceiptModalComponent } from '../../../shared/components/receipt-modal/receipt-modal.component';

export type ActivitySort = 'desc' | 'asc';

@Component({
  selector: 'app-activities-history',
  standalone: true,
  imports: [CommonModule, BreadcrumbComponent, HeaderComponent, FooterComponent, ReceiptModalComponent],
  templateUrl: './activities-history.component.html',
  styleUrls: ['./activities-history.component.css']
})
export class ActivitiesHistoryComponent {
  readonly activityService = inject(ActivityHistoryService);
  mobileMenuOpen = false;

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Inicio', url: '/' },
    { label: 'Mi Perfil', url: '/perfil' },
    { label: 'Actividades' }
  ];

  readonly searchQuery = signal<string>('');
  readonly dateFrom = signal('');
  readonly dateTo = signal('');
  readonly sortOrder = signal<ActivitySort>('desc');

  getExperienceRoute(experienceId: string): string {
    return experienceId === 'exp_kayak_pirquitas' ? '/experiencias/kayak' : '/experiencias';
  }

  openReceipt(receipt: PaymentReceipt): void {
    this.activityService.viewReceipt(receipt);
  }

  readonly filteredActivities = computed<ActivityRecord[]>(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const from = this.dateFrom() ? new Date(`${this.dateFrom()}T00:00:00`).getTime() : null;
    const to = this.dateTo() ? new Date(`${this.dateTo()}T23:59:59`).getTime() : null;
    let list = this.activityService.activities().filter((activity) => {
      const timestamp = this.parseActivityDate(activity.dateLabel);
      return (from === null || timestamp >= from) && (to === null || timestamp <= to);
    });

    if (query) {
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(query) ||
          a.region.toLowerCase().includes(query) ||
          a.provider.name.toLowerCase().includes(query) ||
          (a.description ? a.description.toLowerCase().includes(query) : false)
      );
    }

    return [...list].sort((a, b) => {
      const difference = this.parseActivityDate(a.dateLabel) - this.parseActivityDate(b.dateLabel);
      return this.sortOrder() === 'asc' ? difference : -difference;
    });
  });

  private parseActivityDate(dateLabel: string): number {
    const match = dateLabel.match(/(\d{1,2}) de ([A-Za-zÁÉÍÓÚáéíóú]+), (\d{4})/);
    if (!match) return 0;

    const months: Record<string, number> = {
      enero: 0,
      febrero: 1,
      marzo: 2,
      abril: 3,
      mayo: 4,
      junio: 5,
      julio: 6,
      agosto: 7,
      septiembre: 8,
      octubre: 9,
      noviembre: 10,
      diciembre: 11
    };
    const month = months[match[2].toLowerCase()];
    return month === undefined ? 0 : new Date(Number(match[3]), month, Number(match[1])).getTime();
  }

  openLoginModal(): void {
    // Para el header si se necesita
  }
}
