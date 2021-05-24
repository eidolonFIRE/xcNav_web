import * as L from "leaflet";
import * as GeometryUtil from "leaflet-geometryutil";
import { $ } from "./util";
import { getLastMessage, setLastMessage, processAnyUnseenMessages } from "./messages";
import { request } from "./API";
import { getFocusMode, getMap, udpateTelemetry } from "./mapUI";




let _pilots = {};
let _myPilotID: number = 1;
let _intervalTimer: number = 0;
let _locationQueryInterval: number = 1; // seconds between subsequent location queries to server for other pilots info


// ---------------------------------------
// updateMyTelemetry
//
// this is called from the _G.mapUI._onLocationUpdate event handler
// ---------------------------------------
export function updateMyTelemetry( telemetry )
{
	// receive lat,lng,alt,hdg,vel,fuel 
	// https://leafletjs.com/reference-1.7.1.html#locationevent

	// and trigger a telemetry update to server
	// athough we should probably decouple updating our own stuff 
	// (more frequently on map) than sending up to server
	// eg we do not control frequency of update via
	// 	_map.locate( gpsOptions );
	// see also gpsOptions https://leafletjs.com/reference-1.7.1.html#locate-options
	// maximumAge, timeout
	// for example, every second a local GPS update
	// every 10 seconds a telemetry update
	
	// per 
	// https://developer.mozilla.org/en-US/docs/Web/API/GeolocationCoordinates
	//
	// If speed is 0, heading is NaN. 
	// If the device is unable to provide heading information, this value is null.
	// altitudeAccuracy may be null
	// altitude may be null
	
	// for now/debugging, just update fuel level
	_pilots[ _myPilotID ].telemetry.fuel = telemetry.fuel;
}



// ---------------------------------------
// getMyPilotID
// ---------------------------------------
export function getMyPilotID()
{
	return _myPilotID;
}



// ---------------------------------------
// setMyPilotID
// ---------------------------------------
export function setMyPilotID( id )
{
	id = parseInt(id);
	if( id<1 || id>5 )
	{
		console.log( "Error: for debugging, pilot IDs must be 1..5" );
		return;
	}
	_myPilotID = id;
}


// ---------------------------------------
// getMyPilotLatLng
// ---------------------------------------
export function getMyPilotLatLng(): L.LatLng
{
	return L.latLng( _pilots[ _myPilotID ].telemetry.lat,    _pilots[ _myPilotID ].telemetry.lng );
}



// ---------------------------------------
// getMyPilotInfo
// ---------------------------------------
export function getMyPilotInfo()
{
	return _pilots[ _myPilotID ];
}

// ---------------------------------------
// getPilotInfo
// ---------------------------------------
export function getPilotInfo( pilotID )
{
	return _pilots[ pilotID ];
}


// ---------------------------------------
// getBounds
//
// returns the rectangular bounds that
// circumscribes all pilots in the flight
// padded a little bit so you see map 
// a bit outside pilots for better context
// ---------------------------------------	
export function getBounds(): L.LatLngBounds
{
	var pilotLatLngs = [];
	for( var i in _pilots )
	{
		var p = _pilots[i];
		pilotLatLngs.push( [p.telemetry.lat, p.telemetry.lng] );
	}
	// https://leafletjs.com/reference-1.7.1.html#latlngbounds
	var bounds = L.latLngBounds( pilotLatLngs );
	return bounds.pad(0.22);
}



// ---------------------------------------
// simulateLocations
//
// this is the main "tickle the server for data"
// trigger at the moment, every _locationQueryInterval
// call the server with a telemetry update
// ---------------------------------------
export function simulateLocations( yes )    
{
	let timer = _intervalTimer;

	if( yes )
	{
		if(timer != 0)
			clearInterval( timer );
		_intervalTimer = window.setInterval( _updatePilots, _locationQueryInterval * 1000 );
	}
	else
	{
		clearInterval( timer);
		_intervalTimer = 0;
	}
}



// ---------------------------------------
// pilot marker click handler (show popup with their current telemetry)
// ---------------------------------------
let _evenClickOnMarker = false;
function _markerClickHandler( e )
{
	// on safari we get called twice for each marker click
	// (probably a Leaflet bug)
	// if we dont mitigate, first click opens popup
	// and second click immediately closes it
	// so we fake open it up a third time, thus keeping it up

	if( !L.Browser.safari || !_evenClickOnMarker )
	{
		let id = e.target.pilotID;
		let msg = "";
		
		if( id == _myPilotID )
		{
			msg = "Now why would you <br>click on yourself, <br>you vain beast ?";
		}
		else
		{
			let name = _pilots[ id ].name;
			let telemetry = _pilots[ id ].telemetry;
			let myID = _myPilotID;
		
			let myLatLng = getMyPilotLatLng();
			let pilotLatLng = L.latLng( telemetry.lat, telemetry.lng );
		
			// BRAA
			// bearing is the angle between myPilots speed vector and the connecting line between 
			// myPilotLocation and other pilot location.
			// my speed vector = my loc + heading
			let bearing = L.GeometryUtil.bearing( myLatLng, pilotLatLng ); // in degrees clockwise
			let myHeading = _pilots[ myID ].telemetry.hdg;
			let ooClock = bearing - myHeading;
			ooClock = (ooClock+360) % 360; // from [-180..180] -> [0..360]
			let oClock = Math.round(ooClock/30);
			oClock = (oClock==0 ? 12 : oClock);
		
			let range = L.GeometryUtil.length( [myLatLng, pilotLatLng] ); // in meters
			let meters2Miles = 0.000621371;
			range = range * meters2Miles;
		
			let altDiff = telemetry.alt - _pilots[ myID ].telemetry.alt;
			let high = (altDiff>100 ? 'high' : (altDiff<-100 ? 'low' : '') );
		
			let kmh2mph = 0.621371;
			let speed = (telemetry.vel * kmh2mph).toFixed(0);
			msg = 
			"<div class='myPopups'>"
				+ "<b>" + name + "</b><br>"
				+ "is at your " + oClock + " o'clock " + high + " at " + range.toFixed(1) + " miles<br>"
				+ "Speed: " + speed + " mph<br>" 
				+ "Fuel: " + telemetry.fuel + " L (1:37 / 30mi @ 3.9 L/h)"
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
function _createFakePilot( id: number, name: string, color: string, picture: string ): void
{
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

	_pilots[id] = { 'id':id, 'name': name, 'color':color, 'marker':marker, 'picture':picture, 'telemetry': {}  };
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
export function showPaths( shown: boolean ): void
{
	const map = getMap();
	if( !shown && _pathsVisible ) // they WERE visible and now they are not
	{
		for ( let id in _pilots ) 
		{
			_pilots[id].path.removeFrom(map);
			_pilots[id].path = null;
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
	let savedFuelLevelForDebugging = getMyPilotInfo().telemetry.fuel;
	
	setLastMessage(r.lastMessage);	// this goes back up to server in next call	
				
	for( let i=0; i<r.pilots.length; i++ )
	{
		//console.log( "Updating : " + r.pilots[i].id );
		let updated = r.pilots[i];
		let current = _pilots[updated.id];
		for( var ii in updated )
		{
			// overwrite if it existed already in current
			// create if it did not yet
			current[ii] = updated[ii]; 
		}
		//console.log( current );
		//console.log( current.telemetry.lat + ", " + current.telemetry.lng + ", alt=" + current.telemetry.alt );
		let ll = L.latLng( current.telemetry.lat, current.telemetry.lng );
		current.marker.setLatLng( ll );

		// current.marker.setPopupContent( "...fuel...alt..." );
		
		// update each pilot's path
		// this will be too expensive memory and cpu wise for the map
		// in release but ok for debugging simulated paths
		_updatePilotFlightPathPolyline( current, ll );

		_updatePilotHeadingPolyline( current );
					
		
		if( debugShowPilotTelemetry )
		{
			let t = current.telemetry;
			console.log(
				current.name.padEnd(17) + " (id " + updated.id + "): " +
				"[lat,lon,alt] = [" + t.lat.toFixed(6) + ", " + t.lng.toFixed(6) + ", " + t.alt.toFixed(0) + "], hdg=" + ((t.hdg+360)%360)
				+ "° vel=" + t.vel.toFixed(0) + "kmh/" + (t.vel*0.621371).toFixed(0)
				+ "mph  fuel remaining: " + t.fuel.toFixed(1) + "L = " + (t.fuel*0.264172).toFixed(1) + "gl" 
			);
		}
	}
	if( debugShowPilotTelemetry )
		console.log( "---------------------------------------" );
	
	
	
	// so we can debug fuel level stuff: preserve fuel level locally (since we currently dont store on server)
	if( savedFuelLevelForDebugging!==undefined )
		_pilots[ _myPilotID ].telemetry.fuel = savedFuelLevelForDebugging;
	
	// this will be moved eventually to: _G.mapUI._onLocationUpdate (see comments there)
	udpateTelemetry( getMyPilotInfo().telemetry );
	
	
	// if we are focusing on my own or all pilots,
	// update the map location or bounds accordingly
	const focusMode = getFocusMode();
	const map = getMap();
	if (focusMode == "all")
	{
		let bounds = getBounds();
		map.fitBounds( bounds );
		
	}
	else if (focusMode == "me")
	{
		let ll = getMyPilotLatLng();
		map.panTo([ll.lat, ll.lng]);
	}
	
	// if we got a bunch of messages as a side effect of the telemetry update
	// it means we havent been in touch for a while (out of cell range etc.)
	processAnyUnseenMessages( r.messages );
}




// ---------------------------------------
// _stopFurtherAPICalls
// ---------------------------------------
export function stopFurtherAPICalls()
{
	console.log( "Turning off further API calls. You can turn back on with 'Sim'd locations' checkbox." );				
	simulateLocations( false );
	$("#simLocations").checked = false;
}




// ---------------------------------------
// _updatePilots
//
// this is the main periodic API call
// to the server. It send up our current
// telemetry info to record on the server
// 
// as a side effect (so we dont have to make separate
// API calls) we conveniently get back
// 1. all pilots telemetry (so we can update markers etc.)
// 2. any new messages
// 3. any new ADSB alarms
// 
// ---------------------------------------
function _updatePilots()
{
	let requestData = {
		'api': 1,
		'method' : 'update',
		'query': {
			'entity': 'telemetry',
			'id' : getMyPilotID(),
			'lastMessage': getLastMessage(),
			'telemetry' : 
			{
				'lat': 37,
				'lng': -122,
				'alt': 300,  // meters
				'hdg': 220,  // degrees
				'vel': 20,   // kmh
				'fuel': 4.5  // L
			}
		}
	};
	request( requestData, _processTelemetryUpdate );				
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
	_createFakePilot( 1, "Robert Seidl", 'orange', img_robert );
	_createFakePilot( 2, "Caleb Johnson", 'blue', img_caleb );
	_createFakePilot( 3, "Matt Cowan", 'green', img_matt );
	_createFakePilot( 4, "Adrien Bernede", 'red', img_adrien );
	_createFakePilot( 5, "Ki Steiner", 'magenta', img_ki );
	
	// set up the pilot you will be flying as (which can be changed later)
	// Note this is for debugging and working with fake pilots only
	// Eventually the "Who am I" question will be answered with a login
	// for now, we also store the selected pilot (if user does actually
	// select one via the "Fly as" #selectPilot option) will be
	// persistently saved. Even across browser app restarts
	
	let preferredPilotID = parseInt(localStorage.getItem('preferredPilotID' ));
	if( preferredPilotID!==null && preferredPilotID<=5 /* used for fake pilots only */ )
		$('#selectPilot option[value="' + preferredPilotID + '"]').selected = true;

	// lets also init the pilot name from the html so if someone changes it there
	// they will automatically be set up correctly
	setMyPilotID( $("#selectPilot").value );


	$("#selectPilot").onchange = function( e )
	{
		setMyPilotID( this.value );
		localStorage.setItem('preferredPilotID', this.value );
	};
	
}

