// ============================================================
//  ตัวแก้ไขงานบนเว็บ: ปลดล็อกด้วย GitHub token, ฟอร์มเพิ่ม/แก้ไขงาน + งานย่อย
// ============================================================
(function () {
  const TS = window.TaskStore;
  const I = window.I18N;
  const t = (k, v) => I.t(k, v);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const TOKEN_HELP = "https://github.com/settings/personal-access-tokens/new";
  const CLIP = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/></svg>';

  // ---------- โครง modal + toast ----------
  const back = document.createElement("div");
  back.className = "modal-back hidden";
  back.innerHTML = `<div class="modal card" role="dialog" aria-modal="true"></div>`;
  const toastEl = document.createElement("div");
  toastEl.className = "toast";
  document.body.append(back, toastEl);
  const box = back.firstElementChild;
  let mode = null; // "unlock" | "task"

  function show(html) { box.innerHTML = html; back.classList.remove("hidden"); document.body.classList.add("modal-open"); }
  function close() { icMenu?.classList.add("hidden"); back.classList.add("hidden"); document.body.classList.remove("modal-open"); mode = null; box.innerHTML = ""; }
  back.addEventListener("mousedown", (e) => { if (e.target === back) close(); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && mode) close(); });

  let toastTimer = 0;
  function toast(msg, kind = "ok") {
    toastEl.textContent = msg;
    toastEl.className = `toast show ${kind}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toastEl.className = "toast"), kind === "err" ? 6000 : 3500);
  }

  // ---------- ปลดล็อกโหมดแก้ไข ----------
  function openUnlock() {
    mode = "unlock";
    show(`
      <div class="modal-head"><h3>${t("unlock.title")}</h3><button class="icon-btn" data-close aria-label="${t("common.close")}">✕</button></div>
      <p class="modal-desc">${t("unlock.desc")}</p>
      <a class="modal-link" href="${TOKEN_HELP}" target="_blank" rel="noopener">${t("unlock.how")}</a>
      <form id="unlock-form" class="form">
        <label class="fld"><span>${t("unlock.token")}</span><input id="unlock-token" type="password" autocomplete="off" spellcheck="false" required placeholder="github_pat_…"></label>
        <label class="chk"><input id="unlock-remember" type="checkbox" ${TS.rememberPref ? "checked" : ""}> ${t("unlock.remember")}</label>
        <div class="msg" id="unlock-msg"></div>
        <div class="modal-foot"><button type="button" class="btn" data-close>${t("common.cancel")}</button><button class="btn primary" type="submit">${t("unlock.go")}</button></div>
      </form>`);
    box.querySelector("#unlock-token").focus();
    box.querySelector("#unlock-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const token = box.querySelector("#unlock-token").value.trim();
      const msg = box.querySelector("#unlock-msg");
      msg.className = "msg info"; msg.textContent = t("unlock.checking");
      let ok = false;
      try { ok = await TS.verifyToken(token); } catch {}
      if (!ok) { msg.className = "msg err"; msg.textContent = t("unlock.bad"); return; }
      TS.setToken(token, box.querySelector("#unlock-remember").checked);
      close();
      await TS.load();
      const fn = afterUnlock; afterUnlock = null;
      if (fn) fn();
    });
  }

  function toggleEdit() {
    if (TS.editing) { TS.exitEdit(); TS.load(); }
    else ensureEdit(() => toast(t("edit.on"), "ok"));
  }
  // เข้าโหมดแก้ไข: login อยู่แล้ว / จำ token ไว้ → เข้าได้เลย, ไม่มี → Login with GitHub (สำรอง: token)
  async function ensureEdit(then) {
    if (TS.editing) return then && then();
    if (TS.resumeEdit()) { await TS.load(); if (TS.editing && then) then(); return; }
    afterUnlock = then || null;
    if (window.GHAuth && GHAuth.enabled) openSignIn(); else openUnlock();
  }

  // ---------- Login with GitHub ----------
  function openSignIn() {
    mode = "signin";
    const popup = GHAuth.start();   // เปิดจากการกดปุ่มโดยตรง เบราว์เซอร์จึงไม่บล็อก popup
    show(`
      <div class="modal-head"><h3>${t("auth.title")}</h3><button class="icon-btn" data-close aria-label="${t("common.close")}">✕</button></div>
      <div class="signin-wait">
        <div class="spin-sm ${popup ? "" : "stop"}"></div>
        <p class="modal-desc" id="signin-msg">${t(popup ? "auth.waiting" : "auth.blocked")}</p>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn sm" id="use-token">${t("auth.useToken")}</button>
        <span class="grow"></span>
        <button type="button" class="btn primary" id="signin-here">${t(popup ? "auth.retry" : "auth.signinHere")}</button>
      </div>`);
    box.querySelector("#use-token").addEventListener("click", () => openUnlock());
    box.querySelector("#signin-here").addEventListener("click", () => (popup ? openSignIn() : GHAuth.start({ redirect: true })));
  }
  if (window.GHAuth) GHAuth.onResult(async (r) => {
    const msg = box.querySelector("#signin-msg");
    if (!r.ok) {
      const text = r.error === "not_allowed" ? t("auth.notAllowed") : t("auth.failed", { e: r.error });
      if (mode === "signin" && msg) { msg.textContent = text; msg.classList.add("err"); box.querySelector(".spin-sm")?.classList.add("stop"); }
      else toast(text, "err");
      return;
    }
    // ตรวจสิทธิ์เขียน repo อีกชั้น
    let ok = false;
    try { ok = await TS.verifyToken(await GHAuth.ensureFresh()); } catch {}
    if (!ok) {
      GHAuth.logout();
      const text = t("auth.noPush", { u: r.login });
      if (mode === "signin" && msg) { msg.textContent = text; msg.classList.add("err"); box.querySelector(".spin-sm")?.classList.add("stop"); }
      else toast(text, "err");
      return;
    }
    TS.resumeEdit();
    if (mode === "signin") close();
    await TS.load();
    toast(t("auth.signedIn", { u: r.login }), "ok");
    const fn = afterUnlock; afterUnlock = null;
    if (fn) fn();
  });
  let afterUnlock = null;
  // ออกจากระบบ: ลบการ login ทั้งหมดในเครื่องนี้ (ไม่สนเวลาที่เหลือ) และครั้งหน้าต้องยืนยันที่ GitHub
  function forgetToken() { window.GHAuth?.signOut(); TS.clearToken(); TS.load(); toast(t("auth.loggedOut"), "ok"); }

  // ---------- ฟอร์มงาน ----------
  let draft = null, editingId = null;
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const nameOf = (v, lang) => (v && typeof v === "object" ? v[lang] || "" : lang === "en" ? v || "" : v || "");
  const statusOpts = (cur) => ["todo", "doing", "done"].map((s) => `<option value="${s}" ${cur === s ? "selected" : ""}>${t("status." + s)}</option>`).join("");

  function openTask(id) {
    const src = id != null ? TS.find(id) : null;
    editingId = src ? src.id : null;
    const d0 = TS.iso(TS.today);
    draft = src ? clone(src) : { id: TS.nextId(), name: "", project: "", status: "todo", start: d0, due: d0, subtasks: [] };
    draft.subtasks = draft.subtasks || [];
    mode = "task";
    renderTask();
  }

  // ---------- ช่อง URL: ปุ่มเลือก Web (เติม https://) / Server (เติม \\) ----------
  function splitUrl(url) {
    const u = String(url || "").trim();
    if (TS.isNetPath(u)) return { kind: "net", pre: "\\\\", rest: TS.netPath(u).replace(/^\\+/, "") };
    const m = u.match(/^(https?:\/\/)/i);
    return { kind: "web", pre: m ? m[1].toLowerCase() : "https://", rest: m ? u.slice(m[1].length) : u };
  }
  function urlField(url, attr) {
    const p = splitUrl(url);
    return `<div class="url-field" data-kind="${p.kind}" data-pre="${esc(p.pre)}">
      <div class="url-kind" role="group">
        <button type="button" data-kind="web" class="${p.kind === "web" ? "on" : ""}">${t("kind.web")}</button>
        <button type="button" data-kind="net" class="${p.kind === "net" ? "on" : ""}">${t("kind.net")}</button>
      </div>
      <span class="url-pre">${esc(p.pre)}</span>
      <input ${attr} value="${esc(p.rest)}" placeholder="${p.kind === "net" ? "server\\folder\\file.xlsx" : "example.com/…"}" inputmode="url" spellcheck="false">
    </div>`;
  }
  function setKind(f, kind, pre) {
    f.dataset.kind = kind;
    f.dataset.pre = pre || (kind === "net" ? "\\\\" : "https://");
    f.querySelector(".url-pre").textContent = f.dataset.pre;
    f.querySelectorAll(".url-kind button").forEach((b) => b.classList.toggle("on", b.dataset.kind === kind));
    f.querySelector("input").placeholder = kind === "net" ? "server\\folder\\file.xlsx" : "example.com/…";
  }
  function readUrl(f) {
    const rest = f.querySelector("input").value.trim();
    if (!rest) return "";
    return f.dataset.kind === "net" ? "\\\\" + rest.replace(/^\\+/, "") : f.dataset.pre + rest.replace(/^https?:\/\//i, "");
  }
  // กดปุ่มเลือกชนิด
  box.addEventListener("click", (e) => {
    const b = e.target.closest(".url-kind button"); if (!b) return;
    const f = b.closest(".url-field"); setKind(f, b.dataset.kind); f.querySelector("input").focus();
  });
  // วางลิงก์เต็มมา (มี https:// หรือ \\ หรือ file://) → เลือกชนิดให้และตัดส่วนหน้าออก
  box.addEventListener("input", (e) => {
    const f = e.target.closest(".url-field"); if (!f || e.target.tagName !== "INPUT") return;
    const v = e.target.value.trim();
    if (TS.isNetPath(v)) { setKind(f, "net"); e.target.value = TS.netPath(v).replace(/^\\+/, ""); }
    else { const m = v.match(/^(https?:\/\/)/i); if (m) { setKind(f, "web", m[1].toLowerCase()); e.target.value = v.slice(m[1].length); } }
  });

  // แถวลิงก์เอกสาร (scope = "t" ของหัวข้อใหญ่ หรือเลข index ของงานย่อย)
  function linkRows(links, scope) {
    return (links || []).map((l, j) => `
      <div class="link-row" data-scope="${scope}" data-li="${j}">
        <span class="link-ico">${CLIP}</span>
        <input data-l="name" value="${esc(l.name || "")}" placeholder="${t("ed.linkName")}">
        ${urlField(l.url, 'data-l="url"')}
        <button type="button" class="icon-btn sm" data-del-link="${scope}:${j}" aria-label="${t("ed.remove")}" title="${t("ed.remove")}">✕</button>
      </div>`).join("");
  }

  function subRow(s, i) {
    return `
      <div class="sub-row" data-i="${i}">
        <div class="sub-names">
          <input data-f="nameEn" value="${esc(nameOf(s.name, "en"))}" placeholder="${t("ed.subName")} (EN)">
          <input data-f="nameTh" value="${esc(nameOf(s.name, "th"))}" placeholder="${t("ed.subName")} (TH)">
        </div>
        <div class="sub-meta">
          <select data-f="status">${statusOpts(s.status)}</select>
          <input data-f="start" type="date" value="${esc(s.start || "")}" aria-label="${t("ed.start")}">
          <input data-f="due" type="date" value="${esc(s.due || "")}" aria-label="${t("ed.due")}">
          <span class="sub-pct"><input data-f="progress" type="number" min="0" max="100" value="${s.status === "done" ? 100 : +s.progress || 0}" ${s.status === "done" ? "disabled" : ""}>%</span>
          <button type="button" class="icon-btn sm" data-add-link="${i}" aria-label="${t("ed.addLink")}" title="${t("ed.addLink")}">${CLIP}</button>
          <button type="button" class="icon-btn sm" data-del-sub="${i}" aria-label="${t("ed.remove")}" title="${t("ed.remove")}">✕</button>
        </div>
        <div class="links">${linkRows(s.links, i)}</div>
      </div>`;
  }

  function renderTask() {
    const d = draft, hasSubs = d.subtasks.length > 0;
    const pct = TS.progress(d);
    show(`
      <div class="modal-head"><h3>${t(editingId != null ? "ed.edit" : "ed.new")}</h3><button class="icon-btn" data-close aria-label="${t("common.close")}">✕</button></div>
      <form id="task-form" class="form" novalidate>
        <div class="grid2">
          <label class="fld"><span>${t("ed.nameEn")}</span><input data-f="nameEn" value="${esc(nameOf(d.name, "en"))}"></label>
          <label class="fld"><span>${t("ed.nameTh")}</span><input data-f="nameTh" value="${esc(nameOf(d.name, "th"))}"></label>
        </div>
        <div class="hint">${t("ed.nameHint")}</div>
        <div class="grid4">
          <label class="fld"><span>${t("ed.project")}</span><input data-f="project" value="${esc(d.project || "")}" placeholder="bona"></label>
          <label class="fld"><span>${t("ed.status")}</span><select data-f="status">${statusOpts(d.status)}</select></label>
          <label class="fld"><span>${t("ed.start")}</span><input data-f="start" type="date" value="${esc(d.start || "")}"></label>
          <label class="fld"><span>${t("ed.due")}</span><input data-f="due" type="date" value="${esc(d.due || "")}"></label>
        </div>
        <div class="grid2">
          <label class="fld ${d.status === "done" ? "" : "hidden"}" id="fld-done"><span>${t("ed.done")}${subDone(d) ? ` <em>(${t("ed.fromSubs")})</em>` : ""}</span><input data-f="done" type="date" value="${esc(subDone(d) || d.done || "")}" ${subDone(d) ? "disabled" : ""}></label>
          <label class="fld"><span>${t("ed.progress")} — <b id="pct-out">${pct}%</b> ${hasSubs ? `<em>(${t("ed.auto")})</em>` : ""}</span>
            <input data-f="progress" type="range" min="0" max="100" step="5" value="${pct}" ${hasSubs || d.status === "done" ? "disabled" : ""}></label>
        </div>
        <div class="grid2">
          <label class="fld"><span>${t("ed.descEn")}</span><textarea data-f="descEn" rows="2">${esc(nameOf(d.desc, "en"))}</textarea></label>
          <label class="fld"><span>${t("ed.descTh")}</span><textarea data-f="descTh" rows="2">${esc(nameOf(d.desc, "th"))}</textarea></label>
        </div>

        <div class="sub-head"><b>${t("ed.docs")}</b><button type="button" class="btn sm" data-add-link="t">${t("ed.addLink")}</button></div>
        <div class="links">${(d.links || []).length ? linkRows(d.links, "t") : `<div class="hint">${t("doc.none")}</div>`}</div>

        <div class="sub-head"><b>${t("ed.subtasks")}</b><button type="button" class="btn sm" id="add-sub">${t("ed.addSub")}</button></div>
        <div class="subs">${hasSubs ? d.subtasks.map(subRow).join("") : `<div class="hint">${t("ed.noSub")}</div>`}</div>

        <div class="msg" id="task-msg"></div>
        <div class="modal-foot">
          ${editingId != null ? `<button type="button" class="btn danger" id="del-task">${t("common.delete")}</button>` : ""}
          <span class="grow"></span>
          <button type="button" class="btn" data-close>${t("common.cancel")}</button>
          <button class="btn primary" type="submit" id="save-task">${t("common.save")}</button>
        </div>
      </form>`);

    const form = box.querySelector("#task-form");
    form.addEventListener("input", (e) => {
      collect();
      if (e.target.dataset.f === "status") renderKeepScroll(); // เปลี่ยนสถานะ → อัปเดตช่องที่เกี่ยวข้อง
      else {
        const p = TS.progress(draft);
        box.querySelector("#pct-out").textContent = p + "%";
        const range = box.querySelector('input[type=range][data-f="progress"]');
        if (range.disabled) range.value = p;
      }
    });
    box.querySelector("#add-sub").addEventListener("click", () => {
      collect();
      const last = draft.subtasks[draft.subtasks.length - 1];
      draft.subtasks.push({ id: `${draft.id}.${draft.subtasks.length + 1}`, name: "", status: "todo", start: last ? last.due : draft.start, due: draft.due });
      renderKeepScroll();
      const rows = box.querySelectorAll(".sub-row"); rows[rows.length - 1]?.querySelector("input")?.focus();
    });
    box.querySelectorAll("[data-del-sub]").forEach((b) => b.addEventListener("click", () => {
      collect(); draft.subtasks.splice(+b.dataset.delSub, 1); renderKeepScroll();
    }));
    box.querySelector("#del-task")?.addEventListener("click", async () => {
      if (!confirm(t("ed.confirmDel"))) return;
      await commit(TS.tasks.filter((x) => String(x.id) !== String(editingId)), `Delete task ${editingId}`);
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      collect();
      const err = validate();
      if (err) { const m = box.querySelector("#task-msg"); m.className = "msg err"; m.textContent = err; return; }
      const clean = finalize(draft);
      const list = editingId != null ? TS.tasks.map((x) => (String(x.id) === String(editingId) ? clean : x)) : [...TS.tasks, clean];
      await commit(list, `${editingId != null ? "Update" : "Add"} task: ${clean.name.en}`);
    });
  }

  // วันเสร็จของงานย่อยที่ done ช้าที่สุด (ถ้ามี)
  const subDone = (d) => (d.subtasks || []).filter((s) => s.status === "done").map((s) => s.due).filter(Boolean).sort().pop() || "";

  function renderKeepScroll() { const y = box.scrollTop; renderTask(); box.scrollTop = y; }

  // อ่านค่าจากฟอร์มเข้า draft
  function collect() {
    const top = (k) => { const el = [...box.querySelectorAll(`[data-f="${k}"]`)].find((x) => !x.closest(".sub-row")); return el ? el.value : ""; };
    draft.name = { en: top("nameEn").trim(), th: top("nameTh").trim() };
    draft.project = top("project").trim();
    draft.status = top("status");
    draft.start = top("start");
    draft.due = top("due");
    draft.done = top("done");
    draft.progress = +top("progress") || 0;
    draft.desc = { en: top("descEn").trim(), th: top("descTh").trim() };
    box.querySelectorAll(".sub-row").forEach((row) => {
      const s = draft.subtasks[+row.dataset.i];
      const v = (k) => row.querySelector(`[data-f="${k}"]`).value;
      s.name = { en: v("nameEn").trim(), th: v("nameTh").trim() };
      s.status = v("status"); s.start = v("start"); s.due = v("due");
      s.progress = Math.max(0, Math.min(100, +v("progress") || 0));
      // งานย่อยไม่มีช่องวันที่เสร็จ → เสร็จ = วันสุดท้ายที่เลือก (กำหนดเสร็จ) เสมอ
      if (s.status === "done") s.done = s.due;
      if (s.status !== "done") delete s.done;
    });
    // ลิงก์เอกสาร
    const read = (scope) => [...box.querySelectorAll(`.link-row[data-scope="${scope}"]`)].map((r) => ({
      name: r.querySelector('[data-l="name"]').value.trim(), url: readUrl(r.querySelector(".url-field")) }));
    draft.links = read("t");
    draft.subtasks.forEach((s, i) => (s.links = read(String(i))));
    // หัวข้อใหญ่: ค่าเริ่มต้นของ "วันที่เสร็จ" = วันกำหนดเสร็จที่เลือก (แก้เองได้ในช่องวันที่เสร็จ)
    if (draft.status === "done" && !draft.done) draft.done = draft.due;
  }

  function validate() {
    if (!draft.name.en && !draft.name.th) return t("ed.errName");
    const bad = (x) => !x.start || !x.due || x.due < x.start;
    if (bad(draft) || draft.subtasks.some((s) => (s.name.en || s.name.th) && bad(s))) return t("ed.errDate");
    return "";
  }

  // จัดรูปข้อมูลก่อนบันทึก: ภาษาที่ว่างใช้ข้อความของอีกภาษา
  function finalize(d) {
    const two = (v) => ({ en: v.en || v.th, th: v.th || v.en });
    const out = { id: d.id, name: two(d.name), project: d.project, status: d.status, start: d.start, due: d.due };
    if (d.status === "done") out.done = subDone(d) || d.done;
    if (!d.subtasks.length && d.status !== "done" && d.progress) out.progress = d.progress;
    if (d.desc.en || d.desc.th) out.desc = two(d.desc);
    const cleanLinks = (ls) => (ls || []).filter((l) => l.url).map((l) => ({
      name: l.name || TS.defaultName(l.url), url: TS.normalizeUrl(l.url) }));
    if (cleanLinks(d.links).length) out.links = cleanLinks(d.links);
    out.subtasks = d.subtasks.filter((s) => s.name.en || s.name.th).map((s, i) => {
      const o = { id: `${d.id}.${i + 1}`, name: two(s.name), status: s.status, start: s.start, due: s.due };
      if (s.status === "done") o.done = s.done; else if (s.progress) o.progress = s.progress;
      if (cleanLinks(s.links).length) o.links = cleanLinks(s.links);
      return o;
    });
    return out;
  }

  async function commit(list, message) {
    const btns = box.querySelectorAll("button");
    btns.forEach((b) => (b.disabled = true));
    toast(t("save.saving"), "info");
    try {
      await TS.save(Array.isArray(list) ? { tasks: list } : list, message);
      close();
      toast(t("save.ok"), "ok");
    } catch (e) {
      btns.forEach((b) => (b.disabled = false));
      if (e.conflict) { close(); toast(t("save.conflict"), "err"); }
      else toast(t("save.fail", { e: e.message }), "err");
    }
  }

  // ================= วันหยุด =================
  let hdraft = null;
  function openHolidays() {
    mode = "holidays";
    hdraft = clone(TS.holidays || []).sort((a, b) => (a.date < b.date ? -1 : 1));
    renderHolidays();
  }
  function renderHolidays() {
    const ed = TS.editing;
    const fmtD = (d) => TS.parse(d).toLocaleDateString(I.lang === "th" ? "th-TH" : "en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    show(`
      <div class="modal-head"><h3>${t("hol.title")}</h3><button class="icon-btn" data-close aria-label="${t("common.close")}">✕</button></div>
      <p class="modal-desc">${t("hol.desc")}</p>
      <form id="hol-form" class="form" novalidate>
        <div class="hol-list">${hdraft.length ? hdraft.map((h, i) => ed ? `
          <div class="hol-row" data-i="${i}">
            <input data-h="date" type="date" value="${esc(h.date)}" aria-label="${t("hol.date")}">
            <input data-h="en" value="${esc(nameOf(h.name, "en"))}" placeholder="${t("hol.nameEn")}">
            <input data-h="th" value="${esc(nameOf(h.name, "th"))}" placeholder="${t("hol.nameTh")}">
            <button type="button" class="icon-btn sm" data-del-hol="${i}" aria-label="${t("ed.remove")}">✕</button>
          </div>` : `
          <div class="hol-view"><span class="hol-date">${esc(fmtD(h.date))}</span><span>${esc(I.L(h.name))}</span></div>`).join("")
          : `<div class="hint">${t("hol.none")}</div>`}</div>
        <div class="msg" id="hol-msg"></div>
        <div class="modal-foot">
          ${ed ? `<button type="button" class="btn sm" id="add-hol">${t("hol.add")}</button><span class="grow"></span>
                  <button type="button" class="btn" data-close>${t("common.cancel")}</button>
                  <button class="btn primary" type="submit">${t("common.save")}</button>`
               : `<span class="hint">${t("hol.viewOnly")}</span><span class="grow"></span><button type="button" class="btn" id="hol-unlock">${t("edit.enter")}</button>`}
        </div>
      </form>`);
    box.querySelector("#add-hol")?.addEventListener("click", () => {
      collectHol(); hdraft.push({ date: TS.iso(TS.today), name: { en: "", th: "" } }); renderHolidays();
      const rows = box.querySelectorAll(".hol-row"); rows[rows.length - 1]?.querySelector('[data-h="en"]')?.focus();
    });
    box.querySelectorAll("[data-del-hol]").forEach((b) => b.addEventListener("click", () => { collectHol(); hdraft.splice(+b.dataset.delHol, 1); renderHolidays(); }));
    box.querySelector("#hol-unlock")?.addEventListener("click", () => ensureEdit(openHolidays));
    box.querySelector("#hol-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      collectHol();
      const two = (v) => ({ en: v.en || v.th, th: v.th || v.en });
      const list = hdraft.filter((h) => h.date).map((h) => ({ date: h.date, name: two(h.name) }))
        .sort((a, b) => (a.date < b.date ? -1 : 1));
      await commit({ holidays: list }, "Update holidays");
    });
  }
  function collectHol() {
    box.querySelectorAll(".hol-row").forEach((r) => {
      const h = hdraft[+r.dataset.i];
      h.date = r.querySelector('[data-h="date"]').value;
      h.name = { en: r.querySelector('[data-h="en"]').value.trim(), th: r.querySelector('[data-h="th"]').value.trim() };
    });
  }

  // ================= ลิงก์ทางลัด =================
  // ปุ่มเลือกไอคอน: แสดงไอคอนปัจจุบัน กดแล้วเปิดตารางไอคอน
  const iconPick = (attr, cur) => `<span class="ic-pick"><input type="hidden" ${attr} value="${esc(cur || "auto")}">
      <button type="button" class="ic-btn" title="${esc(t("icon." + (cur || "auto")))}" aria-label="${t("le.icon")}">${window.ICONS.raw(cur || "auto", 18)}<b>▾</b></button></span>`;
  const icMenu = document.createElement("div");
  icMenu.className = "ic-menu card hidden";
  document.body.appendChild(icMenu);
  let icTarget = null;
  function openIconMenu(btn) {
    icTarget = btn.closest(".ic-pick");
    const cur = icTarget.querySelector("input").value;
    icMenu.innerHTML = window.ICONS.LIST.map((k) =>
      `<button type="button" data-ic="${k}" class="${k === cur ? "on" : ""}" title="${esc(t("icon." + k))}" aria-label="${esc(t("icon." + k))}">${window.ICONS.raw(k, 18)}</button>`).join("");
    icMenu.classList.remove("hidden");
    const r = btn.getBoundingClientRect(), w = icMenu.offsetWidth, h = icMenu.offsetHeight;
    icMenu.style.left = Math.min(Math.max(8, r.left), innerWidth - w - 8) + "px";
    icMenu.style.top = (r.bottom + h + 8 > innerHeight ? Math.max(8, r.top - h - 6) : r.bottom + 6) + "px";
  }
  const closeIconMenu = () => { icMenu.classList.add("hidden"); icTarget = null; };
  icMenu.addEventListener("click", (e) => {
    const b = e.target.closest("[data-ic]"); if (!b || !icTarget) return;
    const k = b.dataset.ic;
    icTarget.querySelector("input").value = k;
    const btn = icTarget.querySelector(".ic-btn");
    btn.innerHTML = `${window.ICONS.raw(k, 18)}<b>▾</b>`;
    btn.title = t("icon." + k);
    closeIconMenu();
  });
  document.addEventListener("mousedown", (e) => { if (!icMenu.contains(e.target) && !e.target.closest(".ic-btn")) closeIconMenu(); });
  box.addEventListener("click", (e) => { const b = e.target.closest(".ic-btn"); if (b) { icTarget && icTarget === b.closest(".ic-pick") ? closeIconMenu() : openIconMenu(b); } });
  box.addEventListener("scroll", closeIconMenu);
  let ldraft = null;
  function openLinks() {
    mode = "links";
    ldraft = clone(TS.linkGroups || []);
    renderLinksEditor();
  }
  function renderLinksEditor() {
    show(`
      <div class="modal-head"><h3>${t("le.title")}</h3><button class="icon-btn" data-close aria-label="${t("common.close")}">✕</button></div>
      <form id="links-form" class="form" novalidate>
        ${ldraft.map((g, gi) => `
        <div class="le-group" data-g="${gi}">
          <div class="le-order">
            <span class="le-num">${t("le.groupNo", { n: gi + 1 })}</span>
            <button type="button" class="icon-btn sm" data-move-group="${gi}:-1" ${gi === 0 ? "disabled" : ""} title="${t("le.up")}" aria-label="${t("le.up")}">↑</button>
            <button type="button" class="icon-btn sm" data-move-group="${gi}:1" ${gi === ldraft.length - 1 ? "disabled" : ""} title="${t("le.down")}" aria-label="${t("le.down")}">↓</button>
          </div>
          <div class="grid2">
            <label class="fld"><span>${t("le.groupEn")}</span><input data-gf="en" value="${esc(nameOf(g.title, "en"))}"></label>
            <label class="fld"><span>${t("le.groupTh")}</span><input data-gf="th" value="${esc(nameOf(g.title, "th"))}"></label>
          </div>
          <div class="le-opts">
            <label class="fld"><span>${t("le.icon")}</span>${iconPick('data-gf="icon"', g.icon || "dir")}</label>
            <label class="chk"><input type="checkbox" data-gf="member" ${g.member ? "checked" : ""}> ${t("le.member")}</label>
            <span class="grow"></span>
            <button type="button" class="btn sm danger" data-del-group="${gi}">${t("le.delGroup")}</button>
          </div>
          <div class="le-items">${(g.items || []).map((x, ii) => `
            <div class="le-item" data-i="${ii}">
              ${iconPick('data-if="icon"', x.icon || "auto")}
              <input data-if="name" value="${esc(nameOf(x.name, "en"))}" placeholder="${t("le.name")}">
              ${urlField(x.url, 'data-if="url"')}
              <span class="mv">
                <button type="button" data-move-item="${gi}:${ii}:-1" ${ii === 0 ? "disabled" : ""} title="${t("le.up")}" aria-label="${t("le.up")}">▲</button>
                <button type="button" data-move-item="${gi}:${ii}:1" ${ii === g.items.length - 1 ? "disabled" : ""} title="${t("le.down")}" aria-label="${t("le.down")}">▼</button>
              </span>
              <button type="button" class="icon-btn sm" data-del-item="${gi}:${ii}" aria-label="${t("ed.remove")}">✕</button>
            </div>`).join("")}
          </div>
          <button type="button" class="btn sm" data-add-item="${gi}">${t("ed.addLink")}</button>
        </div>`).join("")}
        <button type="button" class="btn sm" id="add-group">${t("le.addGroup")}</button>
        <div class="msg" id="links-msg"></div>
        <div class="modal-foot">
          <span class="grow"></span>
          <button type="button" class="btn" data-close>${t("common.cancel")}</button>
          <button class="btn primary" type="submit">${t("common.save")}</button>
        </div>
      </form>`);
    const keep = (fn) => () => { collectLinks(); fn(); const y = box.scrollTop; renderLinksEditor(); box.scrollTop = y; };
    box.querySelectorAll("[data-add-item]").forEach((b) => b.addEventListener("click", keep(() => {
      const g = ldraft[+b.dataset.addItem]; (g.items = g.items || []).push({ name: "", icon: "auto", url: "" });
    })));
    box.querySelectorAll("[data-del-item]").forEach((b) => b.addEventListener("click", keep(() => {
      const [gi, ii] = b.dataset.delItem.split(":"); ldraft[+gi].items.splice(+ii, 1);
    })));
    // เปลี่ยนลำดับกลุ่ม / ลิงก์
    const swap = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; };
    box.querySelectorAll("[data-move-group]").forEach((b) => b.addEventListener("click", keep(() => {
      const [gi, d] = b.dataset.moveGroup.split(":").map(Number); swap(ldraft, gi, d);
    })));
    box.querySelectorAll("[data-move-item]").forEach((b) => b.addEventListener("click", keep(() => {
      const [gi, ii, d] = b.dataset.moveItem.split(":").map(Number); swap(ldraft[gi].items, ii, d);
    })));
    box.querySelectorAll("[data-del-group]").forEach((b) => b.addEventListener("click", keep(() => {
      if (confirm(t("le.confirmDel"))) ldraft.splice(+b.dataset.delGroup, 1);
    })));
    box.querySelector("#add-group").addEventListener("click", keep(() => {
      ldraft.push({ title: { en: "", th: "" }, icon: "dir", items: [{ name: "", icon: "auto", url: "" }] });
    }));
    box.querySelector("#links-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      collectLinks();
      const two = (v) => ({ en: v.en || v.th, th: v.th || v.en });
      const fix = (u) => TS.normalizeUrl(u);
      const groups = ldraft.filter((g) => g.title.en || g.title.th).map((g) => {
        const o = { title: two(g.title), icon: g.icon, items: (g.items || []).filter((x) => x.name || x.url)
          .map((x) => ({ name: x.name || x.url, icon: x.icon, url: fix(x.url) })) };
        if (g.member) o.member = true;
        return o;
      });
      await commit({ links: groups }, "Update quick links");
    });
  }
  function collectLinks() {
    box.querySelectorAll(".le-group").forEach((el) => {
      const g = ldraft[+el.dataset.g];
      const gv = (k) => el.querySelector(`[data-gf="${k}"]`);
      g.title = { en: gv("en").value.trim(), th: gv("th").value.trim() };
      g.icon = gv("icon").value;
      g.member = gv("member").checked;
      el.querySelectorAll(".le-item").forEach((r) => {
        const x = g.items[+r.dataset.i];
        x.icon = r.querySelector('[data-if="icon"]').value;
        x.name = r.querySelector('[data-if="name"]').value.trim();
        x.url = readUrl(r.querySelector(".url-field"));
      });
    });
  }

  box.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) return close();
    if (mode !== "task") return;
    const add = e.target.closest("[data-add-link]");
    if (add) {
      collect();
      const sc = add.dataset.addLink, list = sc === "t" ? (draft.links = draft.links || []) : draft.subtasks[+sc].links;
      list.push({ name: "", url: "" });
      renderKeepScroll();
      const rows = box.querySelectorAll(`.link-row[data-scope="${sc}"]`);
      rows[rows.length - 1]?.querySelector("input")?.focus();
      return;
    }
    const del = e.target.closest("[data-del-link]");
    if (del) {
      collect();
      const [sc, j] = del.dataset.delLink.split(":");
      (sc === "t" ? draft.links : draft.subtasks[+sc].links).splice(+j, 1);
      renderKeepScroll();
    }
  });
  document.addEventListener("lang:change", () => {
    if (mode === "task") { collect(); renderKeepScroll(); }
    else if (mode === "holidays") { if (TS.editing) collectHol(); renderHolidays(); }
    else if (mode === "links") { collectLinks(); renderLinksEditor(); }
    else if (mode === "unlock") openUnlock();
    else if (mode === "signin") { const m = box.querySelector("#signin-msg"); if (m && !m.classList.contains("err")) m.textContent = t("auth.waiting"); }
  });

  // ---------- path บน server บริษัท: คลิก = คัดลอก path ----------
  // (เบราว์เซอร์ไม่ยอมให้เว็บเปิดไฟล์ในเครือข่ายโดยตรง จึงคัดลอกไปวางใน File Explorer แทน)
  document.addEventListener("click", async (e) => {
    const el = e.target.closest("[data-copy-path]"); if (!el) return;
    e.preventDefault();
    const path = el.dataset.copyPath;
    try { await navigator.clipboard.writeText(path); }
    catch {
      const ta = document.createElement("textarea"); ta.value = path; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch {} ta.remove();
    }
    toast(t("net.copied"), "ok");
  });
  // แท็กลิงก์: เว็บ = เปิดแท็บใหม่, path server = คลิกเพื่อคัดลอก
  function linkAttrs(url) {
    if (!TS.isNetPath(url)) return `href="${esc(url)}" target="_blank" rel="noopener noreferrer"`;
    const office = TS.officeUri(url), path = TS.netPath(url);
    return office
      ? `href="${esc(office)}" title="${esc(t("net.openHint") + "\n" + path)}"`
      : `href="#" data-copy-path="${esc(path)}" title="${esc(t("net.hint") + "\n" + path)}"`;
  }
  // ไอคอนท้ายลิงก์: เว็บ ↗, Office บน server ↗ (เปิดในโปรแกรม), อื่น ๆ บน server ⧉ (คัดลอก)
  const linkGo = (url) => (TS.isNetPath(url) && !TS.officeUri(url) ? "⧉" : "↗");

  // ---------- ดับเบิลคลิก / แตะ 2 ครั้ง ----------
  function onDouble(root, selector, fn) {
    root.addEventListener("dblclick", (e) => { const el = e.target.closest(selector); if (el) fn(el); });
    let last = { el: null, t: 0 };
    root.addEventListener("pointerup", (e) => {
      if (e.pointerType === "mouse") return;
      const el = e.target.closest(selector); if (!el) return;
      const now = Date.now();
      if (last.el === el && now - last.t < 350) { last = { el: null, t: 0 }; fn(el); }
      else last = { el, t: now };
    });
  }

  // ชื่อผู้ใช้ที่ login อยู่ (แสดงข้างปุ่มออกจากระบบ)
  function renderWho() {
    const el = document.getElementById("who"); if (!el) return;
    const u = TS.signedInAs;
    el.innerHTML = u
      ? `<img src="https://github.com/${encodeURIComponent(u)}.png?size=48" alt="" width="20" height="20" loading="lazy"><span>@${esc(u)}</span>`
      : `<span>${esc(t("auth.viaToken"))}</span>`;
    el.title = u ? t("auth.signedInAs", { u }) : t("auth.viaToken");
  }
  ["edit:change", "tasks:change", "lang:change"].forEach((ev) => document.addEventListener(ev, renderWho));
  renderWho();

  TS.syncBody();
  window.TaskEditor = { linkAttrs, linkGo, openUnlock, ensureEdit, forgetToken, toggleEdit, openTask, openHolidays, openLinks, toast, onDouble, close, CLIP };
})();
