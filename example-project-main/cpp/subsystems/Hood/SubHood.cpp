// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

#include "subsystems/Hood/SubHood.h"

#include "subsystems/Hood/HoodKrakenIO.h"
#include "subsystems/Hood/HoodNeoIO.h"

#include "utilities/BotVars.h"
#include "utilities/Logger.h"

#include "frc/RobotBase.h"
#include "frc/smartdashboard/SmartDashboard.h"

#include "utilities/RobotVisualisation.h"

SubHood::SubHood() {
  if (BotVars::GetRobot() == BotVars::PRACTICE) {
    _hoodMotor = std::make_unique<HoodNeoIO>(canid::HOOD_MOTOR);
  } else {
    _hoodMotor = std::make_unique<HoodKrakenIO>(canid::HOOD_MOTOR);
  }

  _hoodPitchTable.insert(1.37_m, 17.2_deg);
  _hoodPitchTable.insert(2.2_m, 21.18_deg);
  _hoodPitchTable.insert(3.145_m, 26.19_deg);
  _hoodPitchTable.insert(4.026_m, 30.1_deg);
  _hoodPitchTable.insert(4.68_m, 38.2_deg);
  _hoodPitchTable.insert(5.6_m, 37.2_deg);
  _hoodPitchTable.insert(7.6_m, 38.2_deg);

  _hoodMotor->ConfigMotor();
}

// This method will be called once per scheduler run
void SubHood::Periodic() {
  auto loopStart = frc::GetTime();
  units::celsius_t hoodTemperature = _hoodMotor->GetTemperature();
  units::ampere_t hoodCurrent = _hoodMotor->GetCurrent();

  AlertController::UpdateTemperatureAlert(_hoodAlertConfig, hoodTemperature);
  AlertController::UpdateCurrentAlert(_hoodAlertConfig, hoodCurrent);

  RobotVisualisation::GetInstance()._hoodMechCircle.SetAngle(_hoodMotor->GetPosition());
  if (_hasZeroed == false && _zeroing == false) {
    _hoodMotor->StopMotor();
  }

  Logger::Log("Hood/haszeroed", _hasZeroed);
  Logger::Log("Hood/zeroing", _zeroing);
  Logger::Log("Hood/IsAtTarget", HoodIsAtTarget());
  
  _hoodMotor->Log("Hood/Motor");
  
  Logger::Log("Hood/Loop Time", (frc::GetTime() - loopStart));
}

void SubHood::SimulationPeriodic() {
  _hoodSim.SetInputVoltage(_hoodMotor->CalcSimVoltage());
  _hoodSim.Update(20_ms);
  _hoodMotor->IterateSim(_hoodSim.GetVelocity(), _hoodSim.GetAngle());
}

frc2::CommandPtr SubHood::SetHoodPositionTarget(std::function<units::degree_t()> angle) {
    return Run([this, angle] {
    units::degree_t target = angle();

    if (target > UPPER_LIMIT) {
      target = UPPER_LIMIT;
    }

    if (target < LOWER_LIMIT) {
      target = LOWER_LIMIT;
    }

    if (_hasZeroed) {
      _hoodMotor->SetPositionTarget(target);
    }
    
  });
}

frc2::CommandPtr SubHood::ZeroHood() {
  return RunOnce([this] { _zeroing = true; })
    .AndThen(ManualHoodDown())
    .Until([this] { return (HoodCurrentCheck());})
    .AndThen([this] { _hoodMotor->SetPosition(LOWER_LIMIT); })
    .FinallyDo([this] {
      _hoodMotor->StopMotor();
      _hoodMotor->SetPositionTarget(LOWER_LIMIT);
      _zeroing = false;
    });
}

bool SubHood::HoodCurrentCheck() {
  _hasZeroed = false;
  if (units::math::abs(GetHoodMotorCurrent()) > zeroingCurrentLimit || frc::RobotBase::IsSimulation()) {
    _hasZeroed = true;
    return true;
  }

  return false;
}

units::ampere_t SubHood::GetHoodMotorCurrent() {
  return _hoodMotor->GetCurrent();
}

units::degree_t SubHood::GetHoodOffset(){
  return Logger::Tune("Hood/Angle Manual Offset", DEFAULT_HOOD_OFFSET);
}

frc2::CommandPtr SubHood::StowHood() {
  return RunOnce([this] { _hoodMotor->SetPositionTarget(STOW_ANGLE); });
}

frc2::CommandPtr SubHood::ManualHoodDown() {
  return StartEnd([this] { _hoodMotor->SetVoltage(-1_V); },
    [this] {
      auto targRot = _hoodMotor->GetPosition();
      _hoodMotor->SetPositionTarget(targRot);
    });
}

frc2::CommandPtr SubHood::SetHoodPositionTargetFromDist(
  std::function<units::meter_t()> distanceToTarget) {
  return SetHoodPositionTarget([this, distanceToTarget] {
    return _hoodPitchTable[distanceToTarget()] + Logger::Tune("Hood/Angle Manual Offset", DEFAULT_HOOD_OFFSET);
  });
}

frc2::CommandPtr SubHood::AdjustManualAngleOffset(units::degree_t offset) {
  // Using frc2 cmd so we dont require subsystem
  return frc2::cmd::RunOnce([offset] {
    units::degree_t oldOffset = Logger::Tune("Hood/Angle Manual Offset", DEFAULT_HOOD_OFFSET);
    units::degree_t newOffset = oldOffset + offset;
    Logger::Log("Hood/Angle Manual Offset", newOffset);
  });
}

bool SubHood::HoodIsAtTarget() {
  return units::math::abs(_hoodMotor->GetPositionError()) < 0.5_deg;
}

frc2::CommandPtr SubHood::MoveHoodUp1Degree() {
  return SetHoodPositionTarget([this] { return _hoodMotor->GetPositionTarget() + 1_deg; }).WithTimeout(1_ms);
}

frc2::CommandPtr SubHood::MoveHoodDown1Degree() {
  return SetHoodPositionTarget([this] { return _hoodMotor->GetPositionTarget() - 1_deg; }).WithTimeout(1_ms);
}

frc2::CommandPtr SubHood::HoodToEjectAngle() {
  return SubHood::GetInstance().SetHoodPositionTarget([] { return LOWER_LIMIT + 5_deg; });
}

void SubHood::SetBrakeMode(bool brakeMode){
  if (brakeMode == true){
    _hoodMotor->SetBrakeMode(true);
  }
  else {
    _hoodMotor->SetBrakeMode(false);
  }
}
