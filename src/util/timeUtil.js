import { PLAYBACK_SLIDER_SPEED_MIN, PLAYBACK_SLIDER_SPEED_MAX } from "@/constants";

//Get the t-value for interpolation between two timestamps start and end.
export function normalizeTime(time, start, end) {
    return (time - start) / (end - start);
}

export function utcToJulianDate(date) {
    return date.getTime() / 86400000 + 2440587.5;
}

//Julian date in UTC (in days) to julian date in TDB
export function jdUTCToJdTDB(jdUTC, deltaT) { //deltaT is VEC_DELTA_T in ephemeris data (TDB - UT)
    return jdUTC + deltaT / 86400; //deltaT converted to days, and added to jdUTC => jdTDB
}

export function utcToJdTDB(date, deltaT) {
    return jdUTCToJdTDB(utcToJulianDate(date), deltaT);
}

export function sliderValueToRealSpeed(sliderValue) {
    return PLAYBACK_SLIDER_SPEED_MIN * Math.pow(PLAYBACK_SLIDER_SPEED_MAX / PLAYBACK_SLIDER_SPEED_MIN, sliderValue / 100);
}

export function playbackSpeedToSliderValue(playbackSpeed) {
    return Math.log(playbackSpeed / PLAYBACK_SLIDER_SPEED_MIN) / Math.log(PLAYBACK_SLIDER_SPEED_MAX / PLAYBACK_SLIDER_SPEED_MIN) * 100;
}

export function roundPlaybackSpeed(playbackSpeed) {
    if (playbackSpeed > 10) {
        playbackSpeed = Math.round(playbackSpeed);
    } else {
        playbackSpeed = Math.round(playbackSpeed * 10) / 10; //Rounding to nearest 10th
    }
    return playbackSpeed;
}

export function playbackSpeedToTimePerSec(playbackSpeed) {
    let unit = "sec";

    if (playbackSpeed >= 3600 * 24 * 365) {
        playbackSpeed /= 3600 * 24 * 365;
        unit = "year";
    } else if (playbackSpeed >= 3600 * 24) {
        playbackSpeed /= 3600 * 24;
        unit = "day";
    } else if (playbackSpeed >= 3600) {
        playbackSpeed /= 3600;
        unit = "hr";
    } else if (playbackSpeed >= 60) {
        playbackSpeed /= 60;
        unit = "min";
    }

    const roundedSpeed = roundPlaybackSpeed(playbackSpeed);

    if (roundedSpeed !== 1) {
        unit += "s";
    }

    return roundedSpeed + ` ${unit}/sec`;
}