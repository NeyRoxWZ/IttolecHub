import WikiRacing from '@/games/WikiRacing';
import HostAwayPlayers from '@/components/HostAwayPlayers';

export default async function WikiRacingPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <>
      <WikiRacing params={{ code }} />
      <HostAwayPlayers roomCode={code} />
    </>
  );
}
