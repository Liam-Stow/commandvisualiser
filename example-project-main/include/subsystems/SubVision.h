
// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

#pragma once

#include <frc2/command/SubsystemBase.h>
#include <frc/geometry/Pose3d.h>
#include <frc/geometry/Transform3d.h>
#include <frc/apriltag/AprilTagFieldLayout.h>
#include <frc/apriltag/AprilTagFields.h>
#include <photon/PhotonCamera.h>
#include <photon/simulation/VisionSystemSim.h>
#include <photon/PhotonPoseEstimator.h>
#include <frc/Filesystem.h>
#include <wpi/interpolating_map.h>
#include "utilities/ICCamera.h"

class SubVision : public frc2::SubsystemBase {
public:
  SubVision();
  static SubVision& GetInstance() {
    static SubVision inst;
    return inst;
  }

  void Periodic() override;

  void UpdateVision();

  void StableCameraProcess();

  void TurretCameraProcess();

  void SimulationPeriodic() override;

  enum Side {
    Left = 1,
    Right = 2
  };

  std::optional<frc::Pose2d> GetAprilTagPose(int id);

  std::map<std::string, std::optional<photon::EstimatedRobotPose>> GetPose();

  int GetClosestTag(frc::Pose2d currentPose);

  units::length::meter_t GetAvgDistanceFromCamera(photon::EstimatedRobotPose est);

  bool IsEstimateUsable(photon::EstimatedRobotPose est);

  double GetDev(units::length::meter_t distance);

  static constexpr frc::Transform2d TURRET_TO_CAM = frc::Transform2d{-40.629_mm, 151.5_mm, 0_deg};

  const std::string TURRET_CAM_NAME = "Turret";
  const std::string LEFT_CAM_NAME = "left";
  const std::string RIGHT_CAM_NAME = "right";

 private:

  //Create field layout
  std::string _tagMapFilePath = frc::filesystem::GetDeployDirectory() + "/2026-rebuilt.json";
  frc::AprilTagFieldLayout _tagMap{_tagMapFilePath};

  frc::Transform3d _leftBotToCam{{-295.779_mm,252.927_mm,320.249_mm},{0_deg,-30_deg, 90_deg}};

  ICCamera _leftCam {
    LEFT_CAM_NAME,
    _leftBotToCam,
    _tagMap
  };

  frc::Transform3d _rightBotToCam{{69.480_mm,-312.197_mm,311.090_mm},{0_deg,-25.61_deg,-90_deg}};

  ICCamera _rightCam {
    RIGHT_CAM_NAME,
    _rightBotToCam,
    _tagMap
  };

  
  // x and y offset is taken from subturret.h turret offset
  frc::Transform3d _turretBotToCam {{0_m, 0_m, 335_mm + 112.768_mm}, {0_deg, -20_deg, 0_deg}}; // positive pitch is down
  // 335mm from robot to turret, 112.768mm from turret to cam

  ICCamera _turretCam {
    TURRET_CAM_NAME,    
    _turretBotToCam,
    _tagMap
  };

  std::vector<ICCamera*> _camList {
    &_leftCam,
    &_rightCam,
    &_turretCam
  };

  photon::VisionSystemSim _visionSim{"VisionSim"};

  //Deviation table for further distances from tag
  wpi::interpolating_map<units::meter_t, double> _devTable;
};


// Link to photon vision
// http://static-camera-pi.local:5800/ or http://10.55.84.11:5800 for left and right camera
// http://turret-camera-pi.local:5800/ or http://10.55.84.12:5800 for turret camera