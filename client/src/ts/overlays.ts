import * as L from "leaflet"
import * as bootstrap from "bootstrap";

import { $ } from "./util";
import { overlaysReady } from "./mapUI";
import { me } from "./pilots";
import { parseKML } from "./kml";


// id holds the DB id to the currently selected overlays - 0 means none selected
// layerGroup is the Leaflet layergroup that holds the actual markers, polylines etc.	
let _overlays = {
    'airspace'  : { 'id': 0, 'layerGroup': null }
}


// ---------------------------------------
// _loadOverlay
// ---------------------------------------
function _loadOverlay(id, layer)
{
    let requestData = {
            'api': 1,
            'method' : 'read',
            'query': {
                'entity': 'overlays',
                'id'    : id
            }
        };
    _overlays[layer].layerGroup.clearLayers(); // out with the old !

    //console.log( "_loadOverlay( id: " + id + " as " + layer );

    if( id==0 ) // ie "none" selected 
        return;

    // TODO: hookup to client
    // request( requestData, function(r)
    // {			
    // 	let annotations = JSON.parse( r.json );
        
    // 	//console.log( "Loading overlay json from server for id: " + r.id + " " + r.name + " by pilotID " + r.creator + " successful." );
        
    // 	// in with the new:
    // 	// first create the icons
    // 	// https://leafletjs.com/reference-1.7.1.html#icon
        
    // 	let LLIcons = {}; // leaflet icon objects
    // 	annotations.icons.forEach( function( i ) {
    // 		LLIcons[i.id] = L.icon(i);
    // 	});
        
    // 	// https://leafletjs.com/reference-1.7.1.html#marker
    // 	annotations.markers.forEach( function( mi )
    // 	{
    // 		let marker = L.marker(  mi.latLng,
    // 								{ icon: LLIcons[mi.icon]	} // icon options
    // 		);
    // 		marker.addTo( _overlays[layer].layerGroup );
    // 		if( mi.popup )
    // 			marker.bindPopup( mi.popup );

    // 		if( L.Browser.safari )
    // 		{
    // 			// on safari we get called twice for each marker click
    // 			// (probably a Leaflet bug)
    // 			// if we dont mitigate, first click opens popup
    // 			// and second click immediately closes it
    // 			// so we fake open it up a third time, thus keeping it up
                
    // 			let _safariBrowserHack = false;
    // 			marker.on( "click", function(e) 
    // 			{
    // 				_safariBrowserHack = !_safariBrowserHack;
    // 				if( !_safariBrowserHack )
    // 				e.target.openPopup();
    // 			});
    // 		}
    // 	});
        
        
    // 	// https://leafletjs.com/reference-1.7.1.html#polyline
    // 	annotations.polylines.forEach( function( pi )
    // 	{
    // 		let polyline = L.polyline( pi.coords, pi );
    // 		polyline.addTo( _overlays[layer].layerGroup );
    // 		if( pi.popup )
    // 			polyline.bindPopup( pi.popup );
    // 	});

    // 	// https://leafletjs.com/reference-1.7.1.html#polygon
    // 	annotations.polygons.forEach( function( pi )
    // 	{
    // 		let polygon = L.polygon( pi.coords, pi );
    // 		polygon.addTo( _overlays[layer].layerGroup );
    // 		if( pi.popup )
    // 			polygon.bindPopup(pi.popup );
    // 	});
    // });
}


// ---------------------------------------
// updateOverlayList
// ---------------------------------------
export function updateOverlayList()
{
    let requestData = {
        'api': 1,
        'method' : 'read',
        'query': {
            'entity'    : 'overlays'
        }
    };
    // TODO: hookup to client
    // request( requestData, function(r)
    // {			
    // 	for( let o=0; o<2; o++ )
    // 	{
    // 		let type = Object.keys( _overlays )[o];  // airspace
    // 		let foundOurs = false; // does our previously selected overlay ID still exist ?
    // 		let html = '';
    // 		for( let i=0;i<r.length; i++ )
    // 		{
    // 			let selected = "";
    // 			if( r[i].type==type )
    // 			{
    // 				// eg does our overlays['flightPlan'].id match incoming id ?
    // 				if( _overlays[type].id==r[i].id )
    // 				{
    // 					foundOurs= true;
    // 					selected = " SELECTED";
    // 				}
    // 				html += "<OPTION VALUE='" + r[i].id + "'" + selected + ">" + r[i].name + "</OPTION>"; 
    // 			}
    // 		}
    // 		if( !foundOurs )
    // 			html += "<OPTION VALUE='0' SELECTED>None</OPTION>"; 
    // 		$("#" + type).innerHTML = html;
    // 	}


    // });
}



// ---------------------------------------
// _init
// ---------------------------------------
export function setupOverlays()
{
    _overlays.airspace.layerGroup   = L.layerGroup();

    // init the "available overlays" lists from server data
    updateOverlayList();

    // which overlays did the user have selected and load those up
    for( let o=0; o<2; o++ )
    {
        let type = Object.keys( _overlays )[o];  // airspace | flightPlan
        _overlays[ type ].id = localStorage.getItem( type ) || 0;  // this will be an ID
        _loadOverlay( _overlays[ type ].id, type ); // fetch JSON from server & create the markers, polylines etc.
        
        // hook up the airspace/flightPath selectors in the overlayMenu
        $("#airspace").onchange = function(e)
        {
            let type = e.target.id; // airspace or flightPlan SELECT element
            let selectedID = $(" #" + type + " option:checked")[0].value;
            _overlays[type].id = selectedID;  // remember new selection
            localStorage.setItem(type, selectedID );     // also persistently 
            _loadOverlay( selectedID, type ); // fetch JSON from server & create the markers, polylines etc.
        }
    }
    overlaysReady( _overlays.airspace.layerGroup);
}
