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
import "../css/chat.css";
import "../css/fuel.css";
import "../css/profileEditor.css";
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

// import our stuff
import { setupMapUI } from "./mapUI";
import { setupDebug } from "./debug";
import { setupOneFingerZoom } from "./oneFingerZoom";
import { setupChat } from "./chat";
import { setupFlightPlans }  from "./flightPlan";
import { setupWaypointEditorUI } from "./flightPlanUI";
import { setupInstruments } from "./instruments";
import { setupFlightPlanUpload } from "./kml";
import { setupContactsUI } from "./contacts";
import { setupBackendConnection } from "./client";
import { setupSettings } from "./settings";
import { setupProfileEditor, showProfileEditor } from "./profileEditorUI";
import { me } from "./pilots";
import { setupFuelApi } from "./fuel";


// ==== INIT Sequence ====
document.addEventListener('DOMContentLoaded', function () {
    setupMapUI();
    setupContactsUI();
    setupProfileEditor();
    setupChat();
    // setupOneFingerZoom();
    setupInstruments();
    setupDebug();
    setupFlightPlans();
    setupFlightPlanUpload();
    setupWaypointEditorUI();
    setupBackendConnection();
    setupSettings();
    setupFuelApi();

    // first time visitor sequence
    if (me.name == "") {
        showProfileEditor(true);
    }

    const splashScreen = document.getElementById("splashScreen") as HTMLDivElement;
    splashScreen.classList.add("splashHidden");
  
}, false);
