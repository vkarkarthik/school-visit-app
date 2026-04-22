import { useMemo, useState } from 'react';
import { api } from '../api/client';

export default function TrackingDashboard({ schoolMaster }) {
  const [filters, setFilters] = useState({
    state: '',
    schoolName: '',
    year: new Date().getFullYear()
  });
  const [summary, setSummary] = useState({ totalReports: 0, sentReports: 0, failedReports: 0 });
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);

  const filteredSchools = useMemo(() => {
    return schoolMaster.schools
      .filter((school) => school.state === filters.state)
      .sort((a, b) => a.schoolName.localeCompare(b.schoolName));
  }, [schoolMaster.schools, filters.state]);

  const handleLoad = async () => {
    if (!filters.schoolName) return;
    setLoading(true);
    try {
      const response = await api.get('/reports/tracking', { params: filters });
      setSummary(response.data.summary);
      setReports(response.data.reports);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>School Tracking</h2>

      <div className="form-grid">
        <label>
          State
          <select
            value={filters.state}
            onChange={(e) => setFilters({ ...filters, state: e.target.value, schoolName: '' })}
          >
            <option value="">Select state</option>
            {schoolMaster.states.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </label>

        <label>
          School Name
          <select
            value={filters.schoolName}
            onChange={(e) => setFilters({ ...filters, schoolName: e.target.value })}
          >
            <option value="">Select school</option>
            {filteredSchools.map((school) => (
              <option key={`${school.state}-${school.schoolName}`} value={school.schoolName}>
                {school.schoolName}
              </option>
            ))}
          </select>
        </label>

        <label>
          Year
          <input
            type="number"
            value={filters.year}
            onChange={(e) => setFilters({ ...filters, year: e.target.value })}
          />
        </label>

        <div className="align-end">
          <button onClick={handleLoad} disabled={loading}>
            {loading ? 'Loading...' : 'Load Tracking'}
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
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Visit Date</th>
              <th>Purpose</th>
              <th>Manager</th>
              <th>Status</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr key={report._id}>
                <td>{new Date(report.visitDate).toLocaleDateString('en-IN')}</td>
                <td>{report.purposeOfVisit}</td>
                <td>{report.programManagerName}</td>
                <td>{report.emailStatus}</td>
                <td>{report.schoolEmail}</td>
              </tr>
            ))}
            {!reports.length && (
              <tr>
                <td colSpan="5">No reports found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}