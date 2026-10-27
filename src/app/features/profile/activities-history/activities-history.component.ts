import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ActivityHistoryService } from '../../../core/services/activity-history.service';
import { ActivityRecord } from '../../../core/models/activity-history.model';
import { BreadcrumbComponent, BreadcrumbItem } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { FooterComponent } from '../../../shared/components/footer/footer.component';

export type ActivityFilter = 'all' | 'completada' | 'confirmada';

@Component({
  selector: 'app-activities-history',
  standalone: true,
  imports: [CommonModule, RouterLink, BreadcrumbComponent, HeaderComponent, FooterComponent],
  templateUrl: './activities-history.component.html',
  styleUrls: ['./activities-history.component.css']
})
export class ActivitiesHistoryComponent {
  readonly activityService = inject(ActivityHistoryService);
  mobileMenuOpen = false;

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Inicio', url: '/' },
    { label: 'Mi Perfil', url: '/perfil' },
    { label: 'Historial de Actividades' }
  ];

  readonly selectedFilter = signal<ActivityFilter>('all');
  readonly searchQuery = signal<string>('');

  readonly completedCount = computed(() =>
    this.activityService.activities().filter((a) => a.status === 'completada').length
  );

  readonly confirmedCount = computed(() =>
    this.activityService.activities().filter((a) => a.status === 'confirmada').length
  );

  readonly filteredActivities = computed<ActivityRecord[]>(() => {
    const filter = this.selectedFilter();
    const query = this.searchQuery().trim().toLowerCase();
    let list = this.activityService.activities();

    if (filter !== 'all') {
      list = list.filter((a) => a.status === filter);
    }

    if (query) {
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(query) ||
          a.region.toLowerCase().includes(query) ||
          a.provider.name.toLowerCase().includes(query) ||
          (a.description ? a.description.toLowerCase().includes(query) : false)
      );
    }

    return list;
  });

  setFilter(filter: ActivityFilter): void {
    this.selectedFilter.set(filter);
  }

  openLoginModal(): void {
    // Para el header si se necesita
  }
}
