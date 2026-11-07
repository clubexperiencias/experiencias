/* ==========================================================================
   Catamarca Secreta • Modelo de Usuarios, Roles y Membresías
   ========================================================================== */

// ── Roles de la plataforma ────────────────────────────────────────────────────

export type UserRole = 'socio' | 'prestador' | 'admin';

// ── Categorías de Membresía y Ciclo de Vida del Socio ─────────────────────────
// Flow: Suscripción ➔ Socio Emergente ➔ Socio Pleno (por cuota mensual, experiencia en el mes o admin) ➔ Socio Fundador (membresía absoluta)

export type MembershipTier =
  | 'waitlist' // Prospecto registrado desde landing/formulario inicial
  | 'emergente' // Paso 1: Suscripción confirmada. Lista de espera, acceso a contenidos y eventos preliminares.
  | 'activo' // Paso 2: Habilitado por suscripción mensual, vivir una experiencia ese mes o aprobación de admin.
  | 'fundador'; // Paso 3: Pago de la Membresía Absoluta (pase vitalicio de por vida, máxima prioridad y beneficios).

export type ActiveActivationPathway =
  | 'suscripcion_mensual' // Pagó la suscripción del mes
  | 'experiencia_vivida' // Realizó/reservó una experiencia ese mes
  | 'aprobacion_admin'; // Un administrador lo habilitó expresamente

export interface MembershipTierInfo {
  tier: MembershipTier;
  label: string;
  badgeText: string;
  description: string;
  howToReach: string;
  monthlyPriceArs?: number;
  lifetimePriceArs?: number;
  benefits: string[];
  discountPercent: number;
  canAccessExclusiveExperiences: boolean;
  canUploadMemories: boolean;
  merchDiscountPercent: number;
}

// ── Perfil Base de Usuario ────────────────────────────────────────────────────

export interface UserProfile {
  id: string; // UUID de Supabase Auth
  email: string;
  fullName: string;
  displayName: string | null;
  avatarUrl: string | null;
  phone: string | null;
  documentType: 'DNI' | 'PASAPORTE' | 'CUIT' | null;
  documentNumber: string | null;
  nationality: string | null;
  preferredLanguage: 'es' | 'en' | 'pt';
  role: UserRole;
  isActive: boolean;
  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

// ── Perfil extendido: Socio del Club ──────────────────────────────────────────

export interface ClubMemberProfile {
  userId: string;
  membershipTier: MembershipTier;
  memberNumber: number; // Número de socio secuencial
  memberSince: Date;
  membershipExpiresAt: Date | null; // null = vitalicio (fundadores)
  isAutoRenew: boolean;
  totalBookings: number;
  totalSpent: number;
  favoritedExperienceIds: string[];
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  medicalNotes: string | null; // Alergias, condiciones de altitud, etc.
  acceptedTermsAt: Date;
}

// ── Perfil extendido: Prestador de Servicios ──────────────────────────────────

export type ProviderStatus = 'pending_review' | 'approved' | 'suspended' | 'rejected';
export type ProviderCategory =
  | 'guia_montaña'
  | 'guia_cultural'
  | 'transporte_4x4'
  | 'alojamiento'
  | 'gastronomia'
  | 'artesanias'
  | 'fotografia'
  | 'bienestar_termas'
  | 'otro';

export interface ServiceProviderProfile {
  userId: string;
  businessName: string; // Razón social o nombre comercial
  businessDescription: string;
  cuit: string; // CUIT/CUIL obligatorio para facturar
  category: ProviderCategory;
  subcategories: ProviderCategory[];
  status: ProviderStatus; // Requiere aprobación de admin
  approvedAt: Date | null;
  approvedBy: string | null; // Admin que aprobó
  rejectionReason: string | null;
  region: string; // Zona geográfica de operación
  address: string | null;
  gpsLat: number | null;
  gpsLng: number | null;
  website: string | null;
  instagramHandle: string | null;
  whatsappNumber: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  commissionPercent: number; // % que retiene la plataforma por cada venta
  bankAliasCbu: string | null; // Para liquidar pagos al prestador
  totalServicesPublished: number;
  totalRevenue: number;
  isVerified: boolean; // Verificación presencial o documental
  verifiedAt: Date | null;
}

// ── Perfil extendido: Administrador ───────────────────────────────────────────

export type AdminPermission =
  | 'manage_users' // CRUD de usuarios y roles
  | 'approve_providers' // Aprobar/rechazar prestadores
  | 'manage_experiences' // Editar/eliminar experiencias de cualquier prestador
  | 'manage_bookings' // Ver y modificar reservas
  | 'manage_payments' // Acceso al panel de pagos y liquidaciones
  | 'manage_content' // CMS: contenido editorial, fotos, etc.
  | 'manage_merch' // Tienda: stock, precios, envíos
  | 'view_analytics' // Dashboards y reportes
  | 'support_tickets' // Atención al usuario / soporte técnico
  | 'super_admin'; // Acceso total (owner)

export interface AdminProfile {
  userId: string;
  permissions: AdminPermission[];
  department: string | null; // 'soporte' | 'comercial' | 'tecnologia' | etc.
  canImpersonateUsers: boolean; // Para soporte: simular sesión de usuario
  lastActionAt: Date | null;
  notes: string | null;
}

// ── Constantes: Tiers de Membresía ────────────────────────────────────────────

export const MEMBERSHIP_TIERS: MembershipTierInfo[] = [
  {
    tier: 'emergente',
    label: 'Socio Emergente',
    badgeText: 'FASE 1 · INICIAL',
    description: 'Estado inicial tras sumarte a la lista de espera oficial de EXPERIENCIAS.CLUB.',
    howToReach: 'Creando tu perfil al vincular tu cuenta de Google.',
    monthlyPriceArs: 0,
    benefits: [
      'Enterarse de las nuevas experiencias y descuentos antes que nadie',
      'Cupo asegurado prioritario en fechas de alta demanda',
    ],
    discountPercent: 0,
    canAccessExclusiveExperiences: false,
    canUploadMemories: false,
    merchDiscountPercent: 0,
  },
  {
    tier: 'activo',
    label: 'Socio Pleno',
    badgeText: 'FASE 2 · HABILITADO',
    description:
      'Miembro activo del club con capacidad de reserva inmediata y descuentos directos con prestadores.',
    howToReach:
      'Suscripción mensual recurrente.',
    benefits: [
      'Todos los beneficios de Socio Emergente',
      '10% OFF directo en todas las expediciones y salidas',
      'Asistencia personalizada de viaje con guías locales',
    ],
    discountPercent: 10,
    canAccessExclusiveExperiences: false,
    canUploadMemories: true,
    merchDiscountPercent: 10,
  },
  {
    tier: 'fundador',
    label: 'Socio Fundador',
    badgeText: 'FASE 3 · VITALICIO ABSOLUTO',
    description:
      'Máximo estatus del club con Membresía Absoluta vitalicia. Sin cuotas mensuales de por vida.',
    howToReach: 'Aporte patrimonial único evaluado por el Comité del Club.',
    lifetimePriceArs: 95000,
    benefits: [
      'Todos los beneficios de Socio Emergente y Socio Pleno',
      '20% OFF permanente en todas las expediciones para titular y acompañante',
      'Participación formal en el Consejo Consultivo del Club',
      'Acceso prioritario a experiencias privadas de lujo del Club',
    ],
    discountPercent: 20,
    canAccessExclusiveExperiences: true,
    canUploadMemories: true,
    merchDiscountPercent: 20,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getTierInfo(tier: MembershipTier): MembershipTierInfo {
  return MEMBERSHIP_TIERS.find((t) => t.tier === tier) ?? MEMBERSHIP_TIERS[0];
}

export function canAccessFeature(
  role: UserRole,
  feature: 'book_experience' | 'publish_service' | 'manage_platform' | 'upload_memories',
): boolean {
  switch (feature) {
    case 'book_experience':
      return role === 'socio';
    case 'publish_service':
      return role === 'prestador';
    case 'manage_platform':
      return role === 'admin';
    case 'upload_memories':
      return role === 'socio';
    default:
      return false;
  }
}
