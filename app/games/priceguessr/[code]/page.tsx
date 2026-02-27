import PriceGuessr from '@/games/PriceGuessr';

export default function PriceGuessrPage({ 
  params, 
  searchParams 
}: { 
  params: { code: string },
  searchParams: { [key: string]: string }
}) {
  return <PriceGuessr roomCode={params.code} settings={searchParams} />;
}
