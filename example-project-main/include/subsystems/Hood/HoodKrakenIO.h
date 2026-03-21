#include <ctre/phoenix6/TalonFX.hpp>

#include "HoodMotorIO.h"

class HoodKrakenIO : public HoodMotorIO {
 public:
  HoodKrakenIO(int motorCanID);
  void ConfigMotor() override;
  void SetVoltage(units::volt_t voltage) override;
  void SetPosition(units::degree_t pos) override;
  void SetPositionTarget(units::degree_t target) override;
  void SetBrakeMode(bool isBreakModeOn) override;
  void Log(std::string keyName) override;
  void StopMotor() override;
  void IterateSim(units::revolutions_per_minute_t velocity, units::turn_t position) override;
  units::degree_t GetPosition() override;
  units::degree_t GetPositionTarget() override;
  units::degree_t GetPositionError() override;
  units::ampere_t GetCurrent() override;
  units::volt_t GetVoltage() override;
  units::celsius_t GetTemperature() override;
  units::volt_t CalcSimVoltage() override;

 private:
  ctre::phoenix6::hardware::TalonFX _motor;
  units::degree_t _desiredAngle;
};