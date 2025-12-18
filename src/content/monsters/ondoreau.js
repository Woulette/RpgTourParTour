export default {
  id: "ondoreau",
  label: "Ondoreau",
  textureKey: "ondoreau",
  spritePath: "assets/monsters/corbeau/corbeauWalkSouthWestBlue.png",
  combatAvatarPath: "assets/monsters/corbeau/SpriteCorbeauEau.png",
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
    chance: 5,
  },
  spells: ["bec_ondoyant"],
  loot: [
    { itemId: "plume_corbeau", min: 1, max: 1, dropRate: 0.5 },
    { itemId: "patte_corbeau", min: 1, max: 1, dropRate: 0.5 },
  ],
  xpReward: 20,
  goldRewardMin: 8,
  goldRewardMax: 21,
};
