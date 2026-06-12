// ─── სახელიდან ინიციალები ───
export function getInitials(name) {
  if (!name || typeof name !== "string") return "??";
  return name
    .split(" ")
    .filter(Boolean)
    .map(n => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// ─── თარიღის ფორმატი ───
const GEO_MONTHS = [
  "იანვარი","თებერვალი","მარტი","აპრილი","მაისი","ივნისი",
  "ივლისი","აგვისტო","სექტემბერი","ოქტომბერი","ნოემბერი","დეკემბერი",
];
const GEO_MONTHS_SHORT = [
  "იან","თებ","მარ","აპრ","მაი","ივნ",
  "ივლ","აგვ","სექ","ოქტ","ნოე","დეკ",
];

export function formatDate(dateStr, short = false) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const months = short ? GEO_MONTHS_SHORT : GEO_MONTHS;
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

export function formatDateTime(dateStr, timeStr) {
  const date = formatDate(dateStr);
  if (!timeStr) return date;
  return `${date}, ${timeStr}`;
}

export function formatDateFull(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return `${d.getDate()} ${GEO_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function isToday(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr).toDateString() === new Date().toDateString();
}

export function isTomorrow(dateStr) {
  if (!dateStr) return false;
  const tom = new Date();
  tom.setDate(tom.getDate() + 1);
  return new Date(dateStr).toDateString() === tom.toDateString();
}

export function isWeekend(dateStr) {
  if (!dateStr) return false;
  const day = new Date(dateStr).getDay();
  return day === 0 || day === 6;
}

// ─── ფასის ფორმატი ───
export function formatPrice(amount, currency = "₾") {
  if (amount == null) return "—";
  return `${Number(amount).toLocaleString("ka-GE")} ${currency}`;
}

// ─── ვარსკვლავები ───
export function renderStars(rating, max = 5) {
  const full  = Math.floor(rating ?? 0);
  const empty = max - full;
  return "★".repeat(full) + "☆".repeat(empty);
}

// ─── სტატუსი → ქართული + ფერი ───
export function getStatusStyle(status) {
  const map = {
    pending:   { label: "მოლოდინი",    className: "badge-blue" },
    confirmed: { label: "დადასტ.",      className: "badge-green" },
    done:      { label: "დასრულდა",    className: "badge-gray" },
    cancelled: { label: "გაუქმდა",     className: "bg-red-50 text-red-700 badge" },
  };
  return map[status] ?? { label: status, className: "badge-gray" };
}

// ─── Role → ქართული ───
export function getRoleLabel(role) {
  const map = {
    student: "🎓 სტუდენტი",
    tutor:   "👨‍🏫 მასწავლებელი",
    parent:  "👨‍👩‍👧 მშობელი",
    admin:   "🔐 Admin",
  };
  return map[role] ?? role;
}

// ─── Role → Dashboard URL ───
export function getDashboardUrl(role) {
  const map = {
    student: "/dashboard/student",
    tutor:   "/dashboard/tutor",
    parent:  "/dashboard/parent",
    admin:   "/dashboard/admin",
  };
  return map[role] ?? "/dashboard/student";
}

// ─── დროის გასვლა (time ago) ───
export function timeAgo(dateStr) {
  if (!dateStr) return "—";
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)   return "ახლახანს";
  if (diff < 3600) return `${Math.floor(diff / 60)} წთ წინ`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} სთ წინ`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} დღის წინ`;
  return formatDate(dateStr);
}

// ─── ფაილის ზომა ───
export function formatFileSize(bytes) {
  if (!bytes) return "0 B";
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1048576)     return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// ─── Avatar ფერი index-ის მიხედვით ───
const AVATAR_COLORS = ["avatar-green","avatar-blue","avatar-amber","avatar-purple","avatar-coral"];
export function getAvatarColor(index = 0) {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

// ─── truncate ───
export function truncate(text, maxLength = 80) {
  if (!text) return "";
  return text.length > maxLength ? text.slice(0, maxLength) + "..." : text;
}