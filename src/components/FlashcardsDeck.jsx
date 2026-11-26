import React, { useState } from 'react';
import { CheckSquare, Plus, RotateCw, Check, X, Sparkles, ChevronRight, ChevronLeft, Trash2 } from 'lucide-react';
import { createFlashcard, reviewFlashcard, deleteFlashcard } from '../utils/api';

export default function FlashcardsDeck({ flashcards = [], subjects = [], onCardCreated, onCardReviewed, onCardDeleted }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || '');

  const activeCard = flashcards[currentIndex];

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % flashcards.length);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + flashcards.length) % flashcards.length);
  };

  const handleReview = async (rating) => {
    if (!activeCard) return;
    try {
      const updated = await reviewFlashcard(activeCard.id, rating);
      if (onCardReviewed) onCardReviewed(updated);
      handleNext();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;
    try {
      const created = await createFlashcard({
        question: question.trim(),
        answer: answer.trim(),
        subjectId: subjectId || subjects[0]?.id || ''
      });
      if (onCardCreated) onCardCreated(created);
      setQuestion('');
      setAnswer('');
      setIsCreating(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('هل تريد حذف هذه البطاقة؟')) return;
    try {
      await deleteFlashcard(id);
      if (onCardDeleted) onCardDeleted(id);
      setIsFlipped(false);
      setCurrentIndex(0);
    } catch (err) {
      console.error(err);
    }
  };

  const getSubjectName = (id) => {
    const sub = subjects.find((s) => s.id === id);
    return sub ? sub.title : 'عام';
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <CheckSquare className="w-6 h-6 text-purple-400" />
            <span>بطاقات الاستذكار الفعّال (Flashcards)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            نظام التكرار المتباعد لتثبيت المعلومات والتعاريف والقوانين في الذاكرة طويلة المدى
          </p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-purple-600/25"
        >
          <Plus className="w-4 h-4" />
          <span>بطاقة جديدة</span>
        </button>
      </div>

      {/* Creation Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="font-bold text-white text-base">إضافة بطاقة استذكار جديدة</h3>
              <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">المادة</label>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                >
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">السؤال أو المفهوم (الوجه الأمامي)</label>
                <textarea
                  required
                  rows={3}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="مثال: ما هو تعريف السرعة اللحظية؟"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">الإجابة النموذجية (الوجه الخلفي)</label>
                <textarea
                  required
                  rows={3}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="مثال: مشتقة دالة المسافة بالنسبة للزمن عند لحظة معينة."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-600/30"
                >
                  حفظ البطاقة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Flashcard Interactive Area */}
      {flashcards.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl">
          <CheckSquare className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-300 mb-1">لا توجد بطاقات حتى الآن</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            أنشئ بطاقات لاختبار نفسك ومراجعة التعريفات والقوانين المهمة.
          </p>
        </div>
      ) : activeCard ? (
        <div className="space-y-4">
          {/* Progress & Card Index */}
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>
              البطاقة <strong className="text-white font-mono">{currentIndex + 1}</strong> من{' '}
              <strong className="text-white font-mono">{flashcards.length}</strong>
            </span>
            <span className="px-2.5 py-0.5 bg-purple-500/10 text-purple-300 border border-purple-500/20 rounded-full font-bold">
              {getSubjectName(activeCard.subjectId)}
            </span>
          </div>

          {/* 3D Flip Card Container */}
          <div
            onClick={() => setIsFlipped(!isFlipped)}
            className="w-full min-h-[320px] bg-gradient-to-br from-slate-900 to-slate-950 border border-purple-500/30 hover:border-purple-500/60 rounded-3xl p-8 flex flex-col justify-between cursor-pointer transition-all duration-300 shadow-2xl relative select-none group"
          >
            {/* Top Indicator */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-purple-400 font-bold flex items-center gap-1.5">
                <RotateCw className="w-3.5 h-3.5 group-hover:rotate-180 transition duration-500" />
                {isFlipped ? 'الوجه الخلفي (الإجابة)' : 'الوجه الأمامي (السؤال)'}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(activeCard.id);
                }}
                className="text-slate-500 hover:text-rose-400 p-1 rounded-lg"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Content text */}
            <div className="my-auto text-center py-6">
              {isFlipped ? (
                <div className="animate-fadeIn">
                  <p className="text-xl sm:text-2xl font-bold text-emerald-300 leading-relaxed">
                    {activeCard.answer}
                  </p>
                </div>
              ) : (
                <div className="animate-fadeIn">
                  <p className="text-xl sm:text-2xl font-bold text-white leading-relaxed">
                    {activeCard.question}
                  </p>
                  <span className="text-xs text-slate-500 mt-4 block">
                    انقر في أي مكان لقلب البطاقة ومعرفة الإجابة
                  </span>
                </div>
              )}
            </div>

            {/* Bottom info */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-4 border-t border-slate-800/80">
              <span>مرات المراجعة: {activeCard.reviewCount || 0}</span>
              <span className="text-purple-400 font-medium">انقر للقلب</span>
            </div>
          </div>

          {/* Spaced repetition evaluation buttons */}
          {isFlipped && (
            <div className="grid grid-cols-3 gap-3 animate-slideIn">
              <button
                onClick={() => handleReview('hard')}
                className="py-3 px-4 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 rounded-2xl text-xs font-bold transition flex flex-col items-center gap-1"
              >
                <span>صعب 🔴</span>
                <span className="text-[10px] text-rose-400/80">مراجعة غداً</span>
              </button>
              <button
                onClick={() => handleReview('good')}
                className="py-3 px-4 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 rounded-2xl text-xs font-bold transition flex flex-col items-center gap-1"
              >
                <span>جيد 🟡</span>
                <span className="text-[10px] text-amber-400/80">مراجعة بعد يومين</span>
              </button>
              <button
                onClick={() => handleReview('easy')}
                className="py-3 px-4 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 rounded-2xl text-xs font-bold transition flex flex-col items-center gap-1"
              >
                <span>سهل ومتقن 🟢</span>
                <span className="text-[10px] text-emerald-400/80">مراجعة بعد 4 أيام</span>
              </button>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={handlePrev}
              className="px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <ChevronRight className="w-4 h-4" />
              <span>البطاقة السابقة</span>
            </button>
            <button
              onClick={handleNext}
              className="px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <span>البطاقة التالية</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
