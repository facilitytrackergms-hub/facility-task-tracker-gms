/* =========================
   11 - ADMIN CORE LOADER
========================== */

const ADMIN_CORE_SCRIPT = "https://cdn.jsdelivr.net/gh/facilitytrackergms-hub/facility-task-tracker-gms@fca92afb994376540045e7e3016e39d1e61667be/admin/admin.js";

await import(ADMIN_CORE_SCRIPT);

/* =========================
   43C - ROOM / AREA QUICK TOOLS FLOOR + AREA BUTTON FIX
========================== */

(function patchQuickToolsFloorAreaFilter() {
  const QUICK_TOOLS_PATCH_VERSION = "Updated: 2026-05-22 8:20 PM | admin.js";
  const FIRESTORE_REST_API_KEY = "AIzaSyBgq_ooBeEN4noEyIxYPLVokgM6RjCO648";
  const AREAS_REST_URL = "https://firestore.googleapis.com/v1/projects/gms-task-tracker/databases/(default)/documents/areas";

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

  function readFirestoreValue(value) {
    if (!value) return "";
    if (Object.prototype.hasOwnProperty.call(value, "stringValue")) return value.stringValue;
    if (Object.prototype.hasOwnProperty.call(value, "booleanValue")) return value.booleanValue;
    if (Object.prototype.hasOwnProperty.call(value, "integerValue")) return Number(value.integerValue);
    if (Object.prototype.hasOwnProperty.call(value, "doubleValue")) return Number(value.doubleValue);
    if (Object.prototype.hasOwnProperty.call(value, "timestampValue")) return value.timestampValue;
    return "";
  }

  function normalizeQuickToolsFirestoreDocument(documentItem) {
    const fields = documentItem && documentItem.fields ? documentItem.fields : {};
    const output = {
      id: String(documentItem && documentItem.name ? documentItem.name : "").split("/").pop()
    };

    Object.keys(fields).forEach(function(key) {
      output[key] = readFirestoreValue(fields[key]);
    });

    return normalizeQuickToolsArea(output);
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

    let url = AREAS_REST_URL + "?pageSize=300&key=" + encodeURIComponent(FIRESTORE_REST_API_KEY);
    const records = [];

    while (url) {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Could not load areas.");
      }

      const data = await response.json();
      (data.documents || []).forEach(function(documentItem) {
        records.push(normalizeQuickToolsFirestoreDocument(documentItem));
      });

      url = data.nextPageToken
        ? AREAS_REST_URL + "?pageSize=300&pageToken=" + encodeURIComponent(data.nextPageToken) + "&key=" + encodeURIComponent(FIRESTORE_REST_API_KEY)
        : "";
    }

    quickToolsFilterState.areaRecords = records.filter(isQuickToolsRealArea);

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

  function drawQuickToolsAreaMessage(message) {
    const box = document.getElementById("quickToolsAreaButtons");
    if (!box) return;

    box.innerHTML = "";
    const msg = document.createElement("div");
    msg.className = "quick-tools-selected-card";
    msg.innerText = message;
    box.appendChild(msg);
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
      loadQuickToolsAreas().catch(function() {});
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
        clearQuickToolsPatchSelection();
        updateQuickToolsFilterButtons();
        updateQuickToolsVersionLabel();

        if (quickToolsFilterState.areaMode) {
          drawQuickToolsAreaMessage("Loading areas...");
          try {
            await loadQuickToolsAreas();
            drawQuickToolsAreaButtons();
          } catch (error) {
            drawQuickToolsAreaMessage("Could not load areas. Refresh and try again.");
          }
        } else {
          drawQuickToolsAreaButtons();
        }

        return;
      }

      quickToolsFilterState.floor = String(floor || "1");

      if (quickToolsFilterState.areaMode) {
        clearQuickToolsPatchSelection();
        updateQuickToolsFilterButtons();
        updateQuickToolsVersionLabel();
        drawQuickToolsAreaMessage("Loading areas...");

        try {
          await loadQuickToolsAreas();
          drawQuickToolsAreaButtons();
        } catch (error) {
          drawQuickToolsAreaMessage("Could not load areas. Refresh and try again.");
        }

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
