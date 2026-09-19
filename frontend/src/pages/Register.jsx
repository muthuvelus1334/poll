import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserPlus, AlertCircle } from 'lucide-react';

export function Register({ navigate }) {
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await register(username, email, password);
      navigate('dashboard');
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '420px', margin: '2rem auto' }}>
      <div className="card-white">
        <div className="text-center mb-6">
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.35rem' }}>Create Account</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Start creating real-time interactive polls
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
            <label className="form-label">Username</label>
            <input 
              type="text"
              required
              minLength={3}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. alexsmith"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input 
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password (min. 6 characters)</label>
            <input 
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="form-input"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: '0.5rem' }}
          >
            <UserPlus size={16} />
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        <div className="text-center mt-6" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <button 
            type="button" 
            onClick={() => navigate('login')}
            style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
          >
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
