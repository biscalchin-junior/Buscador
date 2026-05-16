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
  const [totalMonitored, setTotalMonitored] = useState(0);
  const handleKey = (e) => { if (e.key === 'Enter') onSearch(); };

  useEffect(() => {
    fetch(`${API_URL}/public/stats`)
      .then(res => res.json())
      .then(data => setTotalMonitored(data.totalProducts || 0))
      .catch(() => {});
  }, []);

  return (
    <section className="py-12 border-b border-black">
      <div className="section-container text-center">
        <div className="flex justify-center mb-4">
          <span className="text-[10px] font-bold border border-black px-3 py-1 uppercase tracking-widest bg-black text-white">
            {totalMonitored.toLocaleString()} Produtos Monitorados Agora
          </span>
        </div>
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
const Dashboard = ({ history, loading, onSearch, viewMode, setViewMode }) => {
  const { token } = useAuth();
  const [searchFilter, setSearchFilter] = useState('');

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

  const handleRescan = async (url) => {
    try {
      await fetch(`${API_URL}/audit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ urls: [url] })
      });
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
              {['Produto', 'Vendido por', 'Preço De', 'Preço Atual', 'Parcelado', 'Performance', 'Ações'].map(h => (
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
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="w-8 h-8 border border-black p-1 flex-shrink-0 hover:bg-gray-100 transition-colors">
                        <img src={item.image_url} alt="" className="w-full h-full object-contain" />
                      </a>
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-bold uppercase line-clamp-1 truncate max-w-[200px] hover:underline">
                        {latest.title}
                      </a>
                    </div>
                  </td>
                  <td className="p-4 uppercase">{latest.main_seller || item.store}</td>
                  <td className="p-4">
                    {latest.old_price > 0 && (
                      <div className="flex flex-col">
                        <span 
                          title="PREÇO DE (MSRP): Este é o preço sugerido pelo fabricante ou pela loja. O sistema monitora se este valor foi alterado para 'inventar' descontos falsos."
                          className="text-[10px] font-bold text-gray-400 line-through cursor-help border-b border-dotted border-gray-300"
                        >
                          R$ {latest.old_price.toFixed(2)}
                        </span>
                        
                        {/* Histórico do Preço De */}
                        {item.history && item.history.length > 1 && item.history[1].old_price !== latest.old_price && (
                          <div className="flex flex-col mt-1 border-l-2 border-gray-200 pl-2">
                             <span className="text-[8px] font-bold text-gray-300 line-through">
                               ERAR$ {item.history[1].old_price?.toFixed(2)} ({new Date(item.history[1].date).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'})})
                             </span>
                             {latest.old_price > item.history[1].old_price ? (
                               <span className="text-[8px] font-bold text-orange-500 uppercase">▲ SUBIU MSRP</span>
                             ) : (
                               <span className="text-[8px] font-bold text-blue-500 uppercase">▼ BAIXOU MSRP</span>
                             )}
                          </div>
                        )}

                        <span 
                          title="DESCONTO REAL: Calculado pelo sistema comparando o preço de tabela ('Preço De') com o valor de captura atual. Diferente do marketing da loja, este valor mostra a economia matemática real." 
                          className="text-[9px] font-bold text-red-500 cursor-help border-b border-dotted border-red-500 mt-1"
                        >
                          -{(((latest.old_price - latest.main_price) / latest.old_price) * 100).toFixed(0)}% REAL
                        </span>
                      </div>
                    )}
                    {(!latest.old_price || latest.old_price <= 0) && <span className="text-[10px] font-bold text-gray-300">S/ BASE</span>}
                  </td>
                  <td className="p-4 font-bold">
                    <div>R$ {(latest.main_price || 0).toFixed(2)}</div>
                    <div className="text-[9px] font-bold text-gray-400 uppercase mt-1">
                      Captura: {latest.date ? new Date(latest.date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </div>
                  </td>
                  <td className="p-4 uppercase">
                    {latest.installments_count ? (
                      <div className="flex flex-col">
                        <span className="font-bold">{latest.installments_count}x R$ {latest.installment_value?.toFixed(2)}</span>
                        <div className="flex flex-col mt-0.5">
                          <span className="text-[8px] text-gray-400 font-bold">TOTAL R$ {latest.installment_total?.toFixed(2)}</span>
                          {(() => {
                            const diff = latest.installment_total - latest.main_price;
                            const diffPercent = (diff / latest.main_price) * 100;
                            
                            if (diffPercent > 0.10) {
                              return (
                                <span className="text-[8px] text-red-500 font-bold">
                                  +{diffPercent.toFixed(1)}% ACRÉSCIMO
                                </span>
                              );
                            }
                            return <span className="text-[8px] text-green-500 font-bold">MESMO PREÇO</span>;
                          })()}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-300 font-bold">À VISTA</span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <div className="w-24 h-6">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={(item.history || []).map(h => ({ 
                            price: h.main_price, 
                            fullDate: new Date(h.date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) 
                          })).reverse()}>
                            <Tooltip 
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  return (
                                    <div className="bg-black text-white p-2 border border-black text-[9px] font-bold uppercase">
                                      <div>R$ {payload[0].value.toFixed(2)}</div>
                                      <div className="text-gray-400">{payload[0].payload.fullDate}</div>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Line type="monotone" dataKey="price" stroke="#000000" strokeWidth={2} dot={{ r: 2, fill: '#000' }} activeDot={{ r: 4 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex items-center gap-2">
                        {renderVariationBadge(item)}
                        {item.history && item.history.length > 1 && (
                          <span className="text-[8px] font-bold text-gray-500 uppercase">
                            EM {new Date(item.history[1].date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} ERA R$ {item.history[1].main_price?.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button onClick={() => handleRescan(item.url)} className="border border-black px-2 py-0.5 text-[9px] font-bold uppercase bg-black text-white">SINC</button>
                      <button onClick={() => handleFeedback(item.asin, 'ok')} className="border border-black px-2 py-0.5 text-[9px] font-bold uppercase">OK</button>
                      <button onClick={() => handleFeedback(item.asin, 'error')} className="border border-black px-2 py-0.5 text-[9px] font-bold uppercase text-red-500">ERRO</button>
                      <button onClick={() => toggleTrash(item.asin, viewMode === 'trash')} className="border border-black px-2 py-0.5 text-[9px] font-bold uppercase">
                        {viewMode === 'trash' ? 'Restaurar' : 'DEL'}
                      </button>
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
  const [viewMode, setViewMode] = useState('main');

  const fetchHistory = async () => {
    try {
      if (!token) return;
      const isTrash = viewMode === 'trash';
      const res = await fetch(`${API_URL}/history?trash=${isTrash}`, { headers: { Authorization: `Bearer ${token}` } });
      setHistory(await res.json());
    } catch { }
  };

  useEffect(() => { if (!isGuest) fetchHistory(); }, [isGuest, viewMode]);

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
        {!isGuest && (
        <Dashboard 
          history={history} 
          loading={loading} 
          onSearch={fetchHistory} 
          viewMode={viewMode}
          setViewMode={setViewMode}
        />
      )}
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
