import { me } from "./pilots";
import * as cookies from "./cookies";



function updateFuelRemText(value: number) {
    const fuel_rem = document.getElementById("fuel_rem") as HTMLElement;
    fuel_rem.textContent = value.toFixed(1);
}

function updateFuelRateText(value: number) {
    const fuel_rate = document.getElementById("fuel_rate") as HTMLElement;
    fuel_rate.textContent = value.toFixed(1);
}


export function setupFuelApi() {
    const fuel_dialog = document.getElementById("fuelRemainingDialog") as HTMLDivElement;
    
    let _fuel = 0;
    let _rate = 0;

    fuel_dialog.addEventListener("shown.bs.modal", () => {
        _fuel = 0;
        _rate = 0;
        updateFuelRemText(me.fuel + _fuel);
        updateFuelRateText(me.fuelBurnRate + _rate);
    });

    // Fuel Adjuster
    const addOneFuelBtn = document.getElementById("addOneFuelBtn") as HTMLButtonElement;
    const remOneFuelBtn = document.getElementById("remOneFuelBtn") as HTMLButtonElement;
    addOneFuelBtn.addEventListener("click", () => {
        _fuel += 1;
        updateFuelRemText(me.fuel + _fuel);
    });
    remOneFuelBtn.addEventListener("click", () => {
        _fuel = Math.max(-me.fuel, _fuel - 1);
        updateFuelRemText(me.fuel + _fuel);
    });

    const addDecFuelBtn = document.getElementById("addDecFuelBtn") as HTMLButtonElement;
    const remDecFuelBtn = document.getElementById("remDecFuelBtn") as HTMLButtonElement;
    addDecFuelBtn.addEventListener("click", () => {
        _fuel += 0.1;
        updateFuelRemText(me.fuel + _fuel);
    });
    remDecFuelBtn.addEventListener("click", () => {
        _fuel = Math.max(-me.fuel, _fuel - 0.1);
        updateFuelRemText(me.fuel + _fuel);
    });

    // Rate Adjuster
    const addDecFuelRateBtn = document.getElementById("addDecFuelRateBtn") as HTMLButtonElement;
    const remDecFuelRateBtn = document.getElementById("remDecFuelRateBtn") as HTMLButtonElement;
    addDecFuelRateBtn.addEventListener("click", () => {
        _rate += 0.1;
        updateFuelRateText(me.fuelBurnRate + _rate);
    });
    remDecFuelRateBtn.addEventListener("click", () => {
        _rate = Math.max(-me.fuelBurnRate, _rate - 0.1);
        updateFuelRateText(me.fuelBurnRate + _rate);
    });

    const fuel_accept_btn = document.getElementById("fuel_accept_btn") as HTMLButtonElement;
    fuel_accept_btn.addEventListener("click", () => {
        // make the adjustment
        if (_fuel != 0.0) {
            me.fuel += _fuel;
            me.last_fuel_adjustment = Date.now();
            me.updateFuel(Date.now());

            // TODO: inteligently bump the burn rate up/down using me.last_fuel_adjustment
        }

        if (_rate != 0.0) {
            me.fuelBurnRate += _rate;
            cookies.set("me.fuel_rate", me.fuelBurnRate.toFixed(4), 99);
        }
    });
}

