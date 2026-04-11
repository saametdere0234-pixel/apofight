"use client";

import { useEffect, useRef, useState, use, useCallback } from 'react';
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
  MOVE_SPEED,
  DASH_DISTANCE,
  DASH_COOLDOWN_TIME,
  FAST_FALL_SPEED
} from '@/lib/game-types';
import { useRouter } from 'next/navigation';
import { Progress } from '@/components/ui/progress';
import { Trophy, Shield, Sword, Wand2, ArrowLeft, Zap, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GamePage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const { profile, loading: profileLoading, updateProfile } = useLocalPlayer();
  const router = useRouter();
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const [room, setRoom] = useState<GameRoom | null>(null);
  const roomRefState = useRef<GameRoom | null>(null);
  const [keys] = useState<Set<string>>(new Set());
  
  useEffect(() => {
    roomRefState.current = room;
  }, [room]);

  const getMaxDashCharges = (weapon: WeaponClass) => (weapon === 'Dagger' ? 2 : 1);

  useEffect(() => {
    if (profileLoading || !profile || !db) return;

    const roomPath = ref(db, `rooms/${roomId}`);
    const myPlayerRef = ref(db, `rooms/${roomId}/players/${profile.id}`);
    
    const initialPlayer: GamePlayer = {
      ...profile,
      x: Math.random() * (ARENA_WIDTH - 5) + 2,
      y: GROUND_Y - PLAYER_HEIGHT,
      vy: 0,
      hp: 1000,
      facing: 'right',
      isJumping: false,
      jumpCount: 0,
      dashCharges: getMaxDashCharges(profile.weaponClass),
      dashRechargeProgress: 0,
      lastAttackTime: 0,
      roundsWon: 0
    };

    set(myPlayerRef, initialPlayer);
    onDisconnect(myPlayerRef).remove();

    const unsubscribe = onValue(roomPath, (snapshot) => {
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

  const updateGameLogic = useCallback((dt: number) => {
    const currentRoom = roomRefState.current;
    if (!profile || !currentRoom || !currentRoom.players?.[profile.id] || !db) return;
    
    const p = currentRoom.players[profile.id];
    const maxCharges = getMaxDashCharges(p.weaponClass as WeaponClass);
    
    let nextX = p.x;
    let nextY = p.y;
    let nextVy = p.vy;
    let nextFacing = p.facing;
    let nextDashCharges = p.dashCharges;
    let nextDashRechargeProgress = p.dashRechargeProgress || 0;
    let nextJumpCount = p.jumpCount || 0;

    // Gravity
    nextVy += GRAVITY * dt;
    
    // Fast Fall
    if (p.isJumping && (keys.has('KeyS') || keys.has('ArrowDown'))) {
      nextVy = Math.max(nextVy, FAST_FALL_SPEED);
    }

    nextY += nextVy * dt;

    // Movement
    if (keys.has('KeyA') || keys.has('ArrowLeft')) {
      nextX -= MOVE_SPEED * dt;
      nextFacing = 'left';
    }
    if (keys.has('KeyD') || keys.has('ArrowRight')) {
      nextX += MOVE_SPEED * dt;
      nextFacing = 'right';
    }

    // Ground Collision
    let isJumping = true;
    if (nextY >= GROUND_Y - PLAYER_HEIGHT) {
      nextY = GROUND_Y - PLAYER_HEIGHT;
      nextVy = 0;
      isJumping = false;
      nextJumpCount = 0; // Reset jump count on ground
    }

    // Boundaries
    nextX = Math.max(0, Math.min(ARENA_WIDTH - PLAYER_WIDTH, nextX));

    // Dash Recharge Logic
    if (nextDashCharges < maxCharges) {
      nextDashRechargeProgress += dt;
      if (nextDashRechargeProgress >= DASH_COOLDOWN_TIME) {
        nextDashCharges++;
        nextDashRechargeProgress = 0;
      }
    } else {
      nextDashRechargeProgress = 0;
    }

    const myPlayerRef = ref(db, `rooms/${roomId}/players/${profile.id}`);
    update(myPlayerRef, {
      x: nextX,
      y: nextY,
      vy: nextVy,
      facing: nextFacing,
      isJumping,
      jumpCount: nextJumpCount,
      dashCharges: nextDashCharges,
      dashRechargeProgress: nextDashRechargeProgress
    });
  }, [profile, roomId, keys]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keys.add(e.code);
      
      const currentRoom = roomRefState.current;
      if (!profile || !currentRoom || !currentRoom.players?.[profile.id] || !db || currentRoom.status !== 'playing') return;
      const p = currentRoom.players[profile.id];

      // Jump Logic (Double Jump)
      if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        const currentJumpCount = p.jumpCount || 0;
        if (currentJumpCount < 2) {
          update(ref(db, `rooms/${roomId}/players/${profile.id}`), {
            vy: JUMP_FORCE,
            isJumping: true,
            jumpCount: currentJumpCount + 1
          });
        }
      }
      
      // Dash Logic
      if (e.code === 'Space') {
        if (p.dashCharges > 0) {
          const dx = mouseRef.current.x - (p.x + PLAYER_WIDTH/2);
          const dy = mouseRef.current.y - (p.y + PLAYER_HEIGHT/2);
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist > 0.1) {
            const dashX = (dx / dist) * DASH_DISTANCE;
            const dashY = (dy / dist) * DASH_DISTANCE;
            
            const newX = Math.max(0, Math.min(ARENA_WIDTH - PLAYER_WIDTH, p.x + dashX));
            const newY = Math.max(0, Math.min(GROUND_Y - PLAYER_HEIGHT, p.y + dashY));
            
            update(ref(db, `rooms/${roomId}/players/${profile.id}`), {
              x: newX,
              y: newY,
              dashCharges: p.dashCharges - 1
            });
          }
        }
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => keys.delete(e.code);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    let lastTime = performance.now();
    let frameId: number;

    const loop = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      const currentRoom = roomRefState.current;
      if (profile && currentRoom?.players?.[profile.id] && currentRoom.status === 'playing') {
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
  }, [profile, updateGameLogic, keys, roomId]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / (rect.width / (ARENA_WIDTH * PIXELS_PER_METER)) / PIXELS_PER_METER;
    const y = (e.clientY - rect.top) / (rect.height / (ARENA_HEIGHT * PIXELS_PER_METER)) / PIXELS_PER_METER;
    mouseRef.current = { x, y };
  };

  const handleAttack = () => {
    const currentRoom = roomRefState.current;
    if (!profile || !currentRoom || !currentRoom.players?.[profile.id] || !db || currentRoom.status !== 'playing') return;
    
    const p = currentRoom.players[profile.id];
    const weapon = p.weaponClass as WeaponClass;
    const stats = WEAPON_STATS[weapon];
    
    const now = Date.now();
    if (now - (p.lastAttackTime || 0) < stats.delay * 1000) return;

    const px = p.x + PLAYER_WIDTH / 2;
    const py = p.y + PLAYER_HEIGHT / 2;
    const mx = mouseRef.current.x;
    const my = mouseRef.current.y;

    const attackAngle = Math.atan2(my - py, mx - px);

    Object.entries(currentRoom.players).forEach(([id, enemy]) => {
      if (id === profile.id || enemy.hp <= 0) return;
      
      const ex = enemy.x + PLAYER_WIDTH / 2;
      const ey = enemy.y + PLAYER_HEIGHT / 2;
      
      const dx = ex - px;
      const dy = ey - py;
      const distToEnemy = Math.sqrt(dx * dx + dy * dy);

      if (distToEnemy <= stats.range) {
        if (weapon === 'Dagger') {
          thisHit(id, enemy);
        } else {
          const enemyAngle = Math.atan2(dy, dx);
          let diff = Math.abs(enemyAngle - attackAngle);
          if (diff > Math.PI) diff = 2 * Math.PI - diff;
          
          const angleInDegrees = diff * (180 / Math.PI);
          if (angleInDegrees <= stats.angle / 2) {
            thisHit(id, enemy);
          }
        }
      }
    });

    update(ref(db, `rooms/${roomId}/players/${profile.id}`), {
      lastAttackTime: now
    });
  };

  const thisHit = (id: string, enemy: GamePlayer) => {
    if (!db || !roomId) return;
    const p = roomRefState.current?.players?.[profile.id];
    if (!p) return;
    const stats = WEAPON_STATS[p.weaponClass as WeaponClass];
    const enemyRef = ref(db, `rooms/${roomId}/players/${id}`);
    const newHp = Math.max(0, enemy.hp - stats.damage);
    update(enemyRef, { hp: newHp });

    if (newHp === 0) {
      handleKill(id);
    }
  };

  const handleKill = (victimId: string) => {
    const currentRoom = roomRefState.current;
    if (!currentRoom || !profile || !db) return;
    const roomRef = ref(db, `rooms/${roomId}`);
    const winnersRounds = (currentRoom.players[profile.id].roundsWon || 0) + 1;
    
    update(ref(db, `rooms/${roomId}/players/${profile.id}`), { roundsWon: winnersRounds });

    if (winnersRounds >= 3) {
      updateProfile({ medals: profile.medals + 1 });
      update(roomRef, { status: 'finished' });
    } else {
      update(roomRef, { status: 'round_over' });
      setTimeout(() => {
        const currentData = roomRefState.current;
        if (!currentData) return;
        Object.keys(currentData.players).forEach(pid => {
          const p = currentData.players[pid];
          update(ref(db, `rooms/${roomId}/players/${pid}`), {
            hp: 1000,
            x: Math.random() * (ARENA_WIDTH - 5) + 2,
            y: GROUND_Y - PLAYER_HEIGHT,
            vy: 0,
            jumpCount: 0,
            dashCharges: getMaxDashCharges(p.weaponClass as WeaponClass),
            dashRechargeProgress: 0
          });
        });
        update(roomRef, { status: 'playing' });
      }, 2000);
    }
  };

  const startMatch = () => {
    if (!db || !roomId) return;
    update(ref(db, `rooms/${roomId}`), { status: 'playing' });
  };

  const render = () => {
    const canvas = canvasRef.current;
    const currentRoom = roomRefState.current;
    if (!canvas || !currentRoom) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#1a1a20';
    ctx.fillRect(0, GROUND_Y * PIXELS_PER_METER, canvas.width, (ARENA_HEIGHT - GROUND_Y) * PIXELS_PER_METER);
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for(let i=0; i < ARENA_WIDTH; i++) {
        ctx.beginPath();
        ctx.moveTo(i * PIXELS_PER_METER, 0);
        ctx.lineTo(i * PIXELS_PER_METER, canvas.height);
        ctx.stroke();
    }

    Object.values(currentRoom.players || {}).forEach(p => {
      if (p.hp <= 0 && currentRoom.status === 'playing') return;

      const px = p.x * PIXELS_PER_METER;
      const py = p.y * PIXELS_PER_METER;
      const pw = PLAYER_WIDTH * PIXELS_PER_METER;
      const ph = PLAYER_HEIGHT * PIXELS_PER_METER;

      ctx.shadowBlur = 15;
      ctx.shadowColor = p.color;
      ctx.fillStyle = p.color;
      ctx.fillRect(px, py, pw, ph);
      ctx.shadowBlur = 0;

      ctx.fillStyle = 'white';
      const eyeX = p.facing === 'right' ? px + pw - 8 : px + 4;
      ctx.fillRect(eyeX, py + 10, 4, 4);

      const weapon = p.weaponClass as WeaponClass;
      const stats = WEAPON_STATS[weapon];
      const now = Date.now();
      const attackDuration = 150;
      const timeSinceAttack = now - (p.lastAttackTime || 0);
      const isAttacking = timeSinceAttack < attackDuration;
      
      if (isAttacking) {
        const opacity = 1 - (timeSinceAttack / attackDuration);
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.3})`;
        ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.5})`;
        ctx.lineWidth = 2;

        const centerX = px + pw / 2;
        const centerY = py + ph / 2;

        if (weapon === 'Dagger') {
          ctx.beginPath();
          ctx.arc(centerX, centerY, stats.range * PIXELS_PER_METER, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else {
          const targetAngle = Math.atan2(mouseRef.current.y - (p.y + PLAYER_HEIGHT/2), mouseRef.current.x - (p.x + PLAYER_WIDTH/2));
          const halfAngle = (stats.angle / 2) * (Math.PI / 180);
          
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.arc(centerX, centerY, stats.range * PIXELS_PER_METER, targetAngle - halfAngle, targetAngle + halfAngle);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      }

      if (currentRoom.status !== 'lobby') {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(px, py - 15, pw, 5);
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(px, py - 15, (p.hp / 1000) * pw, 5);
      }
      
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(p.name, px + pw/2, py - 20);
    });

    ctx.strokeStyle = 'rgba(191, 90, 60, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(mouseRef.current.x * PIXELS_PER_METER, mouseRef.current.y * PIXELS_PER_METER, 5, 0, Math.PI * 2);
    ctx.stroke();
  };

  if (profileLoading || !profile) return null;

  const myP = room?.players?.[profile.id];
  const maxDash = getMaxDashCharges(myP?.weaponClass as WeaponClass || 'Sword');

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
            onMouseMove={handleMouseMove}
            onClick={handleAttack}
          />
          
          {room?.status === 'lobby' && (
             <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center z-50 space-y-8">
                <div className="text-center space-y-2">
                  <h2 className="text-4xl font-headline font-bold text-white uppercase italic tracking-tighter">WAITING FOR COMBATANTS</h2>
                  <p className="text-muted-foreground text-sm uppercase tracking-widest">Gathering warriors in the arena...</p>
                </div>
                <div className="flex gap-4">
                  {Object.values(room.players).map(p => (
                    <div key={p.id} className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-lg" style={{ backgroundColor: p.color }} />
                      <span className="text-[10px] font-bold text-white uppercase">{p.name}</span>
                    </div>
                  ))}
                </div>
                <Button onClick={startMatch} size="lg" className="font-headline font-bold px-12 h-14 text-xl">
                  <Play className="w-6 h-6 mr-2 fill-current" />
                  INITIATE COMBAT
                </Button>
             </div>
          )}

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

        <div className="absolute bottom-12 left-12 flex flex-col gap-6 w-72 p-6 rounded-3xl bg-black/60 backdrop-blur-2xl border border-white/10 shadow-2xl">
          <div className="space-y-2">
             <div className="flex justify-between items-end">
               <span className="text-[10px] font-bold text-muted-foreground uppercase">Stability</span>
               <span className="text-xl font-headline font-bold text-white">{myP?.hp || 0} HP</span>
             </div>
             <Progress value={(myP?.hp || 0) / 10} className="h-3 bg-white/5" />
          </div>

          <div className="space-y-3 pt-2">
             <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase">
                <span>Phase Dash</span>
                <span className={myP?.dashCharges === maxDash ? 'text-accent' : 'text-muted-foreground'}>
                  {myP?.dashCharges} / {maxDash}
                </span>
             </div>
             <div className="flex gap-2 h-2">
                {[...Array(maxDash)].map((_, i) => {
                  const isFull = i < (myP?.dashCharges || 0);
                  const isCharging = i === (myP?.dashCharges || 0);
                  const progress = isCharging ? ((myP?.dashRechargeProgress || 0) / DASH_COOLDOWN_TIME) * 100 : isFull ? 100 : 0;
                  
                  return (
                    <div key={i} className="flex-1 bg-white/5 rounded-full overflow-hidden border border-white/5 relative">
                      <div 
                        className={`h-full transition-all duration-300 ease-linear ${isFull ? 'bg-accent' : 'bg-accent/40'}`} 
                        style={{ width: `${progress}%` }} 
                      />
                    </div>
                  );
                })}
             </div>
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
                <span className="text-[10px] font-bold text-muted-foreground uppercase block">Combat Type</span>
                <div className="flex items-center gap-1 text-white">
                  <Zap className="w-3 h-3 text-yellow-500" />
                  <span className="text-xs font-bold uppercase">{myP?.weaponClass === 'Dagger' ? 'AoE' : 'Cone'}</span>
                </div>
             </div>
          </div>
        </div>
      </main>
    </div>
  );
}
