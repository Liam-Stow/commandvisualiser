#pragma once
#include <frc/Alert.h>
#include <frc/Timer.h>

#include <units/current.h>
#include <units/temperature.h>

namespace AlertController {
struct MotorAlertConfig {
  frc::Alert temperatureAlert;
  frc::Alert currentAlert;
  frc::Alert recordedTemperatureAlert;
  frc::Alert recordedCurrentAlert;
  units::celsius_t maxDegrees;
  units::ampere_t maxCurrent;
  frc::Timer highCurrentTimer = frc::Timer();
};

// updates the alert for the temperature. automatically updates to true or false
void UpdateTemperatureAlert(MotorAlertConfig& config, units::celsius_t motorTemperature);

// updates the alert for the current. automatically updates to true if has been over 3s or false.
void UpdateCurrentAlert(MotorAlertConfig& config, units::ampere_t motorCurrent);
};  // namespace AlertController
