import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';

export const metadata: Metadata = { title: 'Confidentialité · IttolecHub' };

export default function ConfidentialitePage() {
  return (
    <LegalPage
      title="Confidentialité"
      updated="12 septembre 2026"
      intro={
        <p>
          Ce que le site enregistre sur toi, pourquoi, et qui peut le voir. En bref : le strict nécessaire pour
          faire tourner les jeux, <b>aucune publicité, aucun outil de suivi, rien de revendu</b>.
        </p>
      }
      sections={[
        {
          title: 'Ce qui est enregistré',
          body: (
            <ul>
              <li><b>Ton compte</b> : ton pseudo et une empreinte chiffrée de ta passphrase — jamais la passphrase elle-même. Si tu te connectes avec Discord : ton identifiant, ton nom et ton avatar Discord.</li>
              <li><b>Tes parties</b> : sauvegardes des jeux solo, historique du casino (mises, gains, solde), inventaire, cosmétiques, succès, missions et progression du pass.</li>
              <li><b>Ce que tu fais avec les autres</b> : messages du chat, cadeaux envoyés et reçus, duels, cagnottes de groupe, parrainage, réactions.</li>
              <li><b>Les notifications</b>, seulement si tu les actives : l&apos;adresse d&apos;envoi fournie par ton navigateur.</li>
              <li><b>Ta dernière connexion</b>.</li>
            </ul>
          ),
        },
        {
          title: 'À quoi ça sert',
          body: (
            <p>
              Uniquement à faire fonctionner le site : garder ta progression, afficher les classements et le fil
              en direct, faire marcher les fonctions à plusieurs, envoyer les notifications demandées et repérer
              la triche. Le site n&apos;utilise ni publicité, ni outil d&apos;analyse d&apos;audience, ni cookie de
              suivi.
            </p>
          ),
        },
        {
          title: 'Ce qui est visible par les autres joueurs',
          body: (
            <ul>
              <li>ton pseudo ;</li>
              <li>ta place dans les classements, ta fiche joueur et ta courbe de solde ;</li>
              <li>tes gains et pertes dans le fil en direct ;</li>
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
              connexion, le thème clair ou sombre, ta dernière salle, tes préférences (son, turbo, cosmétiques),
              ce que tu as déjà vu (tutoriels, patch notes) et, si tu joues sans compte, ton portefeuille du casino.
              Ces données restent sur ton appareil ; les effacer te déconnecte et remet ces préférences à zéro.
            </p>
          ),
        },
        {
          title: 'Qui héberge les données',
          body: (
            <ul>
              <li><b>Vercel</b> héberge le site ;</li>
              <li><b>Supabase</b> héberge la base de données ;</li>
              <li><b>Discord</b> intervient si tu choisis de te connecter avec ;</li>
              <li>le service de notifications de ton navigateur achemine les notifications, si tu les as activées.</li>
            </ul>
          ),
        },
        {
          title: 'Combien de temps',
          body: (
            <p>
              Tant que ton compte existe. Le chat et le fil en direct ne gardent que les messages et les coups
              les plus récents : les plus anciens sont effacés automatiquement.
            </p>
          ),
        },
        {
          title: 'Tes droits',
          body: (
            <p>
              Tu peux consulter tes statistiques et changer ton pseudo depuis ta page Profil, et couper les
              notifications à tout moment depuis le casino. Tu peux aussi demander l&apos;accès à tes données,
              leur correction ou la suppression de ton compte auprès de l&apos;éditeur du site.
            </p>
          ),
        },
      ]}
    />
  );
}
