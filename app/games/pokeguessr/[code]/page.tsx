import PokeGuessr from '@/games/PokeGuessr';

export default function Page({ params }: { params: { code: string } }) {
  return <PokeGuessr roomCode={params.code} />;
}
