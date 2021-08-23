import * as bootstrap  from "bootstrap";

import * as client from "./client";
import generateAvatar from "github-like-avatar-generator";
import { me } from "./pilots";



const profileEditor = document.getElementById("profileEditor") as HTMLDivElement;
const profileEditor_modal = new bootstrap.Modal(profileEditor);
const pe_name = document.getElementById("pe_name") as HTMLInputElement;

export function showProfileEditor(required: boolean) {
    const pe_cancel_btn = document.getElementById("pe_cancel_btn") as HTMLButtonElement;
    if (required) {
        pe_cancel_btn.style.display = "none";
    } else {
        pe_cancel_btn.style.display = "block";
    }

    pe_name.style.border = "";

    profileEditor_modal.show();
}


export function setupProfileEditor() {
    // edit profile button
    const edit_profile_btn = document.getElementById("edit_profile_btn") as HTMLButtonElement;
    edit_profile_btn.addEventListener("click", () => {
        showProfileEditor(false);
    });


    const pe_avatar_small = document.getElementById("pe_avatar_small") as HTMLCanvasElement;
    const canvas_prev = pe_avatar_small.getContext("2d");
    
    const container = document.getElementById("pe_editor_container") as HTMLDivElement;
    const pe_drag_editor: HTMLElement = document.getElementById("pe_drag_editor");
    const pe_zoom = document.getElementById("pe_zoom") as HTMLInputElement;
    const canvas = document.getElementById("pe_drag_editor") as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");

    const pe_done_btn = document.getElementById("pe_done_btn") as HTMLButtonElement;
    

    const targetCanvas = document.createElement("canvas") as HTMLCanvasElement;
    const targetCtx = targetCanvas.getContext("2d");

    const targetAvatarSize = 64;

    targetCanvas.width = targetAvatarSize;
    targetCanvas.height = targetAvatarSize;
    
    let img = new Image();
    let mouseDownX = 0;
    let mouseDownY = 0;
    let offsetX = 0;
    let offsetY = 0;
    let scale = Number(pe_zoom.value) / 100.0;
    let active = false;

    if (me.avatar != null && me.avatar != "") {
        // load existing picture
        img.src = me.avatar;
    } else {
        // or base64 fashion way
        let avatar = generateAvatar({
            blocks: 8, // must be multiple of two
            width: 8
        });
        img.src = avatar.base64;
    }


    // --- When profile editor shows
    profileEditor.addEventListener("shown.bs.modal", () => {
        pe_name.value = me.name;
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        render();
    });

    // --- Upload picture button
    const pe_upload_input = document.getElementById("pe_upload_input") as HTMLInputElement;
    const pe_upload = document.getElementById("pe_upload") as HTMLButtonElement;
    pe_upload.addEventListener("click", (ev: MouseEvent) => {
        pe_upload_input.click();
    });
    pe_upload_input.addEventListener("change", (ev: Event) => {
        const filename = pe_upload_input.files[0];
        const reader = new FileReader();
        reader.onload = function(e) {
            // @ts-ignore
            img.src = e.target.result;
            offsetX = 0;
            offsetY = 0;
            scale = 1.0;
            pe_zoom.value = "100";
            active = false;
            mouseDownX = 0;
            mouseDownY = 0;
            render();
        };
        reader.readAsDataURL(filename);
    });

    // --- change zoom
    pe_zoom.addEventListener("input", (ev: Event) => {
        scale = Number(pe_zoom.value) / 100.0;
        render();
    });

    // --- DONE button
    pe_done_btn.addEventListener("click", (ev: MouseEvent) => {
        // check name is valid
        if (pe_name.value != "") {
            me.setName(pe_name.value);
            me.setAvatar(exportCroppedImg());
            // TODO: push changes to server
            client.pushProfile();

            profileEditor_modal.hide();
        } else {
            // You must enter a name!
            pe_name.style.border = "solid red 0.5em";
        }
    });

    function exportCroppedImg() {
        // copy to small image
        targetCtx.drawImage(canvas,
            canvas.width/2 - _s, canvas.height/2 - _s, _s*2, _s*2,
             0, 0, targetCanvas.width, targetCanvas.height)
        return targetCanvas.toDataURL('image/jpeg', 0.8);
    }

    
    // mobile
    pe_drag_editor.addEventListener("touchstart", dragStart, false);
    pe_drag_editor.addEventListener("touchend", dragEnd, false);
    pe_drag_editor.addEventListener("touchmove", drag, false);

    // browser
    pe_drag_editor.addEventListener("mousedown", dragStart, false);
    pe_drag_editor.addEventListener("mouseup", dragEnd, false);
    pe_drag_editor.addEventListener("mousemove", drag, false);

    function dragStart(e) {
        active = true;
        if (e.type === "touchstart") {
            
            mouseDownX = e.touches[0].clientX - offsetX;
            mouseDownY = e.touches[0].clientY - offsetY;
        } else {
            mouseDownX = e.clientX - offsetX;
            mouseDownY = e.clientY - offsetY;
        }
    }
    function drag(e) {
        console.log(e)
        if (active) {
            if (e.type === "touchmove") {
                
                offsetX = e.touches[0].clientX - mouseDownX;
                offsetY = e.touches[0].clientY - mouseDownY;
            } else {
                offsetX = e.clientX - mouseDownX;
                offsetY = e.clientY - mouseDownY;
            } 
            render();
        }
    }
    function dragEnd(e) {
        active = false;
    }
    
    // target window size for silk screen
    const _r = 4/5;
    const _s = canvas.width * _r / 2;

    function render() {
        console.log(offsetX, offsetY, scale);
        // --- erase background
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // --- boundaries
        const src_r = img.width / img.height;
        const bsx = _s * scale * 2 * (src_r >= 1 ? src_r : 1);
        const bsy = _s * scale * 2 * (src_r >= 1 ? 1 : 1/src_r);
        offsetX = Math.min(offsetX, _s * (scale - 1) + (bsx - _s * 2 * scale) / 2);
        offsetY = Math.min(offsetY, _s * (scale - 1) + (bsy - _s * 2 * scale) / 2);
        offsetX = Math.max(offsetX, -_s * (scale - 1) - (bsx - _s * 2 * scale) / 2);
        offsetY = Math.max(offsetY, -_s * (scale - 1) - (bsy - _s * 2 * scale) / 2);

        // --- draw avatar
        ctx.drawImage(img, 
            offsetX - (bsx) / 2 + canvas.width / 2,
            offsetY - (bsy) / 2 + canvas.height / 2, 
            bsx, bsy);

        // --- draw silkscreen
        ctx.fillStyle = "#111111B0";
        ctx.beginPath();
        ctx.rect(0, 0, canvas.width, canvas.height / 2 - _s);             // top
        ctx.rect(0, 0, canvas.width / 2 - _s, canvas.height);             // left
        ctx.rect(0, canvas.height / 2 + _s, canvas.width, canvas.height); // bottom
        ctx.rect(canvas.width / 2 + _s, 0, canvas.width, canvas.height);  // right
        ctx.fill();

        ctx.strokeStyle = "white";
        ctx.strokeRect(canvas.width/2 - _s - 1, canvas.height/2 - _s - 1, _s*2 + 2, _s*2 + 2);

        // copy to preview canvas
        canvas_prev.drawImage(canvas,
            canvas.width/2 - _s, canvas.height/2 - _s, _s*2, _s*2,
             0, 0, pe_avatar_small.width, pe_avatar_small.height);
    }

}

