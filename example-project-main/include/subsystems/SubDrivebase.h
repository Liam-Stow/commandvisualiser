#pragma once

#include <frc2/command/SubsystemBase.h>
#include <frc/geometry/Translation2d.h>
#include <units/angle.h>
#include <ctre/phoenix6/core/CorePigeon2.hpp>
#include <ctre/phoenix6/Pigeon2.hpp>
#include <frc/DigitalInput.h>
#include <frc2/command/sysid/SysIdRoutine.h>
#include <frc/kinematics/SwerveDriveKinematics.h>
#include <frc/filter/SlewRateLimiter.h>
#include "utilities/SwerveModule.h"
#include "Constants.h"
#include "DrivebaseConfig.h"
#include <frc2/command/button/CommandXboxController.h>
#include <numbers>
#include <frc2/command/CommandPtr.h>
#include <frc2/command/Commands.h>

class SubDrivebase : public frc2::SubsystemBase {
 public:
  // Constructor and instance
  SubDrivebase();

  static SubDrivebase& GetInstance() {
    static SubDrivebase inst;
    return inst;
  }

  // Instantaneous functions
  void Periodic() override;
  void SimulationPeriodic() override;

  void LogDrivebaseStates();
  void UpdateOdometry();

  void SyncSensors();
  void ResetGyroHeading(units::degree_t startingAngle = 0_deg);

  void SetBrakeMode(bool mode);

  /* ------------------------------------------------------------------------------------------------------------- */
  /* Getters & calculations*/

  frc::Rotation2d GetGyroAngle(bool allianceRelative = false);
  units::degree_t GetPitch();
  units::degree_t GetRoll();
  units::degree_t GetApproxTiltMagnitude();

  units::degrees_per_second_t GetDesiredAngularVelocity();
  units::meters_per_second_t GetVelocity();
  frc::ChassisSpeeds GetChassisSpeeds(bool fieldRelative = true);
  frc::ChassisSpeeds GetDesiredChassisSpeeds(bool fieldRelative = true);
  frc2::Trigger CheckCoastButton();

  units::turns_per_second_t CalcRotateSpeed(units::turn_t rotationError);
  frc::ChassisSpeeds CalcDriveToPoseSpeeds(frc::Pose2d targetPose);
  frc::ChassisSpeeds CalcJoystickSpeeds(frc2::CommandXboxController& controller);

  frc2::CommandPtr DriveToPose(std::function<frc::Pose2d()> pose, double speedScaling = 1,
    units::meter_t posErrorTolerance = 2_cm, units::degree_t rotErrorTolerance = 2_deg,
    bool flipForRedAlliance = true);
  void SetPose(frc::Pose2d pose);
  bool IsAtPose(frc::Pose2d pose, units::meter_t posErrorTolerance = 2_cm,
    units::degree_t rotErrorTolerance = 2_deg);
  wpi::array<frc::SwerveModulePosition, 4U> GetSwerveStates();

  /* ------------------------------------------------------------------------------------------------------------- */
  /* Commands */

  // Joystick Drive
  frc2::CommandPtr JoystickDrive(frc2::CommandXboxController& controller, bool fieldOriented = true, double speedScale = 1);\
  frc2::CommandPtr LockWheelsInXShape();

  // Pose drive
  frc2::CommandPtr Drive(std::function<frc::ChassisSpeeds()> speeds, bool fieldOriented);
  frc2::CommandPtr DriveOverBump(frc::ChassisSpeeds fieldRelativeSpeeds, frc::Translation2d allianceRelativeEndXY);

  // Rotations
  frc2::CommandPtr AlignToAngle(frc2::CommandXboxController& controller, std::function<units::degree_t()> target);

  // Gyro and sensor
  frc2::CommandPtr SyncSensor();
  frc2::CommandPtr ZeroRotation(std::function<units::degree_t()> startingAngle);

  // Testing
  frc2::CommandPtr CharacteriseWheels();
  
  frc2::CommandPtr SysIdQuasistatic(frc2::sysid::Direction direction) {
    return _sysIdRoutine.Quasistatic(direction);
  }
  frc2::CommandPtr SysIdDynamic(frc2::sysid::Direction direction) {
    return _sysIdRoutine.Dynamic(direction);
  }

 private:
  void Drive(units::meters_per_second_t xSpeed, units::meters_per_second_t ySpeed,
    units::turns_per_second_t rot, bool fieldRelative,
    std::optional<std::array<units::newton_t, 4>> xForceFeedforwards = std::nullopt,
    std::optional<std::array<units::newton_t, 4>> yForceFeedforwards = std::nullopt);
  /* ------------------------------------------------------------------------------------------------------------- */ 
  /* Definition=*/

  // Gyro
  ctre::phoenix6::hardware::Pigeon2 _gyro{canid::PIGEON_2};

  // Coast button
  frc::DigitalInput _toggleBrakeCoast{dio::BRAKE_COAST_BUTTON};

  // Swerve

  SwerveModule _frontLeft{canid::DRIVEBASE_FRONT_LEFT_DRIVE, canid::DRIVEBASE_FRONT_LEFT_TURN,
                          canid::DRIVEBASE_FRONT_LEFT_ENCODER, (DrivebaseConfig::FRONT_LEFT_MAG_OFFSET)};
  SwerveModule _frontRight{canid::DRIVEBASE_FRONT_RIGHT_DRIVE, canid::DRIVEBASE_FRONT_RIGHT_TURN,
                           canid::DRIVEBASE_FRONT_RIGHT_ENCODER, (DrivebaseConfig::FRONT_RIGHT_MAG_OFFSET)};
  SwerveModule _backLeft{canid::DRIVEBASE_BACK_LEFT_DRIVE, canid::DRIVEBASE_BACK_LEFT_TURN,
                         canid::DRIVEBASE_BACK_LEFT_ENCODER, (DrivebaseConfig::BACK_LEFT_MAG_OFFSET)};
  SwerveModule _backRight{canid::DRIVEBASE_BACK_RIGHT_DRIVE, canid::DRIVEBASE_BACK_RIGHT_TURN,
                          canid::DRIVEBASE_BACK_RIGHT_ENCODER, (DrivebaseConfig::BACK_RIGHT_MAG_OFFSET)};

  frc::SwerveDriveKinematics<4> _kinematics {
      DrivebaseConfig::FL_POSITION,
      DrivebaseConfig::FR_POSITION,
      DrivebaseConfig::BL_POSITION,
      DrivebaseConfig::BR_POSITION
  };

  frc::PIDController _translationP2pController = DrivebaseConfig::P2P_TRANSLATION_PID;
  frc::PIDController _rotationP2pController = DrivebaseConfig::P2P_ROTATION_PID;
  frc::SlewRateLimiter<units::meters_per_second> _xP2pLimiter{DrivebaseConfig::MAX_P2P_ACCEL};
  frc::SlewRateLimiter<units::meters_per_second> _yP2pLimiter{DrivebaseConfig::MAX_P2P_ACCEL};
  frc::SlewRateLimiter<units::turns_per_second> _rotP2pLimiter{DrivebaseConfig::MAX_P2P_ANGULAR_ACCEL};

  // P2P
  units::meters_per_second_squared_t _tunedMaxP2pAccel = DrivebaseConfig::MAX_P2P_ACCEL;
  units::turns_per_second_squared_t _tunedMaxP2pAngAccel = DrivebaseConfig::MAX_P2P_ANGULAR_ACCEL;
  frc::SlewRateLimiter<units::meters_per_second> _p2pTranslationLimiter{_tunedMaxP2pAccel};
  frc::SlewRateLimiter<units::turns_per_second> _p2pRotationLimiter{_tunedMaxP2pAngAccel};

  // Joystick controller rate limiters
  double _tunedMaxJoystickAccel = DrivebaseConfig::MAX_JOYSTICK_ACCEL;
  double _tunedMaxAngularJoystickAccel = DrivebaseConfig::MAX_ANGULAR_JOYSTICK_ACCEL;
  frc::SlewRateLimiter<units::scalar> _xStickLimiter{_tunedMaxJoystickAccel / 1_s};
  frc::SlewRateLimiter<units::scalar> _yStickLimiter{_tunedMaxJoystickAccel / 1_s};
  frc::SlewRateLimiter<units::scalar> _rotStickLimiter{_tunedMaxAngularJoystickAccel / 1_s};

  // Sysid
  frc2::sysid::SysIdRoutine _sysIdRoutine{
      frc2::sysid::Config{std::nullopt, std::nullopt, std::nullopt, nullptr},
      frc2::sysid::Mechanism{
          [this](units::volt_t driveVoltage) {
            _frontLeft.DriveStraightVolts(driveVoltage);
            _backLeft.DriveStraightVolts(driveVoltage);
            _frontRight.DriveStraightVolts(driveVoltage);
            _backRight.DriveStraightVolts(driveVoltage);
          },
          [this](frc::sysid::SysIdRoutineLog* log) {
            log->Motor("drive-left")
                .voltage(_frontLeft.GetDriveVoltage())
                .position(_frontLeft.GetDrivenRotations().convert<units::turns>())
                .velocity(_frontLeft.GetSpeed());
            log->Motor("drive-right")
                .voltage(_frontRight.GetDriveVoltage())
                .position(_frontRight.GetDrivenRotations().convert<units::turns>())
                .velocity(_frontRight.GetSpeed());
          },
          this}};

};