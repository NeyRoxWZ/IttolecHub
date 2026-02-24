import RhymeGuessr from '@/games/RhymeGuessr';

export default function RhymeGuessrPage({ 
  params, 
  searchParams 
}: { 
  params: { code: string },
  searchParams: { [key: string]: string }
}) {
  return <RhymeGuessr roomCode={params.code} settings={searchParams} />;
}