import { planManager } from "./flightPlan";
import { curFlightDist_mi, curFlightDuration_h_mm } from "./flightRecorder";
import { me } from "./pilots";
import { geoTolatlng, km2Miles, meter2Mile, meters2Feet, mSecToStr_h_mm, ETA } from "./util";





//	----------------------------------------------------------------------------
//  udpate instrument displays
//	----------------------------------------------------------------------------


function renderVario(rate: number) {
    const canvas = document.getElementById("vario") as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");

    const w = canvas.width;
    const h = canvas.height;
    const vc = canvas.height / 2;

    // clear
    ctx.clearRect(0, 0, w, h);


    // draw ticks
    ctx.strokeStyle = "white";
    ctx.lineWidth = 5;
    for (let i = 0; i < 7; i++) {
        ctx.beginPath()
        const tick = i / 6 * h;
        ctx.moveTo(w - w/(5 - Math.abs(i - 3)), tick);
        ctx.lineTo(w, tick);
        ctx.stroke();
    }

    // draw needled
    // (each tick is 200 ft / min)
    const needle = 1.0 - Math.min(1, Math.max(0, rate / 1200 + 0.5));
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.moveTo(0, Math.max(vc + h/6, needle * h));
    ctx.lineTo(w, needle * h);
    ctx.lineTo(0, Math.min(vc - h/6, needle * h));
    ctx.closePath();
    ctx.fill();
}




export function udpateInstruments() {
    document.getElementById("telemetrySpd").innerText = (me.geoPos.speed * meter2Mile * 3600).toFixed(0);
    document.getElementById("telemetryAlt").innerText = (me.geoPos.altitude * meters2Feet).toFixed(0);

    // flight timer
    // const elapsed_time = document.getElementById("flightDuration_time") as HTMLBodyElement;
    // elapsed_time.innerHTML = curFlightDuration_h_mm();
    // const elapsed_dist = document.getElementById("flightDuration_dist") as HTMLBodyElement;
    // elapsed_dist.innerHTML = curFlightDist_mi();

    renderVario(me.avgVario);

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
    let eta_trip: ETA = {time: undefined, dist: undefined};
    let eta_next: ETA = {time: undefined, dist: undefined};
    if (plan != null && me.current_waypoint.index >= 0) {
        if (me.current_waypoint.index != null && 0 <= me.current_waypoint.index && me.current_waypoint.index < plan.plan.waypoints.length) {
            // update ETA text box
            eta_next = plan.etaToWaypoint(me.current_waypoint.index, geoTolatlng(me.geoPos), me.avgSpeed);
            eta_trip = plan.etaToTripEnd(me.current_waypoint.index, me.avgSpeed);
            eta_trip.dist += eta_next.dist;
            eta_trip.time += eta_next.time;
            fp_nextWp_time.textContent = (me.avgSpeed > 1 ? mSecToStr_h_mm(eta_next.time) : "--:--");
            fp_nextWp_dist.textContent = (eta_next.dist * meter2Mile).toFixed(1);
            fp_trip_time.textContent = (me.avgSpeed > 1 ? mSecToStr_h_mm(eta_trip.time) : "--:--");
            fp_trip_dist.textContent = (eta_trip.dist * meter2Mile).toFixed(1);
        } else {
            // update ETA text box
            if (plan.plan.waypoints.length > 0) {
                // just show the whole trip length, we haven't selected anything
                eta_trip = plan.etaToTripEnd(plan.reversed ? plan.plan.waypoints.length - 1 : 0, me.avgSpeed);
                fp_trip_time.textContent = (me.avgSpeed > 1 ? mSecToStr_h_mm(eta_trip.time) : "--:--");
                fp_trip_dist.textContent = (eta_trip.dist * meter2Mile).toFixed(1);
            } else {
                fp_trip_dist.textContent = "-";
                fp_trip_time.textContent = "--:--";
            }
        }
    } else {
        fp_trip_dist.textContent = "-";
        fp_nextWp_dist.textContent = "-";
        fp_trip_time.textContent = "--:--";
        fp_nextWp_time.textContent = "--:--";
    }
    

    // Update Fuel Indicator
    let color = "#0E6EFD";
    let fuel_text = "--";
    const remain_fuel_time = me.fuel / me.fuelBurnRate;
    if (me.fuel < 0.00001) {
        color = "black";
    } else {
        fuel_text = me.fuel.toFixed(1);
        if (remain_fuel_time < 0.25 || (remain_fuel_time < (eta_next.time || 0) / 3600000)) {
            // Red at 15minutes of fuel left or can't make selected waypoint
            color = "red";
        } else if (remain_fuel_time < (eta_trip.time || 0) / 3600000) {
            // Orange if not enough fuel to finish the plan
            color = "orange";
        }
    }
    document.getElementById("telemetryFuel").innerText = fuel_text;
    document.getElementById("fuelPanel").style.backgroundColor = color;

}


export function setupInstruments() {
    // nothing to do here atm
}
