
async function fetchAndDisplayData() {

    // Den Wert des Cookies 'pinnedjourney' abrufen und in einer Variablen speichern
    const pinnedJourney = localStorage.getItem("pinnedJourney");
    const pinnedJourneyStation = localStorage.getItem("pinnedJourneyStation");

    console.log(pinnedJourneyStation);
    console.log(pinnedJourney);

    // Wenn angeheftete Fahrt existiert, gib den Wert aus
    if (pinnedJourney) {
        document.getElementById('pinnedPopup').classList.remove('hidden');
        const tripId = pinnedJourney;
    } else {
        return;  
    }

    const currentUrl = window.location.href;

    // Funktion, um URL-Parameter zu extrahieren
    function getParameterByName(name, url) {
        if (!url) url = window.location.href;
        name = name.replace(/[\[\]]/g, '\\$&');
        const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)');
        const results = regex.exec(url);
        if (!results) return null;
        if (!results[2]) return '';
        return decodeURIComponent(results[2].replace(/\+/g, ' '));
    }

    // Event Listener für Klick auf das Popup, um auf die Trip-Seite zu leiten
    document.getElementById('pinnedPopup').addEventListener('click', function () {
        // Seite mit der Trip-ID weiterleiten
        window.location.href = `trip.html?tripId=${pinnedJourney}&?stationID=${pinnedJourneyStation}`;
    });

    const tripID = pinnedJourney;

    

    console.log(pinnedJourney);

    

    try {
        const apiUrl = `https://data.cuzimmartin.dev/dynamic-trip?tripId=${(pinnedJourney)}&stationID=${(pinnedJourneyStation)}`;
        const response = await fetch(apiUrl);
        
        data = await response.json();

        
    } catch (error) {
        console.warn(`Problem mit der  API.`, error);
       
    }

    // Titel und Details setzen
    var lineName = data.trip.line.name.split('(')[0];
    document.getElementById('Pinnedlinebadge').textContent = `${lineName}`;

    // Dauer berechnen
    const departureTime = new Date(data.trip.plannedDeparture);
    const arrivalTime = new Date(data.trip.plannedArrival);
    const realdepartureTime = new Date(data.trip.departure);
    const realarrivalTime = new Date(data.trip.arrival);
    const duration = (arrivalTime - departureTime) / (1000 * 60 * 60);  // Stunden
    const minutes = Math.floor((duration % 1) * 60);
    document.getElementById('tripDurationTime').textContent = `${Math.floor(duration)}:${minutes.toString().padStart(2, '0')} h`;

    // Ursprungsstation und Zielstation setzen
    document.getElementById('originStationPopup').textContent = data.trip.origin.name;

    if (data.trip.plannedDeparture === data.trip.departure) {
        document.getElementById('originTime').textContent = departureTime.toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit',});
    } else {
        document.getElementById('originTime').innerHTML = `<s class="disabled">${departureTime.toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit',})}</s> ${realdepartureTime.toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit',})}`;
    }

    console.log(departureTime);  // Prüfe, ob departureTime ein gültiges Datum ist

    document.getElementById('destinationStationPopup').textContent = data.trip.destination.name;
    
    if (data.trip.plannedArrival === data.trip.arrival) {
        document.getElementById('destinationTime').textContent = arrivalTime.toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit',});
    } else {
        document.getElementById('destinationTime').innerHTML = `<s class="disabled">${arrivalTime.toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit',})}</s> ${realarrivalTime.toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit',})}`;
    }
    

  
    const badgeClassProductName = encodeURIComponent(data.trip.line.productName);
    const badgeClassProduct = encodeURIComponent(data.trip.line.product);
    const badgeClassLineOperator = encodeURIComponent(lineName.replace(/\s+/g, '')) + encodeURIComponent(data.trip.line.operator.id);
    const badgeClassOperator = encodeURIComponent(data.trip.line.operator.id);

    document.getElementById('Pinnedlinebadge').classList.add(badgeClassProductName);
    document.getElementById('Pinnedlinebadge').classList.add(badgeClassProduct);
    document.getElementById('Pinnedlinebadge').classList.add(badgeClassLineOperator);
    document.getElementById('Pinnedlinebadge').classList.add(badgeClassOperator);
    
}