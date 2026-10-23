import { Chess, Move } from 'chess.js';

const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// Positional bonus for center control
const PAWN_PST = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5,  5, 10, 25, 25, 10,  5,  5],
  [0,  0,  0, 20, 20,  0,  0,  0],
  [5, -5,-10,  0,  0,-10, -5,  5],
  [5, 10, 10,-20,-20, 10, 10,  5],
  [0,  0,  0,  0,  0,  0,  0,  0]
];

const KNIGHT_PST = [
  [-50,-40,-30,-30,-30,-30,-40,-50],
  [-40,-20,  0,  0,  0,  0,-20,-40],
  [-30,  0, 10, 15, 15, 10,  0,-30],
  [-30,  5, 15, 20, 20, 15,  5,-30],
  [-30,  0, 15, 20, 20, 15,  0,-30],
  [-30,  5, 10, 15, 15, 10,  5,-30],
  [-40,-20,  0,  5,  5,  0,-20,-40],
  [-50,-40,-30,-30,-30,-30,-40,-50],
];

function evaluateBoard(game: Chess): number {
  if (game.isCheckmate()) {
    return game.turn() === 'w' ? -99999 : 99999;
  }
  if (game.isDraw()) return 0;

  const board = game.board();
  let score = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      const base = PIECE_VALUES[piece.type] || 0;
      let positional = 0;
      const rowIdx = piece.color === 'w' ? r : 7 - r;
      if (piece.type === 'p') positional = PAWN_PST[rowIdx][c];
      if (piece.type === 'n' || piece.type === 'b') positional = KNIGHT_PST[rowIdx][c];

      if (piece.color === 'w') {
        score += base + positional;
      } else {
        score -= base + positional;
      }
    }
  }
  return score;
}

function minimax(
  game: Chess,
  depth: number,
  alpha: number,
  beta: number,
  maximizingPlayer: boolean
): number {
  if (depth === 0 || game.isGameOver()) {
    return evaluateBoard(game);
  }

  const moves = game.moves({ verbose: true });
  // Order captures first for faster alpha-beta pruning
  moves.sort((a, b) => (b.captured ? 10 : 0) - (a.captured ? 10 : 0));

  if (maximizingPlayer) {
    let maxEval = -Infinity;
    for (const move of moves) {
      game.move(move);
      const evaluation = minimax(game, depth - 1, alpha, beta, false);
      game.undo();
      maxEval = Math.max(maxEval, evaluation);
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      game.move(move);
      const evaluation = minimax(game, depth - 1, alpha, beta, true);
      game.undo();
      minEval = Math.min(minEval, evaluation);
      beta = Math.min(beta, evaluation);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

export function chooseDungeonAIMove(
  fen: string,
  depth: number,
  randomness: number
): Move | null {
  const game = new Chess(fen);
  const moves = game.moves({ verbose: true });
  if (moves.length === 0) return null;

  // Beginner-friendly randomness on Level 1
  if (Math.random() < randomness) {
    const captures = moves.filter((m) => m.captured);
    if (captures.length > 0 && Math.random() < 0.5) {
      return captures[Math.floor(Math.random() * captures.length)];
    }
    return moves[Math.floor(Math.random() * moves.length)];
  }

  const isMaximizing = game.turn() === 'w';
  let bestMove = moves[0];
  let bestValue = isMaximizing ? -Infinity : Infinity;

  // Shuffle slightly so equal-value moves vary naturally
  const shuffled = [...moves].sort(() => Math.random() - 0.5);

  for (const move of shuffled) {
    game.move(move);
    const boardValue = minimax(
      game,
      Math.max(1, depth - 1),
      -Infinity,
      Infinity,
      !isMaximizing
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

export function findHelpfulHintMove(fen: string): Move | null {
  return chooseDungeonAIMove(fen, 2, 0);
}
