document.addEventListener("DOMContentLoaded", () => {
    const STORAGE_KEY = 'fastswitch';
    const providerLink = document.getElementById('providerlink');

    if (localStorage.getItem(STORAGE_KEY) !== null && providerLink) {
        if (!providerLink.href.includes('?fastswitch')) {
            providerLink.href += '?fastswitch';
        }
    }

    const providerElement = document.getElementById("selected-provider");
    const providericon = document.getElementById("providericon");
    const statusElement = document.getElementById("provider-status");
    const searchInput = document.getElementById("station-search");
    const resultsContainer = document.getElementById("search-results");

    const selectedProviderName = localStorage.getItem("selectedProviderName") || "Deutsche Bahn (DB)";
    const selectedApiCode = localStorage.getItem("selectedApiCode") || "DE";

    if (providerElement) providerElement.textContent = selectedProviderName;
    if (providericon) {
        providericon.style.backgroundImage = "url('./providerLogos/" + (localStorage.getItem("selectedoperatorId") || "db") + ".svg')";
    }

    if (searchInput) {
        searchInput.addEventListener("input", () => {
            const query = searchInput.value.trim();

            if (query.length === 0) {
                if (resultsContainer) resultsContainer.innerHTML = "";
                return;
            }

            fetchStations(query);
        });
    }

    function fetchStations(query) {
        const apiUrl = `https://prod.cuzimmartin.dev/api/${selectedApiCode}/stations?query=${encodeURIComponent(query)}&limit=10`;

        fetch(apiUrl)
            .then(response => {
                if (response.status === 500 && statusElement) {
                    statusElement.textContent = " (aktuell offline)";
                }
                return response.json();
            })
            .then(result => {
                if (result && result.success && Array.isArray(result.data)) {
                    renderResults(result.data);
                } else if (resultsContainer) {
                    resultsContainer.innerHTML = "";
                }
            })
            .catch(error => {
                console.error("Fetch-Fehler bei Stationssuche:", error);
            });
    }

    function renderResults(stations) {
        if (!resultsContainer) return;
        resultsContainer.innerHTML = "";

        stations.sort((a, b) => {
            if (a.type === "train_station" && b.type !== "train_station") return -1;
            if (a.type !== "train_station" && b.type === "train_station") return 1;
            return 0;
        });

        stations.forEach(station => {
            const stationDiv = document.createElement("div");

            stationDiv.textContent = `${station.name}`;
            stationDiv.style.cursor = "pointer";
            stationDiv.classList.add("searchresult");
            stationDiv.style.backgroundImage = "url('./icons/" + station.type + ".svg')";

            stationDiv.addEventListener("click", () => {
                window.location.href = `board.html?stationId=${encodeURIComponent(station.id)}&stationName=${encodeURIComponent(station.name)}`;
            });

            resultsContainer.appendChild(stationDiv);
        });
    }

    renderFavorites();

    const homeSection = document.getElementById('homesection');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            if (!homeSection) return;
            if (searchInput.value.trim().length >= 2) {
                homeSection.classList.add('hidden');
            } else {
                homeSection.classList.remove('hidden');
				document.getElementById('railstation-results').innerHTML="";
            }
        });
    }

    const stationsearchInput = document.getElementById('railstation-search');
    const stationhomeSection = document.getElementById('secondhomesection');

    if (stationsearchInput) {
        stationsearchInput.addEventListener('input', () => {
            const query = stationsearchInput.value.trim();

            if (stationhomeSection) {
                if (query.length >= 2) {
                    stationhomeSection.classList.add('hidden');
                } else {
                    stationhomeSection.classList.remove('hidden');
                }
            }

            if (query.length >= 2) {
                searchLocations(query);
            } else {
                const railResultsContainer = document.getElementById('railstation-results');
                if (railResultsContainer) railResultsContainer.innerHTML = '';
            }
        });
    }

    const tab1 = document.getElementById('tab1');
    const tab2 = document.getElementById('tab2');
    const links = document.querySelectorAll('.buttonselect a');

    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            links.forEach(a => a.classList.toggle('active'));
            if (tab1) tab1.classList.toggle('hidden');
            if (tab2) tab2.classList.toggle('hidden');
        });
    });
});

function renderFavorites() {
    const favSection = document.getElementById("favorites-section"); 
    const favContainer = document.getElementById("favorites-container"); 
    if (!favContainer) return;

    const favorites = JSON.parse(localStorage.getItem("favoriteStations")) || [];
    favContainer.innerHTML = "";

    if (favorites.length === 0) {
        if (favSection) favSection.classList.add("hidden");
        document.getElementById("favtag").classList.add("hidden");
        return;
    }

    favorites.forEach(fav => {
        const favItem = document.createElement("div");
        favItem.classList.add("favoriteresult");
        favItem.style.cursor = "pointer";
        favItem.innerHTML = `<b>${fav.name}</b><br><small class="secondary">@ ${fav.providerName}</small>`;

        favItem.addEventListener("click", () => {
            localStorage.setItem("selectedApiCode", fav.apiCode);
            if (fav.providerName) localStorage.setItem("selectedProviderName", fav.providerName);
            if (fav.providerKey) localStorage.setItem("selectedProviderKey", fav.providerKey);
            if (fav.operatorId) localStorage.setItem("selectedoperatorId", fav.operatorId);

            window.location.href = `board.html?stationId=${encodeURIComponent(fav.id)}&stationName=${encodeURIComponent(fav.name)}`;
        });

        favContainer.appendChild(favItem);
    });
}

function searchLocations(query) {
    const apiUrl = `https://data.cuzimmartin.dev/oebb-locations?query=${encodeURIComponent(query)}`;

    fetch(apiUrl)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then(data => displayResults(data))
        .catch(error => console.error('Error fetching data:', error));
}

function displayResults(data) {
    const resultsContainer = document.getElementById('railstation-results');
    if (!resultsContainer) return;
    
    resultsContainer.innerHTML = '';

    if (!Array.isArray(data)) return;

    data.forEach(entry => {
        const hasTrainProduct = 
            entry.products?.nationalExpress ||
            entry.products?.national ||
            entry.products?.interregional ||
            entry.products?.regional || 
            entry.products?.suburban;

        if (hasTrainProduct) {

			resultsContainer.innerHTML +=`
				<div class="searchresult" style="cursor: pointer; background-image: url('./icons/train_station.svg');"><a href="station.html?station=${entry.id}">${entry.name}</a></div>
			`;


        }
    });
}

