import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';

function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function POST(request: NextRequest) {
  try {
    const { playerName } = await request.json();
    
    if (!playerName || playerName.trim().length === 0) {
      return NextResponse.json(
        { error: 'Le nom du joueur est requis' },
        { status: 400 }
      );
    }

    const code = generateRoomCode();
    
    const { data, error } = await supabase
      .from('rooms')
      .insert([
        {
          code,
          host_id: playerName.trim(),
          status: 'waiting',
          settings: {
            maxPlayers: 10,
            createdBy: playerName.trim(),
          },
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Erreur création room:', error);
      return NextResponse.json(
        { error: 'Erreur lors de la création de la room' },
        { status: 500 }
      );
    }

    return NextResponse.json({ code: data.code });
    
  } catch (error) {
    console.error('Erreur serveur:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}