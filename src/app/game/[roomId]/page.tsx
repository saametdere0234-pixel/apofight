
"use client";

import { useEffect, useRef, useState, use, useCallback } from 'react';
import { useLocalPlayer } from '@/hooks/use-local-player';
import { db, auth } from '@/lib/firebase';
import { ref, onValue, set, update, onDisconnect, remove, get, push, off } from 'firebase/database';
import { signOut } from 'firebase/auth';
import { 
  GamePlayer, 
  GameRoom, 
  Projectile,
  GameEffect,
  ChatMessage,
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
  DASH_DISTANCE,
  DASH_DURATION,
  FAST_FALL_SPEED,
  STAMINA_REGEN_RATE,
  STAMINA_DASH_COST,
  STAMINA_DASH_COST_DAGGER,
  STUN_DURATION,
  STUN_COOLDOWN,
  SPAWN_POINTS
} from '@/lib/game-types';
import { useRouter } from 'next/navigation';
import { Trophy, ArrowLeft, Play, Zap, Heart, Users, Crown, RotateCcw, WifiOff, ShieldAlert, LogOut, Wallet, Fingerprint, Swords, CornerDownLeft, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { FriendsSidebar } from '@/components/FriendsSidebar';
import { ScrollArea } from '@/components/ui/scroll-area';

const WeaponIcon = ({ weapon, className = "w-6 h-6" }: { weapon: WeaponClass; className?: string }) => {
  const baseClasses = "font-headline flex items-center justify-center select-none leading-none";
  if (weapon === 'Sword') {
    return (
      <div className={cn(baseClasses, className, "text-yellow-400")} style={{ textShadow: '2px 2px 0px black' }}>
        S
      </div>
    );
  }
  if (weapon === 'Dagger') {
    return (
      <div className={cn(baseClasses, className, "text-purple-500")} style={{ textShadow: '2px 2px 0px black' }}>
        D
      </div>
    );
  }
  if (weapon === 'Bow') {
    return (
      <div className={cn(baseClasses, className, "text-white")} style={{ textShadow: '2px 2px 0px black' }}>
        B
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
  const { profile, updateProfile, authUser, loading: profileLoading } = useLocalPlayer();
  const { toast } = useToast();
  const router = useRouter();
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [room, setRoom] = useState<GameRoom | null>(null);
  const roomRef = useRef<GameRoom | null>(null);
  const profileRef = useRef(profile);
  const [keys] = useState<Set<string>>(new Set());
  const [isConnected, setIsConnected] = useState(true);
  const matchProcessedRef = useRef<string | null>(null);
  const feeProcessedRef = useRef<string | null>(null);
  const hasJoinedRef = useRef(false);
  
  // Chat State
  const [sessionJoinTime] = useState(Date.now());
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [nowTick, setNowTick] = useState(Date.now());

  const isChargingRef = useRef(false);
  const [isCharging, setIsCharging] = useState(false);
  
  const [flash, setFlash] = useState<{ type: 'taken' | 'dealt' | null, time: number }>({ type: null, time: 0 });
  const [shakeUntil, setShakeUntil] = useState(0);
  const [feedback, setFeedback] = useState<{
    lastReloadFail: number;
    lastStaminaFail: number;
    lastDashFail: number;
    staminaMsg: string;
  }>({
    lastReloadFail: 0,
    lastStaminaFail: 0,
    lastDashFail: 0,
    staminaMsg: ''
  });

  const [localEffects, setLocalEffects] = useState<GameEffect[]>([]);
  const effectsRef = useRef<GameEffect[]>([]);
  const interpPlayersRef = useRef<Record<string, GamePlayer>>({});
  const lastSyncTimeRef = useRef(0);

  const isLocked = room?.status === 'starting' || room?.status === 'playing' || room?.status === 'celebrating' || room?.status === 'round_over';

  const handleQuit = useCallback(async () => {
    if (!db || !roomId || !profileRef.current || isLocked) return;
    
    const myPlayerRef = ref(db, `rooms/${roomId}/players/${profileRef.current.id}`);
    const roomPath = ref(db, `rooms/${roomId}`);
    
    await remove(myPlayerRef);
    
    const snapshot = await get(roomPath);
    if (snapshot.exists()) {
      const roomData = snapshot.val() as GameRoom;
      if (!roomData.players || Object.keys(roomData.players).length === 0) {
        await remove(roomPath);
      }
    }

    update(ref(db, `players/${profileRef.current.id}`), { currentRoomId: null });
    router.push('/lobby');
  }, [roomId, router, isLocked]);

  const handlePlayAgain = useCallback(async () => {
    if (!db || !roomId || !profileRef.current) return;
    const myPlayerRef = ref(db, `rooms/${roomId}/players/${profileRef.current.id}`);
    update(myPlayerRef, { isReady: true });
  }, [roomId]);

  const isHost = room && profileRef.current && room.players && profileRef.current.id === room.createdBy;

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    if (!db || !profile?.id || !roomId) return;
    const profileDbRef = ref(db, `players/${profile.id}`);
    update(profileDbRef, { currentRoomId: roomId });
    onDisconnect(profileDbRef).update({ currentRoomId: null });
    
    return () => {
      update(profileDbRef, { currentRoomId: null });
    };
  }, [profile?.id, roomId]);

  // Chat Sync
  useEffect(() => {
    if (!db || !roomId) return;
    const chatRef = ref(db, `rooms/${roomId}/chat`);
    return onValue(chatRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const msgs = (Object.values(data) as ChatMessage[])
          .filter(m => m.timestamp >= sessionJoinTime)
          .sort((a, b) => a.timestamp - b.timestamp);
        setMessages(msgs);
      } else {
        setMessages([]);
      }
    });
  }, [roomId, sessionJoinTime]);

  // Update tick for 7s preview
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto scroll chat
  useEffect(() => {
    if (isChatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isChatOpen]);

  // Match Entry Fee Logic - Charged once per session (Lobby -> Start)
  useEffect(() => {
    if (room?.status === 'starting' && profile && authUser) {
      if (feeProcessedRef.current === roomId) return;
      feeProcessedRef.current = roomId;

      const entryFee = 10;
      const currentGold = profile.gold || 0;
      if (currentGold >= entryFee) {
        updateProfile({ gold: currentGold - entryFee });
        toast({
          title: "Match started!",
          description: `Entry fee: -${entryFee} Gold`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Insufficient Gold",
          description: `You need ${entryFee} gold to join this battle.`,
        });
      }
    }
    
    // Reset fee processed status only when returning to lobby (after champion or alone)
    if (room?.status === 'lobby') {
      feeProcessedRef.current = null;
    }
  }, [room?.status, profile?.id, roomId, authUser, toast, updateProfile]);

  // Rewards logic
  useEffect(() => {
    if (room?.status === 'finished' && room.lastWinnerName && profile && authUser) {
      if (matchProcessedRef.current === roomId) return;
      matchProcessedRef.current = roomId;

      const isWinner = room.lastWinnerName === profile.name;
      let change = isWinner ? 30 : 0; 
      
      if (isWinner) {
        toast({
          title: "Champion!",
          description: `Received +${change} Gold!`,
        });
        const currentGold = profile.gold || 0;
        const nextGold = currentGold + change;
        updateProfile({ gold: nextGold });
      }
    }

    if (room?.status === 'lobby') {
      matchProcessedRef.current = null;
    }
  }, [room?.status, room?.lastWinnerName, profile?.id, roomId, authUser, toast, updateProfile]);

  useEffect(() => {
    if (!db) return;
    const connectedRef = ref(db, '.info/connected');
    const unsubscribe = onValue(connectedRef, (snap) => {
      setIsConnected(snap.val() === true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!db || !roomId) return;
    const effectsDbRef = ref(db, `rooms/${roomId}/effects`);
    return onValue(effectsDbRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const now = Date.now();
        const effectsList = (Object.values(data) as GameEffect[]).filter(fx => Math.abs(now - fx.timestamp) < 5000);
        effectsRef.current = effectsList;
        setLocalEffects(effectsList);
      } else {
        effectsRef.current = [];
        setLocalEffects([]);
      }
    });
  }, [roomId]);

  useEffect(() => {
    roomRef.current = room;
    if (room?.players) {
      const pIds = Object.keys(room.players).sort();
      const playerCount = pIds.length;
      const hostPresent = !!room.players[room.createdBy];

      if (!hostPresent && playerCount > 0) {
        const nextHostId = pIds[0];
        if (profileRef.current?.id === nextHostId) {
          update(ref(db, `rooms/${roomId}`), { createdBy: nextHostId });
        }
      }

      // Solitude Reset Mode: Reset rounds and go to lobby if alone
      if (playerCount === 1 && room.status !== 'lobby') {
        const onlyPlayerId = pIds[0];
        if (onlyPlayerId === profileRef.current?.id) {
          const p = room.players[onlyPlayerId];
          const weaponStats = WEAPON_STATS[p.weaponClass as WeaponClass] || WEAPON_STATS.Sword;
          const updates: any = {
            status: 'lobby',
            lastWinnerName: null,
            startTime: null,
            projectiles: null,
            effects: null,
            celebrationStartTime: null,
            currentRound: 1
          };
          updates[`players/${onlyPlayerId}/roundsWon`] = 0;
          updates[`players/${onlyPlayerId}/isReady`] = true;
          updates[`players/${onlyPlayerId}/hp`] = weaponStats.maxHp;
          updates[`players/${onlyPlayerId}/stamina`] = weaponStats.maxStamina;
          updates[`players/${onlyPlayerId}/dashCharges`] = p.weaponClass === 'Dagger' ? 4 : 1;
          updates[`players/${onlyPlayerId}/dashRechargeProgress`] = 0;
          updates[`players/${onlyPlayerId}/isDashing`] = false;
          updates[`players/${onlyPlayerId}/dashTimeLeft`] = 0;
          update(ref(db, `rooms/${roomId}`), updates);
        }
      }

      // Championship Reset: Start fresh when host starts after championship
      if (room.status === 'finished') {
        const players = Object.values(room.players);
        const allReady = players.every(p => p.isReady);
        if (allReady && isHost) {
          const updates: any = {
            status: 'lobby',
            lastWinnerName: null,
            startTime: null,
            projectiles: null,
            effects: null,
            celebrationStartTime: null,
            currentRound: 1
          };
          players.forEach(p => {
            updates[`players/${p.id}/roundsWon`] = 0;
          });
          update(ref(db, `rooms/${roomId}`), updates);
        }
      }

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
  }, [room, roomId, isHost]);

  useEffect(() => {
    if (!db || !roomId || !room || !isHost) return;

    if (room.status === 'starting' && room.startTime) {
      const elapsed = Date.now() - room.startTime;
      const remaining = Math.max(0, 3500 - elapsed);
      const timer = setTimeout(() => {
        update(ref(db, `rooms/${roomId}`), { status: 'playing' });
      }, remaining);
      return () => clearTimeout(timer);
    }

    if (room.status === 'celebrating' && room.celebrationStartTime) {
      const elapsed = Date.now() - room.celebrationStartTime;
      const remaining = Math.max(0, 2000 - elapsed);
      const timer = setTimeout(() => {
        const currentData = roomRef.current;
        if (!currentData || currentData.status !== 'celebrating') return;
        
        const winner = Object.values(currentData.players).find(p => p.name === currentData.lastWinnerName);
        const isGameFinished = winner && (winner.roundsWon || 0) >= 3;
        
        const updates: any = { 
          status: isGameFinished ? 'finished' : 'round_over'
        };
        
        if (isGameFinished) {
          Object.keys(currentData.players).forEach(pid => {
            updates[`players/${pid}/isReady`] = false;
          });
        }
        
        update(ref(db, `rooms/${roomId}`), updates);
      }, remaining);
      return () => clearTimeout(timer);
    }

    if (room.status === 'round_over') {
      const timer = setTimeout(() => {
        const currentData = roomRef.current;
        if (!currentData || currentData.status !== 'round_over') return;
        prepareNextRound(currentData);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [room?.status, room?.startTime, room?.celebrationStartTime, isHost, roomId]);

  const getMaxDashCharges = (weapon: WeaponClass) => (weapon === 'Dagger' ? 4 : 1);

  useEffect(() => {
    if (profileLoading || !profile || !db || !roomId) return;

    const roomPath = ref(db, `rooms/${roomId}`);
    const myPlayerRef = ref(db, `rooms/${roomId}/players/${profile.id}`);
    
    if (!hasJoinedRef.current) {
      hasJoinedRef.current = true;
      const weaponStats = WEAPON_STATS[profile.weaponClass] || WEAPON_STATS.Sword;

      get(roomPath).then((snapshot) => {
        if (snapshot.exists()) {
          const roomData = snapshot.val() as GameRoom;
          const playerCount = roomData.players ? Object.keys(roomData.players).length : 0;
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
            stamina: weaponStats.maxStamina,
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
          
          set(myPlayerRef, initialPlayer);
          update(roomPath, { lastUpdate: Date.now() });
          onDisconnect(myPlayerRef).remove();
        }
      });
    }

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
      if (db && roomId && profileRef.current?.id) {
        remove(ref(db, `rooms/${roomId}/players/${profileRef.current.id}`));
      }
    };
  }, [profile?.id, profileLoading, roomId, router]);

  const updateGameLogic = useCallback((dt: number) => {
    const currentRoom = roomRef.current;
    if (!profileRef.current || !currentRoom || !currentRoom.players?.[profileRef.current.id] || !db) return;
    
    if (currentRoom.status !== 'playing') return;

    const now = Date.now();
    const p = currentRoom.players[profileRef.current.id];

    if (currentRoom.projectiles) {
      Object.entries(currentRoom.projectiles).forEach(([pid, proj]) => {
        if (proj.ownerId === profileRef.current?.id) {
          const elapsed = now - proj.startTime;
          const projX = proj.startX + proj.vx * (elapsed / 1000);
          const projY = proj.startY + proj.vy * (elapsed / 1000);

          let hitId: string | null = null;
          Object.entries(currentRoom.players || {}).forEach(([eid, enemy]) => {
            if (eid === profileRef.current?.id || enemy.hp <= 0) return;
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
            const dx = projX - proj.startX;
            const dy = projY - proj.startY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const maxRange = proj.range || WEAPON_STATS.Bow.range;
            
            const scaledDamage = 50 + (150 * Math.min(1, dist / maxRange));
            
            thisHit(hitId, currentRoom.players[hitId], false, scaledDamage);
            remove(ref(db, `rooms/${roomId}/projectiles/${pid}`));
          } else if (elapsed > (WEAPON_STATS.Bow.projectileDuration || 1000)) {
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
    let nextStamina = Math.min(stats.maxStamina, (p.stamina || 0) + STAMINA_REGEN_RATE * dt);
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
        const speed = isSlowed ? stats.moveSpeed * 0.5 : stats.moveSpeed;

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
    
    currentRoom.players[profileRef.current.id] = updatedLocalPlayer;
    interpPlayersRef.current[profileRef.current.id] = updatedLocalPlayer;

    if (now - lastSyncTimeRef.current > 33) {
      lastSyncTimeRef.current = now;
      const myPlayerRef = ref(db, `rooms/${roomId}/players/${profileRef.current.id}`);
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
      update(ref(db, `rooms/${roomId}`), { lastUpdate: Date.now() });
    }
  }, [roomId, keys]);

  const triggerDash = useCallback(() => {
    const currentRoom = roomRef.current;
    if (!profileRef.current || !currentRoom || !currentRoom.players?.[profileRef.current.id] || !db || (currentRoom.status !== 'playing' && currentRoom.status !== 'starting')) return;
    const p = currentRoom.players[profileRef.current.id];
    if (p.hp <= 0) return;
    
    const now = Date.now();
    const isStunned = now < (p.stunnedUntil || 0);
    if (isStunned) return;

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
      update(ref(db, `rooms/${roomId}/players/${profileRef.current.id}`), {
        isDashing: true,
        dashTimeLeft: DASH_DURATION,
        dashDirX: dx / dist,
        dashDirY: dy / dist,
        dashCharges: p.dashCharges - 1,
        stamina: (p.stamina || 0) - dashCost
      });
    }
  }, [roomId]);

  const handleSendMessage = useCallback(() => {
    if (!chatInput.trim() || !profile || !db || !roomId) {
      setIsChatOpen(false);
      setChatInput('');
      return;
    }

    const chatRef = push(ref(db, `rooms/${roomId}/chat`));
    const newMessage: ChatMessage = {
      id: chatRef.key!,
      senderId: profile.id,
      senderName: profile.name,
      senderColor: profile.color,
      text: chatInput.trim(),
      timestamp: Date.now(),
    };
    
    set(chatRef, newMessage);
    setChatInput('');
    setIsChatOpen(false);
  }, [chatInput, profile, roomId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Chat Logic Fix: Enter to open, Enter to send (if text), Enter to close (if empty)
      if (e.code === 'Enter') {
        e.preventDefault();
        if (!isChatOpen) {
          setIsChatOpen(true);
          setTimeout(() => chatInputRef.current?.focus(), 10);
        } else {
          handleSendMessage();
        }
        return;
      }

      // If chat is open, ignore game controls
      if (isChatOpen) return;

      keys.add(e.code);
      const currentRoom = roomRef.current;
      if (!profileRef.current || !currentRoom || !currentRoom.players?.[profileRef.current.id] || !db || (currentRoom.status !== 'playing' && currentRoom.status !== 'starting')) return;
      const p = currentRoom.players[profileRef.current.id];
      if (p.hp <= 0) return;
      
      const now = Date.now();
      const isStunned = now < (p.stunnedUntil || 0);
      if (isStunned) return;

      if ((e.code === 'KeyW' || e.code === 'ArrowUp')) {
        const currentJumpCount = p.jumpCount || 0;
        if (currentJumpCount < 2) {
          update(ref(db, `rooms/${roomId}/players/${profileRef.current.id}`), {
            vy: JUMP_FORCE,
            isJumping: true,
            jumpCount: currentJumpCount + 1
          });
        }
      }

      if (e.code === 'Space') {
        e.preventDefault(); 
        update(ref(db, `rooms/${roomId}/players/${profileRef.current.id}`), {
          emojiUntil: Date.now() + 2000
        });
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
      if (profileRef.current && currentRoom?.players?.[profileRef.current.id] && currentRoom.status === 'playing') {
        updateGameLogic(dt);
      }
      render(dt);
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(frameId);
    };
  }, [updateGameLogic, keys, roomId, isChatOpen, handleSendMessage]);

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });

    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    
    const internalX = offsetX * (canvas.width / rect.width);
    const internalY = offsetY * (canvas.height / rect.height);
    
    const gameX = internalX / PIXELS_PER_METER;
    const gameY = internalY / PIXELS_PER_METER;
    
    mouseRef.current = { x: gameX, y: gameY };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isChatOpen) return;
    if (e.button === 0) { 
      const p = room?.players?.[profileRef.current?.id || ''];
      if (p && p.hp > 0 && room?.status === 'playing') {
        setIsCharging(true);
        isChargingRef.current = true;
      }
    } else if (e.button === 2) { 
      triggerDash();
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (e.button === 0 && isChargingRef.current) {
      const p = room?.players?.[profileRef.current?.id || ''];
      if (p?.weaponClass === 'Bow') {
        fireBow();
      } else {
        handleAttack();
      }
      setIsCharging(false);
      isChargingRef.current = false;
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault(); 
  };

  const fireBow = () => {
    const currentRoom = roomRef.current;
    if (!profileRef.current || !currentRoom || !currentRoom.players?.[profileRef.current.id] || !db || currentRoom.status !== 'playing') return;
    
    const p = currentRoom.players[profileRef.current.id];
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

    const speed = weaponStats.range / 1.0; 
    const vx = Math.cos(attackAngle) * speed;
    const vy = Math.sin(attackAngle) * speed;

    const projRef = push(ref(db, `rooms/${roomId}/projectiles`));
    set(projRef, {
      id: projRef.key,
      ownerId: profileRef.current.id,
      startX: px,
      startY: py,
      vx,
      vy,
      startTime: now,
      range: weaponStats.range,
      damage: weaponStats.damage
    });

    update(ref(db, `rooms/${roomId}/players/${profileRef.current.id}`), {
      lastAttackTime: now,
      lastAttackAngle: attackAngle,
      stamina: (p.stamina || 0) - weaponStats.staminaAttackCost
    });
  };

  const handleAttack = () => {
    const currentRoom = roomRef.current;
    if (!profileRef.current || !currentRoom || !currentRoom.players?.[profileRef.current.id] || !db || currentRoom.status !== 'playing') return;
    
    const p = currentRoom.players[profileRef.current.id];
    if (p.hp <= 0) return;

    const now = Date.now();
    const isStunned = now < (p.stunnedUntil || 0);
    if (isStunned) return;

    const weapon = (p.weaponClass as WeaponClass) || 'Sword';
    if (weapon === 'Bow') return; 

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

    update(ref(db, `rooms/${roomId}/players/${profileRef.current.id}`), {
      lastAttackTime: now,
      lastAttackAngle: attackAngle,
      stamina: (p.stamina || 0) - weaponStats.staminaAttackCost
    });

    Object.entries(currentRoom.players || {}).forEach(([id, enemy]) => {
      if (id === profileRef.current?.id || enemy.hp <= 0) return;
      
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
      update(ref(db, `rooms/${roomId}/players/${profileRef.current.id}`), {
        stunCooldownUntil: now + STUN_COOLDOWN
      });
    }
  };

  const thisHit = (id: string, enemy: GamePlayer, shouldStun: boolean = false, customDamage?: number) => {
    if (!db || !roomId || !profileRef.current) return;
    const p = roomRef.current?.players?.[profileRef.current.id];
    if (!p) return;
    
    const now = Date.now();
    const weaponStats = (WEAPON_STATS[p.weaponClass as WeaponClass] || WEAPON_STATS.Sword);
    const damage = customDamage ?? weaponStats.damage;
    const enemyRef = ref(db, `rooms/${roomId}/players/${id}`);
    const newHp = Math.max(0, enemy.hp - damage);
    const updates: any = { hp: newHp };
    
    const damageEffectRef = push(ref(db, `rooms/${roomId}/effects`));
    set(damageEffectRef, {
      id: damageEffectRef.key,
      x: enemy.x + PLAYER_WIDTH / 2,
      y: enemy.y,
      amount: Math.round(damage),
      type: 'damage',
      timestamp: now
    } as GameEffect);

    if (p.weaponClass === 'Sword') {
      updates.slowUntil = now + 400;
      if (shouldStun) {
        updates.stunnedUntil = now + STUN_DURATION;
      }
    }

    if (p.weaponClass === 'Bow') {
      const maxHp = weaponStats.maxHp;
      if (p.hp < maxHp) {
        const healAmount = damage * 0.4; 
        const actualHeal = Math.min(healAmount, maxHp - p.hp);
        const newMyHp = Math.min(maxHp, p.hp + actualHeal);
        
        if (actualHeal > 0) {
          update(ref(db, `rooms/${roomId}/players/${profileRef.current.id}`), { hp: newMyHp });

          const healEffectRef = push(ref(db, `rooms/${roomId}/effects`));
          set(healEffectRef, {
            id: healEffectRef.key,
            x: p.x + PLAYER_WIDTH / 2,
            y: p.y,
            amount: Math.round(actualHeal),
            type: 'heal',
            timestamp: now
          } as GameEffect);
        }
      }
    }

    if (newHp <= 0) {
      updates.deathTime = now;
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
    const isChampionship = winnersRounds >= 3;
    
    const updates: any = { 
      status: 'celebrating',
      lastWinnerName: winner.name,
      celebrationStartTime: Date.now(),
      projectiles: null,
      effects: null
    };
    updates[`players/${winnerId}/roundsWon`] = winnersRounds;
    
    update(ref(db, `rooms/${roomId}`), updates);
  };

  const handleDraw = () => {
    const currentRoom = roomRef.current;
    if (!currentRoom || !db || !isHost || currentRoom.status !== 'playing') return;
    
    update(ref(db, `rooms/${roomId}`), { 
      status: 'round_over', 
      lastWinnerName: 'DRAW',
      projectiles: null,
      effects: null
    });
  };

  const prepareNextRound = (currentData: GameRoom) => {
    if (!isHost) return;
    const assignedSpawns: {x: number, y: number}[] = [];
    const nextRoundUpdates: any = {
      status: 'starting', 
      startTime: Date.now(),
      currentRound: (currentData.currentRound || 1) + 1,
      effects: null,
      celebrationStartTime: null
    };

    Object.keys(currentData.players || {}).forEach(pid => {
      const p = currentData.players[pid];
      const bestSpawn = getBestSpawnPoint(SPAWN_POINTS, assignedSpawns);
      assignedSpawns.push(bestSpawn);
      
      const weaponStats = (WEAPON_STATS[p.weaponClass as WeaponClass] || WEAPON_STATS.Sword);
      const pUpdates = {
        hp: weaponStats.maxHp,
        stamina: weaponStats.maxStamina,
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
        dashTimeLeft: 0,
        deathTime: 0,
        roundsWon: p.roundsWon || 0 
      };
      
      Object.entries(pUpdates).forEach(([key, val]) => {
        nextRoundUpdates[`players/${pid}/${key}`] = val;
      });
    });
    
    update(ref(db, `rooms/${roomId}`), nextRoundUpdates);
  };

  const startMatch = () => {
    if (!db || !roomId || !room || !isHost) return;
    const updates: any = { 
      status: 'starting', 
      startTime: Date.now(),
      effects: null,
      celebrationStartTime: null,
      currentRound: 1
    };

    Object.keys(room.players || {}).forEach(pid => {
      updates[`players/${pid}/roundsWon`] = 0;
    });

    update(ref(db, `rooms/${roomId}`), updates);
  };

  const render = (dt: number) => {
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

    const playersData = currentRoom.players || {};

    if (playersData) {
      Object.keys(interpPlayersRef.current).forEach(id => {
        if (!playersData[id]) {
          delete interpPlayersRef.current[id];
        }
      });

      Object.values(playersData).forEach(p => {
        if (p.id === profileRef.current?.id) {
          interpPlayersRef.current[p.id] = p;
        } else if (playersData[p.id]) {
          const currentInterp = interpPlayersRef.current[p.id] || p;
          const lerpFactor = Math.min(1, 15 * dt); 
          interpPlayersRef.current[p.id] = {
            ...p,
            x: currentInterp.x + (p.x - currentInterp.x) * lerpFactor,
            y: currentInterp.y + (p.y - currentInterp.y) * lerpFactor,
          };
        }
      });
    }

    const playersToDraw = Object.values(interpPlayersRef.current);

    if (isChargingRef.current && profileRef.current && playersData) {
      const myP = playersData[profileRef.current.id];
      if (myP && myP.hp > 0) {
        if (myP.weaponClass === 'Bow') {
          const px = (myP.x + PLAYER_WIDTH/2) * PIXELS_PER_METER;
          const py = (myP.y + PLAYER_HEIGHT/2) * PIXELS_PER_METER;
          const angle = Math.atan2(mouseRef.current.y - (myP.y + PLAYER_HEIGHT/2), mouseRef.current.x - (myP.x + PLAYER_WIDTH/2));
          const beamLength = WEAPON_STATS.Bow.range * PIXELS_PER_METER;
          const internalMx = mouseRef.current.x * PIXELS_PER_METER;
          const internalMy = mouseRef.current.y * PIXELS_PER_METER;
          
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(angle);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.fillRect(0, -10, beamLength, 20); 
          
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.setLineDash([15, 10]);
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(beamLength, 0);
          ctx.stroke();
          ctx.restore();

          ctx.save();
          ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 + Math.sin(now / 100) * 0.4})`;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(internalMx, internalMy, 15 + Math.sin(now / 150) * 3, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(internalMx - 25, internalMy); ctx.lineTo(internalMx + 25, internalMy);
          ctx.moveTo(internalMx, internalMy - 25); ctx.lineTo(internalMx, internalMy + 25);
          ctx.stroke();
          ctx.restore();
        } else if (myP.weaponClass === 'Sword' || myP.weaponClass === 'Dagger') {
          const px = (myP.x + PLAYER_WIDTH/2) * PIXELS_PER_METER;
          const py = (myP.y + PLAYER_HEIGHT/2) * PIXELS_PER_METER;
          const angle = Math.atan2(mouseRef.current.y - (myP.y + PLAYER_HEIGHT/2), mouseRef.current.x - (myP.x + PLAYER_WIDTH/2));
          const weaponClass = myP.weaponClass as WeaponClass;
          const stats = WEAPON_STATS[weaponClass];
          
          ctx.save();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.lineWidth = 3;
          
          if (weaponClass === 'Sword') {
            const halfAngle = (stats.angle / 2) * (Math.PI / 180);
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.arc(px, py, stats.range * PIXELS_PER_METER, angle - halfAngle, angle + halfAngle);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          } else if (weaponClass === 'Dagger') {
            ctx.beginPath();
            ctx.arc(px, py, stats.range * PIXELS_PER_METER, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
          ctx.restore();
        }
      }
    }

    if (currentRoom.projectiles) {
      Object.values(currentRoom.projectiles).forEach(proj => {
        const elapsed = now - proj.startTime;
        const px = (proj.startX + proj.vx * (elapsed / 1000)) * PIXELS_PER_METER;
        const py = (proj.startY + proj.vy * (elapsed / 1000)) * PIXELS_PER_METER;
        const angle = Math.atan2(proj.vy, proj.vx);
        
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(angle);
        
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-15, 0);
        ctx.lineTo(10, 0);
        ctx.stroke();
        
        const isMyArrow = proj.ownerId === profileRef.current?.id;
        const glowColor = isMyArrow ? '#3b82f6' : '#ef4444';
        ctx.shadowBlur = 10;
        ctx.shadowColor = glowColor;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.fillStyle = glowColor;
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(0, -5);
        ctx.lineTo(0, 5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-15, 0); ctx.lineTo(-22, -6);
        ctx.moveTo(-12, 0); ctx.lineTo(-19, -6);
        ctx.moveTo(-15, 0); ctx.lineTo(-22, 6);
        ctx.moveTo(-12, 0); ctx.lineTo(-19, 6);
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
          
          if (p.color.startsWith('aura-')) {
             ctx.fillStyle = p.color === 'aura-black' ? '#000000' : '#ffffff';
          } else {
             ctx.fillStyle = p.color;
          }
          
          ctx.fillRect(gx, gy, PLAYER_WIDTH * PIXELS_PER_METER, PLAYER_HEIGHT * PIXELS_PER_METER);
          ctx.restore();
        }
      }
    });

    playersToDraw.forEach(p => {
      const px = p.x * PIXELS_PER_METER;
      const py = p.y * PIXELS_PER_METER;
      const pw = PLAYER_WIDTH * PIXELS_PER_METER;
      const ph = PLAYER_HEIGHT * PIXELS_PER_METER;

      const timeSinceDeath = now - (p.deathTime || 0);
      if (p.hp <= 0 && currentRoom.status !== 'lobby') {
        if (timeSinceDeath < 1500) {
          ctx.save();
          ctx.fillStyle = '#cbd5e1';
          ctx.globalAlpha = 0.6 * (1 - timeSinceDeath / 1500);
          const cx = px + pw / 2;
          const cy = py + ph / 2;
          for (let i = 0; i < 8; i++) {
            const ox = Math.cos(i * (Math.PI / 4) + (now / 500)) * (12 + (timeSinceDeath / 50));
            const oy = Math.sin(i * (Math.PI / 4) + (now / 500)) * (12 + (timeSinceDeath / 50));
            ctx.beginPath();
            ctx.arc(cx + ox, cy + oy, 15 * (1 - timeSinceDeath / 1500), 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
        return;
      }

      const attackDuration = 500;
      const timeSinceAttack = now - (p.lastAttackTime || 0);
      if (timeSinceAttack < attackDuration) {
        const isLocal = p.id === profileRef.current?.id;
        const baseColor = isLocal ? '38, 114, 238' : '238, 43, 43'; 
        let opacity = 0.7;
        if (timeSinceAttack > 400) opacity = 0.7 * (1 - (timeSinceAttack - 400) / 100);
        const centerX = px + pw / 2;
        const centerY = py + ph / 2;
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

      const isStunned = now < (p.stunnedUntil || 0);
      const isWinner = p.name === currentRoom.lastWinnerName && (currentRoom.status === 'celebrating' || currentRoom.status === 'round_over' || currentRoom.status === 'finished');

      ctx.save();
      
      if (p.color.startsWith('aura-')) {
        const grad = ctx.createLinearGradient(px, py, px + pw, py + ph);
        const t = (now % 3000) / 3000; 
        
        if (p.color === 'aura-g1') { grad.addColorStop(t, '#8A2387'); grad.addColorStop((t+0.5)%1, '#E94057'); }
        else if (p.color === 'aura-g2') { grad.addColorStop(t, '#00F2FE'); grad.addColorStop((t+0.5)%1, '#4FACFE'); }
        else if (p.color === 'aura-g3') { grad.addColorStop(t, '#FF416C'); grad.addColorStop((t+0.5)%1, '#FF4B2B'); }
        else if (p.color === 'aura-g4') { grad.addColorStop(t, '#11998E'); grad.addColorStop((t+0.5)%1, '#38EF7D'); }
        else if (p.color === 'aura-g5') { grad.addColorStop(t, '#1F1C2C'); grad.addColorStop((t+0.5)%1, '#928DAB'); }
        else if (p.color === 'aura-g6') { grad.addColorStop(t, '#00C6FF'); grad.addColorStop((t+0.5)%1, '#0072FF'); }
        else if (p.color === 'aura-g7') { grad.addColorStop(t, '#7F00FF'); grad.addColorStop((t+0.5)%1, '#E100FF'); }
        else if (p.color === 'aura-g8') { grad.addColorStop(t, '#F857A6'); grad.addColorStop((t+0.5)%1, '#FF5858'); }
        else if (p.color === 'aura-g9') { grad.addColorStop(t, '#0B132B'); grad.addColorStop((t+0.5)%1, '#1C2541'); }
        else if (p.color === 'aura-g10') { grad.addColorStop(t, '#F21B3F'); grad.addColorStop((t+0.5)%1, '#330033'); }
        
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = p.color;
      }

      if (p.noBorderEnabled) {
        ctx.strokeStyle = 'transparent';
      } else {
        ctx.strokeStyle = 'black';
      }
      
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
      if (!p.noBorderEnabled) ctx.stroke();

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
      const weaponX = p.facing === 'right' ? px + pw - 5 : px + 5;
      const weaponY = py + ph / 2 + 5;
      ctx.translate(weaponX, weaponY);
      if (p.facing === 'left') ctx.scale(-1, 1);
      
      const weaponClass = p.weaponClass as WeaponClass;
      if (weaponClass === 'Sword') {
        ctx.rotate(-Math.PI / 4);
        const bladeGrad = ctx.createLinearGradient(0, 0, 28, 0);
        bladeGrad.addColorStop(0, '#38bdf8');
        bladeGrad.addColorStop(1, '#e0f2fe');
        ctx.fillStyle = bladeGrad;
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -3.5);
        ctx.lineTo(24, -3.5);
        ctx.lineTo(28, 0);
        ctx.lineTo(24, 3.5);
        ctx.lineTo(0, 3.5);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.roundRect(-2, -9, 5, 18, 2);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.roundRect(-8, -2.5, 8, 5, 1);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#451a03';
        ctx.beginPath(); ctx.arc(-8, 0, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      } else if (weaponClass === 'Dagger') {
        ctx.rotate(-Math.PI / 4);
        const dagGrad = ctx.createLinearGradient(0, 0, 18, 0);
        dagGrad.addColorStop(0, '#d946ef');
        dagGrad.addColorStop(1, '#f5d0fe');
        ctx.fillStyle = dagGrad;
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -4);
        ctx.lineTo(14, -4);
        ctx.lineTo(18, 0);
        ctx.lineTo(14, 4);
        ctx.lineTo(0, 4);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.roundRect(-1, -7, 3, 14, 1);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.roundRect(-5, -2.5, 5, 5, 1);
        ctx.fill(); ctx.stroke();
      } else if (weaponClass === 'Bow') {
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(0, 0, 16, -Math.PI/2, Math.PI/2); ctx.stroke();
        ctx.fillStyle = '#ca8a04';
        ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      ctx.restore();

      if (!isWinner) {
        ctx.save();
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1;
        const eyeX = p.facing === 'right' ? px + pw - 12 : px + 4;
        ctx.beginPath(); ctx.arc(eyeX + 4, py + 12, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'black';
        ctx.beginPath(); ctx.arc(eyeX + 5, py + 12, 2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else {
        ctx.save();
        const sx = px + (pw / 2);
        const finalEyeY = py + 12;
        let currentY = finalEyeY;
        if (currentRoom.status === 'celebrating' && currentRoom.celebrationStartTime) {
          const celebrationDuration = 1500;
          const elapsed = now - currentRoom.celebrationStartTime;
          const progress = Math.min(1, elapsed / celebrationDuration);
          currentY = -100 + (finalEyeY + 100) * progress;
        }
        ctx.shadowBlur = 15; ctx.shadowColor = 'rgba(255, 255, 0, 0.8)';
        ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
        ctx.fillStyle = 'black';
        ctx.fillRect(sx - 16, currentY - 6, 14, 10); 
        ctx.fillRect(sx + 2, currentY - 6, 14, 10);  
        ctx.fillRect(sx - 2, currentY - 2, 4, 3);   
        ctx.fillStyle = 'white'; ctx.globalAlpha = 0.5;
        ctx.fillRect(sx - 14, currentY - 4, 4, 4);
        ctx.fillRect(sx + 4, currentY - 4, 4, 4);
        ctx.restore();
      }

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
      
      ctx.save();
      ctx.font = 'bold 12px Luckiest Guy'; ctx.textAlign = 'center';
      
      if (p.color.startsWith('aura-')) {
        const t = (now % 3000) / 3000;
        const grad = ctx.createLinearGradient(px, py - 35, px + pw, py - 20);
        if (p.color === 'aura-g1') { grad.addColorStop(t, '#8A2387'); grad.addColorStop((t+0.5)%1, '#E94057'); }
        else if (p.color === 'aura-g2') { grad.addColorStop(t, '#00F2FE'); grad.addColorStop((t+0.5)%1, '#4FACFE'); }
        else if (p.color === 'aura-g3') { grad.addColorStop(t, '#FF416C'); grad.addColorStop((t+0.5)%1, '#FF4B2B'); }
        else if (p.color === 'aura-g4') { grad.addColorStop(t, '#11998E'); grad.addColorStop((t+0.5)%1, '#38EF7D'); }
        else if (p.color === 'aura-g5') { grad.addColorStop(t, '#1F1C2C'); grad.addColorStop((t+0.5)%1, '#928DAB'); }
        else if (p.color === 'aura-g6') { grad.addColorStop(t, '#00C6FF'); grad.addColorStop((t+0.5)%1, '#0072FF'); }
        else if (p.color === 'aura-g7') { grad.addColorStop(t, '#7F00FF'); grad.addColorStop((t+0.5)%1, '#E100FF'); }
        else if (p.color === 'aura-g8') { grad.addColorStop(t, '#F857A6'); grad.addColorStop((t+0.5)%1, '#FF5858'); }
        else if (p.color === 'aura-g9') { grad.addColorStop(t, '#0B132B'); grad.addColorStop((t+0.5)%1, '#1C2541'); }
        else if (p.color === 'aura-g10') { grad.addColorStop(t, '#F21B3F'); grad.addColorStop((t+0.5)%1, '#330033'); }
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = p.color;
      }

      ctx.strokeStyle = 'black'; ctx.lineWidth = 3;
      ctx.strokeText(p.name, px + pw/2, py - 25);
      ctx.fillText(p.name, px + pw/2, py - 25);
      ctx.restore();

      if (now < (p.emojiUntil || 0)) {
        ctx.save();
        ctx.font = '24px serif';
        ctx.textAlign = 'center';
        ctx.fillText('😊', px + pw/2, py - 55);
        ctx.restore();
      }
    });

    ctx.save();
    ctx.font = 'bold 36px Luckiest Guy'; 
    ctx.textAlign = 'center'; ctx.lineWidth = 6;
    if (effectsRef.current) {
      effectsRef.current.forEach(fx => {
        const elapsed = Math.max(0, now - fx.timestamp);
        if (elapsed > 1000) return;
        const opacity = Math.max(0, 1 - elapsed / 1000);
        const drift = (elapsed / 1000) * 80;
        const fxX = fx.x * PIXELS_PER_METER;
        const fxY = (fx.y * PIXELS_PER_METER) - 60 - drift;

        ctx.globalAlpha = opacity;
        ctx.strokeStyle = 'black';
        ctx.fillStyle = fx.type === 'damage' ? '#ff4444' : '#4ade80';
        const text = fx.type === 'damage' ? fx.amount.toString() : `+${fx.amount}`;
        ctx.strokeText(text, fxX, fxY);
        ctx.fillText(text, fxX, fxY);
      });
    }
    ctx.restore();
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
  
  if (myP) {
    const reloadRemaining = (myWeaponStats.delay * 1000) - (now - (myP.lastAttackTime || 0));
    const dashRemaining = (myWeaponStats.dashCooldown || 4.0) - (myP.dashRechargeProgress || 0);
    if (now - feedback.lastReloadFail < 500 && reloadRemaining > 0) alerts.push({ text: `${(reloadRemaining / 1000).toFixed(1)}s`, color: '#ff4444', alpha: 1 - (now - feedback.lastReloadFail) / 500 });
    if (now - feedback.lastDashFail < 500 && dashRemaining > 0) alerts.push({ text: `${dashRemaining.toFixed(1)}s`, color: '#fbbf24', alpha: 1 - (now - feedback.lastDashFail) / 500 });
    if (now - feedback.lastStaminaFail < 500) alerts.push({ text: Math.floor(myP.stamina || 0).toString(), color: '#60a5fa', alpha: 1 - (now - feedback.lastStaminaFail) / 500 });
  }

  const playerCount = room?.players ? Object.keys(room.players).length : 0;
  const allReady = (room?.players && Object.keys(room.players).length > 0) ? Object.values(room.players).every(p => p.isReady) : false;
  const canStart = room && room.players && Object.keys(room.players).length >= 2 && allReady;

  let countdownText = '';
  let showCountdown = false;
  if (room?.startTime) {
    const elapsed = now - room.startTime;
    if (room.status === 'starting') {
      showCountdown = true;
      if (elapsed < 1000) countdownText = '3'; else if (elapsed < 2000) countdownText = '2'; else if (elapsed < 3000) countdownText = '1'; else countdownText = 'GO!';
    } else if (room.status === 'playing' && elapsed < 4000) {
      showCountdown = true; countdownText = 'GO!';
    }
  }

  const isLocalReady = myP?.isReady ?? false;
  const showResults = room?.status === 'finished' && !isLocalReady;
  const showLobby = room?.status === 'lobby' || (room?.status === 'finished' && isLocalReady);

  const recentMessages = messages.filter(m => nowTick - m.timestamp < 7000).slice(-6);

  return (
    <div className="min-h-screen bg-[#000035] overflow-hidden flex flex-col items-center select-none" onMouseMove={handleMouseMove}>
      <div className="fixed pointer-events-none z-[9999] flex flex-col items-center gap-1 select-none" style={{ left: mousePos.x, top: mousePos.y + 35, transform: 'translateX(-50%)' }}>
        {alerts.map((alert, i) => (
          <span key={i} className="font-headline text-2xl drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]" style={{ color: alert.color, opacity: alert.alpha, WebkitTextStroke: '2px black' }}>
            {alert.text}
          </span>
        ))}
      </div>

      {authUser && <FriendsSidebar currentRoomId={roomId} />}

      {playerCount === 1 && (
        <div className="w-full bg-destructive/20 py-2 border-b-4 border-black text-center z-[100]">
          <span className="font-headline text-2xl text-white tracking-widest drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]">EMPTY ROOM</span>
        </div>
      )}

      {!isConnected && (
        <div className="w-full bg-yellow-500/80 py-2 border-b-4 border-black text-center z-[101] flex items-center justify-center gap-2">
          <WifiOff className="w-6 h-6 text-black" />
          <span className="font-headline text-2xl text-black tracking-widest drop-shadow-[1px_1px_0_rgba(255,255,255,0.5)]">RECONNECTING...</span>
        </div>
      )}

      {flashActive && (
        <div className={`fixed inset-0 pointer-events-none z-[100] border-[40px] ${flash.type === 'taken' ? 'border-red-500/30' : 'border-blue-500/30'} animate-in fade-in duration-200`} />
      )}

      <header className="w-full p-4 flex justify-center items-center bg-black/60 backdrop-blur-xl border-b-8 border-black z-50">
        <div className="absolute left-4">
          <Button 
            variant="ghost" 
            onClick={handleQuit} 
            disabled={isLocked}
            className="cartoon-button bg-destructive text-white h-12 px-6 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="w-5 h-5 mr-2" /> {isLocked ? 'IN COMBAT' : 'QUIT'}
          </Button>
        </div>
        <div className="flex items-center gap-4 overflow-x-auto max-w-[70vw] scrollbar-hide px-4">
          {room?.players && Object.values(room.players).map(p => (
            <div key={p.id} className="flex items-center gap-3 bg-black/40 border-4 border-black rounded-[20px] p-2 px-4 shadow-[4px_4px_0_rgba(0,0,0,1)] min-w-[180px]">
              <div className="flex flex-col items-start gap-0.5 flex-1">
                <div className="flex items-center gap-2">
                  <WeaponIcon weapon={p.weaponClass as WeaponClass} className="w-7 h-7 text-xl" />
                  <span className="font-headline text-lg truncate max-w-[100px]" style={{ color: p.color.startsWith('aura-') ? '#ffffff' : p.color, WebkitTextStroke: '1px black' }}>{p.name}</span>
                  {p.id === room?.createdBy && <Crown className="w-5 h-5 text-yellow-500 fill-yellow-500" />}
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
            onContextMenu={handleContextMenu}
          />
          
          {showCountdown && (
            <div className="absolute inset-0 flex items-center justify-center z-[60] pointer-events-none">
              <span className="text-9xl font-headline text-white drop-shadow-[8px_8px_0_rgba(0,0,0,1)] animate-in zoom-in duration-300">{countdownText}</span>
            </div>
          )}

          {showLobby && room && (
             <div className="absolute inset-0 bg-black/80 backdrop-blur-lg flex flex-col items-center justify-center z-50 space-y-10">
                <h2 className="text-7xl font-headline text-white animate-bounce-subtle">{room.name.toUpperCase()}</h2>
                <div className="flex gap-8">
                  {(room.players ? Object.values(room.players) : []).map(p => (
                    <div key={p.id} className="flex flex-col items-center gap-3">
                      <div className="relative">
                        <div className={cn(
                           "w-16 h-16 rounded-2xl shadow-[4px_4px_0_rgba(0,0,0,1)]",
                           p.color.startsWith('aura-') ? p.color : "",
                           p.noBorderEnabled ? "border-0" : "border-4 border-black"
                        )} style={{ backgroundColor: p.color.startsWith('aura-') ? "" : p.color }} />
                        {p.id === room?.createdBy && <Crown className="absolute -top-6 -right-6 w-10 h-10 text-yellow-500 fill-yellow-500 rotate-12 drop-shadow-[2px_2px_0_rgba(0,0,0,1)]" />}
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
                        <span className="font-headline text-2xl text-white/40 uppercase tracking-widest text-center">WAITING PLAYERS..</span>
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
              <h2 className="text-9xl font-headline text-accent animate-bounce drop-shadow-[8px_8px_0_rgba(0,0,0,1)]">{room.lastWinnerName === 'DRAW' ? 'DRAW!' : 'ROUND!'}</h2>
              {room.lastWinnerName && room.lastWinnerName !== 'DRAW' && (
                <span className="text-4xl font-headline text-white drop-shadow-[4px_4px_0_rgba(0,0,0,1)] mt-4">{room.lastWinnerName.toUpperCase()} WINS</span>
              )}
            </div>
          )}

          {showResults && room && (
             <div className="absolute inset-0 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center z-50 p-10 text-center space-y-10">
                <Trophy className="w-32 h-32 text-yellow-500 animate-pulse drop-shadow-[8px_8px_0_rgba(0,0,0,1)]" />
                <h2 className="text-8xl font-headline text-white italic">{room.lastWinnerName ? `${room.lastWinnerName.toUpperCase()} IS CHAMPION!` : 'CHAMPION!'}</h2>
                <div className="flex gap-4">
                  <Button onClick={handlePlayAgain} size="lg" className="cartoon-button bg-accent text-black text-2xl h-16 px-16 flex items-center gap-3"><RotateCcw className="w-6 h-6" /> PLAY AGAIN</Button>
                  <Button onClick={handleQuit} size="lg" className="cartoon-button bg-primary text-white text-2xl h-16 px-16">LOBBY</Button>
                </div>
             </div>
          )}
        </div>

        {/* Global Chat UI - Fixed outside gameplay area */}
        <div className="fixed bottom-6 right-6 flex flex-col items-end gap-3 z-[1000] w-[350px]">
          {/* Chat Preview */}
          {!isChatOpen && recentMessages.length > 0 && (
            <div className="w-full flex flex-col gap-1 items-end animate-in slide-in-from-bottom-2 duration-300">
              {recentMessages.map(msg => (
                <div key={msg.id} className="py-1 px-3 max-w-full">
                  <div className="text-sm break-words leading-tight">
                    <span 
                      className={cn("font-headline mr-1.5", msg.senderColor.startsWith('aura-') ? msg.senderColor : "")}
                      style={{ 
                        color: msg.senderColor.startsWith('aura-') ? 'transparent' : msg.senderColor, 
                        WebkitTextStroke: '1px black',
                        backgroundClip: msg.senderColor.startsWith('aura-') ? 'text' : 'none',
                        WebkitBackgroundClip: msg.senderColor.startsWith('aura-') ? 'text' : 'none',
                      }}
                    >
                      {msg.senderName}:
                    </span>
                    <span className="text-white font-headline uppercase tracking-tight" style={{ WebkitTextStroke: '0.5px black' }}>
                      {msg.text}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Full Chat History */}
          {isChatOpen && (
            <div className="w-full bg-black/90 backdrop-blur-xl border-4 border-black rounded-[30px] shadow-[10px_10px_0_rgba(0,0,0,1)] flex flex-col h-[400px] animate-in zoom-in-95 duration-200">
              <div className="p-4 border-b-2 border-white/10 flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-primary" />
                <h3 className="font-headline text-lg text-white">ARENA CHAT</h3>
              </div>
              <ScrollArea className="flex-1 p-4">
                <div className="flex flex-col gap-2">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-20 py-20">
                      <MessageCircle className="w-12 h-12 mb-2" />
                      <p className="font-headline text-xs">NO MESSAGES YET</p>
                    </div>
                  ) : (
                    messages.map(msg => (
                      <div key={msg.id} className="text-sm break-words leading-tight">
                        <span 
                          className={cn("font-headline mr-1.5", msg.senderColor.startsWith('aura-') ? msg.senderColor : "")}
                          style={{ 
                            color: msg.senderColor.startsWith('aura-') ? 'transparent' : msg.senderColor, 
                            WebkitTextStroke: '1px black',
                            backgroundClip: msg.senderColor.startsWith('aura-') ? 'text' : 'none',
                            WebkitBackgroundClip: msg.senderColor.startsWith('aura-') ? 'text' : 'none',
                          }}
                        >
                          {msg.senderName}:
                        </span>
                        <span className="text-white font-headline uppercase tracking-tight" style={{ WebkitTextStroke: '0.5px black' }}>
                          {msg.text}
                        </span>
                      </div>
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>
              <div className="p-4 border-t-2 border-white/10">
                <Input
                  ref={chatInputRef}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="TYPE MESSAGE..."
                  className="bg-black/60 border-4 border-black rounded-[15px] h-12 font-bold text-white placeholder:text-white/20 focus-visible:ring-primary"
                />
              </div>
            </div>
          )}

          {/* Chat Toggle Hint */}
          {!isChatOpen && (
            <div className="flex items-center gap-2 text-white/40 font-headline select-none hover:text-white/60 transition-colors cursor-pointer group" onClick={() => {
              setIsChatOpen(true);
              setTimeout(() => chatInputRef.current?.focus(), 10);
            }}>
              <span className="text-lg">ENTER TO CHAT</span>
              <CornerDownLeft className="w-6 h-6 group-hover:translate-x-0.5 transition-transform" />
            </div>
          )}
        </div>

        {/* Player Stats HUD */}
        <div className={`absolute bottom-6 left-6 p-4 cartoon-card bg-black/60 backdrop-blur-md min-w-[240px] space-y-3 z-50 transition-all duration-300 ${isStunned ? 'blur-sm scale-95 opacity-80' : ''}`}>
          <div className="space-y-1">
            <div className="flex justify-between items-center px-1">
              <span className="font-headline text-[10px] text-white/80 flex items-center gap-1 uppercase tracking-tight">
                <Heart className="w-3 h-3 fill-current text-destructive" /> HEALTH
              </span>
              <div className="flex items-center gap-2">
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
            <span className="font-headline text-sm text-[#60a5fa] drop-shadow-[1px_1px_0_rgba(0,0,0,1)]">{Math.floor(myP?.stamina || 0)}</span>
          </div>

          {isStunned && (
            <div className="absolute inset-0 flex items-center justify-center z-[60] pointer-events-none">
               <span className="font-headline text-6xl text-white drop-shadow-[4px_4px_0_rgba(0,0,0,1)]">{(stunRemaining / 1000).toFixed(1)}</span>
            </div>
          )}
          
          <div className="space-y-1 pt-1 border-t border-white/10">
            <div className="flex justify-between items-center px-1">
              <span className="font-headline text-[10px] text-white/80 uppercase tracking-tight flex items-center gap-1">
                 <Zap className="w-3 h-3 fill-current text-[#60a5fa]" /> DASH
              </span>
              <span className="font-headline text-sm text-accent drop-shadow-[1px_1px_0_rgba(0,0,0,1)]">
                {myP && myP.dashCharges === maxDash ? 'READY' : `${((myWeaponStats?.dashCooldown || 4.0) - (myP?.dashRechargeProgress || 0)).toFixed(1)}s`}
              </span>
            </div>
            <div className="flex justify-between items-center px-1">
               <div className="flex gap-1.5">
                {Array.from({ length: maxDash }).map((_, i) => (
                  <div key={i} className={`w-4 h-4 rounded-full border-2 border-black transition-all duration-300 ${i < (myP?.dashCharges || 0) ? 'bg-accent shadow-[0_0_8px_rgba(255,255,0,0.5)] scale-110' : 'bg-black/60 scale-90'}`} />
                ))}
              </div>
            </div>
          </div>

          {myP?.weaponClass === 'Sword' && (
            <div className="space-y-1 pt-1 border-t border-white/10">
              <div className="flex justify-between items-center px-1">
                <span className="font-headline text-[10px] text-white/80 uppercase tracking-tight flex items-center gap-1">
                   <ShieldAlert className="w-3 h-3 fill-current text-yellow-500" /> STUN CD
                </span>
                <span className="font-headline text-sm text-yellow-500 drop-shadow-[1px_1px_0_rgba(0,0,0,1)]">
                  {myP && now > (myP.stunCooldownUntil || 0) ? 'READY' : `${(((myP?.stunCooldownUntil || 0) - now) / 1000).toFixed(1)}s`}
                </span>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
