import icon_wp from "../img/wp.png";
import icon_wp_optional from "../img/wp_optional.png";
import icon_wp_path from "../img/wp_path.png";
import icon_wp_path_optional from "../img/wp_path_optional.png";

// import * as L from "leaflet";
// import * as GeometryUtil from "leaflet-geometryutil";
import { me } from "./pilots";
import { geoTolatlng } from "./util";
import { FocusMode, getMap, setFocusMode } from "./mapUI";
import { groupPlan, FlightPlan, myPlan, planManager } from "./flightPlan";
import * as api from "../../../common/ts/api";



// ============================================================================
//
// Flight Plan UI
//
// ----------------------------------------------------------------------------
export function setupWaypointEditorUI() {
    // UI refresh triggers
    const flightPlanMenu = document.getElementById('flightPlanMenu');
    flightPlanMenu.addEventListener('show.bs.offcanvas', function () {
        refreshFlightPlanUI();
    });
    // DEBUG: refresh all markers when waypoint menu hidden
    // flightPlanMenu.addEventListener('hidden.bs.offcanvas', function () {
    //     myPlan.refreshMapMarkers();
    // });

    // waypoint list - button handlers
    const btn_add = document.getElementById("btnAddWaypoint") as HTMLButtonElement;
    btn_add.addEventListener("click", (ev: MouseEvent) => {
        // TODO: replace with real prompt (index.html)
        const name = prompt("New Waypoint Name");
        myPlan.addWaypoint(name, [geoTolatlng(me.geoPos)]);
        refreshFlightPlanUI();
    });

    const btn_edit = document.getElementById("btnEditFlightPlan") as HTMLButtonElement;
    btn_edit.addEventListener("click", (ev: MouseEvent) => {
        myPlan.setSortable(true);
        groupPlan.setSortable(true);
        // waypoint button : delete
        document.querySelectorAll(".wp_list_delete_btn").forEach((element: HTMLElement) => {
            element.style.display = "inline";
            element.addEventListener("click", (ev: MouseEvent) => {
                const plan = planManager.plans[element.parentNode.parentElement.id.substr(13)];
                plan.deleteWaypoint(element.getAttribute("data-wp"));
                element.parentNode.parentNode.removeChild(element.parentNode);
                ev.stopPropagation();
            });
        });

        // waypoint button : mode (toggle optional)
        document.querySelectorAll(".wp_list_mode_btn").forEach((element: HTMLImageElement) => {
            element.addEventListener("click", (ev: MouseEvent) => {
                const plan = planManager.plans[element.parentNode.parentElement.id.substr(13)];
                const wp_name = element.getAttribute("data-wp");
                plan.setOptional(wp_name);
                element.src = _wp_icon_selector(plan.plan.waypoints[plan._waypoint(wp_name)]);
                ev.stopPropagation();
            });
        });

        // edit view mode
        // myPlan.refreshMapMarkers(true);
        setFocusMode(FocusMode.edit_plan);
    });

    const btn_reverse = document.getElementById("btnReverseFlightPlan") as HTMLButtonElement;
    btn_reverse.addEventListener("click", (ev: MouseEvent) => {
        const icon = document.getElementById("btnReverseFlightPlan_icon") as HTMLImageElement;
        if (myPlan.reverse()) {
            icon.classList.add("fa-angle-double-up");
            icon.classList.remove("fa-angle-double-down");
        } else {
            icon.classList.remove("fa-angle-double-up");
            icon.classList.add("fa-angle-double-down");
        }
    });

    // add visual layer to leaflet
    getMap().addLayer(planManager.mapLayer);
}


function _wp_icon_selector(wp: api.Waypoint) {
    return wp.geo.length > 1 ? (wp.optional ? icon_wp_path_optional: icon_wp_path) : (wp.optional ? icon_wp_optional : icon_wp)
}


function _fill_waypoint_list(plan: FlightPlan, list_id: string, edit_mode:boolean=false) {
    const list = document.getElementById(list_id) as HTMLUListElement;

    plan.setSortable(edit_mode);

    // empty list
    while (list.firstChild) {
        list.removeChild(list.lastChild);
    }

    // repopulate the list
    plan.plan.waypoints.forEach((wp: api.Waypoint, index: number) => {
        let content = "";

        // wp type/mode indicator icon
        const wp_icon = document.createElement("img") as HTMLImageElement;
        wp_icon.src = _wp_icon_selector(wp);
        wp_icon.className = "wp_list_mode_btn";
        wp_icon.setAttribute("data-wp", wp.name);
        
        // wp delete button
        const wp_del = document.createElement("img") as HTMLImageElement;
        wp_del.className = "fas fa-times-circle btn-outline-danger text-right wp_list_delete_btn"
        wp_del.style.display = edit_mode ? "block" : "none"
        wp_del.setAttribute("data-wp", wp.name);

        // set html
        const entry = document.createElement("li") as HTMLLIElement;
        entry.appendChild(wp_icon);
        entry.innerHTML += wp.name;
        entry.appendChild(wp_del);
        
        entry.className = "list-group-item";
        if (index == plan.cur_waypoint) entry.classList.add("active");

        entry.addEventListener("click", (ev: MouseEvent) => {
            // unselect all
            Object.values(list.children).forEach((item) => {
                item.classList.remove("active");
            });
            // select the one
            entry.classList.add("active");
            plan.setCurWaypoint(index);
        });

        list.appendChild(entry);
    });
}





export function refreshFlightPlanUI(edit_mode=false) {

    _fill_waypoint_list(myPlan, "waypointList_me");

    if (me.group != api.nullID) {
        _fill_waypoint_list(groupPlan, "waypointList_group");
    }
}
