'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowLeft, ArrowRight, Bed, Building2, Euro, Home, Layers, Layout, MapPin } from 'lucide-react';
import { BRAWL } from '@/lib/ui/brawl';
import { cn } from '@/lib/utils';
import EstimateGame, { type EstimateCard, type EstimateConfig } from './party/EstimateGame';
import { MediaFrame } from './party/ui';

const LeafletMap = dynamic(() => import('@/components/LeafletMap'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-brand-inner" />,
});

const euros = (v: number) => `${new Intl.NumberFormat('fr-FR').format(Math.round(v))} €`;

async function loadDeck(_settings: Record<string, any>, rounds: number): Promise<EstimateCard[]> {
  const res = await fetch(`/api/games/rent?count=${rounds}`);
  if (!res.ok) return [];
  const list: any[] = await res.json();
  return list
    .filter((p) => Number(p.price_per_month) > 0)
    .map((p) => ({
      id: p.id,
      value: Number(p.price_per_month),
      photos: Array.isArray(p.photos_url) && p.photos_url.length ? p.photos_url : p.photo_url ? [p.photo_url] : [],
      city: p.city, district: p.district, postal: p.postal_code,
      surface: p.surface_m2, rooms: p.nb_rooms, bedrooms: p.nb_bedrooms, floor: p.floor, type: p.property_type,
      lat: p.latitude, lng: p.longitude,
    }));
}

function Fact({ icon: Icon, label, value }: { icon: typeof Home; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-[3px] border-brand-border bg-brand-inner p-2 text-center">
      <Icon className="mb-1 h-5 w-5 text-accent-success" />
      <span className="text-[11px] font-black uppercase tracking-widest text-tx-secondary">{label}</span>
      <span className="w-full truncate font-display text-lg">{value}</span>
    </div>
  );
}

function PropertyCard({ card }: { card: EstimateCard }) {
  const photos = (card.photos as string[]) || [];
  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex(0);
    // Every photo starts downloading with the round: flipping through them is instant.
    photos.forEach((url) => { const i = new window.Image(); i.decoding = 'async'; i.src = url; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id]);
  const step = (d: number) => setIndex((i) => (i + d + photos.length) % photos.length);
  const arrow = cn(BRAWL.dark, 'absolute top-[calc(50%-24px)] z-10 h-12 w-12 rounded-xl');

  return (
    <div className="grid w-full gap-3 lg:grid-cols-[1.3fr_1fr]">
      <div className="space-y-3">
        <MediaFrame className="aspect-video">
          {photos.length ? (
            <img src={photos[index]} alt={`Photo ${index + 1} du logement`} className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full items-center justify-center"><Home className="h-16 w-16 text-tx-muted" /></div>
          )}
          {photos.length > 1 && (
            <>
              <button onClick={() => step(-1)} className={cn(arrow, 'left-2')} aria-label="Photo précédente"><ArrowLeft className="h-6 w-6" /></button>
              <button onClick={() => step(1)} className={cn(arrow, 'right-2')} aria-label="Photo suivante"><ArrowRight className="h-6 w-6" /></button>
              <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-lg border-[3px] border-brand-border bg-brand-bg/90 px-2 py-0.5 font-display text-sm tabular-nums">{index + 1} / {photos.length}</span>
            </>
          )}
          <span className="absolute left-2 top-2 inline-flex max-w-[calc(100%-1rem)] items-center gap-1 truncate rounded-lg border-[3px] border-brand-border bg-brand-bg/90 px-2 py-0.5 font-display text-sm">
            <MapPin className="h-4 w-4 shrink-0 text-accent-secondary" />
            {card.district ? `${card.district}, ` : ''}{String(card.city)} ({String(card.postal)})
          </span>
        </MediaFrame>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Fact icon={Layout} label="Surface" value={`${card.surface ?? '?'} m²`} />
          <Fact icon={Building2} label="Pièces" value={String(card.rooms ?? '?')} />
          <Fact icon={Bed} label="Chambres" value={String(card.bedrooms ?? '?')} />
          {card.floor !== null && card.floor !== undefined
            ? <Fact icon={Layers} label="Étage" value={Number(card.floor) === 0 ? 'RDC' : String(card.floor)} />
            : <Fact icon={Home} label="Type" value={String(card.type ?? '?')} />}
        </div>
      </div>
      {card.lat && card.lng ? (
        <MediaFrame className="h-56 lg:h-auto lg:min-h-[260px]">
          <LeafletMap latitude={Number(card.lat)} longitude={Number(card.lng)} zoom={13} />
        </MediaFrame>
      ) : null}
    </div>
  );
}

const CONFIG: EstimateConfig = {
  gameType: 'rentguessr',
  title: 'RentGuessr',
  tagline: 'Combien coûte ce logement par mois ?',
  icon: Home,
  swatch: { fill: '#8B3DFF', shade: '#6526C9' },
  defaultTime: 30,
  defaultRounds: 5,
  flavor: 'Les agents immobiliers de la soirée.',
  placeholder: 'Loyer par mois',
  prefix: <Euro className="h-5 w-5" />,
  unitOf: (typed) => typed,
  format: euros,
  rules: [
    'Un vrai logement à louer s’affiche : photos, surface, pièces et carte.',
    'Estime son loyer mensuel. Tu peux changer d’avis jusqu’à la fin.',
    'Moins de 5 % d’écart : 1000 points, puis 700, 400 et 200.',
    '200 points de bonus si tu réponds dans les 10 premières secondes.',
  ],
  loadDeck,
  renderCard: (card) => <PropertyCard card={card} />,
};

export default function RentGuessr({ roomCode }: { roomCode: string }) {
  return <EstimateGame roomCode={roomCode} config={CONFIG} />;
}
