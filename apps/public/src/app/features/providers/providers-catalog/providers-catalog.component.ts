import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { BreadcrumbComponent, BreadcrumbItem } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { FooterComponent } from '../../../shared/components/footer/footer.component';
import { FounderAdComponent } from '../../../shared/components/founder-ad/founder-ad.component';
import { ProviderStoreService } from '../../../core/services/provider-store.service';
import { ExperienceService } from '../../../core/services/experience.service';
import { NewsletterService } from '../../../core/services/newsletter.service';
import { ProviderUser } from '../../../core/models/bank-transfer.model';
import { getSocialHandle } from '../../../shared/utils/social-url.util';

@Component({
  selector: 'app-providers-catalog',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    MatIconModule,
    HeaderComponent,
    BreadcrumbComponent,
    FooterComponent,
    FounderAdComponent,
  ],
  templateUrl: './providers-catalog.component.html',
  styleUrl: './providers-catalog.component.css',
})
export class ProvidersCatalogComponent implements OnInit {
  private readonly providerStore = inject(ProviderStoreService);
  private readonly expService = inject(ExperienceService);
  readonly newsletter = inject(NewsletterService);

  readonly mobileMenuOpen = signal(false);
  readonly loading = signal(true);
  readonly providers = signal<ProviderUser[]>([]);
  readonly searchQuery = signal('');

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Inicio', url: '/' },
    { label: 'Prestadores' },
  ];

  readonly filteredProviders = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const list = this.providers();
    if (!q) return list;

    return list.filter((p) => {
      const name = (p.name || '').toLowerCase();
      const agency = (p.agency || '').toLowerCase();
      const bio = (p.bio || '').toLowerCase();
      const slug = (p.slug || '').toLowerCase();
      return name.includes(q) || agency.includes(q) || bio.includes(q) || slug.includes(q);
    });
  });

  async ngOnInit(): Promise<void> {
    try {
      await this.expService.remoteLoadPromise;
    } catch {
      // Continuar con carga de prestadores si falla la carga remota de experiencias
    }

    try {
      const list = await this.providerStore.getPublicProviders();
      this.providers.set(list);
    } catch (err) {
      console.warn('[ProvidersCatalog] Error cargando prestadores públicos:', err);
    } finally {
      this.loading.set(false);
    }
  }

  getExperiencesCount(p: ProviderUser): number {
    return this.expService.getExperiencesByProvider({
      slug: p.slug,
      email: p.email,
      agency: p.agency,
    }).length;
  }

  getProviderSlug(p: ProviderUser): string {
    return p.slug || p.id;
  }

  cleanSocialUrl(social: string | undefined): string {
    if (!social) return '#';
    const s = social.trim();
    if (s.startsWith('http://') || s.startsWith('https://')) return s;
    return `https://${s}`;
  }

  socialHandle(social: string | undefined): string {
    if (!social) return '';
    const clean = social.trim();
    if (clean.toLowerCase().includes('facebook.com/share') || clean.toLowerCase() === '@share') {
      return 'Red Social Secundaria';
    }
    return getSocialHandle(this.cleanSocialUrl(social));
  }

  resetSearch(): void {
    this.searchQuery.set('');
  }
}

