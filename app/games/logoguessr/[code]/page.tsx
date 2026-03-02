import LogoGuessr from '@/games/LogoGuessr';

export default function Page({ params }: { params: { code: string } }) {
  return <LogoGuessr roomCode={params.code} />;
}