import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Canvas } from '@react-three/fiber';
import { Chess, Move, Square } from 'chess.js';
import confetti from 'canvas-confetti';
import Peer, { DataConnection } from 'peerjs';
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
  Wifi,
  Compass,
  Zap,
  Maximize2,
  Minimize2,
  Music,
} from 'lucide-react';
import {
  DEFAULT_FAMILY_HEROES,
  DUNGEON_LEVELS,
  DungeonLevelId,
  FamilyHeroConfig,
  PieceRole,
  TREASURE_QUESTS,
} from './data/familyConfig';
import {
  ActiveCaptureEffect,
  CameraPreset,
  DungeonArena3D,
  FloatingEmojiReaction,
} from './components/DungeonArena3D';
import { FamilyHeroModal } from './components/FamilyHeroModal';
import { OnlineRoomModal } from './components/OnlineRoomModal';
import {
  chooseCrazyAraOrBrowserAIMove,
  evaluateBoard,
  findHelpfulHintMove,
  STORAGE_KEY_CRAZYARA_URL,
} from './utils/chessAI';
import { soundFX } from './utils/sound';

const STORAGE_KEY_HEROES = 'family_dungeon_chess_heroes_v2';
const STORAGE_KEY_STARS = 'family_dungeon_chess_stars_v2';
const STORAGE_KEY_SCOREBOARD = 'family_dungeon_chess_scoreboard_v2';
const STORAGE_KEY_MATCH_HISTORY = 'family_dungeon_chess_match_history_v1';
const PEER_PREFIX = 'fdc-room-';

export type GameMode = 'campaign' | 'local2p' | 'online' | 'treasure';

export interface FamilyScoreboard {
  goldWins: number;
  purpleWins: number;
  treasureWins: number;
}

export interface MoveLogEntry {
  moveIndex: number;
  turnNumber: number;
  color: 'w' | 'b';
  role: PieceRole;
  heroName: string;
  chessName: string;
  from: string;
  to: string;
  san: string;
  capturedRole?: PieceRole;
  capturedHeroName?: string;
  isCheck?: boolean;
  isCheckmate?: boolean;
  promotedToHeroName?: string;
  timestamp: string;
}

export interface MatchHistoryRecord {
  id: string;
  dateLabel: string;
  levelName: string;
  gameMode: GameMode;
  resultLabel: string;
  winnerColor: 'w' | 'b' | 'draw' | 'aborted';
  totalMoves: number;
  moves: MoveLogEntry[];
  pgn: string;
}

export const App: React.FC = () => {
  // 1. Custom Family Hero Names, Voice Clips & Skins persisted in localStorage
  const [heroes, setHeroes] = useState<Record<PieceRole, FamilyHeroConfig>>(
    () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_HEROES);
        if (saved) {
          const parsed = JSON.parse(saved);
          const merged = { ...DEFAULT_FAMILY_HEROES };
          (Object.keys(merged) as PieceRole[]).forEach((r) => {
            if (parsed[r]) {
              merged[r] = {
                ...DEFAULT_FAMILY_HEROES[r],
                ...parsed[r],
                superpower: DEFAULT_FAMILY_HEROES[r].superpower,
                secondarySpritePath:
                  DEFAULT_FAMILY_HEROES[r].secondarySpritePath,
              };
            }
          });
          return merged;
        }
      } catch {
        // ignore
      }
      return DEFAULT_FAMILY_HEROES;
    }
  );

  // 2. Stars/Crowns earned per Dungeon Level (1-5) + Eternal Family Scoreboard
  const [levelStars, setLevelStars] = useState<Record<number, number>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_STARS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  });

  const [scoreboard, setScoreboard] = useState<FamilyScoreboard>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SCOREBOARD);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return { goldWins: 0, purpleWins: 0, treasureWins: 0 };
  });

  const [isScoreboardOpen, setIsScoreboardOpen] = useState<boolean>(false);
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: Square;
    to: Square;
    color: 'w' | 'b';
  } | null>(null);
  const [promotedSquare, setPromotedSquare] = useState<Square | null>(null);

  const [currentLevelId, setCurrentLevelId] = useState<DungeonLevelId>(1);
  const currentLevel = useMemo(
    () =>
      DUNGEON_LEVELS.find((l) => l.id === currentLevelId) || DUNGEON_LEVELS[0],
    [currentLevelId]
  );

  // Game Mode: 'campaign' | 'local2p' | 'online' | 'treasure'
  const [gameMode, setGameMode] = useState<GameMode>('campaign');
  const [dungeonPowersEnabled, setDungeonPowersEnabled] =
    useState<boolean>(true);
  const [kidMode, setKidMode] = useState<boolean>(true);
  const [showAllNames, setShowAllNames] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [musicEnabled, setMusicEnabled] = useState<boolean>(false);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('orbit');
  const [isHeroModalOpen, setIsHeroModalOpen] = useState<boolean>(false);
  const [isOnlineModalOpen, setIsOnlineModalOpen] = useState<boolean>(false);

  // Dungeon Superpower State (1 use per team per match)
  const [goldPowerUsed, setGoldPowerUsed] = useState<boolean>(false);
  const [purplePowerUsed, setPurplePowerUsed] = useState<boolean>(false);
  const [shieldedSquares, setShieldedSquares] = useState<string[]>([]);
  const [frozenSquares, setFrozenSquares] = useState<string[]>([]);
  const [extraTurnActive, setExtraTurnActive] = useState<boolean>(false);
  const [powerBanner, setPowerBanner] = useState<string | null>(null);
  const [goldComebackUsed, setGoldComebackUsed] = useState<boolean>(false);
  const [purpleComebackUsed, setPurpleComebackUsed] = useState<boolean>(false);
  const [moveQualityBadge, setMoveQualityBadge] = useState<{
    label: string;
    colorClass: string;
  } | null>(null);
  const [isChronicleOpen, setIsChronicleOpen] = useState<boolean>(false);
  const [isMatchActive, setIsMatchActive] = useState<boolean>(false);
  const [menuTab, setMenuTab] = useState<'settings' | 'history'>('settings');
  const [currentMoveLog, setCurrentMoveLog] = useState<MoveLogEntry[]>([]);
  const [matchHistoryArchive, setMatchHistoryArchive] = useState<
    MatchHistoryRecord[]
  >(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MATCH_HISTORY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [];
  });
  const [expandedArchiveId, setExpandedArchiveId] = useState<string | null>(
    null
  );
  const [battleScars, setBattleScars] = useState<Record<string, number>>({});
  const [threatRadarEnabled, setThreatRadarEnabled] = useState<boolean>(false);

  // Treasure Hunt Mode State (Princess Mini's Schatzjagd)
  const [questIndex, setQuestIndex] = useState<number>(0);
  const currentQuest = TREASURE_QUESTS[questIndex] || TREASURE_QUESTS[0];
  const [remainingTreasures, setRemainingTreasures] = useState<string[]>([]);
  const [questMovesCount, setQuestMovesCount] = useState<number>(0);

  // Online Room P2P State (PeerJS)
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [isPeerConnected, setIsPeerConnected] = useState<boolean>(false);
  const [peerRole, setPeerRole] = useState<'host' | 'guest' | null>(null);
  const [onlineStatus, setOnlineStatus] = useState<string>(
    'Bereit für Familien-Raum'
  );
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmojiReaction[]>(
    []
  );

  // Chess Engine State
  const gameRef = useRef<Chess>(new Chess());
  const [fen, setFen] = useState<string>(gameRef.current.fen());
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(
    null
  );
  const [hintMove, setHintMove] = useState<{ from: Square; to: Square } | null>(
    null
  );
  const [captureEffect, setCaptureEffect] =
    useState<ActiveCaptureEffect | null>(null);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [capturedByGold, setCapturedByGold] = useState<PieceRole[]>([]);
  const [capturedByPurple, setCapturedByPurple] = useState<PieceRole[]>([]);
  const [isAIThinking, setIsAIThinking] = useState<boolean>(false);

  const showTemporaryBanner = useCallback((msg: string) => {
    setPowerBanner(msg);
    setTimeout(() => {
      setPowerBanner((prev) => (prev === msg ? null : prev));
    }, 3400);
  }, []);

  const triggerEmojiFloat = useCallback((emoji: string, sender: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setFloatingEmojis((prev) => [...prev, { id, emoji, sender }]);
    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((e) => e.id !== id));
    }, 3000);
  }, []);

  // Setup Treasure Hunt Quest Board
  const loadTreasureQuest = useCallback((idx: number) => {
    const quest = TREASURE_QUESTS[idx] || TREASURE_QUESTS[0];
    const g = new Chess();
    g.clear();
    // Place the quest Hero + Kings tucked safely so chess.js generates legal moves
    g.put({ type: quest.heroRole, color: 'w' }, quest.startSquare as Square);
    if (quest.heroRole !== 'k') {
      g.put({ type: 'k', color: 'w' }, 'a1' as Square);
    }
    g.put({ type: 'k', color: 'b' }, 'h8' as Square);
    gameRef.current = g;
    setFen(g.fen());
    setSelectedSquare(quest.startSquare as Square);
    setRemainingTreasures([...quest.treasures]);
    setQuestMovesCount(0);
    setLastMove(null);
    setHintMove(null);
  }, []);

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

  const toggleMusic = () => {
    const next = !musicEnabled;
    setMusicEnabled(next);
    soundFX.setMusicTheme(currentLevel.specialTheme);
    soundFX.setMusicEnabled(next);
    soundFX.playSelect();
  };

  useEffect(() => {
    soundFX.setMusicTheme(currentLevel.specialTheme);
  }, [currentLevel.specialTheme]);

  // Legal moves for the currently selected square (respecting Shielded & Frozen squares!)
  const legalMoves = useMemo(() => {
    if (!selectedSquare) return [];
    if (frozenSquares.includes(selectedSquare)) return [];

    const moves = gameRef.current.moves({
      square: selectedSquare,
      verbose: true,
    }) as Move[];

    return moves
      .filter((m) => {
        // Cannot capture a shielded piece
        if (m.captured && shieldedSquares.includes(m.to)) return false;
        // In Treasure mode, cannot step onto lava obstacles
        if (
          gameMode === 'treasure' &&
          currentQuest.obstacles.includes(m.to)
        ) {
          return false;
        }
        return true;
      })
      .map((m) => ({
        to: m.to as Square,
        isCapture: Boolean(
          m.captured ||
            m.flags.includes('e') ||
            (gameMode === 'treasure' && remainingTreasures.includes(m.to))
        ),
      }));
  }, [
    selectedSquare,
    fen,
    frozenSquares,
    shieldedSquares,
    gameMode,
    currentQuest,
    remainingTreasures,
  ]);

  // Trigger Battle-Chess 3D Clash Duel + Real Voice Playback
  const triggerCaptureEffect = useCallback(
    (move: Move) => {
      const attackerRole = move.piece as PieceRole;
      const defenderRole = (move.captured as PieceRole) || 'p';
      const heroCfg = heroes[attackerRole];
      const defCfg = heroes[defenderRole];
      const quotes = heroCfg.captureQuotes;
      const randomQuote =
        quotes[Math.floor(Math.random() * quotes.length)] || heroCfg.battleCry;

      // Check if defender is the 2nd Cousin skin on an odd file!
      const toFileIdx = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].indexOf(
        move.to[0]
      );
      const fromFileIdx = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].indexOf(
        move.from[0]
      );
      const attackerSprite =
        attackerRole === 'p' &&
        fromFileIdx % 2 === 1 &&
        heroCfg.secondarySpritePath
          ? heroCfg.secondarySpritePath
          : heroCfg.spritePath;
      const defenderSprite =
        defenderRole === 'p' &&
        toFileIdx % 2 === 1 &&
        defCfg.secondarySpritePath
          ? defCfg.secondarySpritePath
          : defCfg.spritePath;

      setCaptureEffect({
        id: `${Date.now()}-${move.to}`,
        fromSquare: move.from as Square,
        square: move.to as Square,
        attackerName: heroCfg.customName,
        attackerRole,
        attackerColor: move.color,
        defenderName: defCfg.customName,
        defenderRole,
        attackerSprite,
        defenderSprite,
        quote: randomQuote,
        accentColor: heroCfg.accentColor,
      });

      setTimeout(() => {
        setCaptureEffect((prev) =>
          prev && prev.square === move.to ? null : prev
        );
      }, 3100);
    },
    [heroes]
  );

  // Execute a validated move on the board
  const executeMove = useCallback(
    (
      from: Square,
      to: Square,
      isRemoteMove = false,
      promotionRole: 'q' | 'r' | 'b' | 'n' = 'q'
    ): boolean => {
      const game = gameRef.current;

      // Special handling for Treasure Hunt Mode
      if (gameMode === 'treasure') {
        const piece = game.get(from);
        if (!piece) return false;
        game.remove(from);
        game.put({ type: piece.type, color: 'w' }, to);
        setFen(game.fen());
        setSelectedSquare(to);
        setLastMove({ from, to });
        setQuestMovesCount((c) => c + 1);

        if (remainingTreasures.includes(to)) {
          soundFX.playTreasureCollect();
          const nextTreasures = remainingTreasures.filter((t) => t !== to);
          setRemainingTreasures(nextTreasures);
          if (nextTreasures.length === 0) {
            soundFX.playVictory();
            confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
            setScoreboard((prev) => {
              const next = { ...prev, treasureWins: prev.treasureWins + 1 };
              try {
                localStorage.setItem(
                  STORAGE_KEY_SCOREBOARD,
                  JSON.stringify(next)
                );
              } catch {
                // ignore
              }
              return next;
            });
          }
        } else {
          soundFX.playMove();
        }
        return true;
      }

      try {
        const evalBefore = evaluateBoard(game);
        const moverColor = game.turn();
        const moveResult = game.move({
          from,
          to,
          promotion: promotionRole,
        });

        if (!moveResult) return false;

        // LiGround-inspired Move Quality Coach (Brilliant / Strong / Caution)
        const evalAfter = evaluateBoard(game);
        const deltaForMover =
          moverColor === 'w'
            ? evalAfter - evalBefore
            : evalBefore - evalAfter;

        if (game.isCheckmate()) {
          setMoveQualityBadge({
            label: '👑 SCHACHMATT-STREICH!',
            colorClass: 'bg-amber-400 text-black border-yellow-200',
          });
        } else if (deltaForMover >= 240) {
          setMoveQualityBadge({
            label: '🔥 BRILLANTER MEISTERZUG! (!!)',
            colorClass: 'bg-emerald-500 text-black border-emerald-200',
          });
        } else if (deltaForMover >= 95) {
          setMoveQualityBadge({
            label: '✨ STARKER TAKTIK-ZUG! (!)',
            colorClass: 'bg-sky-500 text-black border-sky-200',
          });
        } else if (deltaForMover <= -220) {
          setMoveQualityBadge({
            label: '⚠️ VORSICHT: FIGUR IN GEFAHR! (?)',
            colorClass: 'bg-rose-600 text-white border-rose-300',
          });
        } else {
          setMoveQualityBadge(null);
        }

        // Trigger Golden Coronation Spiral if this move was a Pawn Promotion!
        if (moveResult.promotion) {
          setPromotedSquare(to);
          soundFX.playSuperpower();
          showTemporaryBanner(
            `👑 Krönung! Cousine verwandelt sich in ${heroes[promotionRole].customName} (${heroes[promotionRole].chessName})!`
          );
          setTimeout(() => {
            setPromotedSquare((prev) => (prev === to ? null : prev));
          }, 3500);
        }

        // If Princess Mini's Double-Hop superpower was activated and this move doesn't give check:
        if (extraTurnActive && !game.inCheck()) {
          const fenParts = game.fen().split(' ');
          fenParts[1] = moveResult.color; // Keep same player's turn!
          fenParts[3] = '-';
          try {
            game.load(fenParts.join(' '));
            showTemporaryBanner(
              `🦄 ${heroes.n.customName}s Doppel-Hüpfer! Dein Team darf sofort noch einmal ziehen!`
            );
          } catch {
            // fallback if FEN invalid
          }
          setExtraTurnActive(false);
        } else {
          // Clear 1-round shields/freezes when turn passes
          setShieldedSquares([]);
          setFrozenSquares([]);
          setExtraTurnActive(false);
        }

        setFen(game.fen());
        setSelectedSquare(null);
        setHintMove(null);
        setLastMove({ from, to });
        const updatedSanHistory = game.history();
        setMoveHistory(updatedSanHistory);

        const attackerRole = moveResult.piece as PieceRole;
        const attackerHero = heroes[attackerRole];
        const capturedRole = moveResult.captured as PieceRole | undefined;
        const capturedHero = capturedRole ? heroes[capturedRole] : undefined;
        const nowTime = new Date().toLocaleTimeString('de-DE', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });

        const newLogEntry: MoveLogEntry = {
          moveIndex: updatedSanHistory.length,
          turnNumber: Math.ceil(updatedSanHistory.length / 2),
          color: moveResult.color,
          role: attackerRole,
          heroName: attackerHero.customName,
          chessName: attackerHero.chessName,
          from,
          to,
          san: moveResult.san,
          capturedRole,
          capturedHeroName: capturedHero?.customName,
          isCheck: game.inCheck(),
          isCheckmate: game.isCheckmate(),
          promotedToHeroName: moveResult.promotion
            ? heroes[promotionRole].customName
            : undefined,
          timestamp: nowTime,
        };

        setCurrentMoveLog((prev) => {
          const nextLog = [...prev, newLogEntry];
          if (game.isCheckmate() || game.isDraw()) {
            const record: MatchHistoryRecord = {
              id: `${Date.now()}`,
              dateLabel: new Date().toLocaleString('de-DE', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              }),
              levelName: currentLevel.name,
              gameMode,
              resultLabel: game.isCheckmate()
                ? moveResult.color === 'w'
                  ? '🏆 Sieg Team Gold (Schachmatt)'
                  : '🌙 Sieg Team Gegner (Schachmatt)'
                : '🤝 Unentschieden',
              winnerColor: game.isCheckmate() ? moveResult.color : 'draw',
              totalMoves: nextLog.length,
              moves: nextLog,
              pgn: game.pgn(),
            };
            setMatchHistoryArchive((oldArchive) => {
              const updatedArchive = [record, ...oldArchive].slice(0, 25);
              try {
                localStorage.setItem(
                  STORAGE_KEY_MATCH_HISTORY,
                  JSON.stringify(updatedArchive)
                );
              } catch {
                // ignore
              }
              return updatedArchive;
            });
          }
          return nextLog;
        });

        // Broadcast move to online family peer if connected
        if (!isRemoteMove && connRef.current && connRef.current.open) {
          connRef.current.send({
            type: 'move',
            from,
            to,
            promotion: promotionRole,
            fen: game.fen(),
          });
        }

        const voiceUrl = heroes[attackerRole]?.customAudioDataUrl;

        if (moveResult.captured) {
          soundFX.playCapture(voiceUrl, !kidMode);
          triggerCaptureEffect(moveResult);
          setBattleScars((prev) => ({
            ...prev,
            [to]: (prev[to] || 0) + 1,
          }));
          if (moveResult.color === 'w') {
            setCapturedByGold((prev) => [
              ...prev,
              moveResult.captured as PieceRole,
            ]);
          } else {
            setCapturedByPurple((prev) => [
              ...prev,
              moveResult.captured as PieceRole,
            ]);
          }
        } else {
          soundFX.playMove();
          if (voiceUrl && Math.random() < 0.35) {
            soundFX.playCustomVoice(voiceUrl);
          }
        }

        if (game.isCheckmate()) {
          soundFX.playVictory();
          confetti({
            particleCount: 110,
            spread: 80,
            origin: { y: 0.6 },
          });
          setScoreboard((prev) => {
            const next =
              moveResult.color === 'w'
                ? { ...prev, goldWins: prev.goldWins + 1 }
                : { ...prev, purpleWins: prev.purpleWins + 1 };
            try {
              localStorage.setItem(
                STORAGE_KEY_SCOREBOARD,
                JSON.stringify(next)
              );
            } catch {
              // ignore
            }
            return next;
          });
          if (gameMode === 'campaign' && moveResult.color === 'w') {
            setLevelStars((prev) => {
              const updated = { ...prev, [currentLevelId]: 3 };
              try {
                localStorage.setItem(
                  STORAGE_KEY_STARS,
                  JSON.stringify(updated)
                );
              } catch {
                // ignore
              }
              return updated;
            });
          }
        } else if (game.inCheck()) {
          soundFX.playCheck();
        }

        if (
          gameMode === 'local2p' &&
          (cameraPreset === 'table-white' || cameraPreset === 'table-black')
        ) {
          setCameraPreset(
            game.turn() === 'w' ? 'table-white' : 'table-black'
          );
        }

        return true;
      } catch {
        return false;
      }
    },
    [
      cameraPreset,
      currentLevelId,
      extraTurnActive,
      gameMode,
      heroes,
      remainingTreasures,
      showTemporaryBanner,
      triggerCaptureEffect,
    ]
  );

  // Activate the selected Family Hero's Dungeon Superpower (1x per game per team)
  const handleActivateSuperpower = () => {
    if (!selectedSquare || !dungeonPowersEnabled) return;
    const game = gameRef.current;
    const piece = game.get(selectedSquare);
    if (!piece || piece.color !== game.turn()) return;

    const isGold = piece.color === 'w';
    if ((isGold && goldPowerUsed) || (!isGold && purplePowerUsed)) return;

    const role = piece.type as PieceRole;
    const hero = heroes[role];
    soundFX.playSuperpower();
    if (hero.customAudioDataUrl) {
      soundFX.playCustomVoice(hero.customAudioDataUrl);
    }

    if (role === 'k' || role === 'r' || role === 'p') {
      // Royal / Fortress / Cousin Shield on selected square
      setShieldedSquares((prev) => [...prev, selectedSquare]);
      showTemporaryBanner(
        `${hero.superpower.icon} ${hero.customName} aktiviert „${hero.superpower.name}“ auf Feld ${selectedSquare.toUpperCase()}!`
      );
    } else if (role === 'q') {
      // Queen Nova: Shields both King & Queen + shows best winning hint!
      const b = game.board();
      const royalSq: string[] = [];
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const cell = b[r][c];
          if (
            cell &&
            cell.color === piece.color &&
            (cell.type === 'k' || cell.type === 'q')
          ) {
            royalSq.push(cell.square);
          }
        }
      }
      setShieldedSquares(royalSq);
      const best = findHelpfulHintMove(game.fen(), {
        frozenSquares,
        shieldedSquares: royalSq,
      });
      if (best) {
        setHintMove({ from: best.from as Square, to: best.to as Square });
      }
      showTemporaryBanner(
        `✨ ${hero.customName} wirkt „${hero.superpower.name}“ – König & Dame sind geschützt!`
      );
    } else if (role === 'n') {
      // Princess Mini Double-Hop!
      setExtraTurnActive(true);
      showTemporaryBanner(
        `🦄 ${hero.customName} lädt den „Wirbelwind-Doppelzug“ auf – ziehe jetzt und du bist sofort nochmal dran!`
      );
    } else if (role === 'b') {
      // Aunt's Sunglass Freeze: Freezes the strongest enemy piece (excluding King)
      const enemyColor = piece.color === 'w' ? 'b' : 'w';
      const b = game.board();
      const candidates: { sq: string; val: number }[] = [];
      const vals: Record<string, number> = { q: 9, r: 5, b: 3, n: 3, p: 1 };
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const cell = b[r][c];
          if (cell && cell.color === enemyColor && cell.type !== 'k') {
            candidates.push({ sq: cell.square, val: vals[cell.type] || 1 });
          }
        }
      }
      candidates.sort((a, b) => b.val - a.val);
      if (candidates.length > 0) {
        const targetSq = candidates[0].sq;
        setFrozenSquares([targetSq]);
        showTemporaryBanner(
          `😎 ${hero.customName} blendet Feld ${targetSq.toUpperCase()} mit ihrer Sonnenbrille (1 Runde eingefroren)!`
        );
      }
    }

    if (isGold) setGoldPowerUsed(true);
    else setPurplePowerUsed(true);
  };

  // Online Room P2P Setup (PeerJS)
  const setupConnectionHandlers = useCallback(
    (conn: DataConnection) => {
      connRef.current = conn;
      conn.on('open', () => {
        setIsPeerConnected(true);
        setGameMode('online');
        setOnlineStatus('Mit Familienmitglied verbunden! Live-Spiel läuft');
        soundFX.playVictory();
      });
      conn.on('data', (data: any) => {
        if (!data || typeof data !== 'object') return;
        if (data.type === 'move' && data.from && data.to) {
          executeMove(
            data.from as Square,
            data.to as Square,
            true,
            data.promotion || 'q'
          );
        } else if (data.type === 'emoji' && data.emoji) {
          soundFX.playSelect();
          triggerEmojiFloat(data.emoji, data.sender || 'Familie');
        } else if (data.type === 'reset') {
          gameRef.current = new Chess();
          setFen(gameRef.current.fen());
          setSelectedSquare(null);
          setLastMove(null);
        }
      });
      conn.on('close', () => {
        setIsPeerConnected(false);
        setOnlineStatus('Verbindung getrennt');
      });
    },
    [executeMove, triggerEmojiFloat]
  );

  const handleCreateOnlineRoom = useCallback(() => {
    if (peerRef.current) peerRef.current.destroy();
    const randomNum = Math.floor(10 + Math.random() * 89);
    const code = `BABA-${randomNum}`;
    const peer = new Peer(`${PEER_PREFIX}${code}`);
    peerRef.current = peer;
    setRoomCode(code);
    setPeerRole('host');
    setOnlineStatus('Warte auf Familienmitglied...');

    peer.on('connection', (conn) => {
      setupConnectionHandlers(conn);
    });
    peer.on('error', () => {
      setOnlineStatus('Verbindungsfehler – bitte neuen Raum starten');
    });
  }, [setupConnectionHandlers]);

  const handleJoinOnlineRoom = useCallback(
    (codeInput: string) => {
      if (peerRef.current) peerRef.current.destroy();
      const cleanCode = codeInput.trim().toUpperCase();
      const peer = new Peer();
      peerRef.current = peer;
      setRoomCode(cleanCode);
      setPeerRole('guest');
      setOnlineStatus(`Verbinde mit Raum ${cleanCode}...`);

      peer.on('open', () => {
        const conn = peer.connect(`${PEER_PREFIX}${cleanCode}`);
        setupConnectionHandlers(conn);
      });
      peer.on('error', () => {
        setOnlineStatus(`Raum ${cleanCode} nicht gefunden`);
      });
    },
    [setupConnectionHandlers]
  );

  const handleDisconnectOnline = () => {
    if (connRef.current) connRef.current.close();
    if (peerRef.current) peerRef.current.destroy();
    connRef.current = null;
    peerRef.current = null;
    setRoomCode(null);
    setIsPeerConnected(false);
    setPeerRole(null);
    setOnlineStatus('Bereit für Familien-Raum');
  };

  const handleSendEmoji = (emoji: string) => {
    triggerEmojiFloat(emoji, 'Du');
    if (connRef.current && connRef.current.open) {
      connRef.current.send({
        type: 'emoji',
        emoji,
        sender: peerRole === 'host' ? heroes.k.customName : heroes.q.customName,
      });
    }
  };

  // Auto-join room if URL contains ?room=CODE
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlRoom = params.get('room');
    if (urlRoom) {
      setIsOnlineModalOpen(true);
      handleJoinOnlineRoom(urlRoom);
    }
  }, [handleJoinOnlineRoom]);

  // AI Response Turn in 1-Player Campaign Mode (PeSTO + Quiescence Browser Engine with optional CrazyAra Bridge!)
  useEffect(() => {
    const game = gameRef.current;
    if (
      gameMode === 'campaign' &&
      !game.isGameOver() &&
      game.turn() === 'b'
    ) {
      setIsAIThinking(true);
      let cancelled = false;
      const timer = setTimeout(async () => {
        const savedCrazyAraUrl =
          localStorage.getItem(STORAGE_KEY_CRAZYARA_URL) || '';
        const { move: aiMove } = await chooseCrazyAraOrBrowserAIMove(
          game.fen(),
          currentLevel.aiDepth,
          currentLevel.aiRandomness,
          { frozenSquares, shieldedSquares },
          savedCrazyAraUrl
        );
        if (!cancelled && aiMove) {
          executeMove(aiMove.from as Square, aiMove.to as Square);
        }
        if (!cancelled) {
          setIsAIThinking(false);
        }
      }, 420);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }
  }, [fen, gameMode, currentLevel, executeMove, frozenSquares, shieldedSquares]);

  // Handle clicking any square or 3D hero piece
  const handleSquareClick = (sq: Square) => {
    const game = gameRef.current;
    if (game.isGameOver() || isAIThinking) return;

    if (gameMode === 'campaign' && game.turn() === 'b') return;
    if (gameMode === 'online' && isPeerConnected) {
      if (peerRole === 'host' && game.turn() !== 'w') return;
      if (peerRole === 'guest' && game.turn() !== 'b') return;
    }

    if (selectedSquare) {
      const isLegal = legalMoves.some((m) => m.to === sq);
      if (isLegal) {
        // Check if this is a Cousin (Pawn) Promotion move reaching rank 8 or 1!
        const movingPiece = game.get(selectedSquare);
        const isPawnPromo =
          gameMode !== 'treasure' &&
          movingPiece &&
          movingPiece.type === 'p' &&
          ((movingPiece.color === 'w' && sq[1] === '8') ||
            (movingPiece.color === 'b' && sq[1] === '1'));

        if (isPawnPromo) {
          soundFX.playSelect();
          setPendingPromotion({
            from: selectedSquare,
            to: sq,
            color: movingPiece.color,
          });
          return;
        }

        executeMove(selectedSquare, sq);
        return;
      }
    }

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
    if (gameMode === 'treasure') {
      loadTreasureQuest(questIndex);
      setCurrentMoveLog([]);
      return;
    }
    gameRef.current = new Chess();
    setFen(gameRef.current.fen());
    setSelectedSquare(null);
    setLastMove(null);
    setHintMove(null);
    setCaptureEffect(null);
    setMoveHistory([]);
    setCurrentMoveLog([]);
    setCapturedByGold([]);
    setCapturedByPurple([]);
    setGoldPowerUsed(false);
    setPurplePowerUsed(false);
    setGoldComebackUsed(false);
    setPurpleComebackUsed(false);
    setMoveQualityBadge(null);
    setShieldedSquares([]);
    setFrozenSquares([]);
    setBattleScars({});
    setExtraTurnActive(false);
    setIsAIThinking(false);
    soundFX.playSelect();

    if (connRef.current && connRef.current.open) {
      connRef.current.send({ type: 'reset' });
    }
  };

  // Start a new match from the Menu (locks Settings until the match ends!)
  const handleStartMatch = () => {
    handleNewGame();
    setIsMatchActive(true);
    setIsChronicleOpen(false);
  };

  // End the current match, save its history if moves were made, and return to the Menu (unlocking Settings!)
  const handleEndMatchAndOpenMenu = () => {
    const game = gameRef.current;
    if (
      currentMoveLog.length > 0 &&
      !game.isCheckmate() &&
      !game.isDraw()
    ) {
      const record: MatchHistoryRecord = {
        id: `${Date.now()}`,
        dateLabel: new Date().toLocaleString('de-DE', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }),
        levelName: currentLevel.name,
        gameMode,
        resultLabel: `🏳️ Beendet nach ${currentMoveLog.length} Halbzügen`,
        winnerColor: 'aborted',
        totalMoves: currentMoveLog.length,
        moves: currentMoveLog,
        pgn: game.pgn(),
      };
      setMatchHistoryArchive((oldArchive) => {
        const updatedArchive = [record, ...oldArchive].slice(0, 25);
        try {
          localStorage.setItem(
            STORAGE_KEY_MATCH_HISTORY,
            JSON.stringify(updatedArchive)
          );
        } catch {
          // ignore
        }
        return updatedArchive;
      });
    }
    setIsMatchActive(false);
    setIsChronicleOpen(false);
    soundFX.playSelect();
  };

  const handleUndo = () => {
    const game = gameRef.current;
    if (game.history().length === 0 || isAIThinking || gameMode === 'treasure')
      return;
    const undoCount = gameMode === 'campaign' ? 2 : 1;
    for (let i = 0; i < undoCount; i++) {
      game.undo();
    }
    setFen(game.fen());
    setSelectedSquare(null);
    setHintMove(null);
    setMoveHistory(game.history());
    setCurrentMoveLog((prev) => prev.slice(0, Math.max(0, prev.length - undoCount)));
    soundFX.playSelect();
  };

  const handleShowHint = () => {
    const game = gameRef.current;
    if (game.isGameOver() || isAIThinking) return;
    const best = findHelpfulHintMove(game.fen(), {
      frozenSquares,
      shieldedSquares,
    });
    if (best) {
      soundFX.playSelect();
      setSelectedSquare(best.from as Square);
      setHintMove({ from: best.from as Square, to: best.to as Square });
    }
  };

  // LiGround-inspired Live Evaluation Percentage (5% to 95% Gold Win Probability)
  const goldWinPercent = useMemo(() => {
    if (gameMode === 'treasure') return 100;
    const cp = evaluateBoard(gameRef.current);
    const pct = 50 + 50 * (2 / (1 + Math.exp(-0.0032 * cp)) - 1);
    return Math.round(Math.min(96, Math.max(4, pct)));
  }, [fen, gameMode]);

  // Crazyhouse / LiGround "Familien-Comeback": Parachute-drop 1 captured family hero back onto a safe home square!
  const handleParachuteComeback = (teamColor: 'w' | 'b', role: PieceRole, indexInPocket: number) => {
    const game = gameRef.current;
    if (game.isGameOver() || isAIThinking || gameMode === 'treasure') return;
    if (game.turn() !== teamColor) {
      showTemporaryBanner('⏳ Du kannst das Familien-Comeback nur in deinem eigenen Zug rufen!');
      return;
    }
    if ((teamColor === 'w' && goldComebackUsed) || (teamColor === 'b' && purpleComebackUsed)) {
      return;
    }

    const candidateRanks = teamColor === 'w' ? ['2', '3', '4', '1'] : ['7', '6', '5', '8'];
    const candidateFiles = ['d', 'e', 'c', 'f', 'b', 'g', 'a', 'h'];
    let targetSq: Square | null = null;

    for (const r of candidateRanks) {
      if (role === 'p' && (r === '1' || r === '8')) continue;
      for (const f of candidateFiles) {
        const sq = `${f}${r}` as Square;
        if (!game.get(sq)) {
          game.put({ type: role, color: teamColor }, sq);
          // Verify this drop doesn't leave own King in check
          const fenParts = game.fen().split(' ');
          fenParts[1] = teamColor === 'w' ? 'b' : 'w';
          fenParts[3] = '-';
          try {
            const testChess = new Chess(fenParts.join(' '));
            targetSq = sq;
            game.load(testChess.fen());
            break;
          } catch {
            game.remove(sq);
          }
        }
      }
      if (targetSq) break;
    }

    if (!targetSq) {
      showTemporaryBanner('⚠️ Kein freies Landefeld für den Fallschirm gefunden!');
      return;
    }

    if (teamColor === 'w') {
      setGoldComebackUsed(true);
      setCapturedByPurple((prev) => prev.filter((_, idx) => idx !== indexInPocket));
    } else {
      setPurpleComebackUsed(true);
      setCapturedByGold((prev) => prev.filter((_, idx) => idx !== indexInPocket));
    }

    setFen(game.fen());
    setPromotedSquare(targetSq);
    setLastMove({ from: targetSq, to: targetSq });
    soundFX.playSuperpower();
    showTemporaryBanner(
      `🪂 CRAZYHOUSE-COMEBACK! ${heroes[role].customName} landet per Fallschirm wieder auf ${targetSq.toUpperCase()}!`
    );
    setTimeout(() => {
      setPromotedSquare((prev) => (prev === targetSq ? null : prev));
    }, 3200);
  };

  const turnColor = gameRef.current.turn();
  const isCheck = gameMode !== 'treasure' && gameRef.current.inCheck();
  const isCheckmate = gameMode !== 'treasure' && gameRef.current.isCheckmate();
  const isDraw = gameMode !== 'treasure' && gameRef.current.isDraw();
  const isTreasureComplete =
    gameMode === 'treasure' && remainingTreasures.length === 0;

  const selectedPieceInfo = useMemo(() => {
    if (!selectedSquare) return null;
    const p = gameRef.current.get(selectedSquare);
    if (!p) return null;
    return {
      piece: p,
      hero: heroes[p.type as PieceRole],
    };
  }, [selectedSquare, fen, heroes]);

  const canUseSuperpower =
    dungeonPowersEnabled &&
    gameMode !== 'treasure' &&
    selectedPieceInfo &&
    selectedPieceInfo.piece.color === turnColor &&
    ((turnColor === 'w' && !goldPowerUsed) ||
      (turnColor === 'b' && !purplePowerUsed));

  return (
    <div
      className="relative w-full h-full flex flex-col justify-between overflow-hidden select-none"
      style={{ background: currentLevel.theme.bgGradient }}
    >
      {/* 3D WebGL Dungeon Canvas */}
      <div className="absolute inset-0 z-0">
        <Canvas
          shadows
          camera={{ position: [0, 8.2, 6.8], fov: 40 }}
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
              shieldedSquares={shieldedSquares}
              frozenSquares={frozenSquares}
              treasureSquares={
                gameMode === 'treasure' ? remainingTreasures : []
              }
              obstacleSquares={
                gameMode === 'treasure' ? currentQuest.obstacles : []
              }
              promotedSquare={promotedSquare}
              winningTeamColor={
                isTreasureComplete
                  ? 'w'
                  : isCheckmate
                  ? turnColor === 'b'
                    ? 'w'
                    : 'b'
                  : null
              }
              capturedByGold={gameMode === 'treasure' ? [] : capturedByGold}
              capturedByPurple={gameMode === 'treasure' ? [] : capturedByPurple}
              battleScars={gameMode === 'treasure' ? {} : battleScars}
              threatRadarEnabled={
                gameMode === 'treasure' ? false : threatRadarEnabled
              }
              kidMode={kidMode}
              showAllNames={showAllNames}
              cameraPreset={cameraPreset}
              captureEffect={captureEffect}
              onSquareClick={handleSquareClick}
            />
          </Suspense>
        </Canvas>
        {/* Subtle Cinematic Dungeon Vignette */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 48%, transparent 56%, rgba(4, 3, 7, 0.62) 100%)',
          }}
        />
      </div>

      {/* Floating Live Emoji Reactions Overlay */}
      <div className="fixed inset-0 pointer-events-none z-30 flex items-center justify-center">
        {floatingEmojis.map((item) => (
          <div
            key={item.id}
            className="animate-bounce flex flex-col items-center bg-black/80 px-5 py-3 rounded-3xl border-2 border-amber-400 shadow-2xl"
          >
            <span className="text-5xl">{item.emoji}</span>
            <span className="text-xs font-bold text-amber-200 mt-1">
              {item.sender}
            </span>
          </div>
        ))}
      </div>

      {/* =====================================================================================
          1. MINIMAL IN-GAME TOP BAR (ONLY WHEN MATCH IS ACTIVE — ZERO OVERLAYS ON THE BOARD!)
             Settings are LOCKED while `isMatchActive === true` and can only be changed after
             ending the match via "🏳️ Spiel beenden"!
         ===================================================================================== */}
      {isMatchActive && (
        <header className="relative z-20 flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-1.5 bg-slate-950/90 border-b border-amber-500/25 backdrop-blur-md pointer-events-auto">
          {/* Left: Active World, Turn Indicator & Locked Settings Badge */}
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-400/30 text-[11px] font-bold text-amber-200">
              {currentLevel.badgeEmoji} {currentLevel.shortLabel}
            </span>
            <span
              className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-[10px] text-amber-100/60"
              title="Settings können während einer laufenden Partie nicht geändert werden – erst nach Spielende!"
            >
              🔒 Settings gesperrt
            </span>

            <div className="h-4 w-px bg-white/15 mx-0.5 hidden sm:block" />

            {/* Compact Turn Status */}
            <div className="flex items-center gap-1.5 text-xs font-bold">
              {gameMode === 'treasure' ? (
                <span className="text-pink-300">
                  🎁 Noch {remainingTreasures.length} Truhen ({questMovesCount} Züge)
                </span>
              ) : isAIThinking ? (
                <span className="text-purple-300 animate-pulse">
                  🔮 Gegner zieht...
                </span>
              ) : turnColor === 'w' ? (
                <span className="text-amber-300">☀️ Team Gold am Zug</span>
              ) : (
                <span className="text-purple-300">🌙 Team Gegner am Zug</span>
              )}

              {isCheck && !isCheckmate && (
                <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black animate-bounce">
                  SCHACH!
                </span>
              )}
            </div>
          </div>

          {/* Center: Camera Perspectives + Superpower (if ready) + Hint + Undo */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-0.5 bg-black/60 p-0.5 rounded-lg border border-white/15">
              <Camera className="w-3 h-3 text-amber-400 mx-1 hidden md:inline" />
              {(
                [
                  { id: 'orbit', label: '3D Frei' },
                  { id: 'table-white', label: 'Gold' },
                  { id: 'table-black', label: 'Gegner' },
                  { id: 'top', label: 'Oben' },
                ] as { id: CameraPreset; label: string }[]
              ).map((cam) => (
                <button
                  key={cam.id}
                  onClick={() => setCameraPreset(cam.id)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition ${
                    cameraPreset === cam.id
                      ? 'bg-amber-500 text-black'
                      : 'text-amber-100/70 hover:bg-white/10'
                  }`}
                >
                  {cam.label}
                </button>
              ))}
            </div>

            {canUseSuperpower && selectedPieceInfo && (
              <button
                onClick={handleActivateSuperpower}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-gradient-to-r from-amber-400 to-orange-500 text-black shadow animate-pulse"
                title={`${selectedPieceInfo.hero.superpower.name}: ${selectedPieceInfo.hero.superpower.shortDesc}`}
              >
                <Zap className="w-3 h-3" />
                <span>{selectedPieceInfo.hero.superpower.name}</span>
              </button>
            )}

            {gameMode !== 'treasure' && (
              <button
                onClick={handleShowHint}
                disabled={isAIThinking}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-sky-600/80 hover:bg-sky-500 text-white disabled:opacity-40"
                title="Zug-Tipp anzeigen"
              >
                <Lightbulb className="w-3 h-3 text-amber-200" />
                <span className="hidden sm:inline">Tipp</span>
              </button>
            )}

            <button
              onClick={handleUndo}
              disabled={
                moveHistory.length === 0 ||
                isAIThinking ||
                gameMode === 'treasure'
              }
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-white/10 hover:bg-white/20 text-amber-100 disabled:opacity-35"
              title="Zug zurücknehmen"
            >
              <Undo2 className="w-3 h-3" />
              <span className="hidden sm:inline">Zurück</span>
            </button>
          </div>

          {/* Right: Live Move History Toggle & End Match Button */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsChronicleOpen((v) => !v)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                isChronicleOpen
                  ? 'bg-amber-400 text-black border-amber-200'
                  : 'bg-white/10 hover:bg-white/20 text-amber-200 border-white/15'
              }`}
            >
              <span>📜 Verlauf ({currentMoveLog.length})</span>
            </button>

            <button
              onClick={handleEndMatchAndOpenMenu}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-extrabold bg-rose-600/90 hover:bg-rose-500 text-white border border-rose-300/40 shadow transition"
              title="Aktuelles Spiel beenden, Verlauf speichern und ins Menü & Settings zurückkehren"
            >
              <span>🏳️ Spiel beenden</span>
            </button>
          </div>
        </header>
      )}

      {/* =====================================================================================
          2. SLIM RIGHT-SIDE MOVE HISTORY DRAWER (SPIELVERLAUF-HISTORIE)
         ===================================================================================== */}
      {isMatchActive && isChronicleOpen && (
        <aside className="fixed top-12 right-3 bottom-3 w-80 sm:w-96 z-30 rounded-2xl bg-slate-950/95 border-2 border-amber-400/50 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden pointer-events-auto">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/15 bg-black/40">
            <div>
              <h3 className="font-dungeon text-sm font-black text-amber-300 uppercase tracking-wider">
                📜 Historie vom Spielverlauf
              </h3>
              <p className="text-[11px] text-amber-100/70">
                {currentMoveLog.length} Halbzüge in dieser Partie
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {currentMoveLog.length > 0 && (
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(gameRef.current.pgn());
                  }}
                  className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 text-amber-200 text-[10px] font-bold border border-amber-400/30"
                >
                  PGN kopieren
                </button>
              )}
              <button
                onClick={() => setIsChronicleOpen(false)}
                className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {currentMoveLog.length === 0 ? (
              <div className="text-center py-10 text-xs text-amber-100/50">
                Noch keine Züge ausgeführt. Ziehe eine Figur auf dem Brett!
              </div>
            ) : (
              currentMoveLog.map((entry) => (
                <div
                  key={entry.moveIndex}
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs ${
                    entry.color === 'w'
                      ? 'bg-amber-950/40 border-amber-500/30 text-amber-100'
                      : 'bg-purple-950/40 border-purple-500/30 text-purple-100'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[11px] font-black text-amber-400/80 shrink-0">
                      {entry.turnNumber}
                      {entry.color === 'w' ? '.' : '...'}
                    </span>
                    <span className="text-sm shrink-0">
                      {entry.color === 'w' ? '☀️' : '🌙'}
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold truncate">
                        {entry.heroName}{' '}
                        <span className="opacity-65 font-normal">
                          ({entry.chessName})
                        </span>
                      </div>
                      <div className="text-[11px] opacity-80 flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-white">
                          {entry.from.toUpperCase()} → {entry.to.toUpperCase()}
                        </span>
                        <span className="font-mono text-[10px] px-1.5 rounded bg-black/50">
                          {entry.san}
                        </span>
                        {entry.capturedHeroName && (
                          <span className="text-rose-300 font-bold">
                            ⚔️ {entry.capturedHeroName}
                          </span>
                        )}
                        {entry.promotedToHeroName && (
                          <span className="text-amber-300 font-bold">
                            👑 → {entry.promotedToHeroName}
                          </span>
                        )}
                        {entry.isCheckmate && (
                          <span className="px-1.5 rounded bg-amber-400 text-black font-black text-[10px]">
                            SCHACHMATT
                          </span>
                        )}
                        {!entry.isCheckmate && entry.isCheck && (
                          <span className="px-1.5 rounded bg-red-600 text-white font-black text-[10px]">
                            SCHACH
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono opacity-55 shrink-0">
                    {entry.timestamp}
                  </span>
                </div>
              ))
            )}
          </div>
        </aside>
      )}

      {/* =====================================================================================
          3. MAIN MENU & LOCKED SETTINGS SCREEN + MATCH HISTORY ARCHIVE (`!isMatchActive`)
         ===================================================================================== */}
      {!isMatchActive && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 overflow-y-auto">
          <div className="max-w-3xl w-full rounded-3xl bg-gradient-to-b from-slate-900/95 via-slate-950/95 to-black/95 border-2 border-amber-400/80 shadow-[0_0_70px_rgba(251,191,36,0.35)] overflow-hidden flex flex-col max-h-[92vh]">
            {/* Menu Header + Tab Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-white/15 bg-black/50">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg border border-amber-200">
                  <Crown className="w-6 h-6 text-black" />
                </div>
                <div>
                  <h1 className="font-dungeon text-lg sm:text-2xl font-black tracking-wider text-amber-200">
                    FAMILY DUNGEON CHESS 3D
                  </h1>
                  <p className="text-xs text-amber-100/70">
                    Hauptmenü • Settings vor Spielbeginn wählen
                  </p>
                </div>
              </div>

              {/* Menu Tabs: Settings vs. Spielverlauf-Historie */}
              <div className="flex bg-black/70 p-1 rounded-xl border border-white/15">
                <button
                  onClick={() => setMenuTab('settings')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition ${
                    menuTab === 'settings'
                      ? 'bg-amber-400 text-black shadow'
                      : 'text-amber-100/75 hover:text-white'
                  }`}
                >
                  ⚙️ Spiel & Settings
                </button>
                <button
                  onClick={() => setMenuTab('history')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition flex items-center gap-1.5 ${
                    menuTab === 'history'
                      ? 'bg-amber-400 text-black shadow'
                      : 'text-amber-100/75 hover:text-white'
                  }`}
                >
                  <span>📜 Spielverlauf-Historie</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-white/15 text-[10px]">
                    {matchHistoryArchive.length + (currentMoveLog.length > 0 ? 1 : 0)}
                  </span>
                </button>
              </div>
            </div>

            {/* TAB 1: SPIEL & SETTINGS KONFIGURATION */}
            {menuTab === 'settings' ? (
              <div className="p-5 overflow-y-auto space-y-5">
                {/* 1. Spielmodus */}
                <div className="space-y-2">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                    1. Spielmodus wählen
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      {
                        id: 'campaign' as GameMode,
                        label: '1P Kampagne',
                        sub: 'Gegen Dungeon-KI',
                        icon: <Bot className="w-4 h-4" />,
                      },
                      {
                        id: 'local2p' as GameMode,
                        label: '2P Am Tisch',
                        sub: 'Zu zweit am Gerät',
                        icon: <Users className="w-4 h-4" />,
                      },
                      {
                        id: 'treasure' as GameMode,
                        label: 'Schatzjagd',
                        sub: '5 Kinder-Missionen',
                        icon: <Compass className="w-4 h-4" />,
                      },
                      {
                        id: 'online' as GameMode,
                        label: 'Online-Raum',
                        sub: 'Per Raum-Code',
                        icon: <Wifi className="w-4 h-4" />,
                      },
                    ].map((m) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          setGameMode(m.id);
                          if (m.id === 'online') setIsOnlineModalOpen(true);
                          soundFX.playSelect();
                        }}
                        className={`flex flex-col items-start p-3 rounded-2xl border text-left transition ${
                          gameMode === m.id
                            ? 'bg-amber-500/25 border-amber-400 text-white shadow-md'
                            : 'bg-white/5 border-white/10 text-amber-100/75 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-extrabold text-xs text-amber-300">
                          {m.icon}
                          <span>{m.label}</span>
                        </div>
                        <span className="text-[11px] opacity-75 mt-0.5">
                          {m.sub}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Welt / Theme (oder Schatzjagd-Mission) */}
                {gameMode === 'treasure' ? (
                  <div className="space-y-2">
                    <label className="text-xs font-extrabold uppercase tracking-wider text-pink-300">
                      2. Schatzjagd-Mission wählen
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {TREASURE_QUESTS.map((q, idx) => (
                        <button
                          key={q.id}
                          onClick={() => {
                            setQuestIndex(idx);
                            soundFX.playSelect();
                          }}
                          className={`p-3 rounded-2xl border text-left transition ${
                            questIndex === idx
                              ? 'bg-pink-500/25 border-pink-400 text-white'
                              : 'bg-white/5 border-white/10 text-amber-100/75 hover:bg-white/10'
                          }`}
                        >
                          <div className="text-xs font-extrabold text-pink-300">
                            {q.title}
                          </div>
                          <div className="text-[11px] opacity-75 line-clamp-2 mt-0.5">
                            {q.story}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                      2. Welt & Schachbrett-Theme wählen
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2">
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
                            className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                              active
                                ? 'bg-amber-500/25 border-amber-400 text-white shadow-md'
                                : 'bg-white/5 border-white/10 text-amber-100/75 hover:bg-white/10'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between text-xs font-extrabold text-amber-300">
                                <span>{lvl.shortLabel}</span>
                                <span>
                                  {stars > 0 ? '👑'.repeat(stars) : lvl.badgeEmoji}
                                </span>
                              </div>
                              <div className="text-[11px] font-bold mt-1 line-clamp-1">
                                {lvl.name.replace(/^Level \d:\s*/, '')}
                              </div>
                            </div>
                            <div className="text-[10px] opacity-65 mt-1">
                              {lvl.difficultyLabel.split('•')[0]}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. Spielregeln & Effekt-Settings (werden beim Start gesperrt!) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                      3. Spiel-Einstellungen (während des Spiels gesperrt 🔒)
                    </label>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <button
                      onClick={() => {
                        const nextKid = !kidMode;
                        setKidMode(nextKid);
                        if (!nextKid) setThreatRadarEnabled(true);
                        soundFX.playSelect();
                      }}
                      className={`p-3 rounded-2xl border text-left transition ${
                        kidMode
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-100'
                          : 'bg-rose-500/20 border-rose-400 text-rose-100'
                      }`}
                    >
                      <div className="text-xs font-extrabold">
                        {kidMode
                          ? '🪂 Kinder-Modus (Fallschirm)'
                          : '💎 Arena-Modus (Kristall-Bruch)'}
                      </div>
                      <div className="text-[10px] opacity-75 mt-0.5">
                        {kidMode
                          ? 'Geschlagene Figuren schweben per Fallschirm'
                          : 'Geschlagene Figuren zersplittern in 3D-Kristalle'}
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setDungeonPowersEnabled((v) => !v);
                        soundFX.playSelect();
                      }}
                      className={`p-3 rounded-2xl border text-left transition ${
                        dungeonPowersEnabled
                          ? 'bg-amber-500/20 border-amber-400 text-amber-100'
                          : 'bg-white/5 border-white/10 text-white/50'
                      }`}
                    >
                      <div className="text-xs font-extrabold">
                        ⚡ Superkräfte: {dungeonPowersEnabled ? 'AN' : 'AUS'}
                      </div>
                      <div className="text-[10px] opacity-75 mt-0.5">
                        1x Spezialkraft pro Partie (Schild, Frost, Doppelzug)
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setThreatRadarEnabled((v) => !v);
                        soundFX.playSelect();
                      }}
                      className={`p-3 rounded-2xl border text-left transition ${
                        threatRadarEnabled
                          ? 'bg-orange-500/20 border-orange-400 text-orange-100'
                          : 'bg-white/5 border-white/10 text-white/50'
                      }`}
                    >
                      <div className="text-xs font-extrabold">
                        🎯 Gefahren-Radar: {threatRadarEnabled ? 'AN' : 'AUS'}
                      </div>
                      <div className="text-[10px] opacity-75 mt-0.5">
                        Zeigt gegnerische Schlagdrohungen als 3D-Linien
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setShowAllNames((v) => !v);
                        soundFX.playSelect();
                      }}
                      className={`p-3 rounded-2xl border text-left transition ${
                        showAllNames
                          ? 'bg-amber-500/20 border-amber-400 text-amber-100'
                          : 'bg-white/5 border-white/10 text-white/50'
                      }`}
                    >
                      <div className="text-xs font-extrabold">
                        🏷️ Figuren-Namen: {showAllNames ? 'AN' : 'AUS'}
                      </div>
                      <div className="text-[10px] opacity-75 mt-0.5">
                        {showAllNames
                          ? 'Namen über Figuren eingeblendet'
                          : 'Freies 3D-Brett ohne Text-Badges'}
                      </div>
                    </button>

                    <button
                      onClick={toggleMusic}
                      className={`p-3 rounded-2xl border text-left transition ${
                        musicEnabled
                          ? 'bg-amber-500/20 border-amber-400 text-amber-100'
                          : 'bg-white/5 border-white/10 text-white/50'
                      }`}
                    >
                      <div className="text-xs font-extrabold">
                        🎵 Welt-Musik: {musicEnabled ? 'AN' : 'AUS'}
                      </div>
                      <div className="text-[10px] opacity-75 mt-0.5">
                        Atmosphärische Themen-Musik im Hintergrund
                      </div>
                    </button>

                    <button
                      onClick={toggleSound}
                      className={`p-3 rounded-2xl border text-left transition ${
                        soundEnabled
                          ? 'bg-amber-500/20 border-amber-400 text-amber-100'
                          : 'bg-white/5 border-white/10 text-white/50'
                      }`}
                    >
                      <div className="text-xs font-extrabold">
                        🔊 Soundeffekte: {soundEnabled ? 'AN' : 'AUS'}
                      </div>
                      <div className="text-[10px] opacity-75 mt-0.5">
                        Zug-Geräusche, Haptik & Familien-Stimmen
                      </div>
                    </button>
                  </div>
                </div>

                {/* Extra Buttons + Big Start Match Button */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/15">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setIsHeroModalOpen(true)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-purple-600/30 hover:bg-purple-600/50 text-purple-100 border border-purple-400/50 transition"
                    >
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Familie & Stimmen anpassen</span>
                    </button>

                    <button
                      onClick={() => setIsScoreboardOpen(true)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500/20 hover:bg-amber-500/35 text-amber-200 border border-amber-400/40 transition"
                    >
                      <Trophy className="w-4 h-4 text-amber-400" />
                      <span>
                        Pokale (
                        {scoreboard.goldWins +
                          scoreboard.purpleWins +
                          scoreboard.treasureWins}
                        )
                      </span>
                    </button>
                  </div>

                  <button
                    onClick={handleStartMatch}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl font-dungeon text-sm sm:text-base font-black bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-black shadow-[0_0_30px_rgba(251,191,36,0.5)] transition transform hover:scale-[1.02]"
                  >
                    <Swords className="w-5 h-5" />
                    <span>SPIEL STARTEN</span>
                  </button>
                </div>
              </div>
            ) : (
              /* TAB 2: SPIELVERLAUF-HISTORIE (AKTUELLE / LETZTE PARTIE & ARCHIV) */
              <div className="p-5 overflow-y-auto space-y-4">
                {currentMoveLog.length > 0 && (
                  <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-400/40 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                        📍 Letzte / Aktuelle Partie ({currentMoveLog.length} Halbzüge)
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard?.writeText(gameRef.current.pgn());
                        }}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/40 text-amber-200 text-xs font-bold"
                      >
                        PGN kopieren
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                      {currentMoveLog.map((entry) => (
                        <div
                          key={entry.moveIndex}
                          className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/10 text-xs text-amber-100"
                        >
                          <div className="truncate">
                            <span className="font-mono text-amber-400 mr-1.5">
                              {entry.turnNumber}
                              {entry.color === 'w' ? '.' : '...'}
                            </span>
                            <span className="font-bold">{entry.heroName}</span>{' '}
                            <span className="font-mono text-white">
                              {entry.from.toUpperCase()}→{entry.to.toUpperCase()}
                            </span>{' '}
                            <span className="opacity-65">({entry.san})</span>
                            {entry.capturedHeroName && (
                              <span className="text-rose-300 ml-1">
                                ⚔️ {entry.capturedHeroName}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-mono opacity-50 ml-2">
                            {entry.timestamp}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                      📚 Gespeicherte Partien ({matchHistoryArchive.length})
                    </h3>
                    {matchHistoryArchive.length > 0 && (
                      <button
                        onClick={() => {
                          setMatchHistoryArchive([]);
                          try {
                            localStorage.removeItem(STORAGE_KEY_MATCH_HISTORY);
                          } catch {
                            // ignore
                          }
                        }}
                        className="text-xs text-rose-300/70 hover:text-rose-300 underline"
                      >
                        Verlauf leeren
                      </button>
                    )}
                  </div>

                  {matchHistoryArchive.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-white/5 border border-white/10 text-center text-xs text-amber-100/60">
                      Noch keine abgeschlossenen Partien im Archiv. Starte ein Spiel – jeder Zug wird automatisch protokolliert!
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {matchHistoryArchive.map((rec) => {
                        const isExpanded = expandedArchiveId === rec.id;
                        return (
                          <div
                            key={rec.id}
                            className="rounded-2xl bg-white/5 border border-white/15 overflow-hidden"
                          >
                            <button
                              onClick={() =>
                                setExpandedArchiveId(isExpanded ? null : rec.id)
                              }
                              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition"
                            >
                              <div>
                                <div className="text-xs font-extrabold text-amber-200">
                                  {rec.resultLabel} •{' '}
                                  <span className="text-white/80 font-normal">
                                    {rec.levelName}
                                  </span>
                                </div>
                                <div className="text-[11px] text-amber-100/60 mt-0.5">
                                  🕒 {rec.dateLabel} • {rec.totalMoves} Halbzüge
                                </div>
                              </div>
                              <span className="text-xs font-bold text-amber-300">
                                {isExpanded ? '▲ Ausblenden' : '▼ Züge zeigen'}
                              </span>
                            </button>

                            {isExpanded && (
                              <div className="px-4 pb-3 pt-1 border-t border-white/10 bg-black/40 space-y-2">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-52 overflow-y-auto">
                                  {rec.moves.map((m) => (
                                    <div
                                      key={m.moveIndex}
                                      className="flex items-center justify-between px-2.5 py-1 rounded bg-white/5 text-[11px] text-amber-100"
                                    >
                                      <span className="truncate">
                                        <strong className="text-amber-400 font-mono mr-1">
                                          {m.turnNumber}
                                          {m.color === 'w' ? '.' : '...'}
                                        </strong>
                                        {m.heroName}:{' '}
                                        <strong className="text-white font-mono">
                                          {m.from.toUpperCase()}→{m.to.toUpperCase()}
                                        </strong>{' '}
                                        ({m.san})
                                        {m.capturedHeroName
                                          ? ` ⚔️ ${m.capturedHeroName}`
                                          : ''}
                                      </span>
                                      <span className="font-mono text-[10px] opacity-50 ml-1">
                                        {m.timestamp}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* COUSIN PAWN PROMOTION (KRÖNUNGS-AUSWAHL) MODAL */}
      {pendingPromotion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="max-w-lg w-full p-6 rounded-3xl bg-gradient-to-b from-amber-950/95 via-slate-900/95 to-purple-950/95 border-2 border-amber-400 shadow-[0_0_60px_rgba(251,191,36,0.65)] text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400 text-amber-300 text-xs font-extrabold uppercase tracking-wider">
              <Crown className="w-4 h-4" />
              Bäuerinnen-Krönung am Ende des Bretts!
            </div>
            <h2 className="font-dungeon text-2xl font-black text-white">
              Wen rufst du zur Verstärkung herbei?
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {(['q', 'n', 'b', 'r'] as ('q' | 'n' | 'b' | 'r')[]).map(
                (role) => {
                  const h = heroes[role];
                  return (
                    <button
                      key={role}
                      onClick={() => {
                        const { from, to } = pendingPromotion;
                        setPendingPromotion(null);
                        executeMove(from, to, false, role);
                      }}
                      className="group flex flex-col items-center p-3 rounded-2xl bg-black/60 hover:bg-amber-500/25 border-2 border-white/15 hover:border-amber-400 transition shadow-lg"
                    >
                      <img
                        src={h.spritePath}
                        alt={h.customName}
                        className="w-16 h-16 rounded-xl object-cover border-2 border-amber-300 group-hover:scale-105 transition"
                      />
                      <span className="mt-2 font-dungeon text-xs font-extrabold text-amber-200">
                        {h.customName}
                      </span>
                      <span className="text-[10px] font-bold text-amber-400/90 uppercase">
                        {h.chessName}
                      </span>
                    </button>
                  );
                }
              )}
            </div>
          </div>
        </div>
      )}

      {/* ETERNAL FAMILY SCOREBOARD MODAL */}
      {isScoreboardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="max-w-md w-full p-6 rounded-3xl bg-gradient-to-b from-slate-900 via-indigo-950 to-black border-2 border-amber-400/80 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-400 text-black flex items-center justify-center font-black">
                  <Trophy className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="font-dungeon text-lg font-black text-amber-200">
                    EWIGE FAMILIEN-BESTENLISTE
                  </h2>
                  <p className="text-xs text-amber-100/70">
                    Alle Siege & gesammelten Schatzjagd-Missionen
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsScoreboardOpen(false)}
                className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white"
              >
                Schließen
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5 pt-2">
              <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-400/40 text-center">
                <div className="text-2xl">☀️</div>
                <div className="text-2xl font-black text-amber-300 mt-1">
                  {scoreboard.goldWins}
                </div>
                <div className="text-[11px] font-bold text-amber-100/80">
                  Team Gold Siege
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-purple-500/15 border border-purple-400/40 text-center">
                <div className="text-2xl">🌙</div>
                <div className="text-2xl font-black text-purple-300 mt-1">
                  {scoreboard.purpleWins}
                </div>
                <div className="text-[11px] font-bold text-purple-100/80">
                  Team Violett Siege
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-pink-500/15 border border-pink-400/40 text-center">
                <div className="text-2xl">🎁</div>
                <div className="text-2xl font-black text-pink-300 mt-1">
                  {scoreboard.treasureWins}
                </div>
                <div className="text-[11px] font-bold text-pink-100/80">
                  Schatz-Missionen
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-1">
              <button
                onClick={() => {
                  const empty = { goldWins: 0, purpleWins: 0, treasureWins: 0 };
                  setScoreboard(empty);
                  try {
                    localStorage.setItem(
                      STORAGE_KEY_SCOREBOARD,
                      JSON.stringify(empty)
                    );
                  } catch {
                    // ignore
                  }
                }}
                className="text-xs text-red-300/70 hover:text-red-300 underline"
              >
                Zähler zurücksetzen
              </button>
              <button
                onClick={() => setIsScoreboardOpen(false)}
                className="px-4 py-2 rounded-xl bg-amber-500 text-black font-bold text-xs"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VICTORY / GAME OVER OVERLAY WITH INTEGRATED MOVE HISTORY */}
      {isMatchActive && (isCheckmate || isDraw || isTreasureComplete) && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="max-w-lg w-full p-6 rounded-3xl bg-gradient-to-b from-amber-950/95 via-slate-900/95 to-purple-950/95 border-2 border-amber-400 shadow-[0_0_60px_rgba(251,191,36,0.5)] text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-400 text-black flex items-center justify-center shadow-lg">
              <Trophy className="w-8 h-8" />
            </div>
            <h2 className="font-dungeon text-2xl sm:text-3xl font-black text-amber-200">
              {isTreasureComplete
                ? 'ALLE SCHÄTZE GEFUNDEN!'
                : isCheckmate
                ? turnColor === 'b'
                  ? 'SIEG FÜR DIE FAMILIE!'
                  : 'DER DUNGEON HAT GESIEGT!'
                : 'UNENTSCHIEDEN!'}
            </h2>

            {/* Compact Spielverlauf Summary inside Game Over Screen */}
            {currentMoveLog.length > 0 && (
              <div className="text-left p-3 rounded-2xl bg-black/50 border border-white/15 max-h-40 overflow-y-auto space-y-1">
                <div className="text-[10px] font-extrabold uppercase text-amber-300 mb-1">
                  📜 Spielverlauf ({currentMoveLog.length} Züge)
                </div>
                {currentMoveLog.map((m) => (
                  <div
                    key={m.moveIndex}
                    className="text-xs text-amber-100 flex items-center justify-between"
                  >
                    <span>
                      <strong className="text-amber-400 font-mono mr-1">
                        {m.turnNumber}
                        {m.color === 'w' ? '.' : '...'}
                      </strong>
                      {m.heroName}: {m.from.toUpperCase()} → {m.to.toUpperCase()}{' '}
                      ({m.san})
                    </span>
                    <span className="text-[10px] opacity-50 font-mono">
                      {m.timestamp}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={handleNewGame}
                className="px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-amber-400 to-orange-500 text-black shadow-lg"
              >
                🔄 Nochmal spielen
              </button>
              <button
                onClick={() => {
                  setIsMatchActive(false);
                  setMenuTab('settings');
                }}
                className="px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-white/15 hover:bg-white/25 text-white border border-white/20"
              >
                ⚙️ Spiel beenden & Settings ändern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Family Hero Customization & Voice Studio Modal */}
      <FamilyHeroModal
        isOpen={isHeroModalOpen}
        heroes={heroes}
        onClose={() => setIsHeroModalOpen(false)}
        onSaveHeroes={handleSaveHeroes}
      />

      {/* Online Family Room P2P Modal */}
      <OnlineRoomModal
        isOpen={isOnlineModalOpen}
        roomCode={roomCode}
        isConnected={isPeerConnected}
        peerRole={peerRole}
        statusMessage={onlineStatus}
        onCreateRoom={handleCreateOnlineRoom}
        onJoinRoom={handleJoinOnlineRoom}
        onDisconnect={handleDisconnectOnline}
        onSendEmoji={handleSendEmoji}
        onClose={() => setIsOnlineModalOpen(false)}
      />
    </div>
  );
};
export default App;
