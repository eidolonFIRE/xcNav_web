

import * as L from "leaflet";
import * as GeometryUtil from "leaflet-geometryutil";
import { me } from "./pilots";
import { ETA, geoTolatlng, remainingDistOnPath } from "./util";
import { getMap } from "./mapUI";

/*
    Flight Plan is the current list of waypoints and info overlays.
        ( This does not include automatic overlays such as airspac. )
*/

export interface Waypoint {
    name: string
    geo: L.LatLng[]
    optional: boolean
    // cached sum distance of geo[]
    length?: number
}

export interface FlightPlan {
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
export class LivePlan {
    plan: FlightPlan

    // current mode
    reversed: boolean
    cur_waypoint: number

    // caching
    _wp_by_name: Record<string, number>

    // visuals
    markers: Record<string, L.Marker | L.Polyline>
    trip_snake_marker: L.Polyline[]
    next_wp_guide: L.Polyline
    _map_layer: L.LayerGroup
    

    constructor (name: string, from_plan: FlightPlan=null) {
        this.plan = {
            name: from_plan == null ? name : from_plan.name,
            waypoints: [],
            date_saved: 0,
        }
        this._wp_by_name = {};
        this.cur_waypoint = -1;
        this.reversed = false;
        this.markers = {};
        this.trip_snake_marker = null;
        this._map_layer = L.layerGroup();

        if (from_plan != null) {
            this.append(from_plan);
        }

        this._refreshWpByName();
        this.refreshMapMarkers();

        // TODO: this shouldn't be happening statically like this
        planManager.mapLayer.addLayer(this._map_layer);
    }

    // Append a plan to this one
    append(plan: FlightPlan) {
        plan.waypoints.forEach((wp: Waypoint) => {
            this.addWaypoint(wp.name, wp.geo, wp.optional);
        });
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
    addWaypoint(name: string, geo: L.LatLng[], optional=false) {
        // check for duplicate
        if (Object.keys(this._wp_by_name).indexOf(name) > -1) {
            console.warn("Plan already has a waypoint named: ", name);
            return;
        }

        // create waypoint and add it
        const wp = {
            name: name,
            geo: geo,
            optional: optional,
        } as Waypoint;
        if (wp.geo.length > 1) {
            // sum up the cummulative length of the path
            wp.length = 0;
            for (let i = 0; i < wp.geo.length - 1; i++) {
                wp.length += wp.geo[i].distanceTo(wp.geo[i+1]);
            }
        }
        if (this.cur_waypoint >= 0) {
            // insert
            this.plan.waypoints.splice(this.cur_waypoint + 1, 0, wp);
        } else {
            // append to the end
            this.plan.waypoints.push(wp);
        }
        this._refreshWpByName();
        const marker = this._createMarker(wp) as L.Marker | L.Polyline;
        this.markers[wp.name] = marker;
        marker.addTo(this._map_layer);
        this.updateTripSnakeLine();
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

    // ETA from a location to a waypoint
    // If target is a path, result is dist to nearest tangent + remaining path
    etaToWaypoint(waypoint: number | string, geo: L.LatLng, speed: number): ETA {
        const wp = this._waypoint(waypoint);
        if (wp == null) return;

        const next_wp = this.plan.waypoints[wp];
        let next_dist: number;
        if (next_wp.geo.length > 1) {
            next_dist = remainingDistOnPath(geo, next_wp.geo, next_wp.length, this.reversed);
        } else {
            next_dist = next_wp.geo[0].distanceTo(geo);
        }

        return {
            dist: next_dist,
            time: next_dist / speed * 1000,
        } as ETA;
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
        let prev_i = null;
        for (let i = wp; this.reversed ? (i >= 0) : (i < this.plan.waypoints.length); i += this.reversed ? -1 : 1) {
            // skip optional waypoints
            const wp_i = this.plan.waypoints[i];
            if (wp_i.optional) continue;
            
            if (prev_i != null) {
                // Will take the last point of the current waypoint, nearest point of the next
                const prev_geo = this.plan.waypoints[prev_i].geo;
                const dist_next = wp_i.geo[this.reversed ? wp_i.geo.length - 1 : 0].distanceTo(prev_geo[this.reversed ? 0 : prev_geo.length - 1]);

                eta.dist += dist_next;
                eta.time += dist_next / speed * 1000;
            
                // add path distance
                if (wp_i.geo.length > 1 && "length" in wp_i) {
                    eta.dist += wp_i.length;
                    eta.time += wp_i.length / speed * 1000;
                }
            }
            prev_i = i;
        }
        return eta;
    }


    updateNextWpGuide() {
        if (this.cur_waypoint >= 0) {
            // update wp guide
            const wp = myPlan.plan.waypoints[myPlan.cur_waypoint];
            let target: L.LatLng;
            if (wp.geo.length > 1) {
                const _map = getMap();
                target = L.GeometryUtil.interpolateOnLine(_map, wp.geo, L.GeometryUtil.locateOnLine(_map, L.polyline(wp.geo), geoTolatlng(me.geoPos))).latLng;
            } else {
                target = wp.geo[0];
            }
            if (this.next_wp_guide == null) {
                // create new marker line
                this.next_wp_guide = L.polyline([geoTolatlng(me.geoPos), target], {
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
                this.next_wp_guide.setLatLngs([geoTolatlng(me.geoPos), target]);
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

    _appendTripSnakeLine(points: L.LatLng[]) {
        const m = this._createMarker(
            {
                name: "trip marker",
                geo: points,
                optional: false,
            }, {
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
            }) as L.Polyline;
        this.trip_snake_marker.push(m);
        m.addTo(this._map_layer);
    }

    updateTripSnakeLine() {
        // remove markers
        if (this.trip_snake_marker != null) {
            this.trip_snake_marker.forEach((m: L.Polyline) => {
                this._map_layer.removeLayer(m);
            });
            
        }
        this.trip_snake_marker = [];

        let points = [];
        this.plan.waypoints.forEach((wp: Waypoint) => {
            if (wp.optional) return;

            if (wp.geo.length > 1) {
                points.push(wp.geo[0]);
                this._appendTripSnakeLine(points);
                points = [wp.geo[wp.geo.length -1]];
            } else {
                points.push(wp.geo[0]);
            }
        });
        this._appendTripSnakeLine(points);
    }

    _createMarker(wp: Waypoint, options: Object={}): L.Marker | L.Polyline {
        if (wp.geo.length == 1) {
            // Point
            const marker = L.marker(wp.geo[0], options);
            // marker.addEventListener("click", ())
            if (options["draggable"] == true) {
                marker.addEventListener("dragend", (event: L.DragEndEvent) => {
                    this.moveWaypoint(wp.name, [marker.getLatLng()]);
                });
            }
            return marker;
        } else {
            // Line / Polygon
            return L.polyline(wp.geo, 
                Object.assign({
                    // stroke?: boolean,
                    color: "purple",
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
                }, options));
        }
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
export const groupPlan = new LivePlan("group_flight_plan");
