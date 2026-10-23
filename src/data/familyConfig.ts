export type PieceRole = 'k' | 'q' | 'r' | 'b' | 'n' | 'p';

export interface SuperpowerConfig {
  id: string;
  name: string;
  icon: string;
  shortDesc: string;
  fullDesc: string;
}

export interface FamilyHeroConfig {
  role: PieceRole;
  chessName: string;
  familyTitle: string;
  customName: string;
  secondaryCustomName?: string; // For the 2nd Cousin skin on Pawns
  dungeonClass: string;
  description: string;
  weapon: string;
  battleCry: string;
  captureQuotes: string[];
  accentColor: string;
  spritePath: string;
  secondarySpritePath?: string; // Alternating 2nd Cousin skin for Pawns
  photoReference?: string;
  customAudioDataUrl?: string; // Recorded real family voice clip (base64 audio)
  superpower: SuperpowerConfig;
}

export interface DungeonLevelConfig {
  id: 1 | 2 | 3;
  name: string;
  subtitle: string;
  bossName: string;
  bossTitle: string;
  difficultyLabel: string;
  aiDepth: number;
  aiRandomness: number;
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

export interface TreasureQuestConfig {
  id: number;
  title: string;
  heroRole: PieceRole;
  story: string;
  startSquare: string;
  treasures: string[]; // Squares containing golden treasure chests / stars
  obstacles: string[]; // Lava / sleeping gargoyle squares to jump over or avoid
  recommendedMoves: number;
}

export const TREASURE_QUESTS: TreasureQuestConfig[] = [
  {
    id: 1,
    title: 'Mission 1: Prinzessin Minis großer L-Sprung',
    heroRole: 'n',
    story:
      'Unsere Tochter hüpft als Wirbelwind-Ritterin im L-Sprung über jedes Hindernis! Sammle alle 3 goldenen Schatztruhen ein!',
    startSquare: 'd4',
    treasures: ['f5', 'e7', 'c6'],
    obstacles: ['d5', 'e4', 'e5', 'd6'],
    recommendedMoves: 3,
  },
  {
    id: 2,
    title: 'Mission 2: Königin Annes Sternen-Magie',
    heroRole: 'q',
    story:
      'Mama gleitet als Erzmagierin gerade und diagonal über das ganze Brett! Sammle alle 4 funkelnden Schatztruhen, ohne auf die roten Lava-Felder zu treten!',
    startSquare: 'd1',
    treasures: ['d7', 'h7', 'e4', 'a4'],
    obstacles: ['d5', 'f6', 'c4'],
    recommendedMoves: 4,
  },
  {
    id: 3,
    title: 'Mission 3: Tante Boss & die Kristall-Diagonale',
    heroRole: 'b',
    story:
      'Mit cooler Sonnenbrille und Saphirstab saust die Tante quer über die Diagonalen. Hol dir alle 3 Truhen!',
    startSquare: 'c1',
    treasures: ['f4', 'c7', 'a5'],
    obstacles: ['d3', 'e5'],
    recommendedMoves: 3,
  },
  {
    id: 4,
    title: 'Mission 4: Cousin Tanks Festungs-Walze',
    heroRole: 'r',
    story:
      'Der Cousin rollt mit seinen Panzerfäusten schnurgerade über die Linien! Räume alle 4 Schatztruhen in den Ecken ab!',
    startSquare: 'a1',
    treasures: ['a8', 'h8', 'h1', 'd1'],
    obstacles: ['d4', 'e4', 'd5', 'e5'],
    recommendedMoves: 4,
  },
  {
    id: 5,
    title: 'Mission 5: König Babas Krönungs-Marsch',
    heroRole: 'k',
    story:
      'Schritt für Schritt führt der Familien-König mit seinem Runenschwert durch das Labyrinth zu den 3 Königskronen-Truhen!',
    startSquare: 'e2',
    treasures: ['d3', 'e4', 'f5'],
    obstacles: ['d4', 'f4', 'e3'],
    recommendedMoves: 3,
  },
];

export const DEFAULT_FAMILY_HEROES: Record<PieceRole, FamilyHeroConfig> = {
  k: {
    role: 'k',
    chessName: 'König',
    familyTitle: 'Der Familien-König (Papa)',
    customName: 'König Baba',
    dungeonClass: 'Paladin des Goldenen Throns',
    description:
      'Mit dunklem Vollbart, goldener Königskrone, rotem Umhang und dem leuchtenden Runenschwert beschützt er die gesamte Familie.',
    weapon: 'Sonnenklinge & Königsschild',
    battleCry: 'Für die Familie! Niemand kommt an meinem Bart vorbei!',
    captureQuotes: [
      'Der König regelt das persönlich! ⚔️👑',
      'Schach-Ehre des Familienoberhaupts!',
      'Platz da, hier kommt das Königsschwert!',
    ],
    accentColor: '#f59e0b',
    spritePath: '/assets/heroes/king.jpg',
    photoReference: '/assets/photos/king_queen.jpg',
    superpower: {
      id: 'royal_shield',
      name: 'Goldener Königsschild',
      icon: '🛡️',
      shortDesc: 'Schützt eine eigene Figur 1 Runde lang',
      fullDesc:
        'Verleiht der ausgewählten Figur einen unzerbrechlichen goldenen Paladin-Schild, sodass sie im nächsten gegnerischen Zug nicht geschlagen werden kann!',
    },
  },
  q: {
    role: 'q',
    chessName: 'Dame',
    familyTitle: 'Die Königin (Mama)',
    customName: 'Königin Anne',
    dungeonClass: 'Erzmagierin des Sternenlichts',
    description:
      'Mit edlem, goldbesticktem Kopftuch und Diadem beherrscht sie alle Linien und Diagonalen mit funkelnder Arkan-Magie.',
    weapon: 'Sternen-Aura & Lichtsphäre',
    battleCry: 'Einer Königin entgeht auf diesem Brett gar nichts!',
    captureQuotes: [
      'Magischer Volltreffer der Königin! ✨👑',
      'Mama sieht jeden Zug drei Schritte voraus!',
      'Mit Licht und Magie vom Feld gefegt!',
    ],
    accentColor: '#c084fc',
    spritePath: '/assets/heroes/queen.jpg',
    photoReference: '/assets/photos/king_queen.jpg',
    superpower: {
      id: 'queen_nova',
      name: 'Sternenlicht-Teleport',
      icon: '✨',
      shortDesc: 'Heilt & schützt König + Dame mit Licht-Aura',
      fullDesc:
        'Hüllt König und Königin in eine leuchtende Sternen-Barriere und schenkt deiner Seite sofort einen Bonus-Tipp für den stärksten Gewinnzug!',
    },
  },
  n: {
    role: 'n',
    chessName: 'Springer',
    familyTitle: 'Unsere Tochter (Heldin)',
    customName: 'Prinzessin Mini',
    dungeonClass: 'Wirbelwind-Ritterin mit zwei Zöpfen',
    description:
      'Mit ihren zwei süßen Zöpfen und dem roten Abenteurer-Cape hüpft sie im L-Sprung furchtlos über jede Mauer und Figur hinweg!',
    weapon: 'Funkelnder Sternen-Degen',
    battleCry: 'Hüpf, hüpf – Überraschung von oben!',
    captureQuotes: [
      'Zack! Über alle drübergehüpft! 🦄⚔️',
      'Zöpfe im Wind – Feld gewonnen!',
      'Kuckuck! Damit hast du nicht gerechnet!',
    ],
    accentColor: '#f43f5e',
    spritePath: '/assets/heroes/knight.jpg',
    photoReference: '/assets/photos/daughter.jpg',
    superpower: {
      id: 'double_hop',
      name: 'Wirbelwind-Doppelzug',
      icon: '🦄',
      shortDesc: 'Darf nach diesem Zug sofort noch einmal ziehen!',
      fullDesc:
        'Wenn Prinzessin Mini aktiviert wird, darf dein Team nach einem normalen Zug (ohne Schachgebot) direkt ein zweites Mal ziehen!',
    },
  },
  b: {
    role: 'b',
    chessName: 'Läufer',
    familyTitle: 'Die Tante (mit cooler Sonnenbrille)',
    customName: 'Tante Boss',
    dungeonClass: 'Runen-Meisterin & Königliche Beraterin',
    description:
      'Selbst im tiefsten Dungeon sitzt die Sonnenbrille perfekt! Mit ihrem blauen Kristallstab blitzt sie quer über die Diagonalen.',
    weapon: 'Saphir-Kristallstab & Coolness-Aura',
    battleCry: 'Zu cool für dieses Gewölbe – aus dem Weg, Schätzchen!',
    captureQuotes: [
      'Mit Sonnenbrille im Dungeon abgeräumt! 😎💎',
      'Diagonal, elegant, unschlagbar!',
      'Die Tante hat den Durchblick!',
    ],
    accentColor: '#38bdf8',
    spritePath: '/assets/heroes/bishop.jpg',
    photoReference: '/assets/photos/family_bench.jpg',
    superpower: {
      id: 'sunglass_freeze',
      name: 'Sonnenbrillen-Blendung',
      icon: '😎',
      shortDesc: 'Friert eine gegnerische Figur für 1 Zug ein',
      fullDesc:
        'Ein cooler Saphir-Blitz aus der Sonnenbrille friert die stärkste bewegliche gegnerische Figur (außer dem König) für 1 Runde komplett im Eis ein!',
    },
  },
  r: {
    role: 'r',
    chessName: 'Turm',
    familyTitle: 'Der Cousin (Festungs-Krieger)',
    customName: 'Cousin Tank',
    dungeonClass: 'Koloss der Steinernen Zitadelle',
    description:
      'Schwer gepanzert mit Zinnen-Krone und Panzerfäusten walzt er jede gerade Linie nieder, sodass die Steine wackeln.',
    weapon: 'Titanen-Panzerfäuste & Erdbeben-Stampfer',
    battleCry: 'Peace-Zeichen war gestern – jetzt rollt die Festung!',
    captureQuotes: [
      'BÄM! Der Cousin räumt die Gerade frei! 🏰💥',
      'Unaufhaltsam wie eine Burgmauer!',
      'Volle Kraft voraus – Turm-Power!',
    ],
    accentColor: '#10b981',
    spritePath: '/assets/heroes/rook.jpg',
    photoReference: '/assets/photos/family_bench.jpg',
    superpower: {
      id: 'fortress_quake',
      name: 'Festungs-Beben',
      icon: '🏰',
      shortDesc: 'Macht beide Türme für 1 Runde unverwundbar',
      fullDesc:
        'Cousin Tank schlägt mit den Panzerfäusten auf den Boden: Ein Steinwall schützt deine Türme für 1 Runde vor jedem Angriff!',
    },
  },
  p: {
    role: 'p',
    chessName: 'Bauer',
    familyTitle: 'Beide Cousinen (Schatten- & Runen-Garde)',
    customName: 'Cousine Dolch',
    secondaryCustomName: 'Cousine Rune',
    dungeonClass: 'Flinke Dungeon-Kundschafterinnen (2 Skins!)',
    description:
      'Beide Cousinen von der Parkbank wechseln sich auf dem Schachbrett ab: 4× als Waldläuferin mit Zwillingsdolchen und 4× im edlen Hahnentritt-Runengewand mit Kopftuch!',
    weapon: 'Zwillings-Runendolche & Arkan-Bogen',
    battleCry: 'Schritt für Schritt gemeinsam bis zur Krone!',
    captureQuotes: [
      'Unterschätze niemals die Cousinen-Garde! 🗡️✨',
      'Doppelte Cousinen-Power schlägt zu!',
      'Auf dem besten Weg zur Königinnen-Krönung!',
    ],
    accentColor: '#eab308',
    spritePath: '/assets/heroes/pawn.jpg',
    secondarySpritePath: '/assets/heroes/pawn2.jpg',
    photoReference: '/assets/photos/family_bench.jpg',
    superpower: {
      id: 'cousin_sprint',
      name: 'Cousinen-Teamgeist',
      icon: '⚡',
      shortDesc: 'Schützt die gesamte vordere Bauern-Reihe',
      fullDesc:
        'Beide Cousinen-Typen halten zusammen und errichten einen leuchtenden Runenschild für das ausgewählte Feld!',
    },
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
