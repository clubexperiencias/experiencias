import { Injectable, DestroyRef, signal, computed, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MembershipTier, WaitlistEntry, WaitlistSubmissionDto, WaitlistStats } from '../models/waitlist.model';
import { DiscountCode } from '../models/bank-transfer.model';
import { SUPABASE_CLIENT, isSupabaseConfigured } from '../supabase/supabase.client';
import { NotificationService } from './notification.service';
import { environment } from '../../../environments/environment';

const STORAGE_KEY = 'catamarca_club_waitlist';
const SUBSCRIBED_KEY = 'catamarca_club_user_subscribed';
const SPOTS_KEY = 'catamarca_club_reserved_spots';
const USED_MEMBER_DISCOUNTS_KEY = 'catamarca_club_used_member_discounts';
const PROSPECT_EMAIL_KEY = 'catamarca_club_prospect_email';
export const AUTH_RETURN_URL_KEY = 'ce_auth_return_url';
export const AUTH_RETURN_URL_EXPIRY_MS = 30 * 60 * 1000; // 30 minutos de vigencia para el flujo de autenticación
export const AUTH_SUCCESS_FEEDBACK_DURATION_MS = 3000;

function addMonthsClamped(baseDate: Date, months: number): Date {
  const targetMonthIndex = baseDate.getMonth() + months;
  const targetYear = baseDate.getFullYear() + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDayOfTargetMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  const clampedDay = Math.min(baseDate.getDate(), lastDayOfTargetMonth);
  return new Date(
    targetYear,
    normalizedMonth,
    clampedDay,
    baseDate.getHours(),
    baseDate.getMinutes(),
    baseDate.getSeconds(),
    baseDate.getMilliseconds(),
  );
}

function mapDbRowToEntry(row: any): WaitlistEntry {
  const rawTier = (row.membership_tier || 'emergente') as MembershipTier;
  const plenoExpiresAt: string | null = row.pleno_expires_at || null;
  const isExpiredPleno =
    (rawTier === 'activo' || (rawTier as string) === 'pleno') &&
    Boolean(plenoExpiresAt) &&
    Number.isFinite(Date.parse(plenoExpiresAt!)) &&
    Date.parse(plenoExpiresAt!) <= Date.now();

  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name || undefined,
    dni: row.dni || undefined,
    documentNumber: row.dni || undefined,
    phone: row.phone || undefined,
    experiencesWishlist: Array.isArray(row.experiences_wishlist) ? row.experiences_wishlist : [],
    experiencesOther: row.experiences_other || undefined,
    position: row.position,
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    status: 'confirmed',
    source: 'web_minimal_landing',
    membershipTier: isExpiredPleno ? 'emergente' : rawTier,
    plenoActivatedAt: row.pleno_activated_at || null,
    plenoExpiresAt,
    plenoDiscountCode: row.pleno_discount_code || null,
    authUserId: row.auth_user_id || undefined,
    googleLinked: Boolean(row.auth_user_id),
    registrationToken: row.registration_token || undefined,
  };
}

/**
 * NewsletterService — Conexión a Supabase (esquema canónico unificado en tabla socios)
 *
 * Registros de prospectos de waitlist y socios oficiales gestionados sobre public.socios
 */
@Injectable({
  providedIn: 'root',
})
export class NewsletterService {
  private readonly supabase = inject(SUPABASE_CLIENT);
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router, { optional: true });
  private readonly destroyRef = inject(DestroyRef);
  private readonly baseWaitlistCount = 100;

  readonly isSupabaseConnected = signal<boolean>(isSupabaseConfigured());
  readonly lastProspectEmail = signal<string>(this.loadLastProspectEmail());

  private readonly _entries = signal<WaitlistEntry[]>(this.loadStoredEntries());
  private readonly _currentMember = signal<WaitlistEntry | null>(this.loadCurrentMember());
  private readonly _reservedSpots = signal<number>(this.loadReservedSpots());
  private readonly _isLoading = signal<boolean>(false);
  private readonly _errorMessage = signal<string | null>(null);
  private readonly _loginSuccessFlag = signal<boolean>(false);
  private readonly usedMemberDiscounts = new Set(this.loadUsedMemberDiscounts());

  private _sessionGeneration = 0;
  private _activeAuthUserId: string | null = this.loadCurrentMember()?.authUserId || null;
  private _activeAuthEmail: string | null = this.loadCurrentMember()?.email?.toLowerCase() || null;

  readonly profileSuccessHighlight = signal<boolean>(false);
  private readonly _expiryTick = signal<number>(Date.now());
  private plenoExpiryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.initSupabaseData();
    effect(() => {
      const member = this._currentMember();
      this.schedulePlenoExpirationCheck(member);
    });
    this.destroyRef.onDestroy(() => {
      if (this.plenoExpiryTimer) {
        clearTimeout(this.plenoExpiryTimer);
        this.plenoExpiryTimer = null;
      }
    });
  }

  private isPlenoExpired(
    member: WaitlistEntry | null | undefined,
    nowMs: number = Date.now(),
  ): boolean {
    if (!member) return false;
    const expiresIso = member.plenoExpiresAt || member.subscription?.expiresAt || null;
    if (!expiresIso) return false;
    const expiresMs = Date.parse(expiresIso);
    return Number.isFinite(expiresMs) && expiresMs <= nowMs;
  }

  private schedulePlenoExpirationCheck(member: WaitlistEntry | null): void {
    if (this.plenoExpiryTimer) {
      clearTimeout(this.plenoExpiryTimer);
      this.plenoExpiryTimer = null;
    }
    if (!member) return;
    const isPleno =
      member.membershipTier === 'activo' ||
      (member.membershipTier as string) === 'pleno' ||
      member.subscription?.status === 'active';
    if (!isPleno) return;

    const expiresIso = member.plenoExpiresAt || member.subscription?.expiresAt || null;
    if (!expiresIso) return;
    const expiresMs = Date.parse(expiresIso);
    if (!Number.isFinite(expiresMs)) return;

    const remainingMs = expiresMs - Date.now();
    if (remainingMs <= 0) {
      this.enforcePlenoExpiration();
      return;
    }

    const MAX_SAFE_TIMEOUT_MS = 2_147_483_647;
    const delayMs = Math.min(remainingMs + 50, MAX_SAFE_TIMEOUT_MS);
    this.plenoExpiryTimer = setTimeout(() => {
      this.plenoExpiryTimer = null;
      this.enforcePlenoExpiration();
      this.schedulePlenoExpirationCheck(this._currentMember());
    }, delayMs);
  }

  getEffectiveMemberTier(member?: WaitlistEntry | null): MembershipTier | null {
    const nowMs = this._expiryTick();
    const target = member ?? this._currentMember();
    if (!target) return null;
    const tier = target.membershipTier || 'emergente';
    if (
      (tier === 'activo' || (tier as string) === 'pleno') &&
      this.isPlenoExpired(target, nowMs)
    ) {
      return 'emergente';
    }
    return tier;
  }

  enforcePlenoExpiration(): void {
    const nowMs = Date.now();
    this._expiryTick.set(nowMs);
    const member = this._currentMember();
    if (!member) return;
    const isPleno =
      member.membershipTier === 'activo' ||
      (member.membershipTier as string) === 'pleno' ||
      member.subscription?.status === 'active';
    if (isPleno && this.isPlenoExpired(member, nowMs)) {
      const downgraded: WaitlistEntry = {
        ...member,
        membershipTier: 'emergente',
        subscription: member.subscription
          ? { ...member.subscription, status: 'cancelled' }
          : undefined,
      };
      this._currentMember.set(downgraded);
      this.persistCurrentMember(downgraded);
    }
  }

  private async initSupabaseData(): Promise<void> {
    if (!this.isSupabaseConnected()) return;

    void (this.supabase.rpc('expire_overdue_pleno_memberships' as any) as any)?.then?.(
      () => undefined,
      () => undefined,
    );

    try {
      const { data: statsData } = await this.supabase
        .from('estadisticas_socios')
        .select('*')
        .maybeSingle();

      if (statsData?.total_members) {
        const count = Number(statsData.total_members);
        const spots = Math.min(60, Math.max(10, count));
        this._reservedSpots.set(spots);
      }

      const current = this._currentMember();
      if (current?.email) {
        const cleanCurrentEmail = current.email.toLowerCase();
        const { data: rpcRes, error: rpcErr } = await this.supabase.rpc(
          'get_socio_by_session_or_token',
          {
            p_email: cleanCurrentEmail,
            p_registration_token: current.registrationToken || null,
          },
        );

        const rpcPayload = rpcRes as any;
        if (!rpcErr && rpcPayload?.status === 'ok' && rpcPayload?.socio) {
          const mapped = mapDbRowToEntry(rpcPayload.socio);
          this._currentMember.set(mapped);
          this.persistCurrentMember(mapped);
        } else if (rpcErr) {
          // Fallback si la función RPC aún no fue ejecutada en Supabase
          const { data: remoteSocio } = await this.supabase
            .from('socios')
            .select('*')
            .eq('email', cleanCurrentEmail)
            .maybeSingle();

          if (remoteSocio) {
            const mapped = mapDbRowToEntry(remoteSocio);
            this._currentMember.set(mapped);
            this.persistCurrentMember(mapped);
          }
        }
      }

      // Escuchar cambios de sesión en Supabase Auth (ej. Login con Google)
      this.supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT' || !session?.user) {
          if (this._activeAuthUserId !== null || this._activeAuthEmail !== null) {
            this._sessionGeneration++;
            this._activeAuthUserId = null;
            this._activeAuthEmail = null;
          }
          return;
        }

        const authEmail = session.user.email?.toLowerCase() || '';
        const authId = session.user.id;

        const isAccountChange =
          (this._activeAuthUserId !== null && this._activeAuthUserId !== authId) ||
          (this._activeAuthEmail !== null && this._activeAuthEmail !== authEmail);

        if (isAccountChange) {
          this._sessionGeneration++;
        }

        this._activeAuthUserId = authId;
        this._activeAuthEmail = authEmail;

        if (session?.user?.email) {
          // Solo activar la notificación de ingreso exitoso si el usuario acaba de ingresar con Google
          // por primera vez (evento SIGNED_IN tras OAuth flow). Nunca si ya tenía la sesión
          // previamente iniciada (INITIAL_SESSION) o por refresco/navegación común.
          const isFreshGoogleLogin =
            event === 'SIGNED_IN' && this.consumeGoogleLoginPendingFlag();

          try {
            // 1. Asegurar registro en socios con tier waitlist y auth_user_id
            const { error: wlRpcErr } = await this.supabase.rpc('record_waitlist_email', {
              p_email: authEmail,
              p_google_linked: true,
            });
            if (wlRpcErr) {
              await (this.supabase.from('socios') as any).upsert(
                { email: authEmail, auth_user_id: authId, membership_tier: 'waitlist' },
                { onConflict: 'email', ignoreDuplicates: true },
              );
            }

            // 2. Obtener y vincular socio existente mediante RPC segura
            const { data: rpcRes, error: rpcErr } = await this.supabase.rpc(
              'get_socio_by_session_or_token',
              {
                p_email: authEmail,
                p_registration_token: this._currentMember()?.registrationToken || null,
              },
            );

            const rpcPayload = rpcRes as any;
            if (!rpcErr && rpcPayload?.status === 'ok' && rpcPayload?.socio) {
              const mapped = mapDbRowToEntry(rpcPayload.socio);
              this._currentMember.set(mapped);
              this.persistCurrentMember(mapped);
              if (isFreshGoogleLogin) {
                this.setLoginSuccessFlag();
              }
              this.checkAndNavigateReturnUrl();
              return;
            }

            // Fallback directo si la RPC aún no existe
            await this.supabase
              .from('socios')
              .update({ auth_user_id: authId })
              .eq('email', authEmail);

            const { data: remoteSocio } = await this.supabase
              .from('socios')
              .select('*')
              .eq('email', authEmail)
              .maybeSingle();

            if (remoteSocio) {
              const mapped = mapDbRowToEntry(remoteSocio);
              this._currentMember.set(mapped);
              this.persistCurrentMember(mapped);
              if (isFreshGoogleLogin) {
                this.setLoginSuccessFlag();
              }
              this.checkAndNavigateReturnUrl();
            }
          } catch {
            // Manejo de error silencioso
          }
        }
      });
    } catch {
      // Offline fallback
    }
  }

  saveAuthReturnUrl(url: string): void {
    if (typeof window === 'undefined' || !url) return;
    try {
      const payload = JSON.stringify({
        url,
        expiresAt: Date.now() + AUTH_RETURN_URL_EXPIRY_MS,
      });
      sessionStorage.setItem(AUTH_RETURN_URL_KEY, payload);
      localStorage.setItem(AUTH_RETURN_URL_KEY, payload);
    } catch {
      // ignore storage access errors
    }
  }

  getAuthReturnUrl(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw =
        sessionStorage.getItem(AUTH_RETURN_URL_KEY) ||
        localStorage.getItem(AUTH_RETURN_URL_KEY);
      if (!raw) return null;

      let url: string | null = null;
      let expiresAt: number | null = null;

      if (raw.startsWith('{')) {
        try {
          const parsed = JSON.parse(raw);
          url = parsed.url;
          expiresAt = typeof parsed.expiresAt === 'number' ? parsed.expiresAt : null;
        } catch {
          url = null;
        }
      } else {
        url = raw;
      }

      // Descartar entradas obsoletas expiradas
      if (expiresAt !== null && Date.now() > expiresAt) {
        this.clearAuthReturnUrl();
        return null;
      }

      if (url && typeof url === 'string' && url.startsWith('/') && url !== '/' && url !== '/login') {
        return url;
      }

      this.clearAuthReturnUrl();
      return null;
    } catch {
      return null;
    }
  }

  clearAuthReturnUrl(): void {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.removeItem(AUTH_RETURN_URL_KEY);
      localStorage.removeItem(AUTH_RETURN_URL_KEY);
    } catch {
      // ignore
    }
  }

  checkAndNavigateReturnUrl(): boolean {
    if (typeof window === 'undefined') return false;
    const returnUrl = this.getAuthReturnUrl();
    if (!returnUrl) return false;
    const currentPath = window.location.pathname;
    if (currentPath === '/' || currentPath === '/perfil' || currentPath === '/login') {
      if (returnUrl !== currentPath) {
        this.clearAuthReturnUrl();
        if (this.router) {
          void this.router.navigateByUrl(returnUrl, { replaceUrl: true });
          return true;
        }
      }
    }
    return false;
  }

  private static readonly GOOGLE_LOGIN_PENDING_KEY = 'experiencias_google_login_pending';

  markGoogleLoginPending(): void {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(NewsletterService.GOOGLE_LOGIN_PENDING_KEY, 'true');
    } catch {
      // ignore
    }
  }

  private consumeGoogleLoginPendingFlag(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      const isPending =
        sessionStorage.getItem(NewsletterService.GOOGLE_LOGIN_PENDING_KEY) === 'true';
      if (isPending) {
        sessionStorage.removeItem(NewsletterService.GOOGLE_LOGIN_PENDING_KEY);
        return true;
      }
      const hash = window.location.hash || '';
      const search = window.location.search || '';
      if (hash.includes('access_token=') || search.includes('code=')) {
        const callbackProcessedKey = 'experiencias_oauth_processed';
        if (!sessionStorage.getItem(callbackProcessedKey)) {
          sessionStorage.setItem(callbackProcessedKey, 'true');
          return true;
        }
      }
    } catch {
      // ignore
    }
    return false;
  }

  setLoginSuccessFlag(): void {
    this._loginSuccessFlag.set(true);
  }

  consumeLoginSuccessFlag(): boolean {
    const val = this._loginSuccessFlag();
    if (val) {
      this._loginSuccessFlag.set(false);
    }
    return val;
  }

  readonly entries = this._entries.asReadonly();
  readonly currentMember = this._currentMember.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly errorMessage = this._errorMessage.asReadonly();
  readonly isSubscribed = computed(() => this._currentMember() !== null);

  async isAuthenticated(): Promise<boolean> {
    if (this._currentMember()) {
      return true;
    }

    if (this.isSupabaseConnected()) {
      try {
        const { data } = await this.supabase.auth.getSession();
        if (data?.session?.user?.email) {
          const authEmail = data.session.user.email.toLowerCase();

          // Registrar en socios con tier waitlist
          const { error: wlRpcErr } = await this.supabase.rpc('record_waitlist_email', {
            p_email: authEmail,
            p_google_linked: true,
          });
          if (wlRpcErr) {
            await (this.supabase.from('socios') as any).upsert(
              { email: authEmail, membership_tier: 'waitlist' },
              { onConflict: 'email', ignoreDuplicates: true },
            );
          }

          // Consultar socio mediante RPC segura
          const { data: rpcRes, error: rpcErr } = await this.supabase.rpc(
            'get_socio_by_session_or_token',
            {
              p_email: authEmail,
              p_registration_token: null,
            },
          );

          const rpcPayload = rpcRes as any;
          if (!rpcErr && rpcPayload?.status === 'ok' && rpcPayload?.socio) {
            const entry = mapDbRowToEntry(rpcPayload.socio);
            this._currentMember.set(entry);
            this.persistCurrentMember(entry);
            return true;
          }

          // Fallback si la RPC aún no fue ejecutada en Supabase
          const { data: remoteSocio } = await this.supabase
            .from('socios')
            .select('*')
            .eq('email', authEmail)
            .maybeSingle();

          if (remoteSocio) {
            const entry = mapDbRowToEntry(remoteSocio);
            this._currentMember.set(entry);
            this.persistCurrentMember(entry);
            return true;
          }

          const fallbackEntry: WaitlistEntry = {
            id: data.session.user.id,
            email: authEmail,
            fullName:
              data.session.user.user_metadata?.['full_name'] ||
              data.session.user.user_metadata?.['name'] ||
              '',
            dni: '',
            phone: '',
            membershipTier: 'emergente',
            authUserId: data.session.user.id,
            googleLinked: true,
            position: 100,
            status: 'confirmed',
            source: 'supabase_auth',
            createdAt: new Date(),
          };
          this._currentMember.set(fallbackEntry);
          this.persistCurrentMember(fallbackEntry);
          return true;
        }
      } catch (err) {
        console.warn('[NewsletterService] Error comprobando sesión:', err);
      }
    }

    return false;
  }

  readonly isMonthlyActive = computed(() => {
    const nowMs = this._expiryTick();
    const member = this._currentMember();
    if (!member || this.isPlenoExpired(member, nowMs)) return false;
    return member.membershipTier === 'activo' || member.subscription?.status === 'active';
  });
  readonly activeSubscription = computed(() => this._currentMember()?.subscription || null);

  readonly stats = computed<WaitlistStats>(() => {
    const maxSpots = 60;
    return {
      totalMembers: 50,
      seasonLaunchDate: 'Noviembre 2026',
      exclusiveSpotsTotal: maxSpots,
      exclusiveSpotsRemaining: this._reservedSpots(),
    };
  });

  findMemberDiscount(rawCode: string): DiscountCode | undefined {
    this.enforcePlenoExpiration();
    const code = rawCode.trim().toUpperCase();
    const member = this._currentMember();
    if (!member || this.usedMemberDiscounts.has(code)) return undefined;

    if (member.membershipTier === 'fundador' && code === 'FUNDADOR20') {
      return { code, percentOff: 20, label: '20% socios fundadores' };
    }

    if (member.membershipTier === 'activo' && !this.isPlenoExpired(member) && code === 'SOCIO10') {
      return { code, percentOff: 10, label: '10% socios' };
    }

    return undefined;
  }

  markMemberDiscountUsed(code: string, reference: string, experienceTitle: string): void {
    const normalizedCode = code.trim().toUpperCase();
    if (!this.findMemberDiscount(normalizedCode)) return;

    this.usedMemberDiscounts.add(normalizedCode);
    try {
      localStorage.setItem(
        USED_MEMBER_DISCOUNTS_KEY,
        JSON.stringify([...this.usedMemberDiscounts]),
      );
    } catch {
      // Bloqueado en sesión
    }
  }

  /**
   * 1. Paso Landing (/): Guarda correo ágilmente en la tabla socios (tier waitlist)
   */
  async recordWaitlistProspect(
    email: string,
  ): Promise<{ success: boolean; email: string; message: string }> {
    this._isLoading.set(true);
    this._errorMessage.set(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!this.isValidEmail(cleanEmail) || cleanEmail.length > 254) {
      this._isLoading.set(false);
      const msg = 'Por favor, ingresá un correo electrónico válido.';
      this._errorMessage.set(msg);
      return { success: false, email: cleanEmail, message: msg };
    }

    if (this.isSupabaseConnected()) {
      try {
        const { error: rpcErr } = await this.supabase.rpc('record_waitlist_email', {
          p_email: cleanEmail,
          p_google_linked: false,
        });

        if (rpcErr) {
          // Guardar en socios con tier waitlist directamente
          const { error: socioErr } = await (this.supabase.from('socios') as any).upsert(
            { email: cleanEmail, membership_tier: 'waitlist' },
            { onConflict: 'email', ignoreDuplicates: true },
          );

          if (socioErr) {
            console.warn('[Supabase] Advertencia guardando en socios (waitlist):', socioErr.message);
            this._isLoading.set(false);
            const msg = this.translateSupabaseError(socioErr.message);
            this._errorMessage.set(msg);
            return {
              success: false,
              email: cleanEmail,
              message: msg,
            };
          }
        }
      } catch (err: any) {
        console.warn('[Supabase] Error registrando prospecto en waitlist:', err);
        this._isLoading.set(false);
        const msg = this.translateSupabaseError(err?.message);
        this._errorMessage.set(msg);
        return {
          success: false,
          email: cleanEmail,
          message: msg,
        };
      }
    }

    this.lastProspectEmail.set(cleanEmail);
    this.persistProspectEmail(cleanEmail);

    this._isLoading.set(false);
    this.notificationService
      .notifyWaitlistConfirmation({ email: cleanEmail })
      .then((res) => {
        if (!res.success) {
          console.warn('[NewsletterService] Aviso al despachar confirmación de waitlist:', res.error);
        }
      })
      .catch((err) => console.warn('[NewsletterService] Error enviando confirmación de waitlist:', err));

    return {
      success: true,
      email: cleanEmail,
      message: 'Correo registrado en la lista de espera.',
    };
  }

  /**
   * 2. Paso Socios Emergentes (/socios/emergentes):
   * Crea o actualiza el socio en la tabla socios (DNI y Celular obligatorios)
   */
  async registerSocio(dto: {
    fullName: string;
    email: string;
    dni: string;
    phone: string;
    experiencesWishlist?: string[];
    experiencesOther?: string;
  }): Promise<{
    success: boolean;
    socio?: WaitlistEntry;
    alreadyRegistered?: boolean;
    message: string;
  }> {
    this._isLoading.set(true);
    this._errorMessage.set(null);

    const cleanEmail = dto.email.trim().toLowerCase();
    const cleanName = dto.fullName.trim();
    const cleanDni = dto.dni.replace(/\D/g, '').slice(0, 9);
    const cleanPhone = dto.phone.trim().slice(0, 25);

    if (!cleanName) {
      this._isLoading.set(false);
      return { success: false, message: 'Ingresá tu nombre y apellido.' };
    }
    if (!this.isValidEmail(cleanEmail)) {
      this._isLoading.set(false);
      return { success: false, message: 'Ingresá un correo electrónico válido.' };
    }
    if (!/^\d{7,9}$/.test(cleanDni)) {
      this._isLoading.set(false);
      return { success: false, message: 'El DNI debe contener entre 7 y 9 números.' };
    }
    if (!cleanPhone) {
      this._isLoading.set(false);
      return { success: false, message: 'Ingresá tu número de celular.' };
    }

    // 1. Guardar en Supabase si está conectado (primero mediante RPC atómica y segura)
    if (this.isSupabaseConnected()) {
      try {
        const { data: rpcRes, error: rpcErr } = await this.supabase.rpc(
          'register_emergente_socio',
          {
            p_email: cleanEmail,
            p_full_name: cleanName,
            p_dni: cleanDni,
            p_phone: cleanPhone,
            p_experiences_wishlist: dto.experiencesWishlist || [],
            p_experiences_other: dto.experiencesOther || null,
          },
        );

        const rpcPayload = rpcRes as any;
        if (!rpcErr && rpcPayload?.status) {
          if (rpcPayload.status === 'already_registered_email') {
            this._isLoading.set(false);
            this.notificationService
              .notifyAlreadyRegistered({
                email: cleanEmail,
                fullName: cleanName,
              })
              .catch((err) =>
                console.warn('[NewsletterService] Error enviando aviso de cuenta existente:', err),
              );
            return {
              success: false,
              message:
                'Ya existe un socio registrado con este email. Iniciá sesión para acceder a tu cuenta.',
            };
          }

          if (rpcPayload.status === 'already_registered_dni') {
            this._isLoading.set(false);
            return {
              success: false,
              message: 'Ya existe un socio registrado con este número de DNI.',
            };
          }

          if (rpcPayload.status === 'created' && rpcPayload.socio) {
            const entry = mapDbRowToEntry(rpcPayload.socio);
            const updatedEntries = [
              entry,
              ...this._entries().filter((e) => e.email !== cleanEmail),
            ];
            this._entries.set(updatedEntries);
            this._currentMember.set(entry);
            this.persistEntries(updatedEntries);
            this.persistCurrentMember(entry);

            this._isLoading.set(false);
            this.setLoginSuccessFlag();
            this.notificationService
              .notifyWelcomeMember({
                fullName: entry.fullName || cleanName,
                email: entry.email,
                position: entry.position,
              })
              .catch((err) => console.warn('[NewsletterService] Error enviando bienvenida:', err));
            return {
              success: true,
              socio: entry,
              message: `¡Bienvenido al Club! Sos el Socio Emergente #${entry.position}.`,
            };
          }
        }

        // Fallback a tablas directas si la función RPC aún no fue ejecutada en Supabase
        const { data: existing } = await this.supabase
          .from('socios')
          .select('*')
          .eq('email', cleanEmail)
          .maybeSingle();

        if (existing) {
          let activeEmail: string | null = null;
          try {
            const { data: sessData } = await this.supabase.auth.getSession();
            activeEmail = sessData?.session?.user?.email?.toLowerCase().trim() || null;
          } catch {
            // Sin sesión activa
          }

          if (activeEmail !== cleanEmail) {
            this._isLoading.set(false);
            this.notificationService
              .notifyAlreadyRegistered({
                email: cleanEmail,
                fullName: existing.full_name || cleanName,
                position: existing.position ?? undefined,
                tier: existing.membership_tier,
              })
              .catch((err) =>
                console.warn('[NewsletterService] Error enviando aviso de cuenta existente:', err),
              );
            return {
              success: false,
              message:
                'Ya existe un socio registrado con este email. Iniciá sesión para acceder a tu cuenta.',
            };
          }

          const isWaitlist = existing.membership_tier === 'waitlist';
          const updatePayload: Record<string, any> = {
            full_name: cleanName || existing.full_name,
            dni: cleanDni || existing.dni,
            phone: cleanPhone || existing.phone,
            experiences_wishlist: dto.experiencesWishlist || existing.experiences_wishlist,
            experiences_other: dto.experiencesOther || existing.experiences_other,
            updated_at: new Date().toISOString(),
          };

          if (isWaitlist) {
            updatePayload['membership_tier'] = 'emergente';
          }

          const { data: updatedSocio, error: updateError } = await this.supabase
            .from('socios')
            .update(updatePayload as any)
            .eq('id', existing.id)
            .select('*')
            .maybeSingle();

          if (updateError || !updatedSocio) {
            this._isLoading.set(false);
            console.warn('[NewsletterService] Error o fila vacía al actualizar socio:', updateError);
            return {
              success: false,
              message:
                updateError?.message ||
                'No se pudo actualizar el registro de socio. Por favor, intentá nuevamente.',
            };
          }

          const entry = mapDbRowToEntry(updatedSocio);
          const updatedEntries = [entry, ...this._entries().filter((e) => e.email !== cleanEmail)];
          this._entries.set(updatedEntries);
          this._currentMember.set(entry);
          this.persistEntries(updatedEntries);
          this.persistCurrentMember(entry);

          this._isLoading.set(false);
          this.setLoginSuccessFlag();
          return {
            success: true,
            socio: entry,
            message: `¡Bienvenido al Club! Sos el Socio Emergente #${entry.position}.`,
          };
        } else {
          // Fallback de registro seguro a través de RPC atómica SECURITY DEFINER
          const { data: atomicRes, error: atomicErr } = await this.supabase.rpc(
            'register_socio_atomic',
            {
              p_email: cleanEmail,
              p_full_name: cleanName,
              p_dni: cleanDni,
              p_phone: cleanPhone,
              p_experiences_wishlist: dto.experiencesWishlist || [],
              p_experiences_other: dto.experiencesOther || null,
            },
          );

          const atomicPayload = atomicRes as any;
          if (
            atomicPayload?.status === 'already_registered_dni' ||
            atomicErr?.message?.toLowerCase().includes('idx_socios_dni_unique')
          ) {
            this._isLoading.set(false);
            return {
              success: false,
              message: 'Ya existe un socio registrado con este número de DNI.',
            };
          }

          if (
            atomicErr ||
            atomicPayload?.status !== 'created' ||
            !atomicPayload?.socio
          ) {
            this._isLoading.set(false);
            return {
              success: false,
              message:
                atomicPayload?.message ||
                (atomicPayload?.status === 'already_registered' ||
                atomicPayload?.status === 'already_registered_email'
                  ? 'Ya existe un socio registrado con este correo electrónico. Iniciá sesión para acceder a tu cuenta.'
                  : 'No se pudo completar el registro del socio.'),
            };
          }

          const entry = mapDbRowToEntry(atomicPayload.socio);
          const updatedEntries = [entry, ...this._entries().filter((e) => e.email !== cleanEmail)];
          this._entries.set(updatedEntries);
          this._currentMember.set(entry);
          this.persistEntries(updatedEntries);
          this.persistCurrentMember(entry);

          this._isLoading.set(false);
          this.setLoginSuccessFlag();
          this.notificationService
            .notifyWelcomeMember({
              fullName: entry.fullName || cleanName,
              email: entry.email,
              position: entry.position,
            })
            .catch((err) => console.warn('[NewsletterService] Error enviando bienvenida:', err));
          return {
            success: true,
            socio: entry,
            message: `¡Bienvenido al Club! Sos el Socio Emergente #${entry.position}.`,
          };
        }
      } catch (err) {
        console.warn('[Supabase] Error registrando socio en remoto:', err);
        this._isLoading.set(false);
        return {
          success: false,
          message: 'Error de conexión al registrar el socio. Por favor reintentá.',
        };
      }
    }

    // 2. Fallback local / simulación si no está conectado
    await new Promise((resolve) => setTimeout(resolve, 350));

    const existingLocal = this._entries().find((e) => e.email === cleanEmail);
    if (existingLocal && existingLocal.dni) {
      const updatedSocio: WaitlistEntry = {
        ...existingLocal,
        fullName: cleanName || existingLocal.fullName,
        dni: cleanDni || existingLocal.dni,
        documentNumber: cleanDni || existingLocal.documentNumber,
        phone: cleanPhone || existingLocal.phone,
        experiencesWishlist: dto.experiencesWishlist || existingLocal.experiencesWishlist,
        experiencesOther: dto.experiencesOther || existingLocal.experiencesOther,
      };
      const updated = [updatedSocio, ...this._entries().filter((e) => e.email !== cleanEmail)];
      this._entries.set(updated);
      this._currentMember.set(updatedSocio);
      this.persistEntries(updated);
      this.persistCurrentMember(updatedSocio);

      this._isLoading.set(false);
      this.setLoginSuccessFlag();
      return {
        success: true,
        socio: updatedSocio,
        message: `¡Bienvenido al Club! Sos el Socio Emergente #${updatedSocio.position}.`,
      };
    }

    const position = existingLocal
      ? existingLocal.position
      : this.baseWaitlistCount + this._entries().length;

    const newSocio: WaitlistEntry = {
      id: existingLocal ? existingLocal.id : 'socio_' + Date.now().toString(),
      email: cleanEmail,
      fullName: cleanName,
      dni: cleanDni,
      documentNumber: cleanDni,
      phone: cleanPhone,
      experiencesWishlist: dto.experiencesWishlist || [],
      experiencesOther: dto.experiencesOther,
      position,
      createdAt: existingLocal ? existingLocal.createdAt : new Date(),
      status: 'confirmed',
      source: 'web_minimal_landing',
      membershipTier: existingLocal?.membershipTier || 'emergente',
    };

    const updated = [newSocio, ...this._entries().filter((e) => e.email !== cleanEmail)];
    this._entries.set(updated);
    this._currentMember.set(newSocio);
    this.persistEntries(updated);
    this.persistCurrentMember(newSocio);

    this._isLoading.set(false);
    this.setLoginSuccessFlag();
    if (!existingLocal) {
      this.notificationService
        .notifyWelcomeMember({
          fullName: newSocio.fullName || cleanName,
          email: newSocio.email,
          position: newSocio.position,
        })
        .catch((err) => console.warn('[NewsletterService] Error enviando bienvenida:', err));
    }

    return {
      success: true,
      socio: newSocio,
      message: `¡Bienvenido al Club! Sos el Socio Emergente #${position}.`,
    };
  }

  async activateSocioPleno(dto: {
    fullName: string;
    email: string;
    dni: string;
    phone: string;
    discountCode?: string;
    durationMonths?: number | null;
    experiencesWishlist?: string[];
    experiencesOther?: string;
  }): Promise<{
    success: boolean;
    socio?: WaitlistEntry;
    message: string;
  }> {
    this._isLoading.set(true);
    this._errorMessage.set(null);

    const cleanEmail = dto.email.trim().toLowerCase();
    const cleanName = dto.fullName.trim();
    const cleanDni = dto.dni.replace(/\D/g, '').slice(0, 9);
    const cleanPhone = dto.phone.trim().slice(0, 25);
    const cleanDiscountCode = (dto.discountCode || '').trim().toUpperCase();

    if (!cleanName) {
      this._isLoading.set(false);
      return { success: false, message: 'Ingresá tu nombre y apellido.' };
    }
    if (!this.isValidEmail(cleanEmail)) {
      this._isLoading.set(false);
      return { success: false, message: 'Ingresá un correo electrónico válido.' };
    }
    if (!/^\d{7,9}$/.test(cleanDni)) {
      this._isLoading.set(false);
      return { success: false, message: 'El DNI debe contener entre 7 y 9 números.' };
    }
    if (!cleanPhone) {
      this._isLoading.set(false);
      return { success: false, message: 'Ingresá tu número de celular.' };
    }

    const opGeneration = this._sessionGeneration;

    if (this.isSupabaseConnected()) {
      try {
        const { data: rpcRes, error: rpcErr } = await this.supabase.rpc(
          'activate_socio_pleno_atomic' as any,
          {
            p_email: cleanEmail,
            p_full_name: cleanName,
            p_dni: cleanDni,
            p_phone: cleanPhone,
            p_discount_code: cleanDiscountCode || null,
            p_experiences_wishlist: dto.experiencesWishlist || [],
            p_experiences_other: dto.experiencesOther || null,
          },
        );

        if (rpcErr) {
          this._isLoading.set(false);
          console.warn('[NewsletterService] Error en RPC activate_socio_pleno_atomic:', rpcErr);
          return {
            success: false,
            message: rpcErr.message || 'No fue posible completar la activación de la membresía.',
          };
        }

        const rpcPayload = rpcRes as any;
        if (!rpcPayload || typeof rpcPayload !== 'object') {
          this._isLoading.set(false);
          return {
            success: false,
            message: 'Respuesta inválida del servidor al activar la membresía.',
          };
        }

        if (rpcPayload.status === 'unauthorized') {
          this._isLoading.set(false);
          return {
            success: false,
            message:
              rpcPayload.message ||
              'Se requiere autenticación válida vía Google para activar la membresía.',
          };
        }

        if (rpcPayload.status === 'invalid_input') {
          this._isLoading.set(false);
          return {
            success: false,
            message: rpcPayload.message || 'Completá todos los campos obligatorios.',
          };
        }

        if (rpcPayload.status === 'invalid_code') {
          this._isLoading.set(false);
          return {
            success: false,
            message: rpcPayload.message || 'Código de descuento inválido o expirado.',
          };
        }

        if (rpcPayload.status === 'already_registered_dni') {
          this._isLoading.set(false);
          return {
            success: false,
            message: 'Ya existe un socio registrado con este número de DNI.',
          };
        }

        if (rpcPayload.status === 'already_fundador') {
          this._isLoading.set(false);
          return {
            success: false,
            message:
              rpcPayload.message ||
              'Ya contás con la membresía vitalicia de Socio Fundador (Nivel 3). No es necesario activar una membresía plena.',
          };
        }

        if (rpcPayload.status === 'ok' && rpcPayload.socio) {
          if (opGeneration !== this._sessionGeneration) {
            this._isLoading.set(false);
            return {
              success: false,
              message: 'La sesión o la cuenta cambió durante la activación. La operación no fue aplicada.',
            };
          }

          const entry = mapDbRowToEntry(rpcPayload.socio);
          const today = new Date();
          const durationMonths =
            dto.durationMonths && Number(dto.durationMonths) > 0 ? Number(dto.durationMonths) : null;
          const rpcActivatedAt: string | null = rpcPayload.socio?.pleno_activated_at || null;
          const rpcExpiresAt: string | null = rpcPayload.socio?.pleno_expires_at || null;
          const rpcDiscountCode: string | null = rpcPayload.socio?.pleno_discount_code || null;

          const resolvedActivatedAt = rpcActivatedAt || today.toISOString();
          const resolvedExpiresAt = rpcExpiresAt;
          const resolvedDiscountCode = rpcDiscountCode || cleanDiscountCode || null;

          const nextMonth = addMonthsClamped(new Date(resolvedActivatedAt), durationMonths || 1);

          entry.membershipTier = 'activo';
          entry.plenoActivatedAt = resolvedActivatedAt;
          entry.plenoExpiresAt = resolvedExpiresAt;
          entry.plenoDiscountCode = resolvedDiscountCode;
          entry.subscription = {
            status: 'active',
            tier: 'activo',
            amountArs: 23000,
            paymentMethod: resolvedDiscountCode
              ? `Cupón Promocional (${resolvedDiscountCode})`
              : 'Bonificación de Adquisición',
            startedAt: resolvedActivatedAt,
            nextBillingDate: nextMonth.toLocaleDateString('es-AR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            }),
            expiresAt: resolvedExpiresAt,
            discountCode: resolvedDiscountCode,
            autoRenew: !resolvedExpiresAt,
            lastPaymentReceipt: 'REC-' + Math.floor(100000 + Math.random() * 900000),
          };

          const updatedEntries = [
            entry,
            ...this._entries().filter((e) => e.email !== cleanEmail),
          ];
          this._entries.set(updatedEntries);
          this._currentMember.set(entry);
          this.persistEntries(updatedEntries);
          this.persistCurrentMember(entry);

          this._isLoading.set(false);
          this.setLoginSuccessFlag();
          this.notificationService
            .notifyWelcomeMember({
              fullName: entry.fullName || cleanName,
              email: entry.email,
              position: entry.position,
            })
            .catch((err) => console.warn('[NewsletterService] Error enviando bienvenida:', err));
          return {
            success: true,
            socio: entry,
            message: `¡Felicitaciones! Tu membresía de Socio Pleno #${entry.position} está activa con cuota bonificada.`,
          };
        }

        // Respuesta no reconocida del servidor conectado
        this._isLoading.set(false);
        return {
          success: false,
          message: rpcPayload.message || 'No fue posible completar la activación de la membresía.',
        };
      } catch (err: any) {
        console.warn('[NewsletterService] Error llamando a activate_socio_pleno_atomic:', err);
        this._isLoading.set(false);
        return {
          success: false,
          message:
            err?.message ||
            'Error de comunicación con el servidor al activar la membresía. Por favor, reintentá.',
        };
      }
    }

    // Permitir simulación local únicamente cuando el modo desarrollo explícito está habilitado (!environment.production)
    if (environment.production) {
      this._isLoading.set(false);
      return {
        success: false,
        message: 'El servicio de activación de membresías no está disponible en este momento.',
      };
    }

    // Fallback offline / local
    const existing = this._entries().find((e) => e.email === cleanEmail);
    if (existing?.membershipTier === 'fundador') {
      this._isLoading.set(false);
      return {
        success: false,
        message:
          'Ya contás con la membresía vitalicia de Socio Fundador (Nivel 3). No es posible cambiar a una membresía inferior.',
      };
    }

    const dniDuplicate = this._entries().find(
      (e) => e.email !== cleanEmail && e.dni && e.dni.replace(/\D/g, '') === cleanDni,
    );
    if (dniDuplicate) {
      this._isLoading.set(false);
      return {
        success: false,
        message: 'Ya existe un socio registrado con este número de DNI.',
      };
    }
    const position = existing?.position || this._entries().length + 1;
    const today = new Date();
    const durationMonths =
      dto.durationMonths && Number(dto.durationMonths) > 0 ? Number(dto.durationMonths) : null;
    const expiresDate = durationMonths ? addMonthsClamped(today, durationMonths) : null;
    const expiresAtIso = expiresDate ? expiresDate.toISOString() : null;
    const nextMonth = addMonthsClamped(today, durationMonths || 1);

    const fallbackEntry: WaitlistEntry = {
      id: existing?.id || 'socio-' + Date.now(),
      email: cleanEmail,
      fullName: cleanName,
      dni: cleanDni,
      phone: cleanPhone,
      experiencesWishlist: dto.experiencesWishlist || existing?.experiencesWishlist || [],
      experiencesOther: dto.experiencesOther || existing?.experiencesOther || '',
      position,
      membershipTier: 'activo',
      plenoActivatedAt: today.toISOString(),
      plenoExpiresAt: expiresAtIso,
      plenoDiscountCode: cleanDiscountCode || null,
      subscription: {
        status: 'active',
        tier: 'activo',
        amountArs: 23000,
        paymentMethod: cleanDiscountCode ? `Cupón Promocional (${cleanDiscountCode})` : 'Bonificación de Adquisición',
        startedAt: today.toISOString(),
        nextBillingDate: nextMonth.toLocaleDateString('es-AR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
        expiresAt: expiresAtIso,
        discountCode: cleanDiscountCode || null,
        autoRenew: !expiresAtIso,
        lastPaymentReceipt: 'REC-' + Math.floor(100000 + Math.random() * 900000),
      },
      createdAt: existing?.createdAt ? new Date(existing.createdAt) : new Date(),
      status: 'confirmed',
      source: 'web_minimal_landing',
    };

    if (opGeneration !== this._sessionGeneration) {
      this._isLoading.set(false);
      return {
        success: false,
        message: 'La sesión o la cuenta cambió durante la activación. La operación no fue aplicada.',
      };
    }

    const updated = [fallbackEntry, ...this._entries().filter((e) => e.email !== cleanEmail)];
    this._entries.set(updated);
    this._currentMember.set(fallbackEntry);
    this.persistEntries(updated);
    this.persistCurrentMember(fallbackEntry);

    this._isLoading.set(false);
    return {
      success: true,
      socio: fallbackEntry,
      message: `¡Felicitaciones! Tu membresía de Socio Pleno #${fallbackEntry.position} está activa.`,
    };
  }

  /**
   * Método compatible que maneja tanto prospecto por email como socio completo
   */
  async joinWaitlist(
    dto: WaitlistSubmissionDto,
  ): Promise<{ success: boolean; entry?: WaitlistEntry; message: string; isExisting?: boolean }> {
    if (dto.fullName && (dto.dni || dto.documentNumber) && dto.phone) {
      const res = await this.registerSocio({
        fullName: dto.fullName,
        email: dto.email,
        dni: (dto.dni ?? dto.documentNumber) || '',
        phone: dto.phone,
        experiencesWishlist: dto.experiencesWishlist,
        experiencesOther: dto.experiencesOther,
      });
      return {
        success: res.success,
        entry: res.socio,
        message: res.message,
      };
    }

    // Solo email (waitlist rápida)
    const res = await this.recordWaitlistProspect(dto.email);
    return {
      success: res.success,
      message: res.message,
    };
  }

  /**
   * Verificar estado del correo en /ingresar:
   * - Si ya está en socios (completó /socios/emergentes): informa que debe iniciar sesión vía Google.
   * - Si ya estaba en waitlist (sin completar socios): redirige directo a /socios/emergentes.
   * - Si no estaba en ninguna: lo guarda en waitlist y ofrece completar perfil.
   */
  async loginWithEmail(email: string): Promise<{
    success: boolean;
    entry?: WaitlistEntry;
    notFound?: boolean;
    alreadyInWaitlist?: boolean;
    alreadyRegisteredSocio?: boolean;
    isWaitlistOnly?: boolean;
    message: string;
  }> {
    this._isLoading.set(true);
    this._errorMessage.set(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!this.isValidEmail(cleanEmail)) {
      this._isLoading.set(false);
      return { success: false, message: 'Por favor, ingresá un correo electrónico válido.' };
    }

    // 1. Consultar estado en Supabase sin exponer datos sensibles mediante RPC segura
    if (this.isSupabaseConnected()) {
      try {
        const { data: rpcRes, error: rpcErr } = await this.supabase.rpc(
          'check_email_registration_status',
          { p_email: cleanEmail },
        );

        const rpcStatus = rpcRes as any;
        if (!rpcErr && rpcStatus && typeof rpcStatus.in_socios === 'boolean') {
          if (rpcStatus.in_socios) {
            this._isLoading.set(false);
            return {
              success: false,
              alreadyRegisteredSocio: true,
              alreadyInWaitlist: false,
              message:
                'Este correo pertenece a un socio del Club. Por seguridad, iniciá sesión con Google para acceder a tu perfil.',
            };
          }

          if (rpcStatus.in_waitlist) {
            this._isLoading.set(false);
            this.lastProspectEmail.set(cleanEmail);
            this.persistProspectEmail(cleanEmail);
            return {
              success: false,
              notFound: true,
              alreadyInWaitlist: true,
              isWaitlistOnly: true,
              message:
                'Tu correo ya está en la lista de espera. Redirigiendo para completar tu perfil de Socio Emergente...',
            };
          }

          // Si no estaba ni en socios ni en waitlist, guardarlo en waitlist en segundo plano
          void this.recordWaitlistProspect(cleanEmail);
          this._isLoading.set(false);
          this.lastProspectEmail.set(cleanEmail);
          return {
            success: false,
            notFound: true,
            alreadyInWaitlist: false,
            isWaitlistOnly: true,
            message:
              'Guardamos tu correo en la lista de espera oficial. ¡Completá tu perfil para recibir tu número oficial de socio!',
          };
        }

        // Fallback de consulta directa a la tabla unificada socios
        const { data: socioData, error: socioErr } = await this.supabase
          .from('socios')
          .select('*')
          .eq('email', cleanEmail)
          .maybeSingle();

        if (!socioErr && socioData) {
          if (socioData.membership_tier === 'waitlist') {
            this._isLoading.set(false);
            this.lastProspectEmail.set(cleanEmail);
            this.persistProspectEmail(cleanEmail);
            return {
              success: false,
              notFound: true,
              alreadyInWaitlist: true,
              isWaitlistOnly: true,
              message:
                'Tu correo ya está en la lista de espera. Redirigiendo para completar tu perfil de Socio Emergente...',
            };
          }
          this._isLoading.set(false);
          return {
            success: false,
            alreadyRegisteredSocio: true,
            alreadyInWaitlist: false,
            message:
              'Este correo pertenece a un socio del Club. Por seguridad, iniciá sesión con Google para acceder a tu perfil.',
          };
        }

        // Si no estaba ni en socios ni en waitlist, guardarlo en waitlist en segundo plano
        void this.recordWaitlistProspect(cleanEmail);
        this._isLoading.set(false);
        this.lastProspectEmail.set(cleanEmail);
        return {
          success: false,
          notFound: true,
          alreadyInWaitlist: false,
          isWaitlistOnly: true,
          message:
            'Guardamos tu correo en la lista de espera oficial. ¡Completá tu perfil para recibir tu número oficial de socio!',
        };
      } catch (err) {
        console.warn('[Supabase] Error en loginWithEmail:', err);
      }
    }

    // 2. Buscar en caché local
    const localEntry = this._entries().find((e) => e.email === cleanEmail);
    if (localEntry) {
      this._isLoading.set(false);
      this._currentMember.set(localEntry);
      this.persistCurrentMember(localEntry);
      this.lastProspectEmail.set(cleanEmail);
      this.persistProspectEmail(cleanEmail);
      return {
        success: true,
        alreadyRegisteredSocio: true,
        alreadyInWaitlist: true,
        message: '¡Correo verificado con éxito! Redirigiendo a tu ficha de Socio Emergente...',
      };
    }

    const wasAlreadyProspect = this.lastProspectEmail() === cleanEmail;
    void this.recordWaitlistProspect(cleanEmail);
    this._isLoading.set(false);
    return {
      success: false,
      notFound: true,
      alreadyInWaitlist: wasAlreadyProspect,
      message:
        'Guardamos tu correo en la lista de espera oficial. ¡Completá tu perfil para recibir tu número oficial de socio!',
    };
  }

  async sendMagicLink(email: string): Promise<{ success: boolean; message: string }> {
    const cleanEmail = email.trim().toLowerCase();
    if (!this.isValidEmail(cleanEmail)) {
      return { success: false, message: 'Ingresá un correo electrónico válido.' };
    }

    if (!this.isSupabaseConnected()) {
      return {
        success: true,
        message: 'Modo local activo. Se iniciará sesión directamente con este correo.',
      };
    }

    try {
      const redirectUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}/perfil`
          : 'http://localhost:3000/perfil';

      const { error } = await this.supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) {
        return { success: false, message: this.translateSupabaseError(error.message) };
      }

      return {
        success: true,
        message: 'Te enviamos un enlace de acceso seguro a tu casilla de correo.',
      };
    } catch (err: any) {
      return {
        success: false,
        message: this.translateSupabaseError(err?.message) || 'Error al enviar enlace de acceso.',
      };
    }
  }

  async signInWithGoogle(redirectTo?: string): Promise<{ success: boolean; message: string }> {
    this.markGoogleLoginPending();
    if (typeof window !== 'undefined' && redirectTo) {
      try {
        const parsed = new URL(redirectTo, window.location.origin);
        const returnPath = parsed.pathname + parsed.search;
        if (returnPath && returnPath !== '/' && returnPath !== '/login') {
          this.saveAuthReturnUrl(returnPath);
        }
      } catch {
        // fallback ignore
      }
    }

    if (!this.isSupabaseConnected()) {
      const demoSocio = {
        id: 'socio_founder_demo',
        email: 'gonzagramaglia@gmail.com',
        fullName: 'Gonzalo Gramaglia',
        dni: '38123456',
        phone: '5493515490431',
        membershipTier: 'fundador' as const,
        position: 1,
        status: 'confirmed' as const,
        source: 'local_dev' as const,
        createdAt: new Date(),
      };
      this._sessionGeneration++;
      this._activeAuthUserId = (demoSocio as any).authUserId || null;
      this._activeAuthEmail = demoSocio.email.toLowerCase();
      this._currentMember.set(demoSocio);
      this.persistCurrentMember(demoSocio);
      this.setLoginSuccessFlag();
      this.checkAndNavigateReturnUrl();
      return {
        success: true,
        message: 'Modo desarrollo: Sesión local iniciada.',
      };
    }

    try {
      const savedReturnUrl = typeof window !== 'undefined' ? this.getAuthReturnUrl() : null;
      const redirectUrl =
        redirectTo ||
        (savedReturnUrl
          ? `${window.location.origin}${savedReturnUrl}`
          : typeof window !== 'undefined'
            ? `${window.location.origin}/perfil`
            : 'http://localhost:3000/perfil');

      const { error } = await this.supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        return { success: false, message: this.translateSupabaseError(error.message) };
      }

      return { success: true, message: 'Redirigiendo a Google para autenticación...' };
    } catch (err: any) {
      return {
        success: false,
        message: this.translateSupabaseError(err?.message) || 'Error al conectar con Google Auth.',
      };
    }
  }

  async getAuthenticatedMember(): Promise<WaitlistEntry | null> {
    if (!this.isSupabaseConnected()) {
      return null;
    }

    const { data } = await this.supabase.auth.getSession();
    const authEmail = data.session?.user.email?.trim().toLowerCase();
    if (!authEmail) {
      return null;
    }

    const current = this._currentMember();
    if (current && current.email.toLowerCase() !== authEmail) {
      this._sessionGeneration++;
      this._activeAuthUserId = data.session?.user.id || null;
      this._activeAuthEmail = authEmail;
      this._currentMember.set(null);
    }

    await this.isAuthenticated();
    const member = this._currentMember();
    return member?.email.toLowerCase() === authEmail && member.authUserId === data.session?.user.id
      ? member
      : null;
  }

  async getAuthenticatedEmail(): Promise<string | null> {
    if (!this.isSupabaseConnected()) {
      return null;
    }

    const { data } = await this.supabase.auth.getSession();
    return data.session?.user.email?.trim().toLowerCase() || null;
  }

  async getAuthenticatedName(): Promise<string | null> {
    if (!this.isSupabaseConnected()) {
      return null;
    }

    const { data } = await this.supabase.auth.getSession();
    const metadata = data.session?.user.user_metadata;
    const name = metadata?.['full_name'] || metadata?.['name'];
    return typeof name === 'string' && name.trim() ? name.trim() : null;
  }

  private translateSupabaseError(rawMessage?: string): string {
    if (!rawMessage) {
      return 'Ocurrió un error al procesar la solicitud. Intentá nuevamente.';
    }
    const msg = rawMessage.toLowerCase();
    if (msg.includes('invalid format') || msg.includes('unable to validate email')) {
      return 'Por favor, ingresá un correo electrónico con formato válido.';
    }
    if (msg.includes('invalid login credentials')) {
      return 'Las credenciales ingresadas no son válidas.';
    }
    if (msg.includes('rate limit') || msg.includes('too many requests')) {
      return 'Demasiados intentos seguidos. Por favor, aguardá unos minutos e intentá nuevamente.';
    }
    if (msg.includes('provider is not enabled') || msg.includes('unsupported provider')) {
      return 'El inicio de sesión con Google aún no está habilitado en el servidor.';
    }
    if (msg.includes('email not confirmed')) {
      return 'Tu correo electrónico aún no fue confirmado. Revisá tu bandeja de entrada.';
    }
    if (msg.includes('user not found')) {
      return 'No encontramos una cuenta asociada a este correo electrónico.';
    }
    if (msg.includes('failed to fetch') || msg.includes('network')) {
      return 'Error de conexión con el servidor. Verificá tu conexión a internet.';
    }
    return 'No pudimos completar la autenticación. Por favor, verificá tus datos e intentá nuevamente.';
  }

  async updateMemberProfile(data: {
    fullName: string;
    dni?: string;
    phone?: string;
    nationality?: string;
    experiencesWishlist?: string[];
    experiencesOther?: string;
  }): Promise<{ success: boolean; entry?: WaitlistEntry; message: string }> {
    const current = this._currentMember();
    if (!current) {
      return { success: false, message: 'No hay una sesión activa.' };
    }

    const cleanDni = data.dni ? data.dni.replace(/\D/g, '').slice(0, 9) : current.dni;
    const cleanPhone = data.phone ? data.phone.trim().slice(0, 25) : current.phone;

    // Si el usuario ingresó directo con Google OAuth sin haber creado aún su fila en `socios`,
    // al guardar su perfil con DNI y celular lo registramos oficialmente en `socios`:
    if (
      current.source === 'supabase_auth' &&
      !current.registrationToken &&
      cleanDni &&
      cleanPhone
    ) {
      const regRes = await this.registerSocio({
        fullName: data.fullName.trim().slice(0, 100),
        email: current.email,
        dni: cleanDni,
        phone: cleanPhone,
        experiencesWishlist: data.experiencesWishlist || current.experiencesWishlist,
        experiencesOther: data.experiencesOther ?? current.experiencesOther,
      });

      if (regRes.success && regRes.socio) {
        return {
          success: true,
          entry: regRes.socio,
          message: '¡Perfil de Socio guardado con éxito!',
        };
      }
      if (!regRes.alreadyRegistered) {
        return {
          success: false,
          message: regRes.message,
        };
      }
    }

    const updatedMember: WaitlistEntry = {
      ...current,
      fullName: data.fullName.slice(0, 100),
      dni: cleanDni,
      documentNumber: cleanDni,
      phone: cleanPhone,
      experiencesWishlist: data.experiencesWishlist || current.experiencesWishlist,
      experiencesOther: data.experiencesOther ?? current.experiencesOther,
    };

    if (this.isSupabaseConnected()) {
      try {
        const { data: rpcRes, error: rpcErr } = await this.supabase.rpc(
          'update_socio_profile_secure',
          {
            p_email: current.email.toLowerCase(),
            p_registration_token: current.registrationToken || null,
            p_full_name: updatedMember.fullName || null,
            p_dni: updatedMember.dni || null,
            p_phone: updatedMember.phone || null,
            p_experiences_wishlist: updatedMember.experiencesWishlist || [],
            p_experiences_other: updatedMember.experiencesOther || null,
          },
        );

        const rpcPayload = rpcRes as any;
        if (!rpcErr && rpcPayload?.status) {
          if (rpcPayload.status === 'dni_conflict') {
            return {
              success: false,
              message: 'Ya existe otro socio registrado con este número de DNI.',
            };
          }
          if (rpcPayload.status === 'unauthorized') {
            return {
              success: false,
              message: 'Por seguridad, iniciá sesión con Google para editar tu perfil.',
            };
          }
          if (rpcPayload.status === 'updated' && rpcPayload.socio) {
            const syncedEntry = mapDbRowToEntry(rpcPayload.socio);
            this._currentMember.set(syncedEntry);
            this.persistCurrentMember(syncedEntry);

            const syncedList = this._entries().map((e) =>
              e.id === syncedEntry.id || e.email === syncedEntry.email ? syncedEntry : e,
            );
            this._entries.set(syncedList);
            this.persistEntries(syncedList);

            return {
              success: true,
              entry: syncedEntry,
              message: '¡Perfil de Socio guardado con éxito!',
            };
          }
        }

        // Fallback si la RPC aún no fue ejecutada en Supabase
        const updatePayload: any = {
          full_name: updatedMember.fullName,
          dni: updatedMember.dni,
          phone: updatedMember.phone,
          experiences_wishlist: updatedMember.experiencesWishlist,
          experiences_other: updatedMember.experiencesOther || null,
          updated_at: new Date().toISOString(),
        };

        await this.supabase
          .from('socios')
          .update(updatePayload)
          .eq('email', current.email.toLowerCase());
      } catch (err) {
        console.warn('[Supabase] Error sincronizando socio:', err);
      }
    }

    this._currentMember.set(updatedMember);
    this.persistCurrentMember(updatedMember);

    const updatedEntries = this._entries().map((e) =>
      e.id === updatedMember.id || e.email === updatedMember.email ? updatedMember : e,
    );
    this._entries.set(updatedEntries);
    this.persistEntries(updatedEntries);

    return {
      success: true,
      entry: updatedMember,
      message: '¡Perfil de Socio guardado con éxito!',
    };
  }

  resetCurrentSubscription(): void {
    this._sessionGeneration++;
    this._activeAuthUserId = null;
    this._activeAuthEmail = null;
    this._currentMember.set(null);
    try {
      localStorage.removeItem(SUBSCRIBED_KEY);
      sessionStorage.removeItem(NewsletterService.GOOGLE_LOGIN_PENDING_KEY);
      sessionStorage.removeItem('experiencias_oauth_processed');
    } catch {
      /* ignore */
    }
    if (this.isSupabaseConnected()) {
      void this.supabase.auth.signOut().catch(() => {});
    }
  }

  async activateMonthlySubscription(details?: {
    paymentMethod?: string;
    email?: string;
    fullName?: string;
  }): Promise<{ success: boolean; message: string }> {
    this._isLoading.set(true);
    await new Promise((resolve) => setTimeout(resolve, 600));

    let member = this._currentMember();
    if (!member && details?.email) {
      await this.joinWaitlist({ email: details.email, fullName: details.fullName });
      member = this._currentMember();
    }

    if (!member) {
      this._isLoading.set(false);
      return {
        success: false,
        message: 'Ingresá tu correo electrónico para asociar la membresía.',
      };
    }

    const today = new Date();
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const subscription = {
      status: 'active' as const,
      tier: 'activo' as const,
      amountArs: 23000,
      paymentMethod: details?.paymentMethod || 'Tarjeta de Débito (•••• 4821)',
      startedAt: today.toISOString(),
      nextBillingDate: nextMonth.toLocaleDateString('es-AR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      autoRenew: true,
      lastPaymentReceipt: 'REC-' + Math.floor(100000 + Math.random() * 900000),
    };

    const updated: WaitlistEntry = {
      ...member,
      membershipTier: 'activo',
      subscription,
    };

    this._currentMember.set(updated);
    this.persistCurrentMember(updated);

    const updatedEntries = this._entries().map((e) =>
      e.id === updated.id || e.email === updated.email ? updated : e,
    );
    this._entries.set(updatedEntries);
    this.persistEntries(updatedEntries);

    if (this.isSupabaseConnected()) {
      try {
        await this.supabase
          .from('socios')
          .update({ membership_tier: 'activo' })
          .eq('email', member.email.toLowerCase());
      } catch {
        // Ignorar
      }
    }

    this._isLoading.set(false);
    return { success: true, message: '¡Membresía Mensual activada con éxito!' };
  }

  cancelMonthlySubscription(): { success: boolean; message: string } {
    const member = this._currentMember();
    if (!member || !member.subscription) {
      return { success: false, message: 'No hay una suscripción activa.' };
    }

    const updated: WaitlistEntry = {
      ...member,
      membershipTier: 'emergente',
      subscription: {
        ...member.subscription,
        status: 'cancelled',
        autoRenew: false,
      },
    };

    this._currentMember.set(updated);
    this.persistCurrentMember(updated);
    return {
      success: true,
      message: 'Suscripción cancelada con éxito. Continuás como Socio Emergente.',
    };
  }

  pauseMonthlySubscription(): { success: boolean; message: string } {
    const member = this._currentMember();
    if (!member || !member.subscription) {
      return { success: false, message: 'No hay una suscripción activa.' };
    }

    const updated: WaitlistEntry = {
      ...member,
      subscription: {
        ...member.subscription,
        status: 'paused',
        autoRenew: false,
      },
    };

    this._currentMember.set(updated);
    this.persistCurrentMember(updated);
    return { success: true, message: 'Suscripción pausada temporalmente.' };
  }

  resumeMonthlySubscription(): { success: boolean; message: string } {
    const member = this._currentMember();
    if (!member || !member.subscription) {
      return { success: false, message: 'No hay una suscripción activa.' };
    }

    const updated: WaitlistEntry = {
      ...member,
      membershipTier: 'activo',
      subscription: {
        ...member.subscription,
        status: 'active',
        autoRenew: true,
      },
    };

    this._currentMember.set(updated);
    this.persistCurrentMember(updated);
    return { success: true, message: 'Suscripción reactivada con éxito.' };
  }

  updateSubscriptionPaymentMethod(newMethod: string): { success: boolean; message: string } {
    const member = this._currentMember();
    if (!member || !member.subscription) {
      return { success: false, message: 'No hay una suscripción activa.' };
    }

    const updated: WaitlistEntry = {
      ...member,
      subscription: {
        ...member.subscription,
        paymentMethod: newMethod,
      },
    };

    this._currentMember.set(updated);
    this.persistCurrentMember(updated);
    return { success: true, message: 'Método de pago actualizado con éxito.' };
  }

  async submitProviderApplication(data: {
    fullName: string;
    agency?: string;
    category: string;
    region: string;
    email: string;
    phone: string;
    website: string;
    description: string;
    autoApprove?: boolean;
    tier?: 'emergente' | 'pleno' | 'fundador';
  }): Promise<{ success: boolean; alreadyRegistered?: boolean; approved?: boolean; message?: string }> {
    const cleanEmail = data.email.trim().toLowerCase();
    const shouldAutoApprove = Boolean(data.autoApprove);
    const resolvedTier = data.tier || 'emergente';
    const rawSlugBase = (data.agency || data.fullName || cleanEmail.split('@')[0] || 'prestador')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
    const generatedSlug = shouldAutoApprove
      ? `${rawSlugBase || 'prestador'}-${Math.random().toString(36).slice(2, 6)}`
      : '';

    // Verificar si el prestador está dado de baja localmente (y no fue borrado por el admin)
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const deletedRaw = localStorage.getItem('catamarca_deleted_provider_ids_v1');
        const deletedArr: string[] = deletedRaw ? JSON.parse(deletedRaw) : [];
        const isDeletedFromUi = deletedArr.some((s) => s.toLowerCase() === cleanEmail);

        if (isDeletedFromUi) {
          // Si el admin lo borró de la interfaz, liberamos el email para que pueda postularse de nuevo
          const updatedDeleted = deletedArr.filter((s) => s.toLowerCase() !== cleanEmail);
          localStorage.setItem('catamarca_deleted_provider_ids_v1', JSON.stringify(updatedDeleted));
        } else {
          const provRaw = localStorage.getItem('catamarca_providers_registry_v5');
          if (provRaw) {
            const list = JSON.parse(provRaw);
            if (Array.isArray(list)) {
              const matched = list.find((p: any) => (p.email || '').toLowerCase().trim() === cleanEmail);
              if (matched && matched.status === 'dado_de_baja') {
                return {
                  success: false,
                  alreadyRegistered: true,
                  message:
                    'Tu cuenta de prestador se encuentra dada de baja. Si necesitás reactivarla o tenés dudas, contactá al soporte del Club.',
                };
              }
            }
          }
        }
      }
    } catch {
      // ignore
    }

    if (this.isSupabaseConnected()) {
      try {
        // 1. Manejo seguro de correos existentes vía RPC (Security Definer), sin depender de SELECT anónimo
        try {
          const { data: statusRes, error: rpcErr } = await (this.supabase as any).rpc(
            'check_provider_status',
            { p_email: cleanEmail },
          );

          if (!rpcErr && statusRes && typeof (statusRes as any).status === 'string') {
            const st = (statusRes as any).status;
            if (st === 'pending') {
              return {
                success: false,
                alreadyRegistered: true,
                message:
                  'Ya recibimos una postulación con este correo electrónico y se encuentra en revisión.',
              };
            }
            if (st === 'approved') {
              return {
                success: false,
                alreadyRegistered: true,
                message:
                  'Este correo electrónico ya pertenece a un prestador registrado en la plataforma.',
              };
            }
            if (st === 'inactive') {
              return {
                success: false,
                alreadyRegistered: true,
                message:
                  'Tu cuenta de prestador se encuentra dada de baja. Si necesitás reactivarla o tenés dudas, contactá al soporte del Club.',
              };
            }
          }
        } catch (rpcEx) {
          console.warn('[NewsletterService] Fallback verificación de estado de prestador:', rpcEx);
        }

        // 2. Ruta insert-only para nuevas postulaciones (evita upsert que requiere SELECT/UPDATE)
        const accessPayload: Record<string, unknown> = {
          email: cleanEmail,
          name: data.fullName.trim(),
          ...(data.agency !== undefined ? { agency: (data.agency || '').trim() } : {}),
          phone: data.phone.trim(),
          category: data.category.trim() || 'guia_montaña',
          region: data.region.trim() || 'Puna & Fiambalá',
          website: data.website.trim(),
          description: data.description.trim(),
          status: shouldAutoApprove ? 'aprobado' : 'pendiente',
          active: shouldAutoApprove,
          ...(data.tier !== undefined ? { tier: resolvedTier } : {}),
          ...(generatedSlug ? { slug: generatedSlug } : {}),
        };

        const { error: paError } = await (this.supabase.from('prestadores') as any).insert(
          accessPayload,
        );

        if (paError) {
          const isDuplicate =
            paError.code === '23505' ||
            /duplicate|unique|already exists|prestadores_email_key/i.test(paError.message || '');
          if (isDuplicate) {
            return {
              success: false,
              alreadyRegistered: true,
              message: 'Ya existe una postulación o registro con este correo electrónico.',
            };
          }

          // Fallback vía RPC Security Definer en caso de error de privilegios (42501) en tabla
          let fallbackSuccess = false;
          let rpcErr: any = null;
          let rpcRes: any = null;
          try {
            let rpcResult = await (this.supabase as any).rpc(
              'submit_provider_application',
              {
                p_name: data.fullName.trim(),
                p_email: cleanEmail,
                p_agency: (data.agency || '').trim(),
                p_phone: data.phone.trim(),
                p_category: data.category.trim() || 'guia_montaña',
                p_region: data.region.trim() || 'Puna & Fiambalá',
                p_website: data.website.trim(),
                p_description: data.description.trim(),
                p_auto_approve: shouldAutoApprove,
                p_tier: resolvedTier,
              },
            );
            // Si la función remota aún no tiene los parámetros p_auto_approve/p_tier, reintentar firma anterior
            if (rpcResult?.error && /function.*submit_provider_application|PGRST202/i.test(rpcResult.error.message || rpcResult.error.code || '')) {
              rpcResult = await (this.supabase as any).rpc(
                'submit_provider_application',
                {
                  p_name: data.fullName.trim(),
                  p_email: cleanEmail,
                  p_agency: (data.agency || '').trim(),
                  p_phone: data.phone.trim(),
                  p_category: data.category.trim() || 'guia_montaña',
                  p_region: data.region.trim() || 'Puna & Fiambalá',
                  p_website: data.website.trim(),
                  p_description: data.description.trim(),
                },
              );
            }
            rpcRes = rpcResult?.data;
            rpcErr = rpcResult?.error;

            if (!rpcErr && rpcRes) {
              if (rpcRes.success) {
                fallbackSuccess = true;
              } else if (rpcRes.already_registered) {
                return {
                  success: false,
                  alreadyRegistered: true,
                  message:
                    rpcRes.message ||
                    'Ya existe una postulación o registro con este correo electrónico.',
                };
              } else if (rpcRes.error === 'invalid_email') {
                return {
                  success: false,
                  message:
                    rpcRes.message || 'El correo electrónico ingresado no es válido.',
                };
              }
            }
          } catch (rpcFallbackErr) {
            rpcErr = rpcFallbackErr;
            console.warn('[NewsletterService] Fallback RPC submit_provider_application:', rpcFallbackErr);
          }

          if (!fallbackSuccess) {
            console.warn(
              '[Supabase] Error guardando postulación de prestador en prestadores:',
              paError,
              { rpcErr, rpcRes },
            );
            return {
              success: false,
              message:
                'El sistema de postulaciones no pudo procesar la solicitud en este momento por un inconveniente técnico de recepción en el servidor. Por favor intentá nuevamente en unos instantes o avisanos por WhatsApp.',
            };
          }
        }
      } catch (err) {
        console.warn('[Supabase] Error guardando postulación de prestador:', err);
        return {
          success: false,
          message:
            'El sistema no pudo procesar la postulación en este momento por una interrupción momentánea de recepción. Por favor intentá nuevamente en unos minutos o comunicate con nosotros.',
        };
      }
    }

    void this.notificationService
      .notifyProviderApplicationSubmitted({
        fullName: data.fullName.trim(),
        category: data.category.trim(),
        region: data.region.trim(),
        email: cleanEmail,
        phone: data.phone.trim(),
        website: data.website.trim(),
        description: data.description.trim(),
      })
      .catch((notifyErr) => {
        console.warn('[NewsletterService] Error enviando notificación de postulación:', notifyErr);
      });

    return { success: true, approved: shouldAutoApprove };
  }

  async submitFounderApplication(data: {
    fullName: string;
    email: string;
    phone: string;
    motivationLetter: string;
    agreedToProtocol: boolean;
  }): Promise<{ success: boolean }> {
    if (this.isSupabaseConnected()) {
      try {
        const cleanEmail = data.email.trim().toLowerCase();
        // Evitar duplicaciones verificando si ya existe una postulación previa para este email
        const { data: existing } = await this.supabase
          .from('postulaciones_fundadores' as any)
          .select('id')
          .ilike('email', cleanEmail)
          .limit(1)
          .maybeSingle();

        if (existing && (existing as any).id) {
          await this.supabase
            .from('postulaciones_fundadores' as any)
            .update({
              full_name: data.fullName.trim(),
              phone: data.phone.trim(),
              motivation_letter: data.motivationLetter.trim(),
              agreed_to_protocol: data.agreedToProtocol,
              updated_at: new Date().toISOString(),
            })
            .eq('id', (existing as any).id);
        } else {
          await this.supabase.from('postulaciones_fundadores' as any).insert({
            full_name: data.fullName.trim(),
            email: cleanEmail,
            phone: data.phone.trim(),
            motivation_letter: data.motivationLetter.trim(),
            agreed_to_protocol: data.agreedToProtocol,
          });
        }
      } catch (err) {
        console.warn('[Supabase] Error guardando postulación de fundador:', err);
      }
    }
    return { success: true };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private loadReservedSpots(): number {
    try {
      const stored = localStorage.getItem(SPOTS_KEY);
      if (stored) {
        return parseInt(stored, 10);
      }
      const member = localStorage.getItem(SUBSCRIBED_KEY);
      return member ? 11 : 10;
    } catch {
      return 10;
    }
  }

  private loadStoredEntries(): WaitlistEntry[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private persistEntries(entries: WaitlistEntry[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      /* ignore */
    }
  }

  private loadCurrentMember(): WaitlistEntry | null {
    try {
      const data = localStorage.getItem(SUBSCRIBED_KEY);
      if (!data) return null;
      const parsed: WaitlistEntry = JSON.parse(data);
      const expiresIso = parsed.plenoExpiresAt || parsed.subscription?.expiresAt || null;
      if (
        (parsed.membershipTier === 'activo' || (parsed.membershipTier as string) === 'pleno') &&
        expiresIso &&
        Number.isFinite(Date.parse(expiresIso)) &&
        Date.parse(expiresIso) <= Date.now()
      ) {
        const downgraded: WaitlistEntry = {
          ...parsed,
          membershipTier: 'emergente',
          subscription: parsed.subscription
            ? { ...parsed.subscription, status: 'cancelled' }
            : undefined,
        };
        localStorage.setItem(SUBSCRIBED_KEY, JSON.stringify(downgraded));
        return downgraded;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  persistCurrentMember(entry: WaitlistEntry): void {
    try {
      localStorage.setItem(SUBSCRIBED_KEY, JSON.stringify(entry));
    } catch {
      /* ignore */
    }
  }

  updateCurrentMemberWishlist(wishlist: string[]): void {
    const current = this._currentMember();
    if (!current) return;
    const updated: WaitlistEntry = {
      ...current,
      experiencesWishlist: [...wishlist],
    };
    this._currentMember.set(updated);
    this.persistCurrentMember(updated);
  }

  private loadUsedMemberDiscounts(): string[] {
    try {
      const stored = localStorage.getItem(USED_MEMBER_DISCOUNTS_KEY);
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) && parsed.every((code) => typeof code === 'string')
        ? parsed
        : [];
    } catch {
      return [];
    }
  }

  private loadLastProspectEmail(): string {
    try {
      return localStorage.getItem(PROSPECT_EMAIL_KEY) || '';
    } catch {
      return '';
    }
  }

  private persistProspectEmail(email: string): void {
    try {
      localStorage.setItem(PROSPECT_EMAIL_KEY, email);
    } catch {
      /* ignore */
    }
  }
}
