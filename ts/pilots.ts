

// ========================================================
//  Pilots
// ========================================================


function Pilots()
{
	this._pilots = {};
	this._myPilotID = 1;
	this._intervalTimer = 0;
	this._locationQueryInterval = 1; // seconds between subsequent location queries to server for other pilots info
	
	
	// ---------------------------------------
	// updateMyTelemetry
	//
	// this is called from the G.mapUI._onLocationUpdate event handler
	// ---------------------------------------
	this.updateMyTelemetry = function( telemetry )
	{
		// receive lat,lng,alt,hdg,vel,fuel 
		// https://leafletjs.com/reference-1.7.1.html#locationevent

		// and trigger a telemetry update to server
		// athough we should probably decouple updating our own stuff 
		// (more frequently on map) than sending up to server
		// eg we do not control frequency of update via
		// 	this._map.locate( gpsOptions );
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
		this._pilots[ this._myPilotID ].telemetry.fuel = telemetry.fuel;
	}
	
	
	
	// ---------------------------------------
	// getMyPilotID
	// ---------------------------------------
	this.getMyPilotID = function()
	{
		return G.pilots._myPilotID;
	}


	
	// ---------------------------------------
	// setMyPilotID
	// ---------------------------------------
	this.setMyPilotID = function( id )
	{
		id = parseInt(id);
		if( id<1 || id>5 )
		{
			console.log( "Error: for debugging, pilot IDs must be 1..5" );
			return;
		}
		this._myPilotID = id;
	}
	

	// ---------------------------------------
	// getMyPilotLatLng
	// ---------------------------------------
	this.getMyPilotLatLng = function(): LatLng
	{
		let ll: LatLng = L.latLng( this._pilots[ this._myPilotID ].telemetry.lat,    this._pilots[ this._myPilotID ].telemetry.lng );
 		return ll;
	}
	
	
	
	// ---------------------------------------
	// getMyPilotInfo
	// ---------------------------------------
	this.getMyPilotInfo = function()
	{
		return this._pilots[ this._myPilotID ];
	}
	
	// ---------------------------------------
	// getPilotInfo
	// ---------------------------------------
	this.getPilotInfo = function( pilotID )
	{
		return this._pilots[ pilotID ];
	}
	
	
	// ---------------------------------------
	// getBounds
	//
	// returns the rectangular bounds that
	// circumscribes all pilots in the flight
	// padded a little bit so you see map 
	// a bit outside pilots for better context
	// ---------------------------------------	
	this.getBounds = function()
	{
		var pilotLatLngs = [];
		for( var i in G.pilots._pilots )
		{
			var p = G.pilots._pilots[i];
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
	this.simulateLocations = function( yes )    
	{
		let timer = this._intervalTimer;
	
		if( yes )
		{
			if( timer!=0 )
				clearInterval( timer );
			this._intervalTimer = setInterval( this._updatePilots, this._locationQueryInterval * 1000 );
		}
		else
		{
			clearInterval( timer);
			this._intervalTimer = 0;
		}
	}
	


	// ---------------------------------------
	// pilot marker click handler (show popup with their current telemetry)
	// ---------------------------------------
	this._evenClickOnMarker = false;
	this._markerClickHandler = function( e )
	{
		// on safari we get called twice for each marker click
		// (probably a Leaflet bug)
		// if we dont mitigate, first click opens popup
		// and second click immediately closes it
		// so we fake open it up a third time, thus keeping it up
	
		if( !L.Browser.safari || !G.pilots._evenClickOnMarker )
		{
			let id = e.target.pilotID;
			let msg = "";
			
			if( id == G.pilots._myPilotID )
			{
				msg = "Now why would you <br>click on yourself, <br>you vain beast ?";
			}
			else
			{
				let name = G.pilots._pilots[ id ].name;
				let telemetry = G.pilots._pilots[ id ].telemetry;
				let myID = G.pilots._myPilotID;
			
				let myLatLng = G.pilots.getMyPilotLatLng();
				let pilotLatLng = L.latLng( telemetry.lat, telemetry.lng );
			
				// BRAA
				// bearing is the angle between myPilots speed vector and the connecting line between 
				// myPilotLocation and other pilot location.
				// my speed vector = my loc + heading
				let bearing = L.GeometryUtil.bearing( myLatLng, pilotLatLng ); // in degrees clockwise
				let myHeading = G.pilots._pilots[ myID ].telemetry.hdg;
				let ooClock = bearing - myHeading;
				ooClock = (ooClock+360) % 360; // from [-180..180] -> [0..360]
				let oClock = Math.round(ooClock/30);
				oClock = (oClock==0 ? 12 : oClock);
			
				let range = L.GeometryUtil.length( [myLatLng, pilotLatLng] ); // in meters
				let meters2Miles = 0.000621371;
				range = (range * meters2Miles).toFixed(1);
			
				let altDiff = telemetry.alt - G.pilots._pilots[ myID ].telemetry.alt;
				let high = (altDiff>100 ? 'high' : (altDiff<-100 ? 'low' : '') );
			
				let kmh2mph = 0.621371;
				let speed = (telemetry.vel * kmh2mph).toFixed(0);
				msg = 
				"<div class='myPopups'>"
					+ "<b>" + name + "</b><br>"
					+ "is at your " + oClock + " o'clock " + high + " at " + range + " miles<br>"
					+ "Speed: " + speed + " mph<br>" 
					+ "Fuel: " + telemetry.fuel + " L (1:37 / 30mi @ 3.9 L/h)"
				+ "</div>";
			}
			
			e.target.setPopupContent( msg );
			if( L.Browser.safari )
				e.target.openPopup( e.target.getLatLng(), { 'maxWidth': 400 } );
		}
		G.pilots._evenClickOnMarker = !G.pilots._evenClickOnMarker;
		return true;
	}
	
	
	
	// ---------------------------------------
	// _createFakePilot
	// ---------------------------------------
	this._createFakePilot = function( id: number, name: string, color: string, picture: string ): void
	{
		let dim=48;
		// https://leafletjs.com/reference-1.7.1.html#icon
		let myIcon = L.icon({
			iconUrl: 'img/pilotIcons/' + picture,
			iconSize: [dim, dim],
			iconAnchor: [dim/2, dim+4],
			popupAnchor: [0, -dim-2],  // RELATIVE to the icon anchor !!
			//shadowUrl: 'img/pilotIcons/shadow.png',
			//shadowAnchor: [34, 62]
		});
		let marker = L.marker([0,0], {icon: myIcon})
			.on( 'click', this._markerClickHandler )
			.bindPopup( "" ) // this will be filled dynamically by this._markerClickHandler
			.addTo(G.mapUI._map);
		marker.pilotID = id;

		this._pilots[id] = { 'id':id, 'name': name, 'color':color, 'marker':marker, 'picture':picture, 'telemetry': {}  };
	}
	
	
	
	// ---------------------------------------
	// _updatePilotHeadingPolyline
	// ---------------------------------------
	this._updatePilotHeadingPolyline = function( pilotInfo )
	{		
		let headingVectorScreenSpaceLength = 100; // pixels
		
		let heading  = pilotInfo.telemetry.hdg;
		let latlng   = L.latLng( pilotInfo.telemetry.lat, pilotInfo.telemetry.lng );
		
		let zoom = G.map.getZoom();
		let screenSpacePilotLocation = G.map.project( latlng, zoom );
		let screenSpaceHeadingVectorEnd = screenSpacePilotLocation;
		screenSpaceHeadingVectorEnd.x += headingVectorScreenSpaceLength; // pixels length of heading vector in screen coords
		let headingVectorTip = G.map.unproject( screenSpaceHeadingVectorEnd, zoom ); // same in latlng coordinates
		let distance = L.GeometryUtil.length( [ latlng, headingVectorTip ] ); // in real world meters
		
		// given speed+heading, compute offset from current lat,lng
		// https://makinacorpus.github.io/Leaflet.GeometryUtil/global.html#destination
		let dest = L.GeometryUtil.destination(latlng, heading, distance);
		
		let ll = [ latlng, dest ];
	
		if( !pilotInfo.headingPath )
		{
			pilotInfo.headingPath = L.polyline(
				ll,
				{ 'color': pilotInfo.color, 'width': 5 }
			)
			.addTo( G.map );
		} 
		else
			pilotInfo.headingPath.setLatLngs( ll );
	}
	
	
	// ---------------------------------------
	// _updatePilotFlightPathPolyline
	// ---------------------------------------
	this._updatePilotFlightPathPolyline = function( pilotInfo, currentLatLng )
	{
		if( G.pilots._pathsVisible )
		{
			if( !pilotInfo.path )
			{
				pilotInfo.path = L.polyline(
					currentLatLng,
					{ 
						'color': pilotInfo.color, 
						'width': 5, 
						'opacity': 0.5,
						dashArray: "10 10"
					}
				)
				.addTo( G.map );
			}
			pilotInfo.path.addLatLng( currentLatLng );
		}
	}
	
	
	this._pathsVisible = true;
	this.showPaths = function( shown: boolean ): void
	{
		if( !shown && G.pilots._pathsVisible ) // they WERE visible and now they are not
		{
			for ( let id in G.pilots._pilots ) 
			{
				G.pilots._pilots[id].path.removeFrom( G.map );
				G.pilots._pilots[id].path = null;
			}
		}
		G.pilots._pathsVisible = shown;
	}
	
	// ---------------------------------------
	// _processTelemetryUpdate
	//
	// update incoming pilot locations
	// as a comms-efficient side effect we 
	// also get any new messages and ADSB
	// alarms since we last asked
	// ---------------------------------------
	this._processTelemetryUpdate = function( r: any )
	{		
		let debugShowPilotTelemetry = 0;
		let savedFuelLevelForDebugging = G.pilots.getMyPilotInfo().telemetry.fuel;
		
		G.messages.lastMessage = r.lastMessage;	// this goes back up to server in next call	
					
		for( let i=0; i<r.pilots.length; i++ )
		{
			//console.log( "Updating : " + r.pilots[i].id );
			let updated = r.pilots[i];
			let current = G.pilots._pilots[updated.id];
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
			G.pilots._updatePilotFlightPathPolyline( current, ll );

			G.pilots._updatePilotHeadingPolyline( current );
						
			
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
			G.pilots._pilots[ G.pilots._myPilotID ].telemetry.fuel = savedFuelLevelForDebugging;
		
		// this will be moved eventually to: G.mapUI._onLocationUpdate (see comments there)
		G.mapUI.udpateTelemetry( G.pilots.getMyPilotInfo().telemetry );

		
		// if we are focusing on my own or all pilots,
		// update the map location or bounds accordingly
		if( G.mapUI.focusOnAll() )
		{
			let bounds = G.pilots.getBounds();
			G.map.fitBounds( bounds );
		}
		else if( G.mapUI.focusOnMe() )
		{
			let ll = G.pilots.getMyPilotLatLng();
			G.map.panTo( ll );
		}
		
		if( !$("#splashScreen").classList.contains("splashHidden") )
			$("#splashScreen").classList.add("splashHidden");
		
		// if we got a bunch of messages as a side effect of the telemetry update
		// it means we havent been in touch for a while (out of cell range etc.)
		G.messages.processAnyUnseenMessages( r.messages );
	}
	
	
	
	
	// ---------------------------------------
	// _stopFurtherAPICalls
	// ---------------------------------------
	this._stopFurtherAPICalls = function()
	{
		console.log( "Turning off further API calls. You can turn back on with 'Sim'd locations' checkbox." );				
		G.pilots.simulateLocations( false );
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
	this._updatePilots = function()
	{
		let requestData = {
			'api': 1,
			'method' : 'update',
			'query': {
				'entity': 'telemetry',
				'id' : parseInt(G.pilots._myPilotID),
				'lastMessage': parseInt(G.messages.lastMessage),
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
		G.API.request( requestData, G.pilots._processTelemetryUpdate );				
	}




	// ---------------------------------------
	// _init
	// ---------------------------------------
	this._init = function()
	{
		this._createFakePilot( 1, "Robert Seidl", 'orange', 'robert.png' );
		this._createFakePilot( 2, "Caleb Johnson", 'blue', 'caleb.png' );
		this._createFakePilot( 3, "Matt Cowan", 'green', 'matt.png' );
		this._createFakePilot( 4, "Adrien Bernede", 'red', 'adrien.png' );
		this._createFakePilot( 5, "Ki Steiner", 'magenta', 'ki.png' );
		
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
		this.setMyPilotID( $("#selectPilot").value );


		$("#selectPilot").onchange = function( e )
		{
			G.pilots.setMyPilotID( this.value );
			localStorage.setItem('preferredPilotID', this.value );
		};
		
	}
	
	
	
	this._init();
}

G.pilots = new Pilots();
