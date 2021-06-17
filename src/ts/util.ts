// Use $(Selector) without jQuery
// https://stackoverflow.com/questions/38165687/use-selector-without-jquery	
// for query syntax: https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelector
// examples:
// $("input[class*='layerSelector']")     match all elems CONTAINING layerSelector in their class (eg class="btn layerSelector")
// $(" #mainMenuForm input")              returns all inputs in the form (note the space in front of the # else # returns only a single element

// iterate over the elements of a nodelist returned by $
// $("input[class*='layerSelector']").forEach( function( val, index, o ) { console.log(val.value); } )
// https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelector
export function $(query: string): any
{
	return (query[0] === '#') ? document.querySelector(query) : document.querySelectorAll(query);
}


export const colors = [ 'aqua', 'black', 'blue', 'fuchsia', 'gray', 'grey', 'green', 'lime', 
'maroon', 'navy', 'olive', 'purple', 'red', 'silver', 'teal', 'yellow' ];

// Create a UUID (for proto.ID)
export function make_uuid(len: number): string {
    const u8 = new Uint8Array(len);
    window.crypto.getRandomValues(u8);
    return btoa(String.fromCharCode.apply(null, u8))
}


export function randInt (min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomCentered() {
    return Math.random()*2 - 1; // centered, -1..1
}
