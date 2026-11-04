
import {
    createCommissionPicker
} from "./commissions.js";


import { origins, getLocalDate } from "./data.js";

import {
    getAppointments,
    saveAppointments,
    getCustomers,
    findCustomerByPhone,
    getOrCreateCustomer,
    generateId
} from "./storage.js";

import {
    getServices,
    getStaff,
    getActiveStaff,
    getAvailableTimes,
    isAppointmentAvailable,
    getAppointmentStaffIds
} from "./catalog.js";

import {
    createMultiServicePicker
} from "./multi-service.js";

/* =========================================================
   MAYVANNA BEAUTY STUDIO
   DASHBOARD + AGENDAMIENTO MULTIPROFESIONAL
========================================================= */

const $ = id => document.getElementById(id);

let selectedTime = "";
let selectedProfessionalIds = [];
let toastTimer = null;
let saving = false;
let activeStartDate = "";
let activeEndDate = "";

const modal = $("appointmentModal");
const phoneInput = $("appointmentPhone");
const nameInput = $("appointmentName");
const serviceSelect = $("appointmentService");
const barberSelect = $("appointmentBarber");
const dateInput = $("appointmentDate");
const originSelect = $("appointmentOrigin");
const statusSelect = $("appointmentStatus");
const notesInput = $("appointmentNotes");
const timeContainer = $("appointmentTimes");
const customerDetection = $("customerDetection");
const saveButton = $("saveAppointmentButton");

let picker;
let commissionPicker;

let professionalPickerContainer = null;

/* =========================================================
   UTILIDADES
========================================================= */

function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML;
}

function formatMoney(value) {
    return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN"
    }).format(Number(value) || 0);
}

function formatTime(time) {
    if (!time) return "—";

    const [hours, minutes] = String(time)
        .split(":")
        .map(Number);

    if (
        !Number.isFinite(hours) ||
        !Number.isFinite(minutes)
    ) {
        return String(time);
    }

    return (
        `${hours % 12 || 12}:` +
        `${String(minutes).padStart(2, "0")} ` +
        `${hours >= 12 ? "PM" : "AM"}`
    );
}

function formatDate(dateString) {
    if (!dateString) return "—";

    const date = new Date(
        `${dateString}T12:00:00`
    );

    if (Number.isNaN(date.getTime())) {
        return String(dateString);
    }

    return new Intl.DateTimeFormat("es-MX", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    }).format(date);
}

function getService(id) {
    return getServices().find(
        service => String(service.id) === String(id)
    ) || null;
}

function getProfessional(id) {
    return getStaff().find(
        person => String(person.id) === String(id)
    ) || null;
}

function getServiceNames(appointment) {
    const ids = Array.isArray(appointment.serviceIds) &&
        appointment.serviceIds.length
            ? appointment.serviceIds
            : appointment.serviceId
                ? [appointment.serviceId]
                : [];

    if (!ids.length) {
        return appointment.serviceName ||
            "Servicio no disponible";
    }

    return ids.map(id =>
        getService(id)?.name ||
        (
            ids.length === 1
                ? appointment.serviceName
                : null
        ) ||
        "Servicio no disponible"
    ).join(" + ");
}

function getProfessionalNames(appointment) {
    const ids = getAppointmentStaffIds(appointment);

    if (!ids.length) {
        return appointment.professionalName ||
            "Sin profesional";
    }

    return ids.map(id =>
        getProfessional(id)?.name ||
        (
            ids.length === 1
                ? appointment.professionalName
                : null
        ) ||
        "Profesional no disponible"
    ).join(" + ");
}

function getRevenue(appointment) {
    const amount =
        appointment.amountCharged ??
        appointment.price ??
        getService(appointment.serviceId)?.price ??
        0;

    return Number(amount) || 0;
}

function showToast(message) {
    const toast = $("toast");

    if (!toast) {
        console.info(message);
        return;
    }

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2800);
}

function statCard(label, value, url) {
    return `
        <a
            href="${escapeHTML(url)}"
            class="stat-card"
            style="
                text-decoration:none;
                color:inherit;
                cursor:pointer;
            "
        >
            <span>${escapeHTML(label)}</span>
            <strong>${escapeHTML(value)}</strong>
        </a>
    `;
}

function renderStatus(status) {
    const labels = {
        pending: "Pendiente",
        confirmed: "Confirmada",
        completed: "Completada",
        cancelled: "Cancelada",
        "no-show": "No asistió"
    };

    const valid = Object.hasOwn(labels, status)
        ? status
        : "pending";

    return `
        <span class="status ${valid}">
            ${labels[valid]}
        </span>
    `;
}

/* =========================================================
   SELECTOR DE MÚLTIPLES PROFESIONALES
========================================================= */

function loadMayvannaStyles() {
    if (
        document.querySelector(
            'link[data-mayvanna-professional-styles]'
        )
    ) {
        return;
    }

    const link = document.createElement("link");

    link.rel = "stylesheet";
    link.href =
        "css/mayvanna-multi-professional.css?v=1";

    link.dataset.mayvannaProfessionalStyles = "true";

    document.head.appendChild(link);
}

function getSelectedProfessionalIds() {
    return [...selectedProfessionalIds];
}

function syncPrimaryProfessional() {
    barberSelect.value =
        selectedProfessionalIds[0] || "";
}

function createProfessionalPicker() {
    if (professionalPickerContainer) {
        return;
    }

    loadMayvannaStyles();

    professionalPickerContainer =
        document.createElement("div");

    professionalPickerContainer.id =
        "mayvannaProfessionalPicker";

    professionalPickerContainer.innerHTML = `
        <div class="mayvanna-professional-heading">
            <strong>Profesionales asignados</strong>
            <span>Puedes seleccionar más de uno</span>
        </div>

        <div
            class="mayvanna-professional-options"
            id="mayvannaProfessionalOptions"
        ></div>

        <p class="mayvanna-professional-help">
            El servicio se cobra una sola vez,
            aunque participen varias personas.
        </p>
    `;

    barberSelect.insertAdjacentElement(
        "afterend",
        professionalPickerContainer
    );

    commissionPicker = createCommissionPicker({
        anchor: professionalPickerContainer,
        getPrice: () => picker?.getValues()?.price ?? 0
    });

    barberSelect.style.display = "none";

    const originalLabel = document.querySelector(
        `label[for="${barberSelect.id}"]`
    );

    if (originalLabel) {
        originalLabel.style.display = "none";
    }

    professionalPickerContainer.addEventListener(
        "change",
        event => {
            const checkbox = event.target.closest(
                'input[type="checkbox"]'
            );

            if (!checkbox) {
                return;
            }

            const id = String(checkbox.value);

            if (checkbox.checked) {
                selectedProfessionalIds = [
                    ...new Set([
                        ...selectedProfessionalIds,
                        id
                    ])
                ];
            } else {
                selectedProfessionalIds =
                    selectedProfessionalIds.filter(
                        value => value !== id
                    );
            }

            syncPrimaryProfessional();

            commissionPicker?.setProfessionals(
                selectedProfessionalIds
                    .map(id => getProfessional(id))
                    .filter(Boolean)
            );

            selectedTime = "";
            renderTimes();
        }
    );
}

function populateStaffSelector(preferredIds = null) {
    createProfessionalPicker();

    const ids = picker.getValues().serviceIds;

    const staff = ids.length
        ? getActiveStaff(ids)
        : [];

    const validIds = new Set(
        staff.map(person => String(person.id))
    );

    if (preferredIds !== null) {
        selectedProfessionalIds = (
            Array.isArray(preferredIds)
                ? preferredIds
                : [preferredIds]
        ).map(String);
    }

    selectedProfessionalIds = [
        ...new Set(selectedProfessionalIds)
    ].filter(id => validIds.has(id));

    barberSelect.replaceChildren();

    barberSelect.add(
        new Option("Seleccionar personal", "")
    );

    for (const person of staff) {
        barberSelect.add(
            new Option(person.name, person.id)
        );
    }

    syncPrimaryProfessional();

    commissionPicker?.setProfessionals(
        selectedProfessionalIds
            .map(id => getProfessional(id))
            .filter(Boolean)
    );

    const container = $("mayvannaProfessionalOptions");

    container.replaceChildren();

    if (!staff.length) {
        const empty = document.createElement("p");

        empty.className = "mayvanna-professional-empty";

        empty.textContent =
            "No hay profesionales activos para estos servicios.";

        container.appendChild(empty);
        return;
    }

    for (const person of staff) {
        const id = String(person.id);

        const label = document.createElement("label");
        label.className = "mayvanna-professional-option";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = id;

        checkbox.checked =
            selectedProfessionalIds.includes(id);

        const initials = document.createElement("span");

        initials.className =
            "mayvanna-professional-initials";

        initials.textContent = String(person.name || "P")
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(word => word.charAt(0))
            .join("")
            .toUpperCase();

        const name = document.createElement("span");

        name.className = "mayvanna-professional-name";
        name.textContent = person.name;

        label.append(
            checkbox,
            initials,
            name
        );

        container.appendChild(label);
    }
}

/* =========================================================
   FILTRO DE FECHAS
========================================================= */

function hasDateFilter() {
    return Boolean(activeStartDate && activeEndDate);
}

function inPeriod(date) {
    return !hasDateFilter() || (
        date >= activeStartDate &&
        date <= activeEndDate
    );
}

function destination(page, parameters = {}) {
    const url = new URL(page, location.href);

    for (const [key, value] of Object.entries(parameters)) {
        url.searchParams.set(key, value);
    }

    if (hasDateFilter()) {
        url.searchParams.set("start", activeStartDate);
        url.searchParams.set("end", activeEndDate);
    }

    return url.pathname.split("/").pop() + url.search;
}

function setCalendarOpen(open) {
    $("dashboardCalendarPanel")?.classList.toggle(
        "hidden",
        !open
    );

    $("dashboardToggleCalendar")?.setAttribute(
        "aria-expanded",
        String(open)
    );
}

function setDateError(message) {
    const element = $("dashboardDateError");

    if (!element) return;

    element.textContent = message;
    element.classList.toggle("hidden", !message);
}

function updatePeriodLabel() {
    const label = $("dashboardPeriodLabel");

    if (!label) return;

    label.textContent = hasDateFilter()
        ? `Del ${formatDate(activeStartDate)} al ${formatDate(activeEndDate)}`
        : "Mostrando estadísticas generales";
}

function configureDateFilter() {
    $("dashboardToggleCalendar")?.addEventListener(
        "click",
        () => {
            const panel = $("dashboardCalendarPanel");

            if (!panel) return;

            setCalendarOpen(
                panel.classList.contains("hidden")
            );
        }
    );

    $("dashboardApplyDates")?.addEventListener(
        "click",
        () => {
            const start = $("dashboardStartDate").value;
            const end = $("dashboardEndDate").value;

            if (!start || !end) {
                setDateError(
                    "Selecciona las dos fechas."
                );
                return;
            }

            if (start > end) {
                setDateError(
                    "La fecha inicial no puede ser posterior a la final."
                );
                return;
            }

            activeStartDate = start;
            activeEndDate = end;

            setDateError("");
            updatePeriodLabel();
            renderDashboard();
            setCalendarOpen(false);
        }
    );

    $("dashboardResetDates")?.addEventListener(
        "click",
        () => {
            activeStartDate = "";
            activeEndDate = "";

            $("dashboardStartDate").value = "";
            $("dashboardEndDate").value = "";

            setDateError("");
            updatePeriodLabel();
            renderDashboard();
            setCalendarOpen(false);
        }
    );

    updatePeriodLabel();
}

/* =========================================================
   DASHBOARD
========================================================= */

function renderDashboard() {
    const appointments = getAppointments();
    const customers = getCustomers();
    const today = getLocalDate();

    const period = appointments.filter(
        appointment => inPeriod(appointment.date)
    );

    const valid = period.filter(
        appointment =>
            !["cancelled", "no-show"].includes(
                appointment.status
            )
    );

    const todayAppointments = valid.filter(
        appointment => appointment.date === today
    );

    const completed = period.filter(
        appointment => appointment.status === "completed"
    );

    const revenue = completed.reduce(
        (total, appointment) =>
            total + getRevenue(appointment),
        0
    );

    const customerKeys = new Set();

    for (const appointment of period) {
        const phone = String(
            appointment.phone || ""
        ).replace(/\D/g, "");

        const key = phone ||
            String(appointment.customerId || "") ||
            String(appointment.clientName || "");

        if (key) {
            customerKeys.add(key);
        }
    }

    const customerCount = hasDateFilter()
        ? customerKeys.size
        : customers.length;

    const stats = $("dashboardStats");

    if (stats) {
        stats.innerHTML = [
            statCard(
                hasDateFilter()
                    ? "Citas del período"
                    : "Citas de hoy",

                hasDateFilter()
                    ? valid.length
                    : todayAppointments.length,

                destination("citas.html")
            ),

            statCard(
                "Clientes",
                customerCount,
                destination("clientes.html")
            ),

            statCard(
                "Completadas",
                completed.length,
                destination("citas.html", {
                    filter: "completed"
                })
            ),

            statCard(
                "Ingresos registrados",
                formatMoney(revenue),
                destination("reportes.html")
            )
        ].join("");
    }

    renderUpcomingAppointments(appointments);
}

/* =========================================================
   PRÓXIMAS CITAS
========================================================= */

function renderUpcomingAppointments(appointments) {
    const container = $("dashboardAppointments");

    if (!container) {
        return;
    }

    const today = getLocalDate();

    const visible = appointments
        .filter(appointment =>
            appointment.date &&
            appointment.date >= today
        )
        .sort((a, b) =>
            `${a.date} ${a.time || ""}`.localeCompare(
                `${b.date} ${b.time || ""}`
            )
        )
        .slice(0, 7);

    if (!visible.length) {
        container.innerHTML = `
            <div class="empty">
                No hay citas registradas para hoy
                ni para los próximos días.
            </div>
        `;
        return;
    }

    container.innerHTML = visible.map(appointment => {
        const origin =
            origins[appointment.origin] ||
            appointment.origin ||
            "Otro";

        return `
            <div class="dashboard-appointment">

                <div class="appointment-time">
                    ${escapeHTML(
                        formatTime(appointment.time)
                    )}
                </div>

                <div class="appointment-client">
                    <strong>
                        ${escapeHTML(
                            appointment.clientName || "Cliente"
                        )}
                    </strong>

                    <span>
                        ${escapeHTML(
                            getServiceNames(appointment)
                        )}
                        ·
                        ${escapeHTML(
                            formatDate(appointment.date)
                        )}
                        ·
                        ${escapeHTML(origin)}
                    </span>
                </div>

                <div class="appointment-barber">
                    ${escapeHTML(
                        getProfessionalNames(appointment)
                    )}
                </div>

                <div class="appointment-status">
                    ${renderStatus(appointment.status)}
                </div>

            </div>
        `;
    }).join("");
}

/* =========================================================
   MODAL
========================================================= */

function resetForm() {
    phoneInput.value = "";
    nameInput.value = "";
    notesInput.value = "";

    customerDetection.innerHTML = "";

    originSelect.value = "whatsapp";
    statusSelect.value = "confirmed";

    dateInput.min = getLocalDate();
    dateInput.value = getLocalDate();

    selectedTime = "";
    selectedProfessionalIds = [];

    picker.reset();
    commissionPicker?.reset();
    populateStaffSelector([]);
    renderTimes();
}

function openModal() {
    resetForm();

    modal.classList.remove("hidden");
    document.body.classList.add("modal-open");

    setTimeout(() => {
        phoneInput.focus();
    }, 50);
}

function closeModal() {
    modal.classList.add("hidden");
    document.body.classList.remove("modal-open");
}

/* =========================================================
   CLIENTES
========================================================= */

function detectCustomer() {
    const phone = phoneInput.value.trim();
    const digits = phone.replace(/\D/g, "");

    if (digits.length < 7) {
        customerDetection.innerHTML = "";
        return;
    }

    const customer = findCustomerByPhone(phone);

    if (customer) {
        nameInput.value = customer.name || "";

        customerDetection.innerHTML = `
            <div class="customer-found">
                ✓ Cliente encontrado:
                <strong>${escapeHTML(customer.name)}</strong>
            </div>
        `;
    } else {
        customerDetection.innerHTML = `
            <div class="customer-new">
                Cliente nuevo. Se registrará al guardar.
            </div>
        `;
    }
}

/* =========================================================
   HORARIOS PARA TODOS LOS PROFESIONALES
========================================================= */

function renderTimes() {
    commissionPicker?.refresh();
    const values = picker.getValues();

    const professionalIds =
        getSelectedProfessionalIds();

    if (
        !dateInput.value ||
        !values.serviceIds.length ||
        !professionalIds.length
    ) {
        selectedTime = "";

        timeContainer.innerHTML = `
            <div class="empty" style="grid-column:1/-1">
                Selecciona servicios, profesionales y fecha.
            </div>
        `;
        return;
    }

    const times = getAvailableTimes({
        date: dateInput.value,
        serviceIds: values.serviceIds,
        staffIds: professionalIds,
        duration: values.duration
    });

    if (!times.includes(selectedTime)) {
        selectedTime = times[0] || "";
    }

    if (!times.length) {
        timeContainer.innerHTML = `
            <div class="empty" style="grid-column:1/-1">
                No hay horarios disponibles para
                todos los profesionales seleccionados.
            </div>
        `;
        return;
    }

    timeContainer.innerHTML = times.map(time => `
        <button
            type="button"
            class="time-button ${
                selectedTime === time ? "selected" : ""
            }"
            data-time="${time}"
            aria-pressed="${selectedTime === time}"
        >
            ${formatTime(time)}
        </button>
    `).join("");
}

/* =========================================================
   VALIDACIÓN
========================================================= */

function validateAppointment() {
    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    const digits = phone.replace(/\D/g, "");
    const values = picker.getValues();

    const professionalIds =
        getSelectedProfessionalIds();

    if (!name) {
        showToast("Ingresa el nombre del cliente.");
        nameInput.focus();
        return false;
    }

    if (digits.length < 7 || digits.length > 15) {
        showToast("Ingresa un teléfono válido.");
        phoneInput.focus();
        return false;
    }

    if (!values.serviceIds.length) {
        showToast("Selecciona al menos un servicio.");
        return false;
    }

    if (
        !Number.isFinite(values.duration) ||
        values.duration <= 0
    ) {
        showToast(
            "La duración de los servicios no es válida."
        );
        return false;
    }

    if (
        !Number.isFinite(values.price) ||
        values.price < 0
    ) {
        showToast("Ingresa un precio válido.");
        return false;
    }

    if (!professionalIds.length) {
        showToast(
            "Selecciona al menos un profesional."
        );
        return false;
    }

    if (!dateInput.value || !selectedTime) {
        showToast("Selecciona fecha y horario.");
        return false;
    }

    const available = isAppointmentAvailable({
        date: dateInput.value,
        time: selectedTime,
        serviceIds: values.serviceIds,
        serviceId: values.serviceId,
        barberIds: professionalIds,
        duration: values.duration
    });

    if (!available) {
        showToast(
            "El horario no está disponible para " +
            "todos los profesionales seleccionados."
        );

        selectedTime = "";
        renderTimes();
        return false;
    }

    const commission = commissionPicker.getValues();

    if (!commission.valid) {
        showToast(commission.message);
        return false;
    }

    return true;
}

/* =========================================================
   GUARDAR CITA MULTIPROFESIONAL
========================================================= */

function saveAppointment() {
    if (saving || !validateAppointment()) {
        return;
    }

    saving = true;
    saveButton.disabled = true;

    try {
        const values = picker.getValues();
        const services = picker.getSelectedServices();

        const professionalIds =
            getSelectedProfessionalIds();

        const professionals = professionalIds.map(
            id => getProfessional(id)
        );

        if (
            !professionals.length ||
            professionals.some(person => !person)
        ) {
            throw new Error(
                "Uno o más profesionales seleccionados no existen."
            );
        }

        if (!isAppointmentAvailable({
            date: dateInput.value,
            time: selectedTime,
            serviceIds: values.serviceIds,
            serviceId: values.serviceId,
            barberIds: professionalIds,
            duration: values.duration
        })) {
            throw new Error(
                "El horario acaba de quedar ocupado."
            );
        }

        const customer = getOrCreateCustomer(
            nameInput.value.trim(),
            phoneInput.value.trim()
        );

        const appointments = getAppointments();
        const now = new Date().toISOString();

        appointments.push({
            id: generateId("appointment"),

            date: dateInput.value,
            time: selectedTime,

            clientName: nameInput.value.trim(),
            phone: phoneInput.value.trim(),
            customerId: customer.id,

            serviceId: values.serviceId,
            serviceIds: values.serviceIds,

            serviceName: services
                .map(service => service.name)
                .join(" + "),

            barberId: professionalIds[0],
            barberIds: professionalIds,

            professionalName: professionals
                .map(person => person.name)
                .join(" + "),

            duration: values.duration,

            originalPrice: values.originalPrice,
            price: values.price,
            customPrice: values.customPrice,

            commissionDistribution:
                commissionPicker.getValues(),

            origin: originSelect.value,
            status: statusSelect.value,
            notes: notesInput.value.trim(),

            loyaltyApplied: false,

            createdAt: now,
            updatedAt: now
        });

        saveAppointments(appointments);

        closeModal();
        renderDashboard();

        showToast("Cita registrada correctamente.");
    } catch (error) {
        console.error(
            "Error al guardar cita:",
            error
        );

        showToast(
            error.message ||
            "No se pudo guardar la cita."
        );
    } finally {
        saving = false;
        saveButton.disabled = false;
    }
}

/* =========================================================
   EVENTOS
========================================================= */

function configureEvents() {
    $("newAppointmentButton")?.addEventListener(
        "click",
        openModal
    );

    $("quickNewAppointment")?.addEventListener(
        "click",
        openModal
    );

    $("closeModalButton")?.addEventListener(
        "click",
        closeModal
    );

    $("cancelModalButton")?.addEventListener(
        "click",
        closeModal
    );

    saveButton.addEventListener(
        "click",
        saveAppointment
    );

    $("qrButton")?.addEventListener(
        "click",
        () => showToast(
            "El escáner QR estará disponible próximamente."
        )
    );

    phoneInput.addEventListener(
        "input",
        detectCustomer
    );

    dateInput.addEventListener(
        "change",
        () => {
            selectedTime = "";
            renderTimes();
        }
    );

    timeContainer.addEventListener(
        "click",
        event => {
            const button = event.target.closest(
                "[data-time]"
            );

            if (!button) {
                return;
            }

            selectedTime = button.dataset.time;
            renderTimes();
        }
    );

    modal.addEventListener(
        "click",
        event => {
            if (event.target === modal) {
                closeModal();
            }
        }
    );

    document.addEventListener(
        "keydown",
        event => {
            if (
                event.key === "Escape" &&
                !modal.classList.contains("hidden")
            ) {
                closeModal();
            }
        }
    );

    window.addEventListener(
        "storage",
        event => {
            if (
                [
                    "barbershop_appointments",
                    "barbershop_services",
                    "barbershop_barbers",
                    "barbershop_customers"
                ].includes(event.key)
            ) {
                if (
                    [
                        "barbershop_services",
                        "barbershop_barbers"
                    ].includes(event.key)
                ) {
                    picker.refresh();
                    populateStaffSelector();
                    renderTimes();
                }

                renderDashboard();
            }
        }
    );
}

/* =========================================================
   INICIALIZACIÓN
========================================================= */

function initialize() {
    picker = createMultiServicePicker({
        serviceSelect,

        onChange: () => {
            if (!picker) {
                return;
            }

            populateStaffSelector();

            selectedTime = "";
            renderTimes();
        }
    });

    createProfessionalPicker();
    populateStaffSelector();
    renderTimes();

    configureEvents();
    configureDateFilter();
    renderDashboard();
}

initialize();
