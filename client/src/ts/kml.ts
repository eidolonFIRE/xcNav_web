import * as parser from "fast-xml-parser";
import * as L from "leaflet";

import { planManager } from "./flightPlan";
import * as api from "../../../server/src/ts/api";



function _coordinates(coords) {
    return coords.split("\n").map(p => {
        const numbers = p.split(",")
        return L.latLng(Number(numbers[1]), Number(numbers[0]));
    });
}



export function parseKML(data: string): api.FlightPlanData {
    // https://github.com/NaturalIntelligence/fast-xml-parser
    const kml = parser.parse(data, {arrayMode:/Folder|Placemark/}).kml.Document;
    const plan = {
        name: kml.name,
        waypoints: [],
    } as api.FlightPlanData;

    kml.Folder.forEach(folder => {
        folder.Placemark.forEach(placemark => {
            const wp = {
                name: placemark.name,
                geo: [],
                optional: placemark.name.startsWith("_"),
            } as api.Waypoint;

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
            planManager.plans["me"].append(parseKML(e.target.result.toString()));
        };
        reader.readAsText(filename);

    });
}
