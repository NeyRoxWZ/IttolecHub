import AirbnbGuessr from '@/games/AirbnbGuessr';

export default function Page({ params }: { params: { code: string } }) {
  return <AirbnbGuessr roomCode={params.code} />;
}