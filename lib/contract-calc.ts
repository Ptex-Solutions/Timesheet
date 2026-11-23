// Contract (SOW) money maths. Pure and dependency-free so the contract editor
// (live preview) and the API (persisted values) run the exact same code.
//
// Rates and hours are fixed-point with 2 decimals. They are parsed into
// integer hundredths (BigInt), so a rate × hours product is an exact integer
// in 1/10 000 units — no floating point anywhere. Amounts are rounded half-up
// to 2 decimals only when formatted for output; totals are summed from the
// exact products, never from already-rounded figures.

const DECIMAL_2DP = /^\d{1,10}(\.\d{1,2})?$/;

export type DecimalInput = string | number;

// Parses a non-negative decimal with at most 2 fractional digits into integer
// hundredths. Returns null for anything else (negative, NaN, 3+ decimals,
// exponent notation, more than 10 integer digits).
export function toHundredths(v: DecimalInput): bigint | null {
  const s = typeof v === "number" ? (Number.isFinite(v) ? String(v) : "") : v.trim();
  if (!DECIMAL_2DP.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  return BigInt(whole) * BigInt(100) + BigInt((frac + "00").slice(0, 2));
}

export function isValidDecimal2(v: DecimalInput): boolean {
  return toHundredths(v) !== null;
}

// Formats a non-negative scaled integer as a fixed 2-decimal string.
// scale = 2 for hundredths (hours, rates), 4 for rate × hours products.
export function formatScaled(value: bigint, scale: 2 | 4): string {
  let cents = value;
  if (scale === 4) cents = (value + BigInt(50)) / BigInt(100); // half-up
  const whole = cents / BigInt(100);
  const frac = (cents % BigInt(100)).toString().padStart(2, "0");
  return `${whole}.${frac}`;
}

export type ContractCalcInput = {
  // One entry per role in the Role Rates table.
  rates: { resourceTypeId: number; ratePerHour: DecimalInput }[];
  // One entry per SOW task row; hours keyed by resourceTypeId. Missing roles
  // count as 0; roles not in `rates` are an error (see validateContractGrid).
  tasks: { taskMasterId: number; hours: Record<number, DecimalInput | undefined> }[];
};

export type ContractTotals = {
  // Per task row, in input order.
  taskTotals: { taskMasterId: number; hours: string }[];
  // Per role, in `rates` order.
  roleTotals: { resourceTypeId: number; hours: string; amount: string }[];
  totalHours: string;
  totalAmount: string;
};

// Structural problems the editor shows inline and the API rejects with 400.
export function validateContractGrid(input: ContractCalcInput): string[] {
  const errors: string[] = [];
  const roleIds = new Set<number>();
  for (const r of input.rates) {
    if (roleIds.has(r.resourceTypeId)) errors.push(`Duplicate role ${r.resourceTypeId} in rates`);
    roleIds.add(r.resourceTypeId);
    if (!isValidDecimal2(r.ratePerHour)) {
      errors.push(`Rate for role ${r.resourceTypeId} must be a non-negative number with up to 2 decimals`);
    }
  }
  const taskIds = new Set<number>();
  for (const t of input.tasks) {
    if (taskIds.has(t.taskMasterId)) errors.push(`Duplicate task ${t.taskMasterId}`);
    taskIds.add(t.taskMasterId);
    for (const [role, h] of Object.entries(t.hours)) {
      if (h === undefined || h === "") continue;
      if (!roleIds.has(Number(role))) {
        errors.push(`Task ${t.taskMasterId} has hours for role ${role}, which has no rate`);
      } else if (!isValidDecimal2(h)) {
        errors.push(`Hours for task ${t.taskMasterId} / role ${role} must be a non-negative number with up to 2 decimals`);
      }
    }
  }
  return errors;
}

// Task total = Σ hours across roles; role amount = role hours × role rate;
// contract amount = Σ role amounts. Invalid or blank cells count as 0 so the
// editor can preview while typing; the API validates before calling this.
export function computeContractTotals(input: ContractCalcInput): ContractTotals {
  const zero = BigInt(0);
  const roleHours = new Map<number, bigint>(input.rates.map((r) => [r.resourceTypeId, zero]));

  const taskTotals = input.tasks.map((t) => {
    let sum = zero;
    for (const r of input.rates) {
      const raw = t.hours[r.resourceTypeId];
      const h = raw === undefined || raw === "" ? zero : toHundredths(raw) ?? zero;
      sum += h;
      roleHours.set(r.resourceTypeId, roleHours.get(r.resourceTypeId)! + h);
    }
    return { taskMasterId: t.taskMasterId, hours: formatScaled(sum, 2) };
  });

  let totalHours = zero;
  let totalAmount4 = zero;
  const roleTotals = input.rates.map((r) => {
    const hours = roleHours.get(r.resourceTypeId)!;
    const amount4 = hours * (toHundredths(r.ratePerHour) ?? zero);
    totalHours += hours;
    totalAmount4 += amount4;
    return {
      resourceTypeId: r.resourceTypeId,
      hours: formatScaled(hours, 2),
      amount: formatScaled(amount4, 4),
    };
  });

  return {
    taskTotals,
    roleTotals,
    totalHours: formatScaled(totalHours, 2),
    totalAmount: formatScaled(totalAmount4, 4),
  };
}

// Display helper: "19000.00" -> "19,000.00 GBP". Formatting only — never feed
// the result back into calculations.
export function formatMoney(amount: string, currencyCode?: string | null): string {
  const [whole, frac = "00"] = amount.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${grouped}.${frac}${currencyCode ? ` ${currencyCode}` : ""}`;
}
