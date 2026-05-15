import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Upload, Play, RefreshCw, TrendingUp, TrendingDown, Minus, Trash2,
  Power, PowerOff, Filter, Search, Settings, ArrowLeft, RotateCcw,
  Camera, Users, Video, ShoppingCart, Mail, User, CheckCircle,
  Zap, Shield, BarChart3, ChevronRight, Globe, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import cronParser from 'cron-parser';
import './index.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const MOCKUP_IMG = '/dashboard_mockup.png';

function App() {
  // --- States ---
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
  const [sellerFilter, setSellerFilter] = useState('');
  const [user, setUser] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [modal, setModal] = useState({ show: false, title: '', message: '', onConfirm: null, type: 'confirm' });

  // --- Effects & Logic ---
  const showModal = (title, message, onConfirm = null) => {
    setModal({ show: true, title, message, onConfirm, type: onConfirm ? 'confirm' : 'alert' });
  };
  const closeModal = () => setModal({ ...modal, show: false });

  const fetchHistory = async () => {
    try {
      const isTrash = viewMode === 'trash';
      const res = await fetch(`${API_URL}/history?trash=${isTrash}`);
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error('Erro ao buscar histórico:', err);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchHistory();
    const checkActiveAudit = async () => {
      try {
        const res = await fetch(`${API_URL}/audit/progress`);
        const data = await res.json();
        if (data.active) {
          setIsBackgroundScanning(true);
          setAuditProgress(data);
        }
      } catch (e) { }
    };
    checkActiveAudit();

    let eventSource = null;
    if (isLogsEnabled) {
      eventSource = new EventSource(`${API_URL}/logs/stream`);
      eventSource.onmessage = (e) => {
        const log = JSON.parse(e.data);
        setLogs(prev => [log, ...prev].slice(0, 200));
      };
    }
    return () => { if (eventSource) eventSource.close(); };
  }, [isLogsEnabled]);

  useEffect(() => {
    fetchHistory();
    setCurrentPage(1);
  }, [viewMode]);

  useEffect(() => {
    let interval;
    let listInterval;
    if (isBackgroundScanning) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`${API_URL}/audit/progress`);
          const data = await res.json();
          setAuditProgress(data);
          if (!data.active) {
            setIsBackgroundScanning(false);
            fetchHistory();
          }
        } catch (e) { }
      }, 2000);
      listInterval = setInterval(fetchHistory, 3000);
    } else {
      setAuditProgress({ current: 0, total: 0, active: false, status: '' });
    }
    return () => {
      clearInterval(interval);
      clearInterval(listInterval);
    };
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
    } catch (err) { }
  };

  useEffect(() => {
    let interval;
    if (cronSchedule) {
      interval = setInterval(() => {
        try {
          const parsed = cronParser.parseExpression(cronSchedule);
          const nextDate = parsed.next().toDate();
          const now = new Date();
          const diffMs = nextDate - now;
          if (diffMs <= 0) {
            setTimeRemaining('Executando...');
            return;
          }
          const hours = Math.floor(diffMs / 3600000);
          const mins = Math.floor((diffMs % 3600000) / 60000);
          const secs = Math.floor((diffMs % 60000) / 1000);
          setTimeRemaining(`${hours > 0 ? hours + 'h ' : ''}${mins}m ${secs}s`);
        } catch (e) {
          setTimeRemaining('');
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [cronSchedule]);

  const handleStartAudit = async () => {
    if (!urlsInput.trim()) {
      showModal('Atualizar Lista', 'Deseja atualizar todos os preços da lista atual agora?', async () => {
        closeModal();
        setLoading(true);
        try {
          const res = await fetch(`${API_URL}/audit/active`, { method: 'POST' });
          const data = await res.json();
          if (data.success) {
            setIsBackgroundScanning(true);
            setAuditMessage('Atualizando lista...');
          }
        } catch (err) { } finally { setLoading(false); }
      }
      );
      return;
    }
    setLoading(true);
    setAuditMessage('Iniciando auditoria...');
    const urls = urlsInput.split('\n').filter(u => u.trim() !== '');
    try {
      const res = await fetch(`${API_URL}/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls })
      });
      const data = await res.json();
      if (data.success) {
        setIsBackgroundScanning(true);
        setUrlsInput('');
      }
    } catch (err) { } finally { setLoading(false); }
  };

  const handleStopAudit = async () => {
    try {
      await fetch(`${API_URL}/audit/stop`, { method: 'POST' });
      setIsBackgroundScanning(false);
    } catch (err) { }
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
    } catch (err) { } finally { setRefreshingAsin(null); }
  };

  const toggleActive = async (asin, currentStatus) => {
    try {
      await fetch(`${API_URL}/product/${asin}/toggle-active`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus })
      });
      fetchHistory();
    } catch (e) { }
  };

  const toggleTrash = async (asin, isRestore) => {
    try {
      const endpoint = isRestore ? 'restore' : 'trash';
      await fetch(`${API_URL}/product/${asin}/${endpoint}`, { method: 'PUT' });
      fetchHistory();
    } catch (e) { }
  };

  const saveSettings = async () => {
    try {
      await fetch(`${API_URL}/settings/cron`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule: cronSchedule })
      });
      showModal('Sucesso', 'Agendamento salvo com sucesso!');
      setShowSettings(false);
    } catch (e) { }
  };

  const categories = [...new Set(history.map(item => item.category))].filter(Boolean);
  const filteredHistory = history.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchFilter.toLowerCase()) || item.asin.toLowerCase().includes(searchFilter.toLowerCase());
    const matchesCategory = categoryFilter ? item.category === categoryFilter : true;
    const matchesSeller = sellerFilter ? item.latest?.main_seller === sellerFilter : true;
    return matchesSearch && matchesCategory && matchesSeller;
  });

  if (sortOrder) {
    filteredHistory.sort((a, b) => {
      const priceA = a.latest?.main_price || 0;
      const priceB = b.latest?.main_price || 0;
      return sortOrder === 'asc' ? priceA - priceB : priceB - priceA;
    });
  }

  const totalItems = filteredHistory.length;
  const totalPages = itemsPerPage === 'all' ? 1 : Math.ceil(totalItems / (itemsPerPage || 20));
  const indexOfLastItem = itemsPerPage === 'all' ? totalItems : currentPage * itemsPerPage;
  const indexOfFirstItem = itemsPerPage === 'all' ? 0 : indexOfLastItem - itemsPerPage;
  const currentItems = filteredHistory.slice(indexOfFirstItem, indexOfLastItem);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-2xl">
          <p className="text-xs text-slate-500 mb-1">{new Date(label).toLocaleDateString('pt-BR')}</p>
          <p className="text-sm font-bold text-blue-600">R$ {payload[0].value.toFixed(2)}</p>
        </div>
      );
    }
    return null;
  };

  const renderVariationBadge = (variation) => {
    if (variation === 'UP') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-600 border border-red-100"><TrendingUp size={12} /> Subiu</span>;
    if (variation === 'DOWN') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100"><TrendingDown size={12} /> Caiu</span>;
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-50 text-slate-500 border border-slate-100"><Minus size={12} /> Estável</span>;
  };

  // --- Components ---
  const Navbar = () => (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Zap className="text-white fill-white" size={20} />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">Buscador<span className="text-blue-600">.ai</span></span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
          <a href="#features" className="hover:text-blue-600 transition-colors">Recursos</a>
          <a href="#how-it-works" className="hover:text-blue-600 transition-colors">Como Funciona</a>
          <a href="#pricing" className="hover:text-blue-600 transition-colors">Preços</a>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold text-slate-900">Olá, {user.email}</span>
              <button onClick={() => setUser(null)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors">Sair</button>
            </div>
          ) : (
            <>
              <button onClick={() => setShowLoginModal(true)} className="hidden sm:block px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors">Admin</button>
              <button onClick={() => alert('Configuração do Google Cloud Pendente')} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20 active:scale-95">Login</button>
            </>
          )}
        </div>
      </div>
    </nav>
  );

  const Hero = () => (
    <section className="relative pt-40 pb-20 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-xs font-bold mb-8"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
          </span>
          Monitoramento Inteligente 24/7
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-5xl md:text-7xl font-extrabold text-slate-950 mb-6 leading-tight tracking-tight"
        >
          Domine os preços com <br />
          <span className="hero-gradient-text">Inteligência Real</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-lg md:text-xl text-slate-600 mb-12 max-w-2xl mx-auto leading-relaxed font-medium"
        >
          Nossa IA monitora variações de preço, vendedores e estoques em tempo real para que você nunca mais perca uma oportunidade de mercado.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20"
        >
          <div className="relative group w-full max-w-lg">
            <div className="absolute -inset-1 bg-blue-100 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition duration-1000"></div>
            <div className="relative flex items-center bg-white border border-slate-200 rounded-2xl p-2 pl-6 shadow-sm">
              <Search className="text-slate-400 mr-3" size={20} />
              <input
                type="text"
                placeholder="Cole URLs ou termos de busca..."
                className="bg-transparent border-none text-slate-900 w-full focus:ring-0 text-sm font-medium"
                value={urlsInput}
                onChange={e => setUrlsInput(e.target.value)}
              />
              <button
                onClick={handleStartAudit}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all active:scale-95 ml-2"
              >
                Começar
              </button>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="relative max-w-5xl mx-auto"
        >
          <img
            src={MOCKUP_IMG}
            alt="Dashboard Mockup"
            className="relative z-10 rounded-3xl border border-slate-200 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.1)]"
          />
        </motion.div>
      </div>
    </section>
  );

  const Features = () => (
    <section id="features" className="py-32 max-w-7xl mx-auto px-6">
      <div className="text-center mb-20">
        <h2 className="text-blue-600 text-sm font-bold uppercase tracking-widest mb-4">Poderoso & Escalável</h2>
        <h3 className="text-4xl md:text-5xl font-bold text-slate-950 mb-6 tracking-tight">Recursos que te colocam na frente</h3>
        <p className="text-slate-600 max-w-2xl mx-auto font-medium">Tudo o que você precisa para gerenciar uma operação de monitoramento de escala global em uma única plataforma.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { icon: <Zap className="text-blue-600" />, title: 'Monitoramento Real-Time', desc: 'Alertas e atualizações de preços no exato momento em que ocorrem.' },
          { icon: <BarChart3 className="text-blue-600" />, title: 'Análise Histórica', desc: 'Visualize gráficos detalhados de variação e tendências de mercado.' },
          { icon: <Shield className="text-blue-600" />, title: 'Segurança & Auditoria', desc: 'Logs completos de cada execução e rastreabilidade total de dados.' }
        ].map((feat, i) => (
          <motion.div
            key={i}
            whileHover={{ y: -10 }}
            className="glass-panel p-10 border border-slate-100 hover:border-blue-200"
          >
            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mb-8">
              {feat.icon}
            </div>
            <h4 className="text-xl font-bold text-slate-950 mb-4">{feat.title}</h4>
            <p className="text-slate-600 leading-relaxed text-sm font-medium">{feat.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );

  const Dashboard = () => (
    <section className="py-20 max-w-7xl mx-auto px-6">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Controls */}
        <div className="w-full md:w-80 flex flex-col gap-6">
          <div className="glass-panel p-6">
            <h4 className="text-slate-950 font-bold mb-4 flex items-center gap-2"><Settings size={18} /> Painel de Controle</h4>
            <div className="space-y-4">
              <button
                onClick={() => setViewMode('main')}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all font-bold text-sm ${viewMode === 'main' ? 'bg-blue-600 text-white' : 'hover:bg-slate-50 text-slate-500'}`}
              >
                <div className="flex items-center gap-3"><BarChart3 size={18} /> Monitor</div>
                <ChevronRight size={14} />
              </button>
              <button
                onClick={() => setViewMode('trash')}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all font-bold text-sm ${viewMode === 'trash' ? 'bg-red-600 text-white' : 'hover:bg-slate-50 text-slate-500'}`}
              >
                <div className="flex items-center gap-3"><Trash2 size={18} /> Lixeira</div>
                <ChevronRight size={14} />
              </button>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all font-bold text-sm ${showSettings ? 'bg-blue-100 text-blue-600 border border-blue-200' : 'hover:bg-slate-50 text-slate-500'}`}
              >
                <div className="flex items-center gap-3"><Settings size={18} /> Agendamento</div>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          <div className="glass-panel p-6">
            <h4 className="text-slate-950 font-bold mb-4 flex items-center gap-2"><Info size={18} /> Status Global</h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm font-semibold">
                <span className="text-slate-500">Próxima Busca</span>
                <span className="text-blue-600">{timeRemaining || 'Off'}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-semibold">
                <span className="text-slate-500">Produtos Ativos</span>
                <span className="text-slate-900">{history.filter(h => h.is_active).length}</span>
              </div>
              {isBackgroundScanning && (
                <div className="pt-4 border-t border-slate-100">
                  <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">
                    <span>Progresso</span>
                    <span>{auditProgress.current}/{auditProgress.total}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <motion.div
                      className="bg-blue-600 h-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${(auditProgress.current / (auditProgress.total || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 space-y-6">
          {/* Action Bar */}
          <div className="glass-panel p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-2 border border-slate-100 flex-1 min-w-[200px]">
              <Search size={16} className="text-slate-400" />
              <input
                type="text"
                placeholder="Filtrar por nome ou ID..."
                className="bg-transparent border-none text-sm text-slate-900 font-medium focus:ring-0 w-full"
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3">
              <select
                className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-900 focus:ring-blue-500"
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
              >
                <option value="">Categorias</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              <button
                onClick={handleStartAudit}
                disabled={loading || isBackgroundScanning}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all flex items-center gap-2"
              >
                {loading || isBackgroundScanning ? <RefreshCw className="animate-spin" size={16} /> : <Play size={16} />}
                {isBackgroundScanning ? 'Processando' : 'Executar'}
              </button>
            </div>
          </div>

          {/* Settings Sub-Panel */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="glass-panel p-8 border-blue-100">
                  <h4 className="text-xl font-bold text-slate-950 mb-6">Agendamento Inteligente</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Frequência</label>
                      <div className="grid grid-cols-2 gap-3">
                        {['0 * * * *', '*/30 * * * *', '0 0 * * *', '0 0 * * 0'].map((val, i) => (
                          <button key={i} onClick={() => setCronSchedule(val)} className={`p-3 rounded-xl border text-xs font-bold transition-all ${cronSchedule === val ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-100 text-slate-500 hover:border-blue-200'}`}>
                            {i === 0 ? 'Horária' : i === 1 ? '30 Minutos' : i === 2 ? 'Diária' : 'Semanal'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Configuração Cron</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={cronSchedule}
                          onChange={e => setCronSchedule(e.target.value)}
                          className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 w-full"
                        />
                        <button onClick={saveSettings} className="px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl whitespace-nowrap">Salvar</button>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button onClick={() => toggleHeadless(!isHeadless)} className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${isHeadless ? 'bg-slate-100 text-slate-500' : 'bg-blue-600 text-white'}`}>
                          Navegador: {isHeadless ? 'Off' : 'On'}
                        </button>
                        <button onClick={() => toggleRelevancy(!isRelevancyEnabled)} className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${isRelevancyEnabled ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                          Filtro: {isRelevancyEnabled ? 'Rigoroso' : 'Geral'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Table Area */}
          <div className="glass-panel overflow-hidden border-slate-100">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="p-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Produto</th>
                    <th className="p-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Preços</th>
                    <th className="p-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="p-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentItems.map((item) => {
                    const latest = item.latest;
                    const isActive = item.is_active;

                    return (
                      <tr key={item.asin} className="hover:bg-slate-50/30 transition-colors">
                        <td className="p-6">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-xl border border-slate-100 bg-white p-1 flex-shrink-0 shadow-sm">
                              <img src={item.image_url} alt="" className="w-full h-full object-contain" />
                            </div>
                            <div className="max-w-[200px] lg:max-w-[350px]">
                              <a href={latest.url} target="_blank" className="text-sm font-bold text-slate-900 hover:text-blue-600 transition-colors line-clamp-1">{latest.title}</a>
                              <div className="text-[10px] text-slate-400 flex gap-2 mt-1 font-bold uppercase tracking-tighter">
                                <span>ASIN: {item.asin}</span>
                                <span className="text-blue-500">| {item.store}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-6">
                          <div className="flex flex-col">
                            <span className="text-lg font-black text-slate-950 tracking-tight">R$ {latest.main_price.toFixed(2)}</span>
                            {latest.old_price > latest.main_price && (
                              <span className="text-[10px] font-bold text-slate-400 line-through">R$ {latest.old_price.toFixed(2)}</span>
                            )}
                          </div>
                        </td>
                        <td className="p-6">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-blue-600 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-slate-200'}`} />
                            <span className="text-xs font-bold text-slate-600">{isActive ? 'Monitorando' : 'Pausado'}</span>
                          </div>
                        </td>
                        <td className="p-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => handleManualRefresh(latest.url, item.asin)} className="p-2.5 rounded-xl bg-slate-50 hover:bg-blue-600 text-slate-400 hover:text-white transition-all shadow-sm">
                              <RefreshCw size={14} className={refreshingAsin === item.asin ? 'animate-spin' : ''} />
                            </button>
                            <button onClick={() => toggleTrash(item.asin, viewMode === 'trash')} className={`p-2.5 rounded-xl ${viewMode === 'trash' ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white' : 'bg-red-50 text-red-500 hover:bg-red-600 hover:text-white'} transition-all shadow-sm`}>
                              {viewMode === 'trash' ? <RotateCcw size={14} /> : <Trash2 size={14} />}
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
      </div>
    </section>
  );

  const Institutional = () => (
    <section className="py-32 bg-slate-50/50 border-y border-slate-100">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-16">
        <div className="space-y-6">
          <div className="w-12 h-12 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
            <Globe size={24} />
          </div>
          <h4 className="text-2xl font-bold text-slate-950 tracking-tight">Nossa Missão</h4>
          <p className="text-slate-600 leading-relaxed text-sm font-medium">Democratizar o acesso a dados de mercado em tempo real, fornecendo ferramentas de auditoria que garantem transparência e economia.</p>
        </div>
        <div className="space-y-6">
          <div className="w-12 h-12 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
            <Users size={24} />
          </div>
          <h4 className="text-2xl font-bold text-slate-950 tracking-tight">Nossa Visão</h4>
          <p className="text-slate-600 leading-relaxed text-sm font-medium">Ser a infraestrutura padrão global para monitoramento inteligente, conectando buyers e sellers através de dados íntegros.</p>
        </div>
        <div className="space-y-6">
          <div className="w-12 h-12 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
            <Shield size={24} />
          </div>
          <h4 className="text-2xl font-bold text-slate-950 tracking-tight">Nossos Valores</h4>
          <p className="text-slate-600 leading-relaxed text-sm font-medium">Inovação técnica incansável, ética radical no tratamento de dados e compromisso absoluto com a experiência do usuário.</p>
        </div>
      </div>
    </section>
  );

  const Footer = () => (
    <footer className="py-20 max-w-7xl mx-auto px-6">
      <div className="flex flex-col md:flex-row justify-between items-start gap-12 mb-20">
        <div className="max-w-sm space-y-6">
          <div className="flex items-center gap-3">
            <Zap className="text-blue-600 fill-blue-600" size={24} />
            <span className="text-2xl font-bold text-slate-950">Buscador<span className="text-blue-600">.ai</span></span>
          </div>
          <p className="text-slate-500 text-sm leading-relaxed font-medium">A plataforma mais avançada para auditoria de preços do Brasil. Tecnologia de ponta a serviço da sua inteligência.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-12 sm:gap-24">
          <div className="space-y-6 text-sm">
            <h5 className="text-slate-950 font-bold uppercase tracking-widest">Produto</h5>
            <ul className="space-y-4 text-slate-500 font-bold">
              <li><a href="#" className="hover:text-blue-600 transition-colors">Como Funciona</a></li>
              <li><a href="#" className="hover:text-blue-600 transition-colors">API</a></li>
            </ul>
          </div>
          <div className="space-y-6 text-sm">
            <h5 className="text-slate-950 font-bold uppercase tracking-widest">Suporte</h5>
            <ul className="space-y-4 text-slate-500 font-bold">
              <li><a href="#" className="hover:text-blue-600 transition-colors">Ajuda</a></li>
              <li><a href="#" className="hover:text-blue-600 transition-colors">Contato</a></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="pt-10 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-6">
        <p className="text-slate-400 text-xs font-bold">© 2026 Buscador.ai — Todos os direitos reservados.</p>
        <div className="flex items-center gap-6 text-slate-400 text-xs font-bold">
          <div className="flex items-center gap-2 hover:text-slate-900 transition-colors"><Mail size={14} /> aaaa@aaaa.com.br</div>
          <div className="flex items-center gap-2"><Globe size={14} /> Brasil (PT-BR)</div>
        </div>
      </div>
    </footer>
  );

  return (
    <div className="min-h-screen bg-white relative selection:bg-blue-600 selection:text-white">
      <Navbar />
      <Hero />
      <Features />
      <AnimatePresence>
        {user ? (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}>
            <Dashboard />
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} className="py-32 max-w-7xl mx-auto px-6 text-center">
            <div className="glass-panel p-16 border-slate-100 shadow-2xl shadow-slate-200">
              <h3 className="text-4xl md:text-5xl font-bold text-slate-950 mb-8 tracking-tight">Pronto para começar?</h3>
              <p className="text-slate-600 mb-12 text-lg max-w-xl mx-auto font-medium">Junte-se a milhares de usuários que economizam tempo e dinheiro com nossa automação inteligente.</p>
              <button onClick={() => setShowLoginModal(true)} className="btn-premium-primary text-xl mx-auto">Acessar Agora <ChevronRight /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <Institutional />
      <Footer />

      {/* Login Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 backdrop-blur-md p-6">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-md glass-panel p-10 border-slate-200">
              <div className="text-center mb-10">
                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mx-auto mb-6">
                  <Shield size={32} />
                </div>
                <h3 className="text-2xl font-bold text-slate-950">Acesso Restrito</h3>
                <p className="text-slate-500 text-sm mt-2 font-semibold">Área administrativa protegida</p>
              </div>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Usuário</label>
                  <input type="text" value={adminUsername} onChange={e => setAdminUsername(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-5 py-4 text-slate-900 focus:ring-2 focus:ring-blue-600 transition-all font-bold" placeholder="admin" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Senha</label>
                  <input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-5 py-4 text-slate-900 focus:ring-2 focus:ring-blue-600 transition-all font-bold" placeholder="••••••••" />
                </div>
                <button onClick={() => { if (adminUsername === 'admin' && adminPassword === 'admin123') { setUser({ email: 'Admin', role: 'admin' }); setShowLoginModal(false); } else { alert('Credenciais incorretas!'); } }} className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-95">Autenticar</button>
                <button onClick={() => setShowLoginModal(false)} className="w-full py-2 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-900 transition-colors">Voltar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Alerts */}
      <AnimatePresence>
        {modal.show && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/10 backdrop-blur-sm p-6" onClick={closeModal}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-sm glass-panel p-8 text-center border-slate-100" onClick={e => e.stopPropagation()}>
              <h4 className="text-xl font-bold text-slate-950 mb-4">{modal.title}</h4>
              <p className="text-slate-600 text-sm mb-8 leading-relaxed font-medium">{modal.message}</p>
              <div className="flex gap-3">
                {modal.type === 'confirm' && <button onClick={closeModal} className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 text-slate-500 font-bold rounded-xl transition-all">Cancelar</button>}
                <button onClick={() => { modal.onConfirm ? modal.onConfirm() : closeModal() }} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all">Confirmar</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
