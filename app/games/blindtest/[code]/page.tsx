import BlindTest from '@/games/BlindTest';
import HostAwayPlayers from '@/components/HostAwayPlayers';

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <>
      <BlindTest params={{ code }} />
      <HostAwayPlayers roomCode={code} />
    </>
  );
}
