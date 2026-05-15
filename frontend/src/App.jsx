import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  Upload, Play, RefreshCw, TrendingUp, TrendingDown, Minus, Trash2, 
  Power, PowerOff, Filter, Search, Settings, ArrowLeft, RotateCcw, 
  Camera, Users, Video, ShoppingCart, Mail, User, CheckCircle, 
  Zap, Shield, BarChart3, ChevronRight, Globe, Info, Activity,
  Clock, Database, Lock, Cpu, Sparkles, Command, ArrowUpRight
} from 'lucide-react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import cronParser from 'cron-parser';
import './index.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const MOCKUP_IMG = '/dashboard_mockup.png';

// --- Motion Variants ---
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: 'spring', stiffness: 100 }
  }
};

function App() {
  // --- States (Preserving logic) ---
  const [urlsInput, setUrlsInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshingAsin, setRefreshingAsin] = useState(null);
  const [history, setHistory] = useState([]);
  const [auditMessage, setAuditMessage] = useState('');
  const [viewMode, setViewMode] = useState('main'); 
  const [searchFilter, setSearchFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [cronSchedule, setCronSchedule] = useState('0 0 * * *');
  const [timeRemaining, setTimeRemaining] = useState('');
  const [isBackgroundScanning, setIsBackgroundScanning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [isHeadless, setIsHeadless] = useState(true);
  const [isRelevancyEnabled, setIsRelevancyEnabled] = useState(true);
  const [showLogs, setShowLogs] = useState(false);
  const [isLogsEnabled, setIsLogsEnabled] = useState(true);
  const [auditProgress, setAuditProgress] = useState({ current: 0, total: 0, active: false });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [sortOrder, setSortOrder] = useState(null);
  const [user, setUser] = useState(null); 
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [modal, setModal] = useState({ show: false, title: '', message: '', onConfirm: null, type: 'confirm' });

  // --- Core Effects ---
  const fetchHistory = async () => {
    try {
      const isTrash = viewMode === 'trash';
      const res = await fetch(`${API_URL}/history?trash=${isTrash}`);
      const data = await res.json();
      setHistory(data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchSettings();
    fetchHistory();
    const checkActiveAudit = async () => {
      try {
        const res = await fetch(`${API_URL}/audit/progress`);
        const data = await res.json();
        if (data.active) { setIsBackgroundScanning(true); setAuditProgress(data); }
      } catch (e) {}
    };
    checkActiveAudit();
  }, []);

  useEffect(() => {
    let interval;
    if (isBackgroundScanning) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`${API_URL}/audit/progress`);
          const data = await res.json();
          setAuditProgress(data);
          if (!data.active) { setIsBackgroundScanning(false); fetchHistory(); }
        } catch (e) {}
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isBackgroundScanning]);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/settings/cron`);
      const data = await res.json();
      setCronSchedule(data.schedule);
      const hRes = await fetch(`${API_URL}/settings/headless`);
      const hData = await hRes.json();
      setIsHeadless(hData.enabled);
      const rRes = await fetch(`${API_URL}/settings/relevancy`);
      const rData = await rRes.json();
      setIsRelevancyEnabled(rData.enabled);
    } catch (err) {}
  };

  // --- Handlers ---
  const handleStartAudit = async () => {
    if (!urlsInput.trim() && history.length > 0) {
      setModal({ show: true, title: 'Atualização Global', message: 'Deseja re-auditar todos os produtos agora?', type: 'confirm', onConfirm: async () => {
        setModal({ ...modal, show: false });
        setLoading(true);
        try { await fetch(`${API_URL}/audit/active`, { method: 'POST' }); setIsBackgroundScanning(true); } catch(e){} finally { setLoading(false); }
      }});
      return;
    }
    setLoading(true);
    const urls = urlsInput.split('\n').filter(u => u.trim() !== '');
    try {
      const res = await fetch(`${API_URL}/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls })
      });
      if (res.ok) { setIsBackgroundScanning(true); setUrlsInput(''); }
    } catch (err) {} finally { setLoading(false); }
  };

  const handleManualRefresh = async (url, asin) => {
    setRefreshingAsin(asin);
    try {
      await fetch(`${API_URL}/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: [url] })
      });
      fetchHistory();
    } catch (err) {} finally { setRefreshingAsin(null); }
  };

  const toggleTrash = async (asin, isRestore) => {
    try {
      const endpoint = isRestore ? 'restore' : 'trash';
      await fetch(`${API_URL}/product/${asin}/${endpoint}`, { method: 'PUT' });
      fetchHistory();
    } catch (e) {}
  };

  // --- UI Components ---
  const Badge = ({ children, color = 'blue' }) => (
    <span className={`badge-premium ${color === 'blue' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
      {children}
    </span>
  );

  const Navbar = () => (
    <nav className="fixed top-0 left-0 right-0 z-[100] bg-white/60 backdrop-blur-2xl border-b border-slate-200/50">
      <div className="section-container h-16 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-slate-950 rounded-lg flex items-center justify-center">
              <Zap className="text-white fill-white" size={16} />
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-950">Buscador<span className="text-blue-600">.ai</span></span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-[13px] font-bold text-slate-500">
            <a href="#features" className="hover:text-slate-900 transition-colors">Produtos</a>
            <a href="#metrics" className="hover:text-slate-900 transition-colors">Rede</a>
            <a href="#docs" className="hover:text-slate-900 transition-colors">API</a>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-4 bg-slate-50 pl-4 pr-1 py-1 rounded-full border border-slate-200">
              <span className="text-xs font-bold text-slate-600">Olá, {user.email}</span>
              <button onClick={() => setUser(null)} className="p-2 bg-white rounded-full shadow-sm hover:text-red-500 transition-colors"><PowerOff size={14}/></button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={() => setShowLoginModal(true)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors">Admin</button>
              <button className="px-5 py-2 bg-slate-950 text-white text-xs font-bold rounded-full hover:bg-slate-800 transition-all active:scale-95">Acessar v2.0</button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );

  const Hero = () => (
    <section className="relative pt-32 pb-24 bg-grid overflow-hidden">
      <div className="spot-light top-0 left-1/4 animate-pulse-slow" />
      <div className="spot-light bottom-0 right-1/4 bg-emerald-500/5" />
      
      <div className="section-container relative z-10 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-slate-200 shadow-sm text-[11px] font-bold mb-10"
        >
          <Badge>New</Badge>
          <span className="text-slate-500">Integração com IA avançada disponível</span>
          <ChevronRight size={14} className="text-slate-300" />
        </motion.div>

        <motion.h1 
          variants={containerVariants} initial="hidden" animate="visible"
          className="text-5xl md:text-8xl font-black text-slate-950 mb-8 leading-[1.1] tracking-[-0.04em]"
        >
          Monitoramento <br />
          <span className="hero-gradient-text italic">Autônomo de Preços.</span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="text-lg md:text-xl text-slate-500 mb-12 max-w-2xl mx-auto leading-relaxed font-medium"
        >
          A infraestrutura definitiva para auditoria de mercado. Transforme URLs em fluxos de dados inteligentes com zero latência.
        </motion.p>

        <div className="relative max-w-2xl mx-auto mb-24">
          <div className="relative glass-card p-2 flex items-center shadow-2xl">
             <div className="flex-1 flex items-center px-6">
                <Command size={18} className="text-slate-400 mr-4" />
                <input 
                   type="text" 
                   placeholder="Digite um termo ou cole um link..."
                   className="bg-transparent border-none text-slate-950 w-full focus:ring-0 text-sm font-bold"
                   value={urlsInput}
                   onChange={e => setUrlsInput(e.target.value)}
                />
             </div>
             <button 
                onClick={handleStartAudit}
                className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-black rounded-2xl transition-all shadow-xl shadow-blue-500/20 active:scale-95 flex items-center gap-2"
             >
                {loading ? <RefreshCw className="animate-spin"/> : <Sparkles size={18}/>}
                Iniciar Auditoria
             </button>
          </div>

          {/* Floating Elements */}
          <motion.div 
            animate={{ y: [0, -10, 0] }} transition={{ duration: 4, repeat: Infinity }}
            className="absolute -top-12 -right-16 hidden lg:block"
          >
             <div className="glass-card p-4 flex items-center gap-4 border-blue-100/50 shadow-blue-500/5">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600"><TrendingDown size={20}/></div>
                <div className="text-left">
                   <p className="text-[10px] font-bold text-slate-400 uppercase">Preço Caiu</p>
                   <p className="text-sm font-black text-slate-900">-24% no iPhone 15</p>
                </div>
             </div>
          </motion.div>

          <motion.div 
            animate={{ y: [0, 10, 0] }} transition={{ duration: 5, repeat: Infinity, delay: 1 }}
            className="absolute -bottom-16 -left-20 hidden lg:block"
          >
             <div className="glass-card p-4 flex items-center gap-4 border-emerald-100/50 shadow-emerald-500/5">
                <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600"><Activity size={20}/></div>
                <div className="text-left">
                   <p className="text-[10px] font-bold text-slate-400 uppercase">Rede Ativa</p>
                   <p className="text-sm font-black text-slate-900">99.9% Uptime Global</p>
                </div>
             </div>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 1 }}
          className="relative max-w-[1200px] mx-auto rounded-[2.5rem] p-4 bg-slate-100/50 border border-slate-200"
        >
          <img src={MOCKUP_IMG} className="rounded-[2rem] shadow-2xl" alt="Platform" />
        </motion.div>
      </div>
    </section>
  );

  const MetricsGrid = () => (
    <section id="metrics" className="py-24 border-y border-slate-100 bg-white">
       <div className="section-container grid grid-cols-2 md:grid-cols-4 gap-12">
          {[
            { icon: <Clock/>, label: 'Latência', value: '< 800ms', desc: 'Processamento ultra-rápido' },
            { icon: <Database/>, label: 'Dados/Dia', value: '500k+', desc: 'Escaneamento massivo' },
            { icon: <Shield/>, label: 'Segurança', value: 'AES-256', desc: 'Dados criptografados' },
            { icon: <Cpu/>, label: 'Engine', value: 'V8 Pro', desc: 'Arquitetura modular' }
          ].map((m, i) => (
            <div key={i} className="text-center md:text-left">
               <div className="text-blue-600 mb-4 inline-block">{m.icon}</div>
               <h4 className="text-3xl font-black text-slate-950 mb-1">{m.value}</h4>
               <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{m.label}</p>
               <p className="text-xs text-slate-500 font-medium">{m.desc}</p>
            </div>
          ))}
       </div>
    </section>
  );

  const DashboardContent = ({ currentItems = [], searchFilter, setSearchFilter, categoryFilter, setCategoryFilter, viewMode, setViewMode, handleStartAudit, handleManualRefresh, refreshingAsin, toggleTrash, isBackgroundScanning, auditProgress, loading, history = [], renderVariationBadge }) => (
    <section className="py-24 section-container">
      <div className="grid grid-cols-12 gap-8">
        {/* Modern Toolbar */}
        <div className="col-span-12 glass-card p-4 flex flex-wrap items-center gap-4 sticky top-20 z-40">
           <div className="flex-1 flex items-center gap-3 bg-slate-100/50 rounded-2xl px-5 py-2.5 border border-slate-100">
              <Search size={16} className="text-slate-400" />
              <input 
                 type="text" placeholder="Filtrar base de dados..." 
                 className="bg-transparent border-none text-sm font-bold text-slate-900 focus:ring-0 w-full"
                 value={searchFilter} onChange={e => setSearchFilter(e.target.value)}
              />
           </div>
           <div className="flex items-center gap-2">
              <select className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-600 focus:ring-blue-500" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                <option value="">Status: Todos</option>
                <option value="active">Ativos</option>
              </select>
              <button className="p-2.5 bg-slate-950 text-white rounded-xl hover:bg-slate-800 transition-all"><Filter size={16}/></button>
              <div className="h-8 w-px bg-slate-200 mx-2" />
              <button 
                onClick={() => setViewMode(viewMode === 'main' ? 'trash' : 'main')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${viewMode === 'trash' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-slate-100 text-slate-600'}`}
              >
                 {viewMode === 'trash' ? <ArrowLeft size={14}/> : <Trash2 size={14}/>}
                 {viewMode === 'main' ? 'Lixeira' : 'Voltar'}
              </button>
           </div>
        </div>

        {/* Database Table */}
        <div className="col-span-12 glass-card overflow-hidden border-slate-200/50">
           <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <h3 className="text-lg font-black text-slate-950">Repositório de Inteligência</h3>
                 <Badge color="emerald">Live</Badge>
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{(history?.length || 0)} Resultados encontrados</p>
           </div>
           <div className="overflow-x-auto">
              <table className="w-full text-left">
                 <thead>
                    <tr className="bg-slate-50/50">
                       <th className="p-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ativo/Identificação</th>
                       <th className="p-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Valor Atual</th>
                       <th className="p-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Variação</th>
                       <th className="p-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Performance</th>
                       <th className="p-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Ações</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                    {(currentItems || []).map((item) => {
                      const latest = item.latest || {};
                      const isActive = item.is_active;
                      const chartData = (item.history || []).map(h => ({ date: h.date, price: h.main_price }));

                      return (
                        <tr key={item.asin} className="hover:bg-slate-50/50 transition-all group">
                          <td className="p-6">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-2xl border border-slate-200 bg-white p-1 flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                                 <img src={item.image_url} alt="" className="w-full h-full object-contain" />
                              </div>
                              <div>
                                 <a href={latest.url} target="_blank" className="text-sm font-black text-slate-900 hover:text-blue-600 transition-colors line-clamp-1">{latest.title}</a>
                                 <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">{item.asin}</span>
                                    <Badge>{item.store}</Badge>
                                 </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-6">
                             <div className="flex flex-col">
                                <span className="text-lg font-black text-slate-950">R$ {(latest.main_price || 0).toFixed(2)}</span>
                                {latest.old_price > latest.main_price && <span className="text-[10px] font-bold text-red-500">-{latest.real_discount}% off</span>}
                             </div>
                          </td>
                          <td className="p-6">
                             {renderVariationBadge(latest.variation)}
                          </td>
                          <td className="p-6">
                             <div className="w-32 h-10">
                                <ResponsiveContainer width="100%" height="100%">
                                   <LineChart data={chartData}>
                                      <Line type="monotone" dataKey="price" stroke="#3b82f6" strokeWidth={2} dot={false} />
                                   </LineChart>
                                </ResponsiveContainer>
                             </div>
                          </td>
                          <td className="p-6 text-right">
                             <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleManualRefresh(latest.url, item.asin)} className="p-2.5 rounded-xl bg-white border border-slate-200 hover:border-blue-600 hover:text-blue-600 transition-all">
                                   <RefreshCw size={14} className={refreshingAsin === item.asin ? 'animate-spin' : ''}/>
                                </button>
                                <button onClick={() => toggleTrash(item.asin, viewMode === 'trash')} className="p-2.5 rounded-xl bg-white border border-slate-200 hover:border-red-600 hover:text-red-600 transition-all">
                                   <Trash2 size={14}/>
                                </button>
                             </div>
                          </td>
                        </tr>
                      );
                    })}
                 </tbody>
              </table>
           </div>
        </div>
      </div>
    </section>
  );

  const Footer = () => (
    <footer className="py-20 border-t border-slate-100 bg-white overflow-hidden">
       <div className="section-container">
          <div className="grid grid-cols-12 gap-12 mb-20">
             <div className="col-span-12 md:col-span-4 space-y-6">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 bg-slate-950 rounded-lg flex items-center justify-center"><Zap className="text-white fill-white" size={16} /></div>
                   <span className="text-lg font-bold text-slate-950">Buscador<span className="text-blue-600">.ai</span></span>
                </div>
                <p className="text-sm text-slate-500 font-medium leading-relaxed max-w-xs">Plataforma de inteligência competitiva e auditoria de preços autônoma. Desenvolvida para escala global.</p>
                <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
                   <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"/> Todos os sistemas operacionais</div>
                </div>
             </div>
             <div className="col-span-6 md:col-span-2 space-y-6">
                <h5 className="text-[11px] font-black text-slate-950 uppercase tracking-widest">Plataforma</h5>
                <ul className="space-y-4 text-xs font-bold text-slate-500">
                   <li><a href="#" className="hover:text-blue-600">Monitor</a></li>
                   <li><a href="#" className="hover:text-blue-600">Auditoria</a></li>
                   <li><a href="#" className="hover:text-blue-600">Integrations</a></li>
                </ul>
             </div>
             <div className="col-span-6 md:col-span-2 space-y-6">
                <h5 className="text-[11px] font-black text-slate-950 uppercase tracking-widest">Empresa</h5>
                <ul className="space-y-4 text-xs font-bold text-slate-500">
                   <li><a href="#" className="hover:text-blue-600">Status</a></li>
                   <li><a href="#" className="hover:text-blue-600">Privacidade</a></li>
                   <li><a href="#" className="hover:text-blue-600">Termos</a></li>
                </ul>
             </div>
             <div className="col-span-12 md:col-span-4 bg-slate-50 rounded-[2rem] p-8 border border-slate-100">
                <h5 className="text-sm font-black text-slate-950 mb-4">Newsletter v2.0</h5>
                <p className="text-xs text-slate-500 mb-6 font-medium">Receba atualizações semanais sobre inteligência de mercado.</p>
                <div className="flex gap-2">
                   <input type="text" placeholder="Email" className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold focus:ring-2 focus:ring-blue-600" />
                   <button className="px-4 py-2 bg-slate-950 text-white text-xs font-bold rounded-xl">Assinar</button>
                </div>
             </div>
          </div>
          <div className="pt-10 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
             <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">© 2026 Buscador.ai — Built for scale</p>
             <div className="flex gap-8 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <a href="#" className="hover:text-slate-950 transition-colors">Twitter</a>
                <a href="#" className="hover:text-slate-950 transition-colors">GitHub</a>
                <a href="#" className="hover:text-slate-950 transition-colors">LinkedIn</a>
             </div>
          </div>
       </div>
    </footer>
  );

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main>
        <Hero />
        <MetricsGrid />
        {user ? (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}>
            <DashboardContent 
              currentItems={currentItems}
              searchFilter={searchFilter}
              setSearchFilter={setSearchFilter}
              categoryFilter={categoryFilter}
              setCategoryFilter={setCategoryFilter}
              viewMode={viewMode}
              setViewMode={setViewMode}
              handleStartAudit={handleStartAudit}
              handleManualRefresh={handleManualRefresh}
              refreshingAsin={refreshingAsin}
              toggleTrash={toggleTrash}
              isBackgroundScanning={isBackgroundScanning}
              auditProgress={auditProgress}
              loading={loading}
              history={history}
              renderVariationBadge={renderVariationBadge}
            />
          </motion.div>
        ) : null}
      </main>
      <Footer />

      {/* Admin Modal (Refined) */}
      <AnimatePresence>
        {showLoginModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex items-center justify-center bg-white/60 backdrop-blur-2xl p-6">
             <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="w-full max-w-sm glass-card p-10 border-slate-200 shadow-2xl">
                <div className="text-center mb-8">
                   <div className="w-12 h-12 bg-slate-950 rounded-xl flex items-center justify-center mx-auto mb-6"><Lock className="text-white" size={20}/></div>
                   <h3 className="text-xl font-black text-slate-950">Acesso Restrito</h3>
                   <p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-wider">Identificação Necessária</p>
                </div>
                <div className="space-y-4">
                   <input type="text" value={adminUsername} onChange={e => setAdminUsername(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3.5 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none" placeholder="Username" />
                   <input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3.5 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none" placeholder="Password" />
                   <button onClick={() => { if(adminUsername === 'admin' && adminPassword === 'admin123') { setUser({ email: 'Admin' }); setShowLoginModal(false); } }} className="w-full py-4 bg-slate-950 text-white font-black rounded-xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10">Autenticar</button>
                   <button onClick={() => setShowLoginModal(false)} className="w-full text-xs font-bold text-slate-400 hover:text-slate-900 uppercase tracking-widest mt-2">Cancelar</button>
                </div>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Alerts */}
      <AnimatePresence>
        {modal.show && (
          <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-900/5 backdrop-blur-sm p-6" onClick={() => setModal({...modal, show: false})}>
             <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-sm glass-card p-8 text-center border-slate-100 shadow-2xl" onClick={e => e.stopPropagation()}>
                <h4 className="text-lg font-black text-slate-950 mb-3">{modal.title}</h4>
                <p className="text-sm text-slate-500 mb-8 font-medium">{modal.message}</p>
                <div className="flex gap-2">
                   <button onClick={() => setModal({...modal, show: false})} className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 text-slate-500 font-bold rounded-xl text-xs">Cancelar</button>
                   <button onClick={() => { if(modal.onConfirm) modal.onConfirm(); setModal({...modal, show: false}); }} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-500/20">Confirmar</button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
