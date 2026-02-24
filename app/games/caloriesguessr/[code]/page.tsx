import CaloriesGuessr from '@/games/CaloriesGuessr';

export default function CaloriesGuessrPage({ 
  params, 
  searchParams 
}: { 
  params: { code: string },
  searchParams: { [key: string]: string }
}) {
  return <CaloriesGuessr roomCode={params.code} settings={searchParams} />;
}