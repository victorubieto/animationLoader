import * as THREE from 'https://cdn.skypack.dev/three@0.136';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/controls/OrbitControls.js';
import { BVHLoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/BVHLoader.js';
import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/GLTFLoader.js';
import { GUI } from 'https://cdn.skypack.dev/lil-gui';
import { AnimationRetargeting } from './retargeting.js'

class App {

    constructor() {
        
        this.clock = new THREE.Clock();
        this.loaderBVH = new BVHLoader();
        this.loaderGLB = new GLTFLoader();
        this.retargeting = new AnimationRetargeting();

        // main render attributes
        this.scene = null;
        this.renderer = null;
        this.camera = null;
        this.controls = null;

        // ground truth skeleton attributes
        this.mixer = null;
        this.skeletonHelper = null;
        this.mixerEva = null;
        this.modelGT = null;

        // prediction skeleton attributes
        this.mixerPred = null;
        this.skeletonHelperPred = null;
        this.mixerEvaPred = null;
        this.modelPred = null;

        // landmarks help attributes
        this.lms = null;
        this.points = null;
        this.prev_iter = null;
        this.inv_view_matrix = null;
        this.inv_projection_matrix = null;
        
        // app modifiers and helpers
        this.distanceBetween = 1; // distance in m between skeletons
        this.scaleFactor = 0.01; // conversion from centimeters to meters (blender glb is in cm, but our application works in m)
    }

    init() {

        // Init scene, renderer and add to body element
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color( 0xeeeeee );
        this.scene.add( new THREE.GridHelper(10, 10) );
        
        this.renderer = new THREE.WebGLRenderer( { antialias: true } );
        this.renderer.setPixelRatio( window.devicePixelRatio );
        this.renderer.setSize( window.innerWidth, window.innerHeight );
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.gammaInput = true; // applies degamma to textures ( not applied to material.color and roughness, metalnes, etc. Only to colour textures )
        this.renderer.gammaOutput = true; // applies gamma after all lighting operations ( which are done in linear space )
        
        const canvas = this.renderer.domElement;
        document.body.appendChild( canvas );

        // Set up camera
        this.camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.01, 100 );
        this.camera.position.set( 0, 2, 3 );
        
        this.controls = new OrbitControls( this.camera, canvas );
        this.controls.minDistance = 0.1;
        this.controls.maxDistance = 10;
        this.controls.target = new THREE.Vector3( 0, 0.5, 0 );
        this.controls.update();
        
        // Set up lights
        let hemiLight = new THREE.HemisphereLight( 0xffffff, 0x555555, 0.2 );
        hemiLight.position.set( 0, 20, 0 );
        this.scene.add( hemiLight );

        let dirLight = new THREE.DirectionalLight( 0xffffff, 0.7 );
        dirLight.position.set( 0, 3, 4 );
        dirLight.castShadow = false;
        this.scene.add(dirLight);

        // Add skeletons in the scene (m)
        this.loaderBVH.load( 'data/skeletons/kateBVH.bvh', (result) => {
            let skinnedMesh = result.skeleton;
            this.skeletonHelper = new THREE.SkeletonHelper( skinnedMesh.bones[0] );
            this.skeletonHelper.skeleton = skinnedMesh; // allow animation mixer to bind to THREE.SkeletonHelper directly

            // Correct mixamo skeleton rotation
            let obj = new THREE.Object3D();
            obj.add( this.skeletonHelper )
            obj.position.x = -this.distanceBetween/2;
            obj.visible = true;
            obj.scale.set(this.scaleFactor, this.scaleFactor, this.scaleFactor);

            let boneContainer = new THREE.Group();
            boneContainer.add( skinnedMesh.bones[0] );
            
            this.scene.add( obj );
            this.scene.add( boneContainer );
            
            this.mixer = new THREE.AnimationMixer( this.skeletonHelper );
        } );
        
        // Repeat for the prediction skeleton
        this.loaderBVH.load( 'data/skeletons/kateBVH.bvh', (result) => {

            let skinnedMesh = result.skeleton;
            this.skeletonHelperPred = new THREE.SkeletonHelper( skinnedMesh.bones[0] );
            this.skeletonHelperPred.skeleton = skinnedMesh; // allow animation mixer to bind to THREE.SkeletonHelper directly
            
            let obj = new THREE.Object3D();
            obj.add( this.skeletonHelperPred )
            obj.position.x = this.distanceBetween/2;
            obj.visible = true;
            obj.scale.set(this.scaleFactor, this.scaleFactor, this.scaleFactor);
            
            let boneContainer = new THREE.Group();
            boneContainer.add( skinnedMesh.bones[0] );
            
            this.scene.add( obj );
            this.scene.add( boneContainer );
                        
            this.mixerPred = new THREE.AnimationMixer( this.skeletonHelperPred );
        } );
        
        // Load Eva GLB avatars (for the GT and the Prediction)
        this.loaderGLB.load( 'data/skeletons/Eva_Y.glb', (glb) => {
            let model = this.modelGT = glb.scene;
            model.visible = true;
            model.position.set(-this.distanceBetween-this.distanceBetween/2,0,0);
            model.rotateOnAxis(new THREE.Vector3(1,0,0), -Math.PI/2);
            this.mixerEva = new THREE.AnimationMixer(model);
            this.scene.add( model );
        });
        this.loaderGLB.load( 'data/skeletons/Eva_Y.glb', (glb) => {
            let model = this.modelPred = glb.scene;
            model.visible = true;
            model.position.set(this.distanceBetween+this.distanceBetween/2,0,0);
            model.rotateOnAxis(new THREE.Vector3(1,0,0), -Math.PI/2);
            this.mixerPredEva = new THREE.AnimationMixer(model);
            this.scene.add( model );
        });


        // Add auxiliary points to visualize the landmarks
        this.points = new THREE.Points( new THREE.BufferGeometry(), new THREE.PointsMaterial( { color: "#ff0000", size: 0.025 } ) );
        this.points.frustumCulled = false;
        this.points.name = "Landmarks";
        this.scene.add( this.points );
        
        // Get camera matrices
        // Blender (fov 55) works with horizontal and threejs with vertical fov => 55 / (1280/720) = 30.9375
        let blenderCamera = new THREE.PerspectiveCamera( 30.9375, 1280/720, 0.1, 1000 );
        blenderCamera.position.set( 0.05 - this.distanceBetween/2, 1.8, 3.1 );
        blenderCamera.updateMatrixWorld()
        blenderCamera.lookAt(0.05 - this.distanceBetween/2, 1.28381, 0.172517);
        blenderCamera.updateMatrixWorld()
        this.inv_view_matrix = blenderCamera.matrixWorld; // camera view inverted
        blenderCamera.updateProjectionMatrix();
        this.inv_projection_matrix = blenderCamera.projectionMatrixInverse;
        
        // Set listeners and events
        window.addEventListener( 'resize', this.onWindowResize.bind(this) );
        canvas.ondragover = () => {return false};
        canvas.ondragend = () => {return false};
        canvas.ondrop = (e) => this.onDrop(e);
        
        // Start loop
        this.initGUI();
        this.animate();
    }

    initGUI() {

        let gui = new GUI().title('Evaluate Dataset Options');

        let options = {
            seeMeshGT: true,
            seeMeshPred: true,
            seeSkeletonGT: true,
            seeSkeletonPred: true,
            seeLandmarks: true,
            LMcolor: "#ff0000",

            restGT: () => {
                if (this.mixer)
                    this.mixer.stopAllAction();
                if (this.mixerEva)
                    this.mixerEva.stopAllAction();
            },

            restPred: () => {
                if (this.mixerPred)
                    this.mixerPred.stopAllAction();
                if (this.mixerPredEva)
                    this.mixerPredEva.stopAllAction();
            },
            
            loadGT: () => {
                let input_quats = document.createElement('input');
                input_quats.type = 'file';
                input_quats.onchange = (e) => {
                    let file = e.target.files[0];
                    if (file.name.includes('.json'))
                        this.loadTextFile( file, data => {
                            let quats = JSON.parse(data);
                            // Create the clip from the quaternions
                            let animationClip = this.createAnimationFromRotations('Test', quats);

                            if (this.mixer) this.mixer.stopAllAction(); // does not deallocate memory!!
                            if (this.mixerEva) this.mixerEva.stopAllAction();
                            // Apply the clip to the mixer
                            this.mixer.clipAction(animationClip).setEffectiveWeight(1.0).play();
                            this.retargeting.loadAnimation(this.skeletonHelper.skeleton, animationClip);
                            let retargetedClip = this.retargeting.createAnimation(this.modelGT);
                            this.mixerEva.clipAction(retargetedClip).setEffectiveWeight(1.0).play();                            
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
                        this.loadTextFile( file, data => {
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
                        this.loadTextFile( file, data => {
                            let quats = JSON.parse(data);
                            // Create the clip from the quaternions
                            let animationClip = this.createAnimationFromRotations('Test', quats);

                            if (this.mixerPred) this.mixerPred.stopAllAction(); // does not deallocate memory!!
                            if (this.mixerPredEva) this.mixerPredEva.stopAllAction();
                            // Apply the clip to the mixer
                            this.mixerPred.clipAction(animationClip).setEffectiveWeight(1.0).play();
                            this.retargeting.loadAnimation(this.skeletonHelperPred.skeleton, animationClip);
                            let retargetedClip = this.retargeting.createAnimation(this.modelPred);
                            this.mixerPredEva.clipAction(retargetedClip).setEffectiveWeight(1.0).play();
                        });
                    else
                        alert('The extension of the file does not match with the expected input');
                }
                input_pred.click();
            },
            
            // this function sets the camera as the virtual camera used to generate the dataset
            resetCamera: () => {
                this.camera.fov = 30.9375;
                this.camera.aspect = 1280/720
                this.camera.position.set( 0.05 - this.distanceBetween/2, 1.8, 3.1 );
                this.camera.updateProjectionMatrix();
                this.controls.target = new THREE.Vector3( 0.05 - this.distanceBetween/2, 1.28381, 0.172517 );
                this.controls.update();
            },

            resetAnimation: () => {
                if (this.mixer)
                    this.mixer.setTime(0);
                if (this.mixerPred)
                    this.mixerPred.setTime(0);
                if (this.mixerEva)
                    this.mixerEva.setTime(0);
                if (this.mixerPredEva)
                    this.mixerPredEva.setTime(0);
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
                        
                        // Save the positions in cm (m * 100 = cm)
                        time_pos[0][0].push(posGT.x * 100 * this.scaleFactor); // multiply by the scaleFactor to apply the scale correction in case the input skeleton is in cm and not in m
                        time_pos[0][1].push(posGT.y * 100 * this.scaleFactor);
                        time_pos[0][2].push(posGT.z * 100 * this.scaleFactor);
                        time_pos[1][0].push(posPred.x * 100 * this.scaleFactor);
                        time_pos[1][1].push(posPred.y * 100 * this.scaleFactor);
                        time_pos[1][2].push(posPred.z * 100 * this.scaleFactor);
                        
                        // Save its distance in cm
                        time_dist.push( posGT.distanceTo(posPred) * 100 * this.scaleFactor );
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

        // Structurate folders
        gui.add(options,'resetCamera').name('Reset Camera');
        gui.add(options,'resetAnimation').name('Reset Animations');
        gui.add(options,'evaluate').name('Evaluate Prediction');

        let gtfolder = gui.addFolder('Ground Truth Animation (left)');
        
        gtfolder.add(options,'restGT').name('Set to Rest Pose');
        gtfolder.add(options,'loadGT').name('Load Ground Truth');
        gtfolder.add(options,'loadLMs').name('Load Landmarks');
        
        gtfolder.addColor(options,'LMcolor').name('Landmarks Color').listen().onChange( (value) => {

            function hexToRgb(hex) {
                let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                return result ? {
                    r: parseInt(result[1], 16),
                    g: parseInt(result[2], 16),
                    b: parseInt(result[3], 16)
                } : null;
            }
            
            if (this.scene.getChildByName("Landmarks").material)
                var rgb = hexToRgb(value);
                this.scene.getChildByName("Landmarks").material.color = new THREE.Color(rgb.r/255, rgb.g/255, rgb.b/255);
        } );
        gtfolder.add(options,'seeLandmarks').name('Show Landmarks').listen().onChange( (value) => {
            this.scene.getChildByName("Landmarks").visible = value;
        } );
        gtfolder.add(options,'seeSkeletonGT').name('Show Skeleton').listen().onChange( (value) => {
            this.skeletonHelper.visible = value;
        } );
        gtfolder.add(options,'seeMeshGT').name('Show Avatar').listen().onChange( (value) => {
            if ( this.modelGT ) this.modelGT.visible = value;
        } );
        
        let predfolder = gui.addFolder('Estimated Aniamtion (right)');

        predfolder.add(options,'restPred').name('Set to Rest Pose');
        predfolder.add(options,'loadPred').name('Load Prediction');
        
        predfolder.add(options,'seeSkeletonPred').name('Show Skeleton').listen().onChange( (value) => {
            this.skeletonHelperPred.visible = value;
        } );
        predfolder.add(options,'seeMeshPred').name('Show Avatar').listen().onChange( (value) => {
            if ( this.modelPred ) this.modelPred.visible = value;
        } );
    }

    animate() {

        requestAnimationFrame( this.animate.bind(this) );

        const delta = this.clock.getDelta();

        if ( this.mixer ) {
            this.mixer.update( delta );
            if ( this.mixerEva ) this.mixerEva.update( delta );
            if ( this.mixerPred ) this.mixerPred.update( delta );
            if ( this.mixerPredEva ) this.mixerPredEva.update( delta );

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

                    this.points.geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
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

    loadTextFile(file, onload) {
        var reader = new FileReader();
        reader.onload = (e) => {
            const text = e.currentTarget.result;
            if(onload) onload(text);
        };
        reader.readAsText(file);
    }

    createAnimationFromRotations( name, quaternions_data ) {

        let names = quaternions_data[quaternions_data.length - 1];
        if (typeof(names[0]) != "string")
            names = ["mixamorigHips.quaternion","mixamorigSpine.quaternion","mixamorigSpine1.quaternion","mixamorigSpine2.quaternion","mixamorigNeck.quaternion","mixamorigHead.quaternion",
                "mixamorigLeftShoulder.quaternion","mixamorigLeftArm.quaternion","mixamorigLeftForeArm.quaternion","mixamorigLeftHand.quaternion",
                "mixamorigLeftHandThumb1.quaternion","mixamorigLeftHandThumb2.quaternion","mixamorigLeftHandThumb3.quaternion",
                "mixamorigLeftHandIndex1.quaternion","mixamorigLeftHandIndex2.quaternion","mixamorigLeftHandIndex3.quaternion",
                "mixamorigLeftHandMiddle1.quaternion","mixamorigLeftHandMiddle2.quaternion","mixamorigLeftHandMiddle3.quaternion",
                "mixamorigLeftHandRing1.quaternion","mixamorigLeftHandRing2.quaternion","mixamorigLeftHandRing3.quaternion",
                "mixamorigLeftHandPinky1.quaternion","mixamorigLeftHandPinky2.quaternion","mixamorigLeftHandPinky3.quaternion",
                "mixamorigRightShoulder.quaternion","mixamorigRightArm.quaternion","mixamorigRightForeArm.quaternion","mixamorigRightHand.quaternion",
                "mixamorigRightHandThumb1.quaternion","mixamorigRightHandThumb2.quaternion","mixamorigRightHandThumb3.quaternion",
                "mixamorigRightHandIndex1.quaternion","mixamorigRightHandIndex2.quaternion","mixamorigRightHandIndex3.quaternion",
                "mixamorigRightHandMiddle1.quaternion","mixamorigRightHandMiddle2.quaternion","mixamorigRightHandMiddle3.quaternion",
                "mixamorigRightHandRing1.quaternion","mixamorigRightHandRing2.quaternion","mixamorigRightHandRing3.quaternion",
                "mixamorigRightHandPinky1.quaternion","mixamorigRightHandPinky2.quaternion","mixamorigRightHandPinky3.quaternion",
                "mixamorigLeftUpLeg.quaternion","mixamorigLeftLeg.quaternion","mixamorigLeftFoot.quaternion","mixamorigLeftToeBase.quaternion",
                "mixamorigRightUpLeg.quaternion","mixamorigRightLeg.quaternion","mixamorigRightFoot.quaternion","mixamorigRightToeBase.quaternion"];
        let bones_length = quaternions_data[0].length;
    
        let tracks = [];
        let quatValues = [];
        let times = [];
        let time_accum = 0.0;
    
        let quatIdx = 0;
        let amount = 4;
        let isPosition = false;
    
        while (quatIdx < bones_length) {
            quatValues = [];
            times = [];
            time_accum = 0.0;
            let nameBone = names[Math.ceil(quatIdx/amount)]; 
            isPosition = nameBone.includes("position");
    
            // loop for all frames
            for (let frameIdx = 0; frameIdx < quaternions_data.length; ++frameIdx) {
                quatValues.push(quaternions_data[frameIdx][quatIdx + 0]);
                quatValues.push(quaternions_data[frameIdx][quatIdx + 1]);
                quatValues.push(quaternions_data[frameIdx][quatIdx + 2]);
                if (!isPosition)
                    quatValues.push(quaternions_data[frameIdx][quatIdx + 3]);
    
                time_accum += 0.032; //landmarks[i].dt / 1000.0;
                times.push(time_accum);
            }
    
            let data = null;
            if (isPosition) {
                data = new THREE.VectorKeyframeTrack(nameBone, times, quatValues);
                amount = 3;
                quatIdx += amount;
            }
            else {
                data = new THREE.QuaternionKeyframeTrack(nameBone, times, quatValues);
                amount = 4;
                quatIdx += amount;
            }

            tracks.push(data);
            //if (!nameBone.includes("mixamorigHips.quaternion")) tracks.push(data); // set the hip static
        }
    
        // use -1 to automatically calculate the length from the array of tracks
        return new THREE.AnimationClip(name || "sign_anim", -1, tracks);
    }
}

let app = new App();
app.init();

export { app };