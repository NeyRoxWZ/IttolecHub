import webpush from 'web-push';
import { supabase } from '@/lib/supabase/server';
import { happyHourCountdown, isHappyHour } from './events';

/**
 * Push notifications for the installed app.
 *
 * The rule that matters here is restraint: a casino that buzzes you all day
 * gets its notifications switched off within a week, and then it has no way
 * to reach anyone at all. So there are few reasons to wake somebody — their
 * chest run is about to break, happy hour is starting, someone sent them
 * coins — each device can refuse any of them, and no device is pushed more
 * than once every six hours.
 *
 * A gift is the exception to that quiet window: money arriving is the one
 * notification nobody resents, and holding it back for six hours would make
 * it arrive long after the moment it belongs to.
 */

const QUIET_HOURS = 6;

let configured = false;

/** Returns false when the keys are missing, so callers can degrade quietly. */
function configure(): boolean {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:contact@ittolec.hub',
    publicKey,
    privateKey,
  );
  configured = true;
  return true;
}

export function pushConfigured(): boolean {
  return configure();
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

type Topic = 'chest' | 'happy_hour' | 'duels' | 'gifts';

/**
 * Sends to every device of one player that still wants this topic.
 *
 * A subscription the push service rejects with 404 or 410 is gone for good —
 * the app was uninstalled or the permission revoked — so it is deleted rather
 * than retried forever.
 */
export async function pushToUser(
  userId: string, topic: Topic, payload: PushPayload, { ignoreQuietHours = false } = {}
): Promise<number> {
  if (!configure()) return 0;

  let query = supabase.from('casino_push').select('*').eq('user_id', userId).eq(topic, true);
  if (!ignoreQuietHours) {
    const cutoff = new Date(Date.now() - QUIET_HOURS * 3600_000).toISOString();
    query = query.or(`last_sent_at.is.null,last_sent_at.lt.${cutoff}`);
  }
  const { data: subs } = await query;

  let sent = 0;
  for (const s of subs || []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
      );
      sent += 1;
      await supabase.from('casino_push')
        .update({ last_sent_at: new Date().toISOString() }).eq('endpoint', s.endpoint);
    } catch (err: any) {
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await supabase.from('casino_push').delete().eq('endpoint', s.endpoint);
      } else {
        console.error('Push échoué:', err?.statusCode ?? err);
      }
    }
  }
  return sent;
}

/* ------------------------------------------------------------------ */
/* The scheduled sweep                                                  */
/* ------------------------------------------------------------------ */

function isSameUtcDay(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear()
    && a.getUTCMonth() === b.getUTCMonth()
    && a.getUTCDate() === b.getUTCDate();
}

/**
 * One pass over everyone who might need waking.
 *
 * The Vercel Hobby plan allows exactly one cron run per day, so this fires
 * once at 19:00 UTC — late enough that a missed chest is a real risk, early
 * enough to still act on it before the UTC day turns over. Happy hour is
 * therefore only announced on the rare day the sweep lands in its final
 * quarter of an hour; a proper reminder for it needs a scheduler that can run
 * more often, which any free external cron hitting this endpoint would give.
 */
export async function pushSweep(): Promise<{ chest: number; happy: number }> {
  if (!configure()) return { chest: 0, happy: 0 };

  const now = new Date();
  let chest = 0;
  let happy = 0;

  // A chest run only breaks if today ends unopened, so the reminder is worth
  // sending only to people who have a run going and have not opened today.
  const { data: subs } = await supabase.from('casino_push').select('user_id');
  const users = Array.from(new Set((subs || []).map((s) => s.user_id)));

  if (users.length) {
    const { data: wallets } = await supabase.from('casino_wallets')
      .select('user_id, chest_day, chest_claimed_at').in('user_id', users);

    for (const w of wallets || []) {
      const day = Number(w.chest_day || 0);
      if (day < 1) continue;
      const last = w.chest_claimed_at ? new Date(w.chest_claimed_at) : null;
      if (last && isSameUtcDay(last, now)) continue;

      chest += await pushToUser(w.user_id, 'chest', {
        title: 'Ton coffre t’attend',
        body: `${day} jour${day > 1 ? 's' : ''} d’affilée. Une journée manquée et tu repars de la case 1.`,
        url: '/casino',
        tag: 'chest',
      });
    }
  }

  // Happy hour, only in the few minutes before it opens.
  const countdown = happyHourCountdown(now);
  if (!isHappyHour(now) && countdown.seconds <= 900) {
    for (const userId of users) {
      happy += await pushToUser(userId, 'happy_hour', {
        title: 'Heure chaude dans 15 min',
        body: 'Tes bénéfices seront majorés de 20 % sur tous les jeux.',
        url: '/casino',
        tag: 'happy',
      });
    }
  }

  return { chest, happy };
}

/** Fired the instant a gift lands, not on the daily sweep. */
export async function pushGift(toUserId: string, fromPseudo: string, what: string): Promise<number> {
  return pushToUser(
    toUserId,
    'gifts',
    {
      title: `${fromPseudo} t’a offert quelque chose`,
      body: what,
      url: '/casino/potes',
      tag: 'gift',
    },
    { ignoreQuietHours: true },
  );
}
