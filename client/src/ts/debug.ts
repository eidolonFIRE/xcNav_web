import * as L from "leaflet";
import { $, randomCentered } from "./util";
import { disableLiveLocation, enableLiveLocation, _onLocationUpdate } from "./mapUI";
import { me } from "./pilots";




// Create a fake flight track
const randPhaseA = Math.random() / 100;
const randPhaseB = Math.random() * 3.14;
let fake_center = L.latLng(37.8 + randomCentered() / 100.0, -121.35 + randomCentered() / 100.0);
function genFakeLocation() {
    const mainPhase = Date.now() / 100000.0;

    let fake_pos = L.latLng(
        fake_center.lat + Math.sin(mainPhase + randPhaseA) / 50 * (Math.sin(mainPhase * 10.0 + randPhaseB) / 20 + 1),
        fake_center.lng + Math.cos(mainPhase + randPhaseA) / 50 * (Math.sin(mainPhase * 10.0 + randPhaseB) / 20 + 1),
    );

    const e = {
        coords: {
            latitude: fake_pos.lat,
            longitude: fake_pos.lng,
            accuracy: 1000,
            altitude: 300,
            altitudeAccuracy: 100,
            heading: 0,
            speed: 0,
        } as GeolocationCoordinates,
        timestamp: Date.now(),  // TODO: test timestamp is using the same time epoch
    } as GeolocationPosition;

    _onLocationUpdate(e);
}

let timer: number;
function simulateLocations(enable: boolean)    
{
    if (enable) {
        if (timer != 0) clearInterval(timer);
        timer = window.setInterval(genFakeLocation, 5000);
        disableLiveLocation();
    } else {
        clearInterval(timer);
        timer = 0;
        enableLiveLocation();
    }
}


export function setupDebug() {
    // put functionality on the debug menu here

   
    // toggle fake GPS track
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
}
