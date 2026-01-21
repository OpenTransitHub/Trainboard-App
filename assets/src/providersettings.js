document.addEventListener("DOMContentLoaded", () => {
    const providerKey = "provider";

    const providerCheck = () => {
        let providerData = localStorage.getItem(providerKey);
        let provider;

        if (!providerData) {
            provider = {
                providerName: "Deutsche Bahn",
                providerID: "db",
                regionDisplay: "de" 
            };
            localStorage.setItem(providerKey, JSON.stringify(provider));
        } else {
            provider = JSON.parse(providerData);
        }

        const pathSegments = window.location.pathname.split('/').filter(segment => segment !== "");
        const currentFolder = pathSegments[pathSegments.length - 2];
        
        if (currentFolder !== provider.regionDisplay.toLocaleLowerCase()) {
            window.location.href = `../${provider.regionDisplay}/index.html`;
        }
    };

    providerCheck();

    setInterval(providerCheck, 1000); 
});