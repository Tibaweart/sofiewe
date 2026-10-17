export type SlotType = "prateleira" | "mesa" | "parede" | "chao" | "vestivel" | "pet";

/**
 * Pontos do loft onde itens podem ser expostos. Os ids batem com os "empties" da cena 3D
 * (mesmo nome no Blender), então o app encaixa cada item sem configuração extra.
 */
export const LOFT_SLOTS: ReadonlyMap<string, SlotType> = new Map([
  ["prateleira-1", "prateleira"],
  ["prateleira-2", "prateleira"],
  ["prateleira-3", "prateleira"],
  ["prateleira-4", "prateleira"],
  ["mesa-1", "mesa"],
  ["mesa-2", "mesa"],
  ["parede-1", "parede"],
  ["parede-2", "parede"],
  ["chao-1", "chao"],
  ["chao-2", "chao"],
  ["vestivel-cabeca", "vestivel"],
  ["vestivel-pes", "vestivel"],
  ["pet", "pet"],
]);

/** Dono na posição 0; visitantes ocupam 1..3 na ordem de chegada. */
export const MAX_GUESTS = 3;
