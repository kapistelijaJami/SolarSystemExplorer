//Get the t-value for interpolation between two timestamps start and end.
export function normalizeTime(time, start, end) {
    return (time - start) / (end - start);
}

export function utcToJulianDate(date) {
    return date.getTime() / 86400000 + 2440587.5;
}

//Julian date in UTC (in days) to julian date in TDB
export function jdUtcToJdTDB(jdUTC, deltaT) { //deltaT is VEC_DELTA_T in ephemeris data (TDB - UT)
    return jdUTC + deltaT / 86400; //deltaT converted to days, and added to jdUTC => jdTDB
}

export function utcToJdTDB(date, deltaT) {
    return jdUtcToJdTDB(utcToJulianDate(date), deltaT);
}