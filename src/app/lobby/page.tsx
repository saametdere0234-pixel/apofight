"use client";

import { useState, useEffect, useMemo } from 'react';
import { db, auth } from '@/lib/firebase';
import { ref, onValue, push, set, remove, query, orderByChild, equalTo, get, update } from 'firebase/database';
import { signOut } from 'firebase/auth';
import { useLocalPlayer } from '@/hooks/use-local-player';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, Users, ArrowRight, Home, LayoutGrid, ShieldAlert, LogOut, Wallet, Fingerprint, Zap, Search, ChevronLeft, ChevronRight, X, Bell, Check, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { GameRoom, WeaponClass, PlayerProfile } from '@/lib/game-types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Slider } from '@/components/ui/slider';
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

const WeaponIcon = ({ weapon, className = "w-8 h-8" }: { weapon: WeaponClass; className?: string }) => {
  const baseClasses = "font-headline flex items-center justify-center select-none leading-none";
  if (weapon === 'Sword') return <div className={cn(baseClasses, className, "text-yellow-400")} style={{ textShadow: '2px 2px 0px black' }}>S</div>;
  if (weapon === 'Dagger') return <div className={cn(baseClasses, className, "text-purple-500")} style={{ textShadow: '2px 2px 0px black' }}>D</div>;
  if (weapon === 'Bow') return <div className={cn(baseClasses, className, "text-white")} style={{ textShadow: '2px 2px 0px black' }}>B</div>;
  return null;
};

export default function LobbyScreen() {
  const { profile, authUser, loading: profileLoading, updateProfile } = useLocalPlayer();
  const [rooms, setRooms] = useState<Record<string, GameRoom>>({});
  const [newRoomName, setNewRoomName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarView, setSidebarView] = useState<'friends' | 'notifications'>('friends');
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [friendIdInput, setFriendIdInput] = useState('');
  const [searchStatus, setSearchStatus] = useState<string | null>(null);
  const [friendsData, setFriendsData] = useState<PlayerProfile[]>([]);
  const [requestsData, setRequestsData] = useState<PlayerProfile[]>([]);
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

  // Fetch Friends Data
  useEffect(() => {
    if (!db || !profile?.friends) {
      setFriendsData([]);
      return;
    }
    const playersRef = ref(db, 'players');
    const friendList = profile.friends;
    
    const unsubscribers = friendList.map(fId => {
      const q = query(playersRef, orderByChild('playerId'), equalTo(fId));
      return onValue(q, (snap) => {
        const data = snap.val();
        if (data) {
          const friend = Object.values(data)[0] as PlayerProfile;
          setFriendsData(prev => {
            const index = prev.findIndex(p => p.playerId === friend.playerId);
            if (index > -1) {
              const next = [...prev];
              next[index] = friend;
              return next;
            }
            return [...prev, friend];
          });
        }
      });
    });
    return () => unsubscribers.forEach(u => u());
  }, [profile?.friends]);

  // Fetch Friend Requests Data
  useEffect(() => {
    if (!db || !profile?.friendRequests) {
      setRequestsData([]);
      return;
    }
    const playersRef = ref(db, 'players');
    const requestList = profile.friendRequests;
    
    const unsubscribers = requestList.map(fId => {
      const q = query(playersRef, orderByChild('playerId'), equalTo(fId));
      return onValue(q, (snap) => {
        const data = snap.val();
        if (data) {
          const sender = Object.values(data)[0] as PlayerProfile;
          setRequestsData(prev => {
            const index = prev.findIndex(p => p.playerId === sender.playerId);
            if (index > -1) {
              const next = [...prev];
              next[index] = sender;
              return next;
            }
            return [...prev, sender];
          });
        }
      });
    });
    return () => unsubscribers.forEach(u => u());
  }, [profile?.friendRequests]);

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
        name: profile.name ? `${profile.name}'s Game` : "New Arena",
        createdBy: profile.id,
        status: 'lobby',
        currentRound: 1,
        lastUpdate: Date.now(),
        maxPlayers: 4,
        players: {}
      };
      await set(newRoomRef, room);
      router.push(`/game/${newRoomRef.key}`);
    }
  };

  const sendFriendRequest = async () => {
    if (!db || !profile || !friendIdInput || friendIdInput.length !== 8) return;
    
    const playersRef = ref(db, 'players');
    const q = query(playersRef, orderByChild('playerId'), equalTo(friendIdInput));
    
    const snap = await get(q);
    if (snap.exists()) {
      const targetData = snap.val();
      const targetId = Object.keys(targetData)[0];
      const targetProfile = Object.values(targetData)[0] as PlayerProfile;
      
      const currentRequests = targetProfile.friendRequests || [];
      if (!currentRequests.includes(profile.playerId!)) {
        await update(ref(db, `players/${targetId}`), {
          friendRequests: [...currentRequests, profile.playerId]
        });
      }
      setSearchStatus('İstek gönderildi');
    } else {
      setSearchStatus('Oyuncu bulunamadı');
    }

    setFriendIdInput('');
    setTimeout(() => setSearchStatus(null), 3000);
  };

  const handleAcceptRequest = async (senderPlayerId: string) => {
    if (!db || !profile) return;
    
    // 1. Get sender's internal ID
    const playersRef = ref(db, 'players');
    const q = query(playersRef, orderByChild('playerId'), equalTo(senderPlayerId));
    const snap = await get(q);
    
    if (snap.exists()) {
      const senderData = snap.val();
      const senderId = Object.keys(senderData)[0];
      const senderProfile = Object.values(senderData)[0] as PlayerProfile;
      
      // 2. Add to both players' friends lists
      const myFriends = profile.friends || [];
      const senderFriends = senderProfile.friends || [];
      
      if (!myFriends.includes(senderPlayerId)) {
        await update(ref(db, `players/${profile.id}`), {
          friends: [...myFriends, senderPlayerId],
          friendRequests: (profile.friendRequests || []).filter(id => id !== senderPlayerId)
        });
      }
      
      if (!senderFriends.includes(profile.playerId!)) {
        await update(ref(db, `players/${senderId}`), {
          friends: [...senderFriends, profile.playerId]
        });
      }
    }
  };

  const handleRejectRequest = async (senderPlayerId: string) => {
    if (!db || !profile) return;
    await update(ref(db, `players/${profile.id}`), {
      friendRequests: (profile.friendRequests || []).filter(id => id !== senderPlayerId)
    });
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
            <DropdownMenuContent align="end" className="cartoon-card bg-black/90 border-4 border-black p-4 min-w-[220px] text-white">
              <DropdownMenuLabel className="font-headline text-xl text-primary mb-2">WARRIOR INFO</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/10" />
              <div className="space-y-4 py-2">
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

      {authUser && (
        <div className={cn(
          "fixed right-4 top-24 bottom-4 z-50 transition-transform duration-300 flex",
          isSidebarOpen ? "translate-x-0" : "translate-x-[calc(100%-12px)]"
        )}>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="w-10 h-16 my-auto bg-black/80 backdrop-blur-md border-4 border-r-0 border-black rounded-l-[20px] flex items-center justify-center hover:bg-black transition-colors shadow-[-4px_0_10px_rgba(0,0,0,0.3)]"
          >
            {isSidebarOpen ? <ChevronRight className="text-white" /> : <ChevronLeft className="text-white" />}
          </button>
          <div className="w-72 bg-black/90 backdrop-blur-xl border-4 border-black p-6 flex flex-col gap-6 shadow-[-10px_0_30px_rgba(0,0,0,0.5)] rounded-[30px]">
            {sidebarView === 'friends' ? (
              <>
                <div className="flex flex-col gap-4 border-b-4 border-black pb-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-headline text-2xl text-primary">ARKADAŞLAR</h3>
                    <div className="flex gap-2">
                      <Button 
                        size="icon" 
                        onClick={() => setSidebarView('notifications')}
                        className="w-8 h-8 rounded-full border-2 border-black bg-accent relative"
                      >
                        <Bell className="w-4 h-4 text-black" />
                        {profile.friendRequests && profile.friendRequests.length > 0 && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full border-2 border-black flex items-center justify-center">
                            <span className="text-[8px] font-bold text-white">{profile.friendRequests.length}</span>
                          </div>
                        )}
                      </Button>
                      <Button 
                        size="icon" 
                        onClick={() => setIsAddingFriend(!isAddingFriend)}
                        className={cn(
                          "w-8 h-8 rounded-full border-2 border-black transition-all",
                          isAddingFriend ? "bg-red-500 rotate-45" : "bg-primary"
                        )}
                      >
                        {isAddingFriend ? <X className="w-4 h-4 text-white" /> : <Plus className="w-4 h-4 text-white" />}
                      </Button>
                    </div>
                  </div>
                  
                  {isAddingFriend && (
                    <div className="flex flex-col gap-2 animate-in slide-in-from-top-2 duration-300">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input 
                            maxLength={8}
                            placeholder="8-HANELİ ID" 
                            value={friendIdInput}
                            onChange={(e) => setFriendIdInput(e.target.value.replace(/\D/g, ''))}
                            onKeyDown={(e) => e.key === 'Enter' && friendIdInput.length === 8 && sendFriendRequest()}
                            className="bg-black/40 border-2 border-black h-10 font-headline text-xs text-primary placeholder:text-white/20 focus-visible:ring-0"
                          />
                        </div>
                        <Button 
                          onClick={sendFriendRequest} 
                          disabled={friendIdInput.length !== 8}
                          className="cartoon-button bg-primary text-white h-10 px-3 min-w-[40px]"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      </div>
                      {searchStatus && (
                        <p className={cn(
                          "text-[10px] font-bold uppercase text-center",
                          searchStatus.includes('bulunamadı') ? 'text-destructive' : 'text-green-500'
                        )}>
                          {searchStatus}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-hide">
                  {friendsData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center mt-10 opacity-30">
                      <Users className="w-12 h-12 text-white mb-2" />
                      <p className="text-[10px] font-bold text-white uppercase text-center">Henüz arkadaş yok</p>
                    </div>
                  ) : (
                    friendsData.map(friend => (
                      <div key={friend.playerId} className="flex items-center gap-3 bg-white/5 p-2 rounded-xl border-2 border-black hover:border-primary/50 transition-colors group">
                        <div className="relative">
                          <Avatar className="w-10 h-10 border border-white/10">
                            <AvatarImage src={friend.avatarUrl} />
                            <AvatarFallback className="font-headline text-xs">{friend.name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className={cn(
                            "absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-black",
                            friend.isOnline ? "bg-green-500 shadow-[0_0_8px_#22c55e]" : "bg-zinc-600"
                          )} />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-headline text-sm text-white truncate w-32">{friend.name}</span>
                          <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest">#{friend.playerId}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-4 border-b-4 border-black pb-4">
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setSidebarView('friends')}
                      className="w-8 h-8 p-0 text-white/60 hover:text-white"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h3 className="font-headline text-2xl text-accent">BİLDİRİMLER</h3>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-hide">
                  {requestsData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center mt-10 opacity-30">
                      <Bell className="w-12 h-12 text-white mb-2" />
                      <p className="text-[10px] font-bold text-white uppercase text-center">Bildirim bulunamadı</p>
                    </div>
                  ) : (
                    requestsData.map(sender => (
                      <div key={sender.playerId} className="flex flex-col gap-3 bg-white/5 p-3 rounded-xl border-2 border-black">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8 border border-white/10">
                            <AvatarImage src={sender.avatarUrl} />
                            <AvatarFallback className="font-headline text-[10px]">{sender.name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-headline text-xs text-white truncate w-32">{sender.name}</span>
                            <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Arkadaşlık İsteği</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            onClick={() => handleAcceptRequest(sender.playerId!)}
                            className="flex-1 cartoon-button bg-green-600 text-white h-8 text-[10px] p-0"
                          >
                            KABUL ET
                          </Button>
                          <Button 
                            onClick={() => handleRejectRequest(sender.playerId!)}
                            className="flex-1 cartoon-button bg-destructive text-white h-8 text-[10px] p-0"
                          >
                            REDDET
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                
                <Button 
                  onClick={() => setSidebarView('friends')}
                  className="cartoon-button bg-primary text-white w-full h-10 mt-auto"
                >
                  GERİ
                </Button>
              </>
            )}
          </div>
        </div>
      )}
      
      <div className="w-full max-w-5xl space-y-10 relative z-20">
        {!db && (
          <Alert variant="destructive" className="cartoon-card bg-destructive/20 border-black mb-10">
            <ShieldAlert className="h-6 w-6 text-destructive" />
            <AlertTitle className="font-headline text-2xl text-destructive">SİSTEM HATASI</AlertTitle>
            <AlertDescription className="font-bold uppercase text-xs">FIREBASE BAĞLANTISI KESİLDİ.</AlertDescription>
          </Alert>
        )}
        
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="space-y-1 text-center md:text-left">
            <h2 className="text-5xl md:text-6xl font-headline text-primary">LOBİ MERKEZİ</h2>
            <p className="text-white/40 text-xs font-bold uppercase tracking-[0.3em]">SAVAŞ ALANINI SEÇ</p>
          </div>
          
          <div className="flex items-center gap-6 bg-black/40 backdrop-blur-md p-3 rounded-[25px] border-4 border-black px-8">
            <div className="p-2 bg-black/40 rounded-xl border-2 border-white/10 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
              <WeaponIcon weapon={profile.weaponClass} className="w-10 h-10 text-3xl" />
            </div>
            <div className="flex flex-col items-start">
              <span className="text-[10px] font-bold text-white/40 uppercase">SAVAŞÇI</span>
              <span className="font-headline text-xl text-accent">{profile.name || 'ANON'}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="cartoon-button bg-white/10 p-2 ml-4">
              <Home className="w-6 h-6 text-white" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          <div className="md:col-span-4 h-fit md:sticky md:top-8">
            <Card className="cartoon-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-headline text-2xl text-accent"><Plus className="w-6 h-6" /> YENİ ARENA</CardTitle>
                <CardDescription className="font-bold text-white/50 uppercase text-xs">SAVAŞ OTURUMU BAŞLAT</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">ADLANDIRMA</label>
                  <Input placeholder="ÖR: NEO TOKYO..." value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} className="bg-black/20 border-4 border-black rounded-[15px] h-12 font-bold" />
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">MAKS OYUNCU</label>
                    <span className="font-headline text-xl text-primary">{maxPlayers}</span>
                  </div>
                  <Slider value={[maxPlayers]} onValueChange={(v) => setMaxPlayers(v[0])} min={2} max={6} step={1} className="py-4" />
                </div>
                <Button className="cartoon-button bg-primary text-white w-full h-14 text-xl" onClick={createRoom} disabled={!newRoomName.trim() || !db}>ARENA KUR</Button>
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-8 space-y-6 flex flex-col">
            <div className="relative group flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-primary group-focus-within:text-accent transition-colors" />
                <Input 
                  placeholder="ARENA ADI VEYA 6-HANELİ ID ARA..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-14 bg-black/40 border-4 border-black rounded-[20px] h-14 font-headline text-lg text-white placeholder:text-white/20 focus-visible:ring-primary shadow-[4px_4px_0_rgba(0,0,0,1)]"
                />
              </div>
              <Button onClick={handleSearch} className="cartoon-button bg-primary text-white h-14 px-6 flex items-center gap-2">
                <Search className="w-5 h-5" />
                <span>ARA</span>
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <h3 className="text-3xl font-headline flex items-center gap-3"><LayoutGrid className="w-8 h-8 text-primary" /> AKTİF BÖLGELER</h3>
              <span className="font-headline text-sm bg-black/40 border-2 border-white/10 px-4 py-1 rounded-full text-white/60">{filteredRooms.length} ÇEVRİMİÇİ</span>
            </div>

            {filteredRooms.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-20 cartoon-card bg-black/20 border-dashed opacity-50">
                <Users className="w-20 h-20 text-white/10 mb-6" />
                <p className="font-headline text-2xl text-white/20 uppercase">ARENA BULUNAMADI</p>
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
                            <span className={cn(
                              "px-4 py-1 rounded-full border-2 border-black text-[10px] font-headline uppercase",
                              isFull ? "bg-black text-destructive" : isLocked ? "bg-orange-500 text-white" : "bg-primary text-white"
                            )}>
                              {isFull ? 'DOLU' : room.status}
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
                <Zap className="w-8 h-8 fill-current" /> HIZLI MAÇ
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
