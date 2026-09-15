import Punchline from '@/games/Punchline';
import HostAwayPlayers from '@/components/HostAwayPlayers';

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <>
      <Punchline params={{ code }} />
      <HostAwayPlayers roomCode={code} />
    </>
  );
}
