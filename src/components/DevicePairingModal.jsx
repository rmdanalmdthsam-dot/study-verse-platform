import React, { useState } from 'react';
import { Smartphone, QrCode, Wifi, Cloud, Check, Copy, X } from 'lucide-react';

export default function DevicePairingModal({ isOpen, onClose, syncInfo }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const phoneUrl = syncInfo?.phoneUrl || '';
  const qrCode = syncInfo?.qrCodeDataUrl;
  const localIp = syncInfo?.localIp || '192.168.x.x';

  const handleCopy = () => {
    if (!phoneUrl) return;
    navigator.clipboard.writeText(phoneUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-900 border border-indigo-500/30 rounded-2xl shadow-2xl p-6 text-slate-100 overflow-hidden">
        {/* Background glow */}
        <div className="absolute -top-24 -left-24 w-60 h-60 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/20 border border-indigo-500/40 rounded-xl text-indigo-400">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">ربط الهاتف بالمنصة (مزامنة فورية)</h3>
              <p className="text-xs text-slate-400">افتح منصة مذاكرتك على هاتفك ولابتوبك معاً</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-5 space-y-5">
          {/* QR Code Container */}
          <div className="flex flex-col items-center justify-center p-4 bg-slate-950/80 border border-slate-800 rounded-xl text-center">
            {qrCode ? (
              <div className="p-2 bg-white rounded-xl shadow-lg shadow-indigo-500/10 mb-3">
                <img src={qrCode} alt="Phone QR Code" className="w-48 h-48 rounded-lg object-contain" />
              </div>
            ) : (
              <div className="w-48 h-48 p-4 bg-slate-800 rounded-xl flex flex-col items-center justify-center gap-3 text-slate-300 mb-3">
                <QrCode className="w-12 h-12 text-slate-500" />
                <span className="text-xs leading-relaxed">{syncInfo?.error || 'جارٍ تجهيز رمز الربط الآمن'}</span>
              </div>
            )}
            <p className="text-sm font-semibold text-indigo-300 flex items-center gap-1.5">
              <QrCode className="w-4 h-4" /> {phoneUrl ? 'امسح الكود بكاميرا الموبايل لفتح المنصة فوراً' : 'يتطلب الربط الآمن فتح المنصة عبر HTTPS'}
            </p>
          </div>

          {/* Direct URL Box */}
          <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/60">
            <label className="text-xs font-medium text-slate-400 block mb-1.5">
              أو اكتب هذا الرابط مباشرة في متصفح هاتفك (سفاري أو كروم):
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={phoneUrl}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-indigo-300 font-mono focus:outline-none"
              />
              <button
                onClick={handleCopy}
                disabled={!phoneUrl}
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition shrink-0"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'تم النسخ' : 'نسخ'}
              </button>
            </div>
          </div>

          {/* Steps & Features */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl flex items-start gap-2.5">
              <Wifi className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-200 block mb-0.5">شبكة Wi-Fi واحدة</span>
                <span className="text-slate-400 leading-relaxed">
                  تأكد أن هاتفك واللابتوب متصلان بنفس شبكة الواي فاي للربط المباشر.
                </span>
              </div>
            </div>

            <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl flex items-start gap-2.5">
              <Cloud className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-200 block mb-0.5">تطبيق PWA أصلي</span>
                <span className="text-slate-400 leading-relaxed">
                  في هاتفك، اختر "إضافة إلى الشاشة الرئيسية" ليتحول لتطبيق مستقل!
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-mono">IP: {localIp}</span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
