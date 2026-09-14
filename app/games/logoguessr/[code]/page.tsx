import LogoGuessr from '@/games/LogoGuessr';

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <LogoGuessr roomCode={code} />;
}