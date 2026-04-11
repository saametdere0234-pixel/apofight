"use client";

import { useLocalPlayer } from '@/hooks/use-local-player';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Sword, Wand2, Shield, Sparkles, User, Trophy } from 'lucide-react';
import { WeaponClass, WEAPON_STATS } from '@/lib/game-types';
import { useRouter } from 'next/navigation';

export default function EntryScreen() {
  const { profile, updateProfile, generateName, loading } = useLocalPlayer();
  const router = useRouter();

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
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
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4">
      <div className="scanline"></div>
      
      <div className="w-full max-w-2xl space-y-8 relative z-20">
        <header className="text-center space-y-2">
          <h1 className="text-6xl font-headline font-bold text-primary tracking-tighter italic">
            APO54 <span className="text-accent">BATTLEGROUND</span>
          </h1>
          <p className="text-muted-foreground uppercase tracking-widest text-sm font-medium">Real-time Arena Combat System v1.0</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-card/50 backdrop-blur border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-accent" />
                Player Identity
              </CardTitle>
              <CardDescription>How the arena will remember you</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Display Name</Label>
                <div className="flex gap-2">
                  <Input 
                    id="name" 
                    placeholder="Enter warrior name..." 
                    value={profile.name}
                    onChange={(e) => updateProfile({ name: e.target.value })}
                    className="bg-background/50"
                  />
                  <Button variant="outline" size="icon" onClick={generateName} title="Generate Name">
                    <Sparkles className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  <span className="font-bold">Global Medals</span>
                </div>
                <span className="text-2xl font-headline font-bold text-accent">{profile.medals}</span>
              </div>
              <div className="space-y-2">
                <Label>Aura Color</Label>
                <div className="flex gap-2 flex-wrap">
                  {['#2B72EE', '#EE2B2B', '#2BEE5C', '#E4EE2B', '#EE2BE4', '#7ED7EB'].map(c => (
                    <button
                      key={c}
                      onClick={() => updateProfile({ color: c })}
                      className={`w-8 h-8 rounded-full border-2 transition-transform ${profile.color === c ? 'scale-125 border-white shadow-lg shadow-white/20' : 'border-transparent hover:scale-110'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sword className="w-5 h-5 text-accent" />
                Select Arsenal
              </CardTitle>
              <CardDescription>Choose your combat style</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {weapons.map((w) => (
                <button
                  key={w.id}
                  onClick={() => updateProfile({ weaponClass: w.id })}
                  className={`w-full p-4 flex items-start gap-4 rounded-xl border-2 transition-all text-left ${profile.weaponClass === w.id ? 'border-primary bg-primary/10' : 'border-border bg-background/30 hover:border-primary/50'}`}
                >
                  <div className={`p-2 rounded-lg ${profile.weaponClass === w.id ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}>
                    <w.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg leading-none mb-1">{w.id}</h4>
                    <p className="text-xs text-muted-foreground">{w.desc}</p>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-center">
          <Button 
            size="lg" 
            className="w-full max-w-sm h-16 text-2xl font-headline font-bold uppercase tracking-widest shadow-xl shadow-primary/20 group overflow-hidden"
            onClick={handlePlay}
          >
            <span className="relative z-10">Enter Combat Lobby</span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer" />
          </Button>
        </div>
      </div>
    </div>
  );
}
