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

if (localStorage.getItem('shownavbar') === 'false') {
    document.getElementById('navbar').classList.add('hidden');
} 


// Hide Clock
const hiddenclock = urlParams.get('clock');
if (hiddenclock === "hide") {
	document.getElementById('clock').classList.add('hidden');
}

if (localStorage.getItem('showclock') === 'false') {
    document.getElementById('clock').classList.add('hidden');
} 

// Show Trainnumber
let hiddentrainnumbers = urlParams.get('trainnumbers');

if (localStorage.getItem('showtrainnumbers') === 'true') {
    hiddentrainnumbers = "show";
} 

// Prevent Touch
const notouch = urlParams.get('touch');
if (notouch === "no") {
	document.getElementById('notouch').classList.remove('hidden');
}

if (localStorage.getItem('disabletouch') === 'true') {
    document.getElementById('notouch').classList.remove('hidden');
} 

let showsuburban = urlParams.get('suburban');

if (localStorage.getItem('showsuburbans') === 'true') {
    showsuburban = "show";
} 
// END EXPERTMODE

const stationID = urlParams.get('station');
let hasSuburban;

// Check if station ID exists
if (!stationID) {
	console.error('Keine Station ID in der URL gefunden');
	document.getElementById('tableBody').innerHTML = '<tr><td colspan="4">Fehler: Keine Station ausgewählt</td></tr>';
} else {
	// Load station Data
	fetchStationData(stationID);

	// Start loading data
	loadData();
	// reload every 5 seconds
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
		"local.html": "L",
		"combo.html": "C"
	};

	for (const [page, type] of Object.entries(types)) {
		if (url.includes(page)) return type;
	}
	return "D";
}

// Fetch API Source to get station details
async function fetchStationData(stationID) {
	try {
		const response = await fetch(`https://data.cuzimmartin.dev/station?stationID=${stationID}`, {
			method: "GET",
			mode: "cors"
		});
		if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
		const data = await response.json();
		processStationInfo(data, stationID);
	} catch (error) {
		console.error('Fehler beim Abrufen der Stationsdaten:', error);
		document.getElementById('stationname').textContent = 'Fehler beim Laden';
	}
}

// Navbar + Titel
function processStationInfo(data, station) {
	const navbarDiv = document.getElementById('navbar');
	let navbarContent = '';

	if (siteType === 'L') {
		navbarContent += `
			<div class="tabs">
				<a href="#" class="active">&nbsp;Nahverkehr&nbsp;</a>
			</div>`;
	} else if ((data.products.nationalExpress || data.products.national || data.products.regionalExpress || data.products.regional) && data.products.suburban === true) {
		navbarContent += `
			<div class="tabs">
				<a href="departure.html?station=${station}" class="${siteType === 'D' ? 'active' : ''}">&nbsp;Abfahrt&nbsp;</a>
				<a href="arrival.html?station=${station}" class="${siteType === 'A' ? 'active' : ''}">&nbsp;Ankunft&nbsp;</a>
				<a href="suburban.html?station=${station}" class="${siteType === 'S' ? 'active' : ''}">&nbsp;S-Bahn&nbsp;</a>
				<a href="combo.html?station=${station}" class="${siteType === 'C' ? 'active' : ''}">&nbsp;Combo&nbsp;</a>
			</div>`;
		hasSuburban = true;
	} else if (data.products.suburban === true && data.products.regional === false) {
		if (siteType !== 'S') {
			window.location.href = `suburban.html?station=${station}`;
		}
		navbarContent += `
			<div class="tabs">
				<a href="#" class="disabled">&nbsp;Abfahrt&nbsp;</a>
				<a href="#" class="disabled">&nbsp;Ankunft&nbsp;</a>
				<a href="suburban.html?station=${station}" class="active">&nbsp;S-Bahn&nbsp;</a>
				<a href="combo.html?station=${station}" class="${siteType === 'C' ? 'active' : ''}">&nbsp;Combo&nbsp;</a>
			</div>`;
	} else {
		if (siteType === 'S') {
			window.location.href = `departure.html?station=${station}`;
		}
		navbarContent += `
			<div class="tabs">
				<a href="departure.html?station=${station}" class="${siteType === 'D' ? 'active' : ''}">&nbsp;Abfahrt&nbsp;</a>
				<a href="arrival.html?station=${station}" class="${siteType === 'A' ? 'active' : ''}">&nbsp;Ankunft&nbsp;</a>
				<a href="#" class="disabled">&nbsp;S-Bahn&nbsp;</a>
				<a href="combo.html?station=${station}" class="${siteType === 'C' ? 'active' : ''}">&nbsp;Combo&nbsp;</a>
			</div>`;
	}

	navbarContent += `
		<div class="iconbar">
			<a class="navsearch" href="${siteType === 'L' ? 'localsearch' : 'index'}.html">
				${siteType === 'L' ? 'Haltestellen' : 'Stations'}suche
			</a>
		</div>`;

	navbarDiv.innerHTML = navbarContent;

	document.getElementById('stationname').textContent = data.name;
	if (document.getElementById('stationname2')) {document.getElementById('stationname2').textContent = data.name;}
	document.getElementById('title').textContent = data.name;
}

// Clock
function updateClock() {
	const now = new Date();
	const hours = now.getHours().toString().padStart(2, '0');
	const minutes = now.getMinutes().toString().padStart(2, '0');
	document.getElementById('clock').innerHTML = `${hours}<span class="blink">:</span>${minutes}`;
}

// Load Data
async function loadData() {
	if (siteType === 'C') {
		await loadDepartures();
		await loadArrivals();
	} else {
		const apiUrl = `https://data.cuzimmartin.dev/dynamic-${siteType === 'A' ? 'arrivals' : 'departures'}?stationID=${stationID}`;
		try {
			const response = await fetch(apiUrl, { method: "GET", mode: "cors" });
			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
			const jsonData = await response.json();
			const data = siteType === 'A' ? jsonData.arrivals : jsonData.departures;
			if (Array.isArray(data)) {
				updateTable(data, "tableBody", siteType === 'A');
			} else {
				document.getElementById('tableBody').innerHTML = '<tr><td colspan="4">Keine Daten verfügbar</td></tr>';
			}
		} catch (error) {
			console.error('Fehler beim Abrufen:', error);
			if (document.getElementById('tableBody').children.length === 0) {
				document.getElementById('tableBody').innerHTML = '<tr><td colspan="4">Fehler beim Laden der Daten</td></tr>';
			}
		}
	}
}

async function loadDepartures() {
	const apiUrl = `https://data.cuzimmartin.dev/dynamic-departures?stationID=${stationID}`;
	try {
		const response = await fetch(apiUrl, { method: "GET", mode: "cors" });
		if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
		const jsonData = await response.json();
		if (Array.isArray(jsonData.departures)) {
			updateTable(jsonData.departures, "tableBody", false);
		}
	} catch {
		if (document.getElementById('tableBody').children.length === 0) {
			document.getElementById('tableBody').innerHTML = '<tr><td colspan="4">Fehler beim Laden der Abfahrten</td></tr>';
		}
	}
}

async function loadArrivals() {
	const apiUrl = `https://data.cuzimmartin.dev/dynamic-arrivals?stationID=${stationID}`;
	try {
		const response = await fetch(apiUrl, { method: "GET", mode: "cors" });
		if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
		const jsonData = await response.json();
		if (Array.isArray(jsonData.arrivals)) {
			updateTable(jsonData.arrivals, "tableBodyarrival", true);
		}
	} catch {
		if (document.getElementById('tableBodyarrival').children.length === 0) {
			document.getElementById('tableBodyarrival').innerHTML = '<tr><td colspan="4">Fehler beim Laden der Ankünfte</td></tr>';
		}
	}
}

function updateTable(data, tbodyId = "tableBody", isArrival = false) {
	if (!data || !Array.isArray(data)) return;

	data.sort((a, b) => {
		const timeA = a.plannedWhen ? new Date(a.plannedWhen) : new Date(a.when);
		const timeB = b.plannedWhen ? new Date(b.plannedWhen) : new Date(b.when);
		return timeA - timeB;
	});

	const tableBody = document.getElementById(tbodyId);
	tableBody.innerHTML = '';

	let findtrain = 0;
	const now = new Date();

	data.forEach(entry => {
		if (!entry.line) return;

		// Filter products
		if (siteType !== 'L') {
			const skipProducts = ["bus", "ferry", "subway", "tram", "taxi"];
			if (skipProducts.includes(entry.line.product)) return;
		}
		if (siteType === 'L') {
			const skipProducts = ["national", "nationalExpress"];
			if (skipProducts.includes(entry.line.product)) return;
		}
		if ((siteType === 'C' || siteType === 'D' || siteType === 'A') && (entry.line.product === "suburban" &&  showsuburban !== 'show')) return;
		if (siteType === 'S' && entry.line.product !== "suburban") return;

		// Cancelled
		const isCancelled = entry.remarks?.some(r => r.type === "status" && r.code === "cancelled") || false;
		const plannedDepartureTime = new Date(entry.plannedWhen);
		const diffPlannedMinutes = Math.round((now - plannedDepartureTime) / (1000 * 60));
		if (isCancelled && diffPlannedMinutes > 0) return;

		findtrain++;
		const row = tableBody.insertRow();
		if (isCancelled) row.classList.add('cancelled');

		const abMessage = (isCancelled) ? "" : getAbMessage(entry.when);

		// Line badge
		const lineParts = entry.line.name.split(" ");
		const lineName = lineParts[0] + (lineParts[1] ? " " + lineParts[1] : "");
		const trainnumber = hiddentrainnumbers === "show" ? `<br><small>${entry.line.fahrtNr}</small>` : '';
		const operatorId = entry.line.operator?.id || '';
		let linebadge = `<a href="trip.html?tripId=${encodeURIComponent(entry.tripId)}&departureTime=${encodeURIComponent(entry.plannedWhen)}&stationID=${encodeURIComponent(stationID)}">`;
		linebadge += `<div class="linebadge ${entry.line.product} ${lineName.replace(/\s/g, '')}${operatorId} ${operatorId} ${entry.line.productName}">`;
		linebadge += lineName + trainnumber;
		linebadge += `</div></a>`;
		row.insertCell(0).innerHTML = linebadge;

		// Time / countdown
		const departureTime = new Date(entry.when || entry.plannedWhen);
		const timediff = Math.round((departureTime - now) / (1000 * 60));
		const countdownCell = row.insertCell(1);
		const delayDifference = Math.abs(departureTime - plannedDepartureTime) / (1000 * 60);
		const tripUrl = `trip.html?stationID=${encodeURIComponent(stationID)}&departureTime=${encodeURIComponent(entry.plannedWhen)}&tripId=${encodeURIComponent(entry.tripId)}`;

		if ((siteType === 'S' || siteType === 'L') && timediff <= 60 && entry.when !== null && !isArrival) {
			if (timediff <= 0) {
				countdownCell.innerHTML = `<a href="${tripUrl}">jetzt</a>`;
			} else {
				const delayClass = delayDifference > 5 ? 'style="color: #ec0016;"' : '';
				countdownCell.innerHTML = `<a href="${tripUrl}"><span ${delayClass}>${timediff}<span class="additional">&nbsp;min.</span></span></a>`;
			}
		} else {
			if (entry.when !== null) {
				if (delayDifference > 0) {
					countdownCell.innerHTML = `<a href="${tripUrl}"><nobr><s class='disabled'>${formatTime(entry.plannedWhen)}</s><br> ${formatTime(entry.when)}</nobr></a>`;
				} else {
					countdownCell.innerHTML = `<a href="${tripUrl}"><span class="timetable">${formatTime(entry.when)}</span></a>`;
				}
			} else {
				countdownCell.innerHTML = `<a href="${tripUrl}"><span class="timetable">${formatTime(entry.plannedWhen)}</span></a>`;
			}
		}

		const wideCell2 = row.insertCell(2);
		const destination = !isArrival ? entry.destination?.name || 'Unbekannt' : entry.provenance || 'Unbekannt';
		const prefix = isArrival ? '<span class="prefix">Von&nbsp;</span>' : '';

		wideCell2.innerHTML = `${prefix}<a href="${tripUrl}"><span class="scrolling-wrapper"><span class="scrolling-text station-name">${destination}</span></span></a>`;
		wideCell2.classList.add("wide");



		if (entry.remarks && entry.remarks.length > 0) {
			if (localStorage.getItem("showremarks") !== null && localStorage.getItem("showremarks") === "true") {
				const infoMessages = entry.remarks.map(r => r.text).join(' +++ ');
				wideCell2.innerHTML += `<div class="remark bigonly">${infoMessages}</div>`;
			}
		}

		// Platform
		const platformCell = row.insertCell(3);
		if (isCancelled) {
			if (entry.plannedPlatform === null) {
				platformCell.innerHTML = entry.platform ? `<a href="${tripUrl}"><s>${entry.platform}</s></a>` : `<a href="${tripUrl}"></a>`;
			} else {
				platformCell.innerHTML = `<a href="${tripUrl}"><s class='disabled'>${entry.plannedPlatform}</s></a>`;
			}
		} else {
			if (entry.platform == null) {
				platformCell.innerHTML = `<a href="${tripUrl}">-</a>`;
			} else if (entry.platform == entry.plannedPlatform) {
				platformCell.innerHTML = `<a href="${tripUrl}">${entry.plannedPlatform}</a>`;
			} else if (entry.plannedPlatform === null) {
				platformCell.innerHTML = `<a class="red" href="${tripUrl}">${entry.platform}</a>`;
			} else {
				platformCell.innerHTML = `<a href="${tripUrl}"><s class='disabled'>${entry.plannedPlatform}</s><br><span class="red"> ${entry.platform}</span></a>`;
			}
		}

		// Status cell
		const statusCell = row.insertCell(4);
		statusCell.classList.add("zerotable");
		statusCell.innerHTML = isCancelled ? `<img src="./assets/cancelled.webp" class="mini">` : abMessage;
	});

	if (findtrain === 0) {
		tableBody.innerHTML = `<tr><td colspan="4">Keine Daten verfügbar</td></tr>`;
		window.location.replace(`suburban.html?station=${stationID}`);
	}
}

function formatTime(dateString) {
	const date = new Date(dateString);
	return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Create closing doors icon when needed
function getAbMessage(dateTimeString) {
	if (!dateTimeString || siteType === 'A') return '';

	const dateTime = new Date(dateTimeString);
	const now = new Date();
	const timediff = Math.round((dateTime - now) / (1000 * 60));

	return timediff <= 0 ? '<img src="./assets/depart.gif" class="mini">' : '';
}