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
    objective: {
      type: "kill_monster",
      monsterId: "corbeau",
      requiredCount: 5,
      label: "Corbeaux éliminés",
    },
    rewards: {
      xpPlayer: 50,
      gold: 20,
    },
  },
};

