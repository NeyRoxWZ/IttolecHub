import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { playerName, roomCode } = await request.json();
    
    if (!playerName || !roomCode) {
      return NextResponse.json(
        { error: 'Le nom du joueur et le code de la room sont requis' },
        { status: 400 }
      );
    }

    // Vérifier si la room existe
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', roomCode.toUpperCase())
      .single();

    if (roomError || !room) {
      return NextResponse.json(
        { error: 'Room non trouvée' },
        { status: 404 }
      );
    }

    // Vérifier si la room n'est pas pleine
    // Note: Dans une implémentation réelle, vous devriez vérifier le nombre de joueurs connectés
    // via Supabase Presence

    return NextResponse.json({ 
      success: true,
      room: {
        code: room.code,
        host: room.host_id,
        status: room.status,
        gameType: room.game_type,
        settings: room.settings,
      }
    });
    
  } catch (error) {
    console.error('Erreur rejoindre room:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}