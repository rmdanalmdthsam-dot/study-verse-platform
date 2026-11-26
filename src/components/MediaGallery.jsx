import React, { useState } from 'react';
import {
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  RotateCw,
  X,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize2
} from 'lucide-react';
import { deleteFile, getDownloadUrl } from '../utils/api';
import useFileContentUrl from '../hooks/useFileContentUrl';

function GalleryThumbnail({ file }) {
  const contentUrl = useFileContentUrl(file);
  return (
    <img
      src={contentUrl || undefined}
      crossOrigin="use-credentials"
      alt={file.title}
      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
    />
  );
}

export default function MediaGallery({ files = [], subjects = [], onFileDeleted }) {
  const [activeImage, setActiveImage] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const activeImageUrl = useFileContentUrl(activeImage);

  const imageFiles = files.filter((f) => f.type === 'image');

  const openLightbox = (img) => {
    setActiveImage(img);
    setZoomLevel(1);
    setRotation(0);
  };

  const closeLightbox = () => {
    setActiveImage(null);
  };

  const handleZoom = (delta) => {
    setZoomLevel((prev) => Math.min(Math.max(prev + delta, 0.5), 3));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleDelete = async (file, e) => {
    e.stopPropagation();
    if (!confirm(`هل تريد حذف الصورة "${file.title}"؟`)) return;
    try {
      await deleteFile(file.id);
      if (activeImage?.id === file.id) closeLightbox();
      if (onFileDeleted) onFileDeleted(file.id);
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <ImageIcon className="w-6 h-6 text-sky-400" />
            <span>معرض السبورات والخرائط الذهنية</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            صور المحاضرات، رسومات السبورات، ومخططات المذاكرة بدقة عالية
          </p>
        </div>
        <span className="text-xs font-semibold px-3 py-1 bg-sky-500/15 border border-sky-500/30 text-sky-300 rounded-full">
          {imageFiles.length} صورة
        </span>
      </div>

      {imageFiles.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl">
          <ImageIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-300 mb-1">لا توجد صور سبورات أو مخططات بعد</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            يمكنك تصوير السبورة بهاتفك ورفعها مباشرة لتظهر على اللابتوب فوراً.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {imageFiles.map((file) => (
            <div
              key={file.id}
              onClick={() => openLightbox(file)}
              className="group relative bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-sky-500/50 rounded-2xl overflow-hidden cursor-pointer shadow-lg shadow-black/20 transition flex flex-col"
            >
              <div className="h-44 bg-slate-950 overflow-hidden relative">
                <GalleryThumbnail file={file} />
                <button
                  onClick={(e) => handleDelete(file, e)}
                  className="absolute top-2 left-2 p-1.5 bg-black/60 hover:bg-rose-500 text-white rounded-lg transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-3">
                <h4 className="font-bold text-xs text-slate-100 group-hover:text-sky-300 truncate mb-1">
                  {file.title}
                </h4>
                <p className="text-[10px] text-slate-400">{getSubjectName(file.subjectId)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Modal */}
      {activeImage && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-md animate-fadeIn">
          {/* Lightbox Toolbar */}
          <div className="px-6 py-4 flex items-center justify-between border-b border-slate-800/80 bg-slate-900/50">
            <div>
              <h3 className="text-sm font-bold text-white">{activeImage.title}</h3>
              <p className="text-xs text-slate-400">{getSubjectName(activeImage.subjectId)}</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleZoom(0.25)}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs transition"
                title="تكبير"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleZoom(-0.25)}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs transition"
                title="تصغير"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={handleRotate}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs transition"
                title="تدوير"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <a
                href={activeImageUrl ? getDownloadUrl(activeImageUrl) : undefined}
                download
                target="_blank"
                rel="noreferrer"
                className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs transition"
                title="تحميل"
              >
                <Download className="w-4 h-4" />
              </a>
              <button
                onClick={closeLightbox}
                className="p-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs transition ml-2"
                title="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Lightbox Image Viewport */}
          <div className="flex-1 overflow-auto flex items-center justify-center p-4">
            <img
              src={activeImageUrl || undefined}
              crossOrigin="use-credentials"
              alt={activeImage.title}
              style={{
                transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                transition: 'transform 0.15s ease'
              }}
              className="max-h-[85vh] max-w-full object-contain rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
