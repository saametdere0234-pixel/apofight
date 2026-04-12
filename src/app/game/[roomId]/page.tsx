"use client";

import { useEffect, useRef, useState, use, useCallback } from 'react';
import { useLocalPlayer } from '@/hooks/use-local-player';
import { db } from '@/lib/firebase';
import { ref, onValue, set, update, onDisconnect, remove, get } from 'firebase/database';
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
  DASH_DURATION,
  DASH_COOLDOWN_TIME,
  FAST_FALL_SPEED,
  STAMINA_MAX,
  STAMINA_REGEN_RATE,
  STAMINA_DASH_COST,
  STAMINA_ATTACK_COST
} from '@/lib/game-types';
import { useRouter } from 'next/navigation';
import { Trophy, ArrowLeft, Play, Zap, Shield, Heart, Users, Sword, Wand2, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface GameEffectNumber {
  id: string;
  x: number;
  y: number;
  amount: number;
  type: 'damage' | 'heal';
  startTime: number;
}

interface FeedbackState {
  lastReloadFail: number;
  lastStaminaFail: number;
  lastDashFail: number;
  staminaMsg: string;
}

export default function GamePage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const { profile, loading: profileLoading, updateProfile } = useLocalPlayer();
  const router = useRouter();
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [room, setRoom] = useState<GameRoom | null>(null);
  const roomRefState = useRef<GameRoom | null>(null);
  const [keys] = useState<Set<string>>(new Set());
  
  const [flash, setFlash] = useState<{ type: 'taken' | 'dealt' | null, time: number }>({ type: null, time: 0 });
  const [shakeUntil, setShakeUntil] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackState>({
    lastReloadFail: 0,
    lastStaminaFail: 0,
    lastDashFail: 0,
    staminaMsg: ''
  });

  const [effectNumbers, setEffectNumbers] = useState<GameEffectNumber[]>([]);
  const effectNumbersRef = useRef<GameEffectNumber[]>([]);
  const lastHpRef = useRef<number>(1000);
  const prevPlayersHpRef = useRef<Record<string, number>>({});
  const [recentHeal, setRecentHeal] = useState<{ amount: number, time: number } | null>(null);

  useEffect(() => {
    roomRefState.current = room;
    if (room?.players) {
      Object.entries(room.players).forEach(([id, p]) => {
        const prevHp = prevPlayersHpRef.current[id];
        
        if (prevHp !== undefined && p.hp < prevHp) {
          const diff = prevHp - p.hp;
          const newDN: GameEffectNumber = {
            id: Math.random().toString(),
            x: p.x + PLAYER_WIDTH / 2,
            y: p.y,
            amount: Math.round(diff),
            type: 'damage',
            startTime: Date.now()
          };
          setEffectNumbers(prev => [...prev, newDN]);
          effectNumbersRef.current.push(newDN);
        }
        
        if (prevHp !== undefined && p.hp > prevHp) {
          const diff = p.hp - prevHp;
          const newHN: GameEffectNumber = {
            id: Math.random().toString(),
            x: p.x + PLAYER_WIDTH / 2,
            y: p.y,
            amount: Math.round(diff),
            type: 'heal',
            startTime: Date.now()
          };
          setEffectNumbers(prev => [...prev, newHN]);
          effectNumbersRef.current.push(newHN);
          
          if (id === profile?.id) {
            setRecentHeal({ amount: Math.round(diff), time: Date.now() });
          }
        }

        prevPlayersHpRef.current[id] = p.hp;
      });
    }
  }, [room, profile?.id]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setEffectNumbers(prev => prev.filter(en => now - en.startTime < 800));
      effectNumbersRef.current = effectNumbersRef.current.filter(en => now - en.startTime < 800);
      
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
      dashDirY: 0
    };

    get(roomPath).then((snapshot) => {
      if (snapshot.exists()) {
        const roomData = snapshot.val() as GameRoom;
        const playerCount = Object.keys(roomData.players || {}).length;
        const isAlreadyIn = roomData.players && roomData.players[profile.id];
        
        if (!isAlreadyIn && playerCount >= (roomData.maxPlayers || 4)) {
          router.push('/lobby');
          return;
        }
        
        set(myPlayerRef, initialPlayer);
        onDisconnect(myPlayerRef).remove();
      }
    });

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

      const isFastFallPressed = keys.has('ShiftLeft') || keys.has('ShiftRight');
      if (p.isJumping && isFastFallPressed) {
        nextVy = Math.max(nextVy, FAST_FALL_SPEED);
      }

      const isSlowed = Date.now() < (p.slowUntil || 0);
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
      dashRechargeProgress: nextDashRechargeProgress,
      stamina: nextStamina,
      isDashing,
      dashTimeLeft
    });
  }, [profile, roomId, keys]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keys.add(e.code);
      const currentRoom = roomRefState.current;
      if (!profile || !currentRoom || !currentRoom.players?.[profile.id] || !db || currentRoom.status !== 'playing') return;
      const p = currentRoom.players[profile.id];

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
        const now = Date.now();
        const hasCharges = p.dashCharges > 0;
        const hasStamina = (p.stamina || 0) >= STAMINA_DASH_COST;

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
            stamina: (p.stamina || 0) - STAMINA_DASH_COST
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

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setMousePos({ x: e.clientX, y: e.clientY });

    const canvas = canvasRef.current;
    if (!canvas) return;
    const gameX = (x / (rect.width / (ARENA_WIDTH * PIXELS_PER_METER))) / PIXELS_PER_METER;
    const gameY = (y / (rect.height / (ARENA_HEIGHT * PIXELS_PER_METER))) / PIXELS_PER_METER;
    mouseRef.current = { x: gameX, y: gameY };
  };

  const handleAttack = () => {
    const currentRoom = roomRefState.current;
    if (!profile || !currentRoom || !currentRoom.players?.[profile.id] || !db || currentRoom.status !== 'playing') return;
    
    const p = currentRoom.players[profile.id];
    const weapon = p.weaponClass as WeaponClass;
    const stats = WEAPON_STATS[weapon];
    const now = Date.now();
    
    const reloadRemaining = (stats.delay * 1000) - (now - (p.lastAttackTime || 0));
    const onCooldown = reloadRemaining > 0;
    const hasStamina = (p.stamina || 0) >= STAMINA_ATTACK_COST;

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

    update(ref(db, `rooms/${roomId}/players/${profile.id}`), {
      lastAttackTime: now,
      lastAttackAngle: attackAngle,
      stamina: (p.stamina || 0) - STAMINA_ATTACK_COST
    });

    Object.entries(currentRoom.players).forEach(([id, enemy]) => {
      if (id === profile.id || enemy.hp <= 0) return;
      
      const exMin = enemy.x;
      const exMax = enemy.x + PLAYER_WIDTH;
      const eyMin = enemy.y;
      const eyMax = enemy.y + PLAYER_HEIGHT;
      const ex = enemy.x + PLAYER_WIDTH / 2;
      const ey = enemy.y + PLAYER_HEIGHT / 2;
      
      const dx = ex - px;
      const dy = ey - py;
      const distToEnemyCenter = Math.sqrt(dx * dx + dy * dy);

      if (weapon === 'Dagger') {
        if (distToEnemyCenter <= stats.range) thisHit(id, enemy);
      } else if (weapon === 'Sword') {
        if (distToEnemyCenter <= stats.range + 2) {
          const enemyAngle = Math.atan2(dy, dx);
          let diff = Math.abs(enemyAngle - attackAngle);
          if (diff > Math.PI) diff = 2 * Math.PI - diff;
          const angleInDegrees = diff * (180 / Math.PI);
          if (angleInDegrees <= stats.angle / 2) {
            thisHit(id, enemy);
          }
        }
      } else if (weapon === 'Bow') {
        const x2 = px + Math.cos(attackAngle) * stats.range;
        const y2 = py + Math.sin(attackAngle) * stats.range;
        
        if (checkLineRect(px, py, x2, y2, exMin, eyMin, exMax, eyMax)) {
          thisHit(id, enemy);
        }
      }
    });
  };

  const checkLineRect = (x1: number, y1: number, x2: number, y2: number, minX: number, minY: number, maxX: number, maxY: number) => {
    if (x1 >= minX && x1 <= maxX && y1 >= minY && y1 <= maxY) return true;
    if (x2 >= minX && x2 <= maxX && y2 >= minY && y2 <= maxY) return true;

    return lineIntersect(x1, y1, x2, y2, minX, minY, minX, maxY) ||
           lineIntersect(x1, y1, x2, y2, maxX, minY, maxX, maxY) ||
           lineIntersect(x1, y1, x2, y2, minX, minY, maxX, minY) ||
           lineIntersect(x1, y1, x2, y2, minX, maxY, maxX, maxY);
  };

  const lineIntersect = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number) => {
    const den = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
    if (den === 0) return false;
    const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / den;
    const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / den;
    return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
  };

  const thisHit = (id: string, enemy: GamePlayer) => {
    if (!db || !roomId || !profile) return;
    const p = roomRefState.current?.players?.[profile.id];
    if (!p) return;
    
    const stats = WEAPON_STATS[p.weaponClass as WeaponClass];
    const enemyRef = ref(db, `rooms/${roomId}/players/${id}`);
    const newHp = Math.max(0, enemy.hp - stats.damage);
    const updates: any = { hp: newHp };
    
    if (p.weaponClass === 'Sword') {
      updates.slowUntil = Date.now() + 400;
    }
    update(enemyRef, updates);

    if (p.weaponClass === 'Bow') {
      const healAmount = stats.damage * 0.3;
      const newMyHp = Math.min(1000, p.hp + healAmount);
      update(ref(db, `rooms/${roomId}/players/${profile.id}`), { hp: newMyHp });
    }

    setFlash({ type: 'dealt', time: Date.now() });
    if (newHp === 0) handleKill(id);
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
            stamina: STAMINA_MAX,
            x: Math.random() * (ARENA_WIDTH - 5) + 2,
            y: GROUND_Y - PLAYER_HEIGHT,
            vy: 0,
            jumpCount: 0,
            dashCharges: getMaxDashCharges(p.weaponClass as WeaponClass || 'Sword'),
            dashRechargeProgress: 0,
            lastAttackTime: 0,
            slowUntil: 0,
            isDashing: false,
            dashTimeLeft: 0
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

    const now = Date.now();

    ctx.fillStyle = '#1e1b4b'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, GROUND_Y * PIXELS_PER_METER, canvas.width, (ARENA_HEIGHT - GROUND_Y) * PIXELS_PER_METER);
    
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    for(let i=0; i <= ARENA_WIDTH; i++) {
        ctx.beginPath();
        ctx.moveTo(i * PIXELS_PER_METER, GROUND_Y * PIXELS_PER_METER);
        ctx.lineTo(i * PIXELS_PER_METER, canvas.height);
        ctx.stroke();
    }
    for(let j=GROUND_Y; j <= ARENA_HEIGHT; j++) {
        ctx.beginPath();
        ctx.moveTo(0, j * PIXELS_PER_METER);
        ctx.lineTo(canvas.width, j * PIXELS_PER_METER);
        ctx.stroke();
    }

    Object.values(currentRoom.players || {}).forEach(p => {
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

    Object.values(currentRoom.players || {}).forEach(p => {
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

        const weapon = p.weaponClass as WeaponClass;
        const stats = WEAPON_STATS[weapon];
        const angle = p.lastAttackAngle || 0;

        if (weapon === 'Dagger') {
          ctx.beginPath();
          ctx.arc(centerX, centerY, stats.range * PIXELS_PER_METER, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else if (weapon === 'Sword') {
          const halfAngle = (stats.angle / 2) * (Math.PI / 180);
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.arc(centerX, centerY, stats.range * PIXELS_PER_METER, angle - halfAngle, angle + halfAngle);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else if (weapon === 'Bow') {
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          const endX = centerX + Math.cos(angle) * stats.range * PIXELS_PER_METER;
          const endY = centerY + Math.sin(angle) * stats.range * PIXELS_PER_METER;
          ctx.lineTo(endX, endY);
          ctx.lineWidth = 6;
          ctx.stroke();
        }
        ctx.restore();
      }
    });

    Object.values(currentRoom.players || {}).forEach(p => {
      if (p.hp <= 0 && currentRoom.status === 'playing') return;
      const px = p.x * PIXELS_PER_METER;
      const py = p.y * PIXELS_PER_METER;
      const pw = PLAYER_WIDTH * PIXELS_PER_METER;
      const ph = PLAYER_HEIGHT * PIXELS_PER_METER;

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
        ctx.fillStyle = 'black';
        ctx.fillRect(hpX, py - 18, hpWidth, 8);
        ctx.fillStyle = '#ff4444';
        const fillWidth = (p.hp / 1000) * (hpWidth - 4);
        ctx.fillRect(hpX + 2, py - 16, fillWidth, 4);
      }
      
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 3;
      ctx.font = 'bold 12px Fredoka';
      ctx.textAlign = 'center';
      ctx.strokeText(p.name, px + pw/2, py - 25);
      ctx.fillText(p.name, px + pw/2, py - 25);
    });

    effectNumbersRef.current.forEach((en) => {
      const elapsed = now - en.startTime;
      if (elapsed > 800) return;
      const alpha = 1 - (elapsed / 800);
      const dy = (elapsed / 800) * 50;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = en.type === 'damage' ? '#ff4444' : '#4ade80';
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 4;
      ctx.font = 'bold 24px Luckiest Guy';
      ctx.textAlign = 'center';
      const textX = en.x * PIXELS_PER_METER;
      const textY = en.y * PIXELS_PER_METER - 40 - dy;
      const prefix = en.type === 'heal' ? '+' : '';
      ctx.strokeText(prefix + en.amount.toString(), textX, textY);
      ctx.fillText(prefix + en.amount.toString(), textX, textY);
      ctx.restore();
    });
  };

  const WeaponIcon = ({ weapon }: { weapon: WeaponClass }) => {
    switch (weapon) {
      case 'Sword': return <Sword className="w-5 h-5 text-primary" />;
      case 'Dagger': return <Shield className="w-5 h-5 text-accent" />;
      case 'Bow': return <Wand2 className="w-5 h-5 text-orange-500" />;
      default: return null;
    }
  };

  if (profileLoading || !profile) return null;
  const myP = room?.players?.[profile.id];
  const maxDash = getMaxDashCharges(myP?.weaponClass as WeaponClass || 'Sword');
  const flashActive = Date.now() - flash.time < 200;
  const isShaking = Date.now() < shakeUntil;

  const now = Date.now();
  const alerts: { text: string, color: string, alpha: number }[] = [];
  if (myP) {
    const stats = WEAPON_STATS[myP.weaponClass as WeaponClass];
    const reloadRemaining = (stats.delay * 1000) - (now - (myP.lastAttackTime || 0));
    const dashRemaining = DASH_COOLDOWN_TIME - myP.dashRechargeProgress;

    if (now - feedback.lastReloadFail < 500 && reloadRemaining > 0) {
      alerts.push({ 
        text: `${(reloadRemaining / 1000).toFixed(1)}s`, 
        color: '#ff4444', 
        alpha: 1 - (now - feedback.lastReloadFail) / 500 
      });
    }
    if (now - feedback.lastDashFail < 500 && dashRemaining > 0) {
      alerts.push({ 
        text: `${dashRemaining.toFixed(1)}s`, 
        color: '#fbbf24', 
        alpha: 1 - (now - feedback.lastDashFail) / 500 
      });
    }
    if (now - feedback.lastStaminaFail < 500) {
      alerts.push({ 
        text: Math.floor(myP.stamina || 0).toString(), 
        color: '#60a5fa', 
        alpha: 1 - (now - feedback.lastStaminaFail) / 500 
      });
    }
  }

  const playerCount = room?.players ? Object.keys(room.players).length : 0;
  const canStart = playerCount >= 2;

  return (
    <div className="min-h-screen bg-[#0a0a1a] overflow-hidden flex flex-col items-center select-none" onMouseMove={handleMouseMove}>
      <div 
        className="fixed pointer-events-none z-[9999] flex flex-col items-center gap-1 select-none"
        style={{ 
          left: mousePos.x, 
          top: mousePos.y + 35, 
          transform: 'translateX(-50%)'
        }}
      >
        {alerts.map((alert, i) => (
          <span 
            key={i} 
            className="font-headline text-2xl drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]"
            style={{ 
              color: alert.color, 
              opacity: alert.alpha,
              WebkitTextStroke: '2px black'
            }}
          >
            {alert.text}
          </span>
        ))}
      </div>

      {flashActive && (
        <div className={`fixed inset-0 pointer-events-none z-[100] border-[40px] ${flash.type === 'taken' ? 'border-red-500/30' : 'border-blue-500/30'} animate-in fade-in duration-200`} />
      )}

      <header className="w-full p-4 flex justify-center items-center bg-black/60 backdrop-blur-xl border-b-8 border-black z-50">
        <div className="absolute left-4">
          <Button variant="ghost" onClick={() => router.push('/lobby')} className="cartoon-button bg-destructive text-white h-12 px-6">
            <ArrowLeft className="w-5 h-5 mr-2" />
            QUIT
          </Button>
        </div>

        <div className="flex items-center gap-4 overflow-x-auto max-w-[70vw] scrollbar-hide px-4">
          {Object.values(room?.players || {}).map(p => (
            <div key={p.id} className="flex items-center gap-3 bg-black/40 border-4 border-black rounded-[20px] p-2 px-4 shadow-[4px_4px_0px_rgba(0,0,0,1)] min-w-[180px]">
              <div className="flex flex-col items-start gap-0.5 flex-1">
                <div className="flex items-center gap-2">
                  <WeaponIcon weapon={p.weaponClass as WeaponClass} />
                  <span 
                    className="font-headline text-lg truncate max-w-[100px]"
                    style={{ color: p.color, WebkitTextStroke: '1px black' }}
                  >
                    {p.name}
                  </span>
                </div>
                <div className="flex gap-1.5 mt-1">
                  {[1, 2, 3].map(i => (
                    <div 
                      key={i} 
                      className={`w-3.5 h-3.5 rounded-full border-2 border-black transition-all duration-300 ${i <= (p.roundsWon || 0) ? 'bg-yellow-500 shadow-[0_0_8px_rgba(255,215,0,0.6)]' : 'bg-white/10'}`} 
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </header>

      <main className="flex-1 w-full relative flex items-center justify-center p-8">
        <div className={`relative game-canvas-container ${isShaking ? 'animate-shake' : ''}`}>
          <canvas ref={canvasRef} width={ARENA_WIDTH * PIXELS_PER_METER} height={ARENA_HEIGHT * PIXELS_PER_METER} className="w-full h-auto cursor-crosshair" onClick={handleAttack} />
          {room?.status === 'lobby' && (
             <div className="absolute inset-0 bg-black/80 backdrop-blur-lg flex flex-col items-center justify-center z-50 space-y-10">
                <h2 className="text-7xl font-headline text-white animate-bounce-subtle">ARENA STANDBY</h2>
                <div className="flex gap-8">
                  {Object.values(room.players).map(p => (
                    <div key={p.id} className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-2xl border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)]" style={{ backgroundColor: p.color }} />
                      <span className="font-headline text-lg text-white">{p.name}</span>
                    </div>
                  ))}
                </div>
                
                <div className="flex flex-col items-center gap-4">
                  <div className="flex items-center gap-2 bg-black/40 px-6 py-2 rounded-full border-2 border-white/10">
                    <Users className="w-6 h-6 text-primary" />
                    <span className="font-headline text-2xl text-white">
                      {playerCount} / {room.maxPlayers || 4}
                    </span>
                  </div>
                  
                  {canStart ? (
                    <Button onClick={startMatch} size="lg" className="cartoon-button bg-primary text-white text-3xl px-20 h-24">
                      <Play className="w-10 h-10 mr-4 fill-current" />
                      START!
                    </Button>
                  ) : (
                    <div className="flex flex-col items-center animate-pulse">
                      <span className="font-headline text-2xl text-white/40 uppercase tracking-widest">
                        WAITING FOR CHALLENGERS...
                      </span>
                      <span className="text-xs font-bold text-primary uppercase mt-2">
                        Need at least 2 warriors to begin
                      </span>
                    </div>
                  )}
                </div>
             </div>
          )}
          {room?.status === 'round_over' && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
              <h2 className="text-9xl font-headline text-accent animate-bounce drop-shadow-[8px_8px_0px_rgba(0,0,0,1)]">ROUND!</h2>
            </div>
          )}
          {room?.status === 'finished' && (
             <div className="absolute inset-0 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center z-50 p-10 text-center space-y-10">
                <Trophy className="w-32 h-32 text-yellow-500 animate-pulse drop-shadow-[8px_8px_0px_rgba(0,0,0,1)]" />
                <h2 className="text-8xl font-headline text-white italic">CHAMPION!</h2>
                <Button onClick={() => router.push('/lobby')} size="lg" className="cartoon-button bg-primary text-white text-2xl h-16 px-16">LOBBY</Button>
             </div>
          )}
        </div>

        <div className="absolute bottom-6 left-6 p-4 cartoon-card bg-black/60 backdrop-blur-md min-w-[240px] space-y-3 z-50">
          <div className="space-y-1">
            <div className="flex justify-between items-center px-1">
              <span className="font-headline text-[10px] text-white/80 flex items-center gap-1 uppercase tracking-tight">
                <Heart className="w-3 h-3 fill-current text-destructive" /> HEALTH
              </span>
              <div className="flex items-center gap-2">
                {recentHeal && (
                  <span className="font-headline text-sm text-[#4ade80] animate-bounce-subtle">+{recentHeal.amount}</span>
                )}
                <span className="font-headline text-sm text-white">{Math.floor(myP?.hp || 0)}</span>
              </div>
            </div>
            <div className="juicy-bar h-6 bg-black/40">
              <div 
                className="juicy-bar-fill bg-destructive transition-all duration-300"
                style={{ width: `${(myP?.hp || 0) / 10}%` }}
              />
            </div>
          </div>

          <div className="flex justify-between items-center px-1">
            <span className="font-headline text-[10px] text-white/80 uppercase tracking-tight">STAMINA</span>
            <span className="font-headline text-sm text-[#60a5fa] drop-shadow-[1px_1px_0px_rgba(0,0,0,1)]">
              {Math.floor(myP?.stamina || 0)}
            </span>
          </div>
          
          <div className="space-y-1 pt-1 border-t border-white/10">
            <div className="flex justify-between items-center px-1">
              <span className="font-headline text-[10px] text-white/80 uppercase tracking-tight">DASH STATUS</span>
              <span className="font-headline text-sm text-accent drop-shadow-[1px_1px_0px_rgba(0,0,0,1)]">
                {myP && myP.dashCharges === maxDash 
                  ? 'READY' 
                  : `${(DASH_COOLDOWN_TIME - (myP?.dashRechargeProgress || 0)).toFixed(1)}s`
                }
              </span>
            </div>
            <div className="flex items-center gap-2 px-1">
              <div className="flex gap-1.5">
                {Array.from({ length: maxDash }).map((_, i) => (
                  <div 
                    key={i} 
                    className={`w-4 h-4 rounded-full border-2 border-black transition-all duration-300 ${i < (myP?.dashCharges || 0) ? 'bg-accent shadow-[0_0_8px_rgba(255,255,0,0.5)] scale-110' : 'bg-black/60 scale-90'}`}
                  />
                ))}
              </div>
              {myP && myP.dashCharges < maxDash && (
                <Zap className="w-3 h-3 text-accent animate-pulse" />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
