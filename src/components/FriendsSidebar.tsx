"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { ref, onValue, get, update, push, remove } from 'firebase/database';
import { useLocalPlayer } from '@/hooks/use-local-player';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Users, Plus, X, ArrowRight, Bell, ChevronLeft, ChevronRight, Send } from 'lucide-react';
import { PlayerProfile, GameInvitation } from '@/lib/game-types';
import { cn } from '@/lib/utils';

export function FriendsSidebar({ currentRoomId }: { currentRoomId?: string }) {
  const { profile, authUser } = useLocalPlayer();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarView, setSidebarView] = useState<'friends' | 'notifications'>('friends');
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [friendIdInput, setFriendIdInput] = useState('');
  const [searchStatus, setSearchStatus] = useState<string | null>(null);
  const [friendsData, setFriendsData] = useState<PlayerProfile[]>([]);
  const [requestsData, setRequestsData] = useState<PlayerProfile[]>([]);
  const [inviteCooldowns, setInviteCooldowns] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!db || !profile?.friends) {
      setFriendsData([]);
      return;
    }
    const friendList = profile.friends;
    
    const unsubscribers = friendList.map(fId => {
      const friendRef = ref(db, `players/${fId}`);
      return onValue(friendRef, (snap) => {
        const friend = snap.val() as PlayerProfile;
        if (friend) {
          setFriendsData(prev => {
            const index = prev.findIndex(p => p.id === friend.id);
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

  useEffect(() => {
    if (!db || !profile?.friendRequests) {
      setRequestsData([]);
      return;
    }
    const requestList = profile.friendRequests;
    
    const unsubscribers = requestList.map(fId => {
      const senderRef = ref(db, `players/${fId}`);
      return onValue(senderRef, (snap) => {
        const sender = snap.val() as PlayerProfile;
        if (sender) {
          setRequestsData(prev => {
            const index = prev.findIndex(p => p.id === sender.id);
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

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setInviteCooldowns(prev => {
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach(id => {
          if (next[id] <= now) {
            delete next[id];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const sendFriendRequest = async () => {
    if (!db || !profile || !friendIdInput || friendIdInput.length !== 8) return;
    
    const mappingRef = ref(db, `playerIds/${friendIdInput}`);
    const mappingSnap = await get(mappingRef);
    
    if (mappingSnap.exists()) {
      const targetId = mappingSnap.val();
      const targetRef = ref(db, `players/${targetId}`);
      const targetSnap = await get(targetRef);
      
      if (targetSnap.exists()) {
        const targetProfile = targetSnap.val() as PlayerProfile;
        const currentRequests = targetProfile.friendRequests || [];
        
        if (!currentRequests.includes(profile.id)) {
          await update(targetRef, {
            friendRequests: [...currentRequests, profile.id]
          });
        }
        setSearchStatus('Request sent');
      } else {
        setSearchStatus('Player not found');
      }
    } else {
      setSearchStatus('Player not found');
    }

    setFriendIdInput('');
    setTimeout(() => setSearchStatus(null), 3000);
  };

  const handleAcceptRequest = async (senderId: string) => {
    if (!db || !profile) return;
    
    const senderRef = ref(db, `players/${senderId}`);
    const snap = await get(senderRef);
    
    if (snap.exists()) {
      const senderProfile = snap.val() as PlayerProfile;
      const myFriends = profile.friends || [];
      const senderFriends = senderProfile.friends || [];
      
      if (!myFriends.includes(senderId)) {
        await update(ref(db, `players/${profile.id}`), {
          friends: [...myFriends, senderId],
          friendRequests: (profile.friendRequests || []).filter(id => id !== senderId)
        });
      }
      
      if (!senderFriends.includes(profile.id)) {
        await update(senderRef, {
          friends: [...senderFriends, profile.id]
        });
      }
    }
  };

  const handleRejectRequest = async (senderId: string) => {
    if (!db || !profile) return;
    await update(ref(db, `players/${profile.id}`), {
      friendRequests: (profile.friendRequests || []).filter(id => id !== senderId)
    });
  };

  const handleInvite = async (friend: PlayerProfile) => {
    if (!db || !profile || !currentRoomId || inviteCooldowns[friend.id]) return;

    const friendInternalId = friend.id;
    const inviteRef = push(ref(db, `invitations/${friendInternalId}`));
    const invite: GameInvitation = {
      id: inviteRef.key!,
      senderId: profile.id,
      senderName: profile.name,
      senderPlayerId: profile.playerId!,
      roomId: currentRoomId,
      timestamp: Date.now()
    };
    
    await set(inviteRef, invite);
    
    const statusRef = ref(db, `invitations/${friendInternalId}/${invite.id}/status`);
    onValue(statusRef, (snapshot) => {
      if (snapshot.val() === 'rejected') {
        setInviteCooldowns(prev => ({
          ...prev,
          [friend.id]: Date.now() + 10000
        }));
        remove(ref(db, `invitations/${friendInternalId}/${invite.id}`));
      }
    });
  };

  if (!authUser || !profile) return null;

  return (
    <div className={cn(
      "fixed right-4 top-24 bottom-4 z-[1001] transition-transform duration-300 flex",
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
          <div className="flex flex-col h-full gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex flex-col gap-4 border-b-4 border-black pb-4">
              <div className="flex justify-between items-center">
                <h3 className="font-headline text-2xl text-primary">FRIENDS</h3>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setSidebarView('notifications')}
                    className={cn(
                      "w-10 h-10 rounded-full border-4 border-black flex items-center justify-center transition-all relative",
                      profile.friendRequests && profile.friendRequests.length > 0 ? "bg-destructive animate-pulse shadow-[0_0_15px_rgba(255,0,0,0.5)]" : "bg-white/10"
                    )}
                  >
                    <Bell className={cn("w-5 h-5", profile.friendRequests && profile.friendRequests.length > 0 ? "text-white" : "text-white/60")} />
                    {profile.friendRequests && profile.friendRequests.length > 0 && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full border-2 border-black flex items-center justify-center">
                        <span className="text-xs font-headline text-destructive leading-none">{profile.friendRequests.length}</span>
                      </div>
                    )}
                  </button>
                  <button 
                    onClick={() => setIsAddingFriend(!isAddingFriend)}
                    className={cn(
                      "w-10 h-10 rounded-full border-4 border-black flex items-center justify-center transition-all",
                      isAddingFriend ? "bg-red-500 rotate-45" : "bg-primary shadow-[4px_4px_0_rgba(0,0,0,1)]"
                    )}
                  >
                    {isAddingFriend ? <X className="w-5 h-5 text-white" /> : <Plus className="w-5 h-5 text-white" />}
                  </button>
                </div>
              </div>
              
              {isAddingFriend && (
                <div className="flex flex-col gap-2 animate-in slide-in-from-top-2 duration-300">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input 
                        maxLength={8}
                        placeholder="8-DIGIT ID" 
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
                      searchStatus.includes('not found') ? 'text-destructive' : 'text-green-500'
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
                  <p className="text-[10px] font-bold text-white uppercase text-center">No friends yet</p>
                </div>
              ) : (
                friendsData.map(friend => (
                  <div key={friend.id} className="flex flex-col gap-2 bg-white/5 p-2 rounded-xl border-2 border-black hover:border-primary/50 transition-colors group">
                    <div className="flex items-center gap-3">
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
                      <div className="flex flex-col flex-1">
                        <span className="font-headline text-sm text-white truncate w-32">{friend.name}</span>
                        <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest">#{friend.playerId}</span>
                      </div>
                    </div>
                    
                    {currentRoomId && friend.isOnline && (
                      <Button 
                        size="sm" 
                        onClick={() => handleInvite(friend)}
                        disabled={!!inviteCooldowns[friend.id]}
                        className={cn(
                          "cartoon-button h-7 text-[10px] w-full gap-2",
                          inviteCooldowns[friend.id] ? "bg-zinc-800 text-white/40" : "bg-accent text-black"
                        )}
                      >
                        <Send className="w-3 h-3" />
                        {inviteCooldowns[friend.id] 
                          ? `${Math.ceil((inviteCooldowns[friend.id] - Date.now()) / 1000)}s` 
                          : "INVITE"}
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full gap-4 animate-in fade-in slide-in-from-left-4 duration-300">
            <div className="flex flex-col gap-4 border-b-4 border-black pb-4">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setSidebarView('friends')}
                  className="w-10 h-10 flex items-center justify-center text-white/60 hover:text-white bg-white/5 rounded-full border-2 border-black"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <h3 className="font-headline text-2xl text-accent">NOTIFICATIONS</h3>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-hide">
              {requestsData.length === 0 ? (
                <div className="flex flex-col items-center justify-center mt-10 opacity-30">
                  <Bell className="w-12 h-12 text-white mb-2" />
                  <p className="text-[10px] font-bold text-white uppercase text-center">No notifications</p>
                </div>
              ) : (
                requestsData.map(sender => (
                  <div key={sender.id} className="flex flex-col gap-3 bg-white/5 p-3 rounded-xl border-2 border-black">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8 border border-white/10">
                        <AvatarImage src={sender.avatarUrl} />
                        <AvatarFallback className="font-headline text-[10px]">{sender.name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-headline text-xs text-white truncate w-32">{sender.name}</span>
                        <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Friend Request</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => handleAcceptRequest(sender.id)}
                        className="flex-1 cartoon-button bg-green-600 text-white h-8 text-[10px] p-0"
                      >
                        ACCEPT
                      </Button>
                      <Button 
                        onClick={() => handleRejectRequest(sender.id)}
                        className="flex-1 cartoon-button bg-destructive text-white h-8 text-[10px] p-0"
                      >
                        REJECT
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}