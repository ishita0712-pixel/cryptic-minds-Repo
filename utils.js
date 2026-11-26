(function (global) {
  "use strict";

  var MediBed = (global.MediBed = global.MediBed || {});

  var STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours
  var HOLD_DURATION_MS = 2 * 60 * 1000; // 2 minutes

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function isStale(isoTimestamp, nowMs) {
    var now = typeof nowMs === "number" ? nowMs : Date.now();
    var parsed = Date.parse(isoTimestamp);
    if (Number.isNaN(parsed)) {
      return true;
    }
    return now - parsed > STALE_THRESHOLD_MS;
  }

  function formatDateTime(isoTimestamp) {
    var date = new Date(isoTimestamp);
    if (Number.isNaN(date.getTime())) {
      return "Unknown time";
    }
    return date.toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function formatRelativeTime(isoTimestamp, nowMs) {
    var now = typeof nowMs === "number" ? nowMs : Date.now();
    var parsed = Date.parse(isoTimestamp);
    if (Number.isNaN(parsed)) {
      return "Unknown";
    }

    var diffSeconds = Math.max(0, Math.floor((now - parsed) / 1000));
    if (diffSeconds < 60) {
      return "Just now";
    }
    var diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) {
      return diffMinutes === 1 ? "1 minute ago" : diffMinutes + " minutes ago";
    }
    var diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return diffHours === 1 ? "1 hour ago" : diffHours + " hours ago";
    }
    var diffDays = Math.floor(diffHours / 24);
    return diffDays === 1 ? "1 day ago" : diffDays + " days ago";
  }

  function formatCountdown(remainingMs) {
    var totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds % 60;
    return String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
  }

  function validateBedCount(rawValue, label) {
    var text = String(rawValue == null ? "" : rawValue).trim();
    if (!/^\d+$/.test(text)) {
      return {
        valid: false,
        error: label + " must be a whole number (0 or greater)."
      };
    }
    var num = Number(text);
    if (!Number.isSafeInteger(num) || num < 0) {
      return {
        valid: false,
        error: label + " cannot be negative."
      };
    }
    return {
      valid: true,
      value: num
    };
  }

  function validateHospitalInput(input) {
    var name = String((input && input.name) || "").trim();
    var city = String((input && input.city) || "").trim();
    var contact = String((input && input.contact) || "").trim();

    if (name.length < 2) {
      return { valid: false, error: "Please enter a valid hospital name." };
    }
    if (city.length < 2) {
      return { valid: false, error: "Please enter a valid city name." };
    }
    if (contact.length < 6) {
      return { valid: false, error: "Please enter a valid contact number." };
    }

    var icuCheck = validateBedCount(input.icu, "ICU bed count");
    if (!icuCheck.valid) return icuCheck;

    var oxygenCheck = validateBedCount(input.oxygen, "Oxygen bed count");
    if (!oxygenCheck.valid) return oxygenCheck;

    var generalCheck = validateBedCount(input.general, "General bed count");
    if (!generalCheck.valid) return generalCheck;

    return {
      valid: true,
      data: {
        name: name,
        city: city,
        contact: contact,
        icu: icuCheck.value,
        oxygen: oxygenCheck.value,
        general: generalCheck.value
      }
    };
  }

  function getAvailabilityStatus(count) {
    if (count <= 0) {
      return { label: "Full", className: "status-full" };
    }
    if (count <= 3) {
      return { label: "Limited", className: "status-limited" };
    }
    return { label: "Available", className: "status-available" };
  }

  function getTabId() {
    var fallbackId = "tab-" + Math.random().toString(36).slice(2, 10);
    try {
      var existing = global.sessionStorage.getItem("medibed_tab_id");
      if (existing) return existing;
      global.sessionStorage.setItem("medibed_tab_id", fallbackId);
      return fallbackId;
    } catch (_err) {
      return fallbackId;
    }
  }

  MediBed.Utils = {
    STALE_THRESHOLD_MS: STALE_THRESHOLD_MS,
    HOLD_DURATION_MS: HOLD_DURATION_MS,
    escapeHtml: escapeHtml,
    isStale: isStale,
    formatDateTime: formatDateTime,
    formatRelativeTime: formatRelativeTime,
    formatCountdown: formatCountdown,
    validateBedCount: validateBedCount,
    validateHospitalInput: validateHospitalInput,
    getAvailabilityStatus: getAvailabilityStatus,
    getTabId: getTabId
  };
})(typeof window !== "undefined" ? window : globalThis);
