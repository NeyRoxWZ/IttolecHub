'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
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
    id: 'airbnbguessr',
    name: 'AirbnbGuessr',
    description: 'Le prix d\'une nuit de rêve.',
    icon: Home, // Placeholder, should be MapPin
    color: 'from-rose-500 to-pink-600',
    settings: [
      { id: 'rounds', label: 'Manches', type: 'number', default: 5 },
      { id: 'time', label: 'Temps par manche (s)', type: 'number', default: 30 },
    ],
    comingSoon: true
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

export default function RoomPage({ params }: { params: { code: string } }) {
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

  // Handle QR Code styling
  useEffect(() => {
    if (showJoinOverlay && qrRef.current && typeof window !== 'undefined') {
      qrRef.current.innerHTML = ''; // Clear previous
      
      const qrCode = new QRCodeStyling({
        width: 320,
        height: 320,
        data: `https://itollechub.vercel.app/room/${params.code}?source=qrcode`,
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
      
      if (roomId) {
          await supabase.from('rooms').update({
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
    // Check for QR Code join or stored session
    const storedName = sessionStorage.getItem('playerName');
    const searchParams = new URLSearchParams(window.location.search);
    const isSharedJoin = searchParams.get('source') === 'qrcode' || searchParams.get('source') === 'link';
    
    if (!storedName) {
        if (isSharedJoin) {
            setShowPseudoModal(true);
            return;
        } else {
            // Normal redirect if no session and not a shared link
            router.push('/');
            return;
        }
    }
    
    setPlayerName(storedName);

    const initRoom = async () => {
      try {
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
          const searchParams = new URLSearchParams(window.location.search);
          const isHostParam = searchParams.get('host') === 'true';
          
          if (isHostParam) {
              // Create room if it doesn't exist and we are host
              const { data: newRoom, error: createError } = await supabase
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
          
          const { data: newPlayer, error: createError } = await supabase
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
               await supabase.from('rooms').update({ host_id: newPlayer.id }).eq('id', room.id);
            }
          }
        } else {
           // Si le joueur existe, on vérifie s'il est host selon la room
           // Par sécurité, si room.host_id correspond à ce joueur, on s'assure que is_host est true
           if (room.host_id === existingPlayer.id || room.host_id === existingPlayer.name) {
               isCurrentHost = true;
               if (!existingPlayer.is_host) {
                   await supabase.from('players').update({ is_host: true }).eq('id', existingPlayer.id);
               }
           } else if (existingPlayer.is_host) {
               // Fallback: Player marked as host in players table but maybe not synced to room table
               isCurrentHost = true;
           }
        }

        setIsHost(isCurrentHost);
        sessionStorage.setItem('isHost', String(isCurrentHost));
        if (currentPlayerId) sessionStorage.setItem('playerId', currentPlayerId);

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
      }
    };

    initRoom();
  }, [params.code, router]);

  // Presence System (Heartbeat & Inactivity)
  useEffect(() => {
    if (!roomId) return;
    const currentPayloadId = sessionStorage.getItem('playerId');

    // 1. Heartbeat (every 30s)
    const sendHeartbeat = async () => {
        if (currentPayloadId) {
            await supabase.from('players').update({ last_seen_at: new Date().toISOString() }).eq('id', currentPayloadId);
        }
    };
    sendHeartbeat();
    const hbInterval = setInterval(sendHeartbeat, 30000);

    // 2. Inactivity Check (every 60s)
    const checkActivity = async () => {
        if (isHostRef.current) {
            // Host cleans up inactive players (> 5 min)
            const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
            await supabase.from('players').delete().eq('room_id', roomId).lt('last_seen_at', fiveMinAgo);
            
            // Si le host est le seul restant et qu'il est inactif ? Le host envoie des heartbeats.
            // Mais on peut revérifier le compte total de joueurs
            const { count } = await supabase.from('players').select('*', { count: 'exact', head: true }).eq('room_id', roomId);
            if (count === 0) {
                await supabase.from('rooms').delete().eq('id', roomId);
            }
        } else {
            // Clients check if Host is inactive
            const host = playersRef.current.find(p => p.isHost);
            if (host && host.last_seen_at) {
                const lastSeen = new Date(host.last_seen_at).getTime();
                // If host inactive > 5m30s
                if (Date.now() - lastSeen > 330000) {
                     // Supprimer la room si l'hôte a disparu
                     await supabase.from('rooms').delete().eq('id', roomId);
                }
            }
        }
    };
    const checkInterval = setInterval(checkActivity, 60000);

    return () => {
        clearInterval(hbInterval);
        clearInterval(checkInterval);
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

          // Redirection si la partie commence
          if (newRoom.status === 'in_game' || newRoom.status === 'started') {
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
          
          const { error } = await supabase.from('rooms').update({
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

  useEffect(() => {
    if (selectedGameId && selectedGameId !== '__placeholder__') {
      const game = gamesList.find(g => g.id === selectedGameId);
      if (game && isHost) {
          // Initialize defaults ONLY if they are missing
          const newSettings = { ...gameSettings };
          let hasChanges = false;
          
          game.settings.forEach(s => {
              if (newSettings[s.id] === undefined) {
                  newSettings[s.id] = s.default as any;
                  hasChanges = true;
              }
          });
          
          if (hasChanges) {
              setGameSettings(newSettings);
          }
      }
    }
  }, [selectedGameId, isHost, gameSettings]);

  const handleSettingChange = (settingId: string, value: any) => {
    setGameSettings(prev => {
        const next = { ...prev, [settingId]: value };
        return next;
    });
  };

  const startGame = async () => {
    if (!selectedGameId || selectedGameId === '__placeholder__' || !roomId) return;
    
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
        'wikiracing': 1
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

    const { error: sessionError } = await supabase
        .from('game_sessions')
        .upsert(sessionPayload, { onConflict: 'room_id' });

    if (sessionError) {
        console.error('Failed to create game session:', sessionError);
        return; // Don't redirect if session creation failed
    }

    // 2. Update Room status
    await supabase.from('rooms').update({
        status: 'in_game',
        game_type: selectedGameId,
        settings: gameSettings
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
    setTimeout(() => setCopied(false), 2000);
  };

  const kickPlayer = async (playerIdToKick: string, playerName: string) => {
    if (!isHost || !roomId) return;
    
    const currentBanned = Array.isArray(gameSettings.banned) ? gameSettings.banned : [];
    const newBanned = [...currentBanned, playerName, playerIdToKick];
    const newSettings = { ...gameSettings, banned: newBanned };
    
    // Update local state immediately so we don't have to wait for F5
    setPlayers(prev => prev.filter(p => p.id !== playerIdToKick));
    
    // Update room settings FIRST so the kicked player gets the real-time update
    setGameSettings(newSettings);
    await supabase.from('rooms').update({ settings: newSettings }).eq('id', roomId);
    
    // Then delete player from DB
    await supabase.from('players').delete().eq('id', playerIdToKick);
    
    toast.success(`${playerName} a été exclu.`);
  };

  const leaveRoom = async () => {
    // Supprimer le joueur de la DB
    if (roomId && playerName) {
        await supabase.from('players').delete().match({ room_id: roomId, name: playerName });
        
        // Check if we were the last player
        const { count } = await supabase.from('players').select('*', { count: 'exact', head: true }).eq('room_id', roomId);
        if (count === 0) {
            await supabase.from('rooms').delete().eq('id', roomId);
        }
    }
    sessionStorage.removeItem('playerName');
    sessionStorage.removeItem('isHost');
    sessionStorage.removeItem('playerId');
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
              <div className="w-full max-w-md bg-brand-card border-4 border-brand-border rounded-[32px] p-6 shadow-brutal animate-in fade-in zoom-in duration-300">
                  <div className="flex justify-center mb-6">
                      <div className="bg-brand-inner border-2 border-brand-border p-4 rounded-xl">
                          <Users className="w-12 h-12 text-tx-base" />
                      </div>
                  </div>
                  <h1 className="font-display text-2xl font-bold text-center text-tx-base mb-2">Rejoindre la partie</h1>
                  <p className="text-center text-tx-secondary mb-8 text-sm">
                      Entrez un pseudo pour rejoindre la salle <span className="font-mono font-bold text-tx-base bg-brand-inner border-2 border-brand-border px-2 py-0.5 rounded-md ml-1">{params.code}</span>
                  </p>
                  
                  <form onSubmit={handlePseudoSubmit} className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold tracking-widest uppercase text-tx-secondary mb-2">Votre Pseudo</label>
                          <input 
                              value={pseudoInput}
                              onChange={(e) => setPseudoInput(e.target.value)}
                              placeholder="Ex: PikaPika"
                              className="w-full h-12 rounded-lg bg-brand-inner border-2 border-brand-border px-4 text-tx-base placeholder:text-tx-muted focus:outline-none focus:border-tx-base transition-colors"
                              autoFocus
                          />
                      </div>
                      <button 
                          type="submit" 
                          disabled={!pseudoInput.trim()}
                          className={cn(
                              "w-full h-14 rounded-lg font-display font-black tracking-wider transition-colors border-2 mt-2",
                              pseudoInput.trim() ? "bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base" : "opacity-50 cursor-not-allowed bg-brand-inner text-tx-base border-brand-border"
                          )}
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
        <h1 className="font-display text-4xl font-black text-tx-base">Vous avez été exclu</h1>
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
        <h1 className="font-display text-4xl font-black text-tx-base">Cette salle n&apos;existe plus</h1>
        <p className="text-tx-secondary text-lg max-w-md">
          L&apos;hôte a quitté ou la salle a été supprimée.
        </p>
        <button 
          onClick={() => router.push('/')} 
          className="h-14 px-8 rounded-lg font-display font-black tracking-wider border-2 border-brand-border bg-brand-inner text-tx-base hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
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
              <div className="relative inline-flex items-center justify-center bg-white p-[12px] border-4 border-brand-border rounded-[24px] shadow-brutal">
                  <div className="rounded-[12px] overflow-hidden" ref={qrRef} />
              </div>

              <div className="w-full max-w-md space-y-3">
                  <p className="text-sm font-bold text-tx-secondary text-center uppercase tracking-widest">Lien de partage</p>
                  <div className="flex items-center gap-3 bg-brand-card border-4 border-brand-border rounded-2xl p-2 shadow-brutal">
                      <span className="flex-1 text-sm text-tx-secondary truncate font-mono px-3">
                          {typeof window !== 'undefined' ? `https://itollechub.vercel.app/room/${params.code}?source=link` : ''}
                      </span>
                      <button 
                          onClick={() => {
                              navigator.clipboard.writeText(`https://itollechub.vercel.app/room/${params.code}?source=link`);
                              toast.success('Lien copié !');
                          }}
                          className="h-10 w-10 shrink-0 flex items-center justify-center rounded-lg border-2 border-brand-border bg-brand-inner text-tx-base hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
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

  return (
    <div className="min-h-screen bg-transparent text-tx-base p-4 sm:p-6 font-sans selection:bg-tx-base/30 flex flex-col">
      <div className="relative z-10 w-full max-w-6xl mx-auto flex-1 flex flex-col">
        
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
                <button 
                    onClick={leaveRoom} 
                    className="h-12 w-12 flex items-center justify-center rounded-xl border-2 border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base hover:border-tx-base transition-colors"
                >
                    <LogOut className="h-5 w-5" />
                </button>
                <h1 className="font-display text-2xl font-black leading-none mt-1">
                    Salon de jeu
                </h1>
            </div>

            <div className="flex items-center gap-3">
                {!isPrivateMode && (
                    <button 
                        onClick={() => setShowJoinOverlay(true)}
                        className="hidden sm:flex items-center gap-2 h-12 px-4 rounded-xl border-2 border-brand-border bg-brand-inner text-tx-base hover:border-tx-base shadow-brutal transition-all"
                    >
                        <Share2 className="w-5 h-5" />
                        <span className="font-bold">Partage</span>
                    </button>
                )}

                <button 
                    onClick={togglePrivateMode}
                    className={cn(
                        "flex items-center gap-2 h-12 px-4 rounded-xl border-2 transition-all font-bold",
                        isPrivateMode 
                        ? "border-tx-base bg-tx-base text-brand-bg shadow-brutal" 
                        : "border-brand-border bg-brand-inner text-tx-base hover:border-tx-base shadow-brutal"
                    )}
                    title={isPrivateMode ? "Désactiver le mode privé" : "Activer le mode privé (masque les codes)"}
                    disabled={!isHost}
                >
                    {isPrivateMode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    <span className="hidden lg:inline">{isPrivateMode ? 'Privé' : 'Public'}</span>
                </button>

                <div 
                    className="h-12 flex items-center gap-3 bg-brand-inner border-2 border-brand-border px-4 rounded-xl cursor-pointer hover:border-tx-base shadow-brutal transition-all group"
                    onClick={() => {
                        navigator.clipboard.writeText(params.code);
                        toast.success('Code copié !');
                    }}
                    title={isPrivateMode ? "Code masqué (cliquez pour copier)" : "Copier le code"}
                >
                    <span className="hidden sm:inline text-xs text-tx-secondary uppercase tracking-widest font-bold">Code</span>
                    <span className="font-mono text-lg font-black tracking-widest text-tx-base transition-colors">
                        {isPrivateMode ? '••••••' : params.code}
                    </span>
                    {copied ? <CheckCircle className="h-5 w-5 text-tx-base" /> : <Copy className="h-5 w-5 text-tx-base group-hover:scale-110 transition-transform" />}
                </div>
            </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 flex-1 min-h-0">
          
          {/* LEFT: Game Configuration */}
          <div className="lg:col-span-8 flex flex-col gap-6 min-h-0">
            
            {/* Game Selection Card */}
            <div className="bg-brand-card border-4 border-brand-border rounded-[32px] p-6 shadow-brutal flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-lg border-2 border-brand-border bg-brand-inner">
                        <Gamepad2 className="h-6 w-6 text-tx-base" />
                    </div>
                    <h2 className="font-display text-2xl font-bold">Choix du jeu</h2>
                </div>

                {isHost ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto custom-scrollbar pr-2 max-h-[300px] lg:max-h-none">
                        {gamesList.map((game) => {
                            const isSelected = selectedGameId === game.id;
                            const Icon = game.icon;
                            const isComingSoon = (game as any).comingSoon;
                            
                            return (
                                <div 
                                    key={game.id}
                                    onClick={() => {
                                        if (isComingSoon) {
                                            toast.info("Ce jeu arrive bientôt !");
                                            return;
                                        }
                                        setSelectedGameId(game.id);
                                    }}
                                    className={cn(
                                        "cursor-pointer rounded-xl border-2 transition-all p-3 flex items-center gap-3",
                                        isComingSoon && "opacity-50 cursor-not-allowed",
                                        isSelected 
                                            ? "border-tx-base bg-brand-inner shadow-brutal" 
                                            : "border-brand-border bg-brand-card hover:border-tx-base/50"
                                    )}
                                >
                                    <Icon className={cn("h-8 w-8 shrink-0", isSelected ? "text-tx-base" : "text-tx-secondary")} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <h3 className="font-bold text-tx-base truncate">{game.name}</h3>
                                            {isComingSoon && (
                                                <span className="shrink-0 text-[9px] font-black uppercase tracking-wider bg-brand-inner border border-brand-border px-1.5 py-0.5 rounded">
                                                    Bientôt
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-tx-secondary truncate mt-0.5">{game.description}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex-1 bg-brand-inner border-2 border-brand-border rounded-xl p-8 flex items-center justify-center text-center">
                        {selectedGame ? (
                            <div className="flex flex-col items-center gap-4 animate-in zoom-in duration-300">
                                <selectedGame.icon className="h-16 w-16 text-tx-base" />
                                <div>
                                    <h3 className="font-display text-3xl font-black mb-2">{selectedGame.name}</h3>
                                    <p className="text-tx-secondary font-medium">{selectedGame.description}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-4 text-tx-secondary">
                                <Settings className="h-12 w-12 animate-spin-slow opacity-50" />
                                <p className="font-bold">L&apos;hôte choisit un jeu...</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Settings Card */}
            {selectedGame && (
                <div className="bg-brand-card border-4 border-brand-border rounded-[32px] p-6 shadow-brutal flex flex-col flex-1 min-h-0 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg border-2 border-brand-border bg-brand-inner">
                                <Settings className="h-6 w-6 text-tx-base" />
                            </div>
                            <h2 className="font-display text-xl font-bold">Paramètres</h2>
                        </div>
                        {!isHost && (
                            <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-brand-inner border-2 border-brand-border text-tx-secondary">
                                Paramètres synchronisés
                            </span>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {selectedGame.settings.map((setting) => (
                                <div key={setting.id} className="space-y-2">
                                    <label className="text-xs font-bold text-tx-secondary uppercase tracking-widest ml-1">
                                        {setting.label}
                                    </label>
                                    
                                    {isHost ? (
                                        <div className="relative">
                                            {setting.type === 'number' && (
                                                <input
                                                    type="number"
                                                    value={String(gameSettings[setting.id] ?? setting.default)}
                                                    onChange={(e) => handleSettingChange(setting.id, e.target.value === '' ? setting.default : Number(e.target.value))}
                                                    className="w-full h-12 bg-brand-inner border-2 border-brand-border text-tx-base rounded-lg px-4 focus:outline-none focus:border-tx-base transition-colors"
                                                />
                                            )}
                                            {setting.type === 'text' && (
                                                <input
                                                    type="text"
                                                    value={String(gameSettings[setting.id] ?? setting.default)}
                                                    onChange={(e) => handleSettingChange(setting.id, e.target.value)}
                                                    className="w-full h-12 bg-brand-inner border-2 border-brand-border text-tx-base rounded-lg px-4 focus:outline-none focus:border-tx-base transition-colors"
                                                />
                                            )}
                                            {setting.type === 'select' && setting.options && (
                                                <Select
                                                    value={String(gameSettings[setting.id] ?? setting.default)}
                                                    onValueChange={(v) => handleSettingChange(setting.id, v)}
                                                >
                                                    <SelectTrigger className="w-full h-12 bg-brand-inner border-2 border-brand-border text-tx-base rounded-lg px-4 focus:ring-0 focus:border-tx-base font-bold">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-brand-card border-4 border-brand-border rounded-xl shadow-brutal text-tx-base font-bold">
                                                        {setting.options.map((opt) => (
                                                            <SelectItem 
                                                                key={opt.value} 
                                                                value={opt.value} 
                                                                disabled={opt.disabled}
                                                                className={cn(
                                                                    "focus:bg-brand-inner cursor-pointer rounded-lg mx-1 my-1",
                                                                    opt.disabled && "opacity-40 cursor-not-allowed"
                                                                )}
                                                            >
                                                                {opt.label} {opt.disabled && '(Bientôt)'}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                            {setting.type === 'multiselect' && setting.options && (
                                                <div className="flex flex-wrap gap-2 bg-brand-inner p-2 rounded-lg border-2 border-brand-border min-h-[48px]">
                                                    {setting.options.map((opt) => {
                                                        const currentVal = gameSettings[setting.id];
                                                        const current = Array.isArray(currentVal) ? currentVal : (setting.default as any[]);
                                                        const isSelected = Array.isArray(current) && current.includes(Number(opt.value));
                                                        
                                                        return (
                                                            <button
                                                                key={opt.value}
                                                                disabled={opt.disabled}
                                                                onClick={() => {
                                                                    if (opt.disabled) return;
                                                                    const val = Number(opt.value);
                                                                    let newVal;
                                                                    if (isSelected) {
                                                                        newVal = current.filter((x: any) => x !== val);
                                                                        if (newVal.length === 0) newVal = [1];
                                                                    } else {
                                                                        newVal = [...current, val];
                                                                    }
                                                                    handleSettingChange(setting.id, newVal);
                                                                }}
                                                                className={cn(
                                                                    "px-3 py-1.5 text-xs font-bold rounded-md border-2 transition-all",
                                                                    opt.disabled ? "opacity-40 cursor-not-allowed border-brand-border bg-brand-card text-tx-muted" :
                                                                    isSelected 
                                                                        ? "border-tx-base bg-tx-base text-brand-bg" 
                                                                        : "border-brand-border bg-brand-card text-tx-secondary hover:text-tx-base hover:border-tx-base/50"
                                                                )}
                                                            >
                                                                {opt.label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="h-12 flex items-center px-4 bg-brand-inner border-2 border-brand-border rounded-lg text-tx-base font-bold truncate">
                                            {setting.type === 'select' && setting.options 
                                                ? setting.options.find(o => o.value === String(gameSettings[setting.id] ?? setting.default))?.label 
                                                : setting.type === 'multiselect'
                                                    ? (Array.isArray(gameSettings[setting.id]) ? (gameSettings[setting.id] as unknown as any[]).join(', ') : String(setting.default))
                                                    : (gameSettings[setting.id] ?? setting.default)
                                            }
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {isHost && (
                        <div className="mt-6 pt-6 border-t-2 border-brand-border shrink-0">
                            <button
                                onClick={startGame}
                                className="w-full h-14 rounded-lg font-display font-black tracking-wider transition-colors border-2 border-brand-border bg-brand-inner text-tx-base hover:bg-tx-base hover:text-brand-bg hover:border-tx-base flex items-center justify-center gap-3"
                            >
                                <Play className="w-5 h-5 fill-current" />
                                LANCER LA PARTIE
                            </button>
                        </div>
                    )}
                </div>
            )}
          </div>

          {/* RIGHT: Players List */}
          <div className="lg:col-span-4 h-full flex flex-col">
            <div className="bg-brand-card border-4 border-brand-border rounded-[32px] p-6 h-[400px] lg:h-full flex flex-col shadow-brutal">
                <div className="flex items-center justify-between mb-6 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg border-2 border-brand-border bg-brand-inner text-tx-base">
                            <Users className="h-6 w-6" />
                        </div>
                        <h2 className="font-display text-2xl font-bold">Joueurs</h2>
                    </div>
                    <span className="bg-brand-inner border-2 border-brand-border px-3 py-1 rounded-lg text-sm font-black">
                        {players.length}
                    </span>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                    {players.map((player) => (
                        <div 
                            key={player.id} 
                            className="group flex items-center justify-between p-3 rounded-xl border-2 border-brand-border bg-brand-inner hover:border-tx-base transition-all"
                        >
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className={cn(
                                    "h-10 w-10 rounded-md border-2 flex items-center justify-center text-sm font-display font-black shrink-0",
                                    player.isHost 
                                    ? "border-tx-base bg-brand-card text-tx-base shadow-brutal" 
                                    : "border-brand-border bg-brand-card text-tx-secondary group-hover:text-tx-base"
                                )}>
                                    {player.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex flex-col truncate">
                                    <span className={cn(
                                        "font-bold truncate",
                                        player.isHost ? "text-tx-base" : "text-tx-secondary group-hover:text-tx-base"
                                    )}>
                                        {player.name}
                                    </span>
                                    {player.isHost && (
                                        <span className="text-[10px] uppercase tracking-widest font-black text-tx-base opacity-70">
                                            Hôte
                                        </span>
                                    )}
                                </div>
                            </div>
                            {isHost && !player.isHost && (
                                <button 
                                    onClick={() => kickPlayer(player.id, player.name)}
                                    className="opacity-0 group-hover:opacity-100 p-2 rounded-lg border-2 border-transparent hover:border-accent-secondary hover:bg-accent-secondary/10 text-tx-secondary hover:text-accent-secondary transition-all"
                                    title="Exclure ce joueur"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
