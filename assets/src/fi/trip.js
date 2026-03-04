const provider = window.ProviderStore ? ProviderStore.getProvider() : {
    providerName: "VR Finland",
    providerID: "vr",
    operatorId: "vr",
    apiPath: "fi"
};

const params = new URLSearchParams(window.location.search);
const tripId = params.get("tripId");
const stationId = params.get("stationID");

let map;
let mapLoaded = false;
let mapRouteRendered = false;
let mapHasFitted = false;
let lastRoutePointCount = 0;
let lastRouteSignature = "";
let latestTripData = null;
let liveMarker = null;
let stationCoordinates = new Map();

if (localStorage.getItem("webfis") === "false") {
    document.getElementById("webfisbutton").classList.add("hidden");
}
document.getElementById("wagonorderbutton").classList.add("hidden");
document.getElementById("webfisbutton").classList.add("hidden");
document.getElementById("comfortbutton").classList.add("hidden");

function buildApiUrl(endpoint, query) {
    if (window.ProviderStore) {
        return ProviderStore.buildApiUrl(endpoint, query, provider);
    }
    const url = new URL(`https://prod.cuzimmartin.dev/api/fi/${endpoint}`);
    Object.keys(query || {}).forEach((key) => {
        const value = query[key];
        if (value !== undefined && value !== null && value !== "") {
            url.searchParams.set(key, String(value));
        }
    });
    return url.toString();
}

function toDate(value) {
    if (!value) {
        return null;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatTime(value) {
    const parsed = toDate(value);
    if (!parsed) {
        return "-";
    }
    return parsed.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(value) {
    const parsed = toDate(value);
    if (!parsed) {
        return "";
    }
    return parsed.toLocaleDateString("de-DE", { year: "numeric", month: "long", day: "numeric" });
}

function escapeHtml(value) {
    if (window.ProviderStore) {
        return ProviderStore.escapeHtml(value ?? "");
    }
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function getLineName(trip) {
    if (trip && typeof trip.line === "string" && trip.line.length > 0) {
        return trip.line;
    }
    if (trip && trip.metadata && trip.metadata.commuterLineID) {
        return trip.metadata.commuterLineID;
    }
    return "?";
}

function isCancelledStop(stop) {
    return Boolean(stop && stop.cancelled === true);
}

function getStopReferenceTime(stop) {
    return toDate(
        stop.estimatedDeparture ||
        stop.scheduledDeparture ||
        stop.estimatedArrival ||
        stop.scheduledArrival
    );
}

function getStopArrivalTime(stop) {
    return toDate(
        stop.estimatedArrival ||
        stop.scheduledArrival ||
        stop.estimatedDeparture ||
        stop.scheduledDeparture
    );
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
        const decisive = getStopReferenceTime(stop);
        if (decisive && decisive < now) {
            classes[i] = "stop-past";
        }
    }

    const currentIndex = classes.findIndex((status) => status === "stop-future");
    if (currentIndex >= 0) {
        classes[currentIndex] = "stop-current";
    }

    return classes;
}

function setBadgeClasses(lineName) {
    const lineBadge = document.getElementById("linebadge");
    const header = document.getElementById("bigheaderbox");
    const normalizedLine = String(lineName || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

    lineBadge.classList.add("linebadge", "vr", "suburban", "fi-commuter");
    header.classList.add("vr", "suburban", "fi-commuter");
    if (normalizedLine) {
        lineBadge.classList.add(normalizedLine, `fi-${normalizedLine}`);
        header.classList.add(normalizedLine, `fi-${normalizedLine}`);
    }
}

function renderHeader(trip) {
    const lineName = getLineName(trip);
    const origin = trip.origin || {};
    const destination = trip.destination || {};

    document.getElementById("linebadge").textContent = lineName;
    document.getElementById("trainTitle").textContent = trip.tripNumber ? `(${trip.tripNumber})` : "";
    document.getElementById("operatorName").textContent = provider.providerName;
    document.getElementById("trip-date").textContent = formatDate(origin.scheduledTime);
    document.getElementById("lauf").textContent = `${origin.stationName || "-"} → ${destination.stationName || "-"}`;
    document.getElementById("title").textContent = `${lineName} 🡺 ${destination.stationName || "-"}`;

    setBadgeClasses(lineName);
}

function renderStatus(trip) {
    const status = document.getElementById("tripStatus");
    const now = new Date();
    const departure = toDate(
        (trip.origin && (trip.origin.estimatedTime || trip.origin.scheduledTime)) ||
        (trip.stops && trip.stops[0] && (trip.stops[0].estimatedDeparture || trip.stops[0].scheduledDeparture))
    );
    const arrival = toDate(
        (trip.destination && (trip.destination.estimatedTime || trip.destination.scheduledTime)) ||
        (trip.stops && trip.stops.length > 0
            ? (trip.stops[trip.stops.length - 1].estimatedArrival || trip.stops[trip.stops.length - 1].scheduledArrival)
            : null)
    );

    if (departure && now < departure) {
        const minutes = Math.max(0, Math.round((departure - now) / 60000));
        const platform = trip.origin && trip.origin.platform && trip.origin.platform !== "unknown" ? ` auf Gl ${trip.origin.platform}` : "";
        status.textContent = `Fährt in ${minutes} Min von ${trip.origin.stationName || "Unbekannt"}${platform}.`;
        return;
    }

    const stops = Array.isArray(trip.stops) ? trip.stops : [];
    const nextStop = stops.find((stop) => {
        const time = getStopReferenceTime(stop);
        return time && time >= now && !isCancelledStop(stop);
    });

    if (nextStop) {
        const eta = getStopArrivalTime(nextStop);
        const minutes = eta ? Math.max(0, Math.round((eta - now) / 60000)) : null;
        const platform = nextStop.platform && nextStop.platform !== "unknown" ? ` auf Gl ${nextStop.platform}` : "";
        if (minutes !== null) {
            status.textContent = `Erreicht ${nextStop.stationName} in ${minutes} Min${platform}.`;
        } else {
            status.textContent = `Ist unterwegs nach ${nextStop.stationName}${platform}.`;
        }
        return;
    }

    if (arrival && now > arrival) {
        status.textContent = `Hat das Ziel ${trip.destination.stationName || "Unbekannt"} erreicht.`;
    } else {
        status.textContent = `Ist auf dem Weg nach ${trip.destination.stationName || "Unbekannt"}.`;
    }
}

function formatStopTime(scheduledValue, estimatedValue, delayValue) {
    const scheduled = formatTime(scheduledValue);
    const estimated = formatTime(estimatedValue);
    const hasRealtime = Boolean(estimatedValue);
    const differs = hasRealtime && scheduled !== estimated;
    let delay = "";
    if (typeof delayValue === "number" && delayValue !== 0) {
        delay = ` <small class="disabled">(${delayValue > 0 ? `+${delayValue}` : `${delayValue}`})</small>`;
    }
    if (differs) {
        return `<s class="disabled">${scheduled}</s> <span class="red">${estimated}</span>${delay}`;
    }
    return `${estimated !== "-" ? estimated : scheduled}${delay}`;
}

function renderStops(trip) {
    const stops = Array.isArray(trip.stops) ? trip.stops : [];
    const stopoversContainer = document.querySelector(".trip-stopovers");
    stopoversContainer.innerHTML = ``;
    const classes = getStopClassList(stops);

    stops.forEach((stop, index) => {
        const stopElement = document.createElement("div");
        const className = classes[index] || "stop-unknown";
        stopElement.classList.add("trip-stopover", className);
        
        if (className === "stop-current") {
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

        const arrivalTime = formatStopTime(stop.scheduledArrival, stop.estimatedArrival, stop.arrivalDelay);
        const departureTime = formatStopTime(stop.scheduledDeparture, stop.estimatedDeparture, stop.departureDelay);
        const platform = stop.platform && stop.platform !== "unknown" ? `${escapeHtml(stop.platform)}` : "-";

        if (isCancelledStop(stop)) {
            stopElement.innerHTML += `
                <div class="trip-stop-time"><div class="trip-delay" style="font-size: 16px">Entfällt</div></div>
                <div class="trip-stop-info"><span class="trip-stop-name">${escapeHtml(stop.stationName || "Unbekannt")}</span><span class="trip-platform">${platform}</span></div>
                <div class="connection-cell">&nbsp;</div>
            `;
        } else {
            stopElement.innerHTML += `
                <div class="trip-stop-time">
                    <div>${arrivalTime}</div>
                    <div>${departureTime}</div>
                </div>
                <div class="trip-stop-info">
                    <span class="trip-stop-name">${escapeHtml(stop.stationName || "Unbekannt")}</span>
                    <span class="trip-platform">${platform}</span>
                </div>
                <div class="connection-cell">&nbsp;</div>
            `;
        }

        stopoversContainer.appendChild(stopElement);
    });
}

function renderTrainTab(trip) {
    const remarks = document.getElementById("remarks");
    const warningCounter = document.getElementById("trip-warning-counter-button");
    const trainTab = document.getElementById("trainTab");

    const entries = [];
    if (trip.metadata && trip.metadata.trainType) {
        entries.push(`Zugtyp: ${trip.metadata.trainType}`);
    }
    if (trip.metadata && trip.metadata.commuterLineID) {
        entries.push(`Commuter-Linie: ${trip.metadata.commuterLineID}`);
    }
    if (trip.metadata && trip.metadata.timetableType) {
        entries.push(`Fahrplantyp: ${trip.metadata.timetableType}`);
    }
    if (trip.status) {
        entries.push(`Status: ${trip.status}`);
    }
    if (trip.realtime === true) {
        entries.push("Echtzeitdaten aktiv");
    }
    if (trip.currentPosition && typeof trip.currentPosition.speed === "number") {
        entries.push(`Aktuelle Geschwindigkeit: ${trip.currentPosition.speed} km/h`);
        document.getElementById('speedbutton').innerText = `${trip.currentPosition.speed} km/h`;
        document.getElementById('speedbutton').classList.remove('hidden')
        speedlink.href = `speedometer.html?tripId=${trip.id}&operator=${trip.metadata.train.operatorShortCode}`;
    }
    const composition = trip.metadata && trip.metadata.composition ? trip.metadata.composition : null;
    if (composition && Array.isArray(composition.sections)) {
        const typeCount = new Map();
        composition.sections.forEach((section) => {
            const locos = Array.isArray(section.locomotives) ? section.locomotives : [];
            const wagons = Array.isArray(section.wagons) ? section.wagons : [];
            document.getElementById('trainslider').innerHTML = ('');
            locos.forEach((item) => {
                const key = item && item.type ? String(item.type).trim() : "Lok";
                typeCount.set(key, (typeCount.get(key) || 0) + 1);

                document.getElementById('trainslider').innerHTML += `
                    <img 
                    src="https://materialtrains.unibits.eu/vehicles/vr-finland/${trip.category}-${item.type}.png" 
                    onerror="this.onerror=null; this.src='../assets/icons/blankvehicle.png';" 
                    alt="${trip.category}-${item.type}"
                    class="vehicle" 
                    alt="Vehicle">
                `;

               

            });
            wagons.forEach((item) => {
                const key = item && item.type ? String(item.type).trim() : "Wagen";
                typeCount.set(key, (typeCount.get(key) || 0) + 1);
                document.getElementById('trainslider').innerHTML += `
                    <img 
                    src="https://materialtrains.unibits.eu/vehicles/vr-finland/${trip.category}-${item.type}.png" 
                    onerror="this.onerror=null; this.src='../assets/icons/blankvehicle.png';" 
                    alt="${trip.category}-${item.type}"
                    class="vehicle" 
                    alt="Vehicle">
                `;
            });
        });
        if (typeCount.size > 0) {
            const material = Array.from(typeCount.entries())
                .map(([type, count]) => `${count}x ${type}`)
                .join(", ");
            entries.push(`Rollmaterial: ${material}`);
        }
    }

    if (entries.length === 0) {
        remarks.classList.add("hidden");
        warningCounter.classList.add("hidden");
        trainTab.textContent = "Zug";
        return;
    }

    remarks.classList.remove("hidden");
    warningCounter.classList.remove("hidden");
    warningCounter.textContent = String(entries.length);
    trainTab.innerHTML = `Zug <span class=\"pill\">&nbsp;${entries.length}&nbsp;</span>`;
    remarks.innerHTML = entries.map((item) => `
        <div class="listitem">
            <div class="listimagecontainer"><img src="../assets/icons/INFO.svg"></div>
            <div class="listitemtext">${escapeHtml(item)}</div>
        </div>
    `).join("");
}

function renderTrackTab(trip) {
    const loading = document.getElementById("loadingConstructions");
    const track = document.getElementById("constructions");
    loading.classList.add("hidden");

    const stops = Array.isArray(trip.stops) ? trip.stops : [];
    const composition = trip.metadata && trip.metadata.composition ? trip.metadata.composition : null;
    const route = trip.metadata && trip.metadata.route ? trip.metadata.route : null;
    const tracking = trip.metadata && trip.metadata.tracking ? trip.metadata.tracking : null;

    const items = [];
    items.push({ icon: "path-start.svg", text: `Von ${trip.origin.stationName} nach ${trip.destination.stationName}` });
    items.push({ icon: "path-walk.svg", text: `${stops.length} Halte in dieser Fahrt` });
    if (route && typeof route.trajectoryPointCount === "number") {
        items.push({ icon: "path-walk.svg", text: `${route.trajectoryPointCount} Trajektorienpunkte` });
    }
    if (route && typeof route.geoReferencedStopCount === "number") {
        items.push({ icon: "stop-marker.svg", text: `${route.geoReferencedStopCount} georeferenzierte Halte` });
    }
    if (route && typeof route.totalDistanceMeters === "number") {
        items.push({ icon: "path-walk.svg", text: `Streckenlänge: ${(route.totalDistanceMeters / 1000).toFixed(1)} km` });
    }
    if (tracking && typeof tracking.eventCount === "number") {
        items.push({ icon: "INFO.svg", text: `${tracking.eventCount} Tracking-Ereignisse` });
    }

    if (composition) {
        if (composition.totalLength) {
            items.push({ icon: "train.svg", text: `Gesamtlänge: ${composition.totalLength} m` });
        }
        if (composition.maximumSpeed) {
            items.push({ icon: "clock.svg", text: `Höchstgeschwindigkeit: ${composition.maximumSpeed} km/h` });
        }
        if (Array.isArray(composition.sections)) {
            composition.sections.forEach((section, idx) => {
                const locoCount = Array.isArray(section.locomotives) ? section.locomotives.length : 0;
                const wagonCount = Array.isArray(section.wagons) ? section.wagons.length : 0;
                items.push({ icon: "wagonorder.svg", text: `Sektion ${idx + 1}: ${locoCount} Triebfahrzeuge, ${wagonCount} Wagen` });
            });
        }
    }

    track.innerHTML = items.map((item) => `
        <div class="listitem">
            <div class="listimagecontainer"><img src="../assets/icons/${item.icon}"></div>
            <div class="listitemtext">${escapeHtml(item.text)}</div>
        </div>
    `).join("");
}

async function fetchStationCoordinate(stationCode) {
    if (!stationCode) {
        return null;
    }
    if (stationCoordinates.has(stationCode)) {
        return stationCoordinates.get(stationCode);
    }
    try {
        const response = await fetch(buildApiUrl("stations", { query: stationCode, limit: 1 }), { method: "GET", mode: "cors" });
        if (!response.ok) {
            stationCoordinates.set(stationCode, null);
            return null;
        }
        const payload = await response.json();
        const item = payload && payload.success && Array.isArray(payload.data) ? payload.data[0] : null;
        const location = item && item.location ? item.location : null;
        const coord = location && typeof location.longitude === "number" && typeof location.latitude === "number"
            ? [location.longitude, location.latitude]
            : null;
        stationCoordinates.set(stationCode, coord);
        return coord;
    } catch {
        stationCoordinates.set(stationCode, null);
        return null;
    }
}

function isValidLngLat(lng, lat) {
    return Number.isFinite(lng) &&
        Number.isFinite(lat) &&
        Math.abs(lat) <= 90 &&
        Math.abs(lng) <= 180;
}

function dedupeCoordinates(points) {
    const deduped = [];
    let lastKey = "";
    points.forEach((point) => {
        if (!Array.isArray(point) || point.length < 2) {
            return;
        }
        const lng = Number(point[0]);
        const lat = Number(point[1]);
        if (!isValidLngLat(lng, lat)) {
            return;
        }
        const key = `${lng.toFixed(6)}:${lat.toFixed(6)}`;
        if (key !== lastKey) {
            deduped.push([lng, lat]);
            lastKey = key;
        }
    });
    return deduped;
}

function distanceMeters(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length < 2 || b.length < 2) {
        return Number.POSITIVE_INFINITY;
    }
    const toRad = (value) => value * (Math.PI / 180);
    const lng1 = Number(a[0]);
    const lat1 = Number(a[1]);
    const lng2 = Number(b[0]);
    const lat2 = Number(b[1]);
    if (!isValidLngLat(lng1, lat1) || !isValidLngLat(lng2, lat2)) {
        return Number.POSITIVE_INFINITY;
    }
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const rLat1 = toRad(lat1);
    const rLat2 = toRad(lat2);
    const aValue = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 6371000 * (2 * Math.atan2(Math.sqrt(aValue), Math.sqrt(1 - aValue)));
}

function parsePolylineString(polyline) {
    if (typeof polyline !== "string" || polyline.trim().length === 0) {
        return [];
    }
    const points = [];
    polyline.split(";").forEach((pair) => {
        const trimmed = pair.trim();
        if (!trimmed) {
            return;
        }
        const parts = trimmed.split(",");
        if (parts.length < 2) {
            return;
        }
        const lat = Number(parts[0]);
        const lng = Number(parts[1]);
        if (isValidLngLat(lng, lat)) {
            points.push([lng, lat]);
        }
    });
    return dedupeCoordinates(points);
}

function getRouteCoordinatesFromMetadata(trip) {
    const coordinates = trip &&
        trip.metadata &&
        trip.metadata.route &&
        trip.metadata.route.geometry &&
        Array.isArray(trip.metadata.route.geometry.coordinates)
        ? trip.metadata.route.geometry.coordinates
        : [];
    return dedupeCoordinates(coordinates);
}

function getRouteStationLookup(trip) {
    const lookup = new Map();
    const stations = trip &&
        trip.metadata &&
        trip.metadata.route &&
        Array.isArray(trip.metadata.route.stations)
        ? trip.metadata.route.stations
        : [];
    stations.forEach((station) => {
        if (!station || !station.stationId) {
            return;
        }
        const lng = Number(station.longitude);
        const lat = Number(station.latitude);
        if (!isValidLngLat(lng, lat)) {
            return;
        }
        lookup.set(station.stationId, {
            coord: [lng, lat],
            name: station.stationName || station.stationId
        });
        stationCoordinates.set(station.stationId, [lng, lat]);
    });
    return lookup;
}

function getTerminalStations(trip) {
    const stations = trip &&
        trip.metadata &&
        trip.metadata.route &&
        Array.isArray(trip.metadata.route.stations)
        ? trip.metadata.route.stations
        : [];
    const valid = stations.filter((item) =>
        item &&
        typeof item.index === "number" &&
        Number.isFinite(Number(item.longitude)) &&
        Number.isFinite(Number(item.latitude))
    );
    if (valid.length === 0) {
        return null;
    }
    valid.sort((a, b) => a.index - b.index);
    const first = valid[0];
    const last = valid[valid.length - 1];
    const start = [Number(first.longitude), Number(first.latitude)];
    const end = [Number(last.longitude), Number(last.latitude)];
    if (!isValidLngLat(start[0], start[1]) || !isValidLngLat(end[0], end[1])) {
        return null;
    }
    return { start, end };
}

function scoreCandidateToTerminals(points, terminals) {
    if (!Array.isArray(points) || points.length < 2 || !terminals) {
        return { score: Number.POSITIVE_INFINITY, reversed: false };
    }
    const start = points[0];
    const end = points[points.length - 1];
    const normal = distanceMeters(start, terminals.start) + distanceMeters(end, terminals.end);
    const reversed = distanceMeters(start, terminals.end) + distanceMeters(end, terminals.start);
    if (reversed < normal) {
        return { score: reversed, reversed: true };
    }
    return { score: normal, reversed: false };
}

function buildRouteCoordinates(trip) {
    const geometryPoints = getRouteCoordinatesFromMetadata(trip);
    const polylinePoints = parsePolylineString(trip.polyline);
    const terminals = getTerminalStations(trip);
    if (geometryPoints.length >= 2) {
        if (!terminals) {
            return geometryPoints;
        }
        const scored = scoreCandidateToTerminals(geometryPoints, terminals);
        return scored.reversed ? [...geometryPoints].reverse() : geometryPoints;
    }
    if (polylinePoints.length >= 2) {
        if (!terminals) {
            return polylinePoints;
        }
        const scored = scoreCandidateToTerminals(polylinePoints, terminals);
        return scored.reversed ? [...polylinePoints].reverse() : polylinePoints;
    }
    return [];
}

function buildRouteSignature(points) {
    if (!Array.isArray(points) || points.length === 0) {
        return "";
    }
    const sampleCount = Math.min(20, points.length);
    const stride = Math.max(1, Math.floor(points.length / sampleCount));
    const samples = [];
    for (let i = 0; i < points.length; i += stride) {
        const point = points[i];
        samples.push(`${point[0].toFixed(5)},${point[1].toFixed(5)}`);
        if (samples.length >= sampleCount) {
            break;
        }
    }
    const last = points[points.length - 1];
    samples.push(`${last[0].toFixed(5)},${last[1].toFixed(5)}`);
    return `${points.length}|${samples.join("|")}`;
}

function createLiveMarkerElement(speed) {
    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.flexDirection = "column";
    wrapper.style.alignItems = "center";
    wrapper.style.gap = "4px";

    const image = document.createElement("img");
    image.src = "../assets/icons/mapmarker.svg";
    image.style.width = "34px";
    image.style.height = "34px";

    const speedBadge = document.createElement("div");
    speedBadge.className = "fi-live-speed";
    speedBadge.style.background = "rgba(0, 0, 0, 0.78)";
    speedBadge.style.color = "#fff";
    speedBadge.style.fontSize = "10px";
    speedBadge.style.fontWeight = "700";
    speedBadge.style.lineHeight = "1";
    speedBadge.style.padding = "3px 6px";
    speedBadge.style.borderRadius = "999px";
    speedBadge.style.whiteSpace = "nowrap";
    speedBadge.textContent = `${Math.max(0, Math.round(Number(speed) || 0))} km/h`;

    wrapper.appendChild(image);
    wrapper.appendChild(speedBadge);
    return wrapper;
}

function updateLiveMarker(trip) {
    if (!mapLoaded || !trip || !trip.currentPosition) {
        return;
    }
    const lng = Number(trip.currentPosition.longitude);
    const lat = Number(trip.currentPosition.latitude);
    if (!isValidLngLat(lng, lat)) {
        return;
    }
    const speed = Number(trip.currentPosition.speed);
    const speedText = `${Math.max(0, Math.round(Number.isFinite(speed) ? speed : 0))} km/h`;
    if (!liveMarker) {
        liveMarker = new mapboxgl.Marker({
            element: createLiveMarkerElement(speed),
            anchor: "bottom"
        }).setLngLat([lng, lat]).addTo(map);
        return;
    }
    const markerElement = liveMarker.getElement();
    const badge = markerElement ? markerElement.querySelector(".fi-live-speed") : null;
    if (badge) {
        badge.textContent = speedText;
    }
    liveMarker.setLngLat([lng, lat]);
}

async function renderMap(trip) {
    const mapLoading = document.getElementById("map-loading");
    if (mapLoading && !mapRouteRendered) {
        mapLoading.style.display = "block";
    }

    const stops = Array.isArray(trip.stops) ? trip.stops : [];
    const stationLookup = getRouteStationLookup(trip);

    const points = buildRouteCoordinates(trip);

    if (!mapLoaded || points.length === 0) {
        if (mapLoading) {
            mapLoading.style.display = "none";
        }
        return;
    }
    const routeSignature = buildRouteSignature(points);
    const routeChanged = routeSignature !== lastRouteSignature;

    const route = {
        type: "Feature",
        geometry: {
            type: "LineString",
            coordinates: points
        }
    };
    const darkMode = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const routeColor = darkMode ? "#ffffff" : "#343332";
    const routeCasingColor = darkMode ? "#4a5b5c" : "#ffffff";

    if (map.getSource("fullRoute")) {
        map.getSource("fullRoute").setData(route);
    } else {
        map.addSource("fullRoute", { type: "geojson", data: route });
        map.addLayer({
            id: "fullRoute-casing",
            type: "line",
            source: "fullRoute",
            layout: { "line-join": "round", "line-cap": "round", visibility: "visible" },
            paint: {
                "line-color": routeCasingColor,
                "line-width": 7,
                "line-opacity": 0.95,
                "line-emissive-strength": 0.8
            }
        });
        map.addLayer({
            id: "fullRoute",
            type: "line",
            source: "fullRoute",
            layout: { "line-join": "round", "line-cap": "round", visibility: "visible" },
            paint: {
                "line-color": routeColor,
                "line-width": 4,
                "line-emissive-strength": 40
            }
        });
    }
    if (map.getLayer("fullRoute-casing")) {
        map.setPaintProperty("fullRoute-casing", "line-color", routeCasingColor);
    }
    if (map.getLayer("fullRoute")) {
        map.setPaintProperty("fullRoute", "line-color", routeColor);
    }

    const stopFeatures = stops
        .map((stop) => {
            const known = stationLookup.get(stop.stationId);
            if (known && Array.isArray(known.coord)) {
                return {
                    type: "Feature",
                    geometry: { type: "Point", coordinates: known.coord },
                    properties: { description: known.name || stop.stationName || stop.stationId }
                };
            }
            const coord = stationCoordinates.get(stop.stationId);
            if (!Array.isArray(coord)) {
                return null;
            }
            return {
                type: "Feature",
                geometry: { type: "Point", coordinates: coord },
                properties: { description: stop.stationName || stop.stationId }
            };
        })
        .filter(Boolean);

    const stopData = { type: "FeatureCollection", features: stopFeatures };
    if (map.getSource("stops")) {
        map.getSource("stops").setData(stopData);
    } else {
        map.addSource("stops", { type: "geojson", data: stopData });
        
        map.addLayer({
            id: "stop-points",
            type: "circle",
            source: "stops",
            paint: {
                "circle-radius": 4,
                "circle-color": "#343332",
                "circle-stroke-width": 2,
                "circle-stroke-color": "#ffffff",
                "circle-emissive-strength": 1
            }
        });

        const textcolor = darkMode ? "#ffffff" : "#000000";
        const texthalocolor = darkMode ? "#4a5b5c" : "#ffffff";

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
                "text-color": textcolor,
                "text-halo-color": texthalocolor,
                "text-halo-width": 2
            },
            minzoom: 6
        });
    }

    if (!mapHasFitted || routeChanged || points.length > lastRoutePointCount + 15) {
        const bounds = points.reduce((acc, point) => acc.extend(point), new mapboxgl.LngLatBounds(points[0], points[0]));
        map.fitBounds(bounds, { padding: { top: 50, bottom: 50, left: 50, right: 50 }, duration: 800 });
        mapHasFitted = true;
    }
    lastRoutePointCount = points.length;
    lastRouteSignature = routeSignature;

    updateLiveMarker(trip);
    mapRouteRendered = true;

    if (mapLoading) {
        mapLoading.style.display = "none";
    }
}

function renderProviderLogo() {
    const logoContainer = document.getElementById("logo");
    const logoPath = window.ProviderStore
        ? ProviderStore.getProviderLogoPath(provider.providerID || "vr", "../assets/providerLogos")
        : "../assets/providerLogos/vr.svg";
    logoContainer.innerHTML = `<img src="${logoPath}" class="trip-logo" title="${escapeHtml(provider.providerName)}" onerror="this.onerror=null;this.src='../assets/icons/provider.svg'">`;
}

function setPinState(isPinned) {
    const pinChip = document.getElementById("pinChip");
    const unpinChip = document.getElementById("unpinChip");
    if (isPinned) {
        pinChip.classList.add("hidden");
        unpinChip.classList.remove("hidden");
    } else {
        pinChip.classList.remove("hidden");
        unpinChip.classList.add("hidden");
    }
}

function bindPin(currentTripId) {
    const pinChip = document.getElementById("pinChip");
    const unpinChip = document.getElementById("unpinChip");
    const normalized = encodeURIComponent(currentTripId || "");

    setPinState(localStorage.getItem("pinnedJourney") === normalized);

    pinChip.onclick = () => {
        localStorage.setItem("pinnedJourney", normalized);
        if (stationId) {
            localStorage.setItem("pinnedJourneyStation", stationId);
        }
        setPinState(true);
    };

    unpinChip.onclick = () => {
        localStorage.removeItem("pinnedJourney");
        localStorage.removeItem("pinnedJourneyStation");
        setPinState(false);
    };
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

function initMap() {
    mapboxgl.accessToken = "pk.eyJ1IjoiY3V6aW1tYXJ0aW4iLCJhIjoiY204dGRyb3AxMDgxcDJrc2VjeXVwNXN3NyJ9.VR8xzsuQJ_-0h95CN_UD8g";
    map = new mapboxgl.Map({
        container: "map",
        style: "mapbox://styles/mapbox/standard",
        config: {
            basemap: {
                lightPreset: window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dusk" : "day",
                font: "Roboto",
                showPlaceLabels: false,
                showPointOfInterestLabels: false,
                showRoadLabels: false,
                showLandmarkIconLabels: false
            }
        },
        center: [24.94, 60.17],
        zoom: 8,
        pitch: 35,
        bearing: 0,
        antialias: true
    });

    map.once("load", () => {
        mapLoaded = true;
        if (latestTripData) {
            renderMap(latestTripData);
        }
    });
}

async function fetchTrip() {
    if (!tripId) {
        document.getElementById("tripStatus").textContent = "Keine tripId in der URL gefunden.";
        return;
    }

    try {
        const response = await fetch(buildApiUrl("trip", { tripId }), { method: "GET", mode: "cors" });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json();
        const trip = payload && payload.success ? payload.data : null;
        if (!trip) {
            throw new Error("Ungültige Tripdaten");
        }
        latestTripData = trip;

        renderHeader(trip);
        renderStatus(trip);
        renderStops(trip);
        renderTrainTab(trip);
        renderTrackTab(trip);
        renderProviderLogo();
        bindPin(trip.id || tripId);

        if (mapLoaded) {
            await renderMap(trip);
        }
    } catch (error) {
        console.error("FI trip loading error", error);
        document.getElementById("tripStatus").textContent = "Tripdaten konnten nicht geladen werden.";
        const mapLoading = document.getElementById("map-loading");
        if (mapLoading) {
            mapLoading.style.display = "none";
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    initMap();
    fetchTrip();
    setInterval(fetchTrip, 30000);
});
