import { io } from "socket.io-client";
import * as proto from "../proto/main";


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

socket.on("TextMessage", (data: proto.TextMessage) => {
    console.log("Msg from server", data);
});



export function sendMsg(text: string) {
    const textMsg = {
        time: {
            msec: Date.now(),
        } as proto.Timestamp,
        group_id: "",
        pilot_id: "",
        msg: text,
    } as proto.TextMessage;

    socket.emit("TextMessage", textMsg);
}
