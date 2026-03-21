// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

#pragma once

#include <frc2/command/Command.h>
#include <units/length.h>
#include <frc2/command/button/CommandXboxController.h>

namespace cmd {
frc2::CommandPtr TeleopDrive(frc2::CommandXboxController& controller, double speedScaling = 1.0, double rotationScaling = 1.0);
}  // namespace cmd