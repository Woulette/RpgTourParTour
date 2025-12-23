import { chapitre1Achievements } from "./chapitre1.js";
import { maireAchievements } from "./maire.js";
import { achievementPacks } from "./packs.js";

export const achievementDefs = [...chapitre1Achievements, ...maireAchievements];
export const achievementPackDefs = [...achievementPacks];
