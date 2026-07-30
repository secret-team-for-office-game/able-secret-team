# Deployment Guide — GitHub → Vercel

## 1. Push ขึ้น GitHub

```bash
cd able-secret-team
git init
git add .
git commit -m "THE ABLE SECRET TEAM — Phase 1-5 complete"
git remote add origin https://github.com/YOUR_USERNAME/able-secret-team.git
git branch -M main
git push -u origin main
```

## 2. Deploy บน Vercel

1. https://vercel.com → **Add New → Project** → เลือก repo `able-secret-team`
2. ใส่ Environment Variables 4 ตัว:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_AUTH_EMAIL_DOMAIN` (เช่น `ablesecretteam.internal`)
3. กด **Deploy**

## 3. ตั้งค่าหลัง Deploy
- Supabase → Authentication → URL Configuration → Site URL = โดเมน Vercel ของคุณ
- ทำตาม `docs/SETUP.md` เพื่อสร้าง Super Admin คนแรก

## 4. อัปเดตภายหลัง
```bash
git add . && git commit -m "อัปเดต: ..." && git push
# Vercel deploy ใหม่อัตโนมัติ
```

## URLs ที่ได้
- Production: `https://your-app.vercel.app`
- Admin: `https://your-app.vercel.app/admin`
