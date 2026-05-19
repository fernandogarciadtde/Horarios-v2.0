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
  medical: { shift: null, mode: "absent", label: "Licencia médica", code: "LM", className: "status-medical" },
  holiday: { shift: null, mode: "closed", label: "Feriado", code: "FERIADO", className: "status-holiday" },
};

let state = null;
let currentUser = null;
let saveTimer = null;
let eventsBound = false;
let selectedCell = null;
let users = [];
let selectedResetUserId = null;

const el = {
  appShell: document.querySelector("#appShell"),
  sessionRole: document.querySelector("#sessionRole"),
  sessionName: document.querySelector("#sessionName"),
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
  el.appShell.hidden = false;
  el.appShell.classList.toggle("readonly", !canEdit());
  el.sessionName.textContent = currentUser?.name || "Usuario";
  el.sessionRole.textContent = roleLabel(currentUser?.role);
  el.usersPanel.hidden = !canEdit();
  if (currentUser?.mustChangePassword) {
    setTimeout(() => el.passwordBtn.click(), 250);
  }
}

function canEdit() {
  return currentUser?.role === "admin";
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
    state.agents.push({ id: crypto.randomUUID(), name: "Nuevo agente", order: state.agents.length });
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

        if (special?.type === "holiday") cell = { status: "holiday", locked: true, note: "Feriado" };
        else if (absence) cell = { status: absence.type === "medical" ? "medical" : "admin", locked: true, note: absence.type === "medical" ? "Licencia médica" : "Día administrativo" };
        else if (recurringLock?.mode === "remote") cell = { status: "A-remote", locked: true, note: "Bloqueo recurrente" };
        else if (recurringLock?.mode === "onsite") cell = { status: "A-onsite", locked: true, note: "Bloqueo recurrente" };
        if (special?.type === "mandatory" && !["holiday", "medical", "admin"].includes(cell.status)) {
          cell.status = "A-onsite";
          cell.note = "Asistencia obligatoria";
        }
        schedule[weekKey][agent.id][key] = cell;
      });
    });

    const friday = week.find((date) => isoDay(date) === 5);
    if (friday) assignMonthlyFridayB(schedule, weekKey, friday, fridayB, weekIndex);
    state.agents.forEach((agent, agentIndex) => assignWeeklyB(schedule, weekKey, week, agent, agentIndex, weekIndex));
    state.agents.forEach((agent, agentIndex) => assignWeeklyRemote(schedule, weekKey, week, agent, agentIndex, weekIndex));
  });

  balanceMonthlyFridayB(schedule);
  enforceDailyOnsiteCoverage(schedule);
  rebalanceWeeklyTargets(schedule);

  Object.entries(state.manualOverrides).forEach(([key, override]) => {
    const [weekKey, agentId, dayKey] = key.split("|");
    if (isExpiredDay(dayKey)) return;
    if (schedule[weekKey]?.[agentId]?.[dayKey]) {
      schedule[weekKey][agentId][dayKey] = { ...schedule[weekKey][agentId][dayKey], ...override };
    }
  });

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
  fridayB.add(target.id);
}

function assignWeeklyB(schedule, weekKey, week, agent, agentIndex, weekIndex) {
  let count = week.filter((date) => isShift(schedule[weekKey][agent.id][dateKey(date)], "B")).length;
  const preferred = [...week].sort((a, b) => rotationScore(a, agentIndex, weekIndex, "B") - rotationScore(b, agentIndex, weekIndex, "B"));
  for (const date of preferred) {
    if (count >= 2) break;
    const key = dateKey(date);
    const cell = schedule[weekKey][agent.id][key];
    if (!canAdjustWorkCell(cell)) continue;
    if (isShift(cell, "B")) continue;
    setShift(cell, "B");
    count += 1;
  }
}

function assignWeeklyRemote(schedule, weekKey, week, agent, agentIndex, weekIndex) {
  let count = week.filter((date) => getMode(schedule[weekKey][agent.id][dateKey(date)]) === "remote").length;
  const preferred = [...week].sort((a, b) => {
    const scoreA = remoteScore(a, agentIndex, weekIndex);
    const scoreB = remoteScore(b, agentIndex, weekIndex);
    return scoreA - scoreB;
  });
  for (const date of preferred) {
    if (count >= 2) break;
    const key = dateKey(date);
    const cell = schedule[weekKey][agent.id][key];
    if (!canAdjustWorkCell(cell) || cell.note === "Asistencia obligatoria") continue;
    if (getMode(cell) === "remote") continue;
    setMode(cell, "remote");
    count += 1;
  }
}

function balanceMonthlyFridayB(schedule) {
  const weeks = getMonthWeeks(state.year, state.month);
  state.agents.forEach((agent) => {
    const hasFridayB = weeks.some((week) => {
      const friday = week.find((date) => isoDay(date) === 5);
      if (!friday) return false;
      return getShift(schedule[dateKey(week[0])]?.[agent.id]?.[dateKey(friday)]) === "B";
    });
    if (hasFridayB) return;

    for (const week of weeks) {
      const weekKey = dateKey(week[0]);
      const friday = week.find((date) => isoDay(date) === 5);
      if (!friday) continue;
      const fridayKey = dateKey(friday);
      const fridayCell = schedule[weekKey]?.[agent.id]?.[fridayKey];
      if (!canAdjustWorkCell(fridayCell)) continue;

      setShift(fridayCell, "B");
      const extraB = week
        .filter((date) => isoDay(date) !== 5)
        .map((date) => schedule[weekKey][agent.id][dateKey(date)])
        .find((cell) => getShift(cell) === "B" && canAdjustWorkCell(cell));
      if (extraB) setShift(extraB, "A");
      break;
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
      if (cells.every(({ cell }) => cell?.status === "holiday")) return;
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
  getMonthWeeks(state.year, state.month).forEach((week) => {
    const weekKey = dateKey(week[0]);
    week.forEach((date) => {
      const dayKey = dateKey(date);
      const dayCells = state.agents.map((agent) => state.schedule[weekKey]?.[agent.id]?.[dayKey]).filter(Boolean);
      if (dayCells.every((cell) => cell.status === "holiday")) return;
      const activeCells = dayCells.filter(isEditableWorkCell);
      const onsiteA = activeCells.filter((cell) => getShift(cell) === "A" && getMode(cell) === "onsite").length;
      const onsiteB = activeCells.filter((cell) => getShift(cell) === "B" && getMode(cell) === "onsite").length;
      if (activeCells.length >= 2 && (onsiteA < 1 || onsiteB < 1)) {
        issues.push(`${dayNames[isoDay(date) - 1]} ${formatDate(dayKey)}: debe haber al menos un tutor presencial en A y uno presencial en B.`);
      }
      if (activeCells.length < 2 && dayCells.some((cell) => cell.status !== "holiday")) {
        issues.push(`${dayNames[isoDay(date) - 1]} ${formatDate(dayKey)}: no hay dotación suficiente para cubrir A presencial y B presencial.`);
      }
    });
    state.agents.forEach((agent) => {
      let bCount = week.filter((date) => getShift(schedule[weekKey][agent.id][dateKey(date)]) === "B").length;
      let remoteCount = week.filter((date) => getMode(schedule[weekKey][agent.id][dateKey(date)]) === "remote").length;

      for (const date of week) {
        if (bCount <= 2) break;
        const cell = schedule[weekKey][agent.id][dateKey(date)];
        if (canAdjustWorkCell(cell) && getShift(cell) === "B" && canKeepDailyCoverageAfterChange(schedule, weekKey, dateKey(date), agent.id, "A", getMode(cell), isUnionStatus(cell))) {
          setShift(cell, "A");
          bCount -= 1;
        }
      }

      for (const date of week) {
        if (remoteCount <= 2) break;
        const cell = schedule[weekKey][agent.id][dateKey(date)];
        if (canAdjustWorkCell(cell) && getMode(cell) === "remote" && canKeepDailyCoverageAfterChange(schedule, weekKey, dateKey(date), agent.id, getShift(cell), "onsite", isUnionStatus(cell))) {
          setMode(cell, "onsite");
          remoteCount -= 1;
        }
      }
    });
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

function isEditableWorkCell(cell) {
  return Boolean(getShift(cell) && getMode(cell));
}

function canAdjustWorkCell(cell) {
  return isEditableWorkCell(cell) && !cell.locked;
}

function getShift(cell) {
  if (!cell?.status) return null;
  if (cell.status.startsWith("A-")) return "A";
  if (cell.status.startsWith("B-")) return "B";
  return null;
}

function getMode(cell) {
  if (!cell?.status) return null;
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
}

function renderAgents() {
  el.agentsList.innerHTML = "";
  state.agents.forEach((agent) => {
    const row = document.createElement("div");
    row.className = "agent-row";
    const input = document.createElement("input");
    input.value = agent.name;
    input.disabled = !canEdit();
    input.addEventListener("change", () => {
      if (!canEdit()) return;
      agent.name = input.value.trim() || "Agente sin nombre";
      generateSchedule();
    });
    const remove = document.createElement("button");
    remove.className = "mini-button";
    remove.textContent = "Quitar";
    remove.disabled = !canEdit();
    remove.addEventListener("click", () => {
      if (!canEdit()) return;
      state.agents = state.agents.filter((item) => item.id !== agent.id);
      generateSchedule();
    });
    row.append(input, remove);
    el.agentsList.append(row);
  });
}

function renderLists() {
  renderSimpleList(el.specialDaysList, state.specialDays, (item) => {
    const label = item.type === "holiday" ? "Feriado" : "Obligatorio";
    return `<strong>${formatDate(item.date)}</strong><small>${label}</small>`;
  });
  renderSimpleList(el.locksList, state.recurringLocks, (item) => {
    const agent = state.agents.find((candidate) => candidate.id === item.agentId);
    return `<strong>${agent?.name || "Agente eliminado"}</strong><small>${dayNames[item.day - 1]} | ${item.mode === "remote" ? "Remoto" : "Presencial"}</small>`;
  });
  renderSimpleList(el.absencesList, state.absences, (item) => {
    const agent = state.agents.find((candidate) => candidate.id === item.agentId);
    const type = item.type === "medical" ? "Licencia médica" : "Día administrativo";
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
  getMonthWeeks(state.year, state.month).forEach((week) => {
    const weekKey = dateKey(week[0]);
    const block = document.createElement("article");
    block.className = "week-block";
    block.innerHTML = `
      <div class="week-title">
        <h3>Semana ${formatDate(weekKey)}</h3>
        <span>${shiftSummaryText()}</span>
      </div>
    `;
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
    state.agents.forEach((agent) => {
      const row = document.createElement("tr");
      row.innerHTML = `<td>${escapeHtml(agent.name)}</td>`;
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
          <strong>${option.code}${(cell.locked || expired) && cell.note !== "Feriado" ? '<span class="locked-mark">Bloq.</span>' : ""}</strong>
          <span>${option.label}</span>
          ${expired ? `<span>Día vencido</span>` : cell.note ? `<span>${escapeHtml(cell.note)}</span>` : ""}
        `;
        button.addEventListener("click", () => openCellEditor(weekKey, agent.id, key));
        td.append(button);
        row.append(td);
      });
      tbody.append(row);
    });
    block.append(table);
    el.calendarView.append(block);
  });
}

function renderRules() {
  const issues = validateRules();
  el.rulesPanel.className = `rules-panel ${issues.length ? "warn" : "ok"}`;
  if (!issues.length) {
    el.rulesPanel.innerHTML = `
      <p class="rule-message"><strong>Reglas vigentes:</strong> cada agente activo queda con 2 días remotos semanales, 2 turnos B semanales y al menos un viernes B mensual cuando hay disponibilidad.</p>
      <p class="rule-message"><strong>Cobertura diaria:</strong> cada día hábil mantiene al menos un tutor presencial en turno A y uno presencial en turno B, respetando bloqueos y ausencias.</p>
      <p class="rule-message"><strong>Salida sindicato:</strong> descuenta las últimas dos horas de la jornada, pero cuenta dentro del total del turno y modalidad asignados.</p>
    `;
    return;
  }
  el.rulesPanel.innerHTML = `
    <p class="rule-message"><strong>Incongruencias detectadas:</strong> se permite editar manualmente, pero estas reglas requieren revisión.</p>
    ${issues.map((issue) => `<p class="rule-message">• ${escapeHtml(issue)}</p>`).join("")}
  `;
}

function showRulesError(message) {
  el.rulesPanel.className = "rules-panel warn";
  el.rulesPanel.innerHTML = `<p class="rule-message"><strong>Error:</strong> ${escapeHtml(message)}</p>`;
}

function validateRules() {
  const issues = [];
  const monthFridayB = new Map(state.agents.map((agent) => [agent.id, 0]));

  getMonthWeeks(state.year, state.month).forEach((week) => {
    const weekKey = dateKey(week[0]);
    state.agents.forEach((agent) => {
      const cells = week.map((date) => state.schedule[weekKey]?.[agent.id]?.[dateKey(date)]).filter(Boolean);
      const workCells = cells.filter(isEditableWorkCell);
      const remote = workCells.filter((cell) => getMode(cell) === "remote").length;
      const bShifts = workCells.filter((cell) => getShift(cell) === "B").length;
      const unavailable = cells.filter((cell) => ["holiday", "medical", "admin"].includes(cell.status)).length;
      const unionCount = cells.filter(isUnionStatus).length;
      if (unionCount && !canUseUnion(agent.name)) {
        issues.push(`${agent.name}, semana ${formatDate(weekKey)}: salida sindicato solo aplica para Denisse Bravo y Monserrat Vargas.`);
      }
      if (workCells.length >= 2 && remote !== 2) {
        issues.push(`${agent.name}, semana ${formatDate(weekKey)}: tiene ${remote} remoto(s), deben ser 2.`);
      }
      if (workCells.length >= 2 && bShifts !== 2) {
        issues.push(`${agent.name}, semana ${formatDate(weekKey)}: tiene ${bShifts} turno(s) B, deben ser 2.`);
      }
      if (workCells.length < 2 && unavailable > 0) {
        issues.push(`${agent.name}, semana ${formatDate(weekKey)}: ausencia/feriado impide completar proporcionalidad semanal.`);
      }
      week.forEach((date) => {
        const cell = state.schedule[weekKey]?.[agent.id]?.[dateKey(date)];
        if (isoDay(date) === 5 && getShift(cell) === "B") {
          monthFridayB.set(agent.id, (monthFridayB.get(agent.id) || 0) + 1);
        }
      });
    });
  });

  state.agents.forEach((agent) => {
    const hasAnyFriday = getMonthWeeks(state.year, state.month).some((week) => {
      const friday = week.find((date) => isoDay(date) === 5);
      if (!friday) return false;
      const cell = state.schedule[dateKey(week[0])]?.[agent.id]?.[dateKey(friday)];
      return isEditableWorkCell(cell);
    });
    if (hasAnyFriday && !monthFridayB.get(agent.id)) {
      issues.push(`${agent.name}: no tiene turno B en viernes durante ${monthNames[state.month]}.`);
    }
  });

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
  state.manualOverrides[key] = override;
  state.schedule[weekKey][agentId][dayKey] = override;
  el.cellDialog.close();
  render();
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
  const html = buildExcelHtml();
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Horario_Service_Desk_${String(state.month + 1).padStart(2, "0")}-${state.year}.xls`;
  link.click();
  URL.revokeObjectURL(url);
}

function buildExcelHtml() {
  const weeks = getMonthWeeks(state.year, state.month);
  const rows = [];
  rows.push(`<tr><td class="blank"></td><td class="blank"></td><th class="shift-head">Turno</th><th class="shift-head">Lunes y Martes</th><th class="shift-head">Miércoles a Viernes</th><td class="blank"></td><td class="blank"></td><td class="blank"></td></tr>`);
  rows.push(`<tr><td class="blank"></td><td class="blank"></td><td class="shift-a">A</td><td class="hours">8:30 a 18:30 hrs.</td><td class="hours">8:30 a 17:30 hrs.</td><td class="blank"></td><td class="blank"></td><td class="blank"></td></tr>`);
  rows.push(`<tr><td class="blank"></td><td class="blank"></td><td class="shift-b">B</td><td class="hours">10:30 a 20:30 hrs.</td><td class="hours">10:30 a 19:30 hrs.</td><td class="blank"></td><td class="blank"></td><td class="blank"></td></tr>`);
  rows.push(`<tr><td class="blank"></td><td class="blank"></td><td colspan="3" class="telework">Teletrabajo</td><td class="admin">ADMINISTRATIVO</td><td class="blank"></td><td class="blank"></td></tr>`);
  rows.push(`<tr class="spacer"><td colspan="8"></td></tr>`);

  weeks.forEach((week) => {
    const weekKey = dateKey(week[0]);
    rows.push(`<tr class="head"><th></th><th>Tutor</th>${week.map((date) => `<th>${dayNames[isoDay(date) - 1].toUpperCase()}</th>`).join("")}<th>SABADO</th></tr>`);
    state.agents.forEach((agent, index) => {
      rows.push(`<tr>${index === 0 ? `<td rowspan="${state.agents.length}" class="week-label">Semana<br>${formatDate(weekKey)}</td>` : ""}<td class="agent">${escapeHtml(agent.name)}</td>${week.map((date) => exportCell(weekKey, agent.id, dateKey(date))).join("")}<td class="saturday"></td></tr>`);
    });
    rows.push(`<tr class="week-gap"><td colspan="8"></td></tr>`);
  });

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          table { border-collapse: collapse; font-family: Calibri, Arial, sans-serif; }
          th, td { border: 1px solid #000000; padding: 3px 6px; min-width: 96px; text-align: center; font-size: 12px; }
          .blank { border: 0; background: #ffffff; }
          .shift-head, .head th { background: #e6e6e6; color: #000000; font-weight: bold; }
          .shift-a { background: #fff200; font-weight: bold; }
          .shift-b { background: #00b050; color: #000000; font-weight: bold; }
          .hours { background: #ffffff; font-weight: bold; }
          .telework, .remote { background: #cc66cc; font-weight: bold; }
          .union { background: #f6efe0; font-weight: bold; }
          .admin { background: #66ccff; font-weight: bold; }
          .agent { text-align: left; min-width: 170px; }
          .week-label { background: #e6e6e6; font-weight: bold; vertical-align: middle; min-width: 80px; }
          .medical { background: #f6efe0; font-weight: bold; }
          .holiday, .saturday { background: #bfbfbf; font-weight: bold; }
          .mandatory { background: #90abc4; font-weight: bold; }
          .spacer td, .week-gap td { border: 0; height: 18px; background: #ffffff; }
        </style>
      </head>
      <body><table>${rows.join("")}</table></body>
    </html>
  `;
}

function exportCell(weekKey, agentId, dayKey) {
  const cell = state.schedule[weekKey]?.[agentId]?.[dayKey] || { status: "A-onsite" };
  const option = options[cell.status] || options["A-onsite"];
  const className = isUnionStatus(cell)
    ? "union"
    : getMode(cell) === "remote"
      ? "remote"
      : cell.status === "admin"
      ? "admin"
      : cell.status === "medical"
        ? "medical"
        : cell.status === "holiday"
          ? "holiday"
          : cell.note === "Asistencia obligatoria"
            ? "mandatory"
            : "";
  return `<td class="${className}">${exportCode(cell, option)}</td>`;
}

function exportCode(cell, option) {
  if (cell.status === "holiday") return "FERIADO";
  if (cell.status === "admin") return "ADMINISTRATIVO";
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

init().catch((error) => {
  console.error(error);
  redirectToLogin();
});
