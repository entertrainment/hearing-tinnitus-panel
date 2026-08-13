#!/usr/bin/env node
// One-time helper — mints a DELEGATED refresh token for the no-secret Outlook path,
// using the device-code flow (no client secret, nothing stored in the app).
//
// Prerequisites on your Entra app registration:
//   • "Allow public client flows" = Yes (Authentication → Advanced settings)
//   • Delegated Microsoft Graph permission "Mail.Send" (+ offline_access is requested here)
//
// Usage (Node 18+):
//   node tools/get-refresh-token.js <TENANT_ID> <CLIENT_ID>
// or set MS_TENANT_ID / MS_CLIENT_ID in the environment and run with no args.
//
// It prints a code + URL; sign in as the mailbox you want to send FROM. On success it prints
// the refresh_token — paste that into Netlify as MS_REFRESH_TOKEN. Keep it secret.

const TENANT = process.argv[2] || process.env.MS_TENANT_ID;
const CLIENT = process.argv[3] || process.env.MS_CLIENT_ID;
const SCOPE = "https://graph.microsoft.com/Mail.Send offline_access openid profile";

if (!TENANT || !CLIENT) {
  console.error("Usage: node tools/get-refresh-token.js <TENANT_ID> <CLIENT_ID>");
  process.exit(1);
}
const base = `https://login.microsoftonline.com/${encodeURIComponent(TENANT)}/oauth2/v2.0`;

(async () => {
  // 1) request a device code
  const dcRes = await fetch(`${base}/devicecode`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT, scope: SCOPE })
  });
  const dc = await dcRes.json();
  if (!dc.device_code) { console.error("Device code request failed:", dc); process.exit(1); }
  console.log("\n1) Open: " + dc.verification_uri);
  console.log("2) Enter code: " + dc.user_code);
  console.log("3) Sign in as the mailbox you want to send FROM.\n   Waiting…\n");

  // 2) poll for the token
  const started = Date.now(), timeout = (dc.expires_in || 900) * 1000;
  let interval = (dc.interval || 5) * 1000;
  for (;;) {
    if (Date.now() - started > timeout) { console.error("Timed out. Re-run and finish sign-in sooner."); process.exit(1); }
    await new Promise(r => setTimeout(r, interval));
    const tRes = await fetch(`${base}/token`, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:device_code", client_id: CLIENT, device_code: dc.device_code })
    });
    const t = await tRes.json();
    if (t.error === "authorization_pending") continue;
    if (t.error === "slow_down") { interval += 5000; continue; }
    if (t.error) { console.error("Auth failed:", t.error, t.error_description || ""); process.exit(1); }
    if (t.refresh_token) {
      console.log("\n✅ Success. Set this in Netlify as MS_REFRESH_TOKEN (keep it secret):\n");
      console.log(t.refresh_token + "\n");
      process.exit(0);
    }
    console.error("No refresh_token returned:", t); process.exit(1);
  }
})().catch(e => { console.error(e); process.exit(1); });
