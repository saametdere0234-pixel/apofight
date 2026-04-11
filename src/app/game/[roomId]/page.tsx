"use client";

import { useEffect, useRef, useState, use } from 'react';
import { useLocalPlayer } from '@/hooks/use-local-player';
import { db } from '@/lib/firebase';
import { ref, onValue, set, update, onDisconnect, remove } from 'firebase/database';
import { GamePlayer, GameRoom, ARENA_SIZE, PIXELS_PER_METER, PLAYER_WIDTH, PLAYER_HEIGHT, WEAPON_STATS, WeaponClass } from '@/lib/game-types';
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
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [keys, setKeys] = useState<Set<string>>(new Set());
  
  // Handle Player Connection & Presence
  useEffect(() => {
    if (profileLoading || !profile || !db) return;

    const roomRef = ref(db, `rooms/${roomId}`);
    const myPlayerRef = ref(db, `rooms/${roomId}/players/${profile.id}`);
    
    // Initial Join
    const initialPlayer: GamePlayer = {
      ...profile,
      x: Math.random() * (ARENA_SIZE - 2) + 1,
      y: Math.random() * (ARENA_SIZE - 2) + 1,
      hp: 1000,
      angle: 0,
      isDashing: false,
      dashCooldown: 0,
      lastAttackTime: 0,
      isAttacking: false,
      attackProgress: 0,
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

  // Game Loop & Input Handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => setKeys(prev => new Set(prev).add(e.code));
    const handleKeyUp = (e: KeyboardEvent) => setKeys(prev => {
      const next = new Set(prev);
      next.delete(e.code);
      return next;
    });
    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      setMousePos({
        x: (e.clientX - rect.left) / PIXELS_PER_METER,
        y: (e.clientY - rect.top) / PIXELS_PER_METER
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);

    let lastTime = performance.now();
    let frameId: number;

    const loop = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      if (profile && room?.players?.[profile.id]) {
        updateGameLogic(dt);
      }
      render();
      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(frameId);
    };
  }, [profile, room]);

  const updateGameLogic = (dt: number) => {
    if (!profile || !room || !room.players[profile.id] || !db) return;
    const p = room.players[profile.id];
    
    let nextX = p.x;
    let nextY = p.y;
    const speed = 5 * dt;

    // Movement
    if (keys.has('KeyW')) nextY -= speed;
    if (keys.has('KeyS')) nextY += speed;
    if (keys.has('KeyA')) nextX -= speed;
    if (keys.has('KeyD')) nextX += speed;

    // Boundaries
    nextX = Math.max(0.5, Math.min(ARENA_SIZE - 0.5, nextX));
    nextY = Math.max(0.5, Math.min(ARENA_SIZE - 0.5, nextY));

    // Dash
    let isDashing = p.isDashing;
    let dashCooldown = Math.max(0, p.dashCooldown - dt);
    if (keys.has('Space') && dashCooldown <= 0) {
      const angle = Math.atan2(mousePos.y - p.y, mousePos.x - p.x);
      nextX += Math.cos(angle) * 2;
      nextY += Math.sin(angle) * 2;
      dashCooldown = 4;
    }

    // Angle to cursor
    const angle = Math.atan2(mousePos.y - p.y, mousePos.x - p.x);

    // Update Local and Remote
    const myPlayerRef = ref(db, `rooms/${roomId}/players/${profile.id}`);
    update(myPlayerRef, {
      x: nextX,
      y: nextY,
      angle,
      dashCooldown,
      isDashing
    });
  };

  const handleAttack = () => {
    if (!profile || !room || !room.players[profile.id] || !db) return;
    const p = room.players[profile.id];
    const stats = WEAPON_STATS[p.weaponClass as WeaponClass];
    
    const now = Date.now();
    if (now - p.lastAttackTime < stats.delay * 1000) return;

    // Collision Detection
    Object.entries(room.players).forEach(([id, enemy]) => {
      if (id === profile.id || enemy.hp <= 0) return;
      
      const dx = enemy.x - p.x;
      const dy = enemy.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const enemyAngle = Math.atan2(dy, dx);
      const angleDiff = Math.abs(p.angle - enemyAngle);
      
      if (dist <= stats.range && (stats.tolerance === 0 || angleDiff < stats.tolerance)) {
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
      // Game Over - I Won
      updateProfile({ medals: profile.medals + 1 });
      update(roomRef, { status: 'finished' });
    } else {
      // Round Over - Restart Positions
      update(roomRef, { status: 'round_over' });
      setTimeout(() => {
        Object.keys(room.players).forEach(pid => {
          update(ref(db, `rooms/${roomId}/players/${pid}`), {
            hp: 1000,
            x: Math.random() * 20 + 5,
            y: Math.random() * 20 + 5
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

    // Clear
    ctx.fillStyle = '#101419';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid
    ctx.strokeStyle = 'rgba(43, 114, 238, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= ARENA_SIZE; i++) {
      ctx.beginPath(); ctx.moveTo(i * PIXELS_PER_METER, 0); ctx.lineTo(i * PIXELS_PER_METER, canvas.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * PIXELS_PER_METER); ctx.lineTo(canvas.width, i * PIXELS_PER_METER); ctx.stroke();
    }

    // Players
    Object.values(room.players).forEach(p => {
      if (p.hp <= 0) return;

      ctx.save();
      ctx.translate(p.x * PIXELS_PER_METER, p.y * PIXELS_PER_METER);
      ctx.rotate(p.angle);

      // Body
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = p.color;
      ctx.fillRect(-PLAYER_WIDTH * PIXELS_PER_METER / 2, -PLAYER_HEIGHT * PIXELS_PER_METER / 2, PLAYER_WIDTH * PIXELS_PER_METER, PLAYER_HEIGHT * PIXELS_PER_METER);
      
      // Weapon Visual
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(15, 0);
      ctx.stroke();

      ctx.restore();

      // HP Bar overhead
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(p.x * PIXELS_PER_METER - 20, p.y * PIXELS_PER_METER - 35, 40, 5);
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(p.x * PIXELS_PER_METER - 20, p.y * PIXELS_PER_METER - 35, (p.hp / 1000) * 40, 5);
      
      // Name
      ctx.fillStyle = '#fff';
      ctx.font = '10px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(p.name, p.x * PIXELS_PER_METER, p.y * PIXELS_PER_METER - 40);
    });

    // Reticle
    ctx.strokeStyle = '#7ED7EB';
    ctx.beginPath();
    ctx.arc(mousePos.x * PIXELS_PER_METER, mousePos.y * PIXELS_PER_METER, 5, 0, Math.PI * 2);
    ctx.stroke();
  };

  if (profileLoading || !profile) return null;

  if (!db) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 text-center space-y-6">
        <AlertTriangle className="w-16 h-16 text-destructive animate-pulse" />
        <h1 className="text-3xl font-headline font-bold text-white">COMMUNICATIONS OFFLINE</h1>
        <p className="max-w-md text-muted-foreground">
          The arena combat system requires a Firebase Realtime Database connection. 
          Please check the command center (lobby) for more details.
        </p>
        <Button onClick={() => router.push('/lobby')} variant="outline">RETURN TO LOBBY</Button>
      </div>
    );
  }

  const myP = room?.players?.[profile.id];

  return (
    <div className="min-h-screen bg-background overflow-hidden flex flex-col items-center select-none">
      <header className="w-full p-4 flex justify-between items-center bg-black/20 backdrop-blur border-b border-accent/10 z-50">
        <div className="flex items-center gap-6">
          <Button variant="ghost" size="sm" onClick={() => router.push('/lobby')} className="text-muted-foreground hover:text-white">
            <ArrowLeft className="w-4 h-4 mr-2" />
            EXIT ARENA
          </Button>
          <div className="h-8 w-px bg-border" />
          <div className="flex flex-col">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Match Session</span>
            <span className="text-lg font-headline font-bold text-white uppercase">{room?.name || 'Loading Arena...'}</span>
          </div>
        </div>

        <div className="flex items-center gap-8">
           {Object.values(room?.players || {}).map(p => (
             <div key={p.id} className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-muted-foreground uppercase mb-1">{p.name}</span>
                <div className="flex gap-1">
                  {[1, 2, 3].map(i => (
                    <div key={i} className={`w-3 h-3 rounded-full border border-white/20 ${i <= (p.roundsWon || 0) ? 'bg-accent shadow-glow' : 'bg-transparent'}`} />
                  ))}
                </div>
             </div>
           ))}
        </div>
      </header>

      <main className="flex-1 w-full relative flex items-center justify-center p-4">
        <div className="relative game-canvas-container shadow-2xl shadow-primary/10">
          <canvas 
            ref={canvasRef} 
            width={600} 
            height={600} 
            className="w-full h-full cursor-none" 
            onMouseDown={handleAttack}
          />
          {room?.status === 'round_over' && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
              <h2 className="text-5xl font-headline font-bold text-accent animate-pulse uppercase italic">ROUND OVER</h2>
            </div>
          )}
          {room?.status === 'finished' && (
             <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center z-50 p-8 text-center space-y-4">
                <Trophy className="w-20 h-20 text-yellow-500 mb-4" />
                <h2 className="text-4xl font-headline font-bold text-white uppercase tracking-tighter">Mission Accomplished</h2>
                <p className="text-muted-foreground">The match has concluded. Return to command center to view updated standings.</p>
                <Button onClick={() => router.push('/lobby')} size="lg" className="font-headline font-bold w-full max-w-xs">RETURN TO LOBBY</Button>
             </div>
          )}
        </div>

        {/* HUD Overlay */}
        <div className="absolute bottom-8 left-8 flex flex-col gap-4 w-64 p-4 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 shadow-2xl">
          <div className="space-y-1">
            <div className="flex justify-between items-end mb-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Integrity</span>
              <span className="text-lg font-headline font-bold text-white">{myP?.hp || 0} HP</span>
            </div>
            <Progress value={(myP?.hp || 0) / 10} className="h-2 bg-white/5" />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
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
                <span className="text-[10px] font-bold text-muted-foreground uppercase block">Dash Drive</span>
                <div className="flex items-center gap-2 text-primary">
                   <Zap className={`w-4 h-4 ${myP?.dashCooldown && myP.dashCooldown > 0 ? 'opacity-30' : 'opacity-100'}`} />
                   <span className="text-xs font-bold uppercase">{myP?.dashCooldown && myP.dashCooldown > 0 ? `${myP.dashCooldown.toFixed(1)}s` : 'READY'}</span>
                </div>
             </div>
          </div>
        </div>

        <div className="absolute top-1/2 right-8 -translate-y-1/2 hidden lg:flex flex-col gap-2 p-4 bg-black/20 rounded-xl border border-white/5">
           <span className="text-[10px] font-bold text-muted-foreground uppercase mb-2">Controls</span>
           <div className="flex items-center gap-2">
              <div className="w-6 h-6 border rounded bg-white/5 flex items-center justify-center text-[10px]">W</div>
              <div className="w-6 h-6 border rounded bg-white/5 flex items-center justify-center text-[10px]">A</div>
              <div className="w-6 h-6 border rounded bg-white/5 flex items-center justify-center text-[10px]">S</div>
              <div className="w-6 h-6 border rounded bg-white/5 flex items-center justify-center text-[10px]">D</div>
              <span className="text-[10px] text-muted-foreground ml-2">Move</span>
           </div>
           <div className="flex items-center gap-2">
              <div className="px-3 h-6 border rounded bg-white/5 flex items-center justify-center text-[10px]">SPACE</div>
              <span className="text-[10px] text-muted-foreground ml-2">Dash</span>
           </div>
           <div className="flex items-center gap-2">
              <div className="px-3 h-6 border rounded bg-white/5 flex items-center justify-center text-[10px]">L-CLICK</div>
              <span className="text-[10px] text-muted-foreground ml-2">Strike</span>
           </div>
        </div>
      </main>
    </div>
  );
}
