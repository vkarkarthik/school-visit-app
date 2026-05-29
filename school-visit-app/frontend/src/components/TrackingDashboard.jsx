import { useMemo, useState } from 'react';
import { api } from '../api/client';

export default function TrackingDashboard({ schoolMaster, currentUser }) {
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
    dateFrom: '',
    dateTo: ''
  });
  const [summary, setSummary] = useState({
    totalReports: 0,
    sentReports: 0,
    failedReports: 0,
    newSchoolReports: 0,
    pendingNewSchools: 0
  });
  const [reports, setReports] = useState([]);
  const [timeline, setTimeline] = useState([]);
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

  const handleLoad = async () => {
    setLoading(true);
    setMessage('');
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ''));
      const response = await api.get('/reports/tracking', { params });
      setSummary(response.data.summary);
      setReports(response.data.reports);
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
          <h2>School tracking</h2>
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

        <label>
          From
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
          />
        </label>

        <label>
          To
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
          />
        </label>

        <label>
          Manager
          <input
            value={filters.programManagerName}
            onChange={(e) => setFilters({ ...filters, programManagerName: e.target.value })}
            placeholder={currentUser?.name || 'Search manager'}
          />
        </label>

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
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Visit Date</th>
              <th>Purpose</th>
              <th>Type</th>
              <th>Manager</th>
              <th>Status</th>
              <th>Email</th>
              <th>Sheet</th>
              <th>Lead</th>
              <th>Resends</th>
              <th>PDF</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr key={report._id}>
                <td>{new Date(report.visitDate).toLocaleDateString('en-IN')}</td>
                <td>{report.purposeOfVisit}</td>
                <td>{report.isNewSchool ? 'New' : 'Existing'}</td>
                <td>{report.programManagerName}</td>
                <td>
                  <span className={`status-pill ${report.emailStatus === 'Sent' ? 'sent' : 'failed'}`}>
                    {report.emailStatus}
                  </span>
                </td>
                <td>{report.schoolEmail}</td>
                <td>
                  {report.isNewSchool ? (
                    <span className={`status-pill ${report.newSchoolSheetStatus === 'Failed' ? 'failed' : 'sent'}`}>
                      {report.newSchoolSheetStatus || 'Pending'}
                    </span>
                  ) : (
                    <span className="muted-text">NA</span>
                  )}
                </td>
                <td>{report.salesLeadStatus || 'Not Required'}</td>
                <td>{report.resendCount || 0}</td>
                <td>
                  {report.pdfUrl ? (
                    <a href={report.pdfUrl} target="_blank" rel="noreferrer">
                      Open PDF
                    </a>
                  ) : (
                    'Not saved'
                  )}
                </td>
                <td>
                  <div className="row-actions">
                    <button type="button" className="table-action" onClick={() => setEditingReport(report)} disabled={loading}>
                      Edit
                    </button>
                    <button type="button" className="table-action" onClick={() => resendReport(report._id)} disabled={loading}>
                      Resend
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!reports.length && (
              <tr>
                <td colSpan="11">No reports found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
                Session Summary
                <textarea rows="5" value={editingReport.sessionSummary || ''} onChange={(e) => setEditingReport({ ...editingReport, sessionSummary: e.target.value })} />
              </label>
              <label className="full-width">
                Action Items
                <textarea rows="4" value={editingReport.actionItems || ''} onChange={(e) => setEditingReport({ ...editingReport, actionItems: e.target.value })} />
              </label>
              <label className="full-width">
                Remarks
                <textarea rows="3" value={editingReport.remarks || ''} onChange={(e) => setEditingReport({ ...editingReport, remarks: e.target.value })} />
              </label>
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
}
