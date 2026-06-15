import { useMemo, useState } from 'react';
import { api } from '../api/client';

function formatDateInput(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export default function TrackingDashboard({ schoolMaster, currentUser, isAdmin }) {
  const today = useMemo(() => new Date(), []);
  const defaultFrom = useMemo(() => formatDateInput(addDays(today, -30)), [today]);
  const defaultTo = useMemo(() => formatDateInput(today), [today]);
  const [filters, setFilters] = useState({
    state: '',
    schoolName: '',
    year: new Date().getFullYear(),
    emailStatus: '',
    programManagerName: '',
    purposeOfVisit: '',
    isNewSchool: '',
    newSchoolApprovalStatus: '',
    salesLeadStatus: '',
    dateFrom: defaultFrom,
    dateTo: defaultTo
  });
  const [rangePreset, setRangePreset] = useState('last30');
  const [summary, setSummary] = useState({
    totalReports: 0,
    sentReports: 0,
    failedReports: 0,
    newSchoolReports: 0,
    pendingNewSchools: 0
  });
  const [reports, setReports] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [pendingActionItems, setPendingActionItems] = useState([]);
  const [editingReport, setEditingReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const schools = Array.isArray(schoolMaster?.schools) ? schoolMaster.schools : [];
  const states = Array.isArray(schoolMaster?.states) ? schoolMaster.states : [];
  const hasSchoolMaster = states.length > 0 && schools.length > 0;

  const filteredSchools = useMemo(() => {
    return schools
      .filter((school) => school.state === filters.state)
      .sort((a, b) => a.schoolName.localeCompare(b.schoolName));
  }, [schools, filters.state]);

  const applyRangePreset = (preset) => {
    const base = new Date();
    let dateFrom = '';
    let dateTo = '';

    if (preset === 'last7') {
      dateFrom = formatDateInput(addDays(base, -7));
      dateTo = formatDateInput(base);
    }

    if (preset === 'last30') {
      dateFrom = formatDateInput(addDays(base, -30));
      dateTo = formatDateInput(base);
    }

    if (preset === 'thisMonth') {
      const monthStart = new Date(base.getFullYear(), base.getMonth(), 1);
      dateFrom = formatDateInput(monthStart);
      dateTo = formatDateInput(base);
    }

    setRangePreset(preset);
    setFilters((prev) => ({
      ...prev,
      dateFrom,
      dateTo
    }));
  };

  const handleLoad = async () => {
    setLoading(true);
    setMessage('');
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ''));
      const response = await api.get('/reports/tracking', { params });
      setSummary(response.data.summary);
      setReports(response.data.reports);
      setPendingActionItems(response.data.pendingActionItems || []);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to load tracking.');
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    const headers = [
      'Visit Date',
      'School',
      'Type',
      'State',
      'Purpose',
      'Manager',
      'Status',
      'School Email',
      'Sheet Status',
      'Lead Stage',
      'Resend Count',
      'PDF'
    ];
    const rows = reports.map((report) => [
      new Date(report.visitDate).toLocaleDateString('en-IN'),
      report.schoolName,
      report.isNewSchool ? 'New / Prospect' : 'Existing',
      report.state,
      report.purposeOfVisit,
      report.programManagerName,
      report.emailStatus,
      report.schoolEmail,
      report.newSchoolSheetStatus || '',
      report.salesLeadStatus || '',
      report.resendCount || 0,
      report.pdfUrl || ''
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell || '').replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `school-visit-reports-${filters.year || 'all'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const resendReport = async (reportId) => {
    setLoading(true);
    setMessage('');
    try {
      const response = await api.post(`/reports/${reportId}/resend`);
      setMessage(response.data.message);
      await handleLoad();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to resend email.');
    } finally {
      setLoading(false);
    }
  };

  const sendReminder = async (reportId) => {
    setLoading(true);
    setMessage('');
    try {
      const response = await api.post(`/reports/${reportId}/send-reminder`);
      setMessage(response.data.message);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to send reminder.');
    } finally {
      setLoading(false);
    }
  };

  const loadTimeline = async () => {
    if (!filters.schoolName) {
      setMessage('Select a school to load timeline.');
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      const response = await api.get('/reports/timeline', {
        params: { schoolName: filters.schoolName, state: filters.state }
      });
      setTimeline(response.data.reports || []);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to load school timeline.');
    } finally {
      setLoading(false);
    }
  };

  const saveCorrection = async () => {
    if (!editingReport) return;

    setLoading(true);
    setMessage('');
    try {
      await api.patch(`/reports/${editingReport._id}`, {
        schoolEmail: editingReport.schoolEmail,
        ccEmails: editingReport.ccEmails,
        sessionSummary: editingReport.sessionSummary,
        actionItems: editingReport.actionItems,
        actionItemsDetailed: editingReport.actionItemsDetailed,
        nextVisitDate: editingReport.nextVisitDate,
        remarks: editingReport.remarks,
        reportStatus: 'Needs Correction'
      });
      setEditingReport(null);
      setMessage('Correction saved. Use resend after reviewing.');
      await handleLoad();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to save correction.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside className="panel tracking-panel">
      <div className="panel-header">
        <div>
          <span className="eyebrow">Monitoring</span>
          <h2>{isAdmin ? 'School tracking' : 'My report tracking'}</h2>
        </div>
        <span className="panel-badge">Yearly</span>
      </div>

      <div className="tracking-filter-grid">
        <label>
          State
          {hasSchoolMaster ? (
            <select
              value={filters.state}
              onChange={(e) => setFilters({ ...filters, state: e.target.value, schoolName: '' })}
            >
              <option value="">Select state</option>
              {states.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={filters.state}
              onChange={(e) => setFilters({ ...filters, state: e.target.value })}
            />
          )}
        </label>

        <label>
          School Name
          {hasSchoolMaster ? (
            <>
            <input
              value={filters.schoolName}
              list="tracking-school-options"
              placeholder="Search school"
              onChange={(e) => setFilters({ ...filters, schoolName: e.target.value })}
            />
            <datalist id="tracking-school-options">
              {filteredSchools.map((school) => (
                <option key={`${school.state}-${school.schoolName}`} value={school.schoolName} />
              ))}
            </datalist>
            </>
          ) : (
            <input
              value={filters.schoolName}
              onChange={(e) => setFilters({ ...filters, schoolName: e.target.value })}
            />
          )}
        </label>

        <label>
          Year
          <input
            type="number"
            value={filters.year}
            onChange={(e) => setFilters({ ...filters, year: e.target.value })}
          />
        </label>

        <label>
          Email Status
          <select
            value={filters.emailStatus}
            onChange={(e) => setFilters({ ...filters, emailStatus: e.target.value })}
          >
            <option value="">All</option>
            <option value="Sent">Sent</option>
            <option value="Failed">Failed</option>
          </select>
        </label>

        <label>
          Purpose
          <select
            value={filters.purposeOfVisit}
            onChange={(e) => setFilters({ ...filters, purposeOfVisit: e.target.value })}
          >
            <option value="">All</option>
            <option>New School Visit / Demo</option>
            <option>Teachers Copy</option>
            <option>Induction Training</option>
            <option>Teachers Training</option>
            <option>Robotics Training</option>
            <option>Admin Related Work</option>
          </select>
        </label>

        <label>
          School Type
          <select
            value={filters.isNewSchool}
            onChange={(e) => setFilters({ ...filters, isNewSchool: e.target.value })}
          >
            <option value="">All</option>
            <option value="false">Existing</option>
            <option value="true">New / Prospect</option>
          </select>
        </label>

        <label>
          New School Status
          <select
            value={filters.newSchoolApprovalStatus}
            onChange={(e) => setFilters({ ...filters, newSchoolApprovalStatus: e.target.value })}
          >
            <option value="">All</option>
            <option>Pending</option>
            <option>Approved</option>
            <option>Duplicate</option>
            <option>Converted</option>
            <option>Not Required</option>
          </select>
        </label>

        <label>
          Lead Stage
          <select
            value={filters.salesLeadStatus}
            onChange={(e) => setFilters({ ...filters, salesLeadStatus: e.target.value })}
          >
            <option value="">All</option>
            <option>Pending</option>
            <option>Contacted</option>
            <option>Demo Done</option>
            <option>Proposal Sent</option>
            <option>Converted</option>
            <option>Not Interested</option>
            <option>Not Required</option>
          </select>
        </label>

        <div className="full-span tracking-range-row">
          <div className="scheduler-presets">
            {[
              { id: 'last7', label: 'Last 7 Days' },
              { id: 'last30', label: 'Last 30 Days' },
              { id: 'thisMonth', label: 'This Month' },
              { id: 'all', label: 'All Time' }
            ].map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`scheduler-chip ${rangePreset === preset.id ? 'active' : ''}`}
                onClick={() => applyRangePreset(preset.id)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {isAdmin && (
          <label>
            Manager
            <input
              value={filters.programManagerName}
              onChange={(e) => setFilters({ ...filters, programManagerName: e.target.value })}
              placeholder={currentUser?.name || 'Search manager'}
            />
          </label>
        )}

        <div className="align-end">
          <button onClick={handleLoad} disabled={loading} className="secondary-button">
            {loading ? 'Loading...' : 'Load Tracking'}
          </button>
        </div>

        <div className="align-end">
          <button onClick={exportCsv} disabled={!reports.length} className="ghost-button">
            Export CSV
          </button>
        </div>

        <div className="align-end">
          <button onClick={loadTimeline} disabled={loading || !filters.schoolName} className="ghost-button">
            School Timeline
          </button>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <span>Total Reports</span>
          <strong>{summary.totalReports}</strong>
        </div>
        <div className="stat-card">
          <span>Sent</span>
          <strong>{summary.sentReports}</strong>
        </div>
        <div className="stat-card">
          <span>Failed</span>
          <strong>{summary.failedReports}</strong>
        </div>
        <div className="stat-card">
          <span>New Schools</span>
          <strong>{summary.newSchoolReports}</strong>
        </div>
        <div className="stat-card">
          <span>Pending Leads</span>
          <strong>{summary.pendingNewSchools}</strong>
        </div>
        <div className="stat-card">
          <span>Unique Schools</span>
          <strong>{summary.uniqueSchools || 0}</strong>
        </div>
        <div className="stat-card">
          <span>{isAdmin ? 'Active PMs' : 'Pending Actions'}</span>
          <strong>{isAdmin ? summary.activeManagers || 0 : summary.pendingActionItems || 0}</strong>
        </div>
        <div className="stat-card">
          <span>Overdue Follow-ups</span>
          <strong>{summary.overdueFollowUps || 0}</strong>
        </div>
      </div>

      {!reports.length ? (
        <div className="empty-state">No reports found.</div>
      ) : (
        <div className="tracking-card-grid">
          {reports.map((report) => {
            const pendingActions =
              (report.actionItemsDetailed || []).filter((item) => item.status !== 'Completed').length || 0;

            return (
              <article key={report._id} className="tracking-card">
                <div className="tracking-card-top">
                  <div>
                    <strong>{report.schoolName}</strong>
                    <span>
                      {new Date(report.visitDate).toLocaleDateString('en-IN')} | {report.purposeOfVisit}
                    </span>
                  </div>
                  <span className={`status-pill ${report.emailStatus === 'Sent' ? 'sent' : 'failed'}`}>
                    {report.emailStatus}
                  </span>
                </div>

                <div className="tracking-card-meta">
                  <span>{report.isNewSchool ? 'New / Prospect' : 'Existing school'}</span>
                  <span>{report.programManagerName}</span>
                  <span>{report.state}</span>
                  <span>{report.schoolEmail || 'Email pending'}</span>
                </div>

                <div className="tracking-card-details">
                  <div>
                    <span>Sheet</span>
                    <strong>{report.isNewSchool ? report.newSchoolSheetStatus || 'Pending' : 'NA'}</strong>
                  </div>
                  <div>
                    <span>Lead Stage</span>
                    <strong>{report.salesLeadStatus || 'Not Required'}</strong>
                  </div>
                  <div>
                    <span>Resends</span>
                    <strong>{report.resendCount || 0}</strong>
                  </div>
                  <div>
                    <span>Next Follow-up</span>
                    <strong>
                      {report.nextVisitDate ? new Date(report.nextVisitDate).toLocaleDateString('en-IN') : 'Not planned'}
                    </strong>
                  </div>
                  <div>
                    <span>Pending Actions</span>
                    <strong>{pendingActions}</strong>
                  </div>
                </div>

                <div className="tracking-card-actions">
                  {isAdmin ? (
                    <>
                      <button type="button" className="table-action" onClick={() => setEditingReport(report)} disabled={loading}>
                        Edit
                      </button>
                      <button type="button" className="table-action" onClick={() => resendReport(report._id)} disabled={loading}>
                        Resend
                      </button>
                      {report.nextVisitDate && (
                        <button type="button" className="table-action" onClick={() => sendReminder(report._id)} disabled={loading}>
                          Remind
                        </button>
                      )}
                    </>
                  ) : (
                    <button type="button" className="table-action" onClick={() => sendReminder(report._id)} disabled={loading}>
                      Remind
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {timeline.length > 0 && (
        <div className="timeline-panel">
          <div className="panel-header compact">
            <h2>School Timeline</h2>
          </div>
          <div className="report-list">
            {timeline.map((report) => (
              <div key={report._id} className="report-row">
                <div>
                  <strong>{new Date(report.visitDate).toLocaleDateString('en-IN')} | {report.purposeOfVisit}</strong>
                  <span>{report.programManagerName} | {report.emailStatus} | Next: {report.nextVisitDate ? new Date(report.nextVisitDate).toLocaleDateString('en-IN') : 'Not planned'}</span>
                </div>
                {report.pdfUrl && <a href={report.pdfUrl} target="_blank" rel="noreferrer">PDF</a>}
              </div>
            ))}
          </div>
        </div>
      )}
      {pendingActionItems.length > 0 && (
        <div className="timeline-panel">
          <div className="panel-header compact">
            <h2>Pending Action Tracker</h2>
          </div>
          <div className="report-list">
            {pendingActionItems.map((item) => (
              <div key={`${item.reportId}-${item._id || item.title}`} className="report-row">
                <div>
                  <strong>{item.schoolName} | {item.title}</strong>
                  <span>
                    {item.programManagerName} | {item.owner || 'Program Manager'} | {item.status}
                    {item.dueDate ? ` | Due ${new Date(item.dueDate).toLocaleDateString('en-IN')}` : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {message && <div className="status-text tracking-message">{message}</div>}

      {editingReport && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="preview-modal">
            <div className="panel-header">
              <div>
                <span className="eyebrow">Correction</span>
                <h2>Edit report before resend</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setEditingReport(null)}>
                Close
              </button>
            </div>
            <div className="form-grid">
              <label>
                School Email
                <input value={editingReport.schoolEmail || ''} onChange={(e) => setEditingReport({ ...editingReport, schoolEmail: e.target.value })} />
              </label>
              <label>
                CC Emails
                <input value={editingReport.ccEmails || ''} onChange={(e) => setEditingReport({ ...editingReport, ccEmails: e.target.value })} />
              </label>
              <label className="full-width">
                Actual Work Done
                <textarea rows="4" value={editingReport.actualWorkDone || ''} onChange={(e) => setEditingReport({ ...editingReport, actualWorkDone: e.target.value })} />
              </label>
              <label>
                Work Mode
                <select value={editingReport.workMode || 'School Visit'} onChange={(e) => setEditingReport({ ...editingReport, workMode: e.target.value })}>
                  <option>School Visit</option>
                  <option>Work From Home</option>
                  <option>Work From Office</option>
                  <option>Travel</option>
                  <option>Other</option>
                </select>
              </label>
              <label>
                Actual Location
                <input value={editingReport.actualLocation || ''} onChange={(e) => setEditingReport({ ...editingReport, actualLocation: e.target.value })} />
              </label>
              <label className="full-width">
                Session Summary
                <textarea rows="5" value={editingReport.sessionSummary || ''} onChange={(e) => setEditingReport({ ...editingReport, sessionSummary: e.target.value })} />
              </label>
              <label className="full-width">
                Action Items
                <textarea rows="4" value={editingReport.actionItems || ''} onChange={(e) => setEditingReport({ ...editingReport, actionItems: e.target.value })} />
              </label>
              <label>
                Next Follow-up
                <input
                  type="date"
                  value={editingReport.nextVisitDate ? new Date(editingReport.nextVisitDate).toISOString().slice(0, 10) : ''}
                  onChange={(e) => setEditingReport({ ...editingReport, nextVisitDate: e.target.value })}
                />
              </label>
              <label className="full-width">
                Remarks
                <textarea rows="3" value={editingReport.remarks || ''} onChange={(e) => setEditingReport({ ...editingReport, remarks: e.target.value })} />
              </label>
              <div className="full-width action-editor">
                <div className="panel-header compact">
                  <h2>Structured Action Tracker</h2>
                  <button
                    type="button"
                    className="table-action"
                    onClick={() =>
                      setEditingReport({
                        ...editingReport,
                        actionItemsDetailed: [
                          ...(editingReport.actionItemsDetailed || []),
                          { title: '', owner: editingReport.programManagerName || 'Program Manager', dueDate: editingReport.nextVisitDate || '', status: 'Pending', notes: '' },
                        ],
                      })
                    }
                  >
                    Add Action
                  </button>
                </div>
                <div className="action-edit-list">
                  {(editingReport.actionItemsDetailed || []).map((item, index) => (
                    <div key={`${item._id || 'new'}-${index}`} className="action-edit-card">
                      <input
                        placeholder="Action title"
                        value={item.title || ''}
                        onChange={(e) => updateActionItem(index, 'title', e.target.value)}
                      />
                      <input
                        placeholder="Owner"
                        value={item.owner || ''}
                        onChange={(e) => updateActionItem(index, 'owner', e.target.value)}
                      />
                      <input
                        type="date"
                        value={item.dueDate ? new Date(item.dueDate).toISOString().slice(0, 10) : ''}
                        onChange={(e) => updateActionItem(index, 'dueDate', e.target.value)}
                      />
                      <select value={item.status || 'Pending'} onChange={(e) => updateActionItem(index, 'status', e.target.value)}>
                        <option>Pending</option>
                        <option>In Progress</option>
                        <option>Completed</option>
                        <option>Blocked</option>
                      </select>
                      <textarea
                        rows="2"
                        placeholder="Notes"
                        value={item.notes || ''}
                        onChange={(e) => updateActionItem(index, 'notes', e.target.value)}
                      />
                      <button type="button" className="table-action" onClick={() => removeActionItem(index)}>Remove</button>
                    </div>
                  ))}
                  {!(editingReport.actionItemsDetailed || []).length && <div className="empty-state">No structured action items yet.</div>}
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={() => setEditingReport(null)}>Cancel</button>
              <button type="button" className="primary-button" onClick={saveCorrection} disabled={loading}>Save Correction</button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );

  function updateActionItem(index, field, value) {
    setEditingReport((prev) => ({
      ...prev,
      actionItemsDetailed: (prev.actionItemsDetailed || []).map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }));
  }

  function removeActionItem(index) {
    setEditingReport((prev) => ({
      ...prev,
      actionItemsDetailed: (prev.actionItemsDetailed || []).filter((_, itemIndex) => itemIndex !== index),
    }));
  }
}
