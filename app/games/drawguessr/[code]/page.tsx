import DrawGuesser from '@/games/DrawGuesser';

export default function Page({ params }: { params: { code: string } }) {
  return <DrawGuesser roomCode={params.code} />;
}
