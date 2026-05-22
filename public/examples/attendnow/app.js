/**
 * AttendNow MVP — Day 04 class demo (localStorage, no backend server).
 */
const STORAGE_KEY = "attendnow_records_v1";

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveData(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function initials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatTime(isoOrDate) {
  try {
    const d = new Date(isoOrDate);
    return d.toLocaleTimeString("en-NG", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "—";
  }
}

function roleLabel(role) {
  return role === "worker" ? "Worker" : "Student";
}

function avatarClass(role) {
  return role === "worker" ? "att-avatar--worker" : "att-avatar--student";
}

function badgeClass(status) {
  if (status === "absent") return "att-badge--absent";
  if (status === "late") return "att-badge--late";
  return "att-badge--present";
}

function getFilterState() {
  const search = (document.getElementById("input-search")?.value || "")
    .trim()
    .toLowerCase();
  const status = document.getElementById("input-filter-status")?.value || "all";
  return { search, status };
}

function filterRecords(records) {
  const { search, status } = getFilterState();
  return records.filter((r) => {
    if (status !== "all" && r.status !== status) return false;
    if (!search) return true;
    const hay = `${r.fullName} ${r.group} ${r.role}`.toLowerCase();
    return hay.includes(search);
  });
}

function renderList(records) {
  const root = document.getElementById("list-root");
  if (!root) return;

  const filtered = filterRecords(records);

  if (!filtered.length) {
    const hasAny = records.length > 0;
    root.innerHTML = `<li class="att-item" style="grid-template-columns:1fr;text-align:center;padding:24px">
      <div class="att-info">
        <div class="att-name">${hasAny ? "No matches for this filter" : "No attendance yet"}</div>
        <div class="att-meta">${hasAny ? "Try another search or filter." : "Mark someone present using the form above."}</div>
      </div>
    </li>`;
    return;
  }

  root.innerHTML = filtered
    .slice()
    .reverse()
    .map((r, i) => {
      const meta =
        `${roleLabel(r.role)} · ${escapeHtml(r.group)} · ${r.status === "absent" ? "—" : formatTime(r.timeMarked)}`;
      return `<li class="att-item" style="animation-delay:${(i * 0.07).toFixed(2)}s">
        <span class="att-avatar ${avatarClass(r.role)}" aria-hidden="true">${escapeHtml(initials(r.fullName))}</span>
        <div class="att-info">
          <div class="att-name">${escapeHtml(r.fullName)}</div>
          <div class="att-meta">${meta}</div>
        </div>
        <span class="att-badge ${badgeClass(r.status)}" role="status">${escapeHtml(r.status)}</span>
      </li>`;
    })
    .join("");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function recordsForToday(records) {
  const t = todayISO();
  return records.filter((r) => r.date === t);
}

function updateHeroStats(records) {
  const today = recordsForToday(records);
  const present = today.filter((r) => r.status === "present").length;
  const absent = today.filter((r) => r.status === "absent").length;
  const late = today.filter((r) => r.status === "late").length;
  const total = today.length;

  const elTotal = document.getElementById("stat-total");
  const elPresent = document.getElementById("stat-present");
  const elAbsent = document.getElementById("stat-absent");
  if (elTotal) elTotal.textContent = String(total);
  if (elPresent) elPresent.textContent = String(present + late);
  if (elAbsent) elAbsent.textContent = String(absent);
}

function renderInsights(records) {
  const today = recordsForToday(records);
  const present = today.filter((r) => r.status === "present" || r.status === "late").length;
  const absent = today.filter((r) => r.status === "absent").length;
  const total = today.length;
  const rate = total ? Math.round((present / total) * 100) : 0;

  const elRate = document.getElementById("insight-rate");
  const elStreak = document.getElementById("insight-streak");
  const elAbsent = document.getElementById("insight-absent");
  const elBars = document.getElementById("insight-bars");

  if (elRate) elRate.textContent = total ? `${rate}%` : "—";
  if (elStreak) elStreak.textContent = String(computeStreakDays(records));
  if (elAbsent) elAbsent.textContent = String(absent);

  if (elBars) {
    const bars = elBars.querySelectorAll(".mini-bar");
    const last5 = lastNDaysCounts(records, 5);
    const max = Math.max(1, ...last5);
    bars.forEach((bar, i) => {
      const h = Math.round((last5[i] / max) * 100);
      bar.style.height = `${Math.max(8, h)}%`;
    });
  }
}

function computeStreakDays(records) {
  const daysWithData = new Set(records.map((r) => r.date).filter(Boolean));
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 14; i++) {
    const key = d.toISOString().slice(0, 10);
    if (daysWithData.has(key)) streak++;
    else if (i > 0) break;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function lastNDaysCounts(records, n) {
  const counts = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const day = new Date(d);
    day.setDate(d.getDate() - i);
    const key = day.toISOString().slice(0, 10);
    counts.push(records.filter((r) => r.date === key).length);
  }
  return counts;
}

function renderAll() {
  const records = loadData();
  renderList(records);
  updateHeroStats(records);
  renderInsights(records);
}

function validateForm() {
  const name = document.getElementById("input-name")?.value.trim();
  const role = document.getElementById("input-role")?.value.trim();
  const group = document.getElementById("input-class")?.value.trim();
  const date = document.getElementById("input-date")?.value.trim();
  if (!name || !role || !group || !date) {
    alert("Please fill name, role, class/department, and date.");
    return null;
  }
  return { name, role, group, date };
}

function markPresent() {
  const v = validateForm();
  if (!v) return;

  const records = loadData();
  const now = new Date();
  records.push({
    id: `rec_${now.getTime()}`,
    fullName: v.name,
    role: v.role,
    group: v.group,
    date: v.date,
    status: "present",
    timeMarked: now.toISOString(),
  });
  saveData(records);

  document.getElementById("input-name")?.focus();
  renderAll();
}

function wireForm() {
  const form = document.querySelector(".hero__form");
  const btn = document.getElementById("btn-primary");

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      markPresent();
    });
  }
  if (btn) {
    btn.addEventListener("click", (e) => {
      if (form && e.target.closest("form")) return;
      e.preventDefault();
      markPresent();
    });
  }
}

function wireFilters() {
  const search = document.getElementById("input-search");
  const status = document.getElementById("input-filter-status");
  const rerender = () => renderList(loadData());
  search?.addEventListener("input", rerender);
  status?.addEventListener("change", rerender);
}

function wireExport() {
  const btn = document.getElementById("export-btn");
  if (!btn) return;
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    const data = JSON.stringify(loadData(), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendnow-export-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

function seedDemoIfEmpty() {
  if (loadData().length) return;
  const today = todayISO();
  saveData([
    {
      id: "demo_1",
      fullName: "Amara Okonkwo",
      role: "student",
      group: "JSS 3A",
      date: today,
      status: "present",
      timeMarked: new Date().toISOString(),
    },
    {
      id: "demo_2",
      fullName: "Taiwo Usman",
      role: "worker",
      group: "Finance",
      date: today,
      status: "late",
      timeMarked: new Date().toISOString(),
    },
  ]);
}

function init() {
  const dateInput = document.getElementById("input-date");
  if (dateInput && !dateInput.value) dateInput.value = todayISO();

  const yearEl = document.getElementById("footer-year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  seedDemoIfEmpty();
  wireForm();
  wireFilters();
  wireExport();
  renderAll();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
