#pragma once

#include <units/angle.h>
#include <units/angular_velocity.h>
#include <units/current.h>
#include <units/temperature.h>
#include <units/voltage.h>

class HoodMotorIO {
 public:
  virtual void ConfigMotor() = 0;
  virtual void SetVoltage(units::volt_t voltage) = 0;
  virtual void SetPosition(units::degree_t pos) = 0;
  virtual void SetPositionTarget(units::degree_t target) = 0;
  virtual void SetBrakeMode(bool isBreakModeOn) = 0;
  virtual void Log(std::string keyName) = 0;
  virtual void StopMotor() = 0;
  virtual void IterateSim(units::revolutions_per_minute_t velocity, units::turn_t position) = 0;
  virtual units::degree_t GetPosition() = 0;
  virtual units::degree_t GetPositionTarget() = 0;
  virtual units::degree_t GetPositionError() = 0;
  virtual units::ampere_t GetCurrent() = 0;
  virtual units::volt_t GetVoltage() = 0;
  virtual units::celsius_t GetTemperature() = 0;
  virtual units::volt_t CalcSimVoltage() = 0;
};