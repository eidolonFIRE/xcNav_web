import { io } from "socket.io-client";
import * as api from "../../../api/src/api";
import * as chat from "./chat";
import { me, localPilots, processNewLocalPilot } from "./pilots";


// TODO: At compile time, build flag should switch the server location
// between localhost (development) and Robert's server (production)
const socket = io("http://localhost:3000", {
  withCredentials: true,
  extraHeaders: {
    "my-custom-header": "abcd"
  }
});

socket.on("connect", () => {
    console.log("connected:", socket.id);
    register();
});
  
socket.on("disconnect", () => {
    console.log("disconnected:", socket.id);
});


// ========================================================================
// RX: new text mesasge from server
// ------------------------------------------------------------------------
socket.on("TextMessage", (msg: api.TextMessage) => {
    console.log("Msg from server", msg);

    if (msg.group_id == me.group()) {
        // TODO: manage message ordering (msg.index and msg.time)
        chat.createMessage(msg.pilot_id, msg.msg, false, null, false);
    } else {
        // getting messages from the wrong group!
        console.error("Wrong group ID!", me.group(), msg.group_id);
    }
});

// ========================================================================
// RX: confirmation of joining group
// ------------------------------------------------------------------------
socket.on("JoinGroupResponse", (msg: api.JoinGroupResponse) => {
    console.log("Confirmed in group", msg.group_id);
    me.group(msg.group_id);

    // update group info
    requestGroupInfo(me.group());
});

// ========================================================================
// RX: receive group info
// ------------------------------------------------------------------------
socket.on("GroupInfoResponse", (msg: api.GroupInfoResponse) => {
    console.log("Group Info", msg);
    // ignore if wrong group
    if (msg.group_id != me.group()) return;

    // update localPilots with new info
    console.log(msg.pilots);
    msg.pilots.forEach((pilot: api.Pilot) => {
        console.log("New Remote Pilot", pilot);
        if (pilot.id != me.id) processNewLocalPilot(pilot);
    });
});

// ========================================================================
// RX: new Pilot to group
// ------------------------------------------------------------------------
socket.on("NewPilot", (pilot: api.Pilot) => {
    console.log("New Pilot", pilot);

    // TODO: should be able to check here that it's correct group. Will need to change api message

    // update localPilots with new info
    console.log("New Remote Pilot", pilot);
    if (pilot.id != me.id) processNewLocalPilot(pilot);
});

// ========================================================================
// RX: receive location of other pilots
// ------------------------------------------------------------------------
socket.on("PilotTelemetry", (msg: api.PilotTelemetry) => {
    // if we know this pilot, update their telemetry
    if (Object.keys(localPilots).indexOf(msg.pilot_id) > -1) {
        localPilots[msg.pilot_id].updateTelemetry(msg.telemetry);
    }
});






// ========================================================================
// TX: register myself with server
// ------------------------------------------------------------------------
export function register() {
    const pilot = {
        id: me.id,
        name: me.name,
    } as api.Pilot;

    // register with server
    console.log("Registering as", pilot);
    socket.emit("Register", pilot);

    // TEMPORARY: temporarily connect to default group for now
    joinGroup("default");
}

// ========================================================================
// TX: join a flight group
// ------------------------------------------------------------------------
export function joinGroup(target_group: api.ID) {
    const request = {
        pilot_id: me.id,
        target_group_id: target_group,
        target_pilot_id: api.nullID,
    } as api.JoinGroupRequest;
    socket.emit("JoinGroupRequest", request);
}

// ========================================================================
// TX: join on a pilot
// ------------------------------------------------------------------------
export function joinPilot(target_pilot: api.ID) {
    const request = {
        pilot_id: me.id,
        target_group_id: api.nullID,
        target_pilot_id: target_pilot,
    } as api.JoinGroupRequest;
    socket.emit("JoinGroupRequest", request);
}

// ========================================================================
// TX: request group info
// ------------------------------------------------------------------------
export function requestGroupInfo(group_id: api.ID) {
    const request = {
        group_id: group_id,
    } as api.GroupInfoRequest;
    socket.emit("GroupInfoRequest", request);
}

// ========================================================================
// TX: send a text message
// ------------------------------------------------------------------------
export function chatMsg(text: string) {
    const textMsg = {
        timestamp: {
            msec: Date.now(), // TODO: test timestamp is using the same time epoch
        } as api.Timestamp,
        index: 0,
        group_id: me.group(),
        pilot_id: me.id,
        msg: text,
    } as api.TextMessage;

    socket.emit("TextMessage", textMsg);
}

// ========================================================================
// TX: send our telemetry
// ------------------------------------------------------------------------
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
