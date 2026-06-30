"use client";

import { useState, useEffect } from 'react';
import { PlayerProfile } from '@/lib/game-types';
import { ref, onValue, update, onDisconnect, get, set } from 'firebase/database';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

const STORAGE_KEY = 'apo54_profile';

export function useLocalPlayer() {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function generateUniquePlayerId(): Promise<string> {
    if (!db) return Math.floor(10000000 + Math.random() * 90000000).toString();
    
    let isUnique = false;
    let newId = "";
    
    while (!isUnique) {
      newId = Math.floor(10000000 + Math.random() * 90000000).toString();
      const mappingRef = ref(db, `playerIds/${newId}`);
      const snap = await get(mappingRef);
      if (!snap.exists()) {
        isUnique = true;
      }
    }
    return newId;
  }

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      
      if (!db) {
        setLoading(false);
        return;
      }

      const handleForcedExit = () => {
        if (!db) return;
        const userId = user ? user.uid : profile?.id;
        if (userId) {
          update(ref(db, `players/${userId}`), { isOnline: false });
        }
      };

      window.addEventListener('beforeunload', handleForcedExit);

      if (user) {
        const userRef = ref(db, `players/${user.uid}`);
        const snap = await get(userRef);
        
        if (snap.exists()) {
          const existingProfile = snap.val() as PlayerProfile;
          if (!existingProfile.unlockedTaunts) {
            existingProfile.unlockedTaunts = ['😂'];
            existingProfile.selectedTaunt = '😂';
            await update(userRef, { unlockedTaunts: ['😂'], selectedTaunt: '😂' });
          }
          setProfile(existingProfile);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(existingProfile));
        } else {
          const newPlayerId = await generateUniquePlayerId();
          const newProfile: PlayerProfile = {
            id: user.uid,
            name: user.displayName || 'Warrior',
            avatarUrl: user.photoURL || undefined,
            color: '#3b82f6',
            weaponClass: 'Sword',
            playerId: newPlayerId,
            gold: 0,
            isOnline: true,
            unlockedTaunts: ['😂'],
            selectedTaunt: '😂'
          };
          await set(userRef, newProfile);
          await set(ref(db, `playerIds/${newPlayerId}`), user.uid);
          setProfile(newProfile);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newProfile));
        }

        const onlineRef = ref(db, `players/${user.uid}/isOnline`);
        onDisconnect(onlineRef).set(false);
        await update(ref(db, `players/${user.uid}`), { isOnline: true });
        
        setLoading(false);

        const unsubProfile = onValue(userRef, (snapshot) => {
          const val = snapshot.val();
          if (val) {
            setProfile(val);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(val));
          }
        });
        return () => {
          unsubProfile();
          window.removeEventListener('beforeunload', handleForcedExit);
          update(ref(db, `players/${user.uid}`), { isOnline: false });
        };

      } else {
        const stored = localStorage.getItem(STORAGE_KEY);
        let guestProfile: PlayerProfile;

        if (stored) {
          guestProfile = JSON.parse(stored);
          if (!guestProfile.playerId) {
            guestProfile.playerId = await generateUniquePlayerId();
          }
        } else {
          const id = "guest_" + Math.random().toString(36).substring(2, 15);
          const guestId = await generateUniquePlayerId();
          guestProfile = {
            id,
            name: '',
            color: '#3b82f6',
            weaponClass: 'Sword',
            playerId: guestId,
            gold: 0,
            isOnline: true,
            unlockedTaunts: ['😂'],
            selectedTaunt: '😂'
          };
        }

        const guestRef = ref(db, `players/${guestProfile.id}`);
        await update(guestRef, guestProfile);
        await update(ref(db, 'playerIds'), { [guestProfile.playerId!]: guestProfile.id });
        
        const onlineRef = ref(db, `players/${guestProfile.id}/isOnline`);
        onDisconnect(onlineRef).set(false);
        await update(guestRef, { isOnline: true });

        setProfile(guestProfile);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(guestProfile));
        setLoading(false);

        const unsubGuest = onValue(guestRef, (snapshot) => {
          const val = snapshot.val();
          if (val) {
            setProfile(val);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(val));
          }
        });
        return () => {
          unsubGuest();
          window.removeEventListener('beforeunload', handleForcedExit);
          if (profile?.id) {
            update(ref(db, `players/${profile.id}`), { isOnline: false });
          }
        };
      }
    });

    return () => unsubAuth();
  }, [profile?.id]);

  const updateProfile = (updates: Partial<PlayerProfile>) => {
    if (!profile || !db) return;
    const playerPathRef = ref(db, `players/${profile.id}`);
    update(playerPathRef, updates);
  };

  return { profile, updateProfile, authUser, loading };
}
