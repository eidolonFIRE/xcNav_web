import { io } from "socket.io-client";
import * as proto from "../proto/protocol";
import * as user from "./user";
import * as chat from "./chat";


const socket = io("http://localhost:3000", {
  withCredentials: true,
  extraHeaders: {
    "my-custom-header": "abcd"
  }
});

socket.on("connect", () => {
    console.log("connected:", socket.id);
});
  
socket.on("disconnect", () => {
    console.log("disconnected:", socket.id);
});


// new text mesasge from server
socket.on("TextMessage", (msg: proto.TextMessage) => {
    console.log("Msg from server", msg);

    if (msg.group_id == user.group()) {
        // TODO: manage message ordering (msg.index and msg.time)
        chat.createMessage(msg.pilot_id, msg.msg, false, null, false);
    } else {
        // getting messages from the wrong group!
        console.error("Wrong group ID!", user.group(), msg.group_id);
    }
});



export function chatMsg(text: string) {
    const textMsg = {
        time: {
            msec: Date.now(),
        } as proto.Timestamp,
        index: 0,
        group_id: "",
        pilot_id: user.ID(),
        msg: text,
    } as proto.TextMessage;

    socket.emit("TextMessage", textMsg);
}
