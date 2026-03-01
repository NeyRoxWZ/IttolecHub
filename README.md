# ItollecHub

Plateforme web multijoueur gratuite regroupant plusieurs mini-jeux de type "Guessr" basés sur des APIs publiques.

## 🎮 Jeux disponibles

- **PokeGuessr** : Devine le Pokémon avec des images floues
- **ComplèteGuessr** : Trouve les suggestions Google les plus bizarres  
- **FlagGuessr** : Devine le pays ou sa population
- **TrollTrivia** : QCM de culture générale absurde

## 🛠️ Stack technique

- **Frontend** : Next.js 14 (App Router), TypeScript, TailwindCSS
- **Backend** : Supabase (Realtime, Auth, Database)
- **Icons** : Lucide React
- **Hébergement** : Vercel

## 📦 Installation

```bash
npm install
npm run dev
```

## 🔧 Variables d'environnement

Créez un fichier `.env.local` :

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_service_key
```

## 🚀 Déploiement

1. Push vers GitHub
2. Connectez Vercel à votre repo
3. Configurez les variables d'environnement
4. Déployez !

## 📄 Licence

MIT