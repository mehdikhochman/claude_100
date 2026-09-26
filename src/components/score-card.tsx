import type { LegacyScore } from "@/lib/score";

/** The LEGACY score with tier and a progress bar to the next tier. */
export function ScoreCard({ score, forest = false, title = "Your LEGACY score" }: { score: LegacyScore; forest?: boolean; title?: string }) {
  const percent = Math.round(score.progress * 100);
  return (
    <div className={`card ${forest ? "card--forest" : ""}`}>
      <span className="eyebrow">{title}</span>
      <div className="score">
        <div className="row row--between">
          <span className="score__value">{score.points}</span>
          <span className={`badge ${forest ? "badge--muted" : "badge--tier"}`}>{score.tier.name}</span>
        </div>
        <div
          className="score__bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label={score.nextTier ? `Progress to ${score.nextTier.name}` : "Top tier reached"}
        >
          <div className="score__fill" style={{ width: `${percent}%` }} />
        </div>
        <p className={`small mb-0 ${forest ? "" : "muted"}`}>
          {score.sessions} {score.sessions === 1 ? "session" : "sessions"} · 10 points each.{" "}
          {score.nextTier
            ? `${score.sessionsToNext} more to reach ${score.nextTier.name}.`
            : "You've reached the top tier. Legacy."}
        </p>
      </div>
    </div>
  );
}
