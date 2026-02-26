import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const roomCode = body?.roomCode;
    if (!roomCode) {
      return NextResponse.json({ error: 'Code de room requis', shouldDelete: false }, { status: 400 });
    }
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id, code, created_at, host_id')
      .eq('code', roomCode)
      .maybeSingle();
    
    if (roomError || !room) {
      return NextResponse.json({ error: 'Room non trouvée', shouldDelete: false });
    }

    // Vérifier le nombre de joueurs dans la room
    const { data: players, error: playersError } = await supabase
      .from('room_players')
      .select('id')
      .eq('room_id', room.id);
    
    if (playersError) {
      return NextResponse.json({ error: 'Erreur lors de la vérification des joueurs', shouldDelete: false });
    }

    // Si la room a des joueurs, ne pas la supprimer
    if (players && players.length > 0) {
      return NextResponse.json({ 
        message: 'Room non vide', 
        playerCount: players.length,
        shouldDelete: false 
      });
    }

    // Vérifier l'âge de la room (plus de 1 minute)
    const roomAge = Date.now() - new Date(room.created_at).getTime();
    const oneMinuteInMs = 60 * 1000;
    
    if (roomAge < oneMinuteInMs) {
      return NextResponse.json({ 
        message: 'Room trop récente', 
        ageInSeconds: Math.floor(roomAge / 1000),
        shouldDelete: false 
      });
    }

    // Supprimer la room et ses données associées
    const { error: deleteError } = await supabase
      .from('rooms')
      .delete()
      .eq('id', room.id);
    
    if (deleteError) {
      return NextResponse.json({ error: 'Erreur lors de la suppression', shouldDelete: false });
    }

    return NextResponse.json({ 
      message: 'Room supprimée avec succès',
      roomCode,
      shouldDelete: true
    });
    
  } catch (error) {
    console.error('Erreur lors de la suppression automatique:', error);
    return NextResponse.json({ error: 'Erreur interne du serveur', shouldDelete: false });
  }
}