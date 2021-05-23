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
import * as L from "leaflet"
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


// TODO: why is this here in code? Is it a work-around?
if( !$("#splashScreen").classList.contains("splashHidden") )
$("#splashScreen").classList.add("splashHidden");


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
}, false);


// for testing & while no API yet for receiving messages:
// allow fake message receipts by pressing 1 or 2 on desktop browsers
// Note the slightly different handling depending on whether
// user is on the map or has the messages interface open when these come in

// this is all for testing messaging. Both the buttons and the 1 and 2 keydowns
// generate fake incoming messages
let tnf = function(e)
{
	createMessage( "Caleb", "Do you see the coyote right below us ?", /* isEmergency= */false, /* playSound= */true );
}
let tnf2 = function(e)
{
	createMessage( "Adrien", "Motor quit, need to land", /* isEmergency= */true, /* playSound= */true );
}

/*
$("#testNotification").onclick = tnf;
$("#testNotification2").onclick = tnf2;
*/


// TODO: these hacks interfere with actual text input a
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


// ========================================================
//  emergency speech button
// ========================================================
if(0)($("#emergency") as HTMLInputElement).onclick = function(e)
{
	let msg = "Emergency message from Matt Cowan: Need to land.";
	msg = "Alert ! Airplane at your 6 oh clock. Distance: 5 miles. Height: 2000 feet.";
	speak( msg, "Samantha", 0.8, 0.9 );  // Karen is a good Ozzie female
	console.log( msg );
};
