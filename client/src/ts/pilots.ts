import * as L from "leaflet";
import * as GeometryUtil from "leaflet-geometryutil";
import { RotatedMarker } from "leaflet-marker-rotation";
import { $, colors, randInt, make_uuid, geoTolatlng } from "./util";
import { getMap } from "./mapUI";
import * as api from "../../../api/src/api";
import * as client from "./client";
import * as cookies from "./cookies";
import red_arrow from "../img/red_arrow.png";

export class LocalPilot {
    // basic info
    id: api.ID;
    name: string;

    // telemetry
    geoPos: GeolocationCoordinates;
    fuel: number;

    // visuals
    marker: L.Marker;
    picture: string;
    color: string;
    path: L.Polyline;
    circle: L.Circle;

    constructor(id: api.ID, name: string) {
        this.id = id;
        this.name = name;
        this.color = colors[randInt(0, colors.length)];
        this.fuel = 0;
    }

    updateMarker(geoPos: GeolocationCoordinates) {
        if (this.marker == null) {
            // let dim=48;
            // TODO: add pilot avatars back in here
            // https://leafletjs.com/reference-1.7.1.html#icon
            // let myIcon = L.icon({
            //     iconUrl: this.picture,
            //     iconSize: [dim, dim],
            //     iconAnchor: [dim/2, dim+4],
            //     popupAnchor: [0, -dim-2],  // RELATIVE to the icon anchor !!
            //     //shadowUrl: ...,
            //     //shadowAnchor: [34, 62]
            // });
            this.marker = L.marker([geoPos.latitude, geoPos.longitude]) // {icon: myIcon}
                .on('click', _markerClickHandler)
                .bindPopup("") // this will be filled dynamically by _markerClickHandler
                .addTo(getMap());
        } else {
            this.marker.setLatLng([geoPos.latitude, geoPos.longitude]);
        }
    }

    updateAccuracyCircle(geoPos: GeolocationCoordinates) {
        if (this.circle == null) {
            this.circle = L.circle([geoPos.latitude, geoPos.longitude], 1, { stroke: false })
                .addTo(getMap());
        } else {
            this.circle.setLatLng([geoPos.latitude, geoPos.longitude]).setRadius(geoPos.accuracy / 2);
        }
    }

    updateGeoPos(geoPos: GeolocationCoordinates) {
        // update markers
        this.updateMarker(geoPos);
        this.updateAccuracyCircle(geoPos);

        // append to track
        if (this.path == null) {
            // init the line
            this.path = L.polyline([[geoPos.latitude, geoPos.longitude], [geoPos.latitude, geoPos.longitude]], 
                {color: this.color, weight: 5, opacity: 0.5, dashArray: "10 10"}).addTo(getMap());
        } else {
            // TODO: don't add to path if point is very close to previous
            this.path.addLatLng([geoPos.latitude, geoPos.longitude]);
        }

        // update position
        this.geoPos = geoPos;
    }

    // this is not called for "me"
    updateTelemetry(tel: api.Telemetry) {
        this.fuel = tel.fuel;
        this.updateGeoPos(tel.geoPos);
    }
}


class Me extends LocalPilot {
    _group: api.ID
    marker: RotatedMarker
    secret_id: api.ID

    constructor() {
        super(cookies.get("me.public_id"), cookies.get("me.name"));
        this.secret_id = cookies.get("me.secret_id");

        if (me.name == "") {
            // YOU NEED TO SET USERNAME!
            this.setName(prompt("Please enter your name"));
        }

        this._group = api.nullID;
        this.color = "red";
    }

    updateMarker(geoPos: GeolocationCoordinates) {
        // our icon is a special rotated marker
        if (this.marker == null) {
            this.marker = new RotatedMarker([geoPos.latitude, geoPos.longitude], {
                // : "center center",
                rotationAngle: geoPos.heading,
                rotationOrigin: "center center",
                icon: L.icon({
                    iconUrl: red_arrow,
                    iconSize: [40, 40],  // [256, 256]

                }),
            }).addTo(getMap());

        } else {
            this.marker.setLatLng([geoPos.latitude, geoPos.longitude]);
            this.marker.setRotationAngle(geoPos.heading);
        }
    }

    setName(newName: string) {
        this.name = newName;
        this.id = make_uuid(10);
        this._group = api.nullID;

        localStorage.setItem("user_name", this.name);
        localStorage.setItem("user_ID", this.id);
        localStorage.setItem("user_group", this._group);

        // TODO: should call "UpdateProfileRequest"
        // client.register();
    }

    group(newGroup: api.ID = undefined): api.ID {
        // optionally set the group
        if (newGroup != undefined) {
            this._group = newGroup;
            localStorage.setItem("user_group", this._group);
        }
        return this._group;
    }
}


// Everything about the current user's identity
export let me = new Me();


// Local copy of pilots in flight group.
// Does not contain "me"
export let localPilots: Record<api.ID, LocalPilot> = {};


export function processNewLocalPilot(pilot: api.PilotMeta) {
    if (Object.keys(localPilots).indexOf(pilot.id) > -1) {
        // TODO: update pilot we already know
    } else {
        // new-to-us pilot
        localPilots[pilot.id] = new LocalPilot(pilot.id, pilot.name);
    }
}


// ---------------------------------------
// getBounds
//
// returns the rectangular bounds that
// circumscribes all pilots in the flight
// padded a little bit so you see map 
// a bit outside pilots for better context
// ---------------------------------------	
export function getBounds(): L.LatLngBounds {
    const pilotLatLngs = [];
    // consider our location
    if (me.geoPos != null) pilotLatLngs.push( [me.geoPos.latitude, me.geoPos.longitude] );
    // consider location of all pilots
    Object.keys(localPilots).forEach((pilot_id: api.ID) => {
        const p = localPilots[pilot_id];
        if (p.geoPos != null) {
            pilotLatLngs.push( [p.geoPos.latitude, p.geoPos.longitude] );
        }
    });
    if (pilotLatLngs.length == 0) {
        // can't have empty list
        pilotLatLngs.push([0,0]);
    }
    // https://leafletjs.com/reference-1.7.1.html#latlngbounds
    const bounds = L.latLngBounds( pilotLatLngs );
    return bounds.pad(0.22);
}


// ---------------------------------------
// pilot marker click handler (show popup with their current telemetry)
// ---------------------------------------
let _evenClickOnMarker = false;
function _markerClickHandler(e) {
    // on safari we get called twice for each marker click
    // (probably a Leaflet bug)
    // if we dont mitigate, first click opens popup
    // and second click immediately closes it
    // so we fake open it up a third time, thus keeping it up

    if (!L.Browser.safari || !_evenClickOnMarker) {
        let id = e.target.pilotID;
        let msg = "";
        
        if (id == me.id) {
            msg = "Now why would you <br>click on yourself, <br>you vain beast ?";
        } else {
            let otherPilot = localPilots[id];
        
            let myLatLng = geoTolatlng(me.geoPos)
            let pilotLatLng = L.latLng(otherPilot.geoPos.latitude, otherPilot.geoPos.longitude);
        
            // BRAA
            // bearing is the angle between myPilots speed vector and the connecting line between 
            // myPilotLocation and other pilot location.
            // my speed vector = my loc + heading
            let bearing = L.GeometryUtil.bearing( myLatLng, pilotLatLng ); // in degrees clockwise
            let ooClock = bearing - me.geoPos.heading;
            ooClock = (ooClock+360) % 360; // from [-180..180] -> [0..360]
            let oClock = Math.round(ooClock/30);
            oClock = (oClock==0 ? 12 : oClock);
        
            let range = L.GeometryUtil.length( [myLatLng, pilotLatLng] ); // in meters
            let meters2Miles = 0.000621371;
            range = range * meters2Miles;
        
            let altDiff = otherPilot.geoPos.altitude - me.geoPos.altitude;
            let high = (altDiff>100 ? 'high' : (altDiff<-100 ? 'low' : '') );
        
            let kmh2mph = 0.621371;
            let speed = (otherPilot.geoPos.speed * kmh2mph).toFixed(0);
            msg = 
            "<div class='myPopups'>"
                + "<b>" + me.name + "</b><br>"
                + "is at your " + oClock + " o'clock " + high + " at " + range.toFixed(1) + " miles<br>"
                + "Speed: " + speed + " mph<br>" 
                + "Fuel: " + otherPilot.fuel + " L (1:37 / 30mi @ 3.9 L/h)"
            + "</div>";
        }
        
        e.target.setPopupContent( msg );
        if( L.Browser.safari ) e.target.openPopup( e.target.getLatLng(), { 'maxWidth': 400 } );
    }
    _evenClickOnMarker = !_evenClickOnMarker;
    return true;
}
