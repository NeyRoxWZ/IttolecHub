import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import { PRESTIGE_THRESHOLD, CASINO_STARTING_BALANCE } from '@/lib/casino/meta';
import { checkAchievements } from '@/lib/casino/metaProgression.server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId: string = body?.user_id;
    if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });

    const { data: wallet } = await supabase.from('casino_wallets').select('*').eq('user_id', userId).maybeSingle();
    if (!wallet) return NextResponse.json({ error: 'Portefeuille introuvable' }, { status: 404 });

    if (wallet.balance < PRESTIGE_THRESHOLD) {
      return NextResponse.json({ error: `Il faut ${PRESTIGE_THRESHOLD.toLocaleString('fr-FR')} ₶ pour prestiger.` }, { status: 400 });
    }

    const newPrestigeCount = Number(wallet.prestige_count || 0) + 1;
    const { error } = await supabase.from('casino_wallets')
      .update({ balance: CASINO_STARTING_BALANCE, prestige_count: newPrestigeCount, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('balance', wallet.balance);
    if (error) return NextResponse.json({ error: 'Conflit, réessaie.' }, { status: 409 });

    await supabase.from('casino_transactions').insert({
      user_id: userId, game_slug: 'casino', type: 'prestige', amount: CASINO_STARTING_BALANCE - wallet.balance, balance_after: CASINO_STARTING_BALANCE, meta: { fromBalance: wallet.balance, prestigeCount: newPrestigeCount },
    });

    const newAchievements = await checkAchievements(userId, {
      balance: CASINO_STARTING_BALANCE,
      totalWagered: Number(wallet.total_wagered || 0),
      totalWon: Number(wallet.total_won || 0),
      currentStreak: Number(wallet.current_streak || 0),
      bestStreak: Number(wallet.best_streak || 0),
      prestigeCount: newPrestigeCount,
      biggestMultiplier: Number(wallet.biggest_multiplier || 0),
    });

    return NextResponse.json({ newBalance: CASINO_STARTING_BALANCE, prestigeCount: newPrestigeCount, newAchievements });
  } catch (err) {
    console.error('Erreur prestige:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
