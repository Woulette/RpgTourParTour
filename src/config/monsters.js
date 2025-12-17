// Fiches de monstres (données uniquement)
// Tous les monstres utilisent le même modèle de stats que le joueur.

export const monsters = {
  corbeau: {
    id: "corbeau",
    label: "Corbeau",
    textureKey: "corbeau",                 // clé de texture Phaser
    spritePath: "assets/monsters/corbeau.png", // chemin de l'image
    render: {
      originX: 0.45,
      originY: 1.2,
      offsetY: 0,
    },

    // Overrides de stats par rapport au modèle de base (src/core/stats.js)
    // Ici on laisse volontairement quelque chose de simple.
    statsOverrides: {
      hpMax: 25,
      hp: 25,
      initiative: 5,
      agilite: 5,
    },

    // Liste des sorts que ce monstre peut utiliser en combat
    spells: ["coup_de_bec"],

    // Butin basique de test
    loot: [
      {
        itemId: "plume_corbeau",
        min: 1,
        max: 1,
        dropRate: 0.5, // 100 % de chance pour les tests
      },
      {
        itemId: "patte_corbeau",
        min: 1,
        max: 1,
        dropRate: 0.5,
      },
      // Pièces d'équipement du Corbeau (rares)
      {
        itemId: "coiffe_corbeau",
        min: 1,
        max: 1,
        dropRate: 0.02,
      },
      {
        itemId: "cape_corbeau",
        min: 1,
        max: 1,
        dropRate: 0.02,
      },
      {
        itemId: "amulette_corbeau",
        min: 1,
        max: 1,
        dropRate: 0.02,
      },
      {
        itemId: "ceinture_corbeau",
        min: 1,
        max: 1,
        dropRate: 0.02,
      },
      {
        itemId: "bottes_corbeau",
        min: 1,
        max: 1,
        dropRate: 0.02,
      },
      {
        itemId: "anneau_corbeau",
        min: 1,
        max: 1,
        dropRate: 0.02,
      },
    ],

    xpReward: 20,
    goldRewardMin: 8,
    goldRewardMax: 21,
  },

  aluineeks: {
    id: "aluineeks",
    label: "Aluineeks",
    textureKey: "aluineeks",
    spritePath: "assets/monsters/aluineeks.png",
    render: {
      originX: 0.5,
      originY: 1,
      offsetY: 0,
    },

    // Monstre terre, plus costaud que le corbeau
    statsOverrides: {
      hpMax: 50,
      hp: 50,
      pa: 8,       // 8 PA => 2 fois un sort à 4 PA
      pm: 4,       // 4 PM
      force: 20,   // statistique Terre
      initiative: 4,
    },

    // Il n'a qu'un sort : Fissure
    spells: ["fissure"],

    // Loot à définir plus tard
    loot: [],

    xpReward: 80,
  },


  chibone: {
    id: "chibone",
    label: "Chibone",
    textureKey: "chibone",
    spritePath: "assets/monsters/Chibone/rotations/south-west.png",
    render: {
      originX: 0.55,
      originY: 0.9,
      offsetY: 0,
    },

    statsOverrides: {
      hpMax: 40,
      hp: 40,
      pa: 6,
      pm: 3,
      force: 12,
      agilite: 8,
      initiative: 5,
    },

    spells: ["coup_de_bec"],
    loot: [],
    xpReward: 60,
    goldRewardMin: 10,
    goldRewardMax: 25,
  },

  skelbone: {
    id: "skelbone",
    label: "Skelbone",
    textureKey: "skelbone",
    spritePath: "assets/monsters/Skelbone/rotations/south-west.png",
    render: {
      originX: 0.5,
      originY: 1,
      offsetY: 0,
    },

    statsOverrides: {
      hpMax: 55,
      hp: 55,
      pa: 7,
      pm: 3,
      force: 16,
      initiative: 6,
    },

    spells: ["coup_de_bec"],
    loot: [],
    xpReward: 90,
    goldRewardMin: 15,
    goldRewardMax: 35,
  },

  senbone: {
    id: "senbone",
    label: "Senbone",
    textureKey: "senbone",
    spritePath: "assets/monsters/Senbone/rotations/south-west.png",
    render: {
      originX: 0.5,
      originY: 1,
      offsetY: 0,
    },

    statsOverrides: {
      hpMax: 220,
      hp: 220,
      pa: 10,
      pm: 4,
      force: 30,
      initiative: 10,
    },

    spells: ["fissure"],
    loot: [],
    xpReward: 400,
    goldRewardMin: 60,
    goldRewardMax: 130,
  },
};
