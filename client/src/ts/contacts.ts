import * as api from "../../../common/ts/api";
import { joinGroup } from "./client";


interface Contact extends api.PilotMeta {
    online: boolean
    same_group: boolean
}

type Contacts = Record<api.ID, Contact>;

export let contacts: Contacts = {};



export function checkNewContact(pilot: api.PilotMeta) {
    if (Object.keys(contacts).indexOf(pilot.id) < 0) {
        // we don't have this contact yet, add them
        const new_contact: Contact = {
            online: false,
            same_group: true,
            ...pilot,
        }
        contacts[pilot.id] = new_contact;
        console.log("New contact", pilot.id, pilot.name);
        saveContacts();
    }
}



function refreshContactListUI() {
    const list = document.getElementById("contactList") as HTMLUListElement;

    // empty list
    while (list.firstChild) {
        list.removeChild(list.lastChild);
    }

    // populate the contact list
    Object.values(contacts).forEach((pilot) => {
        // set html
        const entry = document.createElement("li") as HTMLLIElement;
        const avatar = document.createElement("i") as HTMLImageElement;
        avatar.setAttribute("src", pilot.avatar);
        avatar.className = "msg-sender-icon";
        entry.innerHTML = avatar.outerHTML + pilot.name;
        // entry.innerHTML = pilot.name;
        
        entry.className = "list-group-item";
        entry.setAttribute("data-bs-dismiss", "offcanvas");
        // entry.setAttribute("data-bs-toggle", "offcanvas");

        entry.addEventListener("click", (ev: MouseEvent) => {
            if (confirm("Join this pilot?" + ` \"${pilot.name}\"`)) {
                joinGroup(pilot.id);
            }
        });

        // TODO: long click to delete

        list.appendChild(entry);
    });
}


function updateContactStatus() {
    // TODO
}


function saveContacts() {
    localStorage.setItem("user.contacts", JSON.stringify(contacts));
}


function loadContacts() {
    contacts = JSON.parse(localStorage.getItem("user.contacts")) as Contacts;
}


export function setupContactsUI() {
    // --- Copy invite link
    let copyText = document.getElementById("inviteLink") as HTMLInputElement;
    copyText.addEventListener("click", (ev: MouseEvent) => {

        /* Select the text field */
        copyText.select();
        copyText.setSelectionRange(0, 99999); /* For mobile devices */
    
        /* Copy the text inside the text field */
        document.execCommand("copy");
    
        /* Alert the copied text */
        alert("Copied the text: " + copyText.value);
    });

    // --- When menu opens...
    const contactsMenu = document.getElementById('contactsMenu')
    contactsMenu.addEventListener('show.bs.offcanvas', function () {
        loadContacts();
        updateContactStatus();
        refreshContactListUI();
    });

    // --- Load Contacts from memory
}
