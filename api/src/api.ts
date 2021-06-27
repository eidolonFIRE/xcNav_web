// =============== PRIMATIVES ===============


export interface Timestamp {
    msec: number; // UTC time since Unix epoch in milliseconds
}

export interface Duration {
    start: Timestamp;
    end: Timestamp;
}

export interface Telemetry {
    geoPos: GeolocationCoordinates;
    fuel: number; // liters
}

export type ID = string;
export const nullID = "";

export interface Pilot {
    id: ID;
    name: string;
    // avatar here?  (maybe base64 string?)
}




// =============== SERVICES ===============

export interface GroupInfoRequest {
    group_id: ID;
}

export interface GroupInfoResponse {
    group_id: ID;
    pilots: Pilot[];
}

export interface TextMessage {
    timestamp: Timestamp;
    index: number;
    group_id: ID; // target group
    pilot_id: ID; // sender
    msg: string;
}

export interface ChatLogRequest {
    time_window: Duration;
    group_id: ID;
}

export interface ChatLogResponse {
    msgs: TextMessage[];
    group_id: ID;
}


export interface PilotTelemetry {
    timestamp: Timestamp;
    pilot_id: ID;
    telemetry: Telemetry;
}

export interface JoinGroupRequest {
    pilot_id: ID; // pilot joining

    target_group_id: ID; // group to join
    target_pilot_id: ID; // join on another pilot
}

export interface JoinGroupResponse {
    group_id: ID;
}
