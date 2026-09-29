export type HolidayItem = {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  type: "PUBLIC_HOLIDAY" | "COMPANY_HOLIDAY" | "RESTRICTED_HOLIDAY";
  description?: string;
};

export type LeaveItem = {
  id: string;
  date: string; // YYYY-MM-DD
  leaveType: "Privilege Leave" | "Compensatory Off" | "Casual Leave" | "Sick Leave";
  status: "APPROVED" | "PENDING" | "REJECTED";
  reason: string;
  days: number; // Supports decimal fractions (e.g. 0.5, 1.0)
  session?: "Full Day" | "First Half" | "Second Half";
  isPast?: boolean;
};

export type LeaveQuota = {
  type: "Privilege Leave" | "Compensatory Off" | "Casual Leave" | "Sick Leave";
  total: number;
  taken: number; // Booked
  pending: number;
  remaining: number; // Available
  iconColor: string;
};

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const FULL_WEEKDAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

export function formatNum(n: number): string {
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(2).replace(/\.?0+$/, "");
}

export function formatFullDate(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return dateStr;
  const [y, m, d] = parts;
  const dateObj = new Date(y, m - 1, d);
  const weekday = FULL_WEEKDAYS[dateObj.getDay()];
  const monthName = MONTH_NAMES[m - 1] || "";
  return `${weekday}, ${monthName} ${d}, ${y}`;
}

// Company Holidays for 2026
export const INITIAL_HOLIDAYS: HolidayItem[] = [
  { id: "h1", date: "2026-01-01", title: "New Year's Day", type: "COMPANY_HOLIDAY", description: "First day of the year" },
  { id: "h2", date: "2026-01-26", title: "Republic Day", type: "PUBLIC_HOLIDAY", description: "National Republic Day celebration" },
  { id: "h3", date: "2026-03-04", title: "Maha Shivratri", type: "COMPANY_HOLIDAY", description: "Festival of Lord Shiva" },
  { id: "h4", date: "2026-03-20", title: "Eid-ul-Fitr", type: "PUBLIC_HOLIDAY", description: "Islamic festival" },
  { id: "h5", date: "2026-03-25", title: "Holi", type: "COMPANY_HOLIDAY", description: "Festival of Colors" },
  { id: "h6", date: "2026-04-03", title: "Good Friday", type: "COMPANY_HOLIDAY", description: "Easter weekend holiday" },
  { id: "h7", date: "2026-05-01", title: "Labor Day", type: "PUBLIC_HOLIDAY", description: "International Workers' Day" },
  { id: "h8", date: "2026-08-15", title: "Independence Day", type: "PUBLIC_HOLIDAY", description: "National Independence Day" },
  { id: "h9", date: "2026-09-02", title: "Janmashtami", type: "COMPANY_HOLIDAY", description: "Celebration of Lord Krishna's birth" },
  { id: "h10", date: "2026-10-02", title: "Mahatma Gandhi Jayanti", type: "PUBLIC_HOLIDAY", description: "National holiday celebrating Gandhi's birthday" },
  { id: "h11", date: "2026-10-20", title: "Dussehra", type: "COMPANY_HOLIDAY", description: "Vijayadashami festival" },
  { id: "h12", date: "2026-11-08", title: "Diwali", type: "PUBLIC_HOLIDAY", description: "Festival of Lights" },
  { id: "h13", date: "2026-11-24", title: "Guru Nanak Jayanti", type: "COMPANY_HOLIDAY", description: "Guru Nanak Gurpurab" },
  { id: "h14", date: "2026-12-25", title: "Christmas Day", type: "COMPANY_HOLIDAY", description: "Christmas celebration" },
];


// Dynamic Employee Leaves & Quotas (populated via Zoho Sync)
export const INITIAL_LEAVES: LeaveItem[] = [];
export const INITIAL_QUOTA: LeaveQuota[] = [];
