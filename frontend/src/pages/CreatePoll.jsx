import React, { useState } from 'react';
import { api } from '../services/api';
import { Plus, Trash2, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';

export function CreatePoll({ navigate }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleOptionChange = (index, value) => {
    const updated = [...options];
    updated[index] = value;
    setOptions(updated);
  };

  const handleAddOption = () => {
    if (options.length < 8) {
      setOptions([...options, '']);
    }
  };

  const handleRemoveOption = (index) => {
    if (options.length > 2) {
      const updated = options.filter((_, i) => i !== index);
      setOptions(updated);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (cleanTitle.length < 3) {
      setError('Poll title must be at least 3 characters.');
      return;
    }

    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (cleanOptions.length < 2) {
      setError('Please provide at least 2 distinct non-empty options.');
      return;
    }

    // Check for duplicates
    const lowerSet = new Set(cleanOptions.map((o) => o.toLowerCase()));
    if (lowerSet.size !== cleanOptions.length) {
      setError('All options must be unique.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const newPoll = await api.createPoll({
        title: cleanTitle,
        description: description.trim(),
        options: cleanOptions,
      });

      // Jump directly to the newly created live poll results!
      navigate('results', newPoll.id);
    } catch (err) {
      setError(err.message || 'Failed to create poll. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      <button 
        className="btn btn-secondary btn-sm mb-4"
        onClick={() => navigate('dashboard')}
      >
        <ArrowLeft size={15} />
        Back to Dashboard
      </button>

      <div className="card-white">
        <div className="mb-6">
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Create a Live Poll
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Set up your question and options. Your audience will be able to vote immediately.
          </p>
        </div>

        {error && (
          <div className="alert alert-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Poll Question / Title *</label>
            <input 
              type="text"
              required
              placeholder="e.g. Which web framework do you prefer for production?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="form-input"
              maxLength={250}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description (Optional)</label>
            <textarea 
              placeholder="Add additional context, voting rules, or instructions..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="form-textarea"
              rows={2}
              maxLength={500}
            />
          </div>

          {/* Voting Options */}
          <div className="form-group">
            <label className="form-label">Voting Options (2 to 8 options) *</label>
            <div style={{ display: 'grid', gap: '0.65rem' }}>
              {options.map((opt, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', width: '22px' }}>
                    {index + 1}.
                  </span>
                  <input 
                    type="text"
                    required
                    placeholder={`Option ${index + 1}`}
                    value={opt}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    className="form-input"
                  />
                  {options.length > 2 && (
                    <button 
                      type="button" 
                      onClick={() => handleRemoveOption(index)}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.55rem' }}
                      title="Remove option"
                    >
                      <Trash2 size={15} color="var(--danger)" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {options.length < 8 && (
              <button 
                type="button" 
                onClick={handleAddOption}
                className="btn btn-secondary btn-sm mt-4"
              >
                <Plus size={14} />
                Add Another Option
              </button>
            )}
          </div>

          <div className="flex justify-between items-center mt-6 pt-4" style={{ borderTop: '1px solid var(--border-light)' }}>
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={() => navigate('dashboard')}
            >
              Cancel
            </button>

            <button 
              type="submit" 
              disabled={loading || !title.trim()}
              className="btn btn-primary"
            >
              <CheckCircle2 size={16} />
              {loading ? 'Creating Poll...' : 'Publish & Start Live Poll'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
