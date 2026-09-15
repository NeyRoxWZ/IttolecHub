import Surenchere from '@/games/Surenchere';
import HostAwayPlayers from '@/components/HostAwayPlayers';

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <>
      <Surenchere params={{ code }} />
      <HostAwayPlayers roomCode={code} />
    </>
  );
}
