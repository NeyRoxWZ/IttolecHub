import WikiGuesser from '@/games/WikiGuesser';

export default function Page({ params }: { params: { code: string } }) {
  return <WikiGuesser roomCode={params.code} />;
}
