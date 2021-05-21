// ========================================================================================================================================
// JS for the app starts here. 
// yes, yes, will be broken out into separate js file for cleanliness eventually
// ========================================================================================================================================

// open	 https://www.snacknack.com/ppg/gps.php
// settings > privacy > location services > safari has to be on (and pref high precision)

type ppgGlobal = {
	API: any;
	mapUI: any;
	pilots: any;
	messages: any;
	overlays: any;
	sounds: any;
	oneFingerZoom: any;
	map: any;
	offline: any;
	debug: any;
}
let G: ppgGlobal = {
	API: null,
	mapUI: null,
	pilots: null,
	messages: null,
	overlays: null,
	sounds: null,
	oneFingerZoom: null,
	map: null,
	offline: null,
	debug: null
};  // our global object. Access subobjects like G.mapUI, G.pilots, G.messages


type Bootstrap = any;
let bootstrap: Bootstrap;


// Use $(Selector) without jQuery
// https://stackoverflow.com/questions/38165687/use-selector-without-jquery	
// for query syntax: https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelector
// examples:
// $("input[class*='layerSelector']")     match all elems CONTAINING layerSelector in their class (eg class="btn layerSelector")
// $(" #mainMenuForm input")              returns all inputs in the form (note the space in front of the # else # returns only a single element

// iterate over the elements of a nodelist returned by $
// $("input[class*='layerSelector']").forEach( function( val, index, o ) { console.log(val.value); } )
// https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelector
function $(query: string): any
{
	return (query[0] === '#') ? document.querySelector(query) : document.querySelectorAll(query);
}
