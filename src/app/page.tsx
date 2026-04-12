"use client";

import { useLocalPlayer } from '@/hooks/use-local-player';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Sword, Wand2, Shield, Sparkles, User, Trophy, Zap } from 'lucide-react';
import { WeaponClass, WEAPON_STATS } from '@/lib/game-types';
import { useRouter } from 'next/navigation';

export default function EntryScreen() {
  const { profile, updateProfile, generateName, loading } = useLocalPlayer();
  const router = useRouter();

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  const handlePlay = () => {
    if (!profile.name) {
      generateName();
    }
    router.push('/lobby');
  };

  const weapons: { id: WeaponClass; icon: any; desc: string }[] = [
    { 
      id: 'Sword', 
      icon: Sword, 
      desc: `Balanced: ${WEAPON_STATS.Sword.damage} DMG, ${WEAPON_STATS.Sword.range}m Cone, ${WEAPON_STATS.Sword.delay}s Delay` 
    },
    { 
      id: 'Dagger', 
      icon: Shield, 
      desc: `Fast: ${WEAPON_STATS.Dagger.damage} DMG, ${WEAPON_STATS.Dagger.range}m AoE, ${WEAPON_STATS.Dagger.delay}s Delay` 
    },
    { 
      id: 'Bow', 
      icon: Wand2, 
      desc: `Range: ${WEAPON_STATS.Bow.damage} DMG, ${WEAPON_STATS.Bow.range}m Range, 30% Life Steal` 
    },
  ];

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="scanline"></div>
      
      {/* Cartoon Background Elements */}
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
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-headline text-2xl text-accent">
                <User className="w-6 h-6" />
                CHARACTER ID
              </CardTitle>
              <CardDescription className="font-bold text-white/60">YOUR ARENA LEGACY BEGINS HERE</CardDescription>
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
                    className="bg-black/20 border-4 border-black rounded-[15px] h-14 font-bold text-lg"
                  />
                  <Button 
                    variant="outline" 
                    onClick={generateName} 
                    className="cartoon-button bg-accent text-black h-14 w-14 p-0"
                  >
                    <Sparkles className="w-6 h-6" />
                  </Button>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-black/30 rounded-[20px] border-2 border-white/5">
                <div className="flex items-center gap-3">
                  <div className="bg-yellow-500 p-2 rounded-lg border-2 border-black">
                    <Trophy className="w-6 h-6 text-black" />
                  </div>
                  <span className="font-headline text-xl">MEDALS</span>
                </div>
                <span className="text-4xl font-headline text-accent">{profile.medals}</span>
              </div>

              <div className="space-y-3">
                <Label className="font-bold text-sm uppercase">BATTLE AURA</Label>
                <div className="flex gap-3 flex-wrap">
                  {['#2B72EE', '#EE2B2B', '#2BEE5C', '#E4EE2B', '#EE2BE4', '#7ED7EB'].map(c => (
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
                <Sword className="w-6 h-6" />
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
                  <div className={`p-3 rounded-xl border-4 border-black ${profile.weaponClass === w.id ? 'bg-primary text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                    <w.icon className="w-8 h-8" />
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
          >
            ENTER THE ARENA
          </Button>
        </div>
      </div>
    </div>
  );
}
