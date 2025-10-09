if (localStorage.getItem("selectedWallpaper") !== null) {
    document.body.style.backgroundImage = `url('./assets/wallpapers/${localStorage.getItem("selectedWallpaper")}.jpg')`;
  
    if (localStorage.getItem("selectedWallpaper") === 'wallpaper1') {
      document.body.style.backgroundPositionX = 'center';
    }

   if (localStorage.getItem("selectedWallpaper") === 'wallpaper2') {
      document.body.style.backgroundPositionY = 'bottom';
      document.body.style.backgroundPositionX = '30%';
    }

    if (localStorage.getItem("selectedWallpaper") === 'wallpaper3') {
      document.body.style.backgroundPositionX = 'center';
    }

    if (localStorage.getItem("selectedWallpaper") === 'wallpaper5') {
      document.body.style.backgroundPositionY = '100%';
      document.body.style.backgroundPositionX = '35%';

    }

} else {
    document.body.style.backgroundImage = `url('./assets/wallpapers/wallpaper1.jpg')`;
    document.body.style.backgroundPositionX = 'center';
}




