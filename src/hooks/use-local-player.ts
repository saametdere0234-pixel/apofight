"use client";

import { useState, useEffect } from 'react';
import { PlayerProfile, WeaponClass } from '@/lib/game-types';
import { generatePlayerName } from '@/ai/flows/dynamic-player-name-generation';
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
        medals: 0,
      };
    }

    if (!db) {
      setProfile(initialProfile);
      setLoading(false);
      return;
    }

    // Sync medals from Firebase if they exist
    const medalRef = ref(db, `players/${initialProfile.id}/medals`);
    const unsubscribe = onValue(medalRef, (snapshot) => {
      const val = snapshot.val();
      if (val !== null) {
        initialProfile.medals = val;
        setProfile({ ...initialProfile });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initialProfile));
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
      set(ref(db, `players/${profile.id}/medals`), newProfile.medals);
      set(ref(db, `players/${profile.id}/name`), newProfile.name);
    }
  };

  const generateName = async () => {
    const result = await generatePlayerName({});
    updateProfile({ name: result.name });
  };

  return { profile, updateProfile, generateName, loading };
}
