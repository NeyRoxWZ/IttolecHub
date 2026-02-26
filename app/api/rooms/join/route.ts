import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { playerName, roomCode } = body;
    
    if (!playerName || !roomCode) {
      return NextResponse.json(
        { error: 'Le nom du joueur et le code de la room sont requis' },
        { status: 400 }
      );
    }

    // 1. Vérifier si la room existe
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', roomCode.toUpperCase())
      .maybeSingle();

    if (roomError || !room) {
      return NextResponse.json(
        { error: 'Room non trouvée' },
        { status: 404 }
      );
    }

    // 2. Vérifier si le joueur existe déjà (pour éviter les doublons)
    const { data: existingPlayer } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', room.id)
        .eq('name', playerName)
        .maybeSingle();

    if (!existingPlayer) {
        // 3. Ajouter le joueur à la room (Si n'existe pas encore)
        // Note: La logique "is_host" complète est gérée côté client/page pour l'instant,
        // ici on assure juste que le joueur est inscrit.
        const { error: joinError } = await supabase
        .from('players')
        .insert({ 
            room_id: room.id, 
            name: playerName,
            is_host: false, // Sera mis à jour par le client si nécessaire
            score: 0
        });

        if (joinError) {
            // Ignorer erreur de contrainte unique (race condition)
            if (joinError.code !== '23505') {
                console.error('Erreur ajout joueur:', joinError);
                return NextResponse.json({ error: 'Erreur lors de l\'ajout du joueur' }, { status: 500 });
            }
        }
    }

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
