"use client";

import { useState, useEffect } from 'react';
import { PlayerProfile } from '@/lib/game-types';
import { ref, onValue, update, onDisconnect } from 'firebase/database';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

const STORAGE_KEY = 'apo54_profile';

export function useLocalPlayer() {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for Auth changes
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
    });

    const stored = localStorage.getItem(STORAGE_KEY);
    let initialProfile: PlayerProfile;

    if (stored) {
      initialProfile = JSON.parse(stored);
      if (!initialProfile.playerId) {
        initialProfile.playerId = Math.floor(10000000 + Math.random() * 90000000).toString();
      }
      if (initialProfile.gold === undefined) {
        initialProfile.gold = 0;
      }
    } else {
      const id = Math.random().toString(36).substring(2, 15);
      initialProfile = {
        id,
        name: '',
        color: '#3b82f6',
        weaponClass: 'Sword',
        playerId: Math.floor(10000000 + Math.random() * 90000000).toString(),
        gold: 0,
      };
    }

    if (!db) {
      setProfile(initialProfile);
      setLoading(false);
      return () => unsubAuth();
    }

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

    // Handle Online Presence
    const onlineRef = ref(db, `players/${initialProfile.id}/isOnline`);
    update(ref(db, `players/${initialProfile.id}`), { isOnline: true });
    onDisconnect(onlineRef).set(false);

    return () => {
      unsubscribe();
      unsubAuth();
    };
  }, []);

  useEffect(() => {
    if (authUser && profile) {
      const updates: Partial<PlayerProfile> = {};
      if (!profile.name || profile.name === '') {
        updates.name = authUser.displayName || '';
      }
      if (!profile.avatarUrl || profile.avatarUrl !== authUser.photoURL) {
        updates.avatarUrl = authUser.photoURL || undefined;
      }
      
      if (Object.keys(updates).length > 0) {
        updateProfile(updates);
      }
    }
  }, [authUser]);

  const updateProfile = (updates: Partial<PlayerProfile>) => {
    if (!profile) return;
    const newProfile = { ...profile, ...updates };
    setProfile(newProfile);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newProfile));
    
    if (db) {
      const playerPathRef = ref(db, `players/${profile.id}`);
      update(playerPathRef, updates);
    }
  };

  return { profile, updateProfile, authUser, loading };
}
