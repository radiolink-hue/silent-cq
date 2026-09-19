import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  gpsFromLatLng,
  mergeAllstarGps,
  parseAllstarMapData,
  parseAllstarStatsGps,
} from "./gps.ts";
import { gridToLatLng } from "../../../src/lib/maidenhead.ts";

const statsFixture = {
  stats: {
    data: {
      links: ["1999", "43622", "429730"],
      linkedNodes: [
        { name: "1999" },
        {
          name: 429730,
          callsign: "4X1DA",
          server: {
            Logitude: "34.995125",
            Latitude: "31.893445",
            Location: "Modiin, ISRAEL",
          },
        },
        {
          name: 43622,
          callsign: "4X1KS",
          server: {
            Logitude: "35.025326",
            Latitude: "31.931077",
            Location: "Hashmonaim Israel",
          },
        },
      ],
    },
    user_node: {
      name: 48552,
      callsign: "4X1KS",
      server: {
        Logitude: "35.025233",
        Latitude: "31.931143",
        Location: "Cloud Node",
      },
    },
  },
  node: {
    name: 48552,
    callsign: "4X1KS",
    server: {
      Logitude: "35.025233",
      Latitude: "31.931143",
      Location: "Cloud Node",
    },
  },
};

describe("parseAllstarStatsGps", () => {
  it("extracts hub and linked-node GPS from the network map stats JSON", () => {
    const byNode = parseAllstarStatsGps(statsFixture);
    assert.equal(byNode.has("1999"), false);

    const da = byNode.get("429730");
    assert.ok(da);
    assert.equal(da.callsign, "4X1DA");
    assert.equal(da.lat, 31.893445);
    assert.equal(da.lng, 34.995125);
    assert.equal(da.city, "Modiin");
    assert.equal(da.country, "ISRAEL");
    assert.equal(da.source, "allstar-gps");

    const gridCenter = gridToLatLng(da.gridsquare);
    assert.ok(gridCenter);
    const kmOff =
      Math.hypot(da.lat - gridCenter.lat, da.lng - gridCenter.lng) * 111;
    assert.ok(kmOff > 0.05, "GPS must not be the Maidenhead square center");

    assert.equal(byNode.get("48552")?.lat, 31.931143);
    assert.equal(byNode.get("43622")?.lng, 35.025326);
  });

  it("accepts Longitude spelling as well as ASL Logitude", () => {
    const byNode = parseAllstarStatsGps({
      node: {
        name: "1",
        callsign: "W1AW",
        server: { Latitude: 41.7, Longitude: -72.7, Location: "Newington" },
      },
    });
    assert.equal(byNode.get("1")?.lng, -72.7);
  });
});

describe("parseAllstarMapData", () => {
  it("parses tab-delimited bubble-map rows", () => {
    const text = [
      "48552\t4X1KS\t31.931143\t35.025233\tCloud Node\tDMR_Bridge",
      "2000\tWB6NIL\t34.05173\t-118.244648\taws-east2ls-ast0\tASL Public Hub",
      "bad\tX\tnot\ta\tcoord",
    ].join("\n");
    const byNode = parseAllstarMapData(text);
    assert.equal(byNode.get("48552")?.lat, 31.931143);
    assert.equal(byNode.get("48552")?.lng, 35.025233);
    assert.equal(byNode.get("2000")?.callsign, "WB6NIL");
    assert.equal(byNode.has("bad"), false);
  });
});

describe("gpsFromLatLng", () => {
  it("rejects missing or 0,0 coordinates", () => {
    assert.equal(gpsFromLatLng("1", "W1AW", 0, 0), null);
    assert.equal(gpsFromLatLng("1", "W1AW", 91, 0), null);
  });
});

describe("mergeAllstarGps", () => {
  it("lets stats GPS override mapData for the same node", () => {
    const mapData = parseAllstarMapData("429730\t4X1DA\t31.8\t35.0\tSomewhere\n");
    const stats = parseAllstarStatsGps(statsFixture);
    const merged = mergeAllstarGps(stats, mapData);
    assert.equal(merged.get("429730")?.lat, 31.893445);
  });
});
