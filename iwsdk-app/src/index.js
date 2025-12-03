import {
  Mesh,
  MeshStandardMaterial,
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
    physics: true, 
  },

}).then((world) => {

  const { camera } = world;

  world.registerSystem(PhysicsState).registerComponent(PhysicsBody).registerComponent(PhysicsShape);
  
  //fieldTurf
  const fieldModel = AssetManager.getGLTF('turf').scene;

  const fieldEntity = world.createTransformEntity(fieldModel);
  fieldEntity.addComponent(LocomotionEnvironment, { type: EnvironmentType.STATIC });

  //laxGoal
  const goalModel = AssetManager.getGLTF('laxGoal').scene;
  goalModel.position.set(0, .05, .0)
  goalModel.rotation.y = Math.PI

  const goalEntity = world.createTransformEntity(goalModel);

  const goalPlane = new Mesh( 
    new PlaneGeometry(1.8, 2),
    new MeshStandardMaterial({ color: 0xff0000, transparent: true, opacity: 0.2 })
  );
  goalPlane.position.set(0, 1, 0.15);   // center in front of goal opening
  goalPlane.rotation.y = Math.PI;

  const goalPlaneEntity = world.createTransformEntity(goalPlane);

  goalPlaneEntity.addComponent(PhysicsShape, {
    shape: PhysicsShapeType.Box,
    dimensions: [1.8, 2, 0.1],
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
  ballMesh.position.set(2, 1, 0);
  
  const ballEntity = world.createTransformEntity(ballMesh);

  ballEntity.addComponent(PhysicsShape, { 
    shape: PhysicsShapeType.Sphere,
    dimensions: [0.25, 0, 0],
  });

  ballEntity.addComponent(PhysicsBody, { 
    state: PhysicsState.Dynamic,
  });
 
  let score = 0;

  goalPlaneEntity.addEventListener("triggerenter", (evt) => {
    const other = evt.other;

    if (other === ballEntity) {
      score++;
      console.log("GOAL! Score =", score);

      ballMesh.position.set(2, 1, 0);
    }
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
