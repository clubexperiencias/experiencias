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
  committedVotes?: Record<string, number>; // voterKey -> stars (restaurados o confirmados en DB)
  pendingVotes?: Record<string, number>; // voterKey -> stars (pendientes no incluidos en conteo remoto)
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
      if (typeof parsed !== 'object' || parsed === null) return {};

      for (const key of Object.keys(parsed)) {
        const item = parsed[key];
        if (item && typeof item === 'object') {
          item.userVotes = item.userVotes || {};
          if (!item.committedVotes && !item.pendingVotes) {
            // Migración desde datos existentes: si baseCount era 0 y había votos, eran pendientes locales;
            // de lo contrario ya estaban incluidos en baseCount
            if ((item.baseCount || 0) === 0 && Object.keys(item.userVotes).length > 0) {
              item.pendingVotes = { ...item.userVotes };
              item.committedVotes = {};
            } else {
              item.committedVotes = { ...item.userVotes };
              item.pendingVotes = {};
            }
          } else {
            item.committedVotes = item.committedVotes || {};
            item.pendingVotes = item.pendingVotes || {};
          }
        }
      }
      return parsed;
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

      const idToAliases: Record<string, string[]> = {};

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

          // Combinar votos existentes de cualquier alias conocido para no perder estado previo
          const mergedUserVotes: Record<string, number> = {};
          const mergedCommittedVotes: Record<string, number> = {};
          const mergedPendingVotes: Record<string, number> = {};

          for (const alias of aliases) {
            const existing = current[alias];
            if (existing) {
              if (existing.userVotes) Object.assign(mergedUserVotes, existing.userVotes);
              if (existing.committedVotes) Object.assign(mergedCommittedVotes, existing.committedVotes);
              if (existing.pendingVotes) Object.assign(mergedPendingVotes, existing.pendingVotes);
            }
          }

          // Un solo registro canónico compartido por todos los alias (slug, id, email)
          const canonicalRecord: StoredRatingRecord = {
            baseScore: score,
            baseCount: count,
            userVotes: mergedUserVotes,
            committedVotes: mergedCommittedVotes,
            pendingVotes: mergedPendingVotes,
          };

          for (const alias of aliases) {
            idToAliases[alias] = aliases;
            current[alias] = canonicalRecord;
          }
        }
        this.ratingsMap.set(current);
        this.persistRatings(current);
      }

      // Si hay socio activo, verificar si ya emitió votos en la base de datos de forma segura
      const member = this.newsletter.currentMember();
      if (member?.email) {
        let userVotesRows: any[] | null = null;
        try {
          const { data: rpcVotes, error: rpcErr } = await (this.supabase as any).rpc('get_my_provider_ratings');
          if (!rpcErr && Array.isArray(rpcVotes)) {
            userVotesRows = rpcVotes;
          }
        } catch {
          // Fallback seguro
        }

        if (Array.isArray(userVotesRows) && userVotesRows.length > 0) {
          const voterKey = 'user:' + member.email.trim().toLowerCase();
          const current = { ...this.ratingsMap() };
          for (const uv of userVotesRows) {
            const pIdKey = (uv.prestador_id || '').toLowerCase().trim();
            const scoreNum = Number(uv.score);
            const aliases = (pIdKey && idToAliases[pIdKey]) ? idToAliases[pIdKey] : [pIdKey];

            // Obtener o crear el registro canónico para este prestador
            let canonical = aliases.map((a) => current[a]).find((rec): rec is StoredRatingRecord => Boolean(rec));
            if (!canonical) {
              canonical = {
                baseScore: scoreNum,
                baseCount: 1,
                userVotes: {},
                committedVotes: {},
                pendingVotes: {},
              };
            }

            canonical.committedVotes = {
              ...(canonical.committedVotes || {}),
              [voterKey]: scoreNum,
            };
            canonical.userVotes = {
              ...(canonical.userVotes || {}),
              [voterKey]: scoreNum,
            };
            // Excluir de pendingVotes los votos confirmados/restaurados para evitar doble conteo
            if (canonical.pendingVotes && canonical.pendingVotes[voterKey] !== undefined) {
              const nextPending = { ...canonical.pendingVotes };
              delete nextPending[voterKey];
              canonical.pendingVotes = nextPending;
            }

            // Actualizar todos los alias (incluyendo slug y UUID) con el mismo registro canónico
            for (const alias of aliases) {
              if (alias) {
                current[alias] = canonical;
              }
            }
          }
          this.ratingsMap.set(current);
          this.persistRatings(current);
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

    // Los agregados refrescados por loadRemoteRatings (stored) tienen precedencia sobre los valores instantáneos retenidos en provider
    const rawScore = stored?.baseScore ?? (provider as any).ratingScore ?? 5.0;
    const rawCount = stored?.baseCount ?? (provider as any).ratingCount ?? 0;

    const baseScore = typeof rawScore === 'number' && !isNaN(rawScore) ? rawScore : 5.0;
    const baseCount = typeof rawCount === 'number' && !isNaN(rawCount) ? rawCount : 0;

    const committedVotes = stored?.committedVotes || stored?.userVotes || {};
    const pendingVotes = stored?.pendingVotes || {};
    const userVotes = stored?.userVotes || {};

    const voterKey = this.getCurrentVoterKey();
    const currentUserVote = pendingVotes[voterKey] ?? committedVotes[voterKey] ?? userVotes[voterKey];

    // Calcular el conteo utilizando únicamente votos pendientes aún no incluidos en el conteo remoto
    // Excluyendo votos restaurados o confirmados para evitar duplicar el conteo
    const uncommittedPendingVotes = Object.entries(pendingVotes).filter(
      ([vk]) => committedVotes[vk] === undefined,
    );
    const pendingDelta = uncommittedPendingVotes.length;
    const totalCount = baseCount + pendingDelta + (baseCount === 0 && pendingDelta === 0 && currentUserVote !== undefined ? 1 : 0);

    let finalScore = baseScore;
    if (totalCount > 0 && baseCount === 0 && pendingDelta > 0) {
      const sum = uncommittedPendingVotes.reduce((acc, [, s]) => acc + s, 0);
      finalScore = Math.min(5.0, Math.max(1.0, Math.round((sum / pendingDelta) * 10) / 10));
    } else if (totalCount > 0 && baseCount === 0 && currentUserVote !== undefined) {
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
    if (isSupabaseConfigured()) {
      let targetProviderUuid: string | null = null;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (provider.id && uuidRegex.test(provider.id)) {
        targetProviderUuid = provider.id;
      } else if (provider.email || provider.slug) {
        try {
          let q = (this.supabase as any).from('prestadores').select('id');
          if (provider.email) {
            q = q.eq('email', provider.email.trim().toLowerCase());
          } else if (provider.slug) {
            q = q.eq('slug', provider.slug.trim().toLowerCase());
          }
          const { data: pRow } = await q.maybeSingle();
          if (pRow?.id && uuidRegex.test(pRow.id)) {
            targetProviderUuid = pRow.id;
          }
        } catch (fetchErr) {
          console.warn('[ProviderRatingService] Error resolviendo UUID del prestador:', fetchErr);
        }
      }

      if (targetProviderUuid) {
        try {
          const { error } = await (this.supabase as any).rpc('submit_prestador_rating', {
            p_provider_id: targetProviderUuid,
            p_score: cleanStars,
            p_comentario: '',
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
    }

    // 2. Actualizar estado reactivo local manteniendo votos pendientes separados de confirmados
    const currentMap = { ...this.ratingsMap() };
    const existing = currentMap[key] || {
      baseScore: cleanStars,
      baseCount: 0,
      userVotes: {},
      committedVotes: {},
      pendingVotes: {},
    };

    const updatedUserVotes = {
      ...(existing.userVotes || {}),
      [voterKey]: cleanStars,
    };

    const updatedPendingVotes = {
      ...(existing.pendingVotes || {}),
      [voterKey]: cleanStars,
    };

    currentMap[key] = {
      ...existing,
      userVotes: updatedUserVotes,
      pendingVotes: updatedPendingVotes,
    };

    // Propagar a aliases conocidos si existen en el objeto provider
    const aliases = [provider.id, provider.slug, provider.email]
      .filter((v): v is string => Boolean(v && v.trim()))
      .map((v) => v.toLowerCase().trim());

    for (const alias of aliases) {
      currentMap[alias] = currentMap[key];
    }

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
