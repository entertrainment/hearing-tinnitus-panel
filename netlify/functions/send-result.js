// Netlify serverless function — emails a hearing-test result from your Outlook via
// Microsoft Graph (app-only / client-credentials). No external dependencies (uses the
// global fetch in Netlify's Node 18+ runtime).
//
// Environment variables (Site settings → Environment variables) — never committed:
//   MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET   from your Entra app registration
//   MS_SENDER        mailbox to send FROM, e.g. you@example.com
//   RESULT_TO        (optional) where results go; defaults to MS_SENDER — NEVER taken from the request
//   ALLOWED_ORIGINS  (optional) comma-separated origins allowed to call this endpoint,
//                    e.g. "https://your-site.netlify.app". If unset, only same-site calls
//                    (Origin/Referer matching the function host) are accepted.
//   RESULT_TOKEN     (optional) shared token required in the X-Result-Token header. NOTE: a static
//                    site can't keep a secret, so this is obfuscation/friction, not real auth.
//
// Entra requirement: APPLICATION permission "Mail.Send" with admin consent, plus a client secret
// (app-only sending needs a confidential client).
//
// Abuse hardening: the recipient is FIXED server-side (never from the caller), so at worst this can
// be used to spam YOUR mailbox — it is not an open relay. On top of that: origin allow-listing, a
// small request-size cap, per-IP best-effort rate limiting, a honeypot, and payload validation.

const DEFAULT_TO = ["douglas","entertrainment.co.uk"].join("@");  // assembled; override with the RESULT_TO env var
const MAX_BODY_BYTES = 8 * 1024;         // reject oversized payloads
const RATE_MAX = 12;                     // max requests
const RATE_WINDOW_MS = 60 * 1000;        // per minute, per IP (best-effort; resets on cold start)
const hits = new Map();                  // ip -> [timestamps]

function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();     // crude memory bound
  return arr.length > RATE_MAX;
}

function originAllowed(headers) {
  const origin = headers.origin || "";
  const referer = headers.referer || "";
  const host = headers.host || "";
  const allow = (process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (allow.length) {
    if (origin && allow.includes(origin)) return origin;
    if (referer && allow.some((o) => referer.indexOf(o) === 0)) return origin || allow[0];
    return null;
  }
  // No allow-list configured → same-site only: Origin/Referer host must match the function host.
  if (!origin && !referer) return null;                 // browsers always send one on cross-origin
  if (origin && origin.indexOf(host) !== -1) return origin;
  if (referer && referer.indexOf(host) !== -1) return origin || ("https://" + host);
  return null;
}

const reply = (statusCode, obj, acao) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": acao || "null",
    "Access-Control-Allow-Headers": "Content-Type, X-Result-Token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "X-Content-Type-Options": "nosniff"
  },
  body: JSON.stringify(obj)
});

exports.handler = async function (event) {
  const h = event.headers || {};
  const acao = originAllowed(h);

  if (event.httpMethod === "OPTIONS") return reply(204, {}, acao || "null");
  if (event.httpMethod !== "POST") return reply(405, { error: "Method not allowed" }, acao);
  if (!acao) return reply(403, { error: "Origin not allowed" }, "null");

  const ip = h["x-nf-client-connection-ip"] || (h["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) return reply(429, { error: "Rate limit exceeded" }, acao);

  const raw = event.body || "";
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) return reply(413, { error: "Payload too large" }, acao);
  if (process.env.RESULT_TOKEN && h["x-result-token"] !== process.env.RESULT_TOKEN) return reply(401, { error: "Bad token" }, acao);

  const { MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, MS_SENDER } = process.env;
  const RESULT_TO = process.env.RESULT_TO || MS_SENDER || DEFAULT_TO;   // recipient is fixed, never from caller
  if (!MS_TENANT_ID || !MS_CLIENT_ID || !MS_CLIENT_SECRET || !MS_SENDER) {
    return reply(500, { error: "Server not configured: set MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET and MS_SENDER." }, acao);
  }

  let d = {};
  try { d = JSON.parse(raw || "{}"); } catch (e) { return reply(400, { error: "Invalid JSON body" }, acao); }
  if (d && typeof d === "object" && d.hp) return reply(200, { ok: true }, acao);   // honeypot: pretend success, send nothing
  if (!d || typeof d !== "object" || Array.isArray(d)) return reply(400, { error: "Bad payload" }, acao);

  const s = (v) => String(v == null ? "" : v).replace(/[\r\n]+/g, " ").slice(0, 2000);
  const panel = s(d.panel || "test");
  const bodyText = [
    "Hearing / Tinnitus test result",
    "--------------------------------",
    "Panel:            " + panel,
    "Name/label:       " + s(d.tester || "(anonymous)"),
    d.cutoff_hz ? "Hearing cutoff:   " + s(d.cutoff_hz) : null,
    d.audiogram ? "Hearing profile:  " + s(d.audiogram) : null,
    d.tinnitus_hz ? "Tinnitus pitch:   " + s(d.tinnitus_hz) + " Hz" : null,
    d.tinnitus_type ? "Suggested type:   " + s(d.tinnitus_type) : null,
    d.tinnitus_profile ? "Tinnitus profile: " + s(d.tinnitus_profile) : null,
    "When:             " + s(d.timestamp || new Date().toISOString()),
    "Device:           " + s(d.device),
    "",
    "(Screening only — not a clinical diagnosis. Levels are relative, not dB HL.)"
  ].filter(Boolean).join("\n");
  const subject = "Hearing test result (" + panel + ")" +
    (d.tinnitus_hz ? " — tinnitus " + s(d.tinnitus_hz) + " Hz" : d.cutoff_hz ? " — cutoff " + s(d.cutoff_hz) : "");

  try {
    const tokenRes = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(MS_TENANT_ID)}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: MS_CLIENT_ID, client_secret: MS_CLIENT_SECRET, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" })
    });
    if (!tokenRes.ok) { const t = await tokenRes.text(); return reply(502, { error: "Token request failed", detail: t.slice(0, 400) }, acao); }
    const token = (await tokenRes.json()).access_token;
    if (!token) return reply(502, { error: "No access_token returned" }, acao);

    const mailRes = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(MS_SENDER)}/sendMail`, {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: { subject, body: { contentType: "Text", content: bodyText }, toRecipients: [{ emailAddress: { address: RESULT_TO } }] },
        saveToSentItems: true
      })
    });
    if (mailRes.status === 202) return reply(200, { ok: true }, acao);
    const errText = await mailRes.text();
    return reply(502, { error: "sendMail failed", status: mailRes.status, detail: errText.slice(0, 400) }, acao);
  } catch (err) {
    return reply(500, { error: String(err).slice(0, 300) }, acao);
  }
};
