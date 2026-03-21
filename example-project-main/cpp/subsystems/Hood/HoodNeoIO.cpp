#include "subsystems/Hood/HoodNeoIO.h"

#include "subsystems/Hood/HoodMotorConfig.h"

#include "utilities/Logger.h"

HoodNeoIO::HoodNeoIO(int motorCanID) : _motor(motorCanID) {}

void HoodNeoIO::ConfigMotor() {
  rev::spark::SparkBaseConfig _config;
  _config.encoder.PositionConversionFactor(1 / NeoMotorConfig::GEAR_RATIO);
  _config.encoder.VelocityConversionFactor(1 / NeoMotorConfig::GEAR_RATIO);
  _config.closedLoop.Pid(NeoMotorConfig::P, NeoMotorConfig::I, NeoMotorConfig::D);
  _config.closedLoop.feedForward.kS(NeoMotorConfig::S);
  _config.SmartCurrentLimit(NeoMotorConfig::CURRENT_LIMT);
  _config.Inverted(NeoMotorConfig::INVERTED);
  _config.SetIdleMode(NeoMotorConfig::IDLE_MODE);
  _motor.OverwriteConfig(_config);

  Logger::Log("Hood/Motor", &_motor);
}

void HoodNeoIO::SetVoltage(units::volt_t voltage) {
  _motor.SetVoltage(voltage);
}

void HoodNeoIO::SetPosition(units::degree_t pos) {
  _motor.SetPosition(pos);
}

void HoodNeoIO::SetPositionTarget(units::degree_t target) {
  _motor.SetPositionTarget(target);
}

void HoodNeoIO::SetBrakeMode(bool isBreakModeOn) {
  rev::spark::SparkBaseConfig _brakeModeConfig;
  if (isBreakModeOn) {
    _brakeModeConfig.SetIdleMode(rev::spark::SparkBaseConfig::IdleMode::kBrake);
  } else {
    _brakeModeConfig.SetIdleMode(rev::spark::SparkBaseConfig::IdleMode::kCoast);
  }
  _motor.AdjustConfigNoPersist(_brakeModeConfig);
}

void HoodNeoIO::Log(std::string keyName) {
  ; /* no-op */
}

void HoodNeoIO::StopMotor() {
  _motor.Set(0);
}

void HoodNeoIO::IterateSim(units::revolutions_per_minute_t velocity, units::turn_t position) {
  _motor.IterateSim(velocity, std::make_optional<units::turn_t>(position));
}

units::degree_t HoodNeoIO::GetPosition() {
  return _motor.GetPosition();
}

units::degree_t HoodNeoIO::GetPositionTarget() {
  return _motor.GetPositionTarget();
}

units::degree_t HoodNeoIO::GetPositionError() {
  return _motor.GetPosError();
}

units::ampere_t HoodNeoIO::GetCurrent() {
  return _motor.GetStatorCurrent();
}

units::celsius_t HoodNeoIO::GetTemperature() {
  return _motor.GetTemperature();
}

units::volt_t HoodNeoIO::GetVoltage() {
  return _motor.GetMotorVoltage();
}

units::volt_t HoodNeoIO::CalcSimVoltage() {
  return _motor.CalcSimVoltage();
}