import React, { useState } from 'react';
import { User, Lock, Mail, BookOpen, AlertCircle, ArrowLeft } from 'lucide-react';
import { login, register } from '../utils/api';

export default function AuthModal({ onLoginSuccess }) {
  const [isLoginTab, setIsLoginTab] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let res;
      if (isLoginTab) {
        res = await login(email, password);
      } else {
        res = await register(name, email, password);
      }
      setLoading(false);
      if (onLoginSuccess) onLoginSuccess(res.user);
    } catch (err) {
      setLoading(false);
      setError(err.message || 'حدث خطأ أثناء المحاولة');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
      <div className="relative w-full max-w-md bg-slate-900 border border-indigo-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-100">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
            <BookOpen className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-black text-white">منصة المذاكرة السحابية</h2>
          <p className="text-xs text-slate-400 mt-1">
            {isLoginTab
              ? 'سجل دخولك للوصول إلى ملفاتك ومذكراتك الخاصة'
              : 'أنشئ حسابك الخاص المستقل، لحفظ بياناتك في سحابة آمنة'}
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800 mb-6">
          <button
            type="button"
            onClick={() => { setIsLoginTab(true); setError(null); }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
              isLoginTab ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            تسجيل الدخول
          </button>
          <button
            type="button"
            onClick={() => { setIsLoginTab(false); setError(null); }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
              !isLoginTab ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            حساب جديد
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLoginTab && (
            <div>
              <label className="text-xs text-slate-300 block mb-1">الاسم الكامل</label>
              <div className="relative">
                <User className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: أحمد مصطفى"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-slate-300 block mb-1">البريد الإلكتروني</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-300 block mb-1">كلمة المرور</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 mt-2"
          >
            <span>{loading ? 'جارٍ التحميل...' : isLoginTab ? 'دخول إلى حسابي' : 'إنشاء حساب وبدء المذاكرة'}</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-800 text-center">
          <p className="text-[11px] text-slate-400">
            بياناتك ومذكراتك معزولة تماماً ومشفرة ولا يمكن لأي مستخدم آخر رؤيتها.
          </p>
        </div>
      </div>
    </div>
  );
}
