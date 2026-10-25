import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  fromSquare: Square;
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

// Ancient Dungeon Rune Glyphs + Islamic Festive Star/Crescent Ornament Symbols for Ramadan!
const RUNE_GLYPHS = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ', 'ᛉ', 'ᛋ', 'ᛏ', 'ᛒ', 'ᛖ', 'ᛗ', 'ᛚ', 'ᛞ'];
const RAMADAN_ORNAMENTS = ['۞', '☪', '✦', '✧', '۞', '☪', '✦', '۞'];

// Procedural 8-Pointed Islamic Star (Rub el Hizb) & Crescent Inlay Texture for Ramadan Tiles!
let cachedIslamicTileTex: THREE.CanvasTexture | null = null;
function getIslamicStarTileTexture(): THREE.CanvasTexture {
  if (cachedIslamicTileTex) return cachedIslamicTileTex;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 256, 256);
  ctx.save();
  ctx.translate(128, 128);

  // Outer soft golden radial glow
  const grad = ctx.createRadialGradient(0, 0, 8, 0, 0, 110);
  grad.addColorStop(0, 'rgba(253, 224, 71, 0.55)');
  grad.addColorStop(0.6, 'rgba(245, 158, 11, 0.22)');
  grad.addColorStop(1, 'rgba(245, 158, 11, 0.0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, 110, 0, Math.PI * 2);
  ctx.fill();

  // Draw two overlapping rotated squares -> Classic Islamic 8-Pointed Star (Rub el Hizb ۞)
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 6;
  for (let r = 0; r < 2; r++) {
    ctx.save();
    ctx.rotate((r * Math.PI) / 4);
    ctx.strokeRect(-52, -52, 104, 104);
    ctx.restore();
  }

  // Draw Crescent Moon (Hilal) in the center of the 8-pointed star
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(10, -6, 22, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalCompositeOperation = 'source-over';
  // Little 5-pointed star next to the crescent
  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.arc(14, -6, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  cachedIslamicTileTex = tex;
  return tex;
}

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
        {/* 1. Left & Right Illuminated 3D Mosque Pavilion Wings with Golden Domes, Minarets & Oriental Arches (Framed on the sides so they are 100% visible in the camera view!) */}
        {[-5.55, 5.55].map((sideX, sIdx) => {
          const isLeft = sIdx === 0;
          return (
            <group
              key={`mosque-wing-${sIdx}`}
              position={[sideX, -0.35, -0.8]}
              rotation={[0, isLeft ? Math.PI / 2 : -Math.PI / 2, 0]}
            >
              {/* Emerald- & Gold-Trimmed Mosque Arcade Wall */}
              <mesh position={[0, 0.75, 0]} receiveShadow castShadow>
                <boxGeometry args={[4.6, 1.5, 0.55]} />
                <meshStandardMaterial
                  color="#064e3b"
                  roughness={0.5}
                  metalness={0.3}
                />
              </mesh>
              <mesh position={[0, 1.54, 0]}>
                <boxGeometry args={[4.8, 0.12, 0.68]} />
                <meshStandardMaterial
                  color="#fbbf24"
                  emissive="#d97706"
                  emissiveIntensity={0.6}
                  metalness={0.88}
                  roughness={0.18}
                />
              </mesh>

              {/* 3 Illuminated Golden Oriental Arches per Wing */}
              {[-1.4, 0, 1.4].map((ax, aIdx) => (
                <group key={`wing-arch-${aIdx}`} position={[ax, 0.72, 0.29]}>
                  <mesh position={[0, 0.22, 0]}>
                    <torusGeometry args={[0.36, 0.045, 10, 24, Math.PI * 1.15]} />
                    <meshStandardMaterial
                      color="#fde047"
                      emissive="#f59e0b"
                      emissiveIntensity={0.9}
                      metalness={0.85}
                    />
                  </mesh>
                  <mesh position={[0, 0.02, -0.01]}>
                    <planeGeometry args={[0.58, 0.92]} />
                    <meshBasicMaterial
                      color="#fef08a"
                      transparent
                      opacity={0.42}
                    />
                  </mesh>
                </group>
              ))}

              {/* Central Golden Mosque Dome + Hilal Finial */}
              <group position={[0, 1.58, 0]}>
                <mesh position={[0, 0.2, 0]}>
                  <cylinderGeometry args={[0.95, 1.02, 0.35, 24]} />
                  <meshStandardMaterial
                    color="#047857"
                    metalness={0.4}
                    roughness={0.35}
                  />
                </mesh>
                <mesh position={[0, 0.38, 0]}>
                  <sphereGeometry
                    args={[0.92, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.58]}
                  />
                  <meshStandardMaterial
                    color="#fbbf24"
                    emissive="#d97706"
                    emissiveIntensity={0.65}
                    metalness={0.9}
                    roughness={0.15}
                  />
                </mesh>
                {/* Spire & Golden Crescent on Top of the Dome */}
                <mesh position={[0, 1.42, 0]}>
                  <cylinderGeometry args={[0.025, 0.045, 0.38, 8]} />
                  <meshBasicMaterial color="#fde047" />
                </mesh>
                <mesh
                  position={[0, 1.68, 0]}
                  rotation={[0, 0, Math.PI * 0.15]}
                >
                  <torusGeometry args={[0.16, 0.032, 10, 24, Math.PI * 1.35]} />
                  <meshBasicMaterial color="#fef08a" />
                </mesh>
              </group>

              {/* 2 Smaller Flanking Golden Domes */}
              {[-1.55, 1.55].map((dx, dIdx) => (
                <group key={`small-dome-${dIdx}`} position={[dx, 1.58, 0]}>
                  <mesh position={[0, 0.15, 0]}>
                    <sphereGeometry
                      args={[0.56, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.58]}
                    />
                    <meshStandardMaterial
                      color="#f59e0b"
                      emissive="#b45309"
                      emissiveIntensity={0.5}
                      metalness={0.85}
                      roughness={0.2}
                    />
                  </mesh>
                </group>
              ))}

              {/* Slender Illuminated Minaret Tower at the Back Corner of Each Mosque Wing */}
              <group position={[isLeft ? -2.6 : 2.6, 0, 0]}>
                <mesh position={[0, 1.85, 0]}>
                  <cylinderGeometry args={[0.2, 0.3, 3.6, 16]} />
                  <meshStandardMaterial
                    color="#fef3c7"
                    roughness={0.4}
                    metalness={0.2}
                  />
                </mesh>
                {/* Glowing Sherefe Balcony Ring */}
                <mesh position={[0, 2.75, 0]}>
                  <cylinderGeometry args={[0.34, 0.26, 0.15, 16]} />
                  <meshStandardMaterial
                    color="#fbbf24"
                    emissive="#f59e0b"
                    emissiveIntensity={1.1}
                    metalness={0.85}
                  />
                </mesh>
                {/* Golden Conical Minaret Roof + Crescent */}
                <mesh position={[0, 3.95, 0]}>
                  <coneGeometry args={[0.22, 0.72, 16]} />
                  <meshStandardMaterial
                    color="#fbbf24"
                    emissive="#d97706"
                    emissiveIntensity={0.6}
                    metalness={0.9}
                    roughness={0.15}
                  />
                </mesh>
                <mesh
                  position={[0, 4.42, 0]}
                  rotation={[0, 0, Math.PI * 0.15]}
                >
                  <torusGeometry args={[0.12, 0.025, 8, 20, Math.PI * 1.35]} />
                  <meshBasicMaterial color="#fef08a" />
                </mesh>
              </group>
            </group>
          );
        })}

        {/* 2. Festive Illuminated Fairy Light Garland (Lichterkette) across the Back of the Board */}
        <group position={[0, 2.55, -4.55]}>
          {[-3.6, -2.4, -1.2, 0, 1.2, 2.4, 3.6].map((lx, idx) => {
            const sagY = -Math.cos((lx / 4.0) * (Math.PI / 2)) * 0.38;
            const isStar = idx % 2 === 0;
            return (
              <group key={`garland-${idx}`} position={[lx, sagY, 0]}>
                <mesh position={[0, 0.18, 0]}>
                  <cylinderGeometry args={[0.008, 0.008, 0.36, 6]} />
                  <meshBasicMaterial color="#fde047" />
                </mesh>
                {isStar ? (
                  <mesh rotation={[0, 0, Math.PI / 4]}>
                    <octahedronGeometry args={[0.14, 0]} />
                    <meshBasicMaterial color="#fef08a" />
                  </mesh>
                ) : (
                  <mesh>
                    <cylinderGeometry args={[0.09, 0.06, 0.2, 6]} />
                    <meshStandardMaterial
                      color="#fbbf24"
                      emissive="#f59e0b"
                      emissiveIntensity={1.5}
                    />
                  </mesh>
                )}
              </group>
            );
          })}
        </group>

        {/* 3. Glowing 3D Golden Crescent Moon & Star + Heartfelt Trilingual Greeting Banner */}
        <group ref={moonGroupRef} position={[0, 3.1, -5.2]}>
          <mesh rotation={[0, 0, Math.PI * 0.15]}>
            <torusGeometry args={[0.85, 0.15, 16, 48, Math.PI * 1.35]} />
            <meshStandardMaterial
              color="#fde047"
              emissive="#f59e0b"
              emissiveIntensity={1.15}
              metalness={0.9}
              roughness={0.12}
            />
          </mesh>
          <mesh position={[0.35, 0.22, 0]}>
            <octahedronGeometry args={[0.22, 0]} />
            <meshStandardMaterial
              color="#fef08a"
              emissive="#fbbf24"
              emissiveIntensity={1.3}
            />
          </mesh>
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

// AAA Art-Director 3D Battle-Chess Choreography:
// Phase 1 (0.00-0.25s): Attacker windup & class-specific spell/weapon impact
// Phase 2 (0.25-0.45s): White-gold hit-stop flash + defender hit-recoil & ground crater shockwave
// Phase 3 (0.45-3.10s): Defender pops out of their crumbling stone pedestal and floats visibly under a 3D royal silk parachute toward the spectator sideline!
const BattleChessClash3D: React.FC<{ effect: ActiveCaptureEffect }> = ({
  effect,
}) => {
  const elapsed = useRef(0);
  const shockwaveRingRef = useRef<THREE.Mesh>(null);
  const innerBurstRef = useRef<THREE.Mesh>(null);
  const weaponGroupRef = useRef<THREE.Group>(null);
  const defenderGroupRef = useRef<THREE.Group>(null);
  const parachuteCanopyRef = useRef<THREE.Group>(null);
  const debrisGroupRef = useRef<THREE.Group>(null);
  const flashLightRef = useRef<THREE.PointLight>(null);

  const glowTex = useMemo(() => getGlowHaloTexture(), []);
  const defenderPngPath = useMemo(
    () => effect.defenderSprite.replace('.jpg', '.png'),
    [effect.defenderSprite]
  );
  const defenderTexture = useTexture(defenderPngPath);
  defenderTexture.colorSpace = THREE.SRGBColorSpace;

  const pos = useMemo(() => squareToWorld(effect.square), [effect.square]);
  const fromPos = useMemo(
    () =>
      effect.fromSquare ? squareToWorld(effect.fromSquare) : [pos[0], 0, pos[2] + 1],
    [effect.fromSquare, pos]
  );

  // Compute knockback direction vector (from attacker toward defender & sideline)
  const knockDir = useMemo(() => {
    const dx = pos[0] - fromPos[0];
    const dz = pos[2] - fromPos[2];
    const len = Math.hypot(dx, dz) || 1;
    return [dx / len, dz / len] as [number, number];
  }, [pos, fromPos]);

  // Sideline target X where captured pieces sit (Gold captures go left -4.75, Purple captures go right +4.75)
  const sidelineTargetX = effect.attackerColor === 'w' ? -4.75 - pos[0] : 4.75 - pos[0];

  // Role-specific class signature color & title
  const classSignature = useMemo(() => {
    switch (effect.attackerRole) {
      case 'k':
        return { color: '#fbbf24', secondary: '#fef08a', badge: '👑 KÖNIGLICHER EXCALIBUR-SPALT' };
      case 'q':
        return { color: '#c084fc', secondary: '#f472b6', badge: '🔮 ARKANE SUPERNOVA' };
      case 'b':
        return { color: '#38bdf8', secondary: '#bae6fd', badge: '❄️ SAPHIR-EISKRISTALL-BLITZ' };
      case 'n':
        return { color: '#fb7185', secondary: '#fda4af', badge: '🦄 WIRBELWIND-STOSS' };
      case 'r':
        return { color: '#f97316', secondary: '#fdba74', badge: '🏰 FESTUNGS-ERDBEBEN' };
      default:
        return { color: '#34d399', secondary: '#a7f3d0', badge: '🗡️ ZWILLINGS-DOLCH-BLITZ' };
    }
  }, [effect.attackerRole]);

  // 8 deterministic flying stone/crystal debris chunks on impact
  const debrisChunks = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => {
      const angle = (i * Math.PI * 2) / 8 + 0.2;
      const speed = 1.2 + (i % 3) * 0.45;
      return {
        vx: Math.cos(angle) * speed,
        vy: 2.1 + (i % 2) * 0.8,
        vz: Math.sin(angle) * speed,
        scale: 0.07 + (i % 3) * 0.025,
      };
    });
  }, []);

  useFrame((state, delta) => {
    elapsed.current += delta;
    const t = elapsed.current;

    // 1. Expanding Ground Crater Shockwave Ring
    if (shockwaveRingRef.current) {
      const s = 1 + Math.min(1, t / 0.85) * 3.8;
      shockwaveRingRef.current.scale.set(s, s, 1);
      const mat = shockwaveRingRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 1 - t / 0.85);
    }

    // 2. Additive Impact Flash Burst (peaks at t=0.18s, fades smoothly)
    if (innerBurstRef.current) {
      const burstScale = t < 0.2 ? 0.5 + (t / 0.2) * 2.4 : 2.9 + (t - 0.2) * 0.8;
      innerBurstRef.current.scale.set(burstScale, burstScale, 1);
      const mat = innerBurstRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = t < 0.2 ? t / 0.2 : Math.max(0, 1 - (t - 0.2) / 0.65);
    }

    if (flashLightRef.current) {
      flashLightRef.current.intensity =
        t < 0.25 ? 6.5 : Math.max(0, 6.5 * (1 - (t - 0.25) / 0.8));
    }

    // 3. Class-Specific 3D Weapon / Spell Animation
    if (weaponGroupRef.current) {
      weaponGroupRef.current.rotation.y += delta * 6.5;
      weaponGroupRef.current.rotation.z = Math.sin(t * 14) * 0.35;
      const wScale = t < 0.18 ? t / 0.18 : Math.max(0, 1 - (t - 0.18) / 0.85);
      weaponGroupRef.current.scale.setScalar(wScale);
    }

    // 4. Flying 3D Stone & Gem Debris Physics (parabolic gravity arc)
    if (debrisGroupRef.current) {
      debrisGroupRef.current.children.forEach((child, idx) => {
        const d = debrisChunks[idx];
        if (!d) return;
        const dt = Math.min(t, 1.2);
        child.position.set(
          d.vx * dt,
          Math.max(0, 0.15 + d.vy * dt - 4.8 * dt * dt),
          d.vz * dt
        );
        child.rotation.x += delta * 8;
        child.rotation.z += delta * 6;
        const fade = Math.max(0, 1 - t / 1.0);
        child.scale.setScalar(d.scale * fade);
      });
    }

    // 5. VISIBLE 3D DEFENDER HERO:
    //    - 0.00s..0.38s: Stands on square, gets hit-flashed, squashed & trembles in knockback!
    //    - 0.38s..3.10s: Parachute deploys overhead and carries the actual 3D Defender Hero smoothly toward the spectator bench!
    if (defenderGroupRef.current) {
      if (t < 0.38) {
        // Hit-stop knockback & squash/shake on the board!
        const recoil = Math.sin((t / 0.38) * Math.PI) * 0.26;
        const shake = Math.sin(state.clock.elapsedTime * 65) * 0.06;
        defenderGroupRef.current.position.set(
          knockDir[0] * recoil + shake,
          0.12 + Math.sin((t / 0.38) * Math.PI) * 0.35,
          knockDir[1] * recoil
        );
        defenderGroupRef.current.rotation.z =
          Math.sin(state.clock.elapsedTime * 45) * 0.22;
      } else {
        // Smooth Parachute Ascent & Glide toward the Spectator Sideline!
        const flightProgress = Math.min(1, (t - 0.38) / 2.6);
        const easeOut = 1 - Math.pow(1 - flightProgress, 2.2);
        const glideX = sidelineTargetX * easeOut * 0.72;
        const glideY = 0.45 + flightProgress * 2.65;
        const glideZ = knockDir[1] * 0.35 * (1 - flightProgress);
        defenderGroupRef.current.position.set(glideX, glideY, glideZ);
        // Gentle pendulum swing under the parachute
        defenderGroupRef.current.rotation.z =
          Math.sin(state.clock.elapsedTime * 5.5) * 0.16;
      }
    }

    // 6. Parachute Canopy Pop-Open Elastic Animation at t=0.32s
    if (parachuteCanopyRef.current) {
      if (t < 0.28) {
        parachuteCanopyRef.current.scale.setScalar(0.001);
      } else {
        const popT = Math.min(1, (t - 0.28) / 0.25);
        // Overshoot elastic pop
        const elastic =
          popT < 0.7
            ? (popT / 0.7) * 1.18
            : 1.18 - ((popT - 0.7) / 0.3) * 0.18;
        parachuteCanopyRef.current.scale.setScalar(elastic);
      }
    }
  });

  return (
    <group position={[pos[0], 0.12, pos[2]]}>
      {/* Dynamic PointLight Flash on the Stone Tiles */}
      <pointLight
        ref={flashLightRef}
        position={[0, 1.1, 0]}
        color={classSignature.color}
        intensity={6}
        distance={6}
      />

      {/* Ground Shockwave Ring */}
      <mesh ref={shockwaveRingRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.28, 0.46, 36]} />
        <meshBasicMaterial
          color={classSignature.color}
          transparent
          opacity={0.95}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Additive Ground Impact Glow Crater */}
      <mesh
        ref={innerBurstRef}
        position={[0, 0.02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[1.1, 1.1]} />
        <meshBasicMaterial
          map={glowTex}
          color={classSignature.secondary}
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Flying 3D Stone & Gem Debris Chunks on Impact */}
      <group ref={debrisGroupRef}>
        {debrisChunks.map((_, idx) => (
          <mesh key={idx} castShadow>
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial
              color={idx % 2 === 0 ? classSignature.color : '#78716c'}
              emissive={idx % 2 === 0 ? classSignature.color : '#000000'}
              emissiveIntensity={idx % 2 === 0 ? 0.8 : 0}
              roughness={0.6}
              flatShading
            />
          </mesh>
        ))}
      </group>

      {/* Class-Specific 3D Signature Weapon / Magic Impact Effect */}
      <group ref={weaponGroupRef} position={[0, 0.68, 0]}>
        {effect.attackerRole === 'k' && (
          /* King Baba: Golden Excalibur Cross-Slash + Crown Shockwave */
          <>
            <mesh rotation={[Math.PI / 3, 0, 0]}>
              <torusGeometry args={[0.72, 0.055, 12, 32, Math.PI * 1.4]} />
              <meshBasicMaterial color="#fde047" />
            </mesh>
            <mesh rotation={[-Math.PI / 3, Math.PI / 2, 0]}>
              <torusGeometry args={[0.68, 0.045, 12, 32, Math.PI * 1.4]} />
              <meshBasicMaterial color="#f59e0b" />
            </mesh>
          </>
        )}

        {effect.attackerRole === 'q' && (
          /* Queen Anne: Expanding Violet-Gold Arcane Supernova Sphere + Orbiting Rings */
          <>
            <mesh>
              <icosahedronGeometry args={[0.55, 1]} />
              <meshStandardMaterial
                color="#e879f9"
                emissive="#a855f7"
                emissiveIntensity={1.4}
                wireframe
                transparent
                opacity={0.85}
              />
            </mesh>
            <mesh rotation={[Math.PI / 4, 0, 0]}>
              <torusGeometry args={[0.75, 0.04, 10, 32]} />
              <meshBasicMaterial color="#fde047" />
            </mesh>
          </>
        )}

        {effect.attackerRole === 'b' && (
          /* Cool Aunt: Giant Sapphire Ice Crystal Burst */
          <>
            <mesh scale={[0.55, 1.25, 0.55]}>
              <octahedronGeometry args={[0.7, 0]} />
              <meshStandardMaterial
                color="#38bdf8"
                emissive="#0284c7"
                emissiveIntensity={1.3}
                transparent
                opacity={0.8}
              />
            </mesh>
            <mesh rotation={[0, Math.PI / 4, 0]} scale={[0.8, 0.8, 0.8]}>
              <octahedronGeometry args={[0.65, 0]} />
              <meshBasicMaterial color="#bae6fd" wireframe />
            </mesh>
          </>
        )}

        {effect.attackerRole === 'n' && (
          /* Princess Mini: Twin-Ribbon Rose Whirlwind Vortex */
          <>
            <mesh rotation={[Math.PI / 2.2, 0, 0]}>
              <torusGeometry args={[0.65, 0.05, 12, 32]} />
              <meshBasicMaterial color="#fb7185" />
            </mesh>
            <mesh position={[0, 0.28, 0]} rotation={[-Math.PI / 2.2, 0, 0]}>
              <torusGeometry args={[0.48, 0.045, 12, 32]} />
              <meshBasicMaterial color="#fde047" />
            </mesh>
          </>
        )}

        {effect.attackerRole === 'r' && (
          /* Uncle/Cousin Rook: Heavy Stone Battlement Seismic Slam */
          <mesh>
            <cylinderGeometry args={[0.68, 0.78, 0.45, 8, 1, true]} />
            <meshStandardMaterial
              color="#f97316"
              emissive="#ea580c"
              emissiveIntensity={1.2}
              wireframe
            />
          </mesh>
        )}

        {effect.attackerRole === 'p' && (
          /* Cousin Ranger: Twin Emerald/Silver Dagger X-Slash */
          <>
            <mesh rotation={[0, 0, Math.PI / 4]}>
              <boxGeometry args={[1.35, 0.07, 0.07]} />
              <meshBasicMaterial color="#6ee7b7" />
            </mesh>
            <mesh rotation={[0, 0, -Math.PI / 4]}>
              <boxGeometry args={[1.35, 0.07, 0.07]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          </>
        )}
      </group>

      {/* THE ACTUAL 3D DEFENDER HERO BEING LAUNCHED & FLOATING AWAY UNDER THE ROYAL PARACHUTE! */}
      <group ref={defenderGroupRef} position={[0, 0.15, 0]}>
        {/* 1. The Defender Hero 3D Cutout Miniature visibly dangling & waving! */}
        <Billboard position={[0, 0.42, 0]}>
          <mesh>
            <planeGeometry args={[0.92, 1.02]} />
            <meshStandardMaterial
              map={defenderTexture}
              transparent
              alphaTest={0.12}
              roughness={0.35}
              emissive={classSignature.color}
              emissiveIntensity={0.22}
            />
          </mesh>
        </Billboard>

        {/* 2. Ornate Royal Silk Parachute Canopy directly above the Defender Hero */}
        <group ref={parachuteCanopyRef} position={[0, 0.92, 0]}>
          {/* Ribbed Golden-Royal Parachute Dome */}
          <mesh position={[0, 0.38, 0]} castShadow>
            <sphereGeometry
              args={[0.52, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.56]}
            />
            <meshStandardMaterial
              color={effect.attackerColor === 'w' ? '#f59e0b' : '#9333ea'}
              emissive={effect.attackerColor === 'w' ? '#d97706' : '#7e22ce'}
              emissiveIntensity={0.45}
              side={THREE.DoubleSide}
              roughness={0.3}
              metalness={0.25}
            />
          </mesh>
          {/* Golden Trim Ring around Parachute Rim */}
          <mesh position={[0, 0.34, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.51, 0.022, 8, 24]} />
            <meshBasicMaterial color="#fde047" />
          </mesh>
          {/* 4 Silk Suspension Cords connecting the Canopy to the Hero's Shoulders */}
          {[
            [-0.26, 0.16],
            [0.26, 0.16],
            [-0.26, -0.16],
            [0.26, -0.16],
          ].map(([rx, rz], i) => (
            <mesh
              key={i}
              position={[rx * 0.65, 0.12, rz * 0.65]}
              rotation={[rz * 0.55, 0, -rx * 0.55]}
            >
              <cylinderGeometry args={[0.009, 0.009, 0.52, 6]} />
              <meshBasicMaterial color="#fef3c7" />
            </mesh>
          ))}
        </group>
      </group>

      <Sparkles
        count={65}
        scale={2.9}
        size={7.5}
        speed={3.4}
        color={classSignature.color}
      />

      {/* Sleek Game-Designer Combat Callout Pill (Positioned high enough so the 3D duel below is 100% unobstructed!) */}
      <Html position={[0, 2.85, 0]} center zIndexRange={[40, 0]}>
        <div className="pointer-events-none flex flex-col items-center gap-1">
          <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-2xl bg-slate-950/90 border-2 border-amber-400/90 backdrop-blur-md shadow-[0_0_30px_rgba(251,191,36,0.65)]">
            <img
              src={effect.attackerSprite}
              alt={effect.attackerName}
              className="w-11 h-11 rounded-xl object-cover border-2 border-amber-400 shadow"
            />
            <div className="text-center px-1">
              <div className="text-[9px] font-black uppercase tracking-widest text-amber-300">
                {classSignature.badge}
              </div>
              <div className="text-xs sm:text-sm font-extrabold text-white whitespace-nowrap">
                {effect.attackerName}{' '}
                <span className="text-amber-400">⚔️</span> {effect.defenderName}
              </div>
              <div className="text-[10px] font-bold text-amber-200/95 max-w-[230px] truncate italic">
                „{effect.quote}“
              </div>
            </div>
            <div className="relative">
              <img
                src={effect.defenderSprite}
                alt={effect.defenderName}
                className="w-9 h-9 rounded-xl object-cover border border-purple-400 opacity-80 -rotate-12"
              />
              <span className="absolute -top-2.5 -right-1 text-sm">🪂</span>
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
  specialTheme?: SpecialThemeType;
  onSquareClick: (sq: Square) => void;
  onSquareHover?: (sq: Square | null) => void;
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
  specialTheme = 'default',
  onSquareClick,
  onSquareHover,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const pressDepth = useRef(0);
  const stoneTex = useMemo(() => getCarvedStoneTexture(), []);
  const glowTex = useMemo(() => getGlowHaloTexture(), []);
  const islamicTileTex = useMemo(() => getIslamicStarTileTexture(), []);
  const isRamadan = specialTheme === 'ramadan';

  // Deterministic height micro-variation so the 64 flagstones look hand-laid
  const slabHeightOffset = useMemo(
    () => (((rIdx * 7 + cIdx * 13) % 5) - 2) * 0.008,
    [rIdx, cIdx]
  );

  // Art-Director 70/30 Rule: Selective Glowing Power Runes (or Islamic Rub el Hizb ۞ & Crescent ☪ ornaments in Ramadan!)
  const runeInfo = useMemo(() => {
    const hash = rIdx * 8 + cIdx;
    const glyph = isRamadan
      ? RAMADAN_ORNAMENTS[hash % RAMADAN_ORNAMENTS.length]
      : RUNE_GLYPHS[hash % RUNE_GLYPHS.length];
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
      color: isRamadan
        ? isCyanRune
          ? '#fbbf24'
          : '#34d399'
        : isCyanRune
        ? '#38bdf8'
        : '#fb923c',
      showRune,
    };
  }, [rIdx, cIdx, isRamadan]);

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
          onPointerOver={(e) => {
            e.stopPropagation();
            onSquareHover?.(sq);
          }}
          onPointerOut={() => {
            onSquareHover?.(null);
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

        {/* Soft Additive Bloom Halo + Glowing Carved Rune Glyph (or Islamic 8-Pointed Star & Crescent Inlay in Ramadan!) */}
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
            {isRamadan ? (
              <mesh position={[0, 0.066, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[0.68, 0.68]} />
                <meshBasicMaterial
                  map={islamicTileTex}
                  color={activeRuneColor}
                  transparent
                  opacity={
                    isSelected || isLegalTarget || isLastMoveTo ? 0.98 : 0.9
                  }
                  depthWrite={false}
                />
              </mesh>
            ) : (
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
            )}
          </>
        )}

        {/* Outer Stepped Cliff Edge Inscriptions along the Front Border of the Board */}
        {rIdx === 7 && (
          <Text
            position={[0, -0.06, 0.468]}
            fontSize={0.125}
            color={isRamadan ? '#fde047' : '#38bdf8'}
            anchorX="center"
            anchorY="middle"
          >
            {isRamadan
              ? `۞ ${FILES[cIdx].toUpperCase()} ☪`
              : `${RUNE_GLYPHS[(cIdx * 3) % RUNE_GLYPHS.length]} ${FILES[
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

// Atmospheric Dungeon Props around the Board (Warm Metal Lanterns + Golden Iftar Dallah/Dates Tray in Ramadan + Floating Eight-Pointed Stars / Mana Crystals)
const DungeonBoardProps3D: React.FC<{
  runeColor: string;
  specialTheme?: SpecialThemeType;
}> = ({ runeColor, specialTheme = 'default' }) => {
  const crystalsRef = useRef<THREE.Group>(null);
  const mistRef = useRef<THREE.Group>(null);
  const glowTex = useMemo(() => getGlowHaloTexture(), []);
  const isRamadan = specialTheme === 'ramadan';

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
              color={isRamadan ? '#fbbf24' : '#38bdf8'}
              transparent
              opacity={isRamadan ? 0.16 : 0.14}
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

      {/* In Ramadan Theme: Heartfelt Iftar Hospitality Corners (Golden Dallah Tea/Coffee Pot + Brass Tray with Medjool Dates!) */}
      {isRamadan &&
        [
          [-4.35, 0.05, 0],
          [4.35, 0.05, 0],
        ].map(([tx, ty, tz], tIdx) => (
          <group key={`iftar-tray-${tIdx}`} position={[tx, ty, tz]}>
            {/* Ornate Golden Brass Serving Tray (Siniya) */}
            <mesh position={[0, 0.02, 0]} receiveShadow>
              <cylinderGeometry args={[0.42, 0.38, 0.03, 24]} />
              <meshStandardMaterial
                color="#fbbf24"
                metalness={0.88}
                roughness={0.18}
              />
            </mesh>
            {/* Golden Arabic Dallah / Caydanlik Teapot */}
            <group position={[-0.1, 0.04, -0.05]}>
              <mesh position={[0, 0.14, 0]} castShadow>
                <cylinderGeometry args={[0.08, 0.13, 0.26, 16]} />
                <meshStandardMaterial
                  color="#f59e0b"
                  emissive="#d97706"
                  emissiveIntensity={0.35}
                  metalness={0.9}
                  roughness={0.15}
                />
              </mesh>
              <mesh position={[0, 0.3, 0]}>
                <coneGeometry args={[0.09, 0.12, 16]} />
                <meshStandardMaterial
                  color="#fde047"
                  metalness={0.9}
                  roughness={0.15}
                />
              </mesh>
            </group>
            {/* Small Bowl of Sweet Iftar Dates (Hurma / Tamr) */}
            <group position={[0.14, 0.05, 0.1]}>
              <mesh position={[0, 0.03, 0]}>
                <cylinderGeometry args={[0.13, 0.09, 0.06, 14]} />
                <meshStandardMaterial
                  color="#fde047"
                  metalness={0.85}
                  roughness={0.2}
                />
              </mesh>
              {[-0.04, 0.04, 0].map((dx, dIdx) => (
                <mesh
                  key={dIdx}
                  position={[dx, 0.07, dIdx === 2 ? 0.04 : -0.02]}
                  scale={[1.2, 0.8, 0.8]}
                >
                  <sphereGeometry args={[0.038, 8, 8]} />
                  <meshStandardMaterial color="#78350f" roughness={0.4} />
                </mesh>
              ))}
            </group>
          </group>
        ))}

      {/* 4 Floating Glowing Eight-Pointed Islamic Rub el Hizb Stars (in Ramadan) or Blue Mana Crystals */}
      <group ref={crystalsRef}>
        {crystalPositions.map((pos, idx) => (
          <group key={`mana-crystal-${idx}`} position={pos}>
            {isRamadan ? (
              /* Golden Eight-Pointed Islamic Star (Rub el Hizb ۞) */
              <group>
                <mesh scale={[0.34, 0.34, 0.12]}>
                  <boxGeometry args={[1, 1, 1]} />
                  <meshStandardMaterial
                    color="#fde047"
                    emissive="#f59e0b"
                    emissiveIntensity={1.2}
                    metalness={0.88}
                    roughness={0.15}
                  />
                </mesh>
                <mesh
                  scale={[0.34, 0.34, 0.12]}
                  rotation={[0, 0, Math.PI / 4]}
                >
                  <boxGeometry args={[1, 1, 1]} />
                  <meshStandardMaterial
                    color="#fbbf24"
                    emissive="#d97706"
                    emissiveIntensity={1.2}
                    metalness={0.88}
                    roughness={0.15}
                  />
                </mesh>
              </group>
            ) : (
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
            )}
            <Billboard position={[0, 0, 0]}>
              <mesh>
                <planeGeometry args={[1.25, 1.25]} />
                <meshBasicMaterial
                  map={glowTex}
                  color={isRamadan ? '#fbbf24' : '#38bdf8'}
                  transparent
                  opacity={0.5}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>
            </Billboard>
            {/* Orbiting Halo Ring */}
            <mesh rotation={[Math.PI / 2.4, 0.3, 0]}>
              <ringGeometry args={[0.32, 0.36, 20]} />
              <meshBasicMaterial
                color={isRamadan ? '#fde047' : runeColor || '#38bdf8'}
                side={THREE.DoubleSide}
                transparent
                opacity={0.75}
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
  const actionZoomTimer = useRef(0);
  const wasCapturing = useRef(false);

  useEffect(() => {
    if (captureEffect) {
      shakeTimer.current = 0.58;
      actionZoomTimer.current = 1.25;
      wasCapturing.current = true;
    }
  }, [captureEffect]);

  useFrame((state, delta) => {
    if (!controlsRef.current) return;

    // Dramatic Battle-Chess Close-up Action Kill-Cam Zoom + Impact Screen-Shake during a Capture!
    if (captureEffect) {
      const [tx, , tz] = squareToWorld(captureEffect.square);
      let shakeX = 0;
      let shakeY = 0;
      if (shakeTimer.current > 0) {
        shakeTimer.current = Math.max(0, shakeTimer.current - delta);
        const power = shakeTimer.current * 0.36;
        shakeX = Math.sin(state.clock.elapsedTime * 55) * power;
        shakeY = Math.cos(state.clock.elapsedTime * 48) * power;
      }
      if (actionZoomTimer.current > 0) {
        actionZoomTimer.current = Math.max(0, actionZoomTimer.current - delta);
        // Smoothly pull camera ~28% closer to the clash square for cinematic impact
        const zoomTargetPos = new THREE.Vector3(
          tx * 0.55,
          5.35,
          tz * 0.55 + ( preset === 'table-black' ? -4.4 : 4.6 )
        );
        camera.position.lerp(zoomTargetPos, delta * 3.2);
      }
      controlsRef.current.target.lerp(
        new THREE.Vector3(tx * 0.65 + shakeX, 0.48 + shakeY, tz * 0.65),
        delta * 5.0
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
    } else if (wasCapturing.current) {
      // Smoothly return to default orbit framing after the Kill-Cam zoom finishes
      desiredPos = new THREE.Vector3(0, 8.2, 6.8);
      if (camera.position.distanceTo(desiredPos) < 0.15) {
        wasCapturing.current = false;
      }
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
  const [hoveredSquare, setHoveredSquare] = useState<Square | null>(null);
  const hoveredLegalMove = useMemo(
    () =>
      selectedSquare && hoveredSquare
        ? legalMoves.find((m) => m.to === hoveredSquare) || null
        : null,
    [selectedSquare, hoveredSquare, legalMoves]
  );

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

      {/* Atmospheric Lanterns, Iftar Trays & Floating Islamic Stars / Mana Crystals around the Board */}
      <DungeonBoardProps3D
        runeColor={level.theme.runeGlowColor}
        specialTheme={level.specialTheme}
      />

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
                specialTheme={level.specialTheme}
                onSquareClick={onSquareClick}
                onSquareHover={setHoveredSquare}
              />
            );
          })
        )}
      </group>

      {/* Live Tactical 3D Jump-Arc Preview Bridge when Hovering a Legal Move Square */}
      {selectedSquare && hoveredLegalMove && (
        <group>
          <QuadraticBezierLine
            start={(() => {
              const [x, , z] = squareToWorld(selectedSquare);
              return [x, 0.25, z] as [number, number, number];
            })()}
            end={(() => {
              const [x, , z] = squareToWorld(hoveredLegalMove.to);
              return [x, 0.25, z] as [number, number, number];
            })()}
            mid={(() => {
              const [x1, , z1] = squareToWorld(selectedSquare);
              const [x2, , z2] = squareToWorld(hoveredLegalMove.to);
              return [(x1 + x2) / 2, 1.45, (z1 + z2) / 2] as [
                number,
                number,
                number,
              ];
            })()}
            color={hoveredLegalMove.isCapture ? '#ef4444' : '#34d399'}
            lineWidth={4}
          />
          <mesh
            position={(() => {
              const [x, , z] = squareToWorld(hoveredLegalMove.to);
              return [x, 0.08, z] as [number, number, number];
            })()}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[0.32, 0.44, 28]} />
            <meshBasicMaterial
              color={hoveredLegalMove.isCapture ? '#ef4444' : '#34d399'}
              side={THREE.DoubleSide}
              transparent
              opacity={0.95}
            />
          </mesh>
        </group>
      )}

      {/* Glowing 3D Parabolic Trajectory Arc for Last Move & Hint Move */}
      {lastMove && lastMove.from !== lastMove.to && (
        <group>
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
              return [(x1 + x2) / 2, 1.18, (z1 + z2) / 2] as [
                number,
                number,
                number,
              ];
            })()}
            color={level.theme.runeGlowColor}
            lineWidth={3.2}
            dashed
            dashScale={5}
            dashSize={0.45}
            dashOffset={0}
          />
          {/* Origin Footprint Rune Ring */}
          <mesh
            position={(() => {
              const [x, , z] = squareToWorld(lastMove.from);
              return [x, 0.068, z] as [number, number, number];
            })()}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[0.22, 0.31, 24]} />
            <meshBasicMaterial
              color={level.theme.runeGlowColor}
              side={THREE.DoubleSide}
              transparent
              opacity={0.75}
            />
          </mesh>
        </group>
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
