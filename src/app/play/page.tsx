"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";
import { Profile, TeamDef } from "@/lib/types";

export default function Play() {
  const supabase = supabaseBrowser();
  const [me, setMe] = useState<Profile | null>(null);
  const [team, setTeam] = useState<TeamDef | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { location.href = "/"; return; }
      const [{ data: prof }, { data: teamRows }] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", user.id).single(),
        supabase.rpc("my_team"),
      ]);
      setMe(prof as Profile);
      if (teamRows && teamRows[0]) setTeam(teamRows[0] as TeamDef);
      setLoading(false);
    })();
  }, []);

  if (loading) return <Center>กำลังโหลด…</Center>;
  if (!me) return <Center>ไม่พบบัญชี</Center>;

  return (
    <main className="max-w-lg mx-auto px-4 py-6">
      <div className="card text-center">
        <h2>ยินดีต้อนรับ, {me.nickname || me.full_name} 👋</h2>
        {team ? (
          <>
            <div className="text-6xl my-3">{team.icon}</div>
            <div className="font-display font-extrabold text-2xl" style={{ color: team.theme_color }}>
              {team.team_name}
            </div>
            <p className="lead mt-2">นี่คือทีมลับของคุณ — ห้ามบอกใคร!</p>
          </>
        ) : (
          <p className="lead">ยังไม่ได้รับมอบหมายทีม — ติดต่อผู้ดูแลกิจกรรม</p>
        )}
        <div className="stat mt-3">
          <div className="k">คะแนนสะสม</div>
          <div className="v">{me.total_score}</div>
        </div>
        <button className="btn btn-ghost btn-block mt-4"
                onClick={async () => { await supabase.auth.signOut(); location.href = "/"; }}>
          ออกจากระบบ
        </button>
        <p className="text-xs text-ink-soft mt-4">
          🚧 Phase 1: ระบบล็อกอิน + ทีมลับพร้อมใช้งานแล้ว หน้าโหวต/การ์ด/อันดับ จะตามมาใน Phase 2-3
        </p>
      </div>
    </main>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center font-display font-bold text-xl text-ink">{children}</div>;
}
