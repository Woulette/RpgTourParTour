function startServerTimers({
  mobHandlers,
  tickPlayerRegen,
  tickGroupHpUpdates,
  persistAllPlayers,
  MOB_ROAM_TICK_MS,
  REGEN_TICK_MS,
  GROUP_HP_TICK_MS,
  PERSIST_TICK_MS,
}) {
  const timers = [];
  timers.push(setInterval(() => mobHandlers.tickMobRoam(), MOB_ROAM_TICK_MS));
  timers.push(setInterval(() => tickPlayerRegen(), REGEN_TICK_MS));
  if (typeof tickGroupHpUpdates === "function") {
    timers.push(setInterval(() => tickGroupHpUpdates(), GROUP_HP_TICK_MS));
  }
  timers.push(setInterval(() => persistAllPlayers(), PERSIST_TICK_MS));
  return timers;
}

module.exports = {
  startServerTimers,
};
