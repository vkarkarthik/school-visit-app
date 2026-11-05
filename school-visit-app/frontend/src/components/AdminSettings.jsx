import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client';
import {
  buildSavedStateCcRows,
  buildSettingsPayload,
  createStateCcEditor,
  listToText,
  normalizeList,
  normalizeSettingsForForm,
  normalizeStateKey,
  settingsSignature,
  validateSettingsPayload,
} from './adminSettings.utils';

const emptyManager = { name: '', email: '', active: true };

function createEmailText(settings) {
  return {
    adminEmails: listToText(settings.adminEmails, ', '),
    commonCc: listToText(settings.commonCc, ', '),
  };
}


export default function AdminSettings({ settings, states = [], onSaveSettings, savingSettings }) {
  const initialSettings = normalizeSettingsForForm(settings);
  const [draft, setDraft] = useState(() => initialSettings);
  const [emailText, setEmailText] = useState(() => createEmailText(initialSettings));
  const [stateCcEditor, setStateCcEditor] = useState(() => createStateCcEditor(initialSettings.stateCcEmails));
  const [selectedCcState, setSelectedCcState] = useState('');
  const [savedCcSearch, setSavedCcSearch] = useState('');
  const [message, setMessage] = useState('');
  const [sheetDashboardUrl, setSheetDashboardUrl] = useState('');
  const [buildingDashboard, setBuildingDashboard] = useState(false);
  const lastSyncedSettings = useRef(settingsSignature(settings));
  const stateCcInputRef = useRef(null);

  useEffect(() => {
    const nextSignature = settingsSignature(settings);
    if (nextSignature === lastSyncedSettings.current) return;

    const normalizedSettings = normalizeSettingsForForm(settings);
    lastSyncedSettings.current = nextSignature;
    setDraft(normalizedSettings);
    setEmailText(createEmailText(normalizedSettings));
    setStateCcEditor(createStateCcEditor(normalizedSettings.stateCcEmails));
  }, [settings]);

  const stateOptions = useMemo(() => {
    const optionsByKey = new Map();

    for (const state of Array.isArray(states) ? states : []) {
      const stateName = String(state || '').trim();
      const stateKey = normalizeStateKey(stateName);
      if (stateName && stateKey) optionsByKey.set(stateKey, stateName);
    }

    for (const state of Object.keys(draft.stateCcEmails || {})) {
      const stateName = String(state || '').trim();
      const stateKey = normalizeStateKey(stateName);
      if (stateName && stateKey && !optionsByKey.has(stateKey)) optionsByKey.set(stateKey, stateName);
    }

    return [...optionsByKey.values()].sort((a, b) => a.localeCompare(b));
  }, [states, draft.stateCcEmails]);

  useEffect(() => {
    if (selectedCcState && stateOptions.includes(selectedCcState)) return;
    setSelectedCcState(stateOptions[0] || '');
  }, [selectedCcState, stateOptions]);

  const selectedStateKey = normalizeStateKey(selectedCcState);
  const selectedStateCcText = stateCcEditor[selectedStateKey]?.text || '';
  const savedStateCcRows = useMemo(
    () => buildSavedStateCcRows(states, draft.stateCcEmails, savedCcSearch),
    [states, draft.stateCcEmails, savedCcSearch]
  );

  const updateSelectedStateCc = (text) => {
    if (!selectedCcState || !selectedStateKey) return;
    setStateCcEditor((prev) => ({
      ...prev,
      [selectedStateKey]: {
        state: selectedCcState,
        text,
      },
    }));
  };

  const editSavedStateCc = (state) => {
    setSelectedCcState(state);
    window.requestAnimationFrame(() => {
      stateCcInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      stateCcInputRef.current?.focus({ preventScroll: true });
    });
  };

  const updateManager = (index, field, value) => {
    setDraft((prev) => ({
      ...prev,
      programManagers: (Array.isArray(prev.programManagers) ? prev.programManagers : []).map((manager, currentIndex) =>
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
      programManagers: (Array.isArray(prev.programManagers) ? prev.programManagers : []).filter(
        (_, currentIndex) => currentIndex !== index
      ),
    }));
  };

  const saveSettings = async () => {
    setMessage('');
    const payload = buildSettingsPayload(draft, emailText, stateCcEditor);
    const validationMessage = validateSettingsPayload(payload);
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

    const result = await onSaveSettings(payload);
    if (result?.ok) {
      setDraft(payload);
      setEmailText(createEmailText(payload));
      setStateCcEditor(createStateCcEditor(payload.stateCcEmails));
    }
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
            value={emailText.adminEmails}
            onChange={(e) => setEmailText((prev) => ({ ...prev, adminEmails: e.target.value }))}
            placeholder="admin1@superteacher.in, admin2@superteacher.co.in"
          />
        </label>

        <label className="full-width">
          Common Mail CC
          <textarea
            rows={3}
            value={emailText.commonCc}
            onChange={(e) => setEmailText((prev) => ({ ...prev, commonCc: e.target.value }))}
            placeholder="teamlead@superteacher.in, saleshead@superteacher.co.in"
          />
        </label>
      </div>

      <div className="panel-subsection">
        <div className="panel-header compact-panel-header">
          <div>
            <span className="eyebrow">State-wise email CC settings</span>
            <h3>Route report copies to the selected state team</h3>
          </div>
        </div>
        <p className="help-text">
          These recipients are added only to school visit reports for the selected state. Common Mail CC continues to apply to every report.
        </p>

        <div className="form-grid">
          <label>
            State / Region
            <select value={selectedCcState} onChange={(event) => setSelectedCcState(event.target.value)}>
              {!stateOptions.length && <option value="">No states available</option>}
              {stateOptions.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </label>

          <label>
            CC Email Addresses
            <textarea
              ref={stateCcInputRef}
              rows={3}
              value={selectedStateCcText}
              onChange={(event) => updateSelectedStateCc(event.target.value)}
              placeholder="statelead@superteacher.in, coordinator@superteacher.co.in"
              disabled={!selectedCcState}
            />
          </label>
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => updateSelectedStateCc('')}
            disabled={!selectedCcState || !selectedStateCcText}
          >
            Clear Selected State CC
          </button>
        </div>

        <div className="saved-state-cc-section">
          <div className="panel-header compact-panel-header">
            <div>
              <span className="eyebrow">Saved state-wise CC emails</span>
              <h3>Database configuration by state</h3>
            </div>
            <span className="panel-badge">Saved values</span>
          </div>
          <p className="help-text">
            This table shows only the last successfully saved settings. Unsaved textarea edits appear above and are not shown here until Save Settings succeeds.
          </p>

          <label className="saved-state-cc-search">
            Search saved state CC settings
            <input
              type="search"
              value={savedCcSearch}
              onChange={(event) => setSavedCcSearch(event.target.value)}
              placeholder="Search by state or email address"
            />
          </label>

          <div className="saved-state-cc-table-wrap">
            <table className="saved-state-cc-table">
              <thead>
                <tr>
                  <th>State / Region</th>
                  <th>Saved CC Email Addresses</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {savedStateCcRows.map(({ state, stateKey, emails }) => (
                  <tr key={stateKey}>
                    <td data-label="State / Region"><strong>{state}</strong></td>
                    <td data-label="Saved CC Email Addresses">
                      {emails.length ? (
                        <div className="saved-state-cc-email-list">
                          {emails.map((email) => <span key={email}>{email}</span>)}
                        </div>
                      ) : (
                        <span className="muted-text">Not configured</span>
                      )}
                    </td>
                    <td data-label="Action">
                      <button type="button" className="table-action" onClick={() => editSavedStateCc(state)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!savedStateCcRows.length && (
            <div className="empty-state">No states or saved email addresses match your search.</div>
          )}
        </div>
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
            <div className="manager-settings-row" key={`manager-${index}`}>
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
                  type="text"
                  value={manager.email}
                  onChange={(e) => updateManager(index, 'email', e.target.value)}
                  placeholder="name@superteacher.in"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
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

      <div className="panel-subsection">
        <div className="panel-header compact-panel-header">
          <div>
            <span className="eyebrow">Dropdown options</span>
            <h3>Work modes, visit purposes, and priorities</h3>
          </div>
        </div>
        <p className="help-text">One option per line. These drive the dropdowns in the planner, report form, and filters. "School Visit" is always kept as a core mode and cannot be removed.</p>

        <div className="form-grid">
          <label>
            Work Modes
            <textarea
              rows={6}
              value={listToText(draft.workModes)}
              onChange={(e) => setDraft((prev) => ({ ...prev, workModes: normalizeList(e.target.value, { keepSchoolVisit: true }) }))}
              placeholder="School Visit\nWork From Home\nWork From Office\nTravel\nOther"
            />
          </label>

          <label>
            Visit Purposes
            <textarea
              rows={8}
              value={listToText(draft.visitPurposes)}
              onChange={(e) => setDraft((prev) => ({ ...prev, visitPurposes: normalizeList(e.target.value) }))}
              placeholder="New School Visit / Demo\nTeachers Training\nOther Works"
            />
          </label>

          <label>
            Priorities
            <textarea
              rows={4}
              value={listToText(draft.priorities)}
              onChange={(e) => setDraft((prev) => ({ ...prev, priorities: normalizeList(e.target.value) }))}
              placeholder="Critical\nHigh\nNormal"
            />
          </label>
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
