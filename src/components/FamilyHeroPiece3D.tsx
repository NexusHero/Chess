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

// Cached LatheGeometries for smooth, authentic 3D sculpted chess & RPG bodies!
const latheCache = new Map<string, THREE.LatheGeometry>();
function getRoleLatheGeometry(role: PieceRole): THREE.LatheGeometry {
  const cached = latheCache.get(role);
  if (cached) return cached;

  let profile: [number, number][];
  switch (role) {
    case 'k':
      // Regal broad-shouldered King silhouette
      profile = [
        [0.01, 0.0],
        [0.27, 0.0],
        [0.28, 0.06],
        [0.22, 0.12],
        [0.17, 0.28],
        [0.15, 0.46],
        [0.22, 0.64],
        [0.24, 0.72],
        [0.16, 0.78],
        [0.01, 0.8],
      ];
      break;
    case 'q':
      // Graceful hourglass Archmage Queen gown silhouette
      profile = [
        [0.01, 0.0],
        [0.26, 0.0],
        [0.27, 0.05],
        [0.21, 0.14],
        [0.13, 0.34],
        [0.11, 0.5],
        [0.18, 0.64],
        [0.2, 0.7],
        [0.13, 0.75],
        [0.01, 0.77],
      ];
      break;
    case 'r':
      // Heavy crenellated Fortress Rook tower silhouette
      profile = [
        [0.01, 0.0],
        [0.27, 0.0],
        [0.28, 0.07],
        [0.23, 0.15],
        [0.2, 0.42],
        [0.21, 0.58],
        [0.25, 0.64],
        [0.25, 0.74],
        [0.01, 0.75],
      ];
      break;
    case 'b':
      // Sleek robed Bishop / Seer silhouette
      profile = [
        [0.01, 0.0],
        [0.24, 0.0],
        [0.25, 0.05],
        [0.19, 0.14],
        [0.14, 0.36],
        [0.13, 0.52],
        [0.18, 0.62],
        [0.14, 0.68],
        [0.01, 0.7],
      ];
      break;
    case 'n':
      // Armored Knight base pedestal & chest column
      profile = [
        [0.01, 0.0],
        [0.25, 0.0],
        [0.26, 0.06],
        [0.2, 0.14],
        [0.16, 0.28],
        [0.18, 0.42],
        [0.01, 0.45],
      ];
      break;
    default:
      // Nimble Ranger / Shieldmaiden Pawn silhouette
      profile = [
        [0.01, 0.0],
        [0.22, 0.0],
        [0.23, 0.05],
        [0.17, 0.12],
        [0.13, 0.28],
        [0.12, 0.42],
        [0.17, 0.52],
        [0.12, 0.56],
        [0.01, 0.58],
      ];
      break;
  }

  const points = profile.map(([r, y]) => new THREE.Vector2(r, y));
  const geom = new THREE.LatheGeometry(points, 24);
  geom.computeVertexNormals();
  latheCache.set(role, geom);
  return geom;
}

/**
 * Authentic 3D Sculpted Chess & RPG Hero Figure!
 * Distinctly colored & armored for Team Gold ('w') vs. Enemy Shadow Team ('b'),
 * and dynamically adapts its 3D armor, crown & weapons to the 5 World Themes!
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
  const latheGeom = useMemo(() => getRoleLatheGeometry(role), [role]);

  // 1. Unmistakable Team & Theme PBR Material Palette:
  //    - Team Gold ('w'): Radiant Ivory/Alabaster & Brushed Gold (or Emerald-Gold in Ramadan!)
  //    - Enemy Team ('b'): Dark Obsidian-Steel & Glowing Shadow-Violet / Magma-Crimson!
  const palette = useMemo(() => {
    if (isGold) {
      if (specialTheme === 'ramadan') {
        return {
          body: '#065f46', // Rich Emerald Silk & Jade
          armor: '#fbbf24', // Brushed Sultan Gold
          trim: '#fde047', // Bright Gold Trim
          cape: '#047857',
          skin: '#fde68a',
          eyeGlow: '#34d399',
          weapon: '#fef08a',
          emissive: isSelected ? '#fbbf24' : '#064e3b',
        };
      }
      if (specialTheme === 'halloween') {
        return {
          body: '#fef3c7', // Warm Ivory
          armor: '#f97316', // Glowing Pumpkin Bronze
          trim: '#fde047',
          cape: '#b45309',
          skin: '#fde68a',
          eyeGlow: '#fbbf24',
          weapon: '#fed7aa',
          emissive: isSelected ? '#f97316' : '#451a03',
        };
      }
      if (levelId === 2) {
        return {
          body: '#e0f2fe', // Frost Alabaster
          armor: '#fbbf24', // Royal Gold
          trim: '#38bdf8', // Sapphire Ice Trim
          cape: '#0284c7',
          skin: '#fef3c7',
          eyeGlow: '#38bdf8',
          weapon: '#bae6fd',
          emissive: isSelected ? '#38bdf8' : '#0c4a6e',
        };
      }
      if (levelId === 3) {
        return {
          body: '#fef3c7',
          armor: '#f59e0b',
          trim: '#ef4444', // Dragon-fire ruby trim
          cape: '#b91c1c',
          skin: '#fde68a',
          eyeGlow: '#fde047',
          weapon: '#fef08a',
          emissive: isSelected ? '#f59e0b' : '#451a03',
        };
      }
      return {
        body: useSecondarySkin ? '#fef9c3' : '#fffbeb', // Polished Royal Ivory Marble
        armor: '#f59e0b', // Radiant Paladin Gold
        trim: '#fde047',
        cape: '#d97706',
        skin: '#fde68a',
        eyeGlow: '#38bdf8',
        weapon: '#fef08a',
        emissive: isSelected ? '#fbbf24' : '#451a03',
      };
    } else {
      // ENEMY TEAM ('b'): Dark Obsidian / Shadow-Amethyst / Crimson Dread-Armor
      if (specialTheme === 'ramadan') {
        return {
          body: '#1e1b4b', // Deep Midnight Indigo
          armor: '#9333ea', // Royal Amethyst
          trim: '#e879f9',
          cape: '#3b0764',
          skin: '#581c87',
          eyeGlow: '#f43f5e',
          weapon: '#d8b4fe',
          emissive: isSelected ? '#c084fc' : '#2e1065',
        };
      }
      if (specialTheme === 'halloween') {
        return {
          body: '#18181b', // Night Obsidian
          armor: '#7e22ce', // Cursed Witch-Violet
          trim: '#f97316', // Jack-o'-Lantern Orange
          cape: '#3b0764',
          skin: '#4c1d95',
          eyeGlow: '#f97316',
          weapon: '#fdba74',
          emissive: isSelected ? '#f97316' : '#3b0764',
        };
      }
      if (levelId === 3) {
        return {
          body: '#1c1917', // Charred Volcanic Obsidian
          armor: '#991b1b', // Blood-Magma Crimson
          trim: '#f97316', // Molten Lava
          cape: '#450a0a',
          skin: '#450a0a',
          eyeGlow: '#ef4444',
          weapon: '#fca5a5',
          emissive: isSelected ? '#ef4444' : '#450a0a',
        };
      }
      return {
        body: '#1e1b4b', // Dark Obsidian-Indigo
        armor: '#7e22ce', // Shadow Amethyst
        trim: '#c084fc', // Neon Violet Trim
        cape: '#3b0764',
        skin: '#4c1d95',
        eyeGlow: '#f43f5e', // Menacing Crimson-Magenta Eyes
        weapon: '#e9d5ff',
        emissive: isSelected ? '#c084fc' : '#2e1065',
      };
    }
  }, [isGold, levelId, specialTheme, isSelected, useSecondarySkin]);

  const emIntensity = isFrozen
    ? 0.55
    : isShielded
    ? 0.5
    : isSelected
    ? 0.45
    : isGold
    ? 0.12
    : 0.25;

  // Player ('w') faces North (-Z, rotation.y = Math.PI), Enemy ('b') faces South (+Z, rotation.y = 0)
  // Wait: in Three.js, +Z points toward the camera (South, Rank 1).
  // So Enemy ('b', at Rank 7/8) faces +Z (0 rad, directly toward camera/player),
  // and Player ('w', at Rank 1/2) faces -Z (Math.PI rad, toward the enemy) OR slightly angled so you see their front/3-quarter view!
  // Let's angle Player ('w') at Math.PI * 0.82 (heroic 3/4 view toward enemy) and Enemy ('b') at 0 (directly facing player)!
  const facingY = isGold ? Math.PI * 0.82 : 0;

  return (
    <group rotation={[0, facingY, 0]}>
      {/* 1. SCULPTED LATHE BODY / TORSO COLUMN */}
      <mesh geometry={latheGeom} castShadow receiveShadow>
        <meshStandardMaterial
          color={isFrozen ? '#38bdf8' : palette.body}
          roughness={levelId === 2 ? 0.18 : isGold ? 0.28 : 0.35}
          metalness={levelId === 2 ? 0.65 : isGold ? 0.32 : 0.58}
          emissive={isFrozen ? '#0284c7' : palette.emissive}
          emissiveIntensity={emIntensity}
        />
      </mesh>

      {/* Ornate Metallic Waist Belt & Collar Ring */}
      {role !== 'n' && (
        <>
          <mesh position={[0, role === 'p' ? 0.28 : 0.38, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[role === 'p' ? 0.135 : 0.16, 0.025, 10, 24]} />
            <meshStandardMaterial
              color={palette.armor}
              metalness={0.85}
              roughness={0.2}
              emissive={palette.trim}
              emissiveIntensity={0.22}
            />
          </mesh>
          <mesh position={[0, role === 'p' ? 0.53 : 0.68, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[role === 'p' ? 0.15 : 0.2, 0.028, 10, 24]} />
            <meshStandardMaterial
              color={palette.armor}
              metalness={0.88}
              roughness={0.18}
              emissive={palette.trim}
              emissiveIntensity={0.25}
            />
          </mesh>
        </>
      )}

      {/* Flowing Royal / Shadow Cape on the Back for King, Queen & Bishop */}
      {(role === 'k' || role === 'q' || role === 'b') && (
        <mesh
          position={[0, 0.38, -0.16]}
          rotation={[0.22, 0, 0]}
          castShadow
        >
          <boxGeometry args={[0.34, 0.56, 0.04]} />
          <meshStandardMaterial
            color={palette.cape}
            roughness={0.55}
            metalness={0.2}
          />
        </mesh>
      )}

      {/* Enemy Team ('b') Spiked Shadow Pauldrons / Dragon Horns on Shoulders so Enemies look Fierce & Unmistakable! */}
      {!isGold && role !== 'n' && (
        <group position={[0, role === 'p' ? 0.52 : 0.68, 0]}>
          <mesh position={[-0.23, 0.06, 0]} rotation={[0, 0, 0.55]}>
            <coneGeometry args={[0.06, 0.2, 6]} />
            <meshStandardMaterial
              color={palette.trim}
              emissive={palette.armor}
              emissiveIntensity={0.75}
              metalness={0.8}
            />
          </mesh>
          <mesh position={[0.23, 0.06, 0]} rotation={[0, 0, -0.55]}>
            <coneGeometry args={[0.06, 0.2, 6]} />
            <meshStandardMaterial
              color={palette.trim}
              emissive={palette.armor}
              emissiveIntensity={0.75}
              metalness={0.8}
            />
          </mesh>
        </group>
      )}

      {/* Gold Team ('w') Rounded Paladin Shoulder Pauldrons */}
      {isGold && role !== 'n' && (
        <group position={[0, role === 'p' ? 0.5 : 0.66, 0]}>
          <mesh position={[-0.21, 0, 0]} scale={[1, 0.75, 1]} castShadow>
            <sphereGeometry args={[0.085, 12, 10]} />
            <meshStandardMaterial
              color={palette.armor}
              metalness={0.85}
              roughness={0.2}
            />
          </mesh>
          <mesh position={[0.21, 0, 0]} scale={[1, 0.75, 1]} castShadow>
            <sphereGeometry args={[0.085, 12, 10]} />
            <meshStandardMaterial
              color={palette.armor}
              metalness={0.85}
              roughness={0.2}
            />
          </mesh>
        </group>
      )}

      {/* ==================== ROLE-SPECIFIC 3D HEADS, CROWNS & WEAPONS ==================== */}

      {/* 1. KING ('k' – Baba: Armored Head, 8-Pointed Crown, Broadsword & Royal Greatshield) */}
      {role === 'k' && (
        <group>
          {/* Sculpted Royal Helmet / Head */}
          <mesh position={[0, 0.89, 0]} castShadow>
            <sphereGeometry args={[0.145, 18, 16]} />
            <meshStandardMaterial
              color={palette.skin}
              roughness={0.35}
              metalness={0.25}
            />
          </mesh>
          {/* Glowing Eyes on Visor */}
          <mesh position={[-0.048, 0.9, 0.13]}>
            <sphereGeometry args={[0.022, 8, 8]} />
            <meshBasicMaterial color={palette.eyeGlow} />
          </mesh>
          <mesh position={[0.048, 0.9, 0.13]}>
            <sphereGeometry args={[0.022, 8, 8]} />
            <meshBasicMaterial color={palette.eyeGlow} />
          </mesh>
          {/* Royal Beard / Chin Guard */}
          <mesh position={[0, 0.81, 0.11]}>
            <boxGeometry args={[0.14, 0.1, 0.08]} />
            <meshStandardMaterial color={palette.armor} metalness={0.75} roughness={0.25} />
          </mesh>
          {/* Ornate 3D Royal Crown */}
          <mesh position={[0, 1.02, 0]} castShadow>
            <cylinderGeometry args={[0.155, 0.13, 0.11, 8]} />
            <meshStandardMaterial
              color={palette.armor}
              emissive={palette.trim}
              emissiveIntensity={0.4}
              metalness={0.9}
              roughness={0.15}
            />
          </mesh>
          {/* Crown Finial: Crescent & Star in Ramadan, Pumpkin Gem in Halloween, Royal Cross/Star in Dungeon */}
          {specialTheme === 'ramadan' ? (
            <group position={[0, 1.15, 0]}>
              <mesh>
                <torusGeometry args={[0.075, 0.02, 8, 20, Math.PI * 1.45]} />
                <meshBasicMaterial color="#fde047" />
              </mesh>
              <mesh position={[0, 0.02, 0]} scale={[0.05, 0.05, 0.05]}>
                <octahedronGeometry args={[1, 0]} />
                <meshBasicMaterial color="#34d399" />
              </mesh>
            </group>
          ) : (
            <group position={[0, 1.15, 0]}>
              <mesh>
                <boxGeometry args={[0.045, 0.16, 0.045]} />
                <meshBasicMaterial color={palette.trim} />
              </mesh>
              <mesh>
                <boxGeometry args={[0.13, 0.045, 0.045]} />
                <meshBasicMaterial color={palette.trim} />
              </mesh>
            </group>
          )}
          {/* Right Hand: 3D Excalibur Broadsword */}
          <group position={[0.28, 0.56, 0.12]} rotation={[0.25, 0, -0.15]}>
            {/* Blade */}
            <mesh position={[0, 0.24, 0]} castShadow>
              <boxGeometry args={[0.045, 0.52, 0.018]} />
              <meshStandardMaterial
                color={palette.weapon}
                emissive={palette.trim}
                emissiveIntensity={0.5}
                metalness={0.92}
                roughness={0.1}
              />
            </mesh>
            {/* Crossguard */}
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[0.16, 0.035, 0.04]} />
              <meshStandardMaterial color={palette.armor} metalness={0.9} />
            </mesh>
          </group>
          {/* Left Hand: 3D Royal Paladin Shield */}
          <group position={[-0.26, 0.5, 0.14]} rotation={[0, 0.35, 0]}>
            <mesh castShadow>
              <boxGeometry args={[0.22, 0.32, 0.04]} />
              <meshStandardMaterial
                color={palette.armor}
                metalness={0.82}
                roughness={0.22}
              />
            </mesh>
            <mesh position={[0, 0, 0.025]} scale={[0.07, 0.1, 0.03]}>
              <octahedronGeometry args={[1, 0]} />
              <meshBasicMaterial color={palette.eyeGlow} />
            </mesh>
          </group>
        </group>
      )}

      {/* 2. QUEEN ('q' – Anne: Crowned Head, 6-Pointed Crystal Tiara & Archmage Orb Staff) */}
      {role === 'q' && (
        <group>
          <mesh position={[0, 0.86, 0]} castShadow>
            <sphereGeometry args={[0.135, 18, 16]} />
            <meshStandardMaterial
              color={palette.skin}
              roughness={0.3}
              metalness={0.2}
            />
          </mesh>
          {/* Glowing Eyes */}
          <mesh position={[-0.044, 0.87, 0.12]}>
            <sphereGeometry args={[0.02, 8, 8]} />
            <meshBasicMaterial color={palette.eyeGlow} />
          </mesh>
          <mesh position={[0.044, 0.87, 0.12]}>
            <sphereGeometry args={[0.02, 8, 8]} />
            <meshBasicMaterial color={palette.eyeGlow} />
          </mesh>
          {/* 6-Pointed Flared Queen Coronet + Floating Central Gem */}
          <mesh position={[0, 0.98, 0]} castShadow>
            <cylinderGeometry args={[0.15, 0.11, 0.1, 6]} />
            <meshStandardMaterial
              color={palette.armor}
              emissive={palette.trim}
              emissiveIntensity={0.45}
              metalness={0.9}
              roughness={0.12}
            />
          </mesh>
          <mesh position={[0, 1.08, 0]} scale={[0.065, 0.095, 0.065]}>
            <octahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color={palette.eyeGlow} />
          </mesh>
          {/* Right Hand: Tall 3D Archmage Staff topped with Glowing Mana Sphere */}
          <group position={[0.25, 0.52, 0.1]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.018, 0.022, 0.86, 8]} />
              <meshStandardMaterial color={palette.armor} metalness={0.85} />
            </mesh>
            <mesh position={[0, 0.46, 0]}>
              <octahedronGeometry args={[0.085, 1]} />
              <meshBasicMaterial color={palette.eyeGlow} wireframe />
            </mesh>
            <mesh position={[0, 0.46, 0]}>
              <sphereGeometry args={[0.05, 12, 12]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          </group>
        </group>
      )}

      {/* 3. ROOK ('r' – Onkel: Crenellated Castle Battlement Crown, Glowing Furnace Visor & Warhammer) */}
      {role === 'r' && (
        <group>
          {/* Crenellated 3D Castle Turret Crown (6 Stone/Gold Merlons) */}
          {[0, 1, 2, 3, 4, 5].map((mIdx) => {
            const a = (mIdx * Math.PI) / 3;
            return (
              <mesh
                key={`merlon-${mIdx}`}
                position={[Math.cos(a) * 0.19, 0.81, Math.sin(a) * 0.19]}
                rotation={[0, -a, 0]}
                castShadow
              >
                <boxGeometry args={[0.085, 0.14, 0.085]} />
                <meshStandardMaterial
                  color={palette.armor}
                  metalness={0.75}
                  roughness={0.28}
                />
              </mesh>
            );
          })}
          {/* Glowing Guardian Visor Slit on the Front of the Tower */}
          <mesh position={[0, 0.62, 0.23]}>
            <boxGeometry args={[0.18, 0.045, 0.04]} />
            <meshBasicMaterial color={palette.eyeGlow} />
          </mesh>
          {/* Heavy 3D Siege Warhammer on the Side */}
          <group position={[0.27, 0.48, 0.08]} rotation={[0.2, 0, -0.1]}>
            <mesh>
              <cylinderGeometry args={[0.022, 0.022, 0.56, 8]} />
              <meshStandardMaterial color={palette.armor} metalness={0.8} />
            </mesh>
            <mesh position={[0, 0.26, 0]}>
              <boxGeometry args={[0.14, 0.1, 0.22]} />
              <meshStandardMaterial
                color={palette.weapon}
                emissive={palette.trim}
                emissiveIntensity={0.4}
                metalness={0.9}
              />
            </mesh>
          </group>
        </group>
      )}

      {/* 4. BISHOP ('b' – Coole Tante: Sculpted Mitre Hat, Cool 3D Sunglasses Visor & Sapphire Scepter) */}
      {role === 'b' && (
        <group>
          {/* Head */}
          <mesh position={[0, 0.78, 0]} castShadow>
            <sphereGeometry args={[0.125, 16, 14]} />
            <meshStandardMaterial color={palette.skin} roughness={0.35} />
          </mesh>
          {/* Signature Cool Aunt 3D Sunglasses Visor! */}
          <mesh position={[0, 0.79, 0.115]}>
            <boxGeometry args={[0.17, 0.048, 0.04]} />
            <meshStandardMaterial
              color="#0f172a"
              emissive={palette.eyeGlow}
              emissiveIntensity={0.65}
              metalness={0.95}
              roughness={0.05}
            />
          </mesh>
          {/* Sculpted Tapered Bishop Mitre / Mystic Hat */}
          <mesh position={[0, 0.94, 0]} scale={[1, 1.35, 0.85]} castShadow>
            <coneGeometry args={[0.135, 0.22, 12]} />
            <meshStandardMaterial
              color={palette.armor}
              emissive={palette.trim}
              emissiveIntensity={0.3}
              metalness={0.78}
              roughness={0.22}
            />
          </mesh>
          <mesh position={[0, 1.09, 0]}>
            <sphereGeometry args={[0.038, 10, 10]} />
            <meshBasicMaterial color={palette.eyeGlow} />
          </mesh>
          {/* Crystal Scepter */}
          <group position={[0.22, 0.48, 0.1]} rotation={[0.18, 0, -0.1]}>
            <mesh>
              <cylinderGeometry args={[0.016, 0.018, 0.68, 8]} />
              <meshStandardMaterial color={palette.armor} metalness={0.85} />
            </mesh>
            <mesh position={[0, 0.36, 0]} scale={[0.06, 0.12, 0.06]}>
              <octahedronGeometry args={[1, 0]} />
              <meshBasicMaterial color={palette.eyeGlow} />
            </mesh>
          </group>
        </group>
      )}

      {/* 5. KNIGHT ('n' – Tochter: True 3D Sculpted Armored Warhorse / Unicorn with Golden Horn & Mane!) */}
      {role === 'n' && (
        <group>
          {/* Muscular Arched Warhorse Neck */}
          <mesh
            position={[0, 0.56, 0.04]}
            rotation={[-0.38, 0, 0]}
            castShadow
            receiveShadow
          >
            <cylinderGeometry args={[0.11, 0.165, 0.38, 14]} />
            <meshStandardMaterial
              color={isFrozen ? '#38bdf8' : palette.body}
              roughness={0.28}
              metalness={isGold ? 0.35 : 0.6}
              emissive={palette.emissive}
              emissiveIntensity={emIntensity}
            />
          </mesh>
          {/* Sculpted Horse Head & Snout */}
          <mesh
            position={[0, 0.74, 0.14]}
            rotation={[1.15, 0, 0]}
            castShadow
          >
            <cylinderGeometry args={[0.068, 0.115, 0.28, 12]} />
            <meshStandardMaterial
              color={isFrozen ? '#38bdf8' : palette.body}
              roughness={0.28}
              metalness={isGold ? 0.35 : 0.6}
            />
          </mesh>
          {/* Armored Golden/Amethyst Chamfron (Forehead Plate) */}
          <mesh
            position={[0, 0.78, 0.16]}
            rotation={[1.15, 0, 0]}
          >
            <boxGeometry args={[0.1, 0.22, 0.04]} />
            <meshStandardMaterial
              color={palette.armor}
              metalness={0.88}
              roughness={0.18}
            />
          </mesh>
          {/* Glowing Warhorse Eyes */}
          <mesh position={[-0.085, 0.76, 0.11]}>
            <sphereGeometry args={[0.022, 8, 8]} />
            <meshBasicMaterial color={palette.eyeGlow} />
          </mesh>
          <mesh position={[0.085, 0.76, 0.11]}>
            <sphereGeometry args={[0.022, 8, 8]} />
            <meshBasicMaterial color={palette.eyeGlow} />
          </mesh>
          {/* Twin Pointed Horse Ears */}
          <mesh position={[-0.065, 0.87, 0.04]} rotation={[-0.2, 0, 0.2]}>
            <coneGeometry args={[0.028, 0.09, 6]} />
            <meshStandardMaterial color={palette.armor} metalness={0.8} />
          </mesh>
          <mesh position={[0.065, 0.87, 0.04]} rotation={[-0.2, 0, -0.2]}>
            <coneGeometry args={[0.028, 0.09, 6]} />
            <meshStandardMaterial color={palette.armor} metalness={0.8} />
          </mesh>
          {/* Radiant Spiraling Unicorn Horn on Forehead! */}
          <mesh position={[0, 0.92, 0.22]} rotation={[0.68, 0, 0]}>
            <coneGeometry args={[0.032, 0.24, 8]} />
            <meshBasicMaterial color={palette.trim} />
          </mesh>
          {/* Sculpted Flowing Mane Crest Plates along the Back of the Neck */}
          {[0, 1, 2, 3].map((mIdx) => (
            <mesh
              key={`mane-${mIdx}`}
              position={[0, 0.46 + mIdx * 0.1, -0.08 + mIdx * 0.025]}
              rotation={[-0.4, 0, 0]}
            >
              <boxGeometry args={[0.045, 0.11, 0.12]} />
              <meshStandardMaterial
                color={palette.armor}
                emissive={palette.trim}
                emissiveIntensity={0.35}
                metalness={0.85}
              />
            </mesh>
          ))}
        </group>
      )}

      {/* 6. PAWN ('p' – Cousinen: Armored Ranger Helmet/Pumpkin/Turban, Round Buckler Shield & Spear) */}
      {role === 'p' && (
        <group>
          {/* Head (or Glowing Jack-o'-Lantern Head in Halloween!) */}
          <mesh position={[0, 0.66, 0]} castShadow>
            <sphereGeometry args={[0.12, 16, 14]} />
            <meshStandardMaterial
              color={
                specialTheme === 'halloween'
                  ? '#f97316'
                  : palette.skin
              }
              roughness={0.35}
            />
          </mesh>
          {/* Glowing Eyes */}
          <mesh position={[-0.04, 0.67, 0.108]}>
            <sphereGeometry args={[0.018, 8, 8]} />
            <meshBasicMaterial color={palette.eyeGlow} />
          </mesh>
          <mesh position={[0.04, 0.67, 0.108]}>
            <sphereGeometry args={[0.018, 8, 8]} />
            <meshBasicMaterial color={palette.eyeGlow} />
          </mesh>
          {/* Helmet / Crest on Top */}
          <mesh position={[0, 0.74, 0]} castShadow>
            <cylinderGeometry
              args={[
                useSecondarySkin ? 0.09 : 0.125,
                0.125,
                0.08,
                8,
              ]}
            />
            <meshStandardMaterial
              color={palette.armor}
              metalness={0.85}
              roughness={0.2}
            />
          </mesh>
          <mesh position={[0, 0.81, 0]}>
            <coneGeometry args={[0.05, 0.1, 6]} />
            <meshBasicMaterial color={palette.trim} />
          </mesh>
          {/* Left Hand: Round 3D Buckler Shield */}
          <mesh
            position={[-0.19, 0.4, 0.12]}
            rotation={[Math.PI / 2, 0, -0.35]}
            castShadow
          >
            <cylinderGeometry args={[0.13, 0.13, 0.035, 16]} />
            <meshStandardMaterial
              color={palette.armor}
              emissive={palette.trim}
              emissiveIntensity={0.25}
              metalness={0.85}
              roughness={0.2}
            />
          </mesh>
          {/* Right Hand: 3D Ranger Spear / Halberd */}
          <group position={[0.2, 0.44, 0.1]} rotation={[0.2, 0, -0.08]}>
            <mesh>
              <cylinderGeometry args={[0.015, 0.015, 0.56, 8]} />
              <meshStandardMaterial color={palette.armor} metalness={0.8} />
            </mesh>
            <mesh position={[0, 0.31, 0]} scale={[0.045, 0.11, 0.025]}>
              <octahedronGeometry args={[1, 0]} />
              <meshBasicMaterial color={palette.weapon} />
            </mesh>
          </group>
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

  // When a piece is ALREADY selected, make its upper body raycast-transparent (`() => null`)
  // so clicking the adjacent square directly behind its head (`e2 -> e3`) NEVER gets blocked by the piece itself!
  const noOpRaycast = useMemo(() => () => null, []);

  return (
    <group
      ref={groupRef}
      onClick={(e) => {
        if (isSelected) return; // Let clicks pass through to adjacent target tiles behind a selected piece!
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={(e) => {
        if (isSelected) return;
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
    >
      {/* Compact, Tile-Accurate 3D Hitbox Column (Radius 0.36 so it NEVER spills over onto neighboring squares!) */}
      {!isSelected && (
        <mesh
          position={[0, 0.48, 0]}
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
          <cylinderGeometry args={[0.35, 0.38, 0.92, 16]} />
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
          geometry={ getRoleLatheGeometry(role) }
          scale={[baseScale * 0.92, baseScale * 0.92, baseScale * 0.92]}
          raycast={noOpRaycast}
        >
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
          geometry={ getRoleLatheGeometry(role) }
          scale={[baseScale * 0.8, baseScale * 0.8, baseScale * 0.8]}
          raycast={noOpRaycast}
        >
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

      {/* 3D Comic Speech Bubble for King in Check or Hero Action! */}
      {(isCheckThreatened || showActionBubble) && (
        <Html
          position={[0, topY + baseScale * 1.12, 0]}
          center
          zIndexRange={[20, 0]}
        >
          {isCheckThreatened ? (
            <div className="pointer-events-none px-2.5 py-1 rounded-2xl bg-red-600/95 text-white text-[11px] font-black whitespace-nowrap shadow-[0_0_20px_rgba(239,68,68,0.8)] border-2 border-amber-300 animate-bounce">
              😱 SCHACH! Beschützt mich!
            </div>
          ) : (
            <div
              className={`pointer-events-none px-2.5 py-0.5 rounded-2xl text-[10px] font-extrabold whitespace-nowrap shadow-lg border backdrop-blur-md animate-pulse ${
                isGoldTeam
                  ? 'bg-amber-950/95 text-amber-200 border-amber-400'
                  : 'bg-purple-950/95 text-purple-200 border-purple-400'
              }`}
            >
              {isPromoted
                ? `👑 ${displayName} gekrönt!`
                : isAttacking
                ? `⚔️ „${heroConfig.battleCry}“`
                : role === 'n'
                ? `✨ Hoppala-Sprung!`
                : `⚡ ${displayName}!`}
            </div>
          )}
        </Html>
      )}

      {/* Floating RPG Hero Badge */}
      {!isCheckThreatened &&
        !showActionBubble &&
        (hovered || isSelected || showNameplate || isShielded || isFrozen) && (
          <Html
            position={[0, topY + baseScale * 1.05, 0]}
            center
            zIndexRange={[10, 0]}
          >
            <div
              className={`pointer-events-none px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap shadow-md border backdrop-blur-md transition-all ${
                isFrozen
                  ? 'bg-sky-950/95 text-sky-200 border-sky-400'
                  : isShielded
                  ? 'bg-amber-900/95 text-amber-100 border-yellow-300'
                  : isGoldTeam
                  ? 'bg-amber-950/90 text-amber-200 border-amber-400/80'
                  : 'bg-purple-950/90 text-purple-200 border-purple-400/80'
              }`}
            >
              <span className="mr-1">
                {isFrozen ? '❄️' : isShielded ? '🛡️' : isGoldTeam ? '☀️' : '🌙'}
              </span>
              {displayName}
              <span className="opacity-70 font-normal ml-1">
                ({heroConfig.chessName})
              </span>
            </div>
          </Html>
        )}
    </group>
  );
};
