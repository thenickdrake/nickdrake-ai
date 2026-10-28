/* ============================================================================
 * nickdrake.ai · Personal Second Brain & Executive Assistant
 * Locked behind Supabase Auth + Row-Level Security (tjnvjsjlyjcmrjyyslaa)
 * Apple Human Interface Guidelines Edition:
 *   - Progressive Disclosure (crisp single-line lists, zero text walls)
 *   - Reversible Task / Complete Toggle (with instant Undo)
 *   - Native iOS Swipe Right (Complete/Undo), Swipe Left (Archive), & Long-Press Context Menu
 * ============================================================================ */

const SUPABASE_URL = "https://tjnvjsjlyjcmrjyyslaa.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqbnZqc2pseWpjbXJqeXlzbGFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4NTM1MzYsImV4cCI6MjEwODQyOTUzNn0.jLy1CgR0DtTScfz_hQuqurjwfecbRx3zUfApsi9DTYY";

const ALLOWED_OWNER_EMAILS = [
  "nick.drake@theactionchurch.com",
  "nickdrake0755@gmail.com",
  "nick@drakeweddings.com",
  "nick@actionchurch.com",
  "hello@drakeweddings.com"
];

const sb = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// Reset stale local converted cache once on s33 so Supabase status is authoritative
(function resetStaleLocalConvertedV33() {
  try {
    if (!localStorage.getItem("nd_sync_clean_s33")) {
      localStorage.removeItem("nd_converted_items");
      localStorage.setItem("nd_sync_clean_s33", "1");
    }
  } catch (_) {}
})();
// Clean up any accidental Pastor Tyler local conversion on first load of v2
(function cleanAccidentalPastorTylerToggle() {
  try {
    if (!localStorage.getItem("nd_pt_cleaned_v2")) {
      const conv = JSON.parse(localStorage.getItem("nd_converted_items") || "{}");
      Object.keys(conv).forEach((k) => {
        if (k.includes("pastor-tyler") || k.includes("tyler")) {
          delete conv[k];
        }
      });
      localStorage.setItem("nd_converted_items", JSON.stringify(conv));
      localStorage.setItem("nd_pt_cleaned_v2", "1");
    }
  } catch (_) {}
})();


// ============================================================================
// s42: Authoritative iOS Home Screen Cold-Reopen Viewport & Safe-Area Sync
// ============================================================================
function syncIosStandaloneViewport() {
  try {
    const root = document.documentElement;
    if (!root) return;
    if (window.innerWidth > 760) {
      root.style.removeProperty("--app-vh");
      root.style.removeProperty("--ios-icb-shortfall");
      root.style.removeProperty("--ios-top-spacer");
      root.style.removeProperty("--ios-bottom-safe");
      root.removeAttribute("data-ios-cold-shortfall");
      return;
    }

    const activeEl = document.activeElement;
    const isEditableFocused = Boolean(
      activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.tagName === "SELECT" ||
          activeEl.isContentEditable)
    );
    const innerH = Math.round(window.innerHeight || 0);
    const vvH = window.visualViewport ? Math.round(window.visualViewport.height || innerH) : innerH;
    const isKeyboardOpen = isEditableFocused || (innerH > 0 && vvH > 0 && innerH - vvH > 80);

    // Prevent any document/window scroll drift when keyboard closes or Safari toolbar shifts
    if (!isKeyboardOpen) {
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }
      if (root.scrollTop !== 0) root.scrollTop = 0;
      if (document.body && document.body.scrollTop !== 0) document.body.scrollTop = 0;
    }

    const isStandalone =
      window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);

    const rawScreenH = Math.round((window.screen && window.screen.height) || 0);
    const rawScreenW = Math.round((window.screen && window.screen.width) || 0);
    const isPortrait = (window.innerWidth || 0) <= (innerH || rawScreenH || 9999);
    const screenH = isPortrait
      ? Math.max(rawScreenH, rawScreenW)
      : Math.min(rawScreenH || innerH, rawScreenW || innerH);

    // On iOS 18/26 Home Screen standalone cold reopen in portrait, WebKit initializes
    // the Initial Containing Block (innerHeight / 100dvh / bottom:0) ~60pt shorter than
    // the full 932pt screen canvas (e.g. innerH = 872 while screen.height = 932).
    // Anchor the shell, tabbar, and sheet backdrop to the full screenH and offset bottom by -shortfall.
    const coldReopenShortfall =
      isStandalone && isPortrait && !isKeyboardOpen && screenH >= 780 && innerH > 0
        ? screenH - innerH
        : 0;

    root.style.setProperty(
      "--ios-top-spacer",
      "max(calc(env(safe-area-inset-top, 0px) + 26px), 84px)"
    );

    if (coldReopenShortfall >= 40 && coldReopenShortfall <= 100) {
      const vpMeta = document.querySelector('meta[name="viewport"]');
      if (vpMeta && !vpMeta.dataset.reflowed) {
        vpMeta.dataset.reflowed = "1";
        const orig = vpMeta.getAttribute("content") || "";
        vpMeta.setAttribute("content", orig);
      }
      root.style.setProperty("--app-vh", `${screenH}px`);
      root.style.setProperty("--ios-icb-shortfall", `-${coldReopenShortfall}px`);
      root.style.setProperty("--ios-bottom-safe", "max(env(safe-area-inset-bottom, 0px), 28px)");
      root.setAttribute("data-ios-cold-shortfall", "true");
    } else {
      root.style.setProperty("--app-vh", "100dvh");
      root.style.setProperty("--ios-icb-shortfall", "0px");
      root.style.setProperty(
        "--ios-bottom-safe",
        isStandalone && isPortrait && screenH >= 780
          ? "max(env(safe-area-inset-bottom, 0px), 28px)"
          : "env(safe-area-inset-bottom, 0px)"
      );
      root.removeAttribute("data-ios-cold-shortfall");
    }
  } catch (_) {}
}

syncIosStandaloneViewport();
window.addEventListener("resize", syncIosStandaloneViewport, { passive: true });
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", syncIosStandaloneViewport, { passive: true });
  window.visualViewport.addEventListener("scroll", syncIosStandaloneViewport, { passive: true });
}
document.addEventListener("focusout", () => {
  setTimeout(syncIosStandaloneViewport, 40);
  setTimeout(syncIosStandaloneViewport, 220);
}, { passive: true });
window.addEventListener("orientationchange", () => {
  setTimeout(syncIosStandaloneViewport, 60);
  setTimeout(syncIosStandaloneViewport, 250);
}, { passive: true });
window.addEventListener("pageshow", () => {
  syncIosStandaloneViewport();
  requestAnimationFrame(syncIosStandaloneViewport);
  setTimeout(syncIosStandaloneViewport, 120);
}, { passive: true });
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    syncIosStandaloneViewport();
    requestAnimationFrame(syncIosStandaloneViewport);
    setTimeout(syncIosStandaloneViewport, 120);
  }
});
window.syncIosStandaloneViewport = syncIosStandaloneViewport;

const state = {
  deviceMode: "auto",
  activeTab: "today",
  user: null,
  personLoc: "ALL",
  personMode: "people",
  personSheetTab: "topics",
  projectLoc: "ALL",
  loopType: "open_loop",
  memorySrc: "ALL",
  selectedTodayDate: null,
  activeWeekPage: 0,
  personProfiles: [],
  projectProfiles: [],
  profileItems: [],
  sourceItems: [],
  ingestionRuns: [],
  calendarEvents: [],
  meetingGroups: [],
  discussionItems: [],
  journal: [],
  botRoster: [],
  noteQuery: "",
  convertedIds: JSON.parse(localStorage.getItem("nd_converted_items") || "{}"),
  archivedIds: JSON.parse(localStorage.getItem("nd_archived_items") || "{}"),
  topicOrderMap: JSON.parse(localStorage.getItem("nd_topic_order_v1") || "{}"),
  isOwner: false,
  isHealthViewer: false,
  accessProfile: null,
  briefs: [],
  debriefQuestions: [],
  debriefFilter: "unanswered",
  briefTypeFilter: "ALL",
  selectedBriefId: null,
  healthPayload: null,
  healthLiveRow: null,
  errorAlerts: [],
  noteCat: "ALL",
  sheetStack: [],
  currentSheet: null
};

let _sheetCloseTimer = null;

function syncSegmentedPill(segEl) {
  const el = typeof segEl === "string" ? document.getElementById(segEl) : segEl;
  if (!el) return;
  const activeBtn = el.querySelector(".active");
  if (!activeBtn || activeBtn.offsetWidth === 0) return;
  el.style.setProperty("--seg-x", `${activeBtn.offsetLeft}px`);
  el.style.setProperty("--seg-y", `${activeBtn.offsetTop}px`);
  el.style.setProperty("--seg-w", `${activeBtn.offsetWidth}px`);
  el.style.setProperty("--seg-h", `${activeBtn.offsetHeight}px`);
  el.classList.add("has-sliding-pill");
}
window.syncSegmentedPill = syncSegmentedPill;

function syncAllSegmentedPills() {
  document
    .querySelectorAll(".topbar-mode-seg, .inline-mini-seg, .theme-segmented-control")
    .forEach((el) => syncSegmentedPill(el));
}
window.syncAllSegmentedPills = syncAllSegmentedPills;

function triggerListFadeLift(target) {
  const el = typeof target === "string" ? document.getElementById(target) : target;
  if (!el) return;
  el.classList.remove("ios-filter-fade-lift");
  void el.offsetWidth;
  el.classList.add("ios-filter-fade-lift");
}
window.triggerListFadeLift = triggerListFadeLift;

function updateSheetNavSession(nextSheet, skipPush = false) {
  const backdrop = document.getElementById("sheet-backdrop");
  const backBtn = document.getElementById("btn-sheet-back");
  const isAlreadyOpen = Boolean(
    backdrop && !backdrop.hidden && !backdrop.classList.contains("sheet-closing")
  );
  if (isAlreadyOpen) {
    if (state._isPoppingSheet) {
      state._pendingSheetTransition = "pop";
      state._isPoppingSheet = false;
    } else if (!skipPush && state.currentSheet) {
      const sameSheet =
        state.currentSheet.type === nextSheet.type &&
        state.currentSheet.id === nextSheet.id;
      if (!sameSheet && state.currentSheet.type !== "quick_create" && state.currentSheet.type !== "auth") {
        state.sheetStack.push(state.currentSheet);
        state._pendingSheetTransition = "push";
      } else if (!sameSheet) {
        state._pendingSheetTransition = "swap";
      }
    }
  } else {
    state.sheetStack = [];
    state._pendingSheetTransition = "open";
    state._isPoppingSheet = false;
  }
  state.currentSheet = nextSheet;
  const sheetPanelEl = document.getElementById("sheet-panel");
  if (sheetPanelEl) {
    sheetPanelEl.setAttribute("data-sheet-type", nextSheet?.type || "");
  }
  if (backBtn) {
    if (state.sheetStack.length > 0) {
      const prev = state.sheetStack[state.sheetStack.length - 1];
      backBtn.hidden = false;
      backBtn.textContent = `‹ ${prev.label || "Back"}`;
    } else {
      backBtn.hidden = true;
    }
  }
}

window.presentSheetBackdrop = function (explicitMode = null) {
  const backdrop = document.getElementById("sheet-backdrop");
  if (!backdrop) return;
  if (_sheetCloseTimer) {
    clearTimeout(_sheetCloseTimer);
    _sheetCloseTimer = null;
  }
  const wasClosing = backdrop.classList.contains("sheet-closing");
  backdrop.classList.remove("sheet-closing");
  const wasHidden = backdrop.hidden || wasClosing;
  backdrop.hidden = false;
  document.body.classList.add("has-open-sheet");

  const mode = explicitMode || state._pendingSheetTransition || (wasHidden ? "open" : null);
  state._pendingSheetTransition = null;

  const panel = document.getElementById("sheet-panel");
  const bodyEl = document.getElementById("sheet-body");
  const titlesEl = document.querySelector("#sheet-panel .sheet-header-titles");

  if (bodyEl) {
    bodyEl.classList.remove("sheet-nav-push", "sheet-nav-pop", "sheet-content-swap");
  }
  if (titlesEl) {
    titlesEl.classList.remove("sheet-nav-push", "sheet-nav-pop");
  }

  if (wasHidden || mode === "open") {
    if (panel) {
      panel.style.transform = "";
      panel.classList.remove("sheet-opening");
      void panel.offsetWidth;
      panel.classList.add("sheet-opening");
    }
    if (bodyEl) bodyEl.scrollTop = 0;
  } else if (mode === "push") {
    if (bodyEl) {
      void bodyEl.offsetWidth;
      bodyEl.classList.add("sheet-nav-push");
      bodyEl.scrollTop = 0;
    }
    if (titlesEl) {
      void titlesEl.offsetWidth;
      titlesEl.classList.add("sheet-nav-push");
    }
  } else if (mode === "pop") {
    if (bodyEl) {
      void bodyEl.offsetWidth;
      bodyEl.classList.add("sheet-nav-pop");
      bodyEl.scrollTop = 0;
    }
    if (titlesEl) {
      void titlesEl.offsetWidth;
      titlesEl.classList.add("sheet-nav-pop");
    }
  } else if (mode === "swap") {
    if (bodyEl) {
      void bodyEl.offsetWidth;
      bodyEl.classList.add("sheet-content-swap");
    }
  }
};

window.popSheetHistory = function () {
  if (!state.sheetStack.length) {
    window.closeSheetAndReset();
    return;
  }
  const prev = state.sheetStack.pop();
  state.currentSheet = null;
  state._isPoppingSheet = true;
  if (prev && typeof prev.reopen === "function") {
    prev.reopen(true);
  }
};

window.closeSheetAndReset = function (immediate = false) {
  const backdrop = document.getElementById("sheet-backdrop");
  const panel = document.getElementById("sheet-panel");
  try {
    const activeEl = document.activeElement;
    if (activeEl && panel && panel.contains(activeEl) && typeof activeEl.blur === "function") {
      activeEl.blur();
    }
  } catch (_) {}
  document.body.classList.remove("has-open-sheet");
  syncIosStandaloneViewport();
  setTimeout(syncIosStandaloneViewport, 80);
  state.sheetStack = [];
  state.currentSheet = null;
  state._pendingSheetTransition = null;
  state._isPoppingSheet = false;
  const backBtn = document.getElementById("btn-sheet-back");
  if (backBtn) backBtn.hidden = true;
  if (!backdrop || backdrop.hidden) return;
  if (_sheetCloseTimer) {
    clearTimeout(_sheetCloseTimer);
    _sheetCloseTimer = null;
  }
  if (panel) {
    panel.classList.remove("sheet-opening");
    panel.style.transform = "";
  }
  if (immediate) {
    backdrop.classList.remove("sheet-closing");
    backdrop.hidden = true;
    return;
  }
  backdrop.classList.add("sheet-closing");
  _sheetCloseTimer = setTimeout(() => {
    _sheetCloseTimer = null;
    if (backdrop.classList.contains("sheet-closing")) {
      backdrop.classList.remove("sheet-closing");
      backdrop.hidden = true;
    }
  }, 240);
};

function refreshOpenSheetIfActive() {
  const backdrop = document.getElementById("sheet-backdrop");
  if (!backdrop || backdrop.hidden || !state.currentSheet) return;
  const cur = state.currentSheet;
  if (cur.type && cur.type !== "loop" && cur.type !== "note" && cur.type !== "quick_create" && cur.type !== "auth" && typeof cur.reopen === "function") {
    cur.reopen(true);
  }
}

window._lastSbTab = "today";

/* --- Client-Side Error Telemetry (#3 Efficiency Scout) --- */
const _reportedErrorKeys = new Set();
async function reportClientError(source, message, stack = "", metadata = {}) {
  try {
    if (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost") return;
    const msg = String(message || "").trim();
    if (!msg || _reportedErrorKeys.size >= 12) return;
    const dedupKey = `${source}:${msg.slice(0, 120)}`;
    if (_reportedErrorKeys.has(dedupKey)) return;
    _reportedErrorKeys.add(dedupKey);

    const payload = {
      p_source: String(source || "client"),
      p_severity: "error",
      p_message: msg.slice(0, 1800),
      p_stack: String(stack || "").slice(0, 3500),
      p_url: window.location.href,
      p_user_agent: navigator.userAgent || "",
      p_metadata: metadata || {}
    };

    if (sb) {
      await sb.rpc("log_app_error_alert", payload);
    } else {
      await fetch("/api/error-telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    }
  } catch (_) {}
}

window.addEventListener("error", (ev) => {
  const msg = ev?.message || ev?.error?.message || "Window runtime error";
  const stack = ev?.error?.stack || `${ev?.filename || ""}:${ev?.lineno || 0}:${ev?.colno || 0}`;
  reportClientError("window.onerror", msg, stack, {
    filename: ev?.filename || "",
    lineno: ev?.lineno || 0
  });
});

window.addEventListener("unhandledrejection", (ev) => {
  const reason = ev?.reason;
  const msg = reason?.message || String(reason || "Unhandled promise rejection");
  const stack = reason?.stack || "";
  reportClientError("unhandledrejection", msg, stack, {});
});

function isHealthUrlRoute() {
  const path = (window.location.pathname || "").toLowerCase();
  const params = new URLSearchParams(window.location.search || "");
  const hash = (window.location.hash || "").toLowerCase();
  return (
    path === "/health" ||
    path.startsWith("/health/") ||
    params.get("view") === "health" ||
    params.get("tab") === "health" ||
    hash === "#health"
  );
}

function configureAuthGateForRoute() {
  const onHealth = isHealthUrlRoute();
  const titleEl = document.getElementById("auth-gate-title");
  const subEl = document.getElementById("auth-gate-subtitle");
  const emailLabel = document.getElementById("auth-email-label");
  const emailInput = document.getElementById("auth-email");
  const pwLabel = document.getElementById("auth-password-label");
  const pwInput = document.getElementById("auth-password");
  const savedEmail = localStorage.getItem("nd_last_email");
  if (emailInput && savedEmail) {
    emailInput.value = savedEmail;
  }
  if (onHealth) {
    if (titleEl) titleEl.textContent = "Action Church";
    if (subEl) subEl.textContent = "Health & Engagement Dashboard";
    if (emailLabel) emailLabel.textContent = "Authorized Email";
    if (emailInput && emailInput.value === "nick.drake@theactionchurch.com" && !savedEmail) {
      emailInput.value = "";
      emailInput.placeholder = "you@theactionchurch.com";
    }
    if (pwLabel) pwLabel.textContent = "Passcode / Password";
    if (pwInput) pwInput.placeholder = "Enter shared passcode or password";
  } else {
    if (titleEl) titleEl.textContent = "nickdrake.ai";
    if (subEl) subEl.textContent = "Personal Second Brain";
    if (emailLabel) emailLabel.textContent = "Authorized Email";
    if (pwLabel) pwLabel.textContent = "Password / Shared Passcode";
  }
}


function esc(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isAiBotProfile(p) {
  if (!p) return false;
  return (
    /^AI\b/i.test(p.role_title || "") ||
    /\bAI\b|\bBot\b/i.test(p.full_name || "") ||
    ["ara-chief-of-staff", "grace-health-director", "chloe-assimilation-care"].includes(p.slug)
  );
}

function initials(name) {
  if (!name) return "•";
  const cleaned = String(name)
    .replace(/\([^)]*\)/g, "")
    .replace(/Pastor\s+/i, "")
    .trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (!parts.length) return "•";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function fmtShortET(isoStr) {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return String(isoStr).slice(0, 10);
    return d.toLocaleString("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric"
    });
  } catch (_) {
    return String(isoStr);
  }
}

function stripPastorPrefix(name) {
  return String(name || "").replace(/^Pastor\s+/i, "").trim();
}

function prettySlug(slug) {
  if (!slug) return "";
  const p = state.personProfiles.find((x) => x.slug === slug);
  if (p) return stripPastorPrefix(p.full_name);
  const pr = state.projectProfiles.find((x) => x.slug === slug);
  if (pr) return pr.name;
  return String(slug)
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function isAllowedOwner(user) {
  if (!user || !user.email) return false;
  return ALLOWED_OWNER_EMAILS.includes(String(user.email).trim().toLowerCase());
}

/* --- Automatic Phone vs. Computer Viewport Detection --- */
function applyDeviceMode() {
  const shell = document.getElementById("app-shell");
  if (!shell) return;
  const isPhone =
    window.innerWidth <= 760 ||
    /iPhone|iPod|Android.*Mobile/i.test(navigator.userAgent || "");
  shell.setAttribute("data-device", isPhone ? "iphone" : "mac");
  const isStandalone =
    window.navigator?.standalone === true ||
    window.matchMedia?.("(display-mode: standalone)")?.matches === true;
  if (isStandalone) {
    document.documentElement.setAttribute("data-standalone", "true");
    shell.setAttribute("data-standalone", "true");
  }
}

/* --- Tab Switching (Seamless Second Brain <-> /health) --- */
const TAB_ORDER_MAP = {
  today: 0,
  people: 1,
  loops: 2,
  projects: 3,
  notes: 4,
  briefs: 5,
  memory: 6,
  health: 7
};

window._tabScrollPositions = window._tabScrollPositions || {};

function switchTab(tab, pushHistory = true) {
  if (state.user && !state.isOwner && state.isHealthViewer) {
    tab = "health";
  }
  const prevTab = state.activeTab || "today";
  const tabChanged = prevTab !== tab;
  const stage = document.getElementById("main-stage");
  const targetSec = document.getElementById("view-" + tab);

  if (!tabChanged && targetSec && !targetSec.hidden && stage && document.body.getAttribute("data-active-tab") === tab) {
    window._tabScrollPositions[tab] = 0;
    try {
      stage.scrollTo({ top: 0, behavior: "smooth" });
    } catch (_) {}
    stage.scrollTop = 0;
    document.querySelectorAll(".side-nav-btn, .ios-tab").forEach((btn) => {
      if (btn.getAttribute("data-tab") === tab) {
        btn.classList.remove("tab-pop");
        void btn.offsetWidth;
        btn.classList.add("tab-pop");
      }
    });
    return;
  }

  if (tabChanged && stage) {
    window._tabScrollPositions[prevTab] = stage.scrollTop || 0;
  }

  const navDir = (TAB_ORDER_MAP[tab] ?? 0) >= (TAB_ORDER_MAP[prevTab] ?? 0) ? "forward" : "back";

  if (tab !== "health") {
    window._lastSbTab = tab;
  }
  state.activeTab = tab;
  document.body.setAttribute("data-active-tab", tab);

  ["today", "briefs", "people", "projects", "loops", "memory", "health", "notes"].forEach((t) => {
    const sec = document.getElementById("view-" + t);
    if (!sec) return;
    const isTarget = t === tab;
    sec.hidden = !isTarget;
    if (isTarget) {
      sec.setAttribute("data-nav-dir", navDir);
      sec.classList.remove("view-entering");
      void sec.offsetWidth;
      sec.classList.add("view-entering");
    } else {
      sec.classList.remove("view-entering");
    }
  });
  if (tab === "notes") renderNotesView();

  document.querySelectorAll(".side-nav-btn, .ios-tab").forEach((btn) => {
    const isMatch = btn.getAttribute("data-tab") === tab;
    btn.classList.toggle("active", isMatch);
    if (isMatch && tabChanged) {
      btn.classList.remove("tab-pop");
      void btn.offsetWidth;
      btn.classList.add("tab-pop");
    } else if (!isMatch) {
      btn.classList.remove("tab-pop");
    }
  });

  const btnModeSb = document.getElementById("btn-mode-sb");
  const btnModeHealth = document.getElementById("btn-mode-health");
  if (btnModeSb && btnModeHealth) {
    const wasHealth = prevTab === "health";
    const isHealth = tab === "health";
    btnModeSb.classList.toggle("active", !isHealth);
    btnModeHealth.classList.toggle("active", isHealth);
    syncSegmentedPill(document.getElementById("topbar-mode-seg"));
    if (tabChanged && wasHealth !== isHealth) {
      const targetModeBtn = isHealth ? btnModeHealth : btnModeSb;
      targetModeBtn.classList.remove("tab-pop");
      void targetModeBtn.offsetWidth;
      targetModeBtn.classList.add("tab-pop");
    }
  }

  const brandTitle = document.getElementById("topbar-brand-title");
  const brandSub = document.getElementById("sync-status-sub");
  const accessTopBtn = document.getElementById("btn-health-access-top");

  if (tab === "health") {
    if (brandTitle) brandTitle.textContent = state.isOwner ? "nickdrake.ai" : "Action Church";
    if (brandSub) brandSub.textContent = "Health & Engagement Dashboard";
    if (accessTopBtn) accessTopBtn.hidden = !state.isOwner;
    loadAndRenderHealthDashboard();
  } else {
    if (brandTitle) brandTitle.textContent = "nickdrake.ai";
    if (brandSub) brandSub.textContent = "Personal Second Brain";
    if (accessTopBtn) accessTopBtn.hidden = true;
  }

  if (pushHistory && window.history && window.history.pushState) {
    const targetPath = tab === "health" ? "/health" : "/";
    if (window.location.pathname !== targetPath && !window.location.search.includes("token")) {
      window.history.pushState({ tab }, "", targetPath);
    }
  }

  if (stage) {
    stage.scrollTop = window._tabScrollPositions[tab] || 0;
  }
}
window.switchTab = switchTab;

window.addEventListener("popstate", () => {
  if (!state.user) {
    configureAuthGateForRoute();
    return;
  }
  if (isHealthUrlRoute()) {
    switchTab("health", false);
  } else if (state.isOwner) {
    switchTab(window._lastSbTab || "today", false);
  }
});


/* --- Auth Gate Status Helper & Item Helpers --- */
function setAuthStatus(msg, kind = "") {
  const el = document.getElementById("auth-status-msg");
  if (!el) return;
  if (!msg) {
    el.hidden = true;
    el.textContent = "";
    el.className = "auth-status-msg";
    return;
  }
  el.hidden = false;
  el.textContent = msg;
  el.className = "auth-status-msg" + (kind ? " " + kind : "");
}

function isItemConverted(item) {
  if (!item) return false;
  if (state.convertedIds && state.convertedIds[item.id] === false) return false;
  return (
    item.status === "converted_to_task" ||
    item.status === "converted" ||
    item.status === "completed" ||
    item.status === "done" ||
    Boolean(item.linked_task_id) ||
    Boolean(state.convertedIds && state.convertedIds[item.id])
  );
}

function isItemArchived(item) {
  if (!item) return false;
  return (
    item.status === "dismissed" ||
    item.status === "archived" ||
    Boolean(state.archivedIds && state.archivedIds[item.id])
  );
}

let undoTimer = null;
let currentUndoFn = null;

function showUndoToast(message, undoCallback) {
  const toast = document.getElementById("ios-undo-toast");
  if (toast) toast.hidden = true;
}


const BOOT_CACHE_KEY = "nd_boot_snapshot_v1";

function dismissBootSplash() {
  const sp = document.getElementById("app-boot-splash");
  if (!sp || sp.classList.contains("boot-splash-hidden")) return;
  sp.classList.add("boot-splash-hidden");
  setTimeout(() => {
    try { sp.hidden = true; } catch (_) {}
  }, 220);
}
window.dismissBootSplash = dismissBootSplash;

function saveBootSnapshot() {
  try {
    const snap = {
      ts: Date.now(),
      calendarEvents: (state.calendarEvents || []).slice(0, 120),
      meetingGroups: (state.meetingGroups || []).slice(0, 40),
      discussionItems: (state.discussionItems || []).slice(0, 150),
      personProfiles: (state.personProfiles || []).slice(0, 60),
      projectProfiles: (state.projectProfiles || []).slice(0, 30),
      profileItems: (state.profileItems || []).slice(0, 200),
      journal: (state.journal || []).slice(0, 60)
    };
    localStorage.setItem(BOOT_CACHE_KEY, JSON.stringify(snap));
  } catch (_) {}
}

function hydrateBootSnapshot() {
  try {
    const raw = localStorage.getItem(BOOT_CACHE_KEY);
    if (!raw) return false;
    const snap = JSON.parse(raw);
    if (!snap || typeof snap !== "object") return false;
    if (Array.isArray(snap.calendarEvents)) state.calendarEvents = snap.calendarEvents;
    if (Array.isArray(snap.meetingGroups)) state.meetingGroups = snap.meetingGroups;
    if (Array.isArray(snap.discussionItems)) state.discussionItems = snap.discussionItems;
    if (Array.isArray(snap.personProfiles)) state.personProfiles = snap.personProfiles;
    if (Array.isArray(snap.projectProfiles)) state.projectProfiles = snap.projectProfiles;
    if (Array.isArray(snap.profileItems)) state.profileItems = snap.profileItems;
    if (Array.isArray(snap.journal)) state.journal = snap.journal;
    return true;
  } catch (_) {
    return false;
  }
}

/* --- Auth State & Live Supabase Data Sync --- */
async function handleSessionChange(session) {
  const gate = document.getElementById("auth-gate");
  const shell = document.getElementById("app-shell");
  const form = document.getElementById("auth-login-form");
  const restrictedBox = document.getElementById("auth-restricted-box");
  const restrictedSub = document.getElementById("auth-restricted-sub");
  const ownerSwitcher = document.getElementById("owner-mode-switcher");
  const sidebar = document.getElementById("mac-sidebar");
  const tabbar = document.getElementById("ios-tabbar");

  const user = session?.user || null;
  state.user = user;

  if (!user) {
    state.isOwner = false;
    state.isHealthViewer = false;
    state.accessProfile = null;
    state.personProfiles = [];
    state.projectProfiles = [];
    state.profileItems = [];
    state.sourceItems = [];
    state.ingestionRuns = [];
    state.briefs = [];
    state.debriefQuestions = [];
    document.documentElement.removeAttribute("data-has-saved-auth");
    document.body.removeAttribute("data-access-role");
    configureAuthGateForRoute();
    if (shell) shell.hidden = true;
    if (gate) gate.hidden = false;
    if (form) form.hidden = false;
    if (restrictedBox) restrictedBox.hidden = true;
    dismissBootSplash();
    return;
  }

  localStorage.setItem("nd_last_email", user.email || "");

  const ownerFastPath = isAllowedOwner(user);
  let profile = {
    is_owner: ownerFastPath,
    is_health_viewer: ownerFastPath,
    access_level: ownerFastPath ? "owner" : "none",
    full_name: ownerFastPath ? "Nick Drake" : (user.email || "").split("@")[0],
    display_name: ownerFastPath ? "Nick Drake" : (user.email || "").split("@")[0]
  };
  if (!ownerFastPath) {
    try {
      const { data: rpcProfile } = await sb.rpc("get_my_access_profile");
      if (rpcProfile && typeof rpcProfile === "object") {
        profile = {
          ...profile,
          ...rpcProfile,
          is_owner: Boolean(rpcProfile.is_owner || isAllowedOwner(user)),
          is_health_viewer: Boolean(rpcProfile.is_health_viewer || rpcProfile.is_owner || isAllowedOwner(user))
        };
      }
    } catch (_) {}
  }

  state.accessProfile = profile;
  state.isOwner = Boolean(profile.is_owner);
  state.isHealthViewer = Boolean(profile.is_health_viewer);

  if (!state.isOwner && !state.isHealthViewer) {
    state.personProfiles = [];
    state.projectProfiles = [];
    state.profileItems = [];
    state.sourceItems = [];
    state.ingestionRuns = [];
    state.briefs = [];
    state.debriefQuestions = [];
    if (shell) shell.hidden = true;
    if (gate) gate.hidden = false;
    if (form) form.hidden = true;
    if (restrictedBox) restrictedBox.hidden = false;
    if (restrictedSub) {
      restrictedSub.textContent = `Signed in as ${user.email}. This account is not on the authorized access list.`;
    }
    setAuthStatus("", "");
    dismissBootSplash();
    return;
  }

  if (gate) gate.hidden = true;
  if (shell) shell.hidden = false;
  requestAnimationFrame(() => {
    if (typeof window.syncAllSegmentedPills === "function") window.syncAllSegmentedPills();
  });
  setAuthStatus("", "");

  const topbarModeSeg = document.getElementById("topbar-mode-seg");
  // CASE A: Invited Health Viewer (NOT Owner) -> strictly locked to /health, ZERO Second Brain access
  if (!state.isOwner && state.isHealthViewer) {
    document.body.setAttribute("data-access-role", "health_viewer");
    if (ownerSwitcher) ownerSwitcher.hidden = true;
    if (topbarModeSeg) topbarModeSeg.hidden = true;
    if (sidebar) sidebar.hidden = true;
    if (tabbar) tabbar.hidden = true;
    const label = document.getElementById("auth-pill-label");
    if (label) label.textContent = profile.full_name || user.email || "Viewer";
    switchTab("health", true);
    dismissBootSplash();
    return;
  }

  // CASE B: Owner / Full Access (Nick or Parker) -> full Second Brain + seamless /health switching without re-entering password
  document.body.setAttribute("data-access-role", "owner");
  if (ownerSwitcher) ownerSwitcher.hidden = false;
  if (topbarModeSeg) topbarModeSeg.hidden = false;
  if (sidebar) sidebar.hidden = false;
  if (tabbar) tabbar.hidden = false;
  const ownerPillLabel = document.getElementById("auth-pill-label");
  if (ownerPillLabel) {
    ownerPillLabel.textContent = ownerFastPath
      ? "Nick Drake"
      : (profile.display_name || profile.full_name || "Nick Drake");
  }

  prefetchPasskeyRegisterOptions();
  const initialTab = isHealthUrlRoute() ? "health" : (state.activeTab || "today");
  if (state.calendarEvents.length > 0 || state.profileItems.length > 0) {
    updateDynamicCounts();
    renderAll();
    dismissBootSplash();
  }
  switchTab(initialTab, false);
  await syncFromSupabase();
  dismissBootSplash();
}

async function syncFromSupabase() {
  if (!sb || !state.user || !state.isOwner) return;
  const label = document.getElementById("auth-pill-label");
  if (label) {
    label.textContent = isAllowedOwner(state.user)
      ? "Nick Drake"
      : (state.accessProfile?.display_name || state.accessProfile?.full_name || "Nick Drake");
  }

  try {
    const todayET = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    const [pRes, prRes, itemRes, srcRes, runRes, briefsRes, debriefRes, errRes, calRes, mgRes, diRes, jRes, botRes] = await Promise.all([
      sb.from("sb_person_profiles").select("*").order("interaction_count", { ascending: false }),
      sb.from("sb_project_profiles").select("*").order("interaction_count", { ascending: false }),
      sb.from("sb_profile_items").select("*").order("occurred_at", { ascending: false }),
      sb.from("sb_source_items").select("*").order("occurred_at", { ascending: false }),
      sb.from("sb_ingestion_runs").select("*").order("started_at", { ascending: true }),
      sb.from("briefs").select("*").order("brief_date", { ascending: false }).limit(25),
      sb.from("debrief_questions_log").select("*").order("asked_date", { ascending: false }).order("question_id", { ascending: true }),
      sb.from("app_error_alerts").select("*").eq("resolved", false).order("occurred_at", { ascending: false }).limit(20),
      sb.from("sb_calendar_events").select("*").gte("event_date", todayET).order("start_at", { ascending: true }).limit(200),
      sb.from("sb_meeting_groups").select("*").order("sort_order", { ascending: true }),
      sb.from("sb_meeting_discussion_items").select("*").order("sort_order", { ascending: true }),
      sb.from("journal").select("*").order("created_at", { ascending: false }).limit(300),
      sb.from("bot_team_roster").select("*")
    ]);
    const arr = (r) => (Array.isArray(r?.data) ? r.data : []);
    state.calendarEvents = arr(calRes);
    state.meetingGroups = arr(mgRes);
    state.discussionItems = arr(diRes);
    state.journal = arr(jRes);
    state.botRoster = arr(botRes);

    state.personProfiles = Array.isArray(pRes.data) ? pRes.data : [];
    state.projectProfiles = Array.isArray(prRes.data) ? prRes.data : [];
    state.profileItems = Array.isArray(itemRes.data) ? itemRes.data : [];
    state.sourceItems = Array.isArray(srcRes.data) ? srcRes.data : [];
    state.ingestionRuns = Array.isArray(runRes.data) ? runRes.data : [];
    state.briefs = Array.isArray(briefsRes.data) ? briefsRes.data : [];
    state.debriefQuestions = Array.isArray(debriefRes.data) ? debriefRes.data : [];
    state.errorAlerts = Array.isArray(errRes.data) ? errRes.data : [];

    if (!state.selectedBriefId && state.briefs.length > 0) {
      state.selectedBriefId = state.briefs[0].id;
    }

    updateDynamicCounts();
    renderAll();
    saveBootSnapshot();
    dismissBootSplash();
    if (state.activeTab === "health") {
      loadAndRenderHealthDashboard();
    }
  } catch (err) {
    reportClientError("syncFromSupabase", err?.message || String(err), err?.stack || "");
  }
}


function updateDynamicCounts() {
  const humanPeople = state.personProfiles.filter((p) => !isAiBotProfile(p));
  const pCount = humanPeople.length;
  const prCount = state.projectProfiles.filter((pr) => (pr.status || "active") !== "archived").length;
  const activeItems = state.profileItems.filter((i) => !isItemArchived(i) && !isItemConverted(i) && i.item_type !== "coaching_note" && !String(i.id || "").startsWith("pi-coach-"));
  const mineLoops = activeItems.filter((i) => isMineItem(i));
  const waitingLoops = activeItems.filter((i) => isWaitingItem(i));
  const topicLoops = activeItems.filter((i) => isDiscussionOrCoachingItem(i));
  const doneLoops = state.profileItems.filter((i) => !isItemArchived(i) && isItemConverted(i));
  const lCount = mineLoops.length;
  const mCount = state.sourceItems.filter((s) => !state.archivedIds[s.id]).length;
  const todayETStr = getTodayETString();
  const todayEvCount = getEventsForDate(todayETStr).length;

  const setTxt = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  };

  setTxt("sync-status-sub", "Personal Second Brain");
  const openDebriefCount = (state.debriefQuestions || []).filter((q) => !q.answered).length;
  setTxt("side-count-today", String(todayEvCount || Math.min(6, pCount)));
  setTxt("side-count-briefs", openDebriefCount > 0 ? `${openDebriefCount} open` : String((state.briefs || []).length));
  setTxt("side-count-people", String(pCount));
  setTxt("side-count-projects", String(prCount));
  setTxt("side-count-loops", String(lCount));
  setTxt("side-count-memory", String(mCount));

  setTxt("people-heading", "People & Meetings");
  setTxt("projects-heading", "Projects");
  setTxt("loops-heading", state.loopType === "waiting_on" ? "Waiting on Others" : state.loopType === "coaching_note" ? "Meeting & 1:1 Topics" : state.loopType === "converted" ? "Completed Loops" : state.loopType === "ALL" ? "All Loops" : "My Open Loops");
  setTxt("memory-heading", "Memory");

  setTxt("chip-people-all", `All (${pCount})`);
  setTxt("chip-projects-all", `All (${prCount})`);
  setTxt("chip-loops-mine", `My Open Loops (${mineLoops.length})`);
  setTxt("chip-loops-waiting", `Waiting on Others (${waitingLoops.length})`);
  setTxt("chip-loops-topics", `Meeting & 1:1 Topics (${topicLoops.length})`);
  setTxt("chip-loops-done", `Completed (${doneLoops.length})`);
  setTxt("chip-loops-all", `All (${activeItems.length})`);
  setTxt("chip-memory-all", `All (${mCount})`);

  setTxt("ios-tab-people", "People");
  setTxt("ios-tab-projects", "Projects");
  setTxt("ios-tab-loops", "Loops");
}

/* --- Reversible Task / Complete Toggle & Archive --- */
window.toggleLoopItem = async function (itemId) {
  const item = state.profileItems.find((x) => x.id === itemId);
  if (!item) return;

  const currentlyConverted = isItemConverted(item);
  const nextConverted = !currentlyConverted;

  if (nextConverted) {
    state.convertedIds[itemId] = true;
    item.status = "converted_to_task";
  } else {
    state.convertedIds[itemId] = false;
    delete state.convertedIds[itemId];
    item.status = "active";
    item.linked_task_id = null;
  }
  const diMatch = (state.discussionItems || []).find((x) => x.id === itemId);
  if (diMatch) {
    diMatch.status = nextConverted ? "completed" : "open";
  }
  localStorage.setItem("nd_converted_items", JSON.stringify(state.convertedIds));
  updateDynamicCounts();
  renderAll();
  refreshOpenSheetIfActive();

  showUndoToast(
    nextConverted ? "Marked complete & added to Tasks" : "Reopened loop",
    () => window.toggleLoopItem(itemId)
  );

  if (sb && state.user) {
    try {
      const payload = item.writeback_payload || {};
      const bucket = payload.bucket || (item.item_type === "coaching_note" ? "agenda" : "mine");
      const { error } = await sb.rpc("toggle_profile_item_task", {
        p_item_id: String(itemId),
        p_bucket: bucket
      });
      if (error) {
        reportClientError("toggle_profile_item_task", error.message, "", { itemId });
      }
    } catch (err) {
      reportClientError("toggle_profile_item_task", err?.message || String(err), "", { itemId });
    }
  }
};

window.archiveItem = async function (itemId, kind = "loop") {
  state.archivedIds[itemId] = true;
  localStorage.setItem("nd_archived_items", JSON.stringify(state.archivedIds));

  const item = state.profileItems.find((x) => x.id === itemId);
  if (item) item.status = "dismissed";
  const diMatch = (state.discussionItems || []).find((x) => x.id === itemId);
  if (diMatch) diMatch.status = "archived";

  updateDynamicCounts();
  renderAll();
  refreshOpenSheetIfActive();

  showUndoToast("Archived", async () => {
    delete state.archivedIds[itemId];
    localStorage.setItem("nd_archived_items", JSON.stringify(state.archivedIds));
    if (item) item.status = "active";
    updateDynamicCounts();
    renderAll();
    if (kind === "loop" && sb && state.user) {
      try {
        await sb.rpc("set_profile_item_status", {
          p_item_id: String(itemId),
          p_status: "active"
        });
      } catch (_) {}
    }
  });

  if (kind === "loop" && sb && state.user) {
    try {
      await sb.rpc("set_profile_item_status", {
        p_item_id: String(itemId),
        p_status: "dismissed"
      });
    } catch (_) {}
  }
};

/* --- Clean Apple HIG Single-Line Row Renderers --- */
const TEAM_MEETING_SERIES_KEYS = new Set([
  "series:hw-staff-meeting",
  "series:hw-we-do-work-wednesday",
  "series:hw-warehouse-touchbase",
  "series:encounter-execution",
  "series:sf-staff-meeting",
  "series:location-pastors",
  "series:pastor-justin-team-meeting",
  "series:staff-huddle"
]);

function isTeamMeetingSeriesKey(sk) {
  if (!sk) return false;
  if (TEAM_MEETING_SERIES_KEYS.has(sk)) return true;
  const g = (state.meetingGroups || []).find((x) => x.series_key === sk);
  return Boolean(g && g.group_type !== "1on1");
}

function getTodayETString() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function getItemDueDate(item) {
  const wb = item?.writeback_payload || {};
  const d = wb.due_date || wb.due || "";
  return d ? String(d).slice(0, 10) : "";
}

function formatDueBadge(dueStr, todayET) {
  if (!dueStr) return null;
  if (dueStr < todayET) {
    const dt = new Date(dueStr + "T12:00:00");
    const lbl = dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return { text: `Overdue · ${lbl}`, cls: "overdue" };
  }
  if (dueStr === todayET) {
    return { text: "Due today", cls: "due-today" };
  }
  const dt = new Date(dueStr + "T12:00:00");
  const lbl = dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return { text: `Due ${lbl}`, cls: "upcoming" };
}

function cleanLoopSubtitle(why, summary) {
  const s = String(why || "").trim();
  if (!s) return "";
  if (summary && s.toLowerCase() === String(summary).trim().toLowerCase()) return "";
  if (/^(1:1|priority normal|discussion topic|meeting discussion topic)/i.test(s)) return "";
  return s;
}

function getCleanLoopSubLabel(item, contextPersonSlug = null) {
  const todayET = getTodayETString();
  const dueStr = getItemDueDate(item);
  const dueBadge = formatDueBadge(dueStr, todayET);
  let who = "";
  if (item.profile_slug && item.profile_slug !== "nick-drake") {
    who = prettySlug(item.profile_slug);
  } else if (item.who_summary) {
    who = String(item.who_summary)
      .replace(/^Nick Drake\s*->\s*/i, "")
      .replace(/^Nick Drake$/i, "")
      .replace(/\s*\([^)]*\)\s*$/g, "")
      .trim();
  }
  if (who === "Nick Drake" || who === "Self / Team") who = "";

  const parts = [];
  if (dueBadge) {
    parts.push(`<span class="loop-due-tag ${dueBadge.cls}">${esc(dueBadge.text)}</span>`);
  }
  if (contextPersonSlug) {
    // Inside a Person sheet: don't repeat their own name on every row
    const firstName = who ? who.split(/\s+/)[0] : "them";
    if (isWaitingItem(item)) {
      parts.push(esc(`Waiting on ${firstName}`));
    } else if (!isDiscussionOrCoachingItem(item)) {
      parts.push("My Open Loop");
    }
    const extraNote = String(item.why_it_matters || "").trim();
    if (
      extraNote &&
      extraNote.toLowerCase() !== String(who || "").toLowerCase() &&
      !extraNote.toLowerCase().startsWith("1:1") &&
      !extraNote.toLowerCase().startsWith("priority normal") &&
      !extraNote.toLowerCase().includes("location pastor")
    ) {
      parts.push(esc(extraNote));
    }
    return parts.join(" · ");
  }

  if (isWaitingItem(item)) {
    parts.push(esc(who ? `Waiting on ${who}` : "Waiting on others"));
  } else if (isDiscussionOrCoachingItem(item)) {
    const isTeamMtg = item.profile_type === "location" || isTeamMeetingSeriesKey(item?.writeback_payload?.series_key || item?.series_key || "");
    const mtgLabel = isTeamMtg ? (item.who_summary || item.why_it_matters || who) : (who ? `1:1 · ${who}` : (item.who_summary || "Discussion Topic"));
    parts.push(esc(mtgLabel || "Discussion Topic"));
  } else if (who) {
    parts.push(esc(`You → ${who}`));
  } else {
    parts.push("You");
  }
  return parts.join(" · ");
}

function isJustAddedItem(item) {
  if (!item) return false;
  if (window._lastAddedItemId && String(item.id) === String(window._lastAddedItemId)) {
    return true;
  }
  if (
    window._lastAddedItemText &&
    String(item.what_summary || "").trim().toLowerCase() === window._lastAddedItemText
  ) {
    return true;
  }
  return false;
}

function renderLoopItemRow(item, contextPersonSlug = null) {
  const converted = isItemConverted(item);
  const subHtml = getCleanLoopSubLabel(item, contextPersonSlug);
  const justAdded = isJustAddedItem(item);

  return `
    <div class="ios-swipe-wrap ios-topic-row ${justAdded ? "ios-row-just-added" : ""}" data-kind="loop" data-id="${esc(item.id)}" data-loop-id="${esc(item.id)}" data-topic-id="${esc(item.id)}">
      <div class="ios-swipe-bg"></div>
      <div class="ios-row ${converted ? "completed" : ""} ${justAdded ? "ios-row-just-added" : ""}" data-loop-id="${esc(item.id)}" onclick="window.openLoopSheet('${esc(item.id)}')">
        <button
          type="button"
          class="ios-check ${converted ? "checked" : ""}"
          aria-label="${converted ? "Undo complete" : "Mark complete"}"
          onclick="event.stopPropagation(); window.completeLoopItem('${esc(item.id)}', this)"
        >${converted ? "✓" : ""}</button>
        <div class="ios-row-main">
          <div class="ios-row-title">${esc(item.what_summary)}</div>
          ${subHtml ? `<div class="ios-row-sub">${subHtml}</div>` : ""}
        </div>
        <div class="ios-row-right">
          <span class="ios-chevron">›</span>
        </div>
      </div>
    </div>`;
}

const TOPIC_GRIP_SVG = `<svg class="ios-topic-grip-icon" viewBox="0 0 16 16" width="15" height="15" fill="none" aria-hidden="true"><path d="M2.5 5h11M2.5 8h11M2.5 11h11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;

function getTopicOrderTextKeys(item) {
  if (!item) return [];
  const text = String(item.what_summary || item.item_text || "").trim().toLowerCase();
  if (!text) return [];
  const keys = [`txt::${text}`];
  const sk = item.series_key || (item.writeback_payload || {}).series_key || "";
  const pSlug = item.profile_slug || item.person_slug || "";
  if (sk) keys.unshift(`sk:${sk}::${text}`);
  if (pSlug) keys.unshift(`p:${pSlug}::${text}`);
  return keys;
}

function getTopicSortOrder(item) {
  if (!item) return 1000;
  const map = state.topicOrderMap || {};
  if (item.id && Number.isFinite(map[item.id])) {
    return Number(map[item.id]);
  }
  const tKeys = getTopicOrderTextKeys(item);
  for (let i = 0; i < tKeys.length; i++) {
    if (Number.isFinite(map[tKeys[i]])) {
      return Number(map[tKeys[i]]);
    }
  }
  const wbOrder = item.writeback_payload && Number(item.writeback_payload.sort_order);
  if (Number.isFinite(wbOrder) && wbOrder > 0 && wbOrder < 1000) {
    return wbOrder;
  }
  const colOrder = Number(item.sort_order);
  if (Number.isFinite(colOrder) && colOrder > 0) {
    return colOrder;
  }
  if (Number.isFinite(wbOrder) && wbOrder > 0) {
    return wbOrder;
  }
  return 1000;
}

function sortDiscussionTopics(items) {
  if (!Array.isArray(items) || items.length <= 1) return items || [];
  return [...items].sort((a, b) => {
    const doneA = isItemConverted(a) ? 1 : 0;
    const doneB = isItemConverted(b) ? 1 : 0;
    if (doneA !== doneB) return doneA - doneB;
    const ordA = getTopicSortOrder(a);
    const ordB = getTopicSortOrder(b);
    if (ordA !== ordB) return ordA - ordB;
    const tA = String(a.occurred_at || a.created_at || "");
    const tB = String(b.occurred_at || b.created_at || "");
    if (tA !== tB) return tB.localeCompare(tA);
    return String(a.id || "").localeCompare(String(b.id || ""));
  });
}
window.sortDiscussionTopics = sortDiscussionTopics;

async function persistTopicOrder(orderedIds) {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) return;
  if (!state.topicOrderMap || typeof state.topicOrderMap !== "object") {
    state.topicOrderMap = {};
  }
  const rpcIds = [];
  const seenRpc = new Set();
  const addRpcId = (id) => {
    const clean = String(id || "").trim();
    if (clean && !seenRpc.has(clean)) {
      seenRpc.add(clean);
      rpcIds.push(clean);
    }
  };

  orderedIds.forEach((rawId, idx) => {
    const id = String(rawId || "").trim();
    if (!id) return;
    const orderVal = (idx + 1) * 10;
    state.topicOrderMap[id] = orderVal;
    addRpcId(id);

    const pItem = (state.profileItems || []).find((x) => String(x.id) === id);
    const dItem = (state.discussionItems || []).find((x) => String(x.id) === id);
    const refItem = pItem || dItem;
    const refText = String(refItem?.what_summary || refItem?.item_text || "").trim().toLowerCase();
    const refSeries = refItem?.series_key || (refItem?.writeback_payload || {}).series_key || "";
    const refPerson = refItem?.profile_slug || refItem?.person_slug || "";

    if (refItem) {
      getTopicOrderTextKeys(refItem).forEach((k) => {
        state.topicOrderMap[k] = orderVal;
      });
    }

    (state.profileItems || []).forEach((pi) => {
      const piText = String(pi.what_summary || "").trim().toLowerCase();
      const piSeries = pi.series_key || (pi.writeback_payload || {}).series_key || "";
      const sameText =
        refText &&
        piText === refText &&
        ((refSeries && piSeries === refSeries) || (refPerson && pi.profile_slug === refPerson));
      if (String(pi.id) === id || sameText) {
        pi.sort_order = orderVal;
        pi.writeback_payload = { ...(pi.writeback_payload || {}), sort_order: orderVal };
        state.topicOrderMap[pi.id] = orderVal;
        getTopicOrderTextKeys(pi).forEach((k) => {
          state.topicOrderMap[k] = orderVal;
        });
      }
    });

    (state.discussionItems || []).forEach((di) => {
      const diText = String(di.item_text || "").trim().toLowerCase();
      const sameText =
        refText &&
        diText === refText &&
        ((refSeries && di.series_key === refSeries) || (refPerson && di.person_slug === refPerson));
      if (String(di.id) === id || sameText) {
        di.sort_order = orderVal;
        state.topicOrderMap[di.id] = orderVal;
      }
    });
  });

  try {
    localStorage.setItem("nd_topic_order_v1", JSON.stringify(state.topicOrderMap));
  } catch (_) {}

  try {
    if (typeof saveBootSnapshot === "function") saveBootSnapshot();
  } catch (_) {}

  if (sb && state.user) {
    try {
      const { error } = await sb.rpc("reorder_discussion_topics", {
        p_item_ids: orderedIds
      });
      if (error) {
        reportClientError("reorder_discussion_topics", error.message, "", { orderedIds });
      }
    } catch (err) {
      reportClientError("reorder_discussion_topics", err?.message || String(err), "", { orderedIds });
    }
  }
}
window.persistTopicOrder = persistTopicOrder;

function getMeetingSeriesDiscussionTopics(seriesKey) {
  if (!seriesKey) return [];
  const allProfIds = new Set(state.profileItems.map((i) => i.id));
  const profItems = state.profileItems.filter((i) => {
    if (isItemArchived(i) || isItemConverted(i)) return false;
    const sk = i.series_key || (i.writeback_payload || {}).series_key;
    return sk === seriesKey;
  });
  const seenIds = new Set([...allProfIds, ...profItems.map((i) => i.id)]);
  const seenText = new Set(profItems.map((i) => String(i.what_summary || "").trim().toLowerCase()));
  const extraDi = (state.discussionItems || [])
    .filter((d) => {
      if (d.status === "archived" || d.status === "dismissed" || d.status === "completed" || d.status === "done") return false;
      if (d.series_key !== seriesKey) return false;
      if (seenIds.has(d.id)) return false;
      const norm = String(d.item_text || "").trim().toLowerCase();
      if (norm && seenText.has(norm)) return false;
      return true;
    })
    .map((d) => ({
      id: d.id,
      profile_type: "location",
      profile_slug: d.person_slug || "Central",
      item_type: "discussion_item",
      what_summary: d.item_text,
      why_it_matters: d.meeting_title || "Meeting Discussion Topic",
      status: d.status === "completed" || d.status === "done" ? "converted_to_task" : "active",
      occurred_at: d.created_at,
      sort_order: d.sort_order,
      writeback_payload: { bucket: "agenda", series_key: d.series_key, sort_order: d.sort_order },
      _diOnly: true
    }));
  return sortDiscussionTopics([...profItems, ...extraDi]);
}

function getPersonDiscussionTopics(slug) {
  const allProfIds = new Set(state.profileItems.map((i) => i.id));
  const profItems = state.profileItems.filter((i) => {
    if (isItemArchived(i) || isItemConverted(i)) return false;
    const sk = i.series_key || (i.writeback_payload || {}).series_key || "";
    if (isTeamMeetingSeriesKey(sk)) return false;
    return (
      i.profile_type === "person" &&
      i.profile_slug === slug &&
      i.item_type !== "coaching_note" &&
      !String(i.id || "").startsWith("pi-coach-") &&
      (i.item_type === "discussion_item" ||
        (i.writeback_payload && i.writeback_payload.bucket === "agenda"))
    );
  });
  const seenIds = new Set([...allProfIds, ...profItems.map((i) => i.id)]);
  const seenText = new Set(profItems.map((i) => String(i.what_summary || "").trim().toLowerCase()));
  const extraDi = (state.discussionItems || [])
    .filter((d) => {
      if (d.status === "archived" || d.status === "dismissed" || d.status === "completed" || d.status === "done") return false;
      if (isTeamMeetingSeriesKey(d.series_key)) return false;
      const matchPerson = d.person_slug === slug || d.series_key === "series:1on1-" + slug;
      if (!matchPerson) return false;
      if (seenIds.has(d.id)) return false;
      const norm = String(d.item_text || "").trim().toLowerCase();
      if (norm && seenText.has(norm)) return false;
      return true;
    })
    .map((d) => ({
      id: d.id,
      profile_type: "person",
      profile_slug: slug,
      item_type: "discussion_item",
      what_summary: d.item_text,
      why_it_matters: d.meeting_title || "1:1 Discussion Topic",
      status: d.status === "completed" || d.status === "done" ? "converted_to_task" : "active",
      occurred_at: d.created_at,
      sort_order: d.sort_order,
      writeback_payload: { bucket: "agenda", series_key: d.series_key, sort_order: d.sort_order },
      _diOnly: true
    }));
  return sortDiscussionTopics([...profItems, ...extraDi]);
}

function getPersonActionLoops(slug) {
  const raw = state.profileItems.filter(
    (i) =>
      i.profile_type === "person" &&
      i.profile_slug === slug &&
      !isItemArchived(i) &&
      !isItemConverted(i) &&
      i.item_type !== "discussion_item" &&
      i.item_type !== "coaching_note" &&
      !(i.writeback_payload && i.writeback_payload.bucket === "agenda")
  );
  return sortMineLoops(raw, getTodayETString());
}

function renderMeetingGroupRow(g) {
  const topics = getMeetingSeriesDiscussionTopics(g.series_key);
  const openCount = topics.filter((i) => !isItemConverted(i)).length;
  const locBadge = g.location || "Central";
  const subParts = [g.cadence || "Recurring Meeting", locBadge].filter(Boolean);

  return `
    <div class="ios-swipe-wrap" data-kind="meeting-group" data-id="${esc(g.series_key)}">
      <div class="ios-row location-meeting-row" onclick="window.openMeetingGroupSheet('${esc(g.series_key)}')">
        <div class="ios-avatar location-meeting-avatar" title="Location / Team Meeting">🗓</div>
        <div class="ios-row-main">
          <div class="ios-row-title">${esc(g.name)}</div>
          <div class="ios-row-sub">${esc(subParts.join(" · "))}</div>
        </div>
        <div class="ios-row-right" style="gap:6px;">
          ${openCount > 0 ? `<span class="cal-topic-badge">${openCount} topic${openCount > 1 ? "s" : ""}</span>` : `<span style="font-size:11.5px;color:var(--text-ter);">+ Add topic</span>`}
          <span class="ios-chevron">›</span>
        </div>
      </div>
    </div>`;
}

function renderPersonRow(p) {
  const openTopics = getPersonDiscussionTopics(p.slug).filter((i) => !isItemConverted(i)).length;
  const openLoops = getPersonActionLoops(p.slug).filter((i) => !isItemConverted(i)).length;
  const openCount = openTopics + openLoops;

  return `
    <div class="ios-swipe-wrap" data-kind="person" data-id="${esc(p.slug)}">
      <div class="ios-row" onclick="window.openPersonSheet('${esc(p.slug)}')">
        <div class="ios-avatar">${esc(initials(p.full_name))}</div>
        <div class="ios-row-main">
          <div class="ios-row-title">${esc(p.full_name)}</div>
          <div class="ios-row-sub">${esc(p.role_title)} · ${esc(p.location || "Central")}</div>
        </div>
        <div class="ios-row-right">
          ${openCount > 0 ? `<span class="ios-count-badge">${openCount}</span>` : ""}
          <span class="ios-chevron">›</span>
        </div>
      </div>
    </div>`;
}

function renderProjectRow(pr) {
  const openCount = state.profileItems.filter(
    (i) =>
      ((i.profile_type === "project" && i.profile_slug === pr.slug) ||
        i.project_slug === pr.slug ||
        (i.writeback_payload || {}).project_slug === pr.slug) &&
      !isItemArchived(i) &&
      !isItemConverted(i)
  ).length;

  return `
    <div class="ios-swipe-wrap" data-kind="project" data-id="${esc(pr.slug)}">
      <div class="ios-row" onclick="window.openProjectSheet('${esc(pr.slug)}')">
        <div class="ios-avatar" style="border-radius:8px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 6.8A2.3 2.3 0 0 1 5.3 4.5h4.1l2.1 2.3h7.2A2.3 2.3 0 0 1 21 9.1v8.6a2.3 2.3 0 0 1-2.3 2.3H5.3A2.3 2.3 0 0 1 3 17.7V6.8z"></path>
          </svg>
        </div>
        <div class="ios-row-main">
          <div class="ios-row-title">${esc(pr.name)}</div>
          <div class="ios-row-sub">${esc(pr.location || "Central")} · ${esc(pr.category)}</div>
        </div>
        <div class="ios-row-right">
          ${openCount > 0 ? `<span class="ios-count-badge">${openCount}</span>` : ""}
          <span class="ios-chevron">›</span>
        </div>
      </div>
    </div>`;
}

function renderMemoryRow(s) {
  return `
    <div class="ios-swipe-wrap" data-kind="memory" data-id="${esc(s.id)}">
      <div class="ios-swipe-bg"></div>
      <div class="ios-row" onclick="window.openMemorySheet('${esc(s.id)}')">
        <div class="ios-row-main">
          <div class="ios-row-title">${esc(s.source_title)}</div>
          <div class="ios-row-sub">${esc(s.source_type)}${s.location ? ` · ${esc(s.location)}` : ""} · ${esc(fmtShortET(s.occurred_at))}</div>
        </div>
        <div class="ios-row-right">
          <span class="ios-chevron">›</span>
        </div>
      </div>
    </div>`;
}

/* --- Main Tab Views --- */

/* ===== s22: 2-Week Swipeable Date Strip, Personal Open Loops & Location Meetings ===== */
function isMineItem(i) {
  if (!i) return false;
  if (i.item_type === "discussion_item" || i.item_type === "coaching_note" || i.item_type === "waiting_on") {
    return false;
  }
  const b = (i.writeback_payload || {}).bucket;
  if (b === "theirs" || b === "waiting" || b === "agenda") return false;
  if (b === "mine") return i.item_type === "open_loop" || i.item_type === "next_step";
  return i.item_type === "open_loop";
}

function isWaitingItem(i) {
  if (!i) return false;
  const b = (i.writeback_payload || {}).bucket;
  return i.item_type === "waiting_on" || b === "theirs" || b === "waiting";
}

function isDiscussionOrCoachingItem(i) {
  if (!i) return false;
  const b = (i.writeback_payload || {}).bucket;
  if (i.item_type === "coaching_note" || String(i.id || "").startsWith("pi-coach-")) return false;
  return i.item_type === "discussion_item" || b === "agenda";
}

function fmtTimeET(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });
}

function getTwoWeekDates(anchorTodayStr) {
  const [y, m, d] = anchorTodayStr.split("-").map(Number);
  const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const dow = anchor.getUTCDay();
  const diffToMon = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(anchor.getTime() + diffToMon * 86400000);

  const dowNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const allDays = [];
  for (let i = 0; i < 14; i++) {
    const cur = new Date(monday.getTime() + i * 86400000);
    const iso = cur.toISOString().slice(0, 10);
    allDays.push({
      dateStr: iso,
      dowShort: dowNames[cur.getUTCDay()],
      dayNum: cur.getUTCDate(),
      weekIndex: i < 7 ? 0 : 1
    });
  }
  return [allDays.slice(0, 7), allDays.slice(7, 14)];
}

function getEventsForDate(dateStr) {
  if (!dateStr) return [];
  return (state.calendarEvents || [])
    .filter((e) => {
      if (e.is_hidden) return false;
      if (e.event_date === dateStr) return true;
      if (e.is_all_day && e.start_at && e.end_at) {
        const startD = String(e.start_at).slice(0, 10);
        const endD = String(e.end_at).slice(0, 10);
        if (dateStr >= startD && dateStr < endD) return true;
      }
      if (!e.is_all_day && e.start_at) {
        const etDate = new Date(e.start_at).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
        if (etDate === dateStr) return true;
      }
      return false;
    })
    .sort((a, b) => {
      if (a.is_all_day && !b.is_all_day) return -1;
      if (!a.is_all_day && b.is_all_day) return 1;
      return String(a.start_at || "").localeCompare(String(b.start_at || ""));
    });
}

function dateHasActivity(dateStr) {
  if (getEventsForDate(dateStr).length > 0) return true;
  return state.profileItems.some(
    (i) => !isItemArchived(i) && !isItemConverted(i) && isMineItem(i) && getItemDueDate(i) === dateStr
  );
}

window.selectTodayDate = function (dateStr) {
  const prevDate = state.selectedTodayDate || getTodayETString();
  const slideDir = dateStr >= prevDate ? "next" : "prev";
  state.selectedTodayDate = dateStr;
  const todayET = getTodayETString();
  const [w1, w2] = getTwoWeekDates(todayET);
  if (w2.some((d) => d.dateStr === dateStr)) {
    state.activeWeekPage = 1;
  } else if (w1.some((d) => d.dateStr === dateStr)) {
    state.activeWeekPage = 0;
  }
  renderToday();
  if (dateStr !== prevDate) {
    const calList = document.getElementById("today-calendar-list");
    if (calList) {
      calList.classList.remove("cal-list-slide-next", "cal-list-slide-prev");
      void calList.offsetWidth;
      calList.classList.add(slideDir === "next" ? "cal-list-slide-next" : "cal-list-slide-prev");
    }
  }
};

window.scrollTodayWeek = function (pageIdx) {
  state.activeWeekPage = pageIdx === 1 ? 1 : 0;
  const stripEl = document.getElementById("today-week-strip");
  if (stripEl) {
    const targetLeft = state.activeWeekPage === 1 ? stripEl.clientWidth : 0;
    stripEl.scrollTo({ left: targetLeft, behavior: "smooth" });
  }
  const navEl = document.getElementById("today-week-nav");
  if (navEl) {
    navEl.querySelectorAll(".today-week-pill-btn").forEach((b, idx) => {
      b.classList.toggle("active", idx === state.activeWeekPage);
    });
  }
};

function renderTodayWeekStrip() {
  const stripEl = document.getElementById("today-week-strip");
  const navEl = document.getElementById("today-week-nav");
  if (!stripEl) return;

  const todayET = getTodayETString();
  if (!state.selectedTodayDate) {
    state.selectedTodayDate = todayET;
  }
  const selected = state.selectedTodayDate;
  const [week1, week2] = getTwoWeekDates(todayET);

  if (week2.some((d) => d.dateStr === selected)) {
    state.activeWeekPage = 1;
  } else {
    state.activeWeekPage = 0;
  }

  if (navEl) {
    navEl.innerHTML = `
      <button type="button" class="today-week-pill-btn ${state.activeWeekPage === 0 ? "active" : ""}" onclick="window.scrollTodayWeek(0)">This Week</button>
      <button type="button" class="today-week-pill-btn ${state.activeWeekPage === 1 ? "active" : ""}" onclick="window.scrollTodayWeek(1)">Next Week ›</button>
    `;
  }

  const renderWeekPage = (days, pageIdx) => `
    <div class="today-week-page" data-week-page="${pageIdx}">
      ${days
        .map((d) => {
          const isSelected = d.dateStr === selected;
          const isToday = d.dateStr === todayET;
          const hasDot = dateHasActivity(d.dateStr);
          return `
            <button
              type="button"
              class="week-day-pill ${isSelected ? "active" : ""} ${isToday ? "is-today" : ""}"
              onclick="window.selectTodayDate('${d.dateStr}')"
              aria-pressed="${isSelected ? "true" : "false"}"
            >
              <span class="week-day-dow">${d.dowShort}</span>
              <span class="week-day-num">${d.dayNum}</span>
              <span class="week-day-dot ${hasDot ? "has-items" : ""}"></span>
            </button>
          `;
        })
        .join("")}
    </div>
  `;

  stripEl.innerHTML = renderWeekPage(week1, 0) + renderWeekPage(week2, 1);

  if (!stripEl._scrollBound) {
    stripEl._scrollBound = true;
    stripEl.addEventListener(
      "scroll",
      () => {
        if (!stripEl.clientWidth) return;
        const page = Math.round(stripEl.scrollLeft / stripEl.clientWidth);
        if (page !== state.activeWeekPage) {
          state.activeWeekPage = page;
          const nav = document.getElementById("today-week-nav");
          if (nav) {
            nav.querySelectorAll(".today-week-pill-btn").forEach((b, idx) => {
              b.classList.toggle("active", idx === page);
            });
          }
        }
      },
      { passive: true }
    );
  }

  requestAnimationFrame(() => {
    if (stripEl && stripEl.clientWidth) {
      const desired = state.activeWeekPage === 1 ? stripEl.clientWidth : 0;
      if (Math.abs(stripEl.scrollLeft - desired) > 16) {
        stripEl.scrollTo({ left: desired, behavior: "smooth" });
      }
    }
  });
}

function getEventOpenTopicCount(e) {
  if (!e) return 0;
  if (e.series_key) {
    return getMeetingSeriesDiscussionTopics(e.series_key).filter((i) => !isItemConverted(i)).length;
  }
  if (e.person_slug) {
    return getPersonDiscussionTopics(e.person_slug).filter((i) => !isItemConverted(i)).length;
  }
  return 0;
}

function renderTodayCalendar() {
  const el = document.getElementById("today-calendar-list");
  if (!el) return;
  const todayET = getTodayETString();
  const selectedDate = state.selectedTodayDate || todayET;
  const evs = getEventsForDate(selectedDate);

  const labelEl = document.getElementById("today-calendar-section-label");
  if (labelEl) {
    if (selectedDate === todayET) {
      labelEl.textContent = "TODAY'S CALENDAR";
    } else {
      const dt = new Date(selectedDate + "T12:00:00");
      const nice = dt
        .toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
        .toUpperCase();
      labelEl.textContent = `${nice} · CALENDAR`;
    }
  }

  const nowMs = Date.now();
  const isTodaySelected = selectedDate === todayET;
  let upNextAssigned = false;

  el.innerHTML = evs.length
    ? evs
        .map((e) => {
          const n = getEventOpenTopicCount(e);
          const timeLbl = e.is_all_day ? "All day" : fmtTimeET(e.start_at);
          let durStr = "";
          if (!e.is_all_day && e.start_at && e.end_at) {
            const mins = Math.round((new Date(e.end_at) - new Date(e.start_at)) / 60000);
            durStr = mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ""}` : `${mins}m`;
          }
          const locStr = (e.location || "").trim();
          let stateClass = "";
          let statusPill = "";
          if (isTodaySelected && !e.is_all_day && e.start_at) {
            const sMs = new Date(e.start_at).getTime();
            const eMs = e.end_at ? new Date(e.end_at).getTime() : sMs + 3600000;
            if (nowMs >= sMs && nowMs <= eMs) {
              stateClass = "is-now";
              statusPill = `<span class="cal-status-pill now">Now</span>`;
              upNextAssigned = true;
            } else if (!upNextAssigned && sMs > nowMs) {
              stateClass = "is-up-next";
              statusPill = `<span class="cal-status-pill next">Up Next</span>`;
              upNextAssigned = true;
            } else if (eMs < nowMs) {
              stateClass = "is-past";
            }
          }
          return `<div class="cal-row ${stateClass}" onclick="window.openMeetingSheet('${esc(e.id)}')">
            <div class="cal-time-col">
              <div class="cal-time">${esc(timeLbl)}</div>
              ${durStr ? `<div class="cal-dur">${esc(durStr)}</div>` : ""}
            </div>
            <div class="cal-accent-bar"></div>
            <div class="cal-main">
              <div class="cal-title-row">
                <span class="cal-title">${esc(e.title || "Untitled")}</span>
                ${statusPill}
              </div>
              ${locStr ? `<div class="cal-sub">${esc(locStr)}</div>` : ""}
            </div>
            <div class="cal-right">
              ${n > 0 ? `<span class="cal-topic-badge">${n} topic${n > 1 ? "s" : ""}</span>` : ""}
              <span class="ios-chevron">›</span>
            </div>
          </div>`;
        })
        .join("")
    : `<div class="empty-row">Nothing on the calendar for this day.</div>`;
}

window.openMeetingGroupSheet = function (seriesKey, fromBack = false) {
  const group = (state.meetingGroups || []).find((g) => g.series_key === seriesKey);
  if (!group) return;
  updateSheetNavSession({ type: "meeting_group", id: seriesKey, label: group.name || "Meeting", reopen: (b) => window.openMeetingGroupSheet(seriesKey, b) }, fromBack);
  const topics = getMeetingSeriesDiscussionTopics(seriesKey);
  const openCount = topics.filter((i) => !isItemConverted(i)).length;

  const todayET = getTodayETString();
  const nextEvent = (state.calendarEvents || [])
    .filter((e) => !e.is_hidden && e.series_key === seriesKey && e.event_date >= todayET)
    .sort((a, b) => String(a.start_at || "").localeCompare(String(b.start_at || "")))[0];

  document.getElementById("sheet-kicker").textContent = `${group.location || "CENTRAL"} · ${(group.group_type || "MEETING").toUpperCase()}`;
  document.getElementById("sheet-title").textContent = group.name;
  document.getElementById("sheet-body").innerHTML = `
    <div class="detail-block">
      <strong>${esc(group.cadence || "Recurring Meeting")}</strong>
      ${
        nextEvent
          ? `<div class="card-caption" style="margin-top:4px;color:var(--accent);">Next session: ${esc(
              new Date(nextEvent.event_date + "T12:00:00").toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric"
              })
            )} · ${nextEvent.is_all_day ? "All day" : esc(fmtTimeET(nextEvent.start_at) + " – " + fmtTimeET(nextEvent.end_at))}</div>`
          : ""
      }
      ${
        group.person_slug
          ? `<div style="margin-top:8px;"><button type="button" class="btn-task" onclick="window.openPersonSheet('${esc(group.person_slug)}')">Lead: ${esc(prettySlug(group.person_slug))} ›</button></div>`
          : ""
      }
    </div>

    <div>
      <div class="person-di-header">
        <div class="sheet-kicker">DISCUSSION ITEMS (${openCount} OPEN)</div>
      </div>
      <div class="ios-grouped-list">
        <div class="person-di-composer">
          <input
            type="text"
            id="mtg-group-di-input"
            class="apple-input"
            placeholder="Add discussion item for ${esc(group.name)}..."
          />
          <button type="button" class="btn-primary-pill" id="btn-mtg-group-di-add">+ Add</button>
        </div>
        <div id="mtg-group-di-list" class="ios-topic-reorder-list">
          ${
            topics.length
              ? topics
                  .map((item) => {
                    const done = isItemConverted(item);
                    return `
                      <div class="ios-row ios-topic-row ${done ? "completed" : ""}" data-topic-id="${esc(item.id)}" onclick="window.openLoopSheet('${esc(item.id)}')">
                        <button
                          type="button"
                          class="ios-check ${done ? "checked" : ""}"
                          onclick="event.stopPropagation(); window.toggleDiscussionItemStatus('${esc(item.id)}', null, null, '${esc(seriesKey)}')"
                        >${done ? "✓" : ""}</button>
                        <div class="ios-row-main">
                          <div class="ios-row-title">${esc(item.what_summary)}</div>
                          <div class="ios-row-sub">${esc(item.why_it_matters || group.name)}</div>
                        </div>
                        <div class="ios-row-right">
                          <button
                            type="button"
                            class="di-delete-btn"
                            title="Remove topic"
                            onclick="event.stopPropagation(); window.archiveDiscussionTopic('${esc(item.id)}', null, '${esc(seriesKey)}')"
                          >✕</button>
                          
                          <span class="ios-chevron">›</span>
                        </div>
                      </div>
                    `;
                  })
                  .join("")
              : `<div class="empty-row">No discussion items yet — type above to drop one in for ${esc(group.name)}.</div>`
          }
        </div>
      </div>
    </div>
  `;
  window.presentSheetBackdrop();

  const submitGroupDi = async () => {
    const inputEl = document.getElementById("mtg-group-di-input");
    const addBtn = document.getElementById("btn-mtg-group-di-add");
    const txt = (inputEl?.value || "").trim();
    if (!txt || !sb) return;
    if (inputEl) inputEl.disabled = true;
    if (addBtn) {
      addBtn.disabled = true;
      addBtn.textContent = "Saving...";
    }
    const { error } = await sb.rpc("create_profile_item", {
      p_profile_type: group.person_slug ? "person" : "location",
      p_profile_slug: group.person_slug || group.location || "Central",
      p_item_type: "discussion_item",
      p_what_summary: txt,
      p_why_it_matters: group.name,
      p_who_summary: group.name,
      p_bucket: "agenda",
      p_series_key: seriesKey,
      p_project_slug: group.project_slug || null
    });
    if (error) {
      if (inputEl) inputEl.disabled = false;
      if (addBtn) {
        addBtn.disabled = false;
        addBtn.textContent = "+ Add";
      }
      alert("Error adding discussion item: " + error.message);
      return;
    }
    await syncFromSupabase();
    window.openMeetingGroupSheet(seriesKey);
    showUndoToast(`Added to ${group.name}`, null);
  };

  document.getElementById("btn-mtg-group-di-add")?.addEventListener("click", submitGroupDi);
  document.getElementById("mtg-group-di-input")?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      submitGroupDi();
    }
  });
};

window.openMeetingSheet = function (eventId, fromBack = false) {
  const e = state.calendarEvents.find((x) => x.id === eventId);
  if (!e) return;
  updateSheetNavSession({ type: "meeting", id: eventId, label: e.title || "Meeting", reopen: (b) => window.openMeetingSheet(eventId, b) }, fromBack);
  const group = state.meetingGroups.find((g) => g.series_key && g.series_key === e.series_key);
  const effectiveSeriesKey = e.series_key || group?.series_key || ("series:meeting-" + e.id);
  const effectivePersonSlug = isTeamMeetingSeriesKey(effectiveSeriesKey) ? null : (e.person_slug || group?.person_slug || null);

  let items = [];
  if (e.series_key) {
    items = getMeetingSeriesDiscussionTopics(e.series_key);
  }
  if (effectivePersonSlug && !isTeamMeetingSeriesKey(effectiveSeriesKey)) {
    const personTopics = getPersonDiscussionTopics(effectivePersonSlug);
    const seen = new Set(items.map((x) => x.id));
    personTopics.forEach((pt) => {
      if (!seen.has(pt.id)) items.push(pt);
    });
  }
  items = sortDiscussionTopics(items);

  const openCount = items.filter((d) => !isItemConverted(d)).length;
  document.getElementById("sheet-kicker").textContent = (group?.name || "CALENDAR EVENT").toUpperCase();
  document.getElementById("sheet-title").textContent = e.title || "Meeting";
  document.getElementById("sheet-body").innerHTML = `
    <div class="detail-block">
      <strong>${e.is_all_day ? "All day" : esc(fmtTimeET(e.start_at) + " – " + fmtTimeET(e.end_at))}</strong>
      ${e.location ? `<div class="card-caption" style="margin-top:2px;">${esc(e.location)}</div>` : ""}
      ${e.meeting_url ? `<div style="margin-top:6px;"><a href="${esc(e.meeting_url)}" target="_blank" rel="noopener" class="btn-primary-pill" style="display:inline-block;text-decoration:none;font-size:12px;padding:5px 12px;">Join Meeting ↗</a></div>` : ""}
      ${effectivePersonSlug ? `<div style="margin-top:6px;"><button type="button" class="btn-task" onclick="window.openPersonSheet('${esc(effectivePersonSlug)}')">Open ${esc(prettySlug(effectivePersonSlug))} Profile ›</button></div>` : ""}
    </div>
    <div>
      <div class="person-di-header">
        <div class="sheet-kicker">DISCUSSION TOPICS (${openCount} OPEN)</div>
      </div>
      <div class="ios-grouped-list">
        <div class="person-di-composer">
          <input id="mtg-di-input" class="apple-input" placeholder="Add discussion topic for ${esc(e.title || "this meeting")}..." />
          <button type="button" class="btn-primary-pill" id="btn-mtg-di-add">+ Add</button>
        </div>
        <div id="mtg-di-list" class="ios-topic-reorder-list">
          ${items.length ? items.map((d) => {
            const done = isItemConverted(d);
            return `
              <div class="ios-row ios-topic-row ${done ? "completed" : ""}" data-topic-id="${esc(d.id)}" onclick="window.openLoopSheet('${esc(d.id)}')">
                <button type="button" class="ios-check ${done ? "checked" : ""}" onclick="event.stopPropagation(); window.toggleDiscussionItemStatus('${esc(d.id)}', null, '${esc(eventId)}')">${done ? "✓" : ""}</button>
                <div class="ios-row-main">
                  <div class="ios-row-title">${esc(d.what_summary || d.item_text)}</div>
                  <div class="ios-row-sub">${esc(d.why_it_matters || group?.name || e.title || "")}</div>
                </div>
                <div class="ios-row-right">
                  <button
                    type="button"
                    class="di-delete-btn"
                    title="Remove topic"
                    onclick="event.stopPropagation(); window.archiveDiscussionTopic('${esc(d.id)}', null, null, '${esc(eventId)}')"
                  >✕</button>
                  
                  <span class="ios-chevron">›</span>
                </div>
              </div>`;
          }).join("") : `<div class="empty-row">No discussion topics yet — add one above.</div>`}
        </div>
      </div>
    </div>`;
  window.presentSheetBackdrop();
  const submitMtgDi = async () => {
    const inputEl = document.getElementById("mtg-di-input");
    const txt = (inputEl?.value || "").trim();
    if (!txt || !sb) return;
    window._lastAddedItemText = txt.toLowerCase();
    if (inputEl) inputEl.disabled = true;
    const { error } = await sb.rpc("create_profile_item", {
      p_profile_type: effectivePersonSlug ? "person" : "location",
      p_profile_slug: effectivePersonSlug || group?.location || "Central",
      p_item_type: "discussion_item",
      p_what_summary: txt,
      p_why_it_matters: group?.name || e.title || "Meeting Discussion Topic",
      p_who_summary: effectivePersonSlug ? prettySlug(effectivePersonSlug) : (group?.name || e.title || "Meeting"),
      p_bucket: "agenda",
      p_series_key: effectiveSeriesKey
    });
    if (error) {
      if (inputEl) inputEl.disabled = false;
      alert(error.message);
      return;
    }
    await syncFromSupabase();
    window.openMeetingSheet(eventId);
    showUndoToast("Added discussion topic", null);
  };
  document.getElementById("btn-mtg-di-add")?.addEventListener("click", submitMtgDi);
  document.getElementById("mtg-di-input")?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      submitMtgDi();
    }
  });
};

function sortMineLoops(items, todayET) {
  const refToday = todayET || getTodayETString();
  return [...items].sort((a, b) => {
    const ordA = getTopicSortOrder(a);
    const ordB = getTopicSortOrder(b);
    if (ordA !== ordB) return ordA - ordB;
    const da = getItemDueDate(a);
    const db = getItemDueDate(b);
    const aOver = da && da < refToday ? 0 : da === refToday ? 1 : da ? 2 : 3;
    const bOver = db && db < refToday ? 0 : db === refToday ? 1 : db ? 2 : 3;
    if (aOver !== bOver) return aOver - bOver;
    if (da && db && da !== db) return da.localeCompare(db);
    return (b.confidence || 0) - (a.confidence || 0);
  });
}
window.sortMineLoops = sortMineLoops;

function renderToday() {
  const todayET = getTodayETString();
  if (!state.selectedTodayDate) {
    state.selectedTodayDate = todayET;
  }
  const selectedDate = state.selectedTodayDate;

  renderTodayWeekStrip();

  const evs = getEventsForDate(selectedDate);
  const mineLoops = state.profileItems.filter((i) => !isItemArchived(i) && !isItemConverted(i) && isMineItem(i));
  const dueOnSelected = mineLoops.filter((i) => getItemDueDate(i) === selectedDate).length;
  const overdueCount = mineLoops.filter((i) => {
    const d = getItemDueDate(i);
    return d && d < todayET;
  }).length;

  const dateSub = document.getElementById("today-date-sub");
  if (dateSub) {
    const dt = new Date(selectedDate + "T12:00:00");
    const dayLabel = dt.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric"
    });
    const parts = [
      `<span>${esc(dayLabel)}</span>`,
      `<span>· ${evs.length} meeting${evs.length === 1 ? "" : "s"}</span>`
    ];
    if (selectedDate === todayET) {
      parts.push(`<span>· ${dueOnSelected} due</span>`);
      if (overdueCount > 0) {
        parts.push(`<span>· <span class="overdue-inline">${overdueCount} overdue</span></span>`);
      }
    } else {
      if (dueOnSelected > 0) {
        parts.push(`<span>· ${dueOnSelected} due</span>`);
      }
      parts.push(`<button type="button" class="btn-back-today" onclick="window.selectTodayDate('${todayET}')">↩ Back to Today</button>`);
    }
    dateSub.innerHTML = parts.join(" ");
  }

  renderTodayBriefsAndDebriefs();
  const listEl = document.getElementById("today-1on1-list");
  const loopsEl = document.getElementById("today-loops-list") || document.getElementById("today-priority-loops");
  renderTodayCalendar();

  if (listEl) {
    const people = state.personProfiles.filter((p) => !isAiBotProfile(p)).slice(0, 6);
    listEl.innerHTML = people.map((p) => renderPersonRow(p)).join("");
  }

  if (loopsEl) {
    const sortedMine = sortMineLoops(mineLoops, todayET).slice(0, 12);
    const composerHtml = `
      <div class="person-di-composer">
        <input type="text" id="today-loop-quick-input" class="apple-input" placeholder="Add a personal open loop..." />
        <button type="button" class="btn-primary-pill" id="btn-today-loop-quick-add">+ Add</button>
      </div>`;
    loopsEl.innerHTML =
      composerHtml +
      (sortedMine.length
        ? sortedMine.map((i) => renderLoopItemRow(i)).join("")
        : `<div class="empty-row">No open to-dos. 🎉</div>`);

    const submitTodayQuickLoop = async () => {
      const inp = document.getElementById("today-loop-quick-input");
      const btn = document.getElementById("btn-today-loop-quick-add");
      const txt = (inp?.value || "").trim();
      if (!txt) return;
      const tempId = "temp-loop-" + Date.now();
      window._lastAddedItemId = tempId;
      window._lastAddedItemText = txt.toLowerCase();
      state.profileItems.unshift({
        id: tempId,
        profile_type: "person",
        profile_slug: "nick-drake",
        item_type: "open_loop",
        category: "open_loop",
        status: "active",
        what_summary: txt,
        due_date: selectedDate === todayET ? null : selectedDate,
        writeback_payload: { bucket: "mine", due_date: selectedDate === todayET ? null : selectedDate },
        updated_at: new Date().toISOString()
      });
      if (inp) inp.value = "";
      renderToday();
      setTimeout(() => {
        if (window._lastAddedItemId === tempId) window._lastAddedItemId = null;
        if (window._lastAddedItemText === txt.toLowerCase()) window._lastAddedItemText = null;
      }, 600);
      if (!sb || window._skipQuickAddRpc) return;
      if (inp) inp.disabled = true;
      if (btn) { btn.disabled = true; btn.textContent = "Saving..."; }
      const { error } = await sb.rpc("create_profile_item", {
        p_profile_type: "person",
        p_profile_slug: "nick-drake",
        p_item_type: "open_loop",
        p_what_summary: txt,
        p_bucket: "mine",
        p_due_date: selectedDate === todayET ? null : selectedDate
      });
      if (error) {
        if (inp) inp.disabled = false;
        if (btn) { btn.disabled = false; btn.textContent = "+ Add"; }
        alert("Error adding loop: " + error.message);
        return;
      }
      await syncFromSupabase();
      showUndoToast("Added to My Open Loops", null);
    };
    document.getElementById("btn-today-loop-quick-add")?.addEventListener("click", submitTodayQuickLoop);
    document.getElementById("today-loop-quick-input")?.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        submitTodayQuickLoop();
      }
    });
  }
}

function renderPeople() {
  const grid = document.getElementById("people-grid");
  if (!grid) return;
  const oldStrip = document.getElementById("people-frequent-strip");
  if (oldStrip) oldStrip.remove();

  const headingEl = document.getElementById("people-heading");
  const mode = state.personLoc === "AI" ? "people" : (state.personMode || "people");
  if (headingEl) {
    headingEl.textContent = mode === "meetings" ? "Meetings" : "People";
  }
  document.querySelectorAll("#people-mode-seg .inline-mini-pill").forEach((b) => {
    b.classList.toggle("active", b.getAttribute("data-pmode") === mode);
  });

  if (mode === "meetings") {
    const teamMeetings = (state.meetingGroups || []).filter((g) => {
      if (g.is_active === false) return false;
      if (g.group_type === "1on1") return false;
      if (state.personLoc !== "ALL" && state.personLoc !== "AI") {
        const gLoc = g.location || "Central";
        const matchLoc =
          gLoc.includes(state.personLoc) ||
          (state.personLoc === "HW" && g.series_key === "series:encounter-execution") ||
          (state.personLoc === "SF" && g.series_key === "series:encounter-execution");
        if (!matchLoc) return false;
      }
      return true;
    });
    grid.className = "ios-grouped-list";
    grid.innerHTML = teamMeetings.length
      ? teamMeetings.map((g) => renderMeetingGroupRow(g)).join("")
      : `<div class="empty-row">No recurring meetings for this location.</div>`;
    return;
  }

  const filteredPeople = state.personProfiles
    .filter((p) => {
      const isBot = isAiBotProfile(p);
      if (state.personLoc === "AI") return isBot;
      if (isBot) return false;
      if (state.personLoc !== "ALL" && !(p.location || "").includes(state.personLoc)) return false;
      return true;
    })
    .sort((a, b) => stripPastorPrefix(a.full_name).localeCompare(stripPastorPrefix(b.full_name)));

  if (state.personLoc === "ALL") {
    const locSections = [
      {
        key: "HW",
        title: "HEATHROW",
        people: filteredPeople.filter((p) => (p.location || "") === "HW" || (p.location || "") === "HW / SF")
      },
      {
        key: "SF",
        title: "SANFORD",
        people: filteredPeople.filter((p) => (p.location || "") === "SF")
      },
      {
        key: "Central",
        title: "CENTRAL & REGIONAL",
        people: filteredPeople.filter(
          (p) => (p.location || "Central") !== "HW" && (p.location || "") !== "HW / SF" && (p.location || "") !== "SF"
        )
      }
    ].filter((sec) => sec.people.length > 0);

    grid.className = "";
    grid.innerHTML = locSections
      .map(
        (sec) => `
        <div class="location-group-section">
          <div class="location-group-header">
            <span>${esc(sec.title)}</span>
            <span>${sec.people.length}</span>
          </div>
          <div class="ios-grouped-list">
            ${sec.people.map((p) => renderPersonRow(p)).join("")}
          </div>
        </div>
      `
      )
      .join("");
  } else {
    grid.className = "ios-grouped-list";
    grid.innerHTML = filteredPeople.length
      ? filteredPeople.map((p) => renderPersonRow(p)).join("")
      : `<div class="empty-row">No people found for this filter.</div>`;
  }
}

function renderProjects() {
  const grid = document.getElementById("projects-grid");
  if (!grid) return;
  const q = (document.getElementById("project-filter-input")?.value || "").trim().toLowerCase();

  const filtered = state.projectProfiles.filter((pr) => {
    const archived = (pr.status || "active") === "archived";
    if (state.projectLoc === "ARCHIVED") { if (!archived) return false; }
    else if (archived) return false;
    if (state.projectLoc !== "ALL" && state.projectLoc !== "ARCHIVED" && !(pr.location || "").includes(state.projectLoc)) return false;
    if (
      q &&
      !`${pr.name} ${pr.owner} ${pr.category} ${pr.who_summary} ${pr.what_summary}`
        .toLowerCase()
        .includes(q)
    ) {
      return false;
    }
    return true;
  });

  grid.innerHTML = filtered.map((pr) => renderProjectRow(pr)).join("");
  const chips = document.getElementById("project-loc-chips");
  if (chips && !document.getElementById("chip-projects-archived")) {
    const nArch = state.projectProfiles.filter((x) => x.status === "archived").length;
    chips.insertAdjacentHTML("beforeend", `<button type="button" class="chip" id="chip-projects-archived" data-loc="ARCHIVED">Archived (${nArch})</button>`);
    document.getElementById("chip-projects-archived").addEventListener("click", (ev) => {
      chips.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
      ev.currentTarget.classList.add("active");
      state.projectLoc = "ARCHIVED"; renderProjects();
    });
  }
}

function renderLoops() {
  const listEl = document.getElementById("loops-list");
  if (!listEl) return;
  const q = (document.getElementById("loop-filter-input")?.value || "").trim().toLowerCase();
  const todayET = getTodayETString();

  updateDynamicCounts();

  const filtered = state.profileItems.filter((i) => {
    if (isItemArchived(i) || i.item_type === "coaching_note" || String(i.id || "").startsWith("pi-coach-")) return false;
    const conv = isItemConverted(i);
    if (state.loopType === "converted") {
      if (!conv) return false;
    } else {
      if (conv) return false;
      if (state.loopType === "open_loop") {
        if (!isMineItem(i)) return false;
      } else if (state.loopType === "waiting_on") {
        if (!isWaitingItem(i)) return false;
      } else if (state.loopType === "coaching_note") {
        if (!isDiscussionOrCoachingItem(i)) return false;
      }
    }
    if (
      q &&
      !`${i.profile_slug} ${i.who_summary} ${i.what_summary} ${i.why_it_matters}`
        .toLowerCase()
        .includes(q)
    ) {
      return false;
    }
    return true;
  });

  const quickAddInput = document.getElementById("loops-quick-add-input");
  if (quickAddInput) {
    quickAddInput.placeholder =
      state.loopType === "waiting_on"
        ? "Add something you are waiting on (press Enter)..."
        : state.loopType === "coaching_note"
        ? "Add a discussion topic (press Enter)..."
        : "Add a personal open loop (press Enter)...";
  }

  const sorted =
    state.loopType === "coaching_note"
      ? sortDiscussionTopics(filtered)
      : sortMineLoops(filtered, todayET);
  const hasCustomOrder = sorted.some((i) => getTopicSortOrder(i) !== 1000);
  if (state.loopType === "open_loop" && !q && sorted.length > 0 && !hasCustomOrder) {
    const overdue = [];
    const dueToday = [];
    const upcoming = [];
    const undated = [];
    sorted.forEach((i) => {
      const d = getItemDueDate(i);
      if (!d) undated.push(i);
      else if (d < todayET) overdue.push(i);
      else if (d === todayET) dueToday.push(i);
      else upcoming.push(i);
    });
    const sections = [];
    if (overdue.length) {
      sections.push(`<div class="loops-group-block"><div class="loops-group-header overdue"><span>Overdue</span><span>${overdue.length}</span></div><div class="ios-grouped-list ios-topic-reorder-list">${overdue.map((i) => renderLoopItemRow(i)).join("")}</div></div>`);
    }
    if (dueToday.length) {
      sections.push(`<div class="loops-group-block"><div class="loops-group-header today"><span>Due Today</span><span>${dueToday.length}</span></div><div class="ios-grouped-list ios-topic-reorder-list">${dueToday.map((i) => renderLoopItemRow(i)).join("")}</div></div>`);
    }
    if (upcoming.length) {
      sections.push(`<div class="loops-group-block"><div class="loops-group-header"><span>Upcoming</span><span>${upcoming.length}</span></div><div class="ios-grouped-list ios-topic-reorder-list">${upcoming.map((i) => renderLoopItemRow(i)).join("")}</div></div>`);
    }
    if (undated.length) {
      sections.push(`<div class="loops-group-block"><div class="loops-group-header"><span>Open To-Dos</span><span>${undated.length}</span></div><div class="ios-grouped-list ios-topic-reorder-list">${undated.map((i) => renderLoopItemRow(i)).join("")}</div></div>`);
    }
    listEl.className = "loops-grouped-container ios-topic-reorder-list";
    listEl.innerHTML = sections.join("");
  } else {
    listEl.className = "ios-grouped-list ios-topic-reorder-list";
    listEl.innerHTML = sorted.length
      ? sorted.map((i) => renderLoopItemRow(i)).join("")
      : `<div class="empty-row">No items in this view.</div>`;
  }
}

function renderMemory() {
  const listEl = document.getElementById("memory-list");
  const q = (document.getElementById("memory-filter-input")?.value || "").trim().toLowerCase();
  if (!listEl) return;

  const filtered = state.sourceItems.filter((s) => {
    if (state.archivedIds[s.id]) return false;
    if (state.memorySrc === "slack" && !(s.source_type || "").startsWith("slack")) return false;
    if (state.memorySrc === "drive" && !(s.source_type || "").startsWith("google_")) return false;
    if (
      state.memorySrc !== "ALL" &&
      state.memorySrc !== "slack" &&
      state.memorySrc !== "drive" &&
      s.source_type !== state.memorySrc
    ) {
      return false;
    }
    if (
      q &&
      !`${s.source_title} ${s.who_summary} ${s.what_summary} ${s.why_it_matters}`
        .toLowerCase()
        .includes(q)
    ) {
      return false;
    }
    return true;
  });

  listEl.innerHTML = filtered.map((s) => renderMemoryRow(s)).join("");
}

/* --- Progressive Disclosure Detail Sheets --- */
window.openLoopSheet = function (itemId, fromBack = false) {
  if (window._isReorderingTopic || (window._suppressTopicClickUntil && Date.now() < window._suppressTopicClickUntil)) {
    return;
  }
  let item = state.profileItems.find((x) => String(x.id) === String(itemId));
  let isLegacyDi = false;
  if (!item) {
    const di = (state.discussionItems || []).find((x) => String(x.id) === String(itemId));
    if (!di) return;
    isLegacyDi = true;
    item = {
      id: di.id,
      profile_type: di.person_slug ? "person" : "location",
      profile_slug: di.person_slug || "Central",
      item_type: "discussion_item",
      what_summary: di.item_text || "",
      why_it_matters: di.notes || "Discussion Topic",
      who_summary: di.person_slug ? prettySlug(di.person_slug) : "",
      status: di.status === "completed" ? "converted_to_task" : "active",
      writeback_payload: { series_key: di.series_key, bucket: "agenda" }
    };
  }
  updateSheetNavSession(
    {
      type: "loop",
      id: itemId,
      label: "Loop",
      reopen: (b) => window.openLoopSheet(itemId, b)
    },
    fromBack
  );
  const converted = isItemConverted(item);
  const ownerName = prettySlug(item.profile_slug);
  const curDue = getItemDueDate(item) || "";
  const curMode = isDiscussionOrCoachingItem(item)
    ? "discussion_item"
    : isWaitingItem(item)
    ? "waiting_on"
    : "open_loop";

  const modeLabel = curMode === "discussion_item" ? "1:1 / Mtg Topic" : curMode === "waiting_on" ? "Waiting On" : "My Open Loop";
  const defaultKicker = `${ownerName} · ${modeLabel}`;
  const cleanContext = cleanLoopSubtitle(item.why_it_matters, item.what_summary);

  const people = [...state.personProfiles.filter((p) => !isAiBotProfile(p))].sort((a, b) =>
    String(a.full_name || "").localeCompare(String(b.full_name || ""))
  );
  const activeProjects = state.projectProfiles.filter((pr) => (pr.status || "active") !== "archived");
  const groups = state.meetingGroups.filter((g) => g.is_active !== false);
  const teamGroups = groups.filter((g) => g.group_type !== "1on1" || isTeamMeetingSeriesKey(g.series_key));

  const curSeriesKey = item.writeback_payload?.series_key || item.series_key || "";
  const isCurTeamMtg = Boolean(curSeriesKey && isTeamMeetingSeriesKey(curSeriesKey));
  const initialDiTarget = isCurTeamMtg ? "meeting" : "person";
  const curPersonSlug =
    item.profile_type === "person"
      ? item.profile_slug || "nick-drake"
      : item.person_slug || "nick-drake";
  const curProjectSlug =
    item.profile_type === "project"
      ? item.profile_slug
      : item.project_slug || item.writeback_payload?.project_slug || "";

  document.getElementById("sheet-kicker").textContent = defaultKicker;
  document.getElementById("sheet-title").textContent = item.what_summary;
  document.getElementById("sheet-body").innerHTML = `
    <div id="loop-read-view" style="display:flex;flex-direction:column;gap:12px;">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <button
          type="button"
          class="${converted ? "btn-auth-secondary" : "btn-primary-pill"}"
          style="width:auto;"
          onclick="window.toggleLoopItem('${esc(item.id)}'); window.closeSheetAndReset();"
        >
          ${converted ? "↺ Mark as Open" : "✓ Mark Complete"}
        </button>
        <button
          type="button"
          class="btn-task"
          onclick="${
            item.profile_type === "project"
              ? `window.openProjectSheet('${esc(item.profile_slug)}')`
              : (item.profile_type === "location" && curSeriesKey)
              ? `window.openMeetingGroupSheet('${esc(curSeriesKey)}')`
              : `window.openPersonSheet('${esc(item.profile_slug)}')`
          }"
        >
          ${item.profile_type === "project" ? "📁" : item.profile_type === "location" ? "🗓️" : "👤"} ${esc(item.profile_type === "location" ? (item.who_summary || ownerName) : ownerName)} ›
        </button>
        ${curDue ? `<span class="meta-pill">Due ${esc(curDue)}</span>` : ""}
        <button
          type="button"
          class="btn-task"
          id="btn-toggle-loop-edit"
          style="margin-left:auto;"
        >
          Edit
        </button>
        <button
          type="button"
          class="btn-auth-secondary"
          style="width:auto;color:#ff453a;"
          onclick="window.archiveItem('${esc(item.id)}', 'loop'); window.closeSheetAndReset();"
        >
          Delete
        </button>
      </div>

      ${cleanContext ? `<div class="detail-block" id="loop-read-notes-block"><strong>Notes &amp; Context</strong><div style="margin-top:4px;white-space:pre-wrap;">${esc(cleanContext)}</div></div>` : ""}
    </div>

    <div class="qc-form-main" id="loop-edit-form-block" hidden style="display:flex;flex-direction:column;gap:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <button type="button" class="btn-task" id="btn-loop-cancel-edit">‹ Cancel</button>
        <button
          type="button"
          class="btn-auth-secondary"
          id="btn-delete-loop-edit"
          style="width:auto;color:#ff453a;padding:5px 12px;font-size:12px;"
          onclick="window.archiveItem('${esc(item.id)}', 'loop'); window.closeSheetAndReset();"
        >
          Delete
        </button>
      </div>

      <label class="qc-label" for="loop-edit-summary" style="margin:0;">Summary</label>
      <textarea id="loop-edit-summary" class="apple-input qc-field" rows="2" style="margin:0;">${esc(item.what_summary || "")}</textarea>

      <label class="qc-label" style="margin:2px 0 0;">Type &amp; Ownership</label>
      <div class="qc-seg-pills" id="loop-edit-mode-pills">
        <button type="button" class="qc-seg-pill ${curMode === "open_loop" ? "active" : ""}" data-lmode="open_loop">My Open Loop</button>
        <button type="button" class="qc-seg-pill ${curMode === "waiting_on" ? "active" : ""}" data-lmode="waiting_on">Waiting on Others</button>
        <button type="button" class="qc-seg-pill ${curMode === "discussion_item" ? "active" : ""}" data-lmode="discussion_item">Discussion Topic</button>
      </div>

      <div id="loop-edit-loop-fields" ${curMode === "discussion_item" ? "hidden" : ""} style="display:flex;flex-direction:column;gap:10px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div>
            <label class="qc-label" for="loop-edit-person" style="margin:0 0 4px;display:block;">Person</label>
            <select id="loop-edit-person" class="apple-input qc-field" style="margin:0;width:100%;">
              <option value="nick-drake" ${curPersonSlug === "nick-drake" ? "selected" : ""}>Me (Nick Drake)</option>
              ${people
                .map(
                  (p) =>
                    `<option value="${esc(p.slug)}" ${curPersonSlug === p.slug ? "selected" : ""}>${esc(p.full_name)} (${esc(p.location || "Central")})</option>`
                )
                .join("")}
            </select>
          </div>
          <div>
            <label class="qc-label" for="loop-edit-project" style="margin:0 0 4px;display:block;">Project (optional)</label>
            <select id="loop-edit-project" class="apple-input qc-field" style="margin:0;width:100%;">
              <option value="">-- No Project --</option>
              ${activeProjects
                .map(
                  (pr) =>
                    `<option value="${esc(pr.slug)}" ${curProjectSlug === pr.slug ? "selected" : ""}>${esc(pr.name)}</option>`
                )
                .join("")}
            </select>
          </div>
        </div>
        <div>
          <label class="qc-label" for="loop-edit-due" style="margin:0 0 4px;display:block;">Due Date (optional)</label>
          <input type="date" id="loop-edit-due" class="apple-input qc-field" style="margin:0;width:100%;" value="${esc(curDue)}" />
        </div>
      </div>

      <div id="loop-edit-di-fields" ${curMode !== "discussion_item" ? "hidden" : ""} style="display:flex;flex-direction:column;gap:10px;">
        <label class="qc-label" style="margin:0;">Discuss With</label>
        <div class="qc-seg-pills" id="loop-edit-di-target-pills">
          <button type="button" class="qc-seg-pill ${initialDiTarget === "person" ? "active" : ""}" data-ledi="person">1:1 with a Person</button>
          <button type="button" class="qc-seg-pill ${initialDiTarget === "meeting" ? "active" : ""}" data-ledi="meeting">Team / Location Meeting</button>
        </div>
        <input type="hidden" id="loop-edit-di-target-mode" value="${initialDiTarget}" />
        <div id="loop-edit-di-person-wrap" ${initialDiTarget === "meeting" ? "hidden" : ""}>
          <label class="qc-label" for="loop-edit-di-person" style="margin:0 0 4px;display:block;">Person (1:1)</label>
          <select id="loop-edit-di-person" class="apple-input qc-field" style="margin:0;width:100%;">
            <option value="">-- Select a Person --</option>
            ${people
              .map(
                (p) =>
                  `<option value="${esc(p.slug)}" ${curPersonSlug === p.slug ? "selected" : ""}>${esc(p.full_name)} · ${esc(p.role_title || p.location || "")}</option>`
              )
              .join("")}
          </select>
        </div>
        <div id="loop-edit-di-group-wrap" ${initialDiTarget === "person" ? "hidden" : ""}>
          <label class="qc-label" for="loop-edit-di-group" style="margin:0 0 4px;display:block;">Team / Location Meeting</label>
          <select id="loop-edit-di-group" class="apple-input qc-field" style="margin:0;width:100%;">
            <option value="">-- Select a Team Meeting --</option>
            ${teamGroups
              .map(
                (g) =>
                  `<option value="${esc(g.series_key)}" ${curSeriesKey === g.series_key ? "selected" : ""}>${esc(g.name)}</option>`
              )
              .join("")}
          </select>
        </div>
      </div>

      <label class="qc-label" for="loop-edit-why" style="margin:2px 0 0;">Notes &amp; Context</label>
      <textarea id="loop-edit-why" class="apple-input qc-field" rows="3" style="margin:0;" placeholder="Add notes or context...">${esc(item.why_it_matters || "")}</textarea>

      <button type="button" class="btn-primary-pill qc-save-btn" id="btn-loop-save-edits">Save Changes</button>
      <span id="loop-edit-status" class="card-caption" hidden></span>
    </div>
  `;
  window.presentSheetBackdrop();

  const loopReadView = document.getElementById("loop-read-view");
  const formBlock = document.getElementById("loop-edit-form-block");
  const kickerEl = document.getElementById("sheet-kicker");

  document.getElementById("btn-toggle-loop-edit")?.addEventListener("click", () => {
    if (!formBlock || !loopReadView) return;
    loopReadView.hidden = true;
    formBlock.hidden = false;
    if (kickerEl) kickerEl.textContent = "EDIT ITEM";
    triggerListFadeLift(formBlock);
  });

  document.getElementById("btn-loop-cancel-edit")?.addEventListener("click", () => {
    if (!formBlock || !loopReadView) return;
    formBlock.hidden = true;
    loopReadView.hidden = false;
    if (kickerEl) kickerEl.textContent = defaultKicker;
    triggerListFadeLift(loopReadView);
  });

  let selectedMode = curMode;
  const loopFieldsWrap = document.getElementById("loop-edit-loop-fields");
  const diFieldsWrap = document.getElementById("loop-edit-di-fields");
  document.querySelectorAll("#loop-edit-mode-pills .qc-seg-pill").forEach((b) => {
    b.addEventListener("click", () => {
      selectedMode = b.getAttribute("data-lmode") || "open_loop";
      document.querySelectorAll("#loop-edit-mode-pills .qc-seg-pill").forEach((x) => x.classList.toggle("active", x === b));
      if (loopFieldsWrap) loopFieldsWrap.hidden = selectedMode === "discussion_item";
      if (diFieldsWrap) diFieldsWrap.hidden = selectedMode !== "discussion_item";
    });
  });

  const diModeInput = document.getElementById("loop-edit-di-target-mode");
  const diPersonWrap = document.getElementById("loop-edit-di-person-wrap");
  const diGroupWrap = document.getElementById("loop-edit-di-group-wrap");
  document.querySelectorAll("#loop-edit-di-target-pills .qc-seg-pill").forEach((b) => {
    b.addEventListener("click", () => {
      const m = b.getAttribute("data-ledi") || "person";
      if (diModeInput) diModeInput.value = m;
      document.querySelectorAll("#loop-edit-di-target-pills .qc-seg-pill").forEach((x) => x.classList.toggle("active", x === b));
      if (diPersonWrap) diPersonWrap.hidden = m !== "person";
      if (diGroupWrap) diGroupWrap.hidden = m !== "meeting";
    });
  });

  document.getElementById("btn-loop-save-edits")?.addEventListener("click", async () => {
    const newSum = (document.getElementById("loop-edit-summary")?.value || "").trim();
    const newDue = (document.getElementById("loop-edit-due")?.value || "").trim() || null;
    const newWhy = (document.getElementById("loop-edit-why")?.value || "").trim() || null;
    const stEl = document.getElementById("loop-edit-status");
    const saveBtn = document.getElementById("btn-loop-save-edits");
    if (!newSum || !sb) return;
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "Saving..."; }

    const nextMeta = Object.assign({}, item.writeback_payload || item.metadata || {});
    let nextProfileType = item.profile_type || "person";
    let nextProfileSlug = item.profile_slug || "nick-drake";
    let nextWho = item.who_summary || null;

    if (selectedMode === "discussion_item") {
      const diTarget = document.getElementById("loop-edit-di-target-mode")?.value || "person";
      if (diTarget === "meeting") {
        const gKey = document.getElementById("loop-edit-di-group")?.value || curSeriesKey;
        const gObj = teamGroups.find((x) => x.series_key === gKey);
        nextProfileType = gObj?.project_slug ? "project" : "location";
        nextProfileSlug = gObj?.project_slug || gObj?.location || "Central";
        nextWho = gObj?.name || item.who_summary || "Team Meeting";
        nextMeta.series_key = gKey || curSeriesKey;
        nextMeta.bucket = "agenda";
      } else {
        const pSlug = document.getElementById("loop-edit-di-person")?.value || curPersonSlug || "nick-drake";
        const pObj = people.find((x) => x.slug === pSlug);
        const matched1on1 = groups.find((x) => x.person_slug === pSlug && x.group_type === "1on1");
        nextProfileType = "person";
        nextProfileSlug = pSlug;
        nextWho = pObj ? stripPastorPrefix(pObj.full_name) : prettySlug(pSlug);
        nextMeta.series_key = matched1on1?.series_key || `series:1on1-${pSlug}`;
        nextMeta.bucket = "agenda";
      }
    } else {
      const pSlug = document.getElementById("loop-edit-person")?.value || "nick-drake";
      const prSlug = document.getElementById("loop-edit-project")?.value || "";
      const pObj = people.find((x) => x.slug === pSlug);
      nextProfileType = prSlug && pSlug === "nick-drake" ? "project" : "person";
      nextProfileSlug = nextProfileType === "project" ? prSlug : pSlug;
      nextWho = pSlug === "nick-drake" ? "Nick Drake" : (pObj ? stripPastorPrefix(pObj.full_name) : prettySlug(pSlug));
      nextMeta.due_date = newDue;
      nextMeta.bucket = selectedMode === "open_loop" ? "mine" : "theirs";
      nextMeta.project_slug = prSlug || null;
    }

    const { error } = isLegacyDi
      ? await sb
          .from("sb_meeting_discussion_items")
          .update({
            item_text: newSum,
            notes: newWhy
          })
          .eq("id", item.id)
      : await sb
          .from("sb_profile_items")
          .update({
            what_summary: newSum,
            why_it_matters: newWhy,
            who_summary: nextWho,
            profile_type: nextProfileType,
            profile_slug: nextProfileSlug,
            item_type: selectedMode,
            writeback_payload: nextMeta,
            updated_at: new Date().toISOString()
          })
          .eq("id", item.id);

    if (error) {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "Save Changes"; }
      if (stEl) { stEl.hidden = false; stEl.textContent = "Error: " + error.message; }
      return;
    }
    if (stEl) { stEl.hidden = false; stEl.textContent = "Saved ✓"; }
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "Save Changes"; }
    await syncFromSupabase();
    window.openLoopSheet(item.id, true);
    showUndoToast("Updated item", null);
  });
};

window.openMemorySheet = function (memId, fromBack = false) {
  const s = state.sourceItems.find((x) => x.id === memId);
  if (!s) return;
  updateSheetNavSession({ type: "memory", id: memId, label: "Signal", reopen: (b) => window.openMemorySheet(memId, b) }, fromBack);

  document.getElementById("sheet-kicker").textContent = `${s.source_type} · ${fmtShortET(s.occurred_at)}`;
  document.getElementById("sheet-title").textContent = s.source_title;
  document.getElementById("sheet-body").innerHTML = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      ${
        s.source_url
          ? `<a href="${esc(s.source_url)}" target="_blank" rel="noopener" class="btn-primary-pill" style="text-decoration:none;">Open Original Source ↗</a>`
          : ""
      }
      <button
        type="button"
        class="btn-auth-secondary"
        style="width:auto;color:#ff453a;"
        onclick="window.archiveItem('${esc(s.id)}', 'memory'); window.closeSheetAndReset();"
      >
        Archive
      </button>
    </div>
    <div class="detail-block">
      <strong>What Happened</strong>
      ${esc(s.what_summary)}
    </div>
    <div class="detail-block">
      <strong>Why It Matters</strong>
      ${esc(s.why_it_matters)}
    </div>
    <div class="detail-block">
      <strong>Who</strong>
      ${esc(s.who_summary)}
    </div>
  `;
  window.presentSheetBackdrop();
};

window.toggleDiscussionItemStatus = async function (itemId, personSlug = null, meetingEventId = null, seriesKey = null) {
  const profItem = state.profileItems.find((x) => x.id === itemId);
  const diItem = (state.discussionItems || []).find((x) => x.id === itemId);

  if (profItem) {
    await window.toggleLoopItem(itemId);
  } else if (diItem && sb && state.user) {
    const nextDone = !(diItem.status === "done" || diItem.status === "completed");
    diItem.status = nextDone ? "completed" : "open";
    await sb.from("sb_meeting_discussion_items").update({
      status: diItem.status,
      completed_at: nextDone ? new Date().toISOString() : null
    }).eq("id", itemId);
    await syncFromSupabase();
  }

  if (personSlug) {
    const p = state.personProfiles.find((x) => x.slug === personSlug);
    if (p) window.openPersonSheet(personSlug);
  } else if (meetingEventId) {
    window.openMeetingSheet(meetingEventId);
  } else if (seriesKey) {
    window.openMeetingGroupSheet(seriesKey);
  }
};

window.archiveDiscussionTopic = async function (itemId, personSlug = null, seriesKey = null, meetingEventId = null) {
  state.archivedIds[itemId] = true;
  localStorage.setItem("nd_archived_items", JSON.stringify(state.archivedIds));
  const profItem = state.profileItems.find((x) => x.id === itemId);
  if (profItem) profItem.status = "dismissed";
  const diItem = (state.discussionItems || []).find((x) => x.id === itemId);
  if (diItem) diItem.status = "archived";

  if (sb && state.user) {
    try {
      await Promise.all([
        sb.rpc("set_profile_item_status", { p_item_id: String(itemId), p_status: "dismissed" }),
        sb.from("sb_meeting_discussion_items").update({ status: "archived" }).eq("id", String(itemId))
      ]);
    } catch (_) {}
  }
  updateDynamicCounts();
  renderAll();
  if (personSlug) window.openPersonSheet(personSlug);
  else if (seriesKey) window.openMeetingGroupSheet(seriesKey);
  else if (meetingEventId) window.openMeetingSheet(meetingEventId);
  showUndoToast("Removed discussion topic", null);
};

window.openPersonSheet = function (slug, fromBack = false) {
  const p = state.personProfiles.find((x) => x.slug === slug);
  if (!p) return;
  const rawFull = stripPastorPrefix((p.full_name || "them").trim());
  const firstName = rawFull.split(/\s+/)[0];
  if (!fromBack && (!state.currentSheet || state.currentSheet.id !== slug)) {
    state.personSheetTab = "topics";
  }
  const activeSeg = state.personSheetTab || "topics";
  updateSheetNavSession(
    { type: "person", id: slug, label: firstName, reopen: (b) => window.openPersonSheet(slug, b) },
    fromBack
  );

  const discussionTopics = getPersonDiscussionTopics(p.slug);
  const openTopicsCount = discussionTopics.filter((i) => !isItemConverted(i)).length;
  const actionLoops = getPersonActionLoops(p.slug);
  const openLoopsCount = actionLoops.filter((i) => !isItemConverted(i)).length;
  const recent = Array.isArray(p.recent_context) ? p.recent_context : [];

  const relatedMeetings = (state.meetingGroups || []).filter(
    (g) =>
      g.is_active !== false &&
      g.group_type !== "1on1" &&
      (g.person_slug === p.slug ||
        (p.location && p.location !== "Central" && (g.location || "").includes(p.location)))
  );

  const cleanTopicSub = (item) => {
    const why = String(item.why_it_matters || "").trim();
    if (
      !why ||
      why.toLowerCase() === `1:1 · ${rawFull.toLowerCase()}` ||
      why.toLowerCase() === rawFull.toLowerCase() ||
      why.toLowerCase() === "1:1 discussion topic" ||
      why.toLowerCase().startsWith("priority normal task")
    ) {
      return "";
    }
    return why;
  };

  document.getElementById("sheet-kicker").textContent = `${p.location || "Central"} · ${p.role_title}`;
  document.getElementById("sheet-title").textContent = rawFull;

  document.getElementById("sheet-body").innerHTML = `
    <div class="qc-seg-bar" id="person-sheet-seg" style="margin:0 0 8px;">
      <button type="button" class="qc-seg-pill ${activeSeg === "topics" ? "active" : ""}" data-pseg="topics">1:1 Topics (${openTopicsCount})</button>
      <button type="button" class="qc-seg-pill ${activeSeg === "loops" ? "active" : ""}" data-pseg="loops">Loops (${openLoopsCount})</button>
      <button type="button" class="qc-seg-pill ${activeSeg === "notes" ? "active" : ""}" data-pseg="notes">Notes</button>
    </div>

    <div id="person-seg-topics" ${activeSeg === "topics" ? "" : "hidden"}>
      <div class="ios-grouped-list">
        <div class="person-di-composer">
          <input
            type="text"
            id="person-di-input"
            class="apple-input"
            placeholder="Add a 1:1 topic for ${esc(firstName)}..."
          />
          <button type="button" class="btn-primary-pill" id="btn-person-di-add">+ Add</button>
        </div>
        <div id="person-di-list" class="ios-topic-reorder-list">
          ${
            discussionTopics.length
              ? discussionTopics
                  .map((item) => {
                    const converted = isItemConverted(item);
                    const sub = cleanTopicSub(item);
                    return `
                      <div class="ios-row ios-topic-row ${converted ? "completed" : ""} ${isJustAddedItem(item) ? "ios-row-just-added" : ""}" data-topic-id="${esc(item.id)}" onclick="window.openLoopSheet('${esc(item.id)}')">
                        <button
                          type="button"
                          class="ios-check ${converted ? "checked" : ""}"
                          aria-label="${converted ? "Mark open" : "Mark discussed"}"
                          onclick="event.stopPropagation(); window.toggleDiscussionItemStatus('${esc(item.id)}', '${esc(p.slug)}')"
                        >${converted ? "✓" : ""}</button>
                        <div class="ios-row-main">
                          <div class="ios-row-title">${esc(item.what_summary)}</div>
                          ${sub ? `<div class="ios-row-sub">${esc(sub)}</div>` : ""}
                        </div>
                        <div class="ios-row-right">
                          
                          <span class="ios-chevron">›</span>
                        </div>
                      </div>
                    `;
                  })
                  .join("")
              : `<div class="empty-row">No 1:1 topics for ${esc(firstName)}.</div>`
          }
        </div>
      </div>
    </div>

    <div id="person-seg-loops" ${activeSeg === "loops" ? "" : "hidden"}>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding:0 2px;">
        <span class="sheet-kicker">NEW ITEM OWNER</span>
        <div class="inline-mini-seg" id="person-loop-bucket-seg">
          <button type="button" class="inline-mini-pill active" data-plb="waiting">Waiting on ${esc(firstName)}</button>
          <button type="button" class="inline-mini-pill" data-plb="mine">My Loop</button>
        </div>
      </div>
      <div class="ios-grouped-list ios-topic-reorder-list" id="person-loops-list">
        <div class="person-di-composer">
          <input
            type="text"
            id="person-loop-input"
            class="apple-input"
            placeholder="Add waiting on ${esc(firstName)}..."
          />
          <button type="button" class="btn-primary-pill" id="btn-person-loop-add">+ Add</button>
        </div>
        ${
          actionLoops.length
            ? actionLoops.map((i) => renderLoopItemRow(i, p.slug)).join("")
            : `<div class="empty-row">No open loops with ${esc(firstName)}.</div>`
        }
      </div>
    </div>

    <div id="person-seg-notes" ${activeSeg === "notes" ? "" : "hidden"}>
      <div class="detail-block">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:4px;">
          <strong style="margin:0;">Coaching Notes &amp; Current Focus</strong>
          <button type="button" class="btn-task" id="btn-toggle-person-edit">Edit Notes</button>
        </div>
        <div id="person-notes-read-view">
          <div style="margin-top:4px;"><span style="color:var(--text-muted);font-size:11.5px;font-weight:600;text-transform:uppercase;">Current Focus:</span><br/>${esc(p.what_current_focus || "No current focus set.")}</div>
          <div style="margin-top:10px;"><span style="color:var(--text-muted);font-size:11.5px;font-weight:600;text-transform:uppercase;">1:1 Coaching Notes:</span><br/><span style="white-space:pre-wrap;">${esc(p.communication_and_coaching_notes || "No coaching notes yet. Tap Edit Notes to add.")}</span></div>
          <div style="margin-top:10px;"><span style="color:var(--text-muted);font-size:11.5px;font-weight:600;text-transform:uppercase;">Role &amp; Bio:</span><br/>${esc(p.who_they_are || "")}</div>
        </div>
        <div id="person-notes-edit-view" hidden style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">
          <label class="qc-label" for="person-edit-focus" style="margin:0;">Current Focus</label>
          <textarea id="person-edit-focus" class="apple-input qc-field" rows="2" style="margin:0;">${esc(p.what_current_focus || "")}</textarea>
          <label class="qc-label" for="person-edit-coaching" style="margin:2px 0 0;">1:1 Coaching Notes</label>
          <textarea id="person-edit-coaching" class="apple-input qc-field" rows="4" style="margin:0;">${esc(p.communication_and_coaching_notes || "")}</textarea>
          <label class="qc-label" for="person-edit-who" style="margin:2px 0 0;">Role &amp; Context</label>
          <textarea id="person-edit-who" class="apple-input qc-field" rows="2" style="margin:0;">${esc(p.who_they_are || "")}</textarea>
          <div style="display:flex;align-items:center;gap:8px;margin-top:4px;">
            <button type="button" class="btn-primary-pill qc-save-btn" id="btn-save-person-notes">Save Notes</button>
            <span id="person-edit-status" class="card-caption" hidden></span>
          </div>
        </div>
      </div>
      ${
        relatedMeetings.length
          ? `<div class="detail-block" style="margin-top:10px;">
              <strong>Shared Location Meetings</strong>
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">
                ${relatedMeetings
                  .map(
                    (g) =>
                      `<button type="button" class="btn-task" onclick="window.openMeetingGroupSheet('${esc(g.series_key)}')">🗓 ${esc(g.name)} (${getMeetingSeriesDiscussionTopics(g.series_key).filter((i) => !isItemConverted(i)).length}) ›</button>`
                  )
                  .join("")}
              </div>
            </div>`
          : ""
      }
      ${
        recent.length
          ? `<div class="detail-block" style="margin-top:10px;">
              <strong>Recent Signals</strong>
              ${recent
                .map(
                  (c) => `<div style="margin-top:6px;">• <span style="color:var(--text-sec);">${esc(c.date)}</span>: ${esc(c.summary)}</div>`
                )
                .join("")}
            </div>`
          : ""
      }
    </div>
  `;
  window.presentSheetBackdrop();

  document.querySelectorAll("#person-sheet-seg .qc-seg-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      const seg = btn.getAttribute("data-pseg") || "topics";
      state.personSheetTab = seg;
      document.querySelectorAll("#person-sheet-seg .qc-seg-pill").forEach((x) => x.classList.toggle("active", x === btn));
      const tEl = document.getElementById("person-seg-topics");
      const lEl = document.getElementById("person-seg-loops");
      const nEl = document.getElementById("person-seg-notes");
      if (tEl) tEl.hidden = seg !== "topics";
      if (lEl) lEl.hidden = seg !== "loops";
      if (nEl) nEl.hidden = seg !== "notes";
      const activePanel = seg === "topics" ? tEl : seg === "loops" ? lEl : nEl;
      if (activePanel) triggerListFadeLift(activePanel);
    });
  });

  const submitPersonTopic = async () => {
    const inputEl = document.getElementById("person-di-input");
    const addBtn = document.getElementById("btn-person-di-add");
    const txt = (inputEl?.value || "").trim();
    if (!txt || !sb) return;
    if (inputEl) inputEl.disabled = true;
    if (addBtn) {
      addBtn.disabled = true;
      addBtn.textContent = "Saving...";
    }
    const person1on1Group = (state.meetingGroups || []).find(
      (g) => g.person_slug === p.slug && g.group_type === "1on1"
    );
    const seriesKey = person1on1Group ? person1on1Group.series_key : `series:1on1-${p.slug}`;
    const { error } = await sb.rpc("create_profile_item", {
      p_profile_type: "person",
      p_profile_slug: p.slug,
      p_item_type: "discussion_item",
      p_what_summary: txt,
      p_why_it_matters: `1:1 · ${rawFull}`,
      p_who_summary: rawFull,
      p_bucket: "agenda",
      p_series_key: seriesKey
    });
    if (error) {
      if (inputEl) inputEl.disabled = false;
      if (addBtn) {
        addBtn.disabled = false;
        addBtn.textContent = "+ Add";
      }
      alert("Error adding discussion topic: " + error.message);
      return;
    }
    await syncFromSupabase();
    window.openPersonSheet(p.slug, true);
    showUndoToast(`Added discussion topic for ${firstName}`, null);
  };

  document.getElementById("btn-person-di-add")?.addEventListener("click", submitPersonTopic);
  document.getElementById("person-di-input")?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      submitPersonTopic();
    }
  });

  let personLoopBucket = "waiting";
  document.querySelectorAll("#person-loop-bucket-seg .inline-mini-pill").forEach((b) => {
    b.addEventListener("click", () => {
      personLoopBucket = b.getAttribute("data-plb") || "waiting";
      document.querySelectorAll("#person-loop-bucket-seg .inline-mini-pill").forEach((x) => x.classList.toggle("active", x === b));
      const lInp = document.getElementById("person-loop-input");
      if (lInp) {
        lInp.placeholder =
          personLoopBucket === "mine"
            ? `Add my open loop for ${firstName}...`
            : `Add waiting on ${firstName}...`;
      }
    });
  });

  const submitPersonLoop = async () => {
    const lInp = document.getElementById("person-loop-input");
    const lBtn = document.getElementById("btn-person-loop-add");
    const txt = (lInp?.value || "").trim();
    if (!txt || !sb) return;
    if (lInp) lInp.disabled = true;
    if (lBtn) { lBtn.disabled = true; lBtn.textContent = "Saving..."; }
    const { error } = await sb.rpc("create_profile_item", {
      p_profile_type: "person",
      p_profile_slug: p.slug,
      p_item_type: personLoopBucket === "mine" ? "open_loop" : "waiting_on",
      p_what_summary: txt,
      p_why_it_matters: rawFull,
      p_who_summary: rawFull,
      p_bucket: personLoopBucket
    });
    if (error) {
      if (lInp) lInp.disabled = false;
      if (lBtn) { lBtn.disabled = false; lBtn.textContent = "+ Add"; }
      alert("Error adding loop: " + error.message);
      return;
    }
    await syncFromSupabase();
    window.openPersonSheet(p.slug, true);
    showUndoToast(`Added loop for ${firstName}`, null);
  };
  document.getElementById("btn-person-loop-add")?.addEventListener("click", submitPersonLoop);
  document.getElementById("person-loop-input")?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      submitPersonLoop();
    }
  });

  document.getElementById("btn-toggle-person-edit")?.addEventListener("click", () => {
    const readView = document.getElementById("person-notes-read-view");
    const editView = document.getElementById("person-notes-edit-view");
    const btn = document.getElementById("btn-toggle-person-edit");
    if (!readView || !editView) return;
    const showingEdit = !editView.hidden;
    editView.hidden = showingEdit;
    readView.hidden = !showingEdit;
    if (btn) btn.textContent = showingEdit ? "Edit Notes" : "Cancel";
  });

  document.getElementById("btn-save-person-notes")?.addEventListener("click", async () => {
    const newFocus = (document.getElementById("person-edit-focus")?.value || "").trim();
    const newCoach = (document.getElementById("person-edit-coaching")?.value || "").trim();
    const newWho = (document.getElementById("person-edit-who")?.value || "").trim();
    const saveBtn = document.getElementById("btn-save-person-notes");
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "Saving..."; }
    const { error } = await sb
      .from("sb_person_profiles")
      .update({
        what_current_focus: newFocus,
        communication_and_coaching_notes: newCoach,
        who_they_are: newWho,
        updated_at: new Date().toISOString()
      })
      .eq("slug", p.slug);
    if (error) {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "Save Notes"; }
      alert("Error saving profile notes: " + error.message);
      return;
    }
    await syncFromSupabase();
    window.openPersonSheet(p.slug, true);
    showUndoToast(`Saved notes for ${firstName}`, null);
  });
};

window.openProjectSheet = function (slug, fromBack = false) {
  const pr = state.projectProfiles.find((x) => x.slug === slug);
  if (!pr) return;
  updateSheetNavSession(
    {
      type: "project",
      id: slug,
      label: pr.name || "Project",
      reopen: (b) => window.openProjectSheet(slug, b)
    },
    fromBack
  );
  const items = sortMineLoops(
    state.profileItems.filter(
      (i) =>
        ((i.profile_type === "project" && i.profile_slug === pr.slug) ||
          i.project_slug === pr.slug ||
          (i.writeback_payload || {}).project_slug === pr.slug) &&
        !isItemArchived(i) &&
        !isItemConverted(i)
    ),
    getTodayETString()
  );

  const activeProjSeg = state.projectSheetSeg || "tasks";
  document.getElementById("sheet-kicker").textContent = `${pr.location || "Central"} · ${pr.category}`;
  document.getElementById("sheet-title").textContent = pr.name;
  document.getElementById("sheet-body").innerHTML = `
    <div class="qc-seg-bar person-sheet-seg" id="project-sheet-seg" role="tablist" style="margin:0 0 8px;">
      <button type="button" class="qc-seg-pill ${activeProjSeg === "tasks" ? "active" : ""}" data-prseg="tasks">
        Tasks (${items.length})
      </button>
      <button type="button" class="qc-seg-pill ${activeProjSeg === "overview" ? "active" : ""}" data-prseg="overview">
        Overview
      </button>
    </div>

    <div id="project-seg-panel-tasks" ${activeProjSeg === "tasks" ? "" : "hidden"}>
      <div class="ios-grouped-list ios-topic-reorder-list" id="project-loops-list">
        <div class="person-di-composer">
          <input
            type="text"
            id="project-loop-input"
            class="apple-input"
            placeholder="Add a task to ${esc(pr.name)}..."
          />
          <button type="button" class="btn-primary-pill" id="btn-project-loop-add">+ Add</button>
        </div>
        ${items.length ? items.map((i) => renderLoopItemRow(i)).join("") : `<div style="padding:14px;color:var(--text-sec);font-size:13px;">No open tasks for this project yet.</div>`}
      </div>
    </div>

    <div id="project-seg-panel-overview" class="detail-block" ${activeProjSeg === "overview" ? "" : "hidden"}>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:4px;">
        <strong style="margin:0;">Project Summary &amp; Context</strong>
        <button type="button" class="btn-task" id="btn-toggle-project-edit">Edit Details</button>
      </div>
      <div id="project-details-read-view">
        <div style="margin-top:4px;"><span style="color:var(--text-muted);font-size:11.5px;font-weight:600;text-transform:uppercase;">Summary:</span><br/>${esc(pr.what_summary || "")}</div>
        <div style="margin-top:10px;"><span style="color:var(--text-muted);font-size:11.5px;font-weight:600;text-transform:uppercase;">Why It Matters:</span><br/>${esc(pr.why_it_matters || "")}</div>
        <div style="margin-top:10px;"><span style="color:var(--text-muted);font-size:11.5px;font-weight:600;text-transform:uppercase;">People Involved:</span><br/>${esc(pr.who_summary || "")}</div>
      </div>
      <div id="project-details-edit-view" hidden style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">
        <label class="qc-label" for="project-edit-what" style="margin:0;">Summary</label>
        <textarea id="project-edit-what" class="apple-input qc-field" rows="2" style="margin:0;">${esc(pr.what_summary || "")}</textarea>
        <label class="qc-label" for="project-edit-why" style="margin:2px 0 0;">Why It Matters</label>
        <textarea id="project-edit-why" class="apple-input qc-field" rows="2" style="margin:0;">${esc(pr.why_it_matters || "")}</textarea>
        <label class="qc-label" for="project-edit-who" style="margin:2px 0 0;">People Involved</label>
        <input type="text" id="project-edit-who" class="apple-input qc-field" style="margin:0;" value="${esc(pr.who_summary || "")}" />
        <div style="display:flex;flex-direction:column;gap:6px;margin-top:4px;">
          <button type="button" class="btn-primary-pill qc-save-btn" id="btn-save-project-details">Save Project Details</button>
        </div>
      </div>
    </div>
  `;
  window.presentSheetBackdrop();

  document.querySelectorAll("#project-sheet-seg .qc-seg-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      const seg = btn.getAttribute("data-prseg") || "tasks";
      state.projectSheetSeg = seg;
      document.querySelectorAll("#project-sheet-seg .qc-seg-pill").forEach((b) => b.classList.toggle("active", b === btn));
      const pTasks = document.getElementById("project-seg-panel-tasks");
      const pOver = document.getElementById("project-seg-panel-overview");
      if (pTasks) pTasks.hidden = seg !== "tasks";
      if (pOver) pOver.hidden = seg !== "overview";
      triggerListFadeLift(seg === "tasks" ? pTasks : pOver);
    });
  });

  document.getElementById("btn-toggle-project-edit")?.addEventListener("click", () => {
    const readV = document.getElementById("project-details-read-view");
    const editV = document.getElementById("project-details-edit-view");
    const btn = document.getElementById("btn-toggle-project-edit");
    if (!readV || !editV) return;
    const isShowing = !editV.hidden;
    editV.hidden = isShowing;
    readV.hidden = !isShowing;
    if (btn) btn.textContent = isShowing ? "Edit Details" : "Cancel";
  });

  document.getElementById("btn-save-project-details")?.addEventListener("click", async () => {
    const newWhat = (document.getElementById("project-edit-what")?.value || "").trim();
    const newWhy = (document.getElementById("project-edit-why")?.value || "").trim();
    const newWho = (document.getElementById("project-edit-who")?.value || "").trim();
    const saveBtn = document.getElementById("btn-save-project-details");
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "Saving..."; }
    const { error } = await sb
      .from("sb_project_profiles")
      .update({
        what_summary: newWhat,
        why_it_matters: newWhy,
        who_summary: newWho,
        updated_at: new Date().toISOString()
      })
      .eq("slug", pr.slug);
    if (error) {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "Save Project Details"; }
      alert("Error saving project details: " + error.message);
      return;
    }
    await syncFromSupabase();
    window.openProjectSheet(slug, true);
    showUndoToast(`Saved details for ${pr.name}`, null);
  });

  const submitProjectLoop = async () => {
    const inp = document.getElementById("project-loop-input");
    const btn = document.getElementById("btn-project-loop-add");
    const txt = (inp?.value || "").trim();
    if (!txt || !sb) return;
    if (inp) inp.disabled = true;
    if (btn) { btn.disabled = true; btn.textContent = "Saving..."; }
    const { error } = await sb.rpc("create_profile_item", {
      p_profile_type: "project",
      p_profile_slug: pr.slug,
      p_item_type: "open_loop",
      p_what_summary: txt,
      p_why_it_matters: pr.name,
      p_who_summary: "Nick Drake",
      p_bucket: "mine",
      p_project_slug: pr.slug
    });
    if (error) {
      if (inp) inp.disabled = false;
      if (btn) { btn.disabled = false; btn.textContent = "+ Add"; }
      alert("Error adding project task: " + error.message);
      return;
    }
    await syncFromSupabase();
    window.openProjectSheet(slug, true);
    showUndoToast("Added task to " + pr.name, null);
  };
  document.getElementById("btn-project-loop-add")?.addEventListener("click", submitProjectLoop);
  document.getElementById("project-loop-input")?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      submitProjectLoop();
    }
  });
};


/* ===== s9: WebAuthn Passkeys (Face ID / Touch ID) ===== */
const OWNER_AUTH_URL = SUPABASE_URL + "/functions/v1/owner-auth";
function b64urlToUint8Array(b64url) {
  const b64 = String(b64url).replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bufferToB64url(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
let _prefetchedLoginOpts = null;
let _prefetchedLoginOptsTs = 0;
let _prefetchedRegisterOpts = null;
let _prefetchedRegisterOptsTs = 0;
let _passkeyInFlight = false;

async function ownerAuthCall(action, extra = {}, withJwt = false) {
  const headers = { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY };
  let bearer = SUPABASE_ANON_KEY;
  if (withJwt && sb) {
    const { data } = await sb.auth.getSession();
    if (data?.session?.access_token) bearer = data.session.access_token;
  }
  headers.Authorization = "Bearer " + bearer;
  const res = await fetch(OWNER_AUTH_URL, {
    method: "POST", headers,
    body: JSON.stringify({ action, rp_id: location.hostname || "nickdrake.ai", ...extra })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(json.error || "Request failed (" + res.status + ")");
  return json;
}

function setPasskeyGateStatus(msg, type = "info") {
  const el = document.getElementById("auth-passkey-status");
  if (el) {
    if (!msg) {
      el.hidden = true;
      el.textContent = "";
      el.className = "auth-status-msg";
    } else {
      el.hidden = false;
      el.textContent = msg;
      el.className = `auth-status-msg status-${type}`;
    }
  }
  setAuthStatus(msg, type);
}

async function prefetchPasskeyLoginOptions() {
  try {
    const opts = await ownerAuthCall("passkey_login_options");
    if (opts?.challenge) {
      _prefetchedLoginOpts = opts;
      _prefetchedLoginOptsTs = Date.now();
    }
  } catch (_) {}
}

async function prefetchPasskeyRegisterOptions() {
  try {
    if (!sb) return;
    const { data } = await sb.auth.getSession();
    if (!data?.session?.access_token) return;
    const opts = await ownerAuthCall("passkey_register_options", {}, true);
    if (opts?.challenge) {
      _prefetchedRegisterOpts = opts;
      _prefetchedRegisterOptsTs = Date.now();
    }
  } catch (_) {}
}

async function signInWithPasskey() {
  if (_passkeyInFlight) return;
  const btn = document.getElementById("btn-auth-passkey");
  const lbl = document.getElementById("btn-auth-passkey-label");
  if (!window.PublicKeyCredential) {
    setPasskeyGateStatus("This browser does not support Face ID / Touch ID passkeys.", "error");
    return;
  }
  _passkeyInFlight = true;
  const origLabel = lbl ? lbl.textContent : "Sign in with Face ID / Touch ID";
  try {
    if (btn) btn.disabled = true;
    if (lbl) lbl.textContent = "Opening Face ID / Touch ID...";
    setPasskeyGateStatus("Waiting for Face ID / Touch ID...");

    let opts = (_prefetchedLoginOpts && (Date.now() - _prefetchedLoginOptsTs < 240000)) ? _prefetchedLoginOpts : null;
    _prefetchedLoginOpts = null;
    if (!opts) {
      opts = await ownerAuthCall("passkey_login_options");
    }
    if (opts && opts.hasRegisteredPasskeys === false) {
      setPasskeyGateStatus("No Face ID / Touch ID passkey registered yet. Sign in once below, then tap 'Face ID' in the top bar to enable it.", "error");
      prefetchPasskeyLoginOptions();
      return;
    }

    const cred = await navigator.credentials.get({ publicKey: {
      challenge: b64urlToUint8Array(opts.challenge),
      rpId: opts.rpId || location.hostname,
      userVerification: "preferred",
      timeout: 60000,
      allowCredentials: (opts.allowCredentials || []).map((c) => ({ type: "public-key", id: b64urlToUint8Array(c.id) }))
    }});
    if (!cred) throw new Error("Passkey cancelled.");
    if (lbl) lbl.textContent = "Verifying...";
    setPasskeyGateStatus("Verifying Face ID / Touch ID...");
    const r = cred.response;
    const out = await ownerAuthCall("passkey_login_verify", {
      credential_id: bufferToB64url(cred.rawId),
      client_data_json: bufferToB64url(r.clientDataJSON),
      authenticator_data: bufferToB64url(r.authenticatorData),
      signature: bufferToB64url(r.signature),
      user_handle: r.userHandle ? bufferToB64url(r.userHandle) : null
    });
    let session = null;
    if (out.access_token && out.refresh_token) {
      const { data, error } = await sb.auth.setSession({ access_token: out.access_token, refresh_token: out.refresh_token });
      if (error) throw error;
      session = data.session;
    } else if (out.token_hash) {
      const { data, error } = await sb.auth.verifyOtp({ token_hash: out.token_hash, type: out.verification_type || "magiclink" });
      if (error) throw error;
      session = data.session;
    } else throw new Error("No session returned.");
    setPasskeyGateStatus("Signed in with Face ID / Touch ID.", "success");
    await handleSessionChange(session);
  } catch (e) {
    prefetchPasskeyLoginOptions();
    const isCancelOrMissing = e?.name === "NotAllowedError" || /not allowed|cancelled|canceled/i.test(String(e?.message || ""));
    if (isCancelOrMissing) {
      setPasskeyGateStatus("Face ID isn't enabled on this device yet (or was cancelled). Sign in once below, then tap 'Face ID' in the top bar to enable Face ID here.", "error");
    } else {
      setPasskeyGateStatus(e?.message || String(e), "error");
    }
  } finally {
    _passkeyInFlight = false;
    if (btn) btn.disabled = false;
    if (lbl) lbl.textContent = origLabel;
  }
}

async function registerPasskey() {
  if (!window.PublicKeyCredential) { alert("This browser does not support passkeys."); return false; }
  let opts = (_prefetchedRegisterOpts && (Date.now() - _prefetchedRegisterOptsTs < 240000)) ? _prefetchedRegisterOpts : null;
  _prefetchedRegisterOpts = null;
  if (!opts) {
    opts = await ownerAuthCall("passkey_register_options", {}, true);
  }
  const cred = await navigator.credentials.create({ publicKey: {
    challenge: b64urlToUint8Array(opts.challenge),
    rp: opts.rp,
    user: { ...opts.user, id: b64urlToUint8Array(opts.user.id) },
    pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: "platform", residentKey: "preferred", userVerification: "preferred" },
    excludeCredentials: (opts.existingCredentials || []).map((c) => ({ type: "public-key", id: b64urlToUint8Array(c.id) })),
    attestation: "none",
    timeout: 60000
  }});
  const r = cred.response;
  const spki = typeof r.getPublicKey === "function" ? r.getPublicKey() : null;
  const authData = typeof r.getAuthenticatorData === "function" ? r.getAuthenticatorData() : null;
  await ownerAuthCall("passkey_register_verify", {
    credential_id: bufferToB64url(cred.rawId),
    client_data_json: bufferToB64url(r.clientDataJSON),
    authenticator_data: authData ? bufferToB64url(authData) : "",
    public_key_spki: spki ? bufferToB64url(spki) : "",
    transports: typeof r.getTransports === "function" ? r.getTransports() : ["internal", "hybrid"],
    device_label: /iPhone|iPad/.test(navigator.userAgent) ? "iPhone Face ID" : /Mac/.test(navigator.userAgent) ? "Mac Touch ID" : "Face ID / Touch ID"
  }, true);
  localStorage.setItem("nd_passkey_registered", "1");
  prefetchPasskeyRegisterOptions();
  return true;
}

async function triggerTopbarPasskey() {
  openAuthSheet();
  const st = document.getElementById("sheet-pk-status");
  if (st) {
    st.hidden = false;
    st.textContent = "Follow the Face ID / Touch ID prompt...";
  }
  try {
    await registerPasskey();
    if (st) st.textContent = "Face ID / Touch ID enabled on this device! Next time tap 'Sign in with Face ID / Touch ID'.";
    showUndoToast("Face ID / Touch ID enabled!", null);
    renderPasskeyManager();
  } catch (e) {
    prefetchPasskeyRegisterOptions();
    if (e?.name === "InvalidStateError" || /invalid state/i.test(String(e?.message || e))) {
      localStorage.setItem("nd_passkey_registered", "1");
      if (st) st.textContent = "✓ Passkey is already active on this device via iCloud Keychain / Apple Passwords. You can sign in with Face ID / Touch ID immediately.";
    } else if (st) {
      st.textContent = e?.name === "NotAllowedError" ? "Tap 'Enable Face ID / Touch ID on this device' above to launch Face ID." : "Error: " + (e?.message || e);
    }
  }
}

window.signInWithPasskey = signInWithPasskey;
window.registerPasskey = registerPasskey;
window.triggerTopbarPasskey = triggerTopbarPasskey;
async function renderPasskeyManager() {
  const box = document.getElementById("sheet-passkey-list");
  if (!box) return;
  try {
    const out = await ownerAuthCall("passkey_list", {}, true);
    const creds = out.credentials || [];
    box.innerHTML = creds.length ? creds.map((c) => `<div class="pk-row"><span>🔐 ${esc(c.device_label || "Passkey")}<br><small style="color:var(--text-sec)">${esc(fmtShortET(c.last_used_at || c.created_at))}</small></span><button type="button" class="btn-auth-secondary" style="width:auto;padding:4px 10px;" data-pk-del="${esc(c.id)}">Remove</button></div>`).join("") : `<div class="empty-row">No passkeys yet.</div>`;
    box.querySelectorAll("[data-pk-del]").forEach((b) => b.addEventListener("click", async () => {
      if (!confirm("Remove this passkey?")) return;
      await ownerAuthCall("passkey_delete", { credential_id: b.getAttribute("data-pk-del") }, true);
      renderPasskeyManager();
    }));
  } catch (e) { box.innerHTML = `<div class="empty-row">${esc(e.message)}</div>`; }
}


/* ===== s9: Notes, Reminders check-off, Quick Create ===== */
function renderNotesView() {
  const el = document.getElementById("notes-list");
  if (!el) return;
  const q = (document.getElementById("notes-filter-input")?.value || "").trim().toLowerCase();
  const catFilter = state.noteCat || "ALL";
  const notes = state.journal.filter((j) => {
    if (catFilter !== "ALL") {
      const catStr = `${j.category || ""} ${j.tags || ""}`.toLowerCase();
      if (catFilter === "Quick Note" && !catStr.includes("quick")) return false;
      if (catFilter === "Leadership" && !catStr.includes("leader") && !catStr.includes("decision") && !catStr.includes("strategy")) return false;
      if (catFilter === "Coaching" && !catStr.includes("1:1") && !catStr.includes("coach") && !catStr.includes("pastoral") && !j.person) return false;
    }
    if (q && !`${j.category} ${j.summary} ${j.details} ${j.entry} ${j.person}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const cnt = document.getElementById("side-count-notes");
  if (cnt) cnt.textContent = state.journal.length;
  el.innerHTML = notes.length
    ? notes
        .map((j) => {
          const title = j.summary || j.entry || j.details || "(Untitled note)";
          const bodyPreview = j.details && j.details !== title ? j.details : "";
          const metaLine = [j.category || "Note", j.entry_date, j.person].filter(Boolean).join(" · ");
          return `<div class="ios-row" onclick="window.openNoteSheet('${esc(j.id)}')">
            <div class="ios-row-main">
              <div class="ios-row-title">${esc(title)}</div>
              <div class="ios-row-sub">${esc(metaLine)}</div>
              ${bodyPreview ? `<div class="note-row-preview">${esc(bodyPreview)}</div>` : ""}
            </div>
            <div class="ios-row-right">
              <span class="ios-chevron">›</span>
            </div>
          </div>`;
        })
        .join("")
    : `<div class="empty-row">No matching notes found.</div>`;
}

window.openNoteSheet = function (noteId, fromBack = false) {
  const j = state.journal.find((x) => String(x.id) === String(noteId));
  if (!j) return;
  updateSheetNavSession(
    {
      type: "note",
      id: noteId,
      label: "Note",
      reopen: (b) => window.openNoteSheet(noteId, b)
    },
    fromBack
  );
  const fullBody = j.details || j.entry || j.summary || "";
  const curCat = j.category || "Quick Note";
  const defaultKicker = `${curCat.toUpperCase()} · ${j.entry_date || j.date || "NOTE"}`;
  const people = [...state.personProfiles.filter((p) => !isAiBotProfile(p))].sort((a, b) =>
    String(a.full_name || "").localeCompare(String(b.full_name || ""))
  );
  const linkedPersonObj = j.person
    ? state.personProfiles.find(
        (p) =>
          p.slug === j.person ||
          p.full_name === j.person ||
          stripPastorPrefix(p.full_name) === j.person
      )
    : null;
  const stdNoteCats = [
    "Quick Note",
    "1:1 / Coaching",
    "Meeting Note",
    "Sermon / Teaching Idea",
    "Leadership"
  ];
  const catOptions = stdNoteCats.includes(curCat) ? stdNoteCats : [curCat, ...stdNoteCats];
  const hasCustomPerson = Boolean(
    j.person &&
      !people.some(
        (p) => p.full_name === j.person || p.slug === j.person || stripPastorPrefix(p.full_name) === j.person
      )
  );

  document.getElementById("sheet-kicker").textContent = defaultKicker;
  document.getElementById("sheet-title").textContent = j.summary || "Note";
  document.getElementById("sheet-body").innerHTML = `
    <div id="note-read-view" style="display:flex;flex-direction:column;gap:12px;">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <button type="button" class="btn-primary-pill" id="btn-toggle-note-edit" style="width:auto;padding:7px 14px;">Edit Note</button>
        ${
          linkedPersonObj
            ? `<button type="button" class="btn-task" onclick="window.openPersonSheet('${esc(linkedPersonObj.slug)}')">👤 ${esc(stripPastorPrefix(linkedPersonObj.full_name))} ›</button>`
            : j.person
            ? `<span class="meta-pill">👤 ${esc(j.person)}</span>`
            : ""
        }
        <span class="meta-pill">${esc(curCat)}</span>
        <button type="button" class="btn-auth-secondary" id="btn-delete-note" style="width:auto;color:#ff453a;margin-left:auto;padding:6px 12px;">Delete</button>
      </div>
      <div class="detail-block" style="white-space:pre-wrap;line-height:1.55;font-size:14px;">${esc(fullBody || "(Empty note)")}</div>
    </div>

    <div class="qc-form-main" id="note-edit-form-block" hidden style="display:flex;flex-direction:column;gap:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <button type="button" class="btn-task" id="btn-cancel-note-edit">‹ Cancel</button>
        <button type="button" class="btn-auth-secondary" id="btn-note-delete" style="width:auto;color:#ff453a;padding:5px 12px;font-size:12px;">Delete Note</button>
      </div>
      <label class="qc-label" for="note-edit-title" style="margin:0;">Title / Summary</label>
      <input type="text" id="note-edit-title" class="apple-input qc-field" style="margin:0;" value="${esc(j.summary || "")}" placeholder="Note title..." />

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div>
          <label class="qc-label" for="note-edit-cat" style="margin:0 0 4px;display:block;">Category</label>
          <select id="note-edit-cat" class="apple-input qc-field" style="margin:0;width:100%;">
            ${catOptions
              .map((c) => `<option value="${esc(c)}" ${c === curCat ? "selected" : ""}>${esc(c)}</option>`)
              .join("")}
          </select>
        </div>
        <div>
          <label class="qc-label" for="note-edit-person" style="margin:0 0 4px;display:block;">Person (optional)</label>
          <select id="note-edit-person" class="apple-input qc-field" style="margin:0;width:100%;">
            <option value="">-- No Person --</option>
            ${hasCustomPerson ? `<option value="${esc(j.person)}" selected>${esc(j.person)}</option>` : ""}
            ${people
              .map((p) => {
                const isSel =
                  j.person &&
                  (p.full_name === j.person || p.slug === j.person || stripPastorPrefix(p.full_name) === j.person);
                return `<option value="${esc(p.full_name)}" ${isSel ? "selected" : ""}>${esc(p.full_name)} (${esc(p.location || "Central")})</option>`;
              })
              .join("")}
          </select>
        </div>
      </div>

      <label class="qc-label" for="note-edit-body" style="margin:2px 0 0;">Note Body</label>
      <textarea id="note-edit-body" class="apple-input qc-field" rows="7" style="margin:0;line-height:1.5;">${esc(fullBody)}</textarea>

      <button type="button" class="btn-primary-pill qc-save-btn" id="btn-save-note-edit">Save Note</button>
      <span id="note-edit-status" class="card-caption" hidden></span>
    </div>
  `;
  window.presentSheetBackdrop();

  const noteReadView = document.getElementById("note-read-view");
  const noteEditBlock = document.getElementById("note-edit-form-block");
  const kickerEl = document.getElementById("sheet-kicker");

  document.getElementById("btn-toggle-note-edit")?.addEventListener("click", () => {
    if (!noteReadView || !noteEditBlock) return;
    noteReadView.hidden = true;
    noteEditBlock.hidden = false;
    if (kickerEl) kickerEl.textContent = "EDIT NOTE";
    triggerListFadeLift(noteEditBlock);
  });

  document.getElementById("btn-cancel-note-edit")?.addEventListener("click", () => {
    if (!noteReadView || !noteEditBlock) return;
    noteEditBlock.hidden = true;
    noteReadView.hidden = false;
    if (kickerEl) kickerEl.textContent = defaultKicker;
    triggerListFadeLift(noteReadView);
  });

  document.getElementById("btn-save-note-edit")?.addEventListener("click", async () => {
    const newTitle = (document.getElementById("note-edit-title")?.value || "").trim();
    const newCat = (document.getElementById("note-edit-cat")?.value || "").trim() || "Quick Note";
    const newPerson = (document.getElementById("note-edit-person")?.value || "").trim() || null;
    const newBody = (document.getElementById("note-edit-body")?.value || "").trim();
    const st = document.getElementById("note-edit-status");
    const btn = document.getElementById("btn-save-note-edit");
    if (!newBody && !newTitle) return;
    if (btn) { btn.disabled = true; btn.textContent = "Saving..."; }
    const effectiveSummary = newTitle || (newBody.length > 80 ? newBody.slice(0, 77) + "..." : newBody);
    const { error } = await sb
      .from("journal")
      .update({
        summary: effectiveSummary,
        category: newCat,
        person: newPerson,
        details: newBody || effectiveSummary,
        entry: newBody || effectiveSummary
      })
      .eq("id", j.id);
    if (error) {
      if (btn) { btn.disabled = false; btn.textContent = "Save Note"; }
      if (st) { st.hidden = false; st.textContent = "Error: " + error.message; }
      return;
    }
    if (btn) { btn.disabled = false; btn.textContent = "Save Note"; }
    if (st) { st.hidden = false; st.textContent = "Saved ✓"; }
    await syncFromSupabase();
    window.openNoteSheet(j.id, true);
    showUndoToast("Saved note", null);
  });

  const handleDeleteNote = async () => {
    const { error } = await sb.from("journal").delete().eq("id", j.id);
    if (error) {
      alert("Error deleting note: " + error.message);
      return;
    }
    window.closeSheetAndReset();
    await syncFromSupabase();
    showUndoToast("Deleted note", null);
  };
  document.getElementById("btn-delete-note")?.addEventListener("click", handleDeleteNote);
  document.getElementById("btn-note-delete")?.addEventListener("click", handleDeleteNote);
};
window.completeLoopItem = function (itemId, btnEl) {
  const item = state.profileItems.find((x) => x.id === itemId);
  if (!item) return;
  if (isItemConverted(item)) { window.toggleLoopItem(itemId); return; }
  const wrap = btnEl?.closest(".ios-swipe-wrap") || btnEl?.closest(".ios-row");
  if (btnEl) { btnEl.classList.add("checked", "reminder-check", "done"); btnEl.textContent = "✓"; }
  if (wrap) {
    wrap.style.maxHeight = wrap.offsetHeight + "px";
    setTimeout(() => wrap.classList.add("loop-completing"), 180);
    setTimeout(() => {
      window.toggleLoopItem(itemId);
      if (wrap && wrap.parentNode) wrap.remove();
    }, 420);
  } else {
    window.toggleLoopItem(itemId);
  }
};
function openQuickCreate(tab = "", prefillPersonSlug = "", prefillSeriesKey = "", prefillProjectSlug = "", preservedDraftText = "") {
  const backdrop = document.getElementById("sheet-backdrop");
  const isSheetOpen = backdrop && !backdrop.hidden && state.currentSheet;
  if (!tab) {
    if (isSheetOpen && state.currentSheet.type === "meeting_group") {
      tab = "di";
      prefillSeriesKey = prefillSeriesKey || state.currentSheet.id;
    } else if (isSheetOpen && state.currentSheet.type === "person") {
      tab = "di";
      prefillPersonSlug = prefillPersonSlug || state.currentSheet.id;
    } else if (isSheetOpen && state.currentSheet.type === "project") {
      tab = "loop";
      prefillProjectSlug = prefillProjectSlug || state.currentSheet.id;
    } else if (state.activeTab === "projects") {
      tab = "project";
    } else if (state.activeTab === "loops") {
      tab = "loop";
    } else if (state.activeTab === "people") {
      tab = "di";
    } else {
      tab = "note";
    }
  }

  updateSheetNavSession({ type: "quick_create", id: tab, label: "Quick Create" });
  document.getElementById("sheet-kicker").textContent = "QUICK CREATE";
  document.getElementById("sheet-title").textContent =
    tab === "project"
      ? "New Project"
      : tab === "di"
      ? "New Discussion Topic"
      : tab === "loop"
      ? "New Task / Open Loop"
      : "New Quick Note";

  const people = [...state.personProfiles.filter((p) => !isAiBotProfile(p))].sort((a, b) =>
    String(a.full_name || "").localeCompare(String(b.full_name || ""))
  );
  const activeProjects = state.projectProfiles.filter((pr) => (pr.status || "active") !== "archived");
  const groups = state.meetingGroups.filter((g) => g.is_active !== false);
  const teamGroups = groups.filter((g) => g.group_type !== "1on1" || isTeamMeetingSeriesKey(g.series_key));

  const initialDiTarget = prefillSeriesKey && isTeamMeetingSeriesKey(prefillSeriesKey) ? "meeting" : "person";
  const defaultSeriesKey = initialDiTarget === "meeting" ? prefillSeriesKey : "";
  const initialBucket = prefillPersonSlug && prefillPersonSlug !== "nick-drake" ? "waiting" : "mine";

  document.getElementById("sheet-body").innerHTML = `
    <div class="qc-tabs">${[
      ["note", "Note"],
      ["loop", "Loop"],
      ["di", "Topic"],
      ["project", "Project"]
    ]
      .map(([k, l]) => `<button type="button" class="qc-tab ${k === tab ? "active" : ""}" data-qc="${k}">${l}</button>`)
      .join("")}</div>
    <div class="qc-form-main">
    ${
      tab === "project"
        ? `
      <label class="qc-label" for="qc-proj-name">Project Name</label>
      <input type="text" id="qc-proj-name" class="apple-input qc-field" placeholder="Project name (e.g. HW Fall Launch)..." value="${esc(preservedDraftText)}" />
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div>
          <label class="qc-label" for="qc-proj-location">Location</label>
          <select id="qc-proj-location" class="apple-input qc-field">
            <option value="HW">HW</option>
            <option value="SF">SF</option>
            <option value="Central" selected>Central</option>
            <option value="All Locations">All Locations</option>
            <option value="Personal">Personal</option>
          </select>
        </div>
        <div>
          <label class="qc-label" for="qc-proj-category">Category</label>
          <select id="qc-proj-category" class="apple-input qc-field">
            <option value="Location Ministry">Location Ministry</option>
            <option value="Leadership & Staff">Leadership &amp; Staff</option>
            <option value="Operations & Systems" selected>Operations &amp; Systems</option>
            <option value="Teaching & Series">Teaching &amp; Series</option>
            <option value="Personal / Family">Personal / Family</option>
          </select>
        </div>
      </div>
      <label class="qc-label" for="qc-proj-summary">Summary / Next Milestone</label>
      <textarea id="qc-proj-summary" class="apple-input qc-field" rows="3" placeholder="What is the goal or next milestone?"></textarea>
      <label class="qc-label" for="qc-proj-why">Why It Matters / Notes (optional)</label>
      <textarea id="qc-proj-why" class="apple-input qc-field" rows="2" placeholder="Context, key stakeholders, or notes..."></textarea>
        `
        : `<textarea id="qc-text" class="apple-input qc-field ${tab === "note" ? "qc-note-textarea" : ""}" rows="${tab === "note" ? "6" : "3"}" placeholder="${
            tab === "note"
              ? "Write a note..."
              : tab === "loop"
              ? "What needs to get done?"
              : "What topic do you want to discuss?"
          }">${esc(preservedDraftText)}</textarea>`
    }
    ${
      tab === "note"
        ? `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px;">
        <div>
          <label class="qc-label" for="qc-note-cat">Category</label>
          <select id="qc-note-cat" class="apple-input qc-field">
            <option value="Quick Note" selected>Quick Note</option>
            <option value="1:1 / Coaching">1:1 / Coaching</option>
            <option value="Meeting Note">Meeting Note</option>
            <option value="Sermon / Teaching Idea">Sermon / Teaching Idea</option>
            <option value="Leadership">Leadership</option>
          </select>
        </div>
        <div>
          <label class="qc-label" for="qc-note-person">Person (optional)</label>
          <select id="qc-note-person" class="apple-input qc-field">
            <option value="">-- No Person --</option>
            ${people
              .map(
                (p) =>
                  `<option value="${esc(p.full_name)}" ${prefillPersonSlug === p.slug ? "selected" : ""}>${esc(p.full_name)} (${esc(p.location || "Central")})</option>`
              )
              .join("")}
          </select>
        </div>
      </div>`
        : ""
    }
    ${
      tab === "loop"
        ? `
      <label class="qc-label">Ownership</label>
      <div class="qc-seg-pills" id="qc-bucket-pills">
        <button type="button" class="qc-seg-pill ${initialBucket === "mine" ? "active" : ""}" data-qcb="mine">I owe this (My Loop)</button>
        <button type="button" class="qc-seg-pill ${initialBucket === "waiting" ? "active" : ""}" data-qcb="waiting">Waiting on them</button>
      </div>
      <input type="hidden" id="qc-bucket" value="${initialBucket}" />
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div>
          <label class="qc-label" for="qc-person">Person</label>
          <select id="qc-person" class="apple-input qc-field">
            <option value="nick-drake" ${!prefillPersonSlug || prefillPersonSlug === "nick-drake" ? "selected" : ""}>Me (Nick Drake)</option>
            ${people
              .map(
                (p) =>
                  `<option value="${esc(p.slug)}" ${prefillPersonSlug === p.slug ? "selected" : ""}>${esc(p.full_name)} (${esc(p.location || "Central")})</option>`
              )
              .join("")}
          </select>
        </div>
        <div>
          <label class="qc-label" for="qc-project">Project (optional)</label>
          <select id="qc-project" class="apple-input qc-field">
            <option value="">-- No Project --</option>
            ${activeProjects
              .map(
                (pr) =>
                  `<option value="${esc(pr.slug)}" ${prefillProjectSlug === pr.slug ? "selected" : ""}>${esc(pr.name)}</option>`
              )
              .join("")}
          </select>
        </div>
      </div>
      <label class="qc-label" for="qc-due">Due Date (optional)</label>
      <input id="qc-due" type="date" class="apple-input qc-field" />`
        : ""
    }
    ${
      tab === "di"
        ? `
      <label class="qc-label">Discuss With</label>
      <div class="qc-seg-pills" id="qc-di-target-pills">
        <button type="button" class="qc-seg-pill ${initialDiTarget === "person" ? "active" : ""}" data-qcdi="person">1:1 with a Person</button>
        <button type="button" class="qc-seg-pill ${initialDiTarget === "meeting" ? "active" : ""}" data-qcdi="meeting">Team / Location Meeting</button>
      </div>
      <input type="hidden" id="qc-di-target-mode" value="${initialDiTarget}" />
      <div id="qc-di-person-wrap" ${initialDiTarget === "meeting" ? "hidden" : ""}>
        <label class="qc-label" for="qc-di-person">Person (1:1)</label>
        <select id="qc-di-person" class="apple-input qc-field">
          <option value="">-- Select a Person --</option>
          ${people
            .map(
              (p) =>
                `<option value="${esc(p.slug)}" ${prefillPersonSlug === p.slug ? "selected" : ""}>${esc(p.full_name)} · ${esc(p.role_title || p.location || "")}</option>`
            )
            .join("")}
        </select>
      </div>
      <div id="qc-di-group-wrap" ${initialDiTarget === "person" ? "hidden" : ""}>
        <label class="qc-label" for="qc-group">Team / Location Meeting</label>
        <select id="qc-group" class="apple-input qc-field">
          <option value="">-- Select a Team Meeting --</option>
          ${teamGroups
            .map(
              (g) =>
                `<option value="${esc(g.series_key)}" ${defaultSeriesKey === g.series_key ? "selected" : ""}>${esc(g.name)}</option>`
            )
            .join("")}
        </select>
      </div>`
        : ""
    }
    </div><button type="button" class="btn-primary-pill qc-save-btn" id="btn-qc-save">Save</button>
    <div id="qc-status" class="card-caption" style="margin-top:6px;" hidden></div>`;

  window.presentSheetBackdrop();
  document.querySelectorAll("[data-qc]").forEach((b) =>
    b.addEventListener("click", () => {
      const curTxt = (document.getElementById("qc-text")?.value ?? document.getElementById("qc-proj-name")?.value) || "";
      openQuickCreate(b.getAttribute("data-qc"), prefillPersonSlug, prefillSeriesKey, prefillProjectSlug, curTxt);
    })
  );

  document.querySelectorAll("#qc-bucket-pills .qc-seg-pill").forEach((b) => {
    b.addEventListener("click", () => {
      const val = b.getAttribute("data-qcb") || "mine";
      const hiddenInput = document.getElementById("qc-bucket");
      if (hiddenInput) hiddenInput.value = val;
      document.querySelectorAll("#qc-bucket-pills .qc-seg-pill").forEach((x) => x.classList.toggle("active", x === b));
    });
  });

  if (tab === "di") {
    const modeInput = document.getElementById("qc-di-target-mode");
    const personWrap = document.getElementById("qc-di-person-wrap");
    const groupWrap = document.getElementById("qc-di-group-wrap");
    const personSel = document.getElementById("qc-di-person");
    const groupSel = document.getElementById("qc-group");
    document.querySelectorAll("#qc-di-target-pills .qc-seg-pill").forEach((b) => {
      b.addEventListener("click", () => {
        const mode = b.getAttribute("data-qcdi") || "person";
        if (modeInput) modeInput.value = mode;
        document.querySelectorAll("#qc-di-target-pills .qc-seg-pill").forEach((x) => x.classList.toggle("active", x === b));
        if (personWrap) personWrap.hidden = mode !== "person";
        if (groupWrap) groupWrap.hidden = mode !== "meeting";
        if (mode === "person" && groupSel) groupSel.value = "";
        if (mode === "meeting" && personSel) personSel.value = "";
      });
    });
  }

  document.getElementById("btn-qc-save").addEventListener("click", async () => {
    const st = document.getElementById("qc-status");
    let error = null;
    let savedPersonSlug = null;
    let savedProjectSlug = null;

    if (tab === "project") {
      const projName = (document.getElementById("qc-proj-name")?.value || "").trim();
      const projLoc = (document.getElementById("qc-proj-location")?.value || "Central").trim();
      const projCat = (document.getElementById("qc-proj-category")?.value || "Operations & Systems").trim();
      const projSum = (document.getElementById("qc-proj-summary")?.value || "").trim();
      const projWhy = (document.getElementById("qc-proj-why")?.value || "").trim();
      if (!projName || !sb) return;
      st.hidden = false;
      st.textContent = "Saving...";
      const slug =
        projName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "proj-" + Date.now();
      savedProjectSlug = slug;
      ({ error } = await sb.from("sb_project_profiles").upsert(
        {
          id: "proj-" + slug,
          slug,
          name: projName,
          location: projLoc,
          category: projCat,
          status: "active",
          owner: "Nick Drake",
          who_summary: "Nick Drake",
          what_summary: projSum || projName,
          why_it_matters: projWhy,
          updated_at: new Date().toISOString()
        },
        { onConflict: "slug" }
      ));
      if (!error) {
        st.textContent = "Saved ✓";
        await syncFromSupabase();
        setTimeout(() => {
          window.openProjectSheet(slug);
        }, 280);
      } else {
        st.textContent = "Error: " + error.message;
      }
      return;
    }

    const txt = (document.getElementById("qc-text")?.value || "").trim();
    if (!txt || !sb) return;
    st.hidden = false;
    st.textContent = "Saving...";

    if (tab === "note") {
      const noteCat = (document.getElementById("qc-note-cat")?.value || "Quick Note").trim();
      const notePerson = (document.getElementById("qc-note-person")?.value || "").trim() || null;
      ({ error } = await sb.from("journal").insert({
        id: "JRN-" + Date.now(),
        entry_date: new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }),
        category: noteCat,
        person: notePerson,
        summary: txt.length > 80 ? txt.slice(0, 77) + "..." : txt,
        details: txt,
        entry: txt,
        tags: "",
        source: "nickdrake.ai"
      }));
    } else if (tab === "loop") {
      const bucket = document.getElementById("qc-bucket")?.value || "mine";
      savedPersonSlug = document.getElementById("qc-person")?.value || "nick-drake";
      savedProjectSlug = document.getElementById("qc-project")?.value || "";
      const targetProfileType = savedProjectSlug && savedPersonSlug === "nick-drake" ? "project" : "person";
      const targetProfileSlug = targetProfileType === "project" ? savedProjectSlug : savedPersonSlug;
      ({ error } = await sb.rpc("create_profile_item", {
        p_profile_type: targetProfileType,
        p_profile_slug: targetProfileSlug,
        p_item_type: bucket === "mine" ? "open_loop" : "waiting_on",
        p_what_summary: txt,
        p_bucket: bucket,
        p_due_date: document.getElementById("qc-due")?.value || null,
        p_project_slug: savedProjectSlug || null
      }));
    } else {
      const targetMode = document.getElementById("qc-di-target-mode")?.value || "person";
      const selectedPersonSlug = targetMode === "person" ? (document.getElementById("qc-di-person")?.value || "") : "";
      const selectedGroupKey = targetMode === "meeting" ? (document.getElementById("qc-group")?.value || "") : "";
      const g = targetMode === "meeting" ? teamGroups.find((x) => x.series_key === selectedGroupKey) : null;
      const pObj = targetMode === "person" ? people.find((x) => x.slug === selectedPersonSlug) : null;

      if (targetMode === "person" && !selectedPersonSlug) {
        st.textContent = "Please select a Person for this 1:1 topic.";
        return;
      }
      if (targetMode === "meeting" && !g) {
        st.textContent = "Please select a Team / Location Meeting.";
        return;
      }
      savedPersonSlug = selectedPersonSlug || null;
      const matched1on1 = selectedPersonSlug ? groups.find((x) => x.person_slug === selectedPersonSlug && x.group_type === "1on1") : null;
      const effectiveSeriesKey = g ? g.series_key : (matched1on1?.series_key || `series:1on1-${selectedPersonSlug}`);
      ({ error } = await sb.rpc("create_profile_item", {
        p_profile_type: selectedPersonSlug ? "person" : g?.project_slug ? "project" : "location",
        p_profile_slug: selectedPersonSlug || g?.project_slug || g?.location || "Central",
        p_item_type: "discussion_item",
        p_what_summary: txt,
        p_why_it_matters: g?.name || (pObj ? `1:1 · ${pObj.full_name}` : "Discussion Topic"),
        p_who_summary: pObj?.full_name || g?.name || null,
        p_bucket: "agenda",
        p_series_key: effectiveSeriesKey,
        p_project_slug: g?.project_slug || null
      }));
    }
    if (error) {
      st.textContent = "Error: " + error.message;
      return;
    }
    st.textContent = "Saved ✓";
    await syncFromSupabase();
    const selectedGroupKeyAfter = document.getElementById("qc-group")?.value || "";
    if (tab === "di" && selectedGroupKeyAfter && isTeamMeetingSeriesKey(selectedGroupKeyAfter)) {
      setTimeout(() => {
        window.openMeetingGroupSheet(selectedGroupKeyAfter);
      }, 280);
    } else if (savedProjectSlug) {
      setTimeout(() => {
        window.openProjectSheet(savedProjectSlug);
      }, 280);
    } else if (savedPersonSlug && savedPersonSlug !== "nick-drake") {
      setTimeout(() => {
        window.openPersonSheet(savedPersonSlug);
      }, 280);
    } else {
      setTimeout(() => {
        window.closeSheetAndReset();
      }, 320);
    }
  });
}
window.openQuickCreate = openQuickCreate;

function getAppTheme() {
  try {
    const saved = localStorage.getItem("nd_theme_mode");
    if (saved === "light" || saved === "dark") return saved;
  } catch (_e) {}
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

function setAppTheme(mode) {
  const cleanMode = mode === "light" ? "light" : "dark";
  try {
    localStorage.setItem("nd_theme_mode", cleanMode);
  } catch (_e) {}
  document.documentElement.setAttribute("data-theme", cleanMode);
  if (document.body) {
    document.body.classList.toggle("theme-light", cleanMode === "light");
  }
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute("content", cleanMode === "light" ? "#ffffff" : "#171717");
  const metaScheme = document.querySelector('meta[name="color-scheme"]');
  if (metaScheme) metaScheme.setAttribute("content", cleanMode);
  document.querySelectorAll(".theme-seg-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-theme-val") === cleanMode);
  });
  window.dispatchEvent(new CustomEvent("nd-theme-change", { detail: { mode: cleanMode } }));
}
window.getAppTheme = getAppTheme;
window.setAppTheme = setAppTheme;

function closeUserDropdown() {
  const menu = document.getElementById("user-dropdown-menu");
  const trigger = document.getElementById("btn-auth-sheet");
  if (menu) menu.hidden = true;
  if (trigger) trigger.setAttribute("aria-expanded", "false");
}

function toggleUserDropdown(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById("user-dropdown-menu");
  const trigger = document.getElementById("btn-auth-sheet");
  if (!menu) {
    openAuthSheet();
    return;
  }
  const willOpen = menu.hidden;
  if (willOpen) {
    const nameEl = document.getElementById("user-dropdown-name");
    const emailEl = document.getElementById("user-dropdown-email");
    const healthNavBtn = document.getElementById("btn-menu-health");
    const memBtn = document.getElementById("btn-menu-memory");
    const healthBtn = document.getElementById("btn-menu-health-access");
    const refreshBtn = document.getElementById("btn-menu-refresh");
    if (nameEl) nameEl.textContent = isAllowedOwner(state.user) ? "Nick Drake" : (state.accessProfile?.display_name || state.accessProfile?.full_name || state.user?.user_metadata?.full_name || (state.isOwner ? "Nick Drake" : "Authorized Viewer"));
    if (emailEl) emailEl.textContent = state.user?.email || "nick.drake@theactionchurch.com";
    if (healthNavBtn) healthNavBtn.hidden = !state.isOwner;
    if (memBtn) memBtn.hidden = !state.isOwner;
    if (healthBtn) healthBtn.hidden = !state.isOwner;
    if (refreshBtn) refreshBtn.hidden = !state.isOwner;
    const curTheme = getAppTheme();
    document.querySelectorAll(".theme-seg-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-theme-val") === curTheme);
    });
    menu.hidden = false;
    if (trigger) trigger.setAttribute("aria-expanded", "true");
  } else {
    closeUserDropdown();
  }
}
window.toggleUserDropdown = toggleUserDropdown;
window.closeUserDropdown = closeUserDropdown;

function openAuthSheet(fromBack = false) {
  closeUserDropdown();
  updateSheetNavSession({ type: "auth", id: "settings", label: "Settings", reopen: (b) => window.openAuthSheet(b) }, fromBack);
  prefetchPasskeyRegisterOptions();
  const curTheme = getAppTheme();
  document.getElementById("sheet-kicker").textContent = "SETTINGS & ACCOUNT";
  document.getElementById("sheet-title").textContent = state.user?.email || "Account";
  document.getElementById("sheet-body").innerHTML = `
    <div class="detail-block" style="margin-bottom:8px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <div>
          <strong>Appearance</strong>
          <div style="font-size:12px;color:var(--text-sec);margin-top:2px;">Switch between Light Mode (white background) and Dark Mode</div>
        </div>
        <div class="theme-segmented-control" role="group" aria-label="Appearance Mode" style="min-width:190px;">
          <button type="button" class="theme-seg-btn ${curTheme === "light" ? "active" : ""}" data-theme-val="light" onclick="window.setAppTheme && window.setAppTheme('light')">☀️ Light</button>
          <button type="button" class="theme-seg-btn ${curTheme === "dark" ? "active" : ""}" data-theme-val="dark" onclick="window.setAppTheme && window.setAppTheme('dark')">🌙 Dark</button>
        </div>
      </div>
    </div>
    <div class="detail-block">
      <strong>Face ID / Touch ID Passkeys</strong>
      <div id="sheet-passkey-list" style="margin:8px 0;"><div class="empty-row">Loading...</div></div>
      <button type="button" class="btn-primary-pill" id="btn-register-passkey">Enable Face ID / Touch ID on this device</button>
      <div id="sheet-pk-status" style="margin-top:6px;font-size:12px;color:var(--text-sec);" hidden></div>
    </div>
    <form id="sheet-password-form" class="detail-block">
      <strong>Set or Update Password (Face ID / Apple Passwords)</strong>
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
        <input
          type="password"
          id="sheet-new-password"
          name="new-password"
          autocomplete="new-password"
          class="apple-input"
          placeholder="New password (min 8 characters)"
          style="flex:1;min-width:180px;"
          required
        />
        <button type="submit" class="btn-primary-pill" id="btn-sheet-save-pw">Save Password</button>
      </div>
      <div id="sheet-pw-status" style="margin-top:6px;font-size:12px;color:var(--text-sec);" hidden></div>
    </form>

    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;">
      ${state.isOwner ? `<button type="button" class="btn-primary-pill" onclick="window.openHealthAccessSheet()">Manage /health Access</button>` : ""}
      <button type="button" class="btn-primary-pill" id="btn-sheet-refresh">Refresh Data</button>
      <button type="button" class="btn-auth-secondary" id="btn-sheet-signout" style="width:auto;padding:8px 16px;">Sign Out</button>
    </div>
  `;
  window.presentSheetBackdrop();
  renderPasskeyManager();
  document.getElementById("btn-register-passkey")?.addEventListener("click", async () => {
    const st = document.getElementById("sheet-pk-status");
    st.hidden = false; st.textContent = "Follow the Face ID / Touch ID prompt...";
    try { await registerPasskey(); st.textContent = "Passkey enabled! Next time tap 'Sign in with Face ID / Touch ID'."; renderPasskeyManager(); }
    catch (e) {
      if (e?.name === "InvalidStateError" || /invalid state/i.test(String(e?.message || e))) {
        localStorage.setItem("nd_passkey_registered", "1");
        st.textContent = "✓ Passkey is already synced to this device via Apple Passwords / iCloud Keychain — Face ID is ready to use.";
      } else {
        st.textContent = e?.name === "NotAllowedError" ? "Cancelled." : "Error: " + (e?.message || e);
      }
    }
  });

  document.getElementById("sheet-password-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const pw = (document.getElementById("sheet-new-password")?.value || "").trim();
    const statusEl = document.getElementById("sheet-pw-status");
    if (!pw || pw.length < 8) {
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = "Password must be at least 8 characters.";
      }
      return;
    }
    if (statusEl) {
      statusEl.hidden = false;
      statusEl.textContent = "Saving password...";
    }
    const { error } = await sb.auth.updateUser({ password: pw });
    if (statusEl) {
      statusEl.textContent = error
        ? `Error: ${error.message}`
        : "Password saved! iPhone Face ID / Passwords can now autofill it.";
    }
    if (!error) {
      document.getElementById("sheet-new-password").value = "";
    }
  });

  document.getElementById("btn-sheet-refresh")?.addEventListener("click", async () => {
    await syncFromSupabase();
    window.closeSheetAndReset();
  });

  document.getElementById("btn-sheet-signout")?.addEventListener("click", async () => {
    window.closeSheetAndReset();
    if (sb) await sb.auth.signOut();
    await handleSessionChange(null);
  });
}

/* --- Global Search / Ask --- */
function runInstantAsk(q) {
  const drawer = document.getElementById("global-ask-drawer");
  const clearBtn = document.getElementById("btn-spotlight-clear");
  const kbdHint = document.getElementById("spotlight-kbd-hint");
  if (!drawer) return;
  const query = (q || "").trim().toLowerCase();
  if (clearBtn) clearBtn.hidden = !query;
  if (kbdHint) kbdHint.hidden = Boolean(query);
  if (!query) {
    drawer.hidden = true;
    return;
  }
  drawer.hidden = false;

  const matchedMeetings = (state.meetingGroups || [])
    .filter(
      (g) =>
        g.is_active !== false &&
        g.group_type !== "1on1" &&
        `${g.name} ${g.location} ${g.cadence} ${g.series_key}`.toLowerCase().includes(query)
    )
    .slice(0, 3);

  const matchedEvents = (state.calendarEvents || [])
    .filter((e) => `${e.title} ${e.location} ${e.event_date}`.toLowerCase().includes(query))
    .slice(0, 4);

  const matchedPeople = state.personProfiles
    .filter(
      (p) =>
        !isAiBotProfile(p) &&
        `${p.full_name} ${p.role_title} ${p.location} ${p.what_current_focus} ${p.who_they_are}`
          .toLowerCase()
          .includes(query)
    )
    .slice(0, 4);

  const matchedProjects = state.projectProfiles
    .filter(
      (pr) =>
        (pr.status || "active") !== "archived" &&
        `${pr.name} ${pr.location} ${pr.category} ${pr.what_summary} ${pr.why_it_matters}`
          .toLowerCase()
          .includes(query)
    )
    .slice(0, 4);

  const matchedLoops = state.profileItems
    .filter(
      (i) =>
        !isItemArchived(i) &&
        !isItemConverted(i) &&
        `${i.profile_slug} ${i.who_summary} ${i.what_summary} ${i.why_it_matters}`
          .toLowerCase()
          .includes(query)
    )
    .slice(0, 5);

  const matchedNotes = (state.journal || [])
    .filter((j) => `${j.summary} ${j.details} ${j.entry} ${j.category} ${j.person}`.toLowerCase().includes(query))
    .slice(0, 4);

  const totalCount =
    matchedMeetings.length +
    matchedEvents.length +
    matchedPeople.length +
    matchedProjects.length +
    matchedLoops.length +
    matchedNotes.length;

  const renderSection = (title, rowsHtml) =>
    rowsHtml
      ? `<div class="spotlight-group-section">
          <div class="spotlight-group-title">${title}</div>
          <div class="ios-grouped-list">${rowsHtml}</div>
        </div>`
      : "";

  const calRowsHtml = [
    ...matchedMeetings.map((g) => renderMeetingGroupRow(g)),
    ...matchedEvents.map(
      (e) => `<div class="ios-row" onclick="window.openMeetingSheet('${esc(e.id)}')">
        <div class="ios-avatar" style="background:rgba(255,255,255,0.08);color:var(--accent);">📅</div>
        <div class="ios-row-main">
          <div class="ios-row-title">${esc(e.title || "Meeting")}</div>
          <div class="ios-row-sub">${esc([e.event_date, e.is_all_day ? "All day" : fmtTimeET(e.start_at), e.location].filter(Boolean).join(" · "))}</div>
        </div>
        <div class="ios-row-right"><span class="ios-chevron">›</span></div>
      </div>`
    )
  ].join("");

  const notesRowsHtml = matchedNotes
    .map(
      (j) => `<div class="ios-row" onclick="window.openNoteSheet('${esc(j.id)}')">
        <div class="ios-avatar" style="background:rgba(255,255,255,0.08);color:var(--accent);">📝</div>
        <div class="ios-row-main">
          <div class="ios-row-title">${esc(j.summary || j.entry || "(Note)")}</div>
          <div class="ios-row-sub">${esc([j.category || "Note", j.entry_date, j.person].filter(Boolean).join(" · "))}</div>
        </div>
        <div class="ios-row-right"><span class="ios-chevron">›</span></div>
      </div>`
    )
    .join("");

  drawer.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
      <div style="font-size:12.5px;font-weight:600;color:var(--text-sec);">Spotlight · ${totalCount} match${totalCount === 1 ? "" : "es"} for "${esc(q)}"</div>
      <button type="button" class="btn-task" onclick="window.clearSpotlightSearch()">Close (Esc)</button>
    </div>
    ${renderSection("Meetings & Calendar", calRowsHtml)}
    ${renderSection("Open Loops & Discussion Topics", matchedLoops.map((i) => renderLoopItemRow(i)).join(""))}
    ${renderSection("People", matchedPeople.map((p) => renderPersonRow(p)).join(""))}
    ${renderSection("Projects", matchedProjects.map((pr) => renderProjectRow(pr)).join(""))}
    ${renderSection("Notes", notesRowsHtml)}
    ${
      totalCount === 0
        ? `<div class="ios-grouped-list"><div style="padding:14px;color:var(--text-sec);font-size:13px;">No matches across Calendar, Loops, People, Projects, or Notes for "${esc(q)}".</div></div>`
        : ""
    }
  `;
}

window.clearSpotlightSearch = function () {
  const inp = document.getElementById("global-search");
  const drawer = document.getElementById("global-ask-drawer");
  const clearBtn = document.getElementById("btn-spotlight-clear");
  const kbdHint = document.getElementById("spotlight-kbd-hint");
  if (inp) inp.value = "";
  if (drawer) drawer.hidden = true;
  if (clearBtn) clearBtn.hidden = true;
  if (kbdHint) kbdHint.hidden = false;
};

function renderAll() {
  renderToday();
  if (state.activeTab === "notes") renderNotesView();
  { const c = document.getElementById("side-count-notes"); if (c) c.textContent = state.journal.length; }
  renderBriefsView();
  renderPeople();
  renderProjects();
  renderLoops();
  renderMemory();
}

/* ============================================================================
 * Deliverable 1: Health & Engagement Dashboard Loader & Access Manager
 * ============================================================================ */
let _healthLoading = false;
async function loadAndRenderHealthDashboard(forceRefresh = false) {
  const mountEl = document.getElementById("health-dashboard-mount");
  if (!mountEl || !sb || !state.user) return;

  const doMount = () => {
    if (typeof window.renderActionChurchHealthDashboard === "function") {
      window.renderActionChurchHealthDashboard(mountEl, {
        payload: state.healthPayload || {},
        initialLiveRow: state.healthLiveRow,
        sbClient: sb,
        isOwner: state.isOwner,
        userEmail: state.user?.email || "",
        onOpenAccessModal: state.isOwner ? () => window.openHealthAccessSheet() : undefined,
        onSwitchToWorkspace: state.isOwner ? () => switchTab(window._lastSbTab || "today") : undefined,
        onSignOut: async () => {
          if (sb) await sb.auth.signOut();
          await handleSessionChange(null);
        }
      });
    }
  };

  // Mount immediately using the embedded bundle dataset so there is zero loading delay
  doMount();

  if (!state.healthLiveRow || forceRefresh) {
    if (_healthLoading) return;
    _healthLoading = true;
    try {
      const liveRes = await sb
        .from("sunday_attendance_live")
        .select("sunday_date,sunday_label,is_live,services_completed,locs_json,services_json,updated_at")
        .order("sunday_date", { ascending: false })
        .limit(1);
      if (Array.isArray(liveRes.data) && liveRes.data.length > 0) {
        state.healthLiveRow = liveRes.data[0];
        doMount();
      }
    } catch (err) {
      reportClientError("loadAndRenderHealthDashboard", err?.message || String(err), err?.stack || "");
    } finally {
      _healthLoading = false;
    }
  }
}

window.openHealthAccessSheet = async function (fromBack = false) {
  if (!sb || !state.isOwner) return;
  updateSheetNavSession({ type: "health_access", id: "access", label: "Access", reopen: (b) => window.openHealthAccessSheet(b) }, fromBack);
  document.getElementById("sheet-kicker").textContent = "ACTION CHURCH · HEALTH DASHBOARD";
  document.getElementById("sheet-title").textContent = "Viewer Access & Passcode";
  const bodyEl = document.getElementById("sheet-body");
  bodyEl.innerHTML = `<div style="padding:12px;color:var(--text-sec);font-size:13px;">Loading viewer access list...</div>`;
  window.presentSheetBackdrop();

  try {
    const { data, error } = await sb.rpc("admin_get_health_access_settings");
    if (error) throw error;
    renderHealthAccessSheetBody(data || { shared_passcode: "<INITIAL_SHARED_PASSCODE_REDACTED>", viewers: [] });
  } catch (err) {
    bodyEl.innerHTML = `<div style="padding:12px;color:var(--red);font-size:13px;">Error loading access settings: ${esc(err?.message || String(err))}</div>`;
  }
};

function renderHealthAccessSheetBody(settings) {
  const bodyEl = document.getElementById("sheet-body");
  if (!bodyEl) return;
  const passcode = settings?.shared_passcode || "<INITIAL_SHARED_PASSCODE_REDACTED>";
  const viewers = Array.isArray(settings?.viewers) ? settings.viewers : [];
  const shareUrl = "https://nickdrake.ai/health";

  bodyEl.innerHTML = `
    <div class="detail-block" style="display:flex;flex-direction:column;gap:8px;">
      <strong>Share Link &amp; Isolation Guarantee</strong>
      <div style="font-size:12.5px;color:var(--text-sec);line-height:1.45;">
        Anyone you add below can sign in at <code style="color:var(--accent);">${shareUrl}</code> using their email and the shared viewer passcode. Viewers are strictly locked to <code style="color:var(--accent);">/health</code> by Postgres RLS and have <strong>zero access</strong> to your Second Brain.
      </div>
      <div style="display:flex;gap:8px;align-items:center;margin-top:4px;flex-wrap:wrap;">
        <input type="text" class="apple-input" value="${shareUrl}" readonly style="flex:1;min-width:180px;font-size:12.5px;" />
        <button type="button" class="btn-primary-pill" onclick="navigator.clipboard.writeText('${shareUrl}'); window.showHealthAccessToast('Copied /health link!')">Copy Link</button>
      </div>
    </div>

    <form id="health-passcode-form" class="detail-block" style="display:flex;flex-direction:column;gap:8px;">
      <strong>Shared Viewer Passcode</strong>
      <div style="font-size:12px;color:var(--text-sec);">
        Updating this passcode automatically updates login credentials for all active Health Dashboard viewers.
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <input type="text" id="health-shared-passcode-input" class="apple-input" value="${esc(passcode)}" style="flex:1;min-width:180px;font-family:var(--font-mono);font-size:13px;" required />
        <button type="submit" class="btn-primary-pill">Update Passcode</button>
      </div>
    </form>

    <form id="health-add-viewer-form" class="detail-block" style="display:flex;flex-direction:column;gap:8px;">
      <strong>Add or Update Authorized Person</strong>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:8px;">
        <div>
          <label class="qc-label" for="health-viewer-name" style="margin:0 0 4px;display:block;">Full Name</label>
          <input type="text" id="health-viewer-name" class="apple-input qc-field" placeholder="Full name (e.g. Parker Womack)" required />
        </div>
        <div>
          <label class="qc-label" for="health-viewer-email" style="margin:0 0 4px;display:block;">Email Address</label>
          <input type="email" id="health-viewer-email" class="apple-input qc-field" placeholder="email@theactionchurch.com" required />
        </div>
        <div>
          <label class="qc-label" for="health-viewer-role" style="margin:0 0 4px;display:block;">Role / Location (optional)</label>
          <input type="text" id="health-viewer-role" class="apple-input qc-field" placeholder="Role / Location (optional)" />
        </div>
        <div>
          <label class="qc-label" for="health-viewer-access-level" style="margin:0 0 4px;display:block;">Access Level</label>
          <select id="health-viewer-access-level" class="apple-input qc-field">
            <option value="viewer">Health Only (/health)</option>
            <option value="full">Full Workspace + Brain</option>
          </select>
        </div>
      </div>
      <div style="display:flex;margin-top:4px;">
        <button type="submit" class="btn-primary-pill qc-save-btn" id="btn-ha-add">+ Save Access</button>
      </div>
    </form>

    <div>
      <div class="sheet-kicker" style="margin-bottom:8px;">AUTHORIZED PEOPLE (${viewers.length})</div>
      <div class="ios-grouped-list">
        ${viewers.length ? viewers.map((v) => {
          const isFull = v.access_level === "full" || v.access_level === "owner";
          const nextLevel = isFull ? "viewer" : "full";
          const toggleLabel = isFull ? "Set Health Only" : "Grant Full Access";
          return `
          <div class="ios-row" style="cursor:default;flex-wrap:wrap;gap:8px;">
            <div class="ios-avatar">${esc(initials(v.full_name || v.email))}</div>
            <div class="ios-row-main" style="min-width:160px;">
              <div class="ios-row-title">${esc(v.full_name || v.email)}</div>
              <div class="ios-row-sub">${esc(v.email)}${v.role_title ? ` · ${esc(v.role_title)}` : ""}</div>
            </div>
            <div class="ios-row-right" style="gap:6px;flex-wrap:wrap;">
              <span class="debrief-badge ${isFull ? "project" : "person"}" style="${isFull ? "background:rgba(48,209,88,0.16);color:#248A3D;border:1px solid rgba(48,209,88,0.35);" : ""}">${isFull ? "Full Access" : "Health Only"}</span>
              <button type="button" class="btn-task" onclick="window.toggleHealthViewerAccessLevel('${esc(v.email)}', '${nextLevel}')">${toggleLabel}</button>
              <button type="button" class="btn-task" style="color:var(--red);border-color:rgba(255,69,58,0.3);" onclick="window.removeHealthViewer('${esc(v.email)}')">Remove</button>
            </div>
          </div>`;
        }).join("") : `<div style="padding:12px;color:var(--text-sec);font-size:13px;">No viewers added yet.</div>`}
      </div>
    </div>
  `;

  document.getElementById("health-passcode-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const newPass = (document.getElementById("health-shared-passcode-input")?.value || "").trim();
    if (!newPass || newPass.length < 6) return;
    const { data, error } = await sb.rpc("admin_set_health_shared_passcode", { p_passcode: newPass });
    if (!error && data) {
      showUndoToast("Updated shared viewer passcode", null);
      renderHealthAccessSheetBody(data);
    }
  });

  document.getElementById("health-add-viewer-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fullName = (document.getElementById("health-viewer-name")?.value || "").trim();
    const email = (document.getElementById("health-viewer-email")?.value || "").trim().toLowerCase();
    const roleTitle = (document.getElementById("health-viewer-role")?.value || "").trim();
    const accessLevel = (document.getElementById("health-viewer-access-level")?.value || "viewer").trim();
    if (!email) return;
    const { data, error } = await sb.rpc("admin_upsert_health_viewer", {
      p_email: email,
      p_full_name: fullName,
      p_role_title: roleTitle,
      p_access_level: accessLevel,
      p_active: true,
      p_custom_passcode: null
    });
    if (!error && data) {
      showUndoToast(`Saved ${fullName || email} (${accessLevel === "full" ? "Full Access" : "Health Only"})`, null);
      renderHealthAccessSheetBody(data);
    }
  });
}

window.toggleHealthViewerAccessLevel = async function (email, nextLevel) {
  if (!sb || !state.isOwner || !email) return;
  const { data, error } = await sb.rpc("admin_set_health_viewer_access_level", {
    p_email: email,
    p_access_level: nextLevel
  });
  if (!error && data) {
    showUndoToast(`Updated ${email} to ${nextLevel === "full" ? "Full Access" : "Health Only"}`, null);
    renderHealthAccessSheetBody(data);
  }
};

window.showHealthAccessToast = function (msg) {
  showUndoToast(msg, null);
};

window.removeHealthViewer = async function (email) {
  if (!sb || !state.isOwner || !email) return;
  const { data, error } = await sb.rpc("admin_remove_health_viewer", { p_email: email });
  if (!error && data) {
    showUndoToast(`Removed ${email}`, null);
    renderHealthAccessSheetBody(data);
  }
};

/* ============================================================================
 * Deliverable 2: Briefs & One-Tap Debriefs (#1 Efficiency Scout)
 * ============================================================================ */
function formatBriefMarkdown(md) {
  if (!md) return "";
  return String(md)
    .split("\n")
    .map((rawLine) => {
      const line = rawLine.trim();
      if (!line) return "";
      if (line.startsWith("## ")) {
        return `<div class="brief-md-h2">${esc(line.slice(3))}</div>`;
      }
      if (line.startsWith("- ")) {
        return `<div class="brief-md-li">${esc(line.slice(2))}</div>`;
      }
      return `<div style="font-size:13px;color:var(--text-sec);margin-top:4px;font-weight:600;">${esc(line)}</div>`;
    })
    .join("");
}

function renderDebriefQuestionCard(q, compact = false) {
  const isAnswered = Boolean(q.answered);
  return `
    <div class="debrief-q-card ${isAnswered ? "answered" : ""}" id="debrief-card-${esc(q.question_id)}">
      <div class="debrief-q-meta">
        <div class="debrief-q-badges">
          <span class="debrief-badge">${esc(fmtShortET(q.asked_date) || q.asked_date)}</span>
          ${q.person_name ? `<span class="debrief-badge person">${esc(q.person_name)}</span>` : ""}
          ${q.loop_id ? `<span class="debrief-badge">Loop Linked</span>` : ""}
          ${isAnswered ? `<span class="debrief-badge answered">✓ Answered</span>` : ""}
        </div>
        ${isAnswered ? `<button type="button" class="btn-task" onclick="window.answerDebriefQuestion('${esc(q.question_id)}', '', 'open')">Reopen</button>` : ""}
      </div>
      <div class="debrief-q-title">${esc(q.question_text)}</div>
      ${q.context ? `<div class="debrief-q-context">${esc(q.context)}</div>` : ""}
      ${
        isAnswered
          ? `<div style="font-size:12.5px;color:var(--green);background:var(--green-soft);padding:7px 10px;border-radius:8px;border:1px solid rgba(48,209,88,0.28);">
              <strong>Answer:</strong> ${esc(q.answer_summary || "Completed")}
            </div>`
          : `
            <div class="debrief-pill-bar">
              <button type="button" class="debrief-quick-pill done" onclick="window.answerDebriefQuestion('${esc(q.question_id)}', 'Done — handled', 'done')">✓ Done</button>
              <button type="button" class="debrief-quick-pill yes" onclick="window.answerDebriefQuestion('${esc(q.question_id)}', 'Yes — confirmed', 'done')">👍 Yes</button>
              <button type="button" class="debrief-quick-pill" onclick="window.answerDebriefQuestion('${esc(q.question_id)}', 'Still waiting / follow up this week', 'open')">⏳ Waiting</button>
              <button type="button" class="debrief-quick-pill drop" onclick="window.answerDebriefQuestion('${esc(q.question_id)}', 'Dropped — no action needed', 'drop')">✕ Drop</button>
            </div>
            ${
              compact
                ? ""
                : `<div class="debrief-custom-row">
                    <input type="text" id="debrief-input-${esc(q.question_id)}" class="apple-input" placeholder="Or type a quick custom answer..." style="flex:1;min-height:34px;font-size:12.5px;" onkeydown="if(event.key==='Enter'){event.preventDefault();window.submitCustomDebrief('${esc(q.question_id)}');}" />
                    <button type="button" class="btn-primary-pill" style="min-height:34px;padding:0 12px;font-size:12px;" onclick="window.submitCustomDebrief('${esc(q.question_id)}')">Save</button>
                  </div>`
            }
          `
      }
    </div>
  `;
}

window.submitCustomDebrief = function (questionId) {
  const input = document.getElementById("debrief-input-" + questionId);
  const val = (input?.value || "").trim();
  if (!val) return;
  window.answerDebriefQuestion(questionId, val, null);
};

window.answerDebriefQuestion = async function (questionId, answerText, loopAction = null) {
  const q = state.debriefQuestions.find((x) => x.question_id === questionId);
  if (!q) return;

  const prevAnswered = q.answered;
  const prevSummary = q.answer_summary;

  const trimmed = String(answerText || "").trim();
  q.answered = Boolean(trimmed);
  q.answer_summary = trimmed || null;

  updateDynamicCounts();
  renderTodayBriefsAndDebriefs();
  renderBriefsView();

  showUndoToast(
    trimmed ? "Saved debrief answer" : "Reopened debrief question",
    () => window.answerDebriefQuestion(questionId, prevAnswered ? (prevSummary || "Done") : "", "open")
  );

  if (sb && state.user && state.isOwner) {
    try {
      await sb.rpc("answer_debrief_question", {
        p_question_id: questionId,
        p_answer: trimmed,
        p_loop_action: loopAction
      });
    } catch (err) {
      reportClientError("answerDebriefQuestion", err?.message || String(err), err?.stack || "");
    }
  }
};

window.toggleTodayBriefExpand = function () {
  state.todayBriefExpanded = !state.todayBriefExpanded;
  renderTodayBriefsAndDebriefs();
};

function renderTodayBriefsAndDebriefs() {
  const stripEl = document.getElementById("today-brief-debrief-strip");
  if (stripEl) { stripEl.innerHTML = ""; stripEl.hidden = true; }
  return;

  const latestBrief = (state.briefs || []).find((b) => !/debrief/i.test(b.brief_type || "")) || null;
  if (!latestBrief) {
    stripEl.innerHTML = "";
    return;
  }

  const isExpanded = Boolean(state.todayBriefExpanded);
  const briefTypeLabel = (latestBrief.brief_type || "Morning Brief").replace(/\b\w/g, (c) => c.toUpperCase());
  const dateBadge = fmtShortET(latestBrief.brief_date);

  stripEl.innerHTML = `
    <div class="today-brief-collapsed-card">
      <button type="button" class="today-brief-summary-bar" onclick="window.toggleTodayBriefExpand()" aria-expanded="${isExpanded ? "true" : "false"}">
        <div style="display:flex;align-items:center;gap:8px;min-width:0;flex:1;">
          <span style="font-size:14px;flex-shrink:0;">☀️</span>
          <div style="min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            <span style="font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:var(--accent);margin-right:6px;">${esc(briefTypeLabel)}</span>
            <span style="font-size:13.5px;font-weight:600;color:var(--text);">${esc(latestBrief.title || "Morning Brief")}</span>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
          <span class="debrief-badge">${esc(dateBadge)}</span>
          <span style="font-size:12px;color:var(--text-sec);font-weight:600;">${isExpanded ? "Hide ▴" : "Read ▾"}</span>
        </div>
      </button>
      ${
        isExpanded
          ? `<div class="today-brief-body">${formatBriefMarkdown(latestBrief.content_md)}</div>`
          : ""
      }
    </div>
  `;
}

window.selectBriefAndOpen = function (briefId) {
  state.selectedBriefId = briefId;
  switchTab("briefs");
  renderBriefsView();
};

function renderBriefsView() {
  const debriefListEl = document.getElementById("briefs-debrief-list");
  const readerListEl = document.getElementById("briefs-reader-list");
  const readerDetailEl = document.getElementById("briefs-reader-detail");
  if (!debriefListEl || !readerListEl || !readerDetailEl) return;

  const allQ = state.debriefQuestions || [];
  const openCount = allQ.filter((q) => !q.answered).length;
  const ansCount = allQ.filter((q) => q.answered).length;

  const setChipTxt = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  };
  setChipTxt("chip-debrief-open", `Open (${openCount})`);
  setChipTxt("chip-debrief-answered", `Answered (${ansCount})`);
  setChipTxt("chip-debrief-all", `All (${allQ.length})`);

  const filteredQ = allQ.filter((q) => {
    if (state.debriefFilter === "unanswered") return !q.answered;
    if (state.debriefFilter === "answered") return Boolean(q.answered);
    return true;
  });

  debriefListEl.innerHTML = filteredQ.length
    ? filteredQ.map((q) => renderDebriefQuestionCard(q, false)).join("")
    : `<div class="brief-reader-card" style="color:var(--text-sec);font-size:13px;">No debrief questions in this filter.</div>`;

  const filteredBriefs = (state.briefs || []).filter((b) => {
    const t = (b.brief_type || "").toLowerCase();
    if (state.briefTypeFilter === "prep") return t.includes("prep") || t.includes("morning");
    if (state.briefTypeFilter === "sunday") return t.includes("sunday") || t.includes("debrief");
    return true;
  });

  if (filteredBriefs.length && !filteredBriefs.some((b) => b.id === state.selectedBriefId)) {
    state.selectedBriefId = filteredBriefs[0].id;
  }

  readerListEl.innerHTML = filteredBriefs
    .slice(0, 8)
    .map((b) => {
      const active = b.id === state.selectedBriefId;
      return `
        <div class="ios-row" style="${active ? "background:var(--surface-subtle);" : ""}" onclick="window.selectBriefInReader('${esc(b.id)}')">
          <div class="ios-row-main">
            <div class="ios-row-title" style="${active ? "color:var(--accent);" : ""}">${esc(b.title)}</div>
            <div class="ios-row-sub">${esc(b.brief_type)} · ${esc(fmtShortET(b.brief_date))}</div>
          </div>
          <div class="ios-row-right">
            <span class="ios-chevron">›</span>
          </div>
        </div>
      `;
    })
    .join("");

  const activeBrief = filteredBriefs.find((b) => b.id === state.selectedBriefId) || filteredBriefs[0];
  if (activeBrief) {
    readerDetailEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;border-bottom:1px solid var(--border);padding-bottom:10px;">
        <div>
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-sec);">${esc(activeBrief.brief_type)}</div>
          <div style="font-size:18px;font-weight:700;color:var(--text);margin-top:2px;">${esc(activeBrief.title)}</div>
        </div>
        <span class="debrief-badge">${esc(activeBrief.brief_date)}</span>
      </div>
      <div>${formatBriefMarkdown(activeBrief.content_md)}</div>
    `;
  } else {
    readerDetailEl.innerHTML = `<div style="color:var(--text-sec);font-size:13px;">Select a brief above to read.</div>`;
  }
}

window.selectBriefInReader = function (briefId) {
  state.selectedBriefId = briefId;
  renderBriefsView();
};


/* --- Native iOS Swipe Left/Right & Long-Press Context Menu --- */
function openContextMenuForWrap(wrap) {
  const kind = wrap.getAttribute("data-kind");
  const id = wrap.getAttribute("data-id");
  const backdrop = document.getElementById("ios-context-backdrop");
  const menu = document.getElementById("ios-context-menu");
  if (!backdrop || !menu || !kind || !id) return;

  if (navigator.vibrate) {
    try {
      navigator.vibrate(15);
    } catch (_) {}
  }

  let title = "";
  let buttonsHtml = "";

  if (kind === "loop") {
    const item = state.profileItems.find((x) => x.id === id);
    if (!item) return;
    const conv = isItemConverted(item);
    title = item.what_summary;
    buttonsHtml = `
      <button type="button" class="ios-ctx-btn" data-act="open">
        <span>Open Details</span><span>›</span>
      </button>
      <button type="button" class="ios-ctx-btn" data-act="toggle">
        <span>${conv ? "Mark as Open (Undo)" : "Mark Complete"}</span><span>${conv ? "↺" : "✓"}</span>
      </button>
      <button type="button" class="ios-ctx-btn" data-act="copy">
        <span>Copy Text</span><span>⎘</span>
      </button>
      <button type="button" class="ios-ctx-btn destructive" data-act="archive">
        <span>Archive</span><span>✕</span>
      </button>
    `;
  } else if (kind === "person") {
    const p = state.personProfiles.find((x) => x.slug === id);
    if (!p) return;
    title = p.full_name;
    buttonsHtml = `
      <button type="button" class="ios-ctx-btn" data-act="open">
        <span>Open 1:1 Profile</span><span>›</span>
      </button>
      <button type="button" class="ios-ctx-btn" data-act="copy">
        <span>Copy Focus Summary</span><span>⎘</span>
      </button>
    `;
  } else if (kind === "project") {
    const pr = state.projectProfiles.find((x) => x.slug === id);
    if (!pr) return;
    title = pr.name;
    buttonsHtml = `
      <button type="button" class="ios-ctx-btn" data-act="open">
        <span>Open Project</span><span>›</span>
      </button>
      <button type="button" class="ios-ctx-btn" data-act="copy">
        <span>Copy Summary</span><span>⎘</span>
      </button>
    `;
  } else if (kind === "memory") {
    const s = state.sourceItems.find((x) => x.id === id);
    if (!s) return;
    title = s.source_title;
    buttonsHtml = `
      <button type="button" class="ios-ctx-btn" data-act="open">
        <span>Open Memory Details</span><span>›</span>
      </button>
      <button type="button" class="ios-ctx-btn" data-act="copy">
        <span>Copy Summary</span><span>⎘</span>
      </button>
      <button type="button" class="ios-ctx-btn destructive" data-act="archive">
        <span>Archive</span><span>✕</span>
      </button>
    `;
  }

  menu.innerHTML = `<div class="ios-ctx-header">${esc(title)}</div>${buttonsHtml}`;
  backdrop.hidden = false;

  menu.querySelectorAll(".ios-ctx-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const act = btn.getAttribute("data-act");
      backdrop.hidden = true;
      if (act === "open") {
        if (kind === "loop") window.openLoopSheet(id);
        if (kind === "person") window.openPersonSheet(id);
        if (kind === "project") window.openProjectSheet(id);
        if (kind === "memory") window.openMemorySheet(id);
      } else if (act === "toggle" && kind === "loop") {
        window.toggleLoopItem(id);
      } else if (act === "archive") {
        window.archiveItem(id, kind);
      } else if (act === "copy") {
        let copyTxt = title;
        if (kind === "person") {
          const p = state.personProfiles.find((x) => x.slug === id);
          if (p) copyTxt = `${p.full_name}: ${p.what_current_focus}`;
        } else if (kind === "project") {
          const pr = state.projectProfiles.find((x) => x.slug === id);
          if (pr) copyTxt = `${pr.name}: ${pr.what_summary}`;
        } else if (kind === "memory") {
          const s = state.sourceItems.find((x) => x.id === id);
          if (s) copyTxt = `${s.source_title}: ${s.what_summary}`;
        }
        try {
          await navigator.clipboard.writeText(copyTxt);
          showUndoToast("Copied to clipboard", null);
        } catch (_) {}
      }
    });
  });
}

function initTouchAndContextGestures() {
  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let activeWrap = null;
  let activeRow = null;
  let activeBg = null;
  let isSwiping = false;
  let longPressTimer = null;

  const clearLongPress = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };

  document.addEventListener(
    "touchstart",
    (e) => {
      const wrap = e.target.closest(".ios-swipe-wrap");
      if (!wrap || e.target.closest(".ios-check")) return;

      const t = e.touches[0];
      if (t.clientX <= 36 && state.sheetStack && state.sheetStack.length > 0 && e.target.closest("#sheet-panel")) {
        return;
      }
      startX = t.clientX;
      startY = t.clientY;
      currentX = 0;
      activeWrap = wrap;
      activeRow = wrap.querySelector(".ios-row");
      activeBg = wrap.querySelector(".ios-swipe-bg");
      isSwiping = false;

      clearLongPress();
      if (wrap.getAttribute("data-kind") !== "loop" && !wrap.classList.contains("ios-topic-row")) {
        longPressTimer = setTimeout(() => {
          if (!isSwiping && activeWrap && !window._isReorderingTopic) {
            openContextMenuForWrap(activeWrap);
            activeWrap = null;
          }
        }, 460);
      }
    },
    { passive: true }
  );

  document.addEventListener(
    "touchmove",
    (e) => {
      if (window._isReorderingTopic) {
        clearLongPress();
        if (activeRow) {
          activeRow.style.transition = "";
          activeRow.style.transform = "";
        }
        if (activeBg) activeBg.className = "ios-swipe-bg";
        activeWrap = null;
        activeRow = null;
        activeBg = null;
        isSwiping = false;
        return;
      }
      if (!activeWrap || !activeRow) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;

      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        clearLongPress();
      }

      const kind = activeWrap.getAttribute("data-kind");
      if (kind !== "loop" && kind !== "memory") return;

      if (Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        isSwiping = true;
        currentX = Math.max(-110, Math.min(110, dx));
        activeRow.style.transition = "none";
        activeRow.style.transform = `translateX(${currentX}px)`;

        if (activeBg) {
          if (currentX > 20 && kind === "loop") {
            const item = state.profileItems.find((x) => x.id === activeWrap.getAttribute("data-id"));
            const conv = isItemConverted(item);
            activeBg.className = "ios-swipe-bg swiping-right";
            activeBg.textContent = conv ? "↺ Reopen" : "✓ Complete";
          } else if (currentX < -20) {
            activeBg.className = "ios-swipe-bg swiping-left";
            activeBg.textContent = "Archive";
          } else {
            activeBg.className = "ios-swipe-bg";
          }
        }
      }
    },
    { passive: true }
  );

  const finishTouch = () => {
    clearLongPress();
    if (!activeWrap || !activeRow) return;

    const kind = activeWrap.getAttribute("data-kind");
    const id = activeWrap.getAttribute("data-id");

    activeRow.style.transition = "transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1)";
    activeRow.style.transform = "translateX(0px)";
    if (activeBg) activeBg.className = "ios-swipe-bg";

    if (isSwiping && id) {
      if (currentX >= 68 && kind === "loop") {
        window.toggleLoopItem(id);
      } else if (currentX <= -68 && (kind === "loop" || kind === "memory")) {
        window.archiveItem(id, kind);
      }
    }

    activeWrap = null;
    activeRow = null;
    activeBg = null;
    isSwiping = false;
    currentX = 0;
  };

  document.addEventListener("touchend", finishTouch, { passive: true });
  document.addEventListener("touchcancel", finishTouch, { passive: true });

  document.addEventListener("contextmenu", (e) => {
    const wrap = e.target.closest(".ios-swipe-wrap");
    if (!wrap) return;
    e.preventDefault();
    if (wrap.getAttribute("data-kind") === "loop" || wrap.classList.contains("ios-topic-row")) {
      return;
    }
    openContextMenuForWrap(wrap);
  });

  // Left-edge swipe-right to pop nested sheet history (iOS interactive pop gesture)
  const sheetPanel = document.getElementById("sheet-panel");
  if (sheetPanel) {
    let edgeActive = false;
    let isEdgeSwiping = false;
    let edgeStartX = 0;
    let edgeStartY = 0;
    let edgeDx = 0;

    sheetPanel.addEventListener(
      "touchstart",
      (e) => {
        const backdrop = document.getElementById("sheet-backdrop");
        if (window._isReorderingTopic || !backdrop || backdrop.hidden || !state.sheetStack || state.sheetStack.length === 0) {
          edgeActive = false;
          return;
        }
        const t = e.touches[0];
        if (!t || t.clientX > 36) {
          edgeActive = false;
          return;
        }
        edgeActive = true;
        isEdgeSwiping = false;
        edgeStartX = t.clientX;
        edgeStartY = t.clientY;
        edgeDx = 0;
      },
      { passive: true }
    );

    sheetPanel.addEventListener(
      "touchmove",
      (e) => {
        if (!edgeActive) return;
        const t = e.touches[0];
        if (!t) return;
        const dx = t.clientX - edgeStartX;
        const dy = t.clientY - edgeStartY;
        if (!isEdgeSwiping) {
          if (dx > 10 && Math.abs(dx) > Math.abs(dy) * 1.4) {
            isEdgeSwiping = true;
          } else if (Math.abs(dy) > 14) {
            edgeActive = false;
            return;
          }
        }
        if (isEdgeSwiping && dx > 0) {
          edgeDx = dx;
          const bodyEl = document.getElementById("sheet-body");
          if (bodyEl) {
            bodyEl.style.transition = "none";
            bodyEl.style.transform = `translate3d(${Math.round(dx * 0.85)}px, 0, 0)`;
            bodyEl.style.opacity = String(Math.max(0.25, 1 - dx / 420));
          }
        }
      },
      { passive: true }
    );

    const finishEdgeSwipe = () => {
      if (!edgeActive) return;
      const bodyEl = document.getElementById("sheet-body");
      const shouldPop = isEdgeSwiping && edgeDx > 85;
      edgeActive = false;
      isEdgeSwiping = false;
      edgeDx = 0;
      if (shouldPop) {
        if (bodyEl) {
          bodyEl.style.transition = "";
          bodyEl.style.transform = "";
          bodyEl.style.opacity = "";
        }
        window.popSheetHistory();
      } else if (bodyEl) {
        bodyEl.style.transition = "transform 0.2s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s ease";
        bodyEl.style.transform = "translate3d(0, 0, 0)";
        bodyEl.style.opacity = "1";
        setTimeout(() => {
          if (bodyEl) {
            bodyEl.style.transition = "";
            bodyEl.style.transform = "";
            bodyEl.style.opacity = "";
          }
        }, 210);
      }
    };

    sheetPanel.addEventListener("touchend", finishEdgeSwipe, { passive: true });
    sheetPanel.addEventListener("touchcancel", finishEdgeSwipe, { passive: true });
  }
}

function initTopicReorderGestures() {
  let holdTimer = null;
  let isDragging = false;
  let dragRow = null;
  let dragList = null;
  let rows = [];
  let rowRects = [];
  let dragIndex = -1;
  let currentTargetIndex = -1;
  let dragRowHeight = 0;
  let startX = 0;
  let startY = 0;
  let lastClientX = 0;
  let lastClientY = 0;
  let initialScrollTop = 0;
  let currentClampedDy = 0;
  let autoScrollRaf = null;
  let activePointerType = null; // "touch" | "mouse"

  const stopAutoScroll = () => {
    if (autoScrollRaf) {
      cancelAnimationFrame(autoScrollRaf);
      autoScrollRaf = null;
    }
  };

  const clearHoldTimer = () => {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  };

  const applySiblingShifts = (targetIdx) => {
    rows.forEach((r, idx) => {
      if (idx === dragIndex) return;
      let shiftPx = 0;
      if (dragIndex < targetIdx && idx > dragIndex && idx <= targetIdx) {
        shiftPx = -dragRowHeight;
      } else if (dragIndex > targetIdx && idx >= targetIdx && idx < dragIndex) {
        shiftPx = dragRowHeight;
      }
      r.style.transition = "transform 0.22s cubic-bezier(0.2, 0.85, 0.25, 1)";
      r.style.transform = shiftPx ? `translate3d(0, ${shiftPx}px, 0)` : "translate3d(0, 0, 0)";
    });
  };

  const getScrollContainer = (el) => {
    const target = el || dragList || dragRow;
    if (target && target.closest && target.closest("#sheet-body")) {
      return document.getElementById("sheet-body");
    }
    return document.getElementById("main-stage") || document.getElementById("sheet-body");
  };

  const updateDragPosition = (clientX, clientY) => {
    if (!isDragging || !dragRow || !dragList || rows.length < 2) return;
    lastClientX = clientX;
    lastClientY = clientY;
    const scroller = getScrollContainer();
    const scrollDelta = (scroller ? scroller.scrollTop : 0) - initialScrollTop;
    const rawDy = (clientY - startY) + scrollDelta;

    const minDy = (rowRects[0].top - rowRects[dragIndex].top) - 10;
    const maxDy = (rowRects[rows.length - 1].bottom - rowRects[dragIndex].bottom) + 10;
    const clampedDy = Math.max(minDy, Math.min(maxDy, rawDy));
    currentClampedDy = clampedDy;

    dragRow.style.transition = "box-shadow 0.18s ease, background-color 0.18s ease";
    dragRow.style.transform = `translate3d(0, ${clampedDy}px, 0) scale(1.028)`;

    const draggedCenterY = rowRects[dragIndex].top + rowRects[dragIndex].height / 2 + clampedDy;
    let nextTarget = dragIndex;

    if (clampedDy < 0) {
      for (let i = dragIndex - 1; i >= 0; i--) {
        const siblingMid = rowRects[i].top + rowRects[i].height * 0.55;
        if (draggedCenterY < siblingMid) {
          nextTarget = i;
        } else {
          break;
        }
      }
    } else if (clampedDy > 0) {
      for (let i = dragIndex + 1; i < rows.length; i++) {
        const siblingMid = rowRects[i].top + rowRects[i].height * 0.45;
        if (draggedCenterY > siblingMid) {
          nextTarget = i;
        } else {
          break;
        }
      }
    }

    if (nextTarget !== currentTargetIndex) {
      currentTargetIndex = nextTarget;
      applySiblingShifts(currentTargetIndex);
      if (navigator.vibrate) {
        try {
          navigator.vibrate(6);
        } catch (_) {}
      }
    }
  };

  const runAutoScrollLoop = () => {
    if (!isDragging) {
      autoScrollRaf = null;
      return;
    }
    const scroller = getScrollContainer();
    if (scroller && scroller.scrollHeight > scroller.clientHeight) {
      const rect = scroller.getBoundingClientRect();
      const edgeZone = 54;
      let delta = 0;
      if (lastClientY < rect.top + edgeZone) {
        delta = -Math.ceil(((rect.top + edgeZone - lastClientY) / edgeZone) * 7);
      } else if (lastClientY > rect.bottom - edgeZone) {
        delta = Math.ceil(((lastClientY - (rect.bottom - edgeZone)) / edgeZone) * 7);
      }
      if (delta !== 0) {
        const prev = scroller.scrollTop;
        scroller.scrollTop += delta;
        if (scroller.scrollTop !== prev) {
          updateDragPosition(lastClientX, lastClientY);
        }
      }
    }
    autoScrollRaf = requestAnimationFrame(runAutoScrollLoop);
  };

  const enterDragMode = () => {
    if (!dragRow || !dragList) return;
    rows = Array.from(dragList.querySelectorAll(".ios-topic-row"));
    if (rows.length < 2) {
      dragRow = null;
      dragList = null;
      return;
    }
    dragIndex = rows.indexOf(dragRow);
    if (dragIndex < 0) {
      dragRow = null;
      dragList = null;
      return;
    }
    currentTargetIndex = dragIndex;
    rowRects = rows.map((r) => r.getBoundingClientRect());
    dragRowHeight = rowRects[dragIndex].height || dragRow.offsetHeight || 52;
    const scroller = getScrollContainer();
    initialScrollTop = scroller ? scroller.scrollTop : 0;
    currentClampedDy = 0;

    isDragging = true;
    window._isReorderingTopic = true;
    window._suppressTopicClickUntil = Date.now() + 2500;

    dragList.classList.add("ios-topic-list-reordering");
    dragRow.classList.remove("ios-row-just-added", "ios-topic-settled-flash");
    dragRow.classList.add("ios-topic-dragging");
    if (scroller) scroller.classList.add("ios-sheet-reorder-lock");

    dragRow.style.transition = "transform 0.16s cubic-bezier(0.2, 0.9, 0.25, 1.15), box-shadow 0.18s ease";
    dragRow.style.transform = "translate3d(0, 0, 0) scale(1.028)";

    if (navigator.vibrate) {
      try {
        navigator.vibrate(12);
      } catch (_) {}
    }

    stopAutoScroll();
    autoScrollRaf = requestAnimationFrame(runAutoScrollLoop);
  };

  const finishDrag = () => {
    clearHoldTimer();
    stopAutoScroll();

    if (!isDragging || !dragRow || !dragList) {
      dragRow = null;
      dragList = null;
      rows = [];
      rowRects = [];
      activePointerType = null;
      window._isReorderingTopic = false;
      return;
    }

    const finishedRow = dragRow;
    const finishedList = dragList;
    const finishedRows = rows;
    const fromIdx = dragIndex;
    const toIdx = currentTargetIndex;
    const clampedDy = currentClampedDy;

    let targetDy = 0;
    if (toIdx > fromIdx && rowRects[toIdx] && rowRects[fromIdx]) {
      targetDy = rowRects[toIdx].bottom - rowRects[fromIdx].bottom;
    } else if (toIdx < fromIdx && rowRects[toIdx] && rowRects[fromIdx]) {
      targetDy = rowRects[toIdx].top - rowRects[fromIdx].top;
    }

    isDragging = false;
    dragRow = null;
    dragList = null;
    rows = [];
    rowRects = [];
    activePointerType = null;
    window._isReorderingTopic = false;
    window._suppressTopicClickUntil = Date.now() + 420;

    const scroller = getScrollContainer(finishedList);
    if (scroller) scroller.classList.remove("ios-sheet-reorder-lock");
    document.getElementById("sheet-body")?.classList.remove("ios-sheet-reorder-lock");
    document.getElementById("main-stage")?.classList.remove("ios-sheet-reorder-lock");

    // Clear sibling transforms immediately and move DOM node to its new slot
    finishedRows.forEach((r) => {
      if (r !== finishedRow) {
        r.style.transition = "";
        r.style.transform = "";
      }
    });

    if (toIdx !== fromIdx && toIdx >= 0 && toIdx < finishedRows.length) {
      const parentContainer = (finishedRows[toIdx] && finishedRows[toIdx].parentNode) || finishedList;
      const refNode = toIdx > fromIdx ? finishedRows[toIdx].nextSibling : finishedRows[toIdx];
      parentContainer.insertBefore(finishedRow, refNode);
      const orderedIds = Array.from(finishedList.querySelectorAll(".ios-topic-row"))
        .map((el) => el.getAttribute("data-topic-id"))
        .filter(Boolean);
      persistTopicOrder(orderedIds);
    }

    // Smooth FLIP settle animation from finger offset into exact new slot
    const residualDy = clampedDy - targetDy;
    finishedRow.classList.remove("ios-topic-dragging");
    finishedRow.classList.add("ios-topic-settling");
    finishedRow.style.transition = "none";
    finishedRow.style.transform = `translate3d(0, ${residualDy}px, 0) scale(1.028)`;
    void finishedRow.offsetWidth;

    finishedRow.style.transition = "transform 0.22s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.22s ease";
    finishedRow.style.transform = "translate3d(0, 0, 0) scale(1)";

    setTimeout(() => {
      finishedRow.classList.remove("ios-topic-settling");
      finishedList.classList.remove("ios-topic-list-reordering");
      finishedRow.style.transition = "";
      finishedRow.style.transform = "";
      if (toIdx !== fromIdx) {
        finishedRow.classList.add("ios-topic-settled-flash");
        setTimeout(() => {
          finishedRow.classList.remove("ios-topic-settled-flash");
        }, 460);
      }
    }, 225);
  };

  const canStartFromTarget = (target) => {
    if (!target || !target.closest) return null;
    if (target.closest(".ios-check, .di-delete-btn, input, textarea, select, a")) return null;
    const row = target.closest(".ios-topic-row");
    if (!row) return null;
    const list = row.closest(".ios-topic-reorder-list");
    if (!list) return null;
    const allRows = list.querySelectorAll(".ios-topic-row");
    if (!allRows || allRows.length < 2) return null;
    const isGrip = Boolean(target.closest(".ios-topic-grip"));
    return { row, list, isGrip };
  };

  // Touch events (iPhone / iPad)
  document.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length !== 1) return;
      const hit = canStartFromTarget(e.target);
      if (!hit) return;
      const t = e.touches[0];
      if (!hit.isGrip && t.clientX <= 36 && state.sheetStack && state.sheetStack.length > 0 && e.target.closest("#sheet-panel")) {
        return;
      }
      clearHoldTimer();
      activePointerType = "touch";
      dragRow = hit.row;
      dragList = hit.list;
      startX = t.clientX;
      startY = t.clientY;
      lastClientX = t.clientX;
      lastClientY = t.clientY;

      if (hit.isGrip) {
        enterDragMode();
      } else {
        holdTimer = setTimeout(() => {
          holdTimer = null;
          enterDragMode();
        }, 240);
      }
    },
    { passive: true }
  );

  document.addEventListener(
    "touchmove",
    (e) => {
      if (activePointerType !== "touch") return;
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;

      if (!isDragging) {
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
          clearHoldTimer();
          dragRow = null;
          dragList = null;
          activePointerType = null;
        }
        return;
      }

      if (e.cancelable) e.preventDefault();
      updateDragPosition(t.clientX, t.clientY);
    },
    { passive: false }
  );

  document.addEventListener(
    "touchend",
    () => {
      if (activePointerType !== "touch") return;
      finishDrag();
    },
    { passive: true }
  );

  document.addEventListener(
    "touchcancel",
    () => {
      if (activePointerType !== "touch") return;
      finishDrag();
    },
    { passive: true }
  );

  // Mouse events (Mac desktop)
  document.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    const hit = canStartFromTarget(e.target);
    if (!hit) return;
    clearHoldTimer();
    activePointerType = "mouse";
    dragRow = hit.row;
    dragList = hit.list;
    startX = e.clientX;
    startY = e.clientY;
    lastClientX = e.clientX;
    lastClientY = e.clientY;

    if (hit.isGrip) {
      e.preventDefault();
      enterDragMode();
    } else {
      holdTimer = setTimeout(() => {
        holdTimer = null;
        enterDragMode();
      }, 210);
    }
  });

  document.addEventListener("mousemove", (e) => {
    if (activePointerType !== "mouse") return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (!isDragging) {
      if (Math.abs(dx) > 7 || Math.abs(dy) > 7) {
        clearHoldTimer();
        dragRow = null;
        dragList = null;
        activePointerType = null;
      }
      return;
    }

    e.preventDefault();
    updateDragPosition(e.clientX, e.clientY);
  });

  document.addEventListener("mouseup", () => {
    if (activePointerType !== "mouse") return;
    finishDrag();
  });

  // Prevent browser long-press context menu while reordering topics
  document.addEventListener("contextmenu", (e) => {
    if (isDragging || window._isReorderingTopic || e.target?.closest?.(".ios-topic-grip")) {
      e.preventDefault();
    }
  });

  // Capture-phase click guard so releasing a dragged topic never triggers openLoopSheet
  document.addEventListener(
    "click",
    (e) => {
      if (
        window._isReorderingTopic ||
        (window._suppressTopicClickUntil && Date.now() < window._suppressTopicClickUntil) ||
        e.target?.closest?.(".ios-topic-grip")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true
  );
}

function initPullToRefresh() {
  const stage = document.getElementById("main-stage");
  const ptr = document.getElementById("ios-ptr-indicator");
  const label = document.getElementById("ios-ptr-label");
  if (!stage || !ptr) return;

  let pulling = false;
  let refreshing = false;
  let startX = 0;
  let startY = 0;
  let pullPx = 0;

  stage.addEventListener(
    "touchstart",
    (e) => {
      if (refreshing || stage.scrollTop > 0 || document.body.classList.contains("has-open-sheet")) {
        pulling = false;
        return;
      }
      if (
        e.target.closest(
          "input, textarea, select, .today-week-strip, .chip-row, .filter-bar, #sheet-backdrop"
        )
      ) {
        pulling = false;
        return;
      }
      const t = e.touches[0];
      if (!t) return;
      pulling = true;
      startX = t.clientX;
      startY = t.clientY;
      pullPx = 0;
    },
    { passive: true }
  );

  stage.addEventListener(
    "touchmove",
    (e) => {
      if (!pulling || refreshing) return;
      if (stage.scrollTop > 0) {
        pulling = false;
        ptr.style.height = "0px";
        ptr.style.opacity = "0";
        ptr.classList.remove("ptr-dragging");
        return;
      }
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (dy <= 14 || Math.abs(dx) * 1.5 > dy) {
        if (pullPx > 0 && dy <= 0) {
          pullPx = 0;
          ptr.style.height = "0px";
          ptr.style.opacity = "0";
          ptr.classList.remove("ptr-dragging");
        }
        return;
      }
      pullPx = Math.min(72, Math.round((dy - 14) * 0.42));
      ptr.classList.add("ptr-dragging");
      ptr.style.height = `${pullPx}px`;
      ptr.style.opacity = String(Math.min(1, pullPx / 38));
      if (label) {
        label.textContent = pullPx >= 48 ? "Release to sync" : "Pull to sync";
      }
    },
    { passive: true }
  );

  const finishPull = async () => {
    if (!pulling) return;
    pulling = false;
    ptr.classList.remove("ptr-dragging");
    if (pullPx >= 48 && !refreshing) {
      refreshing = true;
      pullPx = 0;
      ptr.classList.add("ptr-refreshing");
      ptr.style.height = "44px";
      ptr.style.opacity = "1";
      if (label) label.textContent = "Syncing…";
      try {
        if (state.user && state.isOwner && typeof syncFromSupabase === "function") {
          await syncFromSupabase();
        }
      } catch (_) {}
      setTimeout(() => {
        ptr.classList.remove("ptr-refreshing");
        ptr.style.height = "0px";
        ptr.style.opacity = "0";
        refreshing = false;
      }, 180);
    } else {
      pullPx = 0;
      ptr.style.height = "0px";
      ptr.style.opacity = "0";
      setTimeout(() => {
        if (!pulling && !refreshing) {
          ptr.style.height = "";
          ptr.style.opacity = "";
        }
      }, 240);
    }
  };

  stage.addEventListener("touchend", finishPull, { passive: true });
  stage.addEventListener("touchcancel", finishPull, { passive: true });
}

/* --- Direct Magic Link / Token Hash / Localhost URL Verification --- */
let magicPollTimer = null;

async function verifyTokenOrPastedUrl(rawInput) {
  if (!sb || !rawInput) return false;
  const trimmed = String(rawInput).trim();
  if (!trimmed) return false;

  try {
    let searchParams = null;
    let hashParams = null;

    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const u = new URL(trimmed);
      searchParams = u.searchParams;
      if (u.hash && u.hash.length > 1) {
        hashParams = new URLSearchParams(u.hash.slice(1));
      }
    } else if (trimmed.includes("access_token=") || trimmed.includes("token=")) {
      const cleaned = trimmed.replace(/^[?#]/, "");
      searchParams = new URLSearchParams(cleaned);
      hashParams = searchParams;
    }

    const accessToken = hashParams?.get("access_token") || searchParams?.get("access_token");
    const refreshToken = hashParams?.get("refresh_token") || searchParams?.get("refresh_token");
    if (accessToken && refreshToken) {
      setAuthStatus("Signing in...", "");
      const { data, error } = await sb.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });
      if (error) {
        setAuthStatus(error.message, "error");
        return false;
      }
      if (window.location.search || window.location.hash) {
        window.history.replaceState({}, "", "/");
      }
      await handleSessionChange(data?.session || null);
      return true;
    }

    const tokenHash =
      searchParams?.get("token_hash") ||
      searchParams?.get("token") ||
      hashParams?.get("token_hash") ||
      hashParams?.get("token");
    const otpType = searchParams?.get("type") || hashParams?.get("type") || "magiclink";

    if (tokenHash) {
      setAuthStatus("Verifying Magic Link...", "");
      const { data, error } = await sb.auth.verifyOtp({
        token_hash: tokenHash,
        type: otpType
      });
      if (error) {
        setAuthStatus(error.message, "error");
        return false;
      }
      if (window.location.search || window.location.hash) {
        window.history.replaceState({}, "", "/");
      }
      await handleSessionChange(data?.session || null);
      return true;
    }
  } catch (err) {
    setAuthStatus("Could not parse link: " + String(err.message || err), "error");
  }
  return false;
}

async function pollMagicChallengeOnce() {
  if (!sb || state.user) return false;
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem("nd_magic_challenge") || "null");
  } catch (_) {}
  if (!stored || !stored.challenge_id || !stored.challenge_secret) return false;

  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/owner-auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "poll_challenge",
        challenge_id: stored.challenge_id,
        challenge_secret: stored.challenge_secret
      })
    });
    if (!resp.ok) return false;
    const json = await resp.json();
    if (json && json.verified && json.token_hash) {
      localStorage.removeItem("nd_magic_challenge");
      if (magicPollTimer) {
        clearInterval(magicPollTimer);
        magicPollTimer = null;
      }
      setAuthStatus("Magic link verified! Signing you in...", "ok");
      const { data, error } = await sb.auth.verifyOtp({
        token_hash: json.token_hash,
        type: json.verification_type || "magiclink"
      });
      if (!error && data?.session) {
        await handleSessionChange(data.session);
        return true;
      }
    } else if (json && (json.reason === "expired" || json.reason === "already_consumed")) {
      localStorage.removeItem("nd_magic_challenge");
      if (magicPollTimer) {
        clearInterval(magicPollTimer);
        magicPollTimer = null;
      }
    }
  } catch (_) {}
  return false;
}

function startMagicChallengePolling() {
  if (magicPollTimer) clearInterval(magicPollTimer);
  magicPollTimer = setInterval(() => {
    pollMagicChallengeOnce();
  }, 1500);
}

/* --- Boot & Event Wiring --- */
document.addEventListener("DOMContentLoaded", async () => {
  applyDeviceMode();
  const hadCachedSnapshot = hydrateBootSnapshot();
  renderTodayWeekStrip();
  if (hadCachedSnapshot) {
    updateDynamicCounts();
    renderAll();
    if (document.documentElement.getAttribute("data-has-saved-auth") === "true") {
      dismissBootSplash();
    }
  }
  setTimeout(dismissBootSplash, 1800);
  window.addEventListener("resize", () => {
    applyDeviceMode();
    syncAllSegmentedPills();
  });
  document.addEventListener("click", (e) => {
    const seg = e.target.closest?.(".topbar-mode-seg, .inline-mini-seg, .theme-segmented-control");
    if (seg) {
      syncSegmentedPill(seg);
      requestAnimationFrame(() => syncSegmentedPill(seg));
    }
  });
  requestAnimationFrame(() => syncAllSegmentedPills());
  initTouchAndContextGestures();
  initTopicReorderGestures();
  initPullToRefresh();

  document.getElementById("btn-ios-undo")?.addEventListener("click", () => {
    const fn = currentUndoFn;
    currentUndoFn = null;
    document.getElementById("ios-undo-toast").hidden = true;
    if (typeof fn === "function") fn();
  });

  document.getElementById("ios-context-backdrop")?.addEventListener("click", (e) => {
    if (e.target.id === "ios-context-backdrop") {
      document.getElementById("ios-context-backdrop").hidden = true;
    }
  });

  let lastFocusSyncAt = 0;
  const maybeSyncOnResume = () => {
    pollMagicChallengeOnce();
    const now = Date.now();
    if (state.user && state.isOwner && now - lastFocusSyncAt > 15000) {
      lastFocusSyncAt = now;
      syncFromSupabase();
    }
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      maybeSyncOnResume();
    }
  });
  window.addEventListener("focus", () => {
    maybeSyncOnResume();
  });
  window.addEventListener("pageshow", () => {
    maybeSyncOnResume();
  });

  if (window.location.search.includes("token") || window.location.hash.includes("access_token")) {
    await verifyTokenOrPastedUrl(window.location.href);
  }

  if (localStorage.getItem("nd_magic_challenge")) {
    startMagicChallengePolling();
    pollMagicChallengeOnce();
  }

  document.getElementById("auth-login-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!sb) return;
    const email = (document.getElementById("auth-email")?.value || "").trim();
    const password = document.getElementById("auth-password")?.value || "";
    if (!email || !password) {
      setAuthStatus("Enter both email and password, or tap Send Magic Link.", "error");
      return;
    }
    setAuthStatus("Signing in...", "");
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthStatus(error.message, "error");
      return;
    }
    await handleSessionChange(data?.session || null);
  });

  document.getElementById("btn-auth-magic")?.addEventListener("click", async () => {
    if (!sb) return;
    const email = (document.getElementById("auth-email")?.value || "").trim().toLowerCase();
    if (!email) {
      setAuthStatus("Enter your owner email first.", "error");
      return;
    }
    setAuthStatus("Sending magic link...", "");
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: "https://nickdrake.ai" }
    });
    if (error) {
      setAuthStatus(error.message, "error");
      return;
    }

    try {
      const chResp = await fetch(`${SUPABASE_URL}/functions/v1/owner-auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start_challenge", email })
      });
      const chJson = await chResp.json();
      if (chJson && chJson.challenge_id && chJson.challenge_secret) {
        localStorage.setItem("nd_magic_challenge", JSON.stringify(chJson));
        startMagicChallengePolling();
      }
    } catch (_) {}

    setAuthStatus(
      `Magic link sent to ${email}! Tap "Sign in" in Gmail, then switch right back here — it will sign you in automatically.`,
      "ok"
    );
  });

  document.getElementById("btn-auth-paste")?.addEventListener("click", async () => {
    const val = (document.getElementById("auth-paste-link")?.value || "").trim();
    if (!val) {
      setAuthStatus("Paste the sign-in link from Gmail or localhost URL first.", "error");
      return;
    }
    const ok = await verifyTokenOrPastedUrl(val);
    if (!ok) {
      setAuthStatus("Could not verify that link. Tap Send Magic Link to Email for a fresh one.", "error");
    }
  });

  document.getElementById("btn-restricted-signout")?.addEventListener("click", async () => {
    if (sb) await sb.auth.signOut();
    await handleSessionChange(null);
  });

  document.querySelectorAll(".side-nav-btn, .ios-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchTab(btn.getAttribute("data-tab") || "today");
    });
  });

  configureAuthGateForRoute();

  document.getElementById("debrief-filter-chips")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".filter-chip");
    if (!btn) return;
    state.debriefFilter = btn.getAttribute("data-dfilter") || "unanswered";
    document
      .querySelectorAll("#debrief-filter-chips .filter-chip")
      .forEach((b) => b.classList.toggle("active", b === btn));
    renderBriefsView();
  });

  document.getElementById("brief-type-chips")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".filter-chip");
    if (!btn) return;
    state.briefTypeFilter = btn.getAttribute("data-btype") || "ALL";
    document
      .querySelectorAll("#brief-type-chips .filter-chip")
      .forEach((b) => b.classList.toggle("active", b === btn));
    renderBriefsView();
  });

  document.getElementById("people-mode-seg")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".inline-mini-pill");
    if (!btn) return;
    state.personMode = btn.getAttribute("data-pmode") || "people";
    renderPeople();
    triggerListFadeLift("people-grid");
  });

  document.getElementById("people-loc-chips")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".filter-chip");
    if (!btn) return;
    state.personLoc = btn.getAttribute("data-loc") || "ALL";
    if (state.personLoc === "AI") state.personMode = "people";
    document
      .querySelectorAll("#people-loc-chips .filter-chip")
      .forEach((b) => b.classList.toggle("active", b === btn));
    renderPeople();
    triggerListFadeLift("people-grid");
  });

  document.getElementById("project-loc-chips")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".filter-chip");
    if (!btn) return;
    state.projectLoc = btn.getAttribute("data-loc") || "ALL";
    document
      .querySelectorAll("#project-loc-chips .filter-chip")
      .forEach((b) => b.classList.toggle("active", b === btn));
    renderProjects();
    triggerListFadeLift("projects-grid");
  });

  document.getElementById("loop-type-chips")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".filter-chip");
    if (!btn) return;
    state.loopType = btn.getAttribute("data-type") || "ALL";
    document
      .querySelectorAll("#loop-type-chips .filter-chip")
      .forEach((b) => b.classList.toggle("active", b === btn));
    renderLoops();
    triggerListFadeLift("loops-list");
  });

  document.getElementById("memory-source-chips")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".filter-chip");
    if (!btn) return;
    state.memorySrc = btn.getAttribute("data-src") || "ALL";
    document
      .querySelectorAll("#memory-source-chips .filter-chip")
      .forEach((b) => b.classList.toggle("active", b === btn));
    renderMemory();
    triggerListFadeLift("memory-list");
  });

  document.getElementById("people-filter-input")?.addEventListener("input", renderPeople);
  document.getElementById("project-filter-input")?.addEventListener("input", renderProjects);
  document.getElementById("loop-filter-input")?.addEventListener("input", renderLoops);
  const submitLoopsViewQuickAdd = async () => {
    const inp = document.getElementById("loops-quick-add-input");
    const btn = document.getElementById("btn-loops-quick-add");
    const txt = (inp?.value || "").trim();
    if (!txt || !sb) return;
    window._lastAddedItemText = txt.toLowerCase();
    if (inp) inp.disabled = true;
    if (btn) { btn.disabled = true; btn.textContent = "Saving..."; }
    const isWait = state.loopType === "waiting_on";
    const isTopic = state.loopType === "coaching_note";
    if (isTopic) {
      if (inp) { inp.disabled = false; inp.value = ""; }
      if (btn) { btn.disabled = false; btn.textContent = "+ Add"; }
      openQuickCreate("di", "", "", "", txt);
      return;
    }
    const { error } = await sb.rpc("create_profile_item", {
      p_profile_type: "person",
      p_profile_slug: "nick-drake",
      p_item_type: isTopic ? "discussion_item" : isWait ? "waiting_on" : "open_loop",
      p_what_summary: txt,
      p_bucket: isTopic ? "agenda" : isWait ? "waiting" : "mine"
    });
    if (inp) { inp.disabled = false; inp.value = ""; }
    if (btn) { btn.disabled = false; btn.textContent = "+ Add"; }
    if (error) {
      alert("Error adding item: " + error.message);
      return;
    }
    await syncFromSupabase();
    showUndoToast("Added item", null);
  };
  document.getElementById("btn-loops-quick-add")?.addEventListener("click", submitLoopsViewQuickAdd);
  document.getElementById("loops-quick-add-input")?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      submitLoopsViewQuickAdd();
    }
  });
  document.getElementById("memory-filter-input")?.addEventListener("input", renderMemory);

  document.getElementById("btn-ask-assistant")?.addEventListener("click", () => {
    runInstantAsk(document.getElementById("global-search")?.value);
  });
  document.getElementById("global-search")?.addEventListener("input", (e) => {
    runInstantAsk(e.target.value);
  });
  document.getElementById("global-search")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runInstantAsk(e.target.value);
    if (e.key === "Escape") {
      window.clearSpotlightSearch();
      e.target.blur();
    }
  });
  document.getElementById("btn-spotlight-clear")?.addEventListener("click", () => {
    window.clearSpotlightSearch();
    document.getElementById("global-search")?.focus();
  });
  document.getElementById("notes-cat-chips")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".filter-chip");
    if (!btn) return;
    state.noteCat = btn.getAttribute("data-ncat") || "ALL";
    document
      .querySelectorAll("#notes-cat-chips .filter-chip")
      .forEach((b) => b.classList.toggle("active", b === btn));
    renderNotesView();
    triggerListFadeLift("notes-list");
  });


  // iOS Sheet Swipe-Down-to-Dismiss
  (function initSheetSwipeDismiss() {
    const panel = document.getElementById("sheet-panel");
    const backdrop = document.getElementById("sheet-backdrop");
    if (!panel || !backdrop) return;
    let startY = 0;
    let currentY = 0;
    let dragging = false;
    panel.addEventListener("touchstart", (e) => {
      if (window._isReorderingTopic || e.target?.closest?.(".ios-topic-grip")) return;
      const target = e.target;
      const bodyEl = document.getElementById("sheet-body");
      const inHeader = target.closest(".sheet-header") || target.closest(".sheet-grabber-wrap");
      const atTopOfBody = bodyEl && bodyEl.scrollTop <= 0 && !target.closest("input, textarea, select, button, .ios-topic-grip");
      if (!inHeader && !atTopOfBody) return;
      startY = e.touches[0].clientY;
      currentY = 0;
      dragging = true;
      panel.style.transition = "none";
    }, { passive: true });
    panel.addEventListener("touchmove", (e) => {
      if (window._isReorderingTopic) {
        if (dragging) {
          dragging = false;
          currentY = 0;
          panel.style.transform = "";
        }
        return;
      }
      if (!dragging) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 0) {
        currentY = dy;
        panel.style.transform = `translateY(${dy}px)`;
      }
    }, { passive: true });
    panel.addEventListener("touchend", () => {
      if (!dragging) return;
      dragging = false;
      panel.style.transition = "transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)";
      if (currentY > 88) {
        panel.style.transform = "translateY(100%)";
        setTimeout(() => {
          backdrop.hidden = true;
          panel.style.transform = "";
        }, 220);
      } else {
        panel.style.transform = "";
      }
    });
  })();

  document.getElementById("btn-sheet-back")?.addEventListener("click", () => {
    window.popSheetHistory();
  });
  document.getElementById("btn-close-sheet")?.addEventListener("click", () => {
    window.closeSheetAndReset();
  });
  document.getElementById("sheet-backdrop")?.addEventListener("click", (e) => {
    if (e.target.id === "sheet-backdrop") {
      window.closeSheetAndReset();
    }
  });
  setAppTheme(getAppTheme());
  document.getElementById("btn-auth-sheet")?.addEventListener("click", toggleUserDropdown);
  document.getElementById("btn-menu-health")?.addEventListener("click", () => {
    closeUserDropdown();
    switchTab("health");
  });
  document.getElementById("btn-menu-memory")?.addEventListener("click", () => {
    closeUserDropdown();
    switchTab("memory");
  });
  document.getElementById("btn-menu-account")?.addEventListener("click", () => {
    closeUserDropdown();
    openAuthSheet();
  });
  document.getElementById("btn-menu-health-access")?.addEventListener("click", () => {
    closeUserDropdown();
    if (window.openHealthAccessSheet) window.openHealthAccessSheet();
  });
  document.getElementById("btn-menu-refresh")?.addEventListener("click", async () => {
    closeUserDropdown();
    await syncFromSupabase();
  });
  document.getElementById("btn-menu-signout")?.addEventListener("click", async () => {
    closeUserDropdown();
    if (sb) await sb.auth.signOut();
    await handleSessionChange(null);
  });
  document.addEventListener("click", (e) => {
    const wrap = document.getElementById("user-menu-wrap");
    if (wrap && !wrap.contains(e.target)) {
      closeUserDropdown();
    }
  });
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      const sInp = document.getElementById("global-search");
      if (sInp && !document.getElementById("global-search-strip")?.hidden) {
        sInp.focus();
        sInp.select();
      }
      return;
    }
    if (e.key === "Escape") {
      closeUserDropdown();
      const backdrop = document.getElementById("sheet-backdrop");
      if (backdrop && !backdrop.hidden) {
        window.closeSheetAndReset();
      }
    }
  });
  document.getElementById("btn-quick-create")?.addEventListener("click", () => openQuickCreate(""));
  document.getElementById("btn-top-memory")?.addEventListener("click", () => switchTab("memory"));
  document.getElementById("notes-filter-input")?.addEventListener("input", renderNotesView);
  window.openAuthSheet = openAuthSheet;
  prefetchPasskeyLoginOptions();
  setTimeout(() => { prefetchPasskeyRegisterOptions(); }, 600);

  document.getElementById("btn-save-note")?.addEventListener("click", async () => {
    const text = (document.getElementById("quick-note-text")?.value || "").trim();
    const statusEl = document.getElementById("quick-note-status");
    if (!text || !sb || !state.user) return;
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    await sb.from("journal").insert({
      id: "JRN-" + Date.now(),
      entry_date: today,
      category: "Quick Note",
      summary: text.length > 80 ? text.slice(0, 77) + "..." : text,
      details: text,
      entry: text,
      tags: "",
      source: "nickdrake.ai"
    }).then(({ error }) => { if (error) throw error; syncFromSupabase(); }).catch((err) => {
      if (statusEl) { statusEl.hidden = false; statusEl.textContent = "Error: " + err.message; }
      throw err;
    });
    if (statusEl) {
      statusEl.hidden = false;
      statusEl.textContent = "Saved note.";
    }
    document.getElementById("quick-note-text").value = "";
  });

  if (sb) {
    sb.auth.onAuthStateChange((_event, session) => {
      handleSessionChange(session);
    });
    const { data } = await sb.auth.getSession();
    await handleSessionChange(data?.session || null);
  }
});
