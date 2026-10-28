// ============================================================================
// Supabase Edge Function: ask-grok
// Project: tjnvjsjlyjcmrjyyslaa (Nick Drake Second Brain & Action Church Portal)
//
// Security & Access Boundary:
// 1. Forwards the caller's Authorization Bearer JWT to Supabase so Postgres RLS
//    is strictly enforced on every database query.
// 2. Nick Drake (public.is_nick_owner()) gets full Second Brain + Planning Center access.
// 3. Approved Staff in public.staff_access_grants (e.g., Kalie Drake, Parker Womack,
//    and future approved pastors who signed the Action Church privacy agreement)
//    have:
//    - ZERO access to Nick's personal Second Brain tables (plaud_recordings,
//      tasks, briefs, journal, people, second_brain_docs).
//    - FULL access to Church Health & Sunday Readiness (church_health_snapshots,
//      locations) AND live Planning Center API queries (People, Registrations /
//      Serve Saturday sign-ups, Check-Ins, Services / A Team, Groups, Workflows),
//      with Giving endpoints strictly blocked.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

// Strictly allowed Planning Center API prefixes (Giving is NEVER allowed)
const ALLOWED_PCO_PREFIXES = [
  "/people/v2/",
  "/registrations/v2/",
  "/check-ins/v2/",
  "/services/v2/",
  "/groups/v2/"
];

async function fetchPlanningCenterContext(pcoPath: string): Promise<unknown> {
  const appId = Deno.env.get("PCO_APP_ID");
  const secret = Deno.env.get("PCO_SECRET");
  if (!appId || !secret || !pcoPath) return null;

  const normalized = pcoPath.startsWith("/") ? pcoPath : `/${pcoPath}`;
  const isAllowed = ALLOWED_PCO_PREFIXES.some((prefix) => normalized.startsWith(prefix));
  if (!isAllowed || normalized.toLowerCase().includes("giving")) {
    throw new Error("Planning Center endpoint not permitted (Giving is excluded).");
  }

  const basicAuth = btoa(`${appId}:${secret}`);
  const resp = await fetch(`https://api.planningcenteronline.com${normalized}`, {
    headers: {
      Authorization: `Basic ${basicAuth}`,
      Accept: "application/json"
    }
  });
  if (!resp.ok) {
    throw new Error(`Planning Center API returned ${resp.status}`);
  }
  return await resp.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization JWT header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "https://tjnvjsjlyjcmrjyyslaa.supabase.co";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    // Client initialized with caller's JWT so Postgres RLS is 100% enforced
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const {
      data: { user },
      error: userErr
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid or expired session token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { question, pco_endpoint } = await req.json();
    if (!question || typeof question !== "string") {
      return new Response(JSON.stringify({ error: "Question is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 1. Run RLS-scoped search_second_brain (SECURITY INVOKER)
    //    - If caller is Nick: searches second_brain_docs, journal, briefs, plaud_recordings, tasks, locations, church_health_snapshots
    //    - If caller is Approved Staff: RLS automatically blocks Nick's 20 personal tables and returns ONLY church_health_snapshots & locations
    const { data: searchRows } = await supabase.rpc("search_second_brain", {
      search_query: question,
      max_results: 15
    });

    // 2. Fetch latest Church Health Snapshot (accessible to both Nick and Approved Staff)
    const { data: latestSnap } = await supabase
      .from("church_health_snapshots")
      .select("week_of, hw_summary_json, sf_summary_json, all_locations_json")
      .order("week_of", { ascending: false })
      .limit(1);

    // 3. Optional live Planning Center pull (People, Registrations/Serve Saturday, Check-Ins, Services, Groups; Giving blocked)
    let pcoData: unknown = null;
    if (pco_endpoint) {
      pcoData = await fetchPlanningCenterContext(pco_endpoint);
    }

    // 4. Synthesize answer via xAI Grok API (if XAI_API_KEY is configured)
    const xaiKey = Deno.env.get("XAI_API_KEY");
    let answer = "";

    if (xaiKey) {
      const llmResp = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${xaiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "grok-4",
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content:
                "You are Grok answering inside nickdrake.ai for Action Church leadership. Always say 'location' (never 'campus'), spell 'Kalie', 'Pastor Tyler', and 'Parker Womack', never use em dashes, and answer concisely using only the RLS-authorized context and Planning Center data provided."
            },
            {
              role: "user",
              content: JSON.stringify({
                caller_email: user.email,
                question,
                rls_search_matches: searchRows ?? [],
                latest_church_health_snapshot: latestSnap?.[0] ?? null,
                live_planning_center_data: pcoData
              })
            }
          ]
        })
      });
      const llmJson = await llmResp.json();
      answer = llmJson?.choices?.[0]?.message?.content ?? "No answer returned.";
    } else {
      answer = `RLS-verified matches (${(searchRows || []).length} rows) for ${user.email}: ` +
        JSON.stringify(searchRows?.slice(0, 5) ?? []);
    }

    return new Response(
      JSON.stringify({
        caller: user.email,
        answer,
        matches: searchRows ?? [],
        pco_live_included: Boolean(pcoData)
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
