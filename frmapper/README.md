# frmapper (first pass)

Standalone grid-based mapper prototype.

## Run

Open `index.html` in a browser or serve `Reference/site` and browse to `/frmapper/`.

## Features

- Grid rooms rendered edge-to-edge (no spacing lines).
- Sector SVG tile icons.
- Wall and door rendering for `n/e/s/w` exits.
  - No exit: solid wall.
  - `closed`: door mark.
  - `locked`: door mark + lock cross.
- Markers for diagonal exits and vertical exits (`u` / `d`).
- Load JSON from file.
- Export current map to JSON.
- Built-in sample loader (`sample-map.json`).
- Built-in player-centering and movement animation (`250ms` default).

## JSON Format (v1)

```json
{
  "version": "frmapper.v1",
  "meta": {
    "title": "My Map"
  },
  "rooms": [
    {
      "id": "room_id",
      "name": "Room Name",
      "x": 0,
      "y": 0,
      "z": 0,
      "sector": "city",
      "exits": {
        "n": { "to": "other_room", "state": "open" },
        "e": { "to": "east_room", "state": "closed" },
        "u": { "to": "up_room", "state": "open" }
      },
      "notes": "optional"
    }
  ]
}
```

### Supported exit keys

- Cardinal: `n`, `e`, `s`, `w`
- Diagonal: `ne`, `nw`, `se`, `sw`
- Vertical: `u`, `d`

### Supported states

- `open`
- `closed`
- `locked`

### Supported sectors

Canonical sector IDs used by frmapper:

- `inside`
- `city`
- `field`
- `forest`
- `hills`
- `mountain`
- `water_swim`
- `water_noswim`
- `underwater`
- `air`
- `desert`
- `dungeon`

`frmapper` normalizes common aliases automatically (for example `water`, `waterswim`, `town`, `cave`) to these canonical IDs.

## Embed API (postMessage)

`frmapper` listens for:

- `frmapper.loadSnapshot`
- `frmapper.upsertRoom`
- `frmapper.loadRoomInfoSnapshot`
- `frmapper.ingestRoomInfo`
- `frmapper.setPlayerLocation`
- `frmapper.centerOn`
- `frmapper.moveTo`

Example:

```js
iframe.contentWindow.postMessage({
  type: "frmapper.upsertRoom",
  payload: {
    id: "r_10_20_0",
    x: 10,
    y: 20,
    z: 0,
    sector: "forest",
    exits: {
      n: { to: "r_10_19_0", state: "open" }
    }
  }
}, "*");
```

### Recommended integration (host app)

For reusable integrations, keep host logic thin and send raw room updates:

```js
iframe.contentWindow.postMessage({
  type: "frmapper.ingestRoomInfo",
  payload: {
    roomInfo: gmcpRoomInfo,
    durationMs: 250
  }
}, "*");
```

`frmapper` will parse room coordinates/exits/terrain, upsert map data, detect movement from prior location, draw the transition line, and pan to the new room.

To force centering (without movement semantics), send:

```js
iframe.contentWindow.postMessage({
  type: "frmapper.centerOn",
  payload: {
    roomId: "12345",
    durationMs: 250
  }
}, "*");
```
