
"use strict";

/*
 * MAYVANNA BEAUTY STUDIO
 * Actualizador de comisiones multiprofesionales.
 *
 * Ejecutar desde la raíz del proyecto:
 * node actualizar-comisiones.cjs
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();

const FILES = {
    admin: path.join(ROOT, "js", "admin.js"),
    appointments: path.join(ROOT, "js", "appointments.js"),
    reports: path.join(ROOT, "js", "reports.js"),
    commissions: path.join(ROOT, "js", "commissions.js")
};

function requireFile(file) {
    if (!fs.existsSync(file)) {
        throw new Error(
            "No se encontró: " +
            path.relative(ROOT, file)
        );
    }

    return fs.readFileSync(file, "utf8");
}

function assertContains(source, text, filename) {
    if (!source.includes(text)) {
        throw new Error(
            `No se encontró "${text}" en ${filename}. ` +
            "No se modificó ese archivo."
        );
    }
}

function insertAfter(source, marker, addition, filename) {
    assertContains(source, marker, filename);

    if (source.includes(addition.trim())) {
        return source;
    }

    return source.replace(
        marker,
        marker + addition
    );
}

function insertBefore(source, marker, addition, filename) {
    assertContains(source, marker, filename);

    if (source.includes(addition.trim())) {
        return source;
    }

    return source.replace(
        marker,
        addition + marker
    );
}

function replaceInFunction(source, functionName, transform) {
    const signature = `function ${functionName}(`;
    const start = source.indexOf(signature);

    if (start === -1) {
        throw new Error(
            `No se encontró la función ${functionName}.`
        );
    }

    const opening = source.indexOf("{", start);

    if (opening === -1) {
        throw new Error(
            `La función ${functionName} está incompleta.`
        );
    }

    let depth = 0;
    let end = -1;
    let quote = null;
    let escaped = false;
    let lineComment = false;
    let blockComment = false;

    for (let i = opening; i < source.length; i++) {
        const char = source[i];
        const next = source[i + 1];

        if (lineComment) {
            if (char === "\n") lineComment = false;
            continue;
        }

        if (blockComment) {
            if (char === "*" && next === "/") {
                blockComment = false;
                i++;
            }
            continue;
        }

        if (quote) {
            if (escaped) {
                escaped = false;
                continue;
            }

            if (char === "\\") {
                escaped = true;
                continue;
            }

            if (char === quote) {
                quote = null;
            }

            continue;
        }

        if (char === "/" && next === "/") {
            lineComment = true;
            i++;
            continue;
        }

        if (char === "/" && next === "*") {
            blockComment = true;
            i++;
            continue;
        }

        if (
            char === "'" ||
            char === '"' ||
            char === "`"
        ) {
            quote = char;
            continue;
        }

        if (char === "{") depth++;

        if (char === "}") {
            depth--;

            if (depth === 0) {
                end = i + 1;
                break;
            }
        }
    }

    if (end === -1) {
        throw new Error(
            `No se pudo identificar el final de ${functionName}.`
        );
    }

    const original = source.slice(start, end);
    const updated = transform(original);

    return (
        source.slice(0, start) +
        updated +
        source.slice(end)
    );
}

const commissionsSource = String.raw`
/*
 * MAYVANNA BEAUTY STUDIO
 * js/commissions.js
 */

const round = value =>
    Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const cents = value =>
    Math.round(Number(value) * 100);

const money = value =>
    new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN"
    }).format(Number(value) || 0);

export function calculateCommissionDistribution({
    price,
    commissionTotal,
    mode,
    allocations
}) {
    const priceCents = cents(price);
    const totalCents = cents(commissionTotal);

    if (
        !Number.isFinite(priceCents) ||
        !Number.isFinite(totalCents) ||
        priceCents < 0 ||
        totalCents < 0 ||
        totalCents > priceCents
    ) {
        return {
            valid: false,
            message: "La comisión no puede superar el precio.",
            distributions: [],
            businessAmount: 0
        };
    }

    if (!Array.isArray(allocations) || !allocations.length) {
        return {
            valid: false,
            message: "Selecciona al menos un profesional.",
            distributions: [],
            businessAmount: 0
        };
    }

    if (!["percentage", "fixed"].includes(mode)) {
        return {
            valid: false,
            message: "Tipo de reparto inválido.",
            distributions: [],
            businessAmount: 0
        };
    }

    const normalized = allocations.map(item => ({
        staffId: String(item.staffId),
        value: Number(item.value)
    }));

    if (
        normalized.some(item =>
            !item.staffId ||
            !Number.isFinite(item.value) ||
            item.value < 0
        ) ||
        new Set(normalized.map(item => item.staffId))
            .size !== normalized.length
    ) {
        return {
            valid: false,
            message: "Revisa las cantidades del reparto.",
            distributions: [],
            businessAmount: 0
        };
    }

    if (mode === "percentage") {
        const sum = normalized.reduce(
            (total, item) => total + item.value,
            0
        );

        if (Math.abs(sum - 100) > 0.000001) {
            return {
                valid: false,
                message: "Los porcentajes deben sumar 100%.",
                distributions: [],
                businessAmount: 0
            };
        }
    } else {
        const sum = normalized.reduce(
            (total, item) => total + cents(item.value),
            0
        );

        if (sum !== totalCents) {
            return {
                valid: false,
                message:
                    "Los montos deben sumar " +
                    money(commissionTotal) + ".",
                distributions: [],
                businessAmount: 0
            };
        }
    }

    let assigned = 0;

    const distributions = normalized.map((item, index) => {
        const last = index === normalized.length - 1;

        const amountCents = mode === "percentage"
            ? last
                ? totalCents - assigned
                : Math.round(totalCents * item.value / 100)
            : cents(item.value);

        assigned += amountCents;

        return {
            staffId: item.staffId,
            type: mode,
            value: item.value,
            amount: amountCents / 100
        };
    });

    if (
        assigned !== totalCents ||
        distributions.some(item => item.amount < 0)
    ) {
        return {
            valid: false,
            message: "El reparto contiene cantidades inválidas.",
            distributions: [],
            businessAmount: 0
        };
    }

    return {
        valid: true,
        message: "Comisión distribuida correctamente.",
        distributions,
        businessAmount: (priceCents - totalCents) / 100
    };
}

export function createCommissionPicker({
    anchor,
    getPrice
}) {
    if (!(anchor instanceof Element)) {
        throw new Error("No se encontró el contenedor.");
    }

    const section = document.createElement("section");
    section.className = "mayvanna-commission-box";

    section.innerHTML = \`
        <style>
            .mayvanna-commission-box {
                margin: 18px 0;
                padding: 18px;
                background: #F1EEEA;
                border: 1px solid #DCD2D1;
                border-radius: 12px;
                font-family: Montserrat, sans-serif;
                color: #500E1D;
            }

            .mayvanna-commission-box h3 {
                margin: 0 0 8px;
                font: 600 25px "Cormorant Garamond", serif;
            }

            .mayvanna-commission-box p {
                font-size: 12px;
                line-height: 1.6;
                color: #696469;
            }

            .mayvanna-commission-box label {
                display: block;
                margin-bottom: 6px;
                font-size: 12px;
                font-weight: 600;
            }

            .mayvanna-commission-box input,
            .mayvanna-commission-box select {
                width: 100%;
                padding: 10px;
                border: 1px solid #AFA394;
                border-radius: 8px;
                background: white;
                color: #500E1D;
            }

            .mayvanna-commission-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 12px;
                margin: 14px 0;
            }

            .mayvanna-commission-person {
                display: grid;
                grid-template-columns: 1fr 110px;
                gap: 12px;
                align-items: center;
                padding: 12px 0;
                border-bottom: 1px solid #DCD2D1;
            }

            .mayvanna-commission-person strong,
            .mayvanna-commission-person small {
                display: block;
            }

            .mayvanna-commission-person small {
                margin-top: 4px;
                color: #696469;
            }

            .mayvanna-commission-totals {
                display: grid;
                gap: 8px;
                margin-top: 14px;
            }

            .mayvanna-commission-totals div {
                display: flex;
                justify-content: space-between;
                gap: 10px;
            }

            .mayvanna-commission-message {
                margin-top: 12px;
                font-weight: 600;
            }

            @media (max-width: 480px) {
                .mayvanna-commission-grid {
                    grid-template-columns: 1fr;
                }
            }
        </style>

        <h3>Distribución de comisiones</h3>

        <p>
            Elige cuánto recibirá el personal.
            El resto corresponde al negocio.
        </p>

        <div class="mayvanna-commission-grid">
            <div>
                <label>Comisión total ($)</label>
                <input
                    data-total
                    type="number"
                    min="0"
                    step="0.01"
                    value="0"
                >
            </div>

            <div>
                <label>Repartir por</label>
                <select data-mode>
                    <option value="percentage">
                        Porcentaje (%)
                    </option>
                    <option value="fixed">
                        Monto fijo ($)
                    </option>
                </select>
            </div>
        </div>

        <div data-rows></div>

        <div class="mayvanna-commission-totals">
            <div>
                <span>Precio del servicio</span>
                <strong data-price></strong>
            </div>
            <div>
                <span>Comisión total</span>
                <strong data-commission></strong>
            </div>
            <div>
                <span>Para el negocio</span>
                <strong data-business></strong>
            </div>
        </div>

        <p
            class="mayvanna-commission-message"
            data-message
            role="status"
        ></p>
    \`;

    anchor.insertAdjacentElement("afterend", section);

    const totalInput = section.querySelector("[data-total]");
    const modeInput = section.querySelector("[data-mode]");
    const rows = section.querySelector("[data-rows]");

    let professionals = [];
    let allocations = [];
    let manuallyEdited = false;

    function getTotal() {
        return totalInput.value === ""
            ? NaN
            : Number(totalInput.value);
    }

    function distributeEqually() {
        const count = professionals.length;

        if (!count) {
            allocations = [];
            return;
        }

        const total = getTotal();
        const totalCents = Number.isFinite(total)
            ? cents(total)
            : 0;

        if (modeInput.value === "percentage") {
            const base = Math.floor(10000 / count);

            allocations = professionals.map((person, index) => ({
                staffId: person.id,
                value: (
                    index === count - 1
                        ? 10000 - base * (count - 1)
                        : base
                ) / 100
            }));
        } else {
            const base = Math.floor(totalCents / count);

            allocations = professionals.map((person, index) => ({
                staffId: person.id,
                value: (
                    index === count - 1
                        ? totalCents - base * (count - 1)
                        : base
                ) / 100
            }));
        }
    }

    function getValues() {
        const result = calculateCommissionDistribution({
            price: getPrice(),
            commissionTotal: getTotal(),
            mode: modeInput.value,
            allocations
        });

        return {
            ...result,
            commissionTotal: getTotal(),
            mode: modeInput.value
        };
    }

    function refresh() {
        const result = getValues();

        section.querySelector("[data-price]")
            .textContent = money(getPrice());

        section.querySelector("[data-commission]")
            .textContent = money(getTotal());

        section.querySelector("[data-business]")
            .textContent = result.valid
                ? money(result.businessAmount)
                : "—";

        const message = section.querySelector("[data-message]");
        message.textContent = result.message;
        message.style.color = result.valid
            ? "#38704D"
            : "#9F2437";

        rows.querySelectorAll("[data-amount]").forEach(element => {
            const item = result.distributions.find(
                entry => entry.staffId === element.dataset.amount
            );

            element.textContent = item
                ? "Recibe " + money(item.amount)
                : "";
        });
    }

    function renderRows() {
        rows.replaceChildren();

        for (const person of professionals) {
            const allocation = allocations.find(
                item => item.staffId === person.id
            );

            const row = document.createElement("div");
            row.className = "mayvanna-commission-person";

            const info = document.createElement("div");
            const name = document.createElement("strong");
            const amount = document.createElement("small");

            name.textContent = person.name;
            amount.dataset.amount = person.id;
            info.append(name, amount);

            const input = document.createElement("input");
            input.type = "number";
            input.min = "0";
            input.step = "0.01";
            input.value = String(allocation?.value ?? 0);

            input.setAttribute(
                "aria-label",
                "Comisión de " + person.name
            );

            input.addEventListener("input", () => {
                const item = allocations.find(
                    entry => entry.staffId === person.id
                );

                if (item) {
                    item.value = input.value === ""
                        ? NaN
                        : Number(input.value);
                }

                manuallyEdited = true;
                refresh();
            });

            row.append(info, input);
            rows.appendChild(row);
        }

        refresh();
    }

    function setProfessionals(items) {
        const next = (Array.isArray(items) ? items : [])
            .map(item => ({
                id: String(item.id),
                name: String(item.name || "Profesional")
            }));

        const oldIds = professionals
            .map(item => item.id).join("|");

        const newIds = next
            .map(item => item.id).join("|");

        if (oldIds === newIds) {
            refresh();
            return;
        }

        professionals = next;
        manuallyEdited = false;
        distributeEqually();
        renderRows();
    }

    function setSelected(saved) {
        if (
            saved &&
            Array.isArray(saved.distributions)
        ) {
            totalInput.value = String(
                saved.commissionTotal ?? 0
            );

            modeInput.value = saved.mode === "fixed"
                ? "fixed"
                : "percentage";

            allocations = saved.distributions.map(item => ({
                staffId: String(item.staffId),
                value: Number(item.value)
            }));

            manuallyEdited = true;
        } else {
            totalInput.value = "0";
            modeInput.value = "percentage";
            manuallyEdited = false;
            distributeEqually();
        }

        renderRows();
    }

    totalInput.addEventListener("input", () => {
        if (!manuallyEdited) {
            distributeEqually();
            renderRows();
        } else {
            refresh();
        }
    });

    modeInput.addEventListener("change", () => {
        manuallyEdited = false;
        distributeEqually();
        renderRows();
    });

    distributeEqually();
    renderRows();

    return {
        setProfessionals,
        setSelected,
        getValues,
        refresh,
        reset: () => setSelected(null)
    };
}
`;

function patchBooking(source, filename, isAppointments) {
    if (
        source.includes(
            'from "./commissions.js"'
        )
    ) {
        console.log(
            `Ya actualizado: ${filename}`
        );
        return source;
    }

    const importBlock = `
import {
    createCommissionPicker
} from "./commissions.js";

`;

    source = importBlock + source;

    source = insertAfter(
        source,
        "let picker;",
        "\nlet commissionPicker;\n",
        filename
    );

    const attachPattern =
        /barberSelect\.insertAdjacentElement\(\s*"afterend",\s*professionalPickerContainer\s*\);/;

    if (!attachPattern.test(source)) {
        throw new Error(
            "No se encontró el selector de profesionales en " +
            filename
        );
    }

    source = source.replace(
        attachPattern,
        match => match + `

    commissionPicker = createCommissionPicker({
        anchor: professionalPickerContainer,
        getPrice: () => picker?.getValues()?.price ?? 0
    });`
    );

    source = replaceInFunction(
        source,
        "populateStaffSelector",
        body => {
            const marker = "syncPrimaryProfessional();";

            if (!body.includes(marker)) {
                throw new Error(
                    "No se pudo sincronizar el personal."
                );
            }

            return body.replace(
                marker,
                marker + `

    commissionPicker?.setProfessionals(
        selectedProfessionalIds
            .map(id => getProfessional(id))
            .filter(Boolean)
    );`
            );
        }
    );

    source = replaceInFunction(
        source,
        "createProfessionalPicker",
        body => {
            const marker = "syncPrimaryProfessional();";

            if (!body.includes(marker)) {
                throw new Error(
                    "No se encontró el evento de profesionales."
                );
            }

            return body.replace(
                marker,
                marker + `

            commissionPicker?.setProfessionals(
                selectedProfessionalIds
                    .map(id => getProfessional(id))
                    .filter(Boolean)
            );`
            );
        }
    );

    source = replaceInFunction(
        source,
        "renderTimes",
        body => body.replace(
            "{",
            "{\n    commissionPicker?.refresh();",
        )
    );

    source = replaceInFunction(
        source,
        "resetForm",
        body => {
            const marker = "picker.reset();";

            if (!body.includes(marker)) {
                throw new Error(
                    "No se encontró el reinicio del formulario."
                );
            }

            return body.replace(
                marker,
                marker + "\n    commissionPicker?.reset();"
            );
        }
    );

    if (isAppointments) {
        source = replaceInFunction(
            source,
            "openEditAppointment",
            body => {
                const marker =
                    "populateStaffSelector(professionalIds);";

                if (!body.includes(marker)) {
                    throw new Error(
                        "No se encontró la carga de edición."
                    );
                }

                return body.replace(
                    marker,
                    marker + `

    commissionPicker?.setSelected(
        appointment.commissionDistribution || null
    );`
                );
            }
        );
    }

    const validationName = isAppointments
        ? "validateForm"
        : "validateAppointment";

    source = replaceInFunction(
        source,
        validationName,
        body => {
            const lastReturn = body.lastIndexOf(
                "return true;"
            );

            if (lastReturn === -1) {
                throw new Error(
                    "No se encontró la validación final."
                );
            }

            return (
                body.slice(0, lastReturn) +
                `const commission = commissionPicker.getValues();

    if (!commission.valid) {
        showToast(commission.message);
        return false;
    }

    ` +
                body.slice(lastReturn)
            );
        }
    );

    source = replaceInFunction(
        source,
        "saveAppointment",
        body => {
            const marker =
                "customPrice: values.customPrice,";

            if (!body.includes(marker)) {
                throw new Error(
                    "No se encontró dónde guardar la comisión."
                );
            }

            return body.replace(
                marker,
                marker + `

            commissionDistribution:
                commissionPicker.getValues(),`
            );
        }
    );

    return source;
}

function patchReports(source) {
    if (
        source.includes(
            "function buildStaffActivityWithCommissions("
        )
    ) {
        console.log("Reportes ya actualizados.");
        return source;
    }

    source = replaceInFunction(
        source,
        "buildStaffActivity",
        body => body.replace(
            "function buildStaffActivity(",
            "function buildLegacyStaffActivity("
        )
    );

    const extra = `

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
`;

    source += extra;

    return source;
}

function main() {
    const original = {
        admin: requireFile(FILES.admin),
        appointments: requireFile(FILES.appointments),
        reports: requireFile(FILES.reports)
    };

    // Primero preparar todo en memoria.
    // Si alguna comprobación falla, no se modifica nada.

    const updated = {
        admin: patchBooking(
            original.admin,
            "js/admin.js",
            false
        ),

        appointments: patchBooking(
            original.appointments,
            "js/appointments.js",
            true
        ),

        reports: patchReports(
            original.reports
        )
    };

    // Crear respaldos antes de escribir.

    for (const name of [
        "admin",
        "appointments",
        "reports"
    ]) {
        const file = FILES[name];
        const backup = file + ".bak";

        if (!fs.existsSync(backup)) {
            fs.copyFileSync(file, backup);
        }
    }

    if (
        fs.existsSync(FILES.commissions) &&
        !fs.existsSync(FILES.commissions + ".bak")
    ) {
        fs.copyFileSync(
            FILES.commissions,
            FILES.commissions + ".bak"
        );
    }

    fs.writeFileSync(
        FILES.commissions,
        commissionsSource.trimStart(),
        "utf8"
    );

    for (const name of [
        "admin",
        "appointments",
        "reports"
    ]) {
        fs.writeFileSync(
            FILES[name],
            updated[name],
            "utf8"
        );
    }

    console.log("");
    console.log("✔ Mayvanna: actualización aplicada.");
    console.log("✔ Dashboard actualizado.");
    console.log("✔ Citas actualizadas.");
    console.log("✔ Reportes actualizados.");
    console.log("✔ Comisiones creadas.");
    console.log("✔ Respaldos guardados.");
    console.log("");
    console.log(
        "Reinicia la página y prueba una cita " +
        "con dos profesionales."
    );
}

try {
    main();
} catch (error) {
    console.error("");
    console.error("No se aplicó la actualización:");
    console.error(error.message);
    process.exitCode = 1;
}
