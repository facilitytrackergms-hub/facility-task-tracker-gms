/* =========================
   11 - ADMIN CORE LOADER
========================== */

const ADMIN_CORE_SCRIPT = "https://cdn.jsdelivr.net/gh/facilitytrackergms-hub/facility-task-tracker-gms@fca92afb994376540045e7e3016e39d1e61667be/admin/admin.js";

await import(ADMIN_CORE_SCRIPT);

/* =========================
   43C - MAIN DOOR PATCHES
========================== */

(function patchMainDoorFlow() {
  const PATCH_VERSION = "Updated: 2026-05-22 9:41 PM | admin.js";
  const FIRESTORE_REST_API_KEY = "AIzaSyBgq_ooBeEN4noEyIxYPLVokgM6RjCO648";
  const AREAS_REST_URL = "https://firestore.googleapis.com/v1/projects/gms-task-tracker/databases/(default)/documents/areas";
  const FILTER_STORAGE_KEY = "mainDoorFilterState";

  const defaultFilterState = {
    schedule: "All",
    type: "rooms",
    floor: "1",
    weekday: "All"
  };

  const floorAssignments = {
    "1": "1stfloor",
    "2": "2ndFloor",
    "3": "3rdFloor"
  };

  const assignmentFloors = {
    "1stfloor": "1",
    "2ndFloor": "2",
    "3rdFloor": "3"
  };

  const schedules = [
    { key: "All", label: "ALL" },
    { key: "HK1", label: "HK1" },
    { key: "HK2", label: "HK2" },
    { key: "1stfloor", label: "1ST" },
    { key: "2ndFloor", label: "2ND" },
    { key: "3rdFloor", label: "3RD" },
    { key: "Laundry", label: "LAUNDRY" }
  ];

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

  const originalOpenQuickToolsView = window.openQuickToolsView;
  const originalSetQuickToolsFloor = window.setQuickToolsFloor;
  const originalHandleQuickToolsRoomSearch = window.handleQuickToolsRoomSearch;

  let commonAreaRecords = [];
  let roomRecords = [];
  let areasLoaded = false;
  let loadingAreasPromise = null;

  function loadFilterState() {
    try {
      return Object.assign({}, defaultFilterState, JSON.parse(sessionStorage.getItem(FILTER_STORAGE_KEY) || "{}"));
    } catch (error) {
      return Object.assign({}, defaultFilterState);
    }
  }

  function saveFilterState() {
    window.mainDoorFilterState = Object.assign({}, defaultFilterState, window.mainDoorFilterState || {});
    sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(window.mainDoorFilterState));
  }

  function setFilterState(key, value) {
    window.mainDoorFilterState = Object.assign({}, defaultFilterState, window.mainDoorFilterState || {});
    window.mainDoorFilterState[key] = value;
    saveFilterState();
  }

  function getFilterState() {
    window.mainDoorFilterState = Object.assign({}, defaultFilterState, window.mainDoorFilterState || loadFilterState());
    return window.mainDoorFilterState;
  }

  function escapeMainDoorHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function makeMainDoorKey(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/_+/g, "_") || "blank";
  }

  function getRoomKey(value) {
    return String(value || "").replace(/\D/g, "").slice(0, 4);
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

  function getFloorNumberFromAssignment(value) {
    const text = String(value || "").trim().toLowerCase();
    const clean = text.replace(/[^a-z0-9]+/g, "");

    if (!clean) return "";
    if (["1", "1stfloor", "1floor", "floor1", "firstfloor", "first"].includes(clean)) return "1";
    if (["2", "2ndfloor", "2floor", "floor2", "secondfloor", "second"].includes(clean)) return "2";
    if (["3", "3rdfloor", "3floor", "floor3", "thirdfloor", "third"].includes(clean)) return "3";
    if (/^1/.test(clean)) return "1";
    if (/^2/.test(clean)) return "2";
    if (/^3/.test(clean)) return "3";

    return "";
  }

  function getAreaAssignment(area) {
    return String(area.schedule || area.assignment || area.assignedTo || "").trim();
  }

  function getAreaDay(area) {
    return String(area.scheduleDay || area.day || "daily").trim() || "daily";
  }

  function getAreaFloor(area) {
    const roomFloor = getRoomKey(area.areaName).slice(0, 1);
    if (["1", "2", "3"].includes(roomFloor)) return roomFloor;

    return getFloorNumberFromAssignment(area.floor) ||
      getFloorNumberFromAssignment(area.floorName) ||
      getFloorNumberFromAssignment(area.floorNumber) ||
      getFloorNumberFromAssignment(getAreaAssignment(area));
  }

  function normalizeAreaDocument(documentItem) {
    const fields = documentItem && documentItem.fields ? documentItem.fields : {};
    const area = {
      id: String(documentItem && documentItem.name ? documentItem.name : "").split("/").pop()
    };

    Object.keys(fields).forEach(function(key) {
      area[key] = readFirestoreValue(fields[key]);
    });

    area.areaName = area.areaName || area.area || area.name || "";
    area.category = area.category || "";
    area.scheduleDay = area.scheduleDay || area.day || "daily";
    area.day = area.day || area.scheduleDay;
    area.schedule = area.schedule || area.assignment || area.assignedTo || "";
    area.floor = area.floor || area.floorName || area.floorNumber || floorAssignments[getFloorNumberFromAssignment(area.schedule)] || getAreaFloor(area) || "";

    return area;
  }

  function isActiveArea(area) {
    return area.active !== false && area.active !== "No";
  }

  function isCommonArea(area) {
    const areaName = String(area.areaName || "").trim();
    const category = String(area.category || "").trim().toLowerCase();

    if (!areaName) return false;
    if (/^\d{3,4}$/.test(areaName)) return false;
    if (category && !["common area", "common areas"].includes(category)) return false;

    return isActiveArea(area);
  }

  function isRoomArea(area) {
    const roomKey = getRoomKey(area.areaName);
    const category = String(area.category || "").trim();

    if (!/^\d{3,4}$/.test(roomKey)) return false;
    if (["Weekly Room", "Daily Room", "Dehumidifier"].includes(category)) return isActiveArea(area);

    return false;
  }

  async function loadMainDoorAreas() {
    if (areasLoaded) return;
    if (loadingAreasPromise) return loadingAreasPromise;

    loadingAreasPromise = (async function() {
      let url = AREAS_REST_URL + "?pageSize=500&key=" + encodeURIComponent(FIRESTORE_REST_API_KEY);
      const allRecords = [];

      while (url) {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) throw new Error("Could not load Main Door rooms.");

        const data = await response.json();
        (data.documents || []).forEach(function(documentItem) {
          allRecords.push(normalizeAreaDocument(documentItem));
        });

        url = data.nextPageToken
          ? AREAS_REST_URL + "?pageSize=500&pageToken=" + encodeURIComponent(data.nextPageToken) + "&key=" + encodeURIComponent(FIRESTORE_REST_API_KEY)
          : "";
      }

      commonAreaRecords = allRecords.filter(isCommonArea);
      roomRecords = allRecords.filter(isRoomArea);
      areasLoaded = true;
    })();

    return loadingAreasPromise;
  }

  function updateMainDoorLabels() {
    const viewTitle = document.querySelector("#adminQuickToolsView .admin-dashboard-title");
    if (viewTitle) viewTitle.innerText = "Main Door";

    document.querySelectorAll("button").forEach(function(button) {
      const text = String(button.innerText || "").trim();
      if (text === "Room / Area Quick Tools" || text === "Quick Tools" || text.includes("Quick Tools")) {
        button.innerText = "Main Door";
      }
    });
  }

  function updateVersionLabel() {
    const view = document.getElementById("adminQuickToolsView");
    if (!view) return;

    const label = view.querySelector(".app-version-label");
    if (label) label.innerText = PATCH_VERSION;
  }

  function ensureTypeControls() {
    const oldAreasButton = document.getElementById("quickToolsAreasButton");
    if (!oldAreasButton) return;

    oldAreasButton.innerText = "COMMON AREAS";
    oldAreasButton.onclick = function() {
      window.setQuickToolsMode("commonAreas");
    };

    let roomsButton = document.getElementById("quickToolsRoomsButton");
    if (roomsButton) {
      roomsButton.onclick = function() {
        window.setQuickToolsMode("rooms");
      };
    }
  }

  function ensureScheduleControls() {
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
      button.classList.toggle("active-quick-floor", getFilterState().schedule === schedule.key);
      button.onclick = function() {
        window.setQuickToolsSchedule(schedule.key);
      };
      row.appendChild(button);
    });
  }

  function ensureWeekdayControls() {
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
      button.classList.toggle("active-day", getFilterState().weekday === day.key);
      button.onclick = function() {
        window.setQuickToolsWeekday(day.key);
      };
      row.appendChild(button);
    });
  }

  function updateFilterButtons() {
    const state = getFilterState();

    ["1", "2", "3"].forEach(function(floor) {
      const btn = document.getElementById("quickToolsFloor" + floor + "Button");
      if (btn) btn.classList.toggle("active-quick-floor", state.floor === floor);
    });

    const roomsButton = document.getElementById("quickToolsRoomsButton");
    const areasButton = document.getElementById("quickToolsAreasButton");
    if (roomsButton) roomsButton.classList.toggle("active-quick-floor", state.type === "rooms");
    if (areasButton) areasButton.classList.toggle("active-quick-floor", state.type === "commonAreas");

    const roomSearchBox = document.getElementById("quickToolsRoomSearchBox");
    const areaSearchBox = document.getElementById("quickToolsAreaSearchBox");
    const roomButtons = document.getElementById("quickToolsRoomButtons");
    const areaButtons = document.getElementById("quickToolsAreaButtons");
    const showingAreas = state.type === "commonAreas";

    if (roomSearchBox) roomSearchBox.classList.toggle("hidden", showingAreas);
    if (areaSearchBox) areaSearchBox.classList.toggle("hidden", !showingAreas);
    if (roomButtons) roomButtons.classList.toggle("hidden", showingAreas);
    if (areaButtons) areaButtons.classList.toggle("hidden", !showingAreas);
  }

  function clearSelection() {
    const label = document.getElementById("quickToolsSelectedLabel");
    const actions = document.getElementById("quickToolsActionButtons");
    if (label) {
      label.classList.add("hidden");
      label.innerText = "";
    }
    if (actions) actions.classList.add("hidden");
  }

  function drawMessage(containerId, message) {
    const box = document.getElementById(containerId);
    if (!box) return;

    box.innerHTML = "";
    const msg = document.createElement("div");
    msg.className = "quick-tools-selected-card";
    msg.innerText = message;
    box.appendChild(msg);
  }

  function getMainDoorRoomSearchText() {
    const searchInput = document.getElementById("quickToolsRoomSearchInput");
    return String(searchInput ? searchInput.value : "").replace(/\D/g, "");
  }

  function roomMatchesFilters(area) {
    const state = getFilterState();
    const assignment = getAreaAssignment(area);
    const areaFloor = getAreaFloor(area);
    const areaDay = getAreaDay(area).toLowerCase();
    const category = String(area.category || "").trim();
    const searchText = getMainDoorRoomSearchText();
    const roomKey = getRoomKey(area.areaName);

    if (searchText) {
      return roomKey.includes(searchText);
    }

    if (state.schedule !== "All" && assignment !== state.schedule) return false;
    if (state.floor !== "All" && areaFloor !== state.floor) return false;

    if (state.weekday !== "All") {
      if (category === "Daily Room") return true;
      if (areaDay === "daily") return true;
      if (areaDay !== state.weekday.toLowerCase()) return false;
    }

    return true;
  }

  function getFilteredUniqueRooms() {
    const groups = {};

    roomRecords.filter(roomMatchesFilters).forEach(function(area) {
      const roomKey = getRoomKey(area.areaName);
      if (!roomKey) return;

      if (!groups[roomKey]) {
        groups[roomKey] = {
          roomKey: roomKey,
          rows: []
        };
      }

      groups[roomKey].rows.push(area);
    });

    return Object.keys(groups).sort(function(a, b) {
      return Number(a) - Number(b);
    }).map(function(roomKey) {
      const rows = groups[roomKey].rows;
      const preferred = rows.find(function(area) {
        return String(area.category || "") === "Weekly Room";
      }) || rows[0];

      return {
        roomKey: roomKey,
        area: preferred,
        rows: rows
      };
    });
  }

  function selectMainDoorRoom(room) {
    const input = document.getElementById("quickToolsRoomSearchInput");
    const label = document.getElementById("quickToolsSelectedLabel");
    const actions = document.getElementById("quickToolsActionButtons");

    if (input) input.value = room.roomKey;

    sessionStorage.setItem("mainDoorSelectedType", "room");
    sessionStorage.setItem("mainDoorSelectedRoom", room.roomKey);
    sessionStorage.setItem("mainDoorSelectedAreaId", String(room.area.id || ""));
    sessionStorage.setItem("mainDoorSelectedAreaName", String(room.area.areaName || room.roomKey));

    if (label) {
      label.innerText = "Room " + room.roomKey;
      label.classList.remove("hidden");
    }

    if (actions) actions.classList.remove("hidden");
  }

  function drawRoomButtons() {
    const box = document.getElementById("quickToolsRoomButtons");
    if (!box) return;

    box.innerHTML = "";

    if (getFilterState().type !== "rooms") return;

    const rooms = getFilteredUniqueRooms();

    if (rooms.length === 0) {
      drawMessage("quickToolsRoomButtons", "No rooms found.");
      return;
    }

    rooms.forEach(function(room) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "yellow";
      btn.innerHTML = '<span class="room-number">' + escapeMainDoorHtml(room.roomKey) + '</span>';
      btn.onclick = function() {
        selectMainDoorRoom(room);
      };
      box.appendChild(btn);
    });
  }

  function commonAreaMatchesFilters(area) {
    const state = getFilterState();
    const areaFloor = getAreaFloor(area);
    const assignment = getAreaAssignment(area);
    const areaDay = getAreaDay(area).toLowerCase();
    const floorSchedule = floorAssignments[state.floor] || "";
    const scheduleFloor = assignmentFloors[state.schedule] || "";

    if (state.floor !== "All") {
      if (areaFloor && areaFloor !== state.floor) return false;
      if (!areaFloor && assignmentFloors[assignment] && assignment !== floorSchedule) return false;
    }

    if (state.schedule !== "All") {
      if (assignment && assignment !== state.schedule) return false;
      if (!assignment && scheduleFloor && areaFloor && areaFloor !== scheduleFloor) return false;
    }

    if (state.weekday !== "All" && areaDay !== "daily" && areaDay !== state.weekday.toLowerCase()) return false;

    return true;
  }

  function getCommonAreaChoiceScore(area) {
    const state = getFilterState();
    const areaFloor = getAreaFloor(area);
    const assignment = getAreaAssignment(area);
    const areaDay = getAreaDay(area).toLowerCase();
    let score = 0;

    if (state.schedule !== "All" && assignment === state.schedule) score += 20;
    if (state.floor !== "All" && areaFloor === state.floor) score += 10;
    if (state.weekday !== "All" && areaDay === state.weekday.toLowerCase()) score += 5;
    if (areaDay === "daily") score += 2;
    if (assignment) score += 1;

    return score;
  }

  function drawCommonAreaButtons() {
    const box = document.getElementById("quickToolsAreaButtons");
    if (!box) return;

    box.innerHTML = "";

    if (getFilterState().type !== "commonAreas") return;

    const groups = {};
    commonAreaRecords.filter(commonAreaMatchesFilters).forEach(function(area) {
      const areaName = String(area.areaName || "").trim();
      const groupKey = makeMainDoorKey(areaName);
      if (!groups[groupKey]) groups[groupKey] = { areaName: areaName, areas: [] };
      groups[groupKey].areas.push(area);
    });

    const choices = Object.keys(groups).sort(function(a, b) {
      return String(groups[a].areaName || "").localeCompare(String(groups[b].areaName || ""), undefined, { numeric: true });
    });

    if (choices.length === 0) {
      drawMessage("quickToolsAreaButtons", "No common areas found.");
      return;
    }

    choices.forEach(function(groupKey) {
      const group = groups[groupKey];
      const choiceArea = group.areas.slice().sort(function(a, b) {
        return getCommonAreaChoiceScore(b) - getCommonAreaChoiceScore(a);
      })[0];

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "yellow";
      btn.innerHTML = '<span class="room-number">' + escapeMainDoorHtml(group.areaName) + '</span>';
      btn.onclick = function() {
        sessionStorage.setItem("mainDoorSelectedType", "commonArea");
        sessionStorage.setItem("mainDoorSelectedAreaId", String(choiceArea.id || ""));
        sessionStorage.setItem("mainDoorSelectedAreaName", String(choiceArea.areaName || ""));
        const label = document.getElementById("quickToolsSelectedLabel");
        const actions = document.getElementById("quickToolsActionButtons");
        if (label) {
          label.innerText = group.areaName;
          label.classList.remove("hidden");
        }
        if (actions) actions.classList.remove("hidden");
      };
      box.appendChild(btn);
    });
  }

  async function refreshMainDoorResults() {
    updateMainDoorLabels();
    ensureTypeControls();
    ensureScheduleControls();
    ensureWeekdayControls();
    updateFilterButtons();
    updateVersionLabel();

    try {
      await loadMainDoorAreas();
      drawRoomButtons();
      drawCommonAreaButtons();
    } catch (error) {
      if (getFilterState().type === "rooms") {
        drawMessage("quickToolsRoomButtons", "Could not load rooms. Refresh and try again.");
      } else {
        drawMessage("quickToolsAreaButtons", "Could not load common areas. Refresh and try again.");
      }
    }
  }

  window.setQuickToolsSchedule = function(schedule) {
    setFilterState("schedule", schedule || "All");
    clearSelection();
    refreshMainDoorResults();
  };

  window.setQuickToolsWeekday = function(day) {
    setFilterState("weekday", day || "All");
    clearSelection();
    refreshMainDoorResults();
  };

  window.setQuickToolsMode = function(type) {
    setFilterState("type", type === "commonAreas" ? "commonAreas" : "rooms");
    clearSelection();
    refreshMainDoorResults();
  };

  window.setQuickToolsFloor = function(floor) {
    if (floor === "areas" || floor === "commonAreas") {
      window.setQuickToolsMode("commonAreas");
      return;
    }

    setFilterState("floor", String(floor || "1"));
    clearSelection();

    if (typeof originalSetQuickToolsFloor === "function" && getFilterState().type === "rooms" && !getMainDoorRoomSearchText()) {
      originalSetQuickToolsFloor.call(this, floor);
    }

    refreshMainDoorResults();
  };

  window.handleQuickToolsRoomSearch = function() {
    if (typeof originalHandleQuickToolsRoomSearch === "function" && !getMainDoorRoomSearchText()) {
      originalHandleQuickToolsRoomSearch.apply(this, arguments);
    }
    clearSelection();
    refreshMainDoorResults();
  };

  if (typeof originalOpenQuickToolsView === "function") {
    window.openQuickToolsView = async function() {
      const result = await originalOpenQuickToolsView.apply(this, arguments);
      window.mainDoorFilterState = loadFilterState();
      refreshMainDoorResults();
      return result;
    };
  }

  window.mainDoorFilterState = loadFilterState();
  saveFilterState();
  updateMainDoorLabels();
  window.setTimeout(refreshMainDoorResults, 0);
})();
