import { registerEffect } from "../core/registry.js";
import { applyDamageEffect } from "./damage.js";
import { applyPushEffect } from "./push.js";
import { applyPullEffect } from "./pull.js";
import { applyAreaBuffEffect } from "./areaBuff.js";
import { applyStatusEffect } from "./status.js";
import { applySummonMonsterEffect } from "./summonMonster.js";
import { applyLifeStealEffect } from "./lifeSteal.js";
import { applyPatternDamageEffect } from "./patternDamage.js";
import { applyPullCasterToMeleeEffect } from "./pullCasterToMelee.js";
import { applyCaptureEffect } from "./capture.js";
import { applySummonCapturedEffect } from "./summonCaptured.js";

export function registerDefaultEffects() {
  registerEffect("damage", applyDamageEffect);
  registerEffect("lifeSteal", applyLifeStealEffect);
  registerEffect("push", applyPushEffect);
  registerEffect("pull", applyPullEffect);
  registerEffect("areaBuff", applyAreaBuffEffect);
  registerEffect("status", applyStatusEffect);
  registerEffect("summonMonster", applySummonMonsterEffect);
  registerEffect("patternDamage", applyPatternDamageEffect);
  registerEffect("pullCasterToMelee", applyPullCasterToMeleeEffect);
  registerEffect("capture", applyCaptureEffect);
  registerEffect("summonCaptured", applySummonCapturedEffect);
}
