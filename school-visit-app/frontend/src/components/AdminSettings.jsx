import { useState } from 'react';

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

  const saveSettings = () => {
    localStorage.setItem('schoolVisitAdminSettings', JSON.stringify(settings));
    setMessage('Settings notes saved locally.');
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
      </div>
      {message && <div className="status-text tracking-message">{message}</div>}
    </section>
  );
}

function labelize(value) {
  return value.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase());
}
