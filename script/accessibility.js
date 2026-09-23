const urlParams = new URLSearchParams(window.location.search);

document.getElementById("toptitle").textContent = urlParams.get('stationName');

var stationID = urlParams.get('station');

fetch(`https://data.cuzimmartin.dev/fetch-station?eva=${stationID}`)
.then(response => response.json())
.then(data => {
	
	//FACILITIES
	
	const facilitieslist = document.getElementById("facilities");
	let facilityActiveCounter = 0;
	let facilityInactiveCounter = 0;

	
	data.facilities.forEach(facility => {
		if (facility.state === 'INACTIVE') {
			facilitieslist.innerHTML += `
      <div class="setting-item">
				<table>
					<tbody><tr class="wide">
						<td><div class="listelementicon coloricon red" style="background-image: url('./icons/${facility.type}.svg'); border-radius: 100px !important;"></div></td>
						<td class="wide"><strong>${(facility.type === "ESCALATOR" ? "Fahrtreppe" : (facility.type === "ELEVATOR" ? "Aufzug" : facility.type)) + " " + facility.description}</strong><br><small class="secondary">Außer Betrieb - ${facility.operatorname}</small></td>
					</tr>
				</tbody></table>
			</div>
      `;
 			++facilityInactiveCounter;
		} else {
			++facilityActiveCounter;
		}
		
		});
		
	console.log('Inactive: '+  facilityInactiveCounter)
	
	console.log('Active: '+  facilityActiveCounter)
	
	if (facilityActiveCounter === 1) {
		facilitieslist.innerHTML += `
    <div class="setting-item">
				<table>
					<tbody><tr class="wide">
						<td><div class="listelementicon coloricon green" style="background-image: url('./icons/facilityActive.svg'); border-radius: 100px !important;"></div></td>
						<td class="wide"><strong>${facilityActiveCounter}</strong> Anlage in Betrieb</td>
					</tr>
				</tbody></table>
			</div>
      `;

	} else {
    facilitieslist.innerHTML += `
    <div class="setting-item">
				<table>
					<tbody><tr class="wide">
						<td><div class="listelementicon coloricon green" style="background-image: url('./icons/facilityActive.svg'); border-radius: 100px !important;"></div></td>
						<td class="wide"><strong>${facilityActiveCounter}</strong> Anlagen in Betrieb</td>
					</tr>
				</tbody></table>
			</div>
      `;
	}
	
	
	if (facilityActiveCounter === 0 && facilityInactiveCounter === 0) {
		document.getElementById('facilitystatusbox').classList.add('hidden');
	}
	
	
	console.log(data.name);



	// Accesbility Features

	async function loadPlatforms() {
      try {
        const res = await fetch(`https://data.cuzimmartin.dev/platforms/${stationID}`);
        const data = await res.json();

        const select = document.getElementById("platformSelect");

        data.availablePlatforms.forEach((platform, index) => {
          const option = document.createElement("option");
          option.value = platform;
          option.textContent = `Gleis ${platform}`;
          if (index === 0) option.selected = true; 
          select.appendChild(option);
        });

        function handleSelection() {
          const selected = select.value;
          
          const platformData = data.platforms.find(p => p.name === selected);
          if (!platformData) return;

          console.clear();
		  document.getElementById('anemeties').innerHTML = "";

          for (const [feature, status] of Object.entries(platformData.accessibility)) {
            if (status === "AVAILABLE") {
			  document.getElementById('anemeties').innerHTML += `
        
        <div class="setting-item">
				<table>
					<tbody><tr class="wide">
						<td><div class="listelementicon" style="background-image: url('./icons/${feature}.svg');"></div></td>
						<td class="wide"><strong>${feature.replace("audibleSignalsAvailable", "Lautsprecheranlage").replace("passengerInformationDisplay", "Zuganzeiger").replace("standardPlatformHeight", "Bahnsteighöhe ≥ 55cm").replace("platformSign", "Kontrastreiche Wegeleitung").replace("stairsMarking", "Treppenstufenmarkierung").replace("stepFreeAccess", "Stufenfreier Zugang").replace("tactilePlatformAccess", "Taktiler Weg zum Bahnsteig").replace("tactileHandrailLabel", "Taktile Handlaufbeschilderung").replace("tactileGuidingStrips", "Taktiler Weg auf dem Bahnsteig")}</strong><br><small class="disabled">Vorhanden</small></td>
					</tr>
				</tbody></table>
			</div>
      
      
`;
            }
          }

          platformData.heights.forEach(h => {
            console.log("Höhe:", h.height);

			document.getElementById('anemeties').innerHTML += `
      
      <div class="setting-item">
				<table>
					<tbody><tr class="wide">
						<td><div class="listelementicon" style="background-image: url('./icons/standardPlatformHeight.svg');"></div></td>
						<td class="wide"><strong>${h.height} cm</strong><br><small class="disabled">Bahnsteighöhe</small></td>
					</tr>
				</tbody></table>
			</div>
      
`;

          });
        }

        select.addEventListener("change", handleSelection);

        handleSelection();

      } catch (err) {
        console.error("Fehler beim Laden der Daten:", err);
      }
    }

    loadPlatforms();



	
})
.catch(error => {
	console.error('Error fetching station data:', error);
	document.getElementById('container').classList.add('hidden');
	document.getElementById('errorbox').classList.remove('hidden');
});

fetchAndDisplayData();
