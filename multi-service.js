/* =========================================================
   VARDEN / AGENDAPRO
   Archivo: js/multi-service.js

   Selector desplegable de múltiples servicios.
   Conserva la API usada por admin.js y appointments.js.
========================================================= */

import { getActiveServices } from "./catalog.js";

const money = value =>
    new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN"
    }).format(Number(value) || 0);

function escapeHTML(value) {
    const element = document.createElement("div");
    element.textContent = String(value ?? "");
    return element.innerHTML;
}

export function createMultiServicePicker({
    serviceSelect,
    onChange
}) {
    if (!serviceSelect) {
        throw new Error(
            "No se encontró el selector de servicios."
        );
    }

    let selectedIds = [];
    let customPrice = false;
    let expanded = false;

    /*
       Crear el selector solo una vez.
       Evita duplicados al inicializar.
    */

    document
        .getElementById("agendaproMultiServicePicker")
        ?.remove();

    const wrapper = document.createElement("div");
    wrapper.id = "agendaproMultiServicePicker";

    wrapper.innerHTML = `
        <style>
            #agendaproMultiServicePicker {
                width: 100%;
                min-width: 0;
                color: inherit;
                font: inherit;
                box-sizing: border-box;
            }

            #agendaproMultiServicePicker *,
            #agendaproMultiServicePicker *::before,
            #agendaproMultiServicePicker *::after {
                box-sizing: border-box;
            }

            #agendaproMultiServicePicker .varden-service-toggle {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                width: 100%;
                min-height: 44px;
                padding: 11px 13px;
                border: 1px solid var(
                    --border-color,
                    var(--border, #3a3a3a)
                );
                border-radius: 8px;
                background: var(
                    --input-bg,
                    var(--surface, #202020)
                );
                color: inherit;
                font: inherit;
                text-align: left;
                cursor: pointer;
                transition:
                    border-color .2s ease,
                    background .2s ease;
            }

            #agendaproMultiServicePicker .varden-service-toggle:hover {
                border-color: #777;
            }

            #agendaproMultiServicePicker .varden-service-toggle:focus-visible {
                outline: 2px solid currentColor;
                outline-offset: 2px;
            }

            #agendaproMultiServicePicker .varden-service-label {
                flex: 1;
                min-width: 0;
                overflow: hidden;
                white-space: nowrap;
                text-overflow: ellipsis;
            }

            #agendaproMultiServicePicker .varden-chevron {
                flex: none;
                font-size: 12px;
                opacity: .7;
                transition: transform .2s ease;
            }

            #agendaproMultiServicePicker .varden-service-toggle[aria-expanded="true"]
            .varden-chevron {
                transform: rotate(180deg);
            }

            #agendaproMultiServicePicker .varden-service-dropdown {
                margin-top: 6px;
                padding: 5px;
                border: 1px solid var(
                    --border-color,
                    var(--border, #3a3a3a)
                );
                border-radius: 8px;
                background: var(
                    --input-bg,
                    var(--surface, #202020)
                );
                max-height: 240px;
                overflow-y: auto;
            }

            #agendaproMultiServicePicker .varden-service-dropdown[hidden] {
                display: none !important;
            }

            #agendaproMultiServicePicker .varden-service-option {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 11px 9px;
                border-radius: 6px;
                cursor: pointer;
            }

            #agendaproMultiServicePicker .varden-service-option:hover {
                background: rgba(128,128,128,.12);
            }

            #agendaproMultiServicePicker .varden-service-option-main {
                display: flex;
                align-items: center;
                gap: 10px;
                min-width: 0;
            }

            #agendaproMultiServicePicker .varden-service-option input {
                width: 17px;
                height: 17px;
                margin: 0;
                flex: none;
                accent-color: #888;
                cursor: pointer;
            }

            #agendaproMultiServicePicker .varden-service-option-name {
                font-size: 13px;
                font-weight: 500;
            }

            #agendaproMultiServicePicker .varden-service-option-duration {
                display: block;
                margin-top: 3px;
                font-size: 11px;
                opacity: .65;
            }

            #agendaproMultiServicePicker .varden-service-option-price {
                font-size: 12px;
                font-weight: 600;
                white-space: nowrap;
            }

            #agendaproMultiServicePicker .varden-service-summary {
                margin-top: 15px;
                padding-top: 13px;
                border-top: 1px solid var(
                    --border-color,
                    var(--border, #3a3a3a)
                );
            }

            #agendaproMultiServicePicker .varden-summary-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                margin-bottom: 10px;
                font-size: 13px;
            }

            #agendaproMultiServicePicker .varden-summary-row span {
                opacity: .75;
            }

            #agendaproMultiServicePicker .varden-price-label {
                display: block;
                margin: 15px 0 7px;
                font-size: 13px;
                font-weight: 600;
            }

            #agendaproMultiServicePicker .varden-custom-price {
                display: block;
                width: 100%;
                min-height: 44px;
                padding: 10px 12px;
                border: 1px solid var(
                    --border-color,
                    var(--border, #3a3a3a)
                );
                border-radius: 8px;
                background: var(
                    --input-bg,
                    var(--surface, #202020)
                );
                color: inherit;
                font: inherit;
            }

            #agendaproMultiServicePicker .varden-price-help {
                margin: 6px 0 0;
                font-size: 11px;
                line-height: 1.5;
                opacity: .65;
            }

            #agendaproMultiServicePicker .varden-total-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 12px;
                margin-top: 15px;
                padding-top: 13px;
                border-top: 1px solid var(
                    --border-color,
                    var(--border, #3a3a3a)
                );
                font-size: 13px;
                font-weight: 700;
            }

            #agendaproMultiServicePicker .varden-total-value {
                font-size: 18px;
            }

            #agendaproMultiServicePicker .varden-service-empty {
                padding: 12px;
                font-size: 13px;
                opacity: .7;
            }
        </style>

        <button
            type="button"
            class="varden-service-toggle"
            id="vardenServiceToggle"
            aria-expanded="false"
            aria-controls="vardenServiceDropdown"
        >
            <span
                class="varden-service-label"
                id="vardenServiceLabel"
            >
                Seleccionar servicios
            </span>

            <span
                class="varden-chevron"
                aria-hidden="true"
            >
                ▼
            </span>
        </button>

        <div
            class="varden-service-dropdown"
            id="vardenServiceDropdown"
            hidden
        >
            <div id="agendaproServiceOptions"></div>
        </div>

        <div class="varden-service-summary">
            <div class="varden-summary-row">
                <span>Precio normal</span>
                <strong id="agendaproNormalPrice">
                    $0
                </strong>
            </div>

            <div class="varden-summary-row">
                <span>Duración total</span>
                <strong id="agendaproTotalDuration">
                    0 min
                </strong>
            </div>

            <label
                for="agendaproCustomPrice"
                class="varden-price-label"
            >
                Precio acordado (MXN)
            </label>

            <input
                id="agendaproCustomPrice"
                class="varden-custom-price"
                type="number"
                min="0"
                step="0.01"
                inputmode="decimal"
            >

            <p class="varden-price-help">
                Puedes modificar el importe para aplicar
                promociones o precios especiales.
            </p>

            <div class="varden-total-row">
                <span>Total de la cita</span>

                <strong
                    class="varden-total-value"
                    id="agendaproFinalPrice"
                >
                    $0
                </strong>
            </div>
        </div>
    `;

    serviceSelect.insertAdjacentElement(
        "afterend",
        wrapper
    );

    /*
       Ocultar únicamente el select original.
       Conservamos su valor para compatibilidad.
    */

    const originalField = serviceSelect.closest(".field");

    if (originalField) {
        const label = originalField.querySelector(
            `label[for="${serviceSelect.id}"]`
        );

        if (label) {
            label.style.display = "none";
        }
    }

    serviceSelect.style.display = "none";

    const toggle = wrapper.querySelector(
        "#vardenServiceToggle"
    );

    const dropdown = wrapper.querySelector(
        "#vardenServiceDropdown"
    );

    const selectionLabel = wrapper.querySelector(
        "#vardenServiceLabel"
    );

    const options = wrapper.querySelector(
        "#agendaproServiceOptions"
    );

    const priceInput = wrapper.querySelector(
        "#agendaproCustomPrice"
    );

    const normalPriceElement = wrapper.querySelector(
        "#agendaproNormalPrice"
    );

    const durationElement = wrapper.querySelector(
        "#agendaproTotalDuration"
    );

    const finalPriceElement = wrapper.querySelector(
        "#agendaproFinalPrice"
    );

    /* =====================================================
       ESTADO DEL DESPLEGABLE
    ===================================================== */

    function setExpanded(open) {
        expanded = Boolean(open);

        dropdown.hidden = !expanded;

        toggle.setAttribute(
            "aria-expanded",
            String(expanded)
        );
    }

    toggle.addEventListener("click", () => {
        setExpanded(!expanded);
    });

    document.addEventListener("click", event => {
        if (!wrapper.contains(event.target)) {
            setExpanded(false);
        }
    });

    wrapper.addEventListener("keydown", event => {
        if (event.key === "Escape" && expanded) {
            setExpanded(false);
            toggle.focus();
        }
    });

    /* =====================================================
       DATOS DE SERVICIOS
    ===================================================== */

    function getSelectedServices() {
        const ids = new Set(selectedIds.map(String));

        return getActiveServices().filter(
            service => ids.has(String(service.id))
        );
    }

    function getNormalPrice() {
        return getSelectedServices().reduce(
            (total, service) =>
                total + (Number(service.price) || 0),
            0
        );
    }

    function getDuration() {
        return getSelectedServices().reduce(
            (total, service) =>
                total + (Number(service.duration) || 0),
            0
        );
    }

    function getPrice() {
        const raw = priceInput.value.trim();

        if (raw === "") return NaN;

        return Number(raw);
    }

    /* =====================================================
       SINCRONIZAR CON EL SELECT ORIGINAL
    ===================================================== */

    function syncPrimarySelect() {
        const firstId = selectedIds[0] || "";

        serviceSelect.replaceChildren();

        if (!firstId) {
            serviceSelect.add(
                new Option("Sin servicio", "")
            );
        } else {
            const first = getActiveServices().find(
                service =>
                    String(service.id) === String(firstId)
            );

            serviceSelect.add(
                new Option(
                    first?.name || "Servicio",
                    firstId
                )
            );
        }

        serviceSelect.value = firstId;
    }

    /* =====================================================
       ACTUALIZAR RESUMEN
    ===================================================== */

    function updateSummary() {
        const services = getSelectedServices();

        const normal = getNormalPrice();
        const duration = getDuration();

        if (!customPrice) {
            priceInput.value = normal.toFixed(2);
        }

        normalPriceElement.textContent = money(normal);

        durationElement.textContent = `${duration} min`;

        const price = getPrice();

        finalPriceElement.textContent =
            Number.isFinite(price) && price >= 0
                ? money(price)
                : "Importe inválido";

        if (!services.length) {
            selectionLabel.textContent =
                "Seleccionar servicios";
        } else if (services.length === 1) {
            selectionLabel.textContent =
                services[0].name;
        } else {
            selectionLabel.textContent =
                services.map(service => service.name)
                    .join(" + ");
        }

        selectionLabel.title =
            selectionLabel.textContent;

        syncPrimarySelect();
    }

    /* =====================================================
       RENDERIZAR OPCIONES
    ===================================================== */

    function renderOptions() {
        const services = getActiveServices();

        const validIds = new Set(
            services.map(service => String(service.id))
        );

        selectedIds = selectedIds.filter(
            id => validIds.has(String(id))
        );

        options.replaceChildren();

        if (!services.length) {
            options.innerHTML = `
                <div class="varden-service-empty">
                    No hay servicios activos.
                </div>
            `;
        }

        for (const service of services) {
            const id = String(service.id);

            const label = document.createElement("label");

            label.className = "varden-service-option";

            const checked = selectedIds.includes(id);

            label.innerHTML = `
                <span class="varden-service-option-main">
                    <input
                        type="checkbox"
                        value="${escapeHTML(id)}"
                        ${checked ? "checked" : ""}
                    >

                    <span>
                        <span class="varden-service-option-name">
                            ${escapeHTML(service.name)}
                        </span>

                        <small class="varden-service-option-duration">
                            ${Number(service.duration) || 0} min
                        </small>
                    </span>
                </span>

                <strong class="varden-service-option-price">
                    ${money(service.price)}
                </strong>
            `;

            options.appendChild(label);
        }

        updateSummary();
    }

    /* =====================================================
       EVENTOS DE SELECCIÓN
    ===================================================== */

    function notifyChange() {
        if (typeof onChange === "function") {
            onChange();
        }
    }

    options.addEventListener("change", event => {
        const checkbox = event.target.closest(
            'input[type="checkbox"]'
        );

        if (!checkbox) return;

        const id = String(checkbox.value);

        if (checkbox.checked) {
            if (!selectedIds.includes(id)) {
                selectedIds.push(id);
            }
        } else {
            selectedIds = selectedIds.filter(
                selected => selected !== id
            );
        }

        customPrice = false;

        updateSummary();
        notifyChange();

        /*
           No cerrar aquí el desplegable:
           permite seleccionar varios servicios.
        */
    });

    priceInput.addEventListener("input", () => {
        customPrice = true;
        updateSummary();
    });

    /* =====================================================
       API COMPATIBLE CON ADMIN.JS
    ===================================================== */

    function setSelected(
        ids,
        price = null,
        preserveCustomPrice = false
    ) {
        const requested = Array.isArray(ids)
            ? ids.map(String)
            : [String(ids || "")];

        const validIds = new Set(
            getActiveServices().map(
                service => String(service.id)
            )
        );

        selectedIds = [...new Set(requested)].filter(
            id => validIds.has(id)
        );

        customPrice =
            preserveCustomPrice &&
            price !== null &&
            price !== undefined;

        renderOptions();

        if (customPrice) {
            priceInput.value = String(price);
            updateSummary();
        }

        notifyChange();
    }

    function reset() {
        const first = getActiveServices()[0];

        setSelected(
            first ? [first.id] : []
        );

        setExpanded(false);
    }

    function refresh() {
        renderOptions();
        notifyChange();
    }

    function getValues() {
        return {
            serviceIds: [...selectedIds],
            serviceId: selectedIds[0] || "",
            duration: getDuration(),
            originalPrice: getNormalPrice(),
            price: getPrice(),
            customPrice
        };
    }

    /* =====================================================
       INICIALIZACIÓN SEGURA
    ===================================================== */

    /*
       No ejecutar reset() aquí:
       dispararía onChange antes de que
       admin.js reciba el objeto picker.
    */

    const firstService = getActiveServices()[0];

    selectedIds = firstService
        ? [String(firstService.id)]
        : [];

    customPrice = false;

    renderOptions();
    setExpanded(false);

    return {
        reset,
        refresh,
        setSelected,
        getValues,
        getSelectedServices
    };
}
