"use client";

import { useLocalPlayer } from '@/hooks/use-local-player';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { User, Trophy, Zap, LogIn } from 'lucide-react';
import { WeaponClass, WEAPON_STATS } from '@/lib/game-types';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { auth, googleProvider } from '@/lib/firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

const WeaponIcon = ({ weapon, className = "w-8 h-8" }: { weapon: WeaponClass; className?: string }) => {
  const baseClasses = "font-headline flex items-center justify-center select-none leading-none";
  if (weapon === 'Sword') {
    return (
      <div className={cn(baseClasses, className, "text-yellow-400")} style={{ textShadow: '2px 2px 0px black' }}>
        S
      </div>
    );
  }
  if (weapon === 'Dagger') {
    return (
      <div className={cn(baseClasses, className, "text-purple-500")} style={{ textShadow: '2px 2px 0px black' }}>
        D
      </div>
    );
  }
  if (weapon === 'Bow') {
    return (
      <div className={cn(baseClasses, className, "text-white")} style={{ textShadow: '2px 2px 0px black' }}>
        B
      </div>
    );
  }
  return null;
};

const BATTLE_AURAS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#ec4899', // Pink
  '#a855f7', // Purple
  '#3b82f6', // Blue
  '#ffffff', // White
  '#78350f', // Brown
  '#22c55e', // Green
  '#06b6d4', // Cyan
];

export default function EntryScreen() {
  const { profile, updateProfile, authUser, loading } = useLocalPlayer();
  const router = useRouter();

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  const handleGoogleSignIn = () => {
    signInWithPopup(auth, googleProvider)
      .then((result) => {
        const user = result.user;
        // The display logic is handled by React state (authUser), 
        // but we ensure the profile updates correctly.
        updateProfile({
          name: user.displayName || profile.name,
          avatarUrl: user.photoURL || undefined
        });
      })
      .catch((error) => {
        console.error("Google Sign-In failed", error);
      });
  };

  const handlePlay = () => {
    router.push('/lobby');
  };

  const weapons: { id: WeaponClass; desc: string }[] = [
    { 
      id: 'Sword', 
      desc: `Balanced: ${WEAPON_STATS.Sword.damage} DMG, ${WEAPON_STATS.Sword.range}m Cone, ${WEAPON_STATS.Sword.delay}s Delay` 
    },
    { 
      id: 'Dagger', 
      desc: `Fast: ${WEAPON_STATS.Dagger.damage} DMG, ${WEAPON_STATS.Dagger.range}m AoE, ${WEAPON_STATS.Dagger.delay}s Delay` 
    },
    { 
      id: 'Bow', 
      desc: `Range: distance scaling (50-200), ${WEAPON_STATS.Bow.range}m Range` 
    },
  ];

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="scanline"></div>
      
      {/* Top Right Profile Display */}
      <div 
        id="user-profile"
        className={cn(
          "fixed top-6 right-6 z-[100] animate-in slide-in-from-top-4 fade-in duration-500",
          authUser ? "flex" : "hidden"
        )}
      >
         <div className="flex items-center gap-4 bg-black/60 backdrop-blur-md p-2 pl-4 rounded-full border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)]">
            <span id="user-name" className="font-headline text-lg text-white" style={{ WebkitTextStroke: '1px black' }}>{authUser?.displayName}</span>
            <Avatar className="w-10 h-10 border-2 border-white/20">
              <AvatarImage id="user-pic" src={authUser?.photoURL || undefined} className="rounded-full" />
              <AvatarFallback className="bg-primary text-white font-headline text-xs">{authUser?.displayName?.charAt(0)}</AvatarFallback>
            </Avatar>
         </div>
      </div>

      <div className="absolute top-10 left-10 w-32 h-32 bg-primary/20 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-10 right-10 w-48 h-48 bg-accent/10 rounded-full blur-3xl animate-pulse delay-1000"></div>

      <div className="w-full max-w-4xl space-y-12 relative z-20">
        <header className="text-center space-y-4">
          <h1 className="text-7xl md:text-9xl font-headline italic tracking-tighter text-white drop-shadow-[6px_6px_0px_rgba(0,0,0,1)] animate-bounce-subtle">
            APO54 <span className="text-accent">BATTLE!</span>
          </h1>
          <div className="inline-block bg-black/40 backdrop-blur-md px-6 py-2 rounded-full border-2 border-white/10">
            <p className="text-accent uppercase tracking-[0.2em] text-sm font-bold flex items-center gap-2">
              <Zap className="w-4 h-4 fill-current" />
              ULTRA ARCADE EDITION
              <Zap className="w-4 h-4 fill-current" />
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="cartoon-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="space-y-1.5">
                <CardTitle className="flex items-center gap-2 font-headline text-2xl text-accent">
                  <User className="w-6 h-6" />
                  CHARACTER ID
                </CardTitle>
                <CardDescription className="font-bold text-white/60">YOUR ARENA LEGACY BEGINS HERE</CardDescription>
              </div>
              {!authUser && (
                <Button 
                  id="google-login-btn"
                  onClick={handleGoogleSignIn}
                  variant="ghost" 
                  size="icon" 
                  className="cartoon-button bg-white text-black h-10 w-10 p-0 flex items-center justify-center overflow-hidden hover:bg-white/90"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="G" />
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="name" className="font-bold text-sm uppercase">WARRIOR ALIAS</Label>
                <div className="flex gap-3">
                  <Input 
                    id="name" 
                    placeholder="ENTER NAME..." 
                    value={profile.name}
                    onChange={(e) => updateProfile({ name: e.target.value })}
                    className="bg-black/20 border-4 border-black rounded-[15px] h-14 font-bold text-lg w-full"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="font-bold text-sm uppercase">BATTLE AURA</Label>
                <div className="flex gap-3 flex-wrap">
                  {BATTLE_AURAS.map(c => (
                    <button
                      key={c}
                      onClick={() => updateProfile({ color: c })}
                      className={`w-10 h-10 rounded-full border-4 transition-transform ${profile.color === c ? 'scale-125 border-white shadow-[0_0_15px_rgba(255,255,255,0.5)]' : 'border-black hover:scale-110'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cartoon-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-headline text-2xl text-primary">
                <Zap className="w-6 h-6" />
                SELECT ARSENAL
              </CardTitle>
              <CardDescription className="font-bold text-white/60">CHOOSE YOUR COMBAT STYLE</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {weapons.map((w) => (
                <button
                  key={w.id}
                  onClick={() => updateProfile({ weaponClass: w.id })}
                  className={`w-full p-4 flex items-center gap-4 rounded-[20px] border-4 transition-all text-left group ${profile.weaponClass === w.id ? 'border-primary bg-primary/20 scale-[1.02]' : 'border-black bg-black/20 hover:border-primary/50'}`}
                >
                  <div className={`p-1.5 rounded-xl border-4 border-black transition-colors ${profile.weaponClass === w.id ? 'bg-primary' : 'bg-zinc-800'}`}>
                    <WeaponIcon weapon={w.id} className="w-10 h-10 text-4xl" />
                  </div>
                  <div>
                    <h4 className="font-headline text-xl leading-none mb-1 text-white">{w.id}</h4>
                    <p className="text-xs font-bold text-white/40 uppercase tracking-tighter">{w.desc}</p>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-center pt-4">
          <Button 
            size="lg" 
            className="cartoon-button bg-primary text-white w-full max-w-md h-20 text-3xl hover:scale-105 active:scale-95"
            onClick={handlePlay}
            disabled={!profile.name.trim()}
          >
            ENTER THE ARENA
          </Button>
        </div>
      </div>
    </div>
  );
}
