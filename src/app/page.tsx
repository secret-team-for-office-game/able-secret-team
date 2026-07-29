"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser, employeeIdToEmail } from "@/lib/supabase";
import { SystemSettings } from "@/lib/types";

export default function Landing() {
  const supabase = supabaseBrowser();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("system_settings").select("*").eq("id", 1).single().then(({ data }) => {
      if (data) setSettings(data as SystemSettings);
    });
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) location.href = "/route";
    });
  }, []);

  async function login() {
    setMsg("");
    if (!employeeId.trim()) return setMsg("กรุณากรอกรหัสพนักงาน");
    if (!password) return setMsg("กรุณากรอกรหัสผ่าน");
    setBusy(true);
    const email = employeeIdToEmail(employeeId);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setMsg("รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง — ถ้ายังไม่มีบัญชี ติดต่อผู้ดูแลกิจกรรม");
    location.href = "/route";
  }

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "long" });

  return (
    <main className="max-w-3xl mx-auto px-4 pb-24">
      <div
        className="rounded-xl3 overflow-hidden border-[3px] border-white bg-gradient-to-b from-sky to-sky-light p-6 text-center my-5"
        style={{ boxShadow: "0 6px 0 rgba(255,255,255,.5)" }}
      >
        <div className="text-xs font-bold tracking-widest text-ink-soft mb-1">THE ABLE</div>
        <h1
          className="font-display font-extrabold leading-none text-whale-dark"
          style={{ fontSize: "clamp(30px,8vw,52px)", textShadow: "2px 2px 0 #fff" }}
        >
          SECRET TEAM
        </h1>
        <p className="lead mt-2" style={{ color: "#5c5a82" }}>
          3 ทีมลับ · ใครคือศัตรูตัวจริง? — เกมจับทีมลับสำหรับพนักงาน
        </p>
        <div className="flex justify-center gap-3 my-5">
          {["dolphin", "whale", "shark"].map((f) => (
            <img key={f} src={`/characters/${f}.jpg`} alt={f}
                 className="w-24 h-32 object-cover object-top rounded-2xl border-[3px] border-white shadow-lg" />
          ))}
        </div>
        {settings && (
          <div className="flex justify-center gap-6 mt-2 text-center flex-wrap">
            <div>
              <div className="text-xs text-ink-soft font-bold">ระยะเวลากิจกรรม</div>
              <div className="font-display font-extrabold text-lg">
                {fmtDate(settings.event_start_at)} – {fmtDate(settings.event_end_at)}
              </div>
            </div>
            <div>
              <div className="text-xs text-ink-soft font-bold">ประกาศผล</div>
              <div className="font-display font-extrabold text-lg">{fmtDate(settings.result_announce_at)}</div>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h2>เข้าสู่ระบบ</h2>
        <p className="lead">ใช้รหัสพนักงานและรหัสผ่านที่ผู้ดูแลกิจกรรมมอบให้</p>
        <div className="field">
          <label>รหัสพนักงาน</label>
          <input
            type="text"
            placeholder="เช่น EMP1234"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
          />
        </div>
        <div className="field">
          <label>รหัสผ่าน</label>
          <input
            type="password"
            placeholder="รหัสผ่านที่ได้รับ"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
          />
        </div>
        <button className="btn btn-primary btn-block" onClick={login} disabled={busy}>
          {busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ →"}
        </button>
        {msg && <div className="text-bad font-bold mt-3 text-sm">{msg}</div>}
        <p className="text-xs text-ink-soft mt-4 font-medium">
          ยังไม่มีบัญชี? แจ้งชื่อ + ร่วมบริจาค CSR กับผู้ดูแลกิจกรรม แล้วรอรับรหัสพนักงาน/รหัสผ่าน
          <br />ผู้ดูแลกิจกรรมจัดการเกมที่ <a className="underline" href="/admin">/admin</a>
        </p>
      </div>
    </main>
  );
}
