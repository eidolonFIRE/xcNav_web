import * as L from "leaflet";
import * as GeometryUtil from "leaflet-geometryutil";
import { getBounds, me } from "./pilots";
import { $, km2Miles, kmh2mph, meters2Feet } from "./util";
import * as client from "./client";
import * as flight from "./flightRecorder";
import * as api  from "../../../api/src/api";
import { udpateInstruments } from "./instruments";
import { myPlan } from "./flightPlan";


// Leaflet sticks a couple extra bonus members into the coord object provided to the 
// _onLocationUpdate handler
// https://developer.mozilla.org/en-US/docs/Web/API/GeolocationCoordinates
class LGeolocationCoordinates extends GeolocationCoordinates {
    readonly latlng: L.LatLng;
    readonly bounds: L.LatLngBounds;
};

enum FocusMode {
    unset = 0,
    me,
    group,
}

let _focusMode: FocusMode;
let _focusOnMeButton: HTMLButtonElement;
let _focusOnAllButton: HTMLButtonElement;

let _evenClickOnMarker = false;

let _layerAssociations: any;
let _layers: any;
let _layerLookup: any;
let _layerCheckBoxesClickHandler: any;
let _layerSelectors: any;

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

export function setFocusMode(mode: FocusMode) {
    _focusMode = mode;
    _setButtonActive(_focusOnMeButton, mode == FocusMode.me);
    _setButtonActive(_focusOnAllButton, mode == FocusMode.group);
    updateMapView();
}

function _initFocusOnButtons() {	
    // view mode handlers
    $( "#focusOnMe" ).onclick= function() { setFocusMode(FocusMode.me) };
    $( "#focusOnAll" ).onclick= function() { setFocusMode(FocusMode.group) };		

    // initialize button to desired state
    _focusOnMeButton = $("#focusOnMe");
    _focusOnAllButton = $("#focusOnAll");
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
    client.sendTelemetry({msec: event.timestamp}, geo, me.fuel);

    // record locally
    flight.geoEvent(event);

    // update my telemetry
    me.updateGeoPos(geo);
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



/*	----------------------------------------------------------------------------
**	_initLayerSelectorUI
**
**	---------------------------------------------------------------------------*/		
function _initLayerSelectorUI(): void {
    // ========================================================
    //  baselayer and overlay layer checkboxes
    //  these appear in the slide in / offcanvas "#mainMenu"
    //  wire them up to switch baselayers and 
    //  toggle overlay layers as appropriate
    // ========================================================

    _layerAssociations = [
        [ "Mapnik", "baseLayerMapnik" ],
        [ "Gray",   "baseLayerGray" ],
        [ "OSM",    "baseLayerOSM" ],
        [ "ESRI",   "baseLayerESRI" ],
        [ "airspaceLayer",   "displayAirspace" ],

    ];
    _layerLookup = {};
    for( let ass in _layerAssociations )
    {
        let lass = _layerAssociations[ass];
        let layer = _layers[lass[0]];
        let uniqueID = L.Util.stamp(layer);
        $("#"+lass[1]).layerid =  uniqueID;
        _layerLookup[uniqueID] = layer;
    }

    // wire up the map layer checkboxes in the main menu
    _layerCheckBoxesClickHandler = function( e ) {
        $("input[class*='layerSelector']").forEach( function( val, index, o ) {
            let layer = _layerLookup[val.layerid];

            if (val.checked && !_map.hasLayer( layer ) ) {
                _map.addLayer( layer ); 
            } else
            if(!val.checked && _map.hasLayer( layer ) ) {
                _map.removeLayer( layer );
            }
        });
    };

    _layerSelectors = $(" #mainMenuForm .layerSelector" );
    //for( let l in _layerSelectors )
    //	_layerSelectors[l].onclick = _layerCheckBoxesClickHandler;		
}



export function createMarker(geo: L.LatLng[]) {
    // TODO: support all geometry
    if (geo.length == 1) {
        return L.marker(geo[0]);
    }
    else return null;
}



/*	----------------------------------------------------------------------------
**	overlaysReady
**
**	called from the overlays object once it has the layers locked and loaded
**	---------------------------------------------------------------------------*/		
export function overlaysReady( airspaceLayer: L.Layer ): void {
    // create overlay layers 
    // eventually these will be loaded from server once 
    // • location is known (for airspace overlay)
    // • user selected specific flight plan
    _layers['airspaceLayer']   = airspaceLayer;

    _map.addLayer( airspaceLayer );
    
    // this is a bit janky
    // map UI initialization (mostly done in this object's init)
    // cant complete for layers until we have those
    // and those get inited in the overlays object which gets inited
    // after the mapUI object. So we call back here to set the layers
    // and finish off MapUI initialiation...
    // This should be improved.
    _initLayerSelectorUI();
}


export function setupMapUI(): void {

    // Note: all the map tile sources have to be served from https
    _layers = {
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

    // create the map and controls		
    _map = L.map('map', { 
        center: L.latLng(0,-1), // still in the water but far enough away from [0,0] so marker icons doesnt show when being created
        zoom: 16,
        attributionControl: false,
        zoomControl: false,
        layers: [ _layers.Mapnik ],
        touchZoom: "center"
    });
    L.control.scale({ position: 'bottomright', maxWidth: 200 }).addTo(_map);
    //map.options.closePopupOnClick = true;

    // default color blue for Leaflet markers is #3388ff

    // fixes leaflet library bundling bug where path to default icon is wrong
    // https://stackoverflow.com/questions/41144319/leaflet-marker-not-found-production-env

    _initFocusOnButtons();

    // turn off focusOnMe or focusOnAll when user pans the map
    // some hackery here to detect whether the user or we programmatically
    // panned the map (same movestart event)
    let userPanDetector = function(e) {
        setFocusMode(FocusMode.unset);
    }
    _map.on( "mousedown", userPanDetector );
    _map.on( "touchbegin", userPanDetector );

    // handle click on it to open fuel left dialog
    // fuel display in the upper right telemetry panel on the map
    let fuelUpdateHandler = function( e ) {
        let label: string = e.target.innerText;
        let fuelRemaining: number = parseInt( label );
        
        if( label.slice(-1)== '½')
            fuelRemaining += 0.5; // label was something like "4½"
        
        me.fuel = fuelRemaining;
        
        console.log( "Fuel remaining: " + fuelRemaining + " L" );
        // now what do we do with fuelRemaining :)  ?
    };
    // wire up the various fuel levels in the fuel left dialog
    let fuelLevels = $(" #fuelLeftDialog label");
    for( let level=0; level<fuelLevels.length; level++ )
        fuelLevels[level].onclick = fuelUpdateHandler;


    // Double-click to add waypoint
    _map.on("dblclick",(e: L.LeafletMouseEvent) => {
        if (_focusMode == FocusMode.unset) {
            const name = prompt("New Waypoint Name");
            if (name != null && name != "") {
                myPlan.addWaypoint(name, e.latlng);
            }
        }
    });
}
