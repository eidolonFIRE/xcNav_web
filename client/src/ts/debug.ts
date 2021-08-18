import * as L from "leaflet";
import { RotatedMarker } from "leaflet-marker-rotation";

import { geoHeading, geoTolatlng, km2Miles, meters2Feet, randInt, randomCentered } from "./util";
import { disableLiveLocation, enableLiveLocation, getMap, _onLocationUpdate } from "./mapUI";
import { me } from "./pilots";


enum SpoofMode {
    none = 0,
    circle = 1,
    draggable = 2,
}
let spoofmode = SpoofMode.none;



// Create a fake flight track
let prev_e = null;
const randPhaseA = Math.random() / 100;
const randPhaseB = Math.random() * 3.14;
let fake_center = L.latLng(37.6738, -121.2971);
let fake_in_flight = false;
let fake_in_flight_timer = 10;
let mainPhase = 0;
const fake_ground = 66 / meters2Feet;
let fake_geo = {
    coords: {
        latitude: fake_center.lat,
        longitude: fake_center.lng,
        accuracy: 1000,
        altitude: fake_ground,
        altitudeAccuracy: 100,
        heading: 0,
        speed: 0,
    },
    timestamp: 0,
};

function genFakeLocation_circle() {
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
        mainPhase += 0.018;
        if (fake_in_flight_timer > 30) {
            fake_geo.coords.altitude += 50;
        } else if (fake_in_flight_timer < 10) {
            fake_geo.coords.altitude = Math.max(fake_ground, fake_geo.coords.altitude * 0.9 - 100);
        }
    } else {
        fake_center.lat += randomCentered() / 20000.0;
        fake_center.lng += randomCentered() / 20000.0;
    }

    fake_geo.coords.latitude  = fake_center.lat + Math.sin(mainPhase + randPhaseA) / 70 * (Math.sin(mainPhase * 10.0 + randPhaseB) / 20 + 1);
    fake_geo.coords.longitude = fake_center.lng + Math.cos(mainPhase + randPhaseA) / 50 * (Math.sin(mainPhase * 10.0 + randPhaseB) / 20 + 1);

    if (prev_e != null) {
        const dist = geoTolatlng(prev_e.coords).distanceTo(geoTolatlng(fake_geo.coords));
        // speed is meter/sec
        fake_geo.coords.speed = dist / (fake_geo.timestamp - prev_e.timestamp) * 1000;
        fake_geo.coords.heading = geoHeading(geoTolatlng(prev_e.coords), geoTolatlng(fake_geo.coords));
    }
}


function genFakeLocation() {
    fake_geo.timestamp = Date.now();

    if (spoofmode == SpoofMode.circle) {
        genFakeLocation_circle();
    }
    if (spoofmode == SpoofMode.draggable) {
        if (me.marker == null) {
            me.updateGeoPos(fake_geo.coords);
        };
        if (me.marker.options.draggable == true) {
            const pos = me.marker.getLatLng();
            fake_geo.coords.latitude = pos.lat;
            fake_geo.coords.longitude = pos.lng;

            // speed is meter/sec
            fake_geo.coords.speed = 10;

        } else {
            // setup the draggable marker
            me.marker.removeFrom(getMap());
        
            me.marker = new RotatedMarker([me.geoPos.latitude, me.geoPos.longitude], {
                draggable: true,
                rotationAngle: me.geoPos.heading,
                rotationOrigin: "center center",
                icon: me.marker.getIcon(),
            }).addTo(getMap());

            me.marker.addEventListener("drag", (event: L.DragEndEvent) => {
                const pos = me.marker.getLatLng();
                fake_geo.coords.heading = geoHeading(geoTolatlng(prev_e.coords), pos);
            });
        }
    }
    
    prev_e = Object.assign({},fake_geo);
    prev_e.coords = Object.assign({}, fake_geo.coords);

    // bake new position
    _onLocationUpdate(fake_geo);
}


let timer: number;
function simulateLocations(enable: boolean)    
{
    if (enable) {
        if (timer == 0 || timer == null) {
            timer = window.setInterval(genFakeLocation, 2000);
            disableLiveLocation();
        }
    } else {
        if (timer != 0) {
            clearInterval(timer);
            timer = 0;
            enableLiveLocation();
        }
    }
}


// Setup Debug Functionality
export function setupDebug() {
    let inputs = document.querySelectorAll("input[name='spoof_location']") as NodeListOf<HTMLInputElement>;
    inputs.forEach((element: HTMLInputElement) => {
        element.addEventListener("click", (ev: Event) => {
            simulateLocations(Number(element.value) != 0);
            spoofmode = Number(element.value);
        });

        // initialize to whatever Bootstrap was set up with
        if (element.checked) element.click();
    });

    // change who you are flying as
    const button = document.getElementById("RenamePilot") as HTMLButtonElement;
    button.addEventListener("click", () => {
        const name = prompt("Choose new name");
        console.log("Setting name to", name);
        me.setName(name);
    });
}
