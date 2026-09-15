import PetitBac from '@/games/PetitBac';
import HostAwayPlayers from '@/components/HostAwayPlayers';

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <>
      <PetitBac params={{ code }} />
      <HostAwayPlayers roomCode={code} />
    </>
  );
}
