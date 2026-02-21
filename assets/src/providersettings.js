document.addEventListener("DOMContentLoaded", () => {
    if (window.ProviderStore) {
        const provider = window.ProviderStore.getProvider();
        const targetRoute = window.ProviderStore.getProviderRoute(provider);
        const pathSegments = window.location.pathname.split("/").filter(Boolean);
        const currentFolder = pathSegments.length > 1 ? pathSegments[pathSegments.length - 2].toLowerCase() : "";
        if (currentFolder && currentFolder !== targetRoute) {
            window.location.href = `../${targetRoute}/index.html`;
        }
    }
});
