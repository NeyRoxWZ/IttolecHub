'use client';

import { use, useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Users, Gamepad2, Copy, Globe, DollarSign, PenTool, Zap, Shield, EyeOff, Settings, Play, LogOut, CheckCircle, Home, QrCode, Eye, Monitor, Share2, X, Target } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import QRCodeStyling from 'qr-code-styling';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/Dialog';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { BRAWL, BRAWL_SWATCHES } from '@/lib/ui/brawl';

import OgName from '@/components/OgName';
import { roomDb } from '@/lib/supabase/roomClient';
import { forgetSeat, recallSeat, rememberSeat, takeOverIfHostGone } from '@/lib/roomSeat';
import { PARTY_GAMES, partyMinPlayers } from '@/lib/party/catalog';
import RoomLobby from './RoomLobby';
import { Music, Laugh, Quote, Gavel, BookOpen, Brush, Grid3x3, HelpCircle } from 'lucide-react';
interface Player {
  id: string;
  name: string;
  isHost: boolean; // mapped from is_host
  score: number;
  last_seen_at?: string;
}

interface GameSetting {
  id: string;
  label: string;
  type: 'number' | 'text' | 'select' | 'multiselect';
  default: string | number | any[];
  options?: { value: string; label: string; disabled?: boolean }[];
}

const gamesList: { id: string; name: string; description: string; icon: any; color: string; settings: GameSetting[]; comingSoon?: boolean }[] = [
  {
    id: 'pokeguessr',
    name: 'PokéGuessr',
    description: 'Quel est ce Pokémon ?',
    icon: Zap,
    color: 'from-red-500 to-orange-500',
    settings: [
      { id: 'rounds', label: 'Manches', type: 'number', default: 5 },
      { id: 'time', label: 'Temps par manche (s)', type: 'number', default: 30 },
      { 
        id: 'difficulty', 
        label: 'Mode de Jeu', 
        type: 'select', 
        default: 'normal',
        options: [
          { value: 'easy', label: 'Facile (Image Floue)' },
          { value: 'normal', label: 'Classique (Ombre)' },
          { value: 'hard', label: 'Expert (Inversé)' },
        ]
      },
      {
        id: 'gens',
        label: 'Générations',
        type: 'multiselect',
        default: [1],
        options: [
          { value: '1', label: 'Gen 1 (Kanto)' },
          { value: '2', label: 'Gen 2 (Johto)' },
          { value: '3', label: 'Gen 3 (Hoenn)' },
          { value: '4', label: 'Gen 4 (Sinnoh)' },
          { value: '5', label: 'Gen 5 (Unys)' },
          { value: '6', label: 'Gen 6 (Kalos)' },
          { value: '7', label: 'Gen 7 (Alola)' },
          { value: '8', label: 'Gen 8 (Galar)' },
          { value: '9', label: 'Gen 9 (Paldea)' },
        ]
      }
    ],
  },
  {
    id: 'flagguessr',
    name: 'FlagGuessr',
    description: 'Voyagez à travers les drapeaux.',
    icon: Gamepad2, 
    color: 'from-green-500 to-emerald-500',
    settings: [
      { id: 'rounds', label: 'Manches', type: 'number', default: 10 },
      { id: 'time', label: 'Temps par manche (s)', type: 'number', default: 15 },
      { 
        id: 'region', 
        label: 'Continent', 
        type: 'select', 
        default: 'all',
        options: [
          { value: 'all', label: 'Monde Entier' },
          { value: 'Europe', label: 'Europe' },
          { value: 'Americas', label: 'Amériques' },
          { value: 'Africa', label: 'Afrique' },
          { value: 'Asia', label: 'Asie' },
          { value: 'Oceania', label: 'Océanie' },
        ]
      },
    ],
  },
  {
    id: 'infiltre',
    name: "L'Infiltré",
    description: "Démasquez l'intrus parmi vous.",
    icon: Shield,
    color: 'from-slate-500 to-slate-700',
    settings: [
      { id: 'rounds', label: 'Manches', type: 'number', default: 3 },
      { id: 'guessTime', label: 'Débat (minutes)', type: 'number', default: 5 },
      { id: 'voteTime', label: 'Vote (secondes)', type: 'number', default: 30 },
      { 
        id: 'category', 
        label: 'Univers', 
        type: 'select', 
        default: 'all',
        options: [
            { value: 'all', label: 'Tout Mélangé' },
            { value: 'Lieu/Bâtiment', label: 'Lieux' },
            { value: 'Objet', label: 'Objets' },
            { value: 'Animal', label: 'Animaux' },
            { value: 'Métier', label: 'Métiers' },
            { value: 'Concept', label: 'Abstrait' },
        ]
      },
    ],
  },
  {
    id: 'undercover',
    name: 'Undercover',
    description: 'Bluffez pour survivre.',
    icon: EyeOff,
    color: 'from-indigo-500 to-blue-600',
    settings: [
        { id: 'rounds', label: 'Manches', type: 'number', default: 1 },
        { id: 'undercoverCount', label: "Nb. Imposteurs", type: 'number', default: 1 },
        { 
            id: 'mrWhiteEnabled', 
            label: 'Mr. White', 
            type: 'select', 
            default: 'true',
            options: [
                { value: 'true', label: 'Activé' },
                { value: 'false', label: 'Désactivé' }
            ]
        },
        { 
            id: 'playersKnowRole', 
            label: 'Rôles Secrets', 
            type: 'select', 
            default: 'true',
            options: [
                { value: 'true', label: 'Oui (Rôle affiché)' },
                { value: 'false', label: 'Non (Mot seul)' }
            ]
        },
        { id: 'clueRounds', label: 'Tours de table', type: 'number', default: 3 },
    ],
  },
  {
    id: 'drawguessr',
    name: 'DrawGuessr',
    description: 'Dessinez, c\'est gagné !',
    icon: PenTool,
    color: 'from-pink-500 to-rose-600',
    settings: [
      { id: 'rounds', label: 'Manches', type: 'number', default: 5 },
      { id: 'time', label: 'Temps par manche (s)', type: 'number', default: 90 },
      { 
        id: 'difficulty', 
        label: 'Niveau', 
        type: 'select', 
        default: 'mix',
        options: [
          { value: 'mix', label: 'Équilibré' },
          { value: 'easy', label: 'Débutant' },
          { value: 'medium', label: 'Intermédiaire' },
          { value: 'hard', label: 'Expert' },
        ]
      }
    ]
  },
  {
    id: 'budgetguessr',
    name: 'BudgetGuessr',
    description: 'Estimez le juste prix.',
    icon: DollarSign,
    color: 'from-green-400 to-emerald-600',
    settings: [
      { id: 'rounds', label: 'Manches', type: 'number', default: 5 },
      { id: 'time', label: 'Temps par manche (s)', type: 'number', default: 30 },
      { 
        id: 'category', 
        label: 'Catégorie', 
        type: 'select', 
        default: 'films',
        options: [
          { value: 'films', label: 'Films' },
          { value: 'hightech', label: 'High-Tech', disabled: true },
          { value: 'maison', label: 'Maison', disabled: true },
          { value: 'luxe', label: 'Luxe', disabled: true },
          { value: 'alimentation', label: 'Alimentation', disabled: true },
        ]
      },
    ],
  },
  {
    id: 'rentguessr',
    name: 'RentGuessr',
    description: 'Devinez le loyer mensuel.',
    icon: Home,
    color: 'from-indigo-500 to-purple-600',
    settings: [
      { id: 'rounds', label: 'Manches', type: 'number', default: 5 },
      { id: 'time', label: 'Temps par manche (s)', type: 'number', default: 30 },
    ],
  },
  {
    id: 'logoguessr',
    name: 'LogoGuessr',
    description: 'Reconnaissez la marque.',
    icon: Gamepad2, // Placeholder, should be ImageIcon
    color: 'from-orange-400 to-red-500',
    settings: [
      { id: 'rounds', label: 'Manches', type: 'number', default: 5 },
      { id: 'time', label: 'Temps par manche (s)', type: 'number', default: 15 },
      { 
        id: 'difficulty', 
        label: 'Difficulté', 
        type: 'select', 
        default: 'easy',
        options: [
          { value: 'easy', label: 'Facile' },
          { value: 'medium', label: 'Moyen' },
          { value: 'hard', label: 'Difficile' },
        ]
      },
    ],
  },
  {
    id: 'jaugeguessr',
    name: 'JaugeGuessr',
    description: 'Ciblez la bonne intensité.',
    icon: Target,
    color: 'from-purple-500 to-indigo-500',
    settings: [
      { id: 'rounds', label: 'Manches', type: 'number', default: 5 },
      { id: 'time', label: 'Temps par manche (s)', type: 'number', default: 45 },
      { 
        id: 'difficulty', 
        label: 'Difficulté', 
        type: 'select', 
        default: 'normal',
        options: [
          { value: 'easy', label: 'Facile (Zones larges)' },
          { value: 'normal', label: 'Normal' },
          { value: 'hard', label: 'Difficile (Zones fines)' },
        ]
      },
    ],
  },
  {
    id: 'wikiracing',
    name: 'WikiRacing',
    description: 'Reliez deux pages Wikipédia le plus vite possible.',
    icon: Target, // Using Target temporarily, can change to Link/Book later
    color: 'from-blue-500 to-cyan-500',
    settings: [
      { id: 'rounds', label: 'Manches', type: 'number', default: 3 },
      { 
        id: 'difficulty', 
        label: 'Difficulté du trajet', 
        type: 'select', 
        default: 'easy',
        options: [
          { value: 'easy', label: 'Facile (Concepts liés)' },
          { value: 'hard', label: 'Difficile (Concepts éloignés)' },
        ]
      },
      { 
        id: 'winCondition', 
        label: 'Condition de victoire', 
        type: 'select', 
        default: 'speed',
        options: [
          { value: 'speed', label: 'Vitesse (Moins de temps)' },
          { value: 'optimization', label: 'Optimisation (Moins de clics)' },
        ]
      },
    ],
  },
];

// The party games (Hors Sujet, Punchline, Petit Bac…): catalog in lib/party/catalog.ts.
const PARTY_ICONS: Record<string, any> = {
  horssujet: HelpCircle, untraitdetrop: Brush, blindtest: Music, punchline: Laugh,
  petitbac: Grid3x3, quiaditca: Quote, surenchere: Gavel, ledico: BookOpen,
};
gamesList.push(...PARTY_GAMES.map((g) => ({
  id: g.id, name: g.name, description: g.description, icon: PARTY_ICONS[g.id] || Gamepad2, color: '', settings: g.settings,
})));

/** Multi-choice settings hold numbers (Pokémon generations) or ids (categories). */
const settingValue = (v: string) => (/^\d+$/.test(v) ? Number(v) : v);

export default function RoomPage({ params: paramsPromise }: { params: Promise<{ code: string }> }) {
  // Next 15 hands dynamic params over as a promise.
  const params = use(paramsPromise);
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerName, setPlayerName] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState<string>('__placeholder__');
  const [gameSettings, setGameSettings] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isCodeVisible, setIsCodeVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isRoomDeleted, setIsRoomDeleted] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isPrivateMode, setIsPrivateMode] = useState(false); // Synced via room settings
  const [showJoinOverlay, setShowJoinOverlay] = useState(false); // Overlay QR Code
  const [showPseudoModal, setShowPseudoModal] = useState(false);
  const [pseudoInput, setPseudoInput] = useState('');
  const [isKicked, setIsKicked] = useState(false);

  // Refs for interval access
  const playersRef = useRef(players);
  const isHostRef = useRef(isHost);
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    playersRef.current = players;
    isHostRef.current = isHost;
  }, [players, isHost]);

  // Clear the resume prompt whenever this room becomes unusable (kicked or deleted)
  useEffect(() => {
    if (isKicked || isRoomDeleted) {
        try { localStorage.removeItem('itollec_last_room'); } catch {}
    }
  }, [isKicked, isRoomDeleted]);

  // Handle QR Code styling
  useEffect(() => {
    if (showJoinOverlay && qrRef.current && typeof window !== 'undefined') {
      qrRef.current.innerHTML = ''; // Clear previous
      
      const qrCode = new QRCodeStyling({
        width: 320,
        height: 320,
        data: `${window.location.origin}/room/${params.code}?source=qrcode`,
        image: "/logo-site.png",
        imageOptions: {
          hideBackgroundDots: true,
          imageSize: 0.32,
          margin: 2,
          crossOrigin: "anonymous"
        },
        dotsOptions: {
          type: "rounded",
          color: "#000000"
        },
        cornersSquareOptions: {
          type: "extra-rounded"
        },
        cornersDotOptions: {
          type: "dot"
        },
        backgroundOptions: {
          color: "#ffffff"
        },
        qrOptions: {
          errorCorrectionLevel: "H"
        }
      });
      
      qrCode.append(qrRef.current);
    }
  }, [showJoinOverlay, params.code]);

  const selectedGame = useMemo(() => selectedGameId && selectedGameId !== '__placeholder__' ? gamesList.find(g => g.id === selectedGameId) : undefined, [selectedGameId]);

  const togglePrivateMode = async () => {
      if (!isHost) return; // Seul l'hôte peut changer ce mode
      const newState = !isPrivateMode;
      setIsPrivateMode(newState);
      vibrate(HAPTIC.SOFT);
      
      if (roomId) {
          await roomDb.from('rooms').update({
              settings: { ...gameSettings, isPrivate: newState }
          }).eq('id', roomId);
      }
      
      if (newState) {
          toast.success("Salon en mode privé");
      } else {
          toast.success("Salon en mode public");
      }
  };

  // Initialisation et gestion de la room/joueur via Supabase
  useEffect(() => {
    // Check for stored session. Any direct visit to a room URL without a
    // stored session (closed tab, cleared sessionStorage, another device)
    // now prompts for a pseudo instead of bouncing to home — this is what
    // lets a player rejoin an in-progress game just by knowing the code and
    // typing the same name back in.
    // The tab's pseudo, else the one this device used in this room (closed tab, phone reload).
    const remembered = recallSeat(params.code);
    const storedName = sessionStorage.getItem('playerName') || remembered?.name || null;

    if (!storedName) {
        setShowPseudoModal(true);
        return;
    }

    sessionStorage.setItem('playerName', storedName);
    if (remembered?.playerId && !sessionStorage.getItem('playerId')) sessionStorage.setItem('playerId', remembered.playerId);
    setPlayerName(storedName);

    const initRoom = async () => {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        let roomData = null;
        let attempts = 0;

        // Retry logic for room fetching (wait for creation propagation)
        while (attempts < 5 && !roomData) {
            const { data, error } = await supabase
              .from('rooms')
              .select('*')
              .eq('code', params.code)
              .maybeSingle();

            if (data) {
                roomData = data;
                break;
            }

            // Wait 500ms before retry
            await new Promise(r => setTimeout(r, 500));
            attempts++;
        }

        if (!roomData) {
          // Check if user just created this room (isHost param)
          const isHostParam = searchParams.get('host') === 'true';
          
          if (isHostParam) {
              // Create room if it doesn't exist and we are host
              const { data: newRoom, error: createError } = await roomDb
                  .from('rooms')
                  .insert({
                      code: params.code,
                      host_id: storedName, // Temporary host name, will update with ID later
                      status: 'waiting',
                      game_type: '__placeholder__'
                  })
                  .select()
                  .single();
                  
              if (newRoom) {
                  roomData = newRoom;
              } else {
                  console.error("Failed to create room:", createError);
                  setIsRoomDeleted(true);
                  return;
              }
          } else {
              setIsRoomDeleted(true);
              return;
          }
        }

        const room = roomData;

        // Redirection immédiate si la partie est déjà en cours
        if ((room.status === 'in_game' || room.status === 'started') && searchParams.get('return') !== 'true') {
            const paramsUrl = new URLSearchParams();
            if (room.settings) {
                Object.entries(room.settings).forEach(([k, v]) => {
                    if (v !== '' && v !== undefined) paramsUrl.set(k, String(v));
                });
            }
            const q = paramsUrl.toString();
            router.push(`/games/${room.game_type}/${params.code}${q ? `?${q}` : ''}`);
            return;
        }

        setRoomId(room.id);
        
        // Mettre à jour les paramètres si déjà définis
        if (room.game_type && room.game_type !== '__placeholder__') {
          setSelectedGameId(room.game_type);
        }
        if (room.settings) {
          setGameSettings(room.settings);
          if (room.settings.isPrivate !== undefined) {
              setIsPrivateMode(room.settings.isPrivate);
          }
          
          // Check if user is banned (check both name and current playerId)
          const storedPlayerId = sessionStorage.getItem('playerId');
          if (room.settings.banned && Array.isArray(room.settings.banned)) {
              if (room.settings.banned.includes(storedName) || (storedPlayerId && room.settings.banned.includes(storedPlayerId))) {
                  toast.error("Vous avez été exclu de ce salon.");
                  router.push('/');
                  return;
              }
          }
        }

        // 2. Vérifier/Créer le joueur dans la BDD
        const { data: existingPlayer } = await supabase
          .from('players')
          .select('*')
          .eq('room_id', room.id)
          .eq('name', storedName)
          .maybeSingle();

        let currentPlayerId = existingPlayer?.id;
        let isCurrentHost = existingPlayer?.is_host || false;

        if (!existingPlayer) {
          // Créer le joueur
          // Si la room n'a pas de host ou si le host_id correspond au nom (legacy), ce joueur devient host
          const shouldBeHost = !room.host_id || room.host_id === storedName; 
          
          const { data: newPlayer, error: createError } = await roomDb
            .from('players')
            .insert({
              room_id: room.id,
              name: storedName,
              is_host: shouldBeHost,
              score: 0
            })
            .select()
            .maybeSingle();

          if (newPlayer) {
            currentPlayerId = newPlayer.id;
            isCurrentHost = newPlayer.is_host;
            
            // Si c'est le host, on met à jour la room pour lier le host_id au player UUID si ce n'est pas déjà fait
            if (shouldBeHost && room.host_id !== newPlayer.id) {
               await roomDb.from('rooms').update({ host_id: newPlayer.id }).eq('id', room.id);
            }
          }
        } else {
           // A returning player takes their seat token back before writing anything.
           await roomDb.claim(room.id, { playerId: existingPlayer.id });
           // Si le joueur existe, on vérifie s'il est host selon la room
           // Par sécurité, si room.host_id correspond à ce joueur, on s'assure que is_host est true
           if (room.host_id === existingPlayer.id || room.host_id === existingPlayer.name) {
               isCurrentHost = true;
               if (!existingPlayer.is_host) {
                   await roomDb.from('players').update({ is_host: true }).eq('id', existingPlayer.id);
               }
           } else if (existingPlayer.is_host) {
               // Fallback: Player marked as host in players table but maybe not synced to room table
               isCurrentHost = true;
           }
        }

        setIsHost(isCurrentHost);
        sessionStorage.setItem('isHost', String(isCurrentHost));
        if (currentPlayerId) {
          sessionStorage.setItem('playerId', currentPlayerId);
          rememberSeat(params.code, { playerId: currentPlayerId, name: storedName });
        }

        // Remember this room in localStorage (survives closed tabs, unlike
        // sessionStorage) so the home page can offer to resume it later.
        try {
          localStorage.setItem('itollec_last_room', JSON.stringify({ code: params.code, name: storedName }));
        } catch {}

        // 3. Charger la liste initiale des joueurs
        const { data: currentPlayers } = await supabase
          .from('players')
          .select('*')
          .eq('room_id', room.id);

        if (currentPlayers) {
          const mappedInitialPlayers = currentPlayers.map(p => ({
            id: p.id,
            name: p.name,
            isHost: p.is_host,
            score: p.score || 0,
            last_seen_at: p.last_seen_at
          }));

          // Sort so host is always first
          mappedInitialPlayers.sort((a, b) => {
            if (a.isHost) return -1;
            if (b.isHost) return 1;
            return a.name.localeCompare(b.name);
          });

          setPlayers(mappedInitialPlayers);
        }

        setIsLoading(false);

      } catch (error) {
        console.error("Erreur init room:", error);
        toast.error("Connexion impossible. Vérifiez votre réseau et réessayez.");
        setIsLoading(false);
      }
    };

    initRoom();
  }, [params.code, router]);

  // Presence System (Heartbeat & Inactivity)
  useEffect(() => {
    if (!roomId) return;
    const currentPayloadId = sessionStorage.getItem('playerId');

    // 1. Heartbeat: every 30 s, and at once on coming back to the tab (phones
    // freeze timers in the background, which used to read as "gone").
    const sendHeartbeat = async () => {
        if (currentPayloadId) {
            await roomDb.from('players').update({ last_seen_at: new Date().toISOString() }).eq('id', currentPayloadId);
        }
    };
    const onBack = () => { if (document.visibilityState === 'visible') void sendHeartbeat(); };
    sendHeartbeat();
    const hbInterval = setInterval(sendHeartbeat, 30000);
    document.addEventListener('visibilitychange', onBack);
    window.addEventListener('focus', onBack);
    window.addEventListener('online', onBack);

    // 2. Every 20 s: a host who went quiet hands over to the first active player
    // (nobody closes the room on everyone), and the host tidies up seats left
    // empty for a long time — only here in the waiting room, never mid-game.
    const checkActivity = async () => {
        const { data: seats } = await supabase.from('players').select('id, joined_at, last_seen_at').eq('room_id', roomId);
        const { data: roomRow } = await supabase.from('rooms').select('host_id, status').eq('id', roomId).maybeSingle();
        if (!seats || !roomRow || !currentPayloadId) return;

        if (await takeOverIfHostGone(roomId, currentPayloadId, roomRow.host_id, seats)) {
            setIsHost(true);
            isHostRef.current = true;
            toast.success('L’hôte est parti : c’est toi l’hôte du salon maintenant.');
            return;
        }

        if (isHostRef.current && roomRow.status === 'waiting') {
            const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
            await roomDb.from('players').delete().eq('room_id', roomId).lt('last_seen_at', tenMinAgo);
        }
    };
    const checkInterval = setInterval(checkActivity, 20000);

    return () => {
        clearInterval(hbInterval);
        clearInterval(checkInterval);
        document.removeEventListener('visibilitychange', onBack);
        window.removeEventListener('focus', onBack);
        window.removeEventListener('online', onBack);
    };
  }, [roomId]);

  // Souscription Realtime
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase.channel(`room_${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${roomId}`,
        },
        async () => {
          // Recharger la liste des joueurs
          const { data: currentPlayers } = await supabase
            .from('players')
            .select('*')
            .eq('room_id', roomId);

          if (currentPlayers) {
            const currentPlayerId = sessionStorage.getItem('playerId');
            const amIStillHere = currentPlayers.some(p => p.id === currentPlayerId);
            
            if (!amIStillHere && currentPlayerId) {
                // I was kicked or removed
                setIsKicked(true);
                setTimeout(() => router.push('/'), 3000);
                return;
            }

            const mappedPlayers = currentPlayers.map(p => ({
              id: p.id,
              name: p.name,
              isHost: p.is_host,
              score: p.score || 0,
              last_seen_at: p.last_seen_at
            }));

            // Sort so host is always first
            mappedPlayers.sort((a, b) => {
              if (a.isHost) return -1;
              if (b.isHost) return 1;
              return a.name.localeCompare(b.name);
            });

            setPlayers(mappedPlayers);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events for rooms (UPDATE and DELETE)
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
              setIsRoomDeleted(true);
              setTimeout(() => router.push('/'), 3000);
              return;
          }

          const newRoom = payload.new as any;
          // Synchronisation des settings pour les non-hosts uniquement.
          // L'hôte est la source de vérité : réappliquer l'écho de sa propre
          // écriture écraserait sa saisie en cours (boucle d'écho).
          if (!isHostRef.current) {
              if (newRoom.game_type) setSelectedGameId(newRoom.game_type);
              if (newRoom.settings) {
                  setGameSettings(newRoom.settings);
              }
          }
          if (newRoom.settings) {
              if (newRoom.settings.isPrivate !== undefined) {
                  setIsPrivateMode(newRoom.settings.isPrivate);
              }

              // Check if user is banned (real-time kick)
              const storedName = sessionStorage.getItem('playerName');
              const storedPlayerId = sessionStorage.getItem('playerId');
              if (newRoom.settings.banned && Array.isArray(newRoom.settings.banned)) {
                  if ((storedName && newRoom.settings.banned.includes(storedName)) || (storedPlayerId && newRoom.settings.banned.includes(storedPlayerId))) {
                      setIsKicked(true);
                      setTimeout(() => router.push('/'), 3000);
                      return;
                  }
              }
          }

          // Room fermée
          if (newRoom.status === 'closed') {
              setIsRoomDeleted(true);
              setTimeout(() => router.push('/'), 3000);
              return;
          }

          // Redirection si une partie vient d'être lancée : seul un nouveau lancement (tampon
          // startedAt) déplace les joueurs, pas un simple changement de jeu ou de réglage.
          const startStamp = (newRoom.settings as any)?.startedAt ?? null;
          const isNewStart = startStamp !== null && startStamp !== seenStartRef.current;
          if (startStamp !== null) seenStartRef.current = startStamp;
          if ((newRoom.status === 'in_game' || newRoom.status === 'started') && isNewStart) {
            const paramsUrl = new URLSearchParams();
            if (newRoom.settings) {
                Object.entries(newRoom.settings).forEach(([k, v]) => {
                if (v !== '' && v !== undefined) paramsUrl.set(k, String(v));
                });
            }
            const q = paramsUrl.toString();
            router.push(`/games/${newRoom.game_type}/${params.code}${q ? `?${q}` : ''}`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, params.code, router]);

  // Synchroniser les changements de config (Host uniquement)
  const isUpdatingSettingsRef = useRef(false);
  
  useEffect(() => {
      if (!isHost || !roomId || !selectedGameId || selectedGameId === '__placeholder__') return;
      
      const updateRoomSettings = async () => {
          if (isUpdatingSettingsRef.current) return;
          
          // Verify we have valid data before sending
          if (typeof selectedGameId !== 'string') {
              console.error('Invalid game_type:', selectedGameId);
              return;
          }

          if (typeof roomId !== 'string' || !roomId) {
              console.error('Invalid roomId:', roomId);
              return;
          }
          
          isUpdatingSettingsRef.current = true;
          
          const { error } = await roomDb.from('rooms').update({
              game_type: selectedGameId,
              settings: { ...gameSettings, isPrivate: isPrivateMode } // Ensure not undefined
          }).eq('id', roomId);

          if (error) {
             console.error('ERREUR COMPLÈTE UPDATE SETTINGS:', error.message, error.details, error.hint);
             // Stop updating if we hit a persistent error
             // We don't set isUpdatingSettingsRef to false immediately to avoid loop
             // But we should probably retry eventually or let user retry by changing settings
          }
          
          isUpdatingSettingsRef.current = false;
      };
      
      const timer = setTimeout(updateRoomSettings, 500);
      return () => clearTimeout(timer);
  }, [selectedGameId, gameSettings, isHost, roomId, isPrivateMode]);

  // Choosing another game starts from that game's own defaults: settings with the
  // same name (rounds, time) no longer carry over from the game chosen before.
  const settingsGameRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedGameId || selectedGameId === '__placeholder__' || !isHost) return;
    const game = gamesList.find(g => g.id === selectedGameId);
    if (!game) return;
    const switched = settingsGameRef.current !== null && settingsGameRef.current !== selectedGameId;
    settingsGameRef.current = selectedGameId;
    const base: Record<string, any> = switched
      ? Object.fromEntries(Object.entries(gameSettings).filter(([k]) => k === 'isPrivate' || k === 'banned'))
      : { ...gameSettings };
    let hasChanges = switched;
    game.settings.forEach(s => {
      if (base[s.id] === undefined) {
        base[s.id] = s.default as any;
        hasChanges = true;
      }
    });
    if (hasChanges) setGameSettings(base as any);
  }, [selectedGameId, isHost, gameSettings]);

  // Realtime can miss the start of a game (phone asleep, background tab): check
  // the room now and then, and follow when it switches to a game.
  const lastStatus = useRef<string | null>(null);
  const seenStartRef = useRef<unknown>(null);
  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.from('rooms').select('id, status, game_type, settings').eq('code', params.code).maybeSingle();
      if (!data) return;
      const playing = data.status === 'in_game' || data.status === 'started';
      const cameBack = new URLSearchParams(window.location.search).get('return') === 'true';
      // Coming back to the lobby ends the game for the whole room: nobody stays in it alone,
      // and choosing the next game can't send anyone into the old one.
      if (lastStatus.current === null && cameBack && playing) {
        await roomDb.from('rooms').update({ status: 'waiting' }).eq('id', data.id);
        await roomDb.from('game_sessions').delete().eq('room_id', data.id);
        lastStatus.current = 'waiting';
        return;
      }
      // Each start stamps the settings: only a new stamp is a new game (picking a game is not).
      const stamp = (data.settings as any)?.startedAt ?? null;
      const signature = `${data.status}:${stamp ?? ''}`;
      const was = lastStatus.current;
      lastStatus.current = signature;
      if (stamp !== null) seenStartRef.current = stamp;
      if (!playing || stamp === null || !data.game_type || data.game_type === '__placeholder__') return;
      if (was === null ? cameBack : was === signature) return;
      router.push(`/games/${data.game_type}/${params.code}`);
    };
    void check();
    const onVisible = () => { if (document.visibilityState === 'visible') void check(); };
    document.addEventListener('visibilitychange', onVisible);
    const t = setInterval(check, 5000);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisible); };
  }, [params.code, router]);

  const handleSettingChange = (settingId: string, value: any) => {
    setGameSettings(prev => {
        const next = { ...prev, [settingId]: value };
        return next;
    });
  };

  const startGame = async () => {
    if (!selectedGameId || selectedGameId === '__placeholder__' || !roomId) return;

    vibrate(HAPTIC.HEAVY);

    // Check if game is coming soon
    const gameInfo = gamesList.find(g => g.id === selectedGameId);
    if (gameInfo?.comingSoon) {
        toast.info("Ce jeu arrive bientôt !");
        return;
    }

    // Min players check
    const minPlayersMap: Record<string, number> = {
        'pokeguessr': 1,
        'flagguessr': 1,
        'infiltre': 4,
        'undercover': 3,
        'drawguessr': 2,
        'budgetguessr': 1,
        'rentguessr': 1,
        'logoguessr': 1,
        'jaugeguessr': 2,
        'wikiracing': 1,
        ...partyMinPlayers,
    };

    const minRequired = minPlayersMap[selectedGameId] || 1;
    if (players.length < minRequired) {
        toast.error(`Il faut au moins ${minRequired} joueur${minRequired > 1 ? 's' : ''} pour lancer ce jeu.`);
        return;
    }

    // 1. Create/Update Session FIRST with initial state
    const sessionPayload = {
        room_id: roomId,
        status: 'round_active', // Start directly
        current_round: 1,
        total_rounds: Number(gameSettings['rounds'] || 5), // Default fallback
        answers: {},
        // We initialize round_data as empty, the game component will fetch/generate its first round
        // OR we should trigger generation here?
        // Better: let the game component handle "setup" phase if round_data is empty.
        // But the user says: "state containing the first question".
        // Generating question here requires game-specific logic which is hard to centralize.
        // COMPROMISE: We set status to 'setup' so game component knows to generate immediately.
        round_data: { phase: 'setup', startTime: Date.now() } 
    };

    const { error: sessionError } = await roomDb
        .from('game_sessions')
        .upsert(sessionPayload, { onConflict: 'room_id' });

    if (sessionError) {
        console.error('Failed to create game session:', sessionError);
        return; // Don't redirect if session creation failed
    }

    // 2. Update Room status
    await roomDb.from('rooms').update({
        status: 'in_game',
        game_type: selectedGameId,
        // Stamp of this start: players who missed the live update still see a new game began.
        settings: { ...gameSettings, startedAt: Date.now() }
    }).eq('id', roomId);
    
    // 3. Construct URL
    const paramsUrl = new URLSearchParams();
    
    // Flatten settings for URL
    if (gameSettings) {
        Object.entries(gameSettings).forEach(([k, v]) => {
            if (v !== '' && v !== undefined && v !== null) {
                if (Array.isArray(v)) {
                    paramsUrl.set(k, v.join(','));
                } else {
                    paramsUrl.set(k, String(v));
                }
            }
        });
    }
    
    const queryString = paramsUrl.toString();
    const targetUrl = `/games/${selectedGameId}/${params.code}${queryString ? `?${queryString}` : ''}`;

    // 4. Force redirect
    router.push(targetUrl);
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(params.code);
    setCopied(true);
    vibrate(HAPTIC.SOFT);
    setTimeout(() => setCopied(false), 2000);
  };

  const kickPlayer = async (playerIdToKick: string, playerName: string) => {
    if (!isHost || !roomId) return;

    vibrate(HAPTIC.WARNING);

    const currentBanned = Array.isArray(gameSettings.banned) ? gameSettings.banned : [];
    const newBanned = [...currentBanned, playerName, playerIdToKick];
    const newSettings = { ...gameSettings, banned: newBanned };

    // Update local state immediately so we don't have to wait for F5
    setPlayers(prev => prev.filter(p => p.id !== playerIdToKick));
    
    // Update room settings FIRST so the kicked player gets the real-time update
    setGameSettings(newSettings);
    await roomDb.from('rooms').update({ settings: newSettings }).eq('id', roomId);
    
    // Then delete player from DB
    await roomDb.from('players').delete().eq('id', playerIdToKick);
    
    toast.success(`${playerName} a été exclu.`);
  };

  const leaveRoom = async () => {
    vibrate(HAPTIC.SOFT);
    // Supprimer le joueur de la DB
    if (roomId && playerName) {
        await roomDb.from('players').delete().match({ room_id: roomId, name: playerName });

        // Check remaining players; if we were the host, hand off host to
        // someone else immediately instead of leaving the room headless
        // until the 5-minute inactivity check kicks in.
        const { data: remaining } = await supabase.from('players').select('*').eq('room_id', roomId);
        if (!remaining || remaining.length === 0) {
            await roomDb.from('rooms').delete().eq('id', roomId);
        } else if (isHost) {
            const nextHost = remaining[0];
            await roomDb.from('players').update({ is_host: true }).eq('id', nextHost.id);
            await roomDb.from('rooms').update({ host_id: nextHost.id }).eq('id', roomId);
        }
    }
    sessionStorage.removeItem('playerName');
    sessionStorage.removeItem('isHost');
    sessionStorage.removeItem('playerId');
    forgetSeat(params.code);
    try { localStorage.removeItem('itollec_last_room'); } catch {}
    router.push('/');
  };

  const getHostName = () => {
    const host = players.find(p => p.isHost);
    return host ? host.name : 'l\'hôte';
  };

  const handlePseudoSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!pseudoInput.trim()) return;

    const finalPseudo = pseudoInput.trim();
    sessionStorage.setItem('playerName', finalPseudo);
    setPlayerName(finalPseudo);
    setShowPseudoModal(false);
    // Trigger re-run of room logic
    window.location.reload(); 
  };

  if (showPseudoModal) {
      return (
          <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-4">
              <div className="w-full max-w-md bg-brand-card border-4 border-brand-border rounded-[22px] p-6 shadow-brutal animate-in fade-in zoom-in duration-300">
                  <div className="flex justify-center mb-6">
                      <div className="bg-brand-inner border-[3px] border-brand-border p-4 rounded-xl">
                          <Users className="w-12 h-12 text-tx-base" />
                      </div>
                  </div>
                  <h1 className="font-display text-2xl font-bold text-center text-tx-base mb-2">Rejoindre la partie</h1>
                  <p className="text-center text-tx-secondary mb-8 text-sm">
                      Entrez un pseudo pour rejoindre la salle <span className="font-mono font-bold text-tx-base bg-brand-inner border-[3px] border-brand-border px-2 py-0.5 rounded-md ml-1">{params.code}</span>
                  </p>
                  
                  <form onSubmit={handlePseudoSubmit} className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold tracking-widest uppercase text-tx-secondary mb-2">Votre Pseudo</label>
                          <input 
                              value={pseudoInput}
                              onChange={(e) => setPseudoInput(e.target.value)}
                              placeholder="Ex: PikaPika"
                              className="w-full h-12 rounded-lg bg-brand-inner border-[3px] border-brand-border px-4 text-tx-base placeholder:text-tx-muted focus:outline-none focus:border-accent-primary transition-colors"
                              autoFocus
                          />
                      </div>
                      <button 
                          type="submit" 
                          disabled={!pseudoInput.trim()}
                          className={cn(BRAWL.yellow, "w-full h-14 text-xl mt-2")}
                      >
                          Rejoindre
                      </button>
                  </form>
              </div>
          </div>
      );
  }

  if (isKicked) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-4 text-center space-y-6">
        <div className="w-24 h-24 rounded-2xl bg-brand-inner border-4 border-accent-secondary shadow-brutal flex items-center justify-center animate-bounce">
            <X className="w-12 h-12 text-accent-secondary" />
        </div>
        <h1 className="font-display text-4xl text-tx-base">Vous avez été exclu</h1>
        <p className="text-tx-secondary text-lg max-w-md">
          L&apos;hôte vous a exclu de ce salon. Vous allez être redirigé vers l&apos;accueil.
        </p>
      </div>
    );
  }

  if (isRoomDeleted) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-4 text-center space-y-6">
        <LogOut className="w-24 h-24 text-tx-base animate-bounce" />
        <h1 className="font-display text-4xl text-tx-base">Cette salle n&apos;existe plus</h1>
        <p className="text-tx-secondary text-lg max-w-md">
          L&apos;hôte a quitté ou la salle a été supprimée.
        </p>
        <button 
          onClick={() => router.push('/')} 
          className={cn(BRAWL.yellow, "h-14 px-8 text-xl")}
        >
          Retour à l&apos;accueil
        </button>
      </div>
    );
  }

  if (showJoinOverlay) {
    return (
      <div className="fixed inset-0 z-[100] bg-brand-bg/95 backdrop-blur-sm flex items-center justify-center p-8">
          <button 
              onClick={() => setShowJoinOverlay(false)}
              className="absolute top-8 right-8 text-tx-secondary hover:text-tx-base transition-colors"
          >
              <LogOut className="w-10 h-10" />
          </button>

          <div className="flex flex-col items-center justify-center gap-10 animate-in fade-in zoom-in duration-300">
              <div className="relative inline-flex items-center justify-center bg-white p-[12px] border-4 border-brand-border rounded-[22px] shadow-brutal">
                  <div className="rounded-md overflow-hidden" ref={qrRef} />
              </div>

              <div className="w-full max-w-md space-y-3">
                  <p className="text-sm font-bold text-tx-secondary text-center uppercase tracking-widest">Lien de partage</p>
                  <div className="flex items-center gap-3 bg-brand-card border-4 border-brand-border rounded-2xl p-2 shadow-brutal">
                      <span className="flex-1 text-sm text-tx-secondary truncate font-mono px-3">
                          {typeof window !== 'undefined' ? `${window.location.origin}/room/${params.code}?source=link` : ''}
                      </span>
                      <button 
                          onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/room/${params.code}?source=link`);
                              toast.success('Lien copié !');
                          }}
                          className="h-10 w-10 shrink-0 flex items-center justify-center rounded-lg border-[3px] border-brand-border bg-brand-inner text-tx-base hover:bg-[#333A80] transition-colors"
                      >
                          <Copy className="w-5 h-5" />
                      </button>
                  </div>
              </div>

              <div className="flex items-center justify-center gap-4">
                  <span className="text-xl font-bold text-tx-secondary uppercase tracking-widest">Code :</span>
                  <span className="font-mono text-5xl font-black tracking-widest text-tx-base">
                      {params.code}
                  </span>
              </div>
          </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-transparent text-tx-base px-3 sm:px-6 pt-3 sm:pt-5 pb-10 font-sans flex flex-col animate-in fade-in duration-300">
        <div className="relative z-10 w-full max-w-7xl mx-auto flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div className="h-12 w-40 rounded-xl bg-brand-inner border-[3px] border-brand-border animate-pulse" />
            <div className="h-12 w-32 rounded-xl bg-brand-inner border-[3px] border-brand-border animate-pulse" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 flex-1 min-h-0">
            <div className="lg:col-span-8 flex flex-col gap-6 min-h-0">
              <div className="bg-brand-card border-4 border-brand-border rounded-[22px] p-6 shadow-brutal flex flex-col">
                <div className="h-8 w-48 rounded-lg bg-brand-inner animate-pulse mb-6" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-16 rounded-xl bg-brand-inner border-[3px] border-brand-border animate-pulse" />
                  ))}
                </div>
              </div>
            </div>
            <div className="lg:col-span-4 h-full flex flex-col">
              <div className="bg-brand-card border-4 border-brand-border rounded-[22px] p-6 h-[400px] lg:h-full flex flex-col shadow-brutal">
                <div className="h-8 w-32 rounded-lg bg-brand-inner animate-pulse mb-6" />
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-16 rounded-xl bg-brand-inner border-[3px] border-brand-border animate-pulse" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] overflow-hidden bg-transparent text-tx-base px-3 sm:px-6 pt-3 pb-3 font-sans selection:bg-tx-base/30 flex flex-col">
      <div className="relative z-10 w-full max-w-7xl mx-auto flex-1 min-h-0 flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between gap-2 mb-3 shrink-0">
            <div className="flex min-w-0 items-center gap-2 sm:gap-4">
                <button
                    onClick={leaveRoom}
                    aria-label="Quitter le salon"
                    className={cn(BRAWL.pink, "h-11 w-11 shrink-0 sm:h-12 sm:w-12")}
                >
                    <LogOut className="h-5 w-5" />
                </button>
                <h1 className="font-display text-xl min-[400px]:text-2xl sm:text-4xl leading-none whitespace-nowrap">
                    Salon de jeu
                </h1>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                {!isPrivateMode && (
                    <button 
                        onClick={() => setShowJoinOverlay(true)}
                        className={cn(BRAWL.blue, "hidden sm:inline-flex h-12 px-4 text-lg")}
                    >
                        <Share2 className="w-5 h-5" />
                        <span>Partage</span>
                    </button>
                )}

                <button 
                    onClick={togglePrivateMode}
                    className={cn(
                        isPrivateMode ? BRAWL.yellow : BRAWL.dark,
                        "h-11 px-3 text-lg sm:h-12 sm:px-4"
                    )}
                    title={isPrivateMode ? "Désactiver le mode privé" : "Activer le mode privé (masque les codes)"}
                    disabled={!isHost}
                >
                    {isPrivateMode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    <span className="hidden lg:inline">{isPrivateMode ? 'Privé' : 'Public'}</span>
                </button>

                <div 
                    className="h-11 sm:h-12 flex items-center gap-3 bg-brand-bg border-[3px] border-brand-border px-2 sm:px-3 rounded-2xl cursor-pointer shadow-[0_4px_0_#05061A] active:translate-y-[3px] transition-transform group"
                    onClick={() => {
                        navigator.clipboard.writeText(params.code);
                        toast.success('Code copié !');
                    }}
                    title={isPrivateMode ? "Code masqué (cliquez pour copier)" : "Copier le code"}
                >
                    <span className="hidden sm:inline text-xs text-tx-secondary uppercase tracking-widest font-bold">Code</span>
                    <span className="font-display text-lg sm:text-2xl text-accent-primary transition-colors">
                        {isPrivateMode ? '••••••' : params.code}
                    </span>
                    {copied ? <CheckCircle className="h-5 w-5 text-accent-success" /> : <Copy className="h-5 w-5 text-tx-base group-hover:scale-110 transition-transform" />}
                </div>
            </div>
        </header>

        <RoomLobby
          games={gamesList}
          selectedGameId={selectedGameId}
          onSelectGame={(id) => setSelectedGameId(id)}
          isHost={isHost}
          settings={gameSettings}
          onSettingChange={handleSettingChange}
          onStart={startGame}
          players={players}
          onKick={kickPlayer}
        />
      </div>
    </div>
  );
}
