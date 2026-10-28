#!/usr/bin/env python3
"""
Comprehensive Baseline & Branch Behavioral/Visual Verification Suite for nickdrake.ai.
Runs real headless Google Chrome via CDP at both:
  - Mobile iPhone 16 Pro Max viewport (430x932 @ 3x, mobile: true)
  - Desktop Mac viewport (1280x800 @ 2x, mobile: false)

Verifies:
1. Topbar & Safe-Area Invariants (Mobile & Desktop)
2. Tab Navigation & Directional Transitions (Today, People, Loops, Projects, Notes, Memory, Health)
3. Sheets, 1:1s, Calendar Meetings, Push/Pop Stack & Close
4. Today 2-Week Strip, Filters & Health Dashboard (Overview, Attendance, Goals, A-Team, Small Groups + 2-segment toggle, Staff)
5. Zero console errors or uncaught page errors
6. Feature-specific assertions when --feature is passed:
   - sliding-pills
   - edge-swipe-back
   - pull-to-refresh
   - inline-row-anim
   - tab-scroll-memory
   - all
"""
import argparse
import http.server
import json
import os
import socketserver
import subprocess
import sys
import threading
import time
import urllib.request

ROOT = "/workspace/nickdrake-ai"


def fail(msg):
    print(f"VERIFICATION FAILED: {msg}", file=sys.stderr)
    sys.exit(1)


def run_suite(features):
    class QuietHandler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=ROOT, **kwargs)

        def log_message(self, format, *args):
            pass

    httpd = socketserver.TCPServer(("127.0.0.1", 0), QuietHandler)
    port = httpd.server_address[1]
    srv_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    srv_thread.start()

    cdp_port = 9344
    chrome_proc = subprocess.Popen(
        [
            "/usr/bin/google-chrome",
            "--headless=new",
            "--no-sandbox",
            "--disable-gpu",
            "--disable-dev-shm-usage",
            f"--remote-debugging-port={cdp_port}",
            "--window-size=430,932",
            f"http://127.0.0.1:{port}/index.html?v=verify",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    try:
        ws_url = None
        for _ in range(45):
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

        node_script = f"""
const ws = new WebSocket({json.dumps(ws_url)});
const features = new Set({json.dumps(list(features))});
let seq = 1;
const pending = new Map();
const pageErrors = [];
const consoleErrors = [];

function send(method, params = {{}}) {{
  return new Promise((resolve, reject) => {{
    const id = seq++;
    pending.set(id, {{ resolve, reject }});
    ws.send(JSON.stringify({{ id, method, params }}));
  }});
}}

ws.onmessage = (ev) => {{
  const msg = JSON.parse(ev.data);
  if (msg.method === 'Runtime.exceptionThrown') {{
    pageErrors.push(msg.params?.exceptionDetails?.text || 'exceptionThrown');
  }}
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error') {{
    const txt = (msg.params.args || []).map(a => a.value || a.description || '').join(' ');
    if (!txt.includes('supabase') && !txt.includes('Failed to fetch')) {{
      consoleErrors.push(txt);
    }}
  }}
  if (msg.id && pending.has(msg.id)) {{
    const {{ resolve, reject }} = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  }}
}};

async function evalInPage(expr) {{
  const res = await send('Runtime.evaluate', {{
    expression: expr,
    awaitPromise: true,
    returnByValue: true
  }});
  if (res.exceptionDetails) {{
    throw new Error('Runtime exception: ' + JSON.stringify(res.exceptionDetails));
  }}
  return res.result ? res.result.value : undefined;
}}

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
    await new Promise(r => setTimeout(r, 450));

    // Seed rich test data & unlock app-shell as owner
    const baselineMobile = await evalInPage(`(() => {{
      const gate = document.getElementById('auth-gate');
      if (gate) gate.hidden = true;
      const shell = document.getElementById('app-shell');
      if (shell) {{
        shell.hidden = false;
        shell.setAttribute('data-device', 'iphone');
      }}
      state.user = {{ email: 'nick.drake@theactionchurch.com' }};
      state.isOwner = true;
      if (typeof applyDeviceMode === 'function') applyDeviceMode();

      const todayStr = new Date().toLocaleDateString('en-CA', {{ timeZone: 'America/New_York' }});
      state.selectedTodayDate = todayStr;
      state.personProfiles = [
        {{ slug: 'christina', full_name: 'Christina', role_title: 'Executive Director', location_code: 'ALL', what_current_focus: 'Weekly 1:1 sync', cadence: 'Weekly' }},
        {{ slug: 'kyle', full_name: 'Kyle', role_title: 'Location Pastor', location_code: 'WS', what_current_focus: 'WS growth', cadence: 'Biweekly' }}
      ];
      state.projectProfiles = [
        {{ slug: 'autumn-vision', name: 'Autumn Vision Lane', location_code: 'ALL', status: 'Active', what_summary: 'Fall series & rollout', next_milestone: 'Oct 30' }}
      ];
      state.profileItems = [
        {{ id: 'loop-1', category: 'open_loop', status: 'open', what_summary: 'Review Q4 budget with Christina', person_slug: 'christina', project_slug: 'autumn-vision', confidence: 0.9, updated_at: new Date().toISOString() }},
        {{ id: 'loop-2', category: 'follow_up_1on1', status: 'open', what_summary: 'Check in on WS soundboard', person_slug: 'kyle', confidence: 0.85, updated_at: new Date().toISOString() }}
      ];
      state.discussionItems = [
        {{ id: 'disc-1', person_slug: 'christina', status: 'open', item_type: 'discussion', title: 'Discuss staff Christmas party', due_context: 'Next 1:1' }}
      ];
      state.calendarEvents = [
        {{ id: 'cal-1', title: '1:1 - Christina / Nick', start_at: todayStr + 'T14:00:00Z', end_at: todayStr + 'T15:00:00Z', person_slug: 'christina', event_type: '1on1' }},
        {{ id: 'cal-2', title: 'HW Location Meeting', start_at: todayStr + 'T16:00:00Z', end_at: todayStr + 'T17:00:00Z', series_key: 'hw_loc', event_type: 'location' }}
      ];
      state.meetingGroups = [
        {{ series_key: 'hw_loc', title: 'HW Location Meeting', cadence: 'Weekly', participants: ['Christina', 'Kyle'], summary: 'Campus review' }}
      ];
      state.journal = [
        {{ id: 'note-1', date: todayStr, category: '1:1', summary: 'Notes from Christina sync', details: 'Covered Q4 budget.' }}
      ];
      state.sourceItems = [
        {{ id: 'mem-1', source_type: 'plaud', source_title: 'Plaud Recording Oct 27', what_summary: 'Exec sync transcript', captured_at: new Date().toISOString() }}
      ];
      renderAll();

      const rect = (el) => el ? JSON.parse(JSON.stringify(el.getBoundingClientRect())) : null;
      const menuEl = document.getElementById('user-dropdown-menu');
      const menuItemTexts = menuEl ? Array.from(menuEl.querySelectorAll('.user-dropdown-item')).map(b => b.textContent.trim()) : [];
      const spacer = document.getElementById('ios-statusbar-spacer');
      const topbar = document.querySelector('.topbar');
      const brandTitle = document.getElementById('topbar-brand-title');
      const modeSeg = document.getElementById('topbar-mode-seg');
      const quickCreate = document.getElementById('btn-quick-create');
      const authSheet = document.getElementById('btn-auth-sheet');
      const searchStrip = document.getElementById('global-search-strip');
      const viewToday = document.getElementById('view-today');

      // 1. Check all tab switches
      const tabResults = {{}};
      for (const t of ['people', 'loops', 'projects', 'notes', 'memory', 'today']) {{
        window.switchTab(t);
        const sec = document.getElementById('view-' + t);
        tabResults[t] = {{
          hidden: sec ? sec.hidden : true,
          entering: sec ? sec.classList.contains('view-entering') : false,
          dir: sec ? sec.getAttribute('data-nav-dir') : null,
          htmlLen: sec ? sec.innerHTML.length : 0
        }};
      }}

      // 2. Check 2-week calendar strip & week paging
      window.scrollTodayWeek(1);
      const week1Active = state.activeWeekPage;
      window.scrollTodayWeek(0);
      const week0Active = state.activeWeekPage;
      window.selectTodayDate('2026-10-28');
      const calSlideClass = document.getElementById('today-calendar-list').className;
      window.selectTodayDate(todayStr);

      // 3. Check sheets: Meeting -> Person (push) -> Back (pop) -> Close
      window.openMeetingSheet('cal-1');
      const backdrop = document.getElementById('sheet-backdrop');
      const panel = document.getElementById('sheet-panel');
      const bodyEl = document.getElementById('sheet-body');
      const openState = {{
        hidden: backdrop.hidden,
        hasOpenSheet: document.body.classList.contains('has-open-sheet'),
        panelOpening: panel.classList.contains('sheet-opening'),
        topbarTop: rect(topbar).top,
        spacerHeight: rect(spacer).height,
        title: document.getElementById('sheet-title').textContent
      }};

      window.openPersonSheet('christina');
      const pushState = {{
        navPush: bodyEl.classList.contains('sheet-nav-push'),
        stackLen: state.sheetStack.length,
        backHidden: document.getElementById('btn-sheet-back').hidden,
        title: document.getElementById('sheet-title').textContent
      }};

      window.popSheetHistory();
      const popState = {{
        navPop: bodyEl.classList.contains('sheet-nav-pop'),
        stackLen: state.sheetStack.length,
        title: document.getElementById('sheet-title').textContent
      }};

      // Also test opening Loop, Project, Note, QuickCreate sheets
      window.openLoopSheet('loop-1');
      const loopTitle = document.getElementById('sheet-title').textContent;
      window.openProjectSheet('autumn-vision');
      const projectTitle = document.getElementById('sheet-title').textContent;
      window.openNoteSheet('note-1');
      const noteTitle = document.getElementById('sheet-title').textContent;
      window.openQuickCreate('loop');
      const qcTitle = document.getElementById('sheet-title').textContent;

      window.closeSheetAndReset();
      const closingState = {{
        closingClass: backdrop.classList.contains('sheet-closing'),
        hasOpenSheet: document.body.classList.contains('has-open-sheet')
      }};
      window.closeSheetAndReset(true);

      return {{
        spacerDisplay: getComputedStyle(spacer).display,
        spacerRect: rect(spacer),
        topbarRect: rect(topbar),
        brandTitleRect: rect(brandTitle),
        modeSegRect: rect(modeSeg),
        quickCreateRect: rect(quickCreate),
        authSheetRect: rect(authSheet),
        menuItemTexts,
        searchStripRect: rect(searchStrip),
        viewTodayRect: rect(viewToday),
        tabResults,
        weekPaging: {{ week1Active, week0Active, calSlideClass }},
        sheets: {{ openState, pushState, popState, loopTitle, projectTitle, noteTitle, qcTitle, closingState }}
      }};
    }})()`);

    // Test Health dashboard mount & sub-tabs
    const healthCheck = await evalInPage(`(async () => {{
      window.switchTab('health');
      await new Promise(r => setTimeout(r, 250));
      const root = document.getElementById('health-dashboard-mount');
      const initialLen = root ? root.innerHTML.length : 0;
      const buttons = Array.from(root.querySelectorAll('button'));
      const clickedTabs = [];
      for (const label of ['Attendance', 'Goals', 'A-Team', 'Small Groups', 'Staff', 'Overview']) {{
        const btn = buttons.find(b => (b.textContent || '').includes(label));
        if (btn) {{
          btn.click();
          await new Promise(r => setTimeout(r, 40));
          clickedTabs.push(label);
        }}
      }}
      window.switchTab('today');
      return {{ initialLen, clickedTabs }};
    }})()`);

    // Feature-specific checks on mobile
    const featureResults = {{}};

    if (features.has('sliding-pills') || features.has('all')) {{
      featureResults.slidingPills = await evalInPage(`(async () => {{
        const modeSeg = document.getElementById('topbar-mode-seg');
        const rectBefore = JSON.parse(JSON.stringify(modeSeg.getBoundingClientRect()));
        window.switchTab('health');
        await new Promise(r => setTimeout(r, 60));
        const healthSegX = modeSeg.style.getPropertyValue('--seg-x');
        const healthSegW = modeSeg.style.getPropertyValue('--seg-w');
        window.switchTab('people');
        await new Promise(r => setTimeout(r, 60));
        const brainSegX = modeSeg.style.getPropertyValue('--seg-x');
        const rectAfter = JSON.parse(JSON.stringify(modeSeg.getBoundingClientRect()));

        const peopleSeg = document.getElementById('people-mode-seg');
        const meetingsBtn = peopleSeg.querySelector('[data-pmode="meetings"]');
        meetingsBtn.click();
        await new Promise(r => setTimeout(r, 50));
        const pSegX = peopleSeg.style.getPropertyValue('--seg-x');
        const pSegW = peopleSeg.style.getPropertyValue('--seg-w');
        peopleSeg.querySelector('[data-pmode="people"]').click();
        window.switchTab('today');
        return {{
          hasSlidingAttr: modeSeg.classList.contains('has-sliding-pill'),
          healthSegX,
          healthSegW,
          brainSegX,
          pSegX,
          pSegW,
          heightUnchanged: Math.abs(rectBefore.height - rectAfter.height) < 0.5,
          topUnchanged: Math.abs(rectBefore.top - rectAfter.top) < 0.5
        }};
      }})()`);
    }}

    if (features.has('edge-swipe-back') || features.has('all')) {{
      featureResults.edgeSwipeBack = await evalInPage(`(async () => {{
        window.closeSheetAndReset(true);
        window.openMeetingSheet('cal-1');
        window.openPersonSheet('christina');
        const stackBefore = state.sheetStack.length;
        const panel = document.getElementById('sheet-panel');
        const bodyEl = document.getElementById('sheet-body');

        const fireTouch = (type, x, y) => {{
          const t = new Touch({{ identifier: 1, target: bodyEl, clientX: x, clientY: y, pageX: x, pageY: y }});
          const ev = new TouchEvent(type, {{
            bubbles: true,
            cancelable: true,
            touches: type === 'touchend' ? [] : [t],
            targetTouches: type === 'touchend' ? [] : [t],
            changedTouches: [t]
          }});
          panel.dispatchEvent(ev);
        }};

        // 1. Short swipe from left edge (16px -> 48px) should cancel and NOT pop
        fireTouch('touchstart', 16, 300);
        fireTouch('touchmove', 48, 302);
        const dragTransformMid = bodyEl.style.transform;
        fireTouch('touchend', 48, 302);
        const stackAfterShort = state.sheetStack.length;

        // 2. Full swipe from left edge (16px -> 150px) SHOULD pop back to meeting sheet
        fireTouch('touchstart', 16, 300);
        fireTouch('touchmove', 90, 302);
        fireTouch('touchmove', 150, 304);
        fireTouch('touchend', 150, 304);
        const stackAfterFull = state.sheetStack.length;
        const titleAfterFull = document.getElementById('sheet-title').textContent;
        window.closeSheetAndReset(true);

        return {{
          stackBefore,
          dragTransformMid,
          stackAfterShort,
          stackAfterFull,
          titleAfterFull
        }};
      }})()`);
    }}

    if (features.has('pull-to-refresh') || features.has('all')) {{
      featureResults.pullToRefresh = await evalInPage(`(async () => {{
        window.switchTab('today');
        const stage = document.getElementById('main-stage');
        stage.scrollTop = 0;
        const ptr = document.getElementById('ios-ptr-indicator');
        const searchStrip = document.getElementById('global-search-strip');
        const searchTopIdle = searchStrip.getBoundingClientRect().top;
        const ptrHeightIdle = ptr ? ptr.getBoundingClientRect().height : -1;

        const fireStageTouch = (type, x, y) => {{
          const t = new Touch({{ identifier: 2, target: stage, clientX: x, clientY: y, pageX: x, pageY: y }});
          const ev = new TouchEvent(type, {{
            bubbles: true,
            cancelable: true,
            touches: type === 'touchend' ? [] : [t],
            targetTouches: type === 'touchend' ? [] : [t],
            changedTouches: [t]
          }});
          stage.dispatchEvent(ev);
        }};

        fireStageTouch('touchstart', 200, 180);
        fireStageTouch('touchmove', 200, 260);
        const ptrHeightPulling = ptr ? ptr.getBoundingClientRect().height : 0;
        fireStageTouch('touchend', 200, 260);
        await new Promise(r => setTimeout(r, 300));
        const ptrHeightAfter = ptr ? ptr.getBoundingClientRect().height : -1;
        const searchTopAfter = searchStrip.getBoundingClientRect().top;

        return {{
          exists: Boolean(ptr),
          ptrHeightIdle,
          ptrHeightPulling,
          ptrHeightAfter,
          searchTopDelta: Math.abs(searchTopIdle - searchTopAfter)
        }};
      }})()`);
    }}

    if (features.has('inline-row-anim') || features.has('all')) {{
      featureResults.inlineRowAnim = await evalInPage(`(async () => {{
        window.alert = () => {{}};
        window._skipQuickAddRpc = true;
        window.switchTab('today');
        const input = document.getElementById('today-loop-quick-input');
        let addedRowHasClass = false;
        if (input) {{
          input.value = 'Test smooth inline row expand';
          input.dispatchEvent(new KeyboardEvent('keydown', {{ key: 'Enter', bubbles: true }}));
          const justAdded = document.querySelector('.ios-row-just-added');
          addedRowHasClass = Boolean(justAdded);
        }}
        window._skipQuickAddRpc = false;
        state.profileItems = state.profileItems.filter(i => !String(i.id).startsWith('temp-loop-'));
        renderToday();
        return {{ addedRowHasClass }};
      }})()`);
    }}

    if (features.has('tab-scroll-memory') || features.has('all')) {{
      featureResults.tabScrollMemory = await evalInPage(`(async () => {{
        const stage = document.getElementById('main-stage');
        // Add tall spacer inside #view-people so #main-stage is guaranteed scrollable in test
        const peopleSec = document.getElementById('view-people');
        const tall = document.createElement('div');
        tall.style.height = '1600px';
        peopleSec.appendChild(tall);

        window.switchTab('people');
        stage.scrollTop = 320;
        const scrolledPeople = stage.scrollTop;

        window.switchTab('loops');
        const loopsScroll = stage.scrollTop;

        window.switchTab('people');
        const restoredPeople = stage.scrollTop;

        // Now tap already-active People tab -> should scroll back to 0
        document.querySelector('.ios-tab[data-tab="people"]').click();
        await new Promise(r => setTimeout(r, 50));
        const afterTapActive = window._tabScrollPositions ? window._tabScrollPositions['people'] : stage.scrollTop;

        tall.remove();
        window.switchTab('today');
        return {{
          scrolledPeople,
          loopsScroll,
          restoredPeople,
          afterTapActive
        }};
      }})()`);
    }}

    if (features.has('topic-reorder') || features.has('all')) {{
      featureResults.topicReorder = await evalInPage(`(async () => {{
        window.closeSheetAndReset(true);
        state.topicOrderMap = {{}};
        localStorage.removeItem('nd_topic_order_v1');

        // Seed 3 1:1 topics for Christina and 2 group topics for hw_loc
        state.profileItems = [
          {{ id: 'topic-c1', profile_type: 'person', profile_slug: 'christina', item_type: 'discussion_item', status: 'active', what_summary: 'First topic: Q4 Budget', occurred_at: '2026-10-27T12:00:00Z', sort_order: 1000, writeback_payload: {{ bucket: 'agenda' }} }},
          {{ id: 'topic-c2', profile_type: 'person', profile_slug: 'christina', item_type: 'discussion_item', status: 'active', what_summary: 'Second topic: Staff Christmas Party', occurred_at: '2026-10-27T11:00:00Z', sort_order: 1000, writeback_payload: {{ bucket: 'agenda' }} }},
          {{ id: 'topic-c3', profile_type: 'person', profile_slug: 'christina', item_type: 'discussion_item', status: 'active', what_summary: 'Third topic: Easter Venue Contract', occurred_at: '2026-10-27T10:00:00Z', sort_order: 1000, writeback_payload: {{ bucket: 'agenda' }} }},
          {{ id: 'topic-hw1', profile_type: 'location', profile_slug: 'HW', item_type: 'discussion_item', status: 'active', series_key: 'hw_loc', what_summary: 'HW Topic A: Parking', occurred_at: '2026-10-27T12:00:00Z', sort_order: 1000, writeback_payload: {{ bucket: 'agenda', series_key: 'hw_loc' }} }},
          {{ id: 'topic-hw2', profile_type: 'location', profile_slug: 'HW', item_type: 'discussion_item', status: 'active', series_key: 'hw_loc', what_summary: 'HW Topic B: Kids Check-In', occurred_at: '2026-10-27T11:00:00Z', sort_order: 1000, writeback_payload: {{ bucket: 'agenda', series_key: 'hw_loc' }} }},
          {{ id: 'loop-1', profile_type: 'person', profile_slug: 'christina', item_type: 'open_loop', category: 'open_loop', status: 'active', what_summary: 'Loop A: Review Q4 budget with Christina', person_slug: 'christina', project_slug: 'autumn-vision', confidence: 0.95, sort_order: 1000, updated_at: new Date().toISOString() }},
          {{ id: 'loop-2', profile_type: 'person', profile_slug: 'christina', item_type: 'open_loop', category: 'open_loop', status: 'active', what_summary: 'Loop B: Finalize worship schedule', person_slug: 'christina', project_slug: 'autumn-vision', confidence: 0.85, sort_order: 1000, updated_at: new Date().toISOString() }},
          {{ id: 'loop-3', profile_type: 'person', profile_slug: 'christina', item_type: 'open_loop', category: 'open_loop', status: 'active', what_summary: 'Loop C: Send stage plot to production', person_slug: 'christina', project_slug: 'autumn-vision', confidence: 0.75, sort_order: 1000, updated_at: new Date().toISOString() }}
        ];
        state.discussionItems = [];
        state.meetingGroups = [
          {{ series_key: 'hw_loc', name: 'HW Location Meeting', title: 'HW Location Meeting', location: 'HW', group_type: 'location', cadence: 'Weekly' }}
        ];

        const fireRowTouch = (targetEl, type, x, y) => {{
          const t = new Touch({{ identifier: 11, target: targetEl, clientX: x, clientY: y, pageX: x, pageY: y }});
          const ev = new TouchEvent(type, {{
            bubbles: true,
            cancelable: true,
            touches: type === 'touchend' ? [] : [t],
            targetTouches: type === 'touchend' ? [] : [t],
            changedTouches: [t]
          }});
          targetEl.dispatchEvent(ev);
        }};

        // 1. Open Christina 1:1 Person sheet & verify initial order + 0 three-line grip icons
        window.openPersonSheet('christina');
        const personList = document.getElementById('person-di-list');
        const initialPersonIds = Array.from(personList.querySelectorAll('.ios-topic-row')).map(r => r.getAttribute('data-topic-id'));
        const personGripCount = personList.querySelectorAll('.ios-topic-grip').length;

        // 2. Press-and-hold (260ms) on 3rd row (topic-c3) and drag up above 1st row (topic-c1)
        const rows = Array.from(personList.querySelectorAll('.ios-topic-row'));
        const r0Rect = rows[0].getBoundingClientRect();
        const r2Rect = rows[2].getBoundingClientRect();
        const startX = Math.round(r2Rect.left + r2Rect.width * 0.5);
        const startY = Math.round(r2Rect.top + r2Rect.height * 0.5);
        const targetY = Math.round(r0Rect.top + r0Rect.height * 0.25);

        fireRowTouch(rows[2], 'touchstart', startX, startY);
        await new Promise(r => setTimeout(r, 265));
        const draggingClassActive = rows[2].classList.contains('ios-topic-dragging');
        fireRowTouch(rows[2], 'touchmove', startX, Math.round((startY + targetY) / 2));
        fireRowTouch(rows[2], 'touchmove', startX, targetY);
        const siblingShiftedDuringDrag = rows[0].style.transform.includes('translate3d') && !rows[0].style.transform.startsWith('translate3d(0, 0');
        fireRowTouch(rows[2], 'touchend', startX, targetY);

        // Immediately dispatch a synthetic click right after touchend to ensure openLoopSheet is suppressed
        rows[2].click();
        const sheetTypeAfterDropClick = state.currentSheet ? state.currentSheet.type : null;
        const reorderedPersonIds = Array.from(personList.querySelectorAll('.ios-topic-row')).map(r => r.getAttribute('data-topic-id'));
        await new Promise(r => setTimeout(r, 240));

        // 3. Open Calendar Meeting Sheet for Christina 1:1 ('cal-1') & verify order synced + 0 grips!
        window.openMeetingSheet('cal-1');
        const mtgList = document.getElementById('mtg-di-list');
        const syncedMtgIds = Array.from(mtgList.querySelectorAll('.ios-topic-row')).map(r => r.getAttribute('data-topic-id'));
        const mtgGripCount = mtgList.querySelectorAll('.ios-topic-grip').length;

        // 4. Press-and-hold (260ms) in Meeting Sheet (without grip!): move 3rd item ('topic-c2') to 1st slot
        const mtgRows = Array.from(mtgList.querySelectorAll('.ios-topic-row'));
        const mr0 = mtgRows[0].getBoundingClientRect();
        const mr2 = mtgRows[2].getBoundingClientRect();
        const mStartX = Math.round(mr2.left + mr2.width * 0.5);
        const mStartY = Math.round(mr2.top + mr2.height * 0.5);
        const mTargetY = Math.round(mr0.top + mr0.height * 0.2);
        fireRowTouch(mtgRows[2], 'touchstart', mStartX, mStartY);
        await new Promise(r => setTimeout(r, 265));
        fireRowTouch(mtgRows[2], 'touchmove', mStartX, mTargetY);
        fireRowTouch(mtgRows[2], 'touchend', mStartX, mTargetY);
        const mtgIdsAfterHoldDrag = Array.from(mtgList.querySelectorAll('.ios-topic-row')).map(r => r.getAttribute('data-topic-id'));
        await new Promise(r => setTimeout(r, 240));

        // 5. Open Location Meeting Group Sheet ('hw_loc') & test press-and-hold mouse drag (0 grips!)
        window.openMeetingGroupSheet('hw_loc');
        const grpList = document.getElementById('mtg-group-di-list');
        const grpGripCount = grpList.querySelectorAll('.ios-topic-grip').length;
        const grpRows = Array.from(grpList.querySelectorAll('.ios-topic-row'));
        const gr0 = grpRows[0].getBoundingClientRect();
        const gr1 = grpRows[1].getBoundingClientRect();
        grpRows[1].dispatchEvent(new MouseEvent('mousedown', {{ button: 0, clientX: Math.round(gr1.left + gr1.width * 0.5), clientY: Math.round(gr1.top + gr1.height * 0.5), bubbles: true, cancelable: true }}));
        await new Promise(r => setTimeout(r, 265));
        document.dispatchEvent(new MouseEvent('mousemove', {{ clientX: Math.round(gr1.left + gr1.width * 0.5), clientY: Math.round(gr0.top + gr0.height * 0.2), bubbles: true, cancelable: true }}));
        document.dispatchEvent(new MouseEvent('mouseup', {{ clientX: Math.round(gr1.left + gr1.width * 0.5), clientY: Math.round(gr0.top + gr0.height * 0.2), bubbles: true, cancelable: true }}));
        const grpIdsAfterMouseDrag = Array.from(grpList.querySelectorAll('.ios-topic-row')).map(r => r.getAttribute('data-topic-id'));
        await new Promise(r => setTimeout(r, 240));

        // 6. Verify quick scroll (>8px before 240ms) cancels hold timer and does NOT enter drag mode
        const scrollTestRow = grpList.querySelector('.ios-topic-row');
        const stRect = scrollTestRow.getBoundingClientRect();
        fireRowTouch(scrollTestRow, 'touchstart', Math.round(stRect.left + 80), Math.round(stRect.top + 20));
        await new Promise(r => setTimeout(r, 40));
        fireRowTouch(scrollTestRow, 'touchmove', Math.round(stRect.left + 80), Math.round(stRect.top - 25));
        await new Promise(r => setTimeout(r, 250));
        const scrollCancelledHold = !scrollTestRow.classList.contains('ios-topic-dragging') && !window._isReorderingTopic;
        fireRowTouch(scrollTestRow, 'touchend', Math.round(stRect.left + 80), Math.round(stRect.top - 25));

        // 7. Wait for click suppression window to expire (450ms) and verify check button, delete button, and normal tap
        await new Promise(r => setTimeout(r, 460));
        const checkBtn = grpList.querySelector('.ios-topic-row .ios-check');
        checkBtn.click();
        const checkBtnWorks = Boolean(state.convertedIds['topic-hw2']);
        // Toggle back open so we can test normal row tap
        checkBtn.click();

        const firstRowNow = grpList.querySelector('.ios-topic-row');
        firstRowNow.click();
        const sheetTypeAfterNormalTap = state.currentSheet ? state.currentSheet.type : null;
        window.closeSheetAndReset(true);

        // 8. Test Open Loops press-and-hold drag-to-reorder on Today (#today-loops-list) & Loops tab (#loops-list)
        // and confirm press-and-hold does NOT open #ios-context-backdrop!
        document.querySelector('#ios-tabbar [data-tab="today"]').click();
        renderAll();
        const todayLoopsList = document.getElementById('today-loops-list');
        const initialTodayLoopIds = Array.from(todayLoopsList.querySelectorAll('.ios-topic-row')).map(r => r.getAttribute('data-loop-id'));
        const loopGripCount = todayLoopsList.querySelectorAll('.ios-topic-grip').length;
        const loopRows = Array.from(todayLoopsList.querySelectorAll('.ios-topic-row'));
        const lr0 = loopRows[0].getBoundingClientRect();
        const lr2 = loopRows[2].getBoundingClientRect();
        const lStartX = Math.round(lr2.left + lr2.width * 0.5);
        const lStartY = Math.round(lr2.top + lr2.height * 0.5);
        const lTargetY = Math.round(lr0.top + lr0.height * 0.25);

        fireRowTouch(loopRows[2], 'touchstart', lStartX, lStartY);
        await new Promise(r => setTimeout(r, 500)); // >460ms to also prove old long-press menu does NOT fire!
        const loopDraggingActive = loopRows[2].classList.contains('ios-topic-dragging');
        const contextBackdropHiddenDuringHold = Boolean(document.getElementById('ios-context-backdrop')?.hidden);
        fireRowTouch(loopRows[2], 'touchmove', lStartX, lTargetY);
        fireRowTouch(loopRows[2], 'touchend', lStartX, lTargetY);
        const reorderedTodayLoopIds = Array.from(todayLoopsList.querySelectorAll('.ios-topic-row')).map(r => r.getAttribute('data-loop-id'));
        await new Promise(r => setTimeout(r, 240));

        // Switch to Loops tab (#loops-list) and verify the new loop order persisted!
        document.querySelector('#ios-tabbar [data-tab="loops"]').click();
        renderLoops();
        const loopsTabList = document.getElementById('loops-list');
        const syncedLoopsTabIds = Array.from(loopsTabList.querySelectorAll('.ios-topic-row')).map(r => r.getAttribute('data-loop-id'));

        // Switch back to Today tab
        document.querySelector('#ios-tabbar [data-tab="today"]').click();

        // 9. Verify all 10 Bottom Bar Positioning Scenarios
        const tabbarEl = document.getElementById('ios-tabbar');
        const backdropEl = document.getElementById('sheet-backdrop');
        const spacerEl = document.getElementById('ios-statusbar-spacer');

        // Scenario 1 & 7: Open Quick Create sheet, focus input (keyboard open), then close sheet & blur input
        window.openQuickCreate('note');
        const qcInput = document.getElementById('qc-text');
        if (qcInput) qcInput.focus();
        window.closeSheetAndReset(true);
        await new Promise(r => setTimeout(r, 100));
        const s1_7_tabbarBottom = Math.round(tabbarEl.getBoundingClientRect().bottom);
        const s1_7_scrollY = window.scrollY;

        // Scenario 2 & 10: visualViewport resize & scroll events (Safari address bar / toolbar collapse & expand)
        if (window.visualViewport) {{
          window.visualViewport.dispatchEvent(new Event('resize'));
          window.visualViewport.dispatchEvent(new Event('scroll'));
        }}
        const s2_10_tabbarBottom = Math.round(tabbarEl.getBoundingClientRect().bottom);

        // Scenario 3, 5, 6, 9: Simulate iOS 26 Home Screen standalone cold-reopen viewport shortfall
        // where WKWebView reports window.innerHeight = 872 while window.screen.height = 932
        const origInnerHDesc = Object.getOwnPropertyDescriptor(window, 'innerHeight');
        const origScreenDesc = Object.getOwnPropertyDescriptor(window, 'screen');
        const origStandaloneDesc = Object.getOwnPropertyDescriptor(window.navigator, 'standalone');
        Object.defineProperty(window, 'innerHeight', {{ configurable: true, get: () => 872 }});
        Object.defineProperty(window, 'screen', {{ configurable: true, get: () => ({{ height: 932, width: 430 }}) }});
        Object.defineProperty(window.navigator, 'standalone', {{ configurable: true, get: () => true }});
        window.syncIosStandaloneViewport();
        const s3_coldShortfallAppVh = document.documentElement.style.getPropertyValue('--app-vh');
        const s3_coldShortfallOffset = document.documentElement.style.getPropertyValue('--ios-icb-shortfall');
        const s3_coldShortfallAttr = document.documentElement.getAttribute('data-ios-cold-shortfall');
        const s3_spacerHeight = Math.round(spacerEl.getBoundingClientRect().height);

        // Restore normal 932pt viewport
        if (origInnerHDesc) Object.defineProperty(window, 'innerHeight', origInnerHDesc);
        if (origScreenDesc) Object.defineProperty(window, 'screen', origScreenDesc);
        if (origStandaloneDesc) Object.defineProperty(window.navigator, 'standalone', origStandaloneDesc);
        window.syncIosStandaloneViewport();
        const s5_normalAppVh = document.documentElement.style.getPropertyValue('--app-vh');
        const s5_normalOffset = document.documentElement.style.getPropertyValue('--ios-icb-shortfall');
        const s5_tabbarBottom = Math.round(tabbarEl.getBoundingClientRect().bottom);

        // Scenario 4: Orientation change dispatch
        window.dispatchEvent(new Event('orientationchange'));
        await new Promise(r => setTimeout(r, 70));
        const s4_tabbarBottom = Math.round(tabbarEl.getBoundingClientRect().bottom);

        // Scenario 8: Dark mode / Light mode parity
        document.documentElement.setAttribute('data-theme', 'light');
        const s8_lightBottom = Math.round(tabbarEl.getBoundingClientRect().bottom);
        document.documentElement.setAttribute('data-theme', 'dark');
        const s8_darkBottom = Math.round(tabbarEl.getBoundingClientRect().bottom);

        return {{
          initialPersonIds,
          gripCount: personGripCount + mtgGripCount + grpGripCount + loopGripCount,
          draggingClassActive,
          siblingShiftedDuringDrag,
          sheetTypeAfterDropClick,
          reorderedPersonIds,
          syncedMtgIds,
          mtgIdsAfterHoldDrag,
          grpIdsAfterMouseDrag,
          scrollCancelledHold,
          checkBtnWorks,
          sheetTypeAfterNormalTap,
          initialTodayLoopIds,
          loopDraggingActive,
          contextBackdropHiddenDuringHold,
          reorderedTodayLoopIds,
          syncedLoopsTabIds,
          bottomBar10Scenarios: {{
            s1_7_tabbarBottom,
            s1_7_scrollY,
            s2_10_tabbarBottom,
            s3_coldShortfallAppVh,
            s3_coldShortfallOffset,
            s3_coldShortfallAttr,
            s3_spacerHeight,
            s5_normalAppVh,
            s5_normalOffset,
            s5_tabbarBottom,
            s4_tabbarBottom,
            s8_lightBottom,
            s8_darkBottom
          }}
        }};
      }})()`);
    }}

    if (features.has('quick-create-uniform') || features.has('all')) {{
      featureResults.quickCreateUniform = await evalInPage(`(() => {{
        const out = {{}};
        for (const theme of ['light', 'dark']) {{
          document.documentElement.setAttribute('data-theme', theme);
          out[theme] = {{}};
          window.openQuickCreate('note');
          const txtEl = document.getElementById('qc-text');
          if (txtEl) txtEl.value = 'Draft note text preserved';
          for (const tab of ['note', 'loop', 'di']) {{
            document.querySelector('[data-qc="' + tab + '"]').click();
            const panel = document.getElementById('sheet-panel').getBoundingClientRect();
            const body = document.getElementById('sheet-body').getBoundingClientRect();
            const save = document.getElementById('btn-qc-save').getBoundingClientRect();
            const activeBtn = document.querySelector('.qc-tab.active');
            const inactiveBtn = document.querySelector('.qc-tab:not(.active)');
            const activeStyle = getComputedStyle(activeBtn);
            const inactiveStyle = getComputedStyle(inactiveBtn);
            const dueEl = document.getElementById('qc-due');
            out[theme][tab] = {{
              panelHeight: Math.round(panel.height),
              panelTop: Math.round(panel.top),
              saveTop: Math.round(save.top),
              activeBg: activeStyle.backgroundColor,
              activeColor: activeStyle.color,
              inactiveBg: inactiveStyle.backgroundColor,
              inactiveColor: inactiveStyle.color,
              dueRightWithinBody: dueEl ? dueEl.getBoundingClientRect().right <= body.right + 0.5 : true,
              preservedText: document.getElementById('qc-text')?.value || ''
            }};
          }}
        }}
        document.documentElement.setAttribute('data-theme', 'dark');
        window.closeSheetAndReset(true);
        return out;
      }})()`);
    }}

    // 2. Desktop viewport (1280x800 @ 2x)
    await send('Emulation.setDeviceMetricsOverride', {{
      width: 1280,
      height: 800,
      deviceScaleFactor: 2,
      mobile: false
    }});
    await new Promise(r => setTimeout(r, 250));

    const baselineDesktop = await evalInPage(`(() => {{
      if (typeof applyDeviceMode === 'function') applyDeviceMode();
      const rect = (el) => el ? JSON.parse(JSON.stringify(el.getBoundingClientRect())) : null;
      const spacer = document.getElementById('ios-statusbar-spacer');
      const topbar = document.querySelector('.topbar');
      const sideNav = document.querySelector('.side-nav');
      window.openPersonSheet('christina');
      const desktopSheetRect = rect(document.getElementById('sheet-panel'));
      window.closeSheetAndReset(true);
      return {{
        spacerDisplay: getComputedStyle(spacer).display,
        spacerRect: rect(spacer),
        topbarRect: rect(topbar),
        sideNavDisplay: sideNav ? getComputedStyle(sideNav).display : 'none',
        desktopSheetRect
      }};
    }})()`);

    console.log(JSON.stringify({{
      mobile: baselineMobile,
      desktop: baselineDesktop,
      healthCheck,
      featureResults,
      pageErrors,
      consoleErrors
    }}));
    ws.close();
    process.exit(0);
  }} catch (err) {{
    console.error(err);
    process.exit(1);
  }}
}};
"""
        res = subprocess.run(
            ["node", "--experimental-websocket", "-e", node_script],
            capture_output=True,
            text=True,
            timeout=35,
        )
        if res.returncode != 0:
            fail(f"Node CDP script failed:\n{res.stderr}\n{res.stdout}")

        out = json.loads(res.stdout.strip().splitlines()[-1])
        m = out["mobile"]
        d = out["desktop"]
        h = out["healthCheck"]
        f = out["featureResults"]

        if out["pageErrors"]:
            fail(f"Uncaught page errors: {out['pageErrors']}")
        if out["consoleErrors"]:
            fail(f"Console errors: {out['consoleErrors']}")

        # Baseline mobile topbar & safe-area checks
        for forbidden_bottom_tab in ("Today", "People", "Loops", "Projects", "Notes"):
            if any(forbidden_bottom_tab in item_txt for item_txt in m.get("menuItemTexts", [])):
                fail(f"Bottom-bar item '{forbidden_bottom_tab}' found inside #user-dropdown-menu: {m.get('menuItemTexts')}")
        if m["spacerDisplay"] != "block" or m["spacerRect"]["height"] != 84:
            fail(f"Mobile spacer broken: display={m['spacerDisplay']}, rect={m['spacerRect']}")
        if m["topbarRect"]["top"] != 84 or m["topbarRect"]["height"] != 49:
            fail(f"Mobile topbar shifted: {m['topbarRect']}")
        for key in ("brandTitleRect", "modeSegRect", "quickCreateRect", "authSheetRect"):
            if m[key]["top"] < 90:
                fail(f"Mobile {key} top={m[key]['top']} < 92pt!")

        # Baseline desktop checks
        if d["spacerDisplay"] != "none" or d["spacerRect"]["height"] != 0:
            fail(f"Desktop spacer did not collapse: {d['spacerDisplay']} {d['spacerRect']}")
        if d["topbarRect"]["top"] != 0:
            fail(f"Desktop topbar top={d['topbarRect']['top']} != 0")

        # Tab checks
        for t, info in m["tabResults"].items():
            if info["hidden"] or not info["entering"] or info["htmlLen"] < 20:
                fail(f"Tab {t} failed baseline check: {info}")

        # Sheet checks
        s = m["sheets"]
        if s["openState"]["hidden"] or not s["openState"]["hasOpenSheet"] or s["openState"]["topbarTop"] != 84:
            fail(f"Sheet open failed baseline check: {s['openState']}")
        if not s["pushState"]["navPush"] or s["pushState"]["stackLen"] != 1 or s["pushState"]["backHidden"]:
            fail(f"Sheet push failed baseline check: {s['pushState']}")
        if not s["popState"]["navPop"] or s["popState"]["stackLen"] != 0:
            fail(f"Sheet pop failed baseline check: {s['popState']}")
        if not s["closingState"]["closingClass"] or s["closingState"]["hasOpenSheet"]:
            fail(f"Sheet close failed baseline check: {s['closingState']}")

        # Health dashboard check
        if h["initialLen"] < 500 or len(h["clickedTabs"]) < 5:
            fail(f"Health dashboard check failed: {h}")

        # Feature-specific assertions
        if "slidingPills" in f:
            sp = f["slidingPills"]
            if not sp["hasSlidingAttr"] or not sp["healthSegW"] or not sp["pSegW"] or not sp["heightUnchanged"] or not sp["topUnchanged"]:
                fail(f"Sliding pills verification failed: {sp}")

        if "edgeSwipeBack" in f:
            es = f["edgeSwipeBack"]
            if es["stackBefore"] != 1 or es["stackAfterShort"] != 1 or es["stackAfterFull"] != 0 or not es["dragTransformMid"]:
                fail(f"Edge swipe back verification failed: {es}")

        if "pullToRefresh" in f:
            ptr = f["pullToRefresh"]
            if not ptr["exists"] or ptr["ptrHeightIdle"] != 0 or ptr["ptrHeightPulling"] <= 10 or ptr["ptrHeightAfter"] != 0 or ptr["searchTopDelta"] > 0.5:
                fail(f"Pull-to-refresh verification failed: {ptr}")

        if "inlineRowAnim" in f:
            ira = f["inlineRowAnim"]
            if not ira["addedRowHasClass"]:
                fail(f"Inline row expand/collapse verification failed: {ira}")

        if "tabScrollMemory" in f:
            tsm = f["tabScrollMemory"]
            if tsm["scrolledPeople"] != 320 or tsm["loopsScroll"] != 0 or tsm["restoredPeople"] != 320 or tsm["afterTapActive"] != 0:
                fail(f"Tab scroll memory verification failed: {tsm}")

        if "quickCreateUniform" in f:
            qcu = f["quickCreateUniform"]
            for th in ["light", "dark"]:
                h_note = qcu[th]["note"]["panelHeight"]
                h_loop = qcu[th]["loop"]["panelHeight"]
                h_di = qcu[th]["di"]["panelHeight"]
                if not (h_note == h_loop == h_di):
                    fail(f"Quick Create heights differ across tabs in {th}: {qcu[th]}")
                for tb in ["note", "loop", "di"]:
                    info = qcu[th][tb]
                    if info["activeBg"] == info["inactiveBg"]:
                        fail(f"Quick Create active tab bg equals inactive bg in {th}/{tb}: {info}")
                    if not info["dueRightWithinBody"]:
                        fail(f"Quick Create due date overflows body in {th}/{tb}: {info}")
                    if info["preservedText"] != "Draft note text preserved":
                        fail(f"Quick Create did not preserve draft text in {th}/{tb}: {info}")

        if "topicReorder" in f:
            tr = f["topicReorder"]
            bb = tr.get("bottomBar10Scenarios", {})
            if (
                tr["initialPersonIds"] != ["topic-c1", "topic-c2", "topic-c3"]
                or tr["gripCount"] != 0
                or not tr["draggingClassActive"]
                or not tr["siblingShiftedDuringDrag"]
                or tr["sheetTypeAfterDropClick"] != "person"
                or tr["reorderedPersonIds"] != ["topic-c3", "topic-c1", "topic-c2"]
                or tr["syncedMtgIds"] != ["topic-c3", "topic-c1", "topic-c2"]
                or tr["mtgIdsAfterHoldDrag"] != ["topic-c2", "topic-c3", "topic-c1"]
                or tr["grpIdsAfterMouseDrag"] != ["topic-hw2", "topic-hw1"]
                or not tr["scrollCancelledHold"]
                or not tr["checkBtnWorks"]
                or tr["sheetTypeAfterNormalTap"] != "loop"
                or tr["initialTodayLoopIds"] != ["loop-1", "loop-2", "loop-3"]
                or not tr["loopDraggingActive"]
                or not tr["contextBackdropHiddenDuringHold"]
                or tr["reorderedTodayLoopIds"] != ["loop-3", "loop-1", "loop-2"]
                or tr["syncedLoopsTabIds"] != ["loop-3", "loop-1", "loop-2"]
                or bb.get("s1_7_tabbarBottom") != 932
                or bb.get("s1_7_scrollY") != 0
                or bb.get("s2_10_tabbarBottom") != 932
                or bb.get("s3_coldShortfallAppVh") != "932px"
                or bb.get("s3_coldShortfallOffset") != "-60px"
                or bb.get("s3_coldShortfallAttr") != "true"
                or bb.get("s3_spacerHeight") != 84
                or bb.get("s5_normalAppVh") != "100dvh"
                or bb.get("s5_normalOffset") != "0px"
                or bb.get("s5_tabbarBottom") != 932
                or bb.get("s4_tabbarBottom") != 932
                or bb.get("s8_lightBottom") != 932
                or bb.get("s8_darkBottom") != 932
            ):
                fail(f"Topic/Loop reorder or 10-scenario bottom-bar verification failed: {tr}")

        print("=================================================================")
        print(f"VERIFICATION SUITE PASSED (features={list(features) or ['baseline-s39']})")
        print("=================================================================")
        print(f"  Mobile Spacer:      display={m['spacerDisplay']}, top={m['spacerRect']['top']}, height={m['spacerRect']['height']}")
        print(f"  Mobile Topbar:      top={m['topbarRect']['top']}, height={m['topbarRect']['height']}, modeSegTop={m['modeSegRect']['top']}")
        print(f"  Mobile SearchStrip: top={m['searchStripRect']['top']}, height={m['searchStripRect']['height']}")
        print(f"  Desktop Topbar:     spacer={d['spacerDisplay']} (h={d['spacerRect']['height']}), topbarTop={d['topbarRect']['top']}")
        print(f"  Tabs Verified:      {list(m['tabResults'].keys())}")
        print(f"  Sheets Verified:    Meeting->Person push/pop/close + Loop/Project/Note/QuickCreate")
        print(f"  Health Sub-Tabs:    {h['clickedTabs']} (SSR/mount len={h['initialLen']})")
        if f:
            print(f"  Feature Checks:     {json.dumps(f)}")

    finally:
        chrome_proc.terminate()
        try:
            chrome_proc.wait(timeout=3)
        except Exception:
            chrome_proc.kill()
        httpd.shutdown()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--feature", action="append", default=[], help="Feature(s) to verify")
    args = parser.parse_args()
    run_suite(args.feature)
