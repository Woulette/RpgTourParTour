export default {
  id: "corbeau",
  label: "Zéphorbeau",
  textureKey: "corbeau",
  // Nouveau sprite corbeau (spritesheet 4 frames).
  // Affiche la frame 0 par défaut (et permettra une anim plus tard).
  spritePath: "assets/monsters/corbeau/corbeauWalkSouthWestGreen.png",
  combatAvatarPath: "assets/monsters/corbeau/SpriteCorbeauAir.png",
  spriteSheet: { frameWidth: 48, frameHeight: 48 },
  render: {
    originX: 0.45,
    originY: 1.2,
    offsetY: 0,
  },
  statsOverrides: {
    hpMax: 25,
    hp: 25,
    initiative: 5,
    agilite: 5,
  },
  spells: ["bec_de_zephyr"],
  loot: [
    { itemId: "plume_corbeau", min: 1, max: 1, dropRate: 0.5 },
    { itemId: "patte_corbeau", min: 1, max: 1, dropRate: 0.5 },
    { itemId: "coiffe_corbeau", min: 1, max: 1, dropRate: 0.02 },
    { itemId: "cape_corbeau", min: 1, max: 1, dropRate: 0.02 },
    { itemId: "amulette_corbeau", min: 1, max: 1, dropRate: 0.02 },
    { itemId: "ceinture_corbeau", min: 1, max: 1, dropRate: 0.02 },
    { itemId: "bottes_corbeau", min: 1, max: 1, dropRate: 0.02 },
    { itemId: "anneau_corbeau", min: 1, max: 1, dropRate: 0.02 },
  ],
  xpReward: 20,
  goldRewardMin: 8,
  goldRewardMax: 21,
};
