
import { services as defaultServices } from "./data.js";

import {
    getAppointments,
    generateId
} from "./storage.js";

/* =========================================================
   CONFIGURACIÓN
========================================================= */

const STORAGE_KEY = "barbershop_services";
const STAFF_KEY = "barbershop_barbers";

let editingServiceId = null;
let toastTimer = null;

/* =========================================================
   ELEMENTOS
========================================================= */

const servicesGrid =
    document.getElementById("servicesGrid");

const serviceSummary =
    document.getElementById("serviceSummary");

const serviceModal =
    document.getElementById("serviceModal");

const serviceModalTitle =
    document.getElementById("serviceModalTitle");

const serviceName =
    document.getElementById("serviceName");

const servicePrice =
    document.getElementById("servicePrice");

const serviceDuration =
    document.getElementById("serviceDuration");

const serviceActiveSwitch =
    document.getElementById("serviceActiveSwitch");

const newServiceButton =
    document.getElementById("newServiceButton");

const closeServiceModalButton =
    document.getElementById("closeServiceModal");

const cancelServiceButton =
    document.getElementById("cancelServiceButton");

const saveServiceButton =
    document.getElementById("saveServiceButton");

/* =========================================================
   INICIO
========================================================= */

function initialize() {
    seedServices();
    configureEvents();
    renderAll();
}

/* =========================================================
   ALMACENAMIENTO
========================================================= */

function getServices() {
    try {
        const stored = JSON.parse(
            localStorage.getItem(STORAGE_KEY)
        );

        return Array.isArray(stored)
            ? stored
            : [];
    } catch {
        return [];
    }
}

function saveServices(services) {
    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(services)
    );

    document.dispatchEvent(
        new CustomEvent("agendapro:services-changed")
    );
}

function getStoredStaff() {
    try {
        const stored = JSON.parse(
            localStorage.getItem(STAFF_KEY)
        );

        return Array.isArray(stored)
            ? stored
            : [];
    } catch {
        return [];
    }
}

function saveStoredStaff(staff) {
    localStorage.setItem(
        STAFF_KEY,
        JSON.stringify(staff)
    );

    document.dispatchEvent(
        new CustomEvent("agendapro:staff-changed")
    );
}

/* =========================================================
   SERVICIOS INICIALES
========================================================= */

function seedServices() {
    if (localStorage.getItem(STORAGE_KEY) !== null) {
        return;
    }

    const initialServices = defaultServices.map(service => ({
        ...service,
        status: "active",
        createdAt: new Date().toISOString()
    }));

    saveServices(initialServices);
}

/* =========================================================
   EVENTOS
========================================================= */

function configureEvents() {
    newServiceButton.addEventListener(
        "click",
        openNewService
    );

    closeServiceModalButton.addEventListener(
        "click",
        closeModal
    );

    cancelServiceButton.addEventListener(
        "click",
        closeModal
    );

    saveServiceButton.addEventListener(
        "click",
        saveService
    );

    servicesGrid.addEventListener(
        "click",
        handleServiceAction
    );

    serviceName.addEventListener(
        "input",
        updateModalTitle
    );

    serviceModal.addEventListener(
        "click",
        event => {
            if (event.target === serviceModal) {
                closeModal();
            }
        }
    );

    document.addEventListener(
        "keydown",
        event => {
            if (
                event.key === "Escape" &&
                !serviceModal.classList.contains("hidden")
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
                event.key === "barbershop_appointments"
            ) {
                renderAll();
            }
        }
    );
}

/* =========================================================
   ACTUALIZAR VISTA
========================================================= */

function renderAll() {
    renderSummary();
    renderServices();
}

/* =========================================================
   RESUMEN
========================================================= */

function renderSummary() {
    const services = getServices();
    const appointments = getAppointments();

    const activeServices = services.filter(
        service => service.status === "active"
    );

    const completedAppointments = appointments.filter(
        appointment => appointment.status === "completed"
    );

    const revenue = completedAppointments.reduce(
        (total, appointment) => {
            const service = services.find(
                item =>
                    String(item.id) ===
                    String(appointment.serviceId)
            );

            const price = Number(
                appointment.servicePrice ??
                appointment.price ??
                service?.price ??
                0
            );

            return total + (
                Number.isFinite(price) ? price : 0
            );
        },
        0
    );

    serviceSummary.innerHTML = `
        <div class="module-summary-item">
            <strong>${services.length}</strong>
            <span>Servicios</span>
        </div>

        <div class="module-summary-divider"></div>

        <div class="module-summary-item">
            <strong>${activeServices.length}</strong>
            <span>Activos</span>
        </div>

        <div class="module-summary-divider"></div>

        <div class="module-summary-item">
            <strong>${completedAppointments.length}</strong>
            <span>Realizados</span>
        </div>

        <div class="module-summary-divider"></div>

        <div class="module-summary-item">
            <strong>${formatMoney(revenue)}</strong>
            <span>Ingresos</span>
        </div>
    `;
}

/* =========================================================
   LISTADO DE SERVICIOS
========================================================= */

function renderServices() {
    const services = getServices();
    const appointments = getAppointments();

    if (!services.length) {
        servicesGrid.innerHTML = `
            <div class="module-empty-state">

                <div class="module-empty-icon">+</div>

                <strong>
                    No hay servicios registrados
                </strong>

                <p>
                    Agrega tu primer servicio para
                    comenzar a recibir citas.
                </p>

                <button
                    type="button"
                    class="btn btn-dark"
                    data-action="new"
                >
                    + Nuevo servicio
                </button>

            </div>
        `;

        return;
    }

    servicesGrid.innerHTML = services.map(service => {
        const completed = appointments.filter(
            appointment =>
                String(appointment.serviceId) ===
                    String(service.id) &&
                appointment.status === "completed"
        );

        const revenue = completed.reduce(
            (total, appointment) => {
                const price = Number(
                    appointment.servicePrice ??
                    appointment.price ??
                    service.price ??
                    0
                );

                return total + (
                    Number.isFinite(price) ? price : 0
                );
            },
            0
        );

        return createServiceCard(
            service,
            completed.length,
            revenue
        );
    }).join("");
}

/* =========================================================
   TARJETA DE SERVICIO
========================================================= */

function createServiceCard(
    service,
    completedCount,
    revenue
) {
    const isActive = service.status === "active";

    return `
        <article
            class="
                unified-card
                ${isActive ? "" : "is-inactive"}
            "
        >

            <div class="unified-card-header">

                <div class="unified-card-person">

                    <div class="unified-card-avatar">
                        ✂
                    </div>

                    <div class="unified-card-title">

                        <h3>
                            ${escapeHTML(service.name)}
                        </h3>

                        <span>Servicio</span>

                    </div>

                </div>

                <div
                    class="
                        unified-status
                        ${isActive ? "active" : "inactive"}
                    "
                >
                    <span></span>
                    ${isActive ? "Activo" : "Inactivo"}
                </div>

            </div>

            <div class="unified-card-metrics">

                <div>

                    <span>Precio</span>

                    <strong>
                        ${formatMoney(service.price)}
                    </strong>

                </div>

                <div>

                    <span>Duración</span>

                    <strong>
                        ${Number(service.duration) || 0} min
                    </strong>

                </div>

            </div>

            <div class="unified-card-detail">

                <span>Actividad</span>

                <strong>
                    ${completedCount}
                    ${
                        completedCount === 1
                            ? "servicio realizado"
                            : "servicios realizados"
                    }
                </strong>

                <small>
                    ${formatMoney(revenue)} generados
                </small>

            </div>

            <div class="unified-card-footer">

                <span>
                    ${
                        isActive
                            ? "Disponible para citas"
                            : "No disponible para citas"
                    }
                </span>

                <div class="modern-card-actions">

                    <button
                        type="button"
                        class="modern-delete-button"
                        data-action="delete"
                        data-id="${escapeHTML(service.id)}"
                    >
                        Eliminar
                    </button>

                    <button
                        type="button"
                        class="modern-edit-button"
                        data-action="edit"
                        data-id="${escapeHTML(service.id)}"
                    >
                        Editar
                        <span>→</span>
                    </button>

                </div>

            </div>

        </article>
    `;
}

/* =========================================================
   ACCIONES
========================================================= */

function handleServiceAction(event) {
    const button = event.target.closest("[data-action]");

    if (!button || !servicesGrid.contains(button)) {
        return;
    }

    const action = button.dataset.action;
    const id = button.dataset.id;

    if (action === "new") {
        openNewService();
        return;
    }

    if (action === "edit") {
        openEditService(id);
        return;
    }

    if (action === "delete") {
        deleteService(id);
    }
}

/* =========================================================
   ELIMINAR SERVICIO
========================================================= */

function deleteService(serviceId) {
    const services = getServices();

    const service = services.find(
        item => String(item.id) === String(serviceId)
    );

    if (!service) {
        showToast("No se encontró el servicio.");
        return;
    }

    const appointments = getAppointments();

    const futureAppointments = appointments.filter(
        appointment =>
            String(appointment.serviceId) ===
                String(serviceId) &&
            appointment.date >= getLocalDate() &&
            !["cancelled", "no-show", "completed"].includes(
                appointment.status
            )
    );

    let message =
        `¿Eliminar el servicio "${service.name}"?\n\n` +
        "Su tarjeta desaparecerá y no estará " +
        "disponible para nuevas citas.\n\n" +
        "También se quitará de los servicios " +
        "asignados al personal.\n\n" +
        "Las citas registradas se conservarán.";

    if (futureAppointments.length) {
        message +=
            `\n\nATENCIÓN: Hay ${futureAppointments.length} ` +
            "cita(s) futura(s) con este servicio. " +
            "Deberás revisarlas manualmente.";
    }

    if (!window.confirm(message)) {
        return;
    }

    const remainingServices = services.filter(
        item => String(item.id) !== String(serviceId)
    );

    const existingStaffStorage =
        localStorage.getItem(STAFF_KEY);

    if (existingStaffStorage !== null) {
        const staff = getStoredStaff();

        const updatedStaff = staff.map(person => ({
            ...person,
            serviceIds: Array.isArray(person.serviceIds)
                ? person.serviceIds.filter(
                    id => String(id) !== String(serviceId)
                )
                : person.serviceIds
        }));

        saveStoredStaff(updatedStaff);
    }

    saveServices(remainingServices);

    if (
        editingServiceId !== null &&
        String(editingServiceId) === String(serviceId)
    ) {
        closeModal();
    }

    renderAll();

    showToast(
        `El servicio "${service.name}" fue eliminado.`
    );
}

/* =========================================================
   NUEVO SERVICIO
========================================================= */

function openNewService() {
    editingServiceId = null;

    serviceModalTitle.textContent =
        "Nuevo servicio";

    serviceName.value = "";
    servicePrice.value = "";
    serviceDuration.value = "30";

    serviceActiveSwitch.checked = true;

    openModal();
}

/* =========================================================
   EDITAR SERVICIO
========================================================= */

function openEditService(id) {
    const service = getServices().find(
        item => String(item.id) === String(id)
    );

    if (!service) {
        showToast("No se encontró el servicio.");
        return;
    }

    editingServiceId = service.id;

    serviceName.value = service.name;
    servicePrice.value = service.price;
    serviceDuration.value = service.duration;

    serviceActiveSwitch.checked =
        service.status === "active";

    serviceModalTitle.textContent = service.name;

    openModal();
}

/* =========================================================
   MODAL
========================================================= */

function openModal() {
    serviceModal.classList.remove("hidden");

    document.body.classList.add("modal-open");

    setTimeout(() => {
        serviceName.focus();
    }, 50);
}

function closeModal() {
    serviceModal.classList.add("hidden");

    document.body.classList.remove("modal-open");

    editingServiceId = null;
}

function updateModalTitle() {
    if (editingServiceId === null) {
        return;
    }

    const name = serviceName.value.trim();

    serviceModalTitle.textContent =
        name || "Editar servicio";
}

/* =========================================================
   GUARDAR SERVICIO
========================================================= */

function saveService() {
    const name = serviceName.value.trim();

    const priceInput = servicePrice.value.trim();
    const durationInput = serviceDuration.value.trim();

    const price = Number(priceInput);
    const duration = Number(durationInput);

    if (!name) {
        showToast("Ingresa el nombre del servicio.");
        serviceName.focus();
        return;
    }

    if (
        priceInput === "" ||
        !Number.isFinite(price) ||
        price < 0
    ) {
        showToast("Ingresa un precio válido.");
        servicePrice.focus();
        return;
    }

    if (
        durationInput === "" ||
        !Number.isFinite(duration) ||
        duration < 5
    ) {
        showToast(
            "La duración debe ser de al menos 5 minutos."
        );

        serviceDuration.focus();
        return;
    }

    const services = getServices();

    const duplicate = services.find(service =>
        String(service.id) !== String(editingServiceId) &&
        String(service.name)
            .trim()
            .toLowerCase() === name.toLowerCase()
    );

    if (duplicate) {
        showToast(
            "Ya existe un servicio con ese nombre."
        );

        serviceName.focus();
        return;
    }

    const status = serviceActiveSwitch.checked
        ? "active"
        : "inactive";

    if (editingServiceId !== null) {
        const service = services.find(
            item =>
                String(item.id) === String(editingServiceId)
        );

        if (!service) {
            showToast("No se encontró el servicio.");
            return;
        }

        service.name = name;
        service.price = price;
        service.duration = duration;
        service.status = status;
        service.updatedAt = new Date().toISOString();

        saveServices(services);

        closeModal();
        renderAll();

        showToast(
            "Servicio actualizado correctamente."
        );

        return;
    }

    services.push({
        id: generateId("service"),
        name,
        price,
        duration,
        status,
        createdAt: new Date().toISOString()
    });

    saveServices(services);

    closeModal();
    renderAll();

    showToast(
        "Servicio agregado correctamente."
    );
}

/* =========================================================
   UTILIDADES
========================================================= */

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

function formatMoney(value) {
    return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
        maximumFractionDigits: 0
    }).format(Number(value) || 0);
}

function escapeHTML(value) {
    const element = document.createElement("div");

    element.textContent = String(value ?? "");

    return element.innerHTML;
}

/* =========================================================
   NOTIFICACIONES
========================================================= */

function showToast(message) {
    const toast = document.getElementById("toast");

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
   INICIAR
========================================================= */

initialize();
