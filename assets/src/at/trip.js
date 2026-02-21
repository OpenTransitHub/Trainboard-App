const provider = window.ProviderStore ? ProviderStore.getProvider() : {
    providerName: "OEBB Austria",
    providerID: "oebb",
    operatorId: "oebb",
    apiPath: "at"
};

const urlParams = new URLSearchParams(window.location.search);
const tripId = urlParams.get("tripId");
const stationId = urlParams.get("stationID");
const mapLoading = document.getElementById("map-loading");
const lineBadgeElement = document.getElementById("linebadge");
const headerElement = document.getElementById("bigheaderbox");
const pinChip = document.getElementById("pinChip");
const unpinChip = document.getElementById("unpinChip");

let map;
let latestTripData = null;
let mapRouteRendered = false;
let pinHandlersBound = false;
let currentPinnedTripId = "";

if (localStorage.getItem("webfis") === "false") {
    document.getElementById("webfisbutton").classList.add("hidden");
}

document.getElementById("wagonorderbutton").classList.add("hidden");
document.getElementById("webfisbutton").classList.add("hidden");

function buildApiUrl(endpoint, params) {
    if (window.ProviderStore) {
        return ProviderStore.buildApiUrl(endpoint, params, provider);
    }
    const url = new URL(`https://prod.cuzimmartin.dev/api/at/${endpoint}`);
    Object.keys(params || {}).forEach((key) => {
        const value = params[key];
        if (value !== undefined && value !== null && value !== "") {
            url.searchParams.set(key, String(value));
        }
    });
    return url.toString();
}

function getTripUrl() {
    const directUrl = new URL("https://prod.cuzimmartin.dev/api/at/trip");
    directUrl.searchParams.set("tripId", tripId || "");
    return directUrl.toString();
}

function parseTripPayload(payload) {
    if (!payload || typeof payload !== "object") {
        return null;
    }
    if (payload.success && payload.data && typeof payload.data === "object") {
        return payload.data;
    }
    if (payload.trip && typeof payload.trip === "object") {
        return payload.trip;
    }
    return null;
}

function toDate(value) {
    if (!value) {
        return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }
    return parsed;
}

function formatTime(value) {
    const parsed = toDate(value);
    if (!parsed) {
        return "--:--";
    }
    return parsed.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(value) {
    const parsed = toDate(value);
    if (!parsed) {
        return "";
    }
    return parsed.toLocaleDateString("de-DE", {
        year: "numeric",
        month: "long",
        day: "numeric"
    });
}

function formatDuration(startValue, endValue) {
    const start = toDate(startValue);
    const end = toDate(endValue);
    if (!start || !end) {
        return "";
    }
    const totalMinutes = Math.max(0, Math.round((end - start) / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}:${String(minutes).padStart(2, "0")} Std`;
}

function escapeHtml(value) {
    if (window.ProviderStore) {
        return ProviderStore.escapeHtml(value ?? "");
    }
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function getLineName(trip) {
    const line = String(trip.line || "").trim();
    if (!line) {
        return "Zug";
    }
    return line.split("(")[0].trim() || line;
}

function getOperatorName(trip) {
    if (typeof trip.operator === "string" && trip.operator.trim().length > 0) {
        return trip.operator.trim();
    }
    return provider.providerName || "OEBB Austria";
}

function getStops(trip) {
    if (Array.isArray(trip.stops)) {
        return trip.stops;
    }
    if (Array.isArray(trip.stopovers)) {
        return trip.stopovers.map((stopover) => ({
            stationId: stopover.stop && stopover.stop.id ? stopover.stop.id : "",
            stationName: stopover.stop && stopover.stop.name ? stopover.stop.name : "",
            scheduledArrival: stopover.plannedArrival || null,
            estimatedArrival: stopover.arrival || stopover.plannedArrival || null,
            scheduledDeparture: stopover.plannedDeparture || null,
            estimatedDeparture: stopover.departure || stopover.plannedDeparture || null,
            platform: stopover.arrivalPlatform || stopover.departurePlatform || null,
            scheduledPlatform: stopover.plannedArrivalPlatform || stopover.plannedDeparturePlatform || null,
            actualPlatform: stopover.arrivalPlatform || stopover.departurePlatform || null,
            platformChanged: stopover.platformChanged === true,
            messages: Array.isArray(stopover.remarks)
                ? stopover.remarks.map((remark) => ({ type: remark.type || "info", text: remark.text || "" }))
                : []
        }));
    }
    return [];
}

function getPrimaryDeparture(stop) {
    return stop.estimatedDeparture || stop.scheduledDeparture || stop.estimatedArrival || stop.scheduledArrival || null;
}

function getPrimaryArrival(stop) {
    return stop.estimatedArrival || stop.scheduledArrival || stop.estimatedDeparture || stop.scheduledDeparture || null;
}

function isCancelledStop(stop) {
    if (!stop || (stop.cancelled !== true && stop.status !== "cancelled")) {
        return false;
    }
    const hasEstimatedTime = Boolean(stop.estimatedArrival || stop.estimatedDeparture);
    return !hasEstimatedTime;
}

function getStopClassList(stops) {
    const now = new Date();
    const classes = stops.map(() => "stop-future");

    for (let i = 0; i < stops.length; i += 1) {
        const stop = stops[i];
        if (isCancelledStop(stop)) {
            classes[i] = "stop-cancelled";
            continue;
        }
        const departureOrArrival = toDate(getPrimaryDeparture(stop) || getPrimaryArrival(stop));
        if (departureOrArrival && departureOrArrival < now) {
            classes[i] = "stop-past";
        }
    }

    const firstFutureIndex = classes.findIndex((value) => value === "stop-future");
    if (firstFutureIndex >= 0) {
        classes[firstFutureIndex] = "stop-current";
    }

    return classes;
}

function setPinState(isPinned) {
    if (isPinned) {
        pinChip.classList.add("hidden");
        unpinChip.classList.remove("hidden");
    } else {
        pinChip.classList.remove("hidden");
        unpinChip.classList.add("hidden");
    }
}

function bindPin(tripIdentifier) {
    currentPinnedTripId = encodeURIComponent(tripIdentifier || "");
    const pinnedJourney = localStorage.getItem("pinnedJourney");
    setPinState(pinnedJourney === currentPinnedTripId);

    if (!pinHandlersBound) {
        pinChip.addEventListener("click", () => {
            localStorage.setItem("pinnedJourney", currentPinnedTripId);
            if (stationId) {
                localStorage.setItem("pinnedJourneyStation", stationId);
            }
            setPinState(true);
        });

        unpinChip.addEventListener("click", () => {
            localStorage.removeItem("pinnedJourney");
            localStorage.removeItem("pinnedJourneyStation");
            setPinState(false);
        });

        pinHandlersBound = true;
    }
}

function applyLineStyles(trip, baseLineName) {
    const rawLinePrefix = baseLineName.split(" ")[0] || "";
    const normalizedLinePrefix = rawLinePrefix.replace(/[^a-zA-Z0-9_-]/g, "");
    const productClass = normalizedLinePrefix.toUpperCase();

    lineBadgeElement.classList.add("linebadge", "oebb-badge");
    if (productClass) {
        headerElement.classList.add(productClass);
        lineBadgeElement.classList.add(productClass);
        lineBadgeElement.classList.add(`oebb-${productClass}`);
    }

    const providerClass = (provider.operatorId || "oebb").toLowerCase();
    headerElement.classList.add(providerClass);
    lineBadgeElement.classList.add(providerClass);
}

function renderHeader(trip, stops) {
    const lineName = getLineName(trip);
    const firstStop = stops[0] || {};
    const lastStop = stops[stops.length - 1] || {};
    const departureValue = firstStop.scheduledDeparture || trip.origin?.scheduledTime || firstStop.scheduledArrival;
    const arrivalValue = lastStop.scheduledArrival || trip.destination?.scheduledTime || lastStop.scheduledDeparture;
    const destinationName = trip.destination?.stationName || lastStop.stationName || "Unbekannt";
    const originName = trip.origin?.stationName || firstStop.stationName || "Unbekannt";

    document.getElementById("trainTitle").textContent = trip.tripNumber ? `(${trip.tripNumber})` : "";
    document.getElementById("operatorName").textContent = getOperatorName(trip);
    document.getElementById("linebadge").textContent = lineName;
    document.getElementById("trip-date").textContent = formatDate(departureValue);
    document.getElementById("lauf").textContent = `${originName} -> ${destinationName}`;
    document.getElementById("title").textContent = `${lineName} -> ${destinationName}`;

    if (document.getElementById("tripDurationTime")) {
        document.getElementById("tripDurationTime").textContent = formatDuration(departureValue, arrivalValue);
    }

    applyLineStyles(trip, lineName);
}

function renderStopovers(stops) {
    const stopoversContainer = document.querySelector(".trip-stopovers");
    stopoversContainer.innerHTML = "";

    const classList = getStopClassList(stops);

    stops.forEach((stop, index) => {
        const stopElement = document.createElement("div");
        stopElement.classList.add("trip-stopover", classList[index]);

        const currentClass = classList[index];
        if (currentClass === "stop-current") {
            stopElement.style.setProperty("--progress-percentage", "50%");
            stopElement.style.setProperty("--progress-px", "20px");
            stopElement.innerHTML = `
                <picture>
                    <source srcset="../assets/icons/train-top-dark.svg" media="(prefers-color-scheme: dark)">
                    <source srcset="../assets/icons/train-top.svg" media="(prefers-color-scheme: light)">
                    <img src="../assets/icons/train-top.svg" alt="Location" class="trainposition">
                </picture>
            `;
        }

        if (stationId && stationId === stop.stationId) {
            stopElement.classList.add("marked-stopover");
        }

        const scheduledArrival = stop.scheduledArrival ? formatTime(stop.scheduledArrival) : "";
        const estimatedArrival = stop.estimatedArrival ? formatTime(stop.estimatedArrival) : "";
        const scheduledDeparture = stop.scheduledDeparture ? formatTime(stop.scheduledDeparture) : "";
        const estimatedDeparture = stop.estimatedDeparture ? formatTime(stop.estimatedDeparture) : "";

        const arrivalDisplay = scheduledArrival && estimatedArrival && scheduledArrival !== estimatedArrival
            ? `<s class=\"disabled\">${scheduledArrival}</s>&nbsp;<span>${estimatedArrival}</span>`
            : (estimatedArrival || scheduledArrival || "-");

        const departureDisplay = scheduledDeparture && estimatedDeparture && scheduledDeparture !== estimatedDeparture
            ? `<s class=\"disabled\">${scheduledDeparture}</s>&nbsp;<span>${estimatedDeparture}</span>`
            : (estimatedDeparture || scheduledDeparture || "-");

        const currentPlatform = stop.actualPlatform || stop.platform || "";
        const plannedPlatform = stop.scheduledPlatform || "";
        const platformChanged = stop.platformChanged === true && currentPlatform;
        let platformHtml = "-";

        if (currentPlatform) {
            if (platformChanged && plannedPlatform && plannedPlatform !== currentPlatform) {
                platformHtml = `<span class=\"red\">Gl&nbsp;${escapeHtml(currentPlatform)}</span>`;
            } else {
                platformHtml = `Gl&nbsp;${escapeHtml(currentPlatform)}`;
            }
        }

        if (currentClass === "stop-cancelled") {
            stopElement.innerHTML += `
                <div class="trip-stop-time">
                    <div class="trip-delay" style="font-size: 16px">Entfällt</div>
                </div>
                <div class="trip-stop-info">
                    <span class="trip-stop-name">${escapeHtml(stop.stationName || "Unbekannt")}</span>
                    <span class="trip-platform">${platformHtml}</span>
                </div>
                <div class="connection-cell">&nbsp;<img src="../assets/icons/placeholder.svg"></div>
            `;
        } else {
            stopElement.innerHTML += `
                <div class="trip-stop-time">
                    <div>${arrivalDisplay}</div>
                    <div>${departureDisplay}</div>
                </div>
                <div class="trip-stop-info">
                    <span class="trip-stop-name">${escapeHtml(stop.stationName || "Unbekannt")}</span>
                    <span class="trip-platform">${platformHtml}</span>
                </div>
                <div class="connection-cell">&nbsp;<img src="../assets/icons/placeholder.svg"></div>
            `;
        }

        stopoversContainer.appendChild(stopElement);
    });
}

function renderStatus(trip, stops) {
    const statusElement = document.getElementById("tripStatus");
    const now = new Date();
    const firstStop = stops[0] || {};
    const lastStop = stops[stops.length - 1] || {};

    const departureTime = toDate(firstStop.estimatedDeparture || firstStop.scheduledDeparture || trip.origin?.scheduledTime);
    const arrivalTime = toDate(lastStop.estimatedArrival || lastStop.scheduledArrival || trip.destination?.scheduledTime);

    if (departureTime && now < departureTime) {
        const minutesUntil = Math.max(0, Math.round((departureTime - now) / 60000));
        const originName = trip.origin?.stationName || firstStop.stationName || "Unbekannt";
        const platform = firstStop.actualPlatform || firstStop.platform || firstStop.scheduledPlatform || "";
        const platformText = platform ? ` auf Gl ${platform}` : "";
        statusElement.textContent = `Fährt in ${minutesUntil} Min von ${originName}${platformText}.`;
        return;
    }

    const nextStop = stops.find((stop) => {
        const time = toDate(getPrimaryArrival(stop) || getPrimaryDeparture(stop));
        return time && time >= now && !isCancelledStop(stop);
    });

    if (nextStop) {
        const eta = toDate(getPrimaryArrival(nextStop) || getPrimaryDeparture(nextStop));
        const minutesUntil = eta ? Math.max(0, Math.round((eta - now) / 60000)) : null;
        const platform = nextStop.actualPlatform || nextStop.platform || nextStop.scheduledPlatform || "";
        const platformText = platform ? ` auf Gl ${platform}` : "";
        if (minutesUntil !== null) {
            statusElement.textContent = `Erreicht ${nextStop.stationName || "Unbekannt"} in ${minutesUntil} Min${platformText}.`;
        } else {
            statusElement.textContent = `Ist unterwegs nach ${nextStop.stationName || "Unbekannt"}${platformText}.`;
        }
        return;
    }

    const destinationName = trip.destination?.stationName || lastStop.stationName || "Unbekannt";
    if (arrivalTime && now > arrivalTime) {
        statusElement.textContent = `Hat das Ziel ${destinationName} erreicht.`;
    } else {
        statusElement.textContent = `Ist auf dem Weg nach ${destinationName}.`;
    }
}

function renderRemarks(trip, stops) {
    const remarksContainer = document.getElementById("remarks");
    const warningCounterButton = document.getElementById("trip-warning-counter-button");
    const trainTab = document.getElementById("trainTab");

    const stationRemarkEntries = [];
    if (stationId) {
        const stationStop = stops.find((stop) => stop.stationId === stationId);
        if (stationStop && Array.isArray(stationStop.messages)) {
            stationRemarkEntries.push(...stationStop.messages);
        }
    }

    const tripRemarkEntries = Array.isArray(trip.messages) ? trip.messages : [];
    const combined = [...stationRemarkEntries, ...tripRemarkEntries]
        .map((entry) => ({
            type: typeof entry.type === "string" ? entry.type : "info",
            text: typeof entry.text === "string" ? entry.text.trim() : ""
        }))
        .filter((entry) => entry.text.length > 0);

    const unique = [];
    const seen = new Set();
    combined.forEach((entry) => {
        const normalized = entry.text.toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ").trim();
        if (!seen.has(normalized)) {
            seen.add(normalized);
            unique.push(entry);
        }
    });

    if (unique.length === 0) {
        remarksContainer.classList.add("hidden");
        warningCounterButton.classList.add("hidden");
        trainTab.textContent = "Zug";
        return;
    }

    remarksContainer.classList.remove("hidden");
    warningCounterButton.classList.remove("hidden");
    warningCounterButton.textContent = String(unique.length);
    trainTab.innerHTML = `Zug <span class=\"pill\">&nbsp;${unique.length}&nbsp;</span>`;

    remarksContainer.innerHTML = unique.map((entry) => `
        <div class="listitem">
            <div class="listimagecontainer"><img src="../assets/icons/remarkdefault.svg"></div>
            <div class="listitemtext">${escapeHtml(entry.text)}</div>
        </div>
    `).join("");
}

function renderTrackInfo(trip, stops) {
    document.getElementById("loadingConstructions").classList.add("hidden");
    const trackList = document.getElementById("constructions");

    const originName = trip.origin?.stationName || stops[0]?.stationName || "Unbekannt";
    const destinationName = trip.destination?.stationName || stops[stops.length - 1]?.stationName || "Unbekannt";
    const stopCount = stops.length;

    trackList.innerHTML = `
        <div class="listitem">
            <div class="listimagecontainer"><img src="../assets/icons/path-start.svg"></div>
            <div class="listitemtext">Von ${escapeHtml(originName)} nach ${escapeHtml(destinationName)}</div>
        </div>
        <div class="listitem">
            <div class="listimagecontainer"><img src="../assets/icons/path-walk.svg"></div>
            <div class="listitemtext">${stopCount} Halte in dieser Fahrt</div>
        </div>
    `;
}

function getPolylineFeatures(trip) {
    const polyline = trip.polyline;
    if (!polyline || !Array.isArray(polyline.features)) {
        return [];
    }
    return polyline.features.filter((feature) =>
        feature &&
        feature.geometry &&
        feature.geometry.type === "Point" &&
        Array.isArray(feature.geometry.coordinates) &&
        feature.geometry.coordinates.length >= 2
    );
}

function initializeMap() {
    mapboxgl.accessToken = "pk.eyJ1IjoiY3V6aW1tYXJ0aW4iLCJhIjoiY204dGRyb3AxMDgxcDJrc2VjeXVwNXN3NyJ9.VR8xzsuQJ_-0h95CN_UD8g";

    const darkMode = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    map = new mapboxgl.Map({
        container: "map",
        style: "mapbox://styles/mapbox/standard",
        config: {
            basemap: {
                lightPreset: darkMode ? "dusk" : "day",
                font: "Roboto",
                showPlaceLabels: false,
                showPointOfInterestLabels: false,
                showRoadLabels: false,
                showLandmarkIconLabels: false
            }
        },
        center: [13.3, 47.8],
        zoom: 5,
        pitch: 30,
        bearing: 0,
        antialias: true
    });

    map.once("load", () => {
        renderMapRoute();
    });
}

function renderMapRoute() {
    if (!latestTripData || !map || !map.loaded()) {
        if (mapLoading) {
            mapLoading.style.display = "none";
        }
        return;
    }

    const features = getPolylineFeatures(latestTripData);
    if (features.length === 0) {
        if (mapLoading) {
            mapLoading.style.display = "none";
        }
        return;
    }

    const coordinates = features.map((feature) => [feature.geometry.coordinates[0], feature.geometry.coordinates[1]]);
    const routeData = {
        type: "Feature",
        geometry: {
            type: "LineString",
            coordinates
        }
    };

    if (map.getSource("fullRoute")) {
        map.getSource("fullRoute").setData(routeData);
    } else {
        map.addSource("fullRoute", {
            type: "geojson",
            data: routeData
        });
    }

    const darkMode = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (!map.getLayer("fullRoute")) {
        map.addLayer({
            id: "fullRoute",
            type: "line",
            source: "fullRoute",
            layout: {
                "line-join": "round",
                "line-cap": "round"
            },
            paint: {
                "line-color": darkMode ? "#ffffff" : "#343332",
                "line-width": 4,
                "line-emissive-strength": 50
            }
        });
    }

    const stopFeatures = features
        .filter((feature) => feature.properties && feature.properties.type === "stop")
        .map((feature) => ({
            type: "Feature",
            geometry: feature.geometry,
            properties: {
                description: (feature.properties && feature.properties.name) || "Halt"
            }
        }));

    if (stopFeatures.length > 0) {
        const stopsData = {
            type: "FeatureCollection",
            features: stopFeatures
        };
        if (map.getSource("stops")) {
            map.getSource("stops").setData(stopsData);
        } else {
            map.addSource("stops", {
                type: "geojson",
                data: stopsData
            });
        }

        if (!map.getLayer("poi-labels")) {
            map.addLayer({
                id: "poi-labels",
                type: "symbol",
                source: "stops",
                layout: {
                    "text-field": ["get", "description"],
                    "text-variable-anchor": ["left"],
                    "text-radial-offset": 1,
                    "text-justify": "auto"
                },
                paint: {
                    "text-color": darkMode ? "#ffffff" : "#000000",
                    "text-halo-color": darkMode ? "#445a59" : "#ffffff",
                    "text-halo-width": 2
                },
                minzoom: 8
            });
        }

        if (!map.getLayer("stop-points")) {
            map.addLayer({
                id: "stop-points",
                type: "circle",
                source: "stops",
                paint: {
                    "circle-radius": 3,
                    "circle-color": darkMode ? "#d9d9d9" : "#4d4d4d",
                    "circle-opacity": 0.85,
                    "circle-stroke-width": 1,
                    "circle-stroke-color": darkMode ? "#000000" : "#ffffff",
                    "circle-stroke-opacity": 0.75
                }
            });
        }
    }

    const bounds = coordinates.reduce((accumulator, coordinate) => accumulator.extend(coordinate), new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));
    map.fitBounds(bounds, {
        padding: { top: 50, bottom: 50, left: 50, right: 50 },
        duration: 800
    });

    if (mapLoading) {
        mapLoading.style.display = "none";
    }
    mapRouteRendered = true;
}

function renderProviderLogo() {
    const logoContainer = document.getElementById("logo");
    const providerId = provider.providerID || "oebb";
    const logoPath = window.ProviderStore
        ? ProviderStore.getProviderLogoPath(providerId, "../assets/providerLogos")
        : `../assets/providerLogos/${providerId}.svg`;

    logoContainer.innerHTML = `<img src="${logoPath}" class="trip-logo" title="${escapeHtml(provider.providerName || "OEBB Austria")}" onerror="this.onerror=null;this.src='../assets/icons/provider.svg'">`;
}

function showErrorState() {
    document.getElementById("tripStatus").textContent = "Fehler beim Laden der Reisedaten.";
    document.getElementById("remarks").classList.add("hidden");
    document.getElementById("loadingConstructions").innerHTML = "<div class=\"listcontainer\"><div class=\"listitem\" style=\"display: block\"><br><center><img src=\"../assets/icons/finderror.svg\" class=\"bigicon\"><h3>Fehler</h3>Trip konnte nicht geladen werden.</center><br></div></div>";
    if (mapLoading) {
        mapLoading.style.display = "none";
    }
}

function openCity(evt, cityName) {
    const tabcontent = document.getElementsByClassName("tabcontent");
    for (let i = 0; i < tabcontent.length; i += 1) {
        tabcontent[i].style.display = "none";
    }

    const tablinks = document.getElementsByClassName("tablinks");
    for (let i = 0; i < tablinks.length; i += 1) {
        tablinks[i].className = tablinks[i].className.replace(" tabActive", "");
    }

    document.getElementById(cityName).style.display = "block";
    evt.currentTarget.className += " tabActive";
}

window.openCity = openCity;

async function fetchTrip() {
    if (!tripId) {
        showErrorState();
        document.getElementById("tripStatus").textContent = "Keine tripId in der URL gefunden.";
        return;
    }

    if (mapLoading && !mapRouteRendered) {
        mapLoading.style.display = "block";
    }

    const primaryUrl = getTripUrl();
    const fallbackUrl = buildApiUrl("trip", { tripId });

    try {
        let response = await fetch(primaryUrl, { method: "GET", mode: "cors" });
        if (!response.ok) {
            response = await fetch(fallbackUrl, { method: "GET", mode: "cors" });
        }
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();
        const trip = parseTripPayload(payload);
        if (!trip) {
            throw new Error("Invalid trip payload");
        }

        latestTripData = trip;
        const stops = getStops(trip);

        renderHeader(trip, stops);
        renderStopovers(stops);
        renderStatus(trip, stops);
        renderRemarks(trip, stops);
        renderTrackInfo(trip, stops);
        renderProviderLogo();
        bindPin(trip.id || tripId);

        if (map && map.loaded() && !mapRouteRendered) {
            renderMapRoute();
        }
    } catch (error) {
        console.error("Trip API error", error);
        showErrorState();
    } finally {
        if (mapLoading && mapRouteRendered) {
            mapLoading.style.display = "none";
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    initializeMap();
    fetchTrip();
    setInterval(fetchTrip, 30000);
});
