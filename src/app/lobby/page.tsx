"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { ref, onValue, push, set } from 'firebase/database';
import { useLocalPlayer } from '@/hooks/use-local-player';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, Users, ArrowRight, Home, LayoutGrid, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { GameRoom } from '@/lib/game-types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function LobbyScreen() {
  const { profile, loading: profileLoading } = useLocalPlayer();
  const [rooms, setRooms] = useState<Record<string, GameRoom>>({});
  const [newRoomName, setNewRoomName] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (!db) return;
    const roomsRef = ref(db, 'rooms');
    const unsubscribe = onValue(roomsRef, (snapshot) => {
      setRooms(snapshot.val() || {});
    });
    return () => unsubscribe();
  }, []);

  const createRoom = async () => {
    if (!newRoomName.trim() || !profile || !db) return;
    const roomsRef = ref(db, 'rooms');
    const newRoomRef = push(roomsRef);
    const room: Partial<GameRoom> = {
      id: newRoomRef.key!,
      name: newRoomName,
      status: 'lobby',
      currentRound: 1,
      lastUpdate: Date.now(),
    };
    await set(newRoomRef, room);
    router.push(`/game/${newRoomRef.key}`);
  };

  if (profileLoading || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl space-y-8">
        {!db && (
          <Alert variant="destructive" className="mb-6 bg-destructive/10 border-destructive/20 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="font-headline font-bold uppercase tracking-tight">Firebase Offline</AlertTitle>
            <AlertDescription className="text-sm">
              Real-time database configuration is missing. Please check your .env file to enable multiplayer features.
            </AlertDescription>
          </Alert>
        )}
        
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <h2 className="text-3xl font-headline font-bold text-primary">COMMAND CENTER</h2>
            <p className="text-muted-foreground text-sm uppercase tracking-tighter">Available Combat Zones</p>
          </div>
          <div className="flex items-center gap-4 bg-secondary/30 p-2 rounded-full border px-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">ID:</span>
              <span className="font-bold text-accent">{profile.name || 'Anonymous'}</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Medals:</span>
              <span className="font-bold text-yellow-500">{profile.medals}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
              <Home className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="md:col-span-1 h-fit bg-card/40 backdrop-blur border-primary/20 sticky top-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-accent" />
                Initialize Arena
              </CardTitle>
              <CardDescription>Create a new combat session</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase">Arena Designation</label>
                <Input 
                  placeholder="e.g. Neo Tokyo District..." 
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="bg-background/40"
                  disabled={!db}
                />
              </div>
              <Button className="w-full font-headline font-bold" onClick={createRoom} disabled={!newRoomName.trim() || !db}>
                {db ? 'CREATE ROOM' : 'CONFIG MISSING'}
              </Button>
            </CardContent>
          </Card>

          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-headline font-bold flex items-center gap-2">
                <LayoutGrid className="w-5 h-5 text-accent" />
                Live Zones
              </h3>
              <span className="text-xs font-bold text-muted-foreground bg-secondary/50 px-2 py-1 rounded">
                {Object.keys(rooms).length} ACTIVE
              </span>
            </div>

            {Object.keys(rooms).length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-2xl border-muted bg-card/20 text-center">
                <Users className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
                <p className="text-muted-foreground">
                  {db ? "No active combat zones found. Start one above." : "Database connection required to view active zones."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {Object.values(rooms).map((room) => (
                  <Card key={room.id} className="bg-card/40 hover:bg-card/60 transition-all border-accent/10 group">
                    <CardContent className="p-6 flex items-center justify-between">
                      <div className="space-y-1">
                        <h4 className="text-xl font-headline font-bold text-foreground group-hover:text-accent transition-colors">
                          {room.name}
                        </h4>
                        <div className="flex items-center gap-4 text-xs font-bold uppercase text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {Object.keys(room.players || {}).length} / 4 Players
                          </span>
                          <span className="px-2 py-0.5 rounded bg-accent/20 text-accent">
                            {room.status}
                          </span>
                        </div>
                      </div>
                      <Button 
                        onClick={() => router.push(`/game/${room.id}`)}
                        className="rounded-full w-12 h-12 p-0 flex items-center justify-center hover:scale-110 transition-transform"
                        variant="secondary"
                      >
                        <ArrowRight className="w-6 h-6" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
