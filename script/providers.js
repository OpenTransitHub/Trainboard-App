document.addEventListener("DOMContentLoaded", () => {

    const providerElement = document.getElementById("selected-provider");
    const providericon = document.getElementById("providericon");

    const selectedProviderName = localStorage.getItem("selectedProviderName") || "Deutsche Bahn (DB)";
    const selectedApiCode = localStorage.getItem("selectedApiCode") || "DE";

    providerElement.textContent = selectedProviderName;

    providericon.style.backgroundImage = "url('./providerLogos/" + (localStorage.getItem("selectedoperatorId") || "db") + ".svg')";

    function updateHeaderUI() {
        const selectedProviderName = localStorage.getItem("selectedProviderName") || "Deutsche Bahn (DB)";
        if (providerElement) {
            providerElement.textContent = selectedProviderName;
        }
        if (providericon) {
            providericon.style.backgroundImage = "url('./providerLogos/" + (localStorage.getItem("selectedoperatorId") || "db") + ".svg')";
        }
    }

    const container = document.getElementById("providers-container");
    const API_URL = "https://prod.cuzimmartin.dev/api/providers";

    const currentProviderKey = localStorage.getItem("selectedProviderKey") || "DE:DB";

    fetchProviders();

    function fetchProviders() {
        fetch(API_URL)
            .then(response => response.json())
            .then(result => {
                if (result.success && result.data && result.data.grouped) {
                    renderProviders(result.data.grouped);
                } else {
                    container.textContent = "Fehler beim Laden der Provider-Daten.";
                }
            })
            .catch(error => {
                console.error("Fetch-Fehler:", error);
                container.textContent = "Fehler bei der Verbindung zur API.";
            });
    }

    function renderProviders(groupedData) {
        const nationalProviders = [];
        const internationalProviders = [];
        const cityProviders = [];
        const regionalProviders = [];

        groupedData.forEach(group => {
            if (group.providers && Array.isArray(group.providers)) {
                group.providers.forEach(provider => {
                    if (provider.scope === "NATIONAL") {
                        nationalProviders.push(provider);
                    } else if (provider.scope === "INTERNATIONAL") {
                        internationalProviders.push(provider);
                    } else if (provider.scope === "CITY") {
                        cityProviders.push(provider);
                    } else if (provider.scope === "REGIONAL") {
                        regionalProviders.push(provider);
                    }
                });
            }
        });

        container.innerHTML = "";

        function renderSection(title, providers, emptyMessage) {
            const brake = document.createElement("br")
            const heading = document.createElement("small");
            heading.classList.add("secondary")
            heading.classList.add("bold");
            heading.textContent = title;
            container.appendChild(brake);
            container.appendChild(heading);
            

            const listContainer = document.createElement("div");
            listContainer.classList.add("listelement-container");

            if (providers.length > 0) {
                providers.forEach(provider => {
                    listContainer.appendChild(createRadioButton(provider));
                });
            } else {
                const emptyText = document.createElement("p");
                emptyText.textContent = emptyMessage;
                listContainer.appendChild(emptyText);
            }

            container.appendChild(listContainer);
        }

        renderSection("National", nationalProviders);
        renderSection("International", internationalProviders);
        renderSection("Lokal", cityProviders);
        renderSection("Regional", regionalProviders);
    }

    function createRadioButton(provider) {
        const wrapper = document.createElement("div");
        const id = "provider-" + provider.key;
        const name = provider.displayName || provider.name;
        const isChecked = currentProviderKey === provider.key ? "checked" : "";

        // Markup direkt hier anpassen (z. B. zusätzliche Klassen, Spans oder geänderte Reihenfolge):
        wrapper.innerHTML = `
        <input type="radio" name="provider" value="${provider.key}" id="${id}" ${isChecked}>
        <label for="${id}">
            <table>
                <tr class="wide">
                    <td><div id="providericon" style="background-image: url('./providerLogos/${provider.operatorId}.svg')"></div></td>
                    <td class="wide"><b>${provider.name}</b><br><small>${provider.key}</small></td>
                    
                </tr>
            </table>
        </label>
            
            
            
        `;

        const input = wrapper.querySelector("input");
        input.addEventListener("change", () => {
            if (input.checked) {
                const apiCode = resolveApiCode(provider);
                localStorage.setItem("selectedProviderKey", provider.key);
                localStorage.setItem("selectedProviderName", provider.displayName || provider.name);
                localStorage.setItem("selectedApiCode", apiCode);
                localStorage.setItem("selectedoperatorId", provider.operatorId);
                
                // Anzeige oben direkt aktualisieren
                updateHeaderUI();
            }

            const urlParams = new URLSearchParams(window.location.search);

            if (urlParams.has('fastswitch')) {
                window.location.href = 'index.html';
            }

        });

        return wrapper;
    }

    function resolveApiCode(provider) {
        const allowedSpecialCodes = [
            "flixbus", "wlb", "european-sleeper", "westbahn", 
            "motis", "transitous", "gtfs", "world", "global"
        ];

        const operatorId = (provider.operatorId || "").toLowerCase();
        const countryCode = (provider.countryCode || "").toLowerCase();
        const regionCode = (provider.regionCode || "").toLowerCase();

        if (allowedSpecialCodes.includes(operatorId)) {
            return operatorId;
        }

        if (allowedSpecialCodes.includes(countryCode)) {
            return countryCode;
        }

        if (provider.countryCode && provider.countryCode.length === 2) {
            if (regionCode) {
                return `${provider.countryCode.toLowerCase()}/${regionCode}`;
            }
            return provider.countryCode.toUpperCase();
        }

        return "DE";
    }

    const toggle = document.getElementById('fast-switching-toggle');
    const STORAGE_KEY = 'fastswitch';

    const existsInStorage = localStorage.getItem(STORAGE_KEY) !== null;
    toggle.checked = existsInStorage;

    toggle.addEventListener('change', () => {
        if (toggle.checked) {
        localStorage.setItem(STORAGE_KEY, 'true');
        } else {
        localStorage.removeItem(STORAGE_KEY);
        }
    });

    
});

