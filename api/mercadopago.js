const https = require('https');
const crypto = require('crypto');

function getEnvConfig() {
  const mpAccessToken = (
    process.env.MERCADO_PAGO_ACCESS_TOKEN ||
    process.env.MP_ACCESS_TOKEN ||
    ''
  ).trim();

  const mpClientId = (
    process.env.MERCADO_PAGO_CLIENT_ID ||
    process.env.MP_CLIENT_ID ||
    ''
  ).trim();

  const mpClientSecret = (
    process.env.MERCADO_PAGO_CLIENT_SECRET ||
    process.env.MP_CLIENT_SECRET ||
    ''
  ).trim();

  const supabaseUrl = (
    process.env.SUPABASE_URL ||
    process.env.SUPABASE_PROD_URL ||
    process.env.PUBLIC_SUPABASE_URL ||
    ''
  ).trim();

  const supabaseServiceKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    ''
  ).trim();

  const appBaseUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'https://experiencias.club')
  ).replace(/\/+$/, '');

  const isTestEnv = Boolean(
    process.env.NODE_ENV === 'test' ||
    process.env.MP_SIMULATION_MODE === 'true'
  );

  return {
    mpAccessToken,
    mpClientId,
    mpClientSecret,
    supabaseUrl,
    supabaseServiceKey,
    appBaseUrl,
    isTestEnv,
  };
}

function requestHttps(options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

const DISCOUNT_CODES = [
  { code: 'SOCIOFUNDADOR7', percentOff: 7 },
  { code: 'SOCIO10', percentOff: 10 },
  { code: 'FUNDADOR20', percentOff: 20 },
];

function findDiscountCode(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const normalized = raw.trim().toUpperCase();
  return DISCOUNT_CODES.find((d) => d.code === normalized) || null;
}

const CONFIRMATION_VIEW_FIELDS =
  'id,reference,experience_id,experience_title,selected_date,date,participants,amount_ars,discount_code,discount_ars,full_name,email,status,created_at,submitted_at,reviewed_at';

function sanitizeBookingForConfirmation(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    id: row.id,
    reference: row.reference,
    experience_id: row.experience_id,
    experience_title: row.experience_title,
    selected_date: row.selected_date || row.date,
    date: row.selected_date || row.date,
    participants: Number(row.participants) || 1,
    amount_ars: Number(row.amount_ars) || 0,
    discount_code: row.discount_code || undefined,
    discount_ars: row.discount_ars !== undefined && row.discount_ars !== null ? Number(row.discount_ars) : 0,
    full_name: row.full_name,
    email: row.email,
    status: row.status,
    created_at: row.created_at || row.submitted_at,
    submitted_at: row.submitted_at || row.created_at,
    reviewed_at: row.reviewed_at,
  };
}

function normalizeStr(val) {
  return String(val || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function validatePaymentAgainstBooking(paymentData, bookingRow) {
  if (!bookingRow || typeof bookingRow !== 'object') {
    return {
      valid: false,
      error: 'No se encontró una reserva asociada para validar el pago.',
    };
  }

  // 1. Validar monto: el monto abonado en Mercado Pago debe cubrir al menos el importe registrado en la reserva
  const paymentAmount = Number(paymentData?.transaction_amount) || 0;
  const bookingAmount = Number(bookingRow.amount_ars) || 0;

  if (bookingAmount > 0 && (bookingAmount - paymentAmount) > 1) {
    return {
      valid: false,
      error: `El monto del pago ($${paymentAmount}) es inferior al importe registrado en la reserva ($${bookingAmount}).`,
    };
  }

  // 2. Validar que el pago corresponda a la experiencia confiable de la reserva registrada
  const trustedExpId = normalizeStr(bookingRow.experience_id);
  const trustedExpTitle = normalizeStr(bookingRow.experience_title);

  if (trustedExpId || trustedExpTitle) {
    const paymentItems = Array.isArray(paymentData?.additional_info?.items)
      ? paymentData.additional_info.items
      : [];

    const hasItemMatch = paymentItems.some((item) => {
      const itemId = normalizeStr(item?.id);
      const itemTitle = normalizeStr(item?.title);
      const idMatches = Boolean(
        trustedExpId && (itemId === trustedExpId || itemId.includes(trustedExpId) || trustedExpId.includes(itemId))
      );
      const titleMatches = Boolean(
        trustedExpTitle && (itemTitle.includes(trustedExpTitle) || trustedExpTitle.includes(itemTitle))
      );
      return idMatches || titleMatches;
    });

    const paymentDesc = normalizeStr(paymentData?.description);
    const hasDescMatch = Boolean(
      (trustedExpId && paymentDesc.includes(trustedExpId)) ||
      (trustedExpTitle && (paymentDesc.includes(trustedExpTitle) || trustedExpTitle.includes(paymentDesc)))
    );

    const paymentExtRef = normalizeStr(paymentData?.external_reference);
    const hasRefMatch = Boolean(
      trustedExpId && (paymentExtRef.includes(trustedExpId) || paymentExtRef === trustedExpId)
    );

    const hasPaymentMetadata = paymentItems.length > 0 || Boolean(paymentDesc) || Boolean(paymentExtRef);
    if (hasPaymentMetadata && !hasItemMatch && !hasDescMatch && !hasRefMatch) {
      return {
        valid: false,
        error: 'El pago en Mercado Pago no coincide con la experiencia registrada en la reserva.',
      };
    }
  }

  return { valid: true };
}

const OAUTH_STATE_TTL_MS = 15 * 60 * 1000; // 15 minutos

function getHmacSecret(config) {
  return (
    config.mpClientSecret ||
    config.supabaseServiceKey ||
    config.mpAccessToken ||
    'catamarca_club_mp_oauth_state_secret_2026'
  );
}

function generateOAuthState(providerEmail, secret) {
  const payload = {
    email: providerEmail.trim().toLowerCase(),
    ts: Date.now(),
    nonce: crypto.randomBytes(16).toString('hex'),
  };
  const json = JSON.stringify(payload);
  const dataB64 = Buffer.from(json, 'utf8').toString('base64url');
  const hmac = crypto.createHmac('sha256', secret).update(dataB64).digest('base64url');
  return `${dataB64}.${hmac}`;
}

function verifyOAuthState(stateStr, secret, isTestEnv) {
  if (!stateStr || typeof stateStr !== 'string') return null;

  if (isTestEnv && stateStr.startsWith('sim_state_')) {
    const rawEmail = stateStr.replace('sim_state_', '').trim().toLowerCase();
    if (rawEmail && rawEmail.includes('@')) {
      return { email: rawEmail, ts: Date.now() };
    }
  }

  const parts = stateStr.split('.');
  if (parts.length !== 2) return null;
  const [dataB64, signature] = parts;
  if (!dataB64 || !signature) return null;

  try {
    const expectedHmac = crypto.createHmac('sha256', secret).update(dataB64).digest('base64url');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedHmac);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const json = Buffer.from(dataB64, 'base64url').toString('utf8');
    const payload = JSON.parse(json);
    if (!payload || !payload.email || typeof payload.email !== 'string' || !payload.ts) {
      return null;
    }
    const now = Date.now();
    if (payload.ts > now + 60000 || now - payload.ts > OAUTH_STATE_TTL_MS) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

async function authenticateProvider(req, supabaseUrl, supabaseServiceKey, isTestEnv) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
  let token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token && req.body) {
    let bodyObj = req.body;
    if (typeof bodyObj === 'string') {
      try {
        bodyObj = JSON.parse(bodyObj);
      } catch {
        // keep as is
      }
    }
    token = bodyObj?.authToken || bodyObj?.accessToken || '';
  }

  if (!token && req.query?.token) {
    token = String(req.query.token).trim();
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    if (isTestEnv) {
      return { authenticated: true, email: 'prestador-test@experiencias.club' };
    }
    return { authenticated: false, error: 'Servicio de autenticación no configurado.' };
  }

  if (!token) {
    if (isTestEnv) {
      return { authenticated: true, email: 'prestador-test@experiencias.club' };
    }
    return { authenticated: false, error: 'Se requiere token de autorización.' };
  }

  try {
    const supabaseHost = new URL(supabaseUrl).hostname;
    const userRes = await requestHttps({
      hostname: supabaseHost,
      path: '/auth/v1/user',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: supabaseServiceKey,
      },
    });

    if (userRes.status < 200 || userRes.status >= 300 || !userRes.data?.email) {
      return { authenticated: false, error: 'Token de sesión inválido o expirado.' };
    }

    const email = String(userRes.data.email).trim().toLowerCase();

    const provRes = await requestHttps({
      hostname: supabaseHost,
      path: `/rest/v1/prestadores?email=eq.${encodeURIComponent(email)}&select=id,email,active,status`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseServiceKey}`,
        apikey: supabaseServiceKey,
      },
    });

    if (
      provRes.status < 200 ||
      provRes.status >= 300 ||
      !Array.isArray(provRes.data) ||
      provRes.data.length === 0
    ) {
      return { authenticated: false, error: 'No se encontró un perfil de prestador para esta cuenta.' };
    }

    const provider = provRes.data[0];
    if (provider.active !== true || provider.status !== 'aprobado') {
      return { authenticated: false, error: 'El perfil de prestador no está activo o aprobado.' };
    }

    return { authenticated: true, email: provider.email || email, providerId: provider.id };
  } catch (err) {
    console.warn('[MercadoPago API] Error autenticando prestador:', err);
    return { authenticated: false, error: 'Error al verificar la identidad del prestador.' };
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const {
    mpAccessToken,
    mpClientId,
    mpClientSecret,
    supabaseUrl,
    supabaseServiceKey,
    appBaseUrl,
    isTestEnv,
  } = getEnvConfig();

  // 1. GET: OAuth Callback (cuando un prestador autoriza la app de Mercado Pago)
  if (req.method === 'GET') {
    const { action, code, state } = req.query || {};

    if (action === 'oauth-callback' || code) {
      if (!code) {
        return res.status(400).json({ error: 'Falta el parámetro code en el callback.' });
      }

      const hmacSecret = getHmacSecret({ mpClientSecret, supabaseServiceKey, mpAccessToken });
      const statePayload = verifyOAuthState(state, hmacSecret, isTestEnv);
      if (!statePayload || !statePayload.email) {
        console.warn('[MercadoPago OAuth] State de autenticación inválido, manipulado o expirado.');
        return res.redirect(302, `${appBaseUrl}/prestadores/perfil?mp_error=invalid_state`);
      }

      const providerEmail = statePayload.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(providerEmail)) {
        return res.redirect(302, `${appBaseUrl}/prestadores/perfil?mp_error=invalid_provider`);
      }

      if (!mpClientId || !mpClientSecret) {
        if (isTestEnv) {
          const redirectUrl = `${appBaseUrl}/prestadores/perfil?mp_connected=simulated&code=${encodeURIComponent(code)}`;
          return res.redirect(302, redirectUrl);
        }
        return res.redirect(302, `${appBaseUrl}/prestadores/perfil?mp_error=not_configured`);
      }

      try {
        const tokenRes = await requestHttps(
          {
            hostname: 'api.mercadopago.com',
            path: '/oauth/token',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          },
          {
            client_secret: mpClientSecret,
            client_id: mpClientId,
            grant_type: 'authorization_code',
            code,
            redirect_uri: `${appBaseUrl}/api/mercadopago?action=oauth-callback`,
          }
        );

        if (tokenRes.status >= 200 && tokenRes.status < 300 && tokenRes.data?.user_id) {
          const collectorId = tokenRes.data.user_id;

          if (supabaseUrl && supabaseServiceKey) {
            let providerSaved = false;

            try {
              const supabaseHost = new URL(supabaseUrl).hostname;
              const authHeaders = {
                'Content-Type': 'application/json',
                apikey: supabaseServiceKey,
                Authorization: `Bearer ${supabaseServiceKey}`,
              };

              // 1. Buscar las notas actuales del prestador de forma estricta por email validado
              let existingNotes = '';
              const fetchRes = await requestHttps({
                hostname: supabaseHost,
                path: `/rest/v1/prestadores?email=eq.${encodeURIComponent(providerEmail)}&select=email,notes`,
                method: 'GET',
                headers: authHeaders,
              });

              if (
                fetchRes.status >= 200 &&
                fetchRes.status < 300 &&
                Array.isArray(fetchRes.data) &&
                fetchRes.data.length > 0
              ) {
                existingNotes = fetchRes.data[0].notes || '';
              }

              // 2. Fusionar los datos de Mercado Pago preservando notas previas
              let notesObj = {};
              if (existingNotes) {
                try {
                  const parsed = JSON.parse(existingNotes);
                  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    notesObj = parsed;
                  } else {
                    notesObj = { text: existingNotes };
                  }
                } catch {
                  notesObj = { text: existingNotes };
                }
              }

              notesObj.mp_connected = true;
              notesObj.mp_collector_id = String(collectorId);
              if (tokenRes.data.public_key) {
                notesObj.mp_public_key = tokenRes.data.public_key;
              }
              // Eliminar access_token y refresh_token para que NUNCA se almacenen en prestadores.notes
              delete notesObj.mp_access_token;
              delete notesObj.mp_refresh_token;

              // 3. Persistir en la tabla prestadores utilizando la clave de servicio
              const patchRes = await requestHttps(
                {
                  hostname: supabaseHost,
                  path: `/rest/v1/prestadores?email=eq.${encodeURIComponent(providerEmail)}`,
                  method: 'PATCH',
                  headers: {
                    ...authHeaders,
                    Prefer: 'return=minimal',
                  },
                },
                {
                  notes: JSON.stringify(notesObj),
                  updated_at: new Date().toISOString(),
                }
              );

              if (patchRes.status >= 200 && patchRes.status < 300) {
                providerSaved = true;
              }

              // 4. Almacenar tokens sensibles EXCLUSIVAMENTE en almacenamiento protegido del servidor (historial_mp)
              await requestHttps(
                {
                  hostname: supabaseHost,
                  path: '/rest/v1/historial_mp',
                  method: 'POST',
                  headers: {
                    ...authHeaders,
                    Prefer: 'return=minimal',
                  },
                },
                {
                  provider_email: providerEmail,
                  action: 'connect',
                  collector_id: String(collectorId),
                  details: {
                    live_mode: tokenRes.data.live_mode,
                    scope: tokenRes.data.scope,
                    saved_to_prestador: providerSaved,
                    access_token: tokenRes.data.access_token || '',
                    refresh_token: tokenRes.data.refresh_token || '',
                    public_key: tokenRes.data.public_key || '',
                  },
                  changed_by: 'mercadopago_oauth',
                }
              );
            } catch (persistErr) {
              console.warn('[MercadoPago API] Error persistiendo autorización de vendedor:', persistErr);
            }

            // Si no se pudo guardar la conexión en Supabase, no redirigir como exitoso
            if (!providerSaved) {
              return res.redirect(302, `${appBaseUrl}/prestadores/perfil?mp_error=save_failed`);
            }
          }

          const redirectUrl = `${appBaseUrl}/prestadores/perfil?mp_connected=true&collector_id=${encodeURIComponent(collectorId)}`;
          return res.redirect(302, redirectUrl);
        }

        return res.redirect(302, `${appBaseUrl}/prestadores/perfil?mp_error=auth_failed`);
      } catch (err) {
        return res.redirect(302, `${appBaseUrl}/prestadores/perfil?mp_error=server_error`);
      }
    }

    if (action === 'get-oauth-url' || action === 'connect') {
      const auth = await authenticateProvider(req, supabaseUrl, supabaseServiceKey, isTestEnv);
      if (!auth.authenticated) {
        return res.status(401).json({
          error: auth.error || 'Acceso no autorizado: se requiere sesión de prestador autenticada.',
        });
      }

      const hmacSecret = getHmacSecret({ mpClientSecret, supabaseServiceKey, mpAccessToken });
      const state = generateOAuthState(auth.email, hmacSecret);
      const redirectUri = `${appBaseUrl}/api/mercadopago?action=oauth-callback`;

      if (!mpClientId) {
        if (isTestEnv) {
          const simulatedUrl = `${redirectUri}&code=sim_code_${Date.now()}&state=${encodeURIComponent(state)}`;
          return res.status(200).json({ url: simulatedUrl });
        }
        return res.status(503).json({
          error: 'Mercado Pago no cuenta con credenciales de aplicación configuradas.',
        });
      }

      const authUrl = `https://auth.mercadopago.com/authorization?client_id=${encodeURIComponent(mpClientId)}&response_type=code&platform_id=mp&state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
      return res.status(200).json({ url: authUrl });
    }

    return res.status(200).json({
      status: 'ok',
      service: 'Mercado Pago Integration API',
      configured: Boolean(mpAccessToken),
    });
  }

  // 2. POST: Creación de Preferencias o Webhook
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // keep as is
      }
    }
    body = body || {};

    const action = body.action || req.query?.action || 'create-preference';

    // A. OBTENER URL DE AUTORIZACIÓN OAUTH (Para conectar cuenta de vendedor prestador)
    if (action === 'get-oauth-url' || action === 'connect') {
      const auth = await authenticateProvider(req, supabaseUrl, supabaseServiceKey, isTestEnv);
      if (!auth.authenticated) {
        return res.status(401).json({
          error: auth.error || 'Acceso no autorizado: se requiere sesión de prestador autenticada.',
        });
      }

      const hmacSecret = getHmacSecret({ mpClientSecret, supabaseServiceKey, mpAccessToken });
      const state = generateOAuthState(auth.email, hmacSecret);
      const redirectUri = `${appBaseUrl}/api/mercadopago?action=oauth-callback`;

      if (!mpClientId) {
        if (isTestEnv) {
          const simulatedUrl = `${redirectUri}&code=sim_code_${Date.now()}&state=${encodeURIComponent(state)}`;
          return res.status(200).json({ url: simulatedUrl });
        }
        return res.status(503).json({
          error: 'Mercado Pago no cuenta con credenciales de aplicación configuradas.',
        });
      }

      const authUrl = `https://auth.mercadopago.com/authorization?client_id=${encodeURIComponent(mpClientId)}&response_type=code&platform_id=mp&state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
      return res.status(200).json({ url: authUrl });
    }

    // B. DESVINCULAR MERCADO PAGO Y PURGAR CREDENCIALES DEL ALMACENAMIENTO PROTEGIDO
    if (action === 'disconnect') {
      const auth = await authenticateProvider(req, supabaseUrl, supabaseServiceKey, isTestEnv);
      if (!auth.authenticated) {
        return res.status(401).json({
          error: auth.error || 'Acceso no autorizado: se requiere sesión de prestador autenticada.',
        });
      }

      const providerEmail = auth.email.trim().toLowerCase();

      if (supabaseUrl && supabaseServiceKey) {
        try {
          const supabaseHost = new URL(supabaseUrl).hostname;
          const authHeaders = {
            'Content-Type': 'application/json',
            apikey: supabaseServiceKey,
            Authorization: `Bearer ${supabaseServiceKey}`,
          };

          // 1. Eliminar tokens del almacenamiento protegido (historial_mp)
          await requestHttps({
            hostname: supabaseHost,
            path: `/rest/v1/historial_mp?provider_email=eq.${encodeURIComponent(providerEmail)}`,
            method: 'DELETE',
            headers: {
              ...authHeaders,
              Prefer: 'return=minimal',
            },
          });

          // 2. Registrar evento de desconexión sin credenciales
          await requestHttps(
            {
              hostname: supabaseHost,
              path: '/rest/v1/historial_mp',
              method: 'POST',
              headers: {
                ...authHeaders,
                Prefer: 'return=minimal',
              },
            },
            {
              provider_email: providerEmail,
              action: 'disconnect',
              collector_id: '',
              details: {
                disconnected: true,
                tokens_purged: true,
              },
              changed_by: 'mercadopago_disconnect',
            }
          );

          // 3. Limpiar prestadores.notes removiendo cualquier residuo de credenciales
          const fetchRes = await requestHttps({
            hostname: supabaseHost,
            path: `/rest/v1/prestadores?email=eq.${encodeURIComponent(providerEmail)}&select=email,notes`,
            method: 'GET',
            headers: authHeaders,
          });

          let notesObj = {};
          if (
            fetchRes.status >= 200 &&
            fetchRes.status < 300 &&
            Array.isArray(fetchRes.data) &&
            fetchRes.data.length > 0
          ) {
            const rawNotes = fetchRes.data[0].notes;
            if (rawNotes) {
              try {
                const parsed = JSON.parse(rawNotes);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                  notesObj = parsed;
                }
              } catch {
                notesObj = {};
              }
            }
          }

          notesObj.mp_connected = false;
          notesObj.mp_collector_id = '';
          notesObj.mp_nickname = '';
          delete notesObj.mp_access_token;
          delete notesObj.mp_refresh_token;

          await requestHttps(
            {
              hostname: supabaseHost,
              path: `/rest/v1/prestadores?email=eq.${encodeURIComponent(providerEmail)}`,
              method: 'PATCH',
              headers: {
                ...authHeaders,
                Prefer: 'return=minimal',
              },
            },
            {
              notes: JSON.stringify(notesObj),
              updated_at: new Date().toISOString(),
            }
          );
        } catch (discErr) {
          console.warn('[MercadoPago API] Error purgando credenciales en disconnect:', discErr);
          return res.status(500).json({ error: 'Error al purgar credenciales protegidas.' });
        }
      }

      return res.status(200).json({ success: true, disconnected: true });
    }

    // C. CREAR PREFERENCIA DE PAGO (Checkout Pro)
    if (action === 'create-preference') {
      const {
        experienceId,
        experienceTitle,
        experienceSlug,
        date,
        participants,
        discountCode,
        baseAmountArs,
        surchargeArs,
        totalAmountArs,
        payer,
      } = body;

      const requestedSlug = experienceSlug || 'experiencia';
      let expData = null;
      let clubSurchargePct = 12;
      let resolvedSellerToken = '';
      let isAuthorizedSeller = false;

      if (supabaseUrl && supabaseServiceKey) {
        try {
          const supabaseHost = new URL(supabaseUrl).hostname;
          const authHeaders = {
            'Content-Type': 'application/json',
            apikey: supabaseServiceKey,
            Authorization: `Bearer ${supabaseServiceKey}`,
          };

          // 1. Cargar la experiencia desde Supabase para obtener precios oficiales y disponibilidad
          const expQuery = experienceId
            ? `/rest/v1/experiencias?id=eq.${encodeURIComponent(experienceId)}&select=*`
            : `/rest/v1/experiencias?slug=eq.${encodeURIComponent(requestedSlug)}&select=*`;

          const expRes = await requestHttps({
            hostname: supabaseHost,
            path: expQuery,
            method: 'GET',
            headers: authHeaders,
          });

          if (expRes.status >= 200 && expRes.status < 300 && Array.isArray(expRes.data) && expRes.data.length > 0) {
            expData = expRes.data[0];
          }

          // 2. Cargar porcentaje de recargo oficial configurado por el Club
          const clubRes = await requestHttps({
            hostname: supabaseHost,
            path: `/rest/v1/prestadores?or=(id.eq.prov-club,slug.eq.club-de-experiencias)&select=notes`,
            method: 'GET',
            headers: authHeaders,
          });

          if (clubRes.status >= 200 && clubRes.status < 300 && Array.isArray(clubRes.data) && clubRes.data.length > 0) {
            const rawNotes = clubRes.data[0].notes;
            if (rawNotes) {
              try {
                const parsedNotes = JSON.parse(rawNotes);
                if (parsedNotes && parsedNotes.mercado_pago_surcharge_percentage !== undefined) {
                  const num = Number(parsedNotes.mercado_pago_surcharge_percentage);
                  if (Number.isFinite(num) && num >= 0 && num <= 100) {
                    clubSurchargePct = num;
                  }
                }
              } catch {
                // fallback
              }
            }
          }

          // 3. Resolver prestador y su autorización de Mercado Pago
          const providerEmail = (expData?.provider_email || body.providerEmail || '').trim().toLowerCase();
          if (providerEmail) {
            const provRes = await requestHttps({
              hostname: supabaseHost,
              path: `/rest/v1/prestadores?email=eq.${encodeURIComponent(providerEmail)}&select=notes`,
              method: 'GET',
              headers: authHeaders,
            });

            if (provRes.status >= 200 && provRes.status < 300 && Array.isArray(provRes.data) && provRes.data.length > 0) {
              const notesRaw = provRes.data[0].notes;
              if (notesRaw) {
                try {
                  const notes = JSON.parse(notesRaw);
                  if (notes && typeof notes === 'object' && Boolean(notes.mp_connected)) {
                    let sellerToken = '';

                    // 1. Verificar si notes.mp_access_token contiene un token válido no vacío
                    if (typeof notes.mp_access_token === 'string' && notes.mp_access_token.trim()) {
                      sellerToken = notes.mp_access_token.trim();
                    }

                    // 2. Si no está en notes, consultar el almacenamiento protegido del servidor (historial_mp)
                    if (!sellerToken) {
                      const tokenHistRes = await requestHttps({
                        hostname: supabaseHost,
                        path: `/rest/v1/historial_mp?provider_email=eq.${encodeURIComponent(providerEmail)}&action=eq.connect&order=changed_at.desc&limit=1&select=details`,
                        method: 'GET',
                        headers: authHeaders,
                      });
                      if (
                        tokenHistRes.status >= 200 &&
                        tokenHistRes.status < 300 &&
                        Array.isArray(tokenHistRes.data) &&
                        tokenHistRes.data.length > 0
                      ) {
                        const tokenDetails = tokenHistRes.data[0]?.details;
                        if (typeof tokenDetails?.access_token === 'string' && tokenDetails.access_token.trim()) {
                          sellerToken = tokenDetails.access_token.trim();
                        }
                      }
                    }

                    // isAuthorizedSeller es true únicamente cuando mp_connected es true y se dispone de un access token válido
                    if (sellerToken) {
                      resolvedSellerToken = sellerToken;
                      isAuthorizedSeller = true;
                    }
                  }
                } catch {
                  // Fallback
                }
              }
            }
          }
        } catch (dbErr) {
          console.warn('[MercadoPago API] Error consultando experiencia en Supabase:', dbErr);
        }
      }

      // Validar disponibilidad de la experiencia antes de crear preferencia
      if (!expData) {
        if (!isTestEnv) {
          return res.status(404).json({ error: 'La experiencia solicitada no fue encontrada.' });
        }
      } else {
        if (expData.status && expData.status !== 'publicada') {
          return res.status(400).json({ error: 'La experiencia no se encuentra disponible para reservas públicas.' });
        }
      }

      // Validar disponibilidad de la fecha seleccionada
      const selectedDate = (date || '').trim();
      let expDates = [];
      if (Array.isArray(expData?.dates)) {
        expDates = expData.dates;
      } else if (typeof expData?.dates === 'string') {
        try {
          expDates = JSON.parse(expData.dates);
        } catch {
          // fallback
        }
      }

      if (Array.isArray(expDates) && expDates.length > 0 && selectedDate && selectedDate !== 'A coordinar') {
        if (!expDates.includes(selectedDate)) {
          return res.status(400).json({ error: 'La fecha seleccionada no está disponible.' });
        }
      }

      // Validar si la fecha específica está cerrada o tiene cupo diferenciado
      let dateSlots = [];
      if (Array.isArray(expData?.date_slots)) {
        dateSlots = expData.date_slots;
      } else if (typeof expData?.date_slots === 'string') {
        try {
          dateSlots = JSON.parse(expData.date_slots);
        } catch {
          // fallback
        }
      }

      let slotCapacity = expData?.capacity_per_date || 12;
      if (Array.isArray(dateSlots) && selectedDate && selectedDate !== 'A coordinar') {
        const matchingSlot = dateSlots.find((s) => s && s.date === selectedDate);
        if (matchingSlot) {
          if (matchingSlot.closed === true) {
            return res.status(400).json({ error: 'Esta fecha se encuentra cerrada para nuevas reservas.' });
          }
          if (matchingSlot.unlimited === true) {
            slotCapacity = 999;
          } else if (Number(matchingSlot.capacity) > 0) {
            slotCapacity = Number(matchingSlot.capacity);
          }
        }
      }

      // Validar cantidad de participantes
      const parsedCount = Number(participants);
      if (!Number.isInteger(parsedCount) || parsedCount < 1 || parsedCount > 20) {
        return res.status(400).json({
          error: 'Cantidad de personas inválida (debe ser un número entero entre 1 y 20).',
        });
      }
      if (slotCapacity < 999 && parsedCount > slotCapacity) {
        return res.status(400).json({
          error: `No hay cupos suficientes para esa fecha (capacidad máxima: ${slotCapacity}).`,
        });
      }

      // Validar cupos restantes en Supabase según reservas aprobadas/pendientes existentes
      if (
        supabaseUrl &&
        supabaseServiceKey &&
        expData?.id &&
        selectedDate &&
        selectedDate !== 'A coordinar' &&
        slotCapacity < 999
      ) {
        try {
          const supabaseHost = new URL(supabaseUrl).hostname;
          const authHeaders = {
            'Content-Type': 'application/json',
            apikey: supabaseServiceKey,
            Authorization: `Bearer ${supabaseServiceKey}`,
          };

          const currentBookingRef = (body.bookingReference || body.reference || '').trim();
          let queryPath = `/rest/v1/pagos_transferencias?experience_id=eq.${encodeURIComponent(expData.id)}&selected_date=eq.${encodeURIComponent(selectedDate)}&status=neq.rechazado&select=participants`;
          if (currentBookingRef) {
            queryPath += `&reference=neq.${encodeURIComponent(currentBookingRef)}`;
          }

          const seatsRes = await requestHttps({
            hostname: supabaseHost,
            path: queryPath,
            method: 'GET',
            headers: authHeaders,
          });

          if (seatsRes.status >= 200 && seatsRes.status < 300 && Array.isArray(seatsRes.data)) {
            const reservedSeats = seatsRes.data.reduce(
              (sum, row) => sum + (Number(row.participants) || 0),
              0
            );
            if (reservedSeats + parsedCount > slotCapacity) {
              const available = Math.max(0, slotCapacity - reservedSeats);
              return res.status(400).json({
                error: `No quedan cupos suficientes para esa fecha (disponibles: ${available}).`,
                available,
              });
            }
          }
        } catch (seatsErr) {
          console.warn('[MercadoPago API] Error consultando cupos en Supabase:', seatsErr);
        }
      }

      const count = parsedCount;

      // Calcular montos confiables desde los datos del servidor
      const pricePerPerson = expData ? Number(expData.price_ars) || 0 : (Number(baseAmountArs) || 65000);
      const subtotal = pricePerPerson * count;

      const discountObj = findDiscountCode(discountCode);
      const discountArs = discountObj ? Math.round((subtotal * discountObj.percentOff) / 100) : 0;
      const trustedBase = Math.max(0, subtotal - discountArs);
      const trustedSurcharge = Math.round((trustedBase * clubSurchargePct) / 100);
      const trustedTotal = trustedBase + trustedSurcharge;

      // Rechazar si hay discrepancia entre lo enviado por el cliente y lo derivado por el servidor
      if (baseAmountArs !== undefined && Math.abs(Number(baseAmountArs) - trustedBase) > 5) {
        return res.status(400).json({
          error: 'Monto base incompatible con la tarifa oficial calculada por el servidor.',
          expected: trustedBase,
          received: Number(baseAmountArs),
        });
      }
      if (totalAmountArs !== undefined && Math.abs(Number(totalAmountArs) - trustedTotal) > 5) {
        return res.status(400).json({
          error: 'Monto total incompatible con la tarifa y recargos oficiales calculados por el servidor.',
          expected: trustedTotal,
          received: Number(totalAmountArs),
        });
      }

      const slug = expData?.slug || requestedSlug;
      const title = expData?.title || experienceTitle || 'Experiencia en Catamarca';
      const base = trustedBase;
      const surcharge = trustedSurcharge;

      const items = [
        {
          id: expData?.id || experienceId || slug,
          title: `${title} (${count} ${count === 1 ? 'persona' : 'personas'}) - Fecha: ${date || 'A coordinar'}`,
          quantity: 1,
          currency_id: 'ARS',
          unit_price: base,
        },
      ];

      if (surcharge > 0) {
        items.push({
          id: 'gestion-mercadopago',
          title: `Gestión y Procesamiento Mercado Pago (+${clubSurchargePct}%)`,
          quantity: 1,
          currency_id: 'ARS',
          unit_price: surcharge,
        });
      }

      const backUrls = {
        success: `${appBaseUrl}/experiencias/${slug}/pago?status=approved`,
        failure: `${appBaseUrl}/experiencias/${slug}/pago?status=failure`,
        pending: `${appBaseUrl}/experiencias/${slug}/pago?status=pending`,
      };

      // Utilizar el access token del vendedor autorizado si está disponible, o el access token del Club/Marketplace
      const preferenceAccessToken = resolvedSellerToken || mpAccessToken;

      // Si no hay ningún access token disponible en el servidor, rechazar con error de configuración
      if (!preferenceAccessToken) {
        if (isTestEnv) {
          return res.status(200).json({
            status: 'simulated',
            preference_id: `pref-test-${Date.now()}`,
            init_point: `${backUrls.pending}&collection_status=in_process&preference_id=sim_${Date.now()}`,
            message: 'Modo simulación Mercado Pago activo únicamente en entorno de pruebas aislado.',
          });
        }

        return res.status(503).json({
          error: 'Pasarela de pago no configurada',
          message: 'El servicio de Mercado Pago no cuenta con credenciales activas en este entorno.',
        });
      }

      try {
        // En marketplace: si el vendedor está autorizado en el servidor y hay recargo, retener marketplace_fee para el Club
        const preferencePayload = {
          items,
          payer: {
            name: payer?.name || 'Explorador',
            email: payer?.email || 'explorador@experiencias.club',
            phone: {
              number: payer?.phone || '',
            },
            identification: {
              type: 'DNI',
              number: payer?.dni || '',
            },
          },
          back_urls: backUrls,
          auto_return: 'approved',
          statement_descriptor: 'EXPERIENCIAS.CLUB',
          external_reference: (body.bookingReference || body.reference || '').trim() || `exp_${experienceId || slug}_${Date.now()}`,
        };

        if (isAuthorizedSeller && surcharge > 0) {
          // El marketplace_fee retiene la comisión del Club
          preferencePayload.marketplace_fee = surcharge;
        }

        const mpRes = await requestHttps(
          {
            hostname: 'api.mercadopago.com',
            path: '/checkout/preferences',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${preferenceAccessToken}`,
            },
          },
          preferencePayload
        );

        if (mpRes.status >= 200 && mpRes.status < 300 && mpRes.data?.init_point) {
          return res.status(200).json({
            status: 'ok',
            preference_id: mpRes.data.id,
            init_point: mpRes.data.init_point,
            sandbox_init_point: mpRes.data.sandbox_init_point,
          });
        }

        return res.status(500).json({
          error: 'Error al generar preferencia en Mercado Pago',
          details: mpRes.data,
        });
      } catch (err) {
        return res.status(500).json({
          error: 'Error de conexión con Mercado Pago',
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // B. VERIFICACIÓN DE PAGO EN SERVIDOR (Verificar estatus real y asociación con la reserva)
    if (action === 'verify-payment') {
      const rawPaymentId =
        body.paymentId || body.collectionId || req.query?.payment_id || req.query?.collection_id;
      const targetExpId = (body.experienceId || req.query?.experience_id || '').trim();
      const targetExpSlug = (body.experienceSlug || req.query?.experience_slug || '').trim();
      const targetBookingRef = (body.bookingReference || req.query?.booking_reference || '').trim();

      if (!rawPaymentId) {
        return res.status(400).json({
          verified: false,
          error: 'Identificador de pago no proporcionado.',
        });
      }

      const paymentIdStr = String(rawPaymentId).trim();
      const isNumericPaymentId = /^\d+$/.test(paymentIdStr);

      // 1. Simulación en entorno de prueba aislado
      if (
        isTestEnv &&
        (paymentIdStr.startsWith('sim_') || paymentIdStr.startsWith('pref-test-'))
      ) {
        return res.status(200).json({
          verified: true,
          status: 'approved',
          paymentId: paymentIdStr,
          test_mode: true,
        });
      }

      if (!isNumericPaymentId) {
        return res.status(400).json({
          verified: false,
          error: 'Identificador de pago inválido.',
        });
      }

      const paymentId = paymentIdStr;

      // 2. Verificar si la reserva ya fue registrada y aprobada previamente en Supabase
      if (supabaseUrl && supabaseServiceKey) {
        try {
          const supabaseHost = new URL(supabaseUrl).hostname;
          const authHeaders = {
            'Content-Type': 'application/json',
            apikey: supabaseServiceKey,
            Authorization: `Bearer ${supabaseServiceKey}`,
          };

          const shortRef = String(paymentId).slice(-6).toUpperCase();
          const filterConditions = [
            `receipt_storage_path.eq.${encodeURIComponent(paymentId)}`,
            `reference.eq.MP-${encodeURIComponent(paymentId)}`,
            `reference.eq.MP-${encodeURIComponent(shortRef)}`,
          ];
          if (targetBookingRef) {
            filterConditions.push(`reference.eq.${encodeURIComponent(targetBookingRef)}`);
          }

          const callerEmail = (
            body.email ||
            body.payerEmail ||
            body.payer?.email ||
            req.query?.email ||
            req.query?.payer_email ||
            ''
          ).trim().toLowerCase();

          let authenticatedUserEmail = '';
          const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
          const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
          if (bearerToken) {
            try {
              const userRes = await requestHttps({
                hostname: supabaseHost,
                path: '/auth/v1/user',
                method: 'GET',
                headers: {
                  Authorization: `Bearer ${bearerToken}`,
                  apikey: supabaseServiceKey,
                },
              });
              if (userRes.status >= 200 && userRes.status < 300 && userRes.data?.email) {
                authenticatedUserEmail = String(userRes.data.email).trim().toLowerCase();
              }
            } catch {}
          }

          const checkRes = await requestHttps({
            hostname: supabaseHost,
            path: `/rest/v1/pagos_transferencias?or=(${filterConditions.join(',')})&select=${CONFIRMATION_VIEW_FIELDS}`,
            method: 'GET',
            headers: authHeaders,
          });

          if (
            checkRes.status >= 200 &&
            checkRes.status < 300 &&
            Array.isArray(checkRes.data) &&
            checkRes.data.length > 0
          ) {
            const existingRow = checkRes.data[0];
            if (existingRow.status === 'aprobado') {
              if (
                !targetExpId ||
                existingRow.experience_id === targetExpId ||
                (targetExpSlug &&
                  existingRow.experience_title?.toLowerCase().includes(targetExpSlug.toLowerCase()))
              ) {
                const rowEmail = String(existingRow.email || '').trim().toLowerCase();
                const isMatchingBuyer =
                  (callerEmail && rowEmail && callerEmail === rowEmail) ||
                  (authenticatedUserEmail && rowEmail && authenticatedUserEmail === rowEmail);

                // Requerir que el comprador coincida para confirmar una fila existente sin exponer PII a enumeradores
                if (isMatchingBuyer) {
                  return res.status(200).json({
                    verified: true,
                    status: 'approved',
                    paymentId: String(paymentId),
                    alreadyPersisted: true,
                    booking: sanitizeBookingForConfirmation(existingRow),
                  });
                }
              }
            }
          }
        } catch (dbErr) {
          console.warn('[MercadoPago API] Error consultando pagos_transferencias en verificación:', dbErr);
        }
      }

      if (!mpAccessToken) {
        return res.status(503).json({
          verified: false,
          error: 'Pasarela de pago no configurada en este entorno.',
        });
      }

      try {
        // 3. Consultar el estado real del pago directamente en la API de Mercado Pago
        const paymentRes = await requestHttps({
          hostname: 'api.mercadopago.com',
          path: `/v1/payments/${encodeURIComponent(paymentId)}`,
          method: 'GET',
          headers: {
            Authorization: `Bearer ${mpAccessToken}`,
          },
        });

        if (paymentRes.status < 200 || paymentRes.status >= 300 || !paymentRes.data?.id) {
          return res.status(502).json({
            verified: false,
            error: 'No se pudo verificar el pago en Mercado Pago.',
          });
        }

        const paymentData = paymentRes.data;
        const mpStatus = paymentData.status;

        if (mpStatus !== 'approved') {
          return res.status(400).json({
            verified: false,
            status: mpStatus,
            error: `El pago se encuentra en estado '${mpStatus}' y no ha sido aprobado.`,
          });
        }

        const externalReference = String(paymentData.external_reference || '').trim();
        let confirmedBooking = null;
        if (supabaseUrl && supabaseServiceKey) {
          try {
            const supabaseHost = new URL(supabaseUrl).hostname;
            const authHeaders = {
              'Content-Type': 'application/json',
              apikey: supabaseServiceKey,
              Authorization: `Bearer ${supabaseServiceKey}`,
            };

            const bookingRef = (externalReference || targetBookingRef || `MP-${paymentId}`).trim();
            const filterConditions = [
              `reference.eq.${encodeURIComponent(bookingRef)}`,
              `receipt_storage_path.eq.${encodeURIComponent(paymentId)}`,
              `receipt_storage_path.eq.${encodeURIComponent(bookingRef)}`,
            ];
            if (targetBookingRef && targetBookingRef !== bookingRef) {
              filterConditions.push(`reference.eq.${encodeURIComponent(targetBookingRef)}`);
            }

            // Consultar la reserva registrada para validar contra sus valores confiables
            const lookupRes = await requestHttps({
              hostname: supabaseHost,
              path: `/rest/v1/pagos_transferencias?or=(${filterConditions.join(',')})&select=${CONFIRMATION_VIEW_FIELDS}`,
              method: 'GET',
              headers: authHeaders,
            });

            if (
              lookupRes.status >= 200 &&
              lookupRes.status < 300 &&
              Array.isArray(lookupRes.data) &&
              lookupRes.data.length > 0
            ) {
              const matchedRow = lookupRes.data[0];

              // Validar monto y experiencia contra los valores confiables de la reserva almacenada
              const validation = validatePaymentAgainstBooking(paymentData, matchedRow);
              if (!validation.valid) {
                return res.status(400).json({
                  verified: false,
                  error: validation.error,
                });
              }

              if (matchedRow.status === 'aprobado') {
                confirmedBooking = matchedRow;
              } else {
                const patchRes = await requestHttps(
                  {
                    hostname: supabaseHost,
                    path: `/rest/v1/pagos_transferencias?id=eq.${encodeURIComponent(matchedRow.id)}&select=${CONFIRMATION_VIEW_FIELDS}`,
                    method: 'PATCH',
                    headers: {
                      ...authHeaders,
                      Prefer: 'return=representation',
                    },
                  },
                  {
                    status: 'aprobado',
                    receipt_storage_path: String(paymentId),
                    reviewed_by: 'mercadopago_checkout',
                    reviewed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  }
                );

                if (
                  patchRes.status >= 200 &&
                  patchRes.status < 300 &&
                  Array.isArray(patchRes.data) &&
                  patchRes.data.length > 0
                ) {
                  confirmedBooking = patchRes.data[0];
                } else {
                  confirmedBooking = {
                    ...matchedRow,
                    status: 'aprobado',
                    receipt_storage_path: String(paymentId),
                    reviewed_by: 'mercadopago_checkout',
                    reviewed_at: new Date().toISOString(),
                  };
                }
              }
            }
          } catch (patchErr) {
            console.warn('[MercadoPago API] Error actualizando reserva a aprobado en verify-payment:', patchErr);
          }
        }

        return res.status(200).json({
          verified: true,
          status: 'approved',
          paymentId: paymentData.id,
          amountArs: paymentData.transaction_amount,
          externalReference: paymentData.external_reference,
          dateApproved: paymentData.date_approved,
          booking: sanitizeBookingForConfirmation(confirmedBooking),
        });
      } catch (err) {
        return res.status(500).json({
          verified: false,
          error: 'Error de comunicación al verificar el pago con Mercado Pago.',
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // C. WEBHOOK DE NOTIFICACIONES (IPN / Webhooks de pagos)
    const isWebhook =
      action === 'webhook' ||
      req.query?.topic === 'payment' ||
      body.type === 'payment' ||
      (typeof body.action === 'string' && body.action.startsWith('payment.'));

    if (isWebhook) {
      const rawPaymentId = body.data?.id || req.query?.id || body.id;

      if (!rawPaymentId) {
        // Notificación de prueba o ping sin ID de pago
        return res.status(200).json({ received: true, acknowledged: true });
      }

      const paymentIdStr = String(rawPaymentId).trim();
      const isNumericPaymentId = /^\d+$/.test(paymentIdStr);

      if (!isNumericPaymentId) {
        if (isTestEnv && (paymentIdStr.startsWith('sim_') || paymentIdStr.startsWith('test_'))) {
          return res.status(200).json({ received: true, test_mode: true });
        }
        return res.status(400).json({ error: 'Identificador de pago inválido.' });
      }

      const paymentId = paymentIdStr;

      if (!mpAccessToken) {
        if (isTestEnv) {
          return res.status(200).json({ received: true, test_mode: true });
        }
        return res.status(503).json({ error: 'Mercado Pago no configurado en este entorno.' });
      }

      try {
        // 1. Verificar la notificación consultando el estado actual del pago directamente a Mercado Pago
        const paymentRes = await requestHttps({
          hostname: 'api.mercadopago.com',
          path: `/v1/payments/${encodeURIComponent(paymentId)}`,
          method: 'GET',
          headers: {
            Authorization: `Bearer ${mpAccessToken}`,
          },
        });

        if (paymentRes.status < 200 || paymentRes.status >= 300 || !paymentRes.data?.id) {
          return res.status(502).json({
            error: 'No se pudo verificar el pago en Mercado Pago.',
          });
        }

        const paymentData = paymentRes.data;
        const mpStatus = paymentData.status;
        const externalReference = (paymentData.external_reference || '').trim();
        const bookingStatus =
          mpStatus === 'approved'
            ? 'aprobado'
            : mpStatus === 'rejected' || mpStatus === 'cancelled'
            ? 'rechazado'
            : 'pendiente';

        // 2. Actualizar o registrar la reserva de manera idempotente en Supabase
        if (supabaseUrl && supabaseServiceKey) {
          const supabaseHost = new URL(supabaseUrl).hostname;
          const authHeaders = {
            'Content-Type': 'application/json',
            apikey: supabaseServiceKey,
            Authorization: `Bearer ${supabaseServiceKey}`,
          };

          const bookingRef = externalReference || `MP-${paymentId}`;

          // Verificar si ya existe una reserva con esta referencia
          const checkRes = await requestHttps({
            hostname: supabaseHost,
            path: `/rest/v1/pagos_transferencias?or=(reference.eq.${encodeURIComponent(bookingRef)},receipt_storage_path.eq.${encodeURIComponent(paymentId)},receipt_storage_path.eq.${encodeURIComponent(bookingRef)})&select=id,status,amount_ars,experience_id,experience_title`,
            method: 'GET',
            headers: authHeaders,
          });

          if (
            checkRes.status >= 200 &&
            checkRes.status < 300 &&
            Array.isArray(checkRes.data) &&
            checkRes.data.length > 0
          ) {
            const matchedRow = checkRes.data[0];

            // Validar monto y experiencia antes de aprobar
            if (bookingStatus === 'aprobado') {
              const validation = validatePaymentAgainstBooking(paymentData, matchedRow);
              if (!validation.valid) {
                console.warn('[MercadoPago Webhook] Validación de pago fallida para reserva existente:', {
                  paymentId,
                  bookingId: matchedRow.id,
                  error: validation.error,
                });
                return res.status(400).json({
                  error: 'Discrepancia en el pago contra la reserva registrada.',
                  details: validation.error,
                });
              }
            }

            // Actualización idempotente de la reserva existente
            const patchRes = await requestHttps(
              {
                hostname: supabaseHost,
                path: `/rest/v1/pagos_transferencias?id=eq.${encodeURIComponent(matchedRow.id)}`,
                method: 'PATCH',
                headers: {
                  ...authHeaders,
                  Prefer: 'return=minimal',
                },
              },
              {
                status: bookingStatus,
                receipt_storage_path: String(paymentId),
                reviewed_by: 'mercadopago_webhook',
                reviewed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }
            );

            if (patchRes.status < 200 || patchRes.status >= 300) {
              return res.status(500).json({ error: 'Error al actualizar estado de reserva existente.' });
            }
          } else {
            // Si la reserva no existía previamente, resolver un experience_id válido antes de registrar
            let targetExpId = null;
            let targetExpTitle = paymentData.description || 'Experiencia en Catamarca';
            const rawExpKey = externalReference.startsWith('exp_')
              ? externalReference.replace(/^exp_/, '').replace(/_\d+$/, '')
              : '';

            if (rawExpKey) {
              const expRes = await requestHttps({
                hostname: supabaseHost,
                path: `/rest/v1/experiencias?or=(id.eq.${encodeURIComponent(rawExpKey)},slug.eq.${encodeURIComponent(rawExpKey)})&select=id,title`,
                method: 'GET',
                headers: authHeaders,
              });
              if (
                expRes.status >= 200 &&
                expRes.status < 300 &&
                Array.isArray(expRes.data) &&
                expRes.data.length > 0
              ) {
                targetExpId = expRes.data[0].id;
                targetExpTitle = expRes.data[0].title || targetExpTitle;
              }
            }

            if (!targetExpId && Array.isArray(paymentData.additional_info?.items) && paymentData.additional_info.items.length > 0) {
              const itemCandidate = String(paymentData.additional_info.items[0]?.id || '').trim();
              if (itemCandidate && itemCandidate !== 'gestion-mercadopago') {
                const expRes = await requestHttps({
                  hostname: supabaseHost,
                  path: `/rest/v1/experiencias?or=(id.eq.${encodeURIComponent(itemCandidate)},slug.eq.${encodeURIComponent(itemCandidate)})&select=id,title`,
                  method: 'GET',
                  headers: authHeaders,
                });
                if (
                  expRes.status >= 200 &&
                  expRes.status < 300 &&
                  Array.isArray(expRes.data) &&
                  expRes.data.length > 0
                ) {
                  targetExpId = expRes.data[0].id;
                  targetExpTitle = expRes.data[0].title || targetExpTitle;
                }
              }
            }

            // Si no se pudo identificar una experiencia válida, omitir la creación de reserva
            if (!targetExpId) {
              console.warn(
                '[MercadoPago Webhook] Pago recibido sin experiencia identificable. Se omite la creación automática de reserva:',
                {
                  paymentId,
                  externalReference,
                }
              );
              return res.status(200).json({
                received: true,
                payment_id: paymentId,
                skipped: true,
                reason: 'unmatched_experience',
              });
            }

            // Si la experiencia fue identificada pero la reserva no estaba registrada previamente,
            // enrutar a revisión manual ('pendiente') en lugar de auto-aprobar
            const manualReviewStatus = bookingStatus === 'rechazado' ? 'rechazado' : 'pendiente';

            const insertRes = await requestHttps(
              {
                hostname: supabaseHost,
                path: '/rest/v1/pagos_transferencias?on_conflict=reference',
                method: 'POST',
                headers: {
                  ...authHeaders,
                  Prefer: 'resolution=merge-duplicates,return=minimal',
                },
              },
              {
                reference: bookingRef,
                experience_id: targetExpId,
                experience_title: targetExpTitle,
                full_name:
                  `${paymentData.payer?.first_name || ''} ${paymentData.payer?.last_name || ''}`.trim() ||
                  'Cliente Mercado Pago',
                email: paymentData.payer?.email || 'explorador@experiencias.club',
                selected_date: 'A coordinar',
                participants: 1,
                amount_ars: Math.round(paymentData.transaction_amount || 0),
                status: manualReviewStatus,
                receipt_file_name: `mercadopago-${paymentId}.pdf`,
                receipt_url: 'https://www.mercadopago.com.ar',
                receipt_storage_provider: 'mercadopago',
                reviewed_by: 'mercadopago_webhook',
                reviewed_at: new Date().toISOString(),
              }
            );

            if (insertRes.status < 200 || insertRes.status >= 300) {
              return res.status(500).json({ error: 'Error al registrar nueva reserva desde webhook.' });
            }
          }
        }

        // 3. Devolver acuse de recibo HTTP 200 únicamente después de procesar con éxito
        return res.status(200).json({
          received: true,
          payment_id: paymentId,
          status: bookingStatus,
        });
      } catch (webhookErr) {
        console.error('[MercadoPago Webhook] Excepción al procesar notificación:', webhookErr);
        return res.status(500).json({
          error: 'Error interno al procesar webhook de Mercado Pago.',
          message: webhookErr instanceof Error ? webhookErr.message : String(webhookErr),
        });
      }
    }

    return res.status(400).json({ error: 'Acción no soportada.' });
  }

  return res.status(405).json({ error: 'Método no permitido.' });
};

