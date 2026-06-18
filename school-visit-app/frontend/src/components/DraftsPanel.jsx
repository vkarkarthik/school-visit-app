export default function DraftsPanel({ onLoadDraft }) {
  const drafts = readDrafts();

  const deleteDraft = (id) => {
    localStorage.setItem('schoolVisitDrafts', JSON.stringify(drafts.filter((draft) => draft.id !== id)));
    window.dispatchEvent(new Event('storage'));
  };

  return (
    <section className="panel dashboard-panel">
      <div className="panel-header compact">
        <div>
          <span className="eyebrow">Draft desk</span>
          <h2>Saved work in progress</h2>
        </div>
        <span className="panel-badge">{drafts.length} drafts</span>
      </div>
      {!drafts.length && <div className="empty-state">No saved drafts yet.</div>}
      <div className="report-card-grid">
        {drafts.map((draft) => (
          <article className="report-card" key={draft.id}>
            <div className="report-card-top">
              <div>
              <strong>{draft.form.schoolName || 'Untitled report'}</strong>
                <span>{draft.form.purposeOfVisit || 'No purpose'} | Saved {new Date(draft.savedAt).toLocaleString('en-IN')}</span>
              </div>
              <span className="status-pill warning">Draft</span>
            </div>
            <div className="report-card-meta">
              <span>{draft.form.workMode || 'School Visit'}</span>
              <span>{draft.form.programManagerName || 'Program Manager'}</span>
              <span>{draft.form.visitDate || 'Date not set'}</span>
            </div>
            <p>{String(draft.form.actualWorkDone || draft.form.sessionSummary || 'No work notes added yet.').slice(0, 180)}</p>
            <div className="row-actions">
              <button type="button" className="table-action" onClick={() => onLoadDraft(draft.form)}>
                Load
              </button>
              <button type="button" className="table-action" onClick={() => deleteDraft(draft.id)}>
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
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
