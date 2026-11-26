(function (global) {
  "use strict";

  var MediBed = (global.MediBed = global.MediBed || {});
  var Utils = MediBed.Utils;
  var Data = MediBed.Data;

  var BED_TYPES = [
    { key: "icu", label: "ICU" },
    { key: "oxygen", label: "Oxygen" },
    { key: "general", label: "General" }
  ];

  var tabId = Utils.getTabId();
  var countdownTimerId = null;

  function getElements() {
    return {
      citySearchInput: document.getElementById("citySearchInput"),
      citySelect: document.getElementById("citySelect"),
      bedTypeFilter: document.getElementById("bedTypeFilter"),
      clearFiltersBtn: document.getElementById("clearFiltersBtn"),
      emptyClearFiltersBtn: document.getElementById("emptyClearFiltersBtn"),
      resultsCount: document.getElementById("searchResultsCount"),
      activeHoldSummary: document.getElementById("activeHoldSummary"),
      resultsGrid: document.getElementById("hospitalResultsGrid"),
      noResultsMessage: document.getElementById("noResultsMessage")
    };
  }

  function populateCitySelect() {
    var els = getElements();
    if (!els.citySelect) return;

    var currentValue = els.citySelect.value || "all";
    var hospitals = Data.loadHospitals();
    var cityMap = {};
    hospitals.forEach(function (h) {
      var trimmed = String(h.city || "").trim();
      if (trimmed) {
        cityMap[trimmed.toLowerCase()] = trimmed;
      }
    });

    var cities = Object.values(cityMap).sort(function (a, b) {
      return a.localeCompare(b);
    });

    var optionsHtml = '<option value="all">All Cities</option>';
    cities.forEach(function (city) {
      optionsHtml +=
        '<option value="' + Utils.escapeHtml(city.toLowerCase()) + '">' +
        Utils.escapeHtml(city) +
        "</option>";
    });

    els.citySelect.innerHTML = optionsHtml;
    var hasCurrent = cities.some(function (c) {
      return c.toLowerCase() === currentValue;
    });
    els.citySelect.value = hasCurrent ? currentValue : "all";
  }

  function getFilteredHospitals(hospitals, holds) {
    var els = getElements();
    var query = String((els.citySearchInput && els.citySearchInput.value) || "")
      .trim()
      .toLowerCase();
    var selectedCity = (els.citySelect && els.citySelect.value) || "all";
    var bedFilter = (els.bedTypeFilter && els.bedTypeFilter.value) || "all";

    return hospitals.filter(function (hospital) {
      var cityLower = String(hospital.city || "").toLowerCase();
      var nameLower = String(hospital.name || "").toLowerCase();

      if (query && cityLower.indexOf(query) === -1 && nameLower.indexOf(query) === -1) {
        return false;
      }

      if (selectedCity !== "all" && cityLower !== selectedCity) {
        return false;
      }

      if (bedFilter !== "all") {
        var effectiveCount = Data.getEffectiveBedCount(hospital, bedFilter, holds);
        if (effectiveCount <= 0) {
          return false;
        }
      }

      return true;
    });
  }

  function renderBedBox(hospital, bedInfo, holds, bedFilter, nowMs) {
    var effectiveCount = Data.getEffectiveBedCount(hospital, bedInfo.key, holds);
    var status = Utils.getAvailabilityStatus(effectiveCount);
    var holdKey = Data.getHoldKey(hospital.id, bedInfo.key);
    var hold = holds[holdKey];
    var isHighlighted = bedFilter === bedInfo.key;

    var holdHtml = "";
    if (hold) {
      var remainingText = Utils.formatCountdown(hold.expiresAt - nowMs);
      if (hold.ownerTabId === tabId) {
        holdHtml =
          '<div class="hold-box">' +
          '  <div class="hold-active-banner" data-hold-countdown="' + Utils.escapeHtml(holdKey) + '">' +
          "    Demo Hold: " + remainingText +
          "  </div>" +
          '  <button type="button" class="btn btn-danger-outline btn-sm hold-btn" ' +
          'data-action="release-hold" data-hospital-id="' + Utils.escapeHtml(hospital.id) + '" ' +
          'data-bed-type="' + Utils.escapeHtml(bedInfo.key) + '">Release Hold</button>' +
          "</div>";
      } else {
        holdHtml =
          '<div class="hold-box">' +
          '  <div class="hold-locked-banner" data-hold-countdown="' + Utils.escapeHtml(holdKey) + '">' +
          "    Held by another user (" + remainingText + ")" +
          "  </div>" +
          '  <button type="button" class="btn btn-outline btn-sm hold-btn" disabled>Hold Locked</button>' +
          "</div>";
      }
    } else if (effectiveCount > 0) {
      holdHtml =
        '<div class="hold-box">' +
        '  <button type="button" class="btn btn-secondary btn-sm hold-btn" ' +
        'data-action="place-hold" data-hospital-id="' + Utils.escapeHtml(hospital.id) + '" ' +
        'data-bed-type="' + Utils.escapeHtml(bedInfo.key) + '">Hold for 2 minutes</button>' +
        "</div>";
    } else {
      holdHtml =
        '<div class="hold-box">' +
        '  <button type="button" class="btn btn-ghost btn-sm hold-btn" disabled>Unavailable</button>' +
        "</div>";
    }

    return (
      '<div class="bed-box' + (isHighlighted ? " highlighted" : "") + '">' +
      '  <div>' +
      '    <div class="bed-box-header">' +
      '      <span class="bed-type-name">' + bedInfo.label + "</span>" +
      '      <span class="status-pill ' + status.className + '">' + status.label + "</span>" +
      "    </div>" +
      '    <div class="bed-count-row">' +
      '      <span class="bed-count">' + effectiveCount + "</span>" +
      "    </div>" +
      "  </div>" +
      holdHtml +
      "</div>"
    );
  }

  function renderResults() {
    var els = getElements();
    if (!els.resultsGrid) return;

    var nowMs = Date.now();
    var hospitals = Data.loadHospitals();
    var holds = Data.loadHolds(nowMs);
    var bedFilter = (els.bedTypeFilter && els.bedTypeFilter.value) || "all";
    var filtered = getFilteredHospitals(hospitals, holds);

    var activeHoldCount = Object.keys(holds).length;
    if (els.activeHoldSummary) {
      if (activeHoldCount > 0) {
        els.activeHoldSummary.hidden = false;
        els.activeHoldSummary.textContent =
          activeHoldCount === 1
            ? "1 active demo bed hold in this browser"
            : activeHoldCount + " active demo bed holds in this browser";
      } else {
        els.activeHoldSummary.hidden = true;
      }
    }

    if (els.resultsCount) {
      els.resultsCount.textContent =
        "Showing " + filtered.length + " of " + hospitals.length + " demo hospitals";
    }

    if (filtered.length === 0) {
      els.resultsGrid.innerHTML = "";
      if (els.noResultsMessage) els.noResultsMessage.hidden = false;
      return;
    }

    if (els.noResultsMessage) els.noResultsMessage.hidden = true;

    var cardsHtml = filtered
      .map(function (hospital) {
        var stale = Utils.isStale(hospital.lastUpdated, nowMs);
        var contactText = String(hospital.contact || "+91 755-010-0000").trim();
        var telHref = "tel:" + contactText.replace(/[^+\d]/g, "");
        var totalAvailable =
          Data.getEffectiveBedCount(hospital, "icu", holds) +
          Data.getEffectiveBedCount(hospital, "oxygen", holds) +
          Data.getEffectiveBedCount(hospital, "general", holds);
        var overallStatus = Utils.getAvailabilityStatus(totalAvailable);

        var staleHtml = stale
          ? '<div class="stale-warning-box" role="alert">' +
            "  <strong>STALE DATA WARNING (&gt; 24 hours old)</strong>" +
            "  Availability has not been updated in over 24 hours. This information needs hospital verification before visiting." +
            "</div>"
          : "";

        var bedsHtml = BED_TYPES.map(function (bedInfo) {
          return renderBedBox(hospital, bedInfo, holds, bedFilter, nowMs);
        }).join("");

        return (
          '<article class="hospital-card' + (stale ? " is-stale" : "") + '">' +
          '  <div class="hospital-card-top">' +
          '    <div class="hospital-title-group">' +
          "      <h3>" + Utils.escapeHtml(hospital.name) + "</h3>" +
          '      <div class="hospital-meta">' +
          "        <span><strong>City:</strong> " + Utils.escapeHtml(hospital.city) + "</span>" +
          "      </div>" +
          "    </div>" +
          '    <div style="display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end;">' +
          '      <span class="demo-tag">DEMO DATA</span>' +
          (stale
            ? '<span class="status-pill status-stale">STALE</span>'
            : '<span class="status-pill ' + overallStatus.className + '">' + overallStatus.label + "</span>") +
          "    </div>" +
          "  </div>" +
          '  <div class="hospital-contact-bar">' +
          '    <div class="hospital-contact-info">' +
          '      <span class="contact-label">Contact Number (Demo):</span> ' +
          '      <strong class="contact-number">' + Utils.escapeHtml(contactText) + "</strong>" +
          "    </div>" +
          '    <a class="btn btn-outline btn-sm call-hospital-btn" href="' + Utils.escapeHtml(telHref) + '" ' +
          'aria-label="Call ' + Utils.escapeHtml(hospital.name) + ' at ' + Utils.escapeHtml(contactText) + '">' +
          "      Call Hospital" +
          "    </a>" +
          "  </div>" +
          staleHtml +
          '  <div class="bed-boxes-grid">' + bedsHtml + "</div>" +
          '  <div class="hospital-card-footer">' +
          "    <span>Last updated: <strong>" + Utils.escapeHtml(Utils.formatDateTime(hospital.lastUpdated)) + "</strong> (" + Utils.escapeHtml(Utils.formatRelativeTime(hospital.lastUpdated, nowMs)) + ")</span>" +
          "    <span>Total available: <strong>" + totalAvailable + "</strong></span>" +
          "  </div>" +
          "</article>"
        );
      })
      .join("");

    els.resultsGrid.innerHTML = cardsHtml;
  }

  function clearFilters() {
    var els = getElements();
    if (els.citySearchInput) els.citySearchInput.value = "";
    if (els.citySelect) els.citySelect.value = "all";
    if (els.bedTypeFilter) els.bedTypeFilter.value = "all";
    renderResults();
  }

  function handleGridClick(event) {
    var btn = event.target.closest("button[data-action]");
    if (!btn) return;

    var action = btn.getAttribute("data-action");
    var hospitalId = btn.getAttribute("data-hospital-id");
    var bedType = btn.getAttribute("data-bed-type");

    if (action === "place-hold") {
      var res = Data.placeHold(hospitalId, bedType, tabId);
      if (!res.ok) {
        MediBed.App && MediBed.App.showToast(res.error, true);
      } else {
        MediBed.App &&
          MediBed.App.showToast(
            "2-minute demo hold placed on " + bedType.toUpperCase() + " bed at " + res.hold.hospitalName + "."
          );
      }
      renderResults();
      MediBed.App && MediBed.App.renderHomeSummary();
    } else if (action === "release-hold") {
      var rel = Data.releaseHold(hospitalId, bedType, tabId);
      if (!rel.ok) {
        MediBed.App && MediBed.App.showToast(rel.error, true);
      } else {
        MediBed.App && MediBed.App.showToast("Demo bed hold released.");
      }
      renderResults();
      MediBed.App && MediBed.App.renderHomeSummary();
    }
  }

  function tickCountdowns() {
    var nowMs = Date.now();
    var rawCount = 0;
    try {
      var raw = global.localStorage.getItem(Data.HOLDS_KEY);
      if (raw) {
        rawCount = Object.keys(JSON.parse(raw) || {}).length;
      }
    } catch (_err) {
      rawCount = 0;
    }

    var holds = Data.loadHolds(nowMs);
    var activeKeys = Object.keys(holds);

    if (activeKeys.length !== rawCount) {
      renderResults();
      MediBed.App && MediBed.App.renderHomeSummary();
      return;
    }

    activeKeys.forEach(function (key) {
      var hold = holds[key];
      var el = document.querySelector('[data-hold-countdown="' + key + '"]');
      if (el) {
        var remaining = Utils.formatCountdown(hold.expiresAt - nowMs);
        el.textContent =
          hold.ownerTabId === tabId
            ? "Demo Hold: " + remaining
            : "Held by another user (" + remaining + ")";
      }
    });
  }

  function init() {
    var els = getElements();
    populateCitySelect();
    renderResults();

    if (els.citySearchInput) {
      els.citySearchInput.addEventListener("input", renderResults);
    }
    if (els.citySelect) {
      els.citySelect.addEventListener("change", renderResults);
    }
    if (els.bedTypeFilter) {
      els.bedTypeFilter.addEventListener("change", renderResults);
    }
    if (els.clearFiltersBtn) {
      els.clearFiltersBtn.addEventListener("click", clearFilters);
    }
    if (els.emptyClearFiltersBtn) {
      els.emptyClearFiltersBtn.addEventListener("click", clearFilters);
    }
    if (els.resultsGrid) {
      els.resultsGrid.addEventListener("click", handleGridClick);
    }

    if (countdownTimerId) {
      global.clearInterval(countdownTimerId);
    }
    countdownTimerId = global.setInterval(tickCountdowns, 1000);
  }

  MediBed.Patient = {
    init: init,
    populateCitySelect: populateCitySelect,
    renderResults: renderResults
  };
})(typeof window !== "undefined" ? window : globalThis);
