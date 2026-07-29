"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";

export default function Admin() {
  const supabase = supabaseBrowser();
  const [ok, setOk] = useState<boolean | null>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [department, setDepartment] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [created, setCreated] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setOk(false); return; }
      const { data } = await supabase.from("profiles").select("role").eq("user_id", user.id).single();
      setOk(data?.role === "admin" || data?.role === "super_admin");
    })();
  }, []);

  async function create() {
    setMsg(""); setCreated(null);
    if (!employeeId || !password || !fullName) return setMsg("กรอกรหัสพนักงาน รหัสผ่าน และชื่อ-สกุลให้ครบ");
    setBusy(true);
    const res = await fetch("/api/admin/create-player", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId, password, fullName, nickname, department }),
    });
    const json = await res.json();
    setBusy(false);
    if (json.error) return setMsg(json.error);
    setCreated(json);
    setEmployeeId(""); setPassword(""); setFullName(""); setNickname(""); setDepartment("");
  }

  if (ok === null) return <Center>กำลังตรวจสิทธิ์…</Center>;
  if (!ok) return (
    <Center>
      <div className="text-center">
        <div className="text-5xl mb-2">🔒</div>
        <p className="font-bold">ต้องเป็น Admin เท่านั้น</p>
        <p className="text-sm text-ink-soft mt-1">
          เข้าสู่ระบบด้วยบัญชี Admin ก่อน (ตั้งค่า role=&apos;admin&apos; หรือ &apos;super_admin&apos; ในตาราง profiles)
        </p>
        <a className="btn btn-primary btn-sm mt-3 inline-block" href="/">← กลับหน้าแรก</a>
      </div>
    </Center>
  );

  return (
    <main className="max-w-lg mx-auto px-4 py-6">
      <div className="card">
        <h2>🛠 THE ABLE SECRET TEAM · Admin</h2>
        <p className="lead">Phase 1: สร้างบัญชีผู้เล่น (หลังเก็บเงินบริจาค CSR นอกระบบแล้ว)</p>

        <div className="field"><label>รหัสพนักงาน</label>
          <input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="EMP1234" /></div>
        <div className="field"><label>รหัสผ่านเริ่มต้น</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="อย่างน้อย 6 ตัว" /></div>
        <div className="field"><label>ชื่อ-สกุล</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="สมชาย ใจดี" /></div>
        <div className="field"><label>ชื่อเล่น (ไม่บังคับ)</label>
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="สมชาย" /></div>
        <div className="field"><label>แผนก (ไม่บังคับ)</label>
          <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="HR" /></div>

        <button className="btn btn-primary btn-block" onClick={create} disabled={busy}>
          {busy ? "กำลังสร้าง…" : "สร้างบัญชี + สุ่มทีม →"}
        </button>
        {msg && <div className="text-bad font-bold mt-3 text-sm">{msg}</div>}

        {created && (
          <div className="stat mt-3" style={{ borderColor: "#3fa35e" }}>
            <div className="k">✅ สร้างสำเร็จ</div>
            <div className="font-bold">รหัสพนักงาน: {created.employeeId}</div>
            <div className="text-xs text-ink-soft mt-1">สุ่มเข้าทีม: {created.team} (อย่าบอกผู้เล่นว่าทีมไหน)</div>
          </div>
        )}

        <button className="btn btn-ghost btn-block mt-4"
                onClick={async () => { await supabase.auth.signOut(); location.href = "/"; }}>
          ออกจากระบบ
        </button>

        <p className="text-xs text-ink-soft mt-4">
          🚧 Phase 1: สร้างบัญชี + ระบบสิทธิ์พร้อมแล้ว Dashboard/โหวต/การ์ด/รางวัล จะตามมาใน Phase 2-5
        </p>
      </div>
    </main>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center font-display font-bold text-xl text-ink">{children}</div>;
}
