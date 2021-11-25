import * as L from "leaflet";
import * as GeometryUtil from "leaflet-geometryutil";

import { me } from "./pilots";
import { ETA, geoTolatlng, objTolatlng, remainingDistOnPath } from "./util";
import { getMap, markersDraggable } from "./mapUI";
import Sortable from "sortablejs";
import * as api from "../../../server/src/ts/api";
import { hash_flightPlanData } from "../../../server/src/ts/apiUtil";
import * as client from "./client";

/*
    Flight Plan is the current list of waypoints and info overlays.
        ( This does not include automatic overlays such as airspac. )
*/





type PlanManifest = Record<string, api.FlightPlanData>;



// ============================================================================
//
//     Flight plan
//
// ----------------------------------------------------------------------------
export class FlightPlan {
    plan: api.FlightPlanData

    // current mode
    reversed: boolean

    // caching
    _wp_by_name: Record<string, number>

    // visuals / UI
    _visible: boolean
    markers: Record<string, L.Marker | L.Polyline>
    trip_snake_marker: L.Polyline[]
    next_wp_guide: L.Polyline
    _map_layer: L.LayerGroup
    sortable: Sortable // https://github.com/SortableJS/Sortable
    

    constructor (name: string, from_plan: api.FlightPlanData=null) {
        this.plan = {
            name: from_plan == null ? name : from_plan.name,
            waypoints: [],
        }
        this._visible = false;
        this._wp_by_name = {};
        this.reversed = false;
        this.markers = {};
        this.trip_snake_marker = null;
        this._map_layer = L.layerGroup();

        if (from_plan != null) {
            this.append(from_plan);
        } else {
            this._refreshWpByName();
            this.refreshMapMarkers();
        }
    }

    set visible(value: boolean) {
        this._visible = value;
        if (this._visible) {
            planManager.mapLayer.addLayer(this._map_layer);
        } else {
            planManager.mapLayer.removeLayer(this._map_layer);
        }
    }

    get visible(): boolean {
        return this._visible;
    }

    toggleVisible(): boolean {
        this.visible = !this.visible;
        return this.visible;
    }



    replaceData(data: api.FlightPlanData) {
        this.plan = data;
        Object.values(this.plan.waypoints).forEach((wp) => {this._calcWpLength(wp)});
        this._refreshWpByName();
        this.refreshMapMarkers();
        planManager.savePlan(this.plan);
    }

    // Append a plan to this one
    append(plan: api.FlightPlanData) {
        plan.waypoints.forEach((wp: api.Waypoint) => {
            this.addWaypoint(wp.name, wp.geo, wp.optional, this.plan.waypoints.length);
        });
        this._refreshWpByName();
        this.refreshMapMarkers();
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
        this.plan.waypoints.forEach((wp: api.Waypoint, index: number) => {
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
        me.current_waypoint = {
            plan: this.plan.name,
            index: wp,
            name: this.plan.waypoints[wp].name
        }
        this.updateNextWpGuide();
        console.log("Current Waypoint Set: ", this.plan.name, wp)
        client.sendWaypointSelection();
    }

    onSortWaypoint: (waypoint: api.Waypoint, index: number, new_index: number) => void;
    sortWayoint(waypoint: number | string, new_index: number) {
        const wp = this._waypoint(waypoint);
        if (wp == null) return;
        
        // pop from list
        const temp_wp = this.plan.waypoints[wp];
        this.plan.waypoints.splice(wp, 1);
        // re-insert in new location
        this.plan.waypoints.splice(new_index, 0, temp_wp);

        // callback
        if (this.onSortWaypoint != null) this.onSortWaypoint(temp_wp, wp, new_index);

        this._refreshWpByName();
        this.updateTripSnakeLine();
    }

    // Append a new waypoint after the current one.
    // If none currently selected, append to the end.
    onAddWaypoint: (index: number) => void;
    addWaypoint(name: string, geo: api.LatLngRaw[], optional=false, index=null) {
        // check for duplicate
        if (Object.keys(this._wp_by_name).indexOf(name) > -1) {
            // console.warn("Plan \"", this.plan.name, "\" already has a waypoint named: ", name);
            return;
        }

        // create waypoint and add it
        const wp = {
            name: name,
            geo: geo,
            optional: optional,
        } as api.Waypoint;
        this._calcWpLength(wp);

        if (index != null) {
            // insert at requested index
            // TODO: sanity check the index
        }
        else if (me.current_waypoint.plan == this.plan.name && me.current_waypoint.index >= 0) {
            // insert after current waypoint
            index = me.current_waypoint.index + 1;
        } else {
            // append to the end
            index = 0;
        }        

        this.plan.waypoints.splice(index, 0, wp);
        if (this.onAddWaypoint != null) this.onAddWaypoint(index);

        // update markers etc
        this._refreshWpByName();
        const marker = this._createMarker(wp) as L.Marker | L.Polyline;
        this.markers[wp.name] = marker;
        marker.addTo(this._map_layer);
        this.updateTripSnakeLine();
    }

    _calcWpLength(wp: api.Waypoint) {
        // Recalculate waypoint length
        if (wp.geo.length > 1) {
            wp.length = 0;
            for (let i = 0; i < wp.geo.length - 1; i++) {
                wp.length += objTolatlng(wp.geo[i]).distanceTo(wp.geo[i+1]);
            }
        } else {
            wp.length = 0;
        }
    }

    onDeleteWaypoint?: (waypoint: number) => void;
    deleteWaypoint(waypoint: number | string) {
        const wp = this._waypoint(waypoint);
        if (wp == null) return;

        const name = this.plan.waypoints[wp].name;
        
        // delete waypoint from plan
        console.log("Plan \"", this.plan.name, "\" Deleting Waypoint: ", wp);
        if (me.current_waypoint.plan == this.plan.name) {
            if (wp < me.current_waypoint.index) {
                // correct for shift
                this.setCurWaypoint(me.current_waypoint.index - 1);
            } else if (me.current_waypoint.index == wp) {
                // don't select a new wp
                me.current_waypoint.index = -1;
            }
        }
        this.plan.waypoints.splice(wp, 1);

        // callback
        if (this.onDeleteWaypoint != null) this.onDeleteWaypoint(wp);

        this._refreshWpByName();

        // delete marker
        this._remMarker(name);

        this.updateNextWpGuide();
    }

    onModifyWaypoint: (index: number) => void;
    moveWaypoint(waypoint: number | string, newGeo: L.LatLng[]) {
        const wp = this._waypoint(waypoint);
        if (wp == null) return;

        this.plan.waypoints[wp].geo = newGeo;

        // Callback
        if (this.onModifyWaypoint != null) this.onModifyWaypoint(wp);

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

        // Callback
        if (this.onModifyWaypoint != null) this.onModifyWaypoint(wp);

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
            next_dist = objTolatlng(next_wp.geo[0]).distanceTo(geo);
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
                const dist_next = objTolatlng(wp_i.geo[this.reversed ? wp_i.geo.length - 1 : 0]).distanceTo(prev_geo[this.reversed ? 0 : prev_geo.length - 1]);

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
        if (me.current_waypoint.plan == this.plan.name && me.current_waypoint.index >= 0 && me.geoPos != null) {
            // update wp guide
            const wp = this.plan.waypoints[me.current_waypoint.index];
            let target: L.LatLng;
            if (wp.geo.length > 1) {
                const _map = getMap();
                target = L.GeometryUtil.interpolateOnLine(_map, wp.geo, L.GeometryUtil.locateOnLine(_map, L.polyline(wp.geo), geoTolatlng(me.geoPos))).latLng;
            } else {
                target = objTolatlng(wp.geo[0]);
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
        this.plan.waypoints.forEach((wp: api.Waypoint) => {
            if (wp.optional) return;

            if (wp.geo.length > 1) {
                points.push(wp.geo[0]);
                // pinch off trip snake
                this._appendTripSnakeLine(points);
                // start again at last point
                points = [wp.geo[wp.geo.length -1]];
            } else {
                points.push(wp.geo[0]);
            }
        });
        if (points.length > 1) this._appendTripSnakeLine(points);
    }

    _createMarker(wp: api.Waypoint, options: Object={}): L.Marker | L.Polyline {
        if (wp.geo.length == 1) {
            const  draggable = markersDraggable();
            // Point
            const marker = L.marker(wp.geo[0], {draggable: draggable});

            if (draggable) {
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

    refreshMapMarkers() {
        // console.log("Plan \"", this.plan.name, "\" Refreshing Map Markers", "draggable:", markersDraggable());

        // clear all markers
        Object.keys(this.markers).forEach((name: string) => {
            // console.log("Plan \"", this.plan.name, "\" removed marker from map", this.markers[name], name)
            this._map_layer.removeLayer(this.markers[name]);
        });
        this.markers = {};

        // create fresh markers
        this.plan.waypoints.forEach((wp: api.Waypoint) => {
            const m = this._createMarker(wp);
            this.markers[wp.name] = m;
            m.addTo(this._map_layer);     
            // console.log("Plan \"", this.plan.name, "\" added marker", wp.name, m);
            console.log(this._map_layer.getLayers())
        });

        this.updateTripSnakeLine();
    }  


    // --- UI

    setSortable(enable: boolean) {
        if (enable) {
            const list_name = this.plan.name == "me" ? "waypointList_" + this.plan.name : "waypointList_group";
            const list = document.getElementById(list_name) as HTMLUListElement;
            this.sortable = Sortable.create(list, {
                group: {
                    name: "waypoints",
                    pull: "clone",
                },
                handle: ".wp_list_drag_handle",
                animation: 100,
            });
            this.sortable.options.onUpdate = (event: Sortable.SortableEvent) => {
                this.sortWayoint(event.oldIndex, event.newIndex);
                // DEBUG: useful while testing the sortable list
                // refreshFlightPlanUI();
            };
            this.sortable.options.onEnd = (event: Sortable.SortableEvent) => {
                if (event.to.id != event.from.id) {
                    // drag between flight plans
                    const target_plan = event.to.id.substr(13);

                    const wp = this.plan.waypoints[event.oldIndex];

                    planManager.plans[target_plan].addWaypoint(wp.name, wp.geo, wp.optional, event.newIndex);
                }
            }
        } else {
            if (this.sortable != null) {
                // This is a hack to bypass a bug in the Sortable library.
                // When enabling a Sortable class, the "group" feature is broken.
                this.sortable.options.disabled = true;
                this.sortable = null;
            }
        }
    }
}





// ============================================================================
//
//     Manage Live Flight Plans
//
// ----------------------------------------------------------------------------
class FlightPlanManager {
    data: PlanManifest
    plans: Record<string, FlightPlan>
    mapLayer = L.layerGroup()

    constructor () {
        this.plans = {};

        // pull from storage
        const m = JSON.parse(localStorage.getItem("FlightPlanManifest")) as PlanManifest;
        if (m == null) {
            // failed, make a fresh one
            this.data = {}
        } else {
            // swap in from pull
            this.data = m;
        }
    }

    newPlan(name: string, from=null) {
        const plan = new FlightPlan(name, this.loadPlan(from));
        plan.visible = true;
        this.plans[name] = plan;
        return plan;
    }

    _push() {
        localStorage.setItem("FlightPlanManifest", JSON.stringify(this.data));
    }    

    savePlan(plan: api.FlightPlanData) {
        this.data[plan.name] = plan;
        this._push();
    }

    loadPlan(name: string): api.FlightPlanData {
        if (Object.keys(this.data).indexOf(name) > -1) {
            // cast L objects
            this.data[name].waypoints.forEach((wp: api.Waypoint) => {
                wp.geo = wp.geo.map((p: L.LatLng) => {
                    return new L.LatLng(p.lat, p.lng, p.alt);
                });
            });
            return this.data[name];
        } else {
            console.warn(`No flight plan named \"${name}\"`);
            return null;
        }
    }
}



// --- singleton classes for current user ---
export const planManager = new FlightPlanManager();


export function setupFlightPlans() {
    const myPlan = planManager.newPlan("me", "me");
    const groupPlan = planManager.newPlan("group", "group");

    groupPlan.onAddWaypoint = (index: number) => {
        const msg: api.FlightPlanUpdate = {
            timestamp: Date.now(),
            hash: hash_flightPlanData(groupPlan.plan),
            index: index,
            action: api.WaypointAction.new,
            data: groupPlan.plan.waypoints[index]
        }
        client.updateWaypoint(msg);
    };

    groupPlan.onDeleteWaypoint = (index) => {
        const msg: api.FlightPlanUpdate = {
            timestamp: Date.now(),
            hash: hash_flightPlanData(groupPlan.plan),
            index: index,
            action: api.WaypointAction.delete,
            data: groupPlan.plan.waypoints[index] 
        }
        client.updateWaypoint(msg);
    };

    groupPlan.onSortWaypoint = (waypoint: api.Waypoint, index: number, new_index: number) => {
        const msg: api.FlightPlanUpdate = {
            timestamp: Date.now(),
            hash: hash_flightPlanData(groupPlan.plan),
            index: index,
            new_index: new_index,
            action: api.WaypointAction.sort,
            data: waypoint
        }
        client.updateWaypoint(msg);
    };

    groupPlan.onModifyWaypoint = (index) => {
        const msg: api.FlightPlanUpdate = {
            timestamp: Date.now(),
            hash: hash_flightPlanData(groupPlan.plan),
            index: index,
            action: api.WaypointAction.modify,
            data: groupPlan.plan.waypoints[index] 
        }
        client.updateWaypoint(msg);
    };
}
