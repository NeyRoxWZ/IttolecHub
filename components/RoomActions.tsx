'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { X, Users, UserPlus } from 'lucide-react';

interface RoomActionsProps {
  onCreateRoom: (playerName: string) => void;
  onJoinRoom: (playerName: string, roomCode: string) => void;
}

export function RoomActions({ onCreateRoom, onJoinRoom }: RoomActionsProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');

  const handleCreate = () => {
    if (playerName.trim()) {
      onCreateRoom(playerName.trim());
      setShowCreate(false);
      setPlayerName('');
    }
  };

  const handleJoin = () => {
    if (playerName.trim() && roomCode.trim()) {
      onJoinRoom(playerName.trim(), roomCode.trim().toUpperCase());
      setShowJoin(false);
      setPlayerName('');
      setRoomCode('');
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={() => setShowCreate(true)}
        className="rounded-xl bg-green-600 hover:bg-green-700 text-white"
      >
        <UserPlus className="h-4 w-4 mr-2" />
        Créer une room
      </Button>

      <Button
        onClick={() => setShowJoin(true)}
        className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
      >
        <Users className="h-4 w-4 mr-2" />
        Rejoindre une room
      </Button>

      {/* Modal Créer */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 min-h-screen min-w-full overflow-y-auto">
          <div className="flex items-center justify-center w-full min-h-[100dvh] py-8">
            <Card className="p-6 rounded-2xl max-w-md w-full shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">
                Créer une room
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreate(false)}
                className="rounded-lg p-1"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Ton pseudo
                </label>
                <Input
                  type="text"
                  placeholder="Entre ton pseudo..."
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="rounded-xl"
                  onKeyPress={(e) => e.key === 'Enter' && handleCreate()}
                />
              </div>

              <Button
                onClick={handleCreate}
                disabled={!playerName.trim()}
                className="w-full rounded-xl bg-green-600 hover:bg-green-700 text-white"
              >
                Créer la room
              </Button>
            </div>
          </Card>
          </div>
        </div>
      )}

      {/* Modal Rejoindre */}
      {showJoin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 min-h-screen min-w-full overflow-y-auto">
          <div className="flex items-center justify-center w-full min-h-[100dvh] py-8">
            <Card className="p-6 rounded-2xl max-w-md w-full shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">
                Rejoindre une room
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowJoin(false)}
                className="rounded-lg p-1"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Ton pseudo
                </label>
                <Input
                  type="text"
                  placeholder="Entre ton pseudo..."
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="rounded-xl"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Code de la room
                </label>
                <Input
                  type="text"
                  placeholder="Ex: ABC123"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  className="rounded-xl"
                  onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
                />
              </div>

              <Button
                onClick={handleJoin}
                disabled={!playerName.trim() || !roomCode.trim()}
                className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
              >
                Rejoindre la room
              </Button>
            </div>
          </Card>
          </div>
        </div>
      )}
    </div>
  );
}