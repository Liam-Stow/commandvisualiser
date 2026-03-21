// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

#include "RobotContainer.h"

#include "subsystems/Hood/SubHood.h"
#include "subsystems/SubDeploy.h"
#include "subsystems/SubDrivebase.h"
#include "subsystems/SubFeeder.h"
#include "subsystems/SubIndexer.h"
#include "subsystems/SubIntake.h"
#include "subsystems/SubShooter.h"
#include "subsystems/SubVision.h"
#include "subsystems/Turret/SubTurret.h"

#include "commands/AutonCommands.h"
#include "commands/DriveCommands.h"
#include "commands/FuelCommands.h"
#include "commands/TurretCommands.h"
#include "commands/VisionCommands.h"

#include "utilities/Logger.h"
#include "utilities/PoseHandler.h"
#include "utilities/ShiftHandler.h"
#include "utilities/ShotPlanner.h"
#include "utilities/FieldConstants.h"

#include <frc2/command/Commands.h>

RobotContainer::RobotContainer() {
  ConfigureBindings();
  SubDrivebase::GetInstance().SetDefaultCommand(cmd::TeleopDrive(_driverController));
  SubVision::GetInstance().SetDefaultCommand(cmd::AddVisionMeasurement());
  SubTurret::GetInstance().SetDefaultCommand(cmd::AimAtHub());
  SubDeploy::GetInstance().SetDefaultCommand(SubDeploy::GetInstance().MoveIntake());

  _autoManager.AddDefaultAuton("ShootAndStay", AutonHelper::MakeCommandPtrAuto(cmd::ShootAndStay()));
  _autoManager.AddAuton("LeftTrench",
    AutonHelper::MakeCommandPtrAuto(cmd::NeutralTwoPassToMid_LeftTrench()));
  _autoManager.AddAuton("RightTrench",
    AutonHelper::MakeCommandPtrAuto(cmd::NeutralTwoPassToMid_RightTrench()));

  frc::SmartDashboard::PutData("CHOSEN AUTON", &_autoManager.GetAutonChooser());

  SubHood::GetInstance();
  SubShooter::GetInstance();
}

void RobotContainer::ConfigureBindings() {
  //Triggers
  _driverController.LeftTrigger().WhileTrue(cmd::IntakeSequence());
  _driverController.RightTrigger().WhileTrue(
    cmd::ShootOnTheMove().AlongWith(cmd::TeleopDrive(_driverController, 1.0, 1.0).AsProxy()));
  _driverController.RightTrigger().OnFalse(SubFeeder::GetInstance().FeederOff());

  //Bumpers
  _driverController.LeftBumper().ToggleOnTrue(SubDeploy::GetInstance().ToggleDeployState());
  _driverController.RightBumper().WhileTrue(SubDeploy::GetInstance().AgitateHopper());

  //Letters
  _driverController.X().WhileTrue(
    SubDrivebase::GetInstance().LockWheelsInXShape().WithInterruptBehavior(
      frc2::Command::InterruptionBehavior::kCancelIncoming));
  _driverController.B().OnTrue(SubDrivebase::GetInstance().SyncSensor());
  _driverController.A().WhileTrue(cmd::EjectFuel());
  _driverController.Y().OnTrue(SubDrivebase::GetInstance().ZeroRotation([] { return 0_deg; }));

  /* Operator */
  _operatorController.X().OnTrue(frc2::cmd::RunOnce([]{ ShiftHandler::GetInstance().SetOverrideActive(true); }));
  _operatorController.X().OnFalse(frc2::cmd::RunOnce([]{ ShiftHandler::GetInstance().SetOverrideActive(false); }));
  _operatorController.Y().OnTrue(cmd::DisableAllOverrides());
  _operatorController.RightTrigger().WhileTrue(cmd::BackupShoot());
  _operatorController.LeftTrigger().WhileTrue(cmd::ShootOnTheMoveWithoutTurret(_driverController));
  _operatorController.Start().OnTrue(cmd::ForceShoot());
  _operatorController.Back().OnTrue(frc2::cmd::RunOnce([]{ SubTurret::GetInstance().LockTurret(); }));

  _operatorController.LeftBumper().OnTrue(frc2::cmd::RunOnce([]{return ShotPlanner::SetOverride(ShotPlanner::Override::SCORE);})
  .AlongWith(frc2::cmd::RunOnce([]{ ShiftHandler::GetInstance().SetOverrideActive(true); })));
  _operatorController.RightBumper().OnTrue(frc2::cmd::RunOnce([]{return ShotPlanner::SetOverride(ShotPlanner::Override::PASS);})
  .AlongWith(frc2::cmd::RunOnce([]{ ShiftHandler::GetInstance().SetOverrideActive(true); })));

  // Operator POVS
  _operatorController.POVRight().OnTrue(SubShooter::GetInstance().AdjustManualSpeedOffset(1_tps));
  _operatorController.POVLeft().OnTrue(SubShooter::GetInstance().AdjustManualSpeedOffset(-1_tps));
  _operatorController.POVUp().OnTrue(SubHood::GetInstance().AdjustManualAngleOffset(1_deg));
  _operatorController.POVDown().OnTrue(SubHood::GetInstance().AdjustManualAngleOffset(-1_deg));

  // Driver POVs
  _driverController.POVRight().WhileTrue(SubDeploy::GetInstance().Zero());
  _driverController.POVLeft().WhileTrue(SubHood::GetInstance().ZeroHood());
  _driverController.POVDown().WhileTrue(
    SubIndexer::GetInstance().IndexBackwards().AlongWith(SubFeeder::GetInstance().FeedBackwards()));

  //Sticks

  //Other
  _driverController.Back().OnTrue(SubDrivebase::GetInstance().SyncSensor());

  frc2::Trigger([]{return ShiftHandler::GetInstance().GetTimeLeft() < 3_s;}).OnTrue(Rumble(1, 0.5_s));
  SubDrivebase::GetInstance().CheckCoastButton().ToggleOnTrue(cmd::ToggleBrakeCoast());
}

std::shared_ptr<frc2::CommandPtr> RobotContainer::GetAutonomousCommand() {
  AutonHelper::AutonPtr chosen = _autoManager.GetChosenAuton();
  return chosen;
}

frc2::CommandPtr RobotContainer::Rumble(double force, units::second_t duration) {
  return frc2::cmd::Run([this, force, duration] {
    _driverController.SetRumble(frc::XboxController::RumbleType::kBothRumble, force);
    Logger::Log("DriverStation/Rumble", true);
  })
    .WithTimeout(duration)
    .FinallyDo([this] {
      _driverController.SetRumble(frc::XboxController::RumbleType::kBothRumble, 0);
      Logger::Log("DriverStation/Rumble", false);
    });
}