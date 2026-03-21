// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

#include "utilities/ShotPlanner.h"

#include "utilities/FieldConstants.h"
#include "utilities/ShiftHandler.h"

#include <utilities/ICgeometry.h>
#include <utilities/Logger.h>

ShotPlanner::ShotPlanner(){
    Logger::Log("Shot Planner/override status", _overrideStatus);
}

ShotPlanner::ShotPlannerResults ShotPlanner::CalculateShotTarget(frc::Pose2d robotPos) {
  auto alliance = frc::DriverStation::GetAlliance();
  if (alliance) {
    if (alliance.value() == frc::DriverStation::kRed) {
      robotPos = ICgeometry::xPoseFlip(robotPos);
    }
    Logger::FieldDisplay::GetInstance().DisplayPose("Shot Planner/Robot Position", robotPos);
  }

  frc::Translation3d target;
  bool isPassing = false;
  bool shouldShoot = true;
  bool isOurHubActive = ShiftHandler::GetInstance().IsActiveShift();

  bool isInTopHalf = IsInTopHalf(robotPos);
  bool isInAllianceZone = IsInAllianceZone(robotPos);

  Logger::Log("Shot Planner/Is Top Half", isInTopHalf);
  Logger::Log("Shot Planner/Is Alliance Zone", isInAllianceZone);

  if (isInAllianceZone && isOurHubActive){
    target = fieldpos::HUB_POSITION;
    shouldShoot = true;
    isPassing = false;
  }
  if (isInAllianceZone && !isOurHubActive){
    target = fieldpos::HUB_POSITION;
    shouldShoot = false;
    isPassing = false;
  }
  if (!isInAllianceZone && isInTopHalf){
    target = fieldpos::BOTTOM_ALLIANCE_ZONE_POSITION;
    shouldShoot = true;
    isPassing = true;
  }
  if (!isInAllianceZone && !isInTopHalf){
    target = fieldpos::TOP_ALLIANCE_ZONE_POSITION;
    shouldShoot = true;
    isPassing = true;
  }

  //Manual overrides, defaults to not using
  if (_overrideStatus == Override::PASS && isInTopHalf){
    target = fieldpos::BOTTOM_ALLIANCE_ZONE_POSITION;
    shouldShoot = true;
    isPassing = true;
  }
  if (_overrideStatus == Override::PASS && !isInTopHalf){
    target = fieldpos::TOP_ALLIANCE_ZONE_POSITION;
    shouldShoot = true;
    isPassing = true;
  }
  if (_overrideStatus == Override::SCORE){
    target = fieldpos::HUB_POSITION;
    shouldShoot = true;
    isPassing = false;
  }

    if (alliance) {
      if (alliance.value() == frc::DriverStation::Alliance::kRed) {
        target = ICgeometry::xTranslationFlip(target);
      }
    }

  return {target, shouldShoot, isPassing};
}

bool ShotPlanner::IsWithinZone(
  frc::Translation2d topRightCorner, frc::Translation2d bottomLeftCorner, frc::Pose2d robotPos) {
  if (robotPos.X() < topRightCorner.X() && robotPos.X() > bottomLeftCorner.X()) {
    if (robotPos.Y() < topRightCorner.Y() && robotPos.Y() > bottomLeftCorner.Y()) {
      return true;
    }
  }
  return false;
}

bool ShotPlanner::IsInTopHalf(frc::Pose2d robotPos) {
  if (robotPos.Y() < 4_m) {
    return true;
  }
  return false;
}

bool ShotPlanner::IsInAllianceZone(frc::Pose2d robotPos){
  if (robotPos.X() < fieldpos::BLUE_ALLIANCE_ZONE_TOP_RIGHT.X()){
    return true;
  }
  return false;
}

frc::Pose2d ShotPlanner::ConvertToPose2d(frc::Translation3d translation3d) {
  frc::Translation2d translation2d = translation3d.ToTranslation2d();
  frc::Pose2d targetPose{translation2d, 0_deg};
  return targetPose;
}

void ShotPlanner::SetOverride(Override override){
  _overrideStatus = override;
  Logger::Log("Shot Planner/override status", _overrideStatus);
}

bool ShotPlanner::GetOverrideEnabled(){
  if (_overrideStatus != Override::NONE){
    return true;
  }
  return false;
}
