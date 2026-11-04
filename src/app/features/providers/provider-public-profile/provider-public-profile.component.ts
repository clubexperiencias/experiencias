import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ProviderStoreService } from '../../../core/services/provider-store.service';
import { ExperienceService } from '../../../core/services/experience.service';
import { ProviderUser } from '../../../core/models/bank-transfer.model';
import { Experience } from '../../../core/models/experience.model';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { FooterComponent } from '../../../shared/components/footer/footer.component';
import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../../shared/components/breadcrumb/breadcrumb.component';
import { ArsPipe } from '../../../shared/pipes/format.pipes';

@Component({
  selector: 'app-provider-public-profile',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatIconModule,
    HeaderComponent,
    FooterComponent,
    BreadcrumbComponent,
    ArsPipe,
  ],
  templateUrl: './provider-public-profile.component.html',
  styleUrl: './provider-public-profile.component.css',
})
export class ProviderPublicProfileComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly providerStore = inject(ProviderStoreService);
  readonly expService = inject(ExperienceService);

  readonly mobileMenuOpen = signal(false);
  readonly provider = signal<ProviderUser | null>(null);
  readonly loading = signal(true);
  readonly notFound = signal(false);

  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => {
    const p = this.provider();
    return [
      { label: 'Inicio', url: '/' },
      { label: 'Experiencias', url: '/experiencias' },
      { label: 'Prestadores', url: '/prestadores' },
      { label: p ? p.agency || p.name : 'Prestador' },
    ];
  });

  readonly providerExperiences = computed<Experience[]>(() => {
    const p = this.provider();
    if (!p) return [];
    return this.expService.getExperiencesByProvider({
      slug: p.slug,
      email: p.email,
      agency: p.agency,
    });
  });

  async ngOnInit(): Promise<void> {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }

    await this.expService.remoteLoadPromise;
    const found = await this.providerStore.getPublicProvider(slug);
    if (found) {
      this.provider.set(found);
    } else {
      this.notFound.set(true);
    }
    this.loading.set(false);
  }

  formatSocialUrl(social: string | undefined): string {
    if (!social) return '#';
    const s = social.trim();
    if (s.startsWith('http://') || s.startsWith('https://')) return s;
    if (s.includes('instagram.com/')) return `https://${s}`;
    if (s.startsWith('@')) return `https://instagram.com/${s.slice(1)}`;
    return `https://${s}`;
  }

  formatWebsiteUrl(url: string | undefined): string {
    if (!url) return '#';
    const u = url.trim();
    if (u.startsWith('http://') || u.startsWith('https://')) return u;
    return `https://${u}`;
  }

  cleanWhatsApp(phone: string | undefined): string {
    if (!phone) return '';
    return phone.replace(/[^0-9]/g, '');
  }

  getInitials(name?: string): string {
    if (!name) return 'PR';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
}

