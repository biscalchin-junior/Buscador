import React, { useState, useEffect } from 'react';
import { Users, Search, BarChart3, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { useAuth } from './AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function SuperAdminPanel() {
  const { token } = useAuth();
  const [tab, setTab] = useState('searches');
  const [searches, setSearches] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

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

  useEffect(() => {
    if (tab === 'searches') fetchSearches();
    else fetchUsers();
  }, [tab]);

  const TABS = [
    { id: 'searches', label: 'Pesquisas Públicas', icon: <Search size={14}/> },
    { id: 'users', label: 'Usuários', icon: <Users size={14}/> },
  ];

  return (
    <section className="py-16 section-container">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-950">Painel Superadmin</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Inteligência da Plataforma</p>
        </div>
        <button onClick={() => tab === 'searches' ? fetchSearches() : fetchUsers()} className="p-2.5 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all ${tab === t.id ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'searches' && (
        <div className="glass-card overflow-hidden border-slate-200/50">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-black text-slate-950 text-sm">Pesquisas Registradas</h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase">{searches.length} registros</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/70">
                  {['Termo', 'Usuário', 'Item Encontrado', 'Preço', 'Loja', 'Data', 'Contagem'].map(h => (
                    <th key={h} className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {searches.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3 text-xs font-bold text-slate-800">{s.term}</td>
                    <td className="px-5 py-3 text-xs text-slate-500">{s.user_label}</td>
                    <td className="px-5 py-3 text-xs text-slate-600 max-w-[200px] truncate">{s.item_title || '—'}</td>
                    <td className="px-5 py-3 text-xs font-black text-emerald-600">{s.item_price ? `R$ ${s.item_price.toFixed(2)}` : '—'}</td>
                    <td className="px-5 py-3 text-xs text-slate-500">{s.item_store || '—'}</td>
                    <td className="px-5 py-3 text-xs text-slate-400">{new Date(s.searched_at).toLocaleString('pt-BR')}</td>
                    <td className="px-5 py-3 text-xs font-black text-blue-600">{s.search_count}x</td>
                  </tr>
                ))}
                {searches.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-10 text-sm text-slate-400 font-medium">Nenhuma pesquisa registrada ainda.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="glass-card overflow-hidden border-slate-200/50">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-black text-slate-950 text-sm">Usuários Cadastrados</h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase">{users.length} usuários</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/70">
                  {['ID', 'E-mail', 'Perfil', 'Nascimento', 'Cadastrado em', 'Status'].map(h => (
                    <th key={h} className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3 text-xs text-slate-400">#{u.id}</td>
                    <td className="px-5 py-3 text-xs font-bold text-slate-800">{u.email}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${u.role === 'SUPERADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">{u.birth_date || '—'}</td>
                    <td className="px-5 py-3 text-xs text-slate-400">{new Date(u.created_at).toLocaleDateString('pt-BR')}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {u.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-10 text-sm text-slate-400 font-medium">Nenhum usuário cadastrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
