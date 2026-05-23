/* =========================
   11 - ADMIN CORE LOADER
========================== */

const ADMIN_CORE_SCRIPT = "https://cdn.jsdelivr.net/gh/facilitytrackergms-hub/facility-task-tracker-gms@fca92afb994376540045e7e3016e39d1e61667be/admin/admin.js";

await import(ADMIN_CORE_SCRIPT);

/* =========================
   43C - ROOM / AREA QUICK TOOLS FLOOR + AREA FILTER FIX
========================== */

(function patchQuickToolsFloorAreaFilter() {
  const quickToolsFilterState = {
    floor: "1",
    areaMode: false,
    areaOptions: []
  };

  const floorAssignments = {
    "1": "1stfloor",
    "2": "2ndFloor",
    "3": "3rdFloor"
  };

  function getAreaSelect() {
    return document.getElementById("quickToolsAreaSelect");
  }

  function getStoredAreaOptions() {
    const select = getAreaSelect();
    if (!select) return [];

    const currentOptions = Array.from(select.options || []).map(function(option) {
      return {
        value: option.value,
        text: option.text
      };
    });

    if (currentOptions.length > 1) {
      quickToolsFilterState.areaOptions = currentOptions;
    }

    return quickToolsFilterState.areaOptions;
  }

  function optionMatchesSelectedFloor(option) {
    if (!option || !option.value) return true;

    const floor = String(quickToolsFilterState.floor || "1");
    const text = String((option.text || "") + " " + (option.value || "")).toLowerCase();
    const expectedAssignment = String(floorAssignments[floor] || "").toLowerCase();

    if (expectedAssignment && text.includes(expectedAssignment)) return true;

    const roomMatch = text.match(/\b([123])\d{2}\b/);
    if (roomMatch) return roomMatch[1] === floor;

    const hasFloorAssignment =
      text.includes("1stfloor") ||
      text.includes("2ndfloor") ||
      text.includes("3rdfloor");

    return !hasFloorAssignment;
  }

  function applyQuickToolsAreaFloorFilter() {
    const select = getAreaSelect();
    if (!select) return;

    const selectedValue = select.value;
    const options = getStoredAreaOptions();
    if (options.length === 0) return;

    select.innerHTML = "";

    options.filter(optionMatchesSelectedFloor).forEach(function(item) {
      const option = document.createElement("option");
      option.value = item.value;
      option.text = item.text;
      select.appendChild(option);
    });

    if (Array.from(select.options).some(function(option) { return option.value === selectedValue; })) {
      select.value = selectedValue;
    } else {
      select.value = "";
    }
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

    if (roomSearchBox) roomSearchBox.classList.toggle("hidden", quickToolsFilterState.areaMode);
    if (areaSearchBox) areaSearchBox.classList.toggle("hidden", !quickToolsFilterState.areaMode);
    if (roomButtons) roomButtons.classList.toggle("hidden", quickToolsFilterState.areaMode);
  }

  function updateQuickToolsVersionLabel() {
    const view = document.getElementById("adminQuickToolsView");
    if (!view) return;

    const label = view.querySelector(".app-version-label");
    if (label) {
      label.innerText = "Updated: 2026-05-22 7:35 PM | admin.js";
    }
  }

  const originalOpenQuickToolsView = window.openQuickToolsView;
  if (typeof originalOpenQuickToolsView === "function") {
    window.openQuickToolsView = async function() {
      const result = await originalOpenQuickToolsView.apply(this, arguments);
      quickToolsFilterState.floor = "1";
      quickToolsFilterState.areaMode = false;
      getStoredAreaOptions();
      applyQuickToolsAreaFloorFilter();
      updateQuickToolsFilterButtons();
      updateQuickToolsVersionLabel();
      return result;
    };
  }

  const originalSetQuickToolsFloor = window.setQuickToolsFloor;
  if (typeof originalSetQuickToolsFloor === "function") {
    window.setQuickToolsFloor = function(floor) {
      if (floor === "areas") {
        quickToolsFilterState.areaMode = !quickToolsFilterState.areaMode;
        getStoredAreaOptions();
        applyQuickToolsAreaFloorFilter();
        updateQuickToolsFilterButtons();
        updateQuickToolsVersionLabel();
        return;
      }

      quickToolsFilterState.floor = String(floor || "1");

      const result = originalSetQuickToolsFloor.apply(this, arguments);

      setTimeout(function() {
        getStoredAreaOptions();
        applyQuickToolsAreaFloorFilter();
        updateQuickToolsFilterButtons();
        updateQuickToolsVersionLabel();
      }, 0);

      return result;
    };
  }
})();
