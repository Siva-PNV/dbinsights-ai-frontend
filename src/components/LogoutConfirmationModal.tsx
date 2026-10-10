export function LogoutConfirmationModal({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <section
        className="logout-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-modal-title"
      >
        <div className="section-kicker">ACCOUNT</div>
        <h2 id="logout-modal-title">Sign out?</h2>
        <p>You’ll need to sign in again to access your databases.</p>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="primary-button" onClick={onConfirm}>
            Sign out
          </button>
        </div>
      </section>
    </div>
  )
}
