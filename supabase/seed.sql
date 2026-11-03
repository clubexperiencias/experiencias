-- ==============================================================================
-- EXPERIENCIAS.CLUB • Semilla de Datos de Desarrollo (seed.sql)
-- ==============================================================================
-- Este script puebla la base de datos con un conjunto de datos realista y completo
-- para pruebas en entorno local o staging:
--   • Administradores autorizados (admin_access)
--   • Prestadores habilitados (provider_access)
--   • Catálogo completo de experiencias andinas (experiencias)
--   • Nómina de socios (Socios Fundadores exclusivos, Activos y Emergentes)
--   • Lista de espera y prospectos (waitlist)
--   • Comprobantes de pago en distintos estados (pagos_transferencias)
--   • Postulaciones de fundadores y prestadores
--
-- Es 100% IDEMPOTENTE: puede ejecutarse múltiples veces de forma segura.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ACCESOS ADMINISTRATIVOS (admin_access)
-- ------------------------------------------------------------------------------
INSERT INTO public.admin_access (email, name, role, active)
VALUES
  ('gonzagramaglia@gmail.com', 'Gonzalo Gramaglia', 'superadmin', true),
  ('vegvarel@gmail.com', 'vegvarel', 'superadmin', true),
  ('patriciofacundodiaztillar@gmail.com', 'Patricio Facundo Díaz Tillar', 'superadmin', true),
  ('admin@experiencias.club', 'Administrador Experiencias', 'superadmin', true)
ON CONFLICT (email) DO UPDATE
SET active = true,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    updated_at = now();

-- ------------------------------------------------------------------------------
-- 2. ACCESOS Y PRESTADORES OFICIALES (provider_access)
-- ------------------------------------------------------------------------------
INSERT INTO public.provider_access (
  email,
  name,
  agency,
  active,
  status,
  cbu_alias,
  cuit_dni,
  bank_name,
  account_holder,
  phone
)
VALUES
  (
    'patriciofacundodiaztillar@gmail.com',
    'Patricio Facundo Diaz Tillar',
    'Catamarca Kayak & Aventura Náutica',
    true,
    'aprobado',
    '3840200500000056402423',
    '20-30456123-4',
    'Ualá Bank S.A.U.',
    'Patricio Facundo Diaz Tillar',
    '+54 383 455 8812'
  ),
  (
    'vegvarel@gmail.com',
    'vegvarel',
    'Catamarca Expediciones & Trekking',
    true,
    'aprobado',
    'VEGVAREL.EXPERIENCIAS',
    '20-33221144-5',
    'Banco Nación',
    'vegvarel',
    '+54 383 488 9900'
  ),
  (
    'gonzagramaglia@gmail.com',
    'Gonzalo Gramaglia',
    'Catamarca Experiencias & Expediciones',
    true,
    'aprobado',
    'EXPERIENCIAS.CLUB.MP',
    '20-33445566-7',
    'Banco Nación / Mercado Pago',
    'Gonzalo Gramaglia',
    '+54 9 11 5566 7788'
  )
ON CONFLICT (email) DO UPDATE
SET name = EXCLUDED.name,
    agency = EXCLUDED.agency,
    cbu_alias = EXCLUDED.cbu_alias,
    cuit_dni = EXCLUDED.cuit_dni,
    bank_name = EXCLUDED.bank_name,
    account_holder = EXCLUDED.account_holder,
    phone = EXCLUDED.phone,
    updated_at = now();

-- ------------------------------------------------------------------------------
-- 3. CATÁLOGO OFICIAL DE EXPERIENCIAS (experiencias)
-- ------------------------------------------------------------------------------
INSERT INTO public.experiencias (
  id,
  slug,
  title,
  tagline,
  description,
  region,
  meeting_point,
  difficulty,
  duration_label,
  price_ars,
  price_usd,
  capacity_per_date,
  dates,
  status,
  public_url,
  cover_image,
  album_photos,
  video_url,
  video_poster,
  altitude_meters,
  highlights,
  included,
  not_included
)
VALUES
  (
    'exp-kayak',
    'kayak',
    'Travesía en Kayak & Sunset en el Dique El Jumeal',
    'Remada guiada al atardecer con brindis de productos catamarqueños.',
    'Remada guiada en kayak en aguas calmas rodeadas de quebradas y vegetación de yungas andinas. Presenciamos la caída del sol reflejada en el dique y coronamos la jornada con un brindis y picada de productos artesanales catamarqueños.',
    'Valle Central y Ambato',
    'Club Náutico Dique El Jumeal, San Fernando del Valle de Catamarca',
    'Baja',
    '4 Horas (Media Jornada)',
    65000,
    70,
    12,
    jsonb_build_array(
      to_char((CURRENT_DATE + INTERVAL '5 days'), 'YYYY-MM-DD'),
      to_char((CURRENT_DATE + INTERVAL '12 days'), 'YYYY-MM-DD'),
      to_char((CURRENT_DATE + INTERVAL '19 days'), 'YYYY-MM-DD'),
      to_char((CURRENT_DATE + INTERVAL '26 days'), 'YYYY-MM-DD')
    ),
    'publicada',
    'https://experiencias.club/experiencias/kayak',
    '/assets/images/kayak-club-de-experiencias.jpg',
    jsonb_build_array(
      jsonb_build_object('id', 'k1', 'url', '/assets/images/kayak-club-de-experiencias.jpg', 'caption', 'Sunset en El Jumeal', 'credit', 'Club de Experiencias', 'featured', true, 'isCover', true),
      jsonb_build_object('id', 'k2', 'url', '/assets/images/kayak-2.png', 'caption', 'Navegación en equipo', 'credit', 'Patricio Diaz', 'featured', true, 'isCover', false),
      jsonb_build_object('id', 'k3', 'url', '/assets/images/kayak-3.png', 'caption', 'Quebradas y aguas calmas', 'credit', 'Club de Experiencias', 'featured', false, 'isCover', false)
    ),
    '/assets/videos/kayak.mp4',
    '/assets/images/kayak-video.png',
    850,
    '["Kayaks dobles y simples estancos de travesía", "Brindis con vinos de altura y embutidos locales", "Instrucción técnica previa de remada y seguridad"]'::jsonb,
    '["Kayaks y remos profesionales", "Chalecos salvavidas reglamentarios certificados", "Seguro de accidentes personales", "Guía profesional náutico", "Picada y brindis andino"]'::jsonb,
    '["Traslados al Club Náutico", "Ropa de recambio"]'::jsonb
  ),
  (
    'exp-pomez',
    'campo-de-piedra-pomez',
    'Expedición 4x4 Campo de Piedra Pómez & Volcanes',
    'Aventura lunar en el laberinto blanco de la Puna catamarqueña a más de 3.000 msnm.',
    'Travesía en camionetas 4x4 equipadas hacia el majestuoso Campo de Piedra Pómez. Incluye cruce de médanos gigantes, avistaje de vicuñas en Laguna Blanca y merienda andina en el silencio absoluto de la cordillera.',
    'Puna de Atacama',
    'Plaza Principal de El Peñón, Antofagasta de la Sierra',
    'Moderada',
    'Día Completo (10 Horas)',
    145000,
    150,
    8,
    jsonb_build_array(
      to_char((CURRENT_DATE + INTERVAL '8 days'), 'YYYY-MM-DD'),
      to_char((CURRENT_DATE + INTERVAL '22 days'), 'YYYY-MM-DD')
    ),
    'publicada',
    'https://experiencias.club/experiencias/campo-de-piedra-pomez',
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
    jsonb_build_array(
      jsonb_build_object('id', 'p1', 'url', 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80', 'caption', 'Laberinto de pómez gigante', 'credit', 'Club de Experiencias', 'featured', true, 'isCover', true),
      jsonb_build_object('id', 'p2', 'url', 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=800&q=80', 'caption', 'Cruce de dunas en camionetas 4x4', 'credit', 'Puna Expediciones', 'featured', true, 'isCover', false)
    ),
    '/assets/videos/kayak.mp4',
    '/assets/images/kayak-video.png',
    3150,
    '["Laberintos blancos esculpidos por ceniza volcánica", "Cruce guiado de médanos de altura", "Box lunch andino con cordero y quínoa"]'::jsonb,
    '["Vehículo 4x4 con chofer-guía especializado", "Oxígeno a bordo y botiquín de altura", "Almuerzo de campo y bebidas", "Permisos de ingreso al Área Natural Protegida"]'::jsonb,
    '["Alojamiento en El Peñón", "Propinas"]'::jsonb
  ),
  (
    'exp-seismiles',
    'ruta-de-los-seismiles',
    'Ruta de los Seismiles y Laguna Verde Andina',
    'Explorá la segunda cordillera más alta del planeta entre lagunas turquesas y volcanes gigantes.',
    'Travesía por la Ruta Nacional 60 ascendiendo hacia el Paso de San Francisco a más de 4.000 msnm. Admiramos los volcanes más altos del mundo (Pissis, Ojos del Salado, Incahuasi) y lagunas salinas con flamencos rosados.',
    'Fiambalá & Paso de San Francisco',
    'Plaza Central de Fiambalá, Tinogasta',
    'Exigente',
    'Día Completo (12 Horas)',
    175000,
    185,
    6,
    jsonb_build_array(
      to_char((CURRENT_DATE + INTERVAL '14 days'), 'YYYY-MM-DD'),
      to_char((CURRENT_DATE + INTERVAL '28 days'), 'YYYY-MM-DD')
    ),
    'publicada',
    'https://experiencias.club/experiencias/ruta-de-los-seismiles',
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80',
    jsonb_build_array(
      jsonb_build_object('id', 's1', 'url', 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80', 'caption', 'Volcanes gigantes en la cordillera', 'credit', 'Club de Experiencias', 'featured', true, 'isCover', true)
    ),
    '/assets/videos/kayak.mp4',
    '/assets/images/kayak-video.png',
    4200,
    '["Lagunas altiplánicas con flamencos", "Vistas panorámicas a volcanes de más de 6.000 msnm", "Visita a refugios históricos de arrieros"]'::jsonb,
    '["Transporte 4x4 climatizado", "Guía de alta montaña registrado", "Seguro y botiquín de oximetría", "Almuerzo térmico cordillerano"]'::jsonb,
    '["Indumentaria técnica de abrigo"]'::jsonb
  )
ON CONFLICT (id) DO UPDATE
SET slug = EXCLUDED.slug,
    title = EXCLUDED.title,
    tagline = EXCLUDED.tagline,
    description = EXCLUDED.description,
    price_ars = EXCLUDED.price_ars,
    dates = EXCLUDED.dates,
    status = EXCLUDED.status,
    album_photos = EXCLUDED.album_photos,
    updated_at = now();

-- ------------------------------------------------------------------------------
-- 4. NÓMINA DE SOCIOS (socios)
-- ------------------------------------------------------------------------------
-- Socios Fundadores exclusivos: gonzagramaglia@gmail.com, vegvarel@gmail.com y patriciofacundodiaztillar@gmail.com
INSERT INTO public.socios (
  email,
  full_name,
  dni,
  phone,
  position,
  membership_tier,
  google_linked,
  founder_application_status,
  founder_agreed_to_protocol,
  founder_motivation_letter
)
VALUES
  (
    'gonzagramaglia@gmail.com',
    'Gonzalo Gramaglia',
    '33445566',
    '+54 9 11 5566 7788',
    100,
    'fundador',
    true,
    'aprobado',
    true,
    'Fundador y desarrollador del Club de Experiencias Catamarca. Comprometido con la difusión del turismo andino sustentable y expediciones de calidad.'
  ),
  (
    'vegvarel@gmail.com',
    'vegvarel',
    '33221144',
    '+54 383 488 9900',
    101,
    'fundador',
    true,
    'aprobado',
    true,
    'Socio Fundador. Impulsor de expediciones de montaña, senderismo andino y desarrollo comunitario.'
  ),
  (
    'patriciofacundodiaztillar@gmail.com',
    'Patricio Facundo Díaz Tillar',
    '30456123',
    '+54 383 455 8812',
    102,
    'fundador',
    true,
    'aprobado',
    true,
    'Socio Fundador y prestador náutico oficial. Pionero en travesías de kayak en diques y espejos de agua de Catamarca.'
  ),
  (
    'carlos.montes@gmail.com',
    'Carlos Montes',
    '31554422',
    '+54 383 422 9900',
    103,
    'activo',
    true,
    NULL,
    false,
    NULL
  ),
  (
    'lucia.paredes@gmail.com',
    'Lucía Paredes',
    '36112233',
    '+54 11 4455 6677',
    104,
    'activo',
    false,
    NULL,
    false,
    NULL
  ),
  (
    'esteban.rivero@gmail.com',
    'Esteban Rivero',
    '38990011',
    '+54 383 400 3344',
    105,
    'emergente',
    false,
    NULL,
    false,
    NULL
  ),
  (
    'sofia.cordoba@gmail.com',
    'Sofía Córdoba',
    '40112299',
    '+54 351 555 4433',
    106,
    'emergente',
    true,
    NULL,
    false,
    NULL
  )
ON CONFLICT (email) DO UPDATE
SET full_name = EXCLUDED.full_name,
    dni = EXCLUDED.dni,
    membership_tier = EXCLUDED.membership_tier,
    founder_application_status = EXCLUDED.founder_application_status,
    updated_at = now();

-- ------------------------------------------------------------------------------
-- 5. LISTA DE ESPERA (waitlist)
-- ------------------------------------------------------------------------------
INSERT INTO public.waitlist (email, converted, google_linked)
VALUES
  ('gonzagramaglia@gmail.com', true, true),
  ('vegvarel@gmail.com', true, true),
  ('patriciofacundodiaztillar@gmail.com', true, true),
  ('carlos.montes@gmail.com', true, true),
  ('lucia.paredes@gmail.com', true, false),
  ('esteban.rivero@gmail.com', false, false),
  ('sofia.cordoba@gmail.com', false, true),
  ('prospecto.aventura@hotmail.com', false, false),
  ('trekking.nordico@yahoo.com.ar', false, false),
  ('martin.andes@gmail.com', false, true),
  ('viajera.argentina@gmail.com', false, false)
ON CONFLICT (email) DO UPDATE
SET converted = EXCLUDED.converted,
    google_linked = EXCLUDED.google_linked;

-- ------------------------------------------------------------------------------
-- 6. COMPROBANTES DE PAGO Y RESERVAS (pagos_transferencias)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_socio_carlos UUID;
  v_socio_lucia UUID;
  v_socio_esteban UUID;
  v_socio_sofia UUID;
BEGIN
  SELECT id INTO v_socio_carlos FROM public.socios WHERE email = 'carlos.montes@gmail.com' LIMIT 1;
  SELECT id INTO v_socio_lucia FROM public.socios WHERE email = 'lucia.paredes@gmail.com' LIMIT 1;
  SELECT id INTO v_socio_esteban FROM public.socios WHERE email = 'esteban.rivero@gmail.com' LIMIT 1;
  SELECT id INTO v_socio_sofia FROM public.socios WHERE email = 'sofia.cordoba@gmail.com' LIMIT 1;

  INSERT INTO public.pagos_transferencias (
    reference,
    experience_id,
    experience_title,
    date,
    participants,
    amount_ars,
    full_name,
    email,
    dni,
    phone,
    socio_id,
    receipt_file_name,
    receipt_mime_type,
    receipt_size_bytes,
    receipt_url,
    receipt_storage_key,
    receipt_storage_provider,
    status,
    submitted_at,
    reviewed_at
  )
  VALUES
    (
      'EXP-KAYAK-2026-001',
      'exp-kayak',
      'Travesía en Kayak & Sunset en el Dique El Jumeal',
      to_char((CURRENT_DATE + INTERVAL '5 days'), 'YYYY-MM-DD'),
      2,
      130000,
      'Carlos Montes',
      'carlos.montes@gmail.com',
      '31554422',
      '+54 383 422 9900',
      v_socio_carlos,
      'comprobante_banco_galicia_001.pdf',
      'application/pdf',
      245000,
      'https://experiencias.club/assets/images/comprobante-ejemplo.png',
      'comprobantes/EXP-KAYAK-2026-001.pdf',
      'supabase',
      'aprobado',
      now() - INTERVAL '2 days',
      now() - INTERVAL '1 day'
    ),
    (
      'EXP-KAYAK-2026-002',
      'exp-kayak',
      'Travesía en Kayak & Sunset en el Dique El Jumeal',
      to_char((CURRENT_DATE + INTERVAL '5 days'), 'YYYY-MM-DD'),
      1,
      65000,
      'Lucía Paredes',
      'lucia.paredes@gmail.com',
      '36112233',
      '+54 11 4455 6677',
      v_socio_lucia,
      'transferencia_mp_lucia.jpg',
      'image/jpeg',
      512000,
      'https://experiencias.club/assets/images/comprobante-ejemplo.png',
      'comprobantes/EXP-KAYAK-2026-002.jpg',
      'supabase',
      'aprobado',
      now() - INTERVAL '1 day',
      now() - INTERVAL '4 hours'
    ),
    (
      'EXP-KAYAK-2026-003',
      'exp-kayak',
      'Travesía en Kayak & Sunset en el Dique El Jumeal',
      to_char((CURRENT_DATE + INTERVAL '12 days'), 'YYYY-MM-DD'),
      1,
      65000,
      'Esteban Rivero',
      'esteban.rivero@gmail.com',
      '38990011',
      '+54 383 400 3344',
      v_socio_esteban,
      'ticket_transferencia_esteban.png',
      'image/png',
      410000,
      'https://experiencias.club/assets/images/comprobante-ejemplo.png',
      'comprobantes/EXP-KAYAK-2026-003.png',
      'supabase',
      'pendiente',
      now() - INTERVAL '3 hours',
      NULL
    ),
    (
      'EXP-POMEZ-2026-001',
      'exp-pomez',
      'Expedición 4x4 Campo de Piedra Pómez & Volcanes',
      to_char((CURRENT_DATE + INTERVAL '8 days'), 'YYYY-MM-DD'),
      1,
      145000,
      'Sofía Córdoba',
      'sofia.cordoba@gmail.com',
      '40112299',
      '+54 351 555 4433',
      v_socio_sofia,
      'comprobante_uala_sofia.pdf',
      'application/pdf',
      198000,
      'https://experiencias.club/assets/images/comprobante-ejemplo.png',
      'comprobantes/EXP-POMEZ-2026-001.pdf',
      'supabase',
      'pendiente',
      now() - INTERVAL '1 hour',
      NULL
    ),
    (
      'EXP-POMEZ-2026-002',
      'exp-pomez',
      'Expedición 4x4 Campo de Piedra Pómez & Volcanes',
      to_char((CURRENT_DATE + INTERVAL '8 days'), 'YYYY-MM-DD'),
      1,
      145000,
      'Roberto Inválido',
      'roberto.rechazado@gmail.com',
      '28991122',
      '+54 383 411 2233',
      NULL,
      'captura_borrosa.jpg',
      'image/jpeg',
      120000,
      'https://experiencias.club/assets/images/comprobante-ejemplo.png',
      'comprobantes/EXP-POMEZ-2026-002.jpg',
      'supabase',
      'rechazado',
      now() - INTERVAL '3 days',
      now() - INTERVAL '2 days'
    )
  ON CONFLICT (reference) DO UPDATE
  SET status = EXCLUDED.status,
      receipt_url = EXCLUDED.receipt_url,
      updated_at = now();
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. POSTULACIONES DE FUNDADORES (postulaciones_fundadores)
-- ------------------------------------------------------------------------------
INSERT INTO public.postulaciones_fundadores (
  full_name,
  email,
  phone,
  motivation_letter,
  agreed_to_protocol,
  status
)
VALUES
  (
    'Valeria Andina',
    'valeria.andina@gmail.com',
    '+54 383 488 2211',
    'Bióloga y fotógrafa de aves andinas. Deseo colaborar en la documentación de fauna en las lagunas de altura.',
    true,
    'en_evaluacion'
  )
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------------------------
-- 8. POSTULACIONES DE PRESTADORES (postulaciones_prestadores)
-- ------------------------------------------------------------------------------
INSERT INTO public.postulaciones_prestadores (
  full_name,
  category,
  region,
  email,
  phone,
  website,
  description,
  status
)
VALUES
  (
    'Patricio Facundo Diaz Tillar',
    'kayak_nautica',
    'Valle Central y Ambato',
    'patriciofacundodiaztillar@gmail.com',
    '+54 383 455 8812',
    'https://experiencias.club/experiencias/kayak',
    'Escuela de kayak y actividades náuticas en diques de Catamarca con flota propia.',
    'aprobado'
  ),
  (
    'vegvarel',
    'guia_montaña',
    'Valle Central y Ambato',
    'vegvarel@gmail.com',
    '+54 383 488 9900',
    'https://experiencias.club',
    'Prestador oficial de trekking y expediciones andinas.',
    'aprobado'
  ),
  (
    'Nicolás Ambato',
    'guia_montaña',
    'Valle Central y Ambato',
    'aventuras.ambato@gmail.com',
    '+54 383 422 7711',
    'https://instagram.com/trekking_ambato',
    'Guía de senderismo y trekking en yungas y cerros del cordón del Ambato.',
    'pendiente'
  )
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------------------------
-- 9. HISTORIAL DE AUDITORÍA BANCARIA DE PRESTADORES (provider_banking_history)
-- ------------------------------------------------------------------------------
INSERT INTO public.provider_banking_history (
  provider_email,
  old_cbu_alias,
  new_cbu_alias,
  old_name,
  new_name,
  old_cuit_dni,
  new_cuit_dni,
  old_bank_name,
  new_bank_name,
  changed_by,
  changed_at
)
VALUES
  (
    'patriciofacundodiaztillar@gmail.com',
    'ALIAS.ANTERIOR.MP',
    '3840200500000056402423',
    'Patricio Diaz',
    'Patricio Facundo Diaz Tillar',
    '20-30456123-4',
    '20-30456123-4',
    'Mercado Pago',
    'Ualá Bank S.A.U.',
    'provider',
    now() - INTERVAL '5 days'
  )
ON CONFLICT DO NOTHING;
