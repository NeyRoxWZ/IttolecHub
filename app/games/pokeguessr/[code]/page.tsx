import PokeGuessr from '@/games/PokeGuessr';
import HostAwayPlayers from '@/components/HostAwayPlayers';

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <>
      <PokeGuessr roomCode={code} />
      <HostAwayPlayers roomCode={code} />
    </>
  );
}
