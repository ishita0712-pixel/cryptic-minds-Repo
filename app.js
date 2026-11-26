(function (global) {
  "use strict";

  var MediBed = (global.MediBed = global.MediBed || {});
  var Utils = MediBed.Utils;
  var Data = MediBed.Data;

  function showToast(message, isError) {
    var container = document.getElementById("toastContainer");
    if (!container) return;

    var toast = document.createElement("div");
    toast.className = "toast" + (isError ? " toast-error" : "");
    toast.textContent = message;
    container.appendChild(toast);

    global.setTimeout(function () {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 3400);
  }

  function switchView(viewName) {
    var validViews = ["home", "search", "dashboard"];
    var target = validViews.indexOf(viewName) !== -1 ? viewName : "home";

    validViews.forEach(function (name) {
      var section = document.getElementById("view-" + name);
      if (section) {
        var active = name === target;
        section.hidden = !active;
        section.classList.toggle("active", active);
      }
    });

    document.querySelectorAll(".nav-btn[data-nav]").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-nav") === target);
    });

    if (target === "search" && MediBed.Patient) {
      MediBed.Patient.populateCitySelect();
      MediBed.Patient.renderResults();
    } else if (target === "dashboard" && MediBed.Hospital) {
      MediBed.Hospital.refresh();
    } else if (target === "home") {
      renderHomeSummary();
    }
  }

  function renderHomeSummary() {
    var container = document.getElementById("homeSummaryCards");
    if (!container) return;

    var nowMs = Date.now();
    var hospitals = Data.loadHospitals();
    var holds = Data.loadHolds(nowMs);

    var totalIcu = 0;
    var totalOxygen = 0;
    var totalGeneral = 0;
    var staleCount = 0;

    hospitals.forEach(function (h) {
      totalIcu += Data.getEffectiveBedCount(h, "icu", holds);
      totalOxygen += Data.getEffectiveBedCount(h, "oxygen", holds);
      totalGeneral += Data.getEffectiveBedCount(h, "general", holds);
      if (Utils.isStale(h.lastUpdated, nowMs)) {
        staleCount += 1;
      }
    });

    container.innerHTML =
      '<div class="stat-card">' +
      '  <div class="stat-card-label">Demo Hospitals Listed</div>' +
      '  <div class="stat-card-value">' + hospitals.length + "</div>" +
      "</div>" +
      '<div class="stat-card stat-card-teal">' +
      '  <div class="stat-card-label">Demo ICU Beds</div>' +
      '  <div class="stat-card-value">' + totalIcu + "</div>" +
      "</div>" +
      '<div class="stat-card">' +
      '  <div class="stat-card-label">Demo Oxygen / General</div>' +
      '  <div class="stat-card-value">' + totalOxygen + " / " + totalGeneral + "</div>" +
      "</div>" +
      '<div class="stat-card stat-card-amber">' +
      '  <div class="stat-card-label">Stale Warnings (&gt;24h)</div>' +
      '  <div class="stat-card-value">' + staleCount + "</div>" +
      "</div>";
  }

  function handleResetDemo() {
    Data.resetDemoData();
    renderHomeSummary();
    if (MediBed.Patient) {
      MediBed.Patient.populateCitySelect();
      MediBed.Patient.renderResults();
    }
    if (MediBed.Hospital) {
      MediBed.Hospital.refresh();
    }
    showToast("Demo hospitals and holds were reset to initial sample data.");
  }

  function syncFromStorageEvent(event) {
    if (event.key !== Data.HOSPITALS_KEY && event.key !== Data.HOLDS_KEY) {
      return;
    }
    renderHomeSummary();
    if (MediBed.Patient) {
      MediBed.Patient.populateCitySelect();
      MediBed.Patient.renderResults();
    }
    if (MediBed.Hospital) {
      MediBed.Hospital.refresh();
    }
  }

  function init() {
    document.addEventListener("click", function (event) {
      var navTrigger = event.target.closest("[data-nav]");
      if (navTrigger) {
        event.preventDefault();
        switchView(navTrigger.getAttribute("data-nav"));
      }
    });

    var resetBtn = document.getElementById("resetDemoBtn");
    if (resetBtn) {
      resetBtn.addEventListener("click", handleResetDemo);
    }

    global.addEventListener("storage", syncFromStorageEvent);

    MediBed.Patient && MediBed.Patient.init();
    MediBed.Hospital && MediBed.Hospital.init();
    renderHomeSummary();
    switchView("home");
  }

  MediBed.App = {
    init: init,
    switchView: switchView,
    renderHomeSummary: renderHomeSummary,
    showToast: showToast
  };

  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", init);
  }
})(typeof window !== "undefined" ? window : globalThis);
