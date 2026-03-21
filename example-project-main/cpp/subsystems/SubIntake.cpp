// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

#include "subsystems/SubIntake.h"

#include "utilities/RobotVisualisation.h"

#include <units/current.h>
#include <utilities/Logger.h>

SubIntake::SubIntake() {
  _intakeMotorConfig.SmartCurrentLimit(60);
  _intakeMotorConfig.Inverted(true);
  _intakeMotor.OverwriteConfig(_intakeMotorConfig);

  Logger::Log("Intake/Intake Motor", &_intakeMotor);

  _intakeFollowerMotorConfig.SmartCurrentLimit(60);
  _intakeFollowerMotorConfig.Inverted(true);
  _intakeFollowerMotorConfig.Follow(_intakeMotor, true);
  _intakeFollowerMotor.OverwriteConfig(_intakeFollowerMotorConfig);

  Logger::Log("Intake/Follower Intake Motor", &_intakeFollowerMotor);
}

frc2::CommandPtr SubIntake::IntakeOn() {
  return StartEnd([this] { _intakeMotor.Set(1.0); }, [this] { _intakeMotor.Set(0); });
}

frc2::CommandPtr SubIntake::IntakeOff() {
  return RunOnce([this] { _intakeMotor.Set(0); });
}

frc2::CommandPtr SubIntake::ReverseIntake() {
  return StartEnd([this] { _intakeMotor.Set(-1.0); }, [this] { _intakeMotor.Set(0); });
}

// This method will be called once per scheduler run
void SubIntake::Periodic() {
  auto loopStart = frc::GetTime();
  units::celsius_t intakeTemperature = _intakeMotor.GetTemperature();

  units::ampere_t intakeCurrent = _intakeMotor.GetStatorCurrent();

  AlertController::UpdateTemperatureAlert(_intakeAlertConfig, intakeTemperature);
  AlertController::UpdateCurrentAlert(_intakeAlertConfig, intakeCurrent);

  RobotVisualisation::GetInstance()._intakeWheel.SetAngle(_intakeMotor.GetPosition());

  Logger::Log("Intake/Loop Time", (frc::GetTime() - loopStart));
}

void SubIntake::SimulationPeriodic() {
  _sim.SetInputVoltage(_intakeMotor.CalcSimVoltage());
  _sim.Update(20_ms);
  _intakeMotor.IterateSim(_sim.GetAngularVelocity());
}
