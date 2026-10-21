// หน้า Intro: code rain + boot log + "Welcome to my site" แบบ decode แล้วกดปุ่มเพื่อเข้าเว็บ
(function () {
  const intro = document.getElementById("intro");
  const site = document.getElementById("site");
  const btn = document.getElementById("enter-btn");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sleep = (ms) => new Promise((r) => setTimeout(r, reduce ? 0 : ms));

  // ---------- code rain ----------
  const cv = document.getElementById("rain");
  const ctx = cv.getContext("2d");
  const glyphs = "01{}[]<>/=;:$#*+アイウエオカキクケコ";
  let cols = [], fs = 16, raf = 0;
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fs = innerWidth < 640 ? 13 : 16;
    cols = Array.from({ length: Math.ceil(innerWidth / fs) }, () => Math.random() * -innerHeight / fs);
  }
  function draw() {
    ctx.fillStyle = "rgba(4, 6, 10, 0.12)";
    ctx.fillRect(0, 0, innerWidth, innerHeight);
    ctx.font = `${fs}px JetBrains Mono, monospace`;
    cols.forEach((y, i) => {
      const x = i * fs;
      // หัวสาย สว่างกว่า, กลางจอจางลงให้อ่านข้อความง่าย
      const mid = 1 - Math.max(0, 1 - Math.abs(x - innerWidth / 2) / (innerWidth * 0.35)) * 0.75;
      ctx.fillStyle = Math.random() > 0.96 ? `rgba(220,255,240,${0.9 * mid})` : `rgba(54,241,160,${0.55 * mid})`;
      ctx.fillText(glyphs[(Math.random() * glyphs.length) | 0], x, y * fs);
      cols[i] = y * fs > innerHeight && Math.random() > 0.975 ? 0 : y + 0.55;
    });
    raf = requestAnimationFrame(draw);
  }
  resize(); addEventListener("resize", resize);
  if (!reduce) draw();

  // ---------- boot log ----------
  const boot = document.getElementById("boot");
  const t = (k) => window.I18N.t(k);
  const lines = () => [
    ["$ ssh guest@apiwat.dev", ""],
    [t("intro.boot2"), t("intro.ok")],
    [t("intro.boot3"), t("intro.ok")],
  ];
  let bootDone = false, titleDone = false;
  async function runBoot() {
    for (const [txt, ok] of lines()) {
      const row = document.createElement("div");
      boot.appendChild(row);
      for (let i = 0; i <= txt.length; i++) { row.textContent = txt.slice(0, i); await sleep(18); }
      if (ok) { await sleep(180); row.innerHTML += `<span class="ok">${ok}</span>`; }
      await sleep(140);
    }
    bootDone = true;
  }
  const renderBoot = () => (boot.innerHTML = lines().map(([a, ok]) => `<div>${a}${ok ? `<span class="ok">${ok}</span>` : ""}</div>`).join(""));

  // ---------- decode title ----------
  const title = document.getElementById("intro-title");
  const CH = "!<>-_\\/[]{}=+*^?#01";
  function decode() {
    return new Promise((done) => {
      const TEXT = t("intro.title");
      if (reduce) { title.innerHTML = `<span class="done">${TEXT}</span>`; return done(); }
      const start = performance.now();
      (function frame(now) {
        const p = (now - start) / 1600;
        const fixed = Math.floor(p * TEXT.length);
        let scr = "";
        for (let i = fixed; i < TEXT.length; i++) scr += TEXT[i] === " " ? " " : CH[(Math.random() * CH.length) | 0];
        title.innerHTML = `<span class="done">${TEXT.slice(0, fixed)}</span><span class="scr">${scr}</span>`;
        if (fixed < TEXT.length) requestAnimationFrame(frame);
        else { title.innerHTML = `<span class="done">${TEXT}</span>`; titleDone = true; done(); }
      })(start);
    });
  }

  const sub = document.getElementById("intro-sub");
  const hint = document.getElementById("intro-hint");
  (async () => {
    await sleep(300);
    await runBoot();
    await sleep(200);
    await decode();
    sub.classList.add("show");
    await sleep(500);
    btn.classList.add("show");
    hint.classList.add("show");
    if (!entered) btn.focus({ preventScroll: true });
  })();

  // เปลี่ยนภาษาระหว่างอยู่หน้า intro
  document.addEventListener("lang:change", () => {
    if (bootDone) renderBoot();
    if (titleDone) title.innerHTML = `<span class="done">${t("intro.title")}</span>`;
  });

  // ---------- enter ----------
  let entered = false;
  function enter() {
    if (entered || !btn.classList.contains("show")) return;
    entered = true;
    intro.classList.add("leave");
    document.body.classList.remove("locked");
    site.classList.add("in");
    document.dispatchEvent(new Event("site:enter"));
    setTimeout(() => { cancelAnimationFrame(raf); intro.remove(); }, 950);
  }
  btn.addEventListener("click", enter);

  // กลับมาจากหน้า timeline → ข้าม intro แล้วไปที่ส่วนเดิม
  try {
    const nav = performance.getEntriesByType("navigation")[0];
    if (sessionStorage.getItem("skipIntro") || (nav && nav.type === "back_forward")) {
      sessionStorage.removeItem("skipIntro");
      btn.classList.add("show");
      enter();
      intro.style.transition = "none";
      const target = location.hash && document.querySelector(location.hash);
      if (target) requestAnimationFrame(() => target.scrollIntoView());
    }
  } catch {}
  addEventListener("keydown", (e) => { if (e.key === "Enter" && !entered && !e.target.closest?.(".lang-btn")) enter(); });
})();
