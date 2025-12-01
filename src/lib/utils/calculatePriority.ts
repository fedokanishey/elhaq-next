/**
 * Calculate beneficiary priority score (1-10) based on financial burden
 * 
 * Formula: 
 * - Subsistence cost per family member: 2000 SAR/month
 * - Monthly burden ratio = (rentalCost + subsistence for family) / monthly income
 * - Priority maps burden ratio to 1-10 scale:
 *   - Ratio >= 2.0: Priority 10 (extreme need)
 *   - Ratio >= 1.5: Priority 9
 *   - Ratio >= 1.0: Priority 7-8
 *   - Ratio >= 0.5: Priority 5-6
 *   - Ratio < 0.5: Priority 1-4
 */

// Tuned parameters to reduce the dominance of extremely-low incomes
// SUBSISTENCE_PER_PERSON lowered to make the scale a bit more forgiving
const SUBSISTENCE_PER_PERSON = 1500; // SAR/month (adjusted)

export function calculatePriority(
  income?: number,
  rentalCost?: number,
  familyMembers?: number
): number {
  const monthlyIncome = income ?? 0;
  const monthlyRent = rentalCost ?? 0;
  const family = Math.max(familyMembers ?? 1, 1);

  if (monthlyIncome === 0) return 10;

  const subsistenceNeed = family * SUBSISTENCE_PER_PERSON;
  const totalMonthlyBurden = monthlyRent + subsistenceNeed;
  const burdenRatio = totalMonthlyBurden / monthlyIncome;

  // Adjusted thresholds produce a gentler distribution so very-low incomes
  // don't completely overshadow slightly higher (but still needy) households.
  let priority: number;
  if (burdenRatio >= 2.5) {
    priority = 10;
  } else if (burdenRatio >= 2.0) {
    priority = 9;
  } else if (burdenRatio >= 1.5) {
    priority = 7; // less aggressive than before (was 8)
  } else if (burdenRatio >= 1.0) {
    priority = 6;
  } else if (burdenRatio >= 0.6) {
    priority = 5;
  } else if (burdenRatio >= 0.35) {
    priority = 3;
  } else {
    priority = 1;
  }

  return Math.max(1, Math.min(10, Math.round(priority)));
}
