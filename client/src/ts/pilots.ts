import * as L from "leaflet";
import * as GeometryUtil from "leaflet-geometryutil";
import { RotatedMarker } from "leaflet-marker-rotation";

import red_arrow from "../img/red_arrow.png";

import { colors, randInt, geoTolatlng } from "./util";
import { getMap } from "./mapUI";
import * as api from "../../../server/src/ts/api";
import * as client from "./client";
import * as cookies from "./cookies";
import { getAvatar, updateContact, updateInviteLink } from "./contacts";
import { in_flight } from "./flightRecorder";
import { mean } from "lodash";

export class LocalPilot {
    // basic info
    id: api.ID
    name: string

    // telemetry
    geoPos: GeolocationCoordinates
    fuel: number

    // visuals
    marker: L.Marker
    avatar: string
    color: string
    path: L.Polyline

    // Flightplan
    current_waypoint: api.WaypointSelection


    constructor(id: api.ID, name: string, avatar="") {
        this.id = id;
        this.name = name;
        this.color = colors[randInt(0, colors.length)];
        this.fuel = 0;
        this.avatar = avatar;

        this.current_waypoint = {
            plan: "me",
            index: -1,
            name: null,
        }
    }

    updateMarker(geoPos: GeolocationCoordinates) {
        if (this.marker == null) {
            // pilot avatar icon
            const dim = 40;
            const myIcon = L.icon({
                iconUrl: getAvatar(this.id),
                iconSize: [dim, dim],
                iconAnchor: [dim/2, dim/2],
                popupAnchor: [0, -dim-2],  // RELATIVE to the icon anchor !!
                //shadowUrl: ...,
                //shadowAnchor: [34, 62]
                className: ".pilot-avatar-icon",

            });
            this.marker = L.marker([geoPos.latitude, geoPos.longitude], {icon: myIcon})
                .on('click', _markerClickHandler)
                .bindPopup("") // this will be filled dynamically by _markerClickHandler
                .addTo(getMap());
        } else {
            this.marker.setLatLng([geoPos.latitude, geoPos.longitude]);
        }
    }

    updateGeoPos(geoPos: GeolocationCoordinates) {
        // update markers
        this.updateMarker(geoPos);

        // append to track
        if (this.path == null) {
            // init the line
            this.path = L.polyline([[geoPos.latitude, geoPos.longitude], [geoPos.latitude, geoPos.longitude]], 
                {color: this.color, weight: 5, opacity: 0.5, dashArray: "10 10"}).addTo(getMap());
        } else {
            // append to travel line (10 meter min spacing)
            const prev_point = this.path.getLatLngs()[this.path.getLatLngs().length - 1];
            if (geoTolatlng(geoPos).distanceTo(prev_point as L.LatLng) > 10) {
                this.path.addLatLng([geoPos.latitude, geoPos.longitude]);
            }
        }

        // update position
        this.geoPos = geoPos;
    }

    // this is not called for "me"
    updateTelemetry(tel: api.Telemetry, timestamp: api.Timestamp) {
        this.fuel = tel.fuel;
        this.updateGeoPos(tel.geoPos);
    }
}


class Me extends LocalPilot {
    _group: api.ID
    marker: RotatedMarker
    secret_id: api.ID

    _last_fuel_update: api.Timestamp
    _last_fuel_saved: api.Timestamp
    last_fuel_adjustment: api.Timestamp
    fuelBurnRate: number

    avgSpeedSamples: number[]
    avgSpeed: number

    fuelRangeCircle: L.Circle

    constructor() {
        super(cookies.get("me.public_id"), cookies.get("me.name"));
        this.secret_id = cookies.get("me.secret_id");
        this.group = cookies.get("me.group");
        this.avatar = localStorage.getItem("me.avatar");
        const _loaded_fuel = cookies.get("me.fuel");
        this.fuel = _loaded_fuel == "" ? 0.0 : Number(_loaded_fuel);

        this.color = "red";

        this._last_fuel_update = null;
        this._last_fuel_saved = null;
        this.last_fuel_adjustment = null;
        // TODO: default 4L/hr for now
        this.fuelBurnRate = 4.0;

        this.avgSpeedSamples = [];
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
        cookies.set("me.name", this.name, 9999);
    }

    setAvatar(newAvatar: string) {
        this.avatar = newAvatar;
        localStorage.setItem("me.avatar", newAvatar);
    }

    set group(group_id: api.ID) {
        this._group = group_id;
        if (group_id == api.nullID || group_id == null) {
            console.log("Left Group");
            updateInviteLink(this.id);

            // disable the leave group button
            const leaveGroupBtn = document.getElementById("leaveGroupBtn") as HTMLButtonElement;
            leaveGroupBtn.disabled = true;
        } else {
            console.log("Joined Group", group_id);
            updateInviteLink(group_id);

            // enable the leave group button
            const leaveGroupBtn = document.getElementById("leaveGroupBtn") as HTMLButtonElement;
            leaveGroupBtn.disabled = false;
        }
        cookies.set("me.group", group_id, 2);
        
        // request group info
        if (group_id != api.nullID) {
            client.requestGroupInfo(group_id);
        }
    }

    get group(): api.ID {
        return this._group;
    }

    updateFuel(timestamp: api.Timestamp) {
        if (this._last_fuel_update != null && in_flight) {
            // L/hr * msec * (1sec/1000msec) * (1hr/3600sec)
            this.fuel -= this.fuelBurnRate * (timestamp - this._last_fuel_update) / 3600000;
            
            // save fuel level every so often
            if (this._last_fuel_saved == null || (timestamp - this._last_fuel_saved) > 3600) {
                cookies.set("me.fuel", this.fuel.toFixed(2), 1);
                this._last_fuel_saved = timestamp;
            }
        }
        this._last_fuel_update = timestamp;
    }

    updateFuelRangeCircle() {
        if (me.fuel > 0 && this.avgSpeed > 0) {
            const radius = this.fuel / this.fuelBurnRate * this.avgSpeed * 3600;
            if (this.fuelRangeCircle == null) {
                // make new circle
                console.log("make circle", radius);
                this.fuelRangeCircle = L.circle(geoTolatlng(this.geoPos), radius, 
                    { 
                        // stroke: true,
                        color: "red",
                        weight: 15,
                        opacity: 0.6,
                        // lineCap?: LineCapShape;
                        // lineJoin?: LineJoinShape;
                        // dashArray?: string | number[];
                        // dashOffset?: string;
                        fill: false,
                        // fillColor?: string;
                        // fillOpacity?: number;
                        // fillRule?: FillRule;
                        // renderer?: Renderer;
                        // className?: string;
                    }).addTo(getMap());
                // this.fuelRangeCircle;
            } else {
                // update circle
                console.log("update circle", radius);
                this.fuelRangeCircle.setLatLng(geoTolatlng(this.geoPos)).setRadius(radius);
            }
        } else {
            // hide circle
            if (this.fuelRangeCircle != null) {
                console.log("remove circle");
                getMap().removeLayer(this.fuelRangeCircle);
                this.fuelRangeCircle = null;
            }
        }
    }

    updateAvgSpeed(geo: GeolocationCoordinates, timestamp: api.Timestamp) {
        this.avgSpeedSamples.push(geo.speed);
        if (this.avgSpeedSamples.length > 20) {
            this.avgSpeedSamples.splice(1);
        }
        this.avgSpeed = mean(this.avgSpeedSamples);
    }
}


// Everything about the current user's identity
export let me = new Me();


// Local copy of pilots in flight group.
// Does not contain "me"
export const localPilots: Record<api.ID, LocalPilot> = {};



export function hasLocalPilot(pilot_id: api.ID): boolean {
    return Object.keys(localPilots).indexOf(pilot_id) >= 0;
}



export function processNewLocalPilot(pilot: api.PilotMeta) {
    if (Object.keys(localPilots).indexOf(pilot.id) > -1) {
        // update local copy of pilot we already know
        localPilots[pilot.id].name = pilot.name;
        localPilots[pilot.id].avatar = pilot.avatar;
    } else {
        // new-to-us pilot
        // console.log("New Remote Pilot", pilot);
        localPilots[pilot.id] = new LocalPilot(pilot.id, pilot.name, pilot.avatar);
    }

    // update contacts list
    updateContact(pilot);
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
    return bounds.pad(0.5);
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
