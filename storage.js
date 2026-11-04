
/* =========================================================
   AGENDAPRO — ALMACENAMIENTO
   Archivo: js/storage.js
========================================================= */

import {
    demoCustomers,
    createDemoAppointments
} from "./data.js";

const CUSTOMER_KEY = "barbershop_customers";
const APPOINTMENT_KEY = "barbershop_appointments";

/* =========================================================
   UTILIDADES
========================================================= */

function clone(data) {
    return JSON.parse(
        JSON.stringify(data)
    );
}

function read(key, fallback) {
    const stored = localStorage.getItem(key);

    if (stored === null) {
        const initialData =
            typeof fallback === "function"
                ? fallback()
                : clone(fallback);

        localStorage.setItem(
            key,
            JSON.stringify(initialData)
        );

        return initialData;
    }

    try {
        const parsed = JSON.parse(stored);

        if (!Array.isArray(parsed)) {
            console.warn(
                `Los datos de ${key} no son una lista válida.`
            );

            return [];
        }

        return parsed;
    } catch (error) {
        console.error(
            `Error leyendo ${key}:`,
            error
        );

        return [];
    }
}

function write(key, data) {
    if (!Array.isArray(data)) {
        throw new TypeError(
            `No se puede guardar ${key}: se esperaba una lista.`
        );
    }

    localStorage.setItem(
        key,
        JSON.stringify(data)
    );
}

/* =========================================================
   CLIENTES
========================================================= */

export function getCustomers() {
    return read(
        CUSTOMER_KEY,
        demoCustomers
    );
}

export function saveCustomers(customers) {
    write(
        CUSTOMER_KEY,
        customers
    );
}

/* =========================================================
   CITAS
========================================================= */

export function getAppointments() {
    return read(
        APPOINTMENT_KEY,
        createDemoAppointments
    );
}

export function saveAppointments(appointments) {
    write(
        APPOINTMENT_KEY,
        appointments
    );
}

/* =========================================================
   TELÉFONOS
========================================================= */

export function normalizePhone(phone) {
    return String(phone || "")
        .replace(/\D/g, "");
}

/* =========================================================
   BUSCAR CLIENTE
========================================================= */

export function findCustomerByPhone(phone) {
    const normalized = normalizePhone(phone);

    if (!normalized) {
        return null;
    }

    return getCustomers().find(
        customer =>
            normalizePhone(customer.phone) === normalized
    ) || null;
}

/* =========================================================
   CREAR O RECUPERAR CLIENTE
========================================================= */

export function getOrCreateCustomer(name, phone) {
    const customers = getCustomers();

    const normalized = normalizePhone(phone);

    let customer = customers.find(
        item =>
            normalizePhone(item.phone) === normalized
    );

    if (customer) {
        customer.name = name;

        saveCustomers(customers);

        return customer;
    }

    customer = {
        id: generateId("customer"),
        name,
        phone,
        visits: 0
    };

    customers.push(customer);

    saveCustomers(customers);

    return customer;
}

/* =========================================================
   FIDELIDAD
========================================================= */

export function addCustomerVisit(phone) {
    const customers = getCustomers();

    const normalized = normalizePhone(phone);

    if (!normalized) {
        return false;
    }

    const customer = customers.find(
        item =>
            normalizePhone(item.phone) === normalized
    );

    if (!customer) {
        return false;
    }

    customer.visits =
        (Number(customer.visits) || 0) + 1;

    saveCustomers(customers);

    return true;
}

/* =========================================================
   GENERAR IDENTIFICADORES
========================================================= */

export function generateId(prefix) {
    if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
    ) {
        return `${prefix}-${crypto.randomUUID()}`;
    }

    return (
        `${prefix}-${Date.now()}-` +
        Math.random().toString(16).slice(2)
    );
}
