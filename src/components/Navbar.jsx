import React from 'react';
import { Smartphone, Upload, Search, BookOpen, LogOut, User } from 'lucide-react';

export default function Navbar({
  searchTerm,
  setSearchTerm,
  onOpenUpload,
  onOpenPairing,
  currentUser,
  onLogout
}) {
  return (
    <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 py-3 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent">
                منصة المذاكرة
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full">
                سحابية آمنة
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">مكتبتك التعليمية الخاصة والمتزامنة</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex-1 max-w-md mx-2 hidden md:block">
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث في ملفاتك وملاحظاتك الخاصة..."
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pr-10 pl-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {currentUser && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/60 border border-slate-700/60 rounded-xl text-xs">
              <User className="w-3.5 h-3.5 text-indigo-400" />
              <span className="font-bold text-white max-w-[100px] truncate">{currentUser.name}</span>
              <button
                onClick={onLogout}
                title="تسجيل خروج"
                className="p-1 text-slate-400 hover:text-rose-400 rounded transition"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Connect Mobile Button */}
          <button
            onClick={onOpenPairing}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800/80 hover:bg-slate-700 text-indigo-300 hover:text-white border border-indigo-500/30 rounded-xl text-xs font-semibold transition"
          >
            <Smartphone className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">ربط الموبايل</span>
          </button>

          {/* Upload Button */}
          <button
            onClick={onOpenUpload}
            className="flex items-center gap-2 px-3.5 sm:px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-indigo-600/30 transition"
          >
            <Upload className="w-4 h-4" />
            <span>رفع ملف</span>
          </button>
        </div>
      </div>
    </header>
  );
}
