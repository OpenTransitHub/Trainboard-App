(function (global) {
    const STORAGE_KEY = "provider";
    const DEFAULT_PROVIDER = {
        providerName: "Deutsche Bahn",
        providerID: "db",
        operatorId: "db",
        regionDisplay: "de",
        countryCode: "de",
        apiPath: "de",
        scope: "NATIONAL",
        maintenance: false,
        key: "DE:DB"
    };
    const ROUTE_FOLDERS = new Set([
        "at", "be", "budapest", "ch", "de", "dk", "ee", "fi", "flixbus",
        "fr", "gb", "ie", "it", "london", "lu", "nl", "no", "pl", "prague",
        "se", "vienna", "wlb", "legacy"
    ]);
    const LOGO_MAP = {
        "db": "DB.svg",
        "oebb": "OEBB.svg",
        "cfl": "CFL.svg",
        "pkp": "PKP.svg",
        "irish-rail": "Irish-Rail.svg",
        "rejseplanen": "Rejseplanen.svg",
        "bkk": "bkk.svg",
        "flixbus": "flixbus.svg",
        "national-rail": "national-rail.svg",
        "ns": "ns.svg",
        "peatus": "peatus.svg",
        "pid": "pid.svg",
        "sbb": "sbb.svg",
        "sncb": "sncb.svg",
        "sncf": "sncf.svg",
        "tfl": "tfl.svg",
        "trafiklab": "trafiklab.svg",
        "trenitalia": "trenitalia.svg",
        "vr": "vr.svg",
        "vy": "vy.svg",
        "wl": "wl.svg",
        "wlb": "wlb.svg"
    };

    function normalizeString(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    function normalizeLower(value) {
        return normalizeString(value).toLowerCase();
    }

    function normalizeProvider(raw) {
        const input = raw && typeof raw === "object" ? raw : {};
        const regionDisplay = normalizeLower(input.regionDisplay || input.regionCode || input.countryCode || DEFAULT_PROVIDER.regionDisplay);
        const countryCode = normalizeLower(input.countryCode || (regionDisplay.length === 2 ? regionDisplay : DEFAULT_PROVIDER.countryCode));
        const operatorId = normalizeLower(input.operatorId || input.providerID || DEFAULT_PROVIDER.operatorId);
        const providerID = operatorId || DEFAULT_PROVIDER.providerID;
        const apiPathCandidate = normalizeLower(input.apiPath || input.countryCode || input.regionDisplay || input.regionCode || DEFAULT_PROVIDER.apiPath);
        const apiPath = apiPathCandidate || DEFAULT_PROVIDER.apiPath;
        const scope = normalizeString(input.scope || DEFAULT_PROVIDER.scope).toUpperCase();
        const key = normalizeString(input.key || `${regionDisplay.toUpperCase()}:${providerID.toUpperCase()}`);
        const providerName = normalizeString(input.providerName || input.displayName || input.name || DEFAULT_PROVIDER.providerName);
        return {
            providerName: providerName || DEFAULT_PROVIDER.providerName,
            providerID,
            operatorId: providerID,
            regionDisplay: regionDisplay || DEFAULT_PROVIDER.regionDisplay,
            countryCode: countryCode || DEFAULT_PROVIDER.countryCode,
            apiPath,
            scope,
            maintenance: Boolean(input.maintenance),
            key
        };
    }

    function getStoredProvider() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return null;
        }
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }

    function setProvider(provider) {
        const normalized = normalizeProvider(provider);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        return normalized;
    }

    function getProvider() {
        const stored = getStoredProvider();
        if (!stored) {
            return setProvider(DEFAULT_PROVIDER);
        }
        const normalized = normalizeProvider(stored);
        if (JSON.stringify(stored) !== JSON.stringify(normalized)) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        }
        return normalized;
    }

    function fromApiEntry(entry, regionCode) {
        const region = normalizeLower(regionCode || entry.regionCode || entry.countryCode);
        const country = normalizeLower(entry.countryCode);
        const apiPath = country || region || DEFAULT_PROVIDER.apiPath;
        return normalizeProvider({
            providerName: normalizeString(entry.displayName || entry.name),
            providerID: normalizeLower(entry.operatorId),
            operatorId: normalizeLower(entry.operatorId),
            regionDisplay: region || country,
            countryCode: country || region,
            apiPath,
            scope: normalizeString(entry.scope),
            maintenance: entry.maintenance === true,
            key: normalizeString(entry.key)
        });
    }

    function buildApiUrl(endpoint, query, provider) {
        const selectedProvider = provider || getProvider();
        const path = normalizeLower(selectedProvider.apiPath || selectedProvider.countryCode || selectedProvider.regionDisplay || DEFAULT_PROVIDER.apiPath);
        const url = new URL(`https://prod.cuzimmartin.dev/api/${path}/${endpoint}`);
        if (query && typeof query === "object") {
            Object.keys(query).forEach((key) => {
                const value = query[key];
                if (value !== undefined && value !== null && value !== "") {
                    url.searchParams.set(key, String(value));
                }
            });
        }
        if (selectedProvider.operatorId) {
            url.searchParams.set("operator", selectedProvider.operatorId);
        }
        return url.toString();
    }

    function getProviderRoute(provider) {
        const selectedProvider = normalizeProvider(provider || getProvider());
        const routeCandidates = [
            normalizeLower(selectedProvider.regionDisplay),
            normalizeLower(selectedProvider.apiPath),
            normalizeLower(selectedProvider.countryCode)
        ];
        for (const candidate of routeCandidates) {
            if (ROUTE_FOLDERS.has(candidate)) {
                return candidate;
            }
        }
        return DEFAULT_PROVIDER.regionDisplay;
    }

    function getProviderLogoPath(providerId, basePath) {
        const normalized = normalizeLower(providerId);
        const fileName = LOGO_MAP[normalized] || `${normalized}.svg`;
        const prefix = normalizeString(basePath || "./assets/providerLogos");
        return `${prefix}/${fileName}`;
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    global.ProviderStore = {
        STORAGE_KEY,
        getProvider,
        setProvider,
        normalizeProvider,
        fromApiEntry,
        buildApiUrl,
        getProviderRoute,
        getProviderLogoPath,
        escapeHtml
    };
})(window);
