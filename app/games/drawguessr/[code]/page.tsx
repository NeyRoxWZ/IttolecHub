import DrawGuesser from '@/games/DrawGuesser';
import HostAwayPlayers from '@/components/HostAwayPlayers';

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <>
      <DrawGuesser roomCode={code} />
      <HostAwayPlayers roomCode={code} />
    </>
  );
}
