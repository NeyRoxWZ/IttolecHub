import BudgetGuesser from '@/games/BudgetGuesser';
import HostAwayPlayers from '@/components/HostAwayPlayers';

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <>
      <BudgetGuesser roomCode={code} />
      <HostAwayPlayers roomCode={code} />
    </>
  );
}
