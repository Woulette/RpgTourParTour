import { ensureAlchimisteState } from "./alchimiste/state.js";
import { ensureBucheronState } from "./bucheron/state.js";
import { ensureTailleurState } from "./tailleur/state.js";
import { ensureBijoutierState } from "./bijoutier/state.js";
import { ensureCordonnierState } from "./cordonnier/state.js";

export function ensureAllMetiers(player) {
  if (!player) return;
  ensureAlchimisteState(player);
  ensureBucheronState(player);
  ensureTailleurState(player);
  ensureBijoutierState(player);
  ensureCordonnierState(player);
}
