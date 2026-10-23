import React, { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Html, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { FamilyHeroConfig, PieceRole } from '../data/familyConfig';

interface FamilyHeroPieceProps {
  role: PieceRole;
  color: 'w' | 'b';
  targetPosition: [number, number, number];
  heroConfig: FamilyHeroConfig;
  useSecondarySkin?: boolean; // For alternating the 2nd Cousin skin on Pawns
  isSelected: boolean;
  isCheckThreatened: boolean;
  isShielded?: boolean; // Dungeon Superpower: Royal Shield
  isFrozen?: boolean; // Dungeon Superpower: Aunt's Sunglass Freeze
  isLastMoved: boolean;
  showNameplate: boolean;
  onSelect: () => void;
}

const ROLE_HEIGHT_SCALE: Record<PieceRole, number> = {
  k: 1.52,
  q: 1.46,
  b: 1.32,
  n: 1.24,
  r: 1.34,
  p: 1.12,
};

export const FamilyHeroPiece3D: React.FC<FamilyHeroPieceProps> = ({
  role,
  color,
  targetPosition,
  heroConfig,
  useSecondarySkin = false,
  isSelected,
  isCheckThreatened,
  isShielded = false,
  isFrozen = false,
  isLastMoved,
  showNameplate,
  onSelect,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const spriteRef = useRef<THREE.Group>(null);
  const auraRingRef = useRef<THREE.Mesh>(null);
  const shieldDomeRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const currentPos = useRef(new THREE.Vector3(...targetPosition));
  const prevTarget = useRef(new THREE.Vector3(...targetPosition));
  const jumpProgress = useRef(1);

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
  const pedestalStoneColor = isGoldTeam ? '#443527' : '#251c38';
  const baseScale = ROLE_HEIGHT_SCALE[role] || 1.2;

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const targetVec = new THREE.Vector3(...targetPosition);
    if (prevTarget.current.distanceTo(targetVec) > 0.05) {
      prevTarget.current.copy(targetVec);
      jumpProgress.current = 0;
    }

    if (jumpProgress.current < 1) {
      jumpProgress.current = Math.min(1, jumpProgress.current + delta * 3.2);
    }

    currentPos.current.lerp(targetVec, Math.min(1, delta * 10));

    // Parabolic hop arc (especially high for the Daughter / Knight!)
    const arcMultiplier = role === 'n' ? 1.2 : 0.58;
    const hopHeight = Math.sin(jumpProgress.current * Math.PI) * arcMultiplier;
    const selectedLift = isSelected
      ? 0.25 + Math.sin(state.clock.elapsedTime * 5) * 0.06
      : 0;

    groupRef.current.position.set(
      currentPos.current.x,
      currentPos.current.y + hopHeight + selectedLift,
      currentPos.current.z
    );

    if (spriteRef.current) {
      const t =
        state.clock.elapsedTime +
        targetPosition[0] * 0.7 +
        targetPosition[2] * 0.5;
      const breath = isFrozen ? 1 : 1 + Math.sin(t * 2.6) * 0.026;
      spriteRef.current.scale.set(baseScale, baseScale * breath, baseScale);
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
      {/* 1. 3D Sculpted Dungeon Pedestal Base */}
      <mesh castShadow receiveShadow position={[0, 0.09, 0]}>
        <cylinderGeometry args={[0.37, 0.43, 0.18, 8]} />
        <meshStandardMaterial
          color={pedestalStoneColor}
          roughness={0.5}
          metalness={0.35}
        />
      </mesh>

      {/* Ornate Metallic Team Rim */}
      <mesh castShadow position={[0, 0.19, 0]}>
        <cylinderGeometry args={[0.34, 0.38, 0.06, 16]} />
        <meshStandardMaterial
          color={primaryTeamColor}
          roughness={0.25}
          metalness={0.85}
          emissive={isSelected || hovered ? primaryTeamColor : '#000000'}
          emissiveIntensity={isSelected ? 0.65 : hovered ? 0.35 : 0.1}
        />
      </mesh>

      {/* Castle Battlements around Rook base */}
      {role === 'r' && (
        <group position={[0, 0.24, 0]}>
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const angle = (i * Math.PI) / 3;
            return (
              <mesh
                key={i}
                position={[Math.cos(angle) * 0.31, 0, Math.sin(angle) * 0.31]}
                castShadow
              >
                <boxGeometry args={[0.09, 0.1, 0.09]} />
                <meshStandardMaterial
                  color={primaryTeamColor}
                  metalness={0.8}
                  roughness={0.2}
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
        <mesh ref={shieldDomeRef} position={[0, 0.72, 0]}>
          <icosahedronGeometry args={[0.62, 1]} />
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
        <mesh position={[0, 0.68, 0]}>
          <octahedronGeometry args={[0.6, 0]} />
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
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.38, 0.52, 24]} />
          <meshBasicMaterial color="#ef4444" side={THREE.DoubleSide} />
        </mesh>
      )}

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

      {/* 2. 3D Family Hero Miniature Standee */}
      <Billboard
        position={[0, 0.21 + baseScale * 0.45, 0]}
        follow={true}
        lockX={false}
        lockY={false}
        lockZ={false}
      >
        <group ref={spriteRef} scale={[baseScale, baseScale, baseScale]}>
          <mesh position={[0, 0.02, -0.04]}>
            <circleGeometry args={[0.38, 24]} />
            <meshBasicMaterial
              color={primaryTeamColor}
              transparent
              opacity={isSelected ? 0.48 : hovered ? 0.32 : 0.16}
            />
          </mesh>

          <mesh position={[0, 0, -0.02]}>
            <planeGeometry args={[0.88, 0.96]} />
            <meshBasicMaterial
              map={texture}
              transparent
              alphaTest={0.12}
              color={primaryTeamColor}
            />
          </mesh>

          <mesh castShadow>
            <planeGeometry args={[0.85, 0.93]} />
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
            position={[0, baseScale * 0.56, 0]}
            center
            distanceFactor={9}
            zIndexRange={[10, 0]}
          >
            <div
              className={`pointer-events-none px-2.5 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap shadow-lg border backdrop-blur-md transition-all ${
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
