import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ShareModal } from '../components/ShareModal';
import confetti from 'canvas-confetti';
import { 
  CheckCircle2, AlertCircle, BarChart2, Share2, 
  Lock, ArrowLeft, Radio 
} from 'lucide-react';

export function VotePage({ pollId, navigate }) {
  const [poll, setPoll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOption, setSelectedOption] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [votedOptionText, setVotedOptionText] = useState('');
  const [shareModalOpen, setShareModalOpen] = useState(false);

  useEffect(() => {
    // Check if previously voted in this browser
    const storedVote = localStorage.getItem(`voted_poll_${pollId}`);
    if (storedVote) {
      setHasVoted(true);
      setVotedOptionText(storedVote);
    }

    async function loadPoll() {
      try {
        setLoading(true);
        setError('');
        const data = await api.getPoll(pollId);
        setPoll(data);
      } catch (err) {
        setError(err.message || 'Unable to load poll.');
      } finally {
        setLoading(false);
      }
    }

    if (pollId) {
      loadPoll();
    }
  }, [pollId]);

  const handleVoteSubmit = async (e) => {
    e.preventDefault();
    if (!selectedOption) return;

    try {
      setSubmitting(true);
      setError('');
      
      await api.castVote(pollId, selectedOption);

      // Trigger celebration confetti
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (e) {}

      // Find chosen text
      const chosen = poll.options.find((o) => o.id === selectedOption);
      const chosenText = chosen ? chosen.text : 'Selected Option';
      localStorage.setItem(`voted_poll_${pollId}`, chosenText);
      setHasVoted(true);
      setVotedOptionText(chosenText);
    } catch (err) {
      setError(err.message || 'Failed to submit vote.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center" style={{ padding: '4rem 0', color: 'var(--text-secondary)' }}>
        Loading poll...
      </div>
    );
  }

  if (error && !poll) {
    return (
      <div style={{ maxWidth: '520px', margin: '2rem auto' }}>
        <div className="card text-center" style={{ padding: '2.5rem 1.5rem' }}>
          <AlertCircle size={32} color="var(--danger)" style={{ margin: '0 auto 0.75rem' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>Poll Not Found</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            {error || 'The requested poll does not exist or has been removed.'}
          </p>
          <button className="btn btn-secondary" onClick={() => navigate('home')}>
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '580px', margin: '0 auto' }}>
      {/* Top action bar */}
      <div className="flex items-center justify-between mb-4">
        <button 
          className="btn btn-secondary btn-sm"
          onClick={() => navigate('home')}
        >
          <ArrowLeft size={14} />
          Home
        </button>

        <div className="flex items-center gap-2">
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => setShareModalOpen(true)}
          >
            <Share2 size={14} />
            Share
          </button>

          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => navigate('results', pollId)}
          >
            <BarChart2 size={14} />
            Live Results
          </button>
        </div>
      </div>

      <div className="card-white">
        {/* Poll Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className={`badge ${poll.isActive ? 'badge-active' : 'badge-closed'}`}>
              {poll.isActive ? '● Voting Active' : 'Voting Closed'}
            </span>
            <span className="badge badge-blue">
              {poll.totalVotes || 0} {poll.totalVotes === 1 ? 'vote' : 'votes'}
            </span>
          </div>

          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
            {poll.title}
          </h1>

          {poll.description && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', lineHeight: 1.5 }}>
              {poll.description}
            </p>
          )}
        </div>

        {error && (
          <div className="alert alert-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* State 1: Poll is Closed */}
        {!poll.isActive && (
          <div style={{
            backgroundColor: '#f8fafc',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)',
            padding: '1.5rem',
            textAlign: 'center',
            marginBottom: '1.5rem'
          }}>
            <Lock size={28} color="var(--text-secondary)" style={{ margin: '0 auto 0.5rem' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              This Poll is Closed
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
              The organizer has ended voting. You can still view the live final results.
            </p>
            <button 
              className="btn btn-primary"
              onClick={() => navigate('results', pollId)}
            >
              <BarChart2 size={16} />
              View Final Results
            </button>
          </div>
        )}

        {/* State 2: Already Voted */}
        {poll.isActive && hasVoted && (
          <div style={{
            backgroundColor: 'var(--success-bg)',
            border: '1px solid var(--success-border)',
            borderRadius: 'var(--radius-md)',
            padding: '1.75rem',
            textAlign: 'center',
            marginBottom: '1.5rem'
          }}>
            <CheckCircle2 size={36} color="var(--success)" style={{ margin: '0 auto 0.5rem' }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
              Thank You! Your Vote is Recorded.
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              You voted for: <strong>{votedOptionText}</strong>
            </p>
            <div className="flex gap-2 justify-between" style={{ justifyContent: 'center' }}>
              <button 
                className="btn btn-primary"
                onClick={() => navigate('results', pollId)}
              >
                <BarChart2 size={16} />
                Watch Live Results Stream
              </button>
            </div>
          </div>
        )}

        {/* State 3: Active Voting Form */}
        {poll.isActive && !hasVoted && (
          <form onSubmit={handleVoteSubmit}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label className="form-label" style={{ marginBottom: '0.75rem' }}>
                Select an option:
              </label>

              {poll.options.map((option) => {
                const isSelected = selectedOption === option.id;
                return (
                  <div 
                    key={option.id}
                    className={`vote-option-btn ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedOption(option.id)}
                  >
                    <span>{option.text}</span>
                    <div style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      border: isSelected ? '5px solid var(--primary)' : '2px solid var(--border-light)',
                      backgroundColor: '#ffffff',
                      flexShrink: 0
                    }} />
                  </div>
                );
              })}
            </div>

            <button 
              type="submit" 
              disabled={submitting || !selectedOption}
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
            >
              <CheckCircle2 size={18} />
              {submitting ? 'Submitting Vote...' : 'Submit My Vote'}
            </button>
          </form>
        )}
      </div>

      {/* Share Modal */}
      <ShareModal 
        pollId={pollId}
        pollTitle={poll.title}
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        navigate={navigate}
      />
    </div>
  );
}
