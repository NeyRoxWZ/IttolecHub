'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Users, Gamepad2, Copy, Globe, DollarSign, PenTool, Zap, Shield, EyeOff, Settings, Play, LogOut, CheckCircle, Home, QrCode, Eye, Monitor } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import QRCode from 'react-qr-code';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/Dialog';

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
  options?: { value: string; label: string }[];
}

const gamesList: { id: string; name: string; description: string; icon: any; color: string; settings: GameSetting[]; comingSoon?: boolean }[] = [
  {
    id: 'wikiguessr',
    name: 'WikiGuessr',
    description: 'Explorez Wikipédia à l\'aveugle.',
    icon: Globe,
    color: 'from-gray-500 to-slate-600',
    settings: [
      { id: 'rounds', label: 'Manches', type: 'number', default: 5 },
      { id: 'time', label: 'Temps par manche (s)', type: 'number', default: 60 },
      { 
        id: 'category', 
        label: 'Thème', 
        type: 'select', 
        default: 'all',
        options: [
          { value: 'all', label: 'Aléatoire' },
          { value: 'Personnages', label: 'Célébrités' },
          { value: 'Géographie', label: 'Lieux & Pays' },
          { value: 'Sciences', label: 'Sciences' },
          { value: 'Culture', label: 'Art & Culture' },
        ]
      },
    ],
  },
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
        label: 'Rayon', 
        type: 'select', 
        default: 'all',
        options: [
          { value: 'all', label: 'Tout le magasin' },
          { value: 'High-Tech', label: 'High-Tech' },
          { value: 'Maison', label: 'Maison & Déco' },
          { value: 'Luxe', label: 'Luxe & Mode' },
          { value: 'Alimentation', label: 'Supermarché' },
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
        default: 'mix',
        options: [
          { value: 'mix', label: 'Mix' },
          { value: 'easy', label: 'Facile' },
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
];

export default function RoomPage({ params }: { params: { code: string } }) {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerName, setPlayerName] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState<string>('__placeholder__');
  const [gameSettings, setGameSettings] = useState<Record<string, string | number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isCodeVisible, setIsCodeVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isRoomDeleted, setIsRoomDeleted] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [streamerMode, setStreamerMode] = useState(false); // Mode confidentialité persistant
  const [showJoinOverlay, setShowJoinOverlay] = useState(false); // Overlay QR Code
  const [showPseudoModal, setShowPseudoModal] = useState(false);
  const [pseudoInput, setPseudoInput] = useState('');
  
  // Refs for interval access
  const playersRef = useRef(players);
  const isHostRef = useRef(isHost);

  useEffect(() => {
    playersRef.current = players;
    isHostRef.current = isHost;
  }, [players, isHost]);

  const selectedGame = useMemo(() => selectedGameId && selectedGameId !== '__placeholder__' ? gamesList.find(g => g.id === selectedGameId) : undefined, [selectedGameId]);

  // Load Streamer Privacy Mode from LocalStorage
  useEffect(() => {
      const stored = localStorage.getItem('ittolechub_streamer_mode');
      if (stored === 'true') {
          setStreamerMode(true);
          setIsCodeVisible(false); // Hide code by default if streamer mode is on
      }
  }, []);

  const toggleStreamerMode = () => {
      const newState = !streamerMode;
      setStreamerMode(newState);
      localStorage.setItem('ittolechub_streamer_mode', String(newState));
      
      if (newState) {
          setIsCodeVisible(false);
          toast.success("Mode Streamer (Confidentialité) activé");
      } else {
          toast.success("Mode Streamer désactivé");
      }
  };

  // Initialisation et gestion de la room/joueur via Supabase
  useEffect(() => {
    // Check for QR Code join or stored session
    const storedName = sessionStorage.getItem('playerName');
    const searchParams = new URLSearchParams(window.location.search);
    const isQrJoin = searchParams.get('source') === 'qrcode';
    
    if (!storedName) {
        if (isQrJoin) {
            setShowPseudoModal(true);
            return;
        } else {
            // Normal redirect if no session and not QR
            router.push('/');
            return;
        }
    }
    
    setPlayerName(storedName);

    const initRoom = async () => {
      try {
        // 1. Récupérer la room
        const { data: room, error: roomError } = await supabase
          .from('rooms')
          .select('*')
          .eq('code', params.code)
          .maybeSingle();

        if (roomError || !room) {
          setIsRoomDeleted(true);
          return;
        }

        // Redirection immédiate si la partie est déjà en cours
        if (room.status === 'in_game' || room.status === 'started') {
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
          setPlayers(currentPlayers.map(p => ({
            id: p.id,
            name: p.name,
            isHost: p.is_host,
            score: p.score || 0,
            last_seen_at: p.last_seen_at
          })));
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
            // Host cleans up inactive players (> 2 min)
            const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
            await supabase.from('players').delete().eq('room_id', roomId).lt('last_seen_at', twoMinAgo);
        } else {
            // Clients check if Host is inactive
            const host = playersRef.current.find(p => p.isHost);
            if (host && host.last_seen_at) {
                const lastSeen = new Date(host.last_seen_at).getTime();
                // If host inactive > 2m30s
                if (Date.now() - lastSeen > 150000) {
                     console.log("Host inactive, closing room...");
                     // Check current status first to avoid spam
                     const { data: currentRoom } = await supabase.from('rooms').select('status').eq('id', roomId).maybeSingle();
                     if (currentRoom && currentRoom.status !== 'closed') {
                         await supabase.from('rooms').update({ status: 'closed' }).eq('id', roomId);
                     }
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
            setPlayers(currentPlayers.map(p => ({
              id: p.id,
              name: p.name,
              isHost: p.is_host,
              score: p.score || 0,
              last_seen_at: p.last_seen_at
            })));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          const newRoom = payload.new as any;
          // Synchronisation des settings pour les non-hosts
          if (newRoom.game_type) setSelectedGameId(newRoom.game_type);
          if (newRoom.settings) setGameSettings(newRoom.settings);

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
          
          console.log('Updating room settings:', { game_type: selectedGameId, settings: gameSettings });
          const { error } = await supabase.from('rooms').update({
              game_type: selectedGameId,
              settings: gameSettings || {} // Ensure not undefined
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
  }, [selectedGameId, gameSettings, isHost, roomId]);

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
  }, [selectedGameId, isHost]);

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
    
    console.log('Redirecting to:', targetUrl);
    
    // 4. Force redirect
    router.push(targetUrl);
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(params.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const leaveRoom = async () => {
    // Supprimer le joueur de la DB
    if (roomId && playerName) {
        await supabase.from('players').delete().match({ room_id: roomId, name: playerName });
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
          <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
              <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl animate-in zoom-in duration-300">
                  <div className="flex justify-center mb-6">
                      <div className="bg-indigo-500/10 p-4 rounded-full">
                          <Users className="w-12 h-12 text-indigo-500" />
                      </div>
                  </div>
                  <h1 className="text-2xl font-bold text-center text-white mb-2">Rejoindre la partie</h1>
                  <p className="text-center text-slate-400 mb-8">Entrez un pseudo pour rejoindre la salle <span className="font-mono text-white bg-slate-800 px-2 py-0.5 rounded">{params.code}</span></p>
                  
                  <form onSubmit={handlePseudoSubmit} className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">Votre Pseudo</label>
                          <Input 
                              value={pseudoInput}
                              onChange={(e) => setPseudoInput(e.target.value)}
                              placeholder="Ex: PikaPika"
                              className="bg-slate-800 border-slate-700 text-white h-12 text-lg focus:ring-indigo-500"
                              autoFocus
                          />
                      </div>
                      <Button 
                          type="submit" 
                          disabled={!pseudoInput.trim()}
                          className="w-full h-12 text-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                      >
                          Rejoindre
                      </Button>
                  </form>
              </div>
          </div>
      );
  }

  if (isRoomDeleted) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center space-y-6">
        <LogOut className="w-24 h-24 text-red-500 animate-bounce" />
        <h1 className="text-4xl font-black text-white">Cette salle n'existe plus</h1>
        <p className="text-slate-400 text-lg max-w-md">
          L'hôte a quitté ou la salle a été supprimée.
        </p>
        <Button onClick={() => router.push('/')} size="lg" className="bg-slate-800 hover:bg-slate-700">
          Retour à l'accueil
        </Button>
      </div>
    );
  }

  if (showJoinOverlay) {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
          {/* Close Button */}
          <button 
              onClick={() => setShowJoinOverlay(false)}
              className="absolute top-8 right-8 text-slate-500 hover:text-white transition-colors"
          >
              <LogOut className="w-8 h-8 rotate-180" />
          </button>

          <div className="text-center space-y-12 animate-in fade-in zoom-in duration-500">
              <h1 className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-br from-indigo-400 to-purple-600 tracking-tighter mb-8">
                  IttolecHub
              </h1>

              <div className="relative inline-block bg-white p-6 rounded-[2.5rem] shadow-2xl">
                  <QRCode 
                      value={`${window.location.origin}/room/${params.code}?source=qrcode`}
                      size={300}
                      fgColor="#000000"
                      bgColor="transparent"
                  />
              </div>

              <div className="space-y-4">
                  <h2 className="text-4xl font-bold text-white uppercase tracking-widest">
                      Rejoignez la partie !
                  </h2>
                  <div className="flex items-center justify-center gap-4 text-3xl text-slate-400 font-mono">
                      <span>Code :</span>
                      <span className="bg-slate-800 px-6 py-3 rounded-xl text-white border border-slate-700 font-black tracking-widest">
                          {params.code}
                      </span>
                  </div>
              </div>
          </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 font-sans selection:bg-indigo-500/30">
      
      {/* Background Gradients */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[120px] animate-pulse-slow delay-1000" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        
        {/* Header */}
        <header className="flex items-center justify-between mb-8 sm:mb-12">
            <div className="flex items-center gap-3">
                <Button 
                    onClick={leaveRoom} 
                    variant="ghost" 
                    className="rounded-full h-10 w-10 p-0 hover:bg-white/10 text-slate-400 hover:text-white"
                >
                    <LogOut className="h-5 w-5" />
                </Button>
                <div className="flex flex-col">
                    <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
                        Salon de jeu
                    </h1>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        En ligne
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3">
                {/* Join Overlay Button (Hidden in Privacy Mode) */}
                {isHost && !streamerMode && (
                    <Button 
                        onClick={() => setShowJoinOverlay(true)}
                        variant="ghost"
                        className="hidden sm:flex items-center gap-2 h-12 px-4 rounded-xl text-purple-400 hover:text-purple-300 hover:bg-purple-900/20 transition-all border border-transparent hover:border-purple-500/20"
                    >
                        <Users className="w-5 h-5" />
                        <span className="hidden md:inline font-bold">Rejoindre</span>
                    </Button>
                )}

                {/* Privacy Mode Toggle */}
                <Button 
                    onClick={toggleStreamerMode}
                    variant="ghost"
                    className={`flex items-center gap-2 h-12 px-4 rounded-xl transition-all border ${
                        streamerMode 
                        ? 'text-indigo-400 bg-indigo-900/20 border-indigo-500/30 hover:bg-indigo-900/30' 
                        : 'text-slate-400 hover:text-white bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
                    }`}
                    title={streamerMode ? "Désactiver le mode confidentialité" : "Activer le mode confidentialité (masque les codes)"}
                >
                    {streamerMode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    <span className="hidden lg:inline font-medium">{streamerMode ? 'Privé' : 'Public'}</span>
                </Button>

                {/* QR Code Dialog (Hidden in Privacy Mode) */}
                {!streamerMode && (
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="ghost" className="h-12 w-12 p-0 rounded-xl text-slate-400 hover:text-white bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all">
                                <QrCode className="w-5 h-5" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-900 border-none aspect-square">
                        <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">Scanner pour rejoindre</h2>
                        <div className="p-4 bg-white rounded-xl shadow-lg aspect-square flex items-center justify-center w-full">
                            <QRCode 
                                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/room/${params.code}?source=qrcode`}
                                size={256}
                                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                viewBox={`0 0 256 256`}
                            />
                        </div>
                        <p className="mt-6 text-slate-500 dark:text-slate-400 font-mono text-xl tracking-widest">
                            {params.code}
                        </p>
                    </DialogContent>
                    </Dialog>
                )}

                <div 
                    className="h-12 flex items-center gap-3 bg-white/5 border border-white/10 px-5 rounded-xl cursor-pointer hover:bg-white/10 hover:border-white/20 transition-all group"
                    onClick={copyRoomCode}
                    title={streamerMode ? "Code masqué (cliquez pour copier)" : "Copier le code"}
                >
                    <span className="text-xs text-slate-400 uppercase tracking-widest font-bold">Code</span>
                    <span className="font-mono text-lg font-bold tracking-widest text-white group-hover:text-indigo-300 transition-colors">
                        {streamerMode ? '••••••' : params.code}
                    </span>
                    {copied ? <CheckCircle className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4 text-slate-500 group-hover:text-white" />}
                </div>
            </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          
          {/* LEFT: Game Configuration (Host) or Info (Client) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Game Selection Card */}
            <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-6 lg:p-8">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 rounded-xl bg-indigo-500/20 text-indigo-400">
                        <Gamepad2 className="h-6 w-6" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Choix du jeu</h2>
                </div>

                {isHost ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                    className={`cursor-pointer relative overflow-hidden rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02] ${
                                        isComingSoon ? 'opacity-60 cursor-not-allowed' : ''
                                    } ${
                                        isSelected 
                                        ? 'border-indigo-500 bg-indigo-500/10' 
                                        : 'border-white/5 bg-white/5 hover:border-white/20 hover:bg-white/10'
                                    }`}
                                >
                                    {isComingSoon && (
                                        <div className="absolute top-2 right-2 bg-slate-900 text-slate-400 text-[10px] font-bold px-2 py-1 rounded-full border border-slate-700 z-10">
                                            BIENTÔT
                                        </div>
                                    )}
                                    <div className="p-4 flex items-center gap-4">
                                        <div className={`p-3 rounded-xl bg-gradient-to-br ${game.color}`}>
                                            <Icon className="h-6 w-6 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white">{game.name}</h3>
                                            <p className="text-xs text-slate-400 line-clamp-1">{game.description}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="bg-white/5 rounded-2xl p-8 text-center border border-white/10">
                        {selectedGame ? (
                            <div className="flex flex-col items-center gap-4 animate-in zoom-in duration-300">
                                <div className={`p-6 rounded-3xl bg-gradient-to-br ${selectedGame.color}`}>
                                    <selectedGame.icon className="h-12 w-12 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-3xl font-bold text-white mb-2">{selectedGame.name}</h3>
                                    <p className="text-slate-400 max-w-md mx-auto">{selectedGame.description}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-4 text-slate-500 py-8">
                                <div className="animate-spin-slow">
                                    <Settings className="h-12 w-12 opacity-20" />
                                </div>
                                <p>L'hôte choisit un jeu...</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Settings Card */}
            {selectedGame && (
                <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-6 lg:p-8 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-xl bg-pink-500/20 text-pink-400">
                                <Settings className="h-6 w-6" />
                            </div>
                            <h2 className="text-xl font-bold text-white">Paramètres</h2>
                        </div>
                        {!isHost && (
                            <span className="text-xs font-medium px-3 py-1 rounded-full bg-white/10 text-slate-400 border border-white/5">
                                Synchronisé avec l'hôte
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {selectedGame.settings.map((setting) => (
                            <div key={setting.id} className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                                    {setting.label}
                                </label>
                                
                                {isHost ? (
                                    <div className="relative">
                                        {setting.type === 'number' && (
                                            <Input
                                                type="number"
                                                value={String(gameSettings[setting.id] ?? setting.default)}
                                                onChange={(e) => handleSettingChange(setting.id, e.target.value === '' ? setting.default : Number(e.target.value))}
                                                className="bg-slate-950 border-white/10 text-white rounded-xl h-12 focus:ring-indigo-500 focus:border-indigo-500"
                                            />
                                        )}
                                        {setting.type === 'text' && (
                                            <Input
                                                type="text"
                                                value={String(gameSettings[setting.id] ?? setting.default)}
                                                onChange={(e) => handleSettingChange(setting.id, e.target.value)}
                                                className="bg-slate-950 border-white/10 text-white rounded-xl h-12"
                                            />
                                        )}
                                        {setting.type === 'select' && setting.options && (
                                            <Select
                                                value={String(gameSettings[setting.id] ?? setting.default)}
                                                onValueChange={(v) => handleSettingChange(setting.id, v)}
                                            >
                                                <SelectTrigger className="bg-slate-950 border-white/10 text-white rounded-xl h-12">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-slate-900 border-white/10 text-white">
                                                    {setting.options.map((opt) => (
                                                        <SelectItem key={opt.value} value={opt.value} className="focus:bg-white/10 cursor-pointer">
                                                            {opt.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                        {setting.type === 'multiselect' && setting.options && (
                                            <div className="flex flex-wrap gap-2 bg-slate-950 p-2 rounded-xl border border-white/10 min-h-[48px]">
                                                {setting.options.map((opt) => {
                                                    const currentVal = gameSettings[setting.id];
                                                    const current = Array.isArray(currentVal) ? currentVal : (setting.default as any[]);
                                                    const isSelected = Array.isArray(current) && current.includes(Number(opt.value));
                                                    
                                                    return (
                                                        <button
                                                            key={opt.value}
                                                            onClick={() => {
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
                                                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                                                                isSelected 
                                                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                                                                : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                                                            }`}
                                                        >
                                                            {opt.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="h-12 flex items-center px-4 bg-white/5 border border-white/5 rounded-xl text-white font-medium">
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

                    {isHost && (
                        <div className="mt-8 pt-6 border-t border-white/10">
                            <Button
                                onClick={startGame}
                                className="w-full h-14 text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl shadow-xl shadow-indigo-500/20 transition-all hover:scale-[1.02] hover:shadow-indigo-500/30"
                            >
                                <Play className="w-5 h-5 mr-2 fill-current" /> Lancer la partie
                            </Button>
                        </div>
                    )}
                </div>
            )}
          </div>

          {/* RIGHT: Players List */}
          <div className="lg:col-span-4 h-full">
            <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-6 h-full min-h-[400px] flex flex-col shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-green-500/20 text-green-400">
                            <Users className="h-6 w-6" />
                        </div>
                        <h2 className="text-xl font-bold text-white">Joueurs</h2>
                    </div>
                    <span className="bg-white/10 px-3 py-1 rounded-full text-sm font-bold text-white">
                        {players.length}
                    </span>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                    {players.map((player) => (
                        <div 
                            key={player.id} 
                            className="group flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all hover:translate-x-1"
                        >
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-black shadow-lg ${
                                    player.isHost 
                                    ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white' 
                                    : 'bg-slate-800 text-slate-400 group-hover:text-white'
                                }`}>
                                    {player.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex flex-col truncate">
                                    <span className={`font-bold truncate ${player.isHost ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>
                                        {player.name}
                                    </span>
                                    {player.isHost && (
                                        <span className="text-[10px] uppercase tracking-wider font-bold text-indigo-400">
                                            Hôte
                                        </span>
                                    )}
                                </div>
                            </div>
                            
                            {/* Status Indicator (Optional) */}
                            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                        </div>
                    ))}
                    
                    {/* Empty slots placeholders to fill space visually */}
                    {Array.from({ length: Math.max(0, 4 - players.length) }).map((_, i) => (
                        <div key={`empty-${i}`} className="border-2 border-dashed border-white/5 rounded-xl p-3 flex items-center justify-center text-slate-600 text-sm h-[66px]">
                            En attente...
                        </div>
                    ))}
                </div>

                {!isHost && (
                    <div className="mt-6 pt-6 border-t border-white/10 text-center space-y-3">
                        <div className="inline-block p-3 rounded-full bg-indigo-500/10 mb-2">
                            <div className="animate-spin-slow">
                                <Settings className="h-6 w-6 text-indigo-400" />
                            </div>
                        </div>
                        <p className="text-sm text-slate-400">
                            En attente du lancement par <span className="text-white font-bold">{getHostName()}</span>
                        </p>
                    </div>
                )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
