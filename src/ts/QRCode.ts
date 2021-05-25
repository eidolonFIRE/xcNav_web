import Html5Qrcode from "html5-qrcode";
import * as bootstrap from "bootstrap";
import { speak, playMessageReceivedSound, playMessageSentSound} from "./sounds";
import { $ } from "./util";


// reference:
// npm install html5-qrcode
// https://github.com/mebjas/html5-qrcode  
  
//export function QRCode() 
//{
    var options =
    {
    fps: 10,    // Optional frame per seconds for qr code scanning
    qrbox: 500  // Optional if you want bounded box UI
    };

    var preferredCamera =
    {
    facingMode: "environment"     // "user" | "environment" preferred
    // { exact: "environment" }   // "user" | "environment" required
    };



    const qrCodeSuccessCallback = function( message )
    {
    console.log( "Found a QR code !!!" );
    console.log( message );
    
    //playMessageReceivedSound();
    speak( "Q R code found.")
    alert( message );
    // soon, we will be doing real stuff here 
    // 1. check whether QR code contained one of our meetup IDs and is not some random code
    // 2. if yes, ask API for that meetup and if successful, set the overlays and get the other pilots etc.
    // 3. dismiss this dialog
    //myQRScanner.stop();
    }

    const qrCodeParseErrorCallback = function( err )
    {
    //console.log( "QR Parse Error" );
    //console.log( err );
    }

    function _startScanning()
    {
    // This method will trigger user permissions
    myQRScanner.getCameras().then(devices => {
        /**
         * devices would be an array of objects of type:
         * { id: "id", label: "label" }
         */
        if (devices && devices.length) {
        var cameraId = devices[0].id;
        // .. use this to start scanning.
        
        var onMobileDevice = "ontouchend" in document; // no touch -> desktop
        
        var camera;
        if( onMobileDevice ) // ios safari
            camera = preferredCamera
        else
            camera = devices[0].id
        
            myQRScanner.start( 
            camera, 
            options, 
            qrCodeSuccessCallback,
            qrCodeParseErrorCallback
            )
            .catch( function(err) {
            console.log( "Could not start QR Code reader" );
            console.log( err );
            })

        }
    }).catch(function (err) {
        // handle err
        console.log( "Html5Qrcode.getCameras error....did you not give permission to use the camera ?" );
        console.log( err );
    });
    }

    // what is the lifetime of this (likely rather heavy) myQRScanner object ?
    //const myQRScanner = new Html5Qrcode(/* element id */ "reader");
    const myQRScanner = null;

    export
    function setupQRCode()
    {
        console.log("QRCode.setupQRCode() called");
        $("#stopQRCodeScanner").onclick = function()
        {
            myQRScanner.stop();
        }

        $("#QRCodeScannerDialog").addEventListener('shown.bs.modal', function () {
            //_startScanning();
        })
    }
//}