/**
 * ComingSoonPage.jsx
 * ──────────────────
 * Shared placeholder for modules that are registered in the permission system
 * and routed in the sidebar, but whose functionality has not been specified
 * yet (Paper Review, Proposal Submission).
 *
 * Deliberately inert: no API calls, no state, no data fetching. It exists so
 * the nav entry leads somewhere honest instead of bouncing to Bookings, and so
 * the route is already wired when the real page arrives — swapping it out is
 * then a one-line change in App.jsx.
 */
export function ComingSoonPage({ title, description }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height: "100%", background: "var(--bg)",
      padding: 40, textAlign: "center",
    }}>
      <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>🚧</div>
      <h2 style={{
        margin: "0 0 10px", fontFamily: "var(--font-serif)", fontWeight: 500,
        fontSize: 28, color: "var(--text)",
      }}>
        {title}
      </h2>
      <p style={{
        margin: "0 0 8px", fontSize: 14, color: "var(--text-dim)",
        maxWidth: 420, lineHeight: 1.6,
      }}>
        {description}
      </p>
      <div style={{
        marginTop: 20, padding: "6px 14px", background: "var(--surface-alt)",
        border: "1px solid var(--border)", borderRadius: 999, fontSize: 11,
        textTransform: "uppercase", letterSpacing: "0.08em",
        color: "var(--text-faint)",
      }}>
        Coming Soon
      </div>
    </div>
  );
}

export function PaperReviewPage() {
  return (
    <ComingSoonPage
      title="Paper Review"
      description="Abstract and paper review will live here. The module is registered and permission-controlled; the workflow itself is still being specified."
    />
  );
}

export function ProposalSubmissionPage() {
  return (
    <ComingSoonPage
      title="Proposal Submission"
      description="Speaker and sponsor proposal intake will live here. The module is registered and permission-controlled; the workflow itself is still being specified."
    />
  );
}
