import QuiADitCa from '@/games/QuiADitCa';
import HostAwayPlayers from '@/components/HostAwayPlayers';

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <>
      <QuiADitCa params={{ code }} />
      <HostAwayPlayers roomCode={code} />
    </>
  );
}
