
"use client";

import { useState, useEffect, useMemo } from 'react';
import { db, auth } from '@/lib/firebase';
import { ref, onValue, push, set, remove } from 'firebase/database';
import { signOut } from 'firebase/auth';
import { useLocalPlayer } from '@/hooks/use-local-player';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, Users, ArrowRight, Home, LayoutGrid, ShieldAlert, LogOut, Wallet, Fingerprint, Zap, Search, Swords } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { GameRoom, WeaponClass } from '@/lib/game-types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FriendsSidebar } from '@/components/FriendsSidebar';

const WeaponIcon = ({ weapon, className = "w-8 h-8" }: { weapon: WeaponClass; className?: string }) => {
  const baseClasses = "font-headline flex items-center justify-center select-none leading-none";
  if (weapon === 'Sword') return <div className={cn(baseClasses, className, "text-yellow-400")} style={{ textShadow: '2px 2px 0px black' }}>S</div>;
  if (weapon === 'Dagger') return <div className={cn(baseClasses, className, "text-purple-500")} style={{ textShadow: '2px 2px 0px black' }}>D</div>;
  if (weapon === 'Bow') return <div className={cn(baseClasses, className, "text-white")} style={{ textShadow: '2px 2px 0px black' }}>B</div>;
  return null;
};

export default function LobbyScreen() {
  const { profile, authUser, loading: profileLoading } = useLocalPlayer();
  const [rooms, setRooms] = useState<Record<string, GameRoom>>({});
  const [newRoomName, setNewRoomName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [isTeamMode, setIsTeamMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [pulseTrigger, setPulseTrigger] = useState(0);
  const router = useRouter();

  useEffect(() => {
    if (!db) return;
    const roomsRef = ref(db, 'rooms');
    const unsubscribe = onValue(roomsRef, (snapshot) => {
      const allRooms = snapshot.val() || {};
      setRooms(allRooms);
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

  const generateShortId = () => {
    let id;
    const existingIds = Object.values(rooms).map(r => r.shortId);
    do {
      id = Math.floor(100000 + Math.random() * 900000).toString();
    } while (existingIds.includes(id));
    return id;
  };

  const createRoom = async () => {
    if (!newRoomName.trim() || !profile || !db) return;
    const roomsRef = ref(db, 'rooms');
    const newRoomRef = push(roomsRef);
    const room: Partial<GameRoom> = {
      id: newRoomRef.key!,
      shortId: generateShortId(),
      name: newRoomName,
      createdBy: profile.id,
      status: 'lobby',
      currentRound: 1,
      lastUpdate: Date.now(),
      maxPlayers: maxPlayers,
      isTeamMode: isTeamMode,
      teamAScore: 0,
      teamBScore: 0,
      players: {}
    };
    await set(newRoomRef, room);
    router.push(`/game/${newRoomRef.key}`);
  };

  const handleQuickMatch = async () => {
    if (!profile || !db) return;
    const joinableRooms = Object.values(rooms).filter(room => {
      const playerCount = room.players ? Object.keys(room.players).length : 0;
      return playerCount < (room.maxPlayers || 4) && room.status === 'lobby';
    });

    if (joinableRooms.length > 0) {
      const randomRoom = joinableRooms[Math.floor(Math.random() * joinableRooms.length)];
      router.push(`/game/${randomRoom.id}`);
    } else {
      const roomsRef = ref(db, 'rooms');
      const newRoomRef = push(roomsRef);
      const room: Partial<GameRoom> = {
        id: newRoomRef.key!,
        shortId: generateShortId(),
        name: profile.name ? `${profile.name}'s Arena` : "New Arena",
        createdBy: profile.id,
        status: 'lobby',
        currentRound: 1,
        lastUpdate: Date.now(),
        maxPlayers: 4,
        isTeamMode: false,
        teamAScore: 0,
        teamBScore: 0,
        players: {}
      };
      await set(newRoomRef, room);
      router.push(`/game/${newRoomRef.key}`);
    }
  };

  const filteredRooms = useMemo(() => {
    const queryStr = activeSearch.toLowerCase();
    return Object.values(rooms).filter(r => 
      r.name.toLowerCase().includes(queryStr) || r.shortId.includes(queryStr)
    );
  }, [rooms, activeSearch]);

  const handleSearch = () => {
    setActiveSearch(searchQuery);
    setPulseTrigger(prev => prev + 1);
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
      
      {authUser && (
        <div className="fixed top-6 left-6 z-[100] animate-in slide-in-from-top-4 fade-in duration-500">
          <Button 
            variant="ghost" 
            onClick={() => router.push('/')} 
            className="cartoon-button bg-white/10 text-white h-12 px-4 gap-2 border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:bg-white/20"
          >
            <Home className="w-5 h-5" />
            <span className="font-headline hidden md:inline">HOME</span>
          </Button>
        </div>
      )}

      {authUser && (
        <div className="fixed top-6 right-6 z-[100] animate-in slide-in-from-top-4 fade-in duration-500">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <div id="user-profile" className="relative flex items-center gap-4 bg-black/60 backdrop-blur-md p-2 pl-4 rounded-full border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] cursor-pointer hover:bg-black/80 transition-colors">
                <span id="user-name" className="font-headline text-lg text-white" style={{ WebkitTextStroke: '1px black' }}>{authUser?.displayName}</span>
                <Avatar className="w-10 h-10 border-2 border-white/20">
                  <AvatarImage id="user-pic" src={authUser?.photoURL || undefined} className="rounded-full" />
                  <AvatarFallback className="bg-primary text-white font-headline text-xs">{authUser?.displayName?.charAt(0)}</AvatarFallback>
                </Avatar>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="cartoon-card bg-black/90 border-4 border-black p-4 min-w-[240px] text-white">
              <DropdownMenuLabel className="font-headline text-xl text-primary mb-2">WARRIOR INFO</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/10" />
              <div className="space-y-4 py-2">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-1">
                    <Swords className="w-3 h-3" /> CURRENT WEAPON
                  </span>
                  <div className="flex items-center gap-2 bg-black/40 p-2 rounded-xl border border-white/10">
                    <WeaponIcon weapon={profile.weaponClass} className="w-6 h-6" />
                    <span className="font-headline text-sm text-white">{profile.weaponClass}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-1">
                    <Fingerprint className="w-3 h-3" /> PLAYER ID
                  </span>
                  <span id="player-id" className="font-headline text-lg text-white">{profile.playerId}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-1">
                    <Wallet className="w-3 h-3" /> GOLD BALANCE
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-yellow-500 rounded-full border-2 border-black" />
                    <span id="gold-currency" className="font-headline text-2xl text-accent">{profile.gold || 0} G</span>
                  </div>
                </div>
              </div>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem id="logout-btn" onClick={() => signOut(auth)} className="mt-2 focus:bg-transparent">
                <Button className="cartoon-button bg-destructive text-white w-full h-10 gap-2"><LogOut className="w-4 h-4" /> LOGOUT</Button>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {authUser && <FriendsSidebar />}
      
      <div className="w-full max-w-5xl space-y-10 relative z-20">
        {!db && (
          <Alert variant="destructive" className="cartoon-card bg-destructive/20 border-black mb-10">
            <ShieldAlert className="h-6 w-6 text-destructive" />
            <AlertTitle className="font-headline text-2xl text-destructive">SYSTEM ERROR</AlertTitle>
            <AlertDescription className="font-bold uppercase text-xs">FIREBASE CONNECTION LOST.</AlertDescription>
          </Alert>
        )}
        
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="space-y-1 text-center md:text-left">
            <h2 className="text-5xl md:text-6xl font-headline text-primary">MAIN LOBBY</h2>
          </div>
          
          {!authUser && (
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
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          <div className="md:col-span-4 h-fit md:sticky md:top-8">
            <Card className="cartoon-card bg-transparent shadow-none border-dashed border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-headline text-2xl text-accent"><Plus className="w-6 h-6" /> NEW ARENA</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">ARENA NAME</label>
                  <Input placeholder="NAME HERE..." value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} className="bg-black/20 border-4 border-black rounded-[15px] h-12 font-bold" />
                </div>
                
                <div className="flex items-center justify-between bg-black/40 p-4 rounded-xl border-2 border-black">
                  <div className="flex flex-col">
                    <Label className="font-headline text-sm text-white">TEAM</Label>
                  </div>
                  <Switch checked={isTeamMode} onCheckedChange={(val) => {
                    setIsTeamMode(val);
                    if (val) {
                      if (maxPlayers < 4) setMaxPlayers(4);
                      else if (maxPlayers === 5) setMaxPlayers(6);
                    }
                  }} />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                      MAX CAPACITY
                    </label>
                    <span className="font-headline text-xl text-primary">
                      {isTeamMode ? (maxPlayers === 4 ? '2V2' : '3V3') : maxPlayers}
                    </span>
                  </div>
                  <Slider 
                    value={[maxPlayers]} 
                    onValueChange={(v) => setMaxPlayers(v[0])} 
                    min={isTeamMode ? 4 : 2} 
                    max={6} 
                    step={isTeamMode ? 2 : 1} 
                    className="py-4" 
                  />
                </div>
                <Button className="cartoon-button bg-primary text-white w-full h-14 text-xl" onClick={createRoom} disabled={!newRoomName.trim() || !db}>CREATE ARENA</Button>
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-8 space-y-6 flex flex-col">
            <div className="relative group flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-primary group-focus-within:text-accent transition-colors" />
                <Input 
                  placeholder="SEARCH ARENA OR 6-DIGIT ID..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-14 bg-black/40 border-4 border-black rounded-[20px] h-14 font-headline text-lg text-white placeholder:text-white/20 focus-visible:ring-primary shadow-[4px_4px_0_rgba(0,0,0,1)]"
                />
              </div>
              <Button onClick={handleSearch} className="cartoon-button bg-primary text-white h-14 px-6 flex items-center gap-2">
                <Search className="w-5 h-5" />
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <h3 className="text-3xl font-headline flex items-center gap-3"><LayoutGrid className="w-8 h-8 text-primary" /> ARENAS</h3>
              <span className="font-headline text-sm bg-black/40 border-2 border-white/10 px-4 py-1 rounded-full text-white/60">{filteredRooms.length} ONLINE</span>
            </div>

            {filteredRooms.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-20 cartoon-card bg-black/20 border-dashed opacity-50">
                <Users className="w-20 h-20 text-white/10 mb-6" />
                <p className="font-headline text-2xl text-white/20 uppercase">NO ARENAS FOUND</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {filteredRooms.map((room) => {
                  const playerCount = Object.keys(room.players || {}).length;
                  const isFull = playerCount >= (room.maxPlayers || 4);
                  const isLocked = room.status === 'playing' || room.status === 'starting';
                  return (
                    <Card key={room.id + pulseTrigger} className={cn(
                      "cartoon-card hover:border-primary transition-all",
                      activeSearch !== '' && "animate-pulse-once"
                    )}>
                      <CardContent className="p-6 flex items-center justify-between">
                        <div className="space-y-2">
                          <div className="flex items-baseline gap-3">
                            <h4 className="text-3xl font-headline text-white">{room.name}</h4>
                            <span className="text-sm font-headline text-primary">#{room.shortId}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 bg-black/20 px-3 py-1 rounded-full border-2 border-black text-[10px] font-bold text-white/60 uppercase">
                              <Users className="w-3 h-3" /> {playerCount} / {room.maxPlayers || 4}
                            </div>
                            {room.isTeamMode && (
                              <div className="flex items-center gap-2 bg-primary/20 px-3 py-1 rounded-full border-2 border-primary text-[10px] font-bold text-primary uppercase">
                                TEAM
                              </div>
                            )}
                            <span className={cn(
                              "px-4 py-1 rounded-full border-2 border-black text-[10px] font-headline uppercase",
                              isFull ? "bg-black text-destructive" : isLocked ? "bg-orange-500 text-white" : "bg-primary text-white"
                            )}>
                              {isFull ? 'FULL' : room.status.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <Button onClick={() => router.push(`/game/${room.id}`)} disabled={isFull || isLocked} className={cn("cartoon-button w-16 h-16 rounded-full", (isFull || isLocked) ? 'bg-zinc-800 opacity-50' : 'bg-accent text-black')}>
                          {(isFull || isLocked) ? <ShieldAlert className="w-8 h-8" /> : <ArrowRight className="w-10 h-10" />}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            <div className="mt-10 flex items-center justify-center gap-4">
              <Button onClick={handleQuickMatch} size="lg" className="cartoon-button bg-accent text-black text-3xl px-12 h-20 flex items-center gap-4 hover:scale-105">
                <Zap className="w-8 h-8 fill-current" /> PLAY
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
