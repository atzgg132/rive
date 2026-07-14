"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  Users, Eye, TrendingUp, Zap, LogOut, Search, RefreshCw,
  ChevronLeft, ChevronRight, Mail, Clock, Shield, Loader2,
  AlertCircle, CheckCircle2, XCircle, ChevronUp, ChevronDown,
  Filter, CheckCheck,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────
type Analytics = {
  totalSignups: number; last24h: number; last7d: number;
  remitInterest: number; approvedCount: number; totalViews: number;
  topPaths: { path: string; views: number }[];
  signupsPerDay: { day: string; count: number }[];
  viewsPerDay:   { day: string; count: number }[];
  typeBreakdown: { type: string; count: number }[];
};

type WaitlistEntry = {
  id: number; email: string; type: string;
  status: "pending" | "approved"; created_at: string;
};

type SortField = "email" | "type" | "status" | "created_at";
type SortOrder = "ASC" | "DESC";

const API = "";

// ── Helpers ───────────────────────────────────────────────
function fmt(n: number) { return n >= 1000 ? (n/1000).toFixed(1)+"k" : String(n); }

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60)  return "just now";
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const w = 80, h = 28, p = 2;
  const pts = data.map((v, i) =>
    `${p+(i/Math.max(data.length-1,1))*(w-p*2)},${p+(1-v/max)*(h-p*2)}`
  ).join(" ");
  const last = pts.split(" ").at(-1)!.split(",");
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={last[0]} cy={last[1]} r="3" fill={color}/>
    </svg>
  );
}

function MiniBarChart({ data, label }: { data:{day:string;count:number}[]; label:string }) {
  if (!data.length) return <div className="text-slate-400 text-sm py-8 text-center" style={{fontFamily:"Outfit,sans-serif"}}>no data yet</div>;
  const max = Math.max(...data.map(d=>d.count), 1);
  return (
    <div>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4" style={{fontFamily:"Outfit,sans-serif"}}>{label}</p>
      <div className="flex items-end gap-1.5 h-20">
        {data.map((d,i) => (
          <div key={i} className="flex-1 flex flex-col items-center group relative">
            <div className="w-full bg-blue-100 hover:bg-blue-400 transition-colors rounded-t-sm cursor-default"
              style={{height:`${(d.count/max)*100}%`,minHeight:d.count>0?"4px":"0"}}
              title={`${d.day}: ${d.count}`}/>
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" style={{fontFamily:"Outfit,sans-serif"}}>{d.count}</div>
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-slate-300" style={{fontFamily:"Outfit,sans-serif"}}>{data[0]?.day?.slice(5)}</span>
        <span className="text-[10px] text-slate-300" style={{fontFamily:"Outfit,sans-serif"}}>{data.at(-1)?.day?.slice(5)}</span>
      </div>
    </div>
  );
}

// ── Login ─────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (t:string)=>void }) {
  const [username,setUsername] = useState("");
  const [password,setPassword] = useState("");
  const [state,setState]       = useState<"idle"|"loading"|"error">("idle");
  const [err,setErr]           = useState("");

  const submit = async (e:React.FormEvent) => {
    e.preventDefault(); setState("loading"); setErr("");
    try {
      const r = await fetch(`${API}/api/admin/login`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,password})});
      const d = await r.json();
      if (d.success) { onLogin(d.token); }
      else { setErr(d.message||"invalid credentials."); setState("error"); }
    } catch { setErr("cannot reach server — make sure it is running on port 5000."); setState("error"); }
  };

  const F = {fontFamily:"Outfit,sans-serif"};
  return (
    <div className="min-h-screen bg-[#F5F8FC] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Image src="/brand-assets/logo.png" alt="rive." width={100} height={44} style={{objectFit:"contain"}} priority/>
        </div>
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 p-8">
          <div className="text-center mb-7">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-6 h-6 text-blue-600"/>
            </div>
            <h1 className="text-2xl font-bold text-[#0C1E36]" style={F}>admin portal</h1>
            <p className="text-slate-400 text-sm mt-1" style={F}>rive. internal dashboard</p>
          </div>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide" style={F}>username</label>
              <input value={username} onChange={e=>setUsername(e.target.value)} required autoFocus placeholder="Admin1"
                className="px-4 py-3 rounded-xl border border-slate-200 text-slate-800 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all" style={F}/>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide" style={F}>password</label>
              <input value={password} onChange={e=>setPassword(e.target.value)} required type="password" placeholder="••••••••••"
                className="px-4 py-3 rounded-xl border border-slate-200 text-slate-800 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all" style={F}/>
            </div>
            {state==="error" && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm" style={F}>
                <AlertCircle className="w-4 h-4 shrink-0"/>{err}
              </div>
            )}
            <button type="submit" disabled={state==="loading"}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 text-white font-bold text-sm hover:from-blue-700 hover:to-sky-600 transition-all shadow-lg shadow-blue-600/15 disabled:opacity-75 flex items-center justify-center gap-2 mt-1" style={F}>
              {state==="loading"?<><Loader2 className="w-4 h-4 animate-spin"/>authenticating...</>:"sign in →"}
            </button>
          </form>
          <p className="text-center text-slate-300 text-xs mt-5" style={F}>session not persisted — log in each visit.</p>
        </div>
      </div>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────
function StatCard({icon:Icon,label,value,sub,sparkData,color,bgColor,borderColor,sparkColor}:{
  icon:React.ElementType;label:string;value:string|number;sub:string;
  sparkData?:number[];color:string;bgColor:string;borderColor:string;sparkColor:string;
}) {
  const F = {fontFamily:"Outfit,sans-serif"};
  return (
    <div className={`bg-white rounded-2xl border ${borderColor} shadow-sm p-6 flex flex-col gap-4`}>
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl ${bgColor} flex items-center justify-center shrink-0`}>
          <Icon className={`w-5 h-5 ${color}`}/>
        </div>
        {sparkData && <Sparkline data={sparkData} color={sparkColor}/>}
      </div>
      <div>
        <p className="text-3xl font-bold text-[#0C1E36]" style={F}>{value}</p>
        <p className="text-sm font-semibold text-slate-500 mt-0.5" style={F}>{label}</p>
        <p className="text-xs text-slate-400 mt-1" style={F}>{sub}</p>
      </div>
    </div>
  );
}

// ── Sort header cell ──────────────────────────────────────
function SortTh({field,label,sortField,sortOrder,onSort}:{
  field:SortField;label:string;sortField:SortField;sortOrder:SortOrder;onSort:(f:SortField)=>void;
}) {
  const active = sortField === field;
  const F = {fontFamily:"Outfit,sans-serif"};
  return (
    <th className="text-left px-6 py-3 cursor-pointer select-none group" onClick={()=>onSort(field)}>
      <div className="flex items-center gap-1">
        <span className={`text-[11px] font-bold uppercase tracking-widest transition-colors ${active?"text-blue-600":"text-slate-400 group-hover:text-slate-600"}`} style={F}>{label}</span>
        <span className="flex flex-col gap-0">
          <ChevronUp   className={`w-2.5 h-2.5 -mb-0.5 ${active&&sortOrder==="ASC"  ?"text-blue-600":"text-slate-300"}`}/>
          <ChevronDown className={`w-2.5 h-2.5           ${active&&sortOrder==="DESC" ?"text-blue-600":"text-slate-300"}`}/>
        </span>
      </div>
    </th>
  );
}

// ── Status badge ──────────────────────────────────────────
function StatusBadge({status}:{status:"pending"|"approved"}) {
  return status==="approved"
    ? <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-[11px] font-bold" style={{fontFamily:"Outfit,sans-serif"}}><CheckCircle2 className="w-3 h-3"/>approved</span>
    : <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100 text-[11px] font-bold" style={{fontFamily:"Outfit,sans-serif"}}><Clock className="w-3 h-3"/>pending</span>;
}

// ── Dashboard ─────────────────────────────────────────────
function Dashboard({ token, onLogout }:{ token:string; onLogout:()=>void }) {
  const [analytics,  setAnalytics]  = useState<Analytics|null>(null);
  const [waitlist,   setWaitlist]   = useState<WaitlistEntry[]>([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [search,     setSearch]     = useState("");
  const [searchInput,setSearchInput]= useState("");
  const [filterStatus,setFilterStatus] = useState<"all"|"pending"|"approved">("all");
  const [filterType,  setFilterType]   = useState("all");
  const [sortField,  setSortField]  = useState<SortField>("created_at");
  const [sortOrder,  setSortOrder]  = useState<SortOrder>("DESC");
  const [approving,  setApproving]  = useState<Set<number>>(new Set());
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [limit, setLimit]    = useState(20);
  const F = {fontFamily:"Outfit,sans-serif"};
  const headers = {"x-admin-token":token,"Content-Type":"application/json"} as const;

  const fetchAnalytics = useCallback(async()=>{
    try {
      const r = await fetch(`${API}/api/admin/analytics`,{headers});
      const d = await r.json();
      if(d.success) setAnalytics(d.data);
    } catch{}
  },[token]);

  const fetchWaitlist = useCallback(async()=>{
    try {
      const p = new URLSearchParams({
        page:String(page), limit:String(limit), search,
        status:filterStatus, type:filterType,
        sort:sortField, order:sortOrder,
      });
      const r = await fetch(`${API}/api/admin/waitlist?${p}`,{headers});
      const d = await r.json();
      if(d.success){ setWaitlist(d.data); setTotal(d.total); }
    } catch{}
  },[token,page,limit,search,filterStatus,filterType,sortField,sortOrder]);

  const refresh = async()=>{
    setRefreshing(true);
    await Promise.all([fetchAnalytics(),fetchWaitlist()]);
    setRefreshing(false);
  };

  useEffect(()=>{ setLoading(true); Promise.all([fetchAnalytics(),fetchWaitlist()]).finally(()=>setLoading(false)); },[fetchAnalytics,fetchWaitlist]);
  useEffect(()=>{ const i=setInterval(refresh,30000); return()=>clearInterval(i); },[token,page,search,filterStatus,filterType,sortField,sortOrder]);

  const handleSearch = (e:React.FormEvent)=>{ e.preventDefault(); setSearch(searchInput); setPage(1); };
  const handleClear  = ()=>{ setSearch(""); setSearchInput(""); setPage(1); };

  const handleSort = (field:SortField)=>{
    if(sortField===field) setSortOrder(o=>o==="ASC"?"DESC":"ASC");
    else { setSortField(field); setSortOrder("ASC"); }
    setPage(1);
  };

  const handleApprove = async (entry:WaitlistEntry)=>{
    const newStatus = entry.status==="approved"?"pending":"approved";
    setApproving(s=>new Set(s).add(entry.id));
    // Optimistic update
    setWaitlist(prev=>prev.map(e=>e.id===entry.id?{...e,status:newStatus as any}:e));
    try {
      const r = await fetch(`${API}/api/admin/waitlist/${entry.id}`,{method:"PATCH",headers,body:JSON.stringify({status:newStatus})});
      const d = await r.json();
      if(!d.success) {
        // Revert on failure
        setWaitlist(prev=>prev.map(e=>e.id===entry.id?{...e,status:entry.status}:e));
      } else {
        // Update analytics count
        setAnalytics(prev=>prev?{...prev,approvedCount:prev.approvedCount+(newStatus==="approved"?1:-1)}:prev);
      }
    } catch {
      setWaitlist(prev=>prev.map(e=>e.id===entry.id?{...e,status:entry.status}:e));
    }
    setApproving(s=>{ const n=new Set(s); n.delete(entry.id); return n; });
  };

  const totalPages = Math.ceil(total/limit);

  // Collect unique types for the type filter
  const knownTypes = ["all","waitlist","remit","login","demo"];

  if(loading) return (
    <div className="min-h-screen bg-[#F5F8FC] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin"/>
        <p className="text-slate-400 text-sm" style={F}>loading dashboard...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F5F8FC]">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-[#F5F8FC]/90 backdrop-blur-xl border-b border-black/[0.06]">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/brand-assets/logo.png" alt="rive." width={72} height={32} style={{objectFit:"contain"}} priority/>
            <div className="h-4 w-px bg-slate-200"/>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest" style={F}>admin</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={refresh} disabled={refreshing}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 transition-colors font-medium disabled:opacity-50" style={F}>
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing?"animate-spin":""}`}/>
              {refreshing?"refreshing...":"refresh"}
            </button>
            <button onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-500 hover:border-red-200 hover:text-red-600 hover:bg-red-50 transition-all" style={F}>
              <LogOut className="w-3.5 h-3.5"/>sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Title */}
        <div>
          <h1 className="text-3xl font-bold text-[#0C1E36]" style={F}>dashboard</h1>
          <p className="text-slate-400 text-sm mt-0.5 flex items-center gap-2" style={F}>
            live data · auto-refreshes every 30s
            <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block"/>live</span>
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard icon={Eye}        label="page views"       value={fmt(analytics?.totalViews??0)}     sub="all time" sparkData={analytics?.viewsPerDay.map(d=>d.count)} sparkColor="#3B82F6" color="text-blue-600" bgColor="bg-blue-50" borderColor="border-blue-100"/>
          <StatCard icon={Users}      label="total signups"    value={fmt(analytics?.totalSignups??0)}   sub={`+${analytics?.last24h??0} today · +${analytics?.last7d??0} this week`} sparkData={analytics?.signupsPerDay.map(d=>d.count)} sparkColor="#10B981" color="text-emerald-600" bgColor="bg-emerald-50" borderColor="border-emerald-100"/>
          <StatCard icon={CheckCheck} label="approved"         value={analytics?.approvedCount??0}       sub={`${analytics?.totalSignups?Math.round(((analytics.approvedCount??0)/analytics.totalSignups)*100):0}% approval rate`} color="text-sky-600" bgColor="bg-sky-50" borderColor="border-sky-100" sparkColor="#0EA5E9"/>
          <StatCard icon={TrendingUp} label="last 24h"         value={analytics?.last24h??0}             sub={`${analytics?.last7d??0} in past 7 days`} color="text-purple-600" bgColor="bg-purple-50" borderColor="border-purple-100" sparkColor="#8B5CF6"/>
          <StatCard icon={Zap}        label="remit interest"   value={analytics?.remitInterest??0}       sub="from remit section" color="text-amber-600" bgColor="bg-amber-50" borderColor="border-amber-100" sparkColor="#F59E0B"/>
        </div>

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6"><MiniBarChart data={analytics?.signupsPerDay??[]} label="signups — last 14 days"/></div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6"><MiniBarChart data={analytics?.viewsPerDay??[]}   label="page views — last 14 days"/></div>
        </div>

        {/* Top pages + type breakdown */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4" style={F}>top pages by views</p>
            {analytics?.topPaths.length ? analytics.topPaths.map((p,i)=>{
              const max = analytics.topPaths[0].views;
              return (
                <div key={p.path} className="flex items-center gap-3 mb-2">
                  <span className="text-xs text-slate-300 font-bold w-4 text-right shrink-0" style={F}>{i+1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-600 truncate" style={F}>{p.path||"/"}</span>
                      <span className="text-xs font-bold text-slate-500 ml-2 shrink-0" style={F}>{p.views}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full"><div className="h-full bg-blue-400 rounded-full" style={{width:`${(p.views/max)*100}%`}}/></div>
                  </div>
                </div>
              );
            }) : <div className="text-slate-400 text-sm py-8 text-center" style={F}>no page views yet</div>}
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4" style={F}>signup source breakdown</p>
            {analytics?.typeBreakdown.length ? analytics.typeBreakdown.map(t=>{
              const ttl = analytics.typeBreakdown.reduce((s,x)=>s+x.count,0);
              const pct = ttl>0?Math.round((t.count/ttl)*100):0;
              const colors:Record<string,string>={waitlist:"bg-blue-500",login:"bg-purple-500",demo:"bg-amber-500",remit:"bg-emerald-500"};
              return (
                <div key={t.type} className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-bold text-slate-500 w-16 shrink-0" style={F}>{t.type}</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${colors[t.type]??"bg-slate-400"} transition-all duration-500`} style={{width:`${pct}%`}}/>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs font-bold text-slate-600" style={F}>{t.count}</span>
                    <span className="text-[10px] text-slate-400" style={F}>({pct}%)</span>
                  </div>
                </div>
              );
            }) : <div className="text-slate-400 text-sm py-8 text-center" style={F}>no signups yet</div>}
          </div>
        </div>

        {/* ── Waitlist table ─────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

          {/* Table controls */}
          <div className="px-6 py-4 border-b border-slate-100 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="font-bold text-[#0C1E36] text-lg" style={F}>waitlist</h2>
                <p className="text-slate-400 text-xs mt-0.5" style={F}>
                  {total} entries · page {page} of {Math.max(totalPages,1)}
                </p>
              </div>
              {/* Search */}
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"/>
                  <input value={searchInput} onChange={e=>setSearchInput(e.target.value)} placeholder="search emails..."
                    className="pl-8 pr-4 py-2 text-sm rounded-xl border border-slate-200 text-slate-700 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all w-52" style={F}/>
                </div>
                <button type="submit" className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors" style={F}>search</button>
                {search && <button type="button" onClick={handleClear} className="px-3 py-2 rounded-xl border border-slate-200 text-slate-500 text-sm hover:border-slate-300 transition-colors" style={F}>clear</button>}
              </form>
            </div>

            {/* Filter row */}
            <div className="flex flex-wrap gap-2 items-center">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0"/>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest" style={F}>filter:</span>

              {/* Status filter */}
              <div className="flex rounded-xl border border-slate-200 overflow-hidden text-xs font-bold">
                {(["all","pending","approved"] as const).map(s=>(
                  <button key={s} onClick={()=>{setFilterStatus(s);setPage(1);}}
                    className={`px-3 py-1.5 transition-colors ${filterStatus===s?"bg-blue-600 text-white":"text-slate-500 hover:bg-slate-50"}`} style={F}>
                    {s}
                  </button>
                ))}
              </div>

              {/* Type filter */}
              <select value={filterType} onChange={e=>{setFilterType(e.target.value);setPage(1);}}
                className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 text-slate-600 bg-white focus:outline-none focus:border-blue-400 transition-all" style={F}>
                {knownTypes.map(t=><option key={t} value={t}>{t==="all"?"all sources":t}</option>)}
              </select>

              {/* Active filter indicators */}
              {(filterStatus!=="all"||filterType!=="all"||search) && (
                <button onClick={()=>{setFilterStatus("all");setFilterType("all");handleClear();}}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-xs font-bold hover:bg-red-100 transition-colors" style={F}>
                  <XCircle className="w-3 h-3"/>reset all
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-50">
                  <th className="text-left px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest" style={F}>#</th>
                  <SortTh field="email"      label="email"     sortField={sortField} sortOrder={sortOrder} onSort={handleSort}/>
                  <SortTh field="type"       label="source"    sortField={sortField} sortOrder={sortOrder} onSort={handleSort}/>
                  <SortTh field="status"     label="status"    sortField={sortField} sortOrder={sortOrder} onSort={handleSort}/>
                  <SortTh field="created_at" label="signed up" sortField={sortField} sortOrder={sortOrder} onSort={handleSort}/>
                  <th className="text-right px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest" style={F}>action</th>
                </tr>
              </thead>
              <tbody>
                {waitlist.length===0 ? (
                  <tr><td colSpan={6} className="text-center py-16 text-slate-400 text-sm" style={F}>
                    {search?`no results for "${search}"`:"no entries match the current filters"}
                  </td></tr>
                ) : waitlist.map((entry,i)=>{
                  const isApproving = approving.has(entry.id);
                  return (
                    <tr key={entry.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-3.5 text-xs text-slate-300 font-bold" style={F}>{(page-1)*limit+i+1}</td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                            <Mail className="w-3.5 h-3.5 text-blue-500"/>
                          </div>
                          <span className="text-sm font-medium text-slate-700" style={F}>{entry.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          entry.type==="waitlist"?"bg-blue-50 text-blue-600 border border-blue-100":
                          entry.type==="remit"   ?"bg-emerald-50 text-emerald-600 border border-emerald-100":
                          entry.type==="login"   ?"bg-purple-50 text-purple-600 border border-purple-100":
                          "bg-amber-50 text-amber-600 border border-amber-100"
                        }`} style={F}>{entry.type}</span>
                      </td>
                      <td className="px-6 py-3.5"><StatusBadge status={entry.status}/></td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Clock className="w-3.5 h-3.5 shrink-0"/>
                          <span className="text-xs font-medium" style={F}>{timeAgo(entry.created_at)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <button
                          onClick={()=>handleApprove(entry)}
                          disabled={isApproving}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed ${
                            entry.status==="approved"
                              ? "border border-slate-200 text-slate-500 hover:border-red-200 hover:text-red-600 hover:bg-red-50"
                              : "border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                          }`} style={F}>
                          {isApproving ? (
                            <Loader2 className="w-3 h-3 animate-spin"/>
                          ) : entry.status==="approved" ? (
                            <><XCircle className="w-3 h-3"/>revoke</>
                          ) : (
                            <><CheckCircle2 className="w-3 h-3"/>approve</>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination + per-page selector */}
          <div className="px-6 py-4 border-t border-slate-50 flex flex-wrap items-center justify-between gap-3">
            {/* Left: entry range + per-page picker */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400" style={F}>
                {total === 0 ? "0 entries" : `${(page-1)*limit+1}–${Math.min(page*limit,total)} of ${total}`}
              </span>
              <div className="h-3.5 w-px bg-slate-200"/>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium" style={F}>per page</span>
                <div className="flex rounded-xl border border-slate-200 overflow-hidden text-xs font-bold">
                  {[10,20,50,100].map(n=>(
                    <button key={n} onClick={()=>{ setLimit(n); setPage(1); }}
                      className={`px-3 py-1.5 transition-colors ${limit===n?"bg-blue-600 text-white":"text-slate-500 hover:bg-slate-50"}`} style={F}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {/* Right: page nav */}
            {totalPages>1 && (
              <div className="flex items-center gap-2">
                <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:border-blue-200 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                  <ChevronLeft className="w-4 h-4"/>
                </button>
                {Array.from({length:Math.min(5,totalPages)},(_,i)=>{
                  const pg=Math.max(1,Math.min(page-2,totalPages-4))+i;
                  return (
                    <button key={pg} onClick={()=>setPage(pg)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${pg===page?"bg-blue-600 text-white":"border border-slate-200 text-slate-500 hover:border-blue-200 hover:text-blue-600"}`} style={F}>
                      {pg}
                    </button>
                  );
                })}
                <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:border-blue-200 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                  <ChevronRight className="w-4 h-4"/>
                </button>
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────
export default function AdminPage() {
  const [token, setToken] = useState<string|null>(null);

  // Load token from sessionStorage on mount (if page is reloaded)
  useEffect(() => {
    const saved = sessionStorage.getItem("rive_admin_token");
    if (saved) setToken(saved);
  }, []);

  const handleLogin = (newToken: string) => {
    sessionStorage.setItem("rive_admin_token", newToken);
    setToken(newToken);
  };

  const handleLogout = async () => {
    if (token) {
      try { await fetch(`${API}/api/admin/logout`,{method:"POST",headers:{"x-admin-token":token}}); }
      catch {}
    }
    sessionStorage.removeItem("rive_admin_token");
    setToken(null);
  };

  return token ? <Dashboard token={token} onLogout={handleLogout}/> : <LoginScreen onLogin={handleLogin}/>;
}
