import { io } from "socket.io-client";
import * as proto from "../proto/protocol";
import * as chat from "./chat";
import { me, localPilots } from "./pilots";


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


// new text mesasge from server
socket.on("TextMessage", (msg: proto.TextMessage) => {
    console.log("Msg from server", msg);

    if (msg.group_id == me.group()) {
        // TODO: manage message ordering (msg.index and msg.time)
        chat.createMessage(msg.pilot_id, msg.msg, false, null, false);
    } else {
        // getting messages from the wrong group!
        console.error("Wrong group ID!", me.group(), msg.group_id);
    }
});


// confirmation of joining group
socket.on("JoinGroupResponse", (msg: proto.JoinGroupResponse) => {
    console.log("Confirmed in group", msg.group_id);
    me.group(msg.group_id);

    // update group info
    requestGroupInfo(me.group());
});

// receive group info
socket.on("GroupInfoResponse", (msg: proto.GroupInfoResponse) => {
    // ignore if wrong group
    if (msg.group_id != me.group()) return;

    // update localPilots with new info
    Object.values(msg.pilots).forEach((pilot: proto.Pilot) => {
    // msg.pilots.forEach((pilot: proto.Pilot) => {
        // TODO
        if (Object.keys(localPilots).indexOf(pilot.id) > -1) {
            // update pilot we know
        } else {
            // new-to-us pilot
        }
    });
});


// register myself with server
export function register() {
    const pilot = {
        id: me.id,
        name: me.name,
    } as proto.Pilot;

    // register with server
    console.log("Registering as", pilot);
    socket.emit("Register", pilot);

    // TEMPORARY: temporarily connect to default group for now
    joinGroup("default");
}

// join a flight group
export function joinGroup(target_group: proto.ID) {
    const request = {
        pilot_id: me.id,
        target_group_id: target_group,
        target_pilot_id: proto.nullID,
    } as proto.JoinGroupRequest;
    socket.emit("JoinGroupRequest", request);
}

// join on a pilot
export function joinPilot(target_pilot: proto.ID) {
    const request = {
        pilot_id: me.id,
        target_group_id: proto.nullID,
        target_pilot_id: target_pilot,
    } as proto.JoinGroupRequest;
    socket.emit("JoinGroupRequest", request);
}

// request group info
export function requestGroupInfo(group_id: proto.ID) {
    const request = {
        group_id: group_id,
    } as proto.GroupInfoRequest;
    socket.emit("GroupInfoRequest", request);
}

// send a text message
export function chatMsg(text: string) {
    const textMsg = {
        timestamp: {
            msec: Date.now(), // TODO: test timestamp is using the same time epoch
        } as proto.Timestamp,
        index: 0,
        group_id: me.group(),
        pilot_id: me.id,
        msg: text,
    } as proto.TextMessage;

    socket.emit("TextMessage", textMsg);
}

// send our location
export function sendLocation(location: L.LatLng, timestamp: number) {
    const locMsg = {
        timestamp: {
            msec: timestamp,
        } as proto.Timestamp,
        pilot_id: me.id,
        location: {
            lat: location.lat,
            long: location.lng,
            alt: location.alt,
            tol: 0, // TODO: set accuracy
        } as proto.Location,
    } as proto.PilotLocation;
    socket.emit("PilotLocation", locMsg);
}

