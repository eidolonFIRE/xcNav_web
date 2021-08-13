// import our stuff
import { setupMapUI } from "./mapUI";
import { setupDebug } from "./debug";
import { setupOfflineHandler } from "./offline";
import { setupOneFingerZoom } from "./oneFingerZoom";
import { $ } from "./util";
import { setupOverlays } from "./overlays";
import { setupMessages } from "./chat";
import { setupFlightPlans }  from "./flightPlan";
import { setupWaypointEditorUI } from "./flightPlanUI";
import { refreshFlightLogUI } from "./flightRecorder";
import { setupInstruments } from "./instruments";
import { setupFlightPlanUpload } from "./kml";
import { setupContactsUI } from "./contacts";

// link bootstrap
import "bootstrap/dist/css/bootstrap.min.css";

// link leaflet
import "leaflet/dist/leaflet.css";

// link font-awesome
import "@fortawesome/fontawesome-free/js/all.js";
import "@fortawesome/fontawesome-free/css/all.css";

// link our resources
import "../index.html";
import "../css/main.css";
import "../css/contacts.css";
import "../css/flightPlan.css";
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
    setupContactsUI();
    setupMessages();
    setupOneFingerZoom();
    // TODO: reenable?
    // setupOverlays();
    setupOfflineHandler();
    setupInstruments();
    setupDebug();
    setupFlightPlans();
    setupFlightPlanUpload();
    
    refreshFlightLogUI();
    setupWaypointEditorUI();

    if( !$("#splashScreen").classList.contains("splashHidden") )
        $("#splashScreen").classList.add("splashHidden");
}, false);
