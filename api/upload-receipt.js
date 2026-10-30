const crypto = require('crypto');
const https = require('https');

const ACCEPTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

function getEnvConfig() {
  const accountId = (
    process.env.R2_ACCOUNT_ID ||
    process.env.CLOUDFLARE_ACCOUNT_ID ||
    process.env.CF_ACCOUNT_ID ||
    ''
  ).trim();

  const accessKeyId = (
    process.env.R2_ACCESS_KEY_ID ||
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ||
    ''
  ).trim();

  const secretAccessKey = (
    process.env.R2_SECRET_ACCESS_KEY ||
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ||
    ''
  ).trim();

  const bucketName = (
    process.env.R2_BUCKET_NAME ||
    process.env.CLOUDFLARE_R2_BUCKET_NAME ||
    'experiencias-comprobantes'
  ).trim();

  const publicBaseUrl = (
    process.env.R2_PUBLIC_URL ||
    process.env.R2_PUBLIC_BASE_URL ||
    process.env.CLOUDFLARE_R2_PUBLIC_URL ||
    ''
  )
    .trim()
    .replace(/\/+$/, '');

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    publicBaseUrl,
    isConfigured: Boolean(accountId && accessKeyId && secretAccessKey && bucketName),
  };
}

function hmac(key, data, encoding) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest(encoding);
}

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function getSignatureKey(secretAccessKey, dateStamp, region, service) {
  const kDate = hmac('AWS4' + secretAccessKey, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

function sanitizeFileName(name) {
  const clean = String(name || 'comprobante')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return clean.slice(-80) || 'comprobante';
}

function encodeRfc3986(str) {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

function buildObjectKey(reference, fileName) {
  const now = new Date();
  const yearMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const safeRef = String(reference || 'PAY')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .toUpperCase()
    .slice(0, 24);
  const randomSuffix = crypto.randomBytes(4).toString('hex');
  const safeName = sanitizeFileName(fileName);
  return `comprobantes/${yearMonth}/${safeRef}-${randomSuffix}-${safeName}`;
}

function createPresignedPutUrl({
  accountId,
  accessKeyId,
  secretAccessKey,
  bucketName,
  objectKey,
  mimeType,
  expiresInSeconds = 600,
}) {
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const region = 'auto';
  const service = 's3';

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  const encodedKey = objectKey.split('/').map(encodeRfc3986).join('/');
  const canonicalUri = `/${encodeRfc3986(bucketName)}/${encodedKey}`;
  const signedHeaders = 'content-type;host';

  const queryParams = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', `${accessKeyId}/${credentialScope}`],
    ['X-Amz-Date', amzDate],
    ['X-Amz-Expires', String(expiresInSeconds)],
    ['X-Amz-SignedHeaders', signedHeaders],
  ];

  const canonicalQueryString = queryParams
    .map(([k, v]) => `${encodeRfc3986(k)}=${encodeRfc3986(v)}`)
    .sort()
    .join('&');

  const canonicalHeaders = `content-type:${mimeType}\nhost:${host}\n`;
  const payloadHash = 'UNSIGNED-PAYLOAD';

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signature = hmac(signingKey, stringToSign, 'hex');

  return `https://${host}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}

function putObjectToR2({
  accountId,
  accessKeyId,
  secretAccessKey,
  bucketName,
  objectKey,
  buffer,
  mimeType,
}) {
  return new Promise((resolve, reject) => {
    const host = `${accountId}.r2.cloudflarestorage.com`;
    const region = 'auto';
    const service = 's3';

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);

    const encodedKey = objectKey.split('/').map(encodeRfc3986).join('/');
    const canonicalUri = `/${encodeRfc3986(bucketName)}/${encodedKey}`;
    const payloadHash = sha256Hex(buffer);

    const canonicalHeaders =
      `content-type:${mimeType}\n` +
      `host:${host}\n` +
      `x-amz-content-sha256:${payloadHash}\n` +
      `x-amz-date:${amzDate}\n`;

    const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
    const canonicalRequest = [
      'PUT',
      canonicalUri,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest),
    ].join('\n');

    const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, service);
    const signature = hmac(signingKey, stringToSign, 'hex');

    const authorizationHeader =
      `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const req = https.request(
      {
        hostname: host,
        port: 443,
        path: canonicalUri,
        method: 'PUT',
        headers: {
          'Content-Type': mimeType,
          'Content-Length': buffer.length,
          'x-amz-content-sha256': payloadHash,
          'x-amz-date': amzDate,
          Authorization: authorizationHeader,
        },
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => {
          responseBody += chunk;
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(
              new Error(
                `R2 respondió con estado ${res.statusCode}: ${responseBody.slice(0, 300)}`,
              ),
            );
          }
        });
      },
    );

    req.on('error', (err) => reject(err));
    req.write(buffer);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const config = getEnvConfig();
  if (!config.isConfigured) {
    return res.status(503).json({
      success: false,
      code: 'R2_NOT_CONFIGURED',
      error:
        'Cloudflare R2 no está configurado aún en las variables de entorno (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME).',
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { action = 'upload', fileName, mimeType, fileBase64, reference, sizeBytes } = body;

    if (!fileName || !mimeType) {
      return res.status(400).json({
        success: false,
        error: 'Faltan parámetros requeridos (fileName, mimeType).',
      });
    }

    if (!ACCEPTED_MIME_TYPES.has(mimeType)) {
      return res.status(400).json({
        success: false,
        error: 'Formato no admitido. Subí una imagen (JPG, PNG, WEBP) o un PDF.',
      });
    }

    if (sizeBytes && Number(sizeBytes) > MAX_FILE_BYTES) {
      return res.status(400).json({
        success: false,
        error: 'El archivo supera el límite de 5 MB.',
      });
    }

    const objectKey = buildObjectKey(reference, fileName);
    const publicUrl = config.publicBaseUrl
      ? `${config.publicBaseUrl}/${objectKey}`
      : `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucketName}/${objectKey}`;

    if (action === 'presign') {
      const uploadUrl = createPresignedPutUrl({
        accountId: config.accountId,
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        bucketName: config.bucketName,
        objectKey,
        mimeType,
      });

      return res.status(200).json({
        success: true,
        provider: 'r2',
        mode: 'presign',
        key: objectKey,
        uploadUrl,
        url: publicUrl,
      });
    }

    if (!fileBase64) {
      return res.status(400).json({
        success: false,
        error: 'Falta el contenido del archivo (fileBase64).',
      });
    }

    const base64Clean = String(fileBase64).replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Clean, 'base64');

    if (!buffer.length || buffer.length > MAX_FILE_BYTES) {
      return res.status(400).json({
        success: false,
        error: 'El archivo está vacío o supera el límite de 5 MB.',
      });
    }

    await putObjectToR2({
      accountId: config.accountId,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      bucketName: config.bucketName,
      objectKey,
      buffer,
      mimeType,
    });

    return res.status(200).json({
      success: true,
      provider: 'r2',
      mode: 'direct',
      key: objectKey,
      url: publicUrl,
      sizeBytes: buffer.length,
    });
  } catch (err) {
    console.error('[api/upload-receipt] Error subiendo a Cloudflare R2:', err);
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Error interno al subir el comprobante a R2.',
    });
  }
};
