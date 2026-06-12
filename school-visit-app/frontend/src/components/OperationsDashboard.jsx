import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function OperationsDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [previewReport, setPreviewReport] = useState(null);
  const [reportFilters, setReportFilters] = useState({
    search: '',
    manager: '',
    purpose: '',
    status: '',
  });

  useEffect(() => {
    loadDashboard();
  }, [year]);

  const loadDashboard = async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await api.get('/reports/dashboard', { params: { year } });
      setDashboard(response.data);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Dashboard could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  const updateNewSchoolStatus = async (reportId, status) => {
    setMessage('');
    try {
      await api.patch(`/reports/${reportId}`, { newSchoolApprovalStatus: status });
      await loadDashboard();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Could not update new school status.');
    }
  };

  const summary = dashboard?.summary || {};
  const filteredRecentReports = (dashboard?.recentReports || []).filter((report) => {
    const search = reportFilters.search.toLowerCase();
    const manager = reportFilters.manager.toLowerCase();
    const purpose = reportFilters.purpose.toLowerCase();

    const matchesSearch =
      !search ||
      String(report.schoolName || '').toLowerCase().includes(search) ||
      String(report.state || '').toLowerCase().includes(search);
    const matchesManager = !manager || String(report.programManagerName || '').toLowerCase().includes(manager);
    const matchesPurpose = !purpose || String(report.purposeOfVisit || '').toLowerCase().includes(purpose);
    const matchesStatus = !reportFilters.status || report.emailStatus === reportFilters.status;

    return matchesSearch && matchesManager && matchesPurpose && matchesStatus;
  });

  return (
    <section className="ops-dashboard">
      <div className="panel dashboard-hero">
        <div>
          <span className="eyebrow">Operations overview</span>
          <h2>Reports, leads, and delivery health</h2>
        </div>
        <label className="year-filter">
          Year
          <input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
        </label>
      </div>

      {message && <div className="status-text">{message}</div>}
      {loading && <div className="status-text">Loading dashboard...</div>}

      {!loading && dashboard && (
        <>
          <div className="dashboard-stats">
            <Metric label="Total Reports" value={summary.totalReports} />
            <Metric label="This Month" value={summary.monthReports} />
            <Metric label="Sent" value={summary.sentReports} tone="green" />
            <Metric label="Failed" value={summary.failedReports} tone="red" />
            <Metric label="New Schools" value={summary.newSchoolReports} tone="blue" />
            <Metric label="Pending Leads" value={summary.pendingNewSchools} tone="yellow" />
            <Metric label="Sheet Sync Failed" value={summary.sheetSyncFailed} tone="red" />
            <Metric label="Unique Schools" value={summary.uniqueSchools} />
            <Metric label="Active PMs" value={summary.activeManagers} />
            <Metric label="Planned Visits" value={summary.plannedVisits} tone="blue" />
            <Metric label="Converted Plans" value={summary.convertedPlans} tone="green" />
            <Metric label="Pending Actions" value={summary.pendingActionItems} tone="yellow" />
            <Metric label="Overdue Follow-ups" value={summary.overdueFollowUps} tone="red" />
          </div>

          <div className="dashboard-grid">
            <Panel title="Reports by Manager">
              <RankList
                items={dashboard.byManager}
                emptyText="No manager data yet."
                render={(item) => (
                  <>
                    <span>{item.name || 'Unknown'}</span>
                    <strong>{item.count}</strong>
                  </>
                )}
              />
            </Panel>

            <Panel title="Reports by Purpose">
              <RankList
                items={dashboard.byPurpose}
                emptyText="No purpose data yet."
                render={(item) => (
                  <>
                    <span>{item.purpose}</span>
                    <strong>{item.count}</strong>
                  </>
                )}
              />
            </Panel>
          </div>

          <div className="dashboard-grid wide">
            <Panel title="Upcoming Planned Visits">
              <PlanList
                plans={dashboard.upcomingPlans}
                emptyText="No upcoming plans."
                action={(plan) => (
                  <button type="button" className="table-action" onClick={() => sendPlanReminder(plan._id)}>
                    Remind
                  </button>
                )}
              />
            </Panel>

            <Panel title="Upcoming Follow-ups">
              <ReportList
                reports={dashboard.upcomingFollowUps}
                emptyText="No upcoming follow-ups."
                action={(report) => (
                  <div className="row-actions">
                    <span className="status-pill sent">
                      {new Date(report.nextVisitDate).toLocaleDateString('en-IN')}
                    </span>
                    <button type="button" className="table-action" onClick={() => sendFollowUpReminder(report._id)}>
                      Remind
                    </button>
                  </div>
                )}
              />
            </Panel>

            <Panel title="Pending New Schools">
              <ReportList
                reports={dashboard.pendingNewSchools}
                emptyText="No pending new school approvals."
                action={(report) => (
                  <div className="row-actions">
                    <button type="button" className="table-action" onClick={() => updateNewSchoolStatus(report._id, 'Approved')}>
                      Approve
                    </button>
                    <button type="button" className="table-action" onClick={() => updateNewSchoolStatus(report._id, 'Duplicate')}>
                      Duplicate
                    </button>
                    <button type="button" className="table-action" onClick={() => updateNewSchoolStatus(report._id, 'Converted')}>
                      Converted
                    </button>
                    <select
                      value={report.salesLeadStatus || 'Pending'}
                      onChange={(e) => updateLeadStatus(report._id, e.target.value)}
                      className="compact-select"
                    >
                      <option>Pending</option>
                      <option>Contacted</option>
                      <option>Demo Done</option>
                      <option>Proposal Sent</option>
                      <option>Converted</option>
                      <option>Not Interested</option>
                    </select>
                  </div>
                )}
              />
            </Panel>

            <Panel title="Failed Emails">
              <ReportList
                reports={dashboard.failedReports}
                emptyText="No failed emails."
                action={(report) => <span className="muted-text">{report.emailLastError || 'Check backend logs'}</span>}
              />
            </Panel>
          </div>

          <Panel title="Pending Action Tracker">
            <ActionList items={dashboard.pendingActionItems} emptyText="No pending action items." />
          </Panel>

          <Panel title="Recent Reports">
            <div className="report-card-filters">
              <label>
                Search
                <input
                  value={reportFilters.search}
                  onChange={(e) => setReportFilters((prev) => ({ ...prev, search: e.target.value }))}
                  placeholder="School or state"
                />
              </label>
              <label>
                Manager
                <input
                  value={reportFilters.manager}
                  onChange={(e) => setReportFilters((prev) => ({ ...prev, manager: e.target.value }))}
                  placeholder="PM name"
                />
              </label>
              <label>
                Purpose
                <input
                  value={reportFilters.purpose}
                  onChange={(e) => setReportFilters((prev) => ({ ...prev, purpose: e.target.value }))}
                  placeholder="Training / Demo"
                />
              </label>
              <label>
                Status
                <select value={reportFilters.status} onChange={(e) => setReportFilters((prev) => ({ ...prev, status: e.target.value }))}>
                  <option value="">All</option>
                  <option value="Sent">Sent</option>
                  <option value="Failed">Failed</option>
                </select>
              </label>
            </div>

            <ReportCardGrid reports={filteredRecentReports} emptyText="No reports yet." onPreview={openPreview} />
          </Panel>

          {previewReport && (
            <ReportPreviewModal
              report={previewReport}
              onClose={closePreview}
            />
          )}
        </>
      )}
    </section>
  );

  async function updateLeadStatus(reportId, status) {
    setMessage('');
    try {
      await api.patch(`/reports/${reportId}`, { salesLeadStatus: status });
      await loadDashboard();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Could not update lead status.');
    }
  }

  async function sendFollowUpReminder(reportId) {
    setMessage('');
    try {
      const response = await api.post(`/reports/${reportId}/send-reminder`);
      setMessage(response.data.message || 'Reminder sent.');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Could not send follow-up reminder.');
    }
  }

  async function sendPlanReminder(planId) {
    setMessage('');
    try {
      const response = await api.post(`/plans/${planId}/remind`);
      setMessage(response.data.message || 'Reminder sent.');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Could not send plan reminder.');
    }
  }

  async function openPreview(report) {
    setMessage('');
    setPreviewReport(report);
  }

  function closePreview() {
    setPreviewReport(null);
  }
}

function Metric({ label, value = 0, tone = '' }) {
  return (
    <div className={`metric-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <section className="panel dashboard-panel">
      <div className="panel-header compact">
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function RankList({ items = [], render, emptyText }) {
  if (!items.length) return <div className="empty-state">{emptyText}</div>;

  return (
    <div className="rank-list">
      {items.map((item) => (
        <div key={item.name || item.purpose} className="rank-row">
          {render(item)}
        </div>
      ))}
    </div>
  );
}

function ReportList({ reports = [], emptyText, action }) {
  if (!reports.length) return <div className="empty-state">{emptyText}</div>;

  return (
    <div className="report-list">
      {reports.map((report) => (
        <div key={report._id} className="report-row">
          <div>
            <strong>{report.schoolName}</strong>
            <span>
              {new Date(report.visitDate).toLocaleDateString('en-IN')} | {report.purposeOfVisit} | {report.programManagerName}
            </span>
          </div>
          {action ? action(report) : <span className={`status-pill ${report.emailStatus === 'Sent' ? 'sent' : 'failed'}`}>{report.emailStatus}</span>}
        </div>
      ))}
    </div>
  );
}

function ReportCardGrid({ reports = [], emptyText, onPreview }) {
  if (!reports.length) return <div className="empty-state">{emptyText}</div>;

  return (
    <div className="report-card-grid">
      {reports.map((report) => (
        <article key={report._id} className="report-card">
          <div className="report-card-top">
            <div>
              <strong>{report.schoolName}</strong>
              <span>
                {new Date(report.visitDate).toLocaleDateString('en-IN')} | {report.purposeOfVisit}
              </span>
            </div>
            <span className={`status-pill ${report.emailStatus === 'Sent' ? 'sent' : 'failed'}`}>{report.emailStatus}</span>
          </div>

          <div className="report-card-meta">
            <span>{report.programManagerName}</span>
            <span>{report.state || 'State pending'}</span>
            <span>{report.pointOfContact || 'POC pending'}</span>
            <span>{report.nextVisitDate ? `Next: ${new Date(report.nextVisitDate).toLocaleDateString('en-IN')}` : 'No next follow-up'}</span>
          </div>

          <p>{truncateText(report.sessionSummary || 'No summary available yet.', 180)}</p>

          <div className="row-actions">
            <button type="button" className="table-action" onClick={() => onPreview(report)}>
              Preview
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function PlanList({ plans = [], emptyText, action }) {
  if (!plans?.length) return <div className="empty-state">{emptyText}</div>;

  return (
    <div className="report-list">
      {plans.map((plan) => (
        <div key={plan._id} className="report-row">
          <div>
            <strong>{plan.schoolName}</strong>
            <span>
              {new Date(plan.plannedDate).toLocaleDateString('en-IN')} | {plan.purposeOfVisit} | {plan.programManagerName}
            </span>
          </div>
          {action ? action(plan) : <span className={`status-pill ${getPlanTone(plan.status)}`}>{plan.status}</span>}
        </div>
      ))}
    </div>
  );
}

function ActionList({ items = [], emptyText }) {
  if (!items?.length) return <div className="empty-state">{emptyText}</div>;

  return (
    <div className="report-list">
      {items.map((item) => (
        <div key={`${item.reportId}-${item._id || item.title}`} className="report-row">
          <div>
            <strong>{item.schoolName}</strong>
            <span>
              {item.title} | {item.owner || 'Program Manager'} | {item.status}
              {item.dueDate ? ` | Due ${new Date(item.dueDate).toLocaleDateString('en-IN')}` : ''}
            </span>
          </div>
          <span className={`status-pill ${item.status === 'Completed' ? 'sent' : item.status === 'Blocked' ? 'failed' : 'warning'}`}>
            {item.status}
          </span>
        </div>
      ))}
    </div>
  );
}

function getPlanTone(status) {
  if (status === 'Completed') return 'sent';
  if (status === 'Cancelled') return 'failed';
  if (status === 'Confirmed') return 'info';
  return 'warning';
}

function truncateText(value, maxLength = 180) {
  const text = String(value || '').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

function ReportPreviewModal({ report, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="modal-card report-preview-modal" onClick={(event) => event.stopPropagation()}>
        <div className="panel-header compact">
          <div>
            <span className="eyebrow">Report preview</span>
            <h2>{report.schoolName}</h2>
            <p className="muted-text">
              {new Date(report.visitDate).toLocaleDateString('en-IN')} | {report.purposeOfVisit} | {report.programManagerName}
            </p>
          </div>
          <div className="row-actions">
            <button type="button" className="table-action" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="preview-meta-grid">
          <div>
            <strong>School Email</strong>
            <span>{report.schoolEmail || '-'}</span>
          </div>
          <div>
            <strong>Contact</strong>
            <span>{report.pointOfContact || '-'} {report.contactNo ? `| ${report.contactNo}` : ''}</span>
          </div>
          <div>
            <strong>Status</strong>
            <span>{report.emailStatus || '-'}</span>
          </div>
          <div>
            <strong>Next Follow-up</strong>
            <span>{report.nextVisitDate ? new Date(report.nextVisitDate).toLocaleDateString('en-IN') : '-'}</span>
          </div>
        </div>

        <div className="preview-copy-grid">
          <div className="preview-copy-card">
            <strong>Session Summary</strong>
            <p>{report.sessionSummary || 'No summary available.'}</p>
          </div>
          <div className="preview-copy-card">
            <strong>Action Items</strong>
            <p>{report.actionItems || 'No action items available.'}</p>
          </div>
        </div>

      </section>
    </div>
  );
}
