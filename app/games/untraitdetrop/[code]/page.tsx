import UnTraitDeTrop from '@/games/UnTraitDeTrop';
import HostAwayPlayers from '@/components/HostAwayPlayers';

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <>
      <UnTraitDeTrop params={{ code }} />
      <HostAwayPlayers roomCode={code} />
    </>
  );
}
