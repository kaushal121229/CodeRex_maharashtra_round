import React, { useState, useEffect } from 'react';
import { Search, Download, FileText, ArrowLeft, Clock, Filter, User, Layers } from 'lucide-react';
import { TranscriptSegment } from '../types';
import { formatTime } from '../utils/deviceUtils';
import { exportTranscriptToPDF } from '../utils/pdfExport';
import { getApiBaseUrl } from '../utils/config';

interface TranscriptPageProps {
  sessionCode: string;
  sessionTitle: string;
  onBackToDashboard: () => void;
}

export const TranscriptPage: React.FC<TranscriptPageProps> = ({
  sessionCode,
  sessionTitle,
  onBackToDashboard,
}) => {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const apiBase = getApiBaseUrl();
    fetch(`${apiBase}/api/sessions/${encodeURIComponent(sessionCode)}/transcript`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSegments(data);
        }
      })
      .catch((err) => console.error('Error loading transcript:', err))
      .finally(() => setIsLoading(false));
  }, [sessionCode]);

  // Unique speakers
  const speakers = Array.from(new Set(segments.map((s) => s.speaker_name)));

  // Filtered segments
  const filteredSegments = segments.filter((s) => {
    const matchesSpeaker = selectedSpeaker === 'all' || s.speaker_name === selectedSpeaker;
    const matchesSearch =
      !searchQuery.trim() ||
      s.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.speaker_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSpeaker && matchesSearch;
  });

  // Calculate conversational statistics
  const totalWords = segments.reduce((sum, s) => sum + s.text.split(/\s+/).filter(Boolean).length, 0);
  const speakerStats: Record<string, number> = {};
  segments.forEach((s) => {
    const words = s.text.split(/\s+/).filter(Boolean).length;
    speakerStats[s.speaker_name] = (speakerStats[s.speaker_name] || 0) + words;
  });

  const handleDownloadTxt = () => {
    window.open(`/api/sessions/${sessionCode}/transcript/export`, '_blank');
  };

  const handleDownloadPdf = () => {
    exportTranscriptToPDF(sessionTitle, sessionCode, segments);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 sm:p-7 rounded-3xl glass-card-glow shadow-2xl">
        <div>
          <button
            onClick={onBackToDashboard}
            className="flex items-center space-x-1.5 text-xs text-indigo-600 hover:text-indigo-800 mb-2 transition-colors cursor-pointer group font-medium"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Live Roundtable</span>
          </button>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Conversation Transcript</h2>
          <p className="text-xs text-slate-500 mt-1">
            Session: <span className="text-slate-800 font-bold">{sessionTitle}</span> ({sessionCode})
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center space-x-3">
          <button
            onClick={handleDownloadTxt}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl glass-btn-secondary text-slate-700 text-xs font-semibold cursor-pointer border border-slate-200/90 hover:bg-slate-100"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Download TXT</span>
          </button>

          <button
            onClick={handleDownloadPdf}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl glass-btn-primary text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      {/* Analytics Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4.5 rounded-2xl glass-card-interactive">
          <span className="text-[11px] text-slate-500 uppercase tracking-wider font-bold block">Total Segments</span>
          <span className="text-2xl font-extrabold text-slate-900 font-mono mt-1 block">
            {segments.length}
          </span>
        </div>

        <div className="p-4.5 rounded-2xl glass-card-interactive">
          <span className="text-[11px] text-slate-500 uppercase tracking-wider font-bold block">Total Words Spoken</span>
          <span className="text-2xl font-extrabold text-slate-900 font-mono mt-1 block">
            {totalWords}
          </span>
        </div>

        <div className="p-4.5 rounded-2xl glass-card-interactive">
          <span className="text-[11px] text-slate-500 uppercase tracking-wider font-bold block">Distinct Speakers</span>
          <span className="text-2xl font-extrabold text-slate-900 font-mono mt-1 block">
            {speakers.length}
          </span>
        </div>

        <div className="p-4.5 rounded-2xl glass-panel-amber">
          <span className="text-[11px] text-amber-800 uppercase tracking-wider font-bold block">Overlaps Separated</span>
          <span className="text-2xl font-extrabold text-amber-700 font-mono mt-1 block">
            {segments.filter((s) => s.is_overlap).length}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search words, phrases, or speakers..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Speaker filter dropdown */}
        <div className="sm:w-56">
          <select
            value={selectedSpeaker}
            onChange={(e) => setSelectedSpeaker(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl glass-input text-sm text-slate-900 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
          >
            <option value="all" className="bg-white text-slate-900">All Speakers ({speakers.length})</option>
            {speakers.map((spk) => (
              <option key={spk} value={spk} className="bg-white text-slate-900">
                {spk} ({speakerStats[spk] || 0} words)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Transcript Log Container */}
      <div className="p-6 rounded-3xl glass-card shadow-2xl space-y-4">
        {isLoading ? (
          <div className="py-16 text-center text-slate-500 text-sm">
            <div className="w-8 h-8 border-2 border-indigo-500/40 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
            <span>Loading transcript segments...</span>
          </div>
        ) : filteredSegments.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm">
            No matching transcript segments found.
          </div>
        ) : (
          filteredSegments.map((s, idx) => {
            const avatarColor = s.avatar_color || '#6366F1';
            return (
              <div
                key={s.id || idx}
                className={`p-4.5 rounded-2xl transition-all duration-300 ${
                  s.is_overlap
                    ? 'glass-panel-amber'
                    : 'glass-card-interactive'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2.5">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md"
                      style={{
                        backgroundColor: avatarColor,
                        boxShadow: `0 0 10px ${avatarColor}40`,
                      }}
                    >
                      {s.speaker_name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-bold text-slate-900">
                      {s.speaker_name}
                    </span>
                    {s.is_overlap && (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 border border-amber-300 font-bold animate-pulse">
                        <Layers className="w-2.5 h-2.5 text-amber-700" />
                        <span>Overlap w/ {s.overlap_with || 'Other'}</span>
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] font-mono text-slate-600 flex items-center space-x-1 bg-slate-100/90 px-2 py-0.5 rounded-lg border border-slate-200">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>{formatTime(s.start_timestamp)}</span>
                  </span>
                </div>

                <p className="text-slate-800 text-[15px] pl-9.5 leading-relaxed font-medium">
                  "{s.text}"
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
