import WikiRacing from '@/games/WikiRacing';

export default function WikiRacingPage({ params }: { params: { code: string } }) {
  return <WikiRacing params={params} />;
}