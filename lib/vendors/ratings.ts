// Vendor rating criteria come straight from the spec: Quality, Timeliness, and Communication,
// each out of 5. There is no stored `overall` — it is the mean of the three, computed here, so a
// vendor's headline score can never disagree with the criteria it was built from.

export const RATING_CRITERIA = ["quality", "timeliness", "communication"] as const;
export type RatingCriterion = (typeof RATING_CRITERIA)[number];

export const MIN_RATING_SCORE = 1;
export const MAX_RATING_SCORE = 5;

export type VendorRatingScores = {
  quality: number;
  timeliness: number;
  communication: number;
};

export type VendorRatingSummary =
  | { state: "unrated" }
  | {
      state: "rated";
      ratingCount: number;
      overall: number;
      quality: number;
      timeliness: number;
      communication: number;
    };

export function assertValidScores(scores: VendorRatingScores): VendorRatingScores {
  for (const criterion of RATING_CRITERIA) {
    const value = scores[criterion];
    if (!Number.isInteger(value) || value < MIN_RATING_SCORE || value > MAX_RATING_SCORE) {
      throw new Error(`Each rating must be a whole number from ${MIN_RATING_SCORE} to ${MAX_RATING_SCORE}.`);
    }
  }
  return scores;
}

/**
 * Aggregates a vendor's ratings into the four score columns the assignment picker shows.
 *
 * Milestone 5 builds the ratings table but not the prompt flow that fills it (that is Milestone 7),
 * so in practice this receives an empty array today and reports `unrated`. The picker renders
 * "Not rated yet" from that state rather than a misleading 0.0.
 */
export function summarizeVendorRatings(ratings: readonly VendorRatingScores[]): VendorRatingSummary {
  if (!ratings.length) return { state: "unrated" };

  const quality = mean(ratings.map((rating) => rating.quality));
  const timeliness = mean(ratings.map((rating) => rating.timeliness));
  const communication = mean(ratings.map((rating) => rating.communication));

  return {
    state: "rated",
    ratingCount: ratings.length,
    overall: round1((quality + timeliness + communication) / 3),
    quality: round1(quality),
    timeliness: round1(timeliness),
    communication: round1(communication),
  };
}

function mean(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

// One decimal place is all a 1-5 scale can honestly carry; rounding once at the boundary keeps the
// displayed overall consistent with the displayed criteria.
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function hasScoreChanged(previous: VendorRatingScores, next: VendorRatingScores): boolean {
  return RATING_CRITERIA.some((criterion) => previous[criterion] !== next[criterion]);
}
