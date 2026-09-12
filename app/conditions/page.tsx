import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';

export const metadata: Metadata = { title: 'Conditions · IttolecHub' };

export default function ConditionsPage() {
  return (
    <LegalPage
      title="Conditions"
      updated="12 septembre 2026"
      intro={
        <p>
          Ces conditions encadrent l&apos;utilisation d&apos;ItollecHub, un site de mini-jeux gratuits : jeux
          multijoueur, jeux solo et casino en monnaie virtuelle. En jouant, tu les acceptes.
        </p>
      }
      sections={[
        {
          title: 'Accès et compte',
          body: (
            <>
              <p>Le site est gratuit. Certaines fonctions demandent un compte, créé avec un pseudo et une passphrase, ou via Discord.</p>
              <p>
                <b>Ta passphrase est la seule clé de ton compte.</b> Garde-la en lieu sûr et ne la partage avec
                personne : sans elle, un compte créé par passphrase ne peut pas être récupéré.
              </p>
            </>
          ),
        },
        {
          title: 'Monnaie virtuelle',
          body: (
            <>
              <p>
                Les FrenlyCoins (₶), les Livres Tournois et tout ce qui se gagne en jeu sont <b>fictifs</b> : ils
                n&apos;ont aucune valeur réelle, ne s&apos;achètent pas et ne s&apos;échangent ni contre de
                l&apos;argent ni contre un bien ou un service.
              </p>
              <p>
                Soldes, objets, cosmétiques et progression peuvent être ajustés ou remis à zéro, notamment lors
                d&apos;une mise à jour ou pour corriger un bug. Les changements notables sont indiqués dans les
                patch notes.
              </p>
            </>
          ),
        },
        {
          title: 'Jeux de hasard simulés',
          body: (
            <>
              <p>
                Le casino simule des jeux de hasard <b>sans argent réel</b> : on n&apos;y mise et on n&apos;y gagne
                rien qui ait une valeur hors du site.
              </p>
              <p>
                Si le jeu, sur ce site ou ailleurs, prend trop de place dans ta vie, Joueurs Info Service répond
                gratuitement et anonymement au <b>09 74 75 13 13</b>.
              </p>
            </>
          ),
        },
        {
          title: 'Comportement',
          body: (
            <>
              <p>Pseudos, messages du chat, mots offerts avec les cadeaux : tout ce que tu écris est visible par les autres joueurs. Sont interdits :</p>
              <ul>
                <li>les insultes, le harcèlement, les propos haineux ou discriminatoires ;</li>
                <li>se faire passer pour quelqu&apos;un d&apos;autre ;</li>
                <li>tricher, exploiter un bug volontairement ou automatiser le jeu en dehors des outils prévus.</li>
              </ul>
              <p>Un compte qui ne respecte pas ces règles peut voir son pseudo changé, sa progression réinitialisée ou son accès retiré.</p>
            </>
          ),
        },
        {
          title: 'Disponibilité',
          body: (
            <p>
              Le site est fourni tel quel, sans garantie de disponibilité. Il peut évoluer, être interrompu ou
              perdre des données de jeu, et les jeux peuvent être modifiés, rééquilibrés ou retirés.
            </p>
          ),
        },
        {
          title: 'Contenus tiers',
          body: (
            <>
              <p>
                Certains jeux affichent des contenus appartenant à leurs auteurs : informations et affiches de
                films, logos de marques, drapeaux, Pokémon, articles de Wikipédia. Ils restent la propriété de
                leurs ayants droit et ne servent qu&apos;au jeu.
              </p>
              <p>Ce produit utilise l&apos;API TMDB mais n&apos;est ni approuvé ni certifié par TMDB.</p>
            </>
          ),
        },
        {
          title: 'Modifications',
          body: (
            <p>
              Ces conditions peuvent changer. La date en haut de la page indique leur dernière mise à jour ;
              continuer à jouer après un changement vaut acceptation.
            </p>
          ),
        },
      ]}
    />
  );
}
