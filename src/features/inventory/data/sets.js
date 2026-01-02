// Définition des bonus de panoplies d'équipement.
// Chaque set possède un id, un label et des paliers de bonus
// en fonction du nombre de pièces équipées.

const corbeauThresholds = (statKey) => ({
  2: { [statKey]: 3 },
  3: { [statKey]: 6, vitalite: 10 },
  4: { [statKey]: 9, vitalite: 15 },
  5: { [statKey]: 12, vitalite: 30, initiative: 10 },
  6: { [statKey]: 20, vitalite: 30, initiative: 30 },
});

const elementalDamageThresholds = (statKey, damageKey) => ({
  2: { [statKey]: 3, [damageKey]: 1 },
  3: { [statKey]: 6, vitalite: 10, [damageKey]: 2 },
  4: { [statKey]: 9, vitalite: 15, [damageKey]: 3 },
  5: { [statKey]: 12, vitalite: 30, initiative: 10, [damageKey]: 4 },
  6: { [statKey]: 20, vitalite: 30, initiative: 30, [damageKey]: 5 },
});

export const equipmentSets = {
  corbeau_air: {
    id: "corbeau_air",
    label: "Panoplie du Corbeau (Air)",
    thresholds: corbeauThresholds("agilite"),
  },
  corbeau_eau: {
    id: "corbeau_eau",
    label: "Panoplie du Corbeau (Eau)",
    thresholds: corbeauThresholds("chance"),
  },
  corbeau_feu: {
    id: "corbeau_feu",
    label: "Panoplie du Corbeau (Feu)",
    thresholds: corbeauThresholds("intelligence"),
  },
  corbeau_terre: {
    id: "corbeau_terre",
    label: "Panoplie du Corbeau (Terre)",
    thresholds: corbeauThresholds("force"),
  },
  gobgob_air: {
    id: "gobgob_air",
    label: "Panoplie du GobGob (Air)",
    thresholds: {
      2: { agilite: 3, dommageAir: 1 },
      3: { agilite: 8, vitalite: 10, dommageAir: 2 },
      4: { agilite: 15, vitalite: 14, dommageAir: 3 },
      5: { agilite: 20, vitalite: 20, initiative: 100, dommageAir: 4 },
      6: { agilite: 30, vitalite: 30, initiative: 150, dommageAir: 7, pa: 1 },
    },
  },
  goush_terre: {
    id: "goush_terre",
    label: "Panoplie du Goush (Terre)",
    thresholds: {
      2: { force: 5, dommageTerre: 1 },
      3: { force: 12, vitalite: 20, dommageTerre: 2 },
      4: { force: 16, vitalite: 38, dommageTerre: 3 },
      5: { force: 20, vitalite: 55, initiative: 10, dommageTerre: 5 },
      6: { force: 28, vitalite: 90, initiative: 30, dommageTerre: 8, pa: 1  },
    },
  },
  liburion_feu: {
    id: "liburion_feu",
    label: "Panoplie du Liburion (Feu)",
    thresholds: {
      2: { intelligence: 10, dommageFeu: 2 },
      3: { intelligence: 15, vitalite: 15, dommageFeu: 2 },
      4: { intelligence: 20, vitalite: 25, dommageFeu: 4 },
      5: { intelligence: 25, vitalite: 30, initiative: 50, dommageFeu: 5 },
      6: { intelligence: 35, vitalite: 50, initiative: 90, dommageFeu: 8, pa: 1 },
    },
  },
};
