const MODES = [
  "Sequential Review",
  "Random Shuffle",
  "Keyword Search",
  "Search by Number",
];

const STORAGE_KEY = "usas-situations-static-state";
const DEFAULT_FONT_SIZE = 18;

const state = {
  mode: "Sequential Review",
  hideResolution: false,
  fontSize: DEFAULT_FONT_SIZE,
  sequentialSection: "",
  sequentialNumber: 1,
  randomSection: "ALL",
  randomCurrentNumber: null,
  keywordField: "All",
  keywordSection: "All",
  keywordQuery: "",
  keywordCurrentNumber: null,
  numberQuery: "",
  currentNumber: null,
  revealResolution: false,
};

const refs = {
  modeList: document.getElementById("modeList"),
  statusBar: document.getElementById("statusBar"),
  modeControls: document.getElementById("modeControls"),
  emptyState: document.getElementById("emptyState"),
  resultCard: document.getElementById("resultCard"),
  cardSectionLabel: document.getElementById("cardSectionLabel"),
  cardNumberLabel: document.getElementById("cardNumberLabel"),
  situationText: document.getElementById("situationText"),
  resolutionText: document.getElementById("resolutionText"),
  ruleText: document.getElementById("ruleText"),
  resolutionBlock: document.getElementById("resolutionBlock"),
  revealButton: document.getElementById("revealButton"),
  copyLinkButton: document.getElementById("copyLinkButton"),
  datasetCount: document.getElementById("datasetCount"),
  hideResolution: document.getElementById("hideResolution"),
  fontSize: document.getElementById("fontSize"),
  fontSizeValue: document.getElementById("fontSizeValue"),
};

let records = [];
let sections = [];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function highlightText(text, query) {
  const safeText = escapeHtml(text);
  if (!query) {
    return safeText;
  }

  const pattern = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!pattern) {
    return safeText;
  }

  const regex = new RegExp(`(${pattern})`, "ig");
  return safeText.replace(regex, "<mark>$1</mark>");
}

function makeSelect(options, selectedValue, attrs = "") {
  const optionMarkup = options
    .map((option) => {
      const value = typeof option === "string" ? option : option.value;
      const label = typeof option === "string" ? option : option.label;
      const selected = value === selectedValue ? " selected" : "";
      return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(label)}</option>`;
    })
    .join("");

  return `<select class="select" ${attrs}>${optionMarkup}</select>`;
}

function makeField(label, content, compact = false) {
  return `
    <label class="field ${compact ? "field--compact" : ""}">
      <span>${escapeHtml(label)}</span>
      ${content}
    </label>
  `;
}

function savePreferences() {
  const persisted = {
    mode: state.mode,
    hideResolution: state.hideResolution,
    fontSize: state.fontSize,
    sequentialSection: state.sequentialSection,
    randomSection: state.randomSection,
    keywordField: state.keywordField,
    keywordSection: state.keywordSection,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
}

function loadPreferences() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }
    const saved = JSON.parse(raw);
    Object.assign(state, saved);
  } catch {
    // Ignore invalid saved state.
  }
}

function getSequentialPool(section = state.sequentialSection) {
  return records.filter((record) => record.section === section);
}

function getRandomPool(section = state.randomSection) {
  if (section === "ALL") {
    return records;
  }
  return records.filter((record) => record.section === section);
}

function getKeywordResults() {
  const query = state.keywordQuery.trim().toLowerCase();
  if (!query) {
    return [];
  }

  const scopedRecords = state.keywordSection === "All"
    ? records
    : records.filter((record) => record.section === state.keywordSection);

  return scopedRecords.filter((record) => {
    const inSituation = record.situation.toLowerCase().includes(query);
    const inResolution = record.resolution.toLowerCase().includes(query);

    if (state.keywordField === "Situations") {
      return inSituation;
    }
    if (state.keywordField === "Resolutions") {
      return inResolution;
    }
    return inSituation || inResolution;
  });
}

function getRecordByNumber(numberLike) {
  const number = Number.parseInt(numberLike, 10);
  if (!Number.isFinite(number)) {
    return null;
  }
  return records.find((record) => record.number === number) ?? null;
}

function setCurrentRecord(record, { resetReveal = true } = {}) {
  state.currentNumber = record?.number ?? null;
  if (resetReveal) {
    state.revealResolution = false;
  }
}

function ensureDefaults() {
  if (!sections.length) {
    return;
  }

  if (!state.sequentialSection || !sections.includes(state.sequentialSection)) {
    state.sequentialSection = sections.includes("Backstroke") ? "Backstroke" : sections[0];
  }

  if (!state.randomSection || (state.randomSection !== "ALL" && !sections.includes(state.randomSection))) {
    state.randomSection = "ALL";
  }

  if (!state.keywordSection || (state.keywordSection !== "All" && !sections.includes(state.keywordSection))) {
    state.keywordSection = "All";
  }

  const sequentialPool = getSequentialPool();
  if (sequentialPool.length) {
    state.sequentialNumber = clamp(state.sequentialNumber, 1, sequentialPool.length);
  } else {
    state.sequentialNumber = 1;
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getCurrentRecord() {
  return getRecordByNumber(state.currentNumber);
}

function updateCurrentRecordFromMode() {
  if (!records.length) {
    setCurrentRecord(null);
    return;
  }

  if (state.mode === "Sequential Review") {
    const pool = getSequentialPool();
    if (!pool.length) {
      setCurrentRecord(null);
      return;
    }
    state.sequentialNumber = clamp(state.sequentialNumber, 1, pool.length);
    setCurrentRecord(pool[state.sequentialNumber - 1]);
    return;
  }

  if (state.mode === "Random Shuffle") {
    const pool = getRandomPool();
    const current = getRecordByNumber(state.randomCurrentNumber);
    if (current && pool.some((record) => record.number === current.number)) {
      setCurrentRecord(current, { resetReveal: false });
      return;
    }
    const next = pickRandomRecord(pool);
    state.randomCurrentNumber = next?.number ?? null;
    setCurrentRecord(next);
    return;
  }

  if (state.mode === "Keyword Search") {
    const results = getKeywordResults();
    const current = getRecordByNumber(state.keywordCurrentNumber);
    if (current && results.some((record) => record.number === current.number)) {
      setCurrentRecord(current, { resetReveal: false });
      return;
    }
    const first = results[0] ?? null;
    state.keywordCurrentNumber = first?.number ?? null;
    setCurrentRecord(first);
    return;
  }

  if (state.mode === "Search by Number") {
    const record = getRecordByNumber(state.numberQuery);
    setCurrentRecord(record);
  }
}

function pickRandomRecord(pool, { excludeCurrent = true } = {}) {
  if (!pool.length) {
    return null;
  }

  if (!excludeCurrent || pool.length === 1 || !state.randomCurrentNumber) {
    return pool[Math.floor(Math.random() * pool.length)];
  }

  const filtered = pool.filter((record) => record.number !== state.randomCurrentNumber);
  const source = filtered.length ? filtered : pool;
  return source[Math.floor(Math.random() * source.length)];
}

function renderModeButtons() {
  refs.modeList.innerHTML = MODES
    .map((mode) => `
      <button
        class="mode-button ${state.mode === mode ? "is-active" : ""}"
        type="button"
        data-mode="${escapeHtml(mode)}"
        role="tab"
        aria-selected="${state.mode === mode}"
      >
        ${escapeHtml(mode)}
      </button>
    `)
    .join("");

  refs.modeList.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextMode = button.dataset.mode;
      if (!nextMode || nextMode === state.mode) {
        return;
      }
      state.mode = nextMode;
      state.revealResolution = false;
      updateCurrentRecordFromMode();
      savePreferences();
      render();
    });
  });
}

function renderStatus() {
  if (!records.length) {
    refs.statusBar.textContent = "Loading situations…";
    return;
  }

  if (state.mode === "Sequential Review") {
    const pool = getSequentialPool();
    refs.statusBar.textContent = `${pool.length} items in ${state.sequentialSection}. Use the number control or Previous/Next buttons.`;
    return;
  }

  if (state.mode === "Random Shuffle") {
    const pool = getRandomPool();
    const scope = state.randomSection === "ALL" ? "all sections" : state.randomSection;
    refs.statusBar.textContent = `${pool.length} items available in ${scope}. Shuffle for a new card.`;
    return;
  }

  if (state.mode === "Keyword Search") {
    const results = getKeywordResults();
    if (!state.keywordQuery.trim()) {
      refs.statusBar.textContent = "Search situations, resolutions, or both. Results update as you type.";
      return;
    }
    refs.statusBar.textContent = `${results.length} match${results.length === 1 ? "" : "es"} found for “${state.keywordQuery.trim()}”.`;
    return;
  }

  const min = records[0]?.number ?? 1;
  const max = records.at(-1)?.number ?? 1;
  refs.statusBar.textContent = `Enter a situation number from ${min} to ${max}.`;
}

function renderControls() {
  if (!records.length) {
    refs.modeControls.innerHTML = "";
    return;
  }

  if (state.mode === "Sequential Review") {
    const pool = getSequentialPool();
    const countNotice = `<div class="notice">Item ${state.sequentialNumber} of ${pool.length}</div>`;
    refs.modeControls.innerHTML = `
      <div class="control-row">
        ${makeField("Stroke / Topic", makeSelect(sections, state.sequentialSection, 'id="sequentialSection"'))}
        ${makeField(
          "Item number",
          `<input id="sequentialNumber" class="number-input" type="number" min="1" max="${pool.length || 1}" value="${pool.length ? state.sequentialNumber : 1}">`,
          true,
        )}
      </div>
      <div class="button-row">
        <button id="previousSequential" class="button button--secondary" type="button">Previous</button>
        <button id="nextSequential" class="button button--secondary" type="button">Next</button>
        ${countNotice}
      </div>
    `;

    document.getElementById("sequentialSection")?.addEventListener("change", (event) => {
      state.sequentialSection = event.target.value;
      state.sequentialNumber = 1;
      updateCurrentRecordFromMode();
      savePreferences();
      render();
    });

    document.getElementById("sequentialNumber")?.addEventListener("change", (event) => {
      const nextValue = Number.parseInt(event.target.value, 10) || 1;
      state.sequentialNumber = pool.length ? clamp(nextValue, 1, pool.length) : 1;
      updateCurrentRecordFromMode();
      render();
    });

    document.getElementById("previousSequential")?.addEventListener("click", () => {
      if (!pool.length) {
        return;
      }
      state.sequentialNumber = state.sequentialNumber <= 1 ? pool.length : state.sequentialNumber - 1;
      updateCurrentRecordFromMode();
      render();
    });

    document.getElementById("nextSequential")?.addEventListener("click", () => {
      if (!pool.length) {
        return;
      }
      state.sequentialNumber = state.sequentialNumber >= pool.length ? 1 : state.sequentialNumber + 1;
      updateCurrentRecordFromMode();
      render();
    });

    return;
  }

  if (state.mode === "Random Shuffle") {
    refs.modeControls.innerHTML = `
      <div class="control-row">
        ${makeField(
          "Stroke / Topic",
          makeSelect(["ALL", ...sections], state.randomSection, 'id="randomSection"'),
        )}
      </div>
      <div class="button-row">
        <button id="shuffleButton" class="button" type="button">Shuffle next situation</button>
      </div>
    `;

    document.getElementById("randomSection")?.addEventListener("change", (event) => {
      state.randomSection = event.target.value;
      const next = pickRandomRecord(getRandomPool(), { excludeCurrent: false });
      state.randomCurrentNumber = next?.number ?? null;
      setCurrentRecord(next);
      savePreferences();
      render();
    });

    document.getElementById("shuffleButton")?.addEventListener("click", () => {
      const next = pickRandomRecord(getRandomPool());
      state.randomCurrentNumber = next?.number ?? null;
      setCurrentRecord(next);
      render();
    });

    return;
  }

  if (state.mode === "Keyword Search") {
    const resultOptions = getKeywordResults().map((record) => ({
      value: String(record.number),
      label: `#${record.number} [${record.section}] - ${record.situation.slice(0, 70)}${record.situation.length > 70 ? "…" : ""}`,
    }));

    refs.modeControls.innerHTML = `
      <div class="control-row">
        ${makeField("Search within", makeSelect(["All", "Situations", "Resolutions"], state.keywordField, 'id="keywordField"'), true)}
        ${makeField("Limit to stroke / topic", makeSelect(["All", ...sections], state.keywordSection, 'id="keywordSection"'))}
      </div>
      <div class="control-row">
        ${makeField(
          "Keyword or phrase",
          `<input id="keywordQuery" class="text-input" type="text" value="${escapeHtml(state.keywordQuery)}" placeholder="Search…">`,
        )}
      </div>
      ${resultOptions.length ? `
        <div class="search-results-row">
          ${makeField(
            "Matching result",
            makeSelect(resultOptions, String(state.keywordCurrentNumber ?? resultOptions[0]?.value ?? ""), 'id="keywordResult"'),
          )}
        </div>
      ` : state.keywordQuery.trim() ? '<div class="notice notice--warning">No matches found. Try broadening your search.</div>' : ''}
    `;

    document.getElementById("keywordField")?.addEventListener("change", (event) => {
      state.keywordField = event.target.value;
      state.keywordCurrentNumber = null;
      updateCurrentRecordFromMode();
      savePreferences();
      render();
    });

    document.getElementById("keywordSection")?.addEventListener("change", (event) => {
      state.keywordSection = event.target.value;
      state.keywordCurrentNumber = null;
      updateCurrentRecordFromMode();
      savePreferences();
      render();
    });

    document.getElementById("keywordQuery")?.addEventListener("input", (event) => {
      state.keywordQuery = event.target.value;
      state.keywordCurrentNumber = null;
      updateCurrentRecordFromMode();
      rerenderAndRestoreInput("keywordQuery", event.target.selectionStart, event.target.selectionEnd);
    });

    document.getElementById("keywordResult")?.addEventListener("change", (event) => {
      state.keywordCurrentNumber = Number.parseInt(event.target.value, 10) || null;
      updateCurrentRecordFromMode();
      render();
    });

    return;
  }

  const min = records[0]?.number ?? 1;
  const max = records.at(-1)?.number ?? 1;
  refs.modeControls.innerHTML = `
    <div class="control-row">
      ${makeField(
        "Situation number",
        `<input id="numberQuery" class="number-input" type="number" min="${min}" max="${max}" value="${escapeHtml(state.numberQuery)}" placeholder="e.g. ${min}">`,
        true,
      )}
    </div>
  `;

  document.getElementById("numberQuery")?.addEventListener("input", (event) => {
    state.numberQuery = event.target.value;
    updateCurrentRecordFromMode();
    rerenderAndRestoreInput("numberQuery", event.target.selectionStart, event.target.selectionEnd);
  });
}

function renderCard() {
  const record = getCurrentRecord();
  if (!record) {
    refs.resultCard.classList.add("hidden");
    refs.emptyState.classList.remove("hidden");

    if (!records.length) {
      refs.emptyState.innerHTML = `
        <h3>Loading data…</h3>
        <p>Please wait while the study deck is prepared.</p>
      `;
      return;
    }

    refs.emptyState.innerHTML = `
      <h3>No card selected</h3>
      <p>${state.mode === "Keyword Search" ? "Adjust your search terms to find a matching situation." : "Choose a study option to load a situation."}</p>
    `;
    return;
  }

  refs.emptyState.classList.add("hidden");
  refs.resultCard.classList.remove("hidden");

  refs.cardSectionLabel.textContent = record.section;
  refs.cardNumberLabel.textContent = `Situation #${record.number}`;

  const shouldHighlight = state.mode === "Keyword Search" && state.keywordQuery.trim();
  refs.situationText.innerHTML = shouldHighlight
    ? highlightText(record.situation, state.keywordQuery)
    : escapeHtml(record.situation);

  const showResolution = !state.hideResolution || state.revealResolution;
  refs.revealButton.classList.toggle("hidden", showResolution);
  refs.resolutionText.classList.toggle("hidden", !showResolution);

  refs.resolutionText.innerHTML = showResolution
    ? shouldHighlight
      ? highlightText(record.resolution, state.keywordQuery)
      : escapeHtml(record.resolution)
    : "";

  refs.ruleText.textContent = record.rule;
}

function updateOptionControls() {
  document.documentElement.style.setProperty("--study-font-size", `${state.fontSize}px`);
  refs.hideResolution.checked = state.hideResolution;
  refs.fontSize.value = String(state.fontSize);
  refs.fontSizeValue.textContent = `${state.fontSize}px`;
}

function parseInitialQuery() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  const item = params.get("item");

  if (mode && MODES.includes(mode)) {
    state.mode = mode;
  }

  if (item) {
    state.numberQuery = item;
    state.mode = mode && MODES.includes(mode) ? mode : "Search by Number";
  }
}

function createDeepLink() {
  const record = getCurrentRecord();
  const url = new URL(window.location.href);
  url.searchParams.set("mode", state.mode);
  if (record) {
    url.searchParams.set("item", String(record.number));
  } else {
    url.searchParams.delete("item");
  }
  return url.toString();
}

async function copyDeepLink() {
  try {
    await navigator.clipboard.writeText(createDeepLink());
    refs.copyLinkButton.textContent = "Link copied";
    window.setTimeout(() => {
      refs.copyLinkButton.textContent = "Copy deep link";
    }, 1400);
  } catch {
    refs.copyLinkButton.textContent = "Copy failed";
    window.setTimeout(() => {
      refs.copyLinkButton.textContent = "Copy deep link";
    }, 1400);
  }
}

function render() {
  renderModeButtons();
  renderStatus();
  renderControls();
  renderCard();
  updateOptionControls();
  savePreferences();
}

function rerenderAndRestoreInput(inputId, selectionStart = null, selectionEnd = null) {
  render();

  const input = document.getElementById(inputId);
  if (!input) {
    return;
  }

  input.focus();

  if (selectionStart !== null && selectionEnd !== null && typeof input.setSelectionRange === "function") {
    input.setSelectionRange(selectionStart, selectionEnd);
  }
}

function normalizeRecord(row) {
  const section = String(row.Section ?? row.section ?? "").trim();
  const number = Number.parseInt(String(row.Number ?? row.number ?? "").trim(), 10);
  const situation = String(row.Situation ?? row.situation ?? "").trim();
  const resolution = String(row["Recommended Resolution"] ?? row["Recommended resolution"] ?? row.resolution ?? "").trim();
  const rule = String(row["Applicable Rule"] ?? row.rule ?? "").trim();

  if (!section || !Number.isFinite(number) || !situation) {
    return null;
  }

  return {
    section,
    number,
    situation,
    resolution,
    rule,
  };
}

function decodeCsvBuffer(buffer) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

async function loadData() {
  const response = await fetch("./Situations-n-Resolutions-with-sections.csv", { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Failed to load CSV (${response.status})`);
  }

  const csvBuffer = await response.arrayBuffer();
  const csvText = decodeCsvBuffer(csvBuffer);
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors?.length) {
    console.warn("CSV parse warnings", parsed.errors);
  }

  records = parsed.data
    .map(normalizeRecord)
    .filter(Boolean)
    .sort((left, right) => left.number - right.number);

  sections = [...new Set(records.map((record) => record.section))].sort((a, b) => a.localeCompare(b));
  refs.datasetCount.textContent = `${records.length} situations`;
  ensureDefaults();
  updateCurrentRecordFromMode();
  render();
}

function attachGlobalHandlers() {
  refs.hideResolution.addEventListener("change", (event) => {
    state.hideResolution = event.target.checked;
    if (!state.hideResolution) {
      state.revealResolution = false;
    }
    renderCard();
    savePreferences();
  });

  refs.fontSize.addEventListener("input", (event) => {
    state.fontSize = Number.parseInt(event.target.value, 10) || DEFAULT_FONT_SIZE;
    updateOptionControls();
    savePreferences();
  });

  refs.revealButton.addEventListener("click", () => {
    state.revealResolution = true;
    renderCard();
  });

  refs.copyLinkButton.addEventListener("click", () => {
    copyDeepLink();
  });
}

async function init() {
  loadPreferences();
  parseInitialQuery();
  attachGlobalHandlers();
  updateOptionControls();
  render();

  try {
    await loadData();
  } catch (error) {
    console.error(error);
    refs.datasetCount.textContent = "Load failed";
    refs.modeControls.innerHTML = "";
    refs.statusBar.textContent = "Unable to load the situations CSV.";
    refs.resultCard.classList.add("hidden");
    refs.emptyState.classList.remove("hidden");
    refs.emptyState.innerHTML = `
      <h3>Unable to load data</h3>
      <p>${escapeHtml(error.message)}</p>
    `;
  }
}

init();
