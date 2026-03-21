#include "commands/FuelCommands.h"

#include "subsystems/SubDeploy.h"
#include "subsystems/SubFeeder.h"
#include "subsystems/Hood/SubHood.h"
#include "subsystems/SubIndexer.h"
#include "subsystems/SubIntake.h"
#include "subsystems/SubShooter.h"
#include "subsystems/Turret/SubTurret.h"
#include "utilities/Logger.h"
#include "utilities/ShotPlanner.h"
#include "utilities/ShiftHandler.h"
#include "utilities/FieldConstants.h"
#include "utilities/ICgeometry.h"

#include "commands/TurretCommands.h"

#include "utilities/PoseHandler.h"
#include <frc/geometry/Transform2d.h>

namespace cmd {

bool forcingShoot = false;  // whether to override subsystem tolerance checks and force shooting

frc2::CommandPtr IntakeSequence() {
  return SubDeploy::GetInstance()
    .DeployIntake()
    .AlongWith(SubIntake::GetInstance().IntakeOn());
}

frc2::CommandPtr OuttakeSequence() {
  return SubDeploy::GetInstance()
    .DeployIntake()
    .AlongWith(SubIntake::GetInstance().ReverseIntake());
}

frc2::CommandPtr StationaryShootAt(frc::Translation2d target) {
  auto distanceToTarget = [target] {
    auto curPose = PoseHandler::GetInstance().GetPose();
    auto turretPose = curPose.TransformBy(SubTurret::ROBOT_TO_TURRET);

    Logger::FieldDisplay::GetInstance().DisplayPose("Turret/turretPose", turretPose);
    Logger::Log("Shooter/distToTargetInner", target.Distance(turretPose.Translation()));

    return target.Distance(turretPose.Translation());};

  return frc2::cmd::Parallel(cmd::AimAtSpot([target] { return target; }),
    SubShooter::GetInstance().SpinWithDistance(distanceToTarget, []{return ShotPlanner::CalculateShotTarget(PoseHandler::GetInstance().GetPose()).isPassing;}),
    SubHood::GetInstance().SetHoodPositionTargetFromDist(distanceToTarget))
    .Until([] {
      return SubShooter::GetInstance().IsAtSpeed() && SubTurret::GetInstance().IsAtTarget() &&
             SubHood::GetInstance().HoodIsAtTarget();
    })
    .AndThen(frc2::cmd::Parallel(SubIntake::GetInstance().IntakeOn(),
      SubFeeder::GetInstance().FeederOn(), SubIndexer::GetInstance().Index()));
}

frc2::CommandPtr BackupShoot() {
  return SubShooter::GetInstance()
    .SetShooterTarget([] {
      units::turns_per_second_t offset = SubShooter::GetInstance().GetShooterOffset();
      return offset + 31_tps;
    })
    .AlongWith(
      SubTurret::GetInstance().SetTurretTargetAngle([] { return 0_deg; }, [] { return 0_tps; }))
    .AlongWith(SubHood::GetInstance().SetHoodPositionTarget([] {
      units::degree_t offset = SubHood::GetInstance().GetHoodOffset();
      return offset + 0.093056_tr;
    }))
    .AlongWith(ShootWhenReady());
}

frc2::CommandPtr ShootWhenReady() {
  return frc2::cmd::WaitUntil([] { return IsReadyToShoot(); })
    .AndThen(SubFeeder::GetInstance().Feed().AlongWith(SubIndexer::GetInstance().Index()).Until([] {
      return !IsReadyToShoot();
    })).Repeatedly();
};

bool IsReadyToShoot() {
  auto currentPose = PoseHandler::GetInstance().GetPose();
  
  if(forcingShoot) { return true; }

  return SubHood::GetInstance().HoodIsAtTarget() && SubShooter::GetInstance().IsAtSpeed() &&
        SubTurret::GetInstance().IsAtTarget() &&
        ShotPlanner::CalculateShotTarget(currentPose).shouldShoot &&
        SubTurret::GetInstance().IsNotApproachingMax([] { return LATENCYOFFSET; });
}

frc2::CommandPtr AimOnTheMove() {
  return SubShooter::GetInstance()
    .SpinWithDistance([] { return CalcShootOnTheMoveDistance(); },
      [] {
        return ShotPlanner::CalculateShotTarget(PoseHandler::GetInstance().GetPose()).isPassing;
      })
    .AlongWith(frc2::cmd::Either(
      SubHood::GetInstance().SetHoodPositionTarget([] { return SubHood::PASSING_ANGLE; }),
      SubHood::GetInstance().SetHoodPositionTargetFromDist(
        [] { return CalcShootOnTheMoveDistance();}),
      []{return ShotPlanner::CalculateShotTarget(PoseHandler::GetInstance().GetPose()).isPassing;}))
    .AlongWith(AimAtFieldRelative([] { return CalcShootOnTheMoveAngle(); }));
}

frc2::CommandPtr ShootOnTheMove(){
  return AimOnTheMove().AlongWith(ShootWhenReady());
}

frc2::CommandPtr ShootOnTheMoveWithoutTurret(frc2::CommandXboxController& controller) {
  return AimOnTheMoveWithoutTurret(controller).AlongWith(ShootWhenReady());
}

frc2::CommandPtr AimOnTheMoveWithoutTurret(frc2::CommandXboxController& controller) {
  return SubShooter::GetInstance()
    .SpinWithDistance([] { return CalcShootOnTheMoveDistance(); },
      [] {
        return ShotPlanner::CalculateShotTarget(PoseHandler::GetInstance().GetPose()).isPassing;
      })
    .AlongWith(frc2::cmd::Either(
      SubHood::GetInstance().SetHoodPositionTarget([] { return SubHood::PASSING_ANGLE; }),
      SubHood::GetInstance().SetHoodPositionTargetFromDist(
        [] { return CalcShootOnTheMoveDistance();}),
      []{return ShotPlanner::CalculateShotTarget(PoseHandler::GetInstance().GetPose()).isPassing;}))
    .AlongWith(SubDrivebase::GetInstance().AlignToAngle(controller, [] { return CalcShootOnTheMoveAngle() - SubTurret::GetInstance().GetTurretAngle(); }));  
}

frc2::CommandPtr ToggleBrakeCoast(){
  return frc2::cmd::StartEnd(
    []{
    SubDrivebase::GetInstance().SetBrakeMode(false);
    SubDeploy::GetInstance().SetBrakeMode(false);
    SubTurret::GetInstance().SetBrakeMode(false);
    SubHood::GetInstance().SetBrakeMode(false);
  }
  ,
  []{
    SubDrivebase::GetInstance().SetBrakeMode(true);
    SubDeploy::GetInstance().SetBrakeMode(true);
    SubTurret::GetInstance().SetBrakeMode(true);
    SubHood::GetInstance().SetBrakeMode(true);
    }
  )
  .IgnoringDisable(true)
  .Until([]{return frc::DriverStation::IsEnabled();});
}

frc2::CommandPtr EjectFuel() {
  return SubShooter::GetInstance().SpinShooterSlowly()
  .AlongWith(SubIntake::GetInstance().ReverseIntake())
  .AlongWith(SubIndexer::GetInstance().Index())
  .AlongWith(SubFeeder::GetInstance().Feed())
  .AlongWith(SubTurret::GetInstance().SetTurretTargetAngle([] { return 180_deg; }, []{return 0_deg_per_s;})) // point turret out of robot
  .AlongWith(SubHood::GetInstance().HoodToEjectAngle()); 
}

frc2::CommandPtr DisableAllOverrides() {
  return frc2::cmd::RunOnce([] {
    ShotPlanner::SetOverride(ShotPlanner::Override::NONE);
    ShiftHandler::GetInstance().SetOverrideActive(false);
    forcingShoot = false;
    SubTurret::GetInstance().UnlockTurret();
    Logger::Log("ForceShoot/forcingShoot", forcingShoot);
  });
}

frc2::CommandPtr ForceShoot() {
  return frc2::cmd::RunOnce([] {
    forcingShoot = true;
    Logger::Log("ForceShoot/forcingShoot", forcingShoot);
  });
}

}  // namespace cmd