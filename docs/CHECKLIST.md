# EXPERIENCIAS.CLUB • Checklist de Progreso & Próximos Pasos

> **Visión del Proyecto (`experiencias.club`):** Club privado de expediciones andinas y travesías náuticas, con su temporada inaugural en **Catamarca**. La plataforma gira en torno a los **prestadores de servicios locales** (guías de alta montaña, travesías en kayak, choferes 4x4 y anfitriones) y los **socios del club** atraídos por travesías irrepetibles.

---

## 🧭 Estado Actual: Lo Realizado

### 1. Landing Page de Lista de Espera (Fase 1 Inaugural)

- [x] **Estética editorial de lujo**: Inspirada en el diseño minimalista de v0, adaptada a la Puna y Seismiles con tipografía serif editorial (_Cormorant Garamond_) y sans-serif moderna (_Plus Jakarta Sans_).
- [x] **Formulario cápsula (Pill shape)**: Input interactivo para correo electrónico con validación en tiempo real y micro-animación de carga.
- [x] **Ciclo de Vida del Socio (Flow de 3 Etapas)**:
  - `Suscripción` ➔ **`Socio Emergente`** (número secuencial de socio emergente y código de referido).
  - Transición a **`Socio Activo`** por: cuota mensual, vivir una experiencia ese mes o aprobación de un administrador.
  - Transición a **`Socio Fundador`** mediante el abono de la **Membresía Absoluta** (pase vitalicio sin cuotas de por vida).
  - Barra de progreso visual integrada en la tarjeta de confirmación del socio.
- [x] **Selector y Geolocalización de Paisajes**:
  - Botón switch minimalista con ícono de fotografía restaurado en la barra superior.
  - Ubicación exacta visible en el pie de página (ej. _Balcón del Pissis & Seismiles Sagrados · Fiambalá · Paso de San Francisco, Catamarca · 27°45′S 68°47′O_ y _Campo de Piedra Pómez · Antofagasta de la Sierra · 26°42′S 67°30′O_).
- [x] **Historial de Actividades & Comprobantes de Pago**:
  - Modal interactivo con el registro de salidas del socio (estado _Completada_ o _Confirmada_, prestador a cargo, fecha y valor).
  - Voucher / Comprobante oficial de pago digital con número de recibo, ID de transacción bancaria, código de autorización y opción de impresión/descarga.
- [x] **Modales Glassmorphism interactivos**:
  - **Niveles de Socio**: Guía explicativa con los 3 pasos, requisitos y beneficios.
  - **Experiencias Destacadas**: Travesías andinas y náuticas (Kayak en El Jumeal, Piedra Pómez, Pissis, Galán).
  - **Prestadores & Guías**: Convocatoria de prestadores locales (alta montaña, kayak, 4x4, artesanos) y formulario de pre-postulación.
  - **Pasarelas de Pago**: Selector y simulación entre Pasarela Propia (CBU/Alias), Mercado Pago y Stripe.

### 2. Capa de Servicios y Estado (Modo Mock Activo)

- [x] `NewsletterService` operando en modo Mock reactivo con Signals de Angular y persistencia en `localStorage`.
- [x] `ExperienceService` con el catálogo inicial de travesías andinas.
- [x] `PaymentManagerService` estructurado con el patrón Strategy y pasarelas conmutables (`Custom`, `MercadoPago`, `Stripe`).

### 3. Modelado de Datos para Escalado (3 Tipos de Usuarios)

- [x] **Socios del Club**: Categorías de membresía (`explorador`, `aventurero`, `expedicionario`, `fundador`), descuentos y límite de reservas.
- [x] **Prestadores de Servicios**: Razón social, CUIT/CUIL, categorías (guía de montaña, transporte 4x4, hospedaje, gastronomía, fotografía), estado de revisión (`pending_review`, `approved`, `suspended`) y datos bancarios para transferencias directas.
- [x] **Administradores**: Permisos de aprobación de prestadores, resolución de soporte y auditoría.
- [x] Script de migración SQL consolidado en `supabase/migrations/002_waitlist_and_profiles.sql` con Row Level Security (RLS), auto-triggers para auth e índices.

---

## 🚀 Próximos Pasos (Roadmap Priorizado)

### Paso 1: Enfoque en Prestadores de Servicios

- [ ] **Portal / Dashboard de Prestador**:
  - Formulario de alta completa de prestador (CUIT, licencias de turismo, seguro de rescate en montaña).
  - Creador de experiencias: carga de fotos, itinerario día por día, altitud máxima, dificultad, cupos por grupo y tarifas en ARS y USD.
  - Calendario de salidas y disponibilidad en tiempo real.

### Paso 2: Reanudación de Supabase & Autenticación

- [ ] Reconexión del cliente `SUPABASE_CLIENT` con variables de entorno.
- [ ] Autenticación con Magic Link / Google Auth para Socios y Prestadores.
- [ ] Tablas de prestadores (`service_providers`), servicios (`experiences`) y reservas (`bookings`) en Postgres con RLS.

### Paso 3: Flujo de Reservas y Pagos

- [ ] Integración real de checkout con Mercado Pago (Webhooks de confirmación) y Pasarela directa por transferencia (CBU con subida de comprobante).
- [ ] Mecanismo de split de pago o liquidación periódica hacia el prestador del servicio.

### Paso 4: Experiencia del Socio del Club

- [ ] Perfil de socio con credencial digital de miembro fundador.
- [ ] **Galería / Bitácora de Recuerdos**: Espacio privado donde los expedicionarios pueden revivir y descargar fotos en alta definición de sus travesías andinas.
- [ ] Tienda de souvenirs y merchandising exclusivo de Catamarca.
