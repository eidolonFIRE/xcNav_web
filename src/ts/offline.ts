import { $ } from "./util";


export function areWeOnline(): boolean
{
    return navigator.onLine;
}

function _handleConnectionEvents( online: boolean ): void
{
    if( online )
        console.log( "Online, starting periodic telemetry updates");
    else
        console.log( "Offline. Halting telemetry updates until we are back online");

    $("#offlineBadge").style.visibility = (online ? 'hidden' : 'visible');
}

export function setupOfflineHandler(): void
{
    // https://developer.mozilla.org/en-US/docs/Web/API/NavigatorOnLine/onLine
    // https://developer.mozilla.org/en-US/docs/Web/API/NavigatorOnLine/Online_and_offline_events
    window.addEventListener('offline', function() { _handleConnectionEvents(false) });
    window.addEventListener('online', function() { _handleConnectionEvents(true) });
}
