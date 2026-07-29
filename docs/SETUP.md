# Supabase Setup — THE ABLE SECRET TEAM

## 1. รัน SQL ตามลำดับ
Supabase → **SQL Editor → New query** → รันทีละไฟล์:
1. `supabase/01_schema.sql`
2. `supabase/02_rls.sql`
3. `supabase/03_seed.sql`

## 2. ปิด Email Confirmation
**Authentication → Providers → Email → ปิด "Confirm email" → Save**
(จำเป็น เพราะบัญชีทุกใบสร้างผ่าน Admin API ด้วยอีเมลสมมติ ไม่มีการยืนยันอีเมลจริง)

## 3. สร้าง Super Admin คนแรก (ทำครั้งเดียว, ด้วยมือ)
เนื่องจากไม่มีระบบสมัครเองในเกมนี้ Super Admin คนแรกต้องสร้างผ่าน Supabase Dashboard โดยตรง:

1. **Authentication → Users → Add user**
   - Email: `admin@ablesecretteam.internal` (หรือโดเมนที่ตั้งใน `NEXT_PUBLIC_AUTH_EMAIL_DOMAIN`)
   - Password: ตั้งรหัสผ่านที่ปลอดภัย
   - ✅ Auto Confirm User
2. คัดลอก User UID ที่ได้
3. **Table Editor → profiles → Insert row**
   - `user_id`: UID ที่คัดลอกมา
   - `employee_id`: `admin`
   - `full_name`: ชื่อคุณ
   - `role`: `super_admin`
   - `player_status`: `active`
4. เข้า `/admin` ด้วย รหัสพนักงาน `admin` + รหัสผ่านที่ตั้งไว้

จากนั้น Super Admin คนนี้สร้างบัญชี Admin/Player คนอื่นต่อได้จากหน้า `/admin` ตามปกติ

## 4. Environment Variables
คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ค่าจริงจาก Supabase Project Settings → API
