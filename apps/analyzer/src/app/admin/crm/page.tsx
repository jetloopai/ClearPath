"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";
import { X, ChevronDown, Mail, Phone, MapPin, Tag, Activity, Pause, Play, RefreshCw } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Lead = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  address: string | null;
  source: string;
  status: string;
  email_sequence: string | null;
  sequence_step: number | null;
  sequence_paused: boolean;
  qualification_score: number | null;
  deal_signal: string | null;
  deal_arv: number | null;
  deal_flip_profit: number | null;
  deal_cash_flow: number | null;
  deal_condition: string | null;
  is_service_area: boolean;
  tags: string[];
  notes: string | null;
  created_at: string;
  next_email_at: string | null;
};

type Activity = {
  id: string;
  type: string;
  notes: string | null;
  created_at: string;
  created_by: string | null;
};

// ── Config ────────────────────────────────────────────────────────────────────

const STATUSES = ["new", "contacted", "qualified", "proposal_sent", "converted", "client", "nurture", "lost"];

const STATUS_COLOR: Record<string, string> = {
  new:           "bg-indigo-500/10 border-indigo-500/30 text-indigo-300",
  contacted:     "bg-sky-500/10 border-sky-500/30 text-sky-300",
  qualified:     "bg-amber-500/10 border-amber-500/30 text-amber-300",
  proposal_sent: "bg-purple-500/10 border-purple-500/30 text-purple-300",
  converted:     "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
  client:        "bg-emerald-500/20 border-emerald-500/40 text-emerald-200",
  nurture:       "bg-zinc-500/10 border-zinc-500/30 text-zinc-400",
  lost:          "bg-red-500/10 border-red-500/30 text-red-400",
};

const SIGNAL_COLOR: Record<string, string> = {
  green:  "text-emerald-400",
  yellow: "text-amber-400",
  red:    "text-red-400",
};

const SEQ_LABEL: Record<string, string> = {
  cook_county_flow:     "Cook County",
  national_nurture:     "National",
  asset_group_inquiry:  "Direct Inquiry",
};

const SOURCE_LABEL: Record<string, string> = {
  analyzer:    "Analyzer",
  asset_group: "Asset Group",
  content:     "Newsletter",
  referral:    "Referral",
  manual:      "Manual",
};

const fmt = (v: number) =>
  v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`;

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Lead Detail Drawer ────────────────────────────────────────────────────────

function LeadDrawer({ lead, onClose, onUpdate }: { lead: Lead; onClose: () => void; onUpdate: (l: Lead) => void }) {
  const [activity, setActivity] = useState<Activity[]>([]);
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("lead_activity")
      .select("*")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setActivity(data ?? []));
  }, [lead.id]);

  const updateField = async (patch: Partial<Lead>) => {
    setSaving(true);
    const { data } = await supabase.from("leads").update(patch).eq("id", lead.id).select().single();
    if (data) onUpdate(data as Lead);
    setSaving(false);
  };

  const saveNotes = () => updateField({ notes });
  const togglePause = () => updateField({ sequence_paused: !lead.sequence_paused });

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between items-start py-2 border-b border-white/[0.04]">
      <span className="text-xs text-zinc-500 w-32 shrink-0">{label}</span>
      <span className="text-xs text-zinc-200 text-right">{value ?? "—"}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-md bg-[#0a0a0f] border-l border-white/[0.08] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-white/[0.08]">
          <div>
            <p className="text-sm font-medium text-zinc-100">{lead.name ?? lead.email}</p>
            {lead.name && <p className="text-xs text-zinc-500 mt-0.5">{lead.email}</p>}
            <div className="flex gap-2 mt-2">
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS_COLOR[lead.status] ?? "border-white/10 text-zinc-400"}`}>
                {lead.status}
              </span>
              {lead.is_service_area && (
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-indigo-500/30 text-indigo-300 bg-indigo-500/10">Cook County</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Pipeline status */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Pipeline Status</p>
            <select
              value={lead.status}
              onChange={e => updateField({ status: e.target.value })}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500/50"
            >
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Contact info */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Contact</p>
            {row(<><Phone className="w-3 h-3 inline mr-1" />Phone</>, lead.phone)}
            {row(<><MapPin className="w-3 h-3 inline mr-1" />Address</>, lead.address)}
            {row(<><Mail className="w-3 h-3 inline mr-1" />Source</>, SOURCE_LABEL[lead.source] ?? lead.source)}
          </div>

          {/* Deal data */}
          {(lead.deal_arv || lead.deal_flip_profit != null || lead.deal_cash_flow != null) && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Deal Data</p>
              {lead.deal_arv ? row("ARV", fmt(lead.deal_arv)) : null}
              {lead.deal_flip_profit != null ? row("Flip Profit", <span className={SIGNAL_COLOR[lead.deal_signal ?? ""] ?? "text-zinc-200"}>{fmt(lead.deal_flip_profit)}</span>) : null}
              {lead.deal_cash_flow != null ? row("Cash Flow", `${fmt(lead.deal_cash_flow)}/mo`) : null}
              {lead.deal_condition ? row("Condition", lead.deal_condition) : null}
              {lead.deal_signal ? row("Signal", <span className={SIGNAL_COLOR[lead.deal_signal] ?? ""}>{lead.deal_signal}</span>) : null}
              {row("Qual. Score", lead.qualification_score)}
            </div>
          )}

          {/* Email sequence */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Email Sequence</p>
            {row("Sequence", lead.email_sequence ? SEQ_LABEL[lead.email_sequence] ?? lead.email_sequence : "None")}
            {row("Step", lead.sequence_step)}
            {row("Next Email", lead.next_email_at ? timeAgo(lead.next_email_at) : "Complete")}
            <button
              onClick={togglePause}
              disabled={saving}
              className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50 border-white/[0.08] text-zinc-400 hover:text-zinc-200"
            >
              {lead.sequence_paused ? <><Play className="w-3 h-3" />Resume Sequence</> : <><Pause className="w-3 h-3" />Pause Sequence</>}
            </button>
          </div>

          {/* Tags */}
          {lead.tags?.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2"><Tag className="w-3 h-3 inline mr-1" />Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {lead.tags.map(t => (
                  <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-zinc-400">{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Notes</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Add notes..."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 resize-none"
            />
            <button onClick={saveNotes} disabled={saving || notes === (lead.notes ?? "")} className="mt-1.5 text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-40 transition-colors">
              {saving ? "Saving…" : "Save Notes"}
            </button>
          </div>

          {/* Activity log */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2"><Activity className="w-3 h-3 inline mr-1" />Activity</p>
            {activity.length === 0 ? (
              <p className="text-xs text-zinc-600">No activity yet.</p>
            ) : (
              <div className="space-y-2">
                {activity.map(a => (
                  <div key={a.id} className="flex gap-3 items-start">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                    <div>
                      <p className="text-xs text-zinc-300">{a.notes ?? a.type}</p>
                      <p className="text-[10px] text-zinc-600">{timeAgo(a.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main CRM Page ─────────────────────────────────────────────────────────────

export default function CRMPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [filterSource, setFilterSource] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSeq, setFilterSeq] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    // Admin guard
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push("/"); return; }
      const { data: profile } = await supabase.from("profiles").select("plan").eq("id", session.user.id).single();
      if (profile?.plan !== "admin") { router.push("/"); return; }
      loadLeads();
    });
  }, []);

  const loadLeads = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    setLeads(data ?? []);
    setLoading(false);
  };

  const updateLead = (updated: Lead) => {
    setLeads(ls => ls.map(l => l.id === updated.id ? updated : l));
    setSelected(updated);
  };

  const filtered = useMemo(() => leads.filter(l => {
    if (filterSource !== "all" && l.source !== filterSource) return false;
    if (filterStatus !== "all" && l.status !== filterStatus) return false;
    if (filterSeq !== "all" && l.email_sequence !== filterSeq) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!l.email.toLowerCase().includes(q) && !(l.name ?? "").toLowerCase().includes(q) && !(l.address ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  }), [leads, filterSource, filterStatus, filterSeq, search]);

  const stats = useMemo(() => ({
    total: leads.length,
    cookCounty: leads.filter(l => l.is_service_area).length,
    clients: leads.filter(l => l.status === "client" || l.status === "converted").length,
    new: leads.filter(l => l.status === "new").length,
  }), [leads]);

  const selectClass = "bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500/40";

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-200">
      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-widest text-indigo-400 mb-1">Internal</p>
            <h1 className="text-2xl font-serif text-zinc-100">CRM</h1>
          </div>
          <button onClick={loadLeads} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.08] text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Leads", value: stats.total },
            { label: "Cook County", value: stats.cookCounty },
            { label: "New", value: stats.new },
            { label: "Clients", value: stats.clients },
          ].map(s => (
            <div key={s.label} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
              <p className="text-xs text-zinc-500 mb-1">{s.label}</p>
              <p className="text-2xl font-serif text-zinc-100">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            type="text"
            placeholder="Search name, email, address…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/40 w-56"
          />
          <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className={selectClass}>
            <option value="all">All Sources</option>
            {Object.entries(SOURCE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={selectClass}>
            <option value="all">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterSeq} onChange={e => setFilterSeq(e.target.value)} className={selectClass}>
            <option value="all">All Sequences</option>
            {Object.entries(SEQ_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <span className="text-xs text-zinc-600 self-center">{filtered.length} leads</span>
        </div>

        {/* Table */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["Lead", "Source", "Status", "Sequence", "Signal", "Score", "Cook Co.", "Added"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] uppercase tracking-widest text-zinc-500 font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-600">Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-600">No leads found.</td></tr>
                ) : filtered.map(lead => (
                  <tr
                    key={lead.id}
                    onClick={() => setSelected(lead)}
                    className="border-b border-white/[0.04] hover:bg-white/[0.03] cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="text-zinc-200 font-medium">{lead.name ?? lead.email}</p>
                      {lead.name && <p className="text-zinc-600">{lead.email}</p>}
                      {lead.address && <p className="text-zinc-600 truncate max-w-[200px]">{lead.address}</p>}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{SOURCE_LABEL[lead.source] ?? lead.source}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] ${STATUS_COLOR[lead.status] ?? "border-white/10 text-zinc-400"}`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {lead.email_sequence ? SEQ_LABEL[lead.email_sequence] ?? lead.email_sequence : "—"}
                      {lead.sequence_paused && <span className="ml-1 text-amber-500">⏸</span>}
                    </td>
                    <td className="px-4 py-3">
                      {lead.deal_signal ? (
                        <span className={`font-medium ${SIGNAL_COLOR[lead.deal_signal] ?? "text-zinc-400"}`}>
                          {lead.deal_signal}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{lead.qualification_score ?? "—"}</td>
                    <td className="px-4 py-3">
                      {lead.is_service_area ? <span className="text-indigo-400">✓</span> : <span className="text-zinc-700">—</span>}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{timeAgo(lead.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selected && (
        <LeadDrawer
          lead={selected}
          onClose={() => setSelected(null)}
          onUpdate={updateLead}
        />
      )}
    </div>
  );
}
