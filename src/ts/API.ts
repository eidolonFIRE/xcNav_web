import {  } from "./main";
import { $ } from "./util";
import { stopFurtherAPICalls } from "./pilots"

// TODO: fix types by including bootstrap package
type Bootstrap = any;
declare let bootstrap: Bootstrap;


export function _showErrorDialog( msg : string ): void
	{
		$("#serverErrorMessage").innerHTML = msg;

		// bootstrap does not like to have >1 modal or offscreen open at the same time
		// it knows if one and which is open. But it doesn't give us a closeAny()
		// so we have to fish out any open ones and manually close them
		// Open ones are characterized by having a "show" class
		let anyOpen = $( ".offcanvas.show,.modal.show");
		if( anyOpen.length > 0 ) // get rid of existing visible modal or offcanvas 
		{
			/*
			Ok, I tried to play nice, but bootstrap even complains about creating the modal object in the next line
			let currentlyOpen = new bootstrap.Modal( anyOpen[0] );
			currentlyOpen.hide();
			*/
			
			/* crap this doesnt work either -still getting
			RangeError: Maximum call stack size exceeded.
			errors from bootstrap. Forget it, will figure out later
			anyOpen[0].classList.remove( "show" );
			 */
		}
		let errorDialog = new bootstrap.Modal( $("#serverErrorDialog"));
		errorDialog.show();
		
	}

export function request( requestData, onsuccess /* function */, file=null /* only for file uploads */ )
{
	let reqDataJSON = JSON.stringify(requestData);			
	let http = new XMLHttpRequest();			

	http.addEventListener("load", function(e) 
	{
		// comment here
		if(this.status==200)
		{
			//console.log( "We have received a telemetry update from the API !" );
		
			let responseText = this.responseText;
			let r;
			try {
				r = JSON.parse( responseText );
			} catch (e) {
				console.log( "JSON decode error on API response:" );
				console.log( e );
				console.log( "API response was:" );
				console.log( responseText );
				_showErrorDialog( "Can't decode JSON server sent back:<br><pre>" + responseText + "</pre>");
				stopFurtherAPICalls();
				return;
			}
			onsuccess( r );
		}
		else
		{
			console.log( "API error:" );
			console.log( this.responseText );
			_showErrorDialog( "<pre>" + this.responseText + "</pre>");
			stopFurtherAPICalls();
		}
	});

	http.addEventListener("error", function(e) 
	{
		console.log( "HTTP Error:" );
		console.log( e );
		// probably should figure out what kind of error (e wont tell us...just a ProgressEvent)
		// and then stop further API queries until some user action fixes it ?
	});
	let apiEndpoint = "api/api.php";
	if( window.location.protocol == "file:" )
		apiEndpoint = "https://www.snacknack.com/w/ppgDEV/api/api.php";
	http.open( "POST", apiEndpoint );
	//http.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
	
	// https://developer.mozilla.org/en-US/docs/Web/API/FormData/append
	let formData = new FormData();
	formData.append("request", reqDataJSON);
	
	if( file!==null )
		formData.append( "kmz", file[0] );
	
	http.send( formData );
}

