import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import { dailyShop, itemById, secondsUntilRotation, shopDayKey, type ShopItem } from '@/lib/casino/shop';
import { grantEffect, loadEffects } from '@/lib/casino/effects.server';
import { levelFromXp, levelUpReward, totalXpForLevel } from '@/lib/casino/progression';
import { rerollMissions, completeBestMission } from '@/lib/casino/metaProgression.server';
import { randomInt } from 'crypto';

/** Uniform float in [0,1) from the crypto RNG — outcomes are never client-side. */
function rand(): number {
  return randomInt(0, 1_000_000) / 1_000_000;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    const items = dailyShop();
    let owned: string[] = [];
    let effects: Record<string, unknown> = {};
    if (userId) {
      const { data: inv } = await supabase.from('casino_inventory').select('item_id').eq('user_id', userId);
      owned = (inv || []).map((r) => r.item_id);
      effects = await loadEffects(userId);
    }

    return NextResponse.json({
      day: shopDayKey(),
      resetIn: secondsUntilRotation(),
      items,
      owned,
      effects,
    });
  } catch (err) {
    console.error('Erreur GET shop:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId: string = body?.user_id;
    const itemId: string = body?.item_id;
    if (!userId || !itemId) return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });

    const item = itemById(itemId);
    if (!item) return NextResponse.json({ error: 'Objet inconnu' }, { status: 404 });
    if (!dailyShop().some((i) => i.id === itemId)) {
      return NextResponse.json({ error: "Cet objet n'est pas en boutique aujourd'hui." }, { status: 400 });
    }

    const { data: wallet } = await supabase.from('casino_wallets').select('*').eq('user_id', userId).maybeSingle();
    if (!wallet) return NextResponse.json({ error: 'Portefeuille introuvable' }, { status: 404 });
    if (wallet.balance < item.price) return NextResponse.json({ error: 'Solde insuffisant' }, { status: 400 });

    if (item.effect === 'cosmetic') {
      const { data: already } = await supabase.from('casino_inventory')
        .select('item_id').eq('user_id', userId).eq('item_id', itemId).maybeSingle();
      if (already) return NextResponse.json({ error: 'Tu possèdes déjà cet objet.' }, { status: 400 });
    }

    // Optimistic lock: a duplicate request can't buy the same item twice.
    const afterCost = wallet.balance - item.price;
    const { data: charged } = await supabase.from('casino_wallets')
      .update({ balance: afterCost, updated_at: new Date().toISOString() })
      .eq('user_id', userId).eq('balance', wallet.balance)
      .select().maybeSingle();
    if (!charged) return NextResponse.json({ error: 'Conflit, réessaye.' }, { status: 409 });

    const outcome = await applyItem(userId, item, charged);

    return NextResponse.json({
      ok: true,
      item: { id: item.id, name: item.name },
      newBalance: outcome.newBalance,
      message: outcome.message,
      detail: outcome.detail ?? null,
    });
  } catch (err) {
    console.error('Erreur achat shop:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}

interface ItemOutcome { newBalance: number; message: string; detail?: any }

async function applyItem(userId: string, item: ShopItem, wallet: any): Promise<ItemOutcome> {
  const balance: number = wallet.balance;

  switch (item.effect) {
    /* ---- consumables: stored and resolved during a bet ---- */
    case 'loss_refund':
    case 'streak_shield':
    case 'win_bonus':
    case 'jackpot_boost':
    case 'xp_multiplier':
    case 'max_bet_pct':
    case 'cashback_boost': {
      await grantEffect(userId, item.effect, item.magnitude ?? 1, {
        uses: item.uses,
        durationMin: item.durationMin,
      });
      return { newBalance: balance, message: `${item.name} activé.` };
    }

    /* ---- one-shots ---- */
    case 'grant_xp': {
      const gain = item.magnitude ?? 0;
      return creditXp(userId, wallet, gain, `+${gain} XP`);
    }

    case 'grant_level': {
      const current = levelFromXp(Number(wallet.xp || 0));
      const target = current.level + (item.magnitude ?? 1);
      const gain = totalXpForLevel(target) - Number(wallet.xp || 0);
      return creditXp(userId, wallet, gain, `Niveau ${target} atteint`);
    }

    case 'mystery_coins': {
      const payout = Math.round(item.price * (0.4 + rand() * 2.6));
      return credit(userId, balance, payout, 'mystery', `Le sac contenait ${payout} ₶`);
    }

    case 'interest': {
      const gain = Math.min(5000, Math.round(balance * (item.magnitude ?? 0.02)));
      return credit(userId, balance, gain, 'interest', `+${gain} ₶ d'intérêts`);
    }

    case 'grant_scratch': {
      // Each ticket: mostly small, occasionally a decent hit.
      const tickets: number[] = [];
      for (let i = 0; i < (item.magnitude ?? 1); i++) {
        const r = rand();
        tickets.push(r < 0.5 ? 0 : r < 0.85 ? 100 : r < 0.97 ? 400 : 2000);
      }
      const total = tickets.reduce((a, b) => a + b, 0);
      return credit(userId, balance, total, 'scratch', total > 0 ? `Tickets : ${total} ₶` : 'Aucun ticket gagnant…', tickets);
    }

    case 'mission_reroll': {
      const missions = await rerollMissions(userId);
      return { newBalance: balance, message: 'Nouvelles missions tirées.', detail: missions.map((m) => m.def.label) };
    }

    case 'mission_complete': {
      const done = await completeBestMission(userId);
      return {
        newBalance: balance,
        message: done ? `Mission terminée : ${done.def.label}` : 'Aucune mission à terminer.',
      };
    }

    case 'cosmetic': {
      await supabase.from('casino_inventory').insert({ user_id: userId, item_id: item.id, quantity: 1 });
      return { newBalance: balance, message: `${item.name} débloqué.` };
    }
  }

  return { newBalance: balance, message: `${item.name} acheté.` };
}

async function credit(userId: string, balance: number, amount: number, kind: string, message: string, detail?: any): Promise<ItemOutcome> {
  if (amount <= 0) return { newBalance: balance, message, detail };
  const newBalance = balance + amount;
  await supabase.from('casino_wallets').update({ balance: newBalance, updated_at: new Date().toISOString() }).eq('user_id', userId);
  await supabase.from('casino_transactions').insert({
    user_id: userId, game_slug: 'casino', type: 'bonus', amount, balance_after: newBalance, meta: { kind },
  });
  return { newBalance, message, detail };
}

/** XP grants can push through several level-ups, each paying its own crate. */
async function creditXp(userId: string, wallet: any, gain: number, message: string): Promise<ItemOutcome> {
  const before = levelFromXp(Number(wallet.xp || 0));
  const newXp = Number(wallet.xp || 0) + Math.max(0, gain);
  const after = levelFromXp(newXp);

  let reward = 0;
  for (let l = before.level; l < after.level; l++) reward += levelUpReward(l);
  const newBalance = wallet.balance + reward;

  await supabase.from('casino_wallets')
    .update({ xp: newXp, level: after.level, balance: newBalance, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  if (reward > 0) {
    await supabase.from('casino_transactions').insert({
      user_id: userId, game_slug: 'casino', type: 'bonus', amount: reward,
      balance_after: newBalance, meta: { kind: 'level_up', level: after.level },
    });
  }

  return {
    newBalance,
    message: reward > 0 ? `${message} — coffre de niveau : +${reward} ₶` : message,
    detail: { level: after.level, xp: newXp },
  };
}
