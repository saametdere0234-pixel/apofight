"use client";

import { useEffect, useRef, useState, use } from 'react';
import { useLocalPlayer } from '@/hooks/use-local-player';
import { db } from '@/lib/firebase';
import { ref, onValue, set, update, onDisconnect, remove } from 'firebase/database';
import { 
  GamePlayer, 
  GameRoom, 
  ARENA_WIDTH, 
  ARENA_HEIGHT, 
  GROUND_Y, 
  PIXELS_PER_METER, 
  PLAYER_WIDTH, 
  PLAYER_HEIGHT, 
  WEAPON_STATS, 
  WeaponClass,
  GRAVITY,
  JUMP_FORCE,
  MOVE_SPEED
} from '@/lib/game-types';
import { useRouter } from 'next/navigation';
import { Progress } from '@/components/ui/progress';
import { Trophy, Shield, Sword, Wand2, ArrowLeft, Zap, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GamePage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const { profile, loading: profileLoading, updateProfile } = useLocalPlayer();
  const router = useRouter();
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [keys, setKeys] = useState<Set<string>>(new Set());
  
  useEffect(() => {
    if (profileLoading || !profile || !db) return;

    const roomRef = ref(db, `rooms/${roomId}`);
    const myPlayerRef = ref(db, `rooms/${roomId}/players/${profile.id}`);
    
    const initialPlayer: GamePlayer = {
      ...profile,
      x: Math.random() * (ARENA_WIDTH - 10) + 5,
      y: GROUND_Y - PLAYER_HEIGHT,
      vy: 0,
      hp: 1000,
      facing: 'right',
      isJumping: false,
      dashCooldown: 0,
      lastAttackTime: 0,
      roundsWon: 0
    };

    set(myPlayerRef, initialPlayer);
    onDisconnect(myPlayerRef).remove();

    const unsubscribe = onValue(roomRef, (snapshot) => {
      if (!snapshot.exists()) {
        router.push('/lobby');
        return;
      }
      setRoom(snapshot.val());
    });

    return () => {
      unsubscribe();
      remove(myPlayerRef);
    };
  }, [profile, profileLoading, roomId, router]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => setKeys(prev => new Set(prev).add(e.code));
    const handleKeyUp = (e: KeyboardEvent) => setKeys(prev => {
      const next = new Set(prev);
      next.delete(e.code);
      return next;
    });

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    let lastTime = performance.now();
    let frameId: number;

    const loop = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      if (profile && room?.players?.[profile.id] && room.status === 'playing') {
        updateGameLogic(dt);
      }
      render();
      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(frameId);
    };
  }, [profile, room]);

  const updateGameLogic = (dt: number) => {
    if (!profile || !room || !room.players[profile.id] || !db) return;
    const p = room.players[profile.id];
    
    let nextX = p.x;
    let nextY = p.y;
    let nextVy = p.vy;
    let nextFacing = p.facing;

    // Gravity
    nextVy += GRAVITY * dt;
    nextY += nextVy * dt;

    // Movement
    if (keys.has('KeyA')) {
      nextX -= MOVE_SPEED * dt;
      nextFacing = 'left';
    }
    if (keys.has('KeyD')) {
      nextX += MOVE_SPEED * dt;
      nextFacing = 'right';
    }

    // Jumping
    if (keys.has('KeyW') && !p.isJumping && p.y >= GROUND_Y - PLAYER_HEIGHT) {
      nextVy = JUMP_FORCE;
    }

    // Ground Collision
    let isJumping = true;
    if (nextY >= GROUND_Y - PLAYER_HEIGHT) {
      nextY = GROUND_Y - PLAYER_HEIGHT;
      nextVy = 0;
      isJumping = false;
    }

    // Boundaries
    nextX = Math.max(0, Math.min(ARENA_WIDTH - PLAYER_WIDTH, nextX));

    // Update Remote
    const myPlayerRef = ref(db, `rooms/${roomId}/players/${profile.id}`);
    update(myPlayerRef, {
      x: nextX,
      y: nextY,
      vy: nextVy,
      facing: nextFacing,
      isJumping,
      dashCooldown: Math.max(0, (p.dashCooldown || 0) - dt)
    });
  };

  const handleAttack = () => {
    if (!profile || !room || !room.players[profile.id] || !db || room.status !== 'playing') return;
    const p = room.players[profile.id];
    const stats = WEAPON_STATS[p.weaponClass as WeaponClass];
    
    const now = Date.now();
    if (now - (p.lastAttackTime || 0) < stats.delay * 1000) return;

    // Box Collision for attack
    const attackX = p.facing === 'right' ? p.x + PLAYER_WIDTH : p.x - stats.range;
    const attackY = p.y;
    const attackRect = {
      x: attackX,
      y: attackY,
      w: stats.range,
      h: PLAYER_HEIGHT
    };

    Object.entries(room.players).forEach(([id, enemy]) => {
      if (id === profile.id || enemy.hp <= 0) return;
      
      // Simple rect collision
      if (
        enemy.x < attackRect.x + attackRect.w &&
        enemy.x + PLAYER_WIDTH > attackRect.x &&
        enemy.y < attackRect.y + attackRect.h &&
        enemy.y + PLAYER_HEIGHT > attackRect.y
      ) {
        const enemyRef = ref(db, `rooms/${roomId}/players/${id}`);
        const newHp = Math.max(0, enemy.hp - stats.damage);
        update(enemyRef, { hp: newHp });

        if (newHp === 0) {
          handleKill(id);
        }
      }
    });

    update(ref(db, `rooms/${roomId}/players/${profile.id}`), {
      lastAttackTime: now
    });
  };

  const handleKill = (victimId: string) => {
    if (!room || !profile || !db) return;
    const roomRef = ref(db, `rooms/${roomId}`);
    const winnersRounds = (room.players[profile.id].roundsWon || 0) + 1;
    update(ref(db, `rooms/${roomId}/players/${profile.id}`), { roundsWon: winnersRounds });

    if (winnersRounds >= 3) {
      updateProfile({ medals: profile.medals + 1 });
      update(roomRef, { status: 'finished' });
    } else {
      update(roomRef, { status: 'round_over' });
      setTimeout(() => {
        Object.keys(room.players).forEach(pid => {
          update(ref(db, `rooms/${roomId}/players/${pid}`), {
            hp: 1000,
            x: Math.random() * (ARENA_WIDTH - 10) + 5,
            y: GROUND_Y - PLAYER_HEIGHT,
            vy: 0
          });
        });
        update(roomRef, { status: 'playing' });
      }, 2000);
    }
  };

  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas || !room) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear background
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Render Stage
    ctx.fillStyle = '#1a1a20';
    ctx.fillRect(0, GROUND_Y * PIXELS_PER_METER, canvas.width, (ARENA_HEIGHT - GROUND_Y) * PIXELS_PER_METER);
    
    // Stage Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for(let i=0; i < ARENA_WIDTH; i++) {
        ctx.beginPath();
        ctx.moveTo(i * PIXELS_PER_METER, 0);
        ctx.lineTo(i * PIXELS_PER_METER, canvas.height);
        ctx.stroke();
    }

    // Render Players
    Object.values(room.players).forEach(p => {
      if (p.hp <= 0) return;

      const px = p.x * PIXELS_PER_METER;
      const py = p.y * PIXELS_PER_METER;
      const pw = PLAYER_WIDTH * PIXELS_PER_METER;
      const ph = PLAYER_HEIGHT * PIXELS_PER_METER;

      // Glow effect
      ctx.shadowBlur = 15;
      ctx.shadowColor = p.color;

      // Player Body
      ctx.fillStyle = p.color;
      ctx.fillRect(px, py, pw, ph);
      ctx.shadowBlur = 0;

      // Facing indicator
      ctx.fillStyle = 'white';
      const eyeX = p.facing === 'right' ? px + pw - 8 : px + 4;
      ctx.fillRect(eyeX, py + 10, 4, 4);

      // Weapon
      const stats = WEAPON_STATS[p.weaponClass as WeaponClass];
      const now = Date.now();
      const isAttacking = now - (p.lastAttackTime || 0) < 150;
      
      if (isAttacking) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        const weaponX = p.facing === 'right' ? px + pw : px - (stats.range * PIXELS_PER_METER);
        ctx.fillRect(weaponX, py, stats.range * PIXELS_PER_METER, ph);
      }

      // HP Bar overhead
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(px, py - 15, pw, 5);
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(px, py - 15, (p.hp / 1000) * pw, 5);
      
      // Name
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(p.name, px + pw/2, py - 20);
    });
  };

  if (profileLoading || !profile) return null;

  if (!db) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 text-center space-y-6">
        <AlertTriangle className="w-16 h-16 text-destructive animate-pulse" />
        <h1 className="text-3xl font-headline font-bold text-white">COMMUNICATIONS OFFLINE</h1>
        <p className="max-w-md text-muted-foreground">Database required for combat. Return to HQ.</p>
        <Button onClick={() => router.push('/lobby')} variant="outline">RETURN TO HQ</Button>
      </div>
    );
  }

  const myP = room?.players?.[profile.id];

  return (
    <div className="min-h-screen bg-background overflow-hidden flex flex-col items-center select-none">
      <header className="w-full p-4 flex justify-between items-center bg-black/40 backdrop-blur-md border-b border-white/5 z-50">
        <div className="flex items-center gap-6">
          <Button variant="ghost" size="sm" onClick={() => router.push('/lobby')} className="text-muted-foreground hover:text-white">
            <ArrowLeft className="w-4 h-4 mr-2" />
            ABANDON FIGHT
          </Button>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Stage</span>
            <span className="text-lg font-headline font-bold text-white uppercase">{room?.name || 'Loading...'}</span>
          </div>
        </div>

        <div className="flex items-center gap-8">
           {Object.values(room?.players || {}).map(p => (
             <div key={p.id} className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-muted-foreground uppercase mb-1">{p.name}</span>
                <div className="flex gap-1">
                  {[1, 2, 3].map(i => (
                    <div key={i} className={`w-3 h-3 rounded-full border border-white/20 ${i <= (p.roundsWon || 0) ? 'bg-accent shadow-[0_0_8px_hsl(var(--accent))]' : 'bg-transparent'}`} />
                  ))}
                </div>
             </div>
           ))}
        </div>
      </header>

      <main className="flex-1 w-full relative flex items-center justify-center p-4">
        <div className="relative game-canvas-container border-4 border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] bg-slate-950">
          <canvas 
            ref={canvasRef} 
            width={ARENA_WIDTH * PIXELS_PER_METER} 
            height={ARENA_HEIGHT * PIXELS_PER_METER} 
            className="w-full h-auto cursor-crosshair" 
            onClick={handleAttack}
          />
          {room?.status === 'round_over' && (
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
              <h2 className="text-6xl font-headline font-bold text-accent animate-bounce uppercase italic tracking-tighter">ROUND END</h2>
            </div>
          )}
          {room?.status === 'finished' && (
             <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center z-50 p-8 text-center space-y-6">
                <Trophy className="w-24 h-24 text-yellow-500 animate-pulse" />
                <h2 className="text-5xl font-headline font-bold text-white uppercase tracking-tighter">CHAMPION DECLARED</h2>
                <Button onClick={() => router.push('/lobby')} size="lg" className="font-headline font-bold px-12">BACK TO LOBBY</Button>
             </div>
          )}
        </div>

        {/* HUD Overlay */}
        <div className="absolute bottom-12 left-12 flex flex-col gap-6 w-72 p-6 rounded-3xl bg-black/60 backdrop-blur-2xl border border-white/10 shadow-2xl">
          <div className="space-y-2">
             <div className="flex justify-between items-end">
               <span className="text-[10px] font-bold text-muted-foreground uppercase">Stability</span>
               <span className="text-xl font-headline font-bold text-white">{myP?.hp || 0} HP</span>
             </div>
             <Progress value={(myP?.hp || 0) / 10} className="h-3 bg-white/5" />
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
             <div className="space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase block">Arsenal</span>
                <div className="flex items-center gap-2 text-accent">
                   {myP?.weaponClass === 'Sword' && <Sword className="w-4 h-4" />}
                   {myP?.weaponClass === 'Dagger' && <Shield className="w-4 h-4" />}
                   {myP?.weaponClass === 'Bow' && <Wand2 className="w-4 h-4" />}
                   <span className="text-xs font-bold uppercase">{myP?.weaponClass}</span>
                </div>
             </div>
             <div className="space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase block">Controls</span>
                <span className="text-xs font-bold text-white uppercase">W A D + CLICK</span>
             </div>
          </div>
        </div>
      </main>
    </div>
  );
}
