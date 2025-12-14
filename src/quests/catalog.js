export const QUEST_STATES = {
  NOT_STARTED: "not_started",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
};

// Catalogue principal des quêtes du jeu
export const quests = {
  papi_corbeaux_1: {
    id: "papi_corbeaux_1",
    title: "Chasser les corbeaux",
    giverNpcId: "papi_bucheron",
    description:
      "Papi t'a demandé de débarrasser la zone de quelques corbeaux trop agressifs.",
    stages: [
      {
        id: "hunt_corbeaux",
        npcId: "papi_bucheron",
        description: "Chasser les corbeaux agressifs autour du camp.",
        objective: {
          type: "kill_monster",
          monsterId: "corbeau",
          requiredCount: 5,
          label: "Corbeaux éliminés",
        },
      },
      {
        id: "return_to_papi",
        npcId: "papi_bucheron",
        description: "Informer Papi que la zone est dégagée.",
        objective: {
          type: "talk_to_npc",
          npcId: "papi_bucheron",
          requiredCount: 1,
          label: "Parler à Papi",
        },
      },
    ],
    rewards: {
      xpPlayer: 50,
      gold: 20,
    },
  },

  // Quête en 2 étapes : aller voir Mémé, puis lui apporter du bois.
  papi_meme_1: {
    id: "papi_meme_1",
    title: "Un service pour Mémé",
    giverNpcId: "papi_bucheron",
    // Ne s'active qu'après avoir complété la chasse aux corbeaux.
    requires: ["papi_corbeaux_1"],
    description:
      "Papi t'envoie voir Mémé, puis récolter du bois pour qu'elle t'apprenne à coudre.",
    stages: [
      {
        id: "talk_to_meme",
        npcId: "meme_village",
        description: "Aller parler à Mémé, la femme de Papi.",
        objective: {
          type: "talk_to_npc",
          npcId: "meme_village",
          requiredCount: 1,
          label: "Parler à Mémé",
        },
      },
      {
        id: "bring_wood",
        npcId: "meme_village",
        description: "Récolter 10 bois de chêne et les apporter à Mémé.",
        objective: {
          type: "talk_to_npc",
          npcId: "meme_village",
          requiredCount: 1,
          label: "Apporter 10 bois de chêne",
        },
      },
    ],
    rewards: {
      xpPlayer: 80,
      gold: 40,
    },
  },
};

