/*

	some of the local vars get set inside of private functions, for example
	
	this._initFocusOnButtons = function()

			this.focusOnMe  = function() { return this._focusOnMe; }
			this.focusOnAll = function() { return this._focusOnAll; }
			// called from map when user pans
			this.loseFocus  = function()

			this._isButtonActive = function( button )
			this._setButtonActive = function( button, yes )
			this._focusOnMeButton = $("#focusOnMe");
			this._focusOnAllButton = $("#focusOnAll");
			this._focusOnMe = this._isButtonActive( this._focusOnMeButton );
			this._focusOnAll = this._isButtonActive( this._focusOnAllButton );

	this._updateSpeedVector = function( position )
	this._updateFlightPath = function( position )
	this._evenClickOnMarker = false;
	this._markerClickHandler = function( e )

	function h( e ) { G.mapUI._markerClickHandler( e ) }
	this._onFirstLocation = function( position )
	this._onLocationUpdate = function( position ) 
	this.udpateTelemetry = function( telemetry )
	this._onLocationError = function( error )
	this._initLayerSelectorUI = function()
	this.overlaysReady = function( airspaceLayer, flightPlanLayer )
	this._layers = {
	this._map = L.map('map', { 
	this._runningDEV = window.location.pathname.includes( 'DEV' );
	this._myLocCircle = L.circle( dummyLatLng, 1, { stroke: false } )
		.addTo(this._map);
	this._myLocMarker = L.marker( dummyLatLng, { icon: ppg } )
		//.bindPopup( "This is your location and accuracy circle.<br>On a phone you can see your direction and speed as a vector.<br>If you start moving around on a paramotor, 1wheel or bike, you will see this marker move and your path is shown." )
		.on( "click", h )
		.addTo(this._map);
	this._mySpeedLine = null;	// will be created & updated when we actually have location data
	this._myPath = null;		// will be created & updated when we actually have location data
	this._firstLocation = true;	// used to zoom map to current location once


	// get location gathering started
	this._userInitiatedPan = false;

	this._init = function()



These are the public ones:
type LLObject object;

	focusOnMe: ( void ) => boolean;
	focusOnAll: ( void ) => boolean;
	loseFocus: ( void ) => void;
	udpateTelemetry: ( telemetry: object ) => void
	overlaysReady: ( airspaceLayer: LLObject, flightPlanLayer: LLObject ) => void



*/


type Leaflet = any; // not going to map out all leaflet types
let L: Leaflet;
type LatLng = number[];
type LatLngBounds = number[];
type LLayer = any;

// https://developer.mozilla.org/en-US/docs/Web/API/GeolocationCoordinates
class LGeolocationCoordinates extends GeolocationCoordinates {
	readonly latlng: LatLng;
	readonly bounds: LatLngBounds;
};


// ========================================================
//  map buttons (focus on me, focus on all)
// ========================================================

function MapUI()
{

	this._initFocusOnButtons = function()
	{
		this.focusOnMe  = function() : boolean { return this._focusOnMe; }
		this.focusOnAll = function() : boolean  { return this._focusOnAll; }
	
		// called from map when user pans
		this.loseFocus  = function() : void
		{
			if( G.mapUI._focusOnMe )
				G.mapUI._setButtonActive( G.mapUI._focusOnMeButton, false );
			if( this._focusOnAll )
				G.mapUI._setButtonActive( G.mapUI._focusOnAllButton, false );
		}
		
		
		// install click handler for focusOnMe button
		$( "#focusOnMe" ).onclick= function()
		{
			let active: boolean = G.mapUI._isButtonActive( this );
			G.mapUI._focusOnMe = active;
			G.mapUI._setButtonActive( G.mapUI._focusOnMeButton, active );
			if( active ) // if focusOnMe, focusOnAll cannot be on at the same time
			{
				G.mapUI._setButtonActive( G.mapUI._focusOnAllButton, false );
				G.mapUI._focusOnAll = false;
			}
			if( active )
			{
				let ll: LatLng = G.pilots.getMyPilotLatLng();
				G.map.panTo( ll );
			}
		}

		// install click handler for focusOnAll button
		$( "#focusOnAll" ).onclick= function(e)
		{
			let active: boolean = G.mapUI._isButtonActive( this );
			G.mapUI._focusOnAll = active;
			if( active ) // if focusOnAll, focusOnMe cannot be on at the same time
			{
				G.mapUI._setButtonActive( G.mapUI._focusOnMeButton, false );
				G.mapUI._focusOnMe = false;
			}
			if( active )
			{
				let bounds: LatLngBounds = G.pilots.getBounds();
				G.map.fitBounds( bounds );
			}
		}		

		this._isButtonActive = function( button )
		{
			return button.classList.contains( "active" );
		}

		this._setButtonActive = function( button, yes )
		{
			if( yes )
				button.classList.add( "active" );
			else
				button.classList.remove( "active" );
			switch( button.id )
			{
				case "focusOnMe":  this._focusOnMe = yes; break;
				case "focusOnAll": this._focusOnAll = yes; break;
			}
		}


		// initialize button to desired state
		this._focusOnMeButton = $("#focusOnMe");
		this._focusOnAllButton = $("#focusOnAll");
		// read whatever the Bootstrap UI was set up with
		this._focusOnMe = this._isButtonActive( this._focusOnMeButton );
		this._focusOnAll = this._isButtonActive( this._focusOnAllButton );

	}






	/*	----------------------------------------------------------------------------
	**	updateSpeedVector
	**
	**	if speed & heading are available, draw a red line showing where we are headed
	**	scaling of that line may need some more work
	**	The line should be same length for a given speed regardless of 
	**	current level of display zoom 
	**	---------------------------------------------------------------------------*/		
	this._updateSpeedVector = function( position: LGeolocationCoordinates )
	{
		if( G.mapUI._mySpeedLine )
			G.mapUI._mySpeedLine.remove(); // get rid of existing
		
		if( position.speed )
		{
			// https://github.com/makinacorpus/Leaflet.GeometryUtil
			let endPoint = L.GeometryUtil.destination( position.latlng, position.heading, (2+position.speed) * 10 );
			let latlngs = [ position.latlng, endPoint ];

			G.mapUI._mySpeedLine = L.polyline( latlngs, {color: '#3388ff', weight: 2 } ).addTo(G.mapUI._map);
		}
	}


	/*	----------------------------------------------------------------------------
	**	updateFlightPath
	**
	**	---------------------------------------------------------------------------*/		
	this._updateFlightPath = function( position: LGeolocationCoordinates )
	{
		if( G.mapUI._myPath==null )
		{
			let latlngs = [ position.latlng, position.latlng ];
			G.mapUI._myPath = L.polyline( latlngs, {color: 'blue'} ).addTo(G.mapUI._map);
		}
		else
		{
			// should filter here whether to add point to the path
			// eg. if too close to last, why bother or too soon after last etc.
			G.mapUI._myPath.addLatLng( position.latlng );
		}
	}


	// bug in leaflet: marker click handlers are called twice for each click
	// eliminate the second call 
	this._evenClickOnMarker = false;
	this._markerClickHandler = function( e )
	{
		if( G.mapUI._evenClickOnMarker )
		{
			console.log( "You clicked this marker:" );
			console.log( e.target );

			e.target.openPopup( e.target.getLatLng() );
		}
		G.mapUI._evenClickOnMarker = !G.mapUI._evenClickOnMarker;
		return true;
	}



	/*	----------------------------------------------------------------------------
	**	onFirstLocation
	**
	**	This is only called once 
	**	---------------------------------------------------------------------------*/		
	this._onFirstLocation = function( position: GeolocationCoordinates )
	{
		G.mapUI._firstLocation = false;
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
	this._onLocationUpdate = function( position: LGeolocationCoordinates ) 
	{
		// position details:
 		// https://leafletjs.com/reference-1.7.1.html#locationevent
		// includes hdg, vel, alt, timestamp
		// package up and send to G.pilots.updateMyTelemetry( position )
	
		if( G.mapUI._firstLocation )
			G.mapUI._onFirstLocation( position );

		let radius: number = position.accuracy / 2;
	
		// update my own location marker and location accuracy circle
		G.mapUI._myLocMarker.setLatLng( position.latlng );
		//bindPopup("You are within " + radius + " meters from this point").openPopup();
		G.mapUI._myLocCircle.setLatLng( position.latlng ).setRadius( radius );
	
		// update flight path
		G.mapUI._updateFlightPath( position );

		// update speed & direction vector
		G.mapUI._updateSpeedVector( position );
		
		
		/*
		let telemetry = {
			'lat': etc.
		}
		G.pilots.updateMyTelemetry( telemetry );
		*/
		
		// process our telemetry display
		// this should be done here but for debugging is done in G.pilots._processTelemetryUpdate
		// as that occurs much more frequently during debugging on desktops
		// and also has more interesting = changing data
		// but should be moved here...
		// G.mapUI.updateTelemetry( telemetry );
	}




	//	----------------------------------------------------------------------------
	//  udpateTelemetry
	//  the 4 telemetry panels at the top of the screen
	//	----------------------------------------------------------------------------
	this.udpateTelemetry = function( telemetry )
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
	this._onLocationError = function( error ): void
	{
		//console.error( "onlocationError: " + error.message );
		if( error.code==error.PERMISSION_DENIED )
			alert( "You need to permit location access or this won't work !" );
	}
	
	
	
	/*	----------------------------------------------------------------------------
	**	_initLayerSelectorUI
	**
	**	---------------------------------------------------------------------------*/		
	this._initLayerSelectorUI = function(): void
	{
		// ========================================================
		//  baselayer and overlay layer checkboxes
		//  these appear in the slide in / offcanvas "#mainMenu"
		//  wire them up to switch baselayers and 
		//  toggle overlay layers as appropriate
		// ========================================================

		this._layerAssociations = [
			[ "Mapnik", "baseLayerMapnik" ],
			[ "Gray",   "baseLayerGray" ],
			[ "OSM",    "baseLayerOSM" ],
			[ "ESRI",   "baseLayerESRI" ],
			[ "airspaceLayer",   "displayAirspace" ],
			[ "flightPlanLayer", "displayFlightPlan" ]
	
		];
		this._layerLookup = {};
		for( let ass in this._layerAssociations )
		{
			let lass = this._layerAssociations[ass];
			let layer = this._layers[lass[0]];
			let uniqueID = L.Util.stamp(layer);
			$("#"+lass[1]).layerid =  uniqueID;
			this._layerLookup[uniqueID] = layer;
		}

		// wire up the map layer checkboxes in the main menu
		this._clickHandler = function( e ) 
		{
			$("input[class*='layerSelector']").forEach( function( val, index, o ) 
			{
				let layer = G.mapUI._layerLookup[val.layerid];
	
				if( val.checked && !G.mapUI._map.hasLayer( layer ) ) {
					G.mapUI._map.addLayer( layer ); 
				} else
				if( !val.checked && G.mapUI._map.hasLayer( layer ) ) {
					G.mapUI._map.removeLayer( layer );
				}
			});
		};
	
		this._layerSelectors = $(" #mainMenuForm .layerSelector" );
		for( let l in this._layerSelectors )
			this._layerSelectors[l].onclick = this._clickHandler;		
	}
	
	
	
	/*	----------------------------------------------------------------------------
	**	overlaysReady
	**
	**	called from the overlays object once it has the layers locked and loaded
	**	---------------------------------------------------------------------------*/		
	this.overlaysReady = function( airspaceLayer: LLayer, flightPlanLayer: LLayer ): void
	{
		// create overlay layers 
		// eventually these will be loaded from server once 
		// • location is known (for airspace overlay)
		// • user selected specific flight plan
		G.mapUI._layers['airspaceLayer']   = airspaceLayer;
		G.mapUI._layers['flightPlanLayer'] = flightPlanLayer;
		G.map.addLayer( airspaceLayer );
		G.map.addLayer( flightPlanLayer );
		
		// this is a bit janky
		// map UI initialization (mostly done in this object's init)
		// cant complete for layers until we have those
		// and those get inited in the overlays object which gets inited
		// after the mapUI object. So we call back here to set the layers
		// and finish off MapUI initialiation...
		// This should be improved.
		G.mapUI._initLayerSelectorUI();
	}
	
	/*	----------------------------------------------------------------------------
	**	createFakeFlightPaths
	**
	**  this was just used to debug random flight path generation function visually
	**  the actual code now lives in php on the server side (API.php)
	**  leaving this in here for now in case we need to mod the fake path function
	**	---------------------------------------------------------------------------*/		
/*
	this.createFakeFlightPaths = function()
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
				.addTo(this._map);
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
			.addTo(this._map);
	}
*/
	

	this._init = function() : void
	{

		// Note: all the map tile sources have to be served from https
		this._layers = {
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
		this._map = L.map('map', { 
			center: L.latLng(0,-1), // still in the water but far enough away from [0,0] so marker icons doesnt show when being created
			zoom: 16,
			attributionControl: false,
			zoomControl: false,
			layers: [ this._layers.Mapnik ],
			touchZoom: "center"
		});
		L.control.scale({ position: 'bottomright', maxWidth: 200 }).addTo(this._map);
		//map.options.closePopupOnClick = true;

		// default color blue for Leaflet markers is #3388ff


		// display a prominent red "!DEV!" onscreen if we are running the gpsDEV.php vs the "release" gps.php
		// other "DEV only stuff" can be if'd w runningDVEV
		this._runningDEV = window.location.pathname.indexOf( 'DEV' )!==-1;
		if( this._runningDEV )
		{
			$( '#dev' ).style.visibility= 'visible';
		}



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


		// stuff for displaying own location marker, accuracy circle and the direction&speed vector
		this._myLocCircle = L.circle( dummyLatLng, 1, { stroke: false } )
			.addTo(this._map);
		this._myLocMarker = L.marker( dummyLatLng, { icon: ppg } )
			//.bindPopup( "This is your location and accuracy circle.<br>On a phone you can see your direction and speed as a vector.<br>If you start moving around on a paramotor, 1wheel or bike, you will see this marker move and your path is shown." )
			.addTo(this._map);
		this._mySpeedLine = null;	// will be created & updated when we actually have location data
		this._myPath = null;		// will be created & updated when we actually have location data
		this._firstLocation = true;	// used to zoom map to current location once


		// get location gathering started
		this._map.on('locationfound', this._onLocationUpdate);
		this._map.on('locationerror', this._onLocationError);
		// https://leafletjs.com/reference-1.7.1.html#locate-options
		const gpsOptions = {
			//setView: true, 
			maxZoom: 15,
			enableHighAccuracy: true,
			watch: true	 // i.e.update location continuously
		};
		this._map.locate( gpsOptions );


		//this._map.on( "contextmenu", function( e ) {console.log('context menu');} );
		this._initFocusOnButtons();


		// turn off focusOnMe or focusOnAll when user pans the map
		// some hackery here to detect whether the user or we programmatically
		// panned the map (same movestart event)
		this._userInitiatedPan = false;
		this._map.on( "movestart", function( e ) 
		{
			if( G.mapUI._userInitiatedPan )
				G.mapUI.loseFocus(); 
			G.mapUI._userInitiatedPan = false;
		});
		let userPanDetector = function( e )
		{
			G.mapUI._userInitiatedPan = true;
		}
		this._map.on( "mousedown", userPanDetector );
		this._map.on( "touchbegin", userPanDetector );
		
		

		// shorthand for other objects
		G.map = this._map;



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
			G.pilots.updateMyTelemetry( telemetry );
			
			console.log( "Fuel remaining: " + fuelRemaining + " L" );
			// now what do we do with fuelRemaining :)  ?
		};
		// wire up the various fuel levels in the fuel left dialog
		let fuelLevels = $(" #fuelLeftDialog label");
		for( let level=0; level<fuelLevels.length; level++ )
			fuelLevels[level].onclick = fuelUpdateHandler;



		$("#displayPaths").onchange = function( e )
		{
			let showPaths = e.target.checked;
			G.pilots.showPaths( showPaths );
		}
		//G.pilots.showPaths( $("#displayPaths").checked ); // cant call pilots when they are inited AFTER mapUI
	}
	
	this._init();
}

G.mapUI = new MapUI();
