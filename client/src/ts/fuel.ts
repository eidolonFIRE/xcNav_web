import { me } from "./pilots";




function updateFuelRemText(value: number) {
    const fuel_rem = document.getElementById("fuel_rem") as HTMLHeadingElement;
    fuel_rem.textContent = value.toFixed(1) + " L";
}


export function setupFuelApi() {
    const fuel_dialog = document.getElementById("fuelRemainingDialog") as HTMLDivElement;
    
    let _adjust_amount = 0;

    fuel_dialog.addEventListener("shown.bs.modal", () => {
        _adjust_amount = 0;
        updateFuelRemText(me.fuel + _adjust_amount);
    });

    // Fuel Adjuster
    const addOneFuelBtn = document.getElementById("addOneFuelBtn") as HTMLButtonElement;
    const remOneFuelBtn = document.getElementById("remOneFuelBtn") as HTMLButtonElement;
    addOneFuelBtn.addEventListener("click", () => {
        _adjust_amount += 1;
        updateFuelRemText(me.fuel + _adjust_amount);
    });
    remOneFuelBtn.addEventListener("click", () => {
        _adjust_amount = Math.max(-me.fuel, _adjust_amount - 1);
        updateFuelRemText(me.fuel + _adjust_amount);
    });

    const addDecFuelBtn = document.getElementById("addDecFuelBtn") as HTMLButtonElement;
    const remDecFuelBtn = document.getElementById("remDecFuelBtn") as HTMLButtonElement;
    addDecFuelBtn.addEventListener("click", () => {
        _adjust_amount += 0.1;
        updateFuelRemText(me.fuel + _adjust_amount);
    });
    remDecFuelBtn.addEventListener("click", () => {
        _adjust_amount = Math.max(-me.fuel, _adjust_amount - 0.1);
        updateFuelRemText(me.fuel + _adjust_amount);
    });

    const fuel_accept_btn = document.getElementById("fuel_accept_btn") as HTMLButtonElement;
    fuel_accept_btn.addEventListener("click", () => {
        // make the adjustment
        if (_adjust_amount != 0.0) {
            me.fuel += _adjust_amount;
            me.last_fuel_adjustment = Date.now();
        }
    });
}

