const siteurl = new URL(window.location.href);
    const tripId = siteurl.searchParams.get("tripID");
    console.log(tripId)
    const station = siteurl.searchParams.get("stop");
    console.log(station)


    // Mapping der Statuswerte zu Tooltip-Texten
    const statusTooltips = {
        'POSSIBLE': 'Umstieg wird erreicht',
        'QUICK_TRANSFER': 'Schnelles Umsteigen nötig',
        'IMPOSSIBLE': 'Nicht erreichbar'
    };

    // Funktion zum Formatieren der Zeit
    const formatTime = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const url = "https://data.cuzimmartin.dev/transfers?tripId=" + encodeURIComponent(tripId) + "&stationId=" + station;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            const transfers = data.transfers;
            const tableBody = document.querySelector("#transfersTable tbody");
            let hasValidTransfers = false;

            transfers.forEach(transfer => {

                
                const cleanLineName = transfer.lineDetails.name.match(/^[^(]+/)[0].trim();
                console.log(cleanLineName);


                // Überspringe Transfers, die gecancelled sind
                if (transfer.cancelled === true) {
                    return;
                }

                if ((transfer.lineDetails.product === 'bus') || (transfer.lineDetails.product === 'tram') || (transfer.lineDetails.product === 'subway')){
                    return;
                }

                // Wenn wir hier ankommen, gibt es mindestens einen gültigen Transfer
                hasValidTransfers = true;

                const row = document.createElement("tr");

                const lineCell = document.createElement("td");
                lineCell.innerHTML = '<a href="trip.html?stationID=' + station + '&departureTime=' + encodeURIComponent(transfer.plannedWhen) + '&tripId=' + encodeURIComponent(transfer.toTripId) + '"><div class="linebadge ' + transfer.lineDetails.productName + ' ' + transfer.lineDetails.product + ' ' + cleanLineName.replace(" ", "") + (transfer.lineDetails?.operator?.id ?? '') + ' '+ (transfer.lineDetails?.operator?.id ?? '') + '">' + cleanLineName + '</div></a>';
                row.appendChild(lineCell);

                const whenCell = document.createElement("td");

                if(transfer.when === transfer.plannedWhen) {
                    whenCell.innerHTML = '<a href="trip.html?stationID=' + station + '&departureTime=' + encodeURIComponent(transfer.plannedWhen) + '&tripId=' + encodeURIComponent(transfer.toTripId) + '">' + formatTime(transfer.when) + '</a>';
                } else {
                    whenCell.innerHTML = '<a href="trip.html?stationID=' + station + '&departureTime=' + encodeURIComponent(transfer.plannedWhen) + '&tripId=' + encodeURIComponent(transfer.toTripId) + '"><s class="disabled">' + formatTime(transfer.plannedWhen) + '</s>&nbsp;' + formatTime(transfer.when) + '</a>';
                }

                whenCell.classList.add('bigonly')
                row.appendChild(whenCell);



                const directionCell = document.createElement("td");
                directionCell.classList.add('wide');
                directionCell.innerHTML = '<a href="trip.html?stationID=' + station + '&departureTime=' + encodeURIComponent(transfer.plannedWhen) + '&tripId=' + encodeURIComponent(transfer.toTripId) + '">' + transfer.direction + '</a>';
                row.appendChild(directionCell);

                const platformCell = document.createElement("td");
                platformCell.style.textAlign = 'right';

                if (transfer.platformsLinked === true) {
                    platformCell.innerHTML = '<a href="trip.html?stationID=' + station + '&departureTime=' + encodeURIComponent(transfer.plannedWhen) + '&tripId=' + encodeURIComponent(transfer.toTripId) + '">' + transfer.platform + '<br></a>';
                } else {

                    platformCell.innerHTML = '<a href="trip.html?stationID=' + station + '&departureTime=' + encodeURIComponent(transfer.plannedWhen) + '&tripId=' + encodeURIComponent(transfer.toTripId) + '">' + transfer.platform + '</a>';
                }

                row.appendChild(platformCell);

                const availableTransferTimeCell = document.createElement("td");

                // Tooltip-Text basierend auf dem Status
                const tooltipText = statusTooltips[transfer.status] || 'Status unbekannt';

                if(transfer.when === transfer.plannedWhen) {
                    availableTransferTimeCell.innerHTML = '<a href="trip.html?stationID=' + station + '&departureTime=' + encodeURIComponent(transfer.plannedWhen) + '&tripId=' + encodeURIComponent(transfer.toTripId) + '"><span class="smallonly">' + formatTime(transfer.when) + '<br></span><span class="chip singlechip ' + transfer.status + ' transferchip" title="' + tooltipText + '"><img src="../assets/icons/' + transfer.status + '.svg" alt="' + transfer.status + '"class="transfericon">' + transfer.availableTransferTime + '&nbsp;min</span></a>';
                } else {
                    availableTransferTimeCell.innerHTML = '<a href="trip.html?stationID=' + station + '&departureTime=' + encodeURIComponent(transfer.plannedWhen) + '&tripId=' + encodeURIComponent(transfer.toTripId) + '"><span class="smallonly"><s class="disabled">' + formatTime(transfer.plannedWhen) + '</s>&nbsp;' + formatTime(transfer.when) + '<br></span><span class="connectionbadge ' + transfer.status + '" title="' + tooltipText + '"><img src="../assets/icons/' + transfer.status + '.svg" class="transfericon">' + transfer.availableTransferTime + '&nbsp;min</span></a>';
                }

                availableTransferTimeCell.style.textAlign = 'right';
                row.appendChild(availableTransferTimeCell);



                tableBody.appendChild(row);


            });

            // Aktualisiere die Header-Informationen
            document.getElementById('headertext').innerHTML = 'Ankunft mit ' + data.arrivalLine.split('(')[0] + ' in ' + data.arrivalStationName + ' um ' + formatTime(data.arrivalTime) + ' auf Gleis ' + data.arrivalPlatform;
            document.getElementById('arrivallineheader').innerHTML = data.arrivalLine.split('(')[0] || '';

            // Wenn keine Transfers vorhanden sind
            if (!hasValidTransfers) {
                document.getElementById('noTransfersMessage').style.display = 'block';
                document.getElementById('transfersTable').style.display = 'none';
            }


            fetch(`https://data.cuzimmartin.dev/weather?city=${data.arrivalStationName.split(/[\s-]/)[0]}`)
            .then(response => response.json())
            .then(weatherdata => {
                
                console.log(weatherdata.main.temp);
                
                console.log(weatherdata.weather[0].description);

                
                document.getElementById("weatherchip").innerHTML = `
                <a href="../weather.html?city=${data.arrivalStationName.split(/[\s-]/)[0]}">
                <span class="chip iconchip weatherchip">
                    <img src="../assets/weatcherIcons/${weatherdata.weather[0].icon}.svg">
                    ${Math.floor(weatherdata.main.temp)}°C
                </span>
                </a>`;

})

        })
        .catch(error => console.error("Error fetching or processing data:", error));

