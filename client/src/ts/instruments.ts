import { planManager } from "./flightPlan";
import { curFlightDist_mi, curFlightDuration_h_mm } from "./flightRecorder";
import { me } from "./pilots";
import { geoTolatlng, km2Miles, meter2Mile, meters2Feet, mSecToStr_h_mm } from "./util";







//	----------------------------------------------------------------------------
//  udpate instrument displays
//	----------------------------------------------------------------------------
export function udpateInstruments() {
    document.getElementById("telemetrySpd").innerText = (me.geoPos.speed * meter2Mile * 3600).toFixed(0);
    document.getElementById("telemetryHdg").innerText = ((me.geoPos.heading + 360) % 360).toFixed(0);
    document.getElementById("telemetryAlt").innerText = (me.geoPos.altitude * meters2Feet).toFixed(0);
    document.getElementById("telemetryFuel").innerText = me.fuel.toFixed(1);

    // flight timer
    const inst_duration = document.getElementById("flightDuration") as HTMLBodyElement;
    inst_duration.innerHTML = curFlightDuration_h_mm() + "&nbsp;&nbsp;&nbsp;&nbsp;" + curFlightDist_mi() + " mi";

    
    let col = "#0E6EFD"; // regular button blue
    if( me.fuel < 2 )
        col = "red";
    else if( me.fuel < 4 ) // should be "fuel needed to get to LZ ?"
        col = "orange";
    document.getElementById("fuelBingoPanel").style.backgroundColor = col;
    
    
    let estFuelBurn: number = 4;  // L/h
    let timeLeft: number  = me.fuel / estFuelBurn * 60; // L / L/h => h -> minutes
    timeLeft = Math.floor( timeLeft );
    let hours = Math.floor( timeLeft/60 );
    let minutes = timeLeft - 60*hours;
    let extraZero = minutes<10 ? '0' : '';
    let displayTimeLeft = (hours>0 ? hours.toString() : '' ) + ':' + extraZero + minutes.toString();
    let rangeLeft = (me.geoPos.speed * timeLeft / 60) * km2Miles;     // km/h * h -> km -> mi
    document.getElementById("fuelEstimates").innerHTML = displayTimeLeft + " / " + rangeLeft.toFixed(0) + "mi<br>@ " + estFuelBurn.toFixed(1) + "L/h";

    // Waypoints - Next / Trip
    const fp_nextWp = document.getElementById("fp_nextWp") as HTMLBodyElement;
    const fp_trip = document.getElementById("fp_trip") as HTMLBodyElement;
    const plan = planManager.plans[me.current_waypoint.plan];
    if (plan != null) {
        if (me.current_waypoint.index != null && me.current_waypoint.index < plan.plan.waypoints.length) {
            // update ETA text box
            const eta_next = plan.etaToWaypoint(me.current_waypoint.index, geoTolatlng(me.geoPos), me.geoPos.speed);
            const eta_trip = plan.etaToTripEnd(me.current_waypoint.index, me.geoPos.speed);
            eta_trip.dist += eta_next.dist;
            eta_trip.time += eta_next.time;
            fp_nextWp.innerHTML = (me.geoPos.speed > 1 ? mSecToStr_h_mm(eta_next.time) : "--:--") + "&nbsp;&nbsp;&nbsp;" + (eta_next.dist * meter2Mile).toFixed(1) + " mi";
            fp_trip.innerHTML = (me.geoPos.speed > 1 ? mSecToStr_h_mm(eta_trip.time) : "--:--") + "&nbsp;&nbsp;&nbsp;" + (eta_trip.dist * meter2Mile).toFixed(1) + " mi";
        } else {
            // update ETA text box
            if (plan.plan.waypoints.length > 0) {
                // just show the whole trip length, we haven't selected anything
                const eta_trip = plan.etaToTripEnd(plan.reversed ? plan.plan.waypoints.length - 1 : 0, me.geoPos.speed);
                fp_trip.innerHTML = (me.geoPos.speed > 1 ? mSecToStr_h_mm(eta_trip.time) : "--:--") + "&nbsp;&nbsp;&nbsp;" + (eta_trip.dist * meter2Mile).toFixed(1) + " mi";
            } else {
                fp_trip.innerHTML = "-";
            }
        }
    } else {
        fp_trip.innerHTML = "-";
    }
    
}


export function setupInstruments() {
    // wire up the various fuel levels in the fuel left dialog
    document.querySelectorAll(" #fuelLeftDialog label").forEach((selector) => {
        selector.addEventListener("click", (ev: MouseEvent) => {
            let label: string = selector.textContent;
            let fuelRemaining: number = parseInt( label );
            
            if( label.slice(-1)== '½')
                fuelRemaining += 0.5; // label was something like "4½"
            
            me.fuel = fuelRemaining;
            
            console.log( "Fuel remaining: " + fuelRemaining + " L" );
            // now what do we do with fuelRemaining :)  ?
        });
    });
}
