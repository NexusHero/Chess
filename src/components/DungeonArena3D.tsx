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
  quote: string;
  accentColor: string;
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
  kidMode: boolean;
  showAllNames: boolean;
  cameraPreset: CameraPreset;
  captureEffect: ActiveCaptureEffect | null;
  onSquareClick: (sq: Square) => void;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

export function squareToWorld(sq: Square): [number, number, number] {
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
      {/* Ancient Carved Stone Pillar */}
      <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.38, 0.48, 2.2, 8]} />
        <meshStandardMaterial color={pillarColor} roughness={0.85} metalness={0.15} />
      </mesh>
      {/* Brazier Bowl */}
      <mesh position={[0, 2.08, 0]} castShadow>
        <cylinderGeometry args={[0.45, 0.25, 0.24, 8]} />
        <meshStandardMaterial color="#27272a" roughness={0.4} metalness={0.8} />
      </mesh>
      {/* Flickering Magical Flame */}
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

const CaptureExplosion3D: React.FC<{ effect: ActiveCaptureEffect }> = ({ effect }) => {
  const ringRef = useRef<THREE.Mesh>(null);
  const pos = useMemo(() => squareToWorld(effect.square), [effect.square]);

  useFrame((_, delta) => {
    if (ringRef.current) {
      ringRef.current.scale.x += delta * 4.5;
      ringRef.current.scale.y += delta * 4.5;
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, mat.opacity - delta * 0.85);
    }
  });

  return (
    <group position={[pos[0], 0.15, pos[2]]}>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.2, 0.45, 32]} />
        <meshBasicMaterial
          color={effect.accentColor}
          transparent
          opacity={0.95}
          side={THREE.DoubleSide}
        />
      </mesh>
      <Sparkles
        count={45}
        scale={2.4}
        size={6}
        speed={2.5}
        color={effect.accentColor}
      />
      {/* Comic / RPG Battle Cry Speech Bubble */}
      <Html position={[0, 2.15, 0]} center zIndexRange={[30, 0]}>
        <div className="animate-bounce pointer-events-none px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-950/95 via-slate-900/95 to-purple-950/95 border-2 border-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.6)] text-center min-w-[210px]">
          <div className="text-[11px] uppercase tracking-wider font-extrabold text-amber-300">
            ⚔️ {effect.attackerName} schlägt zu!
          </div>
          <div className="text-xs sm:text-sm font-bold text-white mt-0.5">
            „{effect.quote}“
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

    // Dramatic subtle zoom focus during a capture!
    if (captureEffect) {
      const [tx, , tz] = squareToWorld(captureEffect.square);
      controlsRef.current.target.lerp(new THREE.Vector3(tx * 0.45, 0.3, tz * 0.45), delta * 4);
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
      minDistance={5.2}
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
  kidMode,
  showAllNames,
  cameraPreset,
  captureEffect,
  onSquareClick,
}) => {
  // Parse current board state whenever FEN updates
  const boardPieces = useMemo(() => {
    const b = game.board();
    const list: {
      square: Square;
      type: PieceRole;
      color: 'w' | 'b';
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
      <ambientLight color={level.theme.ambientColor} intensity={level.theme.ambientIntensity} />
      <directionalLight
        castShadow
        position={[6, 12, 7]}
        intensity={1.35}
        color="#fffbeb"
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      <Stars radius={30} depth={25} count={900} factor={2.5} saturation={0.5} fade speed={0.8} />
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
        <meshStandardMaterial color={level.theme.floorColor} roughness={0.9} metalness={0.1} />
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
        <meshBasicMaterial color={level.theme.runeGlowColor} transparent opacity={0.45} />
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
            const isHintTile =
              hintMove?.from === sq || hintMove?.to === sq;

            const tileX = cIdx - 3.5;
            const tileZ = rIdx - 3.5;

            let tileColor = isLight
              ? level.theme.lightTileColor
              : level.theme.darkTileColor;
            let emissiveColor = '#000000';
            let emissiveIntensity = 0;

            if (isSelected) {
              emissiveColor = '#f59e0b';
              emissiveIntensity = 0.65;
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
                      // Red/Orange Target Crosshair Ring for Captures
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
                      // Magical Glowing Rune Dot for Normal Moves
                      <mesh rotation={[-Math.PI / 2, 0, 0]}>
                        <circleGeometry args={[kidMode ? 0.22 : 0.16, 20]} />
                        <meshBasicMaterial
                          color={kidMode ? '#34d399' : level.theme.runeGlowColor}
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

      {/* All 32 Family Hero Pieces on the Board */}
      <group>
        {boardPieces.map((p) => {
          const heroCfg = heroes[p.type];
          const isThreatenedKing =
            p.type === 'k' && inCheckColor === p.color;
          const isLastMoved = lastMove?.to === p.square;

          return (
            <FamilyHeroPiece3D
              key={`${p.color}-${p.type}-${p.square}`}
              role={p.type}
              color={p.color}
              targetPosition={[p.pos[0], 0.06, p.pos[2]]}
              heroConfig={heroCfg}
              isSelected={selectedSquare === p.square}
              isCheckThreatened={isThreatenedKing}
              isLastMoved={isLastMoved}
              showNameplate={showAllNames}
              onSelect={() => onSquareClick(p.square)}
            />
          );
        })}
      </group>

      {/* Active Sword/Magic Capture Explosion & Speech Bubble */}
      {captureEffect && <CaptureExplosion3D effect={captureEffect} />}

      <CameraDirector preset={cameraPreset} captureEffect={captureEffect} />
    </>
  );
};
