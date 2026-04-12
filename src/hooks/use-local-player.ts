"use client";

import { useState, useEffect } from 'react';
import { PlayerProfile } from '@/lib/game-types';
import { ref, onValue, set } from 'firebase/database';
import { db } from '@/lib/firebase';

const STORAGE_KEY = 'apo54_profile';

export function useLocalPlayer() {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    let initialProfile: PlayerProfile;

    if (stored) {
      initialProfile = JSON.parse(stored);
    } else {
      const id = Math.random().toString(36).substring(2, 15);
      initialProfile = {
        id,
        name: '',
        color: '#2B72EE',
        weaponClass: 'Sword',
      };
    }

    if (!db) {
      setProfile(initialProfile);
      setLoading(false);
      return;
    }

    // Sync profile data from Firebase if needed
    const playerRef = ref(db, `players/${initialProfile.id}`);
    const unsubscribe = onValue(playerRef, (snapshot) => {
      const val = snapshot.val();
      if (val !== null) {
        const syncedProfile = { ...initialProfile, ...val };
        setProfile(syncedProfile);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(syncedProfile));
      } else {
        setProfile(initialProfile);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const updateProfile = (updates: Partial<PlayerProfile>) => {
    if (!profile) return;
    const newProfile = { ...profile, ...updates };
    setProfile(newProfile);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newProfile));
    
    if (db) {
      // Sync to Firebase
      set(ref(db, `players/${profile.id}/name`), newProfile.name);
      set(ref(db, `players/${profile.id}/color`), newProfile.color);
      set(ref(db, `players/${profile.id}/weaponClass`), newProfile.weaponClass);
    }
  };

  return { profile, updateProfile, loading };
}
