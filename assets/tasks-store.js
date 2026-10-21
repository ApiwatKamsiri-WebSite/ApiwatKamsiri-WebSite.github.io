// ============================================================
//  ที่เก็บข้อมูลงาน — โหลดจาก data/tasks.json และบันทึกกลับเข้า GitHub repo
//  การบันทึกใช้ GitHub token ของเจ้าของเว็บ (เก็บในเบราว์เซอร์ของเจ้าของเท่านั้น)
// ============================================================
(function () {
  const R = window.SITE.repo;
  const API = `https://api.github.com/repos/${R.owner}/${R.name}`;
  const TOKEN_KEY = "gh_token";
  const OFF_KEY = "gh_edit_off";
  const REMEMBER_KEY = "gh_remember";
  const PENDING_KEY = "tasks_pending";
  const DAY = 86400000;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const parse = (d) => { const [y, m, dd] = String(d).split("-").map(Number); return new Date(y, m - 1, dd); };
  const iso = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;

  // utf-8 <-> base64 (ภาษาไทยต้องผ่าน TextEncoder)
  const b64enc = (str) => { const bytes = new TextEncoder().encode(str); let bin = ""; bytes.forEach((b) => (bin += String.fromCharCode(b))); return btoa(bin); };
  const b64dec = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, "")), (c) => c.charCodeAt(0)));

  const store = (kind) => { try { return kind === "local" ? localStorage : sessionStorage; } catch { return null; } };
  const readToken = () => store("session")?.getItem(TOKEN_KEY) || store("local")?.getItem(TOKEN_KEY) || "";

  const S = {
    tasks: [],
    holidays: [],     // [{ date: "YYYY-MM-DD", name: { en, th } }]
    linkGroups: [],   // ลิงก์ทางลัด (กลุ่ม + รายการ)
    updated: "",
    sha: "",
    error: "",
    today, parse, iso, DAY,

    get token() { return readToken(); },
    // โหมดแก้ไขเปิดอยู่ = มี token และไม่ได้กด "เลิกแก้ไข"
    get editing() { return !!readToken() && store("local")?.getItem(OFF_KEY) !== "1"; },
    // มี token ที่จำไว้ในเครื่องนี้ (ติ๊ก "จำไว้ในเครื่องนี้")
    get hasSavedToken() { return !!store("local")?.getItem(TOKEN_KEY); },
    get rememberPref() { return store("local")?.getItem(REMEMBER_KEY) === "1"; },

    setToken(token, remember) {
      store("session")?.setItem(TOKEN_KEY, token);
      if (remember) store("local")?.setItem(TOKEN_KEY, token);
      else store("local")?.removeItem(TOKEN_KEY);
      store("local")?.setItem(REMEMBER_KEY, remember ? "1" : "0");
      store("local")?.removeItem(OFF_KEY);
      document.body.classList.add("editing");
      document.dispatchEvent(new Event("edit:change"));
    },
    // เลิกแก้ไข: ถ้าจำ token ไว้ → เก็บ token ไว้ (กดแก้ไขครั้งหน้าเข้าได้เลย), ถ้าไม่ได้จำ → ลบทิ้ง
    exitEdit() {
      if (S.hasSavedToken) {
        store("local")?.setItem(OFF_KEY, "1");
        document.body.classList.remove("editing");
        document.dispatchEvent(new Event("edit:change"));
      } else S.clearToken();
    },
    resumeEdit() {
      if (!S.hasSavedToken) return false;
      store("local")?.removeItem(OFF_KEY);
      document.body.classList.add("editing");
      document.dispatchEvent(new Event("edit:change"));
      return true;
    },
    clearToken() {
      store("session")?.removeItem(TOKEN_KEY);
      store("local")?.removeItem(TOKEN_KEY);
      store("local")?.removeItem(OFF_KEY);
      S.sha = "";
      document.body.classList.remove("editing");
      document.dispatchEvent(new Event("edit:change"));
    },

    headers(token = readToken()) {
      return { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    },

    // ตรวจว่า token เขียน repo นี้ได้
    async verifyToken(token) {
      const r = await fetch(API, { headers: S.headers(token) });
      if (!r.ok) return false;
      const j = await r.json();
      return !!(j.permissions && j.permissions.push);
    },

    // ---------- โหลด ----------
    async load() {
      S.error = "";
      let data = null;
      if (S.editing) {
        try { data = await loadFromApi(); }
        catch (e) { console.warn("GitHub load failed, fallback to site file", e); }
      }
      if (!data) {
        try {
          const r = await fetch(`${R.tasksPath}?t=${Date.now()}`, { cache: "no-store" });
          if (!r.ok) throw new Error(r.status);
          data = await r.json();
        } catch (e) { S.error = String(e); data = { updated: "", tasks: [] }; }
        // หลังบันทึก เว็บจริงใช้เวลา ~1 นาทีกว่าจะอัปเดต — ระหว่างนั้นใช้สำเนาที่บันทึกล่าสุดในเครื่อง
        try {
          const p = JSON.parse(store("local")?.getItem(PENDING_KEY) || "null");
          if (p && p.updated > (data.updated || "")) data = p;
          else store("local")?.removeItem(PENDING_KEY);
        } catch {}
      }
      S.tasks = Array.isArray(data.tasks) ? data.tasks : [];
      S.holidays = Array.isArray(data.holidays) ? data.holidays : [];
      S.linkGroups = Array.isArray(data.links) ? data.links : [];
      S.updated = data.updated || "";
      document.body.classList.toggle("editing", S.editing);
      document.dispatchEvent(new Event("tasks:change"));
      return S.tasks;
    },

    // ---------- บันทึก (commit เข้า GitHub) ----------
    // part = { tasks? , holidays? , links? } ส่วนที่เปลี่ยน (แทนที่ของเดิมเมื่อบันทึกสำเร็จเท่านั้น)
    async save(part, message) {
      const tasks = part.tasks ?? S.tasks, holidays = part.holidays ?? S.holidays, links = part.links ?? S.linkGroups;
      if (!S.editing) throw new Error("not in edit mode");
      if (!S.sha) await loadFromApi(true);
      const updated = new Date().toISOString();
      const body = JSON.stringify({ updated, tasks, holidays, links }, null, 2) + "\n";
      const r = await fetch(`${API}/contents/${R.tasksPath}`, {
        method: "PUT",
        headers: { ...S.headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ message: message || "Update tasks", content: b64enc(body), sha: S.sha, branch: R.branch }),
      });
      if (r.status === 409 || r.status === 422) {
        await S.load();
        const err = new Error("conflict"); err.conflict = true; throw err;
      }
      if (!r.ok) throw new Error(`${r.status} ${(await r.json().catch(() => ({}))).message || ""}`.trim());
      const j = await r.json();
      S.sha = j.content.sha;
      S.updated = updated;
      S.tasks = tasks; S.holidays = holidays; S.linkGroups = links;
      try { store("local")?.setItem(PENDING_KEY, JSON.stringify({ updated, tasks, holidays, links })); } catch {}
      document.dispatchEvent(new Event("tasks:change"));
    },

    // ---------- helpers ----------
    find(id) { return S.tasks.find((x) => String(x.id) === String(id)); },
    nextId() { return S.tasks.reduce((m, x) => Math.max(m, +x.id || 0), 0) + 1; },

    // ความคืบหน้า %: มีงานย่อย → เฉลี่ยจากงานย่อย, ไม่มี → ใช้ค่าที่ตั้งไว้
    progress(x) {
      const one = (y) => (y.status === "done" ? 100 : Math.max(0, Math.min(100, +y.progress || 0)));
      if (x.subtasks && x.subtasks.length) return Math.round(x.subtasks.reduce((s, y) => s + one(y), 0) / x.subtasks.length);
      return one(x);
    },
    // สถานะที่แสดง: เลยกำหนด (late) คำนวณเอง
    state(x) { return x.status !== "done" && x.due && parse(x.due) < today ? "late" : x.status || "todo"; },
    // ---------- วันหยุด / วันทำงาน (จันทร์–ศุกร์ ไม่นับวันหยุด) ----------
    holidayOn(isoDate) { return S.holidays.find((h) => h.date === isoDate) || null; },
    isOff(dt) { const w = dt.getDay(); return w === 0 || w === 6 || !!S.holidayOn(iso(dt)); },
    workdays(x) {
      const a = parse(x.start || x.due), b = parse(S.endDate(x));
      let n = 0;
      for (const d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) if (!S.isOff(d)) n++;
      return n;
    },
    // path บน server บริษัท เช่น \\server\share\file.xlsx หรือ file://server/share/...
    isNetPath(url) { return /^(\\\\|file:)/i.test(String(url || "").trim()); },
    // แปลงเป็นรูปแบบที่วางใน File Explorer ได้ (\\server\share\...)
    netPath(url) {
      const u = String(url || "").trim();
      if (!/^file:/i.test(u)) return u;
      let p = decodeURIComponent(u.replace(/^file:\/*/i, ""));
      return /^[a-z]:/i.test(p) ? p.replace(/\//g, "\\") : "\\\\" + p.replace(/\//g, "\\");
    },
    // ไฟล์ Office บน server → เปิดด้วยโปรแกรม Office ผ่านลิงก์ ms-excel: / ms-word: / ms-powerpoint:
    officeUri(url) {
      if (!S.isNetPath(url)) return "";
      const path = S.netPath(url);
      const ext = (path.match(/\.([a-z0-9]{2,5})$/i) || [])[1]?.toLowerCase();
      const app = { xlsx: "ms-excel", xls: "ms-excel", xlsm: "ms-excel", xlsb: "ms-excel", csv: "ms-excel",
        docx: "ms-word", doc: "ms-word", docm: "ms-word", pptx: "ms-powerpoint", ppt: "ms-powerpoint", pptm: "ms-powerpoint" }[ext];
      if (!app) return "";
      const fileUrl = /^\\\\/.test(path)
        ? "file://" + path.replace(/^\\+/, "").split("\\").map(encodeURIComponent).join("/")
        : "file:///" + path.split("\\").map((p, i) => (i === 0 ? p : encodeURIComponent(p))).join("/");
      return `${app}:ofe|u|${fileUrl}`;
    },
    // เก็บลิงก์: path server เก็บตามเดิม, เว็บที่ไม่มี http(s) เติม https:// ให้
    normalizeUrl(u) {
      u = String(u || "").trim();
      if (!u || S.isNetPath(u) || /^[a-z][a-z0-9+.-]*:/i.test(u)) return u;
      return "https://" + u;
    },
    // ชื่อเริ่มต้นจากลิงก์: path → ชื่อไฟล์, เว็บ → ชื่อโดเมน
    defaultName(u) {
      u = String(u || "").trim();
      if (S.isNetPath(u)) return S.netPath(u).split("\\").filter(Boolean).pop() || u;
      return u.replace(/^https?:\/\//, "").split(/[/?#]/)[0];
    },
    // ชนิดเอกสารจากลิงก์ (แสดงเป็นป้ายเล็ก)
    linkType(url) {
      const u = String(url || "").toLowerCase();
      const ext = (u.split(/[?#]/)[0].match(/\.([a-z0-9]{2,5})$/) || [])[1];
      if (/sharepoint\.com/.test(u)) return "SharePoint";
      if (/teams\.microsoft|teams\.live/.test(u)) return "Teams";
      if (/onedrive|1drv\.ms/.test(u)) return "OneDrive";
      if (/docs\.google|drive\.google/.test(u)) return "Drive";
      if (/github\.com/.test(u)) return "GitHub";
      if (ext && ["pdf", "xlsx", "xls", "xlsm", "csv", "docx", "doc", "pptx", "ppt", "zip", "txt", "png", "jpg"].includes(ext)) return ext.toUpperCase();
      return S.isNetPath(u) ? "FOLDER" : "LINK";
    },
    links(x) { return Array.isArray(x.links) ? x.links.filter((l) => l && l.url) : []; },
    // วันที่จบที่ใช้วาด: เสร็จแล้วใช้วันเสร็จจริง
    // แผน: วาดแถบ วันเริ่ม → กำหนดเสร็จ เสมอ
    endDate(x) { return x.due; },
    // วันที่เสร็จจริง: มีงานย่อย → วันเสร็จของงานย่อยที่ done ช้าที่สุด, ไม่มี → ช่อง "วันที่เสร็จ"
    finishDate(x) {
      if (x.status !== "done") return "";
      const subs = (x.subtasks || []).filter((s) => s.status === "done" && (s.done || s.due));
      if (subs.length) return subs.map((s) => s.done || s.due).sort().pop();
      return x.done || x.due;
    },
    // เสร็จช้า (+) / เร็ว (−) กว่าแผน กี่วันทำงาน
    variance(x) {
      const f = S.finishDate(x); if (!f || !x.due || f === x.due) return f ? 0 : null;
      const late = f > x.due, a = parse(late ? x.due : f), b = parse(late ? f : x.due);
      let n = 0;
      for (const d = new Date(a.getTime() + DAY); d <= b; d.setDate(d.getDate() + 1)) if (!S.isOff(d)) n++;
      return late ? n : -n;
    },
  };

  async function loadFromApi(shaOnly) {
    const r = await fetch(`${API}/contents/${R.tasksPath}?ref=${R.branch}&t=${Date.now()}`, { headers: S.headers(), cache: "no-store" });
    if (r.status === 401) { S.clearToken(); throw new Error("401"); }
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    S.sha = j.sha;
    return shaOnly ? null : JSON.parse(b64dec(j.content));
  }

  window.TaskStore = S;
})();
