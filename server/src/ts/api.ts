// |  /!\ This must be incrimented each meaningful change to the protocol.
// | 
// |  TODO: Version is incrimented manually for now, but in the future we should use formal versioning.
// |  https://gitversion.readthedocs.io/en/latest/input/docs/configuration/
export const api_version = 2.2;



// ############################################################################ 
//
//     Primative Types
//
// ############################################################################

export interface Timestamp {
    msec: number // UTC time since Unix epoch in milliseconds
}

export interface Duration {
    start: Timestamp
    end: Timestamp
}

export interface Telemetry {
    geoPos: GeolocationCoordinates
    fuel: number      // Liters
    fuel_rate: number // L/hr
}

export type ID = string;
export const nullID = "";


export interface PilotMeta {
    id: ID
    name: string
    avatar: string // image in base64
}

export interface LatLngRaw {
    lat: number
    lng: number
}

export interface Waypoint {
    name: string
    geo: LatLngRaw[]
    optional: boolean
    length?: number
}

export interface FlightPlanData {
    name: string
    waypoints: Waypoint[]
}

export interface WaypointSelection {
    plan: string
    index: number
    name: string
}

export enum ErrorCode {
    success = 0,
    unknown_error = 1,
    invalid_id,             // invalid "pilot_id" or "group_id"
    invalid_secret_id,
    denied_group_access,    // IE. making requests for a group you aren't in
    missing_data,           // essential message data was left null
    no_op,                  // No change / Nothing to do (example: leaving group when you aren't in a group)
    // ... add more as needed
}

export enum WaypointAction {
    none = 0,
    new,
    modify,
    delete,
    sort,
}


// ############################################################################ 
//
//     Bi-directional
//
// ############################################################################

export interface TextMessage {
    timestamp: Timestamp
    index: number
    group_id: ID // target group
    pilot_id: ID // sender
    text: string
    emergency: boolean
}

export interface PilotTelemetry {
    timestamp: Timestamp
    pilot_id: ID
    telemetry: Telemetry
}

export interface NewMapLayer {
    owner: ID    // author pilot_id
    name: string
    data: string // json kml
}

export interface RemoveMapLayer {
    owner: ID
    name: string
}

// full sync of flight plan data
export interface FlightPlanSync {
    timestamp: Timestamp
    hash: string
    flight_plan: FlightPlanData
}

// update an individual waypoint
export interface FlightPlanUpdate {
    timestamp: Timestamp
    hash: string
    index: number
    action: WaypointAction
    data?: Waypoint
    new_index?: number   
}
 
export type PilotWaypointSelections = Record<ID, WaypointSelection>;



// ############################################################################ 
//
//     Server Notifications
//
// ############################################################################
export interface PilotJoinedGroup {
    pilot: PilotMeta
}

export interface PilotLeftGroup {
    pilot_id: ID
    new_group_id: ID
}



// ############################################################################ 
//
//     Server Requests 
//
// ############################################################################

// ============================================================================
// Client request to create profile on the server. When client doesn't yet hold
// a valid secret_id, this is how to have one issued by the server.
//
// - If the pilot is already known by the server, request will fail.
//   Client must remember their secret_id to access that profile.
//
// - sponsor: pilot_id that invited this user to the server
// ----------------------------------------------------------------------------
export interface RegisterRequest {
    pilot: PilotMeta
    sponsor: ID
}

export interface RegisterResponse {
    status: ErrorCode
    secret_id: ID  // private key
    pilot_id: ID   // public key
}

// ============================================================================
// Client request to login. If client already holds a secret_id, this is how to
// request access to the server API, authenticating the client.
//
// - If pilot is not yet registered with this server, request will fail.
// ----------------------------------------------------------------------------
export interface LoginRequest {
    secret_id: ID
    pilot_id: ID
}

export interface LoginResponse {
    status: ErrorCode
    pilot_id: ID
    api_version: number
}

// ============================================================================
// Client request update user information.
// ----------------------------------------------------------------------------
export interface UpdateProfileRequest {
    pilot: PilotMeta
    secret_id: ID
}

export interface UpdateProfileResponse {
    status: ErrorCode
}


// ============================================================================
// Client request information on a group.
// ----------------------------------------------------------------------------
export interface GroupInfoRequest {
    group_id: ID
}

export interface GroupInfoResponse {
    status: ErrorCode
    group_id: ID
    map_layers: string[]  // json kml
    pilots: PilotMeta[]
    flight_plan: FlightPlanData
}

// ============================================================================
// Client request chat history
// ----------------------------------------------------------------------------
export interface ChatLogRequest {
    time_window: Duration
    group_id: ID
}

export interface ChatLogResponse {
    status: ErrorCode
    msgs: TextMessage[]
    group_id: ID
}

// ============================================================================
// Client request to join a group
//
// - target: At least one must be set. If both are set, only join in target
//           pilot is in the target group.
// ----------------------------------------------------------------------------
export interface JoinGroupRequest {
    target_id: ID // either group or pilot id
}

export interface JoinGroupResponse {
    status: ErrorCode
    group_id: ID
}

// ============================================================================
// Client request to leave current group
//
// - prompt_split: Notify the whole group of a split and offer chance to join
//                 new contingent. In this case, group_id is populated in the
//                 response. If this values is left "false", the pilot silently
//                 leaves the group.
// ----------------------------------------------------------------------------
export interface LeaveGroupRequest {
    prompt_split: boolean
}

export interface LeaveGroupResponse {
    status: ErrorCode
    group_id: ID
}

// ============================================================================
// Client request for pilot(s) status(es)
// ----------------------------------------------------------------------------
export interface PilotsStatusRequest {
    pilot_ids: ID[]
}

export interface PilotsStatusResponse {
    status: ErrorCode
    pilots_online: Record<ID, boolean>
}
