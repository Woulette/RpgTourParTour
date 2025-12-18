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
};
