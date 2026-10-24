import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Html, Sparkles, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { FamilyHeroConfig, PieceRole } from '../data/familyConfig';

interface FamilyHeroPieceProps {
  role: PieceRole;
  color: 'w' | 'b';
  targetPosition: [number, number, number];
  fromPosition?: [number, number, number] | null; // Previous position for smooth hop-arc & dust burst
  heroConfig: FamilyHeroConfig;
  useSecondarySkin?: boolean; // For alternating the 2nd Cousin skin on Pawns
  isSelected: boolean;
  isCheckThreatened: boolean;
  isShielded?: boolean; // Dungeon Superpower: Royal Shield
  isFrozen?: boolean; // Dungeon Superpower: Aunt's Sunglass Freeze
  isLastMoved: boolean;
  isAttacking?: boolean; // Sword-lunge dash animation when capturing
  isPromoted?: boolean; // Golden coronation spiral spin
  isCelebrating?: boolean; // Victory dance hop at end of match
  showNameplate: boolean;
  onSelect: () => void;
}

// Clear Art-Director Size & Pedestal Hierarchy so Front & Back Ranks never occlude each other!
const ROLE_HEIGHT_SCALE: Record<PieceRole, number> = {
  k: 1.54,
  q: 1.48,
  b: 1.34,
  r: 1.35,
  n: 1.28,
  p: 1.12,
};

const ROLE_PEDESTAL_HEIGHT: Record<PieceRole, number> = {
  k: 0.24,
  q: 0.22,
  b: 0.16,
  r: 0.16,
  n: 0.15,
  p: 0.1,
};

export const FamilyHeroPiece3D: React.FC<FamilyHeroPieceProps> = ({
  role,
  color,
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
  const spriteRef = useRef<THREE.Group>(null);
  const auraRingRef = useRef<THREE.Mesh>(null);
  const shieldDomeRef = useRef<THREE.Mesh>(null);
  const landingRingRef = useRef<THREE.Mesh>(null);
  const checkAlarmRingRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const currentPos = useRef(
    new THREE.Vector3(...(fromPosition && isLastMoved ? fromPosition : targetPosition))
  );
  const prevTarget = useRef(new THREE.Vector3(...targetPosition));
  const jumpProgress = useRef(fromPosition && isLastMoved ? 0 : 1);
  const landingDustAlpha = useRef(fromPosition && isLastMoved ? 1 : 0);
  const promotionSpin = useRef(isPromoted ? Math.PI * 4 : 0);
  const selectBounce = useRef(0);

  useEffect(() => {
    if (isSelected) {
      selectBounce.current = 1;
    }
  }, [isSelected]);

  // Pick primary or secondary cousin sprite path
  const activeSpriteJpg = useMemo(() => {
    if (useSecondarySkin && heroConfig.secondarySpritePath) {
      return heroConfig.secondarySpritePath;
    }
    return heroConfig.spritePath;
  }, [useSecondarySkin, heroConfig.secondarySpritePath, heroConfig.spritePath]);

  const pngPath = useMemo(
    () => activeSpriteJpg.replace('.jpg', '.png'),
    [activeSpriteJpg]
  );

  const texture = useTexture(pngPath);
  texture.colorSpace = THREE.SRGBColorSpace;

  const displayName =
    useSecondarySkin && heroConfig.secondaryCustomName
      ? heroConfig.secondaryCustomName
      : heroConfig.customName;

  const isGoldTeam = color === 'w';
  const primaryTeamColor = isGoldTeam ? '#fbbf24' : '#a855f7';
  const secondaryTeamColor = isGoldTeam ? '#fef3c7' : '#e9d5ff';
  // Distinct warm sandstone-gold vs deep royal obsidian-violet stone pedestals
  const stoneSlabDark = isGoldTeam ? '#5c4938' : '#2a223a';
  const stoneSlabMid = isGoldTeam ? '#856d56' : '#43365c';
  const stoneSlabLight = isGoldTeam ? '#ab9176' : '#635185';
  const reliefBodyColor = isGoldTeam ? '#b47b32' : '#5b21b6';
  const baseScale = ROLE_HEIGHT_SCALE[role] || 1.3;
  const bodyHeight = ROLE_PEDESTAL_HEIGHT[role] || 0.15;
  const capY = 0.08 + bodyHeight + 0.025;
  const topY = capY + 0.03;

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
      const sx = 0.11 + (i % 2) * 0.035;
      const sy = 0.075 + ((i + 1) % 3) * 0.028;
      const sz = 0.1 + (i % 3) * 0.025;
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
      prevTarget.current.copy(targetVec);
      jumpProgress.current = 0;
      landingDustAlpha.current = 1;
    }

    if (jumpProgress.current < 1) {
      jumpProgress.current = Math.min(1, jumpProgress.current + delta * 2.6);
    }

    currentPos.current.lerp(targetVec, Math.min(1, delta * 9.5));

    // 1. Parabolic hop arc (extra high flip arc for Daughter / Knight + attacking lunge!)
    const arcMultiplier = role === 'n' ? 1.45 : isAttacking ? 0.95 : 0.62;
    const hopHeight = Math.sin(jumpProgress.current * Math.PI) * arcMultiplier;

    // 2. Selected hover lift
    const selectedLift = isSelected
      ? 0.22 + Math.sin(state.clock.elapsedTime * 5) * 0.05
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

    // Promotion coronation spin
    if (promotionSpin.current > 0) {
      promotionSpin.current = Math.max(0, promotionSpin.current - delta * 8);
      groupRef.current.rotation.y = promotionSpin.current;
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

    if (spriteRef.current) {
      const t =
        state.clock.elapsedTime +
        targetPosition[0] * 0.7 +
        targetPosition[2] * 0.5;
      const breath = isFrozen
        ? 1
        : isCelebrating
        ? 1 + Math.sin(t * 8) * 0.08
        : 1 + Math.sin(t * 2.6) * 0.024;

      // Pixar-style Squash & Stretch during hop, landing, and selection pop!
      if (selectBounce.current > 0) {
        selectBounce.current = Math.max(0, selectBounce.current - delta * 3.5);
      }
      const hopStretch =
        jumpProgress.current < 1
          ? Math.sin(jumpProgress.current * Math.PI) * 0.16
          : 0;
      const landingSquash =
        landingDustAlpha.current > 0.65
          ? -Math.sin(((landingDustAlpha.current - 0.65) / 0.35) * Math.PI) *
            0.14
          : 0;
      const selectPop =
        selectBounce.current > 0
          ? Math.sin(selectBounce.current * Math.PI * 2) * 0.12
          : 0;

      const stretchFactor = 1 + hopStretch + landingSquash + selectPop;
      const squashFactor = 1 - (hopStretch + landingSquash + selectPop) * 0.55;

      spriteRef.current.scale.set(
        baseScale * squashFactor,
        baseScale * breath * stretchFactor,
        baseScale
      );
    }

    if (auraRingRef.current) {
      auraRingRef.current.rotation.z += delta * (isSelected ? 2.4 : 0.8);
    }

    if (shieldDomeRef.current) {
      shieldDomeRef.current.rotation.y += delta * 1.4;
    }
  });

  return (
    <group
      ref={groupRef}
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
      {/* 1. Grounded Team Identification Ring on the Floor (Replaces the muddy background bubble!) */}
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.36, 0.43, 32]} />
        <meshBasicMaterial
          color={primaryTeamColor}
          side={THREE.DoubleSide}
          transparent
          opacity={isSelected ? 0.95 : hovered ? 0.8 : 0.52}
        />
      </mesh>

      {/* 2. Stepped Ornate Square Carved Stone & Gold/Purple-Relief Pedestal (Matches Concept Art!) */}
      {/* Bottom Chiseled Stone Plinth */}
      <mesh castShadow receiveShadow position={[0, 0.04, 0]}>
        <boxGeometry args={[0.74, 0.08, 0.74]} />
        <meshStandardMaterial
          color={stoneSlabDark}
          roughness={0.85}
          metalness={0.15}
        />
      </mesh>

      {/* Ornate Golden / Royal Purple Relief Body (Height tiered by piece rank!) */}
      <mesh
        castShadow
        receiveShadow
        position={[0, 0.08 + bodyHeight / 2, 0]}
      >
        <boxGeometry args={[0.62, bodyHeight, 0.62]} />
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
        [0, 0.08 + bodyHeight / 2, 0.32],
        [0, 0.08 + bodyHeight / 2, -0.32],
        [0.32, 0.08 + bodyHeight / 2, 0],
        [-0.32, 0.08 + bodyHeight / 2, 0],
      ].map((gPos, gIdx) => (
        <mesh
          key={`gem-${gIdx}`}
          position={gPos as [number, number, number]}
          scale={[0.06, 0.08, 0.06]}
        >
          <octahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color={isGoldTeam ? '#38bdf8' : '#f59e0b'}
            emissive={isGoldTeam ? '#0284c7' : '#d97706'}
            emissiveIntensity={1.2}
          />
        </mesh>
      ))}

      {/* Upper Chiseled Stone Cap Slab */}
      <mesh castShadow receiveShadow position={[0, capY, 0]}>
        <boxGeometry args={[0.68, 0.05, 0.68]} />
        <meshStandardMaterial
          color={stoneSlabLight}
          roughness={0.78}
          metalness={0.18}
        />
      </mesh>

      {/* Rugged 3D Boulders & Cobblestone Rocks Clustered Directly Around the Hero's Feet */}
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
            scale={[rc.sx * 0.88, rc.sy * 0.88, rc.sz * 0.88]}
            castShadow
            receiveShadow
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

        {/* Central Flat Stepping Stone Directly Under the Boots/Feet */}
        <mesh position={[0, 0.012, 0]} scale={[1, 0.28, 1]} receiveShadow>
          <dodecahedronGeometry args={[0.23, 1]} />
          <meshStandardMaterial
            color={stoneSlabLight}
            roughness={0.9}
            metalness={0.08}
            flatShading
          />
        </mesh>
      </group>

      {/* Castle Stone Battlements around Rook base */}
      {role === 'r' && (
        <group position={[0, topY + 0.01, 0]}>
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const angle = (i * Math.PI) / 3;
            return (
              <mesh
                key={i}
                position={[Math.cos(angle) * 0.28, 0, Math.sin(angle) * 0.28]}
                castShadow
              >
                <boxGeometry args={[0.09, 0.1, 0.09]} />
                <meshStandardMaterial
                  color={stoneSlabLight}
                  metalness={0.25}
                  roughness={0.85}
                  flatShading
                />
              </mesh>
            );
          })}
        </group>
      )}

      {/* Subtle Royal Halo Ring at the pedestal top for King & Queen */}
      {(role === 'k' || role === 'q') && (
        <mesh
          ref={auraRingRef}
          position={[0, topY + 0.005, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.31, 0.37, 6]} />
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
        <mesh ref={shieldDomeRef} position={[0, 0.9, 0]}>
          <icosahedronGeometry args={[0.78, 1]} />
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
        <mesh position={[0, 0.85, 0]}>
          <octahedronGeometry args={[0.74, 0]} />
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
        >
          <ringGeometry args={[0.38, 0.56, 28]} />
          <meshBasicMaterial color="#ef4444" side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Landing Dust / Hop Shockwave Ring */}
      <mesh
        ref={landingRingRef}
        position={[0, 0.03, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.28, 0.42, 24]} />
        <meshBasicMaterial
          color={primaryTeamColor}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Last Move Subtle Highlight Ring */}
      {isLastMoved && !isSelected && (
        <mesh position={[0, 0.022, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.38, 0.45, 24]} />
          <meshBasicMaterial
            color={secondaryTeamColor}
            transparent
            opacity={0.7}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Comet Sparkle Trail while Jumping/Moving */}
      {jumpProgress.current < 1 && (
        <Sparkles
          count={26}
          scale={[0.9, 1.2, 0.9]}
          position={[0, 0.6, 0]}
          size={5}
          speed={2.8}
          color={primaryTeamColor}
        />
      )}

      {/* 3. Crisp, Silhouette-Clean 3D Family Hero Miniature Standee (NO muddy background disc, NO floating primitive hats!) */}
      <Billboard
        position={[0, topY + baseScale * 0.45, 0]}
        follow={true}
        lockX={false}
        lockY={false}
        lockZ={false}
      >
        <group ref={spriteRef} scale={[baseScale, baseScale, baseScale]}>
          {/* Crisp Rim-Light Silhouette Edge (Only visible along the character's exact alpha contour!) */}
          <mesh position={[0, 0, -0.018]}>
            <planeGeometry args={[0.97, 1.07]} />
            <meshBasicMaterial
              map={texture}
              transparent
              alphaTest={0.18}
              color={isSelected ? '#ffffff' : primaryTeamColor}
            />
          </mesh>

          {/* Main High-Contrast Character Cutout */}
          <mesh castShadow>
            <planeGeometry args={[0.94, 1.04]} />
            <meshStandardMaterial
              map={texture}
              transparent
              alphaTest={0.12}
              roughness={0.35}
              metalness={0.08}
              emissive={
                isFrozen
                  ? '#0284c7'
                  : isShielded
                  ? '#b45309'
                  : isSelected
                  ? primaryTeamColor
                  : '#000000'
              }
              emissiveIntensity={
                isFrozen || isShielded ? 0.45 : isSelected ? 0.18 : 0
              }
            />
          </mesh>
        </group>

        {/* Floating RPG Hero Badge */}
        {(hovered || isSelected || showNameplate || isShielded || isFrozen) && (
          <Html
            position={[0, baseScale * 0.55, 0]}
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
      </Billboard>
    </group>
  );
};
