// TODO: add a real database here. For now this will just be realtime state

import { v4 as uuidv4 } from "uuid";
import * as api from "../../../common/ts/api";


interface PilotContact extends api.PilotMeta {
    secret_id: api.ID
    sponsor: api.ID // public_id of pilot who invited this one
    group_id: api.ID
}


class db_stub {

    // tables: pilot / groups
    pilots: Record<api.ID, PilotContact>;
    group_to_pilots: Record<api.ID, Set<api.ID>>;

    // group data
    group_chat: Record<api.ID, api.TextMessage[]>;
    group_map_layers: Record<api.ID, string[]>;

    // pilot data
    pilot_telemetry: Record<api.ID, api.PilotTelemetry[]>;


    constructor() {
        // initiate everything empty
        this.pilots = {};
        this.group_to_pilots = {};
        this.group_chat = {};
        this.group_map_layers = {};
        this.pilot_telemetry = {};
    }

    // ========================================================================
    // Pilot / Group Utils
    // ------------------------------------------------------------------------
    hasGroup(group_id: api.ID): boolean {
        return Object.keys(this.group_to_pilots).indexOf(group_id) > -1;
    }

    hasPilot(pilot_id: api.ID): boolean {
        return Object.keys(this.pilots).indexOf(pilot_id) > -1;
    }

    findGroup(pilot_id: api.ID) {
        if (this.hasPilot(pilot_id)) {
            return this.pilots[pilot_id].group_id;
        } else {
            console.warn("Pilot", pilot_id, "is not in a group.");
            return api.nullID;
        }
    }

    newPilot(pilot: api.PilotMeta, sponsor: api.ID, secret_id: api.ID) {
        const newPilot = {
            secret_id: secret_id,
            sponsor: sponsor,
            group_id: api.nullID,
        } as PilotContact;
        Object.assign(newPilot, pilot);
        this.pilots[pilot.id] = newPilot;
        this.pilot_telemetry[pilot.id] = [];
    }

    newGroup(group_id: api.ID = undefined): api.ID {
        let new_group_id = uuidv4();
        if (group_id != undefined) {
            // use requested ID
            new_group_id = group_id;
        }
        if (this.hasGroup(new_group_id)) {
            console.error("New group already exists!");
        } else {
            // initialize new group
            this.group_to_pilots[new_group_id] = new Set();
            this.group_chat[new_group_id] = [];
        }
        return new_group_id;
    }

    addPilotToGroup(pilot_id: api.ID, group_id: api.ID) {
        // if group doesn't exist, make it
        if (!this.hasGroup(group_id)) {
            this.newGroup(group_id);
        }
        this.group_to_pilots[group_id].add(pilot_id);
        this.pilots[pilot_id].group_id = group_id;
    }

    removePilotFromGroup(pilot_id: api.ID) {
        if (this.hasPilot(pilot_id)) {
            if (this.pilots[pilot_id].group_id != api.nullID) {
                this.group_to_pilots[this.pilots[pilot_id].group_id].delete(pilot_id);
                this.pilots[pilot_id].group_id = api.nullID;
            }
        }
    }

    // ========================================================================
    // Chat
    // ------------------------------------------------------------------------
    recordChat(msg: api.TextMessage) {
        // TODO: preserve indexing and order by timestamp
        this.group_chat[msg.group_id].push(msg);
    }

    getChatLog(group_id: api.ID, duration: api.Duration): api.TextMessage[] {
        if (!this.hasGroup(group_id)) {
            console.error("Group does not exist!");
            return [];
        }

        function bisect(v: api.TextMessage[], t: api.Timestamp): number
        {
            let low = 0;
            let mid = 0;
            let high = v.length - 1;
     
            while (low <= high) {
                mid = (low + high) / 2;
     
                if(t.msec < v[mid].timestamp.msec) {
                    high = mid - 1;
                } else if(t.msec > v[mid].timestamp.msec) {
                    low = mid + 1;
                } else {
                    return mid;
                }
            }
            // default to start
            return 0;
        }

        // find start and end index
        const log = this.group_chat[group_id];
        const start = bisect(log, duration.start);
        const end = bisect(log, duration.end);

        // return slice
        return log.slice(start, end);
    }


    // ========================================================================
    // Location
    // ------------------------------------------------------------------------
    recordPilotTelemetry(loc: api.PilotTelemetry) {
        // TODO: ensure insertion in order (preserve time ordering)
        this.pilot_telemetry[loc.pilot_id].push(loc);
    }
}



// singleton class representing a db interface
export let myDB = new db_stub();
