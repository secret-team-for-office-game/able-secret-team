"use client";
import { useEffect, useState, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabase";
import { Profile, TeamDef, GameRound, VotablePlayer, RankingRow, PlayerCard, CardType } from "@/lib/types";

type Tab = "home" | "vote" | "cards" | "result" | "rank" | "prizes";

export default function Play() {
  const supabase = supabaseBrowser();
  const [me, setMe] = useState<Profile | null>(null);
  const [team, setTeam] = useState<TeamDef | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2600); };

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { location.href = "/"; return; }
    const [{ data: prof }, { data: teamRows }] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", user.id).single(),
      supabase.rpc("my_team"),
    ]);
    setMe(prof as Profile);
    if (teamRows && teamRows[0]) setTeam(teamRows[0] as any);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Center>กำลังโหลด…</Center>;
  if (!me) return <Center>ไม่พบบัญชี</Center>;
  if (me.player_status === "disqualified") return <Center>บัญชีถูกตัดสิทธิ์ — ติดต่อผู้ดูแลกิจกรรม</Center>;

  const tabs: [Tab, string, string][] = [
    ["home", "ทีมฉัน", "🏠"], ["vote", "โหวต", "🗳️"], ["cards", "การ์ด", "🃏"],
    ["result", "ผลประกาศ", "📣"], ["rank", "อันดับ", "🏆"], ["prizes", "รางวัล", "🎁"],
  ];

  return (
    <main className="max-w-lg mx-auto px-4" style={{ paddingBottom: 90 }}>
      <TopBar me={me} onLogout={async () => { await supabase.auth.signOut(); location.href = "/"; }} />
      {toast && <div className="toast">{toast}</div>}

      {tab === "home" && <Home me={me} team={team} goTo={setTab} />}
      {tab === "vote" && <VoteTab me={me} flash={flash} />}
      {tab === "cards" && <CardsTab me={me} reload={load} flash={flash} />}
      {tab === "result" && <ResultTab />}
      {tab === "rank" && <RankTab me={me} />}
      {tab === "prizes" && <PrizeTab />}

      <div className="fixed left-0 right-0 bottom-0 z-40 bg-cream border-t-[3px] border-whale flex justify-around px-1 py-1.5"
           style={{ boxShadow: "0 -3px 0 rgba(138,92,240,.15)" }}>
        {tabs.map(([k, label, icon]) => (
          <button key={k} onClick={() => setTab(k)}
                  className={`flex flex-col items-center gap-0.5 text-[10px] font-bold px-2 py-1 rounded-xl flex-1 max-w-[80px] ${tab === k ? "text-whale-dark" : "text-ink-soft"}`}>
            <span className="text-xl">{icon}</span>{label}
          </button>
        ))}
      </div>
    </main>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center font-display font-bold text-xl text-ink text-center px-6">{children}</div>;
}

function TopBar({ me, onLogout }: { me: Profile; onLogout: () => void }) {
  return (
    <div className="sticky top-0 z-50 flex items-center gap-2 py-3 mb-4 -mx-4 px-4 border-b-[3px] border-whale"
         style={{ background: "rgba(255,253,248,.94)", backdropFilter: "blur(8px)" }}>
      <div className="font-display font-extrabold text-whale-dark text-sm">
        ABLE <span className="text-shark">SECRET</span> TEAM
      </div>
      <div className="flex-1" />
      <span className="text-xs font-bold px-3 py-1.5 rounded-2xl bg-whale text-white">👤 {me.nickname || me.full_name}</span>
      <button className="btn btn-ghost btn-sm" onClick={onLogout}>ออก</button>
    </div>
  );
}

/* ---------- Home ---------- */
function Home({ me, team, goTo }: { me: Profile; team: TeamDef | null; goTo: (t: Tab) => void }) {
  const supabase = supabaseBrowser();
  const [round, setRound] = useState<GameRound | null>(null);
  const [voted, setVoted] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: rounds } = await supabase.from("game_rounds").select("*").order("round_number", { ascending: false }).limit(1);
      const r = rounds?.[0] as GameRound | undefined;
      if (r) {
        setRound(r);
        const { data: vs } = await supabase.rpc("my_vote_status", { p_round_id: r.id });
        setVoted(!!vs?.[0]?.has_voted);
      }
    })();
  }, []);

  return (
    <div>
      {team ? (
        <div className="rounded-3xl overflow-hidden border-2 border-line" style={{ background: `linear-gradient(180deg, ${team.theme_color}22, #fff)` }}>
          <div className="h-2" style={{ background: team.theme_color }} />
          <div className="p-5 flex flex-col items-center gap-2 text-center">
            <img src={`/characters/${team.team_code}.jpg`} className="w-24 h-32 object-cover object-top rounded-2xl border-[3px] border-white shadow-lg" alt="" />
            <div className="font-display font-extrabold text-2xl" style={{ color: team.theme_color }}>{team.icon} {team.team_name}</div>
            <div className="lead" style={{ margin: 0 }}>นี่คือทีมลับของคุณ — ห้ามบอกใคร!</div>
          </div>
        </div>
      ) : (
        <div className="card text-center"><p className="lead">ยังไม่ได้รับมอบหมายทีม — ติดต่อผู้ดูแลกิจกรรม</p></div>
      )}

      <div className="grid grid-cols-2 gap-3 mt-3">
        <div className="stat text-center"><div className="k">⭐ คะแนนสะสม</div><div className="v">{me.total_score}</div></div>
        <div className="stat text-center"><div className="k">สถานะ</div><div className="v" style={{ fontSize: 16 }}>{me.player_status === "active" ? "✅ Active" : "👻 Ghost"}</div></div>
      </div>

      <div className="card text-center mt-3">
        {round?.status === "voting_open" ? (
          voted ? (
            <><div className="text-4xl">✅</div><h3>โหวตรอบนี้ส่งแล้ว!</h3><p className="lead">รอ Admin ประกาศผลวันศุกร์</p></>
          ) : (
            <>
              <div className="text-4xl">🗳️</div><h3>{round.title} — เปิดโหวตอยู่!</h3>
              <p className="lead">เลือก 1 คนที่คุณคิดว่าเป็นทีมศัตรู</p>
              <button className="btn btn-primary btn-block" onClick={() => goTo("vote")}>ไปโหวต →</button>
            </>
          )
        ) : (
          <><div className="text-4xl">⏳</div><h3>ยังไม่เปิดโหวตสัปดาห์นี้</h3><p className="lead">รอ Admin เปิดรอบโหวต</p></>
        )}
      </div>
    </div>
  );
}

/* ---------- Vote ---------- */
function VoteTab({ me, flash }: { me: Profile; flash: (m: string) => void }) {
  const supabase = supabaseBrowser();
  const [round, setRound] = useState<GameRound | null>(null);
  const [voted, setVoted] = useState(false);
  const [players, setPlayers] = useState<VotablePlayer[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: rounds } = await supabase.from("game_rounds").select("*").order("round_number", { ascending: false }).limit(1);
      const r = rounds?.[0] as GameRound | undefined;
      setRound(r || null);
      if (r) {
        const { data: vs } = await supabase.rpc("my_vote_status", { p_round_id: r.id });
        setVoted(!!vs?.[0]?.has_voted);
        const { data: vp } = await supabase.rpc("votable_players");
        setPlayers((vp as VotablePlayer[]) || []);
      }
      setLoading(false);
    })();
  }, []);

  async function submit() {
    if (!round || !sel) return;
    const res = await fetch("/api/vote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roundId: round.id, targetId: sel }) });
    const json = await res.json();
    setConfirm(false);
    if (json.error) return flash(json.error);
    setVoted(true);
    flash("✓ ส่งโหวตสำเร็จ");
  }

  if (loading) return <div className="card">กำลังโหลด…</div>;
  if (!round || round.status !== "voting_open") return <div className="card"><h2>โหวต</h2><p className="lead">ยังไม่เปิดโหวตในขณะนี้</p></div>;
  if (voted) return <div className="card"><h2>{round.title}</h2><p className="lead">คุณส่งโหวตในรอบนี้แล้ว ✅ — เปลี่ยนไม่ได้หลังส่ง</p></div>;

  const filtered = players.filter((p) => !q || (p.nickname || p.full_name).includes(q) || (p.department || "").includes(q));

  return (
    <div className="card">
      <h2>{round.title} — โหวตหาศัตรู</h2>
      <p className="lead">เลือก 1 คนที่คุณคิดว่าอยู่ทีมศัตรู · เปลี่ยนไม่ได้หลังส่ง</p>
      <input placeholder="ค้นหาชื่อหรือแผนก…" value={q} onChange={(e) => setQ(e.target.value)} className="w-full mb-2.5" />
      <div style={{ maxHeight: 360, overflowY: "auto" }}>
        {filtered.map((p) => (
          <div key={p.player_id} onClick={() => setSel(p.player_id)}
               className={`flex items-center gap-2.5 p-2.5 border-2 rounded-2xl mb-2 cursor-pointer ${sel === p.player_id ? "border-shark bg-shark-bg" : "border-line bg-white"}`}>
            <div className="w-10 h-10 rounded-full bg-panel flex items-center justify-center text-lg">👤</div>
            <div><div className="font-bold">{p.nickname || p.full_name}</div><div className="text-xs text-ink-soft">{p.department}</div></div>
          </div>
        ))}
        {filtered.length === 0 && <p className="lead">ไม่พบผู้เล่น</p>}
      </div>
      <button className="btn btn-shark btn-block" disabled={!sel} onClick={() => setConfirm(true)}>ยืนยันโหวต →</button>

      {confirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(43,42,74,.45)" }} onClick={() => setConfirm(false)}>
          <div className="bg-white border-[3px] border-whale rounded-3xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-extrabold text-lg mb-2">ยืนยันการโหวต?</h3>
            <p className="lead">คุณจะโหวต <b className="text-ink">{players.find((p) => p.player_id === sel)?.nickname}</b> ว่าเป็นทีมศัตรู<br />เปลี่ยนไม่ได้หลังส่ง</p>
            <div className="flex gap-2.5">
              <button className="btn btn-shark" onClick={submit}>ยืนยัน</button>
              <button className="btn btn-ghost" onClick={() => setConfirm(false)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Cards ---------- */
function CardsTab({ me, reload, flash }: { me: Profile; reload: () => void; flash: (m: string) => void }) {
  const supabase = supabaseBrowser();
  const [cards, setCards] = useState<(PlayerCard & { card_types: CardType })[]>([]);
  const [ghosts, setGhosts] = useState<VotablePlayer[]>([]);
  const [others, setOthers] = useState<VotablePlayer[]>([]);
  const [useTarget, setUseTarget] = useState<any>(null);
  const [revealResult, setRevealResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [{ data: myCards }, { data: gp }] = await Promise.all([
      supabase.from("player_cards").select("*, card_types(*)").eq("player_id", me.id),
      supabase.rpc("ghost_players"),
    ]);
    setCards((myCards as any) || []);
    setGhosts((gp as VotablePlayer[]) || []);
    const { data: vp } = await supabase.rpc("votable_players");
    setOthers((vp as VotablePlayer[]) || []);
    setLoading(false);
  }, [me.id]);

  useEffect(() => { load(); }, [load]);

  async function useCard(card: any) {
    if (card.status !== "available") return;
    const code = card.card_types.card_code;
    if (code === "team_switch") {
      if (!confirm("ยืนยันใช้การ์ดย้ายทีม? จะถูกสุ่มไปอีก 1 ใน 2 ทีมที่เหลือทันที")) return;
      const res = await fetch("/api/cards/use", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cardId: card.id, cardCode: code }) });
      const json = await res.json();
      if (json.error) return flash(json.error);
      flash("✓ ย้ายทีมแล้ว! ดูทีมใหม่ที่หน้าแรก");
      load(); reload();
      return;
    }
    setUseTarget({ card, mode: code });
  }

  async function confirmTarget(targetId: string) {
    const code = useTarget.card.card_types.card_code;
    const res = await fetch("/api/cards/use", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cardId: useTarget.card.id, cardCode: code, targetId }) });
    const json = await res.json();
    setUseTarget(null);
    if (json.error) return flash(json.error);
    if (code === "reveal") setRevealResult(json.data);
    else flash("✓ ชุบชีวิตสำเร็จ!");
    load();
  }

  if (loading) return <div className="card">กำลังโหลด…</div>;

  return (
    <div>
      <div className="card">
        <h2>🃏 การ์ดของฉัน</h2>
        <p className="lead">การ์ดพิเศษ — ซื้อเพิ่มนอกระบบ แจ้ง Admin หลังโอนเงิน</p>
        <div className="grid grid-cols-3 gap-2.5">
          {cards.map((c) => (
            <div key={c.id} className="border-2 border-line rounded-2xl p-3 text-center bg-white">
              <div className="text-3xl">{c.card_types.card_code === "revive" ? "💗" : c.card_types.card_code === "reveal" ? "🔮" : "🔄"}</div>
              <div className="font-display font-bold text-sm mt-1">{c.card_types.card_name.split(" — ")[1]}</div>
              <div className="text-xs text-ink-soft my-1">{c.status === "available" ? "พร้อมใช้" : "ใช้แล้ว"}</div>
              {c.status === "available" && <button className="btn btn-primary btn-sm" onClick={() => useCard(c)}>ใช้การ์ด</button>}
            </div>
          ))}
          {cards.length === 0 && <p className="lead">ยังไม่มีการ์ด</p>}
        </div>
      </div>

      {useTarget?.mode === "reveal" && (
        <PickerModal title="🔮 เลือกคนที่จะส่อง" items={others.map((p) => ({ id: p.player_id, label: p.nickname || p.full_name }))} onPick={confirmTarget} onClose={() => setUseTarget(null)} />
      )}
      {useTarget?.mode === "revive" && (
        <PickerModal title="💗 เลือกคนที่จะชุบชีวิต" items={ghosts.map((p) => ({ id: p.player_id, label: p.nickname || p.full_name }))} onPick={confirmTarget} onClose={() => setUseTarget(null)} empty="ตอนนี้ไม่มีใครอยู่ Ghost Mode" />
      )}
      {revealResult && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(43,42,74,.45)" }} onClick={() => setRevealResult(null)}>
          <div className="bg-white border-[3px] border-whale rounded-3xl p-6 max-w-sm w-full text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-extrabold text-lg mb-2">🔮 ผลการส่อง</h3>
            <div className="text-5xl">{revealResult.icon}</div>
            <p className="lead">อยู่ <b style={{ color: "var(--ink)" }}>{revealResult.team_name}</b></p>
            <button className="btn btn-primary btn-block" onClick={() => setRevealResult(null)}>ปิด</button>
          </div>
        </div>
      )}
    </div>
  );
}

function PickerModal({ title, items, onPick, onClose, empty }: any) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(43,42,74,.45)" }} onClick={onClose}>
      <div className="bg-white border-[3px] border-whale rounded-3xl p-6 max-w-sm w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display font-extrabold text-lg mb-2">{title}</h3>
        {items.length === 0 && <p className="lead">{empty || "ไม่มีตัวเลือก"}</p>}
        {items.map((it: any) => (
          <div key={it.id} onClick={() => onPick(it.id)} className="flex items-center gap-2.5 p-2.5 border-2 border-line rounded-2xl mb-2 cursor-pointer bg-white">
            <div className="w-9 h-9 rounded-full bg-panel flex items-center justify-center">👤</div>
            <div className="font-bold">{it.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Result ---------- */
function ResultTab() {
  const supabase = supabaseBrowser();
  const [rounds, setRounds] = useState<GameRound[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("game_rounds").select("*").eq("status", "published").order("round_number", { ascending: false });
      setRounds((data as GameRound[]) || []);
      if (data?.[0]) setSel(data[0].id);
    })();
  }, []);

  useEffect(() => {
    if (!sel) return;
    supabase.rpc("round_summary", { p_round_id: sel }).then(({ data }) => setSummary(data?.[0]));
  }, [sel]);

  if (rounds.length === 0) return <div className="card"><h2>ผลประกาศ</h2><p className="lead">ยังไม่มีผลที่ประกาศ</p></div>;

  return (
    <div className="card">
      <h2>📣 ผลประกาศ</h2>
      <div className="flex gap-2 flex-wrap mb-2.5">
        {rounds.map((r) => (
          <button key={r.id} onClick={() => setSel(r.id)} className={`btn btn-ghost btn-sm ${sel === r.id ? "border-whale" : ""}`}>{r.title}</button>
        ))}
      </div>
      {summary && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="stat text-center"><div className="k">✅ Active</div><div className="v">{summary.active_count}</div></div>
            <div className="stat text-center"><div className="k">👻 Ghost</div><div className="v">{summary.ghost_count}</div></div>
          </div>
          <h3>ผู้ถูกคัดออกสัปดาห์นี้</h3>
          {(!summary.eliminated_names || summary.eliminated_names.length === 0) ? <p className="lead">ไม่มีใครถูกคัดออก</p> : (
            <ul className="pl-5">{summary.eliminated_names.map((n: string, i: number) => <li key={i} className="font-bold">{n}</li>)}</ul>
          )}
        </>
      )}
      <p className="text-xs text-ink-soft mt-2">ไม่มีการเปิดเผยว่าใครโหวตใคร หรือใครโหวตถูก/ผิด</p>
    </div>
  );
}

/* ---------- Ranking ---------- */
function RankTab({ me }: { me: Profile }) {
  const supabase = supabaseBrowser();
  const [rows, setRows] = useState<RankingRow[]>([]);
  useEffect(() => { supabase.rpc("ghost_players").then(({ data }) => setRows((data as RankingRow[]) || [])); }, []);
  return (
    <div className="card">
      <h2>🏆 อันดับ</h2>
      <p className="lead">ไม่เปิดเผยทีมของผู้เล่นคนอื่น</p>
      <table className="w-full text-sm">
        <thead><tr className="text-ink-soft text-xs"><th className="text-left py-2">#</th><th className="text-left">ผู้เล่น</th><th>สถานะ</th><th className="text-right">คะแนน</th></tr></thead>
        <tbody>
          {rows.slice(0, 40).map((r) => (
            <tr key={r.rank} className={`border-b border-line ${r.full_name === me.full_name ? "bg-amber-50 font-bold" : ""}`}>
              <td className="py-2">{r.rank}</td><td>{r.nickname || r.full_name}</td>
              <td><span className={`pill ${r.player_status === "active" ? "on" : "off"}`}>{r.player_status === "active" ? "Active" : "Ghost"}</span></td>
              <td className="text-right font-bold">{r.total_score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Prizes (public only after Admin finalizes) ---------- */
function PrizeTab() {
  const supabase = supabaseBrowser();
  const [prizes, setPrizes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("prizes").select("*, profiles(full_name,nickname)").then(({ data }) => {
      setPrizes(data || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="card">กำลังโหลด…</div>;
  const finalized = prizes.filter((p) => p.finalized_at);
  const labelFor = (code: string) => ({
    rank1: "🥇 อันดับ 1", rank2: "🥈 อันดับ 2", rank3: "🥉 อันดับ 3",
    mvp_fighter: "⚔️ MVP นักสู้", lucky_draw: "🎁 Lucky Draw",
  } as Record<string, string>)[code] || code;

  return (
    <div className="card">
      <h2>🎁 รางวัล</h2>
      {finalized.length === 0 ? (
        <p className="lead">ยังไม่ประกาศผู้ชนะ — รอ Admin สรุปผลหลังจบกิจกรรม</p>
      ) : (
        <div className="space-y-2">
          {finalized.map((p) => (
            <div key={p.prize_code} className="stat flex items-center justify-between">
              <div className="font-display font-bold">{labelFor(p.prize_code)}</div>
              <div className="font-bold">{p.profiles ? (p.profiles.nickname || p.profiles.full_name) : "—"}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
