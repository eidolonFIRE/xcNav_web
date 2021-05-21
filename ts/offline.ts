function Offline()
{
    this.areWeOnline = function(): boolean
    {
        return navigator.onLine;
    }

    this._handleConnectionEvents = function( online: boolean ): void
    {
        if( online )
            console.log( "Online, starting periodic telemetry updates");
        else
            console.log( "Offline. Halting telemetry updates until we are back online");

        $("#offlineBadge").style.visibility = (online ? 'hidden' : 'visible');
        G.pilots.simulateLocations( online );
    }

    this._init = function(): void
    {
        // https://developer.mozilla.org/en-US/docs/Web/API/NavigatorOnLine/onLine
        // https://developer.mozilla.org/en-US/docs/Web/API/NavigatorOnLine/Online_and_offline_events
        window.addEventListener('offline', function() { G.offline._handleConnectionEvents(false) });
        window.addEventListener('online', function() { G.offline._handleConnectionEvents(true) });
    }

    this._init();
}

G.offline = new Offline();

