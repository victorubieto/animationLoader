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
        this.camera.position.set( 0, 2, 3 );

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color( 0xeeeeee );

        this.scene.add( new THREE.GridHelper( 10, 10 ) );

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
        this.controls.minDistance = 0.1;
        this.controls.maxDistance = 10;
        this.controls.target = new THREE.Vector3( 0, 0.5, 0 );
        this.controls.update();
        
        this.loader.load( 'data/skeletons/create_db_m.bvh', (result) => {

            let skinnedMesh = result.skeleton;
            this.skeletonHelper = new THREE.SkeletonHelper( skinnedMesh.bones[0] );
            this.skeletonHelper.skeleton = skinnedMesh; // allow animation mixer to bind to THREE.SkeletonHelper directly
            
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

        // Repeat for the prediction skeleton
        this.loader.load( 'data/skeletons/create_db_m.bvh', (result) => {

            this.skeletonHelperPred = new THREE.SkeletonHelper( result.skeleton.bones[0] );
            this.skeletonHelperPred.skeleton = result.skeleton; // allow animation mixer to bind to THREE.SkeletonHelper directly
            
            let obj = new THREE.Object3D();
            obj.add( this.skeletonHelperPred )
            obj.rotateOnAxis( new THREE.Vector3(1,0,0), Math.PI/2 );
            obj.position.x = 2;
            obj.visible = false;
            
            let boneContainer = new THREE.Group();
            boneContainer.add( result.skeleton.bones[0] );

            this.scene.add( obj );
            this.scene.add( boneContainer );

            // Change the color of the prediction skeleton
            // this.scene.children[2].children[0].material.color.r = 1;
            // this.scene.children[2].children[0].material.color.g = 0;
            // this.scene.children[2].children[0].material.color.b = 0;
        
            this.mixerPred = new THREE.AnimationMixer( this.skeletonHelperPred );
        } );
        
        // Used to see the landmarks
        this.points_geometry = new THREE.BufferGeometry();
        let material = new THREE.PointsMaterial( { color: "#ff0000", size: 0.03 } );
        let points = new THREE.Points( this.points_geometry, material );
        points.frustumCulled = false;
        this.scene.add( points );

        // blender (fov 55) works with horizontal and threejs with vertical fov => 55 / (1280/720) = 30.9375
        let blenderCamera = new THREE.PerspectiveCamera( 30.9375, 1280/720, 0.1, 1000 );
        blenderCamera.position.set( 0.05, 1.8, 3.1 );
        blenderCamera.updateMatrixWorld()
        blenderCamera.lookAt(0.05, 1.28381, 0.172517);
        blenderCamera.updateMatrixWorld()
        this.inv_view_matrix = blenderCamera.matrixWorld; // camera view inverted
        blenderCamera.updateProjectionMatrix();
        this.inv_projection_matrix = blenderCamera.projectionMatrixInverse;
        
        window.addEventListener( 'resize', this.onWindowResize.bind(this) );
        
        this.initGUI();
        this.animate();
    }

    initGUI() {

        this.options = {
            
            seeMesh: true,
            seeSkeleton: true,
            seeLandmarks: true,
            LMcolor: "#ff0000",

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

            rest: () => {
                if (this.mixer)
                    this.mixer.stopAllAction();
                if (this.mixerPred)
                    this.mixerPred.stopAllAction();
            },
            
            loadGT: () => {
                let input_quats = document.createElement('input');
                input_quats.type = 'file';
                input_quats.onchange = (e) => {
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
                input_quats.click();
            },

            loadLMs: () => {
                let input_lms = document.createElement('input');
                input_lms.type = 'file';
                input_lms.onchange = (e) => {
                    let file = e.target.files[0];
                    if (file.name.includes('.json'))
                        LoaderUtils.loadTextFile( file, data => {
                            this.lms = JSON.parse(data);
                        });
                    else
                        alert('The extension of the file does not match with the expected input');
                }
                input_lms.click();
            },
                
            loadPred: () => {
                let input_pred = document.createElement('input');
                input_pred.type = 'file';
                input_pred.onchange = (e) => {
                    let file = e.target.files[0];
                    if (file.name.includes('.json'))
                        LoaderUtils.loadTextFile( file, data => {
                            let quats = JSON.parse(data);
                            // Create the clip from the quaternions
                            let animationClip = this.createAnimationFromRotations('Test', quats);
                            // Apply the clip to the mixer
                            this.mixerPred.clipAction(animationClip).setEffectiveWeight(1.0).play();
                            this.scene.children[4].visible = true;
                        });
                    else
                        alert('The extension of the file does not match with the expected input');
                }
                input_pred.click();
            },
            
            resetCamera: () => {
                this.camera.fov = 30.9375;
                this.camera.updateProjectionMatrix();
                this.camera.aspect = 1280/720
                this.camera.position.set( 0.05, 1.8, 3.1 ); // convert from cm to m
                this.controls.target = new THREE.Vector3( 0.05, 1.28381, 0.172517 );
                this.controls.update();
            },

            resetAnimation: () => {
                if (this.mixer)
                    this.mixer.setTime(0);
                if (this.mixerPred)
                    this.mixerPred.setTime(0);
            },

            evaluate: () => {
                if (this.mixer._actions.length == 0 || this.mixerPred._actions.length == 0) {
                    confirm("You need to upload both the Ground Truth and the Prediction animations in order to evaluate the error.");
                    return;
                }

                let dist_list = []; // array of distances per bone for all times
                let pos_list = []; // array of distances per bone for all times
                for (let i = 0; i < this.mixer._root.bones.length; i++) {
                    dist_list[i] = [];
                    pos_list[i] = [[[],[],[]],[[],[],[]]]; // gt, pred -> x, y, z channels
                }

                // Loop the animation for all times
                const times = this.mixer._actions[0]._clip.tracks[0].times
                for (let t in times) {
                    this.mixer.setTime(times[t]);
                    this.mixerPred.setTime(times[t]);

                    let time_dist = []; // array of distances per bone in one time
                    let time_pos = [[[],[],[]],[[],[],[]]]; // array of the positions of bones in one time (gt((x),(y),(z))),(pred((x),(y),(z)))
                    for (let bone in this.mixer._root.bones) {
                        let posGT = new THREE.Vector3();
                        let posPred = new THREE.Vector3();
                        this.mixer._root.bones[bone].getWorldPosition( posGT );
                        this.mixerPred._root.bones[bone].getWorldPosition( posPred );
                        
                        // Save the positions in cm
                        time_pos[0][0].push(posGT.x * 100);
                        time_pos[0][1].push(posGT.y * 100);
                        time_pos[0][2].push(posGT.z * 100);
                        time_pos[1][0].push(posPred.x * 100);
                        time_pos[1][1].push(posPred.y * 100);
                        time_pos[1][2].push(posPred.z * 100);

                        // Save its distance in cm
                        time_dist.push( posGT.distanceTo(posPred) * 100 );
                    }

                    time_pos.every( (gt_pred, type_idx) =>
                        gt_pred.every( (axis_el, axis_idx) =>
                            axis_el.every( (el, idx) => pos_list[idx][type_idx][axis_idx].push(el) )
                        ) 
                    );
                    
                    time_dist.every( (el, idx) => dist_list[idx].push(el) );
                }
            
                // Download data
                function download(content, fileName, contentType) {
                    let a = document.createElement("a");
                    let file = new Blob([content], {type: contentType});
                    a.href = URL.createObjectURL(file);
                    a.download = fileName;
                    a.click();
                };

                let distances_file = JSON.stringify(dist_list);
                download(distances_file, 'EvaluationDistances.json', 'application/json');
                let positions_file = JSON.stringify(pos_list);
                download(positions_file, 'EvaluationPositions.json', 'application/json');
            }
        };
        
        // See documentation to add more options at https://github.com/dataarts/dat.gui/blob/master/API.md
        let gui = new datGui.GUI();
        
        gui.add(this.options,'insertQuats').name('Load Quaternions');
        gui.add(this.options,'rest').name('Rest Pose');

        let folder = gui.addFolder('Evaluate Dataset');
        
        folder.add(this.options,'resetCamera').name('Reset Camera');
        folder.add(this.options,'resetAnimation').name('Reset Animation');

        folder.add(this.options,'loadGT').name('Load Ground Truth');
        folder.add(this.options,'loadLMs').name('Load Landmarks');
        folder.add(this.options,'loadPred').name('Load Prediction');
        
        folder.add(this.options,'evaluate').name('Evaluate Prediction');

        folder.addColor(this.options,'LMcolor').name('Landmarks Color').listen().onChange( () => {

            function hexToRgb(hex) {
                let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                return result ? {
                    r: parseInt(result[1], 16),
                    g: parseInt(result[2], 16),
                    b: parseInt(result[3], 16)
                } : null;
            }
            
            if (this.scene.children[1].material)
                var rgb = hexToRgb(this.options.LMcolor);
                this.scene.children[1].material.color = new THREE.Color(rgb.r/255, rgb.g/255, rgb.b/255);
        } );
        folder.add(this.options,'seeMesh').name('Show Avatar').listen().onChange( () => {
            //this.scene.children[1].visible = this.options.seeMesh;
        } );
        folder.add(this.options,'seeSkeleton').name('Show Skeleton').listen().onChange( () => {
            this.scene.children[2].visible = this.options.seeSkeleton;
        } );
        folder.add(this.options,'seeLandmarks').name('Show Landmarks').listen().onChange( () => {
            this.scene.children[1].visible = this.options.seeLandmarks;
        } );
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

        if ( this.mixer ) {
            this.mixer.update( delta );
            if ( this.mixerPred ) this.mixerPred.update( delta );

            // Inverse projection to locate landmarks in the space
            if ( this.lms && this.mixer._actions[0] ) {
                let curr_time = this.mixer._actions[0].time;
                let dur = this.mixer._actions[0]._clip.duration;
                let iter = curr_time / dur * this.lms.length;
                
                if (iter != this.prev_iter) {
                    let currLM = this.lms[Math.floor(iter)];
                    const vertices = [];
    
                    for (let i = 0; i < currLM.length; i=i+2) {
                        let x = currLM[i];
                        let y = currLM[i+1];
    
                        x = x * 2 - 1;
                        y = -y * 2 + 1;

                        // z scales exponentially, just chosed a nice value
                        let v = new THREE.Vector4(x, y, 0.935, 1);

                        let v_view_space = v.clone(); 
                        v_view_space.applyMatrix4(this.inv_projection_matrix);
                        let v_world_space = v_view_space.clone();
                        v_world_space.applyMatrix4(this.inv_view_matrix);
                        v_world_space.x = v_world_space.x / v_world_space.w;
                        v_world_space.y = v_world_space.y / v_world_space.w;
                        v_world_space.z = v_world_space.z / v_world_space.w;

                        vertices.push( v_world_space.x, v_world_space.y, v_world_space.z );
                    }

                    this.points_geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
                }
            
                this.prev_iter = iter;
            }
        } 

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