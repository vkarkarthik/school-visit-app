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

const VISIT_TEMPLATES = {
  'New School Visit / Demo': {
    sessionSummary:
      'Initial visit/demo discussion was conducted with the school team.\n\nDiscussion covered:\n- School requirement / problem statement: ...\n- Grades or departments discussed: ...\n- Product/program shown: ...\n- Demo focus areas: ...\n- Key questions raised by school: ...\n- Decision makers / participants present: ...\n- School interest level and observations: ...',
    actionItems:
      'Next steps:\n- SuperTeacher team to share: ...\n- School team to review/confirm: ...\n- Follow-up owner: ...\n- Expected closure / next meeting date: ...'
  },
  'Teachers Copy': {
    sessionSummary:
      'Teacher copies/materials were handed over and discussed with the school team.\n\nDetails covered:\n- Materials handed over: ...\n- Quantity / classes covered: ...\n- Recipient name and designation: ...\n- Usage instructions explained: ...\n- Pending material requirement, if any: ...\n- School confirmation / acknowledgement: ...',
    actionItems:
      'Follow-up points:\n- School to verify material count and allocation.\n- Program manager to close pending material/support requirement: ...\n- Next confirmation date: ...'
  },
  'Induction Training': {
    sessionSummary:
      'Induction/orientation session was conducted for the school team.\n\nOrientation covered:\n- Program/module introduced: ...\n- Platform/tool covered, if any (LMS/LMMS/app/portal): ...\n- Grades/classes included: ...\n- Participants attended: ...\n- Implementation workflow explained: ...\n- Login/access/process explained: ...\n- Key questions clarified: ...\n- Readiness/concerns observed: ...',
    actionItems:
      'Next steps:\n- School team to complete internal alignment/access setup: ...\n- SuperTeacher team to provide pending support/materials: ...\n- Follow-up required on: ...\n- Target date for next check-in: ...'
  },
  'Teachers Training': {
    sessionSummary:
      'Teacher training session was conducted for the school team.\n\nTraining details:\n- Topic/module covered: ...\n- Platform/tool covered (LMS/LMMS/app/resources): ...\n- Grades/subjects included: ...\n- Number of teachers attended: ...\n- Activities/demo conducted: ...\n- Classroom usage process explained: ...\n- Teacher practice or hands-on activity completed: ...\n- Questions/challenges raised: ...\n- Overall participation/response: ...',
    actionItems:
      'Follow-up points:\n- Teachers to practice/review: ...\n- School coordinator to ensure: ...\n- Program manager to share/support: ...\n- Additional training required: Yes/No - details: ...\n- Next review date: ...'
  },
  'Robotics Training': {
    sessionSummary:
      'Robotics training/session was conducted with guided practical engagement.\n\nSession details:\n- Concept/topic covered: ...\n- Kit/components used: ...\n- Grades/students/teachers included: ...\n- Activity/project completed: ...\n- Hands-on participation level: ...\n- Technical issues or material gaps: ...\n- Learning outcomes observed: ...',
    actionItems:
      'Next steps:\n- School to continue practice/activity: ...\n- SuperTeacher team to provide support/materials: ...\n- Next robotics topic/session planned: ...\n- Follow-up date: ...'
  },
  'Admin Related Work': {
    sessionSummary:
      'Administrative coordination was completed/reviewed during the school visit.\n\nItems discussed/completed:\n- Documentation/process reviewed: ...\n- Pending approvals/forms/payments/materials: ...\n- People met: ...\n- Current status: ...\n- Blockers/dependencies: ...\n- School commitment/confirmation: ...',
    actionItems:
      'Closure plan:\n- Pending item: ... | Owner: ... | Due date: ...\n- Pending item: ... | Owner: ... | Due date: ...\n- Program manager follow-up date: ...'
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
      const template = value === 'true' ? VISIT_TEMPLATES['New School Visit / Demo'] : null;

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
        sessionSummary: value === 'true' && !prev.sessionSummary ? template.sessionSummary : prev.sessionSummary,
        actionItems: value === 'true' && !prev.actionItems ? template.actionItems : prev.actionItems
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
      const template = VISIT_TEMPLATES[value];

      setForm((prev) => ({
        ...prev,
        purposeOfVisit: value,
        sessionSummary: prev.sessionSummary || template?.sessionSummary || '',
        actionItems: prev.actionItems || template?.actionItems || ''
      }));
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const applyVisitTemplate = () => {
    const template = VISIT_TEMPLATES[form.purposeOfVisit];
    if (!template) return;

    setForm((prev) => ({
      ...prev,
      sessionSummary: template.sessionSummary,
      actionItems: template.actionItems
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
    if (!form.sessionSummary.trim()) nextErrors.sessionSummary = 'Session summary is required.';

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
      Object.entries(form).forEach(([key, value]) => data.append(key, value));
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
      const response = await api.post('/reports/preview-pdf', form, { responseType: 'blob' });
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

            <div className="full-width template-toolbar">
              <span>Standard text is editable after selection.</span>
              <button type="button" onClick={applyVisitTemplate} disabled={!form.purposeOfVisit}>
                Use standard format
              </button>
            </div>

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
            </label>

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
              <p>{form.sessionSummary}</p>
              <h3>Action Items</h3>
              <p>{form.actionItems || 'No action items added.'}</p>
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
