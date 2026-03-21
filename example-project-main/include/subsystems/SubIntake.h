// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

#pragma once

#include "utilities/AlertController.h"
#include "utilities/ICSparkFlex.h"

#include <frc/Alert.h>
#include <frc/simulation/FlywheelSim.h>
#include <frc/simulation/SingleJointedArmSim.h>
#include <frc/system/plant/DCMotor.h>
#include <frc/system/plant/LinearSystemId.h>
#include <frc2/command/SubsystemBase.h>

#include "Constants.h"
#include "frc2/command/Commands.h"
#include "rev/config/SparkFlexConfig.h"
#include "rev/config/SparkFlexConfigAccessor.h"

class SubIntake : public frc2::SubsystemBase {
 public:
  static SubIntake& GetInstance() {
    static SubIntake instance;
    return instance;
  }
  SubIntake();

  frc2::CommandPtr IntakeOn();
  frc2::CommandPtr IntakeOff();
  frc2::CommandPtr ReverseIntake();

  /**
   * Will be called periodically whenever the CommandScheduler runs.
   */
  void Periodic() override;
  void SimulationPeriodic() override;

 private:
  ICSparkFlex _intakeMotor{canid::INTAKE};
  ICSparkFlex _intakeFollowerMotor{canid::INTAKE_FOLLOWER};

  rev::spark::SparkFlexConfig _intakeMotorConfig;
  rev::spark::SparkFlexConfig _intakeFollowerMotorConfig;

  frc::Alert _intakeHighTemperatureAlert{
    "Intake Motor High Temperature!", frc::Alert::AlertType::kWarning};
  frc::Alert _intakeCurrentAlert{"Intake Motor Overcurrent!", frc::Alert::AlertType::kWarning};

  frc::Alert _intakeRecordedTemperatureAlert{
    "Intake Motor max Temperature was reached !", frc::Alert::AlertType::kWarning};

  frc::Alert _intakeRecordedCurrentAlert{
    "Intake Motor max current was reached !", frc::Alert::AlertType::kWarning};

  AlertController::MotorAlertConfig _intakeAlertConfig{_intakeHighTemperatureAlert,
    _intakeCurrentAlert, _intakeRecordedCurrentAlert, _intakeRecordedTemperatureAlert, 60_degC,
    20_A};

  frc::Alert _intakeFollowerHighTemperatureAlert{
    "Intake Follower Motor High Temperature!", frc::Alert::AlertType::kWarning};
  frc::Alert _intakeFollowerCurrentAlert{
    "Intake Follower Motor Overcurrent!", frc::Alert::AlertType::kWarning};

  frc::Alert _intakeFollowerRecordedTemperatureAlert{
    "Intake Follower Motor max Temperature was reached !", frc::Alert::AlertType::kWarning};

  frc::Alert _intakeFollowerRecordedCurrentAlert{
    "Intake Follower Motor max current was reached !", frc::Alert::AlertType::kWarning};

  AlertController::MotorAlertConfig _intakeFollowerAlertConfig{_intakeFollowerHighTemperatureAlert,
    _intakeFollowerCurrentAlert, _intakeFollowerRecordedTemperatureAlert,
    _intakeFollowerRecordedCurrentAlert, 60_degC, 20_A};

  // Simulation components
  static constexpr double GEARING = 1.0;
  static constexpr units::kilogram_square_meter_t MOI = 0.0000001_kg_sq_m;
  static constexpr frc::DCMotor MOTOR_MODEL = frc::DCMotor::NeoVortex();
  frc::LinearSystem<1, 1, 1> _flywheelSystem =
    frc::LinearSystemId::FlywheelSystem(MOTOR_MODEL, MOI, GEARING);
  frc::sim::FlywheelSim _sim{_flywheelSystem, MOTOR_MODEL};
};