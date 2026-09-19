import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { PlusCircle, ArrowRight, Zap, ShieldCheck, BarChart3, Users } from 'lucide-react';

export function Home({ navigate }) {
  const { isAuthenticated } = useAuth();
  const [pollCode, setPollCode] = useState('');
  const [codeError, setCodeError] = useState('');

  const handleJoinPoll = (e) => {
    e.preventDefault();
    const trimmed = pollCode.trim();
    if (!trimmed) {
      setCodeError('Please enter a valid Poll ID');
      return;
    }
    navigate('vote', trimmed);
  };

  return (
    <div style={{ maxWidth: '840px', margin: '0 auto', paddingTop: '1.5rem' }}>
      {/* Hero section */}
      <div className="text-center" style={{ marginBottom: '3.5rem' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          backgroundColor: 'var(--primary-light)',
          color: 'var(--primary)',
          fontSize: '0.825rem',
          fontWeight: 600,
          padding: '0.35rem 0.85rem',
          borderRadius: '9999px',
          marginBottom: '1.25rem',
          border: '1px solid #bfdbfe'
        }}>
          <Zap size={14} />
          Powered by Go, Redis & WebSockets
        </div>

        <h1 style={{
          fontSize: '2.75rem',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          lineHeight: 1.15,
          color: 'var(--text-primary)',
          marginBottom: '1.25rem'
        }}>
          Live Audience Polling with Zero Refresh
        </h1>

        <p style={{
          fontSize: '1.15rem',
          color: 'var(--text-secondary)',
          maxWidth: '620px',
          margin: '0 auto 2.25rem',
          lineHeight: 1.6
        }}>
          Create interactive polls in seconds. Share the link with your audience, and watch votes update live as they arrive.
        </p>

        {/* Primary CTA Buttons */}
        <div className="flex justify-between items-center gap-4" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-primary btn-lg"
            onClick={() => navigate(isAuthenticated ? 'create' : 'login')}
          >
            <PlusCircle size={18} />
            Create a Live Poll
          </button>

          {isAuthenticated ? (
            <button 
              className="btn btn-secondary btn-lg"
              onClick={() => navigate('dashboard')}
            >
              Go to My Polls
              <ArrowRight size={18} />
            </button>
          ) : (
            <button 
              className="btn btn-secondary btn-lg"
              onClick={() => navigate('register')}
            >
              Sign Up Free
            </button>
          )}
        </div>
      </div>

      {/* Join a poll directly box */}
      <div className="card" style={{ maxWidth: '520px', margin: '0 auto 3.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', textAlign: 'center' }}>
          Have a Poll ID or Code?
        </h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '1.25rem' }}>
          Enter a poll identifier to jump straight to voting or viewing results
        </p>

        <form onSubmit={handleJoinPoll} className="flex gap-2">
          <input 
            type="text" 
            placeholder="e.g. 66ebcd8f..." 
            value={pollCode}
            onChange={(e) => {
              setPollCode(e.target.value);
              setCodeError('');
            }}
            className="form-input"
            style={{ fontSize: '0.9rem' }}
          />
          <button type="submit" className="btn btn-primary">
            Join
          </button>
        </form>

        {codeError && (
          <p style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '0.5rem', textAlign: 'center' }}>
            {codeError}
          </p>
        )}
      </div>

      {/* Highlights Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1.5rem',
        marginBottom: '3rem'
      }}>
        <div className="card-white">
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: '#eff6ff',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem'
          }}>
            <Zap size={20} />
          </div>
          <h4 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.4rem' }}>
            Instant Live Updates
          </h4>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Redis Pub/Sub powers sub-millisecond broadcasts through WebSockets. No page reloads needed.
          </p>
        </div>

        <div className="card-white">
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: '#f0fdf4',
            color: 'var(--success)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem'
          }}>
            <ShieldCheck size={20} />
          </div>
          <h4 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.4rem' }}>
            Double-Vote Protection
          </h4>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            In-memory Redis sets and backend fingerprint verification prevent participants from voting twice.
          </p>
        </div>

        <div className="card-white">
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: '#f8fafc',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem'
          }}>
            <BarChart3 size={20} />
          </div>
          <h4 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.4rem' }}>
            Presentation View
          </h4>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Clean, high-contrast visual display with shareable QR codes, ready for meetings and live events.
          </p>
        </div>
      </div>
    </div>
  );
}
