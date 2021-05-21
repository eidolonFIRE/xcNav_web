function Debug()
{
    // put functionality on the debug menu here


    this._init = function(): void
    {
        // "Fly As" is currently still in the Pilots constructor, TBD since those are all fake pilots anyway
        // and may be best to keep the hackery local to there

		
		// toggle periodic API telemetry updates on/off
		$("#simLocations").onchange = function( e )
		{
			G.pilots.simulateLocations( e.target.checked );
		}
				
		// initialize to whatever Bootstrap was set up with
		G.pilots.simulateLocations( $("#simLocations").checked );


        
        $("#clearAllMessages").onclick = function()
        {
            G.messages.clearAllMessages();		
        }
    }

    this._init();
}

G.debug = new Debug();