import PropTypes from "prop-types";
import React from "react";
import { ModalBody } from "react-bootstrap";
import swal from "sweetalert";
import * as THREE from "three";
import ThreeOrbitControls from "three-orbit-controls";

import { Made } from "@exabyte-io/made.js";
import { THREE_D_BASE_URL, THREE_D_SOURCES } from "../enums";
import settings from "../settings";
import { materialsToThreeDSceneData, ThreeDSceneDataToMaterial } from "../utils";
import { LoadingIndicator } from "./LoadingIndicator";
import { ModalDialog } from "./ModalDialog";
import { ShowIf } from "./ShowIf";

export class ThreejsEditorModal extends ModalDialog {
    constructor(props) {
        super(props);
        window.THREE = THREE;
        this.editor = undefined;
        this.domElement = undefined;
        this.state = { areScriptsLoaded: false };
        this.injectScripts();
    }

    // eslint-disable-next-line no-unused-vars
    componentDidUpdate(prevProps, prevState, snapshot) {
        window.localStorage.removeItem("threejs-editor");
    }

    /**
     * `Number.prototype.format` is used inside three.js editor codebase to format the numbers.
     * The editor does not start without it. The ESLint line is a way to turn off the warning shown in the console.
     */
    // eslint-disable-next-line class-methods-use-this
    setNumberFormat() {
        /* eslint no-extend-native: [0, { "exceptions": ["Object"] }] */
        Number.prototype.format = function () {
            return this.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
        };
    }

    /**
     * Initialize threejs editor and add it to the DOM.
     */
    initializeEditor() {
        // adjust the orientation to have Z-axis up/down
        THREE.Object3D.DefaultUp.set(0, 0, 1);

        // create a PerspectiveCamera at specific position and pass to the editor to override the default one.
        const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 20000);
        camera.name = "Camera";
        camera.position.copy(new THREE.Vector3(0, -20, 8));
        camera.lookAt(new THREE.Vector3(0, 0, 0));

        // initialize editor and set the scene background
        this.editor = new window.Editor(camera);
        this.editor.scene.background = new THREE.Color(settings.backgroundColor);

        // pass onHide handler to editor
        this.editor.onHide = this.onHide;

        // initialize viewport and add it to the DOM
        const viewport = new window.Viewport(this.editor);
        this.domElement.appendChild(viewport.dom);

        // initialize UI elements and add them to the DOM
        const toolbar = new window.Toolbar(this.editor);
        this.domElement.appendChild(toolbar.dom);
        const script = new window.Script(this.editor);
        this.domElement.appendChild(script.dom);
        const player = new window.Player(this.editor);
        this.domElement.appendChild(player.dom);
        const menubar = new window.Menubar(this.editor);
        this.domElement.appendChild(menubar.dom);
        const sidebar = new window.Sidebar(this.editor);
        this.domElement.appendChild(sidebar.dom);
        const modal = new window.UI.Modal();
        this.domElement.appendChild(modal.dom);

        // add OrbitControls to allow the camera to orbit around the scene.
        const OrbitControls = ThreeOrbitControls(THREE);
        const orbitControls = new OrbitControls(
            this.editor.camera,
            document.getElementById("viewport"),
        );
        orbitControls.enabled = true;
        orbitControls.enableZoom = true;
        orbitControls.enableKeys = false;
        orbitControls.rotateSpeed = 2.0;
        orbitControls.zoomSpeed = 2.0;
        orbitControls.update();
    }

    /**
     * Add dragover listeners to group the objects.
     */
    addEventListeners() {
        const clsInstance = this;
        document.addEventListener(
            "dragover",
            (event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
            },
            false,
        );

        function onWindowResize() {
            clsInstance.editor.signals.windowResize.dispatch();
        }

        window.addEventListener("resize", onWindowResize, false);
        onWindowResize();
    }

    /**
     * Load the scene based on the given materials.
     */
    loadScene() {
        const loader = new THREE.ObjectLoader();
        const scene = loader.parse(materialsToThreeDSceneData(this.props.materials));
        this.editor.execute(new window.SetSceneCommand(scene));
        this.editor.signals.objectSelected.dispatch(this.editor.camera);
    }

    /**
     * Inject threejs editor scripts into DOM.
     * `areScriptsLoaded` flag is used to enable/disable a loader as it takes some time to load the scripts.
     */
    injectScripts() {
        const clsInstance = this;
        THREE_D_SOURCES.forEach((src) => {
            const script = document.createElement("script");
            script.src = `${THREE_D_BASE_URL}/${src}`;
            script.async = false;
            script.defer = false;
            if (src.includes("SetSceneCommand")) {
                script.onload = () => {
                    clsInstance.setState({ areScriptsLoaded: true });
                    clsInstance.setNumberFormat();
                    clsInstance.initializeEditor();
                    clsInstance.addEventListeners();
                    clsInstance.loadScene();
                };
            }
            document.head.appendChild(script);
        });
    }

    showAlert() {
        swal({
            icon: "error",
            buttons: {
                cancel: "Cancel",
                exit: "Exit",
            },
            text: "Unable to extract a material from the editor!",
        }).then((value) => {
            switch (value) {
                case "exit":
                    super.onHide();
                    break;
                default:
                    break;
            }
        });
    }

    onHide() {
        try {
            const material = ThreeDSceneDataToMaterial(this.editor.scene);
            super.onHide(material);
        } catch (e) {
            this.showAlert(e);
        }
    }

    renderBody() {
        return (
            <ModalBody>
                <div
                    ref={(el) => {
                        this.domElement = el;
                    }}
                />
                <ShowIf condition={!this.state.areScriptsLoaded}>
                    <LoadingIndicator />
                </ShowIf>
            </ModalBody>
        );
    }
}

ThreejsEditorModal.propTypes = {
    materials: PropTypes.arrayOf(Made.Material).isRequired,
};
