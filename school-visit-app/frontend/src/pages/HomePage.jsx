import { useEffect, useState } from 'react';
import { api } from '../api/client';
import SchoolVisitForm from '../components/SchoolVisitForm';
import TrackingDashboard from '../components/TrackingDashboard';

export default function HomePage() {
  const [schoolMaster, setSchoolMaster] = useState({ states: [], schools: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSchoolMaster() {
      try {
        const response = await api.get('/schools/master');
        setSchoolMaster({ states: response.data.states, schools: response.data.schools });
      } finally {
        setLoading(false);
      }
    }
    loadSchoolMaster();
  }, []);

  if (loading) return <div className="page-shell">Loading school data...</div>;

  return (
    <div className="page-shell">
      <div className="hero-card">
        <h1>School Visit Reporting Tool</h1>
        <p>Fill school visit details, upload session photos, generate PDF, send report, and track all reports.</p>
      </div>

      <div className="layout-grid">
        <SchoolVisitForm schoolMaster={schoolMaster} />
        <TrackingDashboard schoolMaster={schoolMaster} />
      </div>
    </div>
  );
}