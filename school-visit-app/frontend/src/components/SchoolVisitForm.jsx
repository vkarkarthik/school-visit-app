import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';

const PURPOSES = [
  'Teachers Copy',
  'Induction Training',
  'Teachers Training',
  'Robotics Training',
  'Admin Related Work'
];

export default function SchoolVisitForm({ schoolMaster, onReportCreated }) {
  const [form, setForm] = useState({
    state: '',
    schoolName: '',
    city: '',
    pointOfContact: '',
    designation: '',
    contactNo: '',
    schoolEmail: '',
    course: '',
    programManagerName: '',
    purposeOfVisit: '',
    visitDate: '',
    sessionSummary: '',
    actionItems: '',
    nextVisitDate: '',
    remarks: ''
  });
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const filteredSchools = useMemo(() => {
    return schoolMaster.schools
      .filter((school) => school.state === form.state)
      .sort((a, b) => a.schoolName.localeCompare(b.schoolName));
  }, [schoolMaster.schools, form.state]);

  useEffect(() => {
    const selected = schoolMaster.schools.find(
      (school) => school.state === form.state && school.schoolName === form.schoolName
    );

    if (!selected) return;

    setForm((prev) => ({
      ...prev,
      city: selected.city || '',
      pointOfContact: selected.pointOfContact || '',
      designation: selected.designation || '',
      contactNo: selected.contactNo || '',
      schoolEmail: selected.email || '',
      course: selected.course || ''
    }));
  }, [form.state, form.schoolName, schoolMaster.schools]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    if (name === 'state') {
      setForm((prev) => ({
        ...prev,
        state: value,
        schoolName: '',
        city: '',
        pointOfContact: '',
        designation: '',
        contactNo: '',
        schoolEmail: '',
        course: ''
      }));
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const data = new FormData();
      Object.entries(form).forEach(([key, value]) => data.append(key, value));
      photos.forEach((file) => data.append('photos', file));

      const response = await api.post('/reports', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setMessage(response.data.message);
      setForm({
        state: '',
        schoolName: '',
        city: '',
        pointOfContact: '',
        designation: '',
        contactNo: '',
        schoolEmail: '',
        course: '',
        programManagerName: '',
        purposeOfVisit: '',
        visitDate: '',
        sessionSummary: '',
        actionItems: '',
        nextVisitDate: '',
        remarks: ''
      });
      setPhotos([]);
      onReportCreated?.();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to create report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>New School Visit Report</h2>
      <form onSubmit={handleSubmit} className="form-grid">
        <label>
          State
          <select name="state" value={form.state} onChange={handleChange} required>
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
          <select name="schoolName" value={form.schoolName} onChange={handleChange} required>
            <option value="">Select school</option>
            {filteredSchools.map((school) => (
              <option key={`${school.state}-${school.schoolName}`} value={school.schoolName}>
                {school.schoolName}
              </option>
            ))}
          </select>
        </label>

        <label>
          City
          <input name="city" value={form.city} onChange={handleChange} readOnly />
        </label>

        <label>
          Point of Contact
          <input name="pointOfContact" value={form.pointOfContact} onChange={handleChange} readOnly />
        </label>

        <label>
          Designation
          <input name="designation" value={form.designation} onChange={handleChange} readOnly />
        </label>

        <label>
          Contact No
          <input name="contactNo" value={form.contactNo} onChange={handleChange} readOnly />
        </label>

        <label>
          School Email
          <input name="schoolEmail" type="email" value={form.schoolEmail} onChange={handleChange} required />
        </label>

        <label>
          Course
          <input name="course" value={form.course} onChange={handleChange} readOnly />
        </label>

        <label>
          Program Manager Name
          <input name="programManagerName" value={form.programManagerName} onChange={handleChange} required />
        </label>

        <label>
          Purpose of Visit
          <select name="purposeOfVisit" value={form.purposeOfVisit} onChange={handleChange} required>
            <option value="">Select purpose</option>
            {PURPOSES.map((purpose) => (
              <option key={purpose} value={purpose}>
                {purpose}
              </option>
            ))}
          </select>
        </label>

        <label>
          Visit Date
          <input name="visitDate" type="date" value={form.visitDate} onChange={handleChange} required />
        </label>

        <label className="full-width">
          Session Summary
          <textarea
            name="sessionSummary"
            value={form.sessionSummary}
            onChange={handleChange}
            rows="5"
            required
          />
        </label>

        <label className="full-width">
          Action Items / Follow-up
          <textarea name="actionItems" value={form.actionItems} onChange={handleChange} rows="4" />
        </label>

        <label>
          Next Visit Date
          <input name="nextVisitDate" type="date" value={form.nextVisitDate} onChange={handleChange} />
        </label>

        <label className="full-width">
          Remarks
          <textarea name="remarks" value={form.remarks} onChange={handleChange} rows="3" />
        </label>

        <label className="full-width">
          Session Photos
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setPhotos(Array.from(e.target.files || []))}
          />
        </label>

        {photos.length > 0 && (
          <div className="full-width help-text">
            {photos.map((file) => (
              <div key={file.name}>{file.name}</div>
            ))}
          </div>
        )}

        <div className="full-width">
          <button type="submit" disabled={loading}>
            {loading ? 'Submitting...' : 'Send Report'}
          </button>
        </div>

        {message && <div className="full-width status-text">{message}</div>}
      </form>
    </div>
  );
}