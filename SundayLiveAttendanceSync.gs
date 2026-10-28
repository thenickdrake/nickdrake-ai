/**
 * Action Church — Sunday Live Attendance Sync to Supabase (with Per-Service Breakdown)
 * Attached to: 2026 Attendance Sheet (1RAliC53liZS6ohPXcdqk4ixHC9_2TUurTE0gIstpz6Q)
 *
 * How it works:
 * 1. Runs automatically every 1 minute on Sundays (5:00 AM – 3:00 PM ET) AND on sheet edit.
 * 2. Reads the active Sunday row from "Summary Sheet" + per-location tabs ("WP Attendance",
 *    "OV Attendance", "SF Attendance", "WS Attendance", "HW Attendance"), including per-service
 *    Adults, Kids, A-Team (Exp / Guest Svcs / Kids), Action Steps, and Baptisms.
 * 3. Compares a fingerprint in PropertiesService so it only sends an HTTP POST when a number
 *    actually changes (0 wasted calls, 0 AI wakes).
 * 4. Upserts directly into Supabase (`public.sunday_attendance_live`) via the Edge Function:
 *    https://tjnvjsjlyjcmrjyyslaa.supabase.co/functions/v1/sync-sunday-attendance
 */

const SUPABASE_SYNC_URL = "https://tjnvjsjlyjcmrjyyslaa.supabase.co/functions/v1/sync-sunday-attendance";
const SUPABASE_SYNC_KEY = "<SYNC_KEY_REDACTED>";
const SHEET_ID = "1RAliC53liZS6ohPXcdqk4ixHC9_2TUurTE0gIstpz6Q";

/**
 * Run this function ONCE from the Apps Script editor to install the automatic triggers.
 * After running setupSundayLiveTriggers() once, you never have to touch it again.
 */
function setupSundayLiveTriggers() {
  const existing = ScriptApp.getProjectTriggers();
  for (const t of existing) {
    const fn = t.getHandlerFunction();
    if (fn === "syncSundayAttendanceIfWindow" || fn === "onSundaySheetEdit") {
      ScriptApp.deleteTrigger(t);
    }
  }

  // 1. Time-driven trigger: checks every 1 minute (active window gated to Sundays 5am–3pm ET)
  ScriptApp.newTrigger("syncSundayAttendanceIfWindow")
    .timeBased()
    .everyMinutes(1)
    .create();

  // 2. Instant edit trigger: fires immediately whenever someone edits the sheet on Sunday
  ScriptApp.newTrigger("onSundaySheetEdit")
    .forSpreadsheet(SHEET_ID)
    .onEdit()
    .create();

  // Run an initial sync right away to verify connectivity
  syncSundayAttendanceNow(true);
}

function onSundaySheetEdit() {
  syncSundayAttendanceIfWindow();
}

function syncSundayAttendanceIfWindow() {
  const now = new Date();
  const etDay = Utilities.formatDate(now, "America/New_York", "u"); // "7" = Sunday
  const etHour = parseInt(Utilities.formatDate(now, "America/New_York", "H"), 10);
  // Active on Sundays between 8:00 AM and 3:00 PM ET
  if (etDay !== "7" || etHour < 5 || etHour > 15) {
    return;
  }
  syncSundayAttendanceNow(false);
}

function parseNum(v) {
  if (typeof v === "number") return Math.round(v);
  const cleaned = String(v || "").replace(/,/g, "").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : Math.round(n);
}

function formatIsoDate(cellVal) {
  if (cellVal instanceof Date) {
    return Utilities.formatDate(cellVal, "America/New_York", "yyyy-MM-dd");
  }
  const s = String(cellVal || "").trim();
  const m = s.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})$/);
  if (!m) return null;
  const mm = m[1].padStart(2, "0");
  const dd = m[2].padStart(2, "0");
  const yyyy = m[3].length === 2 ? "20" + m[3] : m[3];
  return `${yyyy}-${mm}-${dd}`;
}

function formatShortLabel(isoDate) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const parts = isoDate.split("-");
  const mIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return `${months[mIdx]} ${day}`;
}

function formatSlashDate(isoDate) {
  const parts = isoDate.split("-");
  return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}/${parts[0]}`;
}

function parseLocationRow(code, r, slashDate) {
  const salv = parseNum(r[2]);
  const tot = parseNum(r[3]);
  if (code === "WP") {
    return {
      d: slashDate,
      salv: salv,
      tot: tot,
      a: [parseNum(r[8]), parseNum(r[13]), parseNum(r[18]), parseNum(r[23])],
      k: [parseNum(r[25]), parseNum(r[26]), parseNum(r[27]), parseNum(r[28])],
      kt: parseNum(r[29]),
      t: [parseNum(r[31]), parseNum(r[32]), parseNum(r[33])],
      tt: parseNum(r[34]),
      st: parseNum(r[40]),
      bp: parseNum(r[46]),
    };
  }
  if (code === "OV") {
    return {
      d: slashDate,
      salv: salv,
      tot: tot,
      a: [parseNum(r[8]), parseNum(r[13]), parseNum(r[18])],
      k: [parseNum(r[20]), parseNum(r[21]), parseNum(r[22])],
      kt: parseNum(r[23]),
      t: [parseNum(r[25]), parseNum(r[26]), parseNum(r[27])],
      tt: parseNum(r[28]),
      st: parseNum(r[31]),
      bp: parseNum(r[37]),
    };
  }
  if (code === "SF") {
    return {
      d: slashDate,
      salv: salv,
      tot: tot,
      a: [parseNum(r[9]), parseNum(r[15]), parseNum(r[21])],
      k: [parseNum(r[23]), parseNum(r[24]), parseNum(r[25])],
      kt: parseNum(r[26]),
      t: [parseNum(r[28]), parseNum(r[29]), parseNum(r[30])],
      tt: parseNum(r[31]),
      st: parseNum(r[35]),
      bp: parseNum(r[40]),
    };
  }
  // WS and HW (2 services; auto-includes 3rd service if col 15 > 0)
  const a3 = parseNum(r[15]);
  const k3 = parseNum(r[19]);
  return {
    d: slashDate,
    salv: salv,
    tot: tot,
    a: a3 > 0 ? [parseNum(r[7]), parseNum(r[11]), a3] : [parseNum(r[7]), parseNum(r[11])],
    k: a3 > 0 ? [parseNum(r[17]), parseNum(r[18]), k3] : [parseNum(r[17]), parseNum(r[18])],
    kt: parseNum(r[20]),
    t: [parseNum(r[22]), parseNum(r[23]), parseNum(r[24])],
    tt: parseNum(r[25]),
    st: parseNum(r[28]),
    bp: parseNum(r[34]),
  };
}

function syncSundayAttendanceNow(forcePush) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sumSheet = ss.getSheetByName("Summary Sheet");
  if (!sumSheet) return;

  const rows = sumSheet.getDataRange().getDisplayValues();
  const todayIso = Utilities.formatDate(new Date(), "America/New_York", "yyyy-MM-dd");

  // Find latest Sunday row with total > 0 (or today's row if any location has started inputting)
  let targetRow = null;
  let targetIso = null;
  for (let i = 4; i < rows.length; i++) {
    const r = rows[i];
    const iso = formatIsoDate(r[0]);
    if (!iso || iso > todayIso) continue;
    const total = parseNum(r[5]);
    if (total > 0) {
      targetRow = r;
      targetIso = iso;
    }
  }
  if (!targetRow || !targetIso) return;

  const slashDate = formatSlashDate(targetIso);

  // Read location salvations ("Hands" col 2) and full per-service row from each location tab
  const locTabs = {
    WP: "WP Attendance",
    OV: "OV Attendance",
    SF: "SF Attendance",
    WS: "WS Attendance",
    HW: "HW Attendance",
  };
  const locHands = { WP: 0, OV: 0, SF: 0, WS: 0, HW: 0 };
  const services_json = {};
  for (const code of Object.keys(locTabs)) {
    const sh = ss.getSheetByName(locTabs[code]);
    if (!sh) continue;
    const lRows = sh.getDataRange().getDisplayValues();
    for (let i = 4; i < lRows.length; i++) {
      if (formatIsoDate(lRows[i][0]) === targetIso) {
        locHands[code] = parseNum(lRows[i][2]);
        services_json[code] = parseLocationRow(code, lRows[i], slashDate);
        break;
      }
    }
  }

  const locs_json = {
    ALL: {
      adults: parseNum(targetRow[2]),
      kids: parseNum(targetRow[3]),
      team: parseNum(targetRow[4]),
      total: parseNum(targetRow[5]),
      salvations: parseNum(targetRow[6]),
      total2025: null,
      yoyPct: null,
    },
    WP: {
      adults: parseNum(targetRow[8]),
      kids: parseNum(targetRow[9]),
      team: parseNum(targetRow[10]),
      total: parseNum(targetRow[11]),
      salvations: locHands.WP,
      total2025: null,
      yoyPct: null,
    },
    OV: {
      adults: parseNum(targetRow[13]),
      kids: parseNum(targetRow[14]),
      team: parseNum(targetRow[15]),
      total: parseNum(targetRow[16]),
      salvations: locHands.OV,
      total2025: null,
      yoyPct: null,
    },
    SF: {
      adults: parseNum(targetRow[18]),
      kids: parseNum(targetRow[19]),
      team: parseNum(targetRow[20]),
      total: parseNum(targetRow[21]),
      salvations: locHands.SF,
      total2025: null,
      yoyPct: null,
    },
    WS: {
      adults: parseNum(targetRow[23]),
      kids: parseNum(targetRow[24]),
      team: parseNum(targetRow[25]),
      total: parseNum(targetRow[26]),
      salvations: locHands.WS,
      total2025: null,
      yoyPct: null,
    },
    HW: {
      adults: parseNum(targetRow[28]),
      kids: parseNum(targetRow[29]),
      team: parseNum(targetRow[30]),
      total: parseNum(targetRow[31]),
      salvations: locHands.HW,
      total2025: null,
      yoyPct: null,
    },
  };

  const payload = {
    sunday_date: targetIso,
    sunday_label: formatShortLabel(targetIso),
    is_live: targetIso === todayIso,
    services_completed: targetIso === todayIso ? "Live Sunday Sync" : "All Services Complete",
    locs_json: locs_json,
    services_json: services_json,
  };

  const fingerprint = JSON.stringify({ d: payload.sunday_date, l: payload.locs_json, s: payload.services_json });
  const props = PropertiesService.getScriptProperties();
  if (!forcePush && props.getProperty("LAST_SYNC_HASH") === fingerprint) {
    return; // No change since last check
  }

  const res = UrlFetchApp.fetch(SUPABASE_SYNC_URL, {
    method: "post",
    contentType: "application/json",
    headers: { "x-sync-key": SUPABASE_SYNC_KEY },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  if (res.getResponseCode() >= 200 && res.getResponseCode() < 300) {
    props.setProperty("LAST_SYNC_HASH", fingerprint);
  }
}
