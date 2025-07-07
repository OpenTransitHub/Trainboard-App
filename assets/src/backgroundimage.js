document.body.style.backgroundImage = `url('./assets/background.jpg')`;


// Background Image (Deprecated)
const url = "https://data.cuzimmartin.dev/mainpage-images/latest";

fetch(url)
    .then(response => response.json())
    .then(data => {
      // Assuming the first entry is the first element in the array
      const firstEntry = data[0]; // Access the first element of the array
      if (firstEntry) {
        const imageUrl = firstEntry.url;
        const focusPoint = firstEntry.focusPoint || 'center'; // Fallback auf 'center', wenn kein focusPoint vorhanden ist

        const bodyElement = document.body;
        bodyElement.style.backgroundImage = `url('${imageUrl}')`;

        // Setze die Hintergrundposition basierend auf dem focusPoint
        switch (focusPoint) {
          case 'top-left':
            bodyElement.style.backgroundPosition = 'top left';
            break;
          case 'top-center':
            bodyElement.style.backgroundPosition = 'top center';
            break;
          case 'top-right':
            bodyElement.style.backgroundPosition = 'top right';
            break;
          case 'middle-left':
            bodyElement.style.backgroundPosition = 'center left';
            break;
          case 'middle-center':
            bodyElement.style.backgroundPosition = 'center center'; // 'center' ist auch möglich
            break;
          case 'middle-right':
            bodyElement.style.backgroundPosition = 'center right';
            break;
          case 'bottom-left':
            bodyElement.style.backgroundPosition = 'bottom left';
            break;
          case 'bottom-center':
            bodyElement.style.backgroundPosition = 'bottom center';
            break;
          case 'bottom-right':
            bodyElement.style.backgroundPosition = 'bottom right';
            break;
          default:
            bodyElement.style.backgroundPosition = 'center'; // Standard auf 'center', wenn focusPoint unbekannt ist
            break;
        }
      }

      const descriptionElement = document.getElementById("description");
      if (descriptionElement) {
        descriptionElement.textContent = firstEntry.infoText;
      }

      const copyrightElement = document.getElementById("copyright");
      if (copyrightElement) {
        copyrightElement.textContent = firstEntry.copyright;
      }
    })
    .catch(error => {
      console.error("Error fetching JSON data:", error);
    });
