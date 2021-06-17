import * as L from "leaflet";
import { $, randomCentered } from "./util";
import { clearAllMessages } from "./chat";
import { getMap, _onLocationUpdate } from "./mapUI";
import { me } from "./pilots";




// Create a fake flight track
const randPhaseA = Math.random() / 100
const randPhaseB = Math.random()
let fake_center = L.latLng(37.8 + randomCentered() / 20.0, -121.35 + randomCentered() / 50.0);
function genFakeLocation() {
    const mainPhase = Date.now() / 100000.0;

    let fake_pos = L.latLng(
        fake_center.lat + Math.sin(mainPhase + randPhaseA) / 50 + Math.sin(mainPhase * 10.0 + randPhaseB) / 200,
        fake_center.lng + Math.cos(mainPhase + randPhaseA) / 100 + Math.sin(mainPhase * 10.0 + randPhaseB) / 400,
    );

    const e = {
        latlng: fake_pos,
        bounds: fake_pos.toBounds(10),
        accuracy: 1,
        altitude: 300,
        altitudeAccuracy: 10,
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

    // change who you are flying as
    const button = document.getElementById("RenamePilot") as HTMLButtonElement;
    button.addEventListener("click", () => {
        const name = prompt("Choose new name");
        console.log("Setting name to", name);
        me.setName(name);
    });


    
    $("#clearAllMessages").onclick = function()
    {
        clearAllMessages();		
    }
}
