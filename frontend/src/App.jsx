import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis, XAxis } from 'recharts';
import { RefreshCw, TrendingUp, TrendingDown, Minus, Trash2, PowerOff, Filter, Search, ArrowLeft, Zap, Shield, Clock, Database, Lock, Cpu, Sparkles, Command, Info, Sun, Moon, ThumbsUp, ThumbsDown, CheckCircle2, Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './AuthContext';
import { AuthModal } from './AuthModal';
import SuperAdminPanel from './SuperAdminPanel';
import './index.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// ── Helpers ───────────────────────────────────────────────────────
const Badge = ({ children }) => (
  <span className="badge-premium">{children}</span>
);

const renderVariationBadge = (item) => {
  if (!item.history || item.history.length < 2) return <span className="text-[10px] font-bold text-black">Sem histórico</span>;
  const current = item.history[0].main_price;
  const previous = item.history[1].main_price;
  if (current === previous) return <span className="text-[10px] font-bold text-black">Estável</span>;
  const diff = ((current - previous) / previous) * 100;
  return (
    <span className="text-[10px] font-bold text-black">
      {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
    </span>
  );
};

// ── Navbar ────────────────────────────────────────────────────────
const Navbar = ({ onAuthOpen }) => {
  const { user, logout, isGuest, isSuperAdmin } = useAuth();
  return (
    <nav className="border-b border-black py-4">
      <div className="section-container flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-black uppercase">Buscador.ai</span>
          {isSuperAdmin && <span className="text-[10px] font-bold border border-black px-1">ADMIN</span>}
        </div>
        <div className="flex items-center gap-4">
          {isGuest ? (
            <button onClick={onAuthOpen} className="text-xs font-bold border border-black px-4 py-1">ENTRAR / CADASTRAR</button>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold">{user.email}</span>
              <button onClick={logout} className="text-xs font-bold border border-black px-2 py-1">SAIR</button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

// ── Hero / Search ─────────────────────────────────────────────────
const Hero = ({ urlsInput, setUrlsInput, onSearch, loading }) => {
  const handleKey = (e) => { if (e.key === 'Enter') onSearch(); };
  return (
    <section className="py-12 border-b border-black">
      <div className="section-container text-center">
        <h1 className="text-4xl font-bold mb-4 uppercase">Monitoramento de Preços</h1>
        <p className="text-sm mb-8">Insira o nome do produto ou o link da loja.</p>
        <div className="max-w-xl mx-auto flex gap-2 border border-black p-1">
          <input type="text" placeholder="Pesquisar..." value={urlsInput} onChange={e => setUrlsInput(e.target.value)} onKeyDown={handleKey}
            className="flex-1 px-4 py-2 text-sm outline-none bg-white" />
          <button onClick={onSearch} disabled={loading} className="px-6 py-2 bg-black text-white font-bold text-sm uppercase">
            {loading ? 'Aguarde...' : 'Buscar'}
          </button>
        </div>
      </div>
    </section>
  );
};

// ── Public Results ────────────────────────────────────────────────
const PublicResults = ({ results, onAuthOpen }) => {
  if (!results || results.length === 0) return <div className="py-8 text-center text-xs font-bold uppercase">Nenhum resultado.</div>;
  const cheapest = results.reduce((min, p) => (p.main_price < (min?.main_price || Infinity) ? p : min), null);
  return (
    <section className="section-container py-12">
      <h2 className="text-lg font-bold mb-6 uppercase">Resultados</h2>
      {cheapest && (
        <div className="border border-black p-6 flex flex-col md:flex-row gap-6 mb-6">
          <div className="w-24 h-24 border border-black p-2 flex-shrink-0">
            <img src={cheapest.image_url} alt="" className="w-full h-full object-contain" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold uppercase mb-2">{cheapest.title}</h3>
            <div className="text-xl font-bold mb-2">R$ {(cheapest.main_price || 0).toFixed(2)}</div>
            <div className="text-[10px] font-bold text-gray-500">{cheapest.store} | {cheapest.asin}</div>
          </div>
        </div>
      )}
      <div className="border border-black p-8 text-center bg-black text-white">
        <p className="text-xs font-bold uppercase mb-4">Crie sua conta para ver mais detalhes e histórico completo.</p>
        <button onClick={onAuthOpen} className="px-8 py-2 bg-white text-black font-bold text-xs uppercase">Cadastrar Grátis</button>
      </div>
    </section>
  );
};

// ── Dashboard ─────────────────────────────────────────────────────
const Dashboard = ({ history, loading, onSearch }) => {
  const { token } = useAuth();
  const [searchFilter, setSearchFilter] = useState('');
  const [viewMode, setViewMode] = useState('main');

  const toggleTrash = async (asin, isRestore) => {
    try {
      await fetch(`${API_URL}/product/${asin}/${isRestore ? 'restore' : 'trash'}`, { 
        method: 'PUT', headers: { Authorization: `Bearer ${token}` }
      });
      onSearch();
    } catch { }
  };

  const handleFeedback = async (asin, status) => {
    try {
      await fetch(`${API_URL}/product/${asin}/feedback`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status })
      });
      alert(status === 'ok' ? 'Aprovado!' : 'Reportado para revisão.');
      onSearch();
    } catch { }
  };

  const filtered = (history || []).filter(item => 
    !searchFilter || item.title?.toLowerCase().includes(searchFilter.toLowerCase()) || item.asin?.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <section className="py-12 section-container">
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-2 border border-black p-1 flex-1 max-w-sm">
          <input type="text" placeholder="Filtrar..." value={searchFilter} onChange={e => setSearchFilter(e.target.value)} className="w-full px-3 py-1 text-xs outline-none bg-white" />
        </div>
        <button onClick={() => setViewMode(v => v === 'main' ? 'trash' : 'main')} className="text-[10px] font-bold border border-black px-4 py-1 uppercase">
          {viewMode === 'trash' ? 'Voltar' : 'Lixeira'}
        </button>
      </div>

      <div className="border border-black overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-black">
              {['Produto', 'Vendido por', 'Valor', 'Variação', 'Gráfico', 'Ações'].map(h => (
                <th key={h} className="p-4 font-bold uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black">
            {filtered.map(item => {
              const latest = item.latest || {};
              return (
                <tr key={item.asin}>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 border border-black p-1 flex-shrink-0">
                        <img src={item.image_url} alt="" className="w-full h-full object-contain" />
                      </div>
                      <span className="font-bold uppercase line-clamp-1 truncate max-w-[200px]">{latest.title}</span>
                    </div>
                  </td>
                  <td className="p-4 uppercase">{latest.main_seller || item.store}</td>
                  <td className="p-4 font-bold">
                    <div>R$ {(latest.main_price || 0).toFixed(2)}</div>
                    <div className="text-[9px] font-bold text-gray-400 uppercase mt-1">
                      Em: {latest.date ? new Date(latest.date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </div>
                  </td>
                  <td className="p-4">
                    {renderVariationBadge(item)}
                    {item.history && item.history.length > 1 && (
                      <div className="text-[9px] font-bold text-gray-400 uppercase mt-1">
                        Ant: {new Date(item.history[1].date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="w-24 h-8">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={(item.history || []).map(h => ({ price: h.main_price }))}>
                          <Line type="monotone" dataKey="price" stroke="#000000" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button onClick={() => handleFeedback(item.asin, 'ok')} className="border border-black px-2 py-0.5 text-[9px] font-bold uppercase">OK</button>
                      <button onClick={() => handleFeedback(item.asin, 'error')} className="border border-black px-2 py-0.5 text-[9px] font-bold uppercase text-red-500">ERRO</button>
                      <button onClick={() => toggleTrash(item.asin, viewMode === 'trash')} className="border border-black px-2 py-0.5 text-[9px] font-bold uppercase">DEL</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

// ── Main App ──────────────────────────────────────────────────────
function InnerApp() {
  const { isGuest, isSuperAdmin, token } = useAuth();
  const [urlsInput, setUrlsInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [publicResults, setPublicResults] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);

  const fetchHistory = async () => {
    try {
      if (!token) return;
      const res = await fetch(`${API_URL}/history?trash=false`, { headers: { Authorization: `Bearer ${token}` } });
      setHistory(await res.json());
    } catch { }
  };

  useEffect(() => { if (!isGuest) fetchHistory(); }, [isGuest]);

  const handleSearch = async () => {
    if (!urlsInput.trim()) return;
    setLoading(true);
    if (isGuest) {
      try {
        const res = await fetch(`${API_URL}/public/search`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ term: urlsInput.trim() })
        });
        const data = await res.json();
        setPublicResults(data.results || []);
      } catch { } finally { setLoading(false); }
    } else {
      const urls = urlsInput.split('\n').filter(u => u.trim());
      try {
        const res = await fetch(`${API_URL}/audit`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ urls })
        });
        if (res.ok) { setUrlsInput(''); setTimeout(fetchHistory, 3000); }
      } catch { } finally { setLoading(false); }
    }
  };

  return (
    <div className="min-h-screen bg-white text-black">
      <Navbar onAuthOpen={() => setAuthOpen(true)} />
      <main>
        {/* Superadmin no topo agora */}
        {isSuperAdmin && <SuperAdminPanel />}

        <Hero urlsInput={urlsInput} setUrlsInput={setUrlsInput} onSearch={handleSearch} loading={loading} />
        
        {isGuest && publicResults !== null && <PublicResults results={publicResults} onAuthOpen={() => setAuthOpen(true)} />}
        {!isGuest && <Dashboard history={history} loading={loading} onSearch={fetchHistory} />}
      </main>
      <footer className="py-8 border-t border-black text-center text-[10px] font-bold uppercase">
        © 2026 Buscador.ai — Brutalist Version
      </footer>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <InnerApp />
    </AuthProvider>
  );
}
