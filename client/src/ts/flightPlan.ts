import * as L from "leaflet";

/*
    Flight Plan is the current list of waypoints and info overlays
    shown to the pilot / meetup.
    This does not include automatic overlays such as airspace.
*/

interface Waypoint {
    name: string
    geo: L.LatLng[]
    optional: boolean
    priority: boolean
}

class FlightPlan {
    waypoints: Waypoint[]
    wp_by_name: Record<string, number>
    cur_waypoint: number

    constructor () {
        this.cur_waypoint = -1;
    }

    // select a waypoint from the list
    _waypoint(wp: number | string): Waypoint {
        let index: number;
        if (typeof wp == "number") {
            // select by index
            index = wp;
        } else {
            // select by name
            if (Object.keys(this.wp_by_name).indexOf(wp) > -1) {
                index = this.wp_by_name[wp];
            } else {
                console.error(`Couldn't find waypoint \"${wp}\"`);
                return null;
            }
        }
        if (index >= this.waypoints.length) {
            console.error(`Waypoint Index ${index} out of range.`);
            return null;
        }
        return this.waypoints[index];
    }




    // set waypoint as next destination
    gotoWaypoint(wp: number | string) {
        //
    }

    moveWayoint(wp: number | string, newIndex: number) {
        //
    }

    addWaypoint(name: string, geo: L.LatLng) {
        //
    }

    deleteWaypoint(wp: number | string) {
        //
    }

    setOptional(wp: number | string, optional: boolean) {
        //
    }

    // import a one or more waypoints from kml
    importKML(kml: string) {
        //
    }

    etaToNextWaypoint(geo: GeolocationCoordinates) {
        //
    }

    // Save whole plan to local storage
    savePlan(name: string) {
        //
    }

    // Load whole plan  from local storage
    loadPlan(name: string, replace: boolean) {
        //
    }
}









// singleton class for current user's plan
export let myPlan = new FlightPlan();

