import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { ExperienceService } from './experience.service';
import { NewsletterService } from './newsletter.service';
import { Experience } from '../models/experience.model';

const FAVORITES_STORAGE_KEY = 'catamarca_user_favorites_v1';

export interface FavoriteToastInfo {
  title: string;
  slug: string;
  requireAuth?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class FavoritesService {
  private readonly experienceService = inject(ExperienceService);
  private readonly newsletter = inject(NewsletterService);

  private readonly _favoriteSlugs = signal<string[]>(this.loadStoredFavorites());
  readonly favoriteSlugs = this._favoriteSlugs.asReadonly();

  readonly lastFavoritedToast = signal<FavoriteToastInfo | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Sincronizar automáticamente con el perfil del socio cuando esté autenticado
    effect(() => {
      const member = this.newsletter.currentMember();
      if (member && Array.isArray(member.experiencesWishlist) && member.experiencesWishlist.length > 0) {
        this.mergeMemberWishlist(member.experiencesWishlist);
      }
    });
  }

  private loadStoredFavorites(): string[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const blocked = new Set(['proximamente', 'proximamente-valle-catamarca', 'exp-coming-soon', 'exp-coming-soon-catalog']);
      const filtered = parsed
        .map((s) => String(s).trim())
        .filter((s) => Boolean(s) && !blocked.has(s.toLowerCase()));
      if (filtered.length !== parsed.length) {
        this.persistFavorites(filtered);
      }
      return filtered;
    } catch {
      return [];
    }
  }

  private persistFavorites(slugs: string[]): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(slugs));
    } catch {
      // ignore
    }
  }

  private mergeMemberWishlist(wishlist: string[]): void {
    const current = this._favoriteSlugs();
    const currentLower = new Set(current.map((s) => s.toLowerCase()));
    let changed = false;
    const merged = [...current];

    for (const item of wishlist) {
      const norm = (item || '').trim();
      if (norm && !currentLower.has(norm.toLowerCase())) {
        merged.push(norm);
        currentLower.add(norm.toLowerCase());
        changed = true;
      }
    }

    if (changed) {
      this._favoriteSlugs.set(merged);
      this.persistFavorites(merged);
    }
  }

  private syncWithMemberProfile(slugs: string[]): void {
    const member = this.newsletter.currentMember();
    if (!member) return;

    // Actualiza localmente de inmediato para que no haya latencia
    const updatedMember = {
      ...member,
      experiencesWishlist: [...slugs],
    };
    this.newsletter.persistCurrentMember(updatedMember);

    // Si tiene DNI o teléfono guardados, sincroniza remotamente con Supabase
    if (member.email && (member.dni || member.documentNumber || member.phone)) {
      void this.newsletter.updateMemberProfile({
        fullName: member.fullName || '',
        dni: member.dni || member.documentNumber || '',
        phone: member.phone || '',
        experiencesWishlist: slugs,
      });
    }
  }

  isFavorite(expOrKey?: Experience | string | null): boolean {
    if (!this.newsletter.isSubscribed()) return false;
    if (!expOrKey) return false;
    if (typeof expOrKey === 'object' && expOrKey.isLocked) return false;
    const key = typeof expOrKey === 'string' ? expOrKey.trim().toLowerCase() : (expOrKey.slug || expOrKey.id || '').trim().toLowerCase();
    if (!key || key === 'proximamente' || key === 'proximamente-valle-catamarca' || key === 'exp-coming-soon' || key === 'exp-coming-soon-catalog') return false;
    return this._favoriteSlugs().some((s) => s.toLowerCase() === key);
  }

  toggleFavorite(exp: Experience, event?: Event): boolean {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (exp.isLocked) return false;

    const slug = (exp.slug || exp.id || '').trim();
    if (!slug || slug === 'proximamente' || slug === 'proximamente-valle-catamarca' || slug === 'exp-coming-soon' || slug === 'exp-coming-soon-catalog') return false;

    // Si el usuario no tiene la sesión iniciada, solicita inicio de sesión
    if (!this.newsletter.isSubscribed()) {
      this.showToast({
        title: exp.title || 'Experiencia',
        slug: exp.slug || slug,
        requireAuth: true,
      });
      return false;
    }

    const current = this._favoriteSlugs();
    const isFav = this.isFavorite(slug);
    let updated: string[];

    if (isFav) {
      // Quitar de favoritos
      updated = current.filter(
        (s) =>
          s.toLowerCase() !== slug.toLowerCase() &&
          s.toLowerCase() !== (exp.id || '').toLowerCase() &&
          s.toLowerCase() !== (exp.slug || '').toLowerCase(),
      );
      this._favoriteSlugs.set(updated);
      this.persistFavorites(updated);
      this.syncWithMemberProfile(updated);
      this.dismissToast();
      return false;
    } else {
      // Agregar a favoritos
      updated = [...current, slug];
      this._favoriteSlugs.set(updated);
      this.persistFavorites(updated);
      this.syncWithMemberProfile(updated);

      this.showToast({
        title: exp.title || 'Experiencia',
        slug: exp.slug || slug,
        requireAuth: false,
      });
      return true;
    }
  }

  removeFavorite(exp: Experience, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const slug = (exp.slug || exp.id || '').trim();
    if (!slug) return;
    const current = this._favoriteSlugs();
    const updated = current.filter(
      (s) =>
        s.toLowerCase() !== slug.toLowerCase() &&
        s.toLowerCase() !== (exp.id || '').toLowerCase() &&
        s.toLowerCase() !== (exp.slug || '').toLowerCase(),
    );
    this._favoriteSlugs.set(updated);
    this.persistFavorites(updated);
    this.syncWithMemberProfile(updated);
  }

  showToast(info: FavoriteToastInfo): void {
    this.dismissToast();
    this.lastFavoritedToast.set(info);
    this.toastTimer = setTimeout(() => {
      this.lastFavoritedToast.set(null);
      this.toastTimer = null;
    }, 6000);
  }

  dismissToast(): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
    this.lastFavoritedToast.set(null);
  }

  readonly favoriteExperiences = computed<Experience[]>(() => {
    const slugs = this._favoriteSlugs().map((s) => s.toLowerCase());
    if (slugs.length === 0) return [];

    const all = this.experienceService.experiences();
    return all.filter((exp) => {
      const expSlug = (exp.slug || '').toLowerCase();
      const expId = (exp.id || '').toLowerCase();
      return slugs.includes(expSlug) || slugs.includes(expId);
    });
  });
}

