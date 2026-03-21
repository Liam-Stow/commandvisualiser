#include "IOSwerve.h"
#include "utilities/ICSparkMax.h"
#include "Constants.h"
#include <ctre/phoenix6/CANcoder.hpp>

class NeoIO : public SwerveIO{
  public:
    NeoIO(int turnCanID, int driveCanID, int encoderCanID, units::turn_t cancoderMagOffset);
    void ConfigTurnMotor() override;
    void SetDesiredAngle(units::degree_t angle) override;
    void SetAngle(units::turn_t angle) override;
    void SendSensorsToDash() override;
    void SetDesiredVelocity(units::meters_per_second_t velocity, units::newton_t forceFF) override;
    void DriveStraightVolts(units::volt_t volts) override;
    void StopMotors() override;
    void UpdateSim(units::second_t deltaTime) override;
    void SetNeutralMode(bool brakeModeToggle) override;
    void ConfigDriveMotor() override;
    frc::SwerveModulePosition GetPosition() override;
    frc::Rotation2d GetAngle() override;
    frc::Rotation2d GetDesiredAngle() override;
    units::meters_per_second_t GetSpeed() override;
    units::meters_per_second_t GetDesiredSpeed() override;
    units::volt_t GetDriveVoltage() override;
    frc::SwerveModuleState GetState() override;
    frc::SwerveModuleState GetDesiredState() override;
    units::radian_t GetDrivenRotations() override;

    const double TURNING_GEAR_RATIO = 150.0 / 7.0;
    const double DRIVE_GEAR_RATIO = 6.75; // L2 - Fast kit
    const units::meter_t WHEEL_RADIUS = 49.5_mm;
    const units::meter_t WHEEL_CIRCUMFERENCE = 2 * std::numbers::pi * WHEEL_RADIUS;

    const double TURN_P = 5;
    const double TURN_I = 0.0;
    const double TURN_D = 0;
    const double DRIVE_P = 0.0001;
    const double DRIVE_I = 0.0;
    const double DRIVE_D = 0.0;
    const double DRIVE_FF = 0.0141; 
  private:
    units::degree_t _desiredAngle;
    units::meters_per_second_t _desiredSpeed;

    ICSparkMax _canTurnMotor;
    ICSparkMax _canDriveMotor;
    ctre::phoenix6::hardware::CANcoder _canEncoder;

};
