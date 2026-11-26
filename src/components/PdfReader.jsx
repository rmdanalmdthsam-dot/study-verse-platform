import React, { useState } from 'react';
import {
  FileText,
  BookOpen,
  Star,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Trash2,
  CheckCircle2,
  Download,
  Maximize2,
  Minimize2,
  StickyNote,
  Send
} from 'lucide-react';
import { updateFile, deleteFile, createNote } from '../utils/api';
import useFileContentUrl from '../hooks/useFileContentUrl';

export default function PdfReader({ files = [], subjects = [], onFileUpdated, onFileDeleted }) {
  const [selectedPdf, setSelectedPdf] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [isSplitNoteOpen, setIsSplitNoteOpen] = useState(true);
  const pdfContentUrl = useFileContentUrl(selectedPdf);

  const pdfFiles = files.filter((f) => f.type === 'pdf');
  const handleToggleFavorite = async (file, e) => {
    e.stopPropagation();
    try {
      const updated = await updateFile(file.id, { favorite: !file.favorite });
      if (onFileUpdated) onFileUpdated(updated);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (file, e) => {
    e.stopPropagation();
    if (!confirm(`هل أنت متأكد من حذف "${file.title}"؟`)) return;
    try {
      await deleteFile(file.id);
      if (selectedPdf?.id === file.id) setSelectedPdf(null);
      if (onFileDeleted) onFileDeleted(file.id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!noteText.trim() || !selectedPdf) return;
    try {
      await createNote({
        title: `ملاحظة على: ${selectedPdf.title}`,
        content: noteText.trim(),
        subjectId: selectedPdf.subjectId,
        tags: ['pdf', selectedPdf.title]
      });
      setNoteText('');
      alert('تم حفظ الملاحظة بنجاح!');
    } catch (err) {
      console.error(err);
    }
  };

  const getSubjectName = (id) => {
    const sub = subjects.find((s) => s.id === id);
    return sub ? sub.title : 'عام';
  };

  // If a PDF is active, show the reading & study environment
  if (selectedPdf) {
    return (
      <div className="flex flex-col h-[calc(100vh-140px)] md:h-[calc(100vh-80px)] bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden animate-fadeIn">
        {/* Top Control Bar */}
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedPdf(null)}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
            >
              <ChevronRight className="w-4 h-4" />
              <span>العودة للمكتبة</span>
            </button>
            <div className="truncate max-w-xs sm:max-w-md">
              <h3 className="text-sm font-bold text-white truncate">{selectedPdf.title}</h3>
              <p className="text-[11px] text-slate-400">{getSubjectName(selectedPdf.subjectId)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={pdfContentUrl || undefined}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow"
              title="فتح الملف في نافذة مستقلة للموبايل"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>فتح كامل</span>
            </a>

            <button
              onClick={() => setIsSplitNoteOpen(!isSplitNoteOpen)}
              className={`p-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                isSplitNoteOpen ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              title="لوحة تدوين الملاحظات أثناء القراءة"
            >
              <StickyNote className="w-4 h-4" />
              <span className="hidden sm:inline">تدوين ملاحظات</span>
            </button>

            <a
              href={pdfContentUrl || undefined}
              download
              target="_blank"
              rel="noreferrer"
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
              title="تحميل الملف"
            >
              <Download className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Reader Body with optional side Notes */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main PDF Frame */}
          <div className="flex-1 h-full bg-slate-900 flex flex-col relative">
            <object
              data={pdfContentUrl || undefined}
              type="application/pdf"
              className="w-full h-full"
            >
              <iframe
                src={pdfContentUrl ? `${pdfContentUrl}#toolbar=1` : undefined}
                title={selectedPdf.title}
                className="w-full h-full border-none rounded-none"
              />
            </object>
          </div>

          {/* Side-by-side Note Taking panel */}
          {isSplitNoteOpen && (
            <div className="w-80 md:w-96 bg-slate-900/95 border-r border-slate-800 flex flex-col justify-between p-4 animate-slideIn">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                  <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs">
                    <StickyNote className="w-4 h-4" />
                    <span>ملاحظات القراءة الفورية</span>
                  </div>
                  <span className="text-[10px] bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded-full">
                    مزامنة فورية
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                  سجل الأفكار والأسئلة المهمة أثناء مطالعتك للـ PDF. سيتم حفظها في قسم الملاحظات.
                </p>

                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="اكتب فكرة أو قانون أو سؤال هنا..."
                  rows={8}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none resize-none transition"
                />
              </div>

              <div className="pt-3">
                <button
                  onClick={handleAddNote}
                  disabled={!noteText.trim()}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>حفظ الملاحظة</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // PDF Library Grid
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-rose-400" />
            <span>مكتبة ملفات الـ PDF والمراجع</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            اقرأ كتبك ومذكراتك، دوّن ملاحظاتك بجانب الصفحة، وتابع تقدمك
          </p>
        </div>
        <span className="text-xs font-semibold px-3 py-1 bg-rose-500/15 border border-rose-500/30 text-rose-300 rounded-full">
          {pdfFiles.length} ملف PDF
        </span>
      </div>

      {/* Grid */}
      {pdfFiles.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-300 mb-1">لا توجد ملفات PDF حتى الآن</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            اضغط على زر "رفع محتوى" بالأعلى لرفع كتبك وملازمك والمذكرات الدراسية.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pdfFiles.map((file) => {
            return (
              <div
                key={file.id}
                onClick={() => setSelectedPdf(file)}
                className="group relative bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 hover:border-rose-500/50 rounded-2xl p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between shadow-lg shadow-black/20"
              >
                <div>
                  {/* Top Bar in Card */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => handleToggleFavorite(file, e)}
                        className={`p-1.5 rounded-lg transition ${
                          file.favorite ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'
                        }`}
                        title="تفضيل"
                      >
                        <Star className={`w-4 h-4 ${file.favorite ? 'fill-amber-400' : ''}`} />
                      </button>
                      <button
                        onClick={(e) => handleDelete(file, e)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                        title="حذف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Title & Subject */}
                  <h3 className="font-bold text-sm text-slate-100 group-hover:text-rose-300 transition line-clamp-2 mb-1">
                    {file.title}
                  </h3>
                  <span className="text-[11px] text-slate-400 block mb-3 font-medium">
                    {getSubjectName(file.subjectId)}
                  </span>

                  {/* Tags */}
                  {file.tags && file.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {file.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded-md text-[10px]"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer Progress & Size */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span className="text-[11px] font-mono">
                    {file.size ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : 'مرفق'}
                  </span>
                  <span className="text-rose-400 group-hover:translate-x-1 transition text-xs font-bold flex items-center gap-1">
                    فتح للقراءة
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
