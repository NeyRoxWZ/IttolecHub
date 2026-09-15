import JaugeGuessr from '@/games/JaugeGuessr';
import HostAwayPlayers from '@/components/HostAwayPlayers';

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <>
      <JaugeGuessr params={{ code }} />
      <HostAwayPlayers roomCode={code} />
    </>
  );
}
