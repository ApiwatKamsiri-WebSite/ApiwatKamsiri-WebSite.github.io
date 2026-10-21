// ============================================================
//  ตัวกลาง Login with GitHub — วางโค้ดนี้ใน Cloudflare Worker
//  (ไฟล์นี้ไม่มีความลับ — รหัสลับตั้งใน Cloudflare: Settings → Variables and Secrets)
//
//  ตัวแปรที่ต้องตั้งใน Cloudflare:
//    CLIENT_ID      (Text)    Client ID ของ GitHub App
//    CLIENT_SECRET  (Secret)  Client secret ของ GitHub App
//    ALLOWED_USER   (Text)    ชื่อผู้ใช้ GitHub ของเจ้าของเว็บ (คนเดียวที่ login ได้)
//    ALLOWED_ORIGIN (Text)    https://apiwatkamsiri-website.github.io
//
//  POST /token    { code }           → แลก code จากหน้า login เป็นสิทธิ์แก้ไข
//  POST /refresh  { refresh_token }  → ต่ออายุสิทธิ์ (สิทธิ์จาก GitHub หมดทุก 8 ชม.)
//  GET  /                            → "ok" (ไว้ทดสอบว่าเปิดได้จากเครือข่ายบริษัท)
// ============================================================
export default {
  async fetch(req, env) {
    const origin = req.headers.get("Origin") || "";
    const allowed = [env.ALLOWED_ORIGIN, "http://localhost:8080"];
    const cors = {
      "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : env.ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method === "GET") return new Response("ok", { headers: cors });
    if (req.method !== "POST" || !allowed.includes(origin)) return json({ error: "forbidden" }, 403, cors);

    const path = new URL(req.url).pathname;
    const body = await req.json().catch(() => ({}));
    let grant;
    if (path === "/token" && body.code) grant = { code: body.code };
    else if (path === "/refresh" && body.refresh_token) grant = { grant_type: "refresh_token", refresh_token: body.refresh_token };
    else return json({ error: "bad_request" }, 400, cors);

    // แลกกับ GitHub (ต้องใช้ client secret จึงต้องทำที่นี่)
    const r = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: env.CLIENT_ID, client_secret: env.CLIENT_SECRET, ...grant }),
    });
    const tok = await r.json().catch(() => ({}));
    if (!tok.access_token) return json({ error: tok.error || "exchange_failed" }, 401, cors);

    // ให้ผ่านเฉพาะบัญชีเจ้าของเว็บ
    const u = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${tok.access_token}`, Accept: "application/vnd.github+json", "User-Agent": "apiwat-site-auth" },
    }).then((x) => x.json()).catch(() => ({}));
    if (!u.login || u.login.toLowerCase() !== String(env.ALLOWED_USER || "").toLowerCase()) {
      return json({ error: "not_allowed" }, 403, cors);
    }

    return json({
      login: u.login,
      access_token: tok.access_token,
      expires_in: tok.expires_in,
      refresh_token: tok.refresh_token,
      refresh_token_expires_in: tok.refresh_token_expires_in,
    }, 200, cors);
  },
};

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), { status, headers: { ...headers, "Content-Type": "application/json" } });
}
