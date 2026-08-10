import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';

function formatDateInput(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

const EMPTY_FORM = {
  trainingType: 'Offline',
  title: '',
  date: formatDateInput(new Date()),
  topic: '',
  state: '',
  schoolName: '',
  city: '',
  venue: '',
  platform: '',
  meetingLink: '',
  audience: '',
  attendanceCount: '',
  durationHours: '',
  notes: '',
};

function groupInductionByState(schools) {
  const map = new Map();
  for (const school of schools) {
    const state = school.state || 'Unknown';
    if (!map.has(state)) {
      map.set(state, { state, schools: [], online: 0, offline: 0 });
    }
    const group = map.get(state);
    group.schools.push(school);
    if (String(school.status).trim().toLowerCase() === 'online') group.online += 1;
    else group.offline += 1;
  }
  return [...map.values()]
    .map((group) => ({ ...group, total: group.schools.length }))
    .sort((a, b) => b.total - a.total || a.state.localeCompare(b.state));
}

export default function TrainingReportsPanel({ schoolMaster, currentUser, isAdmin, appSettings }) {
  const [trainings, setTrainings] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filters, setFilters] = useState({
    trainingType: '',
    state: '',
    year: '',
    pm: '',
  });

  const schools = Array.isArray(schoolMaster?.schools) ? schoolMaster.schools : [];
  const states = Array.isArray(schoolMaster?.states) ? schoolMaster.states : [];
  const filteredSchools = useMemo(
    () =>
      schools
        .filter((school) => school.state === form.state)
        .sort((a, b) => a.schoolName.localeCompare(b.schoolName)),
    [schools, form.state]
  );

  const pmOptions = useMemo(() => {
    const map = new Map();
    for (const pm of appSettings?.programManagers || []) {
      if (pm.active === false) continue;
      const email = String(pm.email || '').trim().toLowerCase();
      if (email) map.set(email, { email: pm.email, name: pm.name || pm.email });
    }
    for (const training of trainings) {
      const email = String(training.programManagerEmail || '').trim().toLowerCase();
      if (email && !map.has(email)) {
        map.set(email, { email: training.programManagerEmail, name: training.programManagerName || training.programManagerEmail });
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [appSettings?.programManagers, trainings]);

  const canManage = (training) =>
    isAdmin ||
    String(training.programManagerEmail || '').trim().toLowerCase() === String(currentUser?.email || '').trim().toLowerCase();

  const loadTrainings = async (nextFilters = filters) => {
    setLoading(true);
    setMessage('');
    try {
      const params = Object.fromEntries(Object.entries(nextFilters).filter(([, value]) => value !== ''));
      const response = await api.get('/trainings', { params });
      setTrainings(Array.isArray(response.data.trainings) ? response.data.trainings : []);
      setSummary(response.data.summary || null);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Could not load training reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrainings();
  }, [filters.trainingType, filters.state, filters.year, filters.pm]);

  const openNewForm = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, date: formatDateInput(new Date()) });
    setShowForm(true);
    setMessage('');
  };

  const openEditForm = (training) => {
    setEditingId(training._id);
    setForm({
      trainingType: training.trainingType === 'Online' ? 'Online' : 'Offline',
      title: training.title || '',
      date: formatDateInput(new Date(training.date)),
      topic: training.topic || '',
      state: training.state || '',
      schoolName: training.schoolName || '',
      city: training.city || '',
      venue: training.venue || '',
      platform: training.platform || '',
      meetingLink: training.meetingLink || '',
      audience: training.audience || '',
      attendanceCount: training.attendanceCount || '',
      durationHours: training.durationHours || '',
      notes: training.notes || '',
    });
    setShowForm(true);
    setMessage('');
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const payload = {
        ...form,
        programManagerName: currentUser?.name || '',
        programManagerEmail: currentUser?.email || '',
      };
      if (editingId) {
        await api.patch(`/trainings/${editingId}`, payload);
        setMessage('Training report updated.');
      } else {
        await api.post('/trainings', payload);
        setMessage('Training report logged.');
      }
      setShowForm(false);
      await loadTrainings();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Could not save training report.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (training) => {
    if (!window.confirm('Delete this training report?')) return;
    setMessage('');
    try {
      await api.delete(`/trainings/${training._id}`);
      await loadTrainings();
      setMessage('Training report deleted.');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Could not delete training report.');
    }
  };

  const downloadCsv = async () => {
    setExporting(true);
    setMessage('');
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ''));
      const response = await api.get('/trainings/export', { params, responseType: 'blob' });
      const blobUrl = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `trainings-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
      setMessage('Trainings CSV downloaded.');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  const isOnline = form.trainingType === 'Online';

  const completedValues = new Set(['done', 'completed', 'offline', 'online']);

  const inductionSchools = useMemo(() => {
    return schools
      .filter((school) => completedValues.has(String(school.inductionTrainingStatus || '').trim().toLowerCase()))
      .map((school) => ({
        state: school.state,
        schoolName: school.schoolName,
        city: school.city || '',
        status: String(school.inductionTrainingStatus || '').trim(),
      }))
      .sort((a, b) => a.schoolName.localeCompare(b.schoolName));
  }, [schools]);

  const yetToCompleteSchools = useMemo(() => {
    return schools
      .filter((school) => !completedValues.has(String(school.inductionTrainingStatus || '').trim().toLowerCase()))
      .map((school) => ({
        state: school.state,
        schoolName: school.schoolName,
        city: school.city || '',
        status: String(school.inductionTrainingStatus || '').trim(),
      }))
      .sort((a, b) => a.schoolName.localeCompare(b.schoolName));
  }, [schools]);

  const inductionSummary = useMemo(() => {
    let online = 0;
    let offline = 0;
    for (const school of inductionSchools) {
      if (String(school.status).trim().toLowerCase() === 'online') online += 1;
      else offline += 1;
    }
    return { online, offline, total: inductionSchools.length };
  }, [inductionSchools]);

  const inductionByState = useMemo(() => groupInductionByState(inductionSchools), [inductionSchools]);
  const yetToCompleteByState = useMemo(() => groupInductionByState(yetToCompleteSchools), [yetToCompleteSchools]);

  return (
    <div>
      <div className="panel dashboard-hero">
        <div>
          <span className="eyebrow">Training reports</span>
          <h2>Offline &amp; online training tracker</h2>
          <p className="muted-text">Log every training session — in-school or online — so PMs and admins always have an updated record of what was delivered and to how many people.</p>
        </div>
        <div className="export-actions">
          <button type="button" className="table-action" onClick={downloadCsv} disabled={exporting}>
            {exporting ? 'Exporting...' : 'Export Trainings'}
          </button>
          <button type="button" className="primary-button" onClick={openNewForm}>
            + Log Training
          </button>
        </div>
      </div>

      {message && <div className="status-text">{message}</div>}

      <div className="panel dashboard-panel">
        <div className="panel-header compact">
          <h2>Filters</h2>
        </div>
        <div className="tracking-filter-grid">
          <label>
            Training Mode
            <select name="trainingType" value={filters.trainingType} onChange={(e) => setFilters((prev) => ({ ...prev, trainingType: e.target.value }))}>
              <option value="">All modes</option>
              <option value="Offline">Offline</option>
              <option value="Online">Online</option>
            </select>
          </label>
          <label>
            State
            <select name="state" value={filters.state} onChange={(e) => setFilters((prev) => ({ ...prev, state: e.target.value }))}>
              <option value="">All states</option>
              {states.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </label>
          <label>
            Year
            <input type="number" value={filters.year} onChange={(e) => setFilters((prev) => ({ ...prev, year: e.target.value }))} placeholder="All years" />
          </label>
          {isAdmin && (
            <label>
              Program Manager
              <select name="pm" value={filters.pm} onChange={(e) => setFilters((prev) => ({ ...prev, pm: e.target.value }))}>
                <option value="">All PMs</option>
                {pmOptions.map((pm) => (
                  <option key={pm.email} value={pm.email}>
                    {pm.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      <div className="panel dashboard-panel">
        <div className="panel-header compact">
          <h2>Induction Training Status (master sheet)</h2>
        </div>
        <p className="muted-text">Schools marked Done / Online for induction training in the master sheet are reflected here automatically, so the tracker stays in sync with the sheet.</p>
        <div className="dashboard-stats dashboard-stats-compact">
          <div className="metric-card">
            <span>Done (Offline)</span>
            <strong>{inductionSummary.offline}</strong>
          </div>
          <div className="metric-card">
            <span>Online</span>
            <strong>{inductionSummary.online}</strong>
          </div>
          <div className="metric-card">
            <span>Total Completed</span>
            <strong>{inductionSummary.total}</strong>
          </div>
          <div className="metric-card">
            <span>Yet to Complete</span>
            <strong>{yetToCompleteSchools.length}</strong>
          </div>
        </div>
        {inductionByState.length ? (
          <div className="dashboard-grid induction-status-grid">
            {inductionByState.map((group) => (
              <article key={group.state} className="panel dashboard-panel induction-state-card">
                <div className="panel-header compact">
                  <h2>{group.state}</h2>
                  <span className="panel-badge">
                    {group.offline} done • {group.online} online
                  </span>
                </div>
                <div className="report-list">
                  {group.schools.slice(0, 50).map((school) => (
                    <div key={`${group.state}-${school.schoolName}-${school.city}`} className="report-row">
                      <div>
                        <strong>{school.schoolName}</strong>
                        <span>{school.city || '—'}</span>
                      </div>
                      <span className={`status-pill ${String(school.status).trim().toLowerCase() === 'online' ? 'info' : 'sent'}`}>
                        {school.status}
                      </span>
                    </div>
                  ))}
                  {group.schools.length > 50 && (
                    <div className="muted-text">+{group.schools.length - 50} more schools in {group.state}</div>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">No schools marked Done / Online for induction training in the master sheet.</div>
        )}
      </div>

      <div className="panel dashboard-panel">
        <div className="panel-header compact">
          <h2>Yet to Complete — Induction Training (by state)</h2>
        </div>
        <p className="muted-text">Schools not yet marked Done / Online in the master sheet — blank, NA, waiting for confirmation, or any other pending value.</p>
        {yetToCompleteByState.length ? (
          <div className="dashboard-grid induction-status-grid">
            {yetToCompleteByState.map((group) => (
              <article key={group.state} className="panel dashboard-panel induction-state-card">
                <div className="panel-header compact">
                  <h2>{group.state}</h2>
                  <span className="panel-badge">{group.total} pending</span>
                </div>
                <div className="report-list">
                  {group.schools.slice(0, 50).map((school) => (
                    <div key={`${group.state}-${school.schoolName}-${school.city}`} className="report-row">
                      <div>
                        <strong>{school.schoolName}</strong>
                        <span>{school.city || '—'}</span>
                      </div>
                      <span className="status-pill warning">{school.status || 'Not marked'}</span>
                    </div>
                  ))}
                  {group.schools.length > 50 && (
                    <div className="muted-text">+{group.schools.length - 50} more schools in {group.state}</div>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">Every school in the master sheet has completed induction training. Great work!</div>
        )}
      </div>

      {showForm && (
        <div className="panel dashboard-panel">
          <div className="panel-header compact">
            <h2>{editingId ? 'Edit training report' : 'Log a training session'}</h2>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="scheduler-presets" style={{ marginBottom: 14 }}>
              {['Offline', 'Online'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`scheduler-chip ${form.trainingType === mode ? 'active' : ''}`}
                  onClick={() => setForm((prev) => ({ ...prev, trainingType: mode }))}
                >
                  {mode === 'Offline' ? 'In-school / Offline' : 'Online'}
                </button>
              ))}
            </div>
            <div className="form-grid">
              <label>
                Training Title *
                <input name="title" value={form.title} onChange={handleChange} placeholder="e.g. Robotics Induction Training" required />
              </label>
              <label>
                Date *
                <input type="date" name="date" value={form.date} onChange={handleChange} required />
              </label>
              <label>
                Topic
                <input name="topic" value={form.topic} onChange={handleChange} placeholder="e.g. EV3 Robotics basics" />
              </label>
              <label>
                Audience
                <input name="audience" value={form.audience} onChange={handleChange} placeholder="e.g. Teachers, Students, Staff" />
              </label>
              {isOnline ? (
                <>
                  <label>
                    Platform
                    <input name="platform" value={form.platform} onChange={handleChange} placeholder="e.g. Zoom, Google Meet" />
                  </label>
                  <label>
                    Meeting Link
                    <input name="meetingLink" value={form.meetingLink} onChange={handleChange} placeholder="https://..." />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    State
                    <select name="state" value={form.state} onChange={handleChange}>
                      <option value="">Select state</option>
                      {states.map((state) => (
                        <option key={state} value={state}>
                          {state}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    School
                    <select name="schoolName" value={form.schoolName} onChange={handleChange} disabled={!form.state}>
                      <option value="">Select school</option>
                      {filteredSchools.map((school) => (
                        <option key={`${school.state}-${school.schoolName}`} value={school.schoolName}>
                          {school.schoolName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Venue
                    <input name="venue" value={form.venue} onChange={handleChange} placeholder="e.g. School hall, Lab 2" />
                  </label>
                  <label>
                    City
                    <input name="city" value={form.city} onChange={handleChange} placeholder="City / town" />
                  </label>
                </>
              )}
              <label>
                Attendees
                <input type="number" min="0" name="attendanceCount" value={form.attendanceCount} onChange={handleChange} placeholder="0" />
              </label>
              <label>
                Duration (hours)
                <input type="number" min="0" step="0.5" name="durationHours" value={form.durationHours} onChange={handleChange} placeholder="0" />
              </label>
              <label className="full-width-field">
                Notes
                <textarea name="notes" value={form.notes} onChange={handleChange} rows="3" placeholder="Session highlights, feedback, next steps..." />
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button type="submit" className="primary-button" disabled={saving}>
                {saving ? 'Saving...' : editingId ? 'Update Training' : 'Log Training'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="panel dashboard-panel">
        <div className="panel-header compact">
          <h2>Training records</h2>
        </div>
        {summary && (
          <div className="dashboard-stats dashboard-stats-compact">
            <div className="metric-card">
              <span>Total</span>
              <strong>{summary.total || 0}</strong>
            </div>
            <div className="metric-card">
              <span>Offline</span>
              <strong>{summary.offline || 0}</strong>
            </div>
            <div className="metric-card">
              <span>Online</span>
              <strong>{summary.online || 0}</strong>
            </div>
            <div className="metric-card">
              <span>This Month</span>
              <strong>{summary.thisMonth || 0}</strong>
            </div>
            <div className="metric-card">
              <span>Attendees</span>
              <strong>{summary.attendees || 0}</strong>
            </div>
            <div className="metric-card">
              <span>Hours</span>
              <strong>{summary.hours || 0}</strong>
            </div>
          </div>
        )}

        {loading ? (
          <div className="status-text">Loading training reports...</div>
        ) : trainings.length ? (
          <div className="report-list">
            {trainings.map((training) => (
              <div key={training._id} className="report-row">
                <div>
                  <strong>{training.title}</strong>
                  <span>
                    <span className={`status-pill ${training.trainingType === 'Online' ? 'info' : 'sent'}`}>{training.trainingType}</span>{' '}
                    {new Date(training.date).toLocaleDateString('en-IN')}
                    {training.schoolName ? ` | ${training.schoolName}` : ''}
                    {training.state ? ` | ${training.state}` : ''}
                    {training.platform ? ` | ${training.platform}` : ''}
                    {training.audience ? ` | ${training.audience}` : ''}
                    {' | '}
                    {training.attendanceCount || 0} attendees • {training.durationHours || 0} hrs
                    {' | '}
                    {training.programManagerName || training.programManagerEmail}
                  </span>
                  {training.notes && <span className="muted-text">{training.notes}</span>}
                </div>
                {canManage(training) && (
                  <div className="row-actions">
                    <button type="button" className="table-action" onClick={() => openEditForm(training)}>
                      Edit
                    </button>
                    <button type="button" className="table-action" onClick={() => handleDelete(training)}>
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">No training reports yet. Click &quot;+ Log Training&quot; to record an offline or online session.</div>
        )}
      </div>
    </div>
  );
}
