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
  const [isLogsEnabled, setIsLogsEnabled] = useState(true);
  const [auditProgress, setAuditProgress] = useState({ current: 0, total: 0, active: false });

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Sorting and Seller states
  const [sortOrder, setSortOrder] = useState(null);
  const [sellerFilter, setSellerFilter] = useState('');

  // Modal state
  const [modal, setModal] = useState({ show: false, title: '', message: '', onConfirm: null, type: 'confirm' });

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
    
    // Verificar se há uma auditoria rodando em background ao iniciar (F5)
    const checkActiveAudit = async () => {
      try {
        const res = await fetch(`${API_URL}/audit/progress`);
        const data = await res.json();
        if (data.active) {
          setIsBackgroundScanning(true);
          setAuditProgress(data);
        }
      } catch (e) {}
    };
    checkActiveAudit();

    // SSE for Live Logs (controlado pelo toggle)
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

  // Polling para progresso real e atualização da lista
  useEffect(() => {
    let interval;
    let listInterval;

    if (isBackgroundScanning) {
      // Polling de progresso
      interval = setInterval(async () => {
        try {
          const res = await fetch(`${API_URL}/audit/progress`);
          const data = await res.json();
          setAuditProgress(data);
          if (!data.active) {
            setIsBackgroundScanning(false);
            fetchHistory(); // Busca final
          }
        } catch (e) {}
      }, 2000);

      // Polling de lista (Atualização em tempo real conforme sugerido)
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
    if (!urlsInput.trim()) {
      showModal(
        'Atualizar Lista',
        'Deseja atualizar todos os preços da lista atual agora?',
        async () => {
          closeModal();
          setLoading(true);
          try {
            const res = await fetch(`${API_URL}/audit/active`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
              setIsBackgroundScanning(true);
              setAuditMessage('Atualizando lista...');
            } else {
              showModal('Aviso', data.message || 'Erro ao iniciar atualização.');
            }
          } catch (err) {
            showModal('Erro', 'Erro ao conectar com o servidor.');
          } finally {
            setLoading(false);
          }
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
        setAuditMessage('Pesquisa iniciada...');
      }
    } catch (err) {
      setAuditMessage('Erro ao iniciar auditoria.');
    } finally {
      setLoading(false);
    }
  };

  const handleStopAudit = async () => {
    try {
      await fetch(`${API_URL}/audit/stop`, { method: 'POST' });
      setIsBackgroundScanning(false);
      setAuditMessage('Interrupção solicitada pelo usuário.');
    } catch (err) {
      console.error('Erro ao parar auditoria:', err);
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
    showModal(
      'Limpar Lista',
      'Deseja mover todos os itens para a lixeira?',
      async () => {
        closeModal();
        try {
          await fetch(`${API_URL}/history/trash-all`, { method: 'POST' });
          setHistory([]);
          fetchHistory();
        } catch (e) {
          console.error('Erro no Trash All:', e);
        }
      }
    );
  };

  const handleEmptyTrash = async () => {
    showModal(
      'Esvaziar Lixeira',
      'Deseja excluir permanentemente todos os itens? Esta ação não pode ser desfeita.',
      async () => {
        closeModal();
        try {
          await fetch(`${API_URL}/history/empty-trash`, { method: 'DELETE' });
          setHistory([]);
          fetchHistory();
        } catch (e) {
          console.error('Erro no Empty Trash:', e);
        }
      }
    );
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
      showModal('Sucesso', 'Agendamento salvo com sucesso!');
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
      <header>
        <h1>Buscador de Preços</h1>
        <p>Monitoramento Inteligente: Amazon Brasil</p>
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

               <div style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
                  <h4 style={{ color: 'var(--primary-color)', marginBottom: '0.5rem' }}>📝 Coleta de Logs</h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <button className={`btn ${isLogsEnabled ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setIsLogsEnabled(true)} style={{ flex: 1 }}>
                        Logs Ativados
                      </button>
                      <button className={`btn ${!isLogsEnabled ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setIsLogsEnabled(false); setLogs([]); }} style={{ flex: 1 }}>
                        Logs Desativados
                      </button>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                    * Desative para reduzir consumo. Ative para monitorar a raspagem em tempo real.
                  </p>
               </div>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'main' && (
        <div className="dashboard-panel">
          <div className="input-group">
            <label>
              <span>🎯 URLs ou Termos de Busca</span>
              <span className="shortcut-hint">Pressione [Ctrl+Enter] para pesquisar</span>
            </label>
            <textarea 
              placeholder="Ex: Samsung Galaxy S24 ou cole um link da Amazon..."
              value={urlsInput}
              onChange={(e) => setUrlsInput(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{ minHeight: '150px' }}
            />
          </div>

          <div className="actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
            <div className="file-upload-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={() => document.getElementById('file-import-input').click()}>
                <Upload size={18} /> Importar Lista
              </button>
              <input id="file-import-input" type="file" accept=".txt,.csv" onChange={handleFileUpload} style={{ display: 'none' }} />
              <button className="btn btn-secondary" onClick={() => setShowSettings(!showSettings)} title="Configurações">
                <Settings size={18} />
              </button>
              <button className="btn btn-secondary" onClick={() => setViewMode(viewMode === 'main' ? 'trash' : 'main')} title={viewMode === 'main' ? 'Lixeira' : 'Voltar'} style={{ color: viewMode === 'trash' ? 'var(--primary-color)' : '' }}>
                {viewMode === 'main' ? <Trash2 size={18} /> : <ArrowLeft size={18} />}
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              {(auditMessage || auditProgress.status) && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right' }}>
                  {auditMessage && <span style={{ color: 'var(--primary-color)', fontSize: '0.9rem', fontWeight: '700' }}>{auditMessage}</span>}
                  {auditProgress.active && <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>{auditProgress.status}</span>}
                </div>
              )}
              
              <button className="btn btn-primary" onClick={handleStartAudit} disabled={loading || isBackgroundScanning} style={{ padding: '0.8rem 2.5rem' }}>
                {(loading || isBackgroundScanning) ? (
                  <div className="progress-bar-container" style={{ width: '120px' }}>
                    <div 
                        className="progress-bar-fill" 
                        style={{ 
                            width: auditProgress.total > 0 ? `${Math.max(5, (auditProgress.current / auditProgress.total) * 100)}%` : '10%' 
                        }}
                    ></div>
                  </div>
                ) : (
                  <Search size={22} /> 
                )}
              </button>

              {isBackgroundScanning && (
                <button className="btn btn-danger" onClick={handleStopAudit} title="Interromper Pesquisa">
                   <Power size={20} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="dashboard-panel" style={{ padding: '1.5rem 2rem', flexDirection: 'row', gap: '2rem', alignItems: 'center', display: 'flex' }}>
         <div className="input-group" style={{ flex: 3 }}>
            <label><Search size={14}/> Buscar na Lista</label>
            <input type="text" placeholder="Nome do produto ou ASIN..." value={searchFilter} onChange={e => { setSearchFilter(e.target.value); setCurrentPage(1); }} />
         </div>
         <div className="input-group" style={{ flex: 1.5 }}>
            <label><Filter size={14}/> Categoria</label>
            <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setCurrentPage(1); }}>
               <option value="">Todas</option>
               {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
         </div>
         <div className="input-group" style={{ width: '120px' }}>
            <label>Pág.</label>
            <select value={itemsPerPage} onChange={e => { setItemsPerPage(e.target.value === 'all' ? 'all' : Number(e.target.value)); setCurrentPage(1); }}>
               <option value={5}>5</option>
               <option value={20}>20</option>
               <option value={40}>40</option>
               <option value={80}>80</option>
               <option value="all">Tudo</option>
            </select>
         </div>
         <div style={{ alignSelf: 'flex-end', marginLeft: 'auto' }}>
            {viewMode === 'main' ? (
              <button className="btn btn-danger" onClick={handleTrashAll}>
                <Trash2 size={18} /> Limpar
              </button>
            ) : (
              <button className="btn btn-primary" onClick={handleEmptyTrash}>
                <Trash2 size={18} /> Esvaziar
              </button>
            )}
         </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Produto e Variação</th>
              <th>Preço DE</th>
              <th 
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} 
                style={{ cursor: 'pointer', userSelect: 'none', color: sortOrder ? 'var(--primary-color)' : 'var(--text-secondary)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Preço À Vista
                  {sortOrder === 'asc' ? <TrendingUp size={14}/> : sortOrder === 'desc' ? <TrendingDown size={14}/> : <Filter size={14} style={{ opacity: 0.3 }}/>}
                </div>
              </th>
              <th>Parcelamento</th>
              <th>Status</th>
              <th>Histórico</th>
              <th>Vendedores</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {currentItems.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>
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
                      <div className="product-info" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        {item.image_url && (
                           <div style={{ flexShrink: 0, width: '50px', height: '50px', backgroundColor: 'white', borderRadius: '6px', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2px' }}>
                             <img src={item.image_url} alt="Produto" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                           </div>
                        )}
                        <div style={{ flex: 1 }}>
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
                                  <span key={k} style={{ background: 'var(--surface-color)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', border: '1px solid var(--border-light)' }}>
                                    <strong>{k}:</strong> {v}
                                  </span>
                               ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* PREÇO DE */}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        {latest.old_price && latest.old_price > latest.main_price ? (
                          <>
                            <span style={{ fontSize: '0.9rem', color: 'var(--text-dim)', textDecoration: 'line-through', opacity: 0.6 }}>
                              R$ {latest.old_price.toFixed(2)}
                            </span>
                            {latest.real_discount > 0 && (
                              <span className="badge badge-down" style={{ fontSize: '0.7rem', padding: '0.2rem 0.6rem', width: 'fit-content' }}>
                                -{latest.real_discount}% OFF
                              </span>
                            )}
                          </>
                        ) : (
                          <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>—</span>
                        )}
                      </div>
                    </td>

                    {/* PREÇO À VISTA */}
                    <td>
                      <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--success)', letterSpacing: '-0.02em' }}>
                        R$ {latest.main_price ? latest.main_price.toFixed(2) : '0.00'}
                      </span>
                    </td>

                    {/* PARCELAMENTO + JUROS */}
                    <td>
                      {latest.installments_count && latest.installments_count > 1 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          <span style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '0.95rem' }}>
                            {latest.installments_count}x de R$ {latest.installment_value?.toFixed(2)}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                            Total: R$ {latest.installment_total?.toFixed(2)}
                          </span>
                          <div className={`badge ${latest.interest_rate >= 1 ? 'badge-up' : 'badge-down'}`} style={{ width: 'fit-content', fontSize: '0.7rem', padding: '0.2rem 0.6rem' }}>
                            {latest.interest_rate >= 1 ? `+${latest.interest_rate}% de juros` : '✓ SEM JUROS'}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>—</span>
                      )}
                    </td>

                    {/* STATUS */}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {renderVariationBadge(latest.variation)}
                        {viewMode !== 'trash' && (
                           <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: '600', color: isActive ? 'var(--success)' : 'var(--text-dim)' }}>
                             <div style={{ width: 6, height: 6, borderRadius: '50%', background: isActive ? 'var(--success)' : 'var(--text-dim)', boxShadow: isActive ? '0 0 8px var(--success)' : '' }}></div>
                             {isActive ? `Ativo (${timeRemaining})` : 'Pausado'}
                           </div>
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
                      <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
                        {viewMode === 'main' ? (
                          <>
                            <button className="btn btn-secondary" style={{ padding: '0.6rem', borderRadius: '12px' }} onClick={() => handleManualRefresh(latest.url, item.asin)} title="Atualizar Agora" disabled={isRefreshing}>
                              {isRefreshing ? <RefreshCw size={16} className="spin" /> : <RefreshCw size={16} color="var(--primary-color)" />}
                            </button>
                            <button className="btn btn-secondary" style={{ padding: '0.6rem', borderRadius: '12px' }} onClick={() => toggleActive(item.asin, isActive)} title={isActive ? "Pausar" : "Ativar"}>
                              {isActive ? <Power size={16} color="var(--success)" /> : <PowerOff size={16} color="var(--text-dim)" />}
                            </button>
                            <button className="btn btn-secondary" style={{ padding: '0.6rem', borderRadius: '12px' }} onClick={() => toggleTrash(item.asin, false)} title="Mover para Lixeira">
                              <Trash2 size={16} color="var(--danger)" />
                            </button>
                          </>
                        ) : (
                          <button className="btn btn-secondary" style={{ padding: '0.6rem', borderRadius: '12px' }} onClick={() => toggleTrash(item.asin, true)} title="Restaurar">
                            <RotateCcw size={16} color="var(--success)" />
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
              <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', padding: '1rem' }}>Aguardando atividades do robô...</p>
            ) : (
              logs.map(log => (
                <div key={log.id} style={{
                  padding: '5px 1rem',
                  fontSize: '0.8rem',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  fontFamily: "'Outfit', monospace",
                  color: log.type === 'error' ? 'var(--danger)' 
                       : log.type === 'success' ? 'var(--success)' 
                       : log.type === 'warn' ? 'var(--warning)' 
                       : log.type === 'data' ? 'var(--accent-cyan)' 
                       : 'var(--text-dim)',
                  background: log.type === 'error' ? 'rgba(239,68,68,0.05)' 
                            : log.type === 'success' ? 'rgba(16,185,129,0.05)' 
                            : 'transparent'
                }}>
                  <span style={{ color: 'var(--primary-color)', marginRight: '8px', opacity: 0.7 }}>[{log.time}]</span>
                  {log.msg}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* MODAL CUSTOMIZADO */}
      {modal.show && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)'
        }} onClick={closeModal}>
          <div style={{
            background: 'var(--surface-color)', backdropFilter: 'var(--glass-blur)',
            border: '1px solid var(--border-light)', borderRadius: '20px',
            padding: '2.5rem', maxWidth: '420px', width: '90%',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
            animation: 'fadeIn 0.2s ease-out'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.3rem', fontWeight: '700', color: 'white', marginBottom: '1rem' }}>
              {modal.title}
            </h3>
            <p style={{ color: 'var(--text-dim)', fontSize: '1rem', lineHeight: '1.6', marginBottom: '2rem' }}>
              {modal.message}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              {modal.type === 'confirm' && (
                <button className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
              )}
              <button className="btn btn-primary" onClick={() => {
                if (modal.onConfirm) modal.onConfirm();
                else closeModal();
              }}>
                {modal.type === 'confirm' ? 'Confirmar' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
