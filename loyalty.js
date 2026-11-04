
/* =========================================================
   AGENDAPRO — FIDELIDAD
   Archivo: js/loyalty.js

   - 5 visitas por recompensa
   - Círculos de progreso
   - Recompensas acumulables
   - Registro manual de visitas
   - Búsqueda de clientes
   - Filtros
   - Modal de detalles
   - Sin Firebase
========================================================= */

import {
    getCustomers,
    saveCustomers,
    normalizePhone
} from "./storage.js";

const VISITS_REQUIRED = 5;

let currentFilter = "all";
let searchTerm = "";
let selectedCustomerId = null;
let toastTimer = null;

const $ = id => document.getElementById(id);

const loyaltySummary = $("loyaltySummary");
const loyaltyGrid = $("loyaltyGrid");
const loyaltySearch = $("loyaltySearch");
const loyaltyResultCount = $("loyaltyResultCount");

const loyaltyModal = $("loyaltyModal");
const visitModal = $("visitModal");

const loyaltyModalAvatar = $("loyaltyModalAvatar");
const loyaltyModalName = $("loyaltyModalName");
const loyaltyModalPhone = $("loyaltyModalPhone");
const loyaltyRewardStatus = $("loyaltyRewardStatus");

const loyaltyModalStamps = $("loyaltyModalStamps");
const loyaltyModalProgress = $("loyaltyModalProgress");
const loyaltyModalDescription = $("loyaltyModalDescription");

const loyaltyModalVisits = $("loyaltyModalVisits");
const loyaltyModalEarned = $("loyaltyModalEarned");
const loyaltyModalRedeemed = $("loyaltyModalRedeemed");

const redeemRewardButton = $("redeemRewardButton");
const addVisitModalButton = $("addVisitModalButton");
const registerVisitButton = $("registerVisitButton");

const visitCustomerSearch = $("visitCustomerSearch");
const visitCustomerResults = $("visitCustomerResults");

/* =========================================================
   UTILIDADES
========================================================= */

function escapeHTML(value) {
    const element = document.createElement("div");
    element.textContent = String(value ?? "");
    return element.innerHTML;
}

function getInitials(name) {
    return String(name || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(word => word.charAt(0))
        .join("")
        .toUpperCase() || "?";
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

function unlockBody() {
    if (
        loyaltyModal.classList.contains("hidden") &&
        visitModal.classList.contains("hidden")
    ) {
        document.body.classList.remove("modal-open");
    }
}

/* =========================================================
   MIGRACIÓN DE DATOS EXISTENTES
========================================================= */

function migrateCustomers() {
    const customers = getCustomers();
    let changed = false;

    const migrated = customers.map(customer => {
        const next = { ...customer };

        if (
            !Number.isFinite(
                Number(next.rewardsRedeemed)
            )
        ) {
            next.rewardsRedeemed = 0;
            changed = true;
        } else if (
            typeof next.rewardsRedeemed !== "number"
        ) {
            next.rewardsRedeemed = Number(
                next.rewardsRedeemed
            );
            changed = true;
        }

        return next;
    });

    if (changed) {
        saveCustomers(migrated);
    }
}

/* =========================================================
   CÁLCULO DE FIDELIDAD
========================================================= */

function getLoyaltyData(customer) {
    const visits = Math.max(
        0,
        Math.floor(Number(customer.visits) || 0)
    );

    const redeemed = Math.max(
        0,
        Math.floor(Number(customer.rewardsRedeemed) || 0)
    );

    const totalRewardsEarned = Math.floor(
        visits / VISITS_REQUIRED
    );

    const availableRewards = Math.max(
        0,
        totalRewardsEarned - redeemed
    );

    let progress = visits % VISITS_REQUIRED;

    // Mostrar los cinco círculos completos cuando
    // existe una recompensa pendiente de canjear.
    if (availableRewards > 0 && progress === 0) {
        progress = VISITS_REQUIRED;
    }

    const remaining =
        progress === VISITS_REQUIRED
            ? 0
            : VISITS_REQUIRED - progress;

    return {
        visits,
        redeemed,
        totalRewardsEarned,
        availableRewards,
        progress,
        remaining
    };
}

/* =========================================================
   CÍRCULOS DE FIDELIDAD
========================================================= */

function renderCircles(progress, large = false) {
    const completed = Math.max(
        0,
        Math.min(
            VISITS_REQUIRED,
            Math.floor(Number(progress) || 0)
        )
    );

    const className = large
        ? "loyalty-stamp"
        : "simple-loyalty-stamp";

    return Array.from(
        { length: VISITS_REQUIRED },
        (_, index) => {
            const active = index < completed;

            return `
                <span
                    class="${className} ${active ? "active" : "empty"}"
                    role="img"
                    aria-label="${
                        active
                            ? `Visita ${index + 1} registrada`
                            : `Visita ${index + 1} pendiente`
                    }"
                ></span>
            `;
        }
    ).join("");
}

function renderStamps(progress) {
    return renderCircles(progress, false);
}

function renderLargeStamps(progress) {
    return renderCircles(progress, true);
}

/* =========================================================
   RESUMEN
========================================================= */

function renderSummary() {
    const customers = getCustomers();

    const visits = customers.reduce(
        (total, customer) =>
            total + (Number(customer.visits) || 0),
        0
    );

    const available = customers.reduce(
        (total, customer) =>
            total + getLoyaltyData(customer).availableRewards,
        0
    );

    const redeemed = customers.reduce(
        (total, customer) =>
            total + (Number(customer.rewardsRedeemed) || 0),
        0
    );

    loyaltySummary.innerHTML = `
        <div class="module-summary-item">
            <strong>${customers.length}</strong>
            <span>Clientes</span>
        </div>

        <div class="module-summary-divider"></div>

        <div class="module-summary-item">
            <strong>${visits}</strong>
            <span>Visitas</span>
        </div>

        <div class="module-summary-divider"></div>

        <div class="module-summary-item">
            <strong>${available}</strong>
            <span>Recompensas disponibles</span>
        </div>

        <div class="module-summary-divider"></div>

        <div class="module-summary-item">
            <strong>${redeemed}</strong>
            <span>Canjeadas</span>
        </div>
    `;
}

/* =========================================================
   BÚSQUEDA Y FILTROS
========================================================= */

function matchesSearch(customer) {
    if (!searchTerm) return true;

    const name = String(customer.name || "")
        .toLowerCase();

    const phone = normalizePhone(customer.phone || "");
    const searchedPhone = normalizePhone(searchTerm);

    return (
        name.includes(searchTerm) ||
        (
            searchedPhone &&
            phone.includes(searchedPhone)
        )
    );
}

function matchesFilter(customer) {
    const rewards =
        getLoyaltyData(customer).availableRewards;

    if (currentFilter === "reward") {
        return rewards > 0;
    }

    if (currentFilter === "progress") {
        return rewards === 0;
    }

    return true;
}

function sortCustomers(a, b) {
    const rewardsA =
        getLoyaltyData(a).availableRewards;

    const rewardsB =
        getLoyaltyData(b).availableRewards;

    if (rewardsA !== rewardsB) {
        return rewardsB - rewardsA;
    }

    return (
        (Number(b.visits) || 0) -
        (Number(a.visits) || 0)
    );
}

/* =========================================================
   TARJETAS DE CLIENTES
========================================================= */

function createCustomerCard(customer) {
    const loyalty = getLoyaltyData(customer);
    const hasReward = loyalty.availableRewards > 0;

    const rewardText = hasReward
        ? `${loyalty.availableRewards} ${
            loyalty.availableRewards === 1
                ? "recompensa disponible"
                : "recompensas disponibles"
        }`
        : `Faltan ${loyalty.remaining} ${
            loyalty.remaining === 1
                ? "visita"
                : "visitas"
        }`;

    return `
        <article class="unified-card">

            <div class="unified-card-header">

                <div class="unified-card-person">

                    <div class="unified-card-avatar">
                        ${escapeHTML(
                            getInitials(customer.name)
                        )}
                    </div>

                    <div class="unified-card-title">
                        <h3>
                            ${escapeHTML(customer.name)}
                        </h3>
                        <span>Cliente</span>
                    </div>

                </div>

                <div class="unified-status ${
                    hasReward ? "reward" : "progress"
                }">
                    <span></span>
                    ${
                        hasReward
                            ? "Recompensa"
                            : "En progreso"
                    }
                </div>

            </div>

            <div class="unified-card-metrics">

                <div>
                    <span>Visitas</span>
                    <strong>${loyalty.visits}</strong>
                </div>

                <div>
                    <span>Progreso</span>
                    <strong>
                        ${loyalty.progress}/${VISITS_REQUIRED}
                    </strong>
                </div>

            </div>

            <div class="unified-card-detail">

                <span>Fidelidad</span>

                <div class="simple-loyalty-stamps">
                    ${renderStamps(loyalty.progress)}
                </div>

                <small>${rewardText}</small>

            </div>

            <div class="unified-card-footer">

                <span>
                    ${escapeHTML(
                        customer.phone || "Sin teléfono"
                    )}
                </span>

                <button
                    type="button"
                    class="modern-edit-button"
                    data-action="view"
                    data-id="${escapeHTML(customer.id)}"
                >
                    Ver cliente
                    <span>→</span>
                </button>

            </div>

        </article>
    `;
}

function renderCustomers() {
    const customers = getCustomers()
        .filter(matchesSearch)
        .filter(matchesFilter)
        .sort(sortCustomers);

    loyaltyResultCount.textContent =
        `${customers.length} ${
            customers.length === 1
                ? "cliente"
                : "clientes"
        }`;

    if (!customers.length) {
        loyaltyGrid.innerHTML = `
            <div class="module-empty-state">
                <div class="module-empty-icon">★</div>
                <strong>No hay resultados</strong>
                <p>
                    No encontramos clientes con estos filtros.
                </p>
            </div>
        `;

        return;
    }

    loyaltyGrid.innerHTML = customers
        .map(createCustomerCard)
        .join("");
}

function renderAll() {
    renderSummary();
    renderCustomers();
}

/* =========================================================
   MODAL DE CLIENTE
========================================================= */

function renderCustomerModal(customer) {
    const loyalty = getLoyaltyData(customer);

    loyaltyModalAvatar.textContent =
        getInitials(customer.name);

    loyaltyModalName.textContent =
        customer.name || "Cliente";

    loyaltyModalPhone.textContent =
        customer.phone || "Sin teléfono";

    loyaltyModalVisits.textContent =
        loyalty.visits;

    loyaltyModalEarned.textContent =
        loyalty.totalRewardsEarned;

    loyaltyModalRedeemed.textContent =
        loyalty.redeemed;

    loyaltyModalStamps.innerHTML =
        renderLargeStamps(loyalty.progress);

    loyaltyModalProgress.style.width =
        `${(loyalty.progress / VISITS_REQUIRED) * 100}%`;

    if (loyalty.availableRewards > 0) {
        loyaltyRewardStatus.className =
            "unified-status reward";

        loyaltyRewardStatus.innerHTML =
            "<span></span> Recompensa";

        loyaltyModalDescription.textContent =
            "El cliente tiene una recompensa disponible.";

        redeemRewardButton.disabled = false;
    } else {
        loyaltyRewardStatus.className =
            "unified-status progress";

        loyaltyRewardStatus.innerHTML =
            "<span></span> En progreso";

        loyaltyModalDescription.textContent =
            `${loyalty.progress}/${VISITS_REQUIRED} visitas · Faltan ${loyalty.remaining}.`;

        redeemRewardButton.disabled = true;
    }
}

function openCustomerLoyalty(customerId) {
    const customer = getCustomers().find(
        item => String(item.id) === String(customerId)
    );

    if (!customer) {
        showToast("No se encontró el cliente.");
        return;
    }

    selectedCustomerId = customer.id;

    renderCustomerModal(customer);

    loyaltyModal.classList.remove("hidden");
    document.body.classList.add("modal-open");
}

function closeLoyaltyModal() {
    loyaltyModal.classList.add("hidden");
    selectedCustomerId = null;
    unlockBody();
}

function handleGridAction(event) {
    const button = event.target.closest("[data-action]");

    if (!button) return;

    if (button.dataset.action === "view") {
        openCustomerLoyalty(button.dataset.id);
    }
}

/* =========================================================
   REGISTRAR VISITAS
========================================================= */

function registerCustomerVisit(customerId) {
    const customers = getCustomers();

    const customer = customers.find(
        item => String(item.id) === String(customerId)
    );

    if (!customer) {
        showToast("No se encontró el cliente.");
        return false;
    }

    customer.visits =
        Math.max(0, Number(customer.visits) || 0) + 1;

    saveCustomers(customers);
    renderAll();

    showToast(
        `Visita registrada para ${customer.name}.`
    );

    return true;
}

function registerSelectedCustomerVisit() {
    if (!selectedCustomerId) return;

    const id = selectedCustomerId;

    if (!registerCustomerVisit(id)) return;

    const customer = getCustomers().find(
        item => String(item.id) === String(id)
    );

    if (customer) {
        renderCustomerModal(customer);
    }
}

/* =========================================================
   CANJEAR RECOMPENSA
========================================================= */

function redeemSelectedReward() {
    if (!selectedCustomerId) return;

    const customers = getCustomers();

    const customer = customers.find(
        item =>
            String(item.id) ===
            String(selectedCustomerId)
    );

    if (!customer) {
        showToast("No se encontró el cliente.");
        return;
    }

    const loyalty = getLoyaltyData(customer);

    if (loyalty.availableRewards <= 0) {
        showToast(
            "No hay una recompensa disponible."
        );
        return;
    }

    customer.rewardsRedeemed =
        (Number(customer.rewardsRedeemed) || 0) + 1;

    saveCustomers(customers);

    renderAll();
    renderCustomerModal(customer);

    showToast(
        "Recompensa canjeada correctamente."
    );
}

/* =========================================================
   MODAL DE REGISTRO DE VISITAS
========================================================= */

function renderVisitCustomerResults() {
    const search = visitCustomerSearch.value
        .trim()
        .toLowerCase();

    const normalized = normalizePhone(search);

    const customers = getCustomers()
        .filter(customer => {
            if (!search) return true;

            const name = String(customer.name || "")
                .toLowerCase();

            const phone = normalizePhone(
                customer.phone || ""
            );

            return (
                name.includes(search) ||
                (
                    normalized &&
                    phone.includes(normalized)
                )
            );
        })
        .slice(0, 6);

    if (!customers.length) {
        visitCustomerResults.innerHTML = `
            <div class="simple-result-empty">
                No se encontraron clientes.
            </div>
        `;
        return;
    }

    visitCustomerResults.innerHTML = customers
        .map(customer => {
            const loyalty = getLoyaltyData(customer);

            return `
                <button
                    type="button"
                    class="simple-customer-result"
                    data-customer-id="${escapeHTML(customer.id)}"
                >

                    <div class="simple-result-avatar">
                        ${escapeHTML(
                            getInitials(customer.name)
                        )}
                    </div>

                    <div>
                        <strong>
                            ${escapeHTML(customer.name)}
                        </strong>

                        <span>
                            ${escapeHTML(
                                customer.phone || "Sin teléfono"
                            )}
                        </span>
                    </div>

                    <small>
                        ${loyalty.progress}/${VISITS_REQUIRED}
                    </small>

                </button>
            `;
        })
        .join("");
}

function handleVisitCustomerResult(event) {
    const button = event.target.closest(
        "[data-customer-id]"
    );

    if (!button) return;

    const registered = registerCustomerVisit(
        button.dataset.customerId
    );

    if (registered) {
        closeVisitModal();
    }
}

function openVisitModal() {
    visitCustomerSearch.value = "";

    renderVisitCustomerResults();

    visitModal.classList.remove("hidden");
    document.body.classList.add("modal-open");

    setTimeout(() => {
        visitCustomerSearch.focus();
    }, 50);
}

function closeVisitModal() {
    visitModal.classList.add("hidden");
    unlockBody();
}

/* =========================================================
   EVENTOS
========================================================= */

function configureEvents() {
    loyaltySearch.addEventListener("input", event => {
        searchTerm = event.target.value
            .trim()
            .toLowerCase();

        renderCustomers();
    });

    document
        .querySelectorAll(".module-filters .filter")
        .forEach(button => {
            button.addEventListener("click", () => {
                document
                    .querySelectorAll(".module-filters .filter")
                    .forEach(item => {
                        item.classList.remove("active");
                    });

                button.classList.add("active");

                currentFilter =
                    button.dataset.filter || "all";

                renderCustomers();
            });
        });

    loyaltyGrid.addEventListener(
        "click",
        handleGridAction
    );

    registerVisitButton.addEventListener(
        "click",
        openVisitModal
    );

    $("closeLoyaltyModal").addEventListener(
        "click",
        closeLoyaltyModal
    );

    $("closeVisitModal").addEventListener(
        "click",
        closeVisitModal
    );

    $("cancelVisitButton").addEventListener(
        "click",
        closeVisitModal
    );

    addVisitModalButton.addEventListener(
        "click",
        registerSelectedCustomerVisit
    );

    redeemRewardButton.addEventListener(
        "click",
        redeemSelectedReward
    );

    visitCustomerSearch.addEventListener(
        "input",
        renderVisitCustomerResults
    );

    visitCustomerResults.addEventListener(
        "click",
        handleVisitCustomerResult
    );

    loyaltyModal.addEventListener("click", event => {
        if (event.target === loyaltyModal) {
            closeLoyaltyModal();
        }
    });

    visitModal.addEventListener("click", event => {
        if (event.target === visitModal) {
            closeVisitModal();
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key !== "Escape") return;

        if (!visitModal.classList.contains("hidden")) {
            closeVisitModal();
            return;
        }

        if (!loyaltyModal.classList.contains("hidden")) {
            closeLoyaltyModal();
        }
    });

    // Actualización al modificar clientes
    // desde otra pestaña del navegador.
    window.addEventListener("storage", event => {
        if (event.key !== "barbershop_customers") {
            return;
        }

        renderAll();

        if (
            selectedCustomerId &&
            !loyaltyModal.classList.contains("hidden")
        ) {
            const customer = getCustomers().find(
                item =>
                    String(item.id) ===
                    String(selectedCustomerId)
            );

            if (customer) {
                renderCustomerModal(customer);
            } else {
                closeLoyaltyModal();
            }
        }

        if (!visitModal.classList.contains("hidden")) {
            renderVisitCustomerResults();
        }
    });
}

/* =========================================================
   INICIO
========================================================= */

function initialize() {
    migrateCustomers();
    configureEvents();
    renderAll();
}

initialize();
