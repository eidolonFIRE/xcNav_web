import { planManager } from "./flightPlan";
import { curFlightDist_mi, curFlightDuration_h_mm } from "./flightRecorder";
import { me } from "./pilots";
import { geoTolatlng, km2Miles, meter2Mile, meters2Feet, mSecToStr_h_mm } from "./util";







//	----------------------------------------------------------------------------
//  udpate instrument displays
//	----------------------------------------------------------------------------
export function udpateInstruments() {
    document.getElementById("telemetrySpd").innerText = (me.geoPos.speed * meter2Mile * 3600).toFixed(0);
    document.getElementById("telemetryAlt").innerText = (me.geoPos.altitude * meters2Feet).toFixed(0);
    document.getElementById("telemetryFuel").innerText = me.fuel.toFixed(1);

    // flight timer
    // const elapsed_time = document.getElementById("flightDuration_time") as HTMLBodyElement;
    // elapsed_time.innerHTML = curFlightDuration_h_mm();
    // const elapsed_dist = document.getElementById("flightDuration_dist") as HTMLBodyElement;
    // elapsed_dist.innerHTML = curFlightDist_mi();
    
    let col = "#0E6EFD"; // regular button blue
    if( me.fuel < 2 )
        col = "red";
    else if( me.fuel < 4 ) // should be "fuel needed to get to LZ ?"
        col = "orange";
    document.getElementById("fuelPanel").style.backgroundColor = col;
    

    // TODO: rethink fuel estimates
    // let timeLeft: number  = me.fuel / estFuelBurn * 60; // L / L/h => h -> minutes
    // timeLeft = Math.floor( timeLeft );
    // let hours = Math.floor( timeLeft/60 );
    // let minutes = timeLeft - 60*hours;
    // let extraZero = minutes<10 ? '0' : '';
    // let displayTimeLeft = (hours>0 ? hours.toString() : '' ) + ':' + extraZero + minutes.toString();
    // let rangeLeft = (me.geoPos.speed * timeLeft / 60) * km2Miles;     // km/h * h -> km -> mi
    // document.getElementById("fuelEstimates").innerHTML = displayTimeLeft + " / " + rangeLeft.toFixed(0) + "mi<br>@ " + estFuelBurn.toFixed(1) + "L/h";

    // Waypoints - Next / Trip
    const fp_nextWp_time = document.getElementById("fp_nextWp_time") as HTMLBodyElement;
    const fp_nextWp_dist = document.getElementById("fp_nextWp_dist") as HTMLBodyElement;
    const fp_trip_time = document.getElementById("fp_trip_time") as HTMLBodyElement;
    const fp_trip_dist = document.getElementById("fp_trip_dist") as HTMLBodyElement;
    const plan = planManager.plans[me.current_waypoint.plan];
    if (plan != null && me.current_waypoint.index >= 0) {
        if (me.current_waypoint.index != null && 0 <= me.current_waypoint.index && me.current_waypoint.index < plan.plan.waypoints.length) {
            // update ETA text box
            const eta_next = plan.etaToWaypoint(me.current_waypoint.index, geoTolatlng(me.geoPos), me.geoPos.speed);
            const eta_trip = plan.etaToTripEnd(me.current_waypoint.index, me.geoPos.speed);
            eta_trip.dist += eta_next.dist;
            eta_trip.time += eta_next.time;
            fp_nextWp_time.innerHTML = (me.geoPos.speed > 1 ? mSecToStr_h_mm(eta_next.time) : "--:--");
            fp_nextWp_dist.innerHTML = (eta_next.dist * meter2Mile).toFixed(1);
            fp_trip_time.innerHTML = (me.geoPos.speed > 1 ? mSecToStr_h_mm(eta_trip.time) : "--:--");
            fp_trip_dist.innerHTML = (eta_trip.dist * meter2Mile).toFixed(1);
        } else {
            // update ETA text box
            if (plan.plan.waypoints.length > 0) {
                // just show the whole trip length, we haven't selected anything
                const eta_trip = plan.etaToTripEnd(plan.reversed ? plan.plan.waypoints.length - 1 : 0, me.geoPos.speed);
                fp_trip_time.innerHTML = (me.geoPos.speed > 1 ? mSecToStr_h_mm(eta_trip.time) : "--:--");
                fp_trip_dist.innerHTML = (eta_trip.dist * meter2Mile).toFixed(1);
            } else {
                fp_trip_dist.innerHTML = "-";
                fp_trip_time.innerHTML = "--:--";
            }
        }
    } else {
        fp_trip_dist.innerHTML = "-";
        fp_nextWp_dist.innerHTML = "-";
        fp_trip_time.innerHTML = "--:--";
        fp_nextWp_time.innerHTML = "--:--";
    }
    
}


export function setupInstruments() {
    // nothing to do here atm
}
