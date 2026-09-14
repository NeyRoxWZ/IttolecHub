import WikiRacing from '@/games/WikiRacing';

export default async function WikiRacingPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <WikiRacing params={{ code }} />;
}