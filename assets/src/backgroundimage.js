if (localStorage.getItem("selectedWallpaper") !== null) {

    let imgname = localStorage.getItem("selectedWallpaper");

    if (localStorage.getItem("randomimg") === 'true') {
      imgname = 'wallpaper' + (Math.floor(Math.random() * 5) + 1);
    }

    document.body.style.backgroundImage = `url('./assets/wallpapers/${imgname}.jpg')`;
  
    if (imgname === 'wallpaper1') {
      document.body.style.backgroundPositionX = 'center';
    }

   if (imgname === 'wallpaper2') {
      document.body.style.backgroundPositionY = 'bottom';
      document.body.style.backgroundPositionX = '30%';
    }

    if (imgname === 'wallpaper3') {
      document.body.style.backgroundPositionX = 'center';
    }

    if (imgname === 'wallpaper5') {
      document.body.style.backgroundPositionY = '100%';
      document.body.style.backgroundPositionX = '35%';

    }

    

} else {
    document.body.style.backgroundImage = `url('./assets/wallpapers/wallpaper1.jpg')`;
    document.body.style.backgroundPositionX = 'center';
}




