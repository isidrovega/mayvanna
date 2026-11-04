
/*
 * MAYVANNA BEAUTY STUDIO
 * js/mayvanna-financial-report.js
 *
 * Resumen financiero + pagos al personal.
 */

import { getAppointments } from "./storage.js";

import {
    getPayrollReport,
    getPayrollHistory,
    registerPayrollPayment
} from "./mayvanna-payroll.js";

const $ = id => document.getElementById(id);

const money = value =>
    new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN"
    }).format(Number(value) || 0);

const asMoney = cents => money(cents / 100);

function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML;
}

function localDate(date) {
    const year = date.getFullYear();
    const month = String(
        date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
        date.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function getPeriod() {
    const active = document.querySelector(
        "[data-period].active"
    );

    const period = active?.dataset.period || "week";

    if (period === "all") {
        return { start: "", end: "" };
    }

    if (period === "custom") {
        return {
            start: $("reportStartDate")?.value || "",
            end: $("reportEndDate")?.value || ""
        };
    }

    const today = new Date();
    const start = new Date(today);

    if (period === "week") {
        start.setDate(start.getDate() - 6);
    }

    if (period === "month") {
        start.setDate(start.getDate() - 29);
    }

    return {
        start: localDate(start),
        end: localDate(today)
    };
}

function getRevenue(period) {
    let total = 0;

    for (const appointment of getAppointments()) {
        if (
            appointment.status !== "completed" ||
            appointment.paid !== true
        ) {
            continue;
        }

        const date = String(appointment.date || "");

        if (
            (period.start && date < period.start) ||
            (period.end && date > period.end)
        ) {
            continue;
        }

        const value = Number(
            appointment.amountCharged ??
            appointment.price ??
            0
        );

        if (Number.isFinite(value) && value >= 0) {
            total += Math.round(value * 100);
        }
    }

    return total;
}

function getFinancialContainer() {
    return $("mayvannaFinancialReport");
}

function getPayrollContainer() {
    return $("staffPayrollList");
}

function renderFinancial(period, payroll) {
    const container = getFinancialContainer();

    if (!container) return;

    const revenue = getRevenue(period);
    const commissions = payroll.totals.earnedCents;
    const business = revenue - commissions;

    container.innerHTML = `
        <h2>Resumen financiero y comisiones</h2>

        <p class="mayvanna-financial-description">
            Importes de citas cobradas y comisiones
            registradas en el período seleccionado.
        </p>

        <div class="mayvanna-financial-grid">
            <article class="mayvanna-financial-stat">
                <span>Ingresos cobrados</span>
                <strong>${asMoney(revenue)}</strong>
            </article>

            <article class="mayvanna-financial-stat">
                <span>Comisiones generadas</span>
                <strong>${asMoney(commissions)}</strong>
            </article>

            <article class="mayvanna-financial-stat">
                <span>Margen antes de otros gastos</span>
                <strong>${asMoney(business)}</strong>
            </article>

            <article class="mayvanna-financial-stat">
                <span>Nómina pagada</span>
                <strong>
                    ${asMoney(payroll.totals.paidCents)}
                </strong>
            </article>

            <article class="mayvanna-financial-stat highlight">
                <span>Nómina pendiente</span>
                <strong>
                    ${asMoney(payroll.totals.pendingCents)}
                </strong>
            </article>
        </div>

        ${
            payroll.warnings.length
                ? `
                    <p class="mayvanna-financial-warning">
                        Atención: hay
                        ${payroll.warnings.length}
                        cita(s) cobradas sin una distribución
                        válida de comisiones.
                        Revísalas antes de cerrar la nómina.
                    </p>
                `
                : ""
        }
    `;
}

function renderPayroll(payroll) {
    const summary = $("staffPayrollSummary");
    const list = getPayrollContainer();
    const note = $("staffPayrollNote");

    if (!summary || !list) return;

    summary.innerHTML = `
        <div class="staff-payroll-stat">
            <span>Comisiones generadas</span>
            <strong>
                ${asMoney(payroll.totals.earnedCents)}
            </strong>
        </div>

        <div class="staff-payroll-stat">
            <span>Nómina ya pagada</span>
            <strong>
                ${asMoney(payroll.totals.paidCents)}
            </strong>
        </div>

        <div class="staff-payroll-stat">
            <span>Total pendiente</span>
            <strong>
                ${asMoney(payroll.totals.pendingCents)}
            </strong>
        </div>
    `;

    if (!payroll.professionals.length) {
        list.innerHTML = `
            <div class="staff-payroll-empty">
                No hay comisiones registradas
                en este período.
            </div>
        `;

        if (note) {
            note.textContent =
                "Solo se incluyen citas completadas, " +
                "cobradas y con comisiones guardadas.";
        }

        return;
    }

    list.innerHTML = payroll.professionals.map(
        person => {
            const history = getPayrollHistory(
                person.staffId
            );

            const initials = person.name
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map(word => word.charAt(0))
                .join("")
                .toUpperCase();

            return `
                <article class="staff-payroll-card">
                    <div class="staff-payroll-card-header">
                        <div class="staff-payroll-avatar">
                            ${escapeHTML(initials)}
                        </div>

                        <div class="staff-payroll-person">
                            <strong>
                                ${escapeHTML(person.name)}
                            </strong>

                            <span>
                                ${person.appointments.length}
                                comisión(es) registradas
                            </span>
                        </div>
                    </div>

                    <div class="mayvanna-payroll-lines">
                        <div>
                            <span>Generado</span>
                            <strong>
                                ${asMoney(person.earnedCents)}
                            </strong>
                        </div>

                        <div>
                            <span>Ya pagado</span>
                            <strong>
                                ${asMoney(person.paidCents)}
                            </strong>
                        </div>

                        <div class="mayvanna-payroll-pending">
                            <span>Pendiente</span>
                            <strong>
                                ${asMoney(person.pendingCents)}
                            </strong>
                        </div>
                    </div>

                    ${
                        person.pendingCents > 0
                            ? `
                                <button
                                    type="button"
                                    class="mayvanna-payroll-pay"
                                    data-pay-staff="${escapeHTML(person.staffId)}"
                                >
                                    Registrar pago
                                </button>
                            `
                            : `
                                <p class="mayvanna-payroll-paid">
                                    ✓ Nómina cubierta
                                </p>
                            `
                    }

                    <details class="staff-payroll-details">
                        <summary>
                            Ver comisiones por cita
                        </summary>

                        ${person.appointments.map(
                            item => `
                                <div class="staff-payroll-detail-row">
                                    <span>
                                        ${escapeHTML(item.date)}
                                        ·
                                        ${escapeHTML(item.customerName)}
                                    </span>

                                    <strong>
                                        ${asMoney(item.commissionCents)}
                                    </strong>
                                </div>
                            `
                        ).join("")}
                    </details>

                    ${
                        history.length
                            ? `
                                <details class="staff-payroll-details">
                                    <summary>
                                        Historial de pagos
                                    </summary>

                                    ${history.map(
                                        payment => `
                                            <div class="staff-payroll-detail-row">
                                                <span>
                                                    ${escapeHTML(
                                                        String(payment.paidAt)
                                                            .slice(0, 10)
                                                    )}
                                                </span>

                                                <strong>
                                                    ${money(payment.amount)}
                                                </strong>
                                            </div>
                                        `
                                    ).join("")}
                                </details>
                            `
                            : ""
                    }
                </article>
            `;
        }
    ).join("");

    if (note) {
        note.textContent =
            "La nómina se calcula a partir de las " +
            "comisiones guardadas en citas cobradas. " +
            "Los pagos registrados se descuentan " +
            "automáticamente del saldo pendiente.";
    }
}

function render() {
    try {
        const period = getPeriod();
        const payroll = getPayrollReport(period);

        renderFinancial(period, payroll);
        renderPayroll(payroll);
    } catch (error) {
        console.error(
            "Mayvanna: error generando nómina:",
            error
        );

        const container = getFinancialContainer();

        if (container) {
            container.textContent =
                "No se pudo generar el resumen financiero.";
        }
    }
}

function showPaymentDialog(staffId) {
    const period = getPeriod();

    const payroll = getPayrollReport(period);

    const person = payroll.professionals.find(
        item => item.staffId === staffId
    );

    if (!person || person.pendingCents <= 0) {
        alert("Este profesional no tiene saldo pendiente.");
        return;
    }

    const requested = prompt(
        `Pago para ${person.name}\n` +
        `Pendiente: ${asMoney(person.pendingCents)}\n\n` +
        "Ingresa el importe en pesos:",
        (person.pendingCents / 100).toFixed(2)
    );

    if (requested === null) return;

    const value = Number(requested);

    if (
        !Number.isFinite(value) ||
        value <= 0 ||
        Math.round(value * 100) >
            person.pendingCents
    ) {
        alert(
            "El importe debe ser mayor que cero " +
            "y no superar el saldo pendiente."
        );
        return;
    }

    const method = prompt(
        "Método de pago:\n" +
        "cash = Efectivo\n" +
        "transfer = Transferencia\n" +
        "card = Tarjeta",
        "transfer"
    );

    if (method === null) return;

    if (
        !["cash", "transfer", "card"].includes(method)
    ) {
        alert("Método de pago no válido.");
        return;
    }

    const confirmed = confirm(
        `¿Registrar pago de ${money(value)} ` +
        `a ${person.name}?\n\n` +
        "Esta operación quedará guardada " +
        "en el historial de nómina."
    );

    if (!confirmed) return;

    try {
        registerPayrollPayment({
            staffId,
            amount: value,
            start: period.start,
            end: period.end,
            method
        });

        render();

        alert("Pago registrado correctamente.");
    } catch (error) {
        alert(
            error.message ||
            "No se pudo registrar el pago."
        );
    }
}

function configureEvents() {
    document.addEventListener("click", event => {
        const payButton = event.target.closest(
            "[data-pay-staff]"
        );

        if (payButton) {
            showPaymentDialog(
                payButton.dataset.payStaff
            );
            return;
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

    document.addEventListener(
        "agendapro:staff-changed",
        render
    );

    window.addEventListener("storage", event => {
        if (
            [
                "barbershop_appointments",
                "barbershop_barbers",
                "mayvanna_payroll_payments_v1"
            ].includes(event.key)
        ) {
            render();
        }
    });

    const dateRange = $("reportDateRange");

    if (dateRange) {
        new MutationObserver(render).observe(
            dateRange,
            {
                childList: true,
                characterData: true,
                subtree: true
            }
        );
    }
}

function initialize() {
    if (
        !getFinancialContainer() ||
        !getPayrollContainer()
    ) {
        console.error(
            "Faltan contenedores financieros en reportes.html"
        );
        return;
    }

    configureEvents();
    render();
}

initialize();
