#include <Arduino.h>
#include "MS5803_02.h"
#include <Arduino_LSM6DS3.h>
#include <Wire.h>

#define ECG_PIN             A0
#define ECG_BUF_SIZE        100
const unsigned long SAMPLE_INTERVAL_US = 1000UL;   // 1 ms → 1 kHz sampling
const unsigned long LOG_INTERVAL_MS    = 500UL;   // 1 s logging
const float SEA_LEVEL_PRESSURE         = 1013.25f;

MS_5803 atmosphericSensor(512), waterSensor(512);

uint16_t ecgBuf[ECG_BUF_SIZE];
uint32_t ecgSum       = 0;
uint8_t  ecgBufIdx    = 0;
float    ecgFiltered  = 0.0f;
float    ecgThreshold = 0.0f;
bool     inBeat       = false;

float baselineAtmPressure = 0.0f;
float baselineECG         = 0.0f;
float baselineElevation   = 0.0f;

bool  imuAvailable = false;
float xAcc, yAcc, zAcc;

unsigned long startTimeMs   = 0;
unsigned long lastLogMs     = 0;
unsigned long lastSampleUs  = 0;

void setup() {
  Serial.begin(115200);
  while (!Serial);

  Serial.println("time_s,gaugeRaw,ecgRaw,tilt_deg,baseAtm,baseElev");

  Wire.begin();
  Wire.setClock(400000);

  unsigned long imuT0 = millis();
  while (millis() - imuT0 < 5000) {
    if (IMU.begin()) { imuAvailable = true; break; }
    delay(10);
  }

  if (!atmosphericSensor.initializeMS_5803(false)) while (1);
  if (!waterSensor.initializeMS_5803(false))       while (1);

  Serial.println("SYSTEM: Waiting for ECG spike to start calibration...");
  while (analogRead(ECG_PIN) < 500) delay(10);
  Serial.println("SYSTEM: ECG spike detected. Starting 10s baseline calibration...");

  const unsigned long BASE_MS = 10000UL;
  const unsigned long INT_MS = 250UL;
  unsigned long t0 = millis();
  float sumAtm = 0, sumECG = 0;
  uint16_t cntAtm = 0, cntECG = 0;
  while (millis() - t0 < BASE_MS) {
    atmosphericSensor.readSensor();
    sumAtm += atmosphericSensor.pressure(); cntAtm++;
    int v = analogRead(ECG_PIN);
    sumECG += v; cntECG++;
    delay(INT_MS);
  }

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

  for (uint8_t i = 0; i < ECG_BUF_SIZE; i++) {
    ecgBuf[i] = uint16_t(baselineECG);
    ecgSum   += ecgBuf[i];
  }
  ecgFiltered = baselineECG;

  startTimeMs  = millis();
  lastLogMs    = startTimeMs;
  lastSampleUs = micros();
}

void loop() {
  unsigned long nowUs = micros();
  unsigned long nowMs = millis();

  if (nowUs - lastSampleUs >= SAMPLE_INTERVAL_US) {
    lastSampleUs += SAMPLE_INTERVAL_US;

    int rawECG = analogRead(ECG_PIN);
    ecgSum = ecgSum - ecgBuf[ecgBufIdx] + rawECG;
    ecgBuf[ecgBufIdx] = rawECG;
    ecgBufIdx = (ecgBufIdx + 1) % ECG_BUF_SIZE;
    ecgFiltered = float(ecgSum) / ECG_BUF_SIZE;

    atmosphericSensor.readSensor();
    waterSensor.readSensor();
    float gaugeRaw = waterSensor.pressure() - baselineAtmPressure;

    float tiltDeg = -1.0f;
    if (imuAvailable && IMU.readAcceleration(xAcc, yAcc, zAcc)) {
      float g = sqrt(xAcc * xAcc + yAcc * yAcc + zAcc * zAcc);
      tiltDeg = acos(zAcc / g) * 180.0f / PI;
    }

    if (nowMs - lastLogMs >= LOG_INTERVAL_MS) {
      lastLogMs += LOG_INTERVAL_MS;
      float t_s = (nowMs - startTimeMs) / 1000.0f;

    // Add in loop:
      float absolutePressure = waterSensor.pressure(); // Absolute pressure

      Serial.print(t_s,2);
      Serial.print(','); Serial.print(gaugeRaw,2);
      Serial.print(','); Serial.print(rawECG);
      Serial.print(','); Serial.print(tiltDeg,1);
      Serial.print(','); Serial.print(baselineAtmPressure,2);
      Serial.print(','); Serial.print(baselineElevation,2);
      Serial.print(','); Serial.println(absolutePressure,2);
    }
  }
}
