import { geoDistance, geoTolatlng, make_uuid, objTolatlng, rawTolatlng } from "./util";


/*
    Save/Load my flights in local storage.

    Save format is JSON and container is independent from server API.
*/


interface Point {
    time: number; // msec since Unix epoch
    lat: number;
    lng: number;
    alt: number;
}


interface Flight {
    points: Point[];
    date: number;
    name: string;
    id: string;
    // TODO: add overlays and/or flight meta data?
}


interface FlightManifest {
    names: string[];
}


// the current flight for user
let cur_flight: Flight;
// is cur_flight active
export let active: boolean;
let hysteresis_active: number;
let hysteresis_deactive: number;


function _localStorageHasFlight(flight_id: string): boolean {
    const manifest = JSON.parse(localStorage.getItem("flights_manifest")) as FlightManifest;
    return manifest.names.indexOf(flight_id) > -1;
}

function _recordPoint(geo: GeolocationPosition) {
    if (cur_flight == null) {
        startNewFlight();
    }

    // only record if timestamp is newer
    if (cur_flight.points.length == 0 || 
            (cur_flight.points.length > 0 && cur_flight.points[cur_flight.points.length - 1].time) < geo.timestamp) {
        // append point
        const p = {
            time: geo.timestamp,
            lat: geo.coords.latitude,
            lng: geo.coords.longitude,
            alt: geo.coords.altitude,
        } as Point;
        cur_flight.points.push(p);

        // periodically save to storage
        if (cur_flight.points.length % 10 == 0) {
            saveCurrentFlight();
        }
    }
}



export function endCurrentFlight() {
    if (cur_flight.points.length > 1) {
        saveCurrentFlight();
    }
    cur_flight = null;
}

export function startNewFlight() {
    // if in current flight, end it first
    endCurrentFlight();

    // setup new flight
    cur_flight = {
        points: [],
        date: Date.now(),
        name: "-", // TODO: auto grab name from something in maps (airport name, city, etc...)
        id: make_uuid(6),
    } as Flight;
}

export function loadFlight(flight_id: string) {
    if (_localStorageHasFlight(flight_id)) {
        cur_flight = JSON.parse(localStorage.getItem(`flight_${cur_flight.id}`)) as Flight;
    } else {
        console.error(`Unable to load flight id:${flight_id}`);
    }
}

export function saveCurrentFlight() {
    // update manifest if needed
    if (!_localStorageHasFlight(cur_flight.id)) {
        let manifest = JSON.parse(localStorage.getItem("flights_manifest")) as FlightManifest;
        manifest.names.push(cur_flight.name);
        localStorage.setItem("flights_manifest", JSON.stringify(manifest));
    }

    // TODO: can this be a more performant append? Measure performance impact on long flights (~2hr track @ 1sec samples)
    localStorage.setItem(`flight_${cur_flight.id}`, JSON.stringify(cur_flight));
}



export function geoEvent(geo: GeolocationPosition) {
    // always record
    _recordPoint(geo);
    

    // detect flight activity change
    const prev_point = cur_flight.points[cur_flight.points.length - 1];
    if (cur_flight.points.length > 0) {
        const dist = geoDistance(objTolatlng(prev_point), geoTolatlng(geo.coords));
        // TODO: calculate the actual rates here for active threshold
        if (dist / (geo.timestamp - prev_point.time) > 10) {
            hysteresis_active += 1;
            hysteresis_deactive = Math.max(0, hysteresis_deactive - 1);
            if (hysteresis_active > 10) {
                active = true;
            }
        } else if (dist / (geo.timestamp - prev_point.time) < 5) {
            hysteresis_active = Math.max(0, hysteresis_active - 1);
            hysteresis_deactive += 1;
            if (hysteresis_deactive > 10) {
                active = false;
            }
        }
    }
}

export function listFlights(): FlightManifest {
    const manifest = JSON.parse(localStorage.getItem("flights_manifest")) as FlightManifest;
    return manifest;
}

export function exportFlight() {
    // TODO: save out to kml
    // Convert python code from here: https://github.com/eidolonFIRE/gps_tools/blob/master/gps_tools.py#L261
    // Save file in app: https://www.websparrow.org/web/how-to-create-and-save-text-file-in-javascript
}
