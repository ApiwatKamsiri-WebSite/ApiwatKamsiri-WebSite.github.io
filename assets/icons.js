// ============================================================
//  ไอคอนทั้งหมดของเว็บ (เส้น 24×24) + เลือกไอคอนอัตโนมัติจากลิงก์
//  ชื่อไอคอนสำหรับแสดงอยู่ใน i18n.js ("icon.<ชื่อ>")
// ============================================================
(function () {
  const FILE = '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>';
  const P = {
    dir: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M15 11v5m-2-3 2-2 2 2"/>',
    search: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v3"/><path d="M3 7v10a2 2 0 0 0 2 2h6"/><circle cx="17" cy="16" r="3"/><path d="m21 20-1.8-1.8"/>',
    file: FILE + '<path d="M9 13h6M9 16h4"/>',
    excel: FILE + '<path d="m9.5 12 4 5m0-5-4 5"/>',
    word: FILE + '<path d="m8.5 12 1.2 5 1.8-3.6 1.8 3.6 1.2-5"/>',
    powerpoint: FILE + '<path d="M10.5 17v-5h1.8a1.5 1.5 0 0 1 0 3h-1.8"/>',
    pdf: FILE + '<path d="M8.5 17v-4h1.2a1.2 1.2 0 0 1 0 2.4H8.5M15.5 13h-2v4M13.5 15h1.6"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
    zip: FILE + '<path d="M10 4v1.5M10 7v1.5M10 10v1.5"/><rect x="8.8" y="13" width="2.6" height="3.5" rx=".6"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    cloud: '<path d="M7 18a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.4 1.5A3.8 3.8 0 0 1 17.5 18z"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h7M8.5 14h4"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    app: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M6.5 6.5h.01M9 6.5h.01"/>',
    package: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>',
    code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>',
    terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M12 15h5"/>',
    server: '<rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/><path d="M7 7.5h.01M7 16.5h.01"/>',
    db: '<ellipse cx="11" cy="6" rx="7" ry="3"/><path d="M4 6v12c0 1.7 3.1 3 7 3M18 6v5"/><path d="m16 15 3 3-3 3m3-3h-6"/>',
    chip: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4"/>',
    tool: '<path d="M7 3v6m-2-6v4a2 2 0 0 0 4 0V3M7 9v12M17 3a3 3 0 0 0-3 3v5h3m0-8v18"/>',
    wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    install: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M12 12v6m-3-3 3 3 3-3"/>',
    sync: '<path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3M18 3v4h-4M6 21v-4h4"/>',
    chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/>',
    home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/>',
    video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3z"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
    star: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m12 7 1.5 3 3.3.5-2.4 2.3.6 3.2-3-1.6-3 1.6.6-3.2-2.4-2.3 3.3-.5z"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    // ใช้ภายในเว็บ (ไม่อยู่ในตัวเลือก)
    unlock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    auto: '<path d="m12 3 1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  };
  // สีประจำโปรแกรม (ที่เหลือใช้สีธีม)
  const COLOR = { excel: "#21a366", word: "#2b7cd3", powerpoint: "#e0683f", pdf: "#ff5f6d", chat: "#8b8cf7", mail: "#3b9cff" };
  // ลำดับในตารางเลือกไอคอน
  const LIST = ["auto", "dir", "folder", "file", "excel", "word", "powerpoint", "pdf", "image", "zip",
    "globe", "link", "cloud", "chat", "mail", "app", "package", "code", "terminal", "server",
    "db", "chip", "tool", "wrench", "gear", "shield", "install", "sync", "search", "chart",
    "calendar", "book", "users", "home", "video", "phone", "star", "lock"];

  // เลือกไอคอนจากลิงก์
  function auto(url) {
    const u = String(url || "").trim().toLowerCase();
    if (!u) return "link";
    const ext = (u.split(/[?#]/)[0].match(/\.([a-z0-9]{2,5})$/) || [])[1];
    const byExt = { xlsx: "excel", xls: "excel", xlsm: "excel", xlsb: "excel", csv: "excel", docx: "word", doc: "word", docm: "word",
      pptx: "powerpoint", ppt: "powerpoint", pptm: "powerpoint", pdf: "pdf", png: "image", jpg: "image", jpeg: "image", gif: "image", svg: "image",
      zip: "zip", rar: "zip", "7z": "zip", exe: "app", msi: "install", py: "code", js: "code", c: "code", h: "code", hex: "chip", bin: "chip",
      mp4: "video", mov: "video", txt: "file", log: "file" };
    if (ext && byExt[ext]) return byExt[ext];
    if (/^(\\\\|file:)/.test(u)) return "dir";
    if (/sharepoint\.com|onedrive|1drv\.ms|drive\.google/.test(u)) return "cloud";
    if (/teams\.microsoft|teams\.live/.test(u)) return "chat";
    if (/outlook\.|mailto:/.test(u)) return "mail";
    if (/github\.com|gitlab/.test(u)) return "code";
    return "globe";
  }
  const resolve = (key, url) => (!key || key === "auto" ? auto(url) : P[key] ? key : "link");
  function svg(key, size = 20, url = "") {
    const k = resolve(key, url);
    const c = COLOR[k] ? ` style="color:${COLOR[k]}"` : "";
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${c}>${P[k]}</svg>`;
  }
  const raw = (key, size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${COLOR[key] ? ` style="color:${COLOR[key]}"` : ""}>${P[key] || P.link}</svg>`;
  window.ICONS = { LIST, svg, raw, auto, resolve };
})();
