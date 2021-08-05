import QRCode from 'qrcode'

import default_avatar from "../img/default_avatar.png";

import * as api from "../../../common/ts/api";
import { checkPilotsOnline, joinGroup } from "./client";
import { hasLocalPilot, LocalPilot, localPilots } from "./pilots";


interface Contact extends api.PilotMeta {
    online: boolean
}

type Contacts = Record<api.ID, Contact>;

export let contacts: Contacts = {};
let inviteLink = "";


export function updateContact(pilot: api.PilotMeta) {
    if (Object.keys(contacts).indexOf(pilot.id) < 0) {
        // we don't have this contact yet, add them
        const new_contact: Contact = {
            online: false,
            ...pilot,
        }
        contacts[pilot.id] = new_contact;
        console.log("New contact", pilot.id, pilot.name);
        saveContacts();
    }
    updateContactEntry(pilot.id);
}



function refreshContactListUI() {
    const list = document.getElementById("contactList") as HTMLUListElement;

    // empty list
    while (list.firstChild) {
        list.removeChild(list.lastChild);
    }

    function make_entry(pilot_id: api.ID) {
        // set html
        const pilot = contacts[pilot_id];
        const entry = document.createElement("li") as HTMLLIElement;
        const avatar = document.createElement("img") as HTMLImageElement;
        avatar.src = (pilot.avatar == null || pilot.avatar == "") ? default_avatar : pilot.avatar;
        avatar.className = "ct_list_icon";
        entry.appendChild(avatar);
        entry.innerHTML += pilot.name;
        entry.className = "list-group-item";
        entry.id = "pilot_contact_" + pilot.id;
        entry.setAttribute("data-bs-dismiss", "offcanvas");
        // entry.setAttribute("data-bs-toggle", "offcanvas");

        entry.addEventListener("click", (ev: MouseEvent) => {
            if (confirm("Join this pilot?" + ` \"${pilot.name}\"`)) {
                joinGroup(pilot.id);
            }
            
        });

        // TODO: long click to delete

        return entry;
    }

    // Label who is in the group
    if (Object.keys(localPilots).length > 0) {
        const label_group = document.createElement("p") as HTMLParagraphElement;
        label_group.textContent = "Pilots in Group"
        list.appendChild(label_group);
    }

    // add all the local pilots (pilots in my group)
    Object.values(localPilots).forEach((pilot: LocalPilot) => {
        // make the list item
        list.appendChild(make_entry(pilot.id));

        // update entry appearance
        updateContactEntry(pilot.id);
    });

    if (Object.keys(localPilots).length > 0) {
         // Label others
        const label_online = document.createElement("p") as HTMLParagraphElement;
        label_online.textContent = "Other Contacts"
        list.appendChild(label_online);   
    } else {
        list.innerHTML += "<br>";
    }

    // Add contacts that are online
    Object.values(contacts).forEach((pilot) => {
        if (pilot.online && !hasLocalPilot(pilot.id)) {
            list.appendChild(make_entry(pilot.id));
            updateContactEntry(pilot.id);
        }
    });

    // Add contacts that are offline
    Object.values(contacts).forEach((pilot) => {
        if (!pilot.online && !hasLocalPilot(pilot.id)) {
            list.appendChild(make_entry(pilot.id));
            updateContactEntry(pilot.id);
        }
    });
}


export function updateContactEntry(pilot_id: api.ID) {
    // update entry appearance
    const entry = document.getElementById("pilot_contact_" + pilot_id) as HTMLUListElement;
    if (entry != null) {
        const is_online = contacts[pilot_id].online;
        const is_same_group = hasLocalPilot(pilot_id);
        entry.style.fontWeight = is_same_group ? "bold" : "normal";
        entry.style.color = is_online ? "black" : "grey";
    }
}


function saveContacts() {
    // we save more often than we load, so just save the whole Contact list with extra data
    localStorage.setItem("user.contacts", JSON.stringify(contacts));
}


function loadContacts() {
    contacts = JSON.parse(localStorage.getItem("user.contacts"));
}


export function updateInviteLink(target_id: api.ID) {
    inviteLink = window.location.href + "?invite=" + target_id;

    // https://github.com/soldair/node-qrcode
    QRCode.toDataURL(inviteLink, {
        mode: "Alphanumeric",
        errorCorrectionLevel: "low",
    })
        .then(url => {
            const QRimg = document.getElementById("inviteQR") as HTMLImageElement;
            QRimg.src = url;
        })
        .catch(err => {
            console.error(err)
        });

}


export function setupContactsUI() {
    // --- Copy invite link
    const copyInvite = document.getElementById("copyInviteURL") as HTMLButtonElement;
    copyInvite.addEventListener("click", (ev: MouseEvent) => {
        navigator.clipboard.writeText(inviteLink);
    });
    if (!navigator.clipboard) {
        copyInvite.disabled = true;
    }

    // --- When menu opens...
    const contactsMenu = document.getElementById('contactsMenu')
    contactsMenu.addEventListener('show.bs.offcanvas', function () {
        loadContacts();
        // TODO: does this need to be rate limited? Will this get too slow with big contact list?
        checkPilotsOnline(Object.values(contacts));
        refreshContactListUI();
    });

    // --- Load Contacts from memory
    loadContacts();
}
