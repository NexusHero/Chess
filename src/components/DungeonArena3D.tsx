import React, { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Sparkles, Stars, Text, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Chess, Square } from 'chess.js';
import {
  DungeonLevelConfig,
  FamilyHeroConfig,
  PieceRole,
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
  kidMode: boolean;
  showAllNames: boolean;
  cameraPreset: CameraPreset;
  captureEffect: ActiveCaptureEffect | null;
  onSquareClick: (sq: Square) => void;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

export function squareToWorld(sq: Square | string): [number, number, number] {
  const fileIndex = FILES.indexOf(sq[0]);
  const rankIndex = RANKS.indexOf(sq[1]);
  return [fileIndex - 3.5, 0, rankIndex - 3.5];
}

const TorchPillar: React.FC<{
  position: [number, number, number];
  pillarColor: string;
  flameColor: string;
}> = ({ position, pillarColor, flameColor }) => {
  const flameRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime + position[0] * 1.3;
    if (flameRef.current) {
      const s = 1 + Math.sin(t * 9) * 0.14 + Math.cos(t * 15) * 0.08;
      flameRef.current.scale.set(s, s * 1.25, s);
    }
    if (lightRef.current) {
      lightRef.current.intensity = 1.9 + Math.sin(t * 11) * 0.35;
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
        <meshStandardMaterial color="#27272a" roughness={0.4} metalness={0.8} />
      </mesh>
      <mesh ref={flameRef} position={[0, 2.38, 0]}>
        <dodecahedronGeometry args={[0.24, 1]} />
        <meshBasicMaterial color={flameColor} />
      </mesh>
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

// Battle-Chess 3D Clash Duel Effect + Parachute Beam-Out + Speech Bubble
const BattleChessClash3D: React.FC<{ effect: ActiveCaptureEffect }> = ({
  effect,
}) => {
  const ringRef = useRef<THREE.Mesh>(null);
  const beamRef = useRef<THREE.Mesh>(null);
  const pos = useMemo(() => squareToWorld(effect.square), [effect.square]);

  // Role-specific 3D weapon / magic projectile
  const isMagicAttacker =
    effect.attackerRole === 'q' || effect.attackerRole === 'b';

  useFrame((_, delta) => {
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

      <Sparkles
        count={60}
        scale={2.8}
        size={7}
        speed={3.2}
        color={effect.accentColor}
      />

      {/* Battle-Chess Mini-Duel Card & Parachute Retreat Animation */}
      <Html position={[0, 2.35, 0]} center zIndexRange={[40, 0]}>
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

const CameraDirector: React.FC<{
  preset: CameraPreset;
  captureEffect: ActiveCaptureEffect | null;
}> = ({ preset, captureEffect }) => {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  useFrame((_, delta) => {
    if (!controlsRef.current) return;

    // Dramatic Battle-Chess Close-up Zoom during a Capture!
    if (captureEffect) {
      const [tx, , tz] = squareToWorld(captureEffect.square);
      controlsRef.current.target.lerp(
        new THREE.Vector3(tx * 0.65, 0.45, tz * 0.65),
        delta * 4.5
      );
      controlsRef.current.update();
      return;
    }

    controlsRef.current.target.lerp(new THREE.Vector3(0, 0, 0), delta * 4);

    let desiredPos: THREE.Vector3 | null = null;
    if (preset === 'top') {
      desiredPos = new THREE.Vector3(0, 10.5, 0.01);
    } else if (preset === 'table-white') {
      desiredPos = new THREE.Vector3(0, 6.2, 6.8);
    } else if (preset === 'table-black') {
      desiredPos = new THREE.Vector3(0, 6.2, -6.8);
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

      {/* Dungeon Floor & Carved Stone Pedestal */}
      <mesh position={[0, -0.55, 0]} receiveShadow>
        <cylinderGeometry args={[7.6, 8.8, 0.7, 16]} />
        <meshStandardMaterial
          color={level.theme.floorColor}
          roughness={0.9}
          metalness={0.1}
        />
      </mesh>

      {/* Outer Ornate Dungeon Chessboard Frame */}
      <mesh position={[0, -0.14, 0]} receiveShadow castShadow>
        <boxGeometry args={[8.9, 0.28, 8.9]} />
        <meshStandardMaterial
          color={level.theme.boardTrimColor}
          roughness={0.45}
          metalness={0.55}
        />
      </mesh>

      {/* Glowing Runic Border Trim */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[5.75, 5.95, 4, 1, Math.PI / 4]} />
        <meshBasicMaterial
          color={level.theme.runeGlowColor}
          transparent
          opacity={0.45}
        />
      </mesh>

      {/* 4 Corner Dungeon Torch Pillars */}
      <TorchPillar
        position={[-5.1, -0.2, -5.1]}
        pillarColor={level.theme.pillarColor}
        flameColor={level.theme.torchColor}
      />
      <TorchPillar
        position={[5.1, -0.2, -5.1]}
        pillarColor={level.theme.pillarColor}
        flameColor={level.theme.torchColor}
      />
      <TorchPillar
        position={[-5.1, -0.2, 5.1]}
        pillarColor={level.theme.pillarColor}
        flameColor={level.theme.torchColor}
      />
      <TorchPillar
        position={[5.1, -0.2, 5.1]}
        pillarColor={level.theme.pillarColor}
        flameColor={level.theme.torchColor}
      />

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
              <group key={sq} position={[tileX, 0, tileZ]}>
                <mesh
                  receiveShadow
                  onClick={(e) => {
                    e.stopPropagation();
                    onSquareClick(sq);
                  }}
                >
                  <boxGeometry args={[0.96, 0.12, 0.96]} />
                  <meshStandardMaterial
                    color={tileColor}
                    roughness={isLight ? 0.55 : 0.7}
                    metalness={0.18}
                    emissive={emissiveColor}
                    emissiveIntensity={emissiveIntensity}
                  />
                </mesh>

                {/* Glowing Dungeon Rune Indicator for Legal Moves */}
                {isLegalTarget && (
                  <group
                    position={[0, 0.075, 0]}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSquareClick(sq);
                    }}
                  >
                    {isCaptureTarget ? (
                      <mesh rotation={[-Math.PI / 2, 0, 0]}>
                        <ringGeometry args={[0.33, 0.45, 24]} />
                        <meshBasicMaterial
                          color="#ef4444"
                          side={THREE.DoubleSide}
                          transparent
                          opacity={0.9}
                        />
                      </mesh>
                    ) : (
                      <mesh rotation={[-Math.PI / 2, 0, 0]}>
                        <circleGeometry args={[kidMode ? 0.22 : 0.16, 20]} />
                        <meshBasicMaterial
                          color={
                            kidMode ? '#34d399' : level.theme.runeGlowColor
                          }
                          transparent
                          opacity={0.88}
                        />
                      </mesh>
                    )}
                  </group>
                )}
              </group>
            );
          })
        )}
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
          // Alternate the two Cousin skins across odd/even files so BOTH Cousins from the bench photo are on the board!
          const useSecondCousin = p.type === 'p' && p.fileIndex % 2 === 1;

          return (
            <FamilyHeroPiece3D
              key={`${p.color}-${p.type}-${p.square}`}
              role={p.type}
              color={p.color}
              targetPosition={[p.pos[0], 0.06, p.pos[2]]}
              heroConfig={heroCfg}
              useSecondarySkin={useSecondCousin}
              isSelected={selectedSquare === p.square}
              isCheckThreatened={isThreatenedKing}
              isShielded={shieldedSquares.includes(p.square)}
              isFrozen={frozenSquares.includes(p.square)}
              isLastMoved={isLastMoved}
              showNameplate={showAllNames}
              onSelect={() => onSquareClick(p.square)}
            />
          );
        })}
      </group>

      {/* Battle-Chess 3D Clash Effect & Speech Bubble */}
      {captureEffect && <BattleChessClash3D effect={captureEffect} />}

      <CameraDirector preset={cameraPreset} captureEffect={captureEffect} />
    </>
  );
};
