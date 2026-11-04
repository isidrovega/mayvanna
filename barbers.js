
import { getServices } from "./catalog.js";

import {
    getAppointments,
    generateId
} from "./storage.js";

/* =========================================================
   VARDEN — PERSONAL
   Gestión de barberos y comisiones por servicio
========================================================= */

const STORAGE_KEY = "barbershop_barbers";

let editingBarberId = null;
let toastTimer = null;

const dayLabels = {
    monday: "Lunes",
    tuesday: "Martes",
    wednesday: "Miércoles",
    thursday: "Jueves",
    friday: "Viernes",
    saturday: "Sábado",
    sunday: "Domingo"
};

const defaultSchedule = {
    monday: {
        enabled: true,
        start: "09:00",
        end: "19:00"
    },
    tuesday: {
        enabled: true,
        start: "09:00",
        end: "19:00"
    },
    wednesday: {
        enabled: true,
        start: "09:00",
        end: "19:00"
    },
    thursday: {
        enabled: true,
        start: "09:00",
        end: "19:00"
    },
    friday: {
        enabled: true,
        start: "09:00",
        end: "19:00"
    },
    saturday: {
        enabled: true,
        start: "09:00",
        end: "17:00"
    },
    sunday: {
        enabled: false,
        start: "09:00",
        end: "17:00"
    }
};

/* =========================================================
   ELEMENTOS
========================================================= */

const $ = id => document.getElementById(id);

const barbersGrid = $("barbersGrid");
const barberSummary = $("barberSummary");
const barberModal = $("barberModal");

const barberName = $("barberName");
const barberPhone = $("barberPhone");
const barberActiveSwitch = $("barberActiveSwitch");

const barberServices = $("barberServices");
const barberServiceCommissions =
    $("barberServiceCommissions");

const scheduleEditor = $("scheduleEditor");

const barberModalAvatar = $("barberModalAvatar");
const barberModalTitle = $("barberModalTitle");

/* =========================================================
   UTILIDADES SEGURAS
========================================================= */

function safeArray(value) {
    return Array.isArray(value) ? value : [];
}

function safeObject(value) {
    return value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
        ? value
        : {};
}

function safeNumber(value, fallback = 0) {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return fallback;
    }

    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : fallback;
}

function getSafeServices() {
    try {
        return safeArray(getServices());
    } catch (error) {
        console.error(
            "VARDEN: Error al leer servicios:",
            error
        );

        return [];
    }
}

function getSafeAppointments() {
    try {
        return safeArray(getAppointments());
    } catch (error) {
        console.error(
            "VARDEN: Error al leer citas:",
            error
        );

        return [];
    }
}

function escapeHTML(value) {
    const element = document.createElement("div");

    element.textContent = String(value ?? "");

    return element.innerHTML;
}

function formatMoney(value) {
    return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
        maximumFractionDigits: 0
    }).format(safeNumber(value));
}

function formatMoneyPrecise(value) {
    return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(safeNumber(value));
}

function getInitials(name) {
    const initials = String(name || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part.charAt(0).toUpperCase())
        .join("");

    return initials || "NP";
}

function getLocalDate() {
    const now = new Date();

    const year = now.getFullYear();

    const month = String(
        now.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
        now.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function formatTime(time) {
    const [hours, minutes] =
        String(time || "").split(":").map(Number);

    if (
        !Number.isFinite(hours) ||
        !Number.isFinite(minutes)
    ) {
        return "Horario no disponible";
    }

    const period = hours >= 12 ? "PM" : "AM";

    const formattedHour = hours % 12 || 12;

    return (
        `${formattedHour}:` +
        `${String(minutes).padStart(2, "0")} ${period}`
    );
}

/* =========================================================
   ALMACENAMIENTO
========================================================= */

function getBarbers() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);

        if (!raw) {
            return [];
        }

        const stored = JSON.parse(raw);

        return safeArray(stored)
            .filter(item =>
                item !== null &&
                typeof item === "object" &&
                !Array.isArray(item)
            );
    } catch (error) {
        console.error(
            "VARDEN: Error al leer barberos:",
            error
        );

        return [];
    }
}

function saveBarbers(barbers) {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(barbers)
        );

        document.dispatchEvent(
            new CustomEvent("agendapro:staff-changed")
        );

        return true;
    } catch (error) {
        console.error(
            "VARDEN: Error al guardar barberos:",
            error
        );

        showToast(
            "No se pudieron guardar los cambios."
        );

        return false;
    }
}

/* =========================================================
   HORARIOS
========================================================= */

function createSchedule(overrides = {}) {
    const schedule = {};

    const safeOverrides = safeObject(overrides);

    for (const day of Object.keys(dayLabels)) {
        schedule[day] = {
            ...defaultSchedule[day],
            ...safeObject(safeOverrides[day])
        };
    }

    return schedule;
}

function getTodaySchedule(barber) {
    const days = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday"
    ];

    const today = days[new Date().getDay()];

    const schedule = safeObject(barber?.schedule);

    return safeObject(schedule[today]);
}

function formatTodaySchedule(schedule) {
    if (!schedule?.enabled) {
        return "Descanso";
    }

    return (
        `${formatTime(schedule.start)} — ` +
        `${formatTime(schedule.end)}`
    );
}

function renderSchedule(schedule = {}) {
    if (!scheduleEditor) {
        return;
    }

    const normalized = createSchedule(schedule);

    scheduleEditor.innerHTML =
        Object.entries(dayLabels).map(([day, label]) => {
            const config = normalized[day];

            return `
                <div
                    class="
                        modern-schedule-row
                        ${config.enabled ? "" : "disabled"}
                    "
                    data-day="${day}"
                >

                    <div class="modern-schedule-day">

                        <label class="modern-switch small">

                            <input
                                type="checkbox"
                                class="schedule-enabled"
                                ${config.enabled ? "checked" : ""}
                            >

                            <span
                                class="modern-switch-slider"
                            ></span>

                        </label>

                        <strong>${label}</strong>

                    </div>

                    <div class="modern-schedule-times">

                        ${
                            config.enabled
                                ? `
                                    <input
                                        type="time"
                                        class="schedule-start"
                                        value="${escapeHTML(config.start)}"
                                    >

                                    <span>→</span>

                                    <input
                                        type="time"
                                        class="schedule-end"
                                        value="${escapeHTML(config.end)}"
                                    >
                                `
                                : `
                                    <span class="schedule-rest-label">
                                        Descanso
                                    </span>

                                    <input
                                        type="time"
                                        class="schedule-start"
                                        value="${escapeHTML(config.start)}"
                                        hidden
                                    >

                                    <input
                                        type="time"
                                        class="schedule-end"
                                        value="${escapeHTML(config.end)}"
                                        hidden
                                    >
                                `
                        }

                    </div>

                </div>
            `;
        }).join("");
}

function collectSchedule() {
    const result = {};

    if (!scheduleEditor) {
        return createSchedule();
    }

    scheduleEditor
        .querySelectorAll(".modern-schedule-row")
        .forEach(row => {
            const day = row.dataset.day;

            if (!dayLabels[day]) {
                return;
            }

            const enabled = row.querySelector(
                ".schedule-enabled"
            )?.checked ?? false;

            const start = row.querySelector(
                ".schedule-start"
            )?.value || defaultSchedule[day].start;

            const end = row.querySelector(
                ".schedule-end"
            )?.value || defaultSchedule[day].end;

            result[day] = {
                enabled,
                start,
                end
            };
        });

    return createSchedule(result);
}

function updateScheduleState(checkbox) {
    const row = checkbox.closest(
        ".modern-schedule-row"
    );

    if (!row) {
        return;
    }

    const schedule = collectSchedule();

    schedule[row.dataset.day].enabled =
        checkbox.checked;

    renderSchedule(schedule);
}

function validateSchedule(schedule) {
    for (const [day, info] of Object.entries(schedule)) {
        if (!info.enabled) {
            continue;
        }

        if (!info.start || !info.end) {
            showToast(
                `Completa el horario de ${dayLabels[day]}.`
            );

            return false;
        }

        if (info.start >= info.end) {
            showToast(
                `Revisa el horario de ${dayLabels[day]}.`
            );

            return false;
        }
    }

    return true;
}

/* =========================================================
   DATOS INICIALES
========================================================= */

function seedBarbers() {
    if (localStorage.getItem(STORAGE_KEY) !== null) {
        return;
    }

    const serviceIds = getSafeServices()
        .filter(service =>
            service &&
            service.status !== "inactive"
        )
        .map(service => service.id);

    const barbers = [
        {
            id: "carlos",
            name: "Carlos",
            phone: "667 111 1001",
            status: "active",
            serviceIds: [...serviceIds],
            serviceCommissions: {},
            schedule: createSchedule()
        },
        {
            id: "miguel",
            name: "Miguel",
            phone: "667 111 1002",
            status: "active",
            serviceIds: [...serviceIds],
            serviceCommissions: {},
            schedule: createSchedule({
                monday: {
                    enabled: false,
                    start: "10:00",
                    end: "20:00"
                },
                tuesday: {
                    enabled: true,
                    start: "10:00",
                    end: "20:00"
                },
                wednesday: {
                    enabled: true,
                    start: "10:00",
                    end: "20:00"
                },
                thursday: {
                    enabled: true,
                    start: "10:00",
                    end: "20:00"
                },
                friday: {
                    enabled: true,
                    start: "10:00",
                    end: "20:00"
                },
                saturday: {
                    enabled: true,
                    start: "10:00",
                    end: "20:00"
                },
                sunday: {
                    enabled: true,
                    start: "10:00",
                    end: "18:00"
                }
            })
        },
        {
            id: "alex",
            name: "Alex",
            phone: "667 111 1003",
            status: "active",
            serviceIds: [...serviceIds],
            serviceCommissions: {},
            schedule: createSchedule({
                monday: {
                    enabled: true,
                    start: "11:00",
                    end: "19:00"
                },
                tuesday: {
                    enabled: true,
                    start: "11:00",
                    end: "19:00"
                },
                wednesday: {
                    enabled: true,
                    start: "11:00",
                    end: "19:00"
                },
                thursday: {
                    enabled: true,
                    start: "11:00",
                    end: "19:00"
                },
                friday: {
                    enabled: true,
                    start: "11:00",
                    end: "19:00"
                },
                saturday: {
                    enabled: false,
                    start: "11:00",
                    end: "19:00"
                },
                sunday: {
                    enabled: false,
                    start: "11:00",
                    end: "19:00"
                }
            })
        }
    ];

    saveBarbers(barbers);
}

/* =========================================================
   COMISIONES POR SERVICIO
========================================================= */

function normalizeCommission(config = {}) {
    const safeConfig = safeObject(config);

    const type = safeConfig.type === "fixed"
        ? "fixed"
        : "percentage";

    const value = Math.max(
        0,
        safeNumber(safeConfig.value)
    );

    return {
        type,
        value
    };
}

function getLegacyCommission(barber = {}) {
    const safeBarber = safeObject(barber);

    return normalizeCommission({
        type:
            safeBarber.paymentType === "fixed"
                ? "fixed"
                : "percentage",
        value: safeBarber.paymentValue
    });
}

function getBarberCommissions(barber = {}) {
    const safeBarber = safeObject(barber);

    const saved = safeObject(
        safeBarber.serviceCommissions
    );

    const fallback = getLegacyCommission(safeBarber);

    const result = {};

    for (const service of getSafeServices()) {
        if (!service || service.id == null) {
            continue;
        }

        const id = String(service.id);

        const config =
            Object.prototype.hasOwnProperty.call(saved, id)
                ? saved[id]
                : fallback;

        result[id] = normalizeCommission(config);
    }

    for (const [id, config] of Object.entries(saved)) {
        if (
            !Object.prototype.hasOwnProperty.call(
                result,
                id
            )
        ) {
            result[id] = normalizeCommission(config);
        }
    }

    return result;
}

function getSelectedServiceIds() {
    if (!barberServices) {
        return [];
    }

    return Array.from(
        barberServices.querySelectorAll(
            "input[type='checkbox']:checked:not(:disabled)"
        )
    ).map(input => String(input.value));
}

function renderBarberCommissions(barber = {}) {
    if (!barberServiceCommissions) {
        console.warn(
            "VARDEN: Falta #barberServiceCommissions en el HTML."
        );

        return;
    }

    const services = getSafeServices().filter(
        service => service && service.id != null
    );

    const commissions = getBarberCommissions(barber);

    const selectedIds = new Set(
        getSelectedServiceIds()
    );

    if (!services.length) {
        barberServiceCommissions.innerHTML = `
            <div class="varden-commission-empty">
                No hay servicios disponibles.
            </div>
        `;

        return;
    }

    barberServiceCommissions.innerHTML =
        services.map(service => {
            const id = String(service.id);

            const config = normalizeCommission(
                commissions[id]
            );

            const assigned = selectedIds.has(id);

            const active =
                service.status !== "inactive";

            const disabled = active
                ? ""
                : "disabled";

            const price = Math.max(
                0,
                safeNumber(service.price)
            );

            return `
                <div
                    class="
                        varden-commission-item
                        ${assigned ? "" : "is-unassigned"}
                    "
                    data-service-id="${escapeHTML(id)}"
                    data-service-price="${price}"
                >

                    <div class="varden-commission-header">

                        <div>

                            <strong>
                                ${escapeHTML(service.name || "Servicio")}
                            </strong>

                            <small class="commission-assigned-label">
                                ${
                                    !active
                                        ? "Servicio inactivo"
                                        : assigned
                                            ? "Servicio asignado"
                                            : "No asignado al barbero"
                                }
                            </small>

                        </div>

                        <span class="varden-commission-price">
                            ${formatMoneyPrecise(price)}
                        </span>

                    </div>

                    <div class="varden-commission-fields">

                        <div class="varden-commission-field">

                            <label>
                                Tipo de comisión
                            </label>

                            <select
                                class="commission-type"
                                ${disabled}
                            >

                                <option
                                    value="percentage"
                                    ${
                                        config.type === "percentage"
                                            ? "selected"
                                            : ""
                                    }
                                >
                                    Porcentaje
                                </option>

                                <option
                                    value="fixed"
                                    ${
                                        config.type === "fixed"
                                            ? "selected"
                                            : ""
                                    }
                                >
                                    Monto fijo
                                </option>

                            </select>

                        </div>

                        <div class="varden-commission-field">

                            <label class="commission-value-label">
                                ${
                                    config.type === "percentage"
                                        ? "Porcentaje (%)"
                                        : "Monto fijo (MXN)"
                                }
                            </label>

                            <input
                                type="number"
                                class="commission-value"
                                min="0"
                                ${
                                    config.type === "percentage"
                                        ? 'max="100"'
                                        : ""
                                }
                                step="0.01"
                                inputmode="decimal"
                                value="${config.value}"
                                ${disabled}
                            >

                        </div>

                    </div>

                    <div class="varden-commission-result">

                        <span>
                            Ganancia por este servicio
                        </span>

                        <strong class="commission-preview">
                            $0.00
                        </strong>

                    </div>

                </div>
            `;
        }).join("");

    barberServiceCommissions
        .querySelectorAll(".varden-commission-item")
        .forEach(updateCommissionPreview);
}

function updateCommissionPreview(row) {
    if (!row) {
        return;
    }

    const type = row.querySelector(
        ".commission-type"
    )?.value || "percentage";

    const input = row.querySelector(
        ".commission-value"
    );

    if (!input) {
        return;
    }

    const value = Math.max(
        0,
        safeNumber(input.value)
    );

    const price = Math.max(
        0,
        safeNumber(row.dataset.servicePrice)
    );

    const earnings = type === "fixed"
        ? value
        : price * value / 100;

    const label = row.querySelector(
        ".commission-value-label"
    );

    if (label) {
        label.textContent = type === "fixed"
            ? "Monto fijo (MXN)"
            : "Porcentaje (%)";
    }

    if (type === "percentage") {
        input.max = "100";
    } else {
        input.removeAttribute("max");
    }

    const preview = row.querySelector(
        ".commission-preview"
    );

    if (preview) {
        preview.textContent =
            formatMoneyPrecise(earnings);
    }
}

function updateAssignedCommissionState() {
    if (!barberServiceCommissions) {
        return;
    }

    const selectedIds = new Set(
        getSelectedServiceIds()
    );

    barberServiceCommissions
        .querySelectorAll(".varden-commission-item")
        .forEach(row => {
            const assigned = selectedIds.has(
                row.dataset.serviceId
            );

            row.classList.toggle(
                "is-unassigned",
                !assigned
            );

            const label = row.querySelector(
                ".commission-assigned-label"
            );

            const typeInput = row.querySelector(
                ".commission-type"
            );

            if (label) {
                label.textContent = typeInput?.disabled
                    ? "Servicio inactivo"
                    : assigned
                        ? "Servicio asignado"
                        : "No asignado al barbero";
            }
        });
}

function collectBarberCommissions() {
    if (!barberServiceCommissions) {
        showToast(
            "Falta la sección de comisiones en el formulario."
        );

        return null;
    }

    const result = {};

    const rows = barberServiceCommissions
        .querySelectorAll(".varden-commission-item");

    for (const row of rows) {
        const id = row.dataset.serviceId;

        const typeInput = row.querySelector(
            ".commission-type"
        );

        const valueInput = row.querySelector(
            ".commission-value"
        );

        if (!typeInput || !valueInput) {
            continue;
        }

        if (typeInput.disabled || valueInput.disabled) {
            continue;
        }

        const type = typeInput.value;
        const raw = valueInput.value.trim();
        const value = Number(raw);

        if (
            raw === "" ||
            !Number.isFinite(value) ||
            value < 0 ||
            (type === "percentage" && value > 100)
        ) {
            showToast(
                "Revisa las comisiones de los servicios."
            );

            valueInput.focus();

            return null;
        }

        result[id] = {
            type: type === "fixed"
                ? "fixed"
                : "percentage",
            value
        };
    }

    return result;
}

function getPaymentDescription(barber) {
    const assignedIds = safeArray(
        barber?.serviceIds
    );

    if (!assignedIds.length) {
        return "Sin servicios configurados";
    }

    return "Comisiones por servicio";
}

/* =========================================================
   SERVICIOS DEL BARBERO
========================================================= */

function renderServices(selectedIds = []) {
    if (!barberServices) {
        return;
    }

    const services = getSafeServices().filter(
        service => service && service.id != null
    );

    const selected = new Set(
        safeArray(selectedIds).map(String)
    );

    if (!services.length) {
        barberServices.innerHTML = `
            <div class="empty">
                No hay servicios disponibles.
                Puedes crearlos desde la pestaña Servicios.
            </div>
        `;

        return;
    }

    barberServices.innerHTML = services.map(service => `
        <label class="modern-service-option">

            <input
                type="checkbox"
                value="${escapeHTML(service.id)}"
                ${selected.has(String(service.id)) ? "checked" : ""}
                ${
                    service.status === "inactive"
                        ? "disabled"
                        : ""
                }
            >

            <span class="modern-service-check">✓</span>

            <div>

                <strong>
                    ${escapeHTML(service.name || "Servicio")}
                </strong>

                <small>
                    ${safeNumber(service.duration)} min ·
                    ${formatMoney(service.price)}
                    ${
                        service.status === "inactive"
                            ? " · Inactivo"
                            : ""
                    }
                </small>

            </div>

        </label>
    `).join("");
}

/* =========================================================
   RESUMEN
========================================================= */

function renderSummary() {
    if (!barberSummary) {
        return;
    }

    const barbers = getBarbers();

    const active = barbers.filter(
        barber => barber.status === "active"
    );

    const workingToday = active.filter(
        barber => getTodaySchedule(barber).enabled
    );

    barberSummary.innerHTML = `
        <div class="barber-summary-item">
            <strong>${barbers.length}</strong>
            <span>Profesionales</span>
        </div>

        <div class="barber-summary-divider"></div>

        <div class="barber-summary-item">
            <strong>${active.length}</strong>
            <span>Activos</span>
        </div>

        <div class="barber-summary-divider"></div>

        <div class="barber-summary-item">
            <strong>${workingToday.length}</strong>
            <span>Trabajando hoy</span>
        </div>
    `;
}

/* =========================================================
   CITAS DEL DÍA
========================================================= */

function getAppointmentsToday(barberId, appointments) {
    const today = getLocalDate();

    return safeArray(appointments).filter(
        appointment =>
            appointment &&
            String(appointment.barberId) === String(barberId) &&
            appointment.date === today &&
            !["cancelled", "no-show"].includes(
                appointment.status
            )
    ).length;
}

/* =========================================================
   TARJETAS DE PERSONAL
========================================================= */

function renderBarbers() {
    if (!barbersGrid) {
        return;
    }

    const barbers = getBarbers();

    const appointments = getSafeAppointments();

    const services = getSafeServices().filter(
        service => service && service.id != null
    );

    if (!barbers.length) {
        barbersGrid.innerHTML = `
            <div class="module-empty-state">

                <div class="module-empty-icon">
                    +
                </div>

                <strong>
                    No hay profesionales registrados
                </strong>

                <p>
                    Agrega el primer profesional de tu equipo.
                </p>

                <button
                    type="button"
                    class="btn btn-dark"
                    data-action="new"
                >
                    + Nuevo profesional
                </button>

            </div>
        `;

        return;
    }

    barbersGrid.innerHTML = barbers.map(barber => {
        const appointmentsToday = getAppointmentsToday(
            barber.id,
            appointments
        );

        const todaySchedule = getTodaySchedule(barber);

        const assignedIds = safeArray(
            barber.serviceIds
        );

        const serviceList = assignedIds
            .map(id => services.find(
                service =>
                    String(service.id) === String(id)
            ))
            .filter(Boolean);

        const isActive = barber.status === "active";

        const paymentDescription =
            getPaymentDescription(barber);

        return `
            <article
                class="
                    modern-barber-card
                    ${isActive ? "" : "is-inactive"}
                "
            >

                <div class="modern-barber-top">

                    <div class="modern-barber-person">

                        <div class="modern-barber-avatar">
                            ${escapeHTML(getInitials(barber.name))}
                        </div>

                        <div class="modern-barber-name">

                            <h3>
                                ${escapeHTML(barber.name || "Sin nombre")}
                            </h3>

                            <span>Profesional</span>

                        </div>

                    </div>

                    <div
                        class="
                            modern-status
                            ${isActive ? "active" : "inactive"}
                        "
                    >
                        <span></span>

                        ${isActive ? "Activo" : "Inactivo"}
                    </div>

                </div>

                <div class="modern-barber-metrics">

                    <div>
                        <strong>${appointmentsToday}</strong>
                        <span>Citas hoy</span>
                    </div>

                    <div>
                        <strong>${serviceList.length}</strong>
                        <span>Servicios</span>
                    </div>

                </div>

                <div class="barber-payment-card">

                    <span>
                        Remuneración
                    </span>

                    <strong>
                        ${escapeHTML(paymentDescription)}
                    </strong>

                </div>

                <div class="modern-barber-schedule">

                    <span>
                        Horario de hoy
                    </span>

                    <strong>
                        ${
                            isActive
                                ? formatTodaySchedule(todaySchedule)
                                : "No disponible"
                        }
                    </strong>

                </div>

                <div class="modern-barber-services">

                    ${
                        serviceList.length
                            ? serviceList.map(service => `
                                <span>
                                    ${escapeHTML(service.name || "Servicio")}
                                </span>
                            `).join("")
                            : `
                                <span>
                                    Sin servicios asignados
                                </span>
                            `
                    }

                </div>

                <div class="modern-barber-footer">

                    <span>
                        ${escapeHTML(
                            barber.phone || "Sin teléfono"
                        )}
                    </span>

                    <div class="modern-card-actions">

                        <button
                            type="button"
                            class="modern-delete-button"
                            data-action="delete"
                            data-id="${escapeHTML(barber.id)}"
                        >
                            Eliminar
                        </button>

                        <button
                            type="button"
                            class="modern-edit-button"
                            data-action="edit"
                            data-id="${escapeHTML(barber.id)}"
                        >
                            Editar
                            <span>→</span>
                        </button>

                    </div>

                </div>

            </article>
        `;
    }).join("");
}

/* =========================================================
   MODAL
========================================================= */

function openModal() {
    if (!barberModal) {
        return;
    }

    barberModal.classList.remove("hidden");

    document.body.classList.add("modal-open");

    setTimeout(() => {
        barberName?.focus();
    }, 50);
}

function closeModal() {
    if (!barberModal) {
        return;
    }

    barberModal.classList.add("hidden");

    document.body.classList.remove("modal-open");

    editingBarberId = null;
}

function updateModalAvatar() {
    if (!barberModalAvatar || !barberName) {
        return;
    }

    barberModalAvatar.textContent =
        getInitials(barberName.value);
}

/* =========================================================
   NUEVO BARBERO
========================================================= */

function openNewBarber() {
    editingBarberId = null;

    if (barberModalTitle) {
        barberModalTitle.textContent =
            "Nuevo profesional";
    }

    if (barberName) {
        barberName.value = "";
    }

    if (barberPhone) {
        barberPhone.value = "";
    }

    if (barberActiveSwitch) {
        barberActiveSwitch.checked = true;
    }

    if (barberModalAvatar) {
        barberModalAvatar.textContent = "NP";
    }

    const selectedServices = getSafeServices()
        .filter(service =>
            service &&
            service.status !== "inactive"
        )
        .map(service => service.id);

    renderServices(selectedServices);

    renderBarberCommissions();

    renderSchedule(createSchedule());

    openModal();
}

/* =========================================================
   EDITAR BARBERO
========================================================= */

function openEditBarber(id) {
    const barber = getBarbers().find(
        item => String(item.id) === String(id)
    );

    if (!barber) {
        showToast("No se encontró el profesional.");
        return;
    }

    editingBarberId = barber.id;

    if (barberModalTitle) {
        barberModalTitle.textContent =
            barber.name || "Editar profesional";
    }

    if (barberName) {
        barberName.value = barber.name || "";
    }

    if (barberPhone) {
        barberPhone.value = barber.phone || "";
    }

    if (barberActiveSwitch) {
        barberActiveSwitch.checked =
            barber.status === "active";
    }

    if (barberModalAvatar) {
        barberModalAvatar.textContent =
            getInitials(barber.name);
    }

    renderServices(
        safeArray(barber.serviceIds)
    );

    renderBarberCommissions(barber);

    renderSchedule(
        barber.schedule || createSchedule()
    );

    openModal();
}

/* =========================================================
   GUARDAR BARBERO
========================================================= */

function saveBarber() {
    if (!barberName || !barberPhone) {
        showToast(
            "No se encontraron los campos del formulario."
        );

        return;
    }

    const name = barberName.value.trim();
    const phone = barberPhone.value.trim();

    if (!name) {
        showToast(
            "Ingresa el nombre del profesional."
        );

        barberName.focus();

        return;
    }

    const serviceCommissions =
        collectBarberCommissions();

    if (serviceCommissions === null) {
        return;
    }

    const selectedServices =
        getSelectedServiceIds();

    const schedule = collectSchedule();

    if (!validateSchedule(schedule)) {
        return;
    }

    const barbers = getBarbers();

    const status = barberActiveSwitch?.checked
        ? "active"
        : "inactive";

    if (editingBarberId !== null) {
        const barber = barbers.find(
            item =>
                String(item.id) === String(editingBarberId)
        );

        if (!barber) {
            showToast(
                "No se encontró el profesional."
            );

            return;
        }

        barber.name = name;
        barber.phone = phone;
        barber.status = status;
        barber.serviceIds = selectedServices;
        barber.schedule = schedule;

        barber.serviceCommissions = {
            ...getBarberCommissions(barber),
            ...serviceCommissions
        };

        barber.updatedAt =
            new Date().toISOString();

        if (!saveBarbers(barbers)) {
            return;
        }

        closeModal();
        renderAll();

        showToast(
            `${name} actualizado correctamente.`
        );

        return;
    }

    barbers.push({
        id: generateId("barber"),
        name,
        phone,
        status,
        serviceIds: selectedServices,
        schedule,
        serviceCommissions,
        createdAt: new Date().toISOString()
    });

    if (!saveBarbers(barbers)) {
        return;
    }

    closeModal();
    renderAll();

    showToast(
        `${name} fue agregado al equipo.`
    );
}

/* =========================================================
   ELIMINAR BARBERO
========================================================= */

function deleteBarber(barberId) {
    const barbers = getBarbers();

    const barber = barbers.find(
        item => String(item.id) === String(barberId)
    );

    if (!barber) {
        showToast(
            "No se encontró el profesional."
        );

        return;
    }

    const appointments = getSafeAppointments();

    const linkedAppointments = appointments.filter(
        appointment =>
            appointment &&
            String(appointment.barberId) === String(barberId)
    );

    const futureAppointments = linkedAppointments.filter(
        appointment =>
            appointment.date >= getLocalDate() &&
            !["cancelled", "no-show", "completed"].includes(
                appointment.status
            )
    );

    let message =
        `¿Eliminar a "${barber.name}"?\n\n` +
        "Su tarjeta desaparecerá y no podrá recibir " +
        "nuevas citas.\n\n" +
        "Las citas ya registradas se conservarán.";

    if (futureAppointments.length) {
        message +=
            `\n\nATENCIÓN: Tiene ${futureAppointments.length} ` +
            "cita(s) futura(s). Deberás revisarlas y " +
            "reasignarlas manualmente.";
    }

    if (!window.confirm(message)) {
        return;
    }

    const updatedBarbers = barbers.filter(
        item =>
            String(item.id) !== String(barberId)
    );

    if (!saveBarbers(updatedBarbers)) {
        return;
    }

    if (
        editingBarberId !== null &&
        String(editingBarberId) === String(barberId)
    ) {
        closeModal();
    }

    renderAll();

    showToast(
        `${barber.name} fue eliminado del personal.`
    );
}

/* =========================================================
   ACCIONES DE TARJETAS
========================================================= */

function handleGridAction(event) {
    const button = event.target.closest(
        "[data-action]"
    );

    if (
        !button ||
        !barbersGrid ||
        !barbersGrid.contains(button)
    ) {
        return;
    }

    const action = button.dataset.action;
    const id = button.dataset.id;

    if (action === "new") {
        openNewBarber();
        return;
    }

    if (action === "edit") {
        openEditBarber(id);
        return;
    }

    if (action === "delete") {
        deleteBarber(id);
    }
}

/* =========================================================
   EVENTOS
========================================================= */

function configureEvents() {
    $("newBarberButton")?.addEventListener(
        "click",
        openNewBarber
    );

    $("closeBarberModal")?.addEventListener(
        "click",
        closeModal
    );

    $("cancelBarberButton")?.addEventListener(
        "click",
        closeModal
    );

    $("saveBarberButton")?.addEventListener(
        "click",
        saveBarber
    );

    barbersGrid?.addEventListener(
        "click",
        handleGridAction
    );

    scheduleEditor?.addEventListener(
        "change",
        event => {
            if (
                event.target.matches(
                    ".schedule-enabled"
                )
            ) {
                updateScheduleState(event.target);
            }
        }
    );

    barberServices?.addEventListener(
        "change",
        event => {
            if (
                event.target.matches(
                    "input[type='checkbox']"
                )
            ) {
                updateAssignedCommissionState();
            }
        }
    );

    barberServiceCommissions?.addEventListener(
        "input",
        event => {
            const row = event.target.closest(
                ".varden-commission-item"
            );

            if (row) {
                updateCommissionPreview(row);
            }
        }
    );

    barberServiceCommissions?.addEventListener(
        "change",
        event => {
            const row = event.target.closest(
                ".varden-commission-item"
            );

            if (row) {
                updateCommissionPreview(row);
            }
        }
    );

    barberName?.addEventListener(
        "input",
        updateModalAvatar
    );

    barberModal?.addEventListener(
        "click",
        event => {
            if (event.target === barberModal) {
                closeModal();
            }
        }
    );

    document.addEventListener(
        "keydown",
        event => {
            if (
                event.key === "Escape" &&
                barberModal &&
                !barberModal.classList.contains("hidden")
            ) {
                closeModal();
            }
        }
    );

    window.addEventListener(
        "storage",
        event => {
            if (
                event.key === STORAGE_KEY ||
                event.key === "barbershop_services" ||
                event.key === "barbershop_appointments"
            ) {
                renderAll();
            }
        }
    );
}

/* =========================================================
   NOTIFICACIONES
========================================================= */

function showToast(message) {
    const toast = $("toast");

    if (!toast) {
        window.alert(message);
        return;
    }

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2800);
}

/* =========================================================
   INICIO PROTEGIDO
========================================================= */

function initialize() {
    try {
        seedBarbers();

        configureEvents();

        renderSummary();

        renderBarbers();
    } catch (error) {
        console.error(
            "VARDEN: Error al iniciar Personal:",
            error
        );

        if (barbersGrid) {
            barbersGrid.innerHTML = `
                <div class="module-empty-state">

                    <strong>
                        No se pudo cargar el equipo
                    </strong>

                    <p>
                        Ocurrió un problema al cargar Personal.
                        Revisa la consola del navegador.
                    </p>

                </div>
            `;
        }
    }
}

function renderAll() {
    try {
        renderSummary();
        renderBarbers();
    } catch (error) {
        console.error(
            "VARDEN: Error al actualizar Personal:",
            error
        );
    }
}

initialize();
