import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from './supabaseClient';
import './index.css';

const SESSION_STORAGE_KEY = 'dunk_on_ai_session';
const LAST_ACTIVITY_KEY = 'dunk_on_ai_last_activity';
const THEME_STORAGE_KEY = 'dunk_on_ai_theme';
const NOTIFICATIONS_STORAGE_KEY = 'dunk_on_ai_notifications';
const IDLE_TIMEOUT_MS = 10 * 60 * 1000;

const parseApiPayload = async (response) => {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
};

const getApiErrorMessage = (payload, fallbackMessage) => {
  const baseMessage = payload?.error?.message || payload?.raw || fallbackMessage;
  const debugDetails = payload?.error?.debug;

  if (!debugDetails) {
    return baseMessage;
  }

  const debugMessage = typeof debugDetails === 'string'
    ? debugDetails
    : debugDetails.message || JSON.stringify(debugDetails);

  return `${baseMessage} (${debugMessage})`;
};


const getLineupSizeBySport = (sport) => {
  const normalized = (sport || '').toLowerCase();
  if (normalized === 'football') return 11;
  if (normalized === 'basketball') return 5;
  if (normalized === 'volleyball') return 6;
  return 5;
};

// Reusable animated auth screen wrapper for both login and signup.
const AuthScene = ({ title, subtitle, children }) => (
  <div className="login-page">
    <div className="background-animation">
      <div className="grid-lines"></div>
      <div className="floating-orb orb-1"></div>
      <div className="floating-orb orb-2"></div>
      <div className="floating-orb orb-3"></div>
    </div>

    <motion.div
      className="player-left"
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 1, delay: 0.2 }}
    >
      <div className="player-silhouette"></div>
    </motion.div>

    <motion.div
      className="player-right"
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 1, delay: 0.2 }}
    >
      <div className="player-silhouette"></div>
    </motion.div>

    <motion.div
      className="login-container"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        className="logo"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.3 }}
      >
        <svg viewBox="0 0 200 80" className="basketball-wings">
          <path d="M 30,40 Q 20,30 10,35 Q 5,40 10,45 Q 20,50 30,40" fill="white" stroke="#00d4ff" strokeWidth="2" />
          <path d="M 40,40 Q 30,25 15,28 Q 8,35 15,42 Q 30,45 40,40" fill="white" stroke="#00d4ff" strokeWidth="2" />
          <path d="M 50,40 Q 38,20 18,22 Q 10,30 18,38 Q 38,40 50,40" fill="white" stroke="#00d4ff" strokeWidth="2" />
          <circle cx="100" cy="40" r="22" fill="#ff8557" stroke="#d86744" strokeWidth="2" />
          <path d="M 78,40 Q 100,35 122,40" stroke="#d86744" strokeWidth="1.5" fill="none" />
          <path d="M 78,40 Q 100,45 122,40" stroke="#d86744" strokeWidth="1.5" fill="none" />
          <path d="M 100,18 Q 95,40 100,62" stroke="#d86744" strokeWidth="1.5" fill="none" />
          <path d="M 100,18 Q 105,40 100,62" stroke="#d86744" strokeWidth="1.5" fill="none" />
          <path d="M 170,40 Q 180,30 190,35 Q 195,40 190,45 Q 180,50 170,40" fill="white" stroke="#00d4ff" strokeWidth="2" />
          <path d="M 160,40 Q 170,25 185,28 Q 192,35 185,42 Q 170,45 160,40" fill="white" stroke="#00d4ff" strokeWidth="2" />
          <path d="M 150,40 Q 162,20 182,22 Q 190,30 182,38 Q 162,40 150,40" fill="white" stroke="#00d4ff" strokeWidth="2" />
        </svg>
      </motion.div>

      <motion.h1
        className="app-title"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.5 }}
      >
        {title}
      </motion.h1>

      {subtitle ? <p className="auth-subtitle">{subtitle}</p> : null}

      {children}
    </motion.div>

    <div className="data-viz left-viz">
      {[40, 70, 55, 80, 60, 90].map((height, index) => (
        <motion.div
          key={`left-${index}`}
          className="bar"
          style={{ height: `${height}%` }}
          initial={{ height: 0 }}
          animate={{ height: `${height}%` }}
          transition={{ duration: 0.8, delay: 1 + index * 0.1 }}
        />
      ))}
    </div>

    <div className="data-viz right-viz">
      {[60, 85, 45, 75, 55, 95].map((height, index) => (
        <motion.div
          key={`right-${index}`}
          className="bar"
          style={{ height: `${height}%` }}
          initial={{ height: 0 }}
          animate={{ height: `${height}%` }}
          transition={{ duration: 0.8, delay: 1 + index * 0.1 }}
        />
      ))}
    </div>
  </div>
);

const LoginPage = ({ onLogin, onGoToSignup }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email || !password) {
      return;
    }

    setAuthError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const payload = await parseApiPayload(response);

      if (!response.ok) {
        throw new Error(getApiErrorMessage(payload, `Login failed (${response.status})`));
      }

      onLogin(payload);
    } catch (error) {
      setAuthError(error.message || 'Login failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthScene title="Fantasy Basketball App" subtitle="Log in to continue">
      <form onSubmit={handleSubmit} className="login-form">
        <motion.input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.6 }}
          required
        />

        <motion.input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.7 }}
          required
        />

        <motion.button
          type="submit"
          className="login-btn"
          disabled={isSubmitting}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.8 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {isSubmitting ? 'Please wait...' : 'Log In'}
        </motion.button>

        <motion.div
          className="login-footer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.9 }}
        >
          <button type="button" className="link-button forgot-password">Forgot Password?</button>
          <button type="button" className="link-button sign-up" onClick={onGoToSignup}>Sign Up</button>
        </motion.div>

        {authError ? <p className="auth-feedback error">{authError}</p> : null}
      </form>
    </AuthScene>
  );
};

const SignupPage = ({ onSignup, onGoToLogin }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authInfo, setAuthInfo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!email || !password || !confirmPassword) {
      setAuthError('Email, password, and confirm password are required.');
      return;
    }

    if (password !== confirmPassword) {
      setAuthError('Passwords do not match.');
      return;
    }

    setAuthError('');
    setAuthInfo('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          username: username.trim() || undefined,
        }),
      });
      const payload = await parseApiPayload(response);

      if (!response.ok) {
        throw new Error(getApiErrorMessage(payload, `Signup failed (${response.status})`));
      }

      if (payload?.auth?.access_token) {
        onSignup(payload);
        return;
      }

      setAuthInfo('Signup successful. Check your email, then log in.');
    } catch (error) {
      setAuthError(error.message || 'Signup failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthScene title="Create Account" subtitle="Set up your fantasy profile">
      <form onSubmit={handleSubmit} className="login-form">
        <motion.input
          type="text"
          placeholder="Username (optional)"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.6 }}
        />

        <motion.input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.7 }}
          required
        />

        <motion.input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.8 }}
          required
        />

        <motion.input
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.9 }}
          required
        />

        <motion.button
          type="submit"
          className="login-btn"
          disabled={isSubmitting}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {isSubmitting ? 'Please wait...' : 'Create Account'}
        </motion.button>

        <motion.div
          className="login-footer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 1.1 }}
        >
          <span className="auth-hint">Already have an account?</span>
          <button type="button" className="link-button sign-up" onClick={onGoToLogin}>Log In</button>
        </motion.div>

        {authError ? <p className="auth-feedback error">{authError}</p> : null}
        {authInfo ? <p className="auth-feedback info">{authInfo}</p> : null}
      </form>
    </AuthScene>
  );
};

// Enhanced home page with performance stats, upcoming games, and CTA.
const HomePage = ({ authUser, onLogout, onSettings, onNavigate }) => {
  const [matchHistory, setMatchHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedGame, setSelectedGame] = useState(null);

  useEffect(() => {
    if (!authUser?.id) return;
    setHistoryLoading(true);
    fetch(`/api/users/${authUser.id}/match-history`)
      .then(r => r.json())
      .then(data => setMatchHistory(data.games || []))
      .catch(() => setMatchHistory([]))
      .finally(() => setHistoryLoading(false));
  }, [authUser?.id]);

  const wins = matchHistory.filter(g => g.winner === 'you').length;
  const losses = matchHistory.filter(g => g.winner === 'ai').length;
  const winRate = matchHistory.length ? ((wins / matchHistory.length) * 100).toFixed(1) : null;
  const avgPoints = matchHistory.length
    ? (matchHistory.reduce((s, g) => s + g.yourScore, 0) / matchHistory.length).toFixed(1)
    : null;

  return (
    <div className="home-page">
      <div className="home-background">
        <div className="circuit-pattern"></div>
      </div>

      <header className="page-header">
        <div className="header-content">
          <h1 className="page-logo">DUNK ON AI</h1>
          <div className="header-actions">
            <button className="icon-btn" onClick={onSettings}>⚙️</button>
          </div>
        </div>
      </header>

      <main className="main-content">
        {authUser ? <p className="signed-in-label">Signed in as {authUser.email}</p> : null}

        {/* Performance Section */}
        <section className="performance-section">
          <div className="section-header">
            <h2 className="section-title">Your Performance</h2>
            <button className="view-all-btn" onClick={() => onNavigate('stats')}>
              View Details →
            </button>
          </div>

          <div className="stats-grid-large">
            <motion.div
              className="stat-card-large"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="stat-icon-large">🏆</div>
              <div className="stat-content-large">
                <div className="stat-value-large">{wins}-{losses}</div>
                <div className="stat-label-large">Win-Loss Record</div>
                {winRate !== null && <div className="stat-extra">{winRate}% Win Rate</div>}
              </div>
            </motion.div>

            <motion.div
              className="stat-card-large"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="stat-icon-large">📊</div>
              <div className="stat-content-large">
                <div className="stat-value-large">{avgPoints ?? '—'}</div>
                <div className="stat-label-large">Avg Points/Game</div>
                {matchHistory.length > 0 && <div className="stat-extra">{matchHistory.length} games played</div>}
              </div>
            </motion.div>
          </div>
        </section>

        {/* Past Games Section */}
        <section className="games-section">
          <div className="section-header">
            <h2 className="section-title">Past Games</h2>
            <button className="view-all-btn" onClick={() => onNavigate('matchup')}>Play →</button>
          </div>

          <div className="games-list">
            {historyLoading ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', padding: '12px 0' }}>Loading...</p>
            ) : matchHistory.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', padding: '12px 0' }}>
                No games yet. Head to Match Up to play your first game!
              </p>
            ) : matchHistory.slice(0, 5).map((game, index) => (
              <motion.div
                key={index}
                className={`game-card-enhanced ${game.winner === 'you' ? '' : 'live'}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.02 }}
                onClick={() => setSelectedGame(game)}
                style={{ cursor: 'pointer' }}
              >
                <div className="game-info">
                  <div className="game-date">{new Date(game.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                  <div className="game-quarter" style={{ color: game.winner === 'you' ? '#4ade80' : '#f87171' }}>
                    {game.winner === 'you' ? 'WIN' : 'LOSS'}
                  </div>
                </div>

                <div className="game-matchup-enhanced">
                  <div className="team-section">
                    <div className="team-avatar user-avatar"><span>👤</span></div>
                    <div className="team-details">
                      <div className="team-name">Your Team</div>
                      <div className="team-label">YOU</div>
                    </div>
                    <div className="team-score">{game.yourScore}</div>
                  </div>

                  <div className="vs-divider">VS</div>

                  <div className="team-section">
                    <div className="team-score">{game.aiScore}</div>
                    <div className="team-details">
                      <div className="team-name">AI Titans</div>
                      <div className="team-label ai-label">AI</div>
                    </div>
                    <div className="team-avatar ai-avatar"><span>🤖</span></div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Build Team CTA */}
        <motion.section
          className="cta-section"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="cta-content">
            <h3 className="cta-title">Build Your Dream Team</h3>
            <p className="cta-text">Select top players and challenge AI opponents</p>
            <button className="cta-btn" onClick={() => onNavigate('stats')}>
              View Stats →
            </button>
          </div>
        </motion.section>
      </main>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <button className="nav-btn active">
          <span className="icon">🏠</span>
          <span>Home</span>
        </button>
        <button className="nav-btn" onClick={() => onNavigate('stats')}>
          <span className="icon">📊</span>
          <span>Stats</span>
        </button>
        <button className="nav-btn" onClick={() => onNavigate('matchup')}>
          <span className="icon">⚔️</span>
          <span>Match Up</span>
        </button>
        <button className="nav-btn" onClick={onSettings}>
          <span className="icon">👤</span>
          <span>Profile</span>
        </button>
      </nav>

      {/* Game Detail Modal */}
      {selectedGame && (
        <div
          className="game-modal-overlay"
          onClick={() => setSelectedGame(null)}
        >
          <motion.div
            className="game-modal-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="game-modal-header">
              <h3 className="game-modal-date">
                {new Date(selectedGame.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </h3>
              <span className={`game-modal-result ${selectedGame.winner === 'you' ? 'win' : 'loss'}`}>
                {selectedGame.winner === 'you' ? 'YOU WON' : 'AI WON'} &nbsp; {selectedGame.yourScore} – {selectedGame.aiScore}
              </span>
            </div>

            <div className="game-modal-columns">
              {/* Your Team */}
              <div className="game-modal-column">
                <div className="game-modal-team-title your">YOUR TEAM</div>
                {(selectedGame.yourPlayers || []).map((p, i) => (
                  <div key={i} className="game-modal-player-card">
                    <div className="game-modal-player-name">{p.name}</div>
                    <div className="game-modal-player-position">{p.position}</div>
                    <div className="game-modal-player-stats">
                      <span>{p.pts?.toFixed ? p.pts.toFixed(1) : p.pts ?? '—'} PTS</span>
                      <span>{p.reb?.toFixed ? p.reb.toFixed(1) : p.reb ?? '—'} REB</span>
                      <span>{p.ast?.toFixed ? p.ast.toFixed(1) : p.ast ?? '—'} AST</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* AI Team */}
              <div className="game-modal-column">
                <div className="game-modal-team-title ai">AI TITANS</div>
                {(selectedGame.aiPlayers || []).map((p, i) => (
                  <div key={i} className="game-modal-player-card">
                    <div className="game-modal-player-name">{p.name}</div>
                    <div className="game-modal-player-position">{p.position}</div>
                    <div className="game-modal-player-stats">
                      <span>{p.pts?.toFixed ? p.pts.toFixed(1) : p.pts ?? '—'} PTS</span>
                      <span>{p.reb?.toFixed ? p.reb.toFixed(1) : p.reb ?? '—'} REB</span>
                      <span>{p.ast?.toFixed ? p.ast.toFixed(1) : p.ast ?? '—'} AST</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              className="game-modal-close"
              onClick={() => setSelectedGame(null)}
            >
              Close
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
};

const PAGE_SIZE = 8;

const TEAM_LIMIT = 5;

// Player stats page — shows all players with stats, lets user tap to select then add to roster.
const StatsPage = ({ onBack, onNavigate, authUser, onRosterSaved }) => {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  // IDs already saved in the user's roster.
  const [rosterIds, setRosterIds] = useState([]);
  // IDs the user has tapped but not yet added (pending selection).
  const [pendingIds, setPendingIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  // Player detail subpage
  const [subPage, setSubPage] = useState('list');
  const [detailPlayer, setDetailPlayer] = useState(null);
  const [gameLog, setGameLog] = useState([]);
  const [gameLogLoading, setGameLogLoading] = useState(false);

  useEffect(() => {
    if (!authUser) return;

    const load = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const [playersResult, rosterResult] = await Promise.all([
          supabase
            .from('players')
            .select('id, name, position, teams(name), game_stats(points, rebounds, assists, steals, blocks)')
            .order('name', { ascending: true }),
          supabase.from('user_team_players').select('player_id').eq('user_id', authUser.id),
        ]);

        if (playersResult.error) {
          console.error('players query error:', playersResult.error);
          setLoadError(playersResult.error.message || 'Failed to load players.');
          setPlayers([]);
          return;
        }

        if (rosterResult.data?.length) {
          setRosterIds(rosterResult.data.map((r) => r.player_id));
        }

        setPlayers((playersResult.data || []).map((player) => {
          const stats = player.game_stats || [];
          const games = stats.length;
          const totals = stats.reduce((acc, g) => ({
            pts: acc.pts + (g.points || 0),
            reb: acc.reb + (g.rebounds || 0),
            ast: acc.ast + (g.assists || 0),
            stl: acc.stl + (g.steals || 0),
            blk: acc.blk + (g.blocks || 0),
          }), { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0 });
          return {
            player_id: player.id,
            player_name: player.name ?? 'Unknown',
            position: player.position ?? '—',
            team: player.teams?.name ?? 'Unknown Team',
            games,
            pts: games ? (totals.pts / games).toFixed(1) : '—',
            reb: games ? (totals.reb / games).toFixed(1) : '—',
            ast: games ? (totals.ast / games).toFixed(1) : '—',
            stl: games ? (totals.stl / games).toFixed(1) : '—',
            blk: games ? (totals.blk / games).toFixed(1) : '—',
          };
        }));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [authUser]);

  const togglePending = (player) => {
    if (rosterIds.includes(player.player_id)) return;
    setSaveMessage('');
    const rosterPositions = players.filter(p => rosterIds.includes(p.player_id)).map(p => p.position);
    setPendingIds((prev) => {
      if (prev.includes(player.player_id)) return prev.filter((id) => id !== player.player_id);
      if (rosterIds.length + prev.length >= TEAM_LIMIT) return prev;
      if (rosterPositions.includes(player.position)) {
        setSaveMessage(`${player.position} is already on your roster.`);
        return prev;
      }
      const pendingPositions = players.filter(p => prev.includes(p.player_id)).map(p => p.position);
      if (pendingPositions.includes(player.position)) {
        setSaveMessage(`${player.position} is already selected.`);
        return prev;
      }
      return [...prev, player.player_id];
    });
  };

  const openDetail = async (player) => {
    setDetailPlayer(player);
    setSubPage('detail');
    setGameLog([]);
    setGameLogLoading(true);
    setDetailAddMessage('');
    const { data } = await supabase
      .from('game_stats')
      .select('game_date, points, rebounds, assists, steals, blocks, turnovers, minutes_played')
      .eq('player_id', player.player_id)
      .order('game_date', { ascending: false });
    setGameLog(data || []);
    setGameLogLoading(false);
  };

  const [detailAdding, setDetailAdding] = useState(false);
  const [detailAddMessage, setDetailAddMessage] = useState('');

  const addDetailPlayerToRoster = async (playerId) => {
    if (!authUser?.id || rosterIds.includes(playerId)) return;
    if (rosterIds.length + pendingIds.length >= TEAM_LIMIT) {
      setDetailAddMessage('Roster is full (5 players max).');
      return;
    }
    const rosterPositions = players.filter(p => rosterIds.includes(p.player_id)).map(p => p.position);
    const pendingPositions = players.filter(p => pendingIds.includes(p.player_id)).map(p => p.position);
    const playerPosition = detailPlayer?.position;
    if (playerPosition && (rosterPositions.includes(playerPosition) || pendingPositions.includes(playerPosition))) {
      setDetailAddMessage(`${playerPosition} is already on your roster.`);
      return;
    }
    setDetailAdding(true);
    setDetailAddMessage('');
    try {
      const { error } = await supabase
        .from('user_team_players')
        .insert([{ user_id: authUser.id, player_id: playerId, role: 'starter' }]);
      if (error) throw error;
      setRosterIds((prev) => [...prev, playerId]);
      setPendingIds((prev) => prev.filter((id) => id !== playerId));
      setDetailAddMessage('Added to roster!');
      if (onRosterSaved) onRosterSaved(authUser.id);
    } catch (err) {
      setDetailAddMessage(err.message || 'Failed to add player.');
    } finally {
      setDetailAdding(false);
    }
  };

  const addToRoster = async () => {
    if (!authUser?.id || pendingIds.length === 0) return;
    setSaving(true);
    setSaveMessage('');
    try {
      const { error } = await supabase
        .from('user_team_players')
        .insert(pendingIds.map((pid) => ({ user_id: authUser.id, player_id: pid, role: 'starter' })));
      if (error) throw error;

      // Move pending to roster locally so UI updates immediately.
      setRosterIds((prev) => [...prev, ...pendingIds]);
      setPendingIds([]);
      setSaveMessage('Added to roster!');
      if (onRosterSaved) onRosterSaved(authUser.id);
    } catch (err) {
      console.error('add to roster error:', err);
      setSaveMessage(err.message || 'Failed to add to roster.');
    } finally {
      setSaving(false);
    }
  };

  const filteredPlayers = searchQuery.trim()
    ? players.filter((p) => {
        const q = searchQuery.toLowerCase();
        return p.player_name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q) || p.position.toLowerCase().includes(q);
      })
    : players;
  const totalPages = Math.ceil(filteredPlayers.length / PAGE_SIZE);
  const pagePlayers = filteredPlayers.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const canAdd = pendingIds.length > 0 && !saving;

  // ── Player detail subpage ──────────────────────────────────────────────────
  if (subPage === 'detail' && detailPlayer) {
    const inRoster = rosterIds.includes(detailPlayer.player_id);
    const rosterFull = rosterIds.length >= TEAM_LIMIT;
    const detailRosterPositions = players.filter(p => rosterIds.includes(p.player_id)).map(p => p.position);
    const detailPendingPositions = players.filter(p => pendingIds.includes(p.player_id)).map(p => p.position);
    const positionTaken = !inRoster && detailPlayer.position && (detailRosterPositions.includes(detailPlayer.position) || detailPendingPositions.includes(detailPlayer.position));
    const addBtnLabel = inRoster ? '★ In Roster' : detailAdding ? '...' : rosterFull ? 'Roster Full' : positionTaken ? `${detailPlayer.position} Taken` : '+ Add to Roster';
    const addBtnStyle = inRoster
      ? { background: '#22c55e', color: '#000', borderColor: '#22c55e' }
      : rosterFull || positionTaken
        ? { opacity: 0.4, cursor: 'default' }
        : {};
    return (
      <div className="stats-page">
        <div className="stats-background"><div className="circuit-pattern"></div></div>
        <header className="page-header">
          <div className="header-content">
            <button className="back-btn-new" onClick={() => setSubPage('list')}>←</button>
            <h1 className="page-title" style={{ fontSize: '1rem' }}>{detailPlayer.player_name}</h1>
            <button
              className="view-all-btn"
              style={{ fontSize: '0.75rem', padding: '5px 10px', ...addBtnStyle }}
              onClick={() => addDetailPlayerToRoster(detailPlayer.player_id)}
              disabled={inRoster || detailAdding || rosterFull || positionTaken}
            >
              {addBtnLabel}
            </button>
          </div>
        </header>
        <main className="stats-main">
          <section className="players-section">
            <div className="section-header">
              <h3 className="section-title">Game Log</h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{detailPlayer.position} • {detailPlayer.team}</span>
            </div>
            {detailAddMessage && (
              <p style={{ fontSize: '0.8rem', marginBottom: 8, color: detailAddMessage === 'Added to roster!' ? '#22c55e' : 'var(--error, #f87171)' }}>
                {detailAddMessage}
              </p>
            )}
            {gameLogLoading && <p className="signed-in-label">Loading games...</p>}
            {!gameLogLoading && gameLog.length === 0 && (
              <p className="signed-in-label">No game data available for this player.</p>
            )}
            <div className="matchup-ai-list">
              {gameLog.map((g, i) => (
                <div key={i} className="matchup-ai-item">
                  <div className="matchup-ai-left">
                    <div>
                      <div className="player-name">{new Date(g.game_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                      <div className="player-position">{g.minutes_played != null ? `${Number(g.minutes_played).toFixed(0)} MIN` : '—'}</div>
                    </div>
                  </div>
                  <div className="matchup-ai-right">
                    <span>{g.points ?? '—'} PTS</span>
                    <span>{g.rebounds ?? '—'} REB</span>
                    <span>{g.assists ?? '—'} AST</span>
                    <span>{g.steals ?? '—'} STL</span>
                    <span>{g.blocks ?? '—'} BLK</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>
        <nav className="bottom-nav">
          <button className="nav-btn" onClick={() => onNavigate('home')}><span className="icon">🏠</span><span>Home</span></button>
          <button className="nav-btn active"><span className="icon">📊</span><span>Stats</span></button>
          <button className="nav-btn" onClick={() => onNavigate('matchup')}><span className="icon">⚔️</span><span>Match Up</span></button>
          <button className="nav-btn" onClick={() => onNavigate('settings')}><span className="icon">👤</span><span>Profile</span></button>
        </nav>
      </div>
    );
  }

  return (
    <div className="stats-page">
      <div className="stats-background">
        <div className="circuit-pattern"></div>
      </div>

      <header className="page-header">
        <div className="header-content">
          <button className="back-btn-new" onClick={onBack}>←</button>
          <h1 className="page-title">Player Stats</h1>
          <button
            className="view-all-btn"
            style={{
              fontSize: '0.75rem',
              padding: '5px 10px',
              opacity: canAdd ? 1 : 0.4,
              cursor: canAdd ? 'pointer' : 'default',
            }}
            onClick={addToRoster}
            disabled={!canAdd}
          >
            {saving ? '...' : '+ Roster'}
          </button>
        </div>
      </header>

      <main className="stats-main">
        <div className="players-section">
          <div style={{ marginBottom: 12 }}>
            <input
              type="text"
              placeholder="Search by name, team or position..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(0); }}
              style={{
                width: '100%',
                padding: '9px 14px',
                borderRadius: 10,
                border: '1px solid var(--border, rgba(255,255,255,0.12))',
                background: 'var(--card-bg, rgba(255,255,255,0.05))',
                color: 'var(--text-primary, #fff)',
                fontSize: '0.9rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div className="section-header">
            <h3 className="section-title">All Players</h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Roster: {rosterIds.length}/{TEAM_LIMIT}
              {pendingIds.length > 0 && (
                <span style={{ color: 'var(--accent, #00d4ff)', marginLeft: 6 }}>
                  +{pendingIds.length} pending
                </span>
              )}
            </span>
          </div>

          {saveMessage && (
            <p style={{ fontSize: '0.8rem', marginBottom: 8, color: saveMessage === 'Added to roster!' ? 'var(--accent, #00d4ff)' : 'var(--error, #f87171)' }}>
              {saveMessage}
            </p>
          )}

          <div className="players-list">
            {loading && <p className="signed-in-label">Loading stats...</p>}
            {!loading && loadError && (
              <p className="signed-in-label" style={{ color: 'var(--error, #f87171)' }}>{loadError}</p>
            )}
            {!loading && !loadError && players.length === 0 && (
              <p className="signed-in-label">No players found.</p>
            )}
            {(() => {
              const takenPositions = new Set([
                ...players.filter(p => rosterIds.includes(p.player_id)).map(p => p.position),
                ...players.filter(p => pendingIds.includes(p.player_id)).map(p => p.position),
              ]);
              return pagePlayers.map((player, index) => {
              const inRoster = rosterIds.includes(player.player_id);
              const isPending = pendingIds.includes(player.player_id);
              const isPositionTaken = !inRoster && !isPending && takenPositions.has(player.position);
              const cardStyle = inRoster
                ? { border: '2px solid #22c55e', background: 'rgba(34,197,94,0.07)' }
                : isPending
                  ? { border: '2px solid var(--accent, #00d4ff)', background: 'rgba(0,212,255,0.07)' }
                  : isPositionTaken
                    ? { opacity: 0.45 }
                    : {};
              const badgeStyle = inRoster
                ? { background: '#22c55e', color: '#000', cursor: 'default' }
                : isPending
                  ? { background: 'var(--accent, #00d4ff)', color: '#000', cursor: 'pointer' }
                  : isPositionTaken
                    ? { opacity: 0.5, cursor: 'not-allowed' }
                    : { cursor: 'pointer' };
              return (
                <motion.div
                  key={player.player_id}
                  className="player-card"
                  style={cardStyle}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.07 }}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => openDetail(player)}
                >
                  <div className="player-avatar-section">
                    <div className="player-avatar-stats">
                      <div
                        className="jersey-number"
                        style={{
                          ...badgeStyle,
                          fontSize: player.position.length > 2 ? '0.55rem' : '0.8rem',
                          lineHeight: 1.1,
                          wordBreak: 'break-all',
                          textAlign: 'center',
                          overflow: 'hidden',
                        }}
                        title={inRoster ? 'In Roster' : isPending ? 'Tap to deselect' : 'Tap to select for roster'}
                        onClick={(e) => { e.stopPropagation(); togglePending(player); }}
                      >
                        {inRoster ? '★' : isPending ? '✓' : player.position}
                      </div>
                    </div>
                    <div className="player-info">
                      <div className="player-name">{player.player_name}</div>
                      <div className="player-position">
                        {player.position} • {player.team}
                        {inRoster && <span style={{ marginLeft: 6, fontSize: '0.7rem', color: '#22c55e' }}>IN ROSTER</span>}
                      </div>
                    </div>
                  </div>

                  <div className="player-stats-grid">
                    <div className="stat-item">
                      <div className="stat-value-small">{player.pts}</div>
                      <div className="stat-label-small">PTS</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-value-small">{player.reb}</div>
                      <div className="stat-label-small">REB</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-value-small">{player.ast}</div>
                      <div className="stat-label-small">AST</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-value-small">{player.games > 0 ? player.games : '—'}</div>
                      <div className="stat-label-small">GP</div>
                    </div>
                  </div>
                </motion.div>
              );
            });
          })()}
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 12 }}>
              <button
                className="view-all-btn"
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
              >
                ← Prev
              </button>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {currentPage + 1} / {totalPages}
              </span>
              <button
                className="view-all-btn"
                onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage === totalPages - 1}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </main>

      <nav className="bottom-nav">
        <button className="nav-btn" onClick={() => onNavigate('home')}>
          <span className="icon">🏠</span>
          <span>Home</span>
        </button>
        <button className="nav-btn active">
          <span className="icon">📊</span>
          <span>Stats</span>
        </button>
        <button className="nav-btn" onClick={() => onNavigate('matchup')}>
          <span className="icon">⚔️</span>
          <span>Match Up</span>
        </button>
        <button className="nav-btn" onClick={() => onNavigate('settings')}>
          <span className="icon">👤</span>
          <span>Profile</span>
        </button>
      </nav>
    </div>
  );
};

const AI_MOCK_POOL = [
  { id: 101, name: 'Orion Blaze', number: 2, position: 'PG', pts: 22.4, reb: 4.1, ast: 9.2 },
  { id: 102, name: 'Kai Mercer', number: 11, position: 'SG', pts: 26.8, reb: 5.0, ast: 4.9 },
  { id: 103, name: 'Darius Volt', number: 34, position: 'PF', pts: 18.6, reb: 10.4, ast: 2.8 },
  { id: 104, name: 'Zane Hollow', number: 25, position: 'SF', pts: 20.7, reb: 7.4, ast: 3.1 },
  { id: 105, name: 'Rex Carter', number: 55, position: 'C', pts: 15.2, reb: 12.0, ast: 1.5 },
];

const MatchupPage = ({ onBack, onNavigate, authUser, onNewNotification, roster, rosterLoading, onRosterUpdated }) => {
  const [highlightedRosterId, setHighlightedRosterId] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [removeMessage, setRemoveMessage] = useState('');
  const [aiPlayers, setAiPlayers] = useState(AI_MOCK_POOL);
  const [aiLoading, setAiLoading] = useState(false);
  const [simulation, setSimulation] = useState(null);
  const resultRef = useRef(null);

  useEffect(() => {
    fetchAiTeam();
  }, []);

  const fetchAiTeam = async () => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/matchup/ai-team');
      if (!res.ok) throw new Error('API unavailable');
      const data = await res.json();
      if (data.team && data.team.length > 0) {
        setAiPlayers(data.team);
      }
    } catch {
      // fallback to mock pool — data collection hasn't been run yet
      setAiPlayers(AI_MOCK_POOL);
    } finally {
      setAiLoading(false);
    }
  };

  const removeFromRoster = async () => {
    if (!authUser?.id || !highlightedRosterId) return;
    setRemoving(true);
    setRemoveMessage('');
    try {
      const { error } = await supabase
        .from('user_team_players')
        .delete()
        .eq('user_id', authUser.id)
        .eq('player_id', highlightedRosterId);
      if (error) throw error;
      setHighlightedRosterId(null);
      if (onRosterUpdated) onRosterUpdated(authUser.id);
    } catch (err) {
      console.error('remove from roster error:', err);
      setRemoveMessage(err.message || 'Failed to remove player.');
    } finally {
      setRemoving(false);
    }
  };

  const summarizeTeam = (teamPlayers) => {
    const totals = teamPlayers.reduce((acc, p) => ({
      pts: acc.pts + (Number(p.pts) || 0),
      reb: acc.reb + (Number(p.reb) || 0),
      ast: acc.ast + (Number(p.ast) || 0),
    }), { pts: 0, reb: 0, ast: 0 });
    const size = teamPlayers.length || 1;
    const avg = { pts: totals.pts / size, reb: totals.reb / size, ast: totals.ast / size };
    return { ...avg, power: avg.pts * 1.45 + avg.reb * 1.15 + avg.ast * 1.35 };
  };

  const yourTeamStats = summarizeTeam(roster);
  const aiTeamStats = summarizeTeam(aiPlayers);
  const winChance = Math.max(20, Math.min(80, Math.round(50 + (yourTeamStats.power - aiTeamStats.power) * 1.4)));

  const runSimulation = () => {
    if (roster.length === 0) return;
    const nextAiStats = summarizeTeam(aiPlayers);
    const nextWinChance = Math.max(20, Math.min(80, Math.round(50 + (yourTeamStats.power - nextAiStats.power) * 1.4)));
    const userWon = Math.random() <= nextWinChance / 100;
    const yourScore = Math.round(yourTeamStats.pts * 3.3 + yourTeamStats.ast * 1.6 + yourTeamStats.reb * 0.8)
      + Math.round((Math.random() - 0.5) * 16) + (userWon ? 4 : -2);
    const aiScore = Math.round(nextAiStats.pts * 3.3 + nextAiStats.ast * 1.6 + nextAiStats.reb * 0.8)
      + Math.round((Math.random() - 0.5) * 16) + (userWon ? -2 : 4);
    const winner = yourScore >= aiScore ? 'you' : 'ai';
    setSimulation({ yourScore, aiScore, winner });
    const yourPlayerSnap = roster.map(p => ({ name: p.player_name, position: p.position, pts: p.pts, reb: p.reb, ast: p.ast }));
    const aiPlayerSnap = aiPlayers.map(p => ({ name: p.name, position: p.position, pts: p.pts, reb: p.reb, ast: p.ast }));
    if (authUser?.id) {
      fetch(`/api/users/${authUser.id}/match-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yourScore, aiScore, winner, yourPlayers: yourPlayerSnap, aiPlayers: aiPlayerSnap }),
      }).catch(err => console.error('Failed to save match:', err));
    }
    if (onNewNotification) {
      onNewNotification({
        id: `match-${Date.now()}`,
        type: 'match_result',
        title: yourScore >= aiScore ? 'Match Won' : 'Match Lost',
        message: `Final score: You ${yourScore} - ${aiScore} AI Titans`,
        createdAt: new Date().toISOString(),
      });
    }
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 20);
  };

  const statRows = [
    { label: 'PTS', your: yourTeamStats.pts, ai: aiTeamStats.pts },
    { label: 'REB', your: yourTeamStats.reb, ai: aiTeamStats.reb },
    { label: 'AST', your: yourTeamStats.ast, ai: aiTeamStats.ast },
    { label: 'POWER', your: yourTeamStats.power, ai: aiTeamStats.power },
  ];

  return (
    <div className="stats-page">
      <div className="stats-background">
        <div className="circuit-pattern"></div>
      </div>

      <header className="page-header">
        <div className="header-content">
          <button className="back-btn-new" onClick={onBack}>←</button>
          <h1 className="page-title">Match Up</h1>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="view-all-btn" style={{ fontSize: '0.75rem', padding: '5px 10px' }}
              onClick={() => { setSimulation(null); fetchAiTeam(); }} disabled={aiLoading}>
              {aiLoading ? '...' : 'New AI'}
            </button>
            <button className="view-all-btn" style={{ fontSize: '0.75rem', padding: '5px 10px' }}
              onClick={runSimulation} disabled={roster.length === 0}>
              Simulate
            </button>
          </div>
        </div>
      </header>

      <main className="stats-main">
        <section className="matchup-hero-card">
          <div className="matchup-teams-row">
            <div className="matchup-team-block">
              <div className="matchup-team-badge">YOU</div>
              <h3>Your Roster</h3>
              <p>{roster.length} players</p>
            </div>
            <div className="matchup-vs">VS</div>
            <div className="matchup-team-block">
              <div className="matchup-team-badge ai">AI</div>
              <h3>AI Titans</h3>
              <p>{aiPlayers.length} players</p>
            </div>
          </div>
          <div className="matchup-chance">
            <span>Win Chance</span>
            <strong>{winChance}%</strong>
          </div>
          <div className="matchup-meter">
            <div className="matchup-meter-fill" style={{ width: `${winChance}%` }}></div>
          </div>
        </section>

        <section className="players-section">
          <div className="section-header">
            <h3 className="section-title">Your Roster</h3>
            {highlightedRosterId && (
              <button
                className="view-all-btn"
                style={{ color: '#f87171', borderColor: '#f87171' }}
                onClick={removeFromRoster}
                disabled={removing}
              >
                {removing ? '...' : 'Remove'}
              </button>
            )}
          </div>
          {removeMessage && (
            <p style={{ fontSize: '0.8rem', color: 'var(--error, #f87171)', marginBottom: 6 }}>{removeMessage}</p>
          )}
          <p className="matchup-hint">
            {highlightedRosterId ? 'Tap Remove to remove this player from your roster.' : 'Tap a player to remove them.'}
          </p>
          <div className="players-list">
            {rosterLoading && <p className="signed-in-label">Loading roster...</p>}
            {!rosterLoading && roster.length === 0 && (
              <p className="signed-in-label">No players yet. Add players from the Stats page.</p>
            )}
            {roster.map((player, index) => {
              const isHighlighted = highlightedRosterId === player.player_id;
              return (
                <motion.div
                  key={player.player_id}
                  className="matchup-ai-item"
                  style={isHighlighted ? { border: '2px solid #f87171', background: 'rgba(248,113,113,0.08)', borderRadius: 12, padding: '10px 14px' } : { borderRadius: 12, padding: '10px 14px' }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08 }}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => { setHighlightedRosterId((prev) => prev === player.player_id ? null : player.player_id); setRemoveMessage(''); }}
                >
                  <div className="matchup-ai-left">
                    <span className="matchup-ai-number" style={isHighlighted ? { color: '#f87171' } : {}}>{isHighlighted ? '×' : player.position}</span>
                    <div>
                      <div className="player-name">{player.player_name}</div>
                      <div className="player-position">{player.team}</div>
                    </div>
                  </div>
                  <div className="matchup-ai-right">
                    <span>{player.pts > 0 ? player.pts.toFixed(1) : '—'} PTS</span>
                    <span>{player.reb > 0 ? player.reb.toFixed(1) : '—'} REB</span>
                    <span>{player.ast > 0 ? player.ast.toFixed(1) : '—'} AST</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        <section className="team-stats-section">
          <h3 className="section-title">AI Selected Team</h3>
          <div className="matchup-ai-list">
            {aiLoading ? (
              <p style={{ color: 'var(--text-secondary)', padding: '12px 0' }}>Loading AI team...</p>
            ) : aiPlayers.map((player) => (
              <div key={player.id} className="matchup-ai-item">
                <div className="matchup-ai-left">
                  <span className="matchup-ai-number">{player.number != null ? `#${player.number}` : player.position}</span>
                  <div>
                    <div className="player-name">{player.name}</div>
                    <div className="player-position">{player.position}</div>
                  </div>
                </div>
                <div className="matchup-ai-right">
                  <span>{player.pts} PTS</span>
                  <span>{player.reb} REB</span>
                  <span>{player.ast} AST</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="team-stats-section">
          <h3 className="section-title">Head-to-Head</h3>
          <div className="matchup-stats-board">
            {statRows.map((row) => {
              const total = row.your + row.ai;
              const yourWidth = total ? Math.max(12, (row.your / total) * 100) : 50;
              const aiWidth = total ? Math.max(12, (row.ai / total) * 100) : 50;
              return (
                <div key={row.label} className="matchup-stat-row">
                  <div className="matchup-stat-values">
                    <span>{row.your.toFixed(1)}</span>
                    <span>{row.label}</span>
                    <span>{row.ai.toFixed(1)}</span>
                  </div>
                  <div className="matchup-bars">
                    <div className="matchup-bar your" style={{ width: `${yourWidth}%` }}></div>
                    <div className="matchup-bar ai" style={{ width: `${aiWidth}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {simulation && (
          <section className="matchup-result-card" ref={resultRef}>
            <h3>{simulation.winner === 'you' ? 'You Win!' : 'AI Wins'}</h3>
            <p>Final Score: You {simulation.yourScore} — {simulation.aiScore} AI</p>
          </section>
        )}
      </main>

      <nav className="bottom-nav">
        <button className="nav-btn" onClick={() => onNavigate('home')}>
          <span className="icon">🏠</span>
          <span>Home</span>
        </button>
        <button className="nav-btn" onClick={() => onNavigate('stats')}>
          <span className="icon">📊</span>
          <span>Stats</span>
        </button>
        <button className="nav-btn active">
          <span className="icon">⚔️</span>
          <span>Match Up</span>
        </button>
        <button className="nav-btn" onClick={() => onNavigate('settings')}>
          <span className="icon">👤</span>
          <span>Profile</span>
        </button>
      </nav>
    </div>
  );
};

// Settings page with various options and a logout button, accessible from the home page.
const SettingsPage = ({ onBack, onLogout, authUser, themeMode, onChangeTheme, notifications }) => {
  const settings = [
    { id: 'account', label: 'Account', icon: '👤' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
    { id: 'privacy', label: 'Privacy', icon: '🔒' },
    { id: 'theme', label: 'Theme', icon: '🎨' },
    { id: 'help', label: 'Help', icon: '❓' },
  ];
  const [activeSetting, setActiveSetting] = useState(null);

  const renderSettingContent = () => {
    if (activeSetting === 'account') {
      return (
        <div className="settings-detail-card">
          <h3 className="settings-detail-title">Account Information</h3>
          <div className="settings-detail-row">
            <span>Email</span>
            <strong>{authUser?.email || 'Not available'}</strong>
          </div>
          <div className="settings-detail-row">
            <span>Username</span>
            <strong>{authUser?.username || 'Not set'}</strong>
          </div>
          <div className="settings-detail-row">
            <span>Account Status</span>
            <strong>Active</strong>
          </div>
        </div>
      );
    }

    if (activeSetting === 'notifications') {
      return (
        <div className="settings-detail-card">
          <h3 className="settings-detail-title">Notifications</h3>
          {notifications.length === 0 ? (
            <p className="settings-detail-empty">No notifications yet. Match updates will appear here.</p>
          ) : (
            <div className="settings-notification-list">
              {notifications.map((note) => (
                <div key={note.id} className="settings-notification-item">
                  <div>
                    <strong>{note.title}</strong>
                    <p>{note.message}</p>
                  </div>
                  <span>{new Date(note.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (activeSetting === 'privacy') {
      return (
        <div className="settings-detail-card">
          <h3 className="settings-detail-title">Privacy</h3>
          <ul className="settings-detail-list">
            <li>Your login credentials are never shown in plain text.</li>
            <li>Only essential account data is stored for core app features.</li>
            <li>Session data expires after inactivity for additional safety.</li>
            <li>Sensitive keys are managed on backend environment variables.</li>
            <li>You can request account data updates or deletion from support.</li>
          </ul>
        </div>
      );
    }

    if (activeSetting === 'theme') {
      return (
        <div className="settings-detail-card">
          <h3 className="settings-detail-title">Theme</h3>
          <p className="settings-detail-empty">Choose your preferred app background style.</p>
          <div className="settings-theme-actions">
            <button
              className={`settings-theme-btn ${themeMode === 'dark' ? 'active' : ''}`}
              onClick={() => onChangeTheme('dark')}
            >
              Deep Navy
            </button>
            <button
              className={`settings-theme-btn ${themeMode === 'beige' ? 'active' : ''}`}
              onClick={() => onChangeTheme('beige')}
            >
              Warm Beige
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="settings-detail-card">
        <h3 className="settings-detail-title">Help</h3>
        <ul className="settings-detail-list">
          <li>Use Match Up to build your team and simulate game outcomes.</li>
          <li>Check Notifications for match results and important updates.</li>
          <li>If stats fail to load, refresh the page and verify your connection.</li>
          <li>For login issues, verify email and password, then retry.</li>
          <li>Contact support if an issue persists after retrying.</li>
        </ul>
      </div>
    );
  };

  return (
    <div className="settings-page">
      <div className="settings-background">
        <div className="circuit-pattern"></div>
      </div>

      <header className="settings-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <h1 className="settings-title">Settings</h1>
        <div style={{ width: 40 }}></div>
      </header>

      <main className="settings-main">
        <motion.div
          className="settings-container"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {activeSetting ? (
            <>
              <button className="view-all-btn" onClick={() => setActiveSetting(null)}>
                ← Back to Settings
              </button>
              {renderSettingContent()}
            </>
          ) : (
            <>
              <div className="settings-menu">
                {settings.map((option, index) => (
                  <motion.div
                    key={option.id}
                    className="settings-item"
                    onClick={() => setActiveSetting(option.id)}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.1 * index }}
                    whileHover={{ scale: 1.02 }}
                  >
                    <div className="settings-item-content">
                      <span className="settings-icon">{option.icon}</span>
                      <span className="settings-label">{option.label}</span>
                    </div>
                    <span className="settings-arrow">›</span>
                  </motion.div>
                ))}
              </div>

              <motion.button
                className="logout-btn"
                onClick={onLogout}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                whileHover={{ scale: 1.02 }}
              >
                <span>🚪</span>
                <span>Log Out</span>
              </motion.button>
            </>
          )}
        </motion.div>
      </main>
    </div>
  );
};

function App() {
  const [page, setPage] = useState('login');
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem(THEME_STORAGE_KEY) || 'dark');
  const [authState, setAuthState] = useState({
    user: null,
    accessToken: null,
  });
  const [roster, setRoster] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(false);

  const fetchRoster = async (userId) => {
    setRosterLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_team_players')
        .select('player_id, role, players(name, position, teams(name, abbreviation))')
        .eq('user_id', userId);
      if (error || !data) return;

      const playerIds = data.map((e) => e.player_id);
      let statsMap = {};
      if (playerIds.length > 0) {
        const { data: statsData } = await supabase
          .from('game_stats')
          .select('player_id, points, rebounds, assists')
          .in('player_id', playerIds);
        if (statsData) {
          statsData.forEach((g) => {
            if (!statsMap[g.player_id]) statsMap[g.player_id] = { games: 0, pts: 0, reb: 0, ast: 0 };
            statsMap[g.player_id].games += 1;
            statsMap[g.player_id].pts += g.points || 0;
            statsMap[g.player_id].reb += g.rebounds || 0;
            statsMap[g.player_id].ast += g.assists || 0;
          });
        }
      }

      setRoster(data.map((entry) => {
        const s = statsMap[entry.player_id];
        const games = s?.games || 0;
        return {
          player_id: entry.player_id,
          player_name: entry.players?.name ?? 'Unknown',
          position: entry.players?.position ?? '—',
          team: entry.players?.teams?.name ?? 'Unknown Team',
          team_abbreviation: entry.players?.teams?.abbreviation ?? '',
          role: entry.role,
          pts: games ? s.pts / games : 0,
          reb: games ? s.reb / games : 0,
          ast: games ? s.ast / games : 0,
          games,
        };
      }));
    } catch {
      // leave roster empty on network error
    } finally {
      setRosterLoading(false);
    }
  };
  const [notifications, setNotifications] = useState(() => {
    try {
      const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
    localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    const now = Date.now();
    const lastActivityRaw = localStorage.getItem(LAST_ACTIVITY_KEY);
    const lastActivity = lastActivityRaw ? Number(lastActivityRaw) : now;
    const isIdleTooLong = now - lastActivity > IDLE_TIMEOUT_MS;

    if (isIdleTooLong) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
      setPage('login');
      setAuthState({ user: null, accessToken: null });
      return;
    }

    const rawSession = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!rawSession) {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
      return;
    }

    try {
      const parsed = JSON.parse(rawSession);
      const storedAuth = parsed?.authState || { user: null, accessToken: null };
      const storedPage = parsed?.page || 'home';

      if (storedAuth?.accessToken) {
        setAuthState(storedAuth);
        setPage(storedPage);
        supabase.auth.setSession({ access_token: storedAuth.accessToken, refresh_token: '' });
        if (storedAuth.user?.id) fetchRoster(storedAuth.user.id);
      }
    } catch {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      setPage('login');
      setAuthState({ user: null, accessToken: null });
    }

    localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
  }, []);

  useEffect(() => {
    const updateActivity = () => {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    };

    const events = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
    events.forEach((eventName) => window.addEventListener(eventName, updateActivity, { passive: true }));
    updateActivity();

    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, updateActivity));
    };
  }, []);

  useEffect(() => {
    if (!authState?.accessToken) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return;
    }

    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ page, authState }));
  }, [page, authState]);

  useEffect(() => {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications));
  }, [notifications]);

  const addNotification = (notification) => {
    setNotifications((current) => [notification, ...current].slice(0, 25));
  };

  // On login/signup success, persist user + token and move to home screen.
  const handleLogin = (payload) => {
    const user = payload?.user || null;
    const accessToken = payload?.auth?.access_token || null;
    const refreshToken = payload?.auth?.refresh_token || null;
    setAuthState({ user, accessToken });
    if (accessToken) {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken ?? '' });
    }
    if (user?.id) fetchRoster(user.id);
    setPage('home');
  };

  // On logout, clear auth state and return to login screen.
  const handleLogout = () => {
    setAuthState({
      user: null,
      accessToken: null,
    });
    setRoster([]);
    setPage('login');
    localStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  };

  // Render one page at a time based on current app state.
  return (
    <AnimatePresence mode="wait">
      {page === 'login' && (
        <LoginPage key="login" onLogin={handleLogin} onGoToSignup={() => setPage('signup')} />
      )}
      {page === 'signup' && (
        <SignupPage key="signup" onSignup={handleLogin} onGoToLogin={() => setPage('login')} />
      )}
      {page === 'home' && (
        <HomePage
          key="home"
          authUser={authState.user}
          onSettings={() => setPage('settings')}
          onLogout={handleLogout}
          onNavigate={setPage}
        />
      )}
      {page === 'stats' && (
        <StatsPage key="stats" onBack={() => setPage('home')} onNavigate={setPage} authUser={authState.user} onRosterSaved={fetchRoster} />
      )}
      {page === 'matchup' && (
        <MatchupPage
          key="matchup"
          onBack={() => setPage('stats')}
          onNavigate={setPage}
          authUser={authState.user}
          onNewNotification={addNotification}
          roster={roster}
          rosterLoading={rosterLoading}
          onRosterUpdated={fetchRoster}
        />
      )}
      {page === 'settings' && (
        <SettingsPage
          key="settings"
          onBack={() => setPage('home')}
          onLogout={handleLogout}
          authUser={authState.user}
          themeMode={themeMode}
          onChangeTheme={setThemeMode}
          notifications={notifications}
        />
      )}
    </AnimatePresence>
  );
}

export default App;
