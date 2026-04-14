import { formatMonth, parseMonth } from "./state.js";

/** Debt to apply to `ym` from the most recent settled month before it (skips empty months). */
export function carryFromPreviousSettled(state, ym) {
  const d = parseMonth(ym);
  for (let i = 0; i < 36; i++) {
    d.setMonth(d.getMonth() - 1);
    const key = formatMonth(d);
    const pm = state.months[key];
    if (pm?.settled) {
      return Number(pm.nextCarryoverDebt || 0);
    }
  }
  return 0;
}

export function sumExpenses(month) {
  if (!month?.expenses?.length) return 0;
  return month.expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
}

/** Opening envelope = parent allocation minus debt carried from last month */
export function openingEnvelope(month) {
  const alloc = Number(month?.allocation || 0);
  const debt = Number(month?.carryoverDebt || 0);
  return Math.max(0, alloc - debt);
}

/** What's left after logged spends (can go negative = over) */
export function remaining(month) {
  return openingEnvelope(month) - sumExpenses(month);
}

export function spentPercent(month) {
  const open = openingEnvelope(month);
  if (open <= 0) return 100;
  return Math.min(100, (sumExpenses(month) / open) * 100);
}

export function prevMonthKey(ym) {
  const d = parseMonth(ym);
  d.setMonth(d.getMonth() - 1);
  return formatMonth(d);
}

export function nextMonthKey(ym) {
  const d = parseMonth(ym);
  d.setMonth(d.getMonth() + 1);
  return formatMonth(d);
}

/**
 * Ensure month exists; inherit carryoverDebt from previous settled month if needed.
 */
export function ensureMonth(state, ym) {
  if (!state.months[ym]) {
    const carry = carryFromPreviousSettled(state, ym);
    state.months[ym] = {
      allocation: 0,
      carryoverDebt: carry,
      expenses: [],
      settled: false,
      settledAt: null,
      savingsAdded: 0,
      nextCarryoverDebt: 0,
      settlementNote: "",
    };
  }
  return state.months[ym];
}

/**
 * Close month: surplus → savings; deficit → nextCarryoverDebt on this month record.
 */
export function settleMonth(state, ym) {
  const m = ensureMonth(state, ym);
  if (m.settled) return { ok: false, message: "This month is already settled." };

  const open = openingEnvelope(m);
  const spent = sumExpenses(m);
  const closing = open - spent;

  if (closing >= 0) {
    m.savingsAdded = closing;
    state.savingsBalance = Number(state.savingsBalance || 0) + closing;
    m.nextCarryoverDebt = 0;
    if (closing > 0) {
      state.meta.underBudgetStreak = Number(state.meta.underBudgetStreak || 0) + 1;
    }
  } else {
    m.savingsAdded = 0;
    m.nextCarryoverDebt = Math.abs(closing);
    state.meta.underBudgetStreak = 0;
  }

  m.settled = true;
  m.settledAt = new Date().toISOString();
  return { ok: true, closing, message: closing >= 0 ? "Nice — savings grew!" : "Overspend rolls into next month." };
}

export function addXp(state, amount) {
  state.meta.xp = Number(state.meta.xp || 0) + amount;
  state.meta.totalLogs = Number(state.meta.totalLogs || 0) + 1;
}

const ACH = {
  first_log: { id: "first_log", title: "First quest log", emoji: "🌟" },
  logger_5: { id: "logger_5", title: "5 smart logs", emoji: "📝" },
  saver_star: { id: "saver_star", title: "Savings superstar", emoji: "🏆" },
  streak_2: { id: "streak_2", title: "2 months under budget", emoji: "🔥" },
  level_3: { id: "level_3", title: "Budget hero Lv.3", emoji: "🛡️" },
};

export function grantAchievements(state) {
  const have = new Set(state.meta.achievements || []);
  const grant = (id) => {
    if (!have.has(id)) {
      have.add(id);
      state.meta.achievements = [...have];
      return id;
    }
    return null;
  };
  const newly = [];

  if (state.meta.totalLogs >= 1 && grant(ACH.first_log.id)) newly.push(ACH.first_log);
  if (state.meta.totalLogs >= 5 && grant(ACH.logger_5.id)) newly.push(ACH.logger_5);
  if (Number(state.savingsBalance) >= 25 && grant(ACH.saver_star.id)) newly.push(ACH.saver_star);
  if (Number(state.meta.underBudgetStreak) >= 2 && grant(ACH.streak_2.id)) newly.push(ACH.streak_2);
  const lvl = levelFromXp(state.meta.xp);
  if (lvl >= 3 && grant(ACH.level_3.id)) newly.push(ACH.level_3);

  return newly;
}

export function levelFromXp(xp) {
  const x = Number(xp || 0);
  return Math.floor(x / 100) + 1;
}

export function xpInCurrentLevel(xp) {
  const x = Number(xp || 0);
  return x % 100;
}
