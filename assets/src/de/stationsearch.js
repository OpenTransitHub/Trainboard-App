    // Switch to prefered Provider Suite
    const id="de"
    let p=localStorage.getItem("provider")
    if(!p){p={providerName:"Deutsche Bahn",providerID:"de"};localStorage.setItem("provider",JSON.stringify(p))}
    else p=JSON.parse(p)
    if(p.providerID!==id)location.href=`../${p.providerID}/index.html`


	function searchLocations() {
		const userInput = document.getElementById('searchInput').value;
		const apiUrl = `https://data.cuzimmartin.dev/locations?query=${userInput}`;

		fetch(apiUrl)
		.then(response => response.json())
		.then(data => displayResults(data))
		.catch(error => console.error('Error fetching data:', error));
	}

	function displayResults(data, searchType) {
		const resultsContainer = document.getElementById('results');
		resultsContainer.innerHTML = ''; // Clear previous results

		data.forEach(entry => {
			// Check if suburban is true
			const isSuburban = entry.products?.suburban;
            const isRegional = entry.products?.regional;
			
		
			if (
                    entry.products?.nationalExpress ||
                    entry.products?.national ||
                    entry.products?.interregional ||
                    entry.products?.regional || 
                    entry.products?.suburban 
                ) {
		
				// Create a div with class "suggestion"
				const suggestionDiv = document.createElement('div');
				suggestionDiv.classList.add('suggestion');

				// Create a span for the name
				const nameSpan = document.createElement('span');
				nameSpan.textContent = entry.name;

				// Create an anchor element with a link based on the selected search type (departure or arrival)
				const link = document.createElement('a');
				link.href = `station.html?station=${entry.id}`;

				// If suburban is true, append an image to the link with class "bigicon"
				if (isSuburban) {
					const img = document.createElement('img');
					img.src = '../assets/icons/sbahn.svg';
					img.alt = 'Suburban Icon';
					img.classList.add('bigicon');
					img.classList.add('inverted');
					link.appendChild(img);
				}
				
				if (isRegional) {
					const img = document.createElement('img');
					img.src = '../assets/icons/rail.svg';
					img.alt = 'Rail Icon';
					img.classList.add('bigicon');
					img.classList.add('inverted');
					link.appendChild(img);
				}
				
				
		
        // Append the nameSpan and link to the suggestionDiv
        suggestionDiv.appendChild(nameSpan);
        suggestionDiv.appendChild(link);

        // Add a click event listener to the suggestionDiv
        suggestionDiv.addEventListener('click', () => {
          window.location.href = link.href; // Redirect to the link when the div is clicked
        });

        // Append the suggestionDiv to the results container
        resultsContainer.appendChild(suggestionDiv);}
      });
	  
    }

	fetchAndDisplayData();