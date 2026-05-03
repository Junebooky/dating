import {
  getSupabaseAdmin,
  isProfile,
  PROFILE_LABELS,
  readJsonBody,
  requireAccount,
  sendJson,
  sendPushToProfiles,
} from '../_push.js';

const DEFAULT_TARGETS = ['boyfriend', 'girlfriend'];

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendJson(response, 405, { error: 'Method not allowed' });
  }

  try {
    const supabase = getSupabaseAdmin(request);
    const account = await requireAccount(request, supabase);
    const body = await readJsonBody(request);
    const targetProfiles = Array.isArray(body.targetProfiles)
      ? body.targetProfiles.filter(isProfile)
      : DEFAULT_TARGETS.filter((profile) => profile !== account.profile);
    const title = String(body.title || 'Dear Days 알림').slice(0, 80);
    const messageBody = String(
      body.body || `${PROFILE_LABELS[account.profile]}님이 앱을 업데이트했어요.`,
    ).slice(0, 160);
    const type = String(body.type || 'update').slice(0, 40);
    const url = String(body.url || '/').slice(0, 240);
    const tag = String(body.tag || `${type}-${Date.now()}`).slice(0, 80);

    if (targetProfiles.length === 0) {
      return sendJson(response, 200, { ok: true, skipped: true, reason: 'No targets.' });
    }

    const { error: notificationError } = await supabase.from('notifications').insert({
      actor_profile: account.profile,
      body: messageBody,
      target_profiles: targetProfiles,
      title,
      type,
      url,
    });
    if (notificationError) {
      console.warn('Notification audit insert failed', notificationError);
    }

    const delivery = await sendPushToProfiles({
      body: messageBody,
      excludeProfile: account.profile,
      supabase,
      tag,
      targetProfiles,
      title,
      type,
      url,
    });

    return sendJson(response, 200, { ok: true, delivery });
  } catch (error) {
    console.error('Push notify failed', error);
    return sendJson(response, error.statusCode || 500, {
      error: error.message || 'Push notify failed.',
    });
  }
}
