'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowLeft, ArrowRight, Bed, Building2, Euro, Home, Image as ImageIcon, Layers, Layout, Map as MapIcon, MapPin } from 'lucide-react';
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
    <div className="flex min-w-0 items-center gap-1.5 rounded-xl border-[3px] border-brand-border bg-brand-inner px-2 py-1">
      <Icon className="h-4 w-4 shrink-0 text-accent-success" />
      <span className="min-w-0">
        <span className="block text-[10px] font-black uppercase leading-none tracking-widest text-tx-secondary">{label}</span>
        <span className="block truncate font-display leading-tight">{value}</span>
      </span>
    </div>
  );
}

/** Photos (or the map) filling the space, the location on top, the key facts under it. */
function PropertyCard({ card }: { card: EstimateCard }) {
  const photos = (card.photos as string[]) || [];
  const [index, setIndex] = useState(0);
  const [view, setView] = useState<'photos' | 'map'>('photos');
  useEffect(() => {
    setIndex(0);
    setView('photos');
    photos.forEach((url) => { const i = new window.Image(); i.decoding = 'async'; i.src = url; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id]);
  const step = (d: number) => setIndex((i) => (i + d + photos.length) % photos.length);
  const hasMap = !!card.lat && !!card.lng;

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2">
      <MediaFrame className="min-h-0 flex-1">
        {view === 'map' && hasMap ? (
          <LeafletMap latitude={Number(card.lat)} longitude={Number(card.lng)} zoom={13} />
        ) : photos.length ? (
          <img src={photos[index]} alt={`Photo ${index + 1} du logement`} className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full items-center justify-center"><Home className="h-16 w-16 text-tx-muted" /></div>
        )}
        {view === 'photos' && photos.length > 1 && (
          <>
            <button onClick={() => step(-1)} className={cn(BRAWL.dark, 'absolute left-2 top-[calc(50%-22px)] z-[500] h-11 w-11 rounded-xl')} aria-label="Photo précédente"><ArrowLeft className="h-5 w-5" /></button>
            <button onClick={() => step(1)} className={cn(BRAWL.dark, 'absolute right-2 top-[calc(50%-22px)] z-[500] h-11 w-11 rounded-xl')} aria-label="Photo suivante"><ArrowRight className="h-5 w-5" /></button>
            <span className="absolute bottom-2 left-2 z-[500] rounded-lg border-[3px] border-brand-border bg-brand-bg/90 px-2 font-display text-sm tabular-nums">{index + 1}/{photos.length}</span>
          </>
        )}
        <span className="absolute left-2 top-2 z-[500] inline-flex max-w-[calc(100%-6.5rem)] items-center gap-1 rounded-lg border-[3px] border-brand-border bg-brand-bg/90 px-2 font-display text-sm">
          <MapPin className="h-4 w-4 shrink-0 text-accent-secondary" />
          <span className="truncate">{card.district ? `${card.district}, ` : ''}{String(card.city)} ({String(card.postal)})</span>
        </span>
        {hasMap && (
          <button onClick={() => setView((v) => (v === 'map' ? 'photos' : 'map'))} className={cn(BRAWL.blue, 'absolute right-2 top-2 z-[500] h-9 rounded-lg px-2 text-sm')}>
            {view === 'map' ? <><ImageIcon className="h-4 w-4" /> Photos</> : <><MapIcon className="h-4 w-4" /> Carte</>}
          </button>
        )}
      </MediaFrame>
      <div className="grid shrink-0 grid-cols-4 gap-1.5">
        <Fact icon={Layout} label="Surface" value={`${card.surface ?? '?'} m²`} />
        <Fact icon={Building2} label="Pièces" value={String(card.rooms ?? '?')} />
        <Fact icon={Bed} label="Chambres" value={String(card.bedrooms ?? '?')} />
        {card.floor !== null && card.floor !== undefined
          ? <Fact icon={Layers} label="Étage" value={Number(card.floor) === 0 ? 'RDC' : String(card.floor)} />
          : <Fact icon={Home} label="Type" value={String(card.type ?? '?')} />}
      </div>
    </div>
  );
}

const CONFIG: EstimateConfig = {
  gameType: 'rentguessr',
  title: 'RentGuessr',
  tagline: 'Combien coûte ce logement par mois ?',
  question: 'Quel est le loyer mensuel ?',
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
    'Un vrai logement à louer s’affiche : photos, carte, surface et pièces.',
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
