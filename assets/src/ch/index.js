async function searchLocations() {
	const userInput = document.getElementById('searchInput').value;
	const apiUrl = `https://prod.cuzimmartin.dev/api/ch/stations?query=${encodeURIComponent(userInput)}&limit=10`;

	try {
		const response = await fetch(apiUrl, {
			method: "GET",
			mode: "cors"
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const data = await response.json();
		displayResults(data);
	} catch (error) {
		console.error('Error fetching data:', error);
	}
}

function displayResults(data) {
	const resultsContainer = document.getElementById('results');
	resultsContainer.innerHTML = '';

	if (!data.success || !Array.isArray(data.data)) {
		return;
	}

	data.data.forEach(entry => {
		console.log(entry);

		// NEUE API: es existieren KEINE metadata/products mehr
		// -> minimal: wir lassen Icons trotzdem existieren, aber ohne Logik
		const suggestionDiv = document.createElement('div');
		suggestionDiv.classList.add('suggestion');

		const nameSpan = document.createElement('span');
		nameSpan.textContent = entry.name;

		const link = document.createElement('a');
		link.href = `departure.html?station=${encodeURIComponent(entry.id)}`;

		// Wenn du Icons ganz entfernen willst → sag Bescheid
		const img = document.createElement('img');
		img.src = '../assets/icons/rail.svg';
		img.alt = 'Rail Icon';
		img.classList.add('bigicon', 'inverted');
		link.appendChild(img);

		suggestionDiv.appendChild(nameSpan);
		suggestionDiv.appendChild(link);

		suggestionDiv.addEventListener('click', () => {
			window.location.href = link.href;
		});

		resultsContainer.appendChild(suggestionDiv);
	});
}

window.addEventListener("load", () => {
	if ("serviceWorker" in navigator) {
		navigator.serviceWorker.register("../service-worker.js");
	}
});

fetchAndDisplayData();
