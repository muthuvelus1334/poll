import React, { useState } from 'react';
import { usePollLiveResults } from '../hooks/usePollLiveResults';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { ShareModal } from '../components/ShareModal';
import { 
  BarChart2, Users, ArrowLeft, Share2, ExternalLink, 
  Lock, Unlock, Trophy, Wifi, AlertCircle, RefreshCw 
} from 'lucide-react';

export function ResultsPage({ pollId, navigate }) {
  const { liveData, viewers, connectionStatus, error, refresh } = usePollLiveResults(pollId);
  const { user } = useAuth();
  const [shareOpen, setShareOpen] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const handleToggleStatus = async () => {
    if (!liveData) return;
    try {
      setStatusUpdating(true);
      await api.setPollStatus(pollId, !liveData.isActive);
      refresh();
    } catch (err) {
      alert('Could not update status: ' + err.message);
    } finally {
      setStatusUpdating(false);
    }
  };

  if (!liveData && connectionStatus === 'connecting') {
    return (
      <div className="text-center" style={{ padding: '4rem 0', color: 'var(--text-secondary)' }}>
        <RefreshCw size={24} className="spin" style={{ margin: '0 auto 0.75rem', animation: 'spin 1s linear infinite' }} />
        <p>Connecting to live results stream...</p>
      </div>
    );
  }

  if (error && !liveData) {
    return (
      <div style={{ maxWidth: '520px', margin: '2rem auto' }}>
        <div className="card text-center" style={{ padding: '2.5rem 1.5rem' }}>
          <AlertCircle size={32} color="var(--danger)" style={{ margin: '0 auto 0.75rem' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>Poll Results Not Found</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            {error || 'Unable to connect to this poll.'}
          </p>
          <button className="btn btn-secondary" onClick={() => navigate('home')}>
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  // Find leading option
  let maxVotes = 0;
  if (liveData && liveData.totalVotes > 0) {
    maxVotes = Math.max(...liveData.options.map((o) => o.votes));
  }

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      {/* Top action navigation */}
      <div className="flex items-center justify-between mb-4" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
        <button 
          className="btn btn-secondary btn-sm"
          onClick={() => navigate(user ? 'dashboard' : 'home')}
        >
          <ArrowLeft size={14} />
          {user ? 'My Polls' : 'Home'}
        </button>

        <div className="flex items-center gap-2">
          {user && (
            <button 
              className="btn btn-secondary btn-sm"
              onClick={handleToggleStatus}
              disabled={statusUpdating}
            >
              {liveData?.isActive ? <Lock size={14} /> : <Unlock size={14} />}
              {liveData?.isActive ? 'Close Poll' : 'Reopen Poll'}
            </button>
          )}

          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => setShareOpen(true)}
          >
            <Share2 size={14} />
            Share & QR
          </button>

          <button 
            className="btn btn-primary btn-sm"
            onClick={() => navigate('vote', pollId)}
          >
            <ExternalLink size={14} />
            Cast Vote
          </button>
        </div>
      </div>

      <div className="card-white">
        {/* Results Live Header */}
        <div style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
          <div className="flex items-center justify-between mb-3" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
            <div className="flex items-center gap-2">
              <span className={`badge ${liveData?.isActive ? 'badge-active' : 'badge-closed'}`}>
                {liveData?.isActive ? (
                  <>
                    <span className="pulse-dot" />
                    Live Voting
                  </>
                ) : (
                  'Voting Ended'
                )}
              </span>

              <span className="badge badge-blue">
                {liveData?.totalVotes || 0} {liveData?.totalVotes === 1 ? 'Total Vote' : 'Total Votes'}
              </span>

              <span className="flex items-center gap-2" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <Users size={14} />
                {viewers} {viewers === 1 ? 'viewer' : 'viewers'}
              </span>
            </div>

            {/* Connection indicator */}
            <div className="flex items-center gap-2" style={{ fontSize: '0.775rem', color: connectionStatus === 'connected' ? 'var(--success)' : 'var(--text-muted)' }}>
              <Wifi size={13} />
              <span>{connectionStatus === 'connected' ? 'Realtime Connected' : 'Reconnecting...'}</span>
            </div>
          </div>

          <h1 style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {liveData?.title}
          </h1>
        </div>

        {/* Live Vote Bars */}
        <div style={{ marginBottom: '1.5rem' }}>
          {liveData?.options.map((option) => {
            const pct = option.percentage || 0;
            const isLeader = maxVotes > 0 && option.votes === maxVotes;

            return (
              <div key={option.id} className="poll-option-bar-container">
                {/* Visual Progress Fill */}
                <div 
                  className="poll-option-fill" 
                  style={{ 
                    width: `${pct}%`,
                    backgroundColor: isLeader ? '#bfdbfe' : '#e2e8f0'
                  }} 
                />

                {/* Option Text and Stats */}
                <div className="poll-option-content">
                  <span className="flex items-center gap-2" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                    {isLeader && <Trophy size={16} color="#d97706" />}
                    {option.text}
                  </span>

                  <div className="flex items-center gap-4">
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                      {option.votes} {option.votes === 1 ? 'vote' : 'votes'}
                    </span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', minWidth: '55px', textAlign: 'right' }}>
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Real-time footer notes */}
        <div className="text-center" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            ⚡ Updates broadcast live via Redis Pub/Sub & WebSockets without page reload.
          </p>
        </div>
      </div>

      {/* Share & QR Code Modal */}
      {liveData && (
        <ShareModal 
          pollId={pollId}
          pollTitle={liveData.title}
          isOpen={shareOpen}
          onClose={() => setShareOpen(false)}
          navigate={navigate}
        />
      )}
    </div>
  );
}
