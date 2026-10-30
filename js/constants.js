/**
 * Constantes y configuraciones globales de Pain Cave Pro
 */

export const DEFAULT_MAX_HR = 189;

export const RANKS = [
  { max: 2500, title: "Novato" },
  { max: 8000, title: "Principiante" },
  { max: 20000, title: "Intermedio" },
  { max: 45000, title: "Avanzado" },
  { max: 90000, title: "Élite" },
  { max: Infinity, title: "Pro" }
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
  1: "#3b82f6", // Azul (Z1 Recuperación < 113)
  2: "#10b981", // Verde (Z2 Fondo 113-132)
  3: "#eab308", // Amarillo (Z3 Tempo 134-151)
  'SS': "#f59e0b", // Ámbar (Sweet Spot 158-170)
  'ss': "#f59e0b",
  4: "#f97316", // Naranja (Z4 Umbral 153-170)
  5: "#ef4444"  // Rojo (Z5 VO2 Max 172-189)
};
