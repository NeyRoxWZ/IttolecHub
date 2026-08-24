# Mode Casino Solo — FrenlyCoins (version complète — 20 jeux)
### Document de spécification fonctionnelle (à coller directement dans Claude Code)

Tu vas ajouter un nouveau mode solo **"Casino"** au site de mini-jeux multijoueur déjà existant. Ce mode repose sur une monnaie virtuelle fictive appelée les **FrenlyCoins** (symbole **₶**), qui n'a **aucune valeur réelle** : elle ne s'achète pas avec de l'argent réel, elle ne se retire pas, elle ne se convertit pas. Réutilise la direction artistique déjà existante du site pour habiller ces jeux dans un univers "casino/pari" cohérent avec le reste du site.

**Principe directeur** : reprends les vrais codes des casinos en ligne (tension, mise en scène, sons, animations, système de progression, événements, dopamine) pour donner une sensation de casino authentique — mais toujours honnête : le RNG ne doit jamais être trafiqué pour simuler de faux quasi-gains, et les probabilités doivent rester consultables. Chaque mini-jeu a sa propre petite identité visuelle et sa mise en scène (comme Frenly Poulet : un vrai petit univers autour du mécanisme, pas juste un bouton "miser").

---

## 1. La monnaie : FrenlyCoins (₶)

- Chaque joueur démarre avec **250 ₶** (valeur d'exemple, configurable).
- Solde persistant par joueur, mis à jour en temps réel.
- Historique des transactions consultable (mises, gains, pertes, bonus).

## 2. Principe général de mise

- Mise min/max par jeu, plafonnée à une valeur fixe ou à un % du solde (évite le "tout miser" en un clic).
- Chaque jeu a un **avantage de la maison** intégré. RTP visé entre 90 % et 98,6 % selon le jeu.
- RTP/probabilités toujours consultables quelque part (tooltip, page d'info).

## 3. Les 20 mini-jeux

### 🎰 Frenly Slots
Machine à sous à rouleaux, symboles réhabillés selon la DA du site. Mise, spin, combinaisons sur lignes de paiement = gain. **RTP ~94 %.**

### 🃏 Frenly 21
Blackjack contre un croupier IA. Mise avant distribution, tirer/rester/doubler. 1:1 sur victoire normale, 3:2 sur blackjack naturel. **RTP ~98 %.**

### 🎡 Frenly Wheel
Roulette simplifiée : couleur (1:1), numéro précis (gros multiplicateur), ou plage (paiement intermédiaire). **RTP ~95-97 %.**

### 🚀 Frenly Rocket
Multiplicateur qui grimpe en continu depuis 1x en temps réel ; encaisser avant le crash. **RTP ~95 %.**

### 💣 Frenly Mines
Grille avec mines cachées ; chaque case sûre révélée augmente le multiplicateur ; encaisser à tout moment. **RTP ~96 %.**

### 🔵 Frenly Plinko
Une bille tombe à travers un plateau à picots jusqu'à une case multiplicatrice. **RTP ~96 %.**

### 🔺 Frenly HiLo
Deviner si la carte suivante est plus haute ou plus basse, cash-out à tout moment. **RTP ~96 %.**

### 🎟️ Frenly Grattage
Ticket très bon marché (ex : 1 ₶), petits gains fréquents, gros gain rare. **Rôle de filet de sécurité** anti-zéro. **RTP ~90 %.**

### 🐔 Frenly Poulet
Un poulet traverse une route à voies de circulation ; chaque voie franchie augmente le multiplicateur ; une voiture = mise perdue. **RTP ~96 %.**

### 🏗️ Frenly Tower
Comme Mines mais en montée d'étages, une case piégée par étage parmi plusieurs. **RTP ~96 %.**

### 🔢 Frenly Keno
Choisir des numéros sur une grille, tirage aléatoire, gains selon le nombre de correspondances. **RTP ~95 %.**

### 🎁 Frenly Caisses
Plusieurs coffres, un ou deux cachent le gros lot, révélation immédiate. **RTP ~93 %.**

### 🪙 Frenly Coinflip
Pile ou face classique, x2 en cas de victoire. **RTP ~97 %.**

### 🦖 Frenly Dino
Un perso avance et esquive des obstacles, multiplicateur qui grimpe avec la distance, cash-out avant impact. **RTP ~95 %.**

### 🐎 Frenly Chevaux
Course de chevaux fictifs à cotes différentes, mise avant le départ. **RTP ~94 %.**

### 🥤 Frenly Bonneteau
Trouve le bon gobelet parmi plusieurs qui cache la bille, après mélange animé. **RTP ~93 %.**

### 🏟️ Frenly Stade
*(inspiré de Football Studio)* Deux cartes tirées, "Domicile" vs "Extérieur", la plus haute gagne, "Match nul" possible à grosse cote. Résultat en ~10 secondes. **RTP ~96 %.**

### 🎴 Frenly Baccarat
Tu paries sur qui aura la main la plus proche de 9 : Joueur, Banque, ou Égalité. Aucune décision de jeu à prendre, cartes tirées automatiquement, juste le pari. **RTP ~98,5 % (Joueur/Banque), ~85 % (Égalité).**

### ✊ Frenly Pierre-Feuille-Ciseaux
*(vrai jeu "Stake Original")* Contre la maison, coup unique, révélation simultanée, x2 sur victoire. **RTP ~96 %.**

### 🎲 Frenly Craps Express
Version simplifiée du craps : un seul pari "Ça passe" avant le premier lancer. 7 ou 11 au premier jet = victoire immédiate ; 2, 3 ou 12 = perte immédiate ; sinon le nombre devient le "point", on relance jusqu'à le retrouver (gain) ou tomber sur 7 (perte). **RTP ~98,6 %.**

*(Bonus optionnel si besoin d'un 21e jeu : **Frenly Serpent**, inspiré du jeu Snake — le serpent avance, le multiplicateur grimpe avec sa longueur, cash-out avant qu'il se morde ou touche un mur. RTP ~95 %.)*

## 4. Garder l'intérêt : éviter la stagnation des joueurs riches

- **Classement saisonnier** : leaderboard reset chaque saison (ex : mensuelle). Total "all-time" séparé pour le prestige.
- **Système de Prestige** : à partir d'un palier (ex : 1 000 000 ₶), le joueur peut "prestiger" — solde repart à 250 ₶, badge/titre cosmétique permanent débloqué, aucun avantage mécanique, juste du flex.
- **Récompenses cosmétiques** pour les paliers de richesse et le classement (titres, bordures de profil, animations de victoire spéciales).
- **Défis quotidiens/hebdomadaires** avec petite récompense en ₶ ou cosmétique.

## 5. Ne jamais rester bloqué à zéro

- **Bonus de connexion quotidien** : petit montant fixe ou variable (ex : 20-50 ₶), chaque jour.
- **Filet de sécurité anti-zéro** : si le solde passe sous un seuil critique (ex : moins de 10 ₶), recharge automatique (ex : 50 ₶) après un court délai, avec mise en scène ("La maison t'offre une seconde chance").
- **Frenly Grattage** sert de jeu à très faible mise, quasi toujours accessible même à solde très bas.

## 6. Faire vivre le mode (événements & sensations)

- **Roue quotidienne** ("Frenly Wheel of Fortune") : gratuite une fois par jour, montant aléatoire de ₶ ou cosmétique.
- **Jackpot progressif partagé** : une petite part de chaque mise perdue sur certains jeux alimente un jackpot commun affiché en temps réel.
- **Séries de victoires (streaks)** : compteur visuel avec petit bonus croissant.
- **Notifications communautaires** ("X vient de gagner 5000 ₶ au Frenly Rocket !").
- Le RNG doit rester honnête et transparent partout — animations stylées, mais jamais de faux quasi-gains simulés artificiellement.

## 7. Garde-fous

- Aucune conversion possible en argent réel, dans un sens comme dans l'autre — à préciser dans une popup au premier lancement du mode Casino.
- Pas de mise "all-in" intégrale en un clic.
- Historique des mises transparent et consultable à tout moment.
- Petit message discret et bienveillant si le joueur enchaîne beaucoup de pertes d'affilée, sans jamais bloquer le jeu.

## 8. Résumé fonctionnel de ce qu'il faut construire

- Section "Casino" accessible depuis le mode solo existant.
- Solde FrenlyCoins persistant par utilisateur, avec historique des transactions.
- Les 20 mini-jeux détaillés ci-dessus, chacun avec écran de mise, mise en scène/identité visuelle propre, animation de résultat, et intégration au solde global.
- Classement (leaderboard) avec saisons + système de prestige.
- Bonus de connexion quotidien + filet de sécurité anti-zéro.
- Roue quotidienne + jackpot progressif partagé.
- Réutilisation de la DA déjà existante du site pour l'univers visuel "casino/pari".
