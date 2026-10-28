#!/usr/bin/env python3
"""
Canonical build, bundle, and pre-deploy regression verification script for nickdrake.ai.
Enforces:
1. Single canonical Health & Engagement source (/workspace/church-health/current_live_canvas.tsx)
2. Top bar cleanliness: ONLY Quick-Create (+) and Nick Drake dropdown in .topbar-right
   (NO standalone Face ID, Memory, or Access buttons in topbar)
3. Memory and Settings & Face ID inside #user-dropdown-menu, and Face ID passkey manager inside Settings sheet
4. No Briefs/Debriefs strip on Today view (#today-brief-debrief-strip hidden and empty)
5. Mobile top bar and bottom bar compact padding + iOS 26 status-bar blur clearance (>= 90pt)
6. Full React SSR render verification of HealthDashboardApp before building worker.mjs
7. Real headless Google Chrome verification on mobile (430x932 @ 3x) and desktop (1280x800) viewports
"""
import base64
import http.server
import json
import os
import re
import socketserver
import subprocess
import sys
import threading
import time
import urllib.request

ROOT = "/workspace/nickdrake-ai"
LOCAL_CANVAS_SRC = "/workspace/nickdrake-ai/current_live_canvas.tsx"
CANVAS_SRC = "/workspace/church-health/current_live_canvas.tsx"
if os.path.exists(LOCAL_CANVAS_SRC):
    with open(LOCAL_CANVAS_SRC, "r", encoding="utf-8") as _f:
        _local_tsx = _f.read()
    with open(CANVAS_SRC, "w", encoding="utf-8") as _f:
        _f.write(_local_tsx)
BUILD_DIR = "/tmp/build-tools"

def fail(msg):
    print(f"PRE-DEPLOY CHECK FAILED: {msg}", file=sys.stderr)
    sys.exit(1)

def verify_css_statusbar_cascade(css: str):
    # Ensure .ios-statusbar-spacer is never set to display: none after its first @media (max-width: 760px) block,
    # except inside @media (min-width: 761px).
    first_mobile_idx = css.find("@media (max-width: 760px)")
    if first_mobile_idx == -1:
        fail("styles.css is missing @media (max-width: 760px) block.")
    tail = css[first_mobile_idx:]
    # Remove any @media (min-width: 761px) { ... } blocks from tail before checking for display: none on .ios-statusbar-spacer
    tail_no_desktop = re.sub(
        r"@media\s*\(\s*min-width:\s*761px\s*\)\s*\{[^}]*\{[^}]*\}[^}]*\}",
        "",
        tail,
        flags=re.S,
    )
    if re.search(r"ios-statusbar-spacer\s*\{[^}]*display\s*:\s*none", tail_no_desktop, flags=re.S):
        fail("styles.css sets .ios-statusbar-spacer { display: none } after @media (max-width: 760px) outside a desktop @media (min-width: 761px) guard!")

def run_headless_chrome_verification(version: str):
    # Serve /workspace/nickdrake-ai on an ephemeral port
    class QuietHandler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=ROOT, **kwargs)
        def log_message(self, format, *args):
            pass

    httpd = socketserver.TCPServer(("127.0.0.1", 0), QuietHandler)
    port = httpd.server_address[1]
    srv_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    srv_thread.start()

    cdp_port = 9333
    chrome_proc = subprocess.Popen(
        [
            "/usr/bin/google-chrome",
            "--headless=new",
            "--no-sandbox",
            "--disable-gpu",
            "--disable-dev-shm-usage",
            f"--remote-debugging-port={cdp_port}",
            "--window-size=430,932",
            f"http://127.0.0.1:{port}/index.html?v={version}",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    try:
        ws_url = None
        for _ in range(40):
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{cdp_port}/json") as resp:
                    targets = json.loads(resp.read().decode())
                    for t in targets:
                        if t.get("type") == "page" and "webSocketDebuggerUrl" in t:
                            ws_url = t["webSocketDebuggerUrl"]
                            break
                if ws_url:
                    break
            except Exception:
                pass
            time.sleep(0.15)

        if not ws_url:
            fail("Could not connect to headless Chrome DevTools target.")

        node_cdp_script = f"""
const fs = require('fs');
const ws = new WebSocket({json.dumps(ws_url)});
let seq = 1;
const pending = new Map();

function send(method, params = {{}}) {{
  return new Promise((resolve, reject) => {{
    const id = seq++;
    pending.set(id, {{ resolve, reject }});
    ws.send(JSON.stringify({{ id, method, params }}));
  }});
}}

ws.onmessage = (ev) => {{
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {{
    const {{ resolve, reject }} = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  }}
}};

ws.onopen = async () => {{
  try {{
    await send('Page.enable');
    await send('Runtime.enable');

    // 1. Mobile viewport (430x932 @ 3x)
    await send('Emulation.setDeviceMetricsOverride', {{
      width: 430,
      height: 932,
      deviceScaleFactor: 3,
      mobile: true
    }});

    await new Promise(r => setTimeout(r, 500));

    // Reveal app-shell just like authenticated state on Nick's iPhone
    const mobileEval = await send('Runtime.evaluate', {{
      expression: `(() => {{
        const gate = document.getElementById('auth-gate');
        if (gate) gate.hidden = true;
        const shell = document.getElementById('app-shell');
        if (shell) {{
          shell.hidden = false;
          shell.setAttribute('data-device', 'iphone');
        }}
        if (typeof applyDeviceMode === 'function') applyDeviceMode();
        const spacer = document.getElementById('ios-statusbar-spacer');
        const topbar = document.querySelector('.topbar');
        const brandTitle = document.getElementById('topbar-brand-title');
        const modeSeg = document.getElementById('topbar-mode-seg');
        const quickCreate = document.getElementById('btn-quick-create');
        const authSheet = document.getElementById('btn-auth-sheet');
        const rect = (el) => el ? JSON.parse(JSON.stringify(el.getBoundingClientRect())) : null;
        // Test s39 Apple HIG animations on mobile
        window.switchTab('people');
        const peopleView = document.getElementById('view-people');
        const peopleTab = document.querySelector('.ios-tab[data-tab="people"]');
        const tabForwardCheck = {{
          entering: peopleView.classList.contains('view-entering'),
          dir: peopleView.getAttribute('data-nav-dir'),
          tabPop: peopleTab.classList.contains('tab-pop')
        }};

        window.switchTab('today');
        const todayView = document.getElementById('view-today');
        const tabBackCheck = {{
          entering: todayView.classList.contains('view-entering'),
          dir: todayView.getAttribute('data-nav-dir')
        }};

        // Test opening Today Calendar Meeting sheet -> drilling into 1:1 Person sheet -> popping back -> closing
        state.calendarEvents.push({{
          id: 'test-cal-1',
          title: '1:1 - Christina / Nick',
          start_at: '2026-10-27T14:00:00Z',
          end_at: '2026-10-27T15:00:00Z',
          person_slug: 'christina'
        }});
        state.personProfiles.push({{
          slug: 'christina',
          full_name: 'Christina',
          role_title: 'Executive Director',
          location_code: 'ALL',
          what_current_focus: 'Weekly 1:1 sync'
        }});
        window.openMeetingSheet('test-cal-1');
        const backdrop = document.getElementById('sheet-backdrop');
        const panel = document.getElementById('sheet-panel');
        const bodyEl = document.getElementById('sheet-body');
        const sheetOpenCheck = {{
          hidden: backdrop.hidden,
          hasOpenSheet: document.body.classList.contains('has-open-sheet'),
          panelOpening: panel.classList.contains('sheet-opening'),
          spacerTopWhileSheetOpen: rect(spacer).top,
          spacerHeightWhileSheetOpen: rect(spacer).height,
          topbarTopWhileSheetOpen: rect(topbar).top
        }};

        // Drill deeper from Calendar Meeting sheet into 1:1 Person sheet (push transition)
        window.openPersonSheet('christina');
        const sheetPushCheck = {{
          navPush: bodyEl.classList.contains('sheet-nav-push'),
          backVisible: !document.getElementById('btn-sheet-back').hidden
        }};

        // Pop back (pop transition)
        window.popSheetHistory();
        const sheetPopCheck = {{
          navPop: bodyEl.classList.contains('sheet-nav-pop')
        }};

        // Close sheet (exit animation)
        window.closeSheetAndReset();
        const sheetClosingCheck = {{
          closingClass: backdrop.classList.contains('sheet-closing'),
          hasOpenSheetAfterClose: document.body.classList.contains('has-open-sheet')
        }};
        window.closeSheetAndReset(true);

        return {{
          spacerDisplay: getComputedStyle(spacer).display,
          spacerBg: getComputedStyle(spacer).backgroundColor,
          topbarBg: getComputedStyle(topbar).backgroundColor,
          spacerRect: rect(spacer),
          topbarRect: rect(topbar),
          brandTitleRect: rect(brandTitle),
          modeSegRect: rect(modeSeg),
          quickCreateRect: rect(quickCreate),
          authSheetRect: rect(authSheet),
          tabForwardCheck,
          tabBackCheck,
          sheetOpenCheck,
          sheetPushCheck,
          sheetPopCheck,
          sheetClosingCheck
        }};
      }})()`,
      returnByValue: true
    }});

    const m = mobileEval.result.value;

    // Capture mobile screenshot
    const shot = await send('Page.captureScreenshot', {{ format: 'png' }});
    fs.writeFileSync({json.dumps(os.path.join(ROOT, f"verify_mobile_{version}.png"))}, Buffer.from(shot.data, 'base64'));

    // 2. Desktop viewport (1280x800 @ 2x)
    await send('Emulation.setDeviceMetricsOverride', {{
      width: 1280,
      height: 800,
      deviceScaleFactor: 2,
      mobile: false
    }});
    await new Promise(r => setTimeout(r, 200));

    const desktopEval = await send('Runtime.evaluate', {{
      expression: `(() => {{
        const spacer = document.getElementById('ios-statusbar-spacer');
        const topbar = document.querySelector('.topbar');
        const rect = (el) => el ? JSON.parse(JSON.stringify(el.getBoundingClientRect())) : null;
        return {{
          spacerDisplay: getComputedStyle(spacer).display,
          spacerRect: rect(spacer),
          topbarRect: rect(topbar)
        }};
      }})()`,
      returnByValue: true
    }});

    const d = desktopEval.result.value;
    console.log(JSON.stringify({{ mobile: m, desktop: d }}));
    ws.close();
    process.exit(0);
  }} catch (err) {{
    console.error(err);
    process.exit(1);
  }}
}};
"""
        res = subprocess.run(
            ["node", "--experimental-websocket", "-e", node_cdp_script],
            capture_output=True,
            text=True,
            timeout=25,
        )
        if res.returncode != 0:
            fail(f"Headless Chrome CDP check failed:\n{res.stderr}\n{res.stdout}")

        metrics = json.loads(res.stdout.strip().splitlines()[-1])
        m = metrics["mobile"]
        d = metrics["desktop"]

        if m["spacerDisplay"] != "block":
            fail(f"Mobile #ios-statusbar-spacer display is {m['spacerDisplay']!r}, expected 'block'")
        if m["spacerRect"]["height"] < 84:
            fail(f"Mobile #ios-statusbar-spacer height is {m['spacerRect']['height']}pt, expected >= 84pt")
        if m["brandTitleRect"]["top"] < 90:
            fail(f"Mobile #topbar-brand-title top is {m['brandTitleRect']['top']}pt, expected >= 90pt (clear of iOS 26 status-bar blur)")
        if m["quickCreateRect"]["top"] < 90:
            fail(f"Mobile #btn-quick-create top is {m['quickCreateRect']['top']}pt, expected >= 90pt (clear of iOS 26 status-bar blur)")
        if d["spacerDisplay"] != "none" or d["spacerRect"]["height"] != 0:
            fail(f"Desktop #ios-statusbar-spacer did not collapse: display={d['spacerDisplay']}, height={d['spacerRect']['height']}")
        if not m["tabForwardCheck"]["entering"] or m["tabForwardCheck"]["dir"] != "forward" or not m["tabForwardCheck"]["tabPop"]:
            fail(f"Tab forward animation check failed: {m['tabForwardCheck']}")
        if not m["tabBackCheck"]["entering"] or m["tabBackCheck"]["dir"] != "back":
            fail(f"Tab back animation check failed: {m['tabBackCheck']}")
        if m["sheetOpenCheck"]["hidden"] or not m["sheetOpenCheck"]["hasOpenSheet"] or not m["sheetOpenCheck"]["panelOpening"]:
            fail(f"Sheet open animation check failed: {m['sheetOpenCheck']}")
        if m["sheetOpenCheck"]["spacerHeightWhileSheetOpen"] < 84 or m["sheetOpenCheck"]["topbarTopWhileSheetOpen"] < 84:
            fail(f"Topbar/spacer shifted when sheet opened: {m['sheetOpenCheck']}")
        if not m["sheetPushCheck"]["navPush"] or not m["sheetPushCheck"]["backVisible"]:
            fail(f"Sheet navigation push check failed: {m['sheetPushCheck']}")
        if not m["sheetPopCheck"]["navPop"]:
            fail(f"Sheet navigation pop check failed: {m['sheetPopCheck']}")
        if not m["sheetClosingCheck"]["closingClass"] or m["sheetClosingCheck"]["hasOpenSheetAfterClose"]:
            fail(f"Sheet closing exit animation check failed: {m['sheetClosingCheck']}")

        print(f"HEADLESS CHROME MOBILE (430x932) & DESKTOP (1280x800) CHECK PASSED:")
        print(f"  mobile #ios-statusbar-spacer: display={m['spacerDisplay']}, rect={m['spacerRect']}")
        print(f"  mobile .topbar:               rect={m['topbarRect']}")
        print(f"  mobile #topbar-brand-title:   rect={m['brandTitleRect']}")
        print(f"  mobile #topbar-mode-seg:      rect={m['modeSegRect']}")
        print(f"  mobile #btn-quick-create:     rect={m['quickCreateRect']}")
        print(f"  mobile #btn-auth-sheet:       rect={m['authSheetRect']}")
        print(f"  desktop #ios-statusbar-spacer: display={d['spacerDisplay']}, height={d['spacerRect']['height']}")

        # Generate composite image overlaying the actual iOS status bar + 0..90pt blur zone
        build_ios_statusbar_composite(version)

    finally:
        chrome_proc.terminate()
        try:
            chrome_proc.wait(timeout=3)
        except Exception:
            chrome_proc.kill()
        httpd.shutdown()

def build_ios_statusbar_composite(version: str):
    from PIL import Image, ImageDraw, ImageFilter

    raw_path = os.path.join(ROOT, f"verify_mobile_{version}.png")
    out_path = os.path.join(ROOT, f"verify_mobile_{version}_with_ios_statusbar.png")
    ref_shot = "/home/box/agent-data/agents/bbb93fad-f532-42f2-a380-57d598521f29/attachments/6dde9550a4931779540d797d9c61689c4a589cbd862a9bb97d5edd6f867b82ff.jpg"

    img = Image.open(raw_path).convert("RGBA")
    w, h = img.size  # 1290 x 2796 (430x932 @ 3x)

    # Simulate iOS 26 progressive blur from 0..90pt (0..270px at 3x)
    blur_zone_px = 90 * 3  # 270px
    top_crop = img.crop((0, 0, w, blur_zone_px)).filter(ImageFilter.GaussianBlur(radius=10))
    # Progressive alpha mask (1.0 at y=0..177px, tapering to 0.0 at y=270px)
    mask = Image.new("L", (w, blur_zone_px), 0)
    mask_draw = ImageDraw.Draw(mask)
    for y in range(blur_zone_px):
        if y < 59 * 3:
            a = 255
        else:
            frac = 1.0 - (y - 59 * 3) / float((90 - 59) * 3)
            a = int(max(0.0, min(1.0, frac)) * 230)
        mask_draw.line([(0, y), (w, y)], fill=a)
    img.paste(top_crop, (0, 0), mask)

    # Overlay the real iOS status bar icons (clock + 5G UW + battery) from Nick's screenshot top 54pt
    if os.path.exists(ref_shot):
        ref = Image.open(ref_shot).convert("RGBA").resize((w, h), Image.Resampling.LANCZOS)
        # Extract bright status bar pixels (clock "8:50", signal bars, "5G UW", battery "93") in y=0..165px
        sb_crop = ref.crop((0, 0, w, 55 * 3))
        # Paste top 52pt where only the status bar icons live on a #171717 background
        # Note: in ref_shot, y=35..160 had overlapping topbar in s37, so let's check if img1 (8:25) exists
        ref_img1 = "/home/box/agent-data/agents/bbb93fad-f532-42f2-a380-57d598521f29/attachments/7ef43ac40886a952f6d43b086c742c53a7e31dc610e53095aa73fef4aac899ed.jpg"
        if os.path.exists(ref_img1):
            ref1 = Image.open(ref_img1).convert("RGBA").resize((w, h), Image.Resampling.LANCZOS)
            sb_clean = ref1.crop((0, 0, w, 58 * 3))
            img.paste(sb_clean, (0, 0))

    # Draw diagnostic guide lines showing 59pt (safe-area-inset-top) and 90pt (end of iOS 26 blur tail)
    draw = ImageDraw.Draw(img)
    draw.line([(0, 59 * 3), (w, 59 * 3)], fill=(10, 132, 255, 140), width=2)
    draw.line([(0, 90 * 3), (w, 90 * 3)], fill=(48, 209, 88, 180), width=2)

    img.convert("RGB").save(out_path, "PNG")
    print(f"  saved {raw_path} and {out_path}")

def main():
    version = sys.argv[1] if len(sys.argv) > 1 else "s38"

    # 1. Verify index.html invariants
    idx_path = os.path.join(ROOT, "index.html")
    idx = open(idx_path).read()
    idx = re.sub(r"\?v=s\d+", f"?v={version}", idx)
    open(idx_path, "w").write(idx)

    if 'id="btn-topbar-passkey"' in idx or 'id="btn-top-memory"' in idx or 'id="btn-health-access-top"' in idx:
        fail("Topbar contains standalone Face ID, Memory, or Access buttons! They must live inside Nick Drake dropdown.")
    if 'id="btn-menu-memory"' not in idx or 'id="btn-menu-account"' not in idx:
        fail("User dropdown is missing Memory or Settings & Face ID items.")
    if '<span id="auth-pill-label">Nick Drake</span>' not in idx:
        fail("Top-right dropdown trigger must say 'Nick Drake'.")
    if 'id="today-brief-debrief-strip" class="today-brief-debrief-strip" hidden' not in idx:
        fail("#today-brief-debrief-strip must have the hidden attribute on Today view.")

    # 2. Verify styles.css invariants
    css_path = os.path.join(ROOT, "styles.css")
    css = open(css_path).read()
    if "59px" in css:
        fail("styles.css still has hardcoded 59px topbar padding that causes jumbling in iOS Safari.")
    if "max(20px, env(safe-area-inset-bottom" in css or "padding-bottom: 104px" in css:
        fail("styles.css still has excessive bottom tabbar padding.")
    verify_css_statusbar_cascade(css)

    # 3. Verify app.js invariants
    app_path = os.path.join(ROOT, "app.js")
    app = open(app_path).read()
    if 'brandTitle.textContent = state.isOwner ? "nickdrake.ai · Health"' in app:
        fail("app.js still sets multi-line 'nickdrake.ai · Health' title in topbar.")
    if 'label.textContent = "Nick";' in app:
        fail("app.js still overwrites 'Nick Drake' pill label with 'Nick'.")
    for dup_tab_id in ('id="btn-menu-today"', 'id="btn-menu-people"', 'id="btn-menu-loops"', 'id="btn-menu-projects"', 'id="btn-menu-notes"'):
        if dup_tab_id in idx:
            fail(f"{dup_tab_id} found inside #user-dropdown-menu! Nothing on the 5-tab bottom bar may appear in the user dropdown.")
    if 'class="sheet-grabber"' not in idx or "spotlight-bar" not in idx:
        fail("iOS sheet grabber or Spotlight search bar missing from index.html.")
    for req_anim in ("iosSheetSlideUp", "iosViewEnter", "iosCheckBounce", "iosViewSlideForward", "iosViewSlideBack", "iosCardCascadeIn", "iosTabIconPop", "iosSheetSlideUpMobile", "iosSheetSlideDownMobile", "iosSheetNavPush", "iosSheetNavPop", "iosCalSlideNext"):
        if req_anim not in css:
            fail(f"Apple HIG animation {req_anim} missing in styles.css.")
    if "window.presentSheetBackdrop" not in app or "sheet-closing" not in app or "sheet-nav-push" not in app:
        fail("Apple HIG sheet open/push/pop/close lifecycle missing in app.js.")
    if "cal-time-col" not in app or "cal-status-pill" not in app:
        fail("Tabular calendar time column & Now/Up Next status pills missing in app.js.")
    if 'id="btn-sheet-back"' not in idx or 'id="notes-cat-chips"' not in idx:
        fail("Sheet back button or Notes category chips missing from index.html.")
    if "window.openNoteSheet" not in app or "btn-loop-save-edits" not in app or "project-loop-input" not in app:
        fail("Interactive Note sheet, editable Loop sheet, or inline Project task composer missing in app.js.")
    if 'id="loops-quick-add-input"' not in idx or "today-loop-quick-input" not in app or "btn-save-person-notes" not in app:
        fail("Inline loop quick-add or editable Person/Project notes missing in s30.")
    if "refreshOpenSheetIfActive()" not in app:
        fail("app.js is missing refreshOpenSheetIfActive() inside toggleLoopItem/archiveItem (completed items will stay visible in open sheets)!")
    if "allProfIds = new Set(state.profileItems.map((i) => i.id))" not in app:
        fail("app.js getPersonDiscussionTopics / getMeetingSeriesDiscussionTopics must exclude all state.profileItems IDs from extraDi so completed items never resurrect!")
    if "i.series_key || (i.writeback_payload || {}).series_key" not in app:
        fail("app.js must check top-level i.series_key before writeback_payload.series_key!")
    if "function stripPastorPrefix(" not in app:
        fail("app.js is missing stripPastorPrefix() name normalizer!")
    if "maybeSyncOnResume" not in app:
        fail("app.js is missing foreground visibilitychange/pageshow auto-sync!")
    if 'id="people-mode-seg"' not in idx or 'id="person-sheet-seg"' not in app:
        fail("Apple HIG People/Meetings segment or Person sheet 3-segment control missing!")
    if 'id="people-filter-input"' in idx or 'id="people-frequent-strip"' in app:
        fail("Cluttered duplicate search bar or duplicate meeting strip still present on People tab!")
    if 'id="project-filter-input"' in idx or 'id="loop-filter-input"' in idx or 'id="notes-filter-input"' in idx or 'id="memory-filter-input"' in idx:
        fail("Duplicate per-page search bars found in index.html; only the top Spotlight bar is allowed!")
    if 'PRIORITY 1:1 PREP' in idx or 'id="today-1on1-list"' in idx:
        fail("Priority 1:1 Prep section is still in index.html on Today view!")
    if 'id="ios-tab-projects"' not in idx or 'id="ios-tab-notes"' not in idx:
        fail("5-tab bottom bar (Today, People, Loops, Projects, Notes) missing in index.html!")
    if 'id="topbar-mode-seg"' not in idx or 'id="btn-menu-health"' not in idx:
        fail("Topbar Brain|Health switcher or Health dropdown item missing in index.html!")
    if 'id="ios-statusbar-spacer"' not in idx or 'content="black-translucent"' in idx:
        fail("iOS status bar spacer missing or black-translucent meta tag still present in index.html!")
    if 'rgba(23, 23, 23, 0.82)' in css:
        fail("styles.css still applies translucent backdrop-filter blur to .topbar!")
    if 'id="project-sheet-seg"' not in app or 'id="btn-toggle-loop-edit"' not in app:
        fail("Project sheet 2-segment toggle or collapsible Loop edit missing in app.js!")
    clc_check = open(CANVAS_SRC).read()
    if "Include Regional" in clc_check or "In Loc Groups" in clc_check or "Call Loc Home" in clc_check:
        fail("Small Groups table still contains old 9-column split or Include Regional toggle!")
    if '"Member Care Queue"' not in clc_check or '"Group Reporting Audit"' not in clc_check:
        fail("Small Groups 2-segment toggle (Member Care Queue | Group Reporting Audit) missing in current_live_canvas.tsx!")

    # Run Node syntax & behavioral smoke test on app.js
    js_syntax = subprocess.run(["node", "--check", app_path], capture_output=True, text=True)
    if js_syntax.returncode != 0:
        fail(f"app.js syntax error:\n{js_syntax.stderr}")

    # 4. Build health_entry.tsx from canonical CANVAS_SRC
    he_path = os.path.join(BUILD_DIR, "health_entry.tsx")
    he_existing = open(he_path).read()
    i_he = he_existing.find("interface LiveSundayLoc")
    if i_he == -1:
        fail("Could not find interface LiveSundayLoc in health_entry.tsx header.")
    header = he_existing[:i_he]

    clc = open(CANVAS_SRC).read()
    i_clc = clc.find("interface LiveSundayLoc")
    if i_clc == -1:
        fail("Could not find interface LiveSundayLoc in current_live_canvas.tsx.")
    body = clc[i_clc:]

    # Replace export default function App() with HealthDashboardApp(props)
    old_sig = """export default function App() {
  const theme = useGrokTheme();
  const sundayLive = useSource("sunday_live");"""
    new_sig = """interface HealthDashboardProps {
  payload?: any;
  initialLiveRow?: any;
  sbClient?: any;
  isOwner?: boolean;
  userEmail?: string;
  onOpenAccessModal?: () => void;
  onSwitchToWorkspace?: () => void;
  onSignOut?: () => void;
}

function HealthDashboardApp(props: HealthDashboardProps = {}) {
  const useSource = (_name: string) => ({ value: props?.initialLiveRow || null });
  const theme = useGrokTheme();
  const sundayLive = useSource("sunday_live");"""

    if old_sig in body:
        body = body.replace(old_sig, new_sig, 1)
    elif "function HealthDashboardApp(" not in body:
        fail("Could not bind HealthDashboardApp in current_live_canvas.tsx.")

    footer = """
const roots = new WeakMap<Element, any>();
(window as any).renderActionChurchHealthDashboard = function(container: Element, props: HealthDashboardProps) {
  if (!container) return;
  let root = roots.get(container);
  if (!root) {
    root = createRoot(container);
    roots.set(container, root);
  }
  root.render(React.createElement(HealthDashboardApp, props));
};
(window as any).HealthDashboardApp = (window as any)._HealthDashboardApp = HealthDashboardApp;
"""
    open(he_path, "w").write(header + body + "\n" + footer)

    # 5. Bundle browser IIFE and run Node SSR verification
    subprocess.run([
        f"{BUILD_DIR}/node_modules/.bin/esbuild",
        he_path,
        "--bundle",
        f"--outfile={ROOT}/health-bundle.js",
        "--format=iife",
        "--minify"
    ], check=True)

    subprocess.run([
        f"{BUILD_DIR}/node_modules/.bin/esbuild",
        he_path,
        "--bundle",
        "--external:react",
        "--external:react-dom",
        "--outfile=/tmp/health-ssr-test.cjs",
        "--format=cjs",
        "--platform=node"
    ], check=True)

    ssr_check = subprocess.run(
        ["node", "-e", """
global.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  innerWidth: 390,
  matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })
};
global.document = {
  documentElement: { getAttribute: () => "dark" },
  body: { classList: { contains: () => false } }
};
global.localStorage = { getItem: () => "dark", setItem: () => {} };
const React = require("react");
const ReactDOMServer = require("react-dom/server");
require("/tmp/health-ssr-test.cjs");
if (typeof window.renderActionChurchHealthDashboard !== "function") {
  throw new Error("renderActionChurchHealthDashboard is not a function");
}
const html = ReactDOMServer.renderToString(React.createElement(window._HealthDashboardApp, {}));
if (html.length < 10000 || !html.includes("1,107 unique")) {
  throw new Error("SSR output failed validation: len=" + html.length);
}
console.log("SSR check passed: len=" + html.length);
"""],
        env={**os.environ, "NODE_PATH": f"{BUILD_DIR}/node_modules"},
        capture_output=True,
        text=True
    )
    if ssr_check.returncode != 0:
        fail(f"React SSR render check failed:\n{ssr_check.stderr}\n{ssr_check.stdout}")

    # 6. Run real headless Google Chrome layout & bounding-box verification
    run_headless_chrome_verification(version)

    # 7. Rebuild worker.mjs
    w_path = os.path.join(ROOT, "worker.mjs")
    w = open(w_path).read()
    m = re.match(r"^const TEXT_ASSETS = (\{.*?\});\nconst BIN_ASSETS =", w, re.S)
    text_assets = json.loads(m.group(1))
    text_assets["/"]["body"] = idx
    text_assets["/index.html"]["body"] = idx
    text_assets["/styles.css"]["body"] = css
    text_assets["/app.js"]["body"] = app
    text_assets["/health-bundle.js"]["body"] = open(f"{ROOT}/health-bundle.js").read()

    new_w = "const TEXT_ASSETS = " + json.dumps(text_assets) + ";\nconst BIN_ASSETS =" + w[m.end():]
    open(w_path, "w").write(new_w)
    print(f"ALL PRE-DEPLOY CHECKS PASSED ({version})! worker.mjs size: {len(new_w)} bytes")

if __name__ == "__main__":
    main()
