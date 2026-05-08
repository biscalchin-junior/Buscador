import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Upload, Play, RefreshCw, TrendingUp, TrendingDown, Minus, Trash2, Power, PowerOff, Filter, Search, Settings, ArrowLeft, RotateCcw } from 'lucide-react';
import cronParser from 'cron-parser';
import './index.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

function App() {
  const [urlsInput, setUrlsInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshingAsin, setRefreshingAsin] = useState(null);
  const [history, setHistory] = useState([]);
  const [auditMessage, setAuditMessage] = useState('');
  
  // States for new features
  const [viewMode, setViewMode] = useState('main'); // 'main' or 'trash'
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

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Sorting and Seller states
  const [sortOrder, setSortOrder] = useState(null); // null, 'asc', 'desc'
  const [sellerFilter, setSellerFilter] = useState('');

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

    // SSE for Live Logs
    const eventSource = new EventSource(`${API_URL}/logs/stream`);
    eventSource.onmessage = (e) => {
      const log = JSON.parse(e.data);
      setLogs(prev => [log, ...prev].slice(0, 50));
    };
    return () => eventSource.close();
  }, []);

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

  // Timer regressivo para o Cron
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
        } catch(e) {
          setTimeRemaining('');
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [cronSchedule]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      const currentUrls = urlsInput ? urlsInput + '\n' : '';
      setUrlsInput(currentUrls + content);
    };
    reader.readAsText(file);
  };

  const handleStartAudit = async () => {
    const urls = urlsInput.split('\n').map(u => u.trim()).filter(u => u.length > 0);
    if (urls.length === 0) {
        alert('Por favor, insira pelo menos uma URL ou termo de busca.');
        return;
    }

    setLoading(true);
    setAuditMessage('Pesquisando... (Isso pode demorar alguns minutos para varrer todas as páginas)');
    
    try {
      const res = await fetch(`${API_URL}/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls })
      });
      const data = await res.json();
      setAuditMessage(data.message);
      setUrlsInput('');
      setIsBackgroundScanning(true);
      
      // Começa a atualizar a lista periodicamente enquanto pesquisa
      const poll = setInterval(fetchHistory, 10000);
      setTimeout(() => {
        clearInterval(poll);
        setIsBackgroundScanning(false);
        setAuditMessage('Sincronização concluída.');
      }, 300000); // Para de poll depois de 5 min
      
      fetchHistory(); 
    } catch (err) {
      setAuditMessage('Erro ao conectar com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if ((e.key === 'Enter' && e.ctrlKey) || e.key === 'Enter') {
      // Se for apenas Enter, garantimos que não é uma quebra de linha indesejada se o usuário quiser pesquisar
      // Mas como é um textarea, Enter normalmente quebra linha. 
      // Vou priorizar Ctrl + Enter para pesquisar e Enter normal se o campo estiver com foco mas o usuário quiser apenas pesquisar um termo simples
      if (e.ctrlKey || (e.key === 'Enter' && !urlsInput.includes('\n'))) {
        e.preventDefault();
        handleStartAudit();
      }
    }
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
    } catch (err) {
      alert('Erro ao atualizar produto.');
    } finally {
      setRefreshingAsin(null);
    }
  };

  const toggleActive = async (asin, currentStatus) => {
    try {
      await fetch(`${API_URL}/product/${asin}/toggle-active`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus })
      });
      fetchHistory();
    } catch (e) {}
  };

  const toggleTrash = async (asin, isRestore) => {
    try {
      const endpoint = isRestore ? 'restore' : 'trash';
      await fetch(`${API_URL}/product/${asin}/${endpoint}`, { method: 'PUT' });
      fetchHistory();
    } catch (e) {}
  };

  const handleTrashAll = async () => {
    if (!confirm('Deseja mover todos os itens para a lixeira?')) return;
    try {
      await fetch(`${API_URL}/history/trash-all`, { method: 'POST' });
      fetchHistory();
    } catch (e) {}
  };

  const handleEmptyTrash = async () => {
    if (!confirm('Deseja excluir permanentemente todos os itens da lixeira? Esta ação não pode ser desfeita.')) return;
    try {
      await fetch(`${API_URL}/history/empty-trash`, { method: 'DELETE' });
      fetchHistory();
    } catch (e) {}
  };

  const toggleHeadless = async (enabled) => {
    try {
      await fetch(`${API_URL}/settings/headless`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      setIsHeadless(enabled);
    } catch (e) {}
  };

  const toggleRelevancy = async (enabled) => {
    try {
      await fetch(`${API_URL}/settings/relevancy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      setIsRelevancyEnabled(enabled);
    } catch (e) {}
  };

  const saveSettings = async () => {
    try {
      await fetch(`${API_URL}/settings/cron`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule: cronSchedule })
      });
      alert('Agendamento salvo com sucesso!');
      setShowSettings(false);
    } catch (e) {}
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const date = new Date(label).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
      return (
        <div className="custom-tooltip">
          <p className="label">{date}</p>
          <p style={{ color: payload[0].color, fontWeight: 'bold' }}>
            R$ {payload[0].value.toFixed(2)}
          </p>
        </div>
      );
    }
    return null;
  };

  const renderVariationBadge = (variation) => {
    if (variation === 'UP') return <span className="badge badge-up"><TrendingUp size={14} style={{ marginRight: 4 }}/> Subiu</span>;
    if (variation === 'DOWN') return <span className="badge badge-down"><TrendingDown size={14} style={{ marginRight: 4 }}/> Caiu</span>;
    return <span className="badge badge-same"><Minus size={14} style={{ marginRight: 4 }}/> Manteve</span>;
  };

  const categories = [...new Set(history.map(item => item.category))].filter(Boolean);
  const sellers = [...new Set(history.map(item => item.latest?.main_seller))].filter(Boolean);

  const filteredHistory = history.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchFilter.toLowerCase()) || item.asin.toLowerCase().includes(searchFilter.toLowerCase());
    const matchesCategory = categoryFilter ? item.category === categoryFilter : true;
    const matchesSeller = sellerFilter ? item.latest?.main_seller === sellerFilter : true;
    return matchesSearch && matchesCategory && matchesSeller;
  });

  // Apply Sorting
  if (sortOrder) {
    filteredHistory.sort((a, b) => {
      const priceA = a.latest?.main_price || 0;
      const priceB = b.latest?.main_price || 0;
      return sortOrder === 'asc' ? priceA - priceB : priceB - priceA;
    });
  }

  // Pagination Logic
  const totalItems = filteredHistory.length;
  const totalPages = itemsPerPage === 'all' ? 1 : Math.ceil(totalItems / (itemsPerPage || 20));
  const indexOfLastItem = itemsPerPage === 'all' ? totalItems : currentPage * itemsPerPage;
  const indexOfFirstItem = itemsPerPage === 'all' ? 0 : indexOfLastItem - itemsPerPage;
  const currentItems = filteredHistory.slice(indexOfFirstItem, indexOfLastItem);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <div className="container">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Buscador de Preços (Multilojas)</h1>
          <p>Monitoramento contínuo: Amazon, Mercado Livre, Magazine Luiza e Casas Bahia</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-secondary" onClick={() => setShowSettings(!showSettings)}>
            <Settings size={18} /> Agendador
          </button>
          <button className="btn btn-secondary" onClick={() => setViewMode(viewMode === 'main' ? 'trash' : 'main')} style={{ color: viewMode === 'trash' ? 'var(--primary-color)' : '' }}>
            {viewMode === 'main' ? <><Trash2 size={18} /> Lixeira</> : <><ArrowLeft size={18} /> Voltar</>}
          </button>
        </div>
      </header>

      {showSettings && (
        <div className="dashboard-panel" style={{ border: '2px solid var(--primary-color)', animation: 'slideIn 0.3s ease-out' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ color: 'var(--primary-color)', fontSize: '1.5rem' }}>🤖 Agendador Inteligente</h3>
            <button className="btn btn-secondary" onClick={() => setShowSettings(false)}>Fechar</button>
          </div>
          
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <p style={{ marginBottom: '1rem', fontWeight: '500' }}>Escolha a frequência da atualização automática:</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setCronSchedule('0 * * * *')}>De 1 em 1 Hora</button>
              <button className="btn btn-secondary" onClick={() => setCronSchedule('*/30 * * * *')}>A cada 30 Minutos</button>
              <button className="btn btn-secondary" onClick={() => setCronSchedule('0 0 * * *')}>Todo dia (Meia Noite)</button>
              <button className="btn btn-secondary" onClick={() => setCronSchedule('0 0 * * 0')}>Toda Semana (Domingo)</button>
            </div>

            <div className="input-group">
              <label>Configuração Avançada (Formato Cron)</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="text" 
                  value={cronSchedule} 
                  onChange={e => setCronSchedule(e.target.value)} 
                  placeholder="ex: 0 0 * * *"
                  style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'white' }}
                />
                <button className="btn btn-primary" onClick={saveSettings}>Salvar Configuração</button>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                Atualmente configurado para rodar: <strong style={{ color: 'var(--primary-color)' }}>{cronSchedule}</strong>. 
                {timeRemaining && <span> Próxima execução em: <strong style={{ color: 'var(--accent-green)' }}>{timeRemaining}</strong></span>}
              </p>
            </div>

            <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
               <h4 style={{ color: 'var(--primary-color)', marginBottom: '0.5rem' }}>🎯 Modo Auditoria Ativa</h4>
               <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <button className={`btn ${!isHeadless ? 'btn-primary' : 'btn-secondary'}`} onClick={() => toggleHeadless(false)} style={{ flex: 1 }}>
                    <Play size={16} style={{ marginRight: 8 }}/> Mostrar Navegador
                  </button>
                  <button className={`btn ${isHeadless ? 'btn-primary' : 'btn-secondary'}`} onClick={() => toggleHeadless(true)} style={{ flex: 1 }}>
                    <PowerOff size={16} style={{ marginRight: 8 }}/> Modo Silencioso
                  </button>
               </div>
               
               <div style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
                  <h4 style={{ color: 'var(--primary-color)', marginBottom: '0.5rem' }}>🔍 Filtro de Relevância</h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <button className={`btn ${isRelevancyEnabled ? 'btn-primary' : 'btn-secondary'}`} onClick={() => toggleRelevancy(true)} style={{ flex: 1 }}>
                        Filtro Ligado (Rigoroso)
                      </button>
                      <button className={`btn ${!isRelevancyEnabled ? 'btn-primary' : 'btn-secondary'}`} onClick={() => toggleRelevancy(false)} style={{ flex: 1 }}>
                        Filtro Desligado (Tudo)
                      </button>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                    * Desligue para que o robô traga TODOS os resultados da busca, sem ignorar nada.
                  </p>
               </div>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'main' && (
        <div className="dashboard-panel">
          <div className="input-group">
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>URLs ou Termos de Busca (um por linha)</span>
              <span className="shortcut-hint">Pressione [Enter] ou [Ctrl+Enter] para pesquisar</span>
            </label>
            <textarea 
              placeholder="Cole aqui os links ou digite o nome do produto (ex: Relógio Samsung Galaxy Watch)"
              value={urlsInput}
              onChange={(e) => setUrlsInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>

          <div className="actions">
            <div className="file-upload-wrapper">
              <button className="btn btn-secondary">
                <Upload size={18} /> Importar Lista (.txt/.csv)
              </button>
              <input type="file" accept=".txt,.csv" onChange={handleFileUpload} title="Importar arquivo" />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {auditMessage && <span style={{ color: 'var(--primary-color)', fontSize: '0.9rem', fontWeight: 'bold' }}>{auditMessage}</span>}
              
              <button className="btn btn-primary" onClick={handleStartAudit} disabled={loading || isBackgroundScanning} style={{ padding: '1rem 2.5rem', fontSize: '1.2rem', minWidth: '220px' }}>
                {(loading || isBackgroundScanning) ? (
                  <div className="progress-bar-container" style={{ width: '100%' }}>
                    <div className="progress-bar-fill"></div>
                  </div>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Search size={20} /> 
                    <span>Pesquisar</span>
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="dashboard-panel" style={{ padding: '1rem 2rem', flexDirection: 'row', gap: '2rem', alignItems: 'center' }}>
         <div className="input-group" style={{ flex: 2 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Search size={14}/> Buscar na Lista</label>
            <input type="text" placeholder="Filtrar por título ou ASIN..." value={searchFilter} onChange={e => { setSearchFilter(e.target.value); setCurrentPage(1); }} style={{ padding: '0.5rem', borderRadius: '4px', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid var(--border-color)', color: 'white' }} />
         </div>
         <div className="input-group" style={{ flex: 1 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Filter size={14}/> Categoria</label>
            <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setCurrentPage(1); }} style={{ padding: '0.5rem', borderRadius: '4px', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid var(--border-color)', color: 'white' }}>
               <option value="">Todas</option>
               {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
         </div>
         <div className="input-group" style={{ flex: 1 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Filter size={14}/> Vendedor</label>
            <select value={sellerFilter} onChange={e => { setSellerFilter(e.target.value); setCurrentPage(1); }} style={{ padding: '0.5rem', borderRadius: '4px', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid var(--border-color)', color: 'white' }}>
               <option value="">Todos</option>
               {sellers.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
         </div>
         <div className="input-group" style={{ flex: 1 }}>
            <label>Itens por Página</label>
            <select value={itemsPerPage} onChange={e => { setItemsPerPage(e.target.value === 'all' ? 'all' : Number(e.target.value)); setCurrentPage(1); }} style={{ padding: '0.5rem', borderRadius: '4px', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid var(--border-color)', color: 'white' }}>
               <option value={20}>20</option>
               <option value={40}>40</option>
               <option value={80}>80</option>
               <option value={100}>100</option>
               <option value="all">Todos</option>
            </select>
         </div>
         <div style={{ alignSelf: 'flex-end' }}>
            {viewMode === 'main' ? (
              <button className="btn btn-secondary" onClick={handleTrashAll} style={{ color: 'var(--danger-color)', borderColor: 'var(--danger-color)', padding: '0.5rem 1rem' }}>
                <Trash2 size={16} /> Limpar Lista
              </button>
            ) : (
              <button className="btn btn-primary" onClick={handleEmptyTrash} style={{ background: 'var(--danger-color)', padding: '0.5rem 1rem' }}>
                <Trash2 size={16} /> Esvaziar Lixeira
              </button>
            )}
         </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Produto e Variação</th>
              <th 
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} 
                style={{ cursor: 'pointer', userSelect: 'none', color: sortOrder ? 'var(--primary-color)' : 'var(--text-secondary)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Preço Atual
                  {sortOrder === 'asc' ? <TrendingUp size={14}/> : sortOrder === 'desc' ? <TrendingDown size={14}/> : <Filter size={14} style={{ opacity: 0.3 }}/>}
                </div>
              </th>
              <th>Status</th>
              <th>Histórico (Gráfico)</th>
              <th>Vendedores</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {currentItems.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                  {viewMode === 'trash' ? 'Nenhum item na lixeira.' : 'Nenhum histórico encontrado.'}
                </td>
              </tr>
            ) : (
              currentItems.map((item) => {
                const latest = item.latest;
                const chartData = [];
                const rawHistory = item.history;
                for (let i = 0; i < rawHistory.length; i++) {
                  const h = rawHistory[i];
                  const next = rawHistory[i + 1];
                  const prev = chartData[chartData.length - 1];
                  
                  const currDay = h.date.split('T')[0];
                  const nextDay = next ? next.date.split('T')[0] : null;

                  const priceChanged = prev && h.main_price !== prev.price;
                  const isEndOfDay = currDay !== nextDay;

                  if (i === 0 || priceChanged || isEndOfDay) {
                    chartData.push({ date: h.date, price: h.main_price });
                  }
                }
                const isActive = item.is_active;
                const isRefreshing = refreshingAsin === item.asin;

                return (
                  <tr key={item.asin} style={{ opacity: (!isActive && viewMode !== 'trash') ? 0.5 : 1 }}>
                    <td>
                      <div className="product-info">
                        <a href={latest.url} target="_blank" rel="noreferrer" className="product-title">
                          {latest.title || 'Título Indisponível'}
                        </a>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                          <span className="product-asin">ID: {item.asin}</span>
                          <span className="product-asin">| Loja: <strong style={{ color: 'var(--primary-color)' }}>{item.store || 'Amazon'}</strong></span>
                          <span className="page-info-badge">Página: {latest.page_found || 1}</span>
                        </div>
                        
                        {/* Render Variations */}
                        {latest.product_variations && Object.keys(latest.product_variations).length > 0 && (
                          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                             {Object.entries(latest.product_variations).map(([k, v]) => (
                                <span key={k} style={{ background: 'var(--surface-color)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', border: '1px solid var(--border-color)' }}>
                                  <strong>{k}:</strong> {v}
                                </span>
                             ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="price">R$ {latest.main_price ? latest.main_price.toFixed(2) : '0.00'}</span>
                      {latest.old_price > latest.main_price && <span className="old-price">R$ {latest.old_price.toFixed(2)}</span>}
                      {latest.real_discount > 0 && <div style={{ fontSize: '0.8rem', color: 'var(--success-color)' }}>-{latest.real_discount}% off</div>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {renderVariationBadge(latest.variation)}
                        {viewMode !== 'trash' && (
                           <span style={{ fontSize: '0.75rem', color: isActive ? 'var(--success-color)' : 'var(--text-secondary)' }}>
                             {isActive ? `Agendado (${timeRemaining})` : 'Ignorado'}
                           </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="chart-container">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData}>
                            <XAxis dataKey="date" hide />
                            <YAxis domain={['auto', 'auto']} hide />
                            <Tooltip content={<CustomTooltip />} />
                            <Line type="monotone" dataKey="price" stroke={isActive ? 'var(--primary-color)' : 'var(--text-secondary)'} strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </td>
                    <td>
                      <div className="sellers-list">
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{latest.main_seller}</span>
                        {latest.other_sellers && latest.other_sellers.slice(0, 2).map((seller, idx) => (
                          <span key={idx}>{seller.seller}: R$ {seller.price.toFixed(2)}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {viewMode === 'main' ? (
                          <>
                            <button className="btn btn-secondary" style={{ padding: '0.5rem' }} onClick={() => handleManualRefresh(latest.url, item.asin)} title="Atualizar Agora" disabled={isRefreshing}>
                              {isRefreshing ? <span className="loader" style={{ width: '16px', height: '16px', borderTopColor: 'var(--primary-color)' }}></span> : <RefreshCw size={16} color="var(--primary-color)" />}
                            </button>
                            <button className="btn btn-secondary" style={{ padding: '0.5rem' }} onClick={() => toggleActive(item.asin, isActive)} title={isActive ? "Inativar Agendamento" : "Ativar Agendamento"}>
                              {isActive ? <Power size={16} color="var(--success-color)" /> : <PowerOff size={16} color="var(--text-secondary)" />}
                            </button>
                            <button className="btn btn-secondary" style={{ padding: '0.5rem' }} onClick={() => toggleTrash(item.asin, false)} title="Mover para Lixeira">
                              <Trash2 size={16} color="var(--danger-color)" />
                            </button>
                          </>
                        ) : (
                          <button className="btn btn-secondary" style={{ padding: '0.5rem' }} onClick={() => toggleTrash(item.asin, true)} title="Restaurar para a Lista">
                            <RotateCcw size={16} color="var(--success-color)" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {itemsPerPage !== 'all' && totalPages > 1 && (
        <div className="pagination-controls dashboard-panel" style={{ flexDirection: 'row', marginTop: '1rem' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Mostrando {indexOfFirstItem + 1} - {Math.min(indexOfLastItem, totalItems)} de {totalItems} produtos
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              className="btn btn-secondary" 
              disabled={currentPage === 1} 
              onClick={() => paginate(currentPage - 1)}
              style={{ padding: '0.5rem 1rem' }}
            >
              Anterior
            </button>
            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
               {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) pageNum = i + 1;
                  else if (currentPage <= 3) pageNum = i + 1;
                  else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = currentPage - 2 + i;
                  
                  return (
                    <button 
                      key={pageNum}
                      className={`btn ${currentPage === pageNum ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => paginate(pageNum)}
                      style={{ padding: '0.5rem', minWidth: '40px' }}
                    >
                      {pageNum}
                    </button>
                  );
               })}
            </div>
            <button 
              className="btn btn-secondary" 
              disabled={currentPage === totalPages} 
              onClick={() => paginate(currentPage + 1)}
              style={{ padding: '0.5rem 1rem' }}
            >
              Próxima
            </button>
          </div>
        </div>
      )}
      {/* Live Logs Panel */}
      <div className={`logs-panel ${showLogs ? 'active' : ''}`}>
        <div className="logs-header" onClick={() => setShowLogs(!showLogs)}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
             <Settings size={16} className={isBackgroundScanning ? 'spin' : ''} /> Log de Execução (Audit)
             {isBackgroundScanning && <span className="status-dot pulsing"></span>}
           </div>
           <button className="btn-icon" style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer' }}>
             {showLogs ? '▼ Fechar' : '▲ Abrir Log'}
           </button>
        </div>
        {showLogs && (
          <div className="logs-content">
            {logs.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', padding: '1rem' }}>Aguardando atividades do robô...</p>
            ) : (
              logs.map(log => (
                <div key={log.id} className={`log-line ${log.type}`} style={{ padding: '4px 1rem', fontSize: '0.85rem', borderBottom: '1px solid rgba(255,255,255,0.03)', fontFamily: 'monospace' }}>
                  <span className="log-time" style={{ color: 'var(--primary-color)', marginRight: '8px' }}>[{log.time}]</span> 
                  <span style={{ color: log.type === 'error' ? 'var(--danger-color)' : 'var(--text-primary)' }}>{log.msg}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
