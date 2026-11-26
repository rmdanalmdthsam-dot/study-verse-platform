import React, { useState, useRef } from 'react';
import {
  Video,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Clock,
  Plus,
  Star,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Volume2,
  VolumeX,
  Bookmark,
  Share2
} from 'lucide-react';
import { updateFile, deleteFile } from '../utils/api';
import useFileContentUrl from '../hooks/useFileContentUrl';

export default function VideoPlayer({ files = [], subjects = [], onFileUpdated, onFileDeleted }) {
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [timestampNote, setTimestampNote] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const videoContentUrl = useFileContentUrl(selectedVideo);

  const videoRef = useRef(null);
  const videoFiles = files.filter((f) => f.type === 'video');

  const speeds = [0.75, 1, 1.25, 1.5, 2];

  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const jumpToSecond = (sec) => {
    if (videoRef.current) {
      videoRef.current.currentTime = sec;
      videoRef.current.play();
    }
  };

  const formatSeconds = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleAddTimestampNote = async (e) => {
    e.preventDefault();
    if (!timestampNote.trim() || !selectedVideo) return;

    const currentSec = Math.floor(currentTime);
    const updatedNotes = [
      ...(selectedVideo.timestampNotes || []),
      { time: currentSec, text: timestampNote.trim() }
    ];

    try {
      const updated = await updateFile(selectedVideo.id, {
        timestampNotes: updatedNotes
      });
      setSelectedVideo(updated);
      if (onFileUpdated) onFileUpdated(updated);
      setTimestampNote('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (file, e) => {
    e.stopPropagation();
    if (!confirm(`هل أنت متأكد من حذف فيديو "${file.title}"؟`)) return;
    try {
      await deleteFile(file.id);
      if (selectedVideo?.id === file.id) setSelectedVideo(null);
      if (onFileDeleted) onFileDeleted(file.id);
    } catch (err) {
      console.error(err);
    }
  };

  const getSubjectName = (id) => {
    const sub = subjects.find((s) => s.id === id);
    return sub ? sub.title : 'عام';
  };

  if (selectedVideo) {
    return (
      <div className="flex flex-col h-[calc(100vh-140px)] md:h-[calc(100vh-80px)] bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedVideo(null)}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
            >
              <ChevronRight className="w-4 h-4" />
              <span>العودة للمحاضرات</span>
            </button>
            <div className="truncate max-w-xs sm:max-w-md">
              <h3 className="text-sm font-bold text-white truncate">{selectedVideo.title}</h3>
              <p className="text-[11px] text-slate-400">{getSubjectName(selectedVideo.subjectId)}</p>
            </div>
          </div>

          {/* Speed controls */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            {speeds.map((s) => (
              <button
                key={s}
                onClick={() => handleSpeedChange(s)}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition ${
                  playbackSpeed === s ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Video & Notes split */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Main Player */}
          <div className="flex-1 bg-black flex flex-col items-center justify-center relative">
            <video
              ref={videoRef}
              crossOrigin="use-credentials"
              src={videoContentUrl || undefined}
              controls
              onTimeUpdate={handleTimeUpdate}
              className="w-full h-full max-h-[70vh] object-contain"
            />
          </div>

          {/* Timestamped Notes Sidebar */}
          <div className="w-full lg:w-96 bg-slate-900 border-t lg:border-t-0 lg:border-r border-slate-800 flex flex-col justify-between p-4 overflow-y-auto">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                  <Bookmark className="w-4 h-4" />
                  <span>علامات وملاحظات الفيديو</span>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  الوقت الحالي: {formatSeconds(currentTime)}
                </span>
              </div>

              {/* Add Note at current second */}
              <form onSubmit={handleAddTimestampNote} className="mb-4 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={timestampNote}
                    onChange={(e) => setTimestampNote(e.target.value)}
                    placeholder="اكتب نقطة شرح هامة عند هذا التوقيت..."
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>تثبيت</span>
                  </button>
                </div>
              </form>

              {/* Timestamp List */}
              <div className="space-y-2">
                {(!selectedVideo.timestampNotes || selectedVideo.timestampNotes.length === 0) ? (
                  <p className="text-xs text-slate-500 text-center py-6">
                    لا توجد ملاحظات زمنية بعد. يمكنك إضافة ملاحظة عند أي دقيقة في الفيديو للرجوع لها بنقرة واحدة!
                  </p>
                ) : (
                  selectedVideo.timestampNotes.map((note, idx) => (
                    <div
                      key={idx}
                      onClick={() => jumpToSecond(note.time)}
                      className="group p-2.5 bg-slate-950/70 hover:bg-amber-950/20 border border-slate-800 hover:border-amber-500/40 rounded-xl cursor-pointer transition flex items-start gap-2.5"
                    >
                      <span className="px-2 py-0.5 bg-amber-500/15 text-amber-400 border border-amber-500/30 font-mono text-[11px] font-bold rounded-md shrink-0">
                        {formatSeconds(note.time)}
                      </span>
                      <p className="text-xs text-slate-200 group-hover:text-white leading-relaxed">
                        {note.text}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Video className="w-6 h-6 text-amber-400" />
            <span>استوديو محاضرات الفيديو</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            شاهد محاضراتك، تحكّم بسرعة العرض، ودوّن علامات زمنية للوصول السريع
          </p>
        </div>
        <span className="text-xs font-semibold px-3 py-1 bg-amber-500/15 border border-amber-500/30 text-amber-300 rounded-full">
          {videoFiles.length} فيديو
        </span>
      </div>

      {videoFiles.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl">
          <Video className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-300 mb-1">لا توجد محاضرات فيديو بعد</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            اضغط على "رفع محتوى" بالأعلى لرفع فيديوهات المحاضرات والشروحات.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {videoFiles.map((file) => (
            <div
              key={file.id}
              onClick={() => setSelectedVideo(file)}
              className="group relative bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 hover:border-amber-500/50 rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer flex flex-col justify-between shadow-lg shadow-black/20"
            >
              {/* Fake Video Thumbnail Header */}
              <div className="h-36 bg-slate-950 flex items-center justify-center relative group-hover:brightness-110 transition">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-black transition">
                  <Play className="w-5 h-5 ml-0.5 fill-current" />
                </div>
                <button
                  onClick={(e) => handleDelete(file, e)}
                  className="absolute top-2.5 left-2.5 p-1.5 bg-slate-900/80 hover:bg-rose-500 text-slate-400 hover:text-white rounded-lg transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Details */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-100 group-hover:text-amber-300 transition line-clamp-2 mb-1">
                    {file.title}
                  </h3>
                  <span className="text-[11px] text-slate-400 block mb-3 font-medium">
                    {getSubjectName(file.subjectId)}
                  </span>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span className="text-[11px] font-mono">
                    {file.size ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : 'فيديو'}
                  </span>
                  <span className="text-amber-400 group-hover:translate-x-1 transition text-xs font-bold flex items-center gap-1">
                    تشغيل المحاضرة
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
