# THE ABLE SECRET TEAM 🐬🐳🦈

เกมจับทีมลับสำหรับพนักงาน — Next.js 15 + TypeScript + Tailwind + Supabase

## สถานะ: Phase 1 — Foundation ✅

สิ่งที่ทำเสร็จในเฟสนี้:
- ✅ Next.js 15.5.21 project (patched, 0 vulnerabilities — `npm audit` ผ่าน)
- ✅ Bright Fantasy UI theme (ฟ้า/ม่วง/แดง ตามสเปก ไม่ใช่ธีมมืด)
- ✅ Supabase connection (browser + server + admin clients)
- ✅ Authentication ด้วย **รหัสพนักงาน + รหัสผ่าน** (ไม่มีอีเมลในหน้าตาระบบเลย —
  ใช้อีเมลสมมติเบื้องหลังเพื่อให้ Supabase Auth ทำงาน)
- ✅ Database schema เต็ม 15 ตาราง + RLS ครบทุกตาราง
- ✅ ฟังก์ชันความปลอดภัยหลัก: `my_team()`, `cast_vote()`, `votable_players()`,
  `ranking_board()`, `my_vote_status()`, `round_summary()` — ออกแบบให้ Team ID
  และผลโหวตถูก/ผิด **ไม่มีทางหลุดไปที่ Browser ได้เลย** แม้แต่ของตัวเอง
- ✅ Admin สร้างบัญชีผู้เล่น (ไม่มีอัปโหลดสลิป ไม่มีขั้นตอนรออนุมัติ ตามที่ตกลง)
- ✅ Build ผ่านจริง: `npm run build` → 6 routes, TypeScript type-check ผ่าน

## Quick Start

```bash
npm install
cp .env.example .env.local   # ใส่ค่า Supabase ของคุณ
npm run dev                  # http://localhost:3000
```

ดู `docs/SETUP.md` สำหรับการตั้งค่า Supabase และสร้าง Super Admin คนแรก

## โครงสร้างโปรเจกต์

```
able-secret-team/
├── src/app/
│   ├── page.tsx              # Login (รหัสพนักงาน + รหัสผ่าน)
│   ├── route/page.tsx        # ตัวส่งไปหน้าที่ถูกต้องตาม role
│   ├── play/page.tsx         # หน้าผู้เล่น (Phase 1: placeholder แสดงทีม)
│   ├── admin/page.tsx        # หน้า Admin (Phase 1: สร้างบัญชีผู้เล่น)
│   └── api/admin/create-player/route.ts
├── src/lib/
│   ├── types.ts
│   ├── supabase.ts           # browser/admin clients + employeeIdToEmail()
│   └── auth.ts                # server client + requireAdmin()
├── supabase/
│   ├── 01_schema.sql          # 15 ตาราง
│   ├── 02_rls.sql             # RLS + security functions
│   └── 03_seed.sql            # teams, card_types, system_settings
└── docs/SETUP.md
```

## กติกาเกม (สรุปย่อ — อ้างอิงจาก Game Design Document ที่ยืนยันแล้ว)

- 3 ทีมลับ: 🐬 โลมา / 🐳 วาฬ / 🦈 ฉลาม — สุ่มเกลี่ยจำนวน ผู้เล่นไม่รู้ทีมคนอื่น
- ทุกวันพฤหัสโหวต 1 คนที่คิดว่าเป็นศัตรู · ศุกร์ Admin ประมวลผล (Preview→Publish)
- โหวตถูกทีม +10 / โหวตทีมเดียวกัน -5 / ไม่โหวต 0 — **ผู้เล่นไม่เห็นว่าตัวเองโหวตถูกหรือผิด**
- คัดคนโหวตแม่นน้อยสุดออกเป็น Ghost Mode (ยัง login/ดูผลได้ แต่โหวต/ถูกโหวตไม่ได้)
- การ์ดพิเศษ 3 แบบ (Revive/Reveal/Team Switch) — **ไม่มีร้านค้าในเว็บ**
  จ่ายเงินนอกระบบ Admin มอบการ์ดให้ตรงในหน้า Admin
- รางวัล: อันดับ 1-3 + MVP นักสู้ (Admin กรอกยอดซื้อการ์ดด้วยมือ) + Lucky Draw
- สมัครเข้าเกม: **ไม่มีการสมัครเองในเว็บ** — Admin เก็บเงินบริจาค CSR นอกระบบ
  แล้วสร้างบัญชี (รหัสพนักงาน+รหัสผ่าน) ให้ตรงๆ ใช้งานได้ทันที

## Phase ถัดไป (ยังไม่ทำ)

- **Phase 2:** Player Dashboard เต็มรูปแบบ, หน้าโหวต, Ranking, Weekly Result
- **Phase 3:** My Cards (ใช้การ์ด), Admin มอบการ์ด/บันทึกยอดซื้อ
- **Phase 4:** Admin Dashboard เต็ม (Team Management, Round Processing, Reports/CSV)
- **Phase 5:** Prize Calculation, Lucky Draw, Audit Log UI, Testing, Deployment
