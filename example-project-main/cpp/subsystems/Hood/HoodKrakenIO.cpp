#include "subsystems/Hood/HoodKrakenIO.h"

#include "subsystems/Hood/HoodMotorConfig.h"

#include "utilities/Logger.h"

#include <frc/simulation/RoboRioSim.h>

HoodKrakenIO::HoodKrakenIO(int motorCanID) : _motor(motorCanID, ctre::phoenix6::CANBus{"Canivore"}) {}

void HoodKrakenIO::ConfigMotor() {
  ctre::phoenix6::configs::TalonFXConfiguration config;
  config.Feedback.SensorToMechanismRatio = KrakenMotorConfig::GEAR_RATIO;
  config.Slot0.kP = KrakenMotorConfig::P;
  config.Slot0.kI = KrakenMotorConfig::I;
  config.Slot0.kD = KrakenMotorConfig::D;
  config.Slot0.kS = KrakenMotorConfig::S;
  config.Slot0.kG = KrakenMotorConfig::G;
  config.Slot0.GravityType = KrakenMotorConfig::GRAVITY_TYPE;
  config.MotorOutput.Inverted = KrakenMotorConfig::INVERTED;

  config.MotorOutput.NeutralMode = KrakenMotorConfig::IDLE_MODE;

  config.CurrentLimits.SupplyCurrentLimitEnable = KrakenMotorConfig::ENABLE_SUPPLY_CURRENT_LIMIT;
  config.CurrentLimits.SupplyCurrentLimit = KrakenMotorConfig::SUPPLY_CURRENT_LIMT;
  config.CurrentLimits.SupplyCurrentLowerLimit = KrakenMotorConfig::SUPPLY_CURRENT_LOWER_LIMIT;
  config.CurrentLimits.SupplyCurrentLowerTime = KrakenMotorConfig::SUPPLY_CURRENT_LOWER_TIME;

  config.CurrentLimits.StatorCurrentLimitEnable = KrakenMotorConfig::ENABLE_STATOR_CURRENT_LIMIT;
  config.CurrentLimits.StatorCurrentLimit = KrakenMotorConfig::STATOR_CURRENT_LIMIT;

  _motor.GetConfigurator().Apply(config);
}

void HoodKrakenIO::SetVoltage(units::volt_t voltage) {
  _motor.SetControl(ctre::phoenix6::controls::VoltageOut{voltage});
}

void HoodKrakenIO::SetPosition(units::degree_t pos) {
  _motor.SetPosition(pos);
}

void HoodKrakenIO::SetPositionTarget(units::degree_t target) {
  _desiredAngle = target;
  _motor.SetControl(ctre::phoenix6::controls::PositionVoltage(_desiredAngle)
      .WithEnableFOC(KrakenMotorConfig::ENABLE_FOC));
}

void HoodKrakenIO::SetBrakeMode(bool isBreakModeOn) {
  if (isBreakModeOn) {
    _motor.SetNeutralMode(ctre::phoenix6::signals::NeutralModeValue::Brake);
  } else {
    _motor.SetNeutralMode(ctre::phoenix6::signals::NeutralModeValue::Coast);
  }
}

void HoodKrakenIO::Log(std::string keyName) {
  Logger::LogFalcon(keyName, _motor);
}

void HoodKrakenIO::StopMotor() {
  _motor.Set(0);
}

void HoodKrakenIO::IterateSim(units::revolutions_per_minute_t velocity, units::turn_t position) {
  _motor.GetSimState().SetRawRotorPosition(KrakenMotorConfig::GEAR_RATIO * position);
  _motor.GetSimState().SetRotorVelocity(KrakenMotorConfig::GEAR_RATIO * velocity);
}

units::degree_t HoodKrakenIO::GetPosition() {
  return _motor.GetPosition().GetValue();
}

units::degree_t HoodKrakenIO::GetPositionTarget() {
  return _desiredAngle;
}

units::degree_t HoodKrakenIO::GetPositionError() {
  return _desiredAngle - GetPosition();
}

units::ampere_t HoodKrakenIO::GetCurrent() {
  return _motor.GetStatorCurrent().GetValue();
}

units::volt_t HoodKrakenIO::GetVoltage() {
  return _motor.GetMotorVoltage().GetValue();
}

units::celsius_t HoodKrakenIO::GetTemperature() {
  return _motor.GetDeviceTemp().GetValue();
}

units::volt_t HoodKrakenIO::CalcSimVoltage() {
  return _motor.GetSimState().GetMotorVoltage();
}
