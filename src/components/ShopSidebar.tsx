"use client";

import { useState } from 'react';
import { useLocalPlayer } from '@/hooks/use-local-player';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ShoppingBag, Palette, Ghost, Lock, Check, ShieldCheck, Sparkles, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
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
  { id: 'aura-g1', label: 'Mystic Berry', class: 'aura-g1' },
  { id: 'aura-g2', label: 'Cyan Sky', class: 'aura-g2' },
  { id: 'aura-g3', label: 'Flaming Sun', class: 'aura-g3' },
  { id: 'aura-g4', label: 'Emerald Mint', class: 'aura-g4' },
  { id: 'aura-g5', label: 'Night Mist', class: 'aura-g5' },
  { id: 'aura-g6', label: 'Deep Ocean', class: 'aura-g6' },
  { id: 'aura-g7', label: 'Royal Violet', class: 'aura-g7' },
  { id: 'aura-g8', label: 'Candy Rush', class: 'aura-g8' },
  { id: 'aura-g9', label: 'Space Abyss', class: 'aura-g9' },
  { id: 'aura-g10', label: 'Neon Velvet', class: 'aura-g10' },
];

const SHOP_TAUNTS = ['😂', '😎', '😶‍🌫️', '😱', '🤢', '🤡', '💩'];
const PREMIUM_PRICE = 200;
const TAUNT_PRICE = 100;

export function ShopSidebar() {
  const { profile, updateProfile, authUser } = useLocalPlayer();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [purchaseItem, setPurchaseItem] = useState<{ id: string; label: string; type: 'aura' | 'no-border' | 'taunt' } | null>(null);

  if (!authUser || !profile) return null;

  const handlePurchaseConfirm = () => {
    if (!purchaseItem) return;
    const gold = profile.gold || 0;
    const price = purchaseItem.type === 'taunt' ? TAUNT_PRICE : PREMIUM_PRICE;

    if (gold < price) {
      toast({ variant: "destructive", title: "INSUFFICIENT GOLD!" });
      setPurchaseItem(null);
      return;
    }

    const updates: any = { gold: gold - price };

    if (purchaseItem.type === 'aura') {
      updates.unlockedAuras = [...(profile.unlockedAuras || []), purchaseItem.id];
      updates.color = purchaseItem.id;
    } else if (purchaseItem.type === 'no-border') {
      updates.noBorderOwned = true;
      updates.noBorderEnabled = true;
    } else if (purchaseItem.type === 'taunt') {
      updates.unlockedTaunts = [...(profile.unlockedTaunts || []), purchaseItem.id];
      updates.selectedTaunt = purchaseItem.id;
    }

    updateProfile(updates);
    toast({ title: "PURCHASE SUCCESSFUL!", description: `-${price} GOLD` });
    setPurchaseItem(null);
  };

  const selectColor = (id: string, isPremium: boolean) => {
    if (!isPremium) {
      updateProfile({ color: id });
      return;
    }
    const unlocked = profile.unlockedAuras || [];
    if (unlocked.includes(id)) {
      updateProfile({ color: id });
    } else {
      const aura = PREMIUM_AURAS.find(a => a.id === id);
      if (aura) setPurchaseItem({ id: aura.id, label: aura.label, type: 'aura' });
    }
  };

  const selectTaunt = (taunt: string) => {
    const unlocked = profile.unlockedTaunts || ['😂'];
    if (unlocked.includes(taunt)) {
      updateProfile({ selectedTaunt: taunt });
    } else {
      setPurchaseItem({ id: taunt, label: taunt, type: 'taunt' });
    }
  };

  const toggleNoBorder = (enabled: boolean) => {
    if (profile.noBorderOwned) {
      updateProfile({ noBorderEnabled: enabled });
    } else {
      setPurchaseItem({ id: 'no-border', label: 'NO BORDER MODE', type: 'no-border' });
    }
  };

  return (
    <>
      <div className={cn(
        "fixed left-4 top-24 bottom-4 z-[1001] transition-transform duration-300 flex",
        isOpen ? "translate-x-0" : "translate-x-[calc(-100%+12px)]"
      )}>
        <div className="w-80 bg-black/90 backdrop-blur-xl border-4 border-black p-6 flex flex-col gap-6 shadow-[10px_0_30px_rgba(0,0,0,0.5)] rounded-[30px] overflow-hidden">
          <div className="flex justify-between items-center border-b-4 border-black pb-4">
            <h3 className="font-headline text-2xl text-primary uppercase flex items-center gap-2">
              <ShoppingBag className="w-6 h-6" /> SHOP
            </h3>
            <div className="flex items-center gap-2 bg-black/40 px-3 py-1 rounded-full border-2 border-accent/20">
              <Wallet className="w-4 h-4 text-accent" />
              <span className="font-headline text-lg text-accent">{profile.gold || 0}</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-8 scrollbar-hide">
            {/* TAUNTS */}
            <section className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-headline text-sm text-white/40 uppercase tracking-widest flex items-center gap-2">
                  <Ghost className="w-4 h-4" /> TAUNTS
                </h4>
                <span className="text-[10px] font-bold text-accent">100G EACH</span>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {SHOP_TAUNTS.map(t => {
                  const isUnlocked = (profile.unlockedTaunts || ['😂']).includes(t);
                  const isSelected = profile.selectedTaunt === t;
                  return (
                    <button
                      key={t}
                      onClick={() => selectTaunt(t)}
                      className={cn(
                        "w-full aspect-square rounded-2xl border-4 transition-all flex items-center justify-center text-2xl relative",
                        isSelected ? "border-white bg-white/10 scale-110 shadow-[0_0_15px_rgba(255,255,255,0.3)]" : "border-black bg-black/40 hover:scale-105",
                        !isUnlocked && "opacity-60"
                      )}
                    >
                      {t}
                      {!isUnlocked && <Lock className="absolute -top-1 -right-1 w-4 h-4 text-white drop-shadow-md" />}
                      {isUnlocked && isSelected && <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-black flex items-center justify-center"><Check className="w-2 h-2 text-white" /></div>}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* BORDER MOD */}
            <section className="space-y-4">
              <div className="flex items-center justify-between bg-black/40 p-4 rounded-[20px] border-4 border-black group">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-lg border-2 border-black transition-colors",
                    profile.noBorderOwned ? "bg-accent" : "bg-zinc-800"
                  )}>
                    {profile.noBorderOwned ? <ShieldCheck className="w-5 h-5 text-black" /> : <Lock className="w-5 h-5 text-white/40" />}
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="font-headline text-sm text-white leading-none">NO BORDER</span>
                    <span className="text-[10px] font-bold text-white/40 uppercase">200 GOLD</span>
                  </div>
                </div>
                <Button 
                  onClick={() => toggleNoBorder(!profile.noBorderEnabled)}
                  className={cn(
                    "h-8 px-3 cartoon-button text-[10px]",
                    profile.noBorderOwned ? (profile.noBorderEnabled ? "bg-accent text-black" : "bg-white/10 text-white") : "bg-primary text-white"
                  )}
                >
                  {profile.noBorderOwned ? (profile.noBorderEnabled ? 'ON' : 'OFF') : 'BUY'}
                </Button>
              </div>
            </section>

            {/* COLOURS */}
            <section className="space-y-4">
              <h4 className="font-headline text-sm text-white/40 uppercase tracking-widest flex items-center gap-2">
                <Palette className="w-4 h-4" /> BATTLE COLOURS
              </h4>
              <div className="flex gap-2 flex-wrap">
                {BATTLE_AURAS.map(a => (
                  <button
                    key={a.id}
                    title={a.label}
                    onClick={() => selectColor(a.id, false)}
                    className={cn(
                      "w-8 h-8 rounded-full border-4 transition-all",
                      profile.color === a.id ? "scale-125 border-white shadow-lg" : "border-black hover:scale-110"
                    )}
                    style={{ backgroundColor: a.id }}
                  />
                ))}
              </div>

              <div className="flex justify-between items-center pt-4">
                <h4 className="font-headline text-sm text-primary uppercase tracking-widest flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> PRO COLOURS
                </h4>
                <span className="text-[10px] font-bold text-accent">200G EACH</span>
              </div>
              <div className="grid grid-cols-5 gap-3">
                {PREMIUM_AURAS.map(a => {
                  const isUnlocked = (profile.unlockedAuras || []).includes(a.id);
                  const isSelected = profile.color === a.id;
                  return (
                    <button
                      key={a.id}
                      onClick={() => selectColor(a.id, true)}
                      className={cn(
                        "w-full aspect-square rounded-full border-4 transition-all relative flex items-center justify-center overflow-hidden",
                        isSelected ? "scale-110 border-white shadow-md" : "border-black hover:scale-105",
                        !isUnlocked && "opacity-60",
                        a.class
                      )}
                    >
                      {!isUnlocked && <Lock className="w-4 h-4 text-white drop-shadow-md" />}
                      {isUnlocked && isSelected && <Check className="w-4 h-4 text-white drop-shadow-md" />}
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
        
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="w-10 h-16 my-auto bg-black/80 backdrop-blur-md border-4 border-l-0 border-black rounded-r-[20px] flex items-center justify-center hover:bg-black transition-colors shadow-[4px_0_10px_rgba(0,0,0,0.3)]"
        >
          {isOpen ? <ChevronLeft className="text-white" /> : <ChevronRight className="text-white" />}
        </button>
      </div>

      <AlertDialog open={!!purchaseItem} onOpenChange={() => setPurchaseItem(null)}>
        <AlertDialogContent className="cartoon-card bg-black/90 border-4 border-black p-8 text-white max-w-sm">
          <AlertDialogHeader className="space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full border-4 border-accent flex items-center justify-center bg-accent/20">
              <ShoppingBag className="w-8 h-8 text-accent" />
            </div>
            <AlertDialogTitle className="font-headline text-2xl text-center uppercase">CONFIRM PURCHASE?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/80 font-bold text-center uppercase text-xs">
              UNLOCK "{purchaseItem?.label || purchaseItem?.id}" FOR {purchaseItem?.type === 'taunt' ? TAUNT_PRICE : PREMIUM_PRICE} GOLD?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 flex gap-4">
            <AlertDialogCancel className="cartoon-button bg-destructive text-white flex-1 h-12">CANCEL</AlertDialogCancel>
            <AlertDialogAction onClick={handlePurchaseConfirm} className="cartoon-button bg-accent text-black flex-1 h-12">ACCEPT</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
