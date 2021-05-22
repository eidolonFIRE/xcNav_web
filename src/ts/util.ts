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
