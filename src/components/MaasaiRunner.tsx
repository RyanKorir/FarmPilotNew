import React, { useState, useEffect, useRef } from 'react';
import { Trophy, RefreshCw, Play, AlertCircle, Maximize2, Users, ChevronRight, Star, X, Shield, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../firebase';
import { collection, query, orderBy, limit, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../utils/firestoreError';

// Logical dimensions for game coordination
const LOGICAL_WIDTH = 1200;
const LOGICAL_HEIGHT = 600;
const GROUND_Y = 520;
const GRAVITY = 0.5;
const MAX_JUMP_FORCE = -16;
const MIN_JUMP_FORCE = -9;
const INITIAL_SPEED = 7.5;
const SPEED_INCREMENT = 0.5;
const LEVEL_THRESHOLD = 1000;
const MOVE_SPEED = 10;
const SPEAR_SPEED = 15;
const COIN_SPAWN_RATE = 60;
const PLATFORM_SPAWN_RATE = 150;

const CHARACTERS = [
  { id: 'warrior', name: 'Warrior', color: '#B91C1C', ability: 'Double Score', baseSpearCooldown: 1000 },
  { id: 'elder', name: 'Elder', color: '#1D4ED8', ability: 'Shield Recovery', baseSpearCooldown: 1500 },
  { id: 'youth', name: 'Youth', color: '#059669', ability: 'Agility Boost', baseSpearCooldown: 800 },
];

interface LeaderboardEntry {
  userId: string;
  userName: string;
  score: number;
  level: number;
}

interface Upgrades {
  spearSpeed: number;
  jumpForce: number;
  shieldPower: number;
  coinValue: number;
}

export default function MaasaiRunner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<'idle' | 'selecting' | 'playing' | 'gameover' | 'leaderboard' | 'shop'>('idle');
  const [selectedChar, setSelectedChar] = useState(CHARACTERS[0]);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const [upgrades, setUpgrades] = useState<Upgrades>({
    spearSpeed: 1,
    jumpForce: 1,
    shieldPower: 1,
    coinValue: 1
  });
  const [level, setLevel] = useState(1);
  const [lastSpearTime, setLastSpearTime] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isJumping, setIsJumping] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    setIsTouchDevice(window.matchMedia('(pointer: coarse)').matches);
    
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth && window.matchMedia('(max-width: 768px)').matches);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  const gameRef = useRef({
    player: { 
      x: 100, 
      y: GROUND_Y - 60, 
      width: 35, 
      height: 60, 
      dy: 0, 
      dx: 0,
      jumping: false, 
      jumpTime: 0,
      crouching: false,
      shielded: false
    },
    obstacles: [] as any[],
    spears: [] as any[],
    coins: [] as any[],
    platforms: [] as any[],
    powerups: [] as any[],
    particles: [] as any[],
    frameCount: 0,
    score: 0,
    coinsCollected: 0,
    level: 1,
    speed: INITIAL_SPEED,
    lastSpawn: 0,
    lastCoinSpawn: 0,
    lastPlatformSpawn: 0,
    lastSpearTime: 0,
    keys: {} as Record<string, boolean>,
    status: 'neutral' as 'neutral' | 'jumping' | 'crouching' | 'dead'
  });

  const jump = () => {
    const p = gameRef.current.player;
    if (!p.jumping && gameState === 'playing') {
      p.jumping = true;
      p.jumpTime = Date.now();
      p.dy = MIN_JUMP_FORCE;
    }
  };

  const spear = () => {
    if (gameState !== 'playing') return;
    const g = gameRef.current;
    const now = Date.now();
    const cooldown = (selectedChar.baseSpearCooldown || 1000) / upgrades.spearSpeed;
    
    if (now - g.lastSpearTime >= cooldown) {
      g.spears.push({
        x: g.player.x + 40,
        y: g.player.y + 20,
        w: 40,
        h: 6
      });
      g.lastSpearTime = now;
      setLastSpearTime(now);
    }
  };

  // Fetch High Score and Leaderboard
  useEffect(() => {
    const fetchStats = async () => {
      if (!auth.currentUser) return;
      
      const path = `leaderboard/${auth.currentUser.uid}`;
      try {
        const userRef = doc(db, 'leaderboard', auth.currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          setHighScore(data.score || 0);
          setCoins(data.totalCoins || 0);
          if (data.upgrades) setUpgrades(data.upgrades);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, path);
      }

      try {
        const q = query(collection(db, 'leaderboard'), orderBy('score', 'desc'), limit(10));
        const querySnapshot = await getDocs(q);
        const entries: LeaderboardEntry[] = [];
        querySnapshot.forEach((doc) => {
          entries.push(doc.data() as LeaderboardEntry);
        });
        setLeaderboard(entries);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'leaderboard');
      }
    };
    fetchStats();
  }, [gameState]);

  const saveScore = async (finalScore: number, finalLevel: number, finalCoins: number) => {
    if (!auth.currentUser) return;
    
    const path = `leaderboard/${auth.currentUser.uid}`;
    try {
      const userRef = doc(db, 'leaderboard', auth.currentUser.uid);
      const userSnap = await getDoc(userRef);
      const currentCoins = userSnap.exists() ? (userSnap.data().totalCoins || 0) : 0;
      const newTotalCoins = currentCoins + finalCoins;
      setCoins(newTotalCoins);

      await setDoc(userRef, {
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'Unknown Warrior',
        score: Math.max(finalScore, highScore),
        level: Math.max(finalLevel, level),
        totalCoins: newTotalCoins,
        characterId: selectedChar.id,
        upgrades: upgrades,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    gameRef.current.keys[e.code] = true;
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      if (gameState === 'playing') {
        jump();
      } else if (gameState === 'idle' || gameState === 'gameover') {
        setGameState('selecting');
      }
    }
    if (e.code === 'KeyF' || e.code === 'Enter') {
      spear();
    }
    if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      if (gameState === 'playing') {
        gameRef.current.player.crouching = true;
      }
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    gameRef.current.keys[e.code] = false;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      gameRef.current.player.crouching = false;
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState, selectedChar]);

  const resetGame = () => {
    gameRef.current = {
      player: { 
        x: 100, 
        y: GROUND_Y - 60, 
        width: 35, 
        height: 60, 
        dy: 0, 
        dx: 0,
        jumping: false, 
        jumpTime: 0,
        crouching: false,
        shielded: false
      },
      obstacles: [],
      spears: [],
      coins: [],
      platforms: [],
      powerups: [],
      particles: [],
      frameCount: 0,
      score: 0,
      coinsCollected: 0,
      level: 1,
      speed: INITIAL_SPEED,
      lastSpawn: 0,
      lastCoinSpawn: 0,
      lastPlatformSpawn: 0,
      lastSpearTime: 0,
      keys: {},
      status: 'neutral'
    };
    setScore(0);
    setLevel(1);
    setGameState('playing');
  };

  const buyUpgrade = (key: keyof Upgrades) => {
    const cost = Math.floor(upgrades[key] * 50);
    if (coins >= cost) {
      setCoins(prev => prev - cost);
      const newUpgrades = { ...upgrades, [key]: upgrades[key] + 0.2 };
      setUpgrades(newUpgrades);
      // Sync to Firestore immediately
      if (auth.currentUser) {
        setDoc(doc(db, 'leaderboard', auth.currentUser.uid), {
          totalCoins: coins - cost,
          upgrades: newUpgrades
        }, { merge: true });
      }
    }
  };

  useEffect(() => {
    if (gameState !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const update = () => {
      const g = gameRef.current;
      const p = g.player;

      // Handle Inputs
      if (g.keys['ArrowLeft'] || g.keys['KeyA']) p.x -= MOVE_SPEED;
      if (g.keys['ArrowRight'] || g.keys['KeyD']) p.x += MOVE_SPEED;
      
      // Crouching logic
      if (p.crouching) {
        p.height = 40;
        if (!p.jumping) p.y = GROUND_Y - p.height;
      } else {
        p.height = 80;
      }

      // Bounds
      if (p.x < 0) p.x = 0;
      if (p.x > LOGICAL_WIDTH - p.width) p.x = LOGICAL_WIDTH - p.width;

      // Variable Jump Height
      if (p.jumping && (g.keys['Space'] || g.keys['ArrowUp'])) {
        const holdTime = Date.now() - p.jumpTime;
        if (holdTime < 300) { // Max hold boost for 300ms
          p.dy -= 0.6 * upgrades.jumpForce;
          if (p.dy < MAX_JUMP_FORCE * upgrades.jumpForce) p.dy = MAX_JUMP_FORCE * upgrades.jumpForce;
        }
      }

      // Physics
      p.dy += GRAVITY;
      p.y += p.dy;

      // Platform Collisions (One-way)
      let onPlatform = false;
      for (const plat of g.platforms) {
        if (
          p.dy >= 0 &&
          p.y + p.height >= plat.y &&
          p.y + p.height <= plat.y + 20 &&
          p.x + p.width > plat.x &&
          p.x < plat.x + plat.w
        ) {
          p.y = plat.y - p.height;
          p.dy = 0;
          p.jumping = false;
          onPlatform = true;
          break;
        }
      }

      if (!onPlatform && p.y > GROUND_Y - p.height) {
        p.y = GROUND_Y - p.height;
        p.dy = 0;
        p.jumping = false;
      }

      // Score / Speed
      g.score += 0.1 * g.speed;
      if (g.frameCount % 5 === 0) {
        setScore(Math.floor(g.score));
      }
      
      const newLevel = Math.floor(g.score / LEVEL_THRESHOLD) + 1;
      if (newLevel > g.level) {
        g.level = newLevel;
        g.speed += SPEED_INCREMENT;
        setLevel(newLevel);
      }

      // Update Spears
      for (let i = g.spears.length - 1; i >= 0; i--) {
        const s = g.spears[i];
        s.x += SPEAR_SPEED;
        
        // Remove off-screen
        if (s.x > LOGICAL_WIDTH) {
          g.spears.splice(i, 1);
          continue;
        }

        // Spear Hit Obstacle
        for (let j = g.obstacles.length - 1; j >= 0; j--) {
          const obs = g.obstacles[j];
          if (
            s.x < obs.x + obs.w &&
            s.x + s.w > obs.x &&
            s.y < obs.y + obs.h &&
            s.y + s.h > obs.y
          ) {
            g.obstacles.splice(j, 1);
            g.spears.splice(i, 1);
            g.score += 50;
            // Particles for "death"
            for (let k = 0; k < 5; k++) {
              g.particles.push({
                x: obs.x + obs.w/2,
                y: obs.y + obs.h/2,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                color: obs.color,
                life: 1.0
              });
            }
            break;
          }
        }
      }

      // Spawning Obstacles
      g.frameCount++;
      const spawnRate = Math.max(40, 120 - g.speed * 3);
      if (g.frameCount - g.lastSpawn > spawnRate) {
        const types = [
          { type: 'prey', w: 50, h: 40, speed: 1.1, color: '#D4AA7D' },
          { type: 'swift', w: 30, h: 30, speed: 1.5, color: '#A39171' },
          { type: 'predator', w: 60, h: 50, speed: 2.0, danger: true, color: '#B91C1C' },
          { type: 'hazard', w: 40, h: 30, speed: 1.7, y: GROUND_Y - 180, color: '#4B5563' }
        ];
        const type = types[Math.floor(Math.random() * types.length)];
        g.obstacles.push({
          x: LOGICAL_WIDTH,
          y: type.y || GROUND_Y - type.h,
          phase: Math.random() * Math.PI * 2,
          ...type
        });
        g.lastSpawn = g.frameCount;
      }

      // Spawning Coins
      if (g.frameCount - g.lastCoinSpawn > COIN_SPAWN_RATE) {
        g.coins.push({
          x: LOGICAL_WIDTH,
          y: GROUND_Y - 50 - Math.random() * 200,
          w: 20,
          h: 20,
          rotation: 0
        });
        g.lastCoinSpawn = g.frameCount;
      }

      // Spawning Platforms
      if (g.frameCount - g.lastPlatformSpawn > PLATFORM_SPAWN_RATE) {
         g.platforms.push({
           x: LOGICAL_WIDTH,
           y: GROUND_Y - 120 - Math.random() * 150,
           w: 150 + Math.random() * 100,
           h: 20
         });
         g.lastPlatformSpawn = g.frameCount;
      }

      // Update Obstacles
      for (let i = g.obstacles.length - 1; i >= 0; i--) {
        const obs = g.obstacles[i];
        obs.x -= g.speed * obs.speed;
        // Alive Animation: wobbling
        obs.yOffset = Math.sin(g.frameCount * 0.1 + obs.phase) * 5;

        // Collision
        if (
          p.x < obs.x + obs.w - 10 &&
          p.x + p.width > obs.x + 10 &&
          p.y < obs.y + obs.h + obs.yOffset - 10 &&
          p.y + p.height > obs.y + obs.yOffset + 10
        ) {
          saveScore(g.score, g.level, g.coinsCollected);
          setGameState('gameover');
          return;
        }

        if (obs.x + obs.w < 0) g.obstacles.splice(i, 1);
      }

      // Update Coins
      for (let i = g.coins.length - 1; i >= 0; i--) {
        const c = g.coins[i];
        c.x -= g.speed;
        c.rotation += 0.1;

        if (
          p.x < c.x + c.w &&
          p.x + p.width > c.x &&
          p.y < c.y + c.h &&
          p.y + p.height > c.y
        ) {
          g.coinsCollected += 1 * upgrades.coinValue;
          g.coins.splice(i, 1);
          continue;
        }
        if (c.x + c.w < 0) g.coins.splice(i, 1);
      }

      // Update Platforms
      for (let i = g.platforms.length - 1; i >= 0; i--) {
        const plat = g.platforms[i];
        plat.x -= g.speed;
        if (plat.x + plat.w < 0) g.platforms.splice(i, 1);
      }

      // Update Particles
      for (let i = g.particles.length - 1; i >= 0; i--) {
        const part = g.particles[i];
        part.x += part.vx;
        part.y += part.vy;
        part.life -= 0.02;
        if (part.life <= 0) g.particles.splice(i, 1);
      }
    };

    const draw = () => {
      const g = gameRef.current;
      const p = g.player;
      
      ctx.save();
      // Auto-scale fixed logical size to current canvas size
      const scaleX = canvas.width / LOGICAL_WIDTH;
      const scaleY = canvas.height / LOGICAL_HEIGHT;
      ctx.scale(scaleX, scaleY);

      // Level-based background
      let skyColor = '#87CEEB';
      let groundColor = '#3F6212';
      
      if (level % 4 === 2) { // Sunset
        skyColor = '#FB923C';
        groundColor = '#78350F';
      } else if (level % 4 === 3) { // Night
        skyColor = '#0F172A';
        groundColor = '#14532D';
      } else if (level % 4 === 0) { // Storm
        skyColor = '#475569';
        groundColor = '#064E3B';
      }

      ctx.fillStyle = skyColor;
      ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

      // Environment Details (simplified clouds/stars)
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      for (let i = 0; i < 5; i++) {
        const xPost = (i * 300 - g.frameCount * 0.5) % 1500;
        ctx.beginPath();
        ctx.arc(xPost, 100 + i * 20, 40, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw Ground
      ctx.fillStyle = groundColor;
      ctx.fillRect(0, GROUND_Y, LOGICAL_WIDTH, LOGICAL_HEIGHT - GROUND_Y);

      // Savannah Grass
      ctx.strokeStyle = 'rgba(0,0,0,0.1)';
      ctx.lineWidth = 2;
      for (let i = 0; i < LOGICAL_WIDTH; i += 60) {
        const xOffset = (i - (g.frameCount * g.speed) % 60);
        ctx.beginPath();
        ctx.moveTo(xOffset, GROUND_Y);
        ctx.lineTo(xOffset + 10, GROUND_Y - 20);
        ctx.stroke();
      }

      // Shadow
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(p.x + 30, GROUND_Y + 5, 40 * (1 - (p.y / GROUND_Y)), 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // Reset for solid draws
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = '#000';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      // Draw Player
      ctx.fillStyle = selectedChar.color;
      // Silhouette of a runner with procedural leg movement
      const legPhase = g.frameCount * 0.15;
      const leg1 = Math.sin(legPhase) * 20;
      const leg2 = Math.sin(legPhase + Math.PI) * 20;
      
      ctx.beginPath();
      // Head
      ctx.arc(p.x + p.width/2, p.y + 10, 8, 0, Math.PI * 2);
      ctx.fill();
      
      // Body (alive movement)
      const bodyBob = Math.abs(Math.sin(legPhase)) * 3;
      ctx.lineWidth = 4;
      ctx.strokeStyle = selectedChar.color;
      ctx.beginPath();
      ctx.moveTo(p.x + p.width/2, p.y + 15 + bodyBob);
      ctx.lineTo(p.x + p.width/2, p.y + 40 + bodyBob);
      
      // Arms
      ctx.moveTo(p.x + p.width/2, p.y + 25 + bodyBob);
      ctx.lineTo(p.x + p.width/2 + leg2/2, p.y + 35 + bodyBob);
      ctx.moveTo(p.x + p.width/2, p.y + 25 + bodyBob);
      ctx.lineTo(p.x + p.width/2 + leg1/2, p.y + 35 + bodyBob);
      
      // Legs
      if (p.jumping) {
        ctx.moveTo(p.x + p.width/2, p.y + 40);
        ctx.lineTo(p.x + p.width/2 - 10, p.y + p.height);
        ctx.moveTo(p.x + p.width/2, p.y + 40);
        ctx.lineTo(p.x + p.width/2 + 10, p.y + p.height - 10);
      } else {
        ctx.moveTo(p.x + p.width/2, p.y + 40 + bodyBob);
        ctx.lineTo(p.x + p.width/2 + leg1, p.y + p.height);
        ctx.moveTo(p.x + p.width/2, p.y + 40 + bodyBob);
        ctx.lineTo(p.x + p.width/2 + leg2, p.y + p.height);
      }
      ctx.stroke();

      // Platforms
      g.platforms.forEach(plat => {
        ctx.fillStyle = '#451a03'; // Brown earth
        ctx.beginPath();
        ctx.roundRect(plat.x, plat.y, plat.w, plat.h, 5);
        ctx.fill();
        ctx.fillStyle = '#3f6212'; // Grass top
        ctx.fillRect(plat.x, plat.y, plat.w, 4);
      });

      // Coins
      g.coins.forEach(c => {
         ctx.save();
         ctx.translate(c.x + c.w/2, c.y + c.h/2);
         ctx.rotate(c.rotation);
         ctx.scale(Math.abs(Math.sin(c.rotation)), 1); // Spinning effect
         ctx.fillStyle = '#fbbf24'; // Gold
         ctx.beginPath();
         ctx.arc(0, 0, 10, 0, Math.PI * 2);
         ctx.fill();
         ctx.strokeStyle = '#92400e';
         ctx.stroke();
         ctx.restore();
      });

      // Obstacles
      g.obstacles.forEach(obs => {
        ctx.fillStyle = obs.color || '#F00';
        const yPos = obs.y + (obs.yOffset || 0);
        
        if (obs.type === 'hazard') {
          ctx.beginPath();
          ctx.moveTo(obs.x, yPos + obs.h);
          ctx.lineTo(obs.x + obs.w / 2, yPos);
          ctx.lineTo(obs.x + obs.w, yPos + obs.h);
          ctx.fill();
        } else {
          // Animated creature
          ctx.beginPath();
          const legSwing = Math.sin(g.frameCount * 0.2 + obs.phase) * 5;
          ctx.roundRect(obs.x, yPos, obs.w, obs.h, 12);
          ctx.fill();
          
          // Legs for predators/prey
          ctx.strokeStyle = obs.color;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(obs.x + 10, yPos + obs.h);
          ctx.lineTo(obs.x + 10 + legSwing, yPos + obs.h + 10);
          ctx.moveTo(obs.x + obs.w - 10, yPos + obs.h);
          ctx.lineTo(obs.x + obs.w - 10 - legSwing, yPos + obs.h + 10);
          ctx.stroke();

          // Eye
          ctx.fillStyle = '#000';
          ctx.beginPath();
          ctx.arc(obs.x + 10, yPos + 12, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Particles
      g.particles.forEach(part => {
        ctx.globalAlpha = part.life;
        ctx.fillStyle = part.color;
        ctx.fillRect(part.x, part.y, 4, 4);
      });
      ctx.globalAlpha = 1.0;

      // Spears
      ctx.fillStyle = '#666';
      g.spears.forEach(s => {
        ctx.beginPath();
        ctx.roundRect(s.x, s.y, s.w, s.h, 5);
        ctx.fill();
        ctx.fillStyle = '#C00';
        ctx.fillRect(s.x + s.w - 10, s.y, 10, s.h);
      });

      ctx.restore();
      animationId = requestAnimationFrame(() => {
        update();
        draw();
      });
    };

    draw();
    return () => cancelAnimationFrame(animationId);
  }, [gameState, level, selectedChar]);

  const toggleFullScreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        alert(`Error escaping to full screen: ${err.message}`);
      });
      setIsFullScreen(true);
    } else {
      document.exitFullscreen();
      setIsFullScreen(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col items-center justify-center overflow-hidden font-sans">
      <AnimatePresence>
        {isPortrait && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center text-white p-12 text-center"
          >
            <motion.div 
              animate={{ rotate: 90 }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className="w-20 h-12 border-4 border-white rounded-xl mb-8 flex items-center justify-center"
            >
              <div className="w-1 h-4 bg-white/20 rounded-full" />
            </motion.div>
            <h2 className="text-2xl font-black uppercase tracking-tighter mb-4">Landscape Protocol Required</h2>
            <p className="text-white/40 text-sm font-medium uppercase tracking-widest max-w-xs mx-auto">
              Rotate your device to enter the savannah and begin your ancestral journey.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div 
        ref={containerRef} 
        className={`relative w-full h-full max-w-[1200px] max-h-[600px] bg-[#1a1a1a] shadow-2xl overflow-hidden transition-all duration-700 md:border-[1px] md:border-white/10 md:rounded-[2rem] group ${
          gameState === 'playing' ? 'cursor-none' : ''
        }`}
      >
        <canvas 
          ref={canvasRef} 
          width={LOGICAL_WIDTH}
          height={LOGICAL_HEIGHT}
          className="w-full h-full object-contain pointer-events-none"
        />

        {/* Minimal HUD */}
        <div className="absolute top-0 inset-x-0 p-4 md:p-8 flex justify-between items-start pointer-events-none">
          <div className="flex gap-2">
            <div className="px-4 py-2 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 flex flex-col">
              <span className="text-[7px] font-black text-white/40 uppercase tracking-[0.2em] mb-0.5">Score</span>
              <span className="text-xl font-serif font-black text-white">{score}m</span>
            </div>
            <div className="px-4 py-2 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 flex flex-col min-w-[70px]">
              <span className="text-[7px] font-black text-white/40 uppercase tracking-[0.2em] mb-0.5">Coins</span>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-xl font-serif font-black text-amber-500">{coins}</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <div className="px-4 py-2 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 flex flex-col items-end">
              <span className="text-[7px] font-black text-white/40 uppercase tracking-[0.2em] mb-0.5">Trail Level</span>
              <span className="text-xl font-serif font-black text-amber-500">{level}</span>
            </div>
            {gameState === 'playing' && (
              <div className="w-32 space-y-1">
                 <p className="text-[7px] uppercase font-black tracking-widest text-white/40 text-right">Spear Ready</p>
                 <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-amber-500"
                      initial={{ width: '0%' }}
                      animate={{ width: `${Math.min(100, (Date.now() - lastSpearTime) / ((selectedChar.baseSpearCooldown || 1000) / upgrades.spearSpeed) * 100)}%` }}
                      transition={{ duration: 0.1 }}
                    />
                 </div>
              </div>
            )}
          </div>
        </div>

        <button 
          onClick={toggleFullScreen}
          className="absolute bottom-6 right-6 p-3 bg-white/5 hover:bg-white/10 backdrop-blur-md rounded-2xl text-white/40 hover:text-white transition-all opacity-0 group-hover:opacity-100 hidden md:block border border-white/5"
        >
          <Maximize2 size={18} />
        </button>

        {/* Mobile Controls */}
        {gameState === 'playing' && isTouchDevice && (
            <div className="absolute inset-0 md:hidden pointer-events-none flex flex-col justify-end p-6 gap-3">
              <div className="flex justify-between items-end pointer-events-auto">
                 <div className="flex gap-3">
                    <button 
                      className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-white active:scale-95"
                      onPointerDown={() => gameRef.current.keys['ArrowLeft'] = true}
                      onPointerUp={() => gameRef.current.keys['ArrowLeft'] = false}
                    >
                      ←
                    </button>
                    <button 
                      className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-white active:scale-95"
                      onPointerDown={() => gameRef.current.keys['ArrowRight'] = true}
                      onPointerUp={() => gameRef.current.keys['ArrowRight'] = false}
                    >
                      →
                    </button>
                 </div>
                 <div className="flex flex-col gap-3 items-end">
                    <button 
                       onClick={spear}
                       className="w-14 h-14 bg-amber-500/80 backdrop-blur-md rounded-full flex items-center justify-center text-white active:scale-95 shadow-xl"
                    >
                       <Zap size={20} />
                    </button>
                    <button 
                       onPointerDown={jump}
                       className="w-16 h-16 bg-white/40 backdrop-blur-md rounded-xl flex items-center justify-center text-white active:scale-95 shadow-2xl"
                    >
                       JUMP
                    </button>
                 </div>
              </div>
            </div>
          )}

          <AnimatePresence>
            {gameState === 'idle' && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center text-white p-6 text-center z-50 pointer-events-auto"
              >
                <motion.button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setGameState('selecting');
                  }}
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-24 h-24 bg-[#5A5A40] rounded-3xl flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(90,90,64,0.5)] border-4 border-white/20 group relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                  <Play size={40} fill="white" className="ml-1.5 relative z-10" />
                </motion.button>

                <h3 className="text-4xl font-serif font-black mb-2 tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60">
                  THE MAASAI RUNNER
                </h3>
                <p className="text-white/40 mb-2 max-w-sm text-[10px] font-bold uppercase tracking-[0.3em] leading-relaxed">
                  Ancestral Spirits are calling
                </p>
                <p className="text-white/20 mb-8 text-[8px] font-black uppercase tracking-[0.2em]">
                  {isTouchDevice ? 'Tap Screen to Control' : 'WASD / Arrows to Move'}
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setGameState('selecting');
                    }}
                    className="px-10 py-4 bg-white text-[#1a1a1a] rounded-2xl font-black text-[10px] uppercase tracking-[0.4em] hover:bg-gray-100 transition-all shadow-2xl active:scale-95 flex items-center gap-3"
                  >
                    START JOURNEY <ChevronRight size={14} />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setGameState('leaderboard');
                    }}
                    className="px-8 py-4 border-2 border-white/20 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.4em] hover:bg-white/5 transition-all active:scale-95 flex items-center gap-3"
                  >
                    LEGENDS <Trophy size={14} />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setGameState('shop');
                    }}
                    className="px-8 py-4 bg-amber-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.4em] hover:bg-amber-600 transition-all active:scale-95 flex items-center gap-3 shadow-lg shadow-amber-500/20"
                  >
                    ARMORY <Zap size={14} />
                  </button>
                </div>
              </motion.div>
            )}

            {gameState === 'shop' && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute inset-0 bg-white p-4 md:p-8 flex flex-col z-[60] overflow-hidden"
              >
                <div className="flex items-center justify-between mb-4 md:mb-8">
                  <div className="flex items-center gap-2 md:gap-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-amber-500 rounded-xl md:rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-500/30">
                      <Zap className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl md:text-2xl font-serif font-black text-gray-900 leading-tight">Tribal Armory</h3>
                      <p className="text-[7px] md:text-[9px] text-gray-400 font-black uppercase tracking-[0.2em]">Upgrade your warrior spirit</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 md:gap-3 bg-amber-50 px-3 md:px-4 py-1.5 md:py-2 rounded-xl border border-amber-100">
                    <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-amber-500" />
                    <span className="text-lg md:text-xl font-serif font-black text-amber-600">{coins}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 md:gap-4 flex-1 overflow-y-auto pr-1 md:pr-2 custom-scrollbar">
                  {[
                    { key: 'spearSpeed', label: 'Spear Reflexes', desc: 'Reload Speed', icon: Zap },
                    { key: 'jumpForce', label: 'Sky Leap', desc: 'Jump Force', icon: ChevronRight },
                    { key: 'shieldPower', label: 'Spirit Shield', desc: 'Duration', icon: Shield },
                    { key: 'coinValue', label: 'Wealth Aura', desc: 'Coin Value', icon: Star },
                  ].map((item) => {
                    const cost = Math.floor(upgrades[item.key as keyof Upgrades] * 50);
                    const canAfford = coins >= cost;
                    return (
                      <div key={item.key} className="p-3 md:p-6 rounded-2xl md:rounded-[2rem] border border-gray-100 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 md:gap-4 group">
                        <div className="flex items-center gap-2 md:gap-4">
                          <div className="w-8 h-8 md:w-12 md:h-12 bg-white rounded-lg md:rounded-2xl flex items-center justify-center text-[#5A5A40] shadow-sm group-hover:scale-110 transition-transform flex-shrink-0">
                            <item.icon className="w-4 h-4 md:w-5 md:h-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] md:text-sm font-black text-gray-900 uppercase tracking-tight truncate">{item.label}</p>
                            <p className="text-[7px] md:text-[9px] text-gray-400 font-bold uppercase tracking-widest leading-tight truncate">{item.desc}</p>
                            <p className="text-[7px] md:text-[8px] text-amber-600 font-black mt-0.5 md:mt-1">LVL: {upgrades[item.key as keyof Upgrades].toFixed(1)}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => buyUpgrade(item.key as keyof Upgrades)}
                          disabled={!canAfford}
                          className={`px-3 md:px-4 py-2 md:py-3 rounded-lg md:rounded-xl font-black text-[8px] md:text-[10px] uppercase tracking-widest transition-all ${
                            canAfford 
                            ? 'bg-[#5A5A40] text-white hover:bg-black shadow-lg shadow-black/10' 
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          {cost} C
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 md:mt-8 pt-4 md:pt-8 border-t border-gray-100 flex justify-center">
                  <button 
                    onClick={() => setGameState('idle')}
                    className="px-8 md:px-12 py-3 md:py-4 bg-gray-900 text-white rounded-xl md:rounded-2xl font-black text-[9px] md:text-[10px] uppercase tracking-[0.2em] md:tracking-[0.4em] hover:bg-black transition-all shadow-xl active:scale-95"
                  >
                    Done
                  </button>
                </div>
              </motion.div>
            )}

            {gameState === 'selecting' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute inset-0 bg-white p-4 md:p-8 flex flex-col items-center justify-center overflow-y-auto"
              >
                <div className="mb-4 md:mb-6 text-center">
                  <h3 className="text-xl md:text-2xl font-serif font-black text-gray-900 leading-none">Assemble Your Warrior</h3>
                  <p className="text-gray-400 text-[8px] md:text-[10px] mt-1 font-bold uppercase tracking-widest">Select your ancestral connection</p>
                </div>
                
                <div className="grid grid-cols-3 gap-2 md:gap-4 w-full max-w-3xl mb-4 md:mb-8">
                  {CHARACTERS.map(char => (
                    <button 
                      key={char.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedChar(char);
                        resetGame();
                      }}
                      className={`flex flex-col items-center p-3 md:p-6 rounded-2xl md:rounded-3xl transition-all border-2 ${
                        selectedChar.id === char.id 
                        ? 'border-[#5A5A40] bg-[#5A5A40]/5 shadow-xl -translate-y-1' 
                        : 'border-gray-50 bg-gray-50 hover:bg-gray-100 hover:border-gray-200'
                      }`}
                    >
                      <div className="w-8 h-8 md:w-12 md:h-12 rounded-full mb-2 md:mb-4 shadow-inner border-2 border-white" style={{ backgroundColor: char.color }} />
                      <span className="text-xs md:text-lg font-serif font-black text-gray-900 truncate w-full">{char.name}</span>
                      <div className="mt-2 md:mt-3 px-2 md:px-3 py-1 md:py-1.5 bg-white rounded-lg text-[6px] md:text-[8px] font-black uppercase tracking-widest text-[#5A5A40] shadow-sm truncate w-full">
                        {char.ability}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="flex gap-2 md:gap-3">
                  <button 
                    onClick={() => setGameState('idle')}
                    className="px-6 md:px-8 py-3 md:py-4 bg-gray-100 text-gray-400 rounded-xl font-black text-[8px] md:text-[9px] uppercase tracking-widest hover:bg-gray-200 transition-all"
                  >
                    Back
                  </button>
                  <button 
                    onClick={resetGame}
                    className="px-8 md:px-12 py-3 md:py-5 bg-[#5A5A40] text-white rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-[0.2em] md:tracking-[0.4em] hover:bg-[#4A4A30] transition-all shadow-xl flex items-center gap-2 md:gap-4 group relative overflow-hidden active:scale-95"
                  >
                    <div className="absolute inset-0 bg-white/10 -translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
                    <div className="w-6 h-6 md:w-8 md:h-8 bg-white text-[#5A5A40] rounded-lg flex items-center justify-center group-hover:rotate-12 transition-transform shadow-lg relative z-10">
                      <Play fill="currentColor" className="w-3 h-3 md:w-4 md:h-4 ml-0.5" />
                    </div>
                    <span className="relative z-10 font-black">START HUNT</span>
                  </button>
                </div>
              </motion.div>
            )}

            {gameState === 'gameover' && (
              <motion.div 
                initial={{ opacity: 0, scale: 1.1 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 bg-[#35100a] flex flex-col items-center justify-center text-white p-8 text-center"
              >
                <div className="w-16 h-16 bg-red-500/20 rounded-3xl flex items-center justify-center mb-6 border border-red-500/30">
                  <AlertCircle size={32} className="text-red-500" />
                </div>
                <h3 className="text-3xl font-serif font-black mb-3 tracking-tighter">SAFARI HALTED</h3>
                <div className="bg-black/20 p-6 rounded-3xl border border-white/5 mb-8 w-full max-w-xs">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40 mb-1">Final Distance</p>
                  <p className="text-4xl font-serif font-black text-white">{score}m</p>
                  {score >= highScore && score > 0 && (
                     <div className="mt-3 inline-block px-3 py-1 bg-amber-500 rounded-full text-[9px] font-black uppercase tracking-widest animate-bounce">
                        New Record! 🇰🇪
                     </div>
                  )}
                </div>
                
                <div className="flex gap-3">
                   <button 
                    onClick={() => setGameState('selecting')}
                    className="px-8 py-4 bg-white text-red-950 rounded-xl font-black text-[10px] uppercase tracking-[0.3em] hover:bg-gray-100 transition-all flex items-center gap-2 shadow-xl"
                  >
                    <RefreshCw size={16} />
                    New Trail
                  </button>
                  <button 
                    onClick={() => setGameState('leaderboard')}
                    className="px-8 py-4 bg-black/40 text-white border border-white/10 rounded-xl font-black text-[10px] uppercase tracking-[0.3em] hover:bg-black/60 transition-all"
                  >
                    Leaderboard
                  </button>
                </div>
              </motion.div>
            )}

            {gameState === 'leaderboard' && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 bg-white p-8 flex flex-col"
              >
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <Trophy className="text-[#5A5A40]" size={32} />
                    <div>
                      <h3 className="text-2xl font-serif font-black text-gray-900 leading-tight">Hall of Warriors</h3>
                      <p className="text-[9px] text-gray-400 font-black uppercase tracking-[0.2em]">Global Maasai Trail Records</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setGameState('idle')}
                    className="p-3 hover:bg-gray-100 rounded-full transition-all"
                  >
                    <X size={20} className="text-gray-400" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-3 space-y-3 scroll-mask">
                  {leaderboard.map((entry, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className={`flex items-center justify-between p-4 rounded-2xl border ${
                        entry.userId === auth.currentUser?.uid 
                        ? 'border-[#5A5A40] bg-[#5A5A40]/5 ring-4 ring-[#5A5A40]/5' 
                        : 'border-gray-50 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-6">
                        <span className={`text-xl font-serif font-black w-8 ${idx < 3 ? 'text-amber-500' : 'text-gray-300'}`}>
                          #{idx + 1}
                        </span>
                        <div>
                          <p className="text-lg font-serif font-black text-gray-900 leading-none mb-1">{entry.userName}</p>
                          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Level {entry.level}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-serif font-black text-[#5A5A40] leading-none mb-1">{entry.score}m</p>
                        <p className="text-[8px] font-black uppercase tracking-widest text-gray-300">Total Distance</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
}

const XIcon = ({ className, size }: { className?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
  </svg>
);
