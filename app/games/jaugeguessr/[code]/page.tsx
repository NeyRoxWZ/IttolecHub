import JaugeGuessr from '@/games/JaugeGuessr';

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <JaugeGuessr params={{ code }} />;
}
