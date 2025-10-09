if (localStorage.getItem("selectedWallpaper") !== null) {
    document.body.style.backgroundImage = `url('./assets/wallpapers/${localStorage.getItem("selectedWallpaper")}.jpg')`;

   if ((localStorage.getItem("selectedWallpaper") === 'wallpaper2') || (localStorage.getItem("selectedWallpaper") === 'wallpaper5')) {
      document.body.style.backgroundPositionY = 'bottom';
    }

} else {
    document.body.style.backgroundImage = `url('./assets/wallpapers/wallpaper1.jpg')`;
}




