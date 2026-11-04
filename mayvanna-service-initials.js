
(() => {
  "use strict";

  const grid = document.getElementById("servicesGrid");
  const modalAvatar = document.getElementById("serviceModalAvatar");
  const nameInput = document.getElementById("serviceName");
  const modal = document.getElementById("serviceModal");

  if (!grid || !modalAvatar || !nameInput || !modal) {
    return;
  }

  function getInitial(name) {
    const value = String(name || "").trim();

    if (!value) {
      return "S";
    }

    return Array.from(value)[0].toLocaleUpperCase("es");
  }

  function updateCardInitials() {
    const cards = grid.querySelectorAll(".unified-card");

    cards.forEach(card => {
      const title = card.querySelector(".unified-card-title h3");
      const avatar = card.querySelector(".unified-card-avatar");

      if (!title || !avatar) {
        return;
      }

      const initial = getInitial(title.textContent);

      if (avatar.textContent.trim() !== initial) {
        avatar.textContent = initial;
      }

      avatar.setAttribute("aria-hidden", "true");
    });
  }

  function updateModalInitial() {
    const initial = getInitial(nameInput.value);

    if (modalAvatar.textContent.trim() !== initial) {
      modalAvatar.textContent = initial;
    }
  }

  // Actualiza las tarjetas cuando services.js las genera.
  const gridObserver = new MutationObserver(updateCardInitials);

  gridObserver.observe(grid, {
    childList: true,
    subtree: true
  });

  // Actualiza la inicial mientras se escribe el nombre.
  nameInput.addEventListener("input", updateModalInitial);

  // Actualiza al abrir un servicio existente o uno nuevo.
  const modalObserver = new MutationObserver(updateModalInitial);

  modalObserver.observe(modal, {
    attributes: true,
    attributeFilter: ["class"]
  });

  // Aplicar a los elementos ya presentes.
  updateCardInitials();
  updateModalInitial();
})();
