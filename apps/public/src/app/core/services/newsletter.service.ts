import { Injectable, signal, computed, inject } from '@angular/core';
import { WaitlistEntry, WaitlistSubmissionDto, WaitlistStats } from '../models/waitlist.model';
import { DiscountCode } from '../models/bank-transfer.model';
import { SUPABASE_CLIENT, isSupabaseConfigured } from '../supabase/supabase.client';

const STORAGE_KEY = 'catamarca_club_waitlist';
const SUBSCRIBED_KEY = 'catamarca_club_user_subscribed';
const SPOTS_KEY = 'catamarca_club_reserved_spots';
const USED_MEMBER_DISCOUNTS_KEY = 'catamarca_club_used_member_discounts';
const PROSPECT_EMAIL_KEY = 'catamarca_club_prospect_email';

function mapDbRowToEntry(row: any): WaitlistEntry {
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
    membershipTier: row.membership_tier || 'emergente',
    authUserId: row.auth_user_id || undefined,
  };
}

/**
 * NewsletterService — Conexión a Supabase (separación de waitlist y socios)
 *
 * 1. waitlist: Tabla sencilla de prospectos desde la landing page (/)
 * 2. socios: Tabla oficial de miembros (arranca en 100) con DNI, Celular y experiencias
 */
@Injectable({
  providedIn: 'root',
})
export class NewsletterService {
  private readonly supabase = inject(SUPABASE_CLIENT);
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

  readonly profileSuccessHighlight = signal<boolean>(false);

  constructor() {
    this.initSupabaseData();
  }

  private async initSupabaseData(): Promise<void> {
    if (!this.isSupabaseConnected()) return;

    try {
      const { data: statsData } = await this.supabase
        .from('waitlist_stats')
        .select('*')
        .maybeSingle();

      if (statsData?.total_members) {
        const count = Number(statsData.total_members);
        const spots = Math.min(60, Math.max(10, count));
        this._reservedSpots.set(spots);
      }

      const current = this._currentMember();
      if (current?.email) {
        const { data: remoteSocio } = await this.supabase
          .from('socios')
          .select('*')
          .eq('email', current.email.toLowerCase())
          .maybeSingle();

        if (remoteSocio) {
          const mapped = mapDbRowToEntry(remoteSocio);
          this._currentMember.set(mapped);
          this.persistCurrentMember(mapped);
        }
      }

      // Escuchar cambios de sesión en Supabase Auth (ej. Login con Google)
      this.supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user?.email) {
          const authEmail = session.user.email.toLowerCase();
          const authId = session.user.id;

          try {
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
              this.setLoginSuccessFlag();
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
            fullName: data.session.user.user_metadata?.['full_name'] || authEmail.split('@')[0],
            dni: '',
            phone: '',
            membershipTier: 'emergente',
            authUserId: data.session.user.id,
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
    const member = this._currentMember();
    return member?.membershipTier === 'activo' || member?.subscription?.status === 'active';
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
    const code = rawCode.trim().toUpperCase();
    const member = this._currentMember();
    if (!member || this.usedMemberDiscounts.has(code)) return undefined;

    if (member.membershipTier === 'fundador' && code === 'FUNDADOR20') {
      return { code, percentOff: 20, label: '20% socios fundadores' };
    }

    if (member.membershipTier === 'activo' && code === 'SOCIO10') {
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
   * 1. Paso Landing (/): Guarda correo ágilmente en la tabla waitlist
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

    this.lastProspectEmail.set(cleanEmail);
    this.persistProspectEmail(cleanEmail);

    if (this.isSupabaseConnected()) {
      try {
        const { error } = await this.supabase
          .from('waitlist')
          .upsert({ email: cleanEmail }, { onConflict: 'email', ignoreDuplicates: true });

        if (error) {
          console.warn('[Supabase] Advertencia guardando en waitlist:', error.message);
        }
      } catch (err) {
        console.warn('[Supabase] Error registrando prospecto en waitlist:', err);
      }
    }

    this._isLoading.set(false);
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

    // 1. Guardar en Supabase si está conectado
    if (this.isSupabaseConnected()) {
      try {
        // Verificar si ya existe socio con ese email
        const { data: existing } = await this.supabase
          .from('socios')
          .select('*')
          .eq('email', cleanEmail)
          .maybeSingle();

        if (existing) {
          this._isLoading.set(false);
          return {
            success: false,
            alreadyRegistered: true,
            message:
              'Ya completaste el formulario de Socio con este correo. Por favor, iniciá sesión vía Google para ingresar a tu perfil.',
          };
        } else {
          // Insertar nuevo socio con número secuencial automático (desde 100)
          const { data: inserted, error: insErr } = await this.supabase
            .from('socios')
            .insert({
              email: cleanEmail,
              full_name: cleanName,
              dni: cleanDni,
              phone: cleanPhone,
              experiences_wishlist: dto.experiencesWishlist || [],
              experiences_other: dto.experiencesOther || null,
              membership_tier: 'emergente',
            })
            .select()
            .single();

          if (!insErr && inserted) {
            const entry = mapDbRowToEntry(inserted);
            const updatedEntries = [entry, ...this._entries()];
            this._entries.set(updatedEntries);
            this._currentMember.set(entry);
            this.persistEntries(updatedEntries);
            this.persistCurrentMember(entry);

            // Marcar en waitlist como convertido
            this.supabase
              .from('waitlist')
              .update({ converted: true })
              .eq('email', cleanEmail)
              .then(() => {});

            this._isLoading.set(false);
            this.setLoginSuccessFlag();
            return {
              success: true,
              socio: entry,
              message: `¡Bienvenido al Club! Sos el Socio Emergente #${entry.position}.`,
            };
          }
        }
      } catch (err) {
        console.warn('[Supabase] Error registrando socio en remoto:', err);
      }
    }

    // 2. Fallback local / simulación si no está conectado
    await new Promise((resolve) => setTimeout(resolve, 350));

    const existingLocal = this._entries().find((e) => e.email === cleanEmail);
    if (existingLocal && existingLocal.dni) {
      this._isLoading.set(false);
      return {
        success: false,
        alreadyRegistered: true,
        message:
          'Ya completaste el formulario de Socio con este correo. Por favor, iniciá sesión vía Google para ingresar a tu perfil.',
      };
    }

    const position = existingLocal ? existingLocal.position : this.baseWaitlistCount + this._entries().length;

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

    return {
      success: true,
      socio: newSocio,
      message: `¡Bienvenido al Club! Sos el Socio Emergente #${position}.`,
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
  async loginWithEmail(
    email: string,
  ): Promise<{
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

    // 1. Consultar socios y waitlist en paralelo en Supabase
    if (this.isSupabaseConnected()) {
      try {
        const [socioRes, waitlistRes] = await Promise.all([
          this.supabase.from('socios').select('*').eq('email', cleanEmail).maybeSingle(),
          this.supabase
            .from('waitlist')
            .select('id, email, converted')
            .eq('email', cleanEmail)
            .maybeSingle(),
        ]);

        if (!socioRes.error && socioRes.data) {
          this._isLoading.set(false);
          return {
            success: false,
            alreadyRegisteredSocio: true,
            message:
              'Ya completaste el formulario de Socio con este correo. Por favor, iniciá sesión vía Google para acceder a tu perfil.',
          };
        }

        if (!waitlistRes.error && waitlistRes.data) {
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
      } catch (err) {
        console.warn('[Supabase] Error en loginWithEmail:', err);
      }
    }

    // 2. Buscar en caché local
    const localEntry = this._entries().find((e) => e.email === cleanEmail);
    if (localEntry) {
      this._isLoading.set(false);
      return {
        success: false,
        alreadyRegisteredSocio: true,
        message:
          'Ya completaste el formulario de Socio con este correo. Por favor, iniciá sesión vía Google para acceder a tu perfil.',
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

  async signInWithGoogle(): Promise<{ success: boolean; message: string }> {
    if (!this.isSupabaseConnected()) {
      return {
        success: false,
        message: 'Modo local activo. Conexión a Supabase Auth no disponible.',
      };
    }

    try {
      const redirectUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}/perfil`
          : 'http://localhost:3000/perfil';

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

    const updatedMember: WaitlistEntry = {
      ...current,
      fullName: data.fullName.slice(0, 100),
      dni: cleanDni,
      documentNumber: cleanDni,
      phone: cleanPhone,
      experiencesWishlist: data.experiencesWishlist || current.experiencesWishlist,
      experiencesOther: data.experiencesOther ?? current.experiencesOther,
    };

    this._currentMember.set(updatedMember);
    this.persistCurrentMember(updatedMember);

    const updatedEntries = this._entries().map((e) =>
      e.id === updatedMember.id || e.email === updatedMember.email ? updatedMember : e,
    );
    this._entries.set(updatedEntries);
    this.persistEntries(updatedEntries);

    if (this.isSupabaseConnected()) {
      try {
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

    return {
      success: true,
      entry: updatedMember,
      message: '¡Perfil de Socio guardado con éxito!',
    };
  }

  resetCurrentSubscription(): void {
    this._currentMember.set(null);
    try {
      localStorage.removeItem(SUBSCRIBED_KEY);
    } catch {
      /* ignore */
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
      amountArs: 12000,
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
    category: string;
    region: string;
    email: string;
    phone: string;
    website: string;
    description: string;
  }): Promise<{ success: boolean }> {
    if (this.isSupabaseConnected()) {
      try {
        await this.supabase.from('postulaciones_prestadores').insert({
          full_name: data.fullName.trim(),
          category: data.category.trim() || 'guia_montaña',
          region: data.region.trim() || 'Puna & Fiambalá',
          email: data.email.trim().toLowerCase(),
          phone: data.phone.trim(),
          website: data.website.trim(),
          description: data.description.trim(),
        });
      } catch (err) {
        console.warn('[Supabase] Error guardando postulación de prestador:', err);
      }
    }
    return { success: true };
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
        await this.supabase.from('postulaciones_fundadores').insert({
          full_name: data.fullName.trim(),
          email: data.email.trim().toLowerCase(),
          phone: data.phone.trim(),
          motivation_letter: data.motivationLetter.trim(),
          agreed_to_protocol: data.agreedToProtocol,
        });
      } catch (err) {
        console.warn('[Supabase] Error guardando postulación de fundador:', err);
      }
    }
    return { success: true };
  }

  // ── Helpers privados ────────────────────────────────────────────────────────

  private isValidEmail(email: string): boolean {
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
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  private persistCurrentMember(entry: WaitlistEntry): void {
    try {
      localStorage.setItem(SUBSCRIBED_KEY, JSON.stringify(entry));
    } catch {
      /* ignore */
    }
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
