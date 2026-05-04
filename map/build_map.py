#!/usr/bin/env python3
"""
Build map data from FREIGN JSON area files.
Outputs java_map/data/world.json for the map frontend.

Usage:
    python3 build_map.py
Then open index.html via a local HTTP server:
    python3 -m http.server 8080
    open http://localhost:8080
"""

import json
import math
import os
import re
import sys
from collections import deque, defaultdict

AREA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'modern', 'data', 'area')
OUT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'world.json')

# ORIG_DOOR -> (dx, dy)  N=0 E=1 S=2 W=3 U=4 D=5
DIR_DX = [0, 1, 0, -1, 0, 0]
DIR_DY = [-1, 0, 1, 0, 0, 0]

COLOR_RE = re.compile(r'\{[a-zA-Z0-9*!@#$%^&_=+\-~`]|\{\{')


def strip_color(s):
    if not s:
        return s
    return COLOR_RE.sub('', s)


def load_area(path):
    with open(path, encoding='utf-8', errors='replace') as f:
        return json.load(f)


def get_section(area_data, name):
    for s in area_data.get('sections', []):
        if s.get('section') == name:
            return s.get('records', [])
    return []


def assign_coords(rooms_by_vnum, room_vnums_list, room_vnums_set):
    """BFS coordinate assignment for rooms within one area.

    Uses a lightweight 3D layout so U/D exits become vertical layers instead of
    collapsing into disconnected strips. Then projects 3D -> 2D for rendering.

    Returns dict: vnum -> (x, y) with all coords >= 0.
    Cross-area exits are ignored; unconnected components are placed below.
    """
    if not room_vnums_list:
        return {}

    # Layer projection bias: keep U/D stacks tight and mostly vertical in 2D.
    LAYER_X_BIAS = 0
    LAYER_Y_BIAS = 1

    coords3 = {}      # vnum -> (x, y, z)
    occupied3 = {}    # (x, y, z) -> vnum

    def opposite_dir(d):
        if d == 0:
            return 2
        if d == 1:
            return 3
        if d == 2:
            return 0
        if d == 3:
            return 1
        if d == 4:
            return 5
        if d == 5:
            return 4
        return d

    # Build undirected local adjacency with directional hints.
    local_adj = defaultdict(list)  # v -> [(neighbor, d_from_v_to_neighbor)]
    for v in room_vnums_list:
        room = rooms_by_vnum.get(v)
        if not room:
            continue
        for ex in room.get('EXITS', []):
            d = ex.get('ORIG_DOOR', -1)
            tv = ex.get('TO_ROOM->VNUM')
            if d < 0 or d > 5 or tv is None or tv not in room_vnums_set:
                continue
            local_adj[v].append((tv, d))
            local_adj[tv].append((v, opposite_dir(d)))

    def step_from(vx, vy, vz, d):
        nx = vx
        ny = vy
        nz = vz
        if d <= 3:
            nx += DIR_DX[d]
            ny += DIR_DY[d]
        elif d == 4:
            nz += 1
        elif d == 5:
            nz -= 1
        return nx, ny, nz

    def nearest_free_3d(nx, ny, nz):
        if (nx, ny, nz) not in occupied3:
            return nx, ny, nz
        # Search nearby on same z first, then z +/- 1 for dense stacks.
        for radius in range(1, 6):
            for dx in range(-radius, radius + 1):
                for dy in range(-radius, radius + 1):
                    if abs(dx) != radius and abs(dy) != radius:
                        continue
                    for dz in (0, 1, -1):
                        cand = (nx + dx, ny + dy, nz + dz)
                        if cand not in occupied3:
                            return cand
        # Worst case fallback, should be rare.
        k = 1
        while (nx + k, ny + k, nz) in occupied3:
            k += 1
        return nx + k, ny + k, nz

    def place_component(seed, anchor):
        if seed in coords3:
            return
        ax, ay, az = nearest_free_3d(anchor[0], anchor[1], anchor[2])
        coords3[seed] = (ax, ay, az)
        occupied3[(ax, ay, az)] = seed

        q = deque([seed])
        while q:
            cur = q.popleft()
            cx, cy, cz = coords3[cur]
            for nb, d in local_adj.get(cur, []):
                if nb in coords3:
                    continue
                tx, ty, tz = step_from(cx, cy, cz, d)
                tx, ty, tz = nearest_free_3d(tx, ty, tz)
                coords3[nb] = (tx, ty, tz)
                occupied3[(tx, ty, tz)] = nb
                q.append(nb)

    # Place primary connected component from first room.
    place_component(room_vnums_list[0], (0, 0, 0))

    # Place any remaining connected components in a loose grid below.
    comp_col = 0
    comp_row = 0
    COMP_STRIDE_X = 18
    COMP_STRIDE_Y = 16

    for seed in room_vnums_list:
        if seed in coords3:
            continue
        degree = len(local_adj.get(seed, []))
        if degree == 0:
            continue  # isolated rooms handled later
        anchor_x = comp_col * COMP_STRIDE_X
        anchor_y = 12 + comp_row * COMP_STRIDE_Y
        place_component(seed, (anchor_x, anchor_y, 0))
        comp_col += 1
        if comp_col >= 5:
            comp_col = 0
            comp_row += 1

    def project_2d(c3):
        def compress_z(z):
            # Preserve ordering while preventing very tall vertical shafts from
            # dominating whole-area dimensions.
            if z == 0:
                return 0
            sign = 1 if z > 0 else -1
            return sign * int(math.ceil(math.log2(abs(z) + 1)))

        out = {}
        occupied2 = set()

        def nearest_free_2d(x0, y0):
            if (x0, y0) not in occupied2:
                return x0, y0
            for radius in range(1, 6):
                for dx in range(-radius, radius + 1):
                    for dy in range(-radius, radius + 1):
                        if abs(dx) != radius and abs(dy) != radius:
                            continue
                        cand = (x0 + dx, y0 + dy)
                        if cand not in occupied2:
                            return cand
            k = 1
            while (x0 + k, y0) in occupied2:
                k += 1
            return x0 + k, y0

        for v, (x, y, z) in c3.items():
            z2 = compress_z(z)
            px = x + z2 * LAYER_X_BIAS
            py = y - z2 * LAYER_Y_BIAS
            px, py = nearest_free_2d(px, py)
            out[v] = (px, py)
            occupied2.add((px, py))
        return out

    coords = project_2d(coords3)
    occupied = {xy: v for v, xy in coords.items()}

    # Place only truly isolated rooms in a strip below the main layout.
    # (coords3 will have z=0 for isolated rooms placed below)
    isolated = [v for v in room_vnums_list if v not in coords3]
    if isolated:
        if coords:
            max_y = max(y for _, y in coords.values())
            strip_y = max_y + 2
        else:
            strip_y = 0
        x_cursor = 0
        for v in isolated:
            while (x_cursor, strip_y) in occupied:
                x_cursor += 1
            coords[v] = (x_cursor, strip_y)
            coords3[v] = (x_cursor, strip_y, 0)
            occupied[(x_cursor, strip_y)] = v
            x_cursor += 1

    # Normalize so min x=0, min y=0
    if coords:
        min_x = min(x for x, _ in coords.values())
        min_y = min(y for _, y in coords.values())
        if min_x != 0 or min_y != 0:
            coords = {v: (x - min_x, y - min_y) for v, (x, y) in coords.items()}

    return coords, coords3


def dominant_sector(rooms_records):
    counts = defaultdict(int)
    for r in rooms_records:
        counts[r.get('SECTOR_TYPE', 0)] += 1
    return max(counts, key=counts.get) if counts else 0


def parse_bool(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        v = value.strip().lower()
        if v in ('1', 'true', 't', 'yes', 'y', 'on'):
            return True
        if v in ('0', 'false', 'f', 'no', 'n', 'off'):
            return False
    return default


def map_exit_dir_for_area_placement(d):
    """Map room exit direction to 2D area-placement direction.

    Only cardinal directions are used for world-area placement.
    U/D are intentionally ignored here so vertical room layering does not
    distort global area geography.
    """
    if d in (0, 1, 2, 3):
        return d, False
    return None, False


def process_areas():
    areas_out = {}   # short_name -> area dict
    world_list = []  # list of world placement entries

    area_dirs = sorted(os.listdir(AREA_DIR))

    for aname in area_dirs:
        apath = os.path.join(AREA_DIR, aname)
        if not os.path.isdir(apath):
            continue
        jfiles = [f for f in os.listdir(apath) if f.endswith('.json')]
        if not jfiles:
            continue

        try:
            data = load_area(os.path.join(apath, jfiles[0]))
        except Exception as e:
            print(f'  SKIP {aname}: {e}', file=sys.stderr)
            continue

        area_info = get_section(data, 'AREADATA')
        rooms_records = get_section(data, 'ROOMS')

        if not rooms_records:
            continue

        area_meta = area_info[0] if area_info else {}
        # Gate area visibility on web map via AREADATA.showWebMap.
        # Strict opt-in: missing/invalid values default to hidden.
        if not parse_bool(area_meta.get('showWebMap'), default=False):
            print(f'  HIDE {aname}: showWebMap=false', file=sys.stderr)
            continue

        long_name = strip_color(area_meta.get('Name', aname))

        rooms_by_vnum = {r['VNUM']: r for r in rooms_records}
        room_vnums_list = [r['VNUM'] for r in rooms_records]
        room_vnums_set = set(room_vnums_list)

        coords, coords3 = assign_coords(rooms_by_vnum, room_vnums_list, room_vnums_set)
        if not coords:
            continue

        max_x = max(x for x, _ in coords.values())
        max_y = max(y for _, y in coords.values())

        rooms_out = []
        for r in rooms_records:
            vnum = r['VNUM']
            if vnum not in coords:
                continue
            x, y = coords[vnum]
            z = coords3.get(vnum, (0, 0, 0))[2]

            exits_out = []
            for ex in r.get('EXITS', []):
                d = ex.get('ORIG_DOOR', -1)
                tv = ex.get('TO_ROOM->VNUM')
                if d >= 0 and tv is not None:
                    exits_out.append({'v': tv, 'd': d})

            rooms_out.append({
                'v': vnum,
                'n': strip_color(r.get('NAME', '')),
                's': r.get('SECTOR_TYPE', 0),
                'x': x,
                'y': y,
                'z': z,
                'ex': exits_out,
            })

        sec = dominant_sector(rooms_records)

        z_vals = [coords3.get(v, (0, 0, 0))[2] for v in coords]
        min_z = min(z_vals) if z_vals else 0
        max_z = max(z_vals) if z_vals else 0

        areas_out[aname] = {
            'name': long_name,
            'w': max_x + 1,
            'h': max_y + 1,
            'minZ': min_z,
            'maxZ': max_z,
            'rooms': rooms_out,
        }

        world_list.append({
            'n': aname,
            'long': long_name,
            's': sec,
            'r': len(rooms_out),
        })

        print(f'  {aname:20s} {len(rooms_out):4d} rooms  {max_x+1}x{max_y+1}', file=sys.stderr)

    return world_list, areas_out


def place_areas(world_list, areas_out):
    """Assign world-grid positions (wx, wy) to each area.

    Uses inter-area exit directions as spatial constraints: if area A has exits
    going East into area B, B is placed East of A so the map matches
    in-game geography.

    Algorithm:
      1. Tally cross-area exit directions for every area-pair.
      2. BFS from the largest area; place each unplaced neighbor in the
         dominant direction that exits from the current area lead to it.
      3. Slide the new area along that axis until it clears all existing areas.
      4. Fallback-row for any area unreachable via the exit graph.
      5. Normalize so the top-left corner is at (0, 0).
    """
    PADDING = 5  # minimum gap between area bounding boxes (grid cells)

    # ---- 1. Build vnum -> area name lookup ----
    vnum_to_area = {}
    for aname, ad in areas_out.items():
        for r in ad['rooms']:
            vnum_to_area[r['v']] = aname

    CARDINAL_WEIGHT = 1.0
    VERTICAL_WEIGHT = 0.35

    # inter_votes[a][b][dir] = weighted exit vote
    inter_votes = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
    # inter_cardinal[a][b] = count of cardinal (N/E/S/W) links between areas
    inter_cardinal = defaultdict(lambda: defaultdict(int))
    for aname, ad in areas_out.items():
        for r in ad['rooms']:
            for ex in r.get('ex', []):
                d, vertical_hint = map_exit_dir_for_area_placement(ex['d'])
                if d is None:
                    continue
                dest_area = vnum_to_area.get(ex['v'])
                if dest_area and dest_area != aname:
                    weight = VERTICAL_WEIGHT if vertical_hint else CARDINAL_WEIGHT
                    inter_votes[aname][dest_area][d] += weight
                    if not vertical_hint:
                        inter_cardinal[aname][dest_area] += 1

    def dominant_dir(a, b):
        votes = inter_votes.get(a, {}).get(b, {})
        # If we have any true cardinal links for this pair, prefer only those
        # so U/D hints don't override horizontal world geography.
        if inter_cardinal.get(a, {}).get(b, 0) > 0:
            votes = {k: v for k, v in votes.items() if k in (0, 1, 2, 3)}
        return max(votes, key=votes.get) if votes else None

    def opposite_dir(d):
        if d == 0:
            return 2
        if d == 1:
            return 3
        if d == 2:
            return 0
        if d == 3:
            return 1
        return d

    def pair_dir(a, b):
        d = dominant_dir(a, b)
        if d is not None:
            return d
        rd = dominant_dir(b, a)
        if rd is not None:
            return opposite_dir(rd)
        return None

    def pair_strength(a, b):
        s1 = sum(inter_votes.get(a, {}).get(b, {}).values())
        s2 = sum(inter_votes.get(b, {}).get(a, {}).values())
        return s1 + s2

    # ---- 2. BFS placement ----
    placed = {}   # area_name -> (wx, wy)

    def bbox(name, wx, wy):
        ad = areas_out[name]
        return (wx, wy, wx + ad['w'] + PADDING, wy + ad['h'] + PADDING)

    def overlaps_any(name, wx, wy):
        b = bbox(name, wx, wy)
        for pn, (px, py) in placed.items():
            pb = bbox(pn, px, py)
            if b[0] < pb[2] and b[2] > pb[0] and b[1] < pb[3] and b[3] > pb[1]:
                return True
        return False

    def min_slide(name, wx, wy, d):
        """Minimum distance to slide in direction d to clear all overlaps."""
        b = bbox(name, wx, wy)
        worst = 0
        dx = DIR_DX[d]
        dy = DIR_DY[d]
        for pn, (px, py) in placed.items():
            pb = bbox(pn, px, py)
            if b[0] < pb[2] and b[2] > pb[0] and b[1] < pb[3] and b[3] > pb[1]:
                if dx > 0:
                    worst = max(worst, pb[2] - b[0])
                elif dx < 0:
                    worst = max(worst, b[2] - pb[0])
                elif dy > 0:
                    worst = max(worst, pb[3] - b[1])
                elif dy < 0:
                    worst = max(worst, b[3] - pb[1])
        return worst

    def place_clear(name, wx, wy, d):
        """Slide (wx, wy) in direction d until no overlap; return final pos."""
        dx = DIR_DX[d]
        dy = DIR_DY[d]
        for _ in range(60):
            if not overlaps_any(name, wx, wy):
                return wx, wy
            s = min_slide(name, wx, wy, d)
            if s <= 0:
                break
            wx += dx * (s + 1)
            wy += dy * (s + 1)
        return wx, wy

    def total_votes(name):
        return sum(sum(dirs.values()) for dirs in inter_votes.get(name, {}).values())

    def run_bfs(seed_name, seed_wx, seed_wy):
        placed[seed_name] = (seed_wx, seed_wy)
        q = deque([seed_name])
        while q:
            cur = q.popleft()
            cur_wx, cur_wy = placed[cur]
            cur_w = areas_out[cur]['w']
            cur_h = areas_out[cur]['h']

            # Traverse as effectively undirected so one-way/missing reverse links
            # don't split components or force poor global anchors.
            neighbors_set = set(inter_votes.get(cur, {}).keys())
            for n in inter_votes.keys():
                if cur in inter_votes.get(n, {}):
                    neighbors_set.add(n)

            neighbors = sorted(neighbors_set, key=lambda n: -pair_strength(cur, n))
            for nb in neighbors:
                if nb in placed or nb not in areas_out:
                    continue
                d = pair_dir(cur, nb)
                if d is None:
                    continue
                nb_w = areas_out[nb]['w']
                nb_h = areas_out[nb]['h']
                if d == 0:   # N
                    nx = cur_wx + (cur_w - nb_w) // 2
                    ny = cur_wy - nb_h - PADDING
                elif d == 1: # E
                    nx = cur_wx + cur_w + PADDING
                    ny = cur_wy + (cur_h - nb_h) // 2
                elif d == 2: # S
                    nx = cur_wx + (cur_w - nb_w) // 2
                    ny = cur_wy + cur_h + PADDING
                else:        # W
                    nx = cur_wx - nb_w - PADDING
                    ny = cur_wy + (cur_h - nb_h) // 2
                nx, ny = place_clear(nb, nx, ny, d)
                placed[nb] = (nx, ny)
                q.append(nb)

    # Build a total-votes ordering for seed selection
    all_names = set(wa['n'] for wa in world_list)
    # Seed from the most-connected area; after each component, continue from the
    # next most-connected unplaced area (placed to the right of current layout).
    while True:
        unplaced_now = [n for n in all_names if n not in placed]
        if not unplaced_now:
            break
        # Pick the unplaced area with the most inter-area connections
        seed = max(unplaced_now, key=lambda n: (total_votes(n), areas_out[n]['w'] * areas_out[n]['h']))
        if total_votes(seed) == 0:
            break  # remaining areas have no connections; handle as fallback row below

        if placed:
            # Place new component to the right of everything placed so far
            max_x = max(px + areas_out[pn]['w'] + PADDING for pn, (px, py) in placed.items())
            seed_wx = max_x + PADDING * 2
            # Vertically centered on current layout centroid (approx)
            mid_y = (min(py for _, (px, py) in placed.items()) +
                     max(py + areas_out[pn]['h'] for pn, (px, py) in placed.items())) // 2
            seed_wy = mid_y
        else:
            seed_wx, seed_wy = 0, 0

        run_bfs(seed, seed_wx, seed_wy)

    # ---- 3. Fallback row for zero-connection areas ----
    unplaced = [wa for wa in world_list if wa['n'] not in placed]
    if placed:
        max_y = max(py + areas_out[pn]['h'] for pn, (px, py) in placed.items())
        fb_y = max_y + PADDING * 4
    else:
        fb_y = 0

    fb_x = 0
    for wa in unplaced:
        ad = areas_out[wa['n']]
        placed[wa['n']] = (fb_x, fb_y)
        fb_x += ad['w'] + PADDING

    # ---- 4. Normalize to padded origin ----
    if placed:
        WORLD_PAD_X = 10
        WORLD_PAD_Y = 10
        min_x = min(px for px, py in placed.values())
        min_y = min(py for px, py in placed.values())
        placed = {
            n: (px - min_x + WORLD_PAD_X, py - min_y + WORLD_PAD_Y)
            for n, (px, py) in placed.items()
        }

    # ---- 5. Apply to world_list ----
    for wa in world_list:
        name = wa['n']
        wx, wy = placed.get(name, (0, 0))
        wa['wx'] = wx
        wa['wy'] = wy
        wa['c'] = list(inter_votes.get(name, {}).keys())

    return world_list


def main():
    os.makedirs(os.path.dirname(OUT_FILE), exist_ok=True)

    print('Reading areas...', file=sys.stderr)
    world_list, areas_out = process_areas()

    print(f'Placing {len(world_list)} areas...', file=sys.stderr)
    world_list = place_areas(world_list, areas_out)

    out = {'world': world_list, 'areas': areas_out}

    with open(OUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(out, f, separators=(',', ':'), ensure_ascii=False)

    total_rooms = sum(len(areas_out[a]['rooms']) for a in areas_out)
    print(f'\nWrote {OUT_FILE}', file=sys.stderr)
    print(f'Total: {len(world_list)} areas, {total_rooms} rooms', file=sys.stderr)


if __name__ == '__main__':
    main()
