// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

#include "commands/DriveCommands.h"
#include "commands/FuelCommands.h"
#include <frc2/command/Commands.h>
#include "subsystems/SubDrivebase.h"
#include "subsystems/SubVision.h"
#include <frc/DriverStation.h>

namespace cmd {
using namespace frc2::cmd;

frc2::CommandPtr TeleopDrive(frc2::CommandXboxController& controller, double speedScaling, double rotationScaling) {
  return SubDrivebase::GetInstance().Drive([&controller, speedScaling, rotationScaling] {
    auto speeds = SubDrivebase::GetInstance().CalcJoystickSpeeds(controller);
    speeds.vx *= speedScaling;
    speeds.vy *= speedScaling;
    speeds.omega *= rotationScaling;
    return frc::ChassisSpeeds{speeds.vx, speeds.vy, speeds.omega};
  }, true);
}
}  // namespace cmd
