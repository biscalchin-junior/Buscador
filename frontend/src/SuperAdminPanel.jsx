import React, { useState, useEffect } from 'react';
import { Users, Search, BarChart3, RefreshCw, TrendingUp, TrendingDown, Settings, AlertTriangle, ExternalLink, FileText, FileSearch, X, CheckCircle2 } from 'lucide-react';
import { useAuth } from './AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function SuperAdminPanel() {
  const { token } = useAuth();
  const [tab, setTab] = useState('dashboard');
  const [searches, setSearches] = useState([]);
  const [users, setUsers] = useState([]);
  const [flagged, setFlagged] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({ cronSchedule: '0 0 * * *', isHeadless: true, loggingEnabled: true });
  const [stats, setStats] = useState({ liveUsers: 0, totalProducts: 0, totalErrors: 0, system: {}, topDiscounts: [] });

  const headers = { Authorization: `Bearer ${token}` };

  async function fetchStats(silent = false) {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/stats`, { headers });
      setStats(await res.json());
    } catch {} finally { if (!silent) setLoading(false); }
  }

  async function fetchSearches() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/guest-searches`, { headers });
      setSearches(await res.json());
    } catch {} finally { setLoading(false); }
  }

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/users`, { headers });
      setUsers(await res.json());
    } catch {} finally { setLoading(false); }
  }

  async function fetchFlagged() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/flagged-products`, { headers });
      setFlagged(await res.json());
    } catch {} finally { setLoading(false); }
  }

  async function handleResolve(asin) {
    try {
        const res = await fetch(`${API_URL}/admin/product/${asin}/resolve`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' }
        });
        if (res.ok) {
            alert('Ajustado!');
            fetchFlagged();
        }
    } catch (e) { alert('Erro ao resolver'); }
  }

  async function fetchSettings() {
    try {
      const res = await fetch(`${API_URL}/settings`, { headers });
      setSettings(await res.json());
    } catch {}
  }

  async function saveSettings(newSettings) {
    try {
      await fetch(`${API_URL}/settings`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      setSettings(newSettings);
      alert('Salvo!');
    } catch { alert('Erro'); }
  }

  useEffect(() => {
    if (tab === 'searches') fetchSearches();
    else if (tab === 'users') fetchUsers();
    else if (tab === 'settings') fetchSettings();
    else if (tab === 'flagged') fetchFlagged();
    else if (tab === 'dashboard') {
      fetchStats();
      const iv = setInterval(() => fetchStats(true), 5000); // Atualiza em silêncio a cada 5s
      return () => clearInterval(iv);
    }
  }, [tab]);

  const TABS = [
    { id: 'dashboard', label: 'DASHBOARD' },
    { id: 'searches', label: 'PESQUISAS' },
    { id: 'users', label: 'USUÁRIOS' },
    { id: 'flagged', label: 'REVISÃO' },
    { id: 'settings', label: 'AJUSTES' },
  ];

  return (
    <section className="py-12 border-t border-black">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-xl font-bold uppercase">Superadmin</h2>
        <button onClick={() => fetchStats()} className="border border-black px-4 py-1 text-xs font-bold uppercase">
          {loading ? 'SINC...' : 'RECARREGAR'}
        </button>
      </div>

      <div className="flex gap-2 mb-8 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-1 text-[10px] font-bold uppercase border border-black ${tab === t.id ? 'bg-black text-white' : 'bg-white text-black'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-2">
             {[
               { label: 'Online', value: stats.liveUsers, desc: 'Conexões ativas agora' },
               { label: 'Ativos', value: stats.totalProducts, desc: 'Produtos no catálogo' },
               { label: 'Erros', value: stats.totalErrors, desc: 'Falhas na última captura' },
               { label: 'Usuários', value: stats.totalUsers || 0, desc: 'Contas registradas' },
               { label: 'Lixeiras', value: stats.totalTrash || 0, desc: 'Itens deletados (Total)' },
               { label: 'CPU', value: stats.system?.cpuUsage || '0%', desc: 'Uso do processador' },
               { label: 'RAM', value: stats.system?.memUsage || '0MB', desc: 'Memória em uso' }
             ].map((card, i) => (
               <div key={i} className="border border-black p-4 flex flex-col justify-between group hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="text-[9px] font-bold uppercase">{card.label}</p>
                    <p className="text-[7px] text-gray-500 uppercase leading-tight mb-1">{card.desc}</p>
                  </div>
                  <h4 className="text-xl font-bold">{card.value}</h4>
               </div>
             ))}
          </div>

          <div className="border border-black">
             <div className="p-4 border-b border-black font-bold uppercase text-xs">Top Descontos Reais</div>
             <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                   <thead>
                      <tr className="border-b border-black">
                         {['Loja', 'Produto', 'Anterior', 'Atual', 'Desc %'].map(h => (
                           <th key={h} className="p-4 font-bold uppercase">{h}</th>
                         ))}
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-black">
                      {stats.topDiscounts?.map(p => (
                        <tr key={p.asin}>
                           <td className="p-4 uppercase">{p.store}</td>
                           <td className="p-4 truncate max-w-[200px] uppercase font-bold">{p.title}</td>
                           <td className="p-4">R$ {p.last_price?.toFixed(2)}</td>
                           <td className="p-4 font-bold">R$ {p.current_price?.toFixed(2)}</td>
                           <td className="p-4 font-bold">-{p.diff_percent?.toFixed(1)}%</td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
        </div>
      )}

      {tab === 'searches' && (
        <div className="border border-black overflow-hidden">
          <div className="p-4 border-b border-black font-bold uppercase text-xs">Pesquisas de Visitantes (Guest)</div>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-black">
                <th className="p-4 font-bold uppercase">Termo / URL</th>
                <th className="p-4 font-bold uppercase">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black">
              {searches.map((s, i) => (
                <tr key={i}>
                  <td className="p-4 truncate max-w-[400px] uppercase font-bold text-gray-700">{s.query || s.url}</td>
                  <td className="p-4 text-[10px]">{new Date(s.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'users' && (
        <div className="border border-black overflow-hidden">
          <div className="p-4 border-b border-black font-bold uppercase text-xs">Lista de Usuários do Sistema</div>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-black">
                <th className="p-4 font-bold uppercase">E-mail de Acesso</th>
                <th className="p-4 font-bold uppercase">Nível</th>
                <th className="p-4 font-bold uppercase">Cadastro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black">
              {users.map((u, i) => (
                <tr key={i}>
                  <td className="p-4 font-bold uppercase">{u.email}</td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 text-[9px] font-bold border border-black ${u.role === 'SUPERADMIN' ? 'bg-black text-white' : 'bg-white text-black'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="p-4 text-[10px]">{new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedLog && (
        <div className="fixed inset-0 z-[200] bg-white border border-black p-8 overflow-auto">
           <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold uppercase">Log Técnico</h3>
              <button onClick={() => setSelectedLog(null)} className="border border-black px-4 py-1 font-bold">FECHAR</button>
           </div>
           <pre className="text-[10px] whitespace-pre-wrap">{selectedLog}</pre>
        </div>
      )}

      {tab === 'flagged' && (
        <div className="border border-black">
          <div className="p-4 border-b border-black font-bold uppercase text-xs">Produtos em Revisão</div>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-black">
                {['Produto', 'Preço', 'Data', 'Ações'].map(h => (
                  <th key={h} className="p-4 font-bold uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black">
              {flagged.map(f => (
                <tr key={f.asin}>
                  <td className="p-4 truncate max-w-[200px] uppercase font-bold">{f.title}</td>
                  <td className="p-4">R$ {f.main_price?.toFixed(2)}</td>
                  <td className="p-4 text-[10px]">{new Date(f.history_date).toLocaleString()}</td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button onClick={async () => {
                         try {
                           await fetch(`${API_URL}/audit`, {
                             method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                             body: JSON.stringify({ urls: [f.url] })
                           });
                           alert('Recapturado!');
                           fetchFlagged();
                         } catch { }
                      }} className="border border-black px-2 py-0.5 text-[9px] font-bold uppercase bg-black text-white">SINC</button>
                      <button onClick={() => setSelectedLog(f.review_log)} className="border border-black px-2 py-0.5 text-[9px] font-bold">LOG</button>
                      <button onClick={() => handleResolve(f.asin)} className="bg-black text-white px-2 py-0.5 text-[9px] font-bold uppercase">OK</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'settings' && (
        <div className="max-w-md space-y-8">
          <div className="border border-black p-6 space-y-6">
            <h3 className="font-bold uppercase text-sm">Controle do Scraper</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase">Modo Invisível (Headless)</span>
                <button 
                  onClick={() => setSettings({...settings, isHeadless: !settings.isHeadless})}
                  className={`px-3 py-1 text-[9px] font-bold uppercase border border-black ${settings.isHeadless ? 'bg-black text-white' : 'bg-white text-black'}`}
                >
                  {settings.isHeadless ? 'ATIVO' : 'INATIVO'}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase">Logs de Auditoria</span>
                <button 
                  onClick={() => setSettings({...settings, loggingEnabled: !settings.loggingEnabled})}
                  className={`px-3 py-1 text-[9px] font-bold uppercase border border-black ${settings.loggingEnabled ? 'bg-black text-white' : 'bg-white text-black'}`}
                >
                  {settings.loggingEnabled ? 'ATIVO' : 'INATIVO'}
                </button>
              </div>

              <div>
                <label className="text-[10px] font-bold block mb-2 uppercase">Intervalo de Varredura</label>
                <div className="flex gap-2">
                  <input 
                    type="number" 
                    min="1"
                    value={(() => {
                      const parts = settings.cronSchedule.split(' ');
                      if (parts[1] && parts[1].startsWith('*/')) return parseInt(parts[1].replace('*/', '')); // horas
                      if (parts[2] && parts[2].startsWith('*/')) return parseInt(parts[2].replace('*/', '')); // dias
                      return 24;
                    })()} 
                    onChange={e => {
                      const val = Math.max(1, parseInt(e.target.value) || 1);
                      const isDays = settings.cronSchedule.split(' ')[2]?.startsWith('*/');
                      if (isDays) setSettings({...settings, cronSchedule: `0 0 */${val} * *`});
                      else setSettings({...settings, cronSchedule: `0 */${val} * * *`});
                    }}
                    className="border border-black w-20 p-2 text-xs outline-none" 
                  />
                  <select
                    value={settings.cronSchedule.split(' ')[2]?.startsWith('*/') ? 'dias' : 'horas'}
                    onChange={e => {
                      const val = (() => {
                        const parts = settings.cronSchedule.split(' ');
                        if (parts[1] && parts[1].startsWith('*/')) return parseInt(parts[1].replace('*/', ''));
                        if (parts[2] && parts[2].startsWith('*/')) return parseInt(parts[2].replace('*/', ''));
                        return 24;
                      })();
                      if (e.target.value === 'dias') setSettings({...settings, cronSchedule: `0 0 */${val} * *`});
                      else setSettings({...settings, cronSchedule: `0 */${val} * * *`});
                    }}
                    className="border border-black flex-1 p-2 text-xs outline-none font-bold uppercase"
                  >
                    <option value="horas">Horas</option>
                    <option value="dias">Dias</option>
                  </select>
                </div>
                <p className="text-[8px] font-bold text-gray-400 mt-1">SISTEMA TRADUZIU: {settings.cronSchedule}</p>
              </div>

              <div>
                <label className="text-[10px] font-bold block mb-2 uppercase">Permanência na Lixeira (Dias)</label>
                <input 
                  type="number" 
                  min="1"
                  value={settings.trashRetentionDays || 60} 
                  onChange={(e) => setSettings({...settings, trashRetentionDays: e.target.value})}
                  className="border border-black w-full p-2 text-xs outline-none"
                />
                <p className="text-[8px] font-bold text-gray-400 mt-1">APÓS ESTE PRAZO, O ITEM É EXCLUÍDO DEFINITIVAMENTE.</p>
              </div>
            </div>

            <button onClick={() => saveSettings(settings)} className="w-full bg-black text-white py-3 text-xs font-bold uppercase">Salvar Ajustes</button>
          </div>

          <div className="border border-black p-6 space-y-4">
             <h3 className="font-bold uppercase text-sm text-red-500">Ações Críticas</h3>
             <button 
               onClick={async () => {
                 setLoading(true);
                 try {
                   await fetch(`${API_URL}/audit/active`, { method: 'POST', headers });
                   alert('Atualização global iniciada!');
                 } catch { alert('Erro'); } finally { setLoading(false); }
               }}
               className="w-full border border-black py-3 text-xs font-bold uppercase"
             >
               {loading ? 'Processando...' : 'Forçar Atualização de Toda a Base'}
             </button>
          </div>
        </div>
      )}
    </section>
  );
}
