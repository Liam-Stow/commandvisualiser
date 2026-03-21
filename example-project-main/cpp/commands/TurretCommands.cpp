#include "commands/TurretCommands.h"

#include "subsystems/SubDrivebase.h"
#include "subsystems/SubFeeder.h"
#include "subsystems/Hood/SubHood.h"
#include "subsystems/SubIndexer.h"
#include "subsystems/SubIntake.h"
#include "subsystems/SubShooter.h"
#include "subsystems/Turret/SubTurret.h"

#include "utilities/Logger.h"
#include "utilities/PoseHandler.h"
#include "utilities/FieldConstants.h"
#include "utilities/ShotPlanner.h"
#include "utilities/ICgeometry.h"

#include <frc2/command/CommandPtr.h>
#include <frc2/command/Commands.h>

#include <frc/geometry/Translation2d.h>

namespace cmd {

frc2::CommandPtr AimAtFieldRelative(std::function<units::degree_t()> target) {
  return frc2::cmd::RunOnce([target] { SubTurret::GetInstance().SetLastFieldRelativeTarget(target()); })
    .AndThen(SubTurret::GetInstance().SetTurretTargetAngle(
      [target] {
        auto robotPose = PoseHandler::GetInstance().GetPose();

        SubTurret::GetInstance().SetLastFieldRelativeTarget(target());
        Logger::Log("Turret/AimAtFieldRelative/robotPose/Rotation", robotPose.Rotation().Degrees());
        units::degree_t targetAngle = target() - robotPose.Rotation().Degrees();
        return targetAngle;
      },
      [target] {
        units::degrees_per_second_t desiredTurretAngVel;
        bool turretVelFF = Logger::Tune("Turret/AimAtFieldRelative/Turret Vel FF/TurretVelFFON", true);
        double turretVelFFScaling = Logger::Tune("Turret/AimAtFieldRelative/Turret Vel FF/turretVelFFScaling", 1.0);
        units::degree_t lastTurretTarget = SubTurret::GetInstance().GetLastFieldRelativeTarget();

        desiredTurretAngVel = -SubDrivebase::GetInstance().GetDesiredAngularVelocity();
        if(turretVelFF) {
          desiredTurretAngVel =
            (target() - lastTurretTarget)*turretVelFFScaling / 20_ms -
            SubDrivebase::GetInstance().GetDesiredAngularVelocity();
        }

        Logger::Log(
          "Turret/AimAtFieldRelative/Turret Vel FF/desiredTurretAngVel", desiredTurretAngVel);
        Logger::Log("Turret/AimAtFieldRelative/Turret Vel FF/new target", target());
        Logger::Log("Turret/AimAtFieldRelative/Turret Vel FF/last target", lastTurretTarget);
        return desiredTurretAngVel;
      }));
}

frc2::CommandPtr AimAtSpot(std::function<frc::Translation2d()> target) {
  return cmd::AimAtFieldRelative([target] {
    auto robotPose = PoseHandler::GetInstance().GetPose();
    units::radian_t angle =
      atan2((target().Y() - robotPose.Y()).value(), (target().X() - robotPose.X()).value()) * 1_rad;
    units::degree_t degrees = angle;
    return degrees;
  });
}

units::meter_t CalcShootOnTheMoveDistance() {
  auto target = GetShotTarget();

  frc::Pose2d futurePose = CalcFutureTurretPose();

  // Find distance from future turret pose to target
  units::meter_t futureDistance = target.Distance(futurePose.Translation());
  Logger::Log("SOTM/futureDistance", futureDistance);

  return futureDistance;
}

units::degree_t CalcShootOnTheMoveAngle() {
  auto target = GetShotTarget();
  frc::Pose2d futurePose = CalcFutureTurretPose();

  // Find angle from future turret pose to target
  auto futurePoseToTarget = target - futurePose.Translation();
  units::degree_t angleFromFutureToTarget = futurePoseToTarget.Angle().Degrees();

  Logger::Log("SOTM/CalcTurretAngle", angleFromFutureToTarget);
  return angleFromFutureToTarget;
}

frc::Pose2d CalcFutureTurretPose() {
  units::millisecond_t offset = Logger::Tune("SOTM/LatencyOffset", LATENCYOFFSET);
  // Calculate distance to target from robot(convert to turret later)
  auto target = GetShotTarget();
  auto robot = PoseHandler::GetInstance().GetPose();
  Logger::FieldDisplay::GetInstance().DisplayPose("SOTM/robotPose", robot);
  units::meter_t distance = target.Distance(robot.Translation());

  // Calculate field relative robot velocity
  frc::ChassisSpeeds robotVel = SubDrivebase::GetInstance().GetChassisSpeeds();
  units::meters_per_second_t robotVelX = robotVel.vx;
  units::meters_per_second_t robotVelY = robotVel.vy;
  units::degrees_per_second_t robotVelRot = SubDrivebase::GetInstance().GetDesiredAngularVelocity();

  // Account for latency
  frc::ChassisSpeeds robotRelativeVel = SubDrivebase::GetInstance().GetChassisSpeeds(false);
  units::meters_per_second_t robotRelativeVelX = robotRelativeVel.vx;
  units::meters_per_second_t robotRelativeVelY = robotRelativeVel.vy;
  
  frc::Transform2d latencyTransform = frc::Transform2d(robotRelativeVelX * offset, robotRelativeVelY * offset, robotVelRot * offset);
  robot = robot.TransformBy(latencyTransform);

  Logger::Log("SOTM/velX", robotVelX);
  Logger::Log("SOTM/velY", robotVelY);

  Logger::Log("SOTM/robotRelativeVelX", robotRelativeVelX);
  Logger::Log("SOTM/robotRelativeVelY", robotRelativeVelY);

  Logger::Log("SOTM/velRot", robotVelRot);

  units::second_t TOF;
  frc::Pose2d futurePose;

  for (int i = 0; i < 20; i++) {
    // Get future pose
    TOF = SubShooter::GetInstance().GetTimeOfFLightWithDistance(distance);
    Logger::Log("SOTM/TimeOfFlight", TOF);

    // calculate offset due to velocity
    units::meter_t offsetX = robotVelX * TOF;
    units::meter_t offsetY = robotVelY * TOF;
    units::degree_t robotRotation = robot.Rotation().Degrees();
    units::meter_t robotX = robot.X();
    units::meter_t robotY = robot.Y();

    Logger::Log("SOTM/robotX", robotX);
    Logger::Log("SOTM/robotY", robotY);
    Logger::Log("SOTM/robotRotation", robotRotation);

    Logger::Log("SOTM/offsetX", offsetX);
    Logger::Log("SOTM/offsetY", offsetY);

    // calculate future pose by adding offsets to current robot position
    futurePose =
      frc::Pose2d(robotX + offsetX, robotY + offsetY, robot.Rotation().Degrees());

    distance = target.Distance(futurePose.Translation());
  }

  Logger::FieldDisplay::GetInstance().DisplayPose("SOTM/futurePose", futurePose);

  // convert robot to turret pose
  frc::Pose2d turretFuturePose = futurePose.TransformBy(SubTurret::ROBOT_TO_TURRET);

  // Account for Robot Angular Velocity (Turret Whip)
  units::meter_t turretVelocityMagnitude = ( robotVelRot.value()/360 * 2 * 3.14159 * SubTurret::ROBOT_TO_TURRET.Translation().Norm() / 1_s ) * TOF;
  units::degree_t robotToTurretAngle = SubTurret::ROBOT_TO_TURRET.Translation().Angle().Degrees();
  units::degree_t turretVelocityDirection = robotToTurretAngle + 90_deg;
  frc::Translation2d turretVelocity = frc::Translation2d{ turretVelocityMagnitude, turretVelocityDirection };
  frc::Transform2d turretVelocityTransform = frc::Transform2d{ turretVelocity, 0_deg};

  turretFuturePose = turretFuturePose.TransformBy(turretVelocityTransform);

  Logger::Log("SOTM/Turret Velocity (Turret Whip)", turretVelocityMagnitude);
  Logger::Log("SOTM/Turret Velocity Direction (Turret Whip Direction)", turretVelocityDirection);
  Logger::FieldDisplay::GetInstance().DisplayPose("SOTM/futureTurretPose", turretFuturePose);

  return turretFuturePose;
}

frc::Translation2d GetShotTarget(){
  auto curPose = PoseHandler::GetInstance().GetPose();
  return ShotPlanner::CalculateShotTarget(curPose).targetPosition.ToTranslation2d();
}

frc2::CommandPtr AimAtHub() {
return AimAtSpot([] {
  frc::Translation3d target = fieldpos::HUB_POSITION;
  if(frc::DriverStation::GetAlliance().value_or(frc::DriverStation::kBlue) == frc::DriverStation::kRed) { target = ICgeometry::xTranslationFlip(target); }
  Logger::FieldDisplay::GetInstance().DisplayPose("AimAtHub/target", frc::Pose2d{target.ToTranslation2d(), 0_deg});
  return target.ToTranslation2d();
});
}

}  // namespace cmd
