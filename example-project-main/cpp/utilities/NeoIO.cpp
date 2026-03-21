#include "utilities/NeoIO.h"
#include <frc/smartdashboard/SmartDashboard.h>
#include <string>
#include <rev/SparkMax.h>

NeoIO::NeoIO(int turnCanID, int driveCanID, int encoderCanID,
             units::turn_t cancoderMagOffset)
    : _canTurnMotor(turnCanID), _canDriveMotor(driveCanID), _canEncoder(encoderCanID) {
  frc::SmartDashboard::PutData("swerve/DriveMotor" + std::to_string(driveCanID), (wpi::Sendable*) &_canDriveMotor);
  frc::SmartDashboard::PutData("swerve/TurnMotor" + std::to_string(turnCanID), (wpi::Sendable*) &_canTurnMotor);
}

void NeoIO::ConfigTurnMotor() {
  rev::spark::SparkBaseConfig _canTurnConfig;

  _canTurnConfig.SmartCurrentLimit(40);
  _canTurnConfig.encoder.PositionConversionFactor(1.0 / TURNING_GEAR_RATIO).VelocityConversionFactor(TURNING_GEAR_RATIO);
  _canTurnConfig.closedLoop.Pid(TURN_P, TURN_I, TURN_D);
  _canTurnConfig.closedLoop.PositionWrappingEnabled(true)
    .PositionWrappingMinInput(0)
    .PositionWrappingMaxInput(1);
  _canTurnConfig.Inverted(true)
    .SetIdleMode(rev::spark::SparkBaseConfig::IdleMode::kBrake);

  _canTurnMotor.OverwriteConfig(_canTurnConfig);
}

void NeoIO::SetDesiredAngle(units::degree_t angle) {
  _canTurnMotor.SetPositionTarget(angle);
  _desiredAngle = angle;
}

void NeoIO::SetAngle(units::turn_t angle) {
  /*
    @param angle: angle of encoder
  */
  _canTurnMotor.SetCANTimeout(500);
  int maxAttempts = 15;
  int currentAttempts = 0;
  units::turn_t tolerance = 0.01_tr;
  while (units::math::abs(_canTurnMotor.GetPosition() - angle) > tolerance &&
         currentAttempts < maxAttempts) {
    _canTurnMotor.SetPosition(angle);
    currentAttempts++;
  }

  currentAttempts = 0;
  _canTurnMotor.SetCANTimeout(10);
}

void NeoIO::SendSensorsToDash() {
  // no-op, spark logging handled by ICSpark
}

void NeoIO::SetDesiredVelocity(units::meters_per_second_t velocity, units::newton_t forceFF) {
  units::turns_per_second_t TurnsPerSec = (velocity.value() / WHEEL_CIRCUMFERENCE.value()) * 1_tps;
  _canDriveMotor.SetVelocityTarget(TurnsPerSec);
  _desiredSpeed = velocity;
}

void NeoIO::DriveStraightVolts(units::volt_t volts) {
  SetDesiredAngle(0_deg);
  _canDriveMotor.SetVoltage(volts);
}

void NeoIO::StopMotors() {
  _canDriveMotor.Set(0);
  _canTurnMotor.Set(0);
}

void NeoIO::UpdateSim(units::second_t deltaTime) {

}

void NeoIO::SetNeutralMode(bool brakeModeToggle) {
  rev::spark::SparkBaseConfig _neutralModeConfig;

  if (brakeModeToggle == true) {
    _neutralModeConfig.SetIdleMode(rev::spark::SparkBaseConfig::IdleMode::kBrake);
    _canDriveMotor.AdjustConfigNoPersist(_neutralModeConfig);
    _canTurnMotor.AdjustConfigNoPersist(_neutralModeConfig);
  } else if (brakeModeToggle == false) {
    _neutralModeConfig.SetIdleMode(rev::spark::SparkBaseConfig::IdleMode::kCoast);
    _canDriveMotor.AdjustConfigNoPersist(_neutralModeConfig);
    _canTurnMotor.AdjustConfigNoPersist(_neutralModeConfig);
  }
}

void NeoIO::ConfigDriveMotor() {
  rev::spark::SparkBaseConfig _canDriveConfig;

  _canDriveConfig.SmartCurrentLimit(40);
  _canDriveConfig.closedLoop.Pid(DRIVE_P, DRIVE_I, DRIVE_D);
  _canDriveConfig.closedLoop.feedForward.kV(DRIVE_FF);
  _canDriveConfig.encoder.PositionConversionFactor(1.0 / DRIVE_GEAR_RATIO)
      .VelocityConversionFactor(1.0 / DRIVE_GEAR_RATIO);
  _canDriveConfig.SetIdleMode(rev::spark::SparkBaseConfig::IdleMode::kBrake);

  _canDriveMotor.OverwriteConfig(_canDriveConfig);
}

frc::SwerveModulePosition NeoIO::GetPosition() {
  units::meter_t distance = _canDriveMotor.GetPosition().value() * WHEEL_CIRCUMFERENCE;
  return {distance, GetAngle()};
}

frc::Rotation2d NeoIO::GetAngle() {
  units::radian_t turnAngle = _canTurnMotor.GetPosition();
  return turnAngle;
}

frc::Rotation2d NeoIO::GetDesiredAngle() {
  return _desiredAngle;
}

units::meters_per_second_t NeoIO::GetSpeed() {
  return (
    _canDriveMotor.GetVelocity().convert<units::turns_per_second>().value() 
    * WHEEL_CIRCUMFERENCE.value()
  ) * 1_mps;
}

units::meters_per_second_t NeoIO::GetDesiredSpeed() {
  return _desiredSpeed;
}

units::volt_t NeoIO::GetDriveVoltage() {
  return _canDriveMotor.GetAppliedOutput() * _canDriveMotor.GetBusVoltage() * 1_V;
}

frc::SwerveModuleState NeoIO::GetState() {
  return {GetSpeed(), GetAngle()};
}

frc::SwerveModuleState NeoIO::GetDesiredState() {
  return {GetDesiredSpeed(), GetDesiredAngle()};
}

units::radian_t NeoIO::GetDrivenRotations() {
  return _canDriveMotor.GetPosition();
}
