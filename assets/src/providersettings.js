document.addEventListener("DOMContentLoaded", () => {
    const providerKey = "provider";
    let providerData = localStorage.getItem(providerKey);
    let provider;

    // 1. Provider-Daten laden oder Initialisieren
    if (!providerData) {
        provider = {
            providerName: "Deutsche Bahn",
            providerID: "de",
            regionDisplay: "de" // Der Zielordnername
        };
        localStorage.setItem(providerKey, JSON.stringify(provider));
    } else {
        provider = JSON.parse(providerData);
    }

    // 2. Den aktuellen Ordnernamen ermitteln
    // Beispiel: bei "/de/index.html" liefert dies "de"
    const pathSegments = window.location.pathname.split('/').filter(segment => segment !== "");
    const currentFolder = pathSegments[pathSegments.length - 2];

    // 3. Logik: Wenn aktueller Ordner NICHT regionDisplay entspricht -> Redirect
    if (currentFolder !== provider.regionDisplay) {
        window.location.href = `../${provider.regionDisplay}/index.html`;
    }
});