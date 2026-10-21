// ============================================================
//  แก้ข้อมูลบนเว็บที่ไฟล์นี้ไฟล์เดียว
//  ข้อความที่ต้องแปล ให้เขียนเป็น { en: "...", th: "..." }
//  ชื่อเฉพาะ (ชื่อคน บริษัท ภาษาโปรแกรม) ใส่เป็น string ธรรมดาได้เลย
// ============================================================

window.SITE = {
  name: "Apiwat Kamsiri",
  handle: "apiwat",
  role: { en: "Software Engineer", th: "วิศวกรซอฟต์แวร์" },
  company: "Arçelik Hitachi Home Appliances (Thailand)",
  tagline: {
    en: ["build things.", "automate stuff.", "ship it."],
    th: ["สร้างสิ่งใหม่ ๆ", "ทำระบบอัตโนมัติ", "ส่งงานให้ทันเวลา"],
  },
  location: { en: "Thailand", th: "ประเทศไทย" },
  email: "apiwatkamsiri@gmail.com",
  workEmail: "apiwat.kamsiri@arcelik-hitachi.com",
  // รูปโปรไฟล์: วางไฟล์ไว้ที่ assets/img/ แล้วใส่ path เช่น "assets/img/profile.jpg"
  // ถ้าเว้นว่าง จะแสดงตัวอักษรย่อแทน
  photo: "",
  github: "https://github.com/ApiwatKamsiri-WebSite",
  phone: "0901081663",
  stack: ["Python", "C / C++", "JavaScript", "ESP32", "Git", "SQL"],

  // ประวัติการทำงาน — ใหม่สุดไว้บนสุด
  experience: [
    {
      hash: "a1f3c9e",
      period: { en: "2022 — Present", th: "2022 — ปัจจุบัน" },
      title: { en: "Software Engineer", th: "วิศวกรซอฟต์แวร์" },
      org: "Arçelik Hitachi Home Appliances (Thailand)",
      points: [
        { en: "Build tools to collect and analyze device logs", th: "พัฒนาเครื่องมือเก็บ log และวิเคราะห์ข้อมูลจากอุปกรณ์" },
        { en: "Automate the team's manual work", th: "ทำระบบอัตโนมัติลดงาน manual ของทีม" },
      ],
      tags: ["Python", "ESP32"],
    },
    {
      hash: "5d2b7a0",
      period: { en: "2020 — 2021", th: "2020 — 2021" },
      title: { en: "Software Engineer", th: "วิศวกรซอฟต์แวร์" },
      org: "Hitachi Consumer Products (Thailand)",
      points: [],
      tags: [],
    },
    {
      hash: "0c99e12",
      period: { en: "Graduated 2019", th: "จบปี 2019" },
      title: { en: "B.Eng. Electrical Engineering", th: "วศ.บ. วิศวกรรมไฟฟ้า" },
      org: { en: "Suranaree University of Technology", th: "มหาวิทยาลัยเทคโนโลยีสุรนารี" },
      points: [],
      tags: ["init"],
    },
  ],

  // นาฬิกา — ตัวแรกคือเวลาหลัก (home)
  clocks: [
    { code: "TH", name: { en: "Thailand", th: "ไทย" }, tz: "Asia/Bangkok" },
    { code: "JP", name: { en: "Japan", th: "ญี่ปุ่น" }, tz: "Asia/Tokyo" },
    { code: "TR", name: { en: "Turkey", th: "ตุรกี" }, tz: "Europe/Istanbul" },
  ],

  // งาน, วันหยุด และลิงก์ทางลัด — เก็บใน data/tasks.json (แก้ได้จากหน้าเว็บในโหมดแก้ไข)
  // repo ที่หน้าเว็บจะบันทึกไฟล์งานลงไป
  repo: { owner: "ApiwatKamsiri-WebSite", name: "ApiwatKamsiri-WebSite.github.io", branch: "main", tasksPath: "data/tasks.json" },
};

// คลังส่วนตัว (vault) — เข้ารหัส AES-GCM ด้วย PIN ของเจ้าของ (ห้ามเขียน PIN ลงไฟล์ใด ๆ)
// สร้างค่าใหม่ได้ที่ tools/encrypt.html แล้ววางทับค่านี้
window.VAULT = {
  "v": 1,
  "salt": "HmvmyfgguAnlhq8D6ON5rw==",
  "iv": "MVLipf2mBPjAmpmh",
  "data": "dKch88mnLhRyjjxP5XfnzDsS"
};
