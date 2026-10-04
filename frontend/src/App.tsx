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

  const navigateTo = (newView: AppView, path?: string) => {
    setView(newView);
    if (path && window.location.pathname !== path) {
      window.history.pushState(null, '', path);
    }
  };

  const syncRouteFromUrl = () => {
    const pathname = window.location.pathname;
    const joinMatch = pathname.match(/^\/join\/([^/?#]+)/i);
    const meetingMatch = pathname.match(/^\/meeting\/([^/?#]+)/i);

    if (joinMatch && joinMatch[1]) {
      const parsedRoom = decodeURIComponent(joinMatch[1]).toUpperCase();
      setInitialJoinCode(parsedRoom);
      setView('join');
      return;
    }

    if (meetingMatch && meetingMatch[1]) {
      const roomCode = decodeURIComponent(meetingMatch[1]).toUpperCase();
      const savedSession = sessionStorage.getItem('roundtable_active_session');
      const savedParticipant = sessionStorage.getItem('roundtable_active_participant');
      if (savedSession && savedParticipant) {
        try {
          const sessObj = JSON.parse(savedSession);
          if ((sessObj.code || sessObj.room_id) === roomCode) {
            setSessionCode(roomCode);
            setSessionTitle(sessObj.title || 'Roundtable Discussion');
            setCurrentParticipant(JSON.parse(savedParticipant));
            setView('session');
            return;
          }
        } catch (_) {}
      }
      setInitialJoinCode(roomCode);
      setView('join');
      return;
    }

    if (pathname === '/create') {
      setView('create');
      return;
    }

    if (pathname === '/join') {
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
        return;
      } catch (_) {}
    }
  };

  useEffect(() => {
    syncRouteFromUrl();
    window.addEventListener('popstate', syncRouteFromUrl);
    return () => window.removeEventListener('popstate', syncRouteFromUrl);
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
    navigateTo('session', `/meeting/${encodeURIComponent(code)}`);
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
    navigateTo('session', `/meeting/${encodeURIComponent(code)}`);
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
      navigateTo('landing', '/');
      setActiveTab('dashboard');
    }
  };

  return (
    <div className="relative min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans selection:bg-indigo-500/20 selection:text-indigo-900 overflow-hidden">
      {/* Dynamic Animated Ambient Glass Glow Mesh Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {/* Floating Orb 1: Violet/Indigo */}
        <div className="absolute top-[-10%] left-[-5%] w-[550px] h-[550px] rounded-full bg-indigo-300/35 blur-[120px] animate-float-slow" />
        {/* Floating Orb 2: Cyan/Sky */}
        <div className="absolute top-[25%] right-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-300/30 blur-[130px] animate-float-reverse" />
        {/* Floating Orb 3: Pink/Rose */}
        <div className="absolute bottom-[-10%] left-[20%] w-[600px] h-[600px] rounded-full bg-pink-300/25 blur-[140px] animate-pulse-glow" />
        {/* Subtle grid pattern overlay for glassmorphic depth */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#6366f10d_1px,transparent_1px),linear-gradient(to_bottom,#6366f10d_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-70" />
      </div>

      {/* Toast Notification Container */}
      {toast && (
        <div className="fixed top-20 right-5 z-50 animate-in fade-in slide-in-from-top-3 duration-300">
          <div className="flex items-center space-x-2 px-4 py-2.5 rounded-2xl glass-card border-indigo-400/40 shadow-xl shadow-slate-300/40 text-xs text-slate-800 font-medium">
            {toast.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-600" />}
            {toast.type === 'info' && <Info className="w-4 h-4 text-indigo-600" />}
            {toast.type === 'warn' && <AlertCircle className="w-4 h-4 text-amber-600" />}
            <span>{toast.text}</span>
          </div>
        </div>
      )}

      {/* Meeting Ended Modal */}
      {meetingEndedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-sm p-6 rounded-3xl glass-card-glow border border-slate-200 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 flex items-center justify-center mx-auto border border-amber-500/30">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Meeting Disconnected</h3>
            <p className="text-xs text-slate-600">{meetingEndedMessage}</p>
            <button
              onClick={() => {
                setMeetingEndedMessage(null);
                setCurrentParticipant(null);
                setSessionCode('');
                setView('landing');
                setActiveTab('dashboard');
              }}
              className="w-full py-2.5 rounded-xl glass-btn-primary text-white text-xs font-semibold cursor-pointer"
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
      <main className="flex-1 relative z-10">
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
