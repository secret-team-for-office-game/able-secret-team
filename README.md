# THE ABLE SECRET TEAM 🐬🐳🦈

เกมจับทีมลับสำหรับพนักงาน — Next.js 15 + TypeScript + Tailwind + Supabase

## สถานะ: Phase 1-5 ครบทุกเฟส ✅

- ✅ **Phase 1 — Foundation:** Next.js 15.5.21 (0 vulnerabilities), Supabase connection,
  Auth ด้วยรหัสพนักงาน+รหัสผ่าน (ไม่มีอีเมลในระบบเลย), Database 15 ตาราง + RLS ครบ
- ✅ **Phase 2 — Player System:** Player Dashboard, หน้าโหวต (เชื่อม `cast_vote()`),
  Ranking, Weekly Result (`round_summary()`)
- ✅ **Phase 3 — Cards & CSR:** My Cards, ใช้การ์ด Revive/Reveal/Team Switch
  (ผ่านฟังก์ชัน security-definer ที่ตรวจสอบเองฝั่ง Server ทั้งหมด), Admin มอบการ์ด
  + บันทึกยอด CSR ด้วยมือ (ไม่มีอัปโหลดสลิป/อนุมัติในระบบ ตามที่ตกลง)
- ✅ **Phase 4 — Admin System:** Dashboard, Round Management (เปิด/ปิดโหวต →
  Preview → Publish), Export CSV (6 รายงาน)
- ✅ **Phase 5 — Prize & Production:** คำนวณอันดับ 1-3 อัตโนมัติจากคะแนน,
  MVP นักสู้จากยอด CSR ที่ Admin กรอก, Lucky Draw + Re-draw พร้อมบันทึกเหตุผล, Audit Log

**Build ผ่านจริง:** `npm run build` → 13 routes, TypeScript type-check ผ่าน, `npm audit` = 0 vulnerabilities

## Quick Start

```bash
npm install
cp .env.example .env.local   # ใส่ค่า Supabase ของคุณ
npm run dev                  # http://localhost:3000
```

ดู `docs/SETUP.md` สำหรับการตั้งค่า Supabase และสร้าง Super Admin คนแรก
ดู `docs/DEPLOYMENT.md` สำหรับการอัปขึ้น GitHub → Vercel

## SQL ที่ต้องรัน (ตามลำดับ)
1. `supabase/01_schema.sql`
2. `supabase/02_rls.sql`
3. `supabase/03_seed.sql`
4. `supabase/04_game_functions.sql` ← **ใหม่** (โหวต/การ์ด/รางวัลทั้งหมด)

## ความปลอดภัยที่ยึดตามสเปกข้อ 19
- Team ID ไม่เคยถูกส่งไปที่ Client เลย (เห็นผ่าน `my_team()` ของตัวเองเท่านั้น)
- คะแนน/ผลโหวตคำนวณบน Server ทั้งหมด (`admin_publish_round()`)
- Service Role Key ใช้เฉพาะในไฟล์ API route ฝั่ง server เท่านั้น
- ทุก Admin action ตรวจสิทธิ์ผ่าน `requireAdmin()` ก่อนเสมอ
- ทุกการสุ่ม/ประมวลผลบันทึก `audit_logs`
- `admin_publish_round()` เช็ค `status = 'published'` กันกดซ้ำ (idempotent)
- Card usage (`use_reveal_card`, `use_revive_card`, `use_team_switch_card`) ตรวจสอบ
  ความเป็นเจ้าของการ์ด + สถานะ + เงื่อนไขทั้งหมดฝั่ง Server ก่อนดำเนินการ

## โครงสร้างโปรเจกต์

```
able-secret-team/
├── src/app/
│   ├── page.tsx                    # Login (รหัสพนักงาน + รหัสผ่าน)
│   ├── route/page.tsx              # ตัวส่งไปหน้าที่ถูกต้องตาม role
│   ├── play/page.tsx                # ผู้เล่น: ทีม/โหวต/การ์ด/ผล/อันดับ
│   ├── admin/page.tsx               # Admin: Dashboard/สร้างผู้เล่น/รอบ/การ์ด/รางวัล/audit/export
│   └── api/
│       ├── vote/route.ts
│       ├── cards/use/route.ts
│       └── admin/{create-player,rounds,cards,prizes,export}/route.ts
├── src/lib/{types,supabase,auth}.ts
├── supabase/{01_schema,02_rls,03_seed,04_game_functions}.sql
└── docs/{SETUP,DEPLOYMENT,ADMIN_MANUAL,PLAYER_GUIDE}.md
```

## กติกาเกม (สรุปย่อ)
ดูรายละเอียดเต็มใน `docs/ADMIN_MANUAL.md` และ `docs/PLAYER_GUIDE.md`
