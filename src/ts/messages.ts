import { $ } from "./util";
import { speak, playMessageReceivedSound, playMessageSentSound} from "./sounds";
import { request } from "./API";
import { getMyPilotInfo, getPilotInfo } from "./pilots";

import * as bootstrap from "bootstrap";


// ========================================================
// messages and notifications
// ========================================================


/*

	message object
	
	messages interface : 
		show, 
		hide, 
		createMessage( need messageID, sent or received
	notification: show( sender, isEmergency ) no hide (done in html)
	
*/


let lastMessage = 0;


export function getLastMessage() {
	return lastMessage;
}

export function setLastMessage(value: number) {
	lastMessage = value;
}


export function sendMessageToServer( sender, message, isEmergency )
{
	let requestData = {
		'api': 1,
		'method': 'create',
		'query':
		{
			'entity': 'messages',
			'sender': parseInt(sender),
			'text':   message,
			'isEmergency': isEmergency ? 1 : 0
		}
	};
	request( requestData, function( s )
	{
		lastMessage = s.lastMessage; // need a better home for this
	});				
}




export function processAnyUnseenMessages( unseen )
{
	let fakeNames = [ "Robert Seidl", "Caleb Johnson", "Matt Cowan", "Adrien Bernede", "Ki Steiner" ];
	
	if( unseen.length > 0 )
	{
		let messageInterfaceVisible = isMessageInterfaceVisible();
		let latestEmergencyMessage = -1;
		for( let i=0; i<unseen.length; i++ )
		{
			// why does SQL return the isEmergency as a string ?
			let isEmergency = parseInt(unseen[i].isEmergency)==1
			_insertMessageIntoMessagesScrollPane(	unseen[i].sender,
																unseen[i].text,
																isEmergency,
																messageInterfaceVisible	);
			if( isEmergency )
				latestEmergencyMessage = i;
		}
		if( !messageInterfaceVisible ) // user is doing something else so show popup notification
		{
			if( latestEmergencyMessage!=-1 )
			{
				let name = getPilotInfo( unseen[latestEmergencyMessage].sender ).name;
				let text = unseen[latestEmergencyMessage].text;
				showNotification( name, text, true );
				
				// these sounds do not play: browser policy says: no autoplay (not triggered by user interaction)
				// as page open and API telemetry periodic updates are not user triggered => no sound plays
				speak( "Emergency message from " + name + ". " + text + " !" );
			}
			else
			{
				if( unseen.length==1 )
				{
					let name = getPilotInfo( unseen[0].sender ).name;
					let text = unseen[0].text;
					showNotification( name, text, false );
				}
				else // multiple messages missed
					showNotification( "multiple", "You missed several messages. Click to see them.", false );

				// these sounds do not play: browser policy says: no autoplay (not triggered by user interaction)
				// as page open and API telemetry periodic updates are not user triggered => no sound plays
				playMessageReceivedSound();
			} 
		}
	}
}

// this pops up the notification at the bottom right of the screen
// user can click on close box which dismisses notification (done in bootstrap, no js needed)
// of click anywhere else on the notification which will 
// dismiss it and show the full messages UI. This is also done in bootstrap
// and requires no js here.
// Bootstrap closes current UI elements on click with the
// data-bs-dismiss attribute
// and optionally opens a new UI element with the
// data-bs-toggle="modal" data-bs-target="#messages"
// attributes (where the toggle describes the TYPE of UI element modal/Offcanvas/toast
// and the target is the ID of the UI element to open
// Bootstrap will animate this closing and opening
// Only ONE modal or offcanvas element can be visible at once, else error
export function showNotification( senderName, message, isEmergency, sticky=true )
{
	$(" #notification strong")[0].innerHTML = "Message from " + senderName;
	let b = $(" #notification .toast-body")[0];
	b.innerHTML = message;
	if( isEmergency )
		b.classList.add( "alert-danger" );
	else
		b.classList.remove( "alert-danger" );
	_notificationBSObject.show();

	if( !sticky )
	{
		// quick hack to only temporarily show your own text messages 
		// disappear after 5 seconds
		// cannot set toast delay after creation ?
		setTimeout(function(){ $("#notification").classList.remove("show"); }, 3000);
	}
}


// 	clearAllMessages
export function clearAllMessages(): void
{
	let requestData = {
		'api': 1,
		'method': 'delete',
		'query':
		{
			'entity': 'messages',
			'all': 1
		}
	};
	request( requestData, function()
	{
		// since we successfully wiped the messages off the server
		// lets also nuke them out of the local interface
		$(" #messages .modal-body")[0].innerHTML = "";
	});
}


// createMessage
// given a new incoming message (triggered from an API call update) 
// or a user message to send (triggered by our UI)
// --> generate the DOM elements required to show that message in the messages interface
// (whether it is currently visible or not)
// A user can generate a new message to send in two ways:
// 1. by typing in the messages interface's text input box
// 2. by selecting a canned message from the canned messages popup
// Also do some other UI tasks that probably should not be in here but outside (refactoring TBD)
// 1)
// if the messages interface is visible: scroll it to make sure the new message is visible
// 2)
// play an appropriate sound:
//    for an incoming message:
//       if the messages UI is not yet open: a longer, alerting type of sound to get attention
//       if already open, just a smaller bleep
//       incoming emergency messages are always spoken so they are not missed
//    for an outgoing message
//       always a smaller bleep
// 3)
// adjust UI visibility: if we are receiving a message but the full messages interface
// is not visible, ie the user is just happily flying along in the map, then
// show a polite notification (which when clicked will open the full messages interface)
// and for extra attention, speak the incoming message
//
// feels like 2 & 3 should be done elsewhere, from the API code that receives
// the message perhaps ? A good indication that yes is thats where _G. globals are used :)

let _messageID = 1;

export function _insertMessageIntoMessagesScrollPane( senderID, message, isEmergency, messageInterfaceVisible )
{
	let pilotInfo = getPilotInfo( senderID );
	let myID = getMyPilotInfo().id;
	let senderIsMe = (senderID==myID);

	// create the visual nodes in the messages interface panel to represent this message
	// ie text bubble of the left or right
	// do this by cloning a template and filling in the relevant author name, message text, date etc.
	let source = "messageTemplateForOthers"; // someone else sent this msg
	if( senderIsMe )  // I sent this msg
		source =  "messageTemplateForMe";

	let copy = $("#"+source).cloneNode( true );
	copy.id = "msg" + _messageID; // just need a unique id any will do
	let msgSelector = " #" + copy.id;        // actually probably could do this without the id...tbd
	_messageID++;
	$(" #messages .modal-body")[0].appendChild( copy );
	$(msgSelector+" .msg-body")[0].innerText = message;
	if( !senderIsMe )
	{
		let d = new Date();
		let timestamp = d.toTimeString().substr(0,5);
		$(msgSelector+" .msg-sender")[0].innerText = pilotInfo.name + " " + timestamp;
		$(msgSelector+" img")[0].src = "img/pilotIcons/" + pilotInfo.picture;
	}

	// if it was an emergency message, color it red
	if( isEmergency )
		$(msgSelector+" .msg-body")[0].classList.add( "msg-emergency" );


	// scroll the message interface pane up so this latest message is fully in view
	if( messageInterfaceVisible )
		$(msgSelector+" .msg-body")[0].scrollIntoView();
}



export function createMessage( 	senderID, 		// 
								message, 		// text of message
								isEmergency, 	// boolean 0/1
								playSound, 		// boolean
								sticky=true	// boolean if showing notification, stay up or auto dismiss after 5 secs
								)
{
	let messageInterfaceVisible = isMessageInterfaceVisible();
	
	this._insertMessageIntoMessagesScrollPane( senderID, message, isEmergency, messageInterfaceVisible );
	
	let pilotInfo = getPilotInfo( senderID );
	let myID = getMyPilotInfo().id;


	// play sounds
	if( senderID==myID ) // then we are sending (else we are receiving this message
	{
		playMessageSentSound();
		this.sendMessageToServer( pilotInfo.id, message, isEmergency );
	}
	else // receiving message
	{
		if( playSound )
		{
			if( isEmergency )
				//playEmergencySound();			
				speak( "Emergency message from " + pilotInfo.name + ". " + message + " !" );
			else
				playMessageReceivedSound();
		}

		// if the message interface is not visible and we are receiving a message: show a popup notification
		if( !messageInterfaceVisible )
		{
			showNotification( pilotInfo.name, message, isEmergency, true );
			//speak( sender + " says: " + message );
		}
	}

}


export function isMessageInterfaceVisible()
{
	return $("#messages").style.display == "block";
}

// initialization:

// -----------------------------------------------------
// notification UI element
// -----------------------------------------------------
// Bootstrap calls this a "Toast"
// https://getbootstrap.com/docs/5.0/components/toasts/
// we only ever use one
let _notificationBSObject = new bootstrap.Toast( $("#notification"), {autohide:false} );


export function _showCannedMessages(visible: boolean)
{
	$("#cannedMessages").style.visibility = visible ? "visible" : "hidden";
}




let _messagesBSObject = new bootstrap.Offcanvas($("#messages"));

export function setupMessages() {
	$("#toggleCannedMessages").onclick = function(e)
	{
		_showCannedMessages( $("#cannedMessages").style.visibility == "hidden" );
	}

	// whenever messages UI opens up, make sure we are scrolled to the most recent
	// message (at the bottom)
	// Also autoposition the cursor / focus in the msg input box
	// there is some bug that when the messages interface is hidden and shown
	// again it appears to not be scrolled to the bottom already from previous time
	// Not sure why.
	// Also, responding to show.bs.modal (ie before interface actually gets
	// shown by Bootstrap) does not work. 
	// Probably for the same reason (invisible scrollable divs always scroll
	// themselves to top before being shown perhaps ??)
	$("#messages").addEventListener('shown.bs.modal', function () 
	{
		let mostRecentMessage =	$(" #messages .modal-body:last-child");
		if( mostRecentMessage.length>0 )
			mostRecentMessage.scrollIntoView();
		$("#msgInput").focus();
		// if notification was open, but user clicked on messages button 
		// make the notification disappear anyway
		_notificationBSObject.hide();
	});

	// wire up the text input box at the bottom of the messages interface
	// this gets fired when user presses return / "Done" on mobile keyboards
	$("#msgInput").onchange = function(e)
	{
		const msg = e.target.value.trim();
		if( msg != "" )
		{
			const my = getMyPilotInfo();
			createMessage( my.id, msg, false, true );  // SEND a msg from input contro
		}
		e.target.value = "";
	}


	// go through the message menu and wire up click handlers to each item
	// except the "Custom..." item which does not have a "message" class so wont get picked up
	// Emergency messages also have the "emergency" class set

	$(" #cannedMessages .cannedMessage").forEach(
		function(msg) 
		{
			msg.onclick = function() 
			{
				const my = getMyPilotInfo();
				// SEND a msg from canned messages
				createMessage( my.id, msg.innerText, msg.classList.contains("emergency"), false, false );
				// now hide the canned messages as well as the messages UI (is that too radical ?)
				_showCannedMessages( false );
				_messagesBSObject.hide();
				$("#msgInput").focus();
				return false;
			}
		}
	);
}
