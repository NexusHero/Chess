export type PieceRole = 'k' | 'q' | 'r' | 'b' | 'n' | 'p';

export interface FamilyHeroConfig {
  role: PieceRole;
  chessName: string;
  familyTitle: string;
  customName: string;
  dungeonClass: string;
  description: string;
  weapon: string;
  battleCry: string;
  captureQuotes: string[];
  accentColor: string;
  avatarCrop: {
    col: number; // 0, 1, 2 in 3x2 sheet
    row: number; // 0, 1 in 3x2 sheet
  };
  spritePath: string;
  photoReference?: string;
}

export interface DungeonLevelConfig {
  id: 1 | 2 | 3;
  name: string;
  subtitle: string;
  bossName: string;
  bossTitle: string;
  difficultyLabel: string;
  aiDepth: number;
  aiRandomness: number; // 0 = perfect, 0.6 = beginner friendly
  description: string;
  theme: {
    bgGradient: string;
    fogColor: string;
    ambientColor: string;
    ambientIntensity: number;
    torchColor: string;
    lightTileColor: string;
    darkTileColor: string;
    boardTrimColor: string;
    runeGlowColor: string;
    particleColor: string;
    floorColor: string;
    pillarColor: string;
  };
}

export const DEFAULT_FAMILY_HEROES: Record<PieceRole, FamilyHeroConfig> = {
  k: {
    role: 'k',
    chessName: 'König',
    familyTitle: 'Der Familien-König (Papa)',
    customName: 'König Baba',
    dungeonClass: 'Paladin des Goldenen Throns',
    description: 'Mit dunklem Vollbart, goldener Königskrone, rotem Umhang und dem leuchtenden Runenschwert beschützt er die gesamte Familie.',
    weapon: 'Sonnenklinge & Königsschild',
    battleCry: 'Für die Familie! Niemand kommt an meinem Bart vorbei!',
    captureQuotes: [
      'Der König regelt das persönlich! ⚔️👑',
      'Schach-Ehre des Familienoberhaupts!',
      'Platz da, hier kommt das Königsschwert!'
    ],
    accentColor: '#f59e0b',
    avatarCrop: { col: 0, row: 0 },
    spritePath: '/assets/heroes/king.jpg',
    photoReference: '/assets/photos/king_queen.jpg',
  },
  q: {
    role: 'q',
    chessName: 'Dame',
    familyTitle: 'Die Königin (Mama)',
    customName: 'Königin Anne',
    dungeonClass: 'Erzmagierin des Sternenlichts',
    description: 'Mit edlem, goldbesticktem Kopftuch und Diadem beherrscht sie alle Linien und Diagonalen mit funkelnder Arkan-Magie.',
    weapon: 'Sternen-Aura & Lichtsphäre',
    battleCry: 'Einer Königin entgeht auf diesem Brett gar nichts!',
    captureQuotes: [
      'Magischer Volltreffer der Königin! ✨👑',
      'Mama sieht jeden Zug drei Schritte voraus!',
      'Mit Licht und Magie vom Feld gefegt!'
    ],
    accentColor: '#c084fc',
    avatarCrop: { col: 1, row: 0 },
    spritePath: '/assets/heroes/queen.jpg',
    photoReference: '/assets/photos/king_queen.jpg',
  },
  n: {
    role: 'n',
    chessName: 'Springer',
    familyTitle: 'Unsere Tochter (Heldin)',
    customName: 'Prinzessin Mini',
    dungeonClass: 'Wirbelwind-Ritterin mit zwei Zöpfen',
    description: 'Mit ihren zwei süßen Zöpfen und dem roten Abenteurer-Cape hüpft sie im L-Sprung furchtlos über jede Mauer und Figur hinweg!',
    weapon: 'Funkelnder Sternen-Degen',
    battleCry: 'Hüpf, hüpf – Überraschung von oben!',
    captureQuotes: [
      'Zack! Über alle drübergehüpft! 🦄⚔️',
      'Zöpfe im Wind – Feld gewonnen!',
      'Kuckuck! Damit hast du nicht gerechnet!'
    ],
    accentColor: '#f43f5e',
    avatarCrop: { col: 0, row: 1 },
    spritePath: '/assets/heroes/knight.jpg',
    photoReference: '/assets/photos/daughter.jpg',
  },
  b: {
    role: 'b',
    chessName: 'Läufer',
    familyTitle: 'Die Tante (mit cooler Sonnenbrille)',
    customName: 'Tante Boss',
    dungeonClass: 'Runen-Meisterin & Königliche Beraterin',
    description: 'Selbst im tiefsten Dungeon sitzt die Sonnenbrille perfekt! Mit ihrem blauen Kristallstab blitzt sie quer über die Diagonalen.',
    weapon: 'Saphir-Kristallstab & Coolness-Aura',
    battleCry: 'Zu cool für dieses Gewölbe – aus dem Weg, Schätzchen!',
    captureQuotes: [
      'Mit Sonnenbrille im Dungeon abgeräumt! 😎💎',
      'Diagonal, elegant, unschlagbar!',
      'Die Tante hat den Durchblick!'
    ],
    accentColor: '#38bdf8',
    avatarCrop: { col: 2, row: 0 },
    spritePath: '/assets/heroes/bishop.jpg',
    photoReference: '/assets/photos/family_bench.jpg',
  },
  r: {
    role: 'r',
    chessName: 'Turm',
    familyTitle: 'Der Cousin (Festungs-Krieger)',
    customName: 'Cousin Tank',
    dungeonClass: 'Koloss der Steinernen Zitadelle',
    description: 'Schwer gepanzert mit Zinnen-Krone und Panzerfäusten walzt er jede gerade Linie nieder, sodass die Steine wackeln.',
    weapon: 'Titanen-Panzerfäuste & Erdbeben-Stampfer',
    battleCry: 'Peace-Zeichen war gestern – jetzt rollt die Festung!',
    captureQuotes: [
      'BÄM! Der Cousin räumt die Gerade frei! 🏰💥',
      'Unaufhaltsam wie eine Burgmauer!',
      'Volle Kraft voraus – Turm-Power!'
    ],
    accentColor: '#10b981',
    avatarCrop: { col: 1, row: 1 },
    spritePath: '/assets/heroes/rook.jpg',
    photoReference: '/assets/photos/family_bench.jpg',
  },
  p: {
    role: 'p',
    chessName: 'Bauer',
    familyTitle: 'Die Cousinen (Schatten-Waldläuferinnen)',
    customName: 'Cousine Garde',
    dungeonClass: 'Flinke Dungeon-Kundschafterin',
    description: 'Unsere Cousinen bilden die unerschrockene Vorhut mit Zwillingsdolchen und Runengewand – und am Ende des Bretts werden sie zur Königin gekrönt!',
    weapon: 'Zwillings-Runendolche',
    battleCry: 'Schritt für Schritt bis zur Krone!',
    captureQuotes: [
      'Unterschätze niemals die Cousinen-Garde! 🗡️✨',
      'Schnell, präzise und direkt ins Ziel!',
      'Auf dem besten Weg zur Beförderung!'
    ],
    accentColor: '#eab308',
    avatarCrop: { col: 2, row: 1 },
    spritePath: '/assets/heroes/pawn.jpg',
    photoReference: '/assets/photos/family_bench.jpg',
  },
};

export const DUNGEON_LEVELS: DungeonLevelConfig[] = [
  {
    id: 1,
    name: 'Level 1: Die Königliche Tor-Halle',
    subtitle: 'Warmes Fackellicht & Sandstein-Säulen (Berlin-Hommage)',
    bossName: 'Wächter des Brandenburger Gewölbes',
    bossTitle: 'Freundlicher Trainings-Meister (Einsteiger)',
    difficultyLabel: 'Leicht • Ideal für Kinder & Familien-Einstieg',
    aiDepth: 1,
    aiRandomness: 0.55,
    description:
      'Ein prachtvoller Burghof mit goldenen Fackeln, monumentalen Tempelsäulen und leuchtenden Bodenrunen. Perfekt, um alle Familien-Figuren in Aktion zu erleben!',
    theme: {
      bgGradient: 'radial-gradient(circle at 50% 25%, #2d1e12 0%, #120b07 100%)',
      fogColor: '#1a110a',
      ambientColor: '#fde68a',
      ambientIntensity: 0.85,
      torchColor: '#ff9500',
      lightTileColor: '#d6c3a5',
      darkTileColor: '#4a3828',
      boardTrimColor: '#92622a',
      runeGlowColor: '#fbbf24',
      particleColor: '#fcd34d',
      floorColor: '#1f1610',
      pillarColor: '#78624c',
    },
  },
  {
    id: 2,
    name: 'Level 2: Die Kristall-Katakomben',
    subtitle: 'Schwebende Manakristalle & Mystischer Runennebel',
    bossName: 'Erz-Illusionist der Saphir-Tiefe',
    bossTitle: 'Taktischer Dungeon-Hüter (Fortgeschritten)',
    difficultyLabel: 'Mittel • Für clevere Familien-Strategen',
    aiDepth: 2,
    aiRandomness: 0.22,
    description:
      'Tief unter der Burg leuchten riesige blaue Manakristalle in der Dunkelheit. Die Runen auf dem Schachbrett pulsieren vor arkaner Energie!',
    theme: {
      bgGradient: 'radial-gradient(circle at 50% 25%, #0f2537 0%, #060b16 100%)',
      fogColor: '#091322',
      ambientColor: '#7dd3fc',
      ambientIntensity: 0.75,
      torchColor: '#38bdf8',
      lightTileColor: '#94a3b8',
      darkTileColor: '#1e293b',
      boardTrimColor: '#0284c7',
      runeGlowColor: '#38bdf8',
      particleColor: '#67e8f9',
      floorColor: '#0b1526',
      pillarColor: '#334155',
    },
  },
  {
    id: 3,
    name: 'Level 3: Die Drachen-Schmiede',
    subtitle: 'Glühende Lava-Risse, Funkenregen & Thronsaal',
    bossName: 'Großmeister der Obsidian-Zitadelle',
    bossTitle: 'Legendärer Dungeon-Endboss (Meister)',
    difficultyLabel: 'Schwer • Die ultimative Herausforderung',
    aiDepth: 3,
    aiRandomness: 0.04,
    description:
      'Im Herzen des Vulkans thront das schwarze Obsidian-Schachbrett über glühenden Magma-Strömen. Nur wenn König, Königin, Tochter, Tante & Cousinen zusammenhalten, holt ihr alle 3 Kronen!',
    theme: {
      bgGradient: 'radial-gradient(circle at 50% 25%, #3b0d0d 0%, #0f0406 100%)',
      fogColor: '#180507',
      ambientColor: '#fca5a5',
      ambientIntensity: 0.7,
      torchColor: '#ef4444',
      lightTileColor: '#78716c',
      darkTileColor: '#1c1917',
      boardTrimColor: '#dc2626',
      runeGlowColor: '#f97316',
      particleColor: '#fb7185',
      floorColor: '#170707',
      pillarColor: '#292524',
    },
  },
];
