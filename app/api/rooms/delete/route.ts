import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const roomCode = body?.roomCode;
    const hostId = body?.hostId;
    
    if (!roomCode || !hostId) {
      return NextResponse.json({ error: 'Code de room et ID de l\'hôte requis' }, { status: 400 });
    }
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('host_id')
      .eq('code', roomCode)
      .maybeSingle();

    if (roomError || !room) {
      return NextResponse.json(
        { error: 'Room non trouvée' },
        { status: 404 }
      );
    }

    if (room.host_id !== hostId) {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 403 }
      );
    }

    // Supprimer la room
    const { error: deleteError } = await supabase
      .from('rooms')
      .delete()
      .eq('code', roomCode);

    if (deleteError) {
      return NextResponse.json(
        { error: 'Erreur lors de la suppression de la room' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Erreur serveur:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}