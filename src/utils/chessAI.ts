import { Chess, Move } from 'chess.js';

// PeSTO / Grandmaster Tapered Evaluation Piece Values (Middlegame / Endgame)
const MG_VALUE: Record<string, number> = {
  p: 82,
  n: 337,
  b: 365,
  r: 477,
  q: 1025,
  k: 20000,
};

const EG_VALUE: Record<string, number> = {
  p: 94,
  n: 281,
  b: 297,
  r: 512,
  q: 936,
  k: 20000,
};

const PHASE_WEIGHT: Record<string, number> = {
  p: 0,
  n: 1,
  b: 1,
  r: 2,
  q: 4,
  k: 0,
};

// PeSTO Piece-Square Tables (from White's perspective, row 0 = rank 8, row 7 = rank 1)
const PAWN_MG_PST = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [98, 134, 61, 95, 68, 126, 34, -11],
  [-6, 7, 26, 31, 65, 56, 25, -20],
  [-14, 13, 6, 21, 23, 12, 17, -23],
  [-27, -2, -5, 12, 17, 6, 10, -25],
  [-26, -4, -4, -10, 3, 3, 33, -12],
  [-35, -1, -20, -23, -15, 24, 38, -22],
  [0, 0, 0, 0, 0, 0, 0, 0],
];

const PAWN_EG_PST = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [178, 173, 158, 134, 147, 132, 165, 187],
  [94, 100, 85, 67, 56, 53, 82, 84],
  [32, 24, 13, 5, -2, 4, 17, 17],
  [13, 9, -3, -7, -7, -8, 3, -1],
  [4, 7, -6, 1, 0, -5, -1, -8],
  [13, 8, 8, 10, 13, 0, 2, -7],
  [0, 0, 0, 0, 0, 0, 0, 0],
];

const KNIGHT_PST = [
  [-167, -89, -34, -49, 61, -97, -15, -107],
  [-73, -41, 72, 36, 23, 62, 7, -17],
  [-47, 60, 37, 65, 84, 129, 73, 44],
  [-9, 17, 19, 53, 37, 69, 18, 22],
  [-13, 4, 16, 13, 28, 19, 21, -8],
  [-23, -9, 12, 10, 19, 17, 25, -16],
  [-29, -53, -12, -3, -1, 18, -14, -19],
  [-105, -21, -58, -33, -17, -28, -19, -23],
];

const BISHOP_PST = [
  [-29, 4, -82, -37, -25, -42, 7, -8],
  [-26, 16, -18, -13, 30, 59, 18, -47],
  [-16, 37, 43, 40, 35, 50, 37, -2],
  [-4, 5, 19, 50, 37, 37, 7, -2],
  [-6, 13, 13, 26, 34, 12, 10, 4],
  [0, 15, 15, 15, 14, 27, 18, 10],
  [4, 15, 16, 0, 7, 21, 33, 1],
  [-33, -3, -14, -21, -13, -12, -39, -21],
];

const ROOK_PST = [
  [32, 42, 32, 51, 63, 9, 31, 43],
  [27, 32, 58, 62, 80, 67, 26, 44],
  [-5, 19, 26, 36, 17, 45, 61, 16],
  [-24, -11, 7, 26, 24, 35, -8, -20],
  [-36, -26, -12, -1, 9, -7, 6, -23],
  [-45, -25, -16, -17, 3, 0, -5, -33],
  [-44, -16, -20, -9, -1, 11, -6, -71],
  [-19, -13, 1, 17, 16, 7, -37, -26],
];

const QUEEN_PST = [
  [-28, 0, 29, 12, 59, 44, 43, 45],
  [-24, -39, -5, 1, -16, 57, 28, 54],
  [-13, -17, 7, 8, 29, 56, 47, 57],
  [-27, -27, -16, -16, -1, 17, -2, 1],
  [-9, -26, -9, -10, -2, -4, 3, -3],
  [-14, 2, -11, -2, -5, 2, 14, 5],
  [-35, -8, 11, 2, 8, 15, -3, 1],
  [-1, -18, -9, 10, -15, -25, -31, -50],
];

const KING_MG_PST = [
  [-65, 23, 16, -15, -56, -34, 2, 13],
  [29, -1, -20, -7, -8, -4, -38, -29],
  [-9, 24, 2, -16, -20, 6, 22, -22],
  [-17, -20, -12, -27, -30, -25, -14, -36],
  [-49, -1, -27, -39, -46, -44, -33, -51],
  [-14, -14, -22, -46, -44, -30, -15, -27],
  [1, 7, -8, -64, -43, -16, 9, 8],
  [-15, 36, 12, -54, 8, -28, 24, 14],
];

const KING_EG_PST = [
  [-74, -35, -18, -18, -11, 15, 4, -17],
  [-12, 17, 14, 17, 17, 38, 23, 11],
  [10, 17, 23, 15, 20, 45, 44, 13],
  [-8, 22, 24, 27, 26, 33, 26, 3],
  [-18, -4, 21, 24, 27, 23, 9, -11],
  [-19, -3, 11, 21, 23, 16, 7, -9],
  [-27, -11, 4, 13, 14, 4, -5, -17],
  [-53, -34, -21, -11, -28, -14, -24, -43],
];

// Compact Grandmaster Opening Book (keyed by piece placement + turn)
const OPENING_BOOK: Record<string, string[]> = {
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b': ['e7e5', 'c7c5', 'e7e6', 'c7c6'],
  'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b': ['d7d5', 'g8f6', 'e7e6'],
  'rnbqkbnr/pppppppp/8/8/8/5N3/PPPPPPPP/RNBQKB1R b': ['d7d5', 'g8f6', 'c7c5'],
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N3/PPPP1PPP/RNBQKB1R b': ['b8c6', 'g8f6'],
  'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N3/PPPP1PPP/RNBQKB1R w': ['f1c4', 'f1b5', 'd2d4'],
  'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N3/PPPP1PPP/RNBQK2R b': ['f8c5', 'g8f6'],
  'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N3/PPPP1PPP/RNBQK2R b': ['a7a6', 'g8f6'],
  'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w': ['g1f3', 'b1c3', 'c2c3'],
  'rnbqkbnr/pp1ppppp/8/2p5/4P3/5N3/PPPP1PPP/RNBQKB1R b': ['d7d6', 'b8c6', 'e7e6'],
  'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w': ['c2c4', 'g1f3', 'b1c3'],
  'rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b': ['e7e6', 'c7c6', 'd5c4'],
};

function getPieceSquareBonus(
  type: string,
  row: number,
  col: number,
  isEndgame: boolean
): number {
  switch (type) {
    case 'p':
      return isEndgame ? PAWN_EG_PST[row][col] : PAWN_MG_PST[row][col];
    case 'n':
      return KNIGHT_PST[row][col];
    case 'b':
      return BISHOP_PST[row][col];
    case 'r':
      return ROOK_PST[row][col];
    case 'q':
      return QUEEN_PST[row][col];
    case 'k':
      return isEndgame ? KING_EG_PST[row][col] : KING_MG_PST[row][col];
    default:
      return 0;
  }
}

export function evaluateBoard(game: Chess): number {
  if (game.isCheckmate()) {
    return game.turn() === 'w' ? -99999 : 99999;
  }
  if (game.isDraw()) return 0;

  const board = game.board();
  let mgScore = 0;
  let egScore = 0;
  let phase = 0;
  let whiteBishops = 0;
  let blackBishops = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;

      phase += PHASE_WEIGHT[piece.type] || 0;
      const rowIdx = piece.color === 'w' ? r : 7 - r;
      const colIdx = piece.color === 'w' ? c : 7 - c;

      const mgVal =
        (MG_VALUE[piece.type] || 0) +
        getPieceSquareBonus(piece.type, rowIdx, colIdx, false);
      const egVal =
        (EG_VALUE[piece.type] || 0) +
        getPieceSquareBonus(piece.type, rowIdx, colIdx, true);

      if (piece.color === 'w') {
        mgScore += mgVal;
        egScore += egVal;
        if (piece.type === 'b') whiteBishops++;
      } else {
        mgScore -= mgVal;
        egScore -= egVal;
        if (piece.type === 'b') blackBishops++;
      }
    }
  }

  // Bishop pair bonus (inspired by modern engines)
  if (whiteBishops >= 2) {
    mgScore += 30;
    egScore += 45;
  }
  if (blackBishops >= 2) {
    mgScore -= 30;
    egScore -= 45;
  }

  const mgPhase = Math.min(24, phase);
  const egPhase = 24 - mgPhase;
  return Math.round((mgScore * mgPhase + egScore * egPhase) / 24);
}

// MVV-LVA (Most Valuable Victim - Least Valuable Attacker) move ordering
function scoreMoveForOrdering(move: Move): number {
  let score = 0;
  if (move.captured) {
    const victim = MG_VALUE[move.captured] || 100;
    const attacker = MG_VALUE[move.piece] || 100;
    score += 10000 + victim * 10 - attacker;
  }
  if (move.promotion) {
    score += 8000 + (MG_VALUE[move.promotion] || 900);
  }
  if (move.san.includes('+')) {
    score += 400;
  }
  return score;
}

// Quiescence Search: resolves tactical capture chains at leaf nodes so the AI never falls for simple bait!
function quiescence(
  game: Chess,
  alpha: number,
  beta: number,
  maximizingPlayer: boolean,
  qDepth = 3
): number {
  const standPat = evaluateBoard(game);
  if (qDepth <= 0 || game.isGameOver()) {
    return standPat;
  }

  if (maximizingPlayer) {
    if (standPat >= beta) return beta;
    if (alpha < standPat) alpha = standPat;
  } else {
    if (standPat <= alpha) return alpha;
    if (beta > standPat) beta = standPat;
  }

  const captureMoves = game
    .moves({ verbose: true })
    .filter((m) => Boolean(m.captured || m.promotion))
    .sort((a, b) => scoreMoveForOrdering(b) - scoreMoveForOrdering(a));

  if (maximizingPlayer) {
    for (const move of captureMoves) {
      game.move(move);
      const score = quiescence(game, alpha, beta, false, qDepth - 1);
      game.undo();
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  } else {
    for (const move of captureMoves) {
      game.move(move);
      const score = quiescence(game, alpha, beta, true, qDepth - 1);
      game.undo();
      if (score <= alpha) return alpha;
      if (score < beta) beta = score;
    }
    return beta;
  }
}

function minimax(
  game: Chess,
  depth: number,
  alpha: number,
  beta: number,
  maximizingPlayer: boolean,
  deadlineMs: number
): number {
  if (game.isGameOver()) {
    return evaluateBoard(game);
  }
  if (depth <= 0 || Date.now() > deadlineMs) {
    return quiescence(game, alpha, beta, maximizingPlayer, 3);
  }

  const moves = game
    .moves({ verbose: true })
    .sort((a, b) => scoreMoveForOrdering(b) - scoreMoveForOrdering(a));

  if (maximizingPlayer) {
    let maxEval = -Infinity;
    for (const move of moves) {
      game.move(move);
      const evaluation = minimax(
        game,
        depth - 1,
        alpha,
        beta,
        false,
        deadlineMs
      );
      game.undo();
      if (evaluation > maxEval) maxEval = evaluation;
      if (evaluation > alpha) alpha = evaluation;
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      game.move(move);
      const evaluation = minimax(
        game,
        depth - 1,
        alpha,
        beta,
        true,
        deadlineMs
      );
      game.undo();
      if (evaluation < minEval) minEval = evaluation;
      if (evaluation < beta) beta = evaluation;
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

export interface DungeonMoveFilter {
  frozenSquares?: string[];
  shieldedSquares?: string[];
}

export function chooseDungeonAIMove(
  fen: string,
  depth: number,
  randomness: number,
  filter?: DungeonMoveFilter
): Move | null {
  const game = new Chess(fen);
  const allLegalMoves = game.moves({ verbose: true });
  if (allLegalMoves.length === 0) return null;

  // Respect Dungeon Superpowers (frozen pieces & shielded targets) directly inside the AI!
  const frozen = filter?.frozenSquares || [];
  const shielded = filter?.shieldedSquares || [];
  const filteredMoves = allLegalMoves.filter(
    (m) =>
      !frozen.includes(m.from) && !(m.captured && shielded.includes(m.to))
  );
  const moves = filteredMoves.length > 0 ? filteredMoves : allLegalMoves;

  // Beginner-friendly randomness on Level 1
  if (Math.random() < randomness) {
    const captures = moves.filter((m) => m.captured);
    if (captures.length > 0 && Math.random() < 0.5) {
      return captures[Math.floor(Math.random() * captures.length)];
    }
    return moves[Math.floor(Math.random() * moves.length)];
  }

  // Check Opening Book for Master-level opening play when randomness is low
  const fenKey = fen.split(' ').slice(0, 2).join(' ');
  const bookUciList = OPENING_BOOK[fenKey];
  if (bookUciList && randomness < 0.25) {
    const matchingBookMoves = moves.filter((m) =>
      bookUciList.includes(`${m.from}${m.to}`)
    );
    if (matchingBookMoves.length > 0) {
      return matchingBookMoves[
        Math.floor(Math.random() * matchingBookMoves.length)
      ];
    }
  }

  const isMaximizing = game.turn() === 'w';
  let bestMove = moves[0];
  let bestValue = isMaximizing ? -Infinity : Infinity;

  // Sort root moves with MVV-LVA + slight jitter so equally strong moves stay varied
  const orderedMoves = [...moves].sort(
    (a, b) =>
      scoreMoveForOrdering(b) -
      scoreMoveForOrdering(a) +
      (Math.random() * 12 - 6)
  );

  // Strict time budget (220ms) so mobile phones & iPads never lag or drop below 60 FPS!
  const deadlineMs = Date.now() + 220;
  const searchDepth = Math.min(4, Math.max(1, depth));

  for (const move of orderedMoves) {
    game.move(move);
    const boardValue = minimax(
      game,
      searchDepth - 1,
      -Infinity,
      Infinity,
      !isMaximizing,
      deadlineMs
    );
    game.undo();

    if (isMaximizing) {
      if (boardValue > bestValue) {
        bestValue = boardValue;
        bestMove = move;
      }
    } else {
      if (boardValue < bestValue) {
        bestValue = boardValue;
        bestMove = move;
      }
    }
  }

  return bestMove;
}

// Option B: Optional Hybrid Connector to an external CrazyAra REST/Bridge endpoint with automatic instant browser fallback!
export const STORAGE_KEY_CRAZYARA_URL = 'family_dungeon_chess_crazyara_url_v1';

export async function chooseCrazyAraOrBrowserAIMove(
  fen: string,
  depth: number,
  randomness: number,
  filter?: DungeonMoveFilter,
  crazyAraEndpoint?: string
): Promise<{ move: Move | null; source: 'crazyara' | 'browser' }> {
  const game = new Chess(fen);
  const allLegalMoves = game.moves({ verbose: true });
  if (allLegalMoves.length === 0) return { move: null, source: 'browser' };

  const frozen = filter?.frozenSquares || [];
  const shielded = filter?.shieldedSquares || [];
  const validMoves = allLegalMoves.filter(
    (m) =>
      !frozen.includes(m.from) && !(m.captured && shielded.includes(m.to))
  );

  if (crazyAraEndpoint && crazyAraEndpoint.trim().length > 0) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(crazyAraEndpoint.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fen, depth, variant: 'chess' }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        const uci: string = data.bestmove || data.uci || data.move || '';
        if (uci.length >= 4) {
          const from = uci.slice(0, 2);
          const to = uci.slice(2, 4);
          const found = validMoves.find((m) => m.from === from && m.to === to);
          if (found) {
            return { move: found, source: 'crazyara' };
          }
        }
      }
    } catch {
      // Seamless fallback to built-in Browser Engine if CrazyAra server is offline!
    }
  }

  const browserMove = chooseDungeonAIMove(fen, depth, randomness, filter);
  return { move: browserMove, source: 'browser' };
}

export function findHelpfulHintMove(
  fen: string,
  filter?: DungeonMoveFilter
): Move | null {
  return chooseDungeonAIMove(fen, 3, 0, filter);
}
