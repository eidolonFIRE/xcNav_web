/*
    Misc utilities and constants
*/

import * as L from "leaflet";
import * as GeometryUtil from "leaflet-geometryutil";
import { getMap } from "./mapUI";


// Use $(Selector) without jQuery
// https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelector
export function $(query: string): any {
	return (query[0] === '#') ? document.querySelector(query) : document.querySelectorAll(query);
}

export interface ETA {
    time: number
    dist: number
}

export const km2Miles = 0.621371;
export const meters2Feet = 3.28084;
export const meter2Mile = km2Miles / 1000;
export const mpms2mph = meter2Mile / 3600;

// TODO: pick sensible colors that are clear on map
export const colors = [ 'aqua', 'black', 'blue', 'fuchsia', 'green', 'lime', 'maroon', 'navy', 'olive', 'purple', 'yellow' ];

// Create a UUID (for api.ID)
export function make_uuid(len: number): string {
    const u8 = new Uint8Array(len);
    window.crypto.getRandomValues(u8);
    return btoa(String.fromCharCode.apply(null, u8))
}

export function randInt (min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomCentered() {
    return Math.random()*2 - 1; // centered, -1..1
}

export function geoTolatlng(geoPos: GeolocationCoordinates): L.LatLng {
    return new L.LatLng(
        geoPos.latitude,
        geoPos.longitude,
        geoPos.altitude
    );
}

export function rawTolatlng(lat: number, lng: number, alt: number): L.LatLng {
    return new L.LatLng(
        lat,
        lng,
        alt
    );
}

export function objTolatlng(point_obj: any): L.LatLng {
    return new L.LatLng(
        point_obj.lat,
        point_obj.lng,
        point_obj.alt
    );
}

export function geoHeading(seg_start: L.LatLng, seg_end: L.LatLng): number {
    return L.GeometryUtil.bearing(seg_start, seg_end);
}

export function mSecToStr_h_mm(duration: number): string {
    let sec_num = duration / 1000;
    let hours   = Math.floor(sec_num / 3600);
    let minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    return hours.toString() + ':' + minutes.toString().padStart(2, "0");
}

export function strFormat(format: string, args: Record<string, string>): string {
    let retval = format;
    Object.keys(args).forEach((key: string) => {
        retval = retval.replace("{" + key + "}", args[key]);
    });
    return retval;
}

export function colorWheel(pos: number, bri=1.0): string {
    // Select color from rainbow
    let color: number[];
    pos = pos % 1.0
    if (pos < 1/3) {
        color = [pos * 3.0, (1.0 - pos * 3.0), 0.0]
    } else if (pos < 2/3) {
        pos -= 1/3
        color = [(1.0 - pos * 3.0), 0.0, pos * 3.0]
    } else {
        pos -= 2/3
        color = [0.0, pos * 3.0, (1.0 - pos * 3.0)]
    }
    color = [
        Math.max(0, Math.min(255, Math.round(color[0] * 255 * bri))),
        Math.max(0, Math.min(255, Math.round(color[1] * 255 * bri))),
        Math.max(0, Math.min(255, Math.round(color[2] * 255 * bri))),
    ]
    return color[0].toString(16).padStart(2, "0") + color[1].toString(16).padStart(2, "0") + color[2].toString(16).padStart(2, "0")
}

export function remainingDistOnPath(geo: L.LatLng, path: L.LatLng[] | any[], path_length: number, reversed = false) {
    const _map = getMap();
    const polyLine = L.polyline(path);

    const ratio = L.GeometryUtil.locateOnLine(_map, polyLine, geo);
    const dist_nearest = geo.distanceTo(L.GeometryUtil.interpolateOnLine(_map, path, ratio).latLng);
    const rem_path = (reversed ? ratio : 1 - ratio) * path_length;
    return dist_nearest + rem_path;
}