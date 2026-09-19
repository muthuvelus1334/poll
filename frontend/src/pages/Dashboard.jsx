import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ShareModal } from '../components/ShareModal';
import { 
  PlusCircle, BarChart2, Share2, ExternalLink, Trash2, 
  Lock, Unlock, AlertCircle, CheckCircle2, Clock 
} from 'lucide-react';

export function Dashboard({ navigate }) {
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sharePoll, setSharePoll] = useState(null);

  const fetchPolls = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.listMyPolls();
      setPolls(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load your polls.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolls();
  }, []);

  const handleToggleStatus = async (pollId, currentStatus) => {
    try {
      const updated = await api.setPollStatus(pollId, !currentStatus);
      setPolls((prev) =>
        prev.map((p) => (p.id === pollId ? { ...p, isActive: updated.isActive } : p))
      );
    } catch (err) {
      alert('Error updating status: ' + err.message);
    }
  };

  const handleDelete = async (pollId, title) => {
    if (!window.confirm(`Are you sure you want to delete the poll: "${title}"?`)) {
      return;
    }
    try {
      await api.deletePoll(pollId);
      setPolls((prev) => prev.filter((p) => p.id !== pollId));
    } catch (err) {
      alert('Error deleting poll: ' + err.message);
    }
  };

  return (
    <div>
      {/* Header with Title and Create Button */}
      <div className="flex items-center justify-between mb-6" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            My Polls
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Manage and monitor your live real-time polls
          </p>
        </div>

        <button 
          className="btn btn-primary"
          onClick={() => navigate('create')}
        >
          <PlusCircle size={16} />
          Create New Poll
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="text-center" style={{ padding: '3rem 0', color: 'var(--text-secondary)' }}>
          Loading your polls...
        </div>
      ) : polls.length === 0 ? (
        <div className="card text-center" style={{ padding: '3.5rem 1.5rem', maxWidth: '520px', margin: '2rem auto' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: 'var(--primary-light)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem'
          }}>
            <BarChart2 size={24} />
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.4rem' }}>
            No polls created yet
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Create your first question, invite an audience, and watch live results in real-time.
          </p>
          <button 
            className="btn btn-primary"
            onClick={() => navigate('create')}
          >
            <PlusCircle size={16} />
            Create Your First Poll
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {polls.map((poll) => (
            <div key={poll.id} className="card-white" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`badge ${poll.isActive ? 'badge-active' : 'badge-closed'}`}>
                      {poll.isActive ? '● Live' : 'Closed'}
                    </span>
                    <span className="badge badge-blue">
                      {poll.totalVotes || 0} {poll.totalVotes === 1 ? 'vote' : 'votes'}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Created {new Date(poll.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {poll.title}
                  </h3>
                  {poll.description && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                      {poll.description}
                    </p>
                  )}
                </div>

                {/* Status Toggle & Delete Actions */}
                <div className="flex items-center gap-2">
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleToggleStatus(poll.id, poll.isActive)}
                    title={poll.isActive ? 'Close Poll' : 'Reopen Poll'}
                  >
                    {poll.isActive ? <Lock size={14} /> : <Unlock size={14} />}
                    {poll.isActive ? 'Close Poll' : 'Reopen Poll'}
                  </button>
                  <button 
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(poll.id, poll.title)}
                    title="Delete Poll"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              </div>

              {/* Options summary mini-bars */}
              <div style={{
                backgroundColor: 'var(--bg-surface)',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem 1rem',
                border: '1px solid var(--border-light)'
              }}>
                <div style={{ display: 'grid', gap: '0.4rem', fontSize: '0.85rem' }}>
                  {poll.options.map((opt) => {
                    const pct = poll.totalVotes > 0 ? ((opt.votes / poll.totalVotes) * 100).toFixed(1) : 0;
                    return (
                      <div key={opt.id} className="flex items-center justify-between" style={{ gap: '1rem' }}>
                        <span style={{ fontWeight: 500, color: 'var(--text-primary)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {opt.text}
                        </span>
                        <span style={{ color: 'var(--text-secondary)', minWidth: '80px', textAlign: 'right' }}>
                          {opt.votes} ({pct}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Card Actions: Live Results, Vote Screen, Share */}
              <div className="flex items-center justify-between" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Poll ID: <code style={{ backgroundColor: 'var(--bg-surface)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>{poll.id}</code>
                </span>

                <div className="flex items-center gap-2">
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => setSharePoll(poll)}
                  >
                    <Share2 size={14} />
                    Share & QR
                  </button>

                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => navigate('vote', poll.id)}
                  >
                    <ExternalLink size={14} />
                    Vote Page
                  </button>

                  <button 
                    className="btn btn-primary btn-sm"
                    onClick={() => navigate('results', poll.id)}
                  >
                    <BarChart2 size={14} />
                    Live Results
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Share Modal */}
      {sharePoll && (
        <ShareModal 
          pollId={sharePoll.id}
          pollTitle={sharePoll.title}
          isOpen={!!sharePoll}
          onClose={() => setSharePoll(null)}
          navigate={navigate}
        />
      )}
    </div>
  );
}
