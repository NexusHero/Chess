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

const ROLE_HEIGHT_SCALE: Record<PieceRole, number> = {
  k: 1.78,
  q: 1.72,
  b: 1.56,
  n: 1.48,
  r: 1.58,
  p: 1.34,
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
  const floatingEmblemRef = useRef<THREE.Group>(null);
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
  const stoneSlabDark = isGoldTeam ? '#574c41' : '#332b42';
  const stoneSlabMid = isGoldTeam ? '#786b5d' : '#4a3e5e';
  const stoneSlabLight = isGoldTeam ? '#9c8d7c' : '#65567d';
  const baseScale = ROLE_HEIGHT_SCALE[role] || 1.7;

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
      const dist = 0.27 + (i % 3) * 0.035;
      const sx = 0.13 + (i % 2) * 0.04;
      const sy = 0.09 + ((i + 1) % 3) * 0.035;
      const sz = 0.12 + (i % 3) * 0.03;
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
      ? 0.25 + Math.sin(state.clock.elapsedTime * 5) * 0.06
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
        : 1 + Math.sin(t * 2.6) * 0.026;

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

    if (floatingEmblemRef.current) {
      floatingEmblemRef.current.rotation.y += delta * 1.8;
      floatingEmblemRef.current.position.y =
        baseScale * 0.56 + Math.sin(state.clock.elapsedTime * 3.2) * 0.05;
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
      {/* 1. 3D Sculpted Multi-Tiered Carved Dungeon Rock / Stone Pedestal under the Hero's Feet */}
      {/* Bottom Rough Hewn Flagstone Foundation */}
      <mesh castShadow receiveShadow position={[0, 0.055, 0]} rotation={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.42, 0.47, 0.11, 7]} />
        <meshStandardMaterial
          color={stoneSlabDark}
          roughness={0.92}
          metalness={0.08}
          flatShading
        />
      </mesh>

      {/* Glowing Runic Magma/Crystal Seam Carved into the Stone */}
      <mesh castShadow position={[0, 0.125, 0]}>
        <cylinderGeometry args={[0.38, 0.4, 0.04, 12]} />
        <meshStandardMaterial
          color={primaryTeamColor}
          roughness={0.25}
          metalness={0.85}
          emissive={primaryTeamColor}
          emissiveIntensity={isSelected ? 0.95 : hovered ? 0.6 : 0.32}
        />
      </mesh>

      {/* Upper Chiseled Stone Slab Platform */}
      <mesh castShadow receiveShadow position={[0, 0.185, 0]} rotation={[0, 0.78, 0]}>
        <cylinderGeometry args={[0.34, 0.39, 0.1, 6]} />
        <meshStandardMaterial
          color={stoneSlabMid}
          roughness={0.88}
          metalness={0.12}
          flatShading
        />
      </mesh>

      {/* Rugged 3D Boulders & Cobblestone Rocks Clustered Directly Around the Hero's Feet */}
      <group position={[0, 0.23, 0]}>
        {rockChunks.map((rc, idx) => (
          <mesh
            key={idx}
            position={[
              Math.cos(rc.angle) * rc.dist,
              0.01,
              Math.sin(rc.angle) * rc.dist,
            ]}
            rotation={[0.1, rc.rotY, rc.rotZ]}
            scale={[rc.sx, rc.sy, rc.sz]}
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
        <mesh position={[0, 0.015, 0]} scale={[1, 0.32, 1]} receiveShadow>
          <dodecahedronGeometry args={[0.28, 1]} />
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
        <group position={[0, 0.27, 0]}>
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const angle = (i * Math.PI) / 3;
            return (
              <mesh
                key={i}
                position={[Math.cos(angle) * 0.33, 0, Math.sin(angle) * 0.33]}
                castShadow
              >
                <boxGeometry args={[0.1, 0.12, 0.1]} />
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

      {/* Floating Royal Halo Ring at the base of King & Queen */}
      {(role === 'k' || role === 'q') && (
        <mesh
          ref={auraRingRef}
          position={[0, 0.23, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.36, 0.44, 6]} />
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
        <mesh ref={shieldDomeRef} position={[0, 0.95, 0]}>
          <icosahedronGeometry args={[0.82, 1]} />
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
        <mesh position={[0, 0.9, 0]}>
          <octahedronGeometry args={[0.78, 0]} />
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
          <ringGeometry args={[0.38, 0.58, 28]} />
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
        <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.39, 0.46, 24]} />
          <meshBasicMaterial
            color={secondaryTeamColor}
            transparent
            opacity={0.65}
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

      {/* 2. 3D Family Hero Miniature Standee */}
      <Billboard
        position={[0, 0.25 + baseScale * 0.45, 0]}
        follow={true}
        lockX={false}
        lockY={false}
        lockZ={false}
      >
        {/* Floating 3D Role Emblem above the Hero (Crown for King, Star Orb for Queen, Diamond for Aunt, etc.) */}
        <group ref={floatingEmblemRef} position={[0, baseScale * 0.56, 0]}>
          {role === 'k' && (
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.13, 0.035, 8, 6]} />
              <meshStandardMaterial
                color="#fbbf24"
                emissive="#f59e0b"
                emissiveIntensity={0.7}
                metalness={0.9}
                roughness={0.15}
              />
            </mesh>
          )}
          {role === 'q' && (
            <mesh>
              <octahedronGeometry args={[0.13, 0]} />
              <meshStandardMaterial
                color="#e879f9"
                emissive="#c084fc"
                emissiveIntensity={0.85}
                metalness={0.8}
                roughness={0.1}
              />
            </mesh>
          )}
          {role === 'b' && (
            <mesh scale={[0.8, 1.35, 0.8]}>
              <octahedronGeometry args={[0.11, 0]} />
              <meshStandardMaterial
                color="#38bdf8"
                emissive="#0284c7"
                emissiveIntensity={0.8}
              />
            </mesh>
          )}
          {role === 'n' && (
            <mesh>
              <dodecahedronGeometry args={[0.1, 0]} />
              <meshStandardMaterial
                color="#fb7185"
                emissive="#f43f5e"
                emissiveIntensity={0.75}
              />
            </mesh>
          )}
        </group>

        <group ref={spriteRef} scale={[baseScale, baseScale, baseScale]}>
          <mesh position={[0, 0.02, -0.04]}>
            <circleGeometry args={[0.42, 24]} />
            <meshBasicMaterial
              color={primaryTeamColor}
              transparent
              opacity={isSelected ? 0.52 : hovered ? 0.36 : 0.18}
            />
          </mesh>

          <mesh position={[0, 0, -0.02]}>
            <planeGeometry args={[0.98, 1.08]} />
            <meshBasicMaterial
              map={texture}
              transparent
              alphaTest={0.12}
              color={primaryTeamColor}
            />
          </mesh>

          <mesh castShadow>
            <planeGeometry args={[0.95, 1.05]} />
            <meshStandardMaterial
              map={texture}
              transparent
              alphaTest={0.08}
              roughness={0.35}
              metalness={0.1}
              emissive={
                isFrozen
                  ? '#0284c7'
                  : isShielded
                  ? '#b45309'
                  : isGoldTeam
                  ? '#451a03'
                  : '#2e1065'
              }
              emissiveIntensity={
                isFrozen || isShielded ? 0.45 : isGoldTeam ? 0.08 : 0.22
              }
            />
          </mesh>
        </group>

        {/* Floating RPG Hero Badge */}
        {(hovered || isSelected || showNameplate || isShielded || isFrozen) && (
          <Html
            position={[0, baseScale * 0.54, 0]}
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
