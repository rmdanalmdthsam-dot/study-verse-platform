import React, { useState, useEffect } from 'react';
import { Clock, Play, Pause, RotateCcw, Award, Flame, Coffee, BookOpen } from 'lucide-react';
import { logPomodoroSession, fetchPomodoroStats } from '../utils/api';

export default function PomodoroTimer({ subjects = [], onSessionComplete }) {
  const [mode, setMode] = useState('study'); // 'study' | 'shortBreak' | 'longBreak'
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState(subjects[0]?.id || '');
  const [stats, setStats] = useState({ totalSessions: 0, totalHours: '0.0' });

  // Play synthetic pleasant beep using browser Web Audio API
  const playChime = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } catch (e) {
      console.warn('AudioContext not allowed without interaction');
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await fetchPomodoroStats();
      if (data) setStats(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    let timer = null;
    if (isRunning && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isRunning) {
      setIsRunning(false);
      playChime();

      if (mode === 'study') {
        handleCompletedSession();
      }
    }
    return () => clearInterval(timer);
  }, [isRunning, timeLeft, mode]);

  const handleCompletedSession = async () => {
    try {
      await logPomodoroSession({
        durationMinutes: 25,
        subjectId: selectedSubjectId || null
      });
      loadStats();
      if (onSessionComplete) onSessionComplete();
      alert('🎉 أحسنت! أنهيت جلسة تركيز كاملة لمدة 25 دقيقة. خذ استراحة قصيرة الآن!');
      switchMode('shortBreak');
    } catch (err) {
      console.error(err);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setIsRunning(false);
    if (newMode === 'study') setTimeLeft(25 * 60);
    else if (newMode === 'shortBreak') setTimeLeft(5 * 60);
    else if (newMode === 'longBreak') setTimeLeft(15 * 60);
  };

  const resetTimer = () => {
    setIsRunning(false);
    switchMode(mode);
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const progress = mode === 'study' ? ((25 * 60 - timeLeft) / (25 * 60)) * 100 : ((5 * 60 - timeLeft) / (5 * 60)) * 100;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
          <Clock className="w-6 h-6 text-indigo-400" />
          <span>مؤقت بومودورو للتركيز الفائق</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          25 دقيقة مذاكرة عميقة تليها 5 دقائق استراحة، للحفاظ على أقصى إنتاجية ونشاط ذهني
        </p>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex items-center justify-center gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl max-w-sm mx-auto">
        <button
          onClick={() => switchMode('study')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            mode === 'study' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:text-white'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>مذاكرة (25د)</span>
        </button>
        <button
          onClick={() => switchMode('shortBreak')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            mode === 'shortBreak' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Coffee className="w-3.5 h-3.5" />
          <span>استراحة (5د)</span>
        </button>
        <button
          onClick={() => switchMode('longBreak')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            mode === 'longBreak' ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30' : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>استراحة طويلة (15د)</span>
        </button>
      </div>

      {/* Timer Circle Card */}
      <div className="relative bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-8 flex flex-col items-center justify-center shadow-2xl text-center">
        {/* Progress bar line */}
        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-6">
          <div
            className={`h-full transition-all duration-1000 ${
              mode === 'study' ? 'bg-indigo-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Big Digits Display */}
        <div className="text-7xl sm:text-8xl font-black text-white font-mono tracking-tighter drop-shadow-md select-none my-4">
          {formattedTime}
        </div>

        {/* Select subject for study */}
        {mode === 'study' && (
          <div className="mb-6 flex items-center gap-2 text-xs">
            <span className="text-slate-400">المادة المستهدفة:</span>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-indigo-300 rounded-lg px-2.5 py-1 text-xs focus:outline-none"
            >
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsRunning(!isRunning)}
            className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold shadow-xl transition-all duration-200 cursor-pointer ${
              isRunning
                ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
                : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/40 scale-105'
            }`}
          >
            {isRunning ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1 fill-current" />}
          </button>
          <button
            onClick={resetTimer}
            className="w-12 h-12 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl flex items-center justify-center transition"
            title="إعادة التعيين"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Stats Counter */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl flex items-center gap-3">
          <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-400">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 block">جلسات التركيز المكتملة</span>
            <span className="text-xl font-black text-white">{stats.totalSessions} جلسة</span>
          </div>
        </div>

        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl flex items-center gap-3">
          <div className="p-3 bg-indigo-500/15 border border-indigo-500/30 rounded-xl text-indigo-400">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 block">إجمالي ساعات المذاكرة</span>
            <span className="text-xl font-black text-white">{stats.totalHours} ساعة</span>
          </div>
        </div>
      </div>
    </div>
  );
}
