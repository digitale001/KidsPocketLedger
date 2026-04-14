import {
  loadState,
  saveState,
  emptyState,
  formatMonth,
  monthLabel,
  defaultCategories,
} from "./state.js";
import {
  ensureMonth,
  remaining,
  sumExpenses,
  openingEnvelope,
  spentPercent,
  prevMonthKey,
  nextMonthKey,
  settleMonth,
  addXp,
  grantAchievements,
  levelFromXp,
  xpInCurrentLevel,
} from "./budget.js";

const $app = document.getElementById("app");

let state = loadState();
let role = "kid";
let tab = "home";
let viewingMonth = formatMonth();
let selectedCategory = defaultCategories()[0].id;

function money(n) {
  const sym = state.currencySymbol || "$";
  const v = Number(n || 0);
  return `${sym}${v.toFixed(2)}`;
}

function toast(msg) {
  let el = document.querySelector(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 2400);
}

function uid() {
  return crypto.randomUUID?.() || `e-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function openPinModal(onSuccess) {
  const existing = document.querySelector('[data-modal="pin"]');
  existing?.remove();

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.setAttribute("data-modal", "pin");
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="Parent PIN">
      <h2 style="margin-top:0">Enter parent PIN</h2>
      <div class="field">
        <input type="password" inputmode="numeric" id="pinInput" maxlength="8" autofocus placeholder="••••" />
      </div>
      <button type="button" class="btn btn-primary" data-act="pin-submit">Unlock</button>
      <button type="button" class="btn btn-ghost" data-act="pin-cancel">Cancel</button>
    </div>
  `;
  document.body.appendChild(backdrop);

  const close = () => {
    backdrop.remove();
  };

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  backdrop.querySelector('[data-act="pin-submit"]').addEventListener("click", () => {
    const v = backdrop.querySelector("#pinInput").value.trim();
    if (v === state.parentPin) {
      role = "parent";
      close();
      toast("Parent mode on");
      onSuccess?.();
    } else {
      toast("Try again");
    }
  });
  backdrop.querySelector('[data-act="pin-cancel"]').addEventListener("click", () => close());
}

function render() {
  const m = ensureMonth(state, viewingMonth);
  const rem = remaining(m);
  const pct = spentPercent(m);
  const open = openingEnvelope(m);
  const spent = sumExpenses(m);
  const lvl = levelFromXp(state.meta.xp);
  const xpPct = xpInCurrentLevel(state.meta.xp);

  const progressClass = pct >= 100 ? "danger" : pct >= 85 ? "warn" : "";

  const achievements = [
    { id: "first_log", title: "First quest log", emoji: "🌟" },
    { id: "logger_5", title: "5 smart logs", emoji: "📝" },
    { id: "saver_star", title: "Savings superstar", emoji: "🏆" },
    { id: "streak_2", title: "2 months under budget", emoji: "🔥" },
    { id: "level_3", title: "Budget hero Lv.3", emoji: "🛡️" },
  ];

  const unlocked = new Set(state.meta.achievements || []);

  const canPrev = true;
  const canNext = viewingMonth < formatMonth();

  $app.innerHTML = `
    <header class="topbar">
      <div>
        <h1>Hi, ${escapeHtml(state.kidName)}!</h1>
        <div style="font-size:0.8rem;font-weight:700;color:var(--muted);margin-top:2px;">
          Pocket Ledger · ${role === "parent" ? "Parent" : "Kid"} view
        </div>
      </div>
      <span class="badge-role ${role === "parent" ? "parent" : ""}">${role === "parent" ? "Parent" : "Kid"}</span>
    </header>

    ${
      tab === "home"
        ? `
    <div class="month-nav">
      <button type="button" aria-label="Previous month" data-act="prev-month" ${!canPrev ? "disabled" : ""}>◀</button>
      <span class="month-title">${monthLabel(viewingMonth)}</span>
      <button type="button" aria-label="Next month" data-act="next-month" ${!canNext ? "disabled" : ""}>▶</button>
    </div>

    <section class="card hero ${m.settled ? "" : "celebrate"}" style="animation:none">
      <div class="hero-label">${m.settled ? "Month closed" : "Left to spend this month"}</div>
      <div class="hero-amount" style="color:${rem < 0 ? "var(--bad)" : "var(--text)"};">
        ${m.settled ? (m.savingsAdded > 0 ? "+" + money(m.savingsAdded) : m.nextCarryoverDebt > 0 ? "−" + money(m.nextCarryoverDebt) + " next" : "All set!") : money(rem)}
      </div>
      <div class="hero-sub">
        ${m.settled ? "Open Parent tab to plan the next month." : `Spent ${money(spent)} of ${money(open)} · Savings total ${money(state.savingsBalance)}`}
      </div>
      ${
        !m.settled
          ? `
      <div class="progress-wrap">
        <div class="progress-bar" aria-hidden="true">
          <div class="progress-fill ${progressClass}" style="width:${pct}%;"></div>
        </div>
      </div>
      <div class="xp-row">
        <span>Lv.${lvl}</span>
        <div class="xp-bar"><div class="xp-fill" style="width:${xpPct}%;"></div></div>
        <span>${xpPct}/100 XP</span>
      </div>`
          : ""
      }
    </section>

    <section class="card">
      <h2>🎯 Quick log</h2>
      <p class="hint">Parents buy things for you — log it here like a game quest so everyone sees the story.</p>
      <button type="button" class="btn btn-primary" data-act="open-log">＋ Log a spend</button>
    </section>

    <section class="card">
      <h2>📜 This month</h2>
      ${
        m.expenses.length === 0
          ? `<div class="empty-state">No logs yet. Tap “Log a spend” to earn XP!</div>`
          : `<ul class="expense-list">
        ${m.expenses
          .slice()
          .reverse()
          .map(
            (e) => `
          <li class="expense-item" data-id="${e.id}">
            <span class="expense-emoji">${catEmoji(e.categoryId)}</span>
            <div class="expense-meta">
              <div class="expense-title">${escapeHtml(e.note || catName(e.categoryId))}</div>
              <div class="expense-sub">${catName(e.categoryId)} · ${fmtDate(e.at)}</div>
            </div>
            <span class="expense-amt">−${money(e.amount)}</span>
            ${
              role === "parent"
                ? `<button type="button" class="btn btn-ghost" data-del="${e.id}" aria-label="Delete">✕</button>`
                : ""
            }
          </li>`
          )
          .join("")}
      </ul>`
      }
    </section>
    `
        : ""
    }

    ${
      tab === "quests"
        ? `
    <section class="card">
      <h2>⭐ Quests & badges</h2>
      <p class="hint">Earn XP every time you log a purchase. Level up and unlock badges with your grown-up.</p>
      <div class="stats-grid" style="margin-bottom:1rem;">
        <div class="stat-box"><div class="stat-val">${state.meta.xp || 0}</div><div class="stat-lbl">Total XP</div></div>
        <div class="stat-box"><div class="stat-val">${state.meta.totalLogs || 0}</div><div class="stat-lbl">Logs</div></div>
        <div class="stat-box"><div class="stat-val">${money(state.savingsBalance)}</div><div class="stat-lbl">Savings</div></div>
        <div class="stat-box"><div class="stat-val">${state.meta.underBudgetStreak || 0}</div><div class="stat-lbl">Under-budget streak</div></div>
      </div>
      <div class="achievements">
        ${achievements
          .map(
            (a) => `
          <div class="ach-item ${unlocked.has(a.id) ? "" : "locked"}">
            <span style="font-size:1.35rem">${a.emoji}</span>
            <span>${a.title}${unlocked.has(a.id) ? " ✓" : " — locked"}</span>
          </div>`
          )
          .join("")}
      </div>
    </section>
    `
        : ""
    }

    ${
      tab === "parent"
        ? `
    <section class="card">
      <h2>🛠️ Parent controls</h2>
      <p class="hint">Set the monthly budget, close the month when you’re ready, and move leftover to savings — or roll overspend forward.</p>

      <div class="field">
        <label>Kid display name</label>
        <input type="text" id="kidName" value="${escapeHtml(state.kidName)}" maxlength="24" />
      </div>
      <div class="field">
        <label>Currency symbol</label>
        <input type="text" id="currencySymbol" value="${escapeHtml(state.currencySymbol)}" maxlength="4" />
      </div>

      <div class="field">
        <label>Parent PIN (optional)</label>
        <div class="pin-row">
          <input type="password" inputmode="numeric" pattern="[0-9]*" id="parentPin" placeholder="${state.parentPin ? "New PIN to change" : "empty = kid can open Parent tab"}" maxlength="8" value="" autocomplete="new-password" />
        </div>
        ${state.parentPin ? `<p class="hint" style="margin:0">Leave blank and Save to keep the current PIN.</p>` : ""}
        ${state.parentPin ? `<button type="button" class="btn btn-ghost" data-act="clear-pin" style="margin-top:0.35rem;">Remove PIN</button>` : ""}
      </div>

      <div class="field">
        <label>${monthLabel(viewingMonth)} — monthly budget</label>
        <input type="number" inputmode="decimal" id="allocation" min="0" step="0.01" value="${m.allocation || ""}" />
      </div>

      <p class="hint" style="margin-top:0">
        Carried into this month: <strong>${money(m.carryoverDebt)}</strong> (from last closed month if you went over).<br/>
        Opening envelope: <strong>${money(open)}</strong>.
      </p>

      <div class="row" style="margin-top:0.5rem;">
        <button type="button" class="btn btn-primary" data-act="save-parent">Save settings</button>
      </div>

      <div class="row" style="margin-top:0.75rem;">
        ${
          m.settled
            ? `<p class="hint" style="margin:0;width:100%;">This month is already settled.</p>`
            : `<button type="button" class="btn btn-secondary" data-act="settle">Close month &amp; settle</button>`
        }
      </div>

      <div class="row" style="margin-top:1rem;">
        <button type="button" class="btn btn-secondary" data-act="kid-mode" style="background:rgba(239,68,68,0.12);color:var(--bad);">Switch to Kid view</button>
      </div>
      <div class="row">
        <button type="button" class="btn btn-ghost" data-act="reset" style="color:var(--bad);">Erase all data…</button>
      </div>
    </section>
    `
        : ""
    }

    <nav class="bottom-nav" aria-label="Main">
      <button type="button" data-tab="home" class="${tab === "home" ? "active" : ""}">🏠 Home</button>
      <button type="button" data-tab="quests" class="${tab === "quests" ? "active" : ""}">⭐ Quests</button>
      <button type="button" data-tab="parent" class="${tab === "parent" ? "active" : ""}">🛡️ Parent</button>
    </nav>
  `;

  bind();
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function catEmoji(id) {
  const c = state.categories.find((x) => x.id === id);
  return c?.emoji || "✨";
}

function catName(id) {
  const c = state.categories.find((x) => x.id === id);
  return c?.name || "Other";
}

function fmtDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function renderLogModal() {
  const m = ensureMonth(state, viewingMonth);
  if (m.settled) {
    toast("This month is closed — pick another month or ask a parent.");
    return;
  }
  document.querySelector('[data-modal="log"]')?.remove();

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.setAttribute("data-modal", "log");
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="Log spend">
      <h2 style="margin-top:0">🎮 Log a spend</h2>
      <div class="field">
        <label>How much?</label>
        <input type="number" inputmode="decimal" id="logAmount" min="0" step="0.01" placeholder="0.00" />
      </div>
      <div class="field">
        <label>Category</label>
        <div class="category-chips">
          ${state.categories
            .map(
              (c) => `
            <button type="button" class="chip ${selectedCategory === c.id ? "selected" : ""}" data-cat="${c.id}">
              ${c.emoji} ${escapeHtml(c.name)}
            </button>`
            )
            .join("")}
        </div>
      </div>
      <div class="field">
        <label>Note (optional)</label>
        <input type="text" id="logNote" maxlength="80" placeholder="e.g. LEGO set from Grandma" />
      </div>
      <button type="button" class="btn btn-primary" data-act="log-save">Save + earn XP</button>
      <button type="button" class="btn btn-ghost" data-act="log-close">Not now</button>
    </div>
  `;
  document.body.appendChild(backdrop);
  backdrop.querySelectorAll(".chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedCategory = btn.getAttribute("data-cat");
      backdrop.querySelectorAll(".chip").forEach((b) => b.classList.toggle("selected", b === btn));
    });
  });
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeLog(backdrop);
  });
  backdrop.querySelector('[data-act="log-close"]').addEventListener("click", () => closeLog(backdrop));
  backdrop.querySelector('[data-act="log-save"]').addEventListener("click", () => {
    const amt = Number(backdrop.querySelector("#logAmount").value);
    const note = backdrop.querySelector("#logNote").value.trim();
    if (!amt || amt <= 0) {
      toast("Enter an amount");
      return;
    }
    const month = ensureMonth(state, viewingMonth);
    month.expenses.push({
      id: uid(),
      amount: amt,
      categoryId: selectedCategory,
      note,
      at: new Date().toISOString(),
      loggedBy: role,
    });
    addXp(state, 15);
    const newAch = grantAchievements(state);
    saveState(state);
    closeLog(backdrop);
    toast(newAch.length ? `+15 XP! Unlocked: ${newAch[0].title}` : "+15 XP — nice log!");
    render();
  });
}

function closeLog(backdrop) {
  backdrop.remove();
}

function bind() {
  $app.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const t = btn.getAttribute("data-tab");
      if (t === "parent") {
        if (state.parentPin && role !== "parent") {
          openPinModal(() => {
            tab = "parent";
            render();
          });
          return;
        }
        role = "parent";
      }
      tab = t;
      render();
    });
  });

  $app.querySelectorAll("[data-act='prev-month']").forEach((b) =>
    b.addEventListener("click", () => {
      viewingMonth = prevMonthKey(viewingMonth);
      render();
    })
  );
  $app.querySelectorAll("[data-act='next-month']").forEach((b) =>
    b.addEventListener("click", () => {
      const n = nextMonthKey(viewingMonth);
      if (n <= formatMonth()) viewingMonth = n;
      render();
    })
  );

  $app.querySelectorAll("[data-act='open-log']").forEach((b) =>
    b.addEventListener("click", () => {
      renderLogModal();
    })
  );

  $app.querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", () => {
      const id = b.getAttribute("data-del");
      const m = ensureMonth(state, viewingMonth);
      m.expenses = m.expenses.filter((e) => e.id !== id);
      saveState(state);
      render();
    })
  );

  const saveParent = $app.querySelector('[data-act="save-parent"]');
  if (saveParent) {
    saveParent.addEventListener("click", () => {
      const kidName = $app.querySelector("#kidName")?.value?.trim() || state.kidName;
      const sym = $app.querySelector("#currencySymbol")?.value?.trim() || "$";
      const pinEl = $app.querySelector("#parentPin");
      let pin = state.parentPin;
      if (pinEl) {
        const v = pinEl.value.trim().replace(/\D/g, "").slice(0, 8);
        if (v) pin = v;
      }
      const alloc = Number($app.querySelector("#allocation")?.value);
      state.kidName = kidName.slice(0, 24);
      state.currencySymbol = sym.slice(0, 4);
      state.parentPin = pin;
      const m = ensureMonth(state, viewingMonth);
      if (!Number.isNaN(alloc) && alloc >= 0) m.allocation = alloc;
      saveState(state);
      toast("Saved!");
      render();
    });
  }

  const settleBtn = $app.querySelector('[data-act="settle"]');
  if (settleBtn) {
    settleBtn.addEventListener("click", () => {
      const m = ensureMonth(state, viewingMonth);
      if (!m.allocation || m.allocation <= 0) {
        toast("Set a monthly budget first");
        return;
      }
      const res = settleMonth(state, viewingMonth);
      if (!res.ok) toast(res.message);
      else {
        grantAchievements(state);
        saveState(state);
        toast(res.message);
      }
      render();
    });
  }

  const kidMode = $app.querySelector('[data-act="kid-mode"]');
  if (kidMode) {
    kidMode.addEventListener("click", () => {
      role = "kid";
      tab = "home";
      saveState(state);
      render();
      toast("Kid view");
    });
  }

  const clearPin = $app.querySelector('[data-act="clear-pin"]');
  if (clearPin) {
    clearPin.addEventListener("click", () => {
      state.parentPin = "";
      saveState(state);
      toast("PIN removed");
      render();
    });
  }

  const reset = $app.querySelector('[data-act="reset"]');
  if (reset) {
    reset.addEventListener("click", () => {
      if (confirm("Erase all data on this device?")) {
        state = emptyState();
        viewingMonth = formatMonth();
        role = "kid";
        tab = "home";
        saveState(state);
        render();
        toast("Fresh start");
      }
    });
  }
}

render();
