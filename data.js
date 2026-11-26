(function (global) {
  "use strict";

  var MediBed = (global.MediBed = global.MediBed || {});
  var Utils = MediBed.Utils;

  var HOSPITALS_KEY = "medibed_hospitals_v1";
  var HOLDS_KEY = "medibed_holds_v1";
  var memoryFallback = {};

  function readStorage(key) {
    try {
      return global.localStorage.getItem(key);
    } catch (_err) {
      return Object.prototype.hasOwnProperty.call(memoryFallback, key)
        ? memoryFallback[key]
        : null;
    }
  }

  function writeStorage(key, value) {
    try {
      global.localStorage.setItem(key, value);
    } catch (_err) {
      memoryFallback[key] = value;
    }
  }

  function getDemoHospitals(nowMs) {
    var now = typeof nowMs === "number" ? nowMs : Date.now();
    var hour = 60 * 60 * 1000;
    var minute = 60 * 1000;

    return [
      {
        id: "demo-bhopal-1",
        name: "Demo CarePulse Hospital",
        city: "Bhopal",
        contact: "+91 755-010-1101",
        icu: 6,
        oxygen: 14,
        general: 22,
        lastUpdated: new Date(now - 18 * minute).toISOString(),
        isDemo: true
      },
      {
        id: "demo-bhopal-2",
        name: "Demo LakeCity Lifeline Center",
        city: "Bhopal",
        contact: "+91 755-010-2204",
        icu: 2,
        oxygen: 0,
        general: 9,
        lastUpdated: new Date(now - 29 * hour).toISOString(), // Stale (> 24h)
        isDemo: true
      },
      {
        id: "demo-indore-1",
        name: "Demo Malwa Medicity Institute",
        city: "Indore",
        contact: "+91 731-010-3307",
        icu: 8,
        oxygen: 18,
        general: 30,
        lastUpdated: new Date(now - 45 * minute).toISOString(),
        isDemo: true
      },
      {
        id: "demo-indore-2",
        name: "Demo Rajwada Trauma & Oxygen Care",
        city: "Indore",
        contact: "+91 731-010-4409",
        icu: 0,
        oxygen: 3,
        general: 5,
        lastUpdated: new Date(now - 3 * hour).toISOString(),
        isDemo: true
      },
      {
        id: "demo-jabalpur-1",
        name: "Demo Narmada Valley Medical Center",
        city: "Jabalpur",
        contact: "+91 761-010-5502",
        icu: 4,
        oxygen: 10,
        general: 16,
        lastUpdated: new Date(now - 2 * hour).toISOString(),
        isDemo: true
      },
      {
        id: "demo-jabalpur-2",
        name: "Demo Marble City General Hospital",
        city: "Jabalpur",
        contact: "+91 761-010-6608",
        icu: 1,
        oxygen: 5,
        general: 0,
        lastUpdated: new Date(now - 46 * hour).toISOString(), // Stale (> 24h)
        isDemo: true
      }
    ];
  }

  function loadHospitals() {
    var raw = readStorage(HOSPITALS_KEY);
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (_err) {
        // Re-seed if storage was corrupted
      }
    }
    var seeded = getDemoHospitals();
    saveHospitals(seeded);
    return seeded;
  }

  function saveHospitals(hospitals) {
    writeStorage(HOSPITALS_KEY, JSON.stringify(hospitals));
  }

  function addHospital(input) {
    var check = Utils.validateHospitalInput(input);
    if (!check.valid) {
      return { ok: false, error: check.error };
    }

    var hospitals = loadHospitals();
    var newHospital = {
      id: "demo-hosp-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      name: check.data.name,
      city: check.data.city,
      contact: check.data.contact,
      icu: check.data.icu,
      oxygen: check.data.oxygen,
      general: check.data.general,
      lastUpdated: new Date().toISOString(),
      isDemo: true
    };

    hospitals.unshift(newHospital);
    saveHospitals(hospitals);
    return { ok: true, hospital: newHospital };
  }

  function updateHospital(hospitalId, input) {
    var check = Utils.validateHospitalInput(input);
    if (!check.valid) {
      return { ok: false, error: check.error };
    }

    var hospitals = loadHospitals();
    var idx = hospitals.findIndex(function (h) {
      return h.id === hospitalId;
    });

    if (idx === -1) {
      return { ok: false, error: "Selected hospital could not be found." };
    }

    var updated = Object.assign({}, hospitals[idx], check.data, {
      lastUpdated: new Date().toISOString(),
      isDemo: true
    });

    hospitals[idx] = updated;
    saveHospitals(hospitals);
    return { ok: true, hospital: updated };
  }

  function getHoldKey(hospitalId, bedType) {
    return hospitalId + "::" + bedType;
  }

  function loadHolds(nowMs) {
    var now = typeof nowMs === "number" ? nowMs : Date.now();
    var raw = readStorage(HOLDS_KEY);
    var holds = {};
    var changed = false;

    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          Object.keys(parsed).forEach(function (key) {
            var hold = parsed[key];
            if (hold && typeof hold.expiresAt === "number" && hold.expiresAt > now) {
              holds[key] = hold;
            } else {
              changed = true;
            }
          });
        }
      } catch (_err) {
        changed = true;
      }
    }

    if (changed) {
      writeStorage(HOLDS_KEY, JSON.stringify(holds));
    }

    return holds;
  }

  function saveHolds(holds) {
    writeStorage(HOLDS_KEY, JSON.stringify(holds));
  }

  function placeHold(hospitalId, bedType, ownerTabId, nowMs) {
    var now = typeof nowMs === "number" ? nowMs : Date.now();
    var hospitals = loadHospitals();
    var hospital = hospitals.find(function (h) {
      return h.id === hospitalId;
    });

    if (!hospital) {
      return { ok: false, error: "Hospital not found." };
    }

    var holds = loadHolds(now);
    var key = getHoldKey(hospitalId, bedType);

    if (holds[key]) {
      return {
        ok: false,
        error: "This demo bed already has an active hold in this browser."
      };
    }

    var available = Number(hospital[bedType] || 0);
    if (available <= 0) {
      return {
        ok: false,
        error: "No beds of this type are currently available to hold."
      };
    }

    var hold = {
      hospitalId: hospitalId,
      hospitalName: hospital.name,
      bedType: bedType,
      ownerTabId: ownerTabId || Utils.getTabId(),
      createdAt: now,
      expiresAt: now + Utils.HOLD_DURATION_MS
    };

    holds[key] = hold;
    saveHolds(holds);
    return { ok: true, hold: hold };
  }

  function releaseHold(hospitalId, bedType, ownerTabId) {
    var holds = loadHolds();
    var key = getHoldKey(hospitalId, bedType);
    var existing = holds[key];

    if (!existing) {
      return { ok: false, error: "No active hold found." };
    }

    if (ownerTabId && existing.ownerTabId !== ownerTabId) {
      return { ok: false, error: "Only the session that placed this demo hold can release it early." };
    }

    delete holds[key];
    saveHolds(holds);
    return { ok: true };
  }

  function getEffectiveBedCount(hospital, bedType, holds) {
    var baseCount = Math.max(0, Number(hospital[bedType] || 0));
    var key = getHoldKey(hospital.id, bedType);
    var activeHold = holds && holds[key] ? 1 : 0;
    return Math.max(0, baseCount - activeHold);
  }

  function resetDemoData() {
    var fresh = getDemoHospitals();
    saveHospitals(fresh);
    saveHolds({});
    return fresh;
  }

  MediBed.Data = {
    HOSPITALS_KEY: HOSPITALS_KEY,
    HOLDS_KEY: HOLDS_KEY,
    getDemoHospitals: getDemoHospitals,
    loadHospitals: loadHospitals,
    saveHospitals: saveHospitals,
    addHospital: addHospital,
    updateHospital: updateHospital,
    getHoldKey: getHoldKey,
    loadHolds: loadHolds,
    placeHold: placeHold,
    releaseHold: releaseHold,
    getEffectiveBedCount: getEffectiveBedCount,
    resetDemoData: resetDemoData
  };
})(typeof window !== "undefined" ? window : globalThis);
