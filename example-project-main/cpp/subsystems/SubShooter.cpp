// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

#include "subsystems/SubShooter.h"

#include "utilities/Logger.h"

#include <ctre/phoenix6/configs/Configuration.hpp>
#include <ctre/phoenix6/controls/Follower.hpp>

#include "frc/smartdashboard/SmartDashboard.h"
#include "utilities/RobotVisualisation.h"

SubShooter::SubShooter() {
  // Coast Mode
  _shooterMotorConfig.MotorOutput.NeutralMode = ctre::phoenix6::signals::NeutralModeValue::Coast;

  // invert motors if needed
  _shooterMotorConfig.MotorOutput.Inverted = false;


  // Current limits
  _shooterMotorConfig.CurrentLimits.SupplyCurrentLimitEnable = true;
  _shooterMotorConfig.CurrentLimits.SupplyCurrentLowerLimit = 20.0_A;
  _shooterMotorConfig.CurrentLimits.SupplyCurrentLimit = 60.0_A;
  _shooterMotorConfig.CurrentLimits.SupplyCurrentLowerTime = 0.5_s;
  _shooterMotorConfig.CurrentLimits.StatorCurrentLimitEnable = true;
  _shooterMotorConfig.CurrentLimits.StatorCurrentLimit = 80.0_A;

  // PIDs
  _shooterMotorConfig.Slot0.kP = P;
  _shooterMotorConfig.Slot0.kI = I;
  _shooterMotorConfig.Slot0.kD = D;
  _shooterMotorConfig.Slot0.kV = V;

  // Feedback Sensor Ratio
  _shooterMotorConfig.Feedback.SensorToMechanismRatio = GEAR_RATIO;
  // Set motor 2 to follow motor 1
  _shooterMotor2.SetControl(ctre::phoenix6::controls::Follower(
    _shooterMotor1.GetDeviceID(), ctre::phoenix6::signals::MotorAlignmentValue::Opposed));

  _shooterMotor1.GetConfigurator().Apply(_shooterMotorConfig);
  _shooterMotor2.GetConfigurator().Apply(_shooterMotorConfig);

  _shooterMotor1.GetClosedLoopReference().SetUpdateFrequency(100_Hz);
  _shooterMotor1.GetStatorCurrent().SetUpdateFrequency(100_Hz);

  _shooterMotor2.GetClosedLoopReference().SetUpdateFrequency(100_Hz);
  _shooterMotor2.GetStatorCurrent().SetUpdateFrequency(100_Hz);

  _timeOfFlightTable.insert(1.37_m, 1.1_s);
  _timeOfFlightTable.insert(2.2_m, 1.23_s);
  _timeOfFlightTable.insert(3.145_m, 1.37_s);
  _timeOfFlightTable.insert(4.026_m, 1.31_s);
  _timeOfFlightTable.insert(4.68_m, 1.2_s);
  _timeOfFlightTable.insert(5.6_m, 1.35_s);
  _timeOfFlightTable.insert(7.6_m, 1.64_s);


  _flyWheelSpeedTableScoring.insert(1.37_m, 27_tps);
  _flyWheelSpeedTableScoring.insert(2.2_m, 30_tps);
  _flyWheelSpeedTableScoring.insert(3.145_m, 35_tps);
  _flyWheelSpeedTableScoring.insert(4.026_m, 35_tps);
  _flyWheelSpeedTableScoring.insert(4.68_m, 35_tps);
  _flyWheelSpeedTableScoring.insert(5.6_m, 41.5_tps);
  _flyWheelSpeedTableScoring.insert(7.6_m, 53.5_tps);

  _flyWheelSpeedTablePassing.insert(5_m, 40_tps);
  _flyWheelSpeedTablePassing.insert(6_m, 45_tps);
  _flyWheelSpeedTablePassing.insert(7_m, 50_tps);
  _flyWheelSpeedTablePassing.insert(8_m, 55_tps);
}

// This method will be called once per scheduler run
void SubShooter::Periodic() {
  auto loopStart = frc::GetTime();

  Logger::LogFalcon("Shooter/Motor1", _shooterMotor1);
  Logger::LogFalcon("Shooter/Motor2", _shooterMotor2);
  Logger::Log("Shooter/IsAtSpeed", IsAtSpeed());

  units::angle::degree_t motor1Position = _shooterMotor1.GetPosition().GetValue();
  RobotVisualisation::GetInstance()._shooterMechTopRoller.SetAngle(motor1Position);

  units::angle::degree_t motor2Position = _shooterMotor2.GetPosition().GetValue();
  RobotVisualisation::GetInstance()._shooterMechBottomRoller.SetAngle(motor2Position);

  units::celsius_t shooter1Temperature = _shooterMotor1.GetDeviceTemp().GetValue();
  units::ampere_t shooter1Current = _shooterMotor1.GetStatorCurrent().GetValue();

  AlertController::UpdateTemperatureAlert(_shooter1AlertConfig, shooter1Temperature);
  AlertController::UpdateCurrentAlert(_shooter1AlertConfig, shooter1Current);

  units::celsius_t shooter2Temperature = _shooterMotor2.GetDeviceTemp().GetValue();
  units::ampere_t shooter2Current = _shooterMotor2.GetStatorCurrent().GetValue();

  AlertController::UpdateTemperatureAlert(_shooter2AlertConfig, shooter2Temperature);
  AlertController::UpdateCurrentAlert(_shooter2AlertConfig, shooter2Current);

  Logger::Log("Shooter/Loop Time", (frc::GetTime() - loopStart));
}

void SubShooter::SimulationPeriodic() {
  auto& leftState = _shooterMotor1.GetSimState();
  leftState.SetSupplyVoltage(12.0_V);

  _leftFlywheelSim.SetInputVoltage(leftState.GetMotorVoltage());
  _leftFlywheelSim.Update(20_ms);

  leftState.SetRotorVelocity(_leftFlywheelSim.GetAngularVelocity());
  leftState.SetRotorAcceleration(_leftFlywheelSim.GetAngularAcceleration());
  leftState.AddRotorPosition(_leftFlywheelSim.GetAngularVelocity() * 20_ms);

  auto& rightState = _shooterMotor2.GetSimState();
  rightState.SetSupplyVoltage(12.0_V);

  _rightFlywheelSim.SetInputVoltage(rightState.GetMotorVoltage());
  _rightFlywheelSim.Update(20_ms);

  rightState.SetRotorVelocity(_rightFlywheelSim.GetAngularVelocity());
  rightState.SetRotorAcceleration(_rightFlywheelSim.GetAngularAcceleration());
  rightState.AddRotorPosition(_rightFlywheelSim.GetAngularVelocity() * 20_ms);
}

frc2::CommandPtr SubShooter::SetShooterTarget(std::function<units::turns_per_second_t()> speed) {
  return Run(
    [this, speed] { _shooterMotor1.SetControl(_flywheelTargetVelocity.WithVelocity(speed())); });
}

frc2::CommandPtr SubShooter::StopShooter() {
  return RunOnce(
    [this] { _shooterMotor1.SetControl(_flywheelTargetVelocity.WithVelocity(0_tps)); });
}

frc2::CommandPtr SubShooter::SpinShooterSlowly() {
    return Run([this] {_shooterMotor1.SetControl(_flywheelTargetVelocity.WithVelocity(10_tps));});
}

frc2::CommandPtr SubShooter::AdjustManualSpeedOffset(units::turns_per_second_t offset) {
  // Using frc2 cmd so we dont require subsystem
  return frc2::cmd::RunOnce([this, offset] {
    units::turns_per_second_t oldOffset = Logger::Tune("Shooter/Speed Manual Offset", DEFAULT_SHOOTER_OFFSET);
    units::turns_per_second_t newOffset = oldOffset + offset;
    Logger::Log("Shooter/Speed Manual Offset", newOffset);
  });
}

bool SubShooter::IsAtSpeed() {
  return units::math::abs(_shooterMotor1.GetVelocity().GetValue() - _flywheelTargetVelocity.Velocity) < 4.0_tps &&
  units::math::abs(_shooterMotor2.GetVelocity().GetValue() - _flywheelTargetVelocity.Velocity) < 4.0_tps;
}

frc2::CommandPtr SubShooter::SpinWithDistance(
  std::function<units::meter_t()> distance, std::function<bool()> isPassing) {
  return SetShooterTarget([this, distance, isPassing] { 
    auto offset = Logger::Tune("Shooter/Speed Manual Offset", DEFAULT_SHOOTER_OFFSET);
    return isPassing() ? _flyWheelSpeedTablePassing[distance()]
                       : _flyWheelSpeedTableScoring[distance()] + offset;
  });
}

units::turns_per_second_t SubShooter::GetShooterOffset(){
  return Logger::Tune("Shooter/Speed Manual Offset", DEFAULT_SHOOTER_OFFSET);
}

units::second_t SubShooter::GetTimeOfFLightWithDistance(units::meter_t distance) {
  return _timeOfFlightTable[distance];
}
