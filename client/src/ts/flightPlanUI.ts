import icon_wp from "../img/wp.png";
import icon_wp_optional from "../img/wp_optional.png";
import icon_wp_path from "../img/wp_path.png";
import icon_wp_path_optional from "../img/wp_path_optional.png";

// import * as L from "leaflet";
// import * as GeometryUtil from "leaflet-geometryutil";
import { localPilots, me } from "./pilots";
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
    const flightPlanVisible_group = document.getElementById("flightPlanVisible_group") as HTMLInputElement;
    flightPlanVisible_group.addEventListener("click", (ev: MouseEvent) => {
        planManager.plans["group"].visible = flightPlanVisible_group.checked;
    });

    // my plan visible
    const flightPlanVisible_me = document.getElementById("flightPlanVisible_me") as HTMLInputElement;
    flightPlanVisible_me.addEventListener("click", (ev: MouseEvent) => {
        planManager.plans["me"].visible = flightPlanVisible_me.checked;
    });

    // empty my plan
    const emptyFP_me = document.getElementById("flightPlanClear_me") as HTMLButtonElement;
    emptyFP_me.addEventListener("click", (ev: MouseEvent) => {
        while (planManager.plans["me"].plan.waypoints.length > 0) {
            planManager.plans["me"].deleteWaypoint(0);
        };
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
            });
        });

        // waypoint button : mode (toggle optional)
        document.querySelectorAll(".wp_list_mode_btn").forEach((element: HTMLImageElement) => {
            element.addEventListener("click", (ev: MouseEvent) => {
                const plan = planManager.plans[element.closest(".wp_list").id.substr(13)];
                const wp_name = element.getAttribute("data-wp");
                plan.setOptional(wp_name);
                element.src = _wp_mode_icon_selector(plan.plan.waypoints[plan._waypoint(wp_name)]);
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


export function refreshAllMapMarkers() {
    Object.values(planManager.plans).forEach((plan) => {
        plan.refreshMapMarkers();
    });
}


function _wp_mode_icon_selector(wp: api.Waypoint) {
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
        const wp_mode_icon = entry.getElementsByClassName("wp_list_mode_btn")[0] as HTMLImageElement;
        wp_mode_icon.src = _wp_mode_icon_selector(wp);
        wp_mode_icon.setAttribute("data-wp", wp.name);
        
        // wp delete button
        const wp_del = entry.getElementsByClassName("wp_list_delete_btn")[0] as HTMLImageElement;
        wp_del.style.display = edit_mode ? "block" : "none"
        wp_del.setAttribute("data-wp", wp.name);

        // set waypoint name
        const wp_name = entry.getElementsByClassName("wp_name")[0] as HTMLSpanElement;
        wp_name.textContent = wp.name;

        // change waypoint icon
        const wp_icon = entry.querySelectorAll("#wp_list_icon")[0] as HTMLSpanElement;
        if (wp.icon != null) {
            const wp_icon = entry.querySelectorAll("#wp_list_icon")[0] as HTMLSpanElement;
            wp_icon.classList.add("fas");
            wp_icon.classList.add("fa-" + wp.icon);
        } else {
            wp_icon.style.opacity = "0%";
        }

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
