
/*
 * MAYVANNA BEAUTY STUDIO
 * js/commissions.js
 *
 * Comisiones por porcentaje del precio de la cita
 * o por monto fijo.
 *
 * Compatible con js/appointments.js.
 */

const moneyFormatter = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

const money = value =>
    moneyFormatter.format(Number(value) || 0);

const toCents = value =>
    Math.round(Number(value) * 100);

const fromCents = value =>
    value / 100;

function round(value, decimals = 4) {
    const factor = 10 ** decimals;
    return Math.round((value + Number.EPSILON) * factor) / factor;
}

function invalid(message) {
    return {
        valid: false,
        message,
        distributions: [],
        businessAmount: 0,
        commissionTotal: 0
    };
}

export function getCommissionStaffIds(appointment) {
    const ids =
        Array.isArray(appointment?.barberIds) &&
        appointment.barberIds.length
            ? appointment.barberIds
            : [
                appointment?.staffId ??
                appointment?.barberId
            ];

    return [
        ...new Set(
            ids
                .filter(id => id != null && id !== "")
                .map(String)
        )
    ];
}

/*
 * NUEVO CÁLCULO
 *
 * percentage:
 *   El porcentaje se aplica al precio de la cita.
 *
 * fixed:
 *   El valor es directamente una cantidad en pesos.
 *
 * commissionTotal se conserva como parámetro opcional
 * por compatibilidad con código existente.
 */

export function calculateCommissionDistribution({
    price,
    commissionTotal,
    mode,
    allocations
}) {
    const priceCents = toCents(price);

    if (
        !Number.isFinite(priceCents) ||
        priceCents < 0
    ) {
        return invalid(
            "El precio de la cita no es válido."
        );
    }

    if (!["percentage", "fixed"].includes(mode)) {
        return invalid(
            "Selecciona porcentaje o monto fijo."
        );
    }

    if (
        !Array.isArray(allocations) ||
        allocations.length === 0
    ) {
        return invalid(
            "Selecciona al menos un profesional."
        );
    }

    const items = allocations.map(item => ({
        staffId: String(item.staffId ?? ""),
        value: Number(item.value)
    }));

    if (
        items.some(item =>
            !item.staffId ||
            !Number.isFinite(item.value) ||
            item.value < 0
        )
    ) {
        return invalid(
            "Revisa los valores de las comisiones."
        );
    }

    if (
        new Set(items.map(item => item.staffId)).size !==
        items.length
    ) {
        return invalid(
            "Hay profesionales duplicados."
        );
    }

    let amountsCents = [];

    if (mode === "percentage") {
        const percentageTotal = items.reduce(
            (sum, item) => sum + item.value,
            0
        );

        if (percentageTotal > 100.000001) {
            return invalid(
                "La suma de porcentajes no puede superar 100%."
            );
        }

        /*
         * Cada porcentaje se calcula sobre el precio
         * de la cita, no sobre una comisión predefinida.
         */

        amountsCents = items.map(item =>
            Math.round(
                priceCents * item.value / 100
            )
        );
    } else {
        amountsCents = items.map(item =>
            toCents(item.value)
        );
    }

    const totalCents = amountsCents.reduce(
        (sum, amount) => sum + amount,
        0
    );

    if (
        !Number.isFinite(totalCents) ||
        totalCents < 0
    ) {
        return invalid(
            "El total de comisiones no es válido."
        );
    }

    if (totalCents > priceCents) {
        return invalid(
            "Las comisiones no pueden superar " +
            "el precio de la cita."
        );
    }

    const distributions = items.map(
        (item, index) => ({
            staffId: item.staffId,
            type: mode,
            value: item.value,
            amount: fromCents(amountsCents[index])
        })
    );

    const businessCents = priceCents - totalCents;

    return {
        valid: true,
        message: "Distribución correcta.",
        distributions,
        businessAmount: fromCents(businessCents),
        commissionTotal: fromCents(totalCents),
        mode,
        basis: "appointment-price",
        price: fromCents(priceCents)
    };
}

export function getRecordedCommission(
    appointment,
    staffId
) {
    const distribution =
        appointment?.commissionDistribution;

    if (
        !distribution ||
        !Array.isArray(distribution.distributions)
    ) {
        return null;
    }

    const item = distribution.distributions.find(
        entry =>
            String(entry.staffId) === String(staffId)
    );

    return item
        ? Number(item.amount) || 0
        : 0;
}

export function createCommissionPicker({
    anchor,
    getPrice,
    onChange
}) {
    if (!(anchor instanceof Element)) {
        throw new Error(
            "No se encontró el contenedor de comisiones."
        );
    }

    const section = document.createElement("section");

    section.className = "mayvanna-commission-box";

    section.innerHTML = `
        <style>
            .mayvanna-commission-box {
                display: block;
                grid-column: 1 / -1;
                width: 100%;
                box-sizing: border-box;
                margin: 16px 0;
                padding: 18px;
                background: #f1eeea;
                border: 1px solid #dcd2d1;
                border-radius: 12px;
                color: #500e1d;
                font-family: Montserrat, Arial, sans-serif;
            }

            .mayvanna-commission-box h3 {
                margin: 0 0 8px;
                font-size: 20px;
                color: #500e1d;
            }

            .mayvanna-commission-box p {
                margin: 0 0 12px;
                font-size: 12px;
                line-height: 1.6;
                color: #696469;
            }

            .mayvanna-commission-box label {
                display: block;
                margin-bottom: 6px;
                font-size: 12px;
                font-weight: 600;
                color: #500e1d;
            }

            .mayvanna-commission-box input,
            .mayvanna-commission-box select {
                display: block;
                width: 100%;
                min-width: 0;
                box-sizing: border-box;
                padding: 10px;
                border: 1px solid #afa394;
                border-radius: 8px;
                background: #ffffff;
                color: #500e1d;
                font: inherit;
                color-scheme: light;
            }

            .mayvanna-commission-box input:focus,
            .mayvanna-commission-box select:focus {
                border-color: #500e1d;
                outline: 2px solid #dcd2d1;
                outline-offset: 1px;
            }

            .mayvanna-commission-grid {
                display: grid;
                grid-template-columns: repeat(
                    2,
                    minmax(0, 1fr)
                );
                gap: 12px;
                margin: 14px 0;
            }

            .mayvanna-commission-person {
                display: grid;
                grid-template-columns:
                    minmax(0, 1fr)
                    minmax(105px, 135px);
                align-items: center;
                gap: 12px;
                padding: 12px 0;
                border-bottom: 1px solid #dcd2d1;
            }

            .mayvanna-commission-person strong,
            .mayvanna-commission-person small {
                display: block;
            }

            .mayvanna-commission-person strong {
                color: #500e1d;
            }

            .mayvanna-commission-person small {
                margin-top: 4px;
                color: #696469;
            }

            .mayvanna-commission-input-wrap {
                position: relative;
                display: flex;
                align-items: center;
            }

            .mayvanna-commission-input-wrap input {
                padding-right: 34px;
            }

            .mayvanna-commission-input-unit {
                position: absolute;
                right: 12px;
                color: #500e1d;
                font-size: 14px;
                font-weight: 700;
                pointer-events: none;
            }

            .mayvanna-commission-totals {
                display: grid;
                gap: 10px;
                margin-top: 16px;
                padding-top: 14px;
                border-top: 1px solid #afa394;
            }

            .mayvanna-commission-totals div {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 12px;
            }

            .mayvanna-commission-totals strong {
                color: #500e1d;
            }

            .mayvanna-commission-business {
                padding: 12px;
                background: #ffffff;
                border: 1px solid #dcd2d1;
                border-radius: 8px;
            }

            .mayvanna-commission-message {
                margin-top: 12px !important;
                font-weight: 600;
            }

            .mayvanna-commission-mode-help {
                margin-top: 8px !important;
            }

            .mayvanna-commission-total-display {
                display: flex;
                align-items: center;
                min-height: 42px;
                padding: 10px 12px;
                box-sizing: border-box;
                border: 1px solid #afa394;
                border-radius: 8px;
                background: #ffffff;
                color: #500e1d;
                font-weight: 700;
            }

            @media (max-width: 480px) {
                .mayvanna-commission-grid {
                    grid-template-columns: 1fr;
                }

                .mayvanna-commission-person {
                    grid-template-columns:
                        minmax(0, 1fr)
                        110px;
                }
            }
        </style>

        <h3>Distribución de comisiones</h3>

        <p>
            Selecciona cómo calcular las comisiones.
            El dinero restante pertenece a Mayvanna.
        </p>

        <div class="mayvanna-commission-grid">
            <div>
                <label for="mayvannaCommissionMode">
                    Tipo de comisión
                </label>

                <select
                    id="mayvannaCommissionMode"
                    data-mode
                >
                    <option value="percentage">
                        Porcentaje (%)
                    </option>

                    <option value="fixed">
                        Monto fijo ($)
                    </option>
                </select>
            </div>

            <div>
                <label>
                    Total para profesionales
                </label>

                <div
                    class="mayvanna-commission-total-display"
                    data-total-display
                    aria-live="polite"
                >
                    $0.00
                </div>
            </div>
        </div>

        <p
            class="mayvanna-commission-mode-help"
            data-mode-help
        ></p>

        <div data-rows></div>

        <div class="mayvanna-commission-totals">
            <div>
                <span>Precio de la cita</span>
                <strong data-price>$0.00</strong>
            </div>

            <div>
                <span>Para profesionales</span>
                <strong data-commission>$0.00</strong>
            </div>

            <div class="mayvanna-commission-business">
                <span>Para Mayvanna</span>
                <strong data-business>$0.00</strong>
            </div>
        </div>

        <p
            class="mayvanna-commission-message"
            data-message
            role="status"
            aria-live="polite"
        ></p>
    `;

    anchor.insertAdjacentElement(
        "afterend",
        section
    );

    const modeInput = section.querySelector(
        "[data-mode]"
    );

    const rows = section.querySelector(
        "[data-rows]"
    );

    const modeHelp = section.querySelector(
        "[data-mode-help]"
    );

    const totalDisplay = section.querySelector(
        "[data-total-display]"
    );

    const priceDisplay = section.querySelector(
        "[data-price]"
    );

    const commissionDisplay = section.querySelector(
        "[data-commission]"
    );

    const businessDisplay = section.querySelector(
        "[data-business]"
    );

    const messageDisplay = section.querySelector(
        "[data-message]"
    );

    let professionals = [];
    let allocations = [];

    function currentPrice() {
        const value = Number(getPrice());

        return Number.isFinite(value)
            ? Math.max(0, value)
            : 0;
    }

    function getValues() {
        const result = calculateCommissionDistribution({
            price: currentPrice(),
            mode: modeInput.value,
            allocations
        });

        return {
            ...result,
            mode: modeInput.value,
            basis: "appointment-price"
        };
    }

    function getCurrentAmounts() {
        const price = currentPrice();

        return allocations.map(item => ({
            staffId: item.staffId,
            amount:
                modeInput.value === "percentage"
                    ? round(
                        price * item.value / 100,
                        2
                    )
                    : round(item.value, 2)
        }));
    }

    function convertMode(nextMode) {
        const previousAmounts = getCurrentAmounts();
        const price = currentPrice();

        allocations = previousAmounts.map(item => ({
            staffId: item.staffId,
            value:
                nextMode === "percentage"
                    ? price > 0
                        ? round(
                            item.amount * 100 / price,
                            4
                        )
                        : 0
                    : round(item.amount, 2)
        }));

        modeInput.value = nextMode;
    }

    function updateModeHelp() {
        const percentage =
            modeInput.value === "percentage";

        modeHelp.textContent = percentage
            ? "Porcentaje: cada valor se calcula " +
              "sobre el precio total de la cita. " +
              "Ejemplo: 30% de $1,000 = $300."
            : "Monto fijo: escribe la cantidad " +
              "exacta en pesos que recibirá " +
              "cada profesional.";
    }

    function refresh() {
        const result = getValues();
        const price = currentPrice();

        priceDisplay.textContent = money(price);

        if (result.valid) {
            commissionDisplay.textContent =
                money(result.commissionTotal);

            totalDisplay.textContent =
                money(result.commissionTotal);

            businessDisplay.textContent =
                money(result.businessAmount);
        } else {
            const amounts = getCurrentAmounts();

            const estimatedTotal = amounts.reduce(
                (sum, item) => sum + item.amount,
                0
            );

            const totalText = Number.isFinite(
                estimatedTotal
            )
                ? money(estimatedTotal)
                : "—";

            commissionDisplay.textContent = totalText;
            totalDisplay.textContent = totalText;
            businessDisplay.textContent = "—";
        }

        messageDisplay.textContent = result.message;

        messageDisplay.style.color = result.valid
            ? "#38704d"
            : "#a12c40";

        const amountMap = new Map(
            getCurrentAmounts().map(item => [
                item.staffId,
                item.amount
            ])
        );

        for (const element of rows.querySelectorAll(
            "[data-amount]"
        )) {
            const amount = amountMap.get(
                element.dataset.amount
            );

            element.textContent =
                Number.isFinite(amount)
                    ? "Recibe " + money(amount)
                    : "Cantidad no válida";
        }

        if (typeof onChange === "function") {
            onChange(result);
        }
    }

    function renderRows() {
        rows.replaceChildren();

        updateModeHelp();

        for (const person of professionals) {
            const allocation = allocations.find(
                item => item.staffId === person.id
            );

            const row = document.createElement("div");

            row.className =
                "mayvanna-commission-person";

            const info = document.createElement("div");

            const name = document.createElement("strong");
            name.textContent = person.name;

            const amount = document.createElement("small");
            amount.dataset.amount = person.id;

            info.append(name, amount);

            const inputWrap = document.createElement("div");

            inputWrap.className =
                "mayvanna-commission-input-wrap";

            const input = document.createElement("input");

            input.type = "number";
            input.min = "0";
            input.step = "0.01";
            input.inputMode = "decimal";

            if (modeInput.value === "percentage") {
                input.max = "100";
            } else {
                input.max = String(currentPrice());
            }

            input.value = String(
                allocation?.value ?? 0
            );

            input.setAttribute(
                "aria-label",
                (
                    modeInput.value === "percentage"
                        ? "Porcentaje de "
                        : "Monto fijo de "
                ) + person.name
            );

            const unit = document.createElement("span");

            unit.className =
                "mayvanna-commission-input-unit";

            unit.textContent =
                modeInput.value === "percentage"
                    ? "%"
                    : "$";

            input.addEventListener("input", () => {
                const item = allocations.find(
                    entry =>
                        entry.staffId === person.id
                );

                if (!item) return;

                item.value =
                    input.value.trim() === ""
                        ? NaN
                        : Number(input.value);

                refresh();
            });

            inputWrap.append(input, unit);
            row.append(info, inputWrap);

            rows.appendChild(row);
        }

        refresh();
    }

    function setProfessionals(items) {
        const next = (
            Array.isArray(items) ? items : []
        )
            .filter(item =>
                item &&
                item.id !== undefined &&
                item.id !== null
            )
            .map(item => ({
                id: String(item.id),
                name: String(
                    item.name || "Profesional"
                )
            }));

        const previousIds = professionals
            .map(item => item.id);

        const nextIds = next.map(item => item.id);

        if (
            previousIds.length === nextIds.length &&
            previousIds.every(
                (id, index) => id === nextIds[index]
            )
        ) {
            refresh();
            return;
        }

        const oldValues = new Map(
            allocations.map(item => [
                item.staffId,
                item.value
            ])
        );

        professionals = next;

        allocations = professionals.map(person => ({
            staffId: person.id,
            value: oldValues.has(person.id)
                ? oldValues.get(person.id)
                : 0
        }));

        renderRows();
    }

    /*
     * Recuperar una cita guardada.
     *
     * Los registros antiguos calculaban porcentajes
     * sobre commissionTotal.
     *
     * Para conservar las cantidades monetarias,
     * se convierten al porcentaje equivalente
     * del precio de la cita.
     */

    function setSelected(saved) {
        if (
            !saved ||
            !Array.isArray(saved.distributions)
        ) {
            modeInput.value = "percentage";

            allocations = professionals.map(
                person => ({
                    staffId: person.id,
                    value: 0
                })
            );

            renderRows();
            return;
        }

        const mode =
            saved.mode === "fixed"
                ? "fixed"
                : "percentage";

        modeInput.value = mode;

        const savedMap = new Map(
            saved.distributions.map(item => [
                String(item.staffId),
                item
            ])
        );

        const price = currentPrice();

        const isNewFormat =
            saved.basis === "appointment-price";

        allocations = professionals.map(person => {
            const item = savedMap.get(person.id);

            if (!item) {
                return {
                    staffId: person.id,
                    value: 0
                };
            }

            let value = Number(item.value) || 0;

            if (
                mode === "percentage" &&
                !isNewFormat
            ) {
                const oldAmount =
                    Number(item.amount) || 0;

                value = price > 0
                    ? round(
                        oldAmount * 100 / price,
                        4
                    )
                    : 0;
            }

            return {
                staffId: person.id,
                value
            };
        });

        renderRows();
    }

    modeInput.addEventListener(
        "change",
        () => {
            /*
             * La modalidad anterior se recuerda
             * para convertir correctamente los valores.
             */
            const nextMode = modeInput.value;
            modeInput.value = previousMode;

            convertMode(nextMode);
            previousMode = nextMode;

            renderRows();
        }
    );

    let previousMode = modeInput.value;

    const originalSetSelected = setSelected;

    function selectSaved(saved) {
        originalSetSelected(saved);
        previousMode = modeInput.value;
    }

    renderRows();

    return {
        setProfessionals,
        setSelected: selectSaved,
        getValues,
        refresh,
        reset() {
            selectSaved(null);
        }
    };
}
