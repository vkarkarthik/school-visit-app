import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';

const PURPOSES = [
  'New School Visit / Demo',
  'Teachers Copy',
  'Induction Training',
  'Teachers Training',
  'Robotics Training',
  'Admin Related Work'
];

const PURPOSE_GUIDES = {
  'New School Visit / Demo': {
    fields: [
      ['requirement', 'Requirement discussed', 'STEM program for middle school, coding lab setup, etc.'],
      ['demoShown', 'Demo / product shown', 'OpenCode, Robotics, LMS, LMMS, etc.'],
      ['grades', 'Grades / classes', 'Grade 3 to 8'],
      ['peopleMet', 'Decision makers met', 'Principal, academic coordinator, management team'],
      ['interestLevel', 'Interest level', 'Interested / evaluating / needs follow-up'],
      ['questions', 'Questions or objections', 'Pricing, timetable, teacher readiness, lab setup'],
      ['nextStep', 'Next step', 'Share proposal, schedule second demo, collect requirements']
    ]
  },
  'Teachers Copy': {
    fields: [
      ['materials', 'Materials handed over', 'Teacher copy, lesson plan book, kits, worksheets'],
      ['quantity', 'Quantity / count', '12 teacher copies'],
      ['grades', 'Classes / grades covered', 'Grade 1 to 5'],
      ['receivedBy', 'Received by', 'Name and designation'],
      ['usage', 'Usage explained', 'How teachers should use the material in class'],
      ['pending', 'Pending material, if any', 'None / extra copies / missing kits'],
      ['nextStep', 'Next step', 'Confirm allocation, send pending materials, collect acknowledgement']
    ]
  },
  'Induction Training': {
    fields: [
      ['program', 'Program / module introduced', 'OpenCode 3.0, Robotics, STEM, LMS onboarding'],
      ['platform', 'Platform covered', 'LMS, LMMS, app, portal, dashboard'],
      ['grades', 'Grades / classes', 'Grade 1 to 8'],
      ['participants', 'Participants', 'Principal, coordinator, teachers, admin team'],
      ['workflow', 'Workflow explained', 'Login, class setup, lesson flow, reporting, support process'],
      ['questions', 'Questions clarified', 'Access, timetable, usage expectations, support'],
      ['readiness', 'Readiness / status', 'Ready to start / access pending / internal alignment needed'],
      ['nextStep', 'Next step', 'Complete login setup, schedule teacher training, share resources']
    ]
  },
  'Teachers Training': {
    fields: [
      ['topic', 'Topic covered', 'LMS usage, lesson planning, classroom activities'],
      ['grades', 'Grades / subjects', 'Grade 3 to 5, Computer Science'],
      ['attendees', 'Teachers attended', '12 teachers'],
      ['handsOn', 'Hands-on activity', 'Lesson creation, activity planning, dashboard practice'],
      ['questions', 'Questions / issues raised', 'Login issue, lesson tracking, classroom flow'],
      ['outcome', 'Training outcome', 'Teachers understood workflow and are ready to use'],
      ['nextStep', 'Next step', 'Follow-up support after one week, collect usage feedback']
    ]
  },
  'Robotics Training': {
    fields: [
      ['concept', 'Concept / topic', 'Sensors, motors, circuits, robot movement'],
      ['kit', 'Kit / components used', 'Robotics kit, motor, sensor, controller'],
      ['grades', 'Grades / participants', 'Grade 6 to 8 students / teachers'],
      ['activity', 'Activity completed', 'Built line follower, tested motor movement'],
      ['participation', 'Participation level', 'Active participation, group activity completed'],
      ['issues', 'Issues / material gaps', 'None / missing component / charging issue'],
      ['outcome', 'Learning outcome', 'Students understood basic robot movement'],
      ['nextStep', 'Next step', 'Next robotics session, replacement material, practice activity']
    ]
  },
  'Admin Related Work': {
    fields: [
      ['workDone', 'Work completed / reviewed', 'Documentation, payment follow-up, approval, material check'],
      ['peopleMet', 'People met', 'Admin officer, coordinator, accounts team'],
      ['status', 'Current status', 'Completed / pending with school / pending with SuperTeacher'],
      ['pending', 'Pending item', 'PO, payment, approval, material receipt'],
      ['blocker', 'Blocker / dependency', 'Management approval, document pending, payment timeline'],
      ['owner', 'Owner', 'School admin / program manager / accounts team'],
      ['nextStep', 'Next step', 'Close pending item, share document, follow up by date']
    ]
  }
};

const emptyForm = (currentUser = {}) => ({
  isNewSchool: 'false',
  state: '',
  schoolName: '',
  city: '',
  pointOfContact: '',
  designation: '',
  contactNo: '',
  schoolEmail: '',
  course: '',
  programManagerName: currentUser?.name || '',
  programManagerEmail: currentUser?.email || '',
  ccEmails: '',
  purposeOfVisit: '',
  visitDate: '',
  sessionSummary: '',
  actionItems: '',
  guidedDetails: {},
  manualReportText: 'false',
  nextVisitDate: '',
  remarks: ''
});

export default function SchoolVisitForm({ schoolMaster, currentUser, draftToLoad, onDraftLoaded, onReportCreated }) {
  const [form, setForm] = useState(() => {
    try {
      const saved = localStorage.getItem('schoolVisitDraft');
      const parsed = saved ? JSON.parse(saved) : null;
      if (!parsed) return emptyForm(currentUser);

      return {
        ...emptyForm(currentUser),
        ...parsed,
        programManagerName: parsed.programManagerName || currentUser?.name || '',
        programManagerEmail: parsed.programManagerEmail || currentUser?.email || ''
      };
    } catch {
      return emptyForm(currentUser);
    }
  });
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [successReport, setSuccessReport] = useState(null);
  const [pdfPreviewing, setPdfPreviewing] = useState(false);
  const schools = Array.isArray(schoolMaster?.schools) ? schoolMaster.schools : [];
  const states = Array.isArray(schoolMaster?.states) ? schoolMaster.states : [];
  const hasSchoolMaster = states.length > 0 && schools.length > 0;
  const isNewSchool = form.isNewSchool === 'true';
  const purposeGuide = PURPOSE_GUIDES[form.purposeOfVisit];
  const generatedCopy = useMemo(
    () => generateVisitCopy(form.purposeOfVisit, form.guidedDetails || {}, form),
    [form.purposeOfVisit, form.guidedDetails, form.schoolName, form.course, form.nextVisitDate]
  );
  const useManualReportText = form.manualReportText === 'true';
  const effectiveSessionSummary = useManualReportText ? form.sessionSummary : generatedCopy.sessionSummary;
  const effectiveActionItems = useManualReportText ? form.actionItems : generatedCopy.actionItems;

  useEffect(() => {
    localStorage.setItem('schoolVisitDraft', JSON.stringify(form));
  }, [form]);

  useEffect(() => {
    if (!draftToLoad) return;
    setForm({ ...emptyForm(currentUser), ...draftToLoad });
    setMessage('Draft loaded.');
    onDraftLoaded?.();
  }, [draftToLoad, currentUser, onDraftLoaded]);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      programManagerName: prev.programManagerName || currentUser?.name || '',
      programManagerEmail: prev.programManagerEmail || currentUser?.email || ''
    }));
  }, [currentUser?.name, currentUser?.email]);

  const filteredSchools = useMemo(() => {
    return schools
      .filter((school) => school.state === form.state)
      .sort((a, b) => a.schoolName.localeCompare(b.schoolName));
  }, [schools, form.state]);

  useEffect(() => {
    if (isNewSchool) return;

    const selected = schools.find(
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
  }, [form.state, form.schoolName, schools, isNewSchool]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    if (name === 'isNewSchool') {
      setForm((prev) => ({
        ...prev,
        isNewSchool: value,
        state: '',
        schoolName: '',
        city: '',
        pointOfContact: '',
        designation: '',
        contactNo: '',
        schoolEmail: '',
        course: value === 'true' ? prev.course : '',
        purposeOfVisit: value === 'true' ? 'New School Visit / Demo' : prev.purposeOfVisit,
        guidedDetails: value === 'true' ? {} : prev.guidedDetails || {},
        sessionSummary: value === 'true' ? '' : prev.sessionSummary,
        actionItems: value === 'true' ? '' : prev.actionItems,
        manualReportText: 'false'
      }));
      return;
    }

    if (name === 'state') {
      if (isNewSchool) {
        setForm((prev) => ({ ...prev, state: value }));
        return;
      }

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

    if (name === 'purposeOfVisit') {
      setForm((prev) => ({
        ...prev,
        purposeOfVisit: value,
        guidedDetails: {},
        sessionSummary: '',
        actionItems: '',
        manualReportText: 'false'
      }));
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleGuidedDetailChange = (key, value) => {
    setForm((prev) => ({
      ...prev,
      guidedDetails: {
        ...(prev.guidedDetails || {}),
        [key]: value
      }
    }));
  };

  const validateForm = () => {
    const nextErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!form.state) nextErrors.state = 'State is required.';
    if (!form.schoolName) nextErrors.schoolName = 'School name is required.';
    if (!isNewSchool && hasSchoolMaster && form.state && form.schoolName) {
      const selectedExists = schools.some(
        (school) => school.state === form.state && school.schoolName === form.schoolName
      );
      if (!selectedExists) nextErrors.schoolName = 'Select a school from the master list or use School not listed.';
    }
    if (isNewSchool && !form.city) nextErrors.city = 'City is required for new school.';
    if (isNewSchool && !form.pointOfContact) nextErrors.pointOfContact = 'Point of contact is required for new school.';
    if (isNewSchool && !form.contactNo) nextErrors.contactNo = 'Contact number is required for new school.';
    if (!form.schoolEmail || !emailRegex.test(form.schoolEmail)) {
      nextErrors.schoolEmail = 'Valid school email is required.';
    }
    if (!form.programManagerName) nextErrors.programManagerName = 'Sender name is required.';
    if (!form.programManagerEmail || !emailRegex.test(form.programManagerEmail)) {
      nextErrors.programManagerEmail = 'Valid sender email is required.';
    }
    if (!form.purposeOfVisit) nextErrors.purposeOfVisit = 'Purpose is required.';
    if (!form.visitDate) nextErrors.visitDate = 'Visit date is required.';

    if (!useManualReportText && purposeGuide) {
      purposeGuide.fields.forEach(([key, label], index) => {
        if (index < 5 && !String(form.guidedDetails?.[key] || '').trim()) {
          nextErrors[`guided_${key}`] = `${label} is required.`;
        }
      });
    }

    if (useManualReportText && !form.sessionSummary.trim()) nextErrors.sessionSummary = 'Session summary is required.';
    if (useManualReportText && form.sessionSummary.includes('...')) {
      nextErrors.sessionSummary = 'Replace all ... placeholders with actual visit details.';
    }
    if (useManualReportText && form.actionItems.includes('...')) {
      nextErrors.actionItems = 'Replace all ... placeholders with actual follow-up details.';
    }

    const invalidCc = form.ccEmails
      .split(',')
      .map((email) => email.trim())
      .filter(Boolean)
      .find((email) => !emailRegex.test(email));

    if (invalidCc) nextErrors.ccEmails = `Invalid CC email: ${invalidCc}`;

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setMessage('');
    if (!validateForm()) {
      setMessage('Please fix the highlighted fields before preview.');
      return;
    }
    setPreviewOpen(true);
  };

  const sendReport = async () => {
    setLoading(true);
    setMessage('');

    try {
      const data = new FormData();
      Object.entries({
        ...form,
        sessionSummary: effectiveSessionSummary,
        actionItems: effectiveActionItems
      }).forEach(([key, value]) => {
        if (key === 'guidedDetails' || key === 'manualReportText') return;
        data.append(key, value);
      });
      const compressedPhotos = await Promise.all(photos.map(compressImage));
      compressedPhotos.forEach((file) => data.append('photos', file));

      const response = await api.post('/reports', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setMessage(response.data.message);
      setSuccessReport({
        report: response.data.report,
        message: response.data.message,
        duplicateReport: response.data.duplicateReport
      });
      setForm(emptyForm(currentUser));
      localStorage.removeItem('schoolVisitDraft');
      setPhotos([]);
      setPreviewOpen(false);
      onReportCreated?.();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to create report');
    } finally {
      setLoading(false);
    }
  };

  const renderError = (field) => errors[field] && <span className="field-error">{errors[field]}</span>;

  const clearDraft = () => {
    setForm(emptyForm(currentUser));
    setPhotos([]);
    setMessage('');
    setErrors({});
    localStorage.removeItem('schoolVisitDraft');
  };

  const saveNamedDraft = () => {
    const drafts = readDrafts();
    const id = `${Date.now()}`;
    localStorage.setItem(
      'schoolVisitDrafts',
      JSON.stringify([
        { id, savedAt: new Date().toISOString(), form },
        ...drafts.filter((draft) => draft.form.schoolName !== form.schoolName || draft.form.visitDate !== form.visitDate)
      ].slice(0, 15))
    );
    setMessage('Draft saved to My Drafts.');
  };

  const openPdfPreview = async () => {
    if (!validateForm()) {
      setMessage('Please fix the highlighted fields before PDF preview.');
      return;
    }

    setPdfPreviewing(true);
    try {
      const response = await api.post(
        '/reports/preview-pdf',
        { ...form, sessionSummary: effectiveSessionSummary, actionItems: effectiveActionItems },
        { responseType: 'blob' }
      );
      const url = URL.createObjectURL(response.data);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (error) {
      setMessage(error.response?.data?.message || 'PDF preview failed.');
    } finally {
      setPdfPreviewing(false);
    }
  };

  const emailWarning = getEmailWarning(form.schoolEmail);

  return (
    <section className="panel report-panel">
      <div className="panel-header">
        <div>
          <span className="eyebrow">Report creation</span>
          <h2>New school visit report</h2>
        </div>
        <span className="panel-badge">School email</span>
      </div>

      {successReport && (
        <div className="success-panel">
          <div>
            <span className="eyebrow">Completed</span>
            <h3>{successReport.message}</h3>
            {successReport.duplicateReport && (
              <p>Possible duplicate found for the same school, visit date, and purpose. Please review tracking.</p>
            )}
            {successReport.report?.emailLastError && (
              <p>Email error: {successReport.report.emailLastError}</p>
            )}
          </div>
          <div className="success-actions">
            {successReport.report?.pdfUrl && (
              <a href={successReport.report.pdfUrl} target="_blank" rel="noreferrer" className="button-link">
                Open PDF
              </a>
            )}
            <button type="button" className="ghost-button" onClick={() => setSuccessReport(null)}>
              Send Another
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="report-flow">
        <section className="flow-section school-select-section">
          <div className="flow-heading">
            <span>1</span>
            <div>
              <h3>Select school</h3>
              <p>Use master data for existing schools, or switch to new school mode for sales visits.</p>
            </div>
          </div>
          <div className="mode-toggle full-width">
            <label className={!isNewSchool ? 'active' : ''}>
              <input
                type="radio"
                name="isNewSchool"
                value="false"
                checked={!isNewSchool}
                onChange={handleChange}
              />
              Existing school
            </label>
            <label className={isNewSchool ? 'active' : ''}>
              <input
                type="radio"
                name="isNewSchool"
                value="true"
                checked={isNewSchool}
                onChange={handleChange}
              />
              School not listed
            </label>
          </div>
          <div className="form-grid">
            <label>
              State
              {hasSchoolMaster && !isNewSchool ? (
                <select name="state" value={form.state} onChange={handleChange} required>
                  <option value="">Select state</option>
                  {states.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              ) : (
                <input name="state" value={form.state} onChange={handleChange} required />
              )}
              {renderError('state')}
            </label>

            <label>
              School Name
              {hasSchoolMaster && !isNewSchool ? (
                <>
                  <input
                    name="schoolName"
                    value={form.schoolName}
                    onChange={handleChange}
                    list="school-options"
                    placeholder="Search and select school"
                    required
                  />
                  <datalist id="school-options">
                  {filteredSchools.map((school) => (
                    <option key={`${school.state}-${school.schoolName}`} value={school.schoolName} />
                  ))}
                  </datalist>
                </>
              ) : (
                <input name="schoolName" value={form.schoolName} onChange={handleChange} required />
              )}
              {renderError('schoolName')}
            </label>
          </div>
        </section>

        <section className="school-profile">
          <div className="school-profile-header">
            <span>School profile</span>
            <strong>{form.schoolName || (isNewSchool ? 'New school details' : 'No school selected')}</strong>
          </div>
          {isNewSchool && (
            <div className="help-text prospect-note">
              This report will be saved as a new/prospect school visit. Add it to the master sheet later once confirmed.
            </div>
          )}
          <div className="profile-grid">
            <label>
              City
              <input name="city" value={form.city} onChange={handleChange} readOnly={hasSchoolMaster && !isNewSchool} required={isNewSchool} />
              {renderError('city')}
            </label>

            <label>
              Point of Contact
              <input name="pointOfContact" value={form.pointOfContact} onChange={handleChange} readOnly={hasSchoolMaster && !isNewSchool} required={isNewSchool} />
              {renderError('pointOfContact')}
            </label>

            <label>
              Designation
              <input name="designation" value={form.designation} onChange={handleChange} readOnly={hasSchoolMaster && !isNewSchool} />
            </label>

            <label>
              Contact No
              <input name="contactNo" value={form.contactNo} onChange={handleChange} readOnly={hasSchoolMaster && !isNewSchool} required={isNewSchool} />
              {renderError('contactNo')}
            </label>

            <label>
              School Email
              <input name="schoolEmail" type="email" value={form.schoolEmail} onChange={handleChange} required />
              {renderError('schoolEmail')}
              {emailWarning && !errors.schoolEmail && <span className="field-warning">{emailWarning}</span>}
            </label>

            <label>
              Course
              <input
                name="course"
                value={form.course}
                onChange={handleChange}
                readOnly={hasSchoolMaster && !isNewSchool}
                placeholder={isNewSchool ? 'Interested course/program' : ''}
              />
            </label>
          </div>
        </section>

        <section className="flow-section">
          <div className="flow-heading">
            <span>2</span>
            <div>
              <h3>Visit details</h3>
              <p>Add the visit purpose, summary, action items, and supporting evidence.</p>
            </div>
          </div>
          <div className="form-grid">
            <label>
              Program Manager Name
              <input name="programManagerName" value={form.programManagerName} onChange={handleChange} required />
              {renderError('programManagerName')}
            </label>

            <label>
              Program Manager Email
              <input
                name="programManagerEmail"
                type="email"
                value={form.programManagerEmail}
                onChange={handleChange}
                required
              />
              {renderError('programManagerEmail')}
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
              {renderError('purposeOfVisit')}
            </label>

            <label>
              Visit Date
              <input name="visitDate" type="date" value={form.visitDate} onChange={handleChange} required />
              {renderError('visitDate')}
            </label>

            {purposeGuide && (
              <div className="full-width guided-builder">
                <div className="template-toolbar">
                  <span>Fill quick points. The app will create the detailed report automatically.</span>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        manualReportText: prev.manualReportText === 'true' ? 'false' : 'true',
                        sessionSummary: prev.sessionSummary || generatedCopy.sessionSummary,
                        actionItems: prev.actionItems || generatedCopy.actionItems
                      }))
                    }
                  >
                    {useManualReportText ? 'Use auto report' : 'Edit generated text'}
                  </button>
                </div>

                {!useManualReportText && (
                  <>
                    <div className="form-grid">
                      {purposeGuide.fields.map(([key, label, placeholder], index) => (
                        <label key={key} className={index > 4 ? '' : ''}>
                          {label}
                          <input
                            value={form.guidedDetails?.[key] || ''}
                            onChange={(event) => handleGuidedDetailChange(key, event.target.value)}
                            placeholder={placeholder}
                          />
                          {renderError(`guided_${key}`)}
                        </label>
                      ))}
                    </div>

                    <div className="preview-copy full-width">
                      <h3>Auto-generated session summary</h3>
                      <p>{generatedCopy.sessionSummary || 'Fill the quick points above to generate the session summary.'}</p>
                      <h3>Auto-generated follow-up</h3>
                      <p>{generatedCopy.actionItems || 'Fill the quick points above to generate follow-up points.'}</p>
                    </div>
                  </>
                )}

                {useManualReportText && (
                  <div className="form-grid">
                    <label className="full-width">
                      Session Summary
                      <textarea
                        name="sessionSummary"
                        value={form.sessionSummary}
                        onChange={handleChange}
                        placeholder="Briefly capture what was completed, who attended, and key discussion points."
                        rows="5"
                        required
                      />
                      {renderError('sessionSummary')}
                    </label>

                    <label className="full-width">
                      Action Items / Follow-up
                      <textarea
                        name="actionItems"
                        value={form.actionItems}
                        onChange={handleChange}
                        placeholder="List next steps, owner, and expected follow-up."
                        rows="4"
                      />
                      {renderError('actionItems')}
                    </label>
                  </div>
                )}
              </div>
            )}

            <label>
              Next Visit Date
              <input name="nextVisitDate" type="date" value={form.nextVisitDate} onChange={handleChange} />
            </label>

            <label className="full-width">
              Remarks
              <textarea name="remarks" value={form.remarks} onChange={handleChange} rows="3" />
            </label>
          </div>
        </section>

        <section className="flow-section send-section">
          <div className="flow-heading">
            <span>3</span>
            <div>
              <h3>Recipients and evidence</h3>
              <p>Add extra people only when needed. Common CC can be enabled later from backend settings.</p>
            </div>
          </div>
          <div className="form-grid">
            <label className="full-width">
              Additional CC Emails
              <input
                name="ccEmails"
                value={form.ccEmails}
                onChange={handleChange}
                placeholder="Optional: separate multiple emails with commas"
              />
              {renderError('ccEmails')}
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
          </div>
        </section>

        <div className="submit-bar">
          <div>
            <span>Email report</span>
            <strong>Draft autosaves locally. PDF will be generated and sent to the school.</strong>
          </div>
          <button type="button" className="ghost-button" onClick={clearDraft} disabled={loading}>
            Clear Draft
          </button>
          <button type="button" className="ghost-button" onClick={saveNamedDraft} disabled={loading}>
            Save Draft
          </button>
          <button type="button" className="ghost-button" onClick={openPdfPreview} disabled={loading || pdfPreviewing}>
            {pdfPreviewing ? 'Preparing...' : 'PDF Preview'}
          </button>
          <button type="submit" disabled={loading} className="primary-button">
            {loading ? 'Submitting...' : 'Preview Report'}
          </button>
        </div>

        {message && <div className="status-text">{message}</div>}
      </form>

      {previewOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="preview-modal">
            <div className="panel-header">
              <div>
                <span className="eyebrow">Final check</span>
                <h2>Preview before sending</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setPreviewOpen(false)}>
                Close
              </button>
            </div>
            <div className="preview-grid">
              <div>
                <span>To</span>
                <strong>{form.schoolEmail}</strong>
              </div>
              <div>
                <span>Reply-to</span>
                <strong>{form.programManagerEmail}</strong>
              </div>
              <div>
                <span>School</span>
                <strong>{form.schoolName} {isNewSchool ? '(New / Prospect)' : ''}</strong>
              </div>
              <div>
                <span>Purpose</span>
                <strong>{form.purposeOfVisit}</strong>
              </div>
              <div>
                <span>Date</span>
                <strong>{form.visitDate}</strong>
              </div>
              <div>
                <span>CC</span>
                <strong>{form.ccEmails || 'No additional CC'}</strong>
              </div>
            </div>
            <div className="preview-copy">
              <h3>Session Summary</h3>
              <p>{effectiveSessionSummary}</p>
              <h3>Action Items</h3>
              <p>{effectiveActionItems || 'No action items added.'}</p>
            </div>
            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={() => setPreviewOpen(false)}>
                Edit
              </button>
              <button type="button" className="primary-button" onClick={sendReport} disabled={loading}>
                {loading ? 'Sending...' : 'Confirm and Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
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

function getEmailWarning(email) {
  const value = String(email || '').toLowerCase();
  if (!value) return '';
  if (/@(gmail|yahoo|outlook|hotmail)\./.test(value)) {
    return 'Personal email detected. Confirm this is the official school recipient.';
  }
  if (!value.includes('.')) return 'Email domain looks incomplete.';
  return '';
}

function generateVisitCopy(purpose, details = {}, form = {}) {
  const value = (key, fallback = '') => String(details[key] || fallback || '').trim();
  const school = form.schoolName || 'the school';
  const course = form.course ? ` for ${form.course}` : '';
  const nextStep = value('nextStep', 'Follow-up will be planned based on school requirements.');

  if (purpose === 'New School Visit / Demo') {
    return {
      sessionSummary: `A new school visit/demo discussion was conducted with ${school}. The discussion focused on ${value('requirement', 'the school requirement')}${course}. The team presented ${value('demoShown', 'the relevant SuperTeacher solution')} for ${value('grades', 'the applicable grades/classes')}. The interaction included ${value('peopleMet', 'the relevant school stakeholders')}, and the school's current interest/status was recorded as ${value('interestLevel', 'to be followed up')}. Key questions or concerns discussed were: ${value('questions', 'none specifically recorded')}.`,
      actionItems: `Next step: ${nextStep}. Program/sales team will continue follow-up with the school and share any required proposal, demo details, or supporting material.`
    };
  }

  if (purpose === 'Teachers Copy') {
    return {
      sessionSummary: `Teacher copy/material handover was completed at ${school}. The materials handed over were ${value('materials', 'teacher copies/materials')}, covering ${value('grades', 'the applicable classes/grades')}. Quantity/count recorded: ${value('quantity', 'as per requirement')}. The materials were received by ${value('receivedBy', 'the school representative')}. Usage expectations were explained as: ${value('usage', 'materials to be used for classroom implementation')}. Pending material or coordination requirement: ${value('pending', 'none recorded')}.`,
      actionItems: `Next step: ${nextStep}. The school team may verify allocation of the materials internally, and the program manager will close any pending material or support requirement.`
    };
  }

  if (purpose === 'Induction Training') {
    return {
      sessionSummary: `An induction/orientation session was conducted at ${school}. The session introduced ${value('program', 'the selected program/module')}${course} and covered ${value('platform', 'the relevant platform/tools')} for ${value('grades', 'the applicable grades/classes')}. Participants included ${value('participants', 'the school team')}. The workflow explained during the session included ${value('workflow', 'login, usage process, classroom implementation, reporting, and support flow')}. Questions clarified during the session included: ${value('questions', 'none specifically recorded')}. Current readiness/status: ${value('readiness', 'to be followed up')}.`,
      actionItems: `Next step: ${nextStep}. The school team will align internally on access and usage readiness, while the program manager will support pending setup, resources, or training requirements.`
    };
  }

  if (purpose === 'Teachers Training') {
    return {
      sessionSummary: `A teacher training session was conducted at ${school}. The training covered ${value('topic', 'the planned topic/module')} for ${value('grades', 'the applicable grades/subjects')}. ${value('attendees', 'Teachers')} participated in the session. The hands-on component included ${value('handsOn', 'guided practice and classroom usage demonstration')}. Questions or issues raised during the session were: ${value('questions', 'none specifically recorded')}. Training outcome: ${value('outcome', 'teachers understood the workflow and are ready for classroom usage')}.`,
      actionItems: `Next step: ${nextStep}. Teachers may continue practice/review of the covered workflow, and the program manager will collect any follow-up questions or support needs.`
    };
  }

  if (purpose === 'Robotics Training') {
    return {
      sessionSummary: `A robotics training/session was conducted at ${school}. The session covered ${value('concept', 'the planned robotics concept')} using ${value('kit', 'the relevant robotics kit/components')} with ${value('grades', 'the applicable participants')}. The activity completed was ${value('activity', 'guided robotics practice')}. Participation level observed: ${value('participation', 'active participation')}. Issues or material gaps noted: ${value('issues', 'none recorded')}. Learning outcome: ${value('outcome', 'participants understood the concept covered during the session')}.`,
      actionItems: `Next step: ${nextStep}. The school team may continue practice on the activity, and SuperTeacher will support any kit, material, or next-session requirement.`
    };
  }

  if (purpose === 'Admin Related Work') {
    return {
      sessionSummary: `Administrative coordination was completed/reviewed at ${school}. Work completed or reviewed: ${value('workDone', 'administrative coordination')}. People met: ${value('peopleMet', 'the concerned school team')}. Current status: ${value('status', 'to be followed up')}. Pending item, if any: ${value('pending', 'none recorded')}. Blocker/dependency: ${value('blocker', 'none recorded')}. Owner for closure: ${value('owner', 'program manager/school team as applicable')}.`,
      actionItems: `Next step: ${nextStep}. The owner will work towards closure of the pending item and the program manager will track completion.`
    };
  }

  return {
    sessionSummary: '',
    actionItems: ''
  };
}

async function compressImage(file) {
  if (!file.type.startsWith('image/') || file.size < 900_000) return file;

  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });

  const maxWidth = 1600;
  const scale = Math.min(1, maxWidth / image.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
  URL.revokeObjectURL(image.src);

  if (!blob) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
}
