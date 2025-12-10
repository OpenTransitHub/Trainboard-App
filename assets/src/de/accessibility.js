const urlParams = new URLSearchParams(window.location.search);

var stationID = urlParams.get('station');

document.getElementById('tabs').innerHTML += `<a href="station.html?station=${stationID}">Bahnhof</a>`;

document.getElementById('tabs').innerHTML += `<a href="#" class="active">Barrierefreiheit</a>`;

//document.getElementById('tabs').innerHTML += `<a href="shops.html?station=${stationID}">Shops</a>`;


fetch(`https://data.cuzimmartin.dev/fetch-station?eva=${stationID}`)
.then(response => response.json())
.then(data => {
	
	//FACILITIES
	
	const facilitieslist = document.getElementById("facilities");
	let facilityActiveCounter = 0;
	let facilityInactiveCounter = 0;

	
	data.facilities.forEach(facility => {
		if (facility.state === 'INACTIVE') {
			facilitieslist.innerHTML += `<div class="listitem"><div class="listimagecontainer listimagecontainerred"><img src="../assets/icons/${facility.type}.svg"></div><div class="listitemtext">${(facility.type === "ESCALATOR" ? "Fahrtreppe" : (facility.type === "ELEVATOR" ? "Aufzug" : facility.type)) + " " + facility.description}<br><small class="disabled">Außer Betrieb - ${facility.operatorname}</small></div></div>`;
 			++facilityInactiveCounter;
		} else {
			++facilityActiveCounter;
		}
		
		});
		
	console.log('Inactive: '+  facilityInactiveCounter)
	
	console.log('Active: '+  facilityActiveCounter)
	
	if (facilityActiveCounter === 1) {
		facilitieslist.innerHTML += `<div class="listitem"><div class="listimagecontainer listimagecontainergreen"><img src="../assets/icons/facilityActive.svg"></div><div class="listitemtext"><b>${facilityActiveCounter}</b> Anlage in Betrieb</div></div>`;

	} else {
		facilitieslist.innerHTML += `<div class="listitem"><div class="listimagecontainer listimagecontainergreen"><img src="../assets/icons/facilityActive.svg"></div><div class="listitemtext"><b>${facilityActiveCounter}</b> Anlagen in Betrieb</div></div>`;
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
			  document.getElementById('anemeties').innerHTML += `<div class="listitem"><div class="listimagecontainer"><img src="../assets/icons/${feature}.svg"></div><div class="listitemtext">${feature.replace("audibleSignalsAvailable", "Lautsprecheranlage").replace("passengerInformationDisplay", "Zuganzeiger").replace("standardPlatformHeight", "Bahnsteighöhe ≥ 55cm").replace("platformSign", "Kontrastreiche Wegeleitung").replace("stairsMarking", "Treppenstufenmarkierung").replace("stepFreeAccess", "Stufenfreier Zugang").replace("tactilePlatformAccess", "Taktiler Weg zum Bahnsteig").replace("tactileHandrailLabel", "Taktile Handlaufbeschilderung").replace("tactileGuidingStrips", "Taktiler Weg auf dem Bahnsteig")}<br><small class="disabled">Vorhanden</small></div></div>`;
            }
          }

          platformData.heights.forEach(h => {
            console.log("Höhe:", h.height);

			document.getElementById('anemeties').innerHTML += `<div class="listitem"><div class="listimagecontainer"><img src="../assets/icons/standardPlatformHeight.svg"></div><div class="listitemtext">${h.height} cm<br><small class="disabled">Bahnsteighöhe</small></div></div>`;

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