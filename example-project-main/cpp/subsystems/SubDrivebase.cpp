#include <frc/RobotBase.h>
#include "subsystems/SubDrivebase.h"
#include "utilities/PoseHandler.h"
#include "utilities/Logger.h"
#include "utilities/ICgeometry.h"

SubDrivebase::SubDrivebase() {
  Logger::Log("Drivebase/P2P/Rotation Controller", &_rotationP2pController);
  Logger::Log("Drivebase/P2P/Translation Controller", &_translationP2pController);

  _rotationP2pController.EnableContinuousInput(0, 1);

  ctre::phoenix6::configs::Pigeon2Configuration gyroConfig;
  gyroConfig.MountPose.MountPosePitch = 0_deg;
  gyroConfig.MountPose.MountPoseRoll = 0_deg;
  gyroConfig.MountPose.MountPoseYaw = 0_deg;
  _gyro.GetConfigurator().Apply(gyroConfig);
}

void SubDrivebase::Periodic() {
  auto loopStart = frc::GetTime();

  LogDrivebaseStates();
  UpdateOdometry();
  
  Logger::Log("Drivebase/Loop Time", (frc::GetTime() - loopStart));
}

void SubDrivebase::SimulationPeriodic() {
  _frontLeft.UpdateSim(20_ms);
  _frontRight.UpdateSim(20_ms);
  _backLeft.UpdateSim(20_ms);
  _backRight.UpdateSim(20_ms);

  auto rotSpeed = _kinematics.ToChassisSpeeds(
    _frontLeft.GetState(),
    _frontRight.GetState(),
    _backLeft.GetState(),
    _backRight.GetState()).omega;
  units::radian_t changeInRot = rotSpeed * 20_ms;
  units::degree_t newHeading = GetGyroAngle().RotateBy(changeInRot).Degrees();
  _gyro.SetYaw(newHeading);

  wpi::array<frc::SwerveModulePosition, 4U> states = {
    _frontLeft.GetPosition(),
    _frontRight.GetPosition(),
    _backLeft.GetPosition(),
    _backRight.GetPosition()
  };

  PoseHandler::GetInstance().UpdateSim(GetGyroAngle(), states, true, 
    PoseHandler::GetInstance().GetPose().Rotation());
}

// Commands

void SubDrivebase::LogDrivebaseStates() {
  Logger::Log("Drivebase/GyroAngle/Roll", SubDrivebase::GetInstance().GetRoll());
  Logger::Log("Drivebase/GyroAngle/Pitch", SubDrivebase::GetInstance().GetPitch());
  Logger::Log("Drivebase/GyroAngle/ApproxTiltMagnitude", GetApproxTiltMagnitude());
  Logger::Log("Drivebase/Coast Button", CheckCoastButton().Get());

  Logger::Log("Drivebase/velocity", GetVelocity());
  Logger::Log("Drivebase/velocity/desired field relative vx", GetDesiredChassisSpeeds().vx);
  Logger::Log("Drivebase/velocity/desired field relative vy", GetDesiredChassisSpeeds().vy);
  Logger::Log("Drivebase/velocity/desired angular velocity", GetDesiredAngularVelocity());

  Logger::Log("Drivebase/velocity/field relative vx", GetChassisSpeeds().vx);
  Logger::Log("Drivebase/velocity/field relative vy", GetChassisSpeeds().vy);

  Logger::Log("Drivebase/Internal Encoder Swerve States",wpi::array{
    _frontLeft.GetState(),
    _frontRight.GetState(),
    _backLeft.GetState(),
    _backRight.GetState()
  });
  Logger::Log("Drivebase/CANCoder Swerve States", wpi::array{
    _frontLeft.GetCANCoderState(),
    _frontRight.GetCANCoderState(),
    _backLeft.GetCANCoderState(),
    _backRight.GetCANCoderState()
  });
  Logger::Log("Drivebase/Pigeon raw angle", _gyro.GetYaw().GetValue().value());
  Logger::Log("Drivebase/Pigeon raw Rotation2d", _gyro.GetRotation2d().Degrees());

  units::turn_t flRotations = _frontLeft.GetDrivenRotations();
  units::turn_t frRotations = _frontRight.GetDrivenRotations();
  units::turn_t blRotations = _backLeft.GetDrivenRotations();
  units::turn_t brRotations = _backRight.GetDrivenRotations();

  Logger::Log("Drivebase/DistanceDrivenRotations/fl", flRotations);
  Logger::Log("Drivebase/DistanceDrivenRotations/fr", frRotations);
  Logger::Log("Drivebase/DistanceDrivenRotations/bl", blRotations);
  Logger::Log("Drivebase/DistanceDrivenRotations/br", brRotations);

  Logger::Log("Drivebase/DistanceDriven/fl",
    (flRotations) * (0.04121451348939883 * 2 * std::numbers::pi));
  Logger::Log("Drivebase/DistanceDriven/fr",
    (frRotations) * (0.04121451348939883 * 2 * std::numbers::pi));
  Logger::Log("Drivebase/DistanceDriven/bl",
    (blRotations) * (0.04121451348939883 * 2 * std::numbers::pi));
  Logger::Log("Drivebase/DistanceDriven/br",
    (brRotations) * (0.04121451348939883 * 2 * std::numbers::pi));

  _frontLeft.SendSensorsToDash();
  _frontRight.SendSensorsToDash();
  _backLeft.SendSensorsToDash();
  _backRight.SendSensorsToDash();
}

wpi::array<frc::SwerveModulePosition, 4U> SubDrivebase::GetSwerveStates() {
  return {
    _frontLeft.GetPosition(),
    _frontRight.GetPosition(),
    _backLeft.GetPosition(),
    _backRight.GetPosition()
  };
}

void SubDrivebase::UpdateOdometry() {
  wpi::array<frc::SwerveModulePosition, 4U> states = GetSwerveStates();

  if (frc::DriverStation::GetAlliance().value_or(frc::DriverStation::Alliance::kBlue) ==
      frc::DriverStation::Alliance::kBlue) {
    PoseHandler::GetInstance().Update(GetGyroAngle(), states);
  } else {
    PoseHandler::GetInstance().Update(GetGyroAngle() - 180_deg, states);
  }
}

void SubDrivebase::SyncSensors() {
  _frontLeft.SyncSensors();
  _frontRight.SyncSensors();
  _backLeft.SyncSensors();
  _backRight.SyncSensors();

  _frontLeft.ConfigTurnMotor();
  _frontRight.ConfigTurnMotor();
  _backLeft.ConfigTurnMotor();
  _backRight.ConfigTurnMotor();
}

frc2::CommandPtr SubDrivebase::SyncSensor() {
  return RunOnce([this] {SyncSensors();});
}

void SubDrivebase::ResetGyroHeading(units::degree_t startingAngle) {
  _gyro.SetYaw(startingAngle);
}

frc2::CommandPtr SubDrivebase::ZeroRotation(std::function<units::degree_t()> startingAngle) {
  return RunOnce([this, startingAngle] { ResetGyroHeading(startingAngle()); 
  frc::Pose2d oldPose = PoseHandler::GetInstance().GetPose();
  frc::Pose2d newPose{oldPose.X(), oldPose.Y(), startingAngle()};
 
  PoseHandler::GetInstance().SetPose(newPose, GetSwerveStates());
  });
}

void SubDrivebase::SetBrakeMode(bool mode) {
  _frontLeft.SetBreakMode(mode);
  _frontRight.SetBreakMode(mode);
  _backLeft.SetBreakMode(mode);
  _backRight.SetBreakMode(mode);
}

void SubDrivebase::Drive(
  units::meters_per_second_t xSpeed, units::meters_per_second_t ySpeed,
  units::turns_per_second_t rot, bool fieldRelative,
  std::optional<std::array<units::newton_t, 4>> xForceFeedforwards,
  std::optional<std::array<units::newton_t, 4>> yForceFeedforwards
) {
  // Optionally convert speeds to field relative
  auto speeds = fieldRelative
                    ? frc::ChassisSpeeds::FromFieldRelativeSpeeds(xSpeed, ySpeed, rot, GetGyroAngle())
                    : frc::ChassisSpeeds{xSpeed, ySpeed, rot};

  // Discretize to get rid of translational drift while rotating
  speeds = frc::ChassisSpeeds::Discretize(speeds, 60_ms);

  // Get states of all swerve modules
  auto states = _kinematics.ToSwerveModuleStates(speeds);

  // Set speed limit and apply speed limit to all modules
  _kinematics.DesaturateWheelSpeeds(
      &states,
      frc::SmartDashboard::GetNumber("Drivebase/Config/Max Velocity", DrivebaseConfig::MAX_VELOCITY.value()) * 1_mps);

  // Extract force feedforwards
  std::array<units::newton_t, 4> defaults{0_N, 0_N, 0_N, 0_N};
  auto [flXForce, frXForce, blXForce, brXForce] = xForceFeedforwards.value_or(defaults);
  auto [flYForce, frYForce, blYForce, brYForce] = yForceFeedforwards.value_or(defaults);

  // Setting modules from aquired states
  Logger::Log("Drivebase/Desired Swerve States", states);
  auto [fl, fr, bl, br] = states;
  _frontLeft.SetDesiredState(fl, flXForce, flYForce);
  _frontRight.SetDesiredState(fr, frXForce, frYForce);
  _backLeft.SetDesiredState(bl, blXForce, blYForce);
  _backRight.SetDesiredState(br, brXForce, brYForce);
}

frc2::CommandPtr SubDrivebase::Drive(std::function<frc::ChassisSpeeds()> speeds, bool fieldOriented) {
    return Run([this, speeds, fieldOriented] {
        auto speedVal = speeds();
        Drive(speedVal.vx, speedVal.vy, speedVal.omega, fieldOriented);
    }).FinallyDo([this] { Drive(0_mps,0_mps,0_deg_per_s, false); });
}

/* aligns to an a arbitrary while allowing joystick driving */
frc2::CommandPtr SubDrivebase::AlignToAngle(
  frc2::CommandXboxController& controller, std::function<units::degree_t()> target) {
  return SubDrivebase::GetInstance().Drive(
    [&controller, target] {
      units::angle::degree_t currentAngle =
        SubDrivebase::GetInstance().GetGyroAngle(true).Degrees();
      units::turns_per_second_t rotationSpeeds =
        SubDrivebase::GetInstance().CalcRotateSpeed(currentAngle - target());
      frc::ChassisSpeeds joystickSpeeds =
        SubDrivebase::GetInstance().CalcJoystickSpeeds(controller);
      return frc::ChassisSpeeds(joystickSpeeds.vx, joystickSpeeds.vy, rotationSpeeds);
    },
    true);
}

frc2::CommandPtr SubDrivebase::LockWheelsInXShape() {
  return Run([this] {
    auto fl = frc::SwerveModuleState{0_mps, frc::Rotation2d{45_deg}};
    auto fr = frc::SwerveModuleState{0_mps, frc::Rotation2d{135_deg}};
    auto bl = frc::SwerveModuleState{0_mps, frc::Rotation2d{135_deg}};
    auto br = frc::SwerveModuleState{0_mps, frc::Rotation2d{45_deg}};

    _frontLeft.SetDesiredState(fl);
    _frontRight.SetDesiredState(fr);
    _backLeft.SetDesiredState(bl);
    _backRight.SetDesiredState(br);
  });
}

frc2::CommandPtr SubDrivebase::DriveOverBump(frc::ChassisSpeeds fieldRelativeSpeeds, frc::Translation2d allianceRelativeEndXY) {
  return Drive([this, fieldRelativeSpeeds] {
    return fieldRelativeSpeeds;
  }, true).WithDeadline(frc2::cmd::Sequence(
    frc2::cmd::RunOnce([this] { Logger::Log("Drivebase/DriveOverBump/State", 1); }),
    frc2::cmd::WaitUntil([this] {
      return (GetApproxTiltMagnitude() > 5_deg); //ascending
    }),
    frc2::cmd::RunOnce([this] { Logger::Log("Drivebase/DriveOverBump/State", 2); }),
    frc2::cmd::WaitUntil([this] {
      return (GetApproxTiltMagnitude() < 5_deg); //peak
    }),
    frc2::cmd::RunOnce([this] { Logger::Log("Drivebase/DriveOverBump/State", 3); }),
    frc2::cmd::WaitUntil([this] {
      return (GetApproxTiltMagnitude() > 5_deg); //descending. note that tilt magnitude is always positive
    }),
    frc2::cmd::RunOnce([this] { Logger::Log("Drivebase/DriveOverBump/State", 4); }),
    frc2::cmd::WaitUntil([this] {
      return (GetApproxTiltMagnitude() < 2_deg); //done
    }),
    frc2::cmd::RunOnce([this] { Logger::Log("Drivebase/DriveOverBump/State", 5); })
  )).Unless([this] {
    return frc::RobotBase::IsSimulation();
  }).FinallyDo([this, allianceRelativeEndXY] {
    auto endPose = ICgeometry::GetFieldRelativePose(frc::Pose2d(allianceRelativeEndXY, GetGyroAngle(false)));
    SetPose(endPose);
  });
}


// Getters & calculations
frc::Rotation2d SubDrivebase::GetGyroAngle(bool allianceRelative) { 
  auto alliance = frc::DriverStation::GetAlliance();
  if (!allianceRelative ||
    alliance.value_or(frc::DriverStation::Alliance::kBlue) == frc::DriverStation::Alliance::kBlue) {
    return _gyro.GetRotation2d();
  } else {
    return _gyro.GetRotation2d() - 180_deg;
  }
}

units::degree_t SubDrivebase::GetPitch() {
  return (_gyro.GetPitch().GetValue());
}

units::degree_t SubDrivebase::GetRoll() {
  return (_gyro.GetRoll().GetValue());
}

units::degree_t SubDrivebase::GetApproxTiltMagnitude() {
  // This is only accurate for small pitch and roll angles
  return units::math::hypot(GetPitch(), GetRoll());
}

units::meters_per_second_t SubDrivebase::GetVelocity() {
  auto speeds = _kinematics.ToChassisSpeeds(_frontLeft.GetState(), _frontRight.GetState(),
                                            _backLeft.GetState(), _backRight.GetState());
  return units::math::hypot(speeds.vx, speeds.vy);
}

frc::ChassisSpeeds SubDrivebase::GetChassisSpeeds(bool fieldRelative) {
  auto speeds = _kinematics.ToChassisSpeeds(
    _frontLeft.GetState(), _frontRight.GetState(), _backLeft.GetState(), _backRight.GetState());
  if (fieldRelative) {
    speeds = frc::ChassisSpeeds::FromRobotRelativeSpeeds(speeds, GetGyroAngle(false).Degrees());
  }

  return speeds;
}

frc::ChassisSpeeds SubDrivebase::GetDesiredChassisSpeeds(bool fieldRelative) {
  auto speeds = _kinematics.ToChassisSpeeds(_frontLeft.GetDesiredState(),
    _frontRight.GetDesiredState(), _backLeft.GetDesiredState(), _backRight.GetDesiredState());
  if (fieldRelative) {
    speeds = frc::ChassisSpeeds::FromRobotRelativeSpeeds(speeds, GetGyroAngle(false).Degrees());
  }

  return speeds;
}

units::degrees_per_second_t SubDrivebase::GetDesiredAngularVelocity() {
  auto speeds = _kinematics.ToChassisSpeeds(_frontLeft.GetDesiredState(), _frontRight.GetDesiredState(),
                                            _backLeft.GetDesiredState(), _backRight.GetDesiredState());
  return speeds.omega;
}

frc2::Trigger SubDrivebase::CheckCoastButton() {
  return frc2::Trigger{[this] { return !_toggleBrakeCoast.Get(); }};
}

units::turns_per_second_t SubDrivebase::CalcRotateSpeed(units::turn_t rotationError) {
  auto omega = _rotationP2pController.Calculate(rotationError.value(), 0) * 1_rad_per_s;
  return omega;
}

frc::ChassisSpeeds SubDrivebase::CalcDriveToPoseSpeeds(frc::Pose2d targetPose) {
  // Find target and current values
  units::meter_t targetXMeters = targetPose.X();
  units::meter_t targetYMeters = targetPose.Y();
  units::turn_t targetRotation = targetPose.Rotation().Radians();

  frc::Pose2d currentPose = PoseHandler::GetInstance().GetPose();
  units::meter_t currentXMeters = currentPose.X();
  units::meter_t currentYMeters = currentPose.Y();
  units::turn_t currentRotation = frc::InputModulus(GetGyroAngle(true).Degrees(), 0_deg, 360_deg);

  //Create a vector between current position and target position
  frc::Translation2d translationVector = frc::Translation2d(targetXMeters - currentXMeters, targetYMeters - currentYMeters);

  // Use PID controllers to calculate speeds
  auto translationSpeed = _translationP2pController.Calculate(0, translationVector.Norm().value()) * 1_mps;
  auto rotationSpeed = _rotationP2pController.Calculate(currentRotation.value(), targetRotation.value()) * 1_rad_per_s;

  // Clamp translation speed to max velocity
  translationSpeed = std::clamp(
    translationSpeed, -DrivebaseConfig::MAX_P2P_VELOCITY, DrivebaseConfig::MAX_P2P_VELOCITY);

  //Convert Polar back into Cartesian X and Y
  frc::Translation2d translationSpeedVector = frc::Translation2d((translationSpeed.value()*1_m), translationVector.Angle());
  units::meters_per_second_t xSpeed = translationSpeedVector.X().value() * 1_mps;
  units::meters_per_second_t ySpeed = translationSpeedVector.Y().value() * 1_mps;

  //Limit acceleration
  xSpeed = _xP2pLimiter.Calculate(xSpeed);
  ySpeed = _yP2pLimiter.Calculate(ySpeed);
  rotationSpeed = _rotP2pLimiter.Calculate(rotationSpeed);

  if (frc::DriverStation::GetAlliance() == frc::DriverStation::Alliance::kRed) {
    xSpeed *= -1;
    ySpeed *= -1;
  }

  //Logging
  std::string logPath = "Drivebase/DriveToPose/";
  Logger::Log(logPath + "Calc x speed", xSpeed);
  Logger::Log(logPath + "Calc y speed", ySpeed);
  Logger::Log(logPath + "Calc rot speed", rotationSpeed);
  Logger::Log(logPath + "Target pose Y", targetYMeters);
  Logger::Log(logPath + "Target pose X", targetXMeters);
  Logger::Log(logPath + "Target rotation", targetRotation);
  Logger::Log(logPath + "Current pose X", currentXMeters);
  Logger::Log(logPath + "Current pose Y", currentYMeters);
  Logger::Log(logPath + "Current rotation", currentRotation);
  return frc::ChassisSpeeds{xSpeed, ySpeed, rotationSpeed};
}

bool SubDrivebase::IsAtPose(
  frc::Pose2d pose, units::meter_t posErrorTolerance, units::degree_t rotErrorTolerance) {
  auto currentPose = PoseHandler::GetInstance().GetPose();
  auto rotError = GetGyroAngle(true) - pose.Rotation();
  auto posError = currentPose.Translation().Distance(pose.Translation());

  Logger::FieldDisplay::GetInstance().DisplayPose("Drivebase/IsAtPose/Current pose", currentPose);
  Logger::FieldDisplay::GetInstance().DisplayPose("Drivebase/IsAtPose/Target pose", pose);

  Logger::Log("Drivebase/IsAtPose/rotError", rotError.Degrees());
  Logger::Log("Drivebase/IsAtPose/posError", posError);

  bool atPose = (units::math::abs(rotError.Degrees()) < rotErrorTolerance) && (posError < posErrorTolerance);
  Logger::Log("Drivebase/IsAtPose/IsAtPose", atPose);
  return atPose;
}

frc2::CommandPtr SubDrivebase::DriveToPose(std::function<frc::Pose2d()> pose, double speedScaling,
  units::meter_t posErrorTolerance, units::degree_t rotErrorTolerance, bool flipForRedAlliance) {
  auto fieldRelativePose = [pose, flipForRedAlliance] {
    return flipForRedAlliance ? ICgeometry::GetFieldRelativePose(pose()) : pose();
  };
  
  return Drive(
      [this, fieldRelativePose, speedScaling] {
        auto pose = fieldRelativePose();
        return CalcDriveToPoseSpeeds(pose) * speedScaling;
      },
      true)
    .Until([this, fieldRelativePose, posErrorTolerance, rotErrorTolerance] {
      return IsAtPose(fieldRelativePose(), posErrorTolerance, rotErrorTolerance);
    });
}

frc::ChassisSpeeds SubDrivebase::CalcJoystickSpeeds(frc2::CommandXboxController& controller) {
  std::string configPath = "Drivebase/Config/";
  auto deadband = Logger::Tune(configPath + "Joystick Deadband", DrivebaseConfig::JOYSTICK_DEADBAND);
  auto maxVelocity = Logger::Tune(configPath + "Max Velocity", DrivebaseConfig::MAX_VELOCITY);
  auto maxAngularVelocity = Logger::Tune(configPath + "Max Angular Velocity", DrivebaseConfig::MAX_TELEOP_ANGULAR_VELOCITY);
  auto maxJoystickAccel = Logger::Tune(configPath + "Max Joystick Accel", DrivebaseConfig::MAX_JOYSTICK_ACCEL);
  auto maxAngularJoystickAccel = Logger::Tune(
    configPath + "Max Joystick Angular Accel", DrivebaseConfig::MAX_ANGULAR_JOYSTICK_ACCEL);
  auto translationScaling =
    Logger::Tune(configPath + "Translation Scaling", DrivebaseConfig::TRANSLATION_SCALING);
  auto rotationScaling =
    Logger::Tune(configPath + "Rotation Scaling", DrivebaseConfig::ROTATION_SCALING);

  // Recreate slew rate limiters if limits have changed
  if (maxJoystickAccel != _tunedMaxJoystickAccel) {
    _xStickLimiter = frc::SlewRateLimiter<units::scalar>{maxJoystickAccel / 1_s};
    _yStickLimiter = frc::SlewRateLimiter<units::scalar>{maxJoystickAccel / 1_s};
    _tunedMaxJoystickAccel = maxJoystickAccel;
  }
  if (maxAngularJoystickAccel != _tunedMaxAngularJoystickAccel) {
    _rotStickLimiter = frc::SlewRateLimiter<units::scalar>{maxAngularJoystickAccel / 1_s};
    _tunedMaxAngularJoystickAccel = maxAngularJoystickAccel;
  }

  // Apply deadbands
  double rawTranslationY = frc::ApplyDeadband(-controller.GetLeftY(), deadband);
  double rawTranslationX = frc::ApplyDeadband(-controller.GetLeftX(), deadband);
  double rawRotation = frc::ApplyDeadband(-controller.GetRightX(), deadband);

  // Convert cartesian (x, y) translation stick coordinates to polar (R, theta) and scale R-value
  double rawTranslationR = std::min(1.0, sqrt(pow(rawTranslationX, 2) + pow(rawTranslationY, 2)));
  double translationTheta = atan2(rawTranslationY, rawTranslationX);
  double scaledTranslationR = pow(rawTranslationR, translationScaling);

  // Convert polar coordinates (with scaled R-value) back to cartesian; scale rotation as well
  double scaledTranslationY = scaledTranslationR * sin(translationTheta);
  double scaledTranslationX = scaledTranslationR * cos(translationTheta);

  double scaledRotation = pow(rawRotation, rotationScaling);
  // Bring back any negatives that may have been lost by applying the exponent
  if (rawRotation < 0 && scaledRotation > 0){
    scaledRotation *= 1;
  }

  // Apply joystick rate limits and calculate speed
  auto forwardSpeed = _yStickLimiter.Calculate(scaledTranslationY) * maxVelocity;
  auto sidewaysSpeed = _xStickLimiter.Calculate(scaledTranslationX) * maxVelocity;
  auto rotationSpeed = _rotStickLimiter.Calculate(scaledRotation) * maxAngularVelocity;

  // Logger things
  std::string joystickScalingPath = "Drivebase/JoystickScaling/";
  Logger::Log(joystickScalingPath + "rawTranslationY", rawTranslationY);
  Logger::Log(joystickScalingPath + "rawTranslationX", rawTranslationX);
  Logger::Log(joystickScalingPath + "rawTranslationR", rawTranslationR);
  Logger::Log(joystickScalingPath + "translationTheta (degrees)",
    translationTheta * (180 / std::numbers::pi));  // Multiply by 180/pi to convert radians to degrees
  Logger::Log(joystickScalingPath + "scaledTranslationR", scaledTranslationR);
  Logger::Log(joystickScalingPath + "scaledTranslationY", scaledTranslationY);
  Logger::Log(joystickScalingPath + "scaledTranslationX", scaledTranslationX);
  Logger::Log(joystickScalingPath + "rawRotation", rawRotation);
  Logger::Log(joystickScalingPath + "scaledRotation", scaledRotation);

  return frc::ChassisSpeeds{forwardSpeed, sidewaysSpeed, rotationSpeed};
}

frc2::CommandPtr SubDrivebase::JoystickDrive(frc2::CommandXboxController& controller, bool fieldOriented, 
  double speedScale) {
  return Drive([this, speedScale, &controller] {
    auto speeds = CalcJoystickSpeeds(controller);
    speeds.vx = speeds.vx * speedScale;
    speeds.vy = speeds.vy * speedScale;
    return frc::ChassisSpeeds{speeds.vx, speeds.vy, speeds.omega};
  }, fieldOriented);
}

// Special

frc2::CommandPtr SubDrivebase::CharacteriseWheels() {
  static units::radian_t prevGyroAngle = 0_rad;
  static units::radian_t gyroAccumulator = 0_rad;
  static units::radian_t FRinitialWheelDistance = 0_rad;
  static units::radian_t FLinitialWheelDistance = 0_rad;
  static units::radian_t BRinitialWheelDistance = 0_rad;
  static units::radian_t BLinitialWheelDistance = 0_rad;
  static auto limiter = frc::SlewRateLimiter<units::degrees_per_second>{240_deg_per_s / 10_s};
  static units::meter_t drivebaseRadius = DrivebaseConfig::FL_POSITION.Norm();

  return RunOnce([this] {
    prevGyroAngle = GetGyroAngle().Radians();
    gyroAccumulator = 0_rad;
    FRinitialWheelDistance = _frontRight.GetDrivenRotations();
    FLinitialWheelDistance = _frontLeft.GetDrivenRotations();
    BRinitialWheelDistance = _backRight.GetDrivenRotations();
    BLinitialWheelDistance = _backLeft.GetDrivenRotations();
    limiter.Reset(0_deg_per_s);
    Logger::Log("Drivebase/WheelCharacterisation/DrivebaseRadius", drivebaseRadius);
  })
    .AndThen(Drive([] {
      auto speed = limiter.Calculate(100_deg_per_s);
      return frc::ChassisSpeeds{0_mps, 0_mps, speed};
    }, false))
    .AlongWith(frc2::cmd::Wait(1_s).AndThen(frc2::cmd::Run([this] {
      units::radian_t curGyroAngle = GetGyroAngle().Radians();
      gyroAccumulator = gyroAccumulator + frc::AngleModulus((prevGyroAngle - curGyroAngle));
      prevGyroAngle = curGyroAngle;
      Logger::Log("Drivebase/WheelCharacterisation/GyroAccum", gyroAccumulator);
      Logger::Log("Drivebase/WheelCharacterisation/GyroCur", curGyroAngle);
      Logger::Log("Drivebase/WheelCharacterisation/GyroPrev", prevGyroAngle);

      units::radian_t FRfinalWheelDistance = _frontRight.GetDrivenRotations();
      units::radian_t FLfinalWheelDistance = _frontLeft.GetDrivenRotations();
      units::radian_t BRfinalWheelDistance = _backRight.GetDrivenRotations();
      units::radian_t BLfinalWheelDistance = _backLeft.GetDrivenRotations();

      units::radian_t FRdelta = units::math::abs(FRfinalWheelDistance - FRinitialWheelDistance);
      units::radian_t FLdelta = units::math::abs(FLfinalWheelDistance - FLinitialWheelDistance);
      units::radian_t BRdelta = units::math::abs(BRfinalWheelDistance - BRinitialWheelDistance);
      units::radian_t BLdelta = units::math::abs(BLfinalWheelDistance - BLinitialWheelDistance);

      units::radian_t avgWheelDelta = (FRdelta + FLdelta + BRdelta + BLdelta) / 4.0;
      units::meter_t calcedWheelRadius = ((gyroAccumulator * drivebaseRadius) / avgWheelDelta);

      Logger::Log("Drivebase/WheelCharacterisation/CalcedWheelRadius", calcedWheelRadius);
      Logger::Log("Drivebase/WheelCharacterisation/WheelDistance", avgWheelDelta);

      // Logger::Log("Drivebase/WheelCharacterisation/FLinitialWheelDistance",
      // FLinitialWheelDistance);
      // Logger::Log("Drivebase/WheelCharacterisation/FRinitialWheelDistance",
      // FRinitialWheelDistance);
      // Logger::Log("Drivebase/WheelCharacterisation/BLinitialWheelDistance",
      // BLinitialWheelDistance);
      // Logger::Log("Drivebase/WheelCharacterisation/BRinitialWheelDistance",
      // BRinitialWheelDistance);

      // Logger::Log("Drivebase/WheelCharacterisation/FLfinalWheelDistance", FLfinalWheelDistance);
      // Logger::Log("Drivebase/WheelCharacterisation/FRfinalWheelDistance", FRfinalWheelDistance);
      // Logger::Log("Drivebase/WheelCharacterisation/BLfinalWheelDistance", BLfinalWheelDistance);
      // Logger::Log("Drivebase/WheelCharacterisation/BRfinalWheelDistance", BRfinalWheelDistance);

      Logger::Log("Drivebase/WheelCharacterisation/FLdelta", FLdelta);
      Logger::Log("Drivebase/WheelCharacterisation/FRdelta", FRdelta);
      Logger::Log("Drivebase/WheelCharacterisation/BLdelta", BLdelta);
      Logger::Log("Drivebase/WheelCharacterisation/BRdelta", BRdelta);
    })));
}

void SubDrivebase::SetPose(frc::Pose2d pose) {
  auto states = GetSwerveStates();

  auto alliance = frc::DriverStation::GetAlliance();
  if (alliance.value_or(frc::DriverStation::Alliance::kBlue) == frc::DriverStation::Alliance::kBlue) {
    ResetGyroHeading(pose.Rotation().Degrees());
  } else {
    ResetGyroHeading(pose.Rotation().Degrees() - 180_deg);
  }

  PoseHandler::GetInstance().SetPose(pose, states);
}