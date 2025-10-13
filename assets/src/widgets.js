function createWidgetBar() {
    const widgetBar = document.createElement("div");
    widgetBar.className = "widgetbar";

    // Pinned Popup
    const pinnedPopup = document.createElement("div");
    pinnedPopup.className = "pinnedPopup hidden";
    pinnedPopup.id = "pinnedPopup";

    pinnedPopup.innerHTML = `
        
       
        <div class="darkerwidget">
            <div class="popuptext">
                <div class="trip-header">
                    <div class="trip-title">
                        <div class="linebadge" id="Pinnedlinebadge""></div>
                    </div>
                    <div class="chip" style="margin-right: 0px;">
                        <img src="./assets/icons/addedtrain.svg" class="widgeticon"> <small>Angeheftet</small>
                    </div>
                </div>
                <div class="trip-progress-bar">
                    <div class="trip-station-info">
                        <div class="trip-origin-info">
                            <span id="originStationPopup"></span>
                        </div>
                        <div class="trip-destination-info">
                            <span id="destinationStationPopup"></span>
                        </div>
                    </div>
                    <div class="trip-time-info">
                        <div class="trip-origin-time">
                            <span id="originTime"></span>
                        </div>
                        <div class="trip-duration-div">
                            <span class="trip-duration" id="tripDurationTime">
                                <img src="./assets/whitespinner.svg" height="30">
                            </span>
                        </div>
                        <div class="trip-destination-time">
                            <span id="destinationTime"></span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    widgetBar.appendChild(pinnedPopup);

    // Trawelling Popup
    const twlngPopup = document.createElement("div");
    twlngPopup.className = "pinnedPopup hidden";
    twlngPopup.id = "twlngPopup";

    twlngPopup.innerHTML = `
        <a id="twlngpopuplink">
            <div class="darkerwidget">
                <div class="popuptext">
                    <div class="trip-header">
                        <div class="trip-title">
                            <div class="linebadge" id="twlnglinebadge"></div>
                        </div>
                        <div class="chip" style="margin-right: 0px;">
                            <img src="./assets/icons/twlng.png" class="widgeticon"> <small>Träwelling</small>
                        </div>
                    </div>
                    <div class="trip-progress-bar">
                        <div class="trip-station-info">
                            <div class="trip-origin-info">
                                <span id="twlngoriginStationPopup"></span>
                            </div>
                            <div class="trip-destination-info">
                                <span id="twlngdestinationStationPopup"></span>
                            </div>
                        </div>
                        <div class="trip-time-info">
                            <div class="trip-origin-time">
                                <span id="twlngoriginTime"></span>
                            </div>
                            <div class="trip-duration-div">
                                <span class="trip-duration" id="twlngtripDurationTime">
                                    <img src="./assets/whitespinner.svg" height="30">
                                </span>
                            </div>
                            <div class="trip-destination-time">
                                <span id="twlngdestinationTime"></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </a>
    `;

    widgetBar.appendChild(twlngPopup);

    // Add to DOM
    document.body.appendChild(widgetBar);
}

// Call the function to add the widget bar to the DOM
createWidgetBar();



// Release information popup
if (localStorage.getItem('versionpopup') !== 'true') {
    
    const handlePopupAction = (shouldReload, targetUrl = '') => {
        localStorage.setItem('versionpopup', 'true');
        if (targetUrl) {
            window.location.href = targetUrl;
        } else if (shouldReload) {
            window.location.reload();
        }
    };
    
    const popupHTML = `
        <div class="popupholder">
            <div id="version-popup" class="version-popup">
                <div class="popupimage"></div>

                <div class="popupcontent">
                    
                    <div style="height: 17px"></div>

                    <span class="popuptitle">Wilkommen im <i class="gradienttext">neuen</i> Trainboard</span>

                    <div style="height: 16px"></div>

                    Mehr  Funktionen, neues Design und AI-Komponenten.<br>
                    Sieh dir an was wir verbessert haben.

                    <div style="height: 30px"></div>

                    <span id="view-changes-btn" class="chip cursorpointer popupbutton">
                        Neuerungen ansehen
                    </span><br><br>
                    <small class="disabled cursorpointer" id="hide-popup-btn">
                        Nicht mehr anzeigen
                    </small> 
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('afterbegin', popupHTML);

    const hideBtn = document.getElementById('hide-popup-btn');
    if (hideBtn) {
        hideBtn.addEventListener('click', () => {
            handlePopupAction(true); 
        });
    }

    const viewBtn = document.getElementById('view-changes-btn');
    if (viewBtn) {
        viewBtn.addEventListener('click', () => {
            handlePopupAction(false, 'http://version.trainboard.eu/'); 
        });
    }
}
