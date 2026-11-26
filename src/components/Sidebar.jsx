import React, { useState } from 'react';
import {
  Layers,
  FileText,
  Video,
  Image as ImageIcon,
  BookOpen,
  CheckSquare,
  Clock,
  Plus,
  Trash2,
  FolderPlus,
  Atom,
  Calculator,
  Code,
  HardDrive
} from 'lucide-react';
import { createSubject } from '../utils/api';

export default function Sidebar({
  activeTab,
  setActiveTab,
  subjects = [],
  selectedSubjectId,
  setSelectedSubjectId,
  onSubjectCreated
}) {
  const [isAddingSubject, setIsAddingSubject] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCode, setNewCode] = useState('');

  const menuItems = [
    { id: 'all', label: 'المكتبة الشاملة', icon: Layers, badge: null },
    { id: 'pdf', label: 'ملفات الـ PDF', icon: FileText, color: 'text-rose-400' },
    { id: 'video', label: 'محاضرات الفيديو', icon: Video, color: 'text-amber-400' },
    { id: 'image', label: 'السبورات والصور', icon: ImageIcon, color: 'text-sky-400' },
    { id: 'notes', label: 'الملاحظات الذكية', icon: BookOpen, color: 'text-emerald-400' },
    { id: 'flashcards', label: 'بطاقات الاستذكار', icon: CheckSquare, color: 'text-purple-400' },
    { id: 'pomodoro', label: 'مؤقت التركيز (بومودورو)', icon: Clock, color: 'text-indigo-400' }
  ];

  const handleAddSubject = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      const created = await createSubject({
        title: newTitle.trim(),
        code: newCode.trim() || `SUB-${Math.floor(Math.random() * 900 + 100)}`
      });
      if (onSubjectCreated) onSubjectCreated(created);
      setNewTitle('');
      setNewCode('');
      setIsAddingSubject(false);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <aside className="w-64 shrink-0 bg-slate-900/60 border-l border-slate-800/80 p-4 flex flex-col justify-between hidden md:flex min-h-[calc(100vh-65px)]">
      <div className="space-y-6">
        {/* Navigation Categories */}
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 block mb-2">
            الأقسام الرئيسية
          </span>
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                      : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : item.color || 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Subjects & Modules */}
        <div>
          <div className="flex items-center justify-between px-3 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              المواد والمساقات
            </span>
            <button
              onClick={() => setIsAddingSubject(!isAddingSubject)}
              className="p-1 text-indigo-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
              title="إضافة مادة جديدة"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
          </div>

          {/* Quick add form */}
          {isAddingSubject && (
            <form onSubmit={handleAddSubject} className="p-2.5 mb-2 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
              <input
                type="text"
                required
                placeholder="اسم المادة (مثال: كيمياء)"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder="رمز (CHEM)"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-500"
                >
                  حفظ
                </button>
              </div>
            </form>
          )}

          <div className="space-y-1">
            <button
              onClick={() => setSelectedSubjectId('')}
              className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs transition ${
                selectedSubjectId === ''
                  ? 'bg-slate-800 text-indigo-300 font-bold border border-indigo-500/30'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <span>جميع المواد</span>
              <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded-full text-slate-400">
                {subjects.length}
              </span>
            </button>

            {subjects.map((sub) => {
              const isSelected = selectedSubjectId === sub.id;
              return (
                <button
                  key={sub.id}
                  onClick={() => setSelectedSubjectId(sub.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs transition ${
                    isSelected
                      ? 'bg-slate-800 text-indigo-300 font-bold border border-indigo-500/30'
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                    <span className="truncate">{sub.title}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono shrink-0">
                    {sub.code}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Cloud & Local Storage Info Footer */}
      <div className="pt-4 border-t border-slate-800/80">
        <div className="p-3 bg-slate-950/60 border border-slate-800/70 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
              <span>السحابة والمزامنة</span>
            </div>
            <span className="text-emerald-400 text-[10px] font-bold">متصل</span>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            بياناتك ومحاضراتك محفوظة ومتاحة فورياً للابتوب والتليفون.
          </p>
        </div>
      </div>
    </aside>
  );
}
