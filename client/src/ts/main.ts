// import our stuff
import { setupMapUI } from "./mapUI";
import { setupDebug } from "./debug";
import { setupOfflineHandler } from "./offline";
import { setupOneFingerZoom } from "./oneFingerZoom";
import { $ } from "./util";
import { setupOverlays } from "./overlays";
import { speak } from "./sounds";
import { setupMessages } from "./chat";
import { setupWaypointEditorUI } from "./flightPlan";
import { refreshFlightLogUI } from "./flightRecorder";
import { setupInstruments } from "./instruments";
import { setupFlightPlanUpload } from "./kml";
import { joinGroup } from "./client";
import { setupContactsUI } from "./contacts";

// link bootstrap
import "bootstrap/dist/css/bootstrap.min.css";

// link leaflet
import "leaflet/dist/leaflet.css";

// link font-awesome
import "@fortawesome/fontawesome-free/js/all.js";
import "@fortawesome/fontawesome-free/css/all.css";
// TODO: v4 shims till icons from v5 can be selected
import "@fortawesome/fontawesome-free/css/v4-shims.css";

// link our resources
import "../index.html";
import "../css/main.css";
import "../css/contacts.css";
import "../img/favicon.ico";
import "../img/favicon-16x16.png";
import "../img/favicon-32x32.png";



// | /!\ Work-around for leaflet not linking some resources
// | https://github.com/PaulLeCam/react-leaflet/issues/255
// | https://github.com/Leaflet/Leaflet/issues/4968
import * as L from "leaflet";
// @ts-ignore: Unreachable code error
import marker from 'leaflet/dist/images/marker-icon.png';
import marker2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
// L.Icon.Default.mergeOptions({
L.Marker.prototype.options.icon = L.icon({
    iconRetinaUrl: marker,
    iconUrl: marker2x,
    shadowUrl: markerShadow,
    iconAnchor: [13, 40]
});

import "../../node_modules/leaflet-geometryutil/src/leaflet.geometryutil.js";


// ==== INIT Sequence ====
// TODO: check init order
document.addEventListener('DOMContentLoaded', function () {
    setupMapUI();
    setupMessages();
    setupMessages();
    setupOneFingerZoom();
    // TODO: reenable?
    // setupOverlays();
    setupOfflineHandler();
    setupInstruments();
    setupDebug();
    setupFlightPlanUpload();
    setupContactsUI();
    
    refreshFlightLogUI();
    setupWaypointEditorUI();
}, false);




// ========================================================
//  emergency speech button
// ========================================================
// if(0)($("#emergency") as HTMLInputElement).onclick = function(e)
// {
//     let msg = "Emergency message from Matt Cowan: Need to land.";
//     msg = "Alert ! Airplane at your 6 oh clock. Distance: 5 miles. Height: 2000 feet.";
//     speak( msg, "Samantha", 0.8, 0.9 );  // Karen is a good Ozzie female
//     console.log( msg );
// };


if( !$("#splashScreen").classList.contains("splashHidden") )
    $("#splashScreen").classList.add("splashHidden");