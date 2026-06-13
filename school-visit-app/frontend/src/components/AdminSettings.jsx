import { useState } from 'react';
import { api } from '../api/client';

const defaultSettings = {
  adminEmails: 'karthik@superteacher.in, karthikv@superteacher.in, vasudevan@superteacher.in, bhanu@superteacher.in',
  commonCc: 'Configure MAIL_CC in backend/.env when ready',
  newSchoolsSheet: 'New Schools',
  googleOAuthStatus: 'Ready to connect when Google Client ID is available',
  note: 'These settings document the production configuration. Security-sensitive values still live in backend .env/code.'
};

export default function AdminSettings() {
  const [settings, setSettings] = useState(() => {
    try {
      return { ...defaultSettings, ...JSON.parse(localStorage.getItem('schoolVisitAdminSettings') || '{}') };
    } catch {
      return defaultSettings;
    }
  });
  const [message, setMessage] = useState('');
  const [sheetDashboardUrl, setSheetDashboardUrl] = useState('');
  const [buildingDashboard, setBuildingDashboard] = useState(false);

  const saveSettings = () => {
    localStorage.setItem('schoolVisitAdminSettings', JSON.stringify(settings));
    setMessage('Settings notes saved locally.');
  };

  const buildPlannerDashboard = async () => {
    setBuildingDashboard(true);
    setMessage('');

    try {
      const response = await api.post('/plans/dashboard-sheet');
      setSheetDashboardUrl(response.data.url || '');
      setMessage(response.data.message || 'Planner dashboard sheet created.');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Could not build planner dashboard sheet.');
    } finally {
      setBuildingDashboard(false);
    }
  };

  return (
    <section className="panel dashboard-panel">
      <div className="panel-header">
        <div>
          <span className="eyebrow">Admin settings</span>
          <h2>Configuration notes</h2>
        </div>
        <span className="panel-badge">Local notes</span>
      </div>
      <div className="form-grid">
        {Object.entries(settings).map(([key, value]) => (
          <label className={key === 'note' ? 'full-width' : ''} key={key}>
            {labelize(key)}
            <textarea
              rows={key === 'note' ? 4 : 2}
              value={value}
              onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <div className="modal-actions">
        <button type="button" className="primary-button" onClick={saveSettings}>
          Save Notes
        </button>
        <button type="button" className="secondary-button" onClick={buildPlannerDashboard} disabled={buildingDashboard}>
          {buildingDashboard ? 'Building Sheet Dashboard...' : 'Build Planner Sheet Dashboard'}
        </button>
      </div>
      {message && <div className="status-text tracking-message">{message}</div>}
      {sheetDashboardUrl && (
        <div className="tracking-message">
          <a href={sheetDashboardUrl} target="_blank" rel="noreferrer">
            Open Planner Dashboard Sheet
          </a>
        </div>
      )}
    </section>
  );
}

function labelize(value) {
  return value.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase());
}
