
// ========================================================
//  zoom map with invisible slider & gesture
// ========================================================

function OneFingerZoom() 
{
	// all private, nothing to call here
	
	this._zoomer = $("#zoomer");
	this._zooming = false;
	this._initialY;
	this._originalZoom;
	this._availableZoomRange;

	this._setZoom = function( currentY )
	{
		let zoom = G.oneFingerZoom._initialY - currentY;
		zoom = -zoom / window.innerHeight;  // now zoom is max -1..1
	
		zoom *= G.oneFingerZoom._availableZoomRange;
		zoom = G.oneFingerZoom._originalZoom + zoom;
		// window. innerHeight;
		//console.log( zoom );
		G.map.setZoom( zoom, {animate: true, duration: 0.0, easeLinearity: 1}); // leaflet must not be using these params or function
			// while 2-finger zooming. The animation is way smoother
			// Someone on stack overflow blamed a setTimout( bla, 250ms) function somewhere
	}
	
	// wiring up both touch and mouse events so we can use / test on desktop as well

	this._zoomer.onmousedown = function(e) 
	{
		//G.oneFingerZoom._zoomer.classList.add( "zoomerVisible" );
		G.oneFingerZoom._initialY = e.pageY;
		G.oneFingerZoom._zooming = true;
		G.oneFingerZoom._originalZoom = G.map.getZoom();
		G.oneFingerZoom._availableZoomRange = G.map.getMaxZoom() - G.map.getMinZoom();
	}

	this._zoomer.ontouchstart = function(e) 
	{
		G.oneFingerZoom._zoomer.classList.add( "zoomerVisible" );
		// https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent/changedTouches
		G.oneFingerZoom._initialY = e.changedTouches[0].pageY;
		G.oneFingerZoom._zooming = true;
		G.oneFingerZoom._originalZoom = G.map.getZoom();
		G.oneFingerZoom._availableZoomRange = G.map.getMaxZoom() - G.map.getMinZoom();
	}


	document.ontouchend = document.onmouseup = function() 
	{
		if( G.oneFingerZoom._zooming )
		{
			//console.log( e );
			G.oneFingerZoom._zoomer.classList.remove( "zoomerVisible" );
			G.oneFingerZoom._zooming = false;
		}
	}

	document.onmousemove = function(e) 
	{
		if( G.oneFingerZoom._zooming )
		{
			G.oneFingerZoom._setZoom( e.pageY );
		}
	}

	document.ontouchmove = function(e) 
	{
		if( G.oneFingerZoom._zooming )
		{
			// https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent/changedTouches
			G.oneFingerZoom._setZoom( e.changedTouches[0].pageY );
		}
	}

}
G.oneFingerZoom = new OneFingerZoom();	


