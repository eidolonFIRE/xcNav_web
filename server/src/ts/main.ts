import { createServer } from "http";
import { Server, Socket } from "socket.io";

import * as api from "../../../api/src/api";
import { myDB } from "./db";

const httpServer = createServer();
const io = new Server(httpServer, {
    cors: {
      origin: "http://localhost",
      methods: ["GET", "POST"],
      allowedHeaders: ["my-custom-header"], // TODO: pick a new "header"
      credentials: true
    }
});


// all registered pilot connections
let clients: Record<api.ID, Socket> = {};

function hasClient(pilot_id: api.ID): boolean {
    return Object.keys(clients).indexOf(pilot_id) > -1;
}


// Client Session
io.on("connection", (socket: Socket) => {

    // Currently the only state held by connection. Should this be removed from API
    // for a totally stateless API?
    let user: api.Pilot = {
        id: api.nullID,
        name: "unset",
    };


    console.log("connected", socket.id);

    socket.on('disconnect', function () {
        console.log('disconnected', socket.id);

        // if pilot was in chat, forget their session
        if (Object.keys(clients).indexOf(user.id) > -1) {
            delete clients[user.id];
        }
    });


    // ========================================================================
    // new user registers ID
    // ------------------------------------------------------------------------
    socket.on("Register", (request: api.Pilot) => {
        // record socket of user joining server      
        clients[request.id] = socket;
        user.id = request.id;
        user.name = request.name;
        myDB.newPilot(user.id, user.name);
        console.log("User joined server", user);
    });


    // ========================================================================
    // user joins group
    // ------------------------------------------------------------------------
    socket.on("JoinGroupRequest", (request: api.JoinGroupRequest) => {
        let target_group = api.nullID;

        if (request.target_group_id != api.nullID) {
            // join a particular group
            target_group = request.target_group_id;
        } else if (request.target_pilot_id != api.nullID) {
            // join another pilot
            target_group = myDB.findGroup(request.target_pilot_id);
        } else {
            // bad request, ignore
            return;
        }

        // only proceed if we found the target group
        if (target_group != api.nullID) {
            // add pilot to group
            myDB.addPilotToGroup(user.id, target_group);
            
            // notify client of successful joining
            const resp = {
                group_id: target_group,
            } as api.JoinGroupResponse;
            socket.emit("JoinGroupResponse", resp);

            // notify group there's a new pilot
            myDB.group_to_pilots[target_group].forEach((pilot_id: api.ID) => {
                if (pilot_id != user.id && hasClient(pilot_id)) {
                    clients[pilot_id].emit("NewPilot", myDB.pilots[request.pilot_id]);
                }
            });
            console.log("User", user.id, "joined group", target_group)
        }
    });


    // ========================================================================
    // handle request for group info
    // ------------------------------------------------------------------------
    socket.on("GroupInfoRequest", (request: api.GroupInfoRequest) => {
        console.log("Request Group Info", request);

        // if no group or user not in group, ignore request
        if (request.group_id == api.nullID || (myDB.hasPilot(user.id) && request.group_id != myDB.pilot_to_group[user.id])) return;

        // grant request
        let response = {
            group_id: request.group_id,
            pilots: [],
        } as api.GroupInfoResponse;
        myDB.group_to_pilots[request.group_id].forEach((p: api.ID) => {
            response.pilots.push(myDB.pilots[p]);
        });
        socket.emit("GroupInfoResponse", response);
    });


    // ========================================================================
    // handle request for chat history
    // ------------------------------------------------------------------------
    socket.on("ChatLogRequest", (request: api.ChatLogRequest) => {
        console.log("Request", request);

        // if no group or user not in group, ignore request
        if (request.group_id == api.nullID || (myDB.hasPilot(user.id) && request.group_id != myDB.pilot_to_group[user.id])) return;

        // grant request
        const response = {
            msgs: myDB.getChatLog(request.group_id, request.time_window),
            group_id: request.group_id,
        } as api.ChatLogResponse;
        socket.emit("ChatLogResponse", response);
    });
    

    // ========================================================================
    // handle TextMessage
    // ------------------------------------------------------------------------
    socket.on("TextMessage", (msg: api.TextMessage) => {
        console.log("Message", msg);
        
        // if no group or invalid group, ignore message
        if (msg.group_id == api.nullID || !myDB.hasGroup(msg.group_id)) return;

        // TODO: properly preserve index order. This is nieve incrimenting.
        if (myDB.group_chat[msg.group_id].length > 0) {
            msg.index = myDB.group_chat[msg.group_id][myDB.group_chat[msg.group_id].length - 1].index + 1;
        } else {
            msg.index = 0;
        }

        // record message into log
        myDB.recordChat(msg);

        // broadcast message to group
        myDB.group_to_pilots[msg.group_id].forEach((pilot_id: api.ID) => {
            if (pilot_id != user.id && hasClient(pilot_id)) {
                clients[pilot_id].emit("TextMessage", msg);
            }
        });
    });

    // ========================================================================
    // handle PilotTelemetry
    // ------------------------------------------------------------------------
    socket.on("PilotTelemetry", (tel: api.PilotTelemetry) => {
        // ignore unknown pilots
        if (!myDB.hasPilot(tel.pilot_id)) return;

        // record the location
        myDB.recordPilotTelemetry(tel);

        // if in group, broadcast location
        // TODO: only broadcast if it's recent location update?
        const group_id = myDB.findGroup(tel.pilot_id);
        if (group_id != api.nullID) {
            myDB.group_to_pilots[group_id].forEach((pilot_id: api.ID) => {
                if (pilot_id != user.id && hasClient(pilot_id)) {
                    clients[pilot_id].emit("PilotTelemetry", tel);
                }
            });
        }
    });

});





console.log("Starting Server.")
httpServer.listen(3000);

