const N8N_WEBHOOK = 'https://dev.flujobox.com/webhook/lead-capture';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/lead' && request.method === 'POST') {
      return handleLead(request, env, ctx);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleLead(request, env, ctx) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const name = typeof payload.name === 'string' ? payload.name.trim().slice(0, 200) : '';
  const email = typeof payload.email === 'string' ? payload.email.trim().slice(0, 200) : '';

  if (!name) return json({ ok: false, error: 'missing_name' }, 400);
  if (!email || !EMAIL_RE.test(email)) return json({ ok: false, error: 'invalid_email' }, 400);

  const ip = request.headers.get('CF-Connecting-IP') || '';
  const userAgent = request.headers.get('User-Agent') || '';
  const source = 'flujobox.com';

  try {
    await env.LEADS_DB.prepare(
      'INSERT INTO leads (name, email, ip, user_agent, source) VALUES (?, ?, ?, ?, ?)'
    ).bind(name, email, ip, userAgent, source).run();
  } catch (err) {
    return json({ ok: false, error: 'storage' }, 500);
  }

  ctx.waitUntil(
    fetch(N8N_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, ip, userAgent, source }),
    }).catch(() => {})
  );

  return json({ ok: true });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
