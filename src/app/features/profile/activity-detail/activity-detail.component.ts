import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ActivityHistoryService } from '../../../core/services/activity-history.service';
import { ActivityRecord } from '../../../core/models/activity-history.model';
import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../../shared/components/breadcrumb/breadcrumb.component';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { FooterComponent } from '../../../shared/components/footer/footer.component';

@Component({
  selector: 'app-activity-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    BreadcrumbComponent,
    HeaderComponent,
    FooterComponent,
  ],
  templateUrl: './activity-detail.component.html',
  styleUrls: ['./activity-detail.component.css'],
})
export class ActivityDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  readonly activityService = inject(ActivityHistoryService);

  mobileMenuOpen = false;
  readonly slug = signal<string>('');

  // Actividad reactiva
  readonly activity = computed<ActivityRecord | undefined>(() => {
    return this.activityService.getActivityBySlug(this.slug());
  });

  // Breadcrumbs reactivos
  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => {
    const act = this.activity();
    return [
      { label: 'Inicio', url: '/' },
      { label: 'Mi Perfil', url: '/perfil' },
      { label: 'Actividades', url: '/perfil/actividades' },
      { label: act ? act.title : 'Detalle de Actividad' },
    ];
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const s = params.get('slug');
      if (s) {
        this.slug.set(s);
      }
    });
  }

  printReceipt(): void {
    window.print();
  }

  openLoginModal(): void {}
}
