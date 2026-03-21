// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

#pragma once

#include "utilities/AlertController.h"
#include "utilities/ICSparkFlex.h"
#include "utilities/MechanismCircle2d.h"

#include <frc/Alert.h>
#include <frc/simulation/SingleJointedArmSim.h>
#include <frc/system/plant/DCMotor.h>
#include <frc/system/plant/LinearSystemId.h>
#include <frc2/command/SubsystemBase.h>

#include "Constants.h"
#include "frc2/command/Commands.h"
#include "rev/config/SparkFlexConfig.h"
#include "rev/config/SparkFlexConfigAccessor.h"
class SubDeploy : public frc2::SubsystemBase {
 public:
  static SubDeploy& GetInstance() {
    static SubDeploy instance;
    return instance;
  }
  SubDeploy();

  frc2::CommandPtr DeployIntake();
  frc2::CommandPtr ToggleDeployState();

  void EnableSoftLimit(bool enabled);
  frc2::CommandPtr Zero();
  frc2::CommandPtr RetractIntake();
  frc2::CommandPtr MoveIntake();
  frc2::CommandPtr AgitateHopper();

  void SetBrakeMode(bool brakeMode);

  /**
   * Will be called periodically whenever the CommandScheduler runs.
   */
  void Periodic() override;
  void SimulationPeriodic() override;

 private:
  ICSparkFlex _deployMotor{canid::DEPLOY};
  rev::spark::SparkFlexConfig _deployMotorConfig;

  frc::Alert _deployHighTemperatureAlert{
    "Deploy Motor High Temperature!", frc::Alert::AlertType::kWarning};
  frc::Alert _deployCurrentAlert{"Deploy Motor Overcurrent!", frc::Alert::AlertType::kWarning};

  frc::Alert _deployRecordedTemperatureAlert{
    "Deploy Motor max Temperature was reached !", frc::Alert::AlertType::kWarning};

  frc::Alert _deployRecordedCurrentAlert{
    "Deploy Motor max current was reached !", frc::Alert::AlertType::kWarning};

  AlertController::MotorAlertConfig DeployAlertConfig{_deployHighTemperatureAlert,
    _deployCurrentAlert, _deployRecordedTemperatureAlert, _deployRecordedCurrentAlert, 60_degC,
    20_A};

  bool _hasZeroed = false;
  bool _currentlyZeroing = false;
  bool _intakeDeployed = false;
  frc::Timer _zeroingTimer;
  frc::Timer _agitateTimer;


  static constexpr units::ampere_t ZEROINGCURRENTLIMIT = 40_A;
  static constexpr double DEPLOY_P = 5.0;
  static constexpr double DEPLOY_GEARING = 55.8;
  static constexpr units::degree_t RETRACTED_ANGLE = 0.29_tr;
  static constexpr units::degree_t DEPLOYED_ANGLE = 0_deg;
  static constexpr units::degree_t AGITATE_ANGLE_HIGHER = 70_deg;
  static constexpr units::degree_t AGITATE_ANGLE_LOWER = 30_deg;
  static constexpr units::meter_t DEPLOY_ARM_LENGTH = 0.1_m;

  // Simulation components
  static constexpr units::degree_t DEPLOY_START_ANGLE = 0_deg;
  static constexpr units::kilogram_square_meter_t DEPLOY_MOI = 0.0000005_kg_sq_m;
  static constexpr frc::DCMotor DEPLOY_MOTOR_MODEL = frc::DCMotor::NeoVortex();
  frc::LinearSystem<2, 1, 2> _deployFlywheelSystem =
    frc::LinearSystemId::SingleJointedArmSystem(DEPLOY_MOTOR_MODEL, DEPLOY_MOI, DEPLOY_GEARING);
  frc::sim::SingleJointedArmSim _deploySim{_deployFlywheelSystem, DEPLOY_MOTOR_MODEL,
    DEPLOY_GEARING, DEPLOY_ARM_LENGTH, DEPLOYED_ANGLE, RETRACTED_ANGLE, false,
    DEPLOY_START_ANGLE};
};
