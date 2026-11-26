import React, { useState, useRef } from 'react';
import { Upload, FileText, Video, Image as ImageIcon, Music, X, Check, Camera, AlertCircle } from 'lucide-react';
import { uploadFile } from '../utils/api';

export default function UploadModal({ isOpen, onClose, subjects = [], onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || '');
  const [tags, setTags] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      if (!title) {
        setTitle(selected.name.replace(/\.[^/.]+$/, ''));
      }
      setError(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const dropped = e.dataTransfer.files[0];
      setFile(dropped);
      if (!title) {
        setTitle(dropped.name.replace(/\.[^/.]+$/, ''));
      }
      setError(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('يرجى اختيار ملف لرفعه');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title || file.name);
    formData.append('subjectId', subjectId || subjects[0]?.id || '');
    formData.append('tags', tags);

    try {
      const res = await uploadFile(formData, (progress) => {
        setUploadProgress(progress);
      });
      setIsUploading(false);
      if (onUploadSuccess) onUploadSuccess(res);
      onClose();
      // Reset
      setFile(null);
      setTitle('');
      setTags('');
    } catch (err) {
      setIsUploading(false);
      setError(err.message || 'حدث خطأ أثناء الرفع');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/20 border border-indigo-500/40 rounded-xl text-indigo-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">رفع محتوى تعليمي جديد</h3>
              <p className="text-xs text-slate-400">يدعم ملفات PDF، فيديوهات المحاضرات، الصور، والتسجيلات</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* File Drop Area */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition ${
              file
                ? 'border-emerald-500/60 bg-emerald-950/20'
                : 'border-slate-700 hover:border-indigo-500/60 bg-slate-950/60'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept=".pdf,video/*,image/*,audio/*"
            />
            {/* Native Mobile Camera trigger */}
            <input
              type="file"
              ref={cameraInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="image/*"
              capture="environment"
            />

            {file ? (
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-2 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400">
                  <Check className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-white truncate max-w-xs">{file.name}</p>
                <p className="text-xs text-slate-400 mt-1">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
              </div>
            ) : (
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-2 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-200">اسحب وأفلت الملف هنا، أو انقر للاختيار</p>
                <p className="text-xs text-slate-400 mt-1">PDF، MP4، PNG، JPG، MP3 (حتى 1 جيجابايت)</p>
              </div>
            )}
          </div>

          {/* Quick Camera Capture Button (for Mobile phones photographing board) */}
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 py-1 px-2.5 bg-indigo-950/40 border border-indigo-500/30 rounded-lg transition"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>تصوير مباشر بكاميرا الهاتف (سبورة / كشكول)</span>
            </button>
          </div>

          {/* Title input */}
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1.5">عنوان الملف / الدرس</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: محاضرة قوانين الحركة - الفصل الأول"
              className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition"
            />
          </div>

          {/* Subject Selector */}
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1.5">المادة الدراسية</label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none transition"
            >
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.title} ({sub.code})
                </option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1.5">الوسوم / الكلمات المفتاحية (اختياري)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="مثال: مراجعة نهائية، قوانين، ملخص (مفصولة بفاصلة)"
              className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition"
            />
          </div>

          {/* Upload Progress Bar */}
          {isUploading && (
            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between text-xs text-indigo-300">
                <span>جارٍ الرفع والتجهيز في السحابة...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-indigo-500 h-2 rounded-full transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/30 transition flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              <span>{isUploading ? 'جارٍ الرفع...' : 'رفع وحفظ'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
