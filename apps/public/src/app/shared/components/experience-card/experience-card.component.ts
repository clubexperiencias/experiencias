import { Component, EventEmitter, Input, Output, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Experience } from '../../../core/models/experience.model';
import { DEFAULT_CLUB_PROFILE, isClubExperience } from '../../../core/models/club-profile.model';
import { FavoritesService } from '../../../core/services/favorites.service';
import { ProviderStoreService, slugify } from '../../../core/services/provider-store.service';

export type ExperienceCardVariant = 'carousel' | 'featured-horizontal' | 'standard';
export type ExperienceCardFooterAction = 'socios' | 'fiche' | 'none';

@Component({
  selector: 'app-experience-card',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  templateUrl: './experience-card.component.html',
  styleUrl: './experience-card.component.css',
})
export class ExperienceCardComponent {
  private readonly favoritesService = inject(FavoritesService);
  private readonly providerStore = inject(ProviderStoreService, { optional: true });

  @Input({ required: true }) experience!: Experience;
  @Input() variant: ExperienceCardVariant = 'standard';
  @Input() isExpanded: boolean = false;
  @Input() footerAction: ExperienceCardFooterAction = 'socios';

  /** Optional override for isFavorite state. If omitted, FavoritesService is used. */
  @Input() isFavoriteOverride?: boolean;

  @Output() toggleDetails = new EventEmitter<Experience>();
  @Output() closeDetails = new EventEmitter<Experience>();
  @Output() favoriteToggled = new EventEmitter<{ experience: Experience; event?: Event }>();

  readonly isFavorited = computed(() => {
    if (typeof this.isFavoriteOverride === 'boolean') {
      return this.isFavoriteOverride;
    }
    if (!this.experience) return false;
    return this.favoritesService.isFavorite(this.experience);
  });

  readonly detailRoute = computed(() => {
    if (!this.experience) return ['/experiencias'];
    if (this.experience.detailRoute) return this.experience.detailRoute;
    return ['/experiencias', this.experience.slug || this.experience.id];
  });

  readonly providerSlug = computed(() => {
    const exp = this.experience;
    if (!exp) return null;
    if (exp.providerSlug) {
      return exp.providerSlug.toLowerCase().trim() === 'club'
        ? DEFAULT_CLUB_PROFILE.slug
        : exp.providerSlug;
    }
    if (isClubExperience(exp)) return DEFAULT_CLUB_PROFILE.slug;

    if (this.providerStore) {
      const providers = this.providerStore.providers();
      const expEmail = (exp.providerEmail || '').trim().toLowerCase();
      const expName = (exp.providerName || '').trim().toLowerCase();
      const expAgency = (exp.providerAgency || '').trim().toLowerCase();

      const match = providers.find((p) => {
        if (!p.slug) return false;
        if (exp.providerId && p.id === exp.providerId) return true;
        const pEmail = (p.email || '').trim().toLowerCase();
        const pName = (p.name || '').trim().toLowerCase();
        const pAgency = (p.agency || '').trim().toLowerCase();

        if (expEmail && pEmail && pEmail === expEmail) return true;
        if (expName && ((pName && pName === expName) || (pAgency && pAgency === expName))) return true;
        if (expAgency && ((pName && pAgency === expName) || (pAgency && pAgency === expAgency))) return true;
        return false;
      });

      if (match?.slug) return match.slug;
    }

    const rawName = (exp.providerName || exp.providerAgency || '').trim();
    if (rawName && rawName.toLowerCase() !== 'club de experiencias' && rawName.toLowerCase() !== 'club') {
      const fallback = rawName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
      if (fallback) return fallback;
    }
    return null;
  });

  onToggleFavorite(event?: Event): void {
    if (!this.experience) return;
    if (this.experience.isLocked) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }
    this.favoritesService.toggleFavorite(this.experience, event);
    this.favoriteToggled.emit({ experience: this.experience, event });
  }

  onToggleDetails(): void {
    this.toggleDetails.emit(this.experience);
  }

  onCloseDetails(): void {
    this.closeDetails.emit(this.experience);
  }
}
