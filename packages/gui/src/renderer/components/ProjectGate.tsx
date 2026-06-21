export function ProjectGate({ reason, onChoose }: { reason?: string; onChoose: () => void }) {
  return (
    <div className="gate">
      <div className="gate-card">
        <h1>Open a Flavian project</h1>
        <p>
          Point Flavian at your project folder — the directory that contains{' '}
          <code>wordpress-local.sh</code> and <code>scripts/</code>. The app reads and writes that
          folder (themes, <code>.env</code>, conversion output), so it must be a real Flavian
          checkout.
        </p>
        {reason && (
          <div className="banner banner-warn">
            <span>{reason}</span>
          </div>
        )}
        <button type="button" onClick={onChoose}>
          Choose folder…
        </button>
      </div>
    </div>
  );
}
