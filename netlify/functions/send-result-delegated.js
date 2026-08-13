// ALTERNATIVE to send-result.js — the NO-CLIENT-SECRET path.
//
// Uses a DELEGATED refresh token (public client + PKCE) instead of an app-only client secret,
// so you don't have to add a secret to your Entra app. It sends from the signed-in user (/me).
// To use this instead of the app-only version, either point the site at this function's path,
// or replace send-result.js with this file's contents.
//
// Environment variables (Netlify → Site settings → Environment variables):
//   MS_TENANT_ID      Directory (tenant) ID
//   MS_CLIENT_ID      Application (client) ID  (public client — "Allow public client flows" = Yes)
//   MS_REFRESH_TOKEN  Delegated refresh token with scopes "Mail.Send offline_access"
//                     — mint it once with tools/get-refresh-token.js (device-code flow, no secret)
//   RESULT_TO         (optional) recipient; defaults to the signed-in mailbox. NEVER from the request.
//   ALLOWED_ORIGINS   (optional) comma-separated allowed origins; else same-site only.
//   RESULT_TOKEN      (optional) shared header token (friction, not real auth on a static site).
//
// Caveat vs app-only: refresh tokens rotate/expire (typically ~90 days of inactivity, and are
// revocable). Because a stateless function can't persist a rotated token, you may need to re-mint
// it periodically. The app-only + client-secret path (send-result.js) is more robust for
// fully unattended sending — this variant simply avoids storing a secret.

const MAX_BODY_BYTES = 8 * 1024, RATE_MAX = 12, RATE_WINDOW_MS = 60 * 1000;
const hits = new Map();
function rateLimited(ip){ const now=Date.now(); const a=(hits.get(ip)||[]).filter(t=>now-t<RATE_WINDOW_MS); a.push(now); hits.set(ip,a); if(hits.size>5000) hits.clear(); return a.length>RATE_MAX; }
function originAllowed(h){ const o=h.origin||"",r=h.referer||"",host=h.host||""; const allow=(process.env.ALLOWED_ORIGINS||"").split(",").map(s=>s.trim()).filter(Boolean);
  if(allow.length){ if(o&&allow.includes(o))return o; if(r&&allow.some(x=>r.indexOf(x)===0))return o||allow[0]; return null; }
  if(!o&&!r) return null; if(o&&o.indexOf(host)!==-1) return o; if(r&&r.indexOf(host)!==-1) return o||("https://"+host); return null; }
const reply=(sc,obj,acao)=>({ statusCode:sc, headers:{ "Content-Type":"application/json", "Access-Control-Allow-Origin":acao||"null", "Access-Control-Allow-Headers":"Content-Type, X-Result-Token", "Access-Control-Allow-Methods":"POST, OPTIONS", "X-Content-Type-Options":"nosniff" }, body:JSON.stringify(obj) });

exports.handler = async function(event){
  const h=event.headers||{}, acao=originAllowed(h);
  if(event.httpMethod==="OPTIONS") return reply(204,{},acao||"null");
  if(event.httpMethod!=="POST") return reply(405,{error:"Method not allowed"},acao);
  if(!acao) return reply(403,{error:"Origin not allowed"},"null");
  const ip=h["x-nf-client-connection-ip"]||(h["x-forwarded-for"]||"").split(",")[0].trim()||"unknown";
  if(rateLimited(ip)) return reply(429,{error:"Rate limit exceeded"},acao);
  const raw=event.body||""; if(Buffer.byteLength(raw,"utf8")>MAX_BODY_BYTES) return reply(413,{error:"Payload too large"},acao);
  if(process.env.RESULT_TOKEN && h["x-result-token"]!==process.env.RESULT_TOKEN) return reply(401,{error:"Bad token"},acao);

  const { MS_TENANT_ID, MS_CLIENT_ID, MS_REFRESH_TOKEN } = process.env;
  const RESULT_TO = process.env.RESULT_TO || null;   // null → Graph /me sends to the signed-in mailbox
  if(!MS_TENANT_ID || !MS_CLIENT_ID || !MS_REFRESH_TOKEN) return reply(500,{error:"Server not configured: set MS_TENANT_ID, MS_CLIENT_ID and MS_REFRESH_TOKEN."},acao);

  let d={}; try{ d=JSON.parse(raw||"{}"); }catch(e){ return reply(400,{error:"Invalid JSON body"},acao); }
  if(d && typeof d==="object" && d.hp) return reply(200,{ok:true},acao);
  if(!d || typeof d!=="object" || Array.isArray(d)) return reply(400,{error:"Bad payload"},acao);

  const s=v=>String(v==null?"":v).replace(/[\r\n]+/g," ").slice(0,2000);
  const panel=s(d.panel||"test");
  const bodyText=[ "Hearing / Tinnitus test result","--------------------------------",
    "Panel:            "+panel, "Name/label:       "+s(d.tester||"(anonymous)"),
    d.cutoff_hz?"Hearing cutoff:   "+s(d.cutoff_hz):null, d.audiogram?"Hearing profile:  "+s(d.audiogram):null,
    d.tinnitus_hz?"Tinnitus pitch:   "+s(d.tinnitus_hz)+" Hz":null, d.tinnitus_type?"Suggested type:   "+s(d.tinnitus_type):null,
    d.tinnitus_profile?"Tinnitus profile: "+s(d.tinnitus_profile):null,
    "When:             "+s(d.timestamp||new Date().toISOString()), "Device:           "+s(d.device),
    "", "(Screening only — not a clinical diagnosis. Levels are relative, not dB HL.)" ].filter(Boolean).join("\n");
  const subject="Hearing test result ("+panel+")"+(d.tinnitus_hz?" — tinnitus "+s(d.tinnitus_hz)+" Hz":d.cutoff_hz?" — cutoff "+s(d.cutoff_hz):"");

  try{
    const tokenRes=await fetch(`https://login.microsoftonline.com/${encodeURIComponent(MS_TENANT_ID)}/oauth2/v2.0/token`,{
      method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded"},
      body:new URLSearchParams({ client_id:MS_CLIENT_ID, grant_type:"refresh_token", refresh_token:MS_REFRESH_TOKEN, scope:"https://graph.microsoft.com/Mail.Send offline_access" })
    });
    if(!tokenRes.ok){ const t=await tokenRes.text(); return reply(502,{error:"Token refresh failed (token may have expired — re-mint it)",detail:t.slice(0,400)},acao); }
    const token=(await tokenRes.json()).access_token; if(!token) return reply(502,{error:"No access_token returned"},acao);

    const msg={ subject, body:{ contentType:"Text", content:bodyText } };
    if(RESULT_TO) msg.toRecipients=[{ emailAddress:{ address:RESULT_TO } }];
    else msg.toRecipients=[{ emailAddress:{ address:"" } }];   // filled below from /me if RESULT_TO unset
    // If no explicit recipient, send to self: fetch /me to get the address.
    if(!RESULT_TO){
      const meRes=await fetch("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName",{ headers:{ Authorization:"Bearer "+token } });
      const me=meRes.ok?await meRes.json():{}; msg.toRecipients=[{ emailAddress:{ address: me.mail||me.userPrincipalName||"" } }];
    }
    const mailRes=await fetch("https://graph.microsoft.com/v1.0/me/sendMail",{
      method:"POST", headers:{ Authorization:"Bearer "+token, "Content-Type":"application/json" },
      body:JSON.stringify({ message:msg, saveToSentItems:true })
    });
    if(mailRes.status===202) return reply(200,{ok:true},acao);
    const errText=await mailRes.text(); return reply(502,{error:"sendMail failed",status:mailRes.status,detail:errText.slice(0,400)},acao);
  }catch(err){ return reply(500,{error:String(err).slice(0,300)},acao); }
};
