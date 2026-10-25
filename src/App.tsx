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
const PEER_PREFIX = 'fdc-room-';

export type GameMode = 'campaign' | 'local2p' | 'online' | 'treasure';

export interface FamilyScoreboard {
  goldWins: number;
  purpleWins: number;
  treasureWins: number;
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
  const [isCleanHudMode, setIsCleanHudMode] = useState<boolean>(false);
  const [pillSpinning, setPillSpinning] = useState<boolean>(false);
  const [showPillHeroTooltip, setShowPillHeroTooltip] = useState<boolean>(false);

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
        setMoveHistory(game.history());

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

        const attackerRole = moveResult.piece as PieceRole;
        const voiceUrl = heroes[attackerRole]?.customAudioDataUrl;

        if (moveResult.captured) {
          soundFX.playCapture(voiceUrl);
          triggerCaptureEffect(moveResult);
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
      return;
    }
    gameRef.current = new Chess();
    setFen(gameRef.current.fen());
    setSelectedSquare(null);
    setLastMove(null);
    setHintMove(null);
    setCaptureEffect(null);
    setMoveHistory([]);
    setCapturedByGold([]);
    setCapturedByPurple([]);
    setGoldPowerUsed(false);
    setPurplePowerUsed(false);
    setGoldComebackUsed(false);
    setPurpleComebackUsed(false);
    setMoveQualityBadge(null);
    setShieldedSquares([]);
    setFrozenSquares([]);
    setExtraTurnActive(false);
    setIsAIThinking(false);
    soundFX.playSelect();

    if (connRef.current && connRef.current.open) {
      connRef.current.send({ type: 'reset' });
    }
  };

  const handleUndo = () => {
    const game = gameRef.current;
    if (game.history().length === 0 || isAIThinking || gameMode === 'treasure')
      return;
    if (gameMode === 'campaign') {
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

      {/* TOP HUD: Title, Level Switcher (1-3) & Mode Controls */}
      <header
        className={`relative z-10 flex flex-wrap items-center justify-between gap-2 px-3 sm:px-5 py-2.5 bg-gradient-to-b from-black/85 via-black/55 to-transparent pointer-events-auto transition-all duration-300 ${
          isCleanHudMode ? 'hidden' : ''
        }`}
      >
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
              <span className="hidden lg:inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40">
                v2.0 Royal Edition
              </span>
            </div>
            <p className="text-[11px] text-amber-100/75 hidden sm:block">
              {gameMode === 'treasure'
                ? `${currentQuest.title}`
                : `${currentLevel.name} — ${currentLevel.subtitle}`}
            </p>
          </div>
        </div>

        {/* 3 Dungeon Levels + Ramadan & Halloween Special Themes Selector */}
        <div className="flex items-center gap-1 bg-black/60 p-1 rounded-2xl border border-amber-500/30 backdrop-blur-md flex-wrap">
          {DUNGEON_LEVELS.map((lvl) => {
            const active = lvl.id === currentLevelId;
            const stars = levelStars[lvl.id] || 0;
            const isRamadan = lvl.specialTheme === 'ramadan';
            const isHalloween = lvl.specialTheme === 'halloween';
            return (
              <button
                key={lvl.id}
                onClick={() => {
                  setCurrentLevelId(lvl.id);
                  soundFX.playSelect();
                }}
                className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                  active
                    ? isRamadan
                      ? 'bg-gradient-to-r from-emerald-500 to-amber-400 text-black shadow-md'
                      : isHalloween
                      ? 'bg-gradient-to-r from-orange-500 to-purple-600 text-white shadow-md'
                      : 'bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-md'
                    : isRamadan
                    ? 'text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/30'
                    : isHalloween
                    ? 'text-orange-300 hover:bg-orange-500/20 border border-orange-500/30'
                    : 'text-amber-100/75 hover:bg-white/10'
                }`}
              >
                <span>{lvl.shortLabel}</span>
                <span className="text-[10px]">
                  {stars > 0 ? '👑'.repeat(stars) : lvl.badgeEmoji}
                </span>
              </button>
            );
          })}
        </div>

        {/* 4 Game Modes + Family Studio + Sound */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex bg-black/60 p-1 rounded-xl border border-white/15">
            <button
              onClick={() => {
                setGameMode('campaign');
                handleNewGame();
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                gameMode === 'campaign'
                  ? 'bg-amber-500 text-black'
                  : 'text-amber-100/70 hover:text-white'
              }`}
              title="1-Spieler Kampagne gegen die 3 Dungeon-Bosse"
            >
              <Bot className="w-3.5 h-3.5" />
              <span className="hidden md:inline">1P Dungeon</span>
            </button>

            <button
              onClick={() => {
                setGameMode('local2p');
                handleNewGame();
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                gameMode === 'local2p'
                  ? 'bg-purple-500 text-white'
                  : 'text-amber-100/70 hover:text-white'
              }`}
              title="2-Spieler Familien-Duell am selben Gerät"
            >
              <Users className="w-3.5 h-3.5" />
              <span className="hidden md:inline">2P Tisch</span>
            </button>

            <button
              onClick={() => {
                setGameMode('treasure');
                loadTreasureQuest(questIndex);
                soundFX.playSelect();
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                gameMode === 'treasure'
                  ? 'bg-pink-500 text-white'
                  : 'text-amber-100/70 hover:text-white'
              }`}
              title="Prinzessin Minis Kinder-Schatzjagd (5 Lern-Missionen)"
            >
              <Compass className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Schatzjagd</span>
            </button>

            <button
              onClick={() => setIsOnlineModalOpen(true)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                gameMode === 'online' || isPeerConnected
                  ? 'bg-emerald-500 text-black'
                  : 'text-emerald-300 hover:text-white'
              }`}
              title="Online-Familien-Raum per WhatsApp-Link oder Raum-Code"
            >
              <Wifi className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Online-Raum</span>
            </button>
          </div>

          <button
            onClick={() => setIsScoreboardOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-amber-500/20 hover:bg-amber-500/35 text-amber-200 border border-amber-400/40 transition"
            title="Ewige Familien-Bestenliste anzeigen"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden xl:inline">Pokale</span>
            <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-black text-[10px] font-black">
              {scoreboard.goldWins +
                scoreboard.purpleWins +
                scoreboard.treasureWins}
            </span>
          </button>

          <button
            onClick={() => setIsHeroModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border border-purple-300/40 shadow-lg transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Familie & Stimmen</span>
          </button>

          <button
            onClick={toggleSound}
            className="p-2 rounded-xl bg-black/60 hover:bg-white/15 text-amber-200 border border-white/15 transition"
            title={soundEnabled ? 'Ton ausschalten' : 'Ton einschalten'}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4 opacity-50" />
            )}
          </button>

          <button
            onClick={() => {
              setIsCleanHudMode((v) => !v);
              soundFX.playSelect();
            }}
            className="p-2 rounded-xl bg-black/60 hover:bg-amber-500/25 text-amber-200 border border-amber-400/30 transition"
            title="Kino-Fokus (Menüs ausblenden für 95% 3D-Spielfeld)"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* MIDDLE FLOATING BANNERS */}
      <div className="relative z-10 pointer-events-none flex-1 flex flex-col justify-between p-3 sm:p-5">
        <div className="flex flex-col items-center gap-2">
          {/* Heartfelt Ramadan Mubarak Trilingual Greeting Banner when Ramadan Theme is active */}
          {currentLevel.specialTheme === 'ramadan' && !isCleanHudMode && (
            <div className="pointer-events-auto flex items-center gap-2.5 px-4 py-1 rounded-full bg-gradient-to-r from-emerald-950/90 via-teal-900/90 to-emerald-950/90 border border-amber-400/80 shadow-[0_0_25px_rgba(251,191,36,0.35)] backdrop-blur-md">
              <span className="text-sm">🌙</span>
              <span className="text-[11px] sm:text-xs font-extrabold tracking-wide text-amber-300">
                رمضان كريم • Ramadan Mubarak • Hayırlı Ramazanlar
              </span>
              <span className="hidden md:inline text-[11px] text-emerald-200 font-semibold">
                — Herzlicher Familien-Schachabend nach dem Iftar 🫖🌴✨
              </span>
            </div>
          )}

          {/* Interactive Animated Hero Status Pill (Tap for Haptics, Voice & Hero Info) */}
          <div className="flex items-center gap-2">
            <div
              onClick={() => {
                soundFX.playSelect();
                const activeHero =
                  gameMode === 'treasure'
                    ? heroes[currentQuest.heroRole]
                    : turnColor === 'w'
                    ? heroes.k
                    : heroes.q;
                if (activeHero.customAudioDataUrl) {
                  soundFX.playCustomVoice(activeHero.customAudioDataUrl);
                }
                setPillSpinning(true);
                setShowPillHeroTooltip((prev) => !prev);
                setTimeout(() => setPillSpinning(false), 600);
              }}
              title="Tippe auf die Helden-Pille für Stimme, Haptik & Spezialkraft-Info!"
              className={`pointer-events-auto cursor-pointer select-none flex flex-wrap items-center justify-center gap-3 px-4 py-1.5 rounded-full border-2 backdrop-blur-md transition-all duration-300 hover:scale-[1.03] active:scale-95 ${
                gameMode === 'treasure'
                  ? 'bg-gradient-to-r from-pink-950/90 via-black/85 to-amber-950/90 border-pink-400/70 shadow-[0_0_28px_rgba(244,114,182,0.35)]'
                  : turnColor === 'w'
                  ? 'bg-gradient-to-r from-amber-950/90 via-black/85 to-amber-900/85 border-amber-400/70 shadow-[0_0_28px_rgba(251,191,36,0.35)]'
                  : 'bg-gradient-to-r from-purple-950/90 via-black/85 to-indigo-950/90 border-purple-400/70 shadow-[0_0_28px_rgba(192,132,252,0.35)]'
              }`}
            >
              <div className="relative">
                <img
                  src={
                    gameMode === 'treasure'
                      ? heroes[currentQuest.heroRole].spritePath
                      : turnColor === 'w'
                      ? heroes.k.spritePath
                      : heroes.q.spritePath
                  }
                  alt="Aktiver Held"
                  className={`w-8 h-8 rounded-full object-cover border-2 transition-transform duration-500 ${
                    pillSpinning ? 'rotate-[360deg] scale-110' : ''
                  } ${
                    gameMode === 'treasure'
                      ? 'border-pink-400'
                      : turnColor === 'w'
                      ? 'border-amber-400'
                      : 'border-purple-400'
                  } shadow-md`}
                />
                {currentLevel.specialTheme && (
                  <span className="absolute -bottom-1 -right-1 text-[10px] leading-none drop-shadow">
                    {currentLevel.specialTheme === 'ramadan' ? '🌙' : '🎃'}
                  </span>
                )}
              </div>
              <div
                className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                  gameMode === 'treasure'
                    ? 'bg-pink-400 shadow-[0_0_10px_#f472b6]'
                    : turnColor === 'w'
                    ? 'bg-amber-400 shadow-[0_0_10px_#fbbf24]'
                    : 'bg-purple-400 shadow-[0_0_10px_#c084fc]'
                }`}
              />
              <span className="text-xs sm:text-sm font-bold text-amber-100">
                {gameMode === 'treasure' ? (
                  <span>
                    🎁 <strong>{currentQuest.title}</strong> — Noch{' '}
                    <strong className="text-amber-300">
                      {remainingTreasures.length}
                    </strong>{' '}
                    Schatztruhen! (Züge: {questMovesCount})
                  </span>
                ) : isCheckmate ? (
                  <span className="text-amber-300 font-extrabold">
                    🏆 SCHACHMATT!{' '}
                    {turnColor === 'w'
                      ? 'Team Kristall-Violett'
                      : 'Team Gold-Licht'}{' '}
                    gewinnt!
                  </span>
                ) : isDraw ? (
                  <span>🤝 Unentschieden im Dungeon!</span>
                ) : isAIThinking ? (
                  <span className="text-purple-300">
                    🔮 {currentLevel.bossName} überlegt seinen Zug...
                  </span>
                ) : turnColor === 'w' ? (
                  <span>
                    ☀️ Team Gold ({heroes.k.customName} & {heroes.q.customName})
                    ist am Zug
                  </span>
                ) : gameMode === 'local2p' || gameMode === 'online' ? (
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

              {moveQualityBadge && gameMode !== 'treasure' && (
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border shadow-md animate-pulse ${moveQualityBadge.colorClass}`}
                >
                  {moveQualityBadge.label}
                </span>
              )}
            </div>

            {isCleanHudMode && (
              <button
                onClick={() => {
                  setIsCleanHudMode(false);
                  soundFX.playSelect();
                }}
                className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/80 hover:bg-amber-500/30 text-amber-200 border border-amber-400/50 text-xs font-bold shadow-lg backdrop-blur-md transition"
                title="Menüleisten wieder einblenden"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">HUD zeigen</span>
              </button>
            )}
          </div>

          {/* Interactive Hero Pill Quick-Tooltip (toggled on tap) */}
          {showPillHeroTooltip && (
            <div
              onClick={() => setShowPillHeroTooltip(false)}
              className="pointer-events-auto cursor-pointer flex items-center gap-2.5 px-3.5 py-1.5 rounded-2xl bg-black/90 border border-amber-400/60 backdrop-blur-md text-xs text-amber-100 shadow-xl"
            >
              <span className="text-amber-300 font-extrabold">
                {(gameMode === 'treasure'
                  ? heroes[currentQuest.heroRole]
                  : turnColor === 'w'
                  ? heroes.k
                  : heroes.q
                ).superpower.icon}{' '}
                {(gameMode === 'treasure'
                  ? heroes[currentQuest.heroRole]
                  : turnColor === 'w'
                  ? heroes.k
                  : heroes.q
                ).customName}
                :
              </span>
              <span className="italic text-amber-100/90">
                „
                {(gameMode === 'treasure'
                  ? heroes[currentQuest.heroRole]
                  : turnColor === 'w'
                  ? heroes.k
                  : heroes.q
                ).battleCry}
                “
              </span>
            </div>
          )}

          {/* LiGround-Style Live Power Balance Bar (Gold vs. Kristall-Violett) */}
          {gameMode !== 'treasure' && (
            <div
              className="pointer-events-auto flex items-center gap-2 w-64 sm:w-80 px-2.5 py-1 rounded-full bg-black/75 border border-white/15 backdrop-blur-md shadow-lg"
              title="LiGround Live-Stellungsbewertung: Zeigt, welches Team gerade im Vorteil ist"
            >
              <span className="text-[10px] font-extrabold text-amber-300 shrink-0">
                ☀️ {goldWinPercent}%
              </span>
              <div className="flex-1 h-2 rounded-full bg-purple-950 overflow-hidden flex border border-white/10">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-yellow-300 transition-all duration-500"
                  style={{ width: `${goldWinPercent}%` }}
                />
              </div>
              <span className="text-[10px] font-extrabold text-purple-300 shrink-0">
                {100 - goldWinPercent}% 🌙
              </span>
            </div>
          )}

          {/* Treasure Quest Switcher Bar */}
          {gameMode === 'treasure' && (
            <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1.5 bg-black/80 px-3 py-1.5 rounded-2xl border border-pink-400/50">
              {TREASURE_QUESTS.map((q, idx) => (
                <button
                  key={q.id}
                  onClick={() => {
                    setQuestIndex(idx);
                    loadTreasureQuest(idx);
                    soundFX.playSelect();
                  }}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition ${
                    questIndex === idx
                      ? 'bg-pink-500 text-white shadow'
                      : 'text-pink-200/75 hover:bg-white/10'
                  }`}
                >
                  Mission {q.id}
                </button>
              ))}
              <span className="text-xs text-amber-200/90 ml-2 hidden md:inline">
                {currentQuest.story}
              </span>
            </div>
          )}

          {/* Active Superpower Announcement Banner */}
          {powerBanner && (
            <div className="pointer-events-none px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-purple-600 text-black font-extrabold text-xs sm:text-sm shadow-2xl animate-bounce">
              {powerBanner}
            </div>
          )}
        </div>

        {/* Left & Right Floating Cards (Selected Hero + Superpower Trigger + Captured Pieces) */}
        <div className="flex items-end justify-between gap-4">
          {selectedPieceInfo ? (
            <div className="pointer-events-auto max-w-xs sm:max-w-md p-3.5 rounded-2xl bg-black/85 border-2 border-amber-400/60 backdrop-blur-md shadow-2xl flex flex-col gap-2.5 animate-float">
              <div className="flex items-center gap-3.5">
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

              {/* Dungeon Superpower Button (1x per Match) */}
              {dungeonPowersEnabled && gameMode !== 'treasure' && (
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/15">
                  <div className="text-[11px] text-amber-200/90">
                    <span className="font-bold text-amber-300">
                      {selectedPieceInfo.hero.superpower.icon}{' '}
                      {selectedPieceInfo.hero.superpower.name}:
                    </span>{' '}
                    {selectedPieceInfo.hero.superpower.shortDesc}
                  </div>
                  <button
                    onClick={handleActivateSuperpower}
                    disabled={!canUseSuperpower}
                    className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-extrabold transition ${
                      canUseSuperpower
                        ? 'bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-black shadow-lg shadow-amber-500/30 animate-pulse'
                        : 'bg-white/10 text-white/40 cursor-not-allowed'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>
                      {(turnColor === 'w' && goldPowerUsed) ||
                      (turnColor === 'b' && purplePowerUsed)
                        ? 'Schon genutzt'
                        : 'Superkraft zünden!'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden sm:flex pointer-events-auto items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-black/65 border border-white/10 backdrop-blur-md text-xs text-amber-100/80">
              <Swords className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Tippe auf eine <strong>Familien-Figur</strong>, um ihre
                leuchtenden Züge & <strong>Dungeon-Superkraft</strong> zu sehen!
              </span>
            </div>
          )}

          {/* Captured Pieces, Crazyhouse Parachute Comeback & Move Chronicle Pill */}
          <div className="hidden md:flex flex-col items-end gap-1.5 pointer-events-auto">
            {isChronicleOpen && moveHistory.length > 0 && (
              <div className="w-64 max-h-40 overflow-y-auto p-3 rounded-2xl bg-black/90 border border-amber-400/50 backdrop-blur-md text-xs text-amber-100 shadow-2xl space-y-1">
                <div className="flex items-center justify-between border-b border-white/15 pb-1 mb-1">
                  <span className="font-extrabold text-amber-300 uppercase text-[10px]">
                    📜 LiGround Zug-Chronik
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(gameRef.current.pgn());
                      showTemporaryBanner('📋 PGN-Zug-Chronik in die Zwischenablage kopiert!');
                    }}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/40 text-amber-200 font-bold"
                  >
                    PGN kopieren
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] font-mono">
                  {moveHistory.map((san, idx) => (
                    <div key={idx} className="truncate">
                      {idx % 2 === 0 ? (
                        <span className="text-amber-400/70 mr-1">
                          {Math.floor(idx / 2) + 1}.
                        </span>
                      ) : null}
                      <span className={idx % 2 === 0 ? 'text-amber-200' : 'text-purple-300'}>
                        {san}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="px-3.5 py-2 rounded-2xl bg-black/75 border border-white/15 backdrop-blur-md text-right space-y-1">
              <div className="flex items-center justify-end gap-2">
                <span className="text-[10px] uppercase tracking-wider text-amber-300 font-bold">
                  {currentLevel.difficultyLabel}
                </span>
                {moveHistory.length > 0 && (
                  <button
                    onClick={() => setIsChronicleOpen((v) => !v)}
                    className="px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-[10px] font-bold text-amber-200"
                    title="Zug-Chronik ein-/ausblenden"
                  >
                    📜 {moveHistory.length} Züge
                  </button>
                )}
              </div>
              <div className="flex items-center justify-end gap-3 text-xs">
                <div>
                  <span className="text-amber-300 font-bold">☀️ Beute: </span>
                  {capturedByGold.length === 0 ? (
                    <span className="opacity-40">–</span>
                  ) : (
                    capturedByGold.map((r, i) => (
                      <button
                        key={i}
                        onClick={() => handleParachuteComeback('b', r, i)}
                        disabled={purpleComebackUsed || turnColor !== 'b'}
                        className="mr-0.5 px-1 rounded bg-amber-500/20 hover:bg-amber-400 hover:text-black transition disabled:opacity-60"
                        title={`${heroes[r].customName} (Klicke für Crazyhouse-Fallschirm-Comeback!)`}
                      >
                        {heroes[r].chessName[0]}
                      </button>
                    ))
                  )}
                </div>
                <div className="border-l border-white/20 pl-3">
                  <span className="text-purple-300 font-bold">🌙 Beute: </span>
                  {capturedByPurple.length === 0 ? (
                    <span className="opacity-40">–</span>
                  ) : (
                    capturedByPurple.map((r, i) => (
                      <button
                        key={i}
                        onClick={() => handleParachuteComeback('w', r, i)}
                        disabled={goldComebackUsed || turnColor !== 'w'}
                        className="mr-0.5 px-1 rounded bg-purple-500/20 hover:bg-amber-400 hover:text-black transition disabled:opacity-60"
                        title={
                          !goldComebackUsed
                            ? `🪂 Klicke, um ${heroes[r].customName} per Fallschirm zurück aufs Brett zu rufen (1x pro Spiel)!`
                            : heroes[r].customName
                        }
                      >
                        {heroes[r].chessName[0]}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

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
            <p className="text-xs sm:text-sm text-amber-100/80">
              Deine Cousine hat das letzte Feld ({pendingPromotion.to.toUpperCase()})
              erreicht! Wähle, in welches Familienmitglied sie sich mit einer
              goldenen Licht-Spirale verwandeln soll:
            </p>
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

            <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 space-y-2">
              <div className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                Dungeon-Kampagnen-Kronen
              </div>
              {DUNGEON_LEVELS.map((lvl) => (
                <div
                  key={lvl.id}
                  className="flex items-center justify-between text-xs text-amber-100"
                >
                  <span>{lvl.name}</span>
                  <span>
                    {(levelStars[lvl.id] || 0) > 0
                      ? '👑'.repeat(levelStars[lvl.id])
                      : 'Noch offen'}
                  </span>
                </div>
              ))}
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
                Weiterzocken!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VICTORY / GAME OVER / TREASURE COMPLETE OVERLAY */}
      {(isCheckmate || isDraw || isTreasureComplete) && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="max-w-md w-full p-6 rounded-3xl bg-gradient-to-b from-amber-950/95 via-slate-900/95 to-purple-950/95 border-2 border-amber-400 shadow-[0_0_60px_rgba(251,191,36,0.5)] text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-400 text-black flex items-center justify-center shadow-lg">
              <Trophy className="w-9 h-9" />
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
            <p className="text-sm text-amber-100/85">
              {isTreasureComplete
                ? `Stark gemacht! Du hast ${currentQuest.title} in ${questMovesCount} Zügen gelöst!`
                : isCheckmate && turnColor === 'b'
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
              {isTreasureComplete && questIndex < TREASURE_QUESTS.length - 1 && (
                <button
                  onClick={() => {
                    const nextIdx = questIndex + 1;
                    setQuestIndex(nextIdx);
                    loadTreasureQuest(nextIdx);
                  }}
                  className="px-5 py-2.5 rounded-xl font-bold text-sm bg-pink-600 hover:bg-pink-500 text-white border border-pink-300/40"
                >
                  Nächste Schatz-Mission →
                </button>
              )}
              {!isTreasureComplete && currentLevelId < 5 && (
                <button
                  onClick={() => {
                    setCurrentLevelId(
                      (prev) => Math.min(5, prev + 1) as DungeonLevelId
                    );
                    handleNewGame();
                  }}
                  className="px-5 py-2.5 rounded-xl font-bold text-sm bg-purple-600 hover:bg-purple-500 text-white border border-purple-300/40"
                >
                  Nächste Welt →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM DOCK: Kid-Helper, Superpowers Toggle, Tipp, Camera Angles & New Game */}
      <footer
        className={`relative z-10 flex flex-wrap items-center justify-between gap-2 px-3 sm:px-6 py-2.5 bg-gradient-to-t from-black/90 via-black/70 to-transparent pointer-events-auto transition-all duration-300 ${
          isCleanHudMode ? 'hidden' : ''
        }`}
      >
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <button
            onClick={() => setKidMode((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
              kidMode
                ? 'bg-emerald-600/90 text-white border-emerald-300/50 shadow-md shadow-emerald-600/20'
                : 'bg-black/60 text-amber-100/70 border-white/15 hover:bg-white/10'
            }`}
          >
            <Baby className="w-4 h-4" />
            <span>Kinder-Hilfe {kidMode ? 'AN' : 'AUS'}</span>
          </button>

          <button
            onClick={() => setDungeonPowersEnabled((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
              dungeonPowersEnabled
                ? 'bg-amber-500/90 text-black border-amber-300 shadow-md'
                : 'bg-black/60 text-amber-100/70 border-white/15 hover:bg-white/10'
            }`}
            title="Schaltet die einmaligen Familien-Superkräfte pro Partie an oder aus"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Superkräfte {dungeonPowersEnabled ? 'AN' : 'AUS'}</span>
          </button>

          {gameMode !== 'treasure' && (
            <button
              onClick={handleShowHint}
              disabled={isAIThinking}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-600/80 hover:bg-sky-500 text-white border border-sky-300/40 transition disabled:opacity-40"
            >
              <Lightbulb className="w-4 h-4 text-amber-200" />
              <span>Zug-Tipp</span>
            </button>
          )}

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

        {/* Right Game Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleUndo}
            disabled={
              moveHistory.length === 0 ||
              isAIThinking ||
              gameMode === 'treasure'
            }
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
