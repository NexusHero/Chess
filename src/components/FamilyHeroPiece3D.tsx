import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Html, Sparkles, useTexture } from '@react-three/drei';
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

// Cache for Team-Tinted & Theme-Styled Character Cutout Textures so Team Gold ('w') and Enemy ('b') are 100% distinct!
const styledHeroTextureCache = new Map<string, THREE.CanvasTexture>();

function getStyledTeamAndThemeTexture(
  baseTexture: THREE.Texture,
  pngPath: string,
  color: 'w' | 'b',
  levelId: number,
  specialTheme: SpecialThemeType
): THREE.Texture {
  const img = baseTexture.image as HTMLImageElement | undefined;
  if (!img || !img.width || typeof document === 'undefined') {
    return baseTexture;
  }

  const cacheKey = `${pngPath}|${color}|${levelId}|${specialTheme}`;
  const cached = styledHeroTextureCache.get(cacheKey);
  if (cached) return cached;

  const W = 512;
  const H = 560;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Offscreen silhouette stamp canvas for crisp outer team contour
  const silCanvas = document.createElement('canvas');
  silCanvas.width = W;
  silCanvas.height = H;
  const silCtx = silCanvas.getContext('2d')!;

  silCtx.save();
  if (color === 'b') {
    // Flip Enemy Team horizontally so the two armies face opposite directions!
    silCtx.translate(W, 0);
    silCtx.scale(-1, 1);
  }
  silCtx.drawImage(img, 24, 24, W - 48, H - 48);
  silCtx.globalCompositeOperation = 'source-in';
  // Bold team contour color: Radiant Sun-Gold for Player ('w'), Neon Shadow-Purple/Crimson for Enemy ('b')
  silCtx.fillStyle =
    color === 'w'
      ? specialTheme === 'ramadan'
        ? '#fde047'
        : '#fbbf24'
      : specialTheme === 'halloween'
      ? '#f97316'
      : '#c084fc';
  silCtx.fillRect(0, 0, W, H);
  silCtx.restore();

  // 1. Draw thick 12-direction silhouette outline around the character
  const outlineRadius = color === 'b' ? 11 : 9;
  for (let i = 0; i < 12; i++) {
    const angle = (i * Math.PI * 2) / 12;
    const ox = Math.cos(angle) * outlineRadius;
    const oy = Math.sin(angle) * outlineRadius;
    ctx.drawImage(silCanvas, ox, oy);
  }

  // 2. Draw character cutout onto a character layer for team & theme color grading
  const charCanvas = document.createElement('canvas');
  charCanvas.width = W;
  charCanvas.height = H;
  const charCtx = charCanvas.getContext('2d')!;

  charCtx.save();
  if (color === 'b') {
    charCtx.translate(W, 0);
    charCtx.scale(-1, 1);
  }
  charCtx.drawImage(img, 24, 24, W - 48, H - 48);
  charCtx.restore();

  // Apply unmistakable Team & World-Theme Color Grading inside the character's alpha mask!
  charCtx.save();
  charCtx.globalCompositeOperation = 'source-atop';

  if (color === 'w') {
    // TEAM GOLD (Player): Warm sunlit golden-ivory sheen + subtle theme highlight
    const goldGrad = charCtx.createLinearGradient(0, 0, 0, H);
    if (specialTheme === 'ramadan') {
      goldGrad.addColorStop(0, 'rgba(253, 224, 71, 0.22)');
      goldGrad.addColorStop(1, 'rgba(16, 185, 129, 0.18)');
    } else if (specialTheme === 'halloween') {
      goldGrad.addColorStop(0, 'rgba(251, 191, 36, 0.22)');
      goldGrad.addColorStop(1, 'rgba(249, 115, 22, 0.18)');
    } else {
      goldGrad.addColorStop(0, 'rgba(254, 240, 138, 0.20)');
      goldGrad.addColorStop(1, 'rgba(245, 158, 11, 0.16)');
    }
    charCtx.fillStyle = goldGrad;
    charCtx.fillRect(0, 0, W, H);
  } else {
    // TEAM GEGNER ('b'): Distinct Dark Shadow-Amethyst / Obsidian Enemy Army Look!
    const shadowGrad = charCtx.createLinearGradient(0, 0, 0, H);
    if (specialTheme === 'halloween') {
      shadowGrad.addColorStop(0, 'rgba(88, 28, 135, 0.46)');
      shadowGrad.addColorStop(0.6, 'rgba(46, 16, 101, 0.50)');
      shadowGrad.addColorStop(1, 'rgba(234, 88, 12, 0.42)');
    } else if (levelId === 3) {
      shadowGrad.addColorStop(0, 'rgba(69, 10, 10, 0.46)');
      shadowGrad.addColorStop(0.6, 'rgba(88, 28, 135, 0.48)');
      shadowGrad.addColorStop(1, 'rgba(220, 38, 38, 0.42)');
    } else {
      shadowGrad.addColorStop(0, 'rgba(76, 29, 149, 0.45)');
      shadowGrad.addColorStop(0.6, 'rgba(46, 16, 101, 0.50)');
      shadowGrad.addColorStop(1, 'rgba(168, 85, 247, 0.42)');
    }
    charCtx.fillStyle = shadowGrad;
    charCtx.fillRect(0, 0, W, H);
  }
  charCtx.restore();

  ctx.drawImage(charCanvas, 0, 0);

  const outTex = new THREE.CanvasTexture(canvas);
  outTex.colorSpace = THREE.SRGBColorSpace;
  outTex.needsUpdate = true;
  styledHeroTextureCache.set(cacheKey, outTex);
  return outTex;
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
  const spriteRef = useRef<THREE.Group>(null);
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
    new THREE.Vector3(...(fromPosition && isLastMoved ? fromPosition : targetPosition))
  );
  const currentPos = useRef(
    new THREE.Vector3(...(fromPosition && isLastMoved ? fromPosition : targetPosition))
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

  const styledTexture = useMemo(
    () =>
      getStyledTeamAndThemeTexture(
        texture,
        pngPath,
        color,
        levelId,
        specialTheme
      ),
    [texture, pngPath, color, levelId, specialTheme]
  );

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

  // Theme-adapted & Team-distinct Pedestal Palette (Gold Team = Bright Ivory/Emerald/Gold, Enemy Team = Dark Obsidian/Crimson/Shadow-Violet)
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
      startPos.current.copy(currentPos.current);
      prevTarget.current.copy(targetVec);
      jumpProgress.current = 0;
      hasTriggeredLandingDust.current = false;
    }

    if (jumpProgress.current < 1) {
      jumpProgress.current = Math.min(1, jumpProgress.current + delta * 2.35);
      // Smooth cubic ease-in-out horizontal interpolation synchronized with the jump arc!
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

    // Counter-rotating 3D Tactical Rune Compass (Baldur's Gate 3 Selection Ring)
    if (compassOuterRef.current && isSelected) {
      compassOuterRef.current.rotation.y += delta * 1.65;
    }
    if (compassInnerRef.current && isSelected) {
      compassInnerRef.current.rotation.z -= delta * 2.4;
    }

    // Afterimage Ghost Motion-Trail during leap/dash across the board
    const isMovingNow = jumpProgress.current < 0.98;
    if (ghost1Ref.current && ghost2Ref.current) {
      ghost1Ref.current.visible = isMovingNow;
      ghost2Ref.current.visible = isMovingNow;
      if (isMovingNow) {
        const dx = startPos.current.x - currentPos.current.x;
        const dz = startPos.current.z - currentPos.current.z;
        ghost1Ref.current.position.set(
          dx * 0.22,
          topY + baseScale * 0.45 - hopHeight * 0.22,
          dz * 0.22
        );
        ghost2Ref.current.position.set(
          dx * 0.44,
          topY + baseScale * 0.45 - hopHeight * 0.45,
          dz * 0.44
        );
      }
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
      {/* 0. Generous 360° 3D Cylinder Hitbox so clicking a piece in 3D view NEVER misses! */}
      <mesh
        position={[0, topY + baseScale * 0.45, 0]}
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
        <cylinderGeometry args={[0.46, 0.48, baseScale * 1.15 + 0.35, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* 1. Bold Team Identification Floor Aura (Bright Sun-Gold for Player vs. Dark Shadow-Purple for Enemy!) */}
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.34, 0.46, 32]} />
        <meshBasicMaterial
          color={primaryTeamColor}
          side={THREE.DoubleSide}
          transparent
          opacity={isSelected ? 1 : hovered ? 0.92 : 0.78}
        />
      </mesh>

      {/* Baldur's Gate 3 Style Counter-Rotating 3D Tactical Rune Compass when Selected */}
      {isSelected && (
        <group position={[0, 0.024, 0]}>
          <group ref={compassOuterRef}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.45, 0.52, 8]} />
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
                  position={[Math.cos(a) * 0.54, 0.01, Math.sin(a) * 0.54]}
                  rotation={[0, -a, 0]}
                  scale={[0.07, 0.03, 0.12]}
                >
                  <octahedronGeometry args={[1, 0]} />
                  <meshBasicMaterial color="#ffffff" />
                </mesh>
              );
            })}
          </group>
          <mesh ref={compassInnerRef} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.32, 0.37, 6]} />
            <meshBasicMaterial
              color="#ffffff"
              side={THREE.DoubleSide}
              transparent
              opacity={0.85}
            />
          </mesh>
          <Sparkles
            count={18}
            scale={[0.85, 1.1, 0.85]}
            position={[0, 0.55, 0]}
            size={4}
            speed={1.8}
            color={primaryTeamColor}
          />
        </group>
      )}

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

        {/* WORLD-THEME SPECIFIC 3D PEDESTAL REGALIA (Makes Pieces Visually Transform with Each Theme!) */}
        {specialTheme === 'ramadan' && (
          /* Ramadan Theme: 2 Miniature Glowing Golden Fanous Lanterns on Front Corners + Oriental Gold Trim */
          <group>
            {[-0.28, 0.28].map((lx, lIdx) => (
              <group key={`fanous-${lIdx}`} position={[lx, 0.08, 0.26]}>
                <mesh>
                  <cylinderGeometry args={[0.04, 0.05, 0.11, 6]} />
                  <meshStandardMaterial
                    color="#fbbf24"
                    emissive={isGoldTeam ? '#f59e0b' : '#a855f7'}
                    emissiveIntensity={1.4}
                    metalness={0.8}
                  />
                </mesh>
                <mesh position={[0, 0.075, 0]}>
                  <coneGeometry args={[0.05, 0.05, 6]} />
                  <meshStandardMaterial color="#d97706" metalness={0.9} />
                </mesh>
              </group>
            ))}
          </group>
        )}

        {specialTheme === 'halloween' && (
          /* Halloween Theme: 2 Glowing 3D Mini Jack-o'-Lantern Pumpkins on the Pedestal Corners */
          <group>
            {[-0.28, 0.28].map((px, pIdx) => (
              <group key={`pumpkin-${pIdx}`} position={[px, 0.06, 0.26]}>
                <mesh scale={[1, 0.82, 1]}>
                  <sphereGeometry args={[0.065, 10, 8]} />
                  <meshStandardMaterial
                    color={isGoldTeam ? '#f97316' : '#7e22ce'}
                    emissive={isGoldTeam ? '#ea580c' : '#a855f7'}
                    emissiveIntensity={0.85}
                    roughness={0.5}
                  />
                </mesh>
                <mesh position={[0, 0.06, 0]}>
                  <cylinderGeometry args={[0.01, 0.015, 0.03, 5]} />
                  <meshStandardMaterial color="#15803d" />
                </mesh>
              </group>
            ))}
          </group>
        )}

        {specialTheme !== 'ramadan' &&
          specialTheme !== 'halloween' &&
          levelId === 2 && (
            /* Level 2 (Kristall-Katakomben): 4 Glowing 3D Frost/Mana Crystal Clusters Sprouting from the Pedestal */
            <group>
              {[
                [-0.27, 0.24, -0.35],
                [0.27, 0.24, 0.35],
                [-0.27, -0.24, -0.35],
                [0.27, -0.24, 0.35],
              ].map(([cx, cz, tilt], cIdx) => (
                <mesh
                  key={`ice-crys-${cIdx}`}
                  position={[cx, 0.08, cz]}
                  rotation={[0.2, 0, tilt]}
                  scale={[0.05, 0.16, 0.05]}
                >
                  <octahedronGeometry args={[1, 0]} />
                  <meshStandardMaterial
                    color={isGoldTeam ? '#38bdf8' : '#e879f9'}
                    emissive={isGoldTeam ? '#0284c7' : '#c026d3'}
                    emissiveIntensity={1.4}
                    roughness={0.1}
                  />
                </mesh>
              ))}
            </group>
          )}

        {specialTheme !== 'ramadan' &&
          specialTheme !== 'halloween' &&
          levelId === 3 && (
            /* Level 3 (Drachen-Schmiede): 4 Curved Molten Magma Dragon Horns on the Pedestal Corners */
            <group>
              {[
                [-0.28, 0.26, 0.3],
                [0.28, 0.26, -0.3],
                [-0.28, -0.26, 0.3],
                [0.28, -0.26, -0.3],
              ].map(([hx, hz, tilt], hIdx) => (
                <mesh
                  key={`dragon-horn-${hIdx}`}
                  position={[hx, 0.09, hz]}
                  rotation={[-0.25, 0, tilt]}
                >
                  <coneGeometry args={[0.045, 0.18, 6]} />
                  <meshStandardMaterial
                    color={isGoldTeam ? '#fbbf24' : '#dc2626'}
                    emissive={isGoldTeam ? '#ea580c' : '#991b1b'}
                    emissiveIntensity={1.2}
                    roughness={0.3}
                  />
                </mesh>
              ))}
            </group>
          )}
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

      {/* Comet Sparkle Trail + Glowing Afterimage Ghost Silhouettes while Jumping/Dashing */}
      {jumpProgress.current < 1 && (
        <Sparkles
          count={28}
          scale={[0.9, 1.2, 0.9]}
          position={[0, 0.6, 0]}
          size={5}
          speed={2.8}
          color={primaryTeamColor}
        />
      )}

      <group ref={ghost1Ref} visible={false}>
        <Billboard follow={true}>
          <mesh scale={[baseScale * 0.92, baseScale * 0.92, 1]}>
            <planeGeometry args={[0.94, 1.04]} />
            <meshBasicMaterial
              map={styledTexture}
              transparent
              opacity={0.42}
              alphaTest={0.15}
              color={primaryTeamColor}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </Billboard>
      </group>

      <group ref={ghost2Ref} visible={false}>
        <Billboard follow={true}>
          <mesh scale={[baseScale * 0.82, baseScale * 0.82, 1]}>
            <planeGeometry args={[0.94, 1.04]} />
            <meshBasicMaterial
              map={styledTexture}
              transparent
              opacity={0.24}
              alphaTest={0.15}
              color={primaryTeamColor}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </Billboard>
      </group>

      {/* 3. Team-Distinct & Theme-Crested 3D Family Hero Miniature Standee */}
      <Billboard
        position={[0, topY + baseScale * 0.45, 0]}
        follow={true}
        lockX={false}
        lockY={false}
        lockZ={false}
      >
        <group ref={spriteRef} scale={[baseScale, baseScale, baseScale]}>
          {/* Unmistakable 3D Team & Theme Crest Behind the Hero's Shoulders:
              - Team Gold ('w'): Radiant Golden Sun-Halo Arch (or Golden Crescent/Star Arch in Ramadan!)
              - Enemy Team ('b'): Dark Obsidian-Violet Shadow Ring + Spiked Shadow-Crystal Horns! */}
          <group position={[0, 0.04, -0.03]}>
            <mesh>
              <ringGeometry args={[0.36, 0.44, isGoldTeam ? 24 : 6]} />
              <meshBasicMaterial
                color={isGoldTeam ? '#fbbf24' : '#a855f7'}
                transparent
                opacity={0.88}
              />
            </mesh>
            {!isGoldTeam && (
              /* Enemy Army ('b'): 2 Jagged Dark-Crystal Shadow Horns jutting out behind the shoulders so enemies are 100% unmistakable! */
              <>
                <mesh
                  position={[-0.36, 0.24, -0.01]}
                  rotation={[0, 0, 0.55]}
                  scale={[0.08, 0.24, 0.05]}
                >
                  <octahedronGeometry args={[1, 0]} />
                  <meshBasicMaterial color="#c084fc" />
                </mesh>
                <mesh
                  position={[0.36, 0.24, -0.01]}
                  rotation={[0, 0, -0.55]}
                  scale={[0.08, 0.24, 0.05]}
                >
                  <octahedronGeometry args={[1, 0]} />
                  <meshBasicMaterial color="#c084fc" />
                </mesh>
              </>
            )}
            {specialTheme === 'ramadan' && (
              /* Ramadan Theme Finial above the Hero: Golden 8-Pointed Rub el Hizb Star */
              <group position={[0, 0.48, -0.01]}>
                <mesh scale={[0.13, 0.13, 0.03]}>
                  <boxGeometry args={[1, 1, 1]} />
                  <meshBasicMaterial color={isGoldTeam ? '#fde047' : '#e879f9'} />
                </mesh>
                <mesh
                  scale={[0.13, 0.13, 0.03]}
                  rotation={[0, 0, Math.PI / 4]}
                >
                  <boxGeometry args={[1, 1, 1]} />
                  <meshBasicMaterial color={isGoldTeam ? '#f59e0b' : '#a855f7'} />
                </mesh>
              </group>
            )}
            {specialTheme === 'halloween' && (
              /* Halloween Theme Finial behind the Hero: Gothic Bat-Crest Diamonds */
              <group position={[0, 0.46, -0.01]}>
                <mesh
                  position={[-0.14, 0, 0]}
                  rotation={[0, 0, 0.4]}
                  scale={[0.12, 0.05, 0.02]}
                >
                  <octahedronGeometry args={[1, 0]} />
                  <meshBasicMaterial color="#f97316" />
                </mesh>
                <mesh
                  position={[0.14, 0, 0]}
                  rotation={[0, 0, -0.4]}
                  scale={[0.12, 0.05, 0.02]}
                >
                  <octahedronGeometry args={[1, 0]} />
                  <meshBasicMaterial color="#f97316" />
                </mesh>
              </group>
            )}
          </group>

          {/* Crisp Rim-Light Silhouette Edge */}
          <mesh position={[0, 0, -0.018]}>
            <planeGeometry args={[0.98, 1.08]} />
            <meshBasicMaterial
              map={styledTexture}
              transparent
              alphaTest={0.14}
              color={isSelected ? '#ffffff' : primaryTeamColor}
            />
          </mesh>

          {/* Main Team-Graded & Outlined Character Cutout */}
          <mesh castShadow>
            <planeGeometry args={[0.94, 1.04]} />
            <meshStandardMaterial
              map={styledTexture}
              color={isGoldTeam ? '#ffffff' : '#e9d5ff'}
              transparent
              alphaTest={0.1}
              roughness={0.35}
              metalness={0.08}
              emissive={
                isFrozen
                  ? '#0284c7'
                  : isShielded
                  ? '#b45309'
                  : isSelected
                  ? primaryTeamColor
                  : isGoldTeam
                  ? '#451a03'
                  : '#3b0764'
              }
              emissiveIntensity={
                isFrozen || isShielded
                  ? 0.45
                  : isSelected
                  ? 0.22
                  : isGoldTeam
                  ? 0.06
                  : 0.18
              }
            />
          </mesh>
        </group>

        {/* 3D Comic Speech Bubble for King in Check or Hero Action! */}
        {(isCheckThreatened || showActionBubble) && (
          <Html
            position={[0, baseScale * 0.68, 0]}
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
