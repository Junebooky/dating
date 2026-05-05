import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const ACCOUNT_BY_EMAIL = {
  'taejun0214@couple.local': {
    email: 'taejun0214@couple.local',
    profile: 'boyfriend',
    username: 'taejun0214',
  },
  'yeongjoo0214@couple.local': {
    email: 'yeongjoo0214@couple.local',
    profile: 'girlfriend',
    username: 'yeongju0214',
  },
  'yeongju0214@couple.local': {
    email: 'yeongju0214@couple.local',
    profile: 'girlfriend',
    username: 'yeongju0214',
  },
};

export const PROFILE_LABELS = {
  boyfriend: '태준씌',
  girlfriend: '영주씌',
};

export function isProfile(value) {
  return value === 'boyfriend' || value === 'girlfriend';
}

export function sendJson(response, statusCode, payload) {
  response.status(statusCode).setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
}

export async function readJsonBody(request) {
  if (request.body && typeof request.body === 'object') {
    return request.body;
  }

  if (typeof request.body === 'string') {
    return JSON.parse(request.body || '{}');
  }

  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

export function getSupabaseAdmin(request) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || (!serviceRoleKey && (!request || !anonKey))) {
    throw new Error('Missing Supabase server environment variables.');
  }

  const authorization = request?.headers?.authorization;

  return createClient(supabaseUrl, serviceRoleKey || anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global:
      !serviceRoleKey && authorization
        ? {
            headers: {
              Authorization: authorization,
            },
          }
        : undefined,
  });
}

export async function requireAccount(request, supabase) {
  const authorization = request.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : '';

  if (!token) {
    const error = new Error('Missing bearer token.');
    error.statusCode = 401;
    throw error;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.email) {
    const authError = new Error('Invalid bearer token.');
    authError.statusCode = 401;
    throw authError;
  }

  const account = ACCOUNT_BY_EMAIL[data.user.email.toLowerCase()];
  if (!account) {
    const permissionError = new Error('This account cannot use notifications.');
    permissionError.statusCode = 403;
    throw permissionError;
  }

  return account;
}

export function configureWebPush() {
  const publicKey = process.env.VITE_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:dear-days@example.com';

  if (!publicKey || !privateKey) {
    throw new Error('Missing VAPID environment variables.');
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
}

function toPushSubscription(row) {
  return {
    endpoint: row.endpoint,
    keys: {
      auth: row.auth,
      p256dh: row.p256dh,
    },
  };
}

export async function sendPushToProfiles({
  body,
  excludeProfile,
  supabase,
  tag,
  targetProfiles,
  title,
  type,
  url = '/',
}) {
  configureWebPush();

  let query = supabase.from('push_subscriptions').select('*');

  if (Array.isArray(targetProfiles) && targetProfiles.length > 0) {
    query = query.in('profile', targetProfiles);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const subscriptions = (data ?? []).filter((subscription) =>
    excludeProfile ? subscription.profile !== excludeProfile : true,
  );
  const payload = JSON.stringify({
    body,
    tag,
    title,
    type,
    url,
  });

  let sent = 0;
  const expiredEndpoints = [];

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(toPushSubscription(subscription), payload);
        sent += 1;
      } catch (sendError) {
        if (sendError.statusCode === 404 || sendError.statusCode === 410) {
          expiredEndpoints.push(subscription.endpoint);
        } else {
          console.error('Push send failed', sendError);
        }
      }
    }),
  );

  if (expiredEndpoints.length > 0) {
    await supabase.from('push_subscriptions').delete().in('endpoint', expiredEndpoints);
  }

  return {
    attempted: subscriptions.length,
    expired: expiredEndpoints.length,
    sent,
  };
}
