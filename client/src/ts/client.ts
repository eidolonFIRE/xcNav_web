import { io, Socket } from "socket.io-client";
const hash_sum = require("hash-sum");
import * as _ from "lodash";

import * as api from "../../../common/ts/api";
import * as chat from "./chat";
import { me, localPilots, processNewLocalPilot } from "./pilots";
import * as cookies from "./cookies";
import { contacts, updateContactEntry, updateInviteLink } from "./contacts";
import { groupPlan, planManager } from "./flightPlan";


// const _ip = process.env.NODE_ENV == "development" ? "http://localhost:3000" :
const _ip = "192.168.1.101:3000";
const socket = io(_ip, {
//   withCredentials: true,
//   extraHeaders: {
//     "xcNav": "abcd"
//   }
});

socket.on("connect", () => {
    console.log("connected:", socket.id);

    if (me.secret_id == "") {
        register();
    } else {
        login();
    }
});
  
socket.on("disconnect", () => {
    console.log("disconnected:", socket.id);
});


// ############################################################################
//
//     Async Receive from Server
//
// ############################################################################

// --- new text message from server
socket.on("TextMessage", (msg: api.TextMessage) => {
    if (msg.group_id == me.group) {
        // TODO: manage message ordering (msg.index and msg.time)
        chat.createMessage(msg.pilot_id, msg.text, false, null, false);
    } else {
        // getting messages from the wrong group!
        console.error("Wrong group ID!", me.group, msg.group_id);
    }
});

//--- receive location of other pilots
socket.on("PilotTelemetry", (msg: api.PilotTelemetry) => {
    // if we know this pilot, update their telemetry
    if (Object.keys(localPilots).indexOf(msg.pilot_id) > -1) {
        localPilots[msg.pilot_id].updateTelemetry(msg.telemetry);
    }
});

// --- new Pilot to group
socket.on("PilotJoinedGroup", (msg: api.PilotJoinedGroup) => {
    if (msg.pilot.id != me.id) {
        // update localPilots with new info
        processNewLocalPilot(msg.pilot);
    }
});

// --- Pilot left group
socket.on("PilotLeftGroup", (msg: api.PilotLeftGroup) => {
    if (msg.pilot_id == me.id) return;
    delete localPilots[msg.pilot_id];
    if (msg.new_group_id != api.nullID) {
        // TODO: prompt yes/no should we follow them to new group
    }
});

// --- Full flight plan sync
socket.on("FlightPlanSync", (msg: api.FlightPlanSync) => {
    groupPlan.replaceData(msg.flight_plan);
});

// --- Process an update to group flight plan
socket.on("FlightPlanUpdate", (msg: api.FlightPlanUpdate) => {
    // make backup copy of the plan
    const plan = groupPlan.plan;
    const backup = _.cloneDeep(plan);

    // update the plan
    switch (msg.action) {
        case api.WaypointAction.delete:
            // Delete a waypoint
            plan.waypoints.splice(msg.index, 1);
            break;
        case api.WaypointAction.new:
            // insert a new waypoint
            plan.waypoints.splice(msg.index, 0, msg.data);

            break;
        case api.WaypointAction.sort:
            // Reorder a waypoint
            const wp = plan.waypoints[msg.index];
            plan.waypoints.splice(msg.index, 1);
            plan.waypoints.splice(msg.new_index, 0, wp);
            break;
        case api.WaypointAction.modify:
            // Make updates to a waypoint
            if (msg.data != null) {
                plan.waypoints[msg.index] = msg.data;
            }
            break;
        case api.WaypointAction.none:
            // no-op
            break;
    }

    // TODO: investigate hashing that works
    // const hash = hash_sum(plan);
    // if (hash != msg.hash) {
    //     // DE-SYNC ERROR
    //     // restore backup
    //     groupPlan.replaceData(backup);

    //     // we are out of sync!
    //     requestGroupInfo(me.group);
    // }
});

// ############################################################################
//
//     Async Send to Server
//
// ############################################################################

// --- send a text message
export function chatMsg(text: string) {
    const textMsg = {
        timestamp: {
            msec: Date.now(),
        } as api.Timestamp,
        index: 0,
        group_id: me.group,
        pilot_id: me.id,
        text: text,
    } as api.TextMessage;

    socket.emit("TextMessage", textMsg);
}

// --- send our telemetry
export function sendTelemetry(timestamp: api.Timestamp, geoPos: GeolocationCoordinates, fuel: number) {
    if (!socket.connected) return;

    const msg = {
        timestamp: timestamp,
        pilot_id: me.id,
        telemetry: {
            geoPos: geoPos,
            fuel: fuel,
        } as api.Telemetry,
    } as api.PilotTelemetry;
    socket.emit("PilotTelemetry", msg);
}

export function updateWaypoint(msg: api.FlightPlanUpdate) {
    socket.emit("FlightPlanUpdate", msg);
}


// ############################################################################
//
//     Register
//
// ############################################################################
export function register() {
    const pilot = {
        id: me.id,
        name: me.name,
    } as api.PilotMeta;
    const request = {
        pilot: pilot,
        sponsor: api.nullID, // TODO: include sponsor ID (pilot who invited)
    } as api.RegisterRequest;
    socket.emit("RegisterRequest", request);
}

socket.on("RegisterResponse", (msg: api.RegisterResponse) => {
    if (msg.status) {
        // TODO: handle error
        // msg.status (api.ErrorCode)
        console.error("Error Registering");
    } else {
        // update my ID
        me.secret_id = msg.secret_id;
        me.id = msg.pilot_id;
        cookies.set("me.public_id", msg.pilot_id, 9999);
        cookies.set("me.secret_id", msg.secret_id, 9999);

        // proceed to login
        login();
    }
});


// ############################################################################
//
//     Login
//
// ############################################################################
export function login() {
    const request = {
        secret_id: me.secret_id,
        pilot_id: me.id,
    } as api.LoginRequest;
    socket.emit("LoginRequest", request);
}

socket.on("LoginResponse", (msg: api.LoginResponse) => {
    if (msg.status) {
        if (msg.status == api.ErrorCode.invalid_secret_id || msg.status == api.ErrorCode.invalid_id) {
            // we aren't registered on this server
            register();
            return;
        } else {
            console.error("Error Logging in.");
        }
    } else {
        // compare API version
        if (msg.api_version > api.api_version) {
            console.error("Client is out of date!");
        } else if (msg.api_version < api.api_version) {
            console.error("Server is out of date!");
        }

        // save id
        cookies.set("me.public_id", msg.pilot_id, 9999);

        // follow invite link
        const queryString = window.location.search;
        const urlParams = new URLSearchParams(queryString);
        if (urlParams.has("invite")) {
            // join using url invite
            const invite_id = urlParams.get("invite").toLowerCase();
            console.log("Following url invite", invite_id);
            joinGroup(invite_id);
            // clear the invite from the url
            window.history.pushState({}, document.title, window.location.pathname)
        } else if (me.group != api.nullID) {
            // attempt to re-join group
            console.log("Rejoining previous group", me.group);
            joinGroup(me.group);
        }

        updateInviteLink(me.id);
    }
});


// ############################################################################
//
//     Update Profile
//
// ############################################################################

// TODO: implement request/response


// ############################################################################
//
//     Get Group Info
//
// ############################################################################
export function requestGroupInfo(group_id: api.ID) {
    const request = {
        group_id: group_id,
    } as api.GroupInfoRequest;
    socket.emit("GroupInfoRequest", request);
}

socket.on("GroupInfoResponse", (msg: api.GroupInfoResponse) => {
    if (msg.status) {
        console.error("Error getting group info", msg.status);
    } else {
        // ignore if it's not a group I'm in
        if (msg.group_id != me.group) {
            console.warn("Received info for another group.");
            return;
        }

        // update map layers from group
        msg.map_layers.forEach((layer: string) => {
            // TODO: handle map_layers from the group
        });

        // update localPilots with new info
        msg.pilots.forEach((pilot: api.PilotMeta) => {
            if (pilot.id != me.id) processNewLocalPilot(pilot);
        });

        planManager.plans["group"].replaceData(msg.flight_plan);
    }
});


// ############################################################################
//
//     Get Chat Log
//
// ############################################################################

// TODO: implement request/response


// ############################################################################
//
//     Join a group
//
// ############################################################################
export function joinGroup(target_id: api.ID) {
    const request = {
        target_id: target_id,
    } as api.JoinGroupRequest;
    socket.emit("JoinGroupRequest", request);
    console.log("Requesting Join Group", target_id);
}

socket.on("JoinGroupResponse", (msg: api.JoinGroupResponse) => {
    if (msg.status) {
        // not a valid group
        if (msg.status == api.ErrorCode.invalid_id) {
            console.error("Attempted to join invalid group.");
        } else if (msg.status == api.ErrorCode.no_op && msg.group_id == me.group) {
            // we were already in this group... update anyway
            me.setGroup(msg.group_id);
        } else {
            console.error("Error joining group", msg.status);
        }
    } else {
        me.setGroup(msg.group_id);
    }    
});


// ############################################################################
//
//     Leave group
//
// ############################################################################
export function leaveGroup(prompt_split: boolean) {
    const request: api.LeaveGroupRequest = {
        prompt_split: prompt_split
    }
    socket.emit("LeaveGroupRequest", request);
}

socket.on("LeaveGroupResponse", (msg: api.LeaveGroupResponse) => {
    if (msg.status) {
        if (msg.status == api.ErrorCode.no_op && me.group == api.nullID) {
            // It's ok, we were pretty sure we weren't in a group anyway.
        } else {
            console.error("Error leaving group", msg.status);
        }
    } else {
        me.setGroup(msg.group_id);
    }
});


// ############################################################################
//
//     Get Pilot Statuses
//
// ############################################################################
export function checkPilotsOnline(pilots: any[]) {
    const request = {
        pilot_ids: []
    } as api.PilotsStatusRequest;
    Object.values(pilots).forEach((pilot) => {
        request.pilot_ids.push(pilot.id);
    });
    socket.emit("PilotsStatusRequest", request);
}

socket.on("PilotsStatusResponse", (msg: api.PilotsStatusResponse) => {
    if (msg.status) {
        console.error("Error getting pilot statuses", msg.status);
    } else {
        // TODO: should this be throttled?
        Object.entries(msg.pilots_online).forEach(([pilot_id, online]) => {
            contacts[pilot_id].online = online;
            updateContactEntry(pilot_id);
        });
    }
});
