import type { Metadata } from 'next';
import {
  Archivo, Barlow, Barlow_Condensed, Bowlby_One_SC, IBM_Plex_Sans, JetBrains_Mono, Lilita_One, Nunito, Oxanium,
} from 'next/font/google';
import './da.css';

export const metadata: Metadata = {
  title: 'Directions artistiques · ItollecHub',
  robots: { index: false, follow: false },
};

const barlowCondensed = Barlow_Condensed({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--f-barlow-c' });
const barlow = Barlow({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--f-barlow' });
const lilita = Lilita_One({ subsets: ['latin'], weight: '400', variable: '--f-lilita' });
const nunito = Nunito({ subsets: ['latin'], weight: ['600', '700', '800', '900'], variable: '--f-nunito' });
const oxanium = Oxanium({ subsets: ['latin'], weight: ['500', '600', '700', '800'], variable: '--f-oxanium' });
const plex = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--f-plex' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['500', '700'], variable: '--f-mono' });
const bowlby = Bowlby_One_SC({ subsets: ['latin'], weight: '400', variable: '--f-bowlby' });
const archivo = Archivo({ subsets: ['latin'], weight: ['500', '700', '900'], variable: '--f-archivo' });

/** Test page for the redesign: not linked anywhere, not indexed. */
export default function DaLayout({ children }: { children: React.ReactNode }) {
  const fonts = [barlowCondensed, barlow, lilita, nunito, oxanium, plex, mono, bowlby, archivo].map((f) => f.variable).join(' ');
  return <div className={`da-root ${fonts}`}>{children}</div>;
}
