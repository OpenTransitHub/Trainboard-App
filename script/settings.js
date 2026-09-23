document.addEventListener("DOMContentLoaded", () => {

    const providerElement = document.getElementById("selected-provider");
    const providericon = document.getElementById("providericon");

    const selectedProviderName = localStorage.getItem("selectedProviderName") || "Deutsche Bahn (DB)";
    const selectedApiCode = localStorage.getItem("selectedApiCode") || "DE";

    if (providerElement) providerElement.textContent = selectedProviderName;
    if (providericon) {
        providericon.style.backgroundImage = "url('./providerLogos/" + (localStorage.getItem("selectedoperatorId") || "db") + ".svg')";
    }

    const detailedMapToggle = document.getElementById("detailed-map-toggle");
    const apiCodeSelect = document.getElementById("api-code-select");

    if (apiCodeSelect) {
        apiCodeSelect.addEventListener("change", (e) => {
            localStorage.setItem("selectedApiCode", e.target.value);
            if (typeof updateHeaderUI === "function") updateHeaderUI();
        });
    }

    const useDetailedMap = localStorage.getItem("useDetailedMap") !== "false";
    if (detailedMapToggle) {
        detailedMapToggle.checked = useDetailedMap;

        detailedMapToggle.addEventListener("change", (e) => {
            localStorage.setItem("useDetailedMap", e.target.checked);
        });
    }

    const toggle = document.getElementById('fast-switching-toggle');
    const STORAGE_KEY = 'fastswitch';

    if (toggle) {
        const existsInStorage = localStorage.getItem(STORAGE_KEY) !== null;
        toggle.checked = existsInStorage;

        toggle.addEventListener('change', () => {
            if (toggle.checked) {
                localStorage.setItem(STORAGE_KEY, 'true');
            } else {
                localStorage.removeItem(STORAGE_KEY);
            }
        });
    }

    const gmapsToggle = document.getElementById('googlemaps-toggle');
    if (gmapsToggle) {
        const GMAPS_STORAGE_KEY = 'maps';
        const storedValue = localStorage.getItem(GMAPS_STORAGE_KEY);
        gmapsToggle.checked = storedValue !== null ? storedValue === 'true' : true;

        gmapsToggle.addEventListener('change', () => {
            if (gmapsToggle.checked) {
                localStorage.setItem(GMAPS_STORAGE_KEY, 'true');
            } else {
                localStorage.setItem(GMAPS_STORAGE_KEY, 'false');
            }
        });
    }
});