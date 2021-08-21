import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import * as _ from "lodash";

import * as api from "./api";
import { myDB } from "./db";
import { hash_flightPlanData } from "./apiUtil";


const socketServer = createServer();
const _ip = "0.0.0.0";
const io = new Server(socketServer, {
    cors: {
        origin: ["http://192.168.1.101:8000", "http://localhost:8000", "https://xcNav.com"],
        methods: ["GET", "POST"],
        allowedHeaders: ["xcNav"],
        credentials: true
    }
});


interface Session {
    id: api.ID
    secret_id: api.ID
    authentic: boolean
    socket: Socket
}



// all registered pilot connections
let clients: Record<api.ID, Session> = {};

function hasClient(pilot_id: api.ID): boolean {
    return Object.keys(clients).indexOf(pilot_id) > -1;
}


// Client Session
io.on("connection", (socket: Socket) => {
    // console.log("connected", socket.id);
    // This is the only state held by connection.
    const user: Session = {
        secret_id: api.nullID,
        id: api.nullID,
        authentic: false,
        socket: socket
    }

    // --- on client disconnected ---
    socket.on('disconnect', function () {
        // console.log('disconnected', socket.id);
        // if pilot was in chat, forget their session
        if (Object.keys(clients).indexOf(user.id) > -1) {
            console.log(`${user.id}) dropped`);
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
        if (!user.authentic) return;
        
        console.log(`${user.id}) Msg:`, msg);
        
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
                clients[pilot_id].socket.emit("TextMessage", msg);
            }
        });
    });

    // ========================================================================
    // handle PilotTelemetry
    // ------------------------------------------------------------------------
    socket.on("PilotTelemetry", (msg: api.PilotTelemetry) => {
        if (!user.authentic) return;
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
                    clients[pilot_id].socket.emit("PilotTelemetry", msg);
                }
            });
        }
    });

    // ========================================================================
    // handle Full copy of flight plan from client
    // ------------------------------------------------------------------------
    socket.on("FlightPlanSync", (msg: api.FlightPlanSync) => {
        if (!user.authentic) return;
        const group_id = myDB.pilots[user.id].group_id;
        if (group_id == api.nullID) return;

        // update the plan
        myDB.groups[group_id].flight_plan = msg.flight_plan;
        // TODO: check the hash necessary here?

        // relay the flight plan to the group
        myDB.groups[group_id].pilots.forEach((pilot_id: api.ID) => {
            if (pilot_id != user.id && hasClient(pilot_id)) {
                clients[pilot_id].socket.emit("FlightPlanSync", msg);
            }
        });
    });

    // ========================================================================
    // handle Flightplan Updates
    // ------------------------------------------------------------------------
    socket.on("FlightPlanUpdate", (msg: api.FlightPlanUpdate) => {
        if (!user.authentic) return;
        const group_id = myDB.pilots[user.id].group_id;
        if (group_id == api.nullID) return;

        console.log(`${user.id}) Waypoint Update`, msg);

        // make backup copy of the plan
        const plan = myDB.groups[group_id].flight_plan;
        const backup = _.cloneDeep(plan);

        let should_notify = true;
    
        // update the plan
        switch (msg.action) {
            case api.WaypointAction.delete:
                // Delete a waypoint
                // TODO: verify wp
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
                } else {
                    should_notify = false;
                }
                break;
            case api.WaypointAction.none:
                // no-op
                should_notify = false;
                break;
        }

        const hash = hash_flightPlanData(plan);
        if (hash != msg.hash) {
            // DE-SYNC ERROR
            // restore backup
            console.warn(`${user.id}) Flightplan De-sync`, hash, msg.hash, plan);
            myDB.groups[group_id].flight_plan = backup;

            // assume the client is out of sync, return a full copy of the plan
            const notify: api.FlightPlanSync = {
                timestamp: {
                    msec: Date.now(),
                },
                hash: hash_flightPlanData(backup),
                flight_plan: backup,
            }
            socket.emit("FlightPlanSync", notify);
        } else if (should_notify) {
            // relay the update to the group
            myDB.groups[group_id].pilots.forEach((pilot_id: api.ID) => {
                if (pilot_id != user.id && hasClient(pilot_id)) {
                    clients[pilot_id].socket.emit("FlightPlanUpdate", msg);
                }
            });
        }
    });

    // ========================================================================
    // handle waypoint selections
    // ------------------------------------------------------------------------
    socket.on("PilotWaypointSelections", (msg: api.PilotWaypointSelections) => {
        if (!user.authentic) return;
        const group_id = myDB.pilots[user.id].group_id;
        if (group_id == api.nullID) return;

        console.log(`${user.id}) Waypoint Selection`, msg);

        // Save selection
        Object.entries(msg).forEach(([pilot_id, wp_index]) => {
            myDB.groups[group_id].wp_selections[pilot_id] = wp_index;
        });

        // relay the update to the group
        myDB.groups[group_id].pilots.forEach((pilot_id: api.ID) => {
            if (pilot_id != user.id && hasClient(pilot_id)) {
                clients[pilot_id].socket.emit("PilotWaypointSelections", msg);
            }
        });
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

        const resp: api.RegisterResponse = {
            status: api.ErrorCode.unknown_error,
            secret_id: api.nullID,
            pilot_id: request.pilot.id,
        };

        if (request.pilot.name == "") {
            resp.status = api.ErrorCode.missing_data;
        } else {
            if (request.pilot.id != api.nullID) {
                // new user already has a public ID
                if (myDB.hasPilot(request.pilot.id)) {
                    // Pilot is already registered (client should just login), send error message.
                    resp.status = api.ErrorCode.no_op;
                } else {
                    // TEMPORARY: use their preferred public_id. In production this shouldn't be allowed
                    user.id = request.pilot.id;
                }
            } else {
                // create new public_id
                user.id = uuidv4().substr(24);
            }

            // create a secret_id
            user.secret_id = uuidv4();
            
            // update db
            myDB.newPilot(request.pilot.name, user.id, user.secret_id, request.sponsor, request.pilot.avatar);
            console.log(`${user.id}) Registered`);

            // respond success
            resp.status = api.ErrorCode.success;
            resp.secret_id = user.secret_id;
            resp.pilot_id = user.id;
        }
        socket.emit("RegisterResponse", resp);
    });


    // ========================================================================
    // Login
    // ------------------------------------------------------------------------
    socket.on("LoginRequest", (request: api.LoginRequest) => {
        const resp: api.LoginResponse = {
            status: api.ErrorCode.unknown_error,
            pilot_id: request.pilot_id,
            api_version: api.api_version,
        };

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
            console.log(`${user.id}) Logged In`);
            user.authentic = true;
            // remember this session
            clients[user.id] = user;
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
        const resp: api.GroupInfoResponse = {
            status: api.ErrorCode.unknown_error,
            group_id: request.group_id,
            map_layers: [],
            pilots: [],
            flight_plan: null
        };

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
                resp.pilots.push(each_pilot);
            });
            resp.flight_plan = myDB.groups[request.group_id].flight_plan;
        }
        console.log(`${user.id}) requested group (${request.group_id}) info : ${resp.status}`);
        socket.emit("GroupInfoResponse", resp);
    });


    // ========================================================================
    // Get Chat Log
    // ------------------------------------------------------------------------
    socket.on("ChatLogRequest", (request: api.ChatLogRequest) => {
        if (!user.authentic) return;
        const resp: api.ChatLogResponse = {
            status: api.ErrorCode.unknown_error,
            msgs: [],
            group_id: request.group_id,
        };

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
        const resp: api.JoinGroupResponse = {
            status: api.ErrorCode.unknown_error,
            group_id: api.nullID,
        };

        if (myDB.hasGroup(request.target_id)) {
            // join a group
            if (request.target_id == myDB.pilots[user.id].group_id) {
                // already in this group
                resp.status = api.ErrorCode.no_op;
                resp.group_id = request.target_id;
            } else {
                resp.status = api.ErrorCode.success;
                resp.group_id = request.target_id;
            }
        } else if (myDB.hasPilot(request.target_id) && hasClient(request.target_id)) {
            // join on a pilot
            resp.status = api.ErrorCode.success;
            resp.group_id = myDB.pilots[request.target_id].group_id;

            if (resp.group_id == api.nullID) {
                // need to make a new group
                resp.group_id = myDB.newGroup();
                console.log(`${user.id}) Form new group ${resp.group_id} on ${request.target_id}`);
                myDB.addPilotToGroup(request.target_id, resp.group_id);

                // notify the pilot they are in a group now
                // TODO: we should have a dedicated message for this (don't overload the JoinGroupResponse like this)
                const notify = {
                    status: api.ErrorCode.success,
                    group_id: resp.group_id,
                } as api.JoinGroupResponse;
                clients[request.target_id].socket.emit("JoinGroupResponse", notify);
            }
        } else if (request.target_id.length == 36) {
            // make new  group
            resp.status = api.ErrorCode.success;
            resp.group_id = myDB.newGroup(request.target_id);
        } else {
            // bad group request. Can't make a new group with this id.
            resp.status = api.ErrorCode.invalid_id;
        }

        // If ID match, join the group
        if (resp.group_id != api.nullID) {
            // check if pilot was already in a group
            const prev_group = myDB.pilots[user.id].group_id;
            if (prev_group != api.nullID) {
                // notify the group
                const notify = {
                    pilot_id: user.id,
                    new_group_id: api.nullID,
                } as api.PilotLeftGroup;
                myDB.groups[prev_group].pilots.forEach((pilot_id: api.ID) => {
                    if (hasClient(pilot_id) && pilot_id != user.id) {
                        clients[pilot_id].socket.emit("PilotLeftGroup", notify);
                    }
                });
                myDB.removePilotFromGroup(user.id);
            }

            // add pilot to group
            myDB.addPilotToGroup(user.id, resp.group_id);
            
            // notify group there's a new pilot
            const notify: api.PilotJoinedGroup = {
                pilot: {
                    id: user.id,
                    name: myDB.pilots[user.id].name,
                    avatar: myDB.pilots[user.id].avatar,
                }
            };
            myDB.groups[resp.group_id].pilots.forEach((pilot_id: api.ID) => {
                if (pilot_id != user.id && hasClient(pilot_id) && clients[pilot_id].authentic) {
                    console.log("- notifying", pilot_id)
                    clients[pilot_id].socket.emit("PilotJoinedGroup", notify);
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
        const resp: api.LeaveGroupResponse = {
            status: api.ErrorCode.unknown_error,
            group_id: api.nullID,
        };

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
                if (hasClient(pilot_id) && pilot_id != user.id) {
                    clients[pilot_id].socket.emit("PilotLeftGroup", notify);
                }
            });

        } else {
            // Pilot isn't currently in a group.
            // Return Error
            resp.status = api.ErrorCode.no_op;
        }
        socket.emit("LeaveGroupResponse", resp);
    });

    // ========================================================================
    // Pilots Status
    // ------------------------------------------------------------------------
    socket.on("PilotsStatusRequest", (request: api.PilotsStatusRequest) => {
        if (!user.authentic) return;
        const resp: api.PilotsStatusResponse = {
            status: api.ErrorCode.missing_data,
            pilots_online: {}
        };

        // bad IDs will simply be reported offline
        Object.values(request.pilot_ids).forEach((pilot_id: api.ID) => {
            resp.status = api.ErrorCode.success;
            // report "online" if we have authenticated connection with the pilot
            resp.pilots_online[pilot_id] = hasClient(pilot_id) && clients[pilot_id].authentic;
        });
        socket.emit("PilotsStatusResponse", resp);
    });
});





console.log("Starting Server at", _ip);
socketServer.listen(8081);

