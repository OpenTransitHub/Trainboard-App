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
