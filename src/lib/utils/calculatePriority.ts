/**
 * Calculate beneficiary priority score (1-10) based on financial burden and health status
 * 
 * Formula: 
 * - Subsistence cost per family member: 1500 SAR/month
 * - Medical cost per sick person: 1000 SAR/month (additional burden)
 * - Monthly burden ratio = (rentalCost + subsistence for family + medical costs) / (monthly income + spouse income)
 * - Priority maps burden ratio to 1-10 scale:
 *   - Ratio >= 2.5: Priority 10 (extreme need)
 *   - Ratio >= 2.0: Priority 9
 *   - Ratio >= 1.5: Priority 7-8
 *   - Ratio >= 1.0: Priority 6
 *   - Ratio >= 0.6: Priority 5
 *   - Ratio >= 0.35: Priority 3
 *   - Ratio < 0.35: Priority 1
 * - Health bonus: +1 for each sick person in household (max +3)
 */

// Tuned parameters to reduce the dominance of extremely-low incomes
const SUBSISTENCE_PER_PERSON = 1500; // SAR/month (adjusted)
const MEDICAL_COST_PER_SICK = 1000; // SAR/month for each sick person

interface HealthStatus {
  beneficiaryHealth?: "healthy" | "sick";
  spouseHealth?: "healthy" | "sick";
  sickUnmarriedChildrenCount?: number; // Only sick children who are NOT married
}

export function calculatePriority(
  income?: number,
  rentalCost?: number,
  familyMembers?: number,
  spouseIncome?: number,
  healthStatus?: HealthStatus,
  maritalStatus?: string
): number {
  const monthlyIncome = (income ?? 0) + (spouseIncome ?? 0);
  const monthlyRent = rentalCost ?? 0;
  const family = Math.max(familyMembers ?? 1, 1);

  if (monthlyIncome === 0) return 10;

  // Calculate sick people count for medical cost
  let sickCount = 0;
  if (healthStatus?.beneficiaryHealth === "sick") sickCount++;
  if (healthStatus?.spouseHealth === "sick") sickCount++;
  // Count sick children only if beneficiary is single
  if (maritalStatus === "single") {
    sickCount += healthStatus?.sickUnmarriedChildrenCount ?? 0;
  }

  const subsistenceNeed = family * SUBSISTENCE_PER_PERSON;
  const medicalCost = sickCount * MEDICAL_COST_PER_SICK;
  const totalMonthlyBurden = monthlyRent + subsistenceNeed + medicalCost;
  const burdenRatio = totalMonthlyBurden / monthlyIncome;

  // Calculate base priority based on burden ratio
  let priority: number;
  if (burdenRatio >= 2.5) {
    priority = 10;
  } else if (burdenRatio >= 2.0) {
    priority = 9;
  } else if (burdenRatio >= 1.5) {
    priority = 7;
  } else if (burdenRatio >= 1.0) {
    priority = 6;
  } else if (burdenRatio >= 0.6) {
    priority = 5;
  } else if (burdenRatio >= 0.35) {
    priority = 3;
  } else {
    priority = 1;
  }

  // Add health bonus (+1 for each sick person, max +3)
  const healthBonus = Math.min(sickCount, 3);
  priority += healthBonus;

  return Math.max(1, Math.min(10, Math.round(priority)));
}
