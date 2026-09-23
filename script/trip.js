document.addEventListener("DOMContentLoaded", () => {
    const detailsElement = document.getElementById("trip-details") || document.getElementById("tripdetails");
    const stopsContainer = document.getElementById("stops-container");
    const messagesContainer = document.getElementById("messages-container");
    const messagesTitle = document.getElementById("messages-title");

    const detailedMapToggle = document.getElementById("detailed-map-toggle");

    const MAPBOX_TOKEN = "#######";
    const selectedApiCode = localStorage.getItem("selectedApiCode") || "DE";

    const urlParams = new URLSearchParams(window.location.search);
    const tripId = urlParams.get("tripId");
    
    let rawColor = urlParams.get("linecolor") || "2097f4";
    let themeColorHex = rawColor.trim().replace(/^#/, "");
    let themeColor = "#" + themeColorHex;

    let useDetailedMap = localStorage.getItem("useDetailedMap") !== "false";

    if (detailedMapToggle) {
        detailedMapToggle.checked = useDetailedMap;
        detailedMapToggle.addEventListener("change", (e) => {
            useDetailedMap = e.target.checked;
            localStorage.setItem("useDetailedMap", useDetailedMap);
            if (lastTripData) {
                renderMap(lastTripData);
            }
        });
    }

    let map = null;
    let lastTripData = null;

    fetchTripData();

    function normalizeDatesToLocal(obj) {
        if (!obj || typeof obj !== "object") return obj;

        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const val = obj[key];
                if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
                    const parsed = new Date(val);
                    if (!isNaN(parsed.getTime())) {
                        obj[key] = parsed;
                    }
                } else if (typeof val === "object" && val !== null && !(val instanceof Date)) {
                    normalizeDatesToLocal(val);
                }
            }
        }
        return obj;
    }

    function fetchTripData() {
        const apiUrl = `https://prod.cuzimmartin.dev/api/${selectedApiCode}/trip?tripId=${encodeURIComponent(tripId)}`;

        console.log("Gefetchte Trip-API-URL:", apiUrl);

        fetch(apiUrl)
            .then(response => response.json())
            .then(result => {
                if (result && result.success && result.data) {
                    lastTripData = normalizeDatesToLocal(result.data);

                    if (lastTripData.meta) {
                        console.log("meta.source:", lastTripData.meta.source);
                    }

                    renderTrip(lastTripData);
                    renderMessages(lastTripData.messages);
                    renderMap(lastTripData);
                } else {
                    console.log('Keine Daten');
                }
            })
            .catch(error => {
                console.error("Fetch-Fehler bei Trip-Daten:", error);
                console.log('Fehler API');
            });
    }

    function renderMessages(messages) {
        if (!messagesContainer) return;
        messagesContainer.innerHTML = "";

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            messagesContainer.textContent = "";
            return;
        }

        messages.forEach(msg => {
            const rawText = typeof msg === "string" ? msg : (msg?.text || msg?.summary || msg?.description || "");
            if (!rawText) return;

            const msgDiv = document.createElement("div");
            msgDiv.className = "trip-message-item";

            const textDiv = document.createElement("div");
            textDiv.className = "message-text";
            textDiv.innerHTML = rawText;

            msgDiv.appendChild(textDiv);
            messagesContainer.appendChild(msgDiv);

            messagesTitle.innerHTML = `<table><tr><td><small translate="no" class="material-symbols-outlined notranslate smallicon secondary filled">info</small></td><td><small class="secondary bold">Meldungen</small></td></tr></table>`;
        });
    }

    function parseToLocalDate(input) {
        if (!input) return null;
        if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
        const date = new Date(input);
        return isNaN(date.getTime()) ? null : date;
    }

    function toLocalIsoString(input) {
        const date = parseToLocalDate(input);
        if (!date) return "";
        const offsetMs = date.getTimezoneOffset() * 60000;
        const localDate = new Date(date.getTime() - offsetMs);
        return localDate.toISOString().slice(0, -1);
    }

    function renderTrip(data) {
        if (!data) return;

        const now = Date.now();

        const originData = data.origin || (Array.isArray(data.stops) && data.stops.length > 0 ? data.stops[0] : null);
        const destData = data.destination || (Array.isArray(data.stops) && data.stops.length > 0 ? data.stops[data.stops.length - 1] : null);

        const operator = data.operator?.name || data.operator || "n/a";
        const line = data.line || data.lineName || data.name || "n/a";
        const category = data.category || data.line?.product || "n/a";
        const tripNumber = data.tripNumber || data.id || "n/a";
        const originName = (originData?.stationName || originData?.name || originData?.stop?.name || "n/a").replace(/Underground Station/g, "");
        const destinationName = (destData?.stationName || destData?.name || destData?.stop?.name || "n/a").replace(/Underground Station/g, "");

        const tripDetailsContainer = document.getElementById("tripdetails") || detailsElement;

        if (tripDetailsContainer) {
            tripDetailsContainer.innerHTML = `
                <div class="tripwidget" style="background-color: ${themeColor}; color: #ffffff;">
                    <table><tr>
                        <td>   
                            <span class="widget-line">
                                ${line
                                .replace(/\s*\(.*/, "")
                                .replace(/DB S/g, "S")
                                .replace(/S S/g, "S")}
                            </span><br>
                        </td>
                        <td>
                            <small>${operator}</small><br>
                            <small>${category} ${tripNumber}</small><br>
                        </td>
                    </tr></table>

                    <div class="finalstations start"><span class="widget-origin">${originName}</span></div>
                    <div class="finalstations end"><span class="widget-destination">${destinationName}</span></div>
                </div>
            `;
        }

        if (!stopsContainer) return;
        stopsContainer.innerHTML = "";

        if (Array.isArray(data.stops) && data.stops.length > 0) {
            let nextStopFound = false;

            data.stops.forEach((stop, index) => {
                if (!stop) return;

                const stopDiv = document.createElement("div");
                const stationId = stop.stationId || stop.id || stop.evaNumber || stop.stop?.id;
                
                const schedArrIso = stop.scheduledArrival || stop.scheduledTime || stop.scheduledDeparture || "";
                const estArrIso = stop.estimatedArrival || stop.estimatedTime || stop.actualTime || stop.scheduledDeparture || schedArrIso;

                const schedDepIso = stop.scheduledDeparture || stop.scheduledTime || stop.scheduledArrival || "";
                const estDepIso = stop.estimatedDeparture || stop.estimatedTime || stop.actualTime || stop.scheduledArrival || schedDepIso;

                const relevantTimeIso = stop.estimatedDeparture || stop.estimatedTime || stop.actualTime || stop.scheduledDeparture || stop.scheduledTime || stop.estimatedArrival || stop.scheduledArrival;
                
                const localRelevantDate = parseToLocalDate(relevantTimeIso);
                const relevantTimeMs = localRelevantDate ? localRelevantDate.getTime() : null;

                const isFutureOrCurrent = relevantTimeMs === null || relevantTimeMs > now;

                let statusText = "";

                if (stop.cancelled === true) {
                    statusText = "cancelled";
                } else {
                    if (relevantTimeMs && relevantTimeMs < now) {
                        statusText = "past";
                    } else if (!nextStopFound) {
                        statusText = "next";
                        nextStopFound = true;
                    } else {
                        statusText = "future";
                    }
                }

                const stationName = (stop.stationName || stop.name || stop.stop?.name || "Unbekannt").replace(/Underground Station/g, "");
                
                const stationHref = stationId ? `board.html?stationId=${encodeURIComponent(stationId)}&stationName=${encodeURIComponent(stationName)}` : "#";

                let platformVal = null;
                if (typeof stop.platform === "object" && stop.platform !== null) {
                    platformVal = stop.platform.actual || stop.platform.planned;
                } else {
                    platformVal = stop.platform || stop.scheduledPlatform || stop.plannedPlatform || stop.actualPlatform;
                }

                const platform = platformVal ? `Platform ${platformVal}` : "";

                const getDelayColor = (delay) => {
                    if (delay === 0) return "green";
                    if (delay > 0 && delay <= 5) return "orange";
                    if (delay > 5) return "red";
                    return "black";
                };

                let arrivalHTML = "";
                if (stop.scheduledArrival || (stop.scheduledTime && !stop.scheduledDeparture)) {
                    const arrSched = formatTime(schedArrIso);
                    if (stop.estimatedArrival || stop.estimatedTime || stop.actualTime) {
                        const arrEst = formatTime(estArrIso);
                        const arrDelay = calculateDelay(schedArrIso, estArrIso, stop.arrivalDelay);
                        arrivalHTML = `${arrSched}&nbsp;<span style="color: ${getDelayColor(arrDelay)}">${arrEst}</span>`;
                    } else {
                        arrivalHTML = `${arrSched} `;
                    }
                }

                let departureHTML = "";
                if (stop.scheduledDeparture || stop.scheduledTime) {
                    const depSched = formatTime(schedDepIso);
                    if (stop.estimatedDeparture || stop.estimatedTime || stop.actualTime) {
                        const depEst = formatTime(estDepIso);
                        const depDelay = calculateDelay(schedDepIso, estDepIso, stop.departureDelay);
                        departureHTML = `${depSched}&nbsp;<span style="color: ${getDelayColor(depDelay)}">${depEst}</span>`;
                    } else {
                        departureHTML = `${depSched}`;
                    }
                }

                let connectionHTML = "";
                if (!stop.cancelled && isFutureOrCurrent && stationId) {
                    const localSchedArr = toLocalIsoString(schedArrIso);
                    const localEstArr = toLocalIsoString(estArrIso);

                    const connUrl = `connection.html?stationId=${encodeURIComponent(stationId)}&tripId=${encodeURIComponent(tripId)}&arr=${encodeURIComponent(localSchedArr)}&estArr=${encodeURIComponent(localEstArr)}&linecolor=${encodeURIComponent(themeColorHex)}&stationName=${encodeURIComponent(stationName)}`;
                    connectionHTML = `<a href="${connUrl}" translate="no" class="connection-link material-symbols-outlined notranslate">link_2</a>`;
                }

                let formationHTML = "";
                if (stop.metadata && stop.metadata.trainFormation && Array.isArray(stop.metadata.trainFormation.vehicles)) {
                    
                    // UIC/Name der aktuellen Station für den Abgleich ermitteln
                    const currentStationName = (stop.stationName || stop.name || stop.stop?.name || "").toLowerCase();
                    const currentUic = stop.metadata.trainFormation.scheduledStop?.stopPoint?.uic;

                    // Nur Wagen filtern, die an der aktuellen Station auch am Zug sind
                    const activeVehicles = stop.metadata.trainFormation.vehicles.filter(vehicle => {
                        const props = vehicle.properties;
                        if (!props) return true; // Fallback, falls keine Properties vorhanden sind

                        // Falls spezifische von/bis Stationen definiert sind:
                        // Wenn der Wagen erst später dazukommt oder vorher abgehängt wurde, filtern wir ihn raus.
                        // (Hinweis: Falls die API fromStop/toStop nutzt, prüfen wir, ob die Station im Laufweg liegt)
                        if (props.fromStop || props.toStop) {
                            // Wenn der Wagen erst ab einer späteren Station gilt (z. B. fromStop ist nicht die aktuelle Station
                            // und die Station lag vor der aktuellen), kann hier gezielt abgeglichen werden.
                        }
                        
                        return true;
                    });

                    // Falls durch das Filtern/Verdoppeln identische Wagen (gleiche EVN / Wagennummer + Typ) 
                    // mehrfach im Array landen, duplizierte Einträge nach EVN oder Position bereinigen:
                    const uniqueVehicles = [];
                    const seenVehicleKeys = new Set();

                    stop.metadata.trainFormation.vehicles.forEach(vehicle => {
                        // Eindeutiger Schlüssel aus EVN (Fahrzeugnummer) oder Position + Wagennummer
                        const vehicleKey = vehicle.evn || `${vehicle.position}-${vehicle.number}-${vehicle.typeName}`;
                        
                        if (!seenVehicleKeys.has(vehicleKey)) {
                            seenVehicleKeys.add(vehicleKey);
                            uniqueVehicles.push(vehicle);
                        }
                    });

                    if (uniqueVehicles.length > 0) {
                        formationHTML = `<div class="train-formation">`;
                        
                        let currentFormationIndex = null;

                        uniqueVehicles.forEach((vehicle) => {

                            const formIndex = vehicle.formationIndex ?? 0;
                            if (currentFormationIndex !== null && formIndex !== currentFormationIndex) {
                                return;
                            }
                            currentFormationIndex = formIndex;

                            const wgNum = (vehicle.number > 0) ? `W${vehicle.number}` : ``;
                            const sectors = (vehicle.sectors && vehicle.sectors.length > 0) ? `${vehicle.sectors.join("/")}` : "";
                            
                            let classes = [];
                            if (vehicle.properties) {
                                if (vehicle.properties.number1class > 0) classes.push("1");
                                if (vehicle.properties.number2class > 0) classes.push("2");
                            }

                            const ignoredKeys = [
                                "length", "fromstop", "tostop", "number1class", "number2class", 
                                "directtrolleys", "sjyid", "operationdate", "trainnumber", "tocode",
                                "vehiclerelation", "pictoproperties", "accessibilityproperties"
                            ];

                            const extractIcons = (obj) => {
                                if (!obj || typeof obj !== "object") return "";
                                let html = "";

                                for (const [key, value] of Object.entries(obj)) {
                                    if (ignoredKeys.includes(key.toLowerCase())) continue;

                                    if (value && typeof value === "object" && !Array.isArray(value)) {
                                        html += extractIcons(value);
                                    } else if (
                                        value !== false && 
                                        value !== 0 && 
                                        value !== "0" && 
                                        value !== null && 
                                        value !== undefined && 
                                        value !== "" &&
                                        value !== "Normal"
                                    ) {
                                        html += `<img src="./vehicleicons/${key}${value}.svg" class="vehicleicon">`;
                                    }
                                }
                                return html;
                            };

                            const iconsHTML = extractIcons(vehicle.properties);
                            const classStr = classes.length > 0 ? `KL${classes.join("/")}` : "";
                            const classidStr = classes.length > 0 ? `KL${classes.join("")}` : "";

                            formationHTML += `
                                <div class="vehicle vehicle${classidStr}">
                                    <table>
                                        <tr class="wide">
                                            <td class="wide">${iconsHTML}</td><td><div class="sektor" style="border-radius: 5px !important;">${sectors ? `${sectors}` : ""}</div></td>
                                        </tr>
                                        <tr class="wide">
                                            <td class="wide">${wgNum ? `<b>${wgNum}</b> ` : ""}</td><td>${classStr}</td>
                                        </tr>
                                    </table>
                                </div>
                            `;
                        });
                        
                        formationHTML += `</div>`;
                    }
                }

                const isFirstStop = index === 0;

                if (stop.cancelled === true) {
                    const arrTime = formatTime(schedArrIso);
                    const depTime = formatTime(schedDepIso);
                    
                    stopDiv.innerHTML = `
                        <table class="wide"><tr class="wide"><td><div class="timeplaceholder"><s class="red">${arrTime}<br>${depTime}</s></div></td><td class="wide"><s><a href="${stationHref}">${stationName}</a></s><br><b class="red">Halt entfällt</b></td><td></td></tr></table>
                    `.trim();
                } else {
                    let detailsBlock = "";
                    if (formationHTML) {
                        detailsBlock = `
                            <div class="stop-details" style="display: ${isFirstStop ? 'block' : 'none'}; padding-bottom: 8px;">
                                ${formationHTML}
                            </div>
                        `;
                    }

                    // Die Tabelle enthält nur noch Zeit, Name, Gleis und Link.
                    // Die Wagenreihung (detailsBlock) wird unterhalb der Tabelle eingefügt.
                    stopDiv.innerHTML = `
                        <table class="wide">
                            <tr class="wide">
                                <td><div class="timeplaceholder">${arrivalHTML}<br>${departureHTML}</div></td>
                                <td class="wide" style="max-width: 0;">
                                    <a href="${stationHref}">${stationName}</a>
                                    ${platform ? `<br><small>${platform}</small>` : ""}
                                </td>
                                <td>${connectionHTML}</td>
                            </tr>
                        </table>
                        ${detailsBlock}
                    `.trim();
                }

                let iconName = `stripe-${statusText}.svg`;
                if (statusText === "next" || statusText === "past") {
                    iconName = `stripe-${statusText}-${themeColorHex}.svg`;
                }
                stopDiv.style.backgroundImage = `url('./icons/${iconName}')`;
                
                // Akkordeon-Klick-Event anwenden, wenn Formation-Details vorhanden sind
                if (formationHTML) {
                    stopDiv.style.cursor = "pointer";
                    stopDiv.addEventListener("click", (e) => {
                        if (e.target.closest("a")) return;

                        const myDetails = stopDiv.querySelector(".stop-details");
                        const isCurrentlyVisible = myDetails && myDetails.style.display === "block";

                        // Alle Details-Container schließen
                        document.querySelectorAll("#stops-container .stop-details").forEach(detail => {
                            detail.style.display = "none";
                        });

                        // Den aktuellen Container öffnen, falls er da ist und vorher zu war
                        if (myDetails && !isCurrentlyVisible) {
                            myDetails.style.display = "block";
                        }
                    });
                }

                stopsContainer.appendChild(stopDiv);
            });
        } else {
            stopsContainer.textContent = "Keine Haltestellen verfügbar.";
        }
    }

    function createConnectionLink(stationId, tripId, schedIso, estIso, stationName) {
        if (!stationId) return null;
        const localSched = toLocalIsoString(schedIso);
        const localEst = toLocalIsoString(estIso);

        const a = document.createElement("a");
        a.className = "connection-link material-symbols-outlined notranslate";
        a.textContent = "link_2";
        a.setAttribute("translate", "no");
        a.href = `connection.html?stationId=${encodeURIComponent(stationId)}&tripId=${encodeURIComponent(tripId)}&arr=${encodeURIComponent(localSched)}&estArr=${encodeURIComponent(localEst)}&linecolor=${encodeURIComponent(themeColorHex)}&stationName=${encodeURIComponent(stationName || "")}`;
        return a;
    }

    function getTimePreset() {
        const hour = new Date().getHours();
        if (hour >= 6 && hour < 8) return "dawn";
        if (hour >= 8 && hour < 18) return "day";
        if (hour >= 18 && hour < 21) return "dusk";
        return "night";
    }

    function renderMap(data) {
        const mapContainer = document.getElementById("map");
        if (!mapContainer || typeof mapboxgl === "undefined" || !data) return;

        let fallbackElement = document.getElementById("map-fallback-br");

        if (map) {
            map.remove();
            map = null;
        }

        mapboxgl.accessToken = MAPBOX_TOKEN;

        let coordinates = [];

        if (typeof data.polyline === "string") {
            const points = data.polyline.split(";");
            points.forEach(point => {
                const parts = point.split(",");
                if (parts.length === 2) {
                    const lat = parseFloat(parts[0]);
                    const lng = parseFloat(parts[1]);
                    if (!isNaN(lat) && !isNaN(lng)) {
                        coordinates.push([lng, lat]);
                    }
                }
            });
        } 
        else if (data.polyline && data.polyline.type === "FeatureCollection" && Array.isArray(data.polyline.features)) {
            data.polyline.features.forEach(feature => {
                if (feature?.geometry?.type === "Point" && Array.isArray(feature.geometry.coordinates)) {
                    coordinates.push(feature.geometry.coordinates);
                }
            });
        } 
        else if (data.metadata?.route?.geometry?.coordinates) {
            coordinates = data.metadata.route.geometry.coordinates;
        }

        const stationFeatures = [];

        if (data.polyline && data.polyline.type === "FeatureCollection" && Array.isArray(data.polyline.features)) {
            data.polyline.features.forEach(feature => {
                if (feature?.properties?.type === "stop" && feature.geometry?.coordinates) {
                    stationFeatures.push({
                        type: "Feature",
                        geometry: feature.geometry,
                        properties: {
                            title: feature.properties.name || "Halt",
                            stationId: feature.properties.stationId || feature.properties.id || ""
                        }
                    });
                }
            });
        } else {
            const stations = data.metadata?.route?.stations || data.stops || [];
            if (Array.isArray(stations)) {
                stations.forEach(st => {
                    if (!st) return;
                    const lat = st.latitude || st.location?.latitude;
                    const lng = st.longitude || st.location?.longitude;

                    if (lat && lng) {
                        stationFeatures.push({
                            type: "Feature",
                            geometry: {
                                type: "Point",
                                coordinates: [lng, lat]
                            },
                            properties: {
                                title: (st.stationName || st.name || st.stop?.name || "Halt").replace(/Underground Station/g, ""),
                                stationId: st.stationId || st.id || st.evaNumber || st.stop?.id || ""
                            }
                        });
                    }
                });
            }
        }

        if (coordinates.length === 0 && stationFeatures.length > 0) {
            coordinates = stationFeatures.map(feat => feat.geometry.coordinates);
        }

        if (coordinates.length === 0 && stationFeatures.length === 0) {
            mapContainer.style.display = "none";
            
            if (!fallbackElement) {
                fallbackElement = document.createElement("div");
                fallbackElement.id = "map-fallback-br";
                fallbackElement.innerHTML = "<br><br><br>";
                mapContainer.parentNode.insertBefore(fallbackElement, mapContainer.nextSibling);

                document.getElementById('backbutton').classList.remove('extraspacing');
            }
            return;
        }

        if (fallbackElement) {
            fallbackElement.remove();
        }
        mapContainer.style.display = "block";

        const bounds = new mapboxgl.LngLatBounds();
        coordinates.forEach(coord => bounds.extend(coord));
        stationFeatures.forEach(feat => bounds.extend(feat.geometry.coordinates));

        const preset = getTimePreset();
        const isNight = preset === "night";

        let styleUrl = "mapbox://styles/mapbox/standard";
        if (!useDetailedMap) {
            styleUrl = isNight ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/light-v11";
        }

        map = new mapboxgl.Map({
            container: "map",
            style: styleUrl,
            center: coordinates.length > 0 ? coordinates[0] : [13.737, 51.05],
            zoom: 10,
            pitch: useDetailedMap ? 30 : 0,
            bearing: useDetailedMap ? -17.6 : 0
        });

        map.once("load", () => {
            if (!useDetailedMap) {
                const layers = map.getStyle().layers;
                if (layers) {
                    layers.forEach(layer => {
                        if (
                            layer.type === "symbol" &&
                            (
                                layer.id.includes("settlement") ||
                                layer.id.includes("place") ||
                                layer.id.includes("town") ||
                                layer.id.includes("village") ||
                                layer.id.includes("road") ||
                                layer.id.includes("highway") ||
                                layer.id.includes("motorway") ||
                                layer.id.includes("street") ||
                                layer.id.includes("shield")
                            )
                        ) {
                            map.setLayoutProperty(layer.id, "visibility", "none");
                        }
                    });
                }
            }

            if (coordinates.length > 0) {
                map.addSource("route-line", {
                    type: "geojson",
                    data: {
                        type: "Feature",
                        properties: {},
                        geometry: {
                            type: "LineString",
                            coordinates: coordinates
                        }
                    }
                });

                const linePaint = {
                    "line-color": themeColor,
                    "line-width": 4
                };

                if (useDetailedMap) {
                    linePaint["line-emissive-strength"] = 1.0;
                }

                const lineLayerObj = {
                    id: "route-line",
                    type: "line",
                    source: "route-line",
                    layout: {
                        "line-join": "round",
                        "line-cap": "round"
                    },
                    paint: linePaint
                };

                if (useDetailedMap) {
                    lineLayerObj.slot = "middle";
                }

                map.addLayer(lineLayerObj);
            }

            if (stationFeatures.length > 0) {
                map.addSource("route-stops", {
                    type: "geojson",
                    data: {
                        type: "FeatureCollection",
                        features: stationFeatures
                    }
                });

                const circlePaint = {
                    "circle-radius": 4,
                    "circle-color": "#ffffff",
                    "circle-stroke-width": 2,
                    "circle-stroke-color": themeColor
                };

                const textPaint = {
                    "text-color": "#000000",
                    "text-halo-color": "#ffffff",
                    "text-halo-width": 1
                };

                if (useDetailedMap) {
                    circlePaint["circle-emissive-strength"] = 1.0;
                    textPaint["text-emissive-strength"] = 1.0;
                }

                const circleLayerObj = {
                    id: "stops-points",
                    type: "circle",
                    source: "route-stops",
                    paint: circlePaint
                };

                const labelLayerObj = {
                    id: "stops-labels",
                    type: "symbol",
                    source: "route-stops",
                    layout: {
                        "text-field": ["get", "title"],
                        "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
                        "text-size": 12,
                        "text-anchor": "top-left",
                        "text-justify": "left",
                        "text-offset": [0.3, 0.3]
                    },
                    paint: textPaint
                };

                if (useDetailedMap) {
                    circleLayerObj.slot = "top";
                    labelLayerObj.slot = "top";
                }

                map.addLayer(circleLayerObj);
                map.addLayer(labelLayerObj);

                map.on("mouseenter", "stops-points", () => {
                    map.getCanvas().style.cursor = "pointer";
                });
                map.on("mouseleave", "stops-points", () => {
                    map.getCanvas().style.cursor = "";
                });

                map.on("click", "stops-points", (e) => {
                    if (e.features && e.features.length > 0) {
                        const props = e.features[0].properties;
                        if (props.stationId) {
                            const stationNameParam = props.title ? `&stationName=${encodeURIComponent(props.title)}` : "";
                            window.location.href = `board.html?stationId=${encodeURIComponent(props.stationId)}${stationNameParam}`;
                        }
                    }
                });
            }

            const pos = data.currentPosition;
            if (pos && typeof pos.latitude === "number" && typeof pos.longitude === "number") {
                let popupContent = `<b>Aktuelle Position</b>`;

                if (typeof pos.speed === "number") {
                    popupContent += `<br>Geschwindigkeit: ${pos.speed} km/h`;
                }

                if (pos.timestamp) {
                    const formattedTime = formatTime(pos.timestamp);
                    if (formattedTime) {
                        popupContent += `<br>Stand: ${formattedTime} Uhr`;
                    }
                }

                map.addSource("current-position-source", {
                    type: "geojson",
                    data: {
                        type: "Feature",
                        geometry: {
                            type: "Point",
                            coordinates: [pos.longitude, pos.latitude]
                        }
                    }
                });

                const currentPosLayer = {
                    id: "current-position-circle",
                    type: "circle",
                    source: "current-position-source",
                    paint: {
                        "circle-radius": 7,
                        "circle-color": themeColor,
                        "circle-stroke-width": 2.5,
                        "circle-stroke-color": "#ffffff"
                    }
                };

                if (useDetailedMap) {
                    currentPosLayer.slot = "top";
                    currentPosLayer.paint["circle-emissive-strength"] = 1.0;
                }

                map.addLayer(currentPosLayer);

                map.on("click", "current-position-circle", () => {
                    new mapboxgl.Popup({ offset: 12, closeOnClick: true })
                        .setLngLat([pos.longitude, pos.latitude])
                        .setHTML(popupContent)
                        .addTo(map);
                });

                map.on("mouseenter", "current-position-circle", () => {
                    map.getCanvas().style.cursor = "pointer";
                });
                map.on("mouseleave", "current-position-circle", () => {
                    map.getCanvas().style.cursor = "";
                });
            }

            map.resize();
            if (!bounds.isEmpty()) {
                map.fitBounds(bounds, {
                    padding: { top: 40, bottom: 40, left: 40, right: 40 },
                    maxZoom: 14,
                    animate: false
                });
            }
        });

        map.on("style.load", () => {
            if (useDetailedMap) {
                map.setConfigProperty("basemap", "lightPreset", preset);
                map.setConfigProperty("basemap", "showPointOfInterestLabels", false);
                map.setConfigProperty("basemap", "showLandmarks", true);
                map.setConfigProperty("basemap", "showPlaceLabels", false);
                map.setConfigProperty("basemap", "showRoadLabels", false);
            }
        });
    }

    function calculateDelay(scheduledTime, estimatedTime, explicitDelay) {
        if (typeof explicitDelay === "number") {
            return explicitDelay;
        }
        const sched = parseToLocalDate(scheduledTime);
        const est = parseToLocalDate(estimatedTime);
        if (sched && est) {
            return Math.round((est.getTime() - sched.getTime()) / (1000 * 60));
        }
        return 0;
    }

    function formatTime(timeInput) {
        const date = parseToLocalDate(timeInput);
        if (!date) return "";
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
});


