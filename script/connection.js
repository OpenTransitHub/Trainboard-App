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
            categories: ["nationalexpress", "national", "longdistance","mberlinerverkehrsbetriebe", "strassenbahn", "dvbstraenbahn", "t", "ic", "ice", "rj", "rjx", "fr", "tgv", "eur", "mv", "ec", "ics"],
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


    const incomingLineElement = document.getElementById("incoming-line");
    const connectionsContainer = document.getElementById("connections-container");

    const selectedApiCode = localStorage.getItem("selectedApiCode") || "DE";
    const urlParams = new URLSearchParams(window.location.search);

    const stationId = urlParams.get("stationId");
    const tripId = urlParams.get("tripId");
    
    const paramArrIso = urlParams.get("arr");          // Planmäßige Ankunft
    const paramEstArrIso = urlParams.get("estArr");    // Geschätzte Ankunft

    console.log("URL Parameters:", { stationId, tripId, paramArrIso, paramEstArrIso, selectedApiCode });

    if (!stationId) {
        if (incomingLineElement) incomingLineElement.textContent = "Fehler: Keine Haltestelle angegeben.";
        return;
    }

    let arrivalMs = paramArrIso ? new Date(paramArrIso).getTime() : null;
    let estimatedArrivalMs = paramEstArrIso ? new Date(paramEstArrIso).getTime() : arrivalMs;

    Promise.all([
        fetchBoardData(stationId),
        tripId ? fetchTripData(tripId) : Promise.resolve(null)
    ])
        .then(([boardData, tripData]) => {
            console.log("Empfangene Board-Daten:", boardData);
            console.log("Empfangene Trip-Daten:", tripData);

            let incomingLineName = "Zug";
			const params = new URLSearchParams(window.location.search);
			const stationName = params.get('stationName');
			const lineColor = params.get('linecolor');

            if (tripData) {
                incomingLineName = tripData.line || tripData.tripNumber || "Zug";
                if (Array.isArray(tripData.stops)) {
                    const matchingStop = tripData.stops.find(s => (s.stationId || s.id || s.evaNumber) == stationId);
                    if (matchingStop) {
                        const schedStr = matchingStop.scheduledArrival || matchingStop.scheduledDeparture;
                        if (schedStr) arrivalMs = new Date(schedStr).getTime();

                        const estStr = matchingStop.estimatedArrival || matchingStop.estimatedDeparture || schedStr;
                        if (estStr) estimatedArrivalMs = new Date(estStr).getTime();
                    }
                }
            }

            if (incomingLineElement) incomingLineElement.innerHTML = `<br><span class="bigtext">Ankunft von<br><span class="linespan" style="color: #${lineColor}">${incomingLineName.replace(/\s*\(.*/, "").replace(/DB S/g, "S").replace(/S S/g, "S")}</span><br>heute um vsl.<br>${formatTimeFromMs(estimatedArrivalMs || arrivalMs)} Uhr</span><br><br><br>`;
			document.getElementById('sitetitle').textContent = stationName;
			document.getElementById('smalltitle').textContent = "Nächste Anschlüsse";

            let departuresList = [];
            if (Array.isArray(boardData)) {
                departuresList = boardData;
            } else if (boardData && Array.isArray(boardData.departures)) {
                departuresList = boardData.departures;
            } else if (boardData && Array.isArray(boardData.entries)) {
                departuresList = boardData.entries;
            }

            renderConnections(departuresList, arrivalMs, estimatedArrivalMs, tripId);
        })
        .catch(error => {
            console.error("Fehler beim Laden der Anschlussdaten:", error);
            if (incomingLineElement) incomingLineElement.textContent = "Fehler beim Laden der Anschlussdaten.";
        });

    function fetchBoardData(sId) {
        const url = `https://prod.cuzimmartin.dev/api/${selectedApiCode}/departures?stationId=${encodeURIComponent(sId)}&limit=3000`;
        console.log("Starte Board API-Call:", url);

        return fetch(url)
            .then(res => res.json())
            .then(result => {
                console.log("Board API-Response JSON:", result);
                if (result.success && result.data) {
                    return result.data;
                }
                return result;
            });
    }

    function fetchTripData(tId) {
        const url = `https://prod.cuzimmartin.dev/api/${selectedApiCode}/trip?tripId=${encodeURIComponent(tId)}`;
        console.log("Starte Trip API-Call:", url);

        return fetch(url)
            .then(res => res.json())
            .then(result => {
                console.log("Trip API-Response JSON:", result);
                if (result.success && result.data) {
                    return result.data;
                }
                return result;
            });
    }

    function renderConnections(departures, arrMs, estArrMs, currentTripId) {
        if (!connectionsContainer) return;
        connectionsContainer.innerHTML = "";

        if (!departures || !Array.isArray(departures) || departures.length === 0) {
            console.warn("Keine Abfahrten vorhanden:", departures);
            connectionsContainer.textContent = "Keine weiteren Abfahrten an dieser Haltestelle gefunden.";
            return;
        }

        const refArrivalMs = arrMs || Date.now();
        const maxArrivalMs = refArrivalMs + (90 * 60 * 1000);

        const filteredDepartures = departures.filter(dep => {
            if (dep.tripId === currentTripId) return false;

            const depIso = dep.estimatedTime || dep.scheduledTime || dep.time || dep.estimatedDeparture || dep.scheduledDeparture;
            if (!depIso) return false;

            const depMs = new Date(depIso).getTime();
            return depMs >= refArrivalMs && depMs <= maxArrivalMs;
        });

        if (filteredDepartures.length === 0) {
            connectionsContainer.textContent = "Keine passenden Anschlusszüge innerhalb von 90 Minuten nach Ankunft vorhanden.";
            return;
        }

        let renderedCount = 0;

        filteredDepartures.forEach(dep => {
            const schedIso = dep.scheduledDeparture || dep.scheduledTime || dep.time;
            const estIso = dep.estimatedDeparture || dep.estimatedTime;

            const depIso = estIso || schedIso;
            const depMs = new Date(depIso).getTime();

            const diffMs = depMs - (estArrMs || refArrivalMs);
            const diffMinutes = Math.round(diffMs / (1000 * 60));

            const itemDiv = document.createElement("div");
            itemDiv.className = "departure-item";

            // Ganzes Item anklickbar machen, falls tripId existiert
            if (dep.tripId) {
                itemDiv.style.cursor = "pointer";
                const colorObj = getColorObject(dep.operator, dep.line || dep.category);
                const rawHexColorParam = colorObj.color ? colorObj.color.replace("#", "") : "";

                itemDiv.addEventListener("click", () => {
                    const colorParam = rawHexColorParam ? `&linecolor=${encodeURIComponent(rawHexColorParam)}` : "";
                    window.location.href = `trip.html?tripId=${encodeURIComponent(dep.tripId)}${colorParam}`;
                });
            }

            const rawLineName = dep.line || dep.number || dep.tripNumber || dep.category || "Fahrt";
            
            const formattedLineName = rawLineName
                .replace(/\s*\(.*/, "")
                .replace(/DB S/g, "S")
                .replace(/S S/g, "S");

            const colorObj = getColorObject(dep.operator, rawLineName);
            const lineColorHex = colorObj.color || "#2097f4";

            const destination = dep.direction || dep.destination || "Unbekannt";
            const platform = dep.platform ? `${dep.platform}` : "";

            const statusInfo = getTransferStatus(diffMinutes);

            let depTimeHtml = "";
            if (schedIso) {
                const schedStr = formatTimeFromMs(new Date(schedIso).getTime());
                if (estIso) {
                    const estStr = formatTimeFromMs(new Date(estIso).getTime());
                    const delay = calculateDelay(schedIso, estIso, dep.departureDelay || dep.delay);
                    const delayColor = getDelayColor(delay);

                    depTimeHtml = `${schedStr}<br><span style="color: ${delayColor}; font-weight: bold;">${estStr}</span>`;
                } else {
                    depTimeHtml = schedStr;
                }
            } else {
                depTimeHtml = formatTimeFromMs(depMs);
            }

            itemDiv.innerHTML = `

			<table><tr class="wide">
				<td>${depTimeHtml}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</td>
				<td class="wide"><span class="linelabel" style="background-color: ${lineColorHex} !important; color: #ffffff !important;">&nbsp;&nbsp;&nbsp;<strong>${formattedLineName}</strong>&nbsp;&nbsp;&nbsp;</span><br>${destination}</td>
				<td>${platform}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</td>
				<td style="color: ${statusInfo.color}; text-align: right;"><b>${diffMinutes}</b><br>&nbsp;min</td>
				<td><img src="./icons/${statusInfo.label}.svg"></td>
			</tr></table>
            `;

            connectionsContainer.appendChild(itemDiv);
            renderedCount++;
        });

        if (renderedCount === 0) {
            connectionsContainer.textContent = "Keine passenden Anschlusszüge vorhanden.";
        }
    }

    function getTransferStatus(minutes) {
        if (minutes < 2) {
            return { label: "impossible", color: "red" };
        } else if (minutes >= 2 && minutes <= 5) {
            return { label: "knapp", color: "orange" };
        } else {
            return { label: "easy", color: "green" };
        }
    }

    function calculateDelay(scheduledIso, estimatedIso, explicitDelay) {
        if (typeof explicitDelay === "number") {
            return explicitDelay;
        }
        if (scheduledIso && estimatedIso) {
            const sched = new Date(scheduledIso).getTime();
            const est = new Date(estimatedIso).getTime();
            return Math.round((est - sched) / (1000 * 60));
        }
        return 0;
    }

    function getDelayColor(delayMinutes) {
        if (delayMinutes === 0) return "green";
        if (delayMinutes > 0 && delayMinutes <= 5) return "orange";
        if (delayMinutes > 5) return "red";
        return "inherit";
    }

    function formatTimeFromMs(ms) {
        if (!ms || isNaN(ms)) return "--:--";
        const date = new Date(ms);
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
});