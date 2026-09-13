import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';

export const metadata: Metadata = { title: 'Mentions légales · IttolecHub' };

const CONTACT = 'neyroxpuant@gmail.com';

export default function MentionsLegalesPage() {
  return (
    <LegalPage
      title="Mentions légales"
      updated="13 septembre 2026"
      intro={
        <p>
          Informations prévues par l&apos;article 6 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans
          l&apos;économie numérique (LCEN).
        </p>
      }
      sections={[
        {
          title: 'Éditeur',
          body: (
            <>
              <p>
                ItollecHub est un site non commercial, édité à titre personnel et non professionnel par{' '}
                <b>NeyRox</b>. Conformément à l&apos;article 6, III, 2 de la LCEN, l&apos;éditeur a choisi de ne pas
                rendre publique son identité ; elle est connue de l&apos;hébergeur, auprès duquel elle peut être
                obtenue dans les conditions prévues par la loi.
              </p>
              <p>
                Contact : <a href={`mailto:${CONTACT}`} className="underline">{CONTACT}</a>
              </p>
              <p>Directeur de la publication : NeyRox.</p>
            </>
          ),
        },
        {
          title: 'Hébergement',
          body: (
            <ul>
              <li>
                <b>Site</b> : Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis —{' '}
                <a href="https://vercel.com" className="underline" rel="noopener noreferrer" target="_blank">vercel.com</a>
              </li>
              <li>
                <b>Base de données</b> : Supabase Inc., 970 Toa Payoh North #07-04, Singapour 318992 — serveurs
                situés dans l&apos;Union européenne (Irlande) —{' '}
                <a href="https://supabase.com" className="underline" rel="noopener noreferrer" target="_blank">supabase.com</a>
              </li>
            </ul>
          ),
        },
        {
          title: 'Signaler un contenu',
          body: (
            <p>
              Un pseudo, un message ou tout autre contenu publié par un joueur te semble illicite ? Écris à{' '}
              <a href={`mailto:${CONTACT}`} className="underline">{CONTACT}</a> en précisant où il se trouve et
              pourquoi. Le contenu signalé est examiné et retiré s&apos;il est manifestement illicite.
            </p>
          ),
        },
        {
          title: 'Propriété intellectuelle',
          body: (
            <p>
              Le code, le design et les textes du site appartiennent à leur éditeur. Les contenus de tiers affichés
              dans certains jeux restent la propriété de leurs ayants droit (voir les Conditions). Les entreprises
              de Krash portent des noms parodiques inventés et n&apos;ont aucun lien avec les sociétés réelles.
            </p>
          ),
        },
      ]}
    />
  );
}
