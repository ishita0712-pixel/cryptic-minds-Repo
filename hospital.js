(function (global) {
  "use strict";

  var MediBed = (global.MediBed = global.MediBed || {});
  var Utils = MediBed.Utils;
  var Data = MediBed.Data;

  function getElements() {
    return {
      selectHospital: document.getElementById("selectHospital"),
      updateForm: document.getElementById("updateHospitalForm"),
      updateName: document.getElementById("updateName"),
      updateCity: document.getElementById("updateCity"),
      updateContact: document.getElementById("updateContact"),
      updateIcu: document.getElementById("updateIcu"),
      updateOxygen: document.getElementById("updateOxygen"),
      updateGeneral: document.getElementById("updateGeneral"),
      updateFormError: document.getElementById("updateFormError"),
      updateCurrentMeta: document.getElementById("updateCurrentMeta"),

      addForm: document.getElementById("addHospitalForm"),
      addName: document.getElementById("addName"),
      addCity: document.getElementById("addCity"),
      addContact: document.getElementById("addContact"),
      addIcu: document.getElementById("addIcu"),
      addOxygen: document.getElementById("addOxygen"),
      addGeneral: document.getElementById("addGeneral"),
      addFormError: document.getElementById("addFormError"),

      tableBody: document.getElementById("dashboardTableBody")
    };
  }

  function showError(el, message) {
    if (!el) return;
    if (message) {
      el.textContent = message;
      el.hidden = false;
    } else {
      el.textContent = "";
      el.hidden = true;
    }
  }

  function populateUpdateForm(hospitalId) {
    var els = getElements();
    var hospitals = Data.loadHospitals();
    var hospital =
      hospitals.find(function (h) {
        return h.id === hospitalId;
      }) || hospitals[0];

    if (!hospital) return;

    if (els.selectHospital) els.selectHospital.value = hospital.id;
    if (els.updateName) els.updateName.value = hospital.name;
    if (els.updateCity) els.updateCity.value = hospital.city;
    if (els.updateContact) els.updateContact.value = hospital.contact;
    if (els.updateIcu) els.updateIcu.value = hospital.icu;
    if (els.updateOxygen) els.updateOxygen.value = hospital.oxygen;
    if (els.updateGeneral) els.updateGeneral.value = hospital.general;

    if (els.updateCurrentMeta) {
      var staleText = Utils.isStale(hospital.lastUpdated) ? " • Currently STALE (>24h)" : " • Fresh";
      els.updateCurrentMeta.textContent =
        "Last recorded update: " +
        Utils.formatDateTime(hospital.lastUpdated) +
        " (" +
        Utils.formatRelativeTime(hospital.lastUpdated) +
        ")" +
        staleText;
    }

    showError(els.updateFormError, "");
  }

  function populateHospitalDropdown(preferredId) {
    var els = getElements();
    if (!els.selectHospital) return;

    var hospitals = Data.loadHospitals();
    var currentId = preferredId || els.selectHospital.value;

    els.selectHospital.innerHTML = hospitals
      .map(function (h) {
        return (
          '<option value="' + Utils.escapeHtml(h.id) + '">' +
          Utils.escapeHtml(h.name) + " (" + Utils.escapeHtml(h.city) + ")" +
          "</option>"
        );
      })
      .join("");

    var exists = hospitals.some(function (h) {
      return h.id === currentId;
    });
    var chosenId = exists ? currentId : hospitals[0] && hospitals[0].id;
    if (chosenId) {
      populateUpdateForm(chosenId);
    }
  }

  function renderInventoryTable() {
    var els = getElements();
    if (!els.tableBody) return;

    var nowMs = Date.now();
    var hospitals = Data.loadHospitals();

    els.tableBody.innerHTML = hospitals
      .map(function (h) {
        var stale = Utils.isStale(h.lastUpdated, nowMs);
        var badge = stale
          ? '<span class="status-pill status-stale">STALE</span>'
          : '<span class="status-pill status-fresh">Fresh</span>';

        return (
          "<tr>" +
          "  <td><strong>" + Utils.escapeHtml(h.name) + '</strong> <span class="demo-tag">DEMO</span></td>' +
          "  <td>" + Utils.escapeHtml(h.city) + "</td>" +
          "  <td>" + Utils.escapeHtml(h.contact) + "</td>" +
          "  <td><strong>" + Number(h.icu) + "</strong></td>" +
          "  <td><strong>" + Number(h.oxygen) + "</strong></td>" +
          "  <td><strong>" + Number(h.general) + "</strong></td>" +
          "  <td>" + Utils.escapeHtml(Utils.formatDateTime(h.lastUpdated)) + " " + badge + "</td>" +
          '  <td><button type="button" class="btn btn-outline btn-sm" data-edit-hospital="' +
          Utils.escapeHtml(h.id) +
          '">Edit</button></td>' +
          "</tr>"
        );
      })
      .join("");
  }

  function handleUpdateSubmit(event) {
    event.preventDefault();
    var els = getElements();
    var selectedId = els.selectHospital ? els.selectHospital.value : "";

    var result = Data.updateHospital(selectedId, {
      name: els.updateName ? els.updateName.value : "",
      city: els.updateCity ? els.updateCity.value : "",
      contact: els.updateContact ? els.updateContact.value : "",
      icu: els.updateIcu ? els.updateIcu.value : "",
      oxygen: els.updateOxygen ? els.updateOxygen.value : "",
      general: els.updateGeneral ? els.updateGeneral.value : ""
    });

    if (!result.ok) {
      showError(els.updateFormError, result.error);
      return;
    }

    showError(els.updateFormError, "");
    refresh(result.hospital.id);
    MediBed.Patient && MediBed.Patient.populateCitySelect();
    MediBed.Patient && MediBed.Patient.renderResults();
    MediBed.App && MediBed.App.renderHomeSummary();
    MediBed.App &&
      MediBed.App.showToast("Updated bed counts for " + result.hospital.name + " with a fresh timestamp.");
  }

  function handleAddSubmit(event) {
    event.preventDefault();
    var els = getElements();

    var result = Data.addHospital({
      name: els.addName ? els.addName.value : "",
      city: els.addCity ? els.addCity.value : "",
      contact: els.addContact ? els.addContact.value : "",
      icu: els.addIcu ? els.addIcu.value : "",
      oxygen: els.addOxygen ? els.addOxygen.value : "",
      general: els.addGeneral ? els.addGeneral.value : ""
    });

    if (!result.ok) {
      showError(els.addFormError, result.error);
      return;
    }

    showError(els.addFormError, "");
    if (els.addForm) els.addForm.reset();
    if (els.addIcu) els.addIcu.value = "0";
    if (els.addOxygen) els.addOxygen.value = "0";
    if (els.addGeneral) els.addGeneral.value = "0";

    refresh(result.hospital.id);
    MediBed.Patient && MediBed.Patient.populateCitySelect();
    MediBed.Patient && MediBed.Patient.renderResults();
    MediBed.App && MediBed.App.renderHomeSummary();
    MediBed.App &&
      MediBed.App.showToast("Added " + result.hospital.name + " (" + result.hospital.city + ") to MediBed.");
  }

  function handleTableClick(event) {
    var btn = event.target.closest("button[data-edit-hospital]");
    if (!btn) return;
    var hospitalId = btn.getAttribute("data-edit-hospital");
    populateUpdateForm(hospitalId);
    var els = getElements();
    if (els.updateForm) {
      els.updateForm.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function refresh(preferredId) {
    populateHospitalDropdown(preferredId);
    renderInventoryTable();
  }

  function init() {
    var els = getElements();
    refresh();

    if (els.selectHospital) {
      els.selectHospital.addEventListener("change", function () {
        populateUpdateForm(els.selectHospital.value);
      });
    }
    if (els.updateForm) {
      els.updateForm.addEventListener("submit", handleUpdateSubmit);
    }
    if (els.addForm) {
      els.addForm.addEventListener("submit", handleAddSubmit);
    }
    if (els.tableBody) {
      els.tableBody.addEventListener("click", handleTableClick);
    }
  }

  MediBed.Hospital = {
    init: init,
    refresh: refresh
  };
})(typeof window !== "undefined" ? window : globalThis);
