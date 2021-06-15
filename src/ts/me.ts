/*
    Manage current user identification info here.
*/


import * as proto from "../proto/protocol";
import { make_uuid } from "./util";
import * as client from "./client";


interface User {
    name: string,
    ID: proto.ID,
    group:  proto.ID,
}

let me = {
    name: "",
    ID: "",
    group: "",
}


// grab username initially
if (localStorage.getItem("user_name") != null) {
    me.name = localStorage.getItem("user_name");
    me.ID = localStorage.getItem("user_ID");
    me.group = localStorage.getItem("user_group");

    // TODO: verify group is still active in server (rejoin the group)
} else {
    // YOU NEED TO SET USERNAME!
    setName(prompt("Please enter your name"));
}



export function setName(newName: string) {
    me.name = newName;
    me.ID = make_uuid(10);
    me.group = "";

    localStorage.setItem("user_name", me.name);
    localStorage.setItem("user_ID", me.ID);
    localStorage.setItem("user_group", me.group);

    // TEMP: this should only be happening when connecting. It's here for now because in debug we can change name
    client.register();
}

export function ID(): proto.ID {
    return me.ID;
}

export function name(): string {
    return me.name;
}

export function group(newGroup: proto.ID = undefined): proto.ID {
    // optionally set the group
    if (newGroup != undefined) {
        me.group = newGroup;
        localStorage.setItem("user_group", me.group);
    }
    return me.group;
}

export function pilot(): proto.Pilot {
    return {
        id: me.ID,
        name: me.name, 
    }
}
