import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Eye, EyeOff, X } from 'lucide-react';
import { useAuth } from './AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '/api';

function InputField({ label, type = 'text', value, onChange, placeholder, toggle }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={toggle ? (show ? 'text' : 'password') : type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all pr-10"
        />
        {toggle && (
          <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            {show ? <EyeOff size={15}/> : <Eye size={15}/>}
          </button>
        )}
      </div>
    </div>
  );
}

export function AuthModal({ open, onClose }) {
  const { login } = useAuth();
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = () => { setEmail(''); setPassword(''); setBirthDate(''); setError(''); };

  async function handleLogin(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error);
      login(data.token, data.user);
      onClose();
    } catch { setError('Erro de conexão.'); }
    finally { setLoading(false); }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, birthDate })
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error);
      login(data.token, data.user);
      onClose();
    } catch { setError('Erro de conexão.'); }
    finally { setLoading(false); }
  }

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-md p-4"
        onClick={onClose}
      >
        <motion.div initial={{ scale: 0.92, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
          className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-slate-950 p-8 text-center relative">
            <button onClick={onClose} className="absolute top-4 right-4 text-white/40 hover:text-white"><X size={18}/></button>
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Lock className="text-white" size={22}/>
            </div>
            <h3 className="text-xl font-black text-white">Buscador<span className="text-blue-400">.ai</span></h3>
            <p className="text-[11px] text-white/50 mt-1 uppercase tracking-widest font-bold">
              {tab === 'login' ? 'Acesse sua conta' : 'Criar nova conta'}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-100">
            {['login', 'register'].map(t => (
              <button key={t} onClick={() => { setTab(t); reset(); }}
                className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-colors ${tab === t ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-700'}`}>
                {t === 'login' ? 'Entrar' : 'Cadastrar'}
              </button>
            ))}
          </div>

          <div className="p-8 space-y-4">
            {/* Google placeholder */}
            <button disabled className="w-full flex items-center justify-center gap-3 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-400 cursor-not-allowed bg-slate-50">
              <span className="w-4 h-4 rounded-full border-2 border-slate-300"></span> Continuar com Google <span className="text-[9px] bg-slate-200 px-2 py-0.5 rounded-full">Em breve</span>
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-100"/>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ou</span>
              <div className="flex-1 h-px bg-slate-100"/>
            </div>

            <form onSubmit={tab === 'login' ? handleLogin : handleRegister} className="space-y-4">
              <InputField label="Login / E-mail" type="text" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com ou superadmin" />
              <InputField label="Senha" toggle value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
              {tab === 'register' && (
                <InputField label="Data de Nascimento" type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} />
              )}

              {error && <p className="text-xs text-red-500 font-bold bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

              <button type="submit" disabled={loading}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-black rounded-xl transition-all shadow-lg shadow-blue-500/20 text-sm">
                {loading ? 'Aguarde...' : tab === 'login' ? 'Entrar' : 'Criar conta'}
              </button>
            </form>

            <p className="text-center text-xs text-slate-400 font-medium">
              {tab === 'login' ? (
                <>Não tem conta?{' '}
                  <button type="button" onClick={() => { setTab('register'); reset(); }} className="text-blue-600 font-bold hover:underline">Cadastre-se</button>
                </>
              ) : (
                <>Já tem conta?{' '}
                  <button type="button" onClick={() => { setTab('login'); reset(); }} className="text-blue-600 font-bold hover:underline">Entrar</button>
                </>
              )}
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
