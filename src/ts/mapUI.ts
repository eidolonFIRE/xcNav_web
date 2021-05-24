import * as L from "leaflet";

import { updateMyTelemetry, getMyPilotLatLng, getBounds, showPaths } from "./pilots";
import { $ } from "./util";


// Leaflet sticks a couple extra bonus members into the coord object provided to the 
// _onLocationUpdate handler
// https://developer.mozilla.org/en-US/docs/Web/API/GeolocationCoordinates
class LGeolocationCoordinates extends GeolocationCoordinates {
	readonly latlng: L.LatLng;
	readonly bounds: L.LatLngBounds;
};


// ========================================================
//  map buttons (focus on me, focus on all)
// ========================================================

let _focusOnMe: boolean;
let _focusOnAll: boolean;
let _focusOnMeButton: HTMLButtonElement;
let _focusOnAllButton: HTMLButtonElement;

let _evenClickOnMarker = false;

let _layerAssociations: any;
let _layers: any;
let _layerLookup: any;
let _layerCheckBoxesClickHandler: any;
let _layerSelectors: any;
let _userInitiatedPan: any;

let _map: L.Map;

let _myLocMarker;
let _myLocCircle;
let _mySpeedLine;
let _myPath;
let _firstLocation;


export function getMap() {
	return _map;
}


// called from map when user pans
function loseFocus(): void
{
	if( _focusOnMe )
		_setButtonActive( _focusOnMeButton, false );
	if( _focusOnAll )
		_setButtonActive( _focusOnAllButton, false );
}

export function getFocusMode(): string {
	if (_focusOnMe) {
		return "me";
	} else if (_focusOnAll) {
		return "all";
	} else {
		return "na";
	}
}

function _isButtonActive(button: HTMLButtonElement): boolean
{
	return button.classList.contains( "active" );
}

function _setButtonActive(button: HTMLButtonElement, yes: boolean)
{
	if( yes )
		button.classList.add( "active" );
	else
		button.classList.remove( "active" );
	switch( button.id )
	{
		case "focusOnMe":  _focusOnMe = yes; break;
		case "focusOnAll": _focusOnAll = yes; break;
	}
}

function _initFocusOnButtons()
{	
	// install click handler for focusOnMe button
	$( "#focusOnMe" ).onclick= function()
	{
		let active: boolean = _isButtonActive( this );
		_focusOnMe = active;
		_setButtonActive( _focusOnMeButton, active );
		if( active ) // if focusOnMe, focusOnAll cannot be on at the same time
		{
			_setButtonActive( _focusOnAllButton, false );
			_focusOnAll = false;
		}
		if( active )
		{
			let ll: L.LatLng = getMyPilotLatLng();
			_map.panTo( [ll.lat, ll.lng] );
		}
	}

	// install click handler for focusOnAll button
	$( "#focusOnAll" ).onclick= function(e)
	{
		let active: boolean = _isButtonActive( this );
		_focusOnAll = active;
		if( active ) // if focusOnAll, focusOnMe cannot be on at the same time
		{
			_setButtonActive( _focusOnMeButton, false );
			_focusOnMe = false;
		}
		if( active )
		{
			let bounds: L.LatLngBounds = getBounds();
			_map.fitBounds( bounds );
		}
	}		

	// initialize button to desired state
	_focusOnMeButton = $("#focusOnMe");
	_focusOnAllButton = $("#focusOnAll");
	// read whatever the Bootstrap UI was set up with
	_focusOnMe = _isButtonActive( _focusOnMeButton );
	_focusOnAll = _isButtonActive( _focusOnAllButton );
}






/*	----------------------------------------------------------------------------
**	updateSpeedVector
**
**	if speed & heading are available, draw a red line showing where we are headed
**	scaling of that line may need some more work
**	The line should be same length for a given speed regardless of 
**	current level of display zoom 
**	---------------------------------------------------------------------------*/		
function _updateSpeedVector(position: L.LocationEvent)
{
	if( _mySpeedLine )
		_mySpeedLine.remove(); // get rid of existing
	
	if( position.speed )
	{
		// https://github.com/makinacorpus/Leaflet.GeometryUtil
		let endPoint = L.GeometryUtil.destination( position.latlng, position.heading, (2+position.speed) * 10 );
		let latlngs = [ position.latlng, endPoint ];

		_mySpeedLine = L.polyline( latlngs, {color: '#3388ff', weight: 2 } ).addTo(_map);
	}
}


/*	----------------------------------------------------------------------------
**	updateFlightPath
**
**	---------------------------------------------------------------------------*/		
function _updateFlightPath(position: L.LatLng)
{
	if( _myPath==null )
	{
		let latlngs = [ position, position ];
		_myPath = L.polyline( latlngs, {color: 'blue'} ).addTo(_map);
	}
	else
	{
		// should filter here whether to add point to the path
		// eg. if too close to last, why bother or too soon after last etc.
		_myPath.addLatLng( position );
	}
}


// bug in leaflet: marker click handlers are called twice for each click
// eliminate the second call 
function _markerClickHandler(e)
{
	if( _evenClickOnMarker )
	{
		console.log( "You clicked this marker:" );
		console.log( e.target );

		e.target.openPopup( e.target.getLatLng() );
	}
	_evenClickOnMarker = !_evenClickOnMarker;
	return true;
}



/*	----------------------------------------------------------------------------
**	onFirstLocation
**
**	This is only called once 
**	---------------------------------------------------------------------------*/		
function _onFirstLocation(position: L.LatLng)
{
	_firstLocation = false;
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
function _onLocationUpdate(e: L.LocationEvent) 
{
	// position details:
	// https://leafletjs.com/reference-1.7.1.html#locationevent
	// includes hdg, vel, alt, timestamp
	// package up and send to updateMyTelemetry( position )

	if( _firstLocation )
		_onFirstLocation( e.latlng );

	let radius: number = e.accuracy / 2;

	// update my own location marker and location accuracy circle
	_myLocMarker.setLatLng( e.latlng );
	//bindPopup("You are within " + radius + " meters from this point").openPopup();
	_myLocCircle.setLatLng( e.latlng ).setRadius( radius );

	// update flight path
	_updateFlightPath( e.latlng );

	// update speed & direction vector
	_updateSpeedVector( e );
	
	
	/*
	let telemetry = {
		'lat': etc.
	}
	updateMyTelemetry( telemetry );
	*/
	
	// process our telemetry display
	// this should be done here but for debugging is done in _processTelemetryUpdate
	// as that occurs much more frequently during debugging on desktops
	// and also has more interesting = changing data
	// but should be moved here...
	// updateTelemetry( telemetry );
}




//	----------------------------------------------------------------------------
//  udpateTelemetry
//  the 4 telemetry panels at the top of the screen
//	----------------------------------------------------------------------------
export function udpateTelemetry( telemetry )
{
	let meters2Feet = 3.28084;
	let kmh2mph = 0.621371;
	let km2Miles = 0.621371;
	$("#telemetrySpd").innerText = (telemetry.vel * kmh2mph).toFixed(0);
	$("#telemetryHdg").innerText = ((telemetry.hdg+360)%360).toFixed(0);
	$("#telemetryAlt").innerText = (telemetry.alt * meters2Feet).toFixed(0);
	$("#telemetryFuel").innerText = telemetry.fuel.toFixed(1);
	
	let col = "#0E6EFD"; // regular button blue
	if( telemetry.fuel < 2 )
		col = "red";
	else if( telemetry.fuel < 4 ) // should be "fuel needed to get to LZ ?"
		col = "orange";
	$("#fuelBingoPanel").style.backgroundColor = col;
	
	
	let estFuelBurn: number = 4;  // L/h
	let timeLeft: number  = telemetry.fuel / estFuelBurn * 60; // L / L/h => h -> minutes
	timeLeft = Math.floor( timeLeft );
	let hours = Math.floor( timeLeft/60 );
	let minutes = timeLeft - 60*hours;
	let extraZero = minutes<10 ? '0' : '';
	let displayTimeLeft = (hours>0 ? hours.toString() : '' ) + ':' + extraZero + minutes.toString();
	let rangeLeft = (telemetry.vel * timeLeft / 60) * km2Miles;     // km/h * h -> km -> mi
	$("#fuelEstimates").innerHTML = displayTimeLeft + " / " + rangeLeft.toFixed(0) + "mi<br>@ " + estFuelBurn.toFixed(1) + "L/h";
}

/*	----------------------------------------------------------------------------
**	onLocationError
**
**	if user disabled location or precision location in browser/privacy settings
**	or page is called without https
**	---------------------------------------------------------------------------*/		
function _onLocationError( error ): void
{
	//console.error( "onlocationError: " + error.message );
	if( error.code==error.PERMISSION_DENIED )
		alert( "You need to permit location access or this won't work !" );
}



/*	----------------------------------------------------------------------------
**	_initLayerSelectorUI
**
**	---------------------------------------------------------------------------*/		
function _initLayerSelectorUI(): void
{
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
		[ "flightPlanLayer", "displayFlightPlan" ]

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
	_layerCheckBoxesClickHandler = function( e ) 
	{
		$("input[class*='layerSelector']").forEach( function( val, index, o ) 
		{
			let layer = _layerLookup[val.layerid];

			if( val.checked && !_map.hasLayer( layer ) ) {
				_map.addLayer( layer ); 
			} else
			if( !val.checked && _map.hasLayer( layer ) ) {
				_map.removeLayer( layer );
			}
		});
	};

	_layerSelectors = $(" #mainMenuForm .layerSelector" );
	//for( let l in _layerSelectors )
	//	_layerSelectors[l].onclick = _layerCheckBoxesClickHandler;		
}



/*	----------------------------------------------------------------------------
**	overlaysReady
**
**	called from the overlays object once it has the layers locked and loaded
**	---------------------------------------------------------------------------*/		
export function overlaysReady( airspaceLayer: L.Layer, flightPlanLayer: L.Layer ): void
{
	// create overlay layers 
	// eventually these will be loaded from server once 
	// • location is known (for airspace overlay)
	// • user selected specific flight plan
	_layers['airspaceLayer']   = airspaceLayer;
	_layers['flightPlanLayer'] = flightPlanLayer;
	_map.addLayer( airspaceLayer );
	_map.addLayer( flightPlanLayer );
	
	// this is a bit janky
	// map UI initialization (mostly done in this object's init)
	// cant complete for layers until we have those
	// and those get inited in the overlays object which gets inited
	// after the mapUI object. So we call back here to set the layers
	// and finish off MapUI initialiation...
	// This should be improved.
	_initLayerSelectorUI();
}
	
	/*	----------------------------------------------------------------------------
	**	createFakeFlightPaths
	**
	**  this was just used to debug random flight path generation function visually
	**  the actual code now lives in php on the server side (API.php)
	**  leaving this in here for now in case we need to mod the fake path function
	**	---------------------------------------------------------------------------*/		
/*
	createFakeFlightPaths = function()
	{
		let myRandom = function()
		{
			return Math.random()*2 - 1; // centered, -1..1
		}
		
		// thats about a 15km radius circle
		// 95km circumference, flying at 40 kmh (25mph) => 2.3 hours, 150 mins
		let radiusLng = 0.172858;
		let radiusLat = 0.12685;
		
		let latMul = radiusLat/radiusLng;
		
		let oneKmLng = radiusLng/15;
		
		let centerLng = -121.862581;
		let centerLat = 37.309138;
		
		let nrPilots = 3;
		
		let colors = [ 'aqua', 'black', 'blue', 'fuchsia', 'gray', 'grey', 'green', 'lime', 
					'maroon', 'navy', 'olive', 'purple', 'red', 'silver', 'teal', 'yellow' ];
		
		for( i=0; i<nrPilots; i++ )
		{
			let col = colors[Math.floor(Math.random() * colors.length)];	
			let latLngs = [];
			
			let centerRandomizer = oneKmLng * 2;
			let cLng = centerLng + myRandom() * centerRandomizer; 
			let cLat = centerLat + myRandom() * centerRandomizer* latMul;
			let twoPi = 2*Math.PI;
			let nDivs = 100;
			let phase = 20; // max degrees random offset 
			phase = myRandom() * twoPi / 360 * phase;
			
			let wobblesPerFullCircle = 10;
			let wobblePeriodRandomizer = 1 + myRandom()/6;
			let wobblePhaseRandomizer = twoPi * myRandom();
			
			

			for( rad=0; rad<twoPi * .8; rad+=twoPi/nDivs  )
			{
				let radiusWobble = 1 + Math.sin(rad * wobblesPerFullCircle * wobblePeriodRandomizer + wobblePhaseRandomizer) * oneKmLng / radiusLng;
				
				latLngs.push( [
					cLat + (radiusLng * Math.sin( rad+phase ) * radiusWobble ) * latMul,
					cLng +  radiusLng * Math.cos( rad+phase ) * radiusWobble
				])
			}

			L.polyline( latLngs, {color: col, weight:6} )
				.addTo(_map);
		}
		

		let dim=48;
		let myIcon = L.icon({
			iconUrl: 'img/pilotIcons/robert.png',
			iconSize: [dim, dim],
			iconAnchor: [dim/2, dim],
			popupAnchor: [dim/2, 0]
		});
		L.marker([centerLat,centerLng], {icon: myIcon})
			.bindPopup( "Yes so this is nice" ).openPopup()
			.addTo(_map);
	}
*/
	

export function setupMapUI(): void
{

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
	let dummyLatLng = L.latLng(0,0); 
	let mapCenter = L.latLng( 37.38954470818328, -122.20101912499997 );
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


	// display a prominent red "!DEV!" onscreen if we are running the gpsDEV.php vs the "release" gps.php
	// other "DEV only stuff" can be if'd w runningDVEV
	const _runningDEV = window.location.pathname.indexOf( 'DEV' )!==-1;
	if( _runningDEV )
	{
		$( '#dev' ).style.visibility= 'visible';
	}


	// fixes leaflet library bundling bug where path to default icon is wrong
	// https://stackoverflow.com/questions/41144319/leaflet-marker-not-found-production-env


	// TODO : for now we dont need the ExtraMarkers, revisit if we do. If not, get rid of this
/* 
	// ExtraMarkers library provides access to all fontawesome icons, very handy for differentiating
	// between different states (eg on ground, flying) and different pilots (colors) and different 
	// markers (LZs, POIs, vs pilots)
	// https://github.com/coryasilva/Leaflet.ExtraMarkers#icons
	let ppg = L.ExtraMarkers.icon({
		icon:			'fa-number',	// https://fontawesome.com/icons?d=gallery&p=1
		number:		 	'me',
		iconColor:		'white',		// 'white',
		markerColor:	'blue',	  	// if you set svg: true, you can also use "#3388ff" etc here
		shape:			'circle',		// 'circle', 'square', 'star', or 'penta'
		prefix:		 	'fa'				// 'fa', 'fas' for fontawesome SVG, '' if icon: 'fa-number'
	});
*/
	_myLocMarker = L.marker( dummyLatLng )
	//.bindPopup( "This is your location and accuracy circle.<br>On a phone you can see your direction and speed as a vector.<br>If you start moving around on a paramotor, 1wheel or bike, you will see this marker move and your path is shown." )
	.addTo(_map);

	// stuff for displaying own location marker, accuracy circle and the direction&speed vector
	_myLocCircle = L.circle( dummyLatLng, 1, { stroke: false } )
		.addTo(_map);
	_mySpeedLine = null;	// will be created & updated when we actually have location data
	_myPath = null;		// will be created & updated when we actually have location data
	_firstLocation = true;	// used to zoom map to current location once


	// get location gathering started
	_map.on('locationfound', _onLocationUpdate);
	_map.on('locationerror', _onLocationError);
	// https://leafletjs.com/reference-1.7.1.html#locate-options
	const gpsOptions = {
		//setView: true, 
		maxZoom: 15,
		enableHighAccuracy: true,
		watch: true	 // i.e.update location continuously
	};
	_map.locate( gpsOptions );


	//_map.on( "contextmenu", function( e ) {console.log('context menu');} );
	_initFocusOnButtons();


	// turn off focusOnMe or focusOnAll when user pans the map
	// some hackery here to detect whether the user or we programmatically
	// panned the map (same movestart event)
	_userInitiatedPan = false;
	_map.on( "movestart", function( e ) 
	{
		if( _userInitiatedPan )
			loseFocus(); 
		_userInitiatedPan = false;
	});
	let userPanDetector = function( e )
	{
		_userInitiatedPan = true;
	}
	_map.on( "mousedown", userPanDetector );
	_map.on( "touchbegin", userPanDetector );
	
	

	// handle click on it to open fuel left dialog
	// fuel display in the upper right telemetry panel on the map
	let fuelUpdateHandler = function( e ) 
	{
		let label: string = e.target.innerText;
		let fuelRemaining: number = parseInt( label );
		
		if( label.slice(-1)== '½')
			fuelRemaining += 0.5; // label was something like "4½"
		
		let telemetry = {
			'fuel': fuelRemaining
		}
		updateMyTelemetry( telemetry );
		
		console.log( "Fuel remaining: " + fuelRemaining + " L" );
		// now what do we do with fuelRemaining :)  ?
	};
	// wire up the various fuel levels in the fuel left dialog
	let fuelLevels = $(" #fuelLeftDialog label");
	for( let level=0; level<fuelLevels.length; level++ )
		fuelLevels[level].onclick = fuelUpdateHandler;


	let showPathFunction = showPaths;
	$("#displayPaths").onchange = function( e )
	{
		let showThem = e.target.checked;
		showPathFunction( showThem );
	}
	showPaths( $("#displayPaths").checked ); // cant call pilots when they are inited AFTER mapUI
}
