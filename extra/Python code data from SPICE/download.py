import spiceypy as spice
import numpy as np
from datetime import datetime, timedelta
import json
import math

#Kernels:
#https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc
#https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls

spice.furnsh("naif0012.tls")
spice.furnsh("pck00011.tpc")

def earth_ra_dec(et):
    #Matrix m represents the rotation from IAU_EARTH frame to Ecliptic J2000 (ICRF)
    m = spice.pxform("IAU_EARTH", "ECLIPJ2000", et) #Body frame can be found with spice.cidfrm(bodyId)[1]
    pole_vec = m @ np.array([0, 0, 1.0])  #Earth's north pole
    #pole_vec is unit vector from earth center to north pole
    
    x, y, z = pole_vec
    
    ra = np.degrees(np.arctan2(y, x)) % 360.0
    dec = np.degrees(np.arcsin(z / np.linalg.norm(pole_vec)))
    return [x, y, z], ra, dec

def earth_W(et):
    # PCK variables: BODY399_ constants
    #spice.bodvcd(399, "POLE_RA", 3)[1]
    
    #This returns the polynomial coefficients for the rotation W value. W0 + W1*t + W2*t^2.
    #W0 is rotation at time 0, and W1 is then the rate it changes, since W2 is 0 for earth.
    #t is in days, and values are in degrees.
    W_params = spice.bodvcd(399, "PM", 3)[1]
    
    W0 = W_params[0]
    W_rate = W_params[1]  # deg/day
    
    #print("W0:", W0, " W_rate:", W_rate)
    
    #et - J2000 in days
    dt = (et - spice.str2et("2000 JAN 01 12:00:00 TDB")) / 86400.0 #dt in days from J2000
    
    w = (W0 + W_rate * dt)
    #print(dt, w)
    return w


start = datetime(1990, 1, 1)
days = 18627 #def: 18627

print(datetime(2040, 12, 31) - datetime(1990, 1, 1))

print("-" * 50)

#start = start + timedelta(hours=12)
#print(spice.cidfrm(399)[1])
#print(spice.bodc2n(399))

result = {
    "name": "Earth",
    "bodyID": "399",
    "timeStep": "1d",
    "center": "@0",
    "start": start.strftime("%Y-%m-%d"),
    "end": (start + timedelta(days=days)).strftime("%Y-%m-%d"),
    "data": []
}

testTime = datetime(2000, 1, 1) + timedelta(hours=12)
etTest1 = spice.utc2et("2000-01-01T12:00:00")
etTest2 = spice.str2et("2000 JAN 01 12:00:00 TDB") #2000 JAN 01 12:00:00 TDB works
print(etTest1, etTest2, (etTest1 - etTest2))

etTest3 = spice.tparse("2000-01-01T12:00:00")[0]
print(etTest3, etTest2, etTest3 - etTest2)

print("-" * 50)


for i in range(days):
    t = start + timedelta(days=i)
    formatted = t.strftime("%Y-%m-%dT%H:%M:%S")
    #Using spice.tparse instead of spice.utc2et, we can input a time, it expects utc time, and it outputs utc seconds,
    #but we just continue by assuming they are et seconds, then we can work with TDB times the whole time.
    et = spice.tparse(formatted)[0] #et is in seconds since J2000 TDB
    utcSec = spice.utc2et(formatted)
    deltaT = -(et - utcSec) #have to negate (or swap subtraction order), because of the previous assumption

    jdTDB = spice.unitim(et, 'ET', 'JDTDB')
    pole_vec, ra, dec = earth_ra_dec(et)
    w = earth_W(et)

    result["data"].append({
        "date": f"{t.date()} {t.time()}",
        "jdTDB": jdTDB,
        "deltaT": deltaT,
        "pole_vec": pole_vec,
        "ra": ra,
        "dec": dec,
        "w": w
    })

    #print(f"{t.date()} {t.time()}   {et}   {ra:9.8f}   {dec:9.8f}   {w:9.8f}")
    #print("-" * 100)


json_string = json.dumps(result, indent=2)

try:
    with open("jsonOutput.json", 'w', encoding='utf-8') as f:
        f.write(json_string)
        
except Exception as e:
    print(f"An error occurred while saving the file: {e}")