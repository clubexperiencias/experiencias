const https = require('https');

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
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` :
    'https://experiencias.club'
  ).replace(/\/+$/, '');

  return {
    mpAccessToken,
    mpClientId,
    mpClientSecret,
    supabaseUrl,
    supabaseServiceKey,
    appBaseUrl,
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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { mpAccessToken, mpClientId, mpClientSecret, appBaseUrl } = getEnvConfig();

  // 1. GET: OAuth Callback (cuando un prestador autoriza la app de Mercado Pago)
  if (req.method === 'GET') {
    const { action, code, state } = req.query || {};

    if (action === 'oauth-callback' || code) {
      if (!code) {
        return res.status(400).json({ error: 'Falta el parámetro code en el callback.' });
      }

      if (!mpClientId || !mpClientSecret) {
        // Modo fallback / simulación si no se configuraron credenciales en Vercel
        const redirectUrl = `${appBaseUrl}/prestadores/perfil?mp_connected=simulated&code=${encodeURIComponent(code)}`;
        return res.redirect(302, redirectUrl);
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
            try {
              await requestHttps(
                {
                  hostname: new URL(supabaseUrl).hostname,
                  path: '/rest/v1/historial_mp',
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    apikey: supabaseServiceKey,
                    Authorization: `Bearer ${supabaseServiceKey}`,
                    Prefer: 'return=minimal',
                  },
                },
                {
                  provider_email: state || 'oauth_provider',
                  action: 'connect',
                  collector_id: String(collectorId),
                  details: {
                    live_mode: tokenRes.data.live_mode,
                    scope: tokenRes.data.scope,
                  },
                  changed_by: 'mercadopago_oauth',
                }
              );
            } catch (histErr) {
              console.warn('[MercadoPago API] No se pudo registrar historial_mp:', histErr);
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

    // A. CREAR PREFERENCIA DE PAGO (Checkout Pro)
    if (action === 'create-preference') {
      const {
        experienceId,
        experienceTitle,
        experienceSlug,
        date,
        participants,
        baseAmountArs,
        surchargeArs,
        totalAmountArs,
        payer,
        providerCollectorId,
      } = body;

      const slug = experienceSlug || 'experiencia';
      const count = Number(participants) || 1;
      const total = Number(totalAmountArs) || 0;
      const surcharge = Number(surchargeArs) || 0;
      const base = Number(baseAmountArs) || (total - surcharge);

      const items = [
        {
          id: experienceId || slug,
          title: `${experienceTitle || 'Experiencia en Catamarca'} (${count} ${count === 1 ? 'persona' : 'personas'}) - Fecha: ${date || 'A coordinar'}`,
          quantity: 1,
          currency_id: 'ARS',
          unit_price: base,
        },
      ];

      if (surcharge > 0) {
        items.push({
          id: 'gestion-mercadopago',
          title: 'Gestión y Procesamiento Mercado Pago',
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

      // Si no hay MP_ACCESS_TOKEN configurado en el servidor, generamos respuesta simulada
      if (!mpAccessToken) {
        return res.status(200).json({
          status: 'simulated',
          preference_id: `pref-sim-${Date.now()}`,
          init_point: `${backUrls.success}&collection_status=approved&collection_id=sim_${Date.now()}`,
          message: 'Modo simulación Mercado Pago: Access Token no configurado aún en variables de entorno.',
        });
      }

      try {
        // En marketplace: si providerCollectorId está presente, podemos indicar marketplace_fee
        // Mercado Pago retiene marketplace_fee para el Club y acredita el resto al prestador
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
          external_reference: `exp_${experienceId || slug}_${Date.now()}`,
        };

        if (providerCollectorId && surcharge > 0) {
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
              Authorization: `Bearer ${mpAccessToken}`,
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

    // B. WEBHOOK DE NOTIFICACIONES (IPN / Webhooks de pagos)
    if (action === 'webhook' || req.query?.topic === 'payment' || body.type === 'payment') {
      return res.status(200).json({ received: true });
    }

    return res.status(400).json({ error: 'Acción no soportada.' });
  }

  return res.status(405).json({ error: 'Método no permitido.' });
};

