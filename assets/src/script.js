// Save Site Type
const siteType = getSiteTypeFromURL();

// Save URL detail
const urlParams = new URLSearchParams(window.location.search);

// EXPERT MODE
// Hide Navbar
const hiddennavbar = urlParams.get('navbar');
if (hiddennavbar === "hide") {
	document.getElementById('navbar').classList.add('hidden');
}

// Hide Clock
const hiddenclock = urlParams.get('clock');
if (hiddenclock === "hide") {
	document.getElementById('clock').classList.add('hidden');
}

// Show Trainnumber
const hiddentrainnumbers = urlParams.get('trainnumbers');

// Prevent Touch
const notouch = urlParams.get('touch');
if (notouch === "no") {
	document.getElementById('notouch').classList.remove('hidden');
}

const showsuburban = urlParams.get('suburban');
// END EXPERTMODE

const stationID = urlParams.get('station');
let hasSuburban;

// Check if station ID exists
if (!stationID) {
	console.error('Keine Station ID in der URL gefunden');
	document.getElementById('tableBody').innerHTML = '<tr><td colspan="5">Fehler: Keine Station ausgewählt</td></tr>';
} else {
	// Load station Data
	fetchStationData(stationID);

	// Start loading data
	loadData();
	// reload the function every 5 secs, so displayed data will always been up to date
	setInterval(loadData, 5000);
}

// Start Clock
updateClock();
setInterval(updateClock, 1000);

// Check site type
function getSiteTypeFromURL() {
	const url = window.location.href;
	const types = {
		"departure.html": "D",
		"arrival.html": "A",
		"suburban.html": "S",
		"local.html": "L"
	};

	for (const [page, type] of Object.entries(types)) {
		if (url.includes(page)) return type;
	}

	// Default site type
	return "D";
}

// Fetch API Source to get station details
async function fetchStationData(stationID) {
	try {
		const response = await fetch(`https://data.cuzimmartin.dev/station?stationID=${stationID}`, {
			method: "GET",
			mode: "cors"
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const data = await response.json();
		processStationInfo(data, stationID);
	} catch (error) {
		console.error('Fehler beim Abrufen der Stationsdaten:', error);
		document.getElementById('stationname').textContent = 'Fehler beim Laden';
	}
}

// Rendering station details for navbar & header
function processStationInfo(data, station) {
	const navbarDiv = document.getElementById('navbar');
	let navbarContent = '';

	// Local Services
	if (siteType === 'L') {
		navbarContent += `
			<div class="tabs">
				<a href="#" class="active">&nbsp;Nahverkehr&nbsp;</a>
			</div>`;
	} else if ((data.products.nationalExpress || data.products.national || data.products.regionalExpress || data.products.regional) && data.products.suburban === true) {
		// Normal station
		navbarContent += `
			<div class="tabs">
				<a href="departure.html?station=${station}" class="${siteType === 'D' ? 'active' : ''}">&nbsp;Abfahrt&nbsp;</a>
				<a href="arrival.html?station=${station}" class="${siteType === 'A' ? 'active' : ''}">&nbsp;Ankunft&nbsp;</a>
				<a href="suburban.html?station=${station}" class="${siteType === 'S' ? 'active' : ''}">&nbsp;S-Bahn&nbsp;</a>
			</div>`;
		hasSuburban = true;
	} else if (data.products.suburban === true && data.products.regional === false) {
		// S-Bahn only station
		if (siteType !== 'S') {
			window.location.href = `suburban.html?station=${station}`;
		}
		navbarContent += `
			<div class="tabs">
				<a href="#" class="disabled">&nbsp;Abfahrt&nbsp;</a>
				<a href="#" class="disabled">&nbsp;Ankunft&nbsp;</a>
				<a href="suburban.html?station=${station}" class="active">&nbsp;S-Bahn&nbsp;</a>
			</div>`;
	} else if ((data.products.nationalExpress || data.products.national || data.products.regionalExpress || data.products.regional) && data.products.suburban === false) {
		// Station without S-Bahn
		if (siteType === 'S') {
			window.location.href = `departure.html?station=${station}`;
		}
		navbarContent += `
			<div class="tabs">
				<a href="departure.html?station=${station}" class="${siteType === 'D' ? 'active' : ''}">&nbsp;Abfahrt&nbsp;</a>
				<a href="arrival.html?station=${station}" class="${siteType === 'A' ? 'active' : ''}">&nbsp;Ankunft&nbsp;</a>
				<a href="#" class="disabled">&nbsp;S-Bahn&nbsp;</a>
			</div>`;
	}

	navbarContent += `
		<div class="iconbar">
			<a class="navsearch" href="${siteType === 'L' ? 'localsearch' : 'index'}.html">
				${siteType === 'L' ? 'Haltestellen' : 'Stations'}suche
			</a>
		</div>`;

	navbarDiv.innerHTML = navbarContent;

	// Add station name to div
	document.getElementById('stationname').textContent = data.name;
	document.getElementById('title').textContent = data.name;
}

// Clock
function updateClock() {
	const now = new Date();
	const hours = now.getHours().toString().padStart(2, '0');
	const minutes = now.getMinutes().toString().padStart(2, '0');
	document.getElementById('clock').innerHTML = `${hours}<span class="blink">:</span>${minutes}`;
}

// Fetch departures or arrivals
async function loadData() {
	const apiUrl = `https://data.cuzimmartin.dev/dynamic-${siteType === 'A' ? 'arrivals' : 'departures'}?stationID=${stationID}`;

	try {
		const response = await fetch(apiUrl, {
			method: "GET",
			mode: "cors"
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const jsonData = await response.json();
		const data = siteType === 'A' ? jsonData.arrivals : jsonData.departures;

		if (data && Array.isArray(data)) {
			updateTable(data);
		} else {
			console.error('Keine gültigen Daten erhalten');
			document.getElementById('tableBody').innerHTML = '<tr><td colspan="5">Keine Daten verfügbar</td></tr>';
		}
	} catch (error) {
		console.error('Fehler beim Abrufen der Daten:', error);
		// Zeige Fehlermeldung nur beim ersten Mal
		if (document.getElementById('tableBody').children.length === 0) {
			document.getElementById('tableBody').innerHTML = '<tr><td colspan="5">Fehler beim Laden der Daten</td></tr>';
		}
	}
}

function updateTable(data) {
	// Handle null response
	if (!data || !Array.isArray(data)) {
		console.log('Data Error:', data);
		return;
	}

	// Sort the entries by plannedWhen
	data.sort((a, b) => {
		const timeA = a.plannedWhen ? new Date(a.plannedWhen) : new Date(a.when);
		const timeB = b.plannedWhen ? new Date(b.plannedWhen) : new Date(b.when);
		return timeA - timeB;
	});

	const tableBody = document.getElementById('tableBody');
	tableBody.innerHTML = ''; // Delete everything before rewriting table content

	let findtrain = 0;
	const now = new Date();

	data.forEach(entry => {
		// Skip if no line information
		if (!entry.line) return;

		// Filter by product type based on site type
		if (siteType !== 'L') {
			const skipProducts = ["bus", "ferry", "subway", "tram", "taxi"];
			if (skipProducts.includes(entry.line.product)) return;
		}

		if (siteType === 'L') {
			const skipProducts = ["national", "nationalExpress"];
			if (skipProducts.includes(entry.line.product)) return;
		}

		// Filter S-Bahn
		if (siteType === 'S' && entry.line.product !== "suburban") return;
		if (siteType !== 'S' && siteType !== 'L' && entry.line.product === "suburban" && showsuburban !== 'show') return;

		// Check if cancelled
		const isCancelled = entry.remarks?.some(remark =>
			remark.type === "status" && remark.code === "cancelled"
		) || false;

		// Check if departure is more than 10 mins ago
		const plannedDepartureTime = new Date(entry.plannedWhen);
		const diffPlannedMinutes = Math.round((now - plannedDepartureTime) / (1000 * 60));

		// Skip cancelled trips that should have departed
		if (isCancelled && diffPlannedMinutes > 0) return;

		findtrain++;
		const row = tableBody.insertRow();

		// Set style to line-through if cancelled
		if (isCancelled) {
			row.classList.add('cancelled');
		}

		const abMessage = (isCancelled) ? "" : getAbMessage(entry.when);

		// Extract the line name without the train number
		const lineParts = entry.line.name.split(" ");
		const lineName = lineParts[0] + (lineParts[1] ? " " + lineParts[1] : "");

		const trainnumber = hiddentrainnumbers === "show" ? `<br>(${entry.line.fahrtNr})` : '';

		// Build operator ID safely
		const operatorId = entry.line.operator?.id || '';
		const operatorName = entry.line.operator?.name || '';

		// Build line badge with safe operator handling
		let linebadge = `<a href="trip.html?tripId=${encodeURIComponent(entry.tripId)}&departureTime=${encodeURIComponent(entry.plannedWhen)}&stationID=${encodeURIComponent(stationID)}">`;
		linebadge += `<div class="linebadge ${entry.line.product} ${lineName.replace(/\s/g, '')}${operatorId} ${operatorId} ${entry.line.productName}">`;

		if (operatorId === 'freiberger-eisenbahngesellschaft') {
			linebadge += "FEG";
		} else if (entry.line.productName === "FEX") {
			linebadge += "FEX";
		} else {
			linebadge += lineName;
		}
		linebadge += `${trainnumber}</div></a>`;

		row.insertCell(0).innerHTML = linebadge;

		// Calculate countdown
		const departureTime = new Date(entry.when || entry.plannedWhen);
		const timediff = Math.round((departureTime - now) / (1000 * 60));

		const countdownCell = row.insertCell(1);

		// Calculate delay in minutes
		const delayDifference = Math.abs(departureTime - plannedDepartureTime) / (1000 * 60);

		// Build trip URL
		const tripUrl = `trip.html?stationID=${encodeURIComponent(stationID)}&departureTime=${encodeURIComponent(entry.plannedWhen)}&tripId=${encodeURIComponent(entry.tripId)}`;

		if ((siteType === 'S' || siteType === 'L') && timediff <= 60 && entry.when !== null) {
			if (timediff <= 0) {
				countdownCell.innerHTML = `<a href="${tripUrl}">jetzt</a>`;
			} else {
				const delayClass = delayDifference > 5 ? 'style="color: #ec0016;"' : '';
				countdownCell.innerHTML = `<a href="${tripUrl}"><span ${delayClass}>${timediff}<span class="additional">&nbsp;min.</span></span></a>`;
			}

			// Update countdown every minute
			const intervalId = setInterval(() => {
				const newTimediff = Math.round((departureTime - new Date()) / (1000 * 60));
				if (newTimediff > 60) {
					clearInterval(intervalId);
					countdownCell.innerHTML = `<a href="${tripUrl}">${formatTime(entry.when)}</a>`;
				} else if (newTimediff <= 0) {
					countdownCell.innerHTML = `<a href="${tripUrl}">jetzt</a>`;
				} else {
					const delayClass = delayDifference > 5 ? 'style="color: #ec0016;"' : '';
					countdownCell.innerHTML = `<a href="${tripUrl}"><span ${delayClass}>${newTimediff}<span class="additional">&nbsp;min.</span></span></a>`;
				}
			}, 60000);
		} else {
			if (entry.when !== null) {
				if (delayDifference > 0) {
					countdownCell.innerHTML = `<a href="${tripUrl}"><nobr class='mobilebreak'><s class='disabled'>${formatTime(entry.plannedWhen)}</s> ${formatTime(entry.when)}</nobr></a>`;
				} else {
					countdownCell.innerHTML = `<a href="${tripUrl}"><span class="timetable">${formatTime(entry.when)}</span></a>`;
				}
			} else {
				countdownCell.innerHTML = `<a href="${tripUrl}"><span class="timetable">${formatTime(entry.plannedWhen)}</span></a>`;
			}
		}

		// Destination/Provenance cell
		const wideCell2 = row.insertCell(2);
		const destination = siteType !== 'A' ? entry.destination?.name || 'Unbekannt' : entry.provenance || 'Unbekannt';
		const prefix = siteType === 'A' ? '<span class="prefix">Von&nbsp;</span>' : '';

		wideCell2.innerHTML = `${prefix}<a href="${tripUrl}"><span class="scrolling-wrapper"><span class="scrolling-text station-name">${destination}</span></span></a>`;

		// Add remarks if available
		if (entry.remarks && entry.remarks.length > 0) {
			const infoMessages = entry.remarks.map(r => r.text).join(' +++ ');
			wideCell2.innerHTML += `<div class="remark bigonly">${infoMessages}</div>`;
		}

		// Platform cell
		const platformCell = row.insertCell(3);
		if (isCancelled) {
			if (entry.plannedPlatform === null) {
				platformCell.innerHTML = entry.platform ? `<a href="${tripUrl}"><s>${entry.platform}</s></a>` : `<a href="${tripUrl}"></a>`;
			} else {
				platformCell.innerHTML = `<a href="${tripUrl}"><nobr class='mobilebreak'><s class='disabled'>${entry.plannedPlatform}</s></nobr></a>`;
			}
		} else {
			if (entry.platform == null) {
				platformCell.innerHTML = `<a href="${tripUrl}">-</a>`;
			} else if (entry.platform == entry.plannedPlatform) {
				platformCell.innerHTML = `<a href="${tripUrl}">${entry.plannedPlatform}</a>`;
			} else if (entry.plannedPlatform === null) {
				platformCell.innerHTML = `<a class="red" href="${tripUrl}">${entry.platform}</a>`;
			} else {
				platformCell.innerHTML = `<a href="${tripUrl}"><nobr class='mobilebreak'><s class='disabled'>${entry.plannedPlatform}</s><span class="red"> ${entry.platform}</span></nobr></a>`;
			}
		}

		// Status cell
		const statusCell = row.insertCell(4);
		statusCell.classList.add("zerotable");
		statusCell.innerHTML = isCancelled ? `<img src="./assets/cancelled.webp" class="mini">` : abMessage;
	});

	// Switch to S-Bahn or departure if there are no trains in the list
	if (findtrain === 0 && hasSuburban === true) {
		window.location.href = `${siteType === 'S' ? 'departure' : 'suburban'}.html?station=${stationID}`;
	}
}

// Format time
function formatTime(dateTimeString) {
	if (!dateTimeString) return '--:--';

	const dateTime = new Date(dateTimeString);
	if (isNaN(dateTime.getTime())) return '--:--';

	const hours = dateTime.getHours().toString().padStart(2, '0');
	const minutes = dateTime.getMinutes().toString().padStart(2, '0');

	return `${hours}:${minutes}`;
}

// Create closing doors icon when needed
function getAbMessage(dateTimeString) {
	if (!dateTimeString || siteType === 'A') return '';

	const dateTime = new Date(dateTimeString);
	const now = new Date();
	const timediff = Math.round((dateTime - now) / (1000 * 60));

	return timediff <= 0 ? '<img src="./assets/depart.gif" class="mini">' : '';
}