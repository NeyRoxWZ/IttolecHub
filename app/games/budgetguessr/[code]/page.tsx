import BudgetGuesser from '@/games/BudgetGuesser';

export default function Page({ params }: { params: { code: string } }) {
  return <BudgetGuesser roomCode={params.code} />;
}
