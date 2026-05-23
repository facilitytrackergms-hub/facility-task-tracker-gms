/* =========================
   11 - ADMIN CORE LOADER
========================== */

const ADMIN_CORE_SCRIPT = "https://cdn.jsdelivr.net/gh/facilitytrackergms-hub/facility-task-tracker-gms@fca92afb994376540045e7e3016e39d1e61667be/admin/admin.js";

await import(ADMIN_CORE_SCRIPT);

import {
  getApp,
  getApps,
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";

import {
  collection,
  getDocs,
  getFirestore
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/* =========================
   43C - ROOM / AREA QUICK TOOLS FLOOR + AREA BUTTON FIX
========================== */

(function patchQuickToolsFloorAreaFilter() {
  const QUICK_TOOLS_PATCH_VERSION = "Updated: 2026-05-22 8:13 PM | admin.js";
  const firebaseConfig = {
    apiKey: "AIzaSyBgq_ooBeEN4noEyIxYPLVokgM6RjCO648",
    authDomain: "gms-task-tracker.firebaseapp.com",
    projectId: "gms-task-tracker",
    storageBucket: "gms-task-tracker.firebasestorage.app",
    messagingSenderId: "790880979860",
    appId: "1:790880979860:web:6faee2a6e56955af3c1d81",
    measurementId: "G-5TRHQMS039"
  };

  const quickToolsFilterState = {
    floor: "1",
    areaMode: false,
    areaRecords: []
  };

  const floorAssignments = {
    "1": "1stfloor",
    "2": "2ndFloor",
    "3": "3rdFloor"
  };

  function getPatchDb() {
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    return getFirestore(app);
  }

  function escapeQuickToolsHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function makeQuickToolsKey(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/_+/g, "_") || "blank";
  }

  function normalizeQuickToolsArea(areaDoc) {
    const area = areaDoc || {};
    area.areaName = area.areaName || area.area || area.name || "";
    area.category = area.category || "";
    area.scheduleDay = area.scheduleDay || area.day || "daily";
    area.day = area.day || area.scheduleDay;
    area.schedule = area.schedule || "";
    area.floor = area.floor || floorAssignments[getQuickToolsFloorNumberFromAssignment(area.schedule)] || "";
    return area;
  }

  function getQuickToolsFloorNumberFromAssignment(assignment) {
    const cleanAssignment = String(assignment || "").trim().toLowerCase();
    if (cleanAssignment === "1") return "1";
    if (cleanAssignment === "2") return "2";
    if (cleanAssignment === "3") return "3";
    if (cleanAssignment === "1stfloor") return "1";
    if (cleanAssignment === "2ndfloor") return "2";
    if (cleanAssignment === "3rdfloor") return "3";
    return "";
  }

  function getQuickToolsAreaFloor(area) {
    const floor = getQuickToolsFloorNumberFromAssignment(area.floor) ||
      getQuickToolsFloorNumberFromAssignment(area.schedule);
    return floor;
  }

  function isQuickToolsRealArea(area) {
    const areaName = String(area.areaName || "").trim();
    if (!areaName) return false;
    if (/^\d{3,4}$/.test(areaName)) return false;
    if (String(area.category || "") === "Dehumidifier") return false;
    return area.active !== false && area.active !== "No";
  }

  async function loadQuickToolsAreas() {
    if (quickToolsFilterState.areaRecords.length > 0) {
      return quickToolsFilterState.areaRecords;
    }

    const snap = await getDocs(collection(getPatchDb(), "areas"));
    quickToolsFilterState.areaRecords = snap.docs.map(function(areaDoc) {
      return normalizeQuickToolsArea({ id: areaDoc.id, ...areaDoc.data() });
    }).filter(isQuickToolsRealArea);

    return quickToolsFilterState.areaRecords;
  }

  function getQuickToolsUniqueAreasForFloor() {
    const selectedFloor = String(quickToolsFilterState.floor || "1");
    const groups = {};

    quickToolsFilterState.areaRecords.forEach(function(area) {
      const areaName = String(area.areaName || "").trim();
      const groupKey = makeQuickToolsKey(areaName);
      const areaFloor = getQuickToolsAreaFloor(area);
      if (!groups[groupKey]) {
        groups[groupKey] = {
          areaName: areaName,
          areas: [],
          floorAreas: []
        };
      }
      groups[groupKey].areas.push(area);
      if (areaFloor === selectedFloor) {
        groups[groupKey].floorAreas.push(area);
      }
    });

    return Object.keys(groups).filter(function(groupKey) {
      return groups[groupKey].floorAreas.length > 0;
    }).map(function(groupKey) {
      const group = groups[groupKey];
      const preferredSchedule = floorAssignments[selectedFloor];
      const representative = group.floorAreas.find(function(area) {
        return String(area.schedule || "") === preferredSchedule;
      }) || group.floorAreas[0] || group.areas[0];

      return {
        areaName: group.areaName,
        area: representative
      };
    }).sort(function(a, b) {
      return String(a.areaName || "").localeCompare(String(b.areaName || ""), undefined, { numeric: true });
    });
  }

  function updateQuickToolsFilterButtons() {
    ["1", "2", "3"].forEach(function(floor) {
      const btn = document.getElementById("quickToolsFloor" + floor + "Button");
      if (btn) btn.classList.toggle("active-quick-floor", quickToolsFilterState.floor === floor);
    });

    const areaButton = document.getElementById("quickToolsAreasButton");
    if (areaButton) areaButton.classList.toggle("active-quick-floor", quickToolsFilterState.areaMode);

    const roomSearchBox = document.getElementById("quickToolsRoomSearchBox");
    const areaSearchBox = document.getElementById("quickToolsAreaSearchBox");
    const roomButtons = document.getElementById("quickToolsRoomButtons");
    const areaButtons = document.getElementById("quickToolsAreaButtons");

    if (roomSearchBox) roomSearchBox.classList.toggle("hidden", quickToolsFilterState.areaMode);
    if (areaSearchBox) areaSearchBox.classList.toggle("hidden", !quickToolsFilterState.areaMode);
    if (roomButtons) roomButtons.classList.toggle("hidden", quickToolsFilterState.areaMode);
    if (areaButtons) areaButtons.classList.toggle("hidden", !quickToolsFilterState.areaMode);
  }

  function updateQuickToolsVersionLabel() {
    const view = document.getElementById("adminQuickToolsView");
    if (!view) return;

    const label = view.querySelector(".app-version-label");
    if (label) {
      label.innerText = QUICK_TOOLS_PATCH_VERSION;
    }
  }

  function clearQuickToolsPatchSelection() {
    const label = document.getElementById("quickToolsSelectedLabel");
    const actions = document.getElementById("quickToolsActionButtons");
    if (label) {
      label.classList.add("hidden");
      label.innerText = "";
    }
    if (actions) actions.classList.add("hidden");
  }

  function drawQuickToolsAreaButtons() {
    const box = document.getElementById("quickToolsAreaButtons");
    if (!box) return;

    box.innerHTML = "";

    if (!quickToolsFilterState.areaMode) return;

    const choices = getQuickToolsUniqueAreasForFloor();

    if (choices.length === 0) {
      const msg = document.createElement("div");
      msg.className = "quick-tools-selected-card";
      msg.innerText = "No areas found.";
      box.appendChild(msg);
      return;
    }

    choices.forEach(function(choice) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "yellow";
      btn.innerHTML = '<span class="room-number">' + escapeQuickToolsHtml(choice.areaName) + '</span>';
      btn.onclick = function() {
        openQuickToolsAreaEditor(choice.area);
      };
      box.appendChild(btn);
    });
  }

  function openQuickToolsAreaEditor(area) {
    if (!area || !area.id) {
      window.showAppMessage("Area not found.", "Area");
      return;
    }

    sessionStorage.setItem("adminStartView", "ScheduleEditor");
    sessionStorage.setItem("adminOpenAssignment", String(area.schedule || ""));
    sessionStorage.setItem("adminOpenCategory", String(area.category || "Common Area"));
    sessionStorage.setItem("adminOpenAreaId", String(area.id || ""));
    sessionStorage.setItem("adminOpenAreaName", String(area.areaName || ""));
    sessionStorage.setItem("adminOpenDay", String(area.scheduleDay || area.day || ""));
    sessionStorage.removeItem("adminOpenTaskView");

    window.location.href = "admin.html#schedule-editor";
  }

  const originalOpenQuickToolsView = window.openQuickToolsView;
  if (typeof originalOpenQuickToolsView === "function") {
    window.openQuickToolsView = async function() {
      const result = await originalOpenQuickToolsView.apply(this, arguments);
      quickToolsFilterState.floor = "1";
      quickToolsFilterState.areaMode = false;
      await loadQuickToolsAreas();
      clearQuickToolsPatchSelection();
      drawQuickToolsAreaButtons();
      updateQuickToolsFilterButtons();
      updateQuickToolsVersionLabel();
      return result;
    };
  }

  const originalSetQuickToolsFloor = window.setQuickToolsFloor;
  if (typeof originalSetQuickToolsFloor === "function") {
    window.setQuickToolsFloor = async function(floor) {
      if (floor === "areas") {
        quickToolsFilterState.areaMode = !quickToolsFilterState.areaMode;
        await loadQuickToolsAreas();
        clearQuickToolsPatchSelection();
        drawQuickToolsAreaButtons();
        updateQuickToolsFilterButtons();
        updateQuickToolsVersionLabel();
        return;
      }

      quickToolsFilterState.floor = String(floor || "1");

      if (quickToolsFilterState.areaMode) {
        await loadQuickToolsAreas();
        clearQuickToolsPatchSelection();
        drawQuickToolsAreaButtons();
        updateQuickToolsFilterButtons();
        updateQuickToolsVersionLabel();
        return;
      }

      const result = originalSetQuickToolsFloor.apply(this, arguments);
      updateQuickToolsFilterButtons();
      updateQuickToolsVersionLabel();

      return result;
    };
  }

  window.selectQuickToolsAreaFromDropdown = function() {
    drawQuickToolsAreaButtons();
  };
})();
