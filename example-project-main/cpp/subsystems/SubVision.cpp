// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

#include "subsystems/SubVision.h"
#include "subsystems/SubDrivebase.h"
#include <frc/smartdashboard/SmartDashboard.h>
#include <frc/DriverStation.h>
#include <frc/RobotBase.h>
#include <photon/estimation/CameraTargetRelation.h>
#include <frc/MathUtil.h>
#include "utilities/PoseHandler.h"
#include "utilities/Logger.h"


SubVision::SubVision() {

   // Set dev table for distance based deviance
  _devTable.insert(0_m, 0);
  _devTable.insert(0.71_m, 0.002);
  _devTable.insert(1_m, 0.006);
  _devTable.insert(1.5_m, 0.02);
  _devTable.insert(2_m, 0.068);
  _devTable.insert(3_m, 0.060);
  _devTable.insert(4_m, 0.330);
  _devTable.insert(5_m, 0.850);

  // Sim set up
  _visionSim.AddAprilTags(_tagMap);

  for (ICCamera* cam : _camList) {
    _visionSim.AddCamera(cam->GetCamSim(), cam->GetBotToCam());
  }

  // Display tags on field
  for (auto target : _visionSim.GetVisionTargets()) {
     Logger::FieldDisplay::GetInstance().DisplayPose(fmt::format("tag{}", target.fiducialId),
                                            target.GetPose().ToPose2d());
  }
}

void SubVision::Periodic() {
  auto loopStart = frc::GetTime();
  UpdateVision();

  Logger::Log("Vision/Loop Time", (frc::GetTime() - loopStart));
}

void SubVision::UpdateVision() {
  for (ICCamera* cam : _camList) {
    cam->Update();
  }
}

void SubVision::SimulationPeriodic() {
  _visionSim.Update(PoseHandler::GetInstance().GetSimPose());
}

std::map<std::string, std::optional<photon::EstimatedRobotPose>> SubVision::GetPose() {
  std::map<std::string, std::optional<photon::EstimatedRobotPose>> poses = {};
  for (ICCamera* cam : _camList) {
    poses.insert({cam->GetCamName(), cam->GetLatestEstPose()});
  }
  return poses;
}

double SubVision::GetDev(units::length::meter_t distance) {
  return _devTable[distance];
}

units::length::meter_t SubVision::GetAvgDistanceFromCamera(photon::EstimatedRobotPose est) {
  units::meter_t distance = 0_m;
  if (est.targetsUsed.size() == 0) {
    return 0_m;
  }
  for (auto target : est.targetsUsed) {
    distance += target.GetBestCameraToTarget().Translation().Norm();
  }
  distance /= est.targetsUsed.size();

  return distance;
}

bool SubVision::IsEstimateUsable(photon::EstimatedRobotPose est) {
  return ((GetAvgDistanceFromCamera(est) < 5_m) || (est.targetsUsed.size() > 1));
}

std::optional<frc::Pose2d> SubVision::GetAprilTagPose(int id) {
  auto pose = _tagMap.GetTagPose(id);
  if (pose.has_value()) {
    return pose.value().ToPose2d();
  } else {
    return std::nullopt;
  }
}

int SubVision::GetClosestTag(frc::Pose2d currentPose){
  int closestTagID = 0;
  units::length::meter_t closestDistance;
  std::vector<frc::AprilTag> tagList = _tagMap.GetTags();

   for (const frc::AprilTag tag : tagList) {
    int id = tag.ID;
    auto distance = currentPose.Translation().Distance(GetAprilTagPose(id).value().Translation());
    if (closestTagID == 0 || distance < closestDistance) {
      closestDistance = distance;
      closestTagID = id;
    }
  }

  return closestTagID;
}