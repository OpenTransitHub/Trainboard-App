const provider = window.ProviderStore ? ProviderStore.getProvider() : {
    providerName: "VR Finland",
    providerID: "vr",
    operatorId: "vr",
    apiPath: "fi"
};

const STATION_LIMIT = 20;

function updateProviderBadge() {
    const icon = document.querySelector(".providericon");
    const text = document.querySelector(".switchcontainer .wide");
    if (icon) {
        icon.src = window.ProviderStore ? ProviderStore.getProviderLogoPath(provider.providerID, "../assets/providerLogos") : `../assets/providerLogos/${provider.providerID}.svg`;
        icon.onerror = function () {
            this.onerror = null;
            this.src = "../assets/icons/provider.svg";
        };
    }
    if (text) {
        const name = window.ProviderStore ? ProviderStore.escapeHtml(provider.providerName) : provider.providerName;
        text.innerHTML = `<small>Gewählte Datenquelle:</small><br>${name}`;
    }
}

function getStationsUrl(query) {
    const path = provider && provider.apiPath ? provider.apiPath : "fi";
    const url = new URL(`https://prod.cuzimmartin.dev/api/${path}/stations`);
    url.searchParams.set("query", query);
    url.searchParams.set("limit", String(STATION_LIMIT));
    return url.toString();
}

function isRailStation(entry) {
    if (!entry || !entry.id || !entry.name) {
        return false;
    }
    const stationType = entry.metadata && entry.metadata.stationType ? String(entry.metadata.stationType).toUpperCase() : "";
    const type = entry.type ? String(entry.type).toLowerCase() : "";
    return stationType === "STATION" || type.includes("train");
}

function buildStationHref(entry) {
    return `departure.html?station=${encodeURIComponent(entry.id)}&stationName=${encodeURIComponent(entry.name)}`;
}

function displayResults(payload) {
    const resultsContainer = document.getElementById("results");
    resultsContainer.innerHTML = "";

    const entries = payload && payload.success && Array.isArray(payload.data) ? payload.data : [];
    entries.forEach((entry) => {
        if (!isRailStation(entry)) {
            return;
        }

        const suggestionDiv = document.createElement("div");
        suggestionDiv.classList.add("suggestion");

        const nameSpan = document.createElement("span");
        nameSpan.textContent = entry.name;

        const link = document.createElement("a");
        const href = buildStationHref(entry);
        link.href = href;

        const icon = document.createElement("img");
        icon.src = "../assets/icons/rail.svg";
        icon.classList.add("bigicon", "inverted");
        link.appendChild(icon);

        suggestionDiv.appendChild(nameSpan);
        suggestionDiv.appendChild(link);
        suggestionDiv.addEventListener("click", () => {
            window.location.href = href;
        });

        resultsContainer.appendChild(suggestionDiv);
    });
}

async function searchLocations() {
    const userInput = document.getElementById("searchInput").value.trim();
    const resultsContainer = document.getElementById("results");

    if (!userInput) {
        resultsContainer.innerHTML = "";
        return;
    }

    try {
        const response = await fetch(getStationsUrl(userInput), { method: "GET", mode: "cors" });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        displayResults(data);
    } catch (error) {
        console.error("Error fetching FI stations", error);
        resultsContainer.innerHTML = "";
    }
}

window.searchLocations = searchLocations;

window.addEventListener("load", () => {
    updateProviderBadge();
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("../service-worker.js");
    }
});
