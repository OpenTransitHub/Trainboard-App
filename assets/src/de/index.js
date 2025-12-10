async function searchLocations() {
	const userInput = document.getElementById('searchInput').value;
	const apiUrl = `https://prod.cuzimmartin.dev/api/de/stations?query=${encodeURIComponent(userInput)}&limit=10`;

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

		const products = entry.metadata?.products || {};

		const isSuburban = products.suburban === true;
		const isRegional = products.regional === true;

		if (
			products.nationalExpress ||
			products.national ||
			products.regionalExpress ||
			products.regional ||
			products.suburban
		) {
			const suggestionDiv = document.createElement('div');
			suggestionDiv.classList.add('suggestion');

			const nameSpan = document.createElement('span');
			nameSpan.textContent = entry.name;

			const link = document.createElement('a');
			link.href = `departure.html?station=${entry.id}`;

			if (isSuburban) {
				const img = document.createElement('img');
				img.src = '../assets/icons/sbahn.svg';
				img.alt = 'Suburban Icon';
				img.classList.add('bigicon', 'inverted');
				link.appendChild(img);
			}

			if (isRegional) {
				const img = document.createElement('img');
				img.src = '../assets/icons/rail.svg';
				img.alt = 'Rail Icon';
				img.classList.add('bigicon', 'inverted');
				link.appendChild(img);
			}

			suggestionDiv.appendChild(nameSpan);
			suggestionDiv.appendChild(link);

			suggestionDiv.addEventListener('click', () => {
				window.location.href = link.href;
			});

			resultsContainer.appendChild(suggestionDiv);
		}
	});
}

window.addEventListener("load", () => {
	if ("serviceWorker" in navigator) {
		navigator.serviceWorker.register("../service-worker.js");
	}
});

fetchAndDisplayData();