/* =========================
   11 - ADMIN CORE LOADER
========================== */

const ADMIN_CORE_SCRIPT = "https://cdn.jsdelivr.net/gh/facilitytrackergms-hub/facility-task-tracker-gms@fca92afb994376540045e7e3016e39d1e61667be/admin/admin.js";

await import(ADMIN_CORE_SCRIPT);

/* =========================
   43C - ROOM / COMMON AREA QUICK TOOLS FILTER
========================== */

(function patchQuickToolsFloorCommonAreaFilter() {
  const QUICK_TOOLS_PATCH_VERSION = "Updated: 2026-05-22 8:39 PM | admin.js";
  const FIRESTORE_REST_API_KEY = "AIzaSyBgq_ooBeEN4noEyIxYPLVokgM6RjCO648";
  const AREAS_REST_URL = "https://firestore.googleapis.com/v1/projects/gms-task-tracker/databases/(default)/documents/areas";

  const quickToolsFilterState = {
    floor: "1",
    type: "rooms",
    commonAreaRecords: []
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

  function readFirestoreValue(value) {
    if (!value) return "";
    if (Object.prototype.hasOwnProperty.call(value, "stringValue")) return value.stringValue;
    if (Object.prototype.hasOwnProperty.call(value, "booleanValue")) return value.booleanValue;
    if (Object.prototype.hasOwnProperty.call(value, "integerValue")) return Number(value.integerValue);
    if (Object.prototype.hasOwnProperty.call(value, "doubleValue")) return Number(value.doubleValue);
    if (Object.prototype.hasOwnProperty.call(value, "timestampValue")) return value.timestampValue;
    return "";
  }

  function getQuickToolsFloorNumberFromAssignment(assignment) {
    const text = String(assignment || "").trim().toLowerCase();
    const cleanAssignment = text.replace(/[^a-z0-9]+/g, "");

    if (!cleanAssignment) return "";

    if (["1", "1stfloor", "1floor", "floor1", "firstfloor", "first"].includes(cleanAssignment)) return "1";
    if (["2", "2ndfloor", "2floor", "floor2", "secondfloor", "second"].includes(cleanAssignment)) return "2";
    if (["3", "3rdfloor", "3floor", "floor3", "thirdfloor", "third"].includes(cleanAssignment)) return "3";

    if (/\b1(st)?\b/.test(text) || text.includes("first")) return "1";
    if (/\b2(nd)?\b/.test(text) || text.includes("second")) return "2";
    if (/\b3(rd)?\b/.test(text) || text.includes("third")) return "3";

    return "";
  }

  function normalizeQuickToolsCommonArea(areaDoc) {
    const area = areaDoc || {};
    area.areaName = area.areaName || area.area || area.name || "";
    area.category = area.category || "";
    area.scheduleDay = area.scheduleDay || area.day || "daily";
    area.day = area.day || area.scheduleDay;
    area.schedule = area.schedule || area.assignment || area.assignedTo || "";
    area.floor = area.floor || area.floorName || area.floorNumber || floorAssignments[getQuickToolsFloorNumberFromAssignment(area.schedule)] || "";
    return area;
  }

  function normalizeQuickToolsFirestoreDocument(documentItem) {
    const fields = documentItem && documentItem.fields ? documentItem.fields : {};
    const output = {
      id: String(documentItem && documentItem.name ? documentItem.name : "").split("/").pop()
    };

    Object.keys(fields).forEach(function(key) {
      output[key] = readFirestoreValue(fields[key]);
    });

    return normalizeQuickToolsCommonArea(output);
  }

  function getQuickToolsCommonAreaFloor(area) {
    return getQuickToolsFloorNumberFromAssignment(area.floor) ||
      getQuickToolsFloorNumberFromAssignment(area.floorName) ||
      getQuickToolsFloorNumberFromAssignment(area.floorNumber) ||
      getQuickToolsFloorNumberFromAssignment(area.schedule) ||
      getQuickToolsFloorNumberFromAssignment(area.assignment) ||
      getQuickToolsFloorNumberFromAssignment(area.assignedTo);
  }

  function getQuickToolsCommonAreaAssignment(area) {
    return String(area && area.schedule ? area.schedule : "").trim() ||
      String(area && area.assignment ? area.assignment : "").trim() ||
      floorAssignments[String(quickToolsFilterState.floor || "1")] ||
      "1stfloor";
  }

  function isQuickToolsCommonArea(area) {
    const areaName = String(area.areaName || "").trim();
    const category = String(area.category || "").trim().toLowerCase();

    if (!areaName) return false;
    if (/^\d{3,4}$/.test(areaName)) return false;
    if (category && !["common area", "common areas"].includes(category)) return false;

    return area.active !== false && area.active !== "No";
  }

  async function loadQuickToolsCommonAreas() {
    if (quickToolsFilterState.commonAreaRecords.length > 0) {
      return quickToolsFilterState.commonAreaRecords;
    }

    let url = AREAS_REST_URL + "?pageSize=300&key=" + encodeURIComponent(FIRESTORE_REST_API_KEY);
    const records = [];

    while (url) {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Could not load common areas.");
      }

      const data = await response.json();
      (data.documents || []).forEach(function(documentItem) {
        records.push(normalizeQuickToolsFirestoreDocument(documentItem));
      });

      url = data.nextPageToken
        ? AREAS_REST_URL + "?pageSize=300&pageToken=" + encodeURIComponent(data.nextPageToken) + "&key=" + encodeURIComponent(FIRESTORE_REST_API_KEY)
        : "";
    }

    quickToolsFilterState.commonAreaRecords = records.filter(isQuickToolsCommonArea);

    return quickToolsFilterState.commonAreaRecords;
  }

  function getQuickToolsUniqueCommonAreasForFloor() {
    const selectedFloor = String(quickToolsFilterState.floor || "1");
    const groups = {};

    quickToolsFilterState.commonAreaRecords.forEach(function(area) {
      const areaName = String(area.areaName || "").trim();
      const groupKey = makeQuickToolsKey(areaName);
      const areaFloor = getQuickToolsCommonAreaFloor(area);

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
    ensureQuickToolsTypeControls();

    ["1", "2", "3"].forEach(function(floor) {
      const btn = document.getElementById("quickToolsFloor" + floor + "Button");
      if (btn) btn.classList.toggle("active-quick-floor", quickToolsFilterState.floor === floor);
    });

    const roomsButton = document.getElementById("quickToolsRoomsButton");
    const commonAreasButton = document.getElementById("quickToolsCommonAreasButton");
    const oldAreasButton = document.getElementById("quickToolsAreasButton");
    const showingCommonAreas = quickToolsFilterState.type === "commonAreas";

    if (roomsButton) roomsButton.classList.toggle("active-quick-floor", !showingCommonAreas);
    if (commonAreasButton) commonAreasButton.classList.toggle("active-quick-floor", showingCommonAreas);
    if (oldAreasButton) oldAreasButton.classList.toggle("active-quick-floor", showingCommonAreas);

    const roomSearchBox = document.getElementById("quickToolsRoomSearchBox");
    const areaSearchBox = document.getElementById("quickToolsAreaSearchBox");
    const roomButtons = document.getElementById("quickToolsRoomButtons");
    const areaButtons = document.getElementById("quickToolsAreaButtons");

    if (roomSearchBox) roomSearchBox.classList.toggle("hidden", showingCommonAreas);
    if (areaSearchBox) areaSearchBox.classList.toggle("hidden", !showingCommonAreas);
    if (roomButtons) roomButtons.classList.toggle("hidden", showingCommonAreas);
    if (areaButtons) areaButtons.classList.toggle("hidden", !showingCommonAreas);
  }

  function updateQuickToolsVersionLabel() {
    const view = document.getElementById("adminQuickToolsView");
    if (!view) return;

    const label = view.querySelector(".app-version-label");
    if (label) {
      label.innerText = QUICK_TOOLS_PATCH_VERSION;
    }
  }

  function ensureQuickToolsTypeControls() {
    const view = document.getElementById("adminQuickToolsView");
    const oldAreasButton = document.getElementById("quickToolsAreasButton");
    if (!view || !oldAreasButton) return;

    oldAreasButton.innerText = "COMMON AREAS";
    oldAreasButton.onclick = function() {
      window.setQuickToolsMode("commonAreas");
    };

    let roomsButton = document.getElementById("quickToolsRoomsButton");
    if (!roomsButton) {
      roomsButton = document.createElement("button");
      roomsButton.id = "quickToolsRoomsButton";
      roomsButton.type = "button";
      roomsButton.innerText = "ROOMS";
      roomsButton.onclick = function() {
        window.setQuickToolsMode("rooms");
      };
    }

    let typeRow = document.getElementById("quickToolsTypeRow");
    if (!typeRow) {
      const oldFloorRow = oldAreasButton.parentElement;
      const typeTitle = document.createElement("div");
      typeTitle.className = "admin-dashboard-subtitle";
      typeTitle.innerText = "Choose type";

      typeRow = document.createElement("div");
      typeRow.id = "quickToolsTypeRow";
      typeRow.className = "quick-tools-filter-row";

      if (oldFloorRow && oldFloorRow.parentNode) {
        oldFloorRow.parentNode.insertBefore(typeTitle, oldFloorRow.nextSibling);
        typeTitle.parentNode.insertBefore(typeRow, typeTitle.nextSibling);
      }
    }

    if (roomsButton.parentElement !== typeRow) {
      typeRow.appendChild(roomsButton);
    }

    if (oldAreasButton.parentElement !== typeRow) {
      typeRow.appendChild(oldAreasButton);
    }

    const areaLabel = document.querySelector("#quickToolsAreaSearchBox .quick-tools-search-label");
    if (areaLabel) areaLabel.innerText = "Choose common area";
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

  function drawQuickToolsCommonAreaMessage(message) {
    const box = document.getElementById("quickToolsAreaButtons");
    if (!box) return;

    box.innerHTML = "";
    const msg = document.createElement("div");
    msg.className = "quick-tools-selected-card";
    msg.innerText = message;
    box.appendChild(msg);
  }

  function drawQuickToolsCommonAreaButtons() {
    const box = document.getElementById("quickToolsAreaButtons");
    if (!box) return;

    box.innerHTML = "";

    if (quickToolsFilterState.type !== "commonAreas") return;

    const choices = getQuickToolsUniqueCommonAreasForFloor();

    if (choices.length === 0) {
      const msg = document.createElement("div");
      msg.className = "quick-tools-selected-card";
      msg.innerText = "No common areas found.";
      box.appendChild(msg);
      return;
    }

    choices.forEach(function(choice) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "yellow";
      btn.innerHTML = '<span class="room-number">' + escapeQuickToolsHtml(choice.areaName) + '</span>';
      btn.onclick = function() {
        openQuickToolsCommonAreaEditor(choice.area);
      };
      box.appendChild(btn);
    });
  }

  function openQuickToolsCommonAreaEditor(area) {
    if (!area || !area.id) {
      window.showAppMessage("Common area not found.", "Common Area");
      return;
    }

    const assignment = getQuickToolsCommonAreaAssignment(area);
    const day = String(area.scheduleDay || area.day || "daily").trim() || "daily";

    sessionStorage.setItem("adminStartView", "ScheduleEditor");
    sessionStorage.setItem("adminEditSource", "quickToolsCommonArea");
    sessionStorage.setItem("adminOpenMode", "details");
    sessionStorage.setItem("adminOpenAssignment", assignment);
    sessionStorage.setItem("adminOpenCategory", "Common Area");
    sessionStorage.setItem("adminOpenAreaId", String(area.id || ""));
    sessionStorage.setItem("adminOpenAreaName", String(area.areaName || ""));
    sessionStorage.setItem("adminOpenDay", day);
    sessionStorage.removeItem("adminOpenTaskView");

    window.location.href = "admin.html#schedule-editor";
  }

  const originalOpenQuickToolsView = window.openQuickToolsView;
  const originalSetQuickToolsFloor = window.setQuickToolsFloor;

  async function showQuickToolsCommonAreas() {
    clearQuickToolsPatchSelection();
    updateQuickToolsFilterButtons();
    updateQuickToolsVersionLabel();
    drawQuickToolsCommonAreaMessage("Loading common areas...");

    try {
      await loadQuickToolsCommonAreas();
      drawQuickToolsCommonAreaButtons();
    } catch (error) {
      drawQuickToolsCommonAreaMessage("Could not load common areas. Refresh and try again.");
    }
  }

  window.setQuickToolsMode = async function(type) {
    quickToolsFilterState.type = type === "commonAreas" ? "commonAreas" : "rooms";
    clearQuickToolsPatchSelection();

    if (quickToolsFilterState.type === "commonAreas") {
      await showQuickToolsCommonAreas();
      return;
    }

    drawQuickToolsCommonAreaButtons();

    if (typeof originalSetQuickToolsFloor === "function") {
      originalSetQuickToolsFloor.call(this, quickToolsFilterState.floor);
    }

    updateQuickToolsFilterButtons();
    updateQuickToolsVersionLabel();
  };

  if (typeof originalOpenQuickToolsView === "function") {
    window.openQuickToolsView = async function() {
      const result = await originalOpenQuickToolsView.apply(this, arguments);
      quickToolsFilterState.floor = "1";
      quickToolsFilterState.type = "rooms";
      loadQuickToolsCommonAreas().catch(function() {});
      clearQuickToolsPatchSelection();
      drawQuickToolsCommonAreaButtons();
      updateQuickToolsFilterButtons();
      updateQuickToolsVersionLabel();
      return result;
    };
  }

  if (typeof originalSetQuickToolsFloor === "function") {
    window.setQuickToolsFloor = async function(floor) {
      if (floor === "areas" || floor === "commonAreas") {
        await window.setQuickToolsMode("commonAreas");
        return;
      }

      quickToolsFilterState.floor = String(floor || "1");

      if (quickToolsFilterState.type === "commonAreas") {
        await showQuickToolsCommonAreas();
        return;
      }

      const result = originalSetQuickToolsFloor.apply(this, arguments);
      updateQuickToolsFilterButtons();
      updateQuickToolsVersionLabel();

      return result;
    };
  }

  window.selectQuickToolsAreaFromDropdown = function() {
    drawQuickToolsCommonAreaButtons();
  };
})();
