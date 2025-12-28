import { on as onStoreEvent, getPlayer } from "../../../state/store.js";
import { quests as questDefs, QUEST_STATES } from "../../quests/index.js";
import { claimAchievement, getAchievementProgress } from "../runtime/index.js";
import { achievementDefs, achievementPackDefs } from "../defs/index.js";
import { getItemDef } from "../../inventory/runtime/inventoryCore.js";
import { showToast } from "../../ui/domToasts.js";

let domAchievementsInitialized = false;
let unsubscribeAchievements = null;
let unsubscribeQuests = null;
let unsubscribePlayer = null;

let achievementsUiPlayer = null;
let openAchievementsPanel = null;
let renderAchievementsPanel = null;
let selectAchievementsTarget = null;

const CATEGORY_LABELS = {
  all: "Tout",
  quetes: "Qu\u00eates",
  exploration: "Exploration",
  donjons: "Donjons",
  monstres: "Monstres",
  metiers: "M\u00e9tiers",
  general: "G\u00e9n\u00e9ral",
  autres: "Autres",
};

function questTitle(questId) {
  return questDefs?.[questId]?.title || questId;
}

function isQuestCompleted(player, questId) {
  return player?.quests?.[questId]?.state === QUEST_STATES.COMPLETED;
}

function getAchievementTitle(achievementId) {
  return achievementDefs.find((a) => a.id === achievementId)?.title || achievementId;
}

function getCategoryId(def) {
  return def?.category || "autres";
}

function categoryLabel(categoryId) {
  return CATEGORY_LABELS[categoryId] || categoryId;
}

function renderRewardItems(container, rewards) {
  const items = Array.isArray(rewards?.items) ? rewards.items : [];
  if (items.length === 0) return;

  const wrap = document.createElement("div");
  wrap.className = "achievement-reward-items";

  items.forEach((item) => {
    if (!item || !item.itemId) return;
    const def = getItemDef(item.itemId);
    const label = def?.label || item.itemId;
    const qty = item.qty || 1;

    const entry = document.createElement("div");
    entry.className = "achievement-reward-item";
    entry.title = label;

    if (def?.icon) {
      const img = document.createElement("img");
      img.className = "achievement-reward-icon";
      img.src = def.icon;
      img.alt = label;
      img.loading = "lazy";
      entry.appendChild(img);
    } else {
      const fallback = document.createElement("span");
      fallback.className = "achievement-reward-fallback";
      fallback.textContent = label;
      entry.appendChild(fallback);
    }

    if (qty > 1) {
      const qtyEl = document.createElement("span");
      qtyEl.className = "achievement-reward-qty";
      qtyEl.textContent = `x${qty}`;
      entry.appendChild(qtyEl);
    }

    wrap.appendChild(entry);
  });

  container.appendChild(wrap);
}

function renderRewards(container, rewards) {
  if (!container) return;
  const r = rewards || {};
  container.innerHTML = "";

  const label = document.createElement("span");
  label.className = "achievement-reward-label";
  label.textContent = "Recompense :";
  container.appendChild(label);

  const parts = [];
  if (r.xpPlayer) parts.push(`+${r.xpPlayer} XP`);
  if (r.gold) parts.push(`+${r.gold} or`);
  if (r.honorPoints) parts.push(`+${r.honorPoints} honneur fracturel`);

  if (parts.length > 0) {
    const text = document.createElement("span");
    text.className = "achievement-reward-text";
    text.textContent = parts.join(" \u2022 ");
    container.appendChild(text);
  }

  renderRewardItems(container, r);

  if (parts.length === 0 && (!r.items || r.items.length === 0)) {
    const empty = document.createElement("span");
    empty.className = "achievement-reward-text";
    empty.textContent = "Aucune recompense";
    container.appendChild(empty);
  }
}

function packProgress(player, packDef) {
  const ids = Array.isArray(packDef?.objectiveAchievementIds) ? packDef.objectiveAchievementIds : [];
  const entries = ids.map((id) => getAchievementProgress(player, id)).filter(Boolean);

  const microIds = ids.filter((id) => id !== packDef.rewardAchievementId);
  const microEntries = microIds.map((id) => getAchievementProgress(player, id)).filter(Boolean);
  const microUnlocked = microEntries.reduce((acc, e) => acc + (e.unlocked ? 1 : 0), 0);

  const packReward = packDef?.rewardAchievementId
    ? getAchievementProgress(player, packDef.rewardAchievementId)
    : null;
  const packClaimed = packReward?.claimed === true;
  const packClaimable = packReward?.unlocked === true && packReward?.claimed !== true;

  return {
    packDef,
    entries,
    microUnlocked,
    microTotal: microEntries.length,
    packReward,
    packClaimed,
    packClaimable,
  };
}

function findPackForAchievement(achievementId) {
  return achievementPackDefs.find((p) =>
    Array.isArray(p.objectiveAchievementIds)
      ? p.objectiveAchievementIds.includes(achievementId)
      : false
  );
}

export function openAchievementsTo({ packId, achievementId } = {}) {
  const player = getPlayer() || achievementsUiPlayer;
  if (!player || !openAchievementsPanel || !renderAchievementsPanel) return false;

  let resolvedPackId = packId;
  if (!resolvedPackId && achievementId) {
    const pack = findPackForAchievement(achievementId);
    resolvedPackId = pack?.id || null;
  }

  if (selectAchievementsTarget) {
    selectAchievementsTarget({ packId: resolvedPackId, achievementId });
  }

  openAchievementsPanel();
  renderAchievementsPanel();
  return true;
}

export function initDomAchievements(player) {
  if (domAchievementsInitialized) return;
  if (!player) return;

  const buttonEl = document.getElementById("hud-achievements-button");
  const panelEl = document.getElementById("hud-achievements-panel");

  const categoriesEl = document.getElementById("achievements-categories");
  const packsEl = document.getElementById("achievements-list");
  const honorValueEl = document.getElementById("hud-honor-value");

  const packTitleEl = document.getElementById("achievement-pack-title");
  const packDescEl = document.getElementById("achievement-pack-desc");
  const packObjectivesEl = document.getElementById("achievement-pack-objectives");

  const detailTitleEl = document.getElementById("achievement-detail-title");
  const detailDescEl = document.getElementById("achievement-detail-desc");
  const detailListEl = document.getElementById("achievement-detail-list");
  const detailRewardsEl = document.getElementById("achievement-detail-rewards");
  const claimBtn = document.getElementById("achievement-claim-button");
  const claimStatusEl = document.getElementById("achievement-claim-status");

  if (!buttonEl || !panelEl || !packsEl) return;

  let selectedCategory = "all";
  let selectedPackId = achievementPackDefs[0]?.id || null;
  let selectedObjectiveId = null;
  let unlockedSnapshot = null;

  const getActivePlayer = () => getPlayer() || player;

  function updateHonor() {
    const currentPlayer = getActivePlayer();
    if (!honorValueEl || !currentPlayer) return;
    const value = Number.isFinite(currentPlayer?.honorPoints)
      ? currentPlayer.honorPoints
      : 0;
    honorValueEl.textContent = String(value);
  }

  function closeAllOtherPanels() {
    document.body.classList.remove("hud-inventory-open");
    document.body.classList.remove("hud-quests-open");
    document.body.classList.remove("hud-metiers-open");
    document.body.classList.remove("hud-spells-open");
    document.body.classList.remove("hud-stats-open");
    document.body.classList.remove("hud-map-open");
  }

  function openPanel() {
    closeAllOtherPanels();
    document.body.classList.add("hud-achievements-open");
    updateHonor();
  }

  function togglePanel() {
    const willOpen = !document.body.classList.contains("hud-achievements-open");
    document.body.classList.toggle("hud-achievements-open");
    if (willOpen) openPanel();
  }

  buttonEl.addEventListener("click", (event) => {
    event.stopPropagation();
    togglePanel();
    render();
  });

  function renderDetail(entry) {
    const currentPlayer = getActivePlayer();
    if (!currentPlayer) return;
    if (!detailTitleEl || !detailDescEl || !detailListEl || !detailRewardsEl) return;

    if (!entry) {
      detailTitleEl.textContent = "-";
      detailDescEl.textContent = "";
      detailListEl.innerHTML = "";
      detailRewardsEl.textContent = "";
      if (claimBtn) claimBtn.disabled = true;
      if (claimStatusEl) claimStatusEl.textContent = "";
      return;
    }

    detailTitleEl.textContent = entry.def.title || entry.def.id;
    detailDescEl.textContent = entry.def.description || "";

    const reqs = Array.isArray(entry.def.requirements) ? entry.def.requirements : [];
    detailListEl.innerHTML = "";

    reqs.forEach((req) => {
      const li = document.createElement("li");

      if (req.type === "quest_completed") {
        const done = isQuestCompleted(currentPlayer, req.questId);
        li.textContent = `${done ? "[x]" : "[ ]"} ${questTitle(req.questId)}`;
      } else if (req.type === "quest_stage_index_at_least") {
        const stageIndex = currentPlayer?.quests?.[req.questId]?.stageIndex ?? 0;
        const done = stageIndex >= (req.min ?? 0);
        li.textContent = `${done ? "[x]" : "[ ]"} ${questTitle(req.questId)} (progression)`;
      } else if (req.type === "achievement_unlocked") {
        const progress = getAchievementProgress(currentPlayer, req.achievementId);
        const done = progress?.unlocked === true;
        li.textContent = `${done ? "[x]" : "[ ]"} ${getAchievementTitle(req.achievementId)}`;
      } else {
        li.textContent = `[ ] ${req.type}`;
      }

      detailListEl.appendChild(li);
    });

    renderRewards(detailRewardsEl, entry.def.rewards);

    const canClaim = entry.unlocked && !entry.claimed;
    if (claimBtn) claimBtn.disabled = !canClaim;
    if (claimStatusEl) {
      claimStatusEl.textContent = entry.claimed
        ? "R\u00e9compense d\u00e9j\u00e0 r\u00e9clam\u00e9e."
        : entry.unlocked
          ? "R\u00e9compense disponible."
          : `Progression : ${entry.current}/${entry.required}`;
    }
  }

  function renderCategories(packEntries) {
    if (!categoriesEl) return;

    const byCategory = new Map();
    packEntries.forEach((p) => {
      const cat = getCategoryId(p.packDef);
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat).push(p);
    });

    const categoryIds = ["all", ...Array.from(byCategory.keys()).sort()];
    categoriesEl.innerHTML = "";

    categoryIds.forEach((catId) => {
      const entries = catId === "all" ? packEntries : byCategory.get(catId) || [];
      const total = entries.length;
      const claimed = entries.reduce((acc, e) => acc + (e.packClaimed ? 1 : 0), 0);
      const hasClaimable = entries.some((e) => e.packClaimable);

      const item = document.createElement("div");
      item.className =
        "achievement-category-item" +
        (catId === selectedCategory ? " achievement-category-item-selected" : "");

      const title = document.createElement("div");
      title.className = "achievement-category-title";
      title.textContent = categoryLabel(catId);

      const sub = document.createElement("div");
      sub.className = "achievement-category-sub";

      const left = document.createElement("span");
      left.textContent = total > 0 ? `${claimed}/${total}` : "0/0";

      const right = document.createElement("span");
      right.textContent =
        total === 0 ? "-" : claimed === total ? "R\u00e9clam\u00e9" : hasClaimable ? "Disponible" : "En cours";

      sub.appendChild(left);
      sub.appendChild(right);

      item.appendChild(title);
      item.appendChild(sub);

      item.addEventListener("click", () => {
        selectedCategory = catId;
        render();
      });

      categoriesEl.appendChild(item);
    });
  }

  function renderPacks(packEntries) {
    packsEl.innerHTML = "";

    packEntries.forEach((packEntry) => {
      const packDef = packEntry.packDef;
      const item = document.createElement("div");
      item.className =
        "achievement-item" + (packDef.id === selectedPackId ? " achievement-item-selected" : "");

      const title = document.createElement("div");
      title.className = "achievement-item-title";
      title.textContent = packDef.title || packDef.id;

      const sub = document.createElement("div");
      sub.className = "achievement-item-sub";

      const left = document.createElement("span");
      left.textContent = `${packEntry.microUnlocked}/${packEntry.microTotal}`;

      const right = document.createElement("span");
      right.textContent = packEntry.packClaimed
        ? "R\u00e9clam\u00e9"
        : packEntry.packClaimable
          ? "Disponible"
          : "En cours";

      sub.appendChild(left);
      sub.appendChild(right);

      item.appendChild(title);
      item.appendChild(sub);

      item.addEventListener("click", () => {
        selectedPackId = packDef.id;
        selectedObjectiveId = packDef.rewardAchievementId || packDef.objectiveAchievementIds?.[0] || null;
        render();
      });

      packsEl.appendChild(item);
    });
  }

  function renderPackDetail(packEntry) {
    if (!packTitleEl || !packDescEl || !packObjectivesEl) return;

    if (!packEntry) {
      packTitleEl.textContent = "-";
      packDescEl.textContent = "";
      packObjectivesEl.innerHTML = "";
      renderDetail(null);
      return;
    }

    const packDef = packEntry.packDef;
    packTitleEl.textContent = packDef.title || packDef.id;
    packDescEl.textContent = packDef.description || "";

    packObjectivesEl.innerHTML = "";
    packEntry.entries.forEach((entry) => {
      const li = document.createElement("li");
      const checked = entry.unlocked ? "[x]" : "[ ]";
      li.textContent = `${checked} ${entry.def.title || entry.def.id}`;

      if (entry.def.id === selectedObjectiveId) {
        li.classList.add("achievement-pack-objective-selected");
      }

      li.addEventListener("click", () => {
        selectedObjectiveId = entry.def.id;
        render();
      });

      packObjectivesEl.appendChild(li);
    });

    const selected = packEntry.entries.find((e) => e.def.id === selectedObjectiveId) || null;
    renderDetail(selected);

    if (claimBtn) {
      claimBtn.onclick = () => {
        const currentPlayer = getActivePlayer();
        if (!currentPlayer) return;
        if (!selected) return;
        const result = claimAchievement(currentPlayer, selected.def.id);
        if (!result?.ok && claimStatusEl) {
          claimStatusEl.textContent = "Impossible de r\u00e9clamer pour le moment.";
        }
        render();
      };
    }
  }

  function render() {
    const currentPlayer = getActivePlayer();
    if (!currentPlayer) return;
    achievementsUiPlayer = currentPlayer;
    updateHonor();

    const packEntriesAll = achievementPackDefs.map((p) =>
      packProgress(currentPlayer, p)
    );
    renderCategories(packEntriesAll);

    const packEntriesFiltered =
      selectedCategory === "all"
        ? packEntriesAll
        : packEntriesAll.filter((p) => getCategoryId(p.packDef) === selectedCategory);

    if (!selectedPackId || !packEntriesFiltered.some((p) => p.packDef.id === selectedPackId)) {
      selectedPackId = packEntriesFiltered[0]?.packDef?.id || null;
    }

    const selectedPackEntry = packEntriesFiltered.find((p) => p.packDef.id === selectedPackId) || null;
    if (selectedPackEntry && !selectedObjectiveId) {
      selectedObjectiveId =
        selectedPackEntry.packDef.rewardAchievementId ||
        selectedPackEntry.packDef.objectiveAchievementIds?.[0] ||
        null;
    }

    renderPacks(packEntriesFiltered);
    renderPackDetail(selectedPackEntry);
  }

  // Expose navigation helpers (used by the persistent "claim" icon)
  achievementsUiPlayer = getActivePlayer();
  openAchievementsPanel = () => openPanel();
  renderAchievementsPanel = () => render();
  selectAchievementsTarget = ({ packId, achievementId } = {}) => {
    if (packId) {
      const packDef = achievementPackDefs.find((p) => p.id === packId);
      if (packDef?.category) selectedCategory = packDef.category;
      selectedPackId = packId;
    }

    if (achievementId) {
      selectedObjectiveId = achievementId;
    } else if (selectedPackId) {
      const packDef = achievementPackDefs.find((p) => p.id === selectedPackId);
      selectedObjectiveId =
        packDef?.rewardAchievementId || packDef?.objectiveAchievementIds?.[0] || null;
    }
  };

  unsubscribeAchievements = onStoreEvent("achievements:updated", () => {
    const currentPlayer = getActivePlayer();
    if (!currentPlayer) return;
    // Toasts : on notifie quand un succès devient débloqué mais pas encore réclamé.
    const progress = achievementDefs
      .map((def) => getAchievementProgress(currentPlayer, def.id))
      .filter(Boolean);
    const unlockedNow = new Set(
      progress.filter((p) => p.unlocked && !p.claimed).map((p) => p.def.id)
    );
    if (unlockedSnapshot === null) {
      unlockedSnapshot = unlockedNow;
    } else {
      progress.forEach((p) => {
        if (!p.unlocked || p.claimed) return;
        if (!unlockedSnapshot.has(p.def.id) && unlockedNow.has(p.def.id)) {
          showToast({
            title: "Succ\u00e8s d\u00e9bloqu\u00e9",
            text: `${p.def.title || p.def.id} (r\u00e9compense \u00e0 r\u00e9clamer)`,
          });
        }
      });
      unlockedSnapshot = unlockedNow;
    }

    if (!document.body.classList.contains("hud-achievements-open")) return;
    render();
  });
  unsubscribeQuests = onStoreEvent("quest:updated", () => {
    if (!document.body.classList.contains("hud-achievements-open")) return;
    render();
  });
  unsubscribePlayer = onStoreEvent("player:updated", () => {
    if (!document.body.classList.contains("hud-achievements-open")) return;
    updateHonor();
  });

  domAchievementsInitialized = true;
}

export function teardownDomAchievements() {
  if (unsubscribeAchievements) unsubscribeAchievements();
  if (unsubscribeQuests) unsubscribeQuests();
  if (unsubscribePlayer) unsubscribePlayer();
  unsubscribeAchievements = null;
  unsubscribeQuests = null;
  unsubscribePlayer = null;
  domAchievementsInitialized = false;
}
