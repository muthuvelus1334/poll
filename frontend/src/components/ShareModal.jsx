import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, X, ExternalLink } from 'lucide-react';

export function ShareModal({ pollId, pollTitle, isOpen, onClose, navigate }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const voteUrl = `${window.location.origin}/?view=vote&id=${pollId}`;
  const resultsUrl = `${window.location.origin}/?view=results&id=${pollId}`;

  const copyToClipboard = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link', err);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Share Poll</h3>
          <button 
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            style={{ padding: '0.25rem 0.5rem' }}
          >
            <X size={16} />
          </button>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
          {pollTitle || 'Invite your audience to vote live.'}
        </p>

        {/* QR Code Container */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          backgroundColor: '#ffffff',
          padding: '1.25rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-light)',
          marginBottom: '1.25rem',
        }}>
          <QRCodeSVG value={voteUrl} size={160} level="M" />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
            Scan with phone camera to vote
          </span>
        </div>

        {/* Link box */}
        <div className="form-group mb-4">
          <label className="form-label" style={{ fontSize: '0.8rem' }}>Direct Voting Link</label>
          <div className="flex gap-2">
            <input 
              type="text" 
              readOnly 
              value={voteUrl} 
              className="form-input" 
              style={{ fontSize: '0.85rem', backgroundColor: 'var(--bg-surface)' }}
            />
            <button 
              className={`btn ${copied ? 'btn-secondary' : 'btn-primary'}`}
              onClick={() => copyToClipboard(voteUrl)}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 justify-between mt-6">
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => {
              onClose();
              navigate('vote', pollId);
            }}
          >
            <ExternalLink size={14} />
            Open Voting Page
          </button>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => {
              onClose();
              navigate('results', pollId);
            }}
          >
            <ExternalLink size={14} />
            Open Live Results
          </button>
        </div>
      </div>
    </div>
  );
}
