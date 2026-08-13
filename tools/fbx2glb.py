# Mixamo FBX -> glb,headless 用 Blender 跑,見 assets/models/README.md「轉檔:FBX → glb」。
#
#   blender --background --factory-startup --python tools/fbx2glb.py -- <來源.fbx> <輸出.glb> [full|anim-only]
#
# full:      保留 mesh + 骨架 + 動畫(給 *-idle.glb 這種要顯示外觀的用)
# anim-only: 匯出前刪掉所有非 Armature 物件,只留骨架 + 動畫(給 *-walk.glb /
#            *-run.glb 這種只是要疊到既有骨架上的動作用,不用重複背一份根本
#            不會顯示的 mesh)
#
# export_materials/export_image_format 都設 NONE——Mixamo 內建貼圖用不到,
# 直接匯出會把檔案撐到 30+MB(2026-08-12 的教訓,見 README)。

import bpy
import sys

argv = sys.argv[sys.argv.index('--') + 1:]
src, dst, mode = argv[0], argv[1], (argv[2] if len(argv) > 2 else 'full')

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=src, automatic_bone_orientation=True)

if mode == 'anim-only':
    for obj in list(bpy.data.objects):
        if obj.type != 'ARMATURE':
            bpy.data.objects.remove(obj, do_unlink=True)

bpy.ops.export_scene.gltf(
    filepath=dst,
    export_format='GLB',
    export_materials='NONE',
    export_image_format='NONE',
    export_animations=True,
    export_skins=True,
)
print(f'[fbx2glb] {src} -> {dst} ({mode})')
