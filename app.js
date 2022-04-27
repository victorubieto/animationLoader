import * as THREE from 'https://cdn.skypack.dev/three@0.136';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/controls/OrbitControls.js';
import { BVHLoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/BVHLoader.js';
import { BVHExporter } from "./BVHExporter.js";
import * as datGui from 'https://cdn.skypack.dev/dat.gui';


class App {

    constructor() {
        
        this.clock = new THREE.Clock();

        this.camera = null;
        this.controls = null;
        this.scene = null;
        this.renderer = null;

        this.loader = new BVHLoader();
        this.mixer = null;
        this.skeletonHelper = null;
        this.boneContainer = null;

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
        document.body.appendChild( this.renderer.domElement );
        
        this.controls = new OrbitControls( this.camera, this.renderer.domElement );
        this.controls.minDistance = 50;
        this.controls.maxDistance = 750;
        this.controls.target = new THREE.Vector3(0, 50, 0);
        this.controls.update();
        
        // We get the skeleton from an aux animation
        this.loadBVH( 'data/bvh/Taunt.bvh', true );

        // $.getJSON( "data/skeleton.json" , ( skeleton ) => {
        //     let skeletonHelper = new THREE.SkeletonHelper( skeleton.bones[ 0 ] );
        //     skeletonHelper.skeleton = skeleton; // allow animation mixer to bind to THREE.SkeletonHelper directly
            
        //     this.scene.add( skeletonHelper );
        // } );
        
        window.addEventListener( 'resize', this.onWindowResize );
        
        this.initGUI();
        this.animate();
    }

    initGUI() {

        var that = this;

        this.options = {
            bgColor: "#eeeeee",
            fov: 60,
            
            insertBVH: function() {
                let input = document.createElement('input');
                input.type = 'file';
                input.onchange = (e) => {
                    let file = e.target.files[0];
                    that.loadBVH('data/bvh/' + file.name);
                }
                input.click();
            },

            insertQuats: function() {
                let input = document.createElement('input');
                input.type = 'file';
                input.onchange = (e) => {
                    let file = e.target.files[0];
                    
                    $.getJSON( 'data/' + file.name, function( data ) {
                        // Create the clip from the input data
                        let animationClip = that.createAnimationFromRotations('Test', data);
                        // Create the mixer using ??
                        that.mixer = new THREE.AnimationMixer(that.skeletonHelper);
                        // Apply the clip to the mixer
                        that.mixer.clipAction(animationClip).setEffectiveWeight(1.0).play();
                    } );
                }
                input.click();
            },

            reset: function() {
                if (that.mixer)
                    that.mixer.stopAllAction();
            }
        };
        
        let gui = new datGui.GUI();
        
        // Other examples that might be usefull
        // gui.addColor(this.options, 'bgColor').name('Background').onChange( () => {
        //     let value = gui.__controllers[0].getValue('bgColor');
        //     this.scene.background = new THREE.Color( value );
        // } );

        // gui.add(this.options, 'fov', 30, 90).name('FOV').onChange( () => {
        //     let value = gui.__controllers[1].getValue('fov');
        //     this.camera.fov = value;
        //     this.camera.updateProjectionMatrix();
        // } );
        
        gui.add(this.options,'insertBVH').name('Load BVH');

        gui.add(this.options,'insertQuats').name('Load Quaternions');

        gui.add(this.options,'reset').name('Reset Pose');
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

    loadBVH( filename, getSkeleton = false ) {

        this.loader.load( filename , ( result ) => {
            if (getSkeleton) {
                this.skeletonHelper = new THREE.SkeletonHelper( result.skeleton.bones[ 0 ] );
                this.skeletonHelper.skeleton = result.skeleton; // allow animation mixer to bind to THREE.SkeletonHelper directly
                this.skeletonHelper.root.position.set(0,85,0); // offset so it sits in the middle of the grid
        
                //TODO json of object of objects
                //...
                //let data = JSON.stringify( result.skeleton );
                //BVHExporter.download(data, 'defaultSkeleton.json', 'application/json');
                // let newDataArray = result.skeleton.reduce(function(arr, obj) {
                //     let newObj = {};
                //     for (let key in obj) {
                //         newObj[key] = obj[key][0]
                //     }
                    
                //     arr.push(newObj);
                //         return arr;
                // }, [] );
                // let newData = JSON.stringify(newDataArray);

                this.boneContainer = new THREE.Group();
                this.boneContainer.add( result.skeleton.bones[ 0 ] );
            
                this.scene.add( this.skeletonHelper );
                this.scene.add( this.boneContainer );
            } 
            else { // play animation
                this.mixer = new THREE.AnimationMixer( this.skeletonHelper );
                this.mixer.clipAction( result.clip ).setEffectiveWeight( 1.0 ).play();
            }
        } );
    }

    createAnimationFromRotations( name, quaternions_data ) {

        var names = ["mixamorigHips.quaternion","mixamorigSpine.quaternion","mixamorigSpine1.quaternion","mixamorigSpine2.quaternion","mixamorigNeck.quaternion","mixamorigHead.quaternion","mixamorigLeftShoulder.quaternion","mixamorigLeftArm.quaternion","mixamorigLeftForeArm.quaternion","mixamorigLeftHand.quaternion","mixamorigLeftHandThumb1.quaternion","mixamorigLeftHandThumb2.quaternion","mixamorigLeftHandThumb3.quaternion","mixamorigLeftHandIndex1.quaternion","mixamorigLeftHandIndex2.quaternion","mixamorigLeftHandIndex3.quaternion","mixamorigLeftHandMiddle1.quaternion","mixamorigLeftHandMiddle2.quaternion","mixamorigLeftHandMiddle3.quaternion","mixamorigLeftHandRing1.quaternion","mixamorigLeftHandRing2.quaternion","mixamorigLeftHandRing3.quaternion","mixamorigLeftHandPinky1.quaternion","mixamorigLeftHandPinky2.quaternion","mixamorigLeftHandPinky3.quaternion","mixamorigRightShoulder.quaternion","mixamorigRightArm.quaternion","mixamorigRightForeArm.quaternion","mixamorigRightHand.quaternion","mixamorigRightHandThumb1.quaternion","mixamorigRightHandThumb2.quaternion","mixamorigRightHandThumb3.quaternion","mixamorigRightHandIndex1.quaternion","mixamorigRightHandIndex2.quaternion","mixamorigRightHandIndex3.quaternion","mixamorigRightHandMiddle1.quaternion","mixamorigRightHandMiddle2.quaternion","mixamorigRightHandMiddle3.quaternion","mixamorigRightHandRing1.quaternion","mixamorigRightHandRing2.quaternion","mixamorigRightHandRing3.quaternion","mixamorigRightHandPinky1.quaternion","mixamorigRightHandPinky2.quaternion","mixamorigRightHandPinky3.quaternion","mixamorigLeftUpLeg.quaternion","mixamorigLeftLeg.quaternion","mixamorigLeftFoot.quaternion","mixamorigLeftToeBase.quaternion","mixamorigRightUpLeg.quaternion","mixamorigRightLeg.quaternion","mixamorigRightFoot.quaternion","mixamorigRightToeBase.quaternion"];
        var bones_length = names.length;
    
        var tracks = [];
        var quat_values = [];
        var times = [];
        var time_accum = 0.0;
    
        var quaternion_idx = 0;
        var amount = 4;
        var isPosition = false;
        while(quaternion_idx < bones_length){
            quat_values = [];
            times = [];
            time_accum = 0.0;
            isPosition = names[Math.ceil(quaternion_idx/amount)].includes("position");
    
            for (var frame_idx = 0; frame_idx < quaternions_data.length - 1; ++frame_idx) {
    
                quat_values.push(quaternions_data[frame_idx][quaternion_idx + 0]);
                quat_values.push(quaternions_data[frame_idx][quaternion_idx + 1]);
                quat_values.push(quaternions_data[frame_idx][quaternion_idx + 2]);
                if(!isPosition)
                    quat_values.push(quaternions_data[frame_idx][quaternion_idx + 3]);
    
                time_accum += 0.032;//landmarks[i].dt / 1000.0;
                times.push(time_accum);
            }
            var data = null;
            if(isPosition)
            {
                data = new THREE.VectorKeyframeTrack(names[Math.ceil(quaternion_idx / amount)], times, quat_values);
                amount = 3;
                quaternion_idx+=amount;
            }
            else{   
                data = new THREE.QuaternionKeyframeTrack( names[Math.ceil(quaternion_idx / amount)], times, quat_values);
                
                amount = 4;
                quaternion_idx+=amount;
            }
            tracks.push(data);
        }
    
        // use -1 to automatically calculate
        // the length from the array of tracks
        const length = -1;
    
        return new THREE.AnimationClip(name || "sign_anim", length, tracks);
    }
}

let app = new App();
app.init();

export { app };