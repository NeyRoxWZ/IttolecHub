import HorsSujet from '@/games/HorsSujet';
import HostAwayPlayers from '@/components/HostAwayPlayers';

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <>
      <HorsSujet params={{ code }} />
      <HostAwayPlayers roomCode={code} />
    </>
  );
}
