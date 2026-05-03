import { getSupabaseAdmin, readJsonBody, requireAccount, sendJson } from '../_push.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendJson(response, 405, { error: 'Method not allowed' });
  }

  try {
    const supabase = getSupabaseAdmin(request);
    const account = await requireAccount(request, supabase);
    const body = await readJsonBody(request);
    const subscription = body.subscription;

    if (
      !subscription?.endpoint ||
      !subscription?.keys?.p256dh ||
      !subscription?.keys?.auth
    ) {
      return sendJson(response, 400, { error: 'Invalid push subscription.' });
    }

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        auth: subscription.keys.auth,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        profile: account.profile,
        user_agent: request.headers['user-agent'] ?? null,
        username: account.username,
      },
      { onConflict: 'endpoint' },
    );

    if (error) {
      throw error;
    }

    return sendJson(response, 200, { ok: true, profile: account.profile });
  } catch (error) {
    console.error('Push subscribe failed', error);
    return sendJson(response, error.statusCode || 500, {
      error: error.message || 'Push subscribe failed.',
    });
  }
}
