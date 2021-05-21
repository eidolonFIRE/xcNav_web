function Overlays()
{
	// id holds the DB id to the currently selected overlays - 0 means none selected
	// layerGroup is the Leaflet layergroup that holds the actual markers, polylines etc.	
	this._overlays = {
		'airspace'  : { 'id': 0, 'layerGroup': null },
		'flightPlan': { 'id': 0, 'layerGroup': null }
	}
	

	// ---------------------------------------
	// _loadOverlay
	// ---------------------------------------
	this._loadOverlay = function( id, layer )
	{
		let requestData = {
				'api': 1,
				'method' : 'read',
				'query': {
					'entity': 'overlays',
					'id'    : id
				}
			};
		G.overlays._overlays[layer].layerGroup.clearLayers(); // out with the old !

		//console.log( "_loadOverlay( id: " + id + " as " + layer );

		if( id==0 ) // ie "none" selected 
			return;

		G.API.request( requestData, function(r)
		{			
			let annotations = JSON.parse( r.json );
			
			//console.log( "Loading overlay json from server for id: " + r.id + " " + r.name + " by pilotID " + r.creator + " successful." );
			
			// in with the new:
			// first create the icons
			// https://leafletjs.com/reference-1.7.1.html#icon
			
			let LLIcons = {}; // leaflet icon objects
			annotations.icons.forEach( function( i ) {
				LLIcons[i.id] = L.icon(i);
			});
			
			// https://leafletjs.com/reference-1.7.1.html#marker
			annotations.markers.forEach( function( mi )
			{
				let marker = L.marker(  mi.latLng,
										{ icon: LLIcons[mi.icon]	} // icon options
				);
				marker.addTo( G.overlays._overlays[layer].layerGroup );
				if( mi.popup )
					marker.bindPopup( mi.popup );

				if( L.Browser.safari )
				{
					// on safari we get called twice for each marker click
					// (probably a Leaflet bug)
					// if we dont mitigate, first click opens popup
					// and second click immediately closes it
					// so we fake open it up a third time, thus keeping it up
					
					G.overlays._safariBrowserHack = false;
					marker.on( "click", function(e) 
					{
						G.overlays._safariBrowserHack = !G.overlays._safariBrowserHack;
						if( !G.overlays._safariBrowserHack )
							e.target.openPopup();
					});
				}
			});
			
			
			// https://leafletjs.com/reference-1.7.1.html#polyline
			annotations.polylines.forEach( function( pi )
			{
				let polyline = L.polyline( pi.coords, pi );
				polyline.addTo( G.overlays._overlays[layer].layerGroup );
				if( pi.popup )
					polyline.bindPopup( pi.popup );
			});

			// https://leafletjs.com/reference-1.7.1.html#polygon
			annotations.polygons.forEach( function( pi )
			{
				let polygon = L.polygon( pi.coords, pi );
				polygon.addTo( G.overlays._overlays[layer].layerGroup );
				if( pi.popup )
					polygon.bindPopup(pi.popup );
			});
		});
	}
	

	// ---------------------------------------
	// updateOverlayList
	// ---------------------------------------
	this.updateOverlayList = function()
	{
		let requestData = {
				'api': 1,
				'method' : 'read',
				'query': {
					'entity'    : 'overlays'
				}
			};
		G.API.request( requestData, function(r)
		{			
			for( let o=0; o<2; o++ )
			{
				let type = Object.keys( G.overlays._overlays )[o];  // airspace | flightPlan
				let foundOurs = false; // does our previously selected overlay ID still exist ?
				let html = '';
				for( let i=0;i<r.length; i++ )
				{
					let selected = "";
					if( r[i].type==type )
					{
						// eg does our overlays['flightPlan'].id match incoming id ?
						if( G.overlays._overlays[type].id==r[i].id )
						{
							foundOurs= true;
							selected = " SELECTED";
						}
						html += "<OPTION VALUE='" + r[i].id + "'" + selected + ">" + r[i].name + "</OPTION>"; 
					}
				}
				if( !foundOurs )
					html += "<OPTION VALUE='0' SELECTED>None</OPTION>"; 
				$("#" + type).innerHTML = html;
			}


		});
	}
	
	
	
	

	// ---------------------------------------
	// _initKMZUploadForm
	// ---------------------------------------
	this._initKMZUploadForm = function()
	{
	
		this._uploadSuccess = function( r )
		{
			//console.log( "Successfully uploaded, unzipped, decoded KMZ and created a new overlay JSON file" );
			// now, update the overlays popups and select the one we just uploaded to be the active one
			// which will trigger downloading it.
			
			// how about we also update our currently loaded overlay to the 
			// new one we just pumped up to the server, since we probably want to look at it ?
			G.overlays.updateOverlayList();
			
			G.overlays._overlays[r.type].id = r.id;  // remember new selection
			localStorage.setItem(r.type, r.id );     // also persistently 
			G.overlays._loadOverlay( r.id, r.type ); // fetch JSON from server & create the markers, polylines etc.
			
			$("#" + r.type ).value = r.id;  // update popup menu

		};


		$("#uploadKMZForm").onsubmit = function( e )
		{
			let uploadForm = $("#uploadKMZForm"); // note: dont use this - we are in a handler...could use e.target
								
			let overlayType = $("input[name='overlayType']:checked")[0].value;
			
			let requestData = {
				'api': 1,
				'method' : 'create',
				'query': {
					'entity'  : 'overlays',
					'creator' : G.pilots.getMyPilotID(),
					'type'    : overlayType
				}
			};
			G.API.request( requestData, G.overlays._uploadSuccess, $("#kmz").files );
			
			return false; // we already handled it, thanks
		};
		
		let kmz = $("#kmz");
		kmz.onchange = function(e)
		{
			if( kmz.value.endsWith( ".kmz" ) )
				$("#kmzSubmitButton").disabled = false;
		}
		
		let theMenuElement = $("#uploadKMZMenu");
		this._uploadKMZMenu = new bootstrap.Offcanvas( theMenuElement );
		theMenuElement.addEventListener( "show.bs.offcanvas", function( e )
		{
			// before we show it, stick the current pilot ID into the pilotID field
			//console.log( "KMZ show.bs.offcanvas" );
			//$("#kmz").value = ""; // reset/clear the file control so we dont have a stale file in here
		});
		theMenuElement.addEventListener( "hide.bs.offcanvas", function( e )
		{
			// clear out the upload field ?
			//console.log( "KMZ hide.bs.offcanvas" );
		});
	}
	

	// ---------------------------------------
	// _init
	// ---------------------------------------
	this._init = function()
	{
		this._overlays.airspace.layerGroup   = L.layerGroup();
		this._overlays.flightPlan.layerGroup = L.layerGroup();

		// init the "available overlays" lists from server data
		this.updateOverlayList();

		// which overlays did the user have selected and load those up
		for( let o=0; o<2; o++ )
		{
			let type = Object.keys( this._overlays )[o];  // airspace | flightPlan
			this._overlays[ type ].id = localStorage.getItem( type ) || 0;  // this will be an ID
			this._loadOverlay( this._overlays[ type ].id, type ); // fetch JSON from server & create the markers, polylines etc.
			
			// hook up the airspace/flightPath selectors in the overlayMenu
			$("#airspace").onchange = $("#flightPlan").onchange = function(e)
			{
				let type = e.target.id; // airspace or flightPlan SELECT element
				let selectedID = $(" #" + type + " option:checked")[0].value;
				G.overlays._overlays[type].id = selectedID;  // remember new selection
				localStorage.setItem(type, selectedID );     // also persistently 
				G.overlays._loadOverlay( selectedID, type ); // fetch JSON from server & create the markers, polylines etc.
			}
		}
		G.mapUI.overlaysReady( this._overlays.airspace.layerGroup, this._overlays.flightPlan.layerGroup );
		
		this._initKMZUploadForm();
	}
	
	
	
}

G.overlays = new Overlays();

/*
	Why is this init outside the class definition, unlike other objects ?
	
	Because I havent figured out a solution for this yet:
	_loadOverlay() gets called from init (to load in selected overlays from server)
	it is also called from
	the onchange event handlers for the user visible layer selectors in the overlays menu
	
	_loadOverlay can be written with 
		this.* references in its guts (usual for methods called during init) and 
		G.overlays.* (usual for calls from event handlers)
	but not both. It is current written with G.overlays.* which is not yet ready
	when init is called. Hence we had to move the init out here, after G.overlays is set 
	
	jQuery had a nice utility where "this" was always set up nicely. Need something like it here
*/
G.overlays._init();
