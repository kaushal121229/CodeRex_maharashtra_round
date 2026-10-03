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

type AppView = 'landing' | 'create' | 'join' | 'session';
type SessionTab = 'dashboard' | 'transcript' | 'evaluation';

export function App() {
  const [view, setView] = useState<AppView>('landing');
  const [activeTab, setActiveTab] = useState<SessionTab>('dashboard');
  const [sessionCode, setSessionCode] = useState<string>('');
  const [sessionTitle, setSessionTitle] = useState<string>('Roundtable Discussion');
  const [currentParticipant, setCurrentParticipant] = useState<Participant | null>(null);
  const [initialJoinCode, setInitialJoinCode] = useState<string>('');
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);

  // Check URL query parameters on load (e.g. ?session=RT-48291 or /join?session=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeFromUrl = params.get('session');
    if (codeFromUrl) {
      setInitialJoinCode(codeFromUrl);
      setView('join');
    }

    // Restore existing session from sessionStorage if present
    const savedSession = sessionStorage.getItem('roundtable_active_session');
    const savedParticipant = sessionStorage.getItem('roundtable_active_participant');
    if (savedSession && savedParticipant && !codeFromUrl) {
      try {
        const sessObj = JSON.parse(savedSession);
        const partObj = JSON.parse(savedParticipant);
        setSessionCode(sessObj.code);
        setSessionTitle(sessObj.title);
        setCurrentParticipant(partObj);
        setView('session');
      } catch (_) {}
    }
  }, []);

  const handleSessionCreated = (code: string, hostPart: any) => {
    const formattedPart: Participant = {
      participant_id: hostPart.id,
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

    sessionStorage.setItem('roundtable_active_session', JSON.stringify({ code, title: 'Roundtable Discussion' }));
    sessionStorage.setItem('roundtable_active_participant', JSON.stringify(formattedPart));
  };

  const handleSessionJoined = (code: string, part: any) => {
    const formattedPart: Participant = {
      participant_id: part.id,
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

    sessionStorage.setItem('roundtable_active_session', JSON.stringify({ code, title: 'Roundtable Discussion' }));
    sessionStorage.setItem('roundtable_active_participant', JSON.stringify(formattedPart));
  };

  const handleLeaveSession = () => {
    if (window.confirm('Are you sure you want to leave this Roundtable?')) {
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
