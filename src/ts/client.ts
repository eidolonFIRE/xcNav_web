import { io } from "socket.io-client";
import * as proto from "../proto/protocol";
import * as me from "./me";
import * as chat from "./chat";


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
});



export function register() {
    // register with server
    console.log("Registering as", me.pilot());
    socket.emit("Register", me.pilot());

    // TODO: connect to default group for now
    joinGroup("default");
}


// send a text message
export function chatMsg(text: string) {
    const textMsg = {
        time: {
            msec: Date.now(),
        } as proto.Timestamp,
        index: 0,
        group_id: me.group(),
        pilot_id: me.ID(),
        msg: text,
    } as proto.TextMessage;

    socket.emit("TextMessage", textMsg);
}

// join a flight group
export function joinGroup(target_group: proto.ID) {
    const request = {
        pilot_id: me.ID(),
        target_group_id: target_group,
        target_pilot_id: "",
    } as proto.JoinGroupRequest;
    socket.emit("JoinGroupRequest", request);
}

// join on a pilot
export function joinPilot(target_pilot: proto.ID) {
    const request = {
        pilot_id: me.ID(),
        target_group_id: "",
        target_pilot_id: target_pilot,
    } as proto.JoinGroupRequest;
    socket.emit("JoinGroupRequest", request);
}

