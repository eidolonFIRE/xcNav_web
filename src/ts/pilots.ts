import * as L from "leaflet";
import * as GeometryUtil from "leaflet-geometryutil";
import { $ } from "./util";
import * as chat from "./chat";
import { getMap } from "./mapUI";
import * as proto from "../proto/protocol";
import { make_uuid } from "./util";
import * as client from "./client";


export class LocalPilot {
    id: proto.ID;
    name: string;

    pos: L.LatLng;
    hdg: number;
    fuel: number;
    vel: number;

    marker: L.Marker;
    picture: string;
    color: string;
    path: L.Polyline;

    constructor(id: proto.ID, name: string) {
        this.id = id;
        this.name = name;
        this.pos = L.latLng(0, 0);
    }


    updatePos(newPos: L.LatLng) {
        // TODO: move all the telemetry calculation here
    }
}


class Me extends LocalPilot {
    _group: proto.ID;

    constructor() {
        super(proto.nullID, "me");

        // // grab username initially
        // if (localStorage.getItem("user_name") != null) {
        //     this.name = localStorage.getItem("user_name");
        //     this.id = localStorage.getItem("user_ID");
        //     this._group = localStorage.getItem("user_group");

        //     // TODO: verify group is still active in server (rejoin the group)
        // } else {
        //     // YOU NEED TO SET USERNAME!
        //     this.setName(prompt("Please enter your name"));
        // }

        // TEMPORARY: pick a random name
        this.name = make_uuid(4);
        this.id = make_uuid(10);
        this._group = proto.nullID;
    }


    setName(newName: string) {
        this.name = newName;
        this.id = make_uuid(10);
        this._group = proto.nullID;

        localStorage.setItem("user_name", this.name);
        localStorage.setItem("user_ID", this.id);
        localStorage.setItem("user_group", this._group);

        // TODO: TEMPORARY this should only be happening when connecting. It's here for now because in debug we can change name
        client.register();
    }

    group(newGroup: proto.ID = undefined): proto.ID {
        // optionally set the group
        if (newGroup != undefined) {
            this._group = newGroup;
            localStorage.setItem("user_group", this._group);
        }
        return this._group;
    }
}


// Everything about the user's identity
export let me = new Me();


// Local copy of pilots in flight group.
// Does not contain "me"
export let localPilots: LocalPilot[] = [];






// ---------------------------------------
// getBounds
//
// returns the rectangular bounds that
// circumscribes all pilots in the flight
// padded a little bit so you see map 
// a bit outside pilots for better context
// ---------------------------------------	
export function getBounds(): L.LatLngBounds {
    var pilotLatLngs = [];
    for( var i in localPilots ) {
        var p = localPilots[i];
        pilotLatLngs.push( [p.pos.lat, p.pos.lng] );
    }
    // https://leafletjs.com/reference-1.7.1.html#latlngbounds
    var bounds = L.latLngBounds( pilotLatLngs );
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

    if( !L.Browser.safari || !_evenClickOnMarker )
    {
        let id = e.target.pilotID;
        let msg = "";
        
        if( id == me.id )
        {
            msg = "Now why would you <br>click on yourself, <br>you vain beast ?";
        }
        else
        {
            let otherPilot = localPilots[id];
        
            let myLatLng = me.pos;
            let pilotLatLng = L.latLng( otherPilot.pos.lat, otherPilot.pos.lng );
        
            // BRAA
            // bearing is the angle between myPilots speed vector and the connecting line between 
            // myPilotLocation and other pilot location.
            // my speed vector = my loc + heading
            let bearing = L.GeometryUtil.bearing( myLatLng, pilotLatLng ); // in degrees clockwise
            let myHeading = me.hdg;
            let ooClock = bearing - myHeading;
            ooClock = (ooClock+360) % 360; // from [-180..180] -> [0..360]
            let oClock = Math.round(ooClock/30);
            oClock = (oClock==0 ? 12 : oClock);
        
            let range = L.GeometryUtil.length( [myLatLng, pilotLatLng] ); // in meters
            let meters2Miles = 0.000621371;
            range = range * meters2Miles;
        
            let altDiff = otherPilot.pos.alt - me.pos.alt;
            let high = (altDiff>100 ? 'high' : (altDiff<-100 ? 'low' : '') );
        
            let kmh2mph = 0.621371;
            let speed = (otherPilot.vel * kmh2mph).toFixed(0);
            msg = 
            "<div class='myPopups'>"
                + "<b>" + me.name + "</b><br>"
                + "is at your " + oClock + " o'clock " + high + " at " + range.toFixed(1) + " miles<br>"
                + "Speed: " + speed + " mph<br>" 
                + "Fuel: " + otherPilot.fuel + " L (1:37 / 30mi @ 3.9 L/h)"
            + "</div>";
        }
        
        e.target.setPopupContent( msg );
        if( L.Browser.safari )
            e.target.openPopup( e.target.getLatLng(), { 'maxWidth': 400 } );
    }
    _evenClickOnMarker = !_evenClickOnMarker;
    return true;
}



// ---------------------------------------
// _createFakePilot
// ---------------------------------------
export function _createFakePilot( id: string, name: string, color: string, picture: string ) {
    const map = getMap();
    let dim=48;
    // https://leafletjs.com/reference-1.7.1.html#icon
    let myIcon = L.icon({
        iconUrl: picture,
        iconSize: [dim, dim],
        iconAnchor: [dim/2, dim+4],
        popupAnchor: [0, -dim-2],  // RELATIVE to the icon anchor !!
        //shadowUrl: ...,
        //shadowAnchor: [34, 62]
    });
    let marker = L.marker([0,0], {icon: myIcon})
        .on( 'click', _markerClickHandler )
        .bindPopup( "" ) // this will be filled dynamically by _markerClickHandler
        .addTo(map);
    marker["pilotID"] = id;

    localPilots[id] = new LocalPilot(id, name);
    localPilots[id].color = color;
    localPilots[id].marker = marker;
    localPilots[id].picture = picture;
}



// ---------------------------------------
// _updatePilotHeadingPolyline
// ---------------------------------------
function _updatePilotHeadingPolyline( pilotInfo )
{		
    let headingVectorScreenSpaceLength = 100; // pixels
    
    let heading  = pilotInfo.telemetry.hdg;
    let latlng   = L.latLng( pilotInfo.telemetry.lat, pilotInfo.telemetry.lng );
    const map = getMap();
    
    let zoom = map.getZoom();
    let screenSpacePilotLocation = map.project( latlng, zoom );
    let screenSpaceHeadingVectorEnd = screenSpacePilotLocation;
    screenSpaceHeadingVectorEnd.x += headingVectorScreenSpaceLength; // pixels length of heading vector in screen coords
    let headingVectorTip = map.unproject( screenSpaceHeadingVectorEnd, zoom ); // same in latlng coordinates
    let distance = L.GeometryUtil.length( [ latlng, headingVectorTip ] ); // in real world meters
    
    // given speed+heading, compute offset from current lat,lng
    // https://makinacorpus.github.io/Leaflet.GeometryUtil/global.html#destination
    let dest = L.GeometryUtil.destination(latlng, heading, distance);
    
    let ll = [ latlng, dest ];

    if( !pilotInfo.headingPath )
    {
        pilotInfo.headingPath = L.polyline(
            ll,
            { 'color': pilotInfo.color, 'weight': 5 }
        )
        .addTo( map );
    } 
    else
        pilotInfo.headingPath.setLatLngs( ll );
}


// ---------------------------------------
// _updatePilotFlightPathPolyline
// ---------------------------------------
function _updatePilotFlightPathPolyline( pilotInfo, currentLatLng )
{
    const map = getMap();
    if( _pathsVisible )
    {
        if( !pilotInfo.path )
        {
            pilotInfo.path = L.polyline(
                currentLatLng,
                { 
                    'color': pilotInfo.color, 
                    'weight': 5, 
                    'opacity': 0.5,
                    dashArray: "10 10"
                }
            )
            .addTo(map);
        }
        pilotInfo.path.addLatLng( currentLatLng );
    }
}


// ---------------------------------------
// showPaths
// ---------------------------------------
let _pathsVisible = true;
export function showPaths( shown: boolean ): void {
    const map = getMap();
    if (!shown && _pathsVisible) { // they WERE visible and now they are not
        for (let id in localPilots) {
            localPilots[id].path.removeFrom(map);
            localPilots[id].path = null;
        }
    }
    _pathsVisible = shown;
}

// ---------------------------------------
// _processTelemetryUpdate
//
// update incoming pilot locations
// as a comms-efficient side effect we 
// also get any new messages and ADSB
// alarms since we last asked
// ---------------------------------------
function _processTelemetryUpdate( r: any )
{		
    let debugShowPilotTelemetry = 0;
    // TODO: wire back up
    let savedFuelLevelForDebugging = 0;
    // let savedFuelLevelForDebugging = getMyPilotInfo().telemetry.fuel;
                
    for( let i=0; i<r.pilots.length; i++ )
    {
        //console.log( "Updating : " + r.pilots[i].id );
        let updated = r.pilots[i];
        let current = localPilots[updated.id];
        for( var ii in updated )
        {
            // overwrite if it existed already in current
            // create if it did not yet
            current[ii] = updated[ii]; 
        }
        //console.log( current );
        //console.log( current.telemetry.lat + ", " + current.telemetry.lng + ", alt=" + current.telemetry.alt );
        let ll = L.latLng( current.pos.lat, current.pos.lng );
        current.marker.setLatLng( ll );

        // current.marker.setPopupContent( "...fuel...alt..." );
        
        // update each pilot's path
        // this will be too expensive memory and cpu wise for the map
        // in release but ok for debugging simulated paths
        _updatePilotFlightPathPolyline( current, ll );

        _updatePilotHeadingPolyline( current );
                    
        
        if( debugShowPilotTelemetry )
        {
            console.log(
                current.name.padEnd(17) + " (id " + updated.id + "): " +
                "[lat,lon,alt] = [" + current.pos.lat.toFixed(6) + ", " + current.pos.lng.toFixed(6) + ", " + current.pos.alt.toFixed(0) + "], hdg=" + ((current.hdg+360)%360)
                + "° vel=" + current.vel.toFixed(0) + "kmh/" + (current.vel*0.621371).toFixed(0)
                + "mph  fuel remaining: " + current.fuel.toFixed(1) + "L = " + (current.fuel*0.264172).toFixed(1) + "gl" 
            );
        }
    }
    if( debugShowPilotTelemetry )
        console.log( "---------------------------------------" );
    
    
    
    // so we can debug fuel level stuff: preserve fuel level locally (since we currently dont store on server)
    if( savedFuelLevelForDebugging!==undefined )
        me.fuel = savedFuelLevelForDebugging;
    
    // this will be moved eventually to: _G.mapUI._onLocationUpdate (see comments there)
    // TODO: wire back up
    // udpateTelemetry( getMyPilotInfo().telemetry );
    

    // TODO: moving map view is currently limited to the _onLocationUpdate function. This is subject to change as other pilot data updates
    // if we are focusing on my own or all pilots,
    // update the map location or bounds accordingly
    // const focusMode = getFocusMode();
    // const map = getMap();
    // if (focusMode == "all")
    // {
    // 	let bounds = getBounds();
    // 	map.fitBounds( bounds );
        
    // }
    // else if (focusMode == "me")
    // {
    // 	let ll = getMyPilotLatLng();
    // 	map.panTo([ll.lat, ll.lng]);
    // }
    
    // if we got a bunch of messages as a side effect of the telemetry update
    // it means we havent been in touch for a while (out of cell range etc.)
    chat.processAnyUnseenMessages( r.messages );
}




// ---------------------------------------
// setupPilots
// ---------------------------------------
import img_robert from "../img/pilotIcons/robert.png";
import img_caleb from "../img/pilotIcons/caleb.png";
import img_matt from "../img/pilotIcons/matt.png";
import img_adrien from "../img/pilotIcons/adrien.png";
import img_ki from "../img/pilotIcons/ki.png";

export function setupPilots(): void
{
    // _createFakePilot( "1", "Robert Seidl", 'orange', img_robert );
    // _createFakePilot( "2", "Caleb Johnson", 'blue', img_caleb );
    // _createFakePilot( "3", "Matt Cowan", 'green', img_matt );
    // _createFakePilot( "4", "Adrien Bernede", 'red', img_adrien );
    // _createFakePilot( "5", "Ki Steiner", 'magenta', img_ki );
    
    // set up the pilot you will be flying as (which can be changed later)
    // Note this is for debugging and working with fake pilots only
    // Eventually the "Who am I" question will be answered with a login
    // for now, we also store the selected pilot (if user does actually
    // select one via the "Fly as" #selectPilot option) will be
    // persistently saved. Even across browser app restarts

    const button = document.getElementById("RenamePilot") as HTMLButtonElement;
    button.addEventListener("click", () => {
        const name = prompt("Choose new name");
        console.log("Setting name to", name);
        me.setName(name);
    });
    
}

