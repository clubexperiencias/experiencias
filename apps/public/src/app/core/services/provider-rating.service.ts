import { Injectable, inject, signal } from '@angular/core';
import { ProviderUser } from '../models/bank-transfer.model';
import { NewsletterService } from './newsletter.service';
import { SUPABASE_CLIENT, isSupabaseConfigured } from '../supabase/supabase.client';

const STORAGE_RATINGS_KEY = 'catamarca_provider_ratings_v2';
const VOTER_ID_KEY = 'catamarca_local_voter_id_v2';

export interface ProviderRatingData {
  score: number;
  count: number;
  userVote?: number;
}

interface StoredRatingRecord {
  baseScore: number;
  baseCount: number;
  userVotes: Record<string, number>; // voterKey -> stars (1..5)
}

@Injectable({
  providedIn: 'root',
})
export class ProviderRatingService {
  private readonly newsletter = inject(NewsletterService);
  private readonly supabase = inject(SUPABASE_CLIENT);

  private readonly ratingsMap = signal<Record<string, StoredRatingRecord>>(this.loadStoredRatings());
  readonly ratingToast = signal<string | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.ensureVoterId();
    void this.loadRemoteRatings();
  }

  private ensureVoterId(): string {
    if (typeof localStorage === 'undefined') return 'anon-voter';
    let id = localStorage.getItem(VOTER_ID_KEY);
    if (!id) {
      id = 'voter_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
      try {
        localStorage.setItem(VOTER_ID_KEY, id);
      } catch {}
    }
    return id;
  }

  private getCurrentVoterKey(): string {
    const member = this.newsletter.currentMember();
    if (member?.email) {
      return 'user:' + member.email.trim().toLowerCase();
    }
    return 'anon:' + this.ensureVoterId();
  }

  private getProviderKey(p: ProviderUser | { slug?: string; id?: string; email?: string }): string {
    if (p.slug && p.slug.trim()) return p.slug.trim().toLowerCase();
    if (p.id && p.id.trim()) return p.id.trim().toLowerCase();
    if (p.email && p.email.trim()) return p.email.trim().toLowerCase();
    return 'unknown-provider';
  }

  private loadStoredRatings(): Record<string, StoredRatingRecord> {
    if (typeof localStorage === 'undefined') return {};
    try {
      const raw = localStorage.getItem(STORAGE_RATINGS_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  }

  private persistRatings(map: Record<string, StoredRatingRecord>): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_RATINGS_KEY, JSON.stringify(map));
    } catch {}
  }

  async loadRemoteRatings(): Promise<void> {
    if (!isSupabaseConfigured()) return;
    try {
      const { data, error } = await (this.supabase.from('prestadores') as any)
        .select('id, slug, email, rating_score, rating_count')
        .eq('active', true);

      if (!error && Array.isArray(data)) {
        const current = { ...this.ratingsMap() };
        for (const row of data) {
          const score = row.rating_score !== null && row.rating_score !== undefined
            ? Number(row.rating_score)
            : 5.0;
          const count = row.rating_count !== null && row.rating_count !== undefined
            ? Number(row.rating_count)
            : 0;

          const aliases = [row.slug, row.id, row.email]
            .filter((v): v is string => Boolean(v && v.trim()))
            .map((v) => v.toLowerCase().trim());

          for (const alias of aliases) {
            const existing = current[alias] || { baseScore: score, baseCount: count, userVotes: {} };
            existing.baseScore = score;
            existing.baseCount = count;
            current[alias] = existing;
          }
        }
        this.ratingsMap.set(current);
        this.persistRatings(current);
      }

      // Si hay socio activo, verificar si ya emitió votos en la base de datos
      const member = this.newsletter.currentMember();
      if (member?.email) {
        const { data: userVotesRows } = await (this.supabase as any)
          .from('calificaciones_prestadores')
          .select('prestador_id, score')
          .eq('socio_email', member.email.trim().toLowerCase());

        if (Array.isArray(userVotesRows) && userVotesRows.length > 0) {
          const voterKey = 'user:' + member.email.trim().toLowerCase();
          const current = { ...this.ratingsMap() };
          for (const uv of userVotesRows) {
            const pIdKey = (uv.prestador_id || '').toLowerCase().trim();
            if (pIdKey && current[pIdKey]) {
              current[pIdKey].userVotes = {
                ...(current[pIdKey].userVotes || {}),
                [voterKey]: Number(uv.score),
              };
            }
          }
          this.ratingsMap.set(current);
        }
      }
    } catch (err) {
      console.warn('[ProviderRatingService] Error sincronizando calificaciones desde Supabase:', err);
    }
  }

  getRating(provider: ProviderUser | { slug?: string; id?: string; email?: string; ratingScore?: number; ratingCount?: number }): ProviderRatingData {
    const key = this.getProviderKey(provider);
    const map = this.ratingsMap();
    const stored = map[key];

    // Si el prestador trae rating_score y rating_count desde la base de datos de Supabase, usarlos de fuente directa
    const rawScore = (provider as any).ratingScore ?? stored?.baseScore ?? 5.0;
    const rawCount = (provider as any).ratingCount ?? stored?.baseCount ?? 0;

    const baseScore = typeof rawScore === 'number' && !isNaN(rawScore) ? rawScore : 5.0;
    const baseCount = typeof rawCount === 'number' && !isNaN(rawCount) ? rawCount : 0;
    const userVotes = stored?.userVotes || {};

    const voterKey = this.getCurrentVoterKey();
    const currentUserVote = userVotes[voterKey];

    // Si existen votos locales que aún no se reflejan en el conteo remoto
    const extraLocalVotes = Object.entries(userVotes).filter(([vk]) => vk !== voterKey).map(([, stars]) => stars);
    const totalCount = baseCount + (currentUserVote !== undefined && baseCount === 0 ? 1 : 0) + extraLocalVotes.length;

    let finalScore = baseScore;
    if (totalCount > 0 && baseCount === 0 && currentUserVote !== undefined) {
      finalScore = currentUserVote;
    } else if (totalCount > 0) {
      finalScore = Math.min(5.0, Math.max(1.0, Math.round(baseScore * 10) / 10));
    }

    return {
      score: finalScore,
      count: totalCount,
      userVote: currentUserVote,
    };
  }

  getUserVote(provider: ProviderUser | { slug?: string; id?: string; email?: string }): number {
    return this.getRating(provider).userVote || 0;
  }

  async rateProvider(
    provider: ProviderUser | { slug?: string; id?: string; agency?: string; name?: string; email?: string },
    stars: number,
  ): Promise<ProviderRatingData> {
    const cleanStars = Math.min(5, Math.max(1, Math.round(stars)));
    const key = this.getProviderKey(provider);
    const voterKey = this.getCurrentVoterKey();
    const member = this.newsletter.currentMember();
    const userEmail = member?.email ? member.email.trim().toLowerCase() : null;

    // 1. Si Supabase está disponible, registrar calificación mediante la RPC segura
    if (isSupabaseConfigured() && provider.id) {
      try {
        const { error } = await (this.supabase as any).rpc('submit_prestador_rating', {
          p_provider_id: provider.id,
          p_score: cleanStars,
          p_comentario: '',
          p_socio_email: userEmail,
        });

        if (error) {
          const msg = error.message || 'No se pudo registrar la calificación.';
          this.showToast(msg);
          return this.getRating(provider);
        }
      } catch (rpcErr: any) {
        console.warn('[ProviderRatingService] RPC submit_prestador_rating error:', rpcErr);
      }
    }

    // 2. Actualizar estado reactivo local
    const currentMap = { ...this.ratingsMap() };
    const existing = currentMap[key] || {
      baseScore: cleanStars,
      baseCount: 0,
      userVotes: {},
    };

    const updatedUserVotes = {
      ...existing.userVotes,
      [voterKey]: cleanStars,
    };

    currentMap[key] = {
      ...existing,
      userVotes: updatedUserVotes,
    };

    this.ratingsMap.set(currentMap);
    this.persistRatings(currentMap);

    const providerName = provider.agency || provider.name || 'al prestador';
    this.showToast(`¡Calificaste a ${providerName} con ${cleanStars} ${cleanStars === 1 ? 'estrella' : 'estrellas'}!`);

    // 3. Recargar en segundo plano calificaciones remotas para sincronizar el cálculo exacto del trigger
    void this.loadRemoteRatings();

    return this.getRating(provider);
  }

  showToast(msg: string): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.ratingToast.set(msg);
    this.toastTimer = setTimeout(() => {
      this.ratingToast.set(null);
      this.toastTimer = null;
    }, 4500);
  }
}
