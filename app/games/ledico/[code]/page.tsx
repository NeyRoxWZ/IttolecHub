import LeDico from '@/games/LeDico';
import HostAwayPlayers from '@/components/HostAwayPlayers';

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <>
      <LeDico params={{ code }} />
      <HostAwayPlayers roomCode={code} />
    </>
  );
}
