import {
  getSupabaseAdmin,
  PROFILE_LABELS,
  sendJson,
  sendPushToProfiles,
} from '../_push.js';

function formatKstDate(offsetDays = 0) {
  const date = new Date(Date.now() + 9 * 60 * 60 * 1000 + offsetDays * 24 * 60 * 60 * 1000);

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(
    date.getUTCDate(),
  ).padStart(2, '0')}`;
}

function getParticipants(event) {
  if (Array.isArray(event.participant_profiles) && event.participant_profiles.length > 0) {
    return event.participant_profiles.filter((profile) =>
      profile === 'boyfriend' || profile === 'girlfriend',
    );
  }

  return event.author_profile === 'boyfriend' || event.author_profile === 'girlfriend'
    ? [event.author_profile]
    : ['boyfriend', 'girlfriend'];
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return sendJson(response, 405, { error: 'Method not allowed' });
  }

  if (
    process.env.CRON_SECRET &&
    request.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return sendJson(response, 401, { error: 'Unauthorized' });
  }

  try {
    const supabase = getSupabaseAdmin();
    const today = formatKstDate();
    const tomorrow = formatKstDate(1);
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .lte('date', tomorrow)
      .gte('end_date', today)
      .order('date')
      .order('time');

    if (error) {
      throw error;
    }

    const deliveries = [];

    for (const event of data ?? []) {
      const participants = getParticipants(event);
      const dayLabel = event.date <= today && event.end_date >= today ? '오늘' : '내일';
      const targetText = participants.map((profile) => PROFILE_LABELS[profile]).join(', ');
      const delivery = await sendPushToProfiles({
        body: `${targetText} 일정 · ${event.time} ${event.title}`,
        supabase,
        tag: `upcoming-${event.id}-${today}`,
        targetProfiles: participants,
        title: `${dayLabel} 다가오는 일정`,
        type: 'upcoming-calendar',
        url: '/',
      });

      deliveries.push({ eventId: event.id, ...delivery });
    }

    return sendJson(response, 200, { checked: data?.length ?? 0, deliveries, ok: true });
  } catch (error) {
    console.error('Upcoming cron failed', error);
    return sendJson(response, 500, { error: error.message || 'Upcoming cron failed.' });
  }
}
