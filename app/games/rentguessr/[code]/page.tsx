import RentGuessr from '@/games/RentGuessr';

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <RentGuessr roomCode={code} />;
}