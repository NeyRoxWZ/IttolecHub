import { supabase } from '@/lib/supabase/server';
import { runInBackground } from '@/lib/background.server';

export interface ActiveEffect {
  effect: string;
  magnitude: number;
  uses_left: number | null;
  expires_at: string | null;
}

export type EffectMap = Record<string, ActiveEffect>;

/** Load the player's active effects, dropping anything already expired. */
export async function loadEffects(userId: string): Promise<EffectMap> {
  const { data } = await supabase.from('casino_effects').select('*').eq('user_id', userId);
  const map: EffectMap = {};
  const now = Date.now();
  const expired: string[] = [];

  for (const row of data || []) {
    const e = row as ActiveEffect;
    if (e.expires_at && new Date(e.expires_at).getTime() <= now) { expired.push(e.effect); continue; }
    if (e.uses_left !== null && e.uses_left <= 0) { expired.push(e.effect); continue; }
    map[e.effect] = { ...e, magnitude: Number(e.magnitude) };
  }

  // Already left out of the map above, so the cleanup needn't hold up the bet.
  if (expired.length) {
    runInBackground(supabase.from('casino_effects').delete().eq('user_id', userId).in('effect', expired));
  }
  return map;
}

/**
 * Burn one use of each effect that actually fired this bet. Time-based
 * effects have no `uses_left` and simply keep running until they expire.
 */
export async function consumeEffects(userId: string, effects: EffectMap, used: string[]) {
  // One row per effect: burned together.
  await Promise.all(used.map((name) => {
    const e = effects[name];
    if (!e || e.uses_left === null) return null;
    const left = e.uses_left - 1;
    return left <= 0
      ? supabase.from('casino_effects').delete().eq('user_id', userId).eq('effect', name)
      : supabase.from('casino_effects').update({ uses_left: left }).eq('user_id', userId).eq('effect', name);
  }));
}

export async function grantEffect(
  userId: string,
  effect: string,
  magnitude: number,
  opts: { uses?: number; durationMin?: number }
) {
  const { data: existing } = await supabase
    .from('casino_effects').select('*').eq('user_id', userId).eq('effect', effect).maybeSingle();

  const expires_at = opts.durationMin
    ? new Date(Date.now() + opts.durationMin * 60_000).toISOString()
    : null;

  // Re-buying stacks uses / extends time rather than silently overwriting.
  if (existing) {
    const uses = opts.uses !== undefined
      ? (existing.uses_left ?? 0) + opts.uses
      : existing.uses_left;
    const bestExpiry = expires_at && existing.expires_at
      ? new Date(Math.max(new Date(expires_at).getTime(), new Date(existing.expires_at).getTime())).toISOString()
      : expires_at ?? existing.expires_at;

    await supabase.from('casino_effects').update({
      magnitude: Math.max(Number(existing.magnitude), magnitude),
      uses_left: uses,
      expires_at: bestExpiry,
    }).eq('user_id', userId).eq('effect', effect);
    return;
  }

  await supabase.from('casino_effects').insert({
    user_id: userId, effect, magnitude, uses_left: opts.uses ?? null, expires_at,
  });
}
