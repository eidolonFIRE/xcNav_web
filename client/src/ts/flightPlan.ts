import * as L from "leaflet";
import { me } from "./pilots";
import { geoTolatlng } from "./util";
import Sortable from 'sortablejs';
import { createMarker, getMap } from "./mapUI";

/*
    Flight Plan is the current list of waypoints and info overlays.
        ( This does not include automatic overlays such as airspac. )
*/

interface Waypoint {
    name: string
    geo: L.LatLng[]
    optional: boolean
}

type PlanManifest = Record<string, FlightPlan>;



// ============================================================================
//
//     Manifest Manager
//
// ----------------------------------------------------------------------------
class FlightPlanManager {
    plans: PlanManifest;
    mapLayer = L.layerGroup();

    constructor () {
        // pull from storage
        const m = JSON.parse(localStorage.getItem("FlightPlanManifest")) as PlanManifest;
        if (m == null) {
            // failed, make a fresh one
            this.plans = {}
        } else {
            // swap in from pull
            this.plans = m;
        }
    }


    _push() {
        localStorage.setItem("FlightPlanManifest", JSON.stringify(this.plans));
    }

    savePlan(plan: FlightPlan) {
        this.plans[plan.name] = plan;
        this._push();
    }

    loadPlan(name: string) {
        if (Object.keys(this.plans).indexOf(name) > -1) {
            return this.plans[name];
        } else {
            console.error(`Failed to load flight plan \"${name}\"`);
            return new FlightPlan("current_flight_plan");
        }
    }
}


// ============================================================================
//
//     Flight plan
//
// ----------------------------------------------------------------------------
class FlightPlan {
    name: string;
    waypoints: Waypoint[]
    wp_by_name: Record<string, number>
    cur_waypoint: number
    last_edited: number
    _reverse: boolean
    _markers: Record<string, L.Marker>
    _map_layer: L.LayerGroup

    constructor (name: string) {
        this.name = name;
        this.waypoints = [];
        this.wp_by_name = {};
        this.cur_waypoint = -1;
        this.last_edited = 0;
        this._reverse = false;
        this._markers = {};
        this._map_layer = L.layerGroup();

        // TODO: this shouldn't be happening statically like this
        planManager.mapLayer.addLayer(this._map_layer);
    }

    // Get a waypoint index safely.
    _waypoint(wp: number | string): number {
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
        return index;
    }

    // Rebuild lookup table (necessary after editing)
    _refreshWpByName() {
        this.wp_by_name = {};
        this.waypoints.forEach((wp: Waypoint, index: number) => {
            this.wp_by_name[wp.name] = index;
        });
        this.last_edited = Date.now();
    }


    // toggle plan direction (go back up the waypoint list)
    reverse() {
        this._reverse = !this._reverse;
        console.log(`Flight plan is reversed: ${this._reverse}`);
        return this._reverse;
    }

    // Select a waypoint as next the destination.
    setCurWaypoint(waypoint: number | string) {
        const wp = this._waypoint(waypoint);
        if (wp == null) return;
        this.cur_waypoint = wp;
        console.log("Current Waypoint Set: ", this._waypoint(wp))
    }

    moveWayoint(waypoint: number | string, newIndex: number) {
        const wp = this._waypoint(waypoint);
        if (wp == null) return;
        
        // pop from list
        const temp_wp = this.waypoints[wp];
        this.waypoints.splice(wp, 1);
        // re-insert in new location
        this.waypoints.splice(newIndex, 0, temp_wp);
        this._refreshWpByName();
    }

    // Append a new waypoint after the current one.
    // If none currently selected, append to the end.
    addWaypoint(name: string, geo: L.LatLng) {
        const wp = {
            name: name,
            geo: [geo],
            optional: false,
        } as Waypoint;

        if (this.cur_waypoint >= 0) {
            // insert
            this.waypoints.splice(this.cur_waypoint + 1, 0, wp);
        } else {
            // append to the end
            this.waypoints.push(wp);
        }
        this._refreshWpByName();

        // create marker
        this._addMarker(wp);
    }

    deleteWaypoint(waypoint: number | string) {
        const wp = this._waypoint(waypoint);
        if (wp == null) return;

        // delete marker
        this._remMarker(this.waypoints[wp].name);
        
        // delete waypoint from plan
        console.log("Deleting Waypoint: ", wp);
        if (wp < this.cur_waypoint) {
            this.setCurWaypoint(this.cur_waypoint - 1);
        } else if (this.cur_waypoint == wp) {
            this.cur_waypoint = -1;
        }
        delete this.waypoints[wp];
        this._refreshWpByName();
    }

    setOptional(waypoint: number | string, optional: boolean) {
        const wp = this._waypoint(waypoint);
        if (wp == null) return;
        this.waypoints[wp].optional = optional;
        this.last_edited = Date.now();
    }

    // import a one or more waypoints from kml
    importKML(kml: string) {
        //
        this.last_edited = Date.now();
    }

    etaToNextWaypoint(geo: GeolocationCoordinates) {
        //
    }






    _addMarker(wp: Waypoint) {
        const marker = createMarker(wp.geo);
        this._markers[wp.name] = marker;
        marker.addTo(this._map_layer);
    }

    _remMarker(wp_name: string) {
        this._map_layer.removeLayer(this._markers[wp_name]);
        delete this._markers[wp_name];
    }

    refreshMapMarkers() {
        console.log("Refreshing Map Markers");

        // clear all markers
        Object.keys(this._markers).forEach((name: string) => {
            this._map_layer.removeLayer(this._markers[name]);
        });
        this._markers = {};

        // create fresh markers
        myPlan.waypoints.forEach((wp: Waypoint) => {
            this._addMarker(wp);
        });
    }  
}





// --- singleton classes for current user ---
export const planManager = new FlightPlanManager();
export const myPlan = planManager.loadPlan("current_flight_plan");







// ============================================================================
//
// Flight Plan UI
//
// ----------------------------------------------------------------------------
let waypoints_sortable: Sortable;
export function setupWaypointEditorUI() {
    // UI refresh triggers
    const flightPlanMenu = document.getElementById('flightPlanMenu')
    flightPlanMenu.addEventListener('shown.bs.offcanvas', function () {
        refreshFlightPlanUI();
    });
    // DEBUG: refresh all markers when waypoint menu hidden
    // flightPlanMenu.addEventListener('hidden.bs.offcanvas', function () {
    //     myPlan.refreshMapMarkers();
    // });

    // sortable waypoint list
    // https://github.com/SortableJS/Sortable
    const list = document.getElementById("waypointList") as HTMLUListElement;
    waypoints_sortable = Sortable.create(list, {disabled: true});
    waypoints_sortable.options.onUpdate = (event: Sortable.SortableEvent) => {
        myPlan.moveWayoint(event.oldIndex, event.newIndex);
        myPlan.cur_waypoint = event.newIndex;
        // DEBUG: useful while testing the sortable list
        // refreshFlightPlanUI();
    };

    // waypoint list - button handlers
    const btn_add = document.getElementById("btnAddWaypoint") as HTMLButtonElement;
    btn_add.addEventListener("click", (ev: MouseEvent) => {
        // TODO: replace with real prompt (index.html)
        const name = prompt("New Waypoint Name");
        myPlan.addWaypoint(name, geoTolatlng(me.geoPos));
        refreshFlightPlanUI();
    });

    const btn_edit = document.getElementById("btnEditFlightPlan") as HTMLButtonElement;
    btn_edit.addEventListener("click", (ev: MouseEvent) => {
        waypoints_sortable.options.disabled = false;
        document.querySelectorAll(".wpDeleteBtn").forEach((element: HTMLElement) => {
            element.style.display = "inline";
            
            // setup the for-each buttons
            element.addEventListener("click", (ev: MouseEvent) => {
                // delete waypoint
                ev.stopPropagation();
                myPlan.deleteWaypoint(element.getAttribute("data-wp"));
                element.parentNode.parentNode.removeChild(element.parentNode);
            });

        })
    });

    const btn_reverse = document.getElementById("btnReverseFlightPlan") as HTMLButtonElement;
    btn_reverse.addEventListener("click", (ev: MouseEvent) => {
        const icon = document.getElementById("btnReverseFlightPlan_icon") as HTMLImageElement;
        if (myPlan.reverse()) {
            icon.classList.add("fa-arrow-up");
            icon.classList.remove("fa-arrow-down");
        } else {
            icon.classList.remove("fa-arrow-up");
            icon.classList.add("fa-arrow-down");
        }
    });

    // add visual layer to leaflet
    getMap().addLayer(planManager.mapLayer);
}


export function refreshFlightPlanUI(editMode=false) {
    const list = document.getElementById("waypointList") as HTMLUListElement;

    // empty list
    while (list.firstChild) {
        list.removeChild(list.lastChild);
    }

    // repopulate the list
    myPlan.waypoints.forEach((wp: Waypoint, index: number) => {
        const content = wp.name + '<i class="fas fa-times-circle btn-outline-danger wpDeleteBtn text-right" style="display: ' + (editMode ? "inline" : "none") + '" data-wp="' + wp.name + '"></i>';

        // set html
        const entry = document.createElement("li") as HTMLLIElement;
        entry.innerHTML = content;
        entry.className = "list-group-item";
        if (index == myPlan.cur_waypoint) entry.classList.add("active");

        entry.addEventListener("click", (ev: MouseEvent) => {
            // unselect all
            Object.values(list.children).forEach((item) => {
                item.classList.remove("active");
            });
            // select the one
            entry.classList.add("active");
            myPlan.setCurWaypoint(index);
        });

        list.appendChild(entry);
    });
}
