import React, { useState } from 'react';
import { BookOpen, Plus, Trash2, Edit3, Save, X, Tag, Calendar } from 'lucide-react';
import { createNote, updateNote, deleteNote } from '../utils/api';

export default function NotesEditor({ notes = [], subjects = [], onNoteCreated, onNoteUpdated, onNoteDeleted }) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedNote, setSelectedNote] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || '');
  const [tags, setTags] = useState('');

  const handleOpenNew = () => {
    setSelectedNote(null);
    setTitle('');
    setContent('');
    setSubjectId(subjects[0]?.id || '');
    setTags('');
    setIsEditing(true);
  };

  const handleOpenEdit = (note) => {
    setSelectedNote(note);
    setTitle(note.title);
    setContent(note.content);
    setSubjectId(note.subjectId);
    setTags((note.tags || []).join(', '));
    setIsEditing(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const parsedTags = tags.split(',').map((t) => t.trim()).filter(Boolean);

    try {
      if (selectedNote) {
        const updated = await updateNote(selectedNote.id, {
          title: title.trim(),
          content: content.trim(),
          subjectId,
          tags: parsedTags
        });
        if (onNoteUpdated) onNoteUpdated(updated);
      } else {
        const created = await createNote({
          title: title.trim(),
          content: content.trim(),
          subjectId: subjectId || subjects[0]?.id || '',
          tags: parsedTags
        });
        if (onNoteCreated) onNoteCreated(created);
      }
      setIsEditing(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!confirm('هل تريد حذف هذه الملاحظة؟')) return;
    try {
      await deleteNote(id);
      if (selectedNote?.id === id) setIsEditing(false);
      if (onNoteDeleted) onNoteDeleted(id);
    } catch (err) {
      console.error(err);
    }
  };

  const getSubjectName = (id) => {
    const sub = subjects.find((s) => s.id === id);
    return sub ? sub.title : 'عام';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <BookOpen className="w-6 h-6 text-emerald-400" />
            <span>الملاحظات والملخصات الذكية</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            دوّن أفكارك، ملخصات القوانين، وملاحظات المراجعة النهائية
          </p>
        </div>
        <button
          onClick={handleOpenNew}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-600/25"
        >
          <Plus className="w-4 h-4" />
          <span>ملاحظة جديدة</span>
        </button>
      </div>

      {/* Editor Modal / Panel */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-100 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">
                {selectedNote ? 'تعديل الملاحظة' : 'إنشاء ملاحظة جديدة'}
              </h3>
              <button
                onClick={() => setIsEditing(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-4 flex-1 flex flex-col overflow-hidden">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">عنوان الملاحظة</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="مثال: قوانين الحركة والسرعة النسبية"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">المادة</label>
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    {subjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">الوسوم (مفصولة بفاصلة)</label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="مثال: مهم، امتحان، مراجعة"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex-1 flex flex-col min-h-[220px]">
                <label className="text-xs text-slate-400 block mb-1">محتوى الملاحظة</label>
                <textarea
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="اكتب الشرح، النقاط الهامة، المعادلات..."
                  className="w-full flex-1 bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/30"
                >
                  <Save className="w-4 h-4" />
                  <span>حفظ الملاحظة</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Notes Grid */}
      {notes.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl">
          <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-300 mb-1">لا توجد ملاحظات بعد</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            اضغط على "ملاحظة جديدة" لتدوين ملخصاتك وقوانين المادة.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {notes.map((note) => (
            <div
              key={note.id}
              onClick={() => handleOpenEdit(note)}
              className="group bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-5 cursor-pointer shadow-lg shadow-black/20 transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg">
                    {getSubjectName(note.subjectId)}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEdit(note);
                      }}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(note.id, e)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition mb-2">
                  {note.title}
                </h3>

                <p className="text-xs text-slate-400 leading-relaxed line-clamp-4 whitespace-pre-line font-sans mb-3">
                  {note.content}
                </p>
              </div>

              {note.tags && note.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-3 border-t border-slate-800/80">
                  {note.tags.map((t, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 bg-slate-800/80 text-slate-400 rounded text-[10px]"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
