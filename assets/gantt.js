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
  const gl = () => { const v = parseFloat(getComputedStyle(document.querySelector(".gantt")).getPropertyValue("--gl")); return isNaN(v) ? 320 : v; };
  // กว้างกี่ px ต่อ 1 วัน ให้ช่วงเวลาที่เลือกพอดีหน้าจอ
  // จำนวนวันที่เห็นบนจอ: ตามปุ่ม Week/Month/… หรือค่าที่ zoom ด้วยล้อเมาส์ (customDays)
  let customDays = null;
  const spanDays = () => customDays ?? (days(...period(view)) + 1);
  const dayW = () => Math.max(0.5, ($("g-scroll").clientWidth - gl()) / spanDays());
  const expanded = new Set();
  // มือถือแนวตั้ง: A = timeline แบบไม่มีคอลัมน์ชื่อ (ชื่ออยู่เหนือแถบ), B = มุมมองรายการ (การ์ด)
  const mqCompact = matchMedia("(max-width: 600px)");
  const mqMode = matchMedia("(max-width: 900px)");           // ปุ่มสลับ Timeline / รายการ แสดงเฉพาะจอเล็ก
  let modePref = "tl";
  try { modePref = localStorage.getItem("g_mode") === "list" ? "list" : "tl"; } catch {}
  const listMode = () => modePref === "list" && mqMode.matches;
  // มาจากการดับเบิลคลิกหน้าหลัก: ?id=งาน (ขยายเฉพาะงานนั้น) หรือ ?date=วันที่ (ย่อทั้งหมด แล้วเลื่อนไปวันนั้น)
  const params = new URLSearchParams(location.search);
  const focusId = params.get("id");
  const focusDate = /^\d{4}-\d{2}-\d{2}$/.test(params.get("date") || "") ? params.get("date") : "";
  let focused = false;

  const locale = () => (I.lang === "th" ? "th-TH" : "en-GB");
  const fmt = (d) => d ? parse(d).toLocaleDateString(locale(), { day: "numeric", month: "short", year: "2-digit" }) : "—";
  const stLabel = (st) => (st === "late" ? t("tasks.overdue") : t("status." + st));
  const days = (a, b) => Math.round((b - a) / DAY);

  // ช่วงวันที่ของทั้งกราฟ
  function range() {
    const pad = new Date(today); pad.setDate(pad.getDate() + Math.ceil(spanDays()));
    const padB = new Date(today); padB.setDate(padB.getDate() - Math.ceil(spanDays()));
    const ds = [today, ...period(view), pad, padB];
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
      // มือถือ (compact) ช่องแคบ: แสดงเลขวันเว้นวัน (+ วันนี้) ไม่ให้ตัวเลขติดกันจนอ่านไม่ออก
      const compact = document.querySelector(".gantt").classList.contains("compact");
      if (dw >= 18 || (compact && dw >= 7)) {
        const we = (d.getDay() === 0 || d.getDay() === 6 ? " we" : "") + (TS.holidayOn(TS.iso(d)) ? " hol" : "");
        const show = dw >= 16 || d.getDate() % 2 === 1 || now;
        dayCells += `<span class="${we}${now}" style="left:${i * dw}px;width:${dw}px">${show ? d.getDate() : ""}</span>`;
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
    let html = `<div class="g-bar" style="left:${days(r.start, s) * dw}px;width:${(days(s, e) + 1) * dw}px" title="${esc(tip)}">
      <i style="width:${p}%"></i><span>${(days(s, e) + 1) * dw > (isSub ? 34 : 44) ? p + "%" : ""}</span></div>`;
    // หัวข้อใหญ่ที่เสร็จแล้ว: เส้น "Finished on" เทียบกับแผน
    const fin = !isSub && TS.finishDate(x);
    if (fin) {
      const v = TS.variance(x), f = parse(fin);
      const planEnd = (days(r.start, e) + 1) * dw, finX = (days(r.start, f) + 1) * dw;
      const cls = v > 0 ? "late" : v < 0 ? "early" : "ontime";
      if (v > 0) html += `<div class="g-over late" style="left:${planEnd}px;width:${finX - planEnd}px"></div>`;
      if (v < 0) html += `<div class="g-over early" style="left:${finX}px;width:${planEnd - finX}px"></div>`;
      html += `<div class="g-fin ${cls}" style="left:${finX}px" title="${esc(finText(x))}"><b>${esc(finShort(v))}</b></div>`;
    }
    return html;
  }

  // ข้อความเทียบแผน
  function finShort(v) { return v > 0 ? t("fin.lateS", { n: v }) : v < 0 ? t("fin.earlyS", { n: -v }) : t("fin.ontimeS"); }
  function finText(x) {
    const v = TS.variance(x);
    const rel = v > 0 ? t("fin.late", { n: v }) : v < 0 ? t("fin.early", { n: -v }) : t("fin.ontime");
    return `${t("fin.on", { d: fmt(TS.finishDate(x)) })} · ${rel}`;
  }

  // ป้าย "Today" ในแถวชื่อเดือน: ปกติอยู่ซ้ายของเส้น (ลูกศร ▸ ชี้เส้น)
  // ถ้าจะทับชื่อเดือน (วันนี้อยู่ต้นเดือน) → ย้ายไปต่อท้ายชื่อเดือน แล้วลากลูกศรชี้กลับมาที่เส้น
  let lastTodayX = 0;
  function placeTodayTag(root, todayX = lastTodayX) {
    lastTodayX = todayX;
    root.querySelectorAll(".g-tag").forEach((el) => el.remove());
    const spans = [...root.querySelectorAll(".g-months span")];
    spans.forEach((s) => { const e = s.querySelector("em"); if (e) e.style.visibility = ""; });
    const base = root.getBoundingClientRect().left;          // ตำแหน่งในตาราง (รวมการเลื่อนแล้ว)
    const lineX = gl() + todayX;
    const label = t("g.todayTag");
    const tag = document.createElement("div");
    tag.className = "g-tag";
    root.appendChild(tag);
    // ชื่อเดือนของเดือนนี้ — ใช้ตำแหน่งที่เห็นจริง (ชื่อเดือนเกาะขอบซ้ายตอนเลื่อน)
    const own = spans.find((s) => parseFloat(s.style.left) <= todayX && todayX < parseFloat(s.style.left) + parseFloat(s.style.width));
    const em = own && own.querySelector("em");
    const nameRight = em && em.textContent ? em.getBoundingClientRect().right - base : -Infinity;

    tag.innerHTML = `<span>${esc(label)}</span><i>▸</i>`;
    const w = tag.offsetWidth;
    let left = lineX - 3 - w;
    if (left >= nameRight + 8) {
      tag.classList.add("before");                       // today ▸|
    } else {
      tag.innerHTML = `<i>◂</i><span>${esc(label)}</span>`;
      left = Math.max(lineX + 3, nameRight + 8);          // |… ◂ today (ต่อท้ายชื่อเดือน ไม่มีเส้นลาก)
      tag.classList.add("after");
    }
    tag.style.left = left + "px";
    // ซ่อนชื่อเดือนอื่นที่ป้ายไปทับ (เช่นมุมมองปีที่เดือนแคบ)
    const tr = tag.getBoundingClientRect();
    spans.forEach((s) => {
      const e = s.querySelector("em"); if (!e || s === own || !e.textContent) return;
      const r = e.getBoundingClientRect();
      if (r.right > tr.left - 4 && r.left < tr.right + 4) e.style.visibility = "hidden";
    });
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
        <li><a ${TE.linkAttrs(l.url)}>
          <span class="doc-type ${TS.isNetPath(l.url) ? "net" : ""}">${esc(TS.linkType(l.url))}</span><span class="doc-name">${esc(l.name || l.url)}</span><span class="doc-go">${TE.linkGo(l.url)}</span></a>${TS.officeUri(l.url)
          ? `<button class="doc-copy" data-copy-path="${esc(TS.netPath(l.url))}" title="${esc(t("net.copyBtn"))}" aria-label="${esc(t("net.copyBtn"))}">⧉</button>` : ""}</li>`).join("")}</ul>`
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

  // เรียงตามความเร่งด่วน: เลยกำหนด → ใกล้กำหนดส่ง → เสร็จแล้ว (ล่าสุดก่อน)
  function sorted() {
    const rank = (x) => ({ late: 0, done: 2 }[TS.state(x)] ?? 1);
    return TS.tasks
      .filter((x) => !(hideDone && TS.progress(x) === 100))
      .sort((a, b) => rank(a) - rank(b) ||
        (rank(a) === 2 ? parse(TS.finishDate(b) || b.due) - parse(TS.finishDate(a) || a.due) : parse(a.due) - parse(b.due)));
  }

  // ---------- B: มุมมองรายการ (การ์ด) สำหรับมือถือ ----------
  function renderList(root, list) {
    const finCls = (x) => (TS.variance(x) > 0 ? "late" : TS.variance(x) < 0 ? "early" : "ontime");
    root.innerHTML = `<div class="gl-list">${list.map((x) => {
      const id = String(x.id), subs = x.subtasks || [], open = expanded.has(id);
      const st = TS.state(x), p = TS.progress(x);
      const ordered = subs.map((s, i) => ({ s, i }))
        .sort((a, b) => (a.s.due || "").localeCompare(b.s.due || "") || (a.s.start || "").localeCompare(b.s.start || "") || a.i - b.i);
      return `
      <div class="gl-card st-${st} ${open ? "open" : ""}" data-id="${esc(id)}">
        <div class="gl-top">
          <button class="g-chev ${subs.length ? "" : "none"}" data-toggle="${esc(id)}" aria-expanded="${open}" aria-label="${esc(L(x.name))}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m9 6 6 6-6 6"/></svg>
          </button>
          <div class="gl-name" data-toggle="${esc(id)}"><b>${esc(L(x.name))}</b><small>${stLabel(st)} · ${fmt(x.start)} → ${fmt(x.due)}${subs.length ? " · " + t("task.subs", { n: subs.length }) : ""}</small></div>
          <button class="icon-btn sm edit-only g-edit" data-edit="${esc(id)}" aria-label="${t("edit.row")}" title="${t("edit.row")}">✎</button>
        </div>
        <div class="gl-prog">
          <span class="g-pct">${p}%</span>
          <div class="gl-bar"><i style="width:${p}%"></i></div>
          ${docBtn(x, id, "")}
        </div>
        <div class="gl-meta">${wd(x)}${x.project ? `<small>#${esc(x.project)}</small>` : ""}${TS.finishDate(x) ? `<span class="g-finbadge ${finCls(x)}">${esc(finText(x))}</span>` : ""}</div>
        ${open ? `
        <ul class="gl-subs">${ordered.map(({ s, i }) => {
          const sst = TS.state(s), sp = TS.progress(s);
          return `
          <li class="st-${sst}">
            <i class="g-dot"></i>
            <div class="gl-sname"><b>${esc(L(s.name))}</b><small>${fmt(s.start)} → ${fmt(s.due)} · ${stLabel(sst)}</small></div>
            ${docBtn(s, id, i)}
            <span class="g-pct">${sp}%</span>
          </li>`; }).join("")}
        </ul>
        ${x.desc ? `<div class="g-desc">${esc(L(x.desc))}</div>` : ""}` : ""}
      </div>`;
    }).join("")}</div>`;
    if (!focused) {
      focused = true;
      const row = focusId && root.querySelector(`.gl-card[data-id="${CSS.escape(focusId)}"]`);
      if (row) row.scrollIntoView({ block: "center" });
    }
  }

  function render() {
    const root = $("gantt");
    const doneCount = TS.tasks.filter((x) => TS.progress(x) === 100).length;
    $("g-hide").textContent = t(hideDone ? "g.showDone" : "g.hideDone", { n: doneCount });
    $("g-hide").classList.toggle("on", hideDone);
    const card = document.querySelector(".gantt"), lm = listMode();
    card.classList.toggle("compact", mqCompact.matches && !lm);
    card.classList.toggle("list", lm);
    card.style.setProperty("--scw", $("g-scroll").clientWidth + "px");
    document.body.classList.toggle("g-listmode", lm);
    document.querySelectorAll("#g-mode .seg-btn").forEach((b) => b.classList.toggle("on", b.dataset.m === (lm ? "list" : "tl")));
    if (!TS.tasks.length) { root.innerHTML = `<div class="empty" style="margin:16px">${TS.error ? t("load.fail") : t("task.empty")}</div>`; return; }
    const list = sorted();
    if (lm) return renderList(root, list);
    const dw = dayW(), r = range();
    let html = header(r, dw) + "<!--off-->";

    list.forEach((x) => {
      const id = String(x.id), subs = x.subtasks || [], open = expanded.has(id);
      const st = TS.state(x), p = TS.progress(x);
      // 1 กลุ่ม = หัวข้องาน + งานย่อย + สรุป (ไม่มีเส้นคั่นภายในกลุ่ม)
      html += `
      <div class="g-group st-${st} ${open ? "open" : ""}">
        <div class="g-row g-task g-body-row" data-id="${esc(id)}">
          <div class="g-left">
            <button class="g-chev" data-toggle="${esc(id)}" aria-expanded="${open}" aria-label="${esc(L(x.name))}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m9 6 6 6-6 6"/></svg>
            </button>
            <i class="g-dot"></i>
            <div class="g-name" title="${esc(L(x.name))}"><b>${esc(L(x.name))}</b><small>${stLabel(st)}<span class="g-when"> · ${fmt(x.start)} → ${fmt(x.due)}</span>${subs.length ? " · " + t("task.subs", { n: subs.length }) : ""}</small></div>
            ${docBtn(x, id, "")}
            <span class="g-pctbox"><span class="g-pct">${p}%</span>${wd(x)}</span>
            <button class="icon-btn sm edit-only g-edit" data-edit="${esc(id)}" aria-label="${t("edit.row")}" title="${t("edit.row")}">✎</button>
          </div>
          <div class="g-right" style="width:${r.n * dw}px">${bar(x, r, dw, false)}</div>
        </div>`;

      if (open) {
        // เรียงงานย่อยตาม target (กำหนดเสร็จ) → วันเริ่ม; i = ลำดับเดิมในข้อมูล (ใช้หาเอกสาร)
        const ordered = subs.map((s, i) => ({ s, i }))
          .sort((a, b) => (a.s.due || "").localeCompare(b.s.due || "") || (a.s.start || "").localeCompare(b.s.start || "") || a.i - b.i);
        ordered.forEach(({ s, i }, k) => {
          const sst = TS.state(s), sp = TS.progress(s);
          html += `
        <div class="g-row g-sub g-body-row st-${sst} ${k === ordered.length - 1 ? "last" : ""}">
          <div class="g-left">
            <i class="g-dot"></i>
            <div class="g-name" title="${esc(L(s.name))}"><b>${esc(L(s.name))}</b><small>${fmt(s.start)} → ${fmt(s.due)} · ${stLabel(sst)}</small></div>
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
            <div class="g-dates"><span class="g-badge">${stLabel(st)}</span>${fmt(x.start)} → ${fmt(x.due)}${x.project ? " · #" + esc(x.project) : ""}${TS.finishDate(x) ? ` <span class="g-finbadge ${TS.variance(x) > 0 ? "late" : TS.variance(x) < 0 ? "early" : "ontime"}">${esc(finText(x))}</span>` : ""}</div>
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
    const todayX = days(r.start, today) * dw + dw / 2;
    // เส้นวันนี้: เริ่มใต้หัวตาราง และอยู่หลังแถบงาน/ตัวหนังสือ (ไม่ขีดทับข้อความ)
    off += `<div class="g-today" style="left:calc(var(--gl) + ${todayX}px)"></div>`;
    html = html.replace("<!--off-->", off);
    root.innerHTML = html;
    root.style.setProperty("--dw", dw + "px");
    placeTodayTag(root, todayX);

    // ครั้งแรก: เปิดงานที่ดับเบิลคลิกมา แล้วเลื่อนไปหา
    if (!focused) {
      focused = true;
      const row = focusId && root.querySelector(`.g-task[data-id="${CSS.escape(focusId)}"]`);
      const sc = $("g-scroll");
      if (row) {
        const x = TS.find(focusId);
        sc.scrollLeft = days(r.start, parse(x.start || x.due)) * dw - 24;
        row.scrollIntoView({ block: "center" });
      } else if (focusDate) {
        sc.scrollLeft = days(r.start, parse(focusDate)) * dw - (sc.clientWidth - gl()) / 4;
      } else {
        toPeriod(false);
      }
    }
  }

  // เลื่อนตาราง → จัดตำแหน่งป้าย Today ใหม่ (ชื่อเดือนเกาะขอบซ้าย)
  $("g-scroll").addEventListener("scroll", () => { if ($("gantt").querySelector(".g-today")) placeTodayTag($("gantt")); }, { passive: true });

  // ---------- คลิกซ้ายค้างแล้วลาก = เลื่อนตาราง ----------
  (function dragScroll() {
    const sc = $("g-scroll");
    let drag = null, moved = false;
    sc.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      if (e.target.closest("button, a, input, select, textarea, .g-doc")) return;
      drag = { x: e.clientX, y: e.clientY, left: sc.scrollLeft, top: scrollY };
      moved = false;
    });
    addEventListener("pointermove", (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      if (!moved) { moved = true; sc.classList.add("dragging"); }
      sc.scrollLeft = drag.left - dx;
      scrollTo({ top: drag.top - dy, behavior: "instant" });
      e.preventDefault();
    });
    const end = () => { if (!drag) return; drag = null; sc.classList.remove("dragging"); };
    addEventListener("pointerup", end);
    addEventListener("pointercancel", end);
    // ลากเสร็จแล้วไม่ให้นับเป็นการคลิก (เช่น ไม่เปิด/ปิด dropdown)
    sc.addEventListener("click", (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
  })();

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
    // zoom อิสระอยู่ → ให้วันนี้อยู่ราว 1/4 ของจอ, ไม่งั้นเริ่มที่ต้นช่วง (สัปดาห์/เดือน/…)
    const left = customDays ? (days(r.start, today) - spanDays() / 4) * dayW() : days(r.start, period(view)[0]) * dayW();
    sc.scrollTo({ left, behavior: smooth ? "smooth" : "auto" });
  }

  // ---------- หมุนล้อเมาส์บนตาราง = zoom in/out (ทีละ 1–2 วัน) ----------
  (function wheelZoom() {
    const sc = $("g-scroll");
    let acc = 0, anchor = null, pending = false;
    sc.addEventListener("wheel", (e) => {
      if (listMode() || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // มุมมองรายการ / เลื่อนแนวนอน (touchpad) ปล่อยตามปกติ
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 300 : e.deltaY;
      acc += dy;
      if (Math.abs(acc) < 60) return;                       // 1 คลิกล้อ ≈ 100
      const dir = Math.sign(acc); acc = 0;
      const r = range(), dw = dayW();
      const px = Math.max(0, e.clientX - sc.getBoundingClientRect().left - gl());
      // จำวันที่ใต้เคอร์เซอร์ไว้ ให้อยู่ที่เดิมหลัง zoom
      anchor = { ms: r.start.getTime() + ((sc.scrollLeft + px) / dw) * DAY, px };
      const cur = spanDays();
      const step = cur <= 31 ? 1 : cur <= 62 ? 2 : Math.max(2, Math.round(cur * 0.04));
      customDays = Math.min(730, Math.max(3, Math.round(cur + dir * step)));
      document.querySelectorAll("#zoom .seg-btn").forEach((x) => x.classList.remove("on"));
      if (pending) return;
      pending = true;
      setTimeout(() => {
        pending = false;
        focused = true; render();
        const r2 = range();
        sc.scrollLeft = ((anchor.ms - r2.start.getTime()) / DAY) * dayW() - anchor.px;
      }, 16);
    }, { passive: false });
  })();

  // ---------- มือถือ/iPad: ใช้ 2 นิ้วถ่าง/หุบ = zoom, นิ้วเดียวเลื่อนตามปกติ ----------
  (function pinchZoom() {
    const sc = $("g-scroll");
    let pz = null, pending = false;
    const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    sc.addEventListener("touchstart", (e) => {
      if (e.touches.length !== 2 || listMode()) return;
      const [a, b] = e.touches, r = range(), dw = dayW();
      const px = Math.max(0, (a.clientX + b.clientX) / 2 - sc.getBoundingClientRect().left - gl());
      // จำวันที่ตรงกลางระหว่าง 2 นิ้วไว้ ให้อยู่ที่เดิมระหว่าง zoom
      pz = { d0: Math.max(20, dist(a, b)), days0: spanDays(), ms: r.start.getTime() + ((sc.scrollLeft + px) / dw) * DAY, px };
    }, { passive: true });
    sc.addEventListener("touchmove", (e) => {
      if (!pz || e.touches.length !== 2) return;
      e.preventDefault();                                   // ไม่ให้เบราว์เซอร์ซูมทั้งหน้า
      const [a, b] = e.touches;
      const next = Math.min(730, Math.max(3, Math.round(pz.days0 * pz.d0 / Math.max(20, dist(a, b)))));
      if (next === customDays) return;
      customDays = next;
      document.querySelectorAll("#zoom .seg-btn").forEach((x) => x.classList.remove("on"));
      if (pending) return;
      pending = true;
      setTimeout(() => {
        pending = false; if (!pz) return;
        focused = true; render();
        sc.scrollLeft = ((pz.ms - range().start.getTime()) / DAY) * dayW() - pz.px;
      }, 30);
    }, { passive: false });
    const end = (e) => { if (e.touches.length < 2) pz = null; };
    sc.addEventListener("touchend", end);
    sc.addEventListener("touchcancel", end);
    // Safari (iPhone/iPad) มี gesture event ของตัวเอง — กันไม่ให้ซูมทั้งหน้า
    sc.addEventListener("gesturestart", (e) => e.preventDefault());
  })();
  $("zoom").addEventListener("click", (e) => {
    const b = e.target.closest(".seg-btn"); if (!b) return;
    document.querySelectorAll("#zoom .seg-btn").forEach((x) => x.classList.toggle("on", x === b));
    view = b.dataset.z; customDays = null; focused = true; render(); toPeriod(false);
  });
  $("g-today").addEventListener("click", () => toPeriod(true));
  $("g-mode").addEventListener("click", (e) => {
    const b = e.target.closest(".seg-btn"); if (!b || b.dataset.m === modePref) return;
    modePref = b.dataset.m;
    try { localStorage.setItem("g_mode", modePref); } catch {}
    render(); if (!listMode()) toPeriod(false);
  });
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
