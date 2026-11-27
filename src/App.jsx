import React, { useState, useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import MobileNav from './components/MobileNav';
import DashboardOverview from './components/DashboardOverview';
import PdfReader from './components/PdfReader';
import VideoPlayer from './components/VideoPlayer';
import MediaGallery from './components/MediaGallery';
import NotesEditor from './components/NotesEditor';
import FlashcardsDeck from './components/FlashcardsDeck';
import PomodoroTimer from './components/PomodoroTimer';
import DevicePairingModal from './components/DevicePairingModal';
import UploadModal from './components/UploadModal';
import AuthModal from './components/AuthModal';

import {
  getCurrentUser,
  getAuthToken,
  logout,
  fetchFiles,
  fetchSubjects,
  fetchNotes,
  fetchFlashcards,
  fetchSyncInfo,
  downloadBackup
} from './utils/api';

export default function App() {
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [activeTab, setActiveTab] = useState('all');
  const [subjects, setSubjects] = useState([]);
  const [files, setFiles] = useState([]);
  const [notes, setNotes] = useState([]);
  const [flashcards, setFlashcards] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [syncInfo, setSyncInfo] = useState(null);

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isPairingOpen, setIsPairingOpen] = useState(false);
  const [backupProgress, setBackupProgress] = useState(null);

  useEffect(() => {
    if (currentUser && getAuthToken()) {
      loadUserData();
    }
  }, [currentUser]);

  const loadUserData = async () => {
    try {
      const [subsData, filesData, notesData, cardsData, syncData] = await Promise.all([
        fetchSubjects(),
        fetchFiles(),
        fetchNotes(),
        fetchFlashcards(),
        fetchSyncInfo()
      ]);

      if (subsData) setSubjects(subsData);
      if (filesData) setFiles(filesData);
      if (notesData) setNotes(notesData);
      if (cardsData) setFlashcards(cardsData);
      if (syncData) setSyncInfo(syncData);
    } catch (err) {
      console.error('Error loading user data:', err);
    }
  };

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    return logout();
  };

  const handleBackup = async () => {
    setBackupProgress(0);
    try {
      await downloadBackup(setBackupProgress);
    } catch (err) {
      if (err.name !== 'AbortError') {
        alert(err.message || 'تعذر إنشاء النسخة الاحتياطية');
      }
    } finally {
      setBackupProgress(null);
    }
  };

  // If not authenticated, require login/signup
  if (!currentUser || !getAuthToken()) {
    return <AuthModal onLoginSuccess={handleLoginSuccess} />;
  }

  const filteredFiles = files.filter((f) => {
    const matchSub = !selectedSubjectId || f.subjectId === selectedSubjectId;
    const matchQ = !searchTerm || f.title.toLowerCase().includes(searchTerm.toLowerCase());
    return matchSub && matchQ;
  });

  const filteredNotes = notes.filter((n) => {
    const matchSub = !selectedSubjectId || n.subjectId === selectedSubjectId;
    const matchQ = !searchTerm || n.title.toLowerCase().includes(searchTerm.toLowerCase()) || n.content.toLowerCase().includes(searchTerm.toLowerCase());
    return matchSub && matchQ;
  });

  const filteredCards = flashcards.filter((c) => {
    return !selectedSubjectId || c.subjectId === selectedSubjectId;
  });

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans pb-20 md:pb-0">
      <Navbar
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenPairing={() => setIsPairingOpen(true)}
        currentUser={currentUser}
        onLogout={handleLogout}
        onBackup={handleBackup}
        isBackingUp={backupProgress !== null}
        backupProgress={backupProgress || 0}
      />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          subjects={subjects}
          selectedSubjectId={selectedSubjectId}
          setSelectedSubjectId={setSelectedSubjectId}
          onSubjectCreated={(newSub) => setSubjects((prev) => [...prev, newSub])}
        />

        <main className="flex-1 p-4 md:p-6 lg:p-8 min-w-0 overflow-y-auto">
          {activeTab === 'all' && (
            <DashboardOverview
              files={filteredFiles}
              notes={filteredNotes}
              flashcards={filteredCards}
              subjects={subjects}
              setActiveTab={setActiveTab}
              onOpenUpload={() => setIsUploadOpen(true)}
              onOpenPairing={() => setIsPairingOpen(true)}
            />
          )}

          {activeTab === 'pdf' && (
            <PdfReader
              files={filteredFiles}
              subjects={subjects}
              onFileUpdated={(up) => setFiles((prev) => prev.map((f) => (f.id === up.id ? up : f)))}
              onFileDeleted={(id) => setFiles((prev) => prev.filter((f) => f.id !== id))}
            />
          )}

          {activeTab === 'video' && (
            <VideoPlayer
              files={filteredFiles}
              subjects={subjects}
              onFileUpdated={(up) => setFiles((prev) => prev.map((f) => (f.id === up.id ? up : f)))}
              onFileDeleted={(id) => setFiles((prev) => prev.filter((f) => f.id !== id))}
            />
          )}

          {activeTab === 'image' && (
            <MediaGallery
              files={filteredFiles}
              subjects={subjects}
              onFileDeleted={(id) => setFiles((prev) => prev.filter((f) => f.id !== id))}
            />
          )}

          {activeTab === 'notes' && (
            <NotesEditor
              notes={filteredNotes}
              subjects={subjects}
              onNoteCreated={(n) => setNotes((prev) => [n, ...prev])}
              onNoteUpdated={(up) => setNotes((prev) => prev.map((n) => (n.id === up.id ? up : n)))}
              onNoteDeleted={(id) => setNotes((prev) => prev.filter((n) => n.id !== id))}
            />
          )}

          {activeTab === 'flashcards' && (
            <FlashcardsDeck
              flashcards={filteredCards}
              subjects={subjects}
              onCardCreated={(c) => setFlashcards((prev) => [...prev, c])}
              onCardReviewed={(up) => setFlashcards((prev) => prev.map((c) => (c.id === up.id ? up : c)))}
              onCardDeleted={(id) => setFlashcards((prev) => prev.filter((c) => c.id !== id))}
            />
          )}

          {activeTab === 'pomodoro' && <PomodoroTimer subjects={subjects} />}
        </main>
      </div>

      <MobileNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenPairing={() => setIsPairingOpen(true)}
      />

      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        subjects={subjects}
        onUploadSuccess={(newFile) => {
          setFiles((prev) => [newFile, ...prev]);
          if (newFile.type === 'pdf') setActiveTab('pdf');
          else if (newFile.type === 'video') setActiveTab('video');
          else if (newFile.type === 'image') setActiveTab('image');
        }}
      />

      <DevicePairingModal
        isOpen={isPairingOpen}
        onClose={() => setIsPairingOpen(false)}
        syncInfo={syncInfo}
      />

      <Analytics />
    </div>
  );
}
