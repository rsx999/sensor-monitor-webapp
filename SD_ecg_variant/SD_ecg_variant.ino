#include <Arduino.h>
#include "MS5803_02.h"
#include <Arduino_LSM6DS3.h>
#include <Wire.h>

// --- CONFIGURATION ---
#define EKG_PIN             A0
#define ECG_BUF_SIZE        100
const unsigned long SAMPLE_INTERVAL_US = 100000UL;   // 1 ms → 1 kHz sampling
const unsigned long LOG_INTERVAL_MS     = 1000UL;  // 2 s logging
const float SEA_LEVEL_PRESSURE         = 1013.25f; // mbar
const float GAUGE_ALPHA                = 0.9f;    // smoothing factor for detrended gauge

// --- SENSORS ---
MS_5803 atmosphericSensor(512), waterSensor(512);

// --- STATE: ECG smoothing & R-peak detection ---
uint16_t ecgBuf[ECG_BUF_SIZE];
uint32_t ecgSum       = 0;
uint8_t  ecgBufIdx    = 0;
float    ecgFiltered  = 0.0f;
float    ecgThreshold = 0.0f;
bool     inBeat       = false;

// --- STATE: per-beat gauge baseline & smoothing ---
uint32_t cycleGaugeSum    = 0;
uint16_t cycleGaugeCount  = 0;
float    cycleGaugeBase   = 0.0f;
float    gaugeSmoothed    = 0.0f;

// --- BASELINES ---
float baselineAtmPressure = 0.0f;
float baselineECG         = 0.0f;
float baselineElevation   = 0.0f;

// --- IMU ---
bool  imuAvailable = false;
float xAcc, yAcc, zAcc;

// --- TIMERS ---
unsigned long startTimeMs   = 0;
unsigned long lastLogMs     = 0;
unsigned long lastSampleUs  = 0;

void setup() {
  Serial.begin(115200);
  while (!Serial);

  // CSV header: time_s,gaugeRaw,gaugeSmoothed,ecgRaw,tilt_deg,baseAtm,baseElev
  Serial.println("time_s,gaugeRaw,gaugeSmoothed,ecgRaw,tilt_deg,baseAtm,baseElev");

  Wire.begin();
  Wire.setClock(400000);

  // Init IMU (5 s timeout)
  unsigned long imuT0 = millis();
  while (millis() - imuT0 < 5000) {
    if (IMU.begin()) { imuAvailable = true; break; }
    delay(10);
  }

  // Init pressure sensors
  if (!atmosphericSensor.initializeMS_5803(false)) while (1);
  if (!waterSensor.initializeMS_5803(false))       while (1);

  // --- Baseline calibration dialogue ---
  Serial.println("SYSTEM: Waiting for ECG spike to start calibration...");
  while (analogRead(EKG_PIN) < 500) delay(10);
  Serial.println("SYSTEM: ECG spike detected. Starting 10s baseline calibration...");

  // 10 s baseline for pressure & ECG
  const unsigned long BASE_MS   = 10000UL;
  const unsigned long INT_MS    = 250UL;
  unsigned long t0 = millis();
  float sumAtm = 0, sumECG = 0;
  uint16_t cntAtm = 0, cntECG = 0;
  while (millis() - t0 < BASE_MS) {
    atmosphericSensor.readSensor();
    sumAtm += atmosphericSensor.pressure(); cntAtm++;
    int v = analogRead(EKG_PIN);
    sumECG += v; cntECG++;
    delay(INT_MS);
  }

  // Compute baselines
  baselineAtmPressure = sumAtm / cntAtm;
  baselineECG         = sumECG / cntECG;
  baselineElevation   = 44330.0f * (1 - pow(baselineAtmPressure / SEA_LEVEL_PRESSURE, 0.1903f));
  ecgThreshold        = baselineECG + 30.0f;

  Serial.print("SYSTEM: Baseline complete. Atm = ");
  Serial.print(baselineAtmPressure, 2);
  Serial.print(" mbar, Elev = ");
  Serial.print(baselineElevation, 2);
  Serial.print(" m, ECG_base = ");
  Serial.println(baselineECG, 1);

  // Seed ECG buffer at baselineECG
  for (uint8_t i = 0; i < ECG_BUF_SIZE; i++) {
    ecgBuf[i] = uint16_t(baselineECG);
    ecgSum   += ecgBuf[i];
  }
  ecgFiltered = baselineECG;

  // Initialize per-beat gauge baseline & smoother
  atmosphericSensor.readSensor();
  waterSensor.readSensor();
  float initRaw = waterSensor.pressure() - baselineAtmPressure;
  cycleGaugeBase = initRaw;
  cycleGaugeSum  = 0;
  cycleGaugeCount= 0;
  gaugeSmoothed  = 0.0f;

  // Start timers
  startTimeMs  = millis();
  lastLogMs    = startTimeMs;
  lastSampleUs = micros();
}

void loop() {
  unsigned long nowUs = micros();
  unsigned long nowMs = millis();

  // 1) Sample ECG & gauge at ~1 kHz
  if (nowUs - lastSampleUs >= SAMPLE_INTERVAL_US) {
    lastSampleUs += SAMPLE_INTERVAL_US;

    // — ECG moving-average —
    int rawECG = analogRead(EKG_PIN);
    ecgSum             = ecgSum - ecgBuf[ecgBufIdx] + rawECG;
    ecgBuf[ecgBufIdx]  = rawECG;
    ecgBufIdx          = (ecgBufIdx + 1) % ECG_BUF_SIZE;
    ecgFiltered        = float(ecgSum) / ECG_BUF_SIZE;

    // — Read raw gauge pressure —
    atmosphericSensor.readSensor();
    waterSensor.readSensor();
    float gaugeRaw = waterSensor.pressure() - baselineAtmPressure;

    // — Accumulate for cycle average —
    cycleGaugeSum += gaugeRaw;
    cycleGaugeCount++;

    // — On each R-peak, compute cycle average & reset —
    bool above = (ecgFiltered > ecgThreshold);
    if (!inBeat && above && cycleGaugeCount > 0) {
      inBeat = true;
      cycleGaugeBase = float(cycleGaugeSum) / cycleGaugeCount;
      cycleGaugeSum   = 0;
      cycleGaugeCount = 0;
      gaugeSmoothed   = 0.0f;  // reset smoother at new cycle
    } else if (inBeat && !above) {
      inBeat = false;
    }

    // — Detrend gauge by subtracting per-cycle baseline —
    float gaugeDetrend = gaugeRaw - cycleGaugeBase;

    // — Smooth the detrended gauge —
    gaugeSmoothed = GAUGE_ALPHA * gaugeSmoothed + (1.0f - GAUGE_ALPHA) * gaugeDetrend;

    // — Compute tilt angle —
    float tiltDeg = -1.0f;
    if (imuAvailable && IMU.readAcceleration(xAcc, yAcc, zAcc)) {
      float g = sqrt(xAcc*xAcc + yAcc*yAcc + zAcc*zAcc);
      tiltDeg = acos(zAcc / g) * 180.0f / PI;
    }

    // 2) LOG every 2 s
    if (nowMs - lastLogMs >= LOG_INTERVAL_MS) {
      lastLogMs += LOG_INTERVAL_MS;
      float t_s = (nowMs - startTimeMs) / 1000.0f;

      Serial.print(t_s,2);
      Serial.print(','); Serial.print(gaugeRaw,2);
      Serial.print(','); Serial.print(gaugeSmoothed,2);
      Serial.print(','); Serial.print(rawECG);        // raw ECG instead of filtered
      Serial.print(','); Serial.print(tiltDeg,1);
      Serial.print(','); Serial.print(baselineAtmPressure,2);
      Serial.print(','); Serial.println(baselineElevation,2);
    }
  }

  // No delay(): loop runs as fast as possible
}

