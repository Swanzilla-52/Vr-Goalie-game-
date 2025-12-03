import {
  Mesh,
  MeshStandardMaterial,
  MeshBasicMaterial,
  PlaneGeometry,
  SessionMode,
  World,
  LocomotionEnvironment,
  EnvironmentType,
  AssetManager,
  AssetType,
  SphereGeometry,
  PhysicsBody,
  PhysicsShapeType,
  PhysicsState,
  PhysicsShape,
  DistanceGrabbable,
  CanvasTexture,
  DoubleSide,
  AudioSource,
  AudioUtils,
  PhysicsManipulation,
  PhysicsSystem,
} from '@iwsdk/core';

import {
  Interactable,
  PanelUI,
  ScreenSpace
} from '@iwsdk/core';

import { PanelSystem } from './panel.js'; // system for displaying "Enter VR" panel on Quest 1

const assets = {
  turf: {
    url: '/gltf/fieldTurf/soccer_field.glb',
    type: AssetType.GLTF,
    proirity: 'critical',
  },
  laxGoal: {
    url: '/gltf/goal/lax_goal.glb',
    type: AssetType.GLTF,
    proirity: 'critical',
  },
};

World.create(document.getElementById('scene-container'), {
  assets,
  xr: {
    sessionMode: SessionMode.ImmersiveVR,
    offer: 'always',
    features: { }
  },

  features: { 
    locomotion: true,
    grabbing: true, 
  },

}).then((world) => {

  const { camera, scene } = world;

  world
  .registerSystem(PhysicsSystem)
  .registerComponent(PhysicsBody)
  .registerComponent(PhysicsShape);

  const goalSound = new Audio('/audio/goal.mp3');
  goalSound.preload = 'auto';

  // fieldTurf
  const fieldModel = AssetManager.getGLTF('turf').scene;
  scene.add(fieldModel);

  const fieldEntity = world.createTransformEntity(fieldModel);
  fieldEntity.addComponent(LocomotionEnvironment, { type: EnvironmentType.STATIC });

  fieldEntity.addComponent(PhysicsShape, {
  shape: PhysicsShapeType.Box,
  dimensions: [20, 0.5, 40],
  });

  fieldEntity.addComponent(PhysicsBody, {
  state: PhysicsState.Static,
  });

  // laxGoal
  const goalModel = AssetManager.getGLTF('laxGoal').scene;
  goalModel.position.set(0, 0.05, 0.15);
  goalModel.rotation.y = Math.PI;
  scene.add(goalModel);

  const goalEntity = world.createTransformEntity(goalModel);

  // Goal Plane (trigger)
  const goalPlane = new Mesh( 
    new PlaneGeometry(1.8, 1.8),
    new MeshStandardMaterial({ color: 0xff0000, transparent: true, opacity: 0.2 })
  );
  goalPlane.position.set(0, 1, 0.15);   // roughly center of the net
  goalPlane.rotation.y = Math.PI;
  scene.add(goalPlane);

  const goalPlaneEntity = world.createTransformEntity(goalPlane);
  goalPlaneEntity.addComponent(PhysicsShape, {
    shape: PhysicsShapeType.Box,
    dimensions: [1.8, 1.8, 0.1],   
    isTrigger: true,
  });

  goalPlaneEntity.addComponent(PhysicsBody, { 
    state: PhysicsState.Static,
  });

  // Ball
  const ballMesh = new Mesh( 
    new SphereGeometry(0.25, 32, 32),
    new MeshStandardMaterial({ color: 0x32cd32 })
  );
  ballMesh.position.set(0, 1.5, -10);
  scene.add(ballMesh);
  
  const ballEntity = world.createTransformEntity(ballMesh);
  ballEntity.addComponent(PhysicsShape, { 
    shape: PhysicsShapeType.Sphere,
    dimensions: [0.25, 0, 0],
    restitution: 0.7,
  });

  ballEntity.addComponent(PhysicsBody, { 
    state: PhysicsState.Dynamic,
  });
 
  ballEntity.addComponent(Interactable).addComponent(DistanceGrabbable);
  ballEntity.addComponent(LocomotionEnvironment, { type: EnvironmentType.LOCAL_FLOOR });

  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 120px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'red';
  ctx.fillText('Score: 0', canvas.width / 2, canvas.height / 2 + 16);
  
  const texture = new CanvasTexture(canvas);
  const aspect = canvas.width / canvas.height;
  const boardWidth = 2;                 // world units
  const boardHeight = boardWidth / aspect;
  
  const boardMat = new MeshBasicMaterial({ 
    map: texture, 
    transparent: true,  
    side: DoubleSide,});

  const boardGeo = new PlaneGeometry(12, 1.5);
  const boardMesh = new Mesh(boardGeo, boardMat);
  const boardEntity = world.createTransformEntity(boardMesh);

  boardEntity.object3D.position.set(0, 5, -20);  // in front of the user
  boardEntity.object3D.visible = true; // start hidden
  boardEntity.object3D.rotation.set(0, Math.PI / 4, 0);
  boardEntity.object3D.lookAt(camera.position);

  let score = 0;

  function updateScoreboard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = 'bold 120px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'red';
  ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 + 16);
  texture.needsUpdate = true;
  }

  updateScoreboard(); // draw initial "Score: 0"

  goalPlaneEntity.addEventListener('triggerenter', (event) => {

    const other = event.other ?? event.detail?.other;
    if (!other || other !== ballEntity) return;   // only react to the ball

    score++;
    console.log('GOAL! Score =', score);

    try {
      goalSound.currentTime = 0;
      goalSound.play();
    } catch (e) {
      console.warn('Could not play goal sound:', e);
    }

    updateScoreboard();

    ballMesh.position.set(0, 1.5, -10);

    ballEntity.addComponent(PhysicsManipulation, {
      linearVelocity: [0, 0, 0],
      angularVelocity: [0, 0, 0],
    });
  });

  // vvvvvvvv EVERYTHING BELOW WAS ADDED TO DISPLAY A BUTTON TO ENTER VR FOR QUEST 1 DEVICES vvvvvv
  //          (for some reason IWSDK doesn't show Enter VR button on Quest 1)
  world.registerSystem(PanelSystem);
  
  if (isMetaQuest1()) {
    const panelEntity = world
      .createTransformEntity()
      .addComponent(PanelUI, {
        config: '/ui/welcome.json',
        maxHeight: 0.8,
        maxWidth: 1.6
      })
      .addComponent(Interactable)
      .addComponent(ScreenSpace, {
        top: '20px',
        left: '20px',
        height: '40%'
      });
    panelEntity.object3D.position.set(0, 1.29, -1.9);
  } else {
    // Skip panel on non-Meta-Quest-1 devices
    // Useful for debugging on desktop or newer headsets.
    console.log('Panel UI skipped: not running on Meta Quest 1 (heuristic).');
  }
  function isMetaQuest1() {
    try {
      const ua = (navigator && (navigator.userAgent || '')) || '';
      const hasOculus = /Oculus|Quest|Meta Quest/i.test(ua);
      const isQuest2or3 = /Quest\s?2|Quest\s?3|Quest2|Quest3|MetaQuest2|Meta Quest 2/i.test(ua);
      return hasOculus && !isQuest2or3;
    } catch (e) {
      return false;
    }
  }

});
