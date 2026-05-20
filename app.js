import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const STORAGE_KEY = "b2b-control-state-v3";
const BACKEND_KEY = "b2b-control-backend-v1";
const weekdayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const statusLabels = {
  planned: "Prevista",
  confirmed: "Confirmada",
  completed: "Realizada",
  cancelled: "Cancelada",
};
const KNOWN_CLUBS = [
  { name: "Graf", company: "LICORELLA NOTTE SL", taxId: "B86377272", email: "", address: "Calle María de Molina, 50, 28006 Madrid, España", vatRate: 10, withholdingRate: 15, notes: "Concepto habitual: SESIÓN DEL VALLE B2B ROSS GRAF. Histórico: 18/04/2026 200€." },
  { name: "Gabana", company: "PARTY LUXE, S.L.", taxId: "B87641015", email: "", address: "Calle María de Molina, 39, 28006 Madrid, España", vatRate: 10, withholdingRate: 15, notes: "Conceptos habituales: GABANA JUEVES / GABANA MIÉRCOLES. Históricos: 250€, 250€, 100€." },
  { name: "Jimmys", company: "Primalia Espectáculos, SL", taxId: "B84360338", email: "", address: "C/ María de Molina, 39, 28006 Madrid, España", vatRate: 10, withholdingRate: 15, notes: "Concepto habitual: SESIÓN DEL VALLE B2B ROSS JIMMYS. Histórico: 250€ por sesión." },
  { name: "Starlite Navidad", company: "STARLITE MUSIC GROUP SL", taxId: "B65900771", email: "", address: "C/ Antonio Herrero, 8 Pl 1 Puerta B, 28601 Marbella (Málaga)", vatRate: 10, withholdingRate: 15, notes: "Histórico: diciembre facturado en febrero. 3 sesiones de 200€." },
  { name: "Saint", company: "EXPANSION SISTEMA MA, SL", taxId: "B86184702", email: "", address: "C/ Madera, 7, Planta 1, Puerta Izq, 28004 Madrid", vatRate: 10, withholdingRate: 15, notes: "Concepto habitual: Prestación de servicios DJ (Del Valle b2b Ross)." },
  { name: "Bardot", company: "COMMODORO 1985, S.L", taxId: "B87072823", email: "", address: "Plaza República Argentina, 5, 28002 Madrid", vatRate: 10, withholdingRate: 15, notes: "Histórico: 3 sesiones de 300€ en septiembre." },
  { name: "Goose Panda", company: "Nahuel Mountain S.L", taxId: "B88475462", email: "", address: "C/ de los Hermanos Machado, 5 Bl 4 Bj B, 28660 Boadilla del Monte, Madrid", vatRate: 10, withholdingRate: 15, notes: "Concepto habitual: SESIÓN DEL VALLE B2B ROSS PANDA. Histórico: 200€." },
  { name: "Blu", company: "Pentágono Escaleno, S.L", taxId: "B90488164", email: "", address: "Avenida de la República Argentina 35A, 1A, Sevilla 41011", vatRate: 10, withholdingRate: 15, notes: "Histórico: sesión 150€ + transporte 150€." },
  { name: "FITZ", company: "PRINCESA SOUNDS, SL", taxId: "B02853885", email: "", address: "Avenida de San Luis 95, 28003 Madrid", vatRate: 10, withholdingRate: 15, notes: "Concepto habitual: Trabajo como DJ DEL VALLE B2B ROSS. Histórico: 250€." },
  { name: "Teatro Barceló", company: "Teatro Barceló Madrid, SL", taxId: "B88471081", email: "", address: "Calle Barceló, 11, 28004 Madrid", vatRate: 10, withholdingRate: 15, notes: "Histórico Ross main 200€." },
];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const now = new Date();
const state = loadLocalState();
const backend = {
  client: null,
  config: loadBackendConfig(),
  mode: "local",
  lastSyncAt: null,
  lastError: "",
  syncing: false,
};
const ui = {
  currentMonth: new Date(now.getFullYear(), now.getMonth(), 1),
  selectedDate: formatDateInput(now),
  selectedWeekStart: formatDateInput(getWeekStart(now)),
  detailMode: "week",
  activeSection: "overview",
};

document.addEventListener("DOMContentLoaded", async () => {
  bootstrapWeekdays();
  bindEvents();
  renderBackendConfig();
  syncSettingsForm();
  renderApp();
  await initializeBackend();
});

function bootstrapWeekdays() {
  $("#weekday-row").innerHTML = weekdayNames.map((day) => `<span>${day}</span>`).join("");
}

function loadLocalState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) return ensureSeededCatalog(JSON.parse(raw));
  return ensureSeededCatalog(buildDefaultState());
}

function buildDefaultState() {
  return {
    settings: {
      brandName: "DEL VALLE B2B ROSS",
      meName: "Del Valle",
      partnerName: "Ross",
      issuerName: "Alfonso Ros Alique",
      issuerTaxId: "54195990D",
      issuerAddress: "C/ María Curie 12, 3º2",
      issuerCity: "28703 San Sebastián de los Reyes, Madrid",
      issuerCountry: "España",
      iban: "ES33 0182 6603 5702 0150 8029",
      paymentMethod: "Transferencia bancaria",
      invoiceFooter: "Gracias por confiar en el proyecto.",
    },
    clubs: [],
    sessions: [],
    invoices: [],
  };
}

function ensureSeededCatalog(baseState) {
  const byName = new Map((baseState.clubs || []).map((club) => [normalizeKey(club.name), club]));
  for (const template of KNOWN_CLUBS) {
    const key = normalizeKey(template.name);
    if (!byName.has(key)) {
      baseState.clubs.push({ id: crypto.randomUUID(), ...template });
    }
  }
  return baseState;
}

function bindEvents() {
  $("#prev-month-btn").addEventListener("click", () => changeMonth(-1));
  $("#next-month-btn").addEventListener("click", () => changeMonth(1));
  $("#today-btn").addEventListener("click", goToToday);
  $("#open-session-form-btn").addEventListener("click", () => openSessionDialog());
  $("#open-club-form-btn").addEventListener("click", () => openClubDialog());
  $("#quick-invoice-btn").addEventListener("click", () => activateSection("billing"));
  $("#add-club-btn").addEventListener("click", () => openClubDialog());

  $$(".segment").forEach((button) =>
    button.addEventListener("click", () => {
      ui.detailMode = button.dataset.view;
      $$(".segment").forEach((item) => item.classList.toggle("active", item === button));
      renderDetails();
    }),
  );

  $$(".view-button").forEach((button) =>
    button.addEventListener("click", () => {
      if (button.dataset.calendarView === "week") ui.detailMode = "week";
      if (button.dataset.calendarView === "day") ui.detailMode = "day";
      $$(".segment").forEach((item) => item.classList.toggle("active", item.dataset.view === ui.detailMode));
      $$(".view-button").forEach((item) => item.classList.toggle("active", item === button));
      renderDetails();
    }),
  );

  $$(".section-tab").forEach((button) =>
    button.addEventListener("click", () => activateSection(button.dataset.target)),
  );

  $$("[data-close='session-dialog']").forEach((button) =>
    button.addEventListener("click", () => $("#session-dialog").close()),
  );
  $$("[data-close='club-dialog']").forEach((button) =>
    button.addEventListener("click", () => $("#club-dialog").close()),
  );

  $("#session-form").addEventListener("submit", handleSessionSubmit);
  $("#club-form").addEventListener("submit", handleClubSubmit);
  $("#settings-form").addEventListener("submit", handleSettingsSubmit);
  $("#invoice-generator-form").addEventListener("submit", handleInvoiceSubmit);
  $("#invoice-club-select").addEventListener("change", renderInvoiceSessionPicker);
  $("#invoice-month-input").addEventListener("change", renderInvoiceSessionPicker);
  $("#invoice-mode-select").addEventListener("change", renderInvoiceSessionPicker);
  $("#export-data-btn").addEventListener("click", exportData);
  $("#import-data-input").addEventListener("change", importData);

  $("#backend-form").addEventListener("submit", handleBackendSubmit);
  $("#sync-now-btn").addEventListener("click", async () => {
    await pushAllStateToRemote();
    renderBackendStatus();
  });
  $("#disconnect-backend-btn").addEventListener("click", disconnectBackend);
}

async function initializeBackend() {
  if (!isBackendConfigured(backend.config)) {
    renderBackendStatus();
    return;
  }

  backend.client = createClient(backend.config.supabaseUrl, backend.config.supabaseAnonKey);

  try {
    const remoteState = await fetchRemoteState();
    if (hasRemoteData(remoteState)) {
      replaceState(remoteState);
      saveLocalState();
      backend.mode = "supabase";
      backend.lastError = "";
    } else {
      await pushAllStateToRemote();
      backend.mode = "supabase";
    }
  } catch (error) {
    backend.mode = "local";
    backend.lastError = error.message;
  }

  syncSettingsForm();
  renderBackendConfig();
  renderApp();
}

function renderApp() {
  saveLocalState();
  renderStats();
  renderCalendar();
  renderDetails();
  renderUpcomingSessions();
  renderClubs();
  renderInvoiceControls();
  renderInvoices();
  renderEarnings();
  renderBackendStatus();
  activateSection(ui.activeSection);
}

function renderStats() {
  const monthLabel = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(ui.currentMonth);
  const monthSessions = getSessionsForMonth(ui.currentMonth).filter((item) => item.status !== "cancelled");
  const pendingInvoices = state.invoices.filter((invoice) => !invoice.paid);
  const monthBreakdown = monthSessions.reduce(
    (acc, session) => {
      const net = calculateSessionNet(session);
      acc.me += net.me;
      acc.partner += net.partner;
      return acc;
    },
    { me: 0, partner: 0 },
  );

  $("#stat-month-sessions").textContent = monthSessions.length;
  $("#stat-month-range").textContent = monthLabel;
  $("#stat-pending").textContent = formatCurrency(pendingInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0));
  $("#stat-me-label").textContent = `Neto ${state.settings.meName || "Del Valle"}`;
  $("#stat-partner-label").textContent = `Neto ${state.settings.partnerName || "Ros"}`;
  $("#stat-me-net").textContent = formatCurrency(monthBreakdown.me);
  $("#stat-partner-net").textContent = formatCurrency(monthBreakdown.partner);
}

function renderCalendar() {
  $("#month-title").textContent = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(ui.currentMonth);
  $("#calendar-grid").innerHTML = buildCalendarDays(ui.currentMonth)
    .map((day) => {
      const iso = formatDateInput(day);
      const daySessions = getSessionsForDate(iso);
      const dayBase = daySessions.filter((item) => item.status !== "cancelled").reduce((sum, item) => sum + item.fee, 0);
      const isSelected = iso === ui.selectedDate;
      const isWeekSelected = formatDateInput(getWeekStart(day)) === ui.selectedWeekStart;
      return `
        <button class="calendar-day ${day.getMonth() === ui.currentMonth.getMonth() ? "" : "outside"} ${iso === formatDateInput(now) ? "today" : ""} ${isSelected ? "selected" : ""} ${isWeekSelected ? "week-selected" : ""}" data-date="${iso}">
          <div class="calendar-top">
            <strong>${day.getDate()}</strong>
            <span class="meta">${daySessions.length ? `${daySessions.length} sesión${daySessions.length > 1 ? "es" : ""}` : ""}</span>
          </div>
          <div class="calendar-chip-list">
            ${daySessions.slice(0, 3).map((session) => `<span class="chip ${session.participants}">${escapeHtml(getParticipantLabel(session.participants))}</span>`).join("")}
          </div>
          <div class="day-income">${dayBase ? formatCurrency(dayBase) : "Sin importe"}</div>
        </button>
      `;
    })
    .join("");

  $$("#calendar-grid .calendar-day").forEach((button) =>
    button.addEventListener("click", () => {
      const date = parseDateInput(button.dataset.date);
      ui.selectedDate = button.dataset.date;
      ui.selectedWeekStart = formatDateInput(getWeekStart(date));
      renderCalendar();
      renderDetails();
    }),
  );
}

function renderDetails() {
  $("#detail-title").textContent =
    ui.detailMode === "week"
      ? `Semana del ${formatHumanDate(parseDateInput(ui.selectedWeekStart))}`
      : formatHumanDate(parseDateInput(ui.selectedDate));

  const sessions =
    ui.detailMode === "week"
      ? getSessionsForWeek(parseDateInput(ui.selectedWeekStart))
      : getSessionsForDate(ui.selectedDate);

  $("#detail-content").innerHTML = sessions.length
    ? sessions
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((session) => {
          const net = calculateSessionNet(session);
          return `
            <article class="detail-card">
              <div class="item-row">
                <div>
                  <h4>${escapeHtml(session.title || "Sesión")}</h4>
                  <p class="meta">${formatHumanDate(parseDateInput(session.date))} · ${escapeHtml(getClubName(session.clubId))}</p>
                </div>
                <span class="amount">${formatCurrency(session.fee)}</span>
              </div>
              <div class="detail-badges">
                <span class="pill ${session.paid ? "paid" : "pending"}">${session.paid ? "Pagado" : "Pendiente"}</span>
                <span class="pill">${statusLabels[session.status]}</span>
                <span class="pill">${getParticipantLabel(session.participants)}</span>
              </div>
              <p class="detail-note meta">Neto ${escapeHtml(state.settings.meName)}: ${formatCurrency(net.me)} · Neto ${escapeHtml(state.settings.partnerName)}: ${formatCurrency(net.partner)}</p>
              ${session.time ? `<p class="meta">Horario: ${escapeHtml(session.time)}</p>` : ""}
              ${session.notes ? `<p class="meta">${escapeHtml(session.notes)}</p>` : ""}
              <div class="invoice-actions">
                <button class="ghost-button compact" data-edit-session="${session.id}">Editar</button>
                <button class="ghost-button compact" data-toggle-paid="${session.id}">${session.paid ? "Marcar impago" : "Marcar pagado"}</button>
              </div>
            </article>
          `;
        })
        .join("")
    : `<div class="empty-state">No hay sesiones en este rango.</div>`;

  $$("[data-edit-session]").forEach((button) => button.addEventListener("click", () => openSessionDialog(button.dataset.editSession)));
  $$("[data-toggle-paid]").forEach((button) => button.addEventListener("click", () => toggleSessionPaid(button.dataset.togglePaid)));
}

function renderUpcomingSessions() {
  const upcoming = [...state.sessions]
    .filter((session) => session.date >= formatDateInput(now) && session.status !== "cancelled")
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  $("#upcoming-sessions").innerHTML = upcoming.length
    ? upcoming
        .map((session) => `
          <article class="stack-card">
            <div class="item-row">
              <div>
                <h4>${formatHumanDate(parseDateInput(session.date))}</h4>
                <p class="meta">${escapeHtml(getClubName(session.clubId))}</p>
              </div>
              <span class="amount">${formatCurrency(session.fee)}</span>
            </div>
            <div class="detail-badges">
              <span class="pill">${getParticipantLabel(session.participants)}</span>
              <span class="pill">${statusLabels[session.status]}</span>
            </div>
          </article>
        `)
        .join("")
    : `<div class="empty-state">No hay próximas sesiones.</div>`;
}

function renderClubs() {
  $("#clubs-list").innerHTML = state.clubs.length
    ? state.clubs
        .map((club) => {
          const sessions = state.sessions.filter((session) => session.clubId === club.id && session.status !== "cancelled");
          const pending = sessions.filter((session) => !session.paid).reduce((sum, session) => sum + calculateSessionNetTotal(session), 0);
          return `
            <article class="stack-card">
              <div class="item-row">
                <div>
                  <h4>${escapeHtml(club.name)}</h4>
                  <p class="meta">${escapeHtml(club.company || "Sin empresa")} · ${escapeHtml(club.taxId || "Sin CIF")}</p>
                </div>
                <span class="amount">${formatCurrency(pending)}</span>
              </div>
              <p class="meta">${escapeHtml(club.address || "Sin dirección")}</p>
              <div class="club-tags">
                <span class="pill">${sessions.length} sesiones</span>
                <span class="pill">IVA ${club.vatRate}%</span>
                <span class="pill">IRPF ${club.withholdingRate}%</span>
              </div>
              <div class="invoice-actions">
                <button class="ghost-button compact" data-edit-club="${club.id}">Editar</button>
              </div>
            </article>
          `;
        })
        .join("")
    : `<div class="empty-state">Añade una sala para empezar.</div>`;

  $$("[data-edit-club]").forEach((button) => button.addEventListener("click", () => openClubDialog(button.dataset.editClub)));
}

function renderInvoiceControls() {
  const options = state.clubs.map((club) => `<option value="${club.id}">${escapeHtml(club.name)}</option>`).join("");
  $("#session-club-select").innerHTML = options;
  $("#invoice-club-select").innerHTML = options;
  if (!$("#invoice-month-input").value) $("#invoice-month-input").value = formatMonthInput(ui.currentMonth);
  if (!$("#invoice-date-input").value) $("#invoice-date-input").value = formatDateInput(now);
  if (!$("#invoice-mode-select").value) $("#invoice-mode-select").value = "month";
  renderInvoiceSessionPicker();
}

function renderInvoiceSessionPicker() {
  const container = $("#invoice-session-picker");
  if (!container) return;
  const sessions = getInvoiceCandidates();
  const mode = $("#invoice-mode-select").value || "month";
  container.innerHTML = sessions.length
    ? sessions
        .map((session) => `
          <label class="picker-row">
            <input type="checkbox" value="${session.id}" ${mode === "month" ? "checked disabled" : ""} />
            <div>
              <strong>${formatHumanDate(parseDateInput(session.date))}</strong>
              <div class="meta">${escapeHtml(getClubName(session.clubId))} · ${escapeHtml(session.title || "Sesión")}</div>
              <div class="meta">${getParticipantLabel(session.participants)} · ${formatCurrency(session.fee)}</div>
            </div>
          </label>
        `)
        .join("")
    : `<div class="empty-state">No hay sesiones disponibles para esa sala y ese mes.</div>`;
}

function getInvoiceCandidates() {
  const clubId = $("#invoice-club-select")?.value;
  const month = $("#invoice-month-input")?.value;
  if (!clubId || !month) return [];
  return state.sessions
    .filter((session) => session.clubId === clubId && !session.invoiceId && session.date.startsWith(month) && (session.status === "confirmed" || session.status === "completed"))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function renderInvoices() {
  $("#invoices-list").innerHTML = state.invoices.length
    ? [...state.invoices]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((invoice) => `
          <article class="stack-card">
            <div class="item-row">
              <div>
                <h4>${escapeHtml(invoice.number)}</h4>
                <p class="meta">${escapeHtml(getClubName(invoice.clubId))} · ${invoice.month}</p>
              </div>
              <span class="amount">${formatCurrency(invoice.totalAmount)}</span>
            </div>
            <div class="detail-badges">
              <span class="pill ${invoice.paid ? "paid" : "pending"}">${invoice.paid ? "Pagada" : "Pendiente"}</span>
              <span class="pill">${invoice.items.length} sesiones</span>
            </div>
            <p class="meta">Base ${formatCurrency(invoice.baseAmount)} · IVA ${formatCurrency(invoice.vatAmount)} · IRPF ${formatCurrency(invoice.withholdingAmount)}</p>
            <div class="invoice-actions">
              <button class="ghost-button compact" data-download-invoice="${invoice.id}">Descargar PDF</button>
              <button class="ghost-button compact" data-toggle-invoice-paid="${invoice.id}">${invoice.paid ? "Marcar pendiente" : "Marcar pagada"}</button>
            </div>
          </article>
        `)
        .join("")
    : `<div class="empty-state">Todavía no hay facturas emitidas.</div>`;

  $$("[data-download-invoice]").forEach((button) => button.addEventListener("click", () => downloadInvoicePdf(getInvoice(button.dataset.downloadInvoice))));
  $$("[data-toggle-invoice-paid]").forEach((button) => button.addEventListener("click", () => toggleInvoicePaid(button.dataset.toggleInvoicePaid)));
}

function renderEarnings() {
  const totals = state.sessions
    .filter((session) => session.status !== "cancelled")
    .reduce(
      (acc, session) => {
        const net = calculateSessionNet(session);
        acc.me += net.me;
        acc.partner += net.partner;
        return acc;
      },
      { me: 0, partner: 0 },
    );

  $("#earnings-breakdown").innerHTML = `
    <article class="earning-card">
      <div class="item-row">
        <div>
          <h4>${escapeHtml(state.settings.meName)}</h4>
          <p class="meta">Neto acumulado en sesiones activas</p>
        </div>
        <span class="amount">${formatCurrency(totals.me)}</span>
      </div>
    </article>
    <article class="earning-card">
      <div class="item-row">
        <div>
          <h4>${escapeHtml(state.settings.partnerName)}</h4>
          <p class="meta">Neto acumulado en sesiones activas</p>
        </div>
        <span class="amount">${formatCurrency(totals.partner)}</span>
      </div>
    </article>
  `;
}

function renderBackendConfig() {
  $("#supabase-url-input").value = backend.config.supabaseUrl || "";
  $("#supabase-anon-key-input").value = backend.config.supabaseAnonKey || "";
  $("#supabase-project-id-input").value = backend.config.projectId || "delvalleb2b";
}

function renderBackendStatus() {
  const container = $("#backend-status");
  if (!container) return;
  const modeLabel = backend.mode === "supabase" ? "Supabase conectado" : "Modo local";
  const syncLabel = backend.lastSyncAt ? `Última sincronización: ${new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "medium" }).format(new Date(backend.lastSyncAt))}` : "Sin sincronización remota todavía.";
  const error = backend.lastError ? `<br><strong>Error:</strong> ${escapeHtml(backend.lastError)}` : "";
  const note =
    backend.mode === "supabase"
      ? "Cualquiera con esta URL podrá leer y escribir datos mientras la app use esta clave pública."
      : "GitHub Pages solo no guarda datos compartidos. Sin backend, cada navegador guarda sus propios datos.";
  container.innerHTML = `<strong>${modeLabel}</strong><br>${syncLabel}<br>${escapeHtml(note)}${error}`;
}

function activateSection(sectionId) {
  ui.activeSection = sectionId;
  $$(".section-tab").forEach((button) => button.classList.toggle("active", button.dataset.target === sectionId));
  $$(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.id === sectionId));
}

function openSessionDialog(sessionId = null) {
  $("#session-form").reset();
  $("#session-id-input").value = "";
  $("#session-form-title").textContent = "Nueva sesión";
  $("#session-date-input").value = ui.selectedDate;
  $("#session-status-input").value = "planned";
  $("#session-participants-input").value = "both";
  $("#session-title-input").value = `SESIÓN ${state.settings.brandName}`;

  if (sessionId) {
    const session = getSession(sessionId);
    if (!session) return;
    $("#session-id-input").value = session.id;
    $("#session-form-title").textContent = "Editar sesión";
    $("#session-date-input").value = session.date;
    $("#session-club-select").value = session.clubId;
    $("#session-fee-input").value = session.fee;
    $("#session-status-input").value = session.status;
    $("#session-participants-input").value = session.participants || "both";
    $("#session-time-input").value = session.time || "";
    $("#session-title-input").value = session.title || "";
    $("#session-notes-input").value = session.notes || "";
  }

  $("#session-dialog").showModal();
}

function openClubDialog(clubId = null) {
  $("#club-form").reset();
  $("#club-id-input").value = "";
  $("#club-form-title").textContent = "Nueva sala";
  $("#club-vat-input").value = 10;
  $("#club-withholding-input").value = 15;

  if (clubId) {
    const club = state.clubs.find((item) => item.id === clubId);
    if (!club) return;
    $("#club-id-input").value = club.id;
    $("#club-form-title").textContent = "Editar sala";
    $("#club-name-input").value = club.name;
    $("#club-company-input").value = club.company;
    $("#club-tax-id-input").value = club.taxId;
    $("#club-email-input").value = club.email;
    $("#club-address-input").value = club.address;
    $("#club-vat-input").value = club.vatRate;
    $("#club-withholding-input").value = club.withholdingRate;
    $("#club-notes-input").value = club.notes || "";
  }

  $("#club-dialog").showModal();
}

async function handleSessionSubmit(event) {
  event.preventDefault();
  const sessionId = $("#session-id-input").value;
  const previous = sessionId ? getSession(sessionId) : null;
  const session = {
    id: sessionId || crypto.randomUUID(),
    date: $("#session-date-input").value,
    clubId: $("#session-club-select").value,
    fee: Number($("#session-fee-input").value || 0),
    status: $("#session-status-input").value,
    participants: $("#session-participants-input").value || "both",
    time: $("#session-time-input").value.trim(),
    title: $("#session-title-input").value.trim(),
    notes: $("#session-notes-input").value.trim(),
    paid: previous?.paid || false,
    invoiceId: previous?.invoiceId || null,
  };

  if (sessionId) {
    state.sessions = state.sessions.map((item) => (item.id === sessionId ? session : item));
  } else {
    state.sessions.push(session);
  }
  $("#session-dialog").close();
  await persistAndRender({ table: "b2b_sessions", row: session });
}

async function handleClubSubmit(event) {
  event.preventDefault();
  const clubId = $("#club-id-input").value;
  const club = {
    id: clubId || crypto.randomUUID(),
    name: $("#club-name-input").value.trim(),
    company: $("#club-company-input").value.trim(),
    taxId: $("#club-tax-id-input").value.trim(),
    email: $("#club-email-input").value.trim(),
    address: $("#club-address-input").value.trim(),
    vatRate: Number($("#club-vat-input").value || 0),
    withholdingRate: Number($("#club-withholding-input").value || 0),
    notes: $("#club-notes-input").value.trim(),
  };

  if (clubId) {
    state.clubs = state.clubs.map((item) => (item.id === clubId ? club : item));
  } else {
    state.clubs.push(club);
  }
  $("#club-dialog").close();
  await persistAndRender({ table: "b2b_clubs", row: club });
}

async function handleSettingsSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  state.settings = {
    brandName: String(formData.get("brandName") || "").trim(),
    meName: String(formData.get("meName") || "").trim(),
    partnerName: String(formData.get("partnerName") || "").trim(),
    issuerName: String(formData.get("issuerName") || "").trim(),
    issuerTaxId: String(formData.get("issuerTaxId") || "").trim(),
    issuerAddress: String(formData.get("issuerAddress") || "").trim(),
    issuerCity: String(formData.get("issuerCity") || "").trim(),
    issuerCountry: String(formData.get("issuerCountry") || "").trim(),
    iban: String(formData.get("iban") || "").trim(),
    paymentMethod: String(formData.get("paymentMethod") || "").trim(),
    invoiceFooter: String(formData.get("invoiceFooter") || "").trim(),
  };
  await persistAndRender({ table: "b2b_settings", row: state.settings, id: backend.config.projectId || "delvalleb2b" });
}

async function handleInvoiceSubmit(event) {
  event.preventDefault();
  const clubId = $("#invoice-club-select").value;
  const month = $("#invoice-month-input").value;
  const invoiceDate = $("#invoice-date-input").value;
  const number = $("#invoice-number-input").value.trim() || buildInvoiceNumber(invoiceDate);
  const mode = $("#invoice-mode-select").value || "month";
  const candidates = getInvoiceCandidates();
  const checkedIds = new Set(
    $$("#invoice-session-picker input[type='checkbox']:checked").map((input) => input.value),
  );
  const sessions = mode === "month" ? candidates : candidates.filter((session) => checkedIds.has(session.id));

  if (!sessions.length) {
    alert(mode === "month" ? "No hay sesiones confirmadas o realizadas sin facturar para esa sala y ese mes." : "Selecciona al menos un día para facturar.");
    return;
  }

  const club = state.clubs.find((item) => item.id === clubId);
  const baseAmount = roundMoney(sessions.reduce((sum, session) => sum + session.fee, 0));
  const vatAmount = roundMoney(baseAmount * ((club?.vatRate || 0) / 100));
  const withholdingAmount = roundMoney(baseAmount * ((club?.withholdingRate || 0) / 100));
  const totalAmount = roundMoney(baseAmount + vatAmount - withholdingAmount);

  const invoice = {
    id: crypto.randomUUID(),
    clubId,
    number,
    date: invoiceDate,
    month,
    createdAt: new Date().toISOString(),
    paid: false,
    baseAmount,
    vatAmount,
    withholdingAmount,
    totalAmount,
    items: sessions.map((session) => ({
      id: session.id,
      date: session.date,
      fee: session.fee,
      title: session.title,
      participants: session.participants,
    })),
  };

  state.invoices.push(invoice);
  state.sessions = state.sessions.map((session) => sessions.some((item) => item.id === session.id) ? { ...session, invoiceId: invoice.id } : session);
  downloadInvoicePdf(invoice);
  await persistAndRender({ full: true });
  activateSection("overview");
}

async function handleBackendSubmit(event) {
  event.preventDefault();
  backend.config = {
    supabaseUrl: $("#supabase-url-input").value.trim(),
    supabaseAnonKey: $("#supabase-anon-key-input").value.trim(),
    projectId: $("#supabase-project-id-input").value.trim() || "delvalleb2b",
  };
  localStorage.setItem(BACKEND_KEY, JSON.stringify(backend.config));
  backend.client = null;
  backend.mode = "local";
  backend.lastError = "";
  renderBackendConfig();
  await initializeBackend();
}

function disconnectBackend() {
  backend.client = null;
  backend.mode = "local";
  backend.lastSyncAt = null;
  backend.lastError = "";
  backend.config = { supabaseUrl: "", supabaseAnonKey: "", projectId: "delvalleb2b" };
  localStorage.removeItem(BACKEND_KEY);
  renderBackendConfig();
  renderBackendStatus();
}

async function persistAndRender(options = { full: false }) {
  saveLocalState();
  renderApp();
  if (backend.mode !== "supabase" || !backend.client) return;
  try {
    if (options.full) {
      await pushAllStateToRemote();
    } else {
      await pushSingleRow(options.table, options.id || options.row.id, options.row);
    }
  } catch (error) {
    backend.lastError = error.message;
    renderBackendStatus();
  }
}

async function pushAllStateToRemote() {
  if (!backend.client) return;
  backend.syncing = true;
  backend.lastError = "";
  try {
    await pushSingleRow("b2b_settings", backend.config.projectId || "delvalleb2b", state.settings);
    await pushManyRows("b2b_clubs", state.clubs);
    await pushManyRows("b2b_sessions", state.sessions);
    await pushManyRows("b2b_invoices", state.invoices);
    backend.mode = "supabase";
    backend.lastSyncAt = new Date().toISOString();
  } catch (error) {
    backend.lastError = error.message;
    throw error;
  } finally {
    backend.syncing = false;
  }
}

async function pushSingleRow(table, id, payload) {
  const { error } = await backend.client.from(table).upsert([{ id, payload, updated_at: new Date().toISOString() }], { onConflict: "id" });
  if (error) throw new Error(`${table}: ${error.message}`);
  backend.lastSyncAt = new Date().toISOString();
}

async function pushManyRows(table, rows) {
  if (!rows.length) return;
  const payload = rows.map((row) => ({ id: row.id, payload: row, updated_at: new Date().toISOString() }));
  const { error } = await backend.client.from(table).upsert(payload, { onConflict: "id" });
  if (error) throw new Error(`${table}: ${error.message}`);
}

async function fetchRemoteState() {
  const [settingsRes, clubsRes, sessionsRes, invoicesRes] = await Promise.all([
    backend.client.from("b2b_settings").select("id,payload,updated_at").eq("id", backend.config.projectId || "delvalleb2b").maybeSingle(),
    backend.client.from("b2b_clubs").select("id,payload,updated_at").order("updated_at", { ascending: true }),
    backend.client.from("b2b_sessions").select("id,payload,updated_at").order("updated_at", { ascending: true }),
    backend.client.from("b2b_invoices").select("id,payload,updated_at").order("updated_at", { ascending: true }),
  ]);

  const results = [settingsRes, clubsRes, sessionsRes, invoicesRes];
  const failed = results.find((item) => item.error);
  if (failed?.error) throw new Error(failed.error.message);

  backend.lastSyncAt = new Date().toISOString();
  return {
    settings: settingsRes.data?.payload || state.settings,
    clubs: (clubsRes.data || []).map((row) => row.payload),
    sessions: (sessionsRes.data || []).map((row) => row.payload),
    invoices: (invoicesRes.data || []).map((row) => row.payload),
  };
}

function hasRemoteData(remoteState) {
  return Boolean(remoteState.clubs.length || remoteState.sessions.length || remoteState.invoices.length || remoteState.settings?.brandName);
}

function replaceState(remoteState) {
  state.settings = remoteState.settings || state.settings;
  state.clubs = ensureSeededCatalog({ clubs: remoteState.clubs || [] }).clubs;
  state.sessions = remoteState.sessions || [];
  state.invoices = remoteState.invoices || [];
}

function loadBackendConfig() {
  const fromStorage = JSON.parse(localStorage.getItem(BACKEND_KEY) || "null");
  const runtime = window.B2B_RUNTIME_CONFIG || {};
  return {
    supabaseUrl: fromStorage?.supabaseUrl || runtime.supabaseUrl || "",
    supabaseAnonKey: fromStorage?.supabaseAnonKey || runtime.supabaseAnonKey || "",
    projectId: fromStorage?.projectId || runtime.projectId || "delvalleb2b",
  };
}

function isBackendConfigured(config) {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey);
}

function saveLocalState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function syncSettingsForm() {
  Object.entries(state.settings).forEach(([key, value]) => {
    const field = $(`#settings-form [name="${key}"]`);
    if (field) field.value = value;
  });
}

function changeMonth(offset) {
  ui.currentMonth = new Date(ui.currentMonth.getFullYear(), ui.currentMonth.getMonth() + offset, 1);
  renderApp();
}

function goToToday() {
  ui.currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  ui.selectedDate = formatDateInput(now);
  ui.selectedWeekStart = formatDateInput(getWeekStart(now));
  renderApp();
}

function buildCalendarDays(monthDate) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = getWeekStart(first);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function getWeekStart(date) {
  const copy = new Date(date);
  const day = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function getSessionsForMonth(date) {
  return state.sessions.filter((session) => session.date.startsWith(formatMonthInput(date)));
}

function getSessionsForDate(isoDate) {
  return state.sessions.filter((session) => session.date === isoDate);
}

function getSessionsForWeek(weekStartDate) {
  const start = formatDateInput(weekStartDate);
  const endDate = new Date(weekStartDate);
  endDate.setDate(endDate.getDate() + 6);
  const end = formatDateInput(endDate);
  return state.sessions.filter((session) => session.date >= start && session.date <= end);
}

function calculateSessionNet(session) {
  const club = state.clubs.find((item) => item.id === session.clubId);
  const base = Number(session.fee || 0);
  const vat = base * ((club?.vatRate || 0) / 100);
  const withholding = base * ((club?.withholdingRate || 0) / 100);
  const totalNet = roundMoney(base + vat - withholding);
  if (session.participants === "me") return { me: totalNet, partner: 0, totalNet };
  if (session.participants === "partner") return { me: 0, partner: totalNet, totalNet };
  return { me: roundMoney(totalNet / 2), partner: roundMoney(totalNet / 2), totalNet };
}

function calculateSessionNetTotal(session) {
  return calculateSessionNet(session).totalNet;
}

async function toggleSessionPaid(sessionId) {
  const target = getSession(sessionId);
  if (!target) return;
  target.paid = !target.paid;
  await persistAndRender({ table: "b2b_sessions", row: target });
}

async function toggleInvoicePaid(invoiceId) {
  const invoice = getInvoice(invoiceId);
  if (!invoice) return;
  invoice.paid = !invoice.paid;
  const ids = new Set(invoice.items.map((item) => item.id));
  state.sessions = state.sessions.map((session) => (ids.has(session.id) ? { ...session, paid: invoice.paid } : session));
  await persistAndRender({ full: true });
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "b2b-control-data.json";
  link.click();
  URL.revokeObjectURL(url);
}

async function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      replaceState(JSON.parse(String(reader.result || "{}")));
      syncSettingsForm();
      await persistAndRender({ full: true });
    } catch {
      alert("No se pudo importar el JSON.");
    }
  };
  reader.readAsText(file);
  event.target.value = "";
}

function buildInvoiceNumber(invoiceDate) {
  const year = invoiceDate.slice(0, 4);
  const count = state.invoices.filter((invoice) => invoice.date.startsWith(year)).length + 1;
  return `${String(count).padStart(3, "0")}-${year}`;
}

function downloadInvoicePdf(invoice) {
  if (!invoice || !window.jspdf) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const club = state.clubs.find((item) => item.id === invoice.clubId);
  const s = state.settings;

  doc.setFillColor(16, 16, 16);
  doc.rect(0, 0, 595, 96, "F");
  doc.setTextColor(255, 250, 244);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(23);
  doc.text(s.brandName || "B2B Control", 38, 55);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`${s.meName} / ${s.partnerName}`, 38, 73);

  doc.setTextColor(16, 16, 16);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("EMISOR", 38, 132);
  doc.text("CLIENTE", 300, 132);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);

  [
    s.issuerName,
    `NIF: ${s.issuerTaxId}`,
    s.issuerAddress,
    `${s.issuerCity}, ${s.issuerCountry}`,
  ]
    .filter(Boolean)
    .forEach((line, index) => doc.text(line, 38, 152 + index * 16));

  [
    club?.company || club?.name,
    club?.taxId ? `CIF: ${club.taxId}` : "",
    club?.address || "",
    club?.email || "",
  ]
    .filter(Boolean)
    .forEach((line, index) => doc.text(line, 300, 152 + index * 16, { maxWidth: 250 }));

  doc.setFont("helvetica", "bold");
  doc.text("DATOS FACTURA", 38, 240);
  doc.setFont("helvetica", "normal");
  doc.text(`N.º factura: ${invoice.number}`, 38, 260);
  doc.text(`Fecha factura: ${formatHumanDate(parseDateInput(invoice.date))}`, 38, 276);
  doc.text(`Mes liquidado: ${invoice.month}`, 38, 292);

  doc.autoTable({
    startY: 320,
    head: [["Fecha", "Concepto", "Participación", "Base"]],
    body: invoice.items.map((item) => [formatHumanDate(parseDateInput(item.date)), item.title || `Sesión ${s.brandName}`, getParticipantLabel(item.participants), formatCurrency(item.fee)]),
    theme: "grid",
    styles: { fontSize: 9.5, cellPadding: 7, textColor: [16, 16, 16], lineColor: [220, 213, 203] },
    headStyles: { fillColor: [16, 16, 16], textColor: [255, 250, 244], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 255 }, 2: { cellWidth: 110 }, 3: { halign: "right" } },
  });

  const totalsY = doc.lastAutoTable.finalY + 26;
  doc.setFont("helvetica", "normal");
  doc.text("Base imponible", 340, totalsY);
  doc.text(formatCurrency(invoice.baseAmount), 525, totalsY, { align: "right" });
  doc.text(`IVA ${club?.vatRate || 0}%`, 340, totalsY + 18);
  doc.text(formatCurrency(invoice.vatAmount), 525, totalsY + 18, { align: "right" });
  doc.text(`IRPF ${club?.withholdingRate || 0}%`, 340, totalsY + 36);
  doc.text(`-${formatCurrency(invoice.withholdingAmount)}`, 525, totalsY + 36, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("TOTAL", 340, totalsY + 66);
  doc.text(formatCurrency(invoice.totalAmount), 525, totalsY + 66, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Método de pago: ${s.paymentMethod}`, 38, 740);
  doc.text(`IBAN: ${s.iban}`, 38, 756);
  doc.text(s.invoiceFooter || "", 38, 790, { maxWidth: 520 });
  doc.save(`factura-${invoice.number}.pdf`);
}

function getClubName(clubId) {
  return state.clubs.find((club) => club.id === clubId)?.name || "Sala";
}

function getSession(sessionId) {
  return state.sessions.find((session) => session.id === sessionId);
}

function getInvoice(invoiceId) {
  return state.invoices.find((invoice) => invoice.id === invoiceId);
}

function getParticipantLabel(mode) {
  if (mode === "me") return state.settings.meName || "Del Valle";
  if (mode === "partner") return state.settings.partnerName || "Ros";
  return `${state.settings.meName || "Del Valle"} + ${state.settings.partnerName || "Ros"}`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(value || 0);
}

function formatDateInput(date) {
  const value = new Date(date);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function formatMonthInput(date) {
  return formatDateInput(date).slice(0, 7);
}

function parseDateInput(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatHumanDate(date) {
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}
