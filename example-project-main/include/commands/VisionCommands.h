// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

#pragma once

#include <frc2/command/Commands.h>
#include <photon/PhotonPoseEstimator.h>

struct ProcessedPose {
    std::string camName;
    frc::Pose2d pose;
    units::time::second_t timestamp;
    units::length::meter_t distance;
};

namespace cmd {
frc2::CommandPtr AddVisionMeasurement();
}