import React from 'react';
import {
  FileText,
  Video,
  Image as ImageIcon,
  BookOpen,
  CheckSquare,
  Sparkles,
  ArrowRight,
  Clock,
  HardDrive,
  Upload,
  Smartphone,
  ChevronLeft
} from 'lucide-react';

export default function DashboardOverview({
  files = [],
  notes = [],
  flashcards = [],
  subjects = [],
  setActiveTab,
  onOpenUpload,
  onOpenPairing
}) {
  const pdfs = files.filter((f) => f.type === 'pdf');
  const videos = files.filter((f) => f.type === 'video');
  const images = files.filter((f) => f.type === 'image');

  const getSubjectName = (id) => {
    const sub = subjects.find((s) => s.id === id);
    return sub ? sub.title : 'عام';
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-900/60 via-purple-900/40 to-slate-900/80 border border-indigo-500/20 rounded-3xl p-6 sm:p-8 shadow-2xl">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 border border-indigo-500/40 rounded-full text-indigo-300 text-xs font-bold mb-3">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>نظام المذاكرة والمزامنة السحابية المتكامل</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-snug">
            أهلاً بك في منصتك السحابية الشاملة للمذاكرة
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
            كل مذكراتك وكتب الـ PDF، فيديوهات المحاضرات، صور السبورات، والبطاقات التفاعلية في مكان واحد،
            متزامنة لحظة بلحظة بين اللابتوب والتليفون.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenUpload}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 transition flex items-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>رفع PDF أو محاضرة أو صورة</span>
            </button>
            <button
              onClick={onOpenPairing}
              className="px-5 py-2.5 bg-slate-800/80 hover:bg-slate-700/80 text-indigo-200 border border-indigo-500/30 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer"
            >
              <Smartphone className="w-4 h-4 text-indigo-400" />
              <span>ربط الموبايل بكود QR</span>
            </button>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute top-0 left-0 w-80 h-80 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div
          onClick={() => setActiveTab('pdf')}
          className="p-4 bg-slate-900/70 hover:bg-slate-800/80 border border-slate-800 hover:border-rose-500/40 rounded-2xl cursor-pointer transition flex items-center justify-between"
        >
          <div>
            <span className="text-xs text-slate-400 block mb-1">ملفات PDF</span>
            <span className="text-2xl font-black text-white">{pdfs.length}</span>
          </div>
          <div className="p-3 bg-rose-500/10 rounded-xl text-rose-400">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div
          onClick={() => setActiveTab('video')}
          className="p-4 bg-slate-900/70 hover:bg-slate-800/80 border border-slate-800 hover:border-amber-500/40 rounded-2xl cursor-pointer transition flex items-center justify-between"
        >
          <div>
            <span className="text-xs text-slate-400 block mb-1">محاضرات فيديو</span>
            <span className="text-2xl font-black text-white">{videos.length}</span>
          </div>
          <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400">
            <Video className="w-5 h-5" />
          </div>
        </div>

        <div
          onClick={() => setActiveTab('flashcards')}
          className="p-4 bg-slate-900/70 hover:bg-slate-800/80 border border-slate-800 hover:border-purple-500/40 rounded-2xl cursor-pointer transition flex items-center justify-between"
        >
          <div>
            <span className="text-xs text-slate-400 block mb-1">بطاقات استذكار</span>
            <span className="text-2xl font-black text-white">{flashcards.length}</span>
          </div>
          <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400">
            <CheckSquare className="w-5 h-5" />
          </div>
        </div>

        <div
          onClick={() => setActiveTab('notes')}
          className="p-4 bg-slate-900/70 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/40 rounded-2xl cursor-pointer transition flex items-center justify-between"
        >
          <div>
            <span className="text-xs text-slate-400 block mb-1">الملاحظات</span>
            <span className="text-2xl font-black text-white">{notes.length}</span>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
            <BookOpen className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Quick Sections: PDFs & Videos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PDF Highlights */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-rose-400" />
              <h3 className="font-bold text-sm text-white">أحدث مذكرات وكتب الـ PDF</h3>
            </div>
            <button
              onClick={() => setActiveTab('pdf')}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
            >
              <span>عرض الكل</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {pdfs.slice(0, 3).map((f) => (
              <div
                key={f.id}
                onClick={() => setActiveTab('pdf')}
                className="p-3 bg-slate-950/60 hover:bg-slate-800/60 border border-slate-800/80 rounded-xl flex items-center justify-between cursor-pointer transition"
              >
                <div className="truncate max-w-xs">
                  <h4 className="text-xs font-bold text-slate-100 truncate">{f.title}</h4>
                  <span className="text-[10px] text-slate-400">{getSubjectName(f.subjectId)}</span>
                </div>
                <span className="text-[11px] text-rose-400 font-semibold shrink-0">قراءة</span>
              </div>
            ))}
          </div>
        </div>

        {/* Video Highlights */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Video className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold text-sm text-white">محاضرات الفيديو وشروحات الدروس</h3>
            </div>
            <button
              onClick={() => setActiveTab('video')}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
            >
              <span>عرض الكل</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {videos.slice(0, 3).map((f) => (
              <div
                key={f.id}
                onClick={() => setActiveTab('video')}
                className="p-3 bg-slate-950/60 hover:bg-slate-800/60 border border-slate-800/80 rounded-xl flex items-center justify-between cursor-pointer transition"
              >
                <div className="truncate max-w-xs">
                  <h4 className="text-xs font-bold text-slate-100 truncate">{f.title}</h4>
                  <span className="text-[10px] text-slate-400">{getSubjectName(f.subjectId)}</span>
                </div>
                <span className="text-[11px] text-amber-400 font-semibold shrink-0">مشاهدة</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
