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
};
