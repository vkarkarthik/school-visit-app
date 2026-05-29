export default function DraftsPanel({ onLoadDraft }) {
  const drafts = readDrafts();

  const deleteDraft = (id) => {
    localStorage.setItem('schoolVisitDrafts', JSON.stringify(drafts.filter((draft) => draft.id !== id)));
    window.dispatchEvent(new Event('storage'));
  };

  return (
    <section className="panel dashboard-panel">
      <div className="panel-header compact">
        <h2>My Drafts</h2>
      </div>
      {!drafts.length && <div className="empty-state">No saved drafts yet.</div>}
      <div className="report-list">
        {drafts.map((draft) => (
          <div className="report-row" key={draft.id}>
            <div>
              <strong>{draft.form.schoolName || 'Untitled report'}</strong>
              <span>{draft.form.purposeOfVisit || 'No purpose'} | Saved {new Date(draft.savedAt).toLocaleString('en-IN')}</span>
            </div>
            <div className="row-actions">
              <button type="button" className="table-action" onClick={() => onLoadDraft(draft.form)}>
                Load
              </button>
              <button type="button" className="table-action" onClick={() => deleteDraft(draft.id)}>
                Delete
              </button>
            </div>
          </div>
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
