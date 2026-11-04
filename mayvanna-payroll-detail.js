
/*
 * MAYVANNA BEAUTY STUDIO
 * js/mayvanna-payroll-detail.js
 *
 * Vista individual de comisiones y nómina.
 * No modifica citas ni pagos existentes.
 */

import { getAppointments } from "./storage.js";
import { getStaff } from "./catalog.js";
import {
    getPayrollPayments,
    registerPayrollPayment
} from "./mayvanna-payroll.js";

const money = value =>
    new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN"
    }).format(value);

const toCents = value =>
    Math.round(Number(value) * 100);

const esc = value => {
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML;
};

function getRange() {
    const period =
        document.querySelector("[data-period].active")
            ?.dataset.period || "week";

    if (period === "all") {
        return { start: "", end: "" };
    }

    if (period === "custom") {
        return {
            start: document.getElementById(
                "reportStartDate"
            )?.value || "",
            end: document.getElementById(
                "reportEndDate"
            )?.value || ""
        };
    }

    const now = new Date();
    const start = new Date(now);

    if (period === "week") {
        start.setDate(start.getDate() - 6);
    } else if (period === "month") {
        start.setDate(start.getDate() - 29);
    }

    const dateKey = date => {
        const year = date.getFullYear();
        const month = String(
            date.getMonth() + 1
        ).padStart(2, "0");
        const day = String(
            date.getDate()
        ).padStart(2, "0");

        return `${year}-${month}-${day}`;
    };

    return {
        start: dateKey(start),
        end: dateKey(now)
    };
}

function isInRange(date, range) {
    return (!range.start || date >= range.start) &&
        (!range.end || date <= range.end);
}

function getData() {
    const staff = getStaff();
    const range = getRange();
    const payments = getPayrollPayments();

    const people = new Map();
    const missing = [];

    const appointments = getAppointments()
        .filter(appointment =>
            appointment.status === "completed" &&
            appointment.paid === true &&
            isInRange(
                String(appointment.date || ""),
                range
            )
        );

    for (const appointment of appointments) {
        const distribution =
            appointment.commissionDistribution;

        const entries = distribution?.distributions;

        if (!Array.isArray(entries) || !entries.length) {
            missing.push(appointment);
            continue;
        }

        const seen = new Set();

        for (const entry of entries) {
            const id = String(entry.staffId ?? "");
            const amount = toCents(entry.amount);

            if (
                !id ||
                !Number.isSafeInteger(amount) ||
                amount < 0 ||
                seen.has(id)
            ) {
                missing.push(appointment);
                continue;
            }

            seen.add(id);

            const professional = staff.find(
                item => String(item.id) === id
            );

            if (!people.has(id)) {
                people.set(id, {
                    id,
                    name:
                        professional?.name ||
                        "Profesional no registrado",
                    earned: 0,
                    paid: 0,
                    pending: 0,
                    rows: []
                });
            }

            const person = people.get(id);

            const paid = payments
                .filter(payment =>
                    String(payment.staffId) === id &&
                    String(payment.appointmentId) ===
                        String(appointment.id)
                )
                .reduce(
                    (sum, payment) =>
                        sum + toCents(payment.amount),
                    0
                );

            const pending = Math.max(
                0,
                amount - paid
            );

            person.earned += amount;
            person.paid += paid;
            person.pending += pending;

            person.rows.push({
                appointmentId: String(appointment.id),
                date: appointment.date,
                customer:
                    appointment.clientName || "Cliente",
                service:
                    appointment.serviceName || "Servicio",
                price: Number(
                    appointment.amountCharged ??
                    appointment.price ??
                    0
                ),
                mode:
                    entry.type || distribution.mode,
                value: Number(entry.value) || 0,
                amount,
                paid,
                pending
            });
        }
    }

    return {
        people: [...people.values()].sort(
            (a, b) => a.name.localeCompare(
                b.name,
                "es"
            )
        ),
        missing,
        range
    };
}

function ensureContainer() {
    let container = document.getElementById(
        "mayvannaPayrollDetail"
    );

    if (container) return container;

    const section = document.querySelector(
        ".staff-payroll-section"
    );

    if (!section) return null;

    container = document.createElement("div");
    container.id = "mayvannaPayrollDetail";

    section.appendChild(container);

    return container;
}

function render() {
    const container = ensureContainer();

    if (!container) return;

    const { people, missing } = getData();

    const totals = people.reduce(
        (sum, person) => ({
            earned: sum.earned + person.earned,
            paid: sum.paid + person.paid,
            pending: sum.pending + person.pending
        }),
        { earned: 0, paid: 0, pending: 0 }
    );

    container.innerHTML = `
        <div class="mpd-summary">
            <article>
                <span>Comisiones generadas</span>
                <strong>
                    ${money(totals.earned / 100)}
                </strong>
            </article>

            <article>
                <span>Nómina pagada</span>
                <strong>
                    ${money(totals.paid / 100)}
                </strong>
            </article>

            <article>
                <span>Pendiente por pagar</span>
                <strong>
                    ${money(totals.pending / 100)}
                </strong>
            </article>
        </div>

        ${
            missing.length
                ? `
                    <p class="mpd-warning">
                        Hay ${missing.length} registro(s)
                        de citas cobradas sin una comisión
                        individual válida. Revisa sus datos
                        originales antes de cerrar nómina.
                    </p>
                `
                : ""
        }

        ${
            people.length
                ? people.map(person => `
                    <article class="mpd-person">
                        <header class="mpd-person-header">
                            <div>
                                <h3>${esc(person.name)}</h3>
                                <p>
                                    ${person.rows.length}
                                    comisión(es) de citas
                                </p>
                            </div>

                            <strong>
                                ${money(person.pending / 100)}
                                <small>pendiente</small>
                            </strong>
                        </header>

                        <div class="mpd-person-totals">
                            <span>
                                Generado:
                                <b>${money(person.earned / 100)}</b>
                            </span>
                            <span>
                                Pagado:
                                <b>${money(person.paid / 100)}</b>
                            </span>
                        </div>

                        <div class="mpd-table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Fecha / Cliente</th>
                                        <th>Servicio</th>
                                        <th>Cobro</th>
                                        <th>Comisión</th>
                                        <th>Pagado</th>
                                        <th>Pendiente</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    ${person.rows.map(row => `
                                        <tr>
                                            <td>
                                                ${esc(row.date)}
                                                <small>
                                                    ${esc(row.customer)}
                                                </small>
                                            </td>
                                            <td>${esc(row.service)}</td>
                                            <td>${money(row.price)}</td>
                                            <td>
                                                <b>
                                                    ${money(row.amount / 100)}
                                                </b>
                                                <small>
                                                    ${
                                                        row.mode === "percentage"
                                                            ? `${row.value}%`
                                                            : "Monto fijo"
                                                    }
                                                </small>
                                            </td>
                                            <td>
                                                ${money(row.paid / 100)}
                                            </td>
                                            <td>
                                                <b>
                                                    ${money(row.pending / 100)}
                                                </b>
                                            </td>
                                        </tr>
                                    `).join("")}
                                </tbody>
                            </table>
                        </div>

                        ${
                            person.pending > 0
                                ? `
                                    <button
                                        type="button"
                                        class="mpd-pay"
                                        data-mpd-pay="${esc(person.id)}"
                                    >
                                        Registrar pago a
                                        ${esc(person.name)}
                                    </button>
                                `
                                : `
                                    <p class="mpd-covered">
                                        ✓ Comisiones cubiertas
                                    </p>
                                `
                        }
                    </article>
                `).join("")
                : `
                    <p class="mpd-empty">
                        No hay comisiones individuales
                        registradas en este período.
                        Prueba el filtro "Todo" para
                        consultar el historial completo.
                    </p>
                `
        }
    `;
}

function pay(staffId) {
    const { people, range } = getData();

    const person = people.find(
        item => item.id === staffId
    );

    if (!person || person.pending <= 0) {
        alert("No hay saldo pendiente.");
        return;
    }

    const input = prompt(
        `Pago para ${person.name}\n` +
        `Saldo: ${money(person.pending / 100)}\n\n` +
        "Cantidad a pagar:",
        (person.pending / 100).toFixed(2)
    );

    if (input === null) return;

    const value = Number(input);

    if (
        !Number.isFinite(value) ||
        value <= 0 ||
        toCents(value) > person.pending
    ) {
        alert("Cantidad no válida.");
        return;
    }

    const method = prompt(
        "Método: cash, transfer o card",
        "transfer"
    );

    if (method === null) return;

    if (
        !["cash", "transfer", "card"].includes(method)
    ) {
        alert("Método de pago no válido.");
        return;
    }

    if (!confirm(
        `¿Confirmar pago de ${money(value)} ` +
        `a ${person.name}?`
    )) {
        return;
    }

    try {
        registerPayrollPayment({
            staffId,
            amount: value,
            start: range.start,
            end: range.end,
            method
        });

        render();
    } catch (error) {
        alert(error.message);
    }
}

function initialize() {
    const section = document.querySelector(
        ".staff-payroll-section"
    );

    if (!section) return;

    /*
     * Los módulos anteriores siguen existiendo
     * para conservar sus referencias internas,
     * pero no se muestran duplicados.
     */
    for (const id of [
        "staffPayrollSummary",
        "staffPayrollList",
        "staffPayrollNote"
    ]) {
        const element = document.getElementById(id);

        if (element) {
            element.style.setProperty(
                "display",
                "none",
                "important"
            );
        }
    }

    document.addEventListener("click", event => {
        const button = event.target.closest(
            "[data-mpd-pay]"
        );

        if (button) {
            pay(button.dataset.mpdPay);
        }

        if (
            event.target.closest("[data-period]") ||
            event.target.closest("#applyReportDates")
        ) {
            queueMicrotask(render);
        }
    });

    window.addEventListener(
        "mayvanna:payroll-changed",
        render
    );

    window.addEventListener(
        "agendapro:appointments-changed",
        render
    );

    window.addEventListener("storage", event => {
        if (
            [
                "barbershop_appointments",
                "mayvanna_payroll_payments_v1"
            ].includes(event.key)
        ) {
            render();
        }
    });

    const label = document.getElementById(
        "reportDateRange"
    );

    if (label) {
        new MutationObserver(render).observe(
            label,
            {
                childList: true,
                subtree: true,
                characterData: true
            }
        );
    }

    render();
}

initialize();
