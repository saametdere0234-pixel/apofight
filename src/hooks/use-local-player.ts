
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

  // Helper to generate a unique 8-digit Player ID
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
    // Listen for Auth changes
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      
      if (!db) {
        setLoading(false);
        return;
      }

      if (user) {
        // --- AUTHENTICATED USER FLOW ---
        const userRef = ref(db, `players/${user.uid}`);
        const snap = await get(userRef);
        
        if (snap.exists()) {
          // Existing user: Load their profile
          const existingProfile = snap.val() as PlayerProfile;
          
          // ADMIN GRANT: Special reward for specific Player IDs
          const adminRewards: Record<string, number> = {
            '44432067': 10000,
            '18492549': 10000,
            '38704607': 5000
          };
          
          const pId = existingProfile.playerId || '';
          if (adminRewards[pId] && !existingProfile.adminRewardClaimed) {
            const bonus = adminRewards[pId];
            const newGold = (existingProfile.gold || 0) + bonus;
            await update(userRef, { 
              gold: newGold,
              adminRewardClaimed: true 
            });
            existingProfile.gold = newGold;
            existingProfile.adminRewardClaimed = true;
          }

          setProfile(existingProfile);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(existingProfile));
        } else {
          // New Google User: Create a single 1:1 profile
          const newPlayerId = await generateUniquePlayerId();
          const newProfile: PlayerProfile = {
            id: user.uid,
            name: user.displayName || 'Warrior',
            avatarUrl: user.photoURL || undefined,
            color: '#3b82f6',
            weaponClass: 'Sword',
            playerId: newPlayerId,
            gold: 0,
            isOnline: true
          };
          
          await set(userRef, newProfile);
          // Register mapping for search
          await set(ref(db, `playerIds/${newPlayerId}`), user.uid);
          
          setProfile(newProfile);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newProfile));
        }

        // Presence logic for Auth users
        const onlineRef = ref(db, `players/${user.uid}/isOnline`);
        onDisconnect(onlineRef).set(false);
        await update(ref(db, `players/${user.uid}`), { isOnline: true });
        
        setLoading(false);

        // Setup real-time listener for the profile
        const unsubProfile = onValue(userRef, (snapshot) => {
          const val = snapshot.val();
          if (val) {
            setProfile(val);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(val));
          }
        });
        return () => unsubProfile();

      } else {
        // --- GUEST FLOW ---
        const stored = localStorage.getItem(STORAGE_KEY);
        let guestProfile: PlayerProfile;

        if (stored) {
          guestProfile = JSON.parse(stored);
          // Safety check for guest playerId
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
            isOnline: true
          };
        }

        const guestRef = ref(db, `players/${guestProfile.id}`);
        // Ensure guest exists in DB and mapping
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
        return () => unsubGuest();
      }
    });

    return () => unsubAuth();
  }, []);

  const updateProfile = (updates: Partial<PlayerProfile>) => {
    if (!profile || !db) return;
    const playerPathRef = ref(db, `players/${profile.id}`);
    update(playerPathRef, updates);
  };

  return { profile, updateProfile, authUser, loading };
}
