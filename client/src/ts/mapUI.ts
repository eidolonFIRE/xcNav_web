import * as L from "leaflet";
import * as GeometryUtil from "leaflet-geometryutil";
import { getBounds, me } from "./pilots";
import * as client from "./client";
import * as flight from "./flightRecorder";
import { udpateInstruments } from "./instruments";
import { planManager } from "./flightPlan";
import * as cookies from "./cookies";
import { refreshAllMapMarkers } from "./flightPlanUI";


export enum FocusMode {
    unset = 0,
    me,
    group,
    edit_plan,
}

let _focusMode: FocusMode;
let _focusOnMeButton: HTMLButtonElement;
let _focusOnAllButton: HTMLButtonElement;

let _evenClickOnMarker = false;

let _map: L.Map;



export function getMap(): L.Map {
    return _map;
}


function _isButtonActive(button: HTMLButtonElement): boolean {
    return button.classList.contains( "active" );
}

function _setButtonActive(button: HTMLButtonElement, active: boolean) {
    if (active) {
        button.classList.add( "active" );
    } else {
        button.classList.remove( "active" );
    }
}

export function getFocusMode(): FocusMode {
    return _focusMode;
}

export function setFocusMode(mode: FocusMode) {
    // DEBUG
    console.log("Set Focus Mode: ", mode);

    // update buttons
    _setButtonActive(_focusOnMeButton, mode == FocusMode.me);
    _setButtonActive(_focusOnAllButton, mode == FocusMode.group);

    if (mode == FocusMode.unset) {
        // can drag map markers when scrubbing map
        refreshAllMapMarkers(true);
    }

    const plan = planManager.plans[me.current_waypoint.plan];
    if (plan != null && me.current_waypoint.index >= 0) {
        if (mode == FocusMode.edit_plan) {
            let b = L.latLngBounds(plan.plan.waypoints.map((wp) => {
                // TODO: support lines
                return wp.geo[0];
            }));
            b = b.pad(0.5);
            getMap().fitBounds(b);
            refreshAllMapMarkers(true);
        } else if (_focusMode == FocusMode.edit_plan) {
            // exiting edit mode
            refreshAllMapMarkers(false);
        }
    }

    _focusMode = mode;
    updateMapView();
}

function _initFocusOnButtons() {	
    // view mode handlers
    document.getElementById("focusOnMe").onclick= function() { setFocusMode(FocusMode.me) };
    document.getElementById("focusOnAll").onclick= function() { setFocusMode(FocusMode.group) };		

    // initialize button to desired state
    _focusOnMeButton = document.getElementById("focusOnMe") as HTMLButtonElement;
    _focusOnAllButton = document.getElementById("focusOnAll") as HTMLButtonElement;
    // read whatever the Bootstrap UI was set up with
    if (_isButtonActive(_focusOnMeButton)) {
        setFocusMode(FocusMode.me);
    } else if (_isButtonActive(_focusOnAllButton)) {
        setFocusMode(FocusMode.group);
    }
}





// bug in leaflet: marker click handlers are called twice for each click
// eliminate the second call 
function _markerClickHandler(e) {
    if (_evenClickOnMarker) {
        console.log( "You clicked this marker:" );
        console.log( e.target );

        e.target.openPopup( e.target.getLatLng() );
    }
    _evenClickOnMarker = !_evenClickOnMarker;
    return true;
}



/*	----------------------------------------------------------------------------
**	onLocationUpdate
**
**	called whenever we get a location update from the browser
**	on desktops (where loc is based on server or wifi location rather than GPS) this could be rarely
**	on mobiles it should be often esp when we move (I see 1/sec on IOS)
**	Show current location with a marker and location accuracy with a circle as usual in geo apps
**	Note that only lat, lng and accuracy are guaranteed to be provided
**	altitude, altitudeAccuracy only on devices with real GPS chips (not desktop browsers)
**	and speed, heading only if we are moving (ie from interpolated GPS)
**	---------------------------------------------------------------------------*/	
let _locationHandler: number = null;
export function enableLiveLocation() {
    console.log("Starting Real Live Location");
    if (_locationHandler != null) {
        navigator.geolocation.clearWatch(_locationHandler);
    }
    _locationHandler = navigator.geolocation.watchPosition(_onLocationUpdate, null, {enableHighAccuracy: true});
}

export function disableLiveLocation() {
    if (_locationHandler != null) {
        navigator.geolocation.clearWatch(_locationHandler);
    }
}

export function _onLocationUpdate(event: GeolocationPosition) {
    const geo = {
        latitude: event.coords.latitude,
        longitude: event.coords.longitude,
        accuracy: event.coords.accuracy,
        altitude: event.coords.altitude,
        altitudeAccuracy: event.coords.altitudeAccuracy,
        heading: event.coords.heading,
        speed: event.coords.speed,
    } as GeolocationCoordinates;

    // send location to server
    client.sendTelemetry(event.timestamp, geo, me.fuel);

    // record locally
    flight.geoEvent(event);

    // update all the things
    me.updateGeoPos(geo);
    const plan = planManager.plans[me.current_waypoint.plan];
    if (plan != null && me.current_waypoint.index >= 0) {
        plan.updateNextWpGuide();
    }
    me.updateFuel(event.timestamp);
    updateMapView();
    udpateInstruments();
}


export function updateMapView() {
    switch (_focusMode) {
        case FocusMode.me: {
            if (me.geoPos != null) _map.panTo([me.geoPos.latitude, me.geoPos.longitude]);
            break;
        }
        case FocusMode.group: {
            _map.fitBounds(getBounds());
            break;
        }
    }
}


export function setupMapUI(): void {

    // Note: all the map tile sources have to be served from https
    const tilemapOptions = {
        'Mapnik': L.tileLayer( 'https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw', 
            {
                maxZoom: 18,
                attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
                id: 'mapbox/streets-v11',
                tileSize: 512,
                zoomOffset: -1
            }),
        'Gray': L.tileLayer( 'https://{s}.tiles.wmflabs.org/bw-mapnik/{z}/{x}/{y}.png', {
                maxZoom: 18,
                attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            }),
        'OSM': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', 
            {
                maxZoom: 19,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }),
        'ESRI': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', 
            {
                attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            })
    }

    const defaultTilemap = cookies.get("selectedTilemap");
    let currentTilemap = defaultTilemap == "" ? "Mapnik" : defaultTilemap;

    // create the map and controls		
    _map = L.map('map', { 
        center: L.latLng(0,-1), // still in the water but far enough away from [0,0] so marker icons doesnt show when being created
        zoom: 16,
        attributionControl: false,
        zoomControl: false,
        layers: [ tilemapOptions[currentTilemap] ],
        touchZoom: "center"
    });

    // Controls for changing tilemap
    document.querySelectorAll(".tileMapSelector").forEach((selector: HTMLInputElement) => {
        selector.checked = currentTilemap == selector.id.substr(8);
        selector.addEventListener("click", (ev: MouseEvent) => {
            // remove previous tilemap
            _map.removeLayer(tilemapOptions[currentTilemap]);
            // add newly selected tilemap
            currentTilemap = selector.id.substr(8);
            _map.addLayer(tilemapOptions[currentTilemap]);
            cookies.set("selectedTilemap", currentTilemap, 99);
        });
    });

    // L.control.scale({ position: 'bottomright', maxWidth: 200 }).addTo(_map);
    //map.options.closePopupOnClick = true;

    // default color blue for Leaflet markers is #3388ff

    _initFocusOnButtons();

    // turn off focusOnMe or focusOnAll when user pans the map
    // some hackery here to detect whether the user or we programmatically
    // panned the map (same movestart event)
    const userPanDetector = function(e) {
        if (_focusMode != FocusMode.edit_plan) {
            setFocusMode(FocusMode.unset);
        }
    }
    _map.on("mousedown", userPanDetector);
    _map.on("touchbegin", userPanDetector);
    _map.on("drag", userPanDetector);

    // Double-click to add waypoint
    _map.on("dblclick",(e: L.LeafletMouseEvent) => {
        const plan = planManager.plans[me.current_waypoint.plan];
        if (plan != null && me.current_waypoint.index >= 0) {
            // if (_focusMode == FocusMode.unset) {
                const name = prompt("New Waypoint Name");
                if (name != null && name != "") {
                    plan.addWaypoint(name, [e.latlng]);
                }
            // }
        }
    });
}
