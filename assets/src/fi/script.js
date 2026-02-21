const siteType = getSiteTypeFromURL();
const urlParams = new URLSearchParams(window.location.search);
const provider = window.ProviderStore ? ProviderStore.getProvider() : {
    providerName: "VR Finland",
    providerID: "vr",
    operatorId: "vr",
    apiPath: "fi"
};
const BOARD_LIMIT = 300;
const stationID = urlParams.get("station");
let hiddentrainnumbers = urlParams.get("trainnumbers");
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
    const url = new URL(`https://prod.cuzimmartin.dev/api/fi/${endpoint}`);
    Object.keys(params || {}).forEach((key) => {
        if (params[key] !== undefined && params[key] !== null && params[key] !== "") {
            url.searchParams.set(key, String(params[key]));
        }
    });
    return url.toString();
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

function getEntryLineName(entry) {
    if (entry && typeof entry.line === "string" && entry.line.length > 0) {
        return entry.line;
    }
    if (entry && entry.metadata && typeof entry.metadata.commuterLineID === "string" && entry.metadata.commuterLineID.length > 0) {
        return entry.metadata.commuterLineID;
    }
    return entry.category || "?";
}

function getEntryProduct(entry) {
    if (!entry) {
        return "";
    }
    const category = typeof entry.category === "string" ? entry.category.toLowerCase() : "";
    if (category === "commuter") {
        return "suburban";
    }
    return category;
}

function isSuburbanEntry(entry) {
    const product = getEntryProduct(entry);
    if (product === "suburban" || product === "commuter") {
        return true;
    }
    if (entry && entry.metadata && entry.metadata.commuterLineID) {
        return true;
    }
    const line = getEntryLineName(entry).trim();
    return /^[A-Z]$/.test(line);
}

async function detectSuburbanAvailability(station) {
    try {
        const response = await fetch(apiUrl("departures", { stationId: station, limit: 120 }), { method: "GET", mode: "cors" });
        if (!response.ok) {
            return false;
        }
        const json = await response.json();
        const departures = normalizeList(json, false);
        return departures.some((entry) => isSuburbanEntry(entry));
    } catch {
        return false;
    }
}

async function fetchStationData(station) {
    if (stationNameFromParam) {
        const hasSuburbanFallback = await detectSuburbanAvailability(station);
        processStationInfo({ name: stationNameFromParam, metadata: { suburbanAvailable: hasSuburbanFallback } }, station);
        return;
    }

    try {
        const response = await fetch(apiUrl("stations", { query: station, limit: 1 }), { method: "GET", mode: "cors" });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const json = await response.json();
        const first = json && json.success && Array.isArray(json.data) ? json.data[0] : null;
        const stationName = first && first.name ? first.name : station;
        stationNameFromParam = stationName;
        const hasSuburbanFallback = await detectSuburbanAvailability(station);
        processStationInfo({ name: stationName, metadata: { suburbanAvailable: hasSuburbanFallback } }, station);
    } catch {
        const hasSuburbanFallback = await detectSuburbanAvailability(station);
        processStationInfo({ name: station, metadata: { suburbanAvailable: hasSuburbanFallback } }, station);
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
    const hasSuburban = Boolean(data && data.metadata && data.metadata.suburbanAvailable);

    if (siteType === "S" && !hasSuburban) {
        window.location.href = `departure.html?${stationQuery(station)}`;
        return;
    }

    let navbarContent = "";
    if (hasSuburban) {
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

    navbarContent += `<div class="iconbar"><a class="navsearch" href="index.html">Stationssuche</a></div>`;
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

function getScheduled(entry) {
    return entry.scheduledTime || null;
}

function getActual(entry) {
    return entry.estimatedTime || entry.scheduledTime || null;
}

function isCancelledEntry(entry) {
    return entry && (entry.cancelled === true || entry.status === "cancelled");
}

function getDestination(entry, isArrival) {
    if (isArrival) {
        return entry.origin || entry.originId || "Unbekannt";
    }
    return entry.destination || entry.destinationId || "Unbekannt";
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

function getBadgeClasses(entry) {
    const classes = ["linebadge", "vr"];
    const line = getEntryLineName(entry);
    if (line) {
        classes.push(String(line).toUpperCase());
        classes.push(`fi-${String(line).toUpperCase()}`);
    }
    if (isSuburbanEntry(entry)) {
        classes.push("suburban", "fi-commuter");
    } else {
        classes.push("national");
    }
    return classes.join(" ");
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

        const isSuburban = isSuburbanEntry(entry);
        if (siteType === "S" && !isSuburban) {
            return;
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
        const tripNumber = entry.tripNumber || "";
        const numberHtml = hiddentrainnumbers === "show" && tripNumber ? `<br><small>${tripNumber}</small>` : "";
        const trip = tripUrl(entry, scheduled);
        const badge = `<div class="${getBadgeClasses(entry)}">${lineName}${numberHtml}</div>`;
        row.insertCell(0).innerHTML = asLink(trip, badge);

        const timediff = Math.round((realDate - now) / (1000 * 60));
        const countdownCell = row.insertCell(1);
        const delayDifference = Math.abs(realDate - plannedDate) / (1000 * 60);
        if (timediff <= 60 && realtime && !isArrival) {
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

        const platformCell = row.insertCell(3);
        let platform = entry.platform || "";
        if (!platform || platform === "unknown") {
            platform = "";
        }
        if (isCancelled) {
            platformCell.innerHTML = asLink(trip, `<s>${platform || '-'}</s>`);
        } else if (!platform) {
            platformCell.innerHTML = asLink(trip, "-");
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
