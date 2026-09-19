import React from 'react';
import { useAuth } from '../context/AuthContext';
import { BarChart2, PlusCircle, User, LogOut, LayoutDashboard } from 'lucide-react';

export function Navbar({ currentView, navigate }) {
  const { user, logout, isAuthenticated } = useAuth();

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <div className="brand-logo" onClick={() => navigate('home')}>
          <div className="brand-icon">
            <BarChart2 size={20} />
          </div>
          <span>LivePoll</span>
        </div>

        <div className="nav-links">
          <button 
            className={`nav-link ${currentView === 'home' ? 'active' : ''}`}
            onClick={() => navigate('home')}
          >
            Home
          </button>

          {isAuthenticated && (
            <>
              <button 
                className={`nav-link ${currentView === 'dashboard' ? 'active' : ''}`}
                onClick={() => navigate('dashboard')}
              >
                <span className="flex items-center gap-2">
                  <LayoutDashboard size={16} />
                  My Polls
                </span>
              </button>
              <button 
                className={`btn btn-primary btn-sm`}
                onClick={() => navigate('create')}
              >
                <PlusCircle size={15} />
                Create Poll
              </button>
            </>
          )}

          {!isAuthenticated ? (
            <div className="flex items-center gap-2">
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => navigate('login')}
              >
                Sign In
              </button>
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => navigate('register')}
              >
                Sign Up
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-2" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                <User size={15} />
                <strong>{user.username}</strong>
              </span>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  logout();
                  navigate('home');
                }}
                title="Sign Out"
              >
                <LogOut size={15} />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
