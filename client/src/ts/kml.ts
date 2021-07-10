import * as parser from "fast-xml-parser";
import * as L from "leaflet";

import { FlightPlan, myPlan, Waypoint } from "./flightPlan";




function _coordinates(coords) {
    return coords.split("\n").map(p => {
        const numbers = p.split(",")
        return L.latLng(Number(numbers[1]), Number(numbers[0]));
    });
}



export function parseKML(data: string): FlightPlan {
    // https://github.com/NaturalIntelligence/fast-xml-parser
    const kml = parser.parse(data, {arrayMode:/Folder|Placemark/}).kml.Document;
    const plan = {
        name: kml.name,
        waypoints: [],
        date_saved: 0,
    } as FlightPlan;

    kml.Folder.forEach(folder => {
        folder.Placemark.forEach(placemark => {
            const wp = {
                name: placemark.name,
                geo: [],
                optional: placemark.name.startsWith("_"),
            } as Waypoint;

            if ("Point" in placemark) {
                // Marker
                wp.geo = _coordinates(placemark.Point.coordinates);
            } else if ("LineString" in placemark) {
                // Path
                wp.geo = _coordinates(placemark.LineString.coordinates);
            }
            plan.waypoints.push(wp);
        });
    });

    return plan;
}





// ---------------------------------------
// 
// ---------------------------------------
export function setupFlightPlanUpload()
{
    const fileSelector = document.getElementById("kmz_file_selector") as HTMLInputElement;

    const submitBtn = document.getElementById("uploadFlightPlanSubmitBtn") as HTMLButtonElement;
    submitBtn.addEventListener("click", (ev: MouseEvent) => {

        const filename = fileSelector.files[0];
        const reader = new FileReader();
        reader.onload = function(e) {
            myPlan.append(parseKML(e.target.result.toString()));
        };
        reader.readAsText(filename);

    });
    
    // let kmz = $("#kmz");
    // kmz.onchange = function(e)
    // {
    //     if( kmz.value.endsWith( ".kmz" ) || kmz.value.endsWith(".kml") )
    //         $("#kmzSubmitButton").disabled = false;
    // }
    
    // let theMenuElement = $("#uploadKMZMenu");
    // // TODO: this isn't used?
    // let _uploadKMZMenu = new bootstrap.Offcanvas( theMenuElement );
}