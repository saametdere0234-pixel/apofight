
"use client";

import { useState } from 'react';
import { useLocalPlayer } from '@/hooks/use-local-player';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { User, Zap, LogOut, Wallet, Fingerprint, Swords, Sparkles, Lock } from 'lucide-react';
import { WeaponClass, WEAPON_STATS } from '@/lib/game-types';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { auth, googleProvider } from '@/lib/firebase';
import { signInWithPopup, signOut } from 'firebase/auth';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const WeaponIcon = ({ weapon, className = "w-8 h-8" }: { weapon: WeaponClass; className?: string }) => {
  const baseClasses = "font-headline flex items-center justify-center select-none leading-none";
  if (weapon === 'Sword') return <div className={cn(baseClasses, className, "text-yellow-400")} style={{ textShadow: '2px 2px 0px black' }}>S</div>;
  if (weapon === 'Dagger') return <div className={cn(baseClasses, className, "text-purple-500")} style={{ textShadow: '2px 2px 0px black' }}>D</div>;
  if (weapon === 'Bow') return <div className={cn(baseClasses, className, "text-white")} style={{ textShadow: '2px 2px 0px black' }}>B</div>;
  return null;
};

const BATTLE_AURAS = [
  { id: '#ef4444', label: 'Red' },
  { id: '#f97316', label: 'Orange' },
  { id: '#ec4899', label: 'Pink' },
  { id: '#a855f7', label: 'Purple' },
  { id: '#3b82f6', label: 'Blue' },
  { id: '#ffffff', label: 'White' },
  { id: '#78350f', label: 'Brown' },
  { id: '#22c55e', label: 'Green' },
];

const PREMIUM_AURAS = [
  { id: 'aura-pink-blue', label: 'Pink-Blue', class: 'aura-pink-blue' },
  { id: 'aura-red-blue', label: 'Red-Blue', class: 'aura-red-blue' },
  { id: 'aura-red-green', label: 'Red-Green', class: 'aura-red-green' },
  { id: 'aura-orange-white', label: 'Orange-White', class: 'aura-orange-white' },
  { id: 'aura-pink-white', label: 'Pink-White', class: 'aura-pink-white' },
  { id: 'aura-blue-white', label: 'Blue-White', class: 'aura-blue-white' },
  { id: 'aura-red-white', label: 'Red-White', class: 'aura-red-white' },
  { id: 'aura-green-white', label: 'Green-White', class: 'aura-green-white' },
  { id: 'aura-white-no-border', label: 'Pure White', class: 'aura-white-no-border' },
  { id: 'aura-black', label: 'Deep Black', class: 'aura-black' },
];

const PREMIUM_PRICE = 200;

export default function EntryScreen() {
  const { profile, updateProfile, authUser, loading } = useLocalPlayer();
  const router = useRouter();
  const [auraToPurchase, setAuraToPurchase] = useState<{id: string, label: string} | null>(null);

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
        updateProfile({
          name: user.displayName || profile.name,
          avatarUrl: user.photoURL || undefined
        });
      })
      .catch((error) => {
        console.error("Google Sign-In failed", error);
      });
  };

  const handleLogout = () => {
    signOut(auth);
  };

  const handlePlay = () => {
    router.push('/lobby');
  };

  const selectAura = (auraId: string, isPremium: boolean) => {
    if (isPremium) {
      const unlocked = profile.unlockedAuras || [];
      if (unlocked.includes(auraId)) {
        updateProfile({ color: auraId });
      } else {
        const aura = PREMIUM_AURAS.find(a => a.id === auraId);
        if (aura) {
          setAuraToPurchase({ id: aura.id, label: aura.label });
        }
      }
    } else {
      updateProfile({ color: auraId });
    }
  };

  const confirmPurchase = () => {
    if (!auraToPurchase) return;
    const gold = profile.gold || 0;
    const unlocked = profile.unlockedAuras || [];

    if (gold >= PREMIUM_PRICE) {
      updateProfile({
        gold: gold - PREMIUM_PRICE,
        unlockedAuras: [...unlocked, auraToPurchase.id],
        color: auraToPurchase.id
      });
      toast({
        title: "PREMIUM AURA UNLOCKED!",
        description: `You purchased ${auraToPurchase.label.toUpperCase()} for ${PREMIUM_PRICE}G.`,
      });
    } else {
      toast({
        variant: "destructive",
        title: "INSUFFICIENT GOLD!",
        description: `You need ${PREMIUM_PRICE - gold} more gold to unlock this aura.`,
      });
    }
    setAuraToPurchase(null);
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
      
      {authUser && (
        <div className="fixed top-6 right-6 z-[100] animate-in slide-in-from-top-4 fade-in duration-500">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <div 
                id="user-profile"
                className="relative flex items-center gap-4 bg-black/60 backdrop-blur-md p-2 pl-4 rounded-full border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] cursor-pointer hover:bg-black/80 transition-colors"
              >
                <span id="user-name" className="font-headline text-lg text-white" style={{ WebkitTextStroke: '1px black' }}>{authUser?.displayName}</span>
                <Avatar className="w-10 h-10 border-2 border-white/20">
                  <AvatarImage id="user-pic" src={authUser?.photoURL || undefined} className="rounded-full" />
                  <AvatarFallback className="bg-primary text-white font-headline text-xs">{authUser?.displayName?.charAt(0)}</AvatarFallback>
                </Avatar>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="cartoon-card bg-black/90 border-4 border-black p-4 min-w-[240px] text-white">
              <DropdownMenuLabel className="font-headline text-xl text-primary mb-2">WARRIOR INFO</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/10" />
              <div className="space-y-4 py-2">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-1">
                    <Swords className="w-3 h-3" /> CURRENT WEAPON
                  </span>
                  <div className="flex items-center gap-2 bg-black/40 p-2 rounded-xl border border-white/10">
                    <WeaponIcon weapon={profile.weaponClass} className="w-6 h-6" />
                    <span className="font-headline text-sm text-white">{profile.weaponClass}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-1">
                    <Fingerprint className="w-3 h-3" /> PLAYER ID
                  </span>
                  <span id="player-id" className="font-headline text-lg text-white">{profile.playerId}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-1">
                    <Wallet className="w-3 h-3" /> GOLD BALANCE
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-yellow-500 rounded-full border-2 border-black" />
                    <span id="gold-currency" className="font-headline text-2xl text-accent">{profile.gold || 0} G</span>
                  </div>
                </div>
              </div>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem 
                id="logout-btn"
                onClick={handleLogout}
                className="mt-2 focus:bg-transparent"
              >
                <Button className="cartoon-button bg-destructive text-white w-full h-10 gap-2">
                  <LogOut className="w-4 h-4" /> LOGOUT
                </Button>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

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
                  {BATTLE_AURAS.map(a => (
                    <button
                      key={a.id}
                      title={a.label}
                      onClick={() => selectAura(a.id, false)}
                      className={`w-10 h-10 rounded-full border-4 transition-transform ${profile.color === a.id ? 'scale-125 border-white shadow-[0_0_15px_rgba(255,255,255,0.5)]' : 'border-black hover:scale-110'}`}
                      style={{ backgroundColor: a.id }}
                    />
                  ))}
                </div>
              </div>

              {authUser && (
                <div className="space-y-3 pt-4 border-t border-white/10">
                  <div className="flex justify-between items-center">
                    <Label className="font-bold text-sm uppercase flex items-center gap-2 text-primary">
                      <Sparkles className="w-4 h-4" /> PREMIUM ARSENAL
                    </Label>
                    <span className="font-headline text-xs text-accent bg-black/40 px-3 py-1 rounded-full border border-accent/20">
                      COST: {PREMIUM_PRICE}G
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-3">
                    {PREMIUM_AURAS.map(a => {
                      const isUnlocked = (profile.unlockedAuras || []).includes(a.id);
                      const isSelected = profile.color === a.id;
                      return (
                        <button
                          key={a.id}
                          title={a.label}
                          onClick={() => selectAura(a.id, true)}
                          className={cn(
                            "w-full aspect-square rounded-full border-4 transition-all relative flex items-center justify-center overflow-hidden",
                            isSelected ? "scale-110 border-white shadow-[0_0_15px_rgba(255,255,255,0.8)]" : "border-black hover:scale-105",
                            !isUnlocked && "opacity-50 brightness-50",
                            a.class
                          )}
                        >
                          {!isUnlocked && <Lock className="w-5 h-5 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
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

      <AlertDialog open={!!auraToPurchase} onOpenChange={(open) => !open && setAuraToPurchase(null)}>
        <AlertDialogContent className="cartoon-card bg-black/90 border-4 border-black p-8 text-white max-w-sm">
          <AlertDialogHeader className="space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full border-4 border-accent flex items-center justify-center bg-accent/20">
              <Sparkles className="w-8 h-8 text-accent" />
            </div>
            <AlertDialogTitle className="font-headline text-2xl text-center uppercase tracking-tight">Unlock Aura?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/80 font-bold text-center uppercase text-xs">
              Unlock the {auraToPurchase?.label} color for {PREMIUM_PRICE} Gold?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 flex gap-4">
            <AlertDialogCancel className="cartoon-button bg-destructive text-white flex-1 h-12">CANCEL</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPurchase} className="cartoon-button bg-accent text-black flex-1 h-12">ACCEPT</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

