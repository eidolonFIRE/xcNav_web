import * as bootstrap from "bootstrap";

import default_avatar from "../img/default_avatar.png";
import { speak, playSound} from "./sounds";
import * as client from "./client";
import * as api from "../../../server/src/ts/api";
import { contacts } from "./contacts";
import { me } from "./pilots";



let _newChatMsgToast: bootstrap.Toast;
let _last_msg_index: number;


// New message pop-up
export function showNotification(senderName, message, emergency) {
    const notify = document.getElementById("msgNotification")
    notify.getElementsByClassName("toast-header")[0].getElementsByTagName("strong")[0].textContent = "Message from " + senderName;
    const toast_body = notify.getElementsByClassName("toast-body")[0];
    toast_body.innerHTML = message;
    if (emergency) {
        toast_body.classList.add( "alert-danger" );
    } else {
        toast_body.classList.remove( "alert-danger" );
    }
    _newChatMsgToast.show();

    // disappear after some seconds
    setTimeout(function(){ document.getElementById("msgNotification").classList.remove("show"); }, 10000);
}



export function processTextMessage(msg: api.TextMessage, silent=false) {
    _last_msg_index = msg.index;
    const is_outgoing = msg.pilot_id == me.id;
    const sender_name = is_outgoing ? me.name : contacts[msg.pilot_id].name;


    // make a text bubble in chat window
    const template_bubble = document.getElementById(is_outgoing ? "messageTemplateForOthers" : "messageTemplateForMe") as HTMLDivElement;
    const text_bubble = template_bubble.cloneNode(true) as HTMLDivElement;
    text_bubble.id = "msg_" + msg.index; // Important to replace the ID
    text_bubble.getElementsByClassName("msg-body")[0].textContent = msg.text;
    document.getElementById("chatMessages").appendChild(text_bubble);

    // if it was an emergency message, color it red
    if (msg.emergency) text_bubble.getElementsByClassName("msg-body")[0].classList.add( "msg-emergency" );

    // scroll to bottom
    if (document.getElementById("chatMenu").style.display == "block") text_bubble.scrollIntoView();

    // notifications
    if (is_outgoing) {
        // we sent this msg.message
        // playSound("messageSentSound");
        client.sendTextMessage(msg);
    } else {
        // recieved message
        const time_diff = Date.now() - msg.timestamp.msec;
        console.log("timestamp diff", time_diff)
        let when = "";
        if (time_diff < 1000 * 60 * 60) {
            // msg is less than an hour old
            when = Math.round(time_diff / 60000).toFixed(0) + "min ago";
        } else {
            const date = new Date(msg.timestamp.msec * 1000);
            when = date.getTime().toString();
        }
        text_bubble.getElementsByClassName("msg-sender")[0].textContent = sender_name + " " + when;
        (text_bubble.getElementsByClassName("msg-sender-icon")[0] as HTMLImageElement).src = contacts[msg.pilot_id].avatar != null ? contacts[msg.pilot_id].avatar : default_avatar;

        const chatMenu_visible = document.getElementById("chatMenu").style.display == "block";

        if (!silent) {
            if (msg.emergency) {
                playSound("emergencySound");	
                speak("Mayday from " + sender_name + ". " + msg.text + "!");
            } else {
                playSound(chatMenu_visible ? "messageReceivedSound" : "alertMessageReceivedSound");
            }
        }

        // if the message interface is not visible and we are receiving a message, show a popup notification
        if (!chatMenu_visible) {
            showNotification(sender_name, msg.text, msg.emergency);
            //speak( sender + " says: " + message );
        }
    }

}



export function setupChat() {
    _newChatMsgToast = new bootstrap.Toast( document.getElementById("msgNotification"), {autohide:false} );
    const chatMessages = document.getElementById("chatMessages") as HTMLDivElement;
    const _messagesBSObject = new bootstrap.Offcanvas(chatMessages);


    // setup chat window
    const msgInput = document.getElementById("msgInput") as HTMLInputElement;
    const chatMenu = document.getElementById("chatMenu") as HTMLDivElement;
    chatMenu.addEventListener('shown.bs.modal', () => {
        // scroll to bottom
        if (chatMessages.children.length > 0) {
            chatMessages.lastElementChild.scrollIntoView();
        }
        // cursor in text input
        msgInput.focus();
        // hide message notification if it's still up
        // _newChatMsgToast.hide();
    });

    // setup canned messages box
    const cannedMessagesMenu = document.getElementById("cannedMessagesMenu") as HTMLDivElement;
    const toggleCannedMessages = document.getElementById("toggleCannedMessages") as HTMLButtonElement;
    toggleCannedMessages.addEventListener("click", (ev: MouseEvent) => {
        cannedMessagesMenu.style.visibility = cannedMessagesMenu.style.visibility == "visible" ? "hidden" : "visible";
    });
    document.querySelectorAll("#cannedMessagesMenu .cannedMessage").forEach((msg: Element) => {
        msg.addEventListener("click", (ev: MouseEvent) => {
            // send a msg from canned messages
            const textMsg: api.TextMessage = {
                timestamp: {
                    msec: Date.now(),
                } as api.Timestamp,
                index: _last_msg_index + 1,
                group_id: me.group,
                pilot_id: me.id,
                text: msg.textContent,
                emergency: msg.classList.contains("emergency")
            };
            processTextMessage(textMsg);
            // close the chat window
            cannedMessagesMenu.style.visibility = "hidden";
            _messagesBSObject.hide();
            return false;
        });
    });

    // setup message input
    msgInput.addEventListener("change", (ev: Event) => {
        const text = msgInput.value.trim();
        if (text != "") {
            // send a custom typed msg
            const textMsg: api.TextMessage = {
                timestamp: {
                    msec: Date.now(),
                } as api.Timestamp,
                index: _last_msg_index + 1,
                group_id: me.group,
                pilot_id: me.id,
                text: text,
                emergency: false
            };
            processTextMessage(textMsg);
        }
        // clear the input
        msgInput.value = "";
    });
}
