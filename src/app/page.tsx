"use client";

import { useState } from 'react';
import { useLocalPlayer } from '@/hooks/use-local-player';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Zap, LogOut, Wallet, Fingerprint, Swords } from 'lucide-react';
import { WeaponClass } from '@/lib/game-types';
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
import { ShopSidebar, BATTLE_AURAS, PREMIUM_AURAS, SHOP_TAUNTS } from '@/components/ShopSidebar';

const WeaponIcon = ({ weapon, className = "w-8 h-8" }: { weapon: WeaponClass; className?: string }) => {
  const baseClasses = "font-headline flex items-center justify-center select-none leading-none";
  if (weapon === 'Sword') return <div className={cn(baseClasses, className, "text-yellow-400")} style={{ textShadow: '2px 2px 0px black' }}>S</div>;
  if (weapon === 'Dagger') return <div className={cn(baseClasses, className, "text-purple-500")} style={{ textShadow: '2px 2px 0px black' }}>D</div>;
  if (weapon === 'Bow') return <div className={cn(baseClasses, className, "text-white")} style={{ textShadow: '2px 2px 0px black' }}>B</div>;
  return null;
};

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

  const weapons: { id: WeaponClass; desc: string }[] = [
    { 
      id: 'Sword', 
      desc: `SLOW, TANK, STUN` 
    },
    { 
      id: 'Dagger', 
      desc: `FAST, FRAGILE, MULTIPLE DASH` 
    },
    { 
      id: 'Bow', 
      desc: `RANGED, LIFESTEAL` 
    },
  ];

  const currentTaunt = SHOP_TAUNTS.find(t => t.id === profile.selectedTaunt) || SHOP_TAUNTS[0];
  const currentColorName = [...BATTLE_AURAS, ...PREMIUM_AURAS].find(a => a.id === profile.color)?.label || "Arena Identity";

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="scanline" />
      
      {authUser && <ShopSidebar />}

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
        <header className="text-center py-8">
          <h1 className="flex flex-col items-center justify-center font-headline tracking-tighter animate-bounce-subtle select-none">
            <span 
              className="text-7xl md:text-9xl text-[#f43f5e] mb-[-0.25em] z-10" 
              style={{ 
                WebkitTextStroke: '16px #4c0519', 
                paintOrder: 'stroke fill',
                textShadow: '0 10px 0px #4c0519',
                letterSpacing: '-0.06em'
              }}
            >
              colorful
            </span>
            <span 
              className="text-7xl md:text-9xl text-[#fffbeb] z-0" 
              style={{ 
                WebkitTextStroke: '16px #4c0519', 
                paintOrder: 'stroke fill',
                textShadow: '0 10px 0px #4c0519',
                letterSpacing: '-0.06em'
              }}
            >
              sausages
            </span>
          </h1>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="cartoon-card bg-black/60 backdrop-blur-md border-4 border-black p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="space-y-1">
                <h3 className="flex items-center gap-2 font-headline text-2xl text-accent">
                  <User className="w-6 h-6" />
                  CHARACTER ID
                </h3>
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
            </div>
            
            <div className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="name" className="font-bold text-sm uppercase">CHAR NAME</Label>
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
                <Label className="font-bold text-sm uppercase">CURRENT TAUNT</Label>
                <div className="flex items-center gap-3 bg-black/40 p-4 rounded-2xl border-2 border-black">
                  <span className="text-4xl">{currentTaunt.id}</span>
                  <div className="flex flex-col">
                    <span className="font-headline text-sm text-white uppercase tracking-widest">{currentTaunt.label}</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <Label className="font-bold text-sm uppercase">CURRENT COLOUR</Label>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3 bg-black/40 p-3 rounded-2xl border-2 border-black">
                    <div 
                      className={cn(
                        "w-10 h-10 rounded-full border-4 border-black",
                        profile.color?.startsWith?.('aura-') ? profile.color : ""
                      )} 
                      style={{ backgroundColor: profile.color?.startsWith?.('aura-') ? "" : profile.color }}
                    />
                    <div className="flex flex-col">
                      <span className="font-headline text-sm text-white uppercase tracking-widest">
                        {currentColorName}
                      </span>
                    </div>
                  </div>

                  {!authUser && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {BATTLE_AURAS.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => updateProfile({ color: a.id })}
                          className={cn(
                            "w-8 h-8 rounded-full border-4 transition-all",
                            profile.color === a.id ? "scale-125 border-white shadow-lg" : "border-black hover:scale-110"
                          )}
                          style={{ backgroundColor: a.id }}
                          title={a.label}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="cartoon-card bg-black/60 backdrop-blur-md border-4 border-black p-6 space-y-6">
            <div className="border-b border-white/10 pb-4">
              <h3 className="flex items-center gap-2 font-headline text-2xl text-primary">
                <Zap className="w-6 h-6" />
                SELECT ARSENAL
              </h3>
            </div>
            <div className="space-y-4">
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
            </div>
          </div>
        </div>

        <div className="flex justify-center pt-8">
          <Button 
            className="cartoon-button bg-primary text-white w-full max-w-[320px] h-16 text-2xl hover:scale-105 active:scale-95 shadow-[0_4px_15px_rgba(59,130,246,0.3)]"
            onClick={handlePlay}
            disabled={!profile.name.trim()}
          >
            ENTER LOBBY
          </Button>
        </div>
      </div>
    </div>
  );
}
