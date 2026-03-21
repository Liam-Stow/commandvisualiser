// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

#pragma once

#include "utilities/AlertController.h"
#include "utilities/MechanismCircle2d.h"
#include "utilities/BotVars.h"

#include <frc/Alert.h>
#include <frc/simulation/FlywheelSim.h>
#include <frc/smartdashboard/Mechanism2d.h>
#include <frc/smartdashboard/MechanismLigament2d.h>
#include <frc/system/plant/DCMotor.h>
#include <frc/system/plant/LinearSystemId.h>
#include <frc2/command/CommandPtr.h>
#include <frc2/command/Commands.h>
#include <frc2/command/SubsystemBase.h>

#include <ctre/phoenix6/TalonFX.hpp>
#include <wpi/interpolating_map.h>

#include "Constants.h"

class SubShooter : public frc2::SubsystemBase {
 public:
  SubShooter();
  static SubShooter& GetInstance() {
    static SubShooter inst;
    return inst;
  }

  void SimulationPeriodic();

  frc2::CommandPtr SetShooterTarget(std::function<units::turns_per_second_t()> speed);
  frc2::CommandPtr StopShooter();
  frc2::CommandPtr SpinWithDistance(std::function<units::meter_t()> distance, std::function<bool()> isPassing);
  frc2::CommandPtr SpinShooterSlowly();
  frc2::CommandPtr AdjustManualSpeedOffset(units::turns_per_second_t offset);

  units::turns_per_second_t GetShooterOffset();
  
  bool IsAtSpeed();

  units::second_t GetTimeOfFLightWithDistance(units::meter_t distance);

  /**
   * Will be called periodically whenever the CommandScheduler runs.
   */
  void Periodic() override;

 private:
  ctre::phoenix6::hardware::TalonFX _shooterMotor1{canid::SHOOTER_MOTOR_1, ctre::phoenix6::CANBus{"Canivore"}};
  ctre::phoenix6::hardware::TalonFX _shooterMotor2{canid::SHOOTER_MOTOR_2, ctre::phoenix6::CANBus{"Canivore"}};
  static constexpr units::kilogram_square_meter_t MOI = 0.05_kg_sq_m;
  static constexpr frc::DCMotor MOTOR_MODEL = frc::DCMotor::KrakenX60FOC();
  const double GEAR_RATIO = BotVars::Choose(1.63, 1.0);
  static constexpr units::turns_per_second_t DEFAULT_SHOOTER_OFFSET = 0_tps;

  double P = 0.4;
  double I = 0;
  double D = 0;
  double V = 0.2;

  ctre::phoenix6::configs::TalonFXConfiguration _shooterMotorConfig;
  ctre::phoenix6::controls::VelocityVoltage _flywheelTargetVelocity{0_tps};

  frc::Alert _shooter1highTemperatureAlert{
    "Shooter Motor 1 High Temperature!", frc::Alert::AlertType::kWarning};
  frc::Alert _shooter1CurrentAlert{"Shooter Motor 1 Overcurrent!", frc::Alert::AlertType::kWarning};

  frc::Alert _shooter1RecordedTemperatureAlert{
    "Shooter Motor 1 max Temperature was reached !", frc::Alert::AlertType::kWarning};

  frc::Alert _shooter1RecordedCurrentAlert{
    "Shooter Motor 1 max current was reached !", frc::Alert::AlertType::kWarning};

  AlertController::MotorAlertConfig _shooter1AlertConfig{_shooter1highTemperatureAlert,
    _shooter1CurrentAlert, _shooter1RecordedTemperatureAlert, _shooter1RecordedCurrentAlert,
    60_degC, 20_A};

  frc::Alert _shooter2highTemperatureAlert{
    "Shooter Motor 2 High Temperature!", frc::Alert::AlertType::kWarning};
  frc::Alert _shooter2CurrentAlert{"Shooter Motor 2 Overcurrent!", frc::Alert::AlertType::kWarning};

  frc::Alert _shooter2RecordedTemperatureAlert{
    "Shooter Motor 2 max Temperature was reached !", frc::Alert::AlertType::kWarning};

  frc::Alert _shooter2RecordedCurrentAlert{
    "Shooter Motor 2 max current was reached !", frc::Alert::AlertType::kWarning};

  AlertController::MotorAlertConfig _shooter2AlertConfig{_shooter2highTemperatureAlert,
    _shooter2CurrentAlert, _shooter2RecordedTemperatureAlert, _shooter2RecordedCurrentAlert,
    60_degC, 20_A};

  wpi::interpolating_map<units::meter_t, units::turns_per_second_t> _flyWheelSpeedTableScoring;
  wpi::interpolating_map<units::meter_t, units::turns_per_second_t> _flyWheelSpeedTablePassing;
  wpi::interpolating_map<units::meter_t, units::second_t> _timeOfFlightTable;

  // Sim
  frc::LinearSystem<1, 1, 1> _leftFlywheelSystem =
    frc::LinearSystemId::FlywheelSystem(MOTOR_MODEL, MOI, GEAR_RATIO);
  frc::sim::FlywheelSim _leftFlywheelSim{_leftFlywheelSystem, MOTOR_MODEL};

  frc::LinearSystem<1, 1, 1> _rightFlywheelSystem =
    frc::LinearSystemId::FlywheelSystem(MOTOR_MODEL, MOI, GEAR_RATIO);
  frc::sim::FlywheelSim _rightFlywheelSim{_rightFlywheelSystem, MOTOR_MODEL};
};
