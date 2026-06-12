import { useEffect, useState } from 'react';
import { api } from '../api/client';
import AdminSettings from '../components/AdminSettings';
import DraftsPanel from '../components/DraftsPanel';
import GoogleLoginPanel, { isGoogleConfigured } from '../components/GoogleLoginPanel';
import OperationsDashboard from '../components/OperationsDashboard';
import SchedulerPanel from '../components/SchedulerPanel';
import SchoolVisitForm from '../components/SchoolVisitForm';
import TrackingDashboard from '../components/TrackingDashboard';

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
  return {
    name: String(user?.name || ''),
    email: String(user?.email || ''),
    role: String(user?.role || 'Program Manager'),
    authProvider: String(user?.authProvider || ''),
    credential: String(user?.credential || ''),
    picture: String(user?.picture || '')
  };
}

export default function HomePage() {
  const [schoolMaster, setSchoolMaster] = useState({ states: [], schools: [] });
  const [loading, setLoading] = useState(true);
  const [schoolMasterError, setSchoolMasterError] = useState('');
  const [activeView, setActiveView] = useState('report');
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

  useEffect(() => {
    const allowedViews = isAdmin
      ? new Set(['scheduler', 'report', 'drafts', 'tracking', 'dashboard', 'settings'])
      : new Set(['scheduler', 'report', 'drafts', 'tracking']);

    if (!allowedViews.has(activeView)) {
      setActiveView('report');
    }
  }, [activeView, isAdmin]);

  useEffect(() => {
    async function loadSchoolMaster() {
      try {
        setSchoolMasterError('');
        const response = await api.get('/schools/master');
        setSchoolMaster({
          states: Array.isArray(response.data.states) ? response.data.states : [],
          schools: Array.isArray(response.data.schools) ? response.data.schools : []
        });
      } catch (error) {
        setSchoolMaster({ states: [], schools: [] });
        setSchoolMasterError(
          error.response?.data?.message || 'Unable to load school data. Please check the backend connection.'
        );
      } finally {
        setLoading(false);
      }
    }
    loadSchoolMaster();
  }, []);

  if (loading) return <div className="page-shell">Loading school data...</div>;

  return (
    <div className="app-shell">
      <header className="topbar">
        <img className="brand-logo" src="/superteacher-logo.png" alt="SuperTeacher" />
        <div className="topbar-copy">
          <span>Super Teacher Operations</span>
          <strong>School Visit Reporting</strong>
        </div>
        <div className="topbar-meta">
          <span>{schoolMaster.schools.length} schools loaded</span>
          <span>{schoolMaster.states.length} regions</span>
          <span>{currentUser.role}</span>
        </div>
      </header>

      <main className="page-shell">
        <section className="workspace-header">
          <div>
            <span className="eyebrow">Program manager workspace</span>
            <h1>Visit reports and school follow-ups</h1>
          </div>
          <div className="header-actions">
            <div className="header-stat">
              <span>Master data</span>
              <strong>{schoolMasterError ? 'Issue' : 'Live'}</strong>
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
            setActiveView('report');
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
                <input value={isAdmin ? 'Admin / Operations' : currentUser.role} readOnly />
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
                className={activeView === 'scheduler' ? 'active' : ''}
                onClick={() => setActiveView('scheduler')}
              >
                Scheduler
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
              {isAdmin && (
                <>
                  <button
                    type="button"
                    className={activeView === 'tracking' ? 'active' : ''}
                    onClick={() => setActiveView('tracking')}
                  >
                    Tracking
                  </button>
                  <button
                    type="button"
                    className={activeView === 'dashboard' ? 'active' : ''}
                    onClick={() => setActiveView('dashboard')}
                  >
                    Admin Dashboard
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

            {activeView === 'report' && (
              <div className="single-workspace">
                <SchoolVisitForm
                  schoolMaster={schoolMaster}
                  currentUser={currentUser}
                  draftToLoad={draftToLoad}
                  planToConvert={planToConvert}
                  onDraftLoaded={() => setDraftToLoad(null)}
                  onPlanLoaded={() => setPlanToConvert(null)}
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
