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
const Navbar = ({ onAuthOpen, onTopSearched }) => {
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
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  if (!results || results.length === 0) return <div className="py-8 text-center text-xs font-bold uppercase">Nenhum resultado.</div>;
  
  const cheapest = results.reduce((min, p) => (p.main_price < (min?.main_price || Infinity) ? p : min), null);
  
  const totalPages = Math.ceil(results.length / itemsPerPage);
  const paginatedItems = results.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <section className="section-container py-12">
      <h2 className="text-lg font-bold mb-6 uppercase tracking-tighter">Resultados Encontrados ({results.length})</h2>
      
      {cheapest && currentPage === 1 && (
        <div className="border-2 border-black p-6 flex flex-col md:flex-row gap-6 mb-8 bg-gray-50">
          <div className="w-24 h-24 border border-black p-2 flex-shrink-0 bg-white">
            <img src={cheapest.image_url} alt="" className="w-full h-full object-contain" />
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-bold text-blue-600 mb-1 uppercase">★ Melhor Preço Encontrado</div>
            <h3 className="text-sm font-bold uppercase mb-2 line-clamp-1">{cheapest.title}</h3>
            <div className="text-2xl font-bold mb-2 tracking-tighter text-green-600">R$ {(cheapest.main_price || 0).toFixed(2)}</div>
            <div className="text-[10px] font-bold text-gray-500 uppercase">{cheapest.store} | ASIN: {cheapest.asin}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {paginatedItems.map((p, i) => (
          <div key={i} className="border border-black p-4 flex gap-4 hover:bg-gray-50 transition-colors">
             <div className="w-16 h-16 border border-black p-1 flex-shrink-0 bg-white">
                <img src={p.image_url} alt="" className="w-full h-full object-contain" />
             </div>
             <div className="flex-1 min-w-0">
                <div className="text-[9px] font-bold text-gray-400 uppercase">{p.store}</div>
                <h4 className="text-[11px] font-bold uppercase truncate">{p.title}</h4>
                <div className="text-sm font-bold mt-1">R$ {p.main_price?.toFixed(2)}</div>
             </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-12">
        <div className="flex items-center gap-3">
          <div className="flex border border-black p-1 bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-xs font-bold uppercase disabled:opacity-30 hover:bg-gray-100"
            >
              ←
            </button>
            <div className="px-4 py-1 text-xs font-bold border-x border-black bg-black text-white">
              {currentPage} / {totalPages || 1}
            </div>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-3 py-1 text-xs font-bold uppercase disabled:opacity-30 hover:bg-gray-100"
            >
              →
            </button>
          </div>
          <select 
            value={itemsPerPage === 9999 ? 'all' : itemsPerPage} 
            onChange={e => setItemsPerPage(e.target.value === 'all' ? 9999 : Number(e.target.value))}
            className="border border-black p-1.5 text-xs font-bold uppercase bg-white outline-none cursor-pointer"
          >
            <option value="10">10 por página</option>
            <option value="50">50 por página</option>
            <option value="all">Tudo (Ver todos)</option>
          </select>
        </div>
        <div className="text-[10px] font-bold uppercase text-gray-500">
          {itemsPerPage === 9999 
            ? `Mostrando todos os ${results.length} resultados`
            : `Página ${currentPage} de ${totalPages}`
          }
        </div>
      </div>

      <div className="border border-black p-8 text-center bg-black text-white shadow-[8px_8px_0px_0px_rgba(0,0,0,0.2)]">
        <p className="text-sm font-bold uppercase mb-4">Acesse o histórico completo e receba alertas de queda de preço.</p>
        <button onClick={onAuthOpen} className="px-12 py-3 bg-white text-black font-bold text-xs uppercase hover:bg-gray-200 transition-colors">Criar Conta Gratuitamente</button>
      </div>
    </section>
  );
};

// ── Dashboard ─────────────────────────────────────────────────────
const Dashboard = ({ history, loading, onSearch, viewMode, setViewMode, onTopSearched }) => {
  const { token } = useAuth();
  const [searchFilter, setSearchFilter] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'performance', direction: 'desc' });

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

  const requestSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const sortedItems = useMemo(() => {
    const items = (history || []).filter(item => 
      !searchFilter || item.title?.toLowerCase().includes(searchFilter.toLowerCase()) || item.asin?.toLowerCase().includes(searchFilter.toLowerCase())
    );

    return [...items].sort((a, b) => {
      const aLatest = a.latest || {};
      const bLatest = b.latest || {};
      
      let aValue, bValue;

      switch (sortConfig.key) {
        case 'product':
          aValue = (a.title || '').toLowerCase();
          bValue = (b.title || '').toLowerCase();
          break;
        case 'price':
          aValue = aLatest.main_price || 0;
          bValue = bLatest.main_price || 0;
          break;
        case 'performance':
          const aDisc = aLatest.old_price && aLatest.main_price ? ((aLatest.old_price - aLatest.main_price) / aLatest.old_price) : -Infinity;
          const bDisc = bLatest.old_price && bLatest.main_price ? ((bLatest.old_price - bLatest.main_price) / bLatest.old_price) : -Infinity;
          aValue = aDisc;
          bValue = bDisc;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [history, searchFilter, sortConfig]);

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  const totalPages = Math.ceil(sortedItems.length / itemsPerPage);
  const paginatedItems = sortedItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Resetar página ao filtrar ou mudar itens por página
  useEffect(() => { setCurrentPage(1); }, [searchFilter, itemsPerPage]);

  return (
    <section className="py-12 section-container">
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-2 border border-black p-1 flex-1 max-w-sm">
          <input type="text" placeholder="Filtrar..." value={searchFilter} onChange={e => setSearchFilter(e.target.value)} className="w-full px-3 py-1 text-xs outline-none bg-white" />
        </div>
        <div className="flex gap-2">
          <button 
            onClick={onTopSearched}
            className={`text-[10px] font-bold border border-black px-4 py-1 uppercase flex items-center gap-2 ${viewMode === 'top' ? 'bg-black text-white' : 'hover:bg-gray-100'}`}
          >
            <TrendingUp size={14} /> Mais Pesquisados
          </button>
          <button onClick={() => setViewMode(v => v === 'main' ? 'trash' : 'main')} className={`text-[10px] font-bold border border-black px-4 py-1 uppercase ${viewMode === 'trash' ? 'bg-black text-white' : 'hover:bg-gray-100'}`}>
            {viewMode === 'trash' ? 'Voltar' : 'Lixeira'}
          </button>
        </div>
      </div>

      <div className="border border-black overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-black">
              {[
                { label: 'Produto', key: 'product' },
                { label: 'Vendido por', key: null },
                { label: 'Preço De', key: null },
                { label: 'Preço Atual', key: 'price' },
                { label: 'Parcelado', key: null },
                { label: 'Performance', key: 'performance' },
                { label: 'Ações', key: null }
              ].map(h => (
                <th key={h.label} className="p-4 font-bold uppercase">
                  {h.key ? (
                    <button 
                      onClick={() => requestSort(h.key)}
                      className={`flex items-center gap-1 hover:underline ${sortConfig.key === h.key ? 'text-blue-600' : ''}`}
                    >
                      {h.label}
                      {sortConfig.key === h.key && (sortConfig.direction === 'asc' ? ' ▲' : ' ▼')}
                    </button>
                  ) : h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black">
            {paginatedItems.map(item => {
              const latest = item.latest || {};
              return (
                <tr key={item.asin}>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="w-8 h-8 border border-black p-1 flex-shrink-0 hover:bg-gray-100 transition-colors">
                        <img src={item.image_url} alt="" className="w-full h-full object-contain" />
                      </a>
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-bold uppercase line-clamp-1 truncate max-w-[200px] hover:underline">
                        {item.title || 'Carregando...'}
                      </a>
                    </div>
                  </td>
                  <td className="p-4 uppercase font-bold text-gray-400">
                    {latest.main_seller || item.store || 'PENDENTE'}
                  </td>
                  <td className="p-4">
                    {latest.old_price > 0 ? (
                      <div className="flex flex-col">
                        <span 
                          title="PREÇO DE (MSRP): Este é o preço sugerido pelo fabricante ou pela loja."
                          className="text-[10px] font-bold text-gray-400 line-through cursor-help border-b border-dotted border-gray-300"
                        >
                          R$ {latest.old_price.toFixed(2)}
                        </span>
                        <span className="text-[9px] font-bold text-red-500 mt-1">
                          -{(((latest.old_price - latest.main_price) / latest.old_price) * 100).toFixed(0)}% REAL
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold text-gray-300 uppercase italic">Sem base</span>
                    )}
                  </td>
                  <td className="p-4 font-bold">
                    {latest.main_price ? (
                      <>
                        <div>R$ {latest.main_price.toFixed(2)}</div>
                        <div className="text-[9px] font-bold text-gray-400 uppercase mt-1">
                          Captura: {new Date(latest.date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </>
                    ) : (
                      <div className="text-orange-500 animate-pulse">AGUARDANDO CAPTURA</div>
                    )}
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
                            return diffPercent > 0.10 
                              ? <span className="text-[8px] text-red-500 font-bold">+{diffPercent.toFixed(1)}% ACRÉSCIMO</span>
                              : <span className="text-[8px] text-green-500 font-bold">MESMO PREÇO</span>;
                          })()}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-300 font-bold uppercase">{latest.main_price ? 'À VISTA' : '—'}</span>
                    )}
                  </td>
                  <td className="p-4">
                    {latest.main_price ? (
                      <div className="flex flex-col gap-1">
                        <div className="w-24 h-6">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={(item.history || []).map(h => ({ 
                              price: h.main_price, 
                              fullDate: new Date(h.date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) 
                            })).reverse()}>
                              <Tooltip content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  return (
                                    <div className="bg-black text-white p-2 border border-black text-[9px] font-bold uppercase">
                                      <div>R$ {payload[0].value.toFixed(2)}</div>
                                      <div className="text-gray-400">{payload[0].payload.fullDate}</div>
                                    </div>
                                  );
                                }
                                return null;
                              }} />
                              <Line type="monotone" dataKey="price" stroke="#000000" strokeWidth={2} dot={{ r: 2, fill: '#000' }} activeDot={{ r: 4 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex items-center gap-2">
                          {renderVariationBadge(item)}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[9px] font-bold text-gray-300 italic uppercase">Sem histórico</div>
                    )}
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

      {/* Paginação */}
      <div className="mt-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="flex border border-black p-1 bg-white">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-xs font-bold uppercase disabled:opacity-30 hover:bg-gray-100 transition-colors"
            >
              Anterior
            </button>
            <div className="px-4 py-1 text-xs font-bold border-x border-black bg-black text-white">
              {currentPage} / {totalPages || 1}
            </div>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-3 py-1 text-xs font-bold uppercase disabled:opacity-30 hover:bg-gray-100 transition-colors"
            >
              Próximo
            </button>
          </div>
          
          <select 
            value={itemsPerPage === 9999 ? 'all' : itemsPerPage} 
            onChange={e => setItemsPerPage(e.target.value === 'all' ? 9999 : Number(e.target.value))}
            className="border border-black p-1.5 text-xs font-bold uppercase bg-white outline-none cursor-pointer hover:bg-gray-50"
          >
            <option value="10">10 por página</option>
            <option value="50">50 por página</option>
            <option value="100">100 por página</option>
            <option value="all">Tudo (Ver todos)</option>
          </select>
        </div>

        <div className="text-[10px] font-bold uppercase text-gray-500">
          {itemsPerPage === 9999 
            ? `Mostrando todos os ${sortedItems.length} produtos`
            : `Mostrando ${paginatedItems.length} de ${sortedItems.length} produtos`
          }
        </div>
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
  const [topSearched, setTopSearched] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [viewMode, setViewMode] = useState('main'); // main, trash, top

  const fetchHistory = async () => {
    try {
      if (!token) return;
      const isTrash = viewMode === 'trash';
      const res = await fetch(`${API_URL}/history?trash=${isTrash}`, { headers: { Authorization: `Bearer ${token}` } });
      setHistory(await res.json());
    } catch { }
  };

  const fetchTopSearched = async () => {
    if (viewMode === 'top') {
      setViewMode('main');
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/public/top-searched`);
      setTopSearched(await res.json());
      setViewMode('top');
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { 
    if (!isGuest && viewMode !== 'top') fetchHistory(); 
  }, [isGuest, viewMode]);

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
        
        {isGuest && publicResults !== null && viewMode !== 'top' && (
          <PublicResults results={publicResults} onAuthOpen={() => setAuthOpen(true)} />
        )}
        
        {(!isGuest || viewMode === 'top') && (
          <Dashboard 
            history={viewMode === 'top' ? (topSearched || []) : history} 
            loading={loading} 
            onSearch={viewMode === 'top' ? fetchTopSearched : fetchHistory} 
            viewMode={viewMode}
            setViewMode={setViewMode}
            onTopSearched={fetchTopSearched}
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
