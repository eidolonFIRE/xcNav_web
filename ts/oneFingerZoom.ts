import { $ } from "./util"
import { getMap } from "./mapUI";

// ========================================================
//  zoom map with invisible slider & gesture
// ========================================================


// all private, nothing to call here

let _zoomer = $("#zoomer");
let _zooming = false;
let _initialY;
let _originalZoom;
let _availableZoomRange;


function _setZoom(currentY)
{
	const map = getMap();
	let zoom = _initialY - currentY;
	zoom = -zoom / window.innerHeight;  // now zoom is max -1..1

	zoom *= _availableZoomRange;
	zoom = _originalZoom + zoom;
	// window. innerHeight;
	//console.log( zoom );
	map.setZoom( zoom, {animate: true, duration: 0.0, easeLinearity: 1}); // leaflet must not be using these params or function
		// while 2-finger zooming. The animation is way smoother
		// Someone on stack overflow blamed a setTimout( bla, 250ms) function somewhere
}

// wiring up both touch and mouse events so we can use / test on desktop as well

// TODO: type "map" parameter
export function setupOneFingerZoom() {
	_zoomer.onmousedown = function(e) 
	{
		//_zoomer.classList.add( "zoomerVisible" );
		const map = getMap();
		_initialY = e.pageY;
		_zooming = true;
		_originalZoom = map.getZoom();
		_availableZoomRange = map.getMaxZoom() - map.getMinZoom();
	}

	_zoomer.ontouchstart = function(e) 
	{
		const map = getMap();
		_zoomer.classList.add( "zoomerVisible" );
		// https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent/changedTouches
		_initialY = e.changedTouches[0].pageY;
		_zooming = true;
		_originalZoom = map.getZoom();
		_availableZoomRange = map.getMaxZoom() - map.getMinZoom();
	}


	document.ontouchend = document.onmouseup = function() 
	{
		if( _zooming )
		{
			//console.log( e );
			_zoomer.classList.remove( "zoomerVisible" );
			_zooming = false;
		}
	}

	document.onmousemove = function(e) 
	{
		if( _zooming )
		{
			_setZoom(e.pageY);
		}
	}

	document.ontouchmove = function(e) 
	{
		if( _zooming )
		{
			// https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent/changedTouches
			_setZoom(e.changedTouches[0].pageY);
		}
	}
}
