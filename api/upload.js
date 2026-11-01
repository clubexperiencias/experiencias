const crypto = require('crypto');
const https = require('https');

const ACCEPTED_MIME_TYPES = new Set([
  // Images
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/svg+xml',
  'image/heic',
  'image/heif',
  // Documents
  'application/pdf',
  // Videos
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-m4v',
]);

const MAX_DIRECT_BYTES = 4.5 * 1024 * 1024; // 4.5 MB (límite serverless de Vercel para body JSON)
const MAX_PRESIGNED_BYTES = 100 * 1024 * 1024; // 100 MB (subida directa a Cloudflare R2)

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
  const clean = String(name || 'archivo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return clean.slice(-80) || 'archivo';
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
  const rawRef = String(reference || 'PAY').toUpperCase();
  const safeRef = rawRef.replace(/[^A-Z0-9_-]/g, '').slice(0, 24) || 'MEDIA';
  const randomSuffix = crypto.randomBytes(4).toString('hex');
  const safeName = sanitizeFileName(fileName);

  let folder = 'comprobantes';
  if (rawRef.startsWith('ALBUM')) {
    folder = 'experiencias/albumes';
  } else if (rawRef.startsWith('PROPOSAL')) {
    folder = 'experiencias/propuestas';
  } else if (rawRef.startsWith('VIDEO')) {
    folder = 'experiencias/videos';
  } else if (rawRef.startsWith('COMMUNITY')) {
    folder = 'comunidad';
  } else if (rawRef.startsWith('EXPERIENCIA')) {
    folder = 'experiencias';
  }

  return `${folder}/${yearMonth}/${safeRef}-${randomSuffix}-${safeName}`;
}

function createPresignedPutUrl({
  accountId,
  accessKeyId,
  secretAccessKey,
  bucketName,
  objectKey,
  mimeType,
  expiresSeconds = 900,
}) {
  const region = 'auto';
  const service = 's3';
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${bucketName}/${objectKey.split('/').map(encodeRfc3986).join('/')}`;
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  const queryParams = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', `${accessKeyId}/${credentialScope}`],
    ['X-Amz-Date', amzDate],
    ['X-Amz-Expires', String(expiresSeconds)],
    ['X-Amz-SignedHeaders', 'content-type;host'],
  ].sort(([a], [b]) => a.localeCompare(b));

  const canonicalQueryString = queryParams
    .map(([k, v]) => `${encodeRfc3986(k)}=${encodeRfc3986(v)}`)
    .join('&');

  const canonicalHeaders = `content-type:${mimeType}\nhost:${host}\n`;
  const signedHeaders = 'content-type;host';
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
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex');

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
    const region = 'auto';
    const service = 's3';
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const host = `${accountId}.r2.cloudflarestorage.com`;
    const canonicalUri = `/${bucketName}/${objectKey.split('/').map(encodeRfc3986).join('/')}`;
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const payloadHash = sha256Hex(buffer);

    const canonicalHeaders = `content-length:${buffer.length}\ncontent-type:${mimeType}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'content-length;content-type;host;x-amz-content-sha256;x-amz-date';

    const canonicalRequest = [
      'PUT',
      canonicalUri,
      '',
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
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex');

    const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const req = https.request(
      `https://${host}${canonicalUri}`,
      {
        method: 'PUT',
        headers: {
          'Content-Length': buffer.length,
          'Content-Type': mimeType,
          Host: host,
          'x-amz-content-sha256': payloadHash,
          'x-amz-date': amzDate,
          Authorization: authHeader,
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
              new Error(`R2 respondió con estado ${res.statusCode}: ${responseBody.slice(0, 300)}`),
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
        'Cloudflare R2 no está configurado en las variables de entorno (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME).',
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
        error: 'Formato no admitido. Subí una imagen (JPG, PNG, WEBP, AVIF), video (MP4, WEBM) o PDF.',
      });
    }

    const objectKey = buildObjectKey(reference, fileName);
    const publicUrl = config.publicBaseUrl
      ? `${config.publicBaseUrl}/${objectKey}`
      : `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucketName}/${objectKey}`;

    if (action === 'presign') {
      if (sizeBytes && Number(sizeBytes) > MAX_PRESIGNED_BYTES) {
        return res.status(400).json({
          success: false,
          error: 'El archivo supera el límite de 100 MB para subida presignada.',
        });
      }

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

    if (!buffer.length || buffer.length > MAX_DIRECT_BYTES) {
      return res.status(400).json({
        success: false,
        error: 'El archivo está vacío o supera el límite de 4.5 MB para subida directa. Usá subida presignada.',
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
    console.error('[api/upload] Error subiendo a Cloudflare R2:', err);
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Error interno al subir el archivo a R2.',
    });
  }
};

