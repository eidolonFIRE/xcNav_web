import * as L from "leaflet";
import * as GeometryUtil from "leaflet-geometryutil";
import * as bootstrap  from "bootstrap";
import { getBounds, me } from "./pilots";
import * as client from "./client";
import * as flight from "./flightRecorder";
import { udpateInstruments } from "./instruments";
import { planManager } from "./flightPlan";
import * as cookies from "./cookies";
import { refreshAllMapMarkers } from "./flightPlanUI";
import * as api from "../../../server/src/ts/api";


export enum FocusMode {
    unset = 0,
    me,
    group,
    edit_plan,
}

let _focusMode: FocusMode = FocusMode.me;
let _map: L.Map;

let wp_dialog_geo: L.LatLng;


export function getMap(): L.Map {
    return _map;
}

function _updateViewModeRadioButton(mode: FocusMode) {
    const vm_me = document.getElementById("vm_me") as HTMLInputElement;
    const vm_group = document.getElementById("vm_group") as HTMLInputElement;

    vm_me.checked = mode == FocusMode.me;
    vm_group.checked = mode == FocusMode.group;
}

export function getFocusMode(): FocusMode {
    return _focusMode;
}

export function markersDraggable(): boolean {
    return _focusMode == FocusMode.unset || _focusMode == FocusMode.edit_plan;
}

export function setFocusMode(mode: FocusMode) {
    // DEBUG
    console.log("Set Focus Mode: ", mode);

    const plan = planManager.plans[me.current_waypoint.plan];
    if (plan != null && me.current_waypoint.index >= 0) {
        if (mode == FocusMode.edit_plan) {
            let b = L.latLngBounds(plan.plan.waypoints.map((wp) => {
                // TODO: support lines
                return wp.geo[0];
            }));
            b = b.pad(0.5);
            getMap().fitBounds(b);
        }
    }

    if (_focusMode != mode) {
        _focusMode = mode;

        _updateViewModeRadioButton(mode);
        refreshAllMapMarkers();
    }

    updateMapView();
}



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
    // Note: this is manual deep-copy to fix some copy-by-ref bugs
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
    me.updateAvgVario(event.coords, event.timestamp);
    me.updateGeoPos(geo, event.timestamp);
    const plan = planManager.plans[me.current_waypoint.plan];
    if (plan != null && me.current_waypoint.index >= 0) {
        plan.updateNextWpGuide();
    }

    if (flight.in_flight) me.updateFuel(event.timestamp);
    me.updateFuelRangeCircle();
    if (flight.in_flight) me.updateAvgSpeed(event.coords, event.timestamp);

    //
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
            _map.fitBounds(getBounds(), {maxZoom: 13});
            break;
        }
    }
}


export function setupMapUI(): void {
    const createMarkerDialog = document.getElementById("createMarkerDialog") as HTMLDivElement;
    const createMarkerDialog_modal = new bootstrap.Modal(createMarkerDialog);

    // Note: all the map tile sources have to be served from https
    const tilemapOptions = {
        'Mapnik': L.tileLayer( 'https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw', 
            {
                maxZoom: 17,
                attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
                id: 'mapbox/streets-v11',
                tileSize: 512,
                zoomOffset: -1
            }),
        'Gray': L.tileLayer( 'https://{s}.tiles.wmflabs.org/bw-mapnik/{z}/{x}/{y}.png', {
                maxZoom: 17,
                attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            }),
        'OSM': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', 
            {
                maxZoom: 17,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }),
        'ESRI': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', 
            {
                maxZoom: 17,
                attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            }),
        'Topo': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
                maxZoom: 17,
                attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
            })
    }

    // TODO: make airspace layer optional
    let openAIP = [
        L.tileLayer('https://{s}.tile.maps.openaip.net/geowebcache/service/tms/1.0.0/openaip_approved_airports@EPSG%3A900913@png/{z}/{x}/{y}.png', {
            attribution: '<a href="https://www.openaip.net/">openAIP Data</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-NC-SA</a>)',
            // minZoom: 4,
            maxZoom: 17,
            tms: true,
            detectRetina: true,
            subdomains: '12'
        }),
        L.tileLayer('https://{s}.tile.maps.openaip.net/geowebcache/service/tms/1.0.0/openaip_approved_airspaces_geometries@EPSG%3A900913@png/{z}/{x}/{y}.png', {
            attribution: '<a href="https://www.openaip.net/">openAIP Data</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-NC-SA</a>)',
            // minZoom: 4,
            maxZoom: 17,
            tms: true,
            detectRetina: true,
            subdomains: '12'
        }),        
        L.tileLayer('https://{s}.tile.maps.openaip.net/geowebcache/service/tms/1.0.0/openaip_approved_airspaces_labels@EPSG%3A900913@png/{z}/{x}/{y}.png', {
            attribution: '<a href="https://www.openaip.net/">openAIP Data</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-NC-SA</a>)',
            // minZoom: 4,
            maxZoom: 17,
            tms: true,
            detectRetina: true,
            subdomains: '12'
        }),
    ];

    const defaultTilemap = cookies.get("selectedTilemap");
    let currentTilemap = defaultTilemap == "" ? "Mapnik" : defaultTilemap;

    // create the map and controls		
    _map = L.map('map', { 
        center: L.latLng(0,-1), // still in the water but far enough away from [0,0] so marker icons doesnt show when being created
        zoom: 14,
        attributionControl: false,
        zoomControl: false,
        layers: [ tilemapOptions[currentTilemap] ],
        touchZoom: "center"
    });

    // Add airspaces to map
    _map.addLayer(tilemapOptions[currentTilemap]);
    openAIP.forEach(element => {
        _map.addLayer(element);
    });


    // Controls for changing tilemap
    document.querySelectorAll(".tileMapSelector").forEach((selector: HTMLInputElement) => {
        selector.checked = currentTilemap == selector.id.substr(8);
        selector.addEventListener("click", (ev: MouseEvent) => {
            // remove previous tilemap
            _map.removeLayer(tilemapOptions[currentTilemap]);
            // add newly selected tilemap
            currentTilemap = selector.id.substr(8);
            const new_baselayer = tilemapOptions[currentTilemap] as L.TileLayer;
            _map.addLayer(new_baselayer);
            new_baselayer.bringToBack();
            cookies.set("selectedTilemap", currentTilemap, 99);
        });
    });

    // L.control.scale({ position: 'bottomright', maxWidth: 200 }).addTo(_map);
    //map.options.closePopupOnClick = true;

    // turn off focusOnMe or focusOnAll when user pans the map
    // some hackery here to detect whether the user or we programmatically
    // panned the map (same movestart event)
    const userPanDetector = function(e) {
        if (_focusMode != FocusMode.edit_plan && _focusMode != FocusMode.unset) {
            setFocusMode(FocusMode.unset);
        }
    }
    _map.on("mousedown", userPanDetector);
    _map.on("touchbegin", userPanDetector);
    _map.on("drag", userPanDetector);

    _map.doubleClickZoom.disable(); 

    const marker_options_container = document.getElementById("marker_options_container") as HTMLDivElement;
    const wp_new_name = document.getElementById("wp_new_name") as HTMLInputElement;

    // Double-click to add waypoint
    _map.on("dblclick",(e: L.LeafletMouseEvent) => {
        const plan = planManager.plans[me.current_waypoint.plan];
        if (plan != null && (_focusMode == FocusMode.unset || _focusMode == FocusMode.edit_plan)) {
            wp_dialog_geo = e.latlng;
            // select default icon
            const default_marker = marker_options_container.querySelectorAll(`#marker_icon_${api.MarkerOptions[0]}`)[0] as HTMLInputElement;
            default_marker.checked = true;
            // reset input box
            wp_new_name.value = "";
            // show the dialog
            createMarkerDialog_modal.show();
        }
    });

    createMarkerDialog.addEventListener("shown.bs.modal", () => {
        wp_new_name.focus();
    });

    // Add Waypoint Dialog
    const wp_new_done = document.getElementById("wp_new_done") as HTMLButtonElement;
    function makeWaypoint() {
        const plan = planManager.plans[me.current_waypoint.plan];

        // check name good
        if (wp_new_name.value != "" && wp_new_name.value.length < 25) {
            // make new marker
            const marker = marker_options_container.querySelectorAll(".marker_rb:checked")[0] as HTMLInputElement;
            plan.addWaypoint(wp_new_name.value, [wp_dialog_geo], false, null, marker.id.substr(12));
            createMarkerDialog_modal.hide();
        }
    };
    wp_new_done.addEventListener("click", makeWaypoint);
    wp_new_name.addEventListener("keypress", (ev: KeyboardEvent) => {
        if (ev.key == "Enter") {
            makeWaypoint();
        }
    });


    // fill out mark options
    const template_marker = document.getElementById("templateMarkerSelector") as HTMLDivElement;
    const marker_name_regex = new RegExp("INSERTNAME", "ig");
    Object.values(api.MarkerOptions).forEach((name) => {
        // copy template
        let each_marker = template_marker.cloneNode(true) as HTMLDivElement;
        // modify
        each_marker.innerHTML = each_marker.innerHTML.replace(marker_name_regex, name);
        // copy all nodes in
        Object.values(each_marker.childNodes).forEach((node) => {
            marker_options_container.appendChild(node);
        })
    });

    // zoom controls
    const zoom_in = document.getElementById("zoom_in") as HTMLButtonElement;
    zoom_in.addEventListener("click", (ev: MouseEvent) => {
        _map.zoomIn(1);
        console.log("zoom in ", _map.getZoom())
    })
    const zoom_out = document.getElementById("zoom_out") as HTMLButtonElement;
    zoom_out.addEventListener("click", (ev: MouseEvent) => {
        _map.zoomOut(1);
        console.log("zoom in ", _map.getZoom())
    })

    // focus mode
    document.getElementById("vm_me").addEventListener("click", (ev: MouseEvent) => { setFocusMode(FocusMode.me) });
    document.getElementById("vm_group").addEventListener("click", (ev: MouseEvent) => { setFocusMode(FocusMode.group) }); 
}
