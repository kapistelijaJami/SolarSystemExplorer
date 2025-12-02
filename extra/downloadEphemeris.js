import fs from "fs";
import { fileURLToPath } from 'url';
import path from 'path';

//process.argv[0] = path to node
//process.argv[1] = path to this script
//process.argv[2+] = passed arguments
//Run file with: node downloadEphemeris.js argument1 argument2
//const arg = process.argv[2];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const onlyPrintUrl = false;

downloadEphemeris();
//downloadOrientationData();

async function downloadEphemeris() {
    const command = "301";
    const start = "1990-01-01";
    const end = "2040-12-31";
    const timeStep = "1d";
    const center = "@0";
    const name = "Moon";

    const params = getEphemerisParams(command, start, end, timeStep, center);

    const data = await queryHorizons(params);
    if (onlyPrintUrl) {
        return;
    } else if (data.error) {
        console.log("error:", data.error);
        return;
    }

    const result = {
        name: name,
        command: command,
        timeStep: timeStep,
        center: center,
        start: start,
        end: end
    };

    result.data = parseData(data);
    const jsonString = JSON.stringify(result, null, 2);

    const filePath = path.join(projectRoot, "public", "ephemeris", `${name}_ephemeris_${start}_${end}.json`);

    console.log("Saving file to:", filePath);
    fs.writeFileSync(filePath, jsonString);
}

//Will be a vector from the center of the body to its north pole in km.
//@Deprecated Use python with SPICE for easier implementation for interpolation
async function downloadOrientationData() {
    const bodyId = "399";
    const command = `'g:0,90,0@${bodyId}'`;
    const start = "1990-01-01";
    const end = "2040-12-31";
    const timeStep = "1 month";
    const center = "@399";
    const name = "Earth";

    const params = getEphemerisParams(command, start, end, timeStep, center);
    params.set("VEC_TABLE", "1"); //Need only position data

    const data = await queryHorizons(params);
    if (onlyPrintUrl) {
        return;
    } else if (data.error) {
        console.log("error:", data.error);
        return;
    }

    const result = {
        name: name,
        command: command,
        timeStep: timeStep,
        center: center,
        start: start,
        end: end
    };

    result.data = parseData(data, true);
    const jsonString = JSON.stringify(result, null, 2);

    const filePath = path.join(projectRoot, "public", "ephemeris", `${name}_orientation_${start}_${end}.json`);

    console.log("Saving file to:", filePath);
    fs.writeFileSync(filePath, jsonString);
}

async function queryHorizons(params) { //"@0" = Solar System Barycenter
    const baseUrl = "https://ssd.jpl.nasa.gov/api/horizons.api";

    try {
        const url = `${baseUrl}?${params}`;
        console.log("Sending request to", url);
        if (onlyPrintUrl) {
            return;
        }
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response.text();
    } catch (error) {
        return {
            error: error.message
        };
    }
}

//Command is only the bodyId
function getEphemerisParams(command, start, end, step, center) {
    const params = new URLSearchParams({
        format: "text",
        COMMAND: command,
        OBJ_DATA: "NO",
        MAKE_EPHEM: "YES",
        EPHEM_TYPE: "VECTORS",
        CENTER: center,
        START_TIME: start, //Many formats, but using this: '2028-05-04 18:00' (probably leaving time out too)
        STOP_TIME: end,
        STEP_SIZE: `'${step}'`, //Wrap step value in quotes for the API
        OUT_UNITS: "KM-S",
        REF_PLANE: "ECLIPTIC",
        REF_SYSTEM: "ICRF",
        VEC_CORR: "NONE",
        VEC_DELTA_T: "YES", //With this can do TDB = UTC + deltaT (should be accurate within a second)
        VEC_TABLE: "3",
        CSV_FORMAT: "YES",
        TIME_TYPE: "TDB", //Going with Barycentric Dynamical Time for now, should be the most accurate. Might need to convert UTC from client to TDB and use that for positions.
        EXTRA_PREC: "YES"
    });
    return params;
}

function parseData(dataText, orientationData = false) {
    const lines = dataText.split("\n");

    const data = [];

    let inData = false;
    for (let line of lines) {
        if (line.includes("$$SOE")) {
            inData = true;
            continue;
        } else if (line.includes("$$EOE")) {
            break;
        }

        if (inData && line) {
            const parts = line.split(",").map(part => part.trim());
            if (!orientationData) {
                const obj = {
                    jdTDB: Number(parts[0]),
                    deltaT: Number(parts[2]),
                    x: Number(parts[3]),
                    y: Number(parts[4]),
                    z: Number(parts[5]),
                    vx: Number(parts[6]),
                    vy: Number(parts[7]),
                    vz: Number(parts[8])
                };
                data.push(obj);
            } else {
                const obj = {
                    jdTDB: Number(parts[0]),
                    deltaT: Number(parts[2]),
                    x: Number(parts[3]),
                    y: Number(parts[4]),
                    z: Number(parts[5])
                };
                data.push(obj);
            }
        }
    }

    return data;
}