import * as L from "leaflet";
import { $ } from "./util";
import { clearAllMessages } from "./chat";
import { getMap, _onLocationUpdate } from "./mapUI";




// Create a fake flight track
const meRand = Math.random()
let fake_pos = L.latLng(37.8 + Math.random() / 10.0, -121.35 + Math.random() / 10.0, 300);
function genFakeLocation() {
    fake_pos.lat = 37.8 + Math.sin(Date.now() / 100000.0) / 100 + Math.sin(Date.now() / 40000.0 + meRand) / 200;
    fake_pos.lng = -121-.35 + Math.cos(Date.now() / 100000.0) / 200 + Math.sin(Date.now() / 40000.0 + meRand) / 400;

    const e = {
        latlng: fake_pos,
        bounds: {} as L.LatLngBounds,
        accuracy: 1,
        altitude: 300,
        altitudeAccuracy: 1,
        heading: 0,
        speed: 0,
        timestamp: Date.now(),  // TODO: test timestamp is using the same time epoch
    } as L.LocationEvent;

    _onLocationUpdate(e);
}

let timer: number;
function simulateLocations(enable: boolean)    
{
    if (enable) {
        if(timer != 0) clearInterval( timer );
        timer = window.setInterval( genFakeLocation, 2000 );
        getMap().removeEventListener("locationfound");
    } else {
        clearInterval( timer);
        timer = 0;
        getMap().on('locationfound', _onLocationUpdate);
    }
}


export function setupDebug() {
    // put functionality on the debug menu here


    // "Fly As" is currently still in the Pilots constructor, TBD since those are all fake pilots anyway
    // and may be best to keep the hackery local to there

    
    // toggle periodic API telemetry updates on/off
    const simLocCheckbox = document.getElementById("simLocations") as HTMLInputElement;
    simLocCheckbox.addEventListener("change", (event: Event) => {
        const box = event.currentTarget as HTMLInputElement;
        simulateLocations(box.checked);
    });
            
    // initialize to whatever Bootstrap was set up with
    simulateLocations( $("#simLocations").checked );


    
    $("#clearAllMessages").onclick = function()
    {
        clearAllMessages();		
    }
}
