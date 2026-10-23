import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Chess, Move, Square } from 'chess.js';
import confetti from 'canvas-confetti';
import {
  Crown,
  Swords,
  Users,
  Bot,
  Sparkles,
  Volume2,
  VolumeX,
  RotateCcw,
  Undo2,
  Lightbulb,
  Camera,
  ShieldAlert,
  Baby,
  Eye,
  Trophy,
} from 'lucide-react';
import {
  DEFAULT_FAMILY_HEROES,
  DUNGEON_LEVELS,
  FamilyHeroConfig,
  PieceRole,
} from './data/familyConfig';
import {
  ActiveCaptureEffect,
  CameraPreset,
  DungeonArena3D,
} from './components/DungeonArena3D';
import { FamilyHeroModal } from './components/FamilyHeroModal';
import { chooseDungeonAIMove, findHelpfulHintMove } from './utils/chessAI';
import { soundFX } from './utils/sound';

const STORAGE_KEY_HEROES = 'family_dungeon_chess_heroes_v1';
const STORAGE_KEY_STARS = 'family_dungeon_chess_stars_v1';

export const App: React.FC = () => {
  // 1. Custom Family Hero Names & Quotes persisted in localStorage
  const [heroes, setHeroes] = useState<Record<PieceRole, FamilyHeroConfig>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HEROES);
      if (saved) {
        return { ...DEFAULT_FAMILY_HEROES, ...JSON.parse(saved) };
      }
    } catch {
      // ignore
    }
    return DEFAULT_FAMILY_HEROES;
  });

  // 2. Stars/Crowns earned per Dungeon Level (1, 2, 3)
  const [levelStars, setLevelStars] = useState<Record<number, number>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_STARS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return { 1: 0, 2: 0, 3: 0 };
  });

  const [currentLevelId, setCurrentLevelId] = useState<1 | 2 | 3>(1);
  const currentLevel = useMemo(
    () => DUNGEON_LEVELS.find((l) => l.id === currentLevelId) || DUNGEON_LEVELS[0],
    [currentLevelId]
  );

  // Game Mode: 'campaign' (1P vs Dungeon AI) or 'local2p' (2P Family Pass & Play)
  const [gameMode, setGameMode] = useState<'campaign' | 'local2p'>('campaign');
  const [kidMode, setKidMode] = useState<boolean>(true);
  const [showAllNames, setShowAllNames] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('orbit');
  const [isHeroModalOpen, setIsHeroModalOpen] = useState<boolean>(false);

  // Chess Engine State
  const gameRef = useRef<Chess>(new Chess());
  const [fen, setFen] = useState<string>(gameRef.current.fen());
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [hintMove, setHintMove] = useState<{ from: Square; to: Square } | null>(null);
  const [captureEffect, setCaptureEffect] = useState<ActiveCaptureEffect | null>(null);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [capturedByGold, setCapturedByGold] = useState<PieceRole[]>([]);
  const [capturedByPurple, setCapturedByPurple] = useState<PieceRole[]>([]);
  const [isAIThinking, setIsAIThinking] = useState<boolean>(false);

  const handleSaveHeroes = (updated: Record<PieceRole, FamilyHeroConfig>) => {
    setHeroes(updated);
    try {
      localStorage.setItem(STORAGE_KEY_HEROES, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundFX.enabled = next;
  };

  // Legal moves for the currently selected square
  const legalMoves = useMemo(() => {
    if (!selectedSquare) return [];
    const moves = gameRef.current.moves({
      square: selectedSquare,
      verbose: true,
    }) as Move[];
    return moves.map((m) => ({
      to: m.to as Square,
      isCapture: Boolean(m.captured || m.flags.includes('e')),
    }));
  }, [selectedSquare, fen]);

  // Trigger dramatic capture explosion + character quote
  const triggerCaptureEffect = useCallback(
    (move: Move) => {
      const attackerRole = move.piece as PieceRole;
      const heroCfg = heroes[attackerRole];
      const quotes = heroCfg.captureQuotes;
      const randomQuote =
        quotes[Math.floor(Math.random() * quotes.length)] || heroCfg.battleCry;

      setCaptureEffect({
        id: `${Date.now()}-${move.to}`,
        square: move.to as Square,
        attackerName: heroCfg.customName,
        attackerRole,
        attackerColor: move.color,
        quote: randomQuote,
        accentColor: heroCfg.accentColor,
      });

      setTimeout(() => {
        setCaptureEffect((prev) =>
          prev && prev.square === move.to ? null : prev
        );
      }, 2800);
    },
    [heroes]
  );

  // Execute a validated move on the board
  const executeMove = useCallback(
    (from: Square, to: Square): boolean => {
      const game = gameRef.current;
      try {
        const moveResult = game.move({
          from,
          to,
          promotion: 'q', // Auto-promote pawns to the Queen (Mama!) with golden fanfare
        });

        if (!moveResult) return false;

        setFen(game.fen());
        setSelectedSquare(null);
        setHintMove(null);
        setLastMove({ from, to });
        setMoveHistory(game.history());

        if (moveResult.captured) {
          soundFX.playCapture();
          triggerCaptureEffect(moveResult);
          if (moveResult.color === 'w') {
            setCapturedByGold((prev) => [...prev, moveResult.captured as PieceRole]);
          } else {
            setCapturedByPurple((prev) => [...prev, moveResult.captured as PieceRole]);
          }
        } else {
          soundFX.playMove();
        }

        if (game.isCheckmate()) {
          soundFX.playVictory();
          confetti({
            particleCount: 110,
            spread: 80,
            origin: { y: 0.6 },
          });
          // Award 3 crowns if Gold wins in Campaign mode
          if (gameMode === 'campaign' && moveResult.color === 'w') {
            setLevelStars((prev) => {
              const updated = { ...prev, [currentLevelId]: 3 };
              try {
                localStorage.setItem(STORAGE_KEY_STARS, JSON.stringify(updated));
              } catch {
                // ignore
              }
              return updated;
            });
          }
        } else if (game.inCheck()) {
          soundFX.playCheck();
        }

        // In 2-player Table Mode, optionally rotate camera perspective
        if (
          gameMode === 'local2p' &&
          (cameraPreset === 'table-white' || cameraPreset === 'table-black')
        ) {
          setCameraPreset(game.turn() === 'w' ? 'table-white' : 'table-black');
        }

        return true;
      } catch {
        return false;
      }
    },
    [cameraPreset, currentLevelId, gameMode, triggerCaptureEffect]
  );

  // AI Response Turn in 1-Player Campaign Mode
  useEffect(() => {
    const game = gameRef.current;
    if (
      gameMode === 'campaign' &&
      !game.isGameOver() &&
      game.turn() === 'b'
    ) {
      setIsAIThinking(true);
      const timer = setTimeout(() => {
        const aiMove = chooseDungeonAIMove(
          game.fen(),
          currentLevel.aiDepth,
          currentLevel.aiRandomness
        );
        if (aiMove) {
          executeMove(aiMove.from as Square, aiMove.to as Square);
        }
        setIsAIThinking(false);
      }, 650);
      return () => clearTimeout(timer);
    }
  }, [fen, gameMode, currentLevel, executeMove]);

  // Handle clicking any square or 3D hero piece
  const handleSquareClick = (sq: Square) => {
    const game = gameRef.current;
    if (game.isGameOver() || isAIThinking) return;

    // In 1P mode, player controls Team Gold ('w')
    if (gameMode === 'campaign' && game.turn() === 'b') return;

    // If clicking a legal target square for the selected piece -> move!
    if (selectedSquare) {
      const isLegal = legalMoves.some((m) => m.to === sq);
      if (isLegal) {
        executeMove(selectedSquare, sq);
        return;
      }
    }

    // Otherwise check if clicking a friendly piece to select it
    const clickedPiece = game.get(sq);
    if (clickedPiece && clickedPiece.color === game.turn()) {
      soundFX.playSelect();
      setSelectedSquare(sq === selectedSquare ? null : sq);
      setHintMove(null);
    } else {
      setSelectedSquare(null);
    }
  };

  const handleNewGame = () => {
    gameRef.current = new Chess();
    setFen(gameRef.current.fen());
    setSelectedSquare(null);
    setLastMove(null);
    setHintMove(null);
    setCaptureEffect(null);
    setMoveHistory([]);
    setCapturedByGold([]);
    setCapturedByPurple([]);
    setIsAIThinking(false);
    soundFX.playSelect();
  };

  const handleUndo = () => {
    const game = gameRef.current;
    if (game.history().length === 0 || isAIThinking) return;
    if (gameMode === 'campaign') {
      // Undo both AI move and Player move
      game.undo();
      game.undo();
    } else {
      game.undo();
    }
    setFen(game.fen());
    setSelectedSquare(null);
    setHintMove(null);
    setMoveHistory(game.history());
    soundFX.playSelect();
  };

  const handleShowHint = () => {
    const game = gameRef.current;
    if (game.isGameOver() || isAIThinking) return;
    const best = findHelpfulHintMove(game.fen());
    if (best) {
      soundFX.playSelect();
      setSelectedSquare(best.from as Square);
      setHintMove({ from: best.from as Square, to: best.to as Square });
    }
  };

  const turnColor = gameRef.current.turn();
  const isCheck = gameRef.current.inCheck();
  const isCheckmate = gameRef.current.isCheckmate();
  const isDraw = gameRef.current.isDraw();

  const selectedPieceInfo = useMemo(() => {
    if (!selectedSquare) return null;
    const p = gameRef.current.get(selectedSquare);
    if (!p) return null;
    return {
      piece: p,
      hero: heroes[p.type as PieceRole],
    };
  }, [selectedSquare, fen, heroes]);

  return (
    <div
      className="relative w-full h-full flex flex-col justify-between overflow-hidden select-none"
      style={{ background: currentLevel.theme.bgGradient }}
    >
      {/* 3D WebGL Dungeon Canvas */}
      <div className="absolute inset-0 z-0">
        <Canvas
          shadows
          camera={{ position: [0, 7.2, 7.4], fov: 42 }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
        >
          <Suspense fallback={null}>
            <DungeonArena3D
              game={gameRef.current}
              fen={fen}
              level={currentLevel}
              heroes={heroes}
              selectedSquare={selectedSquare}
              legalMoves={legalMoves}
              lastMove={lastMove}
              hintMove={hintMove}
              kidMode={kidMode}
              showAllNames={showAllNames}
              cameraPreset={cameraPreset}
              captureEffect={captureEffect}
              onSquareClick={handleSquareClick}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* TOP HUD: Title, Level Switcher (1-3) & Quick Controls */}
      <header className="relative z-10 flex flex-wrap items-center justify-between gap-2 px-3 sm:px-6 py-2.5 bg-gradient-to-b from-black/85 via-black/55 to-transparent pointer-events-auto">
        {/* Brand Title */}
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30 border border-amber-200">
            <Crown className="w-6 h-6 text-black" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-dungeon text-base sm:text-xl font-black tracking-wider text-amber-200 drop-shadow">
                FAMILY DUNGEON CHESS
              </h1>
              <span className="hidden md:inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40">
                3D Edition
              </span>
            </div>
            <p className="text-[11px] text-amber-100/75 hidden sm:block">
              {currentLevel.name} — <span className="text-amber-300">{currentLevel.subtitle}</span>
            </p>
          </div>
        </div>

        {/* 3 Dungeon Levels Selector with Stars/Crowns */}
        <div className="flex items-center gap-1.5 bg-black/60 p-1 rounded-2xl border border-amber-500/30 backdrop-blur-md">
          {DUNGEON_LEVELS.map((lvl) => {
            const active = lvl.id === currentLevelId;
            const stars = levelStars[lvl.id] || 0;
            return (
              <button
                key={lvl.id}
                onClick={() => {
                  setCurrentLevelId(lvl.id);
                  soundFX.playSelect();
                }}
                className={`px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  active
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-md'
                    : 'text-amber-100/75 hover:bg-white/10'
                }`}
              >
                <span>Level {lvl.id}</span>
                <span className="flex items-center text-[10px]">
                  {stars > 0 ? '👑'.repeat(stars) : '⚔️'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Mode & Family Customization Action Buttons */}
        <div className="flex items-center gap-2">
          {/* 1P Campaign vs 2P Family Table Toggle */}
          <div className="flex bg-black/60 p-1 rounded-xl border border-white/15">
            <button
              onClick={() => {
                setGameMode('campaign');
                setCameraPreset('orbit');
                soundFX.playSelect();
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                gameMode === 'campaign'
                  ? 'bg-amber-500 text-black'
                  : 'text-amber-100/70 hover:text-white'
              }`}
              title="1-Spieler Kampagne gegen die 3 Dungeon-Bosse"
            >
              <Bot className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">1P Dungeon</span>
            </button>
            <button
              onClick={() => {
                setGameMode('local2p');
                soundFX.playSelect();
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                gameMode === 'local2p'
                  ? 'bg-purple-500 text-white'
                  : 'text-amber-100/70 hover:text-white'
              }`}
              title="2-Spieler Familien-Duell am selben Gerät"
            >
              <Users className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">2P Familie</span>
            </button>
          </div>

          {/* Open Family Hero Customizer */}
          <button
            onClick={() => setIsHeroModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border border-purple-300/40 shadow-lg transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Familie & Namen</span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className="p-2 rounded-xl bg-black/60 hover:bg-white/15 text-amber-200 border border-white/15 transition"
            title={soundEnabled ? 'Ton ausschalten' : 'Ton einschalten'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 opacity-50" />}
          </button>
        </div>
      </header>

      {/* MIDDLE FLOATING BANNERS: Turn Status, Check Alert & Selected Family Hero Card */}
      <div className="relative z-10 pointer-events-none flex-1 flex flex-col justify-between p-3 sm:p-5">
        {/* Top-Center Status Pill */}
        <div className="flex flex-col items-center gap-2">
          <div className="pointer-events-auto flex items-center gap-3 px-4 py-1.5 rounded-full bg-black/75 border border-amber-500/40 backdrop-blur-md shadow-xl">
            <div
              className={`w-3 h-3 rounded-full animate-pulse ${
                turnColor === 'w'
                  ? 'bg-amber-400 shadow-[0_0_10px_#fbbf24]'
                  : 'bg-purple-400 shadow-[0_0_10px_#c084fc]'
              }`}
            />
            <span className="text-xs sm:text-sm font-bold text-amber-100">
              {isCheckmate ? (
                <span className="text-amber-300 font-extrabold">
                  🏆 SCHACHMATT! {turnColor === 'w' ? 'Team Kristall-Violett' : 'Team Gold-Licht'} gewinnt!
                </span>
              ) : isDraw ? (
                <span>🤝 Unentschieden im Dungeon!</span>
              ) : isAIThinking ? (
                <span className="text-purple-300">
                  🔮 {currentLevel.bossName} überlegt seinen Zug...
                </span>
              ) : turnColor === 'w' ? (
                <span>☀️ Team Gold ({heroes.k.customName} & {heroes.q.customName}) ist am Zug</span>
              ) : gameMode === 'local2p' ? (
                <span>🌙 Team Kristall-Violett ist am Zug</span>
              ) : (
                <span>🌙 {currentLevel.bossName} ist am Zug</span>
              )}
            </span>

            {isCheck && !isCheckmate && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 text-white text-[11px] font-extrabold animate-bounce">
                <ShieldAlert className="w-3.5 h-3.5" />
                SCHACH!
              </span>
            )}
          </div>
        </div>

        {/* Left & Right Floating Cards (Selected Hero Details + Captured Pieces) */}
        <div className="flex items-end justify-between gap-4">
          {/* Selected Family Hero Inspector Card */}
          {selectedPieceInfo ? (
            <div className="pointer-events-auto max-w-xs sm:max-w-sm p-3.5 rounded-2xl bg-black/80 border-2 border-amber-400/60 backdrop-blur-md shadow-2xl flex items-center gap-3.5 animate-float">
              <img
                src={selectedPieceInfo.hero.spritePath}
                alt={selectedPieceInfo.hero.customName}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border-2 border-amber-300 shrink-0"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-amber-500 text-black text-[10px] font-extrabold uppercase">
                    {selectedPieceInfo.hero.chessName}
                  </span>
                  <span className="text-xs font-bold text-amber-300 truncate">
                    {selectedPieceInfo.hero.dungeonClass}
                  </span>
                </div>
                <h3 className="font-dungeon text-base sm:text-lg font-extrabold text-white truncate mt-0.5">
                  {selectedPieceInfo.hero.customName}
                </h3>
                <p className="text-[11px] text-amber-100/80 italic line-clamp-2">
                  „{selectedPieceInfo.hero.battleCry}“
                </p>
              </div>
            </div>
          ) : (
            <div className="hidden sm:flex pointer-events-auto items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-black/65 border border-white/10 backdrop-blur-md text-xs text-amber-100/80">
              <Swords className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Tippe auf eine <strong>Familien-Figur</strong>, um ihre leuchtenden Dungeon-Züge zu sehen!
              </span>
            </div>
          )}

          {/* Captured Pieces & Level Info Pill */}
          <div className="hidden md:flex flex-col items-end gap-1.5 pointer-events-auto">
            <div className="px-3.5 py-2 rounded-2xl bg-black/75 border border-white/15 backdrop-blur-md text-right">
              <div className="text-[10px] uppercase tracking-wider text-amber-300 font-bold">
                {currentLevel.difficultyLabel}
              </div>
              <div className="flex items-center justify-end gap-3 mt-1 text-xs">
                <div>
                  <span className="text-amber-300 font-bold">☀️ Beute: </span>
                  {capturedByGold.length === 0 ? (
                    <span className="opacity-40">–</span>
                  ) : (
                    capturedByGold.map((r, i) => (
                      <span key={i} className="mr-0.5" title={heroes[r].customName}>
                        {heroes[r].chessName[0]}
                      </span>
                    ))
                  )}
                </div>
                <div className="border-l border-white/20 pl-3">
                  <span className="text-purple-300 font-bold">🌙 Beute: </span>
                  {capturedByPurple.length === 0 ? (
                    <span className="opacity-40">–</span>
                  ) : (
                    capturedByPurple.map((r, i) => (
                      <span key={i} className="mr-0.5" title={heroes[r].customName}>
                        {heroes[r].chessName[0]}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* VICTORY / GAME OVER MODAL OVERLAY */}
      {(isCheckmate || isDraw) && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="max-w-md w-full p-6 rounded-3xl bg-gradient-to-b from-amber-950/95 via-slate-900/95 to-purple-950/95 border-2 border-amber-400 shadow-[0_0_60px_rgba(251,191,36,0.5)] text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-400 text-black flex items-center justify-center shadow-lg">
              <Trophy className="w-9 h-9" />
            </div>
            <h2 className="font-dungeon text-2xl sm:text-3xl font-black text-amber-200">
              {isCheckmate
                ? turnColor === 'b'
                  ? 'SIEG FÜR DIE FAMILIE!'
                  : 'DER DUNGEON HAT GESIEGT!'
                : 'UNENTSCHIEDEN!'}
            </h2>
            <p className="text-sm text-amber-100/85">
              {isCheckmate && turnColor === 'b'
                ? `${heroes.k.customName}, ${heroes.q.customName}, ${heroes.n.customName} und die ganze Familie haben ${currentLevel.name} gemeistert!`
                : 'Was für eine spannende Schlacht auf dem Runen-Schachbrett!'}
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={handleNewGame}
                className="px-5 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-400 to-orange-500 text-black shadow-lg"
              >
                Nochmal spielen
              </button>
              {currentLevelId < 3 && (
                <button
                  onClick={() => {
                    setCurrentLevelId((prev) => (prev === 1 ? 2 : 3));
                    handleNewGame();
                  }}
                  className="px-5 py-2.5 rounded-xl font-bold text-sm bg-purple-600 hover:bg-purple-500 text-white border border-purple-300/40"
                >
                  Nächstes Dungeon-Level →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM DOCK: Kid-Helper, Tipp, Undo, Camera Angles & New Game */}
      <footer className="relative z-10 flex flex-wrap items-center justify-between gap-2 px-3 sm:px-6 py-2.5 bg-gradient-to-t from-black/90 via-black/70 to-transparent pointer-events-auto">
        {/* Left Helper Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setKidMode((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
              kidMode
                ? 'bg-emerald-600/90 text-white border-emerald-300/50 shadow-md shadow-emerald-600/20'
                : 'bg-black/60 text-amber-100/70 border-white/15 hover:bg-white/10'
            }`}
            title="Kinder- & Einsteiger-Hilfe: Zeigt leuchtende Zug-Punkte und Angriffs-Warnungen"
          >
            <Baby className="w-4 h-4" />
            <span>Kinder-Hilfe {kidMode ? 'AN' : 'AUS'}</span>
          </button>

          <button
            onClick={handleShowHint}
            disabled={isAIThinking}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-600/80 hover:bg-sky-500 text-white border border-sky-300/40 transition disabled:opacity-40"
            title="Zeigt dir den besten Zug für deine Familie"
          >
            <Lightbulb className="w-4 h-4 text-amber-200" />
            <span>Zug-Tipp</span>
          </button>

          <button
            onClick={() => setShowAllNames((v) => !v)}
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
              showAllNames
                ? 'bg-amber-500/90 text-black border-amber-300'
                : 'bg-black/60 text-amber-100/75 border-white/15 hover:bg-white/10'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Alle Namen</span>
          </button>
        </div>

        {/* Center Camera Perspectives */}
        <div className="flex items-center gap-1 bg-black/65 p-1 rounded-xl border border-white/15">
          <Camera className="w-3.5 h-3.5 text-amber-400 ml-2 mr-1 hidden sm:inline" />
          {(
            [
              { id: 'orbit', label: '3D Frei' },
              { id: 'table-white', label: 'Team Gold' },
              { id: 'table-black', label: 'Team Violett' },
              { id: 'top', label: 'Von Oben' },
            ] as { id: CameraPreset; label: string }[]
          ).map((cam) => (
            <button
              key={cam.id}
              onClick={() => setCameraPreset(cam.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                cameraPreset === cam.id
                  ? 'bg-amber-500 text-black'
                  : 'text-amber-100/70 hover:bg-white/10'
              }`}
            >
              {cam.label}
            </button>
          ))}
        </div>

        {/* Right Game Actions: Undo & New Game */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleUndo}
            disabled={moveHistory.length === 0 || isAIThinking}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-black/65 hover:bg-white/15 text-amber-100 border border-white/15 transition disabled:opacity-35"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Zug zurück</span>
          </button>

          <button
            onClick={handleNewGame}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black shadow-md transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Neues Spiel</span>
          </button>
        </div>
      </footer>

      {/* Family Hero Customization & Photo Comparison Modal */}
      <FamilyHeroModal
        isOpen={isHeroModalOpen}
        heroes={heroes}
        onClose={() => setIsHeroModalOpen(false)}
        onSaveHeroes={handleSaveHeroes}
      />
    </div>
  );
};
export default App;
