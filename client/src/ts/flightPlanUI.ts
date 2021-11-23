import icon_wp from "../img/wp.png";
import icon_wp_optional from "../img/wp_optional.png";
import icon_wp_path from "../img/wp_path.png";
import icon_wp_path_optional from "../img/wp_path_optional.png";

// import * as L from "leaflet";
// import * as GeometryUtil from "leaflet-geometryutil";
import { localPilots, me } from "./pilots";
import { geoTolatlng } from "./util";
import { FocusMode, getMap, setFocusMode } from "./mapUI";
import { FlightPlan, planManager } from "./flightPlan";
import * as api from "../../../server/src/ts/api";
import { getAvatar } from "./contacts";



// ============================================================================
//
// Flight Plan UI
//
// ----------------------------------------------------------------------------
export function setupWaypointEditorUI() {
    // UI refresh triggers
    const flightPlanMenu = document.getElementById("flightPlanMenu");
    flightPlanMenu.addEventListener("show.bs.offcanvas", () => {
        refreshFlightPlanUI();
    });
    flightPlanMenu.addEventListener("hidden.bs.offcanvas", () => {
        // hide the clear-all button
        const emptyFP_me = document.getElementById("flightPlanClear_me") as HTMLButtonElement;
        emptyFP_me.style.visibility = "hidden";

        // DEBUG: refresh all markers when waypoint menu hidden
        // planManager.plans["me"].refreshMapMarkers();
    });

    // group plan visible
    const toggleFPvis_group = document.getElementById("flightPlanVisible_group") as HTMLButtonElement;
    toggleFPvis_group.addEventListener("click", (ev: MouseEvent) => {
        const icon = document.getElementById("fp_visible_group");
        if (planManager.plans["group"].toggleVisible()) {
            icon.classList.replace("fa-eye-slash", "fa-eye");
        } else {
            icon.classList.replace("fa-eye", "fa-eye-slash");
        }
    });

    // my plan visible
    const toggleFPvis_me = document.getElementById("flightPlanVisible_me") as HTMLButtonElement;
    toggleFPvis_me.addEventListener("click", (ev: MouseEvent) => {
        const icon = document.getElementById("fp_visible_me");
        if (planManager.plans["me"].toggleVisible()) {
            icon.classList.replace("fa-eye-slash", "fa-eye");
        } else {
            icon.classList.replace("fa-eye", "fa-eye-slash");
        }
    });

    // empty my plan
    const emptyFP_me = document.getElementById("flightPlanClear_me") as HTMLButtonElement;
    emptyFP_me.addEventListener("click", (ev: MouseEvent) => {
        while (planManager.plans["me"].plan.waypoints.length > 0) {
            planManager.plans["me"].deleteWaypoint(0);
        };
        refreshFlightPlanUI();
    });

    // waypoint list - button handlers
    const btn_add = document.getElementById("btnAddWaypoint") as HTMLButtonElement;
    btn_add.addEventListener("click", (ev: MouseEvent) => {
        // TODO: replace with real prompt (index.html)
        const name = prompt("New Waypoint Name");
        planManager.plans["me"].addWaypoint(name, [geoTolatlng(me.geoPos)]);
        refreshFlightPlanUI();
    });

    const btn_edit = document.getElementById("btnEditFlightPlan") as HTMLButtonElement;
    btn_edit.addEventListener("click", (ev: MouseEvent) => {
        const emptyFP_me = document.getElementById("flightPlanClear_me") as HTMLButtonElement;
        emptyFP_me.style.visibility = "visible";
        planManager.plans["me"].setSortable(true);
        planManager.plans["group"].setSortable(true);
        // waypoint button : delete
        document.querySelectorAll(".wp_list_delete_btn").forEach((element: HTMLElement) => {
            element.style.display = "inline";
            element.addEventListener("click", (ev: MouseEvent) => {
                const plan = planManager.plans[element.closest(".wp_list").id.substr(13)];
                plan.deleteWaypoint(element.getAttribute("data-wp"));
                element.closest(".wp_list").removeChild(element.closest(".wp_list_item"));
                ev.stopPropagation();
                console.log("Delete", element.getAttribute("data-wp"))
            });
        });

        // waypoint button : mode (toggle optional)
        document.querySelectorAll(".wp_list_mode_btn").forEach((element: HTMLImageElement) => {
            element.addEventListener("click", (ev: MouseEvent) => {
                const plan = planManager.plans[element.closest(".wp_list").id.substr(13)];
                const wp_name = element.getAttribute("data-wp");
                plan.setOptional(wp_name);
                element.src = _wp_icon_selector(plan.plan.waypoints[plan._waypoint(wp_name)]);
                ev.stopPropagation();
            });
        });

        // edit view mode
        setFocusMode(FocusMode.edit_plan);
    });

    const btn_reverse = document.getElementById("btnReverseFlightPlan") as HTMLButtonElement;
    btn_reverse.addEventListener("click", (ev: MouseEvent) => {
        const icon = document.getElementById("btnReverseFlightPlan_icon") as HTMLImageElement;
        if (planManager.plans["me"].reverse()) {
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


export function refreshAllMapMarkers(draggable: boolean) {
    Object.values(planManager.plans).forEach((plan) => {
        plan.refreshMapMarkers(draggable);
    });
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
        const entry = document.getElementById("wp_li_template").cloneNode(true) as HTMLLIElement;
        entry.style.visibility = "visible";
        entry.style.display = "block";

        // wp type/mode indicator icon
        const wp_icon = entry.getElementsByClassName("wp_list_mode_btn")[0] as HTMLImageElement;
        wp_icon.src = _wp_icon_selector(wp);
        wp_icon.setAttribute("data-wp", wp.name);
        
        // wp delete button
        const wp_del = entry.getElementsByClassName("wp_list_delete_btn")[0] as HTMLImageElement;
        wp_del.style.display = edit_mode ? "block" : "none"
        wp_del.setAttribute("data-wp", wp.name);

        // set waypoint name
        const wp_name = entry.getElementsByClassName("wp_name")[0] as HTMLSpanElement;
        wp_name.textContent = wp.name;

        // pilot avatars who've selected this wp
        const avatar_container = entry.getElementsByClassName("wp_avatar_container")[0] as HTMLDivElement;
        Object.values(localPilots).forEach((pilot) => {
            if (pilot.current_waypoint.plan == plan.plan.name && pilot.current_waypoint.index == index) {
                const col = document.createElement("div") as HTMLDivElement;
                col.className = "col-2 p-0";
                const avatar = document.createElement("img") as HTMLImageElement;
                avatar.src = getAvatar(pilot.id);
                avatar.className = "pilot-avatar-icon-small";                
                col.appendChild(avatar);
                avatar_container.appendChild(col);
            }
        });

        if (me.current_waypoint.plan == plan.plan.name && index == me.current_waypoint.index) entry.classList.add("active");

        entry.addEventListener("click", (ev: MouseEvent) => {
            // unselect all
            document.querySelectorAll('[class*=" wp_list_item"]').forEach(item => {
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
    // repopulate the lists
    _fill_waypoint_list(planManager.plans["me"], "waypointList_me");

    if (me.group != api.nullID) {
        _fill_waypoint_list(planManager.plans["group"], "waypointList_group");
    }
}
