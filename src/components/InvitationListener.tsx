
"use client";

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { ref, onValue, set, remove, update, get } from 'firebase/database';
import { useLocalPlayer } from '@/hooks/use-local-player';
import { GameInvitation, PlayerProfile } from '@/lib/game-types';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Swords, X, Check, UserPlus, UserCheck, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

export function InvitationListener() {
  const { profile } = useLocalPlayer();
  const [activeInvite, setActiveInvite] = useState<GameInvitation | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!db || !profile?.id) return;

    const invitationsRef = ref(db, `invitations/${profile.id}`);
    const unsubscribe = onValue(invitationsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const invites = Object.values(data) as GameInvitation[];
        // Look for the first pending invitation
        const pending = invites.find(inv => !inv.status || inv.status === 'pending');
        if (pending) {
          setActiveInvite(pending);
        } else {
          setActiveInvite(null);
        }
      } else {
        setActiveInvite(null);
      }
    });

    return () => unsubscribe();
  }, [profile?.id]);

  const handleAccept = async () => {
    if (!activeInvite || !profile || !db) return;
    const invite = activeInvite;
    const inviteId = invite.id;

    if (invite.type === 'invite') {
      // Cleanup old presence
      if (profile.currentRoomId) {
        await remove(ref(db, `rooms/${profile.currentRoomId}/players/${profile.id}`));
      }
      setActiveInvite(null);
      await remove(ref(db, `invitations/${profile.id}/${inviteId}`));
      router.push(`/game/${invite.roomId}`);
    } else if (invite.type === 'join_request') {
      // Host accepts requester
      await update(ref(db, `invitations/${profile.id}/${inviteId}`), { 
        status: 'accepted' 
      });
      setActiveInvite(null);
    } else if (invite.type === 'friend_request') {
      // Acceptance of friend request
      const senderId = invite.senderId;
      const myId = profile.id;

      const myRef = ref(db, `players/${myId}`);
      const senderRef = ref(db, `players/${senderId}`);

      const [mySnap, senderSnap] = await Promise.all([get(myRef), get(senderRef)]);

      if (mySnap.exists() && senderSnap.exists()) {
        const myData = mySnap.val() as PlayerProfile;
        const senderData = senderSnap.val() as PlayerProfile;

        const myFriends = myData.friends || [];
        const senderFriends = senderData.friends || [];

        const updates: any = {};
        if (!myFriends.includes(senderId)) {
          updates[`players/${myId}/friends`] = [...myFriends, senderId];
        }
        if (!senderFriends.includes(myId)) {
          updates[`players/${senderId}/friends`] = [...senderFriends, myId];
        }
        
        await update(ref(db), updates);
      }

      setActiveInvite(null);
      await remove(ref(db, `invitations/${profile.id}/${inviteId}`));
    }
  };

  const handleReject = async () => {
    if (!activeInvite || !profile || !db) return;
    const invite = activeInvite;
    const inviteId = invite.id;
    setActiveInvite(null);
    
    // Mark as rejected so sender gets feedback
    await update(ref(db, `invitations/${profile.id}/${inviteId}`), { 
      status: 'rejected' 
    });
    
    // Auto-cleanup rejected invite after a short delay
    setTimeout(() => {
      if (db) remove(ref(db, `invitations/${profile.id}/${inviteId}`));
    }, 2000);
  };

  if (!activeInvite) return null;

  const getTitle = () => {
    switch (activeInvite.type) {
      case 'friend_request': return "NEW ALLY REQUEST!";
      case 'join_request': return "ENTRY REQUEST!";
      case 'invite': return "CALL TO ARMS!";
      default: return "NOTIFICATION";
    }
  };

  const getSubTitle = () => {
    const name = activeInvite.senderName.toUpperCase();
    switch (activeInvite.type) {
      case 'friend_request': return `${name} WANTS TO BE FRIENDS`;
      case 'join_request': return `${name} WANTS TO JOIN YOU`;
      case 'invite': return `${name} INVITED YOU TO BATTLE`;
      default: return `MESSAGE FROM ${name}`;
    }
  };

  const getIcon = () => {
    switch (activeInvite.type) {
      case 'friend_request': return <UserPlus className="w-6 h-6 text-primary" />;
      case 'join_request': return <Bell className="w-6 h-6 text-primary" />;
      case 'invite': return <Swords className="w-6 h-6 text-primary" />;
      default: return <Bell className="w-6 h-6 text-primary" />;
    }
  };

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[2000] w-full max-w-sm px-4 animate-in slide-in-from-top duration-300">
      <div className="cartoon-card bg-black/95 border-4 border-primary p-4 shadow-[0_10px_40px_rgba(0,0,0,0.8)]">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 flex items-center justify-center bg-primary/20 rounded-xl border-2 border-primary">
            {getIcon()}
          </div>
          <div className="flex-1 text-left">
            <h4 className="font-headline text-lg text-white leading-none mb-1">{getTitle()}</h4>
            <p className="text-[10px] font-bold text-accent uppercase tracking-wider">{getSubTitle()}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button 
            onClick={handleReject}
            className="cartoon-button bg-destructive text-white h-10 text-xs gap-2"
          >
            <X className="w-4 h-4" /> REJECT
          </Button>
          <Button 
            onClick={handleAccept}
            className="cartoon-button bg-green-600 text-white h-10 text-xs gap-2"
          >
            <Check className="w-4 h-4" /> ACCEPT
          </Button>
        </div>
      </div>
    </div>
  );
}
