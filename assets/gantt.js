// ============================================================
//  หน้า timeline (Gantt): ชื่องานด้านซ้าย, แถบเวลาแนวนอน, กดลูกศรเพื่อดูงานย่อย
// ============================================================
(function () {
  const TS = window.TaskStore, TE = window.TaskEditor, I = window.I18N;
  const t = (k, v) => I.t(k, v);
  const L = (v) => I.L(v);
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const { DAY, today, parse } = TS;
  // ช่วงเวลาที่แสดงพอดีหน้าจอ: สัปดาห์นี้ / เดือนนี้ / ครึ่งปีนี้ / ปีนี้
  function period(v) {
    const y = today.getFullYear(), m = today.getMonth();
    if (v === "week") { const a = new Date(today); a.setDate(a.getDate() - ((a.getDay() + 6) % 7)); const b = new Date(a); b.setDate(b.getDate() + 6); return [a, b]; }
    if (v === "month") return [new Date(y, m, 1), new Date(y, m + 1, 0)];
    if (v === "half") return m < 6 ? [new Date(y, 0, 1), new Date(y, 5, 30)] : [new Date(y, 6, 1), new Date(y, 11, 31)];
    return [new Date(y, 0, 1), new Date(y, 11, 31)];
  }

  let view = "month";
  let hideDone = false;
  try { hideDone = localStorage.getItem("g_hideDone") === "1"; } catch {}
  const gl = () => parseFloat(getComputedStyle(document.querySelector(".gantt")).getPropertyValue("--gl")) || 320;
  // กว้างกี่ px ต่อ 1 วัน ให้ช่วงเวลาที่เลือกพอดีหน้าจอ
  const dayW = () => { const [a, b] = period(view); return Math.max(1, ($("g-scroll").clientWidth - gl()) / (days(a, b) + 1)); };
  const expanded = new Set();
  const focusId = new URLSearchParams(location.search).get("id");
  let focused = false;

  const locale = () => (I.lang === "th" ? "th-TH" : "en-GB");
  const fmt = (d) => d ? parse(d).toLocaleDateString(locale(), { day: "numeric", month: "short", year: "2-digit" }) : "—";
  const stLabel = (st) => (st === "late" ? t("tasks.overdue") : t("status." + st));
  const days = (a, b) => Math.round((b - a) / DAY);

  // ช่วงวันที่ของทั้งกราฟ
  function range() {
    const ds = [today, ...period(view)];
    TS.tasks.forEach((x) => {
      [x.start, x.due, x.done].forEach((d) => d && ds.push(parse(d)));
      (x.subtasks || []).forEach((s) => [s.start, s.due, s.done].forEach((d) => d && ds.push(parse(d))));
    });
    const min = new Date(Math.min(...ds)), max = new Date(Math.max(...ds));
    min.setDate(min.getDate() - 7);
    max.setDate(max.getDate() + 14);
    return { start: min, n: days(min, max) + 1 };
  }

  function header(r, dw) {
    let months = "", dayCells = "";
    for (let i = 0; i < r.n; ) {
      const d = new Date(r.start); d.setDate(d.getDate() + i);
      const left = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate() + 1;
      const span = Math.min(left, r.n - i);
      const w = span * dw, loc = I.lang === "th" ? "th-TH" : "en-US";
      const label = w >= 120 ? d.toLocaleDateString(loc, { month: "long", year: "numeric" })
        : w >= 26 ? d.toLocaleDateString(loc, { month: "short" }) : "";
      months += `<span style="left:${i * dw}px;width:${w}px"><em>${label}</em></span>`;
      i += span;
    }
    for (let i = 0; i < r.n; i++) {
      const d = new Date(r.start); d.setDate(d.getDate() + i);
      const now = d.getTime() === today.getTime() ? " now" : "";
      if (dw >= 18) {
        const we = (d.getDay() === 0 || d.getDay() === 6 ? " we" : "") + (TS.holidayOn(TS.iso(d)) ? " hol" : "");
        dayCells += `<span class="${we}${now}" style="left:${i * dw}px;width:${dw}px">${d.getDate()}</span>`;
      } else if (dw >= 5 && d.getDay() === 1) {
        dayCells += `<span style="left:${i * dw}px;width:${7 * dw}px;justify-content:flex-start;padding-left:4px">${d.getDate()}</span>`;
      }
    }
    return `
      <div class="g-row g-head">
        <div class="g-left">${t("g.tasks")}</div>
        <div class="g-right" style="width:${r.n * dw}px"><div class="g-months">${months}</div><div class="g-days">${dayCells}</div></div>
      </div>`;
  }

  function bar(x, r, dw, isSub) {
    const s = parse(x.start || x.due), e = parse(TS.endDate(x));
    const p = TS.progress(x);
    const tip = `${L(x.name)} · ${fmt(x.start)} → ${fmt(TS.endDate(x))} · ${p}%`;
    return `<div class="g-bar" style="left:${days(r.start, s) * dw}px;width:${(days(s, e) + 1) * dw}px" title="${esc(tip)}">
      <i style="width:${p}%"></i><span>${(days(s, e) + 1) * dw > (isSub ? 34 : 44) ? p + "%" : ""}</span></div>`;
  }

  // จำนวนวันทำงาน (เล็ก ๆ ใต้ %)
  const wd = (x) => { const n = TS.workdays(x); return `<small class="g-wd" title="${esc(t(n === 1 ? "wd.one" : "wd.count", { n }))}">${t("wd.short", { n })}</small>`; };

  // ปุ่ม 📎 เอกสาร: มีเอกสาร = สว่าง + จำนวน, ไม่มี = จาง
  function docBtn(item, taskId, subIndex) {
    const n = TS.links(item).length;
    const tip = n === 1 ? t("doc.count1") : n ? t("doc.count", { n }) : t("doc.none");
    return `<button class="g-doc ${n ? "" : "empty"}" data-docs="${esc(taskId)}" data-sub="${subIndex}" title="${esc(tip)}" aria-label="${esc(tip)}">${TE.CLIP}${n ? `<b>${n}</b>` : ""}</button>`;
  }

  // กล่องรายการเอกสาร (popover)
  const pop = document.createElement("div");
  pop.className = "doc-pop card hidden";
  document.body.appendChild(pop);
  let popFor = null;
  const closePop = () => { pop.classList.add("hidden"); popFor = null; };
  function openPop(btn) {
    const x = TS.find(btn.dataset.docs); if (!x) return;
    const item = btn.dataset.sub === "" ? x : (x.subtasks || [])[+btn.dataset.sub];
    if (!item) return;
    const key = btn.dataset.docs + ":" + btn.dataset.sub;
    if (popFor === key) return closePop();
    popFor = key;
    const links = TS.links(item);
    pop.innerHTML = `
      <div class="doc-pop-head">${TE.CLIP}<b>${esc(L(item.name))}</b></div>
      ${links.length ? `<ul>${links.map((l) => `
        <li><a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">
          <span class="doc-type">${esc(TS.linkType(l.url))}</span><span class="doc-name">${esc(l.name || l.url)}</span><span class="doc-go">↗</span></a></li>`).join("")}</ul>`
        : `<div class="doc-empty">${t("doc.none")}${TS.editing ? "" : `<br><small>${t("doc.addHint")}</small>`}</div>`}
      ${TS.editing ? `<button class="btn sm doc-edit" data-edit="${esc(btn.dataset.docs)}">${t("ed.addLink")}</button>` : ""}`;
    pop.classList.remove("hidden");
    const r = btn.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    let left = Math.min(Math.max(8, r.left), innerWidth - w - 8);
    let top = r.bottom + 8;
    if (top + h > innerHeight - 8) top = Math.max(8, r.top - h - 8);
    pop.style.left = left + "px"; pop.style.top = top + "px";
  }
  pop.addEventListener("click", (e) => { const ed = e.target.closest("[data-edit]"); if (ed) { closePop(); TE.openTask(ed.dataset.edit); } });
  document.addEventListener("mousedown", (e) => { if (!pop.contains(e.target) && !e.target.closest(".g-doc")) closePop(); });
  addEventListener("keydown", (e) => { if (e.key === "Escape") closePop(); });
  addEventListener("scroll", closePop, true);

  function render() {
    const root = $("gantt");
    const doneCount = TS.tasks.filter((x) => TS.progress(x) === 100).length;
    $("g-hide").textContent = t(hideDone ? "g.showDone" : "g.hideDone", { n: doneCount });
    $("g-hide").classList.toggle("on", hideDone);
    if (!TS.tasks.length) { root.innerHTML = `<div class="empty" style="margin:16px">${TS.error ? t("load.fail") : t("task.empty")}</div>`; return; }
    const dw = dayW(), r = range();
    // เรียงตามความเร่งด่วน: เลยกำหนด → ใกล้กำหนดส่ง → เสร็จแล้ว (ล่าสุดก่อน)
    const rank = (x) => ({ late: 0, done: 2 }[TS.state(x)] ?? 1);
    const list = TS.tasks
      .filter((x) => !(hideDone && TS.progress(x) === 100))
      .sort((a, b) => rank(a) - rank(b) ||
        (rank(a) === 2 ? parse(TS.endDate(b)) - parse(TS.endDate(a)) : parse(a.due) - parse(b.due)));
    let html = header(r, dw) + "<!--off-->";

    list.forEach((x) => {
      const id = String(x.id), subs = x.subtasks || [], open = expanded.has(id);
      const st = TS.state(x), p = TS.progress(x);
      // 1 กลุ่ม = หัวข้องาน + งานย่อย + สรุป (ไม่มีเส้นคั่นภายในกลุ่ม)
      html += `
      <div class="g-group st-${st} ${open ? "open" : ""}">
        <div class="g-row g-task g-body-row ${id === focusId ? "focus" : ""}" data-id="${esc(id)}">
          <div class="g-left">
            <button class="g-chev" data-toggle="${esc(id)}" aria-expanded="${open}" aria-label="${esc(L(x.name))}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m9 6 6 6-6 6"/></svg>
            </button>
            <i class="g-dot"></i>
            <div class="g-name"><b>${esc(L(x.name))}</b><small>${stLabel(st)}${subs.length ? " · " + t("task.subs", { n: subs.length }) : ""}</small></div>
            ${docBtn(x, id, "")}
            <span class="g-pctbox"><span class="g-pct">${p}%</span>${wd(x)}</span>
            <button class="icon-btn sm edit-only g-edit" data-edit="${esc(id)}" aria-label="${t("edit.row")}" title="${t("edit.row")}">✎</button>
          </div>
          <div class="g-right" style="width:${r.n * dw}px">${bar(x, r, dw, false)}</div>
        </div>`;

      if (open) {
        subs.forEach((s, i) => {
          const sst = TS.state(s), sp = TS.progress(s);
          html += `
        <div class="g-row g-sub g-body-row st-${sst} ${i === subs.length - 1 ? "last" : ""}">
          <div class="g-left">
            <i class="g-dot"></i>
            <div class="g-name"><b>${esc(L(s.name))}</b><small>${fmt(s.start)} → ${fmt(s.due)} · ${stLabel(sst)}</small></div>
            ${docBtn(s, id, i)}
            <span class="g-pctbox"><span class="g-pct">${sp}%</span>${wd(s)}</span>
          </div>
          <div class="g-right" style="width:${r.n * dw}px">${bar(s, r, dw, true)}</div>
        </div>`;
        });
        // สรุปไว้ล่างสุดของกลุ่ม
        html += `
        <div class="g-row g-info">
          <div class="g-left">
            <div class="g-dates"><span class="g-badge">${stLabel(st)}</span>${fmt(x.start)} → ${fmt(x.due)}${x.status === "done" ? " · " + t("task.doneOn", { d: fmt(x.done) }) : ""}${x.project ? " · #" + esc(x.project) : ""}</div>
            ${x.desc ? `<div class="g-desc">${esc(L(x.desc))}</div>` : ""}
          </div>
        </div>`;
      }
      html += `</div>`;
    });

    // แรเงาวันหยุด (และเสาร์–อาทิตย์ เมื่อช่องกว้างพอ) — ใส่ไว้ก่อนแถวงาน แถบงานจะได้อยู่ด้านบน
    let off = "";
    for (let i = 0; i < r.n; i++) {
      const d = new Date(r.start); d.setDate(d.getDate() + i);
      const hol = TS.holidayOn(TS.iso(d)), we = d.getDay() === 0 || d.getDay() === 6;
      if (hol || (we && dw >= 4)) off += `<div class="g-off ${hol ? "hol" : ""}" style="left:calc(var(--gl) + ${i * dw}px);width:${Math.max(dw, hol ? 2 : 0)}px" ${hol ? `title="${esc(L(hol.name))}"` : ""}></div>`;
    }
    html = html.replace("<!--off-->", off);
    const todayX = days(r.start, today) * dw + dw / 2;
    html += `<div class="g-today" style="left:calc(var(--gl) + ${todayX}px)"></div>`;
    root.innerHTML = html;
    root.style.setProperty("--dw", dw + "px");

    // ครั้งแรก: เปิดงานที่ดับเบิลคลิกมา แล้วเลื่อนไปหา
    if (!focused) {
      focused = true;
      const row = focusId && root.querySelector(`.g-task[data-id="${CSS.escape(focusId)}"]`);
      const sc = $("g-scroll");
      if (row) {
        const x = TS.find(focusId);
        sc.scrollLeft = days(r.start, parse(x.start || x.due)) * dw - 24;
        row.scrollIntoView({ block: "center" });
      } else {
        toPeriod(false);
      }
    }
  }

  // ---------- events ----------
  $("gantt").addEventListener("click", (e) => {
    const tg = e.target.closest("[data-toggle]");
    if (tg) { const id = tg.dataset.toggle; expanded.has(id) ? expanded.delete(id) : expanded.add(id); render(); return; }
    const doc = e.target.closest("[data-docs]");
    if (doc) { openPop(doc); return; }
    const ed = e.target.closest("[data-edit]");
    if (ed) TE.openTask(ed.dataset.edit);
  });
  TE.onDouble($("gantt"), ".g-task .g-name", (el) => {
    const id = el.closest(".g-task").dataset.id;
    expanded.has(id) ? expanded.delete(id) : expanded.add(id); render();
  });
  // เลื่อนให้ช่วงเวลาที่เลือกอยู่พอดีหน้าจอ
  function toPeriod(smooth) {
    const r = range(), sc = $("g-scroll");
    sc.scrollTo({ left: days(r.start, period(view)[0]) * dayW(), behavior: smooth ? "smooth" : "auto" });
  }
  $("zoom").addEventListener("click", (e) => {
    const b = e.target.closest(".seg-btn"); if (!b) return;
    document.querySelectorAll("#zoom .seg-btn").forEach((x) => x.classList.toggle("on", x === b));
    view = b.dataset.z; focused = true; render(); toPeriod(false);
  });
  $("g-today").addEventListener("click", () => toPeriod(true));
  $("g-hide").addEventListener("click", () => {
    hideDone = !hideDone;
    try { localStorage.setItem("g_hideDone", hideDone ? "1" : "0"); } catch {}
    render();
  });
  let rz = 0;
  addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { render(); toPeriod(false); }, 150); });
  $("g-expand").addEventListener("click", () => { TS.tasks.forEach((x) => expanded.add(String(x.id))); render(); });
  $("g-collapse").addEventListener("click", () => { expanded.clear(); render(); });

  const renderEditBtn = () => { $("edit-toggle").textContent = t(TS.editing ? "edit.exit" : "edit.enter"); };
  $("edit-toggle").addEventListener("click", () => TE.toggleEdit());
  $("add-task").addEventListener("click", () => TE.openTask(null));
  $("holidays-btn").addEventListener("click", () => TE.openHolidays());
  $("forget-token").addEventListener("click", () => TE.forgetToken());
  document.addEventListener("edit:change", renderEditBtn);

  // กลับหน้าหลักโดยไม่ต้องดู intro อีกรอบ
  document.querySelectorAll(".back-link").forEach((a) => a.addEventListener("click", () => {
    try { sessionStorage.setItem("skipIntro", "1"); } catch {}
  }));

  // footer: © วันที่วันนี้ (อัปเดตเองเมื่อข้ามวัน)
  const tickDate = () => { const d = new Date(); $("foot-date").textContent = `© ${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  tickDate(); setInterval(tickDate, 30000);
  if (focusId) expanded.add(focusId);
  document.addEventListener("tasks:change", render);
  document.addEventListener("lang:change", () => { render(); renderEditBtn(); });
  renderEditBtn();
  TS.load();
})();
