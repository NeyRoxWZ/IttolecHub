import BudgetGuesser from '@/games/BudgetGuesser';

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <BudgetGuesser roomCode={code} />;
}
