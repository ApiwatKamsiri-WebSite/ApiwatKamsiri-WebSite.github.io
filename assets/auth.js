// ============================================================
//  Login with GitHub (GitHub App + Cloudflare Worker ตัวกลาง)
//  - login เฉพาะตอนกดแก้ไข, จำไว้ 30 วัน (ถ้าไม่กดออกจากระบบ) แล้วออกเอง
//  - กด "ออกจากระบบ" แล้ว login ครั้งถัดไปต้องเห็นหน้า GitHub ให้กดยืนยัน (ไม่ผ่านอัตโนมัติ)
//  - สิทธิ์จาก GitHub หมดทุก ~8 ชม. → ต่ออายุอัตโนมัติผ่าน Worker
//  - ผลการ login ส่งข้ามหน้าต่างผ่าน localStorage (ใช้ได้แม้ popup ถูกตัดการเชื่อมต่อกับหน้าเดิม)
// ============================================================
(function () {
  const A = (window.SITE && window.SITE.auth) || {};
  const SESSION_KEY = "gh_session";
  const STATE_KEY = "gh_oauth_state";
  const RETURN_KEY = "gh_oauth_return";
  const EVENT_KEY = "gh_auth_event";
  const MAX_AGE = 30 * 86400000; // 30 วัน
  const FORCE_KEY = "gh_force_prompt";

  const ls = () => { try { return localStorage; } catch { return null; } };
  const read = () => { try { return JSON.parse(ls()?.getItem(SESSION_KEY) || "null"); } catch { return null; } };
  const write = (s) => ls()?.setItem(SESSION_KEY, JSON.stringify(s));
  const redirectUri = () => location.origin + location.pathname.replace(/[^/]*$/, "") + "auth.html";

  function valid(s = read()) {
    if (!s || !s.access_token) return false;
    const now = Date.now();
    if (now > (s.created_at || 0) + MAX_AGE) return false;
    if (s.refresh_expires_at && now > s.refresh_expires_at) return false;
    if (!s.refresh_token && s.expires_at && now > s.expires_at) return false;
    return true;
  }

  function fromWorker(j, prev) {
    const now = Date.now();
    return {
      login: j.login || prev?.login || "",
      access_token: j.access_token,
      expires_at: j.expires_in ? now + j.expires_in * 1000 : 0,
      refresh_token: j.refresh_token || "",
      refresh_expires_at: j.refresh_token_expires_in ? now + j.refresh_token_expires_in * 1000 : 0,
      created_at: prev?.created_at || now,
    };
  }

  async function call(path, body) {
    const r = await fetch(A.worker.replace(/\/$/, "") + path, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) { const e = new Error(j.error || "HTTP " + r.status); e.code = j.error; throw e; }
    return j;
  }

  let refreshing = null;
  const GHAuth = {
    get enabled() { return !!(A.clientId && A.worker); },
    get session() { return valid() ? read() : null; },
    get login() { return GHAuth.session?.login || ""; },
    valid: () => valid(),
    accessToken: () => (valid() ? read().access_token : ""),

    // สิทธิ์ใกล้หมด (เหลือ < 2 นาที) → ขอใหม่ผ่าน Worker
    async ensureFresh() {
      const s = read();
      if (!valid(s)) { if (s) GHAuth.logout(); return ""; }
      if (!s.expires_at || Date.now() < s.expires_at - 120000) return s.access_token;
      if (!refreshing) {
        refreshing = call("/refresh", { refresh_token: s.refresh_token })
          .then((j) => { const n = fromWorker(j, s); write(n); return n.access_token; })
          .catch((e) => { GHAuth.logout(); throw e; })
          .finally(() => { refreshing = null; });
      }
      return refreshing;
    },

    // เปิดหน้า login ของ GitHub (popup) — redirect: true = เปิดในหน้าเดิมแทน (กรณี popup ถูกบล็อก)
    start({ redirect = false } = {}) {
      const state = crypto.getRandomValues(new Uint32Array(4)).join("-");
      ls()?.setItem(STATE_KEY, state);
      ls()?.setItem(RETURN_KEY, location.href);
      ls()?.removeItem(EVENT_KEY);
      const q = { client_id: A.clientId, redirect_uri: redirectUri(), state };
      // หลังออกจากระบบ: ให้ GitHub ขึ้นหน้าเลือก/ยืนยันบัญชีเสมอ แม้เบราว์เซอร์ยัง login GitHub ค้างอยู่
      if (ls()?.getItem(FORCE_KEY)) q.prompt = "select_account";
      const url = "https://github.com/login/oauth/authorize?" + new URLSearchParams(q);
      if (redirect) { location.href = url; return null; }
      const w = 520, h = 720;
      return window.open(url, "gh-login", `popup=yes,width=${w},height=${h},left=${Math.max(0, (screen.width - w) / 2)},top=${Math.max(0, (screen.height - h) / 2)}`);
    },

    // ใช้ในหน้า auth.html: แลก code → เก็บ session → แจ้งหน้าเดิม
    async finish(params) {
      const code = params.get("code"), state = params.get("state"), err = params.get("error");
      let result;
      try {
        if (err) throw Object.assign(new Error(err), { code: err });
        if (!code || state !== ls()?.getItem(STATE_KEY)) throw Object.assign(new Error("state"), { code: "state" });
        const j = await call("/token", { code });
        const s = fromWorker(j, null);
        write(s);
        ls()?.removeItem("gh_edit_off");
        ls()?.removeItem(FORCE_KEY);
        result = { ok: true, login: s.login, t: Date.now() };
      } catch (e) {
        result = { ok: false, error: e.code || e.message, t: Date.now() };
      }
      ls()?.removeItem(STATE_KEY);
      ls()?.setItem(EVENT_KEY, JSON.stringify(result));
      return { ...result, returnTo: ls()?.getItem(RETURN_KEY) || "index.html" };
    },

    logout() { ls()?.removeItem(SESSION_KEY); },
    // ออกจากระบบโดยผู้ใช้ → ครั้งหน้าต้องยืนยันที่หน้า GitHub
    signOut() { ls()?.removeItem(SESSION_KEY); ls()?.setItem(FORCE_KEY, "1"); },

    // หน้าเดิมรอผล login จาก popup
    onResult(fn) {
      addEventListener("storage", (e) => {
        if (e.key !== EVENT_KEY || !e.newValue) return;
        try { fn(JSON.parse(e.newValue)); } catch {}
      });
    },
  };
  window.GHAuth = GHAuth;
})();
