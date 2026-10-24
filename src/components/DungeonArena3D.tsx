import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  Billboard,
  Html,
  OrbitControls,
  QuadraticBezierLine,
  Sparkles,
  Stars,
  Text,
  useTexture,
} from '@react-three/drei';
import * as THREE from 'three';
import { Chess, Square } from 'chess.js';
import {
  DungeonLevelConfig,
  FamilyHeroConfig,
  PieceRole,
  SpecialThemeType,
} from '../data/familyConfig';
import { FamilyHeroPiece3D } from './FamilyHeroPiece3D';

export type CameraPreset = 'orbit' | 'top' | 'table-white' | 'table-black';

export interface ActiveCaptureEffect {
  id: string;
  square: Square;
  attackerName: string;
  attackerRole: PieceRole;
  attackerColor: 'w' | 'b';
  defenderName: string;
  defenderRole: PieceRole;
  defenderSprite: string;
  attackerSprite: string;
  quote: string;
  accentColor: string;
}

export interface FloatingEmojiReaction {
  id: string;
  emoji: string;
  sender: string;
}

interface DungeonArena3DProps {
  game: Chess;
  fen: string;
  level: DungeonLevelConfig;
  heroes: Record<PieceRole, FamilyHeroConfig>;
  selectedSquare: Square | null;
  legalMoves: { to: Square; isCapture: boolean }[];
  lastMove: { from: Square; to: Square } | null;
  hintMove: { from: Square; to: Square } | null;
  shieldedSquares: string[];
  frozenSquares: string[];
  treasureSquares?: string[];
  obstacleSquares?: string[];
  promotedSquare?: Square | null;
  winningTeamColor?: 'w' | 'b' | null;
  capturedByGold?: PieceRole[];
  capturedByPurple?: PieceRole[];
  kidMode: boolean;
  showAllNames: boolean;
  cameraPreset: CameraPreset;
  captureEffect: ActiveCaptureEffect | null;
  onSquareClick: (sq: Square) => void;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

// Ancient Dungeon Rune Glyphs matching the Pitch Concept Art!
const RUNE_GLYPHS = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ', 'ᛉ', 'ᛋ', 'ᛏ', 'ᛒ', 'ᛖ', 'ᛗ', 'ᛚ', 'ᛞ'];

// Procedural Radial Glow Texture for Additive Bloom Halos around Runes, Lanterns & Mana Crystals
let cachedGlowHaloTex: THREE.CanvasTexture | null = null;
function getGlowHaloTexture(): THREE.CanvasTexture {
  if (cachedGlowHaloTex) return cachedGlowHaloTex;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.55)');
  grad.addColorStop(0.7, 'rgba(255, 255, 255, 0.14)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  cachedGlowHaloTex = tex;
  return tex;
}

// Procedural 3D Carved Stone Flagstone Texture (with cracks, bevels & weathered stone grain)
let cachedCarvedStoneTex: THREE.CanvasTexture | null = null;
function getCarvedStoneTexture(): THREE.CanvasTexture {
  if (cachedCarvedStoneTex) return cachedCarvedStoneTex;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Base stone gradient
  const grad = ctx.createRadialGradient(128, 128, 20, 128, 128, 165);
  grad.addColorStop(0, '#f5f5f4');
  grad.addColorStop(0.75, '#d6d3d1');
  grad.addColorStop(1, '#78716c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // Chiseled outer bevel frame
  ctx.strokeStyle = 'rgba(28, 25, 23, 0.75)';
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, 242, 242);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = 4;
  ctx.strokeRect(16, 16, 224, 224);

  // Inner carved rune border groove
  ctx.strokeStyle = 'rgba(41, 37, 36, 0.45)';
  ctx.lineWidth = 3;
  ctx.strokeRect(32, 32, 192, 192);

  // Weathering stone cracks
  ctx.strokeStyle = 'rgba(28, 25, 23, 0.55)';
  ctx.lineWidth = 2.5;
  const cracks = [
    [
      [18, 45],
      [52, 68],
      [78, 62],
    ],
    [
      [230, 180],
      [195, 165],
      [172, 190],
    ],
    [
      [60, 235],
      [85, 205],
      [110, 215],
    ],
    [
      [190, 22],
      [168, 55],
    ],
  ];
  cracks.forEach((path) => {
    ctx.beginPath();
    ctx.moveTo(path[0][0], path[0][1]);
    for (let i = 1; i < path.length; i++) {
      ctx.lineTo(path[i][0], path[i][1]);
    }
    ctx.stroke();
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  cachedCarvedStoneTex = tex;
  return tex;
}

export function squareToWorld(sq: Square | string): [number, number, number] {
  const fileIndex = FILES.indexOf(sq[0]);
  const rankIndex = RANKS.indexOf(sq[1]);
  return [fileIndex - 3.5, 0, rankIndex - 3.5];
}

const TorchPillar: React.FC<{
  position: [number, number, number];
  pillarColor: string;
  flameColor: string;
  specialTheme?: SpecialThemeType;
}> = ({ position, pillarColor, flameColor, specialTheme = 'default' }) => {
  const flameRef = useRef<THREE.Mesh>(null);
  const lanternRef = useRef<THREE.Group>(null);
  const pumpkinRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime + position[0] * 1.3;
    if (flameRef.current) {
      const s = 1 + Math.sin(t * 9) * 0.14 + Math.cos(t * 15) * 0.08;
      flameRef.current.scale.set(s, s * 1.25, s);
    }
    if (lanternRef.current) {
      lanternRef.current.rotation.y += delta * 0.8;
      lanternRef.current.position.y = 2.45 + Math.sin(t * 2.5) * 0.08;
    }
    if (pumpkinRef.current) {
      const bounce = 1 + Math.sin(t * 4) * 0.05;
      pumpkinRef.current.scale.set(bounce, bounce, bounce);
      pumpkinRef.current.rotation.y = Math.sin(t * 1.5) * 0.25;
    }
    if (lightRef.current) {
      lightRef.current.intensity = 2.1 + Math.sin(t * 11) * 0.35;
    }
  });

  return (
    <group position={position}>
      <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.38, 0.48, 2.2, 8]} />
        <meshStandardMaterial
          color={pillarColor}
          roughness={0.85}
          metalness={0.15}
        />
      </mesh>
      <mesh position={[0, 2.08, 0]} castShadow>
        <cylinderGeometry args={[0.45, 0.25, 0.24, 8]} />
        <meshStandardMaterial
          color={specialTheme === 'ramadan' ? '#d97706' : '#27272a'}
          roughness={0.35}
          metalness={0.85}
        />
      </mesh>

      {specialTheme === 'ramadan' ? (
        /* Golden 3D Ramadan Fanous Lantern */
        <group ref={lanternRef} position={[0, 2.45, 0]}>
          {/* Warm Glowing Glass Core */}
          <mesh>
            <cylinderGeometry args={[0.22, 0.16, 0.48, 6]} />
            <meshStandardMaterial
              color="#fef08a"
              emissive="#fbbf24"
              emissiveIntensity={1.2}
              transparent
              opacity={0.9}
            />
          </mesh>
          {/* Ornate Gold Cage Frame */}
          <mesh>
            <cylinderGeometry args={[0.25, 0.18, 0.5, 6]} />
            <meshStandardMaterial
              color="#f59e0b"
              metalness={0.9}
              roughness={0.2}
              wireframe
            />
          </mesh>
          {/* Lantern Dome Roof */}
          <mesh position={[0, 0.32, 0]}>
            <coneGeometry args={[0.28, 0.24, 6]} />
            <meshStandardMaterial
              color="#d97706"
              metalness={0.85}
              roughness={0.2}
            />
          </mesh>
          {/* Little Crescent Finial on Top */}
          <mesh position={[0, 0.48, 0]}>
            <torusGeometry args={[0.07, 0.02, 8, 16, Math.PI * 1.4]} />
            <meshBasicMaterial color="#fde047" />
          </mesh>
        </group>
      ) : specialTheme === 'halloween' ? (
        /* Glowing 3D Halloween Jack-o'-Lantern Pumpkin */
        <group ref={pumpkinRef} position={[0, 2.42, 0]}>
          {/* Pumpkin Ribbed Body */}
          <mesh castShadow scale={[1, 0.82, 1]}>
            <sphereGeometry args={[0.38, 12, 10]} />
            <meshStandardMaterial
              color="#ea580c"
              emissive="#f97316"
              emissiveIntensity={0.45}
              roughness={0.5}
            />
          </mesh>
          {/* Green Pumpkin Stem */}
          <mesh position={[0, 0.34, 0]} rotation={[0, 0, 0.2]}>
            <cylinderGeometry args={[0.04, 0.07, 0.18, 6]} />
            <meshStandardMaterial color="#15803d" roughness={0.6} />
          </mesh>
          {/* Glowing Carved Eyes & Smile */}
          <mesh position={[-0.12, 0.06, 0.33]}>
            <coneGeometry args={[0.07, 0.12, 3]} />
            <meshBasicMaterial color="#fef08a" />
          </mesh>
          <mesh position={[0.12, 0.06, 0.33]}>
            <coneGeometry args={[0.07, 0.12, 3]} />
            <meshBasicMaterial color="#fef08a" />
          </mesh>
          <mesh position={[0, -0.09, 0.34]} rotation={[Math.PI, 0, 0]}>
            <torusGeometry args={[0.12, 0.035, 6, 12, Math.PI]} />
            <meshBasicMaterial color="#fde047" />
          </mesh>
        </group>
      ) : (
        /* Default Dungeon Torch Flame */
        <mesh ref={flameRef} position={[0, 2.38, 0]}>
          <dodecahedronGeometry args={[0.24, 1]} />
          <meshBasicMaterial color={flameColor} />
        </mesh>
      )}

      <pointLight
        ref={lightRef}
        position={[0, 2.6, 0]}
        color={flameColor}
        intensity={2.0}
        distance={11}
        decay={2}
      />
    </group>
  );
};

// Special 3D Sky & Arena Decorations for Ramadan (Crescent Moon + Hanging Fanous) & Halloween (Floating Ghosts + Giant Pumpkin Moon)
const SpecialThemeSky3D: React.FC<{ specialTheme?: SpecialThemeType }> = ({
  specialTheme,
}) => {
  const moonGroupRef = useRef<THREE.Group>(null);
  const ghostsGroupRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (moonGroupRef.current) {
      moonGroupRef.current.rotation.y =
        Math.sin(state.clock.elapsedTime * 0.6) * 0.2;
      moonGroupRef.current.position.y =
        4.6 + Math.sin(state.clock.elapsedTime * 1.5) * 0.15;
    }
    if (ghostsGroupRef.current) {
      ghostsGroupRef.current.rotation.y += delta * 0.45;
    }
  });

  if (specialTheme === 'ramadan') {
    return (
      <group>
        {/* Giant Glowing 3D Golden Crescent Moon & Star behind the board */}
        <group ref={moonGroupRef} position={[0, 4.6, -6.2]}>
          <mesh rotation={[0, 0, Math.PI * 0.15]}>
            <torusGeometry args={[1.35, 0.24, 16, 48, Math.PI * 1.35]} />
            <meshStandardMaterial
              color="#fde047"
              emissive="#f59e0b"
              emissiveIntensity={0.95}
              metalness={0.85}
              roughness={0.15}
            />
          </mesh>
          {/* 3D Star inside the Crescent */}
          <mesh position={[0.55, 0.35, 0]}>
            <octahedronGeometry args={[0.34, 0]} />
            <meshStandardMaterial
              color="#fef08a"
              emissive="#fbbf24"
              emissiveIntensity={1.1}
            />
          </mesh>
          <Html position={[0, -1.75, 0]} center zIndexRange={[5, 0]}>
            <div className="pointer-events-none px-3 py-1 rounded-full bg-emerald-950/90 border border-amber-400 text-amber-200 text-xs font-extrabold shadow-lg whitespace-nowrap">
              🌙 Ramadan Mubarak • Familien-Schachabend ✨
            </div>
          </Html>
        </group>
      </group>
    );
  }

  if (specialTheme === 'halloween') {
    return (
      <group>
        {/* Orbiting Friendly 3D Halloween Ghosts & Spooky Banner */}
        <group ref={ghostsGroupRef} position={[0, 2.2, 0]}>
          {[0, 1, 2, 3].map((i) => {
            const angle = (i * Math.PI) / 2;
            const radius = 5.6;
            return (
              <group
                key={i}
                position={[
                  Math.cos(angle) * radius,
                  Math.sin(i * 2) * 0.4,
                  Math.sin(angle) * radius,
                ]}
              >
                {/* Ghost Head & Cloak */}
                <mesh position={[0, 0.25, 0]}>
                  <sphereGeometry args={[0.26, 12, 12]} />
                  <meshStandardMaterial
                    color="#f8fafc"
                    emissive="#c084fc"
                    emissiveIntensity={0.35}
                    transparent
                    opacity={0.82}
                  />
                </mesh>
                <mesh position={[0, -0.05, 0]}>
                  <coneGeometry args={[0.28, 0.45, 10, 1, true]} />
                  <meshStandardMaterial
                    color="#f8fafc"
                    emissive="#a855f7"
                    emissiveIntensity={0.35}
                    transparent
                    opacity={0.75}
                    side={THREE.DoubleSide}
                  />
                </mesh>
              </group>
            );
          })}
        </group>

        {/* Giant Harvest Moon behind the board */}
        <group ref={moonGroupRef} position={[0, 4.6, -6.4]}>
          <mesh>
            <sphereGeometry args={[1.25, 24, 24]} />
            <meshStandardMaterial
              color="#fb923c"
              emissive="#ea580c"
              emissiveIntensity={0.85}
            />
          </mesh>
          <Html position={[0, -1.65, 0]} center zIndexRange={[5, 0]}>
            <div className="pointer-events-none px-3 py-1 rounded-full bg-purple-950/90 border border-orange-400 text-orange-200 text-xs font-extrabold shadow-lg whitespace-nowrap">
              🎃 Happy Halloween • Grusel-Schloss-Turnier 👻
            </div>
          </Html>
        </group>
      </group>
    );
  }

  return null;
};

// Golden 3D Treasure Chest for Princess Mini's Treasure Hunt Mode
const TreasureChest3D: React.FC<{
  square: string;
  onClick: () => void;
}> = ({ square, onClick }) => {
  const chestRef = useRef<THREE.Group>(null);
  const pos = useMemo(() => squareToWorld(square), [square]);

  useFrame((state, delta) => {
    if (chestRef.current) {
      chestRef.current.rotation.y += delta * 1.4;
      chestRef.current.position.y =
        0.28 + Math.sin(state.clock.elapsedTime * 3.5 + pos[0]) * 0.08;
    }
  });

  return (
    <group
      position={[pos[0], 0, pos[2]]}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <group ref={chestRef}>
        {/* Chest Body */}
        <mesh castShadow>
          <boxGeometry args={[0.48, 0.32, 0.36]} />
          <meshStandardMaterial
            color="#92400e"
            roughness={0.4}
            metalness={0.3}
          />
        </mesh>
        {/* Golden Lid & Trim */}
        <mesh position={[0, 0.18, 0]} castShadow>
          <cylinderGeometry
            args={[0.18, 0.18, 0.48, 12, 1, false, 0, Math.PI]}
          />
          <meshStandardMaterial
            color="#fbbf24"
            roughness={0.2}
            metalness={0.9}
            emissive="#f59e0b"
            emissiveIntensity={0.45}
          />
        </mesh>
      </group>
      <Sparkles count={18} scale={1.1} size={4} speed={1.5} color="#fde047" />
      <Html position={[0, 0.85, 0]} center zIndexRange={[15, 0]}>
        <div className="pointer-events-none px-2 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-extrabold shadow-md whitespace-nowrap">
          🎁 Schatztruhe
        </div>
      </Html>
    </group>
  );
};

// Lava / Sleeping Gargoyle Obstacle Block for Treasure Hunt Mode
const LavaObstacle3D: React.FC<{ square: string }> = ({ square }) => {
  const pos = useMemo(() => squareToWorld(square), [square]);
  const crystalRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (crystalRef.current) {
      const s = 1 + Math.sin(state.clock.elapsedTime * 4 + pos[2]) * 0.06;
      crystalRef.current.scale.set(s, s, s);
    }
  });

  return (
    <group position={[pos[0], 0.25, pos[2]]}>
      <mesh ref={crystalRef} castShadow>
        <dodecahedronGeometry args={[0.32, 0]} />
        <meshStandardMaterial
          color="#dc2626"
          emissive="#ef4444"
          emissiveIntensity={0.55}
          roughness={0.3}
        />
      </mesh>
      <Html position={[0, 0.55, 0]} center zIndexRange={[10, 0]}>
        <div className="pointer-events-none px-1.5 py-0.5 rounded bg-red-950/90 text-red-200 border border-red-500/50 text-[9px] font-bold">
          🔥 Hindernis
        </div>
      </Html>
    </group>
  );
};

// Battle-Chess 3D Clash Duel Effect + Ascending 3D Parachute Retreat + Speech Bubble
const BattleChessClash3D: React.FC<{ effect: ActiveCaptureEffect }> = ({
  effect,
}) => {
  const ringRef = useRef<THREE.Mesh>(null);
  const beamRef = useRef<THREE.Mesh>(null);
  const parachuteGroupRef = useRef<THREE.Group>(null);
  const slashSwordRef = useRef<THREE.Group>(null);
  const pos = useMemo(() => squareToWorld(effect.square), [effect.square]);

  // Role-specific 3D weapon / magic projectile
  const isMagicAttacker =
    effect.attackerRole === 'q' || effect.attackerRole === 'b';

  useFrame((state, delta) => {
    if (ringRef.current) {
      ringRef.current.scale.x += delta * 5.2;
      ringRef.current.scale.y += delta * 5.2;
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, mat.opacity - delta * 0.75);
    }
    if (beamRef.current) {
      beamRef.current.rotation.y += delta * 6;
      const mat = beamRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, mat.opacity - delta * 0.45);
    }
    // 3D Parachute gently floating upward into the sky and swaying
    if (parachuteGroupRef.current) {
      parachuteGroupRef.current.position.y += delta * 1.15;
      parachuteGroupRef.current.rotation.z =
        Math.sin(state.clock.elapsedTime * 5) * 0.18;
      parachuteGroupRef.current.rotation.y += delta * 1.2;
    }
    // 3D Sword / Arcane Slash swing animation
    if (slashSwordRef.current) {
      slashSwordRef.current.rotation.z += delta * 9.5;
      slashSwordRef.current.rotation.y += delta * 4.5;
    }
  });

  return (
    <group position={[pos[0], 0.15, pos[2]]}>
      {/* Shockwave Ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.25, 0.52, 32]} />
        <meshBasicMaterial
          color={effect.accentColor}
          transparent
          opacity={0.95}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Vertical Arcane / Sword Slash Pillar */}
      <mesh ref={beamRef} position={[0, 1.1, 0]}>
        <cylinderGeometry
          args={[isMagicAttacker ? 0.35 : 0.08, 0.45, 2.4, 12, 1, true]}
        />
        <meshBasicMaterial
          color={effect.accentColor}
          transparent
          opacity={0.75}
          side={THREE.DoubleSide}
          wireframe={!isMagicAttacker}
        />
      </mesh>

      {/* 3D Spinning Sword / Magic Energy Slash Ring */}
      <group ref={slashSwordRef} position={[0, 0.75, 0]}>
        <mesh rotation={[Math.PI / 3, 0, 0]}>
          <torusGeometry args={[0.62, 0.045, 12, 32, Math.PI * 1.3]} />
          <meshBasicMaterial color="#fde047" />
        </mesh>
      </group>

      {/* 3D Ascending Parachute Carrying the Captured Piece Gently Away */}
      <group ref={parachuteGroupRef} position={[0, 0.55, 0]}>
        {/* Golden/Purple Parachute Canopy Dome */}
        <mesh position={[0, 0.65, 0]} castShadow>
          <sphereGeometry
            args={[0.42, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]}
          />
          <meshStandardMaterial
            color="#f59e0b"
            emissive="#d97706"
            emissiveIntensity={0.35}
            side={THREE.DoubleSide}
            roughness={0.3}
          />
        </mesh>
        {/* Parachute Suspension Lines */}
        {[-0.25, 0.25].map((rx, i) => (
          <mesh
            key={i}
            position={[rx * 0.6, 0.35, 0]}
            rotation={[0, 0, rx * 0.5]}
          >
            <cylinderGeometry args={[0.008, 0.008, 0.55, 6]} />
            <meshBasicMaterial color="#fef3c7" />
          </mesh>
        ))}
        {/* Little Hero Basket / Pedestal under the Parachute */}
        <mesh position={[0, 0.08, 0]}>
          <cylinderGeometry args={[0.18, 0.22, 0.14, 10]} />
          <meshStandardMaterial color="#78350f" metalness={0.4} roughness={0.5} />
        </mesh>
      </group>

      <Sparkles
        count={60}
        scale={2.8}
        size={7}
        speed={3.2}
        color={effect.accentColor}
      />

      {/* Battle-Chess Mini-Duel Card & Parachute Retreat Animation */}
      <Html position={[0, 2.55, 0]} center zIndexRange={[40, 0]}>
        <div className="pointer-events-none flex flex-col items-center gap-1.5 animate-bounce">
          {/* VS Clash Banner */}
          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-amber-950/95 via-slate-900/95 to-purple-950/95 border-2 border-amber-400 shadow-[0_0_35px_rgba(251,191,36,0.75)]">
            <img
              src={effect.attackerSprite}
              alt={effect.attackerName}
              className="w-12 h-12 rounded-xl object-cover border-2 border-amber-400 shadow-md"
            />
            <div className="text-center px-1">
              <div className="text-[10px] font-black uppercase tracking-widest text-amber-300">
                ⚔️ BATTLE DUEL ⚔️
              </div>
              <div className="text-xs sm:text-sm font-extrabold text-white whitespace-nowrap">
                {effect.attackerName}{' '}
                <span className="text-amber-400">⚡</span> {effect.defenderName}
              </div>
              <div className="text-[11px] font-bold text-amber-200 mt-0.5 max-w-[220px] truncate">
                „{effect.quote}“
              </div>
            </div>
            <div className="relative">
              <img
                src={effect.defenderSprite}
                alt={effect.defenderName}
                className="w-10 h-10 rounded-xl object-cover border border-purple-400 opacity-75 -rotate-12"
              />
              <span
                className="absolute -top-3 -right-1 text-base"
                title="Wird sanft per Fallschirm auf die Bank gebeamt!"
              >
                🪂
              </span>
            </div>
          </div>
        </div>
      </Html>
    </group>
  );
};

// Thick Chiseled Dungeon Stone Slab Tile with Glowing Carved Runes (Matches Concept Art!)
const DungeonStoneTile3D: React.FC<{
  sq: Square;
  rIdx: number;
  cIdx: number;
  tileX: number;
  tileZ: number;
  tileColor: string;
  isLight: boolean;
  isSelected: boolean;
  isLastMoveTo: boolean;
  isLegalTarget: boolean;
  isCaptureTarget: boolean;
  emissiveColor: string;
  emissiveIntensity: number;
  kidMode: boolean;
  runeGlowColor: string;
  onSquareClick: (sq: Square) => void;
}> = ({
  sq,
  rIdx,
  cIdx,
  tileX,
  tileZ,
  tileColor,
  isLight,
  isSelected,
  isLastMoveTo,
  isLegalTarget,
  isCaptureTarget,
  emissiveColor,
  emissiveIntensity,
  kidMode,
  runeGlowColor,
  onSquareClick,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const pressDepth = useRef(0);
  const stoneTex = useMemo(() => getCarvedStoneTexture(), []);
  const glowTex = useMemo(() => getGlowHaloTexture(), []);

  // Deterministic height micro-variation so the 64 flagstones look hand-laid
  const slabHeightOffset = useMemo(
    () => (((rIdx * 7 + cIdx * 13) % 5) - 2) * 0.008,
    [rIdx, cIdx]
  );

  // Art-Director 70/30 Rule: Selective Glowing Power Runes so the board stays readable & magical!
  const runeInfo = useMemo(() => {
    const hash = rIdx * 8 + cIdx;
    const glyph = RUNE_GLYPHS[hash % RUNE_GLYPHS.length];
    const isCyanRune = (rIdx + cIdx) % 2 === 0;
    const isCenterSanctum =
      (rIdx === 3 || rIdx === 4) && (cIdx === 3 || cIdx === 4);
    const isFrontOrBackEdgeRune =
      (rIdx === 5 || rIdx === 2) && (cIdx === 1 || cIdx === 4 || cIdx === 6);
    const isFrontBorderShowcase =
      rIdx === 7 && (cIdx === 0 || cIdx === 2 || cIdx === 5 || cIdx === 7);
    const showRune =
      isCenterSanctum || isFrontOrBackEdgeRune || isFrontBorderShowcase;
    return {
      glyph,
      color: isCyanRune ? '#38bdf8' : '#fb923c',
      showRune,
    };
  }, [rIdx, cIdx]);

  useEffect(() => {
    if (isLastMoveTo || isSelected) {
      pressDepth.current = 1;
    }
  }, [isLastMoveTo, isSelected]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (pressDepth.current > 0) {
      pressDepth.current = Math.max(0, pressDepth.current - delta * 2.5);
    }
    const yOffset =
      slabHeightOffset - Math.sin(pressDepth.current * Math.PI) * 0.075;
    groupRef.current.position.y = yOffset;
  });

  const activeRuneColor = isCaptureTarget
    ? '#ef4444'
    : isLegalTarget
    ? '#34d399'
    : isSelected
    ? '#fde047'
    : runeInfo.color;

  return (
    <group position={[tileX, 0, tileZ]}>
      <group ref={groupRef}>
        {/* Deep Stone Block Base (gives thick dark shadow joints between tiles) */}
        <mesh
          position={[0, -0.09, 0]}
          receiveShadow
          castShadow
          onClick={(e) => {
            e.stopPropagation();
            onSquareClick(sq);
          }}
        >
          <boxGeometry args={[0.92, 0.24, 0.92]} />
          <meshStandardMaterial
            map={stoneTex}
            color={tileColor}
            roughness={isLight ? 0.72 : 0.86}
            metalness={0.15}
            emissive={emissiveColor}
            emissiveIntensity={emissiveIntensity}
          />
        </mesh>

        {/* Chiseled Bevel Top Cap of the Flagstone */}
        <mesh
          position={[0, 0.04, 0]}
          receiveShadow
          onClick={(e) => {
            e.stopPropagation();
            onSquareClick(sq);
          }}
        >
          <boxGeometry args={[0.86, 0.04, 0.86]} />
          <meshStandardMaterial
            map={stoneTex}
            color={tileColor}
            roughness={isLight ? 0.62 : 0.78}
            metalness={0.18}
            emissive={emissiveColor}
            emissiveIntensity={emissiveIntensity * 1.15}
          />
        </mesh>

        {/* Soft Additive Bloom Halo + Glowing Carved Rune Glyph on Power Slabs */}
        {(runeInfo.showRune || isSelected || isLastMoveTo || isLegalTarget) && (
          <>
            <mesh position={[0, 0.062, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.76, 0.76]} />
              <meshBasicMaterial
                map={glowTex}
                color={activeRuneColor}
                transparent
                opacity={
                  isSelected || isLegalTarget || isLastMoveTo ? 0.65 : 0.38
                }
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
            <Text
              position={[0, 0.066, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={isSelected || isLegalTarget ? 0.44 : 0.38}
              color={activeRuneColor}
              fillOpacity={
                isSelected || isLegalTarget || isLastMoveTo ? 0.98 : 0.88
              }
              anchorX="center"
              anchorY="middle"
            >
              {runeInfo.glyph}
            </Text>
          </>
        )}

        {/* Outer Stepped Cliff Edge Inscriptions along the Front Border of the Board (Just like the Concept Art!) */}
        {rIdx === 7 && (
          <Text
            position={[0, -0.06, 0.468]}
            fontSize={0.125}
            color="#38bdf8"
            anchorX="center"
            anchorY="middle"
          >
            {`${RUNE_GLYPHS[(cIdx * 3) % RUNE_GLYPHS.length]} ${FILES[
              cIdx
            ].toUpperCase()} ${
              RUNE_GLYPHS[(cIdx * 3 + 1) % RUNE_GLYPHS.length]
            }`}
          </Text>
        )}
      </group>

      {/* Glowing Dungeon Rune Indicator for Legal Moves */}
      {isLegalTarget && (
        <group
          position={[0, 0.08, 0]}
          onClick={(e) => {
            e.stopPropagation();
            onSquareClick(sq);
          }}
        >
          {isCaptureTarget ? (
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.33, 0.44, 24]} />
              <meshBasicMaterial
                color="#ef4444"
                side={THREE.DoubleSide}
                transparent
                opacity={0.92}
              />
            </mesh>
          ) : (
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.22, 0.32, 20]} />
              <meshBasicMaterial
                color={kidMode ? '#34d399' : runeGlowColor}
                side={THREE.DoubleSide}
                transparent
                opacity={0.9}
              />
            </mesh>
          )}
        </group>
      )}
    </group>
  );
};

// Atmospheric Dungeon Props around the Board (Warm Metal Lanterns on the Stone Ledge + Floating Blue Mana Crystals + Volumetric Dungeon Mist)
const DungeonBoardProps3D: React.FC<{ runeColor: string }> = ({
  runeColor,
}) => {
  const crystalsRef = useRef<THREE.Group>(null);
  const mistRef = useRef<THREE.Group>(null);
  const glowTex = useMemo(() => getGlowHaloTexture(), []);

  useFrame((state, delta) => {
    if (crystalsRef.current) {
      crystalsRef.current.children.forEach((child, idx) => {
        child.position.y =
          1.35 + Math.sin(state.clock.elapsedTime * 2.2 + idx * 1.7) * 0.18;
        child.rotation.y += delta * 1.1;
      });
    }
    if (mistRef.current) {
      mistRef.current.children.forEach((cloud, idx) => {
        cloud.rotation.z =
          Math.sin(state.clock.elapsedTime * 0.25 + idx) * 0.35;
      });
    }
  });

  const lanternPositions: [number, number, number][] = [
    [-4.35, 0.05, 1.8],
    [4.35, 0.05, 1.8],
    [-4.35, 0.05, -1.8],
    [4.35, 0.05, -1.8],
  ];

  const crystalPositions: [number, number, number][] = [
    [-4.65, 1.35, -3.4],
    [4.65, 1.35, -3.4],
    [-4.65, 1.35, 3.4],
    [4.65, 1.35, 3.4],
  ];

  const mistPositions: [number, number, number][] = [
    [-5.4, -0.32, 3.8],
    [5.4, -0.32, 3.8],
    [-5.4, -0.32, -3.8],
    [5.4, -0.32, -3.8],
    [0, -0.35, 5.4],
    [0, -0.35, -5.4],
  ];

  return (
    <group>
      {/* Cool Blue-Slate Volumetric Dungeon Mist Clouds around the Stepped Altar */}
      <group ref={mistRef}>
        {mistPositions.map((mPos, idx) => (
          <mesh
            key={`mist-${idx}`}
            position={mPos}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[5.5, 5.5]} />
            <meshBasicMaterial
              map={glowTex}
              color="#38bdf8"
              transparent
              opacity={0.14}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>

      {/* 4 Warm Glowing Dungeon Table Lanterns sitting on the outer stone ledge */}
      {lanternPositions.map((pos, idx) => (
        <group key={`lantern-${idx}`} position={pos}>
          {/* Lantern Base */}
          <mesh position={[0, 0.06, 0]} castShadow>
            <boxGeometry args={[0.32, 0.08, 0.32]} />
            <meshStandardMaterial
              color="#292524"
              roughness={0.5}
              metalness={0.7}
            />
          </mesh>
          {/* Glowing Warm Glass Core */}
          <mesh position={[0, 0.26, 0]}>
            <boxGeometry args={[0.22, 0.32, 0.22]} />
            <meshStandardMaterial
              color="#fef08a"
              emissive="#f59e0b"
              emissiveIntensity={1.6}
            />
          </mesh>
          {/* Warm Additive Bloom Halo around the Lantern */}
          <Billboard position={[0, 0.28, 0]}>
            <mesh>
              <planeGeometry args={[1.1, 1.1]} />
              <meshBasicMaterial
                map={glowTex}
                color="#fb923c"
                transparent
                opacity={0.55}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
          </Billboard>
          {/* Iron Cage Bars */}
          <mesh position={[0, 0.26, 0]}>
            <boxGeometry args={[0.25, 0.34, 0.25]} />
            <meshStandardMaterial
              color="#1c1917"
              wireframe
              metalness={0.8}
              roughness={0.3}
            />
          </mesh>
          {/* Pyramid Roof */}
          <mesh position={[0, 0.49, 0]} rotation={[0, Math.PI / 4, 0]}>
            <coneGeometry args={[0.26, 0.16, 4]} />
            <meshStandardMaterial
              color="#292524"
              roughness={0.4}
              metalness={0.75}
            />
          </mesh>
          <pointLight
            position={[0, 0.3, 0]}
            color="#ff9500"
            intensity={1.25}
            distance={4.8}
          />
        </group>
      ))}

      {/* 4 Floating Glowing Blue Mana Crystals with Additive Cyan Bloom Halo */}
      <group ref={crystalsRef}>
        {crystalPositions.map((pos, idx) => (
          <group key={`mana-crystal-${idx}`} position={pos}>
            <mesh scale={[0.24, 0.46, 0.24]}>
              <octahedronGeometry args={[1, 0]} />
              <meshStandardMaterial
                color="#38bdf8"
                emissive="#0284c7"
                emissiveIntensity={1.35}
                roughness={0.1}
                metalness={0.6}
                transparent
                opacity={0.92}
              />
            </mesh>
            <Billboard position={[0, 0, 0]}>
              <mesh>
                <planeGeometry args={[1.25, 1.25]} />
                <meshBasicMaterial
                  map={glowTex}
                  color="#38bdf8"
                  transparent
                  opacity={0.5}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>
            </Billboard>
            {/* Orbiting Mana Halo Ring */}
            <mesh rotation={[Math.PI / 2.4, 0.3, 0]}>
              <ringGeometry args={[0.32, 0.36, 20]} />
              <meshBasicMaterial
                color={runeColor || '#38bdf8'}
                side={THREE.DoubleSide}
                transparent
                opacity={0.7}
              />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
};

// 3D Spectator Bench Miniature along the Left & Right Stone Sidelines for Captured Pieces
const SpectatorMiniHero3D: React.FC<{
  role: PieceRole;
  color: 'w' | 'b';
  position: [number, number, number];
  heroConfig: FamilyHeroConfig;
}> = ({ color, position, heroConfig }) => {
  const groupRef = useRef<THREE.Group>(null);
  const pngPath = useMemo(
    () => heroConfig.spritePath.replace('.jpg', '.png'),
    [heroConfig.spritePath]
  );
  const texture = useTexture(pngPath);
  texture.colorSpace = THREE.SRGBColorSpace;
  const isGold = color === 'w';

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.position.y =
        position[1] +
        Math.abs(
          Math.sin(state.clock.elapsedTime * 3.5 + position[2] * 1.7)
        ) *
          0.08;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Small Stone Seat Block */}
      <mesh position={[0, 0.06, 0]} castShadow>
        <dodecahedronGeometry args={[0.2, 0]} />
        <meshStandardMaterial
          color={isGold ? '#786b5d' : '#4a3e5e'}
          roughness={0.9}
          flatShading
        />
      </mesh>
      <Billboard position={[0, 0.42, 0]}>
        <mesh>
          <planeGeometry args={[0.62, 0.68]} />
          <meshStandardMaterial
            map={texture}
            transparent
            alphaTest={0.1}
            roughness={0.4}
          />
        </mesh>
      </Billboard>
    </group>
  );
};

const CameraDirector: React.FC<{
  preset: CameraPreset;
  captureEffect: ActiveCaptureEffect | null;
}> = ({ preset, captureEffect }) => {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const shakeTimer = useRef(0);

  useEffect(() => {
    if (captureEffect) {
      shakeTimer.current = 0.55;
    }
  }, [captureEffect]);

  useFrame((state, delta) => {
    if (!controlsRef.current) return;

    // Dramatic Battle-Chess Close-up Zoom + Impact Screen-Shake during a Capture!
    if (captureEffect) {
      const [tx, , tz] = squareToWorld(captureEffect.square);
      let shakeX = 0;
      let shakeY = 0;
      if (shakeTimer.current > 0) {
        shakeTimer.current = Math.max(0, shakeTimer.current - delta);
        const power = shakeTimer.current * 0.32;
        shakeX = Math.sin(state.clock.elapsedTime * 55) * power;
        shakeY = Math.cos(state.clock.elapsedTime * 48) * power;
      }
      controlsRef.current.target.lerp(
        new THREE.Vector3(tx * 0.65 + shakeX, 0.45 + shakeY, tz * 0.65),
        delta * 4.5
      );
      controlsRef.current.update();
      return;
    }

    controlsRef.current.target.lerp(new THREE.Vector3(0, 0, 0), delta * 4);

    let desiredPos: THREE.Vector3 | null = null;
    if (preset === 'top') {
      desiredPos = new THREE.Vector3(0, 9.2, 0.01);
    } else if (preset === 'table-white') {
      desiredPos = new THREE.Vector3(0, 5.4, 5.9);
    } else if (preset === 'table-black') {
      desiredPos = new THREE.Vector3(0, 5.4, -5.9);
    }

    if (desiredPos) {
      camera.position.lerp(desiredPos, delta * 3.5);
      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      minDistance={4.8}
      maxDistance={14.5}
      maxPolarAngle={Math.PI / 2.15}
      minPolarAngle={0.15}
      dampingFactor={0.07}
      enableDamping
    />
  );
};

export const DungeonArena3D: React.FC<DungeonArena3DProps> = ({
  game,
  fen,
  level,
  heroes,
  selectedSquare,
  legalMoves,
  lastMove,
  hintMove,
  shieldedSquares,
  frozenSquares,
  treasureSquares = [],
  obstacleSquares = [],
  promotedSquare = null,
  winningTeamColor = null,
  capturedByGold = [],
  capturedByPurple = [],
  kidMode,
  showAllNames,
  cameraPreset,
  captureEffect,
  onSquareClick,
}) => {
  const boardPieces = useMemo(() => {
    const b = game.board();
    const list: {
      square: Square;
      type: PieceRole;
      color: 'w' | 'b';
      fileIndex: number;
      pos: [number, number, number];
    }[] = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const cell = b[r][c];
        if (cell) {
          const sq = `${FILES[c]}${RANKS[r]}` as Square;
          list.push({
            square: sq,
            type: cell.type as PieceRole,
            color: cell.color,
            fileIndex: c,
            pos: squareToWorld(sq),
          });
        }
      }
    }
    return list;
  }, [game, fen]);

  const legalMap = useMemo(() => {
    const map = new Map<Square, boolean>();
    legalMoves.forEach((m) => map.set(m.to, m.isCapture));
    return map;
  }, [legalMoves]);

  const inCheckColor = game.inCheck() ? game.turn() : null;

  return (
    <>
      <fog attach="fog" args={[level.theme.fogColor, 11, 25]} />
      <ambientLight
        color={level.theme.ambientColor}
        intensity={level.theme.ambientIntensity}
      />
      <directionalLight
        castShadow
        position={[6, 12, 7]}
        intensity={1.35}
        color="#fffbeb"
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      <Stars
        radius={30}
        depth={25}
        count={900}
        factor={2.5}
        saturation={0.5}
        fade
        speed={0.8}
      />
      <Sparkles
        count={75}
        scale={[11, 4.5, 11]}
        position={[0, 1.8, 0]}
        size={3.2}
        speed={0.45}
        color={level.theme.particleColor}
      />

      {/* Stepped Ancient Stone Temple Altar & Chiseled Cliff Border (Matches Pitch Art!) */}
      <mesh position={[0, -0.62, 0]} receiveShadow>
        <boxGeometry args={[10.4, 0.65, 10.4]} />
        <meshStandardMaterial
          color={level.theme.floorColor}
          roughness={0.92}
          metalness={0.08}
        />
      </mesh>

      {/* Second Stepped Stone Ledge with Carved Rune Grooves */}
      <mesh position={[0, -0.26, 0]} receiveShadow castShadow>
        <boxGeometry args={[9.2, 0.32, 9.2]} />
        <meshStandardMaterial
          color={level.theme.pillarColor}
          roughness={0.82}
          metalness={0.18}
        />
      </mesh>

      {/* Deep Dark Stone Shadow Bed beneath the 64 Stone Slabs (Authentic dark grout shadow joints!) */}
      <mesh position={[0, -0.11, 0]} receiveShadow>
        <boxGeometry args={[8.18, 0.16, 8.18]} />
        <meshStandardMaterial
          color="#0a080c"
          roughness={0.96}
          metalness={0.05}
        />
      </mesh>

      {/* Atmospheric Lanterns & Floating Blue Mana Crystals around the Board */}
      <DungeonBoardProps3D runeColor={level.theme.runeGlowColor} />

      {/* 4 Corner Dungeon / Ramadan Fanous / Halloween Pumpkin Pillars */}
      <TorchPillar
        position={[-5.1, -0.2, -5.1]}
        pillarColor={level.theme.pillarColor}
        flameColor={level.theme.torchColor}
        specialTheme={level.specialTheme}
      />
      <TorchPillar
        position={[5.1, -0.2, -5.1]}
        pillarColor={level.theme.pillarColor}
        flameColor={level.theme.torchColor}
        specialTheme={level.specialTheme}
      />
      <TorchPillar
        position={[-5.1, -0.2, 5.1]}
        pillarColor={level.theme.pillarColor}
        flameColor={level.theme.torchColor}
        specialTheme={level.specialTheme}
      />
      <TorchPillar
        position={[5.1, -0.2, 5.1]}
        pillarColor={level.theme.pillarColor}
        flameColor={level.theme.torchColor}
        specialTheme={level.specialTheme}
      />

      {/* Special 3D Sky Elements for Ramadan & Halloween */}
      <SpecialThemeSky3D specialTheme={level.specialTheme} />

      {/* Coordinate Runes along the board edges */}
      {FILES.map((file, idx) => (
        <Text
          key={`file-${file}`}
          position={[idx - 3.5, 0.03, 4.22]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.24}
          color={level.theme.runeGlowColor}
          anchorX="center"
          anchorY="middle"
        >
          {file.toUpperCase()}
        </Text>
      ))}
      {RANKS.map((rank, idx) => (
        <Text
          key={`rank-${rank}`}
          position={[-4.22, 0.03, idx - 3.5]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.24}
          color={level.theme.runeGlowColor}
          anchorX="center"
          anchorY="middle"
        >
          {rank}
        </Text>
      ))}

      {/* 64 Carved Dungeon Chess Tiles */}
      <group>
        {RANKS.map((rank, rIdx) =>
          FILES.map((file, cIdx) => {
            const sq = `${file}${rank}` as Square;
            const isLight = (rIdx + cIdx) % 2 === 0;
            const isSelected = selectedSquare === sq;
            const isLegalTarget = legalMap.has(sq);
            const isCaptureTarget = legalMap.get(sq) === true;
            const isLastMoveTile =
              lastMove?.from === sq || lastMove?.to === sq;
            const isHintTile = hintMove?.from === sq || hintMove?.to === sq;
            const isTreasureTile = treasureSquares.includes(sq);
            const isObstacleTile = obstacleSquares.includes(sq);

            const tileX = cIdx - 3.5;
            const tileZ = rIdx - 3.5;

            const tileColor = isLight
              ? level.theme.lightTileColor
              : level.theme.darkTileColor;
            let emissiveColor = '#000000';
            let emissiveIntensity = 0;

            if (isSelected) {
              emissiveColor = '#f59e0b';
              emissiveIntensity = 0.65;
            } else if (isTreasureTile) {
              emissiveColor = '#eab308';
              emissiveIntensity = 0.55;
            } else if (isObstacleTile) {
              emissiveColor = '#dc2626';
              emissiveIntensity = 0.5;
            } else if (isHintTile) {
              emissiveColor = '#38bdf8';
              emissiveIntensity = 0.6;
            } else if (isCaptureTarget && kidMode) {
              emissiveColor = '#ef4444';
              emissiveIntensity = 0.45;
            } else if (isLastMoveTile) {
              emissiveColor = level.theme.runeGlowColor;
              emissiveIntensity = 0.25;
            }

            return (
              <DungeonStoneTile3D
                key={sq}
                sq={sq}
                rIdx={rIdx}
                cIdx={cIdx}
                tileX={tileX}
                tileZ={tileZ}
                tileColor={tileColor}
                isLight={isLight}
                isSelected={isSelected}
                isLastMoveTo={lastMove?.to === sq}
                isLegalTarget={isLegalTarget}
                isCaptureTarget={isCaptureTarget}
                emissiveColor={emissiveColor}
                emissiveIntensity={emissiveIntensity}
                kidMode={kidMode}
                runeGlowColor={level.theme.runeGlowColor}
                onSquareClick={onSquareClick}
              />
            );
          })
        )}
      </group>

      {/* Glowing 3D Parabolic Trajectory Arc for Last Move & Hint Move */}
      {lastMove && (
        <QuadraticBezierLine
          start={(() => {
            const [x, , z] = squareToWorld(lastMove.from);
            return [x, 0.16, z] as [number, number, number];
          })()}
          end={(() => {
            const [x, , z] = squareToWorld(lastMove.to);
            return [x, 0.16, z] as [number, number, number];
          })()}
          mid={(() => {
            const [x1, , z1] = squareToWorld(lastMove.from);
            const [x2, , z2] = squareToWorld(lastMove.to);
            return [(x1 + x2) / 2, 1.15, (z1 + z2) / 2] as [
              number,
              number,
              number,
            ];
          })()}
          color={level.theme.runeGlowColor}
          lineWidth={2.5}
          dashed
          dashScale={6}
          dashSize={0.4}
          dashOffset={0}
        />
      )}

      {hintMove && (
        <QuadraticBezierLine
          start={(() => {
            const [x, , z] = squareToWorld(hintMove.from);
            return [x, 0.2, z] as [number, number, number];
          })()}
          end={(() => {
            const [x, , z] = squareToWorld(hintMove.to);
            return [x, 0.2, z] as [number, number, number];
          })()}
          mid={(() => {
            const [x1, , z1] = squareToWorld(hintMove.from);
            const [x2, , z2] = squareToWorld(hintMove.to);
            return [(x1 + x2) / 2, 1.55, (z1 + z2) / 2] as [
              number,
              number,
              number,
            ];
          })()}
          color="#38bdf8"
          lineWidth={3.5}
        />
      )}

      {/* 3D Spectator Tribune along the Left & Right Stone Sidelines for Captured Pieces */}
      <group>
        {capturedByGold.slice(0, 12).map((role, idx) => (
          <SpectatorMiniHero3D
            key={`spec-gold-${idx}-${role}`}
            role={role}
            color="b"
            position={[-4.75, 0.05, -3.2 + idx * 0.58]}
            heroConfig={heroes[role]}
          />
        ))}
        {capturedByPurple.slice(0, 12).map((role, idx) => (
          <SpectatorMiniHero3D
            key={`spec-purple-${idx}-${role}`}
            role={role}
            color="w"
            position={[4.75, 0.05, -3.2 + idx * 0.58]}
            heroConfig={heroes[role]}
          />
        ))}
      </group>

      {/* Treasure Hunt Chests & Obstacles */}
      {treasureSquares.map((sq) => (
        <TreasureChest3D
          key={`chest-${sq}`}
          square={sq}
          onClick={() => onSquareClick(sq as Square)}
        />
      ))}
      {obstacleSquares.map((sq) => (
        <LavaObstacle3D key={`obs-${sq}`} square={sq} />
      ))}

      {/* All Family Hero Pieces on the Board */}
      <group>
        {boardPieces.map((p) => {
          const heroCfg = heroes[p.type];
          const isThreatenedKing = p.type === 'k' && inCheckColor === p.color;
          const isLastMoved = lastMove?.to === p.square;
          const fromWorldPos =
            isLastMoved && lastMove?.from
              ? (() => {
                  const [fx, , fz] = squareToWorld(lastMove.from);
                  return [fx, 0.06, fz] as [number, number, number];
                })()
              : null;
          // Alternate the two Cousin skins across odd/even files so BOTH Cousins from the bench photo are on the board!
          const useSecondCousin = p.type === 'p' && p.fileIndex % 2 === 1;
          const isAttackingNow =
            Boolean(captureEffect) && captureEffect?.square === p.square;
          const isPromotedNow = promotedSquare === p.square;
          const isCelebratingNow =
            winningTeamColor !== null && p.color === winningTeamColor;

          return (
            <FamilyHeroPiece3D
              key={`${p.color}-${p.type}-${p.square}`}
              role={p.type}
              color={p.color}
              targetPosition={[p.pos[0], 0.06, p.pos[2]]}
              fromPosition={fromWorldPos}
              heroConfig={heroCfg}
              useSecondarySkin={useSecondCousin}
              isSelected={selectedSquare === p.square}
              isCheckThreatened={isThreatenedKing}
              isShielded={shieldedSquares.includes(p.square)}
              isFrozen={frozenSquares.includes(p.square)}
              isLastMoved={isLastMoved}
              isAttacking={isAttackingNow}
              isPromoted={isPromotedNow}
              isCelebrating={isCelebratingNow}
              showNameplate={showAllNames}
              onSelect={() => onSquareClick(p.square)}
            />
          );
        })}
      </group>

      {/* Golden Coronation Spiral Aura when a Cousin promotes */}
      {promotedSquare && (
        <group position={squareToWorld(promotedSquare)}>
          <Sparkles
            count={80}
            scale={[1.8, 3.2, 1.8]}
            position={[0, 1.4, 0]}
            size={8}
            speed={4}
            color="#fde047"
          />
        </group>
      )}

      {/* Battle-Chess 3D Clash Effect & Speech Bubble */}
      {captureEffect && <BattleChessClash3D effect={captureEffect} />}

      <CameraDirector preset={cameraPreset} captureEffect={captureEffect} />
    </>
  );
};
