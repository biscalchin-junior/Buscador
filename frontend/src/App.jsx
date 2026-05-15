import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { RefreshCw, TrendingUp, TrendingDown, Minus, Trash2, PowerOff, Filter, Search, ArrowLeft, Zap, Shield, Clock, Database, Lock, Cpu, Sparkles, Command, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthProvider, useAuth } from './AuthContext';
import { AuthModal } from './AuthModal';
import SuperAdminPanel from './SuperAdminPanel';
import './index.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// ── Helpers ───────────────────────────────────────────────────────
const Badge = ({ children, color = 'blue' }) => (
  <span className={`badge-premium ${color === 'blue' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>{children}</span>
);

const renderVariationBadge = (v) => {
  if (!v || v === 0) return <span className="flex items-center gap-1 text-xs font-bold text-slate-400"><Minus size={13}/> Estável</span>;
  if (v > 0) return <span className="flex items-center gap-1 text-xs font-bold text-orange-500"><TrendingUp size={13}/> +{Number(v).toFixed(1)}%</span>;
  return <span className="flex items-center gap-1 text-xs font-bold text-emerald-500"><TrendingDown size={13}/> {Number(v).toFixed(1)}%</span>;
};

// ── Navbar ────────────────────────────────────────────────────────
const Navbar = ({ onAuthOpen }) => {
  const { user, logout, isGuest, isSuperAdmin } = useAuth();
  return (
    <nav className="fixed top-0 left-0 right-0 z-[100] bg-white/70 backdrop-blur-2xl border-b border-slate-200/50">
      <div className="section-container h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-slate-950 rounded-lg flex items-center justify-center"><Zap className="text-white fill-white" size={16}/></div>
          <span className="text-lg font-bold tracking-tight text-slate-950">Buscador<span className="text-blue-600">.ai</span></span>
          {isSuperAdmin && <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-700 text-[9px] font-black rounded-full uppercase tracking-widest">Superadmin</span>}
        </div>
        <div className="flex items-center gap-3">
          {isGuest ? (
            <div className="flex items-center gap-2">
              <button onClick={onAuthOpen} className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors">Entrar</button>
              <button onClick={onAuthOpen} className="px-5 py-2 bg-slate-950 text-white text-xs font-bold rounded-full hover:bg-slate-800 transition-all active:scale-95">Cadastrar</button>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-slate-50 pl-4 pr-1 py-1 rounded-full border border-slate-200">
              <span className="text-xs font-bold text-slate-600">{user.email}</span>
              <button onClick={logout} className="p-2 bg-white rounded-full shadow-sm hover:text-red-500 transition-colors"><PowerOff size={14}/></button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

// ── Hero / Search ─────────────────────────────────────────────────
const Hero = ({ urlsInput, setUrlsInput, onSearch, loading, searchResult }) => {
  const { isGuest } = useAuth();

  const handleKey = (e) => { if (e.key === 'Enter') onSearch(); };

  return (
    <section className="relative pt-32 pb-20 bg-grid overflow-hidden">
      <div className="spot-light top-0 left-1/4 animate-pulse-slow"/>
      <div className="spot-light bottom-0 right-1/4 bg-emerald-500/5"/>
      <div className="section-container relative z-10 text-center">
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="text-5xl md:text-7xl font-black text-slate-950 mb-6 leading-[1.1] tracking-[-0.04em]">
          Monitoramento <br/>
          <span className="hero-gradient-text italic">Autônomo de Preços.</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="text-lg text-slate-500 mb-10 max-w-xl mx-auto font-medium">
          Pesquise qualquer produto e veja histórico de preços em tempo real.
        </motion.p>

        <div className="max-w-2xl mx-auto">
          <div className="glass-card p-2 flex items-center shadow-2xl mb-4">
            <div className="flex-1 flex items-center px-5">
              <Command size={17} className="text-slate-400 mr-3"/>
              <input type="text" placeholder="Ex: Samsung Galaxy S24 ou cole um link..." value={urlsInput}
                onChange={e => setUrlsInput(e.target.value)} onKeyDown={handleKey}
                className="bg-transparent border-none text-slate-950 w-full focus:ring-0 text-sm font-medium outline-none"/>
            </div>
            <button onClick={onSearch}
              className="px-7 py-3.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-black rounded-2xl transition-all shadow-xl shadow-blue-500/20 active:scale-95 flex items-center gap-2">
              {loading ? <RefreshCw className="animate-spin" size={16}/> : <Sparkles size={16}/>} Buscar
            </button>
          </div>

          {/* Incentivo para guest após busca */}
          {isGuest && searchResult !== null && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 text-left mt-2">
              <Info size={16} className="text-blue-500 flex-shrink-0 mt-0.5"/>
              <p className="text-xs text-blue-700 font-medium leading-relaxed">
                <strong>Faça login para desbloquear:</strong> salvar pesquisas, criar alertas automáticos de preço e acompanhar monitoramentos personalizados.
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
};

// ── Metrics ───────────────────────────────────────────────────────
const MetricsGrid = () => (
  <section className="py-20 border-y border-slate-100 bg-white">
    <div className="section-container grid grid-cols-2 md:grid-cols-4 gap-10">
      {[
        { icon: <Clock/>, label: 'Latência', value: '< 800ms' },
        { icon: <Database/>, label: 'Dados/Dia', value: '500k+' },
        { icon: <Shield/>, label: 'Segurança', value: 'AES-256' },
        { icon: <Cpu/>, label: 'Engine', value: 'V8 Pro' },
      ].map((m, i) => (
        <div key={i} className="text-center">
          <div className="text-blue-600 mb-3 inline-block">{m.icon}</div>
          <h4 className="text-3xl font-black text-slate-950 mb-1">{m.value}</h4>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{m.label}</p>
        </div>
      ))}
    </div>
  </section>
);

// ── Public Results (guest) ────────────────────────────────────────
const PublicResults = ({ results, onAuthOpen }) => {
  if (!results || results.length === 0) return (
    <section className="section-container py-16 text-center">
      <p className="text-slate-400 font-medium">Nenhum resultado encontrado na base de dados para este termo.</p>
      <p className="text-xs text-slate-300 mt-2">Tente outro termo ou faça login para iniciar um monitoramento.</p>
    </section>
  );

  const cheapest = results.reduce((min, p) => (p.main_price < (min?.main_price || Infinity) ? p : min), null);

  return (
    <section className="section-container py-16">
      <div className="mb-6 flex items-center gap-3">
        <h2 className="text-xl font-black text-slate-950">Resultado da pesquisa</h2>
        <Badge color="emerald">Menor Preço</Badge>
      </div>

      {cheapest && (
        <div className="glass-card p-6 flex flex-col md:flex-row items-start gap-6 border-emerald-100 mb-6">
          <div className="w-20 h-20 bg-white border border-slate-100 rounded-2xl p-2 flex-shrink-0">
            <img src={cheapest.image_url} alt="" className="w-full h-full object-contain"/>
          </div>
          <div className="flex-1">
            <a href={cheapest.url} target="_blank" rel="noreferrer" className="text-base font-black text-slate-900 hover:text-blue-600 transition-colors line-clamp-2">{cheapest.title}</a>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-2xl font-black text-emerald-600">R$ {(cheapest.main_price || 0).toFixed(2)}</span>
              {cheapest.old_price > cheapest.main_price && <span className="text-xs text-red-500 font-bold">De R$ {cheapest.old_price.toFixed(2)}</span>}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Badge>{cheapest.store}</Badge>
              <span className="text-[10px] text-slate-400 font-bold uppercase">{cheapest.asin}</span>
            </div>
          </div>
          <div className="w-32 h-16 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={(cheapest.history || []).map(h => ({ price: h.main_price }))}>
                <Line type="monotone" dataKey="price" stroke="#10b981" strokeWidth={2} dot={false}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* CTA para criar conta */}
      <div className="bg-slate-950 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h3 className="text-lg font-black text-white">Este item já possui histórico monitorado 📊</h3>
          <p className="text-sm text-slate-400 mt-1">Crie sua conta gratuita para desbloquear alertas e monitoramentos personalizados.</p>
        </div>
        <button onClick={onAuthOpen} className="flex-shrink-0 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl transition-all shadow-xl shadow-blue-500/30 active:scale-95 text-sm">
          Criar conta grátis
        </button>
      </div>
    </section>
  );
};

// ── Dashboard (logado) ────────────────────────────────────────────
const Dashboard = ({ history, loading, onSearch }) => {
  const { token } = useAuth();
  const [searchFilter, setSearchFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [viewMode, setViewMode] = useState('main');
  const [refreshingAsin, setRefreshingAsin] = useState(null);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/history?trash=${viewMode === 'trash'}`);
      return await res.json();
    } catch { return []; }
  };

  const toggleTrash = async (asin, isRestore) => {
    try {
      await fetch(`${API_URL}/product/${asin}/${isRestore ? 'restore' : 'trash'}`, { method: 'PUT' });
      onSearch();
    } catch {}
  };

  const handleRefresh = async (url, asin) => {
    setRefreshingAsin(asin);
    try {
      await fetch(`${API_URL}/audit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ urls: [url] }) });
      onSearch();
    } catch {} finally { setRefreshingAsin(null); }
  };

  const filtered = useMemo(() => (history || []).filter(item => {
    const matchS = !searchFilter || item.title?.toLowerCase().includes(searchFilter.toLowerCase()) || item.asin?.toLowerCase().includes(searchFilter.toLowerCase());
    const matchC = !categoryFilter || (categoryFilter === 'active' ? item.is_active : true);
    return matchS && matchC;
  }), [history, searchFilter, categoryFilter]);

  return (
    <section className="py-16 section-container">
      {/* Toolbar */}
      <div className="glass-card p-4 flex flex-wrap items-center gap-4 sticky top-20 z-40 mb-6">
        <div className="flex-1 flex items-center gap-3 bg-slate-100/50 rounded-2xl px-5 py-2.5 border border-slate-100">
          <Search size={15} className="text-slate-400"/>
          <input type="text" placeholder="Filtrar produtos..." value={searchFilter} onChange={e => setSearchFilter(e.target.value)}
            className="bg-transparent border-none text-sm font-bold text-slate-900 focus:ring-0 w-full outline-none"/>
        </div>
        <div className="flex items-center gap-2">
          <select className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-600 focus:ring-blue-500 outline-none" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            <option value="">Todos</option>
            <option value="active">Ativos</option>
          </select>
          <button className="p-2.5 bg-slate-950 text-white rounded-xl hover:bg-slate-800"><Filter size={15}/></button>
          <button onClick={() => setViewMode(v => v === 'main' ? 'trash' : 'main')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${viewMode === 'trash' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-slate-100 text-slate-600'}`}>
            {viewMode === 'trash' ? <><ArrowLeft size={13}/> Voltar</> : <><Trash2 size={13}/> Lixeira</>}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden border-slate-200/50">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-black text-slate-950">Repositório de Inteligência</h3>
            <Badge color="emerald">Live</Badge>
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase">{filtered.length} resultados</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                {['Produto', 'Valor Atual', 'Variação', 'Performance', 'Ações'].map(h => (
                  <th key={h} className="p-5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(item => {
                const latest = item.latest || {};
                return (
                  <tr key={item.asin} className="hover:bg-slate-50/50 transition-all group">
                    <td className="p-5">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl border border-slate-100 bg-white p-1 flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                          <img src={item.image_url} alt="" className="w-full h-full object-contain"/>
                        </div>
                        <div>
                          <a href={latest.url} target="_blank" rel="noreferrer" className="text-sm font-black text-slate-900 hover:text-blue-600 transition-colors line-clamp-1">{latest.title}</a>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-bold text-slate-400">{item.asin}</span>
                            <Badge>{item.store}</Badge>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-5">
                      <span className="text-base font-black text-slate-950">R$ {(latest.main_price || 0).toFixed(2)}</span>
                      {latest.old_price > latest.main_price && <div className="text-[10px] font-bold text-red-500">-{latest.real_discount}% off</div>}
                    </td>
                    <td className="p-5">{renderVariationBadge(latest.variation)}</td>
                    <td className="p-5">
                      <div className="w-28 h-9">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={(item.history || []).map(h => ({ price: h.main_price }))}>
                            <Line type="monotone" dataKey="price" stroke="#3b82f6" strokeWidth={2} dot={false}/>
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </td>
                    <td className="p-5 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleRefresh(latest.url, item.asin)} className="p-2 rounded-xl bg-white border border-slate-200 hover:border-blue-500 hover:text-blue-600 transition-all">
                          <RefreshCw size={13} className={refreshingAsin === item.asin ? 'animate-spin' : ''}/>
                        </button>
                        <button onClick={() => toggleTrash(item.asin, viewMode === 'trash')} className="p-2 rounded-xl bg-white border border-slate-200 hover:border-red-500 hover:text-red-600 transition-all">
                          <Trash2 size={13}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="text-center py-16 text-sm text-slate-400">Nenhum produto encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

// ── Footer ────────────────────────────────────────────────────────
const Footer = () => (
  <footer className="py-16 border-t border-slate-100 bg-white">
    <div className="section-container flex flex-col md:flex-row justify-between items-center gap-6">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 bg-slate-950 rounded-lg flex items-center justify-center"><Zap className="text-white fill-white" size={14}/></div>
        <span className="font-bold text-slate-950">Buscador<span className="text-blue-600">.ai</span></span>
      </div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">© 2026 Buscador.ai — Built for scale</p>
      <div className="flex gap-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        <a href="#" className="hover:text-slate-950">GitHub</a>
        <a href="#" className="hover:text-slate-950">LinkedIn</a>
      </div>
    </div>
  </footer>
);

// ── Inner App (accesses auth context) ────────────────────────────
function InnerApp() {
  const { user, isGuest, isSuperAdmin, token } = useAuth();
  const [urlsInput, setUrlsInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [publicResults, setPublicResults] = useState(null); // null = não buscou ainda
  const [isBackgroundScanning, setIsBackgroundScanning] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [modal, setModal] = useState({ show: false, title: '', message: '', onConfirm: null });

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/history?trash=false`);
      setHistory(await res.json());
    } catch {}
  };

  useEffect(() => { if (!isGuest) fetchHistory(); }, [isGuest]);

  useEffect(() => {
    let iv;
    if (isBackgroundScanning) {
      iv = setInterval(async () => {
        try {
          const res = await fetch(`${API_URL}/audit/progress`);
          const d = await res.json();
          if (!d.active) { setIsBackgroundScanning(false); fetchHistory(); }
        } catch {}
      }, 3000);
    }
    return () => clearInterval(iv);
  }, [isBackgroundScanning]);

  const handleSearch = async () => {
    if (!urlsInput.trim()) return;
    setLoading(true);

    if (isGuest) {
      // Pesquisa pública
      try {
        const res = await fetch(`${API_URL}/public/search`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ term: urlsInput.trim(), userLabel: 'Guest User' })
        });
        const data = await res.json();
        setPublicResults(data.results || []);
      } catch {} finally { setLoading(false); }
    } else {
      // Usuário logado — inicia auditoria real
      if (!urlsInput.trim() && history.length > 0) {
        setModal({ show: true, title: 'Atualização Global', message: 'Deseja re-auditar todos os produtos agora?', onConfirm: async () => {
          try { await fetch(`${API_URL}/audit/active`, { method: 'POST' }); setIsBackgroundScanning(true); } catch {}
        }});
        setLoading(false);
        return;
      }
      const urls = urlsInput.split('\n').filter(u => u.trim());
      try {
        const res = await fetch(`${API_URL}/audit`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls })
        });
        if (res.ok) { setIsBackgroundScanning(true); setUrlsInput(''); }
      } catch {} finally { setLoading(false); }
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Navbar onAuthOpen={() => setAuthOpen(true)}/>
      <main>
        <Hero urlsInput={urlsInput} setUrlsInput={setUrlsInput} onSearch={handleSearch} loading={loading} searchResult={publicResults}/>
        <MetricsGrid/>

        {/* Guest: mostra resultados públicos */}
        {isGuest && publicResults !== null && (
          <PublicResults results={publicResults} onAuthOpen={() => setAuthOpen(true)}/>
        )}

        {/* Logado: dashboard completo */}
        {!isGuest && (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
            <Dashboard history={history} loading={loading} onSearch={fetchHistory}/>
          </motion.div>
        )}

        {/* Superadmin: painel extra */}
        {isSuperAdmin && <SuperAdminPanel/>}
      </main>
      <Footer/>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)}/>

      {/* Confirm modal */}
      <AnimatePresence>
        {modal.show && (
          <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-900/10 backdrop-blur-sm p-6" onClick={() => setModal({ ...modal, show: false })}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-sm glass-card p-8 text-center border-slate-100 shadow-2xl" onClick={e => e.stopPropagation()}>
              <h4 className="text-lg font-black text-slate-950 mb-3">{modal.title}</h4>
              <p className="text-sm text-slate-500 mb-8 font-medium">{modal.message}</p>
              <div className="flex gap-2">
                <button onClick={() => setModal({ ...modal, show: false })} className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 text-slate-500 font-bold rounded-xl text-xs">Cancelar</button>
                <button onClick={() => { modal.onConfirm?.(); setModal({ ...modal, show: false }); }} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs">Confirmar</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <InnerApp/>
    </AuthProvider>
  );
}
