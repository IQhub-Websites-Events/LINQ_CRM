export const PAYMENT_STATUSES = [
  "Pending",
  "Paid",
  "Unpaid",
  "Partial",
  "Cancelled",
  "Refunded",
  "Free",
  "Credit Pending (Free)",
  "Credit Pending (Paid)",
  "Credit Transferred",
  "Paid (Transferred)",
];

export const PAYMENT_TYPES = [
  "Stripe",
  "Bank",
  "Bank Transfer",
  "Credit Card",
  "Cash",
  "Complimentary",
  "Manual",
  "Invoice",
  "Wire Transfer",
];

export const TICKET_TIERS = [
  "Standard",
  "VIP",
  "Speaker",
  "Sponsor",
  "Delegate",
  "Complimentary",
  "Student",
  "Media",
  "Partner",
];

export const ATTENDANCE_STATUSES = [
  "Pending",
  "Confirmed",
  "No-show",
  "Cancelled",
];

export const PAID_OR_FREE = ["Paid", "Free"];

export const CURRENCIES = ["USD", "GBP", "EUR", "AED", "SGD", "INR", "OTHER"];
export const USER_ROLES = ["admin", "sales"];
export const EVENT_STATUSES = ["Draft", "Upcoming", "Live", "Completed", "Cancelled"];

export const STATUS_CONFIG = {
  Paid: { color: "green", dot: "#22c55e" },
  Pending: { color: "amber", dot: "#f59e0b" },
  Unpaid: { color: "red", dot: "#ef4444" },
  Partial: { color: "amber", dot: "#f59e0b" },
  Cancelled: { color: "red", dot: "#ef4444" },
  Refunded: { color: "slate", dot: "#94a3b8" },
  Free: { color: "blue", dot: "#3b82f6" },
  "Credit Pending (Free)": { color: "purple", dot: "#a855f7" },
  "Credit Pending (Paid)": { color: "purple", dot: "#a855f7" },
  "Credit Transferred": { color: "cyan", dot: "#06b6d4" },
  "Paid (Transferred)": { color: "green", dot: "#22c55e" },
};

export const PAGE_SIZE = 50;
