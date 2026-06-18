import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';

function formatDateInput(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export default function OperationsCommandCenter({ currentUser, isAdmin, onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [plans, setPlans] = useState([]);
  const [tracking, setTracking] = useState({ summary: {}, reports: [], pendingActionItems: [] });
  const [dashboard, setDashboard] = useState(null);
  const [draftCount, setDraftCount] = useState(0);

  useEffect(() => {
    loadCommandCenter();
    setDraftCount(readDrafts().length);
  }, [isAdmin]);

  async function loadCommandCenter() {
    setLoading(true);
    setMessage('');
    const today = new Date();
    const dateFrom = formatDateInput(addDays(today, -14));
    const dateTo = formatDateInput(addDays(today, 14));
    const year = today.getFullYear();

    try {
      const requests = [
        api.get('/plans', { params: { dateFrom, dateTo } }),
        api.get('/reports/tracking', { params: { year, dateFrom, dateTo } }),
      ];

      if (isAdmin) {
        requests.push(api.get('/reports/dashboard', { params: { year } }));
      }

      const [plansResponse, trackingResponse, dashboardResponse] = await Promise.all(requests);
      setPlans(plansResponse.data?.plans || []);
      setTracking({
        summary: trackingResponse.data?.summary || {},
        reports: trackingResponse.data?.reports || [],
        pendingActionItems: trackingResponse.data?.pendingActionItems || [],
      });
      setDashboard(dashboardResponse?.data || null);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Could not load the command center.');
    } finally {
      setLoading(false);
    }
  }

  const viewModel = useMemo(() => {
    const today = new Date();
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const todayPlans = plans.filter((plan) => {
      const plannedDate = new Date(plan.plannedDate);
      return plannedDate >= todayStart && plannedDate < todayEnd;
    });

    const blockedPlans = plans.filter((plan) => plan.dailyStatus === 'Blocked');
    const pendingClosures = plans.filter((plan) => {
      const plannedDate = new Date(plan.plannedDate);
      const isTodayOrPast = plannedDate < todayEnd;
      return isTodayOrPast && plan.dailyStatus !== 'Closed' && plan.status !== 'Cancelled';
    });
    const internalQueue = plans.filter((plan) => plan.workMode !== 'School Visit' && plan.status !== 'Cancelled');
    const upcomingVisits = plans
      .filter((plan) => plan.workMode === 'School Visit' && ['Draft', 'Confirmed'].includes(plan.status))
      .sort((a, b) => new Date(a.plannedDate) - new Date(b.plannedDate))
      .slice(0, 5);

    const failedReports = (tracking.reports || []).filter((report) => report.emailStatus === 'Failed');
    const recentActivity = [
      ...plans.slice(0, 8).map((plan) => ({
        id: `plan-${plan._id}`,
        type: 'Plan',
        title: `${plan.programManagerName} planned ${plan.schoolName}`,
        meta: `${new Date(plan.plannedDate).toLocaleDateString('en-IN')} | ${plan.workMode || 'School Visit'} | ${plan.dailyStatus || 'Planned'}`,
        when: plan.updatedAt || plan.createdAt || plan.plannedDate,
      })),
      ...(tracking.reports || []).slice(0, 8).map((report) => ({
        id: `report-${report._id}`,
        type: 'Report',
        title: `${report.programManagerName} reported ${report.schoolName}`,
        meta: `${new Date(report.visitDate).toLocaleDateString('en-IN')} | ${report.emailStatus} | ${report.purposeOfVisit}`,
        when: report.updatedAt || report.createdAt || report.visitDate,
      })),
    ]
      .sort((a, b) => new Date(b.when) - new Date(a.when))
      .slice(0, 10);

    return {
      todayPlans,
      blockedPlans,
      pendingClosures,
      internalQueue,
      upcomingVisits,
      failedReports,
      recentActivity,
      fieldToday: todayPlans.filter((plan) => plan.workMode === 'School Visit'),
      internalToday: todayPlans.filter((plan) => plan.workMode !== 'School Visit'),
    };
  }, [plans, tracking]);

  const spotlight = {
    focus: viewModel.todayPlans.length,
    risk: viewModel.blockedPlans.length + viewModel.pendingClosures.length + viewModel.failedReports.length,
    motion: viewModel.upcomingVisits.length + (tracking.summary.sentReports || 0),
  };

  return (
    <section className="ops-dashboard command-center-page">
      <section className="panel command-hero-board">
        <div className="command-hero-grid">
          <div className="command-story">
            <span className="eyebrow">Today command center</span>
            <h2>{isAdmin ? 'Team execution, risk, and closures' : 'Run your day, close your work, and track follow-ups'}</h2>
            <p className="muted-text">
              {isAdmin
                ? 'See who planned, who is blocked, what is overdue, and where field effort is going.'
                : `Welcome ${currentUser?.name || 'team member'}. Start with today’s work, close what is done, and surface blockers early.`}
            </p>

            <div className="command-kicker-grid">
              <div className="command-kicker-card blue">
                <span>Today focus</span>
                <strong>{spotlight.focus}</strong>
                <p>{viewModel.fieldToday.length} field tasks and {viewModel.internalToday.length} internal tasks lined up.</p>
              </div>
              <div className="command-kicker-card red">
                <span>Risk desk</span>
                <strong>{spotlight.risk}</strong>
                <p>{viewModel.blockedPlans.length} blocked, {viewModel.pendingClosures.length} pending closure, {viewModel.failedReports.length} failed sends.</p>
              </div>
              <div className="command-kicker-card green">
                <span>Motion</span>
                <strong>{spotlight.motion}</strong>
                <p>{viewModel.upcomingVisits.length} upcoming visits and {tracking.summary.sentReports || 0} reports already sent.</p>
              </div>
            </div>
          </div>

          <div className="command-launchpad">
            <div className="panel-header compact">
              <h2>Launchpad</h2>
              <span className="panel-badge">Start here</span>
            </div>
            <div className="command-launch-actions">
              <button type="button" className="secondary-button" onClick={() => onNavigate?.('scheduler')}>
                Plan Today
              </button>
              <button type="button" className="ghost-button" onClick={() => onNavigate?.('report')}>
                Create Report
              </button>
              <button type="button" className="ghost-button" onClick={() => onNavigate?.('tracking')}>
                Open Tracking
              </button>
              {isAdmin && (
                <button type="button" className="ghost-button" onClick={() => onNavigate?.('dashboard')}>
                  Open Ops Dashboard
                </button>
              )}
            </div>
            <div className="command-launch-notes">
              <div>
                <span>Drafts</span>
                <strong>{draftCount}</strong>
              </div>
              <div>
                <span>Pending actions</span>
                <strong>{tracking.summary.pendingActionItems || 0}</strong>
              </div>
              <div>
                <span>Overdue follow-ups</span>
                <strong>{tracking.summary.overdueFollowUps || 0}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {message && <div className="status-text">{message}</div>}
      {loading && <div className="status-text">Loading command center...</div>}

      {!loading && (
        <>
          <div className="dashboard-stats command-stats">
            <Metric label="My Day" value={viewModel.todayPlans.length} tone="blue" />
            <Metric label="Pending Closures" value={viewModel.pendingClosures.length} tone="yellow" />
            <Metric label="Blocked" value={viewModel.blockedPlans.length} tone="red" />
            <Metric label="Internal Queue" value={viewModel.internalQueue.length} />
            <Metric label="Drafts" value={draftCount} />
            <Metric label="Pending Actions" value={tracking.summary.pendingActionItems || 0} tone="yellow" />
            <Metric label="Failed Reports" value={viewModel.failedReports.length} tone="red" />
            <Metric label="Upcoming Visits" value={viewModel.upcomingVisits.length} tone="green" />
          </div>

          <div className="command-grid">
            <section className="panel dashboard-panel command-panel command-panel-feature">
              <div className="panel-header compact">
                <h2>My Day</h2>
                <button type="button" className="table-action" onClick={() => onNavigate?.('scheduler')}>
                  Open workboard
                </button>
              </div>
              <CommandList
                items={viewModel.todayPlans}
                emptyText="Nothing is planned for today yet."
                render={(plan) => (
                  <>
                    <strong>{plan.schoolName}</strong>
                    <span>
                      {plan.workMode} | {plan.purposeOfVisit} | {plan.plannedStartTime || '--'} to {plan.plannedEndTime || '--'}
                    </span>
                  </>
                )}
              />
            </section>

            <section className="panel dashboard-panel command-panel command-panel-feature">
              <div className="panel-header compact">
                <h2>Needs Attention</h2>
                <span className="panel-badge">{viewModel.blockedPlans.length + viewModel.pendingClosures.length}</span>
              </div>
              <CommandList
                items={[...viewModel.blockedPlans.slice(0, 3), ...viewModel.pendingClosures.slice(0, 3)]}
                emptyText="No blockers or closure gaps right now."
                render={(plan) => (
                  <>
                    <strong>{plan.schoolName}</strong>
                    <span>
                      {plan.programManagerName} | {plan.dailyStatus || 'Planned'} | {plan.blockers || 'Closure still pending'}
                    </span>
                  </>
                )}
              />
            </section>

            <section className="panel dashboard-panel command-panel">
              <div className="panel-header compact">
                <h2>Upcoming Visits</h2>
                <button type="button" className="table-action" onClick={() => onNavigate?.('scheduler')}>
                  Plan more
                </button>
              </div>
              <CommandList
                items={viewModel.upcomingVisits}
                emptyText="No upcoming visits in the current window."
                render={(plan) => (
                  <>
                    <strong>{plan.schoolName}</strong>
                    <span>
                      {new Date(plan.plannedDate).toLocaleDateString('en-IN')} | {plan.programManagerName} | {plan.status}
                    </span>
                  </>
                )}
              />
            </section>

            <section className="panel dashboard-panel command-panel">
              <div className="panel-header compact">
                <h2>Internal Queue</h2>
                <button type="button" className="table-action" onClick={() => onNavigate?.('scheduler')}>
                  Add internal work
                </button>
              </div>
              <CommandList
                items={viewModel.internalQueue.slice(0, 5)}
                emptyText="No internal work items right now."
                render={(plan) => (
                  <>
                    <strong>{plan.schoolName}</strong>
                    <span>
                      {plan.workMode} | {plan.programManagerName} | {plan.dailyStatus || 'Planned'}
                    </span>
                  </>
                )}
              />
            </section>

            <section className="panel dashboard-panel command-panel command-panel-wide">
              <div className="panel-header compact">
                <h2>Recent Activity</h2>
                <button type="button" className="table-action" onClick={() => onNavigate?.('tracking')}>
                  Full timeline
                </button>
              </div>
              <CommandList
                items={viewModel.recentActivity}
                emptyText="No recent activity yet."
                render={(item) => (
                  <>
                    <strong>{item.title}</strong>
                    <span>{item.meta}</span>
                  </>
                )}
              />
            </section>

            <section className="panel dashboard-panel command-panel">
              <div className="panel-header compact">
                <h2>Quick Actions</h2>
              </div>
              <div className="quick-action-grid">
                <button type="button" className="ghost-button" onClick={() => onNavigate?.('scheduler')}>Plan field visit</button>
                <button type="button" className="ghost-button" onClick={() => onNavigate?.('scheduler')}>Add internal work</button>
                <button type="button" className="ghost-button" onClick={() => onNavigate?.('report')}>Close with report</button>
                <button type="button" className="ghost-button" onClick={() => onNavigate?.('drafts')}>Open drafts</button>
                <button type="button" className="ghost-button" onClick={() => onNavigate?.('tracking')}>Review follow-ups</button>
                {isAdmin && <button type="button" className="secondary-button" onClick={() => onNavigate?.('dashboard')}>Team risk board</button>}
              </div>
            </section>
          </div>

          {isAdmin && dashboard?.dailyOperations && (
            <section className="panel dashboard-panel command-panel command-panel-wide">
              <div className="panel-header compact">
                <h2>Team Health Snapshot</h2>
                <span className="panel-badge">Live ops</span>
              </div>
              <div className="planner-dashboard-stats">
                <Metric label="PMs Planned" value={dashboard.dailyOperations.totals?.pmPlannedToday} tone="blue" />
                <Metric label="No Plan" value={dashboard.dailyOperations.totals?.pmWithoutPlanToday} tone="yellow" />
                <Metric label="Day Closed" value={dashboard.dailyOperations.totals?.dayClosed} tone="green" />
                <Metric label="Blocked" value={dashboard.dailyOperations.totals?.blocked} tone="red" />
              </div>
            </section>
          )}
        </>
      )}
    </section>
  );
}

function Metric({ label, value = 0, tone = '' }) {
  return (
    <div className={`metric-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CommandList({ items = [], render, emptyText }) {
  if (!items.length) return <div className="empty-state">{emptyText}</div>;

  return (
    <div className="report-list">
      {items.map((item) => (
        <div key={item._id || item.id} className="report-row">
          <div>{render(item)}</div>
        </div>
      ))}
    </div>
  );
}

function readDrafts() {
  try {
    return JSON.parse(localStorage.getItem('schoolVisitDrafts') || '[]');
  } catch {
    localStorage.removeItem('schoolVisitDrafts');
    return [];
  }
}
