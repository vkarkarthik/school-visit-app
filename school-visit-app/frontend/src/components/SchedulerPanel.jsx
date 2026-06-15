import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";

const PLAN_STATUSES = ["Draft", "Confirmed", "Completed", "Cancelled"];
const DEFAULT_VISIBLE_STATUSES = ["Draft", "Confirmed"];
const DEFAULT_GROUP_VISIBLE_COUNT = 4;

function formatDateInput(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

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
  workMode: "School Visit",
  plannedLocation: "",
});

export default function SchedulerPanel({ schoolMaster, currentUser, isAdmin, onConvertToReport }) {
  const today = useMemo(() => new Date(), []);
  const defaultFrom = useMemo(() => formatDateInput(today), [today]);
  const defaultTo = useMemo(() => formatDateInput(addDays(today, 30)), [today]);
  const [form, setForm] = useState(() => emptyForm(currentUser));
  const [plans, setPlans] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [filters, setFilters] = useState({
    status: "",
    dateFrom: defaultFrom,
    dateTo: defaultTo,
    programManagerEmail: "",
    state: "",
    purposeOfVisit: "",
    search: "",
  });
  const [rangePreset, setRangePreset] = useState("next30");
  const [includeClosed, setIncludeClosed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [visibleCountByGroup, setVisibleCountByGroup] = useState({});

  const schools = Array.isArray(schoolMaster?.schools) ? schoolMaster.schools : [];
  const states = Array.isArray(schoolMaster?.states) ? schoolMaster.states : [];
  const isSchoolVisitMode = form.workMode === "School Visit";

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      programManagerName: currentUser?.name || "",
      programManagerEmail: currentUser?.email || "",
    }));
  }, [currentUser?.name, currentUser?.email]);

  useEffect(() => {
    loadPlans();
  }, [filters.status, filters.dateFrom, filters.dateTo, filters.programManagerEmail, filters.state, filters.purposeOfVisit, filters.search]);

  const filteredSchools = useMemo(
    () =>
      schools
        .filter((school) => school.state === form.state)
        .sort((a, b) => a.schoolName.localeCompare(b.schoolName)),
    [schools, form.state]
  );

  useEffect(() => {
    if (form.workMode !== "School Visit") return;

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
      if (form.workMode !== "School Visit") {
        setForm((prev) => ({ ...prev, state: value }));
        return;
      }

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

    if (name === "workMode") {
      setForm((prev) => ({
        ...prev,
        workMode: value,
        state: value === "School Visit" ? prev.state : "",
        schoolName: value === "School Visit" ? prev.schoolName : "",
        city: value === "School Visit" ? prev.city : "",
        pointOfContact: value === "School Visit" ? prev.pointOfContact : "",
        contactNo: value === "School Visit" ? prev.contactNo : "",
        schoolEmail: value === "School Visit" ? prev.schoolEmail : "",
        course: value === "School Visit" ? prev.course : "",
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
      const payload = {
        ...form,
        programManagerName: isAdmin ? form.programManagerName : currentUser?.name || form.programManagerName,
        programManagerEmail: isAdmin ? form.programManagerEmail : currentUser?.email || form.programManagerEmail,
      };
      const response = await api.post("/plans", payload);
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

  function applyRangePreset(preset) {
    const base = new Date();
    let dateFrom = "";
    let dateTo = "";

    if (preset === "today") {
      dateFrom = formatDateInput(base);
      dateTo = formatDateInput(base);
    }

    if (preset === "week") {
      dateFrom = formatDateInput(base);
      dateTo = formatDateInput(addDays(base, 7));
    }

    if (preset === "month") {
      dateFrom = formatDateInput(base);
      dateTo = formatDateInput(addDays(base, 30));
    }

    if (preset === "next30") {
      dateFrom = formatDateInput(base);
      dateTo = formatDateInput(addDays(base, 30));
    }

    setRangePreset(preset);
    setFilters((prev) => ({
      ...prev,
      dateFrom,
      dateTo,
    }));
  }

  function toggleGroup(groupKey) {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  }

  const groupedPlans = useMemo(() => {
    const groups = new Map();

    for (const plan of plans) {
      if (!includeClosed && !DEFAULT_VISIBLE_STATUSES.includes(plan.status)) {
        continue;
      }

      const key = plan.programManagerEmail || plan.programManagerName || "unknown";
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          managerName: plan.programManagerName || "Unknown PM",
          managerEmail: plan.programManagerEmail || "",
          plans: [],
        });
      }
      groups.get(key).plans.push(plan);
    }

    return [...groups.values()]
      .map((group) => ({
        ...group,
        plans: group.plans.sort((a, b) => new Date(a.plannedDate) - new Date(b.plannedDate)),
      }))
      .sort((a, b) => a.managerName.localeCompare(b.managerName));
  }, [includeClosed, plans]);

  const programManagerOptions = useMemo(() => {
    const uniqueManagers = new Map();

    for (const plan of plans) {
      const email = plan.programManagerEmail || "";
      const name = plan.programManagerName || email || "Unknown PM";
      if (email && !uniqueManagers.has(email)) {
        uniqueManagers.set(email, name);
      }
    }

    return [...uniqueManagers.entries()]
      .map(([email, name]) => ({ email, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [plans]);

  useEffect(() => {
    setExpandedGroups((prev) => {
      const next = { ...prev };
      for (const group of groupedPlans) {
        if (!(group.key in next)) {
          next[group.key] = true;
        }
      }
      return next;
    });
  }, [groupedPlans]);

  return (
    <section className="scheduler-shell">
      <section className="panel report-panel scheduler-panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">Planning workspace</span>
            <h2>{isSchoolVisitMode ? "Schedule school visits" : "Schedule work plans"}</h2>
          </div>
          <span className="panel-badge">{isAdmin ? "Admin view" : "Private PM view"}</span>
        </div>

        {message && <div className="status-text">{message}</div>}

        <form className="report-flow" onSubmit={handleSubmit}>
          <div className="flow-section">
            <div className="flow-heading">
              <span>1</span>
              <div>
                <h3>{isSchoolVisitMode ? "School and owner" : "Work context and owner"}</h3>
                <p>
                  {isSchoolVisitMode
                    ? "Pick the school, then lock in the PM, purpose, and date."
                    : "Capture the work context, owner, and the internal task being planned."}
                </p>
              </div>
            </div>

            <div className="form-grid">
              <label>
                {isSchoolVisitMode ? "State" : "Region / Team"}
                {isSchoolVisitMode ? (
                  <select name="state" value={form.state} onChange={handleChange} required>
                    <option value="">Select state</option>
                    {states.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    name="state"
                    value={form.state}
                    onChange={handleChange}
                    placeholder="Optional region, team, or business unit"
                  />
                )}
              </label>

              <label>
                {isSchoolVisitMode ? "School" : "Work Item / Account"}
                {isSchoolVisitMode ? (
                  <select name="schoolName" value={form.schoolName} onChange={handleChange} required disabled={!form.state}>
                    <option value="">Select school</option>
                    {filteredSchools.map((school) => (
                      <option key={`${school.state}-${school.schoolName}`} value={school.schoolName}>
                        {school.schoolName}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    name="schoolName"
                    value={form.schoolName}
                    onChange={handleChange}
                    placeholder="Proposal prep, lesson planning, follow-up calls, internal review..."
                    required
                  />
                )}
              </label>

              <label>
                Program Manager
                <input
                  name="programManagerName"
                  value={form.programManagerName}
                  onChange={handleChange}
                  readOnly={!isAdmin}
                  required
                />
              </label>

              <label>
                Program Manager Email
                <input
                  type="email"
                  name="programManagerEmail"
                  value={form.programManagerEmail}
                  onChange={handleChange}
                  readOnly={!isAdmin}
                  required
                />
              </label>

              {!isAdmin && (
                <div className="full-span help-text">
                  Planner entries for PMs are locked to the signed-in SuperTeacher account so plans always save under the correct owner.
                </div>
              )}

              <label>
                {isSchoolVisitMode ? "Purpose of Visit" : "Work Category"}
                <input
                  name="purposeOfVisit"
                  value={form.purposeOfVisit}
                  onChange={handleChange}
                  placeholder={isSchoolVisitMode ? "Teachers Training / Demo / Review" : "Planning / Follow-up / Proposal / Review"}
                  required
                />
              </label>

              <label>
                Work Mode
                <select name="workMode" value={form.workMode} onChange={handleChange}>
                  <option>School Visit</option>
                  <option>Work From Home</option>
                  <option>Work From Office</option>
                  <option>Travel</option>
                  <option>Other</option>
                </select>
              </label>

              <label>
                {isSchoolVisitMode ? "Planned Location" : "Work Location"}
                <input
                  name="plannedLocation"
                  value={form.plannedLocation}
                  onChange={handleChange}
                  placeholder="School / Home / Office / City"
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
                <h3>{isSchoolVisitMode ? "Planned work" : "Planned internal work"}</h3>
                <p>
                  {isSchoolVisitMode
                    ? "Capture exactly what work is expected on the ground."
                    : "Capture the internal work expected from home, office, travel, or other non-school modes."}
                </p>
              </div>
            </div>

            <div className="form-grid">
              <label className="full-span">
                {isSchoolVisitMode ? "Work Planned" : "Planned Work Items"}
                <textarea
                  name="workPlanned"
                  rows="4"
                  value={form.workPlanned}
                  onChange={handleChange}
                  placeholder={
                    isSchoolVisitMode
                      ? "Teacher induction, robotics demo, material handover, follow-up review..."
                      : "Proposal preparation, lesson planning, report corrections, follow-up calls, content review..."
                  }
                  required
                />
              </label>

              {isSchoolVisitMode ? (
                <>
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
                </>
              ) : (
                <>
                  <label>
                    Internal Stakeholder
                    <input
                      name="pointOfContact"
                      value={form.pointOfContact}
                      onChange={handleChange}
                      placeholder="Manager, team lead, ops contact"
                    />
                  </label>

                  <label>
                    Contact Number
                    <input name="contactNo" value={form.contactNo} onChange={handleChange} placeholder="Optional" />
                  </label>

                  <label>
                    Work Email
                    <input
                      type="email"
                      name="schoolEmail"
                      value={form.schoolEmail}
                      onChange={handleChange}
                      placeholder="Optional work recipient"
                    />
                  </label>

                  <label>
                    Program / Focus Area
                    <input
                      name="course"
                      value={form.course}
                      onChange={handleChange}
                      placeholder="Content, training, review, operations"
                    />
                  </label>
                </>
              )}

              <label className="full-span">
                {isSchoolVisitMode ? "Planning Notes" : "Work Notes"}
                <textarea
                  name="planningNotes"
                  rows="3"
                  value={form.planningNotes}
                  onChange={handleChange}
                  placeholder={
                    isSchoolVisitMode
                      ? "Anything ops/admin should know before the visit."
                      : "Anything ops/admin should know before the internal work starts."
                  }
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

        <div className="scheduler-toolbar">
          <div className="scheduler-presets">
            {[
              { id: "today", label: "Today" },
              { id: "week", label: "Next 7 Days" },
              { id: "next30", label: "Next 30 Days" },
              { id: "all", label: "All Time" },
            ].map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`scheduler-chip ${rangePreset === preset.id ? "active" : ""}`}
                onClick={() => applyRangePreset(preset.id)}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <label className="scheduler-toggle">
            <input
              type="checkbox"
              checked={includeClosed}
              onChange={(e) => setIncludeClosed(e.target.checked)}
            />
            <span>Show completed and cancelled too</span>
          </label>
        </div>

        <div className="tracking-filter-grid scheduler-filters">
          <label>
            Search
            <input
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              placeholder="School or city"
            />
          </label>

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
            State
            <select value={filters.state} onChange={(e) => setFilters((prev) => ({ ...prev, state: e.target.value }))}>
              <option value="">All states</option>
              {states.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </label>

          <label>
            Purpose
            <input
              value={filters.purposeOfVisit}
              onChange={(e) => setFilters((prev) => ({ ...prev, purposeOfVisit: e.target.value }))}
              placeholder="Training / Demo / Review"
            />
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
              Program Manager
              <select
                value={filters.programManagerEmail}
                onChange={(e) => setFilters((prev) => ({ ...prev, programManagerEmail: e.target.value }))}
              >
                <option value="">All PMs</option>
                {programManagerOptions.map((manager) => (
                  <option key={manager.email} value={manager.email}>
                    {manager.name} ({manager.email})
                  </option>
                ))}
              </select>
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
        ) : !groupedPlans.length ? (
          <div className="empty-state">No plans found for the current filters.</div>
        ) : (
          <div className="pm-plan-groups">
            {groupedPlans.map((group) => (
              <section key={group.key} className="pm-plan-group">
                <div className="pm-plan-group-head">
                  <div>
                    <span className="eyebrow">Program Manager</span>
                    <h3>{group.managerName}</h3>
                    <p>{group.managerEmail || "Email not available"}</p>
                  </div>
                  <div className="pm-plan-group-actions">
                    <span className="panel-badge">{group.plans.length} plans</span>
                    <button
                      type="button"
                      className="table-action"
                      onClick={() => toggleGroup(group.key)}
                    >
                      {expandedGroups[group.key] ? "Collapse" : "Expand"}
                    </button>
                  </div>
                </div>

                {expandedGroups[group.key] && (
                  <div className="pm-plan-grid">
                    {group.plans
                      .slice(0, visibleCountByGroup[group.key] || DEFAULT_GROUP_VISIBLE_COUNT)
                      .map((plan) => (
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
                        <span>{plan.pointOfContact || "POC pending"}</span>
                        <span>
                          {plan.plannedStartTime || "--"} to {plan.plannedEndTime || "--"}
                        </span>
                        <span>{plan.workMode || "School Visit"}</span>
                        <span>{plan.plannedLocation || "Location not added"}</span>
                      </div>

                      <div className="plan-copy-block">
                        <span className="eyebrow">Work Planned</span>
                        <p>{plan.workPlanned}</p>
                      </div>

                      {plan.planningNotes && (
                        <div className="plan-copy-block plan-copy-block-notes">
                          <span className="eyebrow">Planning Notes</span>
                          <p>{plan.planningNotes}</p>
                        </div>
                      )}

                      {plan.actualWorkDone && (
                        <div className="plan-copy-block">
                          <span className="eyebrow">Actual Work Done</span>
                          <p>{plan.actualWorkDone}</p>
                        </div>
                      )}

                      <div className="plan-footer">
                        <div className="plan-status-stack">
                          <span className="muted-text">
                            Planner Sheet: {plan.plannerSheetStatus || "Pending"}
                            {plan.plannerSheetError ? ` (${plan.plannerSheetError})` : ""}
                          </span>
                          <span className="muted-text">
                            Reminder: {plan.notificationStatus || "Not Required"}
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
                          {getAvailableStatusActions(plan.status, isAdmin).map((status) => (
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

                {expandedGroups[group.key] &&
                  group.plans.length > (visibleCountByGroup[group.key] || DEFAULT_GROUP_VISIBLE_COUNT) && (
                    <div className="scheduler-more-row">
                      <button
                        type="button"
                        className="table-action"
                        onClick={() =>
                          setVisibleCountByGroup((prev) => ({
                            ...prev,
                            [group.key]: (prev[group.key] || DEFAULT_GROUP_VISIBLE_COUNT) + DEFAULT_GROUP_VISIBLE_COUNT,
                          }))
                        }
                      >
                        Show more plans
                      </button>
                    </div>
                  )}
              </section>
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

function getAvailableStatusActions(currentStatus, isAdmin) {
  if (!isAdmin && currentStatus === "Completed") {
    return ["Completed"];
  }

  return PLAN_STATUSES;
}
