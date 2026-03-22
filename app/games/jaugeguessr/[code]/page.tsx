import JaugeGuessr from '@/games/JaugeGuessr';

export default function Page({ params }: { params: { code: string } }) {
  return <JaugeGuessr params={params} />;
}
