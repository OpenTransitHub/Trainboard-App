const provider = window.ProviderStore ? ProviderStore.getProvider() : {
    providerName: "Deutsche Bahn",
    providerID: "db",
    apiPath: "de",
    operatorId: "db"
};
const STATION_LIMIT = 100;
const AUSTRIA_STATION_LIMIT = 5;
const GERMANY_STATION_LIMIT = 5;

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
    let limit = STATION_LIMIT;
    if (provider && provider.apiPath === "at") {
        limit = AUSTRIA_STATION_LIMIT;
    } else if (provider && provider.apiPath === "de") {
        limit = GERMANY_STATION_LIMIT;
    }
    const params = { query: query, limit };
    if (window.ProviderStore) {
        return ProviderStore.buildApiUrl("stations", params, provider);
    }
    return `https://prod.cuzimmartin.dev/api/${provider.apiPath}/stations?query=${encodeURIComponent(query)}&limit=${limit}`;
}

async function searchLocations() {
    const userInput = document.getElementById("searchInput").value.trim();
    const resultsContainer = document.getElementById("results");
    if (!userInput) {
        resultsContainer.innerHTML = "";
        return;
    }
    try {
        const response = await fetch(getStationsUrl(userInput), {
            method: "GET",
            mode: "cors"
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        displayResults(data);
    } catch (error) {
        console.error("Error fetching data:", error);
        resultsContainer.innerHTML = "";
    }
}

function shouldShowResult(entry) {
    const products = entry && entry.metadata && entry.metadata.products ? entry.metadata.products : null;
    if (!products) {
        return true;
    }
    return Boolean(
        products.nationalExpress ||
        products.national ||
        products.regionalExpress ||
        products.regional ||
        products.suburban
    );
}

function buildIcons(entry) {
    const products = entry && entry.metadata && entry.metadata.products ? entry.metadata.products : null;
    const icons = [];
    if (!products) {
        icons.push("../assets/icons/rail.svg");
        return icons;
    }
    if (products.suburban) {
        icons.push("../assets/icons/sbahn.svg");
    }
    if (products.regional || products.regionalExpress || products.national || products.nationalExpress) {
        icons.push("../assets/icons/rail.svg");
    }
    if (icons.length === 0) {
        icons.push("../assets/icons/rail.svg");
    }
    return icons;
}

function displayResults(payload) {
    const resultsContainer = document.getElementById("results");
    resultsContainer.innerHTML = "";
    const entries = payload && payload.success && Array.isArray(payload.data) ? payload.data : [];

    entries.forEach((entry) => {
        if (!entry || !entry.id || !entry.name || !shouldShowResult(entry)) {
            return;
        }
        const suggestionDiv = document.createElement("div");
        suggestionDiv.classList.add("suggestion");

        const nameSpan = document.createElement("span");
        nameSpan.textContent = entry.name;

        const link = document.createElement("a");
        const href = `departure.html?station=${encodeURIComponent(entry.id)}&stationName=${encodeURIComponent(entry.name)}`;
        link.href = href;

        buildIcons(entry).forEach((src) => {
            const img = document.createElement("img");
            img.src = src;
            img.classList.add("bigicon", "inverted");
            link.appendChild(img);
        });

        suggestionDiv.appendChild(nameSpan);
        suggestionDiv.appendChild(link);
        suggestionDiv.addEventListener("click", () => {
            window.location.href = href;
        });

        resultsContainer.appendChild(suggestionDiv);
    });
}

window.addEventListener("load", () => {
    updateProviderBadge();
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("../service-worker.js");
    }
});

fetchAndDisplayData();
