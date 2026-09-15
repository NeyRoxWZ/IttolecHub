import RentGuessr from '@/games/RentGuessr';
import HostAwayPlayers from '@/components/HostAwayPlayers';

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <>
      <RentGuessr roomCode={code} />
      <HostAwayPlayers roomCode={code} />
    </>
  );
}
