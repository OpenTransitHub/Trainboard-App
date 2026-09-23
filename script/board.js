document.addEventListener("DOMContentLoaded", () => {
    const COLOR_MAP = {
        default: {
            name: "blue",
            color: "#2097f4"
        },
        blue: {
            name: "blue",
            color: "#2097f4",
            categories: ["bus"]
        },
        red: {
            name: "red",
            color: "#ff2d55",
            categories: ["nationalexpress", "national", "longdistance","mberlinerverkehrsbetriebe", "strassenbahn","dvbstraenbahn", "t", "ic", "ice", "rj", "rjx", "fr", "tgv", "eur", "mv", "ec", "ics"],
            operators: []
        },
        green: {
            name: "green",
            color: "#34c759",
            categories: ["dbszugnr", "sszugnr", "szugnr", "s", "avr", "evr", "uvr", "pvr", "ivr", "kvr", "rvr", "rerzugnr"],
            operators: ["flixbus", "flixtrain", "flix"]
        },
        teal: {
            name: "teal",
            color: "#00c3d0",
            categories: ["rezugnr", "rbzugnr", "fexzugnr", "re", "rb", "rexzugnr", "rzugnr", "fb", "terzugnr", "lpv", "lp", "rg", "lokalbaner"],
        },
        orange: {
            name: "orange",
            color: "#ff8d28",
            categories: ["interregional", "ir", "cjxzugnr","leo", "mhelsinginseudunliikenne"],
            operators: ["overground"]
        },
        purple: {
            name: "purple",
            color: "#cb30e0",
            categories: [],
            operators: ["thameslink"]
        }
    };

    function getColorObject(rawOperator, lineInfo) {
        let matchedOperatorColor = null;
        let matchedComboColor = null;
        let matchedCategoryColor = null;

        const opString = typeof rawOperator === "string" ? rawOperator : (rawOperator?.name || rawOperator?.id || "");
        const lineString = typeof lineInfo === "string" ? lineInfo : "";
        const extractedCategory = lineString.toLowerCase().replace(/[^a-z]/g, '');

        const extractedOperator = opString.toLowerCase().replace(/[^a-z0-9]/g, '');

        const extractedCombo = extractedCategory + extractedOperator;

        console.log(`[getColorObject] Extrahiert -> Cat: "${extractedCategory}" | Op: "${extractedOperator}" | Combo: "${extractedCombo}"`);

        if (extractedOperator) {
            for (const key in COLOR_MAP) {
                if (key === "default") continue;
                const config = COLOR_MAP[key];
                if (Array.isArray(config.operators)) {
                    if (config.operators.some(op => op.toLowerCase().replace(/[^a-z0-9]/g, '') === extractedOperator)) {
                        matchedOperatorColor = config;
                        console.log(`[getColorObject] Match Prio 1 (Operator) bei "${key}"`);
                        break;
                    }
                }
            }
        }

        if (extractedCombo) {
            for (const key in COLOR_MAP) {
                if (key === "default") continue;
                const config = COLOR_MAP[key];
                if (Array.isArray(config.categories)) {
                    if (config.categories.some(cat => cat.toLowerCase().replace(/[^a-z]/g, '') === extractedCombo)) {
                        matchedComboColor = config;
                        console.log(`[getColorObject] Match Prio 2 (Combo in categories) bei "${key}"`);
                        break;
                    }
                }
            }
        }

        if (extractedCategory) {
            for (const key in COLOR_MAP) {
                if (key === "default") continue;
                const config = COLOR_MAP[key];
                if (Array.isArray(config.categories)) {
                    if (config.categories.some(cat => cat.toLowerCase().replace(/[^a-z]/g, '') === extractedCategory)) {
                        matchedCategoryColor = config;
                        console.log(`[getColorObject] Match Prio 3 (Category) bei "${key}"`);
                        break;
                    }
                }
            }
        }

        const finalColor = matchedOperatorColor || matchedComboColor || matchedCategoryColor || COLOR_MAP.default;
        console.log(`[getColorObject] Finale Farbe: ${finalColor.name} (${finalColor.color})`);

        return finalColor;
    }

    const stationNameElement = document.getElementById("station-name");
    const container = document.getElementById("board-container");
    const categoryContainer = document.getElementById("category-checkboxes");
    const tabDepartures = document.getElementById("tab-departures");
    const tabArrivals = document.getElementById("tab-arrivals");

    const selectedApiCode = localStorage.getItem("selectedApiCode") || "DE";
    const selectedProviderName = localStorage.getItem("selectedProviderName") || "Deutsche Bahn (DB)";

    const urlParams = new URLSearchParams(window.location.search);
    const stationId = urlParams.get("stationId");
    const stationName = urlParams.get("stationName");

    let currentMode = "departures";
    let rawDepartures = [];
    let rawArrivals = [];
    let availableCategories = new Set();

    let savedCategoryFilters = JSON.parse(localStorage.getItem("categoryFilters")) || null;

    if (stationName) {
        stationNameElement.textContent = stationName;
    }

    if (!stationId) {
        container.textContent = "Keine Station ausgewählt.";
        return;
    }

    function getItemCategoryKey(item) {
        if (selectedApiCode.toUpperCase() === "AT") {
            return (typeof item.operator === "string" ? item.operator : item.operator?.name) || "Sonstige";
        }
        return (typeof item.category === "string" ? item.category : item.category?.name) || "Sonstige";
    }

    updateTabs();
    fetchBoardData();

    tabDepartures.addEventListener("click", (e) => {
        e.preventDefault();
        if (currentMode !== "departures") {
            currentMode = "departures";
            updateTabs();
            fetchBoardData();
        }
    });

    tabArrivals.addEventListener("click", (e) => {
        e.preventDefault();
        if (currentMode !== "arrivals") {
            currentMode = "arrivals";
            updateTabs();
            fetchBoardData();
        }
    });

    function updateTabs() {
        tabDepartures.classList.toggle("active", currentMode === "departures");
        tabArrivals.classList.toggle("active", currentMode === "arrivals");
    }

    function fetchBoardData() {
        const endpoint = currentMode === "arrivals" ? "arrivals" : "departures";
        const apiUrl = `https://prod.cuzimmartin.dev/api/${selectedApiCode}/${endpoint}?stationId=${encodeURIComponent(stationId)}&limit=20`;

        console.log("Gefetchte Board-API-URL:", apiUrl);

        fetch(apiUrl)
            .then(response => response.json())
            .then(result => {
                if (result.success && Array.isArray(result.data)) {
                    if (currentMode === "arrivals") {
                        rawArrivals = result.data;
                        extractAndRenderCategories(rawArrivals);
                    } else {
                        rawDepartures = result.data;
                        extractAndRenderCategories(rawDepartures);
                    }
                    renderCurrentView();
                } else {
                    container.textContent = "Keine Daten gefunden oder Fehler beim Laden.";
                }
            })
            .catch(error => {
                console.error("Fetch-Fehler:", error);
                container.textContent = "Fehler bei der Verbindung zur API.";
            });
    }

    function extractAndRenderCategories(items) {
        availableCategories.clear();
        items.forEach(item => {
            const category = getItemCategoryKey(item);
            availableCategories.add(category);
        });

        if (!savedCategoryFilters) {
            savedCategoryFilters = {};
            availableCategories.forEach(cat => {
                savedCategoryFilters[cat] = true;
            });
            localStorage.setItem("categoryFilters", JSON.stringify(savedCategoryFilters));
        } else {
            availableCategories.forEach(cat => {
                if (savedCategoryFilters[cat] === undefined) {
                    savedCategoryFilters[cat] = true;
                }
            });
            localStorage.setItem("categoryFilters", JSON.stringify(savedCategoryFilters));
        }

        renderCategoryCheckboxes();
    }

    function renderCategoryCheckboxes() {
        categoryContainer.innerHTML = "";

        if (availableCategories.size === 0) {
            categoryContainer.textContent = "Keine Filter vorhanden.";
            return;
        }

        availableCategories.forEach(category => {
            const wrapper = document.createElement("label");
            wrapper.style.marginRight = "10px";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.value = category;
            checkbox.checked = savedCategoryFilters[category] !== false;

            checkbox.addEventListener("change", () => {
                savedCategoryFilters[category] = checkbox.checked;
                localStorage.setItem("categoryFilters", JSON.stringify(savedCategoryFilters));
                renderCurrentView();
            });

            wrapper.appendChild(checkbox);
            wrapper.appendChild(document.createTextNode(" " + category));
            categoryContainer.appendChild(wrapper);
        });
    }

    function filterItems(items) {
        return items.filter(item => {
            const category = getItemCategoryKey(item);
            return savedCategoryFilters[category] !== false;
        });
    }

    function renderCurrentView() {
        if (currentMode === "arrivals") {
            renderSingleList(filterItems(rawArrivals), "arrivals");
        } else {
            renderSingleList(filterItems(rawDepartures), "departures");
        }
    }

    function renderSingleList(items, mode) {
        container.innerHTML = "";
        appendListItems(container, items, mode);
    }

    function appendListItems(targetContainer, items, mode) {
        if (items.length === 0) {
            targetContainer.innerHTML += mode === "arrivals" 
                ? `<br><br><br><center><b>Keine weiteren Ankünfe an dieser Station</b><br><br><br><small class="secondary"><b>Du vermisst eine Ankunft?</b><br>Überprüfe deine gewählten Filter oder wechsle den Daten-Provider.</small>` 
                : `<br><br><br><center><b>Keine weiteren Abfahrten an dieser Station</b><br><br><br><small class="secondary"><b>Du vermisst eine Abfahrt?</b><br>Überprüfe deine gewählten Filter oder wechsle den Daten-Provider.</small>`;
            return;
        }

        const itemsHtml = items.map(item => {
            const schedTime = formatTime(item.scheduledTime);
            const estTime = formatTime(item.estimatedTime);
            const delay = item.delay || 0;

            let delayColor = "green";
            if (delay > 0 && delay <= 5) delayColor = "orange";
            if (delay > 5) delayColor = "red";

            const lineInfo = item.line || item.category || "Fahrt";
            
            // Flexibles Auslesen der Platform (sowohl als Objekt { planned, actual } als auch als String/Zahl)
            let platformInfo = "";
            if (item.platform) {
                if (typeof item.platform === "object") {
                    platformInfo = item.platform.actual || item.platform.planned || "";
                } else {
                    platformInfo = item.platform;
                }
            }

            const locationLabel = mode === "arrivals" ? "von" : "";
            const locationValue = mode === "arrivals" 
                ? (item.origin || item.destination || "Unbekannt") 
                : (item.destination || "Unbekannt");

            const colorObj = getColorObject(item.operator, lineInfo);
            const rawHexColor = colorObj.color ? colorObj.color.replace("#", "") : "";
            const operatorDisplay = typeof item.operator === "string" ? item.operator : (item.operator?.name || "");

            return `
                <div class="board-item" data-trip-id="${item.tripId || ''}" data-line-color="${rawHexColor}" style="cursor: pointer;">

                    <table><tr class="wide">
                        <td>${schedTime}<br><span style="color: ${delayColor}">${estTime}</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</td>
                        <td class="wide"><span class="linelabel" style="background-color: ${colorObj.color} !important; color: #ffffff !important;">&nbsp;&nbsp;
                            ${lineInfo
                                .replace(/\s*\(.*/, "")
                                .replace(/DB S/g, "S")
                                .replace(/S S/g, "S")}
  
                            &nbsp;&nbsp;</span>&nbsp;&nbsp;<small class="secondary">${operatorDisplay}</small><br>${locationLabel} ${locationValue}</td>
                        <td style="white-space: nowrap;">${platformInfo} </td>
                    </tr></table>
                    
                </div>
            `;
        }).join("");

        targetContainer.innerHTML += itemsHtml;

        targetContainer.querySelectorAll(".board-item").forEach(itemElement => {
            itemElement.addEventListener("click", () => {
                const tripId = itemElement.dataset.tripId;
                const lineColor = itemElement.dataset.lineColor;

                if (tripId) {
                    const colorParam = lineColor ? `&linecolor=${encodeURIComponent(lineColor)}` : "";
                    window.location.href = `trip.html?tripId=${encodeURIComponent(tripId)}${colorParam}`;
                } else {
                    alert("Für diese Fahrt ist keine tripId verfügbar.");
                }
            });
        });
    }

    function formatTime(isoString) {
        if (!isoString) return "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;";
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    const favButton = document.getElementById("favbutton");

if (favButton && stationId && stationName) {
    const currentOperatorId = localStorage.getItem("selectedoperatorId") || "db";
    const currentProviderKey = localStorage.getItem("selectedProviderKey") || "DE:DB";

    function isFavorite() {
        const favorites = JSON.parse(localStorage.getItem("favoriteStations")) || [];
        return favorites.some(fav => fav.id === stationId && fav.apiCode === selectedApiCode);
    }

    function updateFavButtonUI() {
        if (isFavorite()) {
            favButton.classList.add("active"); // Optional: CSS-Klasse für aktiven/gefüllten Zustand
        } else {
            favButton.classList.remove("active");
        }
    }

    favButton.addEventListener("click", () => {
        let favorites = JSON.parse(localStorage.getItem("favoriteStations")) || [];

        if (isFavorite()) {
            favorites = favorites.filter(fav => !(fav.id === stationId && fav.apiCode === selectedApiCode));
        } else {
            favorites.push({
                id: stationId,
                name: stationName,
                apiCode: selectedApiCode,
                providerName: selectedProviderName,
                providerKey: currentProviderKey,
                operatorId: currentOperatorId
            });
        }

        localStorage.setItem("favoriteStations", JSON.stringify(favorites));
        updateFavButtonUI();
    });

    updateFavButtonUI();
}
});

const filterButton = document.getElementById('filterbutton');
const categoryFilters = document.getElementById('category-filters');

filterButton.addEventListener('click', () => {
  categoryFilters.classList.toggle('hidden');
});