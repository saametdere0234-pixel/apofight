"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { ref, onValue, push, set, remove } from 'firebase/database';
import { useLocalPlayer } from '@/hooks/use-local-player';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, Users, ArrowRight, Home, LayoutGrid, ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { GameRoom, WeaponClass } from '@/lib/game-types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

const WeaponIcon = ({ weapon, className = "w-8 h-8" }: { weapon: WeaponClass; className?: string }) => {
  const baseClasses = "font-headline flex items-center justify-center select-none leading-none";
  if (weapon === 'Sword') {
    return (
      <div className={cn(baseClasses, className, "text-yellow-400")} style={{ textShadow: '2px 2px 0px black' }}>
        S
      </div>
    );
  }
  if (weapon === 'Dagger') {
    return (
      <div className={cn(baseClasses, className, "text-purple-500")} style={{ textShadow: '2px 2px 0px black' }}>
        D
      </div>
    );
  }
  if (weapon === 'Bow') {
    return (
      <div className={cn(baseClasses, className, "text-white")} style={{ textShadow: '2px 2px 0px black' }}>
        B
      </div>
    );
  }
  return null;
};

export default function LobbyScreen() {
  const { profile, loading: profileLoading } = useLocalPlayer();
  const [rooms, setRooms] = useState<Record<string, GameRoom>>({});
  const [newRoomName, setNewRoomName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const router = useRouter();

  useEffect(() => {
    if (!db) return;
    const roomsRef = ref(db, 'rooms');
    const unsubscribe = onValue(roomsRef, (snapshot) => {
      const allRooms = snapshot.val() || {};
      setRooms(allRooms);

      // Automatic Room Deletion Logic (Reaper)
      Object.entries(allRooms).forEach(([id, room]: [string, any]) => {
        const playerCount = Object.keys(room.players || {}).length;
        const timeSinceUpdate = Date.now() - (room.lastUpdate || 0);
        
        if (playerCount === 0 && timeSinceUpdate > 10000) {
          remove(ref(db, `rooms/${id}`));
        }
      });
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
      createdBy: profile.id,
      status: 'lobby',
      currentRound: 1,
      lastUpdate: Date.now(),
      maxPlayers: maxPlayers,
      players: {}
    };
    await set(newRoomRef, room);
    router.push(`/game/${newRoomRef.key}`);
  };

  if (profileLoading || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a2e] p-4 md:p-8 flex flex-col items-center relative overflow-hidden">
      <div className="scanline"></div>
      
      <div className="w-full max-w-5xl space-y-10 relative z-20">
        {!db && (
          <Alert variant="destructive" className="cartoon-card bg-destructive/20 border-black mb-10">
            <ShieldAlert className="h-6 w-6 text-destructive" />
            <AlertTitle className="font-headline text-2xl text-destructive">SYSTEM ERROR</AlertTitle>
            <AlertDescription className="font-bold uppercase text-xs">
              FIREBASE CONFIGURATION MISSING. MULTIPLAYER IS CURRENTLY OFFLINE.
            </AlertDescription>
          </Alert>
        )}
        
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="space-y-1 text-center md:text-left">
            <h2 className="text-5xl md:text-6xl font-headline text-primary">LOBBY CENTER</h2>
            <p className="text-white/40 text-xs font-bold uppercase tracking-[0.3em]">SELECT YOUR COMBAT ZONE</p>
          </div>
          
          <div className="flex items-center gap-6 bg-black/40 backdrop-blur-md p-3 rounded-[25px] border-4 border-black px-8">
            <div className="p-2 bg-black/40 rounded-xl border-2 border-white/10 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
              <WeaponIcon weapon={profile.weaponClass} className="w-10 h-10 text-3xl" />
            </div>
            <div className="flex flex-col items-start">
              <span className="text-[10px] font-bold text-white/40 uppercase">WARRIOR</span>
              <span className="font-headline text-xl text-accent">{profile.name || 'ANON'}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="cartoon-button bg-white/10 p-2 ml-4">
              <Home className="w-6 h-6 text-white" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          <div className="md:col-span-4 h-fit sticky top-8">
            <Card className="cartoon-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-headline text-2xl text-accent">
                  <Plus className="w-6 h-6" />
                  NEW ARENA
                </CardTitle>
                <CardDescription className="font-bold text-white/50 uppercase text-xs">INITIALIZE A COMBAT SESSION</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">DESIGNATION</label>
                  <Input 
                    placeholder="E.G. NEO TOKYO..." 
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    className="bg-black/20 border-4 border-black rounded-[15px] h-12 font-bold"
                    disabled={!db}
                  />
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">MAX PLAYERS</label>
                    <span className="font-headline text-xl text-primary">{maxPlayers}</span>
                  </div>
                  <Slider 
                    value={[maxPlayers]} 
                    onValueChange={(v) => setMaxPlayers(v[0])}
                    min={2} 
                    max={6} 
                    step={1}
                    className="py-4"
                  />
                </div>

                <Button className="cartoon-button bg-primary text-white w-full h-14 text-xl" onClick={createRoom} disabled={!newRoomName.trim() || !db}>
                  BUILD ARENA
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-8 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-3xl font-headline flex items-center gap-3">
                <LayoutGrid className="w-8 h-8 text-primary" />
                ACTIVE ZONES
              </h3>
              <span className="font-headline text-sm bg-black/40 border-2 border-white/10 px-4 py-1 rounded-full text-white/60">
                {Object.keys(rooms).length} ONLINE
              </span>
            </div>

            {Object.keys(rooms).length === 0 ? (
              <div className="flex flex-col items-center justify-center p-20 cartoon-card bg-black/20 border-dashed opacity-50">
                <Users className="w-20 h-20 text-white/10 mb-6" />
                <p className="font-headline text-2xl text-white/20 uppercase">
                  NO BATTLES FOUND
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {Object.values(rooms).map((room) => {
                  const playerCount = Object.keys(room.players || {}).length;
                  const isFull = playerCount >= (room.maxPlayers || 4);
                  const hostName = room.players?.[room.createdBy]?.name || 'Unknown';
                  const isLocked = room.status === 'playing' || room.status === 'starting';
                  const alreadyIn = room.players?.[profile.id];
                  
                  return (
                    <Card key={room.id} className={`cartoon-card hover:border-primary transition-opacity ${isFull ? 'opacity-90' : ''}`}>
                      <CardContent className="p-6 flex items-center justify-between">
                        <div className="space-y-2">
                          <div className="flex items-baseline gap-3">
                            <h4 className="text-3xl font-headline text-white group-hover:text-primary">
                              {room.name}
                            </h4>
                            <span className="text-xs font-bold text-white/40 uppercase tracking-tight flex items-center gap-1">
                              host:{hostName}
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 bg-black/20 px-3 py-1 rounded-full border-2 border-black text-[10px] font-bold text-white/60 uppercase">
                              <Users className="w-3 h-3" />
                              {playerCount} / {room.maxPlayers || 4}
                            </div>
                            {isFull ? (
                              <span className="px-4 py-1 rounded-full border-2 border-black text-[10px] font-headline uppercase bg-black text-destructive font-bold">
                                FULL
                              </span>
                            ) : (
                              <span className={`px-4 py-1 rounded-full border-2 border-black text-[10px] font-headline uppercase ${isLocked ? 'bg-orange-500 text-white' : 'bg-primary text-white'}`}>
                                {room.status}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button 
                          onClick={() => router.push(`/game/${room.id}`)}
                          disabled={(isFull || isLocked) && !alreadyIn}
                          className={`cartoon-button w-16 h-16 rounded-full ${(isFull || isLocked) && !alreadyIn ? 'bg-zinc-800 opacity-50' : 'bg-accent text-black'}`}
                        >
                          {(isFull || isLocked) && !alreadyIn ? <ShieldAlert className="w-8 h-8" /> : <ArrowRight className="w-10 h-10" />}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}