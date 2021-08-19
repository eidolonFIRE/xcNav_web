import StayAwake from 'stayawake.js';




export function setupSettings() {
    


    // Fullscreen button
    const fullScreenBtn = document.getElementById("fullscreenBtn") as HTMLButtonElement;
    fullScreenBtn.addEventListener("click", (ev: MouseEvent) => {
        const doc = window.document;
        const docEl = doc.documentElement;
      
        // @ts-ignore
        const requestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
        // @ts-ignore
        const cancelFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;
        // @ts-ignore
        if(!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
            requestFullScreen.call(docEl);
            fullScreenBtn.style.visibility = "hidden";
        }
        else {
            cancelFullScreen.call(doc);
        }
    });

    if ("wakeLock" in navigator) {
        // future API for wake-lock in browsers that support it.
        // @ts-ignore
        const lock1 = navigator.wakeLock.request("screen");
    } else {
        console.warn("Wake-Lock not supported");

        // use the hack
        // add the stay-awake hack to the document
        StayAwake.init();
        // The hack must be enabled from a user gesture so we use the full-screen button.
        fullScreenBtn.addEventListener("click", (ev: MouseEvent) => {
            StayAwake.enable();
        });
    }

    function exitFullscreen() {
        // @ts-ignore
        if (!document.fullscreenElement && !document.webkitIsFullScreen && !document.mozFullScreen && !document.msFullscreenElement) {
            fullScreenBtn.style.visibility = "visible";    
        }
    }

    document.addEventListener('webkitfullscreenchange', exitFullscreen);
    document.addEventListener("fullscreenchange", exitFullscreen);
    document.addEventListener("mozfullscreenchange", exitFullscreen);
          
}
