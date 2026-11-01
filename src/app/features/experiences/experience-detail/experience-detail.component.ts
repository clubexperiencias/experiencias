import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { ExperienceService } from '../../../core/services/experience.service';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { FooterComponent } from '../../../shared/components/footer/footer.component';
import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../../shared/components/breadcrumb/breadcrumb.component';
import { ArsPipe, FechaPipe } from '../../../shared/pipes/format.pipes';

@Component({
  selector: 'app-experience-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatIconModule,
    HeaderComponent,
    FooterComponent,
    BreadcrumbComponent,
    ArsPipe,
    FechaPipe,
  ],
  templateUrl: './experience-detail.component.html',
  styleUrl: './experience-detail.component.css',
})
export class ExperienceDetailComponent {
  private readonly route = inject(ActivatedRoute);
  readonly experienceService = inject(ExperienceService);

  readonly mobileMenuOpen = signal(false);

  private readonly slug = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('slug') ?? '')),
    {
      initialValue: this.route.snapshot.paramMap.get('slug') ?? '',
    },
  );

  readonly exp = computed(() => {
    const s = this.slug();
    if (!s) return undefined;
    return this.experienceService.getPublishedExperienceBySlug(s);
  });

  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => {
    const e = this.exp();
    return [
      { label: 'Inicio', url: '/' },
      { label: 'Experiencias', url: '/experiencias' },
      { label: e?.shortTitle || e?.title || 'Detalle' },
    ];
  });

  readonly paymentRoute = computed(() => {
    const e = this.exp();
    return e ? `/experiencias/${e.slug}/pago` : '/experiencias';
  });

  toggleMobileMenu(event: Event): void {
    event.stopPropagation();
    this.mobileMenuOpen.update((v) => !v);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.mobileMenuOpen.set(false);
  }
}
