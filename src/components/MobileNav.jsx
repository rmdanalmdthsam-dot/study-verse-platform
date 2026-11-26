import React from 'react';
import { Layers, FileText, Video, CheckSquare, Clock, Smartphone } from 'lucide-react';

export default function MobileNav({ activeTab, setActiveTab, onOpenPairing }) {
  const items = [
    { id: 'all', label: 'الرئيسية', icon: Layers },
    { id: 'pdf', label: 'PDF', icon: FileText },
    { id: 'video', label: 'المحاضرات', icon: Video },
    { id: 'flashcards', label: 'البطاقات', icon: CheckSquare },
    { id: 'pomodoro', label: 'التركيز', icon: Clock },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800/90 px-2 py-2 flex items-center justify-around">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${
              isActive ? 'text-indigo-400 font-bold scale-105' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px]">{item.label}</span>
          </button>
        );
      })}
      
      <button
        onClick={onOpenPairing}
        className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-purple-400 hover:text-purple-300 transition"
      >
        <Smartphone className="w-5 h-5 animate-pulse" />
        <span className="text-[10px]">الربط</span>
      </button>
    </div>
  );
}
