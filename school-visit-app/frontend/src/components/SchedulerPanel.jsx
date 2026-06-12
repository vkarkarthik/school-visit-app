import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";

const PLAN_STATUSES = ["Draft", "Confirmed", "Completed", "Cancelled"];

const emptyForm = (currentUser = {}) => ({
  state: "",
  schoolName: "",
  city: "",
  pointOfContact: "",
  contactNo: "",
  schoolEmail: "",
  course: "",
  purposeOfVisit: "",
  workPlanned: "",
  plannedDate: "",
  plannedStartTime: "",
  plannedEndTime: "",
  status: "Draft",
  planningNotes: "",
  programManagerName: currentUser?.name || "",
  programManagerEmail: currentUser?.email || "",
});

export default function SchedulerPanel({ schoolMaster, currentUser, isAdmin, onConvertToReport }) {
  const [form, setForm] = useState(() => emptyForm(currentUser));
  const [plans, setPlans] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [filters, setFilters] = useState({
    status: "",
    dateFrom: "",
    dateTo: "",
    programManagerEmail: "",
  });

  const schools = Array.isArray(schoolMaster?.schools) ? schoolMaster.schools : [];
  const states = Array.isArray(schoolMaster?.states) ? schoolMaster.states : [];

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      programManagerName: currentUser?.name || "",
      programManagerEmail: currentUser?.email || "",
    }));
  }, [currentUser?.name, currentUser?.email]);

  useEffect(() => {
    loadPlans();
  }, [filters.status, filters.dateFrom, filters.dateTo, filters.programManagerEmail]);

  const filteredSchools = useMemo(
    () =>
      schools
        .filter((school) => school.state === form.state)
        .sort((a, b) => a.schoolName.localeCompare(b.schoolName)),
    [schools, form.state]
  );

  useEffect(() => {
    const selected = schools.find(
      (school) => school.state === form.state && school.schoolName === form.schoolName
    );

    if (!selected) return;

    setForm((prev) => ({
      ...prev,
      city: selected.city || "",
      pointOfContact: selected.pointOfContact || "",
      contactNo: selected.contactNo || "",
      schoolEmail: selected.email || "",
      course: selected.course || "",
    }));
  }, [form.state, form.schoolName, schools]);

  async function loadPlans() {
    setLoading(true);
    setMessage("");
    try {
      const response = await api.get("/plans", { params: filters });
      setPlans(Array.isArray(response.data.plans) ? response.data.plans : []);
      setSummary(response.data.summary || null);
    } catch (error) {
      setMessage(error.response?.data?.message || "Could not load plans.");
    } finally {
      setLoading(false);
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;

    if (name === "state") {
      setForm((prev) => ({
        ...prev,
        state: value,
        schoolName: "",
        city: "",
        pointOfContact: "",
        contactNo: "",
        schoolEmail: "",
        course: "",
      }));
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const response = await api.post("/plans", form);
      setMessage(response.data.message || "Plan saved.");
      setForm(emptyForm(currentUser));
      await loadPlans();
    } catch (error) {
      setMessage(error.response?.data?.message || "Could not save plan.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(planId, status) {
    setMessage("");
    try {
      const response = await api.patch(`/plans/${planId}/status`, { status });
      setMessage(response.data.message || "Plan updated.");
      await loadPlans();
    } catch (error) {
      setMessage(error.response?.data?.message || "Could not update plan.");
    }
  }

  async function sendReminder(planId) {
    setMessage("");
    try {
      const response = await api.post(`/plans/${planId}/remind`);
      setMessage(response.data.message || "Reminder sent.");
      await loadPlans();
    } catch (error) {
      setMessage(error.response?.data?.message || "Could not send reminder.");
    }
  }

  return (
    <section className="scheduler-shell">
      <section className="panel report-panel scheduler-panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">Planning workspace</span>
            <h2>Schedule school visits</h2>
          </div>
          <span className="panel-badge">{isAdmin ? "Admin view" : "Private PM view"}</span>
        </div>

        {message && <div className="status-text">{message}</div>}

        <form className="report-flow" onSubmit={handleSubmit}>
          <div className="flow-section">
            <div className="flow-heading">
              <span>1</span>
              <div>
                <h3>School and owner</h3>
                <p>Pick the school, then lock in the PM, purpose, and date.</p>
              </div>
            </div>

            <div className="form-grid">
              <label>
                State
                <select name="state" value={form.state} onChange={handleChange} required>
                  <option value="">Select state</option>
                  {states.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                School
                <select name="schoolName" value={form.schoolName} onChange={handleChange} required disabled={!form.state}>
                  <option value="">Select school</option>
                  {filteredSchools.map((school) => (
                    <option key={`${school.state}-${school.schoolName}`} value={school.schoolName}>
                      {school.schoolName}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Program Manager
                <input name="programManagerName" value={form.programManagerName} onChange={handleChange} required />
              </label>

              <label>
                Program Manager Email
                <input
                  type="email"
                  name="programManagerEmail"
                  value={form.programManagerEmail}
                  onChange={handleChange}
                  required
                />
              </label>

              <label>
                Purpose of Visit
                <input
                  name="purposeOfVisit"
                  value={form.purposeOfVisit}
                  onChange={handleChange}
                  placeholder="Teachers Training / Demo / Review"
                  required
                />
              </label>

              <label>
                Planned Date
                <input type="date" name="plannedDate" value={form.plannedDate} onChange={handleChange} required />
              </label>

              <label>
                Start Time
                <input type="time" name="plannedStartTime" value={form.plannedStartTime} onChange={handleChange} />
              </label>

              <label>
                End Time
                <input type="time" name="plannedEndTime" value={form.plannedEndTime} onChange={handleChange} />
              </label>

              <label>
                Status
                <select name="status" value={form.status} onChange={handleChange}>
                  {PLAN_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="flow-section">
            <div className="flow-heading">
              <span>2</span>
              <div>
                <h3>Planned work</h3>
                <p>Capture exactly what work is expected on the ground.</p>
              </div>
            </div>

            <div className="form-grid">
              <label className="full-span">
                Work Planned
                <textarea
                  name="workPlanned"
                  rows="4"
                  value={form.workPlanned}
                  onChange={handleChange}
                  placeholder="Teacher induction, robotics demo, material handover, follow-up review..."
                  required
                />
              </label>

              <label>
                School Email
                <input type="email" name="schoolEmail" value={form.schoolEmail} onChange={handleChange} />
              </label>

              <label>
                Contact Number
                <input name="contactNo" value={form.contactNo} onChange={handleChange} />
              </label>

              <label>
                Point of Contact
                <input name="pointOfContact" value={form.pointOfContact} onChange={handleChange} />
              </label>

              <label>
                Course / Requirement
                <input name="course" value={form.course} onChange={handleChange} />
              </label>

              <label className="full-span">
                Planning Notes
                <textarea
                  name="planningNotes"
                  rows="3"
                  value={form.planningNotes}
                  onChange={handleChange}
                  placeholder="Anything ops/admin should know before the visit."
                />
              </label>
            </div>
          </div>

          <div className="submit-bar">
            <span>
              {form.status === "Confirmed"
                ? "Confirmed plans will be marked ready for calendar sync."
                : "Draft plans stay private to the PM unless admin views them."}
            </span>
            <button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Plan"}
            </button>
          </div>
        </form>
      </section>

      <section className="panel tracking-panel scheduler-list-panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">Planner board</span>
            <h2>{isAdmin ? "All scheduled plans" : "My scheduled plans"}</h2>
          </div>
          <span className="panel-badge">{plans.length} plans</span>
        </div>

        <div className="tracking-filter-grid scheduler-filters">
          <label>
            Status
            <select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
              <option value="">All statuses</option>
              {PLAN_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <label>
            From
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
            />
          </label>

          <label>
            To
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
            />
          </label>

          {isAdmin && (
            <label>
              PM Email
              <input
                value={filters.programManagerEmail}
                onChange={(e) => setFilters((prev) => ({ ...prev, programManagerEmail: e.target.value }))}
                placeholder="name@superteacher.in"
              />
            </label>
          )}
        </div>

        {summary && (
          <div className="dashboard-stats compact-stats">
            <Metric label="Total" value={summary.totalPlans} />
            <Metric label="Draft" value={summary.draftPlans} />
            <Metric label="Confirmed" value={summary.confirmedPlans} tone="blue" />
            <Metric label="Completed" value={summary.completedPlans} tone="green" />
            <Metric label="Cancelled" value={summary.cancelledPlans} tone="red" />
            <Metric label="Converted" value={summary.convertedPlans} tone="green" />
          </div>
        )}

        {loading ? (
          <div className="status-text">Loading plans...</div>
        ) : !plans.length ? (
          <div className="empty-state">No plans found for the current filters.</div>
        ) : (
          <div className="plan-list">
            {plans.map((plan) => (
              <article key={plan._id} className="plan-card">
                <div className="plan-card-top">
                  <div>
                    <strong>{plan.schoolName}</strong>
                    <span>
                      {new Date(plan.plannedDate).toLocaleDateString("en-IN")} | {plan.purposeOfVisit}
                    </span>
                  </div>
                  <span className={`status-pill ${getStatusTone(plan.status)}`}>{plan.status}</span>
                </div>

                <div className="plan-meta">
                  <span>{plan.state}</span>
                  <span>{plan.city || "City pending"}</span>
                  <span>{plan.programManagerName}</span>
                  <span>
                    {plan.plannedStartTime || "--"} to {plan.plannedEndTime || "--"}
                  </span>
                </div>

                <p>{plan.workPlanned}</p>

                <div className="plan-footer">
                  <div className="plan-status-stack">
                    <span className="muted-text">
                      Planner Sheet: {plan.plannerSheetStatus || "Pending"}
                      {plan.plannerSheetError ? ` (${plan.plannerSheetError})` : ""}
                    </span>
                    <span className="muted-text">
                      Notification: {plan.notificationStatus || "Not Required"}
                      {plan.notificationError ? ` (${plan.notificationError})` : ""}
                    </span>
                    {plan.convertedReportId && <span className="muted-text">Converted to report</span>}
                  </div>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="table-action"
                      onClick={() => onConvertToReport?.(plan)}
                      disabled={Boolean(plan.convertedReportId) || plan.status === "Cancelled"}
                    >
                      {plan.convertedReportId ? "Converted" : "Convert to Report"}
                    </button>
                    <button type="button" className="table-action" onClick={() => sendReminder(plan._id)}>
                      Remind
                    </button>
                    {PLAN_STATUSES.map((status) => (
                      <button
                        key={status}
                        type="button"
                        className="table-action"
                        onClick={() => updateStatus(plan._id, status)}
                        disabled={status === plan.status}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function Metric({ label, value = 0, tone = "" }) {
  return (
    <div className={`metric-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getStatusTone(status) {
  if (status === "Completed") return "sent";
  if (status === "Cancelled") return "failed";
  if (status === "Confirmed") return "info";
  return "warning";
}
