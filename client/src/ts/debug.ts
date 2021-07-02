import * as L from "leaflet";
import { $, geoDistance, geoHeading, geoTolatlng, km2Miles, meters2Feet, randInt, randomCentered } from "./util";
import { disableLiveLocation, enableLiveLocation, _onLocationUpdate } from "./mapUI";
import { me } from "./pilots";




// Create a fake flight track
let prev_e: GeolocationPosition;
const randPhaseA = Math.random() / 100;
const randPhaseB = Math.random() * 3.14;
let fake_center = L.latLng(37.6738, -121.2971);
let fake_in_flight = false;
let fake_in_flight_timer = 10;
let mainPhase = 0;
const fake_ground = 66 / meters2Feet;
let fake_altitude = fake_ground;
function genFakeLocation() {
    const timestamp = Date.now();

    fake_in_flight_timer -= 1;
    if (fake_in_flight_timer <= 0) {
        fake_in_flight = !fake_in_flight;
        if (fake_in_flight) {
            // duration in the air
            fake_in_flight_timer = randInt(60, 100);
        } else {
            // duration on the ground
            fake_in_flight_timer = randInt(20, 30);
        }
    }

    if (fake_in_flight) {
        mainPhase += 0.025;
        if (fake_in_flight_timer > 30) {
            fake_altitude += 50;
        } else if (fake_in_flight_timer < 10) {
            fake_altitude = Math.max(fake_ground, fake_altitude * 0.9 - 100);
        }
    } else {
        fake_center.lat += randomCentered() / 20000.0;
        fake_center.lng += randomCentered() / 20000.0;
    }

    let fake_pos = L.latLng(
        fake_center.lat + Math.sin(mainPhase + randPhaseA) / 70 * (Math.sin(mainPhase * 10.0 + randPhaseB) / 20 + 1),
        fake_center.lng + Math.cos(mainPhase + randPhaseA) / 50 * (Math.sin(mainPhase * 10.0 + randPhaseB) / 20 + 1),
    );

    let speed = 0;
    let heading = 0;
    if (prev_e != null) {
        const dist = geoDistance(geoTolatlng(prev_e.coords), fake_pos);
        // TODO: these units need checked!
        speed = dist / (timestamp - prev_e.timestamp) * km2Miles * 3600;
        heading = geoHeading(geoTolatlng(prev_e.coords), fake_pos);
    }

    const e = {
        coords: {
            latitude: fake_pos.lat,
            longitude: fake_pos.lng,
            accuracy: 1000,
            altitude: fake_altitude,
            altitudeAccuracy: 100,
            heading: heading,
            speed: speed,
        } as GeolocationCoordinates,
        timestamp: timestamp,  // TODO: test timestamp is using the same time epoch
    } as GeolocationPosition;
    prev_e = e;
    _onLocationUpdate(e);
}

let timer: number;
function simulateLocations(enable: boolean)    
{
    if (enable) {
        if (timer != 0) clearInterval(timer);
        timer = window.setInterval(genFakeLocation, 2000);
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
