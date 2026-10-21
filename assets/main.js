(function () {
  const S = window.SITE;
  const I = window.I18N;
  const t = (k, v) => I.t(k, v);
  const L = (v) => I.L(v);
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- profile (ไม่ขึ้นกับภาษา) ----------
  $("name").textContent = S.name;
  $("foot-name").textContent = S.name;
  $("brand-handle").textContent = S.handle;
  // footer: © วันที่วันนี้ (อัปเดตเองเมื่อข้ามวัน)
  const tickDate = () => { const d = new Date(); $("foot-date").textContent = `© ${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  tickDate(); setInterval(tickDate, 30000);

  // ---------- profile card (ขวาของ hero) ----------
  const initials = S.name.split(" ").map((w) => w[0]).join("").slice(0, 2);
  function renderProfile() {
    $("role").textContent = L(S.role);
    $("profile-card").innerHTML = `
      <div class="pc-top">
        <div class="pc-photo">
          ${S.photo ? `<img src="${esc(S.photo)}" alt="${esc(S.name)}">` : `<span>${esc(initials)}</span>`}
          <i class="pc-online" title="${esc(t("pc.online"))}"></i>
        </div>
        <div class="pc-id">
          <h3>${esc(S.name)}</h3>
          <div class="pc-role">${esc(L(S.role))}</div>
          <div class="pc-company">@ ${esc(L(S.company))}</div>
        </div>
      </div>
      <div class="pc-info">
        <a href="mailto:${esc(S.workEmail)}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>${esc(S.workEmail)}</a>
        <span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>${esc(L(S.location))}</span>
      </div>
      <div class="pc-label">${esc(t("pc.experience"))}</div>
      <ol class="pc-exp">${S.experience.slice(0, 3).map((e, i) => `
        <li class="${i === 0 ? "now" : ""}">
          <div class="pc-exp-title">${esc(L(e.title))}</div>
          <div class="pc-exp-meta">${esc(L(e.org))} · <span>${esc(L(e.period))}</span></div>
        </li>`).join("")}
      </ol>
      <div class="chips">${S.stack.map((x) => `<span class="chip">${esc(x)}</span>`).join("")}</div>`;
  }

  // ---------- typing effect (เริ่มหลังกดเข้าเว็บ, เปลี่ยนคำตามภาษา) ----------
  function startTyping() {
    const el = $("typed");
    if (reduce) {
      const set = () => (el.textContent = L(S.tagline)[0]);
      set(); document.addEventListener("lang:change", set);
      return;
    }
    let w = 0, i = 0, del = false;
    document.addEventListener("lang:change", () => { w = 0; i = 0; del = false; });
    (function tick() {
      const words = L(S.tagline);
      const word = words[w % words.length];
      el.textContent = word.slice(0, i);
      if (!del && i < word.length) i++;
      else if (!del) { del = true; return setTimeout(tick, 1600); }
      else if (i > 0) i--;
      else { del = false; w = (w + 1) % words.length; }
      setTimeout(tick, del ? 40 : 85);
    })();
  }

  // ---------- tasks (ข้อมูลจาก data/tasks.json ผ่าน TaskStore) ----------
  const TS = window.TaskStore, TE = window.TaskEditor;
  const DAY = TS.DAY, today = TS.today, parse = TS.parse;
  const fmt = (d) => d
    ? parse(d).toLocaleDateString(I.lang === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short", year: "2-digit" })
    : "—";

  function eta(x) {
    if (x.status === "done") return "";
    const n = Math.round((parse(x.due) - today) / DAY);
    if (n < 0) return `<span class="left late">${t("eta.late", { n: -n })}</span>`;
    if (n === 0) return `<span class="left soon">${t("eta.today")}</span>`;
    return `<span class="left ${n <= 7 ? "soon" : "ok"}">${t("eta.left", { n })}</span>`;
  }
  const wdLabel = (x) => { const n = TS.workdays(x); return t(n === 1 ? "wd.one" : "wd.count", { n }); };
  const when = (x) => x.status === "done" ? t("task.doneOn", { d: fmt(TS.finishDate(x)) }) : t("task.due", { d: fmt(x.due) });
  // เสร็จแล้ว: บอกว่าช้า/เร็วกว่าแผน
  const finTag = (x) => {
    const v = TS.variance(x); if (v === null) return "";
    return `<span class="left ${v > 0 ? "late" : "fin"}">${v > 0 ? t("fin.late", { n: v }) : v < 0 ? t("fin.early", { n: -v }) : t("fin.ontime")}</span>`;
  };

  let tasks = [];
  function syncTasks() {
    tasks = [...TS.tasks].sort((a, b) =>
      (a.status === "done") - (b.status === "done") ||
      (a.status === "done" ? parse(TS.finishDate(b) || b.due) - parse(TS.finishDate(a) || a.due) : parse(a.due) - parse(b.due)));
  }
  let statsShown = false;

  function renderStats() {
    const count = (s) => tasks.filter((x) => x.status === s).length;
    const overdue = tasks.filter((x) => TS.state(x) === "late").length;
    const pct = (n) => tasks.length ? Math.round((n / tasks.length) * 100) : 0;
    $("stats").innerHTML = [
      ["var(--white)", tasks.length, "tasks.total", 100],
      ["var(--amber)", count("doing"), "tasks.doing", pct(count("doing"))],
      ["var(--green)", count("done"), "tasks.done", pct(count("done"))],
      ["var(--red)", overdue, "tasks.overdue", pct(overdue)],
    ].map(([c, n, k, p]) => `
      <div class="stat card" style="--c:${c}">
        <div class="n">${n}</div><div class="l">${t(k)}</div>
        <div class="bar"><i style="width:${statsShown ? p + "%" : 0}" data-w="${p}%"></i></div>
      </div>`).join("");
  }

  // list: ชื่องานตัวใหญ่ / เสร็จเมื่อไหร่ / กี่ %
  let filter = "all";
  function renderTasks() {
    const list = tasks.filter((x) => filter === "all" || x.status === filter);
    $("task-list").innerHTML = list.map((x) => {
      const p = TS.progress(x), st = TS.state(x);
      return `
      <div class="tl-item card st-${st}" data-id="${esc(x.id)}" tabindex="0">
        <div class="tl-top">
          <h4>${esc(L(x.name))}</h4>
          <span class="tl-right"><span class="tl-pct">${p}<small>%</small></span><span class="tl-wd">${wdLabel(x)}</span></span>
        </div>
        <div class="pbar"><i style="width:${p}%"></i></div>
        <div class="tl-meta"><span>${when(x)}</span>${x.status === "done" ? finTag(x) : eta(x)}</div>
      </div>`;
    }).join("") || `<div class="empty">${TS.error ? t("load.fail") : t("task.empty")}</div>`;
  }
  $("filters").addEventListener("click", (e) => {
    const b = e.target.closest(".filter"); if (!b) return;
    document.querySelectorAll(".filter").forEach((x) => x.classList.toggle("on", x === b));
    filter = b.dataset.f;
    renderTasks();
  });

  // ดับเบิลคลิกงาน → หน้า timeline พร้อมข้อมูลทั้งหมด
  const openDetail = (el) => { location.href = `tasks.html?id=${encodeURIComponent(el.dataset.id)}`; };
  TE.onDouble($("task-list"), ".tl-item", openDetail);
  TE.onDouble($("cal-weeks"), ".cbar", openDetail);
  $("task-list").addEventListener("keydown", (e) => { const el = e.target.closest(".tl-item"); if (el && e.key === "Enter") openDetail(el); });

  // ปุ่มแก้ไข
  const renderEditBtn = () => { $("edit-toggle").textContent = t(TS.editing ? "edit.exit" : "edit.enter"); };
  $("edit-toggle").addEventListener("click", () => TE.toggleEdit());
  $("add-task").addEventListener("click", () => TE.openTask(null));
  document.addEventListener("edit:change", renderEditBtn);

  // ---------- world clock ----------
  const offsetMin = (tz, at) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" })
      .formatToParts(at).map((x) => [x.type, x.value]));
    return (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(at / 60000) * 60000) / 60000;
  };
  const locale = () => (I.lang === "th" ? "th-TH" : "en-GB");

  function renderClocks() {
    $("clocks").innerHTML = S.clocks.map((c, i) => `
      <div class="card clock ${i === 0 ? "home" : ""}">
        <div class="clock-top">
          <span class="country"><span class="flag">${esc(c.code)}</span>${esc(L(c.name))}</span>
          <span class="diff" id="cd${i}"></span>
        </div>
        <div class="clock-mid">
          <div class="time" id="ct${i}"></div>
          <div class="clock-meta"><div class="date" id="cdt${i}"></div><div class="work" id="cw${i}"></div></div>
        </div>
        <div class="daybar"><i id="cbar${i}"></i></div>
      </div>`).join("");
    tickClocks();
  }
  function tickClocks() {
    const at = new Date();
    const home = offsetMin(S.clocks[0].tz, at);
    S.clocks.forEach((c, i) => {
      const [h, m, sec] = new Intl.DateTimeFormat("en-GB", { timeZone: c.tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(at).split(":");
      $("ct" + i).innerHTML = `${h}<span class="colon">:</span>${m}<span class="sec">${sec}</span>`;
      $("cdt" + i).textContent = new Intl.DateTimeFormat(locale(), { timeZone: c.tz, weekday: "short", day: "numeric", month: "short" }).format(at);
      const diff = (offsetMin(c.tz, at) - home) / 60;
      $("cd" + i).textContent = i === 0 ? t("clock.local") : diff === 0 ? t("clock.same") : t(diff < 0 ? "clock.behind" : "clock.ahead", { n: Math.abs(diff) });
      $("cbar" + i).style.left = (((+h * 60 + +m) / 1440) * 100).toFixed(2) + "%";
      const wd = new Intl.DateTimeFormat("en-US", { timeZone: c.tz, weekday: "short" }).format(at);
      const on = +h >= 8 && +h < 17 && wd !== "Sat" && wd !== "Sun";
      $("cw" + i).className = "work " + (on ? "on" : "off");
      $("cw" + i).textContent = (on ? "● " : "○ ") + t(on ? "clock.on" : "clock.off");
    });
  }
  setInterval(tickClocks, 1000);

  // ---------- task calendar ----------
  let calView = new Date(today.getFullYear(), today.getMonth(), 1);
  const MAX_LANES = 3;

  function renderCalendar() {
    $("cal-month").textContent = calView.toLocaleDateString(I.lang === "th" ? "th-TH" : "en-US", { month: "long", year: "numeric" });
    const sun = new Date(2026, 0, 4); // วันอาทิตย์
    $("cal-dow").innerHTML = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sun); d.setDate(sun.getDate() + i);
      return `<div>${d.toLocaleDateString(locale(), { weekday: "short" })}</div>`;
    }).join("");

    const first = new Date(calView); first.setDate(1 - first.getDay());
    const last = new Date(calView.getFullYear(), calView.getMonth() + 1, 0);
    let html = "";
    for (let ws = new Date(first); ws <= last; ws.setDate(ws.getDate() + 7)) {
      const we = new Date(ws); we.setDate(we.getDate() + 6);
      let cells = "";
      for (let i = 0; i < 7; i++) {
        const d = new Date(ws); d.setDate(d.getDate() + i);
        const out = d.getMonth() !== calView.getMonth() ? " out" : "";
        const now = d.getTime() === today.getTime() ? " today" : "";
        const hol = TS.holidayOn(TS.iso(d));
        cells += `<div class="bgcell${out}${now}${hol ? " hol" : ""}" style="grid-column:${i + 1}"></div>
                  <div class="dnum${out}${now}" style="grid-column:${i + 1}"><span>${d.getDate()}</span>${hol ? `<em class="hname" title="${esc(L(hol.name))}">${esc(L(hol.name))}</em>` : ""}</div>`;
      }
      // วางแถบงานเป็นเลน ไม่ให้ทับกัน
      const segs = tasks.map((x) => ({ x, s: parse(x.start || x.due), e: parse(TS.endDate(x)) }))
        .filter((g) => g.s <= we && g.e >= ws)
        .map((g) => ({ ...g, a: Math.round(((g.s < ws ? ws : g.s) - ws) / DAY), b: Math.round(((g.e > we ? we : g.e) - ws) / DAY) }))
        .sort((p, q) => p.a - q.a || (q.b - q.a) - (p.b - p.a));
      const lanes = [], hidden = Array(7).fill(0);
      let bars = "";
      segs.forEach((g) => {
        let l = lanes.findIndex((end) => end < g.a);
        if (l === -1) { l = lanes.length; lanes.push(-1); }
        if (l >= MAX_LANES) { for (let k = g.a; k <= g.b; k++) hidden[k]++; return; }
        lanes[l] = g.b;
        const st = TS.state(g.x), p = TS.progress(g.x);
        const cls = (g.s < ws ? " cont-l" : "") + (g.e > we ? " cont-r" : "");
        const tip = `${L(g.x.name)} · ${p}% · ${when(g.x)}`;
        // แถบสีความคืบหน้าต่อเนื่องข้ามสัปดาห์ (ไม่ใช่เต็ม % ทุกท่อน)
        const total = Math.round((g.e - g.s) / DAY) + 1, filled = (p / 100) * total;
        const offset = Math.round(((g.s < ws ? ws : g.s) - g.s) / DAY), len = g.b - g.a + 1;
        const fill = Math.max(0, Math.min(1, (filled - offset) / len)) * 100;
        bars += `<div class="cbar ${st}${cls}" style="grid-column:${g.a + 1}/${g.b + 2};grid-row:${l + 2};--p:${fill.toFixed(1)}%" data-id="${esc(g.x.id)}" title="${esc(tip)}"><span class="cpct">${p}%</span><span class="cname">${esc(L(g.x.name))}</span></div>`;
      });
      const more = hidden.map((n, i) => n ? `<div class="more" style="grid-column:${i + 1};grid-row:${MAX_LANES + 2}">${t("cal.more", { n })}</div>` : "").join("");
      html += `<div class="week">${cells}${bars}${more}</div>`;
    }
    $("cal-weeks").innerHTML = html;
  }
  $("cal-prev").onclick = () => { calView.setMonth(calView.getMonth() - 1); renderCalendar(); };
  $("cal-next").onclick = () => { calView.setMonth(calView.getMonth() + 1); renderCalendar(); };
  $("cal-today").onclick = () => { calView = new Date(today.getFullYear(), today.getMonth(), 1); renderCalendar(); };

  // ---------- calendar / list switch ----------
  $("view-switch").addEventListener("click", (e) => {
    const b = e.target.closest(".seg-btn"); if (!b) return;
    document.querySelectorAll(".seg-btn").forEach((x) => x.classList.toggle("on", x === b));
    $("view-calendar").classList.toggle("hidden", b.dataset.view !== "calendar");
    $("view-list").classList.toggle("hidden", b.dataset.view !== "list");
  });

  // ---------- contact ----------
  const ICON = {
    star: '<path d="M4 4h16v16H4z" opacity=".0"/><rect x="3" y="3" width="18" height="18" rx="3"/><path d="m12 7 1.5 3 3.3.5-2.4 2.3.6 3.2-3-1.6-3 1.6.6-3.2-2.4-2.3 3.3-.5z"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M15 11v5m-2-3 2-2 2 2"/>',
    search: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v3"/><path d="M3 7v10a2 2 0 0 0 2 2h6"/><circle cx="17" cy="16" r="3"/><path d="m21 20-1.8-1.8"/>',
    tool: '<path d="M7 3v6m-2-6v4a2 2 0 0 0 4 0V3M7 9v12M17 3a3 3 0 0 0-3 3v5h3m0-8v18"/>',
    db: '<ellipse cx="11" cy="6" rx="7" ry="3"/><path d="M4 6v12c0 1.7 3.1 3 7 3M18 6v5"/><path d="m16 15 3 3-3 3m3-3h-6"/>',
    sync: '<path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3M18 3v4h-4M6 21v-4h4"/>',
    chip: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    install: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M12 12v6m-3-3 3 3 3-3"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    unlock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h7M8.5 14h4"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  };
  const svg = (k, sz = 20) => `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k] || ICON.tool}</svg>`;
  const phoneFmt = (p) => p.replace(/^(\d{3})(\d{3})(\d{4})$/, "$1-$2-$3");
  const phoneTel = (p) => "+66" + p.replace(/^0/, "");

  const cBack = document.createElement("div");
  cBack.className = "modal-back hidden";
  cBack.innerHTML = '<div class="modal card contact-modal" role="dialog" aria-modal="true"></div>';
  document.body.appendChild(cBack);
  const cBox = cBack.firstElementChild;
  let contactOpen = false;
  function renderContact() {
    const mail = S.workEmail;
    const rows = [
      ["mail", "outlook", t("contact.outlook"), mail, `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(mail)}`, mail],
      ["chat", "teams", t("contact.teams"), mail, `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(mail)}`, mail],
      ["phone", "phone", t("contact.phone"), phoneFmt(S.phone), `tel:${phoneTel(S.phone)}`, phoneFmt(S.phone)],
    ];
    cBox.innerHTML = `
      <div class="modal-head"><h3>${t("contact.title")}</h3><button class="icon-btn" data-cclose aria-label="${t("common.close")}">✕</button></div>
      <div class="ct-list">${rows.map(([ic, cls, label, sub, href, copy]) => `
        <div class="ct-row ${cls}">
          <a class="ct-main" href="${esc(href)}" ${href.startsWith("http") ? 'target="_blank" rel="noopener"' : ""}>
            <span class="ct-ico">${svg(ic, 22)}</span>
            <span class="ct-text"><b>${esc(label)}</b><small>${esc(sub)}</small></span>
            <span class="ct-go">↗</span>
          </a>
          <button class="icon-btn ct-copy" data-copy="${esc(copy)}" title="${t("contact.copy")}" aria-label="${t("contact.copy")}">${svg("copy", 16)}</button>
        </div>`).join("")}
      </div>`;
  }
  const openContact = () => { renderContact(); contactOpen = true; cBack.classList.remove("hidden"); document.body.classList.add("modal-open"); };
  const closeContact = () => { contactOpen = false; cBack.classList.add("hidden"); document.body.classList.remove("modal-open"); };
  $("contact-btn").addEventListener("click", openContact);
  cBack.addEventListener("mousedown", (e) => { if (e.target === cBack) closeContact(); });
  cBack.addEventListener("click", async (e) => {
    if (e.target.closest("[data-cclose]")) return closeContact();
    const c = e.target.closest("[data-copy]");
    if (c) { try { await navigator.clipboard.writeText(c.dataset.copy); TE.toast(t("contact.copied"), "ok"); } catch {} }
  });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && contactOpen) closeContact(); });

  // ---------- links + vault ----------
  let vaultFiles = null, vaultMsg = "";
  function renderLinks() {
    const groups = (TS.linkGroups || []).map((g) => `
      <div class="card group">
        <div class="group-head">
          <h3><span class="ic">${svg(g.icon, 18)}</span>${esc(L(g.title))}</h3>
          ${g.member ? `<span class="member">${esc(t("links.member"))}</span>` : ""}
        </div>
        <div class="lk-grid">${g.items.map((x) => x.url
          ? `<a class="lk" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer" title="${esc(L(x.name))}">${svg(x.icon)}<span>${esc(L(x.name))}</span><b class="go">↗</b></a>`
          : `<span class="lk unset" title="${esc(t("links.unset"))}">${svg(x.icon)}<span>${esc(L(x.name))}</span></span>`).join("")}
        </div>
      </div>`).join("");

    const open = vaultFiles !== null;
    const vault = `
      <div class="card group vault ${open ? "open" : ""}" id="vault-card">
        <div class="group-head">
          <h3><span class="ic v">${svg(open ? "unlock" : "lock", 18)}</span>${esc(t("vault.name"))}</h3>
          ${open ? `<button class="btn sm" id="vault-lock-btn">${esc(t("vault.lock"))}</button>` : `<span class="member v">${esc(t("vault.private"))}</span>`}
        </div>
        ${open
          ? (vaultFiles.length
            ? `<div class="lk-grid">${vaultFiles.map((f) => `<a class="lk" href="${esc(f.url)}" target="_blank" rel="noopener noreferrer"><span class="vt">${esc((f.type || TS.linkType(f.url)).slice(0, 6))}</span><span>${esc(L(f.name))}</span><b class="go">↗</b></a>`).join("")}</div>`
            : `<div class="vault-empty">${esc(t("vault.empty"))}</div>`)
          : `<form class="pin-form" id="pin-form" autocomplete="off">
              <div class="pin-lock">${svg("lock", 28)}</div>
              <p>${esc(t("vault.pinDesc"))}</p>
              <input class="pin" id="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" placeholder="••••" aria-label="PIN" autocomplete="off">
              <div class="msg ${vaultMsg === "vault.wrong" ? "err" : "info"}" id="pin-msg">${vaultMsg ? esc(t(vaultMsg)) : ""}</div>
            </form>`}
      </div>`;
    $("link-groups").innerHTML = groups + vault;
  }

  async function tryPin(pin) {
    if (!window.VAULT) { vaultMsg = "vault.none"; renderLinks(); return; }
    const msg = $("pin-msg"); msg.className = "msg info"; msg.textContent = t("vault.verifying");
    try {
      vaultFiles = await window.VaultCrypto.decryptJSON(window.VAULT, pin);
      vaultMsg = "";
      renderLinks();
    } catch {
      vaultMsg = "vault.wrong";
      renderLinks();
      const f = $("pin-form"); f.classList.add("shake"); $("pin").focus();
    }
  }
  $("link-groups").addEventListener("input", (e) => {
    if (e.target.id !== "pin") return;
    e.target.value = e.target.value.replace(/\D/g, "");
    if (e.target.value.length === 4) tryPin(e.target.value);
  });
  $("link-groups").addEventListener("submit", (e) => { e.preventDefault(); const v = $("pin").value; if (v) tryPin(v); });
  $("link-groups").addEventListener("click", (e) => { if (e.target.closest("#vault-lock-btn")) { vaultFiles = null; vaultMsg = ""; renderLinks(); } });

  // ---------- render ทั้งหมด + เมื่อเปลี่ยนภาษา ----------
  function renderTaskViews() {
    syncTasks();
    renderStats();
    renderCalendar();
    renderTasks();
  }
  function renderAll() {
    renderProfile();
    renderClocks();
    renderTaskViews();
    renderEditBtn();
    renderLinks();
    if (contactOpen) renderContact();
  }
  renderAll();
  document.addEventListener("lang:change", renderAll);
  document.addEventListener("tasks:change", () => { renderTaskViews(); renderLinks(); });
  $("holidays-btn").addEventListener("click", () => TE.openHolidays());
  $("edit-links").addEventListener("click", () => TE.ensureEdit(TE.openLinks));
  $("forget-token").addEventListener("click", () => TE.forgetToken());
  TS.load();

  // ---------- เริ่มหลังกดปุ่มที่หน้า intro ----------
  let started = false;
  function onEnter() {
    if (started) return;
    started = true;
    startTyping();

    // เผยทีละส่วนตอนเลื่อนถึง
    const rv = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add("visible");
        if (en.target.id === "stats") { statsShown = true; en.target.querySelectorAll(".bar i").forEach((b) => (b.style.width = b.dataset.w)); }
        rv.unobserve(en.target);
      });
    }, { threshold: 0.12 });
    document.querySelectorAll(".reveal:not(.visible)").forEach((el) => rv.observe(el));

    // ไฮไลต์เมนูตามส่วนที่กำลังดู
    const links = [...document.querySelectorAll(".nav-pill a.lnk")];
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + en.target.id));
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    ["top", "tasks", "links"].forEach((id) => io.observe($(id)));
  }
  document.addEventListener("site:enter", onEnter);
  // ถ้าหน้า intro ถูกข้ามไปก่อนสคริปต์นี้จะโหลด (กด Back กลับมา) ให้เริ่มเลย
  if (document.getElementById("site").classList.contains("in")) onEnter();
})();
