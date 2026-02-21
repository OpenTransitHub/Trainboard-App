    if (localStorage.getItem('webfis') === 'false') {
        document.getElementById('webfisbutton').classList.add('hidden')
    } 


    // Globale Variablen
    let map;
    let marker;
    let intervalId;
    let stationId;
    let constructionsLoaded = false; // Flag für Lazy Loading
    let updateIntervalId = null; // Für Page Visibility API
    const tripId = decodeURIComponent(getParameterByName('tripId'));
    const mapLoadingElement = document.getElementById('map-loading');

    function showMapLoading() {
        if (mapLoadingElement) {
            mapLoadingElement.style.display = 'block';
        }
    }

    function hideMapLoading() {
        if (mapLoadingElement) {
            mapLoadingElement.style.display = 'none';
        }
    }

    // Funktion, um Parameter aus der URL zu extrahieren
    function getParameterByName(name, url = window.location.href) {
        name = name.replace(/[\[\]]/g, '\\$&');
        const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)');
        const results = regex.exec(url);
        if (!results) return null;
        if (!results[2]) return '';
        return decodeURIComponent(results[2].replace(/\+/g, ' '));
    }

    function isValidCoordinate(coord) {
        return Array.isArray(coord) &&
            coord.length >= 2 &&
            Number.isFinite(Number(coord[0])) &&
            Number.isFinite(Number(coord[1])) &&
            Math.abs(Number(coord[0])) <= 180 &&
            Math.abs(Number(coord[1])) <= 90;
    }

    function hasJsonContentType(response) {
        const contentType = response && response.headers ? response.headers.get('content-type') : '';
        if (!contentType) {
            return false;
        }
        return contentType.includes('application/json') || contentType.includes('+json') || contentType.includes('text/json');
    }

    async function fetchJsonStrict(url) {
        const response = await fetch(url, { method: 'GET', mode: 'cors' });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        if (!hasJsonContentType(response)) {
            const snippet = (await response.text()).slice(0, 80);
            throw new Error(`Non-JSON response: ${snippet}`);
        }
        return response.json();
    }

    async function fetchFirstJson(urls) {
        let lastError = null;
        for (const url of urls) {
            try {
                return await fetchJsonStrict(url);
            } catch (error) {
                lastError = error;
            }
        }
        throw lastError || new Error('Request failed');
    }

    function normalizeTripFromApi(payload) {
        if (payload && payload.trip) {
            return payload;
        }
        if (!(payload && payload.success && payload.data && typeof payload.data === 'object')) {
            return null;
        }

        const rawTrip = payload.data;
        const stops = Array.isArray(rawTrip.stops) ? rawTrip.stops : [];
        const routeStations = rawTrip && rawTrip.metadata && rawTrip.metadata.route && Array.isArray(rawTrip.metadata.route.stations)
            ? rawTrip.metadata.route.stations
            : [];
        const stationCoordinateById = new Map();
        routeStations.forEach((station) => {
            const id = station && (station.stationId || station.id);
            const lon = Number(station && (station.longitude || station.lon || station.lng || station.x));
            const lat = Number(station && (station.latitude || station.lat || station.y));
            if (id && isValidCoordinate([lon, lat])) {
                stationCoordinateById.set(String(id), { longitude: lon, latitude: lat });
            }
        });
        const firstStop = stops[0] || null;
        const lastStop = stops.length > 0 ? stops[stops.length - 1] : null;
        const lineRaw = rawTrip && rawTrip.line ? rawTrip.line : null;
        const lineRawName = typeof lineRaw === 'string'
            ? lineRaw
            : (lineRaw && typeof lineRaw === 'object'
                ? String(lineRaw.name || lineRaw.label || lineRaw.display || lineRaw.shortName || lineRaw.line || '').trim()
                : '');
        const lineName = String(lineRawName || rawTrip.lineName || rawTrip.tripNumber || '').trim();
        const derivedNumber = lineName.replace(/[^\d]/g, '');
        const fahrtNr = String(
            rawTrip.tripNumber ||
            (lineRaw && typeof lineRaw === 'object' ? (lineRaw.fahrtNr || lineRaw.number || lineRaw.trainNumber || '') : '') ||
            derivedNumber ||
            lineName ||
            ''
        );
        const productName = String(
            (lineRaw && typeof lineRaw === 'object' ? (lineRaw.productName || lineRaw.product || '') : '') ||
            rawTrip.productName ||
            rawTrip.trainType ||
            (lineName.split(/\s+/)[0] || String(rawTrip.category || 'zug'))
        ).toUpperCase();
        const product = String(
            (lineRaw && typeof lineRaw === 'object' ? (lineRaw.product || lineRaw.mode || '') : '') ||
            rawTrip.category ||
            ''
        ).toLowerCase();
        const operatorRaw =
            (lineRaw && typeof lineRaw === 'object' ? lineRaw.operator : null) ||
            rawTrip.operator ||
            {};
        const operatorId = String(
            operatorRaw.id ||
            operatorRaw.operatorId ||
            operatorRaw.shortCode ||
            (payload.meta && payload.meta.operator ? payload.meta.operator : 'db')
        ).toLowerCase();
        const operatorName = String(
            operatorRaw.name ||
            operatorRaw.displayName ||
            (payload.meta && payload.meta.source ? payload.meta.source : 'Deutsche Bahn')
        );

        const stopovers = stops.map((stop) => {
            const locationSource = stop && stop.location ? stop.location : null;
            const directLon = Number(stop && (stop.longitude || stop.lon || stop.lng || stop.x));
            const directLat = Number(stop && (stop.latitude || stop.lat || stop.y));
            const locLon = Number(locationSource && (locationSource.longitude || locationSource.lon || locationSource.lng || locationSource.x));
            const locLat = Number(locationSource && (locationSource.latitude || locationSource.lat || locationSource.y));
            const fallback = stationCoordinateById.get(String(stop.stationId || ""));
            const longitude = Number.isFinite(locLon) ? locLon : (Number.isFinite(directLon) ? directLon : (fallback ? fallback.longitude : NaN));
            const latitude = Number.isFinite(locLat) ? locLat : (Number.isFinite(directLat) ? directLat : (fallback ? fallback.latitude : NaN));
            const hasCoord = isValidCoordinate([longitude, latitude]);

            return {
                stop: {
                    id: stop.stationId || '',
                    name: stop.stationName || '',
                    location: {
                        id: stop.stationId || '',
                        longitude: hasCoord ? Number(longitude) : undefined,
                        latitude: hasCoord ? Number(latitude) : undefined
                    }
                },
                plannedArrival: stop.scheduledArrival || null,
                arrival: stop.estimatedArrival || stop.scheduledArrival || null,
                plannedDeparture: stop.scheduledDeparture || null,
                departure: stop.estimatedDeparture || stop.scheduledDeparture || null,
                plannedArrivalPlatform: stop.platform || null,
                plannedDeparturePlatform: stop.platform || null,
                arrivalPlatform: stop.platform || null,
                departurePlatform: stop.platform || null,
                platformChanged: false,
                cancelled: stop.cancelled === true,
                remarks: []
            };
        });

        const remarks = Array.isArray(rawTrip.messages)
            ? rawTrip.messages.map((message) => ({
                text: typeof message === 'string' ? message : (message && message.text ? message.text : ''),
                type: message && message.type ? message.type : 'info'
            })).filter((entry) => entry.text)
            : [];

        const normalizedTrip = {
            id: rawTrip.id || '',
            line: {
                fahrtNr,
                name: lineName || fahrtNr,
                productName,
                product,
                operator: {
                    id: operatorId,
                    name: operatorName
                }
            },
            direction: rawTrip.destination && rawTrip.destination.stationName ? rawTrip.destination.stationName : '',
            origin: {
                name: rawTrip.origin && rawTrip.origin.stationName ? rawTrip.origin.stationName : (firstStop ? firstStop.stationName : ''),
                departurePlatform: rawTrip.origin && rawTrip.origin.platform ? rawTrip.origin.platform : (firstStop && firstStop.platform ? firstStop.platform : null)
            },
            destination: {
                name: rawTrip.destination && rawTrip.destination.stationName ? rawTrip.destination.stationName : (lastStop ? lastStop.stationName : ''),
                arrivalPlatform: rawTrip.destination && rawTrip.destination.platform ? rawTrip.destination.platform : (lastStop && lastStop.platform ? lastStop.platform : null)
            },
            plannedDeparture: rawTrip.origin && rawTrip.origin.scheduledTime ? rawTrip.origin.scheduledTime : (firstStop ? firstStop.scheduledDeparture || firstStop.scheduledArrival : null),
            plannedArrival: rawTrip.destination && rawTrip.destination.scheduledTime ? rawTrip.destination.scheduledTime : (lastStop ? lastStop.scheduledArrival || lastStop.scheduledDeparture : null),
            stopovers,
            remarks,
            currentLocation: rawTrip.currentPosition
                ? {
                    latitude: rawTrip.currentPosition.latitude,
                    longitude: rawTrip.currentPosition.longitude
                }
                : null,
            _raw: rawTrip
        };

        return {
            provider: payload.meta && payload.meta.operator ? String(payload.meta.operator).toLowerCase() : 'db',
            trip: normalizedTrip
        };
    }

    async function fetchTripPayload(requestTripId, requestStationId) {
        const encodedTripId = encodeURIComponent(requestTripId || '');
        const urls = [`https://prod.cuzimmartin.dev/api/de/trip?tripId=${encodedTripId}`];

        let lastError = null;
        for (const url of urls) {
            try {
                const payload = await fetchJsonStrict(url);
                const normalized = normalizeTripFromApi(payload);
                if (normalized && normalized.trip) {
                    return normalized;
                }
            } catch (error) {
                lastError = error;
            }
        }
        throw lastError || new Error('Trip request failed');
    }

    async function fetchPolylinePayload(requestTripId, requestStationId) {
        const encodedTripId = encodeURIComponent(requestTripId || '');
        const encodedStation = requestStationId ? encodeURIComponent(requestStationId) : '';
        const urls = [];
        if (encodedStation) {
            urls.push(`https://data.cuzimmartin.dev/trip/${encodedTripId}/polyline?stationID=${encodedStation}`);
        }
        urls.push(`https://data.cuzimmartin.dev/trip/${encodedTripId}/polyline`);
        return fetchFirstJson(urls);
    }

    function parseLatLonPairString(value) {
        if (typeof value !== 'string' || !value.includes(',') || !value.includes(';')) {
            return [];
        }
        const points = [];
        value.split(';').forEach((pair) => {
            const parts = pair.trim().split(',');
            if (parts.length < 2) {
                return;
            }
            const first = Number(parts[0]);
            const second = Number(parts[1]);
            if (Number.isFinite(first) && Number.isFinite(second)) {
                const asLatLon = [second, first];
                const asLonLat = [first, second];
                if (isValidCoordinate(asLatLon)) {
                    points.push(asLatLon);
                } else if (isValidCoordinate(asLonLat)) {
                    points.push(asLonLat);
                }
            }
        });
        return points;
    }

    function extractPolylineCoordinates(value) {
        if (!value) {
            return [];
        }
        if (typeof value === 'string') {
            return parseLatLonPairString(value);
        }
        if (Array.isArray(value)) {
            if (value.length > 0 && Array.isArray(value[0])) {
                return value
                    .map((coord) => [Number(coord[0]), Number(coord[1])])
                    .filter((coord) => isValidCoordinate(coord));
            }
            return [];
        }
        if (value.type === 'LineString' && Array.isArray(value.coordinates)) {
            return value.coordinates
                .map((coord) => [Number(coord[0]), Number(coord[1])])
                .filter((coord) => isValidCoordinate(coord));
        }
        if (Array.isArray(value.features)) {
            return value.features
                .filter((feature) => feature && feature.geometry && feature.geometry.type === 'Point' && isValidCoordinate(feature.geometry.coordinates))
                .map((feature) => [Number(feature.geometry.coordinates[0]), Number(feature.geometry.coordinates[1])]);
        }
        if (value.polyline) {
            return extractPolylineCoordinates(value.polyline);
        }
        if (value.geometry) {
            return extractPolylineCoordinates(value.geometry);
        }
        return [];
    }

    function buildFeatureCollectionFromNormalizedTrip(tripPayload) {
        const raw = tripPayload && tripPayload.trip && tripPayload.trip._raw ? tripPayload.trip._raw : null;
        const features = [];
        const polylineCoordinates = extractPolylineCoordinates(raw && raw.polyline ? raw.polyline : null);
        polylineCoordinates.forEach((coord) => {
            if (isValidCoordinate(coord)) {
                features.push({
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [Number(coord[0]), Number(coord[1])]
                    },
                    properties: { type: 'line' }
                });
            }
        });

        const stopovers = tripPayload && tripPayload.trip && Array.isArray(tripPayload.trip.stopovers)
            ? tripPayload.trip.stopovers
            : [];
        stopovers.forEach((stopover) => {
            const location = stopover && stopover.stop && stopover.stop.location ? stopover.stop.location : null;
            if (!location) {
                return;
            }
            const lon = Number(location.longitude || location.lon || location.lng || location.x);
            const lat = Number(location.latitude || location.lat || location.y);
            const coord = [lon, lat];
            if (isValidCoordinate(coord)) {
                features.push({
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: coord
                    },
                    properties: {
                        type: 'stop',
                        name: stopover.stop && stopover.stop.name ? stopover.stop.name : 'Halt'
                    }
                });
            }
        });
        return features;
    }

    function getStopFeaturesFromTrip(tripData, fallbackFeatures) {
        const byCoord = new Map();
        const pushStop = (lon, lat, name) => {
            const coord = [Number(lon), Number(lat)];
            if (!isValidCoordinate(coord)) {
                return;
            }
            const key = `${coord[0].toFixed(6)},${coord[1].toFixed(6)}`;
            if (!byCoord.has(key)) {
                byCoord.set(key, {
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: coord },
                    properties: { description: name || 'Halt' }
                });
            }
        };

        const stopovers = tripData && tripData.trip && Array.isArray(tripData.trip.stopovers) ? tripData.trip.stopovers : [];
        stopovers.forEach((stopover) => {
            const location = stopover && stopover.stop && stopover.stop.location ? stopover.stop.location : null;
            if (!location) {
                return;
            }
            const lon = location.longitude || location.lon || location.lng || location.x;
            const lat = location.latitude || location.lat || location.y;
            pushStop(lon, lat, stopover.stop && stopover.stop.name ? stopover.stop.name : 'Halt');
        });

        if (byCoord.size === 0 && Array.isArray(fallbackFeatures)) {
            fallbackFeatures
                .filter((feature) => feature && feature.geometry && feature.geometry.type === 'Point' && feature.properties && feature.properties.type === 'stop')
                .forEach((feature) => {
                    const coord = feature.geometry.coordinates || [];
                    pushStop(coord[0], coord[1], feature.properties.name || 'Halt');
                });
        }

        return Array.from(byCoord.values());
    }

    // Page Visibility API für Update-Interval Management
    function handleVisibilityChange() {
        if (document.hidden) {
            // Tab ist nicht aktiv - stoppe Updates
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
            if (updateIntervalId) {
                clearInterval(updateIntervalId);
                updateIntervalId = null;
            }
        } else {
            // Tab ist wieder aktiv - starte Updates neu
            if (!intervalId && marker) {
                intervalId = setInterval(() => updateCurrentPosition(tripId), 10000);
            }
            if (!updateIntervalId) {
                updateIntervalId = setInterval(fetchAndDisplayData, 30000);
            }
            // Führe sofort ein Update durch
            updateCurrentPosition(tripId);
            fetchAndDisplayData();
        }
    }

    // Event Listener für Page Visibility
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Initialisiere Map sofort beim Seitenaufruf
    function initializeMap() {
        mapboxgl.accessToken = 'pk.eyJ1IjoiY3V6aW1tYXJ0aW4iLCJhIjoiY204dGRyb3AxMDgxcDJrc2VjeXVwNXN3NyJ9.VR8xzsuQJ_-0h95CN_UD8g';
    
        const mapStyle = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches 
        ? 'dusk'
        : '';  

        // Karte mit Standardposition initialisieren (Österreich)
        map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/standard', 
            config: {
                basemap: {
                    lightPreset: mapStyle,
                    font: "Roboto",
                    showPlaceLabels: false,
                    showPointOfInterestLabels: false,
                    backgroundPointOfInterestLabels: "none",
                    fuelingStationModePointOfInterestLabels: "none",
                    showRoadLabels: false,
                    showLandmarkIconLabels: false
                }
            },
            center: [13.3, 47.8],
            zoom: 2,
            pitch: 47,
            bearing: 0,
            antialias: true
        });

        showMapLoading();

        map.on('error', () => {
            hideMapLoading();
        });

        setTimeout(() => {
            hideMapLoading();
        }, 15000);

        // Map ist bereit, lade die Daten
        map.once('load', async () => {
            loadMapData();
            hideMapLoading();
        });
    }

    // Lade Kartendaten parallel
    async function loadMapData() {
        stationId = getParameterByName('stationID');

        if (!tripId) {
            alert("Keine tripId in der URL gefunden.");
            hideMapLoading();
            return;
        }

        try {
            const [tripData, polylineData] = await Promise.all([
                fetchTripPayload(tripId, stationId),
                fetchPolylinePayload(tripId, stationId).catch(() => null)
            ]);

            const polylineFeatures = polylineData && polylineData.polyline && Array.isArray(polylineData.polyline.features)
                ? polylineData.polyline.features
                : buildFeatureCollectionFromNormalizedTrip(tripData);

            if (Array.isArray(polylineFeatures) && polylineFeatures.length > 0) {
                const coordinates = polylineFeatures
                    .filter(feature => feature.geometry.type === "Point")
                    .map(feature => [feature.geometry.coordinates[0], feature.geometry.coordinates[1]]);

                if (coordinates.length > 0) {
                    // Füge Route hinzu
                    const fullRoute = {
                        'type': 'Feature',
                        'geometry': {
                            'type': 'LineString',
                            'coordinates': coordinates
                        }
                    };

                    map.addSource('fullRoute', {
                        'type': 'geojson',
                        'data': fullRoute
                    });

                    const routeLineColor = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches 
                    ? '#ffffff'
                    : '#343332'; 

                    map.addLayer({
                        'id': 'fullRoute',
                        'type': 'line',
                        'source': 'fullRoute',
                        'layout': {
                            'line-join': 'round',
                            'line-cap': 'round'
                        },
                        'paint': {
                            'line-color': routeLineColor,
                            'line-width': 4,
                            'line-emissive-strength': 50,
                        },
                        
                    });

                    // Stopps hinzufügen
                    const stopFeatures = getStopFeaturesFromTrip(tripData, polylineFeatures);

                    if (stopFeatures.length > 0) {

                        map.addSource('stops', {
                            'type': 'geojson',
                            'data': {
                                'type': 'FeatureCollection',
                                'features': stopFeatures
                            }
                        });

                        const textColor = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches 
                        ? '#ffffff'
                        : '#000000';
                        
                        const textHaloColor = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches 
                        ? '#445a59'
                        : '#ffffff';

                        map.addLayer({
                            'id': 'poi-labels',
                            'type': 'symbol',
                            'source': 'stops',
                            'layout': {
                                'text-field': ['get', 'description'],
                                'text-variable-anchor': ['left'],
                                'text-radial-offset': 1,
                                'text-justify': 'auto'
                            },
                            'paint': {
                                'text-color': textColor,
                                'text-halo-color': textHaloColor,
                                'text-halo-width': 2
                            }
                        });
                    }

                    // Stop-Marker hinzufügen
                    polylineFeatures.forEach(feature => {
                        if (feature.geometry.type === "Point" && feature.properties.type === "stop") {
                            const stopMarker = document.createElement('img');
                            stopMarker.src = '../assets/icons/stop-marker.svg';
                            stopMarker.style.width = '10px';
                            stopMarker.style.height = '10px';

                            new mapboxgl.Marker({
                                element: stopMarker
                            })
                                .setLngLat(feature.geometry.coordinates)
                                .addTo(map);
                        }
                    });

                    // Aktueller Standort des Zuges
                    if (tripData.trip && tripData.trip.currentLocation) {
                        const currentLocation = [tripData.trip.currentLocation.longitude, tripData.trip.currentLocation.latitude];

                        const imageMarker = document.createElement('img');
                        imageMarker.src = '../assets/icons/mapmarker.svg';
                        imageMarker.style.width = '40px';
                        imageMarker.style.height = '40px';

                        marker = new mapboxgl.Marker({
                            element: imageMarker
                        })
                            .setLngLat(currentLocation)
                            .addTo(map);

                        // Starte Intervall für Updates nur wenn Tab aktiv ist
                        if (!document.hidden) {
                            intervalId = setInterval(() => updateCurrentPosition(tripId), 10000);
                        }
                    }

                    // Karte auf Route zoomen
                    const bounds = coordinates.reduce(function (bounds, coord) {
                        return bounds.extend(coord);
                    }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

                    map.fitBounds(bounds, {
                        padding: { top: 50, bottom: 50, left: 50, right: 50 },
                        duration: 800
                    });

                    
                }
            }

        } catch (error) {
            console.error("Fehler beim Laden der Kartendaten:", error);
        } finally {
            hideMapLoading();
        }
    }

    // Lazy Loading für Baustellen-Daten
    async function loadConstructions() {
        if (constructionsLoaded) return; // Bereits geladen

        constructionsLoaded = true;

        try {
            let constructionsUrl = `https://data.cuzimmartin.dev/trip/${encodeURIComponent(tripId)}/baustellen`;
            let response = await fetch(constructionsUrl);
            let constructionData = await response.json();

            const constructionsList = document.getElementById('constructions');
            constructionsList.innerHTML = ''; // Clear existing content

            if (constructionData.baustellen && constructionData.baustellen.length > 0) {
                document.getElementById('loadingConstructions').classList.add('hidden');

                // Füge Baustellen-Marker zur Karte hinzu
                //if (map && map.loaded()) {
                  //  constructionData.baustellen.forEach(baustelle => {
                    //    const baustellenMarker = document.createElement('img');
                      //  baustellenMarker.src = './assets/icons/' + baustelle.wirkung + '-marker.svg';
                        //baustellenMarker.style.width = '10px';
                        //baustellenMarker.style.height = '10px';

                        //new mapboxgl.Marker({
                        //    element: baustellenMarker
                      //  })
                     //       .setLngLat([baustelle.koordinaten.von.x, baustelle.koordinaten.von.y])
                     //       .addTo(map);
                  //  });
              //  }

                constructionData.baustellen.forEach((baustellen) => {
                    let wirkung;

                    if (baustellen.wirkung == 'ABWEICHUNG_VOM_FPL') {
                        wirkung = 'Abweichung vom Fahrplan'
                    } else if (baustellen.wirkung == 'FAHRZEITVERLAENGERUNG') {
                        wirkung = 'Fahrzeitverlängerung auf Regellaufweg'
                    } else if (baustellen.wirkung == 'SONSTIGES') {
                        wirkung = 'Sonstiges'
                    } else if (baustellen.wirkung == 'TOTALSPERRUNG') {
                        wirkung = 'Totalsperrung'
                    } else if (baustellen.wirkung == 'GGL_MIT_ZS_6') {
                        wirkung = 'Fahrt auf Gegengleis mit Signal Zs 6'
                    } else if (baustellen.wirkung == 'GGL_MIT_ZS8') {
                        wirkung = 'Fahrt auf Gegengleis mit Signal Zs 8'
                    } else {
                        wirkung = baustellen.wirkung;
                    }

                    let constructioncolor;

                    if (['ABWEICHUNG_VOM_FPL', 'SONSTIGES', 'GGL_MIT_ZS_6', 'GGL_MIT_ZS_8'].includes(baustellen.wirkung)) {
                        constructioncolor = 'yellow';
                    } else if (['FAHRZEITVERLAENGERUNG', 'TOTALSPERRUNG'].includes(baustellen.wirkung)) {
                        constructioncolor = 'lightred';
                    } 

                    constructionsList.innerHTML += `
                    <div class="listitem">
                        <div class="listimagecontainer listimagecontainer${constructioncolor}"><img src="../assets/icons/${baustellen.wirkung}.svg"></div>
                        <div class="listitemtext">
                            ${wirkung}<br><small class="disabled">${baustellen.arbeiten}</small><br><div class="startStation"><small class="disabled">Von </small>${baustellen.langnameVon}</div><div class="endStation"><small class="disabled">Bis </small>${baustellen.langnameBis}</div>
                        </div>
                    </div>

                    `   
                    
                });

                const baustellenCount = constructionData.baustellen.length;
                document.getElementById('trackTab').innerHTML = `Strecke <span class=\"pill\">&nbsp;${baustellenCount}&nbsp;</span>`;
            } else {
                document.getElementById('loadingConstructions').innerHTML = `<div class="listcontainer"><div class="listitem" style="display: block"><br><center><img src="../assets/icons/check.svg" class="bigicon"><h3>Freie Fahrt</h3>Für diese Strecke liegen keine Meldungen vor.</center><br></div></div>`;
            }
        } catch (error) {
            console.error("Fehler beim Laden der Baustellen:", error);
            document.getElementById('loadingConstructions').innerHTML = `<div class="listcontainer"><div class="listitem" style="display: block"><br><center><img src="../assets/icons/finderror.svg" class="bigicon"><h3>Fehler</h3>Wir konnten keine Streckeninformationen abrufen.</center><br></div></div>`;
        }
    }

    // Funktion zur Aktualisierung der aktuellen Position auf der Karte
    async function updateCurrentPosition(tripId) {
        // Nur updaten wenn Tab aktiv ist
        if (document.hidden) return;

        try {
            const tripData = await fetchTripPayload(tripId, stationId);

            if (tripData.trip && tripData.trip.currentLocation && marker) {
                const newPosition = [tripData.trip.currentLocation.longitude, tripData.trip.currentLocation.latitude];
                marker.setLngLat(newPosition);
            }
        } catch (error) {
            console.error("Fehler beim Aktualisieren der Position:", error);
        }
    }

    // Starte Map-Initialisierung sofort
    initializeMap();

    // Scroll-Animation
    window.scroll({
        top: 300,
        behavior: "smooth",
    });

    // Tabs Störungen - modifiziert für Lazy Loading
    function openCity(evt, cityName) {
        var i, tabcontent, tablinks;

        tabcontent = document.getElementsByClassName("tabcontent");
        for (i = 0; i < tabcontent.length; i++) {
            tabcontent[i].style.display = "none";
        }

        tablinks = document.getElementsByClassName("tablinks");
        for (i = 0; i < tablinks.length; i++) {
            tablinks[i].className = tablinks[i].className.replace(" tabActive", "");
        }

        document.getElementById(cityName).style.display = "block";
        evt.currentTarget.className += " tabActive";

        // Lazy Loading: Lade Baustellen beim ersten Klick auf "Strecke" Tab
        if (cityName === 'Strecke' && !constructionsLoaded) {
            loadConstructions();
        }
    }

    async function fetchAndDisplayData() {
        // Nur updaten wenn Tab aktiv ist
        if (document.hidden) return;

        try {
            const currentUrl = window.location.href;
            const tripId = decodeURIComponent(getParameterByName('tripId', currentUrl));
            stationId = getParameterByName('stationID', currentUrl);

            if (!tripId) {
                document.getElementById('tripStatus').textContent = 'Keine gültige tripId gefunden.';
                return;
            }

            const data = await fetchTripPayload(tripId, stationId);

            if (!data || !data.trip) {
                throw new Error('Trip payload invalid');
            }

            if (data.provider) {
                document.getElementById('logo').innerHTML = `<img src="../assets/providerLogos/${data.provider}.svg" class="trip-logo" title="${data.provider} Logo">`;
            }

            profileUsed = 'api';

            if (!data) {
                console.error('Fehler beim Abrufen der Trip-Daten.');
                const statusElement = document.getElementById('tripStatus');
                document.getElementById('body').innerHTML = `
                <nav id="navbar">
                    <div class="tabs"><span class="active">&nbsp;Zuginformationen&nbsp;</span></div>
                    <div class="iconbar bigonly"><a href="#" onclick="history.go(-1)">Schließen</a></div>
                    <div class="iconbar"><a href="#" onclick="history.go(-1)"><img src="../assets/icons/close.svg" class="mediumicon"></a></div>
                </nav>

                <center>
                <br><br>
                <h1>⛓️‍💥</h1>
                <h3>Fehler beim Abrufen der Daten</h3>

                <p>Dieser Link ist ungültig oder deine Internet-Verbindung wurde unterbrochen.</p>

                <br>

                <div onClick=\"history.go(0)\" class="button reload">Erneut laden</div>

            `;
                return;
            }

        // Funktion zur Aktualisierung des Zugstatus
        function updateTrainStatus(trip) {
            let currentTime = new Date();
            let departureTime = trip.departure ? new Date(trip.departure) : null;
            let arrivalTime = trip.arrival ? new Date(trip.arrival) : null;

            const statusElement = document.getElementById('tripStatus');

            function formatTimeDifference(timeDiffMillis) {
                const totalMinutes = Math.round(timeDiffMillis / 60000);
                const hours = Math.floor(totalMinutes / 60);
                const minutes = totalMinutes % 60;

                let timeString = '';
                if (hours > 0) {
                    timeString = `${hours} Stunde${hours > 1 ? 'n' : ''}`;
                    if (minutes > 0) {
                        timeString += ` und ${minutes} Minute${minutes !== 1 ? 'n' : ''}`;
                    }
                } else {
                    timeString = `${minutes} Minute${minutes !== 1 ? 'n' : ''}`;
                }

                return timeString;
            }

            function getPlatformInfo(platform) {
                return platform ? `auf Gleis ${platform}` : 'ohne festgelegtes Gleis';
            }

            const isTripCancelled = trip.cancelled === true;
            const allStopoversCancelled = trip.stopovers.every(stop => (stop.cancelled === true));

            if (isTripCancelled && allStopoversCancelled) {
                statusElement.innerHTML = `${trip.line.name.split("(Zug-Nr")[0]} ist vollständig ausgefallen.`;
                return;
            }

            const cancelledStopovers = trip.stopovers.filter(stop => ((stop.cancelled) && (stop.arrival == null) && (stop.departure == null)));
            const activeStopovers = trip.stopovers.filter(stop => ((!stop.cancelled) && (stop.arrival !== null) && (stop.departure !== null)));

            function findNextActiveStopover() {
                for (let i = 0; i < activeStopovers.length; i++) {
                    const stop = activeStopovers[i];
                    const plannedDeparture = stop.plannedDeparture ? new Date(stop.plannedDeparture) : null;
                    const actualDeparture = stop.departure ? new Date(stop.departure) : null;

                    if ((plannedDeparture && plannedDeparture > currentTime) || (actualDeparture && actualDeparture > currentTime)) {
                        return stop;
                    }
                }
                return null;
            }

            if (departureTime && currentTime < departureTime && !trip.origin.cancelled) {
                const timeUntilDeparture = departureTime - currentTime;
                const timeString = formatTimeDifference(timeUntilDeparture);

                const platformInfo = getPlatformInfo(trip.departurePlatform || trip.plannedDeparturePlatform);

                statusElement.innerHTML = `${trip.line.name.split("(Zug-Nr")[0]} fährt in ${timeString} von <b class="markedstation">${trip.origin.name}</b> ${platformInfo} ab.`;
                return;
            }

            let nextStop = findNextActiveStopover();

            if (nextStop) {
                const arrivalTimeAtNextStop = nextStop.arrival ? new Date(nextStop.arrival) : new Date(nextStop.plannedArrival);
                const timeUntilNextStop = arrivalTimeAtNextStop - currentTime;
                const timeString = formatTimeDifference(timeUntilNextStop);

                const platformInfoArrival = getPlatformInfo(nextStop.arrivalPlatform || nextStop.plannedArrivalPlatform);
                const platformInfoDeparture = getPlatformInfo(nextStop.departurePlatform || nextStop.plannedDeparturePlatform);

                if (timeUntilNextStop > 0) {
                    statusElement.innerHTML = `${trip.line.name.split("(Zug-Nr")[0]} erreicht in ${timeString} <b class="markedstation">${nextStop.stop.name}</b> ${platformInfoArrival}.`;
                } else {
                    const departureTimeAtNextStop = nextStop.departure ? new Date(nextStop.departure) : new Date(nextStop.plannedDeparture);
                    const timeUntilDeparture = departureTimeAtNextStop - currentTime;

                    if (timeUntilDeparture > 0) {
                        const departureTimeString = formatTimeDifference(timeUntilDeparture);

                        statusElement.innerHTML = `${trip.line.name.split("(Zug-Nr")[0]} steht aktuell in <b class="markedstation">${nextStop.stop.name}</b> und fährt in ${departureTimeString} ${platformInfoDeparture} ab.`;
                    } else {
                        statusElement.innerHTML = `${trip.line.name.split("(Zug-Nr")[0]} hat <b class="markedstation">${nextStop.stop.name}</b> gerade verlassen und ist auf dem Weg zum nächsten Halt.`;
                    }
                }
            } else {
                if (arrivalTime && currentTime >= arrivalTime && !trip.destination.cancelled) {
                    statusElement.innerHTML = `${trip.line.name.split("(Zug-Nr")[0]} hat sein Ziel <b class="markedstation">${trip.destination.name}</b> erreicht.`;
                } else if (trip.destination.cancelled) {
                    statusElement.innerHTML = `${trip.line.name.split("(Zug-Nr")[0]} endet vorzeitig und erreicht nicht sein geplantes Ziel.`;
                } else {
                    const timeUntilArrival = arrivalTime ? arrivalTime - currentTime : null;
                    const timeString = timeUntilArrival ? formatTimeDifference(timeUntilArrival) : 'unbekannter Zeit';

                    const platformInfo = getPlatformInfo(trip.arrivalPlatform || trip.plannedArrivalPlatform);

                    statusElement.innerHTML = `${trip.line.name.split("(Zug-Nr")[0]} ist auf dem Weg zu seinem Endziel <b class="markedstation">${trip.destination.name}</b> und wird in ${timeString} ${platformInfo} ankommen.`;
                }
            }

            if (cancelledStopovers.length > 0) {
                const cancelledStopsNames = cancelledStopovers.map(stop => stop.stop.name).join(', ');
                statusElement.innerHTML += `\nDie folgenden Halte entfallen: ${cancelledStopsNames}.`;
            }
        }

        if ((data.trip.line.productName === 'ICE') || (data.trip.line.productName === 'IC')) {
            document.getElementById('comfortbutton').classList.remove('hidden');
        }

        document.getElementById('trainTitle').innerHTML = `(${data.trip.line.fahrtNr})`;

        var lineName = String(data.trip.line.name || data.trip.line.fahrtNr || '').split('(')[0].trim();
        document.getElementById('linebadge').innerHTML = `${lineName}`;

        document.getElementById('operatorName').innerHTML = `${(data.trip.line.operator && data.trip.line.operator.name) ? data.trip.line.operator.name : 'Deutsche Bahn'}`;

        document.getElementById('title').innerHTML = `${data.trip.line.productName} ${data.trip.line.fahrtNr} 🡺 ${data.trip.destination.name}`;

        const departureTime = new Date(data.trip.plannedDeparture);

        const tripDate = departureTime.toLocaleDateString('de-DE', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        document.getElementById('trip-date').innerHTML = tripDate;

        document.getElementById('lauf').innerHTML = data.trip.origin.name + ' → ' + data.trip.destination.name;

        function parseStopTime(value) {
            if (!value) {
                return null;
            }
            const parsed = new Date(value);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        }

        function getStopTimes(stop) {
            return {
                plannedArrival: parseStopTime(stop.plannedArrival),
                actualArrival: parseStopTime(stop.arrival),
                plannedDeparture: parseStopTime(stop.plannedDeparture),
                actualDeparture: parseStopTime(stop.departure)
            };
        }

        function getPreferredEventTime(stop) {
            const times = getStopTimes(stop);
            return times.actualDeparture || times.plannedDeparture || times.actualArrival || times.plannedArrival;
        }

        function getArrivalEventTime(stop) {
            const times = getStopTimes(stop);
            return times.actualArrival || times.plannedArrival || times.actualDeparture || times.plannedDeparture;
        }

        function getStopStatus(stop, currentTime) {
            const times = getStopTimes(stop);
            const hasDeparture = Boolean(times.actualDeparture || times.plannedDeparture);
            const hasArrival = Boolean(times.actualArrival || times.plannedArrival);

            if ((stop.cancelled) && (stop.arrival == null) && (stop.departure == null) && !hasDeparture && !hasArrival) {
                return 'cancelled';
            }

            if (hasDeparture) {
                const departureTime = times.actualDeparture || times.plannedDeparture;
                return departureTime < currentTime ? 'past' : 'future';
            }

            if (hasArrival) {
                const arrivalTime = times.actualArrival || times.plannedArrival;
                const isRealtimeArrival = Boolean(times.actualArrival);
                const toleranceMs = isRealtimeArrival ? 60 * 1000 : 5 * 60 * 1000;
                return arrivalTime.getTime() + toleranceMs < currentTime.getTime() ? 'past' : 'future';
            }

            return 'unknown';
        }

        const stopoversContainer = document.querySelector('.trip-stopovers');
        stopoversContainer.innerHTML = '';

        const currentTime = new Date();

        const stopStatuses = data.trip.stopovers.map((stop) => getStopStatus(stop, currentTime));
        const currentStopIndex = stopStatuses.findIndex((status) => status === 'future');

        data.trip.stopovers.forEach((stop, index) => {
            const stopElement = document.createElement('div');
            stopElement.classList.add('trip-stopover');

            let stopStatus = stopStatuses[index];
            if (index === currentStopIndex) {
                stopStatus = 'current';

                let progressPercentage = 0;

                if (index > 0) {
                    const previousStop = data.trip.stopovers[index - 1];
                    const previousEventTime = getPreferredEventTime(previousStop);
                    const currentArrivalTime = getArrivalEventTime(stop);

                    if (previousEventTime && currentArrivalTime && currentArrivalTime > previousEventTime) {
                        const totalTime = currentArrivalTime - previousEventTime;
                        const timePassed = currentTime - previousEventTime;
                        progressPercentage = (timePassed / totalTime) * 100;
                        progressPercentage = Math.min(Math.max(progressPercentage, 0), 100);
                    }
                }

                stopElement.style.setProperty('--progress-percentage', `${progressPercentage}%`);
                stopElement.style.setProperty('--progress-px', `${40 / 100 * (progressPercentage - 1) - 45}px`);
                stopElement.innerHTML = `
                <picture>
                    <source srcset="../assets/icons/train-top-dark.svg" media="(prefers-color-scheme: dark)">
                    <source srcset="../assets/icons/train-top.svg" media="(prefers-color-scheme: light)">
                    <img src="../assets/icons/train-top.svg" alt="Location" class="trainposition">
                </picture>
                `;
            }

            stopElement.classList.add(`stop-${stopStatus}`);

            if ((stop.cancelled) && (stop.arrival == null) && (stop.departure == null)) {
                stopElement.innerHTML += `
            <div class="trip-stop-time">
                <div class="trip-delay" style="font-size: 16px">Entfällt</div>
            </div>
            <div class="trip-stop-info">
                <span class="trip-stop-name">${stop.stop.name}</span>
            </div>
            <div class="connection-cell">
                &nbsp;
            </div>
        `;
            } else if (stopStatus === 'current') {
                const plannedArrivalTime = stop.plannedArrival ? new Date(stop.plannedArrival).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '';
                const actualArrivalTime = stop.arrival ? new Date(stop.arrival).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '';
                const plannedDepartureTime = stop.plannedDeparture ? new Date(stop.plannedDeparture).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '';
                const actualDepartureTime = stop.departure ? new Date(stop.departure).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '';

                const arrivalTimeDisplay = plannedArrivalTime === actualArrivalTime || !actualArrivalTime ? plannedArrivalTime : `<s class="disabled">${plannedArrivalTime}</s>&nbsp;<span>${actualArrivalTime}</span>`;
                const departureTimeDisplay = plannedDepartureTime === actualDepartureTime || !actualDepartureTime ? plannedDepartureTime : `<s class="disabled">${plannedDepartureTime}</s>&nbsp;<span>${actualDepartureTime}</span>`;

                let stopname = stop.stop.name;
                if (stationId === stop.stop.id) {
                    stopElement.classList.add('marked-stopover');
                }

                stopElement.innerHTML += `
            <div class="trip-stop-time">
                <div>${arrivalTimeDisplay}</div>
                <div>${departureTimeDisplay}</div>
            </div>
            <div class="trip-stop-info">
                <span class="trip-stop-name">${stopname}</span>
                <span class="trip-platform">${(stop.arrivalPlatform || stop.departurePlatform) ? `Gl&nbsp;${stop.arrivalPlatform || stop.departurePlatform}` : '-'}</span>
            </div>
            <div class="connection-cell">
                ${stop.arrival !== null ? `<a href="connections.html?stop=${stop.stop.location.id}&tripID=${encodeURIComponent(tripId)}">&nbsp;<img src="../assets/icons/connectingTrain.svg"></a>` : '&nbsp;<img src="../assets/icons/placeholder.svg">'}
            </div>
        `;
            } else {
                const plannedArrivalTime = stop.plannedArrival ? new Date(stop.plannedArrival).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '';
                const actualArrivalTime = stop.arrival ? new Date(stop.arrival).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '';
                const plannedDepartureTime = stop.plannedDeparture ? new Date(stop.plannedDeparture).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '';
                const actualDepartureTime = stop.departure ? new Date(stop.departure).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '';

                const arrivalTimeDisplay = plannedArrivalTime === actualArrivalTime || !actualArrivalTime ? plannedArrivalTime : `<s class="disabled">${plannedArrivalTime}</s>&nbsp;<span>${actualArrivalTime}</span>`;
                const departureTimeDisplay = plannedDepartureTime === actualDepartureTime || !actualDepartureTime ? plannedDepartureTime : `<s class="disabled">${plannedDepartureTime}</s>&nbsp;<span>${actualDepartureTime}</span>`;

                let stopname = stop.stop.name;
                if (stationId === stop.stop.id) {
                    stopElement.classList.add('marked-stopover');
                }

                stopElement.innerHTML += `
            <div class="trip-stop-time">
                <div>${arrivalTimeDisplay}</div>
                <div>${departureTimeDisplay}</div>
            </div>
            <div class="trip-stop-info">
                <span class="trip-stop-name">${stopname}</span>
                <span class="trip-platform">${(stop.arrivalPlatform || stop.departurePlatform) ? `Gl&nbsp;${stop.arrivalPlatform || stop.departurePlatform}` : '-'}</span>
            </div>
            <div class="connection-cell">
                ${stop.arrival !== null ? `<a href="connections.html?stop=${stop.stop.location.id}&tripID=${encodeURIComponent(tripId)}">&nbsp;<img src="../assets/icons/connectingTrain.svg"></a>` : '&nbsp;<img src="../assets/icons/placeholder.svg">'}
            </div>
        `;
            }

            stopoversContainer.appendChild(stopElement);
        });

        updateTrainStatus(data.trip);

        var wagonorderbutton = document.getElementById('wagonorderbutton');

        var test = '2';

        const tripdepartureTime = new Date(new URLSearchParams(window.location.search).get('departureTime')).toISOString();

        if ((stationId === null) || tripdepartureTime === null) {
            var choosenstation = data.trip.stopovers[0].stop.id;
            const tripdepartureTime = data.trip.stopovers[0].plannedDeparture;
        } else {
            var choosenstation = stationId;
            const tripdepartureTime = new URLSearchParams(window.location.search).get('departureTime');
        }

        if (wagonorderbutton) {
            wagonorderbutton.href = `wagonorder.html?trainnumber=${data.trip.line.fahrtNr}&station=${choosenstation}&producttype=${data.trip.line.productName}&departure=${tripdepartureTime}`;
        }

        document.getElementById('webfisbutton').href = `./webfis/screen.html?trip=${encodeURIComponent(tripId)}&station=${choosenstation}`;

        function sanitizeText(text) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = text;
            return tempDiv.textContent || tempDiv.innerText || '';
        }

        function sanitizeAndNormalizeText(text) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = text;
            let sanitizedText = tempDiv.textContent || tempDiv.innerText || '';
            sanitizedText = sanitizedText.toLowerCase().trim();
            sanitizedText = sanitizedText.replace(/\s+/g, ' ');
            sanitizedText = sanitizedText.replace(/\d+/g, '#');
            return sanitizedText;
        }

        const warningsList = document.getElementById('remarks');
        warningsList.innerHTML = '';

        const warningCounterElement = document.getElementById('trip-warning-counter-button');

        let stationRemarks = [];
        if (stationId) {
            const stationStopover = data.trip.stopovers.find(stopover => stopover.stop.id === stationId);
            if (stationStopover && stationStopover.remarks && stationStopover.remarks.length > 0) {
                stationRemarks = stationStopover.remarks;
            }
        }

        const tripRemarks = data.trip.remarks || [];

        const combinedRemarks = [...stationRemarks, ...tripRemarks];

        if (combinedRemarks.length > 0) {

            document.getElementById('trip-warning-counter-button').classList.remove('hidden');

            const uniqueMessages = new Set();
            const uniqueRemarks = [];

            combinedRemarks.forEach(remark => {
                const normalizedText = sanitizeAndNormalizeText(remark.text);
                let code = 'default';
                if (remark.code) {
                    code = sanitizeText(remark.code.replace(/\./g, ''));
                }
                if (!uniqueMessages.has(normalizedText)) {
                    uniqueMessages.add(normalizedText);
                    uniqueRemarks.push({ ...remark, code });
                }
            });

            const warningCount = uniqueRemarks.length;

            warningCounterElement.innerHTML = `${warningCount}`;

            const WarningHeaderItem = document.createElement('tr');
            document.getElementById('trainTab').innerHTML = `Zug <span class=\"pill\">&nbsp;${warningCount}&nbsp;</span>`;
            warningsList.appendChild(WarningHeaderItem);

            uniqueRemarks.forEach(remark => {
                const code = remark.code || 'default';
                remarks.innerHTML += (`
                <div class="listitem">
                    <div class="listimagecontainer"><img src="../assets/icons/remark${code}.svg"></div>
                    <div class="listitemtext">${sanitizeText(remark.text)}</div>
                </div>`);
            });
        } else {
            warningCounterElement.innerHTML = '&nbsp;Keine&nbsp;';
            document.getElementById('remarks').classList.add('hidden');
        }

        function normalizeBadgeToken(value) {
            if (value === undefined || value === null) {
                return '';
            }
            return String(value)
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/&/g, ' und ')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '');
        }

        function normalizeBadgeTokenVariants(value) {
            const raw = String(value || '').trim();
            if (!raw) {
                return [];
            }
            const variants = new Set([raw]);
            variants.add(raw.replace(/\(.*?\)/g, ' ').trim());
            variants.add(raw.replace(/,.*$/g, ' ').trim());
            variants.add(raw.split('/')[0].trim());
            return Array.from(variants)
                .map((item) => normalizeBadgeToken(item))
                .filter(Boolean);
        }

        function normalizeLineToken(value) {
            if (value === undefined || value === null) {
                return '';
            }
            return String(value)
                .toUpperCase()
                .replace(/\s+/g, '')
                .replace(/[^A-Z0-9]/g, '');
        }

        function getLinePrefixToken(value) {
            const raw = String(value || '').trim();
            if (!raw) {
                return '';
            }
            const firstPart = raw.split(/\s+/)[0] || '';
            return firstPart.toUpperCase().replace(/[^A-Z0-9]/g, '');
        }

        function getLineFamilyToken(value) {
            const compact = String(value || '').toUpperCase().replace(/\s+/g, '');
            const match = compact.match(/^[A-Z]+/);
            return match ? match[0] : '';
        }

        function mapProductToStyleToken(productValue) {
            const normalized = String(productValue || '').toLowerCase();
            const map = {
                nationalexpress: 'nationalExpress',
                national: 'national',
                ice: 'nationalExpress',
                ece: 'nationalExpress',
                ic: 'nationalExpress',
                ec: 'nationalExpress',
                regionalexpress: 'RE',
                regional: 'regional',
                suburban: 'S',
                bus: 'Bus',
                tram: 'tram',
                subway: 'U',
                ferry: 'ferry'
            };
            return map[normalized] || '';
        }

        const lineToken = normalizeLineToken(lineName);
        const operatorCandidates = [
            data.trip.line.operator && data.trip.line.operator.id ? data.trip.line.operator.id : '',
            data.trip.line.operator && data.trip.line.operator.name ? data.trip.line.operator.name : ''
        ];
        const operatorTokens = new Set();
        const legalForms = new Set(['ag', 'gmbh', 'mbh', 'kg', 'kgaa', 'se', 'ev', 'eg']);
        operatorCandidates.forEach((candidate) => {
            normalizeBadgeTokenVariants(candidate).forEach((token) => {
                operatorTokens.add(token);
                const parts = token.split('-').filter(Boolean);
                const withoutLegalForm = parts.filter((part) => !legalForms.has(part)).join('-');
                if (withoutLegalForm && withoutLegalForm !== token) {
                    operatorTokens.add(withoutLegalForm);
                }
                const strippedPrefixes = [
                    withoutLegalForm.replace(/^db-regio-ag-/, ''),
                    withoutLegalForm.replace(/^db-regio-/, ''),
                    withoutLegalForm.replace(/^db-/, '')
                ].filter(Boolean);
                strippedPrefixes.forEach((stripped) => {
                    if (stripped && stripped !== withoutLegalForm) {
                        operatorTokens.add(stripped);
                    }
                });
            });
        });

        const operatorIdToken = normalizeBadgeToken(data.trip.line.operator && data.trip.line.operator.id ? data.trip.line.operator.id : '');
        const productNameToken = normalizeLineToken(data.trip.line.productName || '');
        const productToken = normalizeBadgeToken(data.trip.line.product || '');
        const mappedProductToken = mapProductToStyleToken(data.trip.line.product || data.trip.line.productName || '');
        const linePrefixToken = getLinePrefixToken(lineName);
        const lineFamilyToken = getLineFamilyToken(lineName);
        const badgeClassLineOperator = lineToken && operatorIdToken ? `${lineToken}${operatorIdToken}` : '';
        const inferredExpress = new Set(['ICE', 'ECE', 'IC', 'EC', 'RJ', 'RJX', 'TGV', 'THA', 'FLX']).has(lineFamilyToken)
            ? 'nationalExpress'
            : '';

        const badgeClasses = [
            'linebadge',
            productNameToken,
            productToken,
            mappedProductToken,
            inferredExpress,
            linePrefixToken,
            lineFamilyToken,
            lineToken,
            badgeClassLineOperator
        ].filter(Boolean);
        operatorTokens.forEach((token) => {
            badgeClasses.push(token);
            if (lineToken) {
                badgeClasses.push(`${lineToken}${token}`);
            }
        });

        const headerBadgeElement = document.getElementById('bigheaderbox');
        const lineBadgeElement = document.getElementById('linebadge');
        headerBadgeElement.className = 'coloredSpace';
        lineBadgeElement.className = 'smallBadge';
        lineBadgeElement.classList.add('linebadge');
        const providerBadgeClass = (data.trip.line.operator && data.trip.line.operator.id)
            ? normalizeBadgeToken(data.trip.line.operator.id)
            : 'db';
        badgeClasses.push(providerBadgeClass);
        badgeClasses.push('db');
        Array.from(new Set(badgeClasses)).forEach((className) => {
            if (className) {
                headerBadgeElement.classList.add(className);
                lineBadgeElement.classList.add(className);
            }
        });

        let $number = encodeURIComponent(data.trip.id);

        document.getElementById('pinChip').addEventListener('click', function () {
            console.log('Angeheftet')
            document.getElementById('pinChip').classList.add('hidden')
            document.getElementById('unpinChip').classList.remove('hidden')
            localStorage.setItem("pinnedJourney", $number);
            localStorage.setItem("pinnedJourneyStation", stationId);
            console.log($number);
            console.log(stationId);

        });

        if ((localStorage.getItem("pinnedJourney")) === $number){
            console.log('Angeheftete Journey')
                document.getElementById('pinChip').classList.add('hidden')
                document.getElementById('unpinChip').classList.remove('hidden')
                localStorage.setItem("pinnedJourney", $number);
                localStorage.setItem("pinnedJourneyStation", stationId);
                console.log($number);
                console.log(stationId);
        }

        document.getElementById('unpinChip').addEventListener('click', function () {
            console.log('Abgeheftet')
            document.getElementById('pinChip').classList.remove('hidden')
            document.getElementById('unpinChip').classList.add('hidden')
            localStorage.removeItem("pinnedJourney");
            localStorage.removeItem("pinnedJourneyStation");

        });

        // WAGONORDER GRAPHIC             
        async function loadTrainData() {
        const url = `https://data.cuzimmartin.dev/wagenreihung?train_number=${data.trip.line.fahrtNr}&eva=${choosenstation}&train_type=${data.trip.line.productName}&departure_time=${tripdepartureTime}`;
        const response = await fetch(url);
        if (!response.ok || !hasJsonContentType(response)) {
            return;
        }
        const traindata = await response.json();

        const container = document.getElementById("trainslider");

        if (localStorage.getItem('materialtrains') === 'false') {
            container.classList.add('hidden')
        } 

        container.innerHTML = ""; 

        if (!traindata || !Array.isArray(traindata.groups) || traindata.groups.length === 0) {
            container.classList.add('hidden');
            return;
        }

        traindata.groups.forEach(group => {
            const transportCategory = group && group.transport ? group.transport.category : "";
            const vehicles = Array.isArray(group && group.vehicles) ? group.vehicles : [];
            if (vehicles.length === 0) {
                return;
            }

            vehicles.forEach((vehicle, index) => {
            const vehicleId = vehicle && vehicle.vehicleID ? vehicle.vehicleID : "";
            const category = vehicle && vehicle.type && vehicle.type.category ? vehicle.type.category : "blank";
            const constructionType = vehicle && vehicle.type ? (vehicle.type.constructionType || "") : "";
            const series = vehicle && vehicle.typeDetails ? (vehicle.typeDetails.series || "") : "";
            const typeDetailsCategory = vehicle && vehicle.typeDetails && vehicle.typeDetails.category ? vehicle.typeDetails.category : "vehicle";

            let suffix = "";
            if (index === 0) suffix = "-firstgroupvehicle";
            if (index === vehicles.length - 1) suffix = "-lastgroupvehicle";

            const sources = [
                `https://materialtrains.unibits.eu/vehicles/deutschebahn/${category}-${vehicleId}${suffix}.png`,
                `https://materialtrains.unibits.eu/vehicles/deutschebahn/${transportCategory}-${category}-${constructionType}-${series}${suffix}.png`,
                `https://materialtrains.unibits.eu/vehicles/deutschebahn/blank-${typeDetailsCategory}${suffix}.png`,
                `../assets/icons/blankvehicle.png`
            ];

            const img = document.createElement("img");
            img.alt = `${category} (${vehicleId})`;
            img.dataset.fallbacks = JSON.stringify(sources);
            img.dataset.index = 0;
            img.src = sources[0];
            img.classList.add('vehicle');

            // Fallback-Mechanismus
            img.onerror = function () {
                let index = parseInt(this.dataset.index, 10);
                let fallbacks = [];
                try {
                    fallbacks = JSON.parse(this.dataset.fallbacks || '[]');
                } catch {
                    fallbacks = ['../assets/icons/blankvehicle.png'];
                }

                if (index < fallbacks.length - 1) {
                index++;
                this.dataset.index = index;
                this.src = fallbacks[index]; // Nächstes Bild probieren
                } else {
                this.onerror = null; // Keine Endlosschleife
                }
            };

            container.appendChild(img);
            });
        });
        }
        loadTrainData();
        
        } catch (error) {
            console.error('Fehler beim Laden der Tripdaten:', error);
            const tripStatus = document.getElementById('tripStatus');
            if (tripStatus) {
                tripStatus.textContent = 'Tripdaten konnten nicht geladen werden.';
            }
            hideMapLoading();
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        fetchAndDisplayData();
        // Starte Intervall nur wenn Tab aktiv ist
        if (!document.hidden) {
            updateIntervalId = setInterval(fetchAndDisplayData, 30000);
        }
    });




