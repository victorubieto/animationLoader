import * as THREE from 'https://cdn.skypack.dev/three@0.136';
import * as datGui from 'https://cdn.skypack.dev/dat.gui';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/controls/OrbitControls.js';
import { BVHLoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/BVHLoader.js';
import { LoaderUtils } from "./utils.js";

class App {

    constructor() {
        
        this.clock = new THREE.Clock();
        this.loader = new BVHLoader();

        this.camera = null;
        this.controls = null;
        this.scene = null;
        this.renderer = null;

        this.mixer = null;
        this.skeletonHelper = null;

        this.options = {};
    }

    init() {

        this.camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.1, 1000 );
        this.camera.position.set( 0, 200, 300 );

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color( 0xeeeeee );

        this.scene.add( new THREE.GridHelper( 400, 10 ) );

        // renderer
        this.renderer = new THREE.WebGLRenderer( { antialias: true } );
        this.renderer.setPixelRatio( window.devicePixelRatio );
        this.renderer.setSize( window.innerWidth, window.innerHeight );

        const canvas = this.renderer.domElement;

        document.body.appendChild( canvas );

        canvas.ondragover = () => {return false};
        canvas.ondragend = () => {return false};
        canvas.ondrop = (e) => this.onDrop(e);
        
        this.controls = new OrbitControls( this.camera, canvas );
        this.controls.minDistance = 50;
        this.controls.maxDistance = 750;
        this.controls.target = new THREE.Vector3( 0, 50, 0 );
        this.controls.update();
        
        this.loader.load( 'data/skeletons/create_db.bvh', (result) => {
            this.skeletonHelper = new THREE.SkeletonHelper( result.skeleton.bones[0] );
            this.skeletonHelper.skeleton = result.skeleton; // allow animation mixer to bind to THREE.SkeletonHelper directly
            
            // Correct mixamo skeleton rotation
            let obj = new THREE.Object3D();
            obj.add( this.skeletonHelper )
            obj.rotateOnAxis( new THREE.Vector3(1,0,0), Math.PI/2 );
            
            let boneContainer = new THREE.Group();
            boneContainer.add( result.skeleton.bones[0] );
            
            this.scene.add( obj );
            this.scene.add( boneContainer );

            this.mixer = new THREE.AnimationMixer( this.skeletonHelper );
        } );
        
        window.addEventListener( 'resize', this.onWindowResize.bind(this) );
        
        this.initGUI();
        this.animate();
    }

    initGUI() {

        this.options = {
            
            bgColor: "#eeeeee",
            fov: 60,

            insertQuats: () => {
                let input = document.createElement('input');
                input.type = 'file';
                input.onchange = (e) => {
                    let file = e.target.files[0];
                    if (file.name.includes('.json'))
                        LoaderUtils.loadTextFile( file, data => {
                            let quats = JSON.parse(data);
                            // Create the clip from the quaternions
                            let animationClip = this.createAnimationFromRotations('Test', quats);
                            // Apply the clip to the mixer
                            this.mixer.clipAction(animationClip).setEffectiveWeight(1.0).play();
                        });
                    else
                        alert('The extension of the file does not match with the expected input');
                }
                input.click();
            },

            reset: () => {
                if (this.mixer)
                    this.mixer.stopAllAction();
            }
        };
        
        // See documentation to add more options at https://github.com/dataarts/dat.gui/blob/master/API.md
        let gui = new datGui.GUI();
        
        gui.add(this.options,'insertQuats').name('Load Quaternions');
        gui.add(this.options,'reset').name('Reset Pose');
    }
    
    onDrop( event ) {

        event.preventDefault();
        event.stopPropagation();

        const files = event.dataTransfer.files;

        if(!files.length)
            return;

        for (let i = 0; i < files.length; i++) {
            let file = files[i],
            name = file.name,
            tokens = name.split("."),
            extension = tokens[tokens.length-1].toLowerCase(),
            valid_extensions = [ 'bvh' ];
            
            if (valid_extensions.lastIndexOf(extension) < 0) {
                alert("Invalid file extension. Extension was '" + extension + "'");
                return;
            }

            LoaderUtils.loadTextFile( file, text => {
                const data = this.loader.parse( text );
                this.onLoadBVH(data) ;
            });
        }
    }

    animate() {

        requestAnimationFrame( this.animate.bind(this) );

        const delta = this.clock.getDelta();

        if ( this.mixer ) this.mixer.update( delta );

        this.renderer.render( this.scene, this.camera );
    }
    
    onWindowResize() {

        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize( window.innerWidth, window.innerHeight );
    }

    createAnimationFromRotations( name, quaternions_data ) {

        let names = quaternions_data[quaternions_data.length - 1];
        if (typeof(names[0]) != "string")
            names = ["mixamorigHips.quaternion","mixamorigSpine.quaternion","mixamorigSpine1.quaternion","mixamorigSpine2.quaternion","mixamorigNeck.quaternion","mixamorigHead.quaternion","mixamorigLeftShoulder.quaternion","mixamorigLeftArm.quaternion","mixamorigLeftForeArm.quaternion","mixamorigLeftHand.quaternion","mixamorigLeftHandThumb1.quaternion","mixamorigLeftHandThumb2.quaternion","mixamorigLeftHandThumb3.quaternion","mixamorigLeftHandIndex1.quaternion","mixamorigLeftHandIndex2.quaternion","mixamorigLeftHandIndex3.quaternion","mixamorigLeftHandMiddle1.quaternion","mixamorigLeftHandMiddle2.quaternion","mixamorigLeftHandMiddle3.quaternion","mixamorigLeftHandRing1.quaternion","mixamorigLeftHandRing2.quaternion","mixamorigLeftHandRing3.quaternion","mixamorigLeftHandPinky1.quaternion","mixamorigLeftHandPinky2.quaternion","mixamorigLeftHandPinky3.quaternion","mixamorigRightShoulder.quaternion","mixamorigRightArm.quaternion","mixamorigRightForeArm.quaternion","mixamorigRightHand.quaternion","mixamorigRightHandThumb1.quaternion","mixamorigRightHandThumb2.quaternion","mixamorigRightHandThumb3.quaternion","mixamorigRightHandIndex1.quaternion","mixamorigRightHandIndex2.quaternion","mixamorigRightHandIndex3.quaternion","mixamorigRightHandMiddle1.quaternion","mixamorigRightHandMiddle2.quaternion","mixamorigRightHandMiddle3.quaternion","mixamorigRightHandRing1.quaternion","mixamorigRightHandRing2.quaternion","mixamorigRightHandRing3.quaternion","mixamorigRightHandPinky1.quaternion","mixamorigRightHandPinky2.quaternion","mixamorigRightHandPinky3.quaternion","mixamorigLeftUpLeg.quaternion","mixamorigLeftLeg.quaternion","mixamorigLeftFoot.quaternion","mixamorigLeftToeBase.quaternion","mixamorigRightUpLeg.quaternion","mixamorigRightLeg.quaternion","mixamorigRightFoot.quaternion","mixamorigRightToeBase.quaternion"];
        let bones_length = quaternions_data[0].length;
    
        let tracks = [];
        let quat_values = [];
        let times = [];
        let time_accum = 0.0;
    
        let quaternion_idx = 0;
        let amount = 4;
        let isPosition = false;
    
        while (quaternion_idx < bones_length) {
            quat_values = [];
            times = [];
            time_accum = 0.0;
            isPosition = names[Math.ceil(quaternion_idx/amount)].includes("position");
    
            // loop for all frames
            for (let frame_idx = 0; frame_idx < quaternions_data.length; ++frame_idx) {
                quat_values.push(quaternions_data[frame_idx][quaternion_idx + 0]);
                quat_values.push(quaternions_data[frame_idx][quaternion_idx + 1]);
                quat_values.push(quaternions_data[frame_idx][quaternion_idx + 2]);
                if (!isPosition)
                    quat_values.push(quaternions_data[frame_idx][quaternion_idx + 3]);
    
                time_accum += 0.032; //landmarks[i].dt / 1000.0;
                times.push(time_accum);
            }
    
            let data = null;
            if (isPosition) {
                data = new THREE.VectorKeyframeTrack(names[Math.ceil(quaternion_idx / amount)], times, quat_values);
                amount = 3;
                quaternion_idx += amount;
            }
            else {
                data = new THREE.QuaternionKeyframeTrack( names[Math.ceil(quaternion_idx / amount)], times, quat_values);
                amount = 4;
                quaternion_idx += amount;
            }
            tracks.push(data);
        }
    
        // use -1 to automatically calculate the length from the array of tracks
        return new THREE.AnimationClip(name || "sign_anim", -1, tracks);
    }
}

let app = new App();
app.init();


export { app };