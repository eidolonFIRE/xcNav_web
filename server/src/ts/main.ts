import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { v4 as uuidv4 } from "uuid";

import * as api from "../../../common/ts/api";
import { myDB } from "./db";

const socketServer = createServer();
// const _ip = process.env.NODE_ENV == "development" ? "http://localhost" : "0.0.0.0"
const _ip = "0.0.0.0";
const io = new Server(socketServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      // TODO: investigate improving XSS security
    //   allowedHeaders: ["xcNav"],
    //   credentials: true
    }
});


interface Session {
    id: api.ID
    secret_id: api.ID
    authentic: boolean
}



// all registered pilot connections
let clients: Record<api.ID, Socket> = {};

function hasClient(pilot_id: api.ID): boolean {
    return Object.keys(clients).indexOf(pilot_id) > -1;
}


// Client Session
io.on("connection", (socket: Socket) => {
    console.log("connected", socket.id);

    // This is the only state held by connection.
    const user: Session = {
        secret_id: api.nullID,
        id: api.nullID,
        authentic: false,
    }

    // --- on client disconnected ---
    socket.on('disconnect', function () {
        console.log('disconnected', socket.id);

        // if pilot was in chat, forget their session
        if (Object.keys(clients).indexOf(user.id) > -1) {
            delete clients[user.id];
        }
    });
    // ############################################################################ 
    //
    //     Handle Bi-Directional Messages 
    //
    // ############################################################################

    // ========================================================================
    // handle TextMessage
    // ------------------------------------------------------------------------
    socket.on("TextMessage", (msg: api.TextMessage) => {
        console.log("Message", msg);
        
        // if no group or invalid group, ignore message
        if (msg.group_id == api.nullID || !myDB.hasGroup(msg.group_id)) return;

        // TODO: properly preserve index order. This is nieve incrimenting.
        if (myDB.groups[msg.group_id].chat.length > 0) {
            msg.index = myDB.groups[msg.group_id].chat[myDB.groups[msg.group_id].chat.length - 1].index + 1;
        } else {
            msg.index = 0;
        }

        // record message into log
        myDB.recordChat(msg);

        // broadcast message to group
        myDB.groups[msg.group_id].pilots.forEach((pilot_id: api.ID) => {
            if (pilot_id != user.id && hasClient(pilot_id)) {
                clients[pilot_id].emit("TextMessage", msg);
            }
        });
    });

    // ========================================================================
    // handle PilotTelemetry
    // ------------------------------------------------------------------------
    socket.on("PilotTelemetry", (msg: api.PilotTelemetry) => {
        // ignore unknown pilots
        if (!myDB.hasPilot(msg.pilot_id)) return;

        // record the location
        myDB.recordPilotTelemetry(msg);

        // if in group, broadcast location
        // TODO: only broadcast if it's recent location update?
        // const group_id = myDB.findGroup(msg.pilot_id);
        const group_id = myDB.pilots[user.id].group_id;
        if (group_id != api.nullID) {
            myDB.groups[group_id].pilots.forEach((pilot_id: api.ID) => {
                if (pilot_id != user.id && hasClient(pilot_id)) {
                    clients[pilot_id].emit("PilotTelemetry", msg);
                }
            });
        }
    });

    // ############################################################################ 
    //
    //     Handle Client Requests 
    //
    // ############################################################################


    // ========================================================================
    // Register
    // ------------------------------------------------------------------------
    socket.on("RegisterRequest", (request: api.RegisterRequest) => {
        Object.assign(user, request.pilot)
        // check IDs
        if (request.pilot.id != api.nullID) {
            // new user already has a public ID
            if (myDB.hasPilot(request.pilot.id)) {
                // Pilot is already registered (client should just login), send error message.
                const resp = {
                    status: api.ErrorCode.no_op,
                    secret_id: api.nullID,
                    pilot_id: request.pilot.id,
                } as api.RegisterResponse;
                socket.emit("RegisterResponse", resp);
            } else {
                // use their preferred public_id
                user.id = request.pilot.id;
            }
        } else {
            // create new public_id
            user.id = uuidv4().substr(0, 8);
        }

        // remember this session
        clients[user.id] = socket;

        // create a secret_id
        user.secret_id = uuidv4();
        
        // update db
        myDB.newPilot(request.pilot.name, user.id, user.secret_id, request.sponsor, request.pilot.avatar);
        console.log("User has registered", user);

        // respond success
        const resp = {
            status: api.ErrorCode.success,
            secret_id: user.secret_id,
            pilot_id: user.id,
        } as api.RegisterResponse;
        socket.emit("RegisterResponse", resp);
    });


    // ========================================================================
    // Login
    // ------------------------------------------------------------------------
    socket.on("LoginRequest", (request: api.LoginRequest) => {
        const resp = {
            status: api.ErrorCode.unknown_error,
            pilot_id: request.pilot_id,
            api_version: api.api_version,
        } as api.LoginResponse;

        // check IDs
        if (!myDB.hasPilot(request.pilot_id)) {
            // We don't know this pilot. They need to register first.
            // Respond with error.
            resp.status = api.ErrorCode.invalid_id;
        } else if (myDB.pilots[request.pilot_id].secret_id != request.secret_id) {
            // Invalid secret_id. Respond with error.
            resp.status = api.ErrorCode.invalid_secret_id;
        } else {
            // Authenticate the connected user
            user.id = request.pilot_id;
            console.log("User authenticated", user.id);
            user.authentic = true;
            // Respond seccess
            resp.status = api.ErrorCode.success;
        }
        socket.emit("LoginResponse", resp);
    }); 


    // ========================================================================
    // UpdateProfile
    // ------------------------------------------------------------------------
    socket.on("UpdateProfileRequest", (request: api.UpdateProfileRequest) => {
        if (!user.authentic) return;

        // check IDs
        if (!myDB.hasPilot(request.pilot.id)) {
            // Unknown pilot.
            // Respond Error.
            socket.emit("UpdateProfileResponse", {status: api.ErrorCode.invalid_id});
        } else if (request.secret_id != user.secret_id) {
            // Invalid secret_id
            // Respond Error.
            socket.emit("UpdateProfileResponse", {status: api.ErrorCode.invalid_secret_id});
        } else {
            // update
            Object.assign(user, request.pilot);
            Object.assign(myDB.pilots[user.id], request.pilot);

            // Respond Success
            socket.emit("UpdateProfileResponse", {status: api.ErrorCode.success});
        }
    });

    
    // ========================================================================
    // Get Group Info
    // ------------------------------------------------------------------------
    socket.on("GroupInfoRequest", (request: api.GroupInfoRequest) => {
        if (!user.authentic) return;
        const resp = {
            status: api.ErrorCode.unknown_error,
            group_id: request.group_id,
            map_layers: [],
            pilots: [],
        } as api.GroupInfoResponse;

        if (request.group_id == api.nullID || !myDB.hasGroup(request.group_id)) {
            // Null or unknown group_id.
            // Respond Error. 
            resp.status = api.ErrorCode.invalid_id;
        } else if (request.group_id != myDB.pilots[user.id].group_id) {
            // Pilot not in this group.
            // Respond Error. 
            resp.status = api.ErrorCode.denied_group_access;
        } else {
            // Respond Success
            resp.status = api.ErrorCode.success;
            resp.map_layers = myDB.groups[request.group_id].map_layers;
            myDB.groups[request.group_id].pilots.forEach((p: api.ID) => {
                const each_pilot: api.PilotMeta = {
                    id: p,
                    name: myDB.pilots[p].name,
                    avatar: myDB.pilots[p].avatar,
                }
                resp.pilots.push();
            });
        }
        socket.emit("GroupInfoResponse", resp);
    });


    // ========================================================================
    // Get Chat Log
    // ------------------------------------------------------------------------
    socket.on("ChatLogRequest", (request: api.ChatLogRequest) => {
        if (!user.authentic) return;
        const resp = {
            status: api.ErrorCode.unknown_error,
            msgs: [],
            group_id: request.group_id,
        } as api.ChatLogResponse;

        if (request.group_id == api.nullID || !myDB.hasGroup(request.group_id)) {
            // Null or unknown group_id.
            // Respond Error. 
            resp.status = api.ErrorCode.invalid_id;
        } else if (request.group_id != myDB.pilots[user.id].group_id) {
            // Pilot not in this group.
            // Respond Error. 
            resp.status = api.ErrorCode.denied_group_access;
        } else {
            // Respond Success
            resp.msgs = myDB.getChatLog(request.group_id, request.time_window);
            resp.status = api.ErrorCode.success
        }        
        socket.emit("ChatLogResponse", resp);
    });


    // ========================================================================
    // user joins group
    // ------------------------------------------------------------------------
    socket.on("JoinGroupRequest", (request: api.JoinGroupRequest) => {
        if (!user.authentic) return;
        const resp = {
            status: api.ErrorCode.unknown_error,
            group_id: api.nullID,
        } as api.JoinGroupResponse;

        if (myDB.hasGroup(request.target_id)) {
            // join a group
            resp.status = api.ErrorCode.success;
            resp.group_id = request.target_id;
        } else if (myDB.hasPilot(request.target_id) && hasClient(request.target_id)) {
            // join on a pilot
            resp.status = api.ErrorCode.success;
            resp.group_id = myDB.pilots[request.target_id].group_id;

            if (resp.group_id == api.nullID) {
                // need to make a new group
                resp.group_id = myDB.newGroup();
                myDB.addPilotToGroup(request.target_id, resp.group_id);
                console.log("Forming new group on", request.target_id);

                // notify the pilot they are in a group now
                // TODO: we should have a dedicated message for this (don't overload the JoinGroupResponse like this)
                const notify = {
                    status: api.ErrorCode.success,
                    group_id: resp.group_id,
                } as api.JoinGroupResponse;
                clients[request.target_id].emit("JoinGroupResponse", notify);
            }
        } else {
            // make new  group
            resp.status = api.ErrorCode.success;
            resp.group_id = myDB.newGroup(request.target_id);
        }

        // If ID match, join the group
        if (resp.group_id != api.nullID) {
            // add pilot to group
            myDB.addPilotToGroup(user.id, resp.group_id);
            
            // notify group there's a new pilot
            const notify = {
                pilot: {
                    id: user.id,
                    name: myDB.pilots[user.id].name,
                    avatar: myDB.pilots[user.id].avatar,
                }
            } as api.PilotJoinedGroup;
            myDB.groups[resp.group_id].pilots.forEach((pilot_id: api.ID) => {
                if (pilot_id != user.id && hasClient(pilot_id)) {
                    clients[pilot_id].emit("PilotJoinedGroup", notify);
                }
            });
        }

        socket.emit("JoinGroupResponse", resp);
    });

    // ========================================================================
    // Leave Group
    // ------------------------------------------------------------------------
    socket.on("LeaveGroupRequest", (request: api.LeaveGroupRequest) => {
        if (!user.authentic) return;
        const resp = {
            status: api.ErrorCode.unknown_error,
            group_id: api.nullID,
        } as api.LeaveGroupResponse;

        if (myDB.pilots[user.id].group_id != api.nullID) {
            resp.status = api.ErrorCode.success;
            const notify = {
                pilot_id: user.id,
                new_group_id: api.nullID,
            } as api.PilotLeftGroup;
            const prev_group = myDB.pilots[user.id].group_id;
            // Leave the group
            myDB.removePilotFromGroup(user.id)

            if (request.prompt_split) {
                // make a new group
                notify.new_group_id = myDB.newGroup();
                resp.group_id = notify.new_group_id;
                myDB.addPilotToGroup(user.id, notify.new_group_id);
            }

            // notify the group
            myDB.groups[prev_group].pilots.forEach((pilot_id: api.ID) => {
                if (hasClient(pilot_id)) {
                    clients[pilot_id].emit("PilotLeftGroup", notify);
                }
            });

        } else {
            // Pilot isn't currently in a group.
            // Return Error
            resp.status = api.ErrorCode.no_op;
        }
        socket.emit("LeaveGroupResponse", resp);
    });

});





console.log("Starting Server at", _ip);
socketServer.listen(3000);

