// ─── Profanity filter ────────────────────────────────────────────────────────
// ქართული და ინგლისური სიტყვები რომლებიც არ შეესაბამება პლატფორმის წესებს
const BAD_WORDS = [
  // ქართული
  "სულელი", "იდიოტი", "კრეტინი", "პირუტყვი", "ნაბიჭვარი",
  "გაუპატიურება", "ძაღლი", "ხარი", "ვირი", "ბოზი", "მეძავი",
  "შმაგი", "შმაგო", "ნაშო", "ნასამო",
  "პიდარასტი", "პიდარასტო", "პედერასტი",
  "მეშახტე", "ჯამბაზი", "ნაბოზი", "ლაინი", "ბოზიშვილი",
  "გამეძავდი", "სიძვა", "ლახვარი",
  // english
  "idiot", "stupid", "moron", "dumbass", "asshole", "bitch",
  "fuck", "shit", "crap", "bastard", "whore", "slut",
  "faggot", "retard", "nigger", "chink",
];

/**
 * Returns true if text contains profanity.
 * @param {string} text
 * @returns {boolean}
 */
export function containsProfanity(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return BAD_WORDS.some(w => lower.includes(w.toLowerCase()));
}

/**
 * Returns the specific bad word found, or null.
 * @param {string} text
 * @returns {string|null}
 */
export function findProfanity(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  return BAD_WORDS.find(w => lower.includes(w.toLowerCase())) || null;
}

// ─── Weighted rating ─────────────────────────────────────────────────────────
/**
 * Calculates a weighted average rating:
 *   - Last 90 days  → 70% weight
 *   - Older         → 30% weight
 *
 * If only one group exists, uses that group's simple average.
 *
 * @param {Array<{rating: number, created_at: string}>} reviews
 * @returns {{ weighted: number, simple: number, recentCount: number, olderCount: number }}
 */
export function calcWeightedRating(reviews) {
  if (!reviews || reviews.length === 0) {
    return { weighted: 0, simple: 0, recentCount: 0, olderCount: 0 };
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  const recent = reviews.filter(r => new Date(r.created_at) >= cutoff);
  const older  = reviews.filter(r => new Date(r.created_at) < cutoff);

  const avgRecent = recent.length > 0
    ? recent.reduce((s, r) => s + r.rating, 0) / recent.length
    : null;
  const avgOlder = older.length > 0
    ? older.reduce((s, r) => s + r.rating, 0) / older.length
    : null;

  const simple = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;

  let weighted;
  if (avgRecent !== null && avgOlder !== null) {
    weighted = avgRecent * 0.7 + avgOlder * 0.3;
  } else if (avgRecent !== null) {
    weighted = avgRecent;
  } else {
    weighted = avgOlder;
  }

  return {
    weighted: Math.round(weighted * 10) / 10,
    simple:   Math.round(simple   * 10) / 10,
    recentCount: recent.length,
    olderCount:  older.length,
  };
}
