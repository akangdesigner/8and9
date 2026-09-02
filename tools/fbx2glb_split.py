# fbx2glb.py 的變體(2026-09-02,小胖/James 那輪新增,見 assets/models/README.md)。
#
# 有些 Mixamo 角色匯出後全身只有一顆合併 mesh(用 assets/models/README.md
# 「怎麼查一副新骨架的部件名字」那節的方法查得到),換色系統(scene-city3d.js
# MODELS[rig].parts)是照物件名字分材質,一顆 mesh 分不開就只能整個人同一個
# 顏色。如果那顆合併 mesh 內部還留著多個 material slot(不是每個都有,查法
# 見同一節),可以用這支腳本先按材質切開重新命名再匯出,分件之後就能正常
# 用 parts 分別上色。只用在 full 模式(idle.glb 這種要顯示外觀的),
# walk.glb 還是用 fbx2glb.py 的 anim-only 模式(骨架+動畫,不用重複分件)。
#
#   blender --background --factory-startup --python fbx2glb_split.py -- <src.fbx> <dst.glb>

import bpy
import sys

argv = sys.argv[sys.argv.index('--') + 1:]
src, dst = argv[0], argv[1]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=src, automatic_bone_orientation=True)

mesh_obj = next(o for o in bpy.data.objects if o.type == 'MESH')

bpy.ops.object.select_all(action='DESELECT')
mesh_obj.select_set(True)
bpy.context.view_layer.objects.active = mesh_obj
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.separate(type='MATERIAL')
bpy.ops.object.mode_set(mode='OBJECT')

for obj in bpy.data.objects:
    if obj.type == 'MESH':
        mat = obj.data.materials[0] if obj.data.materials else None
        if mat:
            obj.name = mat.name
        print('[split] mesh object:', obj.name)

bpy.ops.export_scene.gltf(
    filepath=dst,
    export_format='GLB',
    export_materials='NONE',
    export_image_format='NONE',
    export_animations=True,
    export_skins=True,
)
print(f'[fbx2glb_split] {src} -> {dst}')
