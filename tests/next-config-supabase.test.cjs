const { test } = require('node:test');
const assert = require('node:assert/strict');

async function configWithUrl(value) {
  const original = process.env.NEXT_PUBLIC_SUPABASE_URL;
  try {
    if (value === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = value;
    delete require.cache[require.resolve('../next.config.js')];
    const config = require('../next.config.js');
    const headers = await config.headers();
    return { csp: headers[0].headers.find((header) => header.key === 'Content-Security-Policy').value, patterns: config.images.remotePatterns };
  } finally {
    if (original === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = original;
  }
}

test('permite unicamente el origen configurado para almacenamiento e imagenes', async () => {
  const config = await configWithUrl('https://ejemplo.supabase.co');
  assert.match(config.csp, /connect-src 'self' https:\/\/ejemplo\.supabase\.co /);
  assert.match(config.csp, /img-src 'self' blob: data: https:\/\/ejemplo\.supabase\.co /);
  assert.ok(config.patterns.some((pattern) => pattern.hostname === 'ejemplo.supabase.co'));
  assert.ok(!config.csp.includes('mzvzinbjclndofhceaaa.supabase.co'));
});

test('ignora URLs invalidas o inseguras', async () => {
  for (const url of [undefined, 'not-a-url', 'http://example.com', 'https://usuario:clave@example.com']) {
    const config = await configWithUrl(url);
    assert.equal(config.patterns.some((pattern) => pattern.hostname === 'example.com'), false);
    assert.equal(config.csp.includes('example.com'), false);
  }
});
