
/* =========================================================
   AGENDAPRO — CALENDARIO MENSUAL
   Archivo: js/appointments-calendar.js

   Funcionalidades:
   - Navegación entre meses
   - Selección de días
   - Filtro por profesional
   - Filtro por estado
   - Filtro por fechas
   - Actualización inmediata
   - Sincronización entre pestañas
   - Compatible con localStorage
========================================================= */

import {
    getAppointments
} from "./storage.js";

import {
    getServices,
    getStaff
} from "./catalog.js";

/* =========================================================
   ELEMENTOS
========================================================= */

const $ = id => document.getElementById(id);

const calendar = $("appointmentCalendar");
const monthLabel = $("calendarMonthLabel");

const selectedDateLabel = $("calendarSelectedDateLabel");
const selectedDateCount = $("calendarSelectedDateCount");
const dayAppointments = $("calendarDayAppointments");

const staffFilter = $("calendarStaffFilter");
const statusFilter = $("calendarStatusFilter");
const startDateFilter = $("calendarStartDate");
const endDateFilter = $("calendarEndDate");

/* =========================================================
   ESTADO
========================================================= */

const currentDate = new Date();

let visibleYear = currentDate.getFullYear();
let visibleMonth = currentDate.getMonth();

let selectedDate = toLocalDate(currentDate);

/* =========================================================
   ESTADOS
========================================================= */

const statusNames = {
    pending: "Pendiente",
    confirmed: "Confirmada",
    completed: "Completada",
    cancelled: "Cancelada",
    "no-show": "No asistió"
};

const validStatuses = Object.keys(statusNames);

/* =========================================================
   UTILIDADES
========================================================= */

function toLocalDate(date) {
    const year = date.getFullYear();

    const month = String(
        date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
        date.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function escapeHTML(value) {
    const element = document.createElement("div");

    element.textContent = String(value ?? "");

    return element.innerHTML;
}

function formatTime(time) {
    const [hours, minutes] = String(time || "")
        .split(":")
        .map(Number);

    if (
        !Number.isFinite(hours) ||
        !Number.isFinite(minutes)
    ) {
        return "—";
    }

    const hour = hours % 12 || 12;
    const period = hours >= 12 ? "PM" : "AM";

    return (
        `${hour}:` +
        `${String(minutes).padStart(2, "0")} ` +
        period
    );
}

function formatDate(dateString) {
    const date = new Date(`${dateString}T12:00:00`);

    if (Number.isNaN(date.getTime())) {
        return dateString;
    }

    return new Intl.DateTimeFormat("es-MX", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
    }).format(date);
}

function getStatus(status) {
    return validStatuses.includes(status)
        ? status
        : "pending";
}

/* =========================================================
   FILTROS
========================================================= */

function getFilteredAppointments() {
    const selectedStaff = staffFilter.value;
    const selectedStatus = statusFilter.value;

    const startDate = startDateFilter.value;
    const endDate = endDateFilter.value;

    return getAppointments().filter(appointment => {
        if (
            selectedStaff !== "all" &&
            appointment.barberId !== selectedStaff
        ) {
            return false;
        }

        if (
            selectedStatus !== "all" &&
            appointment.status !== selectedStatus
        ) {
            return false;
        }

        if (
            startDate &&
            appointment.date < startDate
        ) {
            return false;
        }

        if (
            endDate &&
            appointment.date > endDate
        ) {
            return false;
        }

        return true;
    });
}

/* =========================================================
   FILTRO DE PERSONAL
========================================================= */

function populateStaffFilter() {
    const previousValue = staffFilter.value || "all";

    const staff = getStaff();

    staffFilter.replaceChildren(
        new Option("Todo el personal", "all")
    );

    for (const person of staff) {
        staffFilter.add(
            new Option(person.name, person.id)
        );
    }

    if (
        previousValue === "all" ||
        staff.some(person => person.id === previousValue)
    ) {
        staffFilter.value = previousValue;
    }
}

/* =========================================================
   CITAS POR DÍA
========================================================= */

function getAppointmentsForDate(dateString, appointments) {
    return appointments
        .filter(
            appointment => appointment.date === dateString
        )
        .sort(
            (a, b) =>
                String(a.time || "").localeCompare(
                    String(b.time || "")
                )
        );
}

/* =========================================================
   CALENDARIO
========================================================= */

function renderCalendar() {
    const appointments = getFilteredAppointments();

    const firstDay = new Date(
        visibleYear,
        visibleMonth,
        1
    );

    const daysInMonth = new Date(
        visibleYear,
        visibleMonth + 1,
        0
    ).getDate();

    // Semana de lunes a domingo.
    const mondayOffset =
        (firstDay.getDay() + 6) % 7;

    monthLabel.textContent =
        new Intl.DateTimeFormat("es-MX", {
            month: "long",
            year: "numeric"
        }).format(firstDay);

    const cells = [];

    // Espacios antes del primer día del mes.
    for (
        let index = 0;
        index < mondayOffset;
        index++
    ) {
        cells.push(`
            <div
                class="agenda-calendar-empty"
                aria-hidden="true"
            ></div>
        `);
    }

    // Días del mes.
    for (
        let day = 1;
        day <= daysInMonth;
        day++
    ) {
        const date = toLocalDate(
            new Date(
                visibleYear,
                visibleMonth,
                day
            )
        );

        const dailyAppointments =
            getAppointmentsForDate(
                date,
                appointments
            );

        const isToday =
            date === toLocalDate(new Date());

        const isSelected =
            date === selectedDate;

        const previews = dailyAppointments
            .slice(0, 2)
            .map(appointment => {
                const status = getStatus(
                    appointment.status
                );

                return `
                    <span
                        class="
                            agenda-calendar-event
                            ${status}
                        "
                    >
                        ${escapeHTML(
                            formatTime(appointment.time)
                        )}

                        ${escapeHTML(
                            appointment.clientName || "Cliente"
                        )}
                    </span>
                `;
            })
            .join("");

        const remaining =
            dailyAppointments.length - 2;

        cells.push(`
            <button
                type="button"

                class="
                    agenda-calendar-day
                    ${isToday ? "is-today" : ""}
                    ${isSelected ? "is-selected" : ""}
                "

                data-date="${date}"

                aria-pressed="${isSelected}"

                aria-label="${escapeHTML(
                    `${day}, ${dailyAppointments.length} citas`
                )}"
            >

                <span class="agenda-calendar-day-number">
                    ${day}
                </span>

                <span class="agenda-calendar-events">

                    ${previews}

                    ${
                        remaining > 0
                            ? `
                                <span class="agenda-calendar-more">
                                    +${remaining} más
                                </span>
                            `
                            : ""
                    }

                </span>

            </button>
        `);
    }

    calendar.innerHTML = cells.join("");

    renderSelectedDay(appointments);
}

/* =========================================================
   DETALLE DEL DÍA
========================================================= */

function renderSelectedDay(
    appointments = getFilteredAppointments()
) {
    const dailyAppointments =
        getAppointmentsForDate(
            selectedDate,
            appointments
        );

    selectedDateLabel.textContent =
        formatDate(selectedDate);

    selectedDateCount.textContent =
        `${dailyAppointments.length} ` +
        (
            dailyAppointments.length === 1
                ? "cita"
                : "citas"
        );

    if (!dailyAppointments.length) {
        dayAppointments.innerHTML = `
            <div class="agenda-calendar-no-appointments">
                No hay citas para este día
                con los filtros seleccionados.
            </div>
        `;

        return;
    }

    const services = getServices();
    const staff = getStaff();

    dayAppointments.innerHTML =
        dailyAppointments
            .map(appointment => {
                const service = services.find(
                    item =>
                        item.id === appointment.serviceId
                );

                const professional = staff.find(
                    item =>
                        item.id === appointment.barberId
                );

                const status = getStatus(
                    appointment.status
                );

                return `
                    <article
                        class="agenda-calendar-appointment"
                    >

                        <div
                            class="agenda-calendar-appointment-time"
                        >
                            ${escapeHTML(
                                formatTime(appointment.time)
                            )}
                        </div>

                        <div
                            class="agenda-calendar-appointment-info"
                        >

                            <strong>
                                ${escapeHTML(
                                    appointment.clientName || "Cliente"
                                )}
                            </strong>

                            <span>
                                ${escapeHTML(
                                    service?.name || "Servicio"
                                )}

                                ·

                                ${escapeHTML(
                                    professional?.name || "Profesional"
                                )}
                            </span>

                        </div>

                        <span class="status ${status}">
                            ${statusNames[status]}
                        </span>

                    </article>
                `;
            })
            .join("");
}

/* =========================================================
   NAVEGACIÓN
========================================================= */

function changeMonth(offset) {
    const nextMonth = new Date(
        visibleYear,
        visibleMonth + offset,
        1
    );

    visibleYear = nextMonth.getFullYear();
    visibleMonth = nextMonth.getMonth();

    selectedDate = toLocalDate(nextMonth);

    renderCalendar();
}

function goToToday() {
    const today = new Date();

    visibleYear = today.getFullYear();
    visibleMonth = today.getMonth();

    selectedDate = toLocalDate(today);

    renderCalendar();
}

function clearFilters() {
    staffFilter.value = "all";
    statusFilter.value = "all";

    startDateFilter.value = "";
    endDateFilter.value = "";

    renderCalendar();
}

/* =========================================================
   SINCRONIZACIÓN
========================================================= */

function refreshCalendar() {
    populateStaffFilter();
    renderCalendar();
}

/* =========================================================
   EVENTOS
========================================================= */

function configureEvents() {
    $("calendarPreviousMonth").addEventListener(
        "click",
        () => changeMonth(-1)
    );

    $("calendarNextMonth").addEventListener(
        "click",
        () => changeMonth(1)
    );

    $("calendarTodayButton").addEventListener(
        "click",
        goToToday
    );

    $("calendarClearFilters").addEventListener(
        "click",
        clearFilters
    );

    for (const filter of [
        staffFilter,
        statusFilter,
        startDateFilter,
        endDateFilter
    ]) {
        filter.addEventListener(
            "change",
            renderCalendar
        );
    }

    calendar.addEventListener(
        "click",
        event => {
            const day = event.target.closest(
                "[data-date]"
            );

            if (!day) return;

            selectedDate = day.dataset.date;

            renderCalendar();
        }
    );

    // Actualización dentro de la misma pestaña.
    window.addEventListener(
        "agendapro:appointments-changed",
        refreshCalendar
    );

    // Actualización desde otras pestañas del navegador.
    window.addEventListener(
        "storage",
        event => {
            if (
                [
                    "barbershop_appointments",
                    "barbershop_services",
                    "barbershop_barbers"
                ].includes(event.key)
            ) {
                refreshCalendar();
            }
        }
    );
}

/* =========================================================
   INICIALIZACIÓN
========================================================= */

function initialize() {
    if (!calendar) return;

    populateStaffFilter();
    configureEvents();
    renderCalendar();
}

initialize();
