// import our stuff
import { setupMapUI } from "./mapUI";
import { setupDebug } from "./debug";
import { setupMessages } from "./messages"
import { setupPilots } from "./pilots"
import { setupOfflineHandler } from "./offline";
import { setupOneFingerZoom } from "./oneFingerZoom";
import { $ } from "./util";
import { setupOverlays } from "./overlays";
import { speak } from "./sounds";
import { createMessage } from "./messages";
import { setupQRCode } from "./QRCode";

// link our resources
import "../index.html";
import "../css/main.css";
import "../img/favicon.ico";
import "../img/favicon-16x16.png";
import "../img/favicon-32x32.png";

// link bootstrap
import "bootstrap/dist/css/bootstrap.min.css";

// link leaflet
import "leaflet/dist/leaflet.css";

// link font-awesome
import "@fortawesome/fontawesome-free/js/all.js";
import "@fortawesome/fontawesome-free/css/all.css";
// TODO: v4 shims till icons from v5 can be selected
import "@fortawesome/fontawesome-free/css/v4-shims.css";



// | /!\ Work-around for leaflet not linking some resources
// | https://github.com/PaulLeCam/react-leaflet/issues/255
// | https://github.com/Leaflet/Leaflet/issues/4968
import * as L from "leaflet";
// @ts-ignore: Unreachable code error
delete L.Icon.Default.prototype._getIconUrl;
import marker from 'leaflet/dist/images/marker-icon.png';
import marker2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
L.Icon.Default.mergeOptions({
	iconRetinaUrl: marker,
	iconUrl: marker2x,
	shadowUrl: markerShadow,
});

import "../../node_modules/leaflet-geometryutil/src/leaflet.geometryutil.js";


// ==== INIT Sequence ====
// TODO: check init order
document.addEventListener('DOMContentLoaded', function () {
	setupMapUI();
	setupMessages();
	setupOneFingerZoom();
	setupPilots();
	setupOverlays();
	setupOfflineHandler();
	setupDebug();
	setupQRCode();
}, false);



// TODO: these hacks interfere with actual text input
window.onkeydown = function( e )
{
	switch( e.key ) {
		case '`': 	{
						console.log( "Toggling Simulated Locations" );
						($("#simLocations") as HTMLInputElement).click(); 
					}
					break;
	}
	return true; /* event is handled. no one else needs to do anything */
}





// On startup, by the time we have arrived here, everything is inited
// so we can dismiss the splash page
$("#splashScreen").classList.add("splashHidden");

