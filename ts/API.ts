// import {Pilots} from "./pilots";



export function request( requestData, onsuccess /* function */, file=null /* only for file uploads */ )
{
	let reqDataJSON = JSON.stringify(requestData);			
	let http = new XMLHttpRequest();			

	http.addEventListener("load", function(e) 
	{
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

				// TODO: wire this back up
				// G.pilots._stopFurtherAPICalls();
				return;
			}
			onsuccess( r );
		}
		else
		{
			console.log( "API error:" );
			console.log( this.responseText );
			// TODO: Global
			// G.pilots._stopFurtherAPICalls();
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

