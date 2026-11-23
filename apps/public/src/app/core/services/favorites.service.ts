import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs';
import { ExperienceService } from './experience.service';
import { NewsletterService } from './newsletter.service';
import { Experience } from '../models/experience.model';
import { SURVEY_INTEREST_KEYS } from '../models/waitlist.model';
import { SUPABASE_CLIENT } from '../supabase/supabase.client';

export const FAVORITES_STORAGE_KEY = 'catamarca_user_favorites_v1';
export const FAVORITES_REMOVED_STORAGE_KEY = 'catamarca_user_favorites_removed_v1';

export interface FavoriteToastInfo {
  title: string;
  slug: string;
  requireAuth?: boolean;
  action?: 'added' | 'removed';
  heading?: string;
  message?: string;
}

@Injectable({
  providedIn: 'root',
})
export class FavoritesService {
  private readonly experienceService = inject(ExperienceService);
  private readonly newsletter = inject(NewsletterService);
  private readonly supabase = inject(SUPABASE_CLIENT, { optional: true });
  private readonly router = inject(Router, { optional: true });

  private activeMemberIdentity: string | null = (() => {
    const member = this.newsletter.currentMember();
    return member ? (member.email || member.id || '').trim().toLowerCase() : null;
  })();

  private readonly _favoriteSlugs = signal<string[]>(
    this.activeMemberIdentity ? this.loadStoredFavorites(this.activeMemberIdentity) : [],
  );
  readonly favoriteSlugs = this._favoriteSlugs.asReadonly();

  private readonly _removedSlugs = signal<Set<string>>(
    this.activeMemberIdentity ? this.loadStoredRemoved(this.activeMemberIdentity) : new Set(),
  );

  readonly lastFavoritedToast = signal<FavoriteToastInfo | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private lastMergedMemberIdentity: string | null = null;

  constructor() {
    // Sincronizar automáticamente con el perfil del socio cuando esté autenticado.
    // Se ejecuta una sola vez por identidad de socio para preservar el comportamiento
    // de inicialización sin re-agregar favoritos eliminados ante cambios posteriores.
    effect(() => {
      const member = this.newsletter.currentMember();
      const memberIdentity = member ? (member.email || member.id || '').trim().toLowerCase() : null;

      // Si no hay socio autenticado, limpiar la lista en memoria
      if (!member || !memberIdentity) {
        if (this.activeMemberIdentity !== null || this._favoriteSlugs().length > 0) {
          this.activeMemberIdentity = null;
          this.lastMergedMemberIdentity = null;
          untracked(() => {
            this._favoriteSlugs.set([]);
            this._removedSlugs.set(new Set());
          });
        }
        return;
      }

      // Si cambió el socio autenticado, recargar la lista en memoria para el nuevo socio
      if (memberIdentity !== this.activeMemberIdentity) {
        this.activeMemberIdentity = memberIdentity;
        this.lastMergedMemberIdentity = null;
        untracked(() => {
          const stored = this.loadStoredFavorites(memberIdentity);
          const removed = this.loadStoredRemoved(memberIdentity);
          this._favoriteSlugs.set(stored);
          this._removedSlugs.set(removed);
        });
      }

      // Fusionar una sola vez la wishlist remota del socio con sus favoritos locales
      if (memberIdentity !== this.lastMergedMemberIdentity) {
        this.lastMergedMemberIdentity = memberIdentity;
        const wishlist = member.experiencesWishlist;
        if (Array.isArray(wishlist) && wishlist.length > 0) {
          untracked(() => {
            this.mergeMemberWishlist(wishlist, memberIdentity);
          });
        }
      }
    });

    // Cerrar la notificación al cambiar de ruta
    if (this.router) {
      this.router.events
        .pipe(filter((event): event is NavigationStart => event instanceof NavigationStart))
        .subscribe(() => {
          this.dismissToast();
        });
    }

    // Cerrar la notificación al cambiar de tab o minimizar el navegador
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.dismissToast();
        }
      });
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('blur', () => {
        this.dismissToast();
      });
    }
  }

  private getFavoritesStorageKey(identity?: string | null): string | null {
    const target = identity !== undefined ? identity : this.activeMemberIdentity;
    const norm = (target || '').trim().toLowerCase();
    return norm ? `${FAVORITES_STORAGE_KEY}_${norm}` : null;
  }

  private getRemovedStorageKey(identity?: string | null): string | null {
    const target = identity !== undefined ? identity : this.activeMemberIdentity;
    const norm = (target || '').trim().toLowerCase();
    return norm ? `${FAVORITES_REMOVED_STORAGE_KEY}_${norm}` : null;
  }

  private isGenuineExperience(slugOrId: string): boolean {
    const norm = (slugOrId || '').trim().toLowerCase();
    if (!norm) return false;
    const all = this.experienceService.experiences();
    if (Array.isArray(all) && all.length > 0) {
      const found = all.some((e) => {
        const expSlug = (e.slug || '').trim().toLowerCase();
        const expId = (e.id || '').trim().toLowerCase();
        const initialSlug = (e.initialSlug || '').trim().toLowerCase();
        const hasAlias =
          Array.isArray(e.slugAliases) &&
          e.slugAliases.some((a) => (a || '').trim().toLowerCase() === norm);
        return (
          expSlug === norm ||
          expId === norm ||
          initialSlug === norm ||
          hasAlias ||
          expId === `exp-${norm}` ||
          norm === `exp-${expSlug}`
        );
      });
      if (found) return true;
    }
    return Boolean(this.experienceService.getExperienceBySlug?.(norm));
  }

  private isSurveyOnly(slugOrId: string): boolean {
    const norm = (slugOrId || '').trim().toLowerCase();
    if (!norm) return false;
    return SURVEY_INTEREST_KEYS.has(norm) && !this.isGenuineExperience(norm);
  }

  private loadStoredFavorites(identity?: string | null): string[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const key = this.getFavoritesStorageKey(identity);
      if (!key) return [];
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const blocked = new Set(['proximamente', 'proximamente-valle-catamarca', 'exp-coming-soon', 'exp-coming-soon-catalog']);
      const filtered = parsed
        .map((s) => String(s).trim())
        .filter((s) => {
          if (!s) return false;
          const lower = s.toLowerCase();
          if (blocked.has(lower)) return false;
          if (this.isSurveyOnly(lower)) return false;
          return true;
        });
      if (filtered.length !== parsed.length) {
        this.persistFavorites(filtered, identity);
      }
      return filtered;
    } catch {
      return [];
    }
  }

  private persistFavorites(slugs: string[], identity?: string | null): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const key = this.getFavoritesStorageKey(identity);
      if (!key) return;
      localStorage.setItem(key, JSON.stringify(slugs));
    } catch {
      // ignore
    }
  }

  private loadStoredRemoved(identity?: string | null): Set<string> {
    if (typeof localStorage === 'undefined') return new Set();
    try {
      const key = this.getRemovedStorageKey(identity);
      if (!key) return new Set();
      const raw = localStorage.getItem(key);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return new Set();
      return new Set(parsed.map((s) => String(s).trim().toLowerCase()).filter(Boolean));
    } catch {
      return new Set();
    }
  }

  private persistRemoved(set: Set<string>, identity?: string | null): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const key = this.getRemovedStorageKey(identity);
      if (!key) return;
      localStorage.setItem(key, JSON.stringify(Array.from(set)));
    } catch {
      // ignore
    }
  }

  private recordRemoval(slugOrId: string): void {
    const norm = (slugOrId || '').trim().toLowerCase();
    if (!norm) return;
    const set = new Set(this._removedSlugs());
    set.add(norm);
    this._removedSlugs.set(set);
    this.persistRemoved(set, this.activeMemberIdentity);
  }

  private clearRemoval(slugOrId: string): void {
    const norm = (slugOrId || '').trim().toLowerCase();
    if (!norm) return;
    const set = new Set(this._removedSlugs());
    if (set.delete(norm)) {
      this._removedSlugs.set(set);
      this.persistRemoved(set, this.activeMemberIdentity);
    }
  }

  private mergeMemberWishlist(wishlist: string[], identity?: string | null): void {
    const current = this._favoriteSlugs();
    const cleanCurrent = current.filter((s) => !this.isSurveyOnly(s));
    const currentLower = new Set(cleanCurrent.map((s) => s.toLowerCase()));
    const removed = this._removedSlugs();
    let changed = cleanCurrent.length !== current.length;
    const merged = [...cleanCurrent];

    for (const item of wishlist) {
      const norm = (item || '').trim();
      const normLower = norm.toLowerCase();
      if (!norm) continue;

      // Ignorar opciones genéricas de la encuesta de registro a menos que representen una experiencia genuina
      if (this.isSurveyOnly(normLower)) {
        continue;
      }

      // Si el socio eliminó explícitamente esta experiencia de favoritos, no re-agregarla
      if (removed.has(normLower)) {
        continue;
      }

      if (!currentLower.has(normLower)) {
        merged.push(norm);
        currentLower.add(normLower);
        changed = true;
      }
    }

    if (changed) {
      this._favoriteSlugs.set(merged);
      this.persistFavorites(merged, identity !== undefined ? identity : this.activeMemberIdentity);
    }
  }

  private syncWithMemberProfile(slugs: string[]): void {
    const member = this.newsletter.currentMember();
    if (!member) return;

    const currentIdentity = (member.email || member.id || '').trim().toLowerCase();
    // Prevenir escribir los favoritos de un socio anterior al perfil de un nuevo socio
    if (!currentIdentity || currentIdentity !== (this.activeMemberIdentity || '')) {
      return;
    }

    // Actualiza el perfil en memoria y en localStorage sincrónicamente
    this.newsletter.updateCurrentMemberWishlist([...slugs]);

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
    if (this.isSurveyOnly(key)) return false;
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
      this.recordRemoval(slug);
      if (exp.id && exp.id !== slug) this.recordRemoval(exp.id);

      updated = current.filter(
        (s) =>
          s.toLowerCase() !== slug.toLowerCase() &&
          s.toLowerCase() !== (exp.id || '').toLowerCase() &&
          s.toLowerCase() !== (exp.slug || '').toLowerCase(),
      );
      this._favoriteSlugs.set(updated);
      this.persistFavorites(updated);
      this.syncWithMemberProfile(updated);
      this.callToggleRemoteFavorite(this.resolveExperienceId(exp));
      this.showToast({
        title: exp.title || 'Experiencia',
        slug: exp.slug || slug,
        requireAuth: false,
        action: 'removed',
      });
      return false;
    } else {
      // Agregar a favoritos
      this.clearRemoval(slug);
      if (exp.id && exp.id !== slug) this.clearRemoval(exp.id);

      updated = [...current, slug];
      this._favoriteSlugs.set(updated);
      this.persistFavorites(updated);
      this.syncWithMemberProfile(updated);
      this.callToggleRemoteFavorite(this.resolveExperienceId(exp));

      this.showToast({
        title: exp.title || 'Experiencia',
        slug: exp.slug || slug,
        requireAuth: false,
        action: 'added',
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
    this.recordRemoval(slug);
    if (exp.id && exp.id !== slug) this.recordRemoval(exp.id);

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
    this.callToggleRemoteFavorite(this.resolveExperienceId(exp));

    this.showToast({
      title: exp.title || 'Experiencia',
      slug: exp.slug || slug,
      requireAuth: false,
      action: 'removed',
    });
  }

  private resolveExperienceId(exp: Experience | string): string {
    const rawSlugOrId = typeof exp === 'string' ? exp.trim() : (exp.slug || exp.id || '').trim();
    const rawLower = rawSlugOrId.toLowerCase();
    const match = this.experienceService.experiences().find(
      (e) => (e.slug || '').toLowerCase() === rawLower || (e.id || '').toLowerCase() === rawLower,
    );
    if (match?.id) {
      return match.id.trim();
    }
    if (typeof exp === 'object' && exp?.id) {
      return exp.id.trim();
    }
    return rawSlugOrId;
  }

  private callToggleRemoteFavorite(targetId: string): void {
    if (!this.supabase || !this.newsletter.isSubscribed() || !targetId) return;

    void (async () => {
      try {
        const { data, error } = await (this.supabase as any).rpc('toggle_experiencia_favorita', {
          p_experience_id: targetId,
        });
        if (!error && data && typeof data.favorites_count === 'number') {
          this.experienceService.updateFavoritesCount(targetId, data.favorites_count);
        }
      } catch (err) {
        console.warn('[FavoritesService] Error calling toggle_experiencia_favorita:', err);
      }
    })();
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
    const slugs = this._favoriteSlugs()
      .map((s) => s.toLowerCase())
      .filter((s) => !this.isSurveyOnly(s));
    if (slugs.length === 0) return [];

    const all = this.experienceService.experiences();
    return all.filter((exp) => {
      const expSlug = (exp.slug || '').toLowerCase();
      const expId = (exp.id || '').toLowerCase();
      return slugs.includes(expSlug) || slugs.includes(expId);
    });
  });
}

