import PokeGuessr from '@/games/PokeGuessr';

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <PokeGuessr roomCode={code} />;
}
