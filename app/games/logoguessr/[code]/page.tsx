import LogoGuessr from '@/games/LogoGuessr';
import HostAwayPlayers from '@/components/HostAwayPlayers';

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <>
      <LogoGuessr roomCode={code} />
      <HostAwayPlayers roomCode={code} />
    </>
  );
}
