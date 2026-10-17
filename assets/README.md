# Custom Spectate character

**VRM avatars:** save the file here as **`character.vrm`** (VRM 0.x or 1.0, for example from VRoid Studio or VRoid Hub) and reload the app. VRM avatars have no walking animations of their own, so the app drives them with the built-in motion-captured idle, walk and run. A `character.vrm` file is used before a `character.glb`.


Drop a rigged, animated human model here as **`character.glb`** and Spectate will use it instead of the built-in mannequin. You don't need to change any code.

Requirements:

- glTF binary (`.glb`), one character, Y-up, facing +Z (the glTF default).
- Animation clips whose names contain **idle**, **walk** and **run**. A clip containing **wave**, **agree** or **yes** is optional and is used for the guide's gestures.
- Any size works. The model is scaled to 1.75 m tall automatically.

One free way to get one:

1. On https://www.mixamo.com, pick a character and download it with an "Idle", a "Walking" and a "Running" animation. Choose "In Place" for walk and run.
2. Combine them into a single GLB with Blender (import the FBX files, then File → Export → glTF Binary) and keep the clip names.
3. Save the result here as `assets/character.glb` and reload the app.
