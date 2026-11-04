
/* =========================================================
   VARDEN — REPORTES
   Archivo: js/reports.js
========================================================= */

import { origins } from "./data.js";

import { getAppointments } from "./storage.js";

import {
    getServices,
    getStaff
} from "./catalog.js";

/* =========================================================
   ESTADO
========================================================= */

let currentPeriod = "week";
let customStartDate = "";
let customEndDate = "";
let calendarApplied = false;

/* =========================================================
   ELEMENTOS
========================================================= */

const $ = id => document.getElementById(id);

const reportSummary = $("reportSummary");
const reportDateRange = $("reportDateRange");

const revenueReport = $("revenueReport");
const statusReport = $("statusReport");
const servicesReport = $("servicesReport");
const barbersReport = $("barbersReport");
const originsReport = $("originsReport");

const staffPayrollSummary = $("staffPayrollSummary");
const staffPayrollList = $("staffPayrollList");
const staffPayrollNote = $("staffPayrollNote");

const reportCalendarPanel = $("reportCalendarPanel");
const reportStartDate = $("reportStartDate");
const reportEndDate = $("reportEndDate");
const applyReportDates = $("applyReportDates");
const reportCalendarError = $("reportCalendarError");

/* =========================================================
   UTILIDADES
========================================================= */

function safeArray(value) {
    return Array.isArray(value) ? value : [];
}

function safeObject(value) {
    return value &&
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

function money(value) {
    return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(safeNumber(value));
}

function escapeHTML(value) {
    const element = document.createElement("div");
    element.textContent = String(value ?? "");
    return element.innerHTML;
}

function normalizePhone(value) {
    return String(value || "").replace(/\D/g, "");
}

function getInitials(name) {
    return String(name || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(word => word[0].toUpperCase())
        .join("") || "?";
}

function formatDateForInput(date) {
    const year = date.getFullYear();

    const month = String(
        date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
        date.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function parseDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(
        String(value ?? "")
    );

    if (!match) {
        return new Date(NaN);
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const date = new Date(year, month - 1, day);

    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return new Date(NaN);
    }

    return date;
}

function formatDisplayDate(value) {
    const date = parseDate(value);

    if (Number.isNaN(date.getTime())) {
        return String(value || "—");
    }

    return new Intl.DateTimeFormat("es-MX", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    }).format(date);
}

function emptyReport() {
    return `
        <div class="report-simple-empty">
            Sin información en este período.
        </div>
    `;
}

function getSafeAppointments() {
    try {
        return safeArray(getAppointments());
    } catch (error) {
        console.error(
            "VARDEN: Error leyendo citas",
            error
        );
        return [];
    }
}

function getSafeServices() {
    try {
        return safeArray(getServices());
    } catch (error) {
        console.error(
            "VARDEN: Error leyendo servicios",
            error
        );
        return [];
    }
}

function getSafeStaff() {
    try {
        return safeArray(getStaff());
    } catch (error) {
        console.error(
            "VARDEN: Error leyendo personal",
            error
        );
        return [];
    }
}

/* =========================================================
   FILTROS
========================================================= */

function setActivePeriodButton(period) {
    document
        .querySelectorAll("[data-period]")
        .forEach(button => {
            const active =
                button.dataset.period === period;

            button.classList.toggle("active", active);

            button.setAttribute(
                "aria-pressed",
                String(active)
            );

            if (button.dataset.period === "custom") {
                button.setAttribute(
                    "aria-expanded",
                    String(!reportCalendarPanel.hidden)
                );
            }
        });
}

function showCalendarError(message) {
    reportCalendarError.textContent = message;
    reportCalendarError.hidden = !message;
}

function closeCalendar() {
    reportCalendarPanel.hidden = true;
    setActivePeriodButton(currentPeriod);
}

function openCalendar() {
    reportCalendarPanel.hidden = false;

    if (calendarApplied) {
        reportStartDate.value = customStartDate;
        reportEndDate.value = customEndDate;
    } else {
        const today = formatDateForInput(new Date());

        if (!reportStartDate.value) {
            reportStartDate.value = today;
        }

        if (!reportEndDate.value) {
            reportEndDate.value = today;
        }
    }

    setActivePeriodButton(currentPeriod);
}

function selectPeriod(period) {
    const valid = [
        "today",
        "week",
        "month",
        "all",
        "custom"
    ];

    if (!valid.includes(period)) {
        return;
    }

    showCalendarError("");

    if (period === "custom") {
        if (reportCalendarPanel.hidden) {
            openCalendar();
        } else {
            closeCalendar();
        }

        return;
    }

    currentPeriod = period;
    closeCalendar();
    renderReports();
}

function applyCalendarFilter() {
    const start = reportStartDate.value;
    const end = reportEndDate.value;

    if (!start || !end) {
        showCalendarError(
            "Selecciona las fechas Desde y Hasta."
        );
        return;
    }

    if (
        Number.isNaN(parseDate(start).getTime()) ||
        Number.isNaN(parseDate(end).getTime())
    ) {
        showCalendarError(
            "Selecciona fechas válidas."
        );
        return;
    }

    if (start > end) {
        showCalendarError(
            "La fecha inicial no puede ser posterior a la final."
        );
        return;
    }

    customStartDate = start;
    customEndDate = end;
    calendarApplied = true;
    currentPeriod = "custom";

    showCalendarError("");
    closeCalendar();
    renderReports();
}

function getFilteredAppointments() {
    const appointments = getSafeAppointments();

    if (currentPeriod === "all") {
        return appointments;
    }

    if (currentPeriod === "custom") {
        if (!calendarApplied) {
            return [];
        }

        return appointments.filter(appointment => {
            const date = String(
                appointment?.date || ""
            );

            return (
                date >= customStartDate &&
                date <= customEndDate
            );
        });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days = currentPeriod === "week"
        ? 6
        : currentPeriod === "month"
            ? 29
            : 0;

    const start = new Date(today);
    start.setDate(start.getDate() - days);

    const end = new Date(today);
    end.setHours(23, 59, 59, 999);

    return appointments.filter(appointment => {
        const date = parseDate(appointment?.date);

        return (
            !Number.isNaN(date.getTime()) &&
            date >= start &&
            date <= end
        );
    });
}

function renderPeriod() {
    const labels = {
        today: "Actividad de hoy",
        week: "Últimos 7 días",
        month: "Últimos 30 días",
        all: "Todo el historial"
    };

    reportDateRange.textContent =
        currentPeriod === "custom"
            ? (
                `Del ${formatDisplayDate(customStartDate)}` +
                ` al ${formatDisplayDate(customEndDate)}`
            )
            : labels[currentPeriod];
}

/* =========================================================
   DATOS DE SERVICIOS Y PRECIOS
========================================================= */

function getAppointmentServiceIds(appointment) {
    const ids =
        Array.isArray(appointment.serviceIds) &&
        appointment.serviceIds.length
            ? appointment.serviceIds
            : appointment.serviceId != null &&
              appointment.serviceId !== ""
                ? [appointment.serviceId]
                : [];

    return ids
        .filter(id => id !== null && id !== "")
        .map(String);
}

function getCatalogService(id, services) {
    return services.find(
        service => String(service.id) === String(id)
    );
}

function getStoredTotal(appointment) {
    const fields = [
        "amountCharged",
        "price",
        "servicePrice"
    ];

    for (const field of fields) {
        const value = appointment[field];

        if (
            value !== null &&
            value !== undefined &&
            value !== ""
        ) {
            const number = Number(value);

            if (Number.isFinite(number)) {
                return Math.max(0, number);
            }
        }
    }

    return null;
}

function getAppointmentRevenue(
    appointment,
    services = getSafeServices()
) {
    if (appointment.status !== "completed") {
        return 0;
    }

    const stored = getStoredTotal(appointment);

    if (stored !== null) {
        return stored;
    }

    const ids = getAppointmentServiceIds(appointment);

    return ids.reduce((total, id) => {
        const service = getCatalogService(
            id,
            services
        );

        return total + Math.max(
            0,
            safeNumber(service?.price)
        );
    }, 0);
}

/*
   Si una cita tiene varios servicios y únicamente
   guarda un total, el importe se reparte de forma
   proporcional según los precios del catálogo.
*/

function getServiceAmounts(appointment, services) {
    const ids = getAppointmentServiceIds(appointment);
    const result = [];

    if (!ids.length) {
        return result;
    }

    const prices = ids.map(id => {
        const service = getCatalogService(
            id,
            services
        );

        return Math.max(
            0,
            safeNumber(service?.price)
        );
    });

    const catalogTotal = prices.reduce(
        (sum, price) => sum + price,
        0
    );

    const storedTotal = getStoredTotal(appointment);

    const total = storedTotal !== null
        ? storedTotal
        : catalogTotal;

    const amountPerService = ids.map((id, index) => {
        if (catalogTotal > 0) {
            return total * prices[index] / catalogTotal;
        }

        return total / ids.length;
    });

    ids.forEach((id, index) => {
        const service = getCatalogService(
            id,
            services
        );

        result.push({
            id,
            name:
                service?.name ||
                (
                    ids.length === 1
                        ? appointment.serviceName
                        : null
                ) ||
                "Servicio no disponible",
            amount: amountPerService[index],
            estimated:
                storedTotal !== null &&
                ids.length > 1
        });
    });

    return result;
}

function calculateRevenue(appointments, services) {
    return appointments.reduce(
        (sum, appointment) =>
            sum + getAppointmentRevenue(
                appointment,
                services
            ),
        0
    );
}

/* =========================================================
   COMISIONES
========================================================= */

function normalizeCommission(config) {
    const safe = safeObject(config);

    const type = safe.type === "fixed"
        ? "fixed"
        : "percentage";

    const value = Math.max(
        0,
        safeNumber(safe.value)
    );

    return {
        type,
        value
    };
}

function getCommissionConfig(person, serviceId) {
    const commissions = safeObject(
        person.serviceCommissions
    );

    if (
        Object.prototype.hasOwnProperty.call(
            commissions,
            String(serviceId)
        )
    ) {
        return {
            ...normalizeCommission(
                commissions[String(serviceId)]
            ),
            configured: true
        };
    }

    if (
        person.paymentType === "fixed" ||
        person.paymentType === "percentage"
    ) {
        return {
            ...normalizeCommission({
                type: person.paymentType,
                value: person.paymentValue
            }),
            configured: true
        };
    }

    return {
        type: "percentage",
        value: 0,
        configured: false
    };
}

function calculateServiceCommission(
    commission,
    serviceAmount
) {
    if (commission.type === "fixed") {
        return commission.value;
    }

    return Math.max(
        0,
        serviceAmount * commission.value / 100
    );
}

/* =========================================================
   AGRUPACIÓN DE ACTIVIDAD Y PAGOS
========================================================= */

function buildLegacyStaffActivity(
    appointments,
    services,
    staff
) {
    const map = new Map();

    for (const person of staff) {
        if (!person || person.id == null) {
            continue;
        }

        map.set(String(person.id), {
            id: String(person.id),
            name: person.name || "Profesional",
            person,
            appointments: 0,
            serviceCount: 0,
            revenue: 0,
            commission: 0,
            unconfigured: 0,
            estimated: 0,
            services: new Map()
        });
    }

    for (const appointment of appointments) {
        if (
            !appointment ||
            appointment.status !== "completed"
        ) {
            continue;
        }

        const personId =
            appointment.staffId ??
            appointment.barberId;

        if (personId == null || personId === "") {
            continue;
        }

        const id = String(personId);

        if (!map.has(id)) {
            map.set(id, {
                id,
                name:
                    appointment.professionalName ||
                    appointment.staffName ||
                    "Profesional no registrado",
                person: {},
                appointments: 0,
                serviceCount: 0,
                revenue: 0,
                commission: 0,
                unconfigured: 0,
                estimated: 0,
                services: new Map()
            });
        }

        const entry = map.get(id);

        entry.appointments += 1;

        entry.revenue += getAppointmentRevenue(
            appointment,
            services
        );

        const serviceAmounts = getServiceAmounts(
            appointment,
            services
        );

        for (const service of serviceAmounts) {
            const commissionConfig =
                getCommissionConfig(
                    entry.person,
                    service.id
                );

            const earned = commissionConfig.configured
                ? calculateServiceCommission(
                    commissionConfig,
                    service.amount
                )
                : 0;

            entry.serviceCount += 1;
            entry.commission += earned;

            if (!commissionConfig.configured) {
                entry.unconfigured += 1;
            }

            if (service.estimated) {
                entry.estimated += 1;
            }

            if (!entry.services.has(service.id)) {
                entry.services.set(service.id, {
                    id: service.id,
                    name: service.name,
                    count: 0,
                    revenue: 0,
                    commission: 0,
                    unconfigured: 0
                });
            }

            const item = entry.services.get(service.id);

            item.count += 1;
            item.revenue += service.amount;
            item.commission += earned;

            if (!commissionConfig.configured) {
                item.unconfigured += 1;
            }
        }
    }

    return [...map.values()]
        .filter(person =>
            person.appointments > 0 ||
            person.serviceCount > 0
        )
        .sort((a, b) =>
            b.commission - a.commission ||
            b.serviceCount - a.serviceCount ||
            a.name.localeCompare(b.name, "es")
        );
}

/* =========================================================
   RESUMEN GENERAL
========================================================= */

function renderSummary(appointments, services) {
    const completed = appointments.filter(
        appointment =>
            appointment.status === "completed"
    );

    const cancelled = appointments.filter(
        appointment =>
            ["cancelled", "no-show"].includes(
                appointment.status
            )
    );

    const revenue = calculateRevenue(
        completed,
        services
    );

    const customers = new Set(
        completed
            .map(appointment =>
                normalizePhone(appointment.phone)
            )
            .filter(Boolean)
    ).size;

    reportSummary.innerHTML = `
        <div class="module-summary-item">
            <strong>${money(revenue)}</strong>
            <span>Ingresos</span>
        </div>

        <div class="module-summary-divider"></div>

        <div class="module-summary-item">
            <strong>${appointments.length}</strong>
            <span>Citas</span>
        </div>

        <div class="module-summary-divider"></div>

        <div class="module-summary-item">
            <strong>${completed.length}</strong>
            <span>Completadas</span>
        </div>

        <div class="module-summary-divider"></div>

        <div class="module-summary-item">
            <strong>${customers}</strong>
            <span>Clientes</span>
        </div>

        <div class="module-summary-divider"></div>

        <div class="module-summary-item">
            <strong>${cancelled.length}</strong>
            <span>Canceladas / no-show</span>
        </div>
    `;
}

/* =========================================================
   INGRESOS — COMPATIBLE CON PAGOS MIXTOS
========================================================= */

function renderRevenue(appointments, services) {
    const completed = appointments.filter(
        appointment =>
            appointment.status === "completed"
    );

    const revenue = calculateRevenue(
        completed,
        services
    );

    const ticket = completed.length
        ? revenue / completed.length
        : 0;

    const totals = {
        cash: 0,
        card: 0,
        transfer: 0
    };

    let unclassified = 0;

    for (const appointment of completed) {
        const charged = getAppointmentRevenue(
            appointment,
            services
        );

        if (appointment.paid !== true) {
            unclassified += charged;
            continue;
        }

        if (Array.isArray(appointment.payments)) {
            let assignedCents = 0;

            for (const payment of appointment.payments) {
                const amount = Math.max(
                    0,
                    safeNumber(payment?.amount)
                );

                if (
                    Object.prototype.hasOwnProperty.call(
                        totals,
                        payment?.method
                    )
                ) {
                    totals[payment.method] += amount;
                    assignedCents += Math.round(
                        amount * 100
                    );
                }
            }

            unclassified += (
                Math.round(charged * 100) -
                assignedCents
            ) / 100;

            continue;
        }

        const method = appointment.paymentMethod;

        if (
            Object.prototype.hasOwnProperty.call(
                totals,
                method
            )
        ) {
            totals[method] += charged;
        } else {
            unclassified += charged;
        }
    }

    const methods = [
        ["cash", "Efectivo"],
        ["card", "Tarjeta"],
        ["transfer", "Transferencia"]
    ];

    const methodRows = methods.map(([id, label]) => `
        <div class="report-info-row">
            <span>${label}</span>
            <strong>${money(totals[id])}</strong>
        </div>
    `).join("");

    revenueReport.innerHTML = `
        <div class="report-primary-value">
            <span>Total</span>
            <strong>${money(revenue)}</strong>
        </div>

        <div class="report-info-row">
            <span>Citas completadas</span>
            <strong>${completed.length}</strong>
        </div>

        <div class="report-info-row">
            <span>Ticket promedio</span>
            <strong>${money(ticket)}</strong>
        </div>

        ${methodRows}

        <div class="report-info-row">
            <span>Sin método registrado / ajustes</span>
            <strong>${money(unclassified)}</strong>
        </div>
    `;
}

/* =========================================================
   ESTADOS DE CITAS
========================================================= */

function renderStatuses(appointments) {
    const statuses = [
        ["completed", "Completadas"],
        ["confirmed", "Confirmadas"],
        ["pending", "Pendientes"],
        ["cancelled", "Canceladas"],
        ["no-show", "No asistió"]
    ];

    statusReport.innerHTML = statuses.map(
        ([id, label]) => {
            const count = appointments.filter(
                appointment =>
                    appointment.status === id
            ).length;

            return `
                <div class="report-info-row">
                    <span>${label}</span>
                    <strong>${count}</strong>
                </div>
            `;
        }
    ).join("");
}

/* =========================================================
   REPORTE DE SERVICIOS
========================================================= */

function renderServices(appointments, services) {
    const map = new Map();

    for (const appointment of appointments) {
        if (appointment.status !== "completed") {
            continue;
        }

        const items = getServiceAmounts(
            appointment,
            services
        );

        for (const service of items) {
            if (!map.has(service.id)) {
                map.set(service.id, {
                    name: service.name,
                    count: 0,
                    revenue: 0
                });
            }

            const entry = map.get(service.id);

            entry.count += 1;
            entry.revenue += service.amount;
        }
    }

    const data = [...map.values()]
        .sort((a, b) =>
            b.count - a.count ||
            b.revenue - a.revenue
        );

    if (!data.length) {
        servicesReport.innerHTML = emptyReport();
        return;
    }

    servicesReport.innerHTML = data.map(item => `
        <div class="report-entity-row">
            <div>
                <strong>${escapeHTML(item.name)}</strong>
                <span>
                    ${item.count}
                    ${
                        item.count === 1
                            ? "servicio"
                            : "servicios"
                    }
                </span>
            </div>
            <strong>${money(item.revenue)}</strong>
        </div>
    `).join("");
}

/* =========================================================
   ACTIVIDAD DEL PERSONAL
========================================================= */

function renderStaffActivity(activity) {
    if (!activity.length) {
        barbersReport.innerHTML = emptyReport();
        return;
    }

    barbersReport.innerHTML = [...activity]
        .sort((a, b) =>
            b.revenue - a.revenue
        )
        .map(person => `
            <div class="report-entity-row">
                <div class="report-entity-person">
                    <div class="report-mini-avatar">
                        ${escapeHTML(
                            getInitials(person.name)
                        )}
                    </div>

                    <div>
                        <strong>
                            ${escapeHTML(person.name)}
                        </strong>

                        <span>
                            ${person.appointments}
                            ${
                                person.appointments === 1
                                    ? "cita"
                                    : "citas"
                            }
                            ·
                            ${person.serviceCount}
                            ${
                                person.serviceCount === 1
                                    ? "servicio"
                                    : "servicios"
                            }
                        </span>
                    </div>
                </div>

                <strong>
                    ${money(person.revenue)}
                </strong>
            </div>
        `).join("");
}

/* =========================================================
   PAGOS AL PERSONAL
========================================================= */

function renderStaffPayroll(activity) {
    const totalCommission = activity.reduce(
        (sum, person) =>
            sum + person.commission,
        0
    );

    const totalServices = activity.reduce(
        (sum, person) =>
            sum + person.serviceCount,
        0
    );

    const unconfigured = activity.reduce(
        (sum, person) =>
            sum + person.unconfigured,
        0
    );

    const estimated = activity.reduce(
        (sum, person) =>
            sum + person.estimated,
        0
    );

    staffPayrollSummary.innerHTML = `
        <div class="staff-payroll-stat">
            <span>Comisiones generadas</span>
            <strong>
                ${money(totalCommission)}
            </strong>
        </div>

        <div class="staff-payroll-stat">
            <span>Servicios realizados</span>
            <strong>${totalServices}</strong>
        </div>

        <div class="staff-payroll-stat">
            <span>Profesionales con actividad</span>
            <strong>${activity.length}</strong>
        </div>
    `;

    if (!activity.length) {
        staffPayrollList.innerHTML = `
            <div class="staff-payroll-empty">
                No hay servicios completados por el personal
                durante este período.
            </div>
        `;

        staffPayrollNote.textContent =
            "Se consideran únicamente citas completadas.";

        return;
    }

    staffPayrollList.innerHTML = activity.map(person => {
        const details = [...person.services.values()]
            .sort((a, b) =>
                b.count - a.count ||
                b.commission - a.commission
            );

        return `
            <article class="staff-payroll-card">

                <div class="staff-payroll-card-header">
                    <div class="staff-payroll-avatar">
                        ${escapeHTML(
                            getInitials(person.name)
                        )}
                    </div>

                    <div class="staff-payroll-person">
                        <strong>
                            ${escapeHTML(person.name)}
                        </strong>

                        <span>
                            ${person.appointments}
                            ${
                                person.appointments === 1
                                    ? "cita completada"
                                    : "citas completadas"
                            }
                            ·
                            ${person.serviceCount}
                            ${
                                person.serviceCount === 1
                                    ? "servicio"
                                    : "servicios"
                            }
                        </span>
                    </div>
                </div>

                <div class="staff-payroll-amount">
                    <span>Comisiones generadas</span>
                    <strong>
                        ${money(person.commission)}
                    </strong>
                </div>

                <details class="staff-payroll-details">
                    <summary>
                        Ver desglose por servicio
                    </summary>

                    ${details.map(service => `
                        <div class="staff-payroll-detail-row">
                            <span>
                                ${escapeHTML(service.name)}
                                · ${service.count}
                                ${
                                    service.count === 1
                                        ? "realizado"
                                        : "realizados"
                                }
                                ${
                                    service.unconfigured
                                        ? " · Sin comisión configurada"
                                        : ""
                                }
                            </span>

                            <strong>
                                ${money(service.commission)}
                            </strong>
                        </div>
                    `).join("")}

                    <div class="staff-payroll-detail-row">
                        <span>Ingresos generados</span>
                        <strong>
                            ${money(person.revenue)}
                        </strong>
                    </div>
                </details>

            </article>
        `;
    }).join("");

    const notes = [
        "Solo se incluyen servicios de citas completadas.",
        "Los importes son comisiones generadas, no pagos pendientes descontando anticipos o liquidaciones."
    ];

    if (unconfigured > 0) {
        notes.push(
            `${unconfigured} servicio(s) no tienen una comisión configurada y se muestran con $0.00.`
        );
    }

    if (estimated > 0) {
        notes.push(
            `En ${estimated} servicio(s), el importe se distribuyó proporcionalmente porque la cita solo guarda un total. Revisa los resultados si hubo descuentos o cambios de precios.`
        );
    }

    staffPayrollNote.textContent = notes.join(" ");
}

/* =========================================================
   ORIGEN DE CITAS
========================================================= */

function getOriginName(origin) {
    const names = {
        whatsapp: "WhatsApp",
        instagram: "Instagram",
        facebook: "Facebook",
        phone: "Teléfono",
        "walk-in": "En persona",
        web: "Página web",
        unknown: "Sin origen"
    };

    return names[origin] || "Otro";
}

function getOriginIcon(origin) {
    const icons = {
        whatsapp: "W",
        instagram: "I",
        facebook: "F",
        phone: "☎",
        "walk-in": "P",
        web: "◎",
        unknown: "?"
    };

    return icons[origin] || "•";
}

function renderOrigins(appointments) {
    if (!appointments.length) {
        originsReport.innerHTML = emptyReport();
        return;
    }

    const counts = new Map();

    for (const appointment of appointments) {
        const origin = String(
            appointment.origin || "unknown"
        );

        counts.set(
            origin,
            (counts.get(origin) || 0) + 1
        );
    }

    const data = [...counts.entries()]
        .map(([id, count]) => ({
            id,
            count,
            name: origins[id] || getOriginName(id)
        }))
        .sort((a, b) => b.count - a.count);

    originsReport.innerHTML = data.map(item => {
        const percentage = Math.round(
            item.count / appointments.length * 100
        );

        return `
            <div class="report-origin-simple-row">
                <div class="report-origin-simple-icon">
                    ${escapeHTML(
                        getOriginIcon(item.id)
                    )}
                </div>

                <div class="report-origin-simple-info">
                    <div>
                        <strong>
                            ${escapeHTML(item.name)}
                        </strong>
                        <span>
                            ${item.count}
                            ${
                                item.count === 1
                                    ? "cita"
                                    : "citas"
                            }
                        </span>
                    </div>

                    <div class="report-simple-progress">
                        <div
                            style="width: ${percentage}%"
                        ></div>
                    </div>
                </div>

                <strong>${percentage}%</strong>
            </div>
        `;
    }).join("");
}

/* =========================================================
   RENDERIZADO GENERAL
========================================================= */

function renderReports() {
    try {
        const appointments =
            getFilteredAppointments();

        const services = getSafeServices();
        const staff = getSafeStaff();

        const activity = buildStaffActivity(
            appointments,
            services,
            staff
        );

        renderPeriod();
        renderSummary(appointments, services);
        renderRevenue(appointments, services);
        renderStatuses(appointments);
        renderServices(appointments, services);
        renderStaffActivity(activity);
        renderStaffPayroll(activity);
        renderOrigins(appointments);
    } catch (error) {
        console.error(
            "VARDEN: Error al generar reportes:",
            error
        );

        if (staffPayrollNote) {
            staffPayrollNote.textContent =
                "No se pudieron calcular todos los reportes. " +
                "Revisa la consola para identificar el error.";
        }
    }
}

/* =========================================================
   EVENTOS
========================================================= */

function configureEvents() {
    document
        .querySelectorAll("[data-period]")
        .forEach(button => {
            button.addEventListener("click", () => {
                selectPeriod(button.dataset.period);
            });
        });

    applyReportDates.addEventListener(
        "click",
        applyCalendarFilter
    );

    [reportStartDate, reportEndDate].forEach(input => {
        input.addEventListener("change", () => {
            showCalendarError("");
        });
    });

    window.addEventListener(
        "agendapro:appointments-changed",
        renderReports
    );

    document.addEventListener(
        "agendapro:staff-changed",
        renderReports
    );

    window.addEventListener("storage", event => {
        if (
            [
                "barbershop_appointments",
                "barbershop_services",
                "barbershop_barbers"
            ].includes(event.key)
        ) {
            renderReports();
        }
    });
}

/* =========================================================
   INICIALIZACIÓN
========================================================= */

function initialize() {
    if (
        !reportSummary ||
        !reportCalendarPanel ||
        !staffPayrollSummary ||
        !staffPayrollList
    ) {
        console.error(
            "VARDEN: Faltan elementos de Reportes en el HTML."
        );
        return;
    }

    configureEvents();

    reportCalendarPanel.hidden = true;

    setActivePeriodButton(currentPeriod);

    renderReports();
}

initialize();


/* =========================================================
   COMISIONES PERSONALIZADAS MULTIPROFESIONALES
========================================================= */

function buildStaffActivityWithCommissions(
    appointments,
    services,
    staff
) {
    const ordinary = [];
    const custom = [];

    for (const appointment of appointments) {
        const distribution =
            appointment?.commissionDistribution;

        if (
            appointment?.status === "completed" &&
            distribution?.valid === true &&
            Array.isArray(distribution.distributions) &&
            distribution.distributions.length
        ) {
            custom.push(appointment);
        } else {
            ordinary.push(appointment);
        }
    }

    const base = buildLegacyStaffActivity(
        ordinary,
        services,
        staff
    );

    const map = new Map(
        base.map(item => [String(item.id), item])
    );

    for (const appointment of custom) {
        const distribution =
            appointment.commissionDistribution;

        const revenue = getAppointmentRevenue(
            appointment,
            services
        );

        const entries = distribution.distributions;
        const totalCommission = entries.reduce(
            (sum, item) =>
                sum + Math.max(0, Number(item.amount) || 0),
            0
        );

        for (const allocation of entries) {
            const id = String(allocation.staffId);
            const person = staff.find(
                item => String(item.id) === id
            );

            const amount = Math.max(
                0,
                Number(allocation.amount) || 0
            );

            const share = totalCommission > 0
                ? amount / totalCommission
                : 1 / entries.length;

            const virtualAppointment = {
                ...appointment,
                barberId: id,
                staffId: id,
                barberIds: [id],
                amountCharged: revenue * share,
                price: revenue * share,
                commissionDistribution: undefined
            };

            const activity = buildLegacyStaffActivity(
                [virtualAppointment],
                services,
                person ? [person] : []
            ).find(item => String(item.id) === id);

            if (!activity) {
                continue;
            }

            activity.commission = amount;
            activity.unconfigured = 0;

            const servicesList = [
                ...activity.services.values()
            ];

            const serviceRevenue = servicesList.reduce(
                (sum, item) => sum + item.revenue,
                0
            );

            for (const item of servicesList) {
                item.commission = serviceRevenue > 0
                    ? amount * item.revenue / serviceRevenue
                    : amount / Math.max(
                        1,
                        servicesList.length
                    );

                item.unconfigured = 0;
            }

            if (!map.has(id)) {
                map.set(id, activity);
                continue;
            }

            const target = map.get(id);

            target.appointments += activity.appointments;
            target.serviceCount += activity.serviceCount;
            target.revenue += activity.revenue;
            target.commission += amount;
            target.estimated += activity.estimated;

            for (const item of activity.services.values()) {
                if (!target.services.has(item.id)) {
                    target.services.set(item.id, {
                        ...item
                    });
                    continue;
                }

                const existing = target.services.get(
                    item.id
                );

                existing.count += item.count;
                existing.revenue += item.revenue;
                existing.commission += item.commission;
            }
        }
    }

    return [...map.values()].sort(
        (a, b) =>
            b.commission - a.commission ||
            b.serviceCount - a.serviceCount ||
            a.name.localeCompare(b.name, "es")
    );
}

function buildStaffActivity(
    appointments,
    services,
    staff
) {
    return buildStaffActivityWithCommissions(
        appointments,
        services,
        staff
    );
}
