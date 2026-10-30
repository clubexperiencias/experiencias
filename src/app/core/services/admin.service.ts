import { Injectable, signal, computed } from '@angular/core';
import { AdminUser, AdminDashboardMetrics } from '../models/admin.model';
import { ActivityRecord } from '../models/activity-history.model';

const ADMIN_AUTH_KEY = 'catamarca_club_admin_session';
const ADMIN_USERS_STORAGE_KEY = 'catamarca_club_admin_users';

@Injectable({
  providedIn: 'root',
})
export class AdminService {
  // Estado de sesión admin
  private readonly _isAdminLoggedIn = signal<boolean>(this.loadAdminSession());
  readonly isAdminLoggedIn = this._isAdminLoggedIn.asReadonly();

  // Mock robusto de usuarios registrados, incluyendo el usuario 654 solicitado
  private readonly initialUsers: AdminUser[] = [
    {
      id: '654',
      memberNumber: 'EXP-0654',
      email: 'ignacio.balcarce@cordillera.ar',
      fullName: 'Ignacio Balcarce',
      phone: '+54 9 3834 77-8912',
      nationality: 'Argentina',
      bio: 'Socio de montaña y fotógrafo documental. Socio Fundador y chofer matriculado 4x4 en la zona de Fiambalá y Seismiles.',
      membershipTier: 'fundador',
      status: 'activo',
      isProvider: true,
      providerDetail: {
        category: 'Guía de Alta Montaña & Chofer 4x4',
        zone: 'Fiambalá & Paso de San Francisco',
        vehicleDescription: 'Toyota Land Cruiser Prado 4x4 preparada con auxilio doble y snorkel',
        licenseNumber: 'GUI-CAT-2024-0412',
        certifications: [
          'WFR Socorrismo en Zonas Agrestes',
          'Radioaficionado VHF Cordillera',
          'Mecánica de Emergencia 4x4',
        ],
        status: 'habilitado',
        registeredDate: '12/03/2026',
      },
      registeredAt: '12/03/2026',
      subscription: {
        status: 'active',
        tier: 'fundador',
        amountArs: 250000,
        paymentMethod: 'Transferencia CBU Oficial Banco Nación',
        startedAt: '12/03/2026',
        nextBillingDate: 'Vitalicio Anual (Exento de cuota mensual)',
        autoRenew: true,
        lastPaymentReceipt: 'REC-2026-FND-0012',
      },
      activities: [
        {
          id: 'act_654_01',
          slug: 'kayak-las-jumeal',
          userId: '654',
          experienceId: 'exp_kayak_jumeal',
          title: 'Travesía en Kayak & Sunset en El Jumeal',
          region: 'Valle Central y Ambato',
          altitude: '850 msnm',
          coverImage: '/assets/images/kayak-club-de-experiencias.jpg',
          dateLabel: '18 de Octubre, 2026',
          status: 'completada',
          description:
            'Navegación en kayak de travesía por el dique El Jumeal al atardecer, exploración de quebradas rojizas y cierre con tertulia y degustación de vinos catamarqueños.',
          provider: {
            name: 'Travesías Náuticas Ambato (Guía Lucas Albarracín)',
            category: 'Kayak & Deportes Náuticos',
            contactPhone: '+54 9 3834 89-2104',
          },
          receipt: {
            receiptNumber: 'REC-2026-CAT-0104',
            transactionId: 'MP-9281748291',
            gateway: 'mercadopago',
            gatewayDisplayName: 'Mercado Pago (Dinero en Cuenta)',
            amountArs: 65000,
            amountUsd: 70,
            paidAt: '18/10/2026 14:32 hs',
            paymentMethodSummary: 'Mercado Pago · Saldo en cuenta',
            payerEmail: 'ignacio.balcarce@cordillera.ar',
            payerName: 'Ignacio Balcarce',
            authCode: 'AUTH-MP-89214',
            status: 'aprobado',
          },
          memoriesCount: 4,
          memoryPhotos: ['/assets/images/kayak-club-de-experiencias.jpg'],
          communityPhotos: [
            {
              id: 'cp_101',
              url: '/assets/images/kayak-club-de-experiencias.jpg',
              caption: 'Atardecer dorado sobre el espejo de agua de El Jumeal',
              uploadedBy: 'Lucas A.',
              uploadedAt: '18/10/2026',
            },
            {
              id: 'cp_102',
              url: '/assets/images/laguna_blanca.jpg',
              caption: 'Preparando las palas antes del ingreso al lago',
              uploadedBy: 'Sofía M.',
              uploadedAt: '18/10/2026',
            },
          ],
          reviews: [
            {
              id: 'rev_101',
              authorSignature: 'Ignacio B.',
              rating: 5,
              comment:
                'Remada excelente con el sunset sobre el dique. Una gran experiencia para conectar con el agua en Catamarca.',
              createdAt: '19/10/2026',
            },
            {
              id: 'rev_102',
              authorSignature: 'Clara S.',
              rating: 5,
              comment:
                'La tranquilidad del dique y el silencio entre las quebradas fue mágico. El guía Lucas súper atento en todo momento.',
              createdAt: '19/10/2026',
            },
          ],
          userReview: {
            rating: 5,
            comment:
              'Remada excelente con el sunset sobre el dique. Una gran experiencia para conectar con el agua en Catamarca.',
            authorSignature: 'Ignacio B.',
          },
        },
        {
          id: 'act_654_02',
          slug: 'campo-de-piedra-pomez',
          userId: '654',
          experienceId: 'exp_pomez',
          title: 'Campo de Piedra Pómez & Duna Gigante',
          region: 'Antofagasta de la Sierra',
          altitude: '3.300 msnm',
          coverImage: '/assets/images/piedra-pomez.png',
          dateLabel: '24 de Noviembre, 2026 (Próxima salida)',
          status: 'confirmada',
          description:
            'Expedición en vehículos 4x4 cruzando el mar de ceniza volcánica blanca petrificada en la Puna catamarqueña y ascenso a la duna gigante.',
          provider: {
            name: 'Expediciones Puna 4x4 (Mariano Carrizo)',
            category: 'Transporte & Guía 4x4',
            contactPhone: '+54 9 3834 55-9012',
          },
          receipt: {
            receiptNumber: 'REC-2026-CAT-0238',
            transactionId: 'TX-PROP-849102',
            gateway: 'custom',
            gatewayDisplayName: 'Pasarela Propia · Transferencia Inmediata',
            amountArs: 185000,
            amountUsd: 190,
            paidAt: '20/10/2026 11:15 hs',
            paymentMethodSummary: 'Transferencia CBU Banco Nación a Club Catamarca',
            cbuDestination: '0110452330045298124012 (Alias: CLUB.CATAMARCA.VIAJES)',
            payerEmail: 'ignacio.balcarce@cordillera.ar',
            payerName: 'Ignacio Balcarce',
            authCode: 'CBU-TRF-4910294',
            status: 'aprobado',
          },
          memoriesCount: 2,
          memoryPhotos: ['/assets/images/piedra-pomez.png'],
          communityPhotos: [
            {
              id: 'cp_201',
              url: '/assets/images/piedra-pomez.png',
              caption: 'Laberinto de esculturas naturales de piedra pómez',
              uploadedBy: 'Mariano C.',
              uploadedAt: '20/10/2026',
            },
          ],
          reviews: [],
          userReview: undefined,
        },
      ],
      totalSpentArs: 500000,
      totalSpentUsd: 510,
      adminNotes:
        'Socio Fundador certificado. Validado en registro de prestadores de turismo aventura de Catamarca.',
    },
    {
      id: '102',
      memberNumber: 'EXP-0102',
      email: 'clara.sanchez@aventura.com',
      fullName: 'Clara Sánchez Varela',
      phone: '+54 9 11 4452-9012',
      nationality: 'Argentina',
      bio: 'Entusiasta del trekking y kayak de travesía. Viajera frecuente del noroeste argentino.',
      membershipTier: 'activo',
      status: 'activo',
      isProvider: false,
      registeredAt: '04/05/2026',
      subscription: {
        status: 'active',
        tier: 'activo',
        amountArs: 18500,
        paymentMethod: 'Tarjeta de Crédito Visa **** 4912',
        startedAt: '04/05/2026',
        nextBillingDate: '04/11/2026',
        autoRenew: true,
        lastPaymentReceipt: 'REC-2026-SUB-0491',
      },
      activities: [],
      totalSpentArs: 74000,
      totalSpentUsd: 78,
      adminNotes: 'Membresía activa al día. Sin incidencias de cobro.',
    },
    {
      id: '205',
      memberNumber: 'EXP-0205',
      email: 'marcos.guia.cat@gmail.com',
      fullName: 'Marcos A. Carrizo',
      phone: '+54 9 3834 62-1109',
      nationality: 'Argentina',
      bio: 'Baqueano y prestador en Antofagasta de la Sierra. Especialista en travesías 4x4 en la Puna y volcán Galán.',
      membershipTier: 'emergente',
      status: 'activo',
      isProvider: true,
      providerDetail: {
        category: 'Transporte Especializado 4x4 & Baqueano Puneño',
        zone: 'Antofagasta de la Sierra / El Peñón',
        vehicleDescription: 'Ford Ranger 4x4 equipada con cubiertas AT y tanque suplementario',
        licenseNumber: 'BAQ-ANT-2025-0089',
        certifications: ['Guía Local Habilitado', 'Primeros Auxilios Cruz Roja'],
        status: 'habilitado',
        registeredDate: '15/06/2026',
      },
      registeredAt: '15/06/2026',
      activities: [],
      totalSpentArs: 0,
      totalSpentUsd: 0,
      adminNotes: 'Prestador habilitado en red local. Registro gratuito verificado.',
    },
    {
      id: '318',
      memberNumber: 'EXP-0318',
      email: 'lucas.explora@yahoo.com.ar',
      fullName: 'Lucas Menéndez',
      phone: '+54 9 351 512-8801',
      nationality: 'Argentina',
      bio: 'Aficionado al astroturismo y la fotografía nocturna en zonas de altura.',
      membershipTier: 'emergente',
      status: 'pendiente',
      isProvider: false,
      registeredAt: '22/09/2026',
      activities: [],
      totalSpentArs: 0,
      totalSpentUsd: 0,
      adminNotes: 'Registrado en lista de espera para la próxima temporada de astroturismo.',
    },
  ];

  private readonly _users = signal<AdminUser[]>(this.loadStoredUsers());
  readonly users = this._users.asReadonly();

  readonly metrics = computed<AdminDashboardMetrics>(() => {
    const list = this._users();
    const activeSub = list.filter(
      (u) => u.membershipTier === 'activo' || u.subscription?.status === 'active',
    ).length;
    const founders = list.filter((u) => u.membershipTier === 'fundador').length;
    const emergents = list.filter((u) => u.membershipTier === 'emergente').length;
    const providers = list.filter((u) => u.isProvider).length;
    const revArs = list.reduce((acc, u) => acc + (u.totalSpentArs || 0), 0);
    const revUsd = list.reduce((acc, u) => acc + (u.totalSpentUsd || 0), 0);
    const totalActs = list.reduce((acc, u) => acc + (u.activities?.length || 0), 0);

    return {
      totalRegistered: list.length,
      activeSubscribers: activeSub,
      founderMembers: founders,
      emergentMembers: emergents,
      registeredProviders: providers,
      totalRevenueArs: revArs,
      totalRevenueUsd: revUsd,
      recentActivityCount: totalActs,
    };
  });

  login(password: string): boolean {
    // Clave administrativa por defecto para pruebas y acceso seguro
    if (
      password === 'admin2026' ||
      password === 'experiencias' ||
      password.trim().toLowerCase() === 'admin'
    ) {
      this._isAdminLoggedIn.set(true);
      try {
        localStorage.setItem(ADMIN_AUTH_KEY, 'true');
      } catch {}
      return true;
    }
    return false;
  }

  logout(): void {
    this._isAdminLoggedIn.set(false);
    try {
      localStorage.removeItem(ADMIN_AUTH_KEY);
    } catch {}
  }

  getUserById(id: string): AdminUser | undefined {
    return this._users().find(
      (u) => u.id === id || u.memberNumber === id || u.email.toLowerCase() === id.toLowerCase(),
    );
  }

  updateUser(id: string, updates: Partial<AdminUser>): void {
    const updated = this._users().map((u) => (u.id === id ? { ...u, ...updates } : u));
    this._users.set(updated);
    this.persistUsers(updated);
  }

  private loadAdminSession(): boolean {
    try {
      return localStorage.getItem(ADMIN_AUTH_KEY) === 'true';
    } catch {
      return false;
    }
  }

  private loadStoredUsers(): AdminUser[] {
    try {
      const stored = localStorage.getItem(ADMIN_USERS_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {}
    return this.initialUsers;
  }

  private persistUsers(users: AdminUser[]): void {
    try {
      localStorage.setItem(ADMIN_USERS_STORAGE_KEY, JSON.stringify(users));
    } catch {}
  }
}
