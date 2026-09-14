import DrawGuesser from '@/games/DrawGuesser';

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <DrawGuesser roomCode={code} />;
}
