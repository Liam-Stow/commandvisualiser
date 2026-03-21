// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

#include "subsystems/SubFeeder.h"

#include <units/current.h>
#include "utilities/Logger.h"
#include "utilities/RobotVisualisation.h"

SubFeeder::SubFeeder() {
  _feederMotorConfig.SmartCurrentLimit(40);
  _feederMotorConfig.SetIdleMode(rev::spark::SparkBaseConfig::IdleMode::kBrake);
  _feederMotorConfig.Inverted(true);
  _feederMotorConfig.closedLoop.Pid(P, I, D);
  _feederMotorConfig.closedLoop.feedForward.kV(F);
  _feederMotor.OverwriteConfig(_feederMotorConfig);
  Logger::Log("Feeder/Feeder Motor", &_feederMotor);
}

frc2::CommandPtr SubFeeder::Feed() {
  return StartEnd([this] { _feederMotor.SetVelocityTarget(100_tps); }, [this] { _feederMotor.Set(0); });
};

frc2::CommandPtr SubFeeder::FeedBackwards() {
  return StartEnd([this] { _feederMotor.SetVelocityTarget(-50_tps); }, [this] { _feederMotor.Set(0); });
}

frc2::CommandPtr SubFeeder::FeederOn() {
  return RunOnce([this] { _feederMotor.SetVelocityTarget(100_tps); });
};

frc2::CommandPtr SubFeeder::FeederOff() {
  return RunOnce([this] { _feederMotor.Set(0); });
}

// This method will be called once per scheduler run
void SubFeeder::Periodic() {
  auto loopStart = frc::GetTime();
  units::celsius_t feederTemperature = _feederMotor.GetTemperature();
  units::ampere_t feederCurrent = _feederMotor.GetStatorCurrent();
  AlertController::UpdateTemperatureAlert(_feederAlertConfig, feederTemperature);
  AlertController::UpdateCurrentAlert(_feederAlertConfig, feederCurrent);

  RobotVisualisation::GetInstance()._feederMechTopWheel.SetAngle(_feederMotor.GetPosition());
  RobotVisualisation::GetInstance()._feederMechBottomWheel.SetAngle(_feederMotor.GetPosition());

  Logger::Log("Feeder/Loop Time", (frc::GetTime() - loopStart));
}

void SubFeeder::SimulationPeriodic() {
  _sim.SetInputVoltage(_feederMotor.CalcSimVoltage());
  _sim.Update(20_ms);
  _feederMotor.IterateSim(_sim.GetAngularVelocity());
}
