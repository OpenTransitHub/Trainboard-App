const siteType = getSiteTypeFromURL();
const urlParams = new URLSearchParams(window.location.search);
const provider = window.ProviderStore ? ProviderStore.getProvider() : {
    providerName: "Deutsche Bahn",
    providerID: "db",
    operatorId: "db",
    apiPath: "de"
};
const BOARD_LIMIT = (provider && provider.apiPath === "at") ? 250 : 100;
const stationID = urlParams.get("station");
let hiddentrainnumbers = urlParams.get("trainnumbers");
let showsuburban = urlParams.get("suburban");
let stationNameFromParam = urlParams.get("stationName");

const hiddennavbar = urlParams.get("navbar");
if (hiddennavbar === "hide" || localStorage.getItem("shownavbar") === "false") {
    document.getElementById("navbar").classList.add("hidden");
}

const hiddenclock = urlParams.get("clock");
if (hiddenclock === "hide" || localStorage.getItem("showclock") === "false") {
    document.getElementById("clock").classList.add("hidden");
}

if (localStorage.getItem("showtrainnumbers") === "true") {
    hiddentrainnumbers = "show";
}

const notouch = urlParams.get("touch");
if (notouch === "no" || localStorage.getItem("disabletouch") === "true") {
    document.getElementById("notouch").classList.remove("hidden");
}

if (localStorage.getItem("showsuburbans") === "true") {
    showsuburban = "show";
}

if (!stationID) {
    document.getElementById("tableBody").innerHTML = '<tr><td colspan="4">Fehler: Keine Station ausgewählt</td></tr>';
} else {
    fetchStationData(stationID);
    loadData();
    setInterval(loadData, 5000);
}

updateClock();
setInterval(updateClock, 1000);

function getSiteTypeFromURL() {
    const url = window.location.href;
    const types = {
        "departure.html": "D",
        "arrival.html": "A",
        "suburban.html": "S",
        "local.html": "L",
        "combo.html": "C"
    };
    for (const [page, type] of Object.entries(types)) {
        if (url.includes(page)) {
            return type;
        }
    }
    return "D";
}

function apiUrl(endpoint, params) {
    if (window.ProviderStore) {
        return ProviderStore.buildApiUrl(endpoint, params, provider);
    }
    const url = new URL(`https://prod.cuzimmartin.dev/api/${provider.apiPath}/${endpoint}`);
    Object.keys(params || {}).forEach((key) => {
        if (params[key] !== undefined && params[key] !== null && params[key] !== "") {
            url.searchParams.set(key, String(params[key]));
        }
    });
    if (provider.operatorId) {
        url.searchParams.set("operator", provider.operatorId);
    }
    return url.toString();
}

async function fetchStationData(station) {
    if (stationNameFromParam) {
        const hasSuburbanFallback = await detectSuburbanAvailability(station);
        processStationInfo({ name: stationNameFromParam, products: { suburban: hasSuburbanFallback } }, station);
        return;
    }
    try {
        const response = await fetch(apiUrl("stations", { query: station, limit: 5 }), {
            method: "GET",
            mode: "cors"
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const json = await response.json();
        const first = json && json.success && Array.isArray(json.data) ? json.data[0] : null;
        let products = first && first.metadata && first.metadata.products ? first.metadata.products : null;
        const hasSuburbanMeta = Boolean(products && products.suburban === true);
        if (!hasSuburbanMeta) {
            const hasSuburbanFallback = await detectSuburbanAvailability(station);
            products = {
                ...(products || {}),
                suburban: hasSuburbanFallback
            };
        }
        const stationName = first && first.name ? first.name : station;
        stationNameFromParam = stationName;
        processStationInfo({ name: stationName, products: products }, station);
    } catch {
        const hasSuburbanFallback = await detectSuburbanAvailability(station);
        processStationInfo({ name: station, products: { suburban: hasSuburbanFallback } }, station);
    }
}

async function detectSuburbanAvailability(station) {
    try {
        const response = await fetch(apiUrl("departures", { stationId: station, limit: 120 }), {
            method: "GET",
            mode: "cors"
        });
        if (!response.ok) {
            return false;
        }
        const json = await response.json();
        const departures = normalizeList(json, false);
        return departures.some((entry) => {
            const product = String(getEntryProduct(entry)).toLowerCase();
            return isSuburbanEntry(entry, product);
        });
    } catch {
        return false;
    }
}

function stationQuery(station) {
    if (!stationNameFromParam) {
        return `station=${encodeURIComponent(station)}`;
    }
    return `station=${encodeURIComponent(station)}&stationName=${encodeURIComponent(stationNameFromParam)}`;
}

function processStationInfo(data, station) {
    const navbarDiv = document.getElementById("navbar");
    const products = data && data.products ? data.products : null;
    const hasSuburban = Boolean(products && products.suburban === true);
    if (siteType === "S" && !hasSuburban) {
        window.location.href = `departure.html?${stationQuery(station)}`;
        return;
    }

    let navbarContent = "";
    if (siteType === "L") {
        navbarContent += '<div class="tabs"><a href="#" class="active">&nbsp;Nahverkehr&nbsp;</a></div>';
    } else if (hasSuburban) {
        navbarContent += `<div class="tabs">
            <a href="departure.html?${stationQuery(station)}" class="${siteType === "D" ? "active" : ""}">&nbsp;Abfahrt&nbsp;</a>
            <a href="arrival.html?${stationQuery(station)}" class="${siteType === "A" ? "active" : ""}">&nbsp;Ankunft&nbsp;</a>
            <a href="suburban.html?${stationQuery(station)}" class="${siteType === "S" ? "active" : ""}">&nbsp;S-Bahn&nbsp;</a>
            <a href="combo.html?${stationQuery(station)}" class="${siteType === "C" ? "active" : ""}">&nbsp;Combo&nbsp;</a>
        </div>`;
    } else {
        navbarContent += `<div class="tabs">
            <a href="departure.html?${stationQuery(station)}" class="${siteType === "D" ? "active" : ""}">&nbsp;Abfahrt&nbsp;</a>
            <a href="arrival.html?${stationQuery(station)}" class="${siteType === "A" ? "active" : ""}">&nbsp;Ankunft&nbsp;</a>
            <a href="#" class="disabled">&nbsp;S-Bahn&nbsp;</a>
            <a href="combo.html?${stationQuery(station)}" class="${siteType === "C" ? "active" : ""}">&nbsp;Combo&nbsp;</a>
        </div>`;
    }

    navbarContent += `<div class="iconbar"><a class="navsearch" href="${siteType === "L" ? "localsearch" : "index"}.html">${siteType === "L" ? "Haltestellen" : "Stations"}suche</a></div>`;
    navbarDiv.innerHTML = navbarContent;

    document.getElementById("stationname").textContent = data.name;
    if (document.getElementById("stationname2")) {
        document.getElementById("stationname2").textContent = data.name;
    }
    document.getElementById("title").textContent = data.name;
}

function updateClock() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");
    document.getElementById("clock").innerHTML = `${hours}<span class="blink">:</span>${minutes}`;
}

function normalizeList(jsonData, isArrival) {
    if (jsonData && Array.isArray(jsonData.data)) {
        return jsonData.data;
    }
    if (isArrival && jsonData && Array.isArray(jsonData.arrivals)) {
        return jsonData.arrivals;
    }
    if (!isArrival && jsonData && Array.isArray(jsonData.departures)) {
        return jsonData.departures;
    }
    return [];
}

async function loadData() {
    if (siteType === "C") {
        await loadDepartures();
        await loadArrivals();
        return;
    }
    const endpoint = siteType === "A" ? "arrivals" : "departures";
    try {
        const response = await fetch(apiUrl(endpoint, { stationId: stationID, limit: BOARD_LIMIT }), { method: "GET", mode: "cors" });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const jsonData = await response.json();
        const data = normalizeList(jsonData, siteType === "A");
        if (Array.isArray(data) && data.length > 0) {
            updateTable(data, "tableBody", siteType === "A");
            return;
        }
        document.getElementById("tableBody").innerHTML = '<tr><td colspan="4">Keine Daten verfuegbar</td></tr>';
    } catch {
        if (document.getElementById("tableBody").children.length === 0) {
            document.getElementById("tableBody").innerHTML = '<tr><td colspan="4">Fehler beim Laden der Daten</td></tr>';
        }
    }
}

async function loadDepartures() {
    try {
        const response = await fetch(apiUrl("departures", { stationId: stationID, limit: BOARD_LIMIT }), { method: "GET", mode: "cors" });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const jsonData = await response.json();
        updateTable(normalizeList(jsonData, false), "tableBody", false);
    } catch {
        if (document.getElementById("tableBody").children.length === 0) {
            document.getElementById("tableBody").innerHTML = '<tr><td colspan="4">Fehler beim Laden der Abfahrten</td></tr>';
        }
    }
}

async function loadArrivals() {
    try {
        const response = await fetch(apiUrl("arrivals", { stationId: stationID, limit: BOARD_LIMIT }), { method: "GET", mode: "cors" });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const jsonData = await response.json();
        updateTable(normalizeList(jsonData, true), "tableBodyarrival", true);
    } catch {
        if (document.getElementById("tableBodyarrival").children.length === 0) {
            document.getElementById("tableBodyarrival").innerHTML = '<tr><td colspan="4">Fehler beim Laden der Ankuenfte</td></tr>';
        }
    }
}

function getEntryLineName(entry) {
    if (entry.line && typeof entry.line === "object" && entry.line.name) {
        return entry.line.name;
    }
    if (entry.metadata && entry.metadata.lineDetails && typeof entry.metadata.lineDetails.name === "string" && entry.metadata.lineDetails.name.length > 0) {
        return entry.metadata.lineDetails.name;
    }
    if (typeof entry.line === "string" && entry.line.length > 0) {
        return entry.line;
    }
    return entry.category || "?";
}

function getEntryProduct(entry) {
    if (entry.line && typeof entry.line === "object") {
        return entry.line.product || entry.line.productName || "";
    }
    if (entry.metadata && entry.metadata.lineDetails) {
        return entry.metadata.lineDetails.product || entry.metadata.lineDetails.productName || "";
    }
    if (typeof entry.category === "string" && entry.category.length > 0) {
        return entry.category;
    }
    if (typeof entry.tripId === "string" && entry.tripId.includes("_")) {
        return entry.tripId.split("_")[0];
    }
    return "";
}

function getScheduled(entry) {
    return entry.scheduledTime || entry.plannedWhen || entry.when || null;
}

function getActual(entry) {
    return entry.actualTime || entry.estimatedTime || entry.when || entry.scheduledTime || entry.plannedWhen || null;
}

function isCancelledEntry(entry) {
    if (entry.cancelled === true || entry.status === "cancelled") {
        return true;
    }
    if (Array.isArray(entry.remarks)) {
        return entry.remarks.some((r) => r && r.type === "status" && r.code === "cancelled");
    }
    return false;
}

function getDestination(entry, isArrival) {
    if (isArrival) {
        return entry.provenance || entry.stationName || entry.origin || "Unbekannt";
    }
    if (typeof entry.destination === "string") {
        return entry.destination;
    }
    if (entry.destination && typeof entry.destination === "object" && entry.destination.name) {
        return entry.destination.name;
    }
    return entry.direction || "Unbekannt";
}

function getMessages(entry) {
    if (Array.isArray(entry.remarks)) {
        return entry.remarks.map((r) => r && r.text).filter(Boolean);
    }
    if (Array.isArray(entry.messages)) {
        return entry.messages.map((m) => m && m.text).filter(Boolean);
    }
    return [];
}

function getLineMode(entry) {
    if (entry && entry.line && typeof entry.line === "object") {
        const mode = entry.line.mode || entry.line.type || entry.line.vehicleType;
        if (typeof mode === "string") {
            return mode.toLowerCase();
        }
    }
    if (entry && typeof entry.mode === "string") {
        return entry.mode.toLowerCase();
    }
    return "";
}

function hasReplacementHint(entry) {
    const lineName = getEntryLineName(entry).toLowerCase();
    const messages = getMessages(entry).join(" ").toLowerCase();
    const replacementKeywords = [
        "schienenersatzverkehr",
        "schienen ersatzverkehr",
        "schienen-ersatzverkehr",
        "schienenersatz",
        "ersatzverkehr",
        "rail replacement",
        "replacement service",
        "sev"
    ];
    return replacementKeywords.some((keyword) => lineName.includes(keyword) || messages.includes(keyword));
}

function isRailByProductOrMode(productNormalized, modeNormalized) {
    const nonRailProducts = new Set(["bus", "tram", "subway", "ferry", "taxi", "u", "t", "obus", "o-bus", "trolleybus"]);
    const nonRailModes = new Set(["bus", "tram", "subway", "ferry", "taxi", "oncall", "trolleybus", "obus", "o-bus"]);
    if (nonRailProducts.has(productNormalized)) {
        return false;
    }
    if (nonRailModes.has(modeNormalized)) {
        return false;
    }
    return true;
}

function isAtProvider() {
    if (!provider) {
        return false;
    }
    const apiPath = String(provider.apiPath || "").toLowerCase();
    const operatorId = String(provider.operatorId || "").toLowerCase();
    const providerId = String(provider.providerID || "").toLowerCase();
    const providerName = String(provider.providerName || "").toLowerCase();
    return apiPath === "at" ||
        operatorId === "oebb" ||
        providerId === "oebb" ||
        providerName.includes("öbb") ||
        providerName.includes("oebb");
}

function isSuburbanLineByName(lineName) {
    const normalized = String(lineName || "").trim();
    if (!normalized) {
        return false;
    }
    if (/^s[\s-]*bahn/i.test(normalized)) {
        return true;
    }
    if (/^s(?:\s*[-/]?\s*)?\d{1,3}[a-z0-9-]*$/i.test(normalized)) {
        return true;
    }
    if (/^s\d{1,3}[a-z0-9-]*$/i.test(normalized)) {
        return true;
    }
    return false;
}

function shouldFilterForOebb(entry, productNormalized) {
    if (!isAtProvider()) {
        return false;
    }
    const modeNormalized = getLineMode(entry);
    const lineName = getEntryLineName(entry).toLowerCase();
    const busOrTramByName = /\b(o-?bus|obus|bus|tram|stra[ßs]enbahn)\b/i.test(lineName);
    const nonRail = !isRailByProductOrMode(productNormalized, modeNormalized) || busOrTramByName;
    if (!nonRail) {
        return false;
    }
    return !hasReplacementHint(entry);
}

function isSuburbanEntry(entry, productNormalized) {
    if (productNormalized === "suburban" || productNormalized === "s") {
        return true;
    }
    const lineProductName = entry && entry.line && typeof entry.line === "object" && typeof entry.line.productName === "string"
        ? entry.line.productName.toLowerCase()
        : "";
    if (lineProductName === "s" || lineProductName === "suburban") {
        return true;
    }
    const category = typeof entry.category === "string" ? entry.category.toLowerCase() : "";
    if (category === "s") {
        return true;
    }
    const mode = getLineMode(entry);
    if (mode === "suburban" || mode === "s") {
        return true;
    }
    const lineName = getEntryLineName(entry).trim();
    return isSuburbanLineByName(lineName);
}

function normalizeOperatorToken(value) {
    if (value === undefined || value === null) {
        return "";
    }
    return String(value)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/&/g, " und ")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function normalizeOperatorTokenVariants(value) {
    const raw = String(value || "").trim();
    if (!raw) {
        return [];
    }
    const variants = new Set([raw]);
    variants.add(raw.replace(/\(.*?\)/g, " ").trim());
    variants.add(raw.replace(/,.*$/g, " ").trim());
    variants.add(raw.split("/")[0].trim());
    return Array.from(variants)
        .map((item) => normalizeOperatorToken(item))
        .filter(Boolean);
}

function normalizeLineToken(value) {
    if (value === undefined || value === null) {
        return "";
    }
    return String(value)
        .toUpperCase()
        .replace(/\s+/g, "")
        .replace(/[^A-Z0-9]/g, "");
}

function getLinePrefixToken(value) {
    const raw = String(value || "").trim();
    if (!raw) {
        return "";
    }
    const firstPart = raw.split(/\s+/)[0] || "";
    return firstPart.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function mapProductToStyleToken(productValue) {
    const normalized = String(productValue || "").toLowerCase();
    const map = {
        nationalexpress: "nationalExpress",
        national: "national",
        regionalexpress: "RE",
        regional: "regional",
        suburban: "S",
        bus: "Bus",
        tram: "tram",
        subway: "U",
        ferry: "ferry"
    };
    return map[normalized] || "";
}

function getOperatorClassTokens(entry) {
    const candidates = [];
    if (entry && entry.line && typeof entry.line === "object" && entry.line.operator) {
        candidates.push(entry.line.operator.id);
        candidates.push(entry.line.operator.name);
    }
    if (entry && entry.metadata && entry.metadata.lineDetails && entry.metadata.lineDetails.operator) {
        candidates.push(entry.metadata.lineDetails.operator.id);
        candidates.push(entry.metadata.lineDetails.operator.name);
    }
    candidates.push(entry && entry.operator ? entry.operator : "");
    candidates.push(provider && provider.operatorId ? provider.operatorId : "");

    const tokens = new Set();
    const legalForms = new Set(["ag", "gmbh", "mbh", "kg", "kgaa", "se", "ev", "eg"]);

    candidates.forEach((candidate) => {
        normalizeOperatorTokenVariants(candidate).forEach((normalized) => {
            tokens.add(normalized);
            const parts = normalized.split("-").filter(Boolean);
            const withoutLegalForm = parts.filter((part) => !legalForms.has(part)).join("-");
            if (withoutLegalForm && withoutLegalForm !== normalized) {
                tokens.add(withoutLegalForm);
            }
            const strippedPrefixes = [
                withoutLegalForm.replace(/^db-regio-ag-/, ""),
                withoutLegalForm.replace(/^db-regio-/, ""),
                withoutLegalForm.replace(/^db-/, "")
            ].filter(Boolean);
            strippedPrefixes.forEach((token) => {
                if (token && token !== withoutLegalForm) {
                    tokens.add(token);
                }
            });
        });
    });

    return Array.from(tokens);
}

function getBadgeClasses(entry, cssProduct, shortLine, operatorId) {
    const classes = ["linebadge"];
    const linePrefixToken = getLinePrefixToken(shortLine);
    const mappedProductToken = mapProductToStyleToken(cssProduct);
    if (cssProduct) {
        classes.push(String(cssProduct));
    }
    if (mappedProductToken) {
        classes.push(mappedProductToken);
    }
    const lineToken = normalizeLineToken(shortLine);
    const operatorTokens = getOperatorClassTokens(entry);
    if (linePrefixToken) {
        classes.push(linePrefixToken);
    }
    if (lineToken) {
        classes.push(lineToken);
    }
    if (lineToken && operatorId) {
        classes.push(`${lineToken}${operatorId}`);
    }
    if (operatorId) {
        classes.push(String(operatorId));
    }
    operatorTokens.forEach((token) => {
        classes.push(token);
        if (lineToken) {
            classes.push(`${lineToken}${token}`);
        }
    });
    if (isAtProvider()) {
        classes.push("oebb-badge");
        const prefix = shortLine.split(" ")[0].replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
        if (prefix) {
            classes.push(`oebb-${prefix}`);
        }
    }
    return Array.from(new Set(classes.filter(Boolean))).join(" ");
}

function tripUrl(entry, scheduled) {
    if (!entry.tripId) {
        return "#";
    }
    return `trip.html?stationID=${encodeURIComponent(stationID)}&departureTime=${encodeURIComponent(scheduled || "")}&tripId=${encodeURIComponent(entry.tripId)}`;
}

function asLink(url, content) {
    if (!url || url === "#") {
        return content;
    }
    return `<a href="${url}">${content}</a>`;
}

function updateTable(data, tbodyId, isArrival) {
    const tableBody = document.getElementById(tbodyId);
    tableBody.innerHTML = "";
    if (!Array.isArray(data) || data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4">Keine Daten verfuegbar</td></tr>';
        return;
    }

    const sorted = [...data].sort((a, b) => new Date(getScheduled(a)) - new Date(getScheduled(b)));
    let rendered = 0;
    const now = new Date();

    sorted.forEach((entry) => {
        if (!entry) {
            return;
        }
        const product = getEntryProduct(entry);
        const productNormalized = String(product).toLowerCase();
        const suburbanEntry = isSuburbanEntry(entry, productNormalized);
        const suburbanByLine = isSuburbanLineByName(getEntryLineName(entry));
        if (siteType === "L") {
            if (["national", "nationalexpress", "ice", "ic", "ec"].includes(productNormalized)) {
                return;
            }
        }
        if (siteType === "C" || siteType === "D" || siteType === "A") {
            if (isAtProvider()) {
                if (suburbanEntry || suburbanByLine) {
                    return;
                }
            } else if (suburbanEntry && showsuburban !== "show") {
                return;
            }
        }
        if (siteType === "S") {
            if (!(suburbanEntry || suburbanByLine)) {
                return;
            }
        }

        const isCancelled = isCancelledEntry(entry);
        const scheduled = getScheduled(entry);
        const realtime = getActual(entry);
        if (!scheduled) {
            return;
        }
        const plannedDate = new Date(scheduled);
        const realDate = realtime ? new Date(realtime) : plannedDate;
        const diffPlannedMinutes = Math.round((now - plannedDate) / (1000 * 60));
        if (isCancelled && diffPlannedMinutes > 0) {
            return;
        }

        rendered += 1;
        const row = tableBody.insertRow();
        if (isCancelled) {
            row.classList.add("cancelled");
        }

        const lineName = getEntryLineName(entry);
        const lineParts = lineName.split(" ");
        const shortLine = lineParts[0] + (lineParts[1] ? ` ${lineParts[1]}` : "");
        const tripNumber = entry.tripNumber || (entry.line && entry.line.fahrtNr) || "";
        const numberHtml = hiddentrainnumbers === "show" && tripNumber ? `<br><small>${tripNumber}</small>` : "";
        const cssProduct = (entry.line && entry.line.product) || product || "";
        const operatorId = (entry.line && entry.line.operator && entry.line.operator.id) || entry.operator || provider.operatorId || "";
        const trip = tripUrl(entry, scheduled);
        const badge = `<div class="${getBadgeClasses(entry, cssProduct, shortLine, operatorId)}">${shortLine}${numberHtml}</div>`;
        row.insertCell(0).innerHTML = asLink(trip, badge);

        const timediff = Math.round((realDate - now) / (1000 * 60));
        const countdownCell = row.insertCell(1);
        const delayDifference = Math.abs(realDate - plannedDate) / (1000 * 60);
        if ((siteType === "S" || siteType === "L") && timediff <= 60 && realtime && !isArrival) {
            if (timediff <= 0) {
                countdownCell.innerHTML = asLink(trip, "jetzt");
            } else {
                const delayClass = delayDifference > 5 ? 'style="color: #ec0016;"' : "";
                countdownCell.innerHTML = asLink(trip, `<span ${delayClass}>${timediff}<span class="additional">&nbsp;min.</span></span>`);
            }
        } else if (realtime && delayDifference > 0) {
            countdownCell.innerHTML = asLink(trip, `<nobr><s class='disabled'>${formatTime(scheduled)}</s><br> ${formatTime(realtime)}</nobr>`);
        } else {
            countdownCell.innerHTML = asLink(trip, `<span class="timetable">${formatTime(realtime || scheduled)}</span>`);
        }

        const destination = getDestination(entry, isArrival);
        const prefix = isArrival ? '<span class="prefix">Von&nbsp;</span>' : "";
        const wideCell = row.insertCell(2);
        wideCell.innerHTML = `${prefix}${asLink(trip, `<span class="scrolling-wrapper"><span class="scrolling-text station-name">${destination}</span></span>`)}`;
        wideCell.classList.add("wide");
        if (localStorage.getItem("showremarks") === "true") {
            const text = getMessages(entry).join(" +++ ");
            if (text) {
                wideCell.innerHTML += `<div class="remark bigonly">${text}</div>`;
            }
        }

        const platformCell = row.insertCell(3);
        const plannedPlatform = entry.plannedPlatform || entry.platform;
        const platform = entry.platform || "";
        const platformChanged = entry.platformChanged === true || (entry.plannedPlatform && entry.platform && entry.plannedPlatform !== entry.platform);
        if (isCancelled) {
            platformCell.innerHTML = asLink(trip, `<s>${plannedPlatform || platform}</s>`);
        } else if (!platform) {
            platformCell.innerHTML = asLink(trip, "-");
        } else if (platformChanged) {
            platformCell.innerHTML = asLink(trip, `<span class="red">${platform}</span>`);
        } else {
            platformCell.innerHTML = asLink(trip, `${platform}`);
        }

        const statusCell = row.insertCell(4);
        statusCell.classList.add("zerotable");
        statusCell.innerHTML = isCancelled ? '<img src="../assets/cancelled.webp" class="mini">' : getAbMessage(realtime);
    });

    if (rendered === 0) {
        tableBody.innerHTML = '<tr><td colspan="4">Keine Daten verfuegbar</td></tr>';
    }
}

function formatTime(dateString) {
    if (!dateString) {
        return "--:--";
    }
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
        return "--:--";
    }
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getAbMessage(dateTimeString) {
    if (!dateTimeString || siteType === "A") {
        return "";
    }
    const dateTime = new Date(dateTimeString);
    const now = new Date();
    const timediff = Math.round((dateTime - now) / (1000 * 60));
    return timediff <= 0 ? '<img src="../assets/depart.gif" class="mini">' : "";
}
