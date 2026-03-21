#pragma once

#include <frc/geometry/Pose2d.h>
#include <frc/estimator/SwerveDrivePoseEstimator.h>
#include "subsystems/SubDrivebase.h"
#include "DrivebaseConfig.h"


class PoseHandler {
 public:
  PoseHandler();

  static PoseHandler& GetInstance() {
    static PoseHandler inst;
    return inst;
  }

  // Getters
  frc::Pose2d GetPose();
  frc::Pose2d GetSimPose();

  // Setters
  void Update(frc::Rotation2d angle, wpi::array<frc::SwerveModulePosition, 4U> states);
  void SetPose(frc::Pose2d pose, wpi::array<frc::SwerveModulePosition, 4U> states);
  void UpdateSim(frc::Rotation2d angle, wpi::array<frc::SwerveModulePosition, 4U> states, bool resetHeading = false, frc::Rotation2d heading = 0_deg);
  void AddVisionMeasurement(frc::Pose2d pose, units::second_t timeStamp, wpi::array<double,3> dev);

 private:

  frc::SwerveDriveKinematics<4> _kinematics {
      DrivebaseConfig::FL_POSITION,
      DrivebaseConfig::FR_POSITION,
      DrivebaseConfig::BL_POSITION,
      DrivebaseConfig::BR_POSITION
    };

  frc::SwerveDrivePoseEstimator<4> _poseEstimator {
    _kinematics,
    0_deg,
    {frc::SwerveModulePosition{0_m, 0_deg},
    frc::SwerveModulePosition{0_m, 0_deg},
    frc::SwerveModulePosition{0_m, 0_deg},
    frc::SwerveModulePosition{0_m, 0_deg}},
    frc::Pose2d()};

  frc::SwerveDrivePoseEstimator<4> _simPoseEstimator {
    _kinematics,
    0_deg,
    {frc::SwerveModulePosition{0_m, 0_deg},
    frc::SwerveModulePosition{0_m, 0_deg},
    frc::SwerveModulePosition{0_m, 0_deg},
    frc::SwerveModulePosition{0_m, 0_deg}},
    frc::Pose2d()};
};