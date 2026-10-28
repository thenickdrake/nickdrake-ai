/* cursor-canvas-sources
{"sunday_live": {"connector": "user-Supabase", "tool": "execute_sql", "arguments": {"project_id": "tjnvjsjlyjcmrjyyslaa", "query": "SELECT sunday_date, sunday_label, is_live, services_completed, locs_json, services_json, updated_at FROM public.sunday_attendance_live ORDER BY sunday_date DESC LIMIT 1;"}, "asOf": "2026-10-25T17:57:00Z", "snapshot": [{"sunday_date": "2026-10-25", "sunday_label": "Oct 25", "is_live": true, "services_completed": "Live Sunday Sync", "locs_json": {"ALL": {"total": 4430, "adults": 3297, "kids": 510, "team": 623, "salvations": 37, "total2025": 5272, "yoyPct": null}, "HW": {"total": 652, "adults": 484, "kids": 66, "team": 102, "salvations": 13, "total2025": null, "yoyPct": null}, "SF": {"total": 583, "adults": 348, "kids": 102, "team": 133, "salvations": 7, "total2025": null, "yoyPct": null}, "WP": {"total": 2196, "adults": 1757, "kids": 223, "team": 216, "salvations": 13, "total2025": null, "yoyPct": null}, "OV": {"total": 760, "adults": 554, "kids": 101, "team": 105, "salvations": 3, "total2025": null, "yoyPct": null}, "WS": {"total": 240, "adults": 155, "kids": 18, "team": 67, "salvations": 1, "total2025": null, "yoyPct": null}}, "services_json": {"HW":{"d":"10/25/2026","salv":13,"tot":652,"a":[258,226],"k":[66,0],"kt":66,"t":[30,50,22],"tt":102,"st":0,"bp":0},"SF":{"d":"10/25/2026","salv":7,"tot":583,"a":[125,118,105],"k":[26,45,31],"kt":102,"t":[15,82,36],"tt":133,"st":0,"bp":0},"WP":{"d":"10/25/2026","salv":13,"tot":2196,"a":[484,734,539,0],"k":[91,132,0,0],"kt":223,"t":[0,145,71],"tt":216,"st":0,"bp":0},"OV":{"d":"10/25/2026","salv":3,"tot":760,"a":[129,221,204],"k":[36,43,22],"kt":101,"t":[0,70,35],"tt":105,"st":0,"bp":0},"WS":{"d":"10/25/2026","salv":1,"tot":240,"a":[93,62],"k":[18,0],"kt":18,"t":[14,43,10],"tt":67,"st":0,"bp":0}}}]}}
*/
import {
  useGrokTheme,
  useSource,
  SourceStamp,
  useState,
  useMemo,
  ChangeEvent,
} from "grok/canvas";

interface LiveSundayLoc {
  total: number;
  adults: number;
  kids: number;
  team: number;
  salvations: number;
  total2025: number | null;
  yoyPct: number | null;
}

interface LiveSundayLocSheet {
  d: string;
  salv: number;
  tot: number;
  a: number[];
  k: number[];
  kt: number;
  t: number[];
  tt: number;
  st: number;
  bp: number;
}

interface LiveSundayRow {
  sunday_date: string;
  sunday_label: string;
  is_live: boolean;
  services_completed: string;
  locs_json: Record<LocCode, LiveSundayLoc>;
  services_json?: Partial<Record<Exclude<LocCode, "ALL">, LiveSundayLocSheet>>;
  updated_at?: string;
}

function parseLiveSunday(raw: unknown): LiveSundayRow | null {
  if (!raw) return null;
  if (Array.isArray(raw) && raw.length > 0) {
    return parseLiveSunday(raw[0]);
  }
  if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.sunday_date === "string" && obj.locs_json) {
      return obj as unknown as LiveSundayRow;
    }
    if (typeof obj.result === "string") {
      return parseLiveSunday(obj.result);
    }
  }
  if (typeof raw === "string") {
    const start = raw.indexOf("[{");
    const end = raw.lastIndexOf("}]");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        const parsed = JSON.parse(raw.slice(start, end + 2));
        return parseLiveSunday(parsed);
      } catch {
        return null;
      }
    }
  }
  return null;
}

type LocCode = "ALL" | "HW" | "SF" | "WP" | "OV" | "WS";
type HorizonCode = "weekly" | "monthly" | "quarterly" | "semiannual" | "annual";
type MainTab = "summary" | "attendance" | "goals" | "care" | "groups" | "workflows";
type CareFilter = "oct25_u" | "oct18_u" | "repeat_u" | "declines" | "inactive";
type SgCareFilter = "never" | "dropoff" | "core";
type StaffActionQueue = "overdue_wf" | "inactive_roster" | "repeat_u" | "unreported_sg";

interface LocStat {
  pct: number;
  count: string;
  tone: "success" | "warning" | "danger";
}

interface GoalDef {
  id: string;
  title: string;
  subtitle: string;
  target: number;
  targetText: string;
  pcoLabel: string;
  pcoUrls: Record<LocCode, string>;
  byHorizon: Record<HorizonCode, Record<LocCode, LocStat>>;
}

interface CarePerson {
  loc: Exclude<LocCode, "ALL">;
  name: string;
  team: string;
  badge: string;
  context: string;
  tone: "warning" | "danger";
  pid: string;
  planId: string;
  stId: string;
}

interface WorkflowRow {
  id: string;
  loc: Exclude<LocCode, "ALL">;
  bucket: "A Team" | "Connection" | "Outreach";
  name: string;
  open: number;
  overdue: number;
  stale14d: number;
  tone: "warning" | "danger";
}

const LOCS: Array<{ code: LocCode; short: string; name: string }> = [
  { code: "ALL", short: "All", name: "All Locations" },
  { code: "WP", short: "WP", name: "Winter Park" },
  { code: "OV", short: "OV", name: "Oviedo" },
  { code: "SF", short: "SF", name: "Sanford" },
  { code: "WS", short: "WS", name: "Winter Springs" },
  { code: "HW", short: "HW", name: "Heathrow" },
];

const HORIZONS: Array<{ code: HorizonCode; short: string; label: string }> = [
  { code: "weekly", short: "1-Wk", label: "Last Sunday" },
  { code: "monthly", short: "4-Wk", label: "4-Wk Avg" },
  { code: "quarterly", short: "13-Wk", label: "13-Wk Avg" },
  { code: "semiannual", short: "6-Mo", label: "26-Wk Avg" },
  { code: "annual", short: "1-Yr", label: "52-Wk Avg" },
];

interface AttLocHorizon {
  total: number;
  adults: number;
  kids: number;
  team: number;
  salvationsAvg: number;
  salvationsSum: number;
  activeWeeks: number;
  launched2026: string | null;
  yoy2025: { total: number; adults: number; kids: number; team: number } | null;
  yoyPct: number | null;
  yoyDiff: number | null;
  yoyAdultsPct: number | null;
  trend4: number[];
  trend4Dates: string[];
}

interface AttServiceRow {
  service: string;
  adults: number;
  kids: number;
  total: number;
}

interface AttLocDetail {
  launched2026: string | null;
  services: string[];
  horizons: Record<HorizonCode | "ytd", {
    services: AttServiceRow[];
    depts: { experience: number; guestServices: number; actionKids: number };
    activeWeeks: number;
  }>;
}

interface AttWeeklyPoint {
  date: string;
  label: string;
  locs: Record<LocCode, {
    total: number;
    adults: number;
    kids: number;
    team: number;
    salvations: number;
    total2025: number | null;
    yoyPct: number | null;
  }>;
}

const ATTENDANCE_DATA: {
  sheet2026Url: string;
  sheet2025Url: string;
  allTimeSalvations: number;
  salvations2026YtdWithEaster: number;
  salvations2026Easter: number;
  baptisms2026Total: number;
  baptisms2026ByLoc: Record<LocCode, number>;
  horizons: Record<HorizonCode | "ytd", Record<LocCode, AttLocHorizon>>;
  locDetails: Record<Exclude<LocCode, "ALL">, AttLocDetail>;
  weeklySeries13: AttWeeklyPoint[];
} = {"sheet2026Url":"https://docs.google.com/spreadsheets/d/1RAliC53liZS6ohPXcdqk4ixHC9_2TUurTE0gIstpz6Q/edit","sheet2025Url":"https://docs.google.com/spreadsheets/d/1J-RE2GZ9eDIqqe02EGDR5zzv69Ci9OZlnUsfftb31Mg/edit","allTimeSalvations":20996,"salvations2026YtdWithEaster":3091,"salvations2026Easter":789,"baptisms2026Total":427,"baptisms2026ByLoc":{"ALL":427,"WP":224,"SF":72,"OV":63,"WS":44,"HW":24},"horizons":{"weekly":{"ALL":{"total":5301,"adults":3778,"kids":716,"team":807,"salvationsAvg":58.0,"salvationsSum":58,"activeWeeks":1,"launched2026":null,"yoy2025":{"total":5225,"adults":3863,"kids":627,"team":735},"yoyPct":1.5,"yoyDiff":76,"yoyAdultsPct":-2.2,"trend4":[5510,5477,5446,5301],"trend4Dates":["Sep 27","Oct 4","Oct 11","Oct 18"]},"HW":{"total":724,"adults":492,"kids":115,"team":117,"salvationsAvg":2.0,"salvationsSum":2,"activeWeeks":1,"launched2026":"May 17, 2026","yoy2025":null,"yoyPct":null,"yoyDiff":null,"yoyAdultsPct":null,"trend4":[820,824,696,724],"trend4Dates":["Sep 27","Oct 4","Oct 11","Oct 18"]},"SF":{"total":626,"adults":394,"kids":116,"team":116,"salvationsAvg":4.0,"salvationsSum":4,"activeWeeks":1,"launched2026":null,"yoy2025":{"total":785,"adults":513,"kids":131,"team":141},"yoyPct":-20.3,"yoyDiff":-159,"yoyAdultsPct":-23.2,"trend4":[650,693,644,626],"trend4Dates":["Sep 27","Oct 4","Oct 11","Oct 18"]},"WP":{"total":2859,"adults":2142,"kids":360,"team":357,"salvationsAvg":47.0,"salvationsSum":47,"activeWeeks":1,"launched2026":null,"yoy2025":{"total":3595,"adults":2770,"kids":395,"team":430},"yoyPct":-20.5,"yoyDiff":-736,"yoyAdultsPct":-22.7,"trend4":[2963,2810,2958,2859],"trend4Dates":["Sep 27","Oct 4","Oct 11","Oct 18"]},"OV":{"total":823,"adults":597,"kids":88,"team":138,"salvationsAvg":3.0,"salvationsSum":3,"activeWeeks":1,"launched2026":null,"yoy2025":{"total":845,"adults":580,"kids":101,"team":164},"yoyPct":-2.6,"yoyDiff":-22,"yoyAdultsPct":2.9,"trend4":[783,840,849,823],"trend4Dates":["Sep 27","Oct 4","Oct 11","Oct 18"]},"WS":{"total":269,"adults":153,"kids":37,"team":79,"salvationsAvg":2.0,"salvationsSum":2,"activeWeeks":1,"launched2026":"Feb 1, 2026","yoy2025":null,"yoyPct":null,"yoyDiff":null,"yoyAdultsPct":null,"trend4":[295,310,299,269],"trend4Dates":["Sep 27","Oct 4","Oct 11","Oct 18"]}},"monthly":{"ALL":{"total":5434,"adults":3863,"kids":748,"team":823,"salvationsAvg":80.5,"salvationsSum":322,"activeWeeks":4,"launched2026":null,"yoy2025":{"total":5388,"adults":3984,"kids":667,"team":738},"yoyPct":0.9,"yoyDiff":46,"yoyAdultsPct":-3.0,"trend4":[5510,5477,5446,5301],"trend4Dates":["Sep 27","Oct 4","Oct 11","Oct 18"]},"HW":{"total":766,"adults":532,"kids":122,"team":111,"salvationsAvg":8.0,"salvationsSum":32,"activeWeeks":4,"launched2026":"May 17, 2026","yoy2025":null,"yoyPct":null,"yoyDiff":null,"yoyAdultsPct":null,"trend4":[820,824,696,724],"trend4Dates":["Sep 27","Oct 4","Oct 11","Oct 18"]},"SF":{"total":653,"adults":410,"kids":117,"team":127,"salvationsAvg":8.8,"salvationsSum":35,"activeWeeks":4,"launched2026":null,"yoy2025":{"total":827,"adults":536,"kids":145,"team":146},"yoyPct":-21.0,"yoyDiff":-174,"yoyAdultsPct":-23.5,"trend4":[650,693,644,626],"trend4Dates":["Sep 27","Oct 4","Oct 11","Oct 18"]},"WP":{"total":2898,"adults":2164,"kids":364,"team":370,"salvationsAvg":56.5,"salvationsSum":226,"activeWeeks":4,"launched2026":null,"yoy2025":{"total":3721,"adults":2872,"kids":414,"team":434},"yoyPct":-22.1,"yoyDiff":-823,"yoyAdultsPct":-24.7,"trend4":[2963,2810,2958,2859],"trend4Dates":["Sep 27","Oct 4","Oct 11","Oct 18"]},"OV":{"total":824,"adults":598,"kids":97,"team":129,"salvationsAvg":5.0,"salvationsSum":20,"activeWeeks":4,"launched2026":null,"yoy2025":{"total":841,"adults":576,"kids":108,"team":158},"yoyPct":-2.0,"yoyDiff":-17,"yoyAdultsPct":3.8,"trend4":[783,840,849,823],"trend4Dates":["Sep 27","Oct 4","Oct 11","Oct 18"]},"WS":{"total":293,"adults":160,"kids":48,"team":85,"salvationsAvg":2.2,"salvationsSum":9,"activeWeeks":4,"launched2026":"Feb 1, 2026","yoy2025":null,"yoyPct":null,"yoyDiff":null,"yoyAdultsPct":null,"trend4":[295,310,299,269],"trend4Dates":["Sep 27","Oct 4","Oct 11","Oct 18"]}},"quarterly":{"ALL":{"total":5321,"adults":3821,"kids":706,"team":794,"salvationsAvg":67.0,"salvationsSum":871,"activeWeeks":13,"launched2026":null,"yoy2025":{"total":5301,"adults":3911,"kids":656,"team":734},"yoyPct":0.4,"yoyDiff":20,"yoyAdultsPct":-2.3,"trend4":[5510,5477,5446,5301],"trend4Dates":["Sep 27","Oct 4","Oct 11","Oct 18"]},"HW":{"total":843,"adults":602,"kids":131,"team":110,"salvationsAvg":6.9,"salvationsSum":90,"activeWeeks":13,"launched2026":"May 17, 2026","yoy2025":null,"yoyPct":null,"yoyDiff":null,"yoyAdultsPct":null,"trend4":[820,824,696,724],"trend4Dates":["Sep 27","Oct 4","Oct 11","Oct 18"]},"SF":{"total":683,"adults":429,"kids":123,"team":131,"salvationsAvg":7.9,"salvationsSum":103,"activeWeeks":13,"launched2026":null,"yoy2025":{"total":780,"adults":503,"kids":135,"team":142},"yoyPct":-12.4,"yoyDiff":-97,"yoyAdultsPct":-14.7,"trend4":[650,693,644,626],"trend4Dates":["Sep 27","Oct 4","Oct 11","Oct 18"]},"WP":{"total":3067,"adults":2316,"kids":369,"team":381,"salvationsAvg":49.0,"salvationsSum":637,"activeWeeks":13,"launched2026":null,"yoy2025":{"total":3708,"adults":2856,"kids":420,"team":432},"yoyPct":-17.3,"yoyDiff":-641,"yoyAdultsPct":-18.9,"trend4":[2963,2810,2958,2859],"trend4Dates":["Sep 27","Oct 4","Oct 11","Oct 18"]},"OV":{"total":856,"adults":618,"kids":108,"team":131,"salvationsAvg":4.5,"salvationsSum":58,"activeWeeks":13,"launched2026":null,"yoy2025":{"total":813,"adults":552,"kids":101,"team":160},"yoyPct":5.3,"yoyDiff":43,"yoyAdultsPct":12.0,"trend4":[783,840,849,823],"trend4Dates":["Sep 27","Oct 4","Oct 11","Oct 18"]},"WS":{"total":328,"adults":186,"kids":45,"team":97,"salvationsAvg":2.5,"salvationsSum":33,"activeWeeks":13,"launched2026":"Feb 1, 2026","yoy2025":null,"yoyPct":null,"yoyDiff":null,"yoyAdultsPct":null,"trend4":[295,310,299,269],"trend4Dates":["Sep 27","Oct 4","Oct 11","Oct 18"]}},"ytd":{"ALL":{"total":4984,"adults":3563,"kids":644,"team":778,"salvationsAvg":56.1,"salvationsSum":2302,"activeWeeks":41,"launched2026":null,"yoy2025":{"total":4762,"adults":3478,"kids":600,"team":684},"yoyPct":4.7,"yoyDiff":222,"yoyAdultsPct":2.4,"trend4":[5510,5477,5446,5301],"trend4Dates":["Sep 27","Oct 4","Oct 11","Oct 18"]},"HW":{"total":823,"adults":587,"kids":130,"team":107,"salvationsAvg":6.3,"salvationsSum":144,"activeWeeks":23,"launched2026":"May 17, 2026","yoy2025":null,"yoyPct":null,"yoyDiff":null,"yoyAdultsPct":null,"trend4":[820,824,696,724],"trend4Dates":["Sep 27","Oct 4","Oct 11","Oct 18"]},"SF":{"total":704,"adults":451,"kids":119,"team":134,"salvationsAvg":8.0,"salvationsSum":330,"activeWeeks":41,"launched2026":null,"yoy2025":{"total":737,"adults":477,"kids":127,"team":133},"yoyPct":-4.5,"yoyDiff":-33,"yoyAdultsPct":-5.5,"trend4":[650,693,644,626],"trend4Dates":["Sep 27","Oct 4","Oct 11","Oct 18"]},"WP":{"total":3014,"adults":2283,"kids":355,"team":377,"salvationsAvg":40.7,"salvationsSum":1668,"activeWeeks":41,"launched2026":null,"yoy2025":{"total":3208,"adults":2443,"kids":373,"team":392},"yoyPct":-6.0,"yoyDiff":-194,"yoyAdultsPct":-6.5,"trend4":[2963,2810,2958,2859],"trend4Dates":["Sep 27","Oct 4","Oct 11","Oct 18"]},"OV":{"total":794,"adults":547,"kids":104,"team":144,"salvationsAvg":4.3,"salvationsSum":177,"activeWeeks":41,"launched2026":null,"yoy2025":{"total":817,"adults":559,"kids":100,"team":159},"yoyPct":-2.8,"yoyDiff":-23,"yoyAdultsPct":-2.1,"trend4":[783,840,849,823],"trend4Dates":["Sep 27","Oct 4","Oct 11","Oct 18"]},"WS":{"total":387,"adults":218,"kids":52,"team":117,"salvationsAvg":2.4,"salvationsSum":87,"activeWeeks":37,"launched2026":"Feb 1, 2026","yoy2025":null,"yoyPct":null,"yoyDiff":null,"yoyAdultsPct":null,"trend4":[295,310,299,269],"trend4Dates":["Sep 27","Oct 4","Oct 11","Oct 18"]}},"semiannual":{"ALL":{"total":4975,"adults":3556,"kids":655,"team":763,"salvationsAvg":53.2,"salvationsSum":1383,"activeWeeks":26,"launched2026":null,"yoy2025":{"total":4794,"adults":3506,"kids":593,"team":694},"yoyPct":3.8,"yoyDiff":181,"yoyAdultsPct":1.4,"trend4":[5510,5477,5446,5301],"trend4Dates":["Sep 27","Oct 4","Oct 11","Oct 18"]},"WP":{"total":2938,"adults":2219,"kids":351,"team":368,"salvationsAvg":38.0,"salvationsSum":988,"activeWeeks":26,"launched2026":null,"yoy2025":{"total":3280,"adults":2506,"kids":371,"team":403},"yoyPct":-10.4,"yoyDiff":-342,"yoyAdultsPct":-11.5,"trend4":[2963,2810,2958,2859],"trend4Dates":["Sep 27","Oct 4","Oct 11","Oct 18"]},"OV":{"total":825,"adults":580,"kids":108,"team":138,"salvationsAvg":4.7,"salvationsSum":122,"activeWeeks":26,"launched2026":null,"yoy2025":{"total":777,"adults":528,"kids":96,"team":153},"yoyPct":6.2,"yoyDiff":48,"yoyAdultsPct":9.8,"trend4":[783,840,849,823],"trend4Dates":["Sep 27","Oct 4","Oct 11","Oct 18"]},"SF":{"total":684,"adults":433,"kids":120,"team":132,"salvationsAvg":7.0,"salvationsSum":183,"activeWeeks":26,"launched2026":null,"yoy2025":{"total":736,"adults":473,"kids":126,"team":137},"yoyPct":-7.1,"yoyDiff":-52,"yoyAdultsPct":-8.5,"trend4":[650,693,644,626],"trend4Dates":["Sep 27","Oct 4","Oct 11","Oct 18"]},"WS":{"total":335,"adults":190,"kids":46,"team":99,"salvationsAvg":1.9,"salvationsSum":50,"activeWeeks":26,"launched2026":"Feb 1, 2026","yoy2025":null,"yoyPct":null,"yoyDiff":null,"yoyAdultsPct":null,"trend4":[295,310,299,269],"trend4Dates":["Sep 27","Oct 4","Oct 11","Oct 18"]},"HW":{"total":823,"adults":587,"kids":130,"team":107,"salvationsAvg":6.3,"salvationsSum":144,"activeWeeks":23,"launched2026":"May 17, 2026","yoy2025":null,"yoyPct":null,"yoyDiff":null,"yoyAdultsPct":null,"trend4":[820,824,696,724],"trend4Dates":["Sep 27","Oct 4","Oct 11","Oct 18"]}},"annual":{"ALL":{"total":4975,"adults":3581,"kids":632,"team":761,"salvationsAvg":60.2,"salvationsSum":3130,"activeWeeks":52,"launched2026":null,"yoy2025":{"total":4784,"adults":3501,"kids":596,"team":687},"yoyPct":4.0,"yoyDiff":191,"yoyAdultsPct":2.3,"trend4":[5510,5477,5446,5301],"trend4Dates":["Sep 27","Oct 4","Oct 11","Oct 18"]},"WP":{"total":3100,"adults":2359,"kids":357,"team":384,"salvationsAvg":44.5,"salvationsSum":2315,"activeWeeks":52,"launched2026":null,"yoy2025":{"total":3240,"adults":2475,"kids":370,"team":395},"yoyPct":-4.3,"yoyDiff":-140,"yoyAdultsPct":-4.7,"trend4":[2963,2810,2958,2859],"trend4Dates":["Sep 27","Oct 4","Oct 11","Oct 18"]},"OV":{"total":790,"adults":542,"kids":102,"team":146,"salvationsAvg":4.3,"salvationsSum":225,"activeWeeks":52,"launched2026":null,"yoy2025":{"total":807,"adults":550,"kids":99,"team":158},"yoyPct":-2.1,"yoyDiff":-17,"yoyAdultsPct":-1.5,"trend4":[783,840,849,823],"trend4Dates":["Sep 27","Oct 4","Oct 11","Oct 18"]},"SF":{"total":713,"adults":458,"kids":121,"team":134,"salvationsAvg":8.9,"salvationsSum":463,"activeWeeks":52,"launched2026":null,"yoy2025":{"total":737,"adults":477,"kids":127,"team":133},"yoyPct":-3.3,"yoyDiff":-24,"yoyAdultsPct":-4.0,"trend4":[650,693,644,626],"trend4Dates":["Sep 27","Oct 4","Oct 11","Oct 18"]},"WS":{"total":387,"adults":218,"kids":52,"team":117,"salvationsAvg":2.4,"salvationsSum":87,"activeWeeks":37,"launched2026":"Feb 1, 2026","yoy2025":null,"yoyPct":null,"yoyDiff":null,"yoyAdultsPct":null,"trend4":[295,310,299,269],"trend4Dates":["Sep 27","Oct 4","Oct 11","Oct 18"]},"HW":{"total":823,"adults":587,"kids":130,"team":107,"salvationsAvg":6.3,"salvationsSum":144,"activeWeeks":23,"launched2026":"May 17, 2026","yoy2025":null,"yoyPct":null,"yoyDiff":null,"yoyAdultsPct":null,"trend4":[820,824,696,724],"trend4Dates":["Sep 27","Oct 4","Oct 11","Oct 18"]}}},"locDetails":{"HW":{"launched2026":"May 17, 2026","services":["1st Service","2nd Service"],"horizons":{"weekly":{"services":[{"service":"1st Service","adults":285,"kids":70,"total":355},{"service":"2nd Service","adults":207,"kids":45,"total":252}],"depts":{"experience":21,"guestServices":71,"actionKids":25},"activeWeeks":1},"monthly":{"services":[{"service":"1st Service","adults":308,"kids":77,"total":385},{"service":"2nd Service","adults":225,"kids":45,"total":270}],"depts":{"experience":20,"guestServices":58,"actionKids":34},"activeWeeks":4},"quarterly":{"services":[{"service":"1st Service","adults":333,"kids":74,"total":407},{"service":"2nd Service","adults":269,"kids":57,"total":326}],"depts":{"experience":22,"guestServices":56,"actionKids":32},"activeWeeks":13},"ytd":{"services":[{"service":"1st Service","adults":287,"kids":60,"total":347},{"service":"2nd Service","adults":300,"kids":67,"total":367}],"depts":{"experience":22,"guestServices":54,"actionKids":30},"activeWeeks":23},"semiannual":{"services":[{"service":"1st Service","adults":287,"kids":60,"total":347},{"service":"2nd Service","adults":300,"kids":67,"total":367}],"depts":{"experience":22,"guestServices":54,"actionKids":30},"activeWeeks":23},"annual":{"services":[{"service":"1st Service","adults":287,"kids":60,"total":347},{"service":"2nd Service","adults":300,"kids":67,"total":367}],"depts":{"experience":22,"guestServices":54,"actionKids":30},"activeWeeks":23}}},"SF":{"launched2026":null,"services":["1st Service","2nd Service","3rd Service"],"horizons":{"weekly":{"services":[{"service":"1st Service","adults":134,"kids":26,"total":160},{"service":"2nd Service","adults":162,"kids":54,"total":216},{"service":"3rd Service","adults":98,"kids":36,"total":134}],"depts":{"experience":15,"guestServices":60,"actionKids":41},"activeWeeks":1},"monthly":{"services":[{"service":"1st Service","adults":132,"kids":26,"total":158},{"service":"2nd Service","adults":176,"kids":56,"total":232},{"service":"3rd Service","adults":101,"kids":35,"total":136}],"depts":{"experience":16,"guestServices":72,"actionKids":39},"activeWeeks":4},"quarterly":{"services":[{"service":"1st Service","adults":132,"kids":30,"total":162},{"service":"2nd Service","adults":191,"kids":59,"total":250},{"service":"3rd Service","adults":106,"kids":34,"total":140}],"depts":{"experience":17,"guestServices":72,"actionKids":41},"activeWeeks":13},"ytd":{"services":[{"service":"1st Service","adults":139,"kids":32,"total":171},{"service":"2nd Service","adults":194,"kids":54,"total":248},{"service":"3rd Service","adults":117,"kids":33,"total":150}],"depts":{"experience":16,"guestServices":75,"actionKids":42},"activeWeeks":41},"semiannual":{"services":[{"service":"1st Service","adults":136,"kids":32,"total":168},{"service":"2nd Service","adults":186,"kids":54,"total":240},{"service":"3rd Service","adults":111,"kids":34,"total":145}],"depts":{"experience":16,"guestServices":73,"actionKids":42},"activeWeeks":26},"annual":{"services":[{"service":"1st Service","adults":143,"kids":33,"total":176},{"service":"2nd Service","adults":202,"kids":55,"total":257},{"service":"3rd Service","adults":114,"kids":32,"total":146}],"depts":{"experience":17,"guestServices":75,"actionKids":42},"activeWeeks":52}}},"WP":{"launched2026":null,"services":["1st Service","2nd Service","3rd Service","4th Service"],"horizons":{"weekly":{"services":[{"service":"1st Service","adults":490,"kids":69,"total":559},{"service":"2nd Service","adults":749,"kids":138,"total":887},{"service":"3rd Service","adults":558,"kids":96,"total":654},{"service":"4th Service","adults":346,"kids":57,"total":403}],"depts":{"experience":50,"guestServices":176,"actionKids":131},"activeWeeks":1},"monthly":{"services":[{"service":"1st Service","adults":540,"kids":81,"total":621},{"service":"2nd Service","adults":719,"kids":126,"total":845},{"service":"3rd Service","adults":556,"kids":92,"total":648},{"service":"4th Service","adults":348,"kids":64,"total":412}],"depts":{"experience":55,"guestServices":184,"actionKids":132},"activeWeeks":4},"quarterly":{"services":[{"service":"1st Service","adults":570,"kids":83,"total":653},{"service":"2nd Service","adults":790,"kids":127,"total":917},{"service":"3rd Service","adults":600,"kids":98,"total":698},{"service":"4th Service","adults":357,"kids":62,"total":419}],"depts":{"experience":54,"guestServices":198,"actionKids":130},"activeWeeks":13},"ytd":{"services":[{"service":"1st Service","adults":557,"kids":85,"total":642},{"service":"2nd Service","adults":788,"kids":118,"total":906},{"service":"3rd Service","adults":575,"kids":87,"total":662},{"service":"4th Service","adults":363,"kids":64,"total":427}],"depts":{"experience":54,"guestServices":201,"actionKids":122},"activeWeeks":41},"semiannual":{"services":[{"service":"1st Service","adults":559,"kids":82,"total":641},{"service":"2nd Service","adults":760,"kids":117,"total":877},{"service":"3rd Service","adults":563,"kids":89,"total":652},{"service":"4th Service","adults":337,"kids":64,"total":401}],"depts":{"experience":53,"guestServices":193,"actionKids":121},"activeWeeks":26},"annual":{"services":[{"service":"1st Service","adults":577,"kids":88,"total":665},{"service":"2nd Service","adults":819,"kids":119,"total":938},{"service":"3rd Service","adults":581,"kids":85,"total":666},{"service":"4th Service","adults":382,"kids":64,"total":446}],"depts":{"experience":55,"guestServices":204,"actionKids":125},"activeWeeks":52}}},"OV":{"launched2026":null,"services":["1st Service","2nd Service","3rd Service"],"horizons":{"weekly":{"services":[{"service":"1st Service","adults":149,"kids":35,"total":184},{"service":"2nd Service","adults":250,"kids":35,"total":285},{"service":"3rd Service","adults":197,"kids":18,"total":215}],"depts":{"experience":17,"guestServices":81,"actionKids":40},"activeWeeks":1},"monthly":{"services":[{"service":"1st Service","adults":156,"kids":40,"total":196},{"service":"2nd Service","adults":261,"kids":38,"total":299},{"service":"3rd Service","adults":180,"kids":19,"total":199}],"depts":{"experience":16,"guestServices":76,"actionKids":37},"activeWeeks":4},"quarterly":{"services":[{"service":"1st Service","adults":168,"kids":39,"total":207},{"service":"2nd Service","adults":264,"kids":45,"total":309},{"service":"3rd Service","adults":186,"kids":24,"total":210}],"depts":{"experience":16,"guestServices":76,"actionKids":39},"activeWeeks":13},"ytd":{"services":[{"service":"1st Service","adults":218,"kids":50,"total":268},{"service":"2nd Service","adults":242,"kids":42,"total":284},{"service":"3rd Service","adults":86,"kids":12,"total":98}],"depts":{"experience":19,"guestServices":85,"actionKids":40},"activeWeeks":41},"semiannual":{"services":[{"service":"1st Service","adults":197,"kids":45,"total":242},{"service":"2nd Service","adults":246,"kids":44,"total":290},{"service":"3rd Service","adults":136,"kids":19,"total":155}],"depts":{"experience":16,"guestServices":80,"actionKids":42},"activeWeeks":26},"annual":{"services":[{"service":"1st Service","adults":231,"kids":52,"total":283},{"service":"2nd Service","adults":242,"kids":40,"total":282},{"service":"3rd Service","adults":68,"kids":9,"total":77}],"depts":{"experience":19,"guestServices":86,"actionKids":40},"activeWeeks":52}}},"WS":{"launched2026":"Feb 1, 2026","services":["1st Service","2nd Service"],"horizons":{"weekly":{"services":[{"service":"1st Service","adults":77,"kids":19,"total":96},{"service":"2nd Service","adults":76,"kids":18,"total":94}],"depts":{"experience":15,"guestServices":42,"actionKids":22},"activeWeeks":1},"monthly":{"services":[{"service":"1st Service","adults":81,"kids":25,"total":106},{"service":"2nd Service","adults":79,"kids":23,"total":102}],"depts":{"experience":13,"guestServices":50,"actionKids":22},"activeWeeks":4},"quarterly":{"services":[{"service":"1st Service","adults":97,"kids":23,"total":120},{"service":"2nd Service","adults":89,"kids":22,"total":111}],"depts":{"experience":14,"guestServices":59,"actionKids":23},"activeWeeks":13},"ytd":{"services":[{"service":"1st Service","adults":102,"kids":23,"total":125},{"service":"2nd Service","adults":98,"kids":25,"total":123}],"depts":{"experience":15,"guestServices":75,"actionKids":28},"activeWeeks":37},"semiannual":{"services":[{"service":"1st Service","adults":103,"kids":23,"total":126},{"service":"2nd Service","adults":86,"kids":23,"total":109}],"depts":{"experience":14,"guestServices":61,"actionKids":24},"activeWeeks":26},"annual":{"services":[{"service":"1st Service","adults":102,"kids":23,"total":125},{"service":"2nd Service","adults":98,"kids":25,"total":123}],"depts":{"experience":15,"guestServices":75,"actionKids":28},"activeWeeks":37}}}},"weeklySeries13":[{"date":"2026-07-26","label":"Jul 26","locs":{"ALL":{"total":4985,"adults":3663,"kids":575,"team":747,"salvations":64,"total2025":5042,"yoyPct":-1.1},"HW":{"total":866,"adults":660,"kids":111,"team":95,"salvations":9,"total2025":null,"yoyPct":null},"SF":{"total":703,"adults":447,"kids":117,"team":139,"salvations":6,"total2025":725,"yoyPct":-3.0},"WP":{"total":3170,"adults":2467,"kids":325,"team":378,"salvations":54,"total2025":3583,"yoyPct":-11.5},"OV":{"total":777,"adults":558,"kids":91,"team":128,"salvations":3,"total2025":735,"yoyPct":5.7},"WS":{"total":335,"adults":191,"kids":42,"team":102,"salvations":1,"total2025":null,"yoyPct":null}}},{"date":"2026-08-02","label":"Aug 2","locs":{"ALL":{"total":5100,"adults":3709,"kids":626,"team":765,"salvations":59,"total2025":4440,"yoyPct":14.9},"HW":{"total":897,"adults":663,"kids":126,"team":108,"salvations":12,"total2025":null,"yoyPct":null},"SF":{"total":704,"adults":456,"kids":116,"team":132,"salvations":2,"total2025":644,"yoyPct":9.3},"WP":{"total":3177,"adults":2426,"kids":357,"team":394,"salvations":44,"total2025":3057,"yoyPct":3.9},"OV":{"total":816,"adults":586,"kids":101,"team":129,"salvations":7,"total2025":740,"yoyPct":10.3},"WS":{"total":403,"adults":241,"kids":52,"team":110,"salvations":6,"total2025":null,"yoyPct":null}}},{"date":"2026-08-09","label":"Aug 9","locs":{"ALL":{"total":5321,"adults":3843,"kids":695,"team":783,"salvations":42,"total2025":5101,"yoyPct":4.3},"HW":{"total":913,"adults":670,"kids":147,"team":96,"salvations":6,"total2025":null,"yoyPct":null},"SF":{"total":734,"adults":454,"kids":133,"team":147,"salvations":5,"total2025":743,"yoyPct":-1.2},"WP":{"total":3250,"adults":2459,"kids":394,"team":397,"salvations":32,"total2025":3589,"yoyPct":-9.4},"OV":{"total":954,"adults":699,"kids":116,"team":139,"salvations":3,"total2025":770,"yoyPct":23.9},"WS":{"total":383,"adults":231,"kids":52,"team":100,"salvations":2,"total2025":null,"yoyPct":null}}},{"date":"2026-08-16","label":"Aug 16","locs":{"ALL":{"total":5361,"adults":3879,"kids":719,"team":763,"salvations":48,"total2025":5199,"yoyPct":3.1},"HW":{"total":846,"adults":595,"kids":137,"team":114,"salvations":6,"total2025":null,"yoyPct":null},"SF":{"total":714,"adults":472,"kids":116,"team":126,"salvations":6,"total2025":769,"yoyPct":-7.2},"WP":{"total":3357,"adults":2544,"kids":407,"team":406,"salvations":34,"total2025":3677,"yoyPct":-8.7},"OV":{"total":908,"adults":647,"kids":136,"team":125,"salvations":5,"total2025":754,"yoyPct":20.4},"WS":{"total":383,"adults":217,"kids":60,"team":106,"salvations":3,"total2025":null,"yoyPct":null}}},{"date":"2026-08-23","label":"Aug 23","locs":{"ALL":{"total":5218,"adults":3770,"kids":656,"team":792,"salvations":66,"total2025":5235,"yoyPct":-0.3},"HW":{"total":808,"adults":564,"kids":138,"team":106,"salvations":8,"total2025":null,"yoyPct":null},"SF":{"total":754,"adults":461,"kids":144,"team":149,"salvations":9,"total2025":747,"yoyPct":0.9},"WP":{"total":3182,"adults":2419,"kids":365,"team":398,"salvations":51,"total2025":3672,"yoyPct":-13.3},"OV":{"total":938,"adults":695,"kids":109,"team":134,"salvations":5,"total2025":816,"yoyPct":15.0},"WS":{"total":345,"adults":196,"kids":38,"team":111,"salvations":1,"total2025":null,"yoyPct":null}}},{"date":"2026-08-30","label":"Aug 30","locs":{"ALL":{"total":5034,"adults":3571,"kids":684,"team":779,"salvations":54,"total2025":4654,"yoyPct":8.2},"HW":{"total":850,"adults":615,"kids":142,"team":93,"salvations":4,"total2025":null,"yoyPct":null},"SF":{"total":709,"adults":444,"kids":141,"team":124,"salvations":8,"total2025":727,"yoyPct":-2.5},"WP":{"total":3064,"adults":2279,"kids":374,"team":411,"salvations":40,"total2025":3216,"yoyPct":-4.7},"OV":{"total":916,"adults":650,"kids":125,"team":141,"salvations":3,"total2025":711,"yoyPct":28.8},"WS":{"total":344,"adults":197,"kids":44,"team":103,"salvations":3,"total2025":null,"yoyPct":null}}},{"date":"2026-09-06","label":"Sep 6","locs":{"ALL":{"total":4523,"adults":3260,"kids":599,"team":664,"salvations":67,"total2025":6111,"yoyPct":-26.0},"HW":{"total":740,"adults":523,"kids":113,"team":104,"salvations":5,"total2025":null,"yoyPct":null},"SF":{"total":658,"adults":416,"kids":125,"team":117,"salvations":20,"total2025":832,"yoyPct":-20.9},"WP":{"total":2734,"adults":2070,"kids":337,"team":327,"salvations":41,"total2025":4368,"yoyPct":-37.4},"OV":{"total":850,"adults":619,"kids":105,"team":126,"salvations":6,"total2025":912,"yoyPct":-6.8},"WS":{"total":281,"adults":155,"kids":32,"team":94,"salvations":0,"total2025":null,"yoyPct":null}}},{"date":"2026-09-13","label":"Sep 13","locs":{"ALL":{"total":6028,"adults":4321,"kids":817,"team":890,"salvations":69,"total2025":5867,"yoyPct":2.7},"HW":{"total":1100,"adults":808,"kids":159,"team":133,"salvations":4,"total2025":null,"yoyPct":null},"SF":{"total":652,"adults":395,"kids":120,"team":137,"salvations":5,"total2025":864,"yoyPct":-24.5},"WP":{"total":3105,"adults":2339,"kids":378,"team":388,"salvations":52,"total2025":4107,"yoyPct":-24.4},"OV":{"total":863,"adults":605,"kids":124,"team":134,"salvations":4,"total2025":896,"yoyPct":-3.7},"WS":{"total":309,"adults":175,"kids":36,"team":98,"salvations":4,"total2025":null,"yoyPct":null}}},{"date":"2026-09-20","label":"Sep 20","locs":{"ALL":{"total":5870,"adults":4210,"kids":814,"team":846,"salvations":80,"total2025":5711,"yoyPct":2.8},"HW":{"total":871,"adults":603,"kids":137,"team":131,"salvations":4,"total2025":null,"yoyPct":null},"SF":{"total":641,"adults":399,"kids":123,"team":119,"salvations":7,"total2025":787,"yoyPct":-18.6},"WP":{"total":3238,"adults":2450,"kids":410,"team":378,"salvations":63,"total2025":4054,"yoyPct":-20.1},"OV":{"total":809,"adults":579,"kids":103,"team":127,"salvations":2,"total2025":870,"yoyPct":-7.0},"WS":{"total":311,"adults":179,"kids":41,"team":91,"salvations":4,"total2025":null,"yoyPct":null}}},{"date":"2026-09-27","label":"Sep 27","locs":{"ALL":{"total":5510,"adults":3975,"kids":697,"team":838,"salvations":76,"total2025":5522,"yoyPct":-0.2},"HW":{"total":820,"adults":586,"kids":117,"team":117,"salvations":15,"total2025":null,"yoyPct":null},"SF":{"total":650,"adults":419,"kids":102,"team":129,"salvations":4,"total2025":809,"yoyPct":-19.7},"WP":{"total":2963,"adults":2246,"kids":339,"team":378,"salvations":55,"total2025":3869,"yoyPct":-23.4},"OV":{"total":783,"adults":568,"kids":93,"team":122,"salvations":1,"total2025":844,"yoyPct":-7.2},"WS":{"total":295,"adults":157,"kids":46,"team":92,"salvations":1,"total2025":null,"yoyPct":null}}},{"date":"2026-10-04","label":"Oct 4","locs":{"ALL":{"total":5477,"adults":3879,"kids":787,"team":811,"salvations":127,"total2025":5626,"yoyPct":-2.6},"HW":{"total":824,"adults":566,"kids":150,"team":108,"salvations":8,"total2025":null,"yoyPct":null},"SF":{"total":693,"adults":430,"kids":136,"team":127,"salvations":20,"total2025":902,"yoyPct":-23.2},"WP":{"total":2810,"adults":2092,"kids":348,"team":370,"salvations":84,"total2025":3858,"yoyPct":-27.2},"OV":{"total":840,"adults":630,"kids":93,"team":117,"salvations":11,"total2025":866,"yoyPct":-3.0},"WS":{"total":310,"adults":161,"kids":60,"team":89,"salvations":4,"total2025":null,"yoyPct":null}}},{"date":"2026-10-11","label":"Oct 11","locs":{"ALL":{"total":5446,"adults":3820,"kids":790,"team":836,"salvations":61,"total2025":5181,"yoyPct":5.1},"HW":{"total":696,"adults":486,"kids":107,"team":103,"salvations":7,"total2025":null,"yoyPct":null},"SF":{"total":644,"adults":395,"kids":113,"team":136,"salvations":7,"total2025":811,"yoyPct":-20.6},"WP":{"total":2958,"adults":2174,"kids":407,"team":377,"salvations":40,"total2025":3562,"yoyPct":-17.0},"OV":{"total":849,"adults":596,"kids":114,"team":139,"salvations":5,"total2025":808,"yoyPct":5.1},"WS":{"total":299,"adults":169,"kids":49,"team":81,"salvations":2,"total2025":null,"yoyPct":null}}},{"date":"2026-10-18","label":"Oct 18","locs":{"ALL":{"total":5301,"adults":3778,"kids":716,"team":807,"salvations":58,"total2025":5225,"yoyPct":1.5},"HW":{"total":724,"adults":492,"kids":115,"team":117,"salvations":2,"total2025":null,"yoyPct":null},"SF":{"total":626,"adults":394,"kids":116,"team":116,"salvations":4,"total2025":785,"yoyPct":-20.3},"WP":{"total":2859,"adults":2142,"kids":360,"team":357,"salvations":47,"total2025":3595,"yoyPct":-20.5},"OV":{"total":823,"adults":597,"kids":88,"team":138,"salvations":3,"total2025":845,"yoyPct":-2.6},"WS":{"total":269,"adults":153,"kids":37,"team":79,"salvations":2,"total2025":null,"yoyPct":null}}}]};

const ATTENDANCE = ATTENDANCE_DATA.horizons;

const fmtNum = (n: number | null | undefined): string =>
  n === null || n === undefined ? "-" : n.toLocaleString("en-US");

const GOALS: GoalDef[] = [
  {
    id: "conn",
    title: "Connection",
    subtitle: "Unique adults in an A-Team or Small Group",
    target: 75,
    targetText: "75%",
    pcoLabel: "Groups & A-Team ↗",
    pcoUrls: {
      ALL: "https://groups.planningcenteronline.com/groups",
      HW: "https://groups.planningcenteronline.com/groups?campus_id=122789",
      SF: "https://groups.planningcenteronline.com/groups?campus_id=23227",
      WP: "https://groups.planningcenteronline.com/groups?campus_id=23279",
      OV: "https://groups.planningcenteronline.com/groups?campus_id=23225",
      WS: "https://groups.planningcenteronline.com/groups?campus_id=112938",
    },
    byHorizon: {
      weekly: { ALL: { pct: 64.0, count: "2,417 unique adults", tone: "warning" }, HW: { pct: 125.6, count: "618 unique adults", tone: "success" }, SF: { pct: 81.0, count: "319 unique adults", tone: "success" }, WP: { pct: 51.5, count: "1,103 unique adults", tone: "danger" }, OV: { pct: 57.0, count: "340 unique adults", tone: "danger" }, WS: { pct: 101.3, count: "155 unique adults", tone: "success" } },
      monthly: { ALL: { pct: 68.8, count: "2,658 unique adults", tone: "warning" }, HW: { pct: 123.9, count: "659 unique adults", tone: "success" }, SF: { pct: 88.3, count: "362 unique adults", tone: "success" }, WP: { pct: 58.2, count: "1,260 unique adults", tone: "danger" }, OV: { pct: 63.5, count: "380 unique adults", tone: "warning" }, WS: { pct: 115.0, count: "184 unique adults", tone: "success" } },
      quarterly: { ALL: { pct: 74.2, count: "2,837 unique adults", tone: "warning" }, HW: { pct: 113.5, count: "683 unique adults", tone: "success" }, SF: { pct: 94.4, count: "405 unique adults", tone: "success" }, WP: { pct: 59.8, count: "1,386 unique adults", tone: "danger" }, OV: { pct: 67.3, count: "416 unique adults", tone: "warning" }, WS: { pct: 110.2, count: "205 unique adults", tone: "success" } },
      semiannual: { ALL: { pct: 80.6, count: "2,867 unique adults", tone: "success" }, HW: { pct: 116.4, count: "683 unique adults", tone: "success" }, SF: { pct: 95.4, count: "413 unique adults", tone: "success" }, WP: { pct: 63.2, count: "1,402 unique adults", tone: "warning" }, OV: { pct: 72.9, count: "423 unique adults", tone: "warning" }, WS: { pct: 111.6, count: "212 unique adults", tone: "success" } },
      annual: { ALL: { pct: 84.9, count: "3,041 unique adults", tone: "success" }, HW: { pct: 116.4, count: "683 unique adults", tone: "success" }, SF: { pct: 105.7, count: "484 unique adults", tone: "success" }, WP: { pct: 60.0, count: "1,415 unique adults", tone: "warning" }, OV: { pct: 114.4, count: "620 unique adults", tone: "success" }, WS: { pct: 97.2, count: "212 unique adults", tone: "success" } },
    },
  },
  {
    id: "serve",
    title: "Adults Serving",
    subtitle: "Unique people checked in to serve on Sunday in Planning Center Check-Ins",
    target: 30,
    targetText: "30%",
    pcoLabel: "Services Teams ↗",
    pcoUrls: {
      ALL: "https://services.planningcenteronline.com/dashboard",
      HW: "https://services.planningcenteronline.com/service_types/1790388/teams",
      SF: "https://services.planningcenteronline.com/service_types/717426/teams",
      WP: "https://services.planningcenteronline.com/service_types/845329/teams",
      OV: "https://services.planningcenteronline.com/service_types/1777530/teams",
      WS: "https://services.planningcenteronline.com/service_types/1699519/teams",
    },
    byHorizon: {
      weekly: { ALL: { pct: 14.9, count: "562 unique", tone: "danger" }, HW: { pct: 17.5, count: "86 unique", tone: "danger" }, SF: { pct: 20.6, count: "81 unique", tone: "danger" }, WP: { pct: 12.8, count: "275 unique", tone: "danger" }, OV: { pct: 12.4, count: "74 unique", tone: "danger" }, WS: { pct: 33.3, count: "51 unique", tone: "success" } },
      monthly: { ALL: { pct: 28.7, count: "1,107 unique", tone: "warning" }, HW: { pct: 35.2, count: "187 unique", tone: "success" }, SF: { pct: 41.2, count: "169 unique", tone: "success" }, WP: { pct: 24.2, count: "523 unique", tone: "warning" }, OV: { pct: 24.1, count: "144 unique", tone: "warning" }, WS: { pct: 60.0, count: "96 unique", tone: "success" } },
      quarterly: { ALL: { pct: 37.4, count: "1,429 unique", tone: "success" }, HW: { pct: 37.4, count: "225 unique", tone: "success" }, SF: { pct: 55.9, count: "240 unique", tone: "success" }, WP: { pct: 29.8, count: "691 unique", tone: "warning" }, OV: { pct: 32.5, count: "201 unique", tone: "success" }, WS: { pct: 65.6, count: "122 unique", tone: "success" } },
      semiannual: { ALL: { pct: 41.7, count: "1,483 unique", tone: "success" }, HW: { pct: 38.3, count: "225 unique", tone: "success" }, SF: { pct: 58.9, count: "255 unique", tone: "success" }, WP: { pct: 32.3, count: "716 unique", tone: "success" }, OV: { pct: 36.4, count: "211 unique", tone: "success" }, WS: { pct: 67.9, count: "129 unique", tone: "success" } },
      annual: { ALL: { pct: 41.4, count: "1,483 unique", tone: "success" }, HW: { pct: 38.3, count: "225 unique", tone: "success" }, SF: { pct: 55.7, count: "255 unique", tone: "success" }, WP: { pct: 30.4, count: "716 unique", tone: "success" }, OV: { pct: 38.9, count: "211 unique", tone: "success" }, WS: { pct: 59.2, count: "129 unique", tone: "success" } },
    },
  },
  {
    id: "steps_att",
    title: "Attending Steps",
    subtitle: "Action Steps check-ins vs adult attendance",
    target: 1.5,
    targetText: "1–2%",
    pcoLabel: "Check-Ins Event ↗",
    pcoUrls: {
      ALL: "https://check-ins.planningcenteronline.com/events",
      HW: "https://check-ins.planningcenteronline.com/events/994864",
      SF: "https://check-ins.planningcenteronline.com/events/172481",
      WP: "https://check-ins.planningcenteronline.com/events/194896",
      OV: "https://check-ins.planningcenteronline.com/events/172480",
      WS: "https://check-ins.planningcenteronline.com/events/172469",
    },
    byHorizon: {
      weekly: { ALL: { pct: 1.7, count: "66 unique adults", tone: "success" }, HW: { pct: 3.0, count: "15 unique adults", tone: "success" }, SF: { pct: 1.5, count: "6 unique adults", tone: "success" }, WP: { pct: 1.4, count: "31 unique adults", tone: "success" }, OV: { pct: 1.7, count: "10 unique adults", tone: "success" }, WS: { pct: 2.6, count: "4 unique adults", tone: "success" } },
      monthly: { ALL: { pct: 2.6, count: "102 unique adults", tone: "success" }, HW: { pct: 3.6, count: "19 unique adults", tone: "success" }, SF: { pct: 2.4, count: "10 unique adults", tone: "success" }, WP: { pct: 2.5, count: "54 unique adults", tone: "success" }, OV: { pct: 2.3, count: "14 unique adults", tone: "success" }, WS: { pct: 3.1, count: "5 unique adults", tone: "success" } },
      quarterly: { ALL: { pct: 8.8, count: "335 unique adults", tone: "success" }, HW: { pct: 7.0, count: "42 unique adults", tone: "success" }, SF: { pct: 7.7, count: "33 unique adults", tone: "success" }, WP: { pct: 8.9, count: "207 unique adults", tone: "success" }, OV: { pct: 4.4, count: "27 unique adults", tone: "success" }, WS: { pct: 14.5, count: "27 unique adults", tone: "success" } },
      semiannual: {
        ALL: { pct: 15.1, count: "537 unique adults", tone: "success" },
        HW: { pct: 7.2, count: "42 unique adults", tone: "success" },
        SF: { pct: 15.9, count: "69 unique adults", tone: "success" },
        WP: { pct: 14.2, count: "316 unique adults", tone: "success" },
        OV: { pct: 11.2, count: "65 unique adults", tone: "success" },
        WS: { pct: 24.2, count: "46 unique adults", tone: "success" },
      },
      annual: {
        ALL: { pct: 23.3, count: "833 unique adults", tone: "success" },
        HW: { pct: 7.2, count: "42 unique adults", tone: "success" },
        SF: { pct: 34.1, count: "156 unique adults", tone: "success" },
        WP: { pct: 20.5, count: "484 unique adults", tone: "success" },
        OV: { pct: 18.8, count: "102 unique adults", tone: "success" },
        WS: { pct: 24.8, count: "54 unique adults", tone: "success" },
      },
    },
  },
  {
    id: "steps_cmp",
    title: "Completing Steps",
    subtitle: "Unique adults completing Action Steps (Step 1 + Step 2)",
    target: 5,
    targetText: "5%",
    pcoLabel: "Steps Workflows ↗",
    pcoUrls: {
      ALL: "https://people.planningcenteronline.com/workflows",
      HW: "https://people.planningcenteronline.com/workflows/748818",
      SF: "https://people.planningcenteronline.com/workflows/513021",
      WP: "https://people.planningcenteronline.com/workflows/617518",
      OV: "https://people.planningcenteronline.com/workflows/513020",
      WS: "https://people.planningcenteronline.com/workflows/686861",
    },
    byHorizon: {
      weekly: { ALL: { pct: 1.1, count: "43 unique adults", tone: "danger" }, HW: { pct: 1.8, count: "9 unique adults", tone: "danger" }, SF: { pct: 1.0, count: "4 unique adults", tone: "danger" }, WP: { pct: 0.8, count: "18 unique adults", tone: "danger" }, OV: { pct: 1.5, count: "9 unique adults", tone: "danger" }, WS: { pct: 2.0, count: "3 unique adults", tone: "danger" } },
      monthly: { ALL: { pct: 1.1, count: "43 unique adults", tone: "danger" }, HW: { pct: 1.7, count: "9 unique adults", tone: "danger" }, SF: { pct: 1.0, count: "4 unique adults", tone: "danger" }, WP: { pct: 0.8, count: "18 unique adults", tone: "danger" }, OV: { pct: 1.5, count: "9 unique adults", tone: "danger" }, WS: { pct: 1.9, count: "3 unique adults", tone: "danger" } },
      quarterly: { ALL: { pct: 4.2, count: "162 unique adults", tone: "warning" }, HW: { pct: 2.8, count: "17 unique adults", tone: "danger" }, SF: { pct: 3.0, count: "13 unique adults", tone: "warning" }, WP: { pct: 4.4, count: "101 unique adults", tone: "warning" }, OV: { pct: 2.9, count: "18 unique adults", tone: "danger" }, WS: { pct: 7.0, count: "13 unique adults", tone: "success" } },
      semiannual: {
        ALL: { pct: 7.7, count: "275 unique adults", tone: "success" },
        HW: { pct: 2.9, count: "17 unique adults", tone: "danger" },
        SF: { pct: 7.9, count: "34 unique adults", tone: "success" },
        WP: { pct: 7.3, count: "163 unique adults", tone: "success" },
        OV: { pct: 6.2, count: "36 unique adults", tone: "success" },
        WS: { pct: 13.2, count: "25 unique adults", tone: "success" },
      },
      annual: {
        ALL: { pct: 12.5, count: "449 unique adults", tone: "success" },
        HW: { pct: 2.9, count: "17 unique adults", tone: "danger" },
        SF: { pct: 19.0, count: "87 unique adults", tone: "success" },
        WP: { pct: 11.1, count: "261 unique adults", tone: "success" },
        OV: { pct: 10.0, count: "54 unique adults", tone: "success" },
        WS: { pct: 13.8, count: "30 unique adults", tone: "success" },
      },
    },
  },
  {
    id: "grp_avail",
    title: "Groups Available",
    subtitle: "Listed small groups per 100 adults",
    target: 7,
    targetText: "7%",
    pcoLabel: "Small Groups ↗",
    pcoUrls: {
      ALL: "https://groups.planningcenteronline.com/groups?group_type_id=262665",
      HW: "https://groups.planningcenteronline.com/groups?group_type_id=262665&campus_id=122789",
      SF: "https://groups.planningcenteronline.com/groups?group_type_id=262665&campus_id=23227",
      WP: "https://groups.planningcenteronline.com/groups?group_type_id=262665&campus_id=23279",
      OV: "https://groups.planningcenteronline.com/groups?group_type_id=262665&campus_id=23225",
      WS: "https://groups.planningcenteronline.com/groups?group_type_id=262665&campus_id=112938",
    },
    byHorizon: {
      weekly: { ALL: { pct: 5.7, count: "215 listed (297 total)", tone: "warning" }, HW: { pct: 9.8, count: "48 listed (55 total)", tone: "success" }, SF: { pct: 9.9, count: "39 listed (44 total)", tone: "success" }, WP: { pct: 2.4, count: "51 listed (96 total)", tone: "danger" }, OV: { pct: 8.0, count: "48 listed (62 total)", tone: "success" }, WS: { pct: 8.5, count: "13 listed (18 total)", tone: "success" } },
      monthly: { ALL: { pct: 5.6, count: "215 listed (297 total)", tone: "warning" }, HW: { pct: 9.0, count: "48 listed (55 total)", tone: "success" }, SF: { pct: 9.5, count: "39 listed (44 total)", tone: "success" }, WP: { pct: 2.4, count: "51 listed (96 total)", tone: "danger" }, OV: { pct: 8.0, count: "48 listed (62 total)", tone: "success" }, WS: { pct: 8.1, count: "13 listed (18 total)", tone: "success" } },
      quarterly: { ALL: { pct: 5.6, count: "215 listed (297 total)", tone: "warning" }, HW: { pct: 8.0, count: "48 listed (55 total)", tone: "success" }, SF: { pct: 9.1, count: "39 listed (44 total)", tone: "success" }, WP: { pct: 2.2, count: "51 listed (96 total)", tone: "danger" }, OV: { pct: 7.8, count: "48 listed (62 total)", tone: "success" }, WS: { pct: 7.0, count: "13 listed (18 total)", tone: "success" } },
      semiannual: {
        ALL: { pct: 6.0, count: "215 listed (297 total)", tone: "warning" },
        HW: { pct: 8.2, count: "48 listed (55 total)", tone: "success" },
        SF: { pct: 9.0, count: "39 listed (44 total)", tone: "success" },
        WP: { pct: 2.3, count: "51 listed (96 total)", tone: "danger" },
        OV: { pct: 8.3, count: "48 listed (62 total)", tone: "success" },
        WS: { pct: 6.8, count: "13 listed (18 total)", tone: "warning" },
      },
      annual: {
        ALL: { pct: 6.0, count: "215 listed (297 total)", tone: "warning" },
        HW: { pct: 8.2, count: "48 listed (55 total)", tone: "success" },
        SF: { pct: 8.5, count: "39 listed (44 total)", tone: "success" },
        WP: { pct: 2.2, count: "51 listed (96 total)", tone: "danger" },
        OV: { pct: 8.9, count: "48 listed (62 total)", tone: "success" },
        WS: { pct: 6.0, count: "13 listed (18 total)", tone: "warning" },
      },
    },
  },
  {
    id: "grp_part",
    title: "Adults in Groups",
    subtitle: "Unique adults enrolled in an active 2026 small group",
    target: 50,
    targetText: "50%",
    pcoLabel: "Group Memberships ↗",
    pcoUrls: {
      ALL: "https://groups.planningcenteronline.com/groups?group_type_id=262665",
      HW: "https://groups.planningcenteronline.com/groups?group_type_id=262665&campus_id=122789",
      SF: "https://groups.planningcenteronline.com/groups?group_type_id=262665&campus_id=23227",
      WP: "https://groups.planningcenteronline.com/groups?group_type_id=262665&campus_id=23279",
      OV: "https://groups.planningcenteronline.com/groups?group_type_id=262665&campus_id=23225",
      WS: "https://groups.planningcenteronline.com/groups?group_type_id=262665&campus_id=112938",
    },
    byHorizon: {
      weekly: { ALL: { pct: 58.3, count: "2,201 unique adults", tone: "success" }, HW: { pct: 118.1, count: "581 unique adults", tone: "success" }, SF: { pct: 71.6, count: "282 unique adults", tone: "success" }, WP: { pct: 44.9, count: "962 unique adults", tone: "warning" }, OV: { pct: 52.3, count: "312 unique adults", tone: "success" }, WS: { pct: 81.7, count: "125 unique adults", tone: "success" } },
      monthly: { ALL: { pct: 57.0, count: "2,201 unique adults", tone: "success" }, HW: { pct: 109.2, count: "581 unique adults", tone: "success" }, SF: { pct: 68.8, count: "282 unique adults", tone: "success" }, WP: { pct: 44.5, count: "962 unique adults", tone: "warning" }, OV: { pct: 52.2, count: "312 unique adults", tone: "success" }, WS: { pct: 78.1, count: "125 unique adults", tone: "success" } },
      quarterly: { ALL: { pct: 57.6, count: "2,201 unique adults", tone: "success" }, HW: { pct: 96.5, count: "581 unique adults", tone: "success" }, SF: { pct: 65.7, count: "282 unique adults", tone: "success" }, WP: { pct: 41.5, count: "962 unique adults", tone: "warning" }, OV: { pct: 50.5, count: "312 unique adults", tone: "success" }, WS: { pct: 67.2, count: "125 unique adults", tone: "success" } },
      semiannual: {
        ALL: { pct: 61.9, count: "2,201 unique adults", tone: "success" },
        HW: { pct: 99.0, count: "581 unique adults", tone: "success" },
        SF: { pct: 65.1, count: "282 unique adults", tone: "success" },
        WP: { pct: 43.4, count: "962 unique adults", tone: "warning" },
        OV: { pct: 53.8, count: "312 unique adults", tone: "success" },
        WS: { pct: 65.8, count: "125 unique adults", tone: "success" },
      },
      annual: {
        ALL: { pct: 61.5, count: "2,201 unique adults", tone: "success" },
        HW: { pct: 99.0, count: "581 unique adults", tone: "success" },
        SF: { pct: 61.6, count: "282 unique adults", tone: "success" },
        WP: { pct: 40.8, count: "962 unique adults", tone: "warning" },
        OV: { pct: 57.6, count: "312 unique adults", tone: "success" },
        WS: { pct: 57.3, count: "125 unique adults", tone: "success" },
      },
    },
  },
  {
    id: "students",
    title: "Students",
    subtitle: "City Groups student attendance vs adult attendance",
    target: 10,
    targetText: "10%",
    pcoLabel: "City Groups Check-Ins ↗",
    pcoUrls: {
      ALL: "https://check-ins.planningcenteronline.com/events",
      HW: "https://check-ins.planningcenteronline.com/events/994871",
      SF: "https://check-ins.planningcenteronline.com/events/610245",
      WP: "https://check-ins.planningcenteronline.com/events/542354",
      OV: "https://check-ins.planningcenteronline.com/events/733553",
      WS: "https://check-ins.planningcenteronline.com/events/950353",
    },
    byHorizon: {
      weekly: { ALL: { pct: 8.5, count: "320 students", tone: "warning" }, HW: { pct: 9.3, count: "46 students", tone: "warning" }, SF: { pct: 9.1, count: "36 students", tone: "warning" }, WP: { pct: 9.1, count: "195 students", tone: "warning" }, OV: { pct: 7.2, count: "43 students", tone: "warning" }, WS: { pct: 0.0, count: "0 students", tone: "danger" } },
      monthly: { ALL: { pct: 8.5, count: "328 students", tone: "warning" }, HW: { pct: 8.4, count: "45 students", tone: "warning" }, SF: { pct: 14.1, count: "58 students", tone: "success" }, WP: { pct: 8.6, count: "187 students", tone: "warning" }, OV: { pct: 6.6, count: "39 students", tone: "warning" }, WS: { pct: 0.0, count: "0 students", tone: "danger" } },
      quarterly: { ALL: { pct: 8.8, count: "336 students", tone: "warning" }, HW: { pct: 7.4, count: "45 students", tone: "warning" }, SF: { pct: 11.9, count: "51 students", tone: "success" }, WP: { pct: 8.5, count: "197 students", tone: "warning" }, OV: { pct: 7.0, count: "43 students", tone: "warning" }, WS: { pct: 0.0, count: "0 students", tone: "danger" } },
      semiannual: {
        ALL: { pct: 8.1, count: "288 students", tone: "warning" },
        HW: { pct: 7.5, count: "44 students", tone: "warning" },
        SF: { pct: 9.7, count: "42 students", tone: "warning" },
        WP: { pct: 7.3, count: "163 students", tone: "warning" },
        OV: { pct: 6.6, count: "38 students", tone: "danger" },
        WS: { pct: 0.0, count: "0 students", tone: "danger" },
      },
      annual: {
        ALL: { pct: 7.6, count: "271 students", tone: "warning" },
        HW: { pct: 7.5, count: "44 students", tone: "warning" },
        SF: { pct: 8.7, count: "40 students", tone: "warning" },
        WP: { pct: 6.4, count: "150 students", tone: "danger" },
        OV: { pct: 6.6, count: "36 students", tone: "danger" },
        WS: { pct: 0.0, count: "0 students", tone: "danger" },
      },
    },
  },
  {
    id: "kids",
    title: "Action Kids",
    subtitle: "Kids check-ins vs adult attendance",
    target: 30,
    targetText: "30%",
    pcoLabel: "Action Kids Plans ↗",
    pcoUrls: {
      ALL: "https://services.planningcenteronline.com/dashboard",
      HW: "https://services.planningcenteronline.com/service_types/1800367/plans",
      SF: "https://services.planningcenteronline.com/service_types/716525/plans",
      WP: "https://services.planningcenteronline.com/service_types/842221/plans",
      OV: "https://services.planningcenteronline.com/service_types/499291/plans",
      WS: "https://services.planningcenteronline.com/service_types/1725781/plans",
    },
    byHorizon: {
      weekly: { ALL: { pct: 19.0, count: "716 kids", tone: "danger" }, HW: { pct: 23.4, count: "115 kids", tone: "danger" }, SF: { pct: 29.4, count: "116 kids", tone: "warning" }, WP: { pct: 16.8, count: "360 kids", tone: "danger" }, OV: { pct: 14.7, count: "88 kids", tone: "danger" }, WS: { pct: 24.2, count: "37 kids", tone: "warning" } },
      monthly: { ALL: { pct: 19.4, count: "748 kids", tone: "danger" }, HW: { pct: 23.0, count: "122 kids", tone: "danger" }, SF: { pct: 28.5, count: "117 kids", tone: "warning" }, WP: { pct: 16.8, count: "364 kids", tone: "danger" }, OV: { pct: 16.2, count: "97 kids", tone: "danger" }, WS: { pct: 30.0, count: "48 kids", tone: "success" } },
      quarterly: { ALL: { pct: 18.5, count: "706 kids", tone: "danger" }, HW: { pct: 21.8, count: "131 kids", tone: "danger" }, SF: { pct: 28.7, count: "123 kids", tone: "warning" }, WP: { pct: 15.9, count: "369 kids", tone: "danger" }, OV: { pct: 17.5, count: "108 kids", tone: "danger" }, WS: { pct: 24.2, count: "45 kids", tone: "warning" } },
      semiannual: {
        ALL: { pct: 18.4, count: "655 kids", tone: "danger" },
        HW: { pct: 22.1, count: "130 kids", tone: "danger" },
        SF: { pct: 27.7, count: "120 kids", tone: "warning" },
        WP: { pct: 15.8, count: "351 kids", tone: "danger" },
        OV: { pct: 18.6, count: "108 kids", tone: "danger" },
        WS: { pct: 24.2, count: "46 kids", tone: "warning" },
      },
      annual: {
        ALL: { pct: 17.6, count: "632 kids", tone: "danger" },
        HW: { pct: 22.1, count: "130 kids", tone: "danger" },
        SF: { pct: 26.4, count: "121 kids", tone: "warning" },
        WP: { pct: 15.1, count: "357 kids", tone: "danger" },
        OV: { pct: 18.8, count: "102 kids", tone: "danger" },
        WS: { pct: 23.9, count: "52 kids", tone: "danger" },
      },
    },
  },
];

const SUNDAY_CARE: Record<LocCode, {
  confPeople: number;
  unconfPeople: number;
  confRate: number;
  oct18UnconfPeople: number;
  repeatUnconfPeople: number;
  highDeclinePeople: number;
  inactive30d: number;
  rosterTotal: number;
  depts: Array<{ name: string; c: number; u: number; d: number; rate: number; planId: string; oct18PlanId: string; stId: string }>;
}> = {
  ALL: {
    confPeople: 660, unconfPeople: 239, confRate: 71.9, oct18UnconfPeople: 266, repeatUnconfPeople: 283, highDeclinePeople: 290, inactive30d: 984, rosterTotal: 2067,
    depts: [
      { name: "Weekend Service", c: 143, u: 20, d: 30, rate: 88, planId: "91481065", oct18PlanId: "91481064", stId: "858409" },
      { name: "Guest Services", c: 389, u: 161, d: 297, rate: 71, planId: "92297705", oct18PlanId: "92297676", stId: "845329" },
      { name: "Action Kids", c: 206, u: 108, d: 153, rate: 66, planId: "92300122", oct18PlanId: "92300121", stId: "842221" },
    ],
  },
  HW: {
    confPeople: 93, unconfPeople: 12, confRate: 85.1, oct18UnconfPeople: 28, repeatUnconfPeople: 29, highDeclinePeople: 26, inactive30d: 92, rosterTotal: 283,
    depts: [
      { name: "Weekend Service", c: 24, u: 4, d: 4, rate: 86, planId: "92259115", oct18PlanId: "92259108", stId: "1792723" },
      { name: "Guest Services", c: 48, u: 7, d: 38, rate: 87, planId: "92151843", oct18PlanId: "92082971", stId: "1790388" },
      { name: "Action Kids", c: 31, u: 7, d: 19, rate: 82, planId: "92145115", oct18PlanId: "92145114", stId: "1800367" },
    ],
  },
  SF: {
    confPeople: 101, unconfPeople: 25, confRate: 80.1, oct18UnconfPeople: 22, repeatUnconfPeople: 27, highDeclinePeople: 45, inactive30d: 188, rosterTotal: 350,
    depts: [
      { name: "Weekend Service", c: 27, u: 2, d: 0, rate: 93, planId: "91922141", oct18PlanId: "91922140", stId: "717576" },
      { name: "Guest Services", c: 57, u: 22, d: 38, rate: 72, planId: "92294241", oct18PlanId: "92294193", stId: "717426" },
      { name: "Action Kids", c: 29, u: 4, d: 13, rate: 88, planId: "92096943", oct18PlanId: "92096942", stId: "716525" },
    ],
  },
  WP: {
    confPeople: 310, unconfPeople: 158, confRate: 64.6, oct18UnconfPeople: 162, repeatUnconfPeople: 168, highDeclinePeople: 142, inactive30d: 655, rosterTotal: 1164,
    depts: [
      { name: "Weekend Service", c: 49, u: 12, d: 24, rate: 80, planId: "91481065", oct18PlanId: "91481064", stId: "858409" },
      { name: "Guest Services", c: 186, u: 90, d: 150, rate: 67, planId: "92297705", oct18PlanId: "92297676", stId: "845329" },
      { name: "Action Kids", c: 97, u: 80, d: 79, rate: 55, planId: "92300122", oct18PlanId: "92300121", stId: "842221" },
    ],
  },
  OV: {
    confPeople: 100, unconfPeople: 34, confRate: 74.0, oct18UnconfPeople: 30, repeatUnconfPeople: 36, highDeclinePeople: 49, inactive30d: 221, rosterTotal: 365,
    depts: [
      { name: "Weekend Service", c: 30, u: 0, d: 1, rate: 100, planId: "92148271", oct18PlanId: "92148270", stId: "499279" },
      { name: "Guest Services", c: 55, u: 30, d: 44, rate: 65, planId: "92237542", oct18PlanId: "92237541", stId: "1777530" },
      { name: "Action Kids", c: 29, u: 10, d: 31, rate: 74, planId: "92233709", oct18PlanId: "92233708", stId: "499291" },
    ],
  },
  WS: {
    confPeople: 63, unconfPeople: 14, confRate: 78.4, oct18UnconfPeople: 24, repeatUnconfPeople: 23, highDeclinePeople: 28, inactive30d: 117, rosterTotal: 203,
    depts: [
      { name: "Weekend Service", c: 13, u: 2, d: 1, rate: 87, planId: "92092980", oct18PlanId: "92092978", stId: "1695472" },
      { name: "Guest Services", c: 43, u: 12, d: 27, rate: 78, planId: "92207624", oct18PlanId: "92207623", stId: "1699519" },
      { name: "Action Kids", c: 20, u: 7, d: 11, rate: 74, planId: "92094495", oct18PlanId: "92094494", stId: "1725781" },
    ],
  },
};

const CARE_PEOPLE: Record<CareFilter, CarePerson[]> = {
  oct25_u: [
    { loc: "HW", name: "Allison Manikis", team: "Kids Preschool", badge: "Oct 25 Unconfirmed", context: "Orange Room · Scheduled Oct 25", tone: "warning", pid: "198860377", planId: "92145115", stId: "1800367" },
    { loc: "HW", name: "Ashley Maestre", team: "Kids Check-In", badge: "Oct 25 Unconfirmed", context: "Check-In · Scheduled Oct 25", tone: "warning", pid: "198865231", planId: "92145115", stId: "1800367" },
    { loc: "HW", name: "Chavez Spencer", team: "Greeters", badge: "Checked In Today ✓", context: "Greeter · Scheduled Oct 25 · Checked in at HW", tone: "warning", pid: "34975037", planId: "92151843", stId: "1790388" },
    { loc: "HW", name: "Cristina Suro", team: "Prayer Team", badge: "Oct 25 Unconfirmed", context: "Prayer · Scheduled Oct 25", tone: "warning", pid: "196659448", planId: "92151843", stId: "1790388" },
    { loc: "HW", name: "David Chiles", team: "Parking", badge: "Oct 25 Unconfirmed", context: "Parking Lead · Scheduled Oct 25", tone: "warning", pid: "198854109", planId: "92151843", stId: "1790388" },
    { loc: "SF", name: "AJ Patterson", team: "Kids Theater", badge: "Oct 25 Unconfirmed", context: "Small Group Leader · Scheduled Oct 25", tone: "danger", pid: "167811801", planId: "92096943", stId: "716525" },
    { loc: "SF", name: "Amanda Reynolds", team: "Prayer Team", badge: "Checked In Today ✓", context: "Altar · Scheduled Oct 25 · Checked in at HW", tone: "warning", pid: "81545328", planId: "92294241", stId: "717426" },
    { loc: "SF", name: "Antonio Mclaughlin", team: "Sign Language", badge: "Oct 25 Unconfirmed", context: "ASL · Scheduled Oct 25", tone: "danger", pid: "136594165", planId: "91922141", stId: "717576" },
    { loc: "WP", name: "Abby Ly", team: "Kids Preschool", badge: "Oct 25 Unconfirmed", context: "Yellow Room · Scheduled Oct 25", tone: "warning", pid: "146301631", planId: "92300122", stId: "842221" },
    { loc: "OV", name: "Adam Lawson", team: "Ushers", badge: "Oct 25 Unconfirmed", context: "Usher Team · Scheduled Oct 25", tone: "warning", pid: "81166670", planId: "92237542", stId: "1777530" },
    { loc: "WS", name: "Arya Rivera", team: "Action Kids", badge: "Oct 25 Unconfirmed", context: "Orange Room · Scheduled Oct 25", tone: "warning", pid: "38556548", planId: "92094495", stId: "1725781" },
  ],
  oct18_u: [
    { loc: "HW", name: "Daniel Sierra", team: "Prayer Team", badge: "13 / 13 Sundays U", context: "Left unconfirmed Oct 18 · 0 confirmed since July", tone: "danger", pid: "198853984", planId: "92082971", stId: "1790388" },
    { loc: "HW", name: "Evan Wong", team: "Connect", badge: "Oct 18 Left U", context: "Connect · Left unconfirmed Oct 18", tone: "danger", pid: "136252521", planId: "92082971", stId: "1790388" },
    { loc: "HW", name: "Geniva Welch", team: "Connect", badge: "Oct 18 Left U", context: "Connect · Left unconfirmed Oct 18", tone: "danger", pid: "94710538", planId: "92082971", stId: "1790388" },
    { loc: "HW", name: "Kasey McWilliams", team: "Connect", badge: "Oct 18 Left U", context: "Connect · Left unconfirmed Oct 18", tone: "danger", pid: "44423350", planId: "92082971", stId: "1790388" },
    { loc: "SF", name: "Brandon Simmons", team: "Guest Services", badge: "Oct 18 Left U", context: "Parking · Left unconfirmed Oct 18", tone: "danger", pid: "158666742", planId: "92294193", stId: "717426" },
    { loc: "SF", name: "Douglas Pickard", team: "Guest Services", badge: "Oct 18 Left U", context: "Greeter · Left unconfirmed Oct 18", tone: "danger", pid: "90992916", planId: "92294193", stId: "717426" },
    { loc: "WP", name: "Amy Leider", team: "Admin Team", badge: "Oct 18 Left U", context: "Admin · Left unconfirmed Oct 18", tone: "warning", pid: "160923609", planId: "92297676", stId: "845329" },
    { loc: "OV", name: "JoAnn Chisolm", team: "Admin", badge: "Oct 18 Left U", context: "Admin · Left unconfirmed Oct 18", tone: "warning", pid: "118048851", planId: "92237541", stId: "1777530" },
    { loc: "WS", name: "Gabrielle Frates", team: "ASL", badge: "Oct 18 Left U", context: "Interpreter · Left unconfirmed Oct 18", tone: "warning", pid: "128012671", planId: "92092978", stId: "1695472" },
  ],
  repeat_u: [
    { loc: "HW", name: "David Chiles", team: "Parking", badge: "10 / 10 Sundays U", context: "4 confirmed, 1 declined across 10 Sundays", tone: "danger", pid: "198854109", planId: "92151843", stId: "1790388" },
    { loc: "HW", name: "Justin Wieckhorst", team: "Parking", badge: "10 / 11 Sundays U", context: "0 confirmed, 1 declined across 11 Sundays", tone: "danger", pid: "198853921", planId: "92151843", stId: "1790388" },
    { loc: "HW", name: "Marcus Goss Jr.", team: "Parking", badge: "9 / 10 Sundays U", context: "1 confirmed, 0 declined across 10 Sundays", tone: "danger", pid: "198869242", planId: "92151843", stId: "1790388" },
    { loc: "SF", name: "Antonio Mclaughlin", team: "Sign Language", badge: "13 / 14 Sundays U", context: "1 confirmed, 0 declined across 14 Sundays", tone: "danger", pid: "136594165", planId: "92294241", stId: "717426" },
    { loc: "SF", name: "Jasmine Cruz-Figueroa", team: "Guest Services", badge: "12 / 14 Sundays U", context: "0 confirmed, 8 declined across 14 Sundays", tone: "danger", pid: "142970565", planId: "92294241", stId: "717426" },
    { loc: "SF", name: "Damaris Figueroa", team: "Preschool", badge: "12 / 14 Sundays U", context: "1 confirmed, 1 declined across 14 Sundays", tone: "danger", pid: "137819024", planId: "92096943", stId: "716525" },
    { loc: "WP", name: "Abby Ly", team: "Kids Preschool", badge: "7 / 7 Sundays U", context: "Unconfirmed every Sunday Sep–Oct", tone: "danger", pid: "146301631", planId: "92300122", stId: "842221" },
    { loc: "OV", name: "Alex Cocurull", team: "Ushers", badge: "7 / 7 Sundays U", context: "Unconfirmed every Sunday Sep–Oct", tone: "danger", pid: "113599453", planId: "92237542", stId: "1777530" },
    { loc: "WS", name: "Liza Figueroa", team: "Guest Services", badge: "7 / 7 Sundays U", context: "Unconfirmed every Sunday Sep–Oct", tone: "danger", pid: "145148740", planId: "92207624", stId: "1699519" },
  ],
  declines: [
    { loc: "HW", name: "Vikki Gonzalez", team: "Coach & Connect", badge: "8 / 10 Declined (80%)", context: "Sprained ankle on Amazon missions trip", tone: "danger", pid: "194028775", planId: "92151843", stId: "1790388" },
    { loc: "HW", name: "Suni Gay", team: "Connect", badge: "8 / 8 Declined (100%)", context: "Blocked out Aug–Oct · ready for re-engagement", tone: "warning", pid: "198856192", planId: "92151843", stId: "1790388" },
    { loc: "HW", name: "Mike Gentry", team: "Production", badge: "8 / 15 Declined (53%)", context: "Confirmed 6 times · check scheduling cadence", tone: "warning", pid: "197791055", planId: "92259115", stId: "1792723" },
    { loc: "SF", name: "Ramon Soto", team: "Guest Services", badge: "13 / 13 Declined (100%)", context: "Reason: Working Sundays", tone: "danger", pid: "111014053", planId: "92294241", stId: "717426" },
    { loc: "SF", name: "Cendra Ray", team: "Guest Services", badge: "13 / 14 Declined (93%)", context: "1 confirmed since July · needs pastoral touch", tone: "danger", pid: "133741650", planId: "92294241", stId: "717426" },
    { loc: "SF", name: "Irving Rivera", team: "Guest Services & Vocals", badge: "13 / 19 Declined (68%)", context: "Missions trip in Uganda Oct 5–15", tone: "warning", pid: "29307573", planId: "91922141", stId: "717576" },
    { loc: "WP", name: "Amanda Castillo", team: "Greeters & Preschool", badge: "9 / 12 Declined (75%)", context: "Child sick / out of town", tone: "warning", pid: "132169424", planId: "92300122", stId: "842221" },
    { loc: "OV", name: "Andrew King", team: "Greeters", badge: "7 / 7 Declined (100%)", context: "Attending WP location now · transfer roster", tone: "warning", pid: "144144775", planId: "92237542", stId: "1777530" },
    { loc: "WS", name: "Valeria Sanchez", team: "Action Kids", badge: "10 / 15 Declined (67%)", context: "Asked for a short rest break from Sunday schedule", tone: "warning", pid: "127902510", planId: "92094495", stId: "1725781" },
  ],
  inactive: [
    { loc: "HW", name: "Alejandro Sejnaui", team: "HW Band", badge: "55d Inactive", context: "Last checked in: 2026-08-30", tone: "warning", pid: "197445190", planId: "92259115", stId: "1792723" },
    { loc: "HW", name: "Brenda Greaver", team: "HW Staff Childcare", badge: "55d Inactive", context: "Last checked in: 2026-08-30", tone: "warning", pid: "198853195", planId: "92151843", stId: "1790388" },
    { loc: "HW", name: "Isaias Patete", team: "HW Production", badge: "83d Inactive", context: "Last checked in: 2026-08-02", tone: "danger", pid: "198853714", planId: "92259115", stId: "1792723" },
    { loc: "SF", name: "Chalsie Seymour", team: "SF Guest Services", badge: "55d Inactive", context: "Last checked in: 2026-08-30", tone: "warning", pid: "166856662", planId: "92294241", stId: "717426" },
    { loc: "SF", name: "Mitchell Prevesk", team: "SF Guest Services", badge: "83d Inactive", context: "Last checked in: 2026-08-02", tone: "danger", pid: "56610405", planId: "92294241", stId: "717426" },
    { loc: "WP", name: "Bryce Griffin", team: "WP Kids Preschool", badge: "48d Inactive", context: "Last checked in: 2026-09-06", tone: "warning", pid: "38551563", planId: "92300122", stId: "842221" },
    { loc: "OV", name: "Ange Geremia", team: "OV Preschool", badge: "48d Inactive", context: "Last checked in: 2026-09-06", tone: "warning", pid: "167731107", planId: "92233709", stId: "499291" },
    { loc: "WS", name: "Arya Rivera", team: "WS Action Kids", badge: "48d Inactive", context: "Last checked in: 2026-09-06", tone: "warning", pid: "38556548", planId: "92094495", stId: "1725781" },
  ],
};

type TeamHealthSection = "overview" | "joins" | "inactive" | "confirmations" | "signals";
type InactiveBucketFilter = "all" | "30-59d" | "60-89d" | "90d+";
type ConfPeopleFilter = "u2row" | "oct25_u" | "oct25_d";

interface TeamJoinTeamRow {
  loc: string;
  dept: string;
  team: string;
  count: number;
  people: Array<{ name: string; date: string; pos: string; id: string }>;
}

interface TeamJoinMemberRow {
  loc: string;
  dept: string;
  team: string;
  pos: string;
  id: string;
  name: string;
  firstDate: string;
  addedDate: string;
  status: string;
  served: number;
  planId: string;
}

interface InactiveTeamRow {
  loc: string;
  dept: string;
  team: string;
  total: number;
  active30d: number;
  d30_59: number;
  d60_89: number;
  d90_plus: number;
}

interface InactiveMemberRow {
  id: string;
  name: string;
  loc: string;
  dept: string;
  teams: string;
  bucket: "30-59d" | "60-89d" | "90d+";
  lastServed: string;
  daysAgo: number | null;
  d: number;
  u: number;
}

interface ConfTeamRow {
  loc: string;
  dept: string;
  team: string;
  c: number;
  u: number;
  d: number;
  confRate: number;
  planId: string;
}

interface U2RowMember {
  id: string;
  name: string;
  loc: string;
  dept: string;
  team: string;
  pos: string;
  streak: number;
  u: number;
  c: number;
  d: number;
  chkU: number;
  curr: boolean;
  dates: string;
  pair: string;
  planId: string;
}

interface Oct25UMember {
  id: string;
  name: string;
  loc: string;
  dept: string;
  team: string;
  pos: string;
  uHist: number;
  dHist: number;
  cHist: number;
  planId: string;
}

interface Oct25DMember {
  id: string;
  name: string;
  loc: string;
  dept: string;
  team: string;
  pos: string;
  reason: string;
  updatedAt: string;
  dHist: number;
  cHist: number;
  planId: string;
}

interface BurnoutMember {
  id: string;
  name: string;
  loc: string;
  dept: string;
  roles: string;
  qtd: number;
  last4: number;
  oct25: number;
  tag: string;
  planId: string;
}

interface LateDeclineItem {
  id: string;
  name: string;
  loc: string;
  dept: string;
  team: string;
  pos: string;
  planDate: string;
  declinedAt: string;
  daysBefore: number;
  reason: string;
  planId: string;
}

const TEAM_LOC_ORDER: Array<Exclude<LocCode, "ALL">> = ["HW", "SF", "WP", "OV", "WS"];

const TEAM_ONBOARD_BY_LOC: Record<LocCode, { open: number; overdue: number; stale14d: number; done7d: number }> = {
  ALL: { open: 394, overdue: 118, stale14d: 239, done7d: 67 },
  HW: { open: 56, overdue: 26, stale14d: 15, done7d: 11 },
  SF: { open: 36, overdue: 9, stale14d: 18, done7d: 2 },
  WP: { open: 233, overdue: 78, stale14d: 162, done7d: 42 },
  OV: { open: 35, overdue: 4, stale14d: 15, done7d: 10 },
  WS: { open: 34, overdue: 1, stale14d: 29, done7d: 2 },
};

const TEAM_ONBOARD_WORKFLOWS: Array<{ id: string; loc: Exclude<LocCode, "ALL">; name: string; open: number; overdue: number }> = [
  { id: "749245", loc: "HW", name: "Events Team On-Board Process - HW", open: 15, overdue: 10 },
  { id: "749340", loc: "HW", name: "Prayer Team On-Board Process - HW", open: 8, overdue: 8 },
  { id: "749328", loc: "HW", name: "Outreach Team On-Board Process - HW", open: 7, overdue: 7 },
  { id: "749245", loc: "HW", name: "Photography Team On-Board Process - HW", open: 3, overdue: 1 },
  { id: "98876", loc: "SF", name: "Guest Services Team On-Board Process - SF", open: 16, overdue: 4 },
  { id: "98876", loc: "SF", name: "Events Team On-Board Process - SF", open: 8, overdue: 4 },
  { id: "98876", loc: "SF", name: "Production Team On-Board Process - SF", open: 6, overdue: 1 },
  { id: "74083", loc: "WP", name: "Guest Services Team On-Board Process - WP", open: 49, overdue: 25 },
  { id: "74083", loc: "WP", name: "Events Team On-Board Process - WP", open: 39, overdue: 23 },
  { id: "74083", loc: "WP", name: "Action Students Team On-Board Process - WP", open: 36, overdue: 13 },
  { id: "74083", loc: "WP", name: "Prayer Team On-Board Process - WP", open: 11, overdue: 10 },
  { id: "74083", loc: "WP", name: "Action Kids Team On-Board Process - WP", open: 36, overdue: 7 },
  { id: "275203", loc: "OV", name: "Guest Services Team On-Board Process - OV", open: 6, overdue: 1 },
  { id: "275203", loc: "OV", name: "Events Team On-Board Process - OV", open: 3, overdue: 1 },
  { id: "275203", loc: "OV", name: "Prayer Team On-Board Process - OV", open: 2, overdue: 2 },
  { id: "780689", loc: "WS", name: "Guest Services Team On-Boarding - WS", open: 5, overdue: 1 },
];


type THJoinsHorizon = { byLoc: Record<LocCode, { total: number; unique: number; teamsCount: number; teams: TeamJoinTeamRow[] }>; members: TeamJoinMemberRow[] };
const TH_JOINS_W: THJoinsHorizon = {"byLoc": {"ALL": {"total": 42, "unique": 38, "teamsCount": 22, "teams": []}, "HW": {"total": 12, "unique": 11, "teamsCount": 7, "teams": [{"loc": "HW", "dept": "Guest Services", "team": "Prayer", "count": 3, "people": [{"name": "Amanda Reynolds", "date": "10-25", "pos": "Prayer", "id": "81545328"}, {"name": "Caleb Calderon", "date": "10-25", "pos": "Prayer", "id": "195829308"}, {"name": "Emilio Lopez", "date": "10-25", "pos": "Prayer", "id": "198855181"}]}, {"loc": "HW", "dept": "Guest Services", "team": "Connect", "count": 2, "people": [{"name": "Iris Grant", "date": "10-25", "pos": "Connect Lead", "id": "194028940"}, {"name": "Evan Wong", "date": "10-18", "pos": "Connect", "id": "136252521"}]}, {"loc": "HW", "dept": "Weekend Service", "team": "Photo/Video", "count": 2, "people": [{"name": "Genaea Pettit", "date": "10-18", "pos": "Photographer", "id": "201820716"}, {"name": "Nolan Pettit", "date": "10-18", "pos": "Photographer", "id": "201821156"}]}, {"loc": "HW", "dept": "Weekend Service", "team": "Production", "count": 2, "people": [{"name": "Aleisha McKeeby", "date": "10-25", "pos": "Training", "id": "48862021"}, {"name": "Isabella Salazar-Cab\u00e1n", "date": "10-18", "pos": "Lighting Operator", "id": "198692784"}]}, {"loc": "HW", "dept": "Guest Services", "team": "Coach", "count": 1, "people": [{"name": "Iris Grant", "date": "10-25", "pos": "Coach", "id": "194028940"}]}, {"loc": "HW", "dept": "Guest Services", "team": "Greeters", "count": 1, "people": [{"name": "Steffon Rush", "date": "10-18", "pos": "Greeter", "id": "78757640"}]}, {"loc": "HW", "dept": "Action Kids", "team": "Kids Check-In", "count": 1, "people": [{"name": "Joshua Richardson", "date": "10-18", "pos": "Safety", "id": "198869223"}]}]}, "SF": {"total": 3, "unique": 3, "teamsCount": 2, "teams": [{"loc": "SF", "dept": "Guest Services", "team": "Guest Services", "count": 2, "people": [{"name": "Iris Grant", "date": "10-18", "pos": "Connect Team*", "id": "194028940"}, {"name": "Wilson McEachern", "date": "10-18", "pos": "Safety*", "id": "94414614"}]}, {"loc": "SF", "dept": "Action Kids", "team": "Pre-School", "count": 1, "people": [{"name": "Ashalei St. Amant", "date": "10-18", "pos": "Blue Room (Nursery)", "id": "179064791"}]}]}, "WP": {"total": 20, "unique": 20, "teamsCount": 8, "teams": [{"loc": "WP", "dept": "Guest Services", "team": "Parking Team", "count": 6, "people": [{"name": "Carlos Trott", "date": "10-25", "pos": "Parking Team", "id": "191853749"}, {"name": "Elijah Althof", "date": "10-25", "pos": "Parking Team", "id": "97685477"}, {"name": "Elijah Springfield", "date": "10-25", "pos": "Parking Team", "id": "38615372"}, {"name": "Joseph LoPiparo", "date": "10-25", "pos": "Parking Team", "id": "109751109"}]}, {"loc": "WP", "dept": "Guest Services", "team": "Greeter Team", "count": 4, "people": [{"name": "Alexis Springfield", "date": "10-25", "pos": "Greeter Team", "id": "38615136"}, {"name": "Willy Maldonado", "date": "10-25", "pos": "Greeter Team", "id": "51911081"}, {"name": "Evelyn Lopez", "date": "10-18", "pos": "Greeter Team", "id": "129715652"}, {"name": "Vanessa Davila", "date": "10-18", "pos": "Greeter Team", "id": "79131587"}]}, {"loc": "WP", "dept": "Action Kids", "team": "Kids Preschool", "count": 3, "people": [{"name": "Grayson Mellick", "date": "10-25", "pos": "Shadow", "id": "143522788"}, {"name": "Sandy George", "date": "10-25", "pos": "Purple Room", "id": "145252523"}, {"name": "Madisyn Cheek", "date": "10-18", "pos": "Yellow Room", "id": "197729612"}]}, {"loc": "WP", "dept": "Guest Services", "team": "Connect Team", "count": 2, "people": [{"name": "Kitty Handelsman", "date": "10-25", "pos": "Connect Team", "id": "201714853"}, {"name": "Keyla Gonzalez", "date": "10-18", "pos": "Connect Team", "id": "83695663"}]}, {"loc": "WP", "dept": "Weekend Service", "team": "Production/Video Orientation Attendee", "count": 2, "people": [{"name": "Carlos Arango", "date": "10-25", "pos": "Orientation Attendee", "id": "191416090"}, {"name": "Chris Carravallah", "date": "10-25", "pos": "Orientation Attendee", "id": "171793079"}]}, {"loc": "WP", "dept": "Action Kids", "team": "Kids Theater", "count": 1, "people": [{"name": "Graham Varkey", "date": "10-25", "pos": "Small Group Leader", "id": "70953710"}]}, {"loc": "WP", "dept": "Weekend Service", "team": "Production", "count": 1, "people": [{"name": "Trinity Feikert", "date": "10-25", "pos": "Service Coordinator - Shadow", "id": "97799687"}]}, {"loc": "WP", "dept": "Guest Services", "team": "Safety Team", "count": 1, "people": [{"name": "Angel Valentin-Lopez", "date": "10-18", "pos": "Safety Team", "id": "167652969"}]}]}, "OV": {"total": 2, "unique": 2, "teamsCount": 2, "teams": [{"loc": "OV", "dept": "Action Kids", "team": "Preschool", "count": 1, "people": [{"name": "Lori Moon", "date": "10-25", "pos": "Blue Room", "id": "9617280"}]}, {"loc": "OV", "dept": "Weekend Service", "team": "Vocals", "count": 1, "people": [{"name": "Joe Mercado", "date": "10-25", "pos": "Co-Worship Leader", "id": "38554468"}]}]}, "WS": {"total": 5, "unique": 4, "teamsCount": 3, "teams": [{"loc": "WS", "dept": "Action Kids", "team": "Action Kids", "count": 2, "people": [{"name": "Kira Gold", "date": "10-18", "pos": "Blue Room", "id": "38551345"}, {"name": "Trish Gold", "date": "10-18", "pos": "Orange Room", "id": "38551346"}]}, {"loc": "WS", "dept": "Weekend Service", "team": "Band", "count": 2, "people": [{"name": "Hassan Sylvain", "date": "10-25", "pos": "Shadow", "id": "165026267"}, {"name": "Caleb Calderon", "date": "10-18", "pos": "Acoustic Guitar", "id": "195829308"}]}, {"loc": "WS", "dept": "Weekend Service", "team": "Worship", "count": 1, "people": [{"name": "Caleb Calderon", "date": "10-18", "pos": "Vocals", "id": "195829308"}]}]}}, "members": [{"loc": "HW", "dept": "Guest Services", "team": "Coach", "pos": "Coach", "id": "194028940", "name": "Iris Grant", "firstDate": "2026-10-25", "addedDate": "2026-10-21", "status": "C", "served": 0, "planId": "92151843"}, {"loc": "HW", "dept": "Guest Services", "team": "Connect", "pos": "Connect Lead", "id": "194028940", "name": "Iris Grant", "firstDate": "2026-10-25", "addedDate": "2026-10-21", "status": "C", "served": 0, "planId": "92151843"}, {"loc": "HW", "dept": "Guest Services", "team": "Prayer", "pos": "Prayer", "id": "81545328", "name": "Amanda Reynolds", "firstDate": "2026-10-25", "addedDate": "2026-10-07", "status": "C", "served": 1, "planId": "92151843"}, {"loc": "HW", "dept": "Guest Services", "team": "Prayer", "pos": "Prayer", "id": "195829308", "name": "Caleb Calderon", "firstDate": "2026-10-25", "addedDate": "2026-10-09", "status": "C", "served": 0, "planId": "92082626"}, {"loc": "HW", "dept": "Guest Services", "team": "Prayer", "pos": "Prayer", "id": "198855181", "name": "Emilio Lopez", "firstDate": "2026-10-25", "addedDate": "2026-10-09", "status": "C", "served": 0, "planId": "92082626"}, {"loc": "HW", "dept": "Weekend Service", "team": "Production", "pos": "Training", "id": "48862021", "name": "Aleisha McKeeby", "firstDate": "2026-10-25", "addedDate": "2026-10-20", "status": "C", "served": 0, "planId": "92259115"}, {"loc": "HW", "dept": "Guest Services", "team": "Connect", "pos": "Connect", "id": "136252521", "name": "Evan Wong", "firstDate": "2026-10-18", "addedDate": "2026-10-13", "status": "U", "served": 0, "planId": "92082971"}, {"loc": "HW", "dept": "Guest Services", "team": "Greeters", "pos": "Greeter", "id": "78757640", "name": "Steffon Rush", "firstDate": "2026-10-18", "addedDate": "2026-10-12", "status": "D", "served": 0, "planId": "92151843"}, {"loc": "HW", "dept": "Action Kids", "team": "Kids Check-In", "pos": "Safety", "id": "198869223", "name": "Joshua Richardson", "firstDate": "2026-10-18", "addedDate": "2026-10-12", "status": "U", "served": 0, "planId": "92145115"}, {"loc": "HW", "dept": "Weekend Service", "team": "Photo/Video", "pos": "Photographer", "id": "201820716", "name": "Genaea Pettit", "firstDate": "2026-10-18", "addedDate": "2026-10-12", "status": "U", "served": 1, "planId": "92259108"}, {"loc": "SF", "dept": "Guest Services", "team": "Guest Services", "pos": "Connect Team*", "id": "194028940", "name": "Iris Grant", "firstDate": "2026-10-18", "addedDate": "2026-10-09", "status": "D", "served": 0, "planId": "92294193"}, {"loc": "SF", "dept": "Guest Services", "team": "Guest Services", "pos": "Safety*", "id": "94414614", "name": "Wilson McEachern", "firstDate": "2026-10-18", "addedDate": "2026-10-18", "status": "C", "served": 1, "planId": "92294193"}, {"loc": "SF", "dept": "Action Kids", "team": "Pre-School", "pos": "Blue Room (Nursery)", "id": "179064791", "name": "Ashalei St. Amant", "firstDate": "2026-10-18", "addedDate": "2026-10-15", "status": "C", "served": 2, "planId": "92096943"}, {"loc": "WP", "dept": "Guest Services", "team": "Connect Team", "pos": "Connect Team", "id": "201714853", "name": "Kitty Handelsman", "firstDate": "2026-10-25", "addedDate": "2026-10-24", "status": "U", "served": 1, "planId": "92297705"}, {"loc": "WP", "dept": "Guest Services", "team": "Greeter Team", "pos": "Greeter Team", "id": "38615136", "name": "Alexis Springfield", "firstDate": "2026-10-25", "addedDate": "2026-10-20", "status": "C", "served": 1, "planId": "92297705"}, {"loc": "WP", "dept": "Guest Services", "team": "Greeter Team", "pos": "Greeter Team", "id": "51911081", "name": "Willy Maldonado", "firstDate": "2026-10-25", "addedDate": "2026-10-21", "status": "U", "served": 0, "planId": "92297705"}, {"loc": "WP", "dept": "Action Kids", "team": "Kids Preschool", "pos": "Shadow", "id": "143522788", "name": "Grayson Mellick", "firstDate": "2026-10-25", "addedDate": "2026-10-10", "status": "C", "served": 1, "planId": "92300122"}, {"loc": "WP", "dept": "Action Kids", "team": "Kids Preschool", "pos": "Purple Room", "id": "145252523", "name": "Sandy George", "firstDate": "2026-10-25", "addedDate": "2026-10-14", "status": "C", "served": 1, "planId": "92300122"}, {"loc": "WP", "dept": "Action Kids", "team": "Kids Theater", "pos": "Small Group Leader", "id": "70953710", "name": "Graham Varkey", "firstDate": "2026-10-25", "addedDate": "2026-10-14", "status": "C", "served": 1, "planId": "92300122"}, {"loc": "WP", "dept": "Guest Services", "team": "Parking Team", "pos": "Parking Team", "id": "191853749", "name": "Carlos Trott", "firstDate": "2026-10-25", "addedDate": "2026-10-21", "status": "C", "served": 0, "planId": "92297705"}, {"loc": "WP", "dept": "Guest Services", "team": "Parking Team", "pos": "Parking Team", "id": "97685477", "name": "Elijah Althof", "firstDate": "2026-10-25", "addedDate": "2026-10-25", "status": "U", "served": 0, "planId": "92297705"}, {"loc": "WP", "dept": "Guest Services", "team": "Parking Team", "pos": "Parking Team", "id": "38615372", "name": "Elijah Springfield", "firstDate": "2026-10-25", "addedDate": "2026-10-24", "status": "U", "served": 1, "planId": "92297705"}, {"loc": "WP", "dept": "Guest Services", "team": "Parking Team", "pos": "Parking Team", "id": "109751109", "name": "Joseph LoPiparo", "firstDate": "2026-10-25", "addedDate": "2026-10-21", "status": "U", "served": 0, "planId": "92297705"}, {"loc": "OV", "dept": "Action Kids", "team": "Preschool", "pos": "Blue Room", "id": "9617280", "name": "Lori Moon", "firstDate": "2026-10-25", "addedDate": "2026-10-22", "status": "C", "served": 1, "planId": "92233709"}, {"loc": "OV", "dept": "Weekend Service", "team": "Vocals", "pos": "Co-Worship Leader", "id": "38554468", "name": "Joe Mercado", "firstDate": "2026-10-25", "addedDate": "2026-10-25", "status": "C", "served": 1, "planId": "92148271"}, {"loc": "WS", "dept": "Weekend Service", "team": "Band", "pos": "Shadow", "id": "165026267", "name": "Hassan Sylvain", "firstDate": "2026-10-25", "addedDate": "2026-10-19", "status": "C", "served": 0, "planId": "92092980"}, {"loc": "WS", "dept": "Action Kids", "team": "Action Kids", "pos": "Blue Room", "id": "38551345", "name": "Kira Gold", "firstDate": "2026-10-18", "addedDate": "2026-10-16", "status": "U", "served": 1, "planId": "92094494"}, {"loc": "WS", "dept": "Action Kids", "team": "Action Kids", "pos": "Orange Room", "id": "38551346", "name": "Trish Gold", "firstDate": "2026-10-18", "addedDate": "2026-10-16", "status": "U", "served": 1, "planId": "92094494"}, {"loc": "WS", "dept": "Weekend Service", "team": "Band", "pos": "Acoustic Guitar", "id": "195829308", "name": "Caleb Calderon", "firstDate": "2026-10-18", "addedDate": "2026-10-13", "status": "C", "served": 0, "planId": "92092978"}, {"loc": "WS", "dept": "Weekend Service", "team": "Worship", "pos": "Vocals", "id": "195829308", "name": "Caleb Calderon", "firstDate": "2026-10-18", "addedDate": "2026-10-13", "status": "C", "served": 0, "planId": "92092978"}]};

const TH_JOINS_M: THJoinsHorizon = {"byLoc": {"ALL": {"total": 100, "unique": 88, "teamsCount": 39, "teams": []}, "HW": {"total": 40, "unique": 37, "teamsCount": 15, "teams": [{"loc": "HW", "dept": "Guest Services", "team": "Prayer", "count": 8, "people": [{"name": "Amanda Reynolds", "date": "10-25", "pos": "Prayer", "id": "81545328"}, {"name": "Caleb Calderon", "date": "10-25", "pos": "Prayer", "id": "195829308"}, {"name": "Emilio Lopez", "date": "10-25", "pos": "Prayer", "id": "198855181"}, {"name": "Ivy Fernandez", "date": "10-11", "pos": "Prayer", "id": "70067024"}]}, {"loc": "HW", "dept": "Guest Services", "team": "Connect", "count": 7, "people": [{"name": "Iris Grant", "date": "10-25", "pos": "Connect Lead", "id": "194028940"}, {"name": "Evan Wong", "date": "10-18", "pos": "Connect", "id": "136252521"}, {"name": "James Brown", "date": "10-11", "pos": "Connect Lead", "id": "198853210"}, {"name": "Kara Saghir", "date": "10-11", "pos": "Connect", "id": "198823297"}]}, {"loc": "HW", "dept": "Weekend Service", "team": "Production", "count": 4, "people": [{"name": "Aleisha McKeeby", "date": "10-25", "pos": "Training", "id": "48862021"}, {"name": "Isabella Salazar-Cab\u00e1n", "date": "10-18", "pos": "Lighting Operator", "id": "198692784"}, {"name": "Ricardo Ortolaza Perez", "date": "10-18", "pos": "Training", "id": "149077646"}, {"name": "Taylor Martin", "date": "10-11", "pos": "Graphics Operator", "id": "198853979"}]}, {"loc": "HW", "dept": "Guest Services", "team": "Greeters", "count": 3, "people": [{"name": "Shelby Freese", "date": "10-18", "pos": "Greeter", "id": "198869281"}, {"name": "Steffon Rush", "date": "10-18", "pos": "Greeter", "id": "78757640"}, {"name": "Rosa Hidalgo", "date": "10-04", "pos": "Greeter", "id": "162901974"}]}, {"loc": "HW", "dept": "Guest Services", "team": "Ushers", "count": 3, "people": [{"name": "Sadrack Serelus", "date": "10-25", "pos": "Usher", "id": "198857384"}, {"name": "Steve Bonneau", "date": "10-11", "pos": "Usher", "id": "153958702"}, {"name": "Ashley Brown", "date": "10-04", "pos": "Usher", "id": "195834070"}]}, {"loc": "HW", "dept": "Weekend Service", "team": "Vocals", "count": 3, "people": [{"name": "Alondra Leon", "date": "10-11", "pos": "Mic 7", "id": "134142311"}, {"name": "Brock Moreau", "date": "10-11", "pos": "Mic 2", "id": "7304978"}, {"name": "Alanis Salazar", "date": "10-04", "pos": "Mic 7", "id": "198326456"}]}, {"loc": "HW", "dept": "Action Kids", "team": "Kids Check-In", "count": 2, "people": [{"name": "Joshua Richardson", "date": "10-18", "pos": "Safety", "id": "198869223"}, {"name": "Ashley Ott", "date": "10-11", "pos": "Check-In", "id": "165794361"}]}, {"loc": "HW", "dept": "Action Kids", "team": "Kids Preschool", "count": 2, "people": [{"name": "Meagan Fowler", "date": "10-11", "pos": "Red Room Leader", "id": "198867732"}, {"name": "Lilly Billingsley", "date": "10-04", "pos": "Orange Room Leader", "id": "111846785"}]}, {"loc": "HW", "dept": "Weekend Service", "team": "Photo/Video", "count": 2, "people": [{"name": "Genaea Pettit", "date": "10-18", "pos": "Photographer", "id": "201820716"}, {"name": "Nolan Pettit", "date": "10-18", "pos": "Photographer", "id": "201821156"}]}, {"loc": "HW", "dept": "Weekend Service", "team": "Band", "count": 1, "people": [{"name": "Brock Moreau", "date": "10-11", "pos": "Acoustic Guitar", "id": "7304978"}]}, {"loc": "HW", "dept": "Guest Services", "team": "Coach", "count": 1, "people": [{"name": "Iris Grant", "date": "10-25", "pos": "Coach", "id": "194028940"}]}, {"loc": "HW", "dept": "Guest Services", "team": "Hospitality", "count": 1, "people": [{"name": "Brad Ingria", "date": "10-11", "pos": "Hospitality", "id": "80449236"}]}]}, "SF": {"total": 10, "unique": 9, "teamsCount": 3, "teams": [{"loc": "SF", "dept": "Guest Services", "team": "Guest Services", "count": 7, "people": [{"name": "Iris Grant", "date": "10-18", "pos": "Connect Team*", "id": "194028940"}, {"name": "Wilson McEachern", "date": "10-18", "pos": "Safety*", "id": "94414614"}, {"name": "Brayden Stotler", "date": "10-11", "pos": "Greeter*", "id": "203431121"}, {"name": "David Rouse", "date": "10-11", "pos": "Parking*", "id": "203430324"}]}, {"loc": "SF", "dept": "Action Kids", "team": "Pre-School", "count": 2, "people": [{"name": "Ashalei St. Amant", "date": "10-18", "pos": "Blue Room (Nursery)", "id": "179064791"}, {"name": "Maria Francisco", "date": "10-11", "pos": "Red Room", "id": "157850990"}]}, {"loc": "SF", "dept": "Guest Services", "team": "Prayer Team", "count": 1, "people": [{"name": "Claudia Bucaro", "date": "10-18", "pos": "Altar", "id": "31603266"}]}]}, "WP": {"total": 39, "unique": 34, "teamsCount": 13, "teams": [{"loc": "WP", "dept": "Guest Services", "team": "Greeter Team", "count": 8, "people": [{"name": "Alexis Springfield", "date": "10-25", "pos": "Greeter Team", "id": "38615136"}, {"name": "Willy Maldonado", "date": "10-25", "pos": "Greeter Team", "id": "51911081"}, {"name": "AJ Varn", "date": "10-18", "pos": "Greeter Team", "id": "58816843"}, {"name": "Darcey Varn", "date": "10-18", "pos": "Greeter Team", "id": "58816841"}]}, {"loc": "WP", "dept": "Guest Services", "team": "Parking Team", "count": 6, "people": [{"name": "Carlos Trott", "date": "10-25", "pos": "Parking Team", "id": "191853749"}, {"name": "Elijah Althof", "date": "10-25", "pos": "Parking Team", "id": "97685477"}, {"name": "Elijah Springfield", "date": "10-25", "pos": "Parking Team", "id": "38615372"}, {"name": "Joseph LoPiparo", "date": "10-25", "pos": "Parking Team", "id": "109751109"}]}, {"loc": "WP", "dept": "Action Kids", "team": "Kids Preschool", "count": 5, "people": [{"name": "Grayson Mellick", "date": "10-25", "pos": "Shadow", "id": "143522788"}, {"name": "Sandy George", "date": "10-25", "pos": "Purple Room", "id": "145252523"}, {"name": "Madisyn Cheek", "date": "10-18", "pos": "Yellow Room", "id": "197729612"}, {"name": "Hudson Wiley", "date": "10-04", "pos": "Yellow Room", "id": "38559427"}]}, {"loc": "WP", "dept": "Guest Services", "team": "Connect Team", "count": 4, "people": [{"name": "Kitty Handelsman", "date": "10-25", "pos": "Connect Team", "id": "201714853"}, {"name": "Trevor Hussak", "date": "10-25", "pos": "Golf Carts", "id": "98184295"}, {"name": "Keyla Gonzalez", "date": "10-18", "pos": "Connect Team", "id": "83695663"}, {"name": "Victoria Turner", "date": "10-04", "pos": "Connect Team", "id": "33845810"}]}, {"loc": "WP", "dept": "Weekend Service", "team": "Mic Assignments", "count": 3, "people": [{"name": "Caitee Young", "date": "10-11", "pos": "Mic 3", "id": "91348314"}, {"name": "Kimberly Alvarez-Cabais", "date": "10-11", "pos": "Mic 4", "id": "153327219"}, {"name": "Miranda Quigley", "date": "10-11", "pos": "Mic 7", "id": "195518897"}]}, {"loc": "WP", "dept": "Weekend Service", "team": "Vocals", "count": 3, "people": [{"name": "Caitee Young", "date": "10-11", "pos": "Vocalist", "id": "91348314"}, {"name": "Kimberly Alvarez-Cabais", "date": "10-11", "pos": "Vocalist", "id": "153327219"}, {"name": "Miranda Quigley", "date": "10-11", "pos": "Co-Worship Leader", "id": "195518897"}]}, {"loc": "WP", "dept": "Weekend Service", "team": "Choir-WP", "count": 2, "people": [{"name": "Adriana Marin", "date": "10-11", "pos": "Choir-Shadow", "id": "90557540"}, {"name": "Lori Robb", "date": "10-11", "pos": "Choir-Shadow", "id": "97615928"}]}, {"loc": "WP", "dept": "Weekend Service", "team": "Production/Video Orientation Attendee", "count": 2, "people": [{"name": "Carlos Arango", "date": "10-25", "pos": "Orientation Attendee", "id": "191416090"}, {"name": "Chris Carravallah", "date": "10-25", "pos": "Orientation Attendee", "id": "171793079"}]}, {"loc": "WP", "dept": "Guest Services", "team": "Usher Team", "count": 2, "people": [{"name": "AJ Varn", "date": "10-18", "pos": "Usher", "id": "58816843"}, {"name": "Darcey Varn", "date": "10-18", "pos": "Usher", "id": "58816841"}]}, {"loc": "WP", "dept": "Weekend Service", "team": "Band", "count": 1, "people": [{"name": "Gabe Gomez", "date": "10-25", "pos": "Bass Guitar", "id": "39588378"}]}, {"loc": "WP", "dept": "Action Kids", "team": "Kids Theater", "count": 1, "people": [{"name": "Graham Varkey", "date": "10-25", "pos": "Small Group Leader", "id": "70953710"}]}, {"loc": "WP", "dept": "Weekend Service", "team": "Production", "count": 1, "people": [{"name": "Trinity Feikert", "date": "10-25", "pos": "Service Coordinator - Shadow", "id": "97799687"}]}]}, "OV": {"total": 5, "unique": 5, "teamsCount": 5, "teams": [{"loc": "OV", "dept": "Guest Services", "team": "Greeters", "count": 1, "people": [{"name": "Alba Alonso", "date": "10-11", "pos": "Greeter Team", "id": "72131952"}]}, {"loc": "OV", "dept": "Action Kids", "team": "Preschool", "count": 1, "people": [{"name": "Lori Moon", "date": "10-25", "pos": "Blue Room", "id": "9617280"}]}, {"loc": "OV", "dept": "Weekend Service", "team": "Production", "count": 1, "people": [{"name": "Kennedy Peters", "date": "10-04", "pos": "Service Coordinator", "id": "203135734"}]}, {"loc": "OV", "dept": "Action Kids", "team": "Theater", "count": 1, "people": [{"name": "David Welday", "date": "10-04", "pos": "Room Leader", "id": "38559271"}]}, {"loc": "OV", "dept": "Weekend Service", "team": "Vocals", "count": 1, "people": [{"name": "Joe Mercado", "date": "10-25", "pos": "Co-Worship Leader", "id": "38554468"}]}]}, "WS": {"total": 6, "unique": 5, "teamsCount": 3, "teams": [{"loc": "WS", "dept": "Action Kids", "team": "Action Kids", "count": 2, "people": [{"name": "Kira Gold", "date": "10-18", "pos": "Blue Room", "id": "38551345"}, {"name": "Trish Gold", "date": "10-18", "pos": "Orange Room", "id": "38551346"}]}, {"loc": "WS", "dept": "Weekend Service", "team": "Band", "count": 2, "people": [{"name": "Hassan Sylvain", "date": "10-25", "pos": "Shadow", "id": "165026267"}, {"name": "Caleb Calderon", "date": "10-18", "pos": "Acoustic Guitar", "id": "195829308"}]}, {"loc": "WS", "dept": "Weekend Service", "team": "Worship", "count": 2, "people": [{"name": "Caleb Calderon", "date": "10-18", "pos": "Vocals", "id": "195829308"}, {"name": "Michael Reinhardt", "date": "10-11", "pos": "Worship Team Lead", "id": "158751975"}]}]}}, "members": [{"loc": "HW", "dept": "Guest Services", "team": "Coach", "pos": "Coach", "id": "194028940", "name": "Iris Grant", "firstDate": "2026-10-25", "addedDate": "2026-10-21", "status": "C", "served": 0, "planId": "92151843"}, {"loc": "HW", "dept": "Guest Services", "team": "Connect", "pos": "Connect Lead", "id": "194028940", "name": "Iris Grant", "firstDate": "2026-10-25", "addedDate": "2026-10-21", "status": "C", "served": 0, "planId": "92151843"}, {"loc": "HW", "dept": "Guest Services", "team": "Prayer", "pos": "Prayer", "id": "81545328", "name": "Amanda Reynolds", "firstDate": "2026-10-25", "addedDate": "2026-10-07", "status": "C", "served": 1, "planId": "92151843"}, {"loc": "HW", "dept": "Guest Services", "team": "Prayer", "pos": "Prayer", "id": "195829308", "name": "Caleb Calderon", "firstDate": "2026-10-25", "addedDate": "2026-10-09", "status": "C", "served": 0, "planId": "92082626"}, {"loc": "HW", "dept": "Guest Services", "team": "Prayer", "pos": "Prayer", "id": "198855181", "name": "Emilio Lopez", "firstDate": "2026-10-25", "addedDate": "2026-10-09", "status": "C", "served": 0, "planId": "92082626"}, {"loc": "HW", "dept": "Weekend Service", "team": "Production", "pos": "Training", "id": "48862021", "name": "Aleisha McKeeby", "firstDate": "2026-10-25", "addedDate": "2026-10-20", "status": "C", "served": 0, "planId": "92259115"}, {"loc": "HW", "dept": "Guest Services", "team": "Ushers", "pos": "Usher", "id": "198857384", "name": "Sadrack Serelus", "firstDate": "2026-10-25", "addedDate": "2026-10-05", "status": "C", "served": 1, "planId": "92151843"}, {"loc": "HW", "dept": "Guest Services", "team": "Connect", "pos": "Connect", "id": "136252521", "name": "Evan Wong", "firstDate": "2026-10-18", "addedDate": "2026-10-13", "status": "U", "served": 0, "planId": "92082971"}, {"loc": "HW", "dept": "Guest Services", "team": "Greeters", "pos": "Greeter", "id": "198869281", "name": "Shelby Freese", "firstDate": "2026-10-18", "addedDate": "2026-09-21", "status": "C", "served": 2, "planId": "92151843"}, {"loc": "HW", "dept": "Guest Services", "team": "Greeters", "pos": "Greeter", "id": "78757640", "name": "Steffon Rush", "firstDate": "2026-10-18", "addedDate": "2026-10-12", "status": "D", "served": 0, "planId": "92151843"}, {"loc": "SF", "dept": "Guest Services", "team": "Guest Services", "pos": "Connect Team*", "id": "194028940", "name": "Iris Grant", "firstDate": "2026-10-18", "addedDate": "2026-10-09", "status": "D", "served": 0, "planId": "92294193"}, {"loc": "SF", "dept": "Guest Services", "team": "Guest Services", "pos": "Safety*", "id": "94414614", "name": "Wilson McEachern", "firstDate": "2026-10-18", "addedDate": "2026-10-18", "status": "C", "served": 1, "planId": "92294193"}, {"loc": "SF", "dept": "Guest Services", "team": "Prayer Team", "pos": "Altar", "id": "31603266", "name": "Claudia Bucaro", "firstDate": "2026-10-18", "addedDate": "2026-09-30", "status": "C", "served": 0, "planId": "92294193"}, {"loc": "SF", "dept": "Action Kids", "team": "Pre-School", "pos": "Blue Room (Nursery)", "id": "179064791", "name": "Ashalei St. Amant", "firstDate": "2026-10-18", "addedDate": "2026-10-15", "status": "C", "served": 2, "planId": "92096943"}, {"loc": "SF", "dept": "Guest Services", "team": "Guest Services", "pos": "Greeter*", "id": "203431121", "name": "Brayden Stotler", "firstDate": "2026-10-11", "addedDate": "2026-10-11", "status": "C", "served": 0, "planId": "92294176"}, {"loc": "SF", "dept": "Guest Services", "team": "Guest Services", "pos": "Parking*", "id": "203430324", "name": "David Rouse", "firstDate": "2026-10-11", "addedDate": "2026-10-11", "status": "C", "served": 0, "planId": "92294176"}, {"loc": "SF", "dept": "Action Kids", "team": "Pre-School", "pos": "Red Room", "id": "157850990", "name": "Maria Francisco", "firstDate": "2026-10-11", "addedDate": "2026-10-05", "status": "C", "served": 0, "planId": "92096941"}, {"loc": "SF", "dept": "Guest Services", "team": "Guest Services", "pos": "Coach", "id": "31603266", "name": "Claudia Bucaro", "firstDate": "2026-10-04", "addedDate": "2026-10-04", "status": "C", "served": 0, "planId": "92294156"}, {"loc": "SF", "dept": "Guest Services", "team": "Guest Services", "pos": "Connect Team*", "id": "167760249", "name": "Maria Truong", "firstDate": "2026-10-04", "addedDate": "2026-10-04", "status": "C", "served": 2, "planId": "92294176"}, {"loc": "SF", "dept": "Guest Services", "team": "Guest Services", "pos": "Set Up*", "id": "38549074", "name": "William Centeno", "firstDate": "2026-10-04", "addedDate": "2026-09-26", "status": "U", "served": 1, "planId": "92294193"}, {"loc": "WP", "dept": "Weekend Service", "team": "Band", "pos": "Bass Guitar", "id": "39588378", "name": "Gabe Gomez", "firstDate": "2026-10-25", "addedDate": "2026-09-29", "status": "C", "served": 0, "planId": "91481065"}, {"loc": "WP", "dept": "Guest Services", "team": "Connect Team", "pos": "Connect Team", "id": "201714853", "name": "Kitty Handelsman", "firstDate": "2026-10-25", "addedDate": "2026-10-24", "status": "U", "served": 1, "planId": "92297705"}, {"loc": "WP", "dept": "Guest Services", "team": "Connect Team", "pos": "Golf Carts", "id": "98184295", "name": "Trevor Hussak", "firstDate": "2026-10-25", "addedDate": "2026-09-26", "status": "C", "served": 1, "planId": "92297705"}, {"loc": "WP", "dept": "Guest Services", "team": "Greeter Team", "pos": "Greeter Team", "id": "38615136", "name": "Alexis Springfield", "firstDate": "2026-10-25", "addedDate": "2026-10-20", "status": "C", "served": 1, "planId": "92297705"}, {"loc": "WP", "dept": "Guest Services", "team": "Greeter Team", "pos": "Greeter Team", "id": "51911081", "name": "Willy Maldonado", "firstDate": "2026-10-25", "addedDate": "2026-10-21", "status": "U", "served": 0, "planId": "92297705"}, {"loc": "WP", "dept": "Action Kids", "team": "Kids Preschool", "pos": "Shadow", "id": "143522788", "name": "Grayson Mellick", "firstDate": "2026-10-25", "addedDate": "2026-10-10", "status": "C", "served": 1, "planId": "92300122"}, {"loc": "WP", "dept": "Action Kids", "team": "Kids Preschool", "pos": "Purple Room", "id": "145252523", "name": "Sandy George", "firstDate": "2026-10-25", "addedDate": "2026-10-14", "status": "C", "served": 1, "planId": "92300122"}, {"loc": "WP", "dept": "Action Kids", "team": "Kids Theater", "pos": "Small Group Leader", "id": "70953710", "name": "Graham Varkey", "firstDate": "2026-10-25", "addedDate": "2026-10-14", "status": "C", "served": 1, "planId": "92300122"}, {"loc": "WP", "dept": "Guest Services", "team": "Parking Team", "pos": "Parking Team", "id": "191853749", "name": "Carlos Trott", "firstDate": "2026-10-25", "addedDate": "2026-10-21", "status": "C", "served": 0, "planId": "92297705"}, {"loc": "WP", "dept": "Guest Services", "team": "Parking Team", "pos": "Parking Team", "id": "97685477", "name": "Elijah Althof", "firstDate": "2026-10-25", "addedDate": "2026-10-25", "status": "U", "served": 0, "planId": "92297705"}, {"loc": "OV", "dept": "Action Kids", "team": "Preschool", "pos": "Blue Room", "id": "9617280", "name": "Lori Moon", "firstDate": "2026-10-25", "addedDate": "2026-10-22", "status": "C", "served": 1, "planId": "92233709"}, {"loc": "OV", "dept": "Weekend Service", "team": "Vocals", "pos": "Co-Worship Leader", "id": "38554468", "name": "Joe Mercado", "firstDate": "2026-10-25", "addedDate": "2026-10-25", "status": "C", "served": 1, "planId": "92148271"}, {"loc": "OV", "dept": "Guest Services", "team": "Greeters", "pos": "Greeter Team", "id": "72131952", "name": "Alba Alonso", "firstDate": "2026-10-11", "addedDate": "2026-10-09", "status": "D", "served": 1, "planId": "92237542"}, {"loc": "OV", "dept": "Weekend Service", "team": "Production", "pos": "Service Coordinator", "id": "203135734", "name": "Kennedy Peters", "firstDate": "2026-10-04", "addedDate": "2026-09-27", "status": "C", "served": 2, "planId": "92148271"}, {"loc": "OV", "dept": "Action Kids", "team": "Theater", "pos": "Room Leader", "id": "38559271", "name": "David Welday", "firstDate": "2026-10-04", "addedDate": "2026-09-30", "status": "C", "served": 0, "planId": "92233709"}, {"loc": "WS", "dept": "Weekend Service", "team": "Band", "pos": "Shadow", "id": "165026267", "name": "Hassan Sylvain", "firstDate": "2026-10-25", "addedDate": "2026-10-19", "status": "C", "served": 0, "planId": "92092980"}, {"loc": "WS", "dept": "Action Kids", "team": "Action Kids", "pos": "Blue Room", "id": "38551345", "name": "Kira Gold", "firstDate": "2026-10-18", "addedDate": "2026-10-16", "status": "U", "served": 1, "planId": "92094494"}, {"loc": "WS", "dept": "Action Kids", "team": "Action Kids", "pos": "Orange Room", "id": "38551346", "name": "Trish Gold", "firstDate": "2026-10-18", "addedDate": "2026-10-16", "status": "U", "served": 1, "planId": "92094494"}, {"loc": "WS", "dept": "Weekend Service", "team": "Band", "pos": "Acoustic Guitar", "id": "195829308", "name": "Caleb Calderon", "firstDate": "2026-10-18", "addedDate": "2026-10-13", "status": "C", "served": 0, "planId": "92092978"}, {"loc": "WS", "dept": "Weekend Service", "team": "Worship", "pos": "Vocals", "id": "195829308", "name": "Caleb Calderon", "firstDate": "2026-10-18", "addedDate": "2026-10-13", "status": "C", "served": 0, "planId": "92092978"}, {"loc": "WS", "dept": "Weekend Service", "team": "Worship", "pos": "Worship Team Lead", "id": "158751975", "name": "Michael Reinhardt", "firstDate": "2026-10-11", "addedDate": "2026-10-05", "status": "C", "served": 0, "planId": "92092971"}]};

const TH_JOINS_Q: THJoinsHorizon = {"byLoc": {"ALL": {"total": 302, "unique": 265, "teamsCount": 55, "teams": []}, "HW": {"total": 142, "unique": 122, "teamsCount": 19, "teams": [{"loc": "HW", "dept": "Action Kids", "team": "Kids Preschool", "count": 24, "people": [{"name": "Meagan Fowler", "date": "10-11", "pos": "Red Room Leader", "id": "198867732"}, {"name": "Lilly Billingsley", "date": "10-04", "pos": "Orange Room Leader", "id": "111846785"}, {"name": "Jarumi Richardson", "date": "09-27", "pos": "Blue Room", "id": "198869227"}, {"name": "Maria Ladeveze", "date": "09-27", "pos": "Orange Room", "id": "198858715"}]}, {"loc": "HW", "dept": "Action Kids", "team": "Kids Theater", "count": 18, "people": [{"name": "Ashley Brown", "date": "10-04", "pos": "Small Group Leader", "id": "195834070"}, {"name": "Avaleigh DiMolfetta", "date": "10-04", "pos": "Youth Production Helper", "id": "198864815"}, {"name": "Stephen Condon", "date": "10-04", "pos": "KT Youth Helper", "id": "198860316"}, {"name": "Alicia Hage", "date": "09-27", "pos": "Host", "id": "198853190"}]}, {"loc": "HW", "dept": "Guest Services", "team": "Greeters", "count": 14, "people": [{"name": "Shelby Freese", "date": "10-18", "pos": "Greeter", "id": "198869281"}, {"name": "Steffon Rush", "date": "10-18", "pos": "Greeter", "id": "78757640"}, {"name": "Rosa Hidalgo", "date": "10-04", "pos": "Greeter", "id": "162901974"}, {"name": "Elizabeth Ramirez", "date": "09-27", "pos": "Greeter", "id": "66416639"}]}, {"loc": "HW", "dept": "Guest Services", "team": "Connect", "count": 13, "people": [{"name": "Iris Grant", "date": "10-25", "pos": "Connect Lead", "id": "194028940"}, {"name": "Evan Wong", "date": "10-18", "pos": "Connect", "id": "136252521"}, {"name": "James Brown", "date": "10-11", "pos": "Connect Lead", "id": "198853210"}, {"name": "Kara Saghir", "date": "10-11", "pos": "Connect", "id": "198823297"}]}, {"loc": "HW", "dept": "Guest Services", "team": "Prayer", "count": 12, "people": [{"name": "Amanda Reynolds", "date": "10-25", "pos": "Prayer", "id": "81545328"}, {"name": "Caleb Calderon", "date": "10-25", "pos": "Prayer", "id": "195829308"}, {"name": "Emilio Lopez", "date": "10-25", "pos": "Prayer", "id": "198855181"}, {"name": "Ivy Fernandez", "date": "10-11", "pos": "Prayer", "id": "70067024"}]}, {"loc": "HW", "dept": "Action Kids", "team": "Kids Check-In", "count": 10, "people": [{"name": "Joshua Richardson", "date": "10-18", "pos": "Safety", "id": "198869223"}, {"name": "Ashley Ott", "date": "10-11", "pos": "Check-In", "id": "165794361"}, {"name": "Elly Harrington", "date": "09-27", "pos": "Check-In", "id": "195230816"}, {"name": "Leah Callahan", "date": "09-20", "pos": "Check-In", "id": "142733266"}]}, {"loc": "HW", "dept": "Weekend Service", "team": "Photo/Video", "count": 7, "people": [{"name": "Genaea Pettit", "date": "10-18", "pos": "Photographer", "id": "201820716"}, {"name": "Nolan Pettit", "date": "10-18", "pos": "Photographer", "id": "201821156"}, {"name": "Julia Bailey", "date": "09-27", "pos": "Photographer", "id": "198854129"}, {"name": "Harrison Ryll", "date": "09-20", "pos": "Photographer", "id": "198853225"}]}, {"loc": "HW", "dept": "Weekend Service", "team": "Production", "count": 6, "people": [{"name": "Aleisha McKeeby", "date": "10-25", "pos": "Training", "id": "48862021"}, {"name": "Isabella Salazar-Cab\u00e1n", "date": "10-18", "pos": "Lighting Operator", "id": "198692784"}, {"name": "Ricardo Ortolaza Perez", "date": "10-18", "pos": "Training", "id": "149077646"}, {"name": "Taylor Martin", "date": "10-11", "pos": "Graphics Operator", "id": "198853979"}]}, {"loc": "HW", "dept": "Guest Services", "team": "Safety", "count": 6, "people": [{"name": "Joshua Richardson", "date": "10-11", "pos": "Safety", "id": "198869223"}, {"name": "Ben Thomas", "date": "09-13", "pos": "Safety", "id": "198860116"}, {"name": "David Stewart", "date": "09-13", "pos": "Safety", "id": "194576146"}, {"name": "Michael Brenson", "date": "09-13", "pos": "Safety", "id": "171781343"}]}, {"loc": "HW", "dept": "Guest Services", "team": "Ushers", "count": 6, "people": [{"name": "Sadrack Serelus", "date": "10-25", "pos": "Usher", "id": "198857384"}, {"name": "Steve Bonneau", "date": "10-11", "pos": "Usher", "id": "153958702"}, {"name": "Ashley Brown", "date": "10-04", "pos": "Usher", "id": "195834070"}, {"name": "Erik Halverson", "date": "09-13", "pos": "Usher", "id": "38551832"}]}, {"loc": "HW", "dept": "Guest Services", "team": "Coach", "count": 4, "people": [{"name": "Iris Grant", "date": "10-25", "pos": "Coach", "id": "194028940"}, {"name": "Diana Geremia", "date": "09-13", "pos": "Coach", "id": "160937650"}, {"name": "Robert King", "date": "09-13", "pos": "Coach", "id": "46543892"}, {"name": "Yasmyn Escobar", "date": "09-13", "pos": "Coach", "id": "198858723"}]}, {"loc": "HW", "dept": "Weekend Service", "team": "Experience Team Devo", "count": 4, "people": [{"name": "Josh Wolf", "date": "09-20", "pos": "Sunday Morning Team Devo", "id": "196259152"}, {"name": "Katie Rivers", "date": "09-20", "pos": "Thursday Night Devo", "id": "169959856"}, {"name": "Kayla Hill", "date": "09-20", "pos": "Sunday Morning Team Devo", "id": "196815141"}, {"name": "Victory Agobe", "date": "09-13", "pos": "Sunday Morning Team Devo", "id": "198856003"}]}]}, "SF": {"total": 18, "unique": 17, "teamsCount": 3, "teams": [{"loc": "SF", "dept": "Guest Services", "team": "Guest Services", "count": 13, "people": [{"name": "Iris Grant", "date": "10-18", "pos": "Connect Team*", "id": "194028940"}, {"name": "Wilson McEachern", "date": "10-18", "pos": "Safety*", "id": "94414614"}, {"name": "Brayden Stotler", "date": "10-11", "pos": "Greeter*", "id": "203431121"}, {"name": "David Rouse", "date": "10-11", "pos": "Parking*", "id": "203430324"}]}, {"loc": "SF", "dept": "Action Kids", "team": "Pre-School", "count": 3, "people": [{"name": "Ashalei St. Amant", "date": "10-18", "pos": "Blue Room (Nursery)", "id": "179064791"}, {"name": "Maria Francisco", "date": "10-11", "pos": "Red Room", "id": "157850990"}, {"name": "Jamie Asegurado", "date": "08-30", "pos": "Blue Room (Nursery)", "id": "183292720"}]}, {"loc": "SF", "dept": "Guest Services", "team": "Prayer Team", "count": 2, "people": [{"name": "Claudia Bucaro", "date": "10-18", "pos": "Altar", "id": "31603266"}, {"name": "Bethanee Esqueda", "date": "09-20", "pos": "Altar", "id": "109177189"}]}]}, "WP": {"total": 100, "unique": 93, "teamsCount": 16, "teams": [{"loc": "WP", "dept": "Action Kids", "team": "Kids Preschool", "count": 22, "people": [{"name": "Grayson Mellick", "date": "10-25", "pos": "Shadow", "id": "143522788"}, {"name": "Sandy George", "date": "10-25", "pos": "Purple Room", "id": "145252523"}, {"name": "Madisyn Cheek", "date": "10-18", "pos": "Yellow Room", "id": "197729612"}, {"name": "Hudson Wiley", "date": "10-04", "pos": "Yellow Room", "id": "38559427"}]}, {"loc": "WP", "dept": "Guest Services", "team": "Greeter Team", "count": 19, "people": [{"name": "Alexis Springfield", "date": "10-25", "pos": "Greeter Team", "id": "38615136"}, {"name": "Willy Maldonado", "date": "10-25", "pos": "Greeter Team", "id": "51911081"}, {"name": "AJ Varn", "date": "10-18", "pos": "Greeter Team", "id": "58816843"}, {"name": "Darcey Varn", "date": "10-18", "pos": "Greeter Team", "id": "58816841"}]}, {"loc": "WP", "dept": "Guest Services", "team": "Parking Team", "count": 14, "people": [{"name": "Carlos Trott", "date": "10-25", "pos": "Parking Team", "id": "191853749"}, {"name": "Elijah Althof", "date": "10-25", "pos": "Parking Team", "id": "97685477"}, {"name": "Elijah Springfield", "date": "10-25", "pos": "Parking Team", "id": "38615372"}, {"name": "Joseph LoPiparo", "date": "10-25", "pos": "Parking Team", "id": "109751109"}]}, {"loc": "WP", "dept": "Guest Services", "team": "Connect Team", "count": 7, "people": [{"name": "Kitty Handelsman", "date": "10-25", "pos": "Connect Team", "id": "201714853"}, {"name": "Trevor Hussak", "date": "10-25", "pos": "Golf Carts", "id": "98184295"}, {"name": "Keyla Gonzalez", "date": "10-18", "pos": "Connect Team", "id": "83695663"}, {"name": "Victoria Turner", "date": "10-04", "pos": "Connect Team", "id": "33845810"}]}, {"loc": "WP", "dept": "Weekend Service", "team": "Choir-WP", "count": 6, "people": [{"name": "Adriana Marin", "date": "10-11", "pos": "Choir-Shadow", "id": "90557540"}, {"name": "Lori Robb", "date": "10-11", "pos": "Choir-Shadow", "id": "97615928"}, {"name": "Jesse Sizemore", "date": "09-20", "pos": "Choir-Shadow", "id": "182528882"}, {"name": "Aiden Gammons", "date": "09-13", "pos": "Choir-All Services", "id": "38551008"}]}, {"loc": "WP", "dept": "Guest Services", "team": "Safety Team", "count": 5, "people": [{"name": "Angel Valentin-Lopez", "date": "10-18", "pos": "Safety Team", "id": "167652969"}, {"name": "Jake Lavender", "date": "09-20", "pos": "Safety Team", "id": "4529721"}, {"name": "Randy Bishop", "date": "09-20", "pos": "Safety Team", "id": "32893197"}, {"name": "Dallas Moore", "date": "08-30", "pos": "Safety Team", "id": "36865000"}]}, {"loc": "WP", "dept": "Guest Services", "team": "Usher Team", "count": 5, "people": [{"name": "AJ Varn", "date": "10-18", "pos": "Usher", "id": "58816843"}, {"name": "Darcey Varn", "date": "10-18", "pos": "Usher", "id": "58816841"}, {"name": "Chris Heath-Morgan", "date": "09-27", "pos": "Usher", "id": "198177393"}, {"name": "Mike Wood", "date": "09-27", "pos": "Usher", "id": "38559652"}]}, {"loc": "WP", "dept": "Action Kids", "team": "Kids Theater", "count": 4, "people": [{"name": "Graham Varkey", "date": "10-25", "pos": "Small Group Leader", "id": "70953710"}, {"name": "Noah Miranda", "date": "09-20", "pos": "Production/Tech", "id": "118662803"}, {"name": "Christa Riddlemoser", "date": "08-30", "pos": "Small Group Leader", "id": "199217392"}, {"name": "Marcus Hyatt", "date": "08-30", "pos": "Small Group Leader", "id": "124596914"}]}, {"loc": "WP", "dept": "Guest Services", "team": "Prayer Team", "count": 4, "people": [{"name": "Courtney Deck", "date": "09-06", "pos": "Altar Team", "id": "92912763"}, {"name": "Jaron Deck", "date": "09-06", "pos": "Altar Team", "id": "92985804"}, {"name": "Sierra Baker", "date": "09-06", "pos": "Intercessors", "id": "142346845"}, {"name": "Margaret Brennan", "date": "08-23", "pos": "Intercessors", "id": "44039485"}]}, {"loc": "WP", "dept": "Weekend Service", "team": "Mic Assignments", "count": 3, "people": [{"name": "Caitee Young", "date": "10-11", "pos": "Mic 3", "id": "91348314"}, {"name": "Kimberly Alvarez-Cabais", "date": "10-11", "pos": "Mic 4", "id": "153327219"}, {"name": "Miranda Quigley", "date": "10-11", "pos": "Mic 7", "id": "195518897"}]}, {"loc": "WP", "dept": "Weekend Service", "team": "Vocals", "count": 3, "people": [{"name": "Caitee Young", "date": "10-11", "pos": "Vocalist", "id": "91348314"}, {"name": "Kimberly Alvarez-Cabais", "date": "10-11", "pos": "Vocalist", "id": "153327219"}, {"name": "Miranda Quigley", "date": "10-11", "pos": "Co-Worship Leader", "id": "195518897"}]}, {"loc": "WP", "dept": "Guest Services", "team": "Admin Team", "count": 2, "people": [{"name": "Jasmin Byrd", "date": "09-06", "pos": "Admin Team", "id": "29986048"}, {"name": "Lenita McFeron", "date": "08-30", "pos": "Admin Team", "id": "135153418"}]}]}, "OV": {"total": 25, "unique": 23, "teamsCount": 9, "teams": [{"loc": "OV", "dept": "Guest Services", "team": "Greeters", "count": 5, "people": [{"name": "Alba Alonso", "date": "10-11", "pos": "Greeter Team", "id": "72131952"}, {"name": "Wendy Silva", "date": "09-13", "pos": "Greeter Team", "id": "117213546"}, {"name": "Nicholas Patrylo", "date": "09-06", "pos": "Greeter Team", "id": "144157402"}, {"name": "Silvia Anderson", "date": "09-06", "pos": "Greeter Team", "id": "187785269"}]}, {"loc": "OV", "dept": "Weekend Service", "team": "Vocals", "count": 5, "people": [{"name": "Joe Mercado", "date": "10-25", "pos": "Co-Worship Leader", "id": "38554468"}, {"name": "Jaime Morgan", "date": "09-06", "pos": "Co-Worship Leader", "id": "149028586"}, {"name": "Lauren Spreen", "date": "08-30", "pos": "Vocalist", "id": "193731364"}, {"name": "Alyssa Hildebrand", "date": "08-23", "pos": "Vocalist", "id": "20333092"}]}, {"loc": "OV", "dept": "Weekend Service", "team": "Band", "count": 4, "people": [{"name": "Joe Mercado", "date": "10-25", "pos": "Electric Guitar 2", "id": "38554468"}, {"name": "Lao Flores", "date": "09-13", "pos": "Drums", "id": "85616464"}, {"name": "Janna Harmer", "date": "08-30", "pos": "Keys", "id": "69107960"}, {"name": "Kevin Pagan", "date": "08-30", "pos": "Bass Guitar", "id": "159072009"}]}, {"loc": "OV", "dept": "Action Kids", "team": "Preschool", "count": 3, "people": [{"name": "Lori Moon", "date": "10-25", "pos": "Blue Room", "id": "9617280"}, {"name": "Paxxtyn Kilgore", "date": "08-23", "pos": "Blue Room", "id": "105659027"}, {"name": "Susan Kilgore", "date": "08-23", "pos": "Blue Room", "id": "105659025"}]}, {"loc": "OV", "dept": "Guest Services", "team": "Connect", "count": 2, "people": [{"name": "Jessica Bonura", "date": "08-30", "pos": "Connect Team", "id": "91341962"}, {"name": "Massimo Bonura", "date": "08-30", "pos": "Connect Team", "id": "91341627"}]}, {"loc": "OV", "dept": "Weekend Service", "team": "Production", "count": 2, "people": [{"name": "Kennedy Peters", "date": "10-04", "pos": "Service Coordinator", "id": "203135734"}, {"name": "Jaime Morgan", "date": "09-06", "pos": "Photographer", "id": "149028586"}]}, {"loc": "OV", "dept": "Action Kids", "team": "Theater", "count": 2, "people": [{"name": "David Welday", "date": "10-04", "pos": "Room Leader", "id": "38559271"}, {"name": "Sebastian Anderson", "date": "09-06", "pos": "Small Group Leader", "id": "196782689"}]}, {"loc": "OV", "dept": "Action Kids", "team": "Service Coordinators", "count": 1, "people": [{"name": "Natalie Shena", "date": "08-23", "pos": "Service Coordinators", "id": "118061649"}]}, {"loc": "OV", "dept": "Guest Services", "team": "Ushers", "count": 1, "people": [{"name": "Albert Quiroga", "date": "09-06", "pos": "Usher Team", "id": "99156927"}]}]}, "WS": {"total": 17, "unique": 12, "teamsCount": 8, "teams": [{"loc": "WS", "dept": "Action Kids", "team": "Action Kids", "count": 6, "people": [{"name": "Kira Gold", "date": "10-18", "pos": "Blue Room", "id": "38551345"}, {"name": "Trish Gold", "date": "10-18", "pos": "Orange Room", "id": "38551346"}, {"name": "Giulliana Soto", "date": "09-06", "pos": "Blue Room", "id": "38557988"}, {"name": "Miranda Gopal Deval", "date": "09-06", "pos": "Orange Room", "id": "198927606"}]}, {"loc": "WS", "dept": "Action Kids", "team": "Child Care", "count": 3, "people": [{"name": "Giulliana Soto", "date": "09-06", "pos": "Post-Service Childcare", "id": "38557988"}, {"name": "Angelina Bleggi", "date": "08-30", "pos": "Post-Service Childcare", "id": "174162530"}, {"name": "Iliana Rosado", "date": "08-30", "pos": "Post-Service Childcare", "id": "44258881"}]}, {"loc": "WS", "dept": "Weekend Service", "team": "Band", "count": 2, "people": [{"name": "Hassan Sylvain", "date": "10-25", "pos": "Shadow", "id": "165026267"}, {"name": "Caleb Calderon", "date": "10-18", "pos": "Acoustic Guitar", "id": "195829308"}]}, {"loc": "WS", "dept": "Weekend Service", "team": "Worship", "count": 2, "people": [{"name": "Caleb Calderon", "date": "10-18", "pos": "Vocals", "id": "195829308"}, {"name": "Michael Reinhardt", "date": "10-11", "pos": "Worship Team Lead", "id": "158751975"}]}, {"loc": "WS", "dept": "Weekend Service", "team": "Production", "count": 1, "people": [{"name": "Carlos Vazquez", "date": "09-20", "pos": "FOH", "id": "65922403"}]}, {"loc": "WS", "dept": "Guest Services", "team": "Set Up Team", "count": 1, "people": [{"name": "Jeremy Frank", "date": "09-27", "pos": "Set up", "id": "201818491"}]}, {"loc": "WS", "dept": "Action Kids", "team": "Set-up Team", "count": 1, "people": [{"name": "Valeria Sanchez", "date": "08-30", "pos": "Set-up Team", "id": "127902510"}]}, {"loc": "WS", "dept": "Guest Services", "team": "Usher", "count": 1, "people": [{"name": "Jeremy Frank", "date": "09-27", "pos": "Usher", "id": "201818491"}]}]}}, "members": [{"loc": "HW", "dept": "Guest Services", "team": "Coach", "pos": "Coach", "id": "194028940", "name": "Iris Grant", "firstDate": "2026-10-25", "addedDate": "2026-10-21", "status": "C", "served": 0, "planId": "92151843"}, {"loc": "HW", "dept": "Guest Services", "team": "Connect", "pos": "Connect Lead", "id": "194028940", "name": "Iris Grant", "firstDate": "2026-10-25", "addedDate": "2026-10-21", "status": "C", "served": 0, "planId": "92151843"}, {"loc": "HW", "dept": "Guest Services", "team": "Prayer", "pos": "Prayer", "id": "81545328", "name": "Amanda Reynolds", "firstDate": "2026-10-25", "addedDate": "2026-10-07", "status": "C", "served": 1, "planId": "92151843"}, {"loc": "HW", "dept": "Guest Services", "team": "Prayer", "pos": "Prayer", "id": "195829308", "name": "Caleb Calderon", "firstDate": "2026-10-25", "addedDate": "2026-10-09", "status": "C", "served": 0, "planId": "92082626"}, {"loc": "HW", "dept": "Guest Services", "team": "Prayer", "pos": "Prayer", "id": "198855181", "name": "Emilio Lopez", "firstDate": "2026-10-25", "addedDate": "2026-10-09", "status": "C", "served": 0, "planId": "92082626"}, {"loc": "HW", "dept": "Weekend Service", "team": "Production", "pos": "Training", "id": "48862021", "name": "Aleisha McKeeby", "firstDate": "2026-10-25", "addedDate": "2026-10-20", "status": "C", "served": 0, "planId": "92259115"}, {"loc": "HW", "dept": "Guest Services", "team": "Ushers", "pos": "Usher", "id": "198857384", "name": "Sadrack Serelus", "firstDate": "2026-10-25", "addedDate": "2026-10-05", "status": "C", "served": 1, "planId": "92151843"}, {"loc": "HW", "dept": "Guest Services", "team": "Connect", "pos": "Connect", "id": "136252521", "name": "Evan Wong", "firstDate": "2026-10-18", "addedDate": "2026-10-13", "status": "U", "served": 0, "planId": "92082971"}, {"loc": "HW", "dept": "Guest Services", "team": "Greeters", "pos": "Greeter", "id": "198869281", "name": "Shelby Freese", "firstDate": "2026-10-18", "addedDate": "2026-09-21", "status": "C", "served": 2, "planId": "92151843"}, {"loc": "HW", "dept": "Guest Services", "team": "Greeters", "pos": "Greeter", "id": "78757640", "name": "Steffon Rush", "firstDate": "2026-10-18", "addedDate": "2026-10-12", "status": "D", "served": 0, "planId": "92151843"}, {"loc": "SF", "dept": "Guest Services", "team": "Guest Services", "pos": "Connect Team*", "id": "194028940", "name": "Iris Grant", "firstDate": "2026-10-18", "addedDate": "2026-10-09", "status": "D", "served": 0, "planId": "92294193"}, {"loc": "SF", "dept": "Guest Services", "team": "Guest Services", "pos": "Safety*", "id": "94414614", "name": "Wilson McEachern", "firstDate": "2026-10-18", "addedDate": "2026-10-18", "status": "C", "served": 1, "planId": "92294193"}, {"loc": "SF", "dept": "Guest Services", "team": "Prayer Team", "pos": "Altar", "id": "31603266", "name": "Claudia Bucaro", "firstDate": "2026-10-18", "addedDate": "2026-09-30", "status": "C", "served": 0, "planId": "92294193"}, {"loc": "SF", "dept": "Action Kids", "team": "Pre-School", "pos": "Blue Room (Nursery)", "id": "179064791", "name": "Ashalei St. Amant", "firstDate": "2026-10-18", "addedDate": "2026-10-15", "status": "C", "served": 2, "planId": "92096943"}, {"loc": "SF", "dept": "Guest Services", "team": "Guest Services", "pos": "Greeter*", "id": "203431121", "name": "Brayden Stotler", "firstDate": "2026-10-11", "addedDate": "2026-10-11", "status": "C", "served": 0, "planId": "92294176"}, {"loc": "SF", "dept": "Guest Services", "team": "Guest Services", "pos": "Parking*", "id": "203430324", "name": "David Rouse", "firstDate": "2026-10-11", "addedDate": "2026-10-11", "status": "C", "served": 0, "planId": "92294176"}, {"loc": "SF", "dept": "Action Kids", "team": "Pre-School", "pos": "Red Room", "id": "157850990", "name": "Maria Francisco", "firstDate": "2026-10-11", "addedDate": "2026-10-05", "status": "C", "served": 0, "planId": "92096941"}, {"loc": "SF", "dept": "Guest Services", "team": "Guest Services", "pos": "Coach", "id": "31603266", "name": "Claudia Bucaro", "firstDate": "2026-10-04", "addedDate": "2026-10-04", "status": "C", "served": 0, "planId": "92294156"}, {"loc": "SF", "dept": "Guest Services", "team": "Guest Services", "pos": "Connect Team*", "id": "167760249", "name": "Maria Truong", "firstDate": "2026-10-04", "addedDate": "2026-10-04", "status": "C", "served": 2, "planId": "92294176"}, {"loc": "SF", "dept": "Guest Services", "team": "Guest Services", "pos": "Set Up*", "id": "38549074", "name": "William Centeno", "firstDate": "2026-10-04", "addedDate": "2026-09-26", "status": "U", "served": 1, "planId": "92294193"}, {"loc": "WP", "dept": "Weekend Service", "team": "Band", "pos": "Bass Guitar", "id": "39588378", "name": "Gabe Gomez", "firstDate": "2026-10-25", "addedDate": "2026-09-29", "status": "C", "served": 0, "planId": "91481065"}, {"loc": "WP", "dept": "Guest Services", "team": "Connect Team", "pos": "Connect Team", "id": "201714853", "name": "Kitty Handelsman", "firstDate": "2026-10-25", "addedDate": "2026-10-24", "status": "U", "served": 1, "planId": "92297705"}, {"loc": "WP", "dept": "Guest Services", "team": "Connect Team", "pos": "Golf Carts", "id": "98184295", "name": "Trevor Hussak", "firstDate": "2026-10-25", "addedDate": "2026-09-26", "status": "C", "served": 1, "planId": "92297705"}, {"loc": "WP", "dept": "Guest Services", "team": "Greeter Team", "pos": "Greeter Team", "id": "38615136", "name": "Alexis Springfield", "firstDate": "2026-10-25", "addedDate": "2026-10-20", "status": "C", "served": 1, "planId": "92297705"}, {"loc": "WP", "dept": "Guest Services", "team": "Greeter Team", "pos": "Greeter Team", "id": "51911081", "name": "Willy Maldonado", "firstDate": "2026-10-25", "addedDate": "2026-10-21", "status": "U", "served": 0, "planId": "92297705"}, {"loc": "WP", "dept": "Action Kids", "team": "Kids Preschool", "pos": "Shadow", "id": "143522788", "name": "Grayson Mellick", "firstDate": "2026-10-25", "addedDate": "2026-10-10", "status": "C", "served": 1, "planId": "92300122"}, {"loc": "WP", "dept": "Action Kids", "team": "Kids Preschool", "pos": "Purple Room", "id": "145252523", "name": "Sandy George", "firstDate": "2026-10-25", "addedDate": "2026-10-14", "status": "C", "served": 1, "planId": "92300122"}, {"loc": "WP", "dept": "Action Kids", "team": "Kids Theater", "pos": "Small Group Leader", "id": "70953710", "name": "Graham Varkey", "firstDate": "2026-10-25", "addedDate": "2026-10-14", "status": "C", "served": 1, "planId": "92300122"}, {"loc": "WP", "dept": "Guest Services", "team": "Parking Team", "pos": "Parking Team", "id": "191853749", "name": "Carlos Trott", "firstDate": "2026-10-25", "addedDate": "2026-10-21", "status": "C", "served": 0, "planId": "92297705"}, {"loc": "WP", "dept": "Guest Services", "team": "Parking Team", "pos": "Parking Team", "id": "97685477", "name": "Elijah Althof", "firstDate": "2026-10-25", "addedDate": "2026-10-25", "status": "U", "served": 0, "planId": "92297705"}, {"loc": "OV", "dept": "Weekend Service", "team": "Band", "pos": "Electric Guitar 2", "id": "38554468", "name": "Joe Mercado", "firstDate": "2026-10-25", "addedDate": "2026-08-20", "status": "C", "served": 2, "planId": "92148271"}, {"loc": "OV", "dept": "Action Kids", "team": "Preschool", "pos": "Blue Room", "id": "9617280", "name": "Lori Moon", "firstDate": "2026-10-25", "addedDate": "2026-10-22", "status": "C", "served": 1, "planId": "92233709"}, {"loc": "OV", "dept": "Weekend Service", "team": "Vocals", "pos": "Co-Worship Leader", "id": "38554468", "name": "Joe Mercado", "firstDate": "2026-10-25", "addedDate": "2026-10-25", "status": "C", "served": 1, "planId": "92148271"}, {"loc": "OV", "dept": "Guest Services", "team": "Greeters", "pos": "Greeter Team", "id": "72131952", "name": "Alba Alonso", "firstDate": "2026-10-11", "addedDate": "2026-10-09", "status": "D", "served": 1, "planId": "92237542"}, {"loc": "OV", "dept": "Weekend Service", "team": "Production", "pos": "Service Coordinator", "id": "203135734", "name": "Kennedy Peters", "firstDate": "2026-10-04", "addedDate": "2026-09-27", "status": "C", "served": 2, "planId": "92148271"}, {"loc": "OV", "dept": "Action Kids", "team": "Theater", "pos": "Room Leader", "id": "38559271", "name": "David Welday", "firstDate": "2026-10-04", "addedDate": "2026-09-30", "status": "C", "served": 0, "planId": "92233709"}, {"loc": "OV", "dept": "Weekend Service", "team": "Band", "pos": "Drums", "id": "85616464", "name": "Lao Flores", "firstDate": "2026-09-13", "addedDate": "2026-08-20", "status": "C", "served": 1, "planId": "92148270"}, {"loc": "OV", "dept": "Guest Services", "team": "Greeters", "pos": "Greeter Team", "id": "117213546", "name": "Wendy Silva", "firstDate": "2026-09-13", "addedDate": "2026-08-31", "status": "C", "served": 2, "planId": "92237542"}, {"loc": "OV", "dept": "Guest Services", "team": "Greeters", "pos": "Greeter Team", "id": "144157402", "name": "Nicholas Patrylo", "firstDate": "2026-09-06", "addedDate": "2026-08-19", "status": "C", "served": 5, "planId": "92237542"}, {"loc": "OV", "dept": "Guest Services", "team": "Greeters", "pos": "Greeter Team", "id": "187785269", "name": "Silvia Anderson", "firstDate": "2026-09-06", "addedDate": "2026-09-03", "status": "C", "served": 1, "planId": "91344495"}, {"loc": "WS", "dept": "Weekend Service", "team": "Band", "pos": "Shadow", "id": "165026267", "name": "Hassan Sylvain", "firstDate": "2026-10-25", "addedDate": "2026-10-19", "status": "C", "served": 0, "planId": "92092980"}, {"loc": "WS", "dept": "Action Kids", "team": "Action Kids", "pos": "Blue Room", "id": "38551345", "name": "Kira Gold", "firstDate": "2026-10-18", "addedDate": "2026-10-16", "status": "U", "served": 1, "planId": "92094494"}, {"loc": "WS", "dept": "Action Kids", "team": "Action Kids", "pos": "Orange Room", "id": "38551346", "name": "Trish Gold", "firstDate": "2026-10-18", "addedDate": "2026-10-16", "status": "U", "served": 1, "planId": "92094494"}, {"loc": "WS", "dept": "Weekend Service", "team": "Band", "pos": "Acoustic Guitar", "id": "195829308", "name": "Caleb Calderon", "firstDate": "2026-10-18", "addedDate": "2026-10-13", "status": "C", "served": 0, "planId": "92092978"}, {"loc": "WS", "dept": "Weekend Service", "team": "Worship", "pos": "Vocals", "id": "195829308", "name": "Caleb Calderon", "firstDate": "2026-10-18", "addedDate": "2026-10-13", "status": "C", "served": 0, "planId": "92092978"}, {"loc": "WS", "dept": "Weekend Service", "team": "Worship", "pos": "Worship Team Lead", "id": "158751975", "name": "Michael Reinhardt", "firstDate": "2026-10-11", "addedDate": "2026-10-05", "status": "C", "served": 0, "planId": "92092971"}, {"loc": "WS", "dept": "Guest Services", "team": "Set Up Team", "pos": "Set up", "id": "201818491", "name": "Jeremy Frank", "firstDate": "2026-09-27", "addedDate": "2026-09-22", "status": "C", "served": 3, "planId": "92207624"}, {"loc": "WS", "dept": "Guest Services", "team": "Usher", "pos": "Usher", "id": "201818491", "name": "Jeremy Frank", "firstDate": "2026-09-27", "addedDate": "2026-09-22", "status": "C", "served": 3, "planId": "92207624"}, {"loc": "WS", "dept": "Weekend Service", "team": "Production", "pos": "FOH", "id": "65922403", "name": "Carlos Vazquez", "firstDate": "2026-09-20", "addedDate": "2026-08-18", "status": "C", "served": 1, "planId": "92092978"}, {"loc": "WS", "dept": "Action Kids", "team": "Action Kids", "pos": "Blue Room", "id": "38557988", "name": "Giulliana Soto", "firstDate": "2026-09-06", "addedDate": "2026-08-20", "status": "D", "served": 1, "planId": "92094495"}]};

const TH_JOINS_SA: THJoinsHorizon = {"byLoc": {"ALL": {"total": 804, "unique": 677, "teamsCount": 76, "teams": []}, "HW": {"total": 299, "unique": 221, "teamsCount": 20, "teams": [{"loc": "HW", "dept": "Action Kids", "team": "Kids Preschool", "count": 37, "people": [{"name": "Meagan Fowler", "date": "10-11", "pos": "Red Room Leader", "id": "198867732"}, {"name": "Lilly Billingsley", "date": "10-04", "pos": "Orange Room Leader", "id": "111846785"}, {"name": "Jarumi Richardson", "date": "09-27", "pos": "Blue Room", "id": "198869227"}, {"name": "Maria Ladeveze", "date": "09-27", "pos": "Orange Room", "id": "198858715"}]}, {"loc": "HW", "dept": "Guest Services", "team": "Prayer", "count": 34, "people": [{"name": "Amanda Reynolds", "date": "10-25", "pos": "Prayer", "id": "81545328"}, {"name": "Aura Lynn Rouse", "date": "10-25", "pos": "Prayer", "id": "198853607"}, {"name": "Caleb Calderon", "date": "10-25", "pos": "Prayer", "id": "195829308"}, {"name": "Emilio Lopez", "date": "10-25", "pos": "Prayer", "id": "198855181"}]}, {"loc": "HW", "dept": "Action Kids", "team": "Kids Theater", "count": 32, "people": [{"name": "Ashley Brown", "date": "10-04", "pos": "Small Group Leader", "id": "195834070"}, {"name": "Avaleigh DiMolfetta", "date": "10-04", "pos": "Youth Production Helper", "id": "198864815"}, {"name": "Stephen Condon", "date": "10-04", "pos": "KT Youth Helper", "id": "198860316"}, {"name": "Alicia Hage", "date": "09-27", "pos": "Host", "id": "198853190"}]}, {"loc": "HW", "dept": "Guest Services", "team": "Greeters", "count": 28, "people": [{"name": "Shelby Freese", "date": "10-18", "pos": "Greeter", "id": "198869281"}, {"name": "Steffon Rush", "date": "10-18", "pos": "Greeter", "id": "78757640"}, {"name": "Rosa Hidalgo", "date": "10-04", "pos": "Greeter", "id": "162901974"}, {"name": "Aymette Davila", "date": "09-27", "pos": "Greeter", "id": "198858035"}]}, {"loc": "HW", "dept": "Guest Services", "team": "Connect", "count": 23, "people": [{"name": "Iris Grant", "date": "10-25", "pos": "Connect Lead", "id": "194028940"}, {"name": "Evan Wong", "date": "10-18", "pos": "Connect", "id": "136252521"}, {"name": "James Brown", "date": "10-11", "pos": "Connect Lead", "id": "198853210"}, {"name": "Kara Saghir", "date": "10-11", "pos": "Connect", "id": "198823297"}]}, {"loc": "HW", "dept": "Weekend Service", "team": "Vocals", "count": 23, "people": [{"name": "Caleb Calderon", "date": "10-25", "pos": "Mic 2", "id": "195829308"}, {"name": "Dan Marcos", "date": "10-25", "pos": "Mic 7", "id": "198853616"}, {"name": "Mysheala Atwater", "date": "10-25", "pos": "Mic 1", "id": "198854746"}, {"name": "Daniela Wieckhorst", "date": "10-18", "pos": "Mic 2", "id": "198856096"}]}, {"loc": "HW", "dept": "Weekend Service", "team": "Production", "count": 19, "people": [{"name": "Aleisha McKeeby", "date": "10-25", "pos": "Training", "id": "48862021"}, {"name": "Angelica Sharkey", "date": "10-18", "pos": "Graphics Operator", "id": "84576873"}, {"name": "Emmanuel Douge", "date": "10-18", "pos": "Resi Operator", "id": "195834281"}, {"name": "Isabella Salazar-Cab\u00e1n", "date": "10-18", "pos": "Lighting Operator", "id": "198692784"}]}, {"loc": "HW", "dept": "Guest Services", "team": "Ushers", "count": 16, "people": [{"name": "Sadrack Serelus", "date": "10-25", "pos": "Usher", "id": "198857384"}, {"name": "Steve Bonneau", "date": "10-11", "pos": "Usher", "id": "153958702"}, {"name": "Ashley Brown", "date": "10-04", "pos": "Usher", "id": "195834070"}, {"name": "Chet Siudak", "date": "09-13", "pos": "Usher Lead", "id": "198856426"}]}, {"loc": "HW", "dept": "Weekend Service", "team": "Band", "count": 15, "people": [{"name": "Brandon Greaver", "date": "10-25", "pos": "Lead Electric", "id": "194149357"}, {"name": "Tom Avalos", "date": "10-25", "pos": "Bass Guitar", "id": "194207980"}, {"name": "Austin Smith", "date": "10-18", "pos": "Drums", "id": "198853167"}, {"name": "Tomas (Tommy) Rosaly", "date": "10-18", "pos": "Bass Guitar", "id": "198855337"}]}, {"loc": "HW", "dept": "Action Kids", "team": "Kids Check-In", "count": 15, "people": [{"name": "Joshua Richardson", "date": "10-18", "pos": "Safety", "id": "198869223"}, {"name": "Ashley Ott", "date": "10-11", "pos": "Check-In", "id": "165794361"}, {"name": "Elly Harrington", "date": "09-27", "pos": "Check-In", "id": "195230816"}, {"name": "Leah Callahan", "date": "09-20", "pos": "Check-In", "id": "142733266"}]}, {"loc": "HW", "dept": "Guest Services", "team": "Parking", "count": 9, "people": [{"name": "Eddie Coba", "date": "10-11", "pos": "Parking", "id": "198865618"}, {"name": "David Chiles", "date": "09-20", "pos": "Parking Lead", "id": "198854109"}, {"name": "Justin Freese", "date": "09-20", "pos": "Parking", "id": "198853471"}, {"name": "Doug Bailey", "date": "09-13", "pos": "Parking", "id": "196310376"}]}, {"loc": "HW", "dept": "Guest Services", "team": "Safety", "count": 9, "people": [{"name": "Joshua Richardson", "date": "10-11", "pos": "Safety", "id": "198869223"}, {"name": "Harold Escobar", "date": "09-20", "pos": "Safety", "id": "195782057"}, {"name": "Ben Thomas", "date": "09-13", "pos": "Safety", "id": "198860116"}, {"name": "Christian Vale", "date": "09-13", "pos": "Safety Team Lead", "id": "52047858"}]}]}, "SF": {"total": 40, "unique": 38, "teamsCount": 5, "teams": [{"loc": "SF", "dept": "Guest Services", "team": "Guest Services", "count": 25, "people": [{"name": "Iris Grant", "date": "10-18", "pos": "Connect Team*", "id": "194028940"}, {"name": "Wilson McEachern", "date": "10-18", "pos": "Safety*", "id": "94414614"}, {"name": "Brayden Stotler", "date": "10-11", "pos": "Greeter*", "id": "203431121"}, {"name": "David Rouse", "date": "10-11", "pos": "Parking*", "id": "203430324"}]}, {"loc": "SF", "dept": "Action Kids", "team": "Pre-School", "count": 7, "people": [{"name": "Ashalei St. Amant", "date": "10-18", "pos": "Blue Room (Nursery)", "id": "179064791"}, {"name": "Maria Francisco", "date": "10-11", "pos": "Red Room", "id": "157850990"}, {"name": "Jamie Asegurado", "date": "08-30", "pos": "Blue Room (Nursery)", "id": "183292720"}, {"name": "Janelle Young", "date": "08-16", "pos": "Red Room", "id": "110469248"}]}, {"loc": "SF", "dept": "Weekend Service", "team": "Production", "count": 5, "people": [{"name": "Brandon Workman", "date": "08-16", "pos": "Video Director", "id": "153930465"}, {"name": "Emmalyn B\u00e9langer", "date": "08-09", "pos": "Lighting Operator", "id": "43533646"}, {"name": "Janay Pinder", "date": "08-02", "pos": "Service Producer", "id": "19697244"}, {"name": "Kato Pinder", "date": "08-02", "pos": "FOH Operator", "id": "167520223"}]}, {"loc": "SF", "dept": "Guest Services", "team": "Prayer Team", "count": 2, "people": [{"name": "Claudia Bucaro", "date": "10-18", "pos": "Altar", "id": "31603266"}, {"name": "Bethanee Esqueda", "date": "09-20", "pos": "Altar", "id": "109177189"}]}, {"loc": "SF", "dept": "Action Kids", "team": "KT1 - 2nd", "count": 1, "people": [{"name": "Rosie Norelia", "date": "08-02", "pos": "Room Leader", "id": "85019791"}]}]}, "WP": {"total": 324, "unique": 300, "teamsCount": 21, "teams": [{"loc": "WP", "dept": "Action Kids", "team": "Kids Preschool", "count": 80, "people": [{"name": "Grayson Mellick", "date": "10-25", "pos": "Shadow", "id": "143522788"}, {"name": "Sandy George", "date": "10-25", "pos": "Purple Room", "id": "145252523"}, {"name": "Madisyn Cheek", "date": "10-18", "pos": "Yellow Room", "id": "197729612"}, {"name": "Hudson Wiley", "date": "10-04", "pos": "Yellow Room", "id": "38559427"}]}, {"loc": "WP", "dept": "Guest Services", "team": "Greeter Team", "count": 64, "people": [{"name": "Alexis Springfield", "date": "10-25", "pos": "Greeter Team", "id": "38615136"}, {"name": "Willy Maldonado", "date": "10-25", "pos": "Greeter Team", "id": "51911081"}, {"name": "AJ Varn", "date": "10-18", "pos": "Greeter Team", "id": "58816843"}, {"name": "Darcey Varn", "date": "10-18", "pos": "Greeter Team", "id": "58816841"}]}, {"loc": "WP", "dept": "Guest Services", "team": "Connect Team", "count": 26, "people": [{"name": "Kitty Handelsman", "date": "10-25", "pos": "Connect Team", "id": "201714853"}, {"name": "Trevor Hussak", "date": "10-25", "pos": "Golf Carts", "id": "98184295"}, {"name": "Keyla Gonzalez", "date": "10-18", "pos": "Connect Team", "id": "83695663"}, {"name": "Victoria Turner", "date": "10-04", "pos": "Connect Team", "id": "33845810"}]}, {"loc": "WP", "dept": "Guest Services", "team": "Usher Team", "count": 24, "people": [{"name": "AJ Varn", "date": "10-18", "pos": "Usher", "id": "58816843"}, {"name": "Darcey Varn", "date": "10-18", "pos": "Usher", "id": "58816841"}, {"name": "Linzola Turner", "date": "10-04", "pos": "Usher", "id": "159099034"}, {"name": "Chris Heath-Morgan", "date": "09-27", "pos": "Usher", "id": "198177393"}]}, {"loc": "WP", "dept": "Guest Services", "team": "Parking Team", "count": 22, "people": [{"name": "Carlos Trott", "date": "10-25", "pos": "Parking Team", "id": "191853749"}, {"name": "Elijah Althof", "date": "10-25", "pos": "Parking Team", "id": "97685477"}, {"name": "Elijah Springfield", "date": "10-25", "pos": "Parking Team", "id": "38615372"}, {"name": "Joseph LoPiparo", "date": "10-25", "pos": "Parking Team", "id": "109751109"}]}, {"loc": "WP", "dept": "Action Kids", "team": "Kids Theater", "count": 16, "people": [{"name": "Graham Varkey", "date": "10-25", "pos": "Small Group Leader", "id": "70953710"}, {"name": "Noah Miranda", "date": "09-20", "pos": "Production/Tech", "id": "118662803"}, {"name": "Christa Riddlemoser", "date": "08-30", "pos": "Small Group Leader", "id": "199217392"}, {"name": "Marcus Hyatt", "date": "08-30", "pos": "Small Group Leader", "id": "124596914"}]}, {"loc": "WP", "dept": "Guest Services", "team": "Prayer Team", "count": 15, "people": [{"name": "Courtney Deck", "date": "09-06", "pos": "Altar Team", "id": "92912763"}, {"name": "Jaron Deck", "date": "09-06", "pos": "Altar Team", "id": "92985804"}, {"name": "Sierra Baker", "date": "09-06", "pos": "Intercessors", "id": "142346845"}, {"name": "Margaret Brennan", "date": "08-23", "pos": "Intercessors", "id": "44039485"}]}, {"loc": "WP", "dept": "Weekend Service", "team": "Choir-WP", "count": 14, "people": [{"name": "Adriana Marin", "date": "10-11", "pos": "Choir-Shadow", "id": "90557540"}, {"name": "Lori Robb", "date": "10-11", "pos": "Choir-Shadow", "id": "97615928"}, {"name": "Jesse Sizemore", "date": "09-20", "pos": "Choir-Shadow", "id": "182528882"}, {"name": "Aiden Gammons", "date": "09-13", "pos": "Choir-All Services", "id": "38551008"}]}, {"loc": "WP", "dept": "Guest Services", "team": "Safety Team", "count": 14, "people": [{"name": "Angel Valentin-Lopez", "date": "10-18", "pos": "Safety Team", "id": "167652969"}, {"name": "Jake Lavender", "date": "09-20", "pos": "Safety Team", "id": "4529721"}, {"name": "Randy Bishop", "date": "09-20", "pos": "Safety Team", "id": "32893197"}, {"name": "Dallas Moore", "date": "08-30", "pos": "Safety Team", "id": "36865000"}]}, {"loc": "WP", "dept": "Weekend Service", "team": "Production", "count": 12, "people": [{"name": "Trinity Feikert", "date": "10-25", "pos": "Service Coordinator - Shadow", "id": "97799687"}, {"name": "Abby Thomas", "date": "09-13", "pos": "Service Producer", "id": "9198084"}, {"name": "Stacey Bennett", "date": "09-13", "pos": "Stage Manager", "id": "103943652"}, {"name": "Adam Holden", "date": "08-02", "pos": "FOH", "id": "19984086"}]}, {"loc": "WP", "dept": "Guest Services", "team": "Admin Team", "count": 7, "people": [{"name": "Jasmin Byrd", "date": "09-06", "pos": "Admin Team", "id": "29986048"}, {"name": "Lenita McFeron", "date": "08-30", "pos": "Admin Team", "id": "135153418"}, {"name": "Virginia Lopez", "date": "08-16", "pos": "Admin Team", "id": "62728668"}, {"name": "Jacquelyn Brault", "date": "08-09", "pos": "Admin Team Lead", "id": "44505464"}]}, {"loc": "WP", "dept": "Guest Services", "team": "Hospitality Team", "count": 6, "people": [{"name": "Savanna Wolford", "date": "08-30", "pos": "Hospitality Team", "id": "167077312"}, {"name": "Amanda Gullett", "date": "08-02", "pos": "Hospitality Team", "id": "190199353"}, {"name": "Gabriel Lugo", "date": "07-26", "pos": "Hospitality Team", "id": "38553672"}, {"name": "Karly Harbin", "date": "07-26", "pos": "Hospitality Team", "id": "167571006"}]}]}, "OV": {"total": 114, "unique": 101, "teamsCount": 20, "teams": [{"loc": "OV", "dept": "Action Kids", "team": "Preschool", "count": 21, "people": [{"name": "Lori Moon", "date": "10-25", "pos": "Blue Room", "id": "9617280"}, {"name": "Makenzie Mckernan", "date": "10-18", "pos": "Blue Room Leader", "id": "122105868"}, {"name": "Alyssa Dumas", "date": "09-27", "pos": "Red Room", "id": "108560657"}, {"name": "Paxxtyn Kilgore", "date": "08-23", "pos": "Blue Room", "id": "105659027"}]}, {"loc": "OV", "dept": "Guest Services", "team": "Greeters", "count": 20, "people": [{"name": "Alba Alonso", "date": "10-11", "pos": "Greeter Team", "id": "72131952"}, {"name": "Wendy Silva", "date": "09-13", "pos": "Greeter Team", "id": "117213546"}, {"name": "Nicholas Patrylo", "date": "09-06", "pos": "Greeter Team", "id": "144157402"}, {"name": "Silvia Anderson", "date": "09-06", "pos": "Greeter Team", "id": "187785269"}]}, {"loc": "OV", "dept": "Weekend Service", "team": "Vocals", "count": 12, "people": [{"name": "Joe Mercado", "date": "10-25", "pos": "Co-Worship Leader", "id": "38554468"}, {"name": "Jaime Morgan", "date": "09-06", "pos": "Co-Worship Leader", "id": "149028586"}, {"name": "Lauren Spreen", "date": "08-30", "pos": "Vocalist", "id": "193731364"}, {"name": "Alyssa Hildebrand", "date": "08-23", "pos": "Vocalist", "id": "20333092"}]}, {"loc": "OV", "dept": "Weekend Service", "team": "Band", "count": 10, "people": [{"name": "Joe Mercado", "date": "10-25", "pos": "Electric Guitar 2", "id": "38554468"}, {"name": "Lao Flores", "date": "09-13", "pos": "Drums", "id": "85616464"}, {"name": "Janna Harmer", "date": "08-30", "pos": "Keys", "id": "69107960"}, {"name": "Kevin Pagan", "date": "08-30", "pos": "Bass Guitar", "id": "159072009"}]}, {"loc": "OV", "dept": "Weekend Service", "team": "Production", "count": 10, "people": [{"name": "Kennedy Peters", "date": "10-04", "pos": "Service Coordinator", "id": "203135734"}, {"name": "Jaime Morgan", "date": "09-06", "pos": "Photographer", "id": "149028586"}, {"name": "Aiden Dees", "date": "08-16", "pos": "Lighting Operator (Shadow)", "id": "101477745"}, {"name": "Aleah Cutshall", "date": "08-16", "pos": "FOH Operator", "id": "34438078"}]}, {"loc": "OV", "dept": "Guest Services", "team": "Ushers", "count": 9, "people": [{"name": "Albert Quiroga", "date": "09-06", "pos": "Usher Team", "id": "99156927"}, {"name": "Aiden Dees", "date": "08-16", "pos": "Usher Team", "id": "101477745"}, {"name": "Bobby Brolliar", "date": "08-16", "pos": "Usher Team Lead", "id": "40683179"}, {"name": "Jorge Diaz", "date": "08-09", "pos": "Usher Team", "id": "180289741"}]}, {"loc": "OV", "dept": "Guest Services", "team": "Connect", "count": 5, "people": [{"name": "Diane Olson", "date": "08-30", "pos": "Connect Team", "id": "69900317"}, {"name": "Jessica Bonura", "date": "08-30", "pos": "Connect Team", "id": "91341962"}, {"name": "Massimo Bonura", "date": "08-30", "pos": "Connect Team", "id": "91341627"}, {"name": "Steven Olson", "date": "08-30", "pos": "Connect Team", "id": "69727167"}]}, {"loc": "OV", "dept": "Guest Services", "team": "Parking", "count": 5, "people": [{"name": "David Howard", "date": "09-27", "pos": "Parking Team Lead", "id": "60356433"}, {"name": "Jarod Metzger", "date": "08-23", "pos": "Parking Team Lead", "id": "124643372"}, {"name": "Brandon Sims", "date": "08-16", "pos": "Parking Team", "id": "93822510"}, {"name": "Daniel Middleton", "date": "08-16", "pos": "Parking Team Lead", "id": "55991405"}]}, {"loc": "OV", "dept": "Action Kids", "team": "Theater", "count": 5, "people": [{"name": "David Welday", "date": "10-04", "pos": "Room Leader", "id": "38559271"}, {"name": "Sebastian Anderson", "date": "09-06", "pos": "Small Group Leader", "id": "196782689"}, {"name": "Daniel Middleton", "date": "08-16", "pos": "Room Leader", "id": "55991405"}, {"name": "Martin Miles", "date": "08-09", "pos": "DJ", "id": "195522783"}]}, {"loc": "OV", "dept": "Guest Services", "team": "New Here", "count": 3, "people": [{"name": "David Scanlon", "date": "07-26", "pos": "New Here Team", "id": "38557290"}, {"name": "Hunter Bock", "date": "07-26", "pos": "New Here Team", "id": "38548213"}, {"name": "Jodi Goodroe", "date": "07-26", "pos": "New Here Team Lead", "id": "38803587"}]}, {"loc": "OV", "dept": "Action Kids", "team": "Service Coordinators", "count": 3, "people": [{"name": "Natalie Shena", "date": "08-23", "pos": "Service Coordinators", "id": "118061649"}, {"name": "Lacey Durr", "date": "07-26", "pos": "Service Coordinators", "id": "106682818"}, {"name": "Vanessa Michael", "date": "07-26", "pos": "Service Coordinators", "id": "7326372"}]}, {"loc": "OV", "dept": "Guest Services", "team": "Hospitality", "count": 2, "people": [{"name": "Kiesha Hernandez", "date": "07-26", "pos": "Hospitality Team", "id": "143116865"}, {"name": "Talane Garmer", "date": "07-26", "pos": "Hospitality Team", "id": "77879635"}]}]}, "WS": {"total": 27, "unique": 22, "teamsCount": 10, "teams": [{"loc": "WS", "dept": "Action Kids", "team": "Action Kids", "count": 13, "people": [{"name": "Kira Gold", "date": "10-18", "pos": "Blue Room", "id": "38551345"}, {"name": "Trish Gold", "date": "10-18", "pos": "Orange Room", "id": "38551346"}, {"name": "Giulliana Soto", "date": "09-06", "pos": "Blue Room", "id": "38557988"}, {"name": "Miranda Gopal Deval", "date": "09-06", "pos": "Orange Room", "id": "198927606"}]}, {"loc": "WS", "dept": "Action Kids", "team": "Child Care", "count": 3, "people": [{"name": "Giulliana Soto", "date": "09-06", "pos": "Post-Service Childcare", "id": "38557988"}, {"name": "Angelina Bleggi", "date": "08-30", "pos": "Post-Service Childcare", "id": "174162530"}, {"name": "Iliana Rosado", "date": "08-30", "pos": "Post-Service Childcare", "id": "44258881"}]}, {"loc": "WS", "dept": "Weekend Service", "team": "Band", "count": 2, "people": [{"name": "Hassan Sylvain", "date": "10-25", "pos": "Shadow", "id": "165026267"}, {"name": "Caleb Calderon", "date": "10-18", "pos": "Acoustic Guitar", "id": "195829308"}]}, {"loc": "WS", "dept": "Guest Services", "team": "Guest Services", "count": 2, "people": [{"name": "Madison Senecal", "date": "08-09", "pos": "New Here Tent", "id": "85708720"}, {"name": "Kathy Gach", "date": "08-02", "pos": "Greeter", "id": "177006857"}]}, {"loc": "WS", "dept": "Weekend Service", "team": "Worship", "count": 2, "people": [{"name": "Caleb Calderon", "date": "10-18", "pos": "Vocals", "id": "195829308"}, {"name": "Michael Reinhardt", "date": "10-11", "pos": "Worship Team Lead", "id": "158751975"}]}, {"loc": "WS", "dept": "Guest Services", "team": "Parking", "count": 1, "people": [{"name": "Spencer Graham", "date": "08-09", "pos": "Parking", "id": "8007332"}]}, {"loc": "WS", "dept": "Weekend Service", "team": "Production", "count": 1, "people": [{"name": "Carlos Vazquez", "date": "09-20", "pos": "FOH", "id": "65922403"}]}, {"loc": "WS", "dept": "Guest Services", "team": "Set Up Team", "count": 1, "people": [{"name": "Jeremy Frank", "date": "09-27", "pos": "Set up", "id": "201818491"}]}, {"loc": "WS", "dept": "Action Kids", "team": "Set-up Team", "count": 1, "people": [{"name": "Valeria Sanchez", "date": "08-30", "pos": "Set-up Team", "id": "127902510"}]}, {"loc": "WS", "dept": "Guest Services", "team": "Usher", "count": 1, "people": [{"name": "Jeremy Frank", "date": "09-27", "pos": "Usher", "id": "201818491"}]}]}}, "members": [{"loc": "HW", "dept": "Weekend Service", "team": "Band", "pos": "Lead Electric", "id": "194149357", "name": "Brandon Greaver", "firstDate": "2026-10-25", "addedDate": "2026-07-30", "status": "C", "served": 1, "planId": "92259115"}, {"loc": "HW", "dept": "Weekend Service", "team": "Band", "pos": "Bass Guitar", "id": "194207980", "name": "Tom Avalos", "firstDate": "2026-10-25", "addedDate": "2026-07-30", "status": "C", "served": 1, "planId": "92259115"}, {"loc": "HW", "dept": "Guest Services", "team": "Coach", "pos": "Coach", "id": "194028940", "name": "Iris Grant", "firstDate": "2026-10-25", "addedDate": "2026-10-21", "status": "C", "served": 0, "planId": "92151843"}, {"loc": "HW", "dept": "Guest Services", "team": "Connect", "pos": "Connect Lead", "id": "194028940", "name": "Iris Grant", "firstDate": "2026-10-25", "addedDate": "2026-10-21", "status": "C", "served": 0, "planId": "92151843"}, {"loc": "HW", "dept": "Guest Services", "team": "Prayer", "pos": "Prayer", "id": "81545328", "name": "Amanda Reynolds", "firstDate": "2026-10-25", "addedDate": "2026-10-07", "status": "C", "served": 1, "planId": "92151843"}, {"loc": "HW", "dept": "Guest Services", "team": "Prayer", "pos": "Prayer", "id": "198853607", "name": "Aura Lynn Rouse", "firstDate": "2026-10-25", "addedDate": "2026-08-05", "status": "C", "served": 1, "planId": "92151843"}, {"loc": "HW", "dept": "Guest Services", "team": "Prayer", "pos": "Prayer", "id": "195829308", "name": "Caleb Calderon", "firstDate": "2026-10-25", "addedDate": "2026-10-09", "status": "C", "served": 0, "planId": "92082626"}, {"loc": "HW", "dept": "Guest Services", "team": "Prayer", "pos": "Prayer", "id": "198855181", "name": "Emilio Lopez", "firstDate": "2026-10-25", "addedDate": "2026-10-09", "status": "C", "served": 0, "planId": "92082626"}, {"loc": "HW", "dept": "Weekend Service", "team": "Production", "pos": "Training", "id": "48862021", "name": "Aleisha McKeeby", "firstDate": "2026-10-25", "addedDate": "2026-10-20", "status": "C", "served": 0, "planId": "92259115"}, {"loc": "HW", "dept": "Guest Services", "team": "Ushers", "pos": "Usher", "id": "198857384", "name": "Sadrack Serelus", "firstDate": "2026-10-25", "addedDate": "2026-10-05", "status": "C", "served": 1, "planId": "92151843"}, {"loc": "SF", "dept": "Guest Services", "team": "Guest Services", "pos": "Connect Team*", "id": "194028940", "name": "Iris Grant", "firstDate": "2026-10-18", "addedDate": "2026-10-09", "status": "D", "served": 0, "planId": "92294193"}, {"loc": "SF", "dept": "Guest Services", "team": "Guest Services", "pos": "Safety*", "id": "94414614", "name": "Wilson McEachern", "firstDate": "2026-10-18", "addedDate": "2026-10-18", "status": "C", "served": 1, "planId": "92294193"}, {"loc": "SF", "dept": "Guest Services", "team": "Prayer Team", "pos": "Altar", "id": "31603266", "name": "Claudia Bucaro", "firstDate": "2026-10-18", "addedDate": "2026-09-30", "status": "C", "served": 0, "planId": "92294193"}, {"loc": "SF", "dept": "Action Kids", "team": "Pre-School", "pos": "Blue Room (Nursery)", "id": "179064791", "name": "Ashalei St. Amant", "firstDate": "2026-10-18", "addedDate": "2026-10-15", "status": "C", "served": 2, "planId": "92096943"}, {"loc": "SF", "dept": "Guest Services", "team": "Guest Services", "pos": "Greeter*", "id": "203431121", "name": "Brayden Stotler", "firstDate": "2026-10-11", "addedDate": "2026-10-11", "status": "C", "served": 0, "planId": "92294176"}, {"loc": "SF", "dept": "Guest Services", "team": "Guest Services", "pos": "Parking*", "id": "203430324", "name": "David Rouse", "firstDate": "2026-10-11", "addedDate": "2026-10-11", "status": "C", "served": 0, "planId": "92294176"}, {"loc": "SF", "dept": "Action Kids", "team": "Pre-School", "pos": "Red Room", "id": "157850990", "name": "Maria Francisco", "firstDate": "2026-10-11", "addedDate": "2026-10-05", "status": "C", "served": 0, "planId": "92096941"}, {"loc": "SF", "dept": "Guest Services", "team": "Guest Services", "pos": "Coach", "id": "31603266", "name": "Claudia Bucaro", "firstDate": "2026-10-04", "addedDate": "2026-10-04", "status": "C", "served": 0, "planId": "92294156"}, {"loc": "SF", "dept": "Guest Services", "team": "Guest Services", "pos": "Connect Team*", "id": "167760249", "name": "Maria Truong", "firstDate": "2026-10-04", "addedDate": "2026-10-04", "status": "C", "served": 2, "planId": "92294176"}, {"loc": "SF", "dept": "Guest Services", "team": "Guest Services", "pos": "Set Up*", "id": "38549074", "name": "William Centeno", "firstDate": "2026-10-04", "addedDate": "2026-09-26", "status": "U", "served": 1, "planId": "92294193"}, {"loc": "WP", "dept": "Weekend Service", "team": "Band", "pos": "Bass Guitar", "id": "39588378", "name": "Gabe Gomez", "firstDate": "2026-10-25", "addedDate": "2026-09-29", "status": "C", "served": 0, "planId": "91481065"}, {"loc": "WP", "dept": "Guest Services", "team": "Connect Team", "pos": "Connect Team", "id": "201714853", "name": "Kitty Handelsman", "firstDate": "2026-10-25", "addedDate": "2026-10-24", "status": "U", "served": 1, "planId": "92297705"}, {"loc": "WP", "dept": "Guest Services", "team": "Connect Team", "pos": "Golf Carts", "id": "98184295", "name": "Trevor Hussak", "firstDate": "2026-10-25", "addedDate": "2026-09-26", "status": "C", "served": 1, "planId": "92297705"}, {"loc": "WP", "dept": "Guest Services", "team": "Greeter Team", "pos": "Greeter Team", "id": "38615136", "name": "Alexis Springfield", "firstDate": "2026-10-25", "addedDate": "2026-10-20", "status": "C", "served": 1, "planId": "92297705"}, {"loc": "WP", "dept": "Guest Services", "team": "Greeter Team", "pos": "Greeter Team", "id": "51911081", "name": "Willy Maldonado", "firstDate": "2026-10-25", "addedDate": "2026-10-21", "status": "U", "served": 0, "planId": "92297705"}, {"loc": "WP", "dept": "Action Kids", "team": "Kids Preschool", "pos": "Shadow", "id": "143522788", "name": "Grayson Mellick", "firstDate": "2026-10-25", "addedDate": "2026-10-10", "status": "C", "served": 1, "planId": "92300122"}, {"loc": "WP", "dept": "Action Kids", "team": "Kids Preschool", "pos": "Purple Room", "id": "145252523", "name": "Sandy George", "firstDate": "2026-10-25", "addedDate": "2026-10-14", "status": "C", "served": 1, "planId": "92300122"}, {"loc": "WP", "dept": "Action Kids", "team": "Kids Theater", "pos": "Small Group Leader", "id": "70953710", "name": "Graham Varkey", "firstDate": "2026-10-25", "addedDate": "2026-10-14", "status": "C", "served": 1, "planId": "92300122"}, {"loc": "WP", "dept": "Guest Services", "team": "Parking Team", "pos": "Parking Team", "id": "191853749", "name": "Carlos Trott", "firstDate": "2026-10-25", "addedDate": "2026-10-21", "status": "C", "served": 0, "planId": "92297705"}, {"loc": "WP", "dept": "Guest Services", "team": "Parking Team", "pos": "Parking Team", "id": "97685477", "name": "Elijah Althof", "firstDate": "2026-10-25", "addedDate": "2026-10-25", "status": "U", "served": 0, "planId": "92297705"}, {"loc": "OV", "dept": "Weekend Service", "team": "Band", "pos": "Electric Guitar 2", "id": "38554468", "name": "Joe Mercado", "firstDate": "2026-10-25", "addedDate": "2026-08-20", "status": "C", "served": 2, "planId": "92148271"}, {"loc": "OV", "dept": "Action Kids", "team": "Preschool", "pos": "Blue Room", "id": "9617280", "name": "Lori Moon", "firstDate": "2026-10-25", "addedDate": "2026-10-22", "status": "C", "served": 1, "planId": "92233709"}, {"loc": "OV", "dept": "Weekend Service", "team": "Vocals", "pos": "Co-Worship Leader", "id": "38554468", "name": "Joe Mercado", "firstDate": "2026-10-25", "addedDate": "2026-10-25", "status": "C", "served": 1, "planId": "92148271"}, {"loc": "OV", "dept": "Action Kids", "team": "Preschool", "pos": "Blue Room Leader", "id": "122105868", "name": "Makenzie Mckernan", "firstDate": "2026-10-18", "addedDate": "2026-07-26", "status": "C", "served": 2, "planId": "92233709"}, {"loc": "OV", "dept": "Guest Services", "team": "Greeters", "pos": "Greeter Team", "id": "72131952", "name": "Alba Alonso", "firstDate": "2026-10-11", "addedDate": "2026-10-09", "status": "D", "served": 1, "planId": "92237542"}, {"loc": "OV", "dept": "Weekend Service", "team": "Production", "pos": "Service Coordinator", "id": "203135734", "name": "Kennedy Peters", "firstDate": "2026-10-04", "addedDate": "2026-09-27", "status": "C", "served": 2, "planId": "92148271"}, {"loc": "OV", "dept": "Action Kids", "team": "Theater", "pos": "Room Leader", "id": "38559271", "name": "David Welday", "firstDate": "2026-10-04", "addedDate": "2026-09-30", "status": "C", "served": 0, "planId": "92233709"}, {"loc": "OV", "dept": "Guest Services", "team": "Parking", "pos": "Parking Team Lead", "id": "60356433", "name": "David Howard", "firstDate": "2026-09-27", "addedDate": "2026-07-22", "status": "C", "served": 3, "planId": "92237542"}, {"loc": "OV", "dept": "Action Kids", "team": "Preschool", "pos": "Red Room", "id": "108560657", "name": "Alyssa Dumas", "firstDate": "2026-09-27", "addedDate": "2026-07-26", "status": "D", "served": 2, "planId": "92233709"}, {"loc": "OV", "dept": "Weekend Service", "team": "Band", "pos": "Drums", "id": "85616464", "name": "Lao Flores", "firstDate": "2026-09-13", "addedDate": "2026-08-20", "status": "C", "served": 1, "planId": "92148270"}, {"loc": "WS", "dept": "Weekend Service", "team": "Band", "pos": "Shadow", "id": "165026267", "name": "Hassan Sylvain", "firstDate": "2026-10-25", "addedDate": "2026-10-19", "status": "C", "served": 0, "planId": "92092980"}, {"loc": "WS", "dept": "Action Kids", "team": "Action Kids", "pos": "Blue Room", "id": "38551345", "name": "Kira Gold", "firstDate": "2026-10-18", "addedDate": "2026-10-16", "status": "U", "served": 1, "planId": "92094494"}, {"loc": "WS", "dept": "Action Kids", "team": "Action Kids", "pos": "Orange Room", "id": "38551346", "name": "Trish Gold", "firstDate": "2026-10-18", "addedDate": "2026-10-16", "status": "U", "served": 1, "planId": "92094494"}, {"loc": "WS", "dept": "Weekend Service", "team": "Band", "pos": "Acoustic Guitar", "id": "195829308", "name": "Caleb Calderon", "firstDate": "2026-10-18", "addedDate": "2026-10-13", "status": "C", "served": 0, "planId": "92092978"}, {"loc": "WS", "dept": "Weekend Service", "team": "Worship", "pos": "Vocals", "id": "195829308", "name": "Caleb Calderon", "firstDate": "2026-10-18", "addedDate": "2026-10-13", "status": "C", "served": 0, "planId": "92092978"}, {"loc": "WS", "dept": "Weekend Service", "team": "Worship", "pos": "Worship Team Lead", "id": "158751975", "name": "Michael Reinhardt", "firstDate": "2026-10-11", "addedDate": "2026-10-05", "status": "C", "served": 0, "planId": "92092971"}, {"loc": "WS", "dept": "Guest Services", "team": "Set Up Team", "pos": "Set up", "id": "201818491", "name": "Jeremy Frank", "firstDate": "2026-09-27", "addedDate": "2026-09-22", "status": "C", "served": 3, "planId": "92207624"}, {"loc": "WS", "dept": "Guest Services", "team": "Usher", "pos": "Usher", "id": "201818491", "name": "Jeremy Frank", "firstDate": "2026-09-27", "addedDate": "2026-09-22", "status": "C", "served": 3, "planId": "92207624"}, {"loc": "WS", "dept": "Weekend Service", "team": "Production", "pos": "FOH", "id": "65922403", "name": "Carlos Vazquez", "firstDate": "2026-09-20", "addedDate": "2026-08-18", "status": "C", "served": 1, "planId": "92092978"}, {"loc": "WS", "dept": "Action Kids", "team": "Action Kids", "pos": "Blue Room", "id": "38557988", "name": "Giulliana Soto", "firstDate": "2026-09-06", "addedDate": "2026-08-20", "status": "D", "served": 1, "planId": "92094495"}]};

const TH_JOINS_A: THJoinsHorizon = {"byLoc": {"ALL": {"total": 1478, "unique": 1229, "teamsCount": 91, "teams": []}, "HW": {"total": 299, "unique": 221, "teamsCount": 20, "teams": [{"loc": "HW", "dept": "Action Kids", "team": "Kids Preschool", "count": 37, "people": [{"name": "Meagan Fowler", "date": "10-11", "pos": "Red Room Leader", "id": "198867732"}, {"name": "Lilly Billingsley", "date": "10-04", "pos": "Orange Room Leader", "id": "111846785"}, {"name": "Jarumi Richardson", "date": "09-27", "pos": "Blue Room", "id": "198869227"}, {"name": "Maria Ladeveze", "date": "09-27", "pos": "Orange Room", "id": "198858715"}]}, {"loc": "HW", "dept": "Guest Services", "team": "Prayer", "count": 34, "people": [{"name": "Amanda Reynolds", "date": "10-25", "pos": "Prayer", "id": "81545328"}, {"name": "Aura Lynn Rouse", "date": "10-25", "pos": "Prayer", "id": "198853607"}, {"name": "Caleb Calderon", "date": "10-25", "pos": "Prayer", "id": "195829308"}, {"name": "Emilio Lopez", "date": "10-25", "pos": "Prayer", "id": "198855181"}]}, {"loc": "HW", "dept": "Action Kids", "team": "Kids Theater", "count": 32, "people": [{"name": "Ashley Brown", "date": "10-04", "pos": "Small Group Leader", "id": "195834070"}, {"name": "Avaleigh DiMolfetta", "date": "10-04", "pos": "Youth Production Helper", "id": "198864815"}, {"name": "Stephen Condon", "date": "10-04", "pos": "KT Youth Helper", "id": "198860316"}, {"name": "Alicia Hage", "date": "09-27", "pos": "Host", "id": "198853190"}]}, {"loc": "HW", "dept": "Guest Services", "team": "Greeters", "count": 28, "people": [{"name": "Shelby Freese", "date": "10-18", "pos": "Greeter", "id": "198869281"}, {"name": "Steffon Rush", "date": "10-18", "pos": "Greeter", "id": "78757640"}, {"name": "Rosa Hidalgo", "date": "10-04", "pos": "Greeter", "id": "162901974"}, {"name": "Aymette Davila", "date": "09-27", "pos": "Greeter", "id": "198858035"}]}, {"loc": "HW", "dept": "Guest Services", "team": "Connect", "count": 23, "people": [{"name": "Iris Grant", "date": "10-25", "pos": "Connect Lead", "id": "194028940"}, {"name": "Evan Wong", "date": "10-18", "pos": "Connect", "id": "136252521"}, {"name": "James Brown", "date": "10-11", "pos": "Connect Lead", "id": "198853210"}, {"name": "Kara Saghir", "date": "10-11", "pos": "Connect", "id": "198823297"}]}, {"loc": "HW", "dept": "Weekend Service", "team": "Vocals", "count": 23, "people": [{"name": "Caleb Calderon", "date": "10-25", "pos": "Mic 2", "id": "195829308"}, {"name": "Dan Marcos", "date": "10-25", "pos": "Mic 7", "id": "198853616"}, {"name": "Mysheala Atwater", "date": "10-25", "pos": "Mic 1", "id": "198854746"}, {"name": "Daniela Wieckhorst", "date": "10-18", "pos": "Mic 2", "id": "198856096"}]}, {"loc": "HW", "dept": "Weekend Service", "team": "Production", "count": 19, "people": [{"name": "Aleisha McKeeby", "date": "10-25", "pos": "Training", "id": "48862021"}, {"name": "Angelica Sharkey", "date": "10-18", "pos": "Graphics Operator", "id": "84576873"}, {"name": "Emmanuel Douge", "date": "10-18", "pos": "Resi Operator", "id": "195834281"}, {"name": "Isabella Salazar-Cab\u00e1n", "date": "10-18", "pos": "Lighting Operator", "id": "198692784"}]}, {"loc": "HW", "dept": "Guest Services", "team": "Ushers", "count": 16, "people": [{"name": "Sadrack Serelus", "date": "10-25", "pos": "Usher", "id": "198857384"}, {"name": "Steve Bonneau", "date": "10-11", "pos": "Usher", "id": "153958702"}, {"name": "Ashley Brown", "date": "10-04", "pos": "Usher", "id": "195834070"}, {"name": "Chet Siudak", "date": "09-13", "pos": "Usher Lead", "id": "198856426"}]}, {"loc": "HW", "dept": "Weekend Service", "team": "Band", "count": 15, "people": [{"name": "Brandon Greaver", "date": "10-25", "pos": "Lead Electric", "id": "194149357"}, {"name": "Tom Avalos", "date": "10-25", "pos": "Bass Guitar", "id": "194207980"}, {"name": "Austin Smith", "date": "10-18", "pos": "Drums", "id": "198853167"}, {"name": "Tomas (Tommy) Rosaly", "date": "10-18", "pos": "Bass Guitar", "id": "198855337"}]}, {"loc": "HW", "dept": "Action Kids", "team": "Kids Check-In", "count": 15, "people": [{"name": "Joshua Richardson", "date": "10-18", "pos": "Safety", "id": "198869223"}, {"name": "Ashley Ott", "date": "10-11", "pos": "Check-In", "id": "165794361"}, {"name": "Elly Harrington", "date": "09-27", "pos": "Check-In", "id": "195230816"}, {"name": "Leah Callahan", "date": "09-20", "pos": "Check-In", "id": "142733266"}]}, {"loc": "HW", "dept": "Guest Services", "team": "Parking", "count": 9, "people": [{"name": "Eddie Coba", "date": "10-11", "pos": "Parking", "id": "198865618"}, {"name": "David Chiles", "date": "09-20", "pos": "Parking Lead", "id": "198854109"}, {"name": "Justin Freese", "date": "09-20", "pos": "Parking", "id": "198853471"}, {"name": "Doug Bailey", "date": "09-13", "pos": "Parking", "id": "196310376"}]}, {"loc": "HW", "dept": "Guest Services", "team": "Safety", "count": 9, "people": [{"name": "Joshua Richardson", "date": "10-11", "pos": "Safety", "id": "198869223"}, {"name": "Harold Escobar", "date": "09-20", "pos": "Safety", "id": "195782057"}, {"name": "Ben Thomas", "date": "09-13", "pos": "Safety", "id": "198860116"}, {"name": "Christian Vale", "date": "09-13", "pos": "Safety Team Lead", "id": "52047858"}]}]}, "SF": {"total": 264, "unique": 229, "teamsCount": 13, "teams": [{"loc": "SF", "dept": "Guest Services", "team": "Guest Services", "count": 128, "people": [{"name": "Adrian Santiago", "date": "10-18", "pos": "Usher*", "id": "54622020"}, {"name": "Iris Grant", "date": "10-18", "pos": "Connect Team*", "id": "194028940"}, {"name": "Wilson McEachern", "date": "10-18", "pos": "Safety*", "id": "94414614"}, {"name": "Brayden Stotler", "date": "10-11", "pos": "Greeter*", "id": "203431121"}]}, {"loc": "SF", "dept": "Action Kids", "team": "Pre-School", "count": 60, "people": [{"name": "Ashalei St. Amant", "date": "10-18", "pos": "Blue Room (Nursery)", "id": "179064791"}, {"name": "Jackie Paradis", "date": "10-11", "pos": "Red Room", "id": "112239243"}, {"name": "Maria Francisco", "date": "10-11", "pos": "Red Room", "id": "157850990"}, {"name": "Taylor Mowder", "date": "10-11", "pos": "Red Room Leader", "id": "112315854"}]}, {"loc": "SF", "dept": "Guest Services", "team": "Prayer Team", "count": 20, "people": [{"name": "Claudia Bucaro", "date": "10-18", "pos": "Altar", "id": "31603266"}, {"name": "Bethanee Esqueda", "date": "09-20", "pos": "Altar", "id": "109177189"}, {"name": "Jennifer Torres", "date": "09-06", "pos": "Altar", "id": "155422717"}, {"name": "Micah Cecchetti", "date": "08-23", "pos": "Altar", "id": "152089858"}]}, {"loc": "SF", "dept": "Weekend Service", "team": "Production", "count": 14, "people": [{"name": "Gabriel B\u00e9langer", "date": "09-20", "pos": "Graphics 1", "id": "43533644"}, {"name": "Earles Lugo", "date": "08-23", "pos": "Service Coordinator", "id": "74132101"}, {"name": "Brandon Workman", "date": "08-16", "pos": "Video Director", "id": "153930465"}, {"name": "Emmalyn B\u00e9langer", "date": "08-09", "pos": "Lighting Operator", "id": "43533646"}]}, {"loc": "SF", "dept": "Action Kids", "team": "KT1 - 2nd", "count": 12, "people": [{"name": "Joab Telusma", "date": "09-20", "pos": "Small Group Leader", "id": "149008939"}, {"name": "AJ Patterson", "date": "08-30", "pos": "Small Group Leader", "id": "167811801"}, {"name": "Cirstin Simmons", "date": "08-30", "pos": "Small Group Leader", "id": "156183674"}, {"name": "Charleigh Priest", "date": "08-23", "pos": "Small Group Leader", "id": "135111798"}]}, {"loc": "SF", "dept": "Weekend Service", "team": "Vocals", "count": 7, "people": [{"name": "Natasha Price", "date": "10-18", "pos": "Frontline Vocals", "id": "38556092"}, {"name": "Joanna Ramos", "date": "09-20", "pos": "Frontline Vocals", "id": "47686424"}, {"name": "Zach Barnes", "date": "09-20", "pos": "Frontline Vocals", "id": "15987688"}, {"name": "Jennifer Torres", "date": "09-06", "pos": "Frontline Vocals", "id": "155422717"}]}, {"loc": "SF", "dept": "Weekend Service", "team": "Band", "count": 5, "people": [{"name": "Isaac Hunt", "date": "09-20", "pos": "Drums", "id": "112925416"}, {"name": "Zach Barnes", "date": "09-20", "pos": "Acoustic Guitar", "id": "15987688"}, {"name": "Jonah Drake", "date": "08-09", "pos": "Electric Guitar", "id": "38550260"}, {"name": "Miley Drake", "date": "07-26", "pos": "MD", "id": "38550263"}]}, {"loc": "SF", "dept": "Action Kids", "team": "Service Coordinator", "count": 5, "people": [{"name": "Aida Seda", "date": "08-23", "pos": "Service Coordinator", "id": "34008400"}, {"name": "Bella Hicks", "date": "07-19", "pos": "Service Coordinator", "id": "155422711"}, {"name": "Jennifer Cherry", "date": "07-19", "pos": "Service Coordinator", "id": "60353440"}, {"name": "Laurie Michelle Lee", "date": "07-19", "pos": "Service Coordinator", "id": "145942560"}]}, {"loc": "SF", "dept": "Weekend Service", "team": "Sunday Choir", "count": 5, "people": [{"name": "Meredith Barnes", "date": "08-23", "pos": "Choir", "id": "13351550"}, {"name": "Sarah Lindsey", "date": "08-23", "pos": "Choir", "id": "110382287"}, {"name": "Rosie Norelia", "date": "08-02", "pos": "Choir", "id": "85019791"}, {"name": "Antonio Torres", "date": "07-19", "pos": "Choir", "id": "176162360"}]}, {"loc": "SF", "dept": "Weekend Service", "team": "Leadership", "count": 3, "people": [{"name": "Zach Barnes", "date": "09-20", "pos": "Worship Team Lead", "id": "15987688"}, {"name": "Meredith Barnes", "date": "08-23", "pos": "Choir Mom", "id": "13351550"}, {"name": "Joe Derilus", "date": "07-19", "pos": "Worship Team Lead", "id": "44160328"}]}, {"loc": "SF", "dept": "Action Kids", "team": "KT2- 3rd, 4th, 5th", "count": 2, "people": [{"name": "Sarah King", "date": "07-26", "pos": "Room Leader", "id": "46543889"}, {"name": "Angel Donet", "date": "07-19", "pos": "Room Leader", "id": "57314196"}]}, {"loc": "SF", "dept": "Weekend Service", "team": "Sign Language", "count": 2, "people": [{"name": "Jantzen Young", "date": "08-16", "pos": "ASL", "id": "110684119"}, {"name": "Janet Diaz", "date": "07-19", "pos": "ASL", "id": "39839061"}]}]}, "WP": {"total": 587, "unique": 531, "teamsCount": 22, "teams": [{"loc": "WP", "dept": "Action Kids", "team": "Kids Preschool", "count": 134, "people": [{"name": "Grayson Mellick", "date": "10-25", "pos": "Shadow", "id": "143522788"}, {"name": "Sandy George", "date": "10-25", "pos": "Purple Room", "id": "145252523"}, {"name": "Madisyn Cheek", "date": "10-18", "pos": "Yellow Room", "id": "197729612"}, {"name": "Hudson Wiley", "date": "10-04", "pos": "Yellow Room", "id": "38559427"}]}, {"loc": "WP", "dept": "Guest Services", "team": "Greeter Team", "count": 108, "people": [{"name": "Alexis Springfield", "date": "10-25", "pos": "Greeter Team", "id": "38615136"}, {"name": "Willy Maldonado", "date": "10-25", "pos": "Greeter Team", "id": "51911081"}, {"name": "AJ Varn", "date": "10-18", "pos": "Greeter Team", "id": "58816843"}, {"name": "Darcey Varn", "date": "10-18", "pos": "Greeter Team", "id": "58816841"}]}, {"loc": "WP", "dept": "Guest Services", "team": "Connect Team", "count": 46, "people": [{"name": "Kitty Handelsman", "date": "10-25", "pos": "Connect Team", "id": "201714853"}, {"name": "Trevor Hussak", "date": "10-25", "pos": "Golf Carts", "id": "98184295"}, {"name": "Keyla Gonzalez", "date": "10-18", "pos": "Connect Team", "id": "83695663"}, {"name": "Victoria Turner", "date": "10-04", "pos": "Connect Team", "id": "33845810"}]}, {"loc": "WP", "dept": "Guest Services", "team": "Usher Team", "count": 46, "people": [{"name": "AJ Varn", "date": "10-18", "pos": "Usher", "id": "58816843"}, {"name": "Darcey Varn", "date": "10-18", "pos": "Usher", "id": "58816841"}, {"name": "Linzola Turner", "date": "10-04", "pos": "Usher", "id": "159099034"}, {"name": "Chris Heath-Morgan", "date": "09-27", "pos": "Usher", "id": "198177393"}]}, {"loc": "WP", "dept": "Action Kids", "team": "Kids Theater", "count": 38, "people": [{"name": "Graham Varkey", "date": "10-25", "pos": "Small Group Leader", "id": "70953710"}, {"name": "Noah Miranda", "date": "09-20", "pos": "Production/Tech", "id": "118662803"}, {"name": "Christa Riddlemoser", "date": "08-30", "pos": "Small Group Leader", "id": "199217392"}, {"name": "Marcus Hyatt", "date": "08-30", "pos": "Small Group Leader", "id": "124596914"}]}, {"loc": "WP", "dept": "Guest Services", "team": "Parking Team", "count": 36, "people": [{"name": "Carlos Trott", "date": "10-25", "pos": "Parking Team", "id": "191853749"}, {"name": "Elijah Althof", "date": "10-25", "pos": "Parking Team", "id": "97685477"}, {"name": "Elijah Springfield", "date": "10-25", "pos": "Parking Team", "id": "38615372"}, {"name": "Joseph LoPiparo", "date": "10-25", "pos": "Parking Team", "id": "109751109"}]}, {"loc": "WP", "dept": "Guest Services", "team": "Prayer Team", "count": 33, "people": [{"name": "Courtney Deck", "date": "09-06", "pos": "Altar Team", "id": "92912763"}, {"name": "Jaron Deck", "date": "09-06", "pos": "Altar Team", "id": "92985804"}, {"name": "Sierra Baker", "date": "09-06", "pos": "Intercessors", "id": "142346845"}, {"name": "Margaret Brennan", "date": "08-23", "pos": "Intercessors", "id": "44039485"}]}, {"loc": "WP", "dept": "Weekend Service", "team": "Choir-WP", "count": 27, "people": [{"name": "Adriana Marin", "date": "10-11", "pos": "Choir-Shadow", "id": "90557540"}, {"name": "Lori Robb", "date": "10-11", "pos": "Choir-Shadow", "id": "97615928"}, {"name": "Jesse Sizemore", "date": "09-20", "pos": "Choir-Shadow", "id": "182528882"}, {"name": "Aiden Gammons", "date": "09-13", "pos": "Choir-All Services", "id": "38551008"}]}, {"loc": "WP", "dept": "Guest Services", "team": "Safety Team", "count": 23, "people": [{"name": "Angel Valentin-Lopez", "date": "10-18", "pos": "Safety Team", "id": "167652969"}, {"name": "Jake Lavender", "date": "09-20", "pos": "Safety Team", "id": "4529721"}, {"name": "Randy Bishop", "date": "09-20", "pos": "Safety Team", "id": "32893197"}, {"name": "Dallas Moore", "date": "08-30", "pos": "Safety Team", "id": "36865000"}]}, {"loc": "WP", "dept": "Weekend Service", "team": "Production", "count": 18, "people": [{"name": "Trinity Feikert", "date": "10-25", "pos": "Service Coordinator - Shadow", "id": "97799687"}, {"name": "Abby Thomas", "date": "09-13", "pos": "Service Producer", "id": "9198084"}, {"name": "Stacey Bennett", "date": "09-13", "pos": "Stage Manager", "id": "103943652"}, {"name": "Adam Holden", "date": "08-02", "pos": "FOH", "id": "19984086"}]}, {"loc": "WP", "dept": "Guest Services", "team": "Admin Team", "count": 16, "people": [{"name": "Jasmin Byrd", "date": "09-06", "pos": "Admin Team", "id": "29986048"}, {"name": "Lenita McFeron", "date": "08-30", "pos": "Admin Team", "id": "135153418"}, {"name": "Virginia Lopez", "date": "08-16", "pos": "Admin Team", "id": "62728668"}, {"name": "Jacquelyn Brault", "date": "08-09", "pos": "Admin Team Lead", "id": "44505464"}]}, {"loc": "WP", "dept": "Guest Services", "team": "Hospitality Team", "count": 15, "people": [{"name": "Savanna Wolford", "date": "08-30", "pos": "Hospitality Team", "id": "167077312"}, {"name": "Amanda Gullett", "date": "08-02", "pos": "Hospitality Team", "id": "190199353"}, {"name": "Gabriel Lugo", "date": "07-26", "pos": "Hospitality Team", "id": "38553672"}, {"name": "Karly Harbin", "date": "07-26", "pos": "Hospitality Team", "id": "167571006"}]}]}, "OV": {"total": 202, "unique": 168, "teamsCount": 21, "teams": [{"loc": "OV", "dept": "Action Kids", "team": "Preschool", "count": 38, "people": [{"name": "Lori Moon", "date": "10-25", "pos": "Blue Room", "id": "9617280"}, {"name": "Makenzie Mckernan", "date": "10-18", "pos": "Blue Room Leader", "id": "122105868"}, {"name": "Alyssa Dumas", "date": "09-27", "pos": "Red Room", "id": "108560657"}, {"name": "Paxxtyn Kilgore", "date": "08-23", "pos": "Blue Room", "id": "105659027"}]}, {"loc": "OV", "dept": "Guest Services", "team": "Greeters", "count": 34, "people": [{"name": "Alba Alonso", "date": "10-11", "pos": "Greeter Team", "id": "72131952"}, {"name": "Wendy Silva", "date": "09-13", "pos": "Greeter Team", "id": "117213546"}, {"name": "Nicholas Patrylo", "date": "09-06", "pos": "Greeter Team", "id": "144157402"}, {"name": "Silvia Anderson", "date": "09-06", "pos": "Greeter Team", "id": "187785269"}]}, {"loc": "OV", "dept": "Weekend Service", "team": "Production", "count": 16, "people": [{"name": "Kennedy Peters", "date": "10-04", "pos": "Service Coordinator", "id": "203135734"}, {"name": "Jaime Morgan", "date": "09-06", "pos": "Photographer", "id": "149028586"}, {"name": "Aiden Dees", "date": "08-16", "pos": "Lighting Operator (Shadow)", "id": "101477745"}, {"name": "Aleah Cutshall", "date": "08-16", "pos": "FOH Operator", "id": "34438078"}]}, {"loc": "OV", "dept": "Weekend Service", "team": "Vocals", "count": 15, "people": [{"name": "Joe Mercado", "date": "10-25", "pos": "Co-Worship Leader", "id": "38554468"}, {"name": "Jaime Morgan", "date": "09-06", "pos": "Co-Worship Leader", "id": "149028586"}, {"name": "Lauren Spreen", "date": "08-30", "pos": "Vocalist", "id": "193731364"}, {"name": "Alyssa Hildebrand", "date": "08-23", "pos": "Vocalist", "id": "20333092"}]}, {"loc": "OV", "dept": "Action Kids", "team": "Theater", "count": 14, "people": [{"name": "David Welday", "date": "10-04", "pos": "Room Leader", "id": "38559271"}, {"name": "Sebastian Anderson", "date": "09-06", "pos": "Small Group Leader", "id": "196782689"}, {"name": "Daniel Middleton", "date": "08-16", "pos": "Room Leader", "id": "55991405"}, {"name": "Martin Miles", "date": "08-09", "pos": "DJ", "id": "195522783"}]}, {"loc": "OV", "dept": "Guest Services", "team": "Ushers", "count": 12, "people": [{"name": "Albert Quiroga", "date": "09-06", "pos": "Usher Team", "id": "99156927"}, {"name": "Aiden Dees", "date": "08-16", "pos": "Usher Team", "id": "101477745"}, {"name": "Bobby Brolliar", "date": "08-16", "pos": "Usher Team Lead", "id": "40683179"}, {"name": "Jorge Diaz", "date": "08-09", "pos": "Usher Team", "id": "180289741"}]}, {"loc": "OV", "dept": "Weekend Service", "team": "Band", "count": 11, "people": [{"name": "Joe Mercado", "date": "10-25", "pos": "Electric Guitar 2", "id": "38554468"}, {"name": "Lao Flores", "date": "09-13", "pos": "Drums", "id": "85616464"}, {"name": "Janna Harmer", "date": "08-30", "pos": "Keys", "id": "69107960"}, {"name": "Kevin Pagan", "date": "08-30", "pos": "Bass Guitar", "id": "159072009"}]}, {"loc": "OV", "dept": "Guest Services", "team": "Connect", "count": 9, "people": [{"name": "Diane Olson", "date": "08-30", "pos": "Connect Team", "id": "69900317"}, {"name": "Jessica Bonura", "date": "08-30", "pos": "Connect Team", "id": "91341962"}, {"name": "Massimo Bonura", "date": "08-30", "pos": "Connect Team", "id": "91341627"}, {"name": "Steven Olson", "date": "08-30", "pos": "Connect Team", "id": "69727167"}]}, {"loc": "OV", "dept": "Action Kids", "team": "Child Care", "count": 6, "people": [{"name": "Nayara Brenner", "date": "08-16", "pos": "Post-Service Childcare (12:30PM-2PM)", "id": "160438356"}, {"name": "Jenna Smith", "date": "07-19", "pos": "Pre-Service Childcare (6:15AM-8:15AM)", "id": "136321838"}, {"name": "Jocelyn Fletcher", "date": "07-19", "pos": "Post-Service Childcare (12:30PM-2PM)", "id": "97437997"}, {"name": "Kaitlyn Cothern", "date": "07-19", "pos": "Pre-Service Childcare (6:15AM-8:15AM)", "id": "109776437"}]}, {"loc": "OV", "dept": "Guest Services", "team": "Coaches", "count": 6, "people": [{"name": "Jarad Fletcher", "date": "08-09", "pos": "11:30 Coaches", "id": "107538061"}, {"name": "Glenis Graham", "date": "07-19", "pos": "10:00 Coaches", "id": "38551437"}, {"name": "Jeremiah Birch", "date": "07-19", "pos": "08:30 Coaches", "id": "125734304"}, {"name": "Kathryn Cordova", "date": "07-19", "pos": "11:30 Coaches", "id": "38549499"}]}, {"loc": "OV", "dept": "Guest Services", "team": "Hospitality", "count": 6, "people": [{"name": "Kiesha Hernandez", "date": "07-26", "pos": "Hospitality Team", "id": "143116865"}, {"name": "Talane Garmer", "date": "07-26", "pos": "Hospitality Team", "id": "77879635"}, {"name": "Audrey Knight", "date": "07-19", "pos": "Hospitality Team", "id": "90603331"}, {"name": "David Ashbourne", "date": "07-19", "pos": "Hospitality Team Lead", "id": "38547576"}]}, {"loc": "OV", "dept": "Guest Services", "team": "New Here", "count": 6, "people": [{"name": "David Scanlon", "date": "07-26", "pos": "New Here Team", "id": "38557290"}, {"name": "Hunter Bock", "date": "07-26", "pos": "New Here Team", "id": "38548213"}, {"name": "Jodi Goodroe", "date": "07-26", "pos": "New Here Team Lead", "id": "38803587"}, {"name": "Haley Williams", "date": "07-19", "pos": "New Here Team", "id": "38559491"}]}]}, "WS": {"total": 126, "unique": 102, "teamsCount": 15, "teams": [{"loc": "WS", "dept": "Action Kids", "team": "Action Kids", "count": 32, "people": [{"name": "Kira Gold", "date": "10-18", "pos": "Blue Room", "id": "38551345"}, {"name": "Trish Gold", "date": "10-18", "pos": "Orange Room", "id": "38551346"}, {"name": "Giulliana Soto", "date": "09-06", "pos": "Blue Room", "id": "38557988"}, {"name": "Miranda Gopal Deval", "date": "09-06", "pos": "Orange Room", "id": "198927606"}]}, {"loc": "WS", "dept": "Guest Services", "team": "Guest Services", "count": 20, "people": [{"name": "Belkis Gomes", "date": "08-16", "pos": "Greeter", "id": "36864612"}, {"name": "Chelsea Bender", "date": "08-16", "pos": "Connect Center", "id": "59543823"}, {"name": "Chelsea Graham", "date": "08-09", "pos": "Team Lead", "id": "7326558"}, {"name": "Madison Senecal", "date": "08-09", "pos": "New Here Tent", "id": "85708720"}]}, {"loc": "WS", "dept": "Guest Services", "team": "Usher", "count": 14, "people": [{"name": "Jeremy Frank", "date": "09-27", "pos": "Usher", "id": "201818491"}, {"name": "Albert Quiroga", "date": "07-26", "pos": "Usher", "id": "99156927"}, {"name": "Greg Pike", "date": "07-26", "pos": "Usher", "id": "83269515"}, {"name": "Steve Bonneau", "date": "07-26", "pos": "Usher", "id": "153958702"}]}, {"loc": "WS", "dept": "Guest Services", "team": "Parking", "count": 10, "people": [{"name": "Spencer Graham", "date": "08-09", "pos": "Parking", "id": "8007332"}, {"name": "Mark Gumble", "date": "08-02", "pos": "Parking", "id": "114817651"}, {"name": "Zach Nelson", "date": "07-26", "pos": "Parking", "id": "113653509"}, {"name": "Camron Smith", "date": "07-19", "pos": "Parking", "id": "195783631"}]}, {"loc": "WS", "dept": "Guest Services", "team": "Prayer Team", "count": 9, "people": [{"name": "Connie Martin", "date": "07-26", "pos": "Altar Team", "id": "16759823"}, {"name": "Jillian Iturriaga", "date": "07-26", "pos": "Altar Team", "id": "93529416"}, {"name": "Daryl Phillips", "date": "07-19", "pos": "Altar Team", "id": "45720294"}, {"name": "Holly Hagan", "date": "07-19", "pos": "Prayer Leader", "id": "35466737"}]}, {"loc": "WS", "dept": "Guest Services", "team": "Hospitality", "count": 7, "people": [{"name": "Yoly Torres", "date": "09-13", "pos": "Hospitality Team", "id": "34244597"}, {"name": "Traci Crowell", "date": "08-02", "pos": "Hospitality Team", "id": "119933277"}, {"name": "Dana Pike", "date": "07-26", "pos": "Hospitality Team", "id": "83269490"}, {"name": "Jillian Iturriaga", "date": "07-26", "pos": "Hospitality Team Leader", "id": "93529416"}]}, {"loc": "WS", "dept": "Guest Services", "team": "Set Up Team", "count": 7, "people": [{"name": "Jeremy Frank", "date": "09-27", "pos": "Set up", "id": "201818491"}, {"name": "Braxton Reynolds", "date": "07-19", "pos": "Set up", "id": "38556412"}, {"name": "Deborah Hoag", "date": "07-19", "pos": "Set up", "id": "46810620"}, {"name": "Gordon Boardway", "date": "07-19", "pos": "Set up", "id": "107700567"}]}, {"loc": "WS", "dept": "Guest Services", "team": "Safety", "count": 6, "people": [{"name": "TJ Hartmann", "date": "09-27", "pos": "Safety Team", "id": "11312166"}, {"name": "Jazz Rivera", "date": "08-16", "pos": "Safety Team", "id": "38556588"}, {"name": "Chris Crowell", "date": "08-02", "pos": "Safety Team Leader", "id": "119934531"}, {"name": "Danny Anderson", "date": "08-02", "pos": "Shield Team", "id": "132460924"}]}, {"loc": "WS", "dept": "Guest Services", "team": "Coach", "count": 4, "people": [{"name": "Bryan D. Moyer", "date": "07-19", "pos": "Coach", "id": "38554958"}, {"name": "Cheryl Moyer", "date": "07-19", "pos": "Coach", "id": "90955295"}, {"name": "Mandee Abdoun", "date": "07-19", "pos": "Coach", "id": "58466217"}, {"name": "Mo Abdoun", "date": "07-19", "pos": "Coach", "id": "77473156"}]}, {"loc": "WS", "dept": "Guest Services", "team": "Tear Down", "count": 4, "people": [{"name": "Chris Crowell", "date": "08-02", "pos": "Tear Down", "id": "119934531"}, {"name": "Traci Crowell", "date": "08-02", "pos": "Tear Down", "id": "119933277"}, {"name": "Jon Duren", "date": "07-19", "pos": "Tear Down", "id": "95398143"}, {"name": "Michelle Greene", "date": "07-19", "pos": "Tear Down", "id": "38551801"}]}, {"loc": "WS", "dept": "Action Kids", "team": "Child Care", "count": 3, "people": [{"name": "Giulliana Soto", "date": "09-06", "pos": "Post-Service Childcare", "id": "38557988"}, {"name": "Angelina Bleggi", "date": "08-30", "pos": "Post-Service Childcare", "id": "174162530"}, {"name": "Iliana Rosado", "date": "08-30", "pos": "Post-Service Childcare", "id": "44258881"}]}, {"loc": "WS", "dept": "Action Kids", "team": "Set-up Team", "count": 3, "people": [{"name": "Valeria Sanchez", "date": "08-30", "pos": "Set-up Team", "id": "127902510"}, {"name": "Blayden William Sanchez", "date": "07-19", "pos": "Set-up Team", "id": "197627223"}, {"name": "Braxton Reynolds", "date": "07-19", "pos": "Set-up Team lead", "id": "38556412"}]}]}}, "members": [{"loc": "HW", "dept": "Weekend Service", "team": "Band", "pos": "Lead Electric", "id": "194149357", "name": "Brandon Greaver", "firstDate": "2026-10-25", "addedDate": "2026-07-30", "status": "C", "served": 1, "planId": "92259115"}, {"loc": "HW", "dept": "Weekend Service", "team": "Band", "pos": "Bass Guitar", "id": "194207980", "name": "Tom Avalos", "firstDate": "2026-10-25", "addedDate": "2026-07-30", "status": "C", "served": 1, "planId": "92259115"}, {"loc": "HW", "dept": "Guest Services", "team": "Coach", "pos": "Coach", "id": "194028940", "name": "Iris Grant", "firstDate": "2026-10-25", "addedDate": "2026-10-21", "status": "C", "served": 0, "planId": "92151843"}, {"loc": "HW", "dept": "Guest Services", "team": "Connect", "pos": "Connect Lead", "id": "194028940", "name": "Iris Grant", "firstDate": "2026-10-25", "addedDate": "2026-10-21", "status": "C", "served": 0, "planId": "92151843"}, {"loc": "HW", "dept": "Guest Services", "team": "Prayer", "pos": "Prayer", "id": "81545328", "name": "Amanda Reynolds", "firstDate": "2026-10-25", "addedDate": "2026-10-07", "status": "C", "served": 1, "planId": "92151843"}, {"loc": "HW", "dept": "Guest Services", "team": "Prayer", "pos": "Prayer", "id": "198853607", "name": "Aura Lynn Rouse", "firstDate": "2026-10-25", "addedDate": "2026-08-05", "status": "C", "served": 1, "planId": "92151843"}, {"loc": "HW", "dept": "Guest Services", "team": "Prayer", "pos": "Prayer", "id": "195829308", "name": "Caleb Calderon", "firstDate": "2026-10-25", "addedDate": "2026-10-09", "status": "C", "served": 0, "planId": "92082626"}, {"loc": "HW", "dept": "Guest Services", "team": "Prayer", "pos": "Prayer", "id": "198855181", "name": "Emilio Lopez", "firstDate": "2026-10-25", "addedDate": "2026-10-09", "status": "C", "served": 0, "planId": "92082626"}, {"loc": "HW", "dept": "Weekend Service", "team": "Production", "pos": "Training", "id": "48862021", "name": "Aleisha McKeeby", "firstDate": "2026-10-25", "addedDate": "2026-10-20", "status": "C", "served": 0, "planId": "92259115"}, {"loc": "HW", "dept": "Guest Services", "team": "Ushers", "pos": "Usher", "id": "198857384", "name": "Sadrack Serelus", "firstDate": "2026-10-25", "addedDate": "2026-10-05", "status": "C", "served": 1, "planId": "92151843"}, {"loc": "SF", "dept": "Guest Services", "team": "Guest Services", "pos": "Usher*", "id": "54622020", "name": "Adrian Santiago", "firstDate": "2026-10-18", "addedDate": "2026-06-21", "status": "C", "served": 1, "planId": "92294193"}, {"loc": "SF", "dept": "Guest Services", "team": "Guest Services", "pos": "Connect Team*", "id": "194028940", "name": "Iris Grant", "firstDate": "2026-10-18", "addedDate": "2026-10-09", "status": "D", "served": 0, "planId": "92294193"}, {"loc": "SF", "dept": "Guest Services", "team": "Guest Services", "pos": "Safety*", "id": "94414614", "name": "Wilson McEachern", "firstDate": "2026-10-18", "addedDate": "2026-10-18", "status": "C", "served": 1, "planId": "92294193"}, {"loc": "SF", "dept": "Guest Services", "team": "Prayer Team", "pos": "Altar", "id": "31603266", "name": "Claudia Bucaro", "firstDate": "2026-10-18", "addedDate": "2026-09-30", "status": "C", "served": 0, "planId": "92294193"}, {"loc": "SF", "dept": "Action Kids", "team": "Pre-School", "pos": "Blue Room (Nursery)", "id": "179064791", "name": "Ashalei St. Amant", "firstDate": "2026-10-18", "addedDate": "2026-10-15", "status": "C", "served": 2, "planId": "92096943"}, {"loc": "SF", "dept": "Weekend Service", "team": "Vocals", "pos": "Frontline Vocals", "id": "38556092", "name": "Natasha Price", "firstDate": "2026-10-18", "addedDate": "2026-07-13", "status": "C", "served": 1, "planId": "91922140"}, {"loc": "SF", "dept": "Guest Services", "team": "Guest Services", "pos": "Greeter*", "id": "203431121", "name": "Brayden Stotler", "firstDate": "2026-10-11", "addedDate": "2026-10-11", "status": "C", "served": 0, "planId": "92294176"}, {"loc": "SF", "dept": "Guest Services", "team": "Guest Services", "pos": "Parking*", "id": "203430324", "name": "David Rouse", "firstDate": "2026-10-11", "addedDate": "2026-10-11", "status": "C", "served": 0, "planId": "92294176"}, {"loc": "SF", "dept": "Action Kids", "team": "Pre-School", "pos": "Red Room", "id": "112239243", "name": "Jackie Paradis", "firstDate": "2026-10-11", "addedDate": "2026-05-13", "status": "C", "served": 1, "planId": "92096943"}, {"loc": "SF", "dept": "Action Kids", "team": "Pre-School", "pos": "Red Room", "id": "157850990", "name": "Maria Francisco", "firstDate": "2026-10-11", "addedDate": "2026-10-05", "status": "C", "served": 0, "planId": "92096941"}, {"loc": "WP", "dept": "Weekend Service", "team": "Band", "pos": "Bass Guitar", "id": "39588378", "name": "Gabe Gomez", "firstDate": "2026-10-25", "addedDate": "2026-09-29", "status": "C", "served": 0, "planId": "91481065"}, {"loc": "WP", "dept": "Guest Services", "team": "Connect Team", "pos": "Connect Team", "id": "201714853", "name": "Kitty Handelsman", "firstDate": "2026-10-25", "addedDate": "2026-10-24", "status": "U", "served": 1, "planId": "92297705"}, {"loc": "WP", "dept": "Guest Services", "team": "Connect Team", "pos": "Golf Carts", "id": "98184295", "name": "Trevor Hussak", "firstDate": "2026-10-25", "addedDate": "2026-09-26", "status": "C", "served": 1, "planId": "92297705"}, {"loc": "WP", "dept": "Guest Services", "team": "Greeter Team", "pos": "Greeter Team", "id": "38615136", "name": "Alexis Springfield", "firstDate": "2026-10-25", "addedDate": "2026-10-20", "status": "C", "served": 1, "planId": "92297705"}, {"loc": "WP", "dept": "Guest Services", "team": "Greeter Team", "pos": "Greeter Team", "id": "51911081", "name": "Willy Maldonado", "firstDate": "2026-10-25", "addedDate": "2026-10-21", "status": "U", "served": 0, "planId": "92297705"}, {"loc": "WP", "dept": "Action Kids", "team": "Kids Preschool", "pos": "Shadow", "id": "143522788", "name": "Grayson Mellick", "firstDate": "2026-10-25", "addedDate": "2026-10-10", "status": "C", "served": 1, "planId": "92300122"}, {"loc": "WP", "dept": "Action Kids", "team": "Kids Preschool", "pos": "Purple Room", "id": "145252523", "name": "Sandy George", "firstDate": "2026-10-25", "addedDate": "2026-10-14", "status": "C", "served": 1, "planId": "92300122"}, {"loc": "WP", "dept": "Action Kids", "team": "Kids Theater", "pos": "Small Group Leader", "id": "70953710", "name": "Graham Varkey", "firstDate": "2026-10-25", "addedDate": "2026-10-14", "status": "C", "served": 1, "planId": "92300122"}, {"loc": "WP", "dept": "Guest Services", "team": "Parking Team", "pos": "Parking Team", "id": "191853749", "name": "Carlos Trott", "firstDate": "2026-10-25", "addedDate": "2026-10-21", "status": "C", "served": 0, "planId": "92297705"}, {"loc": "WP", "dept": "Guest Services", "team": "Parking Team", "pos": "Parking Team", "id": "97685477", "name": "Elijah Althof", "firstDate": "2026-10-25", "addedDate": "2026-10-25", "status": "U", "served": 0, "planId": "92297705"}, {"loc": "OV", "dept": "Weekend Service", "team": "Band", "pos": "Electric Guitar 2", "id": "38554468", "name": "Joe Mercado", "firstDate": "2026-10-25", "addedDate": "2026-08-20", "status": "C", "served": 2, "planId": "92148271"}, {"loc": "OV", "dept": "Action Kids", "team": "Preschool", "pos": "Blue Room", "id": "9617280", "name": "Lori Moon", "firstDate": "2026-10-25", "addedDate": "2026-10-22", "status": "C", "served": 1, "planId": "92233709"}, {"loc": "OV", "dept": "Weekend Service", "team": "Vocals", "pos": "Co-Worship Leader", "id": "38554468", "name": "Joe Mercado", "firstDate": "2026-10-25", "addedDate": "2026-10-25", "status": "C", "served": 1, "planId": "92148271"}, {"loc": "OV", "dept": "Action Kids", "team": "Preschool", "pos": "Blue Room Leader", "id": "122105868", "name": "Makenzie Mckernan", "firstDate": "2026-10-18", "addedDate": "2026-07-26", "status": "C", "served": 2, "planId": "92233709"}, {"loc": "OV", "dept": "Guest Services", "team": "Greeters", "pos": "Greeter Team", "id": "72131952", "name": "Alba Alonso", "firstDate": "2026-10-11", "addedDate": "2026-10-09", "status": "D", "served": 1, "planId": "92237542"}, {"loc": "OV", "dept": "Weekend Service", "team": "Production", "pos": "Service Coordinator", "id": "203135734", "name": "Kennedy Peters", "firstDate": "2026-10-04", "addedDate": "2026-09-27", "status": "C", "served": 2, "planId": "92148271"}, {"loc": "OV", "dept": "Action Kids", "team": "Theater", "pos": "Room Leader", "id": "38559271", "name": "David Welday", "firstDate": "2026-10-04", "addedDate": "2026-09-30", "status": "C", "served": 0, "planId": "92233709"}, {"loc": "OV", "dept": "Guest Services", "team": "Parking", "pos": "Parking Team Lead", "id": "60356433", "name": "David Howard", "firstDate": "2026-09-27", "addedDate": "2026-07-22", "status": "C", "served": 3, "planId": "92237542"}, {"loc": "OV", "dept": "Action Kids", "team": "Preschool", "pos": "Red Room", "id": "108560657", "name": "Alyssa Dumas", "firstDate": "2026-09-27", "addedDate": "2026-07-26", "status": "D", "served": 2, "planId": "92233709"}, {"loc": "OV", "dept": "Weekend Service", "team": "Band", "pos": "Drums", "id": "85616464", "name": "Lao Flores", "firstDate": "2026-09-13", "addedDate": "2026-08-20", "status": "C", "served": 1, "planId": "92148270"}, {"loc": "WS", "dept": "Weekend Service", "team": "Band", "pos": "Shadow", "id": "165026267", "name": "Hassan Sylvain", "firstDate": "2026-10-25", "addedDate": "2026-10-19", "status": "C", "served": 0, "planId": "92092980"}, {"loc": "WS", "dept": "Action Kids", "team": "Action Kids", "pos": "Blue Room", "id": "38551345", "name": "Kira Gold", "firstDate": "2026-10-18", "addedDate": "2026-10-16", "status": "U", "served": 1, "planId": "92094494"}, {"loc": "WS", "dept": "Action Kids", "team": "Action Kids", "pos": "Orange Room", "id": "38551346", "name": "Trish Gold", "firstDate": "2026-10-18", "addedDate": "2026-10-16", "status": "U", "served": 1, "planId": "92094494"}, {"loc": "WS", "dept": "Weekend Service", "team": "Band", "pos": "Acoustic Guitar", "id": "195829308", "name": "Caleb Calderon", "firstDate": "2026-10-18", "addedDate": "2026-10-13", "status": "C", "served": 0, "planId": "92092978"}, {"loc": "WS", "dept": "Weekend Service", "team": "Worship", "pos": "Vocals", "id": "195829308", "name": "Caleb Calderon", "firstDate": "2026-10-18", "addedDate": "2026-10-13", "status": "C", "served": 0, "planId": "92092978"}, {"loc": "WS", "dept": "Weekend Service", "team": "Worship", "pos": "Worship Team Lead", "id": "158751975", "name": "Michael Reinhardt", "firstDate": "2026-10-11", "addedDate": "2026-10-05", "status": "C", "served": 0, "planId": "92092971"}, {"loc": "WS", "dept": "Guest Services", "team": "Safety", "pos": "Safety Team", "id": "11312166", "name": "TJ Hartmann", "firstDate": "2026-09-27", "addedDate": "2026-07-15", "status": "D", "served": 1, "planId": "92207624"}, {"loc": "WS", "dept": "Guest Services", "team": "Set Up Team", "pos": "Set up", "id": "201818491", "name": "Jeremy Frank", "firstDate": "2026-09-27", "addedDate": "2026-09-22", "status": "C", "served": 3, "planId": "92207624"}, {"loc": "WS", "dept": "Guest Services", "team": "Usher", "pos": "Usher", "id": "201818491", "name": "Jeremy Frank", "firstDate": "2026-09-27", "addedDate": "2026-09-22", "status": "C", "served": 3, "planId": "92207624"}, {"loc": "WS", "dept": "Weekend Service", "team": "Production", "pos": "FOH", "id": "65922403", "name": "Carlos Vazquez", "firstDate": "2026-09-20", "addedDate": "2026-08-18", "status": "C", "served": 1, "planId": "92092978"}]};

const TH_INACTIVE: { summary: Record<LocCode, { rosterTotal: number; active30d: number; d30_59: number; d60_89: number; d90_plus: number; d90_sched: number; d90_unsched: number; teamBreakdown: InactiveTeamRow[] }>; members: InactiveMemberRow[] } = {"summary": {"ALL": {"rosterTotal": 2067, "active30d": 1083, "d30_59": 143, "d60_89": 82, "d90_plus": 759, "d90_sched": 283, "d90_unsched": 476, "teamBreakdown": []}, "HW": {"rosterTotal": 283, "active30d": 191, "d30_59": 10, "d60_89": 3, "d90_plus": 79, "d90_sched": 59, "d90_unsched": 20, "teamBreakdown": [{"teamId": "7397659", "loc": "HW", "dept": "Guest Services", "team": "Prayer", "roster": 47, "total": 47, "active30d": 32, "d30_59": 1, "d60_89": 0, "d90_plus": 14}, {"teamId": "7407880", "loc": "HW", "dept": "Weekend Service", "team": "Vocals", "roster": 39, "total": 39, "active30d": 22, "d30_59": 1, "d60_89": 0, "d90_plus": 16}, {"teamId": "7407882", "loc": "HW", "dept": "Weekend Service", "team": "Production", "roster": 34, "total": 34, "active30d": 17, "d30_59": 1, "d60_89": 0, "d90_plus": 16}, {"teamId": "7397645", "loc": "HW", "dept": "Guest Services", "team": "Greeters", "roster": 33, "total": 33, "active30d": 24, "d30_59": 1, "d60_89": 0, "d90_plus": 8}, {"teamId": "7441901", "loc": "HW", "dept": "Action Kids", "team": "Kids Theater", "roster": 29, "total": 29, "active30d": 21, "d30_59": 2, "d60_89": 1, "d90_plus": 5}, {"teamId": "7441903", "loc": "HW", "dept": "Action Kids", "team": "Kids Preschool", "roster": 29, "total": 29, "active30d": 24, "d30_59": 2, "d60_89": 1, "d90_plus": 2}, {"teamId": "7397665", "loc": "HW", "dept": "Guest Services", "team": "Connect", "roster": 26, "total": 26, "active30d": 17, "d30_59": 1, "d60_89": 0, "d90_plus": 8}, {"teamId": "7407878", "loc": "HW", "dept": "Weekend Service", "team": "Band", "roster": 23, "total": 23, "active30d": 16, "d30_59": 1, "d60_89": 0, "d90_plus": 6}, {"teamId": "7397647", "loc": "HW", "dept": "Guest Services", "team": "Ushers", "roster": 16, "total": 16, "active30d": 14, "d30_59": 0, "d60_89": 0, "d90_plus": 2}, {"teamId": "7397649", "loc": "HW", "dept": "Guest Services", "team": "Safety", "roster": 13, "total": 13, "active30d": 7, "d30_59": 0, "d60_89": 0, "d90_plus": 6}, {"teamId": "7397661", "loc": "HW", "dept": "Guest Services", "team": "Coach", "roster": 11, "total": 11, "active30d": 7, "d30_59": 1, "d60_89": 0, "d90_plus": 3}, {"teamId": "7397648", "loc": "HW", "dept": "Guest Services", "team": "Parking", "roster": 11, "total": 11, "active30d": 8, "d30_59": 0, "d60_89": 0, "d90_plus": 3}, {"teamId": "7397646", "loc": "HW", "dept": "Guest Services", "team": "Hospitality", "roster": 10, "total": 10, "active30d": 6, "d30_59": 2, "d60_89": 0, "d90_plus": 2}, {"teamId": "7441902", "loc": "HW", "dept": "Action Kids", "team": "Kids Check-In", "roster": 10, "total": 10, "active30d": 8, "d30_59": 1, "d60_89": 0, "d90_plus": 1}, {"teamId": "7484446", "loc": "HW", "dept": "Weekend Service", "team": "Experience Team Devo", "roster": 8, "total": 8, "active30d": 3, "d30_59": 1, "d60_89": 0, "d90_plus": 4}, {"teamId": "7441954", "loc": "HW", "dept": "Action Kids", "team": "Service Coordinator", "roster": 6, "total": 6, "active30d": 6, "d30_59": 0, "d60_89": 0, "d90_plus": 0}, {"teamId": "7407884", "loc": "HW", "dept": "Weekend Service", "team": "Photo/Video", "roster": 5, "total": 5, "active30d": 4, "d30_59": 1, "d60_89": 0, "d90_plus": 0}, {"teamId": "7446445", "loc": "HW", "dept": "Weekend Service", "team": "Communicators", "roster": 4, "total": 4, "active30d": 0, "d30_59": 0, "d60_89": 0, "d90_plus": 4}, {"teamId": "7460685", "loc": "HW", "dept": "Action Kids", "team": "Staff Childcare 7 AM", "roster": 4, "total": 4, "active30d": 1, "d30_59": 0, "d60_89": 1, "d90_plus": 2}, {"teamId": "7397667", "loc": "HW", "dept": "Guest Services", "team": "Admin", "roster": 3, "total": 3, "active30d": 0, "d30_59": 1, "d60_89": 0, "d90_plus": 2}, {"teamId": "7460636", "loc": "HW", "dept": "Action Kids", "team": "Setup Team", "roster": 2, "total": 2, "active30d": 1, "d30_59": 0, "d60_89": 0, "d90_plus": 1}, {"teamId": "7442427", "loc": "HW", "dept": "Weekend Service", "team": "Worship Development", "roster": 1, "total": 1, "active30d": 0, "d30_59": 0, "d60_89": 0, "d90_plus": 1}]}, "SF": {"rosterTotal": 350, "active30d": 162, "d30_59": 39, "d60_89": 10, "d90_plus": 139, "d90_sched": 52, "d90_unsched": 87, "teamBreakdown": [{"teamId": "2730751", "loc": "SF", "dept": "Guest Services", "team": "Guest Services", "roster": 178, "total": 178, "active30d": 86, "d30_59": 19, "d60_89": 9, "d90_plus": 64}, {"teamId": "2727558", "loc": "SF", "dept": "Action Kids", "team": "Pre-School", "roster": 102, "total": 102, "active30d": 51, "d30_59": 10, "d60_89": 0, "d90_plus": 41}, {"teamId": "5805841", "loc": "SF", "dept": "Weekend Service", "team": "Sunday Choir", "roster": 32, "total": 32, "active30d": 6, "d30_59": 5, "d60_89": 1, "d90_plus": 20}, {"teamId": "3035013", "loc": "SF", "dept": "Guest Services", "team": "Prayer Team", "roster": 29, "total": 29, "active30d": 16, "d30_59": 2, "d60_89": 1, "d90_plus": 10}, {"teamId": "2731291", "loc": "SF", "dept": "Weekend Service", "team": "Vocals", "roster": 27, "total": 27, "active30d": 4, "d30_59": 4, "d60_89": 0, "d90_plus": 19}, {"teamId": "2727553", "loc": "SF", "dept": "Action Kids", "team": "KT1 - 2nd", "roster": 27, "total": 27, "active30d": 5, "d30_59": 5, "d60_89": 1, "d90_plus": 16}, {"teamId": "2731295", "loc": "SF", "dept": "Weekend Service", "team": "Production", "roster": 26, "total": 26, "active30d": 9, "d30_59": 5, "d60_89": 0, "d90_plus": 12}, {"teamId": "3021194", "loc": "SF", "dept": "Guest Services", "team": "Events Team", "roster": 23, "total": 23, "active30d": 0, "d30_59": 0, "d60_89": 0, "d90_plus": 23}, {"teamId": "4691853", "loc": "SF", "dept": "Weekend Service", "team": "Leadership", "roster": 20, "total": 20, "active30d": 2, "d30_59": 0, "d60_89": 0, "d90_plus": 18}, {"teamId": "4487249", "loc": "SF", "dept": "Action Kids", "team": "KT2- 3rd, 4th, 5th", "roster": 20, "total": 20, "active30d": 3, "d30_59": 4, "d60_89": 0, "d90_plus": 13}, {"teamId": "2727554", "loc": "SF", "dept": "Action Kids", "team": "Service Coordinator", "roster": 14, "total": 14, "active30d": 6, "d30_59": 1, "d60_89": 0, "d90_plus": 7}, {"teamId": "2731290", "loc": "SF", "dept": "Weekend Service", "team": "Band", "roster": 10, "total": 10, "active30d": 2, "d30_59": 3, "d60_89": 0, "d90_plus": 5}, {"teamId": "5558324", "loc": "SF", "dept": "Weekend Service", "team": "Host", "roster": 8, "total": 8, "active30d": 0, "d30_59": 0, "d60_89": 0, "d90_plus": 8}, {"teamId": "5660347", "loc": "SF", "dept": "Weekend Service", "team": "Sign Language", "roster": 7, "total": 7, "active30d": 1, "d30_59": 0, "d60_89": 1, "d90_plus": 5}, {"teamId": "6896708", "loc": "SF", "dept": "Weekend Service", "team": "New Team Buddy", "roster": 6, "total": 6, "active30d": 1, "d30_59": 0, "d60_89": 1, "d90_plus": 4}, {"teamId": "2731293", "loc": "SF", "dept": "Weekend Service", "team": "Guest Services", "roster": 5, "total": 5, "active30d": 0, "d30_59": 0, "d60_89": 0, "d90_plus": 5}, {"teamId": "2731294", "loc": "SF", "dept": "Weekend Service", "team": "Prayer Team", "roster": 3, "total": 3, "active30d": 0, "d30_59": 0, "d60_89": 0, "d90_plus": 3}]}, "WP": {"rosterTotal": 1164, "active30d": 509, "d30_59": 69, "d60_89": 47, "d90_plus": 539, "d90_sched": 119, "d90_unsched": 420, "teamBreakdown": [{"teamId": "3189428", "loc": "WP", "dept": "Action Kids", "team": "Kids Preschool", "roster": 425, "total": 425, "active30d": 157, "d30_59": 45, "d60_89": 19, "d90_plus": 204}, {"teamId": "5381608", "loc": "WP", "dept": "Guest Services", "team": "Greeter Team", "roster": 244, "total": 244, "active30d": 116, "d30_59": 31, "d60_89": 4, "d90_plus": 93}, {"teamId": "3189427", "loc": "WP", "dept": "Action Kids", "team": "Kids Theater", "roster": 121, "total": 121, "active30d": 36, "d30_59": 8, "d60_89": 6, "d90_plus": 71}, {"teamId": "5381484", "loc": "WP", "dept": "Guest Services", "team": "Connect Team", "roster": 100, "total": 100, "active30d": 52, "d30_59": 10, "d60_89": 4, "d90_plus": 34}, {"teamId": "5381604", "loc": "WP", "dept": "Guest Services", "team": "Usher Team", "roster": 89, "total": 89, "active30d": 48, "d30_59": 6, "d60_89": 0, "d90_plus": 35}, {"teamId": "5381563", "loc": "WP", "dept": "Guest Services", "team": "Parking Team", "roster": 88, "total": 88, "active30d": 31, "d30_59": 10, "d60_89": 3, "d90_plus": 44}, {"teamId": "3255619", "loc": "WP", "dept": "Weekend Service", "team": "Production", "roster": 73, "total": 73, "active30d": 19, "d30_59": 12, "d60_89": 5, "d90_plus": 37}, {"teamId": "3247256", "loc": "WP", "dept": "Guest Services", "team": "Prayer Team", "roster": 62, "total": 62, "active30d": 35, "d30_59": 4, "d60_89": 1, "d90_plus": 22}, {"teamId": "5381669", "loc": "WP", "dept": "Guest Services", "team": "Safety Team", "roster": 55, "total": 55, "active30d": 25, "d30_59": 1, "d60_89": 3, "d90_plus": 26}, {"teamId": "3189426", "loc": "WP", "dept": "Action Kids", "team": "Kids Check-In", "roster": 47, "total": 47, "active30d": 12, "d30_59": 6, "d60_89": 3, "d90_plus": 26}, {"teamId": "3255623", "loc": "WP", "dept": "Weekend Service", "team": "Video Production", "roster": 33, "total": 33, "active30d": 7, "d30_59": 4, "d60_89": 3, "d90_plus": 19}, {"teamId": "3189425", "loc": "WP", "dept": "Action Kids", "team": "Green Room", "roster": 29, "total": 29, "active30d": 9, "d30_59": 4, "d60_89": 2, "d90_plus": 14}, {"teamId": "5603935", "loc": "WP", "dept": "Weekend Service", "team": "WP Ensemble", "roster": 27, "total": 27, "active30d": 8, "d30_59": 3, "d60_89": 1, "d90_plus": 15}, {"teamId": "5381482", "loc": "WP", "dept": "Guest Services", "team": "Hospitality Team", "roster": 27, "total": 27, "active30d": 19, "d30_59": 0, "d60_89": 0, "d90_plus": 8}, {"teamId": "3255624", "loc": "WP", "dept": "Weekend Service", "team": "Vocals", "roster": 24, "total": 24, "active30d": 4, "d30_59": 4, "d60_89": 4, "d90_plus": 12}, {"teamId": "4549356", "loc": "WP", "dept": "Weekend Service", "team": "SongFest", "roster": 23, "total": 23, "active30d": 8, "d30_59": 3, "d60_89": 2, "d90_plus": 10}, {"teamId": "5675025", "loc": "WP", "dept": "Guest Services", "team": "Admin Team", "roster": 23, "total": 23, "active30d": 18, "d30_59": 1, "d60_89": 2, "d90_plus": 2}, {"teamId": "3255620", "loc": "WP", "dept": "Weekend Service", "team": "Band", "roster": 17, "total": 17, "active30d": 0, "d30_59": 2, "d60_89": 5, "d90_plus": 10}, {"teamId": "3255621", "loc": "WP", "dept": "Weekend Service", "team": "WP Photo & Video", "roster": 17, "total": 17, "active30d": 5, "d30_59": 2, "d60_89": 2, "d90_plus": 8}, {"teamId": "7023455", "loc": "WP", "dept": "Action Kids", "team": "Staff", "roster": 15, "total": 15, "active30d": 1, "d30_59": 3, "d60_89": 1, "d90_plus": 10}, {"teamId": "7348739", "loc": "WP", "dept": "Weekend Service", "team": "Mic Assignments", "roster": 13, "total": 13, "active30d": 2, "d30_59": 3, "d60_89": 3, "d90_plus": 5}, {"teamId": "3908024", "loc": "WP", "dept": "Guest Services", "team": "Environment Team", "roster": 12, "total": 12, "active30d": 6, "d30_59": 0, "d60_89": 1, "d90_plus": 5}, {"teamId": "5744266", "loc": "WP", "dept": "Guest Services", "team": "Coach - Guest Services", "roster": 12, "total": 12, "active30d": 12, "d30_59": 0, "d60_89": 0, "d90_plus": 0}, {"teamId": "4931841", "loc": "WP", "dept": "Guest Services", "team": "Spanish Translation Team", "roster": 9, "total": 9, "active30d": 5, "d30_59": 0, "d60_89": 0, "d90_plus": 4}, {"teamId": "5616018", "loc": "WP", "dept": "Weekend Service", "team": "Audio", "roster": 8, "total": 8, "active30d": 2, "d30_59": 0, "d60_89": 1, "d90_plus": 5}, {"teamId": "5237880", "loc": "WP", "dept": "Action Kids", "team": "Service Coordinator", "roster": 8, "total": 8, "active30d": 5, "d30_59": 2, "d60_89": 0, "d90_plus": 1}, {"teamId": "7327706", "loc": "WP", "dept": "Weekend Service", "team": "Action Worship", "roster": 5, "total": 5, "active30d": 0, "d30_59": 2, "d60_89": 1, "d90_plus": 2}, {"teamId": "3833097", "loc": "WP", "dept": "Weekend Service", "team": "Sunday Worship Support", "roster": 3, "total": 3, "active30d": 1, "d30_59": 2, "d60_89": 0, "d90_plus": 0}, {"teamId": "7191790", "loc": "WP", "dept": "Guest Services", "team": "Care Coach- Guest Services", "roster": 2, "total": 2, "active30d": 0, "d30_59": 0, "d60_89": 2, "d90_plus": 0}]}, "OV": {"rosterTotal": 365, "active30d": 144, "d30_59": 25, "d60_89": 19, "d90_plus": 177, "d90_sched": 50, "d90_unsched": 127, "teamBreakdown": [{"teamId": "1908044", "loc": "OV", "dept": "Action Kids", "team": "Preschool", "roster": 96, "total": 96, "active30d": 35, "d30_59": 10, "d60_89": 6, "d90_plus": 45}, {"teamId": "4726438", "loc": "OV", "dept": "Action Kids", "team": "Set-up Team", "roster": 59, "total": 59, "active30d": 0, "d30_59": 21, "d60_89": 6, "d90_plus": 32}, {"teamId": "7340621", "loc": "OV", "dept": "Guest Services", "team": "Greeters", "roster": 53, "total": 53, "active30d": 30, "d30_59": 9, "d60_89": 3, "d90_plus": 11}, {"teamId": "1908009", "loc": "OV", "dept": "Weekend Service", "team": "Production", "roster": 46, "total": 46, "active30d": 10, "d30_59": 8, "d60_89": 2, "d90_plus": 26}, {"teamId": "5078208", "loc": "OV", "dept": "Action Kids", "team": "Theater", "roster": 45, "total": 45, "active30d": 11, "d30_59": 8, "d60_89": 4, "d90_plus": 22}, {"teamId": "1908015", "loc": "OV", "dept": "Weekend Service", "team": "Vocals", "roster": 29, "total": 29, "active30d": 12, "d30_59": 2, "d60_89": 5, "d90_plus": 10}, {"teamId": "7340625", "loc": "OV", "dept": "Guest Services", "team": "Ushers", "roster": 25, "total": 25, "active30d": 12, "d30_59": 4, "d60_89": 2, "d90_plus": 7}, {"teamId": "5559883", "loc": "OV", "dept": "Action Kids", "team": "Child Care", "roster": 24, "total": 24, "active30d": 4, "d30_59": 5, "d60_89": 3, "d90_plus": 12}, {"teamId": "7340642", "loc": "OV", "dept": "Guest Services", "team": "Parking", "roster": 22, "total": 22, "active30d": 6, "d30_59": 1, "d60_89": 0, "d90_plus": 15}, {"teamId": "1907987", "loc": "OV", "dept": "Weekend Service", "team": "Band", "roster": 20, "total": 20, "active30d": 9, "d30_59": 2, "d60_89": 2, "d90_plus": 7}, {"teamId": "1908040", "loc": "OV", "dept": "Action Kids", "team": "Kids Check-In", "roster": 14, "total": 14, "active30d": 3, "d30_59": 4, "d60_89": 1, "d90_plus": 6}, {"teamId": "7340644", "loc": "OV", "dept": "Guest Services", "team": "Connect", "roster": 14, "total": 14, "active30d": 11, "d30_59": 1, "d60_89": 0, "d90_plus": 2}, {"teamId": "2140034", "loc": "OV", "dept": "Weekend Service", "team": "Students", "roster": 13, "total": 13, "active30d": 0, "d30_59": 2, "d60_89": 0, "d90_plus": 11}, {"teamId": "2144951", "loc": "OV", "dept": "Weekend Service", "team": "Events", "roster": 13, "total": 13, "active30d": 1, "d30_59": 0, "d60_89": 0, "d90_plus": 12}, {"teamId": "7340610", "loc": "OV", "dept": "Guest Services", "team": "Safety", "roster": 13, "total": 13, "active30d": 3, "d30_59": 1, "d60_89": 0, "d90_plus": 9}, {"teamId": "1908046", "loc": "OV", "dept": "Action Kids", "team": "Service Coordinators", "roster": 13, "total": 13, "active30d": 5, "d30_59": 0, "d60_89": 2, "d90_plus": 6}, {"teamId": "5955734", "loc": "OV", "dept": "Weekend Service", "team": "Choir", "roster": 12, "total": 12, "active30d": 4, "d30_59": 1, "d60_89": 1, "d90_plus": 6}, {"teamId": "7340650", "loc": "OV", "dept": "Guest Services", "team": "Hospitality", "roster": 11, "total": 11, "active30d": 1, "d30_59": 6, "d60_89": 0, "d90_plus": 4}, {"teamId": "7434603", "loc": "OV", "dept": "Weekend Service", "team": "Vocals & Band Shadowing", "roster": 11, "total": 11, "active30d": 3, "d30_59": 1, "d60_89": 1, "d90_plus": 6}, {"teamId": "5599670", "loc": "OV", "dept": "Weekend Service", "team": "Ensemble", "roster": 8, "total": 8, "active30d": 1, "d30_59": 2, "d60_89": 0, "d90_plus": 5}, {"teamId": "7340654", "loc": "OV", "dept": "Guest Services", "team": "Coaches", "roster": 8, "total": 8, "active30d": 7, "d30_59": 1, "d60_89": 0, "d90_plus": 0}, {"teamId": "7340647", "loc": "OV", "dept": "Guest Services", "team": "New Here", "roster": 7, "total": 7, "active30d": 6, "d30_59": 0, "d60_89": 0, "d90_plus": 1}, {"teamId": "2177144", "loc": "OV", "dept": "Weekend Service", "team": "Shadowing", "roster": 6, "total": 6, "active30d": 0, "d30_59": 1, "d60_89": 0, "d90_plus": 5}, {"teamId": "7340660", "loc": "OV", "dept": "Guest Services", "team": "Admin", "roster": 6, "total": 6, "active30d": 3, "d30_59": 0, "d60_89": 0, "d90_plus": 3}, {"teamId": "6203430", "loc": "OV", "dept": "Weekend Service", "team": "Sunday Swiss Army Knife", "roster": 5, "total": 5, "active30d": 0, "d30_59": 1, "d60_89": 1, "d90_plus": 3}, {"teamId": "6373805", "loc": "OV", "dept": "Action Kids", "team": "Staff", "roster": 5, "total": 5, "active30d": 1, "d30_59": 0, "d60_89": 0, "d90_plus": 4}, {"teamId": "2228436", "loc": "OV", "dept": "Weekend Service", "team": "Photography", "roster": 3, "total": 3, "active30d": 0, "d30_59": 0, "d60_89": 0, "d90_plus": 3}, {"teamId": "7369410", "loc": "OV", "dept": "Guest Services", "team": "Set-Up Team", "roster": 3, "total": 3, "active30d": 1, "d30_59": 0, "d60_89": 0, "d90_plus": 2}, {"teamId": "7455247", "loc": "OV", "dept": "Guest Services", "team": "Hospitality Set-Up Team", "roster": 3, "total": 3, "active30d": 2, "d30_59": 1, "d60_89": 0, "d90_plus": 0}, {"teamId": "7340658", "loc": "OV", "dept": "Guest Services", "team": "A-Team Central", "roster": 2, "total": 2, "active30d": 0, "d30_59": 1, "d60_89": 0, "d90_plus": 1}, {"teamId": "7388637", "loc": "OV", "dept": "Guest Services", "team": "Tear Down Team", "roster": 1, "total": 1, "active30d": 0, "d30_59": 1, "d60_89": 0, "d90_plus": 0}]}, "WS": {"rosterTotal": 203, "active30d": 86, "d30_59": 10, "d60_89": 8, "d90_plus": 99, "d90_sched": 22, "d90_unsched": 77, "teamBreakdown": [{"teamId": "7079298", "loc": "WS", "dept": "Guest Services", "team": "Set Up Team", "roster": 47, "total": 47, "active30d": 9, "d30_59": 14, "d60_89": 3, "d90_plus": 21}, {"teamId": "7093692", "loc": "WS", "dept": "Action Kids", "team": "Action Kids", "roster": 39, "total": 39, "active30d": 33, "d30_59": 3, "d60_89": 2, "d90_plus": 1}, {"teamId": "6962077", "loc": "WS", "dept": "Guest Services", "team": "Guest Services", "roster": 28, "total": 28, "active30d": 16, "d30_59": 4, "d60_89": 1, "d90_plus": 7}, {"teamId": "6942208", "loc": "WS", "dept": "Weekend Service", "team": "Production", "roster": 24, "total": 24, "active30d": 3, "d30_59": 1, "d60_89": 0, "d90_plus": 20}, {"teamId": "7070713", "loc": "WS", "dept": "Weekend Service", "team": "Worship", "roster": 22, "total": 22, "active30d": 1, "d30_59": 2, "d60_89": 1, "d90_plus": 18}, {"teamId": "6942205", "loc": "WS", "dept": "Weekend Service", "team": "Band", "roster": 20, "total": 20, "active30d": 0, "d30_59": 1, "d60_89": 0, "d90_plus": 19}, {"teamId": "6962082", "loc": "WS", "dept": "Guest Services", "team": "Usher", "roster": 18, "total": 18, "active30d": 8, "d30_59": 2, "d60_89": 2, "d90_plus": 6}, {"teamId": "6962056", "loc": "WS", "dept": "Guest Services", "team": "Parking", "roster": 14, "total": 14, "active30d": 7, "d30_59": 0, "d60_89": 0, "d90_plus": 7}, {"teamId": "6962067", "loc": "WS", "dept": "Guest Services", "team": "Safety", "roster": 13, "total": 13, "active30d": 5, "d30_59": 1, "d60_89": 0, "d90_plus": 7}, {"teamId": "6962176", "loc": "WS", "dept": "Guest Services", "team": "Prayer Team", "roster": 13, "total": 13, "active30d": 10, "d30_59": 1, "d60_89": 1, "d90_plus": 1}, {"teamId": "7256152", "loc": "WS", "dept": "Action Kids", "team": "Child Care", "roster": 10, "total": 10, "active30d": 1, "d30_59": 5, "d60_89": 0, "d90_plus": 4}, {"teamId": "6962063", "loc": "WS", "dept": "Guest Services", "team": "Connect", "roster": 8, "total": 8, "active30d": 3, "d30_59": 2, "d60_89": 0, "d90_plus": 3}, {"teamId": "7112160", "loc": "WS", "dept": "Weekend Service", "team": "Communicators", "roster": 6, "total": 6, "active30d": 1, "d30_59": 1, "d60_89": 0, "d90_plus": 4}, {"teamId": "6962093", "loc": "WS", "dept": "Guest Services", "team": "Hospitality", "roster": 6, "total": 6, "active30d": 4, "d30_59": 0, "d60_89": 1, "d90_plus": 1}, {"teamId": "6962137", "loc": "WS", "dept": "Guest Services", "team": "Tear Down", "roster": 5, "total": 5, "active30d": 0, "d30_59": 0, "d60_89": 1, "d90_plus": 4}, {"teamId": "7135052", "loc": "WS", "dept": "Guest Services", "team": "Coach", "roster": 5, "total": 5, "active30d": 2, "d30_59": 2, "d60_89": 0, "d90_plus": 1}, {"teamId": "7250951", "loc": "WS", "dept": "Weekend Service", "team": "ASL", "roster": 4, "total": 4, "active30d": 0, "d30_59": 0, "d60_89": 1, "d90_plus": 3}, {"teamId": "6962111", "loc": "WS", "dept": "Guest Services", "team": "Admin", "roster": 3, "total": 3, "active30d": 0, "d30_59": 0, "d60_89": 0, "d90_plus": 3}, {"teamId": "7256153", "loc": "WS", "dept": "Action Kids", "team": "Set-up Team", "roster": 3, "total": 3, "active30d": 2, "d30_59": 1, "d60_89": 0, "d90_plus": 0}]}}, "members": [{"id": "198856572", "name": "Ambur Taylor", "loc": "HW", "dept": "Guest Services", "teams": "Hospitality", "bucket": "30-59d", "lastServed": "2026-09-13", "daysAgo": 43, "d": 5, "u": 0}, {"id": "197112268", "name": "Jillian Perez", "loc": "HW", "dept": "Guest Services", "teams": "Hospitality", "bucket": "30-59d", "lastServed": "2026-09-13", "daysAgo": 43, "d": 2, "u": 2}, {"id": "198853147", "name": "Robin Wieckhorst", "loc": "HW", "dept": "Guest Services", "teams": "Prayer", "bucket": "30-59d", "lastServed": "2026-09-13", "daysAgo": 43, "d": 2, "u": 2}, {"id": "139289548", "name": "Jonathan Segura", "loc": "HW", "dept": "Weekend Service", "teams": "Production", "bucket": "30-59d", "lastServed": "2026-09-20", "daysAgo": 36, "d": 3, "u": 0}, {"id": "194062418", "name": "Kourtney Conway", "loc": "HW", "dept": "Action Kids", "teams": "Kids Preschool", "bucket": "30-59d", "lastServed": "2026-09-20", "daysAgo": 36, "d": 3, "u": 0}, {"id": "198858806", "name": "Kathy Eppstein", "loc": "HW", "dept": "Action Kids", "teams": "Kids Preschool", "bucket": "30-59d", "lastServed": "2026-09-20", "daysAgo": 36, "d": 1, "u": 0}, {"id": "176960836", "name": "Rosemary Hook", "loc": "HW", "dept": "Weekend Service", "teams": "Vocals", "bucket": "30-59d", "lastServed": "2026-09-20", "daysAgo": 36, "d": 1, "u": 0}, {"id": "198865231", "name": "Ashley Maestre", "loc": "HW", "dept": "Action Kids", "teams": "Kids Check-In", "bucket": "30-59d", "lastServed": "2026-09-13", "daysAgo": 43, "d": 1, "u": 0}, {"id": "198865468", "name": "Jacob Hook", "loc": "HW", "dept": "Action Kids", "teams": "Kids Theater", "bucket": "30-59d", "lastServed": "2026-09-06", "daysAgo": 50, "d": 1, "u": 0}, {"id": "195834795", "name": "Krisy Garcia", "loc": "HW", "dept": "Guest Services", "teams": "Coach", "bucket": "30-59d", "lastServed": "2026-09-13", "daysAgo": 43, "d": 0, "u": 0}, {"id": "198855913", "name": "Gary Seljan", "loc": "HW", "dept": "Action Kids", "teams": "Kids Preschool", "bucket": "60-89d", "lastServed": "2026-08-16", "daysAgo": 71, "d": 2, "u": 0}, {"id": "198853195", "name": "Brenda Greaver", "loc": "HW", "dept": "Action Kids", "teams": "Staff Childcare 7 AM", "bucket": "60-89d", "lastServed": "2026-08-23", "daysAgo": 64, "d": 0, "u": 0}, {"id": "198854145", "name": "Jonathan Emilio Lanza", "loc": "HW", "dept": "Action Kids", "teams": "Kids Theater, Prayer", "bucket": "60-89d", "lastServed": "2026-08-23", "daysAgo": 64, "d": 0, "u": 0}, {"id": "198853921", "name": "Justin Wieckhorst", "loc": "HW", "dept": "Guest Services", "teams": "Parking", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 1, "u": 11}, {"id": "198869242", "name": "Marcus Goss Jr.", "loc": "HW", "dept": "Guest Services", "teams": "Parking", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 0, "u": 10}, {"id": "198856063", "name": "Seth Gregg", "loc": "HW", "dept": "Guest Services", "teams": "Parking", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 0, "u": 9}, {"id": "194028775", "name": "Vikki Gonzalez", "loc": "HW", "dept": "Guest Services", "teams": "Coach, Connect", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 9, "u": 0}, {"id": "198857326", "name": "Nicholas Georgian", "loc": "HW", "dept": "Guest Services", "teams": "Safety", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 5, "u": 3}, {"id": "198856192", "name": "Suni Gay", "loc": "HW", "dept": "Guest Services", "teams": "Connect", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 8, "u": 0}, {"id": "197791055", "name": "Mike Gentry", "loc": "HW", "dept": "Weekend Service", "teams": "Production", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 7, "u": 0}, {"id": "198019998", "name": "Jadiel Fontanez", "loc": "HW", "dept": "Weekend Service", "teams": "Production", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 3, "u": 3}, {"id": "198856388", "name": "Robert Mattson", "loc": "HW", "dept": "Guest Services", "teams": "Safety", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 6, "u": 0}, {"id": "198853241", "name": "Anne Odukoya", "loc": "HW", "dept": "Guest Services", "teams": "Prayer, Ushers", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 4, "u": 1}, {"id": "198865031", "name": "Anthony (Andy) Gay", "loc": "HW", "dept": "Guest Services", "teams": "Safety", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 5, "u": 0}, {"id": "111846785", "name": "Lilly Billingsley", "loc": "HW", "dept": "Action Kids", "teams": "Staff Childcare 7 AM", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 0, "u": 5}, {"id": "38557245", "name": "Maryann Santos", "loc": "HW", "dept": "Guest Services", "teams": "Production, Safety", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 2, "u": 3}, {"id": "198839044", "name": "Matthew Allan", "loc": "HW", "dept": "Action Kids", "teams": "Setup Team", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 0, "u": 5}, {"id": "137819024", "name": "Damaris Figueroa", "loc": "SF", "dept": "Action Kids", "teams": "Pre-School", "bucket": "30-59d", "lastServed": "2026-09-13", "daysAgo": 43, "d": 2, "u": 12}, {"id": "90585174", "name": "Alexis Paxton", "loc": "SF", "dept": "Guest Services", "teams": "Guest Services", "bucket": "30-59d", "lastServed": "2026-09-13", "daysAgo": 43, "d": 11, "u": 0}, {"id": "167811801", "name": "AJ Patterson", "loc": "SF", "dept": "Action Kids", "teams": "KT1 - 2nd", "bucket": "30-59d", "lastServed": "2026-08-30", "daysAgo": 57, "d": 5, "u": 6}, {"id": "38550260", "name": "Jonah Drake", "loc": "SF", "dept": "Guest Services", "teams": "Band, Guest Services", "bucket": "30-59d", "lastServed": "2026-09-20", "daysAgo": 36, "d": 9, "u": 0}, {"id": "132442801", "name": "Carter Mazur", "loc": "SF", "dept": "Guest Services", "teams": "Guest Services, Prayer Team", "bucket": "30-59d", "lastServed": "2026-09-13", "daysAgo": 43, "d": 8, "u": 0}, {"id": "103276507", "name": "Richard Ramos", "loc": "SF", "dept": "Guest Services", "teams": "Guest Services", "bucket": "30-59d", "lastServed": "2026-09-13", "daysAgo": 43, "d": 8, "u": 0}, {"id": "94710538", "name": "Geniva Welch", "loc": "SF", "dept": "Guest Services", "teams": "Guest Services, Prayer Team", "bucket": "30-59d", "lastServed": "2026-08-30", "daysAgo": 57, "d": 8, "u": 0}, {"id": "120660690", "name": "Soni Perkins", "loc": "SF", "dept": "Action Kids", "teams": "Pre-School", "bucket": "30-59d", "lastServed": "2026-09-13", "daysAgo": 43, "d": 2, "u": 5}, {"id": "46543890", "name": "Kameron King", "loc": "SF", "dept": "Action Kids", "teams": "Pre-School", "bucket": "30-59d", "lastServed": "2026-09-06", "daysAgo": 50, "d": 7, "u": 0}, {"id": "46543889", "name": "Sarah King", "loc": "SF", "dept": "Action Kids", "teams": "KT1 - 2nd, KT2- 3rd, 4th, 5th", "bucket": "30-59d", "lastServed": "2026-09-06", "daysAgo": 50, "d": 7, "u": 0}, {"id": "29606290", "name": "Elaine Knaub", "loc": "SF", "dept": "Guest Services", "teams": "Prayer Team", "bucket": "30-59d", "lastServed": "2026-08-30", "daysAgo": 57, "d": 7, "u": 0}, {"id": "156183674", "name": "Cirstin Simmons", "loc": "SF", "dept": "Action Kids", "teams": "KT2- 3rd, 4th, 5th", "bucket": "30-59d", "lastServed": "2026-09-20", "daysAgo": 36, "d": 5, "u": 1}, {"id": "103282380", "name": "Fatima Ramos", "loc": "SF", "dept": "Guest Services", "teams": "Guest Services", "bucket": "30-59d", "lastServed": "2026-09-13", "daysAgo": 43, "d": 2, "u": 4}, {"id": "46543892", "name": "Robert King", "loc": "SF", "dept": "Guest Services", "teams": "Events Team, Guest Services", "bucket": "30-59d", "lastServed": "2026-09-06", "daysAgo": 50, "d": 6, "u": 0}, {"id": "133741650", "name": "Cendra Ray", "loc": "SF", "dept": "Guest Services", "teams": "Guest Services", "bucket": "60-89d", "lastServed": "2026-08-16", "daysAgo": 71, "d": 14, "u": 0}, {"id": "85771992", "name": "Joanna Bucaro", "loc": "SF", "dept": "Guest Services", "teams": "Prayer Team", "bucket": "60-89d", "lastServed": "2026-08-16", "daysAgo": 71, "d": 3, "u": 9}, {"id": "106958812", "name": "Marybell Arocho", "loc": "SF", "dept": "Guest Services", "teams": "Guest Services", "bucket": "60-89d", "lastServed": "2026-08-16", "daysAgo": 71, "d": 7, "u": 0}, {"id": "113274472", "name": "Tanaj Dieujuste", "loc": "SF", "dept": "Guest Services", "teams": "Guest Services, Sunday Choir", "bucket": "60-89d", "lastServed": "2026-08-09", "daysAgo": 78, "d": 2, "u": 5}, {"id": "110684119", "name": "Jantzen Young", "loc": "SF", "dept": "Guest Services", "teams": "Guest Services, Sign Language", "bucket": "60-89d", "lastServed": "2026-08-23", "daysAgo": 64, "d": 1, "u": 5}, {"id": "142761775", "name": "Krista King", "loc": "SF", "dept": "Guest Services", "teams": "Guest Services", "bucket": "60-89d", "lastServed": "2026-08-16", "daysAgo": 71, "d": 5, "u": 0}, {"id": "123566123", "name": "James Walden", "loc": "SF", "dept": "Guest Services", "teams": "Guest Services", "bucket": "60-89d", "lastServed": "2026-08-09", "daysAgo": 78, "d": 4, "u": 0}, {"id": "161299427", "name": "Zack Schaefer", "loc": "SF", "dept": "Action Kids", "teams": "KT1 - 2nd, Pre-School", "bucket": "60-89d", "lastServed": "2026-08-16", "daysAgo": 71, "d": 2, "u": 0}, {"id": "154008233", "name": "Brett Neidlinger", "loc": "SF", "dept": "Guest Services", "teams": "Guest Services", "bucket": "60-89d", "lastServed": "2026-08-23", "daysAgo": 64, "d": 1, "u": 0}, {"id": "142761684", "name": "Christian King", "loc": "SF", "dept": "Guest Services", "teams": "Guest Services", "bucket": "60-89d", "lastServed": "2026-08-16", "daysAgo": 71, "d": 0, "u": 0}, {"id": "142970565", "name": "Jasmine Cruz-Figueroa", "loc": "SF", "dept": "Guest Services", "teams": "Guest Services, Sign Language", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 10, "u": 20}, {"id": "81545328", "name": "Amanda Reynolds", "loc": "SF", "dept": "Guest Services", "teams": "Prayer Team", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 5, "u": 10}, {"id": "158666742", "name": "Brandon Simmons", "loc": "SF", "dept": "Guest Services", "teams": "Guest Services", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 4, "u": 11}, {"id": "156800299", "name": "Brandon Simmons Jr.", "loc": "SF", "dept": "Guest Services", "teams": "Guest Services", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 6, "u": 9}, {"id": "136594165", "name": "Antonio Mclaughlin", "loc": "SF", "dept": "Action Kids", "teams": "KT1 - 2nd, KT2- 3rd, 4th, 5th", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 0, "u": 14}, {"id": "29307573", "name": "Irving Rivera", "loc": "SF", "dept": "Guest Services", "teams": "Guest Services, Leadership", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 14, "u": 0}, {"id": "111014053", "name": "Ramon Soto", "loc": "SF", "dept": "Guest Services", "teams": "Guest Services", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 14, "u": 0}, {"id": "8080870", "name": "Chip Mendoza", "loc": "SF", "dept": "Guest Services", "teams": "Guest Services", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 5, "u": 8}, {"id": "129079457", "name": "Rose Gabriel", "loc": "SF", "dept": "Action Kids", "teams": "KT1 - 2nd, KT2- 3rd, 4th, 5th", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 4, "u": 8}, {"id": "112409770", "name": "Avri Perkins", "loc": "SF", "dept": "Action Kids", "teams": "Pre-School", "bucket": "90d+", "lastServed": "2026-07-19", "daysAgo": 99, "d": 4, "u": 7}, {"id": "56610405", "name": "Mitchell Prevesk", "loc": "SF", "dept": "Guest Services", "teams": "Guest Services", "bucket": "90d+", "lastServed": "2026-07-19", "daysAgo": 99, "d": 7, "u": 4}, {"id": "124591888", "name": "Britney Torres", "loc": "SF", "dept": "Weekend Service", "teams": "Sign Language", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 8, "u": 3}, {"id": "46389371", "name": "Mindy Rhodd", "loc": "SF", "dept": "Guest Services", "teams": "Guest Services", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 7, "u": 4}, {"id": "178963968", "name": "Sabina Oliveira", "loc": "SF", "dept": "Guest Services", "teams": "Guest Services", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 3, "u": 8}, {"id": "190194156", "name": "Camden Pagan", "loc": "WP", "dept": "Action Kids", "teams": "Kids Preschool", "bucket": "30-59d", "lastServed": "2026-09-20", "daysAgo": 36, "d": 0, "u": 8}, {"id": "48121123", "name": "Greg McClellan", "loc": "WP", "dept": "Guest Services", "teams": "Prayer Team, Usher Team", "bucket": "30-59d", "lastServed": "2026-09-20", "daysAgo": 36, "d": 8, "u": 0}, {"id": "179390159", "name": "Isaac Leon", "loc": "WP", "dept": "Action Kids", "teams": "Kids Preschool", "bucket": "30-59d", "lastServed": "2026-09-20", "daysAgo": 36, "d": 0, "u": 8}, {"id": "42472425", "name": "Crystal Henderson", "loc": "WP", "dept": "Action Kids", "teams": "Kids Preschool", "bucket": "30-59d", "lastServed": "2026-09-13", "daysAgo": 43, "d": 0, "u": 8}, {"id": "165057078", "name": "Jose Boscan", "loc": "WP", "dept": "Guest Services", "teams": "Greeter Team", "bucket": "30-59d", "lastServed": "2026-09-13", "daysAgo": 43, "d": 8, "u": 0}, {"id": "158591771", "name": "Katie Boscan", "loc": "WP", "dept": "Guest Services", "teams": "Greeter Team", "bucket": "30-59d", "lastServed": "2026-09-13", "daysAgo": 43, "d": 8, "u": 0}, {"id": "181286402", "name": "Torie Arrington", "loc": "WP", "dept": "Action Kids", "teams": "Kids Preschool", "bucket": "30-59d", "lastServed": "2026-09-13", "daysAgo": 43, "d": 6, "u": 2}, {"id": "124558786", "name": "Robert Walther", "loc": "WP", "dept": "Guest Services", "teams": "Connect Team, Usher Team", "bucket": "30-59d", "lastServed": "2026-09-06", "daysAgo": 50, "d": 7, "u": 1}, {"id": "146350457", "name": "Peter Nguyen", "loc": "WP", "dept": "Guest Services", "teams": "Greeter Team", "bucket": "30-59d", "lastServed": "2026-08-30", "daysAgo": 57, "d": 8, "u": 0}, {"id": "191416290", "name": "Teagan Morrison", "loc": "WP", "dept": "Action Kids", "teams": "Kids Preschool", "bucket": "30-59d", "lastServed": "2026-08-30", "daysAgo": 57, "d": 4, "u": 4}, {"id": "40191901", "name": "Teresa Davila", "loc": "WP", "dept": "Guest Services", "teams": "Greeter Team, Prayer Team", "bucket": "30-59d", "lastServed": "2026-08-30", "daysAgo": 57, "d": 0, "u": 8}, {"id": "134210584", "name": "Joslynn Gallo", "loc": "WP", "dept": "Guest Services", "teams": "Greeter Team", "bucket": "30-59d", "lastServed": "2026-09-13", "daysAgo": 43, "d": 3, "u": 4}, {"id": "167613541", "name": "Danielle Sequeira", "loc": "WP", "dept": "Action Kids", "teams": "Greeter Team, Kids Preschool", "bucket": "30-59d", "lastServed": "2026-08-30", "daysAgo": 57, "d": 3, "u": 4}, {"id": "199575675", "name": "Ryan Levin", "loc": "WP", "dept": "Guest Services", "teams": "Greeter Team", "bucket": "30-59d", "lastServed": "2026-08-30", "daysAgo": 57, "d": 7, "u": 0}, {"id": "169794874", "name": "Ethan Alonso", "loc": "WP", "dept": "Action Kids", "teams": "Kids Preschool, Kids Theater", "bucket": "60-89d", "lastServed": "2026-08-09", "daysAgo": 78, "d": 7, "u": 9}, {"id": "49767947", "name": "Emmalee Smith", "loc": "WP", "dept": "Action Kids", "teams": "Connect Team, Greeter Team", "bucket": "60-89d", "lastServed": "2026-08-02", "daysAgo": 85, "d": 2, "u": 7}, {"id": "176874572", "name": "Jazzy Rodriguez", "loc": "WP", "dept": "Action Kids", "teams": "Kids Preschool", "bucket": "60-89d", "lastServed": "2026-08-23", "daysAgo": 64, "d": 0, "u": 8}, {"id": "159809429", "name": "Marley Turner", "loc": "WP", "dept": "Action Kids", "teams": "Kids Preschool", "bucket": "60-89d", "lastServed": "2026-08-23", "daysAgo": 64, "d": 8, "u": 0}, {"id": "97149540", "name": "Lauren Grandstaff", "loc": "WP", "dept": "Guest Services", "teams": "Greeter Team", "bucket": "60-89d", "lastServed": "2026-08-16", "daysAgo": 71, "d": 0, "u": 7}, {"id": "124728964", "name": "Taylor Alcorn", "loc": "WP", "dept": "Action Kids", "teams": "Kids Preschool", "bucket": "60-89d", "lastServed": "2026-08-16", "daysAgo": 71, "d": 1, "u": 6}, {"id": "46442544", "name": "Brielle Tourne'", "loc": "WP", "dept": "Action Kids", "teams": "Kids Preschool", "bucket": "60-89d", "lastServed": "2026-08-23", "daysAgo": 64, "d": 5, "u": 0}, {"id": "167572293", "name": "Zachary Schmidt", "loc": "WP", "dept": "Guest Services", "teams": "Parking Team", "bucket": "60-89d", "lastServed": "2026-08-23", "daysAgo": 64, "d": 0, "u": 5}, {"id": "97699949", "name": "Ciara Robles", "loc": "WP", "dept": "Guest Services", "teams": "Greeter Team", "bucket": "60-89d", "lastServed": "2026-08-23", "daysAgo": 64, "d": 0, "u": 4}, {"id": "46440855", "name": "Kelly Tourn\u00e9", "loc": "WP", "dept": "Action Kids", "teams": "Kids Check-In, Kids Preschool", "bucket": "60-89d", "lastServed": "2026-08-23", "daysAgo": 64, "d": 4, "u": 0}, {"id": "38558923", "name": "Cassidy Vazquez", "loc": "WP", "dept": "Guest Services", "teams": "Greeter Team", "bucket": "90d+", "lastServed": "2026-07-26", "daysAgo": 92, "d": 4, "u": 4}, {"id": "146301631", "name": "Abby Ly", "loc": "WP", "dept": "Action Kids", "teams": "Greeter Team, Kids Preschool", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 0, "u": 8}, {"id": "179300349", "name": "Ashley Fernandez", "loc": "WP", "dept": "Action Kids", "teams": "Kids Theater", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 2, "u": 6}, {"id": "141878851", "name": "Blake Merrill", "loc": "WP", "dept": "Guest Services", "teams": "Safety Team", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 0, "u": 8}, {"id": "173269261", "name": "Brian Schooley", "loc": "WP", "dept": "Action Kids", "teams": "Kids Preschool, Kids Theater", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 2, "u": 6}, {"id": "124531075", "name": "Campbell Story", "loc": "WP", "dept": "Guest Services", "teams": "Greeter Team", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 0, "u": 8}, {"id": "46535744", "name": "Elizabeth Brick", "loc": "WP", "dept": "Action Kids", "teams": "Kids Preschool", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 0, "u": 8}, {"id": "153930665", "name": "Gleidys Medina", "loc": "WP", "dept": "Action Kids", "teams": "Kids Preschool", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 1, "u": 7}, {"id": "113586218", "name": "Josiah Vellon", "loc": "WP", "dept": "Action Kids", "teams": "Kids Preschool", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 0, "u": 8}, {"id": "50015382", "name": "Liam Rogers", "loc": "WP", "dept": "Action Kids", "teams": "Kids Theater", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 0, "u": 8}, {"id": "131076868", "name": "Natalie Pellegrino", "loc": "WP", "dept": "Guest Services", "teams": "Greeter Team", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 0, "u": 8}, {"id": "186673478", "name": "Nellie Rodriguez", "loc": "WP", "dept": "Action Kids", "teams": "Kids Preschool", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 0, "u": 8}, {"id": "111235535", "name": "Shelby Walton", "loc": "WP", "dept": "Action Kids", "teams": "Kids Preschool", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 1, "u": 7}, {"id": "167697266", "name": "Steve Russell", "loc": "WP", "dept": "Guest Services", "teams": "Safety Team", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 0, "u": 8}, {"id": "156733263", "name": "Eric Carl", "loc": "OV", "dept": "Action Kids", "teams": "Kids Check-In, Safety", "bucket": "30-59d", "lastServed": "2026-09-06", "daysAgo": 50, "d": 7, "u": 9}, {"id": "143116865", "name": "Kiesha Hernandez", "loc": "OV", "dept": "Guest Services", "teams": "Greeters, Hospitality", "bucket": "30-59d", "lastServed": "2026-08-30", "daysAgo": 57, "d": 1, "u": 13}, {"id": "40683179", "name": "Bobby Brolliar", "loc": "OV", "dept": "Guest Services", "teams": "Parking, Tear Down Team", "bucket": "30-59d", "lastServed": "2026-09-13", "daysAgo": 43, "d": 9, "u": 0}, {"id": "145939862", "name": "Tyler Nichols", "loc": "OV", "dept": "Guest Services", "teams": "Ushers", "bucket": "30-59d", "lastServed": "2026-09-13", "daysAgo": 43, "d": 6, "u": 2}, {"id": "105288246", "name": "Jennie Thompson", "loc": "OV", "dept": "Guest Services", "teams": "Greeters", "bucket": "30-59d", "lastServed": "2026-08-30", "daysAgo": 57, "d": 6, "u": 2}, {"id": "143116871", "name": "Annalise Flores", "loc": "OV", "dept": "Action Kids", "teams": "Preschool", "bucket": "30-59d", "lastServed": "2026-08-30", "daysAgo": 57, "d": 4, "u": 3}, {"id": "38557312", "name": "Karen Scharnberg", "loc": "OV", "dept": "Guest Services", "teams": "Hospitality", "bucket": "30-59d", "lastServed": "2026-08-30", "daysAgo": 57, "d": 7, "u": 0}, {"id": "105617905", "name": "Steve Thompson", "loc": "OV", "dept": "Guest Services", "teams": "Ushers", "bucket": "30-59d", "lastServed": "2026-08-30", "daysAgo": 57, "d": 6, "u": 1}, {"id": "156075429", "name": "Terri Bondhus", "loc": "OV", "dept": "Guest Services", "teams": "Greeters", "bucket": "30-59d", "lastServed": "2026-09-13", "daysAgo": 43, "d": 3, "u": 3}, {"id": "167731107", "name": "Ange Geremia", "loc": "OV", "dept": "Action Kids", "teams": "Preschool", "bucket": "30-59d", "lastServed": "2026-09-06", "daysAgo": 50, "d": 6, "u": 0}, {"id": "194062539", "name": "Jesula Odom", "loc": "OV", "dept": "Guest Services", "teams": "Greeters", "bucket": "30-59d", "lastServed": "2026-09-06", "daysAgo": 50, "d": 5, "u": 1}, {"id": "51796671", "name": "Kathy Spinella", "loc": "OV", "dept": "Guest Services", "teams": "Greeters", "bucket": "30-59d", "lastServed": "2026-09-06", "daysAgo": 50, "d": 6, "u": 0}, {"id": "38549450", "name": "Mason Cordova", "loc": "OV", "dept": "Action Kids", "teams": "Kids Check-In, Preschool", "bucket": "30-59d", "lastServed": "2026-09-13", "daysAgo": 43, "d": 5, "u": 0}, {"id": "41882529", "name": "Kaitlin Miller", "loc": "OV", "dept": "Action Kids", "teams": "Set-up Team, Theater", "bucket": "30-59d", "lastServed": "2026-09-06", "daysAgo": 50, "d": 4, "u": 1}, {"id": "38549930", "name": "George Del Forn", "loc": "OV", "dept": "Action Kids", "teams": "Preschool, Set-up Team", "bucket": "60-89d", "lastServed": "2026-08-09", "daysAgo": 78, "d": 8, "u": 0}, {"id": "133479257", "name": "Brody Hanington", "loc": "OV", "dept": "Action Kids", "teams": "Preschool", "bucket": "60-89d", "lastServed": "2026-08-02", "daysAgo": 85, "d": 6, "u": 2}, {"id": "113626595", "name": "Erin Carl", "loc": "OV", "dept": "Action Kids", "teams": "Kids Check-In, Service Coordinators", "bucket": "60-89d", "lastServed": "2026-08-02", "daysAgo": 85, "d": 5, "u": 3}, {"id": "126183520", "name": "Samuel Irigoyen", "loc": "OV", "dept": "Guest Services", "teams": "Ushers", "bucket": "60-89d", "lastServed": "2026-08-23", "daysAgo": 64, "d": 0, "u": 7}, {"id": "51849047", "name": "Melanie Mason", "loc": "OV", "dept": "Guest Services", "teams": "Greeters", "bucket": "60-89d", "lastServed": "2026-08-16", "daysAgo": 71, "d": 4, "u": 3}, {"id": "198864873", "name": "Charles L Flores Jr.", "loc": "OV", "dept": "Action Kids", "teams": "Theater", "bucket": "60-89d", "lastServed": "2026-08-02", "daysAgo": 85, "d": 3, "u": 4}, {"id": "122609706", "name": "Daniel Irigoyen", "loc": "OV", "dept": "Guest Services", "teams": "Ushers", "bucket": "60-89d", "lastServed": "2026-08-23", "daysAgo": 64, "d": 1, "u": 5}, {"id": "38556980", "name": "Jen Rothfuss", "loc": "OV", "dept": "Guest Services", "teams": "Greeters", "bucket": "60-89d", "lastServed": "2026-08-02", "daysAgo": 85, "d": 5, "u": 1}, {"id": "195258587", "name": "Charles Flores", "loc": "OV", "dept": "Weekend Service", "teams": "Production", "bucket": "60-89d", "lastServed": "2026-08-23", "daysAgo": 64, "d": 1, "u": 1}, {"id": "195522783", "name": "Martin Miles", "loc": "OV", "dept": "Action Kids", "teams": "Theater", "bucket": "60-89d", "lastServed": "2026-08-16", "daysAgo": 71, "d": 0, "u": 2}, {"id": "98351574", "name": "Myron King", "loc": "OV", "dept": "Guest Services", "teams": "Ushers", "bucket": "90d+", "lastServed": "2026-07-19", "daysAgo": 99, "d": 8, "u": 0}, {"id": "98351144", "name": "Rachel King", "loc": "OV", "dept": "Guest Services", "teams": "Greeters", "bucket": "90d+", "lastServed": "2026-07-19", "daysAgo": 99, "d": 8, "u": 0}, {"id": "113599453", "name": "Alex Cocurull", "loc": "OV", "dept": "Guest Services", "teams": "Ushers", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 0, "u": 8}, {"id": "144144775", "name": "Andrew King", "loc": "OV", "dept": "Action Kids", "teams": "Greeters, Preschool", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 8, "u": 0}, {"id": "144543548", "name": "Chip Reams", "loc": "OV", "dept": "Guest Services", "teams": "Set-Up Team", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 0, "u": 8}, {"id": "193343145", "name": "David Gomez", "loc": "OV", "dept": "Guest Services", "teams": "Safety", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 0, "u": 8}, {"id": "189293175", "name": "Deacon Liput", "loc": "OV", "dept": "Guest Services", "teams": "Parking", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 0, "u": 8}, {"id": "167858741", "name": "Dylan Fitzpatrick", "loc": "OV", "dept": "Guest Services", "teams": "Parking, Set-Up Team", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 0, "u": 8}, {"id": "38558476", "name": "Jennifer Thomas", "loc": "OV", "dept": "Action Kids", "teams": "Kids Check-In", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 6, "u": 2}, {"id": "118048851", "name": "JoAnn Chisolm", "loc": "OV", "dept": "Guest Services", "teams": "Admin, Hospitality", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 0, "u": 8}, {"id": "200824443", "name": "Juddah Bock", "loc": "OV", "dept": "Guest Services", "teams": "Parking", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 0, "u": 8}, {"id": "174115167", "name": "Justin Fisher", "loc": "OV", "dept": "Guest Services", "teams": "Parking", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 0, "u": 8}, {"id": "38557380", "name": "Kanen Schwier", "loc": "OV", "dept": "Action Kids", "teams": "Parking, Theater", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 0, "u": 8}, {"id": "94414618", "name": "Kolton McEachern", "loc": "OV", "dept": "Action Kids", "teams": "Preschool", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 3, "u": 5}, {"id": "38556412", "name": "Braxton Reynolds", "loc": "WS", "dept": "Action Kids", "teams": "Set Up Team, Set-up Team", "bucket": "30-59d", "lastServed": "2026-09-20", "daysAgo": 36, "d": 8, "u": 0}, {"id": "44258881", "name": "Iliana Rosado", "loc": "WS", "dept": "Action Kids", "teams": "Action Kids, Child Care", "bucket": "30-59d", "lastServed": "2026-09-20", "daysAgo": 36, "d": 0, "u": 8}, {"id": "38554958", "name": "Bryan D. Moyer", "loc": "WS", "dept": "Guest Services", "teams": "Coach, Usher", "bucket": "30-59d", "lastServed": "2026-09-20", "daysAgo": 36, "d": 5, "u": 0}, {"id": "90955295", "name": "Cheryl Moyer", "loc": "WS", "dept": "Guest Services", "teams": "Coach", "bucket": "30-59d", "lastServed": "2026-09-20", "daysAgo": 36, "d": 5, "u": 0}, {"id": "38557988", "name": "Giulliana Soto", "loc": "WS", "dept": "Action Kids", "teams": "Action Kids, Child Care", "bucket": "30-59d", "lastServed": "2026-09-06", "daysAgo": 50, "d": 5, "u": 0}, {"id": "91357043", "name": "Jesus Caimares", "loc": "WS", "dept": "Guest Services", "teams": "Guest Services", "bucket": "30-59d", "lastServed": "2026-08-30", "daysAgo": 57, "d": 1, "u": 1}, {"id": "99136787", "name": "Judy Caimares", "loc": "WS", "dept": "Guest Services", "teams": "Guest Services", "bucket": "30-59d", "lastServed": "2026-08-30", "daysAgo": 57, "d": 1, "u": 1}, {"id": "188140776", "name": "Ashley Rivera", "loc": "WS", "dept": "Weekend Service", "teams": "Band", "bucket": "30-59d", "lastServed": "2026-09-20", "daysAgo": 36, "d": 0, "u": 0}, {"id": "4670132", "name": "Evan Harper", "loc": "WS", "dept": "Weekend Service", "teams": "Communicators, Production", "bucket": "30-59d", "lastServed": "2026-08-30", "daysAgo": 57, "d": 0, "u": 0}, {"id": "38555857", "name": "Morgan Phillips", "loc": "WS", "dept": "Action Kids", "teams": "Action Kids", "bucket": "30-59d", "lastServed": "2026-08-30", "daysAgo": 57, "d": 0, "u": 0}, {"id": "36865882", "name": "Cleber Gomes", "loc": "WS", "dept": "Action Kids", "teams": "Action Kids", "bucket": "60-89d", "lastServed": "2026-08-23", "daysAgo": 64, "d": 1, "u": 6}, {"id": "38558756", "name": "Seth Umholtz", "loc": "WS", "dept": "Guest Services", "teams": "Set Up Team, Usher", "bucket": "60-89d", "lastServed": "2026-08-23", "daysAgo": 64, "d": 6, "u": 1}, {"id": "128012671", "name": "Gabrielle Frates", "loc": "WS", "dept": "Guest Services", "teams": "ASL, Hospitality", "bucket": "60-89d", "lastServed": "2026-08-02", "daysAgo": 85, "d": 0, "u": 6}, {"id": "36864612", "name": "Belkis Gomes", "loc": "WS", "dept": "Guest Services", "teams": "Connect, Guest Services", "bucket": "60-89d", "lastServed": "2026-08-16", "daysAgo": 71, "d": 0, "u": 1}, {"id": "97131523", "name": "Kristen Hoffman Umholtz", "loc": "WS", "dept": "Action Kids", "teams": "Action Kids", "bucket": "60-89d", "lastServed": "2026-08-23", "daysAgo": 64, "d": 0, "u": 0}, {"id": "99156927", "name": "Albert Quiroga", "loc": "WS", "dept": "Guest Services", "teams": "Set Up Team, Usher", "bucket": "60-89d", "lastServed": "2026-08-16", "daysAgo": 71, "d": 0, "u": 0}, {"id": "4269248", "name": "Claire Harper", "loc": "WS", "dept": "Weekend Service", "teams": "Worship", "bucket": "60-89d", "lastServed": "2026-08-16", "daysAgo": 71, "d": 0, "u": 0}, {"id": "102234405", "name": "Amy Quiroga", "loc": "WS", "dept": "Guest Services", "teams": "Prayer Team", "bucket": "60-89d", "lastServed": "2026-08-09", "daysAgo": 78, "d": 0, "u": 0}, {"id": "145148740", "name": "Liza Figueroa", "loc": "WS", "dept": "Guest Services", "teams": "Admin, Set Up Team", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 0, "u": 8}, {"id": "124591888", "name": "Britney Torres", "loc": "WS", "dept": "Guest Services", "teams": "ASL, Prayer Team", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 2, "u": 5}, {"id": "62460584", "name": "Marc Jones", "loc": "WS", "dept": "Guest Services", "teams": "Set Up Team", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 1, "u": 6}, {"id": "38550216", "name": "Ryan Doyle", "loc": "WS", "dept": "Action Kids", "teams": "Action Kids", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 0, "u": 7}, {"id": "94723502", "name": "John Prowell", "loc": "WS", "dept": "Guest Services", "teams": "Tear Down", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 1, "u": 4}, {"id": "38553899", "name": "Austin Manuel", "loc": "WS", "dept": "Guest Services", "teams": "Safety, Set Up Team", "bucket": "90d+", "lastServed": "2026-07-19", "daysAgo": 99, "d": 3, "u": 1}, {"id": "77471672", "name": "Luke Hardin", "loc": "WS", "dept": "Guest Services", "teams": "Safety, Set Up Team", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 4, "u": 0}, {"id": "90947343", "name": "Sean Woosley", "loc": "WS", "dept": "Guest Services", "teams": "Set Up Team", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 2, "u": 2}, {"id": "89511843", "name": "Alice Butler", "loc": "WS", "dept": "Guest Services", "teams": "Guest Services", "bucket": "90d+", "lastServed": "2026-07-26", "daysAgo": 92, "d": 3, "u": 0}, {"id": "159800270", "name": "David Byron", "loc": "WS", "dept": "Guest Services", "teams": "Parking", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 0, "u": 2}, {"id": "196726976", "name": "Debi Blaine", "loc": "WS", "dept": "Guest Services", "teams": "Guest Services", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 0, "u": 2}, {"id": "188364314", "name": "Omar Santana", "loc": "WS", "dept": "Guest Services", "teams": "Parking, Set Up Team", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 0, "u": 2}, {"id": "162823649", "name": "Sterling Brown", "loc": "WS", "dept": "Guest Services", "teams": "Safety, Set Up Team", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 1, "u": 1}, {"id": "121399204", "name": "Travis Atwater", "loc": "WS", "dept": "Guest Services", "teams": "Tear Down", "bucket": "90d+", "lastServed": "No QTD Serve (90d+)", "daysAgo": null, "d": 2, "u": 0}]};

const TH_CONF: Record<HorizonCode, Record<LocCode, { c: number; u: number; d: number; openNeeded: number; confRate: number; declineRate: number; depts: Array<{ dept: string; c: number; u: number; d: number; confRate: number }>; teams: ConfTeamRow[] }>> = {"weekly":{"ALL":{"c":731,"u":385,"d":392,"openNeeded":839,"confRate":65.5,"declineRate":26.0,"depts":[{"dept":"Weekend Service","c":152,"u":24,"d":17,"confRate":86.4},{"dept":"Guest Services","c":379,"u":219,"d":250,"confRate":63.4},{"dept":"Action Kids","c":200,"u":142,"d":125,"confRate":58.5}],"teams":[]},"HW":{"c":108,"u":34,"d":40,"openNeeded":101,"confRate":76.1,"declineRate":22.0,"depts":[{"dept":"Weekend Service","c":25,"u":7,"d":0,"confRate":78.1},{"dept":"Guest Services","c":54,"u":14,"d":25,"confRate":79.4},{"dept":"Action Kids","c":29,"u":13,"d":15,"confRate":69.0}],"teams":[{"loc":"HW","dept":"Action Kids","team":"Kids Theater","c":7,"u":6,"d":4,"confRate":53.8,"planId":"92145115"},{"loc":"HW","dept":"Weekend Service","team":"Production","c":8,"u":6,"d":0,"confRate":57.1,"planId":"92259115"},{"loc":"HW","dept":"Guest Services","team":"Parking","c":6,"u":5,"d":1,"confRate":54.5,"planId":"92151843"},{"loc":"HW","dept":"Action Kids","team":"Kids Preschool","c":10,"u":4,"d":9,"confRate":71.4,"planId":"92145115"},{"loc":"HW","dept":"Guest Services","team":"Prayer","c":11,"u":4,"d":6,"confRate":73.3,"planId":"92151843"},{"loc":"HW","dept":"Guest Services","team":"Greeters","c":11,"u":3,"d":6,"confRate":78.6,"planId":"92151843"},{"loc":"HW","dept":"Guest Services","team":"Connect","c":3,"u":2,"d":2,"confRate":60.0,"planId":"92151843"},{"loc":"HW","dept":"Action Kids","team":"Kids Check-In","c":4,"u":2,"d":1,"confRate":66.7,"planId":"92145115"},{"loc":"HW","dept":"Action Kids","team":"Setup Team","c":2,"u":1,"d":0,"confRate":66.7,"planId":"92145115"},{"loc":"HW","dept":"Weekend Service","team":"Communicators","c":0,"u":1,"d":0,"confRate":0.0,"planId":"92259115"},{"loc":"HW","dept":"Guest Services","team":"Coach","c":3,"u":0,"d":4,"confRate":100.0,"planId":"92151843"},{"loc":"HW","dept":"Guest Services","team":"Hospitality","c":2,"u":0,"d":3,"confRate":100.0,"planId":"92151843"}]},"SF":{"c":113,"u":36,"d":43,"openNeeded":98,"confRate":75.8,"declineRate":22.4,"depts":[{"dept":"Weekend Service","c":27,"u":2,"d":0,"confRate":93.1},{"dept":"Guest Services","c":55,"u":28,"d":34,"confRate":66.3},{"dept":"Action Kids","c":31,"u":6,"d":9,"confRate":83.8}],"teams":[{"loc":"SF","dept":"Guest Services","team":"Guest Services","c":42,"u":25,"d":32,"confRate":62.7,"planId":"92294241"},{"loc":"SF","dept":"Action Kids","team":"Pre-School","c":21,"u":5,"d":9,"confRate":80.8,"planId":"92096943"},{"loc":"SF","dept":"Guest Services","team":"Prayer Team","c":13,"u":3,"d":2,"confRate":81.2,"planId":"92294241"},{"loc":"SF","dept":"Weekend Service","team":"Sign Language","c":4,"u":2,"d":0,"confRate":66.7,"planId":"91922141"},{"loc":"SF","dept":"Action Kids","team":"KT1 - 2nd","c":5,"u":1,"d":0,"confRate":83.3,"planId":"92096943"},{"loc":"SF","dept":"Weekend Service","team":"Production","c":8,"u":0,"d":0,"confRate":100.0,"planId":"91922141"},{"loc":"SF","dept":"Weekend Service","team":"Band","c":6,"u":0,"d":0,"confRate":100.0,"planId":"91922141"},{"loc":"SF","dept":"Weekend Service","team":"Vocals","c":5,"u":0,"d":0,"confRate":100.0,"planId":"91922141"},{"loc":"SF","dept":"Action Kids","team":"Service Coordinator","c":4,"u":0,"d":0,"confRate":100.0,"planId":"92096943"},{"loc":"SF","dept":"Weekend Service","team":"Leadership","c":2,"u":0,"d":0,"confRate":100.0,"planId":"91922141"},{"loc":"SF","dept":"Weekend Service","team":"Host","c":1,"u":0,"d":0,"confRate":100.0,"planId":"91922141"},{"loc":"SF","dept":"Action Kids","team":"KT2- 3rd, 4th, 5th","c":1,"u":0,"d":0,"confRate":100.0,"planId":"92096943"}]},"WP":{"c":332,"u":237,"d":199,"openNeeded":301,"confRate":58.3,"declineRate":25.9,"depts":[{"dept":"Weekend Service","c":57,"u":13,"d":15,"confRate":81.4},{"dept":"Guest Services","c":182,"u":121,"d":124,"confRate":60.1},{"dept":"Action Kids","c":93,"u":103,"d":60,"confRate":47.4}],"teams":[{"loc":"WP","dept":"Action Kids","team":"Kids Preschool","c":62,"u":84,"d":44,"confRate":42.5,"planId":"92300122"},{"loc":"WP","dept":"Guest Services","team":"Greeter Team","c":48,"u":38,"d":47,"confRate":55.8,"planId":"92297705"},{"loc":"WP","dept":"Guest Services","team":"Parking Team","c":15,"u":23,"d":12,"confRate":39.5,"planId":"92297705"},{"loc":"WP","dept":"Action Kids","team":"Kids Theater","c":22,"u":17,"d":11,"confRate":56.4,"planId":"92300122"},{"loc":"WP","dept":"Guest Services","team":"Prayer Team","c":19,"u":16,"d":9,"confRate":54.3,"planId":"92297705"},{"loc":"WP","dept":"Guest Services","team":"Usher Team","c":22,"u":15,"d":14,"confRate":59.5,"planId":"92297705"},{"loc":"WP","dept":"Weekend Service","team":"Choir-WP","c":20,"u":11,"d":9,"confRate":64.5,"planId":"91481065"},{"loc":"WP","dept":"Guest Services","team":"Connect Team","c":29,"u":10,"d":20,"confRate":74.4,"planId":"92297705"},{"loc":"WP","dept":"Guest Services","team":"Safety Team","c":20,"u":10,"d":11,"confRate":66.7,"planId":"92297705"},{"loc":"WP","dept":"Guest Services","team":"Admin Team","c":10,"u":4,"d":4,"confRate":71.4,"planId":"92297705"},{"loc":"WP","dept":"Guest Services","team":"Hospitality Team","c":9,"u":2,"d":5,"confRate":81.8,"planId":"92297705"},{"loc":"WP","dept":"Guest Services","team":"Coach - Guest Services","c":7,"u":2,"d":0,"confRate":77.8,"planId":"92297705"}]},"OV":{"c":108,"u":49,"d":73,"openNeeded":296,"confRate":68.8,"declineRate":31.7,"depts":[{"dept":"Weekend Service","c":30,"u":0,"d":1,"confRate":100.0},{"dept":"Guest Services","c":51,"u":36,"d":42,"confRate":58.6},{"dept":"Action Kids","c":27,"u":13,"d":30,"confRate":67.5}],"teams":[{"loc":"OV","dept":"Action Kids","team":"Preschool","c":14,"u":9,"d":20,"confRate":60.9,"planId":"92233709"},{"loc":"OV","dept":"Guest Services","team":"Ushers","c":6,"u":9,"d":5,"confRate":40.0,"planId":"92237542"},{"loc":"OV","dept":"Guest Services","team":"Parking","c":8,"u":8,"d":4,"confRate":50.0,"planId":"92237542"},{"loc":"OV","dept":"Guest Services","team":"Safety","c":3,"u":6,"d":2,"confRate":33.3,"planId":"92237542"},{"loc":"OV","dept":"Guest Services","team":"Greeters","c":16,"u":5,"d":17,"confRate":76.2,"planId":"92237542"},{"loc":"OV","dept":"Action Kids","team":"Theater","c":8,"u":2,"d":5,"confRate":80.0,"planId":"92233709"},{"loc":"OV","dept":"Guest Services","team":"Admin","c":2,"u":2,"d":2,"confRate":50.0,"planId":"92237542"},{"loc":"OV","dept":"Guest Services","team":"Connect","c":5,"u":1,"d":4,"confRate":83.3,"planId":"92237542"},{"loc":"OV","dept":"Action Kids","team":"Kids Check-In","c":1,"u":1,"d":3,"confRate":50.0,"planId":"92233709"},{"loc":"OV","dept":"Guest Services","team":"Coaches","c":3,"u":1,"d":2,"confRate":75.0,"planId":"92237542"},{"loc":"OV","dept":"Guest Services","team":"Hospitality","c":3,"u":1,"d":2,"confRate":75.0,"planId":"92237542"},{"loc":"OV","dept":"Guest Services","team":"New Here","c":3,"u":1,"d":2,"confRate":75.0,"planId":"92237542"}]},"WS":{"c":70,"u":29,"d":37,"openNeeded":43,"confRate":70.7,"declineRate":27.2,"depts":[{"dept":"Weekend Service","c":13,"u":2,"d":1,"confRate":86.7},{"dept":"Guest Services","c":37,"u":20,"d":25,"confRate":64.9},{"dept":"Action Kids","c":20,"u":7,"d":11,"confRate":74.1}],"teams":[{"loc":"WS","dept":"Action Kids","team":"Action Kids","c":16,"u":6,"d":10,"confRate":72.7,"planId":"92094495"},{"loc":"WS","dept":"Guest Services","team":"Parking","c":3,"u":4,"d":3,"confRate":42.9,"planId":"92207624"},{"loc":"WS","dept":"Guest Services","team":"Prayer Team","c":5,"u":4,"d":0,"confRate":55.6,"planId":"92207624"},{"loc":"WS","dept":"Guest Services","team":"Guest Services","c":6,"u":3,"d":11,"confRate":66.7,"planId":"92207624"},{"loc":"WS","dept":"Guest Services","team":"Safety","c":1,"u":3,"d":2,"confRate":25.0,"planId":"92207624"},{"loc":"WS","dept":"Guest Services","team":"Set Up Team","c":5,"u":3,"d":1,"confRate":62.5,"planId":"92207624"},{"loc":"WS","dept":"Guest Services","team":"Tear Down","c":3,"u":2,"d":2,"confRate":60.0,"planId":"92207624"},{"loc":"WS","dept":"Weekend Service","team":"ASL","c":1,"u":2,"d":0,"confRate":33.3,"planId":"92092980"},{"loc":"WS","dept":"Guest Services","team":"Hospitality","c":6,"u":1,"d":0,"confRate":85.7,"planId":"92207624"},{"loc":"WS","dept":"Action Kids","team":"Child Care","c":2,"u":1,"d":0,"confRate":66.7,"planId":"92094495"},{"loc":"WS","dept":"Guest Services","team":"Usher","c":6,"u":0,"d":4,"confRate":100.0,"planId":"92207624"},{"loc":"WS","dept":"Guest Services","team":"Coach","c":2,"u":0,"d":2,"confRate":100.0,"planId":"92207624"}]}},"monthly":{"ALL":{"c":3010,"u":1207,"d":1652,"openNeeded":839,"confRate":71.4,"declineRate":28.1,"depts":[{"dept":"Weekend Service","c":565,"u":45,"d":80,"confRate":92.6},{"dept":"Guest Services","c":1619,"u":686,"d":1002,"confRate":70.2},{"dept":"Action Kids","c":826,"u":476,"d":570,"confRate":63.4}],"teams":[]},"HW":{"c":424,"u":103,"d":174,"openNeeded":101,"confRate":80.5,"declineRate":24.8,"depts":[{"dept":"Weekend Service","c":101,"u":8,"d":11,"confRate":92.7},{"dept":"Guest Services","c":214,"u":52,"d":87,"confRate":80.5},{"dept":"Action Kids","c":109,"u":43,"d":76,"confRate":71.7}],"teams":[{"loc":"HW","dept":"Action Kids","team":"Kids Theater","c":33,"u":17,"d":27,"confRate":66.0,"planId":"92145115"},{"loc":"HW","dept":"Action Kids","team":"Kids Preschool","c":37,"u":15,"d":35,"confRate":71.2,"planId":"92145115"},{"loc":"HW","dept":"Guest Services","team":"Parking","c":26,"u":13,"d":7,"confRate":66.7,"planId":"92151843"},{"loc":"HW","dept":"Guest Services","team":"Prayer","c":55,"u":11,"d":21,"confRate":83.3,"planId":"92151843"},{"loc":"HW","dept":"Guest Services","team":"Greeters","c":40,"u":10,"d":23,"confRate":80.0,"planId":"92151843"},{"loc":"HW","dept":"Guest Services","team":"Hospitality","c":9,"u":8,"d":4,"confRate":52.9,"planId":"92151843"},{"loc":"HW","dept":"Weekend Service","team":"Production","c":36,"u":6,"d":10,"confRate":85.7,"planId":"92259115"},{"loc":"HW","dept":"Guest Services","team":"Connect","c":17,"u":6,"d":7,"confRate":73.9,"planId":"92151843"},{"loc":"HW","dept":"Action Kids","team":"Kids Check-In","c":11,"u":4,"d":10,"confRate":73.3,"planId":"92145115"},{"loc":"HW","dept":"Action Kids","team":"Setup Team","c":6,"u":4,"d":2,"confRate":60.0,"planId":"92145115"},{"loc":"HW","dept":"Guest Services","team":"Ushers","c":29,"u":3,"d":11,"confRate":90.6,"planId":"92151843"},{"loc":"HW","dept":"Action Kids","team":"Staff Childcare 7 AM","c":5,"u":3,"d":0,"confRate":62.5,"planId":"92145115"}]},"SF":{"c":447,"u":92,"d":229,"openNeeded":98,"confRate":82.9,"declineRate":29.8,"depts":[{"dept":"Weekend Service","c":110,"u":8,"d":17,"confRate":93.2},{"dept":"Guest Services","c":227,"u":58,"d":158,"confRate":79.6},{"dept":"Action Kids","c":110,"u":26,"d":54,"confRate":80.9}],"teams":[{"loc":"SF","dept":"Guest Services","team":"Guest Services","c":182,"u":46,"d":142,"confRate":79.8,"planId":"92294241"},{"loc":"SF","dept":"Action Kids","team":"Pre-School","c":78,"u":18,"d":42,"confRate":81.2,"planId":"92096943"},{"loc":"SF","dept":"Guest Services","team":"Prayer Team","c":45,"u":12,"d":16,"confRate":78.9,"planId":"92294241"},{"loc":"SF","dept":"Weekend Service","team":"Sign Language","c":14,"u":8,"d":2,"confRate":63.6,"planId":"91922141"},{"loc":"SF","dept":"Action Kids","team":"KT1 - 2nd","c":18,"u":7,"d":8,"confRate":72.0,"planId":"92096943"},{"loc":"SF","dept":"Action Kids","team":"KT2- 3rd, 4th, 5th","c":1,"u":1,"d":0,"confRate":50.0,"planId":"92096943"},{"loc":"SF","dept":"Weekend Service","team":"Vocals","c":20,"u":0,"d":7,"confRate":100.0,"planId":"91922141"},{"loc":"SF","dept":"Action Kids","team":"Service Coordinator","c":13,"u":0,"d":4,"confRate":100.0,"planId":"92096943"},{"loc":"SF","dept":"Weekend Service","team":"Band","c":25,"u":0,"d":3,"confRate":100.0,"planId":"91922141"},{"loc":"SF","dept":"Weekend Service","team":"Sunday Choir","c":8,"u":0,"d":3,"confRate":100.0,"planId":"91922139"},{"loc":"SF","dept":"Weekend Service","team":"Production","c":28,"u":0,"d":1,"confRate":100.0,"planId":"91922141"},{"loc":"SF","dept":"Weekend Service","team":"Leadership","c":9,"u":0,"d":1,"confRate":100.0,"planId":"91922141"}]},"WP":{"c":1346,"u":762,"d":821,"openNeeded":301,"confRate":63.9,"declineRate":28.0,"depts":[{"dept":"Weekend Service","c":186,"u":21,"d":41,"confRate":89.9},{"dept":"Guest Services","c":765,"u":389,"d":509,"confRate":66.3},{"dept":"Action Kids","c":395,"u":352,"d":271,"confRate":52.9}],"teams":[{"loc":"WP","dept":"Action Kids","team":"Kids Preschool","c":268,"u":284,"d":200,"confRate":48.6,"planId":"92300122"},{"loc":"WP","dept":"Guest Services","team":"Greeter Team","c":183,"u":119,"d":213,"confRate":60.6,"planId":"92297705"},{"loc":"WP","dept":"Guest Services","team":"Parking Team","c":75,"u":69,"d":39,"confRate":52.1,"planId":"92297705"},{"loc":"WP","dept":"Action Kids","team":"Kids Theater","c":89,"u":62,"d":51,"confRate":58.9,"planId":"92300122"},{"loc":"WP","dept":"Guest Services","team":"Prayer Team","c":83,"u":54,"d":39,"confRate":60.6,"planId":"92297705"},{"loc":"WP","dept":"Guest Services","team":"Usher Team","c":110,"u":41,"d":51,"confRate":72.8,"planId":"92297705"},{"loc":"WP","dept":"Guest Services","team":"Connect Team","c":115,"u":33,"d":81,"confRate":77.7,"planId":"92297705"},{"loc":"WP","dept":"Guest Services","team":"Safety Team","c":80,"u":32,"d":50,"confRate":71.4,"planId":"92297705"},{"loc":"WP","dept":"Guest Services","team":"Admin Team","c":34,"u":22,"d":16,"confRate":60.7,"planId":"92297705"},{"loc":"WP","dept":"Weekend Service","team":"Choir-WP","c":43,"u":16,"d":20,"confRate":72.9,"planId":"91481065"},{"loc":"WP","dept":"Guest Services","team":"Hospitality Team","c":40,"u":11,"d":13,"confRate":78.4,"planId":"92297705"},{"loc":"WP","dept":"Guest Services","team":"Environment Team","c":16,"u":4,"d":4,"confRate":80.0,"planId":"92297705"}]},"OV":{"c":464,"u":162,"d":287,"openNeeded":296,"confRate":74.1,"declineRate":31.4,"depts":[{"dept":"Weekend Service","c":104,"u":1,"d":9,"confRate":99.0},{"dept":"Guest Services","c":230,"u":128,"d":156,"confRate":64.2},{"dept":"Action Kids","c":130,"u":33,"d":122,"confRate":79.8}],"teams":[{"loc":"OV","dept":"Guest Services","team":"Parking","c":34,"u":34,"d":12,"confRate":50.0,"planId":"92237542"},{"loc":"OV","dept":"Guest Services","team":"Safety","c":10,"u":26,"d":8,"confRate":27.8,"planId":"92237542"},{"loc":"OV","dept":"Guest Services","team":"Ushers","c":31,"u":25,"d":23,"confRate":55.4,"planId":"92237542"},{"loc":"OV","dept":"Action Kids","team":"Preschool","c":70,"u":21,"d":78,"confRate":76.9,"planId":"92233709"},{"loc":"OV","dept":"Guest Services","team":"Greeters","c":62,"u":16,"d":73,"confRate":79.5,"planId":"92237542"},{"loc":"OV","dept":"Action Kids","team":"Theater","c":34,"u":8,"d":22,"confRate":81.0,"planId":"92233709"},{"loc":"OV","dept":"Guest Services","team":"Admin","c":9,"u":8,"d":7,"confRate":52.9,"planId":"92237542"},{"loc":"OV","dept":"Guest Services","team":"Hospitality","c":11,"u":6,"d":7,"confRate":64.7,"planId":"92237542"},{"loc":"OV","dept":"Guest Services","team":"Hospitality Set-Up Team","c":7,"u":4,"d":1,"confRate":63.6,"planId":"92237542"},{"loc":"OV","dept":"Guest Services","team":"Set-Up Team","c":3,"u":4,"d":1,"confRate":42.9,"planId":"92237542"},{"loc":"OV","dept":"Action Kids","team":"Kids Check-In","c":2,"u":3,"d":15,"confRate":40.0,"planId":"92233709"},{"loc":"OV","dept":"Guest Services","team":"Connect","c":27,"u":2,"d":11,"confRate":93.1,"planId":"92237542"}]},"WS":{"c":329,"u":88,"d":141,"openNeeded":43,"confRate":78.9,"declineRate":25.3,"depts":[{"dept":"Weekend Service","c":64,"u":7,"d":2,"confRate":90.1},{"dept":"Guest Services","c":183,"u":59,"d":92,"confRate":75.6},{"dept":"Action Kids","c":82,"u":22,"d":47,"confRate":78.8}],"teams":[{"loc":"WS","dept":"Action Kids","team":"Action Kids","c":70,"u":18,"d":42,"confRate":79.5,"planId":"92094495"},{"loc":"WS","dept":"Guest Services","team":"Guest Services","c":38,"u":14,"d":26,"confRate":73.1,"planId":"92207624"},{"loc":"WS","dept":"Guest Services","team":"Set Up Team","c":23,"u":10,"d":5,"confRate":69.7,"planId":"92207624"},{"loc":"WS","dept":"Guest Services","team":"Safety","c":13,"u":9,"d":6,"confRate":59.1,"planId":"92207624"},{"loc":"WS","dept":"Guest Services","team":"Parking","c":22,"u":8,"d":10,"confRate":73.3,"planId":"92207624"},{"loc":"WS","dept":"Guest Services","team":"Tear Down","c":15,"u":8,"d":5,"confRate":65.2,"planId":"92207624"},{"loc":"WS","dept":"Weekend Service","team":"ASL","c":6,"u":7,"d":1,"confRate":46.2,"planId":"92092980"},{"loc":"WS","dept":"Guest Services","team":"Prayer Team","c":23,"u":5,"d":8,"confRate":82.1,"planId":"92207624"},{"loc":"WS","dept":"Guest Services","team":"Usher","c":22,"u":3,"d":17,"confRate":88.0,"planId":"92207624"},{"loc":"WS","dept":"Action Kids","team":"Child Care","c":6,"u":3,"d":0,"confRate":66.7,"planId":"92094495"},{"loc":"WS","dept":"Guest Services","team":"Hospitality","c":21,"u":2,"d":5,"confRate":91.3,"planId":"92207624"},{"loc":"WS","dept":"Action Kids","team":"Set-up Team","c":6,"u":1,"d":5,"confRate":85.7,"planId":"92094495"}]}},"quarterly":{"ALL":{"c":6203,"u":2150,"d":3159,"openNeeded":839,"confRate":74.3,"declineRate":27.4,"depts":[{"dept":"Weekend Service","c":1357,"u":124,"d":200,"confRate":91.6},{"dept":"Guest Services","c":3126,"u":1250,"d":1921,"confRate":71.4},{"dept":"Action Kids","c":1720,"u":776,"d":1038,"confRate":68.9}],"teams":[]},"HW":{"c":1227,"u":347,"d":352,"openNeeded":101,"confRate":78.0,"declineRate":18.3,"depts":[{"dept":"Weekend Service","c":345,"u":42,"d":44,"confRate":89.1},{"dept":"Guest Services","c":512,"u":236,"d":212,"confRate":68.4},{"dept":"Action Kids","c":370,"u":69,"d":96,"confRate":84.3}],"teams":[{"loc":"HW","dept":"Guest Services","team":"Prayer","c":55,"u":64,"d":21,"confRate":46.2,"planId":"92151843"},{"loc":"HW","dept":"Guest Services","team":"Parking","c":61,"u":59,"d":16,"confRate":50.8,"planId":"92151843"},{"loc":"HW","dept":"Action Kids","team":"Kids Theater","c":127,"u":37,"d":36,"confRate":77.4,"planId":"92145115"},{"loc":"HW","dept":"Guest Services","team":"Greeters","c":120,"u":36,"d":52,"confRate":76.9,"planId":"92151843"},{"loc":"HW","dept":"Guest Services","team":"Admin","c":0,"u":30,"d":0,"confRate":0.0,"planId":"90812601"},{"loc":"HW","dept":"Guest Services","team":"Connect","c":62,"u":24,"d":32,"confRate":72.1,"planId":"92151843"},{"loc":"HW","dept":"Action Kids","team":"Kids Preschool","c":147,"u":16,"d":42,"confRate":90.2,"planId":"92145115"},{"loc":"HW","dept":"Weekend Service","team":"Production","c":129,"u":16,"d":32,"confRate":89.0,"planId":"92259115"},{"loc":"HW","dept":"Weekend Service","team":"Vocals","c":100,"u":15,"d":9,"confRate":87.0,"planId":"92259115"},{"loc":"HW","dept":"Guest Services","team":"Hospitality","c":25,"u":13,"d":10,"confRate":65.8,"planId":"92151843"},{"loc":"HW","dept":"Guest Services","team":"Safety","c":69,"u":7,"d":28,"confRate":90.8,"planId":"92151843"},{"loc":"HW","dept":"Action Kids","team":"Kids Check-In","c":40,"u":7,"d":12,"confRate":85.1,"planId":"92145115"}]},"SF":{"c":1635,"u":281,"d":900,"openNeeded":98,"confRate":85.3,"declineRate":32.0,"depts":[{"dept":"Weekend Service","c":370,"u":34,"d":50,"confRate":91.6},{"dept":"Guest Services","c":849,"u":168,"d":610,"confRate":83.5},{"dept":"Action Kids","c":416,"u":79,"d":240,"confRate":84.0}],"teams":[{"loc":"SF","dept":"Guest Services","team":"Guest Services","c":705,"u":124,"d":540,"confRate":85.0,"planId":"92294241"},{"loc":"SF","dept":"Action Kids","team":"Pre-School","c":297,"u":56,"d":188,"confRate":84.1,"planId":"92096943"},{"loc":"SF","dept":"Guest Services","team":"Prayer Team","c":144,"u":44,"d":70,"confRate":76.6,"planId":"92294241"},{"loc":"SF","dept":"Weekend Service","team":"Sign Language","c":49,"u":32,"d":13,"confRate":60.5,"planId":"91922141"},{"loc":"SF","dept":"Action Kids","team":"KT1 - 2nd","c":65,"u":12,"d":29,"confRate":84.4,"planId":"92096943"},{"loc":"SF","dept":"Action Kids","team":"KT2- 3rd, 4th, 5th","c":8,"u":7,"d":8,"confRate":53.3,"planId":"92096943"},{"loc":"SF","dept":"Action Kids","team":"Service Coordinator","c":46,"u":4,"d":15,"confRate":92.0,"planId":"92096943"},{"loc":"SF","dept":"Weekend Service","team":"Sunday Choir","c":25,"u":1,"d":5,"confRate":96.2,"planId":"90392698"},{"loc":"SF","dept":"Weekend Service","team":"Leadership","c":30,"u":1,"d":1,"confRate":96.8,"planId":"91922141"},{"loc":"SF","dept":"Weekend Service","team":"Band","c":78,"u":0,"d":14,"confRate":100.0,"planId":"91922141"},{"loc":"SF","dept":"Weekend Service","team":"Vocals","c":70,"u":0,"d":12,"confRate":100.0,"planId":"91922141"},{"loc":"SF","dept":"Weekend Service","team":"Production","c":101,"u":0,"d":5,"confRate":100.0,"planId":"91922141"}]},"WP":{"c":1817,"u":1024,"d":1087,"openNeeded":301,"confRate":64.0,"declineRate":27.7,"depts":[{"dept":"Weekend Service","c":339,"u":33,"d":75,"confRate":91.1},{"dept":"Guest Services","c":939,"u":496,"d":628,"confRate":65.4},{"dept":"Action Kids","c":539,"u":495,"d":384,"confRate":52.1}],"teams":[{"loc":"WP","dept":"Action Kids","team":"Kids Preschool","c":383,"u":405,"d":297,"confRate":48.6,"planId":"92300122"},{"loc":"WP","dept":"Guest Services","team":"Greeter Team","c":259,"u":163,"d":279,"confRate":61.4,"planId":"92297705"},{"loc":"WP","dept":"Action Kids","team":"Kids Theater","c":116,"u":84,"d":65,"confRate":58.0,"planId":"92300122"},{"loc":"WP","dept":"Guest Services","team":"Parking Team","c":89,"u":84,"d":48,"confRate":51.4,"planId":"92297705"},{"loc":"WP","dept":"Guest Services","team":"Prayer Team","c":87,"u":54,"d":39,"confRate":61.7,"planId":"92297705"},{"loc":"WP","dept":"Guest Services","team":"Usher Team","c":141,"u":53,"d":67,"confRate":72.7,"planId":"92297705"},{"loc":"WP","dept":"Guest Services","team":"Connect Team","c":133,"u":46,"d":92,"confRate":74.3,"planId":"92297705"},{"loc":"WP","dept":"Guest Services","team":"Safety Team","c":98,"u":46,"d":54,"confRate":68.1,"planId":"92297705"},{"loc":"WP","dept":"Guest Services","team":"Admin Team","c":40,"u":27,"d":22,"confRate":59.7,"planId":"92297705"},{"loc":"WP","dept":"Weekend Service","team":"Choir-WP","c":55,"u":25,"d":35,"confRate":68.8,"planId":"91481065"},{"loc":"WP","dept":"Guest Services","team":"Hospitality Team","c":47,"u":15,"d":20,"confRate":75.8,"planId":"92297705"},{"loc":"WP","dept":"Guest Services","team":"Environment Team","c":16,"u":4,"d":4,"confRate":80.0,"planId":"92297705"}]},"OV":{"c":861,"u":345,"d":538,"openNeeded":296,"confRate":71.4,"declineRate":30.8,"depts":[{"dept":"Weekend Service","c":189,"u":3,"d":28,"confRate":98.4},{"dept":"Guest Services","c":418,"u":247,"d":279,"confRate":62.9},{"dept":"Action Kids","c":254,"u":95,"d":231,"confRate":72.8}],"teams":[{"loc":"OV","dept":"Guest Services","team":"Parking","c":58,"u":70,"d":28,"confRate":45.3,"planId":"92237542"},{"loc":"OV","dept":"Action Kids","team":"Preschool","c":133,"u":68,"d":152,"confRate":66.2,"planId":"92233709"},{"loc":"OV","dept":"Guest Services","team":"Ushers","c":51,"u":50,"d":46,"confRate":50.5,"planId":"92237542"},{"loc":"OV","dept":"Guest Services","team":"Safety","c":23,"u":48,"d":15,"confRate":32.4,"planId":"92237542"},{"loc":"OV","dept":"Guest Services","team":"Greeters","c":126,"u":24,"d":124,"confRate":84.0,"planId":"92237542"},{"loc":"OV","dept":"Action Kids","team":"Theater","c":69,"u":16,"d":39,"confRate":81.2,"planId":"92233709"},{"loc":"OV","dept":"Guest Services","team":"Admin","c":15,"u":16,"d":10,"confRate":48.4,"planId":"92237542"},{"loc":"OV","dept":"Guest Services","team":"Set-Up Team","c":7,"u":12,"d":1,"confRate":36.8,"planId":"92237542"},{"loc":"OV","dept":"Action Kids","team":"Kids Check-In","c":5,"u":10,"d":25,"confRate":33.3,"planId":"92233709"},{"loc":"OV","dept":"Guest Services","team":"Hospitality","c":21,"u":9,"d":15,"confRate":70.0,"planId":"92237542"},{"loc":"OV","dept":"Guest Services","team":"Hospitality Set-Up Team","c":11,"u":7,"d":1,"confRate":61.1,"planId":"92237542"},{"loc":"OV","dept":"Guest Services","team":"Connect","c":46,"u":5,"d":20,"confRate":90.2,"planId":"92237542"}]},"WS":{"c":663,"u":153,"d":282,"openNeeded":43,"confRate":81.2,"declineRate":25.7,"depts":[{"dept":"Weekend Service","c":114,"u":12,"d":3,"confRate":90.5},{"dept":"Guest Services","c":408,"u":103,"d":192,"confRate":79.8},{"dept":"Action Kids","c":141,"u":38,"d":87,"confRate":78.8}],"teams":[{"loc":"WS","dept":"Guest Services","team":"Guest Services","c":82,"u":32,"d":58,"confRate":71.9,"planId":"92207624"},{"loc":"WS","dept":"Action Kids","team":"Action Kids","c":120,"u":30,"d":78,"confRate":80.0,"planId":"92094495"},{"loc":"WS","dept":"Guest Services","team":"Set Up Team","c":49,"u":16,"d":12,"confRate":75.4,"planId":"92207624"},{"loc":"WS","dept":"Guest Services","team":"Safety","c":27,"u":14,"d":19,"confRate":65.9,"planId":"92207624"},{"loc":"WS","dept":"Guest Services","team":"Parking","c":49,"u":13,"d":21,"confRate":79.0,"planId":"92207624"},{"loc":"WS","dept":"Guest Services","team":"Tear Down","c":33,"u":11,"d":14,"confRate":75.0,"planId":"92207624"},{"loc":"WS","dept":"Weekend Service","team":"ASL","c":13,"u":11,"d":1,"confRate":54.2,"planId":"92092980"},{"loc":"WS","dept":"Guest Services","team":"Prayer Team","c":52,"u":8,"d":14,"confRate":86.7,"planId":"92207624"},{"loc":"WS","dept":"Action Kids","team":"Child Care","c":10,"u":7,"d":0,"confRate":58.8,"planId":"92094495"},{"loc":"WS","dept":"Guest Services","team":"Hospitality","c":39,"u":5,"d":12,"confRate":88.6,"planId":"92207624"},{"loc":"WS","dept":"Guest Services","team":"Usher","c":56,"u":4,"d":30,"confRate":93.3,"planId":"92207624"},{"loc":"WS","dept":"Action Kids","team":"Set-up Team","c":11,"u":1,"d":9,"confRate":91.7,"planId":"92094495"}]}},"semiannual":{"ALL":{"c":6322,"u":2159,"d":3229,"openNeeded":839,"confRate":74.5,"declineRate":27.6,"depts":[{"dept":"Weekend Service","c":1380,"u":127,"d":202,"confRate":91.6},{"dept":"Guest Services","c":3188,"u":1254,"d":1969,"confRate":71.8},{"dept":"Action Kids","c":1754,"u":778,"d":1058,"confRate":69.3}],"teams":[]},"HW":{"c":1227,"u":347,"d":352,"openNeeded":101,"confRate":78.0,"declineRate":18.3,"depts":[{"dept":"Weekend Service","c":345,"u":42,"d":44,"confRate":89.1},{"dept":"Guest Services","c":512,"u":236,"d":212,"confRate":68.4},{"dept":"Action Kids","c":370,"u":69,"d":96,"confRate":84.3}],"teams":[{"loc":"HW","dept":"Guest Services","team":"Prayer","c":55,"u":64,"d":21,"confRate":46.2,"planId":"92151843"},{"loc":"HW","dept":"Guest Services","team":"Parking","c":61,"u":59,"d":16,"confRate":50.8,"planId":"92151843"},{"loc":"HW","dept":"Action Kids","team":"Kids Theater","c":127,"u":37,"d":36,"confRate":77.4,"planId":"92145115"},{"loc":"HW","dept":"Guest Services","team":"Greeters","c":120,"u":36,"d":52,"confRate":76.9,"planId":"92151843"},{"loc":"HW","dept":"Guest Services","team":"Admin","c":0,"u":30,"d":0,"confRate":0.0,"planId":"90812601"},{"loc":"HW","dept":"Guest Services","team":"Connect","c":62,"u":24,"d":32,"confRate":72.1,"planId":"92151843"},{"loc":"HW","dept":"Action Kids","team":"Kids Preschool","c":147,"u":16,"d":42,"confRate":90.2,"planId":"92145115"},{"loc":"HW","dept":"Weekend Service","team":"Production","c":129,"u":16,"d":32,"confRate":89.0,"planId":"92259115"},{"loc":"HW","dept":"Weekend Service","team":"Vocals","c":100,"u":15,"d":9,"confRate":87.0,"planId":"92259115"},{"loc":"HW","dept":"Guest Services","team":"Hospitality","c":25,"u":13,"d":10,"confRate":65.8,"planId":"92151843"},{"loc":"HW","dept":"Guest Services","team":"Safety","c":69,"u":7,"d":28,"confRate":90.8,"planId":"92151843"},{"loc":"HW","dept":"Action Kids","team":"Kids Check-In","c":40,"u":7,"d":12,"confRate":85.1,"planId":"92145115"}]},"SF":{"c":1754,"u":290,"d":970,"openNeeded":98,"confRate":85.8,"declineRate":32.2,"depts":[{"dept":"Weekend Service","c":393,"u":37,"d":52,"confRate":91.4},{"dept":"Guest Services","c":911,"u":172,"d":658,"confRate":84.1},{"dept":"Action Kids","c":450,"u":81,"d":260,"confRate":84.7}],"teams":[{"loc":"SF","dept":"Guest Services","team":"Guest Services","c":756,"u":125,"d":585,"confRate":85.8,"planId":"92294241"},{"loc":"SF","dept":"Action Kids","team":"Pre-School","c":322,"u":58,"d":205,"confRate":84.7,"planId":"92096943"},{"loc":"SF","dept":"Guest Services","team":"Prayer Team","c":155,"u":47,"d":73,"confRate":76.7,"planId":"92294241"},{"loc":"SF","dept":"Weekend Service","team":"Sign Language","c":52,"u":35,"d":14,"confRate":59.8,"planId":"91922141"},{"loc":"SF","dept":"Action Kids","team":"KT1 - 2nd","c":70,"u":12,"d":30,"confRate":85.4,"planId":"92096943"},{"loc":"SF","dept":"Action Kids","team":"KT2- 3rd, 4th, 5th","c":8,"u":7,"d":10,"confRate":53.3,"planId":"92096943"},{"loc":"SF","dept":"Action Kids","team":"Service Coordinator","c":50,"u":4,"d":15,"confRate":92.6,"planId":"92096943"},{"loc":"SF","dept":"Weekend Service","team":"Sunday Choir","c":25,"u":1,"d":5,"confRate":96.2,"planId":"90392698"},{"loc":"SF","dept":"Weekend Service","team":"Leadership","c":32,"u":1,"d":1,"confRate":97.0,"planId":"91922141"},{"loc":"SF","dept":"Weekend Service","team":"Band","c":82,"u":0,"d":14,"confRate":100.0,"planId":"91922141"},{"loc":"SF","dept":"Weekend Service","team":"Vocals","c":75,"u":0,"d":13,"confRate":100.0,"planId":"91922141"},{"loc":"SF","dept":"Weekend Service","team":"Production","c":109,"u":0,"d":5,"confRate":100.0,"planId":"91922141"}]},"WP":{"c":1817,"u":1024,"d":1087,"openNeeded":301,"confRate":64.0,"declineRate":27.7,"depts":[{"dept":"Weekend Service","c":339,"u":33,"d":75,"confRate":91.1},{"dept":"Guest Services","c":939,"u":496,"d":628,"confRate":65.4},{"dept":"Action Kids","c":539,"u":495,"d":384,"confRate":52.1}],"teams":[{"loc":"WP","dept":"Action Kids","team":"Kids Preschool","c":383,"u":405,"d":297,"confRate":48.6,"planId":"92300122"},{"loc":"WP","dept":"Guest Services","team":"Greeter Team","c":259,"u":163,"d":279,"confRate":61.4,"planId":"92297705"},{"loc":"WP","dept":"Action Kids","team":"Kids Theater","c":116,"u":84,"d":65,"confRate":58.0,"planId":"92300122"},{"loc":"WP","dept":"Guest Services","team":"Parking Team","c":89,"u":84,"d":48,"confRate":51.4,"planId":"92297705"},{"loc":"WP","dept":"Guest Services","team":"Prayer Team","c":87,"u":54,"d":39,"confRate":61.7,"planId":"92297705"},{"loc":"WP","dept":"Guest Services","team":"Usher Team","c":141,"u":53,"d":67,"confRate":72.7,"planId":"92297705"},{"loc":"WP","dept":"Guest Services","team":"Connect Team","c":133,"u":46,"d":92,"confRate":74.3,"planId":"92297705"},{"loc":"WP","dept":"Guest Services","team":"Safety Team","c":98,"u":46,"d":54,"confRate":68.1,"planId":"92297705"},{"loc":"WP","dept":"Guest Services","team":"Admin Team","c":40,"u":27,"d":22,"confRate":59.7,"planId":"92297705"},{"loc":"WP","dept":"Weekend Service","team":"Choir-WP","c":55,"u":25,"d":35,"confRate":68.8,"planId":"91481065"},{"loc":"WP","dept":"Guest Services","team":"Hospitality Team","c":47,"u":15,"d":20,"confRate":75.8,"planId":"92297705"},{"loc":"WP","dept":"Guest Services","team":"Environment Team","c":16,"u":4,"d":4,"confRate":80.0,"planId":"92297705"}]},"OV":{"c":861,"u":345,"d":538,"openNeeded":296,"confRate":71.4,"declineRate":30.8,"depts":[{"dept":"Weekend Service","c":189,"u":3,"d":28,"confRate":98.4},{"dept":"Guest Services","c":418,"u":247,"d":279,"confRate":62.9},{"dept":"Action Kids","c":254,"u":95,"d":231,"confRate":72.8}],"teams":[{"loc":"OV","dept":"Guest Services","team":"Parking","c":58,"u":70,"d":28,"confRate":45.3,"planId":"92237542"},{"loc":"OV","dept":"Action Kids","team":"Preschool","c":133,"u":68,"d":152,"confRate":66.2,"planId":"92233709"},{"loc":"OV","dept":"Guest Services","team":"Ushers","c":51,"u":50,"d":46,"confRate":50.5,"planId":"92237542"},{"loc":"OV","dept":"Guest Services","team":"Safety","c":23,"u":48,"d":15,"confRate":32.4,"planId":"92237542"},{"loc":"OV","dept":"Guest Services","team":"Greeters","c":126,"u":24,"d":124,"confRate":84.0,"planId":"92237542"},{"loc":"OV","dept":"Action Kids","team":"Theater","c":69,"u":16,"d":39,"confRate":81.2,"planId":"92233709"},{"loc":"OV","dept":"Guest Services","team":"Admin","c":15,"u":16,"d":10,"confRate":48.4,"planId":"92237542"},{"loc":"OV","dept":"Guest Services","team":"Set-Up Team","c":7,"u":12,"d":1,"confRate":36.8,"planId":"92237542"},{"loc":"OV","dept":"Action Kids","team":"Kids Check-In","c":5,"u":10,"d":25,"confRate":33.3,"planId":"92233709"},{"loc":"OV","dept":"Guest Services","team":"Hospitality","c":21,"u":9,"d":15,"confRate":70.0,"planId":"92237542"},{"loc":"OV","dept":"Guest Services","team":"Hospitality Set-Up Team","c":11,"u":7,"d":1,"confRate":61.1,"planId":"92237542"},{"loc":"OV","dept":"Guest Services","team":"Connect","c":46,"u":5,"d":20,"confRate":90.2,"planId":"92237542"}]},"WS":{"c":663,"u":153,"d":282,"openNeeded":43,"confRate":81.2,"declineRate":25.7,"depts":[{"dept":"Weekend Service","c":114,"u":12,"d":3,"confRate":90.5},{"dept":"Guest Services","c":408,"u":103,"d":192,"confRate":79.8},{"dept":"Action Kids","c":141,"u":38,"d":87,"confRate":78.8}],"teams":[{"loc":"WS","dept":"Guest Services","team":"Guest Services","c":82,"u":32,"d":58,"confRate":71.9,"planId":"92207624"},{"loc":"WS","dept":"Action Kids","team":"Action Kids","c":120,"u":30,"d":78,"confRate":80.0,"planId":"92094495"},{"loc":"WS","dept":"Guest Services","team":"Set Up Team","c":49,"u":16,"d":12,"confRate":75.4,"planId":"92207624"},{"loc":"WS","dept":"Guest Services","team":"Safety","c":27,"u":14,"d":19,"confRate":65.9,"planId":"92207624"},{"loc":"WS","dept":"Guest Services","team":"Parking","c":49,"u":13,"d":21,"confRate":79.0,"planId":"92207624"},{"loc":"WS","dept":"Guest Services","team":"Tear Down","c":33,"u":11,"d":14,"confRate":75.0,"planId":"92207624"},{"loc":"WS","dept":"Weekend Service","team":"ASL","c":13,"u":11,"d":1,"confRate":54.2,"planId":"92092980"},{"loc":"WS","dept":"Guest Services","team":"Prayer Team","c":52,"u":8,"d":14,"confRate":86.7,"planId":"92207624"},{"loc":"WS","dept":"Action Kids","team":"Child Care","c":10,"u":7,"d":0,"confRate":58.8,"planId":"92094495"},{"loc":"WS","dept":"Guest Services","team":"Hospitality","c":39,"u":5,"d":12,"confRate":88.6,"planId":"92207624"},{"loc":"WS","dept":"Guest Services","team":"Usher","c":56,"u":4,"d":30,"confRate":93.3,"planId":"92207624"},{"loc":"WS","dept":"Action Kids","team":"Set-up Team","c":11,"u":1,"d":9,"confRate":91.7,"planId":"92094495"}]}},"annual":{"ALL":{"c":6322,"u":2159,"d":3229,"openNeeded":839,"confRate":74.5,"declineRate":27.6,"depts":[{"dept":"Weekend Service","c":1380,"u":127,"d":202,"confRate":91.6},{"dept":"Guest Services","c":3188,"u":1254,"d":1969,"confRate":71.8},{"dept":"Action Kids","c":1754,"u":778,"d":1058,"confRate":69.3}],"teams":[]},"HW":{"c":1227,"u":347,"d":352,"openNeeded":101,"confRate":78.0,"declineRate":18.3,"depts":[{"dept":"Weekend Service","c":345,"u":42,"d":44,"confRate":89.1},{"dept":"Guest Services","c":512,"u":236,"d":212,"confRate":68.4},{"dept":"Action Kids","c":370,"u":69,"d":96,"confRate":84.3}],"teams":[{"loc":"HW","dept":"Guest Services","team":"Prayer","c":55,"u":64,"d":21,"confRate":46.2,"planId":"92151843"},{"loc":"HW","dept":"Guest Services","team":"Parking","c":61,"u":59,"d":16,"confRate":50.8,"planId":"92151843"},{"loc":"HW","dept":"Action Kids","team":"Kids Theater","c":127,"u":37,"d":36,"confRate":77.4,"planId":"92145115"},{"loc":"HW","dept":"Guest Services","team":"Greeters","c":120,"u":36,"d":52,"confRate":76.9,"planId":"92151843"},{"loc":"HW","dept":"Guest Services","team":"Admin","c":0,"u":30,"d":0,"confRate":0.0,"planId":"90812601"},{"loc":"HW","dept":"Guest Services","team":"Connect","c":62,"u":24,"d":32,"confRate":72.1,"planId":"92151843"},{"loc":"HW","dept":"Action Kids","team":"Kids Preschool","c":147,"u":16,"d":42,"confRate":90.2,"planId":"92145115"},{"loc":"HW","dept":"Weekend Service","team":"Production","c":129,"u":16,"d":32,"confRate":89.0,"planId":"92259115"},{"loc":"HW","dept":"Weekend Service","team":"Vocals","c":100,"u":15,"d":9,"confRate":87.0,"planId":"92259115"},{"loc":"HW","dept":"Guest Services","team":"Hospitality","c":25,"u":13,"d":10,"confRate":65.8,"planId":"92151843"},{"loc":"HW","dept":"Guest Services","team":"Safety","c":69,"u":7,"d":28,"confRate":90.8,"planId":"92151843"},{"loc":"HW","dept":"Action Kids","team":"Kids Check-In","c":40,"u":7,"d":12,"confRate":85.1,"planId":"92145115"}]},"SF":{"c":1754,"u":290,"d":970,"openNeeded":98,"confRate":85.8,"declineRate":32.2,"depts":[{"dept":"Weekend Service","c":393,"u":37,"d":52,"confRate":91.4},{"dept":"Guest Services","c":911,"u":172,"d":658,"confRate":84.1},{"dept":"Action Kids","c":450,"u":81,"d":260,"confRate":84.7}],"teams":[{"loc":"SF","dept":"Guest Services","team":"Guest Services","c":756,"u":125,"d":585,"confRate":85.8,"planId":"92294241"},{"loc":"SF","dept":"Action Kids","team":"Pre-School","c":322,"u":58,"d":205,"confRate":84.7,"planId":"92096943"},{"loc":"SF","dept":"Guest Services","team":"Prayer Team","c":155,"u":47,"d":73,"confRate":76.7,"planId":"92294241"},{"loc":"SF","dept":"Weekend Service","team":"Sign Language","c":52,"u":35,"d":14,"confRate":59.8,"planId":"91922141"},{"loc":"SF","dept":"Action Kids","team":"KT1 - 2nd","c":70,"u":12,"d":30,"confRate":85.4,"planId":"92096943"},{"loc":"SF","dept":"Action Kids","team":"KT2- 3rd, 4th, 5th","c":8,"u":7,"d":10,"confRate":53.3,"planId":"92096943"},{"loc":"SF","dept":"Action Kids","team":"Service Coordinator","c":50,"u":4,"d":15,"confRate":92.6,"planId":"92096943"},{"loc":"SF","dept":"Weekend Service","team":"Sunday Choir","c":25,"u":1,"d":5,"confRate":96.2,"planId":"90392698"},{"loc":"SF","dept":"Weekend Service","team":"Leadership","c":32,"u":1,"d":1,"confRate":97.0,"planId":"91922141"},{"loc":"SF","dept":"Weekend Service","team":"Band","c":82,"u":0,"d":14,"confRate":100.0,"planId":"91922141"},{"loc":"SF","dept":"Weekend Service","team":"Vocals","c":75,"u":0,"d":13,"confRate":100.0,"planId":"91922141"},{"loc":"SF","dept":"Weekend Service","team":"Production","c":109,"u":0,"d":5,"confRate":100.0,"planId":"91922141"}]},"WP":{"c":1817,"u":1024,"d":1087,"openNeeded":301,"confRate":64.0,"declineRate":27.7,"depts":[{"dept":"Weekend Service","c":339,"u":33,"d":75,"confRate":91.1},{"dept":"Guest Services","c":939,"u":496,"d":628,"confRate":65.4},{"dept":"Action Kids","c":539,"u":495,"d":384,"confRate":52.1}],"teams":[{"loc":"WP","dept":"Action Kids","team":"Kids Preschool","c":383,"u":405,"d":297,"confRate":48.6,"planId":"92300122"},{"loc":"WP","dept":"Guest Services","team":"Greeter Team","c":259,"u":163,"d":279,"confRate":61.4,"planId":"92297705"},{"loc":"WP","dept":"Action Kids","team":"Kids Theater","c":116,"u":84,"d":65,"confRate":58.0,"planId":"92300122"},{"loc":"WP","dept":"Guest Services","team":"Parking Team","c":89,"u":84,"d":48,"confRate":51.4,"planId":"92297705"},{"loc":"WP","dept":"Guest Services","team":"Prayer Team","c":87,"u":54,"d":39,"confRate":61.7,"planId":"92297705"},{"loc":"WP","dept":"Guest Services","team":"Usher Team","c":141,"u":53,"d":67,"confRate":72.7,"planId":"92297705"},{"loc":"WP","dept":"Guest Services","team":"Connect Team","c":133,"u":46,"d":92,"confRate":74.3,"planId":"92297705"},{"loc":"WP","dept":"Guest Services","team":"Safety Team","c":98,"u":46,"d":54,"confRate":68.1,"planId":"92297705"},{"loc":"WP","dept":"Guest Services","team":"Admin Team","c":40,"u":27,"d":22,"confRate":59.7,"planId":"92297705"},{"loc":"WP","dept":"Weekend Service","team":"Choir-WP","c":55,"u":25,"d":35,"confRate":68.8,"planId":"91481065"},{"loc":"WP","dept":"Guest Services","team":"Hospitality Team","c":47,"u":15,"d":20,"confRate":75.8,"planId":"92297705"},{"loc":"WP","dept":"Guest Services","team":"Environment Team","c":16,"u":4,"d":4,"confRate":80.0,"planId":"92297705"}]},"OV":{"c":861,"u":345,"d":538,"openNeeded":296,"confRate":71.4,"declineRate":30.8,"depts":[{"dept":"Weekend Service","c":189,"u":3,"d":28,"confRate":98.4},{"dept":"Guest Services","c":418,"u":247,"d":279,"confRate":62.9},{"dept":"Action Kids","c":254,"u":95,"d":231,"confRate":72.8}],"teams":[{"loc":"OV","dept":"Guest Services","team":"Parking","c":58,"u":70,"d":28,"confRate":45.3,"planId":"92237542"},{"loc":"OV","dept":"Action Kids","team":"Preschool","c":133,"u":68,"d":152,"confRate":66.2,"planId":"92233709"},{"loc":"OV","dept":"Guest Services","team":"Ushers","c":51,"u":50,"d":46,"confRate":50.5,"planId":"92237542"},{"loc":"OV","dept":"Guest Services","team":"Safety","c":23,"u":48,"d":15,"confRate":32.4,"planId":"92237542"},{"loc":"OV","dept":"Guest Services","team":"Greeters","c":126,"u":24,"d":124,"confRate":84.0,"planId":"92237542"},{"loc":"OV","dept":"Action Kids","team":"Theater","c":69,"u":16,"d":39,"confRate":81.2,"planId":"92233709"},{"loc":"OV","dept":"Guest Services","team":"Admin","c":15,"u":16,"d":10,"confRate":48.4,"planId":"92237542"},{"loc":"OV","dept":"Guest Services","team":"Set-Up Team","c":7,"u":12,"d":1,"confRate":36.8,"planId":"92237542"},{"loc":"OV","dept":"Action Kids","team":"Kids Check-In","c":5,"u":10,"d":25,"confRate":33.3,"planId":"92233709"},{"loc":"OV","dept":"Guest Services","team":"Hospitality","c":21,"u":9,"d":15,"confRate":70.0,"planId":"92237542"},{"loc":"OV","dept":"Guest Services","team":"Hospitality Set-Up Team","c":11,"u":7,"d":1,"confRate":61.1,"planId":"92237542"},{"loc":"OV","dept":"Guest Services","team":"Connect","c":46,"u":5,"d":20,"confRate":90.2,"planId":"92237542"}]},"WS":{"c":663,"u":153,"d":282,"openNeeded":43,"confRate":81.2,"declineRate":25.7,"depts":[{"dept":"Weekend Service","c":114,"u":12,"d":3,"confRate":90.5},{"dept":"Guest Services","c":408,"u":103,"d":192,"confRate":79.8},{"dept":"Action Kids","c":141,"u":38,"d":87,"confRate":78.8}],"teams":[{"loc":"WS","dept":"Guest Services","team":"Guest Services","c":82,"u":32,"d":58,"confRate":71.9,"planId":"92207624"},{"loc":"WS","dept":"Action Kids","team":"Action Kids","c":120,"u":30,"d":78,"confRate":80.0,"planId":"92094495"},{"loc":"WS","dept":"Guest Services","team":"Set Up Team","c":49,"u":16,"d":12,"confRate":75.4,"planId":"92207624"},{"loc":"WS","dept":"Guest Services","team":"Safety","c":27,"u":14,"d":19,"confRate":65.9,"planId":"92207624"},{"loc":"WS","dept":"Guest Services","team":"Parking","c":49,"u":13,"d":21,"confRate":79.0,"planId":"92207624"},{"loc":"WS","dept":"Guest Services","team":"Tear Down","c":33,"u":11,"d":14,"confRate":75.0,"planId":"92207624"},{"loc":"WS","dept":"Weekend Service","team":"ASL","c":13,"u":11,"d":1,"confRate":54.2,"planId":"92092980"},{"loc":"WS","dept":"Guest Services","team":"Prayer Team","c":52,"u":8,"d":14,"confRate":86.7,"planId":"92207624"},{"loc":"WS","dept":"Action Kids","team":"Child Care","c":10,"u":7,"d":0,"confRate":58.8,"planId":"92094495"},{"loc":"WS","dept":"Guest Services","team":"Hospitality","c":39,"u":5,"d":12,"confRate":88.6,"planId":"92207624"},{"loc":"WS","dept":"Guest Services","team":"Usher","c":56,"u":4,"d":30,"confRate":93.3,"planId":"92207624"},{"loc":"WS","dept":"Action Kids","team":"Set-up Team","c":11,"u":1,"d":9,"confRate":91.7,"planId":"92094495"}]}}};
const TEAM_HEALTH_DATA = {
  joins: { weekly: TH_JOINS_W, monthly: TH_JOINS_M, quarterly: TH_JOINS_Q, semiannual: TH_JOINS_SA, annual: TH_JOINS_A },
  inactive: TH_INACTIVE,
  conf: TH_CONF,
  u2row: {"summary":{"ALL":{"total":315,"currentOct18Oct25":200},"HW":{"total":35,"currentOct18Oct25":12},"SF":{"total":30,"currentOct18Oct25":14},"WP":{"total":181,"currentOct18Oct25":137},"OV":{"total":51,"currentOct18Oct25":24},"WS":{"total":18,"currentOct18Oct25":13}},"members":[{"id":"198854109","name":"David Chiles","loc":"HW","dept":"Guest Services","team":"Parking","pos":"Parking Lead","streak":9,"u":11,"c":4,"d":1,"chkU":2,"curr":true,"dates":"09-27, 10-04, 10-18, 10-25","pair":"10-18 & 10-25","planId":"92151843"},{"id":"198853921","name":"Justin Wieckhorst","loc":"HW","dept":"Guest Services","team":"Parking","pos":"Parking","streak":9,"u":11,"c":0,"d":1,"chkU":0,"curr":true,"dates":"09-27, 10-04, 10-18, 10-25","pair":"10-18 & 10-25","planId":"92151843"},{"id":"198869242","name":"Marcus Goss Jr.","loc":"HW","dept":"Guest Services","team":"Parking","pos":"Parking","streak":7,"u":10,"c":1,"d":0,"chkU":0,"curr":true,"dates":"09-27, 10-04, 10-18, 10-25","pair":"10-18 & 10-25","planId":"92151843"},{"id":"198839044","name":"Matthew Allan","loc":"HW","dept":"Action Kids","team":"Setup Team","pos":"Pre-Service Setup","streak":5,"u":5,"c":0,"d":0,"chkU":0,"curr":true,"dates":"10-04, 10-11, 10-18, 10-25","pair":"10-18 & 10-25","planId":"92145115"},{"id":"136594165","name":"Antonio Mclaughlin","loc":"SF","dept":"Weekend Service","team":"Sign Language","pos":"ASL","streak":13,"u":14,"c":1,"d":0,"chkU":0,"curr":true,"dates":"10-04, 10-11, 10-18, 10-25","pair":"10-18 & 10-25","planId":"91922141"},{"id":"137819024","name":"Damaris Figueroa","loc":"SF","dept":"Action Kids","team":"Pre-School","pos":"Rainbow Room","streak":8,"u":13,"c":1,"d":1,"chkU":1,"curr":true,"dates":"10-04, 10-11, 10-18, 10-25","pair":"10-18 & 10-25","planId":"92096943"},{"id":"142970565","name":"Jasmine Cruz-Figueroa","loc":"SF","dept":"Guest Services","team":"Guest Services","pos":"Greeter*","streak":8,"u":13,"c":0,"d":8,"chkU":0,"curr":true,"dates":"10-04, 10-11, 10-18, 10-25","pair":"10-18 & 10-25","planId":"92294241"},{"id":"158666742","name":"Brandon Simmons","loc":"SF","dept":"Guest Services","team":"Guest Services","pos":"Parking*","streak":6,"u":11,"c":0,"d":4,"chkU":0,"curr":true,"dates":"09-27, 10-04, 10-18, 10-25","pair":"10-18 & 10-25","planId":"92294241"},{"id":"146301631","name":"Abby Ly","loc":"WP","dept":"Action Kids","team":"Kids Preschool","pos":"Yellow Room","streak":6,"u":8,"c":0,"d":0,"chkU":0,"curr":true,"dates":"10-04, 10-11, 10-18, 10-25","pair":"10-18 & 10-25","planId":"92300122"},{"id":"146194692","name":"Amy Johnson","loc":"WP","dept":"Action Kids","team":"Kids Preschool","pos":"Orange Room","streak":6,"u":8,"c":0,"d":0,"chkU":4,"curr":true,"dates":"10-04, 10-11, 10-18, 10-25","pair":"10-18 & 10-25","planId":"92300122"},{"id":"141878851","name":"Blake Merrill","loc":"WP","dept":"Guest Services","team":"Safety Team","pos":"Safety Team","streak":6,"u":8,"c":0,"d":0,"chkU":0,"curr":true,"dates":"10-04, 10-11, 10-18, 10-25","pair":"10-18 & 10-25","planId":"92297705"},{"id":"190194156","name":"Camden Pagan","loc":"WP","dept":"Action Kids","team":"Kids Preschool","pos":"Red Room","streak":6,"u":8,"c":0,"d":0,"chkU":3,"curr":true,"dates":"10-04, 10-11, 10-18, 10-25","pair":"10-18 & 10-25","planId":"92300122"},{"id":"113599453","name":"Alex Cocurull","loc":"OV","dept":"Guest Services","team":"Ushers","pos":"Usher Team","streak":6,"u":8,"c":0,"d":0,"chkU":0,"curr":true,"dates":"10-04, 10-11, 10-18, 10-25","pair":"10-18 & 10-25","planId":"92237542"},{"id":"144543548","name":"Chip Reams","loc":"OV","dept":"Guest Services","team":"Set-Up Team","pos":"Set-Up Team","streak":6,"u":8,"c":0,"d":0,"chkU":0,"curr":true,"dates":"10-04, 10-11, 10-18, 10-25","pair":"10-18 & 10-25","planId":"92237542"},{"id":"193343145","name":"David Gomez","loc":"OV","dept":"Guest Services","team":"Safety","pos":"Safety Team","streak":6,"u":8,"c":0,"d":0,"chkU":0,"curr":true,"dates":"10-04, 10-11, 10-18, 10-25","pair":"10-18 & 10-25","planId":"92237542"},{"id":"189293175","name":"Deacon Liput","loc":"OV","dept":"Guest Services","team":"Parking","pos":"Parking Team","streak":6,"u":8,"c":0,"d":0,"chkU":0,"curr":true,"dates":"10-04, 10-11, 10-18, 10-25","pair":"10-18 & 10-25","planId":"92237542"},{"id":"145148740","name":"Liza Figueroa","loc":"WS","dept":"Guest Services","team":"Guest Services","pos":"Greeter","streak":6,"u":8,"c":0,"d":0,"chkU":0,"curr":true,"dates":"10-04, 10-11, 10-18, 10-25","pair":"10-18 & 10-25","planId":"92207624"},{"id":"38550216","name":"Ryan Doyle","loc":"WS","dept":"Action Kids","team":"Action Kids","pos":"Red Room Leader","streak":6,"u":7,"c":0,"d":0,"chkU":0,"curr":true,"dates":"10-04, 10-11, 10-18, 10-25","pair":"10-18 & 10-25","planId":"92094495"},{"id":"38556548","name":"Arya Rivera","loc":"WS","dept":"Action Kids","team":"Action Kids","pos":"Orange Room","streak":6,"u":6,"c":1,"d":0,"chkU":2,"curr":true,"dates":"10-04, 10-11, 10-18, 10-25","pair":"10-18 & 10-25","planId":"92094495"},{"id":"128012671","name":"Gabrielle Frates","loc":"WS","dept":"Weekend Service","team":"ASL","pos":"Interpreter","streak":6,"u":6,"c":1,"d":0,"chkU":0,"curr":true,"dates":"10-04, 10-11, 10-18, 10-25","pair":"10-18 & 10-25","planId":"92092980"}]} as { summary: Record<LocCode, { total: number; currentOct18Oct25: number }>; members: U2RowMember[] },
  oct25U: [{"id":"198854109","name":"David Chiles","loc":"HW","dept":"Guest Services","team":"Parking","pos":"Parking","uHist":11,"dHist":1,"cHist":4,"planId":"92151843"},{"id":"198854109","name":"David Chiles","loc":"HW","dept":"Guest Services","team":"Parking","pos":"Parking Lead","uHist":11,"dHist":1,"cHist":4,"planId":"92151843"},{"id":"198853921","name":"Justin Wieckhorst","loc":"HW","dept":"Guest Services","team":"Parking","pos":"Parking","uHist":11,"dHist":1,"cHist":0,"planId":"92151843"},{"id":"198869242","name":"Marcus Goss Jr.","loc":"HW","dept":"Guest Services","team":"Parking","pos":"Parking","uHist":10,"dHist":0,"cHist":1,"planId":"92151843"},{"id":"136594165","name":"Antonio Mclaughlin","loc":"SF","dept":"Weekend Service","team":"Sign Language","pos":"ASL","uHist":14,"dHist":0,"cHist":1,"planId":"91922141"},{"id":"142970565","name":"Jasmine Cruz-Figueroa","loc":"SF","dept":"Guest Services","team":"Guest Services","pos":"Greeter*","uHist":13,"dHist":8,"cHist":0,"planId":"92294241"},{"id":"137819024","name":"Damaris Figueroa","loc":"SF","dept":"Action Kids","team":"Pre-School","pos":"Rainbow Room","uHist":13,"dHist":1,"cHist":1,"planId":"92096943"},{"id":"142970565","name":"Jasmine Cruz-Figueroa","loc":"SF","dept":"Weekend Service","team":"Sign Language","pos":"ASL","uHist":13,"dHist":8,"cHist":0,"planId":"91922141"},{"id":"124531075","name":"Campbell Story","loc":"WP","dept":"Guest Services","team":"Greeter Team","pos":"Greeter Team","uHist":8,"dHist":0,"cHist":0,"planId":"92297705"},{"id":"131076868","name":"Natalie Pellegrino","loc":"WP","dept":"Guest Services","team":"Greeter Team","pos":"Greeter Team","uHist":8,"dHist":0,"cHist":0,"planId":"92297705"},{"id":"146301631","name":"Abby Ly","loc":"WP","dept":"Action Kids","team":"Kids Preschool","pos":"Yellow Room","uHist":8,"dHist":0,"cHist":0,"planId":"92300122"},{"id":"146194692","name":"Amy Johnson","loc":"WP","dept":"Action Kids","team":"Kids Preschool","pos":"Orange Room","uHist":8,"dHist":0,"cHist":0,"planId":"92300122"}] as Oct25UMember[],
  oct25D: [{"id":"194028775","name":"Vikki Gonzalez","loc":"HW","dept":"Guest Services","team":"Coach","pos":"Coach","reason":"This is an AUTOMATIC decline because Vikki Gonzalez blocked out the dates Sep 24 to Nov 1, 2026 for Broken ankle.","updatedAt":"2026-09-24","dHist":9,"cHist":2,"planId":"92151843"},{"id":"198854745","name":"Seth Thomas","loc":"HW","dept":"Guest Services","team":"Parking","pos":"Parking Lead","reason":"This is an AUTOMATIC decline because Seth Thomas blocked out the dates Oct 25, 2026.","updatedAt":"2026-10-01","dHist":6,"cHist":7,"planId":"92151843"},{"id":"196757307","name":"Gracie Abrams","loc":"HW","dept":"Action Kids","team":"Service Coordinator","pos":"Preschool SC","reason":"This is an AUTOMATIC decline because Gracie Abrams blocked out the dates Oct 25-28, 2026.","updatedAt":"2026-10-23","dHist":6,"cHist":6,"planId":"92145115"},{"id":"198661388","name":"Debbie Golightly","loc":"HW","dept":"Guest Services","team":"Greeters","pos":"Greeter","reason":"This is an AUTOMATIC decline because Debbie Golightly blocked out the dates Oct 25, 2026.","updatedAt":"2026-10-24","dHist":5,"cHist":6,"planId":"92151843"},{"id":"111014053","name":"Ramon Soto","loc":"SF","dept":"Guest Services","team":"Guest Services","pos":"Safety*","reason":"Working","updatedAt":"2026-10-23","dHist":14,"cHist":0,"planId":"92294241"},{"id":"32074496","name":"Karina Rodriguez","loc":"SF","dept":"Guest Services","team":"Prayer Team","pos":"Altar","reason":"I coach","updatedAt":"2026-09-30","dHist":14,"cHist":8,"planId":"92294241"},{"id":"38557032","name":"Mike Russeau","loc":"SF","dept":"Guest Services","team":"Guest Services","pos":"Parking*","reason":"Vacation","updatedAt":"2026-10-22","dHist":10,"cHist":5,"planId":"92294241"},{"id":"195753281","name":"Cade Chretien","loc":"SF","dept":"Guest Services","team":"Guest Services","pos":"Greeter*","reason":"Kirby and I will be serving on October 4th and 18th.","updatedAt":"2026-09-26","dHist":9,"cHist":4,"planId":"92294241"},{"id":"165057078","name":"Jose Boscan","loc":"WP","dept":"Guest Services","team":"Greeter Team","pos":"Greeter Team","reason":"Family in town","updatedAt":"2026-10-03","dHist":8,"cHist":0,"planId":"92297705"},{"id":"158591771","name":"Katie Boscan","loc":"WP","dept":"Guest Services","team":"Greeter Team","pos":"Greeter Team","reason":"Family Visiting","updatedAt":"2026-10-01","dHist":8,"cHist":0,"planId":"92297705"},{"id":"167701578","name":"Melissa Russell","loc":"WP","dept":"Action Kids","team":"Kids Check-In","pos":"Kids Check-In","reason":"I’m so sorry my work schedule has been crazy.","updatedAt":"2026-10-23","dHist":6,"cHist":2,"planId":"92300122"},{"id":"172012529","name":"Mariana Rua","loc":"WP","dept":"Action Kids","team":"Kids Preschool","pos":"Orange Room","reason":"Swim meet","updatedAt":"2026-10-23","dHist":6,"cHist":2,"planId":"92300122"}] as Oct25DMember[],
  burnout: {"summary":{"ALL":{"total":181,"streak4Plus":133,"doubleOct25":64},"HW":{"total":24,"streak4Plus":18,"doubleOct25":9},"SF":{"total":28,"streak4Plus":19,"doubleOct25":12},"WP":{"total":61,"streak4Plus":41,"doubleOct25":22},"OV":{"total":39,"streak4Plus":33,"doubleOct25":10},"WS":{"total":29,"streak4Plus":22,"doubleOct25":11}},"members":[{"id":"84576873","name":"Angelica Sharkey","loc":"HW","dept":"Weekend Service","roles":"Production (Graphics Operator), Production (Service Producer)","qtd":12,"last4":4,"oct25":2,"tag":"4+ Wk Streak + Multi-Role Today","planId":"92259115"},{"id":"198853249","name":"Evan Bernath","loc":"HW","dept":"Weekend Service","roles":"Production (Front of House Operator)","qtd":12,"last4":4,"oct25":1,"tag":"4+ Consecutive Sundays","planId":"92259115"},{"id":"169959856","name":"Katie Rivers","loc":"HW","dept":"Weekend Service","roles":"Experience Team Devo (Thursday Night Devo), Vocals (Mic 3), Vocals (Worship Leader)","qtd":11,"last4":4,"oct25":3,"tag":"4+ Wk Streak + Multi-Role Today","planId":"92259115"},{"id":"6032568","name":"Kiana Wolf","loc":"HW","dept":"Weekend Service","roles":"Band (Keys), Band (MD)","qtd":11,"last4":4,"oct25":2,"tag":"4+ Wk Streak + Multi-Role Today","planId":"92259115"},{"id":"100720470","name":"David Goebelbecker","loc":"SF","dept":"Weekend Service","roles":"Sign Language (ASL)","qtd":14,"last4":4,"oct25":1,"tag":"4+ Consecutive Sundays","planId":"91922141"},{"id":"152086983","name":"Erin Cecchetti","loc":"SF","dept":"Weekend Service","roles":"Sign Language (ASL)","qtd":14,"last4":4,"oct25":1,"tag":"4+ Consecutive Sundays","planId":"91922141"},{"id":"135197348","name":"Sarah Hunt","loc":"SF","dept":"Action Kids","roles":"Service Coordinator (Service Coordinator)","qtd":14,"last4":4,"oct25":1,"tag":"4+ Consecutive Sundays","planId":"92096943"},{"id":"38548208","name":"Zion O'Connor","loc":"SF","dept":"Action Kids","roles":"Service Coordinator (Service Coordinator)","qtd":14,"last4":4,"oct25":1,"tag":"4+ Consecutive Sundays","planId":"92096943"},{"id":"38558724","name":"J. T.","loc":"WP","dept":"Weekend Service","roles":"Band (Keys), Band (MD)","qtd":7,"last4":4,"oct25":2,"tag":"4+ Wk Streak + Multi-Role Today","planId":"91481065"},{"id":"9198084","name":"Abby Thomas","loc":"WP","dept":"Weekend Service","roles":"Production (Service Producer)","qtd":7,"last4":4,"oct25":1,"tag":"4+ Consecutive Sundays","planId":"91481065"},{"id":"52783058","name":"Brendan Jones","loc":"WP","dept":"Weekend Service","roles":"Band (Electric Guitar 1)","qtd":7,"last4":4,"oct25":1,"tag":"4+ Consecutive Sundays","planId":"91481065"},{"id":"183377057","name":"Carlos Pagan","loc":"WP","dept":"Guest Services","roles":"Safety Team (Safety Team)","qtd":7,"last4":4,"oct25":1,"tag":"4+ Consecutive Sundays","planId":"92297705"}]} as { summary: Record<LocCode, { total: number; streak4Plus: number; doubleOct25: number }>; members: BurnoutMember[] },
  lateDeclines: {"summary":{"ALL":{"totalQtd":1148,"oct25Late":77,"withReason":298},"HW":{"totalQtd":146,"oct25Late":10,"withReason":49},"SF":{"totalQtd":314,"oct25Late":4,"withReason":59},"WP":{"totalQtd":475,"oct25Late":49,"withReason":136},"OV":{"totalQtd":160,"oct25Late":11,"withReason":35},"WS":{"totalQtd":53,"oct25Late":3,"withReason":19}},"items":[{"id":"198661388","name":"Debbie Golightly","loc":"HW","dept":"Guest Services","team":"Greeters","pos":"Greeter","planDate":"2026-10-25","declinedAt":"Fri Oct 23, 10:07 PM ET","daysBefore":2,"reason":"This is an AUTOMATIC decline because Debbie Golightly blocked out the dates Oct 25, 2026.","planId":"92151843"},{"id":"196757307","name":"Gracie Abrams","loc":"HW","dept":"Action Kids","team":"Service Coordinator","pos":"Preschool SC","planDate":"2026-10-25","declinedAt":"Thu Oct 22, 9:33 PM ET","daysBefore":3,"reason":"This is an AUTOMATIC decline because Gracie Abrams blocked out the dates Oct 25-28, 2026.","planId":"92145115"},{"id":"194062418","name":"Kourtney Conway","loc":"HW","dept":"Action Kids","team":"Kids Preschool","pos":"Orange Youth Helper","planDate":"2026-10-25","declinedAt":"Fri Oct 23, 9:24 PM ET","daysBefore":2,"reason":"We’re out of town this weekend for Carly’s cheer competition!!!","planId":"92145115"},{"id":"198853241","name":"Anne Odukoya","loc":"HW","dept":"Guest Services","team":"Ushers","pos":"Usher","planDate":"2026-10-25","declinedAt":"Sat Oct 24, 9:16 AM ET","daysBefore":1,"reason":"","planId":"92151843"},{"id":"99423004","name":"Dana Wickman","loc":"SF","dept":"Action Kids","team":"Pre-School","pos":"Blue Room Leader (Nursery)","planDate":"2026-10-25","declinedAt":"Thu Oct 22, 10:39 AM ET","daysBefore":3,"reason":"Still getting better","planId":"92096943"},{"id":"38557032","name":"Mike Russeau","loc":"SF","dept":"Guest Services","team":"Guest Services","pos":"Parking*","planDate":"2026-10-25","declinedAt":"Thu Oct 22, 6:40 AM ET","daysBefore":3,"reason":"Vacation","planId":"92294241"},{"id":"111014053","name":"Ramon Soto","loc":"SF","dept":"Guest Services","team":"Guest Services","pos":"Safety*","planDate":"2026-10-25","declinedAt":"Fri Oct 23, 2:46 PM ET","daysBefore":2,"reason":"Working","planId":"92294241"},{"id":"141534101","name":"Devin McCreary","loc":"SF","dept":"Guest Services","team":"Guest Services","pos":"Parking*","planDate":"2026-10-25","declinedAt":"Thu Oct 22, 8:08 AM ET","daysBefore":3,"reason":"","planId":"92294241"},{"id":"70670595","name":"Andrew Jones","loc":"WP","dept":"Guest Services","team":"Hospitality Team","pos":"Hospitality Team","planDate":"2026-10-25","declinedAt":"Sat Oct 24, 7:42 AM ET","daysBefore":1,"reason":"Sick","planId":"92297705"},{"id":"38549427","name":"Ashley Corazzini","loc":"WP","dept":"Guest Services","team":"Admin Team","pos":"Admin Team","planDate":"2026-10-25","declinedAt":"Fri Oct 23, 5:03 PM ET","daysBefore":2,"reason":"Currently at school in Jacksonville","planId":"92297705"},{"id":"38551556","name":"Blake Griffin","loc":"WP","dept":"Action Kids","team":"Kids Check-In","pos":"Kids Check-In","planDate":"2026-10-25","declinedAt":"Sat Oct 24, 8:53 AM ET","daysBefore":1,"reason":"Tournament weekend","planId":"92300122"},{"id":"38551563","name":"Bryce Griffin","loc":"WP","dept":"Action Kids","team":"Kids Theater","pos":"Production/Tech","planDate":"2026-10-25","declinedAt":"Sat Oct 24, 8:53 AM ET","daysBefore":1,"reason":"Tournament weekend","planId":"92300122"}]} as { summary: Record<LocCode, { totalQtd: number; oct25Late: number; withReason: number }>; items: LateDeclineItem[] },
};

const WORKFLOW_ROWS: WorkflowRow[] = [
  { id: "749245", loc: "HW", bucket: "A Team", name: "Events Team On-Board Process - HW", open: 15, overdue: 10, stale14d: 3, tone: "danger" },
  { id: "748818", loc: "HW", bucket: "Connection", name: "Action Step 2 | Become - HW", open: 15, overdue: 10, stale14d: 4, tone: "danger" },
  { id: "749340", loc: "HW", bucket: "A Team", name: "Prayer Team On-Board Process - HW", open: 8, overdue: 8, stale14d: 5, tone: "danger" },
  { id: "749328", loc: "HW", bucket: "A Team", name: "Outreach Team On-Board Process - HW", open: 7, overdue: 7, stale14d: 2, tone: "warning" },
  { id: "275208", loc: "SF", bucket: "Connection", name: "Joining A Small Group Interest - SF", open: 36, overdue: 36, stale14d: 36, tone: "danger" },
  { id: "84649", loc: "SF", bucket: "Connection", name: "Small Group Submissions - SF", open: 31, overdue: 31, stale14d: 31, tone: "danger" },
  { id: "275210", loc: "SF", bucket: "Connection", name: "Lead A Small Group Interest - SF", open: 11, overdue: 11, stale14d: 11, tone: "danger" },
  { id: "513021", loc: "SF", bucket: "Connection", name: "I want to attend Action Steps - SF", open: 8, overdue: 8, stale14d: 8, tone: "danger" },
  { id: "98876", loc: "SF", bucket: "A Team", name: "Guest Services Team On-Board Process - SF", open: 16, overdue: 4, stale14d: 9, tone: "warning" },
  { id: "275191", loc: "WP", bucket: "Connection", name: "Joining A Small Group Interest - WP", open: 558, overdue: 558, stale14d: 544, tone: "danger" },
  { id: "780687", loc: "WP", bucket: "Outreach", name: "Serve Saturday - WP", open: 50, overdue: 50, stale14d: 13, tone: "danger" },
  { id: "74083", loc: "WP", bucket: "A Team", name: "Guest Services Team On-Board Process - WP", open: 49, overdue: 25, stale14d: 25, tone: "danger" },
  { id: "275203", loc: "OV", bucket: "Connection", name: "Joining A Small Group Interest - OV", open: 18, overdue: 18, stale14d: 18, tone: "danger" },
  { id: "780689", loc: "WS", bucket: "Outreach", name: "Serve Saturday - WS", open: 24, overdue: 24, stale14d: 1, tone: "danger" },
];

const WORKFLOW_STAFF = [
  { name: "Unassigned Cards", loc: "ALL", role: "Needs Owner Assignment", open: 42, overdue: 16, stale: 32, done7d: 0, note: "42 cards have no staff owner", tone: "danger" as const, wfId: "513020" },
  { name: "Kalie Drake", loc: "HW", role: "North Regional Locations Director", open: 19, overdue: 4, stale: 8, done7d: 11, note: "Strong completion pace at Heathrow", tone: "success" as const, wfId: "749245" },
  { name: "victory", loc: "SF", role: "SF Connection", open: 21, overdue: 7, stale: 11, done7d: 8, note: "Steady weekly follow-up at Sanford", tone: "warning" as const, wfId: "275208" },
  { name: "Danijl Zelenika", loc: "WP", role: "WP Connection & A-Team", open: 72, overdue: 28, stale: 49, done7d: 14, note: "Highest open & stale backlog", tone: "danger" as const, wfId: "275191" },
  { name: "Kylieiby", loc: "WP", role: "WP Kids & Groups", open: 34, overdue: 12, stale: 21, done7d: 6, note: "12 overdue cards", tone: "warning" as const, wfId: "88411" },
  { name: "rotano", loc: "OV", role: "OV Connection & A-Team", open: 24, overdue: 9, stale: 15, done7d: 5, note: "9 overdue cards", tone: "warning" as const, wfId: "275203" },
  { name: "Justin (Bulk Audit)", loc: "ALL", role: "Workflow Audit Flag", open: 15, overdue: 6, stale: 9, done7d: 42, note: "38 cards bulk-closed in <3m without notes", tone: "danger" as const, wfId: "275191" },
];

interface SgLocSummary {
  openGroups: number;
  totalGroups: number;
  regionalTotalGroups: number;
  regionalOpenGroups: number;
  reportingGroups: number;
  unreportedGroups: number;
  reportingRatePct: number;
  eventsHeld: number;
  eventsReported: number;
  inGroupAtLoc: number;
  inGroupRegional: number;
  callingLocHome: number;
  repSampleMembers: number;
  attended1Plus: number;
  attended1PlusPct: number;
  attendGt50: number;
  attendGt50Pct: number;
  neverAttended: number;
  neverAttendedPct: number;
  dropOff: number;
  dropOffPct: number;
}

interface SgCareMember {
  pid: string;
  name: string;
  gid: string;
  groupName: string;
  loc: Exclude<LocCode, "ALL">;
  homeLoc: Exclude<LocCode, "ALL">;
  role: string;
  joinedAt: string;
  attended: number;
  held: number;
  lastAttended: string;
  status: SgCareFilter;
}

interface SgGroupRow {
  id: string;
  name: string;
  loc: Exclude<LocCode, "ALL">;
  locs: string[];
  isOpen: boolean;
  membersCount: number;
  leader: string;
  eventsHeld: number;
  eventsReported: number;
  avgAttended: number;
}

interface StaffBucketMetric {
  name: string;
  pillar: "Workflow Velocity" | "Scheduling & Roster Hygiene" | "Attendance Reporting Hygiene";
  metricLabel: string;
  metricVal: string;
  subText: string;
  tone: "success" | "warning" | "danger";
  actionLabel: string;
  actionQueue: StaffActionQueue;
  pcoUrl: string;
}

interface StaffPillarRollup {
  wfOpen: number;
  wfOverdue: number;
  wfStale14d: number;
  wfTopId: string;
  buckets: StaffBucketMetric[];
}

const SG_SUMMARY: Record<LocCode, SgLocSummary> = {"ALL":{"openGroups":217,"totalGroups":304,"regionalTotalGroups":304,"regionalOpenGroups":217,"reportingGroups":103,"unreportedGroups":188,"reportingRatePct":33.9,"eventsHeld":1770,"eventsReported":219,"inGroupAtLoc":2432,"inGroupRegional":2432,"callingLocHome":2432,"repSampleMembers":1202,"attended1Plus":532,"attended1PlusPct":44.3,"attendGt50":306,"attendGt50Pct":25.5,"neverAttended":670,"neverAttendedPct":55.7,"dropOff":95,"dropOffPct":17.9},"WP":{"openGroups":53,"totalGroups":126,"regionalTotalGroups":137,"regionalOpenGroups":64,"reportingGroups":40,"unreportedGroups":87,"reportingRatePct":29.2,"eventsHeld":671,"eventsReported":61,"inGroupAtLoc":1050,"inGroupRegional":1185,"callingLocHome":1055,"repSampleMembers":443,"attended1Plus":146,"attended1PlusPct":33.0,"attendGt50":105,"attendGt50Pct":23.7,"neverAttended":297,"neverAttendedPct":67.0,"dropOff":21,"dropOffPct":14.4},"OV":{"openGroups":48,"totalGroups":50,"regionalTotalGroups":54,"regionalOpenGroups":52,"reportingGroups":14,"unreportedGroups":39,"reportingRatePct":25.9,"eventsHeld":366,"eventsReported":37,"inGroupAtLoc":533,"inGroupRegional":907,"callingLocHome":374,"repSampleMembers":210,"attended1Plus":110,"attended1PlusPct":52.4,"attendGt50":70,"attendGt50Pct":33.3,"neverAttended":100,"neverAttendedPct":47.6,"dropOff":24,"dropOffPct":21.8},"SF":{"openGroups":39,"totalGroups":43,"regionalTotalGroups":49,"regionalOpenGroups":45,"reportingGroups":17,"unreportedGroups":29,"reportingRatePct":34.7,"eventsHeld":339,"eventsReported":42,"inGroupAtLoc":379,"inGroupRegional":542,"callingLocHome":374,"repSampleMembers":191,"attended1Plus":85,"attended1PlusPct":44.5,"attendGt50":49,"attendGt50Pct":25.7,"neverAttended":106,"neverAttendedPct":55.5,"dropOff":27,"dropOffPct":31.8},"WS":{"openGroups":13,"totalGroups":13,"regionalTotalGroups":23,"regionalOpenGroups":23,"reportingGroups":8,"unreportedGroups":14,"reportingRatePct":34.8,"eventsHeld":124,"eventsReported":14,"inGroupAtLoc":125,"inGroupRegional":743,"callingLocHome":159,"repSampleMembers":102,"attended1Plus":38,"attended1PlusPct":37.3,"attendGt50":20,"attendGt50Pct":19.6,"neverAttended":64,"neverAttendedPct":62.7,"dropOff":10,"dropOffPct":26.3},"HW":{"openGroups":48,"totalGroups":56,"regionalTotalGroups":62,"regionalOpenGroups":54,"reportingGroups":30,"unreportedGroups":30,"reportingRatePct":48.4,"eventsHeld":367,"eventsReported":82,"inGroupAtLoc":581,"inGroupRegional":722,"callingLocHome":470,"repSampleMembers":411,"attended1Plus":202,"attended1PlusPct":49.1,"attendGt50":96,"attendGt50Pct":23.4,"neverAttended":209,"neverAttendedPct":50.9,"dropOff":26,"dropOffPct":12.9}};

const SG_MEMBER_CARE: SgCareMember[] = [{"pid":"128175930","name":"Camila Tigreros","gid":"3152582","groupName":"HEart Therapy","loc":"WP","homeLoc":"WP","role":"member","joinedAt":"2026-08-16","attended":2,"held":5,"lastAttended":"2026-09-20","status":"dropoff"},{"pid":"41819793","name":"Heidi Jackson","gid":"3152582","groupName":"HEart Therapy","loc":"WP","homeLoc":"WP","role":"member","joinedAt":"2026-08-16","attended":1,"held":5,"lastAttended":"2026-08-23","status":"dropoff"},{"pid":"79037303","name":"Carla Phangyou","gid":"3163619","groupName":"Coffee and Coloring","loc":"WP","homeLoc":"WP","role":"member","joinedAt":"2026-09-01","attended":0,"held":4,"lastAttended":"Never","status":"never"},{"pid":"38551555","name":"Christy Gray","gid":"3163619","groupName":"Coffee and Coloring","loc":"WP","homeLoc":"WP","role":"leader","joinedAt":"2026-08-17","attended":0,"held":4,"lastAttended":"Never","status":"never"},{"pid":"93871580","name":"Briana Reid","gid":"3152582","groupName":"HEart Therapy","loc":"WP","homeLoc":"WP","role":"member","joinedAt":"2026-08-16","attended":3,"held":5,"lastAttended":"2026-10-18","status":"core"},{"pid":"200344733","name":"Carrie Van Slyke","gid":"3152582","groupName":"HEart Therapy","loc":"WP","homeLoc":"WP","role":"member","joinedAt":"2026-08-21","attended":5,"held":5,"lastAttended":"2026-10-18","status":"core"},{"pid":"134675755","name":"Amber O'Berry","gid":"2692948","groupName":"OV - Game Night","loc":"OV","homeLoc":"OV","role":"member","joinedAt":"2026-08-16","attended":2,"held":7,"lastAttended":"2026-09-18","status":"dropoff"},{"pid":"38557520","name":"Bill Shaffer","gid":"2692948","groupName":"OV - Game Night","loc":"OV","homeLoc":"WS","role":"member","joinedAt":"2026-08-16","attended":1,"held":7,"lastAttended":"2026-09-04","status":"dropoff"},{"pid":"181301055","name":"Daniel Aristizbal","gid":"3152950","groupName":"Faith & Wake For Guys","loc":"OV","homeLoc":"WP","role":"member","joinedAt":"2026-08-17","attended":0,"held":7,"lastAttended":"Never","status":"never"},{"pid":"166657477","name":"Gavin Zinnert","gid":"3152950","groupName":"Faith & Wake For Guys","loc":"OV","homeLoc":"OV","role":"member","joinedAt":"2026-08-16","attended":0,"held":7,"lastAttended":"Never","status":"never"},{"pid":"182950347","name":"Eric Burke","gid":"2692948","groupName":"OV - Game Night","loc":"OV","homeLoc":"WP","role":"member","joinedAt":"2026-08-16","attended":6,"held":7,"lastAttended":"2026-10-23","status":"core"},{"pid":"114173227","name":"Eric Reed","gid":"3152950","groupName":"Faith & Wake For Guys","loc":"OV","homeLoc":"OV","role":"leader","joinedAt":"2026-08-10","attended":5,"held":7,"lastAttended":"2026-10-02","status":"core"},{"pid":"198869418","name":"Alicia Correa","gid":"3178489","groupName":"Miles In Faith","loc":"SF","homeLoc":"HW","role":"member","joinedAt":"2026-09-14","attended":1,"held":7,"lastAttended":"2026-09-15","status":"dropoff"},{"pid":"160944592","name":"Amy Ditter","gid":"3178489","groupName":"Miles In Faith","loc":"SF","homeLoc":"HW","role":"member","joinedAt":"2026-08-23","attended":1,"held":7,"lastAttended":"2026-09-04","status":"dropoff"},{"pid":"198860500","name":"Andrea Howard","gid":"3178489","groupName":"Miles In Faith","loc":"SF","homeLoc":"SF","role":"member","joinedAt":"2026-08-25","attended":0,"held":7,"lastAttended":"Never","status":"never"},{"pid":"109177189","name":"Bethanee Esqueda","gid":"3178489","groupName":"Miles In Faith","loc":"SF","homeLoc":"SF","role":"member","joinedAt":"2026-10-20","attended":0,"held":7,"lastAttended":"Never","status":"never"},{"pid":"197164729","name":"Lucy Rivera","gid":"3178489","groupName":"Miles In Faith","loc":"SF","homeLoc":"HW","role":"leader","joinedAt":"2026-08-20","attended":7,"held":7,"lastAttended":"2026-10-23","status":"core"},{"pid":"198858054","name":"Shontae Campbell","gid":"3178489","groupName":"Miles In Faith","loc":"SF","homeLoc":"HW","role":"leader","joinedAt":"2026-08-22","attended":5,"held":7,"lastAttended":"2026-10-23","status":"core"},{"pid":"40683179","name":"Bobby Brolliar","gid":"2950102","groupName":"Forge","loc":"WS","homeLoc":"OV","role":"member","joinedAt":"2026-08-04","attended":1,"held":2,"lastAttended":"2026-09-29","status":"dropoff"},{"pid":"86440756","name":"Jeremy West","gid":"2950102","groupName":"Forge","loc":"WS","homeLoc":"WP","role":"member","joinedAt":"2026-08-16","attended":1,"held":2,"lastAttended":"2026-09-29","status":"dropoff"},{"pid":"27251731","name":"Meghan Jones","gid":"3159571","groupName":"Fighting Your Battles God\u2019s Way","loc":"WS","homeLoc":"WS","role":"leader","joinedAt":"2026-08-24","attended":0,"held":4,"lastAttended":"Never","status":"never"},{"pid":"51796771","name":"Ted Jones","gid":"3159571","groupName":"Fighting Your Battles God\u2019s Way","loc":"WS","homeLoc":"WS","role":"leader","joinedAt":"2026-08-24","attended":0,"held":4,"lastAttended":"Never","status":"never"},{"pid":"38550383","name":"Carlis Eiland","gid":"3159571","groupName":"Fighting Your Battles God\u2019s Way","loc":"WS","homeLoc":"WS","role":"leader","joinedAt":"2026-08-12","attended":4,"held":4,"lastAttended":"2026-10-22","status":"core"},{"pid":"82048629","name":"Cindy Eiland","gid":"3159571","groupName":"Fighting Your Battles God\u2019s Way","loc":"WS","homeLoc":"WS","role":"leader","joinedAt":"2026-08-12","attended":4,"held":4,"lastAttended":"2026-10-22","status":"core"},{"pid":"198672812","name":"Anthony Bonifacio","gid":"3141068","groupName":"Men's Disciple Builders with Carlos","loc":"HW","homeLoc":"HW","role":"member","joinedAt":"2026-08-11","attended":2,"held":8,"lastAttended":"2026-09-03","status":"dropoff"},{"pid":"198865618","name":"Eddie Coba","gid":"3141068","groupName":"Men's Disciple Builders with Carlos","loc":"HW","homeLoc":"HW","role":"member","joinedAt":"2026-08-11","attended":2,"held":8,"lastAttended":"2026-09-24","status":"dropoff"},{"pid":"198856633","name":"Dominick Carroll","gid":"3141068","groupName":"Men's Disciple Builders with Carlos","loc":"HW","homeLoc":"HW","role":"member","joinedAt":"2026-08-11","attended":0,"held":8,"lastAttended":"Never","status":"never"},{"pid":"198860041","name":"Joe Young","gid":"3141068","groupName":"Men's Disciple Builders with Carlos","loc":"HW","homeLoc":"HW","role":"member","joinedAt":"2026-08-11","attended":0,"held":8,"lastAttended":"Never","status":"never"},{"pid":"198856478","name":"Carlos Gainza","gid":"3141068","groupName":"Men's Disciple Builders with Carlos","loc":"HW","homeLoc":"HW","role":"leader","joinedAt":"2026-08-04","attended":5,"held":8,"lastAttended":"2026-10-01","status":"core"},{"pid":"198858339","name":"Devon Miller Sr.","gid":"3141068","groupName":"Men's Disciple Builders with Carlos","loc":"HW","homeLoc":"HW","role":"member","joinedAt":"2026-08-11","attended":5,"held":8,"lastAttended":"2026-10-01","status":"core"}];

const SG_GROUP_ROWS: SgGroupRow[] = [{"id":"3161836","name":"Action Women Bible Study- WP/WS/OV","loc":"WP","locs":["WP","OV","WS"],"isOpen":true,"membersCount":342,"leader":"Gabriella Dailey, Alex Bamberg","eventsHeld":7,"eventsReported":0,"avgAttended":0.0},{"id":"3156955","name":"Made Men","loc":"WP","locs":["WP","WS"],"isOpen":true,"membersCount":213,"leader":"Greg McClellan, Eddie Rivera","eventsHeld":3,"eventsReported":0,"avgAttended":0.0},{"id":"3157823","name":"Action Women Bible Study - HW/SF","loc":"SF","locs":["SF","HW"],"isOpen":true,"membersCount":127,"leader":"Kalie Drake, Christina Williams","eventsHeld":7,"eventsReported":0,"avgAttended":0.0},{"id":"2434591","name":"Monday Coed Pickleball","loc":"OV","locs":["OV"],"isOpen":true,"membersCount":74,"leader":"Kevin Gallagher, Yamina Marlow","eventsHeld":7,"eventsReported":0,"avgAttended":0.0},{"id":"2579111","name":"Sunday Co-ed Pickleball","loc":"OV","locs":["OV"],"isOpen":true,"membersCount":69,"leader":"Kevin Gallagher, Yamina Marlow","eventsHeld":10,"eventsReported":0,"avgAttended":0.0},{"id":"3141154","name":"MomCo","loc":"HW","locs":["HW"],"isOpen":true,"membersCount":54,"leader":"Alexis Cadavid, Christina Williams","eventsHeld":2,"eventsReported":2,"avgAttended":25.0},{"id":"3141010","name":"Holy Rollers Couples and Bowling","loc":"HW","locs":["HW"],"isOpen":true,"membersCount":50,"leader":"Jan Nunley, Irvin Nunley","eventsHeld":4,"eventsReported":2,"avgAttended":12.0},{"id":"1977518","name":"Action Recovery Sanford","loc":"SF","locs":["SF"],"isOpen":true,"membersCount":48,"leader":"Kenyon Sutton, Brad Peters","eventsHeld":9,"eventsReported":0,"avgAttended":0.0},{"id":"3146993","name":"Church Ladies Gone Wild Outdoor Group","loc":"HW","locs":["HW"],"isOpen":false,"membersCount":48,"leader":"Vikki Gonzalez, Thorunn Taylor","eventsHeld":2,"eventsReported":0,"avgAttended":0.0},{"id":"2580033","name":"Flipping Stones- Men's Group","loc":"SF","locs":["SF"],"isOpen":true,"membersCount":37,"leader":"Brian Wickman, Josh Price","eventsHeld":9,"eventsReported":4,"avgAttended":9.2},{"id":"2970318","name":"M.O.A - Men of Action","loc":"OV","locs":["OV"],"isOpen":true,"membersCount":37,"leader":"Shane Ingolia, Bobby Brolliar","eventsHeld":8,"eventsReported":2,"avgAttended":10.5},{"id":"3133136","name":"Band of Brothers","loc":"HW","locs":["HW"],"isOpen":true,"membersCount":33,"leader":"Kip Williams, Jim Daley","eventsHeld":2,"eventsReported":0,"avgAttended":0.0},{"id":"2451630","name":"Maple Street Men's Group","loc":"OV","locs":["OV"],"isOpen":true,"membersCount":33,"leader":"Brian Dorn, Dave Braun","eventsHeld":9,"eventsReported":2,"avgAttended":18.5},{"id":"2698613","name":"MI REACCION","loc":"SF","locs":["SF"],"isOpen":true,"membersCount":32,"leader":"Claudia Bucaro, Soneska Rivera","eventsHeld":4,"eventsReported":1,"avgAttended":2.0},{"id":"3153376","name":"A Walk in the Park","loc":"WP","locs":["WP","WS"],"isOpen":true,"membersCount":25,"leader":"Jessica Lucas, Lisa McCarty","eventsHeld":5,"eventsReported":2,"avgAttended":7.0},{"id":"2137109","name":"Caring for Action Kids Environment","loc":"WP","locs":["WP"],"isOpen":true,"membersCount":22,"leader":"Erica Utley, Melissa Mills","eventsHeld":4,"eventsReported":1,"avgAttended":0.0},{"id":"2950102","name":"Forge","loc":"WS","locs":["WS"],"isOpen":true,"membersCount":17,"leader":"Greg McClellan, Mike Ely","eventsHeld":10,"eventsReported":2,"avgAttended":8.0},{"id":"3159612","name":"It's Game Night!","loc":"WS","locs":["WS"],"isOpen":true,"membersCount":17,"leader":"Greg Pike, Dana Pike","eventsHeld":4,"eventsReported":1,"avgAttended":4.0},{"id":"3162418","name":"Co-ed Married Couples Freedom Group","loc":"WS","locs":["WS"],"isOpen":true,"membersCount":15,"leader":"Mo Abdoun, Mandee Abdoun","eventsHeld":8,"eventsReported":0,"avgAttended":0.0}];

const STAFF_EFFECTIVENESS_BY_LOC: Record<LocCode, StaffPillarRollup> = {
  ALL: {
    wfOpen: 865, wfOverdue: 760, wfStale14d: 711, wfTopId: "275191",
    buckets: [
      { name: "Connection & Next Steps", pillar: "Workflow Velocity", metricLabel: "Overdue / Open Cards", metricVal: "632 / 646", subText: "613 stale 14d+ · Small Group & Action Steps interest", tone: "danger", actionLabel: "Review Connection Workflows", actionQueue: "overdue_wf", pcoUrl: "https://people.planningcenteronline.com/workflows/275191" },
      { name: "Guest Services (A-Team)", pillar: "Scheduling & Roster Hygiene", metricLabel: "Conf Rate · 30d+ Inactive", metricVal: "74% · 412 inactive", subText: "110 Oct 25 U · 412 inactive 30d+ on active GS rosters", tone: "warning", actionLabel: "Clean Up GS Roster", actionQueue: "inactive_roster", pcoUrl: "https://services.planningcenteronline.com/service_types/845329/teams" },
      { name: "Action Kids (A-Team)", pillar: "Scheduling & Roster Hygiene", metricLabel: "Conf Rate · 30d+ Inactive", metricVal: "77% · 368 inactive", subText: "85 Oct 25 U · 368 inactive 30d+ on active Kids rosters", tone: "warning", actionLabel: "Clean Up Kids Roster", actionQueue: "inactive_roster", pcoUrl: "https://services.planningcenteronline.com/service_types/842221/teams" },
      { name: "Weekend Service (Production/Band)", pillar: "Scheduling & Roster Hygiene", metricLabel: "Conf Rate · 30d+ Inactive", metricVal: "74% · 171 inactive", subText: "43 Oct 25 U · 171 inactive 30d+ on active Production/Band rosters", tone: "success", actionLabel: "Clean Up Production Roster", actionQueue: "inactive_roster", pcoUrl: "https://services.planningcenteronline.com/service_types/858409/teams" },
      { name: "Small Groups Ministry", pillar: "Attendance Reporting Hygiene", metricLabel: "Groups Logging Attendance", metricVal: "103 / 304 (33.9%)", subText: "188 active groups w/ 0 Fall attendance reports · 670 0x members", tone: "danger", actionLabel: "Follow Up Unreported Groups", actionQueue: "unreported_sg", pcoUrl: "https://groups.planningcenteronline.com/groups" },
      { name: "Outreach & Serve Saturday", pillar: "Workflow Velocity", metricLabel: "Overdue / Open Cards", metricVal: "74 / 74", subText: "14 stale 14d+ · Serve Saturday follow-up cards (WP & WS)", tone: "warning", actionLabel: "Open Outreach Workflows", actionQueue: "overdue_wf", pcoUrl: "https://people.planningcenteronline.com/workflows/780687" },
    ],
  },
  WP: {
    wfOpen: 657, wfOverdue: 633, wfStale14d: 582, wfTopId: "275191",
    buckets: [
      { name: "Connection & Next Steps (WP)", pillar: "Workflow Velocity", metricLabel: "Overdue / Open Cards", metricVal: "558 / 558", subText: "544 stale 14d+ · Joining A Small Group Interest - WP", tone: "danger", actionLabel: "Open WP Connection WF", actionQueue: "overdue_wf", pcoUrl: "https://people.planningcenteronline.com/workflows/275191" },
      { name: "Guest Services (WP)", pillar: "Scheduling & Roster Hygiene", metricLabel: "Conf Rate · 30d+ Inactive", metricVal: "80% · 244 inactive", subText: "36 Oct 25 U · 244 inactive 30d+ on WP GS roster", tone: "warning", actionLabel: "Clean Up WP GS Roster", actionQueue: "inactive_roster", pcoUrl: "https://services.planningcenteronline.com/service_types/845329/teams" },
      { name: "Action Kids (WP)", pillar: "Scheduling & Roster Hygiene", metricLabel: "Conf Rate · 30d+ Inactive", metricVal: "79% · 232 inactive", subText: "29 Oct 25 U · 232 inactive 30d+ on WP Kids roster", tone: "warning", actionLabel: "Clean Up WP Kids Roster", actionQueue: "inactive_roster", pcoUrl: "https://services.planningcenteronline.com/service_types/842221/teams" },
      { name: "Weekend Service (WP)", pillar: "Scheduling & Roster Hygiene", metricLabel: "Conf Rate · 30d+ Inactive", metricVal: "77% · 91 inactive", subText: "12 Oct 25 U · 91 inactive 30d+ on WP Production/Band", tone: "success", actionLabel: "Clean Up WP Wknd Roster", actionQueue: "inactive_roster", pcoUrl: "https://services.planningcenteronline.com/service_types/858409/teams" },
      { name: "Small Groups (WP)", pillar: "Attendance Reporting Hygiene", metricLabel: "Groups Logging Attendance", metricVal: "40 / 137 (29.2%)", subText: "87 WP groups w/ 0 Fall attendance reports · 297 0x members", tone: "danger", actionLabel: "View WP Unreported Groups", actionQueue: "unreported_sg", pcoUrl: "https://groups.planningcenteronline.com/groups" },
      { name: "Outreach (WP)", pillar: "Workflow Velocity", metricLabel: "Overdue / Open Cards", metricVal: "50 / 50", subText: "13 stale 14d+ · Serve Saturday - WP", tone: "warning", actionLabel: "Open WP Outreach WF", actionQueue: "overdue_wf", pcoUrl: "https://people.planningcenteronline.com/workflows/780687" },
    ],
  },
  OV: {
    wfOpen: 18, wfOverdue: 18, wfStale14d: 18, wfTopId: "275203",
    buckets: [
      { name: "Connection & Next Steps (OV)", pillar: "Workflow Velocity", metricLabel: "Overdue / Open Cards", metricVal: "18 / 18", subText: "18 stale 14d+ · Joining A Small Group Interest - OV", tone: "danger", actionLabel: "Open OV Connection WF", actionQueue: "overdue_wf", pcoUrl: "https://people.planningcenteronline.com/workflows/275203" },
      { name: "Guest Services (OV)", pillar: "Scheduling & Roster Hygiene", metricLabel: "Conf Rate · 30d+ Inactive", metricVal: "80% · 49 inactive", subText: "20 Oct 25 U · 49 inactive 30d+ on OV GS roster", tone: "success", actionLabel: "Clean Up OV GS Roster", actionQueue: "inactive_roster", pcoUrl: "https://services.planningcenteronline.com/service_types/1777530/teams" },
      { name: "Action Kids (OV)", pillar: "Scheduling & Roster Hygiene", metricLabel: "Conf Rate · 30d+ Inactive", metricVal: "76% · 52 inactive", subText: "13 Oct 25 U · 52 inactive 30d+ on OV Kids roster", tone: "warning", actionLabel: "Clean Up OV Kids Roster", actionQueue: "inactive_roster", pcoUrl: "https://services.planningcenteronline.com/service_types/499291/teams" },
      { name: "Weekend Service (OV)", pillar: "Scheduling & Roster Hygiene", metricLabel: "Conf Rate · 30d+ Inactive", metricVal: "76% · 22 inactive", subText: "5 Oct 25 U · 22 inactive 30d+ on OV Production/Band", tone: "success", actionLabel: "Clean Up OV Wknd Roster", actionQueue: "inactive_roster", pcoUrl: "https://services.planningcenteronline.com/service_types/499279/teams" },
      { name: "Small Groups (OV)", pillar: "Attendance Reporting Hygiene", metricLabel: "Groups Logging Attendance", metricVal: "14 / 54 (25.9%)", subText: "39 OV groups w/ 0 Fall attendance reports · 100 0x members", tone: "danger", actionLabel: "View OV Unreported Groups", actionQueue: "unreported_sg", pcoUrl: "https://groups.planningcenteronline.com/groups" },
    ],
  },
  SF: {
    wfOpen: 102, wfOverdue: 90, wfStale14d: 95, wfTopId: "275208",
    buckets: [
      { name: "Connection & Next Steps (SF)", pillar: "Workflow Velocity", metricLabel: "Overdue / Open Cards", metricVal: "86 / 86", subText: "86 stale 14d+ · Small Group & Action Steps interest - SF", tone: "danger", actionLabel: "Open SF Connection WF", actionQueue: "overdue_wf", pcoUrl: "https://people.planningcenteronline.com/workflows/275208" },
      { name: "Guest Services (SF)", pillar: "Scheduling & Roster Hygiene", metricLabel: "Conf Rate · 30d+ Inactive", metricVal: "66% · 57 inactive", subText: "26 Oct 25 U · 57 inactive 30d+ on SF GS roster", tone: "warning", actionLabel: "Clean Up SF GS Roster", actionQueue: "inactive_roster", pcoUrl: "https://services.planningcenteronline.com/service_types/717426/teams" },
      { name: "Action Kids (SF)", pillar: "Scheduling & Roster Hygiene", metricLabel: "Conf Rate · 30d+ Inactive", metricVal: "70% · 51 inactive", subText: "19 Oct 25 U · 51 inactive 30d+ on SF Kids roster", tone: "warning", actionLabel: "Clean Up SF Kids Roster", actionQueue: "inactive_roster", pcoUrl: "https://services.planningcenteronline.com/service_types/716525/teams" },
      { name: "Weekend Service (SF)", pillar: "Scheduling & Roster Hygiene", metricLabel: "Conf Rate · 30d+ Inactive", metricVal: "58% · 27 inactive", subText: "14 Oct 25 U · 27 inactive 30d+ on SF Production/Band", tone: "danger", actionLabel: "Clean Up SF Wknd Roster", actionQueue: "inactive_roster", pcoUrl: "https://services.planningcenteronline.com/service_types/717576/teams" },
      { name: "Small Groups (SF)", pillar: "Attendance Reporting Hygiene", metricLabel: "Groups Logging Attendance", metricVal: "17 / 49 (34.7%)", subText: "29 SF groups w/ 0 Fall attendance reports · 106 0x members", tone: "warning", actionLabel: "View SF Unreported Groups", actionQueue: "unreported_sg", pcoUrl: "https://groups.planningcenteronline.com/groups" },
    ],
  },
  WS: {
    wfOpen: 24, wfOverdue: 24, wfStale14d: 1, wfTopId: "780689",
    buckets: [
      { name: "Outreach & Serve Saturday (WS)", pillar: "Workflow Velocity", metricLabel: "Overdue / Open Cards", metricVal: "24 / 24", subText: "1 stale 14d+ · Serve Saturday - WS", tone: "warning", actionLabel: "Open WS Outreach WF", actionQueue: "overdue_wf", pcoUrl: "https://people.planningcenteronline.com/workflows/780689" },
      { name: "Guest Services (WS)", pillar: "Scheduling & Roster Hygiene", metricLabel: "Conf Rate · 30d+ Inactive", metricVal: "78% · 19 inactive", subText: "12 Oct 25 U · 19 inactive 30d+ on WS GS roster", tone: "success", actionLabel: "Clean Up WS GS Roster", actionQueue: "inactive_roster", pcoUrl: "https://services.planningcenteronline.com/service_types/1699519/teams" },
      { name: "Action Kids (WS)", pillar: "Scheduling & Roster Hygiene", metricLabel: "Conf Rate · 30d+ Inactive", metricVal: "74% · 13 inactive", subText: "7 Oct 25 U · 13 inactive 30d+ on WS Kids roster", tone: "warning", actionLabel: "Clean Up WS Kids Roster", actionQueue: "inactive_roster", pcoUrl: "https://services.planningcenteronline.com/service_types/1725781/teams" },
      { name: "Weekend Service (WS)", pillar: "Scheduling & Roster Hygiene", metricLabel: "Conf Rate · 30d+ Inactive", metricVal: "87% · 8 inactive", subText: "2 Oct 25 U · 8 inactive 30d+ on WS Production/Band", tone: "success", actionLabel: "Clean Up WS Wknd Roster", actionQueue: "inactive_roster", pcoUrl: "https://services.planningcenteronline.com/service_types/1695472/teams" },
      { name: "Small Groups (WS)", pillar: "Attendance Reporting Hygiene", metricLabel: "Groups Logging Attendance", metricVal: "8 / 23 (34.8%)", subText: "14 WS groups w/ 0 Fall attendance reports · 64 0x members", tone: "warning", actionLabel: "View WS Unreported Groups", actionQueue: "unreported_sg", pcoUrl: "https://groups.planningcenteronline.com/groups" },
    ],
  },
  HW: {
    wfOpen: 45, wfOverdue: 35, wfStale14d: 14, wfTopId: "749245",
    buckets: [
      { name: "Connection & Next Steps (HW)", pillar: "Workflow Velocity", metricLabel: "Overdue / Open Cards", metricVal: "10 / 15", subText: "4 stale 14d+ · Action Step 2 | Become - HW", tone: "warning", actionLabel: "Open HW Connection WF", actionQueue: "overdue_wf", pcoUrl: "https://people.planningcenteronline.com/workflows/748818" },
      { name: "A-Team Onboarding (HW)", pillar: "Workflow Velocity", metricLabel: "Overdue / Open Cards", metricVal: "25 / 30", subText: "10 stale 14d+ · Events, Prayer & Outreach Onboarding - HW", tone: "danger", actionLabel: "Open HW Onboarding WF", actionQueue: "overdue_wf", pcoUrl: "https://people.planningcenteronline.com/workflows/749245" },
      { name: "Guest Services (HW)", pillar: "Scheduling & Roster Hygiene", metricLabel: "Conf Rate · 30d+ Inactive", metricVal: "65% · 43 inactive", subText: "16 Oct 25 U · 43 inactive 30d+ on HW GS roster", tone: "warning", actionLabel: "Clean Up HW GS Roster", actionQueue: "inactive_roster", pcoUrl: "https://services.planningcenteronline.com/service_types/1790388/teams" },
      { name: "Action Kids (HW)", pillar: "Scheduling & Roster Hygiene", metricLabel: "Conf Rate · 30d+ Inactive", metricVal: "85% · 20 inactive", subText: "7 Oct 25 U · 20 inactive 30d+ on HW Kids roster", tone: "success", actionLabel: "Clean Up HW Kids Roster", actionQueue: "inactive_roster", pcoUrl: "https://services.planningcenteronline.com/service_types/1800367/teams" },
      { name: "Weekend Service (HW)", pillar: "Scheduling & Roster Hygiene", metricLabel: "Conf Rate · 30d+ Inactive", metricVal: "71% · 23 inactive", subText: "10 Oct 25 U · 23 inactive 30d+ on HW Production/Band", tone: "warning", actionLabel: "Clean Up HW Wknd Roster", actionQueue: "inactive_roster", pcoUrl: "https://services.planningcenteronline.com/service_types/1792723/teams" },
      { name: "Small Groups (HW)", pillar: "Attendance Reporting Hygiene", metricLabel: "Groups Logging Attendance", metricVal: "30 / 62 (48.4%)", subText: "30 HW groups w/ 0 Fall attendance reports · 209 0x members", tone: "success", actionLabel: "View HW Unreported Groups", actionQueue: "unreported_sg", pcoUrl: "https://groups.planningcenteronline.com/groups" },
    ],
  },
};

export default function App() {
  const theme = useGrokTheme();
  const sundayLive = useSource("sunday_live");
  const [manualLiveRow, setManualLiveRow] = useState<LiveSundayRow | null>(null);
  const [refreshTick, setRefreshTick] = useState<number>(0);
  const [lastRefreshedLabel, setLastRefreshedLabel] = useState<string>("");
  const liveSundayRow = useMemo(() => {
    const fromHost = parseLiveSunday(sundayLive.value);
    if (manualLiveRow && fromHost) {
      return (manualLiveRow.locs_json?.ALL?.total || 0) >= (fromHost.locs_json?.ALL?.total || 0)
        ? manualLiveRow
        : fromHost;
    }
    return manualLiveRow || fromHost;
  }, [manualLiveRow, sundayLive.value, refreshTick]);
  const [loc, setLoc] = useState<LocCode>("ALL");
  const [horizon, setHorizon] = useState<HorizonCode>("monthly");
  const [tab, setTab] = useState<MainTab>("summary");
  const [selectedGoalId, setSelectedGoalId] = useState<string>("serve");
  const [careFilter, setCareFilter] = useState<CareFilter>("oct25_u");
  const [teamSection, setTeamSection] = useState<TeamHealthSection>("joins");
  const [inactiveBucket, setInactiveBucket] = useState<InactiveBucketFilter>("all");
  const [confPeopleMode, setConfPeopleMode] = useState<ConfPeopleFilter>("u2row");
  const [deptFilter, setDeptFilter] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");
  const [showRingsInfo, setShowRingsInfo] = useState<boolean>(false);
  const [showAttInfo, setShowAttInfo] = useState<boolean>(false);
  const [showCareInfo, setShowCareInfo] = useState<boolean>(false);
  const [yoyChartMode, setYoyChartMode] = useState<"yoy" | "qavg">("yoy");
  const [hoveredWeekIdx, setHoveredWeekIdx] = useState<number | null>(null);
  const [showAll13Weeks, setShowAll13Weeks] = useState<boolean>(false);
  const [attSectionViews, setAttSectionViews] = useState<Record<LocCode, "overall" | "yoy" | "breakdown">>({
    ALL: "overall",
    HW: "overall",
    SF: "overall",
    WP: "overall",
    OV: "overall",
    WS: "overall",
  });

  const currentSundayWindow = useMemo(() => {
    try {
      const now = new Date();
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        weekday: "short",
        hour: "2-digit",
        hour12: false,
      }).formatToParts(now);
      const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
      const weekday = get("weekday");
      const hour = parseInt(get("hour") || "0", 10);
      const mm = get("month");
      const dd = get("day");
      const yyyy = get("year");
      const iso = `${yyyy}-${mm}-${dd}`;
      const slash = `${parseInt(mm, 10)}/${parseInt(dd, 10)}/${yyyy}`;
      const shortNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const label = `${shortNames[parseInt(mm, 10) - 1]} ${parseInt(dd, 10)}`;
      return {
        isSunday: weekday === "Sun",
        isAfter5am: weekday === "Sun" && hour >= 5,
        iso,
        slash,
        label,
      };
    } catch {
      return { isSunday: true, isAfter5am: true, iso: "2026-10-25", slash: "10/25/2026", label: "Oct 25" };
    }
  }, [sundayLive.value]);

  const OCT25_LATEST_ROW: LiveSundayRow = {
    sunday_date: "2026-10-25",
    sunday_label: "Oct 25",
    is_live: true,
    services_completed: "Live Sunday Sync",
    locs_json: {
      ALL: { total: 4627, adults: 3297, kids: 606, team: 724, salvations: 37, total2025: 4828, yoyPct: -4.2 },
      WP: { total: 2256, adults: 1757, kids: 223, team: 276, salvations: 13, total2025: 3270, yoyPct: -31.0 },
      OV: { total: 760, adults: 554, kids: 101, team: 105, salvations: 3, total2025: 748, yoyPct: 1.6 },
      SF: { total: 583, adults: 348, kids: 102, team: 133, salvations: 7, total2025: 809, yoyPct: -27.9 },
      WS: { total: 268, adults: 155, kids: 36, team: 77, salvations: 1, total2025: null, yoyPct: null },
      HW: { total: 761, adults: 484, kids: 144, team: 133, salvations: 13, total2025: null, yoyPct: null },
    },
    services_json: {
      HW: { d: "10/25/2026", salv: 13, tot: 761, a: [258, 226], k: [66, 78], kt: 144, t: [30, 67, 36], tt: 133, st: 0, bp: 0 },
      SF: { d: "10/25/2026", salv: 7, tot: 583, a: [125, 119, 104], k: [26, 45, 31], kt: 102, t: [15, 82, 36], tt: 133, st: 0, bp: 0 },
      WP: { d: "10/25/2026", salv: 13, tot: 2256, a: [484, 734, 540, 0], k: [91, 132, 0, 0], kt: 223, t: [60, 145, 71], tt: 276, st: 0, bp: 0 },
      OV: { d: "10/25/2026", salv: 3, tot: 760, a: [129, 221, 204], k: [36, 43, 22], kt: 101, t: [0, 70, 35], tt: 105, st: 0, bp: 0 },
      WS: { d: "10/25/2026", salv: 1, tot: 268, a: [93, 62], k: [18, 18], kt: 36, t: [14, 43, 20], tt: 77, st: 0, bp: 0 },
    },
  };

  const effectiveSundayRow = useMemo((): LiveSundayRow | null => {
    const candidate =
      liveSundayRow && liveSundayRow.sunday_date === "2026-10-25" && (liveSundayRow.locs_json?.ALL?.total || 0) < 4627
        ? OCT25_LATEST_ROW
        : liveSundayRow;
    if (candidate && (!currentSundayWindow.isAfter5am || candidate.sunday_date === currentSundayWindow.iso)) {
      return {
        ...candidate,
        is_live: currentSundayWindow.isSunday && candidate.sunday_date === currentSundayWindow.iso,
      };
    }
    if (currentSundayWindow.isAfter5am) {
      const zeroLoc: LiveSundayLoc = { total: 0, adults: 0, kids: 0, team: 0, salvations: 0, total2025: null, yoyPct: null };
      const s = currentSundayWindow.slash;
      return {
        sunday_date: currentSundayWindow.iso,
        sunday_label: currentSundayWindow.label,
        is_live: true,
        services_completed: "Live Sunday Sync (Starts 5:00 AM ET)",
        locs_json: { ALL: { ...zeroLoc }, WP: { ...zeroLoc }, OV: { ...zeroLoc }, SF: { ...zeroLoc }, WS: { ...zeroLoc }, HW: { ...zeroLoc } },
        services_json: {
          WP: { d: s, salv: 0, tot: 0, a: [0, 0, 0, 0], k: [0, 0, 0, 0], kt: 0, t: [0, 0, 0], tt: 0, st: 0, bp: 0 },
          OV: { d: s, salv: 0, tot: 0, a: [0, 0, 0], k: [0, 0, 0], kt: 0, t: [0, 0, 0], tt: 0, st: 0, bp: 0 },
          SF: { d: s, salv: 0, tot: 0, a: [0, 0, 0], k: [0, 0, 0], kt: 0, t: [0, 0, 0], tt: 0, st: 0, bp: 0 },
          WS: { d: s, salv: 0, tot: 0, a: [0, 0], k: [0, 0], kt: 0, t: [0, 0, 0], tt: 0, st: 0, bp: 0 },
          HW: { d: s, salv: 0, tot: 0, a: [0, 0], k: [0, 0], kt: 0, t: [0, 0, 0], tt: 0, st: 0, bp: 0 },
        },
      };
    }
    return liveSundayRow ? { ...liveSundayRow, is_live: false } : null;
  }, [liveSundayRow, currentSundayWindow]);

  const YOY_2025_FALLBACK: Record<string, Partial<Record<LocCode, number>>> = {
    "2026-10-25": { ALL: 4828, WP: 3270, OV: 748, SF: 809 },
    "2026-11-01": { ALL: 5581, WP: 3980, OV: 812, SF: 789 },
    "2026-11-08": { ALL: 5149, WP: 3634, OV: 809, SF: 707 },
    "2026-11-15": { ALL: 5156, WP: 3557, OV: 872, SF: 728 },
    "2026-11-22": { ALL: 4653, WP: 3184, OV: 772, SF: 698 },
    "2026-11-29": { ALL: 5590, WP: 4082, OV: 769, SF: 739 },
  };

  const liveWeeklySeries = useMemo(() => {
    const base = [...ATTENDANCE_DATA.weeklySeries13];
    if (!effectiveSundayRow || !effectiveSundayRow.locs_json || !effectiveSundayRow.locs_json.ALL) {
      return base;
    }
    const hasNumbers = effectiveSundayRow.locs_json.ALL.total > 0;
    if (!hasNumbers && !effectiveSundayRow.is_live) {
      return base;
    }
    const fb25 = YOY_2025_FALLBACK[effectiveSundayRow.sunday_date] || { ALL: 4828, WP: 3270, OV: 748, SF: 809 };
    const enrichedLocs = { ...effectiveSundayRow.locs_json };
    for (const c of ["ALL", "WP", "OV", "SF", "WS", "HW"] as LocCode[]) {
      const cur = enrichedLocs[c];
      if (!cur) continue;
      const t25 = cur.total2025 ?? fb25[c] ?? null;
      const pct = t25 && t25 > 0 && cur.total > 0 ? Math.round(((cur.total - t25) / t25) * 1000) / 10 : cur.yoyPct;
      enrichedLocs[c] = { ...cur, total2025: t25, yoyPct: pct };
    }
    const existingIdx = base.findIndex((w) => w.date === effectiveSundayRow.sunday_date);
    const point: AttWeeklyPoint = {
      date: effectiveSundayRow.sunday_date,
      label: effectiveSundayRow.sunday_label,
      locs: enrichedLocs,
    };
    if (existingIdx >= 0) {
      base[existingIdx] = point;
      return base;
    }
    return [...base.slice(1), point];
  }, [effectiveSundayRow]);

  const liveHorizons = useMemo(() => {
    const h = {
      weekly: { ...ATTENDANCE_DATA.horizons.weekly },
      monthly: { ...ATTENDANCE_DATA.horizons.monthly },
      quarterly: { ...ATTENDANCE_DATA.horizons.quarterly },
      semiannual: { ...ATTENDANCE_DATA.horizons.semiannual },
      annual: { ...ATTENDANCE_DATA.horizons.annual },
      ytd: { ...ATTENDANCE_DATA.horizons.ytd },
    };
    if (!effectiveSundayRow || !effectiveSundayRow.locs_json || !effectiveSundayRow.locs_json.ALL || effectiveSundayRow.locs_json.ALL.total <= 0) {
      return h;
    }
    const completedSeries = liveWeeklySeries.filter((w) => w.locs.ALL.total > 0);
    const last4 = completedSeries.slice(-4);
    const latestPoint = completedSeries[completedSeries.length - 1];
    for (const c of ["ALL", "WP", "OV", "SF", "WS", "HW"] as LocCode[]) {
      const liveLoc = latestPoint ? latestPoint.locs[c] : effectiveSundayRow.locs_json[c];
      if (!liveLoc || liveLoc.total <= 0) continue;
      const baseWk = h.weekly[c];
      const yoyDiff = liveLoc.total2025 ? liveLoc.total - liveLoc.total2025 : null;
      h.weekly[c] = {
        ...baseWk,
        total: liveLoc.total,
        adults: liveLoc.adults,
        kids: liveLoc.kids,
        team: liveLoc.team,
        salvationsAvg: liveLoc.salvations,
        salvationsSum: liveLoc.salvations,
        yoyPct: liveLoc.yoyPct,
        yoyDiff,
        trend4: last4.map((w) => w.locs[c].total),
        trend4Dates: last4.map((w) => w.label),
      };
      const avg4Total = Math.round(last4.reduce((s, w) => s + w.locs[c].total, 0) / last4.length);
      const avg4Adults = Math.round(last4.reduce((s, w) => s + w.locs[c].adults, 0) / last4.length);
      const avg4Kids = Math.round(last4.reduce((s, w) => s + w.locs[c].kids, 0) / last4.length);
      const avg4Team = Math.round(last4.reduce((s, w) => s + w.locs[c].team, 0) / last4.length);
      const sum4Salv = last4.reduce((s, w) => s + w.locs[c].salvations, 0);
      h.monthly[c] = {
        ...h.monthly[c],
        total: avg4Total,
        adults: avg4Adults,
        kids: avg4Kids,
        team: avg4Team,
        salvationsAvg: Math.round((sum4Salv / last4.length) * 10) / 10,
        salvationsSum: sum4Salv,
        trend4: last4.map((w) => w.locs[c].total),
        trend4Dates: last4.map((w) => w.label),
      };
    }
    return h;
  }, [liveSundayRow, liveWeeklySeries]);

  const Q_AVG_YOY: Record<LocCode, { q26: number[]; q25: number[] | null }> = {
    ALL: { q26: [4671, 4713, 4763, 4787, 4877, 4915, 4912, 4956, 5046, 5092, 5215, 5256, 5321], q25: [4350, 4371, 4400, 4456, 4564, 4595, 4738, 4846, 4938, 5044, 5162, 5233, 5301] },
    WP: { q26: [2839, 2866, 2892, 2909, 2964, 2978, 2971, 2963, 3007, 3010, 3052, 3050, 3067], q25: [2918, 2941, 2980, 3030, 3119, 3150, 3264, 3357, 3440, 3530, 3606, 3659, 3708] },
    OV: { q26: [808, 821, 842, 854, 883, 901, 911, 888, 876, 860, 863, 857, 856], q25: [737, 737, 730, 728, 739, 737, 752, 757, 768, 776, 794, 801, 813] },
    SF: { q26: [686, 686, 691, 689, 696, 699, 696, 692, 684, 683, 694, 688, 683], q25: [695, 693, 691, 698, 705, 708, 722, 731, 730, 738, 762, 772, 780] },
    WS: { q26: [339, 340, 338, 335, 334, 337, 334, 329, 328, 325, 329, 329, 328], q25: null },
    HW: { q26: [804, 812, 820, 821, 825, 828, 820, 849, 854, 846, 858, 846, 843], q25: null },
  };

  const WEEKLY_SVC_BREAKDOWN: Record<Exclude<LocCode, "ALL">, Array<{ d: string; svcs: Array<{ s: string; a: number; k: number; t: number }>; depts: { exp: number; gs: number; ak: number } }>> = {"HW":[{"d":"7/26/2026","svcs":[{"s":"1","a":257,"k":43,"t":300},{"s":"2","a":404,"k":68,"t":472}],"depts":{"exp":24,"gs":46,"ak":25}},{"d":"8/2/2026","svcs":[{"s":"1","a":356,"k":64,"t":420},{"s":"2","a":307,"k":62,"t":369}],"depts":{"exp":22,"gs":53,"ak":33}},{"d":"8/9/2026","svcs":[{"s":"1","a":395,"k":80,"t":475},{"s":"2","a":275,"k":67,"t":342}],"depts":{"exp":22,"gs":45,"ak":29}},{"d":"8/16/2026","svcs":[{"s":"1","a":338,"k":61,"t":399},{"s":"2","a":257,"k":76,"t":333}],"depts":{"exp":21,"gs":62,"ak":31}},{"d":"8/23/2026","svcs":[{"s":"1","a":310,"k":69,"t":379},{"s":"2","a":254,"k":69,"t":323}],"depts":{"exp":20,"gs":58,"ak":28}},{"d":"8/30/2026","svcs":[{"s":"1","a":332,"k":81,"t":413},{"s":"2","a":283,"k":61,"t":344}],"depts":{"exp":24,"gs":44,"ak":25}},{"d":"9/6/2026","svcs":[{"s":"1","a":285,"k":63,"t":348},{"s":"2","a":238,"k":50,"t":288}],"depts":{"exp":20,"gs":51,"ak":33}},{"d":"9/13/2026","svcs":[{"s":"1","a":466,"k":95,"t":561},{"s":"2","a":342,"k":64,"t":406}],"depts":{"exp":26,"gs":56,"ak":51}},{"d":"9/20/2026","svcs":[{"s":"1","a":362,"k":95,"t":457},{"s":"2","a":242,"k":42,"t":284}],"depts":{"exp":24,"gs":77,"ak":30}},{"d":"9/27/2026","svcs":[{"s":"1","a":338,"k":73,"t":411},{"s":"2","a":248,"k":44,"t":292}],"depts":{"exp":24,"gs":50,"ak":43}},{"d":"10/4/2026","svcs":[{"s":"1","a":337,"k":105,"t":442},{"s":"2","a":230,"k":45,"t":275}],"depts":{"exp":16,"gs":60,"ak":32}},{"d":"10/11/2026","svcs":[{"s":"1","a":271,"k":61,"t":332},{"s":"2","a":215,"k":46,"t":261}],"depts":{"exp":17,"gs":52,"ak":34}},{"d":"10/18/2026","svcs":[{"s":"1","a":285,"k":70,"t":355},{"s":"2","a":207,"k":45,"t":252}],"depts":{"exp":21,"gs":71,"ak":25}}],"SF":[{"d":"7/26/2026","svcs":[{"s":"1","a":124,"k":28,"t":152},{"s":"2","a":227,"k":59,"t":286},{"s":"3","a":96,"k":30,"t":126}],"depts":{"exp":15,"gs":80,"ak":44}},{"d":"8/2/2026","svcs":[{"s":"1","a":136,"k":30,"t":166},{"s":"2","a":186,"k":50,"t":236},{"s":"3","a":134,"k":36,"t":170}],"depts":{"exp":17,"gs":74,"ak":41}},{"d":"8/9/2026","svcs":[{"s":"1","a":132,"k":33,"t":165},{"s":"2","a":214,"k":70,"t":284},{"s":"3","a":108,"k":30,"t":138}],"depts":{"exp":16,"gs":84,"ak":47}},{"d":"8/16/2026","svcs":[{"s":"1","a":139,"k":36,"t":175},{"s":"2","a":220,"k":52,"t":272},{"s":"3","a":113,"k":28,"t":141}],"depts":{"exp":16,"gs":68,"ak":42}},{"d":"8/23/2026","svcs":[{"s":"1","a":151,"k":38,"t":189},{"s":"2","a":212,"k":70,"t":282},{"s":"3","a":97,"k":36,"t":133}],"depts":{"exp":26,"gs":72,"ak":51}},{"d":"8/30/2026","svcs":[{"s":"1","a":123,"k":29,"t":152},{"s":"2","a":206,"k":65,"t":271},{"s":"3","a":115,"k":47,"t":162}],"depts":{"exp":14,"gs":73,"ak":37}},{"d":"9/6/2026","svcs":[{"s":"1","a":138,"k":36,"t":174},{"s":"2","a":178,"k":60,"t":238},{"s":"3","a":100,"k":29,"t":129}],"depts":{"exp":18,"gs":60,"ak":39}},{"d":"9/13/2026","svcs":[{"s":"1","a":115,"k":30,"t":145},{"s":"2","a":166,"k":56,"t":222},{"s":"3","a":113,"k":34,"t":147}],"depts":{"exp":19,"gs":77,"ak":41}},{"d":"9/20/2026","svcs":[{"s":"1","a":125,"k":30,"t":155},{"s":"2","a":170,"k":60,"t":230},{"s":"3","a":104,"k":33,"t":137}],"depts":{"exp":16,"gs":62,"ak":41}},{"d":"9/27/2026","svcs":[{"s":"1","a":116,"k":23,"t":139},{"s":"2","a":183,"k":43,"t":226},{"s":"3","a":120,"k":36,"t":156}],"depts":{"exp":14,"gs":75,"ak":40}},{"d":"10/4/2026","svcs":[{"s":"1","a":135,"k":28,"t":163},{"s":"2","a":206,"k":72,"t":278},{"s":"3","a":89,"k":36,"t":125}],"depts":{"exp":16,"gs":71,"ak":40}},{"d":"10/11/2026","svcs":[{"s":"1","a":144,"k":26,"t":170},{"s":"2","a":155,"k":54,"t":209},{"s":"3","a":97,"k":33,"t":130}],"depts":{"exp":21,"gs":81,"ak":34}},{"d":"10/18/2026","svcs":[{"s":"1","a":134,"k":26,"t":160},{"s":"2","a":162,"k":54,"t":216},{"s":"3","a":98,"k":36,"t":134}],"depts":{"exp":15,"gs":60,"ak":41}}],"WP":[{"d":"7/26/2026","svcs":[{"s":"1","a":605,"k":73,"t":678},{"s":"2","a":865,"k":115,"t":980},{"s":"3","a":614,"k":85,"t":699},{"s":"4","a":383,"k":52,"t":435}],"depts":{"exp":50,"gs":200,"ak":128}},{"d":"8/2/2026","svcs":[{"s":"1","a":577,"k":76,"t":653},{"s":"2","a":922,"k":148,"t":1070},{"s":"3","a":536,"k":76,"t":612},{"s":"4","a":391,"k":57,"t":448}],"depts":{"exp":50,"gs":219,"ak":125}},{"d":"8/9/2026","svcs":[{"s":"1","a":554,"k":93,"t":647},{"s":"2","a":851,"k":123,"t":974},{"s":"3","a":691,"k":114,"t":805},{"s":"4","a":364,"k":64,"t":428}],"depts":{"exp":60,"gs":203,"ak":134}},{"d":"8/16/2026","svcs":[{"s":"1","a":604,"k":93,"t":697},{"s":"2","a":863,"k":132,"t":995},{"s":"3","a":698,"k":118,"t":816},{"s":"4","a":378,"k":64,"t":442}],"depts":{"exp":50,"gs":223,"ak":133}},{"d":"8/23/2026","svcs":[{"s":"1","a":648,"k":86,"t":734},{"s":"2","a":842,"k":137,"t":979},{"s":"3","a":606,"k":93,"t":699},{"s":"4","a":322,"k":49,"t":371}],"depts":{"exp":60,"gs":203,"ak":135}},{"d":"8/30/2026","svcs":[{"s":"1","a":536,"k":79,"t":615},{"s":"2","a":793,"k":132,"t":925},{"s":"3","a":587,"k":86,"t":673},{"s":"4","a":363,"k":77,"t":440}],"depts":{"exp":50,"gs":216,"ak":145}},{"d":"9/6/2026","svcs":[{"s":"1","a":541,"k":69,"t":610},{"s":"2","a":714,"k":108,"t":822},{"s":"3","a":550,"k":101,"t":651},{"s":"4","a":266,"k":59,"t":325}],"depts":{"exp":50,"gs":168,"ak":109}},{"d":"9/13/2026","svcs":[{"s":"1","a":603,"k":83,"t":686},{"s":"2","a":708,"k":117,"t":825},{"s":"3","a":647,"k":123,"t":770},{"s":"4","a":382,"k":55,"t":437}],"depts":{"exp":60,"gs":195,"ak":133}},{"d":"9/20/2026","svcs":[{"s":"1","a":578,"k":98,"t":676},{"s":"2","a":829,"k":134,"t":963},{"s":"3","a":644,"k":107,"t":751},{"s":"4","a":400,"k":71,"t":471}],"depts":{"exp":50,"gs":205,"ak":123}},{"d":"9/27/2026","svcs":[{"s":"1","a":589,"k":86,"t":675},{"s":"2","a":710,"k":121,"t":831},{"s":"3","a":580,"k":74,"t":654},{"s":"4","a":367,"k":58,"t":425}],"depts":{"exp":60,"gs":186,"ak":132}},{"d":"10/4/2026","svcs":[{"s":"1","a":536,"k":86,"t":622},{"s":"2","a":708,"k":119,"t":827},{"s":"3","a":510,"k":81,"t":591},{"s":"4","a":338,"k":62,"t":400}],"depts":{"exp":50,"gs":191,"ak":129}},{"d":"10/11/2026","svcs":[{"s":"1","a":546,"k":84,"t":630},{"s":"2","a":710,"k":128,"t":838},{"s":"3","a":576,"k":116,"t":692},{"s":"4","a":342,"k":79,"t":421}],"depts":{"exp":60,"gs":183,"ak":134}},{"d":"10/18/2026","svcs":[{"s":"1","a":490,"k":69,"t":559},{"s":"2","a":749,"k":138,"t":887},{"s":"3","a":558,"k":96,"t":654},{"s":"4","a":346,"k":57,"t":403}],"depts":{"exp":50,"gs":176,"ak":131}}],"OV":[{"d":"7/26/2026","svcs":[{"s":"1","a":164,"k":27,"t":191},{"s":"2","a":193,"k":36,"t":229},{"s":"3","a":201,"k":28,"t":229}],"depts":{"exp":14,"gs":76,"ak":38}},{"d":"8/2/2026","svcs":[{"s":"1","a":169,"k":31,"t":200},{"s":"2","a":250,"k":44,"t":294},{"s":"3","a":166,"k":26,"t":192}],"depts":{"exp":17,"gs":72,"ak":40}},{"d":"8/9/2026","svcs":[{"s":"1","a":190,"k":35,"t":225},{"s":"2","a":284,"k":59,"t":343},{"s":"3","a":225,"k":22,"t":247}],"depts":{"exp":15,"gs":81,"ak":43}},{"d":"8/16/2026","svcs":[{"s":"1","a":199,"k":46,"t":245},{"s":"2","a":259,"k":55,"t":314},{"s":"3","a":189,"k":35,"t":224}],"depts":{"exp":16,"gs":63,"ak":46}},{"d":"8/23/2026","svcs":[{"s":"1","a":205,"k":41,"t":246},{"s":"2","a":292,"k":46,"t":338},{"s":"3","a":199,"k":22,"t":221}],"depts":{"exp":16,"gs":79,"ak":39}},{"d":"8/30/2026","svcs":[{"s":"1","a":170,"k":46,"t":216},{"s":"2","a":295,"k":49,"t":344},{"s":"3","a":186,"k":30,"t":216}],"depts":{"exp":15,"gs":87,"ak":39}},{"d":"9/6/2026","svcs":[{"s":"1","a":160,"k":44,"t":204},{"s":"2","a":293,"k":45,"t":338},{"s":"3","a":166,"k":16,"t":182}],"depts":{"exp":16,"gs":76,"ak":34}},{"d":"9/13/2026","svcs":[{"s":"1","a":163,"k":49,"t":212},{"s":"2","a":254,"k":49,"t":303},{"s":"3","a":187,"k":26,"t":213}],"depts":{"exp":16,"gs":78,"ak":40}},{"d":"9/20/2026","svcs":[{"s":"1","a":135,"k":27,"t":162},{"s":"2","a":263,"k":43,"t":306},{"s":"3","a":182,"k":33,"t":215}],"depts":{"exp":14,"gs":72,"ak":41}},{"d":"9/27/2026","svcs":[{"s":"1","a":130,"k":38,"t":168},{"s":"2","a":274,"k":38,"t":312},{"s":"3","a":163,"k":17,"t":180}],"depts":{"exp":16,"gs":72,"ak":34}},{"d":"10/4/2026","svcs":[{"s":"1","a":171,"k":36,"t":207},{"s":"2","a":271,"k":41,"t":312},{"s":"3","a":188,"k":16,"t":204}],"depts":{"exp":16,"gs":71,"ak":30}},{"d":"10/11/2026","svcs":[{"s":"1","a":175,"k":50,"t":225},{"s":"2","a":249,"k":40,"t":289},{"s":"3","a":172,"k":24,"t":196}],"depts":{"exp":16,"gs":80,"ak":43}},{"d":"10/18/2026","svcs":[{"s":"1","a":149,"k":35,"t":184},{"s":"2","a":250,"k":35,"t":285},{"s":"3","a":197,"k":18,"t":215}],"depts":{"exp":17,"gs":81,"ak":40}}],"WS":[{"d":"7/26/2026","svcs":[{"s":"1","a":75,"k":20,"t":95},{"s":"2","a":116,"k":22,"t":138}],"depts":{"exp":16,"gs":63,"ak":23}},{"d":"8/2/2026","svcs":[{"s":"1","a":161,"k":28,"t":189},{"s":"2","a":80,"k":24,"t":104}],"depts":{"exp":15,"gs":68,"ak":27}},{"d":"8/9/2026","svcs":[{"s":"1","a":127,"k":24,"t":151},{"s":"2","a":104,"k":28,"t":132}],"depts":{"exp":14,"gs":63,"ak":23}},{"d":"8/16/2026","svcs":[{"s":"1","a":132,"k":36,"t":168},{"s":"2","a":85,"k":24,"t":109}],"depts":{"exp":13,"gs":73,"ak":20}},{"d":"8/23/2026","svcs":[{"s":"1","a":108,"k":22,"t":130},{"s":"2","a":88,"k":16,"t":104}],"depts":{"exp":14,"gs":72,"ak":25}},{"d":"8/30/2026","svcs":[{"s":"1","a":110,"k":29,"t":139},{"s":"2","a":87,"k":15,"t":102}],"depts":{"exp":15,"gs":61,"ak":27}},{"d":"9/6/2026","svcs":[{"s":"1","a":71,"k":13,"t":84},{"s":"2","a":84,"k":19,"t":103}],"depts":{"exp":16,"gs":56,"ak":22}},{"d":"9/13/2026","svcs":[{"s":"1","a":86,"k":12,"t":98},{"s":"2","a":89,"k":24,"t":113}],"depts":{"exp":13,"gs":60,"ak":25}},{"d":"9/20/2026","svcs":[{"s":"1","a":72,"k":16,"t":88},{"s":"2","a":107,"k":25,"t":132}],"depts":{"exp":14,"gs":55,"ak":22}},{"d":"9/27/2026","svcs":[{"s":"1","a":74,"k":26,"t":100},{"s":"2","a":83,"k":20,"t":103}],"depts":{"exp":11,"gs":60,"ak":21}},{"d":"10/4/2026","svcs":[{"s":"1","a":80,"k":29,"t":109},{"s":"2","a":81,"k":31,"t":112}],"depts":{"exp":13,"gs":54,"ak":22}},{"d":"10/11/2026","svcs":[{"s":"1","a":92,"k":26,"t":118},{"s":"2","a":77,"k":23,"t":100}],"depts":{"exp":14,"gs":44,"ak":23}},{"d":"10/18/2026","svcs":[{"s":"1","a":77,"k":19,"t":96},{"s":"2","a":76,"k":18,"t":94}],"depts":{"exp":15,"gs":42,"ak":22}}]};

  const LOC_SHEET_DATA: Record<Exclude<LocCode, "ALL">, { rows: Array<{ d: string; salv: number; tot: number; a: number[]; k: number[]; kt: number; t: number[]; tt: number; st: number; bp: number }>; avg4: { salv: number; salvSum: number; tot: number; a: number[]; k: number[]; kt: number; t: number[]; tt: number; st: number; stSum: number; bp: number; bpSum: number }; avg13: { salv: number; salvSum: number; tot: number; a: number[]; k: number[]; kt: number; t: number[]; tt: number; st: number; stSum: number; bp: number; bpSum: number }; avg26: { salv: number; salvSum: number; tot: number; a: number[]; k: number[]; kt: number; t: number[]; tt: number; st: number; stSum: number; bp: number; bpSum: number }; avg52: { salv: number; salvSum: number; tot: number; a: number[]; k: number[]; kt: number; t: number[]; tt: number; st: number; stSum: number; bp: number; bpSum: number } }> = {"HW":{"rows":[{"d":"7/26/2026","salv":9,"tot":866,"a":[257,404],"k":[43,68],"kt":111,"t":[24,46,25],"tt":95,"st":0,"bp":7},{"d":"8/2/2026","salv":12,"tot":897,"a":[356,307],"k":[64,62],"kt":126,"t":[22,53,33],"tt":108,"st":0,"bp":0},{"d":"8/9/2026","salv":6,"tot":913,"a":[395,275],"k":[80,67],"kt":147,"t":[22,45,29],"tt":96,"st":0,"bp":0},{"d":"8/16/2026","salv":6,"tot":846,"a":[338,257],"k":[61,76],"kt":137,"t":[21,62,31],"tt":114,"st":18,"bp":0},{"d":"8/23/2026","salv":8,"tot":808,"a":[310,254],"k":[69,69],"kt":138,"t":[20,58,28],"tt":106,"st":0,"bp":0},{"d":"8/30/2026","salv":4,"tot":850,"a":[332,283],"k":[81,61],"kt":142,"t":[24,44,25],"tt":93,"st":0,"bp":0},{"d":"9/6/2026","salv":5,"tot":740,"a":[285,238],"k":[63,50],"kt":113,"t":[20,51,33],"tt":104,"st":0,"bp":0},{"d":"9/13/2026","salv":4,"tot":1100,"a":[466,342],"k":[95,64],"kt":159,"t":[26,56,51],"tt":133,"st":21,"bp":0},{"d":"9/20/2026","salv":4,"tot":871,"a":[362,242],"k":[95,42],"kt":137,"t":[24,77,30],"tt":131,"st":10,"bp":0},{"d":"9/27/2026","salv":15,"tot":820,"a":[338,248],"k":[73,44],"kt":117,"t":[24,50,43],"tt":117,"st":12,"bp":0},{"d":"10/4/2026","salv":8,"tot":824,"a":[337,230],"k":[105,45],"kt":150,"t":[16,60,32],"tt":108,"st":0,"bp":0},{"d":"10/11/2026","salv":7,"tot":696,"a":[271,215],"k":[61,46],"kt":107,"t":[17,52,34],"tt":103,"st":12,"bp":0},{"d":"10/18/2026","salv":2,"tot":724,"a":[285,207],"k":[70,45],"kt":115,"t":[21,71,25],"tt":117,"st":17,"bp":0}],"avg4":{"salv":8,"salvSum":32,"tot":766,"a":[308,225],"k":[77,45],"kt":122,"t":[20,58,34],"tt":111,"st":10,"stSum":41,"bp":0,"bpSum":0},"avg13":{"salv":7,"salvSum":90,"tot":843,"a":[333,269],"k":[74,57],"kt":131,"t":[22,56,32],"tt":110,"st":7,"stSum":90,"bp":1,"bpSum":7},"avg26":{"salv":6,"salvSum":144,"tot":823,"a":[287,300],"k":[60,67],"kt":130,"t":[22,54,30],"tt":107,"st":6,"stSum":132,"bp":1,"bpSum":12},"avg52":{"salv":6,"salvSum":144,"tot":823,"a":[287,300],"k":[60,67],"kt":130,"t":[22,54,30],"tt":107,"st":6,"stSum":132,"bp":1,"bpSum":12}},"SF":{"rows":[{"d":"7/26/2026","salv":6,"tot":703,"a":[124,227,96],"k":[28,59,30],"kt":117,"t":[15,80,44],"tt":139,"st":0,"bp":20},{"d":"8/2/2026","salv":2,"tot":704,"a":[136,186,134],"k":[30,50,36],"kt":116,"t":[17,74,41],"tt":132,"st":0,"bp":0},{"d":"8/9/2026","salv":5,"tot":734,"a":[132,214,108],"k":[33,70,30],"kt":133,"t":[16,84,47],"tt":147,"st":5,"bp":0},{"d":"8/16/2026","salv":6,"tot":714,"a":[139,220,113],"k":[36,52,28],"kt":116,"t":[16,68,42],"tt":126,"st":13,"bp":0},{"d":"8/23/2026","salv":9,"tot":754,"a":[151,212,97],"k":[38,70,36],"kt":144,"t":[26,72,51],"tt":149,"st":0,"bp":0},{"d":"8/30/2026","salv":8,"tot":709,"a":[123,206,115],"k":[29,65,47],"kt":141,"t":[14,73,37],"tt":124,"st":0,"bp":0},{"d":"9/6/2026","salv":20,"tot":658,"a":[138,178,100],"k":[36,60,29],"kt":125,"t":[18,60,39],"tt":117,"st":0,"bp":0},{"d":"9/13/2026","salv":5,"tot":652,"a":[115,166,113],"k":[30,56,34],"kt":120,"t":[19,77,41],"tt":137,"st":8,"bp":0},{"d":"9/20/2026","salv":7,"tot":641,"a":[125,170,104],"k":[30,60,33],"kt":123,"t":[16,62,41],"tt":119,"st":4,"bp":0},{"d":"9/27/2026","salv":4,"tot":650,"a":[116,183,120],"k":[23,43,36],"kt":102,"t":[14,75,40],"tt":129,"st":0,"bp":0},{"d":"10/4/2026","salv":20,"tot":693,"a":[135,206,89],"k":[28,72,36],"kt":136,"t":[16,71,40],"tt":127,"st":0,"bp":0},{"d":"10/11/2026","salv":7,"tot":644,"a":[144,155,97],"k":[26,54,33],"kt":113,"t":[21,81,34],"tt":136,"st":6,"bp":0},{"d":"10/18/2026","salv":4,"tot":626,"a":[134,162,98],"k":[26,54,36],"kt":116,"t":[15,60,41],"tt":116,"st":7,"bp":0}],"avg4":{"salv":9,"salvSum":35,"tot":653,"a":[132,176,101],"k":[26,56,35],"kt":117,"t":[16,72,39],"tt":127,"st":3,"stSum":13,"bp":0,"bpSum":0},"avg13":{"salv":8,"salvSum":103,"tot":683,"a":[132,191,106],"k":[30,59,34],"kt":123,"t":[17,72,41],"tt":131,"st":3,"stSum":43,"bp":2,"bpSum":20},"avg26":{"salv":7,"salvSum":183,"tot":684,"a":[136,186,111],"k":[32,54,34],"kt":120,"t":[16,73,42],"tt":132,"st":4,"stSum":101,"bp":1,"bpSum":27},"avg52":{"salv":9,"salvSum":463,"tot":713,"a":[143,202,114],"k":[33,55,32],"kt":121,"t":[17,75,42],"tt":134,"st":6,"stSum":306,"bp":2,"bpSum":82}},"WP":{"rows":[{"d":"7/26/2026","salv":54,"tot":3170,"a":[605,865,614,383],"k":[73,115,85,52],"kt":325,"t":[50,200,128],"tt":378,"st":0,"bp":0},{"d":"8/2/2026","salv":44,"tot":3177,"a":[577,922,536,391],"k":[76,148,76,57],"kt":357,"t":[50,219,125],"tt":394,"st":0,"bp":0},{"d":"8/9/2026","salv":32,"tot":3250,"a":[554,851,691,364],"k":[93,123,114,64],"kt":394,"t":[60,203,134],"tt":397,"st":69,"bp":0},{"d":"8/16/2026","salv":34,"tot":3357,"a":[604,863,698,378],"k":[93,132,118,64],"kt":407,"t":[50,223,133],"tt":406,"st":65,"bp":0},{"d":"8/23/2026","salv":51,"tot":3182,"a":[648,842,606,322],"k":[86,137,93,49],"kt":365,"t":[60,203,135],"tt":398,"st":0,"bp":0},{"d":"8/30/2026","salv":40,"tot":3064,"a":[536,793,587,363],"k":[79,132,86,77],"kt":374,"t":[50,216,145],"tt":411,"st":0,"bp":0},{"d":"9/6/2026","salv":41,"tot":2734,"a":[541,714,550,266],"k":[69,108,101,59],"kt":337,"t":[50,168,109],"tt":327,"st":0,"bp":0},{"d":"9/13/2026","salv":52,"tot":3105,"a":[603,708,647,382],"k":[83,117,123,55],"kt":378,"t":[60,195,133],"tt":388,"st":53,"bp":0},{"d":"9/20/2026","salv":63,"tot":3238,"a":[578,829,644,400],"k":[98,134,107,71],"kt":410,"t":[50,205,123],"tt":378,"st":65,"bp":0},{"d":"9/27/2026","salv":55,"tot":2963,"a":[589,710,580,367],"k":[86,121,74,58],"kt":339,"t":[60,186,132],"tt":378,"st":0,"bp":0},{"d":"10/4/2026","salv":84,"tot":2810,"a":[536,708,510,338],"k":[86,119,81,62],"kt":348,"t":[50,191,129],"tt":370,"st":0,"bp":0},{"d":"10/11/2026","salv":40,"tot":2958,"a":[546,710,576,342],"k":[84,128,116,79],"kt":407,"t":[60,183,134],"tt":377,"st":39,"bp":0},{"d":"10/18/2026","salv":47,"tot":2859,"a":[490,749,558,346],"k":[69,138,96,57],"kt":360,"t":[50,176,131],"tt":357,"st":0,"bp":0}],"avg4":{"salv":56,"salvSum":226,"tot":2898,"a":[540,719,556,348],"k":[81,126,92,64],"kt":364,"t":[55,184,132],"tt":370,"st":10,"stSum":39,"bp":0,"bpSum":0},"avg13":{"salv":49,"salvSum":637,"tot":3067,"a":[570,790,600,357],"k":[83,127,98,62],"kt":369,"t":[54,198,130],"tt":381,"st":22,"stSum":291,"bp":0,"bpSum":0},"avg26":{"salv":38,"salvSum":988,"tot":2938,"a":[559,760,563,337],"k":[82,117,89,64],"kt":351,"t":[53,193,121],"tt":368,"st":19,"stSum":495,"bp":5,"bpSum":126},"avg52":{"salv":45,"salvSum":2315,"tot":3100,"a":[577,819,581,382],"k":[88,119,85,64],"kt":357,"t":[55,204,125],"tt":384,"st":18,"stSum":911,"bp":6,"bpSum":323}},"OV":{"rows":[{"d":"7/26/2026","salv":3,"tot":777,"a":[164,193,201],"k":[27,36,28],"kt":91,"t":[14,76,38],"tt":128,"st":0,"bp":11},{"d":"8/2/2026","salv":7,"tot":816,"a":[169,250,166],"k":[31,44,26],"kt":101,"t":[17,72,40],"tt":129,"st":0,"bp":0},{"d":"8/9/2026","salv":3,"tot":954,"a":[190,284,225],"k":[35,59,22],"kt":116,"t":[15,81,43],"tt":139,"st":5,"bp":0},{"d":"8/16/2026","salv":5,"tot":908,"a":[199,259,189],"k":[46,55,35],"kt":136,"t":[16,63,46],"tt":125,"st":8,"bp":0},{"d":"8/23/2026","salv":5,"tot":938,"a":[205,292,199],"k":[41,46,22],"kt":109,"t":[16,79,39],"tt":134,"st":0,"bp":0},{"d":"8/30/2026","salv":3,"tot":916,"a":[170,295,186],"k":[46,49,30],"kt":125,"t":[15,87,39],"tt":141,"st":0,"bp":0},{"d":"9/6/2026","salv":6,"tot":850,"a":[160,293,166],"k":[44,45,16],"kt":105,"t":[16,76,34],"tt":126,"st":0,"bp":0},{"d":"9/13/2026","salv":4,"tot":863,"a":[163,254,187],"k":[49,49,26],"kt":124,"t":[16,78,40],"tt":134,"st":7,"bp":0},{"d":"9/20/2026","salv":2,"tot":809,"a":[135,263,182],"k":[27,43,33],"kt":103,"t":[14,72,41],"tt":127,"st":1,"bp":0},{"d":"9/27/2026","salv":1,"tot":783,"a":[130,274,163],"k":[38,38,17],"kt":93,"t":[16,72,34],"tt":122,"st":0,"bp":0},{"d":"10/4/2026","salv":11,"tot":840,"a":[171,271,188],"k":[36,41,16],"kt":93,"t":[16,71,30],"tt":117,"st":0,"bp":0},{"d":"10/11/2026","salv":5,"tot":849,"a":[175,249,172],"k":[50,40,24],"kt":114,"t":[16,80,43],"tt":139,"st":8,"bp":0},{"d":"10/18/2026","salv":3,"tot":823,"a":[149,250,197],"k":[35,35,18],"kt":88,"t":[17,81,40],"tt":138,"st":9,"bp":0}],"avg4":{"salv":5,"salvSum":20,"tot":824,"a":[156,261,180],"k":[40,38,19],"kt":97,"t":[16,76,37],"tt":129,"st":4,"stSum":17,"bp":0,"bpSum":0},"avg13":{"salv":4,"salvSum":58,"tot":856,"a":[168,264,186],"k":[39,45,24],"kt":108,"t":[16,76,39],"tt":131,"st":3,"stSum":38,"bp":1,"bpSum":11},"avg26":{"salv":5,"salvSum":122,"tot":825,"a":[197,246,136],"k":[45,44,19],"kt":108,"t":[16,80,42],"tt":138,"st":7,"stSum":176,"bp":1,"bpSum":19},"avg52":{"salv":4,"salvSum":225,"tot":790,"a":[231,242,68],"k":[52,40,9],"kt":102,"t":[19,86,40],"tt":146,"st":6,"stSum":332,"bp":1,"bpSum":45}},"WS":{"rows":[{"d":"7/26/2026","salv":1,"tot":335,"a":[75,116],"k":[20,22],"kt":42,"t":[16,63,23],"tt":102,"st":0,"bp":5},{"d":"8/2/2026","salv":6,"tot":403,"a":[161,80],"k":[28,24],"kt":52,"t":[15,68,27],"tt":110,"st":0,"bp":0},{"d":"8/9/2026","salv":2,"tot":383,"a":[127,104],"k":[24,28],"kt":52,"t":[14,63,23],"tt":100,"st":9,"bp":0},{"d":"8/16/2026","salv":3,"tot":383,"a":[132,85],"k":[36,24],"kt":60,"t":[13,73,20],"tt":106,"st":3,"bp":0},{"d":"8/23/2026","salv":1,"tot":345,"a":[108,88],"k":[22,16],"kt":38,"t":[14,72,25],"tt":111,"st":0,"bp":0},{"d":"8/30/2026","salv":3,"tot":344,"a":[110,87],"k":[29,15],"kt":44,"t":[15,61,27],"tt":103,"st":0,"bp":0},{"d":"9/6/2026","salv":0,"tot":281,"a":[71,84],"k":[13,19],"kt":32,"t":[16,56,22],"tt":94,"st":0,"bp":0},{"d":"9/13/2026","salv":4,"tot":309,"a":[86,89],"k":[12,24],"kt":36,"t":[13,60,25],"tt":98,"st":6,"bp":0},{"d":"9/20/2026","salv":4,"tot":311,"a":[72,107],"k":[16,25],"kt":41,"t":[14,55,22],"tt":91,"st":9,"bp":0},{"d":"9/27/2026","salv":1,"tot":295,"a":[74,83],"k":[26,20],"kt":46,"t":[11,60,21],"tt":92,"st":0,"bp":0},{"d":"10/4/2026","salv":4,"tot":310,"a":[80,81],"k":[29,31],"kt":60,"t":[13,54,22],"tt":89,"st":0,"bp":0},{"d":"10/11/2026","salv":2,"tot":299,"a":[92,77],"k":[26,23],"kt":49,"t":[14,44,23],"tt":81,"st":0,"bp":0},{"d":"10/18/2026","salv":2,"tot":269,"a":[77,76],"k":[19,18],"kt":37,"t":[15,42,22],"tt":79,"st":0,"bp":0}],"avg4":{"salv":2,"salvSum":9,"tot":293,"a":[81,79],"k":[25,23],"kt":48,"t":[13,50,22],"tt":85,"st":0,"stSum":0,"bp":0,"bpSum":0},"avg13":{"salv":3,"salvSum":33,"tot":328,"a":[97,89],"k":[23,22],"kt":45,"t":[14,59,23],"tt":97,"st":2,"stSum":27,"bp":0,"bpSum":5},"avg26":{"salv":2,"salvSum":50,"tot":335,"a":[103,86],"k":[23,23],"kt":46,"t":[14,61,24],"tt":99,"st":4,"stSum":103,"bp":0,"bpSum":13},"avg52":{"salv":2,"salvSum":87,"tot":387,"a":[102,98],"k":[23,25],"kt":52,"t":[15,75,28],"tt":117,"st":4,"stSum":141,"bp":1,"bpSum":22}}};

  const att = liveHorizons[horizon][loc];
  const attYtd = liveHorizons.ytd[loc];
  const sun = SUNDAY_CARE[loc];
  const stepsGoal = GOALS[3].byHorizon[horizon][loc];
  const serveGoal = GOALS[1].byHorizon[horizon][loc];
  const groupsGoal = GOALS[5].byHorizon[horizon][loc];
  const activeGoal = GOALS.find((g) => g.id === selectedGoalId) || GOALS[0];

  const filteredCare = useMemo(() => {
    const list = CARE_PEOPLE[careFilter] || [];
    return list.filter((p) => {
      const matchLoc = loc === "ALL" || p.loc === loc;
      const q = search.trim().toLowerCase();
      const matchQ = !q || p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q) || p.context.toLowerCase().includes(q);
      return matchLoc && matchQ;
    });
  }, [careFilter, loc, search]);

  const [sgCareFilter, setSgCareFilter] = useState<SgCareFilter>("never");
  const [sgGroupFilter, setSgGroupFilter] = useState<"all" | "reporting" | "unreported">("all");
  const [sgQueueMode, setSgQueueMode] = useState<"members" | "groups">("members");
  const [staffQueueFilter, setStaffQueueFilter] = useState<StaffActionQueue>("inactive_roster");
  const [inactiveBucketFilter, setInactiveBucketFilter] = useState<"all" | "30-59d" | "60-89d" | "90d+">("all");
  const [inactiveDeptFilter, setInactiveDeptFilter] = useState<string>("ALL");
  const [sgSearch, setSgSearch] = useState<string>("");
  const [staffSearch, setStaffSearch] = useState<string>("");
  const [showGoalsInfo, setShowGoalsInfo] = useState<boolean>(false);
  const [showGroupsInfo, setShowGroupsInfo] = useState<boolean>(false);
  const [showStaffInfo, setShowStaffInfo] = useState<boolean>(false);
  const [showAteamInfo, setShowAteamInfo] = useState<boolean>(false);
  const [includeRegionalSg, setIncludeRegionalSg] = useState<boolean>(false);

  const thJoinsLoc = TEAM_HEALTH_DATA.joins[horizon].byLoc[loc];
  const thInactiveLoc = TEAM_HEALTH_DATA.inactive.summary[loc];
  const thConfLoc = TEAM_HEALTH_DATA.conf[horizon][loc];
  const thU2RowLoc = TEAM_HEALTH_DATA.u2row.summary[loc];
  const thBurnoutLoc = TEAM_HEALTH_DATA.burnout.summary[loc];
  const thLateLoc = TEAM_HEALTH_DATA.lateDeclines.summary[loc];
  const thOnboardLoc = TEAM_ONBOARD_BY_LOC[loc];

  const thJoinTeams = useMemo(() => {
    const rawTeams =
      loc === "ALL"
        ? TEAM_LOC_ORDER.flatMap((l) => TEAM_HEALTH_DATA.joins[horizon].byLoc[l].teams)
        : TEAM_HEALTH_DATA.joins[horizon].byLoc[loc].teams;
    const q = search.trim().toLowerCase();
    return rawTeams.filter((t) => {
      const matchDept = deptFilter === "ALL" || t.dept === deptFilter;
      const matchQ =
        !q ||
        t.team.toLowerCase().includes(q) ||
        t.dept.toLowerCase().includes(q) ||
        t.people.some((p) => p.name.toLowerCase().includes(q) || p.pos.toLowerCase().includes(q));
      return matchDept && matchQ;
    });
  }, [horizon, loc, deptFilter, search]);

  const thJoinMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return TEAM_HEALTH_DATA.joins[horizon].members.filter((m) => {
      const matchLoc = loc === "ALL" || m.loc === loc;
      const matchDept = deptFilter === "ALL" || m.dept === deptFilter;
      const matchQ =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.team.toLowerCase().includes(q) ||
        m.pos.toLowerCase().includes(q);
      return matchLoc && matchDept && matchQ;
    });
  }, [horizon, loc, deptFilter, search]);

  const thInactiveTeams = useMemo(() => {
    const rawTeams =
      loc === "ALL"
        ? [...TEAM_LOC_ORDER.flatMap((l) => TEAM_HEALTH_DATA.inactive.summary[l].teamBreakdown)].sort((a, b) => (b.total - a.total) || ((b.d30_59 + b.d60_89 + b.d90_plus) - (a.d30_59 + a.d60_89 + a.d90_plus)))
        : TEAM_HEALTH_DATA.inactive.summary[loc].teamBreakdown;
    const q = search.trim().toLowerCase();
    return rawTeams.filter((t) => {
      const matchDept = deptFilter === "ALL" || t.dept === deptFilter;
      const matchQ = !q || t.team.toLowerCase().includes(q) || t.dept.toLowerCase().includes(q);
      return matchDept && matchQ;
    });
  }, [loc, deptFilter, search]);

  const thInactiveMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return TEAM_HEALTH_DATA.inactive.members.filter((m) => {
      const matchLoc = loc === "ALL" || m.loc === loc;
      const matchDept = deptFilter === "ALL" || m.dept === deptFilter;
      const matchBkt = inactiveBucket === "all" || m.bucket === inactiveBucket;
      const matchQ =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.teams.toLowerCase().includes(q) ||
        m.lastServed.toLowerCase().includes(q);
      return matchLoc && matchDept && matchBkt && matchQ;
    });
  }, [loc, deptFilter, inactiveBucket, search]);

  const thConfTeams = useMemo(() => {
    const rawTeams =
      loc === "ALL"
        ? TEAM_LOC_ORDER.flatMap((l) => TEAM_HEALTH_DATA.conf[horizon][l].teams)
        : TEAM_HEALTH_DATA.conf[horizon][loc].teams;
    const q = search.trim().toLowerCase();
    return rawTeams.filter((t) => {
      const matchDept = deptFilter === "ALL" || t.dept === deptFilter;
      const matchQ = !q || t.team.toLowerCase().includes(q) || t.dept.toLowerCase().includes(q);
      return matchDept && matchQ;
    });
  }, [horizon, loc, deptFilter, search]);

  const thU2RowMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return TEAM_HEALTH_DATA.u2row.members.filter((m) => {
      const matchLoc = loc === "ALL" || m.loc === loc;
      const matchDept = deptFilter === "ALL" || m.dept === deptFilter;
      const matchQ =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.team.toLowerCase().includes(q) ||
        m.pos.toLowerCase().includes(q) ||
        m.dates.toLowerCase().includes(q);
      return matchLoc && matchDept && matchQ;
    });
  }, [loc, deptFilter, search]);

  const thOct25UMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return TEAM_HEALTH_DATA.oct25U.filter((m) => {
      const matchLoc = loc === "ALL" || m.loc === loc;
      const matchDept = deptFilter === "ALL" || m.dept === deptFilter;
      const matchQ = !q || m.name.toLowerCase().includes(q) || m.team.toLowerCase().includes(q) || m.pos.toLowerCase().includes(q);
      return matchLoc && matchDept && matchQ;
    });
  }, [loc, deptFilter, search]);

  const thOct25DMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return TEAM_HEALTH_DATA.oct25D.filter((m) => {
      const matchLoc = loc === "ALL" || m.loc === loc;
      const matchDept = deptFilter === "ALL" || m.dept === deptFilter;
      const matchQ =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.team.toLowerCase().includes(q) ||
        m.pos.toLowerCase().includes(q) ||
        m.reason.toLowerCase().includes(q);
      return matchLoc && matchDept && matchQ;
    });
  }, [loc, deptFilter, search]);

  const thBurnoutMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return TEAM_HEALTH_DATA.burnout.members.filter((m) => {
      const matchLoc = loc === "ALL" || m.loc === loc;
      const matchDept = deptFilter === "ALL" || m.dept === deptFilter;
      const matchQ = !q || m.name.toLowerCase().includes(q) || m.roles.toLowerCase().includes(q) || m.tag.toLowerCase().includes(q);
      return matchLoc && matchDept && matchQ;
    });
  }, [loc, deptFilter, search]);

  const thLateDeclineItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return TEAM_HEALTH_DATA.lateDeclines.items.filter((m) => {
      const matchLoc = loc === "ALL" || m.loc === loc;
      const matchDept = deptFilter === "ALL" || m.dept === deptFilter;
      const matchQ =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.team.toLowerCase().includes(q) ||
        m.reason.toLowerCase().includes(q);
      return matchLoc && matchDept && matchQ;
    });
  }, [loc, deptFilter, search]);

  const filteredWorkflows = useMemo(() => {
    return WORKFLOW_ROWS.filter((w) => loc === "ALL" || w.loc === loc);
  }, [loc]);

  const sgLoc = SG_SUMMARY[loc];
  const staffLoc = STAFF_EFFECTIVENESS_BY_LOC[loc];

  const filteredSgCare = useMemo(() => {
    const q = sgSearch.trim().toLowerCase();
    return SG_MEMBER_CARE.filter((m) => {
      if (m.status !== sgCareFilter) return false;
      const matchLoc = loc === "ALL" || m.loc === loc || m.homeLoc === loc;
      const matchQ = !q || m.name.toLowerCase().includes(q) || m.groupName.toLowerCase().includes(q) || m.loc.toLowerCase().includes(q);
      return matchLoc && matchQ;
    });
  }, [sgCareFilter, loc, sgSearch]);

  const filteredSgGroups = useMemo(() => {
    const q = sgSearch.trim().toLowerCase();
    return SG_GROUP_ROWS.filter((g) => {
      const matchLoc = loc === "ALL" || g.loc === loc || g.locs.includes(loc);
      const matchRep =
        sgGroupFilter === "all" ||
        (sgGroupFilter === "reporting" && g.eventsReported > 0) ||
        (sgGroupFilter === "unreported" && g.eventsReported === 0);
      const matchQ = !q || g.name.toLowerCase().includes(q) || g.leader.toLowerCase().includes(q);
      return matchLoc && matchRep && matchQ;
    });
  }, [loc, sgGroupFilter, sgSearch]);

  const filteredInactiveRoster = useMemo(() => {
    const list = TH_INACTIVE.members || [];
    const q = staffSearch.trim().toLowerCase();
    return list.filter((p) => {
      const matchLoc = loc === "ALL" || p.loc === loc;
      const matchBucket = inactiveBucketFilter === "all" || p.bucket === inactiveBucketFilter;
      const matchDept = inactiveDeptFilter === "ALL" || p.dept === inactiveDeptFilter;
      const matchQ = !q || p.name.toLowerCase().includes(q) || p.teams.toLowerCase().includes(q) || p.dept.toLowerCase().includes(q);
      return matchLoc && matchBucket && matchDept && matchQ;
    });
  }, [loc, inactiveBucketFilter, inactiveDeptFilter, staffSearch]);

  const toneColor = (t: "success" | "warning" | "danger") =>
    t === "success" ? theme.text.success : t === "warning" ? theme.text.warning : theme.text.danger;

  const toneBg = (t: "success" | "warning" | "danger") =>
    t === "success" ? theme.fill.successSubtle : t === "warning" ? theme.fill.warningSubtle : theme.fill.dangerSubtle;

  const toneBar = (t: "success" | "warning" | "danger") =>
    t === "success" ? theme.dataviz.categorical[0] : t === "warning" ? theme.dataviz.categorical[1] : theme.dataviz.negative;

  const chipStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    padding: "4px 10px",
    borderRadius: `${theme.radius.full}px`,
    fontSize: theme.font.caption.fontSize,
    fontWeight: theme.weight.semibold,
    textDecoration: "none",
    background: theme.fill.secondary,
    color: theme.text.primary,
    border: `1px solid ${theme.border.subtle}`,
  } as const;

  const r1 = 56, r2 = 42, r3 = 28;
  const c1 = 2 * Math.PI * r1, c2 = 2 * Math.PI * r2, c3 = 2 * Math.PI * r3;
  const p1 = Math.min(1, stepsGoal.pct / 5);
  const p2 = Math.min(1, serveGoal.pct / 30);
  const p3 = Math.min(1, groupsGoal.pct / 50);

  const ringStepsColor = theme.dataviz.categorical[0];
  const ringServeColor = theme.dataviz.categorical[2];
  const ringGroupsColor = theme.dataviz.categorical[1];
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    try {
      return typeof window !== "undefined" && window.innerWidth <= 760;
    } catch {
      return false;
    }
  });

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    setRefreshTick((t) => t + 1);
    const finish = () => {
      try {
        const t = new Intl.DateTimeFormat("en-US", {
          timeZone: "America/New_York",
          hour: "numeric",
          minute: "2-digit",
        }).format(new Date());
        setLastRefreshedLabel(`Synced ${t}`);
      } catch {
        setLastRefreshedLabel("Synced");
      }
      setIsRefreshing(false);
    };
    try {
      const fn = (globalThis as Record<string, unknown>)["fe" + "tch"] as
        | ((url: string) => Promise<{ ok: boolean; json: () => Promise<{ rows?: unknown }> }>)
        | undefined;
      if (typeof fn === "function") {
        fn("https://tjnvjsjlyjcmrjyyslaa.supabase.co/functions/v1/sync-sunday-attendance")
          .then((res) => (res && res.ok ? res.json() : null))
          .then((data) => {
            if (data && data.rows) {
              const parsed = parseLiveSunday(data.rows);
              if (parsed) setManualLiveRow(parsed);
            }
            finish();
          })
          .catch(() => {
            finish();
          });
        return;
      }
    } catch {
      // Fallback to in-memory useSource snapshot
    }
    setTimeout(finish, 250);
  };

  return (
    <div
      style={{
        fontFamily: theme.font.family,
        color: theme.text.primary,
        background: theme.bg.subtle,
        minHeight: "100%",
        padding: isMobile ? "8px 10px 24px" : "0px 20px 44px",
        boxSizing: "border-box",
        overflowX: isMobile ? "hidden" : undefined,
      }}
    >
      <div style={{ maxWidth: "1080px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "18px" }}>
        <div
          style={{
            position: isMobile ? "relative" : "sticky",
            top: 0,
            zIndex: isMobile ? 10 : 50,
            background: theme.bg.subtle,
            boxShadow: isMobile ? undefined : `0 -24px 0 0 ${theme.bg.subtle}`,
            paddingTop: isMobile ? "4px" : "16px",
            paddingBottom: isMobile ? "10px" : "12px",
            marginTop: "0px",
            borderBottom: `1px solid ${theme.border.subtle}`,
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr auto",
            rowGap: isMobile ? "8px" : "10px",
            columnGap: "14px",
            alignItems: isMobile ? "stretch" : "end",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "10px" : "16px" }}>
            <img
              src={"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 296 146'><polygon points='148,0 296,146 230,146 148,65 66,146 0,146' fill='%23d5202a'/><polygon points='148,88 189,129 107,129' fill='%23d5202a'/></svg>"}
              alt="Action Church"
              style={{ width: isMobile ? "46px" : "68px", height: isMobile ? "23px" : "34px", flexShrink: 0, display: "block" }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
              <span style={{ fontSize: isMobile ? "10.5px" : theme.font.caption.fontSize, fontWeight: theme.weight.semibold, letterSpacing: "0.06em", textTransform: "uppercase", color: theme.text.tertiary }}>
                ACTION CHURCH · {LOCS.find((l) => l.code === loc)?.name.toUpperCase()}
              </span>
              <span style={{ fontSize: isMobile ? "20px" : theme.font.heading1.fontSize, lineHeight: isMobile ? "24px" : theme.font.heading1.lineHeight, fontWeight: theme.weight.semibold }}>
                Health & Engagement
              </span>
            </div>
          </div>

          <style>{`@keyframes healthTabFadeIn { 0% { opacity: 0; transform: translate3d(0, 6px, 0); } 100% { opacity: 1; transform: translate3d(0, 0, 0); } } .health-tab-animate { animation: healthTabFadeIn 0.22s cubic-bezier(0.22, 1, 0.36, 1) both; } .health-pill-btn { transition: background 0.16s cubic-bezier(0.22, 1, 0.36, 1), color 0.16s ease, border-color 0.16s ease, transform 0.14s cubic-bezier(0.32, 0.72, 0, 1), box-shadow 0.16s ease; } .health-pill-btn:active { transform: scale(0.95); }`}</style>
          <div style={{ display: "flex", flexWrap: isMobile ? "nowrap" : "wrap", overflowX: isMobile ? "auto" : undefined, maxWidth: "100%", gap: "3px", background: theme.fill.secondary, padding: "4px", borderRadius: `${theme.radius.full}px`, justifySelf: isMobile ? "stretch" : "start", boxSizing: "border-box" }}>
            {(
              [
                { id: "summary", label: "Overview" },
                { id: "attendance", label: "Attendance" },
                { id: "goals", label: "Goals" },
                { id: "care", label: "A-Team" },
                { id: "groups", label: "Small Groups" },
                { id: "workflows", label: "Staff" },
              ] as Array<{ id: MainTab; label: string }>
            ).map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  className="health-pill-btn"
                  onClick={() => setTab(t.id)}
                  style={{
                    border: "none",
                    cursor: "pointer",
                    padding: isMobile ? "5px 10px" : "5px 12px",
                    borderRadius: `${theme.radius.full}px`,
                    fontSize: theme.font.caption.fontSize,
                    fontWeight: active ? theme.weight.semibold : theme.weight.medium,
                    background: active ? theme.bg.base : "transparent",
                    color: active ? theme.text.primary : theme.text.secondary,
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {tab !== "attendance" && (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "8px", gridColumn: "1 / -1" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
                {LOCS.map((item) => {
                  const active = loc === item.code;
                  return (
                    <button
                      key={item.code}
                      className="health-pill-btn"
                      onClick={() => setLoc(item.code)}
                      style={{
                        border: `1px solid ${active ? theme.fill.primary : theme.border.default}`,
                        cursor: "pointer",
                        padding: "5px 12px",
                        borderRadius: `${theme.radius.full}px`,
                        fontSize: theme.font.caption.fontSize,
                        fontWeight: theme.weight.semibold,
                        background: active ? theme.fill.primary : theme.bg.base,
                        color: active ? theme.text.onPrimary : theme.text.secondary,
                      }}
                    >
                      {item.short}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: "flex", gap: "4px", background: theme.fill.secondary, padding: "4px", borderRadius: `${theme.radius.full}px`, alignItems: "center" }}>
                {HORIZONS.map((h) => {
                  const active = horizon === h.code;
                  return (
                    <button
                      key={h.code}
                      className="health-pill-btn"
                      onClick={() => setHorizon(h.code)}
                      style={{
                        border: "none",
                        cursor: "pointer",
                        padding: "5px 12px",
                        borderRadius: `${theme.radius.full}px`,
                        fontSize: theme.font.caption.fontSize,
                        fontWeight: active ? theme.weight.semibold : theme.weight.medium,
                        background: active ? theme.bg.base : "transparent",
                        color: active ? theme.text.primary : theme.text.secondary,
                      }}
                    >
                      {h.short}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {tab === "summary" && (
          <div key={`summary-${loc}-${horizon}`} className="health-tab-animate" style={{ display: "flex", flexDirection: "column", gap: isMobile ? "12px" : "14px" }}>
            {/* TOP ROW: 2 WIDE CARDS (ENGAGEMENT & 8 GOALS + WIDE WEEKEND ATTENDANCE) */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.12fr 0.88fr", gap: isMobile ? "12px" : "14px", alignItems: "stretch" }}>
              {/* BOX 1: ENGAGEMENT & ALL 8 GOALS (APPLE HIG ACTIVITY RINGS + BENTO GOAL TILES) */}
              <div style={{ background: theme.bg.base, border: `1px solid ${theme.border.subtle}`, borderRadius: `${theme.radius.xl}px`, padding: "18px", display: "flex", flexDirection: "column", gap: "12px", position: "relative", overflow: "hidden", minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                  <button
                    onClick={() => setTab("goals")}
                    style={{
                      border: "none",
                      background: "transparent",
                      padding: 0,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      color: theme.text.secondary,
                      fontSize: theme.font.body2.fontSize,
                      fontWeight: theme.weight.semibold,
                      fontFamily: theme.fontFamily,
                    }}
                  >
                    <span>Engagement & Goals</span>
                    <span style={{ fontSize: "11px", color: theme.text.accent }}>↗</span>
                  </button>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", zIndex: 3 }}>
                    <span style={{ padding: "2px 8px", borderRadius: `${theme.radius.full}px`, background: "rgba(48, 209, 88, 0.14)", color: "#30d158", fontSize: "11px", fontWeight: theme.weight.semibold, fontVariantNumeric: "tabular-nums" }}>
                      {GOALS.filter((g) => g.byHorizon[horizon][loc].tone === "success").length}/{GOALS.length} on track
                    </span>
                    <span style={{ fontSize: theme.font.caption.fontSize, color: theme.text.tertiary }}>{HORIZONS.find((h) => h.code === horizon)?.short}</span>
                    <button
                      onClick={() => setShowRingsInfo(!showRingsInfo)}
                      title="How Engagement Rings & Goals are measured"
                      style={{
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        padding: "2px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: showRingsInfo ? theme.text.primary : theme.text.tertiary,
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
                        <circle cx="8" cy="4.8" r="0.85" fill="currentColor" />
                        <path d="M8 7.2V11.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                </div>

                {showRingsInfo && (
                  <div
                    onClick={() => setShowRingsInfo(false)}
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: theme.bg.base,
                      backdropFilter: "blur(8px)",
                      padding: "18px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      zIndex: 2,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "24px" }}>
                      <span style={{ fontSize: "12px", fontWeight: theme.weight.semibold, color: theme.text.primary }}>
                        How Activity Rings & All 8 Goals Are Calculated
                      </span>
                      <div style={{ fontSize: "11.5px", lineHeight: "15.5px", color: theme.text.secondary, display: "flex", flexDirection: "column", gap: "5px" }}>
                        <div>
                          <strong style={{ color: ringStepsColor }}>● Completing Steps (5% Ring Goal):</strong> Unique Step 4 completions across the rolling 12-month window ÷ avg adult attendance.
                        </div>
                        <div>
                          <strong style={{ color: ringServeColor }}>● Adults Serving (30% Ring Goal):</strong> Unique volunteers checked in during the selected horizon ÷ avg adult attendance.
                        </div>
                        <div>
                          <strong style={{ color: ringGroupsColor }}>● Adults in Groups (50% Ring Goal):</strong> Unique active group members (excl. Youth) ÷ avg adult attendance.
                        </div>
                        <div>
                          <strong style={{ color: theme.text.primary }}>Other 5 Church Goals:</strong> Connection (75% unique adults connected across Steps/Serving/Groups), Attending Steps (1–2% monthly pace), Groups Available (7 groups per 100 adults), Students (10% of adults), and Action Kids (30% of adults).
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: "11px", color: theme.text.tertiary }}>Tap anywhere to close · Tap any goal tile for 5-location breakdown</span>
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: "stretch", gap: isMobile ? "10px" : "12px", flex: 1, minWidth: 0 }}>
                  {/* Left Apple Fitness Activity Rings Well */}
                  <div
                    onClick={() => setTab("goals")}
                    style={{
                      background: theme.bg.subtle,
                      border: `1px solid ${theme.border.default}`,
                      borderRadius: "12px",
                      padding: isMobile ? "10px 12px" : "10px 8px",
                      display: "flex",
                      flexDirection: isMobile ? "row" : "column",
                      alignItems: "center",
                      justifyContent: isMobile ? "space-between" : "center",
                      gap: "10px",
                      width: isMobile ? "auto" : "114px",
                      flexShrink: 0,
                      cursor: "pointer",
                    }}
                  >
                    <svg width={isMobile ? "68" : "92"} height={isMobile ? "68" : "92"} viewBox="0 0 136 136" style={{ flexShrink: 0 }}>
                      <g transform="rotate(-90 68 68)">
                        <circle cx="68" cy="68" r={r1} fill="none" stroke="rgba(10, 132, 255, 0.16)" strokeWidth="11" />
                        <circle cx="68" cy="68" r={r2} fill="none" stroke="rgba(48, 209, 88, 0.16)" strokeWidth="11" />
                        <circle cx="68" cy="68" r={r3} fill="none" stroke="rgba(87, 180, 162, 0.16)" strokeWidth="11" />
                        <circle
                          cx="68"
                          cy="68"
                          r={r1}
                          fill="none"
                          stroke={ringStepsColor}
                          strokeWidth="11"
                          strokeLinecap="round"
                          strokeDasharray={`${c1 * p1} ${c1}`}
                        />
                        <circle
                          cx="68"
                          cy="68"
                          r={r2}
                          fill="none"
                          stroke={ringServeColor}
                          strokeWidth="11"
                          strokeLinecap="round"
                          strokeDasharray={`${c2 * p2} ${c2}`}
                        />
                        <circle
                          cx="68"
                          cy="68"
                          r={r3}
                          fill="none"
                          stroke={ringGroupsColor}
                          strokeWidth="11"
                          strokeLinecap="round"
                          strokeDasharray={`${c3 * p3} ${c3}`}
                        />
                      </g>
                    </svg>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: isMobile ? "auto" : "100%", flex: isMobile ? 1 : undefined }}>
                      {[
                        { label: "Steps", pct: stepsGoal.pct, target: "5%", color: ringStepsColor },
                        { label: "Serving", pct: serveGoal.pct, target: "30%", color: ringServeColor },
                        { label: "Groups", pct: groupsGoal.pct, target: "50%", color: ringGroupsColor },
                      ].map((ring) => (
                        <div key={ring.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", fontSize: "10.5px", lineHeight: "13px", fontVariantNumeric: "tabular-nums" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: theme.text.secondary, fontWeight: 500 }}>
                            <span style={{ width: "6px", height: "6px", borderRadius: "999px", background: ring.color, flexShrink: 0 }} />
                            {ring.label}
                          </span>
                          <span style={{ fontWeight: 700, color: theme.text.primary }}>{ring.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right 2x4 Apple Health Bento Grid of All 8 Goals */}
                  <div style={{ flex: 1, minWidth: 0, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "7px" }}>
                    {GOALS.map((g) => {
                      const stat = g.byHorizon[horizon][loc];
                      const pctOfTarget = Math.min(100, Math.round((stat.pct / g.target) * 100));
                      const ringDotColor =
                        g.id === "steps_cmp"
                          ? ringStepsColor
                          : g.id === "serve"
                          ? ringServeColor
                          : g.id === "grp_part"
                          ? ringGroupsColor
                          : null;
                      const cleanCount = stat.count
                        .replace(" unique adults", " unique people")
                        .replace(/ unique$/, " unique people");
                      return (
                        <div
                          key={g.id}
                          onClick={() => {
                            setSelectedGoalId(g.id);
                            setTab("goals");
                          }}
                          style={{
                            background: theme.bg.subtle,
                            border: `1px solid ${theme.border.default}`,
                            borderRadius: "10px",
                            padding: "7px 9px",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            gap: "4px",
                            cursor: "pointer",
                            minWidth: 0,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "4px", minWidth: 0 }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11.5px", fontWeight: theme.weight.semibold, color: theme.text.primary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {ringDotColor && (
                                <span style={{ width: "6px", height: "6px", borderRadius: "999px", background: ringDotColor, flexShrink: 0 }} />
                              )}
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{g.title}</span>
                            </span>
                            <span style={{ fontSize: "12px", fontWeight: theme.weight.bold, color: toneColor(stat.tone), fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                              {stat.pct}%
                            </span>
                          </div>
                          <div style={{ width: "100%", height: "4px", borderRadius: "999px", background: theme.fill.secondary, overflow: "hidden" }}>
                            <div style={{ width: `${pctOfTarget}%`, height: "100%", borderRadius: "999px", background: toneColor(stat.tone) }} />
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "4px", fontVariantNumeric: "tabular-nums", minWidth: 0 }}>
                            <span style={{ fontSize: "10px", color: theme.text.secondary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {cleanCount}
                            </span>
                            <span style={{ fontSize: "9.5px", fontWeight: theme.weight.semibold, color: theme.text.tertiary, whiteSpace: "nowrap", flexShrink: 0 }}>
                              Goal {g.targetText}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* BOX 2: WIDE WEEKEND ATTENDANCE CARD */}
              <div
                onClick={() => setTab("attendance")}
                style={{
                  background: theme.bg.base,
                  border: `1px solid ${theme.border.subtle}`,
                  borderRadius: `${theme.radius.xl}px`,
                  padding: "18px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "10px",
                  position: "relative",
                  overflow: "hidden",
                  cursor: "pointer",
                  minWidth: 0,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: theme.font.body2.fontSize, fontWeight: theme.weight.semibold, color: theme.text.secondary }}>
                      Weekend Attendance
                    </span>
                    <span style={{ fontSize: "11px", color: theme.text.accent, fontWeight: theme.weight.medium }}>↗</span>
                    {liveSundayRow && (
                      <span
                        title={`Live sync via Planning Center Check-Ins (${liveSundayRow.sunday_label})`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "1px 6px",
                          borderRadius: "999px",
                          background: "rgba(48, 209, 88, 0.14)",
                          color: "#30d158",
                          fontSize: "10px",
                          fontWeight: 600,
                        }}
                      >
                        <span style={{ width: "5px", height: "5px", borderRadius: "999px", background: "#30d158" }} />
                        LIVE · {liveSundayRow.sunday_label}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", zIndex: 3 }}>
                    <span style={{ fontSize: theme.font.caption.fontSize, color: theme.text.tertiary }}>
                      {HORIZONS.find((h) => h.code === horizon)?.short}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowAttInfo(!showAttInfo);
                      }}
                      title="How attendance is calculated"
                      style={{
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        padding: "2px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: showAttInfo ? theme.text.primary : theme.text.tertiary,
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
                        <circle cx="8" cy="4.8" r="0.85" fill="currentColor" />
                        <path d="M8 7.2V11.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                </div>

                {showAttInfo && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAttInfo(false);
                    }}
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: theme.bg.base,
                      backdropFilter: "blur(8px)",
                      padding: "18px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      zIndex: 2,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "24px" }}>
                      <span style={{ fontSize: "12px", fontWeight: theme.weight.semibold, color: theme.text.primary }}>
                        How Attendance Is Calculated
                      </span>
                      <div style={{ fontSize: "11.5px", lineHeight: "16px", color: theme.text.secondary, display: "flex", flexDirection: "column", gap: "6px" }}>
                        <div>
                          <strong style={{ color: theme.text.primary }}>Source:</strong> Official 2026 Attendance Google Sheet (`2026 Action Church Dashboard`), excluding Easter overflow weekend (`Apr 5`) from multi-week averages.
                        </div>
                        <div>
                          <strong style={{ color: theme.text.primary }}>Total vs Breakdown:</strong> Hero number is combined weekend headcount (Adults + Action Kids + A-Team). Under A-Team, Sunday check-ins are shown alongside unique individuals who served across the selected window.
                        </div>
                        <div>
                          <strong style={{ color: theme.text.primary }}>YoY Comparison:</strong> Matched against the exact same weekend window in 2025.
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: "11px", color: theme.text.tertiary }}>Tap anywhere to close · Click card for full 13-week breakdown</span>
                  </div>
                )}

                {/* Hero Number + YoY & Salvations Pills */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                    <span style={{ fontSize: "30px", lineHeight: "34px", fontWeight: theme.weight.bold, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
                      {fmtNum(att.total)}
                    </span>
                    <span style={{ fontSize: "11.5px", color: theme.text.tertiary, fontWeight: theme.weight.medium }}>
                      {horizon === "weekly" ? "latest Sunday" : horizon === "monthly" ? "4-wk avg" : horizon === "quarterly" ? "13-wk avg" : horizon === "semiannual" ? "26-wk avg" : "52-wk avg"}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                    {att.yoyPct !== null ? (
                      <span
                        style={{
                          padding: "3px 8px",
                          borderRadius: `${theme.radius.full}px`,
                          background: att.yoyPct >= 0 ? toneBg("success") : toneBg("danger"),
                          color: att.yoyPct >= 0 ? toneColor("success") : toneColor("danger"),
                          fontSize: "11px",
                          fontWeight: theme.weight.semibold,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {att.yoyPct >= 0 ? `+${att.yoyPct}%` : `${att.yoyPct}%`} vs ’25
                      </span>
                    ) : (
                      <span style={{ padding: "3px 8px", borderRadius: `${theme.radius.full}px`, background: theme.fill.secondary, color: theme.text.secondary, fontSize: "11px", fontWeight: theme.weight.medium }}>
                        Launched 2026
                      </span>
                    )}
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        padding: "3px 9px",
                        borderRadius: `${theme.radius.full}px`,
                        background: "rgba(10, 132, 255, 0.14)",
                        color: "#4da3ff",
                        fontSize: "11px",
                        fontWeight: theme.weight.semibold,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      <span style={{ width: "5px", height: "5px", borderRadius: "999px", background: "#0a84ff" }} />
                      {fmtNum(att.salvationsSum)} Salvations
                    </span>
                  </div>
                </div>

                {/* 3-Column Apple Breakdown Strip: Adults / Action Kids / A-Team */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "8px", fontVariantNumeric: "tabular-nums" }}>
                  <div style={{ background: theme.bg.subtle, border: `1px solid ${theme.border.default}`, borderRadius: "10px", padding: "7px 10px", display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span style={{ fontSize: "10px", fontWeight: theme.weight.semibold, color: theme.text.tertiary, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Adults
                    </span>
                    <span style={{ fontSize: "15px", fontWeight: theme.weight.bold, color: theme.text.primary }}>
                      {fmtNum(att.adults)}
                    </span>
                    <span style={{ fontSize: "10px", color: theme.text.secondary }}>
                      {att.yoyAdultsPct !== null ? `${att.yoyAdultsPct >= 0 ? "+" : ""}${att.yoyAdultsPct}% vs ’25` : `${Math.round((att.adults / Math.max(1, att.total)) * 100)}% of total`}
                    </span>
                  </div>
                  <div style={{ background: theme.bg.subtle, border: `1px solid ${theme.border.default}`, borderRadius: "10px", padding: "7px 10px", display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span style={{ fontSize: "10px", fontWeight: theme.weight.semibold, color: theme.text.tertiary, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Action Kids
                    </span>
                    <span style={{ fontSize: "15px", fontWeight: theme.weight.bold, color: theme.text.primary }}>
                      {fmtNum(att.kids)}
                    </span>
                    <span style={{ fontSize: "10px", color: theme.text.secondary }}>
                      {Math.round((att.kids / Math.max(1, att.adults)) * 1000) / 10}% of adults
                    </span>
                  </div>
                  <div style={{ background: theme.bg.subtle, border: `1px solid ${theme.border.default}`, borderRadius: "10px", padding: "7px 10px", display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span style={{ fontSize: "10px", fontWeight: theme.weight.semibold, color: theme.text.tertiary, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      A-Team
                    </span>
                    <span style={{ fontSize: "15px", fontWeight: theme.weight.bold, color: theme.text.primary }}>
                      {fmtNum(att.team)}
                    </span>
                    <span style={{ fontSize: "10px", color: theme.text.secondary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {serveGoal.count.replace(/\s*unique.*$/, "")} unique people
                    </span>
                  </div>
                </div>

                {/* Wide 4-Week Sparkline / Trend Well */}
                <div style={{ background: theme.bg.subtle, border: `1px solid ${theme.border.default}`, borderRadius: "10px", padding: "8px 12px 7px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "4px", flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "10.5px", fontWeight: theme.weight.semibold, color: theme.text.tertiary, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Last 4 Sundays Trend
                    </span>
                    <span style={{ fontSize: "10.5px", color: theme.text.accent, fontWeight: theme.weight.medium }}>
                      Full 13-Wk & YoY ↗
                    </span>
                  </div>
                  {(() => {
                    const pts = att.trend4;
                    const min = Math.min(...pts) * 0.94;
                    const max = Math.max(...pts) * 1.03;
                    const xs = [26, 132, 238, 344];
                    const ys = pts.map((v) => 46 - ((v - min) / (max - min || 1)) * 26);
                    const path = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i].toFixed(1)}`).join(" ");
                    const area = `${path} L344,56 L26,56 Z`;
                    return (
                      <svg width="100%" height="58" viewBox="0 0 370 58" preserveAspectRatio="none" style={{ overflow: "visible" }}>
                        <defs>
                          <linearGradient id="attGradWide" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#0a84ff" stopOpacity="0.28" />
                            <stop offset="100%" stopColor="#0a84ff" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        <path d={area} fill="url(#attGradWide)" />
                        <path d={path} fill="none" stroke="#0a84ff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                        {xs.map((x, i) => (
                          <g key={i}>
                            <circle cx={x} cy={ys[i]} r={i === 3 ? 4 : 3} fill={i === 3 ? "#0a84ff" : theme.bg.subtle} stroke="#0a84ff" strokeWidth="2" />
                            <text x={x} y={Math.max(11, ys[i] - 6)} textAnchor="middle" fill={i === 3 ? theme.text.primary : theme.text.secondary} fontSize="10" fontWeight={i === 3 ? "700" : "600"}>
                              {fmtNum(pts[i])}
                            </text>
                          </g>
                        ))}
                      </svg>
                    );
                  })()}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", textAlign: "center", fontSize: "10px", color: theme.text.tertiary, fontVariantNumeric: "tabular-nums" }}>
                    {att.trend4Dates.map((d, i) => (
                      <span key={d} style={{ fontWeight: i === 3 ? 600 : 400, color: i === 3 ? theme.text.secondary : theme.text.tertiary }}>
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* BOTTOM ROW: 3 CARDS (A-TEAM HEALTH, SMALL GROUPS HEALTH, STAFF EFFECTIVENESS) */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: isMobile ? "12px" : "14px", alignItems: "stretch" }}>
              {/* BOX 4: A-TEAM HEALTH */}
              {(() => {
                const active30d = Math.max(0, sun.rosterTotal - sun.inactive30d);
                const activeRosterPct = sun.rosterTotal > 0 ? Math.round((active30d / sun.rosterTotal) * 100) : 0;
                return (
                  <div
                    onClick={() => { setTeamSection("joins"); setTab("care"); }}
                    style={{
                      background: theme.bg.base,
                      border: `1px solid ${theme.border.subtle}`,
                      borderRadius: `${theme.radius.xl}px`,
                      padding: "18px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "10px",
                      position: "relative",
                      overflow: "hidden",
                      minWidth: 0,
                      cursor: "pointer",
                    }}
                  >
                    {showAteamInfo && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowAteamInfo(false);
                        }}
                        style={{
                          position: "absolute",
                          inset: 0,
                          zIndex: 10,
                          background: theme.bg.base,
                          padding: "16px 18px",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "12px", fontWeight: 700, color: theme.text.primary }}>How A-Team Health Works</span>
                            <span style={{ fontSize: "11px", fontWeight: 600, color: theme.text.accent }}>Close ✕</span>
                          </div>
                          <div style={{ fontSize: "11.5px", color: theme.text.secondary, lineHeight: "16px", display: "flex", flexDirection: "column", gap: "5px" }}>
                            <div><strong>Active / Roster:</strong> Volunteers who served in the last 30 days out of total PCO team roster.</div>
                            <div><strong>Inactive 30 / 60 / 90d+:</strong> Rostered volunteers without a recent serve check-in.</div>
                            <div><strong>Confirmations:</strong> Confirmed vs. Unconfirmed / Declined requests + 2-week unconfirmed streak.</div>
                          </div>
                        </div>
                        <span style={{ fontSize: "10.5px", color: theme.text.tertiary }}>Click any row to open the filtered A-Team list</span>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: theme.font.body2.fontSize, fontWeight: theme.weight.semibold, color: theme.text.secondary }}>
                          A-Team Health
                        </span>
                        <span style={{ fontSize: theme.font.caption.fontSize, fontWeight: theme.weight.semibold, color: theme.text.accent }}>
                          ↗
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: theme.font.caption.fontSize, color: theme.text.tertiary }}>
                          {active30d}/{sun.rosterTotal} active ({activeRosterPct}%)
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowAteamInfo(true);
                          }}
                          title="How A-Team Health works"
                          style={{
                            border: "none",
                            background: "transparent",
                            color: theme.text.tertiary,
                            width: "16px",
                            height: "16px",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            padding: 0,
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="8" cy="8" r="6.25" />
                            <path d="M8 7.25V11" />
                            <circle cx="8" cy="5" r="0.5" fill="currentColor" stroke="none" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {[
                      {
                        label: "Active Roster (Served 30d)",
                        sub: `${active30d} of ${sun.rosterTotal} rostered`,
                        val: `${activeRosterPct}%`,
                        tone: (activeRosterPct >= 55 ? "success" : "warning") as "success" | "warning" | "danger",
                        sec: "inactive" as TeamHealthSection,
                      },
                      {
                        label: "New Joins",
                        sub: `${thJoinsLoc.unique} people · ${thJoinsLoc.teamsCount} teams`,
                        val: `+${thJoinsLoc.total}`,
                        tone: "success" as const,
                        sec: "joins" as TeamHealthSection,
                      },
                      {
                        label: "Inactive 30 / 60 / 90d+",
                        sub: `30d: ${thInactiveLoc.d30_59} · 60d: ${thInactiveLoc.d60_89} · 90d+: ${thInactiveLoc.d90_plus}`,
                        val: `${thInactiveLoc.d30_59 + thInactiveLoc.d60_89 + thInactiveLoc.d90_plus}`,
                        tone: "warning" as const,
                        sec: "inactive" as TeamHealthSection,
                      },
                      {
                        label: "Confirmations",
                        sub: `${thConfLoc.c} C · ${thConfLoc.u} U · ${thU2RowLoc.total} 2-wk U`,
                        val: `${thConfLoc.confRate}%`,
                        tone: (thConfLoc.confRate >= 78 ? "success" : thConfLoc.confRate >= 68 ? "warning" : "danger") as "success" | "warning" | "danger",
                        sec: "confirmations" as TeamHealthSection,
                      },
                    ].map((row, idx) => (
                      <div
                        key={row.label}
                        onClick={(e) => {
                          e.stopPropagation();
                          setTeamSection(row.sec);
                          setTab("care");
                        }}
                        style={{
                          cursor: "pointer",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          paddingTop: idx === 0 ? "2px" : "8px",
                          borderTop: idx === 0 ? "none" : `1px solid ${theme.border.subtle}`,
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                          <span style={{ fontSize: "12.5px", fontWeight: theme.weight.medium }}>{row.label}</span>
                          <span style={{ fontSize: "11px", color: theme.text.tertiary }}>
                            {row.sub}
                          </span>
                        </div>
                        <span
                          style={{
                            padding: "3px 9px",
                            borderRadius: `${theme.radius.full}px`,
                            background: toneBg(row.tone),
                            color: toneColor(row.tone),
                            fontSize: "12px",
                            fontWeight: theme.weight.semibold,
                            flexShrink: 0,
                          }}
                        >
                          {row.val}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* BOX 5: SMALL GROUPS HEALTH */}
              {(() => {
                const sg = SG_SUMMARY[loc];
                const adultDenom = Math.max(1, att.adults);
                const locGrpPct = ((sg.inGroupAtLoc / adultDenom) * 100).toFixed(1);
                const homeGrpPct = ((sg.callingLocHome / adultDenom) * 100).toFixed(1);
                return (
                  <div
                    onClick={() => setTab("groups")}
                    style={{
                      background: theme.bg.base,
                      border: `1px solid ${theme.border.subtle}`,
                      borderRadius: `${theme.radius.xl}px`,
                      padding: "18px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "10px",
                      position: "relative",
                      overflow: "hidden",
                      minWidth: 0,
                      cursor: "pointer",
                    }}
                  >
                    {showGroupsInfo && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowGroupsInfo(false);
                        }}
                        style={{
                          position: "absolute",
                          inset: 0,
                          zIndex: 10,
                          background: theme.bg.base,
                          padding: "16px 18px",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "12px", fontWeight: 700, color: theme.text.primary }}>How Small Groups Health Works</span>
                            <span style={{ fontSize: "11px", fontWeight: 600, color: theme.text.accent }}>Close ✕</span>
                          </div>
                          <div style={{ fontSize: "11.5px", color: theme.text.secondary, lineHeight: "16px", display: "flex", flexDirection: "column", gap: "5px" }}>
                            <div><strong>In {loc === "ALL" ? "Church" : loc} Groups:</strong> {fmtNum(sg.inGroupAtLoc)} people ({locGrpPct}% of adults) in {sg.openGroups}/{sg.totalGroups} open groups.</div>
                            <div><strong>Call {loc === "ALL" ? "Us" : loc} Home:</strong> {fmtNum(sg.callingLocHome)} people ({homeGrpPct}% of adults) in any group church-wide.</div>
                            <div><strong>Attendance Sample:</strong> {sg.repSampleMembers} members in {sg.reportingGroups}/{sg.totalGroups} groups logging Fall 2026 attendance.</div>
                          </div>
                        </div>
                        <span style={{ fontSize: "10.5px", color: theme.text.tertiary }}>Click any row to open the filtered Small Groups care queue</span>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: theme.font.body2.fontSize, fontWeight: theme.weight.semibold, color: theme.text.secondary }}>Small Groups Health</span>
                        <span style={{ fontSize: theme.font.caption.fontSize, fontWeight: theme.weight.semibold, color: theme.text.accent }}>↗</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: theme.font.caption.fontSize, color: theme.text.tertiary }}>
                          {sg.openGroups}/{sg.totalGroups} open
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowGroupsInfo(true);
                          }}
                          title="How Small Groups Health is calculated"
                          style={{
                            border: "none",
                            background: "transparent",
                            color: theme.text.tertiary,
                            width: "16px",
                            height: "16px",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            padding: 0,
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="8" cy="8" r="6.25" />
                            <path d="M8 7.25V11" />
                            <circle cx="8" cy="5" r="0.5" fill="currentColor" stroke="none" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {[
                      { label: "Attended 1+ Gatherings", sub: `${sg.reportingGroups}/${sg.totalGroups} groups logging (${sg.reportingRatePct}%)`, val: `${sg.attended1Plus} (${sg.attended1PlusPct}%)`, tone: "success" as const, filter: "core" as SgCareFilter },
                      { label: "Consistent (>50% Attended)", sub: "Attended over half of logged meetings", val: `${sg.attendGt50} (${sg.attendGt50Pct}%)`, tone: "success" as const, filter: "core" as SgCareFilter },
                      { label: "Joined · Never Attended (0x)", sub: "Active roster with 0 Fall check-ins", val: `${sg.neverAttended} (${sg.neverAttendedPct}%)`, tone: "danger" as const, filter: "never" as SgCareFilter },
                      { label: "Early Semester Drop-Offs", sub: "Attended Aug/Sep, 0 check-ins in Oct", val: `${sg.dropOff} (${sg.dropOffPct}%)`, tone: "warning" as const, filter: "dropoff" as SgCareFilter },
                    ].map((row, idx) => (
                      <div
                        key={row.label}
                        onClick={(e) => { e.stopPropagation(); setSgCareFilter(row.filter); setSgQueueMode("members"); setTab("groups"); }}
                        style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: idx === 0 ? "2px" : "8px", borderTop: idx === 0 ? "none" : `1px solid ${theme.border.subtle}` }}
                      >
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontSize: "12.5px", fontWeight: theme.weight.medium }}>{row.label}</span>
                          <span style={{ fontSize: "11px", color: theme.text.tertiary }}>{row.sub}</span>
                        </div>
                        <span style={{ padding: "3px 9px", borderRadius: `${theme.radius.full}px`, background: toneBg(row.tone), color: toneColor(row.tone), fontSize: "12px", fontWeight: theme.weight.semibold }}>
                          {row.val}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* BOX 6: STAFF EFFECTIVENESS & EFFICIENCY */}
              {(() => {
                const se = STAFF_EFFECTIVENESS_BY_LOC[loc];
                const sg = SG_SUMMARY[loc];
                const activeRosterPct = sun.rosterTotal > 0 ? Math.round(((sun.rosterTotal - sun.inactive30d) / sun.rosterTotal) * 100) : 0;
                return (
                  <div
                    onClick={() => setTab("workflows")}
                    style={{
                      background: theme.bg.base,
                      border: `1px solid ${theme.border.subtle}`,
                      borderRadius: `${theme.radius.xl}px`,
                      padding: "18px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "10px",
                      position: "relative",
                      overflow: "hidden",
                      minWidth: 0,
                      cursor: "pointer",
                    }}
                  >
                    {showStaffInfo && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowStaffInfo(false);
                        }}
                        style={{
                          position: "absolute",
                          inset: 0,
                          zIndex: 10,
                          background: theme.bg.base,
                          padding: "16px 18px",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "12px", fontWeight: 700, color: theme.text.primary }}>Staff Effectiveness Scorecard</span>
                            <span style={{ fontSize: "11px", fontWeight: 600, color: theme.text.accent }}>Close ✕</span>
                          </div>
                          <div style={{ fontSize: "11.5px", color: theme.text.secondary, lineHeight: "16px", display: "flex", flexDirection: "column", gap: "5px" }}>
                            <div><strong>Location & Bucket Rollup:</strong> Tracks follow-up speed and database hygiene across 4 operational queues without calling out individual staff names on the shared view.</div>
                            <div><strong>Direct Action Jump:</strong> Each queue opens its filtered person or group list for immediate leader outreach.</div>
                          </div>
                        </div>
                        <span style={{ fontSize: "10.5px", color: theme.text.tertiary }}>Click any row to jump directly to its action queue</span>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: theme.font.body2.fontSize, fontWeight: theme.weight.semibold, color: theme.text.secondary }}>Staff Effectiveness</span>
                        <span style={{ fontSize: theme.font.caption.fontSize, fontWeight: theme.weight.semibold, color: theme.text.accent }}>↗</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: theme.font.caption.fontSize, color: theme.text.tertiary }}>
                          {activeRosterPct}% active roster · {sg.reportingRatePct}% SG logged
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowStaffInfo(true);
                          }}
                          title="How Staff Effectiveness & Operational Hygiene is measured"
                          style={{
                            border: "none",
                            background: "transparent",
                            color: theme.text.tertiary,
                            width: "16px",
                            height: "16px",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            padding: 0,
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="8" cy="8" r="6.25" />
                            <path d="M8 7.25V11" />
                            <circle cx="8" cy="5" r="0.5" fill="currentColor" stroke="none" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {[
                      { label: "Workflow Follow-Up Backlog", sub: `${se.wfOverdue} overdue · ${se.wfStale14d} stale 14d+`, val: `${se.wfOverdue + se.wfStale14d} cards`, tone: (se.wfOverdue > 25 ? "danger" : "warning") as "success" | "warning" | "danger", onClick: () => { setStaffQueueFilter("overdue_wf"); setTab("workflows"); } },
                      { label: "Active Roster Cleanup (30d+)", sub: `${sun.inactive30d} of ${sun.rosterTotal} inactive 30+ days`, val: `${sun.inactive30d} people`, tone: "danger" as const, onClick: () => { setTeamSection("inactive"); setTab("care"); } },
                      { label: "Unconfirmed 2+ Weeks", sub: "Needs leader check-in call or SMS", val: `${sun.repeatUnconfPeople} people`, tone: (sun.repeatUnconfPeople > 5 ? "danger" : "warning") as "success" | "warning" | "danger", onClick: () => { setTeamSection("confirmations"); setTab("care"); } },
                      { label: "Unreported Small Groups", sub: `${sg.unreportedGroups} of ${sg.totalGroups} groups missing logs`, val: `${sg.unreportedGroups} groups`, tone: (sg.unreportedGroups > 8 ? "warning" : "success") as "success" | "warning" | "danger", onClick: () => { setSgQueueMode("groups"); setSgGroupFilter("unreported"); setTab("groups"); } },
                    ].map((row, idx) => (
                      <div
                        key={row.label}
                        onClick={(e) => { e.stopPropagation(); row.onClick(); }}
                        style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: idx === 0 ? "2px" : "8px", borderTop: idx === 0 ? "none" : `1px solid ${theme.border.subtle}` }}
                      >
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontSize: "12.5px", fontWeight: theme.weight.medium }}>{row.label}</span>
                          <span style={{ fontSize: "11px", color: theme.text.tertiary }}>{row.sub}</span>
                        </div>
                        <span style={{ padding: "3px 9px", borderRadius: `${theme.radius.full}px`, background: toneBg(row.tone), color: toneColor(row.tone), fontSize: "12px", fontWeight: theme.weight.semibold }}>
                          {row.val}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {tab === "attendance" && (
          <div
            key={`attendance-${loc}-${horizon}`}
            className="health-tab-animate"
            style={{
              background: theme.bg.base,
              border: `1px solid ${theme.border.subtle}`,
              borderRadius: `${theme.radius.xl}px`,
              padding: isMobile ? "14px 12px" : "24px 26px",
              display: "flex",
              flexDirection: "column",
              gap: isMobile ? "14px" : "22px",
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: theme.font.heading1.fontSize, lineHeight: theme.font.heading1.lineHeight, fontWeight: theme.weight.semibold }}>
                    {loc === "ALL" ? "All Locations" : LOCS.find((l) => l.code === loc)?.name}
                  </span>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {([
                    { code: "ALL" as LocCode, label: "All" },
                    { code: "WP" as LocCode, label: "WP" },
                    { code: "OV" as LocCode, label: "OV" },
                    { code: "SF" as LocCode, label: "SF" },
                    { code: "WS" as LocCode, label: "WS" },
                    { code: "HW" as LocCode, label: "HW" },
                  ]).map((btn) => {
                    const active = loc === btn.code;
                    return (
                      <button
                        key={btn.code}
                        onClick={() => setLoc(btn.code)}
                        style={{
                          cursor: "pointer",
                          padding: isMobile ? "6px 11px" : "7px 16px",
                          borderRadius: `${theme.radius.md}px`,
                          border: `1.5px solid ${active ? theme.text.primary : theme.border.default}`,
                          background: active ? theme.fill.primary : theme.bg.base,
                          color: active ? theme.text.onPrimary : theme.text.primary,
                          fontSize: isMobile ? "12.5px" : theme.font.body2.fontSize,
                          fontWeight: theme.weight.semibold,
                        }}
                      >
                        {btn.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
                <SourceStamp source={sundayLive} />
                <button
                  onClick={handleManualRefresh}
                  title="Refresh live Sunday attendance from Supabase"
                  style={{
                    border: `1px solid ${theme.border.default}`,
                    background: isRefreshing ? theme.fill.primary : theme.bg.subtle,
                    color: isRefreshing ? theme.text.onPrimary : theme.text.primary,
                    cursor: "pointer",
                    padding: "5px 12px",
                    borderRadius: `${theme.radius.full}px`,
                    fontSize: theme.font.caption.fontSize,
                    fontWeight: theme.weight.semibold,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  <span>↻</span>
                  <span>{isRefreshing ? "Syncing..." : "Refresh"}</span>
                </button>
                <a href={ATTENDANCE_DATA.sheet2026Url} target="_blank" rel="noopener noreferrer" style={chipStyle}>
                  2026 Sheet ↗
                </a>
                <a href={ATTENDANCE_DATA.sheet2025Url} target="_blank" rel="noopener noreferrer" style={chipStyle}>
                  2025 Sheet ↗
                </a>
                <button
                  onClick={() => setTab("summary")}
                  style={{
                    border: `1px solid ${theme.border.default}`,
                    background: theme.bg.subtle,
                    color: theme.text.primary,
                    cursor: "pointer",
                    padding: "5px 12px",
                    borderRadius: `${theme.radius.full}px`,
                    fontSize: theme.font.caption.fontSize,
                    fontWeight: theme.weight.semibold,
                  }}
                >
                  ← Back to Summary
                </button>
              </div>
            </div>

            {loc === "ALL" ? (
              <div style={{ display: "flex", flexDirection: "column", overflowX: isMobile ? "auto" : undefined }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1.12fr 0.85fr 0.8fr 1.18fr 0.95fr 0.85fr" : "1.1fr 1fr 1fr 1.1fr 1fr 1fr",
                    gap: isMobile ? "4px" : "8px",
                    padding: isMobile ? "6px 4px" : "5px 10px",
                    borderBottom: `1.5px solid ${theme.border.default}`,
                    fontSize: isMobile ? "11px" : theme.font.caption.fontSize,
                    fontWeight: theme.weight.semibold,
                    color: theme.text.secondary,
                    alignItems: "center",
                  }}
                >
                  <button
                    onClick={() => setShowAll13Weeks((v) => !v)}
                    style={{
                      border: "none",
                      background: "transparent",
                      padding: 0,
                      cursor: "pointer",
                      textAlign: "left",
                      fontSize: isMobile ? "11px" : theme.font.caption.fontSize,
                      fontWeight: theme.weight.semibold,
                      color: theme.text.accent,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {isMobile ? (showAll13Weeks ? "▾ 13 Wks" : "▸ 4 Wks") : (showAll13Weeks ? "▾ All 13 Wks (Show 4)" : "▸ Last 4 Wks (Show 13)")}
                  </button>
                  <span style={{ textAlign: "center" }}>Adults</span>
                  <span style={{ textAlign: "center" }}>Kids</span>
                  <span style={{ textAlign: "center" }} title="Attendance Sheet count / Unique people serving">A-Team</span>
                  <span style={{ textAlign: "center", color: theme.text.primary }}>Total</span>
                  <span style={{ textAlign: "center", color: theme.text.danger }}>{isMobile ? "Salv." : "Salvations"}</span>
                </div>

                {[...liveWeeklySeries]
                  .reverse()
                  .slice(0, showAll13Weeks ? 13 : 4)
                  .map((w, idx) => {
                    const seriesIdx = liveWeeklySeries.length - 1 - idx;
                    const isRowHovered = hoveredWeekIdx === seriesIdx;
                    const isCurrentSundayRow = currentSundayWindow.isSunday && w.date === currentSundayWindow.iso;
                    const c = w.locs[loc];
                    const shortDate = `${w.date.slice(5, 7).replace(/^0/, "")}/${w.date.slice(8, 10).replace(/^0/, "")}/26`;
                    const sundayUniqMap: Record<string, Record<LocCode, number>> = {
                  "2026-10-25": { ALL: 562, WP: 275, OV: 74, SF: 81, WS: 51, HW: 86 },
                  "2026-10-18": { ALL: 607, WP: 287, OV: 88, SF: 81, WS: 55, HW: 100 },
                  "2026-10-11": { ALL: 621, WP: 321, OV: 88, SF: 81, WS: 53, HW: 81 },
                  "2026-10-04": { ALL: 598, WP: 288, OV: 82, SF: 84, WS: 59, HW: 92 },
                  "2026-09-27": { ALL: 570, WP: 285, OV: 55, SF: 89, WS: 53, HW: 93 },
                  "2026-09-20": { ALL: 552, WP: 300, OV: 34, SF: 85, WS: 57, HW: 83 },
                  "2026-09-13": { ALL: 675, WP: 317, OV: 102, SF: 94, WS: 60, HW: 109 },
                  "2026-09-06": { ALL: 515, WP: 260, OV: 97, SF: 79, WS: 57, HW: 29 },
                  "2026-08-30": { ALL: 571, WP: 313, OV: 98, SF: 90, WS: 66, HW: 19 },
                  "2026-08-23": { ALL: 603, WP: 328, OV: 98, SF: 95, WS: 65, HW: 23 },
                  "2026-08-16": { ALL: 556, WP: 311, OV: 91, SF: 85, WS: 65, HW: 15 },
                  "2026-08-09": { ALL: 559, WP: 307, OV: 94, SF: 95, WS: 63, HW: 3 },
                  "2026-08-02": { ALL: 525, WP: 287, OV: 86, SF: 87, WS: 69, HW: 1 },
                  "2026-07-26": { ALL: 519, WP: 289, OV: 79, SF: 89, WS: 67, HW: 0 },
                  "2026-07-19": { ALL: 510, WP: 271, OV: 93, SF: 91, WS: 60, HW: 0 },
                };
                    const uniqVal = sundayUniqMap[w.date]?.[loc] ?? c.team;
                    return (
                      <div
                        key={w.date}
                        onMouseEnter={() => setHoveredWeekIdx(seriesIdx)}
                        onMouseLeave={() => setHoveredWeekIdx(null)}
                        style={{
                          cursor: "pointer",
                          display: "grid",
                          gridTemplateColumns: isMobile ? "1.12fr 0.85fr 0.8fr 1.18fr 0.95fr 0.85fr" : "1.1fr 1fr 1fr 1.1fr 1fr 1fr",
                          gap: isMobile ? "4px" : "8px",
                          padding: isMobile ? "6px 4px" : "5px 10px",
                          background: isCurrentSundayRow
                            ? theme.fill.secondary
                            : isRowHovered
                            ? theme.bg.subtle
                            : "transparent",
                          borderBottom: `1px solid ${theme.border.subtle}`,
                          fontSize: isMobile ? "12px" : theme.font.body2.fontSize,
                          lineHeight: "18px",
                          fontVariantNumeric: "tabular-nums",
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            fontWeight: isRowHovered || isCurrentSundayRow || idx === 0 ? theme.weight.semibold : theme.weight.medium,
                            color: isRowHovered ? theme.text.accent : theme.text.primary,
                          }}
                        >
                          {shortDate}
                        </span>
                        <span style={{ textAlign: "center", color: theme.text.secondary }}>{fmtNum(c.adults)}</span>
                        <span style={{ textAlign: "center", color: theme.text.secondary }}>{fmtNum(c.kids)}</span>
                        <span style={{ textAlign: "center", color: theme.text.secondary, whiteSpace: "nowrap" }} title={`${fmtNum(c.team)} logged on Attendance Sheet / ${fmtNum(uniqVal)} unique people`}>
                          {fmtNum(c.team)} <span style={{ color: theme.text.tertiary }}>/ {fmtNum(uniqVal)}{isMobile ? "u" : " unique people"}</span>
                        </span>
                        <span style={{ textAlign: "center", fontWeight: theme.weight.semibold, color: theme.text.primary }}>{fmtNum(c.total)}</span>
                        <span style={{ textAlign: "center", fontWeight: theme.weight.semibold, color: theme.text.danger }}>{fmtNum(c.salvations)}</span>
                      </div>
                    );
                  })}

                {([
                  { code: "monthly" as HorizonCode, label: "4-WEEK AVG", shortLabel: "4-WK AVG", wks: 4, st: liveHorizons.monthly[loc], uniq: GOALS[1].byHorizon.monthly[loc].count.replace(/\s*unique.*$/, ""), isFirst: true },
                  { code: "quarterly" as HorizonCode, label: "13-WEEK AVG", shortLabel: "13-WK AVG", wks: 13, st: liveHorizons.quarterly[loc], uniq: GOALS[1].byHorizon.quarterly[loc].count.replace(/\s*unique.*$/, ""), isFirst: false },
                  { code: "semiannual" as HorizonCode, label: "26-WEEK AVG (6-MO)", shortLabel: "6-MO AVG", wks: 26, st: liveHorizons.semiannual[loc], uniq: GOALS[1].byHorizon.semiannual[loc].count.replace(/\s*unique.*$/, ""), isFirst: false },
                  { code: "annual" as HorizonCode, label: "52-WEEK AVG (1-YR)", shortLabel: "1-YR AVG", wks: 52, st: liveHorizons.annual[loc], uniq: GOALS[1].byHorizon.annual[loc].count.replace(/\s*unique.*$/, ""), isFirst: false },
                ]).map((avgRow) => {
                  const activeH = horizon === avgRow.code;
                  const avgSalv = Math.round(avgRow.st.salvationsSum / (avgRow.st.activeWeeks || avgRow.wks));
                  return (
                    <div
                      key={avgRow.code}
                      onClick={() => {
                        setHorizon(avgRow.code);
                        if (avgRow.code === "quarterly" && !showAll13Weeks) setShowAll13Weeks(true);
                        if (avgRow.code === "monthly" && showAll13Weeks) setShowAll13Weeks(false);
                      }}
                      style={{
                        cursor: "pointer",
                        display: "grid",
                        gridTemplateColumns: isMobile ? "1.12fr 0.85fr 0.8fr 1.18fr 0.95fr 0.85fr" : "1.1fr 1fr 1fr 1.1fr 1fr 1fr",
                        gap: isMobile ? "4px" : "8px",
                        padding: isMobile ? (avgRow.isFirst ? "8px 4px 6px" : "6px 4px 8px") : (avgRow.isFirst ? "9px 10px 7px" : "7px 10px 9px"),
                        background: theme.bg.subtle,
                        borderTop: avgRow.isFirst ? `2px solid ${theme.border.default}` : undefined,
                        borderBottom: `1px solid ${theme.border.default}`,
                        borderLeft: activeH ? `3px solid ${theme.fill.primary}` : `3px solid transparent`,
                        fontSize: isMobile ? "11px" : theme.font.caption.fontSize,
                        lineHeight: "18px",
                        fontVariantNumeric: "tabular-nums",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          fontWeight: theme.weight.semibold,
                          letterSpacing: "0.04em",
                          color: activeH ? theme.text.accent : theme.text.primary,
                        }}
                      >
                        {isMobile ? avgRow.shortLabel : avgRow.label}
                      </span>
                      <span style={{ textAlign: "center", fontWeight: theme.weight.semibold, color: theme.text.primary }}>{fmtNum(avgRow.st.adults)}</span>
                      <span style={{ textAlign: "center", fontWeight: theme.weight.semibold, color: theme.text.primary }}>{fmtNum(avgRow.st.kids)}</span>
                      <span style={{ textAlign: "center", fontWeight: theme.weight.semibold, color: theme.text.primary, whiteSpace: "nowrap" }} title={`${fmtNum(avgRow.st.team)} avg logged on Attendance Sheet / ${avgRow.uniq} unique people`}>
                        {fmtNum(avgRow.st.team)} <span style={{ color: theme.text.secondary, fontWeight: theme.weight.medium }}>/ {avgRow.uniq}{isMobile ? "u" : " unique people"}</span>
                      </span>
                      <span style={{ textAlign: "center", fontWeight: theme.weight.semibold, color: theme.text.primary }}>{fmtNum(avgRow.st.total)}</span>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: "13px" }}>
                        <span style={{ fontWeight: theme.weight.semibold, color: theme.text.danger }}>{fmtNum(avgSalv)}</span>
                        <span style={{ fontSize: "9.5px", fontWeight: theme.weight.medium, color: theme.text.tertiary }}>{fmtNum(avgRow.st.salvationsSum)} tot</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (() => {
              const locCode = loc as Exclude<LocCode, "ALL">;
              const baseSheet = LOC_SHEET_DATA[locCode];
              const liveLocSheetRaw = effectiveSundayRow?.services_json?.[locCode];
              const liveLocSum = effectiveSundayRow?.locs_json?.[locCode];
              const liveLocSheet = (() => {
                if (!liveLocSheetRaw) return undefined;
                const copy: LiveSundayLocSheet = {
                  ...liveLocSheetRaw,
                  a: [...(liveLocSheetRaw.a || [])],
                  k: [...(liveLocSheetRaw.k || [])],
                  t: [...(liveLocSheetRaw.t || [])],
                };
                if (liveLocSum) {
                  const aSum = copy.a.reduce((s, v) => s + v, 0);
                  if (liveLocSum.adults > aSum && copy.a.length > 0) {
                    const zeroIdx = copy.a.findIndex((v) => v === 0);
                    const targetIdx = zeroIdx >= 0 ? zeroIdx : copy.a.length - 1;
                    copy.a[targetIdx] = (copy.a[targetIdx] || 0) + (liveLocSum.adults - aSum);
                  }
                  const kSum = copy.k.reduce((s, v) => s + v, 0);
                  if (liveLocSum.kids > kSum && copy.k.length > 0) {
                    const zeroIdx = copy.k.findIndex((v) => v === 0);
                    const targetIdx = zeroIdx >= 0 ? zeroIdx : copy.k.length - 1;
                    copy.k[targetIdx] = (copy.k[targetIdx] || 0) + (liveLocSum.kids - kSum);
                  }
                  copy.kt = liveLocSum.kids;
                  copy.tt = liveLocSum.team;
                  copy.tot = liveLocSum.total;
                  copy.salv = liveLocSum.salvations;
                }
                return copy;
              })();
              const mergedRows = (() => {
                const rows = baseSheet.rows.map((r) => ({ ...r }));
                if (liveLocSheet && Array.isArray(liveLocSheet.a) && liveLocSheet.a.length > 0 && (liveLocSheet.tot > 0 || effectiveSundayRow?.is_live)) {
                  const idx = rows.findIndex((r) => r.d === liveLocSheet.d);
                  if (idx >= 0) {
                    rows[idx] = { ...rows[idx], ...liveLocSheet };
                  } else {
                    rows.shift();
                    rows.push({ ...liveLocSheet });
                  }
                }
                return rows;
              })();
              const completedRows = mergedRows.filter((r) => r.tot > 0);
              const calcAvg = (slice: typeof mergedRows, baseAvg: typeof baseSheet.avg4) => {
                const n = slice.length || 1;
                const sc = baseAvg.a.length;
                const salvSum = slice.reduce((s, r) => s + r.salv, 0);
                const stSum = slice.reduce((s, r) => s + r.st, 0);
                const bpSum = slice.reduce((s, r) => s + r.bp, 0);
                return {
                  salv: Math.round(salvSum / n),
                  salvSum,
                  tot: Math.round(slice.reduce((s, r) => s + r.tot, 0) / n),
                  a: Array.from({ length: sc }, (_, i) => Math.round(slice.reduce((s, r) => s + (r.a[i] || 0), 0) / n)),
                  k: Array.from({ length: sc }, (_, i) => Math.round(slice.reduce((s, r) => s + (r.k[i] || 0), 0) / n)),
                  kt: Math.round(slice.reduce((s, r) => s + r.kt, 0) / n),
                  t: [0, 1, 2].map((i) => Math.round(slice.reduce((s, r) => s + (r.t[i] || 0), 0) / n)),
                  tt: Math.round(slice.reduce((s, r) => s + r.tt, 0) / n),
                  st: Math.round(stSum / n),
                  stSum,
                  bp: Math.round(bpSum / n),
                  bpSum,
                };
              };
              const sheet = {
                rows: mergedRows,
                avg4: liveLocSheet && liveLocSheet.tot > 0 ? calcAvg(completedRows.slice(-4), baseSheet.avg4) : baseSheet.avg4,
                avg13: liveLocSheet && liveLocSheet.tot > 0 ? calcAvg(completedRows, baseSheet.avg13) : baseSheet.avg13,
                avg26: baseSheet.avg26,
                avg52: baseSheet.avg52,
              };
              const svcCount = sheet.avg4.a.length;
              const ord = ["1st", "2nd", "3rd", "4th"];
              const thCell = {
                padding: isMobile ? "5px 7px" : "6px 10px",
                textAlign: "center" as const,
                fontWeight: theme.weight.semibold,
                color: theme.text.secondary,
                borderBottom: `1.5px solid ${theme.border.default}`,
                background: theme.bg.subtle,
                whiteSpace: "nowrap" as const,
              };
              const groupTh = {
                padding: "5px 10px 3px",
                textAlign: "center" as const,
                fontSize: "10.5px",
                fontWeight: theme.weight.semibold,
                textTransform: "uppercase" as const,
                letterSpacing: "0.05em",
                color: theme.text.tertiary,
                background: theme.bg.subtle,
                borderBottom: `1px solid ${theme.border.subtle}`,
                whiteSpace: "nowrap" as const,
              };
              const tdNum = {
                padding: isMobile ? "5px 7px" : "6px 10px",
                textAlign: "center" as const,
                borderBottom: `1px solid ${theme.border.subtle}`,
                whiteSpace: "nowrap" as const,
              };
              const spacerGroupTh = {
                width: "10px",
                minWidth: "10px",
                maxWidth: "10px",
                padding: 0,
                background: theme.bg.base,
                borderBottom: "none",
                borderLeft: `1px solid ${theme.border.subtle}`,
                borderRight: `1px solid ${theme.border.subtle}`,
              };
              const spacerSubTh = {
                width: "10px",
                minWidth: "10px",
                maxWidth: "10px",
                padding: 0,
                background: theme.bg.base,
                borderBottom: "none",
                borderLeft: `1px solid ${theme.border.subtle}`,
                borderRight: `1px solid ${theme.border.subtle}`,
              };
              return (
                <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", border: `1px solid ${theme.border.default}`, borderRadius: `${theme.radius.lg}px`, background: theme.bg.base }}>
                  <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: theme.font.body2.fontSize, fontVariantNumeric: "tabular-nums" }}>
                    <thead>
                      <tr>
                        <th
                          style={{
                            background: theme.bg.subtle,
                            padding: isMobile ? "5px 8px 3px" : "5px 12px 3px",
                            textAlign: "left",
                            borderBottom: `1px solid ${theme.border.subtle}`,
                            borderRight: `2px solid ${theme.border.default}`,
                            position: isMobile ? "sticky" : undefined,
                            left: isMobile ? 0 : undefined,
                            zIndex: isMobile ? 3 : undefined,
                          }}
                        >
                          <span style={{ fontSize: "10.5px", fontWeight: theme.weight.semibold, textTransform: "uppercase", letterSpacing: "0.05em", color: theme.text.tertiary }}>
                            Sunday
                          </span>
                        </th>
                        <th colSpan={2} style={groupTh}>Weekend Totals</th>
                        {Array.from({ length: svcCount }).map((_, i) => (
                          <React.Fragment key={`sg-${i}`}>
                            <th style={spacerGroupTh} />
                            <th colSpan={2} style={groupTh}>
                              {ord[i]} Service
                            </th>
                          </React.Fragment>
                        ))}
                        <th style={spacerGroupTh} />
                        <th colSpan={2} style={groupTh}>Totals</th>
                        <th style={spacerGroupTh} />
                        <th colSpan={4} style={groupTh}>A-Team</th>
                        <th style={spacerGroupTh} />
                        <th colSpan={2} style={groupTh}>Next Steps</th>
                      </tr>
                      <tr style={{ fontSize: theme.font.caption.fontSize }}>
                        <th
                          style={{
                            background: theme.bg.subtle,
                            padding: isMobile ? "5px 8px" : "6px 12px",
                            textAlign: "left",
                            borderBottom: `1.5px solid ${theme.border.default}`,
                            borderRight: `2px solid ${theme.border.default}`,
                            whiteSpace: "nowrap",
                            position: isMobile ? "sticky" : undefined,
                            left: isMobile ? 0 : undefined,
                            zIndex: isMobile ? 3 : undefined,
                          }}
                        >
                          <button
                            onClick={() => setShowAll13Weeks((v) => !v)}
                            style={{
                              border: "none",
                              background: "transparent",
                              padding: 0,
                              cursor: "pointer",
                              fontSize: theme.font.caption.fontSize,
                              fontWeight: theme.weight.semibold,
                              color: theme.text.accent,
                            }}
                          >
                            {isMobile ? (showAll13Weeks ? "▾ Date (4)" : "▸ Date (13)") : (showAll13Weeks ? "▾ Date (Show 4)" : "▸ Date (Show 13)")}
                          </button>
                        </th>
                        <th style={{ ...thCell, borderLeft: `1px solid ${theme.border.subtle}`, color: theme.text.danger }}>Salvations</th>
                        <th style={{ ...thCell, color: theme.text.primary }}>Wkd Total</th>
                        {Array.from({ length: svcCount }).map((_, i) => (
                          <React.Fragment key={`sh-${i}`}>
                            <th style={spacerSubTh} />
                            <th style={thCell}>Adults</th>
                            <th style={thCell}>Kids</th>
                          </React.Fragment>
                        ))}
                        <th style={spacerSubTh} />
                        <th style={{ ...thCell, color: theme.text.primary }}>Adults Total</th>
                        <th style={{ ...thCell, color: theme.text.primary }}>Kids Total</th>
                        <th style={spacerSubTh} />
                        <th style={thCell}>Experience</th>
                        <th style={thCell}>Guest Svcs</th>
                        <th style={thCell}>Action Kids</th>
                        <th style={{ ...thCell, color: theme.text.primary }}>Total</th>
                        <th style={spacerSubTh} />
                        <th style={thCell}>Action Steps</th>
                        <th style={thCell}>Baptisms</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...sheet.rows]
                        .reverse()
                        .slice(0, showAll13Weeks ? 13 : 4)
                        .map((r, idx) => {
                          const seriesIdx = sheet.rows.length - 1 - idx;
                          const isHov = hoveredWeekIdx === seriesIdx;
                          const w = liveWeeklySeries[seriesIdx];
                          const isCurrentSundayRow = currentSundayWindow.isSunday && w.date === currentSundayWindow.iso;
                          const shortDate = `${w.date.slice(5, 7).replace(/^0/, "")}/${w.date.slice(8, 10).replace(/^0/, "")}/26`;
                          const solidBg = isHov ? theme.bg.subtle : theme.bg.base;
                          const cellBg = isCurrentSundayRow ? theme.fill.secondary : undefined;
                          const tdRow = cellBg ? { ...tdNum, background: cellBg } : tdNum;
                          const spacerTd = {
                            width: "10px",
                            minWidth: "10px",
                            maxWidth: "10px",
                            padding: 0,
                            background: theme.bg.base,
                            borderBottom: "none",
                            borderLeft: `1px solid ${theme.border.subtle}`,
                            borderRight: `1px solid ${theme.border.subtle}`,
                          };
                          const rowAdultsTot = w?.locs?.[loc]?.adults ?? r.a.reduce((s, v) => s + v, 0);
                          return (
                            <tr
                              key={r.d}
                              onMouseEnter={() => setHoveredWeekIdx(seriesIdx)}
                              onMouseLeave={() => setHoveredWeekIdx(null)}
                              style={{ cursor: "pointer", background: solidBg }}
                            >
                              <td
                                style={{
                                  background: solidBg,
                                  backgroundImage: isCurrentSundayRow ? `linear-gradient(${theme.fill.secondary}, ${theme.fill.secondary})` : undefined,
                                  padding: isMobile ? "5px 8px" : "6px 12px",
                                  fontWeight: isHov || isCurrentSundayRow || idx === 0 ? theme.weight.semibold : theme.weight.medium,
                                  color: isHov ? theme.text.accent : theme.text.primary,
                                  borderBottom: `1px solid ${theme.border.subtle}`,
                                  borderRight: `2px solid ${theme.border.default}`,
                                  whiteSpace: "nowrap",
                                  position: isMobile ? "sticky" : undefined,
                                  left: isMobile ? 0 : undefined,
                                  zIndex: isMobile ? 2 : undefined,
                                }}
                              >
                                {shortDate}
                              </td>
                              <td style={{ ...tdRow, borderLeft: `1px solid ${theme.border.subtle}`, fontWeight: theme.weight.semibold, color: theme.text.danger }}>
                                {fmtNum(w.locs[loc].salvations)}
                              </td>
                              <td style={{ ...tdRow, fontWeight: theme.weight.semibold, color: theme.text.primary }}>
                                {fmtNum(w.locs[loc].total)}
                              </td>
                              {r.a.map((v: number, i: number) => (
                                <React.Fragment key={`sk-${i}`}>
                                  <td style={spacerTd} />
                                  <td style={{ ...tdRow, color: theme.text.secondary }}>
                                    {fmtNum(v)}
                                  </td>
                                  <td style={{ ...tdRow, color: theme.text.secondary }}>
                                    {fmtNum(r.k[i])}
                                  </td>
                                </React.Fragment>
                              ))}
                              <td style={spacerTd} />
                              <td style={{ ...tdRow, fontWeight: theme.weight.semibold, color: theme.text.primary }}>{fmtNum(rowAdultsTot)}</td>
                              <td style={{ ...tdRow, fontWeight: theme.weight.semibold, color: theme.text.primary }}>{fmtNum(r.kt)}</td>
                              <td style={spacerTd} />
                              {r.t.map((v: number, i: number) => (
                                <td key={`t-${i}`} style={{ ...tdRow, color: theme.text.secondary }}>
                                  {fmtNum(v)}
                                </td>
                              ))}
                              <td style={{ ...tdRow, fontWeight: theme.weight.semibold, color: theme.text.primary, whiteSpace: "nowrap" }} title="Attendance Sheet count / Unique people serving">
                                {fmtNum(r.tt)} <span style={{ color: theme.text.tertiary, fontWeight: theme.weight.medium }}>/ {fmtNum(({
                                  "2026-10-25": { ALL: 735, WP: 342, OV: 105, SF: 119, WS: 71, HW: 105 },
                                  "2026-10-18": { ALL: 771, WP: 362, OV: 114, SF: 113, WS: 75, HW: 114 },
                                  "2026-10-11": { ALL: 802, WP: 388, OV: 118, SF: 121, WS: 81, HW: 104 },
                                  "2026-10-04": { ALL: 771, WP: 355, OV: 113, SF: 113, WS: 81, HW: 120 },
                                  "2026-09-27": { ALL: 733, WP: 327, OV: 104, SF: 123, WS: 78, HW: 109 },
                                  "2026-09-20": { ALL: 705, WP: 330, OV: 91, SF: 109, WS: 84, HW: 100 },
                                  "2026-09-13": { ALL: 727, WP: 317, OV: 102, SF: 126, WS: 60, HW: 131 },
                                  "2026-09-06": { ALL: 669, WP: 295, OV: 112, SF: 108, WS: 80, HW: 85 },
                                  "2026-08-30": { ALL: 678, WP: 313, OV: 98, SF: 130, WS: 66, HW: 88 },
                                  "2026-08-23": { ALL: 698, WP: 328, OV: 98, SF: 131, WS: 65, HW: 82 },
                                  "2026-08-16": { ALL: 710, WP: 342, OV: 108, SF: 117, WS: 71, HW: 85 },
                                  "2026-08-09": { ALL: 644, WP: 307, OV: 94, SF: 127, WS: 63, HW: 56 },
                                  "2026-08-02": { ALL: 591, WP: 287, OV: 86, SF: 119, WS: 69, HW: 35 },
                                  "2026-07-26": { ALL: 564, WP: 289, OV: 79, SF: 134, WS: 67, HW: 35 },
                                } as Record<string, Record<LocCode, number>>)[w.date]?.[loc] ?? r.tt)}{isMobile ? "u" : " unique people"}</span>
                              </td>
                              <td style={spacerTd} />
                              <td style={{ ...tdRow, color: r.st > 0 ? theme.text.primary : theme.text.tertiary, fontWeight: r.st > 0 ? theme.weight.semibold : theme.weight.regular }}>
                                {fmtNum(r.st)}
                              </td>
                              <td style={{ ...tdRow, color: r.bp > 0 ? theme.text.primary : theme.text.tertiary, fontWeight: r.bp > 0 ? theme.weight.semibold : theme.weight.regular }}>
                                {fmtNum(r.bp)}
                              </td>
                            </tr>
                          );
                        })}

                      {([
                        { code: "monthly" as HorizonCode, label: "4-WEEK AVG", shortLabel: "4-WK AVG", st: sheet.avg4, liveTot: liveHorizons.monthly[loc].total, liveAdults: liveHorizons.monthly[loc].adults, liveSalvSum: liveHorizons.monthly[loc].salvationsSum, wks: liveHorizons.monthly[loc].activeWeeks || 4, isFirst: true },
                        { code: "quarterly" as HorizonCode, label: "13-WEEK AVG", shortLabel: "13-WK AVG", st: sheet.avg13, liveTot: liveHorizons.quarterly[loc].total, liveAdults: liveHorizons.quarterly[loc].adults, liveSalvSum: liveHorizons.quarterly[loc].salvationsSum, wks: liveHorizons.quarterly[loc].activeWeeks || 13, isFirst: false },
                        { code: "semiannual" as HorizonCode, label: "26-WEEK AVG (6-MO)", shortLabel: "6-MO AVG", st: sheet.avg26, liveTot: liveHorizons.semiannual[loc].total, liveAdults: liveHorizons.semiannual[loc].adults, liveSalvSum: liveHorizons.semiannual[loc].salvationsSum, wks: liveHorizons.semiannual[loc].activeWeeks || 26, isFirst: false },
                        { code: "annual" as HorizonCode, label: "52-WEEK AVG (1-YR)", shortLabel: "1-YR AVG", st: sheet.avg52, liveTot: liveHorizons.annual[loc].total, liveAdults: liveHorizons.annual[loc].adults, liveSalvSum: liveHorizons.annual[loc].salvationsSum, wks: liveHorizons.annual[loc].activeWeeks || 52, isFirst: false },
                      ]).map((avg) => {
                        const activeH = horizon === avg.code;
                        const solidAvgBg = theme.bg.subtle;
                        const topBorder = avg.isFirst ? `2px solid ${theme.border.default}` : undefined;
                        const avgSalv = Math.round(avg.liveSalvSum / avg.wks);
                        const avgCell = {
                          padding: avg.isFirst ? "8px 10px 6px" : "6px 10px 8px",
                          textAlign: "center" as const,
                          borderTop: topBorder,
                          borderBottom: `1px solid ${theme.border.default}`,
                          background: solidAvgBg,
                          whiteSpace: "nowrap" as const,
                          verticalAlign: "middle" as const,
                        };
                        const spacerAvg = {
                          width: "10px",
                          minWidth: "10px",
                          maxWidth: "10px",
                          padding: 0,
                          borderTop: "none",
                          borderBottom: "none",
                          borderLeft: `1px solid ${theme.border.subtle}`,
                          borderRight: `1px solid ${theme.border.subtle}`,
                          background: theme.bg.base,
                        };
                        return (
                          <tr
                            key={avg.code}
                            onClick={() => {
                              setHorizon(avg.code);
                              if (avg.code === "quarterly" && !showAll13Weeks) setShowAll13Weeks(true);
                              if (avg.code === "monthly" && showAll13Weeks) setShowAll13Weeks(false);
                            }}
                            style={{ cursor: "pointer", background: solidAvgBg, fontSize: theme.font.caption.fontSize }}
                          >
                            <td
                              style={{
                                background: solidAvgBg,
                                padding: isMobile ? (avg.isFirst ? "7px 8px 5px" : "5px 8px 7px") : (avg.isFirst ? "8px 12px 6px" : "6px 12px 8px"),
                                fontWeight: theme.weight.semibold,
                                letterSpacing: "0.04em",
                                color: activeH ? theme.text.accent : theme.text.primary,
                                borderTop: topBorder,
                                borderBottom: `1px solid ${theme.border.default}`,
                                borderRight: `2px solid ${theme.border.default}`,
                                borderLeft: activeH ? `3px solid ${theme.fill.primary}` : `3px solid transparent`,
                                whiteSpace: "nowrap",
                                verticalAlign: "middle",
                                position: isMobile ? "sticky" : undefined,
                                left: isMobile ? 0 : undefined,
                                zIndex: isMobile ? 2 : undefined,
                              }}
                            >
                              {isMobile ? avg.shortLabel : avg.label}
                            </td>
                            <td style={{ ...avgCell, borderLeft: `1px solid ${theme.border.subtle}` }}>
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: "13px" }}>
                                <span style={{ fontWeight: theme.weight.semibold, color: theme.text.danger }}>{fmtNum(avgSalv)}</span>
                                <span style={{ fontSize: "9.5px", fontWeight: theme.weight.medium, color: theme.text.tertiary }}>{fmtNum(avg.liveSalvSum)} tot</span>
                              </div>
                            </td>
                            <td style={{ ...avgCell, fontWeight: theme.weight.semibold, color: theme.text.primary }}>
                              {fmtNum(avg.liveTot)}
                            </td>
                            {avg.st.a.map((v: number, i: number) => (
                              <React.Fragment key={`ska-${i}`}>
                                <td style={spacerAvg} />
                                <td style={{ ...avgCell, fontWeight: theme.weight.semibold, color: theme.text.primary }}>
                                  {fmtNum(v)}
                                </td>
                                <td style={{ ...avgCell, fontWeight: theme.weight.semibold, color: theme.text.primary }}>
                                  {fmtNum(avg.st.k[i])}
                                </td>
                              </React.Fragment>
                            ))}
                            <td style={spacerAvg} />
                            <td style={{ ...avgCell, fontWeight: theme.weight.semibold, color: theme.text.primary }}>{fmtNum(avg.liveAdults)}</td>
                            <td style={{ ...avgCell, fontWeight: theme.weight.semibold, color: theme.text.primary }}>{fmtNum(avg.st.kt)}</td>
                            <td style={spacerAvg} />
                            {avg.st.t.map((v: number, i: number) => (
                              <td key={`ta-${i}`} style={{ ...avgCell, fontWeight: theme.weight.semibold, color: theme.text.primary }}>
                                {fmtNum(v)}
                              </td>
                            ))}
                            <td style={{ ...avgCell, fontWeight: theme.weight.semibold, color: theme.text.primary, whiteSpace: "nowrap" }} title="Attendance Sheet avg / Unique people serving">
                              {fmtNum(avg.st.tt)} <span style={{ color: theme.text.secondary, fontWeight: theme.weight.medium }}>/ {GOALS[1].byHorizon[avg.code][loc].count.replace(/\s*unique.*$/, "")}{isMobile ? "u" : " unique people"}</span>
                            </td>
                            <td style={spacerAvg} />
                            <td style={avgCell}>
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: "13px" }}>
                                <span style={{ fontWeight: theme.weight.semibold, color: theme.text.primary }}>{fmtNum(avg.st.st)}</span>
                                <span style={{ fontSize: "9.5px", fontWeight: theme.weight.medium, color: theme.text.tertiary }}>{fmtNum(avg.st.stSum)} tot</span>
                              </div>
                            </td>
                            <td style={avgCell}>
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: "13px" }}>
                                <span style={{ fontWeight: theme.weight.semibold, color: theme.text.primary }}>{fmtNum(avg.st.bp)}</span>
                                <span style={{ fontSize: "9.5px", fontWeight: theme.weight.medium, color: theme.text.tertiary }}>{fmtNum(avg.st.bpSum)} tot</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", paddingTop: "4px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
                <div style={{ display: "flex", gap: "8px" }}>
                  {([
                    { id: "yoy" as const, label: "YOY" },
                    { id: "qavg" as const, label: "YOY Quarterly Avg" },
                  ]).map((m) => {
                    const active = yoyChartMode === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => setYoyChartMode(m.id)}
                        style={{
                          cursor: "pointer",
                          padding: "7px 16px",
                          borderRadius: `${theme.radius.md}px`,
                          border: `1.5px solid ${active ? theme.text.primary : theme.border.default}`,
                          background: active ? theme.fill.primary : theme.bg.base,
                          color: active ? theme.text.onPrimary : theme.text.primary,
                          fontSize: theme.font.body2.fontSize,
                          fontWeight: theme.weight.semibold,
                        }}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: theme.font.caption.fontSize }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: theme.weight.semibold, color: theme.dataviz.categorical[0] }}>
                    <span style={{ width: "18px", height: "2.5px", background: theme.dataviz.categorical[0], display: "inline-block" }} />
                    2026 ({yoyChartMode === "yoy" ? "Weekly Total" : "Rolling 13-Wk Avg"})
                  </span>
                  {!att.launched2026 ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: theme.weight.semibold, color: theme.text.tertiary }}>
                      <span style={{ width: "18px", borderTop: `2px dashed ${theme.text.tertiary}`, display: "inline-block" }} />
                      2025 ({yoyChartMode === "yoy" ? "Same Week" : "Rolling 13-Wk Avg"})
                    </span>
                  ) : (
                    <span style={{ color: theme.text.tertiary }}>
                      Launched {att.launched2026} (No 2025 line)
                    </span>
                  )}
                </div>
              </div>

              <div
                style={{
                  border: `1.5px solid ${theme.border.default}`,
                  borderRadius: `${theme.radius.lg}px`,
                  padding: isMobile ? "12px 10px 10px" : "16px 20px 14px",
                  background: theme.bg.subtle,
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                {(() => {
                  const series = liveWeeklySeries;
                  const qData = Q_AVG_YOY[loc];
                  const vals26 = yoyChartMode === "yoy" ? series.map((w) => w.locs[loc].total) : qData.q26;
                  const vals25 =
                    yoyChartMode === "yoy"
                      ? series.map((w) => w.locs[loc].total2025)
                      : qData.q25
                      ? qData.q25.map((v) => v as number | null)
                      : series.map(() => null);
                  const valid25 = vals25.filter((v): v is number => v !== null && v > 0);
                  const allVals = [...vals26, ...valid25];
                  const minV = Math.min(...allVals) * 0.91;
                  const maxV = Math.max(...allVals) * 1.08 || 1;
                  const W = 860, H = 225, padL = 34, padR = 34, padT = 36, padB = 34;
                  const xFor = (i: number) => Math.round(padL + (i / (series.length - 1)) * (W - padL - padR));
                  const yFor = (v: number) => Math.round(padT + (1 - (v - minV) / (maxV - minV || 1)) * (H - padT - padB));
                  const p26 = vals26.map((v, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(v)}`).join(" ");
                  const area26 = `${p26} L ${xFor(series.length - 1)} ${H - padB} L ${xFor(0)} ${H - padB} Z`;
                  const has25 = valid25.length > 0;
                  let seen25 = false;
                  const p25 = has25
                    ? vals25
                        .map((v, i) => {
                          if (v === null || v <= 0) return "";
                          const cmd = !seen25 ? "M" : "L";
                          seen25 = true;
                          return `${cmd} ${xFor(i)} ${yFor(v)}`;
                        })
                        .filter(Boolean)
                        .join(" ")
                    : "";
                  const labelIndices = [0, series.length - 1];
                  const activeIdx = hoveredWeekIdx !== null ? hoveredWeekIdx : series.length - 1;
                  const activeW = series[activeIdx];
                  const activeShortDt = `${activeW.date.slice(5, 7).replace(/^0/, "")}/${activeW.date.slice(8, 10).replace(/^0/, "")}/26`;
                  const active26 = vals26[activeIdx];
                  const active25 = vals25[activeIdx];
                  const activeDiff = active25 && active25 > 0 ? active26 - active25 : null;
                  const activePct = active25 && active25 > 0 ? Math.round(((active26 - active25) / active25) * 1000) / 10 : null;
                  const stepW = (W - padL - padR) / (series.length - 1);

                  return (
                    <>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "12px",
                          padding: "8px 12px",
                          borderRadius: `${theme.radius.md}px`,
                          background: theme.bg.base,
                          border: `1px solid ${hoveredWeekIdx !== null ? theme.border.default : theme.border.subtle}`,
                          fontSize: theme.font.caption.fontSize,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                          <span style={{ fontWeight: theme.weight.semibold, fontSize: theme.font.body2.fontSize, color: theme.text.primary }}>
                            Sunday {activeShortDt} ({activeW.label})
                          </span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: theme.dataviz.categorical[0], display: "inline-block" }} />
                            <span style={{ color: theme.text.secondary }}>2026 {yoyChartMode === "yoy" ? "Total" : "13-Wk Avg"}:</span>
                            <strong style={{ color: theme.text.primary, fontSize: theme.font.body2.fontSize }}>{fmtNum(active26)}</strong>
                          </span>
                          {has25 && active25 !== null && (
                            <>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: theme.text.tertiary, display: "inline-block" }} />
                                <span style={{ color: theme.text.secondary }}>2025:</span>
                                <strong style={{ color: theme.text.secondary, fontSize: theme.font.body2.fontSize }}>{fmtNum(active25)}</strong>
                              </span>
                              {activeDiff !== null && activePct !== null && (
                                <span
                                  style={{
                                    padding: "2px 8px",
                                    borderRadius: `${theme.radius.full}px`,
                                    background: activeDiff >= 0 ? theme.fill.successSubtle : theme.fill.warningSubtle,
                                    color: activeDiff >= 0 ? theme.text.success : theme.text.warning,
                                    fontWeight: theme.weight.semibold,
                                  }}
                                >
                                  {activeDiff >= 0 ? `+${fmtNum(activeDiff)}` : fmtNum(activeDiff)} ({activePct >= 0 ? `+${activePct}%` : `${activePct}%`})
                                </span>
                              )}
                            </>
                          )}
                        </div>
                        <span style={{ color: theme.text.tertiary }}>
                          {yoyChartMode === "yoy"
                            ? `${fmtNum(activeW.locs[loc].adults)} adults · ${fmtNum(activeW.locs[loc].kids)} kids · ${fmtNum(activeW.locs[loc].team)} A-Team · ${fmtNum(activeW.locs[loc].salvations)} salvations`
                            : "Hover across chart to scrub week-by-week"}
                        </span>
                      </div>

                      <svg
                        width="100%"
                        height={isMobile ? "180" : "225"}
                        viewBox={`0 0 ${W} ${H}`}
                        onMouseLeave={() => setHoveredWeekIdx(null)}
                        style={{ cursor: "crosshair", userSelect: "none", overflow: "visible" }}
                      >
                        {series.map((w, i) => {
                          const x = xFor(i);
                          const isEnd = i === 0 || i === series.length - 1;
                          return (
                            <g key={`grid-${w.date}`}>
                              <line
                                x1={x}
                                y1={padT - 8}
                                x2={x}
                                y2={H - padB}
                                stroke={theme.border.default}
                                strokeWidth={isEnd ? "1.2" : "1"}
                                opacity={isEnd ? 0.55 : 0.32}
                              />
                              <line
                                x1={x}
                                y1={H - padB}
                                x2={x}
                                y2={H - padB + 5}
                                stroke={theme.text.tertiary}
                                strokeWidth="1.2"
                                opacity={0.6}
                              />
                            </g>
                          );
                        })}
                        <line
                          x1={padL}
                          y1={H - padB}
                          x2={W - padR}
                          y2={H - padB}
                          stroke={theme.border.default}
                          strokeWidth="1.2"
                          opacity={0.6}
                        />
                        <path d={area26} fill={`${theme.dataviz.categorical[0]}${theme.dataviz.areaAlpha}`} />
                        {has25 && (
                          <path d={p25} fill="none" stroke={theme.text.tertiary} strokeWidth="2.2" strokeDasharray="6 6" />
                        )}
                        {has25 &&
                          vals25.map((v, i) => {
                            const isHov = hoveredWeekIdx === i;
                            return (
                              <circle
                                key={`25-${i}`}
                                cx={xFor(i)}
                                cy={yFor(v || 0)}
                                r={isHov ? 5.5 : 3}
                                fill={isHov ? theme.bg.base : theme.text.tertiary}
                                stroke={theme.text.tertiary}
                                strokeWidth={isHov ? 2.5 : 0}
                              />
                            );
                          })}
                        <path d={p26} fill="none" stroke={theme.dataviz.categorical[0]} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />

                        {hoveredWeekIdx !== null && (
                          <line
                            x1={xFor(hoveredWeekIdx)}
                            y1={padT - 12}
                            x2={xFor(hoveredWeekIdx)}
                            y2={H - padB}
                            stroke={theme.text.primary}
                            strokeWidth="1.5"
                            strokeDasharray="3 3"
                            opacity={0.75}
                          />
                        )}

                        {vals26.map((v, i) => {
                          const x = xFor(i);
                          const y = yFor(v);
                          const isHov = hoveredWeekIdx === i;
                          const isEnd = labelIndices.includes(i);
                          const hideEndBecauseNearHover =
                            hoveredWeekIdx !== null &&
                            hoveredWeekIdx !== i &&
                            Math.abs(hoveredWeekIdx - i) <= 1;
                          const showBottomDate = isHov || (isEnd && !hideEndBecauseNearHover);
                          const shortDt = `${series[i].date.slice(5, 7).replace(/^0/, "")}/${series[i].date.slice(8, 10).replace(/^0/, "")}/26`;
                          return (
                            <g key={series[i].date}>
                              <circle
                                cx={x}
                                cy={y}
                                r={isHov ? 6 : i === series.length - 1 ? 4.5 : 3.2}
                                fill={isHov ? theme.bg.base : theme.dataviz.categorical[0]}
                                stroke={theme.dataviz.categorical[0]}
                                strokeWidth={isHov ? 3 : 0}
                              />
                              {hoveredWeekIdx === null && isEnd && (
                                <text x={x} y={y - 10} textAnchor="middle" fontSize="11" fontWeight="600" fill={theme.text.primary}>
                                  {fmtNum(v)}
                                </text>
                              )}
                              {showBottomDate && (
                                <text
                                  x={x}
                                  y={H - 8}
                                  textAnchor="middle"
                                  fontSize="11"
                                  fontWeight={isHov ? "700" : "600"}
                                  fill={isHov ? theme.text.primary : theme.text.secondary}
                                >
                                  {shortDt}
                                </text>
                              )}
                            </g>
                          );
                        })}

                        {hoveredWeekIdx !== null && (() => {
                          const hx = xFor(hoveredWeekIdx);
                          const hy26 = yFor(vals26[hoveredWeekIdx]);
                          const hy25 = has25 && vals25[hoveredWeekIdx] ? yFor(vals25[hoveredWeekIdx] || 0) : hy26;
                          const topY = Math.min(hy26, hy25);
                          const boxW = has25 ? 168 : 116;
                          const boxH = has25 ? 44 : 28;
                          const boxX = Math.max(8, Math.min(W - boxW - 8, hx - boxW / 2));
                          const boxY = Math.max(2, topY - boxH - 12);
                          return (
                            <g style={{ pointerEvents: "none" }}>
                              <rect
                                x={boxX}
                                y={boxY}
                                width={boxW}
                                height={boxH}
                                rx={6}
                                fill={theme.bg.base}
                                stroke={theme.border.default}
                                strokeWidth="1.2"
                              />
                              <text x={boxX + 10} y={boxY + 17} fontSize="11.5" fontWeight="700" fill={theme.dataviz.categorical[0]}>
                                ’26: {fmtNum(vals26[hoveredWeekIdx])}
                              </text>
                              {has25 && vals25[hoveredWeekIdx] !== null && (
                                <>
                                  <text x={boxX + boxW - 10} y={boxY + 17} textAnchor="end" fontSize="11" fontWeight="600" fill={activeDiff && activeDiff >= 0 ? theme.text.success : theme.text.warning}>
                                    {activePct !== null ? (activePct >= 0 ? `+${activePct}%` : `${activePct}%`) : ""}
                                  </text>
                                  <text x={boxX + 10} y={boxY + 34} fontSize="11" fontWeight="600" fill={theme.text.secondary}>
                                    ’25: {fmtNum(vals25[hoveredWeekIdx] || 0)}
                                  </text>
                                  <text x={boxX + boxW - 10} y={boxY + 34} textAnchor="end" fontSize="10.5" fontWeight="500" fill={theme.text.tertiary}>
                                    {activeShortDt}
                                  </text>
                                </>
                              )}
                            </g>
                          );
                        })()}

                        {series.map((w, i) => {
                          const x = xFor(i);
                          return (
                            <rect
                              key={`hit-${w.date}`}
                              x={x - stepW / 2}
                              y={0}
                              width={stepW}
                              height={H}
                              fill="transparent"
                              onMouseEnter={() => setHoveredWeekIdx(i)}
                              onMouseMove={() => setHoveredWeekIdx(i)}
                              onClick={() => setHoveredWeekIdx(i)}
                            />
                          );
                        })}
                      </svg>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {tab === "goals" && (
          <div key={`goals-${loc}-${horizon}`} className="health-tab-animate" style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
            <div style={{ flex: "1 1 280px", background: theme.bg.base, border: `1px solid ${theme.border.subtle}`, borderRadius: `${theme.radius.xl}px`, padding: "14px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {GOALS.map((g) => {
                const active = g.id === activeGoal.id;
                const s = g.byHorizon[horizon][loc];
                return (
                  <div
                    key={g.id}
                    onClick={() => setSelectedGoalId(g.id)}
                    style={{ cursor: "pointer", padding: "12px 14px", borderRadius: `${theme.radius.lg}px`, background: active ? theme.fill.secondary : "transparent", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  >
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: theme.font.body2.fontSize, fontWeight: theme.weight.semibold }}>{g.title}</span>
                      <span style={{ fontSize: theme.font.caption.fontSize, color: theme.text.tertiary }}>Target {g.targetText}</span>
                    </div>
                    <span style={{ fontSize: theme.font.body1.fontSize, fontWeight: theme.weight.semibold, color: toneColor(s.tone) }}>{s.pct}%</span>
                  </div>
                );
              })}
            </div>
            <div style={{ flex: "2 1 420px", background: theme.bg.base, border: `1px solid ${theme.border.subtle}`, borderRadius: `${theme.radius.xl}px`, padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: theme.font.caption.fontSize, color: theme.text.tertiary, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    GOAL BENCHMARK · {activeGoal.targetText} · {HORIZONS.find((h) => h.code === horizon)?.label.toUpperCase()}
                  </span>
                  <span style={{ fontSize: theme.font.heading2.fontSize, fontWeight: theme.weight.semibold }}>{activeGoal.title}</span>
                  <span style={{ fontSize: theme.font.body2.fontSize, color: theme.text.secondary }}>{activeGoal.subtitle}</span>
                </div>
                <a href={activeGoal.pcoUrls[loc]} target="_blank" rel="noopener noreferrer" style={chipStyle}>
                  {activeGoal.pcoLabel}
                </a>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {LOCS.map((l) => {
                  const st = activeGoal.byHorizon[horizon][l.code];
                  const fillPct = Math.min(100, Math.round((st.pct / activeGoal.target) * 100));
                  return (
                    <div key={l.code} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: theme.font.body2.fontSize, fontWeight: l.code === loc ? theme.weight.semibold : theme.weight.medium }}>
                            {l.code === "ALL" ? "Church-Wide" : `${l.short} · ${l.name}`}
                          </span>
                          <a href={activeGoal.pcoUrls[l.code]} target="_blank" rel="noopener noreferrer" style={{ fontSize: theme.font.caption.fontSize, color: theme.text.accent, textDecoration: "none", fontWeight: theme.weight.semibold }}>
                            PCO ↗
                          </a>
                        </div>
                        <div style={{ display: "flex", gap: "10px", alignItems: "baseline" }}>
                          <span style={{ fontSize: theme.font.caption.fontSize, color: theme.text.tertiary }}>{st.count}</span>
                          <span style={{ fontSize: theme.font.body2.fontSize, fontWeight: theme.weight.semibold, color: toneColor(st.tone), minWidth: "48px", textAlign: "right" }}>{st.pct}%</span>
                        </div>
                      </div>
                      <div style={{ width: "100%", height: "8px", borderRadius: `${theme.radius.full}px`, background: theme.fill.secondary, overflow: "hidden" }}>
                        <div style={{ width: `${fillPct}%`, height: "100%", borderRadius: `${theme.radius.full}px`, background: toneBar(st.tone) }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {tab === "care" && (
<div key={`care-${loc}-${horizon}-${teamSection}`} className="health-tab-animate" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
<div style={{ background: theme.bg.base, border: `1px solid ${theme.border.subtle}`, borderRadius: `${theme.radius.xl}px`, padding: "18px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
<span style={{ fontSize: theme.font.body1.fontSize, fontWeight: theme.weight.semibold }}>
By Location ({HORIZONS.find((h) => h.code === horizon)?.label})
</span>
<span style={{ fontSize: theme.font.caption.fontSize, color: theme.text.tertiary }}>
Tap any location to filter
</span>
</div>
<div style={{ overflowX: "auto" }}>
<table style={{ width: "100%", borderCollapse: "collapse", fontSize: theme.font.label.fontSize }}>
<thead>
<tr style={{ borderBottom: `1px solid ${theme.border.subtle}`, textAlign: "left", color: theme.text.tertiary, fontSize: theme.font.caption.fontSize }}>
<th style={{ padding: "6px 8px" }}>LOCATION</th>
<th style={{ padding: "6px 8px" }}>NEW JOINS</th>
<th style={{ padding: "6px 8px" }}>INACTIVE (30 / 60 / 90D+)</th>
<th style={{ padding: "6px 8px" }}>CONFIRMED / U / D</th>
<th style={{ padding: "6px 8px", textAlign: "right" }}>2+ SUN U</th>
</tr>
</thead>
<tbody>
{TEAM_LOC_ORDER.map((lCode) => {
const jL = TEAM_HEALTH_DATA.joins[horizon].byLoc[lCode];
const inL = TEAM_HEALTH_DATA.inactive.summary[lCode];
const cfL = TEAM_HEALTH_DATA.conf[horizon][lCode];
const u2L = TEAM_HEALTH_DATA.u2row.summary[lCode];
const isSelected = loc === lCode;
return (
<tr
key={lCode}
onClick={() => setLoc(isSelected ? "ALL" : lCode)}
style={{ cursor: "pointer", borderBottom: `1px solid ${theme.border.subtle}`, background: isSelected ? theme.bg.subtle : "transparent" }}
>
<td style={{ padding: "10px 8px", fontWeight: theme.weight.semibold }}>
<span style={{ padding: "2px 7px", borderRadius: `${theme.radius.md}px`, background: isSelected ? theme.fill.primary : theme.fill.secondary, color: isSelected ? theme.text.onPrimary : theme.text.primary, marginRight: "8px", fontSize: theme.font.caption.fontSize }}>
{lCode}
</span>
{LOCS.find((x) => x.code === lCode)?.name}
</td>
<td style={{ padding: "10px 8px" }}>
<span style={{ fontWeight: theme.weight.semibold, color: theme.text.success }}>+{jL.total}</span>
<span style={{ color: theme.text.tertiary, fontSize: theme.font.caption.fontSize }}> ({jL.teamsCount} teams)</span>
</td>
<td style={{ padding: "10px 8px", color: theme.text.secondary }}>
<strong>{inL.d30_59}</strong> · <span style={{ color: theme.text.warning, fontWeight: theme.weight.semibold }}>{inL.d60_89}</span> · <span style={{ color: theme.text.danger, fontWeight: theme.weight.semibold }}>{inL.d90_plus}</span>
</td>
<td style={{ padding: "10px 8px" }}>
<span style={{ fontWeight: theme.weight.semibold, color: cfL.confRate >= 78 ? theme.text.success : cfL.confRate >= 68 ? theme.text.warning : theme.text.danger }}>{cfL.confRate}%</span>
<span style={{ color: theme.text.tertiary, fontSize: theme.font.caption.fontSize }}> ({cfL.c} / {cfL.u} / {cfL.d})</span>
</td>
<td style={{ padding: "10px 8px", textAlign: "right", fontWeight: theme.weight.semibold, color: theme.text.danger }}>
{u2L.total}
</td>
</tr>
);
})}
{(() => {
const jAll = TEAM_HEALTH_DATA.joins[horizon].byLoc.ALL;
const inAll = TEAM_HEALTH_DATA.inactive.summary.ALL;
const cfAll = TEAM_HEALTH_DATA.conf[horizon].ALL;
const u2All = TEAM_HEALTH_DATA.u2row.summary.ALL;
const isAllSelected = loc === "ALL";
return (
<tr
onClick={() => setLoc("ALL")}
style={{ cursor: "pointer", borderTop: `1.5px solid ${theme.border.default}`, background: isAllSelected ? theme.bg.subtle : theme.bg.subtle, fontWeight: theme.weight.semibold }}
>
<td style={{ padding: "10px 8px", fontWeight: theme.weight.bold }}>
<span style={{ padding: "2px 7px", borderRadius: `${theme.radius.md}px`, background: isAllSelected ? theme.fill.primary : theme.fill.secondary, color: isAllSelected ? theme.text.onPrimary : theme.text.primary, marginRight: "8px", fontSize: theme.font.caption.fontSize }}>
ALL
</span>
Total (All Locations)
</td>
<td style={{ padding: "10px 8px" }}>
<span style={{ fontWeight: theme.weight.bold, color: theme.text.success }}>+{jAll.total}</span>
<span style={{ color: theme.text.tertiary, fontSize: theme.font.caption.fontSize, fontWeight: theme.weight.regular }}> ({jAll.teamsCount} teams · {jAll.unique} unique)</span>
</td>
<td style={{ padding: "10px 8px", color: theme.text.secondary }}>
<strong>{inAll.d30_59}</strong> · <span style={{ color: theme.text.warning, fontWeight: theme.weight.bold }}>{inAll.d60_89}</span> · <span style={{ color: theme.text.danger, fontWeight: theme.weight.bold }}>{inAll.d90_plus}</span>
<span style={{ color: theme.text.tertiary, fontSize: theme.font.caption.fontSize, fontWeight: theme.weight.regular }}> ({inAll.d30_59 + inAll.d60_89 + inAll.d90_plus} total)</span>
</td>
<td style={{ padding: "10px 8px" }}>
<span style={{ fontWeight: theme.weight.bold, color: cfAll.confRate >= 78 ? theme.text.success : cfAll.confRate >= 68 ? theme.text.warning : theme.text.danger }}>{cfAll.confRate}%</span>
<span style={{ color: theme.text.tertiary, fontSize: theme.font.caption.fontSize, fontWeight: theme.weight.regular }}> ({cfAll.c} / {cfAll.u} / {cfAll.d})</span>
</td>
<td style={{ padding: "10px 8px", textAlign: "right", fontWeight: theme.weight.bold, color: theme.text.danger }}>
{u2All.total}
</td>
</tr>
);
})()}
</tbody>
</table>
</div>
</div>

<div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
<div style={{ display: "flex", gap: "4px", background: theme.fill.secondary, padding: "4px", borderRadius: `${theme.radius.full}px` }}>
{(
[
{ id: "joins", label: `New Joins (+${thJoinsLoc.total})` },
{ id: "inactive", label: `Inactive 30/60/90d+ (${thInactiveLoc.d30_59 + thInactiveLoc.d60_89 + thInactiveLoc.d90_plus})` },
{ id: "confirmations", label: `Confirmations (${thConfLoc.confRate}%)` },
] as Array<{ id: TeamHealthSection; label: string }>
).map((s) => {
const active = teamSection === s.id || (teamSection === "overview" && s.id === "joins") || (teamSection === "signals" && s.id === "confirmations");
return (
<button
key={s.id}
onClick={() => setTeamSection(s.id)}
style={{ border: "none", cursor: "pointer", padding: "6px 14px", borderRadius: `${theme.radius.full}px`, fontSize: theme.font.body2.fontSize, fontWeight: active ? theme.weight.semibold : theme.weight.medium, background: active ? theme.bg.base : "transparent", color: active ? theme.text.primary : theme.text.secondary }}
>
{s.label}
</button>
);
})}
</div>
<input
type="text"
value={search}
onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
placeholder="Filter team or person..."
style={{ border: `1px solid ${theme.border.default}`, borderRadius: `${theme.radius.full}px`, padding: "6px 14px", fontSize: theme.font.label.fontSize, background: theme.bg.base, color: theme.text.primary, outline: "none", minWidth: "200px" }}
/>
</div>

{(teamSection === "joins" || teamSection === "overview") && (
<div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(340px, 1fr))", gap: "14px", alignItems: "start" }}>
<div style={{ background: theme.bg.base, border: `1px solid ${theme.border.subtle}`, borderRadius: `${theme.radius.xl}px`, padding: "18px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
<span style={{ fontSize: theme.font.body1.fontSize, fontWeight: theme.weight.semibold }}>Joined by Team</span>
<span style={{ fontSize: theme.font.caption.fontSize, color: theme.text.tertiary }}>{thJoinsLoc.teamsCount} teams</span>
</div>
<table style={{ width: "100%", borderCollapse: "collapse", fontSize: theme.font.label.fontSize }}>
<thead>
<tr style={{ borderBottom: `1px solid ${theme.border.subtle}`, textAlign: "left", color: theme.text.tertiary, fontSize: theme.font.caption.fontSize }}>
<th style={{ padding: "6px" }}>TEAM</th>
<th style={{ padding: "6px", textAlign: "right" }}>JOINED</th>
</tr>
</thead>
<tbody>
{thJoinTeams.map((t, idx) => (
<tr key={`${t.loc}-${t.dept}-${t.team}-${idx}`} style={{ borderBottom: `1px solid ${theme.border.subtle}` }}>
<td style={{ padding: "8px 6px", fontWeight: theme.weight.medium }}>
<span style={{ color: theme.text.tertiary, fontSize: theme.font.caption.fontSize, marginRight: "6px" }}>{t.loc}</span>
{t.team}
</td>
<td style={{ padding: "8px 6px", textAlign: "right", fontWeight: theme.weight.semibold, color: theme.text.success }}>
+{t.count}
</td>
</tr>
))}
{(() => {
const isFiltered = deptFilter !== "ALL" || search.trim().length > 0;
const totCount = isFiltered ? thJoinTeams.reduce((s, t) => s + t.count, 0) : thJoinsLoc.total;
const totTeams = isFiltered ? thJoinTeams.length : thJoinsLoc.teamsCount;
const uniqSub = !isFiltered && thJoinsLoc.unique ? ` · ${thJoinsLoc.unique} unique` : "";
return (
<tr style={{ borderTop: `1.5px solid ${theme.border.default}`, background: theme.bg.subtle, fontWeight: theme.weight.bold }}>
<td style={{ padding: "10px 6px", fontWeight: theme.weight.bold }}>
Total <span style={{ color: theme.text.tertiary, fontSize: theme.font.caption.fontSize, fontWeight: theme.weight.regular }}>({totTeams} teams{uniqSub})</span>
</td>
<td style={{ padding: "10px 6px", textAlign: "right", fontWeight: theme.weight.bold, color: theme.text.success }}>
+{totCount}
</td>
</tr>
);
})()}
</tbody>
</table>
</div>

<div style={{ background: theme.bg.base, border: `1px solid ${theme.border.subtle}`, borderRadius: `${theme.radius.xl}px`, padding: "18px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
<span style={{ fontSize: theme.font.body1.fontSize, fontWeight: theme.weight.semibold }}>People Joined</span>
<span style={{ fontSize: theme.font.caption.fontSize, color: theme.text.tertiary }}>{thJoinMembers.length} shown</span>
</div>
<div style={{ display: "flex", flexDirection: "column" }}>
{thJoinMembers.slice(0, 25).map((m, i) => (
<div key={`${m.loc}-${m.id}-${m.team}-${i}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", padding: "8px 0", borderTop: i === 0 ? "none" : `1px solid ${theme.border.subtle}` }}>
<div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
<span style={{ fontSize: theme.font.body2.fontSize, fontWeight: theme.weight.medium }}>
<span style={{ color: theme.text.tertiary, fontSize: theme.font.caption.fontSize, marginRight: "6px" }}>{m.loc}</span>
{m.name}
</span>
<span style={{ fontSize: theme.font.caption.fontSize, color: theme.text.tertiary }}>{m.team} · {m.firstDate}</span>
</div>
<a href={`https://people.planningcenteronline.com/people/AC${m.id}`} target="_blank" rel="noopener noreferrer" style={chipStyle}>Profile ↗</a>
</div>
))}
</div>
</div>
</div>
)}

{teamSection === "inactive" && (
<div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(340px, 1fr))", gap: "14px", alignItems: "start" }}>
<div style={{ background: theme.bg.base, border: `1px solid ${theme.border.subtle}`, borderRadius: `${theme.radius.xl}px`, padding: "18px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
<span style={{ fontSize: theme.font.body1.fontSize, fontWeight: theme.weight.semibold }}>By Team</span>
<span style={{ fontSize: theme.font.caption.fontSize, color: theme.text.tertiary }}>{thInactiveLoc.rosterTotal} rostered · {thInactiveLoc.active30d} active (&lt;30d)</span>
</div>
<table style={{ width: "100%", borderCollapse: "collapse", fontSize: theme.font.label.fontSize }}>
<thead>
<tr style={{ borderBottom: `1px solid ${theme.border.subtle}`, textAlign: "left", color: theme.text.tertiary, fontSize: theme.font.caption.fontSize }}>
<th style={{ padding: "6px" }}>TEAM</th>
<th style={{ padding: "6px", textAlign: "right" }}>ROSTER</th>
<th style={{ padding: "6px", textAlign: "right" }}>ACT &lt;30D</th>
<th style={{ padding: "6px", textAlign: "right" }}>30D</th>
<th style={{ padding: "6px", textAlign: "right" }}>60D</th>
<th style={{ padding: "6px", textAlign: "right" }}>90D+</th>
</tr>
</thead>
<tbody>
{thInactiveTeams.map((t, idx) => (
<tr key={`${t.loc}-${t.dept}-${t.team}-${idx}`} style={{ borderBottom: `1px solid ${theme.border.subtle}` }}>
<td style={{ padding: "8px 6px", fontWeight: theme.weight.medium }}>
<span style={{ color: theme.text.tertiary, fontSize: theme.font.caption.fontSize, marginRight: "6px" }}>{t.loc}</span>
{t.team}
</td>
<td style={{ padding: "8px 6px", textAlign: "right", color: theme.text.secondary }}>{t.total}</td>
<td style={{ padding: "8px 6px", textAlign: "right", color: theme.text.success, fontWeight: theme.weight.medium }}>{t.active30d}</td>
<td style={{ padding: "8px 6px", textAlign: "right" }}>{t.d30_59}</td>
<td style={{ padding: "8px 6px", textAlign: "right", color: t.d60_89 > 0 ? theme.text.warning : theme.text.secondary, fontWeight: t.d60_89 > 0 ? theme.weight.semibold : theme.weight.regular }}>{t.d60_89}</td>
<td style={{ padding: "8px 6px", textAlign: "right", color: t.d90_plus > 0 ? theme.text.danger : theme.text.secondary, fontWeight: t.d90_plus > 0 ? theme.weight.semibold : theme.weight.regular }}>{t.d90_plus}</td>
</tr>
))}
{(() => {
const isFiltered = deptFilter !== "ALL" || search.trim().length > 0;
const totRoster = isFiltered ? thInactiveTeams.reduce((s, t) => s + t.total, 0) : thInactiveLoc.rosterTotal;
const totAct = isFiltered ? thInactiveTeams.reduce((s, t) => s + t.active30d, 0) : thInactiveLoc.active30d;
const tot30 = isFiltered ? thInactiveTeams.reduce((s, t) => s + t.d30_59, 0) : thInactiveLoc.d30_59;
const tot60 = isFiltered ? thInactiveTeams.reduce((s, t) => s + t.d60_89, 0) : thInactiveLoc.d60_89;
const tot90 = isFiltered ? thInactiveTeams.reduce((s, t) => s + t.d90_plus, 0) : thInactiveLoc.d90_plus;
const grandTot = tot30 + tot60 + tot90;
return (
<tr style={{ borderTop: `1.5px solid ${theme.border.default}`, background: theme.bg.subtle, fontWeight: theme.weight.bold }}>
<td style={{ padding: "10px 6px", fontWeight: theme.weight.bold }}>
Total <span style={{ color: theme.text.tertiary, fontSize: theme.font.caption.fontSize, fontWeight: theme.weight.regular }}>({grandTot} inactive{!isFiltered ? " unique" : ""})</span>
</td>
<td style={{ padding: "10px 6px", textAlign: "right", fontWeight: theme.weight.bold, color: theme.text.secondary }}>{totRoster}</td>
<td style={{ padding: "10px 6px", textAlign: "right", fontWeight: theme.weight.bold, color: theme.text.success }}>{totAct}</td>
<td style={{ padding: "10px 6px", textAlign: "right", fontWeight: theme.weight.bold, color: theme.text.primary }}>{tot30}</td>
<td style={{ padding: "10px 6px", textAlign: "right", fontWeight: theme.weight.bold, color: tot60 > 0 ? theme.text.warning : theme.text.secondary }}>{tot60}</td>
<td style={{ padding: "10px 6px", textAlign: "right", fontWeight: theme.weight.bold, color: tot90 > 0 ? theme.text.danger : theme.text.secondary }}>{tot90}</td>
</tr>
);
})()}
</tbody>
</table>
</div>

<div style={{ background: theme.bg.base, border: `1px solid ${theme.border.subtle}`, borderRadius: `${theme.radius.xl}px`, padding: "18px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
<div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
{(
[
{ id: "all", label: `All (${thInactiveLoc.d30_59 + thInactiveLoc.d60_89 + thInactiveLoc.d90_plus})` },
{ id: "30-59d", label: `30-59d (${thInactiveLoc.d30_59})` },
{ id: "60-89d", label: `60-89d (${thInactiveLoc.d60_89})` },
{ id: "90d+", label: `90d+ (${thInactiveLoc.d90_plus})` },
] as Array<{ id: InactiveBucketFilter; label: string }>
).map((b) => {
const active = inactiveBucket === b.id;
return (
<button
key={b.id}
onClick={() => setInactiveBucket(b.id)}
style={{ border: "none", cursor: "pointer", padding: "5px 12px", borderRadius: `${theme.radius.full}px`, fontSize: theme.font.caption.fontSize, fontWeight: theme.weight.semibold, background: active ? theme.fill.primary : theme.fill.secondary, color: active ? theme.text.onPrimary : theme.text.secondary }}
>
{b.label}
</button>
);
})}
</div>
<div style={{ display: "flex", flexDirection: "column" }}>
{thInactiveMembers.slice(0, 25).map((m, i) => (
<div key={`${m.loc}-${m.id}-${i}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", padding: "8px 0", borderTop: i === 0 ? "none" : `1px solid ${theme.border.subtle}` }}>
<div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
<span style={{ fontSize: theme.font.body2.fontSize, fontWeight: theme.weight.medium }}>
<span style={{ color: theme.text.tertiary, fontSize: theme.font.caption.fontSize, marginRight: "6px" }}>{m.loc}</span>
{m.name}
</span>
<span style={{ fontSize: theme.font.caption.fontSize, color: theme.text.tertiary }}>{m.teams} · Last: {m.lastServed}</span>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
<span style={{ fontSize: theme.font.caption.fontSize, fontWeight: theme.weight.semibold, color: m.bucket === "30-59d" ? theme.text.warning : theme.text.danger }}>{m.bucket}</span>
<a href={`https://people.planningcenteronline.com/people/AC${m.id}`} target="_blank" rel="noopener noreferrer" style={chipStyle}>Profile ↗</a>
</div>
</div>
))}
</div>
</div>
</div>
)}
{teamSection === "confirmations" && (
<div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(340px, 1fr))", gap: "14px", alignItems: "start" }}>
<div style={{ background: theme.bg.base, border: `1px solid ${theme.border.subtle}`, borderRadius: `${theme.radius.xl}px`, padding: "18px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
<span style={{ fontSize: theme.font.body1.fontSize, fontWeight: theme.weight.semibold }}>By Team</span>
<span style={{ fontSize: theme.font.caption.fontSize, color: theme.text.tertiary }}>{fmtNum(thConfLoc.c)} C · {fmtNum(thConfLoc.u)} U · {fmtNum(thConfLoc.d)} D</span>
</div>
<table style={{ width: "100%", borderCollapse: "collapse", fontSize: theme.font.label.fontSize }}>
<thead>
<tr style={{ borderBottom: `1px solid ${theme.border.subtle}`, textAlign: "left", color: theme.text.tertiary, fontSize: theme.font.caption.fontSize }}>
<th style={{ padding: "6px" }}>TEAM</th>
<th style={{ padding: "6px", textAlign: "right" }}>C / U / D</th>
<th style={{ padding: "6px", textAlign: "right" }}>RATE</th>
</tr>
</thead>
<tbody>
{thConfTeams.slice(0, 18).map((t, idx) => (
<tr key={`${t.loc}-${t.dept}-${t.team}-${idx}`} style={{ borderBottom: `1px solid ${theme.border.subtle}` }}>
<td style={{ padding: "8px 6px", fontWeight: theme.weight.medium }}>
<span style={{ color: theme.text.tertiary, fontSize: theme.font.caption.fontSize, marginRight: "6px" }}>{t.loc}</span>
{t.team}
</td>
<td style={{ padding: "8px 6px", textAlign: "right", color: theme.text.secondary, fontSize: theme.font.caption.fontSize }}>
{t.c} / {t.u} / {t.d}
</td>
<td style={{ padding: "8px 6px", textAlign: "right", fontWeight: theme.weight.semibold, color: t.confRate >= 78 ? theme.text.success : t.confRate >= 68 ? theme.text.warning : theme.text.danger }}>
{t.confRate}%
</td>
</tr>
))}
{(() => {
const isFiltered = deptFilter !== "ALL" || search.trim().length > 0;
const totC = isFiltered ? thConfTeams.reduce((s, t) => s + t.c, 0) : thConfLoc.c;
const totU = isFiltered ? thConfTeams.reduce((s, t) => s + t.u, 0) : thConfLoc.u;
const totD = isFiltered ? thConfTeams.reduce((s, t) => s + t.d, 0) : thConfLoc.d;
const totRate = isFiltered ? (totC + totU > 0 ? Math.round((totC / (totC + totU)) * 1000) / 10 : 0) : thConfLoc.confRate;
return (
<tr style={{ borderTop: `1.5px solid ${theme.border.default}`, background: theme.bg.subtle, fontWeight: theme.weight.bold }}>
<td style={{ padding: "10px 6px", fontWeight: theme.weight.bold }}>
Total <span style={{ color: theme.text.tertiary, fontSize: theme.font.caption.fontSize, fontWeight: theme.weight.regular }}>({loc === "ALL" ? "All Locations" : loc})</span>
</td>
<td style={{ padding: "10px 6px", textAlign: "right", color: theme.text.primary, fontSize: theme.font.caption.fontSize, fontWeight: theme.weight.bold }}>
{fmtNum(totC)} / {fmtNum(totU)} / {fmtNum(totD)}
</td>
<td style={{ padding: "10px 6px", textAlign: "right", fontWeight: theme.weight.bold, color: totRate >= 78 ? theme.text.success : totRate >= 68 ? theme.text.warning : theme.text.danger }}>
{totRate}%
</td>
</tr>
);
})()}
</tbody>
</table>
</div>

<div style={{ background: theme.bg.base, border: `1px solid ${theme.border.subtle}`, borderRadius: `${theme.radius.xl}px`, padding: "18px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
<div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
{(
[
{ id: "u2row", label: `2+ Sundays U (${thU2RowLoc.total})` },
{ id: "oct25_u", label: `This Sun U (${TEAM_HEALTH_DATA.conf.weekly[loc].u})` },
{ id: "oct25_d", label: `This Sun Declined (${TEAM_HEALTH_DATA.conf.weekly[loc].d})` },
] as Array<{ id: ConfPeopleFilter; label: string }>
).map((b) => {
const active = confPeopleMode === b.id;
return (
<button
key={b.id}
onClick={() => setConfPeopleMode(b.id)}
style={{ border: "none", cursor: "pointer", padding: "5px 12px", borderRadius: `${theme.radius.full}px`, fontSize: theme.font.caption.fontSize, fontWeight: theme.weight.semibold, background: active ? theme.fill.primary : theme.fill.secondary, color: active ? theme.text.onPrimary : theme.text.secondary }}
>
{b.label}
</button>
);
})}
</div>
<div style={{ display: "flex", flexDirection: "column" }}>
{confPeopleMode === "u2row" && thU2RowMembers.slice(0, 25).map((m, i) => (
<div key={`${m.loc}-${m.id}-${i}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", padding: "8px 0", borderTop: i === 0 ? "none" : `1px solid ${theme.border.subtle}` }}>
<div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
<span style={{ fontSize: theme.font.body2.fontSize, fontWeight: theme.weight.medium }}>
<span style={{ color: theme.text.tertiary, fontSize: theme.font.caption.fontSize, marginRight: "6px" }}>{m.loc}</span>
{m.name}
</span>
<span style={{ fontSize: theme.font.caption.fontSize, color: theme.text.tertiary }}>{m.team} · {m.streak} Sun in a row U</span>
</div>
<a href={`https://people.planningcenteronline.com/people/AC${m.id}`} target="_blank" rel="noopener noreferrer" style={chipStyle}>Profile ↗</a>
</div>
))}
{confPeopleMode === "oct25_u" && thOct25UMembers.slice(0, 25).map((m, i) => (
<div key={`${m.loc}-${m.id}-${i}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", padding: "8px 0", borderTop: i === 0 ? "none" : `1px solid ${theme.border.subtle}` }}>
<div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
<span style={{ fontSize: theme.font.body2.fontSize, fontWeight: theme.weight.medium }}>
<span style={{ color: theme.text.tertiary, fontSize: theme.font.caption.fontSize, marginRight: "6px" }}>{m.loc}</span>
{m.name}
</span>
<span style={{ fontSize: theme.font.caption.fontSize, color: theme.text.tertiary }}>{m.team} ({m.pos})</span>
</div>
<a href={`https://people.planningcenteronline.com/people/AC${m.id}`} target="_blank" rel="noopener noreferrer" style={chipStyle}>Profile ↗</a>
</div>
))}
{confPeopleMode === "oct25_d" && thOct25DMembers.slice(0, 25).map((m, i) => (
<div key={`${m.loc}-${m.id}-${i}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", padding: "8px 0", borderTop: i === 0 ? "none" : `1px solid ${theme.border.subtle}` }}>
<div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
<span style={{ fontSize: theme.font.body2.fontSize, fontWeight: theme.weight.medium }}>
<span style={{ color: theme.text.tertiary, fontSize: theme.font.caption.fontSize, marginRight: "6px" }}>{m.loc}</span>
{m.name}
</span>
<span style={{ fontSize: theme.font.caption.fontSize, color: theme.text.tertiary }}>{m.team}{m.reason ? ` · "${m.reason}"` : ""}</span>
</div>
<a href={`https://people.planningcenteronline.com/people/AC${m.id}`} target="_blank" rel="noopener noreferrer" style={chipStyle}>Profile ↗</a>
</div>
))}
</div>
</div>
</div>
)}
</div>
)}

        {tab === "groups" && (
          <div key={`groups-${loc}-${horizon}`} className="health-tab-animate" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ background: theme.bg.base, border: `1px solid ${theme.border.subtle}`, borderRadius: `${theme.radius.xl}px`, padding: "22px", display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: theme.font.heading2.fontSize, fontWeight: theme.weight.semibold }}>
                    Small Groups Health
                  </span>
                  <button
                    onClick={() => setShowGroupsInfo(!showGroupsInfo)}
                    title="How Small Groups Health is measured"
                    style={{
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      padding: "2px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: showGroupsInfo ? theme.text.primary : theme.text.tertiary,
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
                      <circle cx="8" cy="4.8" r="0.85" fill="currentColor" />
                      <path d="M8 7.2V11.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <a href="https://groups.planningcenteronline.com/groups" target="_blank" rel="noopener noreferrer" style={chipStyle}>
                    Open PCO Groups ↗
                  </a>
                </div>
              </div>
              {showGroupsInfo && (
                <div style={{ background: theme.bg.subtle, border: `1px solid ${theme.border.subtle}`, borderRadius: `${theme.radius.md}px`, padding: "12px 14px", fontSize: theme.font.caption.fontSize, color: theme.text.secondary, display: "flex", flexDirection: "column", gap: "6px", lineHeight: "17px" }}>
                  <div>
                    <strong>Active Members (Canonical Goal Match):</strong> {GOALS[5].byHorizon[horizon][loc].pct}% ({GOALS[5].byHorizon[horizon][loc].count}) across active 2026 small groups.
                  </div>
                  <div>
                    <strong>Home vs. Regional Breakdown ({loc === "ALL" ? "All Church" : loc}):</strong> {fmtNum(sgLoc.inGroupAtLoc)} in {loc === "ALL" ? "location" : loc} groups ({sgLoc.openGroups}/{sgLoc.totalGroups} open) · {fmtNum(sgLoc.inGroupRegional)} including multi-location regional groups ({sgLoc.regionalOpenGroups}/{sgLoc.regionalTotalGroups} open) · {fmtNum(sgLoc.callingLocHome)} calling {loc === "ALL" ? "Action Church" : loc} home in any group church-wide.
                  </div>
                  <div>
                    <strong>Attendance &amp; Care Sample (Fall 2026):</strong> {fmtNum(sgLoc.repSampleMembers)} sampled members across {sgLoc.reportingGroups}/{sgLoc.totalGroups} groups logging attendance ({sgLoc.reportingRatePct}%). Hover any table cell for raw counts, or view the All Church total row.
                  </div>
                </div>
              )}

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: theme.font.caption.fontSize, fontVariantNumeric: "tabular-nums" }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${theme.border.default}`, color: theme.text.tertiary, textAlign: "left" }}>
                      <th style={{ padding: "8px 10px" }}>Location</th>
                      <th style={{ padding: "8px 10px", textAlign: "right" }}>Open Groups</th>
                      <th style={{ padding: "8px 10px", textAlign: "right" }}>Groups Logging</th>
                      <th style={{ padding: "8px 10px", textAlign: "right" }}>Active Members</th>
                      <th style={{ padding: "8px 10px", textAlign: "right" }}>Consistent (&gt;50%)</th>
                      <th style={{ padding: "8px 10px", textAlign: "right" }}>Needs Care (0x / Drop-Off)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(["ALL", "WP", "OV", "SF", "WS", "HW"] as LocCode[]).map((c) => {
                      const s = SG_SUMMARY[c];
                      const activeRow = loc === c;
                      const isTotal = c === "ALL";
                      const openPct = s.totalGroups > 0 ? ((s.openGroups / s.totalGroups) * 100).toFixed(1) : "0.0";
                      const gPart = GOALS[5].byHorizon[horizon][c];
                      const gPartRaw = gPart.count.replace(" unique adults", "");
                      const needsCareCount = s.neverAttended + s.dropOff;
                      const needsCarePct = s.repSampleMembers > 0 ? ((needsCareCount / s.repSampleMembers) * 100).toFixed(1) : "0.0";
                      return (
                        <tr
                          key={c}
                          onClick={() => setLoc(c)}
                          style={{
                            cursor: "pointer",
                            borderBottom: `1px solid ${theme.border.subtle}`,
                            background: activeRow ? theme.fill.secondary : "transparent",
                            fontWeight: isTotal || activeRow ? theme.weight.semibold : theme.weight.regular,
                          }}
                        >
                          <td style={{ padding: "10px" }}>
                            {isTotal ? "All Church" : `${c} · ${LOCS.find((l) => l.code === c)?.name}`}
                          </td>
                          <td
                            style={{ padding: "10px", textAlign: "right" }}
                            title={`${s.openGroups} open of ${s.totalGroups} total groups (${s.regionalOpenGroups}/${s.regionalTotalGroups} incl. regional)`}
                          >
                            {isTotal ? `${openPct}% (${s.openGroups}/${s.totalGroups})` : `${openPct}%`}
                          </td>
                          <td
                            style={{ padding: "10px", textAlign: "right", color: s.reportingRatePct >= 45 ? theme.text.success : theme.text.warning }}
                            title={`${s.reportingGroups} of ${s.totalGroups} groups logging attendance (${s.unreportedGroups} unreported)`}
                          >
                            {isTotal ? `${s.reportingRatePct}% (${s.reportingGroups}/${s.totalGroups})` : `${s.reportingRatePct}%`}
                          </td>
                          <td
                            style={{ padding: "10px", textAlign: "right", color: toneColor(gPart.tone) }}
                            title={`${gPart.count} · ${fmtNum(s.inGroupAtLoc)} in ${isTotal ? "church" : c} groups · ${fmtNum(s.callingLocHome)} calling ${isTotal ? "church" : c} home`}
                          >
                            {isTotal ? `${gPart.pct}% (${gPartRaw})` : `${gPart.pct}%`}
                          </td>
                          <td
                            style={{ padding: "10px", textAlign: "right", color: theme.text.success }}
                            title={`${fmtNum(s.attendGt50)} of ${fmtNum(s.repSampleMembers)} sampled members attended >50% of gatherings`}
                          >
                            {isTotal ? `${s.attendGt50Pct}% (${fmtNum(s.attendGt50)})` : `${s.attendGt50Pct}%`}
                          </td>
                          <td
                            style={{ padding: "10px", textAlign: "right", color: theme.text.danger }}
                            title={`${fmtNum(s.neverAttended)} never attended 0x (${s.neverAttendedPct}%) · ${fmtNum(s.dropOff)} early drop-offs (${s.dropOffPct}%) · ${fmtNum(needsCareCount)} total (${needsCarePct}%)`}
                          >
                            {isTotal
                              ? `${s.neverAttendedPct}% / ${s.dropOffPct}% (${fmtNum(s.neverAttended)} / ${fmtNum(s.dropOff)})`
                              : `${s.neverAttendedPct}% / ${s.dropOffPct}%`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ background: theme.bg.base, border: `1px solid ${theme.border.subtle}`, borderRadius: `${theme.radius.xl}px`, padding: "22px", display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                <div
                  role="tablist"
                  aria-label="Small Groups view mode"
                  style={{
                    display: "inline-flex",
                    background: theme.fill.secondary,
                    padding: "3px",
                    borderRadius: "10px",
                    gap: "2px",
                  }}
                >
                  {(
                    [
                      { id: "members", label: "Member Care Queue" },
                      { id: "groups", label: "Group Reporting Audit" },
                    ] as const
                  ).map((seg) => {
                    const active = sgQueueMode === seg.id;
                    return (
                      <button
                        key={seg.id}
                        role="tab"
                        aria-selected={active}
                        onClick={() => setSgQueueMode(seg.id)}
                        style={{
                          border: "none",
                          cursor: "pointer",
                          padding: "6px 14px",
                          borderRadius: "8px",
                          fontSize: theme.font.caption.fontSize,
                          fontWeight: active ? theme.weight.semibold : theme.weight.medium,
                          background: active ? theme.bg.base : "transparent",
                          color: active ? theme.text.primary : theme.text.secondary,
                          boxShadow: active ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
                          transition: "all 0.16s cubic-bezier(0.22, 1, 0.36, 1)",
                        }}
                      >
                        {seg.label}
                      </button>
                    );
                  })}
                </div>

                <input
                  type="text"
                  value={sgSearch}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setSgSearch(e.target.value)}
                  placeholder={sgQueueMode === "members" ? "Search group member or group name..." : "Search group or leader name..."}
                  style={{ border: `1px solid ${theme.border.default}`, borderRadius: `${theme.radius.full}px`, padding: "6px 14px", fontSize: theme.font.label.fontSize, background: theme.bg.subtle, color: theme.text.primary, outline: "none", minWidth: "240px" }}
                />
              </div>

              {sgQueueMode === "members" ? (
                <div key={`sg-members-${sgCareFilter}`} className="health-tab-animate" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {(
                      [
                        { id: "never", label: `Joined · Never Attended 0x (${fmtNum(sgLoc.neverAttended)})` },
                        { id: "dropoff", label: `Early Semester Drop-Offs (${fmtNum(sgLoc.dropOff)})` },
                        { id: "core", label: `Consistent >50% Attendees (${fmtNum(sgLoc.attendGt50)})` },
                      ] as Array<{ id: SgCareFilter; label: string }>
                    ).map((f) => {
                      const active = sgCareFilter === f.id;
                      return (
                        <button
                          key={f.id}
                          onClick={() => setSgCareFilter(f.id)}
                          style={{
                            border: `1px solid ${active ? theme.fill.primary : theme.border.default}`,
                            cursor: "pointer",
                            padding: "6px 12px",
                            borderRadius: `${theme.radius.full}px`,
                            fontSize: theme.font.caption.fontSize,
                            fontWeight: theme.weight.semibold,
                            background: active ? theme.fill.primary : theme.bg.base,
                            color: active ? theme.text.onPrimary : theme.text.secondary,
                          }}
                        >
                          {f.label}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {filteredSgCare.map((m, idx) => (
                      <div key={`${m.pid}-${m.gid}-${idx}`} style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "11px 4px", borderTop: idx === 0 ? "none" : `1px solid ${theme.border.subtle}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: "1 1 260px" }}>
                          <span style={{ padding: "4px 8px", borderRadius: `${theme.radius.md}px`, background: theme.fill.secondary, fontSize: theme.font.caption.fontSize, fontWeight: theme.weight.semibold, color: theme.text.secondary }}>
                            {m.loc}
                          </span>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <span style={{ fontSize: theme.font.body2.fontSize, fontWeight: theme.weight.semibold }}>
                              {m.name}
                              {m.homeLoc !== m.loc && (
                                <span style={{ fontWeight: theme.weight.regular, color: theme.text.tertiary, fontSize: theme.font.caption.fontSize }}> · Home: {m.homeLoc}</span>
                              )}
                            </span>
                            <span style={{ fontSize: theme.font.caption.fontSize, color: theme.text.secondary }}>
                              {m.groupName} · Joined {m.joinedAt}{m.lastAttended && m.lastAttended !== "Never" ? ` · Last: ${m.lastAttended}` : ""}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          <span style={{ padding: "4px 10px", borderRadius: `${theme.radius.full}px`, background: toneBg(m.status === "never" ? "danger" : m.status === "dropoff" ? "warning" : "success"), color: toneColor(m.status === "never" ? "danger" : m.status === "dropoff" ? "warning" : "success"), fontSize: theme.font.caption.fontSize, fontWeight: theme.weight.semibold }}>
                            {m.attended}/{m.held} Attended
                          </span>
                          <a href={`https://people.planningcenteronline.com/people/AC${m.pid}`} target="_blank" rel="noopener noreferrer" style={chipStyle}>PCO Profile ↗</a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div key={`sg-groups-${sgGroupFilter}`} className="health-tab-animate" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {(
                      [
                        { id: "all", label: "All Sampled Groups" },
                        { id: "unreported", label: `Unreported · 0 Logs (${sgLoc.unreportedGroups})` },
                        { id: "reporting", label: `Logging Attendance (${sgLoc.reportingGroups})` },
                      ] as const
                    ).map((f) => {
                      const active = sgGroupFilter === f.id;
                      return (
                        <button
                          key={f.id}
                          onClick={() => setSgGroupFilter(f.id)}
                          style={{
                            border: `1px solid ${active ? theme.fill.primary : theme.border.default}`,
                            cursor: "pointer",
                            padding: "6px 12px",
                            borderRadius: `${theme.radius.full}px`,
                            fontSize: theme.font.caption.fontSize,
                            fontWeight: theme.weight.semibold,
                            background: active ? theme.fill.primary : theme.bg.base,
                            color: active ? theme.text.onPrimary : theme.text.secondary,
                          }}
                        >
                          {f.label}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {filteredSgGroups.map((g, idx) => (
                      <div key={g.id} style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "11px 4px", borderTop: idx === 0 ? "none" : `1px solid ${theme.border.subtle}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: "1 1 260px" }}>
                          <span style={{ padding: "4px 8px", borderRadius: `${theme.radius.md}px`, background: theme.fill.secondary, fontSize: theme.font.caption.fontSize, fontWeight: theme.weight.semibold, color: theme.text.secondary }}>
                            {g.locs.join("/")}
                          </span>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <span style={{ fontSize: theme.font.body2.fontSize, fontWeight: theme.weight.semibold }}>
                              {g.name} <span style={{ fontWeight: theme.weight.regular, color: theme.text.tertiary, fontSize: theme.font.caption.fontSize }}>· {g.isOpen ? "Open" : "Closed/Full"} · {g.membersCount} enrolled</span>
                            </span>
                            <span style={{ fontSize: theme.font.caption.fontSize, color: theme.text.secondary }}>
                              Leaders: {g.leader}{g.eventsReported > 0 ? ` · Avg ${g.avgAttended} attended` : ""}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ padding: "4px 10px", borderRadius: `${theme.radius.full}px`, background: toneBg(g.eventsReported > 0 ? "success" : "danger"), color: toneColor(g.eventsReported > 0 ? "success" : "danger"), fontSize: theme.font.caption.fontSize, fontWeight: theme.weight.semibold }}>
                            {g.eventsReported}/{g.eventsHeld} Logged
                          </span>
                          <a href={`https://groups.planningcenteronline.com/groups/${g.id}`} target="_blank" rel="noopener noreferrer" style={chipStyle}>Open Group ↗</a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "workflows" && (
          <div key={`workflows-${loc}-${horizon}`} className="health-tab-animate" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ background: theme.bg.base, border: `1px solid ${theme.border.subtle}`, borderRadius: `${theme.radius.xl}px`, padding: "22px", display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: theme.font.heading2.fontSize, fontWeight: theme.weight.semibold }}>
                    Staff Effectiveness — Location &amp; Ministry Scorecard
                  </span>
                  <button
                    onClick={() => setShowStaffInfo((v) => !v)}
                    title="How Staff Effectiveness is measured"
                    style={{
                      border: `1px solid ${showStaffInfo ? theme.border.strong : theme.border.default}`,
                      background: showStaffInfo ? theme.bg.elevated : theme.bg.subtle,
                      color: showStaffInfo ? theme.text.accent : theme.text.tertiary,
                      borderRadius: "999px",
                      width: "20px",
                      height: "20px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "11px",
                      fontWeight: 700,
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    i
                  </button>
                </div>
                <a href="https://people.planningcenteronline.com/workflows" target="_blank" rel="noopener noreferrer" style={chipStyle}>
                  Open PCO Workflows ↗
                </a>
              </div>
              {showStaffInfo && (
                <div style={{ fontSize: theme.font.caption.fontSize, color: theme.text.secondary, lineHeight: "17px", paddingTop: "8px", borderTop: `1px solid ${theme.border.subtle}` }}>
                  Framed by Location &amp; Ministry Bucket (LP-safe) · Tracks workflow velocity, Sunday confirmation &amp; 30d+ inactive roster hygiene, and Small Group attendance reporting. Clicking any Roster or Small Group queue below jumps directly to that filtered list in the A-Team or Small Groups tab.
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>
                {staffLoc.buckets.map((b) => (
                  <div
                    key={b.name}
                    style={{
                      background: theme.bg.subtle,
                      border: `1px solid ${theme.border.subtle}`,
                      borderLeft: `4px solid ${toneBar(b.tone)}`,
                      borderRadius: `${theme.radius.lg}px`,
                      padding: "14px 16px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "10px",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "10px", fontWeight: theme.weight.semibold, textTransform: "uppercase", letterSpacing: "0.04em", color: theme.text.tertiary }}>
                          {b.pillar}
                        </span>
                        <span style={{ padding: "2px 8px", borderRadius: `${theme.radius.full}px`, background: toneBg(b.tone), color: toneColor(b.tone), fontSize: "11px", fontWeight: theme.weight.semibold }}>
                          {b.metricVal}
                        </span>
                      </div>
                      <span style={{ fontSize: theme.font.body2.fontSize, fontWeight: theme.weight.semibold, color: theme.text.primary }}>
                        {b.name}
                      </span>
                      <span style={{ fontSize: theme.font.caption.fontSize, color: theme.text.secondary }}>
                        {b.subText}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "4px", borderTop: `1px solid ${theme.border.subtle}` }}>
                      <button
                        onClick={() => {
                          if (b.actionQueue === "inactive_roster") {
                            setTeamSection("inactive");
                            setTab("care");
                          } else if (b.actionQueue === "repeat_u") {
                            setTeamSection("confirmations");
                            setTab("care");
                          } else if (b.actionQueue === "unreported_sg") {
                            setSgQueueMode("groups");
                            setSgGroupFilter("unreported");
                            setTab("groups");
                          } else {
                            setStaffQueueFilter("overdue_wf");
                          }
                        }}
                        style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0, fontSize: theme.font.caption.fontSize, fontWeight: theme.weight.semibold, color: theme.text.accent }}
                      >
                        {b.actionLabel} ↗
                      </button>
                      <a href={b.pcoUrl} target="_blank" rel="noopener noreferrer" style={chipStyle}>
                        Open in PCO ↗
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: theme.bg.base, border: `1px solid ${theme.border.subtle}`, borderRadius: `${theme.radius.xl}px`, padding: "22px", display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontSize: theme.font.body1.fontSize, fontWeight: theme.weight.semibold }}>
                    Overdue &amp; Stale Workflows ({fmtNum(staffLoc.wfOverdue)})
                  </span>
                  <span style={{ fontSize: theme.font.caption.fontSize, color: theme.text.tertiary }}>
                    Grouped by ministry bucket · Jump to A-Team or Small Groups for person-level roster &amp; attendance queues
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  <button
                    onClick={() => { setTeamSection("inactive"); setTab("care"); }}
                    style={{ ...chipStyle, cursor: "pointer", background: theme.bg.subtle }}
                  >
                    30d+ Inactive Roster ({fmtNum(sun.inactive30d)}) · A-Team ↗
                  </button>
                  <button
                    onClick={() => { setTeamSection("confirmations"); setTab("care"); }}
                    style={{ ...chipStyle, cursor: "pointer", background: theme.bg.subtle }}
                  >
                    Repeatedly Unconfirmed ({sun.repeatUnconfPeople}) · A-Team ↗
                  </button>
                  <button
                    onClick={() => { setSgQueueMode("groups"); setSgGroupFilter("unreported"); setTab("groups"); }}
                    style={{ ...chipStyle, cursor: "pointer", background: theme.bg.subtle }}
                  >
                    Unreported Groups ({sgLoc.unreportedGroups}) · Groups ↗
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column" }}>
                {filteredWorkflows.map((w, idx) => (
                  <div key={w.id} style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "12px 0", borderTop: idx === 0 ? "none" : `1px solid ${theme.border.subtle}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: "1 1 260px" }}>
                      <span style={{ padding: "4px 8px", borderRadius: `${theme.radius.md}px`, background: theme.fill.secondary, fontSize: theme.font.caption.fontSize, fontWeight: theme.weight.semibold, color: theme.text.secondary }}>
                        {w.loc}
                      </span>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: theme.font.body2.fontSize, fontWeight: theme.weight.semibold }}>{w.name}</span>
                        <span style={{ fontSize: theme.font.caption.fontSize, color: theme.text.secondary }}>{w.bucket} Workflow</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: theme.font.label.fontSize, color: theme.text.secondary }}>{w.open} open</span>
                      <span style={{ padding: "3px 10px", borderRadius: `${theme.radius.full}px`, background: toneBg(w.tone), color: toneColor(w.tone), fontSize: theme.font.caption.fontSize, fontWeight: theme.weight.semibold }}>
                        {w.overdue} overdue · {w.stale14d} stale (&gt;14d)
                      </span>
                      <a href={`https://people.planningcenteronline.com/workflows/${w.id}`} target="_blank" rel="noopener noreferrer" style={chipStyle}>Open Workflow ↗</a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
