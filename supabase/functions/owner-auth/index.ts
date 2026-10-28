import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_OWNER_EMAILS = new Set([
  "nick.drake@theactionchurch.com",
  "nickdrake0755@gmail.com",
  "nick@drakeweddings.com",
  "nick@actionchurch.com",
  "hello@drakeweddings.com",
]);

async function resolveAuthorizedUser(
  supabaseAdmin: any,
  rawEmail: string
): Promise<{ allowed: boolean; email: string; displayName: string; accessLevel: string }> {
  const email = String(rawEmail || "").trim().toLowerCase();
  if (!email) {
    return { allowed: false, email: "", displayName: "", accessLevel: "none" };
  }
  if (ALLOWED_OWNER_EMAILS.has(email)) {
    return { allowed: true, email, displayName: "Nick Drake", accessLevel: "owner" };
  }
  const { data: row } = await supabaseAdmin
    .from("health_dashboard_access")
    .select("email, full_name, access_level, active")
    .ilike("email", email)
    .eq("active", true)
    .maybeSingle();

  if (row && row.active) {
    return {
      allowed: true,
      email: String(row.email || email).toLowerCase(),
      displayName: String(row.full_name || email.split("@")[0]),
      accessLevel: String(row.access_level || "viewer"),
    };
  }
  return { allowed: false, email, displayName: "", accessLevel: "none" };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(b64u: string): Uint8Array {
  const padded = String(b64u || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(String(b64u || "").length / 4) * 4, "=");
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function derToP1363(der: Uint8Array): Uint8Array {
  if (der.length === 64 && der[0] !== 0x30) return der;
  let offset = 0;
  if (der[offset++] !== 0x30) throw new Error("Invalid DER signature header");
  let seqLen = der[offset++];
  if (seqLen & 0x80) {
    const n = seqLen & 0x7f;
    offset += n;
  }
  if (der[offset++] !== 0x02) throw new Error("Invalid DER R marker");
  const rLen = der[offset++];
  let r = der.slice(offset, offset + rLen);
  offset += rLen;
  if (der[offset++] !== 0x02) throw new Error("Invalid DER S marker");
  const sLen = der[offset++];
  let s = der.slice(offset, offset + sLen);

  while (r.length > 32 && r[0] === 0x00) r = r.slice(1);
  while (s.length > 32 && s[0] === 0x00) s = s.slice(1);
  if (r.length > 32 || s.length > 32) throw new Error("Coordinate length > 32");

  const out = new Uint8Array(64);
  out.set(r, 32 - r.length);
  out.set(s, 64 - s.length);
  return out;
}

function extractP256Coords(spkiB64u?: string, xB64u?: string, yB64u?: string): { x: string; y: string } {
  if (xB64u && yB64u) {
    const xb = base64UrlToBytes(xB64u);
    const yb = base64UrlToBytes(yB64u);
    if (xb.length === 32 && yb.length === 32) {
      return { x: bytesToBase64Url(xb), y: bytesToBase64Url(yb) };
    }
  }
  if (spkiB64u) {
    const spki = base64UrlToBytes(spkiB64u);
    if (spki.length >= 65 && spki[spki.length - 65] === 0x04) {
      const x = spki.slice(spki.length - 64, spki.length - 32);
      const y = spki.slice(spki.length - 32);
      return { x: bytesToBase64Url(x), y: bytesToBase64Url(y) };
    }
  }
  throw new Error("Could not extract P-256 public key coordinates");
}

function extractP256FromAuthData(authData: Uint8Array): { x: string; y: string } | null {
  try {
    if (authData.length < 55) return null;
    const flags = authData[32];
    const hasAttestedCredData = (flags & 0x40) !== 0;
    if (!hasAttestedCredData) return null;
    const credIdLen = (authData[53] << 8) | authData[54];
    const coseStart = 55 + credIdLen;
    const cose = authData.slice(coseStart);
    let xBytes: Uint8Array | null = null;
    let yBytes: Uint8Array | null = null;
    for (let i = 0; i < cose.length - 35; i++) {
      if (cose[i] === 0x21 && cose[i + 1] === 0x58 && cose[i + 2] === 0x20) {
        xBytes = cose.slice(i + 3, i + 35);
      }
      if (cose[i] === 0x22 && cose[i + 1] === 0x58 && cose[i + 2] === 0x20) {
        yBytes = cose.slice(i + 3, i + 35);
      }
    }
    if (xBytes && yBytes) {
      return { x: bytesToBase64Url(xBytes), y: bytesToBase64Url(yBytes) };
    }
  } catch (_) {}
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const action = String(body.action || "");

    if (action === "passkey_register_options") {
      const authHeader = req.headers.get("Authorization") || "";
      const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (!jwt) {
        return jsonResponse({ error: "Sign in first to enable Face ID / Touch ID." }, 401);
      }

      const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(jwt);
      const user = userRes?.user;
      const authCheck = await resolveAuthorizedUser(supabaseAdmin, user?.email || "");
      if (userErr || !user || !authCheck.allowed) {
        return jsonResponse({ error: "Unauthorized session." }, 403);
      }

      const rpId = String(body.rp_id || "nickdrake.ai").trim();
      const rand = new Uint8Array(32);
      crypto.getRandomValues(rand);
      const challenge = bytesToBase64Url(rand);

      await supabaseAdmin.from("sb_passkey_challenges").insert({
        challenge,
        flow: "register",
        user_email: authCheck.email,
        rp_id: rpId,
      });

      const { data: existingCreds } = await supabaseAdmin
        .from("sb_passkey_credentials")
        .select("id, transports")
        .eq("user_email", authCheck.email);

      return jsonResponse({
        ok: true,
        challenge,
        rp: {
          name: "nickdrake.ai · Personal Second Brain",
          id: rpId,
        },
        user: {
          id: bytesToBase64Url(new TextEncoder().encode(user.id)),
          name: authCheck.email,
          displayName: authCheck.displayName || authCheck.email,
        },
        existingCredentials: (existingCreds || []).map((c: any) => ({
          id: c.id,
          type: "public-key",
          transports: c.transports || ["internal", "hybrid"],
        })),
      });
    }

    if (action === "passkey_register_verify") {
      const authHeader = req.headers.get("Authorization") || "";
      const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (!jwt) {
        return jsonResponse({ error: "Sign in first to save passkey." }, 401);
      }

      const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(jwt);
      const user = userRes?.user;
      const authCheck = await resolveAuthorizedUser(supabaseAdmin, user?.email || "");
      if (userErr || !user || !authCheck.allowed) {
        return jsonResponse({ error: "Unauthorized session." }, 403);
      }

      const credentialId = String(body.credential_id || "").trim();
      const clientDataJSONB64 = String(body.client_data_json || "").trim();
      const authDataB64 = String(body.authenticator_data || "").trim();
      const publicKeySpki = String(body.public_key_spki || "").trim();
      const deviceLabel = String(body.device_label || "Face ID / Touch ID").trim();
      const rpId = String(body.rp_id || "nickdrake.ai").trim();

      if (!credentialId || !clientDataJSONB64) {
        return jsonResponse({ error: "Missing passkey registration payload." }, 400);
      }

      const clientDataBytes = base64UrlToBytes(clientDataJSONB64);
      const clientData = JSON.parse(new TextDecoder().decode(clientDataBytes));
      if (clientData.type !== "webauthn.create") {
        return jsonResponse({ error: "Invalid WebAuthn type." }, 400);
      }

      const challenge = String(clientData.challenge || "");
      const { data: chRow } = await supabaseAdmin
        .from("sb_passkey_challenges")
        .select("*")
        .eq("challenge", challenge)
        .eq("flow", "register")
        .eq("consumed", false)
        .single();

      if (!chRow || new Date(chRow.expires_at).getTime() < Date.now()) {
        return jsonResponse({ error: "Registration challenge expired. Please try again." }, 400);
      }

      await supabaseAdmin
        .from("sb_passkey_challenges")
        .update({ consumed: true })
        .eq("id", chRow.id);

      let coords: { x: string; y: string } | null = null;
      try {
        coords = extractP256Coords(publicKeySpki, body.public_key_x, body.public_key_y);
      } catch (_) {
        if (authDataB64) {
          coords = extractP256FromAuthData(base64UrlToBytes(authDataB64));
        }
      }

      if (!coords) {
        return jsonResponse({ error: "Could not extract P-256 public key from authenticator." }, 400);
      }

      const transports = Array.isArray(body.transports) && body.transports.length
        ? body.transports
        : ["internal", "hybrid"];

      const { error: upErr } = await supabaseAdmin
        .from("sb_passkey_credentials")
        .upsert({
          id: credentialId,
          user_id: user.id,
          user_email: authCheck.email,
          public_key_spki: publicKeySpki || null,
          public_key_x: coords.x,
          public_key_y: coords.y,
          algorithm: -7,
          sign_count: 0,
          transports,
          device_label: deviceLabel,
          rp_id: rpId,
          last_used_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (upErr) {
        return jsonResponse({ error: upErr.message }, 500);
      }

      return jsonResponse({
        ok: true,
        credential_id: credentialId,
        device_label: deviceLabel,
        user_email: authCheck.email,
      });
    }

    if (action === "passkey_login_options") {
      const rpId = String(body.rp_id || "nickdrake.ai").trim();
      const hintEmail = String(body.email || "").trim().toLowerCase();
      const rand = new Uint8Array(32);
      crypto.getRandomValues(rand);
      const challenge = bytesToBase64Url(rand);

      await supabaseAdmin.from("sb_passkey_challenges").insert({
        challenge,
        flow: "login",
        user_email: hintEmail || "nick.drake@theactionchurch.com",
        rp_id: rpId,
      });

      const { data: creds } = await supabaseAdmin
        .from("sb_passkey_credentials")
        .select("id, user_email, transports, device_label, created_at")
        .eq("rp_id", rpId);

      return jsonResponse({
        ok: true,
        challenge,
        rpId,
        hasRegisteredPasskeys: Array.isArray(creds) && creds.length > 0,
        allowCredentials: (creds || []).map((c: any) => ({
          id: c.id,
          type: "public-key",
          transports: c.transports || ["internal", "hybrid"],
        })),
      });
    }

    if (action === "passkey_login_verify") {
      const credentialId = String(body.credential_id || "").trim();
      const clientDataJSONB64 = String(body.client_data_json || "").trim();
      const authDataB64 = String(body.authenticator_data || "").trim();
      const signatureB64 = String(body.signature || "").trim();

      if (!credentialId || !clientDataJSONB64 || !authDataB64 || !signatureB64) {
        return jsonResponse({ error: "Missing WebAuthn assertion parameters." }, 400);
      }

      const { data: cred, error: credErr } = await supabaseAdmin
        .from("sb_passkey_credentials")
        .select("*")
        .eq("id", credentialId)
        .single();

      if (credErr || !cred) {
        return jsonResponse({
          error: "Passkey not recognized on nickdrake.ai yet. Sign in once with Password or Magic Link, then open Settings & Face ID to enable Face ID / Touch ID.",
        }, 404);
      }

      const clientDataBytes = base64UrlToBytes(clientDataJSONB64);
      const clientData = JSON.parse(new TextDecoder().decode(clientDataBytes));
      if (clientData.type !== "webauthn.get") {
        return jsonResponse({ error: "Invalid assertion type." }, 400);
      }

      const challenge = String(clientData.challenge || "");
      const { data: chRow } = await supabaseAdmin
        .from("sb_passkey_challenges")
        .select("*")
        .eq("challenge", challenge)
        .eq("flow", "login")
        .eq("consumed", false)
        .single();

      if (!chRow || new Date(chRow.expires_at).getTime() < Date.now()) {
        return jsonResponse({ error: "Passkey challenge expired. Please tap Face ID / Touch ID again." }, 400);
      }

      await supabaseAdmin
        .from("sb_passkey_challenges")
        .update({ consumed: true })
        .eq("id", chRow.id);

      const authDataBytes = base64UrlToBytes(authDataB64);
      if ((authDataBytes[32] & 0x01) === 0) {
        return jsonResponse({ error: "User presence check failed." }, 400);
      }

      const clientDataHash = new Uint8Array(await crypto.subtle.digest("SHA-256", clientDataBytes));
      const signedData = new Uint8Array(authDataBytes.length + clientDataHash.length);
      signedData.set(authDataBytes, 0);
      signedData.set(clientDataHash, authDataBytes.length);

      const jwk: JsonWebKey = {
        kty: "EC",
        crv: "P-256",
        x: cred.public_key_x,
        y: cred.public_key_y,
        ext: true,
      };
      const cryptoKey = await crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["verify"]
      );

      const sigRaw = derToP1363(base64UrlToBytes(signatureB64));
      const isValid = await crypto.subtle.verify(
        { name: "ECDSA", hash: { name: "SHA-256" } },
        cryptoKey,
        sigRaw,
        signedData
      );

      if (!isValid) {
        return jsonResponse({ error: "Passkey cryptographic signature verification failed." }, 401);
      }

      await supabaseAdmin
        .from("sb_passkey_credentials")
        .update({
          last_used_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", credentialId);

      const candidateEmail = String(cred.user_email || "nick.drake@theactionchurch.com").trim().toLowerCase();
      const authCheck = await resolveAuthorizedUser(supabaseAdmin, candidateEmail);
      if (!authCheck.allowed) {
        return jsonResponse({ error: "This account is no longer on the authorized access list." }, 403);
      }
      const targetEmail = authCheck.email;

      const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: targetEmail,
      });

      if (linkErr || !linkData?.properties?.hashed_token) {
        return jsonResponse({ error: linkErr?.message || "Failed to issue session" }, 500);
      }

      return jsonResponse({
        ok: true,
        verified: true,
        email: targetEmail,
        display_name: authCheck.displayName,
        access_level: authCheck.accessLevel,
        token_hash: linkData.properties.hashed_token,
        verification_type: "magiclink",
        device_label: cred.device_label,
      });
    }

    if (action === "passkey_list" || action === "passkey_delete") {
      const authHeader = req.headers.get("Authorization") || "";
      const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (!jwt) return jsonResponse({ error: "Unauthorized" }, 401);

      const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(jwt);
      const user = userRes?.user;
      const authCheck = await resolveAuthorizedUser(supabaseAdmin, user?.email || "");
      if (userErr || !user || !authCheck.allowed) {
        return jsonResponse({ error: "Unauthorized" }, 403);
      }

      if (action === "passkey_delete" && body.credential_id) {
        await supabaseAdmin
          .from("sb_passkey_credentials")
          .delete()
          .eq("id", String(body.credential_id))
          .eq("user_email", authCheck.email);
      }

      const { data: creds } = await supabaseAdmin
        .from("sb_passkey_credentials")
        .select("id, user_email, device_label, rp_id, last_used_at, created_at")
        .eq("user_email", authCheck.email)
        .order("created_at", { ascending: false });

      return jsonResponse({ ok: true, credentials: creds || [] });
    }

    if (action === "start_challenge") {
      const email = String(body.email || "").trim().toLowerCase();
      const authCheck = await resolveAuthorizedUser(supabaseAdmin, email);
      if (!authCheck.allowed) {
        return jsonResponse({ error: "Authorized email required." }, 403);
      }

      const { data: state, error: stateErr } = await supabaseAdmin.rpc(
        "admin_get_owner_auth_state",
        { p_email: email }
      );
      if (stateErr || !state) {
        return jsonResponse({ error: stateErr?.message || "Account not found" }, 400);
      }

      const activeTokenHash = String(state.active_token_hash || "");
      if (!activeTokenHash) {
        return jsonResponse({ error: "No pending magic link found. Request a magic link first." }, 400);
      }

      const randomBytes = new Uint8Array(32);
      crypto.getRandomValues(randomBytes);
      const challengeSecret = Array.from(randomBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const baselineTs = state.latest_session_created_at || state.last_sign_in_at || null;

      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from("magic_link_challenges")
        .insert({
          challenge_secret: challengeSecret,
          user_id: state.user_id,
          email: state.email,
          expected_recovery_token: activeTokenHash,
          baseline_sign_in_at: baselineTs,
        })
        .select("id, expires_at")
        .single();

      if (insertErr || !inserted) {
        return jsonResponse({ error: insertErr?.message || "Failed to create challenge" }, 500);
      }

      return jsonResponse({
        ok: true,
        challenge_id: inserted.id,
        challenge_secret: challengeSecret,
        expires_at: inserted.expires_at,
      });
    }

    if (action === "poll_challenge") {
      const challengeId = String(body.challenge_id || "").trim();
      const challengeSecret = String(body.challenge_secret || "").trim();
      if (!challengeId || !challengeSecret) {
        return jsonResponse({ error: "Missing challenge credentials" }, 400);
      }

      const { data: ch, error: chErr } = await supabaseAdmin
        .from("magic_link_challenges")
        .select("*")
        .eq("id", challengeId)
        .eq("challenge_secret", challengeSecret)
        .single();

      if (chErr || !ch) {
        return jsonResponse({ error: "Challenge not found" }, 404);
      }
      if (ch.consumed) {
        return jsonResponse({ verified: false, reason: "already_consumed" });
      }
      if (new Date(ch.expires_at).getTime() < Date.now()) {
        return jsonResponse({ error: "expired", verified: false });
      }

      const { data: state, error: stateErr } = await supabaseAdmin.rpc(
        "admin_get_owner_auth_state",
        { p_email: ch.email }
      );
      if (stateErr || !state) {
        return jsonResponse({ verified: false, reason: "state_error" });
      }

      const currentToken = String(state.active_token_hash || "");
      const latestSignIn = state.latest_session_created_at || state.last_sign_in_at;
      const baselineMs = ch.baseline_sign_in_at ? new Date(ch.baseline_sign_in_at).getTime() : 0;
      const latestMs = latestSignIn ? new Date(latestSignIn).getTime() : 0;

      const tokenWasConsumed = currentToken === "" && ch.expected_recovery_token !== "";
      const sessionAdvanced = latestMs > baselineMs;

      if (tokenWasConsumed && sessionAdvanced) {
        await supabaseAdmin
          .from("magic_link_challenges")
          .update({ consumed: true })
          .eq("id", ch.id);

        const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email: ch.email,
        });

        if (linkErr || !linkData?.properties?.hashed_token) {
          return jsonResponse({ error: linkErr?.message || "Failed to mint session token" }, 500);
        }

        return jsonResponse({
          verified: true,
          email: ch.email,
          token_hash: linkData.properties.hashed_token,
          verification_type: "magiclink",
        });
      }

      return jsonResponse({
        verified: false,
        reason: "waiting_for_click",
      });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
