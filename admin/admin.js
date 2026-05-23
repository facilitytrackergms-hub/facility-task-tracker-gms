/* =========================
   11 - ADMIN CORE LOADER
========================== */

const ADMIN_CORE_SCRIPT = "https://cdn.jsdelivr.net/gh/facilitytrackergms-hub/facility-task-tracker-gms@fca92afb994376540045e7e3016e39d1e61667be/admin/admin.js";

await import(ADMIN_CORE_SCRIPT);

/* =========================
   43C - MAIN DOOR FILTER
========================== */

(function patchQuickToolsFloorCommonAreaFilter() {
  const QUICK_TOOLS_PATCH_VERSION = "Updated: 2026-05-22 9:23 PM | admin.js";
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

  function updateQuickToolsMainDoorLabels() {
    const viewTitle = document.querySelector("#adminQuickToolsView .admin-dashboard-title");
    if (viewTitle) viewTitle.innerText = "Main Door";

    document.querySelectorAll("button").forEach(function(button) {
      const text = String(button.innerText || "").trim();
      if (text === "Room / Area Quick Tools" || text === "Quick Tools" || text.includes("Quick Tools")) {
        button.innerText = "Main Door";
      }
    });
  }

  function escapeQuickToolsHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
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
    updateQuickToolsMainDoorLabels();

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
      updateQuickToolsMainDoorLabels();
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
      updateQuickToolsMainDoorLabels();

      return result;
    };
  }

  window.selectQuickToolsAreaFromDropdown = function() {
    drawQuickToolsCommonAreaButtons();
  };

  updateQuickToolsMainDoorLabels();
  window.setTimeout(updateQuickToolsMainDoorLabels, 0);
})();

/* =========================
   43D - MAIN DOOR WEEKDAY BUTTONS
========================== */

(function patchMainDoorWeekdayButtons() {
  let selectedMainDoorWeekday = "All";
  const weekdays = [
    { key: "All", label: "ALL" },
    { key: "Monday", label: "MON" },
    { key: "Tuesday", label: "TUE" },
    { key: "Wednesday", label: "WED" },
    { key: "Thursday", label: "THU" },
    { key: "Friday", label: "FRI" },
    { key: "Saturday", label: "SAT" },
    { key: "Sunday", label: "SUN" }
  ];

  function ensureMainDoorWeekdayControls() {
    const view = document.getElementById("adminQuickToolsView");
    const roomSearchBox = document.getElementById("quickToolsRoomSearchBox");
    if (!view || !roomSearchBox) return;

    let title = document.getElementById("quickToolsWeekdayTitle");
    let row = document.getElementById("quickToolsWeekdayRow");

    if (!title) {
      title = document.createElement("div");
      title.id = "quickToolsWeekdayTitle";
      title.className = "admin-dashboard-subtitle";
      title.innerText = "Choose day";
      roomSearchBox.parentNode.insertBefore(title, roomSearchBox);
    }

    if (!row) {
      row = document.createElement("div");
      row.id = "quickToolsWeekdayRow";
      row.className = "weekday-row";
      title.parentNode.insertBefore(row, title.nextSibling);
    }

    row.innerHTML = "";
    weekdays.forEach(function(day) {
      const button = document.createElement("button");
      button.type = "button";
      button.innerText = day.label;
      button.classList.toggle("active-day", selectedMainDoorWeekday === day.key);
      button.onclick = function() {
        window.setQuickToolsWeekday(day.key);
      };
      row.appendChild(button);
    });
  }

  window.setQuickToolsWeekday = function(day) {
    selectedMainDoorWeekday = day || "All";
    ensureMainDoorWeekdayControls();
  };

  const previousOpenQuickToolsView = window.openQuickToolsView;
  if (typeof previousOpenQuickToolsView === "function") {
    window.openQuickToolsView = async function() {
      const result = await previousOpenQuickToolsView.apply(this, arguments);
      selectedMainDoorWeekday = "All";
      ensureMainDoorWeekdayControls();
      return result;
    };
  }

  ensureMainDoorWeekdayControls();
  window.setTimeout(ensureMainDoorWeekdayControls, 0);
})();

/* =========================
   43E - MAIN DOOR SCHEDULE BUTTONS
========================== */

(function patchMainDoorScheduleButtons() {
  let selectedMainDoorSchedule = "All";
  const schedules = [
    { key: "All", label: "ALL" },
    { key: "HK1", label: "HK1" },
    { key: "HK2", label: "HK2" },
    { key: "1stfloor", label: "1ST" },
    { key: "2ndFloor", label: "2ND" },
    { key: "3rdFloor", label: "3RD" },
    { key: "Laundry", label: "LAUNDRY" }
  ];

  function ensureMainDoorScheduleControls() {
    const view = document.getElementById("adminQuickToolsView");
    const typeTitle = document.querySelector("#adminQuickToolsView .admin-dashboard-subtitle");
    if (!view || !typeTitle) return;

    let title = document.getElementById("quickToolsScheduleTitle");
    let row = document.getElementById("quickToolsScheduleRow");

    if (!title) {
      title = document.createElement("div");
      title.id = "quickToolsScheduleTitle";
      title.className = "admin-dashboard-subtitle";
      title.innerText = "Choose schedule";
      typeTitle.parentNode.insertBefore(title, typeTitle);
    }

    if (!row) {
      row = document.createElement("div");
      row.id = "quickToolsScheduleRow";
      row.className = "quick-tools-filter-row";
      title.parentNode.insertBefore(row, title.nextSibling);
    }

    row.innerHTML = "";
    schedules.forEach(function(schedule) {
      const button = document.createElement("button");
      button.type = "button";
      button.innerText = schedule.label;
      button.classList.toggle("active-quick-floor", selectedMainDoorSchedule === schedule.key);
      button.onclick = function() {
        window.setQuickToolsSchedule(schedule.key);
      };
      row.appendChild(button);
    });
  }

  window.setQuickToolsSchedule = function(schedule) {
    selectedMainDoorSchedule = schedule || "All";
    ensureMainDoorScheduleControls();
  };

  const previousOpenQuickToolsView = window.openQuickToolsView;
  if (typeof previousOpenQuickToolsView === "function") {
    window.openQuickToolsView = async function() {
      const result = await previousOpenQuickToolsView.apply(this, arguments);
      selectedMainDoorSchedule = "All";
      ensureMainDoorScheduleControls();
      return result;
    };
  }

  ensureMainDoorScheduleControls();
  window.setTimeout(ensureMainDoorScheduleControls, 0);
})();

/* =========================
   43F - MAIN DOOR FILTER STATE MEMORY
========================== */

(function patchMainDoorFilterStateMemory() {
  const STORAGE_KEY = "mainDoorFilterState";
  const defaultState = {
    schedule: "All",
    type: "rooms",
    floor: "1",
    weekday: "All"
  };

  function loadState() {
    try {
      return Object.assign({}, defaultState, JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}"));
    } catch (error) {
      return Object.assign({}, defaultState);
    }
  }

  function saveState() {
    window.mainDoorFilterState = Object.assign({}, defaultState, window.mainDoorFilterState || {});
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(window.mainDoorFilterState));
  }

  function setStateValue(key, value) {
    window.mainDoorFilterState = Object.assign({}, defaultState, window.mainDoorFilterState || {});
    window.mainDoorFilterState[key] = value;
    saveState();
  }

  function restoreMainDoorState() {
    const state = Object.assign({}, defaultState, window.mainDoorFilterState || loadState());

    if (typeof window.setQuickToolsSchedule === "function") {
      window.setQuickToolsSchedule(state.schedule);
    }

    if (typeof window.setQuickToolsMode === "function") {
      window.setQuickToolsMode(state.type);
    }

    if (typeof window.setQuickToolsFloor === "function") {
      window.setQuickToolsFloor(state.floor);
    }

    if (typeof window.setQuickToolsWeekday === "function") {
      window.setQuickToolsWeekday(state.weekday);
    }
  }

  window.mainDoorFilterState = loadState();

  const originalSetQuickToolsSchedule = window.setQuickToolsSchedule;
  if (typeof originalSetQuickToolsSchedule === "function") {
    window.setQuickToolsSchedule = function(schedule) {
      setStateValue("schedule", schedule || "All");
      return originalSetQuickToolsSchedule.apply(this, arguments);
    };
  }

  const originalSetQuickToolsMode = window.setQuickToolsMode;
  if (typeof originalSetQuickToolsMode === "function") {
    window.setQuickToolsMode = function(type) {
      setStateValue("type", type === "commonAreas" ? "commonAreas" : "rooms");
      return originalSetQuickToolsMode.apply(this, arguments);
    };
  }

  const originalSetQuickToolsFloor = window.setQuickToolsFloor;
  if (typeof originalSetQuickToolsFloor === "function") {
    window.setQuickToolsFloor = function(floor) {
      if (floor !== "areas" && floor !== "commonAreas") {
        setStateValue("floor", String(floor || "1"));
      }
      return originalSetQuickToolsFloor.apply(this, arguments);
    };
  }

  const originalSetQuickToolsWeekday = window.setQuickToolsWeekday;
  if (typeof originalSetQuickToolsWeekday === "function") {
    window.setQuickToolsWeekday = function(day) {
      setStateValue("weekday", day || "All");
      return originalSetQuickToolsWeekday.apply(this, arguments);
    };
  }

  const originalOpenQuickToolsView = window.openQuickToolsView;
  if (typeof originalOpenQuickToolsView === "function") {
    window.openQuickToolsView = async function() {
      const result = await originalOpenQuickToolsView.apply(this, arguments);
      window.mainDoorFilterState = loadState();
      window.setTimeout(restoreMainDoorState, 0);
      return result;
    };
  }

  saveState();
})();
