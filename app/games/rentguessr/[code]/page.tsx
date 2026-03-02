import RentGuessr from '@/games/RentGuessr';

export default function Page({ params }: { params: { code: string } }) {
  return <RentGuessr roomCode={params.code} />;
}