"use client";

import { useEffect, useRef, useState, use, useCallback } from 'react';
import { useLocalPlayer } from '@/hooks/use-local-player';
import { db } from '@/lib/firebase';
import { ref, onValue, set, update, onDisconnect, remove, get, push } from 'firebase/database';
import { 
  GamePlayer, 
  GameRoom, 
  GameEffect,
  Projectile,
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
  DASH_DURATION,
  FAST_FALL_SPEED,
  STAMINA_MAX,
  STAMINA_REGEN_RATE,
  STAMINA_DASH_COST,
  STAMINA_DASH_COST_DAGGER,
  STAMINA_ATTACK_COST,
  STUN_DURATION,
  STUN_COOLDOWN,
  SPAWN_POINTS
} from '@/lib/game-types';
import { useRouter } from 'next/navigation';
import { Trophy, ArrowLeft, Play, Zap, Heart, Users, Crown, RotateCcw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FeedbackState {
  lastReloadFail: number;
  lastStaminaFail: number;
  lastDashFail: number;
  staminaMsg: string;
}

const WeaponIcon = ({ weapon, className = "w-6 h-6" }: { weapon: WeaponClass; className?: string }) => {
  if (weapon === 'Sword') {
    return (
      <div className={className}>
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <path d="M12 20L28 4L30 6L14 22L12 20Z" fill="#38bdf8" stroke="black" strokeWidth="2.5" strokeLinejoin="round"/>
          <path d="M14 22L16 24L28 12L26 10L14 22Z" fill="#0ea5e9" stroke="black" strokeWidth="2.5" strokeLinejoin="round"/>
          <path d="M10 18L18 26" stroke="black" strokeWidth="5" strokeLinecap="round"/>
          <path d="M10 18L18 26" stroke="#facc15" strokeWidth="2.5" strokeLinecap="round"/>
          <path d="M10 22L4 28" stroke="black" strokeWidth="5" strokeLinecap="round"/>
          <path d="M10 22L4 28" stroke="#78350f" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      </div>
    );
  }
  if (weapon === 'Dagger') {
    return (
      <div className={className}>
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <path d="M16 16L24 8L28 12L20 20L16 16Z" fill="#d946ef" stroke="black" strokeWidth="2.5" strokeLinejoin="round"/>
          <path d="M16 16L20 20L26 14L22 10L16 16Z" fill="#f5d0fe" stroke="black" strokeWidth="2.5" strokeLinejoin="round"/>
          <path d="M14 14L20 20" stroke="black" strokeWidth="5" strokeLinecap="round"/>
          <path d="M14 14L20 20" stroke="#701a75" strokeWidth="2.5" strokeLinecap="round"/>
          <path d="M14 18L8 24" stroke="black" strokeWidth="5" strokeLinecap="round"/>
          <path d="M14 18L8 24" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      </div>
    );
  }
  if (weapon === 'Bow') {
    return (
      <div className={className}>
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <path d="M8 8C16 8 24 16 24 24" stroke="black" strokeWidth="5" strokeLinecap="round" fill="none"/>
          <path d="M8 8C16 8 24 16 24 24" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
          <path d="M8 8L24 24" stroke="black" strokeWidth="1.5" strokeDasharray="2 2" />
          <circle cx="16" cy="16" r="3" fill="#ca8a04" stroke="black" strokeWidth="1.5" />
        </svg>
      </div>
    );
  }
  return null;
};

const getBestSpawnPoint = (points: typeof SPAWN_POINTS, existingPositions: {x: number, y: number}[]) => {
  if (existingPositions.length === 0) {
    return points[Math.floor(Math.random() * points.length)];
  }
  
  let bestPoint = points[0];
  let maxMinDist = -1;
  
  points.forEach(point => {
    let minDist = Infinity;
    existingPositions.forEach(pos => {
      const d = Math.sqrt(Math.pow(point.x - pos.x, 2) + Math.pow(point.y - pos.y, 2));
      if (d < minDist) minDist = d;
    });
    
    if (minDist > maxMinDist) {
      maxMinDist = minDist;
      bestPoint = point;
    } else if (minDist === maxMinDist) {
      if (Math.random() > 0.5) bestPoint = point;
    }
  });
  
  return bestPoint;
};

export default function GamePage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const { profile, loading: profileLoading } = useLocalPlayer();
  const router = useRouter();
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [room, setRoom] = useState<GameRoom | null>(null);
  const roomRef = useRef<GameRoom | null>(null);
  const [keys] = useState<Set<string>>(new Set());
  const [isConnected, setIsConnected] = useState(true);
  const [isCharging, setIsCharging] = useState(false);
  
  const [flash, setFlash] = useState<{ type: 'taken' | 'dealt' | null, time: number }>({ type: null, time: 0 });
  const [shakeUntil, setShakeUntil] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackState>({
    lastReloadFail: 0,
    lastStaminaFail: 0,
    lastDashFail: 0,
    staminaMsg: ''
  });

  const [localEffects, setLocalEffects] = useState<GameEffect[]>([]);
  const lastHpRef = useRef<number>(1000);
  const [recentHeal, setRecentHeal] = useState<{ amount: number, time: number } | null>(null);

  // Network Optimization State
  const interpPlayersRef = useRef<Record<string, GamePlayer>>({});
  const lastSyncTimeRef = useRef(0);

  const handleQuit = useCallback(async () => {
    if (!db || !roomId || !profile) return;
    const roomPath = ref(db, `rooms/${roomId}`);
    const myPlayerRef = ref(db, `rooms/${roomId}/players/${profile.id}`);
    
    const snapshot = await get(roomPath);
    if (snapshot.exists()) {
      const roomData = snapshot.val() as GameRoom;
      const otherPlayers = Object.keys(roomData.players || {}).filter(id => id !== profile.id);
      
      if (otherPlayers.length === 0) {
        await remove(roomPath);
      } else {
        await remove(myPlayerRef);
      }
    }
    router.push('/lobby');
  }, [profile, roomId, router]);

  const handlePlayAgain = useCallback(async () => {
    if (!db || !roomId || !profile) return;
    const myPlayerRef = ref(db, `rooms/${roomId}/players/${profile.id}`);
    update(myPlayerRef, { isReady: true });
  }, [roomId, profile]);

  const isHost = room && profile ? profile.id === room.createdBy : false;

  useEffect(() => {
    if (!db) return;
    const connectedRef = ref(db, '.info/connected');
    const unsubscribe = onValue(connectedRef, (snap) => {
      setIsConnected(snap.val() === true);
    });
    return () => unsubscribe();
  }, []);

  // Room Monitoring Effect
  useEffect(() => {
    roomRef.current = room;
    if (room?.players) {
      const pIds = Object.keys(room.players).sort();
      const playerCount = pIds.length;
      const hostPresent = !!room.players[room.createdBy];

      // Host Transfer
      if (!hostPresent && playerCount > 0) {
        const nextHostId = pIds[0];
        if (profile?.id === nextHostId) {
          update(ref(db, `rooms/${roomId}`), { createdBy: nextHostId });
        }
      }

      // Single Player Reset
      if (playerCount === 1 && room.status !== 'lobby') {
        const onlyPlayerId = pIds[0];
        if (onlyPlayerId === profile?.id) {
          const updates: any = {
            status: 'lobby',
            lastWinnerName: null,
            startTime: null,
            effects: null,
            projectiles: null
          };
          updates[`players/${onlyPlayerId}/roundsWon`] = 0;
          updates[`players/${onlyPlayerId}/isReady`] = true;
          update(ref(db, `rooms/${roomId}`), updates);
        }
      }

      // Sync Effects
      if (room.effects) {
        const now = Date.now();
        const effects = Object.values(room.effects).filter(e => now - e.timestamp < 1000);
        setLocalEffects(effects);
      } else {
        setLocalEffects([]);
      }

      // Play Again Reset Sync
      if (room.status === 'finished') {
        const players = Object.values(room.players);
        const allReady = players.every(p => p.isReady);
        if (allReady && isHost) {
          const updates: any = {
            status: 'lobby',
            lastWinnerName: null,
            startTime: null,
            effects: null,
            projectiles: null
          };
          players.forEach(p => {
            updates[`players/${p.id}/roundsWon`] = 0;
          });
          update(ref(db, `rooms/${roomId}`), updates);
        }
      }

      // Host Round Logic
      if (room.status === 'playing' && isHost) {
        const players = Object.values(room.players);
        const alivePlayers = players.filter(p => p.hp > 0);
        
        if (players.length >= 2) {
          if (alivePlayers.length === 1) {
            handleKill(alivePlayers[0].id);
          } else if (alivePlayers.length === 0) {
            handleDraw();
          }
        }
      }
    }
  }, [room, profile?.id, roomId, isHost]);

  // Dedicated Countdown & Round Transition Effect (Host Only)
  useEffect(() => {
    if (!db || !roomId || !room || !isHost) return;

    // Transition: Starting -> Playing (Countdown)
    if (room.status === 'starting' && room.startTime) {
      const elapsed = Date.now() - room.startTime;
      const remaining = Math.max(0, 3500 - elapsed);
      const timer = setTimeout(() => {
        update(ref(db, `rooms/${roomId}`), { status: 'playing' });
      }, remaining);
      return () => clearTimeout(timer);
    }

    // Transition: Round Over -> Starting (Next Round)
    if (room.status === 'round_over') {
      const timer = setTimeout(() => {
        const currentData = roomRef.current;
        if (!currentData || currentData.status !== 'round_over') return;
        prepareNextRound(currentData);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [room?.status, room?.startTime, isHost, roomId]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      if (recentHeal && now - recentHeal.time > 1000) {
        setRecentHeal(null);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [recentHeal]);

  useEffect(() => {
    if (!profile || !room?.players?.[profile.id]) return;
    const currentHp = room.players[profile.id].hp;
    if (currentHp < lastHpRef.current) {
      setFlash({ type: 'taken', time: Date.now() });
    }
    lastHpRef.current = currentHp;
  }, [room?.players, profile]);

  const getMaxDashCharges = (weapon: WeaponClass) => (weapon === 'Dagger' ? 4 : 1);

  useEffect(() => {
    if (profileLoading || !profile || !db) return;

    const roomPath = ref(db, `rooms/${roomId}`);
    const myPlayerRef = ref(db, `rooms/${roomId}/players/${profile.id}`);
    
    const weaponStats = WEAPON_STATS[profile.weaponClass] || WEAPON_STATS.Sword;

    get(roomPath).then((snapshot) => {
      if (snapshot.exists()) {
        const roomData = snapshot.val() as GameRoom;
        const playerCount = Object.keys(roomData.players || {}).length;
        const isAlreadyIn = roomData.players && roomData.players[profile.id];
        
        if (!isAlreadyIn && playerCount >= (roomData.maxPlayers || 4)) {
          router.push('/lobby');
          return;
        }

        const existingPositions = Object.values(roomData.players || {})
          .filter(p => p.hp > 0)
          .map(p => ({ x: p.x, y: p.y }));
        
        const bestSpawn = getBestSpawnPoint(SPAWN_POINTS, existingPositions);
        
        const initialPlayer: GamePlayer = {
          ...profile,
          x: bestSpawn.x,
          y: bestSpawn.y,
          vy: 0,
          hp: weaponStats.maxHp,
          stamina: STAMINA_MAX,
          facing: 'right',
          isJumping: false,
          jumpCount: 0,
          dashCharges: getMaxDashCharges(profile.weaponClass),
          dashRechargeProgress: 0,
          lastAttackTime: 0,
          roundsWon: 0,
          isDashing: false,
          dashTimeLeft: 0,
          dashDirX: 0,
          dashDirY: 0,
          stunnedUntil: 0,
          stunCooldownUntil: 0,
          isReady: true
        };

        lastHpRef.current = weaponStats.maxHp;
        
        set(myPlayerRef, initialPlayer);
        update(roomPath, { lastUpdate: Date.now() });
        onDisconnect(myPlayerRef).remove();
      }
    });

    const unsubscribe = onValue(roomPath, (snapshot) => {
      if (!snapshot.exists()) {
        router.push('/lobby');
        return;
      }
      const data = snapshot.val() as GameRoom;
      setRoom(data);
    });

    return () => {
      unsubscribe();
    };
  }, [profile, profileLoading, roomId, router]);

  const updateGameLogic = useCallback((dt: number) => {
    const currentRoom = roomRef.current;
    if (!profile || !currentRoom || !currentRoom.players?.[profile.id] || !db) return;
    
    if (currentRoom.status === 'starting' || currentRoom.status === 'round_over' || currentRoom.status === 'finished') return;

    const now = Date.now();
    const p = currentRoom.players[profile.id];

    // Projectile Movement & Collision (Owner Authority)
    if (currentRoom.projectiles) {
      Object.entries(currentRoom.projectiles).forEach(([pid, proj]) => {
        if (proj.ownerId === profile.id) {
          const elapsed = now - proj.startTime;
          const projX = proj.startX + proj.vx * (elapsed / 1000);
          const projY = proj.startY + proj.vy * (elapsed / 1000);

          let hitId: string | null = null;
          Object.entries(currentRoom.players).forEach(([eid, enemy]) => {
            if (eid === profile.id || enemy.hp <= 0) return;
            // Buffer to ensure projectiles feel fair
            const buffer = 0.5;
            if (
              projX >= enemy.x - buffer &&
              projX <= enemy.x + PLAYER_WIDTH + buffer &&
              projY >= enemy.y - buffer &&
              projY <= enemy.y + PLAYER_HEIGHT + buffer
            ) {
              hitId = eid;
            }
          });

          if (hitId) {
            thisHit(hitId, currentRoom.players[hitId], false);
            remove(ref(db, `rooms/${roomId}/projectiles/${pid}`));
          } else if (elapsed > 1500) {
            remove(ref(db, `rooms/${roomId}/projectiles/${pid}`));
          }
        }
      });
    }

    if (p.hp <= 0) return;

    const weapon = (p.weaponClass as WeaponClass) || 'Sword';
    const stats = WEAPON_STATS[weapon] || WEAPON_STATS.Sword;
    const maxCharges = getMaxDashCharges(weapon);
    const isStunned = now < (p.stunnedUntil || 0);
    
    let nextX = p.x;
    let nextY = p.y;
    let nextVy = p.vy;
    let nextFacing = p.facing;
    let nextDashCharges = p.dashCharges;
    let nextDashRechargeProgress = p.dashRechargeProgress || 0;
    let nextJumpCount = p.jumpCount || 0;
    let nextStamina = Math.min(STAMINA_MAX, (p.stamina || 0) + STAMINA_REGEN_RATE * dt);
    let isDashing = p.isDashing || false;
    let dashTimeLeft = p.dashTimeLeft || 0;

    if (isDashing && dashTimeLeft > 0) {
      const dashSpeed = DASH_DISTANCE / DASH_DURATION;
      nextX += (p.dashDirX || 0) * dashSpeed * dt;
      nextY += (p.dashDirY || 0) * dashSpeed * dt;
      dashTimeLeft -= dt;
      if (dashTimeLeft <= 0) {
        isDashing = false;
        dashTimeLeft = 0;
      }
      nextVy = 0;
    } else {
      nextVy += GRAVITY * dt;
      nextY += nextVy * dt;

      const isFastFallPressed = keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyS');
      if (p.isJumping && isFastFallPressed) {
        nextVy = Math.max(nextVy, FAST_FALL_SPEED);
      }

      if (!isStunned) {
        const isSlowed = now < (p.slowUntil || 0);
        const speed = isSlowed ? MOVE_SPEED * 0.5 : MOVE_SPEED;

        if (keys.has('KeyA') || keys.has('ArrowLeft')) {
          nextX -= speed * dt;
          nextFacing = 'left';
        }
        if (keys.has('KeyD') || keys.has('ArrowRight')) {
          nextX += speed * dt;
          nextFacing = 'right';
        }
      }
    }

    let isJumping = true;
    if (nextY >= GROUND_Y - PLAYER_HEIGHT) {
      nextY = GROUND_Y - PLAYER_HEIGHT;
      nextVy = 0;
      isJumping = false;
      nextJumpCount = 0;
    }

    nextX = Math.max(0, Math.min(ARENA_WIDTH - PLAYER_WIDTH, nextX));
    nextY = Math.max(0, Math.min(GROUND_Y - PLAYER_HEIGHT, nextY));

    if (nextDashCharges < maxCharges) {
      nextDashRechargeProgress += dt;
      if (nextDashRechargeProgress >= stats.dashCooldown) {
        nextDashCharges++;
        nextDashRechargeProgress = 0;
      }
    } else {
      nextDashRechargeProgress = 0;
    }

    const updatedLocalPlayer = {
      ...p,
      x: nextX,
      y: nextY,
      vy: nextVy,
      facing: nextFacing,
      isJumping,
      jumpCount: nextJumpCount,
      dashCharges: nextDashCharges,
      dashRechargeProgress: nextDashRechargeProgress,
      stamina: nextStamina,
      isDashing,
      dashTimeLeft
    };
    
    currentRoom.players[profile.id] = updatedLocalPlayer;
    interpPlayersRef.current[profile.id] = updatedLocalPlayer;

    if (now - lastSyncTimeRef.current > 33) {
      lastSyncTimeRef.current = now;
      const myPlayerRef = ref(db, `rooms/${roomId}/players/${profile.id}`);
      update(myPlayerRef, {
        x: nextX,
        y: nextY,
        vy: nextVy,
        facing: nextFacing,
        isJumping,
        jumpCount: nextJumpCount,
        dashCharges: nextDashCharges,
        dashRechargeProgress: nextDashRechargeProgress,
        stamina: nextStamina,
        isDashing,
        dashTimeLeft
      });
    }
  }, [profile, roomId, keys]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keys.add(e.code);
      const currentRoom = roomRef.current;
      if (!profile || !currentRoom || !currentRoom.players?.[profile.id] || !db || currentRoom.status !== 'playing') return;
      const p = currentRoom.players[profile.id];
      if (p.hp <= 0) return;
      
      const now = Date.now();
      const isStunned = now < (p.stunnedUntil || 0);
      if (isStunned) return;

      if ((e.code === 'KeyW' || e.code === 'ArrowUp') && !p.isDashing) {
        const currentJumpCount = p.jumpCount || 0;
        if (currentJumpCount < 2) {
          update(ref(db, `rooms/${roomId}/players/${profile.id}`), {
            vy: JUMP_FORCE,
            isJumping: true,
            jumpCount: currentJumpCount + 1
          });
        }
      }
      
      if (e.code === 'Space') {
        const hasCharges = p.dashCharges > 0;
        const dashCost = p.weaponClass === 'Dagger' ? STAMINA_DASH_COST_DAGGER : STAMINA_DASH_COST;
        const hasStamina = (p.stamina || 0) >= dashCost;

        if (!hasCharges || !hasStamina) {
          setShakeUntil(now + 80);
          setFeedback(prev => ({
            ...prev,
            lastDashFail: !hasCharges ? now : prev.lastDashFail,
            lastStaminaFail: !hasStamina ? now : prev.lastStaminaFail,
            staminaMsg: ''
          }));
          return;
        }

        const dx = mouseRef.current.x - (p.x + PLAYER_WIDTH/2);
        const dy = mouseRef.current.y - (p.y + PLAYER_HEIGHT/2);
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 0.1) {
          update(ref(db, `rooms/${roomId}/players/${profile.id}`), {
            isDashing: true,
            dashTimeLeft: DASH_DURATION,
            dashDirX: dx / dist,
            dashDirY: dy / dist,
            dashCharges: p.dashCharges - 1,
            stamina: (p.stamina || 0) - dashCost
          });
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
      const currentRoom = roomRef.current;
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

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });

    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    
    const internalX = offsetX * (canvas.width / rect.width);
    const internalY = offsetY * (canvas.height / rect.height);
    
    const gameX = Math.max(0, Math.min(ARENA_WIDTH, internalX / PIXELS_PER_METER));
    const gameY = Math.max(0, Math.min(ARENA_HEIGHT, internalY / PIXELS_PER_METER));
    
    mouseRef.current = { x: gameX, y: gameY };
  };

  const handleMouseDown = () => {
    const p = room?.players?.[profile?.id || ''];
    if (p?.weaponClass === 'Bow' && p.hp > 0 && room?.status === 'playing') {
      setIsCharging(true);
    } else {
      handleAttack();
    }
  };

  const handleMouseUp = () => {
    if (isCharging) {
      fireBow();
      setIsCharging(false);
    }
  };

  const fireBow = () => {
    const currentRoom = roomRef.current;
    if (!profile || !currentRoom || !currentRoom.players?.[profile.id] || !db || currentRoom.status !== 'playing') return;
    
    const p = currentRoom.players[profile.id];
    const now = Date.now();
    const weaponStats = WEAPON_STATS.Bow;
    
    const onCooldown = (weaponStats.delay * 1000) - (now - (p.lastAttackTime || 0)) > 0;
    const hasStamina = (p.stamina || 0) >= weaponStats.staminaAttackCost;

    if (onCooldown || !hasStamina) {
      setShakeUntil(now + 80);
      setFeedback(prev => ({
        ...prev,
        lastReloadFail: onCooldown ? now : prev.lastReloadFail,
        lastStaminaFail: !hasStamina ? now : prev.lastStaminaFail,
        staminaMsg: ''
      }));
      return;
    }

    const px = p.x + PLAYER_WIDTH / 2;
    const py = p.y + PLAYER_HEIGHT / 2;
    const mx = mouseRef.current.x;
    const my = mouseRef.current.y;
    const attackAngle = Math.atan2(my - py, mx - px);

    const speed = weaponStats.range / 1.5; // reaches range in 1.5s
    const vx = Math.cos(attackAngle) * speed;
    const vy = Math.sin(attackAngle) * speed;

    const projRef = push(ref(db, `rooms/${roomId}/projectiles`));
    set(projRef, {
      id: projRef.key,
      ownerId: profile.id,
      startX: px,
      startY: py,
      vx,
      vy,
      startTime: now,
      range: weaponStats.range,
      damage: weaponStats.damage
    });

    update(ref(db, `rooms/${roomId}/players/${profile.id}`), {
      lastAttackTime: now,
      lastAttackAngle: attackAngle,
      stamina: (p.stamina || 0) - weaponStats.staminaAttackCost
    });
  };

  const handleAttack = () => {
    const currentRoom = roomRef.current;
    if (!profile || !currentRoom || !currentRoom.players?.[profile.id] || !db || currentRoom.status !== 'playing') return;
    
    const p = currentRoom.players[profile.id];
    if (p.hp <= 0) return;

    const now = Date.now();
    const isStunned = now < (p.stunnedUntil || 0);
    if (isStunned) return;

    const weapon = (p.weaponClass as WeaponClass) || 'Sword';
    if (weapon === 'Bow') return; // Handled by mouseDown/Up

    const weaponStats = WEAPON_STATS[weapon] || WEAPON_STATS.Sword;
    
    const reloadRemaining = (weaponStats.delay * 1000) - (now - (p.lastAttackTime || 0));
    const onCooldown = reloadRemaining > 0;
    const hasStamina = (p.stamina || 0) >= weaponStats.staminaAttackCost;

    if (onCooldown || !hasStamina) {
      setShakeUntil(now + 80);
      setFeedback(prev => ({
        ...prev,
        lastReloadFail: onCooldown ? now : prev.lastReloadFail,
        lastStaminaFail: !hasStamina ? now : prev.lastStaminaFail,
        staminaMsg: ''
      }));
      return;
    }

    const px = p.x + PLAYER_WIDTH / 2;
    const py = p.y + PLAYER_HEIGHT / 2;
    const mx = mouseRef.current.x;
    const my = mouseRef.current.y;
    const attackAngle = Math.atan2(my - py, mx - px);

    let stunAppliedThisSwing = false;
    const canStun = weapon === 'Sword' && now > (p.stunCooldownUntil || 0);

    update(ref(db, `rooms/${roomId}/players/${profile.id}`), {
      lastAttackTime: now,
      lastAttackAngle: attackAngle,
      stamina: (p.stamina || 0) - weaponStats.staminaAttackCost
    });

    Object.entries(currentRoom.players).forEach(([id, enemy]) => {
      if (id === profile.id || enemy.hp <= 0) return;
      
      const ex = enemy.x + PLAYER_WIDTH / 2;
      const ey = enemy.y + PLAYER_HEIGHT / 2;
      
      const dx = ex - px;
      const dy = ey - py;
      const distToEnemyCenter = Math.sqrt(dx * dx + dy * dy);

      let hit = false;
      if (weapon === 'Dagger') {
        if (distToEnemyCenter <= weaponStats.range) hit = true;
      } else if (weapon === 'Sword') {
        if (distToEnemyCenter <= weaponStats.range + 2) {
          const enemyAngle = Math.atan2(dy, dx);
          let diff = Math.abs(enemyAngle - attackAngle);
          if (diff > Math.PI) diff = 2 * Math.PI - diff;
          const angleInDegrees = diff * (180 / Math.PI);
          if (angleInDegrees <= weaponStats.angle / 2) {
            hit = true;
          }
        }
      }

      if (hit) {
        thisHit(id, enemy, canStun);
        if (canStun) stunAppliedThisSwing = true;
      }
    });

    if (stunAppliedThisSwing) {
      update(ref(db, `rooms/${roomId}/players/${profile.id}`), {
        stunCooldownUntil: now + STUN_COOLDOWN
      });
    }
  };

  const thisHit = (id: string, enemy: GamePlayer, shouldStun: boolean = false) => {
    if (!db || !roomId || !profile) return;
    const p = roomRef.current?.players?.[profile.id];
    if (!p) return;
    
    const now = Date.now();
    const weaponStats = (WEAPON_STATS[p.weaponClass as WeaponClass] || WEAPON_STATS.Sword);
    const enemyRef = ref(db, `rooms/${roomId}/players/${id}`);
    const newHp = Math.max(0, enemy.hp - weaponStats.damage);
    const updates: any = { hp: newHp };
    
    if (p.weaponClass === 'Sword') {
      updates.slowUntil = now + 400;
      if (shouldStun) {
        updates.stunnedUntil = now + STUN_DURATION;
      }
    }

    const effectsRef = ref(db, `rooms/${roomId}/effects`);
    // Push damage indicator to global database
    push(effectsRef, {
      id: Math.random().toString(),
      x: enemy.x + PLAYER_WIDTH / 2,
      y: enemy.y,
      amount: Math.round(weaponStats.damage),
      type: 'damage',
      timestamp: now
    });

    if (p.weaponClass === 'Bow') {
      const healAmount = weaponStats.damage * 0.3;
      const newMyHp = Math.min(weaponStats.maxHp, p.hp + healAmount);
      update(ref(db, `rooms/${roomId}/players/${profile.id}`), { hp: newMyHp });
      
      // Push heal indicator to global database
      push(effectsRef, {
        id: Math.random().toString(),
        x: p.x + PLAYER_WIDTH / 2,
        y: p.y,
        amount: Math.round(healAmount),
        type: 'heal',
        timestamp: now
      });
      setRecentHeal({ amount: Math.round(healAmount), time: now });
    }

    update(enemyRef, updates);
    setFlash({ type: 'dealt', time: Date.now() });
  };

  const handleKill = (winnerId: string) => {
    const currentRoom = roomRef.current;
    if (!currentRoom || !db || !isHost || currentRoom.status !== 'playing') return;
    
    const winner = currentRoom.players[winnerId];
    if (!winner) return;

    const winnersRounds = (winner.roundsWon || 0) + 1;
    const updates: any = { 
      status: winnersRounds >= 3 ? 'finished' : 'round_over',
      lastWinnerName: winner.name,
      effects: null,
      projectiles: null
    };
    updates[`players/${winnerId}/roundsWon`] = winnersRounds;
    
    if (winnersRounds >= 3) {
      Object.keys(currentRoom.players).forEach(pid => {
        updates[`players/${pid}/isReady`] = false;
      });
    }

    update(ref(db, `rooms/${roomId}`), updates);
  };

  const handleDraw = () => {
    const currentRoom = roomRef.current;
    if (!currentRoom || !db || !isHost || currentRoom.status !== 'playing') return;
    
    update(ref(db, `rooms/${roomId}`), { 
      status: 'round_over', 
      lastWinnerName: 'DRAW',
      effects: null,
      projectiles: null
    });
  };

  const prepareNextRound = (currentData: GameRoom) => {
    if (!isHost) return;
    const assignedSpawns: {x: number, y: number}[] = [];
    const nextRoundUpdates: any = {
      status: 'starting', 
      startTime: Date.now() 
    };

    Object.keys(currentData.players).forEach(pid => {
      const p = currentData.players[pid];
      const bestSpawn = getBestSpawnPoint(SPAWN_POINTS, assignedSpawns);
      assignedSpawns.push(bestSpawn);
      
      const weaponStats = (WEAPON_STATS[p.weaponClass as WeaponClass] || WEAPON_STATS.Sword);
      const pUpdates = {
        hp: weaponStats.maxHp,
        stamina: STAMINA_MAX,
        x: bestSpawn.x,
        y: bestSpawn.y,
        vy: 0,
        jumpCount: 0,
        dashCharges: getMaxDashCharges(p.weaponClass as WeaponClass || 'Sword'),
        dashRechargeProgress: 0,
        lastAttackTime: 0,
        slowUntil: 0,
        stunnedUntil: 0,
        stunCooldownUntil: 0,
        isDashing: false,
        dashTimeLeft: 0
      };
      
      Object.entries(pUpdates).forEach(([key, val]) => {
        nextRoundUpdates[`players/${pid}/${key}`] = val;
      });
    });
    
    update(ref(db, `rooms/${roomId}`), nextRoundUpdates);
  };

  const startMatch = () => {
    if (!db || !roomId || !room || !isHost) return;
    update(ref(db, `rooms/${roomId}`), { 
      status: 'starting', 
      startTime: Date.now() 
    });
  };

  const render = () => {
    const canvas = canvasRef.current;
    const currentRoom = roomRef.current;
    if (!canvas || !currentRoom) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const now = Date.now();
    ctx.fillStyle = '#000035';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#333333'; 
    ctx.fillRect(0, GROUND_Y * PIXELS_PER_METER, canvas.width, (ARENA_HEIGHT - GROUND_Y) * PIXELS_PER_METER);

    Object.values(currentRoom.players || {}).forEach(p => {
      if (p.id === profile?.id) {
        interpPlayersRef.current[p.id] = p;
      } else {
        const currentInterp = interpPlayersRef.current[p.id] || p;
        const lerpFactor = 0.25; 
        interpPlayersRef.current[p.id] = {
          ...p,
          x: currentInterp.x + (p.x - currentInterp.x) * lerpFactor,
          y: currentInterp.y + (p.y - currentInterp.y) * lerpFactor,
        };
      }
    });

    const playersToDraw = Object.values(interpPlayersRef.current);

    // Render Trajectory (Local Only)
    if (isCharging && profile) {
      const myP = currentRoom.players[profile.id];
      if (myP) {
        const px = (myP.x + PLAYER_WIDTH/2) * PIXELS_PER_METER;
        const py = (myP.y + PLAYER_HEIGHT/2) * PIXELS_PER_METER;
        const angle = Math.atan2(mouseRef.current.y - (myP.y + PLAYER_HEIGHT/2), mouseRef.current.x - (myP.x + PLAYER_WIDTH/2));
        const rx = px + Math.cos(angle) * WEAPON_STATS.Bow.range * PIXELS_PER_METER;
        const ry = py + Math.sin(angle) * WEAPON_STATS.Bow.range * PIXELS_PER_METER;
        
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.setLineDash([10, 5]);
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(rx, ry);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Render Projectiles
    if (currentRoom.projectiles) {
      Object.values(currentRoom.projectiles).forEach(proj => {
        const elapsed = now - proj.startTime;
        const px = (proj.startX + proj.vx * (elapsed / 1000)) * PIXELS_PER_METER;
        const py = (proj.startY + proj.vy * (elapsed / 1000)) * PIXELS_PER_METER;
        
        ctx.save();
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Trail
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.moveTo(px, py);
        ctx.lineTo(px - proj.vx * 0.1 * PIXELS_PER_METER, py - proj.vy * 0.1 * PIXELS_PER_METER);
        ctx.stroke();
        ctx.restore();
      });
    }

    playersToDraw.forEach(p => {
      if (p.isDashing && p.dashTimeLeft && p.dashTimeLeft > 0) {
        const progress = 1 - (p.dashTimeLeft / DASH_DURATION);
        const ghostCount = 5;
        for (let i = 1; i <= ghostCount; i++) {
          const offset = i * 0.04;
          const ghostProgress = Math.max(0, progress - offset);
          if (ghostProgress <= 0) continue;
          const dashSpeed = DASH_DISTANCE / DASH_DURATION;
          const gx = (p.x - (p.dashDirX || 0) * dashSpeed * (progress - ghostProgress)) * PIXELS_PER_METER;
          const gy = (p.y - (p.dashDirY || 0) * dashSpeed * (progress - ghostProgress)) * PIXELS_PER_METER;
          ctx.save();
          ctx.globalAlpha = 0.3 * (1 - (i / ghostCount));
          ctx.fillStyle = p.color;
          ctx.fillRect(gx, gy, PLAYER_WIDTH * PIXELS_PER_METER, PLAYER_HEIGHT * PIXELS_PER_METER);
          ctx.restore();
        }
      }
    });

    playersToDraw.forEach(p => {
      const attackDuration = 500;
      const timeSinceAttack = now - (p.lastAttackTime || 0);
      if (timeSinceAttack < attackDuration) {
        const isLocal = p.id === profile?.id;
        const baseColor = isLocal ? '38, 114, 238' : '238, 43, 43'; 
        let opacity = 0.7;
        if (timeSinceAttack > 400) opacity = 0.7 * (1 - (timeSinceAttack - 400) / 100);
        const px = p.x * PIXELS_PER_METER;
        const py = p.y * PIXELS_PER_METER;
        const centerX = px + (PLAYER_WIDTH * PIXELS_PER_METER) / 2;
        const centerY = py + (PLAYER_HEIGHT * PIXELS_PER_METER) / 2;
        ctx.save();
        ctx.fillStyle = `rgba(${baseColor}, ${opacity * 0.4})`;
        ctx.strokeStyle = `rgba(${baseColor}, ${opacity})`;
        ctx.lineWidth = 4;
        const weapon = (p.weaponClass as WeaponClass) || 'Sword';
        const weaponStats = (WEAPON_STATS[weapon] || WEAPON_STATS.Sword);
        const angle = p.lastAttackAngle || 0;
        if (weapon === 'Dagger') {
          ctx.beginPath();
          ctx.arc(centerX, centerY, weaponStats.range * PIXELS_PER_METER, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else if (weapon === 'Sword') {
          const halfAngle = (weaponStats.angle / 2) * (Math.PI / 180);
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.arc(centerX, centerY, weaponStats.range * PIXELS_PER_METER, angle - halfAngle, angle + halfAngle);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      }
    });

    playersToDraw.forEach(p => {
      if (p.hp <= 0 && (currentRoom.status === 'playing' || currentRoom.status === 'starting')) return;
      const px = p.x * PIXELS_PER_METER;
      const py = p.y * PIXELS_PER_METER;
      const pw = PLAYER_WIDTH * PIXELS_PER_METER;
      const ph = PLAYER_HEIGHT * PIXELS_PER_METER;
      const isStunned = now < (p.stunnedUntil || 0);

      ctx.save();
      ctx.fillStyle = p.color;
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 4;
      const radius = 10;
      ctx.beginPath();
      ctx.moveTo(px + radius, py);
      ctx.lineTo(px + pw - radius, py);
      ctx.quadraticCurveTo(px + pw, py, px + pw, py + radius);
      ctx.lineTo(px + pw, py + ph - radius);
      ctx.quadraticCurveTo(px + pw, py + ph, px + pw - radius, py + ph);
      ctx.lineTo(px + radius, py + ph);
      ctx.quadraticCurveTo(px, py + ph, px, py + ph - radius);
      ctx.lineTo(px, py + radius);
      ctx.quadraticCurveTo(px, py, px + radius, py);
      ctx.fill();
      ctx.stroke();

      if (now < (p.slowUntil || 0)) {
        ctx.fillStyle = 'rgba(100, 100, 255, 0.4)';
        ctx.fill();
      }
      if (isStunned) {
        ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
        ctx.fill();
        ctx.strokeStyle = 'yellow';
        ctx.lineWidth = 6;
        ctx.stroke();
      }
      ctx.restore();

      ctx.save();
      const flip = p.facing === 'right' ? 1 : -1;
      const handX = p.facing === 'right' ? px + pw - 5 : px + 5;
      const handY = py + ph * 0.55;
      ctx.translate(handX, handY);
      ctx.scale(flip, 1);
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      if (p.weaponClass === 'Sword') {
        ctx.fillStyle = '#cbd5e1'; 
        ctx.beginPath();
        ctx.moveTo(4, -2.5);
        ctx.lineTo(34, -2.5);
        ctx.lineTo(38, 0);
        ctx.lineTo(34, 2.5);
        ctx.lineTo(4, 2.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#451a03'; 
        ctx.fillRect(4, -10, 4, 20);
        ctx.strokeRect(4, -10, 4, 20);
        ctx.fillStyle = '#78350f'; 
        ctx.fillRect(-10, -3, 14, 6);
        ctx.strokeRect(-10, -3, 14, 6);
      } else if (p.weaponClass === 'Dagger') {
        ctx.fillStyle = '#94a3b8'; 
        ctx.beginPath();
        ctx.moveTo(3, -5);
        ctx.lineTo(16, -2);
        ctx.lineTo(24, 0);
        ctx.lineTo(16, 2);
        ctx.lineTo(3, 5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#f1f5f9'; 
        ctx.beginPath();
        ctx.moveTo(3, -4);
        ctx.lineTo(22, 0);
        ctx.lineTo(3, 4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#334155'; 
        ctx.fillRect(2, -8, 3, 16);
        ctx.strokeRect(2, -8, 3, 16);
        ctx.fillStyle = '#1e293b'; 
        ctx.fillRect(-8, -3, 10, 6);
        ctx.strokeRect(-8, -3, 10, 6);
      } else if (p.weaponClass === 'Bow') {
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(5, 0, 18, -Math.PI/2, Math.PI/2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(5, -16);
        ctx.lineTo(5, 16);
        ctx.stroke();
      }
      ctx.restore();

      ctx.fillStyle = 'white';
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 1;
      const eyeX = p.facing === 'right' ? px + pw - 12 : px + 4;
      ctx.beginPath();
      ctx.arc(eyeX + 4, py + 12, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'black';
      ctx.beginPath();
      ctx.arc(eyeX + 5, py + 12, 2, 0, Math.PI * 2);
      ctx.fill();

      if (currentRoom.status !== 'lobby') {
        const hpWidth = pw * 1.2;
        const hpX = px - (hpWidth - pw) / 2;
        const weaponStats = (WEAPON_STATS[p.weaponClass as WeaponClass] || WEAPON_STATS.Sword);
        ctx.fillStyle = 'black';
        ctx.fillRect(hpX, py - 18, hpWidth, 8);
        ctx.fillStyle = '#ff4444';
        const fillWidth = (p.hp / (weaponStats?.maxHp || 1000)) * (hpWidth - 4);
        ctx.fillRect(hpX + 2, py - 16, fillWidth, 4);
      }
      
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 3;
      ctx.font = 'bold 12px Inter';
      ctx.textAlign = 'center';
      ctx.strokeText(p.name, px + pw/2, py - 25);
      ctx.fillText(p.name, px + pw/2, py - 25);
    });

    localEffects.forEach((en) => {
      const elapsed = now - en.timestamp;
      if (elapsed > 800) return;
      const alpha = 1 - (elapsed / 800);
      const dy = (elapsed / 800) * 50;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = en.type === 'damage' ? '#ff4444' : '#4ade80';
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 4;
      ctx.font = 'bold 24px Space Grotesk';
      ctx.textAlign = 'center';
      const textX = en.x * PIXELS_PER_METER;
      const textY = en.y * PIXELS_PER_METER - 40 - dy;
      const prefix = en.type === 'heal' ? '+' : '';
      ctx.strokeText(prefix + en.amount.toString(), textX, textY);
      ctx.fillText(prefix + en.amount.toString(), textX, textY);
      ctx.restore();
    });
  };

  if (profileLoading || !profile) return null;
  const myP = room?.players?.[profile.id];
  const myWeaponStats = (myP && WEAPON_STATS[myP.weaponClass as WeaponClass]) ? WEAPON_STATS[myP.weaponClass as WeaponClass] : WEAPON_STATS.Sword;
  const maxDash = getMaxDashCharges(myP?.weaponClass as WeaponClass || 'Sword');
  const flashActive = Date.now() - flash.time < 200;
  const isShaking = Date.now() < shakeUntil;

  const now = Date.now();
  const alerts: { text: string, color: string, alpha: number }[] = [];
  const isStunned = myP && now < (myP.stunnedUntil || 0);
  const stunRemaining = myP ? Math.max(0, (myP.stunnedUntil || 0) - now) : 0;
  const stunCDRemaining = myP ? Math.max(0, (myP.stunCooldownUntil || 0) - now) : 0;

  if (myP) {
    const reloadRemaining = (myWeaponStats.delay * 1000) - (now - (myP.lastAttackTime || 0));
    const dashRemaining = (myWeaponStats.dashCooldown || 4.0) - (myP.dashRechargeProgress || 0);

    if (now - feedback.lastReloadFail < 500 && reloadRemaining > 0) {
      alerts.push({ text: `${(reloadRemaining / 1000).toFixed(1)}s`, color: '#ff4444', alpha: 1 - (now - feedback.lastReloadFail) / 500 });
    }
    if (now - feedback.lastDashFail < 500 && dashRemaining > 0) {
      alerts.push({ text: `${dashRemaining.toFixed(1)}s`, color: '#fbbf24', alpha: 1 - (now - feedback.lastDashFail) / 500 });
    }
    if (now - feedback.lastStaminaFail < 500) {
      alerts.push({ text: Math.floor(myP.stamina || 0).toString(), color: '#60a5fa', alpha: 1 - (now - feedback.lastStaminaFail) / 500 });
    }
  }

  const playerCount = room?.players ? Object.keys(room.players).length : 0;
  const allReady = room?.players ? Object.values(room.players).every(p => p.isReady) : false;
  const canStart = playerCount >= 2 && allReady;

  let countdownText = '';
  let showCountdown = false;
  if (room?.startTime) {
    const elapsed = now - room.startTime;
    if (room.status === 'starting') {
      showCountdown = true;
      if (elapsed < 1000) countdownText = '3';
      else if (elapsed < 2000) countdownText = '2';
      else if (elapsed < 3000) countdownText = '1';
      else countdownText = 'GO!';
    } else if (room.status === 'playing' && elapsed < 4000) {
      showCountdown = true;
      countdownText = 'GO!';
    }
  }

  const isLocalReady = myP?.isReady ?? false;
  const showResults = room?.status === 'finished' && !isLocalReady;
  const showLobby = room?.status === 'lobby' || (room?.status === 'finished' && isLocalReady);

  return (
    <div className="min-h-screen bg-[#000035] overflow-hidden flex flex-col items-center select-none" onMouseMove={handleMouseMove}>
      <div className="fixed pointer-events-none z-[9999] flex flex-col items-center gap-1 select-none" style={{ left: mousePos.x, top: mousePos.y + 35, transform: 'translateX(-50%)' }}>
        {alerts.map((alert, i) => (
          <span key={i} className="font-headline text-2xl drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]" style={{ color: alert.color, opacity: alert.alpha, WebkitTextStroke: '2px black' }}>
            {alert.text}
          </span>
        ))}
      </div>

      {playerCount === 1 && (
        <div className="w-full bg-destructive/20 py-2 border-b-4 border-black text-center z-[100]">
          <span className="font-headline text-2xl text-white tracking-widest drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]">
            WAITING FOR OPPONENTS
          </span>
        </div>
      )}

      {!isConnected && (
        <div className="w-full bg-yellow-500/80 py-2 border-b-4 border-black text-center z-[101] flex items-center justify-center gap-2">
          <WifiOff className="w-6 h-6 text-black" />
          <span className="font-headline text-2xl text-black tracking-widest drop-shadow-[1px_1px_0px_rgba(255,255,255,0.5)]">
            RECONNECTING...
          </span>
        </div>
      )}

      {flashActive && (
        <div className={`fixed inset-0 pointer-events-none z-[100] border-[40px] ${flash.type === 'taken' ? 'border-red-500/30' : 'border-blue-500/30'} animate-in fade-in duration-200`} />
      )}

      <header className="w-full p-4 flex justify-center items-center bg-black/60 backdrop-blur-xl border-b-8 border-black z-50">
        <div className="absolute left-4">
          <Button variant="ghost" onClick={handleQuit} className="cartoon-button bg-destructive text-white h-12 px-6">
            <ArrowLeft className="w-5 h-5 mr-2" />
            QUIT
          </Button>
        </div>

        <div className="flex items-center gap-4 overflow-x-auto max-w-[70vw] scrollbar-hide px-4">
          {Object.values(room?.players || {}).map(p => (
            <div key={p.id} className="flex items-center gap-3 bg-black/40 border-4 border-black rounded-[20px] p-2 px-4 shadow-[4px_4px_0px_rgba(0,0,0,1)] min-w-[180px]">
              <div className="flex flex-col items-start gap-0.5 flex-1">
                <div className="flex items-center gap-2">
                  <WeaponIcon weapon={p.weaponClass as WeaponClass} className="w-7 h-7" />
                  <span className="font-headline text-lg truncate max-w-[100px]" style={{ color: p.color, WebkitTextStroke: '1px black' }}>
                    {p.name}
                  </span>
                  {p.id === room?.createdBy && (
                    <Crown className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                  )}
                </div>
                <div className="flex gap-1.5 mt-1">
                  {[1, 2, 3].map(i => (
                    <div key={i} className={`w-3.5 h-3.5 rounded-full border-2 border-black transition-all duration-300 ${i <= (p.roundsWon || 0) ? 'bg-yellow-500 shadow-[0_0_8px_rgba(255,215,0,0.6)]' : 'bg-white/10'}`} />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </header>

      <main className="flex-1 w-full relative flex items-center justify-center p-8">
        <div className={`relative game-canvas-container ${isShaking ? 'animate-shake' : ''}`}>
          <canvas 
            ref={canvasRef} 
            width={ARENA_WIDTH * PIXELS_PER_METER} 
            height={ARENA_HEIGHT * PIXELS_PER_METER} 
            className="w-full h-auto cursor-crosshair" 
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
          />
          
          {showCountdown && (
            <div className="absolute inset-0 flex items-center justify-center z-[60] pointer-events-none">
              <span className="text-9xl font-headline text-white drop-shadow-[8px_8px_0px_rgba(0,0,0,1)] animate-in zoom-in duration-300">
                {countdownText}
              </span>
            </div>
          )}

          {showLobby && room && (
             <div className="absolute inset-0 bg-black/80 backdrop-blur-lg flex flex-col items-center justify-center z-50 space-y-10">
                <h2 className="text-7xl font-headline text-white animate-bounce-subtle">ARENA STANDBY</h2>
                <div className="flex gap-8">
                  {Object.values(room.players).map(p => (
                    <div key={p.id} className="flex flex-col items-center gap-3">
                      <div className="relative">
                        <div className="w-16 h-16 rounded-2xl border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)]" style={{ backgroundColor: p.color }} />
                        {p.id === room?.createdBy && <Crown className="absolute -top-6 -right-6 w-10 h-10 text-yellow-500 fill-yellow-500 rotate-12 drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]" />}
                        {!p.isReady && (
                          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center rounded-2xl">
                             <div className="w-6 h-6 border-2 border-white border-t-transparent animate-spin rounded-full mb-1" />
                             <span className="text-[10px] font-headline text-white tracking-widest">WAITING...</span>
                          </div>
                        )}
                      </div>
                      <span className="font-headline text-lg text-white">{p.name}</span>
                    </div>
                  ))}
                </div>
                
                <div className="flex flex-col items-center gap-4">
                  <div className="flex items-center gap-2 bg-black/40 px-6 py-2 rounded-full border-2 border-white/10">
                    <Users className="w-6 h-6 text-primary" />
                    <span className="font-headline text-2xl text-white">{playerCount} / {room.maxPlayers || 4}</span>
                  </div>
                  {isHost ? (
                    canStart ? (
                      <Button onClick={startMatch} size="lg" className="cartoon-button bg-primary text-white text-3xl px-20 h-24">
                        <Play className="w-10 h-10 mr-4 fill-current" /> START!
                      </Button>
                    ) : (
                      <div className="flex flex-col items-center animate-pulse">
                        <span className="font-headline text-2xl text-white/40 uppercase tracking-widest text-center">
                          {playerCount < 2 ? 'WAITING FOR CHALLENGERS...' : 'WAITING FOR WARRIORS...'}
                        </span>
                        <span className="text-xs font-bold text-primary uppercase mt-2">All players must be ready to start</span>
                      </div>
                    )
                  ) : (
                    <div className="flex flex-col items-center animate-pulse">
                      <span className="font-headline text-2xl text-white/40 uppercase tracking-widest text-center">WAITING FOR HOST...</span>
                    </div>
                  )}
                </div>
             </div>
          )}

          {room?.status === 'round_over' && (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-50">
              <h2 className="text-9xl font-headline text-accent animate-bounce drop-shadow-[8px_8px_0px_rgba(0,0,0,1)]">
                {room.lastWinnerName === 'DRAW' ? 'DRAW!' : 'ROUND!'}
              </h2>
              {room.lastWinnerName && room.lastWinnerName !== 'DRAW' && (
                <span className="text-4xl font-headline text-white drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] mt-4">
                  {room.lastWinnerName.toUpperCase()} WINS
                </span>
              )}
            </div>
          )}

          {showResults && room && (
             <div className="absolute inset-0 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center z-50 p-10 text-center space-y-10">
                <Trophy className="w-32 h-32 text-yellow-500 animate-pulse drop-shadow-[8px_8px_0px_rgba(0,0,0,1)]" />
                <h2 className="text-8xl font-headline text-white italic">
                  {room.lastWinnerName ? `${room.lastWinnerName.toUpperCase()} IS CHAMPION!` : 'CHAMPION!'}
                </h2>
                <div className="flex gap-4">
                  <Button onClick={handlePlayAgain} size="lg" className="cartoon-button bg-accent text-black text-2xl h-16 px-16 flex items-center gap-3">
                    <RotateCcw className="w-6 h-6" /> PLAY AGAIN
                  </Button>
                  <Button onClick={handleQuit} size="lg" className="cartoon-button bg-primary text-white text-2xl h-16 px-16">
                    LOBBY
                  </Button>
                </div>
             </div>
          )}
        </div>

        <div className={`absolute bottom-6 left-6 p-4 cartoon-card bg-black/60 backdrop-blur-md min-w-[240px] space-y-3 z-50 transition-all duration-300 ${isStunned ? 'blur-sm scale-95 opacity-80' : ''}`}>
          <div className="space-y-1">
            <div className="flex justify-between items-center px-1">
              <span className="font-headline text-[10px] text-white/80 flex items-center gap-1 uppercase tracking-tight">
                <Heart className="w-3 h-3 fill-current text-destructive" /> HEALTH
              </span>
              <div className="flex items-center gap-2">
                {recentHeal && <span className="font-headline text-sm text-[#4ade80] animate-bounce-subtle">+{recentHeal.amount}</span>}
                <span className="font-headline text-sm text-white">{Math.floor(myP?.hp || 0)}</span>
              </div>
            </div>
            <div className="juicy-bar h-6 bg-black/40">
              <div 
                className="juicy-bar-fill bg-destructive transition-all duration-300"
                style={{ width: `${(myP?.hp || 0) / ((myWeaponStats?.maxHp || 1000) / 100)}%` }}
              />
            </div>
          </div>

          <div className="flex justify-between items-center px-1">
            <span className="font-headline text-[10px] text-white/80 uppercase tracking-tight flex items-center gap-1">
               <Zap className="w-3 h-3 fill-current text-[#60a5fa]" /> STAMINA
            </span>
            <span className="font-headline text-sm text-[#60a5fa] drop-shadow-[1px_1px_0px_rgba(0,0,0,1)]">{Math.floor(myP?.stamina || 0)}</span>
          </div>

          {isStunned && (
            <div className="absolute inset-0 flex items-center justify-center z-[60] pointer-events-none">
               <span className="font-headline text-6xl text-white drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]">
                 {(stunRemaining / 1000).toFixed(1)}
               </span>
            </div>
          )}
          
          <div className="space-y-1 pt-1 border-t border-white/10">
            <div className="flex justify-between items-center px-1">
              <span className="font-headline text-[10px] text-white/80 uppercase tracking-tight flex items-center gap-1">
                 <WeaponIcon weapon={myP?.weaponClass as WeaponClass || 'Sword'} className="w-3 h-3" /> DASH
              </span>
              <span className="font-headline text-sm text-accent drop-shadow-[1px_1px_0px_rgba(0,0,0,1)]">
                {myP && myP.dashCharges === maxDash ? 'READY' : `${((myWeaponStats?.dashCooldown || 4.0) - (myP?.dashRechargeProgress || 0)).toFixed(1)}s`}
              </span>
            </div>
            <div className="flex justify-between items-center px-1">
               <div className="flex gap-1.5">
                {Array.from({ length: maxDash }).map((_, i) => (
                  <div key={i} className={`w-4 h-4 rounded-full border-2 border-black transition-all duration-300 ${i < (myP?.dashCharges || 0) ? 'bg-accent shadow-[0_0_8px_rgba(255,255,0,0.5)] scale-110' : 'bg-black/60 scale-90'}`} />
                ))}
              </div>
              {myP?.weaponClass === 'Sword' && stunCDRemaining > 0 && (
                <span className="font-headline text-xl text-white drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]">{(stunCDRemaining / 1000).toFixed(1)}</span>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
