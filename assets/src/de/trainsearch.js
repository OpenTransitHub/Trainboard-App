

        //Today date for searchbar default
        const today = new Date();
        const formattedDate = today.toISOString().split('T')[0];
        document.getElementById('dateInput').value = formattedDate;


        function searchLocations() {
            const userInput = document.getElementById('searchInput').value;
            const userDateInput = document.getElementById('dateInput').value;
            const apiUrl = `https://data.cuzimmartin.dev/search-train/${userInput}?day=${userDateInput}`;
    
            fetch(apiUrl)
                .then(response => response.json())
                .then(data => {
                    console.log('API Response:', data); // Log the entire response for debugging
                    if (data && Array.isArray(data.trips)) {
                        displayResults(data.trips); // Use data.trips instead of data
                    } else {
                        console.error('Expected trips array but received:', data);
                    }
                })
                .catch(error => console.error('Error fetching data:', error));
        }
    
        function displayResults(trips) {
            const resultsContainer = document.getElementById('results');
            resultsContainer.innerHTML = ''; // Clear previous results
    
            trips.forEach(trip => {
                resultsContainer.innerHTML += `
                    <a href="trip.html?stationID=${trip.origin.id}&departureTime=${encodeURIComponent(trip.plannedDeparture)}&tripId=${encodeURIComponent(trip.id)}" class="suggestion" style="text-decoration: none; text-align: left;">${trip.line.name.split("(Zug-Nr")[0]} (${trip.line.fahrtNr})<br>${trip.destination.name}</a>
                `;
                });

        }


        window.addEventListener("load", () => {
            if ("serviceWorker" in navigator) {
                navigator.serviceWorker.register("../service-worker.js");
            }
        });

        fetchAndDisplayData();