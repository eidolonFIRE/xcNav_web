import { $ } from "./util";
import { clearAllMessages } from "./messages";
import { getPilotGroup } from "./main";

export function setupDebug() {
    // put functionality on the debug menu here


    // "Fly As" is currently still in the Pilots constructor, TBD since those are all fake pilots anyway
    // and may be best to keep the hackery local to there

    
    // toggle periodic API telemetry updates on/off
    $("#simLocations").onchange = function( e )
    {
        getPilotGroup().simulateLocations( e.target.checked );
    }
            
    // initialize to whatever Bootstrap was set up with
    getPilotGroup().simulateLocations( $("#simLocations").checked );


    
    $("#clearAllMessages").onclick = function()
    {
        clearAllMessages();		
    }
}
