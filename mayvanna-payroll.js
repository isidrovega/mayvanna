
/*
 * MAYVANNA BEAUTY STUDIO
 * js/mayvanna-payroll.js
 *
 * Fuente única de comisiones y pagos de nómina.
 * No modifica las citas existentes.
 */

import {
    getAppointments,
    generateId
} from "./storage.js";

import { getStaff } from "./catalog.js";

const PAYROLL_KEY = "mayvanna_payroll_payments_v1";

const cents = value =>
    Math.round(Number(value) * 100);

const amount = value => value / 100;

function readPayments() {
    const raw = localStorage.getItem(PAYROLL_KEY);

    if (!raw) return [];

    try {
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error("Error leyendo nómina:", error);
        return [];
    }
}

function writePayments(payments) {
    localStorage.setItem(
        PAYROLL_KEY,
        JSON.stringify(payments)
    );

    window.dispatchEvent(
        new CustomEvent("mayvanna:payroll-changed")
    );
}

function validCents(value) {
    const result = cents(value);

    return Number.isSafeInteger(result) &&
        result >= 0
        ? result
        : null;
}

function appointmentIsPaid(appointment) {
    return appointment?.status === "completed" &&
        appointment?.paid === true;
}

function getProfessionalName(staffId, staff) {
    return staff.find(
        person => String(person.id) === String(staffId)
    )?.name || "Profesional no registrado";
}

export function getCommissionLedger() {
    const appointments = getAppointments();
    const staff = getStaff();

    const ledger = [];
    const warnings = [];

    for (const appointment of appointments) {
        if (!appointmentIsPaid(appointment)) {
            continue;
        }

        const distribution =
            appointment.commissionDistribution;

        if (
            !distribution ||
            distribution.valid !== true ||
            !Array.isArray(distribution.distributions)
        ) {
            warnings.push({
                appointmentId: String(appointment.id),
                date: appointment.date,
                reason: "Sin distribución de comisiones válida"
            });
            continue;
        }

        const appointmentIds = new Set();

        for (const item of distribution.distributions) {
            const staffId = String(item.staffId ?? "");
            const valueCents = validCents(item.amount);

            if (
                !staffId ||
                valueCents === null ||
                appointmentIds.has(staffId)
            ) {
                warnings.push({
                    appointmentId: String(appointment.id),
                    date: appointment.date,
                    reason: "Comisión incompleta o duplicada"
                });
                continue;
            }

            appointmentIds.add(staffId);

            ledger.push({
                appointmentId: String(appointment.id),
                staffId,
                staffName: getProfessionalName(
                    staffId,
                    staff
                ),
                date: String(appointment.date || ""),
                customerName:
                    appointment.clientName || "Cliente",
                serviceName:
                    appointment.serviceName || "Servicio",
                mode: item.type || distribution.mode,
                value: Number(item.value) || 0,
                commissionCents: valueCents
            });
        }
    }

    return { ledger, warnings };
}

export function getPayrollPayments() {
    return readPayments();
}

export function getPayrollReport({
    start = "",
    end = ""
} = {}) {
    const { ledger, warnings } =
        getCommissionLedger();

    const payments = readPayments();

    const withinPeriod = date =>
        (!start || date >= start) &&
        (!end || date <= end);

    const rows = ledger.filter(
        entry => withinPeriod(entry.date)
    );

    const paymentMap = new Map();

    for (const payment of payments) {
        const key =
            String(payment.appointmentId) +
            "|" +
            String(payment.staffId);

        const value = validCents(payment.amount);

        if (value === null) continue;

        paymentMap.set(
            key,
            (paymentMap.get(key) || 0) + value
        );
    }

    const people = new Map();

    for (const entry of rows) {
        const key =
            entry.appointmentId + "|" + entry.staffId;

        const paidCents = paymentMap.get(key) || 0;

        if (!people.has(entry.staffId)) {
            people.set(entry.staffId, {
                staffId: entry.staffId,
                name: entry.staffName,
                earnedCents: 0,
                paidCents: 0,
                pendingCents: 0,
                appointments: []
            });
        }

        const person = people.get(entry.staffId);

        person.earnedCents += entry.commissionCents;
        person.paidCents += paidCents;

        person.pendingCents += Math.max(
            0,
            entry.commissionCents - paidCents
        );

        person.appointments.push({
            ...entry,
            paidCents,
            pendingCents: Math.max(
                0,
                entry.commissionCents - paidCents
            )
        });
    }

    const professionals = [...people.values()]
        .sort((a, b) =>
            b.pendingCents - a.pendingCents ||
            a.name.localeCompare(b.name, "es")
        );

    const totals = professionals.reduce(
        (result, person) => {
            result.earnedCents += person.earnedCents;
            result.paidCents += person.paidCents;
            result.pendingCents += person.pendingCents;
            return result;
        },
        {
            earnedCents: 0,
            paidCents: 0,
            pendingCents: 0
        }
    );

    return {
        professionals,
        totals,
        warnings: warnings.filter(
            item => withinPeriod(item.date)
        )
    };
}

/*
 * Registra un pago parcial o total.
 *
 * El importe se distribuye entre las comisiones
 * pendientes de las citas del profesional.
 *
 * Así, una misma comisión nunca se paga dos veces.
 */

export function registerPayrollPayment({
    staffId,
    amount: requestedAmount,
    start = "",
    end = "",
    method = "cash",
    note = ""
}) {
    const allowedMethods = [
        "cash",
        "transfer",
        "card"
    ];

    if (!allowedMethods.includes(method)) {
        throw new Error(
            "Selecciona un método de pago válido."
        );
    }

    const requestedCents = validCents(requestedAmount);

    if (
        requestedCents === null ||
        requestedCents <= 0
    ) {
        throw new Error(
            "Ingresa una cantidad mayor que cero."
        );
    }

    const report = getPayrollReport({ start, end });

    const person = report.professionals.find(
        item => item.staffId === String(staffId)
    );

    if (!person) {
        throw new Error(
            "No se encontraron comisiones para este profesional."
        );
    }

    if (requestedCents > person.pendingCents) {
        throw new Error(
            "El pago supera el saldo pendiente."
        );
    }

    const pendingAppointments = [
        ...person.appointments
    ]
        .filter(item => item.pendingCents > 0)
        .sort((a, b) =>
            a.date.localeCompare(b.date) ||
            a.appointmentId.localeCompare(
                b.appointmentId
            )
        );

    let remaining = requestedCents;

    const batchId = generateId("payroll-batch");
    const paidAt = new Date().toISOString();

    const records = [];

    for (const appointment of pendingAppointments) {
        if (remaining <= 0) break;

        const applied = Math.min(
            remaining,
            appointment.pendingCents
        );

        records.push({
            id: generateId("payroll"),
            batchId,
            appointmentId: appointment.appointmentId,
            staffId: person.staffId,
            amount: amount(applied),
            method,
            note: String(note).trim(),
            paidAt
        });

        remaining -= applied;
    }

    if (remaining !== 0 || !records.length) {
        throw new Error(
            "No se pudo distribuir el pago correctamente."
        );
    }

    const existing = readPayments();

    writePayments([...existing, ...records]);

    return {
        batchId,
        staffId: person.staffId,
        amount: amount(requestedCents),
        records
    };
}

export function getPayrollHistory(staffId = null) {
    return readPayments()
        .filter(payment =>
            staffId === null ||
            String(payment.staffId) === String(staffId)
        )
        .sort((a, b) =>
            String(b.paidAt).localeCompare(
                String(a.paidAt)
            )
        );
}
