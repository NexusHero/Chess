import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import {
  DungeonLevelId,
  FamilyHeroConfig,
  PieceRole,
  SpecialThemeType,
} from '../data/familyConfig';

interface FamilyHeroPieceProps {
  role: PieceRole;
  color: 'w' | 'b';
  levelId?: DungeonLevelId;
  specialTheme?: SpecialThemeType;
  targetPosition: [number, number, number];
  fromPosition?: [number, number, number] | null;
  heroConfig: FamilyHeroConfig;
  useSecondarySkin?: boolean;
  isSelected: boolean;
  hasActiveSelection?: boolean;
  isCheckThreatened: boolean;
  isShielded?: boolean;
  isFrozen?: boolean;
  isLastMoved: boolean;
  isAttacking?: boolean;
  isPromoted?: boolean;
  isCelebrating?: boolean;
  showNameplate: boolean;
  onSelect: () => void;
}

// Clear Art-Director Size & Pedestal Hierarchy so Front & Back Ranks never occlude each other!
const ROLE_HEIGHT_SCALE: Record<PieceRole, number> = {
  k: 1.32,
  q: 1.26,
  b: 1.14,
  r: 1.15,
  n: 1.14,
  p: 0.94,
};

const ROLE_PEDESTAL_HEIGHT: Record<PieceRole, number> = {
  k: 0.22,
  q: 0.2,
  b: 0.15,
  r: 0.15,
  n: 0.14,
  p: 0.1,
};

// Cached Procedural Black-and-White Houndstooth (Hahnentritt) Texture for Cousine Rune ('p' secondary skin)!
let cachedHoundstoothTex: THREE.CanvasTexture | null = null;
function getHoundstoothTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  if (cachedHoundstoothTex) return cachedHoundstoothTex;

  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#0f172a';
    // Classic 4x4 tiled Houndstooth (Hahnentritt) motif
    for (let y = 0; y < 64; y += 32) {
      for (let x = 0; x < 64; x += 32) {
        // Main black square
        ctx.fillRect(x, y, 16, 16);
        // Upper-right & lower-left jagged tooth diagonals
        ctx.beginPath();
        ctx.moveTo(x + 16, y);
        ctx.lineTo(x + 28, y);
        ctx.lineTo(x + 16, y + 12);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(x, y + 16);
        ctx.lineTo(x + 12, y + 16);
        ctx.lineTo(x, y + 28);
        ctx.closePath();
        ctx.fill();

        // Bottom-right diagonal wing
        ctx.beginPath();
        ctx.moveTo(x + 16, y + 16);
        ctx.lineTo(x + 32, y + 16);
        ctx.lineTo(x + 20, y + 28);
        ctx.lineTo(x + 16, y + 24);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.needsUpdate = true;
  cachedHoundstoothTex = tex;
  return tex;
}

/**
 * 3D Expressive Pixar/Tabletop Chibi Head for our Family Heroes!
 * Renders warm human skin (or dark-elf shadow skin for Enemy Clones),
 * big expressive eyes with white catchlights, eyebrows, nose, ears, and smile.
 */
const ChibiHead3D: React.FC<{
  headY: number;
  headRadius?: number;
  skinColor: string;
  eyeColor: string;
  browColor: string;
  isGold: boolean;
  hasRosyCheeks?: boolean;
  hasBigToothGrin?: boolean;
  hasRedLips?: boolean;
}> = ({
  headY,
  headRadius = 0.155,
  skinColor,
  eyeColor,
  browColor,
  isGold,
  hasRosyCheeks = false,
  hasBigToothGrin = false,
  hasRedLips = false,
}) => {
  return (
    <group position={[0, headY, 0]}>
      {/* Main Chibi Head Sphere */}
      <mesh scale={[1, 0.96, 0.94]} castShadow receiveShadow>
        <sphereGeometry args={[headRadius, 22, 18]} />
        <meshStandardMaterial color={skinColor} roughness={0.42} metalness={0.05} />
      </mesh>

      {/* Cute Left & Right Ears */}
      <mesh position={[-headRadius * 0.95, -0.01, 0]} scale={[0.45, 0.75, 0.5]}>
        <sphereGeometry args={[0.045, 10, 10]} />
        <meshStandardMaterial color={skinColor} roughness={0.45} />
      </mesh>
      <mesh position={[headRadius * 0.95, -0.01, 0]} scale={[0.45, 0.75, 0.5]}>
        <sphereGeometry args={[0.045, 10, 10]} />
        <meshStandardMaterial color={skinColor} roughness={0.45} />
      </mesh>

      {/* Cute Button Nose */}
      <mesh position={[0, -0.01, headRadius * 0.92]} scale={[0.9, 0.75, 0.9]}>
        <sphereGeometry args={[0.022, 10, 10]} />
        <meshStandardMaterial color={skinColor} roughness={0.38} />
      </mesh>

      {/* Expressive 3D Eyes (Left & Right) */}
      {[-1, 1].map((side) => {
        const ex = side * headRadius * 0.36;
        const ey = 0.015;
        const ez = headRadius * 0.84;
        return (
          <group key={`eye-${side}`} position={[ex, ey, ez]}>
            {/* White Sclera (or glowing shadow eye for Enemy Team) */}
            <mesh scale={[1, 1.15, 0.5]}>
              <sphereGeometry args={[0.032, 12, 12]} />
              <meshBasicMaterial color={isGold ? '#ffffff' : eyeColor} />
            </mesh>
            {isGold && (
              <>
                {/* Colored Iris */}
                <mesh position={[0, 0, 0.008]} scale={[0.78, 0.92, 0.45]}>
                  <sphereGeometry args={[0.028, 12, 12]} />
                  <meshBasicMaterial color={eyeColor} />
                </mesh>
                {/* Dark Pupil */}
                <mesh position={[0, 0, 0.014]} scale={[0.48, 0.58, 0.4]}>
                  <sphereGeometry args={[0.024, 10, 10]} />
                  <meshBasicMaterial color="#09090b" />
                </mesh>
                {/* Pixar White Catchlight Sparkle */}
                <mesh position={[0.008, 0.01, 0.022]}>
                  <sphereGeometry args={[0.007, 8, 8]} />
                  <meshBasicMaterial color="#ffffff" />
                </mesh>
              </>
            )}
          </group>
        );
      })}

      {/* Sculpted Eyebrows */}
      {[-1, 1].map((side) => (
        <mesh
          key={`brow-${side}`}
          position={[side * headRadius * 0.36, 0.064, headRadius * 0.86]}
          rotation={[0, 0, side * (isGold ? -0.1 : 0.24)]}
        >
          <boxGeometry args={[0.056, 0.014, 0.016]} />
          <meshStandardMaterial color={browColor} roughness={0.6} />
        </mesh>
      ))}

      {/* Rosy Cheeks for Prinzessin Mini */}
      {hasRosyCheeks && isGold && (
        <>
          <mesh position={[-headRadius * 0.52, -0.025, headRadius * 0.78]} scale={[1.2, 0.75, 0.4]}>
            <sphereGeometry args={[0.024, 10, 10]} />
            <meshBasicMaterial color="#fb7185" transparent opacity={0.65} />
          </mesh>
          <mesh position={[headRadius * 0.52, -0.025, headRadius * 0.78]} scale={[1.2, 0.75, 0.4]}>
            <sphereGeometry args={[0.024, 10, 10]} />
            <meshBasicMaterial color="#fb7185" transparent opacity={0.65} />
          </mesh>
        </>
      )}

      {/* Mouth: Either Cousin Tank's Big White Grin, Red Smiling Lips, or Warm Smile */}
      {hasBigToothGrin ? (
        <mesh position={[0, -0.052, headRadius * 0.88]} scale={[1.2, 0.65, 0.5]}>
          <boxGeometry args={[0.072, 0.036, 0.024]} />
          <meshBasicMaterial color={isGold ? '#ffffff' : '#f43f5e'} />
        </mesh>
      ) : (
        <mesh
          position={[0, -0.048, headRadius * 0.89]}
          rotation={[Math.PI, 0, 0]}
        >
          <torusGeometry args={[0.024, 0.006, 8, 16, Math.PI]} />
          <meshBasicMaterial
            color={hasRedLips ? (isGold ? '#e11d48' : '#a855f7') : '#7c2d12'}
          />
        </mesh>
      )}
    </group>
  );
};

/**
 * Authentic 3D Sculpted Chibi Miniatures of our 7 Original Family Heroes!
 *  - 'k' (König Baba): Dark full beard, golden crown, silver/gold eagle chestplate, red cape & runic broadsword
 *  - 'q' (Königin Anne): Royal purple hijab, golden forehead tiara, purple/gold robe & twin floating magic spheres
 *  - 'b' (Tante Boss): Voluminous wavy blonde hair, cool black sunglasses, black/gold coat & glowing blue sapphire crystal staff
 *  - 'n' (Prinzessin Mini): Two cute brown pigtails with red ties, silver knight armor, red cape & sparkling star-rapier
 *  - 'r' (Cousin Tank): Muscular build, short beard & big white grin, castle-turret shoulder pauldrons & giant armored crusher fists
 *  - 'p' Skin 1 (Cousine Dolch): Forest-green ranger hood, dark wavy hair, leather tunic & twin glowing cyan daggers
 *  - 'p' Skin 2 (Cousine Rune): Black-and-silver hijab, black-and-white Houndstooth (Hahnentritt) dress & glowing purple arcane bow
 */
export const SculptedHeroMesh3D: React.FC<{
  role: PieceRole;
  color: 'w' | 'b';
  levelId?: number;
  specialTheme?: SpecialThemeType;
  isSelected?: boolean;
  isFrozen?: boolean;
  isShielded?: boolean;
  useSecondarySkin?: boolean;
}> = ({
  role,
  color,
  levelId = 1,
  specialTheme = 'default',
  isSelected = false,
  isFrozen = false,
  isShielded = false,
  useSecondarySkin = false,
}) => {
  const isGold = color === 'w';
  const houndstoothTex = useMemo(() => getHoundstoothTexture(), []);

  // Skin, Eye & Shadow-Clone Palette:
  // Team Gold ('w') wears our family's true iconic colors;
  // Team Enemy ('b') is an unmistakable Dark Shadow-Clone ('Schatten-Doppelgänger') in Obsidian & Glowing Amethyst/Crimson!
  const skinColor = isFrozen
    ? '#7dd3fc'
    : isGold
    ? '#f3c39c'
    : specialTheme === 'halloween'
    ? '#581c87'
    : levelId === 3
    ? '#450a0a'
    : '#475569';

  const enemyEyeGlow =
    specialTheme === 'halloween'
      ? '#f97316'
      : levelId === 3
      ? '#ef4444'
      : '#f43f5e';

  const themeAccentColor =
    specialTheme === 'ramadan'
      ? '#fde047'
      : specialTheme === 'halloween'
      ? '#f97316'
      : levelId === 2
      ? '#38bdf8'
      : levelId === 3
      ? '#ef4444'
      : '#fbbf24';

  // Heroic 3/4 Front Pose toward the camera so players see the faces, beards, sunglasses, grins, hijabs & weapons!
  const facingY = isGold ? 0.16 : -0.16;

  return (
    <group rotation={[0, facingY, 0]}>
      {/* ==================== 1. KÖNIG BABA ('k' – Der Familien-König / Papa) ==================== */}
      {role === 'k' && (
        <group>
          {/* Armored Silver-Steel Boots & Greaves */}
          {[-0.085, 0.085].map((lx, idx) => (
            <group key={`k-leg-${idx}`} position={[lx, 0.13, 0]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.055, 0.062, 0.24, 12]} />
                <meshStandardMaterial
                  color={isGold ? '#94a3b8' : '#1e1b4b'}
                  metalness={0.82}
                  roughness={0.22}
                />
              </mesh>
              {/* Golden Knee Guard */}
              <mesh position={[0, 0.04, 0.055]}>
                <sphereGeometry args={[0.032, 8, 8]} />
                <meshStandardMaterial color={isGold ? '#fbbf24' : '#9333ea'} metalness={0.9} />
              </mesh>
            </group>
          ))}

          {/* Red Royal Inner Tunic Skirt */}
          <mesh position={[0, 0.26, 0]} castShadow>
            <cylinderGeometry args={[0.145, 0.185, 0.2, 16]} />
            <meshStandardMaterial
              color={isGold ? (specialTheme === 'ramadan' ? '#065f46' : '#dc2626') : '#3b0764'}
              roughness={0.55}
            />
          </mesh>

          {/* Silver-Steel Paladin Chestplate + Golden Eagle Crest */}
          <mesh position={[0, 0.43, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.175, 0.145, 0.28, 16]} />
            <meshStandardMaterial
              color={isFrozen ? '#38bdf8' : isGold ? '#cbd5e1' : '#1e1b4b'}
              metalness={0.85}
              roughness={0.2}
            />
          </mesh>
          {/* Golden Eagle Wing Emblem on Chest */}
          <mesh position={[0, 0.45, 0.16]} scale={[1.4, 0.8, 0.3]}>
            <octahedronGeometry args={[0.075, 0]} />
            <meshStandardMaterial
              color={isGold ? '#fbbf24' : '#e879f9'}
              emissive={isGold ? '#d97706' : '#9333ea'}
              emissiveIntensity={0.45}
              metalness={0.9}
            />
          </mesh>

          {/* Leather Belt & Golden Buckle */}
          <mesh position={[0, 0.31, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.15, 0.025, 8, 20]} />
            <meshStandardMaterial color="#78350f" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.31, 0.165]}>
            <boxGeometry args={[0.06, 0.05, 0.02]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.9} />
          </mesh>

          {/* Billowing Royal Crimson Cape */}
          <mesh position={[0, 0.36, -0.15]} rotation={[0.2, 0, 0]} castShadow>
            <boxGeometry args={[0.38, 0.54, 0.04]} />
            <meshStandardMaterial
              color={isGold ? (specialTheme === 'ramadan' ? '#047857' : '#b91c1c') : '#3b0764'}
              roughness={0.55}
            />
          </mesh>

          {/* Layered Silver & Gold Rounded Shoulder Pauldrons */}
          {[-0.21, 0.21].map((sx, idx) => (
            <group key={`k-pauldron-${idx}`} position={[sx, 0.52, 0]}>
              <mesh scale={[1.1, 0.85, 1.1]} castShadow>
                <sphereGeometry args={[0.088, 14, 12]} />
                <meshStandardMaterial
                  color={isGold ? '#cbd5e1' : '#312e81'}
                  metalness={0.85}
                  roughness={0.2}
                />
              </mesh>
              <mesh position={[0, -0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.082, 0.016, 8, 16]} />
                <meshStandardMaterial color={isGold ? '#fbbf24' : '#c084fc'} metalness={0.9} />
              </mesh>
            </group>
          ))}

          {/* Chibi Head + Dark Hair + Full Dark Beard & Mustache */}
          <ChibiHead3D
            headY={0.73}
            headRadius={0.16}
            skinColor={skinColor}
            eyeColor={isGold ? '#1e3a8a' : enemyEyeGlow}
            browColor="#1c1917"
            isGold={isGold}
          />
          {/* Short Dark Hair Cap */}
          <mesh position={[0, 0.77, -0.02]} scale={[1.04, 0.92, 1.02]}>
            <sphereGeometry args={[0.16, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
            <meshStandardMaterial color="#1c1917" roughness={0.75} />
          </mesh>
          {/* Full Sculpted 3D Dark Beard & Mustache framing Baba's Jaw & Chin */}
          <mesh position={[0, 0.66, 0.055]} scale={[0.96, 0.72, 0.88]} castShadow>
            <sphereGeometry args={[0.152, 16, 12]} />
            <meshStandardMaterial color="#1c1917" roughness={0.8} />
          </mesh>
          {/* Mustache Bar */}
          <mesh position={[0, 0.7, 0.145]} rotation={[0, 0, 0]}>
            <boxGeometry args={[0.11, 0.026, 0.032]} />
            <meshStandardMaterial color="#1c1917" roughness={0.8} />
          </mesh>

          {/* Golden 5-Pointed Royal Crown with Ruby & Sapphire Jewels */}
          <group position={[0, 0.89, 0]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.135, 0.12, 0.09, 10]} />
              <meshStandardMaterial
                color="#fbbf24"
                emissive={themeAccentColor}
                emissiveIntensity={0.35}
                metalness={0.92}
                roughness={0.12}
              />
            </mesh>
            {/* 5 Crown Peaks */}
            {[0, 1, 2, 3, 4].map((cIdx) => {
              const a = (cIdx * Math.PI * 2) / 5;
              return (
                <mesh
                  key={`crown-peak-${cIdx}`}
                  position={[Math.sin(a) * 0.12, 0.065, Math.cos(a) * 0.12]}
                >
                  <coneGeometry args={[0.032, 0.07, 4]} />
                  <meshStandardMaterial color="#fde047" metalness={0.95} roughness={0.1} />
                </mesh>
              );
            })}
            {/* Front Ruby Gem */}
            <mesh position={[0, 0, 0.128]}>
              <sphereGeometry args={[0.022, 8, 8]} />
              <meshBasicMaterial color={specialTheme === 'ramadan' ? '#10b981' : '#ef4444'} />
            </mesh>
          </group>

          {/* Armored Arms + Glowing Runic Broadsword held heroically across the front */}
          <mesh position={[-0.22, 0.39, 0.04]} rotation={[0.3, 0, 0.2]}>
            <cylinderGeometry args={[0.042, 0.048, 0.22, 10]} />
            <meshStandardMaterial color={isGold ? '#94a3b8' : '#1e1b4b'} metalness={0.8} />
          </mesh>
          <mesh position={[0.22, 0.39, 0.06]} rotation={[0.45, 0, -0.25]}>
            <cylinderGeometry args={[0.042, 0.048, 0.22, 10]} />
            <meshStandardMaterial color={isGold ? '#94a3b8' : '#1e1b4b'} metalness={0.8} />
          </mesh>

          {/* König Baba's Runic Broadsword ('Sonnenklinge') */}
          <group position={[0.14, 0.32, 0.17]} rotation={[0.12, 0.15, -1.05]}>
            {/* Golden Crossguard */}
            <mesh>
              <boxGeometry args={[0.17, 0.035, 0.045]} />
              <meshStandardMaterial color="#fbbf24" metalness={0.92} roughness={0.15} />
            </mesh>
            {/* Silver Broadsword Blade */}
            <mesh position={[0, 0.26, 0]} castShadow>
              <boxGeometry args={[0.058, 0.48, 0.018]} />
              <meshStandardMaterial
                color={isGold ? '#f1f5f9' : '#c084fc'}
                metalness={0.95}
                roughness={0.1}
              />
            </mesh>
            {/* Glowing Golden Rune Groove down the Blade */}
            <mesh position={[0, 0.24, 0.011]}>
              <boxGeometry args={[0.018, 0.38, 0.006]} />
              <meshBasicMaterial color={isGold ? '#fde047' : '#f43f5e'} />
            </mesh>
          </group>
        </group>
      )}

      {/* ==================== 2. KÖNIGIN ANNE ('q' – Die Königin / Mama) ==================== */}
      {role === 'q' && (
        <group>
          {/* Flowing Royal Purple & Gold-Embroidered Archmage Gown */}
          <mesh position={[0, 0.28, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.12, 0.24, 0.52, 20]} />
            <meshStandardMaterial
              color={
                isFrozen
                  ? '#38bdf8'
                  : isGold
                  ? specialTheme === 'ramadan'
                    ? '#065f46'
                    : '#7e22ce'
                  : '#1e1b4b'
              }
              roughness={0.38}
              metalness={0.18}
            />
          </mesh>
          {/* Gold-Embroidered Vertical Front Panels on Gown */}
          {[-0.045, 0.045].map((gx, idx) => (
            <mesh key={`q-gold-trim-${idx}`} position={[gx, 0.27, 0.165]} rotation={[-0.18, 0, 0]}>
              <boxGeometry args={[0.022, 0.48, 0.015]} />
              <meshStandardMaterial color="#fbbf24" metalness={0.88} roughness={0.2} />
            </mesh>
          ))}
          {/* Golden Waist Belt + Magenta Gem + Spell Pouch */}
          <mesh position={[0, 0.36, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.135, 0.022, 8, 20]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.15} />
          </mesh>
          <mesh position={[0, 0.36, 0.145]} scale={[0.03, 0.045, 0.02]}>
            <octahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color="#e879f9" />
          </mesh>

          {/* Chibi Head + Expressive Smile */}
          <ChibiHead3D
            headY={0.71}
            headRadius={0.152}
            skinColor={skinColor}
            eyeColor={isGold ? '#451a03' : enemyEyeGlow}
            browColor="#27272a"
            isGold={isGold}
            hasRedLips
          />

          {/* Sculpted 3D Royal Purple Hijab (Kopftuch) wrapping Head & Shoulders */}
          <mesh position={[0, 0.73, -0.02]} scale={[1.08, 1.06, 1.08]} castShadow>
            <sphereGeometry args={[0.158, 20, 16]} />
            <meshStandardMaterial
              color={isGold ? (specialTheme === 'ramadan' ? '#047857' : '#6b21a8') : '#312e81'}
              roughness={0.42}
            />
          </mesh>
          {/* Hijab Neck & Shoulder Drape */}
          <mesh position={[0, 0.56, 0]} castShadow>
            <cylinderGeometry args={[0.145, 0.19, 0.14, 18]} />
            <meshStandardMaterial
              color={isGold ? (specialTheme === 'ramadan' ? '#047857' : '#6b21a8') : '#312e81'}
              roughness={0.42}
            />
          </mesh>
          {/* Golden V-Shaped Forehead Diadem / Tiara with Magenta Jewel */}
          <mesh position={[0, 0.81, 0.135]} rotation={[0.2, 0, 0]}>
            <torusGeometry args={[0.095, 0.016, 8, 16, Math.PI]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.95} roughness={0.1} />
          </mesh>
          <mesh position={[0, 0.81, 0.155]} scale={[0.028, 0.038, 0.02]}>
            <octahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color="#f472b6" />
          </mesh>

          {/* Outstretched Flared Sleeves + Twin Floating Violet Magic Orbs! */}
          {[-1, 1].map((side) => (
            <group key={`q-arm-${side}`}>
              {/* Flared Purple & Gold Sleeve */}
              <mesh
                position={[side * 0.21, 0.46, 0.05]}
                rotation={[0.3, 0, side * -0.55]}
                castShadow
              >
                <coneGeometry args={[0.068, 0.22, 12]} />
                <meshStandardMaterial
                  color={isGold ? '#7e22ce' : '#1e1b4b'}
                  roughness={0.4}
                />
              </mesh>
              {/* Floating Glowing Violet/Magenta Arcane Orb above each Hand */}
              <group position={[side * 0.31, 0.56, 0.12]}>
                <mesh>
                  <sphereGeometry args={[0.065, 14, 14]} />
                  <meshBasicMaterial
                    color={isGold ? '#e879f9' : '#f43f5e'}
                    transparent
                    opacity={0.45}
                  />
                </mesh>
                <mesh>
                  <sphereGeometry args={[0.038, 12, 12]} />
                  <meshBasicMaterial color="#ffffff" />
                </mesh>
                <mesh rotation={[Math.PI / 3, side * 0.4, 0]}>
                  <torusGeometry args={[0.082, 0.008, 8, 20]} />
                  <meshBasicMaterial color={isGold ? '#f0abfc' : '#fb7185'} />
                </mesh>
              </group>
            </group>
          ))}
        </group>
      )}

      {/* ==================== 3. TANTE BOSS ('b' – Die Tante mit cooler Sonnenbrille / Läufer) ==================== */}
      {role === 'b' && (
        <group>
          {/* Sleek Black & Gold-Trimmed Long Coat/Robe */}
          <mesh position={[0, 0.28, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.125, 0.23, 0.52, 18]} />
            <meshStandardMaterial
              color={isFrozen ? '#38bdf8' : isGold ? '#18181b' : '#2e1065'}
              roughness={0.35}
              metalness={0.25}
            />
          </mesh>
          {/* Golden V-Lapel & Front Coat Trim */}
          {[-0.04, 0.04].map((tx, idx) => (
            <mesh key={`b-trim-${idx}`} position={[tx, 0.28, 0.16]} rotation={[-0.16, 0, 0]}>
              <boxGeometry args={[0.02, 0.48, 0.015]} />
              <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.18} />
            </mesh>
          ))}
          {/* Belt + Glowing Blue Sapphire Diamond Clasp at Waist & Collar */}
          <mesh position={[0, 0.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.138, 0.02, 8, 20]} />
            <meshStandardMaterial color="#78350f" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.35, 0.15]} scale={[0.032, 0.042, 0.02]}>
            <octahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
          <mesh position={[0, 0.52, 0.14]} scale={[0.028, 0.035, 0.02]}>
            <octahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>

          {/* Chibi Head + Confident Red-Lip Smile */}
          <ChibiHead3D
            headY={0.7}
            headRadius={0.15}
            skinColor={skinColor}
            eyeColor={isGold ? '#0284c7' : enemyEyeGlow}
            browColor="#ca8a04"
            isGold={isGold}
            hasRedLips
          />

          {/* Voluminous Wavy Golden-Blonde 3D Hair cascading down Sides & Back! */}
          <group position={[0, 0.72, 0]}>
            {/* Top Blonde Hair Volume */}
            <mesh position={[0, 0.04, -0.02]} scale={[1.12, 0.98, 1.08]} castShadow>
              <sphereGeometry args={[0.158, 18, 14]} />
              <meshStandardMaterial
                color={isGold ? '#eab308' : '#7e22ce'}
                roughness={0.45}
                metalness={0.15}
              />
            </mesh>
            {/* Left & Right Wavy Blonde Curls framing her Face */}
            {[-1, 1].map((side) => (
              <group key={`b-curls-${side}`} position={[side * 0.145, -0.05, 0.02]}>
                <mesh position={[0, 0.04, 0]}>
                  <sphereGeometry args={[0.068, 12, 10]} />
                  <meshStandardMaterial color={isGold ? '#facc15' : '#9333ea'} roughness={0.45} />
                </mesh>
                <mesh position={[side * 0.015, -0.05, 0]}>
                  <sphereGeometry args={[0.062, 12, 10]} />
                  <meshStandardMaterial color={isGold ? '#eab308' : '#7e22ce'} roughness={0.45} />
                </mesh>
                <mesh position={[0, -0.13, -0.02]}>
                  <sphereGeometry args={[0.055, 10, 10]} />
                  <meshStandardMaterial color={isGold ? '#ca8a04' : '#6b21a8'} roughness={0.45} />
                </mesh>
              </group>
            ))}
          </group>

          {/* SIGNATURE COOL BLACK WAYFARER SUNGLASSES ('Coole Sonnenbrille')! */}
          <group position={[0, 0.72, 0.142]}>
            {/* Left & Right Dark Glossy Wayfarer Lenses */}
            {[-0.058, 0.058].map((gx, idx) => (
              <group key={`sunglass-lens-${idx}`} position={[gx, 0, 0]}>
                <mesh>
                  <boxGeometry args={[0.088, 0.058, 0.022]} />
                  <meshStandardMaterial
                    color="#09090b"
                    metalness={0.95}
                    roughness={0.05}
                  />
                </mesh>
                {/* Cool Diagonal White Lens Glare Reflection */}
                <mesh position={[-0.012, 0.008, 0.013]} rotation={[0, 0, -0.45]}>
                  <boxGeometry args={[0.014, 0.038, 0.004]} />
                  <meshBasicMaterial color={isGold ? '#bae6fd' : '#f43f5e'} />
                </mesh>
              </group>
            ))}
            {/* Nose Bridge Bar */}
            <mesh position={[0, 0.012, 0]}>
              <boxGeometry args={[0.04, 0.012, 0.02]} />
              <meshStandardMaterial color="#fbbf24" metalness={0.9} />
            </mesh>
          </group>

          {/* Right Hand: Tall Golden Staff topped with a Giant Glowing Blue Sapphire Crystal! */}
          <group position={[0.25, 0.48, 0.08]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.018, 0.022, 0.86, 10]} />
              <meshStandardMaterial color="#d97706" metalness={0.85} roughness={0.2} />
            </mesh>
            {/* Golden Crystal Cradle Prongs */}
            <mesh position={[0, 0.36, 0]} rotation={[0, 0, Math.PI]}>
              <coneGeometry args={[0.065, 0.1, 4]} />
              <meshStandardMaterial color="#fbbf24" metalness={0.92} />
            </mesh>
            {/* Giant Faceted Glowing Blue Sapphire Crystal */}
            <mesh position={[0, 0.48, 0]} scale={[0.085, 0.16, 0.085]}>
              <octahedronGeometry args={[1, 0]} />
              <meshStandardMaterial
                color={isGold ? '#38bdf8' : '#f43f5e'}
                emissive={isGold ? '#0284c7' : '#e11d48'}
                emissiveIntensity={0.85}
                roughness={0.1}
                metalness={0.3}
              />
            </mesh>
          </group>
        </group>
      )}

      {/* ==================== 4. PRINZESSIN MINI ('n' – Unsere Tochter mit 2 Zöpfen / Springer) ==================== */}
      {role === 'n' && (
        <group>
          {/* Shining Silver-Steel Armored Boots */}
          {[-0.07, 0.07].map((lx, idx) => (
            <mesh key={`n-leg-${idx}`} position={[lx, 0.12, 0]} castShadow>
              <cylinderGeometry args={[0.046, 0.052, 0.22, 12]} />
              <meshStandardMaterial
                color={isGold ? '#cbd5e1' : '#312e81'}
                metalness={0.85}
                roughness={0.2}
              />
            </mesh>
          ))}

          {/* Plated Silver Knight Skirt & Breastplate */}
          <mesh position={[0, 0.34, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.135, 0.175, 0.32, 16]} />
            <meshStandardMaterial
              color={isFrozen ? '#38bdf8' : isGold ? '#e2e8f0' : '#1e1b4b'}
              metalness={0.85}
              roughness={0.18}
            />
          </mesh>

          {/* Fluttering Bright Red Adventurer Cape */}
          <mesh position={[0, 0.32, -0.14]} rotation={[0.25, 0, 0]} castShadow>
            <boxGeometry args={[0.32, 0.44, 0.035]} />
            <meshStandardMaterial
              color={isGold ? '#ef4444' : '#4c1d95'}
              roughness={0.5}
            />
          </mesh>

          {/* Rounded Silver Knight Shoulder Pauldrons */}
          {[-0.17, 0.17].map((sx, idx) => (
            <mesh key={`n-pauldron-${idx}`} position={[sx, 0.45, 0]} castShadow>
              <sphereGeometry args={[0.068, 12, 10]} />
              <meshStandardMaterial color={isGold ? '#e2e8f0' : '#4c1d95'} metalness={0.85} />
            </mesh>
          ))}

          {/* Cute Cheerful Child Chibi Head with Rosy Cheeks & Big Sparkling Brown Eyes */}
          <ChibiHead3D
            headY={0.66}
            headRadius={0.158}
            skinColor={skinColor}
            eyeColor={isGold ? '#451a03' : enemyEyeGlow}
            browColor="#5c3a21"
            isGold={isGold}
            hasRosyCheeks
          />

          {/* Warm Brown Hair + TWO BOUNCY 3D PIGTAILS ('Zwei süße Zöpfe') with Red Hair Ties! */}
          <group position={[0, 0.68, 0]}>
            {/* Top Brown Hair & Side Bangs */}
            <mesh position={[0, 0.03, -0.015]} scale={[1.05, 0.95, 1.04]} castShadow>
              <sphereGeometry args={[0.16, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
              <meshStandardMaterial color="#5c3a21" roughness={0.65} />
            </mesh>
            {/* Left & Right Pigtails with Red Hair-Tie Rings */}
            {[-1, 1].map((side) => (
              <group key={`pigtail-${side}`} position={[side * 0.17, 0.04, -0.01]}>
                {/* Bright Red Hair Tie */}
                <mesh rotation={[0, Math.PI / 2, 0]}>
                  <torusGeometry args={[0.032, 0.014, 8, 14]} />
                  <meshBasicMaterial color="#ef4444" />
                </mesh>
                {/* Bouncy Curved Brown Pigtail */}
                <mesh
                  position={[side * 0.065, -0.03, 0]}
                  rotation={[0, 0, side * -0.65]}
                  scale={[0.85, 1.45, 0.85]}
                  castShadow
                >
                  <sphereGeometry args={[0.062, 12, 10]} />
                  <meshStandardMaterial color="#5c3a21" roughness={0.65} />
                </mesh>
              </group>
            ))}
          </group>

          {/* Raised Right Arm holding her Sparkling Silver Star-Rapier ('Funkelnder Sternen-Degen')! */}
          <group position={[0.21, 0.48, 0.08]} rotation={[0.15, 0, -0.28]}>
            {/* Silver Bell Guard */}
            <mesh position={[0, 0.04, 0]}>
              <sphereGeometry args={[0.055, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
              <meshStandardMaterial color="#f8fafc" metalness={0.95} roughness={0.1} />
            </mesh>
            {/* Slender Shining Rapier Blade */}
            <mesh position={[0, 0.3, 0]} castShadow>
              <cylinderGeometry args={[0.008, 0.022, 0.5, 8]} />
              <meshStandardMaterial
                color="#ffffff"
                emissive={isGold ? '#fef08a' : '#f43f5e'}
                emissiveIntensity={0.5}
                metalness={0.98}
                roughness={0.05}
              />
            </mesh>
            {/* Golden 3D Starburst Sparkle at the Blade Tip! */}
            <mesh position={[0, 0.54, 0]} scale={[0.055, 0.055, 0.055]}>
              <octahedronGeometry args={[1, 0]} />
              <meshBasicMaterial color="#fde047" />
            </mesh>
          </group>
        </group>
      )}

      {/* ==================== 5. COUSIN TANK ('r' – Der Cousin mit Zinnen-Schultern & Panzerfäusten / Turm) ==================== */}
      {role === 'r' && (
        <group>
          {/* Heavy Gunmetal Fortress Boots & Legs in Wide Power Stance */}
          {[-0.1, 0.1].map((lx, idx) => (
            <mesh key={`r-leg-${idx}`} position={[lx, 0.14, 0]} castShadow>
              <boxGeometry args={[0.11, 0.26, 0.12]} />
              <meshStandardMaterial
                color={isGold ? '#27272a' : '#1e1b4b'}
                metalness={0.8}
                roughness={0.28}
              />
            </mesh>
          ))}

          {/* Extra-Wide Muscular Dark Steel Fortress Chestplate */}
          <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.22, 0.17, 0.34, 12]} />
            <meshStandardMaterial
              color={isFrozen ? '#38bdf8' : isGold ? '#3f3f46' : '#1e1b4b'}
              metalness={0.82}
              roughness={0.26}
            />
          </mesh>
          {/* Heavy Leather Belt & Bronze Buckle */}
          <mesh position={[0, 0.28, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.175, 0.028, 8, 16]} />
            <meshStandardMaterial color="#78350f" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.28, 0.18]}>
            <boxGeometry args={[0.075, 0.058, 0.025]} />
            <meshStandardMaterial color="#d97706" metalness={0.88} />
          </mesh>

          {/* TWO MASSIVE CASTLE-TURRET SHOULDER PAULDRONS WITH REAL 3D BATTLEMENTS ('Zinnen-Schultern')! */}
          {[-1, 1].map((side) => (
            <group key={`r-turret-${side}`} position={[side * 0.26, 0.54, 0]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.11, 0.1, 0.16, 12]} />
                <meshStandardMaterial
                  color={isGold ? '#3f3f46' : '#312e81'}
                  metalness={0.82}
                  roughness={0.25}
                />
              </mesh>
              {/* 4 Castle Battlement Merlons on Top of each Shoulder Turret */}
              {[0, 1, 2, 3].map((mIdx) => {
                const a = (mIdx * Math.PI) / 2 + Math.PI / 4;
                return (
                  <mesh
                    key={`r-merlon-${mIdx}`}
                    position={[Math.cos(a) * 0.075, 0.1, Math.sin(a) * 0.075]}
                  >
                    <boxGeometry args={[0.045, 0.055, 0.045]} />
                    <meshStandardMaterial
                      color={isGold ? '#52525b' : '#4c1d95'}
                      metalness={0.85}
                    />
                  </mesh>
                );
              })}
            </group>
          ))}

          {/* Chibi Head + Short Dark Hair + Full Beard + BIG BEAMING WHITE GRIN! */}
          <ChibiHead3D
            headY={0.73}
            headRadius={0.155}
            skinColor={skinColor}
            eyeColor={isGold ? '#27272a' : enemyEyeGlow}
            browColor="#18181b"
            isGold={isGold}
            hasBigToothGrin
          />
          {/* Short Cropped Dark Hair */}
          <mesh position={[0, 0.78, -0.01]} scale={[1.02, 0.88, 1.02]}>
            <sphereGeometry args={[0.156, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
            <meshStandardMaterial color="#18181b" roughness={0.8} />
          </mesh>
          {/* Short Dark Jaw Beard framing his Big White Smile */}
          <mesh position={[0, 0.67, 0.045]} scale={[0.98, 0.62, 0.86]}>
            <sphereGeometry args={[0.15, 16, 12]} />
            <meshStandardMaterial color="#18181b" roughness={0.85} />
          </mesh>

          {/* TWO GIGANTIC TITAN CRUSHER GAUNTLET FISTS ('Titanen-Panzerfäuste')! */}
          {[-1, 1].map((side) => (
            <group
              key={`r-fist-${side}`}
              position={[side * 0.31, 0.31, 0.08]}
              rotation={[0.25, 0, side * -0.15]}
            >
              {/* Crenellated Forearm Cuff */}
              <mesh position={[0, 0.09, 0]} castShadow>
                <cylinderGeometry args={[0.075, 0.085, 0.14, 10]} />
                <meshStandardMaterial color={isGold ? '#3f3f46' : '#312e81'} metalness={0.85} />
              </mesh>
              {/* Giant Armored Crusher Fist */}
              <mesh position={[0, -0.02, 0.02]} castShadow>
                <boxGeometry args={[0.15, 0.15, 0.16]} />
                <meshStandardMaterial
                  color={isGold ? '#27272a' : '#4c1d95'}
                  emissive={isGold ? '#10b981' : '#f43f5e'}
                  emissiveIntensity={0.2}
                  metalness={0.88}
                  roughness={0.22}
                />
              </mesh>
            </group>
          ))}
        </group>
      )}

      {/* ==================== 6. BEIDE COUSINEN ('p' – 2 Skins: Cousine Dolch & Cousine Rune!) ==================== */}
      {role === 'p' && !useSecondarySkin && (
        /* SKIN 1: COUSINE DOLCH (Waldläuferin mit grüner Kapuze, dunklem lockigem Haar & Zwillings-Runendolchen) */
        <group>
          {/* Brown Leather Ranger Boots */}
          {[-0.07, 0.07].map((lx, idx) => (
            <mesh key={`p1-leg-${idx}`} position={[lx, 0.12, 0]} castShadow>
              <cylinderGeometry args={[0.045, 0.05, 0.22, 10]} />
              <meshStandardMaterial color="#78350f" roughness={0.65} />
            </mesh>
          ))}

          {/* Forest-Green Ranger Tunic & Crossed Leather Straps */}
          <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.125, 0.165, 0.32, 16]} />
            <meshStandardMaterial
              color={isFrozen ? '#38bdf8' : isGold ? '#166534' : '#1e1b4b'}
              roughness={0.5}
            />
          </mesh>
          {/* Flowing Forest Cloak */}
          <mesh position={[0, 0.34, -0.13]} rotation={[0.22, 0, 0]} castShadow>
            <boxGeometry args={[0.3, 0.44, 0.035]} />
            <meshStandardMaterial color={isGold ? '#14532d' : '#312e81'} roughness={0.6} />
          </mesh>

          {/* Chibi Head + Dark Wavy Hair Locks + Pointed Forest-Green Ranger Hood */}
          <ChibiHead3D
            headY={0.65}
            headRadius={0.148}
            skinColor={skinColor}
            eyeColor={isGold ? '#15803d' : enemyEyeGlow}
            browColor="#1c1917"
            isGold={isGold}
            hasRedLips
          />
          {/* Long Dark Brown/Black Wavy Hair Locks framing her Shoulders */}
          {[-0.13, 0.13].map((hx, idx) => (
            <mesh key={`p1-hair-${idx}`} position={[hx, 0.56, 0.03]} scale={[0.8, 1.35, 0.8]}>
              <sphereGeometry args={[0.058, 10, 10]} />
              <meshStandardMaterial color="#1c1917" roughness={0.7} />
            </mesh>
          ))}
          {/* Sculpted 3D Forest-Green Ranger Hood over Head */}
          <mesh position={[0, 0.69, -0.02]} scale={[1.1, 1.08, 1.1]} castShadow>
            <sphereGeometry args={[0.155, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.68]} />
            <meshStandardMaterial color={isGold ? '#15803d' : '#3b0764'} roughness={0.55} />
          </mesh>
          {/* Pointed Hood Peak at Back */}
          <mesh position={[0, 0.78, -0.1]} rotation={[-0.6, 0, 0]}>
            <coneGeometry args={[0.08, 0.14, 8]} />
            <meshStandardMaterial color={isGold ? '#15803d' : '#3b0764'} roughness={0.55} />
          </mesh>

          {/* TWIN GLOWING CYAN RUNIC DAGGERS ('Zwillings-Runendolche') in Left & Right Hands! */}
          {[-1, 1].map((side) => (
            <group
              key={`p1-dagger-${side}`}
              position={[side * 0.23, 0.34, 0.12]}
              rotation={[0.4, 0, side * -0.65]}
            >
              <mesh>
                <boxGeometry args={[0.06, 0.02, 0.025]} />
                <meshStandardMaterial color="#d97706" metalness={0.85} />
              </mesh>
              <mesh position={[0, 0.11, 0]}>
                <coneGeometry args={[0.024, 0.2, 4]} />
                <meshBasicMaterial color={isGold ? '#38bdf8' : '#f43f5e'} />
              </mesh>
            </group>
          ))}
        </group>
      )}

      {role === 'p' && useSecondarySkin && (
        /* SKIN 2: COUSINE RUNE (Schwarzes Kopftuch mit Silberborte, echtes Hahnentritt-Gewand & leuchtender lila Arkan-Bogen!) */
        <group>
          {/* Inner Skirt & Sleeves with Authentic Black-and-White HOUNDSTOOTH (Hahnentritt) Texture! */}
          <mesh position={[0, 0.26, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.115, 0.21, 0.48, 20]} />
            <meshStandardMaterial
              color={isFrozen ? '#38bdf8' : isGold ? '#ffffff' : '#4c1d95'}
              map={isGold ? houndstoothTex : null}
              roughness={0.45}
            />
          </mesh>
          {/* Tailored Black Leather Open Coat/Vest Panels on Left & Right with Silver Clasps */}
          {[-0.085, 0.085].map((cx, idx) => (
            <mesh key={`p2-coat-${idx}`} position={[cx, 0.3, 0.02]} castShadow>
              <cylinderGeometry
                args={[0.075, 0.11, 0.42, 12, 1, false, idx === 0 ? Math.PI : 0, Math.PI]}
              />
              <meshStandardMaterial color="#18181b" roughness={0.35} metalness={0.2} />
            </mesh>
          ))}
          {/* Silver Chest Clasps */}
          {[0.4, 0.46].map((cy, idx) => (
            <mesh key={`p2-clasp-${idx}`} position={[0, cy, 0.13]}>
              <boxGeometry args={[0.065, 0.016, 0.015]} />
              <meshStandardMaterial color="#e2e8f0" metalness={0.9} />
            </mesh>
          ))}

          {/* Houndstooth (Hahnentritt) Sleeves */}
          {[-1, 1].map((side) => (
            <mesh
              key={`p2-sleeve-${side}`}
              position={[side * 0.18, 0.41, 0.04]}
              rotation={[0.35, 0, side * -0.25]}
            >
              <cylinderGeometry args={[0.038, 0.044, 0.2, 10]} />
              <meshStandardMaterial
                color={isGold ? '#ffffff' : '#312e81'}
                map={isGold ? houndstoothTex : null}
                roughness={0.45}
              />
            </mesh>
          ))}

          {/* Chibi Head + Sleek Black Hijab with Silver Forehead Embroidery */}
          <ChibiHead3D
            headY={0.66}
            headRadius={0.148}
            skinColor={skinColor}
            eyeColor={isGold ? '#451a03' : enemyEyeGlow}
            browColor="#18181b"
            isGold={isGold}
            hasRedLips
          />
          {/* Sculpted 3D Sleek Black Hijab */}
          <mesh position={[0, 0.68, -0.018]} scale={[1.07, 1.05, 1.07]} castShadow>
            <sphereGeometry args={[0.152, 20, 16]} />
            <meshStandardMaterial color="#18181b" roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.52, 0]}>
            <cylinderGeometry args={[0.135, 0.17, 0.11, 16]} />
            <meshStandardMaterial color="#18181b" roughness={0.4} />
          </mesh>
          {/* Silver Forehead Trim on Hijab */}
          <mesh position={[0, 0.75, 0.13]} rotation={[0.2, 0, 0]}>
            <torusGeometry args={[0.09, 0.012, 8, 16, Math.PI]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.15} />
          </mesh>

          {/* GLOWING PURPLE ARCANE RECURVE BOW & CRYSTAL ARROW ('Arkan-Bogen')! */}
          <group position={[0.02, 0.36, 0.18]} rotation={[0.15, 0, -0.35]}>
            {/* Silver & Violet Recurve Bow Arc */}
            <mesh rotation={[0, 0, -Math.PI / 2]}>
              <torusGeometry args={[0.22, 0.02, 10, 24, Math.PI]} />
              <meshStandardMaterial
                color="#cbd5e1"
                emissive="#a855f7"
                emissiveIntensity={0.6}
                metalness={0.88}
                roughness={0.15}
              />
            </mesh>
            {/* Glowing Violet Bowstring */}
            <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.004, 0.004, 0.44, 6]} />
              <meshBasicMaterial color="#e879f9" />
            </mesh>
            {/* Nocked Glowing Violet Crystal Arrow */}
            <mesh position={[0, 0.12, 0.02]}>
              <cylinderGeometry args={[0.006, 0.006, 0.32, 6]} />
              <meshBasicMaterial color="#f0abfc" />
            </mesh>
            <mesh position={[0, 0.29, 0.02]} scale={[0.032, 0.065, 0.02]}>
              <octahedronGeometry args={[1, 0]} />
              <meshBasicMaterial color="#e879f9" />
            </mesh>
          </group>
        </group>
      )}

      {/* ==================== WORLD-THEME COSTUME BADGE / AURA ACCENT ==================== */}
      {/* Ramadan Golden Crescent Badge above/on Figure or Halloween Mini Jack-o'-Lantern Charm */}
      {specialTheme === 'ramadan' && (
        <group position={[0, 0.52, 0.17]}>
          <mesh rotation={[0, 0, Math.PI / 4]}>
            <torusGeometry args={[0.032, 0.008, 8, 16, Math.PI * 1.4]} />
            <meshBasicMaterial color="#fde047" />
          </mesh>
        </group>
      )}
      {specialTheme === 'halloween' && (
        <group position={[-0.18, 0.28, 0.15]}>
          <mesh>
            <sphereGeometry args={[0.042, 10, 10]} />
            <meshStandardMaterial
              color="#f97316"
              emissive="#ea580c"
              emissiveIntensity={0.65}
            />
          </mesh>
        </group>
      )}
      {/* Enemy Team ('b') Spiked Shadow-Clone Shoulder Horns so Opponent is 100% Unmistakable! */}
      {!isGold && (
        <group position={[0, 0.54, 0]}>
          <mesh position={[-0.22, 0.06, -0.02]} rotation={[0, 0, 0.55]}>
            <coneGeometry args={[0.042, 0.15, 6]} />
            <meshBasicMaterial color={enemyEyeGlow} />
          </mesh>
          <mesh position={[0.22, 0.06, -0.02]} rotation={[0, 0, -0.55]}>
            <coneGeometry args={[0.042, 0.15, 6]} />
            <meshBasicMaterial color={enemyEyeGlow} />
          </mesh>
        </group>
      )}
    </group>
  );
};

export const FamilyHeroPiece3D: React.FC<FamilyHeroPieceProps> = ({
  role,
  color,
  levelId = 1,
  specialTheme = 'default',
  targetPosition,
  fromPosition = null,
  heroConfig,
  useSecondarySkin = false,
  isSelected,
  hasActiveSelection = false,
  isCheckThreatened,
  isShielded = false,
  isFrozen = false,
  isLastMoved,
  isAttacking = false,
  isPromoted = false,
  isCelebrating = false,
  showNameplate,
  onSelect,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const hitboxMeshRef = useRef<THREE.Mesh>(null);
  const figureRef = useRef<THREE.Group>(null);
  const auraRingRef = useRef<THREE.Mesh>(null);
  const compassOuterRef = useRef<THREE.Group>(null);
  const compassInnerRef = useRef<THREE.Mesh>(null);
  const ghost1Ref = useRef<THREE.Group>(null);
  const ghost2Ref = useRef<THREE.Group>(null);
  const shieldDomeRef = useRef<THREE.Mesh>(null);
  const landingRingRef = useRef<THREE.Mesh>(null);
  const checkAlarmRingRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const startPos = useRef(
    new THREE.Vector3(
      ...(fromPosition && isLastMoved ? fromPosition : targetPosition)
    )
  );
  const currentPos = useRef(
    new THREE.Vector3(
      ...(fromPosition && isLastMoved ? fromPosition : targetPosition)
    )
  );
  const prevTarget = useRef(new THREE.Vector3(...targetPosition));
  const jumpProgress = useRef(fromPosition && isLastMoved ? 0 : 1);
  const landingDustAlpha = useRef(0);
  const hasTriggeredLandingDust = useRef(!(fromPosition && isLastMoved));
  const promotionSpin = useRef(isPromoted ? Math.PI * 4 : 0);
  const selectBounce = useRef(0);
  const [showActionBubble, setShowActionBubble] = useState<boolean>(
    Boolean(fromPosition && isLastMoved)
  );

  useEffect(() => {
    if (isLastMoved && fromPosition) {
      setShowActionBubble(true);
      const timer = setTimeout(() => setShowActionBubble(false), 2100);
      return () => clearTimeout(timer);
    } else {
      setShowActionBubble(false);
    }
  }, [isLastMoved, fromPosition]);

  useEffect(() => {
    if (isSelected) {
      selectBounce.current = 1;
    }
  }, [isSelected]);

  const displayName =
    useSecondarySkin && heroConfig.secondaryCustomName
      ? heroConfig.secondaryCustomName
      : heroConfig.customName;

  const isGoldTeam = color === 'w';
  const primaryTeamColor = isGoldTeam
    ? specialTheme === 'ramadan'
      ? '#fde047'
      : '#fbbf24'
    : specialTheme === 'halloween'
    ? '#f97316'
    : levelId === 3
    ? '#ef4444'
    : '#a855f7';
  const secondaryTeamColor = isGoldTeam ? '#fef3c7' : '#e9d5ff';

  // Theme-adapted & Team-distinct Pedestal Palette
  const stoneSlabDark = isGoldTeam
    ? specialTheme === 'ramadan'
      ? '#064e3b'
      : specialTheme === 'halloween'
      ? '#451a03'
      : levelId === 2
      ? '#0c4a6e'
      : levelId === 3
      ? '#7c2d12'
      : '#785c38'
    : specialTheme === 'ramadan'
    ? '#1e1b4b'
    : specialTheme === 'halloween'
    ? '#1f122b'
    : levelId === 3
    ? '#2a0808'
    : '#1b112c';

  const stoneSlabMid = isGoldTeam
    ? specialTheme === 'ramadan'
      ? '#047857'
      : specialTheme === 'halloween'
      ? '#78350f'
      : levelId === 2
      ? '#0284c7'
      : levelId === 3
      ? '#b45309'
      : '#b48a54'
    : specialTheme === 'ramadan'
    ? '#312e81'
    : specialTheme === 'halloween'
    ? '#3b0764'
    : levelId === 3
    ? '#450a0a'
    : '#2e1a47';

  const stoneSlabLight = isGoldTeam
    ? specialTheme === 'ramadan'
      ? '#10b981'
      : specialTheme === 'halloween'
      ? '#d97706'
      : levelId === 2
      ? '#38bdf8'
      : levelId === 3
      ? '#f59e0b'
      : '#fde68a'
    : specialTheme === 'ramadan'
    ? '#4c1d95'
    : specialTheme === 'halloween'
    ? '#581c87'
    : levelId === 3
    ? '#7f1d1d'
    : '#4c1d95';

  const reliefBodyColor = isGoldTeam
    ? specialTheme === 'ramadan'
      ? '#f59e0b'
      : '#eab308'
    : specialTheme === 'halloween'
    ? '#6b21a8'
    : levelId === 3
    ? '#991b1b'
    : '#581c87';

  const baseScale = ROLE_HEIGHT_SCALE[role] || 1.15;
  const bodyHeight = ROLE_PEDESTAL_HEIGHT[role] || 0.14;
  const capY = 0.08 + bodyHeight + 0.025;
  const topY = capY + 0.025;

  // Deterministic rugged rock chunks around the hero's feet
  const rockChunks = useMemo(() => {
    const count = 8;
    const chunks: {
      angle: number;
      dist: number;
      sx: number;
      sy: number;
      sz: number;
      rotY: number;
      rotZ: number;
      shade: string;
    }[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (i * Math.PI * 2) / count + (i % 2 === 0 ? 0.12 : -0.08);
      const dist = 0.24 + (i % 3) * 0.03;
      const sx = 0.1 + (i % 2) * 0.03;
      const sy = 0.07 + ((i + 1) % 3) * 0.024;
      const sz = 0.09 + (i % 3) * 0.02;
      chunks.push({
        angle,
        dist,
        sx,
        sy,
        sz,
        rotY: angle + 0.4,
        rotZ: (i % 2 === 0 ? 1 : -1) * 0.18,
        shade: i % 2 === 0 ? stoneSlabMid : stoneSlabLight,
      });
    }
    return chunks;
  }, [stoneSlabMid, stoneSlabLight]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const targetVec = new THREE.Vector3(...targetPosition);
    if (prevTarget.current.distanceTo(targetVec) > 0.05) {
      startPos.current.copy(currentPos.current);
      prevTarget.current.copy(targetVec);
      jumpProgress.current = 0;
      hasTriggeredLandingDust.current = false;
    }

    if (jumpProgress.current < 1) {
      jumpProgress.current = Math.min(1, jumpProgress.current + delta * 2.35);
      const t = jumpProgress.current;
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      currentPos.current.lerpVectors(startPos.current, targetVec, eased);

      if (jumpProgress.current >= 0.94 && !hasTriggeredLandingDust.current) {
        hasTriggeredLandingDust.current = true;
        landingDustAlpha.current = 1;
      }
    } else {
      currentPos.current.lerp(targetVec, Math.min(1, delta * 12));
    }

    // 1. Parabolic hop arc (extra high flip arc for Daughter / Knight + attacking lunge!)
    const arcMultiplier = role === 'n' ? 1.55 : isAttacking ? 1.05 : 0.72;
    const hopHeight = Math.sin(jumpProgress.current * Math.PI) * arcMultiplier;

    // 2. Selected hover lift (modest so it never blocks the tile behind it!)
    const selectedLift = isSelected
      ? 0.14 + Math.sin(state.clock.elapsedTime * 5) * 0.035
      : 0;

    // 3. Victory Dance Bounce at the end of a won game
    const celebrationBounce = isCelebrating
      ? Math.abs(Math.sin(state.clock.elapsedTime * 7.5 + targetPosition[0])) *
        0.38
      : 0;

    // 4. King in Check tremble shake
    const checkShakeX = isCheckThreatened
      ? Math.sin(state.clock.elapsedTime * 36) * 0.045
      : 0;
    const checkShakeZ = isCheckThreatened
      ? Math.cos(state.clock.elapsedTime * 32) * 0.045
      : 0;

    groupRef.current.position.set(
      currentPos.current.x + checkShakeX,
      currentPos.current.y + hopHeight + selectedLift + celebrationBounce,
      currentPos.current.z + checkShakeZ
    );

    // Slight forward tilt during hop/attack
    const hopTilt =
      jumpProgress.current < 1
        ? Math.sin(jumpProgress.current * Math.PI) *
          (isAttacking ? 0.28 : 0.14) *
          (color === 'w' ? -1 : 1)
        : 0;
    groupRef.current.rotation.x = hopTilt;

    // Promotion coronation spin OR Knight mid-air 360 pirouette
    if (promotionSpin.current > 0) {
      promotionSpin.current = Math.max(0, promotionSpin.current - delta * 8);
      groupRef.current.rotation.y = promotionSpin.current;
    } else if (role === 'n' && jumpProgress.current < 1) {
      groupRef.current.rotation.y = jumpProgress.current * Math.PI * 2;
    } else if (isCelebrating) {
      groupRef.current.rotation.y =
        Math.sin(state.clock.elapsedTime * 4 + targetPosition[2]) * 0.25;
    } else {
      groupRef.current.rotation.y = 0;
    }

    // Landing dust shockwave ring expansion
    if (landingRingRef.current && landingDustAlpha.current > 0) {
      landingDustAlpha.current = Math.max(
        0,
        landingDustAlpha.current - delta * 1.6
      );
      const scale = 1 + (1 - landingDustAlpha.current) * 1.9;
      landingRingRef.current.scale.set(scale, scale, 1);
      const mat = landingRingRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = landingDustAlpha.current * 0.85;
    }

    // Pulsing red check alarm ring
    if (checkAlarmRingRef.current && isCheckThreatened) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 10) * 0.22;
      checkAlarmRingRef.current.scale.set(pulse, pulse, 1);
    }

    if (figureRef.current) {
      const t =
        state.clock.elapsedTime +
        targetPosition[0] * 0.7 +
        targetPosition[2] * 0.5;
      const breath = isFrozen
        ? 1
        : isCelebrating
        ? 1 + Math.sin(t * 8) * 0.08
        : 1 + Math.sin(t * 2.6) * 0.022;

      if (selectBounce.current > 0) {
        selectBounce.current = Math.max(0, selectBounce.current - delta * 3.5);
      }
      const hopStretch =
        jumpProgress.current < 1
          ? Math.sin(jumpProgress.current * Math.PI) * 0.15
          : 0;
      const landingSquash =
        landingDustAlpha.current > 0.65
          ? -Math.sin(((landingDustAlpha.current - 0.65) / 0.35) * Math.PI) *
            0.13
          : 0;
      const selectPop =
        selectBounce.current > 0
          ? Math.sin(selectBounce.current * Math.PI * 2) * 0.1
          : 0;

      const stretchFactor = 1 + hopStretch + landingSquash + selectPop;
      const squashFactor = 1 - (hopStretch + landingSquash + selectPop) * 0.5;

      figureRef.current.scale.set(
        baseScale * squashFactor,
        baseScale * breath * stretchFactor,
        baseScale * squashFactor
      );
    }

    if (auraRingRef.current) {
      auraRingRef.current.rotation.z += delta * (isSelected ? 2.4 : 0.8);
    }

    if (compassOuterRef.current && isSelected) {
      compassOuterRef.current.rotation.y += delta * 1.65;
    }
    if (compassInnerRef.current && isSelected) {
      compassInnerRef.current.rotation.z -= delta * 2.4;
    }

    // Afterimage 3D Ghost Motion-Trail during leap/dash across the board
    const isMovingNow = jumpProgress.current < 0.98;
    if (ghost1Ref.current && ghost2Ref.current) {
      ghost1Ref.current.visible = isMovingNow;
      ghost2Ref.current.visible = isMovingNow;
      if (isMovingNow) {
        const dx = startPos.current.x - currentPos.current.x;
        const dz = startPos.current.z - currentPos.current.z;
        ghost1Ref.current.position.set(
          dx * 0.22,
          topY - hopHeight * 0.22,
          dz * 0.22
        );
        ghost2Ref.current.position.set(
          dx * 0.44,
          topY - hopHeight * 0.45,
          dz * 0.44
        );
      }
    }

    if (shieldDomeRef.current) {
      shieldDomeRef.current.rotation.y += delta * 1.4;
    }
  });

  // Make ALL visual/decorative 3D meshes (head, hair, crown, sword, bow, cape, pedestal, sparkles)
  // 100% raycast-transparent (`() => null`) so a tall 3D figure NEVER blocks clicks to the square behind it!
  const noOpRaycast = useMemo(() => () => null, []);

  useEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.traverse((obj) => {
      if (obj !== hitboxMeshRef.current && (obj as THREE.Mesh).isMesh) {
        obj.raycast = noOpRaycast;
      }
    });
  }, [role, useSecondarySkin, isSelected, hasActiveSelection, isShielded, isFrozen, noOpRaycast]);

  return (
    <group ref={groupRef}>
      {/* Dedicated Piece Hitbox Cylinder:
          - Active ONLY when NO piece is currently selected (`!hasActiveSelection`) so clicking any figure is effortless!
          - When a piece IS selected (`hasActiveSelection === true`), this cylinder turns off so ALL 64 board squares
            (`DungeonStoneTile3D` 0.99x0.99 full-tile hitboxes) are 100% unobstructed even right behind a tall figure! */}
      {!hasActiveSelection && (
        <mesh
          ref={hitboxMeshRef}
          position={[0, 0.28, 0]}
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(true);
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            setHovered(false);
            document.body.style.cursor = 'auto';
          }}
        >
          <cylinderGeometry args={[0.42, 0.44, 0.54, 16]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      {/* 1. Bold Team Identification Floor Aura (Bright Sun-Gold for Player vs. Dark Shadow-Purple for Enemy!) */}
      <mesh
        position={[0, 0.012, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        raycast={noOpRaycast}
      >
        <ringGeometry args={[0.34, 0.45, 32]} />
        <meshBasicMaterial
          color={primaryTeamColor}
          side={THREE.DoubleSide}
          transparent
          opacity={isSelected ? 1 : hovered ? 0.92 : 0.8}
        />
      </mesh>

      {/* Baldur's Gate 3 Style Counter-Rotating 3D Tactical Rune Compass when Selected */}
      {isSelected && (
        <group position={[0, 0.024, 0]}>
          <group ref={compassOuterRef}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={noOpRaycast}>
              <ringGeometry args={[0.42, 0.48, 8]} />
              <meshBasicMaterial
                color={primaryTeamColor}
                side={THREE.DoubleSide}
                transparent
                opacity={0.92}
              />
            </mesh>
            {[0, 1, 2, 3].map((dirIdx) => {
              const a = (dirIdx * Math.PI) / 2;
              return (
                <mesh
                  key={`compass-pt-${dirIdx}`}
                  position={[Math.cos(a) * 0.5, 0.01, Math.sin(a) * 0.5]}
                  rotation={[0, -a, 0]}
                  scale={[0.06, 0.03, 0.1]}
                  raycast={noOpRaycast}
                >
                  <octahedronGeometry args={[1, 0]} />
                  <meshBasicMaterial color="#ffffff" />
                </mesh>
              );
            })}
          </group>
          <mesh
            ref={compassInnerRef}
            rotation={[-Math.PI / 2, 0, 0]}
            raycast={noOpRaycast}
          >
            <ringGeometry args={[0.31, 0.36, 6]} />
            <meshBasicMaterial
              color="#ffffff"
              side={THREE.DoubleSide}
              transparent
              opacity={0.85}
            />
          </mesh>
          <Sparkles
            count={16}
            scale={[0.8, 1.0, 0.8]}
            position={[0, 0.5, 0]}
            size={4}
            speed={1.8}
            color={primaryTeamColor}
          />
        </group>
      )}

      {/* 2. Stepped Ornate Square Carved Stone & Gold/Purple-Relief Pedestal */}
      <mesh
        castShadow
        receiveShadow
        position={[0, 0.04, 0]}
        raycast={isSelected ? noOpRaycast : undefined}
      >
        <boxGeometry args={[0.7, 0.08, 0.7]} />
        <meshStandardMaterial
          color={stoneSlabDark}
          roughness={0.85}
          metalness={0.15}
        />
      </mesh>

      <mesh
        castShadow
        receiveShadow
        position={[0, 0.08 + bodyHeight / 2, 0]}
        raycast={isSelected ? noOpRaycast : undefined}
      >
        <boxGeometry args={[0.58, bodyHeight, 0.58]} />
        <meshStandardMaterial
          color={reliefBodyColor}
          roughness={0.35}
          metalness={0.78}
          emissive={isSelected || hovered ? primaryTeamColor : '#000000'}
          emissiveIntensity={isSelected ? 0.55 : hovered ? 0.3 : 0.06}
        />
      </mesh>

      {/* 4 Glowing Rune Gems Embedded on the 4 Sides of the Square Pedestal */}
      {[
        [0, 0.08 + bodyHeight / 2, 0.3],
        [0, 0.08 + bodyHeight / 2, -0.3],
        [0.3, 0.08 + bodyHeight / 2, 0],
        [-0.3, 0.08 + bodyHeight / 2, 0],
      ].map((gPos, gIdx) => (
        <mesh
          key={`gem-${gIdx}`}
          position={gPos as [number, number, number]}
          scale={[0.055, 0.075, 0.055]}
          raycast={noOpRaycast}
        >
          <octahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color={isGoldTeam ? '#38bdf8' : '#f43f5e'}
            emissive={isGoldTeam ? '#0284c7' : '#e11d48'}
            emissiveIntensity={1.3}
          />
        </mesh>
      ))}

      {/* Upper Chiseled Stone Cap Slab */}
      <mesh
        castShadow
        receiveShadow
        position={[0, capY, 0]}
        raycast={isSelected ? noOpRaycast : undefined}
      >
        <boxGeometry args={[0.64, 0.045, 0.64]} />
        <meshStandardMaterial
          color={stoneSlabLight}
          roughness={0.78}
          metalness={0.18}
        />
      </mesh>

      {/* Rugged 3D Boulders & Theme-Specific Pedestal Regalia */}
      <group position={[0, topY, 0]}>
        {rockChunks.map((rc, idx) => (
          <mesh
            key={idx}
            position={[
              Math.cos(rc.angle) * (rc.dist * 0.85),
              0.01,
              Math.sin(rc.angle) * (rc.dist * 0.85),
            ]}
            rotation={[0.1, rc.rotY, rc.rotZ]}
            scale={[rc.sx * 0.85, rc.sy * 0.85, rc.sz * 0.85]}
            castShadow
            receiveShadow
            raycast={noOpRaycast}
          >
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial
              color={rc.shade}
              roughness={0.94}
              metalness={0.06}
              flatShading
            />
          </mesh>
        ))}

        {specialTheme === 'ramadan' && (
          <group>
            {[-0.25, 0.25].map((lx, lIdx) => (
              <group key={`fanous-${lIdx}`} position={[lx, 0.07, 0.24]}>
                <mesh raycast={noOpRaycast}>
                  <cylinderGeometry args={[0.036, 0.045, 0.1, 6]} />
                  <meshStandardMaterial
                    color="#fbbf24"
                    emissive={isGoldTeam ? '#f59e0b' : '#a855f7'}
                    emissiveIntensity={1.4}
                    metalness={0.8}
                  />
                </mesh>
              </group>
            ))}
          </group>
        )}

        {specialTheme === 'halloween' && (
          <group>
            {[-0.25, 0.25].map((px, pIdx) => (
              <group key={`pumpkin-${pIdx}`} position={[px, 0.055, 0.24]}>
                <mesh scale={[1, 0.82, 1]} raycast={noOpRaycast}>
                  <sphereGeometry args={[0.06, 10, 8]} />
                  <meshStandardMaterial
                    color={isGoldTeam ? '#f97316' : '#7e22ce'}
                    emissive={isGoldTeam ? '#ea580c' : '#a855f7'}
                    emissiveIntensity={0.85}
                    roughness={0.5}
                  />
                </mesh>
              </group>
            ))}
          </group>
        )}
      </group>

      {/* Subtle Royal Halo Ring at the pedestal top for King & Queen */}
      {(role === 'k' || role === 'q') && (
        <mesh
          ref={auraRingRef}
          position={[0, topY + 0.005, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={noOpRaycast}
        >
          <ringGeometry args={[0.29, 0.35, 6]} />
          <meshBasicMaterial
            color={role === 'k' ? '#fbbf24' : '#e879f9'}
            side={THREE.DoubleSide}
            transparent
            opacity={0.85}
          />
        </mesh>
      )}

      {/* Superpower Active Effect: Golden Paladin Shield Dome */}
      {isShielded && (
        <mesh ref={shieldDomeRef} position={[0, 0.78, 0]} raycast={noOpRaycast}>
          <icosahedronGeometry args={[0.68, 1]} />
          <meshStandardMaterial
            color="#fbbf24"
            emissive="#f59e0b"
            emissiveIntensity={0.8}
            wireframe
            transparent
            opacity={0.75}
          />
        </mesh>
      )}

      {/* Superpower Active Effect: Aunt's Sapphire Ice Crystal Freeze */}
      {isFrozen && (
        <mesh position={[0, 0.75, 0]} raycast={noOpRaycast}>
          <octahedronGeometry args={[0.65, 0]} />
          <meshStandardMaterial
            color="#38bdf8"
            emissive="#0284c7"
            emissiveIntensity={0.7}
            transparent
            opacity={0.48}
            roughness={0.1}
          />
        </mesh>
      )}

      {/* Check Danger Pulsing Ring */}
      {isCheckThreatened && (
        <mesh
          ref={checkAlarmRingRef}
          position={[0, 0.035, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={noOpRaycast}
        >
          <ringGeometry args={[0.36, 0.52, 28]} />
          <meshBasicMaterial color="#ef4444" side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Landing Dust / Hop Shockwave Ring */}
      <mesh
        ref={landingRingRef}
        position={[0, 0.03, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        raycast={noOpRaycast}
      >
        <ringGeometry args={[0.26, 0.4, 24]} />
        <meshBasicMaterial
          color={primaryTeamColor}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Last Move Subtle Highlight Ring */}
      {isLastMoved && !isSelected && (
        <mesh
          position={[0, 0.022, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={noOpRaycast}
        >
          <ringGeometry args={[0.35, 0.42, 24]} />
          <meshBasicMaterial
            color={secondaryTeamColor}
            transparent
            opacity={0.7}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Comet Sparkle Trail + 3D Ghost Silhouettes while Jumping/Dashing */}
      {jumpProgress.current < 1 && (
        <Sparkles
          count={24}
          scale={[0.8, 1.1, 0.8]}
          position={[0, 0.55, 0]}
          size={5}
          speed={2.8}
          color={primaryTeamColor}
        />
      )}

      <group ref={ghost1Ref} visible={false}>
        <mesh
          position={[0, 0.45, 0]}
          scale={[baseScale * 0.92, baseScale * 0.92, baseScale * 0.92]}
          raycast={noOpRaycast}
        >
          <capsuleGeometry args={[0.16, 0.48, 8, 12]} />
          <meshBasicMaterial
            color={primaryTeamColor}
            transparent
            opacity={0.35}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>

      <group ref={ghost2Ref} visible={false}>
        <mesh
          position={[0, 0.45, 0]}
          scale={[baseScale * 0.8, baseScale * 0.8, baseScale * 0.8]}
          raycast={noOpRaycast}
        >
          <capsuleGeometry args={[0.16, 0.48, 8, 12]} />
          <meshBasicMaterial
            color={primaryTeamColor}
            transparent
            opacity={0.2}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* 3. TRUE 3D SCULPTED CHESS & RPG HERO FIGURE ON THE PEDESTAL! */}
      <group
        ref={figureRef}
        position={[0, topY, 0]}
        scale={[baseScale, baseScale, baseScale]}
      >
        <SculptedHeroMesh3D
          role={role}
          color={color}
          levelId={levelId}
          specialTheme={specialTheme}
          isSelected={isSelected}
          isFrozen={isFrozen}
          isShielded={isShielded}
          useSecondarySkin={useSecondarySkin}
        />
      </group>

      {/* Optional Nameplate (ONLY rendered when explicitly enabled in Menu Settings!) */}
      {showNameplate && (
        <Html
          position={[0, topY + baseScale * 1.02, 0]}
          center
          zIndexRange={[10, 0]}
        >
          <div
            className={`pointer-events-none px-1.5 py-0.5 rounded-full text-[9px] font-bold whitespace-nowrap shadow border backdrop-blur-sm ${
              isGoldTeam
                ? 'bg-amber-950/85 text-amber-200 border-amber-400/70'
                : 'bg-purple-950/85 text-purple-200 border-purple-400/70'
            }`}
          >
            {displayName}
          </div>
        </Html>
      )}
    </group>
  );
};
