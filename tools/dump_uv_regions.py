# 幫「單一 mesh、找不到獨立上衣區域」的 Mixamo 角色產生 UV 攤平圖 + 部位色塊圖,
# 讓生圖工具照著精準畫上衣/褲子花紋,不會畫到臉或手(2026-09-02,小胖那輪新增,
# 見 assets/models/README.md「單一 mesh 但沒有獨立上衣」那節)。
#
# 流程:
#   1. blender --background --factory-startup --python tools/dump_uv_regions.py -- <來源.fbx> tris.json
#   2. python3 tools/rasterize_uv_regions.py tris.json <輸出目錄>
#      產生 uv_template.png(純線稿,生圖工具照這張畫)跟
#      uv_regions.png(部位色塊對照,人看這張認區塊:紅=軀幹/橘紅=軀幹、
#      藍=手臂、綠=腿、黃=臉、粉紅=手)
#
# 部位判斷是照骨骼名字關鍵字分類(見 region_for_bone()),不是精準的服裝
# 邊界——袖口/褲管交界會有一點誤差,重點是給人類一個「大概在哪」的參考,
# 不是拿來自動裁切用的。

import bpy, sys, json

argv = sys.argv[sys.argv.index('--')+1:]
src, out_json = argv[0], argv[1]
body_material_name = argv[2] if len(argv) > 2 else None

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=src, automatic_bone_orientation=True)

mesh_obj = next(o for o in bpy.data.objects if o.type == 'MESH')
arm_obj = next(o for o in bpy.data.objects if o.type == 'ARMATURE')

if body_material_name:
    body_mat_idx = next(i for i, s in enumerate(mesh_obj.material_slots) if s.material.name == body_material_name)
else:
    # 沒指定就挑面數最多的材質 slot(通常就是全身那塊)
    counts = {}
    for poly in mesh_obj.data.polygons:
        counts[poly.material_index] = counts.get(poly.material_index, 0) + 1
    body_mat_idx = max(counts, key=counts.get)
print('[dump] body_mat_idx', body_mat_idx, mesh_obj.material_slots[body_mat_idx].material.name)

def region_for_bone(name):
    n = name.lower()
    if 'head' in n or 'neck' in n:
        return 'face'
    if 'hand' in n or 'finger' in n or 'thumb' in n:
        return 'hand'
    if 'foot' in n or 'toe' in n:
        return 'foot'
    if 'shoulder' in n or 'arm' in n:
        return 'arm'
    if 'leg' in n:
        return 'leg'
    return 'torso'

bone_region = {b.name: region_for_bone(b.name) for b in arm_obj.data.bones}
vg_index_to_region = {vg.index: bone_region.get(vg.name, 'torso') for vg in mesh_obj.vertex_groups}

mesh = mesh_obj.data
vert_region = {}
for v in mesh.vertices:
    if not v.groups:
        vert_region[v.index] = 'torso'
        continue
    best = max(v.groups, key=lambda g: g.weight)
    vert_region[v.index] = vg_index_to_region.get(best.group, 'torso')

uv_layer = mesh.uv_layers.active.data

tris = []
for poly in mesh.polygons:
    if poly.material_index != body_mat_idx:
        continue
    idxs = list(poly.loop_indices)
    for k in range(1, len(idxs) - 1):
        tri = []
        for li in (idxs[0], idxs[k], idxs[k+1]):
            vi = mesh.loops[li].vertex_index
            uv = uv_layer[li].uv
            tri.append({'u': uv.x, 'v': uv.y, 'region': vert_region[vi]})
        tris.append(tri)

with open(out_json, 'w') as f:
    json.dump(tris, f)
print('[dump] tris:', len(tris))
