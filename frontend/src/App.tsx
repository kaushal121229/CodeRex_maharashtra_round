import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { LandingPage } from './pages/LandingPage';
import { CreateSessionPage } from './pages/CreateSessionPage';
import { JoinSessionPage } from './pages/JoinSessionPage';
import { DashboardPage } from './pages/DashboardPage';
import { TranscriptPage } from './pages/TranscriptPage';
import { EvaluationPage } from './pages/EvaluationPage';
import { QRCodeModal } from './components/QRCodeModal';
import { Participant } from './types';
import { getApiBaseUrl } from './utils/config';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';

type AppView = 'landing' | 'create' | 'join' | 'session';
type SessionTab = 'dashboard' | 'transcript' | 'evaluation';

interface ToastMessage {
  id: number;
  text: string;
  type: 'info' | 'success' | 'warn';
}

export function App() {
  const [view, setView] = useState<AppView>('landing');
  const [activeTab, setActiveTab] = useState<SessionTab>('dashboard');
  const [sessionCode, setSessionCode] = useState<string>('');
  const [sessionTitle, setSessionTitle] = useState<string>('Roundtable Discussion');
  const [currentParticipant, setCurrentParticipant] = useState<Participant | null>(null);
  const [initialJoinCode, setInitialJoinCode] = useState<string>('');
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [meetingEndedMessage, setMeetingEndedMessage] = useState<string | null>(null);

  // Check URL path and query parameters on load (e.g. /join/RT-48291 or ?session=RT-48291)
  useEffect(() => {
    const pathname = window.location.pathname;
    const pathMatch = pathname.match(/\/join\/([^/?#]+)/i);

    if (pathMatch && pathMatch[1]) {
      const parsedRoom = decodeURIComponent(pathMatch[1]).toUpperCase();
      setInitialJoinCode(parsedRoom);
      setView('join');
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const codeFromUrl = params.get('session') || params.get('room');
    if (codeFromUrl) {
      setInitialJoinCode(codeFromUrl.toUpperCase());
      setView('join');
      return;
    }

    // Restore existing session from sessionStorage if present
    const savedSession = sessionStorage.getItem('roundtable_active_session');
    const savedParticipant = sessionStorage.getItem('roundtable_active_participant');
    if (savedSession && savedParticipant) {
      try {
        const sessObj = JSON.parse(savedSession);
        const partObj = JSON.parse(savedParticipant);
        setSessionCode(sessObj.code || sessObj.room_id);
        setSessionTitle(sessObj.title || 'Roundtable Discussion');
        setCurrentParticipant(partObj);
        setView('session');
      } catch (_) {}
    }
  }, []);

  const showToast = (text: string, type: 'info' | 'success' | 'warn' = 'info') => {
    setToast({ id: Date.now(), text, type });
    setTimeout(() => {
      setToast((curr) => (curr && curr.id === toast?.id ? null : curr));
    }, 4500);
  };

  const handleSessionCreated = (code: string, hostPart: any) => {
    const formattedPart: Participant = {
      participant_id: hostPart.participant_id || hostPart.id,
      device_id: hostPart.device_id,
      display_name: hostPart.display_name,
      avatar_color: hostPart.avatar_color,
      role: 'host',
      status: 'connected',
      mic_active: true,
      rms_level: 0,
    };

    setSessionCode(code);
    setCurrentParticipant(formattedPart);
    setView('session');
    setActiveTab('dashboard');

    sessionStorage.setItem('roundtable_active_session', JSON.stringify({ code, title: 'Roundtable Meeting' }));
    sessionStorage.setItem('roundtable_active_participant', JSON.stringify(formattedPart));
    showToast(`Meeting room ${code} created as Host`, 'success');
  };

  const handleSessionJoined = (code: string, part: any) => {
    const formattedPart: Participant = {
      participant_id: part.participant_id || part.id,
      device_id: part.device_id,
      display_name: part.display_name,
      avatar_color: part.avatar_color,
      role: part.role || 'participant',
      status: 'connected',
      mic_active: true,
      rms_level: 0,
    };

    setSessionCode(code);
    setCurrentParticipant(formattedPart);
    setView('session');
    setActiveTab('dashboard');

    sessionStorage.setItem('roundtable_active_session', JSON.stringify({ code, title: 'Roundtable Meeting' }));
    sessionStorage.setItem('roundtable_active_participant', JSON.stringify(formattedPart));
    showToast(`Connected to room ${code}`, 'success');
  };

  const handleMeetingEnded = (message: string) => {
    sessionStorage.removeItem('roundtable_active_session');
    sessionStorage.removeItem('roundtable_active_participant');
    setMeetingEndedMessage(message || 'Meeting ended by host.');
  };

  const handleLeaveSession = () => {
    if (window.confirm('Are you sure you want to leave this Roundtable meeting?')) {
      const apiBase = getApiBaseUrl();
      if (sessionCode && currentParticipant) {
        fetch(`${apiBase}/rooms/${encodeURIComponent(sessionCode)}/leave`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room_id: sessionCode,
            participant_id: currentParticipant.participant_id,
          }),
        }).catch(() => {});
      }

      sessionStorage.removeItem('roundtable_active_session');
      sessionStorage.removeItem('roundtable_active_participant');
      setCurrentParticipant(null);
      setSessionCode('');
      setView('landing');
      setActiveTab('dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-[#090A0F] text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-white">
      {/* Toast Notification Container */}
      {toast && (
        <div className="fixed top-20 right-5 z-50 animate-bounce">
          <div className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-indigo-500/40 shadow-xl shadow-black/50 text-xs text-white">
            {toast.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
            {toast.type === 'info' && <Info className="w-4 h-4 text-indigo-400" />}
            {toast.type === 'warn' && <AlertCircle className="w-4 h-4 text-amber-400" />}
            <span>{toast.text}</span>
          </div>
        </div>
      )}

      {/* Meeting Ended Modal */}
      {meetingEndedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-sm p-6 rounded-3xl bg-slate-900 border border-white/10 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Meeting Disconnected</h3>
            <p className="text-xs text-slate-300">{meetingEndedMessage}</p>
            <button
              onClick={() => {
                setMeetingEndedMessage(null);
                setCurrentParticipant(null);
                setSessionCode('');
                setView('landing');
                setActiveTab('dashboard');
              }}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
            >
              Back to Home
            </button>
          </div>
        </div>
      )}

      {/* Navigation Bar */}
      <Navbar
        sessionCode={view === 'session' ? sessionCode : undefined}
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (view === 'session') {
            setActiveTab(tab);
          } else {
            setView('landing');
          }
        }}
        onOpenQR={() => setIsQRModalOpen(true)}
        onLeaveSession={handleLeaveSession}
        isHost={currentParticipant?.role === 'host'}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {view === 'landing' && (
          <LandingPage
            onCreateClick={() => setView('create')}
            onJoinClick={() => {
              setInitialJoinCode('');
              setView('join');
            }}
          />
        )}

        {view === 'create' && (
          <CreateSessionPage
            onSessionCreated={handleSessionCreated}
            onBack={() => setView('landing')}
          />
        )}

        {view === 'join' && (
          <JoinSessionPage
            initialCode={initialJoinCode}
            onSessionJoined={handleSessionJoined}
            onBack={() => setView('landing')}
          />
        )}

        {view === 'session' && currentParticipant && (
          <>
            {activeTab === 'dashboard' && (
              <DashboardPage
                sessionCode={sessionCode}
                sessionTitle={sessionTitle}
                participant={currentParticipant}
                onNavigateTab={(tab) => setActiveTab(tab)}
                onParticipantToast={(msg, type) => showToast(msg, type === 'join' ? 'success' : type === 'reconnect' ? 'info' : 'warn')}
                onMeetingEnded={handleMeetingEnded}
              />
            )}

            {activeTab === 'transcript' && (
              <TranscriptPage
                sessionCode={sessionCode}
                sessionTitle={sessionTitle}
                onBackToDashboard={() => setActiveTab('dashboard')}
              />
            )}

            {activeTab === 'evaluation' && (
              <EvaluationPage
                sessionCode={sessionCode}
                onBackToDashboard={() => setActiveTab('dashboard')}
              />
            )}
          </>
        )}
      </main>

      {/* Global QR Code Modal */}
      {view === 'session' && (
        <QRCodeModal
          isOpen={isQRModalOpen}
          onClose={() => setIsQRModalOpen(false)}
          sessionCode={sessionCode}
          sessionTitle={sessionTitle}
        />
      )}
    </div>
  );
}

export default App;
