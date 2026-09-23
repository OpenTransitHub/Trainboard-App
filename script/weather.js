const urlParams = new URLSearchParams(window.location.search);

var city = urlParams.get('city');


	fetch(`https://data.cuzimmartin.dev/weather?city=${city}`)
	.then(response => response.json())
	.then(weatherdata => {
		
		console.log(weatherdata.main.temp);
		
		console.log(weatherdata.weather[0].description);

		document.getElementById("weatherwidget").style.backgroundImage = "url('./weathercanvas/canvas-" + weatherdata.weather[0].icon + ".svg')";
		
		document.getElementById('toptitle').innerHTML +=  weatherdata.name;	

        document.getElementById('temp').innerHTML = Math.floor(weatherdata.main.temp) + "°c";

        document.getElementById('feelsLike').innerHTML =  "Gefühlt wie: " + Math.floor(weatherdata.main.feels_like) + "°C";

        document.getElementById('description').innerHTML =  weatherdata.weather[0].description;	

        document.getElementById('airpressure').innerHTML =  weatherdata.main.pressure + " mbar";

        document.getElementById('humidity').innerHTML =  weatherdata.main.humidity + " %";

        document.getElementById('wind').innerHTML =  Math.floor(weatherdata.wind.speed) + " km/h / "+ weatherdata.wind.deg + "°";
        document.getElementById('windicon').style.transform = `rotate(${weatherdata.wind.deg}deg)`;
        
        
        document.getElementById("billing-loader")?.classList.add("hidden");
		
	})