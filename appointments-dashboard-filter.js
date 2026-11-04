
/* =========================================================
   AGENDAPRO
   FILTROS DESDE EL DASHBOARD

   Archivo: js/appointments-dashboard-filter.js

   Función:
   - Detecta ?filter=completed
   - Activa el filtro Completadas
   - Conserva el calendario y los estilos existentes
   - No modifica citas ni datos guardados
========================================================= */

(() => {
    "use strict";

    const params = new URLSearchParams(window.location.search);
    const requestedFilter = params.get("filter");

    if (requestedFilter !== "completed") {
        return;
    }

    let applied = false;

    function findCompletedButton() {
        return document.querySelector(
            '.filter[data-filter="completed"]'
        );
    }

    function activateCompletedFilter() {
        if (applied) {
            return true;
        }

        const button = findCompletedButton();

        if (!button) {
            return false;
        }

        applied = true;

        // Utiliza el mismo evento que al pulsar
        // manualmente el filtro Completadas.
        button.click();

        // Asegura que el botón correcto se vea activo.
        document.querySelectorAll(".filter").forEach(
            filterButton => {
                const isActive =
                    filterButton.dataset.filter === "completed";

                filterButton.classList.toggle(
                    "active",
                    isActive
                );

                filterButton.setAttribute(
                    "aria-pressed",
                    String(isActive)
                );
            }
        );

        return true;
    }

    // Esperamos a que los módulos originales de citas
    // terminen de configurar sus eventos.
    if (document.readyState === "complete") {
        activateCompletedFilter();
    } else {
        window.addEventListener(
            "load",
            activateCompletedFilter,
            { once: true }
        );
    }
})();
