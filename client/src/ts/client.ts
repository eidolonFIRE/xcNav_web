import { io } from "socket.io-client";
import * as api from "../../../api/src/api";
import * as chat from "./chat";
import { me, localPilots, processNewLocalPilot } from "./pilots";
import * as cookies from "./cookies";


// TODO: At compile time, build flag should switch the server location
// between localhost (development) and remote server (production)
const socket = io("http://localhost:3000", {
  withCredentials: true,
  extraHeaders: {
    "my-custom-header": "xcNav"
  }
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


// ========================================================================
//
//     Async Receive from Server
//
// ------------------------------------------------------------------------

// --- new text message from server
socket.on("TextMessage", (msg: api.TextMessage) => {
    console.log("Msg from server", msg);

    if (msg.group_id == me.group()) {
        // TODO: manage message ordering (msg.index and msg.time)
        chat.createMessage(msg.pilot_id, msg.text, false, null, false);
    } else {
        // getting messages from the wrong group!
        console.error("Wrong group ID!", me.group(), msg.group_id);
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
    if (msg.group_id != me.group() || msg.pilot.id == me.id) return;
    // update localPilots with new info
    processNewLocalPilot(msg.pilot);
});

// --- Pilot left group
socket.on("PilotLeftGroup", (msg: api.PilotLeftGroup) => {
    if (msg.group_id != me.group() || msg.pilot_id == me.id) return;
    // TODO: should we perge them from local or mark them inactive?
    // should we follow them?
    if (msg.prompt && msg.new_group_id != api.nullID) {
        // TODO: prompt yes/no should we follow them to new group
    }
});


// ========================================================================
//
//     Async Send to Server
//
// ------------------------------------------------------------------------

// --- send a text message
export function chatMsg(text: string) {
    const textMsg = {
        timestamp: {
            msec: Date.now(),
        } as api.Timestamp,
        index: 0,
        group_id: me.group(),
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



// ========================================================================
//
//     Register
//
// ------------------------------------------------------------------------
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
    } else {
        // update my ID
        me.secret_id = msg.secret_id;
        me.id = msg.pilot_id;
        cookies.set("me.secret_id", msg.secret_id, 0); // TODO: verify infinite expiry date of "0 days"

        // proceed to login
        login();
    }
});


// ========================================================================
//
//     Login
//
// ------------------------------------------------------------------------
export function login() {
    const request = {
        secret_id: me.secret_id,
        pilot_id: me.id,
    } as api.LoginRequest;
    socket.emit("LoginRequest", request);
}

socket.on("LoginResponse", (msg: api.LoginResponse) => {
    if (msg.status) {
        // TODO: handle error
        // msg.status (api.ErrorCode)
    } else {
        // compare API version
        if (msg.api_version > api.api_version) {
            console.error("Client is out of date!");
        } else if (msg.api_version < api.api_version) {
            console.error("Server is out of date!");
        }
    }
});


// ========================================================================
//
//     Update Profile
//
// ------------------------------------------------------------------------

// TODO: implement request/response


// ========================================================================
//
//     Get Group Info
//
// ------------------------------------------------------------------------
export function requestGroupInfo(group_id: api.ID) {
    const request = {
        group_id: group_id,
    } as api.GroupInfoRequest;
    socket.emit("GroupInfoRequest", request);
}

socket.on("GroupInfoResponse", (msg: api.GroupInfoResponse) => {
    if (msg.status) {
        // TODO: handle error
        // msg.status (api.ErrorCode)
    } else {
        // ignore if it's not a group I'm in
        if (msg.group_id != me.group()) {
            console.warn("Received info for another group.");
            return;
        }

        // update map layers from group
        msg.map_layers.forEach((layer: string) => {
            // TODO: handle map_layers from the group
        });

        // update localPilots with new info
        msg.pilots.forEach((pilot: api.PilotMeta) => {
            console.log("New Remote Pilot", pilot);
            if (pilot.id != me.id) processNewLocalPilot(pilot);
        });
    }
});


// ========================================================================
//
//     Get Chat Log
//
// ------------------------------------------------------------------------

// TODO: implement request/response


// ========================================================================
//
//     Join a group
//
// ------------------------------------------------------------------------
export function joinGroup(target_group: api.ID, target_pilot: api.ID) {
    const request = {
        pilot_id: me.id,
        target_group_id: target_group,
        target_pilot_id: target_pilot,
    } as api.JoinGroupRequest;
    socket.emit("JoinGroupRequest", request);
}

socket.on("JoinGroupResponse", (msg: api.JoinGroupResponse) => {
    if (msg.status) {
        // TODO: handle error
        // msg.status (api.ErrorCode)
    } else {
        console.log("Confirmed in group", msg.group_id);
        me.group(msg.group_id);

        // update group info
        requestGroupInfo(me.group());
    }
});


// ========================================================================
//
//     Leave group
//
// ------------------------------------------------------------------------

// TODO: implement request/response
