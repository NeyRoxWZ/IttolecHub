import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import { ensureMissions } from '@/lib/casino/metaProgression.server';
import { dayKey } from '@/lib/casino/missions';
import { advancePass } from '@/lib/casino/pass.server';
import { levelFromXp, levelUpReward } from '@/lib/casino/progression';
import { PASS_XP } from '@/lib/casino/pass';

function serialise(rows: Awaited<ReturnType<typeof ensureMissions>>) {
  return rows.map((r) => ({
    slot: r.slot,
    id: r.mission_id,
    label: r.def.label,
    target: r.def.target,
    reward: r.def.reward,
    xp: r.def.xp,
    value: r.value,
    complete: r.complete,
    claimed: r.claimed,
  }));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });
    const rows = await ensureMissions(userId);
    return NextResponse.json({ missions: serialise(rows), day: dayKey() });
  } catch (err) {
    console.error('Erreur GET missions:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}

/** Claim a finished mission. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId: string = body?.user_id;
    const slot: number = body?.slot;
    if (!userId || typeof slot !== 'number') return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });

    const rows = await ensureMissions(userId);
    const row = rows.find((r) => r.slot === slot);
    if (!row) return NextResponse.json({ error: 'Mission introuvable' }, { status: 404 });
    if (row.claimed) return NextResponse.json({ error: 'Déjà réclamée' }, { status: 400 });
    if (!row.complete) return NextResponse.json({ error: 'Mission non terminée' }, { status: 400 });

    // Flip the flag first: the filter makes a double-claim a no-op.
    const { data: locked } = await supabase
      .from('casino_missions')
      .update({ claimed: true })
      .eq('user_id', userId).eq('day_key', dayKey()).eq('slot', slot).eq('claimed', false)
      .select().maybeSingle();
    if (!locked) return NextResponse.json({ error: 'Déjà réclamée' }, { status: 400 });

    const { data: wallet } = await supabase.from('casino_wallets').select('*').eq('user_id', userId).maybeSingle();
    if (!wallet) return NextResponse.json({ error: 'Portefeuille introuvable' }, { status: 404 });

    // Mission XP can cross a level just like a bet does, so the crate has to
    // pay out here too — otherwise the level silently went up for nothing.
    const before = levelFromXp(Number(wallet.xp || 0));
    const newXp = Number(wallet.xp || 0) + row.def.xp;
    const after = levelFromXp(newXp);

    let levelReward = 0;
    for (let l = before.level; l < after.level; l++) levelReward += levelUpReward(l);

    const newBalance = wallet.balance + row.def.reward + levelReward;
    await supabase.from('casino_wallets')
      .update({
        balance: newBalance,
        xp: newXp,
        level: after.level,
        missions_done: Number(wallet.missions_done || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    await supabase.from('casino_transactions').insert({
      user_id: userId, game_slug: 'casino', type: 'bonus',
      amount: row.def.reward, balance_after: newBalance,
      meta: { kind: 'mission', mission: row.mission_id },
    });

    const pass = await advancePass(userId, PASS_XP.mission, 'activity');

    return NextResponse.json({
      reward: row.def.reward,
      xp: row.def.xp,
      newBalance,
      pass,
      levelsGained: Math.max(0, after.level - before.level),
      level: after.level,
      levelReward,
    });
  } catch (err) {
    console.error('Erreur claim mission:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
