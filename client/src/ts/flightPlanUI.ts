import icon_wp from "../img/wp.png";
import icon_wp_optional from "../img/wp_optional.png";
import icon_wp_path from "../img/wp_path.png";
import icon_wp_path_optional from "../img/wp_path_optional.png";

// import * as L from "leaflet";
// import * as GeometryUtil from "leaflet-geometryutil";
import { me } from "./pilots";
import { geoTolatlng } from "./util";
import Sortable from 'sortablejs';
import { FocusMode, getMap, setFocusMode } from "./mapUI";
import { groupPlan, LivePlan, myPlan, planManager, Waypoint } from "./flightPlan";



// ============================================================================
//
// Flight Plan UI
//
// ----------------------------------------------------------------------------
let waypoints_sortable: Sortable;
export function setupWaypointEditorUI() {
    // UI refresh triggers
    const flightPlanMenu = document.getElementById('flightPlanMenu')
    flightPlanMenu.addEventListener('show.bs.offcanvas', function () {
        refreshFlightPlanUI();
    });
    // DEBUG: refresh all markers when waypoint menu hidden
    // flightPlanMenu.addEventListener('hidden.bs.offcanvas', function () {
    //     myPlan.refreshMapMarkers();
    // });

    // sortable waypoint list
    // https://github.com/SortableJS/Sortable
    const list = document.getElementById("waypointList_me") as HTMLUListElement;
    waypoints_sortable = Sortable.create(list, {disabled: true});
    waypoints_sortable.options.onUpdate = (event: Sortable.SortableEvent) => {
        myPlan.sortWayoint(event.oldIndex, event.newIndex);
        // myPlan.cur_waypoint = event.newIndex;
        // DEBUG: useful while testing the sortable list
        // refreshFlightPlanUI();
    };

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
        waypoints_sortable.options.disabled = false;
        // waypoint button : delete
        document.querySelectorAll(".wp_list_delete_btn").forEach((element: HTMLElement) => {
            element.style.display = "inline";
            element.addEventListener("click", (ev: MouseEvent) => {
                myPlan.deleteWaypoint(element.getAttribute("data-wp"));
                element.parentNode.parentNode.removeChild(element.parentNode);
                ev.stopPropagation();
            });

        });

        // waypoint button : mode (toggle optional)
        document.querySelectorAll(".wp_list_mode_btn").forEach((element: HTMLImageElement) => {
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


function _wp_icon_selector(wp: Waypoint) {
    return wp.geo.length > 1 ? (wp.optional ? icon_wp_path_optional: icon_wp_path) : (wp.optional ? icon_wp_optional : icon_wp)
}


function _fill_waypoint_list(plan: LivePlan, list: HTMLUListElement, edit_mode:boolean=false) {
    waypoints_sortable.options.disabled = !edit_mode;

    // empty list
    while (list.firstChild) {
        list.removeChild(list.lastChild);
    }

    // repopulate the list
    plan.plan.waypoints.forEach((wp: Waypoint, index: number) => {
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


export function refreshFlightPlanUI(editMode=false) {
    const my_list = document.getElementById("waypointList_me") as HTMLUListElement;
    _fill_waypoint_list(myPlan, my_list);
    
    const group_list = document.getElementById("waypointList_group") as HTMLUListElement;
    _fill_waypoint_list(groupPlan, group_list);

}
