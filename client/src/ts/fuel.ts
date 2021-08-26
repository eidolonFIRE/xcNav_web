import { me } from "./pilots";




function updateFuelRemText() {
    const fuel_rem = document.getElementById("fuel_rem") as HTMLHeadingElement;
    fuel_rem.textContent = me.fuel.toFixed(1) + " L";
}


export function setupFuelApi() {
    const fuel_dialog = document.getElementById("fuelRemainingDialog") as HTMLDivElement;
    

    fuel_dialog.addEventListener("shown.bs.modal", () => {
        updateFuelRemText();
    });

    const addOneFuelBtn = document.getElementById("addOneFuelBtn") as HTMLButtonElement;
    const remOneFuelBtn = document.getElementById("remOneFuelBtn") as HTMLButtonElement;
    addOneFuelBtn.addEventListener("click", () => {
        me.fuel += 1;
        updateFuelRemText();
    });
    remOneFuelBtn.addEventListener("click", () => {
        me.fuel = Math.max(0.0, me.fuel - 1);
        updateFuelRemText();
    });

    const addQrtFuelBtn = document.getElementById("addQrtFuelBtn") as HTMLButtonElement;
    const remQrtFuelBtn = document.getElementById("remQrtFuelBtn") as HTMLButtonElement;
    addQrtFuelBtn.addEventListener("click", () => {
        me.fuel += 0.25;
        updateFuelRemText();
    });
    remQrtFuelBtn.addEventListener("click", () => {
        me.fuel = Math.max(0.0, me.fuel - 0.25);
        updateFuelRemText();
    });
}

