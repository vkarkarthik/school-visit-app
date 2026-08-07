import { useEffect, useState } from 'react';
import { api } from '../api/client';

const emptyManager = { name: '', email: '', active: true };

export default function AdminSettings({ settings, onSaveSettings, savingSettings }) {
  const [draft, setDraft] = useState(settings);
  const [message, setMessage] = useState('');
  const [sheetDashboardUrl, setSheetDashboardUrl] = useState('');
  const [buildingDashboard, setBuildingDashboard] = useState(false);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const updateManager = (index, field, value) => {
    setDraft((prev) => ({
      ...prev,
      programManagers: prev.programManagers.map((manager, currentIndex) =>
        currentIndex === index ? { ...manager, [field]: value } : manager
      ),
    }));
  };

  const addManager = () => {
    setDraft((prev) => ({
      ...prev,
      programManagers: [...(prev.programManagers || []), { ...emptyManager }],
    }));
  };

  const removeManager = (index) => {
    setDraft((prev) => ({
      ...prev,
      programManagers: prev.programManagers.filter((_, currentIndex) => currentIndex !== index),
    }));
  };

  const saveSettings = async () => {
    setMessage('');
    const result = await onSaveSettings(draft);
    setMessage(result?.message || 'Settings updated.');
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
          <h2>Team roster and mail controls</h2>
        </div>
        <span className="panel-badge">Live config</span>
      </div>

      <div className="form-grid">
        <label className="full-width">
          Admin Emails
          <textarea
            rows={3}
            value={(draft.adminEmails || []).join(', ')}
            onChange={(e) => setDraft((prev) => ({ ...prev, adminEmails: e.target.value }))}
            placeholder="admin1@superteacher.in, admin2@superteacher.co.in"
          />
        </label>

        <label className="full-width">
          Common Mail CC
          <textarea
            rows={3}
            value={(draft.commonCc || []).join(', ')}
            onChange={(e) => setDraft((prev) => ({ ...prev, commonCc: e.target.value }))}
            placeholder="teamlead@superteacher.in, saleshead@superteacher.co.in"
          />
        </label>
      </div>

      <div className="panel-subsection">
        <div className="panel-header compact-panel-header">
          <div>
            <span className="eyebrow">Program managers</span>
            <h3>Roster used in planner and filters</h3>
          </div>
          <button type="button" className="secondary-button" onClick={addManager}>
            Add Program Manager
          </button>
        </div>

        <div className="manager-settings-list">
          {(draft.programManagers || []).map((manager, index) => (
            <div className="manager-settings-row" key={`${manager.email || 'new'}-${index}`}>
              <label>
                Name
                <input
                  value={manager.name}
                  onChange={(e) => updateManager(index, 'name', e.target.value)}
                  placeholder="Program manager name"
                />
              </label>

              <label>
                Email
                <input
                  type="email"
                  value={manager.email}
                  onChange={(e) => updateManager(index, 'email', e.target.value)}
                  placeholder="name@superteacher.in"
                />
              </label>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={manager.active !== false}
                  onChange={(e) => updateManager(index, 'active', e.target.checked)}
                />
                Active
              </label>

              <button type="button" className="table-action danger-action" onClick={() => removeManager(index)}>
                Remove
              </button>
            </div>
          ))}

          {!draft.programManagers?.length && (
            <div className="empty-state">No PM roster saved yet. Add your first program manager here.</div>
          )}
        </div>
      </div>

      <div className="modal-actions">
        <button type="button" className="primary-button" onClick={saveSettings} disabled={savingSettings}>
          {savingSettings ? 'Saving...' : 'Save Settings'}
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
