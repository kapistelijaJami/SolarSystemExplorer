import * as THREE from 'three';
import * as timeUtil from "@/util/timeUtil";

//TODO: Add end of data error
export function findEphemerisBracket(jdUTC, data) {
    let jdTDBApprox = jdUTC;

    if (data[0].deltaT) {
        jdTDBApprox = timeUtil.jdUTCToJdTDB(jdUTC, data[0].deltaT);
    }

    let low = 0;
    let high = data.length - 1;

    //If outside the data, give the extreme points
    if (jdTDBApprox <= data[0].jdTDB) {
        const start = data[low];
        const end = data[low];
        return [start, end];
    } else if (jdTDBApprox >= data[high].jdTDB) {
        const start = data[high];
        const end = data[high];
        return [start, end];
    }

    //Binary search
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (data[mid].jdTDB < jdTDBApprox) { //Too low
            low = mid + 1;
        } else { //Too high
            high = mid - 1;
        }
    }

    //Low is higher than high, we have a result
    const start = data[high];
    const end = data[low];
    return [start, end];
}

export function createEphemerisArray(jdUTC, start, end) {
    let jdTDB = jdUTC;
    if (start.deltaT) {
        jdTDB = timeUtil.jdUTCToJdTDB(jdUTC, start.deltaT);
    }

    //Swap y and z (needs to negate resulting z)
    return [
        jdTDB,
        start.jdTDB,
        end.jdTDB,
        new THREE.Vector3(start.x, start.z, -start.y),      //pos start
        new THREE.Vector3(end.x, end.z, -end.y),            //pos end
        new THREE.Vector3(start.vx, start.vz, -start.vy),   //vel start
        new THREE.Vector3(end.vx, end.vz, -end.vy)          //vel end
    ];
}

export function createOrientationArray(jdUTC, start, end) {
    let jdTDB = jdUTC;
    if (start.deltaT) {
        jdTDB = timeUtil.jdUTCToJdTDB(jdUTC, start.deltaT);
    }

    //Swap y and z (needs to negate resulting z)
    return [
        jdTDB,
        start.jdTDB,
        end.jdTDB,
        start.w,      //W start (rotation)
        end.w,      //W end (rotation)
        new THREE.Vector3(start.pole_vec[0], start.pole_vec[2], -start.pole_vec[1]), //pole orientation start
        new THREE.Vector3(end.pole_vec[0], end.pole_vec[2], -end.pole_vec[1]) //pole orientation end
    ];
}