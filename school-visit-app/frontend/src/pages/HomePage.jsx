import { useEffect, useState } from 'react';
import { api } from '../api/client';
import AdminSettings from '../components/AdminSettings';
import DraftsPanel from '../components/DraftsPanel';
import GoogleLoginPanel, { isGoogleConfigured } from '../components/GoogleLoginPanel';
import OperationsCommandCenter from '../components/OperationsCommandCenter';
import OperationsDashboard from '../components/OperationsDashboard';
import SchedulerPanel from '../components/SchedulerPanel';
import SchoolVisitForm from '../components/SchoolVisitForm';
import TrackingDashboard from '../components/TrackingDashboard';

const SCHOOL_MASTER_CACHE_KEY = 'schoolVisitSchoolMasterCache';
const ADMIN_EMAILS = new Set([
  'karthik@superteacher.in',
  'karthikv@superteacher.in',
  'vasudevan@superteacher.in',
  'bhanu@superteacher.in'
]);

const emptyUser = {
  name: '',
  email: '',
  role: 'Program Manager',
  authProvider: '',
  credential: '',
  picture: ''
};

function normalizeUser(user) {
  const email = String(user?.email || '');
  const normalizedEmail = email.trim().toLowerCase();
  const derivedRole = ADMIN_EMAILS.has(normalizedEmail) ? 'Admin / Team Lead' : String(user?.role || 'Program Manager');

  return {
    name: String(user?.name || ''),
    email,
    role: derivedRole,
    authProvider: String(user?.authProvider || ''),
    credential: String(user?.credential || ''),
    picture: String(user?.picture || '')
  };
}

function readCachedSchoolMaster() {
  try {
    const saved = localStorage.getItem(SCHOOL_MASTER_CACHE_KEY);
    if (!saved) return null;

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed?.states) || !Array.isArray(parsed?.schools)) {
      return null;
    }

    return {
      states: parsed.states,
      schools: parsed.schools
    };
  } catch {
    localStorage.removeItem(SCHOOL_MASTER_CACHE_KEY);
    return null;
  }
}

export default function HomePage() {
  const [schoolMaster, setSchoolMaster] = useState(() => readCachedSchoolMaster() || { states: [], schools: [] });
  const [loading, setLoading] = useState(true);
  const [schoolMasterStatus, setSchoolMasterStatus] = useState(() => (readCachedSchoolMaster() ? 'cached' : 'loading'));
  const [schoolMasterError, setSchoolMasterError] = useState('');
  const [activeView, setActiveView] = useState('home');
  const [draftToLoad, setDraftToLoad] = useState(null);
  const [planToConvert, setPlanToConvert] = useState(null);
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('schoolVisitUser');
      if (saved) return normalizeUser(JSON.parse(saved));
    } catch {
      localStorage.removeItem('schoolVisitUser');
    }

    return emptyUser;
  });

  useEffect(() => {
    localStorage.setItem('schoolVisitUser', JSON.stringify(normalizeUser(currentUser)));
  }, [currentUser]);

  const isLoggedIn =
    String(currentUser.name || '').trim() &&
    /^[^\s@]+@superteacher\.in$/i.test(String(currentUser.email || '').trim());
  const isAdmin = ADMIN_EMAILS.has(String(currentUser.email || '').trim().toLowerCase());
  const displayRole = isAdmin ? 'Admin / Team Lead' : currentUser.role || 'Program Manager';

  useEffect(() => {
    const allowedViews = isAdmin
      ? new Set(['home', 'scheduler', 'report', 'drafts', 'tracking', 'dashboard', 'settings'])
      : new Set(['home', 'scheduler', 'report', 'drafts', 'tracking']);

    if (!allowedViews.has(activeView)) {
      setActiveView('home');
    }
  }, [activeView, isAdmin]);

  useEffect(() => {
    async function loadSchoolMaster() {
      setLoading(true);
      try {
        setSchoolMasterError('');
        setSchoolMasterStatus((prev) => (schoolMaster.schools.length ? prev : 'loading'));
        const response = await api.get('/schools/master');
        const nextMaster = {
          states: Array.isArray(response.data.states) ? response.data.states : [],
          schools: Array.isArray(response.data.schools) ? response.data.schools : []
        };
        setSchoolMaster(nextMaster);
        localStorage.setItem(SCHOOL_MASTER_CACHE_KEY, JSON.stringify(nextMaster));
        setSchoolMasterStatus('live');
      } catch (error) {
        const cachedSchoolMaster = readCachedSchoolMaster();
        if (cachedSchoolMaster?.schools?.length) {
          setSchoolMaster(cachedSchoolMaster);
          setSchoolMasterStatus('cached');
          setSchoolMasterError('Live school data is taking longer than usual. Showing last available master data for now.');
        } else {
          setSchoolMaster({ states: [], schools: [] });
          setSchoolMasterStatus('issue');
          setSchoolMasterError(
            error.response?.data?.message || 'Unable to load school data. Please check the backend connection.'
          );
        }
      } finally {
        setLoading(false);
      }
    }
    loadSchoolMaster();
  }, []);

  return (
    <div className="app-shell">
      <header className="topbar">
        <img className="brand-logo" src="/superteacher-logo.png" alt="SuperTeacher" />
        <div className="topbar-copy">
          <span>Super Teacher Operations</span>
          <strong>School Visit Reporting</strong>
        </div>
        <div className="topbar-meta">
          <span>{loading && !schoolMaster.schools.length ? 'Syncing school data...' : `${schoolMaster.schools.length} schools loaded`}</span>
          <span>{schoolMaster.states.length} regions</span>
          <span>{displayRole}</span>
        </div>
      </header>

      <main className="page-shell">
        <section className="workspace-header">
          <div>
            <span className="eyebrow">Program manager operations</span>
            <h1>Field execution, internal work, and visit accountability</h1>
          </div>
          <div className="header-actions">
            <div className="header-stat">
              <span>Master data</span>
              <strong>
                {schoolMasterStatus === 'loading'
                  ? 'Syncing'
                  : schoolMasterStatus === 'cached'
                    ? 'Cached'
                    : schoolMasterStatus === 'issue'
                      ? 'Issue'
                      : 'Live'}
              </strong>
            </div>
            <div className="header-stat">
              <span>Reports</span>
              <strong>Email + PDF</strong>
            </div>
          </div>
        </section>

        <GoogleLoginPanel
          currentUser={currentUser}
          onLogin={(user) => setCurrentUser(normalizeUser(user))}
          onLogout={() => {
            localStorage.removeItem('schoolVisitUser');
            setCurrentUser(emptyUser);
            setActiveView('home');
          }}
        />

        {!isGoogleConfigured() && (
          <section className="identity-panel">
            <div>
              <span className="eyebrow">Temporary identity</span>
              <strong>{currentUser.name || 'Set your name and email before sending'}</strong>
            </div>
            <div className="identity-grid">
              <label>
                Your Name
                <input
                  value={currentUser.name}
                  onChange={(e) => setCurrentUser({ ...currentUser, name: e.target.value, authProvider: 'manual' })}
                  placeholder="Program manager name"
                />
              </label>
              <label>
                Your Email
                <input
                  type="email"
                  value={currentUser.email}
                  onChange={(e) => setCurrentUser({ ...currentUser, email: e.target.value, authProvider: 'manual' })}
                  placeholder="name@superteacher.in"
                />
                {currentUser.email && !/^[^\s@]+@superteacher\.in$/i.test(currentUser.email) && (
                  <span className="field-error">Use your @superteacher.in email.</span>
                )}
              </label>
              <label>
                Role
                <input value={displayRole} readOnly />
              </label>
            </div>
          </section>
        )}

        {!isLoggedIn && (
          <div className="error-banner">
            <strong>Login identity required.</strong>
            <span>
              {isGoogleConfigured()
                ? 'Sign in with Google using your SuperTeacher account to unlock reporting.'
                : 'Enter your SuperTeacher name and @superteacher.in email to unlock reporting until Google Client ID is configured.'}
            </span>
          </div>
        )}

        {loading && (
          <div className="status-text">
            Opening workspace. School master is syncing in the background...
          </div>
        )}

        {schoolMasterError && (
          <div className="error-banner">
            <strong>School data could not be loaded.</strong>
            <span>{schoolMasterError}</span>
          </div>
        )}

        {isLoggedIn && (
          <>
            <nav className="view-tabs" aria-label="Workspace views">
              <button
                type="button"
                className={activeView === 'home' ? 'active' : ''}
                onClick={() => setActiveView('home')}
              >
                Overview
              </button>
              <button
                type="button"
                className={activeView === 'scheduler' ? 'active' : ''}
                onClick={() => setActiveView('scheduler')}
              >
                Daily Planner
              </button>
              <button
                type="button"
                className={activeView === 'report' ? 'active' : ''}
                onClick={() => setActiveView('report')}
              >
                Create Report
              </button>
              <button
                type="button"
                className={activeView === 'drafts' ? 'active' : ''}
                onClick={() => setActiveView('drafts')}
              >
                My Drafts
              </button>
              <button
                type="button"
                className={activeView === 'tracking' ? 'active' : ''}
                onClick={() => setActiveView('tracking')}
              >
                Tracking
              </button>
              {isAdmin && (
                <>
                  <button
                    type="button"
                    className={activeView === 'dashboard' ? 'active' : ''}
                    onClick={() => setActiveView('dashboard')}
                  >
                    Ops Dashboard
                  </button>
                  <button
                    type="button"
                    className={activeView === 'settings' ? 'active' : ''}
                    onClick={() => setActiveView('settings')}
                  >
                    Settings
                  </button>
                </>
              )}
            </nav>

            {activeView === 'home' && (
              <div className="single-workspace single-workspace-wide">
                <OperationsCommandCenter currentUser={currentUser} isAdmin={isAdmin} onNavigate={setActiveView} />
              </div>
            )}

            {activeView === 'report' && (
              <div className="single-workspace">
                <SchoolVisitForm
                  schoolMaster={schoolMaster}
                  currentUser={currentUser}
                  draftToLoad={draftToLoad}
                  planToConvert={planToConvert}
                  onDraftLoaded={() => setDraftToLoad(null)}
                  onPlanLoaded={() => setPlanToConvert(null)}
                  onReportCreated={() => setActiveView('tracking')}
                />
              </div>
            )}

            {activeView === 'scheduler' && (
              <div className="single-workspace">
                <SchedulerPanel
                  schoolMaster={schoolMaster}
                  currentUser={currentUser}
                  isAdmin={isAdmin}
                  onConvertToReport={(plan) => {
                    setPlanToConvert(plan);
                    setActiveView('report');
                  }}
                />
              </div>
            )}

            {activeView === 'drafts' && (
              <div className="single-workspace">
                <DraftsPanel
                  onLoadDraft={(draft) => {
                    setDraftToLoad(draft);
                    setActiveView('report');
                  }}
                />
              </div>
            )}

            {activeView === 'tracking' && (
              <div className="single-workspace">
                <TrackingDashboard schoolMaster={schoolMaster} currentUser={currentUser} isAdmin={isAdmin} />
              </div>
            )}

            {activeView === 'dashboard' && <OperationsDashboard />}

            {activeView === 'settings' && <AdminSettings />}
          </>
        )}
      </main>
    </div>
  );
}
