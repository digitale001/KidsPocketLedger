const STORAGE_KEY = "kid-pocket-ledger-v1";

export const defaultCategories = () => [
  { id: "toys", name: "Toys & games", emoji: "🧸", color: "#ec4899" },
  { id: "food", name: "Snacks & treats", emoji: "🍿", color: "#f97316" },
  { id: "books", name: "Books & learning", emoji: "📚", color: "#3b82f6" },
  { id: "outings", name: "Outings & fun", emoji: "🎢", color: "#8b5cf6" },
  { id: "clothes", name: "Clothes", emoji: "👟", color: "#14b8a6" },
  { id: "other", name: "Other", emoji: "✨", color: "#64748b" },
];

export function emptyState() {
  return {
    v: 1,
    kidName: "Explorer",
    currency: "USD",
    currencySymbol: "$",
    parentPin: "",
    savingsBalance: 0,
    categories: defaultCategories(),
    meta: {
      xp: 0,
      totalLogs: 0,
      underBudgetStreak: 0,
      achievements: [],
    },
    months: {},
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    return migrate(parsed);
  } catch {
    return emptyState();
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function migrate(data) {
  const base = emptyState();
  if (!data || typeof data !== "object") return base;
  return {
    ...base,
    ...data,
    categories: Array.isArray(data.categories) && data.categories.length ? data.categories : base.categories,
    meta: { ...base.meta, ...(data.meta || {}) },
    months: typeof data.months === "object" && data.months ? data.months : {},
  };
}

export function formatMonth(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function parseMonth(ym) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

export function monthLabel(ym) {
  const d = parseMonth(ym);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
