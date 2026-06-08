
"use client";

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { ref, onValue, set, remove, update } from 'firebase/database';
import { useLocalPlayer } from '@/hooks/use-local-player';
import { GameInvitation } from '@/lib/game-types';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Swords, X, Check, UserPlus } from 'lucide-react';

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
    
    // 1. Force cleanup of old room presence
    if (profile.currentRoomId) {
      const oldPlayerRef = ref(db, `rooms/${profile.currentRoomId}/players/${profile.id}`);
      await remove(oldPlayerRef);
    }

    if (invite.type === 'invite') {
      // 2. For Invites: Recipient clears the record and moves in
      setActiveInvite(null);
      await remove(ref(db, `invitations/${profile.id}/${inviteId}`));
      router.push(`/game/${invite.roomId}`);
    } else {
      // 2. For Join Requests: Recipient (Host) marks as accepted.
      // The requester (sender) is listening and will cleanup + join.
      await update(ref(db, `invitations/${profile.id}/${inviteId}`), { 
        status: 'accepted' 
      });
      setActiveInvite(null);
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
    }, 5000);
  };

  if (!activeInvite) return null;

  const isJoinRequest = activeInvite.type === 'join_request';

  return (
    <div className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="cartoon-card bg-[#1a1a2e] border-8 border-primary p-12 max-w-lg w-full text-center space-y-10 animate-in zoom-in duration-300">
        <div className="relative mx-auto w-32 h-32 flex items-center justify-center bg-primary/20 rounded-full border-4 border-primary">
          {isJoinRequest ? (
            <UserPlus className="w-16 h-16 text-primary animate-pulse" />
          ) : (
            <Swords className="w-16 h-16 text-primary animate-pulse" />
          )}
        </div>
        
        <div className="space-y-4">
          <h2 className="text-5xl font-headline text-white tracking-tight uppercase italic">
            {isJoinRequest ? "JOIN REQUEST!" : "CALL TO ARMS!"}
          </h2>
          <p className="text-xl font-headline text-accent drop-shadow-md">
            {activeInvite.senderName.toUpperCase()} {isJoinRequest ? "WANTS TO ENTER YOUR ARENA" : "INVITED YOU TO GLORY"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <Button 
            onClick={handleReject}
            className="cartoon-button bg-destructive text-white h-20 text-2xl gap-3 hover:scale-105 active:scale-95"
          >
            <X className="w-8 h-8" /> REJECT
          </Button>
          <Button 
            onClick={handleAccept}
            className="cartoon-button bg-green-600 text-white h-20 text-2xl gap-3 hover:scale-105 active:scale-95"
          >
            <Check className="w-8 h-8" /> ACCEPT
          </Button>
        </div>

        <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
          {isJoinRequest ? "ALLOW ENTRY TO THE COMBAT ZONE?" : "CHOOSE YOUR FATE WISELY"}
        </p>
      </div>
    </div>
  );
}
