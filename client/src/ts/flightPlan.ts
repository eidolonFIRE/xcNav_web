import icon_wp from "../img/wp.png";
import icon_wp_optional from "../img/wp_optional.png";
import icon_wp_path from "../img/wp_path.png";
import icon_wp_path_optional from "../img/wp_path_optional.png";

import * as L from "leaflet";
import { me } from "./pilots";
import { ETA, geoTolatlng } from "./util";
import Sortable from 'sortablejs';
import { createMarker, FocusMode, getMap, setFocusMode } from "./mapUI";

/*
    Flight Plan is the current list of waypoints and info overlays.
        ( This does not include automatic overlays such as airspac. )
*/

interface Waypoint {
    name: string
    geo: L.LatLng[]
    optional: boolean
}

interface FlightPlan {
    name: string;
    waypoints: Waypoint[]
    date_saved: number
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
        plan.date_saved = Date.now();
        this.plans[plan.name] = plan;
        this._push();
    }

    loadPlan(name: string): FlightPlan {
        if (Object.keys(this.plans).indexOf(name) > -1) {
            // cast L objects
            this.plans[name].waypoints.forEach((wp: Waypoint) => {
                wp.geo = wp.geo.map((p: L.LatLng) => {
                    return new L.LatLng(p.lat, p.lng, p.alt);
                });
            });
            return this.plans[name];
        } else {
            console.warn(`No flight plan named \"${name}\"`);
            return null;
        }
    }
}


// ============================================================================
//
//     Flight plan
//
// ----------------------------------------------------------------------------
class LivePlan {
    plan: FlightPlan

    // current mode
    reversed: boolean
    cur_waypoint: number

    // caching
    _wp_by_name: Record<string, number>

    // visuals
    markers: Record<string, L.Marker | L.Polyline>
    trip_snake_marker: L.Polyline
    next_wp_guide: L.Polyline
    _map_layer: L.LayerGroup
    

    constructor (name: string, from_plan: FlightPlan=null) {
        if (from_plan == null) {
            this.plan = {
                name: name,
                waypoints: [],
                date_saved: 0,
            }
        } else {
            this.plan = from_plan;
        }
        this._wp_by_name = {};
        this.cur_waypoint = -1;
        this.reversed = false;
        this.markers = {};
        this.trip_snake_marker = null;
        this._map_layer = L.layerGroup();

        this._refreshWpByName();
        this.refreshMapMarkers();

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
            if (Object.keys(this._wp_by_name).indexOf(wp) > -1) {
                index = this._wp_by_name[wp];
            } else {
                console.error(`Couldn't find waypoint \"${wp}\"`);
                return null;
            }
        }
        if (index >= this.plan.waypoints.length) {
            console.error(`Waypoint Index ${index} out of range.`);
            return null;
        }
        return index;
    }

    // Rebuild lookup table (necessary after editing)
    _refreshWpByName() {
        this._wp_by_name = {};
        this.plan.waypoints.forEach((wp: Waypoint, index: number) => {
            this._wp_by_name[wp.name] = index;
        });

        // save changes
        planManager.savePlan(this.plan);
    }


    // toggle plan direction (go back up the waypoint list)
    reverse() {
        this.reversed = !this.reversed;
        console.log(`Flight plan is reversed: ${this.reversed}`);
        return this.reversed;
    }

    // Select a waypoint as next the destination.
    setCurWaypoint(waypoint: number | string) {
        const wp = this._waypoint(waypoint);
        if (wp == null) return;
        this.cur_waypoint = wp;
        console.log("Current Waypoint Set: ", this._waypoint(wp))
    }

    sortWayoint(waypoint: number | string, newIndex: number) {
        const wp = this._waypoint(waypoint);
        if (wp == null) return;
        
        // pop from list
        const temp_wp = this.plan.waypoints[wp];
        this.plan.waypoints.splice(wp, 1);
        // re-insert in new location
        this.plan.waypoints.splice(newIndex, 0, temp_wp);
        this._refreshWpByName();
        this.updateTripSnakeLine();
    }

    // Append a new waypoint after the current one.
    // If none currently selected, append to the end.
    addWaypoint(name: string, geo: L.LatLng) {
        // check for duplicate
        if (Object.keys(this._wp_by_name).indexOf(name) > -1) {
            console.warn("Plan already has a waypoint named: ", name);
            return;
        }

        // create waypoint and add it
        const wp = {
            name: name,
            geo: [geo],
            optional: false,
        } as Waypoint;
        if (this.cur_waypoint >= 0) {
            // insert
            this.plan.waypoints.splice(this.cur_waypoint + 1, 0, wp);
        } else {
            // append to the end
            this.plan.waypoints.push(wp);
        }
        this._refreshWpByName();
        this._newMarker(wp);
    }

    deleteWaypoint(waypoint: number | string) {
        const wp = this._waypoint(waypoint);
        if (wp == null) return;

        const name = this.plan.waypoints[wp].name;
        
        // delete waypoint from plan
        console.log("Deleting Waypoint: ", wp);
        if (wp < this.cur_waypoint) {
            // correct for shift
            this.setCurWaypoint(this.cur_waypoint - 1);
        } else if (this.cur_waypoint == wp) {
            // don't select a new wp
            this.cur_waypoint = -1;
        }
        this.plan.waypoints.splice(wp, 1);
        this._refreshWpByName();

        // delete marker
        this._remMarker(name);
    }

    moveWaypoint(waypoint: number | string, newGeo: L.LatLng[]) {
        const wp = this._waypoint(waypoint);
        if (wp == null) return;

        this.plan.waypoints[wp].geo = newGeo;
        this.updateTripSnakeLine();
        // save changes
        planManager.savePlan(this.plan);
    }

    setOptional(waypoint: number | string, optional: boolean=null) {
        const wp = this._waypoint(waypoint);
        if (wp == null) return;
        if (optional == null) {
            // toggle
            this.plan.waypoints[wp].optional = !this.plan.waypoints[wp].optional;
        } else {
            // set to value
            this.plan.waypoints[wp].optional = optional;
        }
        this.updateTripSnakeLine();
        // save changes
        planManager.savePlan(this.plan);
    }

    importKML(kml: string) {
        // TODO
    }



    // ETA from a location to a waypoint
    etaToWaypoint(waypoint: number | string, geo: L.LatLng, speed: number): ETA {
        const wp = this._waypoint(waypoint);
        if (wp == null) return;

        const next_wp = this.plan.waypoints[wp];
        
        if (next_wp.geo.length > 1) {
            // TODO: support different geometries (lines, polygons)
            return {
                dist: 0,
                time: 0,
            } as ETA;
        } else {
            // distance to point
            const next_dist = next_wp.geo[0].distanceTo(geo);
            return {
                dist: next_dist,
                time: next_dist / speed * 1000
            };
        }
    }

    // ETA from a waypoint to the end of the trip
    etaToTripEnd(waypoint: number | string, speed: number=null): ETA {
        const wp = this._waypoint(waypoint);
        if (wp == null) return;

        const eta = {
            dist: 0,
            time: 0,
        } as ETA;
        
        // sum up the route
        let prev_wp = null;
        for (let i = wp; this.reversed ? (i >= 0) : (i < this.plan.waypoints.length); i += this.reversed ? -1 : 1) {
            // skip optional waypoints
            if (this.plan.waypoints[i].optional) continue;
            
            if (prev_wp != null) {
                // Will take the last point of the current waypoint, nearest point of the next
                const prev_geo = this.plan.waypoints[prev_wp].geo;
                const eta2 = this.etaToWaypoint(i, prev_geo[this.reversed ? prev_geo.length - 1 : 0], speed)
                eta.dist += eta2.dist;

                if (speed != null) {
                    eta.time += eta2.dist / speed * 1000;
                }
            }
            prev_wp = i;
        }
        return eta;
    }


    updateNextWpGuide() {
        if (this.cur_waypoint >= 0) {
            // update wp guide
            const wp = myPlan.plan.waypoints[myPlan.cur_waypoint];
            if (this.next_wp_guide == null) {
                // create new marker line
                // TODO: support line wp intercept
                this.next_wp_guide = L.polyline([geoTolatlng(me.geoPos), wp.geo[0]], {
                    // stroke?: boolean,
                    color: "lime",
                    weight: 8,
                    opacity: 0.5,
                    lineCap: "round"
                    // lineJoin?: LineJoinShape,
                    // dashArray?: string | number[],
                    // dashOffset?: string,
                    // fill?: boolean,
                    // fillColor?: string,
                    // fillOpacity?: number,
                    // fillRule?: FillRule,
                    // renderer?: Renderer,
                    // className?: string,
                    // smoothFactor?: number,
                    // noClip?: boolean,
                });
            this.next_wp_guide.addTo(this._map_layer);
            } else {
                // update marker
                this.next_wp_guide.setLatLngs([geoTolatlng(me.geoPos), wp.geo[0]]);
            }
        } else {
            // remove wp guide
            if (this.next_wp_guide != null) {
                // this.next_wp_guide.removeFrom(this._map_layer);
                this._map_layer.removeLayer(this.next_wp_guide);
                this.next_wp_guide = null;
            }
        }
    }

    updateTripSnakeLine() {
        const points = [];

        this.plan.waypoints.forEach((wp: Waypoint) => {
            if (wp.optional) return;
            points.push(wp.geo[0]);
        });

        if (this.trip_snake_marker != null) this._map_layer.removeLayer(this.trip_snake_marker);
        this.trip_snake_marker = createMarker(points,
        {
            // stroke?: boolean,
            color: "black",
            weight: 3,
            // opacity?: number,
            // lineCap?: LineCapShape,
            // lineJoin?: LineJoinShape,
            // dashArray?: string | number[],
            // dashOffset?: string,
            // fill?: boolean,
            // fillColor?: string,
            // fillOpacity?: number,
            // fillRule?: FillRule,
            // renderer?: Renderer,
            // className?: string,
            // smoothFactor?: number,
            // noClip?: boolean,
        });
        this.trip_snake_marker.addTo(this._map_layer);
    }

    _newMarker(wp: Waypoint, options: Object={}) {
        const marker = createMarker(wp.geo, options) as L.Marker | L.Polyline;
        this.markers[wp.name] = marker;
        marker.addTo(this._map_layer);
        this.updateTripSnakeLine();
    }

    _createMarker(wp: Waypoint, options: Object={}) {
        const marker = createMarker(wp.geo, options) as L.Marker;

        if (options["draggable"] == true) {
            marker.addEventListener("dragend", (event: L.DragEndEvent) => {
                this.moveWaypoint(wp.name, [marker.getLatLng()]);
            });
        }

        
        return marker;
        
    }

    _remMarker(wp_name: string) {
        this._map_layer.removeLayer(this.markers[wp_name]);
        delete this.markers[wp_name];
        this.updateTripSnakeLine();
    }

    refreshMapMarkers(edit_mode: boolean = false) {
        console.log("Refreshing Map Markers");

        // clear all markers
        Object.keys(this.markers).forEach((name: string) => {
            this._map_layer.removeLayer(this.markers[name]);
        });
        this.markers = {};

        // create fresh markers
        this.plan.waypoints.forEach((wp: Waypoint) => {
            const m = this._createMarker(wp, {draggable: edit_mode});
            this.markers[wp.name] = m;
            m.addTo(this._map_layer);            
        });

        this.updateTripSnakeLine();
    }  
}







// --- singleton classes for current user ---
export const planManager = new FlightPlanManager();
export const myPlan = new LivePlan("current_flight_plan", planManager.loadPlan("current_flight_plan"));







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
        myPlan.sortWayoint(event.oldIndex, event.newIndex);
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
        // waypoint button : delete
        document.querySelectorAll(".wpDeleteBtn").forEach((element: HTMLElement) => {
            element.style.display = "inline";
            element.addEventListener("click", (ev: MouseEvent) => {
                myPlan.deleteWaypoint(element.getAttribute("data-wp"));
                element.parentNode.parentNode.removeChild(element.parentNode);
                ev.stopPropagation();
            });

        });

        // waypoint button : mode (toggle optional)
        document.querySelectorAll(".wp_list_icon").forEach((element: HTMLImageElement) => {
            element.addEventListener("click", (ev: MouseEvent) => {
                const wp_name = element.getAttribute("data-wp");
                myPlan.setOptional(wp_name);
                element.src = _wp_icon_selector(myPlan.plan.waypoints[myPlan._waypoint(wp_name)]);
                ev.stopPropagation();
            });
        });

        // edit viem mode
        myPlan.refreshMapMarkers(true);
        setFocusMode(FocusMode.edit_plan);
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


function _wp_icon_selector(wp: Waypoint) {
    return wp.geo.length > 1 ? (wp.optional ? icon_wp_path_optional: icon_wp_path) : (wp.optional ? icon_wp_optional : icon_wp)
}


export function refreshFlightPlanUI(editMode=false) {
    const list = document.getElementById("waypointList") as HTMLUListElement;

    // empty list
    while (list.firstChild) {
        list.removeChild(list.lastChild);
    }

    // repopulate the list
    myPlan.plan.waypoints.forEach((wp: Waypoint, index: number) => {
        let content = "";

        // wp type/mode indicator icon
        const wp_icon = document.createElement("img") as HTMLImageElement;
        wp_icon.src = _wp_icon_selector(wp);
        wp_icon.className = "wp_list_icon";
        wp_icon.setAttribute("data-wp", wp.name);
        content += wp.name + '<i class="fas fa-times-circle btn-outline-danger wpDeleteBtn text-right" style="display: ' + (editMode ? "inline" : "none") + '" data-wp="' + wp.name + '"></i>';

        // set html
        const entry = document.createElement("li") as HTMLLIElement;
        entry.appendChild(wp_icon);
        entry.innerHTML += content;
        
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
