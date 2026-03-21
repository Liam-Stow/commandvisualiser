// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

#pragma once

#include "utilities/AlertController.h"
#include "utilities/MechanismCircle2d.h"

#include <frc/simulation/DCMotorSim.h>
#include <frc/simulation/SingleJointedArmSim.h>
#include <frc/system/plant/LinearSystemId.h>
#include <frc2/command/Commands.h>
#include <frc2/command/SubsystemBase.h>

#include <wpi/interpolating_map.h>

#include "Constants.h"
#include "HoodMotorConfig.h"
#include "HoodMotorIO.h"

class SubHood : public frc2::SubsystemBase {
 public:
  SubHood();
  static SubHood& GetInstance() {
    static SubHood inst;
    return inst;
  }

  void SimulationPeriodic();

  bool HoodCurrentCheck();
  bool HoodIsAtTarget();

  units::ampere_t GetHoodMotorCurrent();
  units::degree_t GetHoodOffset();

  frc2::CommandPtr ManualHoodDown();
  frc2::CommandPtr StowHood();
  frc2::CommandPtr ZeroHood();
  frc2::CommandPtr HoodToEjectAngle();
  frc2::CommandPtr SetHoodPositionTarget(std::function<units::degree_t()> angle);
  frc2::CommandPtr SetHoodPositionTargetFromDist(std::function<units::meter_t()> distanceToTarget);
  frc2::CommandPtr AdjustManualAngleOffset(units::degree_t offset);
  frc2::CommandPtr MoveHoodUp1Degree();
  frc2::CommandPtr MoveHoodDown1Degree();
  void SetBrakeMode(bool brakeMode);

  static constexpr units::degree_t PASSING_ANGLE = 37_deg;

  /**
   * Will be called periodically whenever the CommandScheduler runs.
   */
  void Periodic() override;

 private:
  units::ampere_t zeroingCurrentLimit = 22_A;

  static constexpr units::degree_t UPPER_LIMIT = 38.5_deg;
  static constexpr units::degree_t LOWER_LIMIT = 16.5_deg;
  static constexpr bool SIMULATE_GRAVITY = false;
  static constexpr units::degree_t STARTING_ANGLE = 13_deg;
  static constexpr units::degree_t STOW_ANGLE = 12.5_deg;
  static constexpr units::centimeter_t ARM_LENGTH = 20_cm;
  static constexpr units::degree_t TOLARANCE = 0.5_deg;
  static constexpr units::degree_t DEFAULT_HOOD_OFFSET = 0_deg;

  bool _zeroing = false;
  bool _hasZeroed = false;

  std::unique_ptr<HoodMotorIO> _hoodMotor;

  frc::Alert _hoodhighTemperatureAlert{
    "Hood Motor High Temperature!", frc::Alert::AlertType::kWarning};
  frc::Alert _hoodCurrentAlert{"Hood Motor Overcurrent!", frc::Alert::AlertType::kWarning};

  frc::Alert _hoodRecordedTemperatureAlert{
    "Hood Motor max Temperature was reached !", frc::Alert::AlertType::kWarning};

  frc::Alert _hoodRecordedCurrentAlert{
    "Hood Motor max current was reached !", frc::Alert::AlertType::kWarning};

  AlertController::MotorAlertConfig _hoodAlertConfig{_hoodhighTemperatureAlert, _hoodCurrentAlert,
    _hoodRecordedTemperatureAlert, _hoodRecordedCurrentAlert, 60_degC, 20_A};

  wpi::interpolating_map<units::meter_t, units::degree_t> _hoodPitchTable;

  /* The (1) argument in KrakenX44FOC exists because the compiler was
   * complaining about no default constructor exisitng even though (1) is the
   * default argument */
  static constexpr frc::DCMotor MOTOR_MODEL = frc::DCMotor::KrakenX44FOC(1);
  static constexpr units::kilogram_square_meter_t MOI = 0.0001_kg_sq_m;

  // Sim
  frc::LinearSystem<2, 1, 2> _hoodSystem =
    frc::LinearSystemId::SingleJointedArmSystem(MOTOR_MODEL, MOI, KrakenMotorConfig::GEAR_RATIO);
  frc::sim::SingleJointedArmSim _hoodSim{_hoodSystem, MOTOR_MODEL, KrakenMotorConfig::GEAR_RATIO,
    ARM_LENGTH, LOWER_LIMIT, UPPER_LIMIT, SIMULATE_GRAVITY, STARTING_ANGLE};
};
