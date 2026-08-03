"use client";
import { useEffect, useState, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabase";

type Tab = "dash" | "create" | "players" | "rounds" | "cards" | "prizes" | "audit" | "export";

export default function Admin() {
  const supabase = supabaseBrowser();
  const [ok, setOk] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("dash");
  const [toast, setToast] = useState("");
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2600); };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setOk(false); return; }
      const { data } = await supabase.from("profiles").select("role").eq("user_id", user.id).single();
      setOk(data?.role === "admin" || data?.role === "super_admin");
    })();
  }, []);

  if (ok === null) return <Center>กำลังตรวจสิทธิ์…</Center>;
  if (!ok) return (
    <Center>
      <div className="text-center">
        <div className="text-5xl mb-2">🔒</div>
        <p className="font-bold">ต้องเป็น Admin เท่านั้น</p>
        <a className="btn btn-primary btn-sm mt-3 inline-block" href="/">← กลับหน้าแรก</a>
      </div>
    </Center>
  );

  const tabs: [Tab, string][] = [
    ["dash", "Dashboard"], ["create", "➕ สร้างผู้เล่น"], ["players", "👥 ผู้เล่น"], ["rounds", "รอบ & โหวต"],
    ["cards", "การ์ด & CSR"], ["prizes", "รางวัล"], ["audit", "Audit Log"], ["export", "Export CSV"],
  ];

  return (
    <main className="max-w-3xl mx-auto px-4 pb-16">
      <div className="sticky top-0 z-50 flex items-center gap-2 py-3 mb-4 -mx-4 px-4 border-b-[3px] border-shark"
           style={{ background: "rgba(255,253,248,.94)", backdropFilter: "blur(8px)" }}>
        <div className="font-display font-extrabold text-shark text-lg">🛠 SECRET TEAM · ADMIN</div>
        <div className="flex-1" />
        <button className="btn btn-ghost btn-sm" onClick={async () => { await supabase.auth.signOut(); location.href = "/"; }}>ออก</button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto mb-4">
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
                  className={`whitespace-nowrap text-sm font-bold px-4 py-2.5 rounded-2xl border-2 ${tab === k ? "bg-white border-shark text-ink" : "bg-white/60 border-transparent text-ink-soft"}`}>{label}</button>
        ))}
      </div>
      {toast && <div className="toast">{toast}</div>}

      {tab === "dash" && <Dash />}
      {tab === "create" && <CreatePlayer flash={flash} />}
      {tab === "players" && <Players flash={flash} />}
      {tab === "rounds" && <Rounds flash={flash} />}
      {tab === "cards" && <Cards flash={flash} />}
      {tab === "prizes" && <Prizes flash={flash} />}
      {tab === "audit" && <Audit />}
      {tab === "export" && <Export />}
    </main>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center font-display font-bold text-xl text-ink">{children}</div>;
}

/* ---------- Dashboard ---------- */
function Dash() {
  const supabase = supabaseBrowser();
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    (async () => {
      const [{ data: players }, { data: teams }, { data: assignments }, { data: rounds }] = await Promise.all([
        supabase.from("profiles").select("player_status").eq("role", "player"),
        supabase.from("teams").select("id,team_code,team_name,icon"),
        supabase.from("player_team_assignments").select("team_id, profiles!inner(player_status)").is("effective_to", null),
        supabase.from("game_rounds").select("*").order("round_number", { ascending: false }).limit(1),
      ]);
      const active = (players || []).filter((p: any) => p.player_status === "active").length;
      const ghost = (players || []).filter((p: any) => p.player_status === "ghost").length;
      const counts: Record<string, number> = {};
      (teams || []).forEach((t: any) => (counts[t.id] = 0));
      (assignments || []).forEach((a: any) => { if (a.profiles?.player_status === "active" && counts[a.team_id] !== undefined) counts[a.team_id]++; });
      setD({ total: players?.length || 0, active, ghost, teams, counts, round: rounds?.[0] });
    })();
  }, []);
  if (!d) return <div className="card">กำลังโหลด…</div>;
  return (
    <div>
      <div className="card">
        <h2>Dashboard</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="stat"><div className="k">ผู้เล่นทั้งหมด</div><div className="v">{d.total}</div></div>
          <div className="stat"><div className="k">Active</div><div className="v">{d.active}</div></div>
          <div className="stat"><div className="k">Ghost</div><div className="v">{d.ghost}</div></div>
        </div>
      </div>
      <div className="card">
        <h3>สมาชิกแต่ละทีม</h3>
        {(d.teams || []).map((t: any) => (
          <div key={t.id} className="flex justify-between py-2 border-b border-line">
            <span>{t.icon} {t.team_name}</span><span className="font-bold">{d.counts[t.id]} คน</span>
          </div>
        ))}
      </div>
      <div className="card">
        <h3>รอบปัจจุบัน</h3>
        <div className="stat"><div className="k">{d.round?.title}</div><div className="v" style={{ fontSize: 18 }}>{d.round?.status}</div></div>
      </div>
    </div>
  );
}

/* ---------- Create Player ---------- */
function CreatePlayer({ flash }: any) {
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [department, setDepartment] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [created, setCreated] = useState<any>(null);

  async function create() {
    setErr(""); setCreated(null);
    if (!employeeId || !password || !fullName) return setErr("กรอกรหัสพนักงาน รหัสผ่าน และชื่อ-สกุลให้ครบ");
    setBusy(true);
    const res = await fetch("/api/admin/create-player", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId, password, fullName, nickname, department }),
    });
    const json = await res.json();
    setBusy(false);
    if (json.error) return setErr(json.error);
    setCreated(json);
    setEmployeeId(""); setPassword(""); setFullName(""); setNickname(""); setDepartment("");
    flash("✓ สร้างบัญชีแล้ว");
  }

  return (
    <div>
      <div className="card">
        <h2>➕ สร้างบัญชีผู้เล่น</h2>
        <p className="lead">ใช้หลังเก็บเงินบริจาค CSR นอกระบบแล้ว — สุ่มเข้าทีมอัตโนมัติ + แจกการ์ดฟรี 1 ใบ</p>
        <div className="field"><label>รหัสพนักงาน</label><input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="EMP1234" /></div>
        <div className="field"><label>รหัสผ่านเริ่มต้น</label><input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="อย่างน้อย 6 ตัว" /></div>
        <div className="field"><label>ชื่อ-สกุล</label><input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="สมชาย ใจดี" /></div>
        <div className="field"><label>ชื่อเล่น (ไม่บังคับ)</label><input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="สมชาย" /></div>
        <div className="field"><label>แผนก (ไม่บังคับ)</label><input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="HR" /></div>
        <button className="btn btn-primary btn-block" onClick={create} disabled={busy}>{busy ? "กำลังสร้าง…" : "สร้างบัญชี + สุ่มทีม →"}</button>
        {err && <div className="text-bad font-bold mt-2 text-sm">{err}</div>}
      </div>
      {created && (
        <div className="card" style={{ borderColor: "#3fa35e" }}>
          <h3>✅ สร้างสำเร็จ</h3>
          <div className="stat"><div className="k">รหัสพนักงาน</div><div className="v" style={{ fontSize: 18 }}>{created.employeeId}</div></div>
          <p className="text-xs text-ink-soft mt-2">สุ่มเข้าทีม: {created.team} (อย่าบอกผู้เล่นว่าทีมไหน)</p>
        </div>
      )}
    </div>
  );
}

/* ---------- Rounds ---------- */
/* ---------- Player Management ---------- */
function Players({ flash }: any) {
  const supabase = supabaseBrowser();
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: players }, { data: assignments }] = await Promise.all([
      supabase.from("profiles").select("id,employee_id,full_name,nickname,department,player_status,total_score,revive_count").eq("role", "player").order("employee_id"),
      supabase.from("player_team_assignments").select("player_id, teams(team_name, icon)").is("effective_to", null),
    ]);
    const teamByPlayer: Record<string, any> = {};
    (assignments || []).forEach((a: any) => { teamByPlayer[a.player_id] = a.teams; });
    setRows((players || []).map((p: any) => ({ ...p, team: teamByPlayer[p.id] })));
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function revive(employeeId: string) {
    if (!confirm(`ยืนยันชุบชีวิต ${employeeId}?`)) return;
    setBusyId(employeeId);
    const res = await fetch("/api/admin/revive", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId }),
    });
    const json = await res.json();
    setBusyId(null);
    if (json.error) return flash("ผิดพลาด: " + json.error);
    flash("✓ ชุบชีวิตแล้ว");
    load();
  }

  const qLower = q.trim().toLowerCase();
  const filtered = rows.filter((r) => !qLower || r.employee_id.toLowerCase().includes(qLower) || (r.nickname || r.full_name).toLowerCase().includes(qLower));

  return (
    <div className="card">
      <h2>👥 จัดการผู้เล่น</h2>
      <p className="lead">ดูรายชื่อทั้งหมด + ทีมจริง (Admin เท่านั้น) · กด &quot;Revive&quot; ให้ผู้เล่นที่เสียชีวิตหลังได้รับการติดต่อ+โอนเงินแล้ว</p>
      <input placeholder="ค้นหารหัสพนักงานหรือชื่อ…" value={q} onChange={(e) => setQ(e.target.value)} className="w-full mb-3" />
      {loading ? <p className="lead">กำลังโหลด…</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-ink-soft text-xs text-left">
              <th className="py-2">รหัสพนักงาน</th><th>ชื่อ</th><th>ทีม</th><th>สถานะ</th><th className="text-right">คะแนน</th><th className="text-right">ชุบชีวิตแล้ว</th><th></th>
            </tr></thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-line">
                  <td className="py-2 font-bold">{p.employee_id}</td>
                  <td>{p.nickname || p.full_name}</td>
                  <td>{p.team ? `${p.team.icon} ${p.team.team_name}` : "—"}</td>
                  <td><span className={`pill ${p.player_status === "active" ? "on" : "off"}`}>{p.player_status === "active" ? "Alive" : p.player_status === "ghost" ? "Dead" : "Disqualified"}</span></td>
                  <td className="text-right font-bold">{p.total_score}</td>
                  <td className="text-right">{p.revive_count || 0}</td>
                  <td>
                    {p.player_status === "ghost" && (
                      <button className="btn btn-gold btn-sm" onClick={() => revive(p.employee_id)} disabled={busyId === p.employee_id}>
                        {busyId === p.employee_id ? "…" : "Revive"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="py-4 text-center text-ink-soft">ไม่พบผู้เล่น</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Rounds({ flash }: any) {
  const [rounds, setRounds] = useState<any[]>([]);
  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/rounds");
    const json = await res.json();
    setRounds(json.rounds || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const current = rounds[0];

  async function act(action: string) {
    if (!current) return;
    setBusy(true);
    const res = await fetch("/api/admin/rounds", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roundId: current.id, action }) });
    const json = await res.json();
    setBusy(false);
    if (json.error) return flash("ผิดพลาด: " + json.error);
    if (action === "preview") setPreview(json.preview);
    if (action === "publish") { setPreview(null); flash("✓ ประกาศผลแล้ว"); }
    else flash("✓ ดำเนินการสำเร็จ");
    load();
  }

  if (!current) return <div className="card">กำลังโหลด…</div>;

  return (
    <div>
      <div className="card">
        <h2>รอบ & การโหวต — {current.title}</h2>
        <p className="lead">สถานะ: <b>{current.status}</b></p>
        <div className="flex gap-2.5 flex-wrap">
          {current.status === "scheduled" && <button className="btn btn-primary" onClick={() => act("open")} disabled={busy}>เปิดโหวต →</button>}
          {current.status === "voting_open" && <button className="btn btn-shark" onClick={() => act("close")} disabled={busy}>ปิดรับโหวต</button>}
          {current.status === "voting_closed" && <button className="btn btn-primary" onClick={() => act("preview")} disabled={busy}>Preview ผล →</button>}
        </div>
      </div>

      {preview && (
        <div className="card">
          <h3>Preview (ยังไม่ประกาศ)</h3>
          <p className="lead">
            จะคัดออก {(preview.eliminated || []).length} คน (Admin ตั้งไว้ {current.elimination_value} คน)
            {(preview.eliminated || []).length > current.elimination_value && (
              <span className="text-blood font-bold"> — มีคนไทกันที่จุดตัด ระบบคัดออกทุกคนที่ไทตามกติกา</span>
            )}
          </p>
          {preview.wrongTargetPenaltyCount > 0 && (
            <p className="lead">⚠️ มี {preview.wrongTargetPenaltyCount} คนโดนเพื่อนร่วมทีมโหวตผิด — โดนหักคะแนนเพิ่ม (ครั้งเดียว/คน)</p>
          )}
          <ul className="pl-5">
            {(preview.eliminated || []).map((e: any) => (<li key={e.playerId} className="font-bold">{e.name} — {e.votesReceived} โหวต</li>))}
            {(!preview.eliminated || preview.eliminated.length === 0) && <li>ไม่มีใครถูกคัดออก</li>}
          </ul>
          <button className="btn btn-gold btn-block" onClick={() => act("publish")} disabled={busy}>✓ ประกาศผล (Publish)</button>
        </div>
      )}
    </div>
  );
}

/* ---------- Cards & CSR ---------- */
function Cards({ flash }: any) {
  const [employeeId, setEmployeeId] = useState("");
  const [cardCode, setCardCode] = useState("revive");
  const [qty, setQty] = useState(1);
  const [amount, setAmount] = useState(80);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function grant() {
    setErr("");
    if (!employeeId) return setErr("กรอกรหัสพนักงาน");
    setBusy(true);
    const res = await fetch("/api/admin/cards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ employeeId, cardCode, qty, amount }) });
    const json = await res.json();
    setBusy(false);
    if (json.error) return setErr(json.error);
    flash("✓ มอบการ์ดแล้ว");
    setEmployeeId("");
  }

  return (
    <div className="card">
      <h2>🃏 มอบการ์ด & บันทึกยอด CSR</h2>
      <p className="lead">ใช้หลังผู้เล่นจ่ายเงินซื้อการ์ดนอกระบบแล้ว — ยอดนี้ใช้จัดอันดับ MVP นักสู้</p>
      <div className="field"><label>รหัสพนักงาน</label><input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="EMP1234" /></div>
      <div className="field"><label>ชนิดการ์ด</label>
        <select value={cardCode} onChange={(e) => setCardCode(e.target.value)} disabled>
          <option value="revive">💗 Revive Card</option>
        </select></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="field"><label>จำนวน</label><input type="number" value={qty} onChange={(e) => setQty(+e.target.value)} /></div>
        <div className="field"><label>ยอดเงิน (บาท)</label><input type="number" value={amount} onChange={(e) => setAmount(+e.target.value)} /></div>
      </div>
      <button className="btn btn-primary btn-block" onClick={grant} disabled={busy}>มอบการ์ด + บันทึกยอด →</button>
      {err && <div className="text-bad font-bold mt-2 text-sm">{err}</div>}
    </div>
  );
}

/* ---------- Prizes ---------- */
function Prizes({ flash }: any) {
  const supabase = supabaseBrowser();
  const [ranked, setRanked] = useState<any[]>([]);
  const [prizes, setPrizes] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [{ data: rb }, { data: pz }] = await Promise.all([
      supabase.rpc("ranking_board"),
      supabase.from("prizes").select("*, profiles(employee_id,full_name,nickname)"),
    ]);
    setRanked(rb || []);
    setPrizes(pz || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function finalize() {
    setBusy(true);
    const res = await fetch("/api/admin/prizes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "finalize" }) });
    const json = await res.json();
    setBusy(false);
    if (json.error) return flash(json.error);
    flash("✓ ประกาศผู้ชนะแล้ว");
    load();
  }
  async function luckyDraw(reason?: string) {
    setBusy(true);
    const res = await fetch("/api/admin/prizes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "lucky_draw", reason }) });
    const json = await res.json();
    setBusy(false);
    if (json.error) return flash(json.error);
    flash("🎉 ผู้โชคดี: " + json.data.winnerName);
    load();
  }

  const luckyPrize = prizes.find((p) => p.prize_code === "lucky_draw");

  return (
    <div>
      <div className="card">
        <h2>🏆 คำนวณรางวัล</h2>
        <h3>อันดับ 1-3 (คะแนนสะสม)</h3>
        <table className="w-full text-sm"><tbody>
          {ranked.slice(0, 3).map((p, i) => (<tr key={i}><td className="py-1">#{i + 1}</td><td>{p.nickname || p.full_name}</td><td className="text-right font-bold">{p.total_score} แต้ม</td></tr>))}
        </tbody></table>
        <button className="btn btn-gold btn-block" onClick={finalize} disabled={busy}>✓ ประกาศผู้ชนะทั้งหมด (อันดับ 1-3 + MVP)</button>
      </div>
      <div className="card">
        <h3>🎁 Lucky Draw</h3>
        {luckyPrize?.profiles && <p className="lead">ผู้ชนะปัจจุบัน: <b className="text-ink">{luckyPrize.profiles.nickname || luckyPrize.profiles.full_name}</b></p>}
        <div className="flex gap-2.5 flex-wrap">
          <button className="btn btn-primary" onClick={() => luckyDraw()} disabled={busy}>{luckyPrize ? "จับใหม่" : "จับรางวัล"}</button>
          {luckyPrize && <button className="btn btn-ghost" onClick={() => { const r = prompt("เหตุผล Re-draw:"); if (r) luckyDraw(r); }} disabled={busy}>Re-draw (ระบุเหตุผล)</button>}
        </div>
      </div>
    </div>
  );
}

/* ---------- Audit ---------- */
function Audit() {
  const supabase = supabaseBrowser();
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(80).then(({ data }) => setRows(data || [])); }, []);
  return (
    <div className="card">
      <h2>Audit Log</h2>
      <table className="w-full text-sm"><thead><tr className="text-ink-soft text-xs"><th className="text-left py-2">เวลา</th><th>โดย</th><th>การกระทำ</th></tr></thead>
        <tbody>{rows.map((a) => (
          <tr key={a.id} className="border-b border-line"><td className="py-2 text-xs">{new Date(a.created_at).toLocaleString("th-TH")}</td><td>{a.actor_id}</td><td>{a.action_type}</td></tr>
        ))}</tbody></table>
    </div>
  );
}

/* ---------- Export ---------- */
function Export() {
  const types = [
    ["players", "รายชื่อผู้เล่น + คะแนน"], ["players_with_teams", "ผู้เล่น + ทีม (Admin เท่านั้น)"],
    ["eliminations", "ผู้ถูกคัดออก"], ["cards", "การ์ดทั้งหมด"], ["csr", "ยอดบริจาค CSR"], ["prizes", "ผู้ชนะรางวัล"],
  ];
  return (
    <div className="card">
      <h2>Export CSV</h2>
      <p className="lead">ดาวน์โหลดรายงานสำหรับใช้งานภายนอก</p>
      <div className="grid grid-cols-2 gap-2.5">
        {types.map(([t, label]) => (
          <a key={t} className="btn btn-ghost btn-sm text-center" href={`/api/admin/export?type=${t}`}>{label}</a>
        ))}
      </div>
    </div>
  );
}
