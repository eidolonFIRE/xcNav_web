import generateAvatar from "github-like-avatar-generator";
import { me } from "./pilots";

export function setupProfileEditor() {

    const pe_avatar = document.getElementById("pe_avatar") as HTMLImageElement;
    const pe_draggable = document.getElementById("pe_draggable") as HTMLDivElement;


    if (me.avatar != null && me.avatar != "") {
        // load existing picture
        pe_avatar.src = me.avatar;
    } else {
        // or base64 fashion way
        let avatar = generateAvatar({
            blocks: 8, // must be multiple of two
            width: 8
        });
        pe_avatar.src = avatar.base64;
    }

    // Upload picture
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
            pe_avatar.src = e.target.result;
            
        };
        reader.readAsDataURL(filename);
    });

    // zoom
    const pe_drag_editor: HTMLElement = document.getElementById("pe_drag_editor");
    const pe_zoom = document.getElementById("pe_zoom") as HTMLInputElement;
    pe_zoom.addEventListener("input", (ev: Event) => {
        // setTranslate();
        // pe_drag_editor.style.perspective = pe_zoom.value + "px" + "!important";
        // console.log(pe_zoom.value)
        pe_draggable.style.width = pe_zoom.value + "px";
        pe_draggable.style.height = pe_zoom.value + "px";
    });



    

    // https://www.kirupa.com/html5/drag.htm

    let active = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    // mobile
    pe_drag_editor.addEventListener("touchstart", dragStart, false);
    pe_drag_editor.addEventListener("touchend", dragEnd, false);
    pe_drag_editor.addEventListener("touchmove", drag, false);

    // browser
    pe_drag_editor.addEventListener("mousedown", dragStart, false);
    pe_drag_editor.addEventListener("mouseup", dragEnd, false);
    pe_drag_editor.addEventListener("mousemove", drag, false);

    function dragStart(e) {
        if (e.type === "touchstart") {
            initialX = e.touches[0].clientX - xOffset;
            initialY = e.touches[0].clientY - yOffset;
        } else {
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
        }

        if (e.target === pe_draggable) {
            active = true;
        }
    }

    function dragEnd(e) {
        initialX = currentX;
        initialY = currentY;

        active = false;
    }

    function drag(e) {
        if (active) {
            e.preventDefault();
        
            if (e.type === "touchmove") {
                currentX = e.touches[0].clientX - initialX;
                currentY = e.touches[0].clientY - initialY;
            } else {
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
            }

            xOffset = currentX;
            yOffset = currentY;

            setTranslate();
        }
    }

    function setTranslate() {
        pe_draggable.style.transform = "translate3d(" + currentX + "px, " + currentY + "px, 0)";
    }

}

