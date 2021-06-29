import { saveAs } from 'file-saver';
import { geoDistance, geoTolatlng, km2Miles, make_uuid, mSecToStr_h_mm, objTolatlng, strFormat } from "./util";


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
    flights_by_id: Record<string, string>;
}


// the current flight for user
let cur_flight: Flight;
let in_flight: boolean = false;
let hysteresis_active: number = 0;
let hysteresis_deactive: number = 0;


// TODO: expose these in settings somewhere
const trigger_flight_speed = 10; // mph
const trigger_flight_time = 5;   // seconds
const trigger_land_speed = 4;
const trigger_land_time = 10;



function _localStorageHasFlight(flight_id: string): boolean {
    const manifest = JSON.parse(localStorage.getItem("flights_manifest")) as FlightManifest;
    if (manifest == null) return false;
    return Object.keys(manifest.flights_by_id).indexOf(flight_id) > -1;
}

function _recordPoint(geo: GeolocationPosition) {
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


export function isInFlight(): boolean {
    return in_flight;
}

export function startNewFlight() {
    // if in current flight, save it first
    if (cur_flight != null && cur_flight.points.length > 1) {
        saveCurrentFlight();
    }

    const id = make_uuid(6);

    // setup new flight
    cur_flight = {
        points: [],
        date: Date.now(),
        name: "-", // TODO: auto grab name from something in maps (airport name, city, etc...)
        id: id,
    } as Flight;

    console.log(`Starting flight: ${id}`);

    refreshFlightLogUI();
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
        if (manifest == null) {
            // init a fresh manifest
            manifest = {
                flights_by_id: {}
            } as FlightManifest;
        }
        manifest.flights_by_id[cur_flight.id] = cur_flight.name;
        localStorage.setItem("flights_manifest", JSON.stringify(manifest));
    }

    // TODO: can this be a more performant append? Measure performance impact on long flights (~2hr track @ 1sec samples)
    localStorage.setItem(`flight_${cur_flight.id}`, JSON.stringify(cur_flight));
}

export function geoEvent(geo: GeolocationPosition) {
    if (cur_flight == null) {
        startNewFlight();
    }

    // detect flight activity change
    if (cur_flight.points.length > 0) {
        const prev_point = cur_flight.points[cur_flight.points.length - 1];
        const dist = geoDistance(objTolatlng(prev_point), geoTolatlng(geo.coords));
        const time = (geo.timestamp - prev_point.time) / 1000;
        const speed = dist / time * km2Miles * 3600 / 1000;
        if (speed > trigger_flight_speed) {
            hysteresis_active += time;
            hysteresis_deactive = 0;
            if (hysteresis_active > trigger_flight_time && in_flight == false) {
                console.log("In Flight Detected!");
                in_flight = true;
                // trim up till now
                // TODO: preserve some points just before the launch, this timer will start after the launch
                cur_flight.points = [];
            }
        } else if (speed < trigger_land_speed) {
            hysteresis_active = 0;
            hysteresis_deactive += time;
            if (hysteresis_deactive > trigger_land_time && in_flight == true) {
                console.log("Landing detected.");
                in_flight = false;
                // end the current flight
                startNewFlight();
            }
        } else {
            // cool down hysteresis triggers
            hysteresis_active = Math.max(0, hysteresis_active - time / 2);
            hysteresis_deactive = Math.max(0, hysteresis_deactive - time / 2);
        }
    }

    // always record
    _recordPoint(geo);
}

export function exportFlight(flight_id: string) {
    // Convert python code from here: https://github.com/eidolonFIRE/gps_tools/blob/master/gps_tools.py#L261

    const flight = JSON.parse(localStorage.getItem(`flight_${flight_id}`)) as Flight;
    if (flight == null) {
        console.error(`Failed to load flight_id ${flight_id}`);
        return;
    }

    const style_format = "<Style id=\"{name}\">\n\
<LineStyle>\n\
<color>{line_color}</color>\n\
<width>4</width>\n\
</LineStyle>\n\
<PolyStyle>\n\
<color>{poly_color}</color>\n\
<outline>0</outline>\n\
</PolyStyle>\n\
</Style>"

    const linestring_format = "<Placemark>\n\
<name>\n\
{name}\n\
</name>\n\
<styleUrl>#{style}</styleUrl>\n\
<LineString>\n\
<extrude>1</extrude>\n\
<tessellate>1</tessellate>\n\
<altitudeMode>absolute</altitudeMode>\n\
<coordinates>\n\
{coordinates}\n\
</coordinates>\n\
</LineString>\n\
</Placemark>"
        
    const file_format = "<?xml version=\"1.0\"?>\n\
<kml xmlns=\"http://www.opengis.net/kml/2.2\">\n\
<Document>\n\
{styles}\n\
{linestring}\n\
</Document>\n\
</kml>"

    const num_styles = 1;
    // let path_unprojected = (self.path / self._path_scale - self._path_offset) / [1.0, 1.0, 1.0, 3.28084]
    let styles = [];
    for (let i = 0; i < num_styles; i++) {
        // const line_color = strFormat("ff{:02x}{:02x}{:02x}", [*color_wheel(-i/(float(num_styles)-1)*2/3 + 1/3)]);
        const line_color = "ffff0000";
        styles.push(strFormat(style_format, {name: "style" + i.toString(), line_color: line_color, poly_color: "7f0f0f0f"}));
    }

    let linestrings = [];

    const step = 10;
    const vel_range = [15, 35];
    for (let i = 0; i < flight.points.length; i+=step) {
        const points = [];
        for (let t = 0; t <= step; t++) {
            if (i + t >= flight.points.length) continue;
            const p = flight.points[i + t];
            points.push(p.lng.toString() + "," + p.lat.toString() + "," + p.alt.toString());
        }
        const points_string = points.join("\n");
        // avg_speed = numpy.mean(self.velocity[max(0, i-1):min(len(self.velocity - 1), i + step + 1)])
        // style = "style{}".format(max(0, min(num_styles - 1, int(num_styles * (avg_speed - vel_range[0]) / (vel_range[1] - vel_range[0])))))
        const style = "style0";
        linestrings.push(strFormat(linestring_format, {name: i.toString(), style: style, coordinates: points_string}));
    }
    const kml = strFormat(file_format, {styles: styles.join("\n"), linestring: linestrings.join("\n")});





    let blob = new Blob([kml], { type: "text/plain;charset=utf-8" });
    // https://github.com/eligrey/FileSaver.js
    saveAs(blob, `flight_${flight_id}.kml`);
}


// ============================================================================
//
// Flight Log UI
//
// ----------------------------------------------------------------------------

export function refreshFlightLogUI() {
    const manifest = JSON.parse(localStorage.getItem("flights_manifest")) as FlightManifest;
    if (manifest == null) return;

    const list = document.getElementById("flightLogList") as HTMLUListElement;

    // empty list
    while (list.firstChild) {
        list.removeChild(list.lastChild);
    }

    // repopulate the list
    Object.keys(manifest.flights_by_id).forEach((flight_id: string) => {
        // gather meta data
        const flight = JSON.parse(localStorage.getItem(`flight_${flight_id}`)) as Flight;
        if (flight == null) return;
        let dur_str = "";
        if (flight.points.length > 1) {
            const duration = flight.points[flight.points.length - 1].time - flight.points[0].time;
            dur_str = mSecToStr_h_mm(duration);
        } else {
            // skip empty flights
            // TODO: should clean/remove empty flights?
            return;
        }


        // set html
        const entry = document.createElement("li") as HTMLLIElement;
        entry.innerHTML = `(${dur_str}) ` + flight_id;
        entry.className = "list-group-item";
        entry.setAttribute("data-bs-dismiss", "offcanvas");
        // entry.setAttribute("data-bs-toggle", "offcanvas");

        entry.addEventListener("click", (ev: MouseEvent) => {
            exportFlight(flight_id);
        });

        list.appendChild(entry);
    });
}