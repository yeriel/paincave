/**
 * Constantes y configuraciones globales de Pain Cave Pro
 */

export const DEFAULT_MAX_HR = 190;

export const RANKS = [
  { max: 1000, title: "Novato" },
  { max: 3000, title: "Dominguero" },
  { max: 7000, title: "Cicloturista" },
  { max: 15000, title: "Aficionado" },
  { max: 25000, title: "Rodador" },
  { max: 40000, title: "Aguador" },
  { max: 60000, title: "Gregario" },
  { max: 85000, title: "Lanzador" },
  { max: 120000, title: "Cazaetapas" },
  { max: 160000, title: "Clasicómano" },
  { max: 210000, title: "Escalador Puro" },
  { max: 270000, title: "Contrarrelojista" },
  { max: 350000, title: "Capo de Escuadra" },
  { max: 450000, title: "Leyenda del Tour" },
  { max: 550000, title: "Maillot Verde" },
  { max: 700000, title: "Maillot a Lunares" },
  { max: Infinity, title: "Maillot Amarillo" }
];

export const LEVEL_XP_MULTIPLIERS = {
  principiante: 0.10,
  amateur: 0.11,
  elite: 0.12,
  pro: 0.13
};

export const LEVEL_NAMES = {
  principiante: "Principiante",
  amateur: "Amateur",
  elite: "Élite",
  pro: "Pro"
};

export const ZONE_COLORS = {
  1: "#3b82f6", // Azul (Z1 Recuperación)
  2: "#10b981", // Verde (Z2 Fondo)
  3: "#eab308", // Amarillo (Z3 Tempo)
  4: "#f97316", // Naranja (Z4 Umbral)
  5: "#ef4444"  // Rojo (Z5 VO2 Max)
};
