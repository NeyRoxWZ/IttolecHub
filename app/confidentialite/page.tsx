import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';

export const metadata: Metadata = { title: 'Confidentialité · IttolecHub' };

const CONTACT = 'neyroxpuant@gmail.com';

export default function ConfidentialitePage() {
  return (
    <LegalPage
      title="Confidentialité"
      updated="13 septembre 2026"
      intro={
        <p>
          Ce que le site enregistre sur toi, pourquoi, et qui peut le voir. En bref : le strict nécessaire pour
          faire tourner les jeux, <b>aucune publicité, aucun outil de suivi, rien de revendu</b>.
        </p>
      }
      sections={[
        {
          title: 'Responsable du traitement',
          body: (
            <p>
              NeyRox, éditeur d&apos;ItollecHub (voir les mentions légales). Pour toute question ou demande sur tes
              données : <a href={`mailto:${CONTACT}`} className="underline">{CONTACT}</a>.
            </p>
          ),
        },
        {
          title: 'Ce qui est enregistré',
          body: (
            <ul>
              <li><b>Ton compte</b> : ton pseudo et une empreinte chiffrée de ta passphrase — jamais la passphrase elle-même. Si tu te connectes avec Discord : ton identifiant, ton nom et ton avatar Discord.</li>
              <li><b>Tes parties</b> : sauvegardes des jeux solo ; casino (mises, gains, solde, inventaire, cosmétiques, succès, missions, pass) ; Krash (portefeuille, positions, paris flash, historique du solde, objets, cosmétiques, pass).</li>
              <li><b>Ce que tu fais avec les autres</b> : messages du chat, cadeaux envoyés et reçus, duels, cagnottes de groupe, parrainage, réactions.</li>
              <li><b>Les notifications</b>, seulement si tu les actives : l&apos;adresse d&apos;envoi fournie par ton navigateur.</li>
              <li><b>Ta dernière connexion</b>.</li>
            </ul>
          ),
        },
        {
          title: 'Pourquoi, et sur quelle base',
          body: (
            <ul>
              <li><b>Faire fonctionner les jeux</b> (compte, progression, classements, fonctions à plusieurs) : nécessaire à la fourniture du service que tu utilises, selon les Conditions (art. 6.1.b du RGPD).</li>
              <li><b>Repérer la triche et les abus, modérer le chat</b> : intérêt légitime à garder le site juste et sûr (art. 6.1.f).</li>
              <li><b>Envoyer des notifications</b> : ton consentement, donné dans ton navigateur et retirable à tout moment (art. 6.1.a).</li>
            </ul>
          ),
        },
        {
          title: 'Ce qui est visible par les autres joueurs',
          body: (
            <ul>
              <li>ton pseudo, ton titre et ton emblème équipés ;</li>
              <li>ta place dans les classements, ta fiche joueur et ta courbe de solde (casino et Krash) ;</li>
              <li>tes gros gains dans le fil en direct ;</li>
              <li>tes messages dans le chat et tes réactions ;</li>
              <li>tes duels ouverts et le classement du défi du jour.</li>
            </ul>
          ),
        },
        {
          title: 'Ce qui reste dans ton navigateur',
          body: (
            <p>
              Le site garde quelques informations dans le stockage local de ton navigateur : ta session de
              connexion, le thème, ta dernière salle, tes préférences (son, turbo, réglages de trade) et ce que tu
              as déjà vu (guides, patch notes). Ces données sont strictement nécessaires au fonctionnement du site
              et ne servent à aucun suivi ; elles ne demandent donc pas de consentement. Les effacer te déconnecte
              et remet ces préférences à zéro.
            </p>
          ),
        },
        {
          title: 'Qui y a accès',
          body: (
            <ul>
              <li><b>Vercel</b> (États-Unis) héberge le site ;</li>
              <li><b>Supabase</b> héberge la base de données, sur des serveurs situés dans l&apos;Union européenne (Irlande) ;</li>
              <li><b>Discord</b> (États-Unis) intervient si tu choisis de te connecter avec ;</li>
              <li>le service de notifications de ton navigateur achemine les notifications, si tu les as activées.</li>
            </ul>
          ),
        },
        {
          title: 'Transferts hors de l’Union européenne',
          body: (
            <p>
              Vercel et Discord sont établis aux États-Unis. Les transferts vers ces prestataires sont encadrés par
              le cadre de protection des données UE–États-Unis (Data Privacy Framework) auquel ils adhèrent, ou à
              défaut par les clauses contractuelles types de la Commission européenne.
            </p>
          ),
        },
        {
          title: 'Combien de temps',
          body: (
            <p>
              Tant que ton compte existe. Le chat et le fil en direct ne gardent que les messages et les coups les
              plus récents : les plus anciens sont effacés automatiquement. Quand un compte est supprimé, ses
              données de jeu le sont aussi.
            </p>
          ),
        },
        {
          title: 'Mineurs',
          body: (
            <p>
              Si tu as moins de 15 ans, l&apos;accord d&apos;un de tes parents (ou de la personne qui a
              l&apos;autorité parentale) est nécessaire pour créer un compte, conformément à l&apos;article 45 de
              la loi Informatique et Libertés. Un parent peut demander la suppression du compte de son enfant à
              l&apos;adresse de contact.
            </p>
          ),
        },
        {
          title: 'Tes droits',
          body: (
            <>
              <p>
                Tu peux accéder à tes données, les faire corriger ou effacer, t&apos;opposer à un traitement fondé
                sur l&apos;intérêt légitime, en demander la limitation ou recevoir une copie de tes données. Écris à{' '}
                <a href={`mailto:${CONTACT}`} className="underline">{CONTACT}</a> depuis n&apos;importe quelle adresse
                en indiquant ton pseudo ; une réponse est apportée dans un délai d&apos;un mois.
              </p>
              <p>
                Depuis ta page Profil, tu peux aussi changer ton pseudo et <b>supprimer ton compte</b> : toutes tes
                données sont alors effacées immédiatement. Les notifications se coupent à tout moment.
                Si tu estimes que tes droits ne sont pas respectés, tu peux adresser une réclamation à la CNIL
                (<a href="https://www.cnil.fr" className="underline" rel="noopener noreferrer" target="_blank">cnil.fr</a>).
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
