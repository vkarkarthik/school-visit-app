import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function OperationsDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());

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
            <Panel title="Upcoming Follow-ups">
              <ReportList
                reports={dashboard.upcomingFollowUps}
                emptyText="No upcoming follow-ups."
                action={(report) => (
                  <span className="status-pill sent">
                    {new Date(report.nextVisitDate).toLocaleDateString('en-IN')}
                  </span>
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

          <Panel title="Recent Reports">
            <ReportList reports={dashboard.recentReports} emptyText="No reports yet." />
          </Panel>
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
