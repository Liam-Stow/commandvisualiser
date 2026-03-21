#include "utilities/AlertController.h"

namespace AlertController {

// updates the alert for the temperature. automatically updates to true or false
void UpdateTemperatureAlert(MotorAlertConfig& config, units::celsius_t motorTemperature) {
  if (motorTemperature > config.maxDegrees) {
    config.temperatureAlert.Set(true);
    config.recordedTemperatureAlert.Set(true);
  } else {
    config.temperatureAlert.Set(false);
  }
}
// updates the alert for the current. automatically updates to true if has been over 3s or false.
void UpdateCurrentAlert(MotorAlertConfig& config, units::ampere_t motorCurrent) {
  if (motorCurrent > config.maxCurrent) {
    config.highCurrentTimer.Start();
    if (config.highCurrentTimer.Get() > 3_s) {
      config.currentAlert.Set(true);
      config.recordedCurrentAlert.Set(true);
    }

  } else {
    config.currentAlert.Set(false);
    config.highCurrentTimer.Reset();
  }
}

}  // namespace AlertController