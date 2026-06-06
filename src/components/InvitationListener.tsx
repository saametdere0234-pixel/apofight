
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
        // Filter for pending invites
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

  const handleAccept = () => {
    if (!activeInvite || !profile || !db) return;
    const invite = activeInvite;
    
    if (invite.type === 'invite') {
      // Recipient joins the room immediately
      setActiveInvite(null);
      remove(ref(db, `invitations/${profile.id}/${invite.id}`));
      router.push(`/game/${invite.roomId}`);
    } else {
      // Join request: Host accepts, friend (sender) will join automatically via status listener
      update(ref(db, `invitations/${profile.id}/${invite.id}`), { 
        status: 'accepted' 
      });
      setActiveInvite(null);
    }
  };

  const handleReject = () => {
    if (!activeInvite || !profile || !db) return;
    const invite = activeInvite;
    setActiveInvite(null);
    
    // Update status to rejected so sender gets the notification
    update(ref(db, `invitations/${profile.id}/${invite.id}`), { 
      status: 'rejected' 
    });
    
    // Auto-cleanup rejected invite after a short delay to allow sender to see it
    setTimeout(() => {
      if (db) remove(ref(db, `invitations/${profile.id}/${invite.id}`));
    }, 10000);
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
            {activeInvite.senderName.toUpperCase()} {isJoinRequest ? "WANTS TO JOIN YOUR ARENA" : "HAS INVITED YOU TO BATTLE"}
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
          {isJoinRequest ? "ALLOW THEM TO ENTER THE COMBAT ZONE?" : "CHOOSE YOUR FATE WISELY"}
        </p>
      </div>
    </div>
  );
}
