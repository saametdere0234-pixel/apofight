"use client";

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { ref, onValue, set, remove } from 'firebase/database';
import { useLocalPlayer } from '@/hooks/use-local-player';
import { GameInvitation } from '@/lib/game-types';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Swords, X, Check } from 'lucide-react';

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
        // Get the latest pending invitation
        const invites = Object.values(data) as GameInvitation[];
        if (invites.length > 0) {
          setActiveInvite(invites[0]);
        }
      } else {
        setActiveInvite(null);
      }
    });

    return () => unsubscribe();
  }, [profile?.id]);

  const handleAccept = () => {
    if (!activeInvite || !profile) return;
    const invite = activeInvite;
    setActiveInvite(null);
    remove(ref(db, `invitations/${profile.id}/${invite.id}`));
    router.push(`/game/${invite.roomId}`);
  };

  const handleReject = () => {
    if (!activeInvite || !profile) return;
    const invite = activeInvite;
    setActiveInvite(null);
    // Set status to rejected so sender can trigger cooldown
    set(ref(db, `invitations/${profile.id}/${invite.id}/status`), 'rejected');
  };

  if (!activeInvite) return null;

  return (
    <div className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="cartoon-card bg-[#1a1a2e] border-8 border-primary p-12 max-w-lg w-full text-center space-y-10 animate-in zoom-in duration-300">
        <div className="relative mx-auto w-32 h-32 flex items-center justify-center bg-primary/20 rounded-full border-4 border-primary">
          <Swords className="w-16 h-16 text-primary animate-pulse" />
        </div>
        
        <div className="space-y-4">
          <h2 className="text-5xl font-headline text-white tracking-tight uppercase italic">
            SAVAŞ ÇAĞRISI!
          </h2>
          <p className="text-xl font-headline text-accent drop-shadow-md">
            {activeInvite.senderName.toUpperCase()} SENİ ARENAYA ÇAĞIRIYOR
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <Button 
            onClick={handleReject}
            className="cartoon-button bg-destructive text-white h-20 text-2xl gap-3 hover:scale-105 active:scale-95"
          >
            <X className="w-8 h-8" /> REDDET
          </Button>
          <Button 
            onClick={handleAccept}
            className="cartoon-button bg-green-600 text-white h-20 text-2xl gap-3 hover:scale-105 active:scale-95"
          >
            <Check className="w-8 h-8" /> KABUL ET
          </Button>
        </div>

        <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
          Karar vermeden savaştan kaçamazsın
        </p>
      </div>
    </div>
  );
}
