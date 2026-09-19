import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { CreatePoll } from './pages/CreatePoll';
import { VotePage } from './pages/VotePage';
import { ResultsPage } from './pages/ResultsPage';

function AppContent() {
  const { isAuthenticated, loading } = useAuth();
  const [currentView, setCurrentView] = useState('home');
  const [activePollId, setActivePollId] = useState(null);

  // Parse URL query parameters for navigation
  const syncStateFromURL = () => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view') || 'home';
    const id = params.get('id') || null;

    setCurrentView(view);
    setActivePollId(id);
  };

  useEffect(() => {
    syncStateFromURL();
    window.addEventListener('popstate', syncStateFromURL);
    return () => window.removeEventListener('popstate', syncStateFromURL);
  }, []);

  const navigate = (view, pollId = null) => {
    setCurrentView(view);
    setActivePollId(pollId);

    const url = new URL(window.location.href);
    url.searchParams.set('view', view);
    if (pollId) {
      url.searchParams.set('id', pollId);
    } else {
      url.searchParams.delete('id');
    }
    window.history.pushState({}, '', url.toString());
    window.scrollTo(0, 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-between" style={{ minHeight: '100vh', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Loading application...</div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Navbar currentView={currentView} navigate={navigate} />

      <main className="main-content">
        {currentView === 'home' && <Home navigate={navigate} />}
        {currentView === 'login' && <Login navigate={navigate} />}
        {currentView === 'register' && <Register navigate={navigate} />}
        {currentView === 'dashboard' && (
          isAuthenticated ? <Dashboard navigate={navigate} /> : <Login navigate={navigate} />
        )}
        {currentView === 'create' && (
          isAuthenticated ? <CreatePoll navigate={navigate} /> : <Login navigate={navigate} />
        )}
        {currentView === 'vote' && (
          <VotePage pollId={activePollId} navigate={navigate} />
        )}
        {currentView === 'results' && (
          <ResultsPage pollId={activePollId} navigate={navigate} />
        )}
      </main>

      <footer style={{
        borderTop: '1px solid var(--border-light)',
        padding: '1.5rem 1.25rem',
        textAlign: 'center',
        backgroundColor: '#ffffff',
        fontSize: '0.85rem',
        color: 'var(--text-secondary)'
      }}>
        <div style={{ maxWidth: '1080px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <strong>LivePoll</strong> &mdash; Built with React, Go (Gin), MongoDB & Redis
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            HCL &bull; GUVI Developer Internship Project
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
