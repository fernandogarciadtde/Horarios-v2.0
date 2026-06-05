const dayNames = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
const monthNames = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const options = {
  assign: { shift: null, mode: "pending", label: "Asignar", code: "ASIGNAR", className: "status-assign" },
  "A-onsite": { shift: "A", mode: "onsite", label: "Turno A presencial", code: "A", className: "status-onsite" },
  "B-onsite": { shift: "B", mode: "onsite", label: "Turno B presencial", code: "B", className: "status-onsite" },
  "A-remote": { shift: "A", mode: "remote", label: "Turno A remoto", code: "A-R", className: "status-remote" },
  "B-remote": { shift: "B", mode: "remote", label: "Turno B remoto", code: "B-R", className: "status-remote" },
  "A-onsite-union": { shift: "A", mode: "onsite", label: "Turno A presencial + salida sindicato", code: "A-S", className: "status-union" },
  "B-onsite-union": { shift: "B", mode: "onsite", label: "Turno B presencial + salida sindicato", code: "B-S", className: "status-union" },
  "A-remote-union": { shift: "A", mode: "remote", label: "Turno A remoto + salida sindicato", code: "A-RS", className: "status-union" },
  "B-remote-union": { shift: "B", mode: "remote", label: "Turno B remoto + salida sindicato", code: "B-RS", className: "status-union" },
  admin: { shift: null, mode: "absent", label: "Administrativo", code: "ADM", className: "status-admin" },
  admin_morning: { shift: "A", mode: "admin", label: "ADM A mañana", code: "ADM A", className: "status-admin-partial" },
  admin_afternoon: { shift: "B", mode: "admin", label: "ADM B tarde", code: "ADM B", className: "status-admin-partial" },
  medical: { shift: null, mode: "absent", label: "Licencia médica", code: "LM", className: "status-medical" },
  holiday: { shift: null, mode: "closed", label: "Feriado", code: "FERIADO", className: "status-holiday" },
  recess: { shift: null, mode: "closed", label: "Receso institucional", code: "RECESO", className: "status-recess" },
};

const suggestibleStatuses = new Set(["A-onsite", "B-onsite", "A-remote", "B-remote"]);

let state = null;
let currentUser = null;
let saveTimer = null;
let eventsBound = false;
let selectedCell = null;
let users = [];
let selectedResetUserId = null;
let calendarViewMode = "month";
let selectedWeekKey = "";
let currentPage = "calendar";
let showWeeklyNotifications = true;
const undoHistory = [];
const collapsedWeeks = new Set();
const maxPhotoSize = 240;
let renderWeeklyIssues = null;
let renderWeeklyNotifications = null;
let calendarRenderToken = 0;

const el = {
  appShell: document.querySelector("#appShell"),
  adminShell: document.querySelector("#adminShell"),
  sessionAvatar: document.querySelector("#sessionAvatar"),
  sessionRole: document.querySelector("#sessionRole"),
  sessionName: document.querySelector("#sessionName"),
  adminNavBtn: document.querySelector("#adminNavBtn"),
  calendarNavBtn: document.querySelector("#calendarNavBtn"),
  profilePhotoInput: document.querySelector("#profilePhotoInput"),
  profilePhotoBtn: document.querySelector("#profilePhotoBtn"),
  passwordBtn: document.querySelector("#passwordBtn"),
  logoutBtn: document.querySelector("#logoutBtn"),
  passwordDialog: document.querySelector("#passwordDialog"),
  currentPasswordInput: document.querySelector("#currentPasswordInput"),
  newPasswordInput: document.querySelector("#newPasswordInput"),
  passwordMessage: document.querySelector("#passwordMessage"),
  savePasswordBtn: document.querySelector("#savePasswordBtn"),
  resetPasswordDialog: document.querySelector("#resetPasswordDialog"),
  resetPasswordTitle: document.querySelector("#resetPasswordTitle"),
  adminPasswordInput: document.querySelector("#adminPasswordInput"),
  resetPasswordMessage: document.querySelector("#resetPasswordMessage"),
  saveResetPasswordBtn: document.querySelector("#saveResetPasswordBtn"),
  monthSelect: document.querySelector("#monthSelect"),
  yearInput: document.querySelector("#yearInput"),
  calendarViewMode: document.querySelector("#calendarViewMode"),
  weekSelect: document.querySelector("#weekSelect"),
  weekSelectLabel: document.querySelector("#weekSelectLabel"),
  generateBtn: document.querySelector("#generateBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  addAgentBtn: document.querySelector("#addAgentBtn"),
  agentsList: document.querySelector("#agentsList"),
  rulesPanel: document.querySelector("#rulesPanel"),
  calendarView: document.querySelector("#calendarView"),
  specialDateInput: document.querySelector("#specialDateInput"),
  specialTypeInput: document.querySelector("#specialTypeInput"),
  addSpecialBtn: document.querySelector("#addSpecialBtn"),
  specialDaysList: document.querySelector("#specialDaysList"),
  lockAgentInput: document.querySelector("#lockAgentInput"),
  lockDayInput: document.querySelector("#lockDayInput"),
  lockModeInput: document.querySelector("#lockModeInput"),
  addLockBtn: document.querySelector("#addLockBtn"),
  locksList: document.querySelector("#locksList"),
  absenceAgentInput: document.querySelector("#absenceAgentInput"),
  absenceTypeInput: document.querySelector("#absenceTypeInput"),
  absenceFromInput: document.querySelector("#absenceFromInput"),
  absenceToInput: document.querySelector("#absenceToInput"),
  absenceIndefInput: document.querySelector("#absenceIndefInput"),
  addAbsenceBtn: document.querySelector("#addAbsenceBtn"),
  absencesList: document.querySelector("#absencesList"),
  cellDialog: document.querySelector("#cellDialog"),
  modalDate: document.querySelector("#modalDate"),
  modalAgent: document.querySelector("#modalAgent"),
  cellStatusInput: document.querySelector("#cellStatusInput"),
  cellLockedInput: document.querySelector("#cellLockedInput"),
  saveCellBtn: document.querySelector("#saveCellBtn"),
  backTopBtn: document.querySelector("#backTopBtn"),
  adminOnly: document.querySelectorAll("[data-admin-only]"),
};

async function loadState() {
  const response = await fetch("/api/state");
  if (response.status === 401) {
    redirectToLogin();
    return null;
  }
  if (!response.ok) throw new Error("No se pudo cargar el calendario compartido.");
  const payload = await response.json();
  currentUser = payload.user;
  return payload.state;
}

function saveState() {
  if (!canEdit() || !state) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const response = await fetch("/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      showRulesError(payload.error || "No se pudo guardar en la base de datos.");
    }
  }, 250);
}

async function init() {
  monthNames.forEach((name, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = name;
    el.monthSelect.append(option);
  });
  bindAccountEvents();
  bindEvents();
  const session = await fetch("/api/session").then((res) => res.json()).catch(() => ({ user: null }));
  if (!session.user) {
    redirectToLogin();
    return;
  }
  currentUser = session.user;
  state = await loadState();
  if (!state) return;
  el.monthSelect.value = state.month;
  el.yearInput.value = state.year;
  if (!Object.keys(state.schedule).length && canEdit()) generateSchedule();
  if (canEdit()) await loadUsers();
  render();
}

function bindAccountEvents() {
  el.passwordBtn.addEventListener("click", () => {
    el.passwordMessage.textContent = "";
    el.currentPasswordInput.value = "";
    el.newPasswordInput.value = "";
    el.passwordDialog.showModal();
  });

  el.savePasswordBtn.addEventListener("click", savePassword);
  el.saveResetPasswordBtn.addEventListener("click", saveAdminResetPassword);
  el.profilePhotoBtn?.addEventListener("click", () => el.profilePhotoInput?.click());
  el.profilePhotoInput?.addEventListener("change", saveCurrentUserPhoto);
  el.adminNavBtn?.addEventListener("click", () => {
    if (!canEdit()) return;
    currentPage = "admin";
    render();
  });
  el.calendarNavBtn?.addEventListener("click", () => {
    currentPage = "calendar";
    render();
  });

  el.logoutBtn.addEventListener("click", async () => {
    await fetch("/api/logout", { method: "POST" });
    currentUser = null;
    state = null;
    redirectToLogin();
  });
}

function redirectToLogin() {
  const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
  window.location.replace(`/login.html?next=${next}`);
}

function showApp() {
  const editable = canEdit();
  if (!editable && currentPage === "admin") currentPage = "calendar";
  el.appShell.hidden = currentPage !== "calendar";
  if (el.adminShell) el.adminShell.hidden = currentPage !== "admin" || !editable;
  el.appShell.classList.toggle("readonly", !editable);
  el.sessionName.textContent = currentUser?.name || "Usuario";
  el.sessionRole.textContent = roleLabel(currentUser?.role);
  if (el.sessionAvatar) el.sessionAvatar.innerHTML = avatarContentHtml(currentProfilePerson());
  if (el.adminNavBtn) el.adminNavBtn.hidden = !editable;
  if (el.profilePhotoBtn) el.profilePhotoBtn.hidden = !canEditProfilePhoto();
  if (el.profilePhotoInput) el.profilePhotoInput.disabled = !canEditProfilePhoto();
  el.adminOnly.forEach((node) => {
    node.hidden = !editable;
  });
  if (currentUser?.mustChangePassword) {
    setTimeout(() => el.passwordBtn.click(), 250);
  }
}

function canEdit() {
  return currentUser?.role === "admin" || currentUser?.id === "admin-cristopher";
}

function canEditProfilePhoto() {
  return currentUser?.id === "admin-cristopher";
}

function currentProfilePerson() {
  if (!currentUser) return {};
  if (currentUser.role === "tutor") {
    const agent = state?.agents?.find((item) => normalizeName(item.name) === normalizeName(currentUser.name));
    if (agent?.photo) return { ...currentUser, photo: agent.photo };
  }
  return currentUser;
}

function roleLabel(role) {
  const labels = {
    admin: "Administrador",
    tutor: "Tutor",
  };
  return labels[role] || "Consulta";
}

function bindEvents() {
  if (eventsBound) return;
  eventsBound = true;
  el.monthSelect.addEventListener("change", () => {
    if (!canEdit()) return;
    pushUndoSnapshot();
    state.month = Number(el.monthSelect.value);
    generateSchedule();
  });
  el.yearInput.addEventListener("change", () => {
    if (!canEdit()) return;
    pushUndoSnapshot();
    state.year = Number(el.yearInput.value);
    generateSchedule();
  });
  el.calendarViewMode.addEventListener("change", () => {
    calendarViewMode = el.calendarViewMode.value;
    render();
  });
  el.weekSelect.addEventListener("change", () => {
    selectedWeekKey = el.weekSelect.value;
    render();
  });
  el.generateBtn?.addEventListener("click", generateSchedule);
  el.resetBtn.addEventListener("click", async () => {
    if (!canEdit()) return;
    if (!confirm("¿Restaurar agentes y configuración inicial?")) return;
    pushUndoSnapshot();
    const response = await fetch("/api/reset-state", { method: "POST" });
    const payload = await response.json();
    state = payload.state;
    generateSchedule();
  });
  el.addAgentBtn.addEventListener("click", () => {
    if (!canEdit()) return;
    pushUndoSnapshot();
    state.agents.push({ id: crypto.randomUUID(), name: "Nuevo agente", order: state.agents.length, photo: "" });
    generateSchedule();
  });
  el.addSpecialBtn.addEventListener("click", addSpecialDay);
  el.addLockBtn.addEventListener("click", addRecurringLock);
  el.addAbsenceBtn.addEventListener("click", addAbsence);
  el.saveCellBtn.addEventListener("click", saveCellEdit);
  el.backTopBtn?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  window.addEventListener("scroll", updateBackTopButton, { passive: true });
  window.addEventListener("resize", updateBackTopButton);
  updateBackTopButton();
}

function updateBackTopButton() {
  if (!el.backTopBtn) return;
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const progress = Math.min(1, Math.max(0, window.scrollY / maxScroll));
  const parallaxOffset = Math.round((1 - progress) * 18);
  el.backTopBtn.style.setProperty("--back-top-offset", `${parallaxOffset}px`);
  el.backTopBtn.classList.toggle("is-visible", progress >= 0.9);
}

async function loadUsers() {
  const response = await fetch("/api/users");
  if (!response.ok) return;
  const payload = await response.json();
  users = payload.users || [];
}

async function savePassword(event) {
  event.preventDefault();
  el.passwordMessage.textContent = "";
  const response = await fetch("/api/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      currentPassword: el.currentPasswordInput.value,
      newPassword: el.newPasswordInput.value,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    el.passwordMessage.textContent = payload.error || "No se pudo cambiar la contraseña.";
    return;
  }
  currentUser = payload.user;
  el.passwordDialog.close();
  render();
}

function openResetPassword(userId) {
  selectedResetUserId = userId;
  const user = users.find((item) => item.id === userId);
  el.resetPasswordTitle.textContent = `Resetear contraseña: ${user?.name || "usuario"}`;
  el.adminPasswordInput.value = "";
  el.resetPasswordMessage.textContent = "";
  el.resetPasswordDialog.showModal();
}

async function saveAdminResetPassword(event) {
  event.preventDefault();
  if (!selectedResetUserId) return;
  const response = await fetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: selectedResetUserId, newPassword: el.adminPasswordInput.value }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    el.resetPasswordMessage.textContent = payload.error || "No se pudo resetear la contraseña.";
    return;
  }
  await loadUsers();
  el.resetPasswordDialog.close();
  renderAgents();
}

function generateSchedule(onlyWeekKey = null) {
  if (!canEdit()) return;
  if (typeof onlyWeekKey !== "string") onlyWeekKey = null;
  const previousSchedule = state.schedule || {};
  const weeks = getMonthWeeks(state.year, state.month);
  const schedule = {};
  const fridayB = new Map(state.agents.map((agent) => [agent.id, 0]));

  weeks.forEach((week, weekIndex) => {
    const weekKey = dateKey(week[0]);
    schedule[weekKey] = {};
    state.agents.forEach((agent) => {
      schedule[weekKey][agent.id] = {};
      week.forEach((date) => {
        const key = dateKey(date);
        const special = specialFor(key);
        const absence = absenceFor(agent.id, key);
        const recurringLock = state.recurringLocks.find((lock) => lock.agentId === agent.id && lock.day === isoDay(date));
        let cell = { status: "A-onsite", locked: false, note: "" };

        if (special?.type === "mandatory" && absence?.type === "medical") cell = { status: "medical", locked: true, note: absenceLabel("medical") };
        else if (special?.type === "mandatory") cell = { status: "A-onsite", locked: true, note: "Asistencia obligatoria" };
        else if (isClosedSpecial(special)) cell = { status: special.type, locked: true, note: specialLabel(special.type) };
        else if (absence) cell = { status: absence.type, locked: true, note: absenceLabel(absence.type) };
        else if (recurringLock) cell = { status: recurringLockStatus(recurringLock), locked: true, note: "Bloqueo recurrente" };
        schedule[weekKey][agent.id][key] = cell;
      });
    });

    balanceMandatoryDayShifts(schedule, weekKey, week, weekIndex);
    const friday = week.find((date) => isoDay(date) === 5);
    if (friday) assignMonthlyFridayB(schedule, weekKey, friday, fridayB, weekIndex);
    state.agents.forEach((agent, agentIndex) => assignWeeklyB(schedule, weekKey, week, agent, agentIndex, weekIndex));
    balanceDailyShiftDistribution(schedule, weekKey, week, weekIndex);
    state.agents.forEach((agent, agentIndex) => assignWeeklyRemote(schedule, weekKey, week, agent, agentIndex, weekIndex));
  });

  applyManualOverrides(schedule);
  balanceMonthlyFridayB(schedule);
  balanceAllDailyShiftDistribution(schedule);
  enforceDailyOnsiteCoverage(schedule);
  fillWeeklyRemoteTargets(schedule);
  rebalanceWeeklyTargets(schedule);
  balanceMonthlyFridayB(schedule);
  fillWeeklyRemoteTargets(schedule);
  rebalanceWeeklyTargets(schedule);
  ensureMinimumDailyRemote(schedule);

  if (onlyWeekKey) {
    Object.entries(previousSchedule).forEach(([weekKey, weekByAgent]) => {
      if (weekKey !== onlyWeekKey) schedule[weekKey] = weekByAgent;
    });
  }

  lockExpiredDays(schedule, previousSchedule);

  state.schedule = schedule;
  saveState();
  renderScheduleUpdate(onlyWeekKey);
}

function assignMonthlyFridayB(schedule, weekKey, friday, fridayB, weekIndex) {
  const dayKey = dateKey(friday);
  const activeAgents = activeAgentsForDay(schedule, weekKey, dayKey);
  if (!activeAgents.length) return;
  const minFridayB = Math.min(...activeAgents.map((agent) => fridayB.get(agent.id) || 0));
  const candidates = activeAgents.filter((agent) => (fridayB.get(agent.id) || 0) === minFridayB);
  if (!candidates.length) return;
  const target = candidates[weekIndex % candidates.length];
  setShift(schedule[weekKey][target.id][dayKey], "B");
  setMode(schedule[weekKey][target.id][dayKey], "onsite");
  fridayB.set(target.id, (fridayB.get(target.id) || 0) + 1);
}

function applyManualOverrides(schedule) {
  Object.entries(state.manualOverrides || {}).forEach(([key, override]) => {
    const [weekKey, agentId, dayKey] = key.split("|");
    if (isExpiredDay(dayKey)) return;
    const special = specialFor(dayKey);
    const source = override.source || (override.note === "Bloqueo manual" ? "future-lock" : "manual");
    if (special && override.status === "assign") return;
    if (special && source === "future-lock" && override.status !== "medical") return;
    if (schedule[weekKey]?.[agentId]?.[dayKey]) {
      schedule[weekKey][agentId][dayKey] = { ...schedule[weekKey][agentId][dayKey], ...mandatoryOverride(special, override) };
    }
  });
}

function mandatoryOverride(special, override) {
  if (special?.type !== "mandatory" || override.status === "medical") return override;
  const shift = getShift({ status: override.status }) || "A";
  return {
    ...override,
    status: `${shift}-onsite`,
    locked: true,
    note: "Asistencia obligatoria",
  };
}

function recurringLockStatus(lock) {
  if (lock?.mode === "remote") return "A-remote";
  if (lock?.mode === "onsite") return "A-onsite";
  return options[lock?.mode] ? lock.mode : "A-onsite";
}

function assignWeeklyB(schedule, weekKey, week, agent, agentIndex, weekIndex) {
  let count = week.filter((date) => isWorkShift(schedule[weekKey][agent.id][dateKey(date)], "B")).length;
  const preferred = [...week].sort((a, b) => rotationScore(a, agentIndex, weekIndex, "B") - rotationScore(b, agentIndex, weekIndex, "B"));
  for (const date of preferred) {
    if (count >= 2) break;
    const key = dateKey(date);
    const cell = schedule[weekKey][agent.id][key];
    if (!canAdjustWorkCell(cell)) continue;
    if (isWorkShift(cell, "B")) continue;
    setShift(cell, "B");
    count += 1;
  }
}

function assignWeeklyRemote(schedule, weekKey, week, agent, agentIndex, weekIndex) {
  let count = week.filter((date) => getMode(schedule[weekKey][agent.id][dateKey(date)]) === "remote").length;
  const target = weeklyRemoteTarget(schedule, weekKey, week, agent.id, weekIndex);
  const preferred = [...week].sort((a, b) => {
    const scoreA = remoteScore(a, agentIndex, weekIndex);
    const scoreB = remoteScore(b, agentIndex, weekIndex);
    return scoreA - scoreB;
  });
  for (const date of preferred) {
    if (count >= target) break;
    const key = dateKey(date);
    const cell = schedule[weekKey][agent.id][key];
    if (!canAdjustWorkCell(cell) || cell.note === "Asistencia obligatoria") continue;
    if (!hasRemoteCapacityForDay(schedule, weekKey, key, agent.id)) continue;
    if (getMode(cell) === "remote") continue;
    if (isoDay(date) === 5 && isOnsiteShift(cell, "B")) continue;
    setMode(cell, "remote");
    count += 1;
  }
}

function weeklyRemoteTarget(schedule, weekKey, week, agentId, weekIndex) {
  const remoteEligibleDays = week.filter((date) => {
    const cell = schedule[weekKey]?.[agentId]?.[dateKey(date)];
    return isEditableWorkCell(cell) && cell.note !== "Asistencia obligatoria";
  }).length;
  if (!remoteEligibleDays) return 0;
  if (weeklyOperationalDays(week) <= 3) return Math.min(1, remoteEligibleDays);
  return Math.min(2, remoteEligibleDays);
}

function weeklyOperationalDays(week) {
  return week.filter((date) => {
    const special = specialFor(dateKey(date));
    return !isClosedSpecial(special);
  }).length;
}

function dailyRemoteCapacity(schedule, weekKey, dayKey) {
  return dailyRemoteShiftCapacity(schedule, weekKey, dayKey, "A") + dailyRemoteShiftCapacity(schedule, weekKey, dayKey, "B");
}

function dailyRemoteShiftCapacity(schedule, weekKey, dayKey, shift) {
  const shiftCount = state.agents.filter((agent) => {
    const cell = schedule[weekKey]?.[agent.id]?.[dayKey];
    return isEditableWorkCell(cell) && getShift(cell) === shift;
  }).length;
  return Math.min(1, Math.max(0, shiftCount - 1));
}

function hasRemoteCapacityForDay(schedule, weekKey, dayKey, nextRemoteAgentId) {
  const nextCell = schedule[weekKey]?.[nextRemoteAgentId]?.[dayKey];
  const nextShift = getShift(nextCell);
  if (!nextShift) return false;
  const activeCells = state.agents
    .map((agent) => {
      const cell = schedule[weekKey]?.[agent.id]?.[dayKey];
      return agent.id === nextRemoteAgentId && isEditableWorkCell(cell) ? { status: buildStatus(getShift(cell), "remote", isUnionStatus(cell)) } : cell;
    })
    .filter(isEditableWorkCell);
  const remoteCount = activeCells.filter((cell) => getMode(cell) === "remote").length;
  const remoteShiftCount = activeCells.filter((cell) => getMode(cell) === "remote" && getShift(cell) === nextShift).length;
  return remoteCount <= dailyRemoteCapacity(schedule, weekKey, dayKey) && remoteShiftCount <= dailyRemoteShiftCapacity(schedule, weekKey, dayKey, nextShift);
}

function balanceMonthlyFridayB(schedule) {
  const assignments = monthlyFridayAssignments(schedule);
  const counts = new Map(state.agents.map((agent) => [agent.id, 0]));
  const fridayKeys = [...new Set(assignments.map((item) => item.dayKey))].sort();

  fridayKeys.forEach((dayKey, fridayIndex) => {
    const dayAssignments = assignments.filter((item) => item.dayKey === dayKey && isEditableWorkCell(item.cell));
    if (!dayAssignments.length) return;
    const lockedB = dayAssignments.filter((item) => isOnsiteShift(item.cell, "B") && !canAdjustWorkCell(item.cell));
    const target = lockedB[0] || preferredFridayBAssignment(dayAssignments, counts, fridayIndex);
    if (!target) return;

    dayAssignments.forEach((item) => {
      if (item.agent.id === target.agent.id) return;
      if (!isOnsiteShift(item.cell, "B") || !canAdjustWorkCell(item.cell)) return;
      item.cell.status = buildStatus("A", "onsite", isUnionStatus(item.cell));
    });

    if (!isOnsiteShift(target.cell, "B") && canAdjustWorkCell(target.cell)) {
      target.cell.status = buildStatus("B", "onsite", isUnionStatus(target.cell));
    }

    dayAssignments
      .filter((item) => isOnsiteShift(item.cell, "B"))
      .forEach((item) => {
        counts.set(item.agent.id, (counts.get(item.agent.id) || 0) + 1);
      });
  });

  return schedule;
}

function preferredFridayBAssignment(dayAssignments, counts, fridayIndex) {
  const candidates = dayAssignments.filter((item) => isOnsiteShift(item.cell, "B") || canAdjustWorkCell(item.cell));
  if (!candidates.length) return null;
  const minCount = Math.min(...candidates.map((item) => counts.get(item.agent.id) || 0));
  return candidates
    .filter((item) => (counts.get(item.agent.id) || 0) === minCount)
    .sort((a, b) => fridayRotationScore(a.agent, fridayIndex) - fridayRotationScore(b.agent, fridayIndex))[0];
}

function fridayRotationScore(agent, fridayIndex) {
  const agentCount = Math.max(1, state.agents.length);
  return ((agent.order || 0) + state.month + fridayIndex) % agentCount;
}

function monthlyFridayAssignments(schedule) {
  const assignments = [];
  getMonthWeeks(state.year, state.month).forEach((week) => {
    const weekKey = dateKey(week[0]);
    week.forEach((date) => {
      if (isoDay(date) !== 5 || date.getMonth() !== state.month) return;
      const dayKey = dateKey(date);
      state.agents.forEach((agent) => {
        const cell = schedule[weekKey]?.[agent.id]?.[dayKey];
        if (cell) assignments.push({ weekKey, dayKey, agent, cell });
      });
    });
  });
  return assignments;
}

function monthlyFridayBCounts(assignments) {
  const counts = new Map(state.agents.map((agent) => [agent.id, 0]));
  assignments.forEach(({ agent, cell }) => {
    if (isOnsiteShift(cell, "B")) counts.set(agent.id, (counts.get(agent.id) || 0) + 1);
  });
  return counts;
}

function monthlyFridayBCount(agentId, schedule) {
  return monthlyFridayBCounts(monthlyFridayAssignments(schedule)).get(agentId) || 0;
}

function balanceAllDailyShiftDistribution(schedule) {
  getMonthWeeks(state.year, state.month).forEach((week, weekIndex) => {
    balanceDailyShiftDistribution(schedule, dateKey(week[0]), week, weekIndex);
  });
}

function balanceDailyShiftDistribution(schedule, weekKey, week, weekIndex) {
  week.forEach((date) => {
    const dayKey = dateKey(date);
    const workCells = state.agents
      .map((agent, agentIndex) => ({ agent, agentIndex, cell: schedule[weekKey]?.[agent.id]?.[dayKey] }))
      .filter(({ cell }) => isEditableWorkCell(cell));
    if (workCells.length < 4) return;

    const targetB = Math.floor(workCells.length / 2);
    let bCount = workCells.filter(({ cell }) => getShift(cell) === "B").length;

    while (bCount < targetB) {
      const candidate = workCells
        .filter(({ cell }) => canAdjustWorkCell(cell) && getShift(cell) === "A")
        .sort((a, b) => {
          const aCount = weeklyShiftCount(schedule, weekKey, week, a.agent.id, "B");
          const bCountForAgent = weeklyShiftCount(schedule, weekKey, week, b.agent.id, "B");
          if (aCount !== bCountForAgent) return aCount - bCountForAgent;
          return rotationScore(date, a.agentIndex, weekIndex, "B") - rotationScore(date, b.agentIndex, weekIndex, "B");
        })[0];
      if (!candidate) break;
      setShift(candidate.cell, "B");
      bCount += 1;
    }

    while (bCount > targetB) {
      const candidate = workCells
        .filter(({ cell }) => canAdjustWorkCell(cell) && getShift(cell) === "B")
        .sort((a, b) => {
          const aCount = weeklyShiftCount(schedule, weekKey, week, a.agent.id, "B");
          const bCountForAgent = weeklyShiftCount(schedule, weekKey, week, b.agent.id, "B");
          if (aCount !== bCountForAgent) return bCountForAgent - aCount;
          return rotationScore(date, a.agentIndex, weekIndex, "A") - rotationScore(date, b.agentIndex, weekIndex, "A");
        })[0];
      if (!candidate) break;
      setShift(candidate.cell, "A");
      bCount -= 1;
    }
  });
}

function balanceMandatoryDayShifts(schedule, weekKey, week, weekIndex) {
  week.forEach((date) => {
    const dayKey = dateKey(date);
    if (specialFor(dayKey)?.type !== "mandatory") return;
    const cells = state.agents
      .map((agent, agentIndex) => ({ agent, agentIndex, cell: schedule[weekKey]?.[agent.id]?.[dayKey] }))
      .filter(({ cell }) => cell?.note === "Asistencia obligatoria" && isEditableWorkCell(cell));
    if (cells.length < 2) return;
    cells
      .sort((a, b) => rotationScore(date, a.agentIndex, weekIndex, "B") - rotationScore(date, b.agentIndex, weekIndex, "B"))
      .forEach((item, index) => {
        const shift = index < Math.floor(cells.length / 2) ? "B" : "A";
        item.cell.status = `${shift}-onsite`;
        item.cell.locked = true;
        item.cell.note = "Asistencia obligatoria";
      });
  });
}

function enforceDailyOnsiteCoverage(schedule) {
  getMonthWeeks(state.year, state.month).forEach((week, weekIndex) => {
    const weekKey = dateKey(week[0]);
    week.forEach((date) => {
      const dayKey = dateKey(date);
      const cells = state.agents.map((agent, agentIndex) => ({
        agent,
        agentIndex,
        cell: schedule[weekKey]?.[agent.id]?.[dayKey],
      }));
      if (cells.every(({ cell }) => isClosedCell(cell))) return;
      ensureOnsiteShift(schedule, cells, "B", weekIndex, date);
      const bOnsiteAgent = cells.find(({ cell }) => getShift(cell) === "B" && getMode(cell) === "onsite")?.agent.id;
      ensureOnsiteShift(schedule, cells, "A", weekIndex, date, bOnsiteAgent);
    });
  });
}

function ensureOnsiteShift(schedule, cells, shift, weekIndex, date, excludedAgentId = null) {
  const hasCoverage = cells.some(({ agent, cell }) => agent.id !== excludedAgentId && getShift(cell) === shift && getMode(cell) === "onsite");
  if (hasCoverage) return;
  const candidate = cells
    .filter(({ agent, cell }) => agent.id !== excludedAgentId && canAdjustWorkCell(cell))
    .sort((a, b) => {
      const aCount = monthlyOnsiteShiftCount(a.agent.id, shift, schedule);
      const bCount = monthlyOnsiteShiftCount(b.agent.id, shift, schedule);
      if (aCount !== bCount) return aCount - bCount;
      return rotationScore(date, a.agentIndex, weekIndex, shift) - rotationScore(date, b.agentIndex, weekIndex, shift);
    })[0];
  if (!candidate) return;
  candidate.cell.status = buildStatus(shift, "onsite", isUnionStatus(candidate.cell));
  candidate.cell.note = candidate.cell.note || "Ajuste por cobertura presencial";
}

function rebalanceWeeklyTargets(schedule) {
  getMonthWeeks(state.year, state.month).forEach((week, weekIndex) => {
    const weekKey = dateKey(week[0]);

    state.agents.forEach((agent) => {
      let bCount = week.filter((date) => isWorkShift(schedule[weekKey][agent.id][dateKey(date)], "B")).length;
      let remoteCount = week.filter((date) => getMode(schedule[weekKey][agent.id][dateKey(date)]) === "remote").length;
      const remoteTarget = weeklyRemoteTarget(schedule, weekKey, week, agent.id, weekIndex);
      const bTarget = weeklyBTarget(schedule, weekKey, week, agent.id);

      for (const date of week) {
        if (bCount <= bTarget) break;
        const cell = schedule[weekKey][agent.id][dateKey(date)];
        if (canAdjustWorkCell(cell) && isWorkShift(cell, "B") && canKeepDailyCoverageAfterChange(schedule, weekKey, dateKey(date), agent.id, "A", getMode(cell), isUnionStatus(cell))) {
          setShift(cell, "A");
          bCount -= 1;
        }
      }

      for (const date of week) {
        if (remoteCount <= remoteTarget) break;
        const cell = schedule[weekKey][agent.id][dateKey(date)];
        if (canAdjustWorkCell(cell) && getMode(cell) === "remote" && canKeepDailyCoverageAfterChange(schedule, weekKey, dateKey(date), agent.id, getShift(cell), "onsite", isUnionStatus(cell))) {
          setMode(cell, "onsite");
          remoteCount -= 1;
        }
      }
    });

    rebalanceDailyRemoteShifts(schedule, weekKey, week);
  });
}

function ensureMinimumDailyRemote(schedule) {
  getMonthWeeks(state.year, state.month).forEach((week, weekIndex) => {
    const weekKey = dateKey(week[0]);
    week.forEach((date) => {
      const dayKey = dateKey(date);
      const special = specialFor(dayKey);
      if (isExpiredDay(dayKey) || special?.type === "mandatory" || isClosedSpecial(special)) return;
      const activeCells = state.agents
        .map((agent, agentIndex) => ({ agent, agentIndex, cell: schedule[weekKey]?.[agent.id]?.[dayKey] }))
        .filter(({ cell }) => isEditableWorkCell(cell));
      if (activeCells.length < 2 || activeCells.some(({ cell }) => getMode(cell) === "remote")) return;
      const candidate = activeCells
        .filter(({ agent, cell }) => {
          if (!canAdjustWorkCell(cell)) return false;
          if (!hasRemoteCapacityForDay(schedule, weekKey, dayKey, agent.id)) return false;
          return canKeepDailyCoverageAfterChange(schedule, weekKey, dayKey, agent.id, getShift(cell), "remote", isUnionStatus(cell));
        })
        .sort((a, b) => {
          const aRemote = weeklyRemoteCount(schedule, weekKey, week, a.agent.id);
          const bRemote = weeklyRemoteCount(schedule, weekKey, week, b.agent.id);
          if (aRemote !== bRemote) return aRemote - bRemote;
          return rotationScore(date, a.agentIndex, weekIndex, getShift(a.cell)) - rotationScore(date, b.agentIndex, weekIndex, getShift(b.cell));
        })[0];
      if (!candidate) return;
      setMode(candidate.cell, "remote");
      candidate.cell.note = candidate.cell.note || "Ajuste por remoto diario";
    });
  });
}

function rebalanceDailyRemoteShifts(schedule, weekKey, week) {
  week.forEach((date) => {
    const dayKey = dateKey(date);
    ["A", "B"].forEach((shift) => {
      let remoteCells = state.agents
        .map((agent) => ({ agent, cell: schedule[weekKey]?.[agent.id]?.[dayKey] }))
        .filter(({ cell }) => isEditableWorkCell(cell) && getShift(cell) === shift && getMode(cell) === "remote");
      const capacity = dailyRemoteShiftCapacity(schedule, weekKey, dayKey, shift);

      for (const { agent, cell } of remoteCells) {
        if (remoteCells.length <= capacity) break;
        if (!canAdjustWorkCell(cell)) continue;
        if (!canKeepDailyCoverageAfterChange(schedule, weekKey, dayKey, agent.id, shift, "onsite", isUnionStatus(cell))) continue;
        setMode(cell, "onsite");
        remoteCells = remoteCells.filter((item) => item.agent.id !== agent.id);
      }
    });
  });
}

function fillWeeklyRemoteTargets(schedule) {
  getMonthWeeks(state.year, state.month).forEach((week, weekIndex) => {
    const weekKey = dateKey(week[0]);
    state.agents.forEach((agent, agentIndex) => assignWeeklyRemote(schedule, weekKey, week, agent, agentIndex, weekIndex));
  });
}

function canKeepDailyCoverageAfterChange(schedule, weekKey, dayKey, agentId, nextShift, nextMode, nextUnion = false) {
  const counts = { A: 0, B: 0 };
  state.agents.forEach((agent) => {
    const cell = schedule[weekKey]?.[agent.id]?.[dayKey];
    if (!cell) return;
    const tempCell = agent.id === agentId ? { status: buildStatus(nextShift, nextMode, nextUnion) } : cell;
    if (getShift(tempCell) === "A" && getMode(tempCell) === "onsite") counts.A += 1;
    if (getShift(tempCell) === "B" && getMode(tempCell) === "onsite") counts.B += 1;
  });
  return counts.A >= 1 && counts.B >= 1;
}

function weeklyShiftCount(schedule, weekKey, week, agentId, shift) {
  return week.filter((date) => isWorkShift(schedule[weekKey]?.[agentId]?.[dateKey(date)], shift)).length;
}

function weeklyRemoteCount(schedule, weekKey, week, agentId) {
  return week.filter((date) => getMode(schedule[weekKey]?.[agentId]?.[dateKey(date)]) === "remote").length;
}

function weeklyBTarget(schedule, weekKey, week, agentId) {
  const eligibleDays = week.filter((date) => isEditableWorkCell(schedule[weekKey]?.[agentId]?.[dateKey(date)])).length;
  return Math.min(2, eligibleDays);
}

function monthlyOnsiteShiftCount(agentId, shift, schedule) {
  let count = 0;
  Object.values(schedule || {}).forEach((weekByAgent) => {
    Object.values(weekByAgent[agentId] || {}).forEach((cell) => {
      if (getShift(cell) === shift && getMode(cell) === "onsite") count += 1;
    });
  });
  return count;
}

function remoteScore(date, agentIndex, weekIndex) {
  const day = isoDay(date);
  const bias = [2, 4, 3, 1, 5];
  return bias.indexOf(((day + agentIndex + weekIndex - 1) % 5) + 1);
}

function rotationScore(date, agentIndex, weekIndex, shift) {
  const offset = shift === "B" ? 1 : 3;
  return (isoDay(date) + agentIndex + weekIndex + offset) % 5;
}

function activeAgentsForDay(schedule, weekKey, dayKey) {
  return state.agents.filter((agent) => isEditableWorkCell(schedule[weekKey][agent.id][dayKey]));
}

function setShift(cell, shift) {
  if (!isEditableWorkCell(cell)) return;
  cell.status = buildStatus(shift, getMode(cell), isUnionStatus(cell));
}

function setMode(cell, mode) {
  if (!isEditableWorkCell(cell)) return;
  cell.status = buildStatus(getShift(cell), mode, isUnionStatus(cell));
}

function isShift(cell, shift) {
  return getShift(cell) === shift;
}

function isWorkShift(cell, shift) {
  return isEditableWorkCell(cell) && getShift(cell) === shift;
}

function isOnsiteShift(cell, shift) {
  return isEditableWorkCell(cell) && getShift(cell) === shift && getMode(cell) === "onsite";
}

function isEditableWorkCell(cell) {
  return Boolean(getShift(cell) && ["onsite", "remote"].includes(getMode(cell)));
}

function canAdjustWorkCell(cell) {
  return isEditableWorkCell(cell) && !cell.locked;
}

function isClosedSpecial(special) {
  return ["holiday", "recess"].includes(special?.type);
}

function isClosedCell(cell) {
  return ["holiday", "recess"].includes(cell?.status);
}

function isUnavailableStatus(status) {
  return ["holiday", "recess", "medical", "admin", "admin_morning", "admin_afternoon"].includes(status);
}

function absenceLabel(type) {
  const labels = {
    admin: "Día administrativo",
    admin_morning: "ADM A mañana (8:30 - 13:30)",
    admin_afternoon: "ADM B tarde (14:30 - 20:30)",
    medical: "Licencia médica",
  };
  return labels[type] || "Ausencia";
}

function specialLabel(type) {
  const labels = {
    holiday: "Feriado",
    recess: "Receso institucional",
    mandatory: "Asistencia obligatoria",
  };
  return labels[type] || "Especial";
}

function getShift(cell) {
  if (!cell?.status) return null;
  if (cell.status === "admin_morning") return "A";
  if (cell.status === "admin_afternoon") return "B";
  if (cell.status.startsWith("A-")) return "A";
  if (cell.status.startsWith("B-")) return "B";
  return null;
}

function getMode(cell) {
  if (!cell?.status) return null;
  if (["admin_morning", "admin_afternoon"].includes(cell.status)) return "admin";
  if (cell.status.includes("-remote")) return "remote";
  if (cell.status.includes("-onsite")) return "onsite";
  return null;
}

function isUnionStatus(cell) {
  return Boolean(cell?.status?.endsWith("-union"));
}

function buildStatus(shift, mode, union = false) {
  return `${shift}-${mode}${union ? "-union" : ""}`;
}

function lockExpiredDays(schedule, previousSchedule) {
  Object.entries(schedule).forEach(([weekKey, weekByAgent]) => {
    Object.entries(weekByAgent).forEach(([agentId, days]) => {
      Object.entries(days).forEach(([dayKey, cell]) => {
        if (!isExpiredDay(dayKey)) return;
        const previous = previousSchedule?.[weekKey]?.[agentId]?.[dayKey];
        days[dayKey] = {
          ...(previous || cell),
          locked: true,
          expired: true,
          note: previous?.note || cell.note || "Día vencido",
        };
      });
    });
  });
}

function isExpiredDay(dayKey) {
  return dayKey < todayKey();
}

function todayKey() {
  const now = new Date();
  return dateKey(now);
}

function render() {
  if (!state) return;
  showApp();
  el.monthSelect.value = state.month;
  el.yearInput.value = state.year;
  renderWeeklyIssues = canEdit() ? weeklyRuleIssues() : new Map();
  renderWeeklyNotifications = canEdit() ? weeklyRuleNotifications() : new Map();
  renderSelectors();
  if (currentPage === "admin" && canEdit()) {
    renderAgents();
    renderLists();
  }
  renderCalendar();
  renderRules();
  renderWeeklyIssues = null;
  renderWeeklyNotifications = null;
}

function renderScheduleUpdate(onlyWeekKey = null) {
  if (!onlyWeekKey || currentPage !== "calendar" || !isVisibleWeekKey(onlyWeekKey)) {
    render();
    return;
  }
  renderWeeklyIssues = canEdit() ? weeklyRuleIssues() : new Map();
  renderWeeklyNotifications = canEdit() ? weeklyRuleNotifications() : new Map();
  refreshWeekBlock(onlyWeekKey, {
    weeklyIssues: renderWeeklyIssues,
    weeklyNotifications: renderWeeklyNotifications,
  });
  renderRules();
  renderWeeklyIssues = null;
  renderWeeklyNotifications = null;
}

function renderSelectors() {
  const lockValue = el.lockAgentInput.value;
  const absenceValue = el.absenceAgentInput.value;
  const weeks = selectableWeeks();
  const weekKeys = weeks.map((week) => dateKey(week[0]));
  if (!weekKeys.includes(selectedWeekKey)) selectedWeekKey = defaultSelectedWeekKey(weeks);
  renderViewModeOptions();
  el.calendarViewMode.value = calendarViewMode;
  el.weekSelect.innerHTML = "";
  weeks.forEach((week) => {
    const weekKey = dateKey(week[0]);
    const option = document.createElement("option");
    option.value = weekKey;
    option.textContent = `Semana ${formatDate(weekKey)}`;
    el.weekSelect.append(option);
  });
  el.weekSelect.value = selectedWeekKey;
  el.weekSelectLabel.hidden = false;
  [el.lockAgentInput, el.absenceAgentInput].forEach((select) => {
    select.innerHTML = "";
    state.agents.forEach((agent) => {
      const option = document.createElement("option");
      option.value = agent.id;
      option.textContent = agent.name;
      select.append(option);
    });
  });
  if (state.agents.some((agent) => agent.id === lockValue)) el.lockAgentInput.value = lockValue;
  if (state.agents.some((agent) => agent.id === absenceValue)) el.absenceAgentInput.value = absenceValue;
  el.weekSelect.disabled = !isWeeklyView();
}

function renderViewModeOptions() {
  const modes = isTutorLimitedView()
    ? [
        ["my-week", "Mis turnos semanales"],
        ["week", "Solo la semana"],
      ]
    : [
        ["month", "Todo el mes"],
        ["week", "Solo la semana"],
      ];
  if (!isTutorLimitedView() && currentUser?.role === "tutor") {
    modes.push(["my-week", "Mis turnos semanales"], ["my-month", "Mis turnos mensuales"]);
  }
  if (!modes.some(([value]) => value === calendarViewMode)) calendarViewMode = isTutorLimitedView() ? "my-week" : "month";
  el.calendarViewMode.innerHTML = "";
  modes.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    el.calendarViewMode.append(option);
  });
}

function renderAgents() {
  el.agentsList.innerHTML = "";
  state.agents.forEach((agent) => {
    const linkedUser = userForAgent(agent);
    const row = document.createElement("div");
    row.className = "agent-row";
    const avatar = document.createElement("div");
    avatar.className = "agent-avatar";
    avatar.innerHTML = agent.photo
      ? `<img src="${escapeHtml(agent.photo)}" alt="${escapeHtml(agent.name)}" />`
      : `<span>${agentInitials(agent.name)}</span>`;
    const input = document.createElement("input");
    input.value = agent.name;
    input.disabled = !canEdit();
    input.addEventListener("change", () => {
      if (!canEdit()) return;
      pushUndoSnapshot();
      agent.name = input.value.trim() || "Agente sin nombre";
      generateSchedule();
    });
    const meta = document.createElement("small");
    meta.className = "agent-meta";
    meta.textContent = linkedUser
      ? `${linkedUser.email}${linkedUser.mustChangePassword ? " | cambio pendiente" : ""}`
      : "Sin usuario asociado";
    const photoInput = document.createElement("input");
    photoInput.type = "file";
    photoInput.accept = "image/*";
    photoInput.className = "visually-hidden";
    photoInput.disabled = !canEdit();
    photoInput.addEventListener("change", async () => {
      if (!canEdit() || !photoInput.files?.[0]) return;
      try {
        pushUndoSnapshot();
        agent.photo = await resizePhoto(photoInput.files[0]);
        saveState();
        render();
      } catch {
        showRulesError("No se pudo cargar la fotografía. Intenta con una imagen JPG o PNG.");
      }
    });
    const photoButton = document.createElement("button");
    photoButton.className = "mini-button photo-button";
    photoButton.textContent = agent.photo ? "Cambiar foto" : "Foto";
    photoButton.disabled = !canEdit();
    photoButton.addEventListener("click", () => photoInput.click());
    const clearPhoto = document.createElement("button");
    clearPhoto.className = "mini-button clear-photo-button";
    clearPhoto.textContent = "Sin foto";
    clearPhoto.disabled = !canEdit() || !agent.photo;
    clearPhoto.addEventListener("click", () => {
      if (!canEdit()) return;
      pushUndoSnapshot();
      agent.photo = "";
      saveState();
      render();
    });
    const remove = document.createElement("button");
    remove.className = "mini-button remove-agent-button";
    remove.textContent = "Quitar";
    remove.disabled = !canEdit();
    remove.addEventListener("click", () => {
      if (!canEdit()) return;
      pushUndoSnapshot();
      state.agents = state.agents.filter((item) => item.id !== agent.id);
      generateSchedule();
    });
    const resetPassword = document.createElement("button");
    resetPassword.className = "mini-button reset-password-button";
    resetPassword.textContent = "Resetear contraseña";
    resetPassword.disabled = !canEdit() || !linkedUser;
    resetPassword.addEventListener("click", () => {
      if (!linkedUser) return;
      openResetPassword(linkedUser.id);
    });
    row.append(avatar, input, meta, photoInput, photoButton, clearPhoto, resetPassword, remove);
    el.agentsList.append(row);
  });
}

function userForAgent(agent) {
  if (!agent) return null;
  if (agent.userId) {
    const linked = users.find((user) => user.id === agent.userId);
    if (linked) return linked;
  }
  const matched = users.find((user) => user.role === "tutor" && normalizeName(user.name) === normalizeName(agent.name));
  if (matched && !agent.userId) agent.userId = matched.id;
  return matched || null;
}

function renderLists() {
  renderSimpleList(
    el.specialDaysList,
    state.specialDays,
    (item) => {
      const label = specialLabel(item.type);
      return `<strong>${formatDate(item.date)}</strong><small>${label}</small>`;
    },
    (item) => item.type !== "holiday",
  );
  renderSimpleList(el.locksList, state.recurringLocks, (item) => {
    const agent = state.agents.find((candidate) => candidate.id === item.agentId);
    const lockOption = options[recurringLockStatus(item)] || options["A-onsite"];
    return `<strong>${agent?.name || "Agente eliminado"}</strong><small>${dayNames[item.day - 1]} | ${lockOption.label}</small>`;
  });
  renderSimpleList(el.absencesList, state.absences, (item) => {
    const agent = state.agents.find((candidate) => candidate.id === item.agentId);
    const type = absenceLabel(item.type);
    const to = item.indefinite ? "indefinida" : formatDate(item.to);
    return `<strong>${agent?.name || "Agente eliminado"}</strong><small>${type} | ${formatDate(item.from)} a ${to}</small>`;
  });
}

async function saveCurrentUserPhoto() {
  if (!canEditProfilePhoto() || !currentUser?.id || !el.profilePhotoInput?.files?.[0]) return;
  try {
    const photo = await resizePhoto(el.profilePhotoInput.files[0]);
    await saveUserPhoto(currentUser.id, photo);
    el.profilePhotoInput.value = "";
  } catch {
    showRulesError("No se pudo cargar la fotografía del perfil. Intenta con una imagen JPG o PNG.");
  }
}

async function saveUserPhoto(userId, photo) {
  const response = await fetch("/api/users", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, photo }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    showRulesError(payload.error || "No se pudo guardar la fotografía del usuario.");
    return;
  }
  users = users.map((user) => (user.id === userId ? payload.user : user));
  if (currentUser?.id === userId) currentUser = payload.user;
  renderAgents();
  showApp();
}

function renderSimpleList(container, list, labeler, canRemoveItem = () => true) {
  container.innerHTML = "";
  list
    .slice()
    .sort((a, b) => (a.date || a.from || "").localeCompare(b.date || b.from || ""))
    .forEach((item) => {
      const row = document.createElement("div");
      row.className = "list-row";
      const text = document.createElement("div");
      text.innerHTML = labeler(item);
      const remove = document.createElement("button");
      remove.className = "mini-button";
      const removable = canRemoveItem(item);
      remove.textContent = removable ? "Quitar" : "Fijo";
      remove.disabled = !canEdit() || !removable;
      remove.addEventListener("click", () => {
        removeItem(item.id);
      });
      row.append(text, remove);
      container.append(row);
    });
}

function renderCalendar() {
  calendarRenderToken += 1;
  const renderToken = calendarRenderToken;
  el.calendarView.innerHTML = "";
  const agents = visibleAgents();
  const weeklyIssues = renderWeeklyIssues || (canEdit() ? weeklyRuleIssues() : new Map());
  const weeklyNotifications = renderWeeklyNotifications || (canEdit() ? weeklyRuleNotifications() : new Map());
  if (!agents.length) {
    el.calendarView.innerHTML = `<article class="week-block empty-view"><p>No hay turnos personales asociados a este usuario.</p></article>`;
    return;
  }
  const weeks = visibleWeeks();
  let weekIndex = 0;
  const renderNextWeek = () => {
    if (renderToken !== calendarRenderToken) return;
    const week = weeks[weekIndex];
    if (!week) return;
    el.calendarView.append(renderWeekBlock(week, weekIndex, agents, weeklyIssues, weeklyNotifications));
    weekIndex += 1;
    if (weekIndex < weeks.length) requestAnimationFrame(renderNextWeek);
  };
  renderNextWeek();
}

function renderWeekBlock(week, weekIndex, agents, weeklyIssues, weeklyNotifications, optionsOverride = {}) {
  const weekKey = dateKey(week[0]);
  const block = document.createElement("article");
  block.className = "week-block";
  block.dataset.weekKey = weekKey;
  const canCollapse = isMonthlyView();
  const collapsed = canCollapse && collapsedWeeks.has(weekKey) && !optionsOverride.forceExpanded;
  if (collapsed) block.classList.add("collapsed-week");
  block.innerHTML = `
    <div class="week-title">
      <h3>Semana ${formatDate(weekKey)}</h3>
      <div class="week-actions">
        <span>${shiftSummaryText()}</span>
        <button class="week-export-pdf export-hidden" type="button">Exportar a PDF</button>
        ${canCollapse ? `<button class="week-toggle" type="button">${collapsed ? "Expandir semana" : "Colapsar semana"}</button>` : ""}
      </div>
    </div>
  `;
  block.querySelector(".week-export-pdf")?.addEventListener("click", () => {
    const exportBlock = collapsed
      ? renderWeekBlock(week, weekIndex, agents, weeklyIssues, weeklyNotifications, { forceExpanded: true })
      : block;
    exportWeekPdf(exportBlock, weekKey);
  });
  block.querySelector(".week-toggle")?.addEventListener("click", () => {
    toggleWeekCollapse(weekKey);
  });
  if (collapsed) return block;

  const body = document.createElement("div");
  body.className = "week-body";
  const weekMain = document.createElement("div");
  weekMain.className = "week-main";
  if (canEdit()) weekMain.classList.add("with-issues");
  const tableWrap = document.createElement("div");
  tableWrap.className = "week-table-wrap";
  const issueColumn = document.createElement("aside");
  issueColumn.className = "week-issues-column";
  const issues = weeklyIssues.get(weekKey) || [];
  const notifications = weeklyNotifications.get(weekKey) || [];
  issueColumn.innerHTML = canEdit()
    ? `
      <p class="rule-message"><strong>Incongruencias de la semana:</strong></p>
      ${
        issues.length
          ? issues.map((issue) => `<p class="rule-message">&bull; ${escapeHtml(issue)}</p>`).join("")
          : '<p class="rule-message">Sin incongruencias.</p>'
      }
      ${
        showWeeklyNotifications && notifications.length
          ? `
            <div class="week-notifications">
              <p class="rule-message"><strong>Notificaciones:</strong></p>
              ${notifications.map((notification) => `<p class="rule-message">&bull; ${escapeHtml(notification)}</p>`).join("")}
            </div>
          `
          : ""
      }
      <button class="week-notification-toggle" type="button">${showWeeklyNotifications ? "Ocultar notificaciones" : "Mostrar notificaciones"}</button>
      <button class="week-suggest" type="button">Sugerir turnos</button>
      <button class="week-undo" type="button"${undoHistory.length ? "" : " disabled"}>Deshacer &uacute;ltimo cambio</button>
      <button class="week-reset" type="button">Resetear semana</button>
    `
    : "";
  issueColumn.querySelector(".week-notification-toggle")?.addEventListener("click", () => {
    showWeeklyNotifications = !showWeeklyNotifications;
    refreshVisibleWeekBlocks();
  });
  issueColumn.querySelector(".week-suggest")?.addEventListener("click", () => suggestWeekSchedule(weekKey, week));
  issueColumn.querySelector(".week-undo")?.addEventListener("click", undoLastChange);
  issueColumn.querySelector(".week-reset")?.addEventListener("click", () => resetWeek(weekKey, week));
  const table = document.createElement("table");
  table.className = "schedule-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>EQUIPO TUTORÍA</th>
        ${week.map((date) => `<th>${dayNames[isoDay(date) - 1]}<br>${formatDate(dateKey(date))}</th>`).join("")}
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector("tbody");
  agents.forEach((agent) => {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${agentIdentityHtml(agent)}</td>`;
    week.forEach((date) => {
      const key = dateKey(date);
      const cell = state.schedule[weekKey]?.[agent.id]?.[key] || { status: "A-onsite" };
      const option = options[cell.status] || options["A-onsite"];
      const td = document.createElement("td");
      const button = document.createElement("button");
      const expired = isExpiredDay(key);
      const displayLabel = cell.note === "Asistencia obligatoria" ? "Asistencia obligatoria" : option.label;
      const showLabel = cell.status !== "holiday";
      const showLockedMark = canEdit() && (expired || cell.note === "Bloqueo recurrente" || cell.note === "Bloqueo manual") && !isClosedCell(cell);
      button.className = `cell-btn ${option.className}${cell.note === "Asistencia obligatoria" ? " status-mandatory" : ""}${expired ? " expired-cell" : ""}`;
      button.disabled = expired || !canEdit();
      button.innerHTML = `
        <strong>${option.code}${showLockedMark ? '<span class="locked-mark">Bloq.</span>' : ""}</strong>
        ${showLabel ? `<span>${displayLabel}</span>` : ""}
      `;
      button.addEventListener("click", () => openCellEditor(weekKey, agent.id, key));
      td.append(button);
      row.append(td);
    });
    tbody.append(row);
  });
  tableWrap.append(table);
  weekMain.append(tableWrap);
  if (canEdit()) weekMain.append(issueColumn);
  body.append(weekMain);
  body.append(buildLegendNode("week-legend"));
  block.append(body);
  return block;
}

function toggleWeekCollapse(weekKey) {
  if (collapsedWeeks.has(weekKey)) collapsedWeeks.delete(weekKey);
  else collapsedWeeks.add(weekKey);
  refreshWeekBlock(weekKey);
}

function refreshWeekBlock(weekKey, cache = {}) {
  const weeks = visibleWeeks();
  const weekIndex = weeks.findIndex((week) => dateKey(week[0]) === weekKey);
  const agents = visibleAgents();
  const currentBlock = [...el.calendarView.querySelectorAll(".week-block")].find((block) => block.dataset.weekKey === weekKey);
  if (weekIndex < 0 || !agents.length || !currentBlock) {
    renderCalendar();
    return;
  }
  const weeklyIssues = cache.weeklyIssues || renderWeeklyIssues || (canEdit() ? weeklyRuleIssues() : new Map());
  const weeklyNotifications = cache.weeklyNotifications || renderWeeklyNotifications || (canEdit() ? weeklyRuleNotifications() : new Map());
  currentBlock.replaceWith(renderWeekBlock(weeks[weekIndex], weekIndex, agents, weeklyIssues, weeklyNotifications));
}

function refreshVisibleWeekBlocks() {
  calendarRenderToken += 1;
  const weeks = visibleWeeks();
  const agents = visibleAgents();
  const blocks = [...el.calendarView.querySelectorAll(".week-block[data-week-key]")];
  if (!agents.length || blocks.length !== weeks.length) {
    renderCalendar();
    return;
  }
  const weeklyIssues = canEdit() ? weeklyRuleIssues() : new Map();
  const weeklyNotifications = canEdit() ? weeklyRuleNotifications() : new Map();
  weeks.forEach((week, weekIndex) => {
    const weekKey = dateKey(week[0]);
    const currentBlock = blocks.find((block) => block.dataset.weekKey === weekKey);
    currentBlock?.replaceWith(renderWeekBlock(week, weekIndex, agents, weeklyIssues, weeklyNotifications));
  });
}

function isVisibleWeekKey(weekKey) {
  return visibleWeeks().some((week) => dateKey(week[0]) === weekKey);
}

function renderCalendarLegacy() {
  el.calendarView.innerHTML = "";
  const agents = visibleAgents();
  const weeklyIssues = renderWeeklyIssues || weeklyRuleIssues();
  const weeklyNotifications = renderWeeklyNotifications || weeklyRuleNotifications();
  if (!agents.length) {
    el.calendarView.innerHTML = `<article class="week-block empty-view"><p>No hay turnos personales asociados a este usuario.</p></article>`;
    return;
  }
  visibleWeeks().forEach((week, weekIndex) => {
    const weekKey = dateKey(week[0]);
    const block = document.createElement("article");
    block.className = "week-block";
    const canCollapse = isMonthlyView();
    const collapsed = canCollapse && collapsedWeeks.has(weekKey);
    if (collapsed) block.classList.add("collapsed-week");
    block.innerHTML = `
      <div class="week-title">
        <h3>Semana ${formatDate(weekKey)}</h3>
        <div class="week-actions">
          <span>${shiftSummaryText()}</span>
          <button class="week-export-pdf export-hidden" type="button">Exportar a PDF</button>
          ${canCollapse ? `<button class="week-toggle" type="button">${collapsed ? "Expandir semana" : "Colapsar semana"}</button>` : ""}
        </div>
      </div>
    `;
    block.querySelector(".week-export-pdf")?.addEventListener("click", () => exportWeekPdf(block, weekKey));
    const toggle = block.querySelector(".week-toggle");
    toggle?.addEventListener("click", () => {
      if (collapsedWeeks.has(weekKey)) collapsedWeeks.delete(weekKey);
      else collapsedWeeks.add(weekKey);
      renderCalendar();
    });
    const body = document.createElement("div");
    body.className = "week-body";
    const weekMain = document.createElement("div");
    weekMain.className = "week-main";
    if (canEdit()) weekMain.classList.add("with-issues");
    const tableWrap = document.createElement("div");
    tableWrap.className = "week-table-wrap";
    const issueColumn = document.createElement("aside");
    issueColumn.className = "week-issues-column";
    const issues = weeklyIssues.get(weekKey) || [];
    const notifications = weeklyNotifications.get(weekKey) || [];
    issueColumn.innerHTML = canEdit()
      ? `
        <p class="rule-message"><strong>Incongruencias de la semana:</strong></p>
        ${
          issues.length
            ? issues.map((issue) => `<p class="rule-message">• ${escapeHtml(issue)}</p>`).join("")
            : '<p class="rule-message">Sin incongruencias.</p>'
        }
        ${
          showWeeklyNotifications && notifications.length
            ? `
              <div class="week-notifications">
                <p class="rule-message"><strong>Notificaciones:</strong></p>
                ${notifications.map((notification) => `<p class="rule-message">• ${escapeHtml(notification)}</p>`).join("")}
              </div>
            `
            : ""
        }
        <button class="week-notification-toggle" type="button">${showWeeklyNotifications ? "Ocultar notificaciones" : "Mostrar notificaciones"}</button>
      <button class="week-undo" type="button"${undoHistory.length ? "" : " disabled"}>Deshacer &uacute;ltimo cambio</button>
        <button class="week-reset" type="button">Resetear semana</button>
      `
      : "";
    issueColumn.querySelector(".week-notification-toggle")?.addEventListener("click", () => {
      showWeeklyNotifications = !showWeeklyNotifications;
      renderCalendar();
    });
    issueColumn.querySelector(".week-undo")?.addEventListener("click", undoLastChange);
    issueColumn.querySelector(".week-reset")?.addEventListener("click", () => resetWeek(weekKey, week));
    const table = document.createElement("table");
    table.className = "schedule-table";
    table.innerHTML = `
      <thead>
        <tr>
          <th>EQUIPO TUTORÍA</th>
          ${week.map((date) => `<th>${dayNames[isoDay(date) - 1]}<br>${formatDate(dateKey(date))}</th>`).join("")}
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector("tbody");
    agents.forEach((agent) => {
      const row = document.createElement("tr");
      row.innerHTML = `<td>${agentIdentityHtml(agent)}</td>`;
      week.forEach((date) => {
        const key = dateKey(date);
        const cell = state.schedule[weekKey]?.[agent.id]?.[key] || { status: "A-onsite" };
        const option = options[cell.status] || options["A-onsite"];
        const td = document.createElement("td");
        const button = document.createElement("button");
        const expired = isExpiredDay(key);
        const displayLabel = cell.note === "Asistencia obligatoria" ? "Asistencia obligatoria" : option.label;
        const showLabel = cell.status !== "holiday";
        const showLockedMark = canEdit() && (expired || cell.note === "Bloqueo recurrente" || cell.note === "Bloqueo manual") && !isClosedCell(cell);
        button.className = `cell-btn ${option.className}${cell.note === "Asistencia obligatoria" ? " status-mandatory" : ""}${expired ? " expired-cell" : ""}`;
        button.disabled = expired || !canEdit();
        button.innerHTML = `
          <strong>${option.code}${showLockedMark ? '<span class="locked-mark">Bloq.</span>' : ""}</strong>
          ${showLabel ? `<span>${displayLabel}</span>` : ""}
        `;
        button.addEventListener("click", () => openCellEditor(weekKey, agent.id, key));
        td.append(button);
        row.append(td);
      });
      tbody.append(row);
    });
    tableWrap.append(table);
    weekMain.append(tableWrap);
    if (canEdit()) weekMain.append(issueColumn);
    body.append(weekMain);
    body.append(buildLegendNode("week-legend"));
    block.append(body);
    el.calendarView.append(block);
  });
}

function buildLegendNode(extraClass = "") {
  const legend = document.createElement("section");
  legend.className = `legend${extraClass ? ` ${extraClass}` : ""}`;
  legend.innerHTML = `
    <span><i class="swatch onsite"></i>Disponible presencial</span>
    <span><i class="swatch remote"></i>Remoto</span>
    <span><i class="swatch admin"></i>Administrativo</span>
    <span><i class="swatch medical"></i>Licencia médica</span>
    <span><i class="swatch union"></i>Salida sindicato</span>
    <span><i class="swatch holiday"></i>Feriado</span>
    <span><i class="swatch recess"></i>Receso institucional</span>
  `;
  return legend;
}

function visibleWeeks() {
  const weeks = selectableWeeks();
  if (!isWeeklyView()) return weeks;
  const weekKey = selectedWeekKey || defaultSelectedWeekKey(weeks);
  return weeks.filter((week) => dateKey(week[0]) === weekKey);
}

function selectableWeeks() {
  const weeks = getMonthWeeks(state.year, state.month);
  if (!isTutorLimitedView()) return weeks;
  const today = todayKey();
  const currentIndex = weeks.findIndex((week) => week.some((date) => dateKey(date) === today));
  if (currentIndex < 0) return weeks.slice(0, 2);
  return weeks.slice(currentIndex, currentIndex + 2);
}

function isTutorLimitedView() {
  return currentUser?.role === "tutor" && !canEdit();
}

function visibleAgents() {
  if (!isPersonalView()) return state.agents;
  const agent = currentAgent();
  return agent ? [agent] : [];
}

function currentAgent() {
  return state.agents.find((agent) => normalizeName(agent.name) === normalizeName(currentUser?.name));
}

function isWeeklyView() {
  return ["week", "my-week"].includes(calendarViewMode);
}

function isMonthlyView() {
  return ["month", "my-month"].includes(calendarViewMode);
}

function isPersonalView() {
  return ["my-week", "my-month"].includes(calendarViewMode);
}

function defaultSelectedWeekKey(weeks = getMonthWeeks(state.year, state.month)) {
  const today = todayKey();
  const currentWeek = weeks.find((week) => week.some((date) => dateKey(date) === today));
  return dateKey((currentWeek || weeks[0])?.[0] || new Date(state.year, state.month, 1));
}

function renderRules() {
  if (!canEdit()) {
    el.rulesPanel.innerHTML = "";
    return;
  }
  const issues = validateRules();
  el.rulesPanel.className = `rules-panel rules-summary ${issues.length ? "warn" : "ok"}`;
  el.rulesPanel.innerHTML = `
    <div class="rules-summary-copy">
      <p class="rule-message"><strong>Resumen del calendario:</strong></p>
      <ul class="rules-summary-list">
        <li>Organiza los turnos semanales del equipo seg&uacute;n mes, feriados, ausencias y bloqueos definidos.</li>
        <li>Cada celda representa un bloque diario completo con tutor, turno, modalidad o estado especial.</li>
        <li>El c&aacute;lculo prioriza cobertura presencial en A y B, distribuyendo remotos y turnos B de manera proporcional.</li>
        <li>Los d&iacute;as vencidos quedan bloqueados y los ajustes manuales se respetan en los rec&aacute;lculos posteriores.</li>
        <li>Las incongruencias se informan bajo cada semana para apoyar la decisi&oacute;n operativa sin impedir la edici&oacute;n.</li>
      </ul>
    </div>
    <div class="rules-summary-action">
      <a class="rules-manual-link" href="reglas-vigentes.html">Ver todas las reglas vigentes</a>
    </div>
  `;
}

function showRulesError(message) {
  el.rulesPanel.className = "rules-panel warn";
  el.rulesPanel.innerHTML = `<p class="rule-message"><strong>Error:</strong> ${escapeHtml(message)}</p>`;
}

function weeklyRuleIssues() {
  const byWeek = new Map();
  const monthFridayB = new Map(state.agents.map((agent) => [agent.id, 0]));
  const monthFridayWeek = new Map();

  getMonthWeeks(state.year, state.month).forEach((week, weekIndex) => {
    const weekKey = dateKey(week[0]);
    const issues = [];
    state.agents.forEach((agent) => {
      if (hasPermanentMedicalAbsence(agent.id)) return;
      const cells = week
        .map((date) => ({ date, key: dateKey(date), cell: state.schedule[weekKey]?.[agent.id]?.[dateKey(date)] }))
        .filter(({ cell, key }) => cell && !isExpiredDay(key));
      const workCells = cells.filter(({ cell }) => isEditableWorkCell(cell));
      const remote = workCells.filter(({ cell }) => getMode(cell) === "remote").length;
      const remoteTarget = weeklyRemoteTarget(state.schedule, weekKey, week, agent.id, weekIndex);
      const bShifts = workCells.filter(({ cell }) => isWorkShift(cell, "B")).length;
      const bTarget = weeklyBTarget(state.schedule, weekKey, week, agent.id);
      const unavailable = cells.filter(({ cell }) => isUnavailableStatus(cell.status)).length;
      if (workCells.length >= 2 && remote !== remoteTarget) {
        issues.push(`${agent.name}: tiene ${remote} remoto(s), deben ser ${remoteTarget}.`);
      }
      if (workCells.length >= 2 && bShifts !== bTarget) {
        issues.push(`${agent.name}: tiene ${bShifts} turno(s) B, deben ser ${bTarget}.`);
      }
      if (workCells.length < 2 && unavailable > 0 && !hasPermanentMedicalAbsence(agent.id)) {
        issues.push(`${agent.name}: ausencia/feriado impide completar proporcionalidad semanal.`);
      }
      cells.forEach(({ date, cell }) => {
        if (isoDay(date) === 5 && date.getMonth() === state.month && isEditableWorkCell(cell) && !monthFridayWeek.has(agent.id)) monthFridayWeek.set(agent.id, weekKey);
        if (isoDay(date) === 5 && date.getMonth() === state.month && isOnsiteShift(cell, "B")) monthFridayB.set(agent.id, (monthFridayB.get(agent.id) || 0) + 1);
      });
    });

    week.forEach((date) => {
      const dayKey = dateKey(date);
      if (isExpiredDay(dayKey)) return;
      if (specialFor(dayKey)?.type === "mandatory") return;
      const dayCells = state.agents.map((agent) => state.schedule[weekKey]?.[agent.id]?.[dayKey]).filter(Boolean);
      if (!dayCells.length || dayCells.every(isClosedCell)) return;
      if (dayCells.some(isPendingCell)) return;
      const activeCells = dayCells.filter(isEditableWorkCell);
      const onsiteA = activeCells.some((cell) => getShift(cell) === "A" && getMode(cell) === "onsite");
      const onsiteB = activeCells.some((cell) => getShift(cell) === "B" && getMode(cell) === "onsite");
      const remoteA = activeCells.filter((cell) => getShift(cell) === "A" && getMode(cell) === "remote").length;
      const remoteB = activeCells.filter((cell) => getShift(cell) === "B" && getMode(cell) === "remote").length;
      const remoteTotal = remoteA + remoteB;
      if (activeCells.length >= 2 && (!onsiteA || !onsiteB)) {
        issues.push(`${dayNames[isoDay(date) - 1]} ${formatDate(dayKey)}: debe haber al menos un tutor presencial en A y uno presencial en B.`);
      }
      if (remoteA > dailyRemoteShiftCapacity(state.schedule, weekKey, dayKey, "A") || remoteB > dailyRemoteShiftCapacity(state.schedule, weekKey, dayKey, "B")) {
        issues.push(`${dayNames[isoDay(date) - 1]} ${formatDate(dayKey)}: los remotos deben distribuirse como máximo 1 en A y 1 en B.`);
      }
      if (activeCells.length >= 2 && remoteTotal === 0) {
        issues.push(`${dayNames[isoDay(date) - 1]} ${formatDate(dayKey)}: debe existir al menos un tutor remoto si el día no está marcado como asistencia obligatoria, feriado o receso.`);
      }
      if (activeCells.length < 2) {
        issues.push(`${dayNames[isoDay(date) - 1]} ${formatDate(dayKey)}: no hay dotacion suficiente para cubrir A presencial y B presencial.`);
      }
    });

    addShortDayDistributionIssues(issues, weekKey, week);

    if (issues.length) byWeek.set(weekKey, issues);
  });

  addMonthlyFridayRotationIssues(byWeek);

  return byWeek;
}

function addMonthlyFridayRotationIssues(byWeek) {
  const assignments = monthlyFridayAssignments(state.schedule);
  const fridayKeys = [...new Set(assignments.map((item) => item.dayKey))].sort();
  const activeAgents = state.agents.filter((agent) => assignments.some((item) => item.agent.id === agent.id && isEditableWorkCell(item.cell)));
  if (!fridayKeys.length || !activeAgents.length) return;

  const activeIds = new Set(activeAgents.map((agent) => agent.id));
  const counts = new Map(activeAgents.map((agent) => [agent.id, 0]));
  const seen = new Set();

  fridayKeys.forEach((dayKey) => {
    const weekKey = assignments.find((item) => item.dayKey === dayKey)?.weekKey || dayKey;
    const fridayB = assignments.filter((item) => item.dayKey === dayKey && activeIds.has(item.agent.id) && isOnsiteShift(item.cell, "B"));
    if (!fridayB.length) {
      const issues = byWeek.get(weekKey) || [];
      issues.push(`${dayNames[4]} ${formatDate(dayKey)}: debe existir un tutor en viernes B presencial.`);
      byWeek.set(weekKey, issues);
      return;
    }

    fridayB.forEach((item) => {
      if (seen.has(item.agent.id) && seen.size < activeAgents.length) {
        const issues = byWeek.get(weekKey) || [];
        issues.push(`${item.agent.name}: repite viernes B presencial antes de que todos los tutores activos tengan uno en ${monthNames[state.month]}.`);
        byWeek.set(weekKey, issues);
      }
      seen.add(item.agent.id);
      counts.set(item.agent.id, (counts.get(item.agent.id) || 0) + 1);
    });
  });

  if (fridayKeys.length >= activeAgents.length) {
    activeAgents.forEach((agent) => {
      if ((counts.get(agent.id) || 0) > 0) return;
      const weekKey = monthFridayWeekForAgent(assignments, agent.id) || assignments.find((item) => item.dayKey === fridayKeys[0])?.weekKey || fridayKeys[0];
      const issues = byWeek.get(weekKey) || [];
      issues.push(`${agent.name}: no tiene viernes B presencial durante ${monthNames[state.month]}; debe completar la vuelta mensual antes de repetir otro tutor.`);
      byWeek.set(weekKey, issues);
    });
  }

  const maxAllowed = Math.ceil(fridayKeys.length / activeAgents.length);
  activeAgents.forEach((agent) => {
    const fridayCount = counts.get(agent.id) || 0;
    if (fridayCount <= maxAllowed) return;
    const weekKey = monthFridayWeekForAgent(assignments, agent.id) || assignments.find((item) => item.dayKey === fridayKeys[0])?.weekKey || fridayKeys[0];
    const issues = byWeek.get(weekKey) || [];
    issues.push(`${agent.name}: tiene ${fridayCount} viernes B presencial durante ${monthNames[state.month]}; supera la vuelta proporcional mensual.`);
    byWeek.set(weekKey, issues);
  });
}

function monthFridayWeekForAgent(assignments, agentId) {
  const assignment = assignments.find((item) => item.agent.id === agentId && isOnsiteShift(item.cell, "B"));
  return assignment?.weekKey || "";
}

function weeklyRuleNotifications() {
  const byWeek = new Map();
  getMonthWeeks(state.year, state.month).forEach((week) => {
    const weekKey = dateKey(week[0]);
    const notifications = [];
    state.agents.forEach((agent) => {
      week.forEach((date) => {
        const dayKey = dateKey(date);
        if (isExpiredDay(dayKey)) return;
        const override = state.manualOverrides?.[`${weekKey}|${agent.id}|${dayKey}`];
        const recurringLock = state.recurringLocks.find((lock) => lock.agentId === agent.id && lock.day === isoDay(date));
        const overrideSource = override?.source || (override?.note === "Bloqueo manual" ? "future-lock" : "manual");
        if (overrideSource === "manual" && recurringLock) {
          notifications.push(`${agent.name}: turno desbloqueado manualmente el ${dayNames[isoDay(date) - 1]} ${formatDate(dayKey)}; el cálculo se ajusta al resto de la semana.`);
        }
      });
    });
    if (notifications.length) byWeek.set(weekKey, notifications);
  });
  return byWeek;
}

function permanentMedicalAgents() {
  return state.agents.filter((agent) => hasPermanentMedicalAbsence(agent.id));
}

function hasPermanentMedicalAbsence(agentId) {
  return state.absences.some((absence) => absence.agentId === agentId && absence.type === "medical" && absence.indefinite);
}

function isPendingCell(cell) {
  return cell?.status === "assign";
}

function addShortDayDistributionIssues(issues, weekKey, week) {
  const activeAgents = state.agents.filter((agent) => !hasPermanentMedicalAbsence(agent.id));
  if (activeAgents.length < 2) return;
  const counts = activeAgents.map((agent) => {
    const shortRemote = week.filter((date) => {
      if (isoDay(date) < 3) return false;
      const cell = state.schedule[weekKey]?.[agent.id]?.[dateKey(date)];
      return isEditableWorkCell(cell) && getMode(cell) === "remote";
    }).length;
    return { agent, shortRemote };
  });
  const values = counts.map((item) => item.shortRemote);
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max - min <= 1) return;
  const detail = counts.map((item) => `${item.agent.name}: ${item.shortRemote}`).join(", ");
  issues.push(`Miércoles a viernes: los remotos de jornada corta no están distribuidos equitativamente (${detail}).`);
}

function validateRules() {
  const issues = [];
  (renderWeeklyIssues || weeklyRuleIssues()).forEach((weekIssues) => issues.push(...weekIssues));
  return issues.slice(0, 20);
}

function suggestWeekSchedule(weekKey, week) {
  if (!canEdit()) return;
  if (!state.schedule?.[weekKey]) return;
  const baseSchedule = structuredClone(state.schedule);
  const mutableCells = suggestibleWeekAssignments(baseSchedule, weekKey, week);
  if (!mutableCells.length) {
    showRulesError("No hay bloques disponibles para sugerir en esta semana. Los dias bloqueados o especiales se mantienen sin cambios.");
    return;
  }

  const weekIndex = getMonthWeeks(state.year, state.month).findIndex((item) => dateKey(item[0]) === weekKey);
  const attempts = Math.max(80, mutableCells.length * 18);
  let bestScore = Infinity;
  let bestCandidates = [];

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const candidateSchedule = structuredClone(baseSchedule);
    randomizeSuggestedWeek(candidateSchedule, weekKey, week);
    rebalanceSuggestedWeek(candidateSchedule, weekKey, week, weekIndex, attempt);
    const evaluation = scoreSuggestedWeek(candidateSchedule, weekKey, week);
    if (evaluation.score < bestScore) {
      bestScore = evaluation.score;
      bestCandidates = [{ weekByAgent: structuredClone(candidateSchedule[weekKey]), evaluation }];
    } else if (evaluation.score === bestScore) {
      bestCandidates.push({ weekByAgent: structuredClone(candidateSchedule[weekKey]), evaluation });
    }
  }

  if (!bestCandidates.length) {
    showRulesError("No fue posible construir una sugerencia para esta semana con las reglas actuales.");
    return;
  }

  const selected = bestCandidates[Math.floor(Math.random() * bestCandidates.length)];
  pushUndoSnapshot();
  state.schedule[weekKey] = selected.weekByAgent;
  saveState();
  renderScheduleUpdate(weekKey);
}

function suggestibleWeekAssignments(schedule, weekKey, week) {
  const assignments = [];
  state.agents.forEach((agent) => {
    week.forEach((date) => {
      const dayKey = dateKey(date);
      const cell = schedule[weekKey]?.[agent.id]?.[dayKey];
      if (isSuggestibleWorkCell(cell, dayKey)) assignments.push({ agent, dayKey, cell });
    });
  });
  return assignments;
}

function isSuggestibleWorkCell(cell, dayKey = "") {
  return Boolean(
    cell &&
      !isExpiredDay(dayKey) &&
      !cell.locked &&
      !cell.expired &&
      suggestibleStatuses.has(cell.status),
  );
}

function randomizeSuggestedWeek(schedule, weekKey, week) {
  suggestibleWeekAssignments(schedule, weekKey, week).forEach(({ cell }) => {
    const shift = Math.random() < 0.5 ? "A" : "B";
    const mode = Math.random() < 0.34 ? "remote" : "onsite";
    cell.status = buildStatus(shift, mode);
    if (String(cell.note || "").startsWith("Ajuste por ")) cell.note = "";
  });
}

function rebalanceSuggestedWeek(schedule, weekKey, week, weekIndex, attempt = 0) {
  for (let pass = 0; pass < 3; pass += 1) {
    state.agents.forEach((agent) => assignSuggestedWeeklyB(schedule, weekKey, week, agent));
    balanceDailyShiftDistribution(schedule, weekKey, week, weekIndex);
    enforceSuggestedDailyOnsiteCoverage(schedule, weekKey, week, weekIndex);
    enforceSuggestedFridayB(schedule, weekKey, week, attempt + pass);
    state.agents.forEach((agent) => assignSuggestedWeeklyRemote(schedule, weekKey, week, agent, weekIndex));
    rebalanceDailyRemoteShifts(schedule, weekKey, week);
    ensureSuggestedMinimumDailyRemote(schedule, weekKey, week, weekIndex);
    enforceSuggestedDailyOnsiteCoverage(schedule, weekKey, week, weekIndex);
  }
}

function assignSuggestedWeeklyB(schedule, weekKey, week, agent) {
  const target = weeklyBTarget(schedule, weekKey, week, agent.id);
  let count = weeklyShiftCount(schedule, weekKey, week, agent.id, "B");
  let guard = 0;

  while (count < target && guard < 10) {
    guard += 1;
    const candidate = randomItem(
      week
        .map((date) => ({ dayKey: dateKey(date), cell: schedule[weekKey]?.[agent.id]?.[dateKey(date)] }))
        .filter(({ dayKey, cell }) =>
          isSuggestibleWorkCell(cell, dayKey) &&
          getShift(cell) === "A" &&
          canKeepDailyCoverageAfterChange(schedule, weekKey, dayKey, agent.id, "B", getMode(cell), false),
        ),
    );
    if (!candidate) break;
    setShift(candidate.cell, "B");
    count += 1;
  }

  guard = 0;
  while (count > target && guard < 10) {
    guard += 1;
    const candidate = randomItem(
      week
        .map((date) => ({ dayKey: dateKey(date), cell: schedule[weekKey]?.[agent.id]?.[dateKey(date)] }))
        .filter(({ dayKey, cell }) =>
          isSuggestibleWorkCell(cell, dayKey) &&
          getShift(cell) === "B" &&
          canKeepDailyCoverageAfterChange(schedule, weekKey, dayKey, agent.id, "A", getMode(cell), false),
        ),
    );
    if (!candidate) break;
    setShift(candidate.cell, "A");
    count -= 1;
  }
}

function assignSuggestedWeeklyRemote(schedule, weekKey, week, agent, weekIndex) {
  const target = weeklyRemoteTarget(schedule, weekKey, week, agent.id, weekIndex);
  let count = weeklyRemoteCount(schedule, weekKey, week, agent.id);
  let guard = 0;

  while (count < target && guard < 10) {
    guard += 1;
    const candidate = randomItem(
      week
        .map((date) => ({ date, dayKey: dateKey(date), cell: schedule[weekKey]?.[agent.id]?.[dateKey(date)] }))
        .filter(({ date, dayKey, cell }) =>
          isSuggestibleWorkCell(cell, dayKey) &&
          getMode(cell) === "onsite" &&
          !(isoDay(date) === 5 && getShift(cell) === "B") &&
          hasRemoteCapacityForDay(schedule, weekKey, dayKey, agent.id) &&
          canKeepDailyCoverageAfterChange(schedule, weekKey, dayKey, agent.id, getShift(cell), "remote", false),
        ),
    );
    if (!candidate) break;
    setMode(candidate.cell, "remote");
    count += 1;
  }

  guard = 0;
  while (count > target && guard < 10) {
    guard += 1;
    const candidate = randomItem(
      week
        .map((date) => ({ dayKey: dateKey(date), cell: schedule[weekKey]?.[agent.id]?.[dateKey(date)] }))
        .filter(({ dayKey, cell }) =>
          isSuggestibleWorkCell(cell, dayKey) &&
          getMode(cell) === "remote" &&
          canKeepDailyCoverageAfterChange(schedule, weekKey, dayKey, agent.id, getShift(cell), "onsite", false),
        ),
    );
    if (!candidate) break;
    setMode(candidate.cell, "onsite");
    count -= 1;
  }
}

function enforceSuggestedDailyOnsiteCoverage(schedule, weekKey, week, weekIndex) {
  week.forEach((date) => {
    const dayKey = dateKey(date);
    const special = specialFor(dayKey);
    if (isExpiredDay(dayKey) || special?.type === "mandatory" || isClosedSpecial(special)) return;
    const cells = state.agents.map((agent, agentIndex) => ({
      agent,
      agentIndex,
      cell: schedule[weekKey]?.[agent.id]?.[dayKey],
    }));
    if (cells.every(({ cell }) => isClosedCell(cell))) return;
    ensureOnsiteShift(schedule, cells, "B", weekIndex, date);
    const bOnsiteAgent = cells.find(({ cell }) => getShift(cell) === "B" && getMode(cell) === "onsite")?.agent.id;
    ensureOnsiteShift(schedule, cells, "A", weekIndex, date, bOnsiteAgent);
  });
}

function enforceSuggestedFridayB(schedule, weekKey, week, attempt = 0) {
  const friday = week.find((date) => isoDay(date) === 5 && date.getMonth() === state.month);
  if (!friday) return;
  const dayKey = dateKey(friday);
  if (isExpiredDay(dayKey) || isClosedSpecial(specialFor(dayKey))) return;
  const assignments = state.agents
    .map((agent) => ({ agent, cell: schedule[weekKey]?.[agent.id]?.[dayKey] }))
    .filter(({ cell }) => isEditableWorkCell(cell));
  if (!assignments.length) return;
  const lockedB = assignments.filter(({ cell }) => isOnsiteShift(cell, "B") && !isSuggestibleWorkCell(cell, dayKey));
  if (lockedB.length) {
    assignments.forEach(({ cell }) => {
      if (isSuggestibleWorkCell(cell, dayKey) && isOnsiteShift(cell, "B")) cell.status = "A-onsite";
    });
    return;
  }

  const counts = monthlyFridayBCounts(
    monthlyFridayAssignments(schedule).filter((item) => item.weekKey !== weekKey),
  );
  const candidates = assignments.filter(({ cell }) => isSuggestibleWorkCell(cell, dayKey));
  if (!candidates.length) return;
  const minCount = Math.min(...candidates.map(({ agent }) => counts.get(agent.id) || 0));
  const fairCandidates = shuffle(candidates.filter(({ agent }) => (counts.get(agent.id) || 0) === minCount));
  const target = fairCandidates[attempt % fairCandidates.length] || randomItem(candidates);
  if (!target) return;

  assignments.forEach(({ agent, cell }) => {
    if (!isSuggestibleWorkCell(cell, dayKey)) return;
    if (agent.id === target.agent.id) cell.status = "B-onsite";
    else if (isOnsiteShift(cell, "B")) cell.status = "A-onsite";
  });
}

function ensureSuggestedMinimumDailyRemote(schedule, weekKey, week, weekIndex) {
  week.forEach((date) => {
    const dayKey = dateKey(date);
    const special = specialFor(dayKey);
    if (isExpiredDay(dayKey) || special?.type === "mandatory" || isClosedSpecial(special)) return;
    const activeCells = state.agents
      .map((agent, agentIndex) => ({ agent, agentIndex, cell: schedule[weekKey]?.[agent.id]?.[dayKey] }))
      .filter(({ cell }) => isEditableWorkCell(cell));
    if (activeCells.length < 2 || activeCells.some(({ cell }) => getMode(cell) === "remote")) return;
    const candidate = randomItem(
      activeCells.filter(({ agent, cell }) =>
        isSuggestibleWorkCell(cell, dayKey) &&
        hasRemoteCapacityForDay(schedule, weekKey, dayKey, agent.id) &&
        canKeepDailyCoverageAfterChange(schedule, weekKey, dayKey, agent.id, getShift(cell), "remote", false),
      ),
    );
    if (!candidate) return;
    setMode(candidate.cell, "remote");
  });
}

function scoreSuggestedWeek(schedule, weekKey, week) {
  const weeklyIssues = weeklyRuleIssuesForSchedule(schedule);
  const issues = weeklyIssues.get(weekKey) || [];
  const weekIndex = Math.max(0, getMonthWeeks(state.year, state.month).findIndex((item) => dateKey(item[0]) === weekKey));
  let score = issues.length * 1000;

  state.agents.forEach((agent) => {
    const remoteTarget = weeklyRemoteTarget(schedule, weekKey, week, agent.id, weekIndex);
    const remoteCount = weeklyRemoteCount(schedule, weekKey, week, agent.id);
    const bTarget = weeklyBTarget(schedule, weekKey, week, agent.id);
    const bCount = weeklyShiftCount(schedule, weekKey, week, agent.id, "B");
    score += Math.abs(remoteCount - remoteTarget) * 25;
    score += Math.abs(bCount - bTarget) * 25;
  });

  week.forEach((date) => {
    const dayKey = dateKey(date);
    if (isExpiredDay(dayKey) || isClosedSpecial(specialFor(dayKey))) return;
    const cells = state.agents.map((agent) => schedule[weekKey]?.[agent.id]?.[dayKey]).filter(isEditableWorkCell);
    if (!cells.length) return;
    const onsiteA = cells.some((cell) => getShift(cell) === "A" && getMode(cell) === "onsite");
    const onsiteB = cells.some((cell) => getShift(cell) === "B" && getMode(cell) === "onsite");
    if (!onsiteA) score += 120;
    if (!onsiteB) score += 120;
    if (!cells.some((cell) => getMode(cell) === "remote")) score += 35;
  });

  return { score, issues };
}

function weeklyRuleIssuesForSchedule(schedule) {
  const previousSchedule = state.schedule;
  state.schedule = schedule;
  try {
    return weeklyRuleIssues();
  } finally {
    state.schedule = previousSchedule;
  }
}

function randomItem(items) {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle(items) {
  return items
    .map((item) => ({ item, order: Math.random() }))
    .sort((a, b) => a.order - b.order)
    .map(({ item }) => item);
}

function openCellEditor(weekKey, agentId, dayKey) {
  if (!canEdit()) return;
  if (isExpiredDay(dayKey)) {
    showRulesError(`El día ${formatDate(dayKey)} ya venció a las 23:59 y quedó bloqueado.`);
    return;
  }
  const agent = state.agents.find((item) => item.id === agentId);
  const cell = state.schedule[weekKey][agentId][dayKey];
  selectedCell = { weekKey, agentId, dayKey };
  el.modalDate.textContent = formatDate(dayKey);
  el.modalAgent.textContent = agent.name;
  syncUnionOptions(agent.name);
  el.cellStatusInput.value = cell.status;
  if (isUnionStatus(cell) && !canUseUnion(agent.name)) el.cellStatusInput.value = stripUnionStatus(cell.status);
  if (el.cellLockedInput) el.cellLockedInput.checked = false;
  el.cellDialog.showModal();
}

function saveCellEdit(event) {
  event.preventDefault();
  if (!canEdit()) return;
  if (!selectedCell) return;
  const { weekKey, agentId, dayKey } = selectedCell;
  if (isExpiredDay(dayKey)) return;
  const agent = state.agents.find((item) => item.id === agentId);
  if (el.cellStatusInput.value.endsWith("-union") && !canUseUnion(agent?.name)) {
    showRulesError("Salida anticipada sindicato solo aplica para Denisse Bravo y Monserrat Vargas.");
    return;
  }
  const key = `${weekKey}|${agentId}|${dayKey}`;
  pushUndoSnapshot();
  const selectedStatus = specialFor(dayKey)?.type === "mandatory"
    ? `${getShift({ status: el.cellStatusInput.value }) || "A"}-onsite`
    : el.cellStatusInput.value;
  const override = {
    status: selectedStatus,
    locked: true,
    note: specialFor(dayKey)?.type === "mandatory" ? "Asistencia obligatoria" : "Ajuste manual",
    source: "manual",
  };
  state.manualOverrides[key] = override;
  el.cellDialog.close();
  generateSchedule();
}

function applyManualLockToFutureWeeks(agentId, dayKey, override) {
  const targetIsoDay = isoDay(new Date(`${dayKey}T00:00:00`));
  getMonthWeeks(state.year, state.month).forEach((week) => {
    week.forEach((date) => {
      const key = dateKey(date);
      if (key < dayKey || isoDay(date) !== targetIsoDay || isExpiredDay(key)) return;
      const weekKey = dateKey(week[0]);
      if (!state.schedule[weekKey]?.[agentId]?.[key]) return;
      state.manualOverrides[`${weekKey}|${agentId}|${key}`] = { ...override };
    });
  });
}

function syncUnionOptions(agentName) {
  const allowed = canUseUnion(agentName);
  [...el.cellStatusInput.options].forEach((option) => {
    if (option.value.endsWith("-union")) option.disabled = !allowed;
  });
}

function canUseUnion(agentName = "") {
  return ["denisse bravo", "monserrat vargas"].includes(normalizeName(agentName));
}

function normalizeName(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function stripUnionStatus(status) {
  return String(status).replace("-union", "");
}

function addSpecialDay() {
  if (!canEdit()) return;
  if (!el.specialDateInput.value) return;
  pushUndoSnapshot();
  state.specialDays = state.specialDays.filter((item) => item.date !== el.specialDateInput.value);
  state.specialDays.push({ id: crypto.randomUUID(), date: el.specialDateInput.value, type: el.specialTypeInput.value });
  generateSchedule();
}

function addRecurringLock() {
  if (!canEdit()) return;
  if (!el.lockAgentInput.value) return;
  pushUndoSnapshot();
  state.recurringLocks.push({
    id: crypto.randomUUID(),
    agentId: el.lockAgentInput.value,
    day: Number(el.lockDayInput.value),
    mode: el.lockModeInput.value,
  });
  generateSchedule();
}

function addAbsence() {
  if (!canEdit()) return;
  if (!el.absenceAgentInput.value || !el.absenceFromInput.value) return;
  pushUndoSnapshot();
  const indefinite = el.absenceIndefInput.checked;
  state.absences.push({
    id: crypto.randomUUID(),
    agentId: el.absenceAgentInput.value,
    type: el.absenceTypeInput.value,
    from: el.absenceFromInput.value,
    to: indefinite ? "" : el.absenceToInput.value || el.absenceFromInput.value,
    indefinite,
  });
  generateSchedule();
}

function removeItem(id) {
  if (!canEdit()) return;
  if (state.specialDays.some((item) => item.id === id && item.type === "holiday")) return;
  pushUndoSnapshot();
  state.specialDays = state.specialDays.filter((item) => item.id !== id);
  state.recurringLocks = state.recurringLocks.filter((item) => item.id !== id);
  state.absences = state.absences.filter((item) => item.id !== id);
  generateSchedule();
}

function pushUndoSnapshot() {
  if (!state) return;
  undoHistory.push(structuredClone(state));
  if (undoHistory.length > 20) undoHistory.shift();
}

function undoLastChange() {
  if (!canEdit() || !undoHistory.length) return;
  state = undoHistory.pop();
  saveState();
  render();
}

function resetWeek(weekKey, week) {
  if (!canEdit()) return;
  pushUndoSnapshot();
  week.forEach((date) => {
    const dayKey = dateKey(date);
    state.agents.forEach((agent) => {
      const cell = state.schedule[weekKey]?.[agent.id]?.[dayKey];
      if (!cell || isProtectedResetCell(cell, dayKey)) return;
      const overrideKey = `${weekKey}|${agent.id}|${dayKey}`;
      delete state.manualOverrides[overrideKey];
    });
  });
  generateSchedule(weekKey);
}

function isProtectedResetCell(cell, dayKey = "") {
  return (
    isExpiredDay(dayKey) ||
    cell.status === "medical" ||
    isClosedCell(cell) ||
    cell.note === "Asistencia obligatoria" ||
    cell.note === "Bloqueo recurrente" ||
    cell.note === "Bloqueo manual" ||
    cell.expired
  );
}

function exportExcel() {
  const workbook = buildXlsxWorkbook();
  const blob = new Blob([workbook], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Horario_Service_Desk_${exportScopeName()}_${String(state.month + 1).padStart(2, "0")}-${state.year}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

function exportWeekPdf(weekBlock, weekKey) {
  const exportNode = buildWeekExportNode(weekBlock);
  const exportTitle = exportWeekPdfTitle(weekKey);
  const token = `pdf-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    localStorage.setItem(
      `ucen_pdf_export_${token}`,
      JSON.stringify({
        title: exportTitle,
        html: exportNode.innerHTML,
      }),
    );
  } catch {
    showRulesError("No se pudo preparar la exportacion PDF. Intenta nuevamente.");
    return;
  }
  const printWindow = window.open(`exportar-pdf.html?token=${encodeURIComponent(token)}`, "_blank");
  if (!printWindow) {
    localStorage.removeItem(`ucen_pdf_export_${token}`);
    showRulesError("El navegador bloqueó la ventana de PDF. Permite ventanas emergentes para exportar.");
    return;
  }
  printWindow.focus();
}

function exportWeekPdfTitle(weekKey) {
  const weeks = getMonthWeeks(state.year, state.month);
  const weekNumber = Math.max(1, weeks.findIndex((week) => dateKey(week[0]) === weekKey) + 1);
  const month = String(state.month + 1).padStart(2, "0");
  return `Exportacion semana ${weekNumber}/${month}/${state.year}`;
}

function buildWeekExportNode(weekBlock) {
  const wrapper = document.createElement("section");
  wrapper.className = "week-export-sheet";
  const clone = weekBlock.cloneNode(true);
  clone.classList.remove("collapsed-week");
  clone.querySelectorAll(".export-hidden, .week-toggle").forEach((node) => node.remove());
  clone.querySelectorAll(".locked-mark").forEach((node) => node.remove());
  wrapper.append(buildExportHeaderNode());
  wrapper.append(clone);
  return wrapper;
}

function buildExportHeaderNode() {
  const header = document.createElement("header");
  header.className = "topbar export-pdf-header";
  header.innerHTML = `
    <div>
      <p class="eyebrow">Dirección de Transformación Digital Educativa DTDE</p>
      <h1>Equipo de Tutoría y Acompañamiento</h1>
    </div>
  `;
  return header;
}

function downloadUrl(url, filename) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
}

function buildXlsxWorkbook() {
  const files = {
    "[Content_Types].xml": contentTypesXml(),
    "_rels/.rels": rootRelsXml(),
    "xl/workbook.xml": workbookXml(),
    "xl/_rels/workbook.xml.rels": workbookRelsXml(),
    "xl/styles.xml": workbookStylesXml(),
    "xl/worksheets/sheet1.xml": scheduleWorksheetXml(),
  };
  return createZip(files);
}

function exportScopeName() {
  const names = {
    month: "Mes_completo",
    week: `Semana_${formatDate(selectedWeekKey || defaultSelectedWeekKey()).replaceAll("/", "-")}`,
    "my-week": `Mis_turnos_semana_${formatDate(selectedWeekKey || defaultSelectedWeekKey()).replaceAll("/", "-")}`,
    "my-month": "Mis_turnos_mes",
  };
  return names[calendarViewMode] || "Mes_completo";
}

function scheduleWorksheetXml() {
  const weeks = visibleWeeks();
  const agents = visibleAgents();
  const rows = [];
  const merges = [];
  const colCount = 8;

  rows.push(xlsxRow(1, [
    blankCell("A1"),
    blankCell("B1"),
    xlsxCell("C1", "Turno", "header"),
    xlsxCell("D1", "Lunes y Martes", "header"),
    xlsxCell("E1", "Miércoles a Viernes", "header"),
  ]));
  rows.push(xlsxRow(2, [
    blankCell("A2"),
    blankCell("B2"),
    xlsxCell("C2", "A", "shiftA"),
    xlsxCell("D2", "8:30 a 18:30 hrs.", "bold"),
    xlsxCell("E2", "8:30 a 17:30 hrs.", "bold"),
    xlsxCell("F2", "Presencial", "onsite"),
    xlsxCell("G2", "Administrativo", "admin"),
    xlsxCell("H2", "Feriado", "holiday"),
  ]));
  rows.push(xlsxRow(3, [
    blankCell("A3"),
    blankCell("B3"),
    xlsxCell("C3", "B", "shiftB"),
    xlsxCell("D3", "10:30 a 20:30 hrs.", "bold"),
    xlsxCell("E3", "10:30 a 17:30 hrs.", "bold"),
    xlsxCell("F3", "Remoto", "remote"),
    xlsxCell("G3", "Licencia médica", "medical"),
    xlsxCell("H3", "Receso", "recess"),
  ]));
  rows.push(xlsxRow(4, [
    blankCell("A4"),
    blankCell("B4"),
    xlsxCell("C4", "Teletrabajo", "remote"),
    blankCell("D4", "remote"),
    blankCell("E4", "remote"),
    blankCell("F4"),
    xlsxCell("G4", "Sindicato", "union"),
    xlsxCell("H4", "Obligatorio", "mandatory"),
  ]));
  merges.push("C4:E4");
  rows.push(xlsxRow(5, Array.from({ length: colCount }, (_, index) => blankCell(`${columnName(index + 1)}5`, "blank"))));

  let rowIndex = 6;

  weeks.forEach((week) => {
    const weekKey = dateKey(week[0]);
    rows.push(xlsxRow(rowIndex, [
      xlsxCell(`A${rowIndex}`, "", "header"),
      xlsxCell(`B${rowIndex}`, "Tutor", "header"),
      ...week.map((date, index) => xlsxCell(`${columnName(index + 3)}${rowIndex}`, dayNames[isoDay(date) - 1].toUpperCase(), "header")),
      xlsxCell(`H${rowIndex}`, "SABADO", "header"),
    ]));
    rowIndex += 1;
    const firstAgentRow = rowIndex;
    agents.forEach((agent) => {
      rows.push(xlsxRow(rowIndex, [
        xlsxCell(`A${rowIndex}`, rowIndex === firstAgentRow ? `Semana\n${formatDate(weekKey)}` : "", "week"),
        xlsxCell(`B${rowIndex}`, agent.name, "agent"),
        ...week.map((date, index) => scheduleXlsxCell(`${columnName(index + 3)}${rowIndex}`, weekKey, agent.id, dateKey(date))),
        xlsxCell(`H${rowIndex}`, "", "holiday"),
      ]));
      rowIndex += 1;
    });
    if (agents.length > 1) merges.push(`A${firstAgentRow}:A${rowIndex - 1}`);
    rows.push(xlsxRow(rowIndex, Array.from({ length: colCount }, (_, index) => blankCell(`${columnName(index + 1)}${rowIndex}`, "blank"))));
    rowIndex += 1;
  });

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
    <sheetViews><sheetView workbookViewId="0"/></sheetViews>
    <sheetFormatPr defaultRowHeight="18"/>
    <cols>
      <col min="1" max="8" width="16" customWidth="1"/>
    </cols>
    <sheetData>${rows.join("")}</sheetData>
    <mergeCells count="${merges.length}">${merges.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>
  </worksheet>
  `;
}

function scheduleXlsxCell(ref, weekKey, agentId, dayKey) {
  const cell = state.schedule[weekKey]?.[agentId]?.[dayKey] || { status: "A-onsite" };
  const option = options[cell.status] || options["A-onsite"];
  const style = isUnionStatus(cell)
    ? "union"
    : getMode(cell) === "remote"
      ? "remote"
      : cell.status === "admin"
      ? "admin"
      : ["admin_morning", "admin_afternoon"].includes(cell.status)
        ? "admin-partial"
      : cell.status === "medical"
        ? "medical"
        : cell.status === "holiday"
          ? "holiday"
          : cell.status === "recess"
            ? "recess"
            : cell.note === "Asistencia obligatoria"
            ? "mandatory"
            : "";
  return xlsxCell(ref, exportCode(cell, option), style || "onsite");
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="xml" ContentType="application/xml"/>
    <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
    <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
    <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  </Types>`;
}

function rootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  </Relationships>`;
}

function workbookXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
    <sheets><sheet name="Horario" sheetId="1" r:id="rId1"/></sheets>
  </workbook>`;
}

function workbookRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
    <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  </Relationships>`;
}

function workbookStylesXml() {
  const fills = ["FFFFFF", "EEF1F7", "CFE5FF", "6F93B3", "EAD7AA", "004680", "818F9F", "002147", "0072E5", "F4F6FA"];
  const fillXml = [
    '<fill><patternFill patternType="none"/></fill>',
    '<fill><patternFill patternType="gray125"/></fill>',
    ...fills.map((color) => `<fill><patternFill patternType="solid"><fgColor rgb="FF${color}"/><bgColor indexed="64"/></patternFill></fill>`),
  ].join("");
  const styles = [
    { fill: 2, border: 1 },
    { fill: 3, border: 1, font: 1 },
    { fill: 4, border: 1, font: 1 },
    { fill: 5, border: 1, font: 1 },
    { fill: 2, border: 1, font: 1 },
    { fill: 5, border: 1, font: 1 },
    { fill: 6, border: 1, font: 1 },
    { fill: 7, border: 1, font: 2 },
    { fill: 6, border: 1, font: 1 },
    { fill: 8, border: 1, font: 1 },
    { fill: 9, border: 1, font: 2 },
    { fill: 10, border: 1, font: 2 },
    { fill: 3, border: 1, font: 1, wrap: true },
    { fill: 2, border: 1, font: 1 },
    { fill: 2, border: 0 },
    { fill: 2, border: 1 },
    { fill: 11, border: 1, font: 1 },
  ];
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
    <fonts count="3">
      <font><sz val="12"/><name val="Calibri"/></font>
      <font><b/><sz val="12"/><name val="Calibri"/></font>
      <font><b/><sz val="12"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    </fonts>
    <fills count="${fills.length + 2}">${fillXml}</fills>
    <borders count="2">
      <border><left/><right/><top/><bottom/><diagonal/></border>
      <border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border>
    </borders>
    <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
    <cellXfs count="${styles.length}">
      ${styles.map((style) => `<xf numFmtId="0" fontId="${style.font || 0}" fillId="${style.fill}" borderId="${style.border}" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"${style.wrap ? ' wrapText="1"' : ""}/></xf>`).join("")}
    </cellXfs>
    <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
    <dxfs count="0"/>
    <tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
  </styleSheet>`;
}

function xlsxRow(rowIndex, cells) {
  return `<row r="${rowIndex}">${cells.join("")}</row>`;
}

function blankCell(ref, style = "blank") {
  return `<c r="${ref}" s="${xlsxStyleIndex(style)}"/>`;
}

function xlsxCell(ref, value, style = "onsite") {
  return `<c r="${ref}" t="inlineStr" s="${xlsxStyleIndex(style)}"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
}

function xlsxStyleIndex(style) {
  const styles = {
    default: 0,
    header: 1,
    shiftA: 2,
    shiftB: 3,
    bold: 4,
    remote: 5,
    admin: 6,
    "admin-partial": 6,
    medical: 7,
    union: 8,
    holiday: 9,
    recess: 10,
    mandatory: 11,
    week: 12,
    agent: 13,
    blank: 14,
    onsite: 15,
    expired: 16,
  };
  return styles[style] ?? styles.default;
}

function columnName(index) {
  let name = "";
  while (index > 0) {
    index -= 1;
    name = String.fromCharCode(65 + (index % 26)) + name;
    index = Math.floor(index / 26);
  }
  return name;
}

function xmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function createZip(files) {
  const encoder = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  Object.entries(files).forEach(([name, content]) => {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    chunks.push(local, data);

    const centralEntry = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralEntry.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralEntry.set(nameBytes, 46);
    central.push(centralEntry);
    offset += local.length + data.length;
  });

  const centralOffset = offset;
  const centralSize = central.reduce((sum, entry) => sum + entry.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, central.length, true);
  endView.setUint16(10, central.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, centralOffset, true);
  return concatBytes([...chunks, ...central, end]);
}

function concatBytes(parts) {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.length;
  });
  return output;
}

function crc32(bytes) {
  const table = crc32.table || (crc32.table = buildCrc32Table());
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = (crc >>> 8) ^ table[(crc ^ bytes[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildCrc32Table() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let crc = i;
    for (let j = 0; j < 8; j += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    table[i] = crc >>> 0;
  }
  return table;
}

function exportCode(cell, option) {
  if (cell.status === "holiday") return "FERIADO";
  if (cell.status === "recess") return "RECESO";
  if (cell.status === "admin") return "ADMINISTRATIVO";
  if (cell.status === "admin_morning") return "ADM A";
  if (cell.status === "admin_afternoon") return "ADM B";
  if (cell.status === "medical") return "LM";
  if (isUnionStatus(cell)) return `${getShift(cell)} SIND`;
  return option.code.replace("-R", "");
}

function getMonthWeeks(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const weeks = [];
  const cursor = new Date(start);
  while (cursor <= last || cursor.getDay() !== 1) {
    const week = [];
    for (let i = 0; i < 5; i += 1) {
      const date = new Date(cursor);
      date.setDate(cursor.getDate() + i);
      week.push(date);
    }
    if (week.some((date) => date.getMonth() === month)) weeks.push(week);
    cursor.setDate(cursor.getDate() + 7);
    if (cursor > new Date(year, month + 1, 7)) break;
  }
  return weeks;
}

function specialFor(key) {
  return state.specialDays.find((item) => item.date === key);
}

function absenceFor(agentId, key) {
  return state.absences.find((item) => {
    if (item.agentId !== agentId) return false;
    if (key < item.from) return false;
    if (item.indefinite) return true;
    return key <= item.to;
  });
}

function isoDay(date) {
  return date.getDay() === 0 ? 7 : date.getDay();
}

function dateKey(date) {
  if (typeof date === "string") return date;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDate(key) {
  const [year, month, day] = key.split("-");
  return `${day}/${month}/${String(year).slice(2)}`;
}

function shiftSummaryText() {
  return "A: 8:30-18:30 / 17:30 (M-J-V) | B: 10:30-20:30 / 17:30 (M-J-V)";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function agentIdentityHtml(agent) {
  const avatar = avatarContentHtml(agent);
  return `<div class="agent-identity"><div class="agent-avatar">${avatar}</div><span>${escapeHtml(agent.name)}</span></div>`;
}

function avatarContentHtml(person = {}) {
  return person.photo
    ? `<img src="${escapeHtml(person.photo)}" alt="${escapeHtml(person.name || "Usuario")}" />`
    : `<span>${personInitials(person.name)}</span>`;
}

function agentInitials(name = "") {
  return personInitials(name);
}

function personInitials(name = "") {
  const initials = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
  return escapeHtml(initials || "?");
}

function resizePhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const image = new Image();
      image.onerror = reject;
      image.onload = () => {
        const scale = Math.min(1, maxPhotoSize / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

init().catch((error) => {
  console.error(error);
  redirectToLogin();
});

