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

let state = null;
let currentUser = null;
let saveTimer = null;
let eventsBound = false;
let selectedCell = null;
let users = [];
let selectedResetUserId = null;
let calendarViewMode = "month";
let selectedWeekKey = "";
const collapsedWeeks = new Set();
const maxPhotoSize = 240;

const el = {
  appShell: document.querySelector("#appShell"),
  sessionAvatar: document.querySelector("#sessionAvatar"),
  sessionRole: document.querySelector("#sessionRole"),
  sessionName: document.querySelector("#sessionName"),
  profilePhotoInput: document.querySelector("#profilePhotoInput"),
  profilePhotoBtn: document.querySelector("#profilePhotoBtn"),
  passwordBtn: document.querySelector("#passwordBtn"),
  logoutBtn: document.querySelector("#logoutBtn"),
  passwordDialog: document.querySelector("#passwordDialog"),
  currentPasswordInput: document.querySelector("#currentPasswordInput"),
  newPasswordInput: document.querySelector("#newPasswordInput"),
  passwordMessage: document.querySelector("#passwordMessage"),
  savePasswordBtn: document.querySelector("#savePasswordBtn"),
  usersPanel: document.querySelector("#usersPanel"),
  usersList: document.querySelector("#usersList"),
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
  exportBtn: document.querySelector("#exportBtn"),
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
  el.appShell.hidden = false;
  el.appShell.classList.toggle("readonly", !editable);
  el.sessionName.textContent = currentUser?.name || "Usuario";
  el.sessionRole.textContent = roleLabel(currentUser?.role);
  if (el.sessionAvatar) el.sessionAvatar.innerHTML = avatarContentHtml(currentProfilePerson());
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
    cafe_digital: "Café Digital",
  };
  return labels[role] || "Consulta";
}

function bindEvents() {
  if (eventsBound) return;
  eventsBound = true;
  el.monthSelect.addEventListener("change", () => {
    if (!canEdit()) return;
    state.month = Number(el.monthSelect.value);
    generateSchedule();
  });
  el.yearInput.addEventListener("change", () => {
    if (!canEdit()) return;
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
  el.generateBtn.addEventListener("click", generateSchedule);
  el.exportBtn.addEventListener("click", exportExcel);
  el.resetBtn.addEventListener("click", async () => {
    if (!canEdit()) return;
    if (!confirm("¿Restaurar agentes y configuración inicial?")) return;
    const response = await fetch("/api/reset-state", { method: "POST" });
    const payload = await response.json();
    state = payload.state;
    generateSchedule();
  });
  el.addAgentBtn.addEventListener("click", () => {
    if (!canEdit()) return;
    state.agents.push({ id: crypto.randomUUID(), name: "Nuevo agente", order: state.agents.length, photo: "" });
    generateSchedule();
  });
  el.addSpecialBtn.addEventListener("click", addSpecialDay);
  el.addLockBtn.addEventListener("click", addRecurringLock);
  el.addAbsenceBtn.addEventListener("click", addAbsence);
  el.saveCellBtn.addEventListener("click", saveCellEdit);
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
  renderUsers();
}

function generateSchedule() {
  if (!canEdit()) return;
  const previousSchedule = state.schedule || {};
  const weeks = getMonthWeeks(state.year, state.month);
  const schedule = {};
  const fridayB = new Set();

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

        if (special?.type === "mandatory") cell = { status: "A-onsite", locked: true, note: "Asistencia obligatoria" };
        else if (isClosedSpecial(special)) cell = { status: special.type, locked: true, note: specialLabel(special.type) };
        else if (absence) cell = { status: absence.type, locked: true, note: absenceLabel(absence.type) };
        else if (recurringLock?.mode === "remote") cell = { status: "A-remote", locked: true, note: "Bloqueo recurrente" };
        else if (recurringLock?.mode === "onsite") cell = { status: "A-onsite", locked: true, note: "Bloqueo recurrente" };
        schedule[weekKey][agent.id][key] = cell;
      });
    });

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

  lockExpiredDays(schedule, previousSchedule);

  state.schedule = schedule;
  saveState();
  render();
}

function assignMonthlyFridayB(schedule, weekKey, friday, fridayB, weekIndex) {
  const dayKey = dateKey(friday);
  const candidates = activeAgentsForDay(schedule, weekKey, dayKey).filter((agent) => !fridayB.has(agent.id));
  if (!candidates.length) return;
  const target = candidates[weekIndex % candidates.length];
  setShift(schedule[weekKey][target.id][dayKey], "B");
  setMode(schedule[weekKey][target.id][dayKey], "onsite");
  fridayB.add(target.id);
}

function applyManualOverrides(schedule) {
  Object.entries(state.manualOverrides || {}).forEach(([key, override]) => {
    const [weekKey, agentId, dayKey] = key.split("|");
    if (isExpiredDay(dayKey)) return;
    if (specialFor(dayKey)?.type === "mandatory") return;
    if (schedule[weekKey]?.[agentId]?.[dayKey]) {
      schedule[weekKey][agentId][dayKey] = { ...schedule[weekKey][agentId][dayKey], ...override };
    }
  });
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
  const workDays = week.filter((date) => isEditableWorkCell(schedule[weekKey]?.[agentId]?.[dateKey(date)])).length;
  if (!workDays) return 0;
  const activeAgentIds = state.agents
    .filter((agent) => week.some((date) => isEditableWorkCell(schedule[weekKey]?.[agent.id]?.[dateKey(date)])))
    .map((agent) => agent.id);
  const weeklyCapacity = week.reduce((sum, date) => {
    const dayKey = dateKey(date);
    return sum + dailyRemoteCapacity(schedule, weekKey, dayKey);
  }, 0);
  const maxDesired = activeAgentIds.reduce((sum, id) => {
    const days = week.filter((date) => isEditableWorkCell(schedule[weekKey]?.[id]?.[dateKey(date)])).length;
    return sum + Math.min(2, days);
  }, 0);
  if (weeklyCapacity >= maxDesired) return Math.min(2, workDays);
  const agentPosition = activeAgentIds.indexOf(agentId);
  if (agentPosition < 0) return 0;
  const base = Math.floor(weeklyCapacity / activeAgentIds.length);
  const extra = weeklyCapacity % activeAgentIds.length;
  const rotationPosition = (agentPosition + weekIndex) % activeAgentIds.length;
  return Math.min(2, workDays, base + (rotationPosition < extra ? 1 : 0));
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
  const weeks = getMonthWeeks(state.year, state.month);
  const monthFridayWeeks = weeks.filter((week) => {
    const friday = week.find((date) => isoDay(date) === 5 && date.getMonth() === state.month);
    return Boolean(friday);
  });
  state.agents.forEach((agent) => {
    const fridayBWeeks = monthFridayWeeks.filter((week) => {
      const friday = week.find((date) => isoDay(date) === 5 && date.getMonth() === state.month);
      return friday && isOnsiteShift(schedule[dateKey(week[0])]?.[agent.id]?.[dateKey(friday)], "B");
    });

    fridayBWeeks.slice(1).forEach((week) => {
      const weekKey = dateKey(week[0]);
      const friday = week.find((date) => isoDay(date) === 5 && date.getMonth() === state.month);
      const fridayKey = dateKey(friday);
      const fridayCell = schedule[weekKey]?.[agent.id]?.[fridayKey];
      if (!canAdjustWorkCell(fridayCell)) return;
      setShift(fridayCell, "A");
    });

    if (fridayBWeeks.length) return;

    for (const week of monthFridayWeeks) {
      const weekKey = dateKey(week[0]);
      const friday = week.find((date) => isoDay(date) === 5 && date.getMonth() === state.month);
      if (!friday) continue;
      const fridayKey = dateKey(friday);
      const fridayCell = schedule[weekKey]?.[agent.id]?.[fridayKey];
      if (!canAdjustWorkCell(fridayCell)) continue;

      setShift(fridayCell, "B");
      setMode(fridayCell, "onsite");
      const extraB = week
        .filter((date) => isoDay(date) !== 5)
        .map((date) => schedule[weekKey][agent.id][dateKey(date)])
        .find((cell) => isWorkShift(cell, "B") && canAdjustWorkCell(cell));
      if (extraB) setShift(extraB, "A");
      break;
    }
  });
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
      const bRange = weeklyBRange(schedule, weekKey, week);

      for (const date of week) {
        if (bCount <= bRange.max) break;
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

function weeklyBRange(schedule, weekKey, week) {
  const activeAgentIds = state.agents
    .filter((agent) => week.some((date) => isEditableWorkCell(schedule[weekKey]?.[agent.id]?.[dateKey(date)])))
    .map((agent) => agent.id);
  if (!activeAgentIds.length) return { min: 0, max: 0 };

  const totalDailyBTarget = week.reduce((sum, date) => {
    const dayKey = dateKey(date);
    const activeCount = state.agents.filter((agent) => isEditableWorkCell(schedule[weekKey]?.[agent.id]?.[dayKey])).length;
    return sum + Math.floor(activeCount / 2);
  }, 0);

  return {
    min: Math.floor(totalDailyBTarget / activeAgentIds.length),
    max: Math.ceil(totalDailyBTarget / activeAgentIds.length),
  };
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
  renderSelectors();
  renderAgents();
  renderLists();
  renderUsers();
  renderCalendar();
  renderRules();
  saveState();
}

function renderSelectors() {
  const lockValue = el.lockAgentInput.value;
  const absenceValue = el.absenceAgentInput.value;
  const weeks = getMonthWeeks(state.year, state.month);
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
  el.weekSelectLabel.hidden = !isWeeklyView();
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
  const modes = [
    ["month", "Todo el mes"],
    ["week", "Solo la semana"],
  ];
  if (currentUser?.role === "tutor") {
    modes.push(["my-week", "Mis turnos semanales"], ["my-month", "Mis turnos mensuales"]);
  }
  if (!modes.some(([value]) => value === calendarViewMode)) calendarViewMode = "month";
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
      agent.name = input.value.trim() || "Agente sin nombre";
      generateSchedule();
    });
    const photoInput = document.createElement("input");
    photoInput.type = "file";
    photoInput.accept = "image/*";
    photoInput.className = "visually-hidden";
    photoInput.disabled = !canEdit();
    photoInput.addEventListener("change", async () => {
      if (!canEdit() || !photoInput.files?.[0]) return;
      try {
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
      state.agents = state.agents.filter((item) => item.id !== agent.id);
      generateSchedule();
    });
    row.append(avatar, input, photoInput, photoButton, clearPhoto, remove);
    el.agentsList.append(row);
  });
}

function renderLists() {
  renderSimpleList(el.specialDaysList, state.specialDays, (item) => {
    const label = specialLabel(item.type);
    return `<strong>${formatDate(item.date)}</strong><small>${label}</small>`;
  });
  renderSimpleList(el.locksList, state.recurringLocks, (item) => {
    const agent = state.agents.find((candidate) => candidate.id === item.agentId);
    return `<strong>${agent?.name || "Agente eliminado"}</strong><small>${dayNames[item.day - 1]} | ${item.mode === "remote" ? "Remoto" : "Presencial"}</small>`;
  });
  renderSimpleList(el.absencesList, state.absences, (item) => {
    const agent = state.agents.find((candidate) => candidate.id === item.agentId);
    const type = absenceLabel(item.type);
    const to = item.indefinite ? "indefinida" : formatDate(item.to);
    return `<strong>${agent?.name || "Agente eliminado"}</strong><small>${type} | ${formatDate(item.from)} a ${to}</small>`;
  });
}

function renderUsers() {
  if (!el.usersList || !canEdit()) return;
  el.usersList.innerHTML = "";
  users.forEach((user) => {
    const row = document.createElement("div");
    row.className = "list-row";
    const text = document.createElement("div");
    text.innerHTML = `<strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(roleLabel(user.role))} | ${escapeHtml(user.email)}${user.mustChangePassword ? " | cambio pendiente" : ""}</small>`;
    const reset = document.createElement("button");
    reset.className = "mini-button";
    reset.textContent = "Reset";
    reset.addEventListener("click", () => openResetPassword(user.id));
    row.append(text, reset);
    el.usersList.append(row);
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
  renderUsers();
  showApp();
}

function renderSimpleList(container, list, labeler) {
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
      remove.textContent = "Quitar";
      remove.disabled = !canEdit();
      remove.addEventListener("click", () => {
        removeItem(item.id);
      });
      row.append(text, remove);
      container.append(row);
    });
}

function renderCalendar() {
  el.calendarView.innerHTML = "";
  const agents = visibleAgents();
  const weeklyIssues = weeklyRuleIssues();
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
          ${canCollapse ? `<button class="week-toggle" type="button">${collapsed ? "Expandir" : "Colapsar"}</button>` : ""}
        </div>
      </div>
    `;
    const toggle = block.querySelector(".week-toggle");
    toggle?.addEventListener("click", () => {
      if (collapsedWeeks.has(weekKey)) collapsedWeeks.delete(weekKey);
      else collapsedWeeks.add(weekKey);
      renderCalendar();
    });
    const body = document.createElement("div");
    body.className = "week-body";
    const issues = weeklyIssues.get(weekKey) || [];
    if (canEdit() && issues.length) {
      const issueBox = document.createElement("section");
      issueBox.className = "week-issues";
      issueBox.innerHTML = `
        <p class="rule-message"><strong>Incongruencias de la semana:</strong></p>
        ${issues.map((issue) => `<p class="rule-message">• ${escapeHtml(issue)}</p>`).join("")}
      `;
      body.append(issueBox);
    }
    const table = document.createElement("table");
    table.className = "schedule-table";
    table.innerHTML = `
      <thead>
        <tr>
          <th>Tutor</th>
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
        button.className = `cell-btn ${option.className}${cell.note === "Asistencia obligatoria" ? " status-mandatory" : ""}${expired ? " expired-cell" : ""}`;
        button.disabled = expired || !canEdit();
        button.innerHTML = `
          <strong>${option.code}${(cell.locked || expired) && !isClosedCell(cell) ? '<span class="locked-mark">Bloq.</span>' : ""}</strong>
          <span>${option.label}</span>
          ${expired ? `<span>Día vencido</span>` : cell.note ? `<span>${escapeHtml(cell.note)}</span>` : ""}
        `;
        button.addEventListener("click", () => openCellEditor(weekKey, agent.id, key));
        td.append(button);
        row.append(td);
      });
      tbody.append(row);
    });
    body.append(table);
    block.append(body);
    el.calendarView.append(block);
  });
}

function visibleWeeks() {
  const weeks = getMonthWeeks(state.year, state.month);
  if (!isWeeklyView()) return weeks;
  const weekKey = selectedWeekKey || defaultSelectedWeekKey(weeks);
  return weeks.filter((week) => dateKey(week[0]) === weekKey);
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
  el.rulesPanel.className = `rules-panel ${issues.length ? "warn" : "ok"}`;
  el.rulesPanel.innerHTML = `
    <p class="rule-message"><strong>Reglas vigentes:</strong> cada agente activo queda con hasta 2 dias remotos semanales segun dotacion disponible, idealmente con 1 remoto A y 1 remoto B por dia, turnos B balanceados por semana y 1 viernes B presencial mensual cuando hay disponibilidad.</p>
    <p class="rule-message"><strong>Cobertura diaria:</strong> cada dia habil mantiene al menos un tutor presencial en turno A y uno presencial en turno B, respetando bloqueos y ausencias.</p>
    <p class="rule-message"><strong>Salida sindicato:</strong> descuenta las ultimas dos horas de la jornada, pero cuenta dentro del total del turno y modalidad asignados.</p>
    ${issues.length ? '<p class="rule-message"><strong>Incongruencias:</strong> revisa el detalle bajo cada semana desplegada.</p>' : ""}
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
      const cells = week
        .map((date) => ({ date, key: dateKey(date), cell: state.schedule[weekKey]?.[agent.id]?.[dateKey(date)] }))
        .filter(({ cell, key }) => cell && !isExpiredDay(key));
      const workCells = cells.filter(({ cell }) => isEditableWorkCell(cell));
      const remote = workCells.filter(({ cell }) => getMode(cell) === "remote").length;
      const remoteTarget = weeklyRemoteTarget(state.schedule, weekKey, week, agent.id, weekIndex);
      const bShifts = workCells.filter(({ cell }) => isWorkShift(cell, "B")).length;
      const bRange = weeklyBRange(state.schedule, weekKey, week);
      const unavailable = cells.filter(({ cell }) => isUnavailableStatus(cell.status)).length;
      const unionCount = cells.filter(({ cell }) => isUnionStatus(cell)).length;
      if (unionCount && !canUseUnion(agent.name)) {
        issues.push(`${agent.name}: salida sindicato solo aplica para Denisse Bravo y Monserrat Vargas.`);
      }
      if (workCells.length >= 2 && remote !== remoteTarget) {
        issues.push(`${agent.name}: tiene ${remote} remoto(s), deben ser ${remoteTarget}.`);
      }
      if (workCells.length >= 2 && (bShifts < bRange.min || bShifts > bRange.max)) {
        issues.push(`${agent.name}: tiene ${bShifts} turno(s) B, deben estar entre ${bRange.min} y ${bRange.max}.`);
      }
      if (workCells.length < 2 && unavailable > 0) {
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
      const dayCells = state.agents.map((agent) => state.schedule[weekKey]?.[agent.id]?.[dayKey]).filter(Boolean);
      if (!dayCells.length || dayCells.every(isClosedCell)) return;
      const activeCells = dayCells.filter(isEditableWorkCell);
      const onsiteA = activeCells.some((cell) => getShift(cell) === "A" && getMode(cell) === "onsite");
      const onsiteB = activeCells.some((cell) => getShift(cell) === "B" && getMode(cell) === "onsite");
      const remoteA = activeCells.filter((cell) => getShift(cell) === "A" && getMode(cell) === "remote").length;
      const remoteB = activeCells.filter((cell) => getShift(cell) === "B" && getMode(cell) === "remote").length;
      if (activeCells.length >= 2 && (!onsiteA || !onsiteB)) {
        issues.push(`${dayNames[isoDay(date) - 1]} ${formatDate(dayKey)}: debe haber al menos un tutor presencial en A y uno presencial en B.`);
      }
      if (remoteA > dailyRemoteShiftCapacity(state.schedule, weekKey, dayKey, "A") || remoteB > dailyRemoteShiftCapacity(state.schedule, weekKey, dayKey, "B")) {
        issues.push(`${dayNames[isoDay(date) - 1]} ${formatDate(dayKey)}: los remotos deben distribuirse como maximo 1 en A y 1 en B.`);
      }
      if (activeCells.length < 2) {
        issues.push(`${dayNames[isoDay(date) - 1]} ${formatDate(dayKey)}: no hay dotacion suficiente para cubrir A presencial y B presencial.`);
      }
    });

    if (issues.length) byWeek.set(weekKey, issues);
  });

  state.agents.forEach((agent) => {
    const fridayCount = monthFridayB.get(agent.id) || 0;
    if (monthFridayWeek.has(agent.id) && fridayCount !== 1) {
      const weekKey = monthFridayWeek.get(agent.id);
      const issues = byWeek.get(weekKey) || [];
      issues.push(`${agent.name}: tiene ${fridayCount} viernes B presencial durante ${monthNames[state.month]}, debe tener 1.`);
      byWeek.set(weekKey, issues);
    }
  });

  return byWeek;
}

function validateRules() {
  const issues = [];
  weeklyRuleIssues().forEach((weekIssues) => issues.push(...weekIssues));
  return issues.slice(0, 20);
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
  el.cellLockedInput.checked = Boolean(cell.locked);
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
  const override = {
    status: el.cellStatusInput.value,
    locked: el.cellLockedInput.checked,
    note: el.cellLockedInput.checked ? "Bloqueo manual" : "",
  };
  if (override.locked) {
    applyManualLockToFutureWeeks(agentId, dayKey, override);
  } else {
    state.manualOverrides[key] = override;
  }
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
  state.specialDays = state.specialDays.filter((item) => item.date !== el.specialDateInput.value);
  state.specialDays.push({ id: crypto.randomUUID(), date: el.specialDateInput.value, type: el.specialTypeInput.value });
  generateSchedule();
}

function addRecurringLock() {
  if (!canEdit()) return;
  if (!el.lockAgentInput.value) return;
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
  state.specialDays = state.specialDays.filter((item) => item.id !== id);
  state.recurringLocks = state.recurringLocks.filter((item) => item.id !== id);
  state.absences = state.absences.filter((item) => item.id !== id);
  generateSchedule();
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
    xlsxCell("E3", "10:30 a 19:30 hrs.", "bold"),
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
  const fills = ["FFFFFF", "EEF1F7", "CFE5FF", "90ABC4", "F6EFE0", "D8E1EA", "818F9F", "B7C4D1", "F4F6FA"];
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
    { fill: 7, border: 1, font: 1 },
    { fill: 6, border: 1, font: 1 },
    { fill: 8, border: 1, font: 1 },
    { fill: 9, border: 1, font: 1 },
    { fill: 4, border: 1, font: 1 },
    { fill: 3, border: 1, font: 1, wrap: true },
    { fill: 2, border: 1, font: 1 },
    { fill: 2, border: 0 },
    { fill: 2, border: 1 },
    { fill: 10, border: 1, font: 1 },
  ];
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
    <fonts count="2">
      <font><sz val="12"/><name val="Calibri"/></font>
      <font><b/><sz val="12"/><name val="Calibri"/></font>
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
  return "A: 8:30-18:30 / 17:30 | B: 10:30-20:30 / 19:30";
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

