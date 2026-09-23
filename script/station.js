const urlParams = new URLSearchParams(window.location.search);
var stationID = urlParams.get('station');

function getAvailabilityStatus(availability) {
    if (!availability) return { text: "Vorhanden", statusClass: "" };

    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const now = new Date();
    const currentDayKey = days[now.getDay()];

    console.log("--- Öffnungszeiten DB Information ---");
    Object.keys(availability).forEach(day => {
        const slot = availability[day];
        console.log(`${day}: ${slot.fromTime} - ${slot.toTime}`);
    });

    const todayTimes = availability[currentDayKey];
    if (!todayTimes || !todayTimes.fromTime || !todayTimes.toTime) {
        return { text: "Vorhanden", statusClass: "" };
    }

    const { fromTime, toTime } = todayTimes;

    if (fromTime === "00:00" && (toTime === "24:00" || toTime === "00:00")) {
        return { text: "Geöffnet 24 Stunden", statusClass: "green" };
    }

    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [fromH, fromM] = fromTime.split(':').map(Number);
    const [toH, toM] = toTime.split(':').map(Number);

    const fromMinutes = fromH * 60 + fromM;
    let toMinutes = toH * 60 + toM;
    
    if (toH === 0 && toM === 0 && fromMinutes > 0) {
        toMinutes = 24 * 60;
    }

    if (currentMinutes >= fromMinutes && currentMinutes < toMinutes) {
        return { text: `Geöffnet bis ${toTime} Uhr`, statusClass: "green" };
    } else {
        return { text: `Geschlossen. Öffnet um ${fromTime} Uhr`, statusClass: "red" };
    }
}

function fetchAndDisplayData() {
    if (!stationID) {
        console.error('Keine Station-ID in den URL-Parametern angegeben.');
        return;
    }

    fetch(`https://data.cuzimmartin.dev/fetch-station?eva=${stationID}`)
    .then(response => response.json())
    .then(data => {

		if (data.szentrale?.publicPhoneNumber) {
            console.log(`--- 3-S-Zentrale Telefonnummer (${data.szentrale.name || 'Station'}) ---`);
            console.log(`Telefon: ${data.szentrale.publicPhoneNumber}`);

			document.getElementById("otherslabel").classList.remove("hidden");

			document.getElementById("otherssection").innerHTML += `
				<div class="setting-item">
                        <table>
                            <tbody><tr class="wide">
                                <td><div class="listelementicon" style="background-image: url('./icons/has3s.svg');"></div></td>
                                <td class="wide"><strong>3-S-Zentrale</strong><br><small class="secondary ">${data.szentrale.publicPhoneNumber}</small></td>
								<td><a href="tel:${data.szentrale.publicPhoneNumber}"><div class="button iconbutton callbutton noinvert">Anruf</div></a></td>
							</tr>
                        </tbody></table>
                    </div>
			`;
        }


        if (data.ril100Identifiers && data.ril100Identifiers.length > 0) {
            document.getElementById('toptitle').innerHTML = data.ril100Identifiers[0].rilIdentifier + " - " + data.name;
        } else {
            document.getElementById('toptitle').innerHTML = data.name;
        }

        document.getElementById("switchlink").setAttribute("href", "accessibility.html?station=" + stationID + "&stationName=" + encodeURIComponent(data.name));

        if (data.photoPath) {
            document.getElementById("stationimg").style.backgroundImage = "url(" + data.photoPath + ")";
        } else {
            document.getElementById("stationimg").style.backgroundImage = "none";
        }

        if (data.mailingAddress) {
            document.getElementById("adress").textContent = data.mailingAddress.street || '';
            document.getElementById("postcode").textContent = (data.mailingAddress.zipcode || '') + ' ' + (data.mailingAddress.city || '');
            
            if (localStorage.getItem('maps') !== 'false') {
                const fullAddress = `${data.mailingAddress.street}, ${data.mailingAddress.zipcode} ${data.mailingAddress.city}`;
                document.getElementById("mapslink").setAttribute("href", "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(fullAddress));
            }

            fetch(`https://data.cuzimmartin.dev/weather?city=${encodeURIComponent(data.mailingAddress.city)}`)
            .then(response => response.json())
            .then(weatherdata => {
                document.getElementById("weather").setAttribute("href", "weather.html?city=" + encodeURIComponent(data.mailingAddress.city));
                document.getElementById("weathericon").style.backgroundImage = "url(./weathericons/" + weatherdata.weather[0].icon + ".svg)";
                document.getElementById("temperature").textContent = Math.floor(weatherdata.main.temp) + "°C";
                document.getElementById("condition").textContent = weatherdata.weather[0].description;

                if (weatherdata?.alerts?.[0]?.properties?.EVENT != null) {
                    document.getElementById('weatherbox').innerHTML += `
                        <br><span class="red small">${weatherdata?.alerts?.[0]?.properties?.EVENT?.replace("VORABINFORMATION", "")}</span>
                    `;
                }
            })
            .catch(err => console.error('Fehler beim Abrufen der Wetterdaten:', err));
        }

        if (data.number) {
            document.getElementById("sevlink").setAttribute("href", "https://www.bahnhof.de/downloads/replacement-service-maps/" + data.number + ".pdf");
        }

        const features = document.getElementById("amanetiesection");
        const featureList = [
            { key: 'hasWiFi', icon: 'hasWiFi.svg', text: 'Kostenloses WiFi', color: 'green' },
            { key: 'hasParking', icon: 'hasparking.svg', text: 'Parkplatz', color: 'blue' },
            { key: 'hasBicycleParking', icon: 'hasBicycleParking.svg', text: 'Fahrradparkplatz', color: 'blue' },
            { key: 'hasPublicFacilities', icon: 'hasPublicFacilities.svg', text: 'Öffentliches WC', color: 'red' },
            { key: 'hasLockerSystem', icon: 'hasLockerSystem.svg', text: 'Schließfächer', color: 'turquoise' },
            { key: 'hasTaxiRank', icon: 'hasTaxiRank.svg', text: 'Taxistand', color: 'orange' }
        ];

        let featuresHTML = '';
        featureList.forEach(feature => {
            if (data[feature.key] === true) {
                featuresHTML += `
                    <div class="setting-item">
                        <table>
                            <tr class="wide">
                                <td><div class="listelementicon coloricon ${feature.color}" style="background-image: url('./icons/${feature.icon}'); border-radius: 100px !important;"></div></td>
                                <td class="wide"><strong>${feature.text}</strong><br><small class="secondary">Vorhanden</small></td>
                            </tr>
                        </table>
                    </div>
                `;
            }
        });
        features.innerHTML += featuresHTML;

		if (featuresHTML) {
			document.getElementById("amenetieslabel").classList.remove("hidden")
		}


        const services = document.getElementById("servicessection");
        const serviceList = [
            { key: 'hasTravelCenter', icon: 'hasTravelCenter.svg', text: 'Reisezentrum' },
            { key: 'DBinformation', icon: 'dbinformation.svg', text: 'DB Information' },
            { key: 'hasDBLounge', icon: 'hasDBLounge.svg', text: 'DB Lounge' },
            { key: 'hasLostAndFound', icon: 'hasLostAndFound.svg', text: 'Fundbüro' },
            { key: 'hasRailwayMission', icon: 'hasRailwayMission.svg', text: 'Bahnhofsmission' },
            { key: 'hasCarRental', icon: 'hasCarRental.svg', text: 'Autoverleih' }
        ];

        let servicesHTML = '';
        serviceList.forEach(service => {
            const isPresent = data[service.key] === true || (service.key === 'DBinformation' && service.key in data);

            if (isPresent) {
                let statusText = "Vorhanden";
                let statusClass = "";

                if (service.key === 'DBinformation' && data.DBinformation?.availability) {
                    const statusInfo = getAvailabilityStatus(data.DBinformation.availability);
                    statusText = statusInfo.text;
                    statusClass = statusInfo.statusClass;
                }

                servicesHTML += `
                    <div class="setting-item">
                        <table>
                            <tr class="wide">
                                <td><div class="listelementicon" style="background-image: url('./icons/${service.icon}');"></div></td>
                                <td class="wide"><strong>${service.text}</strong><br><small class="secondary ${statusClass}">${statusText}</small></td>
                            </tr>
                        </table>
                    </div>
                `;
            }
        });
        services.innerHTML += servicesHTML;

		if (servicesHTML) {
			document.getElementById("serviceslabel").classList.remove("hidden")
		}

        // Loader ausblenden und Inhalt anzeigen
        document.getElementById("billing-loader")?.classList.add("hidden");
        document.getElementById("retarder")?.classList.remove('hidden');

    })
    .catch(error => {
        console.error('Error fetching station data:', error);
    });
}

fetchAndDisplayData();